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
  await page.waitForFunction(async()=>await window.MojiStrokeReady,{timeout:20000});
  const cpuGlyph=await page.evaluate(()=>({
    biang:getStrokeCount('𰻞'),biangSimple:getStrokeCount('𰻝'),
    dragon:getStrokeCount('龘'),
    attackCD:slotCooldownMs('attack',12),
    defenseCD:slotCooldownMs('defense',12),
    bgmVolumeMarker:document.documentElement.outerHTML.includes('bgmAudio.volume=.10')
  }));
  if(cpuGlyph.biang!==58||cpuGlyph.biangSimple!==43||cpuGlyph.dragon!==48||
    cpuGlyph.attackCD!==Math.round(1000*(.65+12*.125+2*.02)*1.2)||
    cpuGlyph.defenseCD!==Math.round(1000*(9+12*.4)*1.4))
    throw Error('CPU rare-kanji/cooldown integration failure: '+JSON.stringify(cpuGlyph));

  if(await page.locator('#enterLobby').count())await page.locator('#enterLobby').click({timeout:9000});
  await page.waitForSelector('#loadoutPanel .ultimate-option',{timeout:15000});
  if(await page.locator('#loadoutPanel .ultimate-option').count()!==6)throw Error('CPU/solo loadout must present six ultimates');
  // The ability picker must sit immediately after the five glyph inputs,
  // not below unrelated lobby settings and action buttons.
  const soloPosition=await page.evaluate(()=>{
   const editor=document.getElementById('setup'),picker=editor?.nextElementSibling;
   return Boolean(editor?.querySelectorAll('input.kanji').length===5 &&
    picker?.classList.contains('ultimate-widget') &&
    picker.querySelectorAll('.ultimate-option').length===6);
  });
  if(!soloPosition)throw Error('CPU ultimate picker must appear directly below five character slots');
  const cpuGuide=page.locator('#loadoutPanel .ultimate-guide');
  const cpuHelp=page.locator('#loadoutPanel .ultimate-guide-toggle');
  if(!await cpuGuide.isHidden())throw Error('CPU guide should default to collapsed');
  if(await cpuHelp.getAttribute('aria-expanded')!=='false')throw Error('CPU guide toggle starts expanded');
  await cpuHelp.click();
  if(!await cpuGuide.isVisible()||await cpuHelp.getAttribute('aria-expanded')!=='true')throw Error('CPU guide did not expand on request');
  if(!await cpuGuide.locator('.ultimate-guide-summary').innerText())throw Error('CPU ability guide has no effect summary');
  if(!await cpuGuide.locator('.ultimate-guide-usage').innerText())throw Error('CPU ability guide has no how-to-use instructions');
  if(!await cpuGuide.locator('.ultimate-guide-caution').innerText())throw Error('CPU ability guide has no limitations or weaknesses');
  await page.locator('#loadoutPanel .ultimate-option[data-ultimate=slow]').click();
  if(!((await cpuGuide.innerText()).includes('鈍化弾')&&(await cpuGuide.innerText()).includes('2段階操作')))throw Error('CPU skill explanation did not update after selecting slow');
  await page.locator('#loadoutPanel .ultimate-option[data-ultimate=namepu]').click();
  const cpuNamepuGuide=await cpuGuide.innerText();
  if(!cpuNamepuGuide.includes('真顔')||!cpuNamepuGuide.includes('5秒')||!cpuNamepuGuide.includes('超豪華'))throw Error('CPU namepu description omitted key game rules');
  if(await page.locator('#loadoutPanel .ultimate-option[aria-pressed=true]').count()!==1)throw Error('CPU selection must have exactly one pressed button');
  const guideFits=await cpuGuide.evaluate(el=>el.getBoundingClientRect().right<=innerWidth+2&&el.getBoundingClientRect().left>=-2);
  if(!guideFits)throw Error('CPU mobile guide overflows viewport');
  await cpuHelp.click();
  if(!await cpuGuide.isHidden()||await cpuHelp.getAttribute('aria-expanded')!=='false')throw Error('CPU guide cannot be closed');
  await page.locator('#loadoutPanel .ultimate-option[data-ultimate=roman]').click();
  if(!await cpuGuide.isHidden())throw Error('CPU choice should not reopen help');
  if(!await page.locator('#loadoutPanel .ultimate-option[data-ultimate=roman] svg').count())throw Error('new roman cannon icon missing');
  if(!await page.locator('#loadoutPanel .ultimate-option[data-ultimate=slow] svg').count())throw Error('new slow-shot icon missing');
  if(!await page.locator('#loginScreen').count())throw Error('missing common login');
  const types=await page.evaluate(()=>window.MojiUlt.defs.map(d=>[d.id,d.cost]));
  if(JSON.stringify(types)!==JSON.stringify([['roman',360],['slow',320],['invincible',340],['dance',340],['invisible',300],['namepu',220]]))throw Error('shared specs mismatch');
  console.log('SOLO_LOBBY_INPUTS',JSON.stringify(await page.locator('#lobbyScreen input').evaluateAll(es=>es.map(e=>({id:e.id,placeholder:e.placeholder,type:e.type,className:e.className}))).catch(()=>[])));
  console.log('SOLO_LOBBY_BUTTONS',JSON.stringify(await page.locator('#lobbyScreen button').evaluateAll(es=>es.map(e=>({id:e.id,text:e.textContent?.trim().slice(0,24)})).filter(x=>x.id||/ランダム|開始/.test(x.text)).slice(0,35))));
  await page.locator('#loadoutPanel .ultimate-option[data-ultimate=namepu]').click({force:true});
  const chosen=await page.evaluate(()=>localStorage.getItem('moji_ultimate_choice'));
  if(chosen!=='namepu')throw Error('CPU skill picker not persisted');
  for(const mode of ['normal','custom']){
   await page.locator('#modeSelect').selectOption(mode);
   await page.locator('#shuffleLoadout').click();
   await page.locator('#start').click();
   await page.waitForSelector('#gameScreen.active .weapon',{timeout:12000});
   await page.waitForFunction(()=>document.querySelector('#gameScreen .ultimate-left')?.textContent.includes('残り'),{timeout:10000});
   if(await page.locator('#gameScreen.active .weapon').count()!==5)throw Error(mode+' CPU battle does not have five weapon slots');
   await page.waitForFunction(()=>typeof obstacles!=='undefined' && obstacles.some(o=>o.__arenaLArm),{timeout:9000});
   const cover=await page.evaluate(()=>({
     width:WORLD_W,height:WORLD_H,
     corners:obstacles.filter(o=>o.__arenaLArm).length,
     player:{x:player.x,y:player.y},enemy:{x:enemy.x,y:enemy.y}
   }));
   if(cover.width!==2300||cover.height!==1300||cover.corners<1)
     throw Error(mode+' CPU arena/corner cover mismatch: '+JSON.stringify(cover));
   if(cover.player.x<0||cover.enemy.x>cover.width||cover.player.y<0||cover.enemy.y>cover.height)
     throw Error(mode+' CPU spawn outside arena');
   if(!await page.locator('#gameScreen .ultimate-cast').isVisible())throw Error(mode+' CPU ultimate icon is not visible');
   const castCheck=await page.evaluate(()=>{
    if(typeof slots==='undefined'||typeof act!=='function')return 'game functions unavailable';
    selected=0;slots[0].n=40;
    for(let i=0;i<6;i++){slots[0].ready=0;act(performance.now())}
    return 'ok';
   });
   if(castCheck!=='ok')throw Error(mode+' CPU charge simulation: '+castCheck);
   await page.waitForFunction(()=>document.querySelector('#gameScreen .ultimate-cast')?.classList.contains('ready'),{timeout:10000});
   await page.locator('#gameScreen .ultimate-cast').click();
   await page.waitForFunction(()=>document.querySelector('#gameScreen .ultimate-left')?.textContent==='使用済',{timeout:9000});
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
  await page.waitForFunction(()=>strokeForGlyph('𰻞')===58,{timeout:20000});
  const matchUI=await page.evaluate(()=>({
    match:document.querySelector('#match')?.textContent,
    privateCode:!!document.querySelector('.online-private-choice #roomCode'),
    cooldown:onlineCD('attack',12),
    rare:strokeForGlyph('𰻞')
  }));
  if(!matchUI.match?.includes('ランダムマッチ')||!matchUI.privateCode||
    matchUI.cooldown!==Math.round(1000*(.65+12*.125+2*.02)*1.2)||matchUI.rare!==58)
    throw Error('online matchmaking/rare-kanji UI mismatch '+JSON.stringify(matchUI));

  if(await page.locator('#joinArea .ultimate-option').count()!==6)throw Error('online must present identical six ultimates');
  const onlinePosition=await page.evaluate(()=>{
   const editor=document.querySelector('#joinArea .online-loadout'),picker=editor?.nextElementSibling;
   return Boolean(editor?.querySelectorAll('#onlineSlots input.online-glyph-input').length===5 &&
    picker?.classList.contains('ultimate-widget') &&
    picker.querySelectorAll('.ultimate-option').length===6);
  });
  if(!onlinePosition)throw Error('online ultimate picker must appear just below five-character selection section');
  if(await page.evaluate(()=>window.MojiUltMulti.chosen())!=='namepu')throw Error('solo/online ultimate choice not shared');
  const onlineGuide=page.locator('#joinArea .ultimate-guide');
  const onlineHelp=page.locator('#joinArea .ultimate-guide-toggle');
  if(!await onlineGuide.isHidden())throw Error('online guide must default to collapsed');
  await page.locator('#joinArea .ultimate-option[data-ultimate=invincible]').click();
  if(!await onlineGuide.isHidden())throw Error('selecting an ultimate must not open its explanation automatically');
  await onlineHelp.click();
  if(!await onlineGuide.isVisible()||await onlineHelp.getAttribute('aria-expanded')!=='true')throw Error('online help cannot be opened');
  await page.locator('#joinArea .ultimate-option[data-ultimate=invincible]').click();
  if(!((await onlineGuide.innerText()).includes('無敵')&&(await onlineGuide.innerText()).includes('エリア')))throw Error('online invincible explanation did not update');
  await page.locator('#joinArea .ultimate-option[data-ultimate=dance]').click();
  if(!((await onlineGuide.innerText()).includes("Let's DANCE")&&(await onlineGuide.innerText()).includes('全員')))throw Error('online dance description did not update');
  if(await page.locator('#joinArea .ultimate-option[aria-pressed=true]').count()!==1)throw Error('online must have only one selected ability');
  if(!await page.locator('#gameArea .ultimate-guide').isHidden())throw Error('online battle HUD must not display lobby-only guide');
  const onlineGuideFits=await onlineGuide.evaluate(el=>el.getBoundingClientRect().right<=innerWidth+2&&el.getBoundingClientRect().left>=-2);
  if(!onlineGuideFits)throw Error('online mobile guide overflows viewport');
  await onlineHelp.click();
  if(!await onlineGuide.isHidden()||await onlineHelp.getAttribute('aria-expanded')!=='false')throw Error('online guide cannot be collapsed');
  await page.locator('#joinArea .ultimate-option[data-ultimate=invisible]').click();
  if(!await onlineGuide.isHidden())throw Error('online selection must not force help open');
  
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
