/* Public beta discovery: link the existing game lobby to its shareable introduction. */
(function(){
 'use strict';
 function insert(){
  const lobby=document.getElementById('lobbyScreen');
  if(!lobby||document.getElementById('mojiLaunchInfo'))return;
  const link=document.createElement('a');
  link.id='mojiLaunchInfo';
  link.href='/about.html';
  link.textContent='📣 文字武装の紹介・遊び方・友達にシェア →';
  link.setAttribute('aria-label','文字武装の紹介ページと遊び方を開く');
  link.style.cssText='display:block;width:fit-content;max-width:96%;margin:10px auto 15px;padding:10px 16px;background:#203b55;border:1px solid #9fc5cb;border-radius:11px;color:#dff8ee;font-size:13px;font-weight:850;text-decoration:none;text-align:center;';
  lobby.insertBefore(link,lobby.firstChild);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',insert,{once:true});
 else insert();
})();
