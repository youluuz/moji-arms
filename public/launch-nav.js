/* Public announcements and an always-visible sortie CTA for the old lobby.
   Feed lives in /notices.json: edit the file to publish the next announcement.
   No accounts, databases, server push, or personal analytics are required. */
(function(){
 'use strict';
 const fallback=[
  {id:'mobile-landscape',date:'2026-10-25',category:'遊び方',title:'📱 スマホ版は横画面推奨',body:'横画面はマップと武装の確認がしやすくおすすめです。縦向きでも遊べます。'},
  {id:'attack-speed',date:'2026-10-25',category:'更新',title:'⚔ 通常攻撃の調整',body:'1画の通常攻撃はクールタイム0.3秒。画数が増えるほど再使用までの時間が長くなります。'}
 ];
 let announcements=fallback;
 const $=id=>document.getElementById(id);
 function init(){
  const lobby=$('lobbyScreen');
  if(!lobby||$('mojiLaunchInfo'))return;
  const header=document.createElement('div');header.className='moji-lobby-topbar';
  header.setAttribute('aria-label','公開情報とゲームのお知らせ');
  const link=document.createElement('a');link.id='mojiLaunchInfo';link.href='/about.html';
  link.textContent='📣 文字武装の紹介・遊び方・友達にシェア →';
  link.setAttribute('aria-label','文字武装の紹介ページと遊び方を開く');
  const noticeButton=document.createElement('button');noticeButton.type='button';
  noticeButton.id='mojiNoticeButton';noticeButton.className='moji-notice-button';
  noticeButton.setAttribute('aria-label','お知らせを開く');noticeButton.setAttribute('aria-haspopup','dialog');
  noticeButton.innerHTML='<span aria-hidden="true">📮</span><span>お知らせ</span><span id="mojiUnread" class="moji-unread" hidden>NEW</span>';
  header.append(link,noticeButton);
  lobby.insertBefore(header,lobby.firstChild);
  const tip=document.createElement('p');tip.className='moji-mobile-landscape-tip';
  tip.textContent='📱 スマホ版は横画面推奨｜横向きならマップと装備がより見やすくなります';
  header.insertAdjacentElement('afterend',tip);
  const overlay=document.createElement('div');overlay.id='mojiNoticeOverlay';
  overlay.className='moji-notice-overlay';overlay.hidden=true;
  overlay.setAttribute('role','presentation');
  const dialog=document.createElement('section');dialog.className='moji-notice-dialog';
  dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
  dialog.setAttribute('aria-labelledby','mojiNoticeHeading');
  dialog.innerHTML='<div class="moji-notice-head"><h2 id="mojiNoticeHeading">📮 文字武装からのお知らせ</h2><button id="mojiNoticeClose" type="button" aria-label="お知らせを閉じる">×</button></div><p class="moji-notice-description">アップデート・イベント・遊び方をここから配信します。</p><div id="mojiNoticeItems" class="moji-notice-items"></div>';
  overlay.append(dialog);lobby.append(overlay);
  let lastFocus=null;
  const close=()=>{overlay.hidden=true;noticeButton.setAttribute('aria-expanded','false');lastFocus?.focus?.()};
  $('mojiNoticeClose').addEventListener('click',close);
  overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)close()});
  function render(){
   const list=$('mojiNoticeItems');list.replaceChildren();
   for(const item of announcements){
    const article=document.createElement('article');article.className='moji-notice-item';
    const meta=document.createElement('small');meta.textContent=(item.date||'')+' ・ '+(item.category||'お知らせ');
    const title=document.createElement('h3');title.textContent=item.title||'お知らせ';
    const body=document.createElement('p');body.textContent=item.body||'';
    article.append(meta,title,body);list.append(article);
   }
  }
  const currentId=()=>announcements[0]?.id||'';
  const lastRead=()=>{try{return localStorage.getItem('moji_notice_seen_id')||''}catch{return ''}};
  const markRead=()=>{try{localStorage.setItem('moji_notice_seen_id',currentId())}catch{}};
  const badge=()=>{$('mojiUnread').hidden=lastRead()===currentId()};
  noticeButton.addEventListener('click',()=>{
   lastFocus=document.activeElement;render();overlay.hidden=false;
   noticeButton.setAttribute('aria-expanded','true');markRead();badge();$('mojiNoticeClose').focus();
  });
  badge();
  fetch('/notices.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{
   if(!data||!Array.isArray(data.notices)||!data.notices.length)return;
   announcements=data.notices.filter(x=>typeof x.title==='string'&&typeof x.body==='string').slice(0,15);
   if(announcements.length){badge();if(!overlay.hidden)render()}
  }).catch(()=>{});
  // Keep the original buttons (including their listeners and IDs) while
  // removing the redundant online matchmaking panel from the lower lobby.
  // A room can still be created from immediately left of the CPU start CTA.
  const start=$('start');
  if(start&&!$('mojiSortieDock')){
   const bar=document.createElement('div');bar.id='mojiSortieDock';bar.className='moji-sortie-dock';
   const label=document.createElement('span');label.className='moji-sortie-text';
   label.textContent='⚔ 装備が決まったら出撃';
   const actions=document.createElement('div');actions.className='moji-sortie-actions';
   start.parentNode.insertBefore(document.createComment('Start button moved to sticky bar'),start);
   actions.append(start);bar.append(label,actions);lobby.append(bar);
  }
  function moveRoomButtonAndRemovePanel(){
   const bar=$('mojiSortieDock'),actions=bar?.querySelector('.moji-sortie-actions');
   if(!actions)return false;
   const heading=[...lobby.querySelectorAll('h1,h2,h3,h4,legend,.section-head,header,strong')]
    .find(node=>node!==bar&&/ロビーからオンライン対戦/.test(node.textContent||'')&&
      (node.textContent||'').length<180);
   const panel=heading?.closest('.panel')||heading?.closest('section');
   if(!panel||panel===lobby||panel.contains(bar))return false;
   const create=[...panel.querySelectorAll('button')]
    .find(button=>/ルームを作成|新しいルームを作る/.test(button.textContent||''));
   if(!create)return false; // Never remove the existing control without relocating it.
   create.classList.add('moji-dock-room-create');
   create.setAttribute('aria-label','オンライン対戦のルームを作成');
   actions.insertBefore(create,start); // Preserve its original click handler.
   panel.remove(); // Includes now-unneeded matchmaking, code entry, and join buttons.
   return true;
  }
  if(!moveRoomButtonAndRemovePanel()){
   // Some lobby sections are rendered only after the player signs in.
   const observer=new MutationObserver(()=>{
    if(moveRoomButtonAndRemovePanel())observer.disconnect();
   });
   observer.observe(lobby,{subtree:true,childList:true});
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();
