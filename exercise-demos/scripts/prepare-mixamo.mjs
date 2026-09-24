// Offline asset preparation. Uses the root's existing Playwright, no external service.
import {createServer} from 'node:http';
import {readFile, writeFile, mkdir, access} from 'node:fs/promises';
import {dirname, extname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(process.argv[2] ?? resolve(project, '../Ch44_nonPBR.fbx'));
const output = resolve(project, 'public/models/alien-soldier.glb');
const report = resolve(project, 'out/alien-soldier-import.json');
try { await access(output); throw new Error(`Refusing to overwrite ${output}`); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const bytes = await readFile(source);
if (bytes.length > 128 * 1024 * 1024 || !bytes.subarray(0, 20).toString().startsWith('Kaydara FBX Binary')) {
  throw new Error('Expected a binary FBX no larger than 128 MiB');
}
const threeRoot = resolve(project, 'node_modules/three');
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (path === '/source.fbx') { response.end(bytes); return; }
    if (path === '/') {
      response.setHeader('Content-Type', 'text/html');
      response.end('<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>'); return;
    }
    if (!path.startsWith('/three/')) { response.writeHead(404).end(); return; }
    const file = resolve(threeRoot, decodeURIComponent(path.slice(7)));
    if (!file.startsWith(threeRoot + sep) || extname(file) !== '.js') throw new Error('Disallowed module path');
    response.setHeader('Content-Type', 'text/javascript'); response.end(await readFile(file));
  } catch (error) { response.writeHead(500).end(String(error)); }
});
await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const warnings = [];
try {
  browser = await chromium.launch({headless: true});
  const page = await browser.newPage({acceptDownloads: true});
  page.setDefaultTimeout(60_000);
  await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  page.on('console', message => { if (['warning','error'].includes(message.type())) warnings.push(message.text()); });
  await page.goto(origin);
  const downloadPromise = page.waitForEvent('download');
  const info = await page.evaluate(async () => {
    const THREE = await import('three');
    const {FBXLoader} = await import('three/addons/loaders/FBXLoader.js');
    const {GLTFExporter} = await import('three/addons/exporters/GLTFExporter.js');
    const {mergeVertices} = await import('three/addons/utils/BufferGeometryUtils.js');
    const manager = new THREE.LoadingManager();
    const loaded = new Promise((ok, fail) => { manager.onLoad = ok; manager.onError = url => fail(new Error(`Texture failed: ${url}`)); });
    const data = await (await fetch('/source.fbx')).arrayBuffer();
    const model = new FBXLoader(manager).parse(data, '');
    await loaded;
    const meshes = [], bones = [], textures = new Set();
    model.traverse(node => {
      if (node.isBone) bones.push(node.name);
      if (!node.isMesh) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      const converted = materials.map(material => {
        for (const map of [material.map,material.normalMap]) {
          if (!map?.image?.width) throw new Error(`Missing diffuse/normal texture: ${material.name}`);
          textures.add(map);
        }
        // Non-PBR specular/gloss maps cannot be copied into metallic/roughness slots.
        return new THREE.MeshStandardMaterial({name: material.name, color: material.color,
          map: material.map, normalMap: material.normalMap, normalScale: material.normalScale,
          roughness: 0.75, metalness: 0, side: material.side});
      });
      node.material = Array.isArray(node.material) ? converted : converted[0];
      node.geometry = mergeVertices(node.geometry);
      // FBX interleaves hundreds of tiny opaque material groups. Regroup their
      // existing triangles without decimation, otherwise glTF creates hundreds
      // of skinned primitives and bounding checks repeatedly scan the same mesh.
      const sourceDrawGroups = node.geometry.groups.length;
      const byMaterial = new Map();
      for (const group of node.geometry.groups) {
        const indices = byMaterial.get(group.materialIndex) ?? [];
        for (let i = group.start; i < group.start + group.count; i++) indices.push(node.geometry.index.getX(i));
        byMaterial.set(group.materialIndex, indices);
      }
      if (byMaterial.size) {
        const reordered = []; node.geometry.clearGroups();
        for (const [materialIndex, indices] of byMaterial) {
          node.geometry.addGroup(reordered.length, indices.length, materialIndex);
          for (const index of indices) reordered.push(index);
        }
        node.geometry.setIndex(reordered);
      }
      if (node.isSkinnedMesh) node.normalizeSkinWeights();
      node.castShadow = true; node.receiveShadow = true;
      meshes.push({name: node.name, vertices: node.geometry.attributes.position.count,
        triangles: node.geometry.index.count / 3, bones: node.skeleton?.bones.length,
        sourceDrawGroups, drawGroups: node.geometry.groups.length, materials: converted.map(m => m.name)});
    });
    if (!bones.includes('mixamorigHips') || meshes.length !== 1) throw new Error('Unexpected character structure');
    model.animations = []; // Input contains a one-frame pose, not an exercise clip.
    const glb = await new GLTFExporter().parseAsync(model, {binary: true, animations: [], maxTextureSize: 1024});
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([glb]));
    a.download = 'alien-soldier.glb'; a.click();
    return {outputBytes: glb.byteLength, meshes, boneCount: bones.length, textureCount: textures.size,
      sourceTextureSizes: [...textures].map(t => [t.image.width, t.image.height]), maxTextureSize: 1024};
  });
  const download = await downloadPromise;
  const glb = await readFile(await download.path());
  await mkdir(dirname(output), {recursive: true}); await mkdir(dirname(report), {recursive: true});
  await writeFile(output, glb, {flag: 'wx'});
  const record = {source: 'Ch44_nonPBR.fbx', label: 'Alien Soldier (user-supplied Mixamo download)',
    sourceBytes: bytes.length, sourceSha256: createHash('sha256').update(bytes).digest('hex'),
    outputSha256: createHash('sha256').update(glb).digest('hex'), ...info, warnings};
  await writeFile(report, JSON.stringify(record, null, 2) + '\n');
  console.log(JSON.stringify(record, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise(ok => server.close(ok));
}
