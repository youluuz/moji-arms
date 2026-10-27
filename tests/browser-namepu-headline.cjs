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
  if(errors.length)throw Error('JavaScript page error: '+errors.join(' | '));
  console.log('PASS: four randomized Namepu headings, stable on redraw, champion and kill count');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
