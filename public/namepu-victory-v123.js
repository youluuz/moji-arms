/* Legendary Namepu results. Victory comes from actual match state only. */
(function(){'use strict';
let playing=null,baseTrack=null;
const el=(tag,cls,txt)=>{const n=document.createElement(tag);n.className=cls;n.textContent=String(txt);return n};
function stop(){
 if(baseTrack){baseTrack.pause();try{baseTrack.currentTime=0}catch(_){}baseTrack=null}
 if(playing){playing.close().catch(()=>{});playing=null}
}
// A deluxe arrangement of the ORIGINAL victory fanfare: the existing MP3
// remains the melody, joined by punchy timpani and shimmering cymbal accents.
function fanfare(){
 stop();
 try{
  const track=document.getElementById('victoryBgm')||document.getElementById('onlineVictory')||new Audio('/kanji_arms_victory_fanfare.mp3');
  track.pause();track.currentTime=0;track.volume=.8;baseTrack=track;
  track.play().catch(()=>{});
 }catch(_){}
 try{
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  const ctx=new AC();playing=ctx;ctx.resume().catch(()=>{});
  const t=ctx.currentTime+.03,master=ctx.createGain();master.gain.value=.18;master.connect(ctx.destination);
  for(const [delay,power] of [[0,.9],[.2,.31],[.4,.38],[1,.65],[1.9,.78],[2.65,.45],[3.45,.82],[4.5,1]]){
   const o=ctx.createOscillator(),g=ctx.createGain(),filter=ctx.createBiquadFilter();
   o.type='triangle';o.frequency.setValueAtTime(140,t+delay);
   o.frequency.exponentialRampToValueAtTime(38,t+delay+.33);
   filter.type='lowpass';filter.frequency.value=450;
   g.gain.setValueAtTime(.001,t+delay);g.gain.exponentialRampToValueAtTime(power,t+delay+.012);
   g.gain.exponentialRampToValueAtTime(.001,t+delay+.52);
   o.connect(filter);filter.connect(g);g.connect(master);
   o.start(t+delay);o.stop(t+delay+.54);
  }
  for(let k=0;k<18;k++){
   const delay=.17+k*.25,f=1200+(k%5)*170,o=ctx.createOscillator(),g=ctx.createGain();
   o.type='sine';o.frequency.setValueAtTime(f,t+delay);
   o.frequency.exponentialRampToValueAtTime(f*1.07,t+delay+.21);
   g.gain.setValueAtTime(.001,t+delay);g.gain.exponentialRampToValueAtTime(.033,t+delay+.02);
   g.gain.exponentialRampToValueAtTime(.001,t+delay+.26);
   o.connect(g);g.connect(master);o.start(t+delay);o.stop(t+delay+.28);
  }
  for(const [delay,duration,volume] of [[0,.6,.04],[2,.75,.03],[4.25,1.3,.067]]){
   const count=Math.ceil(ctx.sampleRate*duration),buffer=ctx.createBuffer(1,count,ctx.sampleRate),samples=buffer.getChannelData(0);
   for(let j=0;j<count;j++)samples[j]=Math.random()*2-1;
   const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
   source.buffer=buffer;filter.type='highpass';filter.frequency.value=3700;
   gain.gain.setValueAtTime(.001,t+delay);gain.gain.linearRampToValueAtTime(volume,t+delay+.15);
   gain.gain.exponentialRampToValueAtTime(.001,t+delay+duration);
   source.connect(filter);filter.connect(gain);gain.connect(master);
   source.start(t+delay);source.stop(t+delay+duration);
  }
 }catch(_){}
}
function chooseHeadline(){return window.MojiUlt?.victoryPhrase?.()||'真顔のまま、天下統一！'}
function show(overlay,box,info,mode){
 if(!overlay||!box)return false;
 // Repainting the same result must not reroll its slogan or restart the song.
 if(overlay.classList.contains('moji-namepu-deluxe')&&box.querySelector('.namepu-champion'))return true;
 overlay.classList.add('moji-namepu-deluxe');
 box.querySelector('.namepu-champion')?.remove();
 const panel=el('section','namepu-champion','');panel.setAttribute('aria-label','ナメプ勝利プレイヤー情報');
 panel.append(el('div','namepu-wings','◢ ✦ ◈ ✦ ◣'),el('div','namepu-crown','♛'));
 const plate=el('div','namepu-winner-plate','');
 const avatar=el('div','namepu-avatar',info.icon||'武');avatar.setAttribute('aria-label','勝利プレイヤーのアイコン');
 const id=el('div','namepu-identity','');id.append(el('small','','THE CHAMPION'),el('strong','namepu-player-name',info.name||'あなた'));
 plate.append(avatar,id);panel.append(plate);
 const stats=el('div','namepu-victory-stats','');
 for(const t of ['⚔ '+Math.max(0,Number(info.kills)||0)+' KILLS','♥ '+Math.max(0,Math.ceil(Number(info.hp)||0))+' HP',mode==='online'?'🌐 ONLINE CHAMPION':'✦ SOLO CHAMPION'])stats.append(el('div','',t));
 panel.append(stats,el('p','namepu-tagline','5秒の舞と20%の弱体化を乗り越え、王者の座へ。'));
 // Only use a DIRECT child of the result card as the insertion anchor.
 // Solo kill counters used to live inside .result-message (the narrow hero
 // grid column); picking them with querySelector placed this huge panel
 // inside that column and squashed it into a tall 130px strip.
 const target=mode==='solo'
  ?box.querySelector(':scope > .result-stats')
  :box.querySelector(':scope > .online-meta');
 if(target)target.insertAdjacentElement('beforebegin',panel);
 else box.append(panel);
 const sound=document.getElementById('musicEnabled');
 if(!sound||sound.checked)fanfare()
 return true;
}
window.MojiNamepuVictory={
 stop,playFanfare:fanfare,
 showSolo(info){
  const overlay=document.getElementById('result');if(!overlay?.classList.contains('show'))return false;
  const rank=document.getElementById('resultRank');if(rank)rank.textContent='NAMEPU // LEGENDARY VICTORY';
  const title=document.getElementById('resultTitle');if(title&&!overlay.querySelector('.namepu-champion'))title.textContent='✦ '+chooseHeadline()+' ✦';
  return show(overlay,overlay.querySelector('.result-inner'),info,'solo');
 },
 showOnline(info){
  const overlay=document.getElementById('onlineOutcome'),box=overlay?.querySelector('.online-outcome-card');if(!box)return false;
  const rank=document.getElementById('onlineOutcomeEnglish');if(rank)rank.textContent='NAMEPU // LEGENDARY VICTORY';
  const title=document.getElementById('onlineOutcomeTitle');if(title&&!overlay.querySelector('.namepu-champion'))title.textContent='✦ '+chooseHeadline()+' ✦';
  return show(overlay,box,info,'online');
 }
};
})();
