/* v11.5: Three separately wearable secret cosmetics:
   icon effect = cyan visor; avatar part = reference-inspired mech wings;
   attack effect = cyan rail-pulse. No combat/hitbox/cooldown changes.
   This anonymous game does not authenticate owners: the secret code is local. */
(function(){
 'use strict';
 const KEY='moji_developer_effect_v1', CODE='effect_developeronlyH17';
 let stored={unlocked:false,icon:false,wing:false,attack:false};
 try{
  const old=JSON.parse(localStorage.getItem(KEY));
  if(old&&old.unlocked){
   const legacy=typeof old.equipped==='boolean' ? old.equipped : false;
   stored={unlocked:true,icon:typeof old.icon==='boolean'?old.icon:legacy,
    wing:typeof old.wing==='boolean'?old.wing:legacy,
    attack:typeof old.attack==='boolean'?old.attack:legacy};
  }
 }catch(_){}
 const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(stored))}catch(_){}};
 function enabled(slot){return !!(stored.unlocked&&stored[slot])}
 function active(){return enabled('icon')||enabled('wing')||enabled('attack')}
 function refresh(){
  const area=document.getElementById('mojiCyberControl');
  if(!area)return;
  area.hidden=!stored.unlocked;
  for(const type of ['icon','wing','attack']){
   const button=area.querySelector('[data-cyber-part="'+type+'"]');
   if(button){
    button.setAttribute('aria-pressed',String(enabled(type)));
    button.classList.toggle('equipped',enabled(type));
    button.querySelector('.moji-cyber-state').textContent=enabled(type)?'装備中 ✓':'装備する';
   }
  }
 }
 function unlock(){
  stored={unlocked:true,icon:true,wing:true,attack:true};
  save();refresh();
  const msg=document.getElementById('secretStatus');
  if(msg)msg.textContent='⚡ CYBER SET 解放：ゴーグル・機械羽・攻撃エフェクトを個別に装備できます。';
  const inp=document.getElementById('secretInput');if(inp)inp.value='';
  if(typeof updatePreview==='function')updatePreview();
  return true;
 }
 function feather(g,points,shine){
  g.save();g.shadowColor='#40ddff';g.shadowBlur=shine?4:2;
  const steel=g.createLinearGradient(points[0][0],points[0][1],points[2][0],points[2][1]);
  steel.addColorStop(0,'#243b49');steel.addColorStop(.48,'#040d17');steel.addColorStop(1,'#0c2736');
  g.fillStyle=steel;g.strokeStyle='#5ce8ff';g.lineWidth=1.25;
  g.beginPath();g.moveTo(...points[0]);for(let i=1;i<points.length;i++)g.lineTo(...points[i]);
  g.closePath();g.fill();g.stroke();g.shadowBlur=0;
  g.strokeStyle='#c8e9fa';g.lineWidth=.6;g.beginPath();g.moveTo(...points[0]);g.lineTo(...points[1]);g.stroke();
  g.strokeStyle='#158baa';g.lineWidth=1.5;g.beginPath();
  g.moveTo(points[0][0]+2,points[0][1]);g.lineTo(points[2][0]-2,points[2][1]);
  g.stroke();
  g.restore();
 }
 // The user's reference has layered angular black wings with bright cyan
 // feather edges and a mechanical central hinge. Keep each side <=56px.
 function wings(g,t){
  if(!enabled('wing'))return;
  g.save();g.lineCap='round';g.lineJoin='round';
  for(const direction of [-1,1]){
   g.save();g.scale(direction,1);
   const sway=Math.sin(t*2.6)*1.1;
   const blades=[
    [[18,-9],[39,-36+sway],[47,-25+sway],[39,-13],[26,0]],
    [[19,-6],[49,-23+sway],[55,-8+sway],[42,-1],[26,3]],
    [[19,0],[54,-5+sway],[53,10+sway],[39,12],[23,8]],
    [[20,4],[48,12+sway],[45,27+sway],[33,22],[23,12]],
    [[20,9],[39,25+sway],[37,38+sway],[27,24],[20,16]]
   ];
   blades.forEach((p,i)=>feather(g,p,i%2===0));
   // Silver articulated mounting plates, cyan reactor, etched neon diamonds.
   g.fillStyle='#071723';g.strokeStyle='#c5dce9';g.lineWidth=1.25;
   g.beginPath();g.moveTo(16,-8);g.lineTo(27,-16);g.lineTo(32,-5);g.lineTo(29,15);
   g.lineTo(21,18);g.lineTo(17,9);g.closePath();g.fill();g.stroke();
   g.shadowColor='#40e8ff';g.shadowBlur=6;g.strokeStyle='#3fdbff';g.lineWidth=1.8;
   g.beginPath();g.moveTo(25,-9);g.lineTo(27,8);g.lineTo(22,14);g.stroke();
   g.fillStyle='#041c2b';g.beginPath();g.arc(24,2,5,0,Math.PI*2);g.fill();
   g.strokeStyle='#60ecff';g.lineWidth=2;g.stroke();
   g.shadowBlur=0;
   g.fillStyle='#66e7ff';g.beginPath();g.moveTo(37,-15);g.lineTo(40,-11);
   g.lineTo(36,-7);g.lineTo(33,-11);g.closePath();g.fill();
   g.restore();
  }
  g.restore();
 }
 function goggles(g){
  if(!enabled('icon'))return;
  g.save();g.lineJoin='round';
  g.shadowColor='#41dfff';g.shadowBlur=5;
  g.fillStyle='#07121c';g.strokeStyle='#8ff5ff';g.lineWidth=1.65;
  g.beginPath();g.moveTo(-17,-14);g.lineTo(-11,-19);g.lineTo(11,-19);g.lineTo(17,-14);
  g.lineTo(15,-7);g.lineTo(4,-6);g.lineTo(0,-9);g.lineTo(-4,-6);g.lineTo(-15,-7);g.closePath();
  g.fill();g.stroke();
  g.shadowBlur=0;g.fillStyle='#38cdea';
  for(const d of [-1,1]){
   g.save();g.scale(d,1);g.beginPath();g.moveTo(3,-15);g.lineTo(13,-15);
   g.lineTo(12,-10);g.lineTo(5,-11);g.closePath();g.fill();g.restore();
  }
  g.strokeStyle='#e5fcff';g.lineWidth=.7;g.beginPath();
  g.moveTo(-11,-15);g.lineTo(-3,-13);g.moveTo(3,-13);g.lineTo(11,-15);g.stroke();
  g.restore();
 }
 // Called in centered avatar coordinates: icon/wing are separate effect slots.
 function paint(g,t){
  if(!stored.unlocked)return;
  wings(g,Number(t)||0);
  goggles(g);
 }
 // Optional cyan mechanical rail-pulse around the OWN projectile only.
 // Drawn in already-translated bullet coordinates, after the standard glyph.
 function paintShot(g,kind,t){
  if(!enabled('attack'))return;
  const pulse=Math.sin((Number(t)||0)*6)*1.1;
  g.save();g.lineCap='round';g.lineJoin='round';
  g.strokeStyle='#6cefff';g.shadowColor='#39dfff';g.shadowBlur=8;g.lineWidth=2.1;
  g.beginPath();g.arc(0,0,30+pulse,-Math.PI*.73,Math.PI*.60);g.stroke();
  g.strokeStyle='#0a6e93';g.lineWidth=3;g.beginPath();g.arc(0,0,34,Math.PI*.72,Math.PI*1.25);g.stroke();
  g.strokeStyle='#c9faff';g.lineWidth=1.5;
  for(let i=0;i<4;i++){
   const a=(i*Math.PI/2)+Math.PI/4;
   const x=Math.cos(a),y=Math.sin(a);
   g.beginPath();g.moveTo(x*33,y*33);g.lineTo(x*39,y*39);g.stroke();
  }
  for(const direction of [-1,1]){
   g.save();g.scale(direction,1);
   g.strokeStyle='#20badc';g.lineWidth=1.2;
   g.beginPath();g.moveTo(36,-3);g.lineTo(44,-3);g.lineTo(50,-9);
   g.moveTo(36,3);g.lineTo(44,3);g.lineTo(49,8);g.stroke();
   g.restore();
  }
  g.shadowBlur=0;
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
  const area=document.createElement('div');area.id='mojiCyberControl';area.hidden=true;
  const heading=document.createElement('strong');heading.textContent='CYBER SECRET｜非公開カスタム装備';
  const hint=document.createElement('p');hint.textContent='3つの装備枠を独立して切り替えられます。ガチャ一覧には表示されません。';
  area.append(heading,hint);
  const parts=[
   ['icon','◈','アイコンエフェクト','ネオンゴーグル'],
   ['wing','⟡','アイコンカスタムパーツ','メカニカルウィング'],
   ['attack','⌁','攻撃エフェクト','シアンレールパルス']
  ];
  for(const [type,symbol,category,name] of parts){
   const b=document.createElement('button');b.type='button';b.dataset.cyberPart=type;
   b.innerHTML='<span class="moji-cyber-symbol"></span><span class="moji-cyber-desc"><small></small><b></b></span><span class="moji-cyber-state"></span>';
   b.querySelector('.moji-cyber-symbol').textContent=symbol;
   b.querySelector('small').textContent=category;
   b.querySelector('b').textContent=name;
   b.onclick=()=>{
    if(!stored.unlocked)return;
    stored[type]=!stored[type];save();refresh();
    if(typeof updatePreview==='function')updatePreview();
   };
   area.append(b);
  }
  document.getElementById('secretStatus')?.insertAdjacentElement('afterend',area);
  refresh();
 }
 window.MojiDeveloperFX={paint,paintShot,goggles,wings,active,enabled,unlock,refresh};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
 else setup();
})();
