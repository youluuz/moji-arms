/* v11.3: keep shared locker accessible from a live room and make
   leaving/rejoining discoverable without destroying the room WebSocket. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 function init(){
  const wait=$('waitArea');if(!wait||$('mojiRoomActions'))return;
  const row=document.createElement('div');row.id='mojiRoomActions';
  row.className='moji-room-actions';
  const locker=document.createElement('button');locker.type='button';locker.id='mojiRoomLocker';
  locker.textContent='◇ ロッカー（装飾）';
  locker.addEventListener('click',()=>{
   if(window.parent!==window)window.parent.postMessage({type:'moji:openRoomLocker'},location.origin);
   else {
    // Non-embedded standalone room is not a supported login entry point.
    $('waitError').textContent='ロッカーは共通ロビーに入ってから開けます。';
   }
  });
  const leave=document.createElement('button');leave.type='button';leave.id='mojiRoomExit';
  leave.textContent='← 共通ロビーに戻る';
  leave.addEventListener('click',()=>$('leave').click());
  row.append(locker,leave);
  const header=wait.querySelector('h2');
  if(header)header.insertAdjacentElement('afterend',row);else wait.prepend(row);
  // Remember successful private room joins so the shared lobby offers return.
  const observer=new MutationObserver(()=>{
   const code=$('code')?.textContent?.trim();
   if(/^[A-Z0-9]{6}$/.test(code)&&!document.body.classList.contains('online-battle')){
    try{localStorage.setItem('moji_last_room',code)}catch(_){}
   }
  });
  observer.observe($('code'),{childList:true,subtree:true,characterData:true});
  window.MojiRoomTools={locker:()=>locker.click(),leave:()=>leave.click()};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
