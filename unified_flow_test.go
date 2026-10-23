package main

import (
    "strings"
    "testing"
)

// These checks guard the unified entry-point. The 3MB+ landing page is easy
// to regress when updating the smaller online-only client.
func TestUnifiedLandingModesAndMobileControls(t *testing.T) {
    b, err := gameFiles.ReadFile("public/index.html")
    if err != nil { t.Fatal(err) }
    html := string(b)
    required := []string{
        `id="loginScreen"`, `id="enterLobby"`, `id="lobbyScreen"`,
        `data-mode-tile="normal"`, `data-mode-tile="custom"`,
        `data-mode-tile="multi"`, `data-mode-tile="multiCustom"`,
        `id="onlineScreen"`, `id="onlineFrame"`,
        `id="cpuMoveZone"`, `id="cpuTapHint"`,
        `const cpuView=`, `function fitArena()`,
        `window.MojiRandom.roll`, `id="shuffleLoadout"`,
        `openEmbeddedMultiplayer(`, `closeEmbeddedMultiplayer(`,
    }
    for _, marker := range required {
        if !strings.Contains(html, marker) {
            t.Errorf("unified index missing required marker %s", marker)
        }
    }
    if strings.Contains(html, "location.href='multiplayer.html?auto=create'") ||
       strings.Contains(html, "window.location.href='multiplayer.html?auto=create'") {
        t.Error("legacy navigation would leave the common lobby")
    }
}

func TestUnifiedOnlineReturnAndWideRandom(t *testing.T) {
    htmlRaw, err := gameFiles.ReadFile("public/multiplayer.html")
    if err != nil { t.Fatal(err) }
    html := string(htmlRaw)
    for _, marker := range []string{
        `embedded-online`, `moji:returnLobby`,
        `id="randomAll"`, `window.MojiRandom`,
        `connect('match')`, `id="moveZone"`,
        `type:'cast'`,
    } {
        if !strings.Contains(html, marker) {
            t.Errorf("online client missing %q", marker)
        }
    }
    randomRaw, err := gameFiles.ReadFile("public/glyph_random.js")
    if err != nil { t.Fatal(err) }
    glyph := string(randomRaw)
    for _, category := range []string{"han", "kana", "letters", "numbers", "symbols", "emoji"} {
        if !strings.Contains(glyph, category+":") {
            t.Errorf("randomized Unicode category missing %q", category)
        }
    }
    if !strings.Contains(glyph, "window.MojiRandom") {
        t.Error("shared randomizer not exported")
    }
}
