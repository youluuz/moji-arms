// End-to-end canvas regression: the local player, original enemy and every
// additional CPU all use drawHeroIcon. First enemy's HP bar is NOT oversized.
// Test both normal and custom CPU games without relying on a screenshot.
const {chromium}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8083';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1100,height:760}});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>!!window.MojiUlt&&!!window.MojiStrokeReady,{timeout:18000});
  await page.locator('#playerName').fill('アバター統一テスト');
  await page.locator('#enterLobby').click();
  await page.waitForSelector('#loadoutPanel .ultimate-option',{timeout:15000});
  for(const mode of ['normal','custom']){
   await page.locator('[data-mode-tile="'+mode+'"]').click();
   await page.locator('#cpuBotCount').selectOption('3');
   await page.locator('#shuffleLoadout').click();
   // A completed previous match leaves its 3 CPU objects in memory until the
   // next animation frame initializes the new round. Never audit stale bots.
   const previousRound=await page.evaluate(()=>window.MojiCpuBots?.rounds||0);
   await page.locator('#start').click();
   await page.waitForSelector('#gameScreen.active .weapon',{timeout:16000});
   await page.waitForFunction(previous=>window.MojiCpuBots?.rounds>previous &&
     window.MojiCpuBots.getBots().length===3 &&
     typeof window.drawHeroIcon==='function'&&document.body.classList.contains('in-match'),
     previousRound,{timeout:15000});
   const result=await page.evaluate(()=>{
    const bots=window.MojiCpuBots.getBots();
    const expected=['炎','雷','氷'];
    const previous=bots.map(b=>({ch:b.loadout[0].ch,x:b.x,y:b.y,hp:b.hp}));
    const hero=window.drawHeroIcon,oldRect=ctx.fillRect,seen=[],rects=[];
    bots.forEach((b,i)=>{
     b.hp=MAX_HP;
     b.loadout[0].ch=expected[i];
     b.x=Math.max(80,Math.min(WORLD_W-80,player.x+(i-1)*75));
     b.y=Math.max(80,Math.min(WORLD_H-80,player.y+30));
    });
    window.drawHeroIcon=function(g,x,y,ch,isEnemy,t,...rest){
     seen.push({ch,isEnemy,x,y});
     return hero.call(this,g,x,y,ch,isEnemy,t,...rest);
    };
    ctx.fillRect=function(x,y,w,h){
     if((w===50&&h===5)||(w===62&&h===8)||(w===60&&h===6))
       rects.push({x,y,w,h});
     return oldRect.apply(this,arguments);
    };
    let failed='';
    try{draw(performance.now())}catch(e){failed=String(e)}
    finally{
     window.drawHeroIcon=hero;ctx.fillRect=oldRect;
     bots.forEach((b,i)=>{b.loadout[0].ch=previous[i].ch;b.x=previous[i].x;b.y=previous[i].y;b.hp=previous[i].hp});
    }
    const first=seen.find(x=>x.ch==='炎'&&x.isEnemy===true);
    const others=expected.slice(1).every(ch=>seen.some(x=>x.ch===ch&&x.isEnemy===true));
    const self=seen.some(x=>x.ch===avatarChar&&x.isEnemy===false);
    const hpBars=rects.filter(r=>r.w===50&&r.h===5);
    return {mode:'CPU',failed,expected,draws:seen,first:!!first,others,self,
      count:bots.length,uniformHpBars:hpBars.length,
      oversized:rects.filter(r=>r.w===62||r.w===60)};
   });
   console.log('CPU AVATAR PARITY',mode,JSON.stringify(result));
   if(result.failed||!result.first||!result.others||!result.self||
      result.count!==3||result.uniformHpBars<3||result.oversized.length)
    throw Error(mode+' unaligned original enemy/extra CPU portraits or HP bars '+JSON.stringify(result));
   await page.locator('#retreat').click();
   await page.waitForSelector('#lobbyScreen:not(.hidden)',{timeout:10000});
  }
  if(errors.length)throw Error('Browser errors: '+errors.join(' | '));
  console.log('PASS: normal and custom CPU use one avatar renderer and 50x5 HP bar for all enemies.');
 }finally{await context.close();await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
