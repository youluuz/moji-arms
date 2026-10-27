package main

import (
 "encoding/json"
 "math"
 "strings"
 "testing"
 "time"
)

func TestPrivateRoomReturnAfterLastPlayerLeaves(t *testing.T) {
 a:=&Arena{rooms:map[string]*Room{}}
 slots:=[]Slot{
  {Ch:"火",Kind:"attack",N:strokes("火")},
  {Ch:"水",Kind:"defense",N:strokes("水")},
  {Ch:"木",Kind:"heal",N:strokes("木")},
  {Ch:"金",Kind:"pierce",N:strokes("金")},
  {Ch:"土",Kind:"homing",N:strokes("土")},
 }
 first:=&Client{send:make(chan []byte,128)}
 create,_:=json.Marshal(map[string]any{"type":"create","name":"host","ch":"火","slots":slots})
 a.handle(first,create)
 if first.room==nil {t.Fatal("could not make private room")}
 code:=first.room.Code
 a.disconnected(first)
 room:=a.rooms[code]
 if room==nil||room.Phase!="lobby"||room.Host!="" {
  t.Fatalf("last player leaving must reserve a private waiting room: %#v",room)
 }
 second:=&Client{send:make(chan []byte,128)}
 join,_:=json.Marshal(map[string]any{"type":"join","name":"returning host","code":code,"ch":"火","slots":slots})
 a.handle(second,join)
 if second.room!=room||second.pid==""||room.Host!=second.pid||len(room.Players)!=1||
  !room.EmptySince.IsZero(){
  t.Fatal("fresh connection failed to re-enter saved private room code")
 }
 a.disconnected(second)
 room.EmptySince=time.Now().Add(-11*time.Minute)
 third:=&Client{send:make(chan []byte,128)}
 a.handle(third,join)
 if third.room!=nil||a.rooms[code]!=nil {t.Fatal("expired empty private room must not be rejoined")}
}


func TestAttackAndHomingBalancedDamageAndCooldown(t *testing.T){
 base:=(4.5+1*.42)*1.4
 got:=slotCooldown("homing",1)
 if math.Abs(got-base*.9)>1e-9||got<base*.85||got>base*.95 {
  t.Fatalf("homing cooldown reduction should be modest: %.3f vs %.3f",got,base)
 }
 if slotCooldown("attack",1)!=.8 {t.Fatal("1-stroke attack cooldown unexpectedly changed")}
 html,err:=gameFiles.ReadFile("public/index.html");if err!=nil{t.Fatal(err)}
 rendered:=mobilePatchedIndex(string(html))
 for _,part:=range []string{
  "damage(target,b.n*(b.homing?3:b.pierce?6:b.owner==='p'?9:9),now,b.pierce)",
  "homing:1.4*(4.5+n*.42)*0.9",
  "attack:[`⚔ ${n*9} ダメージ`",
  "homing:[`◎ ${n*3} ダメージ`",
 } {
  if !strings.Contains(rendered,part) {t.Errorf("CPU balance missing: %s",part)}
 }
}
