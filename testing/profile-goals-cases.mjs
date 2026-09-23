// Real controls in the existing shell runner. Never launch mail, authorize an
// account or send user data. Test-only short plans are synthetic policy probes.
import {readFile} from 'node:fs/promises';
import {exerciseInputs} from './exercise-inputs.mjs';
const inputs=exerciseInputs(JSON.parse(await readFile(new URL('../conformance-vectors.json',import.meta.url))).poses);
async function home(page){
  await page.locator('#skipBtn').click(); await page.locator('[data-t="building"]').click(); await page.locator('#goBtn').click();
}
async function profile(page){ await page.locator('#profileOpenBtn').click(); }
async function plan(page){
  await page.evaluate(()=>__testLab.installPlan({id:'profile-probe',name:'Profile test',tiers:['building'],steps:[{ex:'plank',t:2}]}));
}
async function start(page){ await page.locator('[data-plan="profile-probe"]').click(); await page.locator('#planStartBtn').click(); }
async function finishObserved(page){
  const frames=Array.from({length:600},()=>inputs.frame('plank',0));
  await page.evaluate(frames=>{for(const frame of frames)__testLab.feed(frame,1/30);},frames);
}
export async function profileGoalCases(runCase){
  for(const width of [390,1280]) await runCase(`profile-settings-${width}`,'Independent profile consent, fixed weekly targets, persistence, export and scoped erase.',async(page,check,capture)=>{
    await page.setViewportSize({width,height:844}); await home(page); await profile(page);
    check('Saving starts off',await page.locator('#profileEnabled').isChecked(),false);
    check('Merely opening profile does not persist anything',await page.evaluate(()=>localStorage.getItem(__testLab.profileAccess().PROFILE_KEY)),null);
    await page.locator('#profileTarget').selectOption('2'); await page.locator('#profileEnabled').check();
    await page.locator('#profileName').fill('<Sam>'); await page.locator('#profileTarget').selectOption('4');
    await page.locator('#profileSaveBtn').click();
    check('Current target is not rewritten',await page.evaluate(()=>__testLab.profileAccess().profileGoals.summary(Date.now()).target),2);
    check('Pending next-week target saved',await page.evaluate(()=>__testLab.profileAccess().profileGoals.summary(Date.now()).next.target),4);
    check('Coaching history consent remains off',await page.evaluate(()=>__testLab.coachAccess().coachMemory.read().consent.history),false);
    check('Unassessed credit is separately off',await page.locator('#profileUnassessed').isChecked(),false);
    check('No horizontal dialog overflow',await page.locator('#profileDialog').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
    await capture('profile-settings'); await page.reload(); await page.waitForFunction(()=>!!window.__testLab); await home(page); await profile(page);
    check('Nickname restored as text',await page.locator('#profileName').inputValue(),'<Sam>');
    check('Saving restored',await page.locator('#profileEnabled').isChecked(),true);
    const download=page.waitForEvent('download'); await page.locator('#profileExportBtn').click();
    check('Explicit scoped export',(await download).suggestedFilename(),'formcoach-local-profile.json');
    await page.evaluate(()=>localStorage.setItem('profile-unrelated-sentinel','keep'));
    await page.locator('#profileEraseBtn').click(); await page.locator('#profileEraseNo').click();
    check('Cancelled erase keeps data',await page.locator('#profileEnabled').isChecked(),true);
    await page.locator('#profileEraseBtn').click(); await page.locator('#profileEraseYes').click();
    check('Erase also opts out',await page.locator('#profileEnabled').isChecked(),false);
    check('Only profile key removed',await page.evaluate(()=>[localStorage.getItem(__testLab.profileAccess().PROFILE_KEY),localStorage.getItem('profile-unrelated-sentinel')]),[null,'keep']);
    await page.locator('#profileClose').click(); check('Close returns to the picker',await page.locator('#profileOpenBtn').isVisible(),true);
  });
  await runCase('profile-observed-completion','Actual hold completion earns one local day and prepares only a user-approved email draft.',async(page,check,capture)=>{
    await plan(page); await home(page); await profile(page); await page.locator('#profileEnabled').check(); await page.locator('#profileClose').click();
    await start(page); await finishObserved(page);
    check('Actual engine completed the routine',await page.evaluate(()=>__testLab.snapshot().done),true);
    check('Finish consumer credits one day',await page.evaluate(()=>__testLab.profileAccess().profileGoals.summary(Date.now()).days),1);
    check('No form score persisted',await page.evaluate(()=>Object.keys(__testLab.profileAccess().profileGoals.read().data.events[0])),['sessionId','planId','finishedAt','basis']);
    check('Credit result is visible',/One routine-day added/.test(await page.locator('#profileSaveStatus').innerText()),true);
    check('Email choice is visible',await page.locator('#workoutEmailLink').isVisible(),true);
    const url=await page.locator('#workoutEmailLink').getAttribute('href');
    check('No preselected recipient',url.startsWith('mailto:?'),true);
    check('No invented shared streak',decodeURIComponent(url).includes('not a fitness assessment or a synced Duo streak'),true);
    // Exercise a real click but intercept the external protocol before navigation.
    await page.locator('#workoutEmailLink').evaluate(e=>e.addEventListener('click',event=>{event.preventDefault();window.profileDraftClick=e.href;},{once:true}));
    await page.locator('#workoutEmailLink').click();
    check('Only explicit click selects the draft',await page.evaluate(()=>window.profileDraftClick),url);
    await capture('completion-email');
    await page.locator('#againBtn').click(); await start(page); await finishObserved(page);
    check('Two real routines remain one credited day',await page.evaluate(()=>{const s=__testLab.profileAccess().profileGoals.summary(Date.now());return [s.days,s.completions];}),[1,2]);
  });
  await runCase('profile-unassessed-choice','Manual completion is not a camera claim and only contributes after an explicit profile choice.',async(page,check,capture)=>{
    await plan(page); await home(page); await profile(page); await page.locator('#profileEnabled').check(); await page.locator('#profileClose').click();
    await start(page); await page.locator('#followAlongBtn').click(); await page.locator('#finishAlongBtn').click();
    check('Default does not silently credit manual completion',await page.evaluate(()=>__testLab.profileAccess().profileGoals.summary(Date.now()).days),0);
    check('Reason explains the unassessed choice',/Unassessed routine not added/.test(await page.locator('#profileSaveStatus').innerText()),true);
    check('Sharing still identifies unassessed work',decodeURIComponent(await page.locator('#workoutEmailLink').getAttribute('href')).includes('unassessed'),true);
    await page.locator('#againBtn').click(); await profile(page); await page.locator('#profileUnassessed').check();
    await page.locator('#profileSaveBtn').click(); await page.locator('#profileClose').click();
    await start(page); await page.locator('#followAlongBtn').click(); await page.locator('#finishAlongBtn').click();
    check('Explicit choice credits participation, not observation',await page.evaluate(()=>__testLab.profileAccess().profileGoals.read().data.events.map(e=>e.basis)),['unassessed']);
    check('Core score stays unknown',await page.evaluate(()=>__testLab.snapshot().finish.avg),null);
    check('Core holds stay zero',await page.evaluate(()=>__testLab.snapshot().finish.bestHold),0);
    await capture('unassessed-completion');
  });
  for(const end of ['skip','end']) await runCase(`profile-${end}-excluded`,'Skipped or stopped routines cannot earn weekly credit or offer a completed-workout email.',async(page,check)=>{
    await plan(page); await home(page); await profile(page); await page.locator('#profileEnabled').check(); await page.locator('#profileClose').click(); await start(page);
    if(end==='skip') await page.locator('#skipExBtn').click();
    else {await page.locator('#startBtn').click();await page.locator('#endSessionBtn').click();}
    check('No weekly day awarded',await page.evaluate(()=>__testLab.profileAccess().profileGoals.summary(Date.now()).days),0);
    check('No completion claim offered',await page.locator('#workoutEmailShare').isVisible(),false);
    check('Reason is visible',/Weekly goal unchanged/.test(await page.locator('#profileSaveStatus').innerText()),true);
  });
  await runCase('profile-failed-save','Storage failure is visible but cannot prevent the workout debrief or fabricate saved credit.',async(page,check)=>{
    await plan(page); await home(page); await profile(page); await page.locator('#profileEnabled').check(); await page.locator('#profileClose').click();
    await page.evaluate(()=>{__testLab.profileAccess().profileGoals.storage.setItem=()=>{throw Error('quota');};});
    await start(page); await finishObserved(page);
    check('Debrief survives quota failure',await page.locator('#againBtn').isVisible(),true);
    check('Failure explains unsaved data',/could not be saved/.test(await page.locator('#profileSaveStatus').innerText()),true);
    check('No fictitious saved credit',await page.evaluate(()=>__testLab.profileAccess().profileGoals.summary(Date.now()).days),0);
    await page.locator('#againBtn').click(); await profile(page); await page.locator('#profileEnabled').uncheck();
    check('Failed consent persistence still opts this window out',await page.locator('#profileEnabled').isChecked(),false);
    check('Reload caveat visible',/old setting may return/.test(await page.locator('#profileStatus').innerText()),true);
  });
}
