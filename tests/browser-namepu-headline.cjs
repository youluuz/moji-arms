// Deterministic Chromium check: random win slogans stay fixed throughout a result.
const {chromium}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8083';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1140,height:790}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.goto(base+'/namepu-victory-preview.html',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>!!document.querySelector('.namepu-champion'));
  const result=await page.evaluate(()=>{
   const overlay=document.getElementById('result');
   const info={name:'勝利プレイヤー',icon:'龍',kills:4,hp:480};
   const headline=()=>document.getElementById('resultTitle').textContent;
   const reset=()=>{window.MojiNamepuVictory.stop();overlay.classList.remove('moji-namepu-deluxe');overlay.querySelector('.namepu-champion')?.remove()};
   const before=Math.random,examples=[];
   for(const value of [.001,.22,.58,.999]){
    reset();Math.random=()=>value;window.MojiNamepuVictory.showSolo(info);
    const first=headline();window.MojiNamepuVictory.showSolo(info);
    if(headline()!==first)throw Error('Result headline changed during second draw');
    examples.push(first);
   }
   Math.random=before;
   return {examples,winner:overlay.querySelector('.namepu-player-name')?.textContent,
      kills:overlay.querySelector('.namepu-victory-stats')?.textContent,
      fanfare:typeof window.MojiNamepuVictory.playFanfare==='function'};
  });
  if(new Set(result.examples).size!==4||result.examples.some(s=>s.includes('ナメプ完全勝利'))||
    result.winner!=='勝利プレイヤー'||!result.kills?.includes('4 KILLS')||!result.fanfare)
    throw Error('Namepu winner regression '+JSON.stringify(result));

  // Reproduce the reported 807x740 narrow-column win screenshot and mobile
  // landscape. The medal must occupy the full result card, not the hero grid
  // cell, even after repeated renders or an old misplaced DOM node.
  for(const [width,height] of [[1140,790],[807,740],[390,844],[844,390]]){
   await page.setViewportSize({width,height});
   await page.evaluate(()=>window.MojiNamepuVictory.showSolo({name:'勝利プレイヤー',icon:'龍',kills:4,hp:480}));
   const layout=await page.evaluate(()=>{
    const overlay=document.getElementById('result');
    const box=overlay?.querySelector('.result-inner');
    const medal=box?.querySelector('.namepu-champion');
    const br=box?.getBoundingClientRect(),mr=medal?.getBoundingClientRect();
    return {parent:medal?.parentElement===box,boxWidth:br?.width,medalWidth:mr?.width,
      boxLeft:br?.left,boxRight:br?.right,screenWidth:innerWidth,
      scrollHeight:box?.scrollHeight,clientHeight:box?.clientHeight};
   });
   if(!layout.parent||layout.boxWidth<width*.65||layout.medalWidth<layout.boxWidth*.75||
      layout.boxLeft<-3||layout.boxRight>width+3)
    throw Error('Namepu result squeezed to narrow hero column '+width+'x'+height+' '+JSON.stringify(layout));
  }
  // A legacy callback can put the victory panel under .result-message. A
  // repeated show must restore it to a direct child of the wide result card.
  await page.evaluate(()=>{
   const box=document.querySelector('#result .result-inner');
   const hero=box?.querySelector('.result-message');
   const medal=box?.querySelector('.namepu-champion');
   if(!hero||!medal)throw Error('Namepu regression preview lacks hero/medal');
   hero.appendChild(medal);
   window.MojiNamepuVictory.showSolo({name:'勝利プレイヤー',icon:'龍',kills:4,hp:480});
   if(medal.parentElement!==box)throw Error('Old narrow hero panel was not repaired');
  });
  if(errors.length)throw Error('JavaScript page error: '+errors.join(' | '));
  console.log('PASS: four randomized Namepu headings, stable on redraw, champion and kill count');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
