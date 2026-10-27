/* Custom-rule inputs sit where the original lobby maximum HP was displayed. */
(function(){
'use strict';
const prefix='moji_custom_';
function sane(value,min,max,fallback){
 if(value==null||String(value).trim()==='')return fallback;
 const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):fallback;
}
function saved(key,lo,hi,fallback){
 try{return sane(localStorage.getItem(prefix+key),lo,hi,fallback)}catch(_){return fallback}
}
let customHp=saved('hp',1,1000,600),customCharge=saved('charge',0,100,0);
const isCustom=mode=>mode==='custom'||mode==='multiCustom';
const mode=()=>document.getElementById('modeSelect')?.value||'normal';
function hpForMode(matchMode){return isCustom(matchMode)?sane(document.getElementById('customHpInput')?.value,1,1000,customHp):600}
function chargeForMode(matchMode){return isCustom(matchMode)?sane(document.getElementById('customChargeInput')?.value,0,100,customCharge):0}
window.MojiCustomRules={hpForMode,chargeForMode,isCustom:()=>isCustom(mode()),values:()=>({maxHp:hpForMode(mode()),ultimateStartPercent:chargeForMode(mode())})};
function mount(){
 const hp=document.getElementById('lobbyHP');
 const right=hp?.closest('.loadout-stats')?.querySelector('.stats-copy');
 if(!hp||!right||document.getElementById('customHpInput'))return;
 const existingRight=right.innerHTML;
 const hpLabel=document.createElement('label');hpLabel.className='custom-hp-label';hpLabel.htmlFor='customHpInput';
 const hpInput=document.createElement('input');hpInput.id='customHpInput';hpInput.type='number';hpInput.min='1';hpInput.max='1000';hpInput.step='1';hpInput.inputMode='numeric';hpInput.value=String(customHp);
 hpInput.setAttribute('aria-label','カスタムマッチのプレイヤー最大HP');
 hpLabel.append('♥ 最大HP ',hpInput,'（1〜1000）');
 const fields=document.createElement('div');fields.id='mojiCustomRuleFields';
 const chargeLabel=document.createElement('label');chargeLabel.htmlFor='customChargeInput';chargeLabel.className='custom-charge-label';
 const chargeInput=document.createElement('input');chargeInput.id='customChargeInput';chargeInput.type='number';chargeInput.min='0';chargeInput.max='100';chargeInput.step='1';chargeInput.inputMode='numeric';chargeInput.value=String(customCharge);
 chargeInput.setAttribute('aria-label','必殺ゲージの初期チャージ率');
 chargeLabel.append('必殺ゲージ初期チャージ ',chargeInput,' %');fields.append(chargeLabel);
 hp.replaceChildren(hpLabel);hp.insertAdjacentElement('afterend',fields);
 function save(){
  customHp=hpForMode('custom');customCharge=chargeForMode('custom');
  try{localStorage.setItem(prefix+'hp',String(customHp));localStorage.setItem(prefix+'charge',String(customCharge))}catch(_){}
 }
 for(const [input,min,max] of [[hpInput,1,1000],[chargeInput,0,100]]){
  input.addEventListener('input',save);
  input.addEventListener('change',()=>{input.value=String(sane(input.value,min,max,input===hpInput?600:0));save()});
 }
 function refresh(){
  const custom=isCustom(mode());
  fields.hidden=!custom;
  right.innerHTML=custom?'<strong>✎ 画数設定可能（1〜84画）</strong><span>　好きな文字の画数を手動で設定できます。</span>':existingRight;
  if(custom){if(!hp.contains(hpLabel))hp.replaceChildren(hpLabel)}
  else hp.textContent='♥ 600 / 600';
 }
 document.getElementById('modeSelect')?.addEventListener('change',refresh);
 refresh();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
