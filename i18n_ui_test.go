package main

import (
 "os"
 "strings"
 "testing"
)

// English is opt-in. The original gameplay script and Japanese text stay intact.
func TestEnglishLanguageSwitchIsAvailableOnAllEntryPoints(t *testing.T) {
 raw, err := gameFiles.ReadFile("public/index.html")
 if err != nil { t.Fatal(err) }
 html := mobilePatchedIndex(string(raw))
 if !strings.Contains(html, `/i18n-ui-v1.js?v=1`) {
  t.Fatal("playable lobby is missing bilingual UI support")
 }
 for _, path := range []string{"public/multiplayer.html", "public/about.html", "docs/index.html"} {
  page, err := os.ReadFile(path)
  if err != nil { t.Fatal(err) }
  if !strings.Contains(string(page), "i18n-ui-v1.js?v=1") {
   t.Errorf("%s does not load the language switcher", path)
  }
 }
 for _, path := range []string{"public/i18n-ui-v1.js", "docs/i18n-ui-v1.js"} {
  script, err := os.ReadFile(path)
  if err != nil { t.Fatal(err) }
  for _, required := range []string{
   "moji_ui_language_v1",
   "window.MojiI18n",
   "Japanese",
   "English",
   "MutationObserver",
   "Set", // Dynamic UI text refresh must remain incremental.
  } {
   if !strings.Contains(string(script), required) {
    t.Errorf("%s missing bilingual UI element: %s", path, required)
   }
  }
 }
}
