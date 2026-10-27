// Browser regression for live custom-rule inputs, solo HP/ultimate and host room settings.
const {chromium}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8083';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1140,height:800}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>!!window.MojiStrokeReady,{timeout:20000});
  await page.locator('#playerName').fill('カスタム確認');
  await page.locator('#enterLobby').click();
  await page.locator('[data-mode-tile="custom"]').click();
  await page.locator('#customHpInput').waitFor({state:'visible'});
  await page.locator('#customHpInput').fill('725');
  await page.locator('#customChargeInput').fill('60');
  await page.locator('#customChargeInput').press('Tab');
  const lobby=await page.evaluate(()=>({
   vals:window.MojiCustomRules?.values(),
   right:document.querySelector('.loadout-stats .stats-copy')?.textContent,
   hp:document.getElementById('lobbyHP')?.textContent,
  }));
  if(lobby.vals.maxHp!==725||lobby.vals.ultimateStartPercent!==60||
     !lobby.right.includes('画数設定可能')||!lobby.hp.includes('最大HP'))
   throw Error('Custom lobby controls not shown or not applied '+JSON.stringify(lobby));
  await page.locator('#shuffleEmojiLoadout').click();
  await page.locator('#loadoutPanel .ultimate-option[data-ultimate=namepu]').click();
  await page.locator('#start').click();
  await page.waitForFunction(()=>window.MojiCpuBots?.countdownLeft?.()<=0 && window.MojiCpuNamepuVictory?.debug()?.charge===96,null,{timeout:20000});
  const solo=await page.evaluate(()=>({
   maxHP:MAX_HP,own:player.hp,enemy:enemy.hp,
   charge:window.MojiCpuNamepuVictory.debug().charge,
   ultimate:window.MojiCpuNamepuVictory.debug().chosen,
   hpMax:document.getElementById('cpuHpMax')?.textContent,
   enemyMax:document.getElementById('cpuEnemyHpMax')?.textContent
  }));
  if(solo.maxHP!==725||solo.own!==725||solo.enemy!==725||
     solo.charge!==96||solo.ultimate!=='namepu'||
     solo.hpMax!=='725'||solo.enemyMax!=='725')
   throw Error('CPU custom HP or initial charge did not carry into battle '+JSON.stringify(solo));
  await page.locator('#retreat').click();
  const priorRounds=await page.evaluate(()=>window.MojiCpuBots?.rounds||0);
  await page.locator('[data-mode-tile="normal"]').click();
  if(await page.locator('#mojiCustomRuleFields').isVisible())
   throw Error('Normal mode exposed custom controls');
  await page.locator('#start').click();
  await page.waitForFunction(prev=>window.MojiCpuBots?.rounds>prev && window.MojiCpuBots?.countdownLeft?.()<=0 && MAX_HP===600 && window.MojiCpuNamepuVictory?.debug()?.charge===0,priorRounds,{timeout:20000});
  const normal=await page.evaluate(()=>({
   hp:player.hp,maxHP:MAX_HP,charge:window.MojiCpuNamepuVictory.debug().charge
  }));
  if(normal.hp!==600||normal.maxHP!==600||normal.charge!==0)
   throw Error('Normal battle received custom rules '+JSON.stringify(normal));
  await page.locator('#retreat').click();
  await page.locator('[data-mode-tile="multiCustom"]').click();
  await page.locator('#customHpInput').fill('843');
  await page.locator('#customChargeInput').fill('25');
  await page.locator('#createRoomNow').click();
  await page.waitForFunction(()=>{
   const iframe=document.getElementById('onlineFrame');
   return iframe?.contentDocument?.getElementById('roomCustomRules')?.textContent?.includes('HP 843');
  },{timeout:22000});
  const online=await page.evaluate(()=>{
   const stored=JSON.parse(sessionStorage.getItem('kanji_v5_multi_setup')||'{}');
   const text=document.getElementById('onlineFrame')?.contentDocument?.getElementById('roomCustomRules')?.textContent||'';
   return{stored:{maxHp:stored.maxHp,ultimateStartPercent:stored.ultimateStartPercent},text};
  });
  if(online.stored.maxHp!==843||online.stored.ultimateStartPercent!==25||
     !online.text.includes('初期必殺ゲージ 25%'))
   throw Error('Custom online room did not inherit host settings '+JSON.stringify(online));
  if(errors.length)throw Error('Browser runtime errors: '+errors.join('; '));
  console.log('CUSTOM RULES PASS: HP 1–1000 / ultimate 0–100%, CPU battle, normal isolation, online host.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
