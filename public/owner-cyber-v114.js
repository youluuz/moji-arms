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
  for(const id of ['mojiCyberControl','mojiCyberLocker']){
   const area=document.getElementById(id);
   if(!area)continue;
   area.hidden=!stored.unlocked;
   for(const type of ['icon','wing','attack']){
    const button=area.querySelector('[data-cyber-part="'+type+'"]');
    if(!button)continue;
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
  // Fine silver armor ribs and cyan optics strengthen the mechanical profile.
  g.strokeStyle='#e6f6ff';g.lineWidth=.85;g.beginPath();
  g.moveTo(points[0][0]+2,points[0][1]-1);
  g.lineTo(points[1][0]-2,points[1][1]+4);
  g.lineTo(points[2][0]-2,points[2][1]+2);g.stroke();
  g.shadowBlur=4;g.shadowColor='#44dfff';g.strokeStyle='#41ddff';
  g.beginPath();g.moveTo(points[2][0]-2,points[2][1]+2);
  g.lineTo(points[3][0]+2,points[3][1]-2);g.stroke();
  g.restore();
 }
 // The user's reference has layered angular black wings with bright cyan
 // feather edges and a mechanical central hinge. Keep each side <=56px.
 function wings(g,t){
  if(!enabled('wing'))return;
  g.save();g.lineCap='round';g.lineJoin='round';
  g.scale(.82,.82); // compact in-game silhouette: reference-inspired, not screen-filling
  for(const direction of [-1,1]){
   g.save();g.scale(direction,1);
   const sway=Math.sin(t*2.6)*1.1;
   // Three long, razor-pointed armor feathers per side. The lowest blade is longer, narrower and sweeps down to a sharp tip.
   const blades=[
    [[17,-9],[55,-54+sway],[50,-27+sway],[36,-12],[24,-1]],
    [[17,-3],[66,-25+sway],[53,-7+sway],[39,2],[24,5]],
    [[18,5],[54,19+sway],[39,61+sway],[32,21],[23,11]]
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
  g.save();g.lineJoin='round';g.lineCap='round';
  // Spear-point visor: sharp outer corners and a pointed split nose bridge.
  g.shadowColor='#35e4ff';g.shadowBlur=9;g.strokeStyle='#d2edff';g.lineWidth=1.8;
  g.fillStyle='#040e1b';g.beginPath();
  g.moveTo(-28,-17);g.lineTo(-12,-24);g.lineTo(0,-22);g.lineTo(12,-24);g.lineTo(28,-17);
  g.lineTo(19,-8);g.lineTo(5,-6);g.lineTo(0,-11);g.lineTo(-5,-6);g.lineTo(-19,-8);
  g.closePath();g.fill();g.stroke();
  const lens=g.createLinearGradient(-24,-22,24,-6);
  lens.addColorStop(0,'#04121e');lens.addColorStop(.4,'#12638a');
  lens.addColorStop(.75,'#6ef4ff');lens.addColorStop(1,'#061623');
  g.fillStyle=lens;g.shadowBlur=2;g.beginPath();
  g.moveTo(-23,-16);g.lineTo(-11,-21);g.lineTo(-2,-20);g.lineTo(0,-14);
  g.lineTo(2,-20);g.lineTo(11,-21);g.lineTo(23,-16);
  g.lineTo(17,-11);g.lineTo(4,-9);g.lineTo(0,-13);g.lineTo(-4,-9);g.lineTo(-17,-11);
  g.closePath();g.fill();
  g.shadowBlur=0;g.strokeStyle='#efffff';g.lineWidth=.9;g.beginPath();
  g.moveTo(-24,-17);g.lineTo(-8,-20);g.moveTo(8,-20);g.lineTo(24,-17);g.stroke();
  for(const side of [-1,1]){
   g.save();g.scale(side,1);g.fillStyle='#132f41';g.strokeStyle='#68eaff';
   g.lineWidth=1;g.beginPath();g.moveTo(21,-17);g.lineTo(29,-18);
   g.lineTo(23,-11);g.lineTo(19,-8);g.closePath();g.fill();g.stroke();g.restore();
  }
  g.restore();
 }
 // Called in centered avatar coordinates: icon/wing are separate effect slots.
 function paint(g,t){
  if(!stored.unlocked)return;
  wings(g,Number(t)||0);
  goggles(g);
 }
 // Directional cyan rail exhaust stays ATTACHED BEHIND the flying glyph.
 // It deliberately has no targeting rings, crosshairs or homing-like orbitals.
 // Only rendering changes; projectile collision circles remain unchanged.
 function paintShot(g,kind,t,heading=0){
  if(!enabled('attack'))return;
  const pulse=.8+.2*Math.sin((Number(t)||0)*11);
  g.save();g.rotate(Number.isFinite(heading)?heading:0);
  g.lineJoin='round';g.lineCap='round';
  const trail=g.createLinearGradient(-69,0,-12,0);
  trail.addColorStop(0,'rgba(37,206,255,0)');
  trail.addColorStop(.55,'rgba(24,173,240,.23)');
  trail.addColorStop(1,'rgba(117,250,255,.75)');
  g.fillStyle=trail;g.shadowColor='#2cdcff';g.shadowBlur=9;
  g.beginPath();g.moveTo(-12,-10);g.lineTo(-69*pulse,0);g.lineTo(-12,10);g.closePath();g.fill();
  for(const side of [-1,1]){
   g.save();g.scale(1,side);
   g.fillStyle='#092235';g.strokeStyle='#62eaff';g.lineWidth=1.6;
   g.beginPath();g.moveTo(-13,5);g.lineTo(-41,12);g.lineTo(-29,3);
   g.lineTo(-13,1);g.closePath();g.fill();g.stroke();
   g.strokeStyle='#d2ffff';g.lineWidth=.85;
   g.beginPath();g.moveTo(-15,5);g.lineTo(-40,11);g.stroke();g.restore();
  }
  g.strokeStyle='#bcffff';g.lineWidth=2.2;g.shadowBlur=8;
  g.beginPath();g.moveTo(-14,0);g.lineTo(-55*pulse,0);g.stroke();
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
  // Unlocked owners can also equip all three pieces from the real locker.
  // This is NOT an item in the public cosmetic inventory/gacha listing.
  const collection=document.getElementById('collectionPanel');
  // One safe action clears every visual equipment slot, without changing
  // owned inventory, wins, achievements, coins, or developer code unlock.
  // Works in the shared locker and in the room's mounted copy of that locker.
  if(collection&&!document.getElementById('mojiUnequipAll')){
   const clear=document.createElement('button');
   clear.id='mojiUnequipAll';clear.type='button';
   clear.textContent='✕ 装備をすべて外す';
   clear.setAttribute('aria-label','通常装飾と隠し装備の3枠をすべて解除');
   clear.addEventListener('click',()=>{
    if(typeof account!=='undefined'&&account?.equipped){
     for(const category of ['aura','frame','attack'])account.equipped[category]=null;
     if(typeof safeStore==='function')safeStore();
    }
    for(const type of ['icon','wing','attack'])stored[type]=false;
    save();refresh();
    if(typeof updateCollection==='function')updateCollection();
    if(typeof updatePreview==='function')updatePreview();
    clear.textContent='✓ すべての装備を解除しました';
    window.setTimeout(()=>{if(clear.isConnected)clear.textContent='✕ 装備をすべて外す'},1700);
   });
   const next=document.getElementById('collectionDrawer');
   if(next)collection.insertBefore(clear,next);else collection.append(clear);
  }
  if(collection&&!document.getElementById('mojiCyberLocker')){
   const locker=area.cloneNode(true);
   locker.id='mojiCyberLocker';locker.hidden=true;
   locker.querySelector('strong').textContent='非公開カスタム装備｜3つの専用枠';
   for(const b of locker.querySelectorAll('[data-cyber-part]')){
    const type=b.dataset.cyberPart;
    b.addEventListener('click',()=>{
     if(!stored.unlocked)return;
     stored[type]=!stored[type];save();refresh();
     if(typeof updatePreview==='function')updatePreview();
    });
   }
   collection.append(locker);
  }
  refresh();
 }
 window.MojiDeveloperFX={paint,paintShot,goggles,wings,active,enabled,unlock,refresh};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
 else setup();
})();
