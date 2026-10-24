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
const root=await check('/','② ゲームの共通ロビー',s=>s.includes('moji')||s.includes('文字武装'));
const promo=await check('/about.html','③ 紹介ページ・無料プレイ案内',s=>s.includes('無料でプレイ')&&s.includes('友達にシェア'));
const privacy=await check('/privacy.html','④ 個人情報・ベータ注意事項',s=>s.includes('プライバシー')&&s.includes('オンライン対戦'));
const multi=await check('/multiplayer.html','⑤ オンライン対戦ロビー',s=>s.includes('roomCode')&&s.includes('WebSocket')||s.includes('roomCode')&&s.includes('sock'));
const roman=await check('/roman-effects-v97.js','⑥ ロマン砲の最新版エフェクト',s=>s.includes('drawImpact')&&s.includes('drawShot')&&!s.includes("fillText('撃破"));
const icon=await check('/mojibusou-icon.png','⑦ ゲームのアイコン画像',(_,res)=>res.headers.get('content-type')?.includes('image/')===true,{method:'HEAD'});
if(root.ok)mark('⑧ トップページで最新版を参照',root.body.includes('roman-effects-v97.js'),root.body.includes('roman-effects-v97.js')?'ロマン砲v97読み込み':'更新前のHTMLです');
if(multi.ok)mark('⑨ オンライン側で最新版を参照',multi.body.includes('roman-effects-v97.js'),multi.body.includes('roman-effects-v97.js')?'ロマン砲v97読み込み':'更新前のHTMLです');

// Real browser-compatible same-origin WS handshake; immediately close without joining.
// Note: Node v22 has WebSocket built-in and can send the Origin header.
async function checkSocket(){
 if(typeof WebSocket!=='function'){mark('⑩ WebSocketハンドシェイク',false,'Node 22+ が必要');return}
 const wsUrl=new URL('/ws',base);
 wsUrl.protocol=base.protocol==='https:'?'wss:':'ws:';
 try{
  const state=await new Promise((resolve,reject)=>{
   const ws=new WebSocket(wsUrl.href,{headers:{Origin:base.origin}});
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
