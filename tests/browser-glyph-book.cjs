// Real mobile Chrome: saved glyphs, one-tap copying, local account backups,
// hidden cyber outfit and oversized Namepu victory styling.
const {chromium}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8083';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true,permissions:['clipboard-read','clipboard-write']});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>!!window.MojiGlyphBook&&!!window.MojiDeveloperFX,{timeout:20000});
  await page.locator('#playerName').fill('保存テスト');
  await page.locator('#enterLobby').click();
  await page.locator('#appTabs [data-app-tab="glyphbook"]').click();
  if(!await page.locator('#mojiGlyphBookPanel').isVisible())throw Error('Glyph encyclopedia is not a separate tab');
  const saved=await page.evaluate(()=>{
   const book=window.MojiGlyphBook;
   book.record('龍','attack',16);book.record('龍','attack',16);
   book.record('🌸','heal',9);
   return {entries:book.entries(),stored:JSON.parse(localStorage.getItem('moji_glyph_book_v1'))};
  });
  if(saved.entries.length!==2||saved.entries.find(e=>e.ch==='龍')?.uses!==2)
   throw Error('Different actual glyphs or repetition count not stored '+JSON.stringify(saved));
  await page.locator('[aria-label="龍をコピー"]').click();
  const pasted=await page.evaluate(()=>navigator.clipboard.readText());
  if(pasted!=='龍')throw Error('Copied glyph content mismatch: '+pasted);
  const downloadPromise=page.waitForEvent('download');
  await page.locator('.moji-book-backup button').click();
  const download=await downloadPromise;
  if(!download.suggestedFilename().endsWith('.json'))throw Error('Personal backup is not JSON');
  const backup=await page.evaluate(()=>({
   app:'moji-arms',version:1,
   values:{'moji_glyph_book_v1':localStorage.getItem('moji_glyph_book_v1'),
    'moji_arena_player_name':localStorage.getItem('moji_arena_player_name')}
  }));
  await page.evaluate(()=>localStorage.removeItem('moji_glyph_book_v1'));
  await page.locator('.moji-book-import input').setInputFiles({
   name:'save.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))
  });
  await page.waitForFunction(()=>window.MojiGlyphBook.entries().length===2,{timeout:7000});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.MojiGlyphBook,{timeout:15000});
  if(await page.locator('#playerName').inputValue()!=='保存テスト')
   throw Error('Saved player nickname missing after reload');
  await page.locator('#enterLobby').click();
  await page.locator('#appTabs [data-app-tab="glyphbook"]').click();
  if(await page.locator('#mojiGlyphBookGrid .moji-glyph-book-card').count()!==2)
   throw Error('Personal glyph collection lost on reload');
  await page.locator('#appTabs [data-app-tab="achievements"]').click();
  await page.locator('#secretInput').fill('effect_developeronlyH17');
  await page.locator('#secretApply').click();
  const hidden=await page.evaluate(()=>{
   const item=localStorage.getItem('moji_developer_effect_v1');
   const canvas=document.createElement('canvas');canvas.width=130;canvas.height=130;
   const c=canvas.getContext('2d');c.translate(65,65);
   window.MojiDeveloperFX.paint(c,1.5);
   const pixel=c.getImageData(0,0,130,130).data;let visible=0;
   for(let i=3;i<pixel.length;i+=4)if(pixel[i]>70)visible++;
   return {stored:item,active:window.MojiDeveloperFX.active(),visible,
    listed:document.querySelector('#collection')?.textContent?.includes('CYBER WINGS')};
  });
  if(!hidden.active||hidden.visible<60||hidden.listed)
   throw Error('Black cyan eyewear or small mech wings absent/visible in the public item list '+JSON.stringify(hidden));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.MojiDeveloperFX,{timeout:15000});
  if(!await page.evaluate(()=>window.MojiDeveloperFX.active()))
   throw Error('Developer-only cosmetic did not survive browser refresh');
  if(errors.length)throw Error('Page JavaScript errors: '+errors.join('; '));
  console.log('GLYPH BOOK + BACKUP + CYBER FX PASSED: mobile, Unicode copy, save, import, reload and secret toggle.');
 }finally{await ctx.close();await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
