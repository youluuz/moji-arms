package main

import (
	"encoding/json"
	"math"
	"strings"
	"testing"
	"time"
)


func TestBrowserIconEmbeddedOnSoloAndOnlinePages(t *testing.T) {
 icon,err:=gameFiles.ReadFile("public/mojibusou-icon.png")
 if err!=nil {t.Fatal("browser icon must be included in embedded game files:",err)}
 if len(icon)<1000 || string(icon[:8])!="\x89PNG\r\n\x1a\n" {t.Fatal("browser icon is missing or not a valid PNG")}
 solo,err:=gameFiles.ReadFile("public/index.html")
 if err!=nil{t.Fatal(err)}
 head:=mobilePatchedIndex(string(solo))
 if !strings.Contains(head,`rel="icon" type="image/png" sizes="64x64" href="/mojibusou-icon.png?v=1"`) ||
    !strings.Contains(head,`rel="apple-touch-icon" href="/mojibusou-icon.png?v=1"`) {
  t.Fatal("landing page must expose the approved game browser/mobile icon")
 }
 online,err:=gameFiles.ReadFile("public/multiplayer.html")
 if err!=nil{t.Fatal(err)}
 if !strings.Contains(string(online),`href="mojibusou-icon.png?v=1"`) ||
    !strings.Contains(string(online),`rel="apple-touch-icon"`) {
  t.Fatal("online page must use the same browser icon")
 }
}

func TestDynamicMapSizeForTwoThroughTenCombatants(t *testing.T) {
 last:=0.0
 for players:=2;players<=10;players++ {
  scale:=mapScale(players)
  expected:=.8+float64(players-2)*.7/8
  if math.Abs(scale-expected)>1e-10 || scale<=last {t.Fatalf("%d players: unexpected map scale %v",players,scale)}
  w,h:=mapDimensions(players)
  if w!=math.Round(2300*scale)||h!=math.Round(1300*scale) {t.Fatalf("%d players: bad arena size %v x %v",players,w,h)}
  room:=&Room{Shrink:"normal",Phase:"countdown",Players:make([]*Player,players)}
  for i:=range room.Players {room.Players[i]=&Player{ID:"test",HP:600}}
  state:=room.state()
  world:=state["world"].(map[string]float64)
  if world["w"]!=w||world["h"]!=h||world["scale"]!=scale {t.Fatalf("%d players: state world disagrees with physics",players)}
  zone:=room.zone()
  if math.Abs(zone["x"]-w/2)>.001||math.Abs(zone["y"]-h/2)>.001 {t.Fatalf("%d players: wrong safety circle center",players)}
  last=scale
 }
 if mapScale(1)!=.8||mapScale(11)!=1.5 {t.Fatal("map size must remain bounded at min/max")}
 frozen:=&Room{Phase:"playing",Shrink:"none",StartedPlayers:10,Players:make([]*Player,6)}
 w,h:=frozen.dimensions()
 if w!=3450||h!=1950||frozen.zone()["r"]!=1350*1.5 {t.Fatal("live match map must retain original 10-player dimensions after disconnects")}
 frozen.Phase="lobby";frozen.StartedPlayers=0
 if w2,_:=frozen.dimensions();w2>=w {t.Fatal("rematch lobby should recalculate map size for new player count")}

}

func TestBattleCountdownSpawnsAndKillCredit(t *testing.T) {
 a:=&Arena{rooms:map[string]*Room{}}
 mk:=func(id string)*Client{return &Client{send:make(chan []byte,128),pid:id}}
 c1,c2:=mk("p1"),mk("p2")
 slots:=[]Slot{
  {Ch:"火",Kind:"attack",N:4},{Ch:"水",Kind:"defense",N:4},
  {Ch:"木",Kind:"heal",N:4},{Ch:"金",Kind:"pierce",N:8},
  {Ch:"土",Kind:"homing",N:3},
 }
 setup,_:=json.Marshal(map[string]any{"type":"create","name":"A","ch":"火","slots":slots,"theme":"sakura","shrink":"normal"})
 a.handle(c1,setup)
 if c1.room==nil {t.Fatal("room creation failed")}
 join,_:=json.Marshal(map[string]any{"type":"join","code":c1.room.Code,"name":"B","ch":"水","slots":slots})
 a.handle(c2,join)
 room:=c1.room
 a.handle(c1,[]byte(`{"type":"start"}`))
 if room.Phase!="countdown" {t.Fatal("online round must open with countdown")}
 if room.zone()["r"]<1350*mapScale(2)-1 {t.Fatal("countdown unexpectedly shrank safe zone")}
 if room.state()["countdownLeft"].(float64)<2.0 {t.Fatal("expected visible 3-second server countdown")}
 if math.Hypot(room.Players[0].X-room.Players[1].X,room.Players[0].Y-room.Players[1].Y)<900 {t.Fatal("initial spawns still too close")}
 a.tick(.033)
 if room.Phase!="countdown" {t.Fatal("match began before 3s elapsed")}
 room.Started=time.Now().Add(-time.Millisecond)
 a.tick(.033)
 if room.Phase!="playing" {t.Fatal("server failed to begin battle at countdown end")}
 p1,p2:=room.Players[0],room.Players[1]
 if p1.Kills!=0||p2.Kills!=0 {t.Fatal("kills not reset")}
 hitFromBullet(room,p2,Bullet{Owner:p1.ID,Damage:750},float64(time.Now().UnixNano())/1e9)
 if p1.Kills!=1||p2.Alive {t.Fatal("finishing player's kill was not counted")}
 hitFromBullet(room,p2,Bullet{Owner:p1.ID,Damage:100},float64(time.Now().UnixNano())/1e9)
 if p1.Kills!=1 {t.Fatal("duplicate kill credited")}
 if room.state()["players"].([]map[string]any)[0]["kills"]!=1 {t.Fatal("kill tally missing in server state")}
 p2.Alive=true;p2.HP=100
 hit(p2,100,true,float64(time.Now().UnixNano())/1e9)
 if p1.Kills!=1 {t.Fatal("zone/environment death incorrectly counted as a kill")}
 p2.Alive=true;p2.HP=100
 hitFromBullet(room,p2,Bullet{Owner:"unknown",Damage:200},float64(time.Now().UnixNano())/1e9)
 if p1.Kills!=1 {t.Fatal("unknown owner earned a player's kill")}
 // A subsequent rematch resets per-round kills and opens another countdown.
 room.Phase="ended"
 a.handle(c1,[]byte(`{"type":"return-lobby"}`))
 if p1.Ready||p2.Ready {t.Fatal("replay must wait for both players to reconfirm equipment")}
 a.handle(c1,[]byte(`{"type":"start"}`))
 if room.Phase!="lobby" {t.Fatal("host bypassed readiness after replay")}
 confirm,_:=json.Marshal(map[string]any{"type":"setup","ch":"火","slots":slots,"ultimate":"roman"})
 a.handle(c1,confirm);a.handle(c2,confirm)
 a.handle(c1,[]byte(`{"type":"start"}`))
 if room.Phase!="countdown"||p1.Kills!=0 {t.Fatal("rematch did not reset kills/countdown")}
}

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
	for s, n := range map[string]int{"𱁬": 84, "𰻞": 58, "𰻝": 43, "龘": 48, "薔": 16, "超": 12, "♨": 2, "♨️": 5, "A": 3, "イ": 2, "ー": 1, "フ": 1, "ノ": 1, "ネ": 4, "ッ": 3, "が": 5, "ぱ": 5, "ヴ": 5, "あ": 3, "く": 1, "し": 1, "★": 2, "⚡": 5, "⭐": 5, "🇯🇵": 5, "🔥": 5, "❤️": 5} {
		if got := strokes(s); got != n {
			t.Errorf("strokes(%q): got %d want %d", s, got, n)
		}
	}
	if math.Abs(slotCooldown("homing", 1)-6.1992) > .001 {
		t.Fatal("homing cooldown regression")
	}
	if math.Abs(slotCooldown("pierce", 1)-10.43) > .001 {
		t.Fatal("pierce cooldown regression")
	}
}
func TestZoneAndRooms(t *testing.T) {
	room := &Room{Shrink: "none", Phase: "playing", Started: time.Now().Add(-120 * time.Second),Players:[]*Player{{ID:"A"}, {ID:"B"}}}
	if room.zone()["r"] != 1350*mapScale(2) {
		t.Fatal("no shrink")
	}
	room.Shrink = "instant"
	if room.zone()["r"] != 0 {
		t.Fatal("instant shrink should reach zero after its closing phase")
	}
	room.Shrink = "fast"
	if room.zone()["r"] != 0 {
		t.Fatal("fast shrink should reach zero after its closing phase")
	}
	room.Shrink = "normal"
	room.Started = time.Now()
	if room.zone()["r"] < 1349*mapScale(2) {
		t.Fatal("normal shrink starts full")
	}
	obs := newObstacles("shrine")
	if len(obs) == 0 {
		t.Fatal("no obstacles")
	}
}

