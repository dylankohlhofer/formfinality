import { readFile } from 'node:fs/promises';
import { exerciseInputs } from './exercise-inputs.mjs';
const frame = exerciseInputs(JSON.parse(await readFile(new URL('../conformance-vectors.json', import.meta.url))).poses).frame('plank');
export async function diagnosticCases(runCase) {
  await runCase('diagnostic-off', 'Normal exercise never opts the person into private diagnostic capture.', async(page,check)=>{
    await page.locator('#calBtn').click(); await page.evaluate(f=>{for(let i=0;i<90;i++)__testLab.feed(f,1/30);},frame);
    check('No diagnostic entries without opt-in',await page.evaluate(()=>__testLab.diagnosticAccess().diagnostics.items.length),0);
  });
  await runCase('diagnostic-export-replay', 'Opt-in capture, flag, export, local replay, clear and import work without saving pixels or uploading.', async(page,check,capture)=>{
    await page.locator('#diagPanel > summary').click(); await page.locator('#diagConsent').check(); await page.locator('#diagStart').click();
    await page.waitForFunction(()=>__testLab.diagnosticAccess().diagnostics.active);
    await page.locator('#calBtn').click();
    await page.evaluate(f=>{for(let i=0;i<90;i++)__testLab.feed(f,1/30);__testLab.feed(null,1/30);},frame);
    await page.locator('#diagFlag').click(); await page.locator('#skipExBtn').click(); await page.locator('#diagStop').click();
    const countBefore=await page.evaluate(()=>__testLab.diagnosticAccess().diagnostics.items.length);
    await page.locator('#diagStart').click(); await page.locator('#diagStop').click();
    check('Resume preserves the previous recording',await page.evaluate(()=>__testLab.diagnosticAccess().diagnostics.items.length)>countBefore,true);
    const download=page.waitForEvent('download'); await page.locator('#diagExport').click();
    const file=await download, text=await readFile(await file.path(),'utf8'), data=JSON.parse(text);
    check('Export includes a source fingerprint', /^[a-f0-9]{64}$/.test(data.meta.scriptSha256),true);
    check('Flag is retained',data.entries.some(e=>e.kind==='flag'),true);
    check('Tracking loss remains null, not invented geometry or zero score',data.entries.some(e=>e.kind==='frame'&&e.data.frame===null&&e.data.score===null),true);
    check('Frame payload has joints but no pixels/media',data.entries.filter(e=>e.kind==='frame'&&e.data.frame).every(e=>Object.keys(e.data.frame).sort().join(',')==='aspect,cam,conf,left,right,sideness'),true);
    check('Skip is present in timeline',data.entries.some(e=>e.data.event==='skipped'),true);
    await page.locator('#diagReview').click(); check('Saved replay is available',await page.locator('#diagViewer').isVisible(),true);
    await page.locator('#diagViewer details summary').click();
    await page.locator('#diagSeek').evaluate((el,i)=>{el.value=i;el.dispatchEvent(new Event('input'));},data.entries.findIndex(e=>e.kind==='frame'));
    check('Replay is labelled saved evidence, not reassessment',/Saved observations/.test(await page.locator('#diagReadout').innerText()),true);
    await capture('replay');
    await page.locator('#diagClear').click();
    check('Clear revokes consent and erases retained entries',await page.evaluate(()=>!document.getElementById('diagConsent').checked&&__testLab.diagnosticAccess().diagnostics.items.length===0),true);
    data.meta.version='<img src=x onerror="window.injectedDiagnostic=true">';
    await page.locator('#diagImport').setInputFiles({name:'review.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
    await page.waitForFunction(()=>!document.getElementById('diagViewer').hidden);
    check('Imported data never executes markup',await page.evaluate(()=>window.injectedDiagnostic===undefined&&document.querySelectorAll('#diagReadout img').length===0),true);
    check('Import does not re-enable recording',await page.evaluate(()=>__testLab.diagnosticAccess().diagnostics.active),false);
    await page.reload(); await page.waitForFunction(()=>!!window.__testLab);
    check('Reload retains no diagnostic data',await page.evaluate(()=>__testLab.diagnosticAccess().diagnostics.items.length),0);
  });
  await runCase('diagnostic-consent-revocation', 'Unchecking consent clears captured details without stopping the workout.', async(page,check)=>{
    await page.locator('#diagPanel > summary').click(); await page.locator('#diagConsent').check(); await page.locator('#diagStart').click();
    await page.waitForFunction(()=>__testLab.diagnosticAccess().diagnostics.active); await page.locator('#calBtn').click();
    await page.evaluate(f=>__testLab.feed(f,1/30),frame); await page.locator('#diagConsent').uncheck();
    await page.evaluate(f=>__testLab.feed(f,1/30),frame);
    check('Revocation clears and disables capture',await page.evaluate(()=>{const b=__testLab.diagnosticAccess().diagnostics;return !b.active&&b.items.length===0&&b.meta===null;}),true);
    check('Workout is still running',await page.locator('#skipExBtn').isVisible(),true);
  });
}
