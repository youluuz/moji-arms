package main

import (
  "strings"
  "testing"
)

func TestSharedLobbyEmojiShuffleAsset(t *testing.T) {
  asset,err:=gameFiles.ReadFile("public/emoji-shuffle-v107.js")
  if err!=nil {t.Fatal("emoji shuffle JavaScript missing:",err)}
  for _,required:=range []string{"shuffleEmojiLoadout","shuffleLoadout","mojiBulkRandomBar","modeSelect","dispatchEvent","ultimate",""} {
    if required!=""&&!strings.Contains(string(asset),required) {t.Fatalf("emoji shuffle script missing %q",required)}
  }
  base,err:=gameFiles.ReadFile("public/index.html")
  if err!=nil {t.Fatal(err)}
  patched:=mobilePatchedIndex(string(base))
  for _,url:=range []string{"/emoji-shuffle-v107.js?v=107","/emoji-shuffle-v107.css?v=107"} {
    if !strings.Contains(patched,url) {t.Fatalf("common lobby does not include %s",url)}
  }
}