// Protect players from spawning inside walls for any supported lobby size.
func TestObstacleSpawnSafety(t *testing.T) {
 for _,theme:=range []string{"shrine","sakura","night"} {
  for count:=2;count<=10;count++ {
   scale:=mapScale(count)
   w,h:=mapDimensions(count)
   for trial:=0;trial<4;trial++ {
    obstacles:=newObstaclesSized(theme,w,h,count,"normal")
    if len(obstacles)<7 {t.Fatalf("not enough cover %s/%d",theme,count)}
    for i:=0;i<count;i++ {
     angle:=2*math.Pi*float64(i)/float64(count)
     px:=w/2+680*scale*math.Cos(angle)
     py:=h/2+430*scale*math.Sin(angle)
     for _,o:=range obstacles {
      if circleRect(px,py,22,o) {t.Fatalf("spawn overlaps cover: %s/%d at %0.1f,%0.1f",theme,count,px,py)}
     }
    }
    for _,o:=range obstacles {
     if o.X<65||o.Y<65||o.X+o.W>w-65||o.Y+o.H>h-65 {t.Fatalf("cover escapes %s/%d: %+v",theme,count,o)}
    }
   }
  }
 }
}

// Every shrinking mode eventually erases the entire safe area. Shrink
// never reverses, and the explicit no-shrink option remains unchanged.
func TestShrinkingZoneFinallyDisappears(t *testing.T) {
 for _, tc := range []struct{mode string;mid,end float64}{
  {"normal",120,150},{"fast",70,88},{"slow",180,225},{"instant",0,24},
 } {
  for _,scale:=range []float64{.8,1,1.5}{
   last:=math.Inf(1)
   for n:=0;n<=int(tc.end)+50;n++{
    current:=zoneRadiusAt(tc.mode,float64(n),scale)
    if current<0 || current>last+.00001 {t.Fatalf("%s radius increased or negative at %ds: %v -> %v",tc.mode,n,last,current)}
    last=current
   }
   initial:=1350*scale
   if tc.mode=="instant"{initial=180*scale}
   if math.Abs(zoneRadiusAt(tc.mode,0,scale)-initial)>.001{t.Fatalf("%s initial radius unexpected",tc.mode)}
   if math.Abs(zoneRadiusAt(tc.mode,tc.mid,scale)-180*scale)>.001{
    t.Fatalf("%s phase 1 should reach 180 at %vs",tc.mode,tc.mid)
   }
   if zoneRadiusAt(tc.mode,tc.end,scale)!=0 || zoneRadiusAt(tc.mode,tc.end+100,scale)!=0 {
    t.Fatalf("%s failed to erase safe zone at %.0fs",tc.mode,tc.end)
   }
   if zoneRadiusAt("none",tc.end+100,scale)!=1350*scale {t.Fatal("no-shrink mode must stay unchanged")}
  }
 }
}

