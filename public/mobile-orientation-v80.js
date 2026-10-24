/* v8.0 — user-selected mobile play orientation, shared CPU/online. */
(function(){
 'use strict';
 const key='moji_mobile_play_orientation';
 const mobile=()=>window.matchMedia('(pointer: coarse)').matches&&
  (navigator.maxTouchPoints>0||/Android|iPhone|iPad/i.test(navigator.userAgent))&&
  (window.innerWidth<1200||/Android|iPhone|iPad/i.test(navigator.userAgent));
 let value='portrait';
 try{const saved=localStorage.getItem(key);if(saved==='landscape'||saved==='portrait')value=saved;}catch(_){}
 function actual(){return innerWidth>innerHeight?'landscape':'portrait'}
 function updateStatus(){
  const hint=document.getElementById('mobileOrientationStatus');
  if(!hint)return;
  const matches=value===actual();
  hint.textContent=matches?'✓ '+(value==='landscape'?'横画面':'縦画面')+'でプレイできます':
   '端末を'+(value==='landscape'?'横向き':'縦向き')+'に回転してください（対応ブラウザでは自動切替）';
 }
 function apply(){
  document.body.classList.toggle('mobile-pref-landscape',mobile()&&value==='landscape');
  document.body.classList.toggle('mobile-pref-portrait',mobile()&&value==='portrait');
  document.documentElement.dataset.mojiScreenPreference=value;
  for(const b of document.querySelectorAll('[data-mobile-orientation]')){
   b.setAttribute('aria-pressed',String(b.dataset.mobileOrientation===value));
  }
  const panel=document.getElementById('mobileOrientationSetting');
  if(panel)panel.hidden=!mobile();
  updateStatus();
  // Notify embedded battles to refit their canvases without changing pointer coordinates.
  try{window.dispatchEvent(new Event('resize'));}catch(_){}
 }
 async function select(requested,fromClick){
  if(!['landscape','portrait'].includes(requested))return;
  value=requested;
  try{localStorage.setItem(key,value);}catch(_){}
  apply();
  // Orientation Lock is only supported in some mobile browsers and may require
  // fullscreen. Try from a real click, never assume success if rejected.
  if(fromClick&&mobile()&&screen.orientation&&typeof screen.orientation.lock==='function'){
   try{
    // Do not unexpectedly force fullscreen while the user is choosing a mode.
    // Some browsers permit an orientation lock directly; others require
    // a manual device rotation (or a later explicit fullscreen action).
    await screen.orientation.lock(value);
   }catch(_){/* Physical rotation remains available on iOS and other browsers. */}
   updateStatus();
  }
 }
 function install(){
  const target=document.getElementById('modeTiles')||document.querySelector('#waitArea h2')||document.querySelector('#joinArea h2');
  if(target&&!document.getElementById('mobileOrientationSetting')){
   const element=document.createElement('div');
   element.id='mobileOrientationSetting';
   element.className='mobile-orientation-setting';element.hidden=!mobile();
   element.innerHTML='<div class="mobile-orientation-title">📱 スマホのプレイ画面</div>'+
    '<div class="mobile-orientation-switch" role="group" aria-label="プレイ画面の向き">'+
    '<button type="button" data-mobile-orientation="portrait" aria-pressed="true">▯ 縦画面</button>'+
    '<button type="button" data-mobile-orientation="landscape" aria-pressed="false">▭ 横画面</button></div>'+
    '<small id="mobileOrientationStatus" role="status"></small>';
   target.insertAdjacentElement('afterend',element);
   for(const b of element.querySelectorAll('[data-mobile-orientation]')){
    b.addEventListener('click',()=>select(b.dataset.mobileOrientation,true));
   }
  }
  apply();
 }
 // If orientation control lives in main lobby, the embed still reads the same
 // localStorage preference; parent-selected device lock determines real viewport.
 window.MojiMobileOrientation={get:()=>value,apply,select,mobile};
 window.addEventListener('resize',updateStatus);
 window.addEventListener('orientationchange',()=>requestAnimationFrame(()=>{apply();updateStatus();}));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateStatus();});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();