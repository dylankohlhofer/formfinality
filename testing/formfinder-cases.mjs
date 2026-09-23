// Product presentation checks run in the existing shell/watch/CI loop. No real
// identity provider, purchase, cloud store or physical camera is contacted.
import {reveal,openAccount} from './ui-navigation.mjs';
async function home(page){ await page.locator('#startBtn').click(); }
async function theme(page,value){
  await reveal(page,'#themeSelect'); await page.locator('#themeSelect').selectOption(value); await page.keyboard.press('Escape');
}
async function fits(page,selector){
  return page.locator(selector).evaluate(el=>el.scrollWidth<=el.clientWidth+1);
}
export async function formfinderCases(runCase){
  await runCase('formfinder-account','Paid personalisation is honestly unavailable; navigation never authenticates, purchases or opts into sharing.',async(page,check,capture)=>{
    check('Public browser title is renamed',await page.title(),'FormFinder — workouts with coaching');
    check('Public header is renamed',await page.locator('header h1').innerText().then(x=>x.startsWith('FormFinder')),true);
    check('Onboarding does not ask for an account or coach name',await page.locator('#nameIn,[data-p]').count(),0);
    await openAccount(page);
    check('Account has a heading',await page.locator('#msg h2').innerText(),'Account');
    check('Name has a real label but is not an editable local identity',await page.getByLabel('What should I call you?',{exact:true}).isDisabled(),true);
    check('All three styles are explicitly unavailable',await page.locator('[data-p]').evaluateAll(xs=>xs.length===3&&xs.every(x=>x.matches(':disabled'))),true);
    check('Sign-in and sharing are described as planned',await page.locator('#msgInner').innerText().then(x=>/Apple/.test(x)&&/Google/.test(x)&&/cloud progress and Duo/.test(x)&&/not connected/.test(x)),true);
    check('No fake OAuth or purchase links',await page.locator('#msg a').count(),0);
    check('No local data written by Account',await page.evaluate(()=>Object.keys(localStorage)),[]);
    await reveal(page,'#voicePrev'); check('Default coach preview remains available free',await page.locator('#voicePrev').isEnabled(),true);
    await capture('account'); await page.locator('#accountBackBtn').click();
    check('Setup remains available without an account',await page.locator('#calBtn').isVisible(),true);
  });
  for(const [id,viewport] of [['small',{width:320,height:640}],['phone',{width:390,height:844}],['landscape',{width:844,height:390}],['desktop',{width:1280,height:800}]]){
    await runCase(`formfinder-light-${id}`,'Light navigation, Account, goals and history fit; the camera preserves its dark feedback palette.',async(page,check,capture)=>{
      await page.setViewportSize(viewport); await theme(page,'light');
      check('Light theme applies',await page.locator('html').getAttribute('data-theme'),'light');
      check('Appearance is the only new storage',await page.evaluate(()=>Object.entries(localStorage)),[['formfinder.appearance.v1','light']]);
      const contrast = await page.evaluate(()=>{
        const s=getComputedStyle(document.body), rgb=key=>s.getPropertyValue(key).trim().slice(1).match(/../g).map(x=>parseInt(x,16)/255);
        const luminance=key=>rgb(key).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
        const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
        return ['--bone','--bone-2','--bone-3','--iris'].every(f=>['--void','--ground','--ground-2'].every(b=>ratio(f,b)>=4.5));
      });
      check('Light text palette meets 4.5:1 on all three surfaces',contrast,true);
      await capture('welcome-light'); await page.locator('#aboutBtn').click();
      check('About does not start a camera',await page.locator('#skipExBtn').isVisible(),false);
      check('No fake video player or external embed',await page.locator('#msg video,#msg iframe,#msg a').count(),0);
      check('About video clearly says coming later',await page.locator('.videoPlaceholder').innerText().then(x=>x.includes('coming later')),true);
      check('About has no horizontal overflow',await fits(page,'#msg'),true); await capture('about-light');
      await page.locator('#aboutWorkoutsBtn').click();
      await page.locator('#profileOpenBtn').click();
      check('Goals fit the viewport',await fits(page,'#profileDialog'),true);
      check('Opening goals never opts into saving',await page.locator('#profileEnabled').isChecked(),false);
      await capture('goals-light'); await page.locator('#profileClose').click();
      await page.locator('#coachMemoryBtn').click(); check('History fits the viewport',await fits(page,'#memoryDialog'),true);
      check('Technical preferences start collapsed',await page.locator('#memoryPreferences').evaluate(el=>!el.open),true);
      await capture('history-light'); await page.locator('#memoryClose').click();
      await page.locator('#coachSettingsBtn').click(); check('Account fits the viewport',await fits(page,'#msg'),true); await capture('account-light');
      await home(page); await page.locator('[data-plan="first-steps"]').click(); await page.locator('#planStartBtn').click();
      check('Live camera retains the dark surface',await page.locator('body').evaluate(el=>getComputedStyle(el).getPropertyValue('--void').trim()),'#0C0C10');
      check('Idle-only navigation is absent during a workout',await page.locator('#aboutBtn,#accountBtn,#themeSelect').evaluateAll(xs=>xs.every(x=>!x.checkVisibility())),true);
      check('Camera browser chrome stays dark',await page.locator('meta[name="theme-color"]').getAttribute('content'),'#0C0C10');
      await page.locator('#pauseBtn').click(); await capture('pause-dark'); await page.locator('#endSessionBtn').click();
      check('Debrief returns to chosen light appearance',await page.locator('body').evaluate(el=>getComputedStyle(el).getPropertyValue('--void').trim()),'#F7F5FA');
      check('Debrief browser chrome is light',await page.locator('meta[name="theme-color"]').getAttribute('content'),'#F7F5FA');
      await capture('debrief-light');
      await page.reload(); await page.waitForFunction(()=>!!window.__testLab);
      check('Theme survives reload without enabling profile consent',await page.evaluate(()=>[document.documentElement.dataset.theme,document.getElementById('profileEnabled').checked]),['light',false]);
    });
  }
  await runCase('formfinder-appearance-system','Device preference is followed only when selected; malformed settings and storage failures remain visible.',async(page,check)=>{
    await page.emulateMedia({colorScheme:'light'});
    check('Existing dark default does not change without a choice',await page.locator('html').getAttribute('data-theme'),'dark');
    await theme(page,'system'); check('Device light follows explicit choice',await page.locator('html').getAttribute('data-theme'),'light');
    await page.emulateMedia({colorScheme:'dark'}); await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
    check('Device changes are followed',await page.locator('html').getAttribute('data-theme'),'dark');
    await theme(page,'light'); await page.emulateMedia({colorScheme:'dark'});
    check('Explicit light overrides device dark',await page.locator('html').getAttribute('data-theme'),'light');
    await page.evaluate(()=>localStorage.setItem('formfinder.appearance.v1','unknown'));
    await page.reload(); await page.waitForFunction(()=>!!window.__testLab); await reveal(page,'#themeSelect');
    check('Invalid appearance does not overwrite stored value',await page.evaluate(()=>localStorage.getItem('formfinder.appearance.v1')),'unknown');
    check('Invalid appearance explains its fallback',/not recognised/.test(await page.locator('#appearanceStatus').innerText()),true);
    await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new Error('Synthetic unavailable storage');};});
    await page.locator('#themeSelect').selectOption('light');
    check('A failed save still applies the choice this visit',await page.locator('html').getAttribute('data-theme'),'light');
    check('Failed save is visible',/could not save/.test(await page.locator('#appearanceStatus').innerText()),true);
  });
  await runCase('formfinder-reduced-motion','Reduced motion disables page and dialog transitions without changing navigation.',async(page,check)=>{
    await page.emulateMedia({reducedMotion:'reduce'}); await page.waitForTimeout(200);
    await page.evaluate(()=>{window.formfinderAnimations=0;const animate=Element.prototype.animate;Element.prototype.animate=function(...args){window.formfinderAnimations++;return animate.apply(this,args);};});
    await page.locator('#aboutBtn').click(); await home(page); await page.locator('#coachMemoryBtn').click();
    check('No programmatic screen transition',await page.evaluate(()=>window.formfinderAnimations),0);
    check('No CSS dialog heading animation',await page.locator('#memoryTitle').evaluate(el=>getComputedStyle(el).animationName),'none');
    check('Dialog still works',await page.locator('#memoryClose').isVisible(),true);
  });
  await runCase('formfinder-appearance-unavailable','Failure to read appearance cannot block startup or imply another feature opted into storage.',async(page,check)=>{
    await page.addInitScript(()=>{
      const get=Storage.prototype.getItem;
      Storage.prototype.getItem=function(key){if(key==='formfinder.appearance.v1')throw Error('Synthetic read failure');return get.call(this,key);};
    });
    await page.reload(); await page.waitForFunction(()=>!!window.__testLab);
    check('Onboarding survives unavailable appearance storage',await page.locator('#calBtn').isVisible(),true);
    await reveal(page,'#themeSelect');
    check('Read failure is visible',/storage is unavailable/.test(await page.locator('#appearanceStatus').innerText()),true);
    check('No other feature was enabled',await page.evaluate(()=>Object.keys(localStorage)),[]);
  });
}
