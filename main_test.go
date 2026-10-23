package main

import (
	"encoding/json"
	"math"
	"strings"
	"testing"
	"time"
)

func TestGraphemes(t *testing.T) {
	for _, c := range []string{"一", "薔", "超", "A", "7", "♨", "♨️", "👩‍🚀", "🇯🇵", "★", "!"} {
		if !validCharacter(c) {
			t.Errorf("valid letter rejected: %q", c)
		}
	}
	for _, c := range []string{"", "abcd", "!!", "\n", "♨️♨️"} {
		if validCharacter(c) {
			t.Errorf("multiple characters accepted: %q", c)
		}
	}
}
func TestStrokesAndCooldown(t *testing.T) {
	for s, n := range map[string]int{"薔": 16, "超": 12, "♨": 2, "♨️": 5, "A": 3, "★": 2} {
		if got := strokes(s); got != n {
			t.Errorf("strokes(%q): got %d want %d", s, got, n)
		}
	}
	if math.Abs(slotCooldown("homing", 1)-4.92) > .001 {
		t.Fatal("homing cooldown regression")
	}
	if math.Abs(slotCooldown("pierce", 1)-7.45) > .001 {
		t.Fatal("pierce cooldown regression")
	}
}
func TestZoneAndRooms(t *testing.T) {
	room := &Room{Shrink: "none", Phase: "playing", Started: time.Now().Add(-120 * time.Second)}
	if room.zone()["r"] != 1150 {
		t.Fatal("no shrink")
	}
	room.Shrink = "instant"
	if room.zone()["r"] != 180 {
		t.Fatal("instant shrink")
	}
	room.Shrink = "fast"
	if room.zone()["r"] != 180 {
		t.Fatal("fast shrink")
	}
	room.Shrink = "normal"
	room.Started = time.Now()
	if room.zone()["r"] < 1149 {
		t.Fatal("normal shrink starts full")
	}
	obs := newObstacles("shrine")
	if len(obs) == 0 {
		t.Fatal("no obstacles")
	}
}

// Protect players from spawning inside walls for any supported lobby size.
func TestObstacleSpawnSafety(t *testing.T) {
	for _, theme := range []string{"shrine", "sakura", "night"} {
		for trial := 0; trial < 20; trial++ {
			obs := newObstacles(theme)
			if len(obs) < 8 {
				t.Fatalf("too few obstacles (%s): %d", theme, len(obs))
			}
			for count := 2; count <= 10; count++ {
				for i := 0; i < count; i++ {
					angle := 2 * math.Pi * float64(i) / float64(count)
					px := W/2 + 360*math.Cos(angle)
					py := H/2 + 290*math.Sin(angle)
					for _, o := range obs {
						if circleRect(px, py, 22, o) {
							t.Fatalf("spawn intersects obstacle (%s,players=%d)", theme, count)
						}
					}
				}
			}
		}
	}
}

func TestNormalSlotsAllowSingleGrapheme(t *testing.T) {
	slots := []Slot{
		{Ch: "火", Kind: "attack", N: strokes("火")},
		{Ch: "水", Kind: "defense", N: strokes("水")},
		{Ch: "木", Kind: "heal", N: strokes("木")},
		{Ch: "風", Kind: "pierce", N: strokes("風")},
		{Ch: "雷", Kind: "homing", N: strokes("雷")},
	}
	if !validSlots(slots, false) {
		t.Fatal("normal loadout must accept five kanji")
	}
	slots[0] = Slot{Ch: "🔥", Kind: "attack", N: strokes("🔥")}
	slots[1] = Slot{Ch: "A", Kind: "defense", N: strokes("A")}
	slots[2] = Slot{Ch: "👩‍🚀", Kind: "heal", N: strokes("👩‍🚀")}
	if !validSlots(slots, false) {
		t.Fatal("normal match must allow emoji and single Latin glyphs")
	}
	slots[0] = Slot{Ch: "AB", Kind: "attack", N: 3}
	if validSlots(slots, false) || validSlots(slots, true) {
		t.Fatal("multi-glyph text must not be treated as one slot")
	}
}

