package main

import (
 "testing"
 "time"
)

// Movement should stop if a browser pauses or loses key-up/pointer-up while
// the WebSocket is still alive. A live packet must not be discarded.
func TestMovementPacketsExpireWithoutUpdates(t *testing.T) {
 now := time.Now()
 p := &Player{Keys: map[string]bool{"d":true}, Fire:true, LastInput:now.Add(-time.Second)}
 expireStaleInput(p,now)
 if p.Keys["d"] || p.Fire {t.Fatal("stale direction/fire persisted after 1s without an input packet")}
 p.Keys=map[string]bool{"a":true}
 p.Fire=true
 p.LastInput=now.Add(-200*time.Millisecond)
 expireStaleInput(p,now)
 if !p.Keys["a"] || !p.Fire {t.Fatal("active 50ms inputs must not be disabled")}
 p.LastInput=time.Time{}
 expireStaleInput(p,now)
 if p.Keys["a"] || p.Fire {t.Fatal("new game must begin with neutral controls")}
}

func TestTickHaltsCharacterAfterInputLoss(t *testing.T) {
 now:=time.Now()
 first:=&Player{
  ID:"first",X:400,Y:400,HP:600,Alive:true,Fire:true,
  Keys:map[string]bool{"d":true},LastInput:now.Add(-time.Second),
  C:&Client{send:make(chan []byte,16)},
 }
 second:=&Player{
  ID:"second",X:500,Y:500,HP:600,Alive:true,Keys:map[string]bool{},
  C:&Client{send:make(chan []byte,16)},
 }
 room:=&Room{Code:"SAFE01",Phase:"playing",Shrink:"none",
  Started:now,StartedPlayers:2,Players:[]*Player{first,second}}
 a:=&Arena{rooms:map[string]*Room{"SAFE01":room}}
 a.tick(.033)
 if first.X!=400 || first.Y!=400 || first.Fire {t.Fatalf("stale input still moved player to (%f,%f)",first.X,first.Y)}
 first.Keys=map[string]bool{"d":true}
 first.LastInput=time.Now()
 a.tick(.033)
 if first.X<=400 {t.Fatal("fresh input must still move player normally")}
}
