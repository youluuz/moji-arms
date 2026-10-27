/* Glyph Strike v7.1: multiplayer presentation/controller; Go server is authoritative. */
(function(){
'use strict';
function boot(){
 if(!window.MojiUlt||!document.getElementById('arena'))return;
 const U=window.MojiUlt, glyphSection=document.querySelector('#joinArea .online-loadout');
 const pick=U.attachUI(glyphSection);
 // Keep glyph examples/help with the five character inputs, then place the
 // six ultimate choices immediately below this character-selection section.
 glyphSection.insertAdjacentElement('afterend',pick.root);
 // Keep both existing five-slot random buttons with the loadout editor even
 // after that editor is mounted into a multiplayer room. They now appear
 // immediately before "必殺技を選択" rather than in its top heading.
 const randomAll=document.getElementById('randomAll');
 const randomEmoji=document.getElementById('randomEmoji');
 if(randomAll||randomEmoji){
  const randomBar=document.createElement('div');
  randomBar.className='moji-loadout-random-actions';
  randomBar.id='onlineBulkRandomBar';
  randomBar.setAttribute('role','group');
  randomBar.setAttribute('aria-label','武装5枠のまとめてランダム設定');
  for(const button of [randomAll,randomEmoji])if(button)randomBar.append(button);
  glyphSection.append(randomBar);
 }
 const battle=U.attachUI(document.querySelector('#gameArea .game-wrap'));battle.showBattle(true);
 // Its dedicated sixth cell is installed after the server renders five
 // regular cards (see showGame), never on top of the playable canvas.
 battle.root.classList.add('moji-ultimate-inline');
 window.MojiOnlineUltimateDock=()=>{
  const row=document.getElementById('cards');
  if(!row)return;
  row.classList.add('moji-six-slot-row');
  if(battle.root.parentElement!==row)row.append(battle.root);
 };
 let chosen=localStorage.getItem('moji_ultimate_choice')||'roman';
 if(!U.byId[chosen])chosen='roman';
 const heard=new Map();
 let lastRomanBullets=new Map(),romanImpacts=[];
 let held=false;
 const banner=document.createElement('div');banner.className='ultimate-aiming-banner';banner.hidden=true;document.querySelector('#gameArea .game-wrap').append(banner);
 const howto=document.createElement('div');
 howto.className='moji-battle-howto moji-outside-map';howto.setAttribute('role','note');
 howto.innerHTML='<span>🎯 タップ／クリックした位置へ攻撃！</span><small>左スティック／WASDで移動　・　下の武装で切替</small>';
 document.querySelector('#gameArea .game-wrap').insertAdjacentElement('beforebegin',howto);
 const hardenBanner=document.createElement('div');hardenBanner.className='ultimate-aiming-banner';hardenBanner.hidden=true;
 hardenBanner.style.cssText='background:#11374df2;color:#d7fcff;border-color:#a4f5ff;top:16%;';
 document.querySelector('#gameArea .game-wrap').append(hardenBanner);
 function select(id){
  if(!U.byId[id])return;
  chosen=id;try{localStorage.setItem('moji_ultimate_choice',id)}catch(e){}
  pick.show(chosen);
 }
 select(chosen);
 pick.picker.addEventListener('click',e=>{const b=e.target.closest('[data-ultimate]');if(b)select(b.dataset.ultimate)});
 battle.cast.addEventListener('click',e=>{
  e.preventDefault();
  const p=roomState?.players?.find(p=>p.id===myId);
  if(!p||roomState.phase!=='playing'||p.hardenedLeft>0||p.ultimateSpent||p.ultimateCharge<(U.byId[p.ultimate]||U.byId.roman).cost)return;
  send({type:'ultimate'});
 });
 function locked(){
  const p=roomState?.players?.find(p=>p.id===myId);
  return Boolean(p&&((p.ultimateAiming&&!(p.hardenedLeft>0))||p.namepuLeft>0||p.danceLeft>0));
 }
 function canUseSlot(kind){
  const p=roomState?.players?.find(p=>p.id===myId);
  return !locked()&&!(p?.hardenedLeft>0&&kind!=='heal'&&kind!=='defense');
 }
 function onFieldPointer(e){
  const p=roomState?.players?.find(p=>p.id===myId);
  if(p?.hardenedLeft>0)return false; // Aimed shot remains locked; tap may cast guard/heal.
  if(!p?.ultimateAiming)return false;
  // Aiming consumes only the battlefield tap, not joystick or equipment controls.
  if(e.pointerType==='mouse'&&e.button!==0)return true;
  e.preventDefault();
  if(setAimFromPointer(e)){
   showTapReticle(e);
   send({type:'ultimate-aim',aim});
  }
  return true;
 }
 function onState(m){
  // Effects follow authoritative projectile snapshots. No hit detection,
  // damage changes or extra network packets are sent by this renderer.
  const at=performance.now();
  if(m.phase==='playing'||m.phase==='ended'){
   const active=new Map();
   for(const b of m.bullets||[])if(b.special==='roman')active.set(b.owner,b);
   for(const [owner,b] of lastRomanBullets)if(!active.has(owner))
    romanImpacts.push({x:b.x,y:b.y,at});
   lastRomanBullets=active;
   romanImpacts=romanImpacts.filter(b=>at-b.at<720).slice(-12);
  } else {lastRomanBullets.clear();romanImpacts=[];}
  const own=m.players.find(p=>p.id===myId);
  if(!own)return;
  if(m.phase==='playing'||m.phase==='ended'){
   const def=U.byId[own.ultimate]||U.byId.roman;
   battle.show(own.ultimate,own.ultimateCharge,own.ultimateSpent,own.ultimateAiming,own.ultimateAimLeft);
   banner.hidden=!own.ultimateAiming;
   if(!banner.hidden)banner.textContent=def.name+' 照準中・残り'+Math.ceil(own.ultimateAimLeft)+'秒';
   hardenBanner.hidden=!(own.hardenedLeft>0);
   if(!hardenBanner.hidden)hardenBanner.textContent='🔒 硬直 '+own.hardenedLeft.toFixed(1)+'秒｜回復・防御のみOK';
   for(const p of m.players){
    const serial=p.ultimateSerial||0,last=heard.get(p.id)||0;
    if(serial>last && p.lastUltimate)U.play(p.lastUltimate);
    heard.set(p.id,serial);
   }
  }
 }
 function drawWorld(c,m){
  const t=performance.now();
  for(const p of m.players){
   if(!p.alive || (p.invisibleLeft>0 && p.id!==myId))continue;
   c.save();c.textAlign='center';
   if(p.invincibleLeft>0){
    c.font='900 20px Georgia,serif';c.fillStyle='#fff1a8';c.shadowColor='#ffe9a5';c.shadowBlur=19;
    for(let k=0;k<3;k++){let a=t/400+k*Math.PI*2/3;c.fillText('無敵',p.x+48*Math.cos(a),p.y-11+33*Math.sin(a))}
   }
   if(p.danceLeft>0||p.namepuLeft>0){
    window.MojiWeaponVisual?.drawMirrorBall(c,p.x,p.y-126,t);
    window.MojiWeaponVisual?.drawDanceAura(c,p.x,p.y,t);
    c.font='bold 25px sans-serif';c.fillStyle='#ffebaa';c.shadowColor='#f7a6dd';c.shadowBlur=11;
    c.fillText(p.namepuLeft>0?'😐 ♪ ♫':'♪ ♫ ♪',p.x,p.y-79+Math.sin(t/145)*7);
   }
   if(p.hardenedLeft>0){
    c.fillStyle='#73d9ff48';c.strokeStyle='#b7f6ff';c.lineWidth=3;c.shadowColor='#9feaff';c.shadowBlur=12;
    c.beginPath();c.moveTo(p.x-29,p.y-25);c.lineTo(p.x+20,p.y-30);c.lineTo(p.x+33,p.y-4);
    c.lineTo(p.x+24,p.y+30);c.lineTo(p.x-25,p.y+26);c.lineTo(p.x-33,p.y-5);c.closePath();c.fill();c.stroke();
    c.shadowBlur=0;c.fillStyle='#ecffff';c.font='bold 14px sans-serif';
    c.fillText('🔒 硬直 '+p.hardenedLeft.toFixed(1)+'秒',p.x,p.y-84);
   }
   if(p.romanWindupLeft>0)
    window.MojiRomanFX?.drawCharge(c,p.x,p.y,t,1-Math.min(1,p.romanWindupLeft));
   if(p.ultimateAiming){
    c.font='900 20px Georgia,serif';c.fillStyle='#ffe3a7';c.shadowColor='#ffb360';c.shadowBlur=14;
    c.fillText(p.ultimate==='roman'?'ロマン砲':'硬化弾',p.x,p.y-81);
   }
   c.restore();
  }
  for(const b of m.bullets)if(b.special==='roman'||b.special==='slow'){
   if(b.special==='roman')window.MojiRomanFX?.drawShot(c,b.x,b.y,b.angle,t);
   else{
    c.save();c.textAlign='center';c.font='bold 26px serif';
    c.fillStyle='#a9bbff';c.shadowColor='#82adff';c.shadowBlur=26;
    c.fillText(b.ch,b.x,b.y-14);c.restore();
   }
  }
  for(const effect of romanImpacts)
   window.MojiRomanFX?.drawImpact(c,effect.x,effect.y,t-effect.at);
 }
 function finish(m){
  const won=m.winner===myId,me=m.players.find(p=>p.id===myId);
  if(won&&me?.namepuUsed){
   document.querySelector('#onlineOutcome .online-outcome-card').classList.add('ultimate-gold-win');
   document.getElementById('onlineOutcomeTitle').textContent='優勝：'+(me.name||'あなた')+' 👑';
   document.getElementById('onlineOutcomeReward').textContent+=(document.getElementById('onlineOutcomeReward').textContent?' ／ ':'')+U.victoryPhrase();
   window.MojiNamepuVictory?.showOnline({name:me.name||'あなた',icon:me.ch||'武',kills:me.kills||0,hp:me.hp});
  }
 }
 window.MojiUltMulti={chosen:()=>chosen,locked,canUseSlot,onFieldPointer,onState,drawWorld,finish};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
