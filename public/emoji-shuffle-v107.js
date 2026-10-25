/* v10.7 — Emoji-only five-slot shuffle in the shared CPU/custom lobby.
   This adds a neighbor to the EXISTING all-category shuffle; no legacy
   button, role, ultimate, or matchmaking handler is replaced. */
(function(){
 'use strict';
 // Established single-grapheme emoji, avoiding unsupported/ambiguous flags
 // and Unicode sequences that may not be accepted by the battle server.
 const pool=[
  '🔥','⚡','🌸','👻','🐉','💥','🌊','❄️','🌙','⭐','🌈','🦊','💎','🍀','🎯',
  '🚀','🌀','💖','🎲','🌻','🦋','🐱','🐺','🍎','🍉','🍩','🎵','🎸','🎮','🏆',
  '🌋','🌟','💫','🌺','🐻','🐼','🐯','🦁','🦄','🐸','🐙','🦈','🦀','🐢','🦉',
  '🍁','🍓','🥑','🧀','🥐','🍕','🧁','🎃','🎁','🎈','🧩','🔮','💡','🔑','💣',
  '🧲','🪐','🛸','🌍','🌞','☔','⛄','⚽','🏀','🥇','🎭','🎨','🪩','🐬','🌵'
 ];
 const $=id=>document.getElementById(id);
 const chooseFive=previous=>{
  const candidates=pool.filter(ch=>!previous.has(ch));
  for(let i=candidates.length-1;i>0;i--){
   const j=Math.floor(Math.random()*(i+1));
   [candidates[i],candidates[j]]=[candidates[j],candidates[i]];
  }
  return candidates.slice(0,5);
 };
 function shuffleEmoji(){
  const rows=[...document.querySelectorAll('#lobbyScreen #setup .slot')];
  if(rows.length!==5 || rows.some(row=>!row.querySelector('input.kanji'))){
   const notice=$('randomNotice');
   if(notice)notice.textContent='5枠の武装欄を読み込めませんでした。ロビーを開き直してください。';
   return;
  }
  const previous=new Set(rows.map(row=>row.querySelector('.kanji').value));
  const chosen=chooseFive(previous);
  const mode=$('modeSelect')?.value||'normal';
  const custom=mode==='custom'||mode==='multiCustom';
  rows.forEach((row,i)=>{
   const glyph=row.querySelector('input.kanji'),strokes=row.querySelector('input.strokes');
   const oldStrokes=strokes?.value||'';
   glyph.value=chosen[i];
   // Let existing lobby listeners recalculate stroke counts and update
   // weapon previews, in the same way as typing in the glyph field.
   glyph.dispatchEvent(new Event('input',{bubbles:true}));
   glyph.dispatchEvent(new Event('change',{bubbles:true}));
   if(strokes){
    if(custom && oldStrokes.trim()){
     // Custom manually chosen power must survive randomizing the glyph.
     strokes.value=oldStrokes;
    }else{
     const measured=typeof getStrokeCount==='function'?getStrokeCount(chosen[i]):5;
     strokes.value=String(Number.isInteger(measured)&&measured>0?measured:5);
    }
    strokes.dispatchEvent(new Event('input',{bubbles:true}));
    strokes.dispatchEvent(new Event('change',{bubbles:true}));
   }
  });
  window.MojiWeaponVisual?.preMatchSolo?.();
  const notice=$('randomNotice');
  if(notice)notice.textContent='🎲 5枠をそれぞれ違う絵文字に変更しました。能力・必殺技はそのままです。';
 }
 function attach(){
  const lobby=$('lobbyScreen');
  const bar=lobby?.querySelector('#mojiBulkRandomBar');
  const all=bar?.querySelector('#shuffleLoadout');
  if(!all)return false;
  if($('shuffleEmojiLoadout'))return true;
  const button=document.createElement('button');
  button.id='shuffleEmojiLoadout';
  button.type='button';
  button.className=all.className;
  button.textContent='🎲 絵文字5枠ランダム';
  button.title='5枠を異なる絵文字でシャッフル（能力は変更しません）';
  button.setAttribute('aria-label','装備5枠の文字を絵文字だけでランダムに設定');
  button.addEventListener('click',shuffleEmoji);
  all.insertAdjacentElement('afterend',button);
  return true;
 }
 function init(){
  if(attach())return;
  const lobby=$('lobbyScreen');
  if(!lobby)return;
  const observer=new MutationObserver(()=>{
   if(attach())observer.disconnect();
  });
  observer.observe(lobby,{childList:true,subtree:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();
