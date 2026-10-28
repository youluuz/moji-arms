package main

import (
 "strings"
 "testing"
)

// The CYBER attack exhaust must follow the travel direction rather than
// mimicking a separate homing reticle. Only visuals may be changed.
func TestDirectionalProjectileCosmeticsPreserveHitboxes(t *testing.T) {
 fx, err := gameFiles.ReadFile("public/owner-cyber-v114.js")
 if err != nil {t.Fatal(err)}
 a := string(fx)
 for _,want:=range []string{"function paintShot(g,kind,t,heading=0)","g.rotate(Number.isFinite(heading)?heading:0)","const blades=[","Three long, razor-pointed armor feathers per side","[[18,5],[54,19+sway],[39,61+sway],[32,21],[23,11]]"} {
  if !strings.Contains(a,want){t.Fatalf("missing directional cosmetic or three-blade wing: %s",want)}
 }
 if strings.Contains(a,"// Reactor rings and a compact rotating hexagonal targeting reticle.") {
  t.Fatal("homing-like target reticle restored on standard cosmetic")
 }
 v,err:=gameFiles.ReadFile("public/weapon-visuals-v86.js")
 if err!=nil {t.Fatal(err)}
 visual:=string(v)
 if !strings.Contains(visual,"cx.font='900 24px sans-serif'")||!strings.Contains(visual,"Math.atan2(b.vy||0,b.vx||1)") {
  t.Fatal("projectile glyph sizing or travel-direction exhaust not updated")
 }
 // Geometry is intentionally owned by battle engines, not by drawProjectile.
 if strings.Contains(visual,"circleRect(")||strings.Contains(visual,"hitFromBullet(") {
  t.Fatal("visual helper should never perform gameplay collision checks")
 }
}

func TestCpuSafeZoneAvoidanceRunsBeforeCombat(t *testing.T) {
 b,err:=gameFiles.ReadFile("public/cpu-battle-v78.js")
 if err!=nil{t.Fatal(err)}
 src:=string(b)
 for _,want:=range []string{"function moveIntoSafeZone(bot,now,dt)","bot.zoneUrgent=distance>=zoneRadius","zoneSetting==='none'","zoneRadius*.24","moveActor(bot,ux*step,uy*step,now)","if(!escaping&&!hardened&&target)","bot.zoneUrgent && action.kind!=='heal'"} {
  if !strings.Contains(src,want){t.Fatalf("CPU ring avoidance missing: %s",want)}
 }
 if strings.Index(src,"const escaping=moveIntoSafeZone(bot,now,dt)")>strings.Index(src,"if(!escaping&&!hardened&&target)") {
  t.Fatal("CPU keeps flanking while outside the safe zone")
 }
 if !strings.Contains(src,"a.r+9") {t.Fatal("CPU projectile collision radius unexpectedly changed")}
 server,err:=gameFiles.ReadFile("public/weapon-visuals-v86.js");if err!=nil{t.Fatal(err)}
 if !strings.Contains(string(server),"drawProjectile(cx,b)"){t.Fatal("shared visual helper unavailable")}
}

func TestCpuSlightDifficultyReductionKeepsSurvivalTactics(t *testing.T) {
 b,err:=gameFiles.ReadFile("public/cpu-battle-v78.js")
 if err!=nil {t.Fatal(err)}
 src:=string(b)
 for _,want:=range []string{
  "const CPU_ATTACK_COOLDOWN_FACTOR=1.08",
  "const CPU_AIM_SPREAD_FACTOR=1.15",
  "(action.kind==='heal'||action.kind==='defense'?1:CPU_ATTACK_COOLDOWN_FACTOR)",
  "(bot.style==='sniper'?.07:bot.style==='rusher'?.28:.18)*CPU_AIM_SPREAD_FACTOR",
  "const escaping=moveIntoSafeZone(bot,now,dt)",
  "bot.hp=Math.min(MAX_HP,bot.hp+n*3.4)",
  "bot.shield=n*SHIELD_PER_STROKE",
  "const speed=action.kind==='homing'?220:action.kind==='pierce'?430:345",
 } {
  if !strings.Contains(src,want){t.Fatalf("CPU modest balance rule missing or unexpectedly changed: %s",want)}
 }
 index,err:=gameFiles.ReadFile("public/index.html")
 if err!=nil {t.Fatal(err)}
 served:=mobilePatchedIndex(string(index))
 if !strings.Contains(served,"/cpu-battle-v78.js?v=127"){t.Fatal("new CPU tuning must be cache-busted in the live game")}
}

func TestCpuAvatarsAndEnemyBarsShareOneVisualContract(t *testing.T) {
 b,err:=gameFiles.ReadFile("public/cpu-battle-v78.js")
 if err!=nil{t.Fatal(err)}
 src:=string(b)
 for _,required:=range []string{
  "drawHeroIcon(cx,x,y,bot.loadout?.[0]?.ch||'敵',true,now/1000)",
  "for(const bot of bots)drawCpuHpBar(bot)",
  "cx.fillRect(x-25,y-38,50,5)",
  "50*Math.max(0,Math.min(1,bot.hp/MAX_HP))",
 }{
  if !strings.Contains(src,required){t.Fatalf("CPU avatar/HP parity missing: %q",required)}
 }
 for _,legacy:=range []string{
  "cx.fillRect(x-31,y-46,62,8)",
  "cx.fillRect(x-30,y-45,60*",
  "cx.arc(x,y,20,0,Math.PI*2)",
 }{
  if strings.Contains(src,legacy){t.Fatalf("inconsistent first enemy or extra CPU drawing still present: %q",legacy)}
 }
 index,err:=gameFiles.ReadFile("public/index.html")
 if err!=nil{t.Fatal(err)}
 served:=mobilePatchedIndex(string(index))
 for _,required:=range []string{
  "drawMarker(enemy,enemy.loadout?.[0]?.ch||'敵',true)",
  "/cpu-battle-v78.js?v=128",
 }{
  if !strings.Contains(served,required){t.Fatalf("live game missed first enemy visual integration: %q",required)}
 }
}
