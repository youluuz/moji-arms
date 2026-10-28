#!/usr/bin/env node
/*
 * 文字武装 — 公開前の無料チェック
 * Usage: node scripts/public-release-check.mjs https://YOUR-RENDER-URL
 * Optional: PAGES_URL=https://YOUR-PAGES-URL node scripts/public-release-check.mjs ...
 * Uses Node 22's built-in fetch/WebSocket, installs no packages and NEVER
 * creates rooms or fires gameplay input. Intended for explicit manual runs.
 */
import process from 'node:process';

const raw=process.argv[2]||process.env.PUBLIC_BASE_URL;
if(!raw){console.error('公開したRender URLを引数で渡してください。例: node scripts/public-release-check.mjs https://YOUR-SERVICE.onrender.com');process.exit(2)}
let base;
try{
 base=new URL(raw);
 if(!['https:','http:'].includes(base.protocol))throw Error('http(s) required');
 if(base.username||base.password||base.search||base.hash)throw Error('credentials, query, fragment not allowed');
 base.pathname='/';
}catch(error){console.error('公開URLの形式が正しくありません:',error.message);process.exit(2)}
if(base.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(base.hostname)){
 console.error('一般公開先はHTTPSのURLを指定してください。');process.exit(2)
}
const failures=[],success=[];
const warmWait=95_000, timeout=20_000;
function mark(name,ok,detail=''){
 (ok?success:failures).push(name+(detail?' — '+detail:''));
 console.log((ok?'✅ ':'❌ ')+name+(detail?'　'+detail:''));
}
async function request(path,{deadline=timeout,method='GET'}={}){
 const url=new URL(path,base);
 const res=await fetch(url,{method,redirect:'follow',signal:AbortSignal.timeout(deadline),headers:{'User-Agent':'Mojibusou-Beta-Release-Check/1.0'}});
 return res;
}
async function check(path,name,match,opts={}){
 try{
  const res=await request(path,opts);
  const body=opts.method==='HEAD'?'':await res.text();
  const ok=res.ok&&(match?match(body,res):true);
  mark(name,ok,ok?'HTTP '+res.status:'HTTP '+res.status+' / 内容が期待と異なります');
  return {ok,body,res};
 }catch(e){mark(name,false,e.message);return {ok:false,body:'',res:null}}
}
console.log('文字武装 公開ベータ・リリース確認 → '+base.origin);
console.log('※ 無料サービスの初回起動に合わせて最初の応答のみ最大95秒待ちます。');
const health=await check('/healthz','① Render公開サーバー起動',s=>{try{return JSON.parse(s).ok===true}catch{return false}},{deadline:warmWait});
if(!health.ok){console.error('ホスティング先が起動していません。Render → Deploys の Live を先に確認してください。');process.exit(1)}
const healthInfo=JSON.parse(health.body);
mark('①a 公開ベータの版数',healthInfo.version==='10.0-beta',
 healthInfo.version||'不明／古いサーバーが動いています');
