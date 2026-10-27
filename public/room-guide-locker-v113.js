/* v11.3 — Separate how-to tab, shared locker while an online room remains
   connected, and one-tap return to the most recent private room. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const parseCode=()=>{
  try{const value=localStorage.getItem('moji_last_room')||'';return /^[A-Z0-9]{6}$/.test(value)?value:''}catch(_){return ''}
 };
 function init(){
  const lobby=$('lobbyScreen'),tabs=$('appTabs');
  if(!lobby||!tabs)return;
  if(typeof APP_SCREENS!=='undefined')APP_SCREENS.guide='lobby';
  const guide=document.createElement('button');
  guide.type='button';guide.dataset.appTab='guide';guide.innerHTML='<span>？</span> 遊び方';
  tabs.append(guide);
  guide.addEventListener('click',()=>{if(typeof switchAppTab==='function')switchAppTab('guide')});
  const panel=document.createElement('section');
  panel.id='mojiGuidePanel';panel.className='panel moji-guide-panel';
  const title=document.createElement('h2');title.textContent='？ 文字武装の遊び方';
  const intro=document.createElement('p');intro.textContent='好きな一文字を5枠に装備して対戦。CPU戦とオンライン戦に対応しています。';
  panel.append(title,intro);
  const sections=[
   ['01｜試合を始める','「プレイ」タブでモードを選び、文字と能力を5枠に設定します。通常戦は文字の画数が自動反映され、カスタム戦では画数を調整できます。'],
   ['02｜基本操作','PC：WASDまたは矢印キーで移動、マウスで狙ってクリック。1〜5キーで武装を選択。スマホ：移動スティックをドラッグし、戦場をタップして攻撃。'],
   ['03｜5つの武装','⚔ 通常攻撃：直進弾・1画あたり9ダメージ。◎ ホーミング：追尾弾・1画あたり3ダメージ。◆ 貫通：障害物と防御を貫通。⬡ 防御：ダメージ軽減。✚ 回復：HPを回復。武装ごとにクールタイムがあります。'],
   ['04｜対戦と観戦','安全エリアは時間経過で縮小します。ルームコードで友達を招待できます。対戦中に参加した人は観戦可能。敗退後も観戦対象を切り替えられます。'],
   ['05｜装飾とロッカー','ガチャや実績で獲得したエフェクトは「エフェクト装備」タブのロッカーで変更できます。ルームの待機室からもロッカーを開けます。装飾は強さに影響しません。'],
   ['06｜スマホ画面','スマホは横画面推奨。待機室で縦・横を選択できます。端末を回したらゲーム表示が広がります。']
  ];
  sections.forEach(([label,body])=>{
   const box=document.createElement('article');box.className='moji-guide-entry';
   const h=document.createElement('h3');h.textContent=label;
   const p=document.createElement('p');p.textContent=body;box.append(h,p);panel.append(box);
  });
  const home=document.createElement('button');home.type='button';home.textContent='← プレイへ戻る';
  home.addEventListener('click',()=>switchAppTab('play'));panel.append(home);
  lobby.append(panel);
  const recent=document.createElement('button');recent.type='button';recent.id='mojiRejoinRoom';
  recent.className='moji-rejoin-room';recent.textContent='↩ 前回のルームへ戻る';recent.hidden=true;
  const dock=$('mojiSortieDock');
  if(dock)dock.querySelector('.moji-sortie-actions')?.prepend(recent);
  else lobby.prepend(recent);
  function syncRoom(){
   const code=parseCode();recent.hidden=!code;
   recent.textContent=code?'↩ 前回のルームへ戻る（'+code+'）':'↩ 前回のルームへ戻る';
  }
  recent.addEventListener('click',()=>{
   const code=parseCode();
   if(code&&typeof window.openEmbeddedMultiplayer==='function')window.openEmbeddedMultiplayer('join',code);
  });
  syncRoom();
  const panelOwned=$('collectionPanel');
  if(!panelOwned)return;
  const marker=document.createComment('Original locker position');
  panelOwned.parentNode.insertBefore(marker,panelOwned);
  const overlay=document.createElement('div');overlay.id='mojiRoomLockerOverlay';overlay.hidden=true;
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','ルームロッカー');
  const inner=document.createElement('div');inner.className='moji-room-locker-inner';
  const head=document.createElement('div');head.className='moji-room-locker-head';
  const caption=document.createElement('strong');caption.textContent='◇ ルームロッカー｜装飾を変更';
  const close=document.createElement('button');close.type='button';close.textContent='× 閉じてルームへ';close.id='mojiRoomLockerClose';
  head.append(caption,close);inner.append(head);overlay.append(inner);document.body.append(overlay);
  function closeLocker(){
   if(overlay.hidden)return;
   marker.parentNode.insertBefore(panelOwned,marker.nextSibling);
   overlay.hidden=true;document.body.classList.remove('moji-room-locker-open');
   try{$('onlineFrame')?.contentWindow?.focus()}catch(_){}
  }
  close.addEventListener('click',closeLocker);
  overlay.addEventListener('click',e=>{if(e.target===overlay)closeLocker()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)closeLocker()});
  window.addEventListener('message',e=>{
   if(e.origin!==location.origin||e.source!==$('onlineFrame')?.contentWindow)return;
   if(e.data?.type==='moji:openRoomLocker'){
    if(overlay.hidden){
     inner.append(panelOwned);overlay.hidden=false;
     document.body.classList.add('moji-room-locker-open');
     $('collectionDrawer').open=true;
     if(typeof updateCollection==='function')updateCollection();
     close.focus();
    }
   }
   if(e.data?.type==='moji:returnLobby')setTimeout(syncRoom,0);
  });
  window.MojiRoomUI={syncRoom,closeLocker};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
