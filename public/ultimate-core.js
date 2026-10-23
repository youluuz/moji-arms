/* 文字武装 v7.1 — shared six-skill definitions for solo and online */
(function(){
'use strict';
const defs=[
 {id:'roman',name:'ロマン砲',cost:320,icon:'砲',color:'#ffc36d',tip:'構えてから狙った位置へ発射',target:true},
 {id:'slow',name:'鈍化弾',cost:280,icon:'鈍',color:'#9bbcff',tip:'狙った相手を減速',target:true},
 {id:'invincible',name:'無敵',cost:300,icon:'無敵',color:'#f7efbb',tip:'エリア外も含む完全防御',target:false},
 {id:'dance',name:"Let's DANCE",cost:300,icon:'♪',color:'#ff9aca',tip:'全員で強制ダンス',target:false},
 {id:'invisible',name:'透明化',cost:260,icon:'透',color:'#8beaf7',tip:'姿を隠して逃走',target:false},
 {id:'namepu',name:'ナメプ',cost:180,icon:'😐',color:'#e9ff85',tip:'5秒間真顔で踊り続ける',target:false}
];
const byId=Object.fromEntries(defs.map(d=>[d.id,d]));
// Accessible, mobile-readable explanations shared by all four battle modes.
const guides={
 roman:{
  role:'高火力・照準型',short:'超火力',
  summary:'オーラをまとった「ロマン砲」の文字を撃ち出し、大ダメージを与える。',
  usage:'必殺技ボタンを押して構え、5秒以内に戦場の狙いたい位置をタップ／クリック。照準を決めた後、0.4秒の硬直を経て発射。',
  caution:'照準確定後の0.4秒は移動も通常武装もできない。構え中も通常武装は使えない。障害物を貫通せず、外すと大きな隙になる。5秒過ぎると最後の照準方向へ自動発射。'
 },
 slow:{
  role:'妨害・照準型',short:'減速',
  summary:'鈍化弾を当てて小ダメージを与え、相手の移動速度を一時的に下げる。',
  usage:'ロマン砲と同じ2段階操作。必殺技ボタンを押して構え、戦場の狙った位置をタップ／クリックして発射。5秒経つと自動発射。',
  caution:'構え中は移動可能だが通常武装は使えない。相手が無敵や有効な防御をしている間は速度低下を防がれる。'
 },
 invincible:{
  role:'防御・即時発動',short:'完全防御',
  summary:'自分の周囲に「無敵」の文字が回転し、相手の攻撃と安全エリア外のダメージを防ぐ。',
  usage:'必殺技ボタンを1回タップ／クリックするだけで、その場ですぐ発動。現在の効果時間は約1.8秒。',
  caution:'無敵中は通常武装を使えない。短時間の緊急回避やエリア脱出に使おう。'
 },
 dance:{
  role:'全体妨害・即時発動',short:'全員停止',
  summary:'自分を含む全プレイヤーが頭上に音符を出して強制的に踊る。',
  usage:'必殺技ボタンを1回タップ／クリックすると即発動。現在の効果時間は約2秒。',
  caution:'自分自身も移動・攻撃ができない。ダンス中は全員のダメージも一時停止する。'
 },
 invisible:{
  role:'かく乱・即時発動',short:'隠密',
  summary:'相手の画面から自分の姿が消え、追尾攻撃の対象にもなりにくくなる。',
  usage:'必殺技ボタンを1回タップ／クリックすると即発動。現在の効果時間は約3秒。',
  caution:'攻撃すると透明化が解除される。無敵ではないため、攻撃を受けた場合はダメージが入る。'
 },
 namepu:{
  role:'ネタ技・即時発動',short:'魅せ技',
  summary:'アイコンが真顔になり、自分だけが5秒間ダンスする。完全にナメプするための必殺技。',
  usage:'必殺技ボタンを1回タップ／クリックすると即発動。ほかの必殺技より少ない画数で使える。',
  caution:'5秒間は移動も攻撃もできず、あらゆるダメージを普通に受ける。その試合で勝利すれば、超豪華な勝利演出とランダムな専用文言が出る。'
 }
};
let widgetSerial=0;

// Illustrated SVG icons: each ability has its own motif, with art and a readable emblem.
const motifs={
 roman:'<g stroke-linejoin="round" stroke-linecap="round"><path d="M11 68 30 47 48 40 58 51 39 64 28 81Z" fill="#b56b2b" stroke="#ffd680" stroke-width="3"/><path d="M28 49 54 24 65 36 42 61Z" fill="#ffd675" stroke="#fff2b2" stroke-width="3"/><path d="M57 18 68 11 76 22 88 26 74 35 76 47 65 41 57 48 56 34 45 29Z" fill="#ff6d1d" stroke="#ffe68a" stroke-width="2"/><path d="M65 17 68 28 80 30 68 33 65 43 62 33 52 30 62 27Z" fill="#fff5cc"/><path d="M20 72 32 60M39 47 52 34" stroke="#fff4cc" stroke-width="2"/><circle cx="35" cy="60" r="4" fill="#fff2b2"/></g>',
 slow:'<g stroke-linecap="round" stroke-linejoin="round"><path d="M44 10 65 13 60 44 57 59Q57 65 68 68L79 74Q82 79 76 83H40Q34 83 33 77L37 53Z" fill="#b9d9ed" stroke="#f4faff" stroke-width="3"/><path d="M42 20 64 22M39 52 59 54" stroke="#5b84bc" stroke-width="3"/><path d="M35 57 59 59 59 67 34 65Z" fill="#263e79" stroke="#d7edff" stroke-width="2.5"/><path d="M34 65 29 67 27 72" fill="none" stroke="#a8d4fd" stroke-width="5"/><path d="M32 67 26 70M30 72 24 75" fill="none" stroke="#1b2c59" stroke-width="2"/><circle cx="20" cy="73" r="14" fill="#3a4e8e" stroke="#d7edff" stroke-width="3"/><circle cx="16" cy="68" r="5" fill="#9dc5fa" opacity=".75"/><path d="M48 75H75" fill="none" stroke="#eefaff" stroke-width="2"/><path d="M18 48 11 48M16 56 6 59" fill="none" stroke="#aac5fa" stroke-width="3"/></g>',
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
 root.innerHTML='<div class="ultimate-picker-heading"><strong class="ultimate-picker-label">必殺技を選択</strong><span class="ultimate-picker-note">1試合に1回だけ使える</span></div><div class="ultimate-picker" role="group" aria-label="必殺技6種類"></div><button type="button" class="ultimate-guide-toggle" aria-expanded="false">？ 選択中の技の説明を見る <span class="ultimate-guide-chevron" aria-hidden="true">⌄</span></button><section class="ultimate-guide" hidden aria-live="polite"><div class="ultimate-guide-header"><span class="ultimate-guide-icon" aria-hidden="true"></span><div class="ultimate-guide-heading"><strong class="ultimate-guide-name"></strong><span class="ultimate-guide-role"></span></div><span class="ultimate-guide-cost"></span></div><p class="ultimate-guide-summary"></p><div class="ultimate-guide-grid"><div class="ultimate-guide-section"><span class="ultimate-guide-label">使い方</span><p class="ultimate-guide-usage"></p></div><div class="ultimate-guide-section"><span class="ultimate-guide-label">注意点・弱点</span><p class="ultimate-guide-caution"></p></div></div><div class="ultimate-guide-footer">※ 画数・効果時間などのバランスは今後調整する場合があります。</div></section><div class="ultimate-battle" hidden><button class="ultimate-cast" type="button" aria-label="必殺技"><span class="ultimate-icon"></span><span class="ultimate-left">残り --画</span></button><span class="ultimate-state"></span></div>';
 const picker=root.querySelector('.ultimate-picker');
 const guide=root.querySelector('.ultimate-guide'),guideId='ultimate-guide-'+(++widgetSerial);
 const guideToggle=root.querySelector('.ultimate-guide-toggle');
 guide.id=guideId;
 guideToggle.setAttribute('aria-controls',guideId);
 guideToggle.addEventListener('click',()=>{
  const expanded=guideToggle.getAttribute('aria-expanded')==='true';
  guideToggle.setAttribute('aria-expanded',String(!expanded));
  guide.hidden=expanded;
  guideToggle.innerHTML=(!expanded?'説明を閉じる':'？ 選択中の技の説明を見る')+' <span class="ultimate-guide-chevron" aria-hidden="true">'+(!expanded?'⌃':'⌄')+'</span>';
 });
 for(const d of defs){
  const b=document.createElement('button');b.type='button';b.className='ultimate-option';b.dataset.ultimate=d.id;
  b.title=d.name+'：'+guides[d.id].role;
  b.setAttribute('aria-controls',guideId);
  b.innerHTML=icon(d.id)+'<span class="ultimate-option-title">'+d.name+'</span><small class="ultimate-option-caption">'+guides[d.id].short+'</small>';
  picker.append(b);
 }
 container.append(root);
 function show(id,charge=0,spent=false,aiming=false,seconds=0){
  const d=byId[id]||defs[0];
  for(const b of picker.children){b.classList.toggle('chosen',b.dataset.ultimate===d.id);b.setAttribute('aria-pressed',String(b.dataset.ultimate===d.id))}
  // Only rebuild explanatory text when the selected ability changes.
  if(root.dataset.guideFor!==d.id){
   root.dataset.guideFor=d.id;
   const info=guides[d.id];
   guide.style.setProperty('--ultimate-accent',d.color);
   guide.querySelector('.ultimate-guide-icon').innerHTML=icon(d.id);
   guide.querySelector('.ultimate-guide-name').textContent=d.name;
   guide.querySelector('.ultimate-guide-role').textContent=info.role;
   guide.querySelector('.ultimate-guide-cost').textContent='必要 '+d.cost+'画';
   guide.querySelector('.ultimate-guide-summary').textContent=info.summary;
   guide.querySelector('.ultimate-guide-usage').textContent=info.usage;
   guide.querySelector('.ultimate-guide-caution').textContent=info.caution;
  }
  const battle=root.querySelector('.ultimate-battle'),button=root.querySelector('.ultimate-cast');
  if(button.dataset.ultimate!==d.id){button.dataset.ultimate=d.id;root.querySelector('.ultimate-icon').innerHTML=icon(d.id);}
  root.querySelector('.ultimate-left').textContent=spent?'使用済':aiming?'照準中 '+Math.ceil(seconds)+'秒':charge>=d.cost?'発動OK':'残り '+Math.max(0,d.cost-charge)+'画';
  button.classList.toggle('ready',!spent&&charge>=d.cost);
  button.classList.toggle('aiming',aiming);
  button.disabled=spent||charge<d.cost||aiming;
  root.querySelector('.ultimate-state').textContent=aiming?'戦場をタップして発射／5秒後自動発射':spent?'必殺技を使用しました':'';
 }
 return {root,picker,guide,guideToggle,cast:root.querySelector('.ultimate-cast'),show,showBattle(flag){root.querySelector('.ultimate-battle').hidden=!flag;root.querySelector('.ultimate-picker-heading').hidden=flag;picker.hidden=flag;guideToggle.hidden=flag;if(flag)guide.hidden=true;else guide.hidden=guideToggle.getAttribute('aria-expanded')!=='true'}};
}
window.MojiUlt={defs,byId,icon,play,victoryPhrase,attachUI};
})();
