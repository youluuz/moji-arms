package main

import (
 "strings"
 "testing"
)

// The server must embed both the style and its structural DOM patch; the
// original several-megabyte lobby must remain the source of game controls.
func TestModeSelectionIsolatedFromMatchSettings(t *testing.T) {
 original,err:=gameFiles.ReadFile("public/index.html")
 if err!=nil{t.Fatal(err)}
 rendered:=mobilePatchedIndex(string(original))
 for _,asset:=range []string{"/mode-separation-v109.css?v=109","/mode-separation-v109.js?v=109"}{
  if !strings.Contains(rendered,asset){t.Fatalf("mode selection asset not loaded: %s",asset)}
 }
 script,err:=gameFiles.ReadFile("public/mode-separation-v109.js")
 if err!=nil{t.Fatal(err)}
 for _,word:=range []string{"mojiModeChoiceCard","mojiMatchDetailsCard","mojiSelectedModeInfo","mode-quickrow","mobileOrientationSetting","aria-live"} {
  if !strings.Contains(string(script),word){t.Fatalf("separate mode selector loses %s",word)}
 }
 if !strings.Contains(rendered,"id=\"modeTiles\"") {
  // Existing selection markup may use single quotes; the browser test verifies all four buttons.
  if !strings.Contains(rendered,"modeTiles") {t.Fatal("the original mode selector is gone")}
 }
}
