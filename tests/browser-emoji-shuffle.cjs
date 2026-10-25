// Real Chromium shared-lobby regression for emoji-only five-slot shuffle.
// Exercise normal/custom, old all-category button, and actual input listeners.
const {chromium}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8083';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.MojiStrokeReady,{timeout:20000});
  await page.locator('#playerName').fill('絵文字テスター');
  await page.locator('#enterLobby').click();
  await page.waitForSelector('#shuffleEmojiLoadout',{state:'visible',timeout:15000});
  const order=await page.evaluate(()=>{
   const bar=document.getElementById('mojiBulkRandomBar');
   const old=bar?.querySelector('#shuffleLoadout');
   const emoji=bar?.querySelector('#shuffleEmojiLoadout');
   return {both:!!(old&&emoji),adjacent:old?.nextElementSibling===emoji,
    within:emoji?.getBoundingClientRect().right<=innerWidth+2,
    label:emoji?.textContent};
  });
  if(!order.both||!order.adjacent||!order.within||!order.label.includes('絵文字5枠ランダム'))
   throw Error('Emoji shuffle must be next to the existing all-random button '+JSON.stringify(order));
  const roles=()=>page.locator('#setup .slot').evaluateAll(rows=>rows.map(row=>
   [...row.querySelectorAll('select')].map(select=>select.value)));
  const originalRoles=await roles();
  await page.locator('#loadoutPanel .ultimate-option[data-ultimate=slow]').click();
  const inspect=()=>page.evaluate(()=>{
   const fields=[...document.querySelectorAll('#setup .slot')].map(row=>({
    ch:row.querySelector('.kanji')?.value,
    n:Number(row.querySelector('.strokes')?.value),
    raw:row.querySelector('.strokes')?.value
   }));
   const seg=new Intl.Segmenter('ja',{granularity:'grapheme'});
   return {fields,unique:new Set(fields.map(x=>x.ch)).size,
    allEmoji:fields.every(x=>[...seg.segment(x.ch)].length===1 &&
     (/\p{Emoji_Presentation}/u.test(x.ch)||/\p{Extended_Pictographic}/u.test(x.ch))),
    ultimate:document.querySelector('#loadoutPanel .ultimate-option[aria-pressed=true]')?.dataset.ultimate,
    notice:document.getElementById('randomNotice')?.textContent};
  });
  await page.locator('#shuffleEmojiLoadout').click();
  let first=await inspect();
  if(first.unique!==5||!first.allEmoji||first.fields.some(x=>x.n!==5)||
     first.ultimate!=='slow'||!first.notice.includes('絵文字'))
   throw Error('Normal mode emoji-only shuffle failed '+JSON.stringify(first));
  if(JSON.stringify(originalRoles)!==JSON.stringify(await roles()))
   throw Error('Emoji shuffle changed weapon roles');
  await page.locator('#shuffleEmojiLoadout').click();
  const second=await inspect();
  if(second.unique!==5||!second.allEmoji||second.fields.some(x=>first.fields.some(y=>x.ch===y.ch)))
   throw Error('Repeated emoji shuffle did not generate five new unique glyphs '+JSON.stringify(second));
  await page.locator('[data-mode-tile="custom"]').click();
  await page.locator('#setup .slot').first().locator('.strokes').fill('27');
  await page.locator('#shuffleEmojiLoadout').click();
  const custom=await inspect();
  if(custom.unique!==5||!custom.allEmoji||custom.fields[0].n!==27||
     custom.ultimate!=='slow'||JSON.stringify(originalRoles)!==JSON.stringify(await roles()))
   throw Error('Custom emoji shuffle changed custom strokes, roles, or ultimate '+JSON.stringify(custom));
  await page.locator('[data-mode-tile="normal"]').click();
  await page.locator('#shuffleEmojiLoadout').click();
  const back=await inspect();
  if(back.fields.some(x=>x.n!==5))throw Error('Normal mode must restore emoji auto-strokes '+JSON.stringify(back));
  await page.locator('#shuffleLoadout').click();
  const all=await page.locator('#setup .slot .kanji').evaluateAll(fields=>fields.map(x=>x.value));
  if(all.length!==5||all.some(x=>!x))throw Error('Original all-category shuffle broke: '+JSON.stringify(all));
  if(errors.length)throw Error('Browser script error: '+errors.join('; '));
  console.log('LOBBY EMOJI SHUFFLE PASSED: two buttons, normal/custom, five distinct emoji, stroke values, unchanged roles/ultimate, old random control.');
 }finally{await page.close();await browser.close()}
})().catch(err=>{console.error(err);process.exit(1)});
