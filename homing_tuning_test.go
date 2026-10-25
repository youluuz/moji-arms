package main

import (
 "math"
 "strings"
 "testing"
 "time"
)

// Homing tuning must apply to BOTH online modes and both CPU implementations.
// Normal and piercing projectile speeds/cooldowns must stay unchanged.
func TestSlowerHomingProjectileAndWeakerLockOn(t *testing.T) {
 for _,mode:=range []string{"normal","custom"} {
  t.Run(mode,func(t *testing.T){
   attacker:=&Player{ID:"a",Alive:true,HP:600,X:600,Y:420,Keys:map[string]bool{},Fire:true,Selected:4,Aim:0,
    C:&Client{send:make(chan []byte,128)},
    Slots:[]Slot{
     {Ch:"火",Kind:"attack",N:4},{Ch:"水",Kind:"defense",N:4},
     {Ch:"木",Kind:"heal",N:4},{Ch:"金",Kind:"pierce",N:8},{Ch:"土",Kind:"homing",N:3},
    },
   }
   target:=&Player{ID:"b",Alive:true,HP:600,X:600,Y:900,Keys:map[string]bool{},
    C:&Client{send:make(chan []byte,128)}}
   room:=&Room{Code:"TURN",Phase:"playing",Mode:mode,Theme:"night",Shrink:"none",Started:time.Now(),
    Players:[]*Player{attacker,target}}
   arena:=&Arena{rooms:map[string]*Room{"TURN":room}}
   dt:=1.0/30.0
   arena.tick(dt)
   if len(room.Bullets)!=1 || !room.Bullets[0].Homing {
    t.Fatalf("homing shot was not spawned in %s; bullets=%+v",mode,room.Bullets)
   }
   shot:=room.Bullets[0]
   actualSpeed:=math.Hypot(shot.VX,shot.VY)
   if math.Abs(actualSpeed-275)>0.0001 {
    t.Fatalf("%s homing speed = %.3f, want 275",mode,actualSpeed)
   }
   // Fire east while the enemy is directly north. The missile should
   // rotate only 2.2 radians/second, not instantly snap onto the target.
   actualTurn:=math.Atan2(shot.VY,shot.VX)
   if math.Abs(actualTurn-2.2*dt)>0.0001 {
    t.Fatalf("%s homing turn = %.5f; expected %.5f",mode,actualTurn,2.2*dt)
   }
   if slotCooldown("homing",3)<=0 {t.Fatal("homing cooldown was damaged")}
   room.Bullets=nil
   attacker.Selected=0
   attacker.Aim=0
   arena.tick(dt)
   if len(room.Bullets)!=1 || room.Bullets[0].Homing {
    t.Fatalf("%s non-homing attack was affected by homing tuning",mode)
   }
   if actual:=math.Hypot(room.Bullets[0].VX,room.Bullets[0].VY);math.Abs(actual-420)>0.0001 {
    t.Fatalf("%s straight attack speed changed: %.3f",mode,actual)
   }
  })
 }
}

func TestSlowerHomingInBothCpuBattleEngines(t *testing.T) {
 base,err:=gameFiles.ReadFile("public/index.html")
 if err!=nil {t.Fatal(err)}
 served:=mobilePatchedIndex(string(base))
 for _,want:=range []string{
  "const speed=d<95?160:d<175?210:275;",
  "const turnRate=d<130?3.6:d<280?2.85:2.15;",
 } {
  if !strings.Contains(served,want){t.Fatalf("1v1 CPU homing tuning missing from served lobby: %s",want)}
 }
 bots,err:=gameFiles.ReadFile("public/cpu-battle-v78.js")
 if err!=nil {t.Fatal(err)}
 for _,want:=range []string{
  "action.kind==='homing'?220",
  "Math.max(-2.4*dt,Math.min(2.4*dt,diff))",
 } {
  if !strings.Contains(string(bots),want){t.Fatalf("free-for-all CPU homing tuning missing: %s",want)}
 }
}
