/* v10.9 — Give mode selection its own visual section, separate from settings.
   Reparent existing controls only; never replace a mode button or its handlers. */
(function(){
 'use strict';
 const modes={
  normal:['CPU 通常戦','CPU相手に戦う・文字の画数は自動計算'],
  custom:['CPU カスタム戦','CPU相手に戦う・画数を自分で設定'],
  multi:['オンライン通常戦','ほかのプレイヤーと対戦・画数は自動計算'],
  multiCustom:['オンラインカスタム戦','ほかのプレイヤーと対戦・画数を自分で設定']
 };
 function heading(number,title,description){
  const node=document.createElement('div');
  node.className='moji-mode-section-heading';
  const count=document.createElement('span');count.className='moji-mode-step';count.textContent=number;
  const main=document.createElement('div');main.className='moji-mode-heading-copy';
  const strong=document.createElement('strong');strong.textContent=title;
  const small=document.createElement('small');small.textContent=description;
  main.append(strong,small);node.append(count,main);
  return node;
 }
 function init(){
  const tiles=document.getElementById('modeTiles');
  const settings=document.getElementById('battleSettings');
  if(!tiles||!settings||document.getElementById('mojiModeChoiceCard'))return;
  const originalParent=tiles.parentElement;
  if(!settings.contains(tiles)||!originalParent)return;
  const section=document.createElement('section');
  section.id='mojiModeChoiceCard';section.className='moji-mode-choice-card';
  section.setAttribute('aria-label','対戦モードを選ぶ');
  section.append(heading('01','対戦モードを選ぶ','まず遊び方を選択。選択中のモードは金色で表示されます。'));
  originalParent.insertBefore(section,tiles);
  section.append(tiles);
  const chosen=document.createElement('p');
  chosen.id='mojiSelectedModeInfo';chosen.className='moji-mode-selected-info';
  chosen.setAttribute('role','status');chosen.setAttribute('aria-live','polite');
  section.append(chosen);
  // The existing hint belongs to mode selection, not to the match options.
  const hint=settings.querySelector('.mode-hint');
  if(hint&&hint.parentElement===originalParent)section.append(hint);
  const select=document.getElementById('modeSelect');
  const refresh=()=>{
   const pressed=tiles.querySelector('[data-mode-tile][aria-pressed="true"]')?.dataset.modeTile;
   const value=(pressed&&modes[pressed]?pressed:select?.value)||'normal';
   const [name,description]=modes[value]||modes.normal;
   chosen.textContent='選択中：'+name+' ｜ '+description;
   section.dataset.mode=value;
  };
  select?.addEventListener('change',refresh);
  tiles.addEventListener('click',event=>{
   if(event.target.closest('[data-mode-tile]'))queueMicrotask(refresh);
  });
  refresh();
  // Move existing settings, including the orientation switch, into a separate
  // surface. Inputs remain the same DOM nodes so saved values/events survive.
  const quickrow=settings.querySelector('.mode-quickrow');
  const count=document.getElementById('cpuCountSetting');
  const orientation=document.getElementById('mobileOrientationSetting');
  const fieldNodes=[quickrow,count,orientation].filter(n=>n&&n.parentElement===originalParent);
  if(fieldNodes.length){
   const details=document.createElement('section');
   details.id='mojiMatchDetailsCard';details.className='moji-match-details-card';
   details.setAttribute('aria-label','対戦の詳細設定');
   details.append(heading('02','そのほかの対戦設定','マップ・CPU人数・画面の向きなどはここから調整。'));
   section.insertAdjacentElement('afterend',details);
   for(const n of fieldNodes)details.append(n);
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();
