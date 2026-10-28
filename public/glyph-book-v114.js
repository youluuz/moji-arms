/* v11.4: Real per-cast glyph encyclopedia and browser-local player backup. */
(function(){
 'use strict';
 const STORE='moji_glyph_book_v1';
 const CODE='effect_developeronlyH17';
 const $=id=>document.getElementById(id);
 const split=ch=>{if(typeof Intl.Segmenter==='function')return [...new Intl.Segmenter('ja',{granularity:'grapheme'}).segment(ch)].map(x=>x.segment);return Array.from(ch)};
 function load(){
  try{const v=JSON.parse(localStorage.getItem(STORE));return Array.isArray(v)?v.filter(x=>x&&typeof x.ch==='string'&&split(x.ch).length===1).slice(0,600):[]}
  catch(_){return []}
 }
 let entries=load();
 const SORT_STORE='moji_glyph_sort_v1';
 const options=new Set(['last','uses','strokes','kana','type']);
 let sortKey='last',direction='desc';
 try{const saved=JSON.parse(localStorage.getItem(SORT_STORE)||'{}');if(options.has(saved.sortKey))sortKey=saved.sortKey;if(['asc','desc'].includes(saved.direction))direction=saved.direction}catch(_){}
 const collator=new Intl.Collator('ja',{numeric:true,sensitivity:'base'});
 const typeOf=ch=>{
  if(/\p{Extended_Pictographic}/u.test(ch))return '絵文字';
  if(/\p{Script=Han}/u.test(ch))return '漢字';
  if(/\p{Script=Hiragana}/u.test(ch))return 'ひらがな';
  if(/\p{Script=Katakana}/u.test(ch))return 'カタカナ';
  if(/[a-zA-Z]/.test(ch))return '英字';
  if(/[0-9０-９]/.test(ch))return '数字';
  return '記号・その他';
 };
 const types=['ひらがな','カタカナ','漢字','英字','数字','記号・その他','絵文字'];
 const order=()=>entries.slice().sort((a,b)=>{
  let compare=0;
  if(sortKey==='last')compare=(a.last||0)-(b.last||0);
  else if(sortKey==='uses')compare=(a.uses||0)-(b.uses||0);
  else if(sortKey==='strokes')compare=(a.n||0)-(b.n||0);
  else if(sortKey==='kana')compare=collator.compare(a.ch,b.ch);
  else if(sortKey==='type')compare=types.indexOf(typeOf(a.ch))-types.indexOf(typeOf(b.ch));
  return (direction==='desc'?-1:1)*compare||collator.compare(a.ch,b.ch);
 });
 const saveSort=()=>{try{localStorage.setItem(SORT_STORE,JSON.stringify({sortKey,direction}))}catch(_){}};

 function render(){
  const grid=$('mojiGlyphBookGrid'),count=$('mojiGlyphBookCount');
  if(!grid)return;
  if(count)count.textContent=String(entries.length);
  grid.replaceChildren();
  if(!entries.length){const tip=document.createElement('p');tip.className='moji-book-empty';tip.textContent='まだ記録がありません。試合で文字の武装を使うと自動で登録されます。';grid.append(tip);return}
  for(const item of order()){
   const card=document.createElement('article');card.className='moji-glyph-book-card';
   const glyph=document.createElement('strong');glyph.className='moji-book-glyph';glyph.textContent=item.ch;
   const meta=document.createElement('div');meta.className='moji-book-meta';
   const countLine=document.createElement('span');countLine.textContent='使用 '+(item.uses||1)+'回';
   const names={attack:'通常攻撃',defense:'防御',heal:'回復',pierce:'貫通',homing:'ホーミング'};
   const role=document.createElement('small');role.textContent=(names[item.kind]||'武装')+(item.n?'・'+item.n+'画':'');
   meta.append(countLine,role);
   const copy=document.createElement('button');copy.type='button';copy.className='moji-book-copy';copy.textContent='コピー';copy.setAttribute('aria-label',item.ch+'をコピー');
   copy.onclick=async()=>{
    let ok=false;
    try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(item.ch);ok=true}}catch(_){}
    if(!ok){const t=document.createElement('textarea');t.value=item.ch;t.setAttribute('readonly','');t.style.cssText='position:fixed;left:-9999px;top:0';document.body.append(t);t.select();try{ok=document.execCommand('copy')}catch(_){}t.remove()}
    copy.textContent=ok?'コピーしました ✓':'コピーできません';$('mojiBookStatus').textContent=ok?item.ch+' をコピーしました':'長押しで文字をコピーしてください';
    if(!ok){const select=document.createElement('input');select.value=item.ch;select.readOnly=true;select.className='moji-book-manual';card.append(select);select.focus();select.select()}
   };
   card.append(glyph,meta,copy);grid.append(card);
  }
 }
 function record(ch,kind,n){
  ch=String(ch||'').trim();
  if(!ch||ch.length>32||split(ch).length!==1)return false;
  const found=entries.find(x=>x.ch===ch);
  if(found){found.uses=(found.uses||0)+1;found.last=Date.now();found.kind=kind||found.kind;found.n=Number(n)||found.n}
  else {entries.push({ch,kind:String(kind||'attack'),n:Number(n)||0,uses:1,last:Date.now()});if(entries.length>600)entries=order().slice(0,600)}
  try{localStorage.setItem(STORE,JSON.stringify(entries))}catch(_){$('mojiBookStatus')&&($('mojiBookStatus').textContent='保存が制限されています')}
  const counter=$('mojiGlyphBookCount');if(counter)counter.textContent=String(entries.length);
  // Game casts can be frequent. Avoid rebuilding hundreds of cards while
  // a match is running; update once when the encyclopedia tab opens.
  if($('lobbyScreen')?.dataset.view==='glyphbook')render();
  return true;
 }
 function init(){
  const lobby=$('lobbyScreen'),tabs=$('appTabs');
  if(!lobby||!tabs||$('mojiGlyphBookPanel'))return;
  if(typeof APP_SCREENS!=='undefined')APP_SCREENS.glyphbook='lobby';
  const btn=document.createElement('button');btn.type='button';btn.dataset.appTab='glyphbook';btn.innerHTML='<span>字</span> 文字図鑑';
  btn.onclick=()=>{switchAppTab('glyphbook');render()};tabs.insertBefore(btn,tabs.querySelector('[data-app-tab="guide"]'));
  const panel=document.createElement('section');panel.id='mojiGlyphBookPanel';panel.className='panel moji-glyph-book-panel';
  const heading=document.createElement('h2');heading.textContent='字｜文字図鑑';
  const sub=document.createElement('p');sub.textContent='対戦で実際に発動した文字を自動収集。タップで1文字ずつコピーできます。';
  const counter=document.createElement('p');counter.className='moji-book-count';counter.innerHTML='登録済み <strong id="mojiGlyphBookCount">0</strong> 文字';
  const sortBar=document.createElement('div');sortBar.className='moji-book-sort-controls';
  const sortLabel=document.createElement('label');sortLabel.textContent='並び替え';
  const sortSelect=document.createElement('select');sortSelect.id='mojiBookSort';sortSelect.setAttribute('aria-label','文字図鑑の並び替え項目');
  for(const [value,label] of [['last','最近使った順'],['uses','使用回数'],['strokes','画数'],['kana','あいうえお順'],['type','文字の種類']]){
   const op=document.createElement('option');op.value=value;op.textContent=label;sortSelect.append(op);
  }
  const dirLabel=document.createElement('label');dirLabel.textContent='順序';
  const dirSelect=document.createElement('select');dirSelect.id='mojiBookDirection';dirSelect.setAttribute('aria-label','図鑑の昇順・降順');
  for(const [value,label] of [['asc','昇順'],['desc','降順']]){const op=document.createElement('option');op.value=value;op.textContent=label;dirSelect.append(op)}
  sortSelect.value=sortKey;dirSelect.value=direction;
  sortSelect.onchange=()=>{sortKey=sortSelect.value;saveSort();render()};
  dirSelect.onchange=()=>{direction=dirSelect.value;saveSort();render()};
  sortLabel.append(sortSelect);dirLabel.append(dirSelect);sortBar.append(sortLabel,dirLabel);
  const status=document.createElement('p');status.id='mojiBookStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const grid=document.createElement('div');grid.id='mojiGlyphBookGrid';grid.className='moji-glyph-book-grid';
  const backup=document.createElement('section');backup.className='moji-book-backup';
  const backupTitle=document.createElement('h3');backupTitle.textContent='プレイヤーデータを保存・引き継ぎ';
  const backupInfo=document.createElement('p');backupInfo.textContent='名前・戦績・コイン・所持装飾・装備・実績・文字図鑑を、このブラウザに自動保存します。端末を替える場合はバックアップファイルを使ってください。';
  const exportBtn=document.createElement('button');exportBtn.type='button';exportBtn.textContent='保存データを書き出す';
  const importLabel=document.createElement('label');importLabel.className='moji-book-import';importLabel.textContent='保存データを読み込む';
  const importFile=document.createElement('input');importFile.type='file';importFile.accept='application/json,.json';importFile.setAttribute('aria-label','保存データのファイルを選択');
  importLabel.append(importFile);
  exportBtn.onclick=()=>{
   const keys=['kanji_arms_duel_save_v4','moji_arena_player_name','moji_ultimate_choice','moji_cpu_count',STORE,SORT_STORE,'moji_developer_effect_v1'];
   const data={app:'moji-arms',version:1,exportedAt:new Date().toISOString(),values:{}};
   for(const key of keys){try{const v=localStorage.getItem(key);if(v!==null)data.values[key]=v}catch(_){}}
   const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
   const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='文字武装_保存データ.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
   status.textContent='保存データのバックアップを作成しました';
  };
  importFile.onchange=async()=>{
   const file=importFile.files?.[0];if(!file)return;
   try{
    if(file.size>1000000)throw Error('ファイルが大きすぎます');
    const data=JSON.parse(await file.text()),allowed=new Set(['kanji_arms_duel_save_v4','moji_arena_player_name','moji_ultimate_choice','moji_cpu_count',STORE,SORT_STORE,'moji_developer_effect_v1']);
    if(data?.app!=='moji-arms'||data.version!==1||!data.values||typeof data.values!=='object')throw Error('文字武装の保存データではありません');
    for(const [k,v]of Object.entries(data.values)){if(allowed.has(k)&&typeof v==='string'&&v.length<700000){if(k===STORE){const check=JSON.parse(v);if(!Array.isArray(check))throw Error('文字図鑑が不正です')}else if(k==='kanji_arms_duel_save_v4')JSON.parse(v);}}
    for(const [k,v]of Object.entries(data.values))if(allowed.has(k)&&typeof v==='string'&&v.length<700000)localStorage.setItem(k,v);
    status.textContent='読み込みました。ページを再読み込みして反映してください。';entries=load();render();
   }catch(e){status.textContent='読み込み失敗：'+e.message}
  };
  backup.append(backupTitle,backupInfo,exportBtn,importLabel);
  panel.append(heading,sub,counter,sortBar,status,grid,backup);
  lobby.append(panel);render();
 }
 window.MojiGlyphBook={record,entries:()=>entries.slice(),render,typeOf,sorted:()=>order()};
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==$('onlineFrame')?.contentWindow)return;
  if(e.data?.type==='moji:glyphCast')record(e.data.glyph,e.data.kind,e.data.strokes);
 });
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();