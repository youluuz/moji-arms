// Integration smoke with TWO real Chromium browser contexts and real WebSocket room.
const {chromium}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8083';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
 try{
  for(const mode of ['normal','custom']){
   const errors=[];
   const contexts=await Promise.all([0,1].map(()=>browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})));
   const pages=await Promise.all(contexts.map(c=>c.newPage()));
   try{
    for(let i=0;i<2;i++){
     const page=pages[i];page.on('pageerror',e=>errors.push(mode+'/p'+i+': '+String(e)));
     await page.goto(base+'/multiplayer.html?embedded=1',{waitUntil:'domcontentloaded'});
     await page.waitForFunction(()=>!!window.MojiUltMulti);
     if(mode==='custom'){
      await page.evaluate(()=>{sessionStorage.setItem('kanji_v5_multi_setup',JSON.stringify({mode:'custom',ch:'火',slots:[],theme:'shrine',shrink:'normal'}))});
      await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.MojiUltMulti);
     }
     const chars=['火','水','木','金','土'];
     for(let k=0;k<5;k++)await page.locator('#onlineGlyph'+k).fill(chars[k]);
     if(mode==='custom')for(let k=0;k<5;k++)await page.locator('.online-slot .slot-strokes').nth(k).fill('12');
     await page.locator('#joinArea .ultimate-option[data-ultimate=roman]').click();
     if(i===0){
      if(mode==='normal')await page.locator('#match').click();
      else {await page.locator('.online-private-choice summary').click();await page.locator('#create').click();}
     }
    }
    const host=pages[0],guest=pages[1];
    await host.waitForFunction(()=>!!roomState && roomState.phase==='lobby',{timeout:15000});
    const mobileChoice=host.locator('#mobileOrientationSetting');
    if(!await mobileChoice.isVisible()||await mobileChoice.locator('[data-mobile-orientation]').count()!==2)
     throw Error(mode+': embedded online phone orientation switch missing');
    await host.evaluate(()=>window.MojiMobileOrientation.select('landscape',false));
    if(await mobileChoice.locator('[data-mobile-orientation=landscape]').getAttribute('aria-pressed')!=='true')
     throw Error(mode+': online portrait/landscape preference did not apply');
    const code=await host.locator('#code').innerText();
    if(!/^[A-Z0-9]{6}$/.test(code))throw Error(mode+': bad invite code '+code);
    if(mode==='normal'){
     if(await guest.locator('#roomCode').inputValue()!=='')throw Error('random match must not require code');
     await guest.locator('#match').click();
    } else {
     // The shared lobby already collected five glyphs: an invite auto-joins.
     await guest.evaluate(()=>{
      const slots=collectOnlineSlots();
      sessionStorage.setItem('kanji_v5_multi_setup',JSON.stringify({...setup,ch:'火',slots}));
     });
     await guest.goto(base+'/multiplayer.html?embedded=1&room='+code,{waitUntil:'domcontentloaded'});
    }
    await host.waitForFunction(()=>roomState?.players?.length===2,{timeout:15000});
    await guest.waitForFunction(()=>roomState?.players?.length===2,{timeout:15000});
    for(const page of pages){
     const state=await page.evaluate(()=>({waiting:document.body.classList.contains('online-waiting'),entryHidden:getComputedStyle(document.getElementById('joinArea')).display==='none',code:roomState?.code}));
     if(!state.waiting||!state.entryHidden||state.code!==code)throw Error(mode+': did not auto-switch to joined room: '+JSON.stringify(state));
    }
    // Shot animation and stats belong to the collapsible how-to/effects guide,
    // not to each individual equipment input slot.
    const previews=await host.evaluate(()=>({
     slotPreviews:document.querySelectorAll('#onlineSlots .online-slot > .moji-preview').length,
     joinGuide:document.querySelector('#mojiOnlineAbilityGuide')?.open,
     waitGuide:document.querySelector('#waitArea details.online-guide')?.open,
     items:[...document.querySelectorAll('#waitArea details.online-guide .moji-preview')].map(e=>({
      kind:e.dataset.kind,stats:e.textContent,shot:e.querySelector('.moji-preview-shot')?.textContent
     }))
    }));
    if(previews.slotPreviews!==0||previews.joinGuide!==false||previews.waitGuide!==false||
       previews.items.length!==5||previews.items[0].kind!=='attack'||previews.items[3].kind!=='pierce'||
       previews.items[4].kind!=='homing'||previews.items[0].shot!=='●'||
       previews.items[3].shot!=='◆'||previews.items[4].shot!=='◎'||
       !previews.items.every(p=>p.stats.includes('CT')))
     throw Error(mode+': ability-guide shot/usage previews missing or still duplicated in slots '+JSON.stringify(previews));
    const onlineAttackCT=await host.evaluate(()=>({
     one:onlineCD('attack',1),two:onlineCD('attack',2),ten:onlineCD('attack',10),
     preview:window.MojiWeaponVisual.cooldown('attack',1),
     homing:onlineCD('homing',1)
    }));
    if(onlineAttackCT.one!==800||onlineAttackCT.two!==843||onlineAttackCT.ten!==1251||
       onlineAttackCT.preview!=='0.8秒'||onlineAttackCT.homing!==6199)
     throw Error(mode+': online one-stroke attack cooldown or non-attack balance differs '+JSON.stringify(onlineAttackCT));
    // The ordinary-ability guide has an explicit down arrow when closed and up arrow when open.
    const weaponHelp=host.locator('#waitArea details.online-guide');
    if(!(await weaponHelp.locator('summary').innerText()).includes('▼')||!(await weaponHelp.locator('summary').innerText()).includes('開く'))
     throw Error(mode+': ordinary weapon help lacks clear expand affordance');
    await weaponHelp.locator('summary').click();
    if(!await weaponHelp.evaluate(el=>el.open)||
       !(await weaponHelp.locator('summary').innerText()).includes('▲')||
       !(await weaponHelp.locator('summary').innerText()).includes('閉じる'))
     throw Error(mode+': ordinary weapon guide did not visibly open');
    if(!await weaponHelp.locator('.moji-weapon-help .moji-preview').first().isVisible())
     throw Error(mode+': consolidated weapon previews are hidden even when usage/effects help is open');
    await weaponHelp.locator('summary').click();
    if(await weaponHelp.evaluate(el=>el.open))throw Error(mode+': ordinary weapon guide did not close');
    // Every PvP weapon input uses the new high-contrast surface, in both
    // normal and custom rooms without changing the original input elements.
    for(const p of pages){
     const equipmentContrast=await p.evaluate(()=>{
      const cards=[...document.querySelectorAll('#roomLoadoutMount #onlineSlots .online-slot')];
      return {css:[...document.styleSheets].some(s=>s.href?.includes('loadout-contrast-v101.css')),
       count:cards.length,
       cards:cards.map(card=>{
        const el=card.querySelector('.online-glyph-input');
        const style=getComputedStyle(el),r=el.getBoundingClientRect();
        const digits=card.querySelector('.slot-strokes'),ds=getComputedStyle(digits);
        return {bg:style.backgroundColor,color:style.color,border:style.borderTopColor,
         height:r.height,width:r.width,within:r.left>=0&&r.right<=innerWidth+2,
         digitHeight:digits.getBoundingClientRect().height,digitColor:ds.color};
       })};
     });
     if(!equipmentContrast.css||equipmentContrast.count!==5||
        equipmentContrast.cards.some(x=>x.bg!=='rgb(9, 21, 37)'||
          x.border!=='rgb(193, 219, 244)'||x.height<50||
          x.width<50||!x.within||x.digitHeight<40))
      throw Error(mode+': room equipment blending into background '+JSON.stringify(equipmentContrast));
    }
    // Waiting room action placement: ready is directly to Start's RIGHT,
    // and each single-slot button only shuffles that one glyph.
    for(const p of pages){
     const buttons=await p.evaluate(()=>{
      const start=document.getElementById('begin');
      const ready=document.getElementById('saveRoomLoadout');
      const a=start.getBoundingClientRect(),b=ready.getBoundingClientRect();
      const labels=[...document.querySelectorAll('#roomLoadoutMount .slot-random')].map(x=>x.textContent.trim());
      return {inSameRow:Math.abs(a.top-b.top)<6,readyToRight:b.left>=a.right-2,
       buttonsAdjacent:start.nextElementSibling===ready,labels};
     });
     if(!buttons.inSameRow||!buttons.readyToRight||!buttons.buttonsAdjacent||
        buttons.labels.length!==5||buttons.labels.some(label=>label!=='🎲 文字ランダム'))
      throw Error(mode+': waiting-room ready placement or random label wrong '+JSON.stringify(buttons));
    }
    // A slot's "文字ランダム" only changes that glyph. It must not touch
    // other slots, chosen abilities, or a custom-mode manual stroke count.
    const beforeSlotRandom=await host.evaluate(()=>[...document.querySelectorAll('#onlineSlots .online-slot')].map(row=>({
     ch:row.querySelector('.online-glyph-input').value,
     kind:row.querySelector('.online-kind').value,
     n:row.querySelector('.slot-strokes').value
    })));
    await host.locator('#roomLoadoutMount .slot-random').first().click();
    const afterSlotRandom=await host.evaluate(()=>[...document.querySelectorAll('#onlineSlots .online-slot')].map(row=>({
     ch:row.querySelector('.online-glyph-input').value,
     kind:row.querySelector('.online-kind').value,
     n:row.querySelector('.slot-strokes').value
    })));
    if(afterSlotRandom[0].kind!==beforeSlotRandom[0].kind||
       (mode==='custom'&&afterSlotRandom[0].n!==beforeSlotRandom[0].n)||
       JSON.stringify(afterSlotRandom.slice(1))!==JSON.stringify(beforeSlotRandom.slice(1)))
      throw Error(mode+': slot glyph random changed power, role or other slots');
    await host.locator('#roomLoadoutMount #onlineGlyph0').fill(beforeSlotRandom[0].ch);
    if(mode==='custom')await host.locator('#roomLoadoutMount #onlineGlyph0').locator('xpath=..').locator('.slot-strokes').fill(beforeSlotRandom[0].n);
    await host.locator('#saveRoomLoadout').click();
    await host.waitForFunction(()=>roomState.players.find(p=>p.id===myId)?.ready&&
     document.getElementById('roomEditStatus')?.textContent.includes('保存しました'),{timeout:12000});
    // The two original randomizers sit immediately ABOVE the ultimate choices,
    // including when the editable loadout moves into the waiting room.
    for(const p of pages){
     const order=await p.evaluate(()=>{
      const root=document.getElementById('roomLoadoutMount');
      const editor=root?.querySelector('.online-loadout');
      const bar=editor?.lastElementChild;
      const ult=editor?.nextElementSibling;
      return {editor:!!editor,random:bar?.id==='onlineBulkRandomBar',
       all:bar?.querySelector('#randomAll')?.isConnected,
       emoji:bar?.querySelector('#randomEmoji')?.isConnected,
       next:ult?.classList.contains('ultimate-widget')};
     });
     if(!await p.locator('#waitArea #roomLoadoutMount #onlineGlyph0').isVisible()||
        !await p.locator('#waitArea #roomLoadoutMount .ultimate-option').count()||
        !order.editor||!order.random||!order.all||!order.emoji||!order.next)
      throw Error(mode+': mobile random button placement or editable ultimate missing '+JSON.stringify(order));
    }
    // The waiting room displays the same power, shield, healing and cooldown
    // formulas as the in-battle equipment HUD; refresh on custom/normal edits.
    for(const p of pages){
     await p.waitForFunction(()=>document.querySelectorAll('#roomWeaponSummary .moji-room-weapon').length===5,{timeout:9500});
     const stats=await p.evaluate(()=>{
      const cards=[...document.querySelectorAll('#roomWeaponSummary .moji-room-weapon')];
      const editor=[...document.querySelectorAll('#roomLoadoutMount #onlineSlots .online-slot')];
      return {count:cards.length, visible:cards.every(x=>x.getBoundingClientRect().height>50),
       valid:cards.every((card,i)=>{
        const n=Number(editor[i].querySelector('.slot-strokes').value),kind=editor[i].querySelector('.online-kind').value;
        return card.querySelector('.moji-room-weapon-metric').textContent===window.MojiWeaponVisual.metric(kind,n) &&
         card.querySelector('.moji-room-weapon-ct').textContent==='CT '+window.MojiWeaponVisual.cooldown(kind,n) &&
         editor[i].querySelector('.moji-setup-stat strong')?.textContent.includes(window.MojiWeaponVisual.metric(kind,n));
       }),
       notes:editor.map(x=>x.querySelector('.moji-setup-stat small')?.textContent)};
     });
     if(stats.count!==5||!stats.visible||!stats.valid||stats.notes.some(x=>!x))
      throw Error(mode+': live weapon power/cooldown details missing from room '+JSON.stringify(stats));
    }
    if(mode==='normal'){
     await guest.locator('#roomLoadoutMount #onlineGlyph0').fill('イ');
     await guest.waitForFunction(()=>document.querySelector('#roomWeaponSummary [data-room-slot="0"] .moji-room-weapon-metric')?.textContent==='威力18',{timeout:8000});
     await guest.waitForFunction(()=>roomState?.players.find(p=>p.id===myId)?.ready===false,{timeout:10000});
     await host.waitForFunction(()=>document.getElementById('begin')?.disabled,{timeout:6000});
     if(await host.locator('#begin').isEnabled())throw Error('host could start while player edits');
     const ii=await guest.locator('#roomLoadoutMount #onlineGlyph0').locator('xpath=..').locator('.slot-strokes').inputValue();
     const refreshed=await guest.locator('#roomWeaponSummary [data-room-slot="0"] .moji-room-weapon-ct').innerText();
     if(refreshed!=='CT '+(await guest.evaluate(()=>window.MojiWeaponVisual.cooldown('attack',2))))
      throw Error('Room preview attack CT did not react to glyph change: '+refreshed);
     if(ii!=='2')throw Error('イ must be two strokes; got '+ii);
     await guest.locator('#roomLoadoutMount #onlineGlyph0').fill('ー');
     const dash=await guest.locator('#roomLoadoutMount #onlineGlyph0').locator('xpath=..').locator('.slot-strokes').inputValue();
     if(dash!=='1')throw Error('ー must be one stroke; got '+dash);
     await guest.locator('#roomLoadoutMount #onlineGlyph0').fill('火');
     await guest.locator('#roomLoadoutMount .ultimate-option[data-ultimate=slow]').click();
     await guest.locator('#saveRoomLoadout').click();
     await guest.waitForFunction(()=>roomState?.players.find(p=>p.id===myId)?.ultimate==='slow',{timeout:10000});
     await guest.locator('#roomLoadoutMount .ultimate-option[data-ultimate=roman]').click();
     await guest.locator('#saveRoomLoadout').click();
     await guest.waitForFunction(()=>roomState?.players.find(p=>p.id===myId)?.ready===true&&roomState?.players.find(p=>p.id===myId)?.ultimate==='roman',{timeout:10000});
     if(!await host.locator('#begin').isEnabled())throw Error('host not ready after equipment saved');
    }
    if(!await host.locator('#begin').isEnabled())throw Error(mode+': host start disabled');
    await host.locator('#begin').click();
    await Promise.all(pages.map(p=>p.waitForFunction(()=>roomState?.phase==='countdown',{timeout:12000})));
    const scaled=await host.evaluate(()=>roomState.world);
    if(scaled.w!==1840||scaled.h!==1040||scaled.scale!==.8)
     throw Error(mode+': two-player map should be 0.8x '+JSON.stringify(scaled));

    for(const p of pages){
      const state=await p.evaluate(()=>({
       phase:roomState.phase,seconds:roomState.countdownLeft,
       x:roomState.players.map(p=>({x:p.x,y:p.y})),
       overlay:!document.getElementById('onlineCountdown')?.hidden,
       killText:document.getElementById('onlineKillScore')?.textContent,
       kills:roomState.players.map(x=>x.kills),
       scorePosition:(()=>{
        const hud=document.querySelector('#gameArea .hud').getBoundingClientRect();
        const score=document.getElementById('onlineBattleScoreboard').getBoundingClientRect();
        const hp=document.getElementById('selfBar').getBoundingClientRect();
        return {right:score.right<=hud.right+2&&score.left>hud.left+hud.width*.5,
          noOverlap:score.left>=hp.right-4,visible:score.width>85&&score.height>18};
       })(),
       healingLabel:window.MojiWeaponVisual.metric('heal',10)
      }));
      if(!state.overlay||state.seconds<=0||state.seconds>3.2||!state.kills.every(x=>x===0)||
       state.killText!=='⚔ キル 0'||!state.scorePosition.right||!state.scorePosition.noOverlap||
       !state.scorePosition.visible||state.healingLabel!=='回復34'||
       Math.hypot(state.x[0].x-state.x[1].x,state.x[0].y-state.x[1].y)<900)
       throw Error(mode+': server-side spawn/countdown/kill UI invalid '+JSON.stringify(state));
    }
    await Promise.all(pages.map(p=>p.waitForFunction(()=>roomState?.phase==='playing'&&document.getElementById('onlineCountdown')?.hidden,{timeout:15000})));
    // A third browser opens the exact invite DURING the match, with no
    // equipment configured. It must watch without joining as a combatant.
    const viewerContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    try{
      const viewer=await viewerContext.newPage();
      viewer.on('pageerror',e=>errors.push(mode+'/watcher: '+String(e)));
      await viewer.goto(base+'/multiplayer.html?embedded=1&room='+code,{waitUntil:'domcontentloaded'});
      await viewer.waitForFunction(()=>joinedAsSpectator===true&&roomState?.phase==='playing',{timeout:20000});
      await host.waitForFunction(()=>roomState?.spectators===1,{timeout:12000});
      const watchState=await viewer.evaluate(()=>({
       players:roomState.players.length,viewers:roomState.spectators,
       score:document.getElementById('onlineSpectatorCount')?.textContent,
       watchUI:!document.getElementById('onlineWatchControls').hidden,
       cards:document.querySelectorAll('#cards .card[data-slot]').length,
       target:document.getElementById('onlineWatchTarget')?.textContent,
       choiceHidden:document.getElementById('onlineDeathChoice')?.hidden
      }));
      if(watchState.players!==2||watchState.viewers!==1||watchState.score!=='👁 観戦 1'||
         !watchState.watchUI||watchState.cards!==0||!watchState.target?.includes('観戦中')||
         !watchState.choiceHidden)
       throw Error(mode+': live invite did not enter read-only spectator mode '+JSON.stringify(watchState));
      // The spectator toolbar must sit above the arena as a real row
      // at phone portrait/landscape and desktop widths, never over it.
      const auditSpectator=async (pg,label)=>{
       const result=await pg.evaluate(()=>{
        const bar=document.getElementById('onlineWatchControls');
        const field=document.querySelector('#gameArea .arena-shell');
        const row=field?.closest('.moji-map-with-stick')||field;
        const b=bar.getBoundingClientRect(),r=row&&getComputedStyle(row).display!=='contents'?row.getBoundingClientRect():field.getBoundingClientRect();
        const buttons=[...bar.querySelectorAll('button')].map(el=>el.getBoundingClientRect());
        const overlaps=(x,y)=>Math.min(x.right,y.right)-Math.max(x.left,y.left)>2&&
         Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>2;
        return {normalFlow:!['absolute','fixed'].includes(getComputedStyle(bar).position),
         placedBeforeMap:bar.parentElement===row.parentElement&&Boolean(bar.compareDocumentPosition(row)&Node.DOCUMENT_POSITION_FOLLOWING),
         diagnostics:{barParent:bar.parentElement?.className,next:bar.nextElementSibling?.className,
          fieldParent:field.parentElement?.className,rowParent:row?.parentElement?.className,
          nextNext:bar.nextElementSibling?.nextElementSibling?.className},
         above:b.bottom<=r.top+2,visible:b.height>25,
         buttonCount:buttons.length,
         allButtonsFit:buttons.every(x=>x.width>35&&x.height>=27&&x.left>=b.left-2&&x.right<=b.right+2),
         nonoverlapping:buttons.every((x,i)=>buttons.slice(i+1).every(y=>!overlaps(x,y))),
         mapHeight:field.getBoundingClientRect().height,
         noOverflow:document.documentElement.scrollWidth<=innerWidth+3,
         bar:{top:b.top,bottom:b.bottom},map:{top:r.top,bottom:r.bottom}};
       });
       if(!result.normalFlow||!result.placedBeforeMap||!result.above||!result.visible||
          result.buttonCount!==3||!result.allButtonsFit||!result.nonoverlapping||
          result.mapHeight<70||!result.noOverflow)
        throw Error(mode+': spectator navigation blocks '+label+': '+JSON.stringify(result));
      };
      for(const [width,height] of [[390,844],[667,375]]){
       await viewer.setViewportSize({width,height});
       await auditSpectator(viewer,width+'x'+height);
      }
      // In addition to phone breakpoints, use a REAL desktop Chrome context.
      if(mode==='normal'){
       const pcContext=await browser.newContext({viewport:{width:1280,height:800},isMobile:false,hasTouch:false});
       try{
        const desktop=await pcContext.newPage();
        desktop.on('pageerror',e=>errors.push(mode+'/desktop-watcher: '+String(e)));
        await desktop.goto(base+'/multiplayer.html?embedded=1&room='+code,{waitUntil:'domcontentloaded'});
        await desktop.waitForFunction(()=>joinedAsSpectator===true&&roomState?.phase==='playing',{timeout:20000});
        await auditSpectator(desktop,'1280x800 desktop Chrome');
        await desktop.locator('#onlineWatchNext').click();
        await desktop.locator('#onlineWatchPrev').click();
       }finally{await pcContext.close()}
       await host.waitForFunction(()=>roomState?.spectators===1,{timeout:12000});
      }
      await viewer.locator('#onlineWatchNext').click();
      await viewer.locator('#onlineWatchPrev').click();
    }finally{await viewerContext.close()}
    await host.waitForFunction(()=>roomState?.spectators===0,{timeout:10000});
    for(let i=0;i<2;i++){
     const page=pages[i];
     if(await page.locator('#cards .card').count()!==5)throw Error(mode+': missing online weapons for player '+i);
     if(!await page.locator('#gameArea .battle-head').isVisible()||!await page.locator('#cards .card.weapon').count())throw Error(mode+': CPU-style battle HUD not rendered');
     const touchUI=await page.evaluate(()=>{
      const cards=document.getElementById('cards'),rects=[
       ...cards.querySelectorAll(':scope > .card[data-slot]'),
       cards.querySelector(':scope > .moji-ultimate-inline .ultimate-cast')
      ].map(el=>el?.getBoundingClientRect());
      const intersect=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&
       Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2;
      const zone=document.getElementById('moveZone').getBoundingClientRect();
      const pad=document.getElementById('movePad').getBoundingClientRect();
      const center=r=>({x:r.left+r.width/2,y:r.top+r.height/2});
      const z=center(zone),v=center(pad);
      const hint=document.querySelector('#gameArea .moji-battle-howto');
      const field=document.querySelector('#gameArea .arena-shell');
      const helpRect=hint?.getBoundingClientRect(),fieldRect=field?.getBoundingClientRect();
      const layout=field.closest('.moji-map-with-stick')||field;
      const outsideMap=!!helpRect&&!!fieldRect&&hint.parentElement===layout.parentElement&&
       hint.nextElementSibling===layout&&helpRect.bottom<=fieldRect.top+2&&
       getComputedStyle(hint).position!=='absolute';
      const joystickOut=document.getElementById('touchControls')?.closest('.moji-stick-dock')!==null&&
       (zone.right<=fieldRect.left+2||zone.top>=fieldRect.bottom-2);
      return {outsideMap,joystickOut,slots:rects.length,sameRow:rects.every(r=>r&&Math.abs(r.top-rects[0].top)<9),
       noOverlap:rects.every((r,i)=>r&&rects.slice(i+1).every(s=>s&&!intersect(r,s))),
       centered:Math.hypot(z.x-v.x,z.y-v.y)<2,zoneRound:Math.abs(zone.width-zone.height)<2,
       widthSafe:rects.every(r=>r&&r.width>28&&r.left>=-2&&r.right<=innerWidth+2),
       hint:hint?.textContent||'',pointerSafe:hint&&getComputedStyle(hint).pointerEvents==='none',
       ratio:document.querySelector('#arena').width/view.w,
       attackColor:window.MojiWeaponVisual.types.attack.color};
     });
     if(!touchUI.outsideMap||!touchUI.joystickOut||touchUI.slots!==6||!touchUI.sameRow||!touchUI.noOverlap||
        !touchUI.centered||!touchUI.zoneRound||!touchUI.widthSafe||
        !touchUI.hint.includes('タップ／クリック')||!touchUI.pointerSafe||
        touchUI.ratio>1.55||touchUI.attackColor!=='#dbff70')
      throw Error(mode+': non-overlapping six slots, concentric joystick or lime attack missing '+JSON.stringify(touchUI));
     // The joystick must MOVE the server-authoritative fighter, not just
     // remain visually outside the map with a disconnected touch listener.
     const p0=await page.evaluate(()=>{const me=roomState.players.find(p=>p.id===myId);return {x:me.x,y:me.y}});
     const jbox=await page.locator('#moveZone').boundingBox();
     const cdp=await page.context().newCDPSession(page);
     const x=jbox.x+jbox.width/2,y=jbox.y+jbox.height/2;
     try{
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x,y}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:x+25,y}]});
      await page.waitForTimeout(350);
     }finally{
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await cdp.detach();
     }
     const p1=await page.evaluate(()=>{const me=roomState.players.find(p=>p.id===myId);return {x:me.x,y:me.y}});
     if(Math.hypot(p1.x-p0.x,p1.y-p0.y)<3)
      throw Error(mode+': moved off-map PvP joystick does not control server-side fighter '+JSON.stringify({p0,p1,jbox}));
     // Check the screenshot-defining structure, not just a decorative header.
     const parity=await page.evaluate(()=>{
      const box=q=>document.querySelector(q).getBoundingClientRect();
      const self=box('#selfBar'),hud=box('#gameArea .hud');
      const arena=box('#gameArea .arena-shell'),cards=box('#cards');
      return {singleHP:document.querySelectorAll('#gameArea .combat-hp').length===1&&
        document.querySelector('#gameArea .combat-hp.own')!==null&&!document.querySelector('#enemyBar'),
        ownHPVisible:self.width>50&&self.height>=5,
        stacked:hud.bottom<=arena.top+1&&arena.bottom<=cards.top+3,
        ownName:document.querySelector('#selfName').textContent,
        metrics:[...document.querySelectorAll('#cards .weapon-output')].map(e=>e.textContent),
        cssLoaded:[...document.styleSheets].some(x=>x.href?.includes('weapon-visuals-v86.css')),
        projectilePreview:typeof window.MojiWeaponVisual?.drawProjectile==='function',
        announcement:document.getElementById('battleAnnounce')?.textContent};
     });
     const liveWorld=await page.evaluate(()=>({server:roomState.world,source:draw.toString()}));
     if(!liveWorld.source.includes('worldW')||!liveWorld.source.includes('worldH')||liveWorld.source.includes('/2300*mmw')||liveWorld.source.includes('/1300*mmh'))
      throw Error(mode+': online map/minimap still assumes fixed dimensions');
     if(!parity.singleHP||!parity.ownHPVisible||!parity.stacked||!parity.ownName||
        parity.metrics.length!==5||!parity.metrics[0].includes('威力')||
        !parity.cssLoaded||!parity.projectilePreview||parity.announcement!=='戦闘開始！')
      throw Error(mode+': self-only HP, active weapon stats or bullet renderer missing '+JSON.stringify(parity));
     const danceVisual=await page.evaluate(()=>{
      const saved=window.MojiWeaponVisual.drawMirrorBall;
      const savedAura=window.MojiWeaponVisual.drawDanceAura;
      const positions=[],auraPositions=[];
      window.MojiWeaponVisual.drawMirrorBall=(ctx,x,y,t)=>{positions.push({x,y,t})};
      window.MojiWeaponVisual.drawDanceAura=(ctx,x,y,t)=>{auraPositions.push({x,y,t})};
      try{
       const players=roomState.players.map(p=>({...p,danceLeft:2,namepuLeft:0}));
       const ctx=document.createElement('canvas').getContext('2d');
       window.MojiUltMulti.drawWorld(ctx,{...roomState,players});
      }finally{
       window.MojiWeaponVisual.drawMirrorBall=saved;
       window.MojiWeaponVisual.drawDanceAura=savedAura;
      }
      const shell=document.querySelector('#gameArea .game-wrap');
      const labels=[...shell.querySelectorAll('.ultimate-aiming-banner')].map(x=>x.style.top||getComputedStyle(x).top);
      return {count:positions.length,auraCount:auraPositions.length,expected:roomState.players.filter(p=>p.alive).length,
       mirrorPosition:positions.length&&Math.round(positions[0].y-roomState.players.find(p=>p.alive).y),
       avatarAuraCentered:auraPositions.every(p=>roomState.players.some(f=>f.x===p.x&&f.y===p.y)),
       survivorText:document.getElementById('onlineStatus')?.textContent,
       labels,hasShotScale:window.MojiWeaponVisual.drawProjectile.toString().includes('cx.scale(1.14,1.14)')};
     });
     if(danceVisual.count!==danceVisual.expected||danceVisual.auraCount!==danceVisual.expected||
        !danceVisual.avatarAuraCentered||danceVisual.mirrorPosition!==-126||
        !danceVisual.survivorText?.includes('生存 '+danceVisual.expected+' / ')||
        !danceVisual.hasShotScale||!danceVisual.labels.length)
      throw Error(mode+': mirror-ball effects or raised onscreen labels missing '+JSON.stringify(danceVisual));
     const volume=await page.evaluate(()=>document.getElementById('onlineMusic').volume);
     if(volume!==.10)throw Error(mode+': BGM startup volume '+volume);
     if(!await page.locator('#gameArea .ultimate-cast').isVisible())throw Error(mode+': missing ultimate cast button');
     const hardenedControls=await page.evaluate(()=>{
      const p=roomState.players.find(p=>p.id===myId),original=p.hardenedLeft;
      p.hardenedLeft=2;
      const can=kind=>window.MojiUltMulti.canUseSlot(kind);
      const capabilities={heal:can('heal'),defense:can('defense'),attack:can('attack'),pierce:can('pierce'),homing:can('homing'),locked:window.MojiUltMulti.locked()};
      const defensive=activeSetup.slots.findIndex(s=>s.kind==='defense');
      const healing=activeSetup.slots.findIndex(s=>s.kind==='heal');
      document.querySelector('#cards [data-slot="'+defensive+'"]')?.click();
      capabilities.selectGuard=selected===defensive;
      document.querySelector('#cards [data-slot="'+healing+'"]')?.click();
      capabilities.selectHeal=selected===healing;
      p.hardenedLeft=original;selected=0;
      return capabilities;
     });
     if(!hardenedControls.heal||!hardenedControls.defense||hardenedControls.attack||
        hardenedControls.pierce||hardenedControls.homing||hardenedControls.locked||
        !hardenedControls.selectGuard||!hardenedControls.selectHeal)
      throw Error(mode+': Hardened mobile/desktop controls must keep heal and defense usable: '+JSON.stringify(hardenedControls));
     const st=await page.evaluate(()=>({id:myId,all:roomState.players.map(p=>({id:p.id,ultimate:p.ultimate,charge:p.ultimateCharge}))}));
     if(!st.all.every(p=>p.ultimate==='roman'&&p.charge===0))throw Error(mode+': ultimate state mismatch '+JSON.stringify(st));
    }
    const terrain=await host.evaluate(()=>{
      const groups=new Map();
      for(const wall of roomState.obstacles){
        const members=groups.get(wall.expires)||[];
        members.push(wall);
        groups.set(wall.expires,members);
      }
      const counts=[...groups.values()].reduce((a,v)=>(a[v.length]=(a[v.length]||0)+1,a),{});
      return {parts:roomState.obstacles.length,groups:groups.size,counts,center:roomState.zone};
    });
    if(terrain.parts!==16||terrain.groups!==10||
       terrain.counts[1]!==5||terrain.counts[2]!==4||terrain.counts[3]!==1||
       terrain.center.x!==920||terrain.center.y!==520||terrain.center.r<950)
      throw Error(mode+': arena/L-T-U-cover mismatch '+JSON.stringify(terrain));
    // A real tap-cast must accrue automatic stroke units on the server.
    await host.evaluate(()=>send({type:'cast',selected:0,aim:0}));
    await host.waitForFunction(()=>roomState?.players.find(p=>p.id===myId)?.ultimateCharge>0,{timeout:15000});
    const charge=await host.evaluate(()=>roomState.players.find(p=>p.id===myId).ultimateCharge);
    if(charge!== (mode==='custom'?12:4))throw Error(mode+': expected charge mismatch '+charge);
    // Guest disconnects: host wins, then returns to the SAME room without reconnecting.
    await guest.evaluate(()=>sock.close());
    await host.waitForFunction(()=>roomState?.phase==='ended',{timeout:15000});
    if(!await host.locator('#onlineRematch').isVisible())throw Error(mode+': missing same-room rematch button');
    // Every participant sees a shared winner announcement; there is no
    // separate defeat screen even when the local player loses.
    const sharedResults=await host.evaluate(()=>{
     const realTitle=document.getElementById('onlineOutcomeTitle')?.textContent||'';
     const own=roomState.players.find(p=>p.id===myId);
     const ownName=own?.name||'';
     const tally=document.getElementById('onlineOutcomeKills')?.textContent;
     const expectedTally='⚔ この試合の合計キル数：'+(own?.kills||0);
     const resultScreen=document.getElementById('onlineOutcome');
     const winnerReported=realTitle.includes('優勝：'+ownName)&&
      document.getElementById('onlineOutcomeEnglish').textContent==='MATCH RESULT';
     const simulated={...roomState,winner:'other-winner',
      players:[...roomState.players,{id:'other-winner',name:'対戦相手',alive:true}]};
     finish(simulated);
     const loserTitle=document.getElementById('onlineOutcomeTitle').textContent;
     // A real Namepu activation is persisted as namepuUsed on the server.
     // Mock only the winner flag here to verify that the visible online
     // RESULT (not just the character's aura) gets its own CSS treatment.
     const namepuWin={...roomState,winner:myId,players:roomState.players.map(p=>p.id===myId?{...p,namepuUsed:true}:p)};
     finish(namepuWin);
     const golden=document.querySelector('#onlineOutcome .online-outcome-card');
     const gold={shown:resultScreen.classList.contains('show'),
      decorated:golden.classList.contains('ultimate-gold-win'),
      background:getComputedStyle(golden).backgroundImage,
      title:document.getElementById('onlineOutcomeTitle').textContent,
      phrase:document.getElementById('onlineOutcomeReward').textContent};
     finish({...namepuWin,players:namepuWin.players.map(p=>({...p,namepuUsed:false}))});
     const reset=!golden.classList.contains('ultimate-gold-win');
     return {gold,reset,winnerReported,loserTitle,tally,expectedTally,
      updatedTally:document.getElementById('onlineOutcomeKills')?.textContent,
      hasDefeat:resultScreen.classList.contains('defeat'),
      label:document.getElementById('onlineOutcomeEnglish').textContent};
    });
    if(!sharedResults.winnerReported||sharedResults.loserTitle!=='🏆 優勝：対戦相手'||
        sharedResults.tally!==sharedResults.expectedTally||sharedResults.updatedTally!==sharedResults.expectedTally||
        sharedResults.hasDefeat||sharedResults.label!=='MATCH RESULT'||
        !sharedResults.gold?.shown||!sharedResults.gold?.decorated||
        !sharedResults.gold?.background?.includes('radial-gradient')||
        !sharedResults.gold?.phrase?.includes('／')||!sharedResults.reset)
      throw Error(mode+': champion name is not shared on winner/loser results '+JSON.stringify(sharedResults));
    await host.locator('#onlineRematch').click();
    await host.waitForFunction(()=>roomState?.phase==='lobby',{timeout:15000});
    const back=await host.evaluate(()=>({code:roomState.code,phase:roomState.phase,players:roomState.players.length,
      editor:!!document.querySelector('#waitArea #roomLoadoutMount #onlineGlyph0'),
      outcomeHidden:!document.getElementById('onlineOutcome').classList.contains('show')}));
    if(back.code!==code||back.players!==1||!back.editor||!back.outcomeHidden)
     throw Error(mode+': did not retain same room after battle '+JSON.stringify(back));

    // Replay must not silently use the previous battle's stale slot objects.
    // Save an edited first weapon, bring back a real second player, and cast
    // with the edited weapon AFTER starting the second actual network match.
    const replayBefore=await host.evaluate(()=>({
     ready:roomState.players.find(p=>p.id===myId)?.ready,
     serverFirst:roomState.players.find(p=>p.id===myId)?.slots?.[0]?.ch,
     clientFirst:activeSetup.slots[0].ch
    }));
    if(replayBefore.ready!==false||replayBefore.serverFirst!==replayBefore.clientFirst)
     throw Error(mode+': rematch must restore server loadout and require fresh ready '+JSON.stringify(replayBefore));
    await host.locator('#roomLoadoutMount #onlineGlyph0').fill('イ');
    if(mode==='custom')await host.locator('#roomLoadoutMount #onlineGlyph0').locator('xpath=..').locator('.slot-strokes').fill('19');
    const updatedN=mode==='custom'?19:2;
    await host.waitForFunction(n=>document.querySelector('#roomWeaponSummary [data-room-slot="0"] .moji-room-weapon-metric')?.textContent==='威力'+Math.round(n*(7-.02*(n-1))),updatedN,{timeout:8000});
    await host.locator('#saveRoomLoadout').click();
    await host.waitForFunction(n=>{
     const p=roomState?.players.find(p=>p.id===myId);
     return p?.ready===true&&p.slots?.[0]?.ch==='イ'&&p.slots?.[0]?.n===n&&
      activeSetup.slots[0].ch==='イ'&&activeSetup.slots[0].n===n&&
      document.querySelector('#roomEditStatus')?.textContent.includes('保存しました');
    },updatedN,{timeout:15000});
    await guest.goto(base+'/multiplayer.html?embedded=1&room='+code,{waitUntil:'domcontentloaded'});
    await guest.waitForFunction(()=>roomState?.phase==='lobby'&&roomState?.players.length===2,{timeout:15000});
    await host.waitForFunction(()=>roomState?.players.length===2&&document.getElementById('begin')?.disabled===false,{timeout:15000});
    await host.locator('#begin').click();
    await host.waitForFunction(()=>roomState?.phase==='playing',{timeout:15000});
    const updatedCard=await host.evaluate(()=>({
     glyph:document.querySelector('#cards .card[data-slot="0"] .wchar')?.textContent,
     metric:document.querySelector('#cards .card[data-slot="0"] .weapon-output')?.textContent,
     n:activeSetup.slots[0].n
    }));
    if(updatedCard.glyph!=='イ'||updatedCard.metric!=='威力'+Math.round(updatedN*(7-.02*(updatedN-1)))||updatedCard.n!==updatedN)
     throw Error(mode+': replay HUD did not reflect saved server equipment '+JSON.stringify(updatedCard));
    await host.evaluate(()=>send({type:'cast',selected:0,aim:0}));
    await host.waitForFunction(n=>roomState?.players.find(p=>p.id===myId)?.ultimateCharge===n,updatedN,{timeout:15000});
    if(errors.length)throw Error(errors.join('; '));
    console.log('PVP live room '+mode+' passed: two mobile browsers, joined room '+code+', manual start, 5 slots, six-skill UI, server charge='+charge);
   }finally{await Promise.all(contexts.map(c=>c.close()))}
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
