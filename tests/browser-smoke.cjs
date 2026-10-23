const { chromium } = require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 const base=process.env.BASE_URL||'http://127.0.0.1:8083';
 try {
  const res=await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:45000});
  if(!res.ok())throw Error('login HTTP '+res.status());
  await page.waitForFunction(()=>!!window.MojiUlt,{timeout:15000});
  if(await page.locator('#enterLobby').count())await page.locator('#enterLobby').click({timeout:9000});
  await page.waitForSelector('#loadoutPanel .ultimate-option',{timeout:15000});
  if(await page.locator('#loadoutPanel .ultimate-option').count()!==6)throw Error('CPU/solo loadout must present six ultimates');
  if(!await page.locator('#loginScreen').count())throw Error('missing common login');
  const types=await page.evaluate(()=>window.MojiUlt.defs.map(d=>[d.id,d.cost]));
  if(JSON.stringify(types)!==JSON.stringify([['roman',360],['slow',320],['invincible',340],['dance',340],['invisible',300],['namepu',220]]))throw Error('shared specs mismatch');
  console.log('SOLO_LOBBY_INPUTS',JSON.stringify(await page.locator('#lobbyScreen input').evaluateAll(es=>es.map(e=>({id:e.id,placeholder:e.placeholder,type:e.type,className:e.className}))).catch(()=>[])));
  console.log('SOLO_LOBBY_BUTTONS',JSON.stringify(await page.locator('#lobbyScreen button').evaluateAll(es=>es.map(e=>({id:e.id,text:e.textContent?.trim().slice(0,24)})).filter(x=>x.id||/ランダム|開始/.test(x.text)).slice(0,35))));
  await page.locator('#loadoutPanel [data-ultimate=namepu]').click({force:true});
  const chosen=await page.evaluate(()=>localStorage.getItem('moji_ultimate_choice'));
  if(chosen!=='namepu')throw Error('CPU skill picker not persisted');
  for(const mode of ['normal','custom']){
   await page.locator('#modeSelect').selectOption(mode);
   await page.locator('#shuffleLoadout').click();
   await page.locator('#start').click();
   await page.waitForSelector('#gameScreen.active .weapon',{timeout:12000});
   await page.waitForFunction(()=>document.querySelector('#gameScreen .ultimate-left')?.textContent.includes('残り'),{timeout:10000});
   if(await page.locator('#gameScreen.active .weapon').count()!==5)throw Error(mode+' CPU battle does not have five weapon slots');
   if(!await page.locator('#gameScreen .ultimate-cast').isVisible())throw Error(mode+' CPU ultimate icon is not visible');
   if(errors.length)throw Error(mode+' CPU match JS errors: '+errors.join('; '));
   await page.locator('#retreat').click();
   await page.waitForSelector('#lobbyScreen:not(.hidden)',{timeout:10000});
  }
  console.log('CPU actual battle smoke passed for normal and custom modes.');
  if(errors.length)throw Error('CPU page JS error: '+errors.join('; '));
  errors.length=0;
  const multiplayer=await page.goto(base+'/multiplayer.html?embedded=1',{waitUntil:'domcontentloaded',timeout:45000});
  if(!multiplayer.ok())throw Error('PvP HTTP '+multiplayer.status());
  await page.waitForFunction(()=>!!window.MojiUltMulti,{timeout:15000});
  await page.waitForSelector('#joinArea .ultimate-option',{timeout:15000});
  if(await page.locator('#joinArea .ultimate-option').count()!==6)throw Error('online must present identical six ultimates');
  if(await page.evaluate(()=>window.MojiUltMulti.chosen())!=='namepu')throw Error('solo/online ultimate choice not shared');
  await page.locator('#joinArea [data-ultimate=roman]').click();
  if(await page.evaluate(()=>window.MojiUltMulti.chosen())!=='roman')throw Error('online picker failed');
  if(errors.length)throw Error('PvP page JS error: '+errors.join('; '));
  // Test both phone orientations without running a real match.
  await page.setViewportSize({width:844,height:390});
  await page.waitForTimeout(100);
  if(errors.length)throw Error('landscape JS error: '+errors.join('; '));
  console.log('Browser smoke passed: shared login, six CPU skills, six online skills, preference parity, portrait/landscape.');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
