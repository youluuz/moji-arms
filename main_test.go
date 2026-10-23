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
	for s, n := range map[string]int{"𰻞": 58, "𰻝": 43, "龘": 48, "薔": 16, "超": 12, "♨": 2, "♨️": 5, "A": 3, "★": 2, "⚡": 5, "⭐": 5, "🇯🇵": 5, "🔥": 5, "❤️": 5} {
		if got := strokes(s); got != n {
			t.Errorf("strokes(%q): got %d want %d", s, got, n)
		}
	}
	if math.Abs(slotCooldown("homing", 1)-6.888) > .001 {
		t.Fatal("homing cooldown regression")
	}
	if math.Abs(slotCooldown("pierce", 1)-10.43) > .001 {
		t.Fatal("pierce cooldown regression")
	}
}
func TestZoneAndRooms(t *testing.T) {
	room := &Room{Shrink: "none", Phase: "playing", Started: time.Now().Add(-120 * time.Second)}
	if room.zone()["r"] != 1350 {
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
	if room.zone()["r"] < 1349 {
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
	check("public/arena-expansion-v72.js", "__arenaShape", "__arenaLArm", "canPlace")
}

func TestMobileV70InputIsolationAssets(t *testing.T) {
	cpu, err := gameFiles.ReadFile("public/mobile-input-v70.css")
	if err != nil { t.Fatal("CPU thumbstick CSS missing:", err) }
	cpuText := string(cpu)
	if !strings.Contains(cpuText, "mobile-touch-input") || !strings.Contains(cpuText, "clip-path:circle") ||
		!strings.Contains(cpuText, "width:144px") ||
		!strings.Contains(cpuText, "touch-action:none") {
		t.Fatal("CPU joystick must only intercept the small circular movement area")
	}
	selection, err := gameFiles.ReadFile("public/mobile-input-v70.js")
	if err != nil { t.Fatal("CPU slot-select JS missing:", err) }
	if !strings.Contains(string(selection), "mobile-touch-input") || !strings.Contains(string(selection), "pointerdown") || !strings.Contains(string(selection), "slot.click()") {
		t.Fatal("CPU selection must work on touch-down independently of movement")
	}
	online, err := gameFiles.ReadFile("public/multiplayer.html")
	if err != nil { t.Fatal(err) }
	html := string(online)
	if !strings.Contains(html, "mobile-input-v70.css") || !strings.Contains(html, "mobile-input-v70.js") { t.Fatal("online mobile control gate missing") }
	if strings.Contains(html, "left:0;top:0;bottom:0;width:35%") {
		t.Fatal("the old PvP movement overlay still covers left-side aiming")
	}
	for _, text := range []string{"clip-path:circle", "chooseOnlineSlot", "addEventListener('pointerdown'", "setAimFromPointer"} {
		if !strings.Contains(html, text) { t.Fatalf("online touch control missing %s", text) }
	}
	base, err := gameFiles.ReadFile("public/index.html")
	if err != nil { t.Fatal(err) }
	served := mobilePatchedIndex(string(base))
	if !strings.Contains(served, "cpuView.w=aspect<1?730:1250") || !strings.Contains(html, "view.w=aspect<1?730:1250") { t.Fatal("battle cameras must use the wider view in all modes") }
	if !strings.Contains(served, "/mobile-input-v70.css") || !strings.Contains(served, "/mobile-input-v70.js") || !strings.Contains(served, "/arena-expansion-v72.js") {
		t.Fatal("common login/CPU route does not load the mobile touch fixes")
	}
}

// Both online modes use server-authoritative obstacles; CPU modes use
// rectangles too. All compound structures must be connected, within the
// arena, and share an expiry time per structure.
func TestExpandedArenaAndVariedCover(t *testing.T) {
	if W != 2300 || H != 1300 {
		t.Fatalf("arena is %vx%v, expected 2300x1300", W, H)
	}
	for _, layout := range []struct{name string; count int}{
		{"L",2},{"T",2},{"U",3},
	} {
		for rot := 0; rot < 4; rot++ {
			parts := obstacleParts(layout.name,100,100,200,190,48,rot)
			if len(parts) != layout.count { t.Fatalf("%s rotation %d has %d pieces",layout.name,rot,len(parts)) }
			for i, part := range parts {
				if part.X<100 || part.Y<100 || part.X+part.W>300 || part.Y+part.H>290 {
					t.Fatalf("%s rotation %d part %d escapes its footprint",layout.name,rot,i)
				}
				connected := i==0
				for j, other := range parts {
					if i!=j && part.X < other.X+other.W && part.X+part.W>other.X &&
						part.Y<other.Y+other.H && part.Y+part.H>other.Y {
						connected=true
					}
				}
				if !connected {t.Fatalf("%s rotation %d has disconnected part %d",layout.name,rot,i)}
			}
		}
	}
	for _, theme := range []string{"shrine","sakura","night"} {
		for trial:=0;trial<8;trial++ {
			walls:=newObstacles(theme)
			if len(walls)!=26 {
				t.Fatalf("%s layout %d generated %d pieces, expected 26",theme,trial,len(walls))
			}
			structures:=make(map[float64][]Obstacle)
			for _, o:=range walls {
				if o.X<65 || o.Y<65 || o.X+o.W>W-65 || o.Y+o.H>H-65 {
					t.Fatalf("%s obstacle beyond map edge: %+v",theme,o)
				}
				structures[o.Expires]=append(structures[o.Expires],o)
			}
			if len(structures)!=16 {t.Fatalf("%s has %d structures instead of 16",theme,len(structures))}
			dual,triple:=0,0
			for _,parts:=range structures {
				switch len(parts) {
				case 1:
				case 2: dual++
				case 3: triple++
				default: t.Fatalf("unexpected compound cover size %d",len(parts))
				}
				for i,part:=range parts {
					if i==0 {continue}
					touchesAnother:=false
					for j,other:=range parts {
						if i!=j && part.X<other.X+other.W && part.X+part.W>other.X &&
							part.Y<other.Y+other.H && part.Y+part.H>other.Y {
							touchesAnother=true
						}
					}
					if !touchesAnother {t.Fatal("obstacle pieces do not meet")}
				}
			}
			if dual!=6 || triple!=2 {
				t.Fatalf("%s compound variety wrong: 2-part=%d 3-part=%d",theme,dual,triple)
			}
		}
	}
}

func TestExpandedArenaCPUAndOnlineAssets(t *testing.T) {
	base, err := gameFiles.ReadFile("public/index.html")
	if err != nil { t.Fatal(err) }
	served := mobilePatchedIndex(string(base))
	if !strings.Contains(served, "/arena-expansion-v72.js") {
		t.Fatal("CPU normal/custom maps do not load the cover extension")
	}
	if strings.Contains(string(base), "1800") && !strings.Contains(served, "2300") {
		t.Fatal("CPU arena width has not been migrated")
	}
	if strings.Contains(string(base), "1050") && !strings.Contains(served, "1300") {
		t.Fatal("CPU arena height has not been migrated")
	}
	cpuExtension,err:=gameFiles.ReadFile("public/arena-expansion-v72.js")
	if err!=nil {t.Fatal(err)}
	for _,shape:=range []string{"'L'","'T'","'U'","__arenaShape"} {
		if !strings.Contains(string(cpuExtension),shape) {t.Errorf("CPU missing shape logic %s",shape)}
	}
	online, err := gameFiles.ReadFile("public/multiplayer.html")
	if err != nil { t.Fatal(err) }
	for _,mark:=range []string{"Math.min(2300-view.w","Math.min(1300-view.h","view.h=Math.min(1300","o.x/2300*mmw","o.y/1300*mmh","cx.strokeRect(45,45,2210,1210)"} {
		if !strings.Contains(string(online),mark) {t.Errorf("online camera/minimap mismatch: %s",mark)}
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
 // Invincibility protects HP, but must not lock ordinary attacks.
 q.Slots=[]Slot{{Ch:"火",Kind:"attack",N:4},{Ch:"水",Kind:"defense",N:4},{Ch:"木",Kind:"heal",N:4},{Ch:"風",Kind:"pierce",N:9},{Ch:"雷",Kind:"homing",N:13}}
 a.handle(c2,[]byte("{\"type\":\"cast\",\"selected\":0,\"aim\":3.14}"))
 a.tick(.01)
 if q.Casts!=1 || q.LastKind!="attack" {t.Fatal("invincibility blocked an ordinary weapon cast")}
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

func TestEveryUltimateInNormalAndCustomOnline(t *testing.T) {
 now:=float64(time.Now().UnixNano())/1e9
 for _,mode:=range []string{"normal","custom"} {
  for _,kind:=range []string{"roman","slow","invincible","dance","invisible","namepu"} {
   t.Run(mode+"_"+kind,func(t *testing.T){
    c:=&Client{send:make(chan []byte,12),pid:"p"}
    p:=&Player{ID:"p",C:c,Alive:true,HP:600,X:900,Y:500,Ultimate:kind,UltimateCharge:float64(ultimateCost(kind)),Keys:map[string]bool{}}
    other:=&Player{ID:"q",C:&Client{send:make(chan []byte,12)},Alive:true,HP:600,X:970,Y:500,Keys:map[string]bool{}}
    room:=&Room{Code:"MODE",Phase:"playing",Mode:mode,Theme:"night",Shrink:"normal",Started:time.Now(),Players:[]*Player{p,other}}
    c.room=room
    arena:=&Arena{rooms:map[string]*Room{"MODE":room}}
    arena.handle(c,[]byte(`{"type":"ultimate"}`))
    if !p.UltimateSpent||p.UltimateSerial!=1 {t.Fatal("ultimate did not activate exactly once")}
    switch kind {
    case "roman","slow":
     if !p.UltimateAiming||p.UltimateAimUntil<=now {t.Fatal("aimed ability must request targeting")}
    case "invincible":
     if p.InvincibleUntil<=now {t.Fatal("invincible was not set")}
    case "dance":
     if room.DanceUntil<=now {t.Fatal("dance did not synchronize to all players")}
    case "invisible":
     if p.InvisibleUntil<=now {t.Fatal("invisibility was not set")}
    case "namepu":
     if p.NamepuUntil<=now||!p.NamepuUsed {t.Fatal("namepu activation was not recorded")}
    }
    arena.handle(c,[]byte(`{"type":"ultimate"}`))
    if p.UltimateSerial!=1 {t.Fatal("second ultimate triggered in same match")}
   })
  }
 }
}

func TestBasicAttackCooldownSlightlySlowerForHighStrokeAcrossModes(t *testing.T) {
 // Four modes share a slightly slower base attack and stronger tiered penalties after 20 and 40 strokes.
 for _,tc:=range []struct{n int; seconds float64}{
  {1,1.0075},{10,2.47},{12,2.847},{20,4.355},{30,6.79},{40,9.225},{58,16.128},{84,26.099},
 } {
  if got:=slotCooldown("attack",tc.n); math.Abs(got-tc.seconds)>.000001 {
   t.Errorf("attack %d strokes: got %.5fs want %.5fs",tc.n,got,tc.seconds)
  }
 }
 if slotCooldown("attack",10)>=slotCooldown("attack",20)||slotCooldown("attack",20)>=slotCooldown("attack",40) {
  t.Fatal("high stroke attacks should fire more slowly")
 }
 index,e:=gameFiles.ReadFile("public/index.html");if e!=nil{t.Fatal(e)}
 served:=mobilePatchedIndex(string(index))
 if !strings.Contains(served,"attack:1.3*Math.max(.65,.65+n*.125+Math.max(0,n-10)*.02)+Math.max(0,n-20)*.055+Math.max(0,n-40)*.14") {
  t.Fatal("CPU normal/custom live HTML does not use the revised attack formula")
 }
 online,e:=gameFiles.ReadFile("public/multiplayer.html");if e!=nil{t.Fatal(e)}
 for _,expected:=range []string{
  "attack:1.3*(.65+n*.125+Math.max(0,n-10)*.02)+Math.max(0,n-20)*.055+Math.max(0,n-40)*.14",
  "const duration=onlineCD(slot.kind,slot.n)/1000",
 } {
  if !strings.Contains(string(online),expected) {t.Errorf("online attack cooldown display differs: %s",expected)}
 }
 for _,kind:=range []string{"defense","heal","pierce","homing"} {
  if slotCooldown(kind,15)<=0 {t.Fatal("other cooldown unexpectedly invalid: "+kind)}
  base:=map[string]float64{"defense":15,"heal":21.25,"pierce":13.75,"homing":10.8}[kind]
  if math.Abs(slotCooldown(kind,15)-base*1.4)>.000001 {t.Fatalf("%s cooldown should be multiplied by 1.4",kind)}
 }
}
func TestOnlineCombatScreenMatchesCPUScreenshotLayout(t *testing.T) {
 online,e:=gameFiles.ReadFile("public/multiplayer.html");if e!=nil{t.Fatal(e)}
 css,e:=gameFiles.ReadFile("public/online-cpu-parity.css");if e!=nil{t.Fatal(e)}
 for _,marker:=range []string{"online-cpu-parity.css","id=\"selfName\"","id=\"enemyName\"","id=\"enemyBar\"","id=\"battleAnnounce\"","class=\"battle-zone-info\"","id=\"zoneSize\"","class=\"game-wrap arena-shell\"","id=\"cards\" class=\"cards weaponrow\"","drawHandle=requestAnimationFrame(draw)"} {
  if !strings.Contains(string(online),marker) {t.Errorf("CPU-style online battle markup missing %s",marker)}
 }
 for _,marker:=range []string{"#gameArea .combat-hp.rival .hp-fill","#gameArea .weaponrow","#gameArea .arena-shell","#gameArea .battle-meta"} {
  if !strings.Contains(string(css),marker) {t.Errorf("CPU-style online battle CSS missing %s",marker)}
 }
 if slotCooldown("attack",58)<=slotCooldown("attack",40)+5 {t.Fatal("58-stroke glyph attack must have notably longer cooldown")}
}

func TestUltimateHelpToggleAndTwoCustomIcons(t *testing.T) {
 js,e:=gameFiles.ReadFile("public/ultimate-core.js");if e!=nil{t.Fatal(e)}
 content:=string(js)
 for _,part:=range []string{"ultimate-guide-toggle","aria-expanded","guide.hidden=expanded","guideToggle.addEventListener('click'","name:'ロマン砲'","name:'鈍化弾'","M65 17","M44 10 65 13","M34 65 29 67"} {
  if !strings.Contains(content,part){t.Errorf("missing ultimate help control or new icon artwork: %s",part)}
 }
 css,e:=gameFiles.ReadFile("public/ultimate-ui.css");if e!=nil{t.Fatal(e)}
 if !strings.Contains(string(css),".ultimate-guide-toggle[hidden]") {t.Fatal("ability description button must hide during battle")}
}

func TestRareHanAndUIAndRandomAccess(t *testing.T){
 for ch,want:=range map[string]int{"𰻞":58,"𰻝":43,"龘":48,"𪚥":64,"䨻":52} {
  if got:=strokes(ch);got!=want {t.Errorf("strokes %q = %d want %d",ch,got,want)}
 }
 slots:=[]Slot{{Ch:"𰻞",Kind:"attack",N:58},{Ch:"𰻝",Kind:"defense",N:43},{Ch:"龘",Kind:"heal",N:48},{Ch:"𪚥",Kind:"pierce",N:64},{Ch:"䨻",Kind:"homing",N:52}}
 if !validSlots(slots,false)||!validSlots(slots,true) {t.Fatal("rare ideographs must be permitted in all modes")}
 slots[0].N=12
 if validSlots(slots,false){t.Fatal("rare Han must not silently use twelve strokes")}
 ui,e:=gameFiles.ReadFile("public/ui-polish-v74.css");if e!=nil||!strings.Contains(string(ui),"#findRandomNow")||!strings.Contains(string(ui),".weaponrow") {t.Fatal("shared UI stylesheet missing")}
 servedBase,_:=gameFiles.ReadFile("public/index.html")
 served:=mobilePatchedIndex(string(servedBase))
 for _,marker:=range []string{"MojiStrokeReady","ui-polish-v74.css","bgmAudio.volume=.10","n>84","attack:1.2*Math.max","defense:1.4*(9+n*.4)"} {
  if !strings.Contains(served,marker){t.Errorf("CPU side missing %q",marker)}
 }
 online,_:=gameFiles.ReadFile("public/multiplayer.html")
 for _,marker:=range []string{"auto==='match'","code:action==='join'?","online-waiting","ui-polish-v74.css","a.volume=.10","onlineCD(slot.kind,slot.n)/1000"} {
  if !strings.Contains(string(online),marker){t.Errorf("online side missing %q",marker)}
 }
}
