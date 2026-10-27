// Real two-tab regression: opening the generated invite through the shared
// login must join the waiting room even when the guest has zero saved weapons.
const {chromium}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8083';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
 const contexts=await Promise.all([0,1].map(()=>browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})));
 const errors=[];
 try{
  const [host,guest]=await Promise.all(contexts.map(c=>c.newPage()));
  for(const p of [host,guest])p.on('pageerror',e=>errors.push(String(e)));
  await host.goto(base+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await host.waitForFunction(()=>!!window.MojiStrokeReady,{timeout:20000});
  await host.locator('#playerName').fill('作成者');
  await host.locator('#enterLobby').click();
  // How-to is its own first-class tab, not buried in the weapon details.
  await host.locator('#appTabs [data-app-tab="guide"]').click();
  if(!await host.locator('#mojiGuidePanel').isVisible()||
     !(await host.locator('#mojiGuidePanel').innerText()).includes('ホーミング'))
   throw Error('How-to tab not accessible from the game top navigation');
  await host.locator('#appTabs [data-app-tab="play"]').click();
  const blanks=await host.locator('#setup .slot .kanji').evaluateAll(nodes=>nodes.map(el=>el.value));
  if(blanks.length!==5||blanks.some(Boolean))throw Error('Expected initially blank host equipment');
  await host.locator('#createRoomNow').click();
  await host.waitForFunction(()=>{
   const doc=document.getElementById('onlineFrame')?.contentDocument;
   return doc?.getElementById('waitArea')?.style.display==='block' &&
    /^[A-Z0-9]{6}$/.test(doc.getElementById('code')?.textContent||'');
  },{timeout:18000});
  // Edit ornaments in the real common collection UI without disconnecting
  // from the current online waiting room.
  await host.frameLocator('#onlineFrame').locator('#mojiRoomLocker').click();
  await host.locator('#mojiRoomLockerOverlay:not([hidden])').waitFor();
  const locker=await host.evaluate(()=>({
   inOverlay:document.querySelector('#mojiRoomLockerOverlay #collectionPanel')!==null,
   code:document.getElementById('onlineFrame')?.contentDocument?.getElementById('code')?.textContent,
   socket:document.getElementById('onlineFrame')?.contentWindow?.sock?.readyState,
  }));
  if(!locker.inOverlay||!/^[A-Z0-9]{6}$/.test(locker.code||'')||locker.socket!==1)
   throw Error('In-room locker disconnected the live waiting room '+JSON.stringify(locker));
  await host.locator('#mojiRoomLockerClose').click();
  if(await host.locator('#mojiRoomLockerOverlay').isVisible())
   throw Error('Room locker did not close');
  const invite=await host.evaluate(()=>document.getElementById('onlineFrame').contentDocument.getElementById('inviteUrl').value);
  const url=new URL(invite);
  if(url.pathname!=='/index.html'||!/^[A-Z0-9]{6}$/.test(url.searchParams.get('room')||''))
   throw Error('Bad invite URL '+invite);
  await guest.goto(invite,{waitUntil:'domcontentloaded',timeout:45000});
  await guest.locator('#playerName').fill('招待客');
  await guest.locator('#enterLobby').click();
  await guest.waitForFunction(()=>{
   const frame=document.getElementById('onlineFrame');
   return frame?.getAttribute('src')?.includes('auto=join') &&
    frame?.getAttribute('src')?.includes('room=');
  },{timeout:9000});
  await guest.waitForFunction(()=>{
   const doc=document.getElementById('onlineFrame')?.contentDocument;
   return doc?.getElementById('waitArea')?.style.display==='block' &&
    doc.getElementById('roster')?.textContent?.includes('作成者') &&
    doc.getElementById('roster')?.textContent?.includes('招待客');
  },{timeout:18000});
  await host.waitForFunction(()=>{
   const doc=document.getElementById('onlineFrame')?.contentDocument;
   return doc?.getElementById('roster')?.textContent?.includes('招待客');
  },{timeout:10000});
  const state=await guest.evaluate(()=>{
   const doc=document.getElementById('onlineFrame').contentDocument;
   return {notice:doc.getElementById('roomEditStatus').textContent,
    slots:[...doc.querySelectorAll('#roomLoadoutMount .online-glyph-input')].map(el=>el.value)};
  });
  if(state.slots.join('')!=='火水木金土'||!state.notice.includes('仮装備'))
   throw Error('Guest temporary loadout was not available to edit: '+JSON.stringify(state));
  // Minor regression: returning while the battle iframe is fullscreen
  // must restore the shared lobby's scrolling and normal layout.
  await host.frameLocator('#onlineFrame').locator('#begin').click();
  await host.waitForFunction(()=>{
   const doc=document.getElementById('onlineFrame')?.contentDocument;
   return doc?.getElementById('gameArea')?.style.display==='flex' &&
    document.body.style.overflow==='hidden';
  },{timeout:20000});
  await host.frameLocator('#onlineFrame').locator('#onlineBattleBack').click();
  await host.waitForFunction(()=>
   !document.getElementById('onlineScreen').classList.contains('active') &&
   document.body.style.overflow!=='hidden' &&
   document.documentElement.style.overflow!=='hidden'
  ,{timeout:12000});
  // Both participants voluntarily leave; the now-empty PRIVATE room must
  // remain joinable so a refresh or return-to-lobby doesn't lose the code.
  await guest.frameLocator('#onlineFrame').locator('#onlineBattleBack').click();
  await guest.waitForFunction(()=>!document.getElementById('onlineScreen').classList.contains('active'),{timeout:12000});
  await host.locator('#mojiRejoinRoom').waitFor({state:'visible',timeout:9000});
  const saved=await host.evaluate(()=>localStorage.getItem('moji_last_room'));
  if(saved!==url.searchParams.get('room'))throw Error('Last room code not retained '+saved);
  await host.locator('#mojiRejoinRoom').click();
  await host.waitForFunction(()=>{
   const d=document.getElementById('onlineFrame')?.contentDocument;
   return d?.getElementById('waitArea')?.style.display==='block' &&
     d.getElementById('code')?.textContent?.trim()===localStorage.getItem('moji_last_room');
  },{timeout:16000});
  if(errors.length)throw Error('Browser errors: '+errors.join('; '));
  console.log('INVITE ROOM REGRESSION PASSED: empty host -> one-click room -> blank guest via shared login -> both present in real websocket lobby.');
 }finally{await Promise.all(contexts.map(c=>c.close()));await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
