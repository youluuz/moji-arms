/* v7.8 — Real solo free-for-all: 1–9 independently armed, hostile CPUs. */
(function(){
'use strict';
const kinds=['attack','defense','heal','pierce','homing'];
const samples=['炎','氷','雷','風','光','影','剣','盾','星','龍','月','桜','嵐','薔','鐵','龘'];
const bots=[]; // Keep the same array for cover-generation collision checks.
window.enemies=bots;
let match=-1, chosenCount=1, initialized=false, roundStartAt=0, playerKills=0, mapFactor=1;
let cpuSpectating=false,cpuWatchIndex=0,cpuSpectateTarget=null;
// Use the NAME entered on the common login screen in every solo result,
// including the special Namepu ending. Never interpret saved career stats as
// a player's identity, and never inject this user text as HTML.
function loginWinnerName(){
 let name='';
 try{name=sessionStorage.getItem('moji_player_name')||'';}catch(_){}
 if(!name){try{name=localStorage.getItem('moji_player_name')||'';}catch(_){}}
 if(!name)name=document.querySelector('#loginScreen input[name="name"],#loginScreen #playerName,#loginScreen #loginName')?.value||'';
 return String(name).trim().slice(0,32)||'あなた';
}
window.MojiLoginWinnerName=loginWinnerName;
const roll=n=>Math.floor(Math.random()*n);
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=roll(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
function alive(){return bots.filter(b=>b.hp>0);}
function countSetting(){return Math.max(1,Math.min(9,Number(document.getElementById('cpuBotCount')?.value)||1));}
function setupPicker(){
 const row=document.querySelector('#battleSettings .mode-quickrow');
 if(!row||document.getElementById('cpuBotCount'))return;
 const wrap=document.createElement('div');wrap.id='cpuCountSetting';wrap.className='setting cpu-count-setting';
 wrap.innerHTML='<label class="label" for="cpuBotCount">CPUの数（全員が敵）</label><select id="cpuBotCount" aria-label="CPU対戦相手の人数">'+
 Array.from({length:9},(_,i)=>'<option value="'+(i+1)+'">'+(i+1)+'体（計'+(i+2)+'人）</option>').join('')+
 '</select><small>CPU同士も攻撃し合います。人数は次の試合から反映。</small>';
 row.insertAdjacentElement('afterend',wrap);
 const picker=wrap.querySelector('select');
 try{picker.value=localStorage.getItem('moji_cpu_count')||'1';}catch(_){}
 picker.addEventListener('change',()=>{try{localStorage.setItem('moji_cpu_count',picker.value);}catch(_){}});
 const mode=document.getElementById('modeSelect');
 const refresh=()=>{wrap.hidden=!['normal','custom'].includes(mode?.value);};
 mode?.addEventListener('change',refresh);refresh();
}
function randomGlyph(){
 for(let i=0;i<12;i++){
  const ch=window.MojiRandom?.roll?.(new Set())||samples[roll(samples.length)];
  const n=typeof getStrokeCount==='function'?getStrokeCount(ch):null;
  if(Number.isInteger(n)&&n>=1&&n<=45)return {ch,n};
 }
 const ch=samples[roll(samples.length)],n=typeof getStrokeCount==='function'?getStrokeCount(ch):8;
 return {ch,n:Number.isInteger(n)?n:8};
}
// Slightly gentler CPU opponents in both normal and custom solo battles.
// Attacks alone take 8% longer to recharge and initial shots scatter 15% more.
// Movement, safe-zone decisions, defense, healing and all player stats are unchanged.
const CPU_ATTACK_COOLDOWN_FACTOR=1.08;
const CPU_AIM_SPREAD_FACTOR=1.15;
const cpuStyles=['rusher','skirmisher','sniper','survivor','ambusher'];
let cpuStyleOffset=0;
function equip(bot,i){
 // Distinct, persistent personalities for each CPU; reassigned on every round.
 bot.id='cpu-'+i;bot.ch='敵';bot.loadout=shuffle(kinds.map(kind=>({...randomGlyph(),kind,ready:0})));
 bot.style=cpuStyles[(i+cpuStyleOffset)%cpuStyles.length];
 bot.nextDecision=0;bot.intent=roll(5);bot.speed=125+roll(31);
 bot.flank=roll(2)?1:-1;bot.switchFlankAt=0;bot.tacticUntil=0;
 bot.aggression=.65+Math.random()*.7;bot.dodgeUntil=0;
 bot.ready=0;bot.guardReady=0;bot.targetId=null;bot.hardenUntil=0;
}
function spawnPosition(index,total,now,ignorePlayer=false){
 // Wider, collision-checked positions. Prior code only required 135px
 // between CPU fighters, so a crowded match could still spawn two almost
 // together after a wall displaced their assigned points.
 const instant=typeof zoneSetting!=='undefined'&&zoneSetting==='instant';
 const cx=WORLD_W/2,cy=WORLD_H/2;
 const rx=(instant?136:820)*mapFactor,ry=(instant?136:480)*mapFactor;
 const minimum=instant?48:335;
 const blockers=[...bots,...(ignorePlayer?[]:[player])];
 let best=null,bestGap=-1;
 for(let attempt=0;attempt<260;attempt++){
  const angle=(index/total)*Math.PI*2+attempt*.081;
  const x=Math.max(40,Math.min(WORLD_W-40,cx+rx*Math.cos(angle)));
  const y=Math.max(40,Math.min(WORLD_H-40,cy+ry*Math.sin(angle)));
  if(obstacles.some(o=>now-startTime<o.expires&&circleRect(x,y,30,o)))continue;
  const gap=blockers.length?Math.min(...blockers.map(o=>Math.hypot(o.x-x,o.y-y))):Infinity;
  if(gap>=minimum)return {x,y};
  if(gap>bestGap){best={x,y};bestGap=gap}
 }
 // If the terrain and a crowded instant-shrink zone leave no valid strict
 // spawn, choose the farthest available clear point rather than a blind
 // fallback that might land on another player.
 if(best)return best;
 const angle=index/total*Math.PI*2;
 return {x:cx+Math.cos(angle)*(instant?115:695)*mapFactor,y:cy+Math.sin(angle)*(instant?115:398)*mapFactor};
}
function startRound(token,now){
 cpuSpectating=false;cpuWatchIndex=0;cpuSpectateTarget=null;
 document.getElementById('cpuDeathChoice')?.remove();
 document.getElementById('cpuWatchControls')?.remove();
 bots.length=0;
 cpuStyleOffset=roll(cpuStyles.length);
 chosenCount=countSetting();
 // Two total fighters use 80% of the legacy map; ten use 150%.
 const participants=chosenCount+1;
 mapFactor=.8+(participants-2)*.7/8;
 WORLD_W=Math.round(2300*mapFactor);
 WORLD_H=Math.round(1300*mapFactor);
 window.MojiBattleMap={w:WORLD_W,h:WORLD_H,scale:mapFactor,players:participants};
 // Generate fresh cover within the new bounds. Legacy init built for 2300x1300.
 obstacles=buildObstacles();
 zoneRadius=(zoneSetting==='instant'?180:1350)*mapFactor;
 playerKills=0;roundStartAt=now+3000;
 if(typeof enemy==='undefined'||!enemy)return;
 const own=spawnPosition(0,chosenCount+1,now,true);player.x=own.x;player.y=own.y;
 const first=spawnPosition(1,chosenCount+1,now);enemy.x=first.x;enemy.y=first.y;
 equip(enemy,0);bots.push(enemy);
 for(let i=1;i<chosenCount;i++){
  const pos=spawnPosition(i+1,chosenCount+1,now);
  const bot={x:pos.x,y:pos.y,hp:MAX_HP,speed:140,shield:0,shieldEnd:0,hardenUntil:0,r:19};
  equip(bot,i);bots.push(bot);
 }
 window.MojiCpuBots.rounds++;
 window.MojiCpuBots.lastLoadouts=bots.map(b=>b.loadout.map(s=>s.kind+':'+s.ch));
 const label=document.getElementById('cpuCountLive');
 if(label)label.textContent='CPU 残り '+chosenCount+' / '+chosenCount+'体';
}
function rivals(bot){
 return [player,...alive()].filter(x=>x!==bot&&x.hp>0&&(x!==player||!window.MojiCpuUltimateState?.invisibleActive?.()));
}
function chooseTarget(bot,now){
 const options=rivals(bot);
 if(!options.length)return null;
 // Hold a target briefly to avoid frame-by-frame direction jitter.
 if(bot.target && options.includes(bot.target) && now<(bot.retargetAt||0))return bot.target;
 bot.target=Math.random()<.46?options[roll(options.length)]:
  options.reduce((a,b)=>Math.hypot(bot.x-a.x,bot.y-a.y)<Math.hypot(bot.x-b.x,bot.y-b.y)?a:b);
 bot.retargetAt=now+900+roll(1250);
 return bot.target;
}
// Evacuate the shrinking ring before pursuing a target or strafing around one.
// Using the current arena radius makes this work for normal, fast, slow and
// instant shrink, without changing the no-shrink mode or projectile hitboxes.
function moveIntoSafeZone(bot,now,dt){
 bot.zoneUrgent=false;bot.zoneCaution=false;
 if(zoneSetting==='none'||bot.hp<=0)return false;
 const dx=WORLD_W/2-bot.x,dy=WORLD_H/2-bot.y;
 const distance=Math.hypot(dx,dy);
 const margin=Math.min(110*mapFactor,zoneRadius*.24);
 const safeRadius=Math.max(36*mapFactor,zoneRadius-margin);
 bot.zoneUrgent=distance>=zoneRadius-8*mapFactor;
 bot.zoneCaution=distance>safeRadius;
 if(!bot.zoneCaution)return false;
 // Hardening prevents movement but the bot may still use healing and defense.
 if(now<bot.hardenUntil)return true;
 const ux=dx/Math.max(1,distance),uy=dy/Math.max(1,distance);
 const step=bot.speed*dt*1.06,x0=bot.x,y0=bot.y;
 moveActor(bot,ux*step,uy*step,now);
 // A straight line to center can hit cover. Slide diagonally inward and
 // alternate the bypass direction only after a persistent blockage.
 if(Math.hypot(bot.x-x0,bot.y-y0)<step*.18){
  if(now>(bot.zoneBypassUntil||0)){
   bot.zoneBypassSide=bot.zoneBypassSide===-1?1:-1;
   bot.zoneBypassUntil=now+1100;
  }
  const side=bot.zoneBypassSide||1;
  moveActor(bot,(ux*.55-uy*side*.8)*step,(uy*.55+ux*side*.8)*step,now);
 }
 return true;
}
function botAction(bot,target,now){
 const hardened=now<bot.hardenUntil;
 // Feet and offensive equipment are locked; self-heal and shield stay available.
 const available=bot.loadout.filter(s=>now>=s.ready&&(!hardened||s.kind==='heal'||s.kind==='defense'));
 if(!available.length)return;
 const urgent=bot.hp<MAX_HP*(bot.style==='survivor'?.72:.48)&&available.find(s=>s.kind==='heal');
 const risky=bullets.some(b=>b.sourceId!==bot.id&&Math.hypot(bot.x-b.x,bot.y-b.y)<(bot.style==='survivor'?215:145));
 const guard=(risky || (bot.style==='survivor'&&bot.hp<MAX_HP*.6&&Math.random()<.27))
  &&available.find(s=>s.kind==='defense');
 const attacks=available.filter(s=>!['defense','heal'].includes(s.kind));
 const preferences={
  rusher:['attack','pierce','homing'],
  skirmisher:['homing','attack','pierce'],
  sniper:['pierce','homing','attack'],
  survivor:['homing','pierce','attack'],
  ambusher:['pierce','attack','homing']
 };
 const kindsPreferred=preferences[bot.style]||preferences.skirmisher;
 const preferred=kindsPreferred.map(kind=>attacks.find(s=>s.kind===kind)).filter(Boolean);
 let action=hardened
  ? (urgent||(bot.hp<MAX_HP&&available.find(s=>s.kind==='heal'))||guard||available.find(s=>s.kind==='defense'))
  : (urgent||guard||(preferred.length?(Math.random()<.64?preferred[0]:preferred[roll(preferred.length)]):null));
 if(!action&&!hardened&&risky)action=available.find(s=>s.kind==='defense');
 if(!action)return;
 // Keep mobility as the priority at a dangerous ring edge: don't stop to
 // duel unless healing or protecting against an incoming projectile.
 if(bot.zoneUrgent && action.kind!=='heal'&&action.kind!=='defense')return;
 if(bot.zoneCaution && action.kind!=='heal'&&action.kind!=='defense'&&Math.random()<.7)return;
 const n=action.n;
 action.ready=now+slotCooldownMs(action.kind,n)*
  (action.kind==='heal'||action.kind==='defense'?1:CPU_ATTACK_COOLDOWN_FACTOR);
 if(action.kind==='heal'){
  bot.hp=Math.min(MAX_HP,bot.hp+n*3.4);
 }else if(action.kind==='defense'){
  bot.shield=n*SHIELD_PER_STROKE;bot.shieldEnd=now+2300;
 }else{
  const angle=Math.atan2(target.y-bot.y,target.x-bot.x)+(Math.random()-.5)*
   (bot.style==='sniper'?.07:bot.style==='rusher'?.28:.18)*CPU_AIM_SPREAD_FACTOR;
  const speed=action.kind==='homing'?220:action.kind==='pierce'?430:345;
  bullets.push({x:bot.x,y:bot.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,
   n,owner:'e',sourceId:bot.id,life:action.kind==='homing'?3.8:2.4,ch:action.ch,
   homing:action.kind==='homing',pierce:action.kind==='pierce'});
 }
 window.MojiCpuBots.casts[action.kind]++;
}
function guide(b,target,dt){
 const wanted=Math.atan2(target.y-b.y,target.x-b.x),old=Math.atan2(b.vy,b.vx);
 const diff=Math.atan2(Math.sin(wanted-old),Math.cos(wanted-old));
 const next=old+Math.max(-3.048903*dt,Math.min(3.048903*dt,diff));
 const speed=Math.hypot(b.vx,b.vy)||220;
 b.vx=Math.cos(next)*speed;b.vy=Math.sin(next)*speed;
}
function projectileTarget(b){
 const candidates=b.owner==='p'?alive():[player,...alive()].filter(a=>a.id!==b.sourceId&&a.hp>0&&(a!==player||!window.MojiCpuUltimateState?.invisibleActive?.()));
 if(!candidates.length)return null;
 return candidates.reduce((a,c)=>Math.hypot(c.x-b.x,c.y-b.y)<Math.hypot(a.x-b.x,a.y-b.y)?c:a);
}
function updateHpDisplay(){
 const living=alive(),near=living.sort((a,b)=>Math.hypot(player.x-a.x,player.y-a.y)-Math.hypot(player.x-b.x,player.y-b.y))[0];
 const name=document.getElementById('cpuCountLive');
 if(name)name.textContent='◆ CPU 残り '+living.length+' / '+chosenCount+'体　MAP ×'+mapFactor.toFixed(2);
 const counter=document.getElementById('cpuAliveCount');
 if(counter){
  const total=chosenCount+1;
  const count=living.length+(player.hp>0?1:0);
  counter.textContent='👥 生存 '+count+' / '+total+'人';
  counter.setAttribute('aria-label','生存プレイヤー '+count+'人、参加 '+total+'人');
  const viewers=document.getElementById('cpuSpectatorCount');
  if(viewers)viewers.textContent='👁 観戦 '+(cpuSpectating?1:0);
 }
 if(near){
  document.getElementById('ehp').textContent=Math.ceil(near.hp);
  document.getElementById('ebar').style.width=Math.max(0,near.hp/MAX_HP*100)+'%';
 }else{
  document.getElementById('ehp').textContent='0';document.getElementById('ebar').style.width='0%';
 }
}
function boot(){
 if(initialized||typeof loop!=='function'||typeof draw!=='function'||typeof damage!=='function')return;
 initialized=true;
 setupPicker();
 // Lock real attacks during the map countdown; the display and aim still work.
 if(typeof act==='function'){
  const cast=act;
  act=function(...args){if(performance.now()<roundStartAt)return;return cast.apply(this,args);};
 }
 if(typeof requestCast==='function'){
  const request=requestCast;
  requestCast=function(...args){if(performance.now()<roundStartAt)return;return request.apply(this,args);};
 }
 // Keep survivor count + personal kills together in the battle HUD's top-right
 // corner, outside the arena canvas so its minimap is never obstructed.
 const hud=document.querySelector('#gameScreen .hud');
 if(hud&&!document.getElementById('cpuBattleScoreboard')){
  hud.insertAdjacentHTML('beforeend','<div id="cpuBattleScoreboard" class="moji-battle-score" role="group" aria-label="生存人数と自分のキル数"><span id="cpuSpectatorCount" class="match-spectator-count" aria-label="観戦人数">👁 観戦 0</span><span id="cpuAliveCount" class="match-alive-count" role="status" aria-live="off">👥 生存 2 / 2人</span><span id="cpuKillScore" class="match-kill-score" aria-label="自分のキル数">⚔ キル 0</span></div>');
 }
 const arena=document.querySelector('#gameScreen .arena-shell');
 if(arena&&!document.getElementById('cpuBattleCountdown')){
  arena.insertAdjacentHTML('beforeend','<div id="cpuBattleCountdown" class="match-countdown" role="status" aria-live="polite" hidden>3</div>');
 }
 const other=document.querySelectorAll('#gameScreen .hud .hud-line>span:first-child')[1];
 if(other)other.innerHTML='<span id="cpuCountLive">◆ CPU 残り 1 / 1体</span>';
 const oldDraw=draw;
 let lastPaint=0;
 draw=function(now){
  // On touch phones, preserve the full-speed battle simulation but cap only
  // expensive arena paint work at about 30 fps. This noticeably reduces
  // canvas load without affecting player movement, collision or cooldown.
  if(document.body.classList.contains('mobile-touch-input')&&lastPaint&&now-lastPaint<33)return;
  lastPaint=now;
  // The legacy camera follows player coordinates. Temporarily aim it at
  // the observed CPU for painting only; never alter the combat simulation.
  const oldPosition={x:player.x,y:player.y};
  if(cpuSpectating){
   const fighters=alive();
   if(!fighters.includes(cpuSpectateTarget))cpuSpectateTarget=fighters[0]||null;
   if(cpuSpectateTarget){player.x=cpuSpectateTarget.x;player.y=cpuSpectateTarget.y;}
  }
  try{oldDraw(now)}finally{player.x=oldPosition.x;player.y=oldPosition.y}
  if(match!==matchToken||!running&&!bots.length)return;
  const score=document.getElementById('cpuKillScore');
  if(score)score.textContent='⚔ キル '+playerKills;
  window.MojiWeaponVisual?.syncSoloBattle(typeof slots==='undefined'?[]:slots);
  const cx=ctx;cx.save();cx.textAlign='center';cx.textBaseline='middle';
  // Shared enemy health bar for EVERY CPU, including the original first
  // enemy. Keep it identical in size and position: 50x5px at y-38.
  // Avatars use the legacy drawHeroIcon for all fighters, preserving the
  // player's equipped cosmetics and the same base geometry/typography.
  function drawCpuHpBar(bot){
   if(bot.hp<=0)return;
   const x=bot.x-cam.x,y=bot.y-cam.y;
   if(x<-60||y<-60||x>cpuView.w+60||y>cpuView.h+60)return;
   cx.save();
   cx.fillStyle='#1a202c';cx.fillRect(x-25,y-38,50,5);
   cx.fillStyle='#f6829b';cx.fillRect(x-25,y-38,50*Math.max(0,Math.min(1,bot.hp/MAX_HP)),5);
   cx.restore();
  }
  // Paint EVERY enemy exactly once in screen coordinates, including the
  // original legacy "敵" fighter. The legacy map painter no longer paints
  // that first CPU: one common icon and one 50x5 HP bar for all enemies.
  for(const bot of bots){
   if(bot.hp<=0)continue;
   const x=bot.x-cam.x,y=bot.y-cam.y;
   if(x<-60||y<-60||x>cpuView.w+60||y>cpuView.h+60)continue;
   cx.save();
   if(bot.shieldEnd>now && bot.shield>0){
    cx.strokeStyle='#73e9fa';cx.lineWidth=4;
    cx.beginPath();cx.arc(x,y,35,0,Math.PI*2);cx.stroke();
   }
   drawHeroIcon(cx,x,y,bot.loadout?.[0]?.ch||'敵',true,now/1000);
   cx.restore();
  }
  for(const bot of bots)drawCpuHpBar(bot);
  // Full-map dance: each additional CPU also gets a disco ball and notes.
  // The original enemy already receives the same overlay from ultimate-cpu.js.
  if(window.MojiCpuUltimateState?.danceActive?.()){
   for(const bot of bots.slice(1)){
    if(bot.hp<=0)continue;
    const x=bot.x-cam.x,y=bot.y-cam.y;
    if(x<-90||y<-160||x>cpuView.w+90||y>cpuView.h+90)continue;
    window.MojiWeaponVisual?.drawMirrorBall(cx,x,y-126,now);
    window.MojiWeaponVisual?.drawDanceAura(cx,x,y,now);
    cx.save();cx.fillStyle='#ffebaa';cx.font='bold 24px sans-serif';
    cx.shadowColor='#f7a6dd';cx.shadowBlur=11;cx.fillText('♪ ♫ ♪',x,y-76+Math.sin(now/135)*7);cx.restore();
   }
  }
  // Stun visuals over EVERY CPU, including the first enemy drawn by the legacy renderer.
  for(const bot of bots){
   if(bot.hp<=0||!(bot.hardenUntil>now))continue;
   const x=bot.x-cam.x,y=bot.y-cam.y;
   if(x<-70||y<-70||x>cpuView.w+70||y>cpuView.h+70)continue;
   cx.save();cx.strokeStyle='#a9f3ff';cx.fillStyle='#98e9ff33';cx.lineWidth=3;cx.shadowColor='#8ddfff';cx.shadowBlur=12;
   cx.beginPath();cx.moveTo(x-25,y-24);cx.lineTo(x+17,y-29);cx.lineTo(x+29,y-4);
   cx.lineTo(x+22,y+28);cx.lineTo(x-22,y+24);cx.lineTo(x-30,y-3);cx.closePath();cx.fill();cx.stroke();
   cx.shadowBlur=0;cx.fillStyle='#ecffff';cx.font='bold 13px sans-serif';
   cx.fillText('🔒 硬直 '+((bot.hardenUntil-now)/1000).toFixed(1)+'秒',x,y-80);cx.restore();
  }
  // Overlay additional enemies on the existing CPU battle minimap.
  const mw=cpuView.w<700?110:145,mh=cpuView.w<700?66:82,mx=cpuView.w-mw-12,my=10;
  for(const bot of bots.slice(1)){
   if(bot.hp<=0)continue;
   cx.fillStyle='#ff9cad';cx.beginPath();cx.arc(mx+bot.x/WORLD_W*mw,my+bot.y/WORLD_H*mh,3.2,0,Math.PI*2);cx.fill();
  }
  // Draw a recognizable silhouette around the fired character itself.
  // Redraw atop legacy bare-character shots without changing collision behavior.
  if(window.MojiWeaponVisual)for(const bullet of bullets)
   window.MojiWeaponVisual.drawProjectile(cx,{...bullet,x:bullet.x-cam.x,y:bullet.y-cam.y});
  cx.restore();
  updateHpDisplay();
 };
 // Replace the old lose-only result with a neutral winner announcement.
 // In CPU free-for-all, losing with several surviving CPUs does not yet
 // establish an individual champion, so state that honestly.
 if(typeof showResult==='function'){
  const oldResult=showResult;
  showResult=function(won,...args){
   const value=oldResult.call(this,won,...args);
   const others=alive();
   if(!won&&player.hp<=0&&others.length>1&&!cpuSpectating){
    const arena=document.querySelector('#gameScreen .arena-shell')||document.getElementById('gameScreen');
    if(arena&&!document.getElementById('cpuDeathChoice')){
     const chooser=document.createElement('div');
     chooser.id='cpuDeathChoice';
     chooser.innerHTML='<div><strong>戦闘不能！</strong><p>ロビーに戻るか、CPU同士の残りの試合を観戦できます。</p><button type="button" id="cpuChooseWatch">👁 観戦する</button><button type="button" id="cpuChooseLobby">↩ ロビーに戻る</button></div>';
     document.body.append(chooser);
     document.getElementById('cpuChooseWatch').onclick=()=>{
      chooser.remove();cpuSpectating=true;cpuWatchIndex=0;cpuSpectateTarget=alive()[0]||null;
      const game=document.getElementById('gameScreen');
      game?.classList.remove('hidden');game?.classList.add('active');
      document.getElementById('resultScreen')?.classList.add('hidden');
      // The legacy CPU result is actually #result.show, not #resultScreen.
      // Dismiss it so its backdrop cannot intercept spectator controls.
      const result=document.getElementById('result');
      if(result){result.classList.remove('show');result.setAttribute('aria-hidden','true');}
      document.body.classList.add('in-match','cpu-spectating');
      const controls=document.createElement('div');controls.id='cpuWatchControls';
      controls.innerHTML='<button type="button" id="cpuWatchPrev">◀ 前</button><span id="cpuWatchTarget">👁 観戦中</span><button type="button" id="cpuWatchNext">次 ▶</button><button type="button" id="cpuWatchExit">ロビーへ戻る</button>';
      // Reserve a real row ABOVE the map, not an absolute overlay on it.
      // Works in desktop and mobile layouts (including the relocated stick).
      const mapRow=arena.closest('.moji-map-with-stick')||arena;
      mapRow.parentElement.insertBefore(controls,mapRow);
      const shift=direction=>{
       const living=alive();if(!living.length)return;
       cpuWatchIndex=(cpuWatchIndex+direction+living.length)%living.length;
       cpuSpectateTarget=living[cpuWatchIndex];
      };
      document.getElementById('cpuWatchPrev').onclick=()=>shift(-1);
      document.getElementById('cpuWatchNext').onclick=()=>shift(1);
      document.getElementById('cpuWatchExit').onclick=()=>document.getElementById('retreat')?.click();
      down=false;keys={};queuedCast=null;running=true;
      // Update the spectator badge and chosen target immediately rather than
      // waiting for the next canvas frame on throttled mobile devices.
      const watcher=document.getElementById('cpuSpectatorCount');
      if(watcher)watcher.textContent='👁 観戦 1';
      const targetLabel=document.getElementById('cpuWatchTarget');
      if(targetLabel&&cpuSpectateTarget)targetLabel.textContent='👁 観戦中：CPU '+(Number(cpuSpectateTarget.id?.split('-')[1]||0)+1);
      requestAnimationFrame(t=>loop(t,matchToken));
     };
     document.getElementById('cpuChooseLobby').onclick=()=>{chooser.remove();document.getElementById('retreat')?.click();};
    }
   }
   const winner=won?loginWinnerName():
    others.length===1?'CPU '+(Number(others[0].id?.split('-')[1]||0)+1):
    others.length>1?'未確定（CPU残り'+others.length+'体）':'引き分け';
   const title=document.getElementById('resultTitle');
   if(title){
    title.textContent='🏆 優勝：'+winner;
    // Personal KOs earned during THIS match, not lifetime achievements.
    // Keep the existing result layout, even for CPU custom games or a defeat.
    let tally=document.getElementById('cpuResultKills');
    if(!tally){
     tally=document.createElement('div');
     tally.id='cpuResultKills';
     tally.className='moji-result-kills';
     tally.setAttribute('role','status');
     title.insertAdjacentElement('afterend',tally);
    }
    tally.textContent='⚔ この試合の合計キル数：'+playerKills;
   }
   const status=document.getElementById('status');
   if(status)status.textContent='試合終了｜優勝：'+winner;
   // Once the genuine CPU match announces a win, show the special Namepu
   // victory immediately. Relying on the next animation frame alone can
   // miss it on a throttled mobile tab.
   if(won)window.MojiCpuNamepuVictory?.show?.();
   return value;
  };
 }
 const originalDamage=damage;
 damage=function(actor,amount,now,pierce,...rest){
  if(match!==matchToken||!bots.includes(actor))return originalDamage.call(this,actor,amount,now,pierce,...rest);
  if(window.MojiCpuUltimateState?.danceActive?.())return;
  if(actor.hp<=0)return;
  if(rest[0]?.ultimate==='roman'){amount=Math.max(amount,actor.hp);pierce=true} // Guaranteed KO without piercing obstacles.
  if(rest[0]?.ultimate==='slow'){pierce=true} // Hardening bullet bypasses shields, but not terrain.
  if(!pierce&&actor.shieldEnd>now&&actor.shield>0){
   const absorbed=Math.min(actor.shield,amount);actor.shield-=absorbed;amount-=absorbed;
  }
  const old=actor.hp;actor.hp=Math.max(0,actor.hp-amount);
  if(rest[0]?.owner==='p'){
   battleDamage+=Math.max(0,old-actor.hp);
   if(old>0&&actor.hp<=0)playerKills++;
  }
  if(rest[0]?.ultimate==='slow'&&actor.hp>0){actor.hardenUntil=now+3000;actor.nextDecision=Math.min(actor.nextDecision||now,now+250)}
  // Update the survivor badge immediately when a CPU dies, not only on
  // the next animation frame (which can be delayed on mobile browsers).
  if(actor.hp!==old)updateHpDisplay();
  if(actor.hp<=0 && !alive().length && running){
   running=false;
   document.getElementById('status').textContent='🏆 勝利！ すべてのCPUを撃破！';
   showResult(true);
  }
 };
 loop=function(now,token){
  if(token!==matchToken)return;
  let dt=Math.min(Math.max(0,(now-last)/1000),.05);last=now;
  if(running){
   if(match!==token){match=token;startRound(token,now);}
   if(cpuSpectating){down=false;keys={};queuedCast=null;}
   const countdown=document.getElementById('cpuBattleCountdown');
   if(now<roundStartAt){
    if(countdown){countdown.hidden=false;countdown.textContent=String(Math.max(1,Math.ceil((roundStartAt-now)/1000)));}
    draw(now);
    requestAnimationFrame(t=>loop(t,token));return;
   }
   if(countdown)countdown.hidden=true;
   // Global dance stops ALL CPU attacks, bullets and damage, not only the human.
   if(window.MojiCpuUltimateState?.danceActive?.()){
    draw(now);requestAnimationFrame(t=>loop(t,token));return;
   }
   let vx=(keys.d||keys.ArrowRight?1:0)-(keys.a||keys.ArrowLeft?1:0);
   let vy=(keys.s||keys.ArrowDown?1:0)-(keys.w||keys.ArrowUp?1:0);
   if(touch){vx=touch.x;vy=touch.y}
   const mag=Math.hypot(vx,vy)||1;
   if(!cpuSpectating)moveActor(player,vx/mag*player.speed*dt,vy/mag*player.speed*dt,now);
   // Evaluate the NEW shrinking radius before CPU navigation, not after.
   const elapsed=(now-startTime)/1000;
   zoneRadius=zoneSetting==='none'?1350*mapFactor:zoneSetting==='instant'?180*mapFactor:
    Math.max(180*mapFactor,(1350-1170*Math.min(1,elapsed/({slow:180,normal:120,fast:70}[zoneSetting]||120)))*mapFactor);
   const center={x:WORLD_W/2,y:WORLD_H/2};
   for(const bot of alive()){
    const hardened=now<bot.hardenUntil;
    const target=hardened?null:chooseTarget(bot,now);
    const escaping=moveIntoSafeZone(bot,now,dt);
    if(!escaping&&!hardened&&target){
     const dx=target.x-bot.x,dy=target.y-bot.y,d=Math.hypot(dx,dy)||1;
     const desired={
      rusher:[110,240],skirmisher:[225,400],sniper:[330,565],
      survivor:[380,580],ambusher:[180,360]
     }[bot.style]||[180,360];
     // Refresh a tactical phase every few seconds: each personality alternates
     // between holding ground, flanking and retreating instead of a fixed orbit.
     if(now>bot.tacticUntil){
      bot.tacticUntil=now+2100+roll(3600);
      bot.flank=roll(2)?1:-1;
      bot.tactic=roll(3); // 0: flank, 1: pressure, 2: caution
     }
     const hpRisk=bot.hp<MAX_HP*(bot.style==='survivor'?.7:.28);
     const retreat=hpRisk||(bot.tactic===2&&d<desired[1]);
     const approach=retreat&&d<desired[1]*1.15?-1:d<desired[0]?-1:d>desired[1]?1:0;
     const orbit=(bot.tactic===1?.17:bot.tactic===2?.34:.70)*bot.flank;
     const mx=dx/d*approach-dy/d*orbit;
     const my=dy/d*approach+dx/d*orbit;
     const magnitude=Math.max(1,Math.hypot(mx,my));
     const speed=bot.speed*(bot.style==='rusher'?1.12:bot.style==='sniper'?.87:1);
     moveActor(bot,mx/magnitude*speed*dt,my/magnitude*speed*dt,now);
    }
    if(now>=bot.nextDecision&&(hardened||target)){
     botAction(bot,target,now);
     const pace={rusher:[360,300],skirmisher:[450,450],sniper:[690,540],survivor:[510,620],ambusher:[580,570]}[bot.style]||[450,430];
     bot.nextDecision=now+pace[0]+roll(pace[1]);
    }
   }
   const outside=Math.hypot(player.x-center.x,player.y-center.y)>zoneRadius;
   zoneWarningUpdate(outside,now);
   for(const actor of [...(cpuSpectating?[]:[player]),...alive()]){
    if(Math.hypot(actor.x-center.x,actor.y-center.y)>zoneRadius)damage(actor,32*dt,now,true);
    if(!running)break;
   }
   if(queuedCast){
    if(now>queuedCast.deadline)queuedCast=null;
    else if(slots[queuedCast.selected]&&now>=slots[queuedCast.selected].ready){
     const saved=selected,aim=mouse,pending=queuedCast;
     queuedCast=null;selected=pending.selected;mouse=pending.aim;act(now);selected=saved;mouse=aim;
    }
   }
   if(running&&down&&!cpuSpectating)act(now);
   for(let i=bullets.length-1;i>=0&&running;i--){
    const b=bullets[i],t=projectileTarget(b);
    if(b.homing&&t)guide(b,t,dt);
    b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
    const hitWall=!b.pierce&&obstacles.some(o=>now-startTime<o.expires&&circleRect(b.x,b.y,7,o));
    if(hitWall){bullets.splice(i,1);continue}
    // All CPUs are independent enemies, including CPU-vs-CPU friendly-fire.
    // Invisibility defeats every homing projectile, even one already in flight.
    // Direct-fire, piercing and ordinary projectiles are still dangerous.
    const targets=b.owner==='p'?alive():[player,...alive()].filter(a=>a.id!==b.sourceId&&!(b.homing&&a===player&&window.MojiCpuUltimateState?.invisibleActive?.()));
    const hit=targets.find(a=>a.hp>0&&Math.hypot(a.x-b.x,a.y-b.y)<a.r+9);
    if(hit){damage(hit,(b.homing?b.n*3+10:b.pierce?b.n*6:Math.round(b.n*(7-.02*(b.n-1)))),now,b.pierce,b);bullets.splice(i,1);}
    else if(b.life<=0||b.x<0||b.x>WORLD_W||b.y<0||b.y>WORLD_H)bullets.splice(i,1);
   }
   if(cpuSpectating){
    const living=alive();
    if(!living.includes(cpuSpectateTarget))cpuSpectateTarget=living[0]||null;
    const label=document.getElementById('cpuWatchTarget');
    if(label)label.textContent='👁 観戦中：'+(cpuSpectateTarget?'CPU '+(Number(cpuSpectateTarget.id?.split('-')[1]||0)+1):'生存者なし');
    if(living.length<=1){
     cpuSpectating=false;running=false;
     document.body.classList.remove('cpu-spectating');
     const title=document.getElementById('cpuWatchTarget');
     if(title)title.textContent='🏆 優勝：'+(living.length?'CPU '+(Number(living[0].id?.split('-')[1]||0)+1):'引き分け');
     document.getElementById('status').textContent='観戦終了';
    }
   }
  }
  document.getElementById('zoneInfo').textContent=zoneSetting==='none'?'安全エリア：収縮なし':zoneSetting==='instant'?'安全エリア：最小から開始':'安全エリア半径：'+Math.round(zoneRadius)+' / '+Math.round(1350*mapFactor);
  draw(now);
  if(running)requestAnimationFrame(t=>loop(t,token));
 };
 window.MojiCpuBots={getBots:()=>bots,count:countSetting,dimensions:()=>({w:WORLD_W,h:WORLD_H,scale:mapFactor}),kills:()=>playerKills,countdownLeft:()=>Math.max(0,(roundStartAt-performance.now())/1000),lastLoadouts:[],rounds:0,casts:Object.fromEntries(kinds.map(k=>[k,0]))};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();