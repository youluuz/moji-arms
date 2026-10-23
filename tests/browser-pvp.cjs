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
     if(i===0)await page.locator('#create').click();
    }
    const host=pages[0],guest=pages[1];
    await host.waitForFunction(()=>!!roomState && roomState.phase==='lobby',{timeout:15000});
    const code=await host.locator('#code').innerText();
    if(!/^[A-Z0-9]{6}$/.test(code))throw Error(mode+': bad invite code '+code);
    await guest.locator('#roomCode').fill(code);
    await guest.locator('#join').click();
    await host.waitForFunction(()=>roomState?.players?.length===2,{timeout:15000});
    await guest.waitForFunction(()=>roomState?.players?.length===2,{timeout:15000});
    if(!await host.locator('#begin').isEnabled())throw Error(mode+': host start disabled');
    await host.locator('#begin').click();
    await Promise.all(pages.map(p=>p.waitForFunction(()=>roomState?.phase==='playing',{timeout:15000})));
    for(let i=0;i<2;i++){
     const page=pages[i];
     if(await page.locator('#cards .card').count()!==5)throw Error(mode+': missing online weapons for player '+i);
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
       terrain.center.x!==1150||terrain.center.y!==650||terrain.center.r<1350)
      throw Error(mode+': arena/L-T-U-cover mismatch '+JSON.stringify(terrain));
    // A real tap-cast must accrue automatic stroke units on the server.
    await host.evaluate(()=>send({type:'cast',selected:0,aim:0}));
    await host.waitForFunction(()=>roomState?.players.find(p=>p.id===myId)?.ultimateCharge>0,{timeout:15000});
    const charge=await host.evaluate(()=>roomState.players.find(p=>p.id===myId).ultimateCharge);
    if(charge!== (mode==='custom'?12:4))throw Error(mode+': expected charge mismatch '+charge);
    if(errors.length)throw Error(errors.join('; '));
    console.log('PVP live room '+mode+' passed: two mobile browsers, joined room '+code+', manual start, 5 slots, six-skill UI, server charge='+charge);
   }finally{await Promise.all(contexts.map(c=>c.close()))}
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