if(process.env.EXPECTED_COMMIT?.trim()){
 const expected=process.env.EXPECTED_COMMIT.trim().toLowerCase();
 const deployed=String(healthInfo.commit||'').toLowerCase();
 mark('①b GitHubの指定コミットが本番に反映',deployed.startsWith(expected),
  deployed?deployed.slice(0,12):'Render上のコミット情報がありません');
}else if(healthInfo.commit){
 console.log('🔎 Renderで稼働中のGitコミット：'+healthInfo.commit.slice(0,12));
}
const root=await check('/','② ゲームの共通ロビー',s=>s.includes('moji')||s.includes('文字武装'));
const promo=await check('/about.html','③ 紹介ページ・無料プレイ案内',s=>s.includes('無料でプレイ')&&s.includes('友達にシェア'));
const privacy=await check('/privacy.html','④ 個人情報・ベータ注意事項',s=>s.includes('プライバシー')&&s.includes('オンライン対戦'));
const multi=await check('/multiplayer.html','⑤ オンライン対戦ロビー',s=>s.includes('roomCode')&&s.includes('WebSocket')||s.includes('roomCode')&&s.includes('sock'));
const roman=await check('/roman-effects-v97.js','⑥ ロマン砲の最新版エフェクト',s=>s.includes('drawImpact')&&s.includes('drawShot')&&!s.includes("fillText('撃破"));
const icon=await check('/mojibusou-icon.png','⑦ ゲームのアイコン画像',(_,res)=>res.headers.get('content-type')?.includes('image/')===true,{method:'HEAD'});
const notices=await check('/notices.json','⑦a 公開ベータ案内と初プレイ報酬',s=>{
 try{
  const list=JSON.parse(s).notices;
  return Array.isArray(list)&&list.length>=3&&
   list[0].id==='2026-10-28-dance-120-slot-stats-v141'&&list[0].title.includes('ダンス1.2倍')&&
   list.some(n=>n.id==='2026-10-28-public-beta-open'&&n.title.includes('公開ベータテスト'))&&
   list.some(n=>n.id==='2026-10-27-welcome-gift'&&n.rewardCoins===3&&n.title.includes('3コイン'));
 }catch{return false}
});
const robots=await check('/robots.txt','⑦b 検索エンジンのクロール許可',s=>s.includes('Allow: /')&&s.includes('Sitemap: https://moji-arms-online.onrender.com/sitemap.xml'));
const sitemap=await check('/sitemap.xml','⑦c ゲーム本体のサイトマップ',s=>s.includes('<loc>https://moji-arms-online.onrender.com/</loc>')&&s.includes('/about.html'));
const dock=await check('/mobile-stick-dock-v100.js','⑦b モバイル操作欄',s=>s.includes('moji-map-with-stick')&&s.includes('cpuMoveZone')&&s.includes('touchControls'));
const css=await check('/lobby-refresh-v100.css','⑦c ロビー表示刷新',s=>s.includes('moji-notice-overlay')&&s.includes('moji-sortie-dock'));
if(root.ok){
 mark('⑧ トップページで最新版を参照',root.body.includes('roman-effects-v97.js'),root.body.includes('roman-effects-v97.js')?'ロマン砲v97読み込み':'更新前のHTMLです');
 mark('⑧a 一般公開ベータのお知らせ表示',root.body.includes('/launch-nav.js?v=140'),'告知スクリプト最新版');
 mark('⑧b 検索エンジン用ゲーム情報',root.body.includes('"@type":"VideoGame"')&&root.body.includes('rel="canonical"'),'構造化データ・canonical');
}
if(multi.ok)mark('⑨ オンライン側で最新版を参照',multi.body.includes('roman-effects-v97.js'),multi.body.includes('roman-effects-v97.js')?'ロマン砲v97読み込み':'更新前のHTMLです');

// Real browser-compatible same-origin WS handshake; immediately close without joining.
// Node v22 supports WebSocket out of the box; browsers send Origin automatically.
async function checkSocket(){
 if(typeof WebSocket!=='function'){mark('⑩ WebSocketハンドシェイク',false,'Node 22+ が必要');return}
 const wsUrl=new URL('/ws',base);
 wsUrl.protocol=base.protocol==='https:'?'wss:':'ws:';
 try{
  const state=await new Promise((resolve,reject)=>{
   const ws=new WebSocket(wsUrl.href);
   const timer=setTimeout(()=>{ws.close();reject(Error('10秒以内に接続できません'))},10_000);
   ws.addEventListener('open',()=>{clearTimeout(timer);ws.close(1000);resolve('接続成功')},{once:true});
   ws.addEventListener('error',()=>{clearTimeout(timer);reject(Error('WebSocket接続失敗'))},{once:true});
  });
  mark('⑩ WebSocket接続',true,state);
 }catch(e){mark('⑩ WebSocket接続',false,e.message)}
}
await checkSocket();
if(process.env.PAGES_URL?.trim()){
 try{
  const url=new URL(process.env.PAGES_URL);
  const res=await fetch(url,{signal:AbortSignal.timeout(20_000)});
  const s=await res.text();
  mark('⑪ GitHub Pages宣伝サイト',res.ok&&s.includes('文字武装')&&s.includes('無料でプレイ'), 'HTTP '+res.status);
  // Confirm the published play button actually targets the same verified Render URL.
  const found=s.match(/<a class="cta primary" href="([^"]+)"/);
  const matched=found?.[1]&&new URL(found[1],url).origin===base.origin;
  mark('⑫ 宣伝サイトのリンク先',!!matched,matched?'公開ゲームと一致':'GitHub PagesのプレイURLを修正してください');
 }catch(e){mark('⑪ GitHub Pages宣伝サイト',false,e.message)}
}
console.log('\n確認成功 '+success.length+'件 / 問題 '+failures.length+'件');
if(failures.length){
 console.log('告知はまだ実施せず、Renderの稼働・公開リンクとGitHub Pages設定を修正してください。');
 process.exitCode=1;
}else{
 console.log('HTTPとWebSocketによる一次検証は成功。一般公開前に別Wi-Fi・実機でルーム入室と戦闘を確認してください。');
}
