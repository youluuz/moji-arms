// Compare the SAME live CPU battle with and without the mobile enlargement
// stylesheet. The extra height must go to the map, not an overlapping HUD.
// The online integration is also checked in browser-embedded-pvp.cjs.
const {chromium}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8083';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
 const page=await context.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>!!window.MojiUlt&&!!window.MojiStrokeReady,{timeout:15000});
  await page.locator('#playerName').fill('スマホ拡大テスト');
  await page.locator('#enterLobby').click();
  await page.waitForSelector('#loadoutPanel .ultimate-option',{timeout:15000});
  await page.locator('[data-mode-tile="normal"]').click();
  await page.locator('#cpuBotCount').selectOption('3');
  await page.locator('#shuffleLoadout').click();
  await page.locator('#start').click();
  await page.waitForSelector('#gameScreen.active .weapon',{timeout:18000});
  await page.waitForFunction(()=>document.body.classList.contains('in-match')&&document.querySelector('#gameScreen .moji-stick-dock')?.getBoundingClientRect().height>20,{timeout:15000});
  async function measure(enabled){
   return page.evaluate(async enabled=>{
    const sheet=[...document.querySelectorAll('link[rel=stylesheet]')].find(x=>x.href.includes('mobile-battle-expansion-v125.css'));
    if(!sheet)throw Error('Mobile expansion stylesheet not loaded');
    sheet.disabled=!enabled;
    // The CPU camera's resize handler runs asynchronously after style changes.
    // Wait for the canvas to catch up, not just for CSS box reflow.
    window.dispatchEvent(new Event('resize'));
    await new Promise(resolve=>setTimeout(resolve,220));
    const rect=q=>{const e=document.querySelector(q);if(!e)return null;const b=e.getBoundingClientRect();return{x:b.x,y:b.y,left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height}};
    const map=rect('#gameScreen .arena-shell'),canvas=rect('#field'),stick=rect('#gameScreen .moji-stick-dock');
    const row=rect('#gameScreen #weapons'),abilities=[...document.querySelectorAll('#gameScreen #weapons .weapon')];
    const cast=document.querySelector('#gameScreen #weapons .ultimate-cast');
    const rects=[...abilities,cast].map(e=>{const b=e.getBoundingClientRect();return{left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height}});
    const overlap=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2;
    return{map,canvas,stick,row,rects,
      title:document.title,orientation:innerWidth>innerHeight,
      howto:getComputedStyle(document.querySelector('#gameScreen .moji-battle-howto')).display,
      allVisible:rects.length===6&&rects.every(x=>x.width>25&&x.height>30&&x.left>=-2&&x.right<=innerWidth+2&&x.bottom<=innerHeight+2),
      separate:rects.every((x,i)=>rects.slice(i+1).every(y=>!overlap(x,y))),
      noHorizontalOverflow:document.documentElement.scrollWidth<=innerWidth+3
    };
   },enabled);
  }
  const before=await measure(false),after=await measure(true);
  console.log('CPU LANDSCAPE BASELINE',JSON.stringify(before));
  console.log('CPU LANDSCAPE EXPANDED',JSON.stringify(after));
  if(!after.orientation||!after.map||!after.canvas||!after.row||!after.stick||
     after.map.height<before.map.height+12||after.canvas.height<before.canvas.height+8||
     after.howto!=='none'||!after.allVisible||!after.separate||!after.noHorizontalOverflow||
     after.stick.right>after.map.left+3)
    throw Error('Landscape expansion did not allocate more visible map height without clipping controls');
  await page.setViewportSize({width:390,height:844});
  const portrait=await measure(true);
  if(!portrait.map||portrait.map.width<190||portrait.map.height<110||
    !portrait.allVisible||!portrait.separate||!portrait.noHorizontalOverflow)
    throw Error('Portrait battle controls or arena regressed '+JSON.stringify(portrait));
  if(errors.length)throw Error('JS errors '+errors.join(' | '));
  console.log('PASS: mobile arena grows in landscape, six controls stay usable, portrait retains battle');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
