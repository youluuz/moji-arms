/* Desktop-only Chromium spectator audit. Unlike resizing a phone viewport,
   this uses a real non-touch desktop browser with the actual pointer/hover CSS.
   Also ensures mobile-specific joystick controls are not shown on a PC. */
const {chromium}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8083';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
 const ctx=await browser.newContext({viewport:{width:1280,height:800},isMobile:false,hasTouch:false});
 const page=await ctx.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>!!window.MojiUlt&&!!window.MojiCpuBots,{timeout:20000});
  await page.waitForFunction(async()=>await window.MojiStrokeReady,{timeout:20000});
  await page.locator('#playerName').fill('PC観戦テスター');
  await page.locator('#enterLobby').click();
  await page.waitForSelector('#modeTiles [data-mode-tile]',{timeout:15000});
  for(const mode of ['normal','custom']){
   await page.setViewportSize({width:1280,height:800});
   await page.locator('[data-mode-tile="'+mode+'"]').click();
   await page.locator('#cpuBotCount').selectOption('3');
   await page.locator('#shuffleLoadout').click();
   await page.locator('#start').click();
   await page.waitForSelector('#gameScreen.active .weapon',{timeout:12000});
   await page.waitForFunction(()=>document.getElementById('cpuBattleCountdown')?.hidden,{timeout:12000});
   await page.evaluate(()=>{player.hp=1;player.shield=0;player.shieldEnd=0;damage(player,120,performance.now(),true)});
   await page.waitForSelector('#cpuDeathChoice',{timeout:12000});
   await page.locator('#cpuChooseWatch').click();
   await page.waitForFunction(()=>document.body.classList.contains('cpu-spectating'),{timeout:10000});
   for(const [width,height] of [[1280,800],[1024,768],[900,600]]){
    await page.setViewportSize({width,height});
    const data=await page.evaluate(()=>{
     const watch=document.getElementById('cpuWatchControls');
     const map=document.querySelector('#gameScreen .arena-shell');
     const row=map?.closest('.moji-map-with-stick')||map;
     const w=watch.getBoundingClientRect(),f=map.getBoundingClientRect();
     const rb=getComputedStyle(row).display==='contents'?f:row.getBoundingClientRect();
     const buttons=[...watch.querySelectorAll('button')].map(b=>b.getBoundingClientRect());
     const overlap=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&
      Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2;
     return {
      desktop:!document.body.classList.contains('mobile-touch-input'),
      barPosition:getComputedStyle(watch).position,
      barAbove:w.bottom<=rb.top+2,
      barBefore:watch.nextElementSibling===row,
      buttons:buttons.length,
      buttonFits:buttons.every(b=>b.width>27&&b.height>26&&b.left>=w.left-2&&b.right<=w.right+2&&b.bottom<=w.bottom+2),
      buttonsDistinct:buttons.every((b,i)=>buttons.slice(i+1).every(c=>!overlap(b,c))),
      mapNotCovered:!overlap(w,f),
      mapHeight:f.height,
      width:innerWidth,overflow:document.documentElement.scrollWidth,
      labels:document.getElementById('cpuWatchTarget')?.textContent,
      weaponVisible:getComputedStyle(document.querySelector('#gameScreen .weaponrow')).display!=='none',
      bar:{top:w.top,bottom:w.bottom,left:w.left,right:w.right},map:{top:f.top,bottom:f.bottom}
     };
    });
    if(!data.desktop||['absolute','fixed'].includes(data.barPosition)||!data.barAbove||
       !data.barBefore||data.buttons!==3||!data.buttonFits||!data.buttonsDistinct||
       !data.mapNotCovered||data.mapHeight<70||data.overflow>data.width+3||
       !data.labels?.includes('観戦中'))
      throw Error(mode+' native PC spectator bar obstructs '+width+'x'+height+': '+JSON.stringify(data));
   }
   await page.locator('#cpuWatchNext').click();
   await page.locator('#cpuWatchPrev').click();
   await page.locator('#cpuWatchExit').click();
   await page.waitForSelector('#lobbyScreen:not(.hidden)',{timeout:10000});
  }
  if(errors.length)throw Error('desktop page script errors: '+errors.join('; '));
  console.log('REAL DESKTOP CPU SPECTATOR PASS: normal/custom, 1280x800, 1024x768, 900x600, targeting, return to lobby.');
 }finally{await ctx.close();await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
