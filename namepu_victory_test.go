package main

import (
 "encoding/json"
 "strings"
 "testing"
 "time"
)

// Winning after using Namepu must preserve the authoritative used flag through
// the final server snapshot, so the PvP client's deluxe result is eligible.
func TestNamepuUsedSurvivesVictoryAndResultAssetsLoad(t *testing.T) {
 a:=&Arena{rooms:map[string]*Room{}}
 c:=&Client{send:make(chan []byte,128)}
 p:=&Player{ID:"hero",Name:"Tester",C:c,Alive:true,HP:600,Ultimate:"namepu",UltimateCharge:160,Keys:map[string]bool{},LastInput:time.Now()}
 loser:=&Player{ID:"enemy",Alive:false,HP:0,C:&Client{send:make(chan []byte,128)},Keys:map[string]bool{}}
 room:=&Room{Code:"NAM456",Phase:"playing",Mode:"normal",Theme:"night",Shrink:"none",Started:time.Now(),Players:[]*Player{p,loser},Host:p.ID}
 a.rooms[room.Code]=room;c.room=room;c.pid=p.ID
 cmd,_:=json.Marshal(map[string]string{"type":"ultimate"})
 a.handle(c,cmd)
 if !p.NamepuUsed||!p.UltimateSpent||p.NamepuUntil<=float64(time.Now().UnixNano())/1e9 {t.Fatal("server did not register a real Namepu activation")}
 room.Winner=p.ID;room.Phase="ended"
 state:=room.state()
 players,ok:=state["players"].([]map[string]any)
 if !ok||len(players)!=2 {t.Fatalf("bad result player state: %#v",state["players"])}
 if players[0]["namepuUsed"]!=true||state["winner"]!=p.ID||state["phase"]!="ended" {t.Fatalf("Namepu flag or winner missing from result: %#v",state)}
 css,err:=gameFiles.ReadFile("public/owner-cyber-v114.css")
 if err!=nil {t.Fatal(err)}
 if !strings.Contains(string(css),"#onlineOutcome .ultimate-gold-win") || !strings.Contains(string(css),"#result.ultimate-namepu-victory") {
  t.Fatal("both Namepu victories require the deluxe effect CSS")
 }
 html,err:=gameFiles.ReadFile("public/multiplayer.html")
 if err!=nil {t.Fatal(err)}
 if !strings.Contains(string(html),"owner-cyber-v114.css?v=115") {
  t.Fatal("online game was missing its own Namepu victory stylesheet")
 }
}
