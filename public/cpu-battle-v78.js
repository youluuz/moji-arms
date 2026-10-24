/* v7.8 — Real solo free-for-all: 1–9 independently armed, hostile CPUs. */
(function(){
'use strict';
const kinds=['attack','defense','heal','pierce','homing'];
const samples=['炎','氷','雷','風','光','影','剣','盾','星','龍','月','桜','嵐','薔','鐵','龘'];
const bots=[]; // Keep the same array for cover-generation collision checks.
window.enemies=bots;
let match=-1, chosenCount=1, initialized=false, roundStartAt=0, playerKills=0;
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
function equip(bot,i){
 // Guarantee all five action kinds each round, shuffle slots and vary each glyph.
 bot.id='cpu-'+i;bot.ch='敵';bot.loadout=shuffle(kinds.map(kind=>({...randomGlyph(),kind,ready:0})));
 bot.nextDecision=0;bot.intent=roll(5);bot.speed=125+roll(31);
 bot.ready=0;bot.guardReady=0;bot.targetId=null;
}
function spawnPosition(index,total,now,ignorePlayer=false){
 // Wider, collision-checked initial positions across the playable map.
 // The instant-safe-zone variant must remain within its 180-unit radius.
 const instant=typeof zoneSetting!=='undefined'&&zoneSetting==='instant';
 const cx=instant?900:1150,cy=instant?525:650;
 const rx=instant?136:750,ry=instant?136:430;
 for(let attempt=0;attempt<115;attempt++){
  const angle=(index/total)*Math.PI*2+attempt*.12;
  const x=Math.max(40,Math.min(WORLD_W-40,cx+rx*Math.cos(angle)));
  const y=Math.max(40,Math.min(WORLD_H-40,cy+ry*Math.sin(angle)));
  const blockers=[...bots,...(ignorePlayer?[]:[player])];
  if(blockers.some(o=>Math.hypot(o.x-x,o.y-y)<(instant?48:135)))continue;
  if(obstacles.some(o=>now-startTime<o.expires&&circleRect(x,y,30,o)))continue;
  return {x,y};
 }
 // Fallback remains inside bounds / the safe zone even on crowded maps.
 const angle=index/total*Math.PI*2;
 return {x:cx+Math.cos(angle)*(instant?115:630),y:cy+Math.sin(angle)*(instant?115:345)};
}
function startRound(token,now){
 bots.length=0;
 chosenCount=countSetting();
 playerKills=0;roundStartAt=now+3000;
 if(typeof enemy==='undefined'||!enemy)return;
 const own=spawnPosition(0,chosenCount+1,now,true);player.x=own.x;player.y=own.y;
 const first=spawnPosition(1,chosenCount+1,now);enemy.x=first.x;enemy.y=first.y;
 equip(enemy,0);bots.push(enemy);
 for(let i=1;i<chosenCount;i++){
  const pos=spawnPosition(i+1,chosenCount+1,now);
  const bot={x:pos.x,y:pos.y,hp:MAX_HP,speed:140,shield:0,shieldEnd:0,r:19};
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
function botAction(bot,target,now){
 const available=bot.loadout.filter(s=>now>=s.ready);
 if(!available.length)return;
 const urgent=bot.hp<MAX_HP*.55&&available.find(s=>s.kind==='heal');
 const risky=bullets.some(b=>b.sourceId!==bot.id&&Math.hypot(bot.x-b.x,bot.y-b.y)<140);
 const guard=risky&&available.find(s=>s.kind==='defense');
 const attacks=available.filter(s=>!['defense','heal'].includes(s.kind));
 let action=urgent||guard||(attacks.length?attacks[roll(attacks.length)]:null);
 if(!action&&risky)action=available.find(s=>s.kind==='defense');
 if(!action)return;
 const n=action.n;
 action.ready=now+slotCooldownMs(action.kind,n);
 if(action.kind==='heal'){
  bot.hp=Math.min(MAX_HP,bot.hp+n*HEAL_PER_STROKE);
 }else if(action.kind==='defense'){
  bot.shield=n*SHIELD_PER_STROKE;bot.shieldEnd=now+2300;
 }else{
  const angle=Math.atan2(target.y-bot.y,target.x-bot.x)+(Math.random()-.5)*.18;
  const speed=action.kind==='homing'?275:action.kind==='pierce'?430:345;
  bullets.push({x:bot.x,y:bot.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,
   n,owner:'e',sourceId:bot.id,life:action.kind==='homing'?4.8:2.4,ch:action.ch,
   homing:action.kind==='homing',pierce:action.kind==='pierce'});
 }
 window.MojiCpuBots.casts[action.kind]++;
}
function guide(b,target,dt){
 const wanted=Math.atan2(target.y-b.y,target.x-b.x),old=Math.atan2(b.vy,b.vx);
 const diff=Math.atan2(Math.sin(wanted-old),Math.cos(wanted-old));
 const next=old+Math.max(-3.8*dt,Math.min(3.8*dt,diff));
 const speed=Math.hypot(b.vx,b.vy)||310;
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
 if(name)name.textContent='◆ CPU 残り '+living.length+' / '+chosenCount+'体';
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
 const hud=document.querySelector('#gameScreen .hud .hud-line span');
 const arena=document.querySelector('#gameScreen .arena-shell');
 if(arena&&!document.getElementById('cpuKillScore')){
  arena.insertAdjacentHTML('beforeend','<div id="cpuKillScore" class="match-kill-score" aria-label="自分のキル数">⚔ キル 0</div><div id="cpuBattleCountdown" class="match-countdown" role="status" aria-live="polite" hidden>3</div>');
 }
 const other=document.querySelectorAll('#gameScreen .hud .hud-line>span:first-child')[1];
 if(other)other.innerHTML='<span id="cpuCountLive">◆ CPU 残り 1 / 1体</span>';
 const oldDraw=draw;
 draw=function(now){
  oldDraw(now);
  if(match!==matchToken||!running&&!bots.length)return;
  const score=document.getElementById('cpuKillScore');
  if(score)score.textContent='⚔ キル '+playerKills;
  const cx=ctx;cx.save();cx.textAlign='center';cx.textBaseline='middle';
  // Original first CPU labeled 敵 uses a separate drawing path. Give it
  // the same visible overhead HP bar as the additional enemies.
  if(enemy.hp>0){
   const x=enemy.x-cam.x,y=enemy.y-cam.y;
   if(x>=-60&&y>=-60&&x<=cpuView.w+60&&y<=cpuView.h+60){
    cx.fillStyle='#142032';cx.fillRect(x-31,y-46,62,8);
    cx.fillStyle='#ff88a5';cx.fillRect(x-30,y-45,60*Math.max(0,enemy.hp/MAX_HP),6);
    cx.strokeStyle='#ffe1ea';cx.lineWidth=1;cx.strokeRect(x-31,y-46,62,8);
   }
  }
  for(const bot of bots.slice(1)){
   if(bot.hp<=0)continue;
   const x=bot.x-cam.x,y=bot.y-cam.y;
   if(x<-60||y<-60||x>cpuView.w+60||y>cpuView.h+60)continue;
   cx.save();
   cx.shadowBlur=10;cx.shadowColor='#f68ca6';
   cx.fillStyle='#b34762';cx.beginPath();cx.arc(x,y,20,0,Math.PI*2);cx.fill();
   cx.shadowBlur=0;cx.strokeStyle='#fff0f0';cx.lineWidth=2.5;cx.stroke();
   cx.font='bold 18px sans-serif';cx.fillStyle='#fff';cx.fillText(bot.loadout?.[0]?.ch||'敵',x,y+1);
   cx.fillStyle='#1a202c';cx.fillRect(x-25,y-38,50,5);
   cx.fillStyle='#f6829b';cx.fillRect(x-25,y-38,50*bot.hp/MAX_HP,5);
   cx.restore();
  }
  // Overlay additional enemies on the existing CPU battle minimap.
  const mw=cpuView.w<700?110:145,mh=cpuView.w<700?66:82,mx=cpuView.w-mw-12,my=10;
  for(const bot of bots.slice(1)){
   if(bot.hp<=0)continue;
   cx.fillStyle='#ff9cad';cx.beginPath();cx.arc(mx+bot.x/WORLD_W*mw,my+bot.y/WORLD_H*mh,3.2,0,Math.PI*2);cx.fill();
  }
  cx.restore();
  updateHpDisplay();
 };
 const originalDamage=damage;
 damage=function(actor,amount,now,pierce,...rest){
  if(match!==matchToken||!bots.includes(actor))return originalDamage.call(this,actor,amount,now,pierce,...rest);
  if(window.MojiCpuUltimateState?.danceActive?.())return;
  if(actor.hp<=0)return;
  if(!pierce&&actor.shieldEnd>now&&actor.shield>0){
   const absorbed=Math.min(actor.shield,amount);actor.shield-=absorbed;amount-=absorbed;
  }
  const old=actor.hp;actor.hp=Math.max(0,actor.hp-amount);
  if(rest[0]?.owner==='p'){
   battleDamage+=Math.max(0,old-actor.hp);
   if(old>0&&actor.hp<=0)playerKills++;
  }
  if(rest[0]?.ultimate==='slow'&&actor.hp>0)actor.slowUntil=now+3000;
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
   moveActor(player,vx/mag*player.speed*dt,vy/mag*player.speed*dt,now);
   for(const bot of alive()){
    const target=chooseTarget(bot,now);if(!target)continue;
    const dx=target.x-bot.x,dy=target.y-bot.y,d=Math.hypot(dx,dy)||1;
    const approach=d<170?-1:d>310?1:0;
    const speed=bot.speed*(bot.slowUntil>now?.65:1);
    moveActor(bot,dx/d*approach*speed*dt,dy/d*approach*speed*dt+Math.sin(now/600+Number(bot.id.slice(4)))*24*dt,now);
    if(now>=bot.nextDecision){botAction(bot,target,now);bot.nextDecision=now+450+roll(430);}
   }
   const elapsed=(now-startTime)/1000;
   zoneRadius=zoneSetting==='none'?1350:zoneSetting==='instant'?180:Math.max(180,1350-1170*Math.min(1,elapsed/({slow:180,normal:120,fast:70}[zoneSetting]||120)));
   const center={x:900,y:525};
   const outside=Math.hypot(player.x-center.x,player.y-center.y)>zoneRadius;
   zoneWarningUpdate(outside,now);
   for(const actor of [player,...alive()]){
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
   if(running&&down)act(now);
   for(let i=bullets.length-1;i>=0&&running;i--){
    const b=bullets[i],t=projectileTarget(b);
    if(b.homing&&t)guide(b,t,dt);
    b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
    const hitWall=!b.pierce&&obstacles.some(o=>now-startTime<o.expires&&circleRect(b.x,b.y,7,o));
    if(hitWall){bullets.splice(i,1);continue}
    // All CPUs are independent enemies, including CPU-vs-CPU friendly-fire.
    const targets=b.owner==='p'?alive():[player,...alive()].filter(a=>a.id!==b.sourceId);
    const hit=targets.find(a=>a.hp>0&&Math.hypot(a.x-b.x,a.y-b.y)<a.r+9);
    if(hit){damage(hit,b.n*DAMAGE_PER_STROKE,now,b.pierce,b);bullets.splice(i,1);}
    else if(b.life<=0||b.x<0||b.x>WORLD_W||b.y<0||b.y>WORLD_H)bullets.splice(i,1);
   }
  }
  document.getElementById('zoneInfo').textContent=zoneSetting==='none'?'安全エリア：収縮なし':zoneSetting==='instant'?'安全エリア：最小から開始':'安全エリア半径：'+Math.round(zoneRadius)+' / 1350';
  draw(now);
  if(running)requestAnimationFrame(t=>loop(t,token));
 };
 window.MojiCpuBots={getBots:()=>bots,count:countSetting,kills:()=>playerKills,countdownLeft:()=>Math.max(0,(roundStartAt-performance.now())/1000),lastLoadouts:[],rounds:0,casts:Object.fromEntries(kinds.map(k=>[k,0]))};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();