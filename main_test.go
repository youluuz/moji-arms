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
	for s, n := range map[string]int{"薔": 16, "超": 12, "♨": 2, "♨️": 5, "A": 3, "★": 2, "⚡": 5, "⭐": 5, "🇯🇵": 5, "🔥": 5, "❤️": 5} {
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
	// Standard PvP uses the same automatic stroke conversion as the CPU browser.
	slots[0] = Slot{Ch: "⚡", Kind: "attack", N: 5}
	if !validSlots(slots, false) { t.Fatal("single-codepoint emoji needs 5 strokes") }
	slots[0].N = 2
	if validSlots(slots, false) { t.Fatal("server accepted mismatched emoji stroke value") }
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
	// Press just before cooldown expires: preserve the aim and fire once.
	p := room.Players[0]
	p.Last[0] = float64(time.Now().UnixNano())/1e9 + .12
	a.handle(first, []byte(`{"type":"cast","selected":0,"aim":0.75}`))
	a.tick(1.0 / 30)
	if !p.CastPending || p.Casts != 1 {
		t.Fatal("near-ready tap disappeared during cooldown")
	}
	p.Last[0] = float64(time.Now().UnixNano())/1e9 - .01
	a.tick(1.0 / 30)
	if p.CastPending || p.Casts != 2 || p.LastKind != "attack" || math.Abs(p.Aim-.75) > .00001 {
		t.Fatal("buffered tap should cast exactly once with the original aim")
	}
	// A stale tap must be discarded instead of attacking seconds later.
	p.Last[0] = float64(time.Now().UnixNano())/1e9 + 2
	a.handle(first, []byte(`{"type":"cast","selected":0,"aim":0.3}`))
	p.PendingUntil = float64(time.Now().UnixNano())/1e9 - .01
	a.tick(1.0 / 30)
	if p.CastPending || p.Casts != 2 {
		t.Fatal("expired cast was not cleared")
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

func TestMobileV70InputIsolationAssets(t *testing.T) {
	cpu, err := gameFiles.ReadFile("public/mobile-input-v70.css")
	if err != nil { t.Fatal("CPU thumbstick CSS missing:", err) }
	cpuText := string(cpu)
	if !strings.Contains(cpuText, "clip-path:circle") ||
		!strings.Contains(cpuText, "width:144px") ||
		!strings.Contains(cpuText, "touch-action:none") {
		t.Fatal("CPU joystick must only intercept the small circular movement area")
	}
	selection, err := gameFiles.ReadFile("public/mobile-input-v70.js")
	if err != nil { t.Fatal("CPU slot-select JS missing:", err) }
	if !strings.Contains(string(selection), "pointerdown") || !strings.Contains(string(selection), "slot.click()") {
		t.Fatal("CPU selection must work on touch-down independently of movement")
	}
	online, err := gameFiles.ReadFile("public/multiplayer.html")
	if err != nil { t.Fatal(err) }
	html := string(online)
	if strings.Contains(html, "left:0;top:0;bottom:0;width:35%") {
		t.Fatal("the old PvP movement overlay still covers left-side aiming")
	}
	for _, text := range []string{"clip-path:circle", "chooseOnlineSlot", "addEventListener('pointerdown'", "setAimFromPointer"} {
		if !strings.Contains(html, text) { t.Fatalf("online touch control missing %s", text) }
	}
	base, err := gameFiles.ReadFile("public/index.html")
	if err != nil { t.Fatal(err) }
	served := mobilePatchedIndex(string(base))
	if !strings.Contains(served, "/mobile-input-v70.css") || !strings.Contains(served, "/mobile-input-v70.js") {
		t.Fatal("common login/CPU route does not load the mobile touch fixes")
	}
}

func TestSixUltimatesChargeAndServerRules(t *testing.T) {
 specs:=map[string]int{"roman":360,"slow":320,"invincible":340,"dance":340,"invisible":300,"namepu":220}
 for id,want:=range specs {if got:=ultimateCost(id);got!=want {t.Fatalf("ultimate %s: got %d want %d",id,got,want)}}
 if ultimateCost("unknown")!=0 || chooseUltimate("unknown")!="roman" {t.Fatal("invalid ultimate must default safely")}
 c1:=&Client{send:make(chan []byte,64),pid:"a"}
 c2:=&Client{send:make(chan []byte,64),pid:"b"}
 p:=&Player{ID:"a",C:c1,Alive:true,HP:600,X:900,Y:500,Ultimate:"roman",UltimateCharge:360,Keys:map[string]bool{}}
 q:=&Player{ID:"b",C:c2,Alive:true,HP:600,X:980,Y:500,Ultimate:"invincible",UltimateCharge:340,Keys:map[string]bool{}}
 room:=&Room{Code:"ULT",Phase:"playing",Mode:"normal",Theme:"shrine",Shrink:"normal",Started:time.Now(),Players:[]*Player{p,q}}
 c1.room=room;c2.room=room
 a:=&Arena{rooms:map[string]*Room{"ULT":room}}
 a.handle(c1,[]byte(`{"type":"ultimate"}`))
 if !p.UltimateAiming || !p.UltimateSpent || p.UltimateSerial!=1 {t.Fatal("roman must enter one-use aimed state")}
 a.handle(c1,[]byte(`{"type":"ultimate"}`))
 if p.UltimateSerial!=1 {t.Fatal("second ultimate illegally activated")}
 a.handle(c1,[]byte(`{"type":"ultimate-aim","aim":0}`))
 if p.UltimateAiming || p.UltimateWindupUntil<=0 {t.Fatal("roman target should start 0.5s windup")}
 p.UltimateWindupUntil=float64(time.Now().UnixNano())/1e9-.01
 a.tick(.01)
 if len(room.Bullets)!=1 || room.Bullets[0].Special!="roman" || room.Bullets[0].Damage!=250 {t.Fatal("roman cannon not emitted at expected power")}
 a.handle(c2,[]byte(`{"type":"ultimate"}`))
 if q.InvincibleUntil<=float64(time.Now().UnixNano())/1e9 {t.Fatal("invulnerability not activated")}
 hp:=q.HP;hit(q,999,true,float64(time.Now().UnixNano())/1e9)
 if q.HP!=hp {t.Fatal("invincible should also block penetrating and area damage")}
 // Normal attacks only accrue successful strokes; tests should never allow a second ultimate.
 p.Ultimate="namepu";p.UltimateSpent=false;p.UltimateCharge=220
 a.handle(c1,[]byte(`{"type":"ultimate"}`))
 if p.NamepuUntil<=float64(time.Now().UnixNano())/1e9 || !p.NamepuUsed {t.Fatal("namepu 5-second self-dance was not enabled")}
 hp=p.HP;hit(p,10,true,float64(time.Now().UnixNano())/1e9)
 if p.HP!=hp-10 {t.Fatal("namepu must not grant damage resistance")}
 p.Ultimate="slow";p.UltimateSpent=false;p.UltimateCharge=320;p.NamepuUntil=0
 a.handle(c1,[]byte(`{"type":"ultimate"}`))
 a.handle(c1,[]byte(`{"type":"ultimate-aim","aim":0}`))
 if len(room.Bullets)==0 || room.Bullets[len(room.Bullets)-1].Special!="slow" {t.Fatal("slow ultimate should fire targeted projectile")}
}
func TestUltimateAssetsSharedAcrossModes(t *testing.T){
 read:=func(path string)string{t.Helper();v,e:=gameFiles.ReadFile(path);if e!=nil{t.Fatal(e)};return string(v)}
 core:=read("public/ultimate-core.js")
 for _,id:=range []string{"roman","slow","invincible","dance","invisible","namepu"} {
  if !strings.Contains(core,"id:'"+id+"'") {t.Fatalf("shared artwork/spec missing %s",id)}
 }
 cpu:=read("public/ultimate-cpu.js")
 online:=read("public/ultimate-multi.js")
 for _,v:=range []string{"MojiUlt","ultimate","namepu"} {
  if !strings.Contains(cpu,v)||!strings.Contains(online,v) {t.Fatalf("CPU/online ultimate parity missing %s",v)}
 }
 index,err:=gameFiles.ReadFile("public/index.html");if err!=nil{t.Fatal(err)}
 patched:=mobilePatchedIndex(string(index))
 for _,asset:=range []string{"ultimate-core.js","ultimate-cpu.js","ultimate-ui.css"} {
  if !strings.Contains(patched,asset) {t.Fatalf("common lobby forgot %s",asset)}
 }
 for _,asset:=range []string{"ultimate-core.js","ultimate-multi.js","ultimate-ui.css"} {
  if !strings.Contains(read("public/multiplayer.html"),asset) {t.Fatalf("online mode forgot %s",asset)}
 }
}
