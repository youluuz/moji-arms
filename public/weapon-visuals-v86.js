/* v8.6: consistent, easily distinguished glyph projectiles and live weapon stats. */
(function(){
'use strict';
const types={
 attack:{name:'通常攻撃',short:'直進弾',marker:'●',note:'まっすぐ飛ぶ通常弾',color:'#82baff'},
 pierce:{name:'貫通',short:'貫通弾',marker:'◆',note:'壁・シールドを貫く',color:'#ffbb74'},
 homing:{name:'ホーミング',short:'追尾弾',marker:'◎',note:'相手を追いかけて曲がる',color:'#86f4e7'},
 defense:{name:'防御',short:'シールド',marker:'⬡',note:'受けるダメージを軽減',color:'#c6adff'},
 heal:{name:'回復',short:'回復',marker:'✚',note:'自分のHPを回復',color:'#9ce6aa'}
};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeN=n=>Number.isFinite(Number(n))&&Number(n)>0?Math.max(1,Math.min(84,Number(n))):0;
function amount(kind,n){n=safeN(n);return n?((kind==='heal'?n*4:n*6)):'—'}
function metric(kind,n){return (kind==='heal'?'回復':kind==='defense'?'防御':'威力')+amount(kind,n)}
function cooldown(kind,n){
 n=safeN(n);if(!n)return '—';
 const k={attack:1.3*(.65+n*.125+Math.max(0,n-10)*.02)+Math.max(0,n-20)*.055+Math.max(0,n-40)*.14,
  defense:1.4*(9+n*.4),heal:1.4*(13+n*.55),pierce:1.4*(7+n*.45),homing:1.4*(4.5+n*.42)}[kind];
 return Number.isFinite(k)?k.toFixed(1)+'秒':'—';
}
function preview(kind,n,ch){
 const d=types[kind]||types.attack;
 return '<div class="moji-preview" data-kind="'+esc(kind)+'">'+
 '<div class="moji-preview-track" aria-hidden="true"><span class="moji-preview-shot">'+d.marker+'</span><span class="moji-preview-target">◎</span></div>'+
 '<div class="moji-preview-lines"><strong>'+d.marker+' '+d.name+'</strong><span>'+d.note+'</span><small>'+metric(kind,n)+' / CT '+cooldown(kind,n)+'</small></div></div>';
}
function drawProjectile(cx,b){
 if(!b||b.special)return false;
 const kind=b.homing?'homing':b.pierce?'pierce':'attack';
 const own=b.owner==='p'||b.owner==='self'||b.own===true;
 const colors={attack:'#80b7ff',pierce:'#ffc077',homing:'#8af5e8'};
 cx.save();cx.translate(b.x,b.y);cx.scale(1.14,1.14);cx.lineWidth=2.7;cx.lineJoin='round';
 cx.shadowColor=colors[kind];cx.shadowBlur=14;
 if(kind==='attack'){
  cx.fillStyle='#225591';cx.strokeStyle='#b5deff';
  cx.beginPath();cx.arc(0,0,21,0,Math.PI*2);cx.fill();cx.stroke();
 }else if(kind==='pierce'){
  cx.fillStyle='#85501d';cx.strokeStyle='#ffdb9b';
  cx.beginPath();cx.moveTo(0,-27);cx.lineTo(24,0);cx.lineTo(0,27);cx.lineTo(-24,0);cx.closePath();cx.fill();cx.stroke();
  cx.beginPath();cx.moveTo(-34,0);cx.lineTo(-23,0);cx.moveTo(23,0);cx.lineTo(34,0);cx.stroke();
 }else{
  cx.fillStyle='#125a65';cx.strokeStyle='#acfff4';
  cx.beginPath();cx.arc(0,0,23,0,Math.PI*2);cx.fill();cx.stroke();
  cx.setLineDash([5,4]);cx.lineWidth=2;cx.beginPath();cx.arc(0,0,29,0,Math.PI*2);cx.stroke();cx.setLineDash([]);
  for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
   cx.beginPath();cx.moveTo(Math.cos(a)*32,Math.sin(a)*32);cx.lineTo(Math.cos(a)*38,Math.sin(a)*38);cx.stroke();
  }
 }
 cx.shadowBlur=0;cx.fillStyle='#fff';cx.font='900 19px sans-serif';cx.textAlign='center';cx.textBaseline='middle';
 cx.fillText(String(b.ch||'文'),0,1,32);
 cx.lineWidth=1.3;cx.strokeStyle=own?'#ffe89a':'#ff92ae';
 cx.beginPath();cx.arc(0,0,kind==='pierce'?29:kind==='homing'?35:26,-Math.PI*.83,-Math.PI*.17);cx.stroke();
 cx.restore();return true;
}
// Disco ball is visual-only: no effect on reach, stun duration, or damage.
function drawMirrorBall(cx,x,y,t){
 if(!cx)return;
 cx.save();cx.translate(x,y);cx.textAlign='center';cx.textBaseline='middle';
 const sway=Math.sin(t/540)*3.4;
 cx.strokeStyle='#b5cbea';cx.lineWidth=1.6;
 cx.beginPath();cx.moveTo(sway,-36);cx.lineTo(sway,-17);cx.stroke();
 cx.translate(sway,0);
 // Moving pools of reflected light help identify a dancing fighter quickly.
 for(let k=0;k<4;k++){
  const a=t/540+k*Math.PI/2;
  cx.save();cx.rotate(a);cx.fillStyle=k%2?'#b8c4ff35':'#ffe4aa35';
  cx.beginPath();cx.moveTo(0,5);cx.lineTo(-6,40);cx.lineTo(6,40);cx.closePath();cx.fill();cx.restore();
 }
 cx.shadowColor='#f9e8ff';cx.shadowBlur=13;cx.fillStyle='#bacde2';cx.strokeStyle='#e6f7ff';cx.lineWidth=2;
 cx.beginPath();cx.arc(0,0,18,0,Math.PI*2);cx.fill();cx.stroke();cx.shadowBlur=0;
 cx.save();cx.beginPath();cx.arc(0,0,17,0,Math.PI*2);cx.clip();
 for(let yy=-18,row=0;yy<21;yy+=8,row++){
  for(let xx=-23+(row%2)*4;xx<25;xx+=9){
   cx.fillStyle=((row+Math.round(xx/9)+Math.floor(t/180))%3===0)?'#ffffff':'#788fb6';
   cx.fillRect(xx,yy,7,7);
  }
 }
 cx.restore();
 cx.strokeStyle='#f9f0ff';cx.lineWidth=1.5;
 cx.beginPath();cx.arc(0,0,18,0,Math.PI*2);cx.stroke();
 cx.restore();
}
// Put projectile examples INSIDE the existing how-to/effects explanations,
// rather than showing a second set of large panels under the equipment editor.
const weaponOrder=['attack','defense','heal','pierce','homing'];
function guideWeaponExamples(equipment){
 return weaponOrder.map(kind=>{
  const item=equipment.find(s=>s.kind===kind);
  return preview(kind,item?.n||0);
 }).join('');
}
function onlineEquipped(){
 const parent=document.querySelector('#onlineSlots');
 if(!parent)return [];
 return [...parent.querySelectorAll('.online-slot')].map((row,i)=>({
  kind:row.querySelector('select.online-kind')?.value||weaponOrder[i],
  n:row.querySelector('input.slot-strokes')?.value||0
 }));
}
function preMatchOnline(){
 const editor=document.querySelector('#joinArea .online-loadout');
 if(!editor)return;
 // This guide is accessible before joining; the waiting-room guide is already
 // present and receives the same content without any extra standalone preview.
 let entry=document.querySelector('#joinArea #mojiOnlineAbilityGuide');
 if(!entry){
  entry=document.createElement('details');
  entry.id='mojiOnlineAbilityGuide';entry.className='online-guide moji-ability-help';
  entry.innerHTML='<summary><span class="online-guide-collapsed">▼ 5つの能力の使い方・効果を見る（発射イメージ付き）</span><span class="online-guide-expanded">▲ 使い方・効果を閉じる</span></summary>';
  editor.insertAdjacentElement('afterend',entry);
 }
 const guides=[entry,document.querySelector('#waitArea details.online-guide')].filter(Boolean);
 const contents=guideWeaponExamples(onlineEquipped());
 for(const guide of guides){
  let area=guide.querySelector('.moji-weapon-help');
  if(!area){
   area=document.createElement('section');area.className='moji-weapon-help';
   area.innerHTML='<h3>武装の使い方・効果と発射イメージ</h3><p>● 青＝通常弾　◆ オレンジ＝貫通弾　◎ 水色＝追尾弾。戦闘中も同じ形で表示されます。</p><div class="moji-weapon-gallery-grid"></div>';
   guide.append(area);
  }
  const grid=area.querySelector('.moji-weapon-gallery-grid');
  if(grid.dataset.version!==contents){
   grid.innerHTML=contents;grid.dataset.version=contents;
  }
 }
 // The five setup inputs now stay compact: no separate animated panel per slot.
 document.querySelectorAll('#onlineSlots .online-slot > .moji-preview').forEach(e=>e.remove());
}
function preMatchSolo(){
 const host=document.querySelector('#loadoutPanel'),setup=document.querySelector('#lobbyScreen #setup');
 const articles=host?.querySelectorAll('#abilityGuide .ability-grid article');
 if(!host||!setup||!articles||articles.length!==5)return;
 // Remove v8.6's standalone panel; the original built-in ability-guide is
 // already labeled “5つの能力の使い方・効果を見る”.
 host.querySelector('#mojiWeaponPreview')?.remove();
 const rows=[...setup.querySelectorAll('.slot')].slice(0,5);
 const equipment=rows.map((row,i)=>{
  const slot=typeof slots!=='undefined'&&Array.isArray(slots)?slots[i]:null;
  const selector=row.querySelector('select.kind,select[data-kind],select[data-role],select[name*="kind"],select[name*="role"]')||
    [...row.querySelectorAll('select')].find(e=>types[e.value]);
  const kind=(selector&&types[selector.value]?selector.value:null)||
    (slot&&types[slot.kind]?slot.kind:null)||weaponOrder[i];
  return {kind,n:row.querySelector('.strokes')?.value||slot?.n||0};
 });
 for(let i=0;i<articles.length;i++){
  const kind=weaponOrder[i],current=equipment.find(s=>s.kind===kind);
  const html=preview(kind,current?.n||0);
  let item=articles[i].querySelector('.moji-preview');
  if(!item){articles[i].insertAdjacentHTML('beforeend',html);item=articles[i].querySelector('.moji-preview')}
  else if(item.dataset.version!==html)item.outerHTML=html;
  item=articles[i].querySelector('.moji-preview');
  item.dataset.version=html;
 }
}
function syncSoloBattle(slots){
 const row=document.querySelector('#gameScreen .weaponrow')||
           document.querySelector('#gameScreen .cards')||
           document.querySelector('#gameScreen .weapon')?.parentElement;
 if(!row||!Array.isArray(slots)||slots.length!==5)return;
 const buttons=[...row.children].filter(e=>e.nodeType===1).slice(0,5);
 if(buttons.length!==5)return;
 buttons.forEach((el,i)=>{
  const s=slots[i],kind=s?.kind||['attack','defense','heal','pierce','homing'][i];
  let metricEl=el.querySelector('.moji-battle-metric');
  if(!metricEl){metricEl=document.createElement('small');metricEl.className='moji-battle-metric';el.append(metricEl)}
  const label=types[kind]?.marker+' '+metric(kind,s?.n);
  if(metricEl.textContent!==label)metricEl.textContent=label;
  el.title=(types[kind]?.name||kind)+'：'+metric(kind,s?.n)+' / 再使用 '+cooldown(kind,s?.n);
 });
}
function bootstrap(){
 preMatchSolo();preMatchOnline();
 const lobby=document.querySelector('#lobbyScreen'),online=document.querySelector('#onlineSlots');
 lobby?.addEventListener('input',preMatchSolo,true);
 lobby?.addEventListener('change',preMatchSolo,true);
 // Randomization updates several role and stroke inputs in one click.
 lobby?.addEventListener('click',()=>setTimeout(preMatchSolo,0),true);
 online?.addEventListener('input',preMatchOnline,true);
 online?.addEventListener('change',preMatchOnline,true);
 if(online){const scheduled=()=>requestAnimationFrame(preMatchOnline);document.querySelector('#joinArea')?.addEventListener('click',scheduled,true);document.querySelector('#waitArea')?.addEventListener('click',scheduled,true);online.addEventListener('click',()=>setTimeout(preMatchOnline,0),true);}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootstrap,{once:true});else bootstrap();
window.MojiWeaponVisual={types,amount,metric,cooldown,preview,drawProjectile,drawMirrorBall,preMatchSolo,preMatchOnline,syncSoloBattle};
})();