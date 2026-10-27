/* Legendary Namepu results. Victory comes from actual match state only. */
(function(){'use strict';
let playing=null;
const el=(tag,cls,txt)=>{const n=document.createElement(tag);n.className=cls;n.textContent=String(txt);return n};
function fanfare(){
 try{
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  playing?.close().catch(()=>{});const ctx=new AC();playing=ctx;ctx.resume().catch(()=>{});
  const vol=ctx.createGain();vol.gain.value=.21;vol.connect(ctx.destination);
  const start=ctx.currentTime+.03,frequency=n=>440*Math.pow(2,(n-69)/12);
  // Distinct 6.5-second royal fanfare, layered brass voices, lead bells and drum.
  for(const [at,notes,duration] of [[0,[48,55,60,64],1.55],[1.25,[53,60,65,69],1.55],[2.55,[55,62,67,71],1.5],[3.85,[60,67,72,76],2.65]]){
   for(const n of notes)for(const [wave,ratio,v] of [['sawtooth',1,.17],['triangle',.5,.11]]){
    const o=ctx.createOscillator(),g=ctx.createGain(),f=ctx.createBiquadFilter();
    o.type=wave;o.frequency.value=frequency(n)*ratio;f.type='lowpass';f.frequency.value=1800;
    g.gain.setValueAtTime(.001,start+at);g.gain.exponentialRampToValueAtTime(v/2,start+at+.08);
    g.gain.exponentialRampToValueAtTime(.001,start+at+duration);
    o.connect(f);f.connect(g);g.connect(vol);o.start(start+at);o.stop(start+at+duration+.03);
   }
   const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(150,start+at);
   o.frequency.exponentialRampToValueAtTime(43,start+at+.2);g.gain.setValueAtTime(.4,start+at);
   g.gain.exponentialRampToValueAtTime(.001,start+at+.45);o.connect(g);g.connect(vol);
   o.start(start+at);o.stop(start+at+.46);
  }
  for(const [n,at,d] of [[76,0,.35],[79,.36,.3],[81,.72,.42],[84,1.25,.7],[83,2.24,.3],[81,2.57,.34],[79,2.95,.39],[84,3.48,1.1],[88,4.85,1.6]]){
   const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=frequency(n);
   g.gain.setValueAtTime(.001,start+at);g.gain.exponentialRampToValueAtTime(.2,start+at+.04);
   g.gain.exponentialRampToValueAtTime(.001,start+at+d);o.connect(g);g.connect(vol);
   o.start(start+at);o.stop(start+at+d+.02);
  }
  setTimeout(()=>{if(playing===ctx){ctx.close().catch(()=>{});playing=null}},8000);
 }catch(_){}
}
function show(overlay,box,info,mode){
 if(!overlay||!box)return false;
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
 const target=box.querySelector('.result-stats,.moji-result-kills,.online-meta');
 if(target)target.insertAdjacentElement('beforebegin',panel);else box.prepend(panel);
 const sound=document.getElementById('musicEnabled');
 if(!sound||sound.checked){for(const id of ['victoryBgm','onlineVictory']){const a=document.getElementById(id);if(a){a.pause();a.currentTime=0}}fanfare()}
 return true;
}
window.MojiNamepuVictory={
 showSolo(info){
  const overlay=document.getElementById('result');if(!overlay?.classList.contains('show'))return false;
  const rank=document.getElementById('resultRank');if(rank)rank.textContent='NAMEPU // LEGENDARY VICTORY';
  const title=document.getElementById('resultTitle');if(title)title.textContent='✦ ナメプ完全勝利 ✦';
  return show(overlay,overlay.querySelector('.result-inner'),info,'solo');
 },
 showOnline(info){
  const overlay=document.getElementById('onlineOutcome'),box=overlay?.querySelector('.online-outcome-card');if(!box)return false;
  const rank=document.getElementById('onlineOutcomeEnglish');if(rank)rank.textContent='NAMEPU // LEGENDARY VICTORY';
  const title=document.getElementById('onlineOutcomeTitle');if(title)title.textContent='✦ ナメプ完全勝利 ✦';
  return show(overlay,box,info,'online');
 }
};
})();