// Other obstacle structures must not create corridors too narrow for a
// 40-unit-diameter fighter. All generated U pockets must also have an exit.
func TestPassableObstacleCorridors(t *testing.T){
 const minGap=96.0
 for _,theme:=range []string{"shrine","sakura","night"}{
  for players:=2;players<=10;players++{
   w,h:=mapDimensions(players)
   for trial:=0;trial<5;trial++{
    obstacles:=newObstaclesSized(theme,w,h,players,"normal")
    if len(obstacles)<7{t.Fatalf("%s/%d lost all cover",theme,players)}
    for i,a:=range obstacles{
     for _,b:=range obstacles[i+1:]{
      // Same-expiry bars are intentionally joined L/T/U structures.
      if a.Expires==b.Expires{continue}
      if a.X<b.X+b.W+minGap-0.001 && a.X+a.W>b.X-minGap+0.001 &&
         a.Y<b.Y+b.H+minGap-0.001 && a.Y+a.H>b.Y-minGap+0.001 {
       t.Fatalf("impassable narrow gap between separate cover %s/%d trial %d: %+v and %+v",theme,players,trial,a,b)
      }
     }
    }
    groups:=make(map[float64][]Obstacle)
    for _,o:=range obstacles{groups[o.Expires]=append(groups[o.Expires],o)}
    for _,parts:=range groups{
     if len(parts)!=3{continue}
     first,second:=parts[1],parts[2]
     gap:=second.X-(first.X+first.W)
     if math.Abs(first.Y-second.Y)<.001 { // parallel vertical arms
     } else {gap=second.Y-(first.Y+first.H)}
     if gap<99.9 {t.Fatalf("U-shaped cover has narrow dead-end lane: %s/%d gap %.2f",theme,players,gap)}
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


func TestRoomEquipmentEditsAndSameRoomRematch(t *testing.T) {
 a:=&Arena{rooms:map[string]*Room{}}
 slots:=[]Slot{
  {Ch:"火",Kind:"attack",N:strokes("火")},{Ch:"水",Kind:"defense",N:strokes("水")},
  {Ch:"木",Kind:"heal",N:strokes("木")},{Ch:"風",Kind:"pierce",N:strokes("風")},
  {Ch:"雷",Kind:"homing",N:strokes("雷")},
 }
 first:=&Client{send:make(chan []byte,128)}
 second:=&Client{send:make(chan []byte,128)}
 join,_:=json.Marshal(map[string]any{"type":"match","ch":"火","slots":slots,"ultimate":"roman"})
 a.handle(first,join);a.handle(second,join)
 room:=first.room
 if room==nil || second.room!=room || room.Phase!="lobby"{t.Fatal("room setup failed")}
 code,host:=room.Code,room.Host
 a.handle(second,[]byte(`{"type":"editing"}`))
 if room.Players[1].Ready{t.Fatal("changing loadout must lock start until saved")}
 a.handle(first,[]byte(`{"type":"start"}`))
 if room.Phase!="lobby"{t.Fatal("host started while guest was editing")}
 slots[0]=Slot{Ch:"イ",Kind:"attack",N:2}
 slots[1]=Slot{Ch:"ー",Kind:"defense",N:1}
 equipment,_:=json.Marshal(map[string]any{"type":"setup","ch":"イ","slots":slots,"ultimate":"slow"})
 a.handle(second,equipment)
 if !room.Players[1].Ready||room.Players[1].Slots[0].N!=2||room.Players[1].Slots[1].N!=1||room.Players[1].Ultimate!="slow" {
  t.Fatal("joined player failed to apply changed kana loadout and ultimate")
 }
 a.handle(first,[]byte(`{"type":"start"}`))
 if room.Phase!="countdown"{t.Fatal("host failed to launch countdown after updated setup")}
 a.handle(second,[]byte(`{"type":"setup","ch":"火","slots":[],"ultimate":"roman"}`))
 if room.Players[1].Ultimate!="slow"{t.Fatal("equipment changed mid-match")}
 room.Phase="ended";room.Winner=first.pid
 a.handle(second,[]byte(`{"type":"return-lobby"}`))
 if first.room!=room||second.room!=room||room.Code!=code||room.Host!=host||
   len(room.Players)!=2||room.Phase!="lobby"||room.Winner!=""{
  t.Fatal("rematch must retain the original room and players")
 }
 if room.Players[0].Ready||room.Players[1].Ready {t.Fatal("rematch must require both players to reconfirm setup")}
 lobbySnapshot:=room.state()["players"].([]map[string]any)
 if lobbySnapshot[1]["slots"]==nil || lobbySnapshot[0]["slots"]==nil {t.Fatal("rematch lobby did not send authoritative saved equipment")}
 a.handle(first,[]byte(`{"type":"start"}`))
 if room.Phase!="lobby"{t.Fatal("host bypassed rematch ready requirement")}
 hostSetup,_:=json.Marshal(map[string]any{"type":"setup","ch":room.Players[0].Ch,"slots":room.Players[0].Slots,"ultimate":"roman"})
 a.handle(first,hostSetup)
 slots[0]=Slot{Ch:"水",Kind:"attack",N:strokes("水")}
 equipmentAgain,_:=json.Marshal(map[string]any{"type":"setup","ch":"水","slots":slots,"ultimate":"slow"})
 a.handle(second,equipmentAgain)
 if !room.Players[0].Ready||!room.Players[1].Ready||room.Players[1].Slots[0].Ch!="水" {t.Fatal("second round edited setup was not confirmed")}
 a.handle(first,[]byte(`{"type":"start"}`))
 if room.Phase!="countdown"||room.Players[1].Ultimate!="slow"||room.Players[1].HP!=600||room.Players[1].Slots[0].Ch!="水"{
  t.Fatal("second round did not start with updated equipment")
 }
 if strokes("イ")!=2 || strokes("ー")!=1 || strokes("フ")!=1 || strokes("ネ")!=4 {t.Fatal("kana stroke regression")}
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
	if room.Phase != "countdown" {
		t.Fatal("host could not manually start the public match countdown")
	}
	if room.Started.Sub(time.Now()).Seconds()<2.5 {t.Fatal("the server countdown was not 3 seconds")}
	room.Started=time.Now().Add(-time.Millisecond)
	a.tick(1.0/30)
	if room.Phase!="playing" {t.Fatal("countdown did not transition to playing")}
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
	if !strings.Contains(served, "cpuView.w=aspect<1?") || !strings.Contains(served, "?640:730") || !strings.Contains(html, "lowPowerMobile?640:730") || !strings.Contains(html, "lowPowerMobile?1050:1250") { t.Fatal("battle cameras must use the wider view in all modes") }
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
			if len(walls)!=16 {
				t.Fatalf("%s layout %d generated %d pieces, expected 16 in a small 2-player map",theme,trial,len(walls))
			}
			structures:=make(map[float64][]Obstacle)
			for _, o:=range walls {
				if o.X<65 || o.Y<65 || o.X+o.W>W-65 || o.Y+o.H>H-65 {
					t.Fatalf("%s obstacle beyond map edge: %+v",theme,o)
				}
				structures[o.Expires]=append(structures[o.Expires],o)
			}
			if len(structures)!=10 {t.Fatalf("%s has %d structures instead of 10",theme,len(structures))}
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
			if dual!=4 || triple!=1 {
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
	for _,mark:=range []string{"Math.min(Math.max(0,worldW-view.w)","Math.min(Math.max(0,worldH-view.h)","view.h=Math.min(worldH","o.x/worldW*mmw","o.y/worldH*mmh","cx.strokeRect(45,45,worldW-90,worldH-90)"} {
		if !strings.Contains(string(online),mark) {t.Errorf("online camera/minimap mismatch: %s",mark)}
	}
}

func TestSixUltimatesChargeAndServerRules(t *testing.T) {
 specs:=map[string]int{"roman":320,"slow":275,"invincible":280,"dance":280,"invisible":240,"namepu":160}
 for id,want:=range specs {if got:=ultimateCost(id);got!=want {t.Fatalf("ultimate %s: got %d want %d",id,got,want)}}
 if ultimateCost("unknown")!=0 || chooseUltimate("unknown")!="roman" {t.Fatal("invalid ultimate must default safely")}
 c1:=&Client{send:make(chan []byte,64),pid:"a"}
 c2:=&Client{send:make(chan []byte,64),pid:"b"}
 p:=&Player{ID:"a",C:c1,Alive:true,HP:600,X:900,Y:500,Ultimate:"roman",UltimateCharge:320,Keys:map[string]bool{}}
 q:=&Player{ID:"b",C:c2,Alive:true,HP:600,X:980,Y:500,Ultimate:"invincible",UltimateCharge:280,Keys:map[string]bool{}}
 room:=&Room{Code:"ULT",Phase:"playing",Mode:"normal",Theme:"shrine",Shrink:"normal",Started:time.Now(),Players:[]*Player{p,q}}
 c1.room=room;c2.room=room
 a:=&Arena{rooms:map[string]*Room{"ULT":room}}
 a.handle(c1,[]byte(`{"type":"ultimate"}`))
 if !p.UltimateAiming || !p.UltimateSpent || p.UltimateSerial!=1 {t.Fatal("roman must enter one-use aimed state")}
 a.handle(c1,[]byte(`{"type":"ultimate"}`))
 if p.UltimateSerial!=1 {t.Fatal("second ultimate illegally activated")}
 a.handle(c1,[]byte(`{"type":"ultimate-aim","aim":0}`))
 if p.UltimateAiming || math.Abs(p.UltimateWindupUntil-(float64(time.Now().UnixNano())/1e9+1))>.12 {t.Fatal("roman target should start 1s windup")}
 p.UltimateWindupUntil=float64(time.Now().UnixNano())/1e9-.01
 a.tick(.01)
 if len(room.Bullets)!=1 || room.Bullets[0].Special!="roman" || room.Bullets[0].Damage!=600 || math.Abs(room.Bullets[0].VX-590)>.01 {t.Fatal("roman cannon not emitted at expected power")}
 a.handle(c2,[]byte(`{"type":"ultimate"}`))
 if q.InvincibleUntil<=float64(time.Now().UnixNano())/1e9 {t.Fatal("invulnerability not activated")}
 hp:=q.HP;hit(q,999,true,float64(time.Now().UnixNano())/1e9)
 if q.HP!=hp {t.Fatal("invincible should also block penetrating and area damage")}
 // Roman Cannon must defeat a fully shielded target in one hit, but never ignore invincibility.
 hitFromBullet(room,q,room.Bullets[0],float64(time.Now().UnixNano())/1e9)
 if q.HP!=hp || !q.Alive {t.Fatal("Roman cannon illegally defeated an invincible player")}
 now:=float64(time.Now().UnixNano())/1e9
 victim:=&Player{ID:"c",C:&Client{send:make(chan []byte,64)},Alive:true,HP:600,Shield:600,ShieldUntil:now+5}
 room.Players=append(room.Players,victim)
 hitFromBullet(room,victim,room.Bullets[0],now)
 if victim.HP!=0 || victim.Alive || p.Kills!=1 {t.Fatal("Roman cannon must instantly defeat shielded victims and credit shooter")}
 // Invincibility protects HP, but must not lock ordinary attacks.
 q.Slots=[]Slot{{Ch:"火",Kind:"attack",N:4},{Ch:"水",Kind:"defense",N:4},{Ch:"木",Kind:"heal",N:4},{Ch:"風",Kind:"pierce",N:9},{Ch:"雷",Kind:"homing",N:13}}
 a.handle(c2,[]byte("{\"type\":\"cast\",\"selected\":0,\"aim\":3.14}"))
 a.tick(.01)
 if q.Casts!=1 || q.LastKind!="attack" {t.Fatal("invincibility blocked an ordinary weapon cast")}
 // Normal attacks only accrue successful strokes; tests should never allow a second ultimate.
 p.Ultimate="namepu";p.UltimateSpent=false;p.UltimateCharge=160
 a.handle(c1,[]byte(`{"type":"ultimate"}`))
 if math.Abs(p.NamepuUntil-(float64(time.Now().UnixNano())/1e9+5))>.12 || !p.NamepuUsed {t.Fatal("namepu 5-second self-dance was not enabled")}
 hp=p.HP;hit(p,10,true,float64(time.Now().UnixNano())/1e9)
 if p.HP!=hp-10 {t.Fatal("namepu must not grant damage resistance")}
 p.Ultimate="slow";p.UltimateSpent=false;p.UltimateCharge=275;p.NamepuUntil=0
 a.handle(c1,[]byte(`{"type":"ultimate"}`))
 a.handle(c1,[]byte(`{"type":"ultimate-aim","aim":0}`))
 if len(room.Bullets)==0 || room.Bullets[len(room.Bullets)-1].Special!="slow" || room.Bullets[len(room.Bullets)-1].Ch!="硬化弾" || room.Bullets[len(room.Bullets)-1].Damage!=60 {t.Fatal("slow ultimate must still deal 60 damage")}
}
// Invisibility must disable target acquisition and collision for homing
// missiles, including missiles fired before invisibility was activated.
func TestInvisibleCompletelyDefeatsHomingAcrossOnlineModes(t *testing.T) {
 for _,mode:=range []string{"normal","custom"} {
  t.Run(mode,func(t *testing.T){
   now:=float64(time.Now().UnixNano())/1e9
   attacker:=&Player{ID:"a",C:&Client{send:make(chan []byte,40)},Alive:true,HP:600,X:350,Y:400,Keys:map[string]bool{}}
   hidden:=&Player{ID:"b",C:&Client{send:make(chan []byte,40)},Alive:true,HP:600,X:850,Y:500,InvisibleUntil:now+4,Keys:map[string]bool{}}
   decoy:=&Player{ID:"c",C:&Client{send:make(chan []byte,40)},Alive:true,HP:600,X:1690,Y:1000,Keys:map[string]bool{}}
   room:=&Room{Code:"INVIS",Phase:"playing",Mode:mode,Theme:"night",Shrink:"none",
    Started:time.Now(),Players:[]*Player{attacker,hidden,decoy}}
   a:=&Arena{rooms:map[string]*Room{"INVIS":room}}
   homing:=Bullet{X:hidden.X,Y:hidden.Y,VX:200,VY:0,TTL:2,Damage:120,Owner:"a",Ch:"追",Homing:true}
   // Already-in-flight homing projectile intersects hidden player but cannot hit.
   room.Bullets=[]Bullet{homing}
   a.tick(.01)
   if hidden.HP!=600 || !hidden.Alive || len(room.Bullets)!=1 {
    t.Fatalf("invisible target was struck by a homing missile: hp=%v bullets=%d",hidden.HP,len(room.Bullets))
   }
   // Test direct damage entry too: effects must not bypass the collision rule.
   hitFromBullet(room,hidden,homing,float64(time.Now().UnixNano())/1e9)
   if hidden.HP!=600 {t.Fatal("homing hit direct path ignored invisibility")}
   // Ordinary non-homing weapon shots still hit; invisibility is not invulnerability.
   room.Bullets=[]Bullet{{X:hidden.X,Y:hidden.Y,VX:0,VY:0,TTL:2,Damage:70,Owner:"a",Ch:"火"}}
   a.tick(.01)
   if hidden.HP!=530 {t.Fatalf("ordinary bullet damage should remain, hp=%v",hidden.HP)}
   // As soon as invisibility ends homing projectiles may lock and hit again.
   hidden.InvisibleUntil=0
   room.Bullets=[]Bullet{homing}
   a.tick(.01)
   if hidden.HP!=410 {t.Fatalf("homing should reacquire a visible target, hp=%v",hidden.HP)}
  })
 }
}
// A hardening shot immobilizes shielded targets but cannot override full
// invincibility, and it resumes movement and attacks after three seconds.
func TestHardeningBulletAcrossOnlineBattleModes(t *testing.T) {
 for _,mode:=range []string{"normal","custom"} {
  t.Run(mode,func(t *testing.T){
   now:=float64(time.Now().UnixNano())/1e9
   shooter:=&Player{ID:"a",C:&Client{send:make(chan []byte,40)},Alive:true,HP:600,X:400,Y:450,Keys:map[string]bool{}}
   shielded:=&Player{ID:"b",Alive:true,HP:600,X:800,Y:450,Keys:map[string]bool{"d":true},Fire:false,Shield:600,ShieldUntil:now+10,
    Ultimate:"invincible",UltimateCharge:280,
    Slots:[]Slot{{Ch:"火",Kind:"attack",N:4},{Ch:"水",Kind:"defense",N:4},{Ch:"木",Kind:"heal",N:4},{Ch:"風",Kind:"pierce",N:9},{Ch:"雷",Kind:"homing",N:13}}}
   c:=&Client{send:make(chan []byte,40),pid:"b"}
   shielded.C=c
   room:=&Room{Code:"HARD",Phase:"playing",Mode:mode,Theme:"shrine",Shrink:"none",
    Started:time.Now(),Players:[]*Player{shooter,shielded},
    Bullets:[]Bullet{{X:800,Y:450,VX:0,VY:0,TTL:4,Damage:60,Owner:"a",Ch:"硬化弾",Special:"slow"}}}
   c.room=room
   a:=&Arena{rooms:map[string]*Room{"HARD":room}}
   a.tick(.05)
   if shielded.HP!=540 || shielded.Shield!=600 ||
      math.Abs(shielded.HardenedUntil-(float64(time.Now().UnixNano())/1e9+3))>.2 {
    t.Fatalf("shield must not block 60 damage or 3s hardening: hp=%v shield=%v left=%v",
      shielded.HP,shielded.Shield,shielded.HardenedUntil-now)
   }
   beforeX,beforeY:=shielded.X,shielded.Y
   a.handle(c,[]byte(`{"type":"cast","selected":0,"aim":0}`))
   a.handle(c,[]byte(`{"type":"ultimate"}`))
   a.tick(.1)
   if shielded.X!=beforeX||shielded.Y!=beforeY||shielded.Casts!=0||
      shielded.CastPending||shielded.UltimateSpent {
    t.Fatal("hardened player moved, attacked, or fired an ultimate")
   }
   // Healing and guarding must remain usable while feet are locked.
   a.handle(c,[]byte(`{"type":"cast","selected":1,"aim":0}`))
   a.tick(.01)
   if shielded.Casts!=1||shielded.LastKind!="defense"||shielded.Shield!=24||
      shielded.X!=beforeX||shielded.Y!=beforeY {
    t.Fatalf("defense must work while hardened and player must stay put: casts=%d, kind=%s, shield=%v",shielded.Casts,shielded.LastKind,shielded.Shield)
   }
   a.handle(c,[]byte(`{"type":"cast","selected":2,"aim":0}`))
   a.tick(.01)
   if shielded.Casts!=2||shielded.LastKind!="heal"||math.Abs(shielded.HP-553.6)>0.00001 {
    t.Fatalf("healing must work while hardened: casts=%d, kind=%s, HP=%v",shielded.Casts,shielded.LastKind,shielded.HP)
   }
   // Hardened attackers must not queue a delayed offensive cast.
   a.handle(c,[]byte(`{"type":"cast","selected":3,"aim":0}`))
   a.tick(.01)
   if shielded.Casts!=2||shielded.CastPending||shielded.X!=beforeX {
    t.Fatal("piercing attacks or movement occurred during hardening")
   }
   state:=room.state()["players"].([]map[string]any)
   var hardenedLeft float64
   for _,p:=range state {if p["id"]=="b"{hardenedLeft=p["hardenedLeft"].(float64)}}
   if hardenedLeft<2.7 || hardenedLeft>3.01 {t.Fatalf("harden timer not shown to client: %v",hardenedLeft)}
   // The same shot must not damage or immobilize an invincible player.
   shielded.HardenedUntil=0;shielded.InvincibleUntil=float64(time.Now().UnixNano())/1e9+8
   room.Bullets=[]Bullet{{X:shielded.X,Y:shielded.Y,VX:0,VY:0,TTL:3,Damage:60,Owner:"a",Ch:"硬化弾",Special:"slow"}}
   a.tick(.01)
   if math.Abs(shielded.HP-553.6)>0.00001 || shielded.HardenedUntil!=0 {t.Fatal("invincibility must block all hardening")}
   shielded.InvincibleUntil=0
   shielded.Keys["d"]=true
   shielded.LastInput=time.Now() // Emulate the fresh key packet sent after hardening ends.
   oldX:=shielded.X
   a.tick(.1)
   if shielded.X<=oldX {t.Fatal("movement did not recover after hardening")}
   a.handle(c,[]byte(`{"type":"cast","selected":0,"aim":0}`))
   a.tick(.01)
   if shielded.Casts!=3 {t.Fatal("ordinary attacks did not recover after hardening")}
  })
 }
}
func TestDanceFreezesEveryoneRegardlessOfMapDistance(t *testing.T) {
 for _,mode:=range []string{"normal","custom"} {
  t.Run(mode,func(t *testing.T){
   c1:=&Client{send:make(chan []byte,24),pid:"a"}
   c2:=&Client{send:make(chan []byte,24),pid:"b"}
   p:=&Player{ID:"a",C:c1,Alive:true,HP:600,X:35,Y:35,Ultimate:"dance",UltimateCharge:280,Keys:map[string]bool{"d":true}}
   q:=&Player{ID:"b",C:c2,Alive:true,HP:600,X:1800,Y:1000,Keys:map[string]bool{"a":true},Fire:true,
    Slots:[]Slot{{Ch:"火",Kind:"attack",N:4},{Ch:"水",Kind:"defense",N:4},{Ch:"木",Kind:"heal",N:4},{Ch:"風",Kind:"pierce",N:9},{Ch:"雷",Kind:"homing",N:13}}}
   room:=&Room{Code:"DANCE",Phase:"playing",Mode:mode,Theme:"night",Shrink:"normal",Started:time.Now(),Players:[]*Player{p,q},
    Bullets:[]Bullet{{X:q.X,Y:q.Y,VX:0,VY:0,Damage:70,TTL:3,Owner:p.ID,Ch:"火"}}}
   c1.room=room;c2.room=room
   a:=&Arena{rooms:map[string]*Room{"DANCE":room}}
   a.handle(c1,[]byte(`{"type":"ultimate"}`))
   if room.DanceUntil<=float64(time.Now().UnixNano())/1e9 {t.Fatal("global dance did not activate")}
   a.tick(.05)
   if p.X!=35 || p.Y!=35 || q.X!=1800 || q.Y!=1000 || q.Casts!=0 || q.HP!=600 {
    t.Fatalf("distant combatants must freeze and ignore damage: p=(%v,%v), q=(%v,%v), casts=%d, hp=%v",p.X,p.Y,q.X,q.Y,q.Casts,q.HP)
   }
   if math.Hypot(p.X-q.X,p.Y-q.Y)<1900 {t.Fatal("test opponents must be on distant sides of arena")}
   st:=room.state()
   players:=st["players"].([]map[string]any)
   for _,unit:=range players {
    if left:=unit["danceLeft"].(float64);left<=0 {t.Fatalf("all clients must see global dance, got %v",left)}
   }
  })
 }
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

// The loadout's ordinary-ability guide must not expand when a player types
// a glyph or switches attack/defense/heal, but must remain operable via the
// native disclosure button (including keyboard and narrow screens).
func TestManualLoadoutAbilityGuideDisclosure(t *testing.T) {
 html, err := gameFiles.ReadFile("public/index.html")
 if err != nil {t.Fatal(err)}
 patched := mobilePatchedIndex(string(html))
 if strings.Contains(patched,"<span>初心者向けガイド</span>") {
  t.Fatal("deprecated beginner-guide text was not replaced")
 }
 if !strings.Contains(patched,`<span class="ability-guide-chevron" aria-hidden="true">▼</span>`) {
  t.Fatal("arrow-only guide disclosure missing")
 }
 if strings.Contains(patched,`guide.open=true;}});`) {
  t.Fatal("changing a loadout ability still opens help automatically")
 }
 if !strings.Contains(patched,"#abilityGuide>summary .ability-guide-chevron{display:inline-flex!important") {
  t.Fatal("mobile arrow disclosure styling is missing")
 }
 if !strings.Contains(patched,"#abilityGuide>summary{list-style:none;min-height:48px") {
  t.Fatal("mobile/keyboard disclosure hit target must be at least 48px")
 }
 if !strings.Contains(patched,`<details class="ability-guide" id="abilityGuide">`) {
  t.Fatal("native details summary should retain accessible user-open/close behavior")
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
     if math.Abs(p.InvincibleUntil-(float64(time.Now().UnixNano())/1e9+2.8))>.15 {t.Fatal("invincible must last 2.8 seconds")}
    case "dance":
     if math.Abs(room.DanceUntil-(float64(time.Now().UnixNano())/1e9+2))>.15 {t.Fatal("dance must affect whole room for 2 seconds")}
    case "invisible":
     if math.Abs(p.InvisibleUntil-(float64(time.Now().UnixNano())/1e9+4))>.15 {t.Fatal("invisibility must last 4 seconds")}
    case "namepu":
     if math.Abs(p.NamepuUntil-(float64(time.Now().UnixNano())/1e9+5))>.15||!p.NamepuUsed {t.Fatal("namepu stun must last 5 seconds")}
    }
    arena.handle(c,[]byte(`{"type":"ultimate"}`))
    if p.UltimateSerial!=1 {t.Fatal("second ultimate triggered in same match")}
   })
  }
 }
}

func TestBasicAttackCooldownUpToTwentySecondsAcrossModes(t *testing.T) {
 // One stroke remains 0.8s, while the 84-stroke glyph 𱁬 takes 20s in all four modes.
 for _,tc:=range []struct{n int; seconds float64}{
  {1,0.8},{2,0.8850},{5,1.1616},{10,1.6938},{12,1.9317},{20,3.0258},{30,4.7147},{40,6.7603},{58,11.3417},{84,20.0},
 } {
  if got:=slotCooldown("attack",tc.n); math.Abs(got-tc.seconds)>.000051 {
   t.Errorf("attack %d strokes: got %.5fs want %.5fs",tc.n,got,tc.seconds)
  }
 }
 for n:=2;n<=84;n++ {
  if slotCooldown("attack",n)<=slotCooldown("attack",n-1) {
   t.Fatalf("normal attack cooldown is not increasing at %d strokes",n)
  }
 }
 if got:=strokes("𱁬");got!=84 {t.Fatalf("𱁬 should be 84 strokes, got %d",got)}
 if got:=slotCooldown("attack",strokes("𱁬"));math.Abs(got-20)>.0000001 {t.Fatalf("𱁬 should recharge in 20 seconds, got %.6f",got)}
 if slotCooldown("attack",85)!=20 {t.Fatal("invalid stroke counts must not exceed 84-stroke cooldown")}
 index,e:=gameFiles.ReadFile("public/index.html");if e!=nil{t.Fatal(e)}
 served:=mobilePatchedIndex(string(index))
 if !strings.Contains(served,"attack:0.8+19.2*(0.14*(n-1)+0.003*(n-1)*(n-1))/32.287") {
  t.Fatal("CPU normal/custom live HTML does not use the revised attack formula")
 }
 online,e:=gameFiles.ReadFile("public/multiplayer.html");if e!=nil{t.Fatal(e)}
 for _,expected:=range []string{
  "attack:0.8+19.2*(0.14*(n-1)+0.003*(n-1)*(n-1))/32.287",
  "const duration=onlineCD(slot.kind,slot.n)/1000",
 } {
  if !strings.Contains(string(online),expected) {t.Errorf("online attack cooldown display differs: %s",expected)}
 }
 for _,kind:=range []string{"defense","heal","pierce","homing"} {
  if slotCooldown(kind,15)<=0 {t.Fatal("other cooldown unexpectedly invalid: "+kind)}
  base:=map[string]float64{"defense":15,"heal":21.25,"pierce":13.75,"homing":10.8}[kind]
  if math.Abs(slotCooldown(kind,15)-base*1.4*map[bool]float64{true:.9,false:1}[kind=="homing"])>.000001 {t.Fatalf("%s cooldown differs from balanced formula",kind)}
 }
}
func TestWeaponPreviewStylesAndDamageSummary(t *testing.T){
 js,e:=gameFiles.ReadFile("public/weapon-visuals-v86.js");if e!=nil{t.Fatal(e)}
 css,e:=gameFiles.ReadFile("public/weapon-visuals-v86.css");if e!=nil{t.Fatal(e)}
 for _,token:=range []string{"attack:0.8+19.2*(0.14*(n-1)+0.003*(n-1)*(n-1))/32.287","attack:{name:'通常攻撃'","pierce:{name:'貫通'","homing:{name:'ホーミング'","drawProjectile","syncSoloBattle","preMatchOnline","preMatchSolo","Math.round(n*(7-.02*(n-1)))","Math.round(n*3.4)"} {
  if !strings.Contains(string(js),token){t.Errorf("missing projectile or weapon metric: %s",token)}
 }
 if !strings.Contains(string(css),"body.online-battle #gameArea .combat-hp.rival{display:none!important}") ||
    !strings.Contains(string(css),"#gameScreen .hud") {t.Fatal("must retain own HP only in solo and online")}
 if !strings.Contains(mobilePatchedIndex("<html><head></head><body></body></html>"),"weapon-visuals-v86.js") {
  t.Fatal("legacy solo page did not import weapon previews")
 }
}

func TestOnlineCombatScreenMatchesCPUScreenshotLayout(t *testing.T) {
 online,e:=gameFiles.ReadFile("public/multiplayer.html");if e!=nil{t.Fatal(e)}
 css,e:=gameFiles.ReadFile("public/online-cpu-parity.css");if e!=nil{t.Fatal(e)}
 for _,marker:=range []string{"online-cpu-parity.css","weapon-visuals-v86.js","id=\"selfName\"","id=\"selfBar\"","id=\"battleAnnounce\"","class=\"battle-zone-info\"","id=\"zoneSize\"","class=\"game-wrap arena-shell\"","id=\"cards\" class=\"cards weaponrow\"","drawHandle=requestAnimationFrame(draw)"} {
  if !strings.Contains(string(online),marker) {t.Errorf("CPU-style online battle markup missing %s",marker)}
 }
 if strings.Contains(string(online),`id="enemyBar"`) || strings.Contains(string(online),`id="enemyHP"`) {t.Fatal("top-right opponent HP must be removed")}
 for _,marker:=range []string{"#gameArea .weaponrow","#gameArea .arena-shell","#gameArea .battle-meta"} {
  if !strings.Contains(string(css),marker) {t.Errorf("CPU-style online battle CSS missing %s",marker)}
 }
 if slotCooldown("attack",58)<=slotCooldown("attack",40)+2 {t.Fatal("58-stroke glyph attack must have notably longer cooldown")}
}

func TestUltimateHelpToggleAndTwoCustomIcons(t *testing.T) {
 js,e:=gameFiles.ReadFile("public/ultimate-core.js");if e!=nil{t.Fatal(e)}
 content:=string(js)
 for _,part:=range []string{"ultimate-guide-toggle","aria-expanded","setGuideOpen(false,true)","ultimate-guide-close","ultimate-guide-bottom-close","guideToggle.addEventListener('click'","name:'ロマン砲'","name:'硬化弾'","rotate(-24 48 49)","M65 32H83L89 37V63L83 68H65","M23 13H45L43 53H30","x=\"62\" y=\"59\" width=\"28\" height=\"25\""} {
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
 for _,marker:=range []string{"MojiStrokeReady","ui-polish-v74.css","bgmAudio.volume=.10","n>84","attack:0.8+19.2*(0.14*(n-1)","defense:1.4*(9+n*.4)"} {
  if !strings.Contains(served,marker){t.Errorf("CPU side missing %q",marker)}
 }
 online,_:=gameFiles.ReadFile("public/multiplayer.html")
 for _,marker:=range []string{"auto==='match'","action==='join'||action==='watch'","online-waiting","ui-polish-v74.css","a.volume=.10","onlineCD(slot.kind,slot.n)/1000"} {
  if !strings.Contains(string(online),marker){t.Errorf("online side missing %q",marker)}
 }
}


// Guard against the same double-rendered first CPU and stuck input after hold.
func TestSoloAvatarAndInputReleaseRegression(t *testing.T) {
 index, err := gameFiles.ReadFile("public/index.html")
 if err != nil { t.Fatal(err) }
 served := mobilePatchedIndex(string(index))
 if strings.Contains(served, "drawMarker(player,avatarChar,false);drawMarker(enemy,'敵',true);") {
  t.Fatal("legacy CPU icons must not be painted on top of the unified renderer")
 }
 if !strings.Contains(served, "/* player and all CPUs rendered exactly once by cpu-battle-v78.js */") {
  t.Fatal("solo fighter drawing replacement is missing")
 }
 if !strings.Contains(served, "/mobile-input-v70.js?v=142") ||
    !strings.Contains(served, "/cpu-battle-v78.js?v=143") {
  t.Fatal("busted cache versions would retain stale CPU icon or input behavior")
 }
 cpu, err := gameFiles.ReadFile("public/cpu-battle-v78.js")
 if err != nil { t.Fatal(err) }
 if !strings.Contains(string(cpu), "function drawFighter(fighter,own)") ||
    !strings.Contains(string(cpu), "drawFighter(player,true)") ||
    !strings.Contains(string(cpu), "for(const bot of bots)drawFighter(bot,false)") {
  t.Fatal("self and every CPU must use the same avatar and HP renderer")
 }
 input, err := gameFiles.ReadFile("public/mobile-input-v70.js")
 if err != nil { t.Fatal(err) }
 for _, safe := range []string{
   "cpuStickRelease === 'function'",
   "window.addEventListener('pointerup', releaseFinishedPointer, true)",
   "keyLastSeen.set(key,performance.now())",
 } {
  if !strings.Contains(string(input), safe) {
   t.Fatalf("missing held input cleanup guard: %s", safe)
  }
 }
}

 
// The Namepu medal must be a direct child of the full result card, not of
// .result-message's narrow grid column: this was the 130px victory screen bug.
func TestNamepuVictoryResultPanelStaysFullWidth(t *testing.T) {
 namepu,e:=gameFiles.ReadFile("public/namepu-victory-v123.js");if e!=nil{t.Fatal(e)}
 css,e:=gameFiles.ReadFile("public/namepu-victory-v123.css");if e!=nil{t.Fatal(e)}
 cpu,e:=gameFiles.ReadFile("public/cpu-battle-v78.js");if e!=nil{t.Fatal(e)}
 online,e:=gameFiles.ReadFile("public/multiplayer.html");if e!=nil{t.Fatal(e)}
 rawIndex,e:=gameFiles.ReadFile("public/index.html");if e!=nil{t.Fatal(e)}
 served:=mobilePatchedIndex(string(rawIndex))
 for _,marker:=range []string{":scope > .result-stats",":scope > .online-meta","box.insertBefore(panel,target||null)","ensureFullWidthPanel(box,mode)","rescueNamepuCard(overlay,mode)","new MutationObserver(refresh)","if(panel.parentElement!==box","box.insertBefore(kills,anchor||null)"}{
  if !strings.Contains(string(namepu),marker){t.Errorf("Namepu panel must be anchored directly to card: %s",marker)}
 }
 if strings.Contains(string(namepu),"box.querySelector('.result-stats,.moji-result-kills,.online-meta')"){t.Fatal("old selector inserts champion into narrow kill counter parent")}
 if !strings.Contains(string(cpu),"stats.insertAdjacentElement('afterend',tally)"){t.Fatal("solo kill count must not be placed inside hero title")}
 for _,marker:=range []string{"#result.moji-namepu-deluxe .result-inner","max-height:calc(100dvh - 24px)","overflow-y:auto!important","width:100%!important;","grid-column:1 / -1!important","display:flex!important;flex-direction:column!important;align-items:stretch!important","width:min(820px,calc(100vw - 32px))!important","grid-template-columns:none!important"}{
  if !strings.Contains(string(css),marker){t.Errorf("Namepu scrolling/full-width layout missing: %s",marker)}
 }
 for _,s:=range []string{"/namepu-victory-v123.css?v=136","/namepu-victory-v123.js?v=136","/cpu-battle-v78.js?v=143"}{
  if !strings.Contains(served,s){t.Errorf("solo browser may keep cached Namepu bug: %s",s)}
 }
 for _,s:=range []string{"namepu-victory-v123.css?v=136","namepu-victory-v123.js?v=136"}{
  if !strings.Contains(string(online),s){t.Errorf("online browser may keep cached Namepu bug: %s",s)}
 }
}

func TestDanceBoostPowersAreCasterOnlyAndPersistInMatch(t *testing.T) {
 p:=&Player{Ultimate:"dance"}
 if normalPowerMultiplier(p)!=1 {t.Fatal("ordinary power before dance must be 1.0")}
 p.DanceBoost=true
 if math.Abs(normalPowerMultiplier(p)-1.2)>1e-9 {t.Fatal("dance multiplier must be 1.2")}
 if normalPowerMultiplier(&Player{})!=1 {t.Fatal("other players must not inherit dance buff")}
 if normalPowerMultiplier(&Player{NamepuUsed:true})!=.8 {t.Fatal("namepu weakening must remain")}
 if normalPowerMultiplier(nil)!=1 {t.Fatal("nil player should stay neutral")}
 r:=&Room{Phase:"lobby",Players:[]*Player{p}}
 online:=r.state()["players"].([]map[string]any)[0]
 if online["danceBoost"]!=true {t.Fatal("online UI should receive the authoritative dance buff")}
}
