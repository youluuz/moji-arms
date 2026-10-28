/* 文字武装 v7.1 — shared six-skill definitions for solo and online */
(function(){
'use strict';
const defs=[
 {id:'roman',name:'ロマン砲',cost:320,icon:'砲',color:'#ffc36d',tip:'構えてから狙った位置へ発射',target:true},
 {id:'slow',name:'硬化弾',cost:275,icon:'硬',color:'#85eaff',tip:'命中した相手を3秒間硬直',target:true},
 {id:'invincible',name:'無敵',cost:280,icon:'無敵',color:'#f7efbb',tip:'エリア外も含む完全防御',target:false},
 {id:'dance',name:"Let's DANCE",cost:280,icon:'♪',color:'#ff9aca',tip:'全員停止・使用後は自分の武装威力1.1倍',target:false},
 {id:'invisible',name:'透明化',cost:240,icon:'透',color:'#8beaf7',tip:'姿を隠して逃走',target:false},
 {id:'namepu',name:'ナメプ',cost:160,icon:'😐',color:'#e9ff85',tip:'5秒間踊る・その後は武装効果80%',target:false}
];
const byId=Object.fromEntries(defs.map(d=>[d.id,d]));
function randomId(previous){const options=defs.filter(d=>d.id!==previous);return options[Math.floor(Math.random()*options.length)].id;}
// Accessible, mobile-readable explanations shared by all four battle modes.
const guides={
 roman:{
  role:'高火力・照準型',short:'超火力',
  summary:'オーラをまとった「ロマン砲」を放つ。命中した相手は、無敵中を除きシールドや残りHPに関係なく即死する。',
  usage:'必殺技ボタンを押して構え、5秒以内に戦場の狙いたい位置をタップ／クリック。照準を決めた後、1秒の発射前スタンを経て発射。',
  caution:'照準確定後の1秒は移動も通常武装もできない。構え中も通常武装は使えない。弾速はやや遅めで障害物を貫通せず、外すと大きな隙になる。5秒過ぎると最後の照準方向へ自動発射。'
 },
 slow:{
  role:'拘束・照準型',short:'3秒硬直',
  summary:'硬化弾が命中すると60ダメージを与え、相手の足を3秒間拘束する。硬直中は移動・攻撃・必殺技が使えないが、回復と防御は使用できる。',
  usage:'ロマン砲と同じ2段階操作。必殺技ボタンを押して構え、戦場の狙った位置をタップ／クリックして発射。5秒経つと自動発射。',
  caution:'構え中は移動可能だが通常武装は使えない。通常の防御・シールドでは命中時の硬直を防げないが、硬直後に回復・防御を使うことは可能。無敵中の相手にはダメージも硬直も効かない。障害物は貫通しない。'
 },
 invincible:{
  role:'防御・即時発動',short:'完全防御',
  summary:'自分の周囲に「無敵」の文字が回転し、相手の攻撃と安全エリア外のダメージを防ぐ。',
  usage:'必殺技ボタンを1回タップ／クリックするだけで、その場ですぐ発動。現在の効果時間は約2.8秒。',
  caution:'無敵中は通常武装を使えない。短時間の緊急回避やエリア脱出に使おう。'
 },
 dance:{
  role:'全体妨害・永続強化',short:'全員停止＋1.1倍',
  summary:'マップ内の全員が2秒間踊る。使用後は発動者だけ通常攻撃・貫通・ホーミング・防御・回復の威力／効果量が、その試合中ずっと1.1倍になる。',
  usage:'必殺技ボタンを1回タップ／クリックすると即発動。現在の効果時間は約2秒。',
  caution:'自分も2秒間移動・攻撃できない。ダンス中は全員のダメージが一時停止。1.1倍の効果は使用者のみで、試合を終了すると消える。'
 },
 invisible:{
  role:'かく乱・即時発動',short:'隠密',
  summary:'4秒間、相手の画面から姿が消える。透明化中は追尾弾に狙われず、発動前から飛んでいた追尾弾も命中しない。',
  usage:'必殺技ボタンを1回タップ／クリックすると即発動。現在の効果時間は約4秒。',
  caution:'通常武装を使うと透明化は解除される。無敵ではないので、通常弾・貫通弾・安全エリア外のダメージは防げない。'
 },
 namepu:{
  role:'ネタ技・即時発動',short:'魅せ技',
  summary:'アイコンが真顔になり5秒間踊る。発動後は通常武装の攻撃力・回復量・防御量が、その試合中ずっと0.8倍になる。',
  usage:'必殺技ボタンを押すと即発動（必要ゲージ160）。その場で5秒間ダンスし、その後は通常武装の効果が80%になる。',
  caution:'5秒間は移動も攻撃もできず、受けるダメージも通常どおり。使用後の弱体化は試合終了まで続く。その状態で優勝すると専用勝利BGM付きの豪華なナメプ勝利画面が出る。'
 }
};
let widgetSerial=0;

// Illustrated SVG icons: each ability has its own motif, with art and a readable emblem.
const motifs={
 roman:'<g stroke-linejoin="round" stroke-linecap="round"><g transform="rotate(-24 48 49)"><path d="M8 40H19V58H8Z" fill="#36404b" stroke="#bbc3c8" stroke-width="2.4"/><path d="M16 35H68L75 39V60L68 64H16Z" fill="#566b42" stroke="#e2c07d" stroke-width="3"/><path d="M20 38H65L70 41V47H20Z" fill="#859565" opacity=".8"/><path d="M25 36V63M58 36V63" stroke="#2e3238" stroke-width="8"/><path d="M25 36V63M58 36V63" stroke="#e7ad54" stroke-width="3"/><path d="M65 32H83L89 37V63L83 68H65L70 61V39Z" fill="#c18337" stroke="#ffe1a1" stroke-width="3"/><path d="M78 37L88 40V60L78 63Z" fill="#293642" stroke="#fbc671" stroke-width="2"/><ellipse cx="81" cy="50" rx="5.6" ry="11" fill="#ff852e" stroke="#ffe9aa" stroke-width="1.6"/><path d="M83 44L91 39 87 48 96 51 86 55 90 61 82 57" fill="#ffb347" stroke="#ffefb4" stroke-width="1.3"/><path d="M33 63H48L52 79H37Z" fill="#303a45" stroke="#e1ac62" stroke-width="2.5"/><path d="M38 69L47 68" stroke="#a1a8ab" stroke-width="2"/><path d="M48 63L61 63 58 69H54" fill="none" stroke="#f3d29b" stroke-width="3"/><path d="M35 27H53V35H35Z" fill="#2b3a48" stroke="#ffce71" stroke-width="2.3"/><path d="M41 28V24H48V28" fill="none" stroke="#ffdb91" stroke-width="2"/><path d="M19 45H55" stroke="#dbe4b3" stroke-width="2.2" opacity=".65"/><path d="M10 45V53" stroke="#ffce89" stroke-width="2.2"/></g><path d="M84 17L91 12M85 25L95 25M76 12L77 6" stroke="#ffb352" stroke-width="3"/><circle cx="89" cy="20" r="2" fill="#ffe6a6"/></g>',
 slow:'<g stroke-linejoin="round" stroke-linecap="round"><!-- Two legs and boots --><path d="M23 13H45L43 53H30L27 34Z" fill="#678ab6" stroke="#d8f4ff" stroke-width="3"/><path d="M52 13H73L69 53H55L53 33Z" fill="#5275a7" stroke="#d8f4ff" stroke-width="3"/><path d="M30 51H43V64H32Z" fill="#d3e8f5" stroke="#ecffff" stroke-width="2"/><path d="M55 51H69V64H56Z" fill="#d3e8f5" stroke="#ecffff" stroke-width="2"/><path d="M31 62H44L47 73Q46 78 38 79H13Q9 78 10 72L25 68Z" fill="#253c5b" stroke="#b2e8ff" stroke-width="2.5"/><path d="M57 62H69L82 70Q86 77 79 79H54Q49 78 49 73Z" fill="#263b5b" stroke="#b2e8ff" stroke-width="2.5"/><path d="M14 76H42M55 76H80" stroke="#ecfdff" stroke-width="2.5"/><!-- Metal ankle restraint --> <path d="M52 50H72V61H52Z" fill="#738b9b" stroke="#e9ffff" stroke-width="2.6"/><path d="M56 55H68" stroke="#203c5b" stroke-width="3"/><path d="M72 57L78 57" stroke="#cfedff" stroke-width="4"/><!-- Oversized attached golden padlock --> <path d="M66 62V53Q66 43 76 43Q86 43 86 53V62" fill="none" stroke="#243b58" stroke-width="9"/><path d="M66 62V53Q66 43 76 43Q86 43 86 53V62" fill="none" stroke="#d9f8ff" stroke-width="5"/><rect x="62" y="59" width="28" height="25" rx="5" fill="#f6c45d" stroke="#fff4bc" stroke-width="3"/><circle cx="76" cy="69" r="3.5" fill="#3f4156"/><path d="M76 72V77" stroke="#3f4156" stroke-width="3"/><path d="M13 51L7 46M17 45L14 37" stroke="#9ceaff" stroke-width="3"/></g>',
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
function victoryPhrase(){const a=["真顔のまま、天下統一！","踊る覇王、降臨！","ナメプ、伝説となる！","余裕こそ最強の武器！","舞い踊る絶対王者！","勝利すら、ただの余興。","踊ってなお、完全無双！","その余裕、王者の証！","弱体化さえ凌駕する！","王座まで、踊り抜け！","真顔で頂点を奪取！","世界が舞いにひれ伏した！","踊りし者、伝説を刻む！","その舞、まさに圧勝！"];return a[Math.floor(Math.random()*a.length)]}
function attachUI(container,opts={}){
 const root=document.createElement('div');root.className='ultimate-widget';
 root.innerHTML='<div class="ultimate-picker-heading"><strong class="ultimate-picker-label">必殺技を選択</strong><span class="ultimate-picker-note">1試合に1回だけ使える</span></div><div class="ultimate-picker" role="group" aria-label="必殺技6種類"></div><button type="button" class="ultimate-guide-toggle" aria-expanded="false" aria-label="必殺技の使い方を開く"><span class="ultimate-guide-toggle-main"><span class="ultimate-guide-toggle-label">選択中の必殺技の使い方</span><small class="ultimate-guide-toggle-hint">▼ タップで説明を開く</small></span><span class="ultimate-guide-chevron" aria-hidden="true">▼ <span>開く</span></span></button><section class="ultimate-guide" hidden aria-live="polite"><button class="ultimate-guide-close" type="button" aria-label="必殺技の説明を閉じる">✕ <span>閉じる</span></button><div class="ultimate-guide-header"><span class="ultimate-guide-icon" aria-hidden="true"></span><div class="ultimate-guide-heading"><strong class="ultimate-guide-name"></strong><span class="ultimate-guide-role"></span></div><span class="ultimate-guide-cost"></span></div><p class="ultimate-guide-summary"></p><div class="ultimate-guide-grid"><div class="ultimate-guide-section"><span class="ultimate-guide-label">使い方</span><p class="ultimate-guide-usage"></p></div><div class="ultimate-guide-section"><span class="ultimate-guide-label">注意点・弱点</span><p class="ultimate-guide-caution"></p></div></div><div class="ultimate-guide-footer">※ 画数・効果時間などのバランスは今後調整する場合があります。</div><button class="ultimate-guide-bottom-close" type="button">▲ 説明を閉じる</button></section><div class="ultimate-battle" hidden><button class="ultimate-cast" type="button" aria-label="必殺技"><span class="ultimate-icon"></span><span class="ultimate-left">残り --画</span></button><span class="ultimate-state"></span></div>';
 const picker=root.querySelector('.ultimate-picker');
 const random=document.createElement('button');random.type='button';random.className='ultimate-random-button';random.textContent='🎲 必殺技をランダムに選ぶ';random.setAttribute('aria-label','6種類の必殺技からランダム選択');picker.insertAdjacentElement('beforebegin',random);
 const guide=root.querySelector('.ultimate-guide'),guideId='ultimate-guide-'+(++widgetSerial);
 const guideToggle=root.querySelector('.ultimate-guide-toggle');
 guide.id=guideId;
 guideToggle.setAttribute('aria-controls',guideId);
 function setGuideOpen(expanded,restoreFocus=false){
  guide.hidden=!expanded;
  guideToggle.setAttribute('aria-expanded',String(expanded));
  guideToggle.setAttribute('aria-label',expanded?'必殺技の使い方を閉じる':'必殺技の使い方を開く');
  guideToggle.innerHTML='<span class="ultimate-guide-toggle-main"><span class="ultimate-guide-toggle-label">選択中の必殺技の使い方</span><small class="ultimate-guide-toggle-hint">'+(expanded?'▲ タップで説明を閉じる':'▼ タップで説明を開く')+'</small></span><span class="ultimate-guide-chevron" aria-hidden="true">'+(expanded?'▲ <span>閉じる</span>':'▼ <span>開く</span>')+'</span>';
  if(restoreFocus)guideToggle.focus({preventScroll:false});
 }
 guideToggle.addEventListener('click',()=>{
  const expanded=guideToggle.getAttribute('aria-expanded')==='true';
  setGuideOpen(!expanded);
 });
 guide.querySelector('.ultimate-guide-close').addEventListener('click',()=>setGuideOpen(false,true));
 guide.querySelector('.ultimate-guide-bottom-close').addEventListener('click',()=>setGuideOpen(false,true));
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
 return {root,picker,random,guide,guideToggle,cast:root.querySelector('.ultimate-cast'),show,showBattle(flag){random.hidden=flag;root.querySelector('.ultimate-battle').hidden=!flag;root.querySelector('.ultimate-picker-heading').hidden=flag;picker.hidden=flag;guideToggle.hidden=flag;if(flag)setGuideOpen(false);else guide.hidden=guideToggle.getAttribute('aria-expanded')!=='true'}};
}
window.MojiUlt={defs,byId,randomId,icon,play,victoryPhrase,attachUI};
})();
