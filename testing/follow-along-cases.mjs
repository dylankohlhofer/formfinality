// Existing shell runner; actual buttons, selected build and saved screenshots.
export async function followAlongCases(runCase) {
  await runCase('follow-along-live-loop','Real animation/video path suspends pose inference only while the user selects unassessed mode.',async(page,check)=>{
    await page.evaluate(()=>{
      __testLab.installPlan({id:'lab-follow-loop',name:'Inference boundary',tiers:['building'],steps:[{ex:'plank',t:10},{ex:'push-up',t:10}]});
      __testLab.realCamera(); __testLab.mockModel();
      navigator.mediaDevices.getUserMedia = async()=>{
        const c=document.createElement('canvas'); c.width=640; c.height=360;
        const ctx=c.getContext('2d'), stream=c.captureStream(30);
        const timer=setInterval(()=>ctx.fillRect(0,0,c.width,c.height),1000/30);
        for(const track of stream.getTracks()) { const stop=track.stop.bind(track); track.stop=()=>{clearInterval(timer);stop();}; }
        return stream;
      };
    });
    await page.locator('#skipBtn').click(); await page.locator('[data-t="building"]').click(); await page.locator('#goBtn').click();
    await page.locator('[data-plan="lab-follow-loop"]').click();
    await page.waitForFunction(()=>window.__testModelCalls>2);
    await page.locator('#followAlongBtn').click();
    const calls=await page.evaluate(()=>window.__testModelCalls);
    await page.waitForTimeout(500);
    check('No inference calls while following',await page.evaluate(()=>window.__testModelCalls),calls);
    check('Still a camera preview, not a permission bypass',await page.locator('#cam').evaluate(v=>v.srcObject?.active),true);
    const before=await page.locator('#big').innerText();
    await page.waitForTimeout(1100);
    check('Real loop advances the unassessed timer',await page.locator('#big').innerText()!==before,true);
    await page.locator('#finishAlongBtn').click();
    await page.waitForFunction(n=>window.__testModelCalls>n+2,calls);
    check('Next movement is assessed setup',await page.evaluate(()=>__testLab.snapshot().state),'setup');
    await page.locator('#startBtn').click();
    check('Stop releases the preview',await page.locator('#cam').evaluate(v=>v.srcObject===null),true);
    check('Stop clears mode styling',await page.locator('body').evaluate(el=>el.classList.contains('following')),false);
  });
  for(const [name,viewport] of [['portrait',{width:390,height:844}],['landscape',{width:844,height:390}],['desktop',{width:1280,height:800}]])
    await runCase(`follow-along-${name}`, 'Unassessed mode remains readable and operable, with no camera credit or stale coaching.', async(page,check,capture)=>{
      await page.setViewportSize(viewport);
      await page.evaluate(()=>__testLab.installPlan({id:'lab-follow-ui',name:'Unassessed controls',tiers:['building'],steps:[{ex:'plank',t:10}]}));
      await page.locator('#skipBtn').click(); await page.locator('[data-t="building"]').click(); await page.locator('#goBtn').click();
      await page.locator('[data-plan="lab-follow-ui"]').click();
      await page.evaluate(()=>{for(let i=0;i<90;i++)__testLab.feed(null,1/30);});
      if(name !== 'desktop') {
        check('Phone tracking warning, counter and fallback choice do not overlap',await page.evaluate(()=>{
          const ids=['cue','dial','setupBar','tip'];
          const boxes=ids.map(id=>document.getElementById(id).getBoundingClientRect());
          return boxes.every((a,i)=>boxes.slice(i+1).every(b=>!(a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom)));
        }),true);
        await capture('tracking-before-fallback');
      }
      await page.locator('#followAlongBtn').click();
      await page.evaluate(()=>{for(let i=0;i<90;i++)__testLab.feed(null,1/30);});
      check('Explicit mode is active',await page.evaluate(()=>__testLab.snapshot().state),'follow-along');
      const geometry = await page.evaluate(()=>{
        const rect = id => { const r = document.getElementById(id).getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}; };
        const timer=rect('dial'), controls=rect('setupBar'), cue=rect('cue'), big=rect('big');
        const visible=r=>r.width>0&&r.height>0&&r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;
        const overlap=(a,b)=>a.x<b.right&&b.x<a.right&&a.y<b.bottom&&b.y<a.bottom;
        return {timerVisible:visible(timer)&&visible(big), overlaps:overlap(timer,controls)||overlap(cue,controls)||overlap(timer,cue), timer, controls, cue};
      });
      check('Timer and label have visible space',geometry.timerVisible,true);
      check('Timer, notice and controls do not overlap',geometry.overlaps,false);
      for(const id of ['showBtn','finishAlongBtn']) {
        check(`${id} is reachable`,await page.locator(`#${id}`).evaluate(el=>{
          const r=el.getBoundingClientRect(), hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
          return r.width>0&&r.height>=38&&r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&el.contains(hit);
        }),true);
      }
      await capture('unassessed-controls');
      await page.locator('#showBtn').click();
      check('Teaching demo is still available',await page.locator('#demo').isVisible(),true);
      await page.locator('#showBtn').click();
      await page.locator('#finishAlongBtn').click();
      const p=await page.evaluate(()=>__testLab.snapshot().finish);
      check('No invented hold',p.bestHold,0); check('No invented score',p.avg,null);
      check('Completion is not recorded as a skip',!!p.out[0].skipped,false);
      check('Named unassessed row',await page.locator('.prow .tag').textContent(),'follow along · unassessed');
      check('Mode styling cleared on finish',await page.locator('body').evaluate(el=>el.classList.contains('following')),false);
    });
}
