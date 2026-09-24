// Actual cold-load stills, not a video export. Prevent a "successful" blank stage.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir, mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {CAMERA_TURN, CYCLE, DURATION, TIMING, cameraAt} from '../src/motion.ts';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const browser = process.argv[2];
if (!browser) throw new Error('Pass the absolute path to a compatible Chrome headless-shell executable');
await mkdir(join(project,'out'), {recursive:true});
const output = await mkdtemp(join(project,'out','asset-render-check-'));

function characterPixels(png, portrait) {
  assert.equal(png.subarray(0,8).toString('hex'), '89504e470d0a1a0a');
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20), type = png[25];
  assert.equal(png[24],8); assert.equal(png[28],0); assert.ok(type === 2 || type === 6);
  assert.deepEqual([width,height], portrait ? [540,960] : [960,540]);
  const channels = type === 6 ? 4 : 3, stride = width * channels, chunks = [];
  for (let at = 8; at < png.length;) {
    const length = png.readUInt32BE(at), kind = png.subarray(at + 4,at + 8).toString();
    assert.ok(at + length + 12 <= png.length);
    if (kind === 'IDAT') chunks.push(png.subarray(at + 8,at + 8 + length));
    at += length + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks), {maxOutputLength:(stride + 1) * height});
  assert.equal(raw.length, (stride + 1) * height);
  const pixels = Buffer.alloc(stride * height);
  const paeth = (a,b,c) => { const p = a + b - c, x = Math.abs(p - a), y = Math.abs(p - b), z = Math.abs(p - c); return x <= y && x <= z ? a : y <= z ? b : c; };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]; assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const at = y * stride + x, a = x >= channels ? pixels[at - channels] : 0;
      const b = y ? pixels[at - stride] : 0, c = y && x >= channels ? pixels[at - stride - channels] : 0;
      const predictor = [0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter];
      pixels[at] = (raw[y * (stride + 1) + x + 1] + predictor) & 255;
    }
  }
  // Above the platform and away from every text block in the approved layout.
  const [x0,y0,x1,y1] = portrait ? [170,180,450,550] : [450,70,885,385];
  let count = 0;
  const foreground = createHash('sha256');
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const at = y * stride + x * channels;
    foreground.update(pixels.subarray(at,at + 3));
    if (Math.max(Math.abs(pixels[at] - 16),Math.abs(pixels[at+1] - 17),Math.abs(pixels[at+2] - 22)) > 16) count++;
  }
  assert.ok(count > 1800, `Character absent or unreadably dark: ${count} foreground pixels`);
  return {count,stageSha256:foreground.digest('hex')};
}

const results = [];
for (const composition of ['SquatLandscape','SquatPortrait']) {
  for (const frame of [0,TIMING.bottom,CYCLE + CAMERA_TURN.after,CYCLE + TIMING.bottom,DURATION - 1]) {
    const file = join(output, `${composition}-${frame}.png`);
    await new Promise((ok, fail) => {
      const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--no-install','remotion','still',composition,file,
        `--frame=${frame}`,'--scale=0.5',`--browser-executable=${browser}`], {cwd:project, stdio:'inherit'});
      const deadline = setTimeout(() => { child.kill('SIGTERM'); fail(new Error('Still render exceeded 60s')); },60_000);
      child.once('error', error => {clearTimeout(deadline); fail(error);});
      child.once('exit', code => {clearTimeout(deadline); code === 0 ? ok() : fail(new Error(`Still render exited ${code}`));});
    });
    const png = await readFile(file);
    const measured = characterPixels(png,composition === 'SquatPortrait');
    results.push({composition,frame,file,view:cameraAt(frame).label,characterPixels:measured.count,stageSha256:measured.stageSha256});
  }
  const rendered = results.filter(result => result.composition === composition);
  for (const [side,front] of [[0,CYCLE + CAMERA_TURN.after],[TIMING.bottom,CYCLE + TIMING.bottom]]) {
    assert.notEqual(rendered.find(r => r.frame === side).stageSha256,rendered.find(r => r.frame === front).stageSha256,
      'Same pose must visibly change angle, not just change the caption');
  }
}
const asset = await readFile(join(project,'public/models/alien-soldier.glb'));
await writeFile(join(output,'report.json'), JSON.stringify({assetSha256:createHash('sha256').update(asset).digest('hex'),results,
  limitations:['Stills, not real-time playback performance','Not exercise-technique approval','Not rendered-pixel pose recognition']},null,2) + '\n');
console.log(`${results.length} cold-load character renders passed: ${output}`);
