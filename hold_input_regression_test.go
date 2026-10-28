package main

import (
 "strings"
 "testing"
)

// A prior regression served the unpatched 3 MB legacy lobby even though
// the newer CPU renderer and controls existed as independent JS assets.
func TestTouchHoldAndAvatarPatchRegression(t *testing.T) {
 legacy, err := gameFiles.ReadFile("public/index.html")
 if err != nil { t.Fatal(err) }
 html := mobilePatchedIndex(string(legacy))
 required := []string{
  "/* player and all CPUs rendered exactly once by cpu-battle-v78.js */",
  "if(e.pointerType==='touch'||e.pointerType==='pen'){",
  "down=true;",
  "c.setPointerCapture(e.pointerId)",
  "c.addEventListener('pointermove',e=>{",
  "/mobile-input-v70.js?v=142",
  "/cpu-battle-v78.js?v=141",
  "let WORLD_W=2300,WORLD_H=1300",
  "MAX_HP=window.MojiCustomRules?.hpForMode(matchMode)||600",
 }
 for _, s := range required {
  if !strings.Contains(html,s) {t.Errorf("served legacy lobby lost required patch %q",s)}
 }
 if strings.Contains(html,"drawMarker(player,avatarChar,false);drawMarker(enemy,'敵',true);") {
  t.Fatal("duplicate legacy icons must not be drawn")
 }
}

func TestOnlineTouchHoldReleasesOnAllExitPaths(t *testing.T) {
 online, err := gameFiles.ReadFile("public/multiplayer.html")
 if err != nil {t.Fatal(err)}
 text := string(online)
 for _, snippet := range []string{
  "fieldHoldPointer=e.pointerId",
  "down=true; // Existing 50ms input sender",
  "cv.setPointerCapture(e.pointerId)",
  "e.pointerId===fieldHoldPointer",
  "'pointerup','pointercancel','lostpointercapture'",
  "window.addEventListener('blur',()=>cancelFire());",
 } {
  if !strings.Contains(text,snippet) {t.Errorf("online hold/release guard missing: %q",snippet)}
 }
}

func TestInputSafetyDoesNotCancelAnotherPointerOrStealUltimateAim(t *testing.T) {
 contents, err := gameFiles.ReadFile("public/mobile-input-v70.js")
 if err != nil {t.Fatal(err)}
 s := string(contents)
 for _, required := range []string{
  "const firingPointers = new Map()",
  "if(type==='mouse')firingPointers.delete(id)",
  "new MutationObserver(() => {if(!playing())releaseAll();})",
  "window.addEventListener('keyup', e =>",
  "function releaseMovement(preserveKeyboard=false)",
  "keyLastSeen.set(key,performance.now())",
 } {
  if !strings.Contains(s,required) {t.Errorf("shared input release missing: %q",required)}
 }
 if strings.Contains(s,"if(canvas.id==='field'&&typeof down!=='undefined')down=true;") {
  t.Fatal("early capture latch could fire normal shots during CPU ultimate aiming")
 }
}
