/* Public announcements and an always-visible sortie CTA for the old lobby.
   Feed lives in /notices.json: edit the file to publish the next announcement.
   No accounts, databases, server push, or personal analytics are required. */
(function(){
 'use strict';
 const fallback=[{id:'2026-10-28-endgame-corridor-v143',date:'2026-10-28',category:'ゲームバランス改善',title:'⚔ 安全地帯は最後に消滅・通路幅改善',body:'安全地帯が最終的に半径0まで縮小。障害物の間隔とU字型の内側を広げ、通れない隙間を減らしました。「収縮なし」は従来どおりです。'},{id:'2026-10-28-phone-controls-v142',date:'2026-10-28',category:'操作改善',title:'📱 スマホ版：移動ボタン拡大・操作切替を改善',body:'移動スティックを縦100px・横約96pxへ拡大。移動しながらスキル・武装・攻撃を切り替えても操作が途切れにくいよう改善しました。'},{id:'2026-10-28-dance-120-slot-stats-v141',date:'2026-10-28',category:'アップデート',title:'🆕 ダンス1.2倍と試合中の武装性能表示',body:'スマホ縦画面を軽量化。Let\'s DANCE後は使用者の通常武装が試合終了まで1.2倍！武装スロットに画数と強化後・弱体化後の効果値を表示。必殺技ランダムと図鑑ソートも追加。お知らせは閲覧後30日で消えます。'},{id:'2026-10-28-public-beta-open',date:'2026-10-28',category:'重要・ベータテスト',title:'📢 文字武装の公開ベータテストを実施中！',body:'どなたでも無料で参加できます。CPU・オンライン対戦をお楽しみください。開発途中のため不具合が起こることがあります。ご意見や不具合は紹介ページからお知らせください。'},{id:'2026-10-27-welcome-gift',date:'2026-10-27',category:'初プレイ報酬',title:'🎁 ようこそ文字武装へ！3コインプレゼント',body:'初回報酬を受取ボタンから一度だけ受け取れます。',rewardCoins:3}];
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
  noticeButton.innerHTML='<span aria-hidden="true">📮</span><span>お知らせ</span><span id="mojiUnread" class="moji-unread" hidden>● NEW 1件</span>';
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
  // Read timestamps are per notice and per browser. A viewed notice expires
  // from this device after 30 days; the server feed remains unchanged.
  const SEEN_KEY='moji_notice_viewed_at_v1',EXPIRE_MS=30*24*60*60*1000;
  let viewed={};
  try{const saved=JSON.parse(localStorage.getItem(SEEN_KEY)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))viewed=saved}catch(_){}
  const visible=()=>{
    // Re-read the latest timestamps whenever the dialog opens or focus returns.
    // This also keeps expiry correct across tabs and restored sessions.
    try{const saved=JSON.parse(localStorage.getItem(SEEN_KEY)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))viewed=saved}catch(_){}
    return announcements.filter(item=>!Number.isFinite(Number(viewed[item.id]))||Date.now()-Number(viewed[item.id])<EXPIRE_MS);
   };
  const saveViewed=()=>{try{localStorage.setItem(SEEN_KEY,JSON.stringify(viewed))}catch(_){}};
  const markRead=()=>{const now=Date.now();for(const item of visible())if(!Number.isFinite(Number(viewed[item.id])))viewed[item.id]=now;saveViewed()};
  function render(){
   const list=$('mojiNoticeItems');list.replaceChildren();
   const available=visible();
   if(!available.length){const empty=document.createElement('p');empty.textContent='現在表示するお知らせはありません。';list.append(empty)}
   for(const item of available){
    const article=document.createElement('article');article.className='moji-notice-item';
    const meta=document.createElement('small');meta.textContent=(item.date||'')+' ・ '+(item.category||'お知らせ');
    const title=document.createElement('h3');title.textContent=item.title||'お知らせ';
    const body=document.createElement('p');body.textContent=item.body||'';
    article.append(meta,title,body);
    if(item.rewardCoins===3){
     const claimed=()=>{try{return !!JSON.parse(localStorage.getItem('kanji_arms_duel_save_v4')||'{}').firstPlayGiftClaimed}catch(_){return false}};
     const button=document.createElement('button');button.type='button';button.className='moji-welcome-claim';
     const refresh=()=>{button.disabled=claimed();button.textContent=claimed()?'✅ 受取済み（3コイン）':'🪙 3コインを受け取る'};
     refresh();button.onclick=()=>{
      const success=window.MojiClaimWelcomeCoins?.();
      refresh();badge();
      if(!success&&!claimed())button.textContent='読み込み後にもう一度お試しください';
     };article.append(button);
    }
    list.append(article);
   }
  }
  const badge=()=>{
   let rewardAvailable=false;
   try{rewardAvailable=visible().some(n=>n.rewardCoins===3&&!JSON.parse(localStorage.getItem('kanji_arms_duel_save_v4')||'{}').firstPlayGiftClaimed)}catch(_){rewardAvailable=true}
   const unread=rewardAvailable||visible().some(n=>!Number.isFinite(Number(viewed[n.id])));
   $('mojiUnread').hidden=!unread;noticeButton.classList.toggle('moji-notice-attention',unread);
   noticeButton.setAttribute('aria-label',unread?'未読のお知らせ・初プレイ報酬があります':'お知らせを開く');
  };
  noticeButton.addEventListener('click',()=>{
   lastFocus=document.activeElement;render();overlay.hidden=false;
   noticeButton.setAttribute('aria-expanded','true');markRead();badge();$('mojiNoticeClose').focus();
  });
  badge();
  window.addEventListener('focus',()=>{if(!overlay.hidden)render();badge()});
  fetch('/notices.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{
   if(!data||!Array.isArray(data.notices))return;
   announcements=data.notices.filter(x=>typeof x.id==='string'&&typeof x.title==='string'&&typeof x.body==='string').slice(0,15);
   if(!overlay.hidden){render();markRead()}
   badge()
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
   const create=$('createRoomNow')||
    [...lobby.querySelectorAll('button')].find(button=>/ルームを作成|新しいルームを作る/.test(button.textContent||''));
   if(!create)return false;
   // The old online controls are INSIDE the large equipment panel. Never
   // remove that ancestor: it also contains all five weapon slots and ultimates.
   const heading=[...lobby.querySelectorAll('h1,h2,h3,h4,strong,.section-head')]
    .find(node=>/ロビーからオンライン対戦/.test(node.textContent||'')&&
      (node.textContent||'').length<180);
   const protectedNodes=[$('loadoutPanel'),$('setup'),$('battleSettings'),start].filter(Boolean);
   let container=null;
   if(heading){
    let parent=heading;
    while(parent&&parent!==lobby){
     if(parent.contains(create)&&!protectedNodes.some(n=>parent===n||
         (n!==start&&parent.contains(n))||parent.contains(start)))container=parent;
     parent=parent.parentElement;
    }
   }
   // Move the EXISTING button with its click handler, never a dead duplicate.
   create.classList.add('moji-dock-room-create');
   create.setAttribute('aria-label','オンライン対戦のルームを作成');
   actions.insertBefore(create,start);
   if(container)container.remove();
   // When its heading remains, do not delete a shared equipment ancestor.
   return !heading||!!container;
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
