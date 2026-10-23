/* 文字武装 v7.1 — shared six-skill definitions for solo and online */
(function(){
'use strict';
const defs=[
 {id:'roman',name:'ロマン砲',cost:360,icon:'砲',color:'#ffc36d',tip:'構えてから狙った位置へ発射',target:true},
 {id:'slow',name:'鈍化弾',cost:320,icon:'鈍',color:'#9bbcff',tip:'狙った相手を減速',target:true},
 {id:'invincible',name:'無敵',cost:340,icon:'無敵',color:'#f7efbb',tip:'エリア外も含む完全防御',target:false},
 {id:'dance',name:"Let's DANCE",cost:340,icon:'♪',color:'#ff9aca',tip:'全員で強制ダンス',target:false},
 {id:'invisible',name:'透明化',cost:300,icon:'透',color:'#8beaf7',tip:'姿を隠して逃走',target:false},
 {id:'namepu',name:'ナメプ',cost:220,icon:'😐',color:'#e9ff85',tip:'5秒間真顔で踊り続ける',target:false}
];
const byId=Object.fromEntries(defs.map(d=>[d.id,d]));
// Illustrated SVG icons: each ability has its own motif, with art and a readable emblem.
const motifs={
 roman:'<path d="M8 47 26 26 41 39 57 9 54 39 77 25 61 52 85 70 48 65 34 86 28 59Z" fill="#ff8e21" stroke="#fff0a8" stroke-width="2"/><path d="m14 19 18 16M71 13 57 37" stroke="#fff6d2" stroke-width="3"/>',
 slow:'<path d="M15 45Q40 5 76 23L63 35 83 49 57 52 46 78 34 53Z" fill="#4364c7" stroke="#c2e9ff" stroke-width="3"/><path d="M15 73H56M9 61H38" stroke="#dff5ff" stroke-width="5"/>',
 invincible:'<circle cx="48" cy="48" r="37" fill="none" stroke="#fff5bc" stroke-width="6"/><circle cx="48" cy="48" r="30" fill="#fff0af" opacity=".17"/><path d="m48 9 15 27-15 31-15-31Z" fill="#ffdd72" opacity=".64"/>',
 dance:'<path d="M25 49V20l26-9v31M51 42V18l24-7v38" fill="none" stroke="#ffd4f4" stroke-width="7"/><circle cx="18" cy="57" r="10" fill="#f372c4"/><circle cx="44" cy="48" r="10" fill="#f372c4"/><circle cx="67" cy="57" r="10" fill="#ffd568"/><path d="m17 83 9-10 11 10M63 79 73 68" stroke="#fff" stroke-width="4"/>',
 invisible:'<path d="M9 48Q48 1 87 48Q48 94 9 48Z" fill="#78dcf5" opacity=".55" stroke="#dcfdff" stroke-width="4"/><circle cx="48" cy="48" r="19" fill="#1b617b" stroke="#efffff" stroke-width="3"/><path d="M20 81 79 13" stroke="#fff" stroke-width="6"/>',
 namepu:'<circle cx="48" cy="42" r="31" fill="#f9efbd" stroke="#fdfad4" stroke-width="4"/><path d="M30 36h9m17 0h9M38 55h20" stroke="#22262e" stroke-width="5" stroke-linecap="round"/><path d="m18 83 13-11 15 12 17-12 13 11" fill="none" stroke="#d9ff67" stroke-width="5"/>'
};
function icon(id){
 const d=byId[id]||defs[0];
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" aria-hidden="true"><defs><radialGradient id="bg"><stop stop-color="#445574"/><stop offset="1" stop-color="#10192a"/></radialGradient></defs><rect x="1" y="1" width="94" height="94" rx="18" fill="url(#bg)" stroke="'+d.color+'" stroke-width="3"/><circle cx="48" cy="48" r="42" fill="none" stroke="'+d.color+'" opacity=".34" stroke-dasharray="4 7"/>'+motifs[d.id]+'<text x="48" y="93" text-anchor="middle" fill="'+d.color+'" font-size="12" font-family="serif" font-weight="900">'+d.icon+'</text></svg>';
}
function play(id){
 try{
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
  const ac=window.__mojiUltimateAudio||(window.__mojiUltimateAudio=new C());if(ac.state==='suspended')ac.resume();
  const base={roman:165,slow:190,invincible:410,dance:440,invisible:630,namepu:260}[id]||250;
  const notes={roman:[1,1.5,2,.75],slow:[1,.92,.65],invincible:[1,1.25,1.5],dance:[1,1.26,1.49],invisible:[2,1.42,.7],namepu:[1,.71,1.01]}[id];
  const at=ac.currentTime;
  notes.forEach((m,i)=>{
   const o=ac.createOscillator(),g=ac.createGain(),f=ac.createBiquadFilter();
   o.type=id==='namepu'?'triangle':id==='dance'?'sine':'sawtooth';
   o.frequency.setValueAtTime(base*m,at+i*.085);
   o.frequency.exponentialRampToValueAtTime(Math.max(48,base*m*(id==='roman'?.6:1.04)),at+i*.085+.19);
   f.type='lowpass';f.frequency.value=id==='roman'?1700:950;
   g.gain.setValueAtTime(.0001,at+i*.085);g.gain.linearRampToValueAtTime(.06,at+i*.085+.015);g.gain.exponentialRampToValueAtTime(.0001,at+i*.085+.22);
   o.connect(f);f.connect(g);g.connect(ac.destination);o.start(at+i*.085);o.stop(at+i*.085+.23);
  });
 }catch(e){/* sound is optional on locked mobile audio contexts */}
}
function victoryPhrase(){const a=['ナメプ完遂！','踊って勝利！','真顔で制圧','余裕の勝利','舞踏の覇者','ナメて勝った！','その余裕、本物。'];return a[Math.floor(Math.random()*a.length)]}
function attachUI(container,opts={}){
 const root=document.createElement('div');root.className='ultimate-widget';
 root.innerHTML='<label class="ultimate-picker-label">必殺技（1試合1回）</label><div class="ultimate-picker"></div><div class="ultimate-battle" hidden><button class="ultimate-cast" type="button" aria-label="必殺技"><span class="ultimate-icon"></span><span class="ultimate-left">残り --画</span></button><span class="ultimate-state"></span></div>';
 const picker=root.querySelector('.ultimate-picker');
 for(const d of defs){const b=document.createElement('button');b.type='button';b.className='ultimate-option';b.dataset.ultimate=d.id;b.title=d.tip;b.innerHTML=icon(d.id)+'<span>'+d.name+'</span>';picker.append(b)}
 container.append(root);
 function show(id,charge=0,spent=false,aiming=false,seconds=0){
  const d=byId[id]||defs[0];
  for(const b of picker.children){b.classList.toggle('chosen',b.dataset.ultimate===d.id);b.setAttribute('aria-pressed',String(b.dataset.ultimate===d.id))}
  const battle=root.querySelector('.ultimate-battle'),button=root.querySelector('.ultimate-cast');
  if(button.dataset.ultimate!==d.id){button.dataset.ultimate=d.id;root.querySelector('.ultimate-icon').innerHTML=icon(d.id);}
  root.querySelector('.ultimate-left').textContent=spent?'使用済':aiming?'照準中 '+Math.ceil(seconds)+'秒':charge>=d.cost?'発動OK':'残り '+Math.max(0,d.cost-charge)+'画';
  button.classList.toggle('ready',!spent&&charge>=d.cost);
  button.classList.toggle('aiming',aiming);
  button.disabled=spent||charge<d.cost||aiming;
  root.querySelector('.ultimate-state').textContent=aiming?'戦場をタップして発射／5秒後自動発射':spent?'必殺技を使用しました':'';
 }
 return {root,picker,cast:root.querySelector('.ultimate-cast'),show,showBattle(flag){root.querySelector('.ultimate-battle').hidden=!flag;root.querySelector('.ultimate-picker-label').hidden=flag;picker.hidden=flag}};
}
window.MojiUlt={defs,byId,icon,play,victoryPhrase,attachUI};
})();
