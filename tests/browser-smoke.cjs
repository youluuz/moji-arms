const namepuHeadlines=["真顔のまま、天下統一！","踊る覇王、降臨！","ナメプ、伝説となる！","余裕こそ最強の武器！","舞い踊る絶対王者！","勝利すら、ただの余興。","踊ってなお、完全無双！","その余裕、王者の証！","弱体化さえ凌駕する！","王座まで、踊り抜け！","真顔で頂点を奪取！","世界が舞いにひれ伏した！","踊りし者、伝説を刻む！","その舞、まさに圧勝！"];
const { chromium } = require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 const base=process.env.BASE_URL||'http://127.0.0.1:8083';
 try {
  // Public discovery pages must work without a logged-in game session.
  const landing=await page.goto(base+'/about.html',{waitUntil:'domcontentloaded',timeout:45000});
  if(!landing.ok())throw Error('Public landing HTML '+landing.status());
  const landingState=await page.evaluate(()=>({
   title:document.title,
   button:document.querySelector('a.cta.primary')?.getAttribute('href'),
   share:!!document.querySelector('#share'),
   mobileWidth:document.documentElement.scrollWidth<=innerWidth+2
  }));
  if(!landingState.title.includes('文字武装')||landingState.button!=='/'||
     !landingState.share||!landingState.mobileWidth)
   throw Error('Public launch landing metadata, CTA or phone layout invalid '+JSON.stringify(landingState));
  const privacy=await page.goto(base+'/privacy.html',{waitUntil:'domcontentloaded',timeout:45000});
  if(!privacy.ok())throw Error('Public beta privacy notice '+privacy.status());
  const res=await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:45000});
  const marketing=await page.evaluate(()=>({
   description:document.querySelector('meta[name="description"]')?.content||'',
   og:document.querySelector('meta[property="og:title"]')?.content||'',
   info:document.querySelector('#mojiLaunchInfo')?.getAttribute('href')
  }));
  if(!marketing.description.includes('無料')||!marketing.og.includes('文字武装')||
     marketing.info!=='/about.html')throw Error('Game root is not linked to its public launch page '+JSON.stringify(marketing));
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

  // End-to-end: a person TYPES this into the actual shared login screen.
  await page.locator('#playerName').fill('蒼月の勇者');
  if(await page.locator('#enterLobby').count())await page.locator('#enterLobby').click({timeout:9000});
  const registeredNickname=await page.evaluate(()=>sessionStorage.getItem('moji_player_name'));
  if(registeredNickname!=='蒼月の勇者')
   throw Error('Shared login did not persist the entered nickname: '+registeredNickname);
  await page.waitForSelector('#loadoutPanel .ultimate-option',{timeout:15000});
  await page.waitForSelector('#mojiNoticeButton',{timeout:10000});
  const lobbyExtras=await page.evaluate(()=>({
   landscape:document.querySelector('.moji-mobile-landscape-tip')?.textContent,
   sticky:getComputedStyle(document.getElementById('mojiSortieDock')).position,
   startInDock:document.getElementById('start')?.closest('#mojiSortieDock')!==null
  }));
  if(!lobbyExtras.landscape?.includes('横画面推奨')||lobbyExtras.sticky!=='fixed'||!lobbyExtras.startInDock)
   throw Error('Lobby postbox or fixed deployment invalid '+JSON.stringify(lobbyExtras));
  // The online panel is gone; its original room-creation button survives
  // immediately to the left of the CPU start button in the persistent dock.
  const lobbyActions=await page.evaluate(()=>{
    const lobby=document.getElementById('lobbyScreen'),bar=document.getElementById('mojiSortieDock');
    const actions=bar?.querySelector('.moji-sortie-actions');
    const buttons=[...actions?.querySelectorAll('button')||[]];
    const create=buttons.find(b=>b.textContent.includes('ルームを作成'));
    const start=document.getElementById('start');
    const roomRect=create?.getBoundingClientRect(),startRect=start?.getBoundingClientRect();
    return {hasOldPanel:lobby?.textContent.includes('ロビーからオンライン対戦'),
      buttonCount:buttons.length,roomExists:!!create,
      order:!!(create&&start&&buttons.indexOf(create)<buttons.indexOf(start)),
      roomWidth:roomRect?.width,roomHeight:roomRect?.height,startWidth:startRect?.width,
      beside:!!(roomRect&&startRect&&roomRect.right<=startRect.left+2),
      fits:!!(roomRect&&startRect&&roomRect.left>=-1&&startRect.right<=innerWidth+2)};
  });
  if(lobbyActions.hasOldPanel||!lobbyActions.roomExists||!lobbyActions.order||
     !lobbyActions.beside||!lobbyActions.fits||lobbyActions.roomWidth<110||
     lobbyActions.roomHeight<40||lobbyActions.startWidth<110)
    throw Error('Room creation is not left of CPU start or obsolete online panel remains '+JSON.stringify(lobbyActions));
  // Real lobby regression: freshly blank weapon slots must NOT block
  // creating a room. Draft equipment is visibly editable in the room.
  const initialGlyphs=await page.locator('#setup .slot .kanji').evaluateAll(items=>items.map(x=>x.value));
  if(initialGlyphs.length!==5||initialGlyphs.some(Boolean))
   throw Error('Login equipment must begin blank '+JSON.stringify(initialGlyphs));
  await page.locator('#createRoomNow').click();
  const draftedGlyphs=await page.locator('#setup .slot .kanji').evaluateAll(items=>items.map(x=>x.value));
  if(draftedGlyphs.join('')!=='火水木金土')
   throw Error('One-click room draft did not fill five valid slots '+JSON.stringify(draftedGlyphs));
  if(errors.length)throw Error('One-click room triggered a JS error: '+errors.join('; '));
  await page.waitForFunction(()=>document.querySelector('#onlineScreen.active #onlineFrame')?.getAttribute('src')?.includes('auto=create'),{timeout:8000});
  await page.waitForFunction(()=>{
   const frame=document.getElementById('onlineFrame'),doc=frame?.contentDocument;
   if(!doc)return false;
   const wait=doc.getElementById('waitArea'),code=doc.getElementById('code')?.textContent?.trim()||'';
   // This UI is updated only after the server acknowledges a real room.
   return wait?.style.display==='block'&&/^[A-Z0-9]{6}$/.test(code);
  },null,{timeout:16000});
  const roomCreated=await page.evaluate(()=>{
   const d=document.getElementById('onlineFrame').contentDocument;
   return {roomCode:d.getElementById('code')?.textContent?.trim(),
    roster:d.getElementById('roster')?.textContent,
    invite:d.getElementById('inviteUrl')?.value,
    draftNotice:d.getElementById('roomEditStatus')?.textContent,
    roomTitle:d.getElementById('waitArea')?.querySelector('h2')?.textContent};
  });
  if(!/^[A-Z0-9]{6}$/.test(roomCreated.roomCode)||!roomCreated.roster?.length||
     !roomCreated.invite?.includes(roomCreated.roomCode)||!roomCreated.roomTitle?.includes('ルーム')||
     !roomCreated.draftNotice?.includes('仮装備'))
   throw Error('Dock create-room click failed to actually create a room '+JSON.stringify(roomCreated));
  await page.locator('#closeOnline').click();
  await page.waitForSelector('#lobbyScreen:not(.hidden)',{timeout:9000});
  await page.locator('#mojiNoticeButton').click();
  if(!await page.locator('#mojiNoticeOverlay').isVisible()||
     !(await page.locator('#mojiNoticeItems').innerText()).includes('3コイン')||
     !(await page.locator('#mojiNoticeItems').innerText()).includes('公開ベータテスト')||
     !(await page.locator('#mojiNoticeItems').innerText()).includes('図鑑ソート'))
   throw Error('Lobby announcements not displayed');
  const giftBefore=await page.evaluate(()=>Number(JSON.parse(localStorage.getItem('kanji_arms_duel_save_v4')||'{}').coins)||0);
  const giftButton=page.locator('.moji-welcome-claim');
  if(!await giftButton.isVisible()||await giftButton.isDisabled())throw Error('Welcome gift not claimable');
  await giftButton.click();
  const giftAfter=await page.evaluate(()=>{
   const a=JSON.parse(localStorage.getItem('kanji_arms_duel_save_v4')||'{}');
   return{coins:Number(a.coins)||0,claimed:!!a.firstPlayGiftClaimed,shown:document.getElementById('coinCounter')?.textContent,
    unread:document.getElementById('mojiUnread')?.hidden};
  });
  if(giftAfter.coins!==giftBefore+3||!giftAfter.claimed||giftAfter.shown!==String(giftAfter.coins)||
     !giftAfter.unread||!await giftButton.isDisabled())
   throw Error('Welcome gift must credit exactly three coins and clear unread state '+JSON.stringify({giftBefore,giftAfter}));
  await page.locator('#mojiNoticeClose').click();
  if(await page.locator('#mojiNoticeOverlay').isVisible())throw Error('Postbox announcements did not close');
  // Simulate passage of 31 days after viewing every announcement.
  await page.evaluate(()=>{
   const key='moji_notice_viewed_at_v1',v=JSON.parse(localStorage.getItem(key)||'{}');
   for(const id of Object.keys(v))v[id]=Date.now()-31*24*60*60*1000;
   localStorage.setItem(key,JSON.stringify(v));
  });
  await page.locator('#mojiNoticeButton').click();
  if(!(await page.locator('#mojiNoticeItems').innerText()).includes('現在表示するお知らせはありません')||
     !(await page.locator('#mojiUnread').evaluate(el=>el.hidden)))
   throw Error('Viewed notices must expire after 30 days');
  await page.locator('#mojiNoticeClose').click();

  // The user requested LESS SCROLLING, not a redesign: the same avatar
  // controls must remain usable while the preview/setup use less vertical space.
  const compactLobby=await page.evaluate(()=>{
   const rect=q=>{const e=document.querySelector(q);if(!e)return null;const b=e.getBoundingClientRect();return {top:b.top,bottom:b.bottom,height:b.height,width:b.width,left:b.left,right:b.right}};
   const preview=rect('#loadoutPanel .avatar-display');
   const avatar=rect('#loadoutPanel .avatar-zone');
   const input=rect('#avatarInput');
   const tiles=[...document.querySelectorAll('#modeTiles [data-mode-tile]')].map(x=>x.getBoundingClientRect());
   const button=document.querySelector('#avatarInput');
   return {preview,avatar,input,tiles:tiles.map(x=>({width:x.width,height:x.height})),
    stylesheet:[...document.styleSheets].some(x=>x.href?.includes('lobby-compact-v102.css')),
    inputAccessible:button&&!button.disabled&&getComputedStyle(button).visibility==='visible',
    inputBeside:input&&preview&&input.left>=preview.right-4,
    iconSize:(()=>{const canvas=document.querySelector('#loadoutPanel .avatar-display canvas');if(!canvas)return null;const box=canvas.getBoundingClientRect();return {width:box.width,height:box.height};})(),
    controlsPresent:!!document.getElementById('modeTiles')&&!!document.getElementById('battleSettings')};
  });
  if(!compactLobby.stylesheet||!compactLobby.inputAccessible||!compactLobby.inputBeside||
     !compactLobby.controlsPresent||!compactLobby.preview||!compactLobby.iconSize||
     compactLobby.iconSize.width<80||compactLobby.iconSize.height<80||
     compactLobby.preview.height<104||compactLobby.preview.height>115||
     compactLobby.avatar.height>130||
     compactLobby.input.height<40||compactLobby.input.width<66||
     compactLobby.tiles.length!==4||compactLobby.tiles.some(x=>x.height>86||x.width<65))
   throw Error('Icon character setup still takes excessive scrolling space or is clipped '+JSON.stringify(compactLobby));
  // A touch phone may choose its play orientation next to the four mode tiles.
  const orientationUI=page.locator('#mobileOrientationSetting');
  if(!await orientationUI.isVisible())throw Error('phone-only portrait/landscape switch is missing');
  if(await orientationUI.locator('[data-mobile-orientation]').count()!==2)throw Error('phone orientation switch must have two choices');
  await page.evaluate(()=>window.MojiMobileOrientation.select('landscape',false));
  if(await orientationUI.locator('[data-mobile-orientation=landscape]').getAttribute('aria-pressed')!=='true'||
     await page.evaluate(()=>localStorage.getItem('moji_mobile_play_orientation'))!=='landscape')
   throw Error('landscape mode selection did not persist');
  await page.evaluate(()=>window.MojiMobileOrientation.select('portrait',false));
  if(await orientationUI.locator('[data-mobile-orientation=portrait]').getAttribute('aria-pressed')!=='true')
   throw Error('portrait mode did not restore');
  // Four clickable tiles remain the only visible mode controls,
  // but the mode picker is visually isolated from the other settings.
  const modeLayout=await page.evaluate(()=>{
   const mode=document.getElementById('mojiModeChoiceCard');
   const details=document.getElementById('mojiMatchDetailsCard');
   const tiles=document.getElementById('modeTiles');
   const options=document.querySelector('#battleSettings .mode-quickrow');
   const orientation=document.getElementById('mobileOrientationSetting');
   const first=mode?.getBoundingClientRect(),second=details?.getBoundingClientRect();
   const buttons=[...tiles.querySelectorAll('[data-mode-tile]')].map(b=>{
    const r=b.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,right:r.right};
   });
   return {hasSeparateSurfaces:!!mode&&!!details&&mode!==details,
    pickerIsolated:mode?.contains(tiles) && !mode.contains(options),
    optionsGrouped:details?.contains(options) && details?.contains(orientation),
    heading:mode?.querySelector('.moji-mode-heading-copy strong')?.textContent,
    settingsHeading:details?.querySelector('.moji-mode-heading-copy strong')?.textContent,
    summary:document.getElementById('mojiSelectedModeInfo')?.textContent,
    gap:first&&second?second.top-first.bottom:null,
    modeBorder:mode?parseFloat(getComputedStyle(mode).borderTopWidth):0,
    settingsBorder:details?parseFloat(getComputedStyle(details).borderTopWidth):0,
    buttons,
    noOverflow:document.documentElement.scrollWidth<=innerWidth+2};
  });
  if(!modeLayout.hasSeparateSurfaces||!modeLayout.pickerIsolated||!modeLayout.optionsGrouped||
     !modeLayout.heading?.includes('対戦モード')||!modeLayout.settingsHeading?.includes('設定')||
     !modeLayout.summary?.includes('選択中')||modeLayout.gap<6||
     modeLayout.modeBorder<2||modeLayout.settingsBorder<1||
     modeLayout.buttons.length!==4||modeLayout.buttons.some(x=>x.width<70||x.height<65)||
     !modeLayout.noOverflow)
   throw Error('Mode selector still visually blends with options or clips on phone '+JSON.stringify(modeLayout));
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
   const selectedInfo=await page.locator('#mojiSelectedModeInfo').innerText();
   const labels={normal:'CPU 通常戦',custom:'CPU カスタム戦',multi:'オンライン通常戦',multiCustom:'オンラインカスタム戦'};
   if(!selectedInfo.includes(labels[mode]))throw Error('Chosen mode summary was not updated: '+mode+' '+selectedInfo);
  }
  await page.locator('[data-mode-tile="normal"]').click();
  // The narrower phone must still show two fully visible mode columns, even
  // inside the separated section and with all settings retained.
  await page.setViewportSize({width:360,height:740});
  const narrowMode=await page.evaluate(()=>{
   const tiles=[...document.querySelectorAll('#modeTiles [data-mode-tile]')].map(el=>el.getBoundingClientRect());
   const card=document.getElementById('mojiModeChoiceCard').getBoundingClientRect();
   const details=document.getElementById('mojiMatchDetailsCard').getBoundingClientRect();
   return {buttons:tiles.map(r=>({width:r.width,left:r.left,right:r.right,height:r.height})),
    card:{left:card.left,right:card.right},details:{left:details.left,right:details.right},
    width:innerWidth,scroll:document.documentElement.scrollWidth};
  });
  if(narrowMode.buttons.length!==4||narrowMode.buttons.some(x=>x.width<65||x.left<0||x.right>narrowMode.width+2)||
     narrowMode.card.left<0||narrowMode.card.right>narrowMode.width+2||
     narrowMode.details.left<0||narrowMode.details.right>narrowMode.width+2||
     narrowMode.scroll>narrowMode.width+2)
   throw Error('Narrow phone mode picker or detail area is clipped '+JSON.stringify(narrowMode));
  await page.setViewportSize({width:390,height:844});

  await page.waitForSelector('#lobbyScreen .kanji',{state:'attached',timeout:15000});
  // Contrast regression: inputs must visibly stand apart from the old dim
  // lobby, and the five cards must remain inside the phone viewport.
  const readableLoadout=await page.evaluate(()=>{
    const selector='#lobbyScreen #setup .slot';
    const cards=[...document.querySelectorAll(selector)];
    const entries=cards.map(card=>{
      const input=card.querySelector('.kanji');
      if(!input)return null;
      const s=getComputedStyle(input),cs=getComputedStyle(card);
      const b=input.getBoundingClientRect();
      return {bg:s.backgroundColor,text:s.color,border:s.borderTopColor,
       font:parseFloat(s.fontSize),height:b.height,width:b.width,
       cardBorder:cs.borderTopColor,visible:b.width>60&&b.left>=0&&b.right<=innerWidth+2};
    });
    return {count:cards.length,css:[...document.styleSheets].some(s=>s.href?.includes('loadout-contrast-v101.css')),
      input:entries,grid:getComputedStyle(document.getElementById('setup')).gridTemplateColumns};
  });
  if(!readableLoadout.css||readableLoadout.count!==5||
     readableLoadout.input.some(x=>!x||!x.visible||x.height<50||x.font<25||
       x.bg!=='rgb(9, 21, 37)'||x.border!=='rgb(193, 219, 244)'))
    throw Error('CPU high-contrast glyph cards not visible on phone '+JSON.stringify(readableLoadout));
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
  // Real mobile lobby: one-stroke attack is 0.8s; two strokes remain slower,
  // and the cooldown of a different weapon type is unchanged.
  const attackCooldown=await page.evaluate(()=>({
   one:window.MojiWeaponVisual?.cooldown('attack',1),
   two:window.MojiWeaponVisual?.cooldown('attack',2),
   ten:window.MojiWeaponVisual?.cooldown('attack',10),
   homing:window.MojiWeaponVisual?.cooldown('homing',1),
   max:window.MojiWeaponVisual?.cooldown('attack',84)
  }));
  if(attackCooldown.one!=='0.8秒'||attackCooldown.two!=='0.9秒'||
    attackCooldown.ten!=='1.7秒'||attackCooldown.homing!=='6.2秒'||attackCooldown.max!=='20.0秒')
   throw Error('Solo attack 0.8s and other-weapon CT regression '+JSON.stringify(attackCooldown));
  await page.waitForSelector('#loadoutPanel .ultimate-option',{timeout:15000});
  if(await page.locator('#loadoutPanel .ultimate-option').count()!==6)throw Error('CPU/solo loadout must present six ultimates');
  // Keep the ORIGINAL five-slot shuffle handler, but place it immediately
  // between the five glyphs and the ultimate picker.
  const soloPosition=await page.evaluate(()=>{
   const editor=document.getElementById('setup'),bar=editor?.nextElementSibling;
   const picker=bar?.nextElementSibling;
   return Boolean(editor?.querySelectorAll('input.kanji').length===5 &&
    bar?.id==='mojiBulkRandomBar'&&
    bar.querySelector('#shuffleLoadout')?.isConnected &&
    picker?.classList.contains('ultimate-widget') &&
    picker.querySelectorAll('.ultimate-option').length===6);
  });
  if(!soloPosition)throw Error('CPU all-random button must be directly above six ultimate choices');
  const cpuGuide=page.locator('#loadoutPanel .ultimate-guide');
  const cpuHelp=page.locator('#loadoutPanel .ultimate-guide-toggle');
  if(!await cpuGuide.isHidden())throw Error('CPU guide should default to collapsed');
  if(await cpuHelp.getAttribute('aria-expanded')!=='false')throw Error('CPU guide toggle starts expanded');
  const cpuArrow=cpuHelp.locator('.ultimate-guide-chevron');
  const cpuArrowBox=await cpuArrow.boundingBox();
  if(!(await cpuArrow.innerText()).includes('▼')||!(await cpuArrow.innerText()).includes('開く')||
     await cpuHelp.getAttribute('aria-label')!=='必殺技の使い方を開く'||!cpuArrowBox||
     cpuArrowBox.width<60||cpuArrowBox.height<44)
   throw Error('CPU skill guide open arrow must be a large labeled touch cue');
  await cpuHelp.click();
  if(!await cpuGuide.isVisible()||await cpuHelp.getAttribute('aria-expanded')!=='true')throw Error('CPU guide did not expand on request');
  if(!await cpuGuide.locator('.ultimate-guide-summary').innerText())throw Error('CPU ability guide has no effect summary');
  if(!await cpuGuide.locator('.ultimate-guide-usage').innerText())throw Error('CPU ability guide has no how-to-use instructions');
  if(!await cpuGuide.locator('.ultimate-guide-caution').innerText())throw Error('CPU ability guide has no limitations or weaknesses');
  if(!(await cpuHelp.innerText()).includes('閉じる'))throw Error('CPU expanded guide does not clearly say how to close');
  if(!(await cpuArrow.innerText()).includes('▲')||!(await cpuArrow.innerText()).includes('閉じる')||
     await cpuHelp.getAttribute('aria-label')!=='必殺技の使い方を閉じる')
   throw Error('CPU skill guide close arrow or label missing');
  await cpuHelp.click();
  if(!await cpuGuide.isHidden())throw Error('CPU skill guide arrow button did not collapse');
  await cpuHelp.click();
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
  if(!((await cpuGuide.innerText()).includes('硬化弾')&&(await cpuGuide.innerText()).includes('2段階操作')&&(await cpuGuide.innerText()).includes('3秒間')))
   throw Error('CPU hardening-shot guide must explain the 3-second immobilization');
  if(!(await cpuGuide.innerText()).includes('回復と防御は使用できる'))
   throw Error('CPU hardening-shot guide must clearly allow healing and shielding');
  for(const [id,phrase] of [['roman','即死'],['invincible','2.8秒'],['dance','1.2倍'],['invisible','4秒']]){
   await page.locator('#loadoutPanel .ultimate-option[data-ultimate="'+id+'"]').click();
   if(!(await cpuGuide.innerText()).includes(phrase))throw Error('CPU '+id+' guide lacks '+phrase);
  }
  await page.locator('#loadoutPanel .ultimate-option[data-ultimate=namepu]').click();
  const cpuNamepuGuide=await cpuGuide.innerText();
  if(!cpuNamepuGuide.includes('真顔')||!cpuNamepuGuide.includes('5秒')||!cpuNamepuGuide.includes('0.8倍')||!cpuNamepuGuide.includes('豪華'))throw Error('CPU namepu description omitted key game rules');
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
  if(!await page.locator('#loadoutPanel .ultimate-option[data-ultimate=slow] svg').count())throw Error('new hardening-shot icon missing');
  const hardeningArt=await page.evaluate(()=>({
   text:document.querySelector('#loadoutPanel [data-ultimate="slow"] .ultimate-option-title')?.textContent,
   svg:document.querySelector('#loadoutPanel [data-ultimate="slow"] svg')?.outerHTML
  }));
  if(hardeningArt.text!=='硬化弾'||!hardeningArt.svg?.includes('M23 13H45L43 53H30')||
     !hardeningArt.svg?.includes('x="62" y="59" width="28" height="25"'))
   throw Error('Hardening icon must show two feet and a visible ankle padlock: '+JSON.stringify(hardeningArt).slice(0,120));
  // Disco ball pixels and enlarged shot silhouettes must be truly drawn.
  const discoVisual=await page.evaluate(()=>{
   const renderer=window.MojiWeaponVisual,canvas=document.createElement('canvas');
   canvas.width=140;canvas.height=140;const c=canvas.getContext('2d');
   renderer.drawMirrorBall(c,70,65,1400);
   const discoPixels=c.getImageData(0,0,140,140).data;
   let discoVisible=0;for(let i=3;i<discoPixels.length;i+=4)if(discoPixels[i]>60)discoVisible++;
   c.clearRect(0,0,140,140);
   renderer.drawDanceAura(c,70,70,1400);
   const auraPixels=c.getImageData(0,0,140,140).data;
   let auraVisible=0;for(let i=3;i<auraPixels.length;i+=4)if(auraPixels[i]>60)auraVisible++;
   c.clearRect(0,0,140,140);
   renderer.drawProjectile(c,{x:70,y:70,ch:'火',homing:true,owner:'p'});
   const shotPixels=c.getImageData(0,0,140,140).data;
   let shotVisible=0;for(let i=3;i<shotPixels.length;i+=4)if(shotPixels[i]>60)shotVisible++;
   const label=document.querySelector('#gameScreen .ultimate-aiming-banner');
   const css=label&&getComputedStyle(label);
   return {discoVisible,auraVisible,shotVisible,scaledProjectile:renderer.drawProjectile.toString().includes('cx.scale(1.14,1.14)'),
    raisedLabel:[...document.styleSheets].some(sheet=>{
      try{return [...sheet.cssRules].some(rule=>rule.selectorText==='.ultimate-aiming-banner'&&rule.style.top==='9%')}catch(e){return false}
     })};
  });
  if(discoVisual.discoVisible<150||discoVisual.auraVisible<200||discoVisual.shotVisible<250||
     !discoVisual.scaledProjectile||!discoVisual.raisedLabel)
   throw Error('Avatar dance aura, disco-ball, 14%-larger projectiles or higher onscreen label missing '+JSON.stringify(discoVisual));
  // Roman ultimate VFX must paint real pixels in all 3 phases, while never
  // flashing a text-based KO/"撃破" label.
  const romanVisual=await page.evaluate(()=>{
   const fx=window.MojiRomanFX,canvas=document.createElement('canvas');
   canvas.width=360;canvas.height=310;
   const ctx=canvas.getContext('2d'),counts=[],labels=[],outlines=[];
   const original=ctx.fillText.bind(ctx),originalStroke=ctx.strokeText.bind(ctx);
   ctx.fillText=function(s,...args){labels.push(String(s));return original(s,...args)};
   ctx.strokeText=function(s,...args){outlines.push(String(s));return originalStroke(s,...args)};
   for(const paint of [
    ()=>fx.drawCharge(ctx,180,150,500,.7),
    ()=>fx.drawShot(ctx,180,150,-.3,520),
    ()=>fx.drawImpact(ctx,180,150,160),
    // Text must remain legible if a phone player shoots behind or vertically.
    ()=>fx.drawShot(ctx,180,150,Math.PI,520),
    ()=>fx.drawShot(ctx,180,150,Math.PI/2,520),
    ()=>fx.drawShot(ctx,180,150,-Math.PI/2,520)
   ]){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    paint();
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    let visible=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>55)visible++;
    counts.push(visible);
   }
   return {exists:!!fx,counts,labels,outlines};
  });
  if(romanVisual.counts.some(n=>n<300)||
    romanVisual.labels.filter(x=>x==='ロマン砲').length!==4||
    romanVisual.outlines.filter(x=>x==='ロマン砲').length!==4||
    romanVisual.labels.some(x=>x==='砲'||x.includes('撃破')||x==='K.O.'||x==='KO'))
   throw Error('Cannon must fire readable full ロマン砲 lettering, all directions, without KO text '+JSON.stringify(romanVisual));
  if(await page.evaluate(()=>window.MojiWeaponVisual.types.attack.color)!=='#dbff70')
   throw Error('Normal shot should be lime-gold, not avatar blue');
  const preview=await page.evaluate(()=>[...document.querySelectorAll('#abilityGuide .moji-preview')].map(el=>({kind:el.dataset.kind,mark:el.querySelector('.moji-preview-shot')?.textContent,stats:el.textContent})));
  if(preview.length!==5||preview[0].mark!=='●'||preview[3].mark!=='◆'||preview[4].mark!=='◎'||!preview.every(p=>p.stats.includes('CT')))
   throw Error('Solo integrated usage/effect guide missing weapon trajectory and stats '+JSON.stringify(preview));
  if(await page.locator('#mojiWeaponPreview').count()!==0 || await page.locator('#abilityGuide').evaluate(el=>el.open))
   throw Error('Solo attack preview must be inside the folded ability use/effect guide, not an independent panel');
  if(!await page.locator('#loginScreen').count())throw Error('missing common login');
  const types=await page.evaluate(()=>window.MojiUlt.defs.map(d=>[d.id,d.cost]));
  if(JSON.stringify(types)!==JSON.stringify([['roman',320],['slow',275],['invincible',280],['dance',280],['invisible',240],['namepu',160]]))throw Error('shared specs mismatch');
  console.log('SOLO_LOBBY_INPUTS',JSON.stringify(await page.locator('#lobbyScreen input').evaluateAll(es=>es.map(e=>({id:e.id,placeholder:e.placeholder,type:e.type,className:e.className}))).catch(()=>[])));
  console.log('SOLO_LOBBY_BUTTONS',JSON.stringify(await page.locator('#lobbyScreen button').evaluateAll(es=>es.map(e=>({id:e.id,text:e.textContent?.trim().slice(0,24)})).filter(x=>x.id||/ランダム|開始/.test(x.text)).slice(0,35))));
  await page.locator('#loadoutPanel .ultimate-option[data-ultimate=namepu]').click({force:true});
  const chosen=await page.evaluate(()=>localStorage.getItem('moji_ultimate_choice'));
  if(chosen!=='namepu')throw Error('CPU skill picker not persisted');
  // Use the real player invisibility ability in both CPU match variants.
  await page.locator('#loadoutPanel .ultimate-option[data-ultimate=invisible]').click();
  for(const mode of ['normal','custom']){
   await page.locator('[data-mode-tile="'+mode+'"]').click();
   await page.locator('#cpuBotCount').selectOption('3');
   await page.locator('#shuffleLoadout').click();
   await page.locator('#start').click();
   await page.waitForSelector('#gameScreen.active .weapon',{timeout:12000});
   await page.waitForFunction(()=>document.querySelector('#gameScreen .ultimate-left')?.textContent.includes('残り'),{timeout:10000});
   if(await page.locator('#gameScreen.active .weapon').count()!==5)throw Error(mode+' CPU battle does not have five weapon slots');
   await page.waitForFunction(()=>document.querySelectorAll('#gameScreen .moji-battle-metric').length===5,{timeout:9500});
   const soloMetrics=await page.locator('#gameScreen .moji-battle-metric').allInnerTexts();
   const expectedMetrics=await page.evaluate(()=>slots.map(s=>(window.MojiWeaponVisual.types[s.kind]?.marker||'')+' '+window.MojiWeaponVisual.metric(s.kind,s.n)));
   if(JSON.stringify(soloMetrics)!==JSON.stringify(expectedMetrics))
    throw Error(mode+' solo battle slot stats disagree with randomized actual equipment: '+JSON.stringify({soloMetrics,expectedMetrics}));
   await page.waitForFunction(()=>window.MojiCpuBots?.getBots().length===3,{timeout:12000});
   if(!await page.locator('#cpuBattleCountdown').isVisible())throw Error(mode+' CPU start countdown not visible on map');
   const beforeStart=await page.evaluate(()=>({
    seconds:window.MojiCpuBots.countdownLeft(), player:{x:player.x,y:player.y},
    enemy:{x:enemy.x,y:enemy.y}, enemyHp:document.getElementById('ehp')?.textContent,
    rivalHPVisible:!!document.getElementById('ehp')?.getBoundingClientRect().width,
    ownHPVisible:!!document.querySelector('#gameScreen .hud > :first-child')?.getBoundingClientRect().width,
    killScore:document.getElementById('cpuKillScore')?.textContent,
    scoreLocation:(()=>{
     const hud=document.querySelector('#gameScreen .hud').getBoundingClientRect();
     const score=document.getElementById('cpuBattleScoreboard').getBoundingClientRect();
     const hp=document.querySelector('#gameScreen .hud > :first-child').getBoundingClientRect();
     return {isRight:score.right<=hud.right+2&&score.left>hud.left+hud.width*.5,
       besideHp:score.left>=hp.right-5,visible:score.width>90&&score.height>20};
    })(),
    healMetric:window.MojiWeaponVisual.metric('heal',10)
   }));
   // Reserve a true sixth equipment cell. No ultimate/regular overlap.
   const mobileBattleUI=await page.evaluate(()=>{
    const weapons=document.getElementById('weapons');
    const regular=[...weapons.querySelectorAll('.weapon')];
    const ult=document.querySelector('#gameScreen .ultimate-cast');
    const rects=[...regular,ult].map(el=>el.getBoundingClientRect());
    const intersects=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&
      Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2;
    const zone=document.getElementById('cpuMoveZone')?.getBoundingClientRect();
    const cpuThumbEl=document.getElementById('cpuThumb');
    const cpuThumb=cpuThumbEl?.getBoundingClientRect();
    const cpuDot=document.getElementById('cpuThumbDot')?.getBoundingClientRect();
    const centerGap=(a,b)=>a&&b?Math.hypot((a.left+a.width/2)-(b.left+b.width/2),(a.top+a.height/2)-(b.top+b.height/2)):Infinity;
    const tip=document.querySelector('#gameScreen .moji-battle-howto');
    const battlefield=document.querySelector('#gameScreen .arena-shell');
    const tr=tip?.getBoundingClientRect(),fieldRect=battlefield?.getBoundingClientRect();
    const layout=battlefield.closest('.moji-map-with-stick')||battlefield;
    const guideOutside=!!tr&&!!fieldRect&&
     tip.parentElement===layout.parentElement&&tip.nextElementSibling===layout&&
     tr.bottom<=fieldRect.top+2&&getComputedStyle(tip).position!=='absolute';
    const outsideStick=!!zone&&document.getElementById('cpuMoveZone')?.closest('.moji-stick-dock')!==null&&
     (zone.right<=fieldRect.left+2||zone.top>=fieldRect.bottom-2);
    return {guideOutside,outsideStick,debug:{zone:zone&&{left:zone.left,right:zone.right,top:zone.top,bottom:zone.bottom},field:fieldRect&&{left:fieldRect.left,top:fieldRect.top,bottom:fieldRect.bottom},parent:document.getElementById('cpuMoveZone')?.parentElement?.className,body:document.body.className},cells:rects.length,sameRow:rects.every(r=>Math.abs(r.top-rects[0].top)<9),
      distinct:rects.every((r,i)=>rects.slice(i+1).every(other=>!intersects(r,other))),
      inside:rects.every(r=>r.width>28&&r.left>=-1&&r.right<=innerWidth+2),
      touchRing:zone&&Math.abs(zone.width-zone.height)<2,
      // Previously only #cpuMoveZone was docked; #cpuMovePad and the visible
      // thumb remained on the canvas, disconnected from the true hit target.
      padInsideZone:cpuThumbEl?.parentElement===document.getElementById('cpuMoveZone'),
      padDiagnostic:{thumb:!!cpuThumbEl,inline:cpuThumbEl?.getAttribute('style')||'',
       style:cpuThumbEl&&{position:getComputedStyle(cpuThumbEl).position,left:getComputedStyle(cpuThumbEl).left,
        right:getComputedStyle(cpuThumbEl).right,top:getComputedStyle(cpuThumbEl).top,bottom:getComputedStyle(cpuThumbEl).bottom,
        transform:getComputedStyle(cpuThumbEl).transform},
       thumb:cpuThumb&&{x:cpuThumb.x,y:cpuThumb.y,width:cpuThumb.width,height:cpuThumb.height},
       dot:cpuDot&&{x:cpuDot.x,y:cpuDot.y,width:cpuDot.width,height:cpuDot.height}},
      padCentered:centerGap(zone,cpuThumb)<2,thumbCentered:centerGap(zone,cpuDot)<2,
      padFits:!!cpuThumb&&!!zone&&cpuThumb.left>=zone.left-2&&cpuThumb.right<=zone.right+2&&
       cpuThumb.top>=zone.top-2&&cpuThumb.bottom<=zone.bottom+2,
      guide:tip?.textContent||'',touchSafe:tip&&getComputedStyle(tip).pointerEvents==='none'};
   });
   if(!mobileBattleUI.guideOutside||!mobileBattleUI.outsideStick||mobileBattleUI.cells!==6||!mobileBattleUI.sameRow||!mobileBattleUI.distinct||
      !mobileBattleUI.inside||!mobileBattleUI.touchRing||
      !mobileBattleUI.padInsideZone||!mobileBattleUI.padCentered||!mobileBattleUI.thumbCentered||!mobileBattleUI.padFits||
      !mobileBattleUI.guide.includes('タップ／クリック')||!mobileBattleUI.touchSafe)
    throw Error('CPU six-slot layout or circular mobile movement invalid '+JSON.stringify(mobileBattleUI));
  if(beforeStart.seconds<1||beforeStart.seconds>3.2||beforeStart.rivalHPVisible||!beforeStart.ownHPVisible||
      beforeStart.killScore!=='⚔ キル 0'||!beforeStart.scoreLocation.isRight||!beforeStart.scoreLocation.besideHp||
      !beforeStart.scoreLocation.visible||beforeStart.healMetric!=='回復34'||
      Math.hypot(beforeStart.player.x-beforeStart.enemy.x,beforeStart.player.y-beforeStart.enemy.y)<250)
    throw Error(mode+' self-only HP/spawn/countdown/kill UI failed '+JSON.stringify(beforeStart));
   await page.waitForFunction(()=>window.MojiCpuBots.countdownLeft()<=0 && document.getElementById('cpuBattleCountdown')?.hidden,{timeout:12000});

   // Send real Chromium touch pointer events to the MOVED joystick and
   // confirm the actual CPU avatar moves; merely drawing a ring is not enough.
   const preStick=await page.evaluate(()=>({x:player.x,y:player.y}));
   const stick=await page.locator('#cpuMoveZone').boundingBox();
   if(!stick||stick.width<60)throw Error('Joystick missing real thumb-sized touch target');
   const startX=stick.x+stick.width/2,startY=stick.y+stick.height/2;
   const cdp=await page.context().newCDPSession(page);
   try{
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:startX,y:startY,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:startX+26,y:startY,id:1}]});
    await page.waitForTimeout(290);
    // The pointer must move the VISIBLE cursor as well as the avatar. CSS
    // centering alone would conceal a nonfunctional draggable thumb.
    const cursorDrag=await page.evaluate(()=>{
     const ring=document.getElementById('cpuMoveZone').getBoundingClientRect();
     const outer=document.getElementById('cpuThumb').getBoundingClientRect();
     const inner=document.getElementById('cpuThumbDot').getBoundingClientRect();
     const center=r=>({x:r.left+r.width/2,y:r.top+r.height/2});
     const target=center(ring),out=center(outer),dot=center(inner);
     return {target,out,dot,outerStyle:document.getElementById('cpuThumb').getAttribute('style'),
      dotStyle:document.getElementById('cpuThumbDot').getAttribute('style'),
      vector:typeof touch!=='undefined'?touch:null,
      moved:out.x>target.x+4||dot.x>target.x+4,
      visible:dot.x>=ring.left&&dot.x<=ring.right&&dot.y>=ring.top&&dot.y<=ring.bottom};
    });
    if(!cursorDrag.moved||!cursorDrag.visible||cursorDrag.vector?.x<=0)
     throw Error(mode+' CPU cursor fails to follow real rightward drag '+JSON.stringify(cursorDrag));
   }finally{
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await cdp.detach();
   }
   const postStick=await page.evaluate(()=>({x:player.x,y:player.y}));
   if(Math.hypot(postStick.x-preStick.x,postStick.y-preStick.y)<3)
    throw Error(mode+' real outside-map CPU joystick could not move the fighter '+JSON.stringify({preStick,postStick,stick}));

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
   const hardenEffect=await page.evaluate(()=>{
    const b=window.MojiCpuBots.getBots()[1],now=performance.now();
    if(b.hp<=0)return {remaining:-1};
    b.hp=500;b.shield=900;b.shieldEnd=now+5000;
    damage(b,60,now,false,{owner:'p',ultimate:'slow'});
    return {remaining:b.hardenUntil-now,hp:b.hp,shield:b.shield};
   });
   if(hardenEffect.remaining<2950||hardenEffect.remaining>3050||hardenEffect.hp!==440||hardenEffect.shield!==900)
    throw Error(mode+' CPU hardening bullet should freeze 3s through a shield: '+JSON.stringify(hardenEffect));
   // While movement is locked, a bot should still use its heal and guard skills.
   await page.evaluate(()=>{
    const b=window.MojiCpuBots.getBots()[1];
    b.hp=180;b.nextDecision=0;
    for(const slot of b.loadout)slot.ready=['heal','defense'].includes(slot.kind)?0:performance.now()+5000;
   });
   await page.waitForFunction(()=>{
    const b=window.MojiCpuBots.getBots()[1];
    return b?.hp>180 && b?.hardenUntil>performance.now();
   },{timeout:2200});
   await page.evaluate(()=>{
    const b=window.MojiCpuBots.getBots()[1];
    b.hp=600;b.shield=0;b.nextDecision=0;
    for(const slot of b.loadout)slot.ready=slot.kind==='defense'?0:performance.now()+5000;
   });
   await page.waitForFunction(()=>{
    const b=window.MojiCpuBots.getBots()[1];
    return b?.shield>0 && b?.hardenUntil>performance.now();
   },{timeout:1700});
   const playerKill=await page.evaluate(()=>{
    const b=window.MojiCpuBots.getBots()[2],now=performance.now();
    b.hp=600;b.shield=900;b.shieldEnd=now+5000;
    damage(b,1,now,false,{owner:'p',ultimate:'roman'});
    return {kills:window.MojiCpuBots.kills(),hp:b.hp,score:document.querySelector('#cpuKillScore')?.textContent};
   });
   if(playerKill.kills!==1||playerKill.hp!==0)throw Error(mode+' CPU Roman Cannon must instantly defeat shielded enemies: '+JSON.stringify(playerKill));
   await page.waitForFunction(()=>document.querySelector('#cpuKillScore')?.textContent?.includes('1'),{timeout:10000});

   await page.waitForFunction(()=>typeof obstacles!=='undefined' && obstacles.some(o=>o.__arenaLArm),{timeout:9000});
   const cover=await page.evaluate(()=>({
     width:WORLD_W,height:WORLD_H,
     corners:obstacles.filter(o=>o.__arenaLArm).length,
     player:{x:player.x,y:player.y},enemy:{x:enemy.x,y:enemy.y}
   }));
   if(cover.width!==Math.round(2300*.975)||cover.height!==Math.round(1300*.975)||cover.corners<1)
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
   await page.waitForFunction(()=>document.querySelector('#gameScreen .ultimate-left')?.textContent==='使用済'&&window.MojiCpuUltimateState?.invisibleActive?.(),{timeout:9000});
   // Hit-test an actual player protected by their activated invisibility.
   const invisibleHoming=await page.evaluate(async()=>{
    const originalHP=player.hp;
    player.hp=600;bullets.length=0;
    const bot=window.MojiCpuBots.getBots()[0];
    const homing={x:player.x,y:player.y,vx:0,vy:0,n:14,owner:'e',sourceId:bot.id,life:2,
      ch:'追',homing:true,pierce:false};
    bullets.push(homing);
    await new Promise(resolve=>setTimeout(resolve,115));
    const afterHoming=player.hp;
    bullets.length=0;
    // A direct ordinary weapon hit must still deal damage. Using the actual
    // damage routine avoids a flaky spatial hit when AI movement advances
    // between two animation frames.
    const straight={x:player.x,y:player.y,vx:0,vy:0,n:9,owner:'e',sourceId:bot.id,life:2,
      ch:'火',homing:false,pierce:false};
    const savedShield=player.shield,savedShieldEnd=player.shieldEnd;
    player.shield=0;player.shieldEnd=0;
    damage(player,54,performance.now(),false,straight);
    const afterStraight=player.hp;
    bullets.length=0;player.hp=originalHP;player.shield=savedShield;player.shieldEnd=savedShieldEnd;
    return {afterHoming,afterStraight,active:window.MojiCpuUltimateState.invisibleActive()};
   });
   if(invisibleHoming.afterHoming!==600||
      !(invisibleHoming.afterStraight<invisibleHoming.afterHoming)||!invisibleHoming.active)
    throw Error(mode+' invisibility failed to break homing without granting normal-bullet immunity: '+JSON.stringify(invisibleHoming));
   if(errors.length)throw Error(mode+' CPU match JS errors: '+errors.join('; '));
   await page.locator('#retreat').click();
   await page.waitForSelector('#lobbyScreen:not(.hidden)',{timeout:10000});
  }

  // Restore persisted selection used by the downstream online lobby parity test.
  await page.locator('#loadoutPanel .ultimate-option[data-ultimate=namepu]').click();

  // Real parent-page regression: the online iframe must cover the FULL CPU battle viewport,
  // not retain the lobby's small embedded frame. Test portrait AND landscape.
  await page.evaluate(()=>{
   const iframe=document.createElement('iframe');
   iframe.id='fullscreenParityCheck';iframe.src='/multiplayer.html?embedded=1';
   iframe.style.cssText='width:270px;height:200px;border:2px solid red';
   document.body.appendChild(iframe);
  });
  await page.waitForFunction(()=>document.getElementById('fullscreenParityCheck')?.contentDocument?.readyState==='complete',{timeout:15000});
  // This test already opened and closed the REAL online iframe earlier.
  // Looking up a frame by URL could accidentally select that stale frame
  // instead of the fullscreenParityCheck element we just created.
  const parityFrameElement=await page.locator('#fullscreenParityCheck').elementHandle();
  const embedded=await parityFrameElement?.contentFrame();
  if(!embedded||!embedded.url().includes('/multiplayer.html?embedded=1'))
   throw Error('fullscreen parity iframe did not load');

  // The room/waiting UI uses the same navy-and-gold hierarchy as the lobby,
  // including a visible room code, prominent ready controls and invitation.
  const roomUI=await embedded.evaluate(()=>{
   const join=document.getElementById('joinArea'),wait=document.getElementById('waitArea');
   const stylesheet=[...document.styleSheets].some(x=>x.href?.includes('room-lobby-v104.css'));
   const joinColor=getComputedStyle(join).backgroundImage;
   const oldDisplay=wait.style.display;
   wait.style.display='block';
   const actions=wait.querySelector('.room-ready-actions');
   const roomCode=document.getElementById('code');
   const invite=document.getElementById('inviteUrl');
   const result={stylesheet,joinColor,
    heading:getComputedStyle(wait.querySelector('h2')).color,
    actionDisplay:getComputedStyle(actions).display,
    roomCodeBackground:getComputedStyle(roomCode).backgroundColor,
    inviteMinHeight:parseFloat(getComputedStyle(invite).minHeight),
    buttons:['begin','saveRoomLoadout','leave','copyInvite'].every(id=>!!document.getElementById(id)),
    hasFiveSlots:!!document.getElementById('onlineSlots')};
   wait.style.display=oldDisplay;
   return result;
  });
  if(!roomUI.stylesheet||roomUI.actionDisplay!=='flex'||
     !roomUI.joinColor.includes('gradient')||roomUI.inviteMinHeight<40||
     !roomUI.buttons||!roomUI.hasFiveSlots)
   throw Error('Multiplayer waiting room UI consistency regression '+JSON.stringify(roomUI));
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
  if(await page.evaluate(()=>window.MojiCpuBots.kills())!==0)throw Error('CPU kill count failed to reset on new round');
  const maxWorld=await page.evaluate(()=>window.MojiCpuBots.dimensions());
  if(maxWorld.w!==3450||maxWorld.h!==1950||maxWorld.scale!==1.5)
   throw Error('10-fighter CPU arena did not scale to 1.5x: '+JSON.stringify(maxWorld));
  const maxParty=await page.evaluate(()=>window.MojiCpuBots.getBots().map(b=>({id:b.id,position:[b.x,b.y],style:b.style,kinds:b.loadout.map(s=>s.kind)})));
  if(maxParty.length!==9||new Set(maxParty.map(b=>b.id)).size!==9||
     !maxParty.every(b=>b.position.every(Number.isFinite)))
   throw Error('Maximum CPU free-for-all invalid '+JSON.stringify(maxParty));
  const personalities=new Set(maxParty.map(b=>b.style));
  if(personalities.size!==5||!['rusher','skirmisher','sniper','survivor','ambusher'].every(x=>personalities.has(x)))
   throw Error('CPU roster lacked varied tactical personalities '+JSON.stringify(maxParty));
  const playerSpawn=await page.evaluate(()=>[player.x,player.y]);
  const fighters=[{position:playerSpawn},...maxParty];
  const gaps=fighters.flatMap((a,i)=>fighters.slice(i+1).map(b=>Math.hypot(a.position[0]-b.position[0],a.position[1]-b.position[1])));
  if(Math.min(...gaps)<320)throw Error('Players spawn too close together '+Math.min(...gaps));
  const firstKill=await page.evaluate(()=>{
   const units=window.MojiCpuBots.getBots();
   damage(units[0],100000,performance.now(),true,{owner:'p'});
   return {otherAlive:units.filter(x=>x.hp>0).length,running};
  });
  if(!firstKill.running||firstKill.otherAlive!==8)throw Error('Killing one CPU ended multiplayer solo prematurely: '+JSON.stringify(firstKill));
  const finalKill=await page.evaluate(()=>{
   for(const unit of window.MojiCpuBots.getBots())if(unit.hp>0)damage(unit,100000,performance.now(),true,{owner:'p'});
   return {running,result:document.getElementById('result').classList.contains('show'),
    winner:document.getElementById('resultTitle')?.textContent,
    alive:document.getElementById('cpuAliveCount')?.textContent,
    totalKills:document.getElementById('cpuResultKills')?.textContent,
    expectedKills:window.MojiCpuBots.kills()};
  });
  if(finalKill.running||!finalKill.result||!finalKill.winner?.includes('優勝：蒼月の勇者')||
     !finalKill.alive?.includes('生存 1 / 10人')||
     finalKill.expectedKills!==9||!finalKill.totalKills?.includes('合計キル数：9'))
   throw Error('CPU survivors or named winner incorrect after last bot: '+JSON.stringify(finalKill));
  await page.evaluate(()=>document.getElementById('retreat').click());
  await page.waitForSelector('#lobbyScreen:not(.hidden)',{timeout:10000});

  // Namepu is an honest gameplay cast, not a decorative preview.
  // Accrue the required 160 strokes via the actual successful-cast accounting,
  // activate it, win, and require the deluxe result in the SAME transition.
  await page.locator('#loadoutPanel .ultimate-option[data-ultimate=namepu]').click();
  await page.locator('[data-mode-tile="normal"]').click();
  await page.locator('#cpuBotCount').selectOption('1');
  await page.locator('#start').click();
  await page.waitForFunction(()=>window.MojiCpuBots?.getBots().length===1 &&
    window.MojiCpuBots?.countdownLeft?.()===0,{timeout:15000});
  const charged=await page.evaluate(()=>{
   for(let n=0;n<160;n++)recordCast();
   return {charge:document.querySelector('#weapons .ultimate-left')?.textContent,
    button:!!document.querySelector('#weapons .ultimate-cast'),
    running};
  });
  if(!charged.button||!charged.running)throw Error('CPU Namepu ultimate not ready for actual cast '+JSON.stringify(charged));
  // Let the live ultimate HUD acknowledge newly earned charge before clicking.
  // A forced click on a still-disabled button gets swallowed even though the
  // charge state is already 160 -- the browser test must mimic a real tap.
  await page.waitForFunction(()=>document.querySelector('#weapons .ultimate-cast')?.disabled===false,{timeout:7000});
  await page.locator('#weapons .ultimate-cast').click();
  await page.waitForTimeout(120);
  const namepuCast=await page.evaluate(()=>window.MojiCpuNamepuVictory?.debug());
  if(!await page.evaluate(()=>window.MojiCpuNamepuVictory?.used()))throw Error('Real Namepu cast not registered '+JSON.stringify(namepuCast));
  const namepuResult=await page.evaluate(()=>{
   const remaining=window.MojiCpuBots.getBots().filter(x=>x.hp>0);
   for(const cpu of remaining)damage(cpu,100000,performance.now(),true,{owner:'p'});
   const panel=document.getElementById('result');
   return {
    shown:panel.classList.contains('show'),
    special:panel.classList.contains('ultimate-namepu-victory'),
    title:document.getElementById('resultTitle')?.textContent,
    champion:panel.querySelector('.namepu-player-name')?.textContent,
    kills:panel.querySelector('.namepu-victory-stats')?.textContent,
    background:getComputedStyle(panel).backgroundImage,
    visible:getComputedStyle(panel).display!=='none',
    position:getComputedStyle(panel).position,
    bounds:(()=>{const r=panel.getBoundingClientRect();return {top:r.top,left:r.left,width:r.width,height:r.height};})(),
    alive:player.hp>0
   };
  });
  if(!namepuResult.shown||!namepuResult.special||!namepuResult.alive||
     !namepuHeadlines.some(x=>namepuResult.title?.includes(x))||namepuResult.champion!=='蒼月の勇者'||!namepuResult.kills?.includes('KILLS')||
     !namepuResult.background?.includes('radial-gradient')||!namepuResult.visible||
     namepuResult.position!=='fixed'||Math.abs(namepuResult.bounds.top)>2||
     Math.abs(namepuResult.bounds.left)>2||
     namepuResult.bounds.width<300||namepuResult.bounds.height<300)
   throw Error('Successful CPU Namepu cast did not reveal gold victory immediately '+JSON.stringify(namepuResult));
  await page.evaluate(()=>document.getElementById('retreat').click());
  await page.waitForSelector('#lobbyScreen:not(.hidden)',{timeout:10000});

  // Force a genuine post-KO decision in a CPU free-for-all and verify the
  // simulation can continue through the spectate path instead of freezing.
  await page.locator('[data-mode-tile="normal"]').click();
  await page.locator('#cpuBotCount').selectOption('3');
  await page.locator('#shuffleLoadout').click();
  await page.locator('#start').click();
  await page.waitForSelector('#gameScreen.active .weapon',{timeout:12000});
  // The old countdown node may still be hidden before startRound rebuilds the
  // new 3-bot match. Require the new roster AND a completed real countdown.
  await page.waitForFunction(()=>window.MojiCpuBots?.getBots().length===3&&
    window.MojiCpuBots?.countdownLeft?.()===0&&running,{timeout:15000});
  await page.evaluate(()=>{
   player.hp=1;player.shield=0;player.shieldEnd=0;
   damage(player,120,performance.now(),true);
  });
  await page.waitForSelector('#cpuDeathChoice',{timeout:10000});
  if(!await page.locator('#cpuChooseWatch').isVisible()||
     !await page.locator('#cpuChooseLobby').isVisible())
   throw Error('CPU elimination choice must offer spectate and lobby');
  await page.locator('#cpuChooseWatch').click();
  await page.waitForSelector('#cpuWatchControls',{timeout:10000});
  const cpuViewing=await page.evaluate(()=>({
   active:document.getElementById('gameScreen')?.classList.contains('active'),
   watching:document.body.classList.contains('cpu-spectating'),
   target:document.getElementById('cpuWatchTarget')?.textContent,
   spectators:document.getElementById('cpuSpectatorCount')?.textContent
  }));
  if(!cpuViewing.active||!cpuViewing.watching||
     !cpuViewing.target?.includes('観戦')||!cpuViewing.spectators?.includes('1'))
   throw Error('CPU match did not switch to live spectator view '+JSON.stringify(cpuViewing));
  // Spectator navigation must reserve its own layout row (not be an
  // absolutely positioned layer over the match), even after rotation and
  // on a wide PC-sized display. All four actions must remain reachable.
  for(const [width,height] of [[390,844],[667,375],[1280,800]]){
   await page.setViewportSize({width,height});
   const geometry=await page.evaluate(()=>{
    const bar=document.getElementById('cpuWatchControls');
    const field=document.querySelector('#gameScreen .arena-shell');
    const barBox=bar?.getBoundingClientRect(),fieldBox=field?.getBoundingClientRect();
    const actions=[...bar.querySelectorAll('button')].map(b=>b.getBoundingClientRect());
    const overlaps=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&
     Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2;
    const wrapper=field?.closest('.moji-map-with-stick');
    const mapBox=wrapper&&getComputedStyle(wrapper).display!=='contents'?wrapper.getBoundingClientRect():fieldBox;
    return {position:getComputedStyle(bar).position,
     beforeArena:bar.nextElementSibling===field?.closest('.moji-map-with-stick')||
      bar.nextElementSibling===field,
     fits:barBox.left>=-2&&barBox.right<=innerWidth+2,
     above:barBox.bottom<=mapBox.top+2,
     buttons:actions.length,buttonFits:actions.every(r=>r.width>26&&r.height>=27&&
      r.left>=barBox.left-2&&r.right<=barBox.right+2&&r.top>=barBox.top-2&&r.bottom<=barBox.bottom+2),
     controlsDontOverlap:actions.every((r,i)=>actions.slice(i+1).every(x=>!overlaps(r,x))),
     mapHeight:fieldBox.height,
     width:innerWidth,bar:{top:barBox.top,bottom:barBox.bottom},field:{top:fieldBox.top,bottom:fieldBox.bottom}};
   });
   if(geometry.position==='absolute'||geometry.position==='fixed'||!geometry.beforeArena||
      !geometry.fits||!geometry.above||geometry.buttons!==3||!geometry.buttonFits||
      !geometry.controlsDontOverlap||geometry.mapHeight<65)
    throw Error('CPU spectator toolbar blocks game on '+width+'x'+height+': '+JSON.stringify(geometry));
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('#cpuWatchNext').click();
  await page.locator('#cpuWatchExit').click();
  await page.waitForSelector('#lobbyScreen:not(.hidden)',{timeout:10000});

  console.log('CPU actual battle smoke passed for normal and custom modes.');
  if(errors.length)throw Error('CPU page JS error: '+errors.join('; '));
  errors.length=0;
  const multiplayer=await page.goto(base+'/multiplayer.html?embedded=1',{waitUntil:'domcontentloaded',timeout:45000});
  const copiedName=await page.locator('#name').inputValue();
  if(copiedName!=='蒼月の勇者')throw Error('Online lobby must inherit login nickname: '+copiedName);
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
  const weaponGuideBeforeJoin=page.locator('#joinArea #mojiOnlineAbilityGuide');
  if(await weaponGuideBeforeJoin.count()!==1||await weaponGuideBeforeJoin.evaluate(el=>el.open)||
      await page.locator('#onlineSlots .online-slot > .moji-preview').count())
   throw Error('Online shots must appear inside a closed use/effect guide, not as extra equipment panels');
  await weaponGuideBeforeJoin.locator('summary').click();
  if(!await weaponGuideBeforeJoin.locator('.moji-weapon-help .moji-preview').first().isVisible()||
     await weaponGuideBeforeJoin.locator('.moji-preview').count()!==5)
   throw Error('Pre-join use/effect guide must contain all 5 projectile and action examples');
  await weaponGuideBeforeJoin.locator('summary').click();
  if(await page.evaluate(()=>window.MojiUltMulti.chosen())!=='namepu')throw Error('solo/online ultimate choice not shared');
  const onlineGuide=page.locator('#joinArea .ultimate-guide');
  const onlineHelp=page.locator('#joinArea .ultimate-guide-toggle');
  if(!await onlineGuide.isHidden())throw Error('online guide must default to collapsed');
  await page.locator('#joinArea .ultimate-option[data-ultimate=slow]').click();
  await onlineHelp.click();
  if(!((await onlineGuide.innerText()).includes('硬化弾')&&(await onlineGuide.innerText()).includes('3秒間')&&(await onlineGuide.innerText()).includes('無敵')&&(await onlineGuide.innerText()).includes('回復と防御')))
   throw Error('online hardening guide did not reflect stun and invincibility rules');
  await onlineHelp.click();
  const onlineArrow=onlineHelp.locator('.ultimate-guide-chevron');
  const onlineArrowBox=await onlineArrow.boundingBox();
  if(!(await onlineArrow.innerText()).includes('▼')||!(await onlineArrow.innerText()).includes('開く')||
     await onlineHelp.getAttribute('aria-label')!=='必殺技の使い方を開く'||!onlineArrowBox||
     onlineArrowBox.width<60||onlineArrowBox.height<44)
   throw Error('Online skill guide open arrow is not obvious enough');
  await page.locator('#joinArea .ultimate-option[data-ultimate=invincible]').click();
  if(!await onlineGuide.isHidden())throw Error('selecting an ultimate must not open its explanation automatically');
  await onlineHelp.click();
  if(!await onlineGuide.isVisible()||await onlineHelp.getAttribute('aria-expanded')!=='true')throw Error('online help cannot be opened');
  if(!(await onlineHelp.innerText()).includes('閉じる'))throw Error('Online expanded guide must clearly signal close action');
  if(!(await onlineArrow.innerText()).includes('▲')||!(await onlineArrow.innerText()).includes('閉じる')||
     await onlineHelp.getAttribute('aria-label')!=='必殺技の使い方を閉じる')
   throw Error('Online skill guide close arrow or label missing');
  await onlineHelp.click();
  if(!await onlineGuide.isHidden())throw Error('Online skill guide did not collapse by arrow button');
  await onlineHelp.click();
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
  // Exercise the actual click listener, not only the selector API.
  const orientationClick=await page.evaluate(()=>{
   const landscape=document.querySelector('[data-mobile-orientation=landscape]');
   const portrait=document.querySelector('[data-mobile-orientation=portrait]');
   landscape.click();
   const selected=landscape.getAttribute('aria-pressed')==='true'&&localStorage.getItem('moji_mobile_play_orientation')==='landscape';
   portrait.click();
   return {selected,restored:portrait.getAttribute('aria-pressed')==='true'&&localStorage.getItem('moji_mobile_play_orientation')==='portrait'};
  });
  if(!orientationClick.selected||!orientationClick.restored)
   throw Error('Actual orientation preference switch click failed '+JSON.stringify(orientationClick));
  console.log('Browser smoke passed: shared login, six CPU skills, six online skills, preference parity, portrait/landscape.');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
