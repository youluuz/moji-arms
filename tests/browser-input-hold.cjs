// Real Chrome regression: held fire and movement must stop when released,
// cancelled, or interrupted. The legacy CPU client uses a deferred input guard.
const {chromium}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8083';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1100,height:760}});const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 try {
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>!!window.MojiInputSafety&&!!window.MojiStrokeReady,{timeout:18000});
  await page.locator('#playerName').fill('入力解除テスト');
  await page.locator('#enterLobby').click();
  await page.waitForSelector('#loadoutPanel .ultimate-option',{timeout:15000});
  await page.locator('[data-mode-tile="normal"]').click();
  await page.locator('#shuffleLoadout').click();
  await page.locator('#start').click();
  await page.waitForFunction(()=>document.body.classList.contains('in-match')&&typeof player==='object'&&!!player,{timeout:15000});
  const box=await page.locator('#field').boundingBox();
  if(!box||box.width<100||box.height<100)throw Error('Canvas not visible');
  await page.mouse.move(box.x+box.width*.65,box.y+box.height*.48);
  await page.mouse.down();
  await page.waitForFunction(()=>window.MojiInputSafety.firingPointers()===1 && down===true);
  await page.mouse.move(box.x+5,box.y+8);
  await page.mouse.up();
  await page.waitForFunction(()=>window.MojiInputSafety.firingPointers()===0 && down===false);

  await page.keyboard.down('w');
  await page.waitForFunction(()=>keys.w===true);
  await page.keyboard.up('w');
  await page.waitForFunction(()=>keys.w===false);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(()=>keys.ArrowRight===true);
  await page.keyboard.up('ArrowRight');
  await page.waitForFunction(()=>keys.ArrowRight===false && keys.d!==true);

  await page.mouse.move(box.x+box.width*.65,box.y+box.height*.5);
  await page.mouse.down();
  await page.waitForFunction(()=>window.MojiInputSafety.firingPointers()>0 && down);
  await page.keyboard.down('d');
  await page.waitForFunction(()=>keys.d);
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(()=>!down && !keys.d && window.MojiInputSafety.firingPointers()===0);
  await page.keyboard.up('d');
  await page.mouse.up();

  // Test the explicit cancellation branch even when no mouseup arrives.
  await page.mouse.down();
  await page.waitForFunction(()=>window.MojiInputSafety.firingPointers()===1);
  await page.evaluate(()=>{
   const id=1; // Chrome's primary mouse pointer
   window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:id,pointerType:'mouse'}));
  });
  await page.waitForFunction(()=>window.MojiInputSafety.firingPointers()===0 && !down);
  await page.mouse.up();
  if(errors.length)throw Error('Page errors '+errors.join(' | '));
  console.log('PASS: actual Chrome hold-to-fire, release, keyboard keyup, blur and pointercancel reset controls');
 } finally {await page.close();await browser.close();}
})().catch(err=>{console.error(err);process.exit(1)});
