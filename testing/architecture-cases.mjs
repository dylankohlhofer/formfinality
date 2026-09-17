// Performance invariants, not millisecond thresholds. Same real shell/evidence runner.
async function start(page){
  await page.locator('#skipBtn').click();await page.locator('[data-t="building"]').click();await page.locator('#goBtn').click();
  await page.locator('[data-plan="first-steps"]').click();await page.locator('#planStartBtn').click();
}
export async function architectureCases(runCase){
  await runCase('architecture-stable-hud','Repeated passive effects do not rebuild unchanged controls, numbers, tips or dial segments.',async(page,check)=>{
    await start(page);
    const result=await page.evaluate(()=>{
      const access=__testLab.renderAccess();
      const effects=[{t:'bigReps',n:2,tgt:8},{t:'scoreFill',pct:100},{t:'tip',html:'<b>Same teaching</b>'},{t:'telText',s:'Same observation'}];
      access.apply(effects);
      const observer=new MutationObserver(()=>{});
      for(const id of ['big','ring','scoreFill','tip','tel','workoutContext','pauseBtn','askCoachBtn','skipExBtn'])
        observer.observe(document.getElementById(id),{subtree:true,childList:true,attributes:true,characterData:true});
      for(let i=0;i<30;i++)access.apply(effects);
      const mutations=observer.takeRecords().length;observer.disconnect();
      return{mutations,number:document.getElementById('big').textContent,segments:document.querySelectorAll('#ring .seg-f').length};
    });
    check('Thirty identical updates produce no passive DOM mutations',result.mutations,0);
    check('Count remains visible',result.number,'2/8');check('Rep target keeps all segments',result.segments,8);
  });
  await runCase('architecture-ring-invalidation','Dial caches are invalidated by target changes and retain continuous hold progress.',async(page,check)=>{
    await start(page);
    const result=await page.evaluate(()=>{
      const a=__testLab.renderAccess(),el=document.getElementById('ring');a.ring(.25,8);
      const observer=new MutationObserver(()=>{});observer.observe(el,{subtree:true,attributes:true,childList:true});
      a.ring(.375,8);const changed=observer.takeRecords().length;
      a.ring(.375,4);const rebuilt=el.querySelectorAll('.seg-f').length;
      observer.disconnect();
      a.apply([{t:'bigLabel',s:'HOLD'},{t:'bigTime',secs:12.01}]);
      const before={label:document.getElementById('big').textContent,dash:el.querySelector('.seg-f').getAttribute('stroke-dasharray')};
      a.apply([{t:'bigTime',secs:12.03}]);
      return{changed,rebuilt,before,after:{label:document.getElementById('big').textContent,dash:el.querySelector('.seg-f').getAttribute('stroke-dasharray')}};
    });
    check('Only the advancing rep segment changes',result.changed,1);
    check('Changing target rebuilds its segments',result.rebuilt,4);
    check('Same displayed second stays stable',result.before.label,result.after.label);
    check('Sub-second hold progress still updates the arc',result.before.dash!==result.after.dash,true);
  });
  await runCase('architecture-telemetry-freshness','Telemetry deduplication never delays changed blockers or clocks and survives text/HTML transitions.',async(page,check)=>{
    await start(page);
    const result=await page.evaluate(()=>{
      const a=__testLab.renderAccess(),el=document.getElementById('tel');let time=1;
      a.clock.clock=()=>time;
      const r={readings:[],guided:false,blocking:['tracking']};a.telemetry(r,'setup');
      const observer=new MutationObserver(()=>{});observer.observe(el,{subtree:true,childList:true,characterData:true});
      for(let i=0;i<30;i++)a.telemetry(r,'setup');const repeated=observer.takeRecords().length;
      time=1.1;a.telemetry(r,'setup');const clockChanged=observer.takeRecords().length>0;
      r.blocking=['view'];a.telemetry(r,'setup');const blocker=el.textContent;
      const markup=el.innerHTML;a.apply([{t:'telText',s:el.textContent}]);a.telemetry(r,'setup');
      const restored=el.innerHTML===markup;observer.disconnect();
      a.apply([{t:'telText',s:el.textContent}]);
      const plainText=el.childNodes.length===1&&el.firstChild.nodeType===Node.TEXT_NODE;
      a.apply([{t:'telText',s:'<b>literal, not markup</b>'}]);
      const literal=el.querySelector('b')===null&&el.textContent==='<b>literal, not markup</b>';
      a.apply([{t:'tip',html:'<b>Same teaching</b>'}]);
      return{repeated,clockChanged,blocker,restored,plainText,literal};
    });
    check('Identical telemetry does not recreate its subtree',result.repeated,0);
    check('Changed clock updates immediately',result.clockChanged,true);
    check('Changed blocker updates immediately',result.blocker.includes('view')&&!result.blocker.includes('tracking'),true);
    check('A text-only state cannot poison cached markup',result.restored,true);
    check('Equal visible words still replace markup with a single text node',result.plainText,true);
    check('Text-only effects cannot inject HTML',result.literal,true);
  });
  await runCase('architecture-tip-restart','Returning home clears teaching and restarting restores the same markup.',async(page,check)=>{
    await start(page);
    await page.evaluate(()=>__testLab.renderAccess().apply([{t:'tip',html:'<b>Same teaching</b>'}]));
    await page.locator('#startBtn').click();await page.locator('#endSessionBtn').click();await page.locator('#againBtn').click();
    check('Home clears old teaching',await page.locator('#tip').textContent(),'');
    await page.locator('[data-plan="first-steps"]').click();await page.locator('#planStartBtn').click();
    await page.evaluate(()=>__testLab.renderAccess().apply([{t:'tip',html:'<b>Same teaching</b>'}]));
    check('Matching text in a new workout retains its markup',await page.locator('#tip b').textContent(),'Same teaching');
  });
}
