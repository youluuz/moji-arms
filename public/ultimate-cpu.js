/* Glyph Strike v7.1: solo and solo-custom use the same six ultimate rules. */
(function(){
'use strict';
function boot(){
 if(!window.MojiUlt||!document.getElementById('weapons')||!document.getElementById('field'))return;
 const U=window.MojiUlt, lobby=document.getElementById('loadoutPanel'),shell=document.querySelector('#gameScreen .arena-shell');
 const pick=U.attachUI(lobby),battle=U.attachUI(shell);battle.showBattle(true);
 // Six clearly separated equipment cells: five ordinary glyph weapons and
 // one ultimate. Never position the cast button on top of the arena/cards.
 const weaponRow=document.getElementById('weapons');
 if(weaponRow){
  weaponRow.classList.add('moji-six-slot-row');
  battle.root.classList.add('moji-ultimate-inline');
  weaponRow.append(battle.root);
 }
 // Put ultimate selection directly after the five glyph/slot editor, not at
 // the bottom of the entire lobby (where settings and entry actions live).
 const glyphSlots=document.getElementById('setup');
 if(glyphSlots && lobby.contains(glyphSlots)){
  glyphSlots.insertAdjacentElement('afterend',pick.root);
 }
 // The pre-existing whole-loadout randomizer belongs just ABOVE the ultimate
 // choices. Relocate the live button, preserving its event handler.
 const shuffle=document.getElementById('shuffleLoadout');
 if(shuffle && pick.root.isConnected){
  let bar=lobby.querySelector('#mojiBulkRandomBar');
  if(!bar){
   bar=document.createElement('div');
   bar.id='mojiBulkRandomBar';
   bar.className='moji-loadout-random-actions';
   bar.setAttribute('role','group');
   bar.setAttribute('aria-label','武装5枠をまとめてランダム設定');
  }
  bar.append(shuffle);
  pick.root.insertAdjacentElement('beforebegin',bar);
 }
 let chosen=localStorage.getItem('moji_ultimate_choice')||'roman';
 if(!U.byId[chosen])chosen='roman';
 let charge=0,spent=false,aiming=false,aimUntil=0,aimAngle=0,windupUntil=0,ultimateUsed='',usedNamepu=false;
 let immortalUntil=0,invisibleUntil=0,namepuUntil=0,danceUntil=0;
 // v7.8 CPU opponents respect player invisibility and global dance freeze.
 window.MojiCpuUltimateState={danceActive:()=>performance.now()<danceUntil,invisibleActive:()=>performance.now()<invisibleUntil};
 let matchId=-1,lastActive=false,prevCast=0,prevEnemyHP=600;
 let specialBullets=new Set(),romanImpacts=[];
 const banner=document.createElement('div');banner.className='ultimate-aiming-banner';banner.hidden=true;shell.append(banner);
 const fx=document.createElement('canvas');fx.className='ultimate-solo-overlay';Object.assign(fx.style,{position:'absolute',pointerEvents:'none',zIndex:11});shell.append(fx);
 const howto=document.createElement('div');
 howto.className='moji-battle-howto moji-outside-map';howto.setAttribute('role','note');
 howto.innerHTML='<span>🎯 戦場をタップ／クリックした方向に攻撃！</span><small>左スティック／WASDで移動　・　下の武装で切替</small>';
 shell.insertAdjacentElement('beforebegin',howto);
 function curr(){return U.byId[chosen]}
 function choose(id){if(!U.byId[id])return;chosen=id;localStorage.setItem('moji_ultimate_choice',id);pick.show(chosen);battle.show(chosen,charge,spent,aiming,Math.max(0,(aimUntil-performance.now())/1000))}
 pick.picker.addEventListener('click',e=>{const b=e.target.closest('[data-ultimate]');if(b)choose(b.dataset.ultimate)});
 choose(chosen);
 function reset(){
  charge=Math.round(curr().cost*(window.MojiCustomRules?.chargeForMode(typeof matchMode==='undefined'?'normal':matchMode)||0)/100);spent=false;aiming=false;aimUntil=windupUntil=0;usedNamepu=false;ultimateUsed='';
  immortalUntil=invisibleUntil=namepuUntil=danceUntil=0;specialBullets.clear();romanImpacts=[];
  lastActive=true;banner.hidden=true;prevEnemyHP=typeof MAX_HP==='number'?MAX_HP:600;
 }
 function isReady(){return typeof running!=='undefined'&&running&&typeof player!=='undefined'&&player&&Array.isArray(slots)&&slots.length===5&&!(window.MojiCpuBots?.countdownLeft?.()>0)}
 function canAct(){return !aiming && performance.now()>=windupUntil && performance.now()>=namepuUntil && performance.now()>=danceUntil }
 // Wrap the actual successful-cast accounting; spamming a cooling slot earns no charge.
 if(typeof recordCast==='function'){
  const oldRecord=recordCast;
  recordCast=function(...args){const n=Array.isArray(slots)?Number(slots[selected]?.n)||0:0;const r=oldRecord.apply(this,args);if(isReady())charge=Math.min(curr().cost,charge+n);return r};
 }
 if(typeof act==='function'){
  const oldAct=act;
  act=function(...args){if(!canAct())return;const ready=Array.isArray(slots)&&slots[selected]&&Number.isFinite(args[0])&&args[0]>=slots[selected].ready;const kind=slots?.[selected]?.kind,oldHP=player.hp,oldCount=bullets.length;
   const t=oldAct.apply(this,args);
   if(ready&&usedNamepu&&performance.now()>=namepuUntil){
    if(kind==='heal')player.hp=oldHP+(player.hp-oldHP)*.8;
    else if(kind==='defense')player.shield*=.8;
    else if(['attack','pierce','homing'].includes(kind))
     for(const b of bullets.slice(oldCount))if(b.owner==='p')b.namepuWeakened=true;
   }
   if(ready&&invisibleUntil>performance.now())invisibleUntil=0;return t};
 }
 if(typeof damage==='function'){
  const oldDamage=damage;
  damage=function(actor,amount,now,...rest){
   const t=performance.now();
   if(t<danceUntil || (actor===player && t<immortalUntil))return;
   if(rest[1]?.namepuWeakened&&actor!==player)amount*=.8;
   if(rest[1]?.ultimate==='roman'){amount=Math.max(amount,actor?.hp||0);rest[0]=true}
   return oldDamage.call(this,actor,amount,now,...rest);
  };
 }
 if(typeof moveActor==='function'){
  const oldMove=moveActor;
  moveActor=function(actor,...rest){if(performance.now()<danceUntil || (actor===player&&(performance.now()<namepuUntil||performance.now()<windupUntil)))return;return oldMove.call(this,actor,...rest)};
 }
 function fire(id,angle){
  if(!isReady())return;
  const now=performance.now();
  const launch=()=>{
   if(!isReady())return;
   const bullet={x:player.x,y:player.y,vx:Math.cos(angle)*(id==='roman'?590:610),vy:Math.sin(angle)*(id==='roman'?590:610),
    n:(id==='roman'?600:60)/DAMAGE_PER_STROKE,owner:'p',life:id==='roman'?3.1:2.8,ch:id==='roman'?'ロマン砲':'硬化弾',homing:false,pierce:false,ultimate:id};
   bullets.push(bullet);specialBullets.add(bullet);
   if(id==='roman')battleShots++;
  };
  if(id==='roman')windupUntil=now+1000, setTimeout(()=>{if(performance.now()>=windupUntil)launch();},1000);
  else launch();
 }
 function chooseUltimate(){
  if(!isReady()||spent||charge<curr().cost||performance.now()<danceUntil)return;
  spent=true;ultimateUsed=chosen;const now=performance.now();U.play(chosen);
  if(curr().target){
   aiming=true;aimUntil=now+5000;
   aimAngle=Math.atan2(mouse.y-player.y,mouse.x-player.x);
  }else switch(chosen){
   case 'invincible':immortalUntil=now+2800;break;
   case 'dance':danceUntil=now+2000;break;
   case 'invisible':invisibleUntil=now+4000;break;
   case 'namepu':namepuUntil=now+5000;usedNamepu=true;break;
  }
 }
 battle.cast.addEventListener('click',e=>{e.preventDefault();chooseUltimate()});
 // Native canvas handling uses pointerdown. Capture the next targeting tap before ordinary attacks.
 const field=document.getElementById('field');
 field.addEventListener('pointerdown',e=>{
  if(!aiming||!isReady())return;
  e.preventDefault();e.stopImmediatePropagation();
  const r=field.getBoundingClientRect();
  const x=(e.clientX-r.left)*cpuView.w/r.width+cam.x,y=(e.clientY-r.top)*cpuView.h/r.height+cam.y;
  aimAngle=Math.atan2(y-player.y,x-player.x);
  aiming=false;fire(chosen,aimAngle);
 },true);
 document.getElementById('weapons').addEventListener('pointerdown',e=>{if(aiming){e.stopImmediatePropagation();e.preventDefault()}},true);
 // Also protect regular equipment while in aimed-ultimate mode, including keyboard shortcuts.
 document.getElementById('weapons').addEventListener('click',e=>{if(aiming){e.stopImmediatePropagation();e.preventDefault()}},true);
 function graphics(now){
  const size=field.getBoundingClientRect(),area=shell.getBoundingClientRect();
  fx.style.left=(size.left-area.left)+'px';fx.style.top=(size.top-area.top)+'px';fx.style.width=size.width+'px';fx.style.height=size.height+'px';
  const dpr=Math.min(document.body.classList.contains('mobile-touch-input')?1.5:2,Math.max(1,devicePixelRatio||1)),w=Math.round(size.width*dpr),h=Math.round(size.height*dpr);
  if(fx.width!==w||fx.height!==h){fx.width=w;fx.height=h}
  const c=fx.getContext('2d');c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,w,h);c.setTransform(dpr*size.width/cpuView.w,0,0,dpr*size.height/cpuView.h,0,0);
  if(!isReady()&&!romanImpacts.length)return;
  const x=player.x-cam.x,y=player.y-cam.y;
  c.save();c.textAlign='center';
  if(windupUntil>now)window.MojiRomanFX?.drawCharge(c,x,y,now,1-(windupUntil-now)/1000);
  for(const effect of romanImpacts)window.MojiRomanFX?.drawImpact(c,effect.x-cam.x,effect.y-cam.y,now-effect.at);
  if(now<immortalUntil){
   c.font='900 18px Georgia,serif';c.fillStyle='#ffe7a1';c.shadowColor='#ffeeb7';c.shadowBlur=14;
   for(let i=0;i<3;i++){let a=now/420+i*Math.PI*2/3;c.fillText('無敵',x+46*Math.cos(a),y-12+29*Math.sin(a))}
  }
  if(now<namepuUntil||now<danceUntil){
   window.MojiWeaponVisual?.drawMirrorBall(c,x,y-126,now);
   window.MojiWeaponVisual?.drawDanceAura(c,x,y,now);
   c.font='bold 26px sans-serif';c.fillStyle='#ffe49a';c.fillText(now<namepuUntil?'😐':'♪ ♫ ♪',x,y-76+Math.sin(now/135)*6);
   c.font='bold 21px sans-serif';c.fillText('♪',x-30,y-55);c.fillText('♫',x+29,y-50);
   if(now<danceUntil&&typeof enemy!=='undefined'&&enemy.hp>0){
    const ex=enemy.x-cam.x,ey=enemy.y-cam.y;
    window.MojiWeaponVisual?.drawMirrorBall(c,ex,ey-126,now);
    window.MojiWeaponVisual?.drawDanceAura(c,ex,ey,now);
    c.font='bold 25px sans-serif';c.fillText('♪ ♫ ♪',ex,ey-76+Math.sin(now/135)*7);
    c.font='bold 19px sans-serif';c.fillText('♬',ex-27,ey-55);c.fillText('♪',ex+28,ey-54);
   }
  }
  if(now<invisibleUntil){c.fillStyle='#8ceeff';c.font='12px sans-serif';c.fillText('透明化中',x,y-64)}
  if(aiming){c.font='bold 20px serif';c.fillStyle='#ffdc9b';c.shadowBlur=16;c.shadowColor='#ffb960';c.fillText(curr().name,x,y-76)}
  for(const b of specialBullets){if(!bullets.includes(b))continue;
   if(b.ultimate==='roman')window.MojiRomanFX?.drawShot(c,b.x-cam.x,b.y-cam.y,Math.atan2(b.vy,b.vx),now);
   else {
    c.font='bold 24px serif';c.fillStyle='#bdd5ff';c.shadowColor='#7aaeff';c.shadowBlur=25;
    c.fillText(b.ch,b.x-cam.x,b.y-cam.y-13);
   }
  }
  c.restore();
 }
 // Apply the victory styling from the authoritative result transition,
 // not exclusively in requestAnimationFrame (which phones may pause in the
 // background or during an overlay transition).
 function showNamepuVictory(){
  if(!usedNamepu||typeof player==='undefined'||!player||player.hp<=0)return false;
  const result=document.getElementById('result');
  if(!result||!result.classList.contains('show'))return false;
  result.classList.add('ultimate-namepu-victory');
  result.setAttribute('aria-hidden','false');
  const title=document.getElementById('resultTitle');
  if(title&&!result.dataset.ultimateNamepu){
   result.dataset.ultimateNamepu='1';
   const displayName=window.MojiLoginWinnerName?.()||'あなた';
   title.textContent='🏆 優勝：'+displayName+'｜'+U.victoryPhrase();
  }
  window.MojiNamepuVictory?.showSolo({name:window.MojiLoginWinnerName?.()||'あなた',icon:typeof avatarChar==='string'?avatarChar:'武',kills:window.MojiCpuBots?.kills?.()||0,hp:player.hp});
  return true;
 }
 window.MojiCpuNamepuVictory={show:showNamepuVictory,used:()=>usedNamepu,debug:()=>({charge,chosen,ready:isReady(),spent,canAct:canAct(),running:typeof running==='undefined'?null:running,n:typeof slots!=='undefined'?slots?.[selected]?.n:null})};
 let lastFxPaint=0;
 function tick(){
  const now=performance.now(),active=isReady();
  if(active&&!lastActive)reset();
  if(active&&typeof matchToken==='number'&&matchId!==matchToken){matchId=matchToken;reset()}
  if(!active&&lastActive)lastActive=false;
  if(active){
   if(aiming&&now>=aimUntil){aiming=false;fire(chosen,aimAngle)}
   // CPU opponent cannot acquire a target while player is invisible.
   if(invisibleUntil>now){enemy.ready=Math.max(enemy.ready||0,now+120);}
   // Projectiles that hit terrain must not apply hardening. Only actual hit
   // collision inside cpu-battle-v78.js awards the hardening effect.
   for(const b of [...specialBullets])if(!bullets.includes(b)){
    if(b.ultimate==='roman')romanImpacts.push({x:b.x,y:b.y,at:now});
    specialBullets.delete(b);
   }
   romanImpacts=romanImpacts.filter(e=>now-e.at<720).slice(-8);
  }
  // Match start and slot reconfiguration rebuild the legacy #weapons DOM.
  // Keep the SAME ultimate button (and its listener) attached as slot six.
  if(weaponRow && battle.root.parentElement!==weaponRow)weaponRow.append(battle.root);
  battle.show(chosen,charge,spent,aiming,Math.max(0,(aimUntil-now)/1000));
  banner.hidden=!active||!aiming;if(!banner.hidden)banner.textContent=curr().name+' 照準中・残り'+Math.ceil(Math.max(0,aimUntil-now)/1000)+'秒';
  const result=document.getElementById('result');
  if(usedNamepu&&result.classList.contains('show'))showNamepuVictory();
  else if(!result.classList.contains('show')){
   result.classList.remove('ultimate-namepu-victory');
   delete result.dataset.ultimateNamepu;
  }
  // Keep ultimate timers and the simulation live at full refresh rate, but
  // paint its separate transparent canvas at 30fps on touch phones.
  if(!document.body.classList.contains('mobile-touch-input')||!lastFxPaint||now-lastFxPaint>=33){lastFxPaint=now;graphics(now)}
  requestAnimationFrame(tick);
 }
 requestAnimationFrame(tick);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
