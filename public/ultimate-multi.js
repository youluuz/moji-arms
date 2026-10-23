/* Glyph Strike v7.1: multiplayer presentation/controller; Go server is authoritative. */
(function(){
'use strict';
function boot(){
 if(!window.MojiUlt||!document.getElementById('arena'))return;
 const U=window.MojiUlt, pick=U.attachUI(document.querySelector('#joinArea .online-loadout'));
 const battle=U.attachUI(document.querySelector('#gameArea .game-wrap'));battle.showBattle(true);
 let chosen=localStorage.getItem('moji_ultimate_choice')||'roman';
 if(!U.byId[chosen])chosen='roman';
 const heard=new Map();
 let held=false;
 const banner=document.createElement('div');banner.className='ultimate-aiming-banner';banner.hidden=true;document.querySelector('#gameArea .game-wrap').append(banner);
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
  if(!p||roomState.phase!=='playing'||p.ultimateSpent||p.ultimateCharge<(U.byId[p.ultimate]||U.byId.roman).cost)return;
  send({type:'ultimate'});
 });
 function locked(){
  const p=roomState?.players?.find(p=>p.id===myId);
  return Boolean(p&&(p.ultimateAiming||p.namepuLeft>0||p.danceLeft>0));
 }
 function onFieldPointer(e){
  const p=roomState?.players?.find(p=>p.id===myId);
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
  const own=m.players.find(p=>p.id===myId);
  if(!own)return;
  if(m.phase==='playing'||m.phase==='ended'){
   const def=U.byId[own.ultimate]||U.byId.roman;
   battle.show(own.ultimate,own.ultimateCharge,own.ultimateSpent,own.ultimateAiming,own.ultimateAimLeft);
   banner.hidden=!own.ultimateAiming;
   if(!banner.hidden)banner.textContent=def.name+' 照準中・残り'+Math.ceil(own.ultimateAimLeft)+'秒';
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
   if(!p.alive)continue;
   c.save();c.textAlign='center';
   if(p.invincibleLeft>0){
    c.font='900 20px Georgia,serif';c.fillStyle='#fff1a8';c.shadowColor='#ffe9a5';c.shadowBlur=19;
    for(let k=0;k<3;k++){let a=t/400+k*Math.PI*2/3;c.fillText('無敵',p.x+48*Math.cos(a),p.y+33*Math.sin(a))}
   }
   if(p.danceLeft>0||p.namepuLeft>0){
    c.font='bold 25px sans-serif';c.fillStyle='#ffebaa';c.shadowColor='#f7a6dd';c.shadowBlur=11;
    c.fillText(p.namepuLeft>0?'😐 ♪ ♫':'♪ ♫ ♪',p.x,p.y-59+Math.sin(t/145)*7);
   }
   if(p.ultimateAiming){
    c.font='900 20px Georgia,serif';c.fillStyle='#ffe3a7';c.shadowColor='#ffb360';c.shadowBlur=14;
    c.fillText(p.ultimate==='roman'?'ロマン砲':'鈍化弾',p.x,p.y-64);
   }
   c.restore();
  }
  for(const b of m.bullets)if(b.special==='roman'||b.special==='slow'){
   c.save();c.textAlign='center';c.font=b.special==='roman'?'900 31px Georgia,serif':'bold 23px serif';
   c.fillStyle=b.special==='roman'?'#ffe6a4':'#a9bbff';c.shadowColor=b.special==='roman'?'#ffb44e':'#82adff';c.shadowBlur=23;
   c.fillText(b.ch,b.x,b.y-14);c.restore();
  }
 }
 function finish(m){
  const won=m.winner===myId,me=m.players.find(p=>p.id===myId);
  if(won&&me?.namepuUsed){
   document.querySelector('#onlineOutcome .online-outcome-card').classList.add('ultimate-gold-win');
   document.getElementById('onlineOutcomeTitle').textContent=U.victoryPhrase();
  }
 }
 window.MojiUltMulti={chosen:()=>chosen,locked,onFieldPointer,onState,drawWorld,finish};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
