/* v10.6 - Keep blank login loadouts, but make the room button truly one-click.
   A draft is only supplied when the user actually requests online entry.
   The waiting room always allows replacing these five temporary glyphs. */
(function(){
 'use strict';
 const defaults=[['火',4],['水',4],['木',4],['金',8],['土',3]];
 function primeDraft(){
  const rows=[...document.querySelectorAll('#setup .slot')];
  if(rows.length!==defaults.length)return;
  const filled=[];
  for(let i=0;i<rows.length;i++){
   const glyph=rows[i].querySelector('.kanji');
   if(!glyph||glyph.value.trim())continue;
   const strokes=rows[i].querySelector('.strokes');
   glyph.value=defaults[i][0];
   if(strokes)strokes.value=String(defaults[i][1]);
   glyph.dispatchEvent(new Event('input',{bubbles:true}));
   filled.push(i+1);
  }
  if(!filled.length)return;
  try{sessionStorage.setItem('moji_room_autoequip','1')}catch(_){}
  const note=document.getElementById('randomNotice');
  if(note)note.textContent='🔗 空欄の'+filled.length+'枠には仮装備を設定しました。ルーム待機室で自由に編集できます。';
 }
 const button=document.getElementById('createRoomNow');
 // Capture before the legacy click handler checks for required slots. Its
 // original validation still rejects malformed or out-of-range user input.
 if(button)button.addEventListener('click',primeDraft,true);
})();