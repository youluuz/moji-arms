/* v11.4 hidden black/cyan mech-wing goggles, unlockable only by exact code.
   This anonymous browser game has no account authentication; possession of
   the code, not a verified user identity, is what authorizes local unlocking. */
(function(){
 'use strict';
 const KEY='moji_developer_effect_v1',CODE='effect_developeronlyH17';
 let stored={unlocked:false,equipped:false};
 try{const x=JSON.parse(localStorage.getItem(KEY));if(x?.unlocked)stored={unlocked:true,equipped:!!x.equipped}}catch(_){}
 const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(stored))}catch(_){}};
 function refresh(){
  const area=document.getElementById('mojiCyberControl');
  if(area){area.hidden=!stored.unlocked;const b=area.querySelector('button');b.textContent=stored.equipped?'✓ CYBER WINGS 装備中（外す）':'⚡ CYBER WINGS を装備する'}
 }
 function unlock(){stored={unlocked:true,equipped:true};save();refresh();const msg=document.getElementById('secretStatus');if(msg)msg.textContent='⚡ 非公開 CYBER WINGS を解放・装備しました。黒×シアンのゴーグル＋メカウィング。';const inp=document.getElementById('secretInput');if(inp)inp.value='';return true}
 function active(){return stored.unlocked&&stored.equipped}
 // Draw in local actor coordinates. ~46px overall width either side; never
 // alter hitbox, movement speed, collision, damage, or authoritative state.
 function paint(g,t){
  if(!active())return;
  g.save();g.lineCap='round';g.lineJoin='round';
  // Compact wing modules, hinges, pistons and subdued cyan thrust chambers.
  for(const dir of [-1,1]){
   g.save();g.scale(dir,1);
   const edge=30+Math.sin(t*3)*1.2;
   g.shadowColor='#4df0ff';g.shadowBlur=5;g.fillStyle='#061923';g.strokeStyle='#50e5f7';g.lineWidth=1.7;
   g.beginPath();g.moveTo(18,-3);g.lineTo(27,-13);g.lineTo(edge+8,-14);g.lineTo(35,-3);g.lineTo(27,4);g.lineTo(19,5);g.closePath();g.fill();g.stroke();
   g.shadowBlur=0;g.strokeStyle='#1a5570';g.lineWidth=3;
   g.beginPath();g.moveTo(20,0);g.lineTo(33,-8);g.lineTo(36,-8);g.stroke();
   g.strokeStyle='#9ef8ff';g.lineWidth=1.25;g.beginPath();g.moveTo(25,-1);g.lineTo(33,-8);g.lineTo(edge+5,-8);g.stroke();
   g.fillStyle='#65f3ff';g.beginPath();g.roundRect(30,0,6,3,1);g.fill();
   g.fillStyle='#1b3f58';g.beginPath();g.arc(22,0,3,0,Math.PI*2);g.fill();g.strokeStyle='#70eafd';g.stroke();
   g.restore();
  }
  // Angular compact goggle, with transparent cyan lenses and black frame.
  g.shadowColor='#41dfff';g.shadowBlur=6;g.fillStyle='#06131f';g.strokeStyle='#80f6ff';g.lineWidth=1.6;
  g.beginPath();g.moveTo(-18,-14);g.lineTo(-10,-19);g.lineTo(10,-19);g.lineTo(18,-14);g.lineTo(16,-7);g.lineTo(4,-5);g.lineTo(0,-8);g.lineTo(-4,-5);g.lineTo(-16,-7);g.closePath();g.fill();g.stroke();
  g.shadowBlur=0;g.fillStyle='#49c9e9';g.globalAlpha=.86;
  for(const d of [-1,1]){g.save();g.scale(d,1);g.beginPath();g.moveTo(3,-15);g.lineTo(13,-15);g.lineTo(12,-9);g.lineTo(5,-10);g.closePath();g.fill();g.restore()}
  g.globalAlpha=1;g.strokeStyle='#e2feff';g.lineWidth=.75;g.beginPath();g.moveTo(-10,-15);g.lineTo(-2,-13);g.moveTo(4,-15);g.lineTo(11,-13);g.stroke();
  g.restore();
 }
 function setup(){
  const input=document.getElementById('secretInput'),button=document.getElementById('secretApply');
  if(!input||!button)return;
  const intercept=e=>{
   if(input.value.trim()!==CODE)return;
   e.preventDefault();e.stopImmediatePropagation();unlock();
  };
  button.addEventListener('click',intercept,true);
  input.addEventListener('keydown',e=>{if(e.key==='Enter')intercept(e)},true);
  const bar=document.createElement('div');bar.id='mojiCyberControl';bar.hidden=true;
  const buttonEquip=document.createElement('button');buttonEquip.type='button';buttonEquip.onclick=()=>{if(!stored.unlocked)return;stored.equipped=!stored.equipped;save();refresh();if(typeof updatePreview==='function')updatePreview()};
  bar.append(buttonEquip);document.getElementById('secretStatus')?.insertAdjacentElement('afterend',bar);
  refresh();
 }
 window.MojiDeveloperFX={paint,active,unlock,refresh};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
