/* Moji Arms / GLYPH STRIKE — opt-in English user-interface beta.
   Keep the original Japanese text and all game values, handlers and glyphs intact.
   Only visible presentation text and accessibility strings are localized. */
(function(){
  "use strict";
  if (window.MojiI18n) return;
  const KEY = "moji_ui_language_v1";
  const query = new URLSearchParams(location.search).get("lang");
  let language = query === "en" || query === "ja" ? query : "ja";
  try {
    if (query === "en" || query === "ja") localStorage.setItem(KEY,language);
    else language = localStorage.getItem(KEY) === "en" ? "en" : "ja";
  } catch (_) {}
  const pairs = [
    ["その一文字が、最強の武器。","One character. The ultimate weapon."],
    ["文字が、武器になる。","Turn characters into weapons."],
    ["無料で遊べるブラウザ対戦ゲーム","Free browser battle game"],
    ["漢字、絵文字、アルファベット、記号。たった1文字が攻撃にも防御にもなる。","Kanji, emoji, letters, and symbols. One character can attack or defend."],
    ["は、5つの文字を装備して戦う無料のブラウザ対戦ゲーム。","is a free browser battle game where you equip five characters."],
    ["漢字・ひらがな・絵文字など好きな文字5つを武器にする無料ブラウザゲーム。","A free browser game where you equip five kanji, kana, emoji or other characters as weapons."],
    ["まずはCPUで練習","Practice against CPUs first"],
    ["一般公開ベータテスト実施中","Public beta now available"],
    ["初めての人にも遊びやすいよう改善を続けています。","We are improving the game to make it easier for new players."],
    ["は個人制作のゲーム。","is an independently developed game."],
    ["画数によって性能と再使用時間が変化する。","Stroke count affects power and cooldown."],
    ["装備の組み合わせから必殺技まで、自分だけの戦い方を作ろう。","Build your own fighting style, from loadouts to ultimate skills."],
    ["直進攻撃・貫通・ホーミング・防御・回復を好きな文字に組み合わせよう。","Combine attacks, piercing, homing, defense and healing with your favorite characters."],
    ["ロマン砲、硬化弾、ダンスなど個性豊かな必殺技から1つを選択。使いどころが勝負の分かれ目。","Choose an ultimate such as the Roman Cannon, Hardened Shot or Dance. Timing matters."],
    ["CPU相手に練習するもよし、ルームコードで友達を招くもよし。最後の生存者を目指せ。","Practice against CPUs or invite friends with a room code. Be the last one standing."],
    ["CPU数を選んで対戦。装備やマップ条件を変えて実力を試そう。","Choose the CPU count and test your skills with different loadouts and maps."],
    ["別々のWi-Fiにいる友達ともルームコードで対戦可能。ランダムマッチの待機ルーム機能も。","Play with friends on different Wi-Fi networks using a room code, or join matchmaking."],
    ["1人で武装や必殺技を試してから、友達とのオンライン対戦に挑戦しよう。","Try your loadout and ultimates solo before challenging friends online."],
    ["気になった操作や追加してほしい要素を","Report issues or suggest improvements using the "],
    ["から送れます。※GitHubのアカウントが必要です。"," form. A GitHub account is required."],
    ["無料・インストール不要でプレイできます。スマホとPCのブラウザに対応しています。通信費は利用環境によって発生します。","Yes. Play for free in a mobile or desktop browser without installing anything. Data charges may apply."],
    ["オンラインマルチでルームを作成し、表示された招待リンクを友達に送ってください。相手もブラウザから参加できます。","Create an online room and share its invite link. Friends can join in their browsers."],
    ["ゲームは無料サーバーを利用しているため、しばらくアクセスがないと休止します。最初の起動に約1分かかる場合があります。少し時間をおいて再読み込みしてください。","The free game server sleeps when idle. First startup may take about a minute; reload if necessary."],
    ["ゲーム内の一部の進行状況はブラウザ内に保存されます。別のブラウザや端末に自動では移らないため、ブラウザデータ削除には注意してください。","Some progress is saved in this browser. It does not automatically transfer to other devices. Do not clear browser data without a backup."],
    ["使いたい1文字を5つのスロットに装備。全部ランダム設定も可能。","Equip one character in each of five slots, or randomize the full loadout."],
    ["CPU戦はすぐスタート。オンラインはルームへ参加し、ホストが開始。","CPU matches start immediately. For online matches, join a room and wait for the host."],
    ["狙う方向へ攻撃。移動はスティック／WASD。最後まで生き残ろう。","Aim to attack, move with the stick or WASD, and survive to the end."],
    ["無料サーバーは無通信が続くと休止するため、最初のアクセスに少し時間がかかる場合があります。","The free server may take a little time to wake up after inactivity."],
    ["ルームはサーバー再起動で消えることがあります。","Rooms may disappear when the server restarts."],
    ["個人情報をプレイヤー名やルーム共有文に入力しないでください。","Do not put personal information in player names or room messages."],
    ["初回アクセス時は無料サーバーの起動に約1分かかる場合があります。接続が切れたら、再読み込みしてからお試しください。","The free server may take about a minute to start. Reload if disconnected."],
    ["インストール不要 · PC／スマホ対応 · CPU戦／オンライン対戦","No installation · PC / mobile · CPU / online battles"],
    ["対戦で実際に発動した文字を自動収集。タップで1文字ずつコピーできます。","Automatically collect characters used in battle. Tap to copy any entry."],
    ["名前・戦績・コイン・所持装飾・装備・実績・文字図鑑を、このブラウザに自動保存します。","Your profile, stats, coins, cosmetics, loadout, achievements and glyph book are saved in this browser."],
    ["端末を替える場合はバックアップファイルを使ってください。","Use a backup file to move to another device."],
    ["対戦モードを選ぶ","Choose a Battle Mode"],
    ["まず遊び方を選択。選択中のモードは金色で表示されます。","Choose how to play. The selected mode is highlighted in gold."],
    ["そのほかの対戦設定","Additional Match Settings"],
    ["マップ・CPU人数・画面の向きなどはここから調整。","Set the map, CPU count, screen orientation and more."],
    ["CPU相手に戦う・文字の画数は自動計算","Battle CPUs · automatic stroke counts"],
    ["CPU相手に戦う・画数を自分で設定","Battle CPUs · set stroke counts yourself"],
    ["ほかのプレイヤーと対戦・画数は自動計算","Battle other players · automatic stroke counts"],
    ["ほかのプレイヤーと対戦・画数を自分で設定","Battle other players · set stroke counts yourself"],
    ["公開情報とゲームのお知らせ","Game information and announcements"],
    ["文字武装の紹介・遊び方・友達にシェア →","About the game · How to play · Share →"],
    ["スマホ版は横画面推奨｜横向きならマップと装備がより見やすくなります","Landscape mode is recommended on phones for a better view"],
    ["文字武装からのお知らせ","Game Announcements"],
    ["アップデート・イベント・遊び方をここから配信します。","Find updates, events and gameplay tips here."],
    ["現在表示するお知らせはありません。","No announcements to show right now."],
    ["装備が決まったら出撃","Ready your loadout, then fight!"],
    ["未読のお知らせ・初プレイ報酬があります","Unread announcements or welcome reward available"],
    ["お知らせを開く","Open announcements"],
    ["お知らせを閉じる","Close announcements"],
    ["ルームを作成","Create Room"],
    ["新しいルームを作る","Create New Room"],
    ["ルームコードを入力","Enter Room Code"],
    ["ルームコード","Room Code"],
    ["コードで参加","Join by Code"],
    ["ルームに参加","Join Room"],
    ["オンライン対戦のルームを作成","Create an online battle room"],
    ["カスタムマッチのプレイヤー最大HP","Custom match maximum HP"],
    ["必殺ゲージの初期チャージ率","Initial ultimate charge percentage"],
    ["画数設定可能（1〜84画）","Set stroke count (1–84)"],
    ["好きな文字の画数を手動で設定できます。","Set your chosen character's stroke count manually."],
    ["必殺ゲージ初期チャージ","Initial Ultimate Charge"],
    ["初心者向けガイド","Beginner Guide"],
    ["5つの能力の使い方・効果を見る","View How the Five Abilities Work"],
    ["ステージを選択","Select Stage"],
    ["マップを選択","Choose Map"],
    ["プレイヤー名","Player Name"],
    ["名前を入力","Enter Name"],
    ["表示名","Display Name"],
    ["ログイン","Sign In"],
    ["ゲストで遊ぶ","Play as Guest"],
    ["ゲストとして始める","Start as Guest"],
    ["ゲームを始める","Start Game"],
    ["試合を開始","Start Match"],
    ["戦闘開始","Battle Start"],
    ["ルーム作成","Create Room"],
    ["準備完了（装備を保存）","Ready (Save Loadout)"],
    ["準備完了","Ready"],
    ["装備を保存","Save Loadout"],
    ["武装を変更","Change Loadout"],
    ["保存データを読み込む","Import Saved Data"],
    ["保存データを書き出す","Export Saved Data"],
    ["まだ記録がありません。試合で文字の武装を使うと自動で登録されます。","No entries yet. Use characters in a match to record them here."],
    ["登録済み","Collected"],
    ["最近使った順","Recently Used"],
    ["使用回数","Times Used"],
    ["あいうえお順","Alphabetical"],
    ["昇順","Ascending"],
    ["降順","Descending"],
    ["並び替え","Sort By"],
    ["文字図鑑","Glyph Collection"],
    ["プレイヤーデータを保存・引き継ぎ","Back Up & Transfer Player Data"],
    ["通常CPU / カスタムCPU","Normal CPU / Custom CPU"],
    ["通常マルチ / カスタムマルチ","Normal Online / Custom Online"],
    ["CPU 通常戦","CPU Battle"],
    ["CPU カスタム戦","Custom CPU Battle"],
    ["オンライン通常戦","Online Battle"],
    ["オンラインカスタム戦","Custom Online Battle"],
    ["カスタムマルチ","Custom Online"],
    ["通常マルチ","Normal Online"],
    ["通常攻撃","Attack"],
    ["ホーミング","Homing"],
    ["貫通","Pierce"],
    ["防御","Defense"],
    ["回復","Heal"],
    ["必殺技","Ultimate"],
    ["必殺ゲージ","Ultimate Gauge"],
    ["通常マッチ","Normal Match"],
    ["カスタムマッチ","Custom Match"],
    ["カスタム","Custom"],
    ["通常","Normal"],
    ["画数（カスタム）","Strokes (Custom)"],
    ["画数（自動）","Strokes (Auto)"],
    ["画数","Strokes"],
    ["最大HP","Max HP"],
    ["人数","Players"],
    ["CPU人数","CPU Count"],
    ["CPU数","CPU Count"],
    ["収縮速度","Zone Shrink Speed"],
    ["収縮なし","No Shrink"],
    ["収縮","Shrink"],
    ["練習","Practice"],
    ["移動","Move"],
    ["攻撃","Attack"],
    ["スキル","Skill"],
    ["能力","Ability"],
    ["武装","Loadout"],
    ["装備","Equip"],
    ["対戦","Battle"],
    ["観戦","Spectate"],
    ["再戦","Rematch"],
    ["ロビーに戻る","Return to Lobby"],
    ["戻る","Back"],
    ["続ける","Continue"],
    ["選択","Select"],
    ["決定","Confirm"],
    ["キャンセル","Cancel"],
    ["閉じる","Close"],
    ["読み込み中","Loading"],
    ["ロード中","Loading"],
    ["接続中","Connecting"],
    ["待機中","Waiting"],
    ["勝利","Victory"],
    ["敗北","Defeat"],
    ["引き分け","Draw"],
    ["残り人数","Remaining Players"],
    ["生存者","Survivors"],
    ["キル数","Eliminations"],
    ["撃破数","Eliminations"],
    ["報酬","Rewards"],
    ["コイン","Coins"],
    ["ガチャ","Gacha"],
    ["実績","Achievements"],
    ["お知らせ","News"],
    ["画面の向き","Screen Orientation"],
    ["モード","Modes"],
    ["プレイモード","Game Modes"],
    ["無料でプレイ","Play for Free"],
    ["無料で遊ぶ","Play for Free"],
    ["文字武装を始める","Play Moji Arms"],
    ["友達にシェア","Share with Friends"],
    ["紹介URLをコピー","Copy Game Link"],
    ["コピーしました","Copied"],
    ["この文章をコピーして友達に送ってください","Copy this text and send it to a friend"],
    ["このリンクをシェアしてください","Share this link"],
    ["ゲームへ","Play Game"],
    ["遊び方","How to Play"],
    ["遊び方はかんたん。","Easy to Play."],
    ["よくある質問","Frequently Asked Questions"],
    ["文字で戦い方が変わる。","Your Characters Shape Your Strategy."],
    ["5つの文字を武装","Equip Five Characters"],
    ["一発逆転の必殺技","Game-Changing Ultimate Skills"],
    ["最大10人のバトル","Battles with Up to 10 Players"],
    ["一般公開ベータテスト","Public Beta"],
    ["意見・不具合を報告","Feedback & Bug Reports"],
    ["無料で遊べる？ ダウンロードは必要？","Is it free? Do I need to download anything?"],
    ["友達と別々のWi-Fiでも対戦できる？","Can friends on different Wi-Fi networks play together?"],
    ["最初の読み込みが遅いときは？","Why does the first load take a while?"],
    ["データは別のスマホへ引き継げる？","Can I transfer progress to another device?"],
    ["プレイヤー名と文字を設定","Choose a Name and Characters"],
    ["試合を開始","Start a Match"],
    ["タップ／クリックで攻撃","Tap or Click to Attack"],
    ["公開ベータについて","About the Public Beta"],
    ["準備はいいか？","Ready to Battle?"],
    ["次の勝者は、あなたかもしれない。","You Could Be the Next Winner."],
    ["プライバシー・注意事項","Privacy & Notices"],
    ["個人制作ブラウザゲーム","Independently Developed Browser Game"],
    ["対戦モード","Battle Mode"],
    ["選択中","Selected"],
    ["簡単設定","Quick Setup"],
    ["任意","Optional"],
    ["文字ランダム","Random Character"],
    ["全枠ランダム","Randomize All"],
    ["絵文字5枠ランダム","Randomize 5 Emoji"],
    ["初プレイ報酬","Welcome Reward"],
    ["受取済み","Claimed"],
    ["受け取る","Claim"],
    ["新規","New"],
    ["レッツダンス","Let's Dance"],
    ["無料","Free"],
    ["使い方","Instructions"],
    ["設定","Settings"],
    ["詳細","Details"],
    ["戦績","Stats"],
    ["ホーム","Home"],
    ["ルーム","Room"],
    ["保存","Save"],
    ["削除","Delete"],
    ["コピー","Copy"],
    ["音量","Volume"],
    ["音楽","Music"],
    ["効果音","Sound Effects"],
    ["背景","Background"],
    ["マップ","Map"],
    ["回数","Uses"],
    ["種類","Type"],
    ["説明","Description"],
    ["検索","Search"],
    ["誰でも","Everyone"]
  ];
  // Longer keys must run first. Never translate the one-character glyphs used in combat.
  const words = pairs.filter(x => x[0].length > 1).sort((a,b) => b[0].length-a[0].length);
  const originalText = new WeakMap();
  const originalAttr = new WeakMap();
  const skip = "script,style,noscript,textarea,svg,[contenteditable],#mojiLanguageToggle,.moji-language-toggle";
  function translate(raw){
    if (!/[ぁ-んァ-ヶ一-龯]/u.test(raw)) return raw;
    let output = raw;
    for (const entry of words) {
      if (output.includes(entry[0])) output = output.split(entry[0]).join(entry[1]);
    }
    return output;
  }
  function skipNode(element){
    return !element || !!element.closest(skip);
  }
  function visitText(node){
    if (!node.parentElement || skipNode(node.parentElement)) return;
    const current = node.nodeValue;
    if (!current || !current.trim() || current.trim().length === 1) return;
    const prev = originalText.get(node);
    if (language === "ja") {
      if (prev && current === prev.english) node.nodeValue = prev.japanese;
      originalText.delete(node);
      return;
    }
    if (prev && current === prev.english) return;
    const english = translate(current);
    if (english !== current) {
      originalText.set(node,{japanese:current,english});
      node.nodeValue = english;
    }
  }
  const ATTRS=["aria-label","title","placeholder","alt"];
  function visitAttributes(node){
    if (skipNode(node)) return;
    let states=originalAttr.get(node);
    if (!states) states={};
    for (const attr of ATTRS) {
      if (!node.hasAttribute(attr)) continue;
      const current=node.getAttribute(attr);
      const prev=states[attr];
      if(language==="ja"){
        if(prev && prev.english===current) node.setAttribute(attr,prev.japanese);
        delete states[attr];
      }else{
        if(prev && prev.english===current) continue;
        const english=translate(current);
        if(english!==current){
          states[attr]={japanese:current,english};
          node.setAttribute(attr,english);
        }
      }
    }
    originalAttr.set(node,states);
  }
  function translateSubtree(root){
    if(!root)return;
    if(root.nodeType===3){visitText(root);return;}
    if(root.nodeType!==1 && root.nodeType!==9 && root.nodeType!==11)return;
    if(root.nodeType===1 && skipNode(root))return;
    if(root.nodeType===1)visitAttributes(root);
    const owner=root.ownerDocument||document;
    const walker=owner.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
      const item=walker.currentNode;
      if(item.nodeType===3)visitText(item);else visitAttributes(item);
    }
  }
  const toolbars=[];
  function syncButtons(){
    for(const toolbar of toolbars){
      for(const button of toolbar.querySelectorAll("button")){
        const isSelected=button.dataset.language===language;
        button.setAttribute("aria-pressed",String(isSelected));
        button.classList.toggle("selected",isSelected);
      }
    }
  }
  function updateLinks(){
    const anchors=document.querySelectorAll('a[href*="moji-arms-online.onrender.com"]');
    for(const anchor of anchors){
      try{
        const url=new URL(anchor.href);
        if(url.hostname!=="moji-arms-online.onrender.com")continue;
        if(language==="en")url.searchParams.set("lang","en");
        else url.searchParams.delete("lang");
        if(anchor.href!==url.href)anchor.href=url.href;
      }catch(_){}
    }
  }
  function visitFrame(frame){
    try{
      const doc=frame.contentDocument;
      if(!doc || !doc.documentElement)return;
      if(!doc.defaultView.MojiI18n){
        if(doc.getElementById("mojiI18nFrameScript"))return;
        const script=doc.createElement("script");
        script.id="mojiI18nFrameScript";
        script.src="/i18n-ui-v1.js?v=1";
        doc.head?.append(script);
      } else doc.defaultView.MojiI18n.setLanguage(language,false);
    }catch(_){}
  }
  // Dynamic HUD updates can occur every frame; visit an iframe only once
  // per document load, or when the player actually changes languages.
  const localizedFrames = new WeakSet();
  function syncFrames(force=false){
    for(const frame of document.querySelectorAll("iframe")){
      if(!force && localizedFrames.has(frame))continue;
      visitFrame(frame);
      localizedFrames.add(frame);
    }
  }
  function setLanguage(next,persist=true){
    language=next==="en"?"en":"ja";
    document.documentElement.lang=language;
    if(persist){try{localStorage.setItem(KEY,language)}catch(_){}}
    translateSubtree(document.body);
    syncButtons();
    updateLinks();
    syncFrames(true);
  }
  function makeToolbar(parent){
    if(!parent || parent.querySelector(".moji-language-toggle"))return;
    const toolbar=document.createElement("div");
    toolbar.className="moji-language-toggle";
    toolbar.setAttribute("role","group");
    toolbar.setAttribute("aria-label","Display language / 表示言語");
    for(const [code,label] of [["ja","日本語"],["en","English"]]){
      const button=document.createElement("button");
      button.type="button";button.textContent=label;button.dataset.language=code;
      button.title=code==="en"?"Switch to English":"日本語に切り替える";
      button.addEventListener("click",()=>setLanguage(code));
      toolbar.append(button);
    }
    parent.append(toolbar);
    toolbars.push(toolbar);
  }
  function mount(){
    if(document.getElementById("mojiLanguageStyle"))return;
    const style=document.createElement("style");
    style.id="mojiLanguageStyle";
    style.textContent=".moji-language-toggle{position:fixed;top:max(9px,env(safe-area-inset-top));right:max(10px,env(safe-area-inset-right));z-index:1200;display:flex;gap:3px;padding:4px;border:1px solid #6d91b1;border-radius:12px;background:#0b1930ed;box-shadow:0 3px 12px #0009}.moji-language-toggle button{font:700 12px/1.2 system-ui,sans-serif;min-height:32px;min-width:46px;border:0;border-radius:8px;padding:6px 9px;background:transparent;color:#d2e5fa;cursor:pointer}.moji-language-toggle button.selected{background:#eed18f;color:#101a2a}.moji-language-toggle button:focus-visible{outline:2px solid #fff;outline-offset:2px}#lobbyScreen .moji-language-toggle{position:relative;top:auto;right:auto;float:right;margin:8px 12px 8px 0;z-index:40}body.online-battle>.moji-language-toggle{display:none!important}@media(max-width:700px){.moji-language-toggle{top:max(6px,env(safe-area-inset-top));right:max(6px,env(safe-area-inset-right))}.moji-language-toggle button{font-size:11px;min-width:39px;padding:5px 7px}}";
    document.head.append(style);
    if(window.top !== window.self){
      // Embedded arena inherits the parent's selection, without an intrusive overlay.
      setLanguage(language,false);
    }else{
      const login=document.getElementById("loginScreen");
      const lobby=document.getElementById("lobbyScreen");
      if(login || lobby){
        if(login)makeToolbar(login);
        if(lobby)makeToolbar(document.getElementById("mojiModeChoiceCard")||lobby);
      }else makeToolbar(document.body);
      setLanguage(language,false);
    }
    const changed=new Set();
    let timer=null;
    const observer=new MutationObserver(mutations=>{
      for(const m of mutations){
        if(m.type==="characterData")changed.add(m.target);
        if(m.type==="childList")for(const n of m.addedNodes)changed.add(n);
      }
      if(timer!==null)return;
      timer=setTimeout(()=>{
        timer=null;
        for(const n of changed)if(n.isConnected)translateSubtree(n);
        changed.clear();
        updateLinks();
        syncFrames();
      },150);
    });
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    for(const frame of document.querySelectorAll("iframe"))frame.addEventListener("load",()=>visitFrame(frame));
    window.addEventListener("storage",event=>{if(event.key===KEY)setLanguage(event.newValue,false)});
  }
  window.MojiI18n={getLanguage:()=>language,setLanguage,translate};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount,{once:true});
  else mount();
})();