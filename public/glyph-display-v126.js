/* v12.6 — Show actual glyphs when fonts contain them; never let random
 * unsupported Unicode become a tofu square or X on phones.
 * Visual fallback uses codepoint text without changing the battle glyph/HP.
 */
(function(){
 'use strict';
 const fonts='"Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic","Meiryo","Noto Sans JP","Noto Sans CJK JP","Arial Unicode MS","Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
 const cache=new Map();
 const canvas=document.createElement('canvas');
 canvas.width=88;canvas.height=64;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 function mark(text){
  if(!ctx)return null;
  ctx.clearRect(0,0,88,64);ctx.fillStyle='#fff';
  ctx.font='900 39px '+fonts;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(text,44,32,80);
  const px=ctx.getImageData(0,0,88,64).data;
  let count=0,hash=2166136261;
  for(let i=3;i<px.length;i+=4){
   const a=px[i];if(a>16)count++;
   hash=Math.imul(hash^a,16777619);
  }
  return count+'-'+(hash>>>0);
 }
 const blanks=[mark('\u0378'),mark('\u{10ffff}'),mark('\uffff')];
 function supported(ch){
  ch=String(ch||'');
  if(!ch)return false;
  if(cache.has(ch))return cache.get(ch);
  // No canvas? Fall back to the browser's usual font shaping.
  let ok=!!ctx;
  if(ctx){
   const sig=mark(ch);
   ok=!!sig&&!sig.startsWith('0-')&&!blanks.includes(sig);
  }
  // Limit cache growth when one player repeatedly shuffles huge Unicode pools.
  if(cache.size>4096)cache.clear();
  cache.set(ch,ok);
  return ok;
 }
 // Preserve the full game character repertoire in browsers with no Japanese font
 // at all (e.g., bare Linux Chromium). Canvas rendering still shows a readable
 // Unicode label there; on normal Japanese-capable devices, unsupported rare
 // glyphs are excluded from random draws.
 function randomizable(ch){
  ch=String(ch||'');
  if(/\p{Script=Han}/u.test(ch)&&!supported('漢'))return true;
  return supported(ch);
 }
 function readable(ch){
  ch=String(ch||'文');
  if(supported(ch))return ch;
  // U+XXXX is universally readable even when the glyph's font is missing.
  const points=Array.from(ch).filter(c=>c.codePointAt(0)!==0xfe0f&&c.codePointAt(0)!==0x200d)
   .map(c=>c.codePointAt(0).toString(16).toUpperCase());
  return points.length?'U+'+points.join('+'):'文';
 }
 function draw(ctx,ch,x,y,maxWidth){
  if(!ctx)return;
  ch=String(ch||'文');
  const ok=supported(ch);
  ctx.save();
  if(ok){
   // Honor the caller's requested size/weight; only enrich fallback fonts.
   const current=ctx.font;
   const size=current.match(/\d+(?:\.\d+)?px/)?.[0]||'24px';
   const weight=/\b(900|800|700|bold|bolder)\b/.test(current)?'900':'600';
   ctx.font=weight+' '+size+' '+fonts;
   if(maxWidth)ctx.fillText(ch,x,y,maxWidth);else ctx.fillText(ch,x,y);
  }else{
   const size=ctx.font.match(/\d+(?:\.\d+)?px/)?.[0]||'24px';
   const px=Math.max(7,Math.min(12,Math.round(parseFloat(size)*.42)));
   ctx.font='800 '+px+'px system-ui,Arial,sans-serif';
   if(maxWidth)ctx.fillText(readable(ch),x,y,maxWidth);else ctx.fillText(readable(ch),x,y);
  }
  ctx.restore();
 }
 window.MojiGlyphDisplay={fonts,supported,randomizable,readable,draw};
})();
