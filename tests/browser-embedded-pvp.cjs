// Real mobile, two-client WebSocket test through the CPU lobby's EMBEDDED iframe.
// Unlike opening multiplayer.html directly, this reproduces the production UI.
const {chromium}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8083';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
 const contexts=await Promise.all([0,1].map(()=>browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})));
 try{
  const [host,guest]=await Promise.all(contexts.map(c=>c.newPage()));
  const errors=[];host.on('pageerror',e=>errors.push('host '+e));guest.on('pageerror',e=>errors.push('guest '+e));
  await host.goto(base+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await host.waitForFunction(()=>!!window.MojiUlt,{timeout:20000});
  // Use the real common lobby document as iframe parent.
  await host.evaluate(()=>{
   const el=document.createElement('iframe');el.id='livePvPFrame';
   el.src='/multiplayer.html?embedded=1';el.style.cssText='width:320px;height:430px;border:2px solid gold';
   document.body.appendChild(el);
  });
  await host.waitForFunction(()=>document.querySelector('#livePvPFrame')?.contentDocument?.readyState==='complete',{timeout:20000});
  const inner=host.frames().find(f=>f.url().includes('/multiplayer.html?embedded=1'));
  if(!inner)throw Error('production-style multiplayer iframe did not load');
  await inner.waitForFunction(()=>!!window.MojiUltMulti,{timeout:15000});
  await guest.goto(base+'/multiplayer.html?embedded=1',{waitUntil:'domcontentloaded',timeout:30000});
  await guest.waitForFunction(()=>!!window.MojiUltMulti,{timeout:15000});
  const chars=['火','水','木','金','土'];
  for(const page of [inner,guest]){
   for(let i=0;i<5;i++)await page.locator('#onlineGlyph'+i).fill(chars[i]);
   await page.locator('.ultimate-option[data-ultimate=roman]').first().click();
  }
  await inner.locator('#match').click();
  await inner.waitForFunction(()=>roomState?.phase==='lobby',{timeout:15000});
  const code=await inner.locator('#code').innerText();
  await guest.locator('.online-private-choice summary').click();
  await guest.locator('#roomCode').fill(code);
  await guest.locator('#join').click();
  await guest.waitForFunction(()=>roomState?.phase==='lobby'&&roomState?.players.length===2,{timeout:15000});
  await inner.waitForFunction(()=>roomState?.players.length===2,{timeout:15000});
  await inner.locator('#begin').click();
  await inner.waitForFunction(()=>roomState?.phase==='playing',{timeout:15000});
  await host.waitForFunction(()=>{
   const el=document.getElementById('livePvPFrame');if(!el)return false;
   const r=el.getBoundingClientRect();
   return Math.abs(r.width-innerWidth)<4&&Math.abs(r.height-innerHeight)<4;
  },{timeout:15000});
  if(await inner.locator('#cards .weapon').count()!==5||!await inner.locator('#selfBar').isVisible()||
     await inner.locator('#enemyBar').count()!==0||await inner.locator('#cards .weapon-output').count()!==5)
   throw Error('embedded online match must have five weapon stats and only personal HP');
  // The online renderer must draw the actual four-character cannon shell,
  // not the previous single '砲' glyph or an unrelated KO overlay.
  const onlineRomanText=await inner.evaluate(()=>{
   const canvas=document.createElement('canvas');canvas.width=500;canvas.height=380;
   const ctx=canvas.getContext('2d'),text=[];
   const fill=ctx.fillText.bind(ctx);
   ctx.fillText=(s,...args)=>{text.push(String(s));return fill(s,...args)};
   window.MojiUltMulti.drawWorld(ctx,{
    ...roomState,players:[],
    bullets:[{special:'roman',owner:myId,x:250,y:180,angle:Math.PI}]
   });
   const pixels=ctx.getImageData(0,0,500,380).data;
   let visible=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>50)visible++;
   return {text,visible};
  });
  if(!onlineRomanText.text.includes('ロマン砲')||onlineRomanText.text.includes('砲')||onlineRomanText.visible<300)
   throw Error('Online Roman Cannon does not shoot full visible lettering '+JSON.stringify(onlineRomanText));
  // Final mobile audit on a narrow portrait phone and two landscape phones.
  // The real embedded iframe must resize to every viewport, and six weapon
  // controls must stay separate without clipping the joystick or arena.
  for(const [width,height] of [[360,740],[667,375],[844,390]]){
   await host.setViewportSize({width,height});
   await host.waitForFunction(()=>{
    const frame=document.getElementById('livePvPFrame');
    const b=frame.getBoundingClientRect();
    return Math.abs(b.width-innerWidth)<4&&Math.abs(b.height-innerHeight)<4;
   },{timeout:15000});
   const layout=await inner.evaluate(()=>{
    const row=document.getElementById('cards');
    const els=[...row.querySelectorAll(':scope > button[data-slot]'),
     row.querySelector(':scope > .moji-ultimate-inline .ultimate-cast')];
    const boxes=els.map(e=>e?.getBoundingClientRect());
    const a=document.getElementById('moveZone').getBoundingClientRect();
    const b=document.getElementById('movePad').getBoundingClientRect();
    const arena=document.getElementById('arena').getBoundingClientRect();
    const overlaps=(x,y)=>Math.min(x.right,y.right)-Math.max(x.left,y.left)>2&&
     Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>2;
    return {width:innerWidth,height:innerHeight,num:els.length,
     separate:boxes.every((x,i)=>x&&boxes.slice(i+1).every(y=>y&&!overlaps(x,y))),
     aligned:Math.hypot(a.left+a.width/2-b.left-b.width/2,a.top+a.height/2-b.top-b.height/2)<2,
     allVisible:boxes.every(x=>x&&x.width>26&&x.left>=-2&&x.right<=innerWidth+2),
     arenaVisible:arena.width>180&&arena.height>90,
     noHorizontalOverflow:document.documentElement.scrollWidth<=innerWidth+3};
   });
   if(layout.num!==6||!layout.separate||!layout.aligned||!layout.allVisible||
      !layout.arenaVisible||!layout.noHorizontalOverflow)
    throw Error('Mobile final layout regression '+JSON.stringify(layout));
  }
  await guest.evaluate(()=>sock.close());
  await inner.waitForFunction(()=>roomState?.phase==='ended',{timeout:15000});
  await inner.locator('#onlineRematch').click();
  await inner.waitForFunction(()=>roomState?.phase==='lobby',{timeout:15000});
  await host.waitForFunction(()=>document.getElementById('livePvPFrame').getBoundingClientRect().width<500,{timeout:15000});
  const rematch=await inner.evaluate(()=>({code:roomState.code,phase:roomState.phase,editor:!!document.querySelector('#roomLoadoutMount #onlineGlyph0')}));
  if(rematch.code!==code||!rematch.editor)throw Error('reused room failed in embedded display '+JSON.stringify(rematch));
  if(errors.length)throw Error('embedded JS errors: '+errors.join('; '));
  console.log('LIVE EMBEDDED PVP PASSED: two mobile Chrome clients, CPU HUD, real WebSocket battle, portrait/landscape fullscreen, same-room replay.');
 }finally{await Promise.all(contexts.map(c=>c.close()));await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
