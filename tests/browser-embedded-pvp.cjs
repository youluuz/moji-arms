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
  if(await inner.locator('#cards .weapon').count()!==5||!await inner.locator('#enemyBar').isVisible())
   throw Error('actual embedded online match has not adopted CPU five-card / dual-HP HUD');
  await host.setViewportSize({width:844,height:390});
  await host.waitForFunction(()=>{
   const r=document.getElementById('livePvPFrame').getBoundingClientRect();
   return Math.abs(r.width-innerWidth)<4&&Math.abs(r.height-innerHeight)<4;
  },{timeout:15000});
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
