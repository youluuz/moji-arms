package main

import (
 "encoding/json"
 "testing"
)

func testSpectatorClient() *Client {
 return &Client{send:make(chan []byte,32)}
}
func TestLiveRoomSpectatorHasNoCombatAuthority(t *testing.T){
 a:=&Arena{rooms:map[string]*Room{}}
 c1,c2:=testSpectatorClient(),testSpectatorClient()
 code:="ABC123"
 room:=&Room{Code:code,Mode:"normal",Phase:"playing",StartedPlayers:2,
  Players:[]*Player{
   {ID:"owner",Name:"ホスト",C:c1,HP:600,Alive:true,X:250,Y:200,Keys:map[string]bool{},Ready:true},
   {ID:"opponent",Name:"相手",C:c2,HP:450,Alive:true,X:410,Y:200,Keys:map[string]bool{},Ready:true},
  },
 }
 a.rooms[code]=room
 c1.room=room;c1.pid="owner";c2.room=room;c2.pid="opponent"
 viewer:=testSpectatorClient()
 a.handle(viewer,[]byte(`{"type":"join","code":"ABC123","name":"途中参加"}`))
 if viewer.room!=room||len(room.Spectators)!=1||len(room.Players)!=2 {t.Fatal("live spectator was not admitted separately from combatants")}
 if room.combatants()!=2||room.state()["spectators"]!=1 {t.Fatal("spectator changed arena size or spectator count")}
 if len(viewer.send)==0 {t.Fatal("spectator received no initial state")}
 var joined map[string]any
 if e:=json.Unmarshal(<-viewer.send,&joined);e!=nil||joined["type"]!="joined"||joined["spectator"]!=true {t.Fatalf("no spectator acknowledgment: %v %+v",e,joined)}
 a.handle(viewer,[]byte(`{"type":"input","keys":["w"],"aim":0,"fire":true,"selected":1}`))
 a.handle(viewer,[]byte(`{"type":"start"}`))
 a.handle(viewer,[]byte(`{"type":"return-lobby"}`))
 if room.Phase!="playing"||len(room.Players)!=2||room.Players[0].HP!=600 {t.Fatal("read-only spectator modified live game")}
 a.disconnected(viewer)
 if room.Phase!="playing"||len(room.Players)!=2||len(room.Spectators)!=0 {t.Fatal("spectator exit modified match")}
}

func TestEliminatedFighterCanSpectate(t *testing.T){
 a:=&Arena{rooms:map[string]*Room{}}
 dead,alive:=testSpectatorClient(),testSpectatorClient()
 room:=&Room{Code:"DEF456",Mode:"normal",Phase:"playing",StartedPlayers:2,
 Players:[]*Player{
  {ID:"lost",Name:"敗退者",C:dead,HP:0,Alive:false,Keys:map[string]bool{},Fire:true},
  {ID:"still",Name:"生存者",C:alive,HP:600,Alive:true,Keys:map[string]bool{}},
 }}
 dead.pid="lost";dead.room=room;alive.pid="still";alive.room=room
 a.rooms[room.Code]=room
 a.handle(dead,[]byte(`{"type":"spectate"}`))
 if !room.Players[0].Spectating||room.Players[0].Fire||room.state()["spectators"]!=1 {t.Fatal("dead fighter did not switch to spectator")}
 a.handle(dead,[]byte(`{"type":"input","keys":["w"],"fire":true}`))
 if room.Players[0].Fire {t.Fatal("dead spectator can attack")}
}
