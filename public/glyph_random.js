/* v6.9 - Fast, balanced Unicode glyph randomizer for CPU and online.
   Draw from wide Unicode categories lazily: no 100k-character startup scan. */
(function(){
'use strict';
const SEG=typeof Intl.Segmenter==='function'?new Intl.Segmenter('ja',{granularity:'grapheme'}):null;
const encoder=new TextEncoder();
const examples=['❤️','☄️','⚔️','🛡️','♨️','☺️','⭐','👨‍🚀','👩‍🚀','👩‍💻','👨‍👩‍👧','🏳️‍🌈','🇯🇵','🇺🇸','🌸','🔥','😂','💥','🌀','💎','🚀','🍙','🐱','🎯','👑','⚡','🌙','👻','🌊','🎲','🪄','💖'];
const byCategory={
 han:[[0x3400,0x4dbf],[0x4e00,0x9fff],[0x20000,0x2a6df],[0x2a700,0x2b73f],[0x2b740,0x2b81f],[0x2b820,0x2ceaf],[0x2ceb0,0x2ebef]],
 kana:[[0x3041,0x309f],[0x30a1,0x30ff],[0x31f0,0x31ff]],
 letters:[[0x41,0x5a],[0x61,0x7a],[0xc0,0x24f],[0x370,0x52f],[0x1e00,0x1eff],[0xac00,0xd7a3]],
 numbers:[[0x30,0x39],[0x660,0x669],[0x2460,0x24ff],[0xff10,0xff19]],
 symbols:[[0x21,0x2f],[0x3a,0x40],[0x5b,0x60],[0x7b,0x7e],[0x2000,0x27bf],[0x2900,0x2bff],[0xff01,0xff65]],
 emoji:[[0x1f300,0x1faff],[0x2600,0x27bf]]
};
const categories=Object.keys(byCategory);
// Prefer battle-worthy, higher-stroke Han while keeping all Unicode categories.
// Rebuild after the asynchronously-loaded 100k Unihan dictionary becomes available.
let poolsDirty=true, lastStrokeMap=null, hanPools={medium:[],high:[],extreme:[]};
function invalidateStrokePool(){poolsDirty=true;}
function weightedHanGlyph(){
 const map=window.MojiRandom?.strokeMap;
 if(!map)return null;
 if(poolsDirty||map!==lastStrokeMap){
  poolsDirty=false;lastStrokeMap=map;
  hanPools={medium:[],high:[],extreme:[]};
  for(const [ch,n] of Object.entries(map)){
   if(!Number.isInteger(n)||!safe(ch)||!/\p{Script=Han}/u.test(ch))continue;
   if(n>=45&&n<=84)hanPools.extreme.push(ch);
   else if(n>=28&&n<45)hanPools.high.push(ch);
   else if(n>=16&&n<28)hanPools.medium.push(ch);
  }
 }
 const n=Math.random(),key=n<.24?'extreme':n<.65?'high':'medium';
 const pool=hanPools[key].length?hanPools[key]:hanPools.high.length?hanPools.high:hanPools.medium;
 return pool.length?pool[integer(pool.length)]:null;
}
const safe=(s)=>{
 if(typeof s!=='string'||!s||/[\u0000-\u001f\u007f-\u009f\s]/u.test(s))return false;
 if(encoder.encode(s).length>64||Array.from(s).length>16)return false;
 if(!/[\p{Letter}\p{Number}\p{Symbol}\p{Punctuation}]/u.test(s))return false;
 return SEG?Array.from(SEG.segment(s)).length===1:Array.from(s).length===1;
};
const integer=n=>Math.floor(Math.random()*n);
function randomInRanges(ranges){
 const range=ranges[integer(ranges.length)];
 return String.fromCodePoint(range[0]+integer(range[1]-range[0]+1));
}
function categoryRoll(category){
 if(category==='emoji'&&integer(3)===0)return examples[integer(examples.length)];
 const candidate=randomInRanges(byCategory[category]);
 // Keep category distinctions useful and avoid unassigned Unicode code points.
 if(!safe(candidate))return null;
 if(category==='han'&&!/\p{Script=Han}/u.test(candidate))return null;
 if(category==='kana'&&!/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(candidate))return null;
 if(category==='letters'&&!/\p{Letter}/u.test(candidate))return null;
 if(category==='numbers'&&!/\p{Number}/u.test(candidate))return null;
 if(category==='symbols'&&!/[\p{Symbol}\p{Punctuation}]/u.test(candidate))return null;
 if(category==='emoji'&&!/\p{Emoji_Presentation}/u.test(candidate)&&!/\p{Extended_Pictographic}/u.test(candidate))return null;
 return candidate;
}
function roll(exclude=new Set()){
 for(let attempt=0;attempt<240;attempt++){
  // 45% Han overall. 75% of Han results favor 16+ strokes, including rare 45+.
  const category=Math.random()<.45?'han':categories[1+integer(categories.length-1)];
  const ch=category==='han'&&Math.random()<.75
    ?(weightedHanGlyph()||categoryRoll(category)):categoryRoll(category);
  if(ch&&!exclude.has(ch)&&(!window.MojiGlyphDisplay||window.MojiGlyphDisplay.randomizable(ch)))return ch;
 }
 for(const ch of examples)if(safe(ch)&&!exclude.has(ch)&&(!window.MojiGlyphDisplay||window.MojiGlyphDisplay.randomizable(ch)))return ch;
 return '火';
}
function sample(count=5){
 const seen=new Set(),out=[];
 for(let n=0;out.length<count&&n<count*50;n++){
  const c=roll(seen);if(seen.has(c))continue;seen.add(c);out.push(c);
 }
 return out;
}
// Legacy API compatibility: bounded display samples, not an eager enumeration.
let cachedPool;
function all(){
 if(cachedPool)return cachedPool;
 cachedPool=sample(240);
 for(const ch of examples)if(!cachedPool.includes(ch)&&(!window.MojiGlyphDisplay||window.MojiGlyphDisplay.randomizable(ch)))cachedPool.push(ch);
 return cachedPool;
}
window.MojiRandom={all,roll,sample,examples,categories,invalidateStrokePool};
// Shared-login invite flow: invitees start at the guest entrance, equip five glyphs
// in the common lobby, then choose "コードで参加". No standalone PvP splash.
const inviteCode=new URLSearchParams(location.search).get('room');
if(inviteCode&&/^[A-Z0-9]{6}$/i.test(inviteCode)){
 window.addEventListener('load',()=>{
  const enter=document.getElementById('enterLobby'),codeBox=document.getElementById('joinRoomCode');
  if(!enter||!codeBox)return; // Also loaded by the multiplayer iframe.
  const help=document.querySelector('#loginScreen .login-card p');
  if(help)help.textContent+=' 招待ルーム '+inviteCode.toUpperCase()+' への参加依頼が届いています。';
  enter.addEventListener('click',()=>{
   const mode=document.getElementById('modeSelect');
   mode.value='multi';mode.dispatchEvent(new Event('change',{bubbles:true}));
   codeBox.value=inviteCode.toUpperCase();
   const tip=document.getElementById('validation');
   if(tip)tip.textContent='招待ルーム '+inviteCode.toUpperCase()+'：武装5枠を決めて「コードで参加」を押してね。';
  });
 });
}

})();
