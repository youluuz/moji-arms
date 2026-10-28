// Build-free check for the public GitHub Pages launch and SEO files.
// This doesn't contact Render, wake its free server, or spend external API fees.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const docs=path.resolve(__dirname,'../docs');
const read=f=>fs.readFileSync(path.join(docs,f),'utf8');
const html=read('index.html'),privacy=read('privacy.html');
const sitemap=read('sitemap.xml'),robots=read('robots.txt'),notFound=read('404.html');
const canonical='https://youluuz.github.io/moji-arms/';
const game='https://moji-arms-online.onrender.com/';
const tests=[
 ['canonical and title',()=>{assert.ok(html.includes('<link rel="canonical" href="'+canonical+'">'));assert.ok(html.includes('<title>文字武装'));}],
 ['public beta entry',()=>{assert.ok(html.includes('href="'+game+'"'));assert.ok(html.includes('無料でプレイ'));assert.ok(html.includes('15分')||html.includes('1分'));}],
 ['sharing with friends',()=>{assert.match(html,/id="shareX"/);assert.match(html,/id="shareBluesky"/);assert.match(html,/id="shareCopy"/);assert.ok(html.includes('https://x.com/intent/post'));assert.ok(html.includes('https://bsky.app/intent/compose'));assert.ok(html.includes('navigator.clipboard.writeText'));assert.ok(html.includes('socialMessage'));}],
 ['mobile and accessibility',()=>{assert.ok(html.includes('viewport-fit=cover'));assert.ok(html.includes('@media(max-width:750px)'));assert.ok(html.includes('aria-label="無料で友達に文字武装を紹介"'));}],
 ['FAQs and public safety',()=>{assert.ok(html.includes('id="faq"'));assert.ok(html.includes('別々のWi-Fi'));assert.ok(html.includes('初回アクセス'));assert.ok(privacy.includes('プライバシー'));assert.ok(html.includes('href="./privacy.html"'));}],
 ['public beta discoverability',()=>{assert.ok(html.includes('一般公開ベータテスト実施中'));assert.ok(html.includes('文字で戦う無料ブラウザゲーム'));assert.ok(html.includes('"@type":"VideoGame"'));assert.ok(html.includes('"isAccessibleForFree":true'));}],
 ['search engine metadata',()=>{assert.ok(html.includes('og:url'));assert.ok(html.includes('og:image'));assert.ok(html.includes('twitter:card'));assert.ok(sitemap.includes('<loc>'+canonical+'</loc>'));assert.ok(robots.includes('Sitemap: '+canonical+'sitemap.xml'));assert.ok(sitemap.includes('privacy.html'));assert.ok(sitemap.includes('<lastmod>2026-10-28</lastmod>'));}],
 ['error navigation',()=>{assert.ok(notFound.includes('href="/moji-arms/"'));assert.ok(notFound.includes('ページが見つかりません'));}],
 ['no third-party tracking',()=>{assert.doesNotMatch(html,/<script[^>]*\bsrc=/i);assert.doesNotMatch(html,/(googletagmanager|gtag\(|fbq\(|google-analytics|matomo\.js)/i);}]
];
for(const [name,check] of tests){check();console.log('OK free launch:',name)}
console.log('Public Pages build-ready checks: '+tests.length+' passed.');
