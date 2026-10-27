package main
import ("encoding/json";"strings";"testing";"time")
func TestCustomMatchRuleStartAndDefaultIsolation(t *testing.T) {
 room:=&Room{Code:"TEST01",Mode:"custom",MaxHP:1000,UltimateStartPercent:75,Theme:"night",Shrink:"none",Phase:"lobby",Started:time.Now()}
 makeP:=func(id,ultimate string)*Player{return &Player{ID:id,Name:id,Ch:"火",Alive:true,Ready:true,HP:600,Ultimate:ultimate,C:&Client{send:make(chan []byte,128)},Keys:map[string]bool{},Slots:[]Slot{{Ch:"火",Kind:"attack",N:4},{Ch:"水",Kind:"defense",N:4},{Ch:"木",Kind:"heal",N:4},{Ch:"金",Kind:"pierce",N:8},{Ch:"土",Kind:"homing",N:3}}}}
 a,b:=makeP("a","roman"),makeP("b","namepu")
 room.Players=[]*Player{a,b};room.Host=a.ID;a.C.room=room;a.C.pid=a.ID
 ar:=&Arena{rooms:map[string]*Room{room.Code:room}}
 wire,_:=json.Marshal(map[string]string{"type":"start"});ar.handle(a.C,wire)
 if room.Phase!="countdown"||a.HP!=1000||b.HP!=1000{t.Fatalf("custom start HP missing: %.0f,%.0f phase %s",a.HP,b.HP,room.Phase)}
 if a.UltimateCharge!=240||b.UltimateCharge!=120{t.Fatalf("initial charge not scaled to skill costs: %.0f %.0f",a.UltimateCharge,b.UltimateCharge)}
 state:=room.state()
 if state["maxHp"]!=float64(1000)||state["ultimateStartPercent"]!=75{t.Fatalf("missing state values: %#v",state)}
 room.Mode="normal";if room.maxHP()!=600||room.startChargePercent()!=0{t.Fatal("normal rules were overridden")}
 room.Mode="custom";room.MaxHP=0;if room.maxHP()!=600{t.Fatal("legacy custom room HP fallback changed")}
}
func TestCustomRuleRangeValidationAndUI(t *testing.T) {
 for _,bad:=range []map[string]any{{"maxHp":0,"ultimateStartPercent":50},{"maxHp":1001,"ultimateStartPercent":50},{"maxHp":600,"ultimateStartPercent":-1},{"maxHp":600,"ultimateStartPercent":101},{"maxHp":"invalid","ultimateStartPercent":10}}{
  a:=&Arena{rooms:map[string]*Room{}};c:=&Client{send:make(chan []byte,128)}
  m:=map[string]any{"type":"create","mode":"custom","name":"T","theme":"night"}
  for k,v:=range bad{m[k]=v};raw,_:=json.Marshal(m);a.handle(c,raw)
  if len(a.rooms)>0{t.Fatalf("accepted invalid custom rules: %#v",bad)}
 }
 raw,err:=gameFiles.ReadFile("public/index.html");if err!=nil{t.Fatal(err)}
 html:=mobilePatchedIndex(string(raw))
 for _,s:=range []string{"custom-match-v120.js?v=120","custom-match-v120.css?v=120","let MAX_HP=600","cpuHpMax","cpuEnemyHpMax","window.MojiCustomRules?.hpForMode(matchMode)"} {if !strings.Contains(html,s){t.Errorf("solo custom wiring missing: %s",s)}}
 for _,s:=range []string{"maxHp:window.MojiCustomRules?.hpForMode(matchMode)","maxHp:window.MojiCustomRules?.hpForMode(currentMode)","ultimateStartPercent:window.MojiCustomRules?.chargeForMode(currentMode)"} {if !strings.Contains(html,s){t.Errorf("custom rules not carried from parent to iframe: %s",s)}}
 ult,_:=gameFiles.ReadFile("public/ultimate-cpu.js")
 if !strings.Contains(string(ult),"window.MojiCustomRules?.chargeForMode"){t.Fatal("solo ultimate charge missing")}
 online,_:=gameFiles.ReadFile("public/multiplayer.html")
 for _,s:=range []string{"ultimateStartPercent:setup.mode==='custom'","maxHp:ONLINE_HP","id=\"selfHpMax\"","id=\"roomCustomRules\"","hpSubject.hp/ONLINE_HP"}{if !strings.Contains(string(online),s){t.Errorf("online custom rule wiring missing: %s",s)}}
}
