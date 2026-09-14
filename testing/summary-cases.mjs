// Real debrief handlers in the existing shell runner. No model is simulated as
// production AI: the browser intentionally uses the deterministic summary.
import {readFile} from 'node:fs/promises';
import {exerciseInputs} from './exercise-inputs.mjs';
const inputs=exerciseInputs(JSON.parse(await readFile(new URL('../conformance-vectors.json',import.meta.url))).poses);
async function start(page,steps){
  await page.evaluate(steps=>__testLab.installPlan({id:'summary-case',name:'Summary case',tiers:['building'],steps}),steps);
  await page.locator('#skipBtn').click();await page.locator('[data-t="building"]').click();await page.locator('#goBtn').click();
  await page.locator('[data-plan="summary-case"]').click();await page.locator('#planStartBtn').click();
}
async function feed(page,seconds,id='plank',cycle=false){
  const frames=Array.from({length:seconds*30},(_,i)=>inputs.frame(id,cycle?inputs.cycle(i/30):0));
  await page.evaluate(frames=>{for(const frame of frames)__testLab.feed(frame,1/30);},frames);
}
export async function summaryCases(runCase){
  for(const width of [390,1280])await runCase(`summary-completed-${width}`,'Completed sets get bounded factual highlights, with no AI claim or persistent summary.',async(page,check,capture)=>{
    await page.setViewportSize({width,height:844});
    await start(page,[{ex:'plank',t:5},{ex:'glute-bridge',t:5}]);
    const storage=await page.evaluate(()=>JSON.stringify(localStorage));
    await feed(page,12);await feed(page,35,'glute-bridge',true);
    const p=await page.evaluate(()=>__testLab.snapshot().finish);
    check('Reached real session finish',!!p,true);check('Summary contract version',p.summary.schema,'workout-summary/1');
    check('Browser honestly reports template source',await page.locator('[data-summary-source]').getAttribute('data-summary-source'),'template');
    check('Two highlighted cards at most',await page.locator('.insights > [data-summary-card]').count()<=2,true);
    check('All original set rows retained',await page.locator('.prow').count(),2);
    for(const id of p.summary.defaultCardIds){
      const card=p.summary.cards.find(c=>c.id===id);
      check(`${id} resolves only engine text`,(await page.locator(`[data-summary-card="${id}"]`).innerText()).includes(card.text),true);
    }
    check('No invented improvement or diagnosis',/nothing to fix|real progress|make it harder|once you tired|setup problem/i.test(await page.locator('#msgInner').innerText()),false);
    await page.locator('.summaryNote summary').click();
    check('Measurement limits remain available',await page.locator('.summaryNote p').isVisible(),true);
    check('No invented previous-workout comparison',await page.locator('.summaryNote').innerText().then(x=>x.includes('No comparison with previous workouts')),true);
    check('No summary persistence',await page.evaluate(()=>JSON.stringify(localStorage)),storage);
    check('No horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.locator('#againBtn').scrollIntoViewIfNeeded();await capture('summary');
    await page.locator('#againBtn').click();check('Return to workout selection works',await page.locator('.plancard').count()>0,true);
  });
  await runCase('summary-skipped','Unobserved skipped work gets no generated assessment or zero score.',async(page,check,capture)=>{
    await start(page,[{ex:'plank',t:30}]);await page.locator('#skipExBtn').click();
    const p=await page.evaluate(()=>__testLab.snapshot().finish);
    check('Average remains null',p.avg,null);check('No assessment highlights',await page.locator('[data-summary-card]').count(),0);
    check('Skipped movement is named',await page.locator('.prow.skipped').innerText().then(x=>x.includes('Plank')),true);
    check('Honest skipping headline',/skipped everything/i.test(await page.locator('.headline').innerText()),true);
    check('No model invitation on browser',await page.getByRole('button',{name:/AI summary/i}).count(),0);
    await capture('skipped');
  });
  await runCase('summary-ended','Ending a later set retains completed highlights without judging the unfinished set.',async(page,check,capture)=>{
    await start(page,[{ex:'plank',t:5},{ex:'glute-bridge',t:30}]);await feed(page,12);await feed(page,8,'glute-bridge',true);
    await page.locator('#startBtn').click();await page.locator('#endSessionBtn').click();
    const p=await page.evaluate(()=>__testLab.snapshot().finish);
    check('Partial session is explicitly ended',await page.locator('#msg h2').innerText(),'Workout ended');
    check('Two started sets retained',p.out.length,2);check('Current set has no verdict',p.out[1].score,null);
    check('Highlights only describe completed set',p.summary.cards.every(c=>c.id.startsWith('set-1-')),true);
    check('Observed partial reps retained',p.reps>0,true);await capture('ended');
  });
  await runCase('summary-follow-along','Unassessed follow-along does not become personalised form praise.',async(page,check,capture)=>{
    await start(page,[{ex:'plank',t:30}]);await page.locator('#followAlongBtn').click();
    await page.evaluate(()=>{for(let i=0;i<300;i++)__testLab.feed(null,1/30);});
    await page.locator('#finishAlongBtn').click();
    const p=await page.evaluate(()=>__testLab.snapshot().finish);
    check('No unassessed highlights',p.summary.cards,[]);check('No held-time credit',p.bestHold,0);
    check('Mode is named',/not camera-assessed/.test(await page.locator('.headline').innerText()),true);
    check('No assessment card in DOM',await page.locator('[data-summary-card]').count(),0);await capture('follow-along');
  });
  await runCase('summary-guided','Guided movement time does not appear as an assessed best hold.',async(page,check,capture)=>{
    await start(page,[{ex:'cat-cow',t:5}]);await feed(page,15,'cat-cow');
    const p=await page.evaluate(()=>__testLab.snapshot().finish);
    check('Guided session completes',!!p,true);check('Historical engine time remains unchanged',p.bestHold>0,true);
    check('Guided time has no scored highlights',p.summary.cards,[]);
    check('Best assessed hold excludes guided time',await page.locator('.stats b').first().innerText(),'00:00');
    check('Guided row remains present',await page.locator('.prow').count(),1);await capture('guided');
  });
  await runCase('summary-mixed-holds','A shorter assessed hold, not a longer guided interval, determines the best-hold tile.',async(page,check,capture)=>{
    await start(page,[{ex:'plank',t:5},{ex:'cat-cow',t:15}]);await feed(page,12);await feed(page,25,'cat-cow');
    const p=await page.evaluate(()=>__testLab.snapshot().finish);
    check('Both kinds completed',p.out.map(o=>o.kind),['hold','guided']);
    check('The guided interval is longer',p.out[1].achieved>p.out[0].achieved,true);
    check('Assessed five seconds are displayed, not zero or guided time',await page.locator('.stats b').first().innerText(),'00:05');
    await capture('mixed-holds');
  });
  for(const action of ['skip','follow-along','end'])await runCase(`summary-watched-${action}`,'Observed hold seconds remain in the tile after a current-set interruption.',async(page,check,capture)=>{
    await start(page,[{ex:'plank',t:60}]);await feed(page,7);
    const held=await page.evaluate(()=>__testLab.snapshot().held);
    check('Several seconds were actually held',held>=5&&held<6,true);
    if(action==='skip')await page.locator('#skipExBtn').click();
    if(action==='follow-along'){
      await page.locator('#followAlongBtn').click();
      await page.evaluate(()=>{for(let i=0;i<300;i++)__testLab.feed(null,1/30);});
      await page.locator('#finishAlongBtn').click();
    }
    if(action==='end'){await page.locator('#startBtn').click();await page.locator('#endSessionBtn').click();}
    check('Tile retains the observed seconds, never unassessed elapsed time',await page.locator('.stats b').first().innerText(),'00:05');
    const p=await page.evaluate(()=>__testLab.snapshot().finish);
    check('Core observation is retained exactly',p.bestHold,held);check('No current-set form verdict',p.out[0].score,null);
    await capture('retained-work');
  });
}