func TestPublicMatchWaitsForHostStart(t *testing.T) {
	a := &Arena{rooms: map[string]*Room{}}
	slots := []Slot{
		{Ch: "火", Kind: "attack", N: strokes("火")},
		{Ch: "水", Kind: "defense", N: strokes("水")},
		{Ch: "木", Kind: "heal", N: strokes("木")},
		{Ch: "風", Kind: "pierce", N: strokes("風")},
		{Ch: "雷", Kind: "homing", N: strokes("雷")},
	}
	message, err := json.Marshal(map[string]any{
		"type": "match", "name": "挑戦者", "mode": "normal", "theme": "random",
		"shrink": "normal", "ch": "火", "slots": slots,
	})
	if err != nil {
		t.Fatal(err)
	}
	first := &Client{send: make(chan []byte, 32)}
	a.handle(first, message)
	if first.room == nil || !first.room.Public || first.room.Phase != "lobby" {
		t.Fatal("random matchmaking must create a public lobby")
	}
	if len(a.rooms) != 1 {
		t.Fatal("unexpected public lobby count")
	}
	second := &Client{send: make(chan []byte, 32)}
	a.handle(second, message)
	room := first.room
	if second.room != room || len(room.Players) != 2 {
		t.Fatal("second random player must join the existing lobby")
	}
	if room.Phase != "lobby" {
		t.Fatal("match automatically started on second player's arrival")
	}
	// A malformed player must not destroy another player's existing public lobby.
	bad := &Client{send: make(chan []byte, 32)}
	badPayload, _ := json.Marshal(map[string]any{
		"type": "match", "mode": "normal", "ch": "AB", "slots": slots,
	})
	a.handle(bad, badPayload)
	if bad.room != nil || len(a.rooms) != 1 || len(room.Players) != 2 {
		t.Fatal("invalid random match request damaged the waiting lobby")
	}
	a.handle(second, []byte(`{"type":"start"}`))
	if room.Phase != "lobby" {
		t.Fatal("non-host was allowed to start a public match")
	}
	a.handle(first, []byte(`{"type":"start"}`))
	if room.Phase != "playing" {
		t.Fatal("host could not manually start the public match")
	}
	// Mobile taps must survive 50ms keyboard-state updates and use the targeted slot.
	a.handle(first, []byte(`{"type":"cast","selected":4,"aim":1.25}`))
	a.handle(first, []byte(`{"type":"input","selected":0,"aim":0,"fire":false,"keys":[]}`))
	a.tick(1.0 / 30)
	if room.Players[0].Casts != 1 || room.Players[0].LastKind != "homing" {
		t.Fatal("tap cast was lost or cast the wrong equipped slot")
	}
	if math.Abs(room.Players[0].Aim-1.25) > 0.00001 {
		t.Fatal("one-shot cast used the wrong target angle")
	}
}

func TestUnifiedLobbyMobileAndUnicodeAssets(t *testing.T) {
	check := func(path string, expected ...string) {
		t.Helper()
		body, err := gameFiles.ReadFile(path)
		if err != nil { t.Fatalf("missing embedded asset %s: %v", path, err) }
		text := string(body)
		for _, needle := range expected {
			if !strings.Contains(text, needle) {
				t.Errorf("%s is missing integration marker %q", path, needle)
			}
		}
	}
	check("public/index.html",
		"id=\"loginScreen\"", "id=\"lobbyScreen\"", "id=\"onlineScreen\"",
		"id=\"cpuMoveZone\"", "cpuStickUpdate", "cpuView.w",
		"openEmbeddedMultiplayer", "findRandomNow", "joinRoomNow",
		"window.MojiRandom.roll")
	check("public/multiplayer.html",
		"embeddedMode", "onlineReturnToLobby", "connect('match')",
		"window.MojiRandom.roll", "data-sample")
	check("public/glyph_random.js", "categories", "function roll", "1faff")
}
