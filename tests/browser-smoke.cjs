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
  // Check actual post-dictionary sampling, not just the randomizer source.
  const glyphDistribution=await page.evaluate(()=>{
   let han=0,heavy=0,extreme=0,other=0;
   for(let i=0;i<850;i++){
    const ch=window.MojiRandom.roll();
    const n=getStrokeCount(ch);
    if(/\p{Script=Han}/u.test(ch)){han++;if(n>=16)heavy++;if(n>=45)extreme++;}
    else other++;
   }
   return {han,heavy,extreme,other};
  });
  if(glyphDistribution.han<280||glyphDistribution.heavy<170||glyphDistribution.extreme<20||glyphDistribution.other<250)
   throw Error('High-stroke glyph randomization or broad Unicode balance regression: '+JSON.stringify(glyphDistribution));

  if(await page.locator('#enterLobby').count())await page.locator('#enterLobby').click({timeout:9000});
  await page.waitForSelector('#loadoutPanel .ultimate-option',{timeout:15000});
  // Four clickable tiles are the only visible mode controls.
  const modes=page.locator('#modeTiles [data-mode-tile]');
  if(await modes.count()!==4)throw Error('Expected four mode icons only');
  if(!await page.locator('#legacyModeSelector').isHidden())throw Error('Duplicate mode dropdown is still visible');
  if(!await page.locator('#mapTheme').isVisible())throw Error('Map selector was hidden by mistake');
  for(const mode of ['normal','custom','multi','multiCustom']){
   await page.locator('[data-mode-tile="'+mode+'"]').click();
   const chosen=await page.locator('#modeSelect').inputValue();
   if(chosen!==mode)throw Error('Mode icon did not update legacy state: '+mode+' => '+chosen);
   if(await page.locator('[data-mode-tile][aria-pressed=true]').count()!==1)
    throw Error('Mode buttons have inconsistent pressed state: '+mode);
  }
  await page.locator('[data-mode-tile="normal"]').click();

  await page.waitForSelector('#lobbyScreen .kanji',{state:'attached',timeout:15000});
  const cpuGlyph=await page.evaluate(()=>{
    const field=document.querySelector('#lobbyScreen .kanji');
    const stat=field.closest('.slot').querySelector('.slot-stat');
    const digit=field.closest('.slot').querySelector('.strokes');
    field.value='𰻞';field.dispatchEvent(new Event('input',{bubbles:true}));
    const biang={n:Number(digit.value),details:stat.textContent};
    field.value='𰻝';field.dispatchEvent(new Event('input',{bubbles:true}));
    const simple={n:Number(digit.value),details:stat.textContent};
    return {biang,simple};
  });
  if(cpuGlyph.biang.n!==58||cpuGlyph.simple.n!==43||
    !cpuGlyph.biang.details.includes('58画')||!cpuGlyph.simple.details.includes('43画'))
    throw Error('CPU rare-kanji UI failure '+JSON.stringify(cpuGlyph));
  const cpuKana=await page.evaluate(()=>{
   const field=document.querySelector('#lobbyScreen .kanji'),digit=field.closest('.slot').querySelector('.strokes'),out={};
   for(const glyph of ['イ','ー','フ','ネ','く']){field.value=glyph;field.dispatchEvent(new Event('input',{bubbles:true}));out[glyph]=Number(digit.value)}
   return out;
  });
  if(JSON.stringify(cpuKana)!==JSON.stringify({'イ':2,'ー':1,'フ':1,'ネ':4,'く':1}))
   throw Error('CPU kana written stroke count mismatch '+JSON.stringify(cpuKana));
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
  if(!(await cpuHelp.innerText()).includes('閉じる'))throw Error('CPU expanded guide does not clearly say how to close');
  const cpuClose=cpuGuide.locator('.ultimate-guide-close'),cpuBottomClose=cpuGuide.locator('.ultimate-guide-bottom-close');
  if(!await cpuClose.isVisible()||!await cpuBottomClose.isVisible())throw Error('CPU close actions are not visible');
  if(await cpuClose.evaluate(el=>el.getBoundingClientRect().height)<42)throw Error('CPU top close touch target is too small');
  await cpuClose.click();
  if(!await cpuGuide.isHidden()||await cpuHelp.getAttribute('aria-expanded')!=='false')throw Error('CPU top close button failed');
  await cpuHelp.click();
  await cpuBottomClose.click();
  if(!await cpuGuide.isHidden()||await cpuHelp.getAttribute('aria-expanded')!=='false')throw Error('CPU bottom close button failed');
  await cpuHelp.click();

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
  const sharedBazooka=await page.evaluate(()=>{
   const choice=document.querySelector('#loadoutPanel .ultimate-option[data-ultimate=roman] svg')?.outerHTML;
   const guide=document.querySelector('#loadoutPanel .ultimate-guide-icon svg')?.outerHTML;
   const battle=document.querySelector('#gameScreen .ultimate-icon svg')?.outerHTML;
   return {choice,guide,battle};
  });
  if(!sharedBazooka.choice?.includes('rotate(-24 48 49)')||sharedBazooka.choice!==sharedBazooka.guide||sharedBazooka.choice!==sharedBazooka.battle)
   throw Error('Roman bazooka icon differs between selection, guide and CPU battle');
  if(!await page.locator('#loadoutPanel .ultimate-option[data-ultimate=slow] svg').count())throw Error('new slow-shot icon missing');
  if(!await page.locator('#loginScreen').count())throw Error('missing common login');
  const types=await page.evaluate(()=>window.MojiUlt.defs.map(d=>[d.id,d.cost]));
  if(JSON.stringify(types)!==JSON.stringify([['roman',320],['slow',280],['invincible',300],['dance',300],['invisible',260],['namepu',180]]))throw Error('shared specs mismatch');
  console.log('SOLO_LOBBY_INPUTS',JSON.stringify(await page.locator('#lobbyScreen input').evaluateAll(es=>es.map(e=>({id:e.id,placeholder:e.placeholder,type:e.type,className:e.className}))).catch(()=>[])));
  console.log('SOLO_LOBBY_BUTTONS',JSON.stringify(await page.locator('#lobbyScreen button').evaluateAll(es=>es.map(e=>({id:e.id,text:e.textContent?.trim().slice(0,24)})).filter(x=>x.id||/ランダム|開始/.test(x.text)).slice(0,35))));
  await page.locator('#loadoutPanel .ultimate-option[data-ultimate=namepu]').click({force:true});
  const chosen=await page.evaluate(()=>localStorage.getItem('moji_ultimate_choice'));
  if(chosen!=='namepu')throw Error('CPU skill picker not persisted');
  for(const mode of ['normal','custom']){
   await page.locator('[data-mode-tile="'+mode+'"]').click();
   await page.locator('#cpuBotCount').selectOption('3');
   await page.locator('#shuffleLoadout').click();
   await page.locator('#start').click();
   await page.waitForSelector('#gameScreen.active .weapon',{timeout:12000});
   await page.waitForFunction(()=>document.querySelector('#gameScreen .ultimate-left')?.textContent.includes('残り'),{timeout:10000});
   if(await page.locator('#gameScreen.active .weapon').count()!==5)throw Error(mode+' CPU battle does not have five weapon slots');
   await page.waitForFunction(()=>window.MojiCpuBots?.getBots().length===3,{timeout:12000});
   const botStats=await page.evaluate(()=>({
    number:window.MojiCpuBots.getBots().length,
    loadouts:window.MojiCpuBots.getBots().map(b=>b.loadout.map(s=>s.kind)),
    hasSelector:document.getElementById('cpuBotCount')?.value,
    alive:window.MojiCpuBots.getBots().filter(b=>b.hp>0).length
   }));
   if(botStats.number!==3||botStats.hasSelector!=='3'||botStats.alive!==3||
      !botStats.loadouts.every(row=>['attack','defense','heal','pierce','homing'].every(k=>row.includes(k))))
     throw Error(mode+' bot loadout/count mismatch '+JSON.stringify(botStats));
   // Spawn a genuine CPU projectile directly atop another CPU to exercise
   // the new non-player collision and damage pipeline.
   const crossfire=await page.evaluate(()=>{
    const bots=window.MojiCpuBots.getBots(),a=bots[0],b=bots[1];
    b.hp=500;bullets.push({x:b.x,y:b.y,vx:0,vy:0,n:6,owner:'e',sourceId:a.id,life:2,ch:'火',pierce:true,homing:false});
    return {target:b.id,before:b.hp};
   });
   await page.waitForFunction(()=>window.MojiCpuBots.getBots()[1]?.hp<500,{timeout:12000});
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

  // Real parent-page regression: the online iframe must cover the FULL CPU battle viewport,
  // not retain the lobby's small embedded frame. Test portrait AND landscape.
  await page.evaluate(()=>{
   const iframe=document.createElement('iframe');
   iframe.id='fullscreenParityCheck';iframe.src='/multiplayer.html?embedded=1';
   iframe.style.cssText='width:270px;height:200px;border:2px solid red';
   document.body.appendChild(iframe);
  });
  await page.waitForFunction(()=>document.getElementById('fullscreenParityCheck')?.contentDocument?.readyState==='complete',{timeout:15000});
  const embedded=page.frames().find(f=>f.url().includes('/multiplayer.html?embedded=1'));
  if(!embedded)throw Error('embedded multiplayer test frame did not load');
  await embedded.evaluate(()=>parent.postMessage({type:'moji:embeddedBattle',active:true},location.origin));
  await page.waitForFunction(()=>Math.abs(document.getElementById('fullscreenParityCheck').getBoundingClientRect().width-innerWidth)<4,{timeout:9000});
  await page.setViewportSize({width:844,height:390});
  await page.waitForFunction(()=>Math.abs(document.getElementById('fullscreenParityCheck').getBoundingClientRect().height-innerHeight)<4,{timeout:9000});
  const full=await page.evaluate(()=>{
   const r=document.getElementById('fullscreenParityCheck').getBoundingClientRect();
   return {width:r.width,height:r.height,viewportW:innerWidth,viewportH:innerHeight};
  });
  if(Math.abs(full.width-full.viewportW)>4||Math.abs(full.height-full.viewportH)>4)
   throw Error('embedded PvP cannot fill phone landscape '+JSON.stringify(full));
  await embedded.evaluate(()=>parent.postMessage({type:'moji:embeddedBattle',active:false},location.origin));
  await page.waitForFunction(()=>document.getElementById('fullscreenParityCheck').getBoundingClientRect().width<400,{timeout:9000});
  await page.evaluate(()=>document.getElementById('fullscreenParityCheck').remove());
  await page.setViewportSize({width:390,height:844});
  console.log('Shared lobby iframe fullscreen bridge verified on mobile portrait and landscape.');


  // Stress maximum CPU count and finish a free-for-all only after EVERY CPU is defeated.
  await page.locator('[data-mode-tile="normal"]').click();
  await page.locator('#cpuBotCount').selectOption('9');
  await page.locator('#start').click();
  await page.waitForFunction(()=>window.MojiCpuBots?.getBots().length===9,{timeout:12000});
  const maxParty=await page.evaluate(()=>window.MojiCpuBots.getBots().map(b=>({id:b.id,position:[b.x,b.y],kinds:b.loadout.map(s=>s.kind)})));
  if(maxParty.length!==9||new Set(maxParty.map(b=>b.id)).size!==9||
     !maxParty.every(b=>b.position.every(Number.isFinite)))
   throw Error('Maximum CPU free-for-all invalid '+JSON.stringify(maxParty));
  const firstKill=await page.evaluate(()=>{
   const units=window.MojiCpuBots.getBots();
   damage(units[0],100000,performance.now(),true,{owner:'p'});
   return {otherAlive:units.filter(x=>x.hp>0).length,running};
  });
  if(!firstKill.running||firstKill.otherAlive!==8)throw Error('Killing one CPU ended multiplayer solo prematurely: '+JSON.stringify(firstKill));
  const finalKill=await page.evaluate(()=>{
   for(const unit of window.MojiCpuBots.getBots())if(unit.hp>0)damage(unit,100000,performance.now(),true,{owner:'p'});
   return {running,result:document.getElementById('result').classList.contains('show')};
  });
  if(finalKill.running||!finalKill.result)throw Error('CPU free-for-all victory did not finish after last bot: '+JSON.stringify(finalKill));
  await page.evaluate(()=>document.getElementById('retreat').click());
  await page.waitForSelector('#lobbyScreen:not(.hidden)',{timeout:10000});

  console.log('CPU actual battle smoke passed for normal and custom modes.');
  if(errors.length)throw Error('CPU page JS error: '+errors.join('; '));
  errors.length=0;
  const multiplayer=await page.goto(base+'/multiplayer.html?embedded=1',{waitUntil:'domcontentloaded',timeout:45000});
  if(!multiplayer.ok())throw Error('PvP HTTP '+multiplayer.status());
  await page.waitForFunction(()=>!!window.MojiUltMulti,{timeout:15000});
  await page.waitForSelector('#joinArea .ultimate-option',{timeout:15000});
  if(!await page.locator('#onlineGlyph0').count()){
    console.log('ONLINE_SETUP_DIAG',JSON.stringify(await page.evaluate(()=>({
      url:location.href,embedded:document.body.className,editor:document.getElementById('onlineSlots')?.innerHTML.slice(0,300),
      scripts:document.scripts.length,heading:document.querySelector('#joinArea h2')?.textContent
    }))));
    throw Error('Online glyph editor unavailable. Browser errors: '+JSON.stringify(errors));
  }
  for(const [glyph,expected] of [['イ',2],['ー',1],['フ',1],['ネ',4],['ヴ',5]]){
   await page.locator('#onlineGlyph0').fill(glyph);
   const got=Number(await page.locator('#onlineGlyph0').locator('xpath=..').locator('.slot-strokes').inputValue());
   if(got!==expected)throw Error('online kana stroke mismatch '+glyph+': '+got+' expected '+expected);
  }
  await page.locator('#onlineGlyph0').fill('𰻞');
  await page.waitForFunction(()=>{
    const row=document.querySelector('#onlineGlyph0')?.closest('.online-slot');
    return row?.querySelector('.slot-strokes')?.value==='58';
  },{timeout:20000});
  const matchUI=await page.evaluate(()=>({
    match:document.querySelector('#match')?.textContent,
    privateCode:!!document.querySelector('.online-private-choice #roomCode'),
    rare:Number(document.querySelector('#onlineGlyph0')?.closest('.online-slot').querySelector('.slot-strokes')?.value),
    hidden:getComputedStyle(document.querySelector('.online-private-choice #roomCode')).display==='none'
  }));
  if(!matchUI.match?.includes('ランダムマッチ')||!matchUI.privateCode||matchUI.rare!==58)
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
  if(!(await onlineHelp.innerText()).includes('閉じる'))throw Error('Online expanded guide must clearly signal close action');
  const onlineClose=onlineGuide.locator('.ultimate-guide-close'),onlineBottomClose=onlineGuide.locator('.ultimate-guide-bottom-close');
  if(!await onlineClose.isVisible()||!await onlineBottomClose.isVisible())throw Error('Online guide close buttons missing');
  await onlineClose.click();
  if(!await onlineGuide.isHidden()||await onlineHelp.getAttribute('aria-expanded')!=='false')throw Error('Online top close button failed');
  await onlineHelp.click();
  await onlineBottomClose.click();
  if(!await onlineGuide.isHidden()||await onlineHelp.getAttribute('aria-expanded')!=='false')throw Error('Online bottom close button failed');
  await onlineHelp.click();

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
