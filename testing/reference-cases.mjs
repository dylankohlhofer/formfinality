// Developer reference controls use synthetic joints/files; no camera or cloud.
const ref = () => ({space:'iso',fps:15,loop:true,recorded:true,frames:[
  {ear:[.17,.38],shoulder:[.25,.4],elbow:[.25,.6],wrist:[.4,.6],hip:[.5,.4],knee:[.7,.5],ankle:[.9,.6]}]});
const open = page => page.evaluate(()=>__testLab.referenceAccess().open());
async function importRefs(page,data){
  await page.locator('#refImport').setInputFiles({name:'refs.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
}
const ready = page => page.waitForFunction(()=>document.getElementById('refStatus')?.textContent.includes('References saved'));
export async function referenceCases(runCase){
  await runCase('references-invalid-import','Malformed imports are atomic; existing references still render after reload.',async(page,check)=>{
    await open(page); await importRefs(page,{plank:ref()}); await ready(page);
    const before = await page.evaluate(()=>localStorage.getItem('fc_refs'));
    await importRefs(page,{squat:ref(),plank:{space:'iso',fps:15,frames:[]}});
    await page.waitForFunction(()=>document.getElementById('refStatus')?.textContent.includes('Nothing imported'));
    check('Invalid mixed import leaves stored references intact',await page.evaluate(()=>localStorage.getItem('fc_refs')),before);
    check('No first-item partial import',await page.evaluate(()=>Object.keys(__testLab.referenceAccess().store.refs)),['plank']);
    await page.locator('#refImport').setInputFiles({name:'large.json',mimeType:'application/json',buffer:Buffer.alloc(1024*1024+1,32)});
    await page.waitForFunction(()=>document.getElementById('refStatus')?.textContent.includes('1 MiB'));
    check('Oversized file leaves prior data intact',await page.evaluate(()=>localStorage.getItem('fc_refs')),before);
    await page.reload(); await page.waitForFunction(()=>!!window.__testLab);
    await page.locator('[data-know="no"]').click(); await page.locator('#calBtn').click();
    await page.evaluate(()=>{__testLab.drawDemo();document.getElementById('ghostChk').checked=true;__testLab.drawGhost();});
    check('Valid imported demo still renders in calibration',(await page.locator('#demoLabel').innerText()).includes('PLANK'),true);
  });
  await runCase('references-corrupt-recovery','Corrupt saved references use built-in demos and can be reset without erasing other stores.',async(page,check)=>{
    const raw = JSON.stringify({plank:{space:'iso',fps:15,frames:[]}});
    await page.evaluate(raw=>{localStorage.setItem('fc_refs',raw);localStorage.setItem('reference-sentinel','keep');},raw);
    await page.reload(); await page.waitForFunction(()=>!!window.__testLab);
    check('Corrupt override never installs',await page.evaluate(()=>Object.keys(__testLab.referenceAccess().store.refs)),[]);
    await page.locator('[data-know="no"]').click(); await page.locator('#calBtn').click();
    await page.evaluate(()=>__testLab.drawDemo());
    check('Built-in demo remains usable',(await page.locator('#demoLabel').innerText()).includes('PLANK'),true);
    await page.locator('#skipExBtn').click(); await open(page);
    check('Recovery notice is visible',(await page.locator('#refStatus').innerText()).includes('could not be read'),true);
    page.once('dialog',dialog=>dialog.dismiss()); await page.locator('#refReset').click();
    check('Cancelling reset keeps original stored bytes',await page.evaluate(()=>localStorage.getItem('fc_refs')),raw);
    page.once('dialog',dialog=>dialog.accept()); await page.locator('#refReset').click();
    check('Reset removes only saved references',await page.evaluate(()=>[localStorage.getItem('fc_refs'),localStorage.getItem('reference-sentinel')]),[null,'keep']);
    await importRefs(page,{plank:ref()}); await ready(page);
    check('Saving works after explicit recovery',await page.evaluate(()=>Object.keys(__testLab.referenceAccess().store.refs)),['plank']);
  });
  await runCase('references-recording-save-failure','A failed recording save is visible, exportable and retryable without replacing the prior demo.',async(page,check,capture)=>{
    await page.setViewportSize({width:390,height:844}); await open(page);
    await importRefs(page,{plank:ref()}); await ready(page);
    const before = await page.evaluate(()=>localStorage.getItem('fc_refs'));
    await page.evaluate(()=>{
      window.referenceOriginalSetItem=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){if(key==='fc_refs')throw new DOMException('Test quota','QuotaExceededError');return window.referenceOriginalSetItem.call(this,key,value);};
    });
    await page.locator('[data-rec="plank"]').click();
    await page.evaluate(()=>{
      const a=__testLab.referenceAccess(); a.tick(null,5);
      a.tick({cam:'L',aspect:1,L:{shoulder:{x:.3,y:.4},hip:{x:.6,y:.4}}},6);
    });
    check('UI does not claim a failed save succeeded',await page.locator('#msgInner h2').innerText(),'Recording not saved');
    check('Old reference survives quota failure',await page.evaluate(()=>localStorage.getItem('fc_refs')),before);
    check('Camera-only controls close with the recorder',await page.locator('#skipExBtn').isVisible(),false);
    check('Finished recorder clears its old recording instruction',await page.locator('#tip').innerText(),'');
    await capture('recording-not-saved');
    const downloadEvent=page.waitForEvent('download'); await page.locator('#recExportUnsaved').click();
    const download=await downloadEvent, chunks=[];
    for await(const chunk of await download.createReadStream()) chunks.push(chunk);
    const exported=JSON.parse(Buffer.concat(chunks).toString());
    check('Export contains the unsaved captured joints',exported.plank.frames[0].hip,[.6,.4]);
    await page.locator('#recRetry').click(); await page.locator('#refRetry').click();
    check('Failed retry stays visible',(await page.locator('#refStatus').innerText()).includes('could not be saved'),true);
    await page.evaluate(()=>{Storage.prototype.setItem=window.referenceOriginalSetItem;});
    await page.locator('#refRetry').click(); await ready(page);
    check('Successful retry removes the unsaved controls',await page.locator('#refExportPending').isVisible(),false);
    await page.reload(); await page.waitForFunction(()=>!!window.__testLab);
    check('Retried recording actually persisted',await page.evaluate(()=>__testLab.referenceAccess().store.refs.plank.frames[0].hip),[.6,.4]);
  });
  await runCase('references-empty-recording','A recording with no detected joints cannot overwrite a working demonstration.',async(page,check)=>{
    await open(page); await importRefs(page,{plank:ref()}); await ready(page);
    const before=await page.evaluate(()=>localStorage.getItem('fc_refs'));
    await page.locator('[data-rec="plank"]').click();
    await page.evaluate(()=>{const a=__testLab.referenceAccess();a.tick(null,5);a.tick(null,6);});
    check('No-observation capture is not saved',await page.locator('#msgInner h2').innerText(),'Recording not saved');
    check('Previous demo remains',await page.evaluate(()=>localStorage.getItem('fc_refs')),before);
    check('No invalid empty reference export offered',await page.locator('#recExportUnsaved').isVisible(),false);
  });
  await runCase('references-import-races','Late file-read completions cannot save after navigation or overwrite a newer import.',async(page,check)=>{
    await open(page);
    await page.evaluate(()=>{
      window.referenceText=File.prototype.text; window.referenceReads=[];
      File.prototype.text=function(){return new Promise((resolve,reject)=>window.referenceReads.push({resolve,reject}));};
    });
    await importRefs(page,{plank:ref()}); await page.waitForFunction(()=>window.referenceReads.length===1);
    await page.locator('#recBack').click();
    await page.evaluate(data=>window.referenceReads[0].resolve(JSON.stringify(data)),{plank:ref()});
    check('Navigation prevents late persistence',await page.evaluate(()=>localStorage.getItem('fc_refs')),null);
    check('Late import does not reopen the recorder',await page.locator('#refImport').count(),0);
    await open(page); await importRefs(page,{plank:ref()}); await importRefs(page,{squat:ref()});
    await page.waitForFunction(()=>window.referenceReads.length===3);
    await page.evaluate(data=>window.referenceReads[2].resolve(JSON.stringify(data)),{squat:ref()}); await ready(page);
    await page.evaluate(()=>window.referenceReads[1].reject(new Error('Old read failed')));
    check('Older failure cannot erase newer success',(await page.locator('#refStatus').innerText()).includes('References saved'),true);
    check('Only the current import persists',await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('fc_refs')))),['squat']);
  });
}
