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
 cx.save();cx.translate(b.x,b.y);cx.lineWidth=2.7;cx.lineJoin='round';
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
function preMatchOnline(){
 const parent=document.querySelector('#onlineSlots');if(!parent)return;
 parent.querySelectorAll('.online-slot').forEach((el,i)=>{
  const kind=el.querySelector('select.online-kind')?.value||['attack','defense','heal','pierce','homing'][i];
  const n=el.querySelector('input.slot-strokes')?.value;
  let p=el.querySelector('.moji-preview');if(!p){el.insertAdjacentHTML('beforeend',preview(kind,n));p=el.querySelector('.moji-preview')}
  const replacement=preview(kind,n);
  if(p.dataset.kind!==kind||p.dataset.n!==String(n)) {
   p.outerHTML=replacement.replace('data-kind="'+esc(kind)+'"','data-kind="'+esc(kind)+'" data-n="'+esc(n||'')+'"');
  }
 });
}
function preMatchSolo(){
 const host=document.querySelector('#loadoutPanel'),setup=document.querySelector('#lobbyScreen #setup');
 if(!host||!setup)return;
 let pane=document.querySelector('#mojiWeaponPreview');
 if(!pane){pane=document.createElement('section');pane.id='mojiWeaponPreview';pane.className='moji-weapon-gallery';
  pane.innerHTML='<h3>⚔ 武装の発射イメージ・性能</h3><p>● 通常弾／◆ 貫通弾／◎ 追尾弾は試合中も同じ形で表示されます。</p><div class="moji-weapon-gallery-grid"></div>';
  host.append(pane);
 }
 const rows=[...setup.querySelectorAll('.slot')].slice(0,5);
 const actual=rows.map((row,i)=>{
  const equipment=typeof slots!=='undefined'&&Array.isArray(slots)?slots[i]:null;
  const selector=row.querySelector('select.kind,select[data-kind],select[data-role],select[name*="kind"],select[name*="role"]')||
    [...row.querySelectorAll('select')].find(e=>types[e.value]);
  const kind=(selector&&types[selector.value]?selector.value:null)||
    (equipment&&types[equipment.kind]?equipment.kind:null)||
    ['attack','defense','heal','pierce','homing'][i];
  const n=row.querySelector('.strokes')?.value||equipment?.n;
  return {kind,n};
 });
 // Examples of ALL three projectile silhouettes stay visible even when the
 // player equips five copies of the same attack kind.
 const render=['attack','defense','heal','pierce','homing'].map(kind=>{
  const item=actual.find(x=>x.kind===kind);
  return preview(kind,item?.n||0);
 }).join('');
 const grid=pane.querySelector('.moji-weapon-gallery-grid');
 if(grid.dataset.version!==render){grid.innerHTML=render;grid.dataset.version=render}
 let summary=pane.querySelector('.moji-equipped-summary');
 if(!summary){summary=document.createElement('p');summary.className='moji-equipped-summary';pane.append(summary)}
 const equipped=actual.map((x,i)=>(i+1)+'：'+(types[x.kind]?.marker||'●')+' '+(types[x.kind]?.name||x.kind)+' '+metric(x.kind,x.n)).join('　');
 if(summary.textContent!=='装備中：'+equipped)summary.textContent='装備中：'+equipped;
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
 if(online){const scheduled=()=>requestAnimationFrame(preMatchOnline);const editor=document.querySelector('#joinArea');editor?.addEventListener('click',scheduled,true);}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootstrap,{once:true});else bootstrap();
window.MojiWeaponVisual={types,amount,metric,cooldown,preview,drawProjectile,preMatchSolo,preMatchOnline,syncSoloBattle};
})();