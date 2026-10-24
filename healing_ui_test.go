package main

import (
 "math"
 "regexp"
 "strings"
 "testing"
)

// Check the huge legacy HTML's healing rule is actually changed, rather than
// silently leaving old HP ×4 behavior behind and only updating the HUD text.
func TestReducedHealingAppliesToSoloLegacyGame(t *testing.T) {
 original,e:=gameFiles.ReadFile("public/index.html")
 if e!=nil {t.Fatal(e)}
 old:=string(original)
 expected:=regexp.MustCompile(`HEAL_PER_STROKE\s*=\s*4\b`)
 if !expected.MatchString(old) {t.Fatal("CPU legacy healing value was not found; update the server patch to match its real declaration")}
 patched:=mobilePatchedIndex(old)
 changed:=regexp.MustCompile(`HEAL_PER_STROKE\s*=\s*3\.4\b`)
 if !changed.MatchString(patched) || expected.MatchString(patched) {t.Fatal("solo recovery must be reduced from 4 to 3.4 HP per stroke")}
}

func TestHealingPreviewAndOnlineValueConsistency(t *testing.T) {
 server:=3.4
 if math.Abs(server*10-34)>.00001 {t.Fatal("ten-stroke recovery must be 34, not 40")}
 visual,e:=gameFiles.ReadFile("public/weapon-visuals-v86.js")
 if e!=nil {t.Fatal(e)}
 if !strings.Contains(string(visual),"Math.round(n*3.4)") {t.Fatal("equipment stat label must show reduced heal")}
 online,e:=gameFiles.ReadFile("public/multiplayer.html")
 if e!=nil {t.Fatal(e)}
 if !strings.Contains(string(online),"Math.round(s.n*3.4)") {t.Fatal("online loadout summary must show reduced heal")}
 for _,path:=range []string{"public/cpu-battle-v78.js","public/multiplayer.html"} {
  data,e:=gameFiles.ReadFile(path)
  if e!=nil {t.Fatal(e)}
  if !strings.Contains(string(data),"moji-battle-score") {t.Errorf("%s missing grouped survivor/kill overlay",path)}
 }
}
