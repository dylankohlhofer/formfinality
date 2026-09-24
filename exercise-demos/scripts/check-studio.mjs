// Opt-in smoke against the running local Studio, using the root's Playwright.
import assert from 'node:assert/strict';
import {mkdir, mkdtemp, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {DURATION, CYCLE} from '../src/motion.ts';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
await mkdir(join(project,'out'), {recursive:true});
const output = await mkdtemp(join(project,'out','studio-check-'));
const browser = await chromium.launch({headless:true});
const errors = [], samples = [], views = new Set();
try {
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto('http://localhost:3123/SquatLandscape');
  await page.waitForSelector('canvas');
  const currentFrame = () => page.locator('button').evaluateAll(buttons => {
    const time = buttons.find(button => /^\d\d:\d\d\.\d\d$/.test(button.innerText.trim()));
    return time ? Number(time.getAttribute('aria-label')) : null;
  });
  await page.getByRole('button',{name:'Go to beginning',exact:true}).click();
  await page.getByRole('button',{name:'Play',exact:true}).click();
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const frame = await currentFrame();
    assert.ok(Number.isInteger(frame)); samples.push(frame);
    const view = await page.locator('[data-demo-view]').getAttribute('data-demo-view');
    views.add(view);
    assert.deepEqual(errors,[]);
    if (frame >= DURATION - 7 || (samples.some(f => f > DURATION - 30) && frame < 60)) break;
    await page.waitForTimeout(100);
  }
  assert.ok(samples.some(frame => frame > 2 * CYCLE), 'did not play all three repetition intervals');
  assert.ok(samples.some(frame => frame > DURATION - 30), 'did not reach the final repetition endpoint');
  assert.ok(views.has('FRONT VIEW') && views.has('THREE-QUARTER VIEW') && views.has('CHANGING VIEW'), 'did not show both teaching angles and transitions');
  const pause = page.getByRole('button',{name:'Pause',exact:true});
  if (await pause.count()) await pause.click();
  await page.getByRole('button',{name:'Go to beginning',exact:true}).click();
  assert.equal(await currentFrame(),0);
  for (let i = 0; i < 5; i++) await page.getByRole('button',{name:'Go forward 1 frame',exact:true}).click();
  assert.equal(await currentFrame(),5);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:join(output,'studio.png')});
  await page.goto('http://localhost:3123/SquatPortrait');
  await page.waitForSelector('canvas');
  await page.getByRole('button',{name:'Go to beginning',exact:true}).click();
  const viewLabel = await page.locator('[data-demo-view]').boundingBox();
  const cardLabel = await page.getByText('FIND YOUR BASE',{exact:true}).boundingBox();
  assert.ok(viewLabel && cardLabel);
  assert.ok(viewLabel.y + viewLabel.height < cardLabel.y, 'portrait angle label overlaps the teaching card');
  assert.deepEqual(errors,[]);
  await page.screenshot({path:join(output,'studio-portrait.png')});
  await writeFile(join(output,'report.json'),JSON.stringify({samples,views:[...views],errors,restartFrame:0,steppedFrame:5,
    portraitLabelsSeparated:true,
    limitations:['Local desktop functional smoke, not a frame-rate benchmark or phone validation']},null,2) + '\n');
  console.log(`Studio playback/restart/frame-step passed: ${output}`);
} finally { await browser.close(); }
