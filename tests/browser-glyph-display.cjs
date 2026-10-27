// Render regression: random glyphs must be legible on supported platforms,
// and an absent character must show its Unicode codepoint instead of tofu.
const {chromium}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8083';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 try{
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>!!window.MojiGlyphDisplay&&!!window.MojiRandom,{timeout:15000});
  const result=await page.evaluate(()=>{
   const api=window.MojiGlyphDisplay;
   const checks={};
   checks.glyphNative=api.supported('A');
   checks.invalid=api.supported('\u0378');
   checks.label=api.readable('\u{10FFFF}');
   checks.fonts=api.fonts;
   const canvas=document.createElement('canvas');canvas.width=120;canvas.height=80;const c=canvas.getContext('2d');
   c.font='900 24px sans-serif';c.fillStyle='#fff';
   api.draw(c,'\u{10FFFF}',60,40,110);
   const ink=c.getImageData(0,0,120,80).data;
   checks.visible=ink.some((v,i)=>i%4===3&&v>25);
   const samples=window.MojiRandom.sample(35);
   checks.sampleCount=samples.length;
   checks.invalidSamples=samples.filter(ch=>!api.randomizable(ch));
   return checks;
  });
  if(!result.glyphNative||result.invalid||!result.label.includes('10FFFF')||!result.visible||
     result.sampleCount!==35||result.invalidSamples.length)
     throw Error('Unrenderable glyph regression '+JSON.stringify(result));
  console.log('GLYPH DISPLAY PASS',JSON.stringify(result));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
