package main

import (
 "math"
 "strings"
 "testing"
 "time"
)
func TestNormalDamageTapersWithoutDevaluingMoreStrokes(t *testing.T){
 prev:=0.0
 for n:=1;n<=84;n++{
  value:=normalShotDamage(n)
  if value<=prev {t.Fatalf("%d strokes produced non-increasing damage %.0f after %.0f",n,value,prev)}
  if n>=8 && value/float64(n)>=9 {t.Fatalf("%d strokes failed to reduce per-stroke damage",n)}
  prev=value
 }
 if normalShotDamage(1)!=9 {t.Fatal("single stroke must remain nine damage")}
 if normalShotDamage(84)>=84*9 || normalShotDamage(84)<84*7 {t.Fatal("high strokes too strong or made useless")}
 for _,mode:=range []string{"normal","custom"}{
  p:=&Player{ID:"a",Alive:true,HP:600,X:300,Y:350,Keys:map[string]bool{},Fire:true,Selected:0,Aim:0,LastInput:time.Now(),C:&Client{send:make(chan []byte,128)},
   Slots:[]Slot{{Ch:"𰻞",Kind:"attack",N:58},{Ch:"水",Kind:"defense",N:4},{Ch:"木",Kind:"heal",N:4},{Ch:"金",Kind:"pierce",N:8},{Ch:"土",Kind:"homing",N:3}}}
  enemy:=&Player{ID:"b",Alive:true,HP:600,X:700,Y:350,Keys:map[string]bool{},C:&Client{send:make(chan []byte,128)}}
  room:=&Room{Code:"SOFT",Phase:"playing",Mode:mode,Theme:"night",Shrink:"none",Started:time.Now(),Players:[]*Player{p,enemy}}
  (&Arena{rooms:map[string]*Room{"SOFT":room}}).tick(1.0/30)
  if len(room.Bullets)!=1||math.Abs(room.Bullets[0].Damage-normalShotDamage(58))>.01 {t.Fatalf("%s online damage mismatch",mode)}
 }
}
func TestGlyphBookAndSecretFXAreAvailableInRealGame(t *testing.T){
 b,e:=gameFiles.ReadFile("public/index.html");if e!=nil {t.Fatal(e)}
 html:=mobilePatchedIndex(string(b))
 for _,part:=range []string{
  "glyph-book-v114.js?v=114","glyph-book-v114.css?v=114",
  "owner-cyber-v114.js?v=114","owner-cyber-v114.css?v=114",
  "window.MojiGlyphBook?.record(s.ch,s.kind,s.n)",
  "window.MojiDeveloperFX.paint(g,t)",
  "Math.round(n*(9-.02*(n-1)))",
 }{if !strings.Contains(html,part){t.Errorf("CPU live page missing glyph collection, damage or cyber cosmetic: %s",part)}}
 for _,path:=range []string{"public/glyph-book-v114.js","public/owner-cyber-v114.js"}{
  f,e:=gameFiles.ReadFile(path);if e!=nil{t.Fatal(e)}
  if !strings.Contains(string(f),"localStorage") {t.Errorf("missing persistent storage in %s",path)}
 }
}
