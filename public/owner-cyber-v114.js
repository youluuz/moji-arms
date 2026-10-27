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
  g.save();g.lineJoin='round';g.lineCap='round';
  // Unified angular chrome visor with a deep cyan lens and side housings.
  g.shadowColor='#35e4ff';g.shadowBlur=8;g.strokeStyle='#d2edff';g.lineWidth=2;
  g.fillStyle='#040e1b';g.beginPath();
  g.moveTo(-20,-16);g.lineTo(-12,-22);g.lineTo(12,-22);g.lineTo(20,-16);
  g.lineTo(16,-6);g.lineTo(4,-5);g.lineTo(0,-8);g.lineTo(-4,-5);
  g.lineTo(-16,-6);g.closePath();g.fill();g.stroke();
  const lens=g.createLinearGradient(-16,-20,18,-6);
  lens.addColorStop(0,'#0a2434');lens.addColorStop(.35,'#126f96');
  lens.addColorStop(.75,'#63edff');lens.addColorStop(1,'#071525');
  g.fillStyle=lens;g.shadowBlur=2;g.beginPath();
  g.moveTo(-16,-15);g.lineTo(-10,-19);g.lineTo(10,-19);g.lineTo(16,-15);
  g.lineTo(13,-9);g.lineTo(2,-8);g.lineTo(0,-10);g.lineTo(-2,-8);
  g.lineTo(-13,-9);g.closePath();g.fill();
  g.shadowBlur=0;g.strokeStyle='#efffff';g.lineWidth=.75;g.beginPath();
  g.moveTo(-13,-17);g.lineTo(-4,-17);g.moveTo(5,-16);g.lineTo(12,-14);g.stroke();
  for(const side of [-1,1]){
   g.save();g.scale(side,1);g.fillStyle='#283f50';g.strokeStyle='#68eaff';
   g.lineWidth=1;g.beginPath();g.moveTo(16,-17);g.lineTo(21,-14);
   g.lineTo(19,-8);g.lineTo(16,-7);g.closePath();g.fill();g.stroke();g.restore();
  }
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
  const time=Number(t)||0,pulse=Math.sin(time*8)*1.3;
  g.save();g.lineCap='round';g.lineJoin='round';
  // Reactor rings and a compact rotating hexagonal targeting reticle.
  g.strokeStyle='#82f4ff';g.shadowColor='#23e9ff';g.shadowBlur=9;g.lineWidth=2.3;
  g.beginPath();g.arc(0,0,30+pulse,-Math.PI*.84,Math.PI*.65);g.stroke();
  g.strokeStyle='#14759c';g.lineWidth=3;
  g.beginPath();g.arc(0,0,34-pulse,Math.PI*.72,Math.PI*1.3);g.stroke();
  g.shadowBlur=3;g.strokeStyle='#dbffff';g.lineWidth=1.2;
  g.save();g.rotate(time*.65);
  for(let i=0;i<6;i++){
   const a=i*Math.PI/3,x=Math.cos(a),y=Math.sin(a);
   g.beginPath();g.moveTo(x*35,y*35);g.lineTo(x*40,y*40);g.stroke();
  }
  g.restore();
  g.strokeStyle='#49e6ff';g.lineWidth=1.15;g.beginPath();
  for(let i=0;i<6;i++){
   const a=i*Math.PI/3+Math.PI/6,x=Math.cos(a)*27,y=Math.sin(a)*27;
   if(i===0)g.moveTo(x,y);else g.lineTo(x,y);
  }g.closePath();g.stroke();
  for(const direction of [-1,1]){
   g.save();g.scale(direction,1);
   g.fillStyle='#081a2c';g.strokeStyle='#a7f6ff';g.lineWidth=1.4;
   g.beginPath();g.moveTo(29,-10);g.lineTo(40,-6);g.lineTo(46,0);
   g.lineTo(40,6);g.lineTo(29,10);g.lineTo(34,0);g.closePath();g.fill();g.stroke();
   g.strokeStyle='#36c5e7';g.lineWidth=2;
   g.beginPath();g.moveTo(39,0);g.lineTo(52,0);g.stroke();
   g.restore();
  }
  g.shadowBlur=5;g.fillStyle='#efffff';
  for(let i=0;i<5;i++){
   const a=time*1.25+i*2.399,r=37+Math.sin(time*9+i)*3;
   g.fillRect(Math.cos(a)*r,Math.sin(a)*r,2,2);
  }
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
