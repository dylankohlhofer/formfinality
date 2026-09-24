#!/usr/bin/env node
// The release HTML and GPU model run unchanged. Only the camera is a generated
// blank stream: this tests lifecycle integration, never body recognition.
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium, firefox, webkit } from 'playwright';
import { loadVerifiedArtifact } from '../release/web.mjs';
import { benignConsoleError } from './lib.mjs';

const args = process.argv.slice(2);
if(![2,4].includes(args.length) || args[0] !== '--dir' || args.length === 4 &&
  (args[2] !== '--browser' || !['chromium','firefox','webkit'].includes(args[3])))
  throw new Error('Usage: node testing/camera-e2e.mjs --dir <built-directory> [--browser chromium|firefox|webkit]');
const deadline = setTimeout(() => { console.error('Camera E2E deadline exceeded; incomplete, not passed.'); process.exit(1); },240000);
const {receipt,files} = await loadVerifiedArtifact(resolve(args[1]));
const types = {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.json':'application/json','.mp3':'audio/mpeg'};
const headers = Object.fromEntries(files.get('/_headers').toString().split('\n').filter(l => l.startsWith('  ')).map(line => {
  const i=line.indexOf(':'); return [line.slice(0,i).trim(),line.slice(i+1).trim()];
}));
const server = createServer((req,res) => {
  const path = new URL(req.url,'http://localhost').pathname;
  if(path === '/favicon.ico'){ res.writeHead(204); res.end(); return; }
  const name = path === '/' ? '/index.html' : path, bytes = files.get(name);
  res.writeHead(bytes ? 200 : 404,{...headers,'Content-Type':types[extname(name)] || 'application/octet-stream'});
  res.end(bytes || 'Not found');
});
await new Promise((ok,fail) => { server.once('error',fail); server.listen(0,'127.0.0.1',ok); });
const origin = `http://127.0.0.1:${server.address().port}`;
const dir = resolve('test-results',`camera-e2e-${Date.now()}-${process.pid}`);
await mkdir(dir,{recursive:true});
const report = {schema:'camera-e2e/1',sourceHash:receipt.sourceHash,buildHash:receipt.buildHash,cases:[],limitations:[
  'Blank generated streams; no actual person, camera permission prompt or recognition accuracy.',
  'Desktop browser engines at desktop/phone sizes; no physical iOS or Android device.',
  'Separate recorded-audio suite measures speech transport; this test does not assess pronunciation.'
]};
try {
  for(const [name,type,viewport] of [
    ['chromium-desktop',chromium,{width:1280,height:800}],
    ['chromium-phone',chromium,{width:390,height:844}],
    ['firefox-phone',firefox,{width:390,height:844}],
    ['webkit-phone',webkit,{width:390,height:844}]
  ]) {
    if(args[3] && !name.startsWith(args[3])) continue;
    let browser;
    const result = {name,status:'failed',checks:[],errors:[],external:[],requests:[]}; report.cases.push(result);
    const check = (label,pass,actual) => result.checks.push({label,pass:!!pass,actual});
    try {
      browser = await type.launch();
      const context = await browser.newContext({viewport});
      await context.addInitScript(() => {
        window.cameraTestStreams=[]; window.cameraTestCalls=0;
        // WebKit may recreate the MediaDevices wrapper after GC, losing an
        // instance-only method override. Retain the exact substituted object so
        // every acquisition (including restart) stays synthetic.
        const devices = navigator.mediaDevices;
        Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:devices});
        Object.defineProperty(devices,'getUserMedia',{configurable:true,value:async constraints => {
          if(constraints.audio !== false) throw new Error('Unexpected microphone request');
          window.cameraTestCalls++;
          const c=document.createElement('canvas'); c.width=640; c.height=360;
          const ctx=c.getContext('2d'); ctx.fillStyle='#777'; ctx.fillRect(0,0,640,360);
          const timer=setInterval(() => ctx.fillRect(0,0,640,360),100),stream=c.captureStream(10);
          for(const track of stream.getTracks()) {
            const stop=track.stop.bind(track); track.stop=() => { clearInterval(timer); stop(); };
          }
          cameraTestStreams.push(stream); return stream;
        }});
      });
      const page = await context.newPage(); page.setDefaultTimeout(20000);
      page.on('pageerror',e => result.errors.push(e.stack || e.message));
      page.on('console',m => { if(m.type()==='error' && !benignConsoleError(m.text())) result.errors.push(m.text()); });
      await page.route('**/*',route => {
        const url=new URL(route.request().url());
        if(url.origin !== origin){ result.external.push(url.href); return route.abort(); }
        result.requests.push(url.pathname); return route.continue();
      });
      await page.goto(origin);
      check('Welcome opens',await page.locator('#calBtn').isVisible());
      await page.locator('#skipBtn').click(); await page.locator('[data-t="building"]').click();
      await page.locator('#goBtn').click(); await page.locator('[data-plan="first-steps"]').click();
      check('Workout preview opens',await page.locator('#planStartBtn').isVisible());
      await page.locator('#planStartBtn').click(); await page.locator('#pauseBtn').waitFor();
      await page.waitForTimeout(1200);
      check('Model and WASM load locally',result.requests.some(p=>p.endsWith('.task')) && result.requests.some(p=>p.endsWith('.wasm')));
      await page.locator('#pauseBtn').click();
      check('Pause opens',await page.locator('#sessionDialog').isVisible());
      await page.locator('#resumeBtn').click();
      check('Resume closes pause',!await page.locator('#sessionDialog').isVisible());
      await page.keyboard.press('s');
      check('Keyboard skip reaches rest',await page.locator('#movementName').innerText()==='Rest');
      check('Rest previews the next movement',/Glute Bridge/.test(await page.locator('#movementNext').innerText()));
      // No dispatched ended event: the frame-loop guard must detect a stopped
      // track even when currentTime stops changing (including WebKit zero video).
      await page.evaluate(() => cameraTestStreams[0].getVideoTracks()[0].stop());
      await page.locator('#restartCameraBtn').waitFor();
      check('Disconnect is named',await page.locator('#sessionDialogTitle').innerText()==='Camera disconnected');
      check('Ended camera detaches',await page.locator('#cam').evaluate(v=>v.srcObject===null));
      check('Resume is blocked until reconnect',await page.locator('#resumeBtn').isDisabled());
      const frozen = await page.locator('#big').textContent();
      await page.waitForTimeout(300);
      check('Interrupted rest clock stays frozen',await page.locator('#big').textContent()===frozen);
      await page.screenshot({path:resolve(dir,`${name}-disconnected.png`),fullPage:true});
      await page.locator('#restartCameraBtn').click();
      await page.getByText('Camera ready. Your workout is still paused. Get into position and choose Resume workout.').waitFor();
      await page.waitForFunction(() => !document.getElementById('resumeBtn').disabled);
      check('Reconnect leaves the workout paused',await page.locator('#sessionDialog').isVisible());
      const tracks = await page.evaluate(() => ({calls:window.cameraTestCalls,streams:cameraTestStreams.map(s=>({id:s.id,tracks:s.getVideoTracks().map(t=>({id:t.id,state:t.readyState}))})),
        attached:{id:document.getElementById('cam').srcObject?.id,tracks:document.getElementById('cam').srcObject?.getVideoTracks().map(t=>({id:t.id,state:t.readyState}))}}));
      check('Only replacement track is live',tracks.calls===2 && tracks.streams.length===2 && tracks.streams[0].tracks[0]?.state==='ended' && tracks.streams[1].tracks[0]?.state==='live' && tracks.attached.id===tracks.streams[1].id,tracks);
      await page.locator('#resumeBtn').click();
      check('Reconnected workout resumes explicitly',!await page.locator('#sessionDialog').isVisible());
      await page.locator('#pauseBtn').click(); await page.locator('#endSessionBtn').click();
      check('End shows partial debrief',await page.locator('#msg h2').innerText()==='Workout ended');
      check('End releases every owned track',await page.evaluate(() => cameraTestStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended')) && document.getElementById('cam').srcObject===null));
      await page.waitForTimeout(400);
      const width = await page.evaluate(() => ({viewport:innerWidth,body:document.body.scrollWidth,root:document.documentElement.scrollWidth}));
      check('No horizontal overflow',width.body<=width.viewport+2 && width.root<=width.viewport+2,width);
      check('No external requests',result.external.length===0,result.external);
      check('No browser errors',result.errors.length===0,result.errors);
      await page.screenshot({path:resolve(dir,`${name}-summary.png`),fullPage:true});
      result.status=result.checks.every(c=>c.pass)?'passed':'failed';
    } catch(error){ result.error=error.stack; }
    finally { await browser?.close(); }
    console.log(`${result.status.toUpperCase()} ${name}: ${result.checks.filter(c=>c.pass).length}/${result.checks.length}`);
    await writeFile(resolve(dir,'result.json'),JSON.stringify(report,null,2)+'\n');
  }
} finally { await new Promise(ok => server.close(ok)); clearTimeout(deadline); }
console.log(`Camera E2E evidence: ${dir}`);
if(report.cases.some(c=>c.status!=='passed')) process.exitCode=1;
