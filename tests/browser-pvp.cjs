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
    // Both phones must be able to edit weapons and ultimate after joining the room.
    for(const p of pages){
     if(!await p.locator('#waitArea #roomLoadoutMount #onlineGlyph0').isVisible()||
        !await p.locator('#waitArea #roomLoadoutMount .ultimate-option').count())
      throw Error(mode+': equipment or ultimate picker is hidden after room join');
    }
    if(mode==='normal'){
     await guest.locator('#roomLoadoutMount #onlineGlyph0').fill('イ');
     await guest.waitForFunction(()=>roomState?.players.find(p=>p.id===myId)?.ready===false,{timeout:10000});
     if(await host.locator('#begin').isEnabled())throw Error('host could start while player edits');
     const ii=await guest.locator('#roomLoadoutMount #onlineGlyph0').locator('xpath=..').locator('.slot-strokes').inputValue();
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
    await Promise.all(pages.map(p=>p.waitForFunction(()=>roomState?.phase==='playing',{timeout:15000})));
    for(let i=0;i<2;i++){
     const page=pages[i];
     if(await page.locator('#cards .card').count()!==5)throw Error(mode+': missing online weapons for player '+i);
     if(!await page.locator('#gameArea .battle-head').isVisible()||!await page.locator('#cards .card.weapon').count())throw Error(mode+': CPU-style battle HUD not rendered');
     // Check the screenshot-defining structure, not just a decorative header.
     const parity=await page.evaluate(()=>{
      const box=q=>document.querySelector(q).getBoundingClientRect();
      const self=box('#selfBar'),enemy=box('#enemyBar'),hud=box('#gameArea .hud');
      const arena=box('#gameArea .arena-shell'),cards=box('#cards');
      return {twinHP:Math.abs(self.top-enemy.top)<5,stacked:hud.bottom<=arena.top+1&&arena.bottom<=cards.top+3,
        ownName:document.querySelector('#selfName').textContent,
        enemyName:document.querySelector('#enemyName').textContent,
        bg:getComputedStyle(document.querySelector('#gameArea .combat-hp.rival .hp-fill')).backgroundImage,
        cssLoaded:[...document.styleSheets].some(x=>x.href?.includes('online-cpu-parity.css')),
        announcement:document.getElementById('battleAnnounce')?.textContent};
     });
     if(!parity.twinHP||!parity.stacked||!parity.ownName||!parity.enemyName||
        !parity.cssLoaded||!parity.bg.includes('gradient')||parity.announcement!=='戦闘開始！')
      throw Error(mode+': match UI does not follow reference CPU screenshot '+JSON.stringify(parity));
     const volume=await page.evaluate(()=>document.getElementById('onlineMusic').volume);
     if(volume!==.10)throw Error(mode+': BGM startup volume '+volume);
     if(!await page.locator('#gameArea .ultimate-cast').isVisible())throw Error(mode+': missing ultimate cast button');
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
    if(terrain.parts!==26||terrain.groups!==16||
       terrain.counts[1]!==8||terrain.counts[2]!==6||terrain.counts[3]!==2||
       terrain.center.x!==1150||terrain.center.y!==650||terrain.center.r<1330)
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
    await host.locator('#onlineRematch').click();
    await host.waitForFunction(()=>roomState?.phase==='lobby',{timeout:15000});
    const back=await host.evaluate(()=>({code:roomState.code,phase:roomState.phase,players:roomState.players.length,
      editor:!!document.querySelector('#waitArea #roomLoadoutMount #onlineGlyph0'),
      outcomeHidden:!document.getElementById('onlineOutcome').classList.contains('show')}));
    if(back.code!==code||back.players!==1||!back.editor||!back.outcomeHidden)
     throw Error(mode+': did not retain same room after battle '+JSON.stringify(back));
    if(errors.length)throw Error(errors.join('; '));
    console.log('PVP live room '+mode+' passed: two mobile browsers, joined room '+code+', manual start, 5 slots, six-skill UI, server charge='+charge);
   }finally{await Promise.all(contexts.map(c=>c.close()))}
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
