// 文字武装 GLYPH STRIKE v7.3: mobile multi-touch control and arena server.
// No third-party Go modules are needed; go build works offline.
package main

import (
	"bufio"
	"context"
	"crypto/rand"
	"crypto/sha1"
	"embed"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log"
	"math"
	"regexp"
	mathrand "math/rand"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
	"unicode"
	"unicode/utf8"
)

//go:embed public/*
var gameFiles embed.FS
var dictionary map[string]int

const W, H = 2300.0, 1300.0
// Both dimensions scale uniformly with the number of combatants.
func mapScale(players int) float64 {
 if players<2 {players=2};if players>10 {players=10}
 return .8 + float64(players-2)*.7/8
}
func mapDimensions(players int) (float64,float64) {
 k:=mapScale(players)
 return math.Round(W*k),math.Round(H*k)
}
const maxRooms = 150

func init() {
	data, e := gameFiles.ReadFile("public/strokes.json")
	if e != nil {
		panic(e)
	}
	if e = json.Unmarshal(data, &dictionary); e != nil {
		panic(e)
	}
	// The server is authoritative for Japanese kana just as it is for rare Han.
	kana, e := gameFiles.ReadFile("public/kana-strokes.json")
	if e != nil { panic(e) }
	var kanaDictionary map[string]int
	if e = json.Unmarshal(kana, &kanaDictionary); e != nil { panic(e) }
	for ch, n := range kanaDictionary { dictionary[ch] = n }
}
func bound(v, a, b float64) float64       { return math.Max(a, math.Min(b, v)) }
func dist(x1, y1, x2, y2 float64) float64 { return math.Hypot(x1-x2, y1-y2) }
func randomCode(n int) string {
	alphabet := "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, n)
	_, _ = rand.Read(b)
	for i := range b {
		b[i] = alphabet[int(b[i])%len(alphabet)]
	}
	return string(b)
}
func strokes(ch string) int {
	// Common kana must use their written stroke count, not the generic letter=3 fallback.
	if ch == "ー" { return 1 }
	if ch == "イ" { return 2 }
	if n, ok := dictionary[ch]; ok {
		return n
	}
	if !validCharacter(ch) {
		return 0
	}
	for _, r := range ch {
		if unicode.Is(unicode.Han, r) {
			return 0 // Unknown Han must not silently become twelve strokes
		}
	}
	for _, r := range ch {
		if r == 0xfe0f || r == 0x200d || emojiPresentation(r) || r >= 0x1f300 {
			return 5
		}
	}
	for _, r := range ch {
		if unicode.IsLetter(r) || unicode.IsNumber(r) {
			return 3
		}
	}
	return 2
}

// emojiPresentation mirrors JavaScript Unicode Emoji_Presentation for game stroke equivalence.
// Ranges are generated from the runtime Unicode property rather than a handpicked emoji list.
func emojiPresentation(r rune) bool {
	return (r >= 0x231a && r <= 0x231b) ||
		(r >= 0x23e9 && r <= 0x23ec) ||
		r == 0x23f0 ||
		r == 0x23f3 ||
		(r >= 0x25fd && r <= 0x25fe) ||
		(r >= 0x2614 && r <= 0x2615) ||
		(r >= 0x2648 && r <= 0x2653) ||
		r == 0x267f ||
		r == 0x2693 ||
		r == 0x26a1 ||
		(r >= 0x26aa && r <= 0x26ab) ||
		(r >= 0x26bd && r <= 0x26be) ||
		(r >= 0x26c4 && r <= 0x26c5) ||
		r == 0x26ce ||
		r == 0x26d4 ||
		r == 0x26ea ||
		(r >= 0x26f2 && r <= 0x26f3) ||
		r == 0x26f5 ||
		r == 0x26fa ||
		r == 0x26fd ||
		r == 0x2705 ||
		(r >= 0x270a && r <= 0x270b) ||
		r == 0x2728 ||
		r == 0x274c ||
		r == 0x274e ||
		(r >= 0x2753 && r <= 0x2755) ||
		r == 0x2757 ||
		(r >= 0x2795 && r <= 0x2797) ||
		r == 0x27b0 ||
		r == 0x27bf ||
		(r >= 0x2b1b && r <= 0x2b1c) ||
		r == 0x2b50 ||
		r == 0x2b55 ||
		r == 0x1f004 ||
		r == 0x1f0cf ||
		r == 0x1f18e ||
		(r >= 0x1f191 && r <= 0x1f19a) ||
		(r >= 0x1f1e6 && r <= 0x1f1ff) ||
		r == 0x1f201 ||
		r == 0x1f21a ||
		r == 0x1f22f ||
		(r >= 0x1f232 && r <= 0x1f236) ||
		(r >= 0x1f238 && r <= 0x1f23a) ||
		(r >= 0x1f250 && r <= 0x1f251) ||
		(r >= 0x1f300 && r <= 0x1f320) ||
		(r >= 0x1f32d && r <= 0x1f335) ||
		(r >= 0x1f337 && r <= 0x1f37c) ||
		(r >= 0x1f37e && r <= 0x1f393) ||
		(r >= 0x1f3a0 && r <= 0x1f3ca) ||
		(r >= 0x1f3cf && r <= 0x1f3d3) ||
		(r >= 0x1f3e0 && r <= 0x1f3f0) ||
		r == 0x1f3f4 ||
		(r >= 0x1f3f8 && r <= 0x1f43e) ||
		r == 0x1f440 ||
		(r >= 0x1f442 && r <= 0x1f4fc) ||
		(r >= 0x1f4ff && r <= 0x1f53d) ||
		(r >= 0x1f54b && r <= 0x1f54e) ||
		(r >= 0x1f550 && r <= 0x1f567) ||
		r == 0x1f57a ||
		(r >= 0x1f595 && r <= 0x1f596) ||
		r == 0x1f5a4 ||
		(r >= 0x1f5fb && r <= 0x1f64f) ||
		(r >= 0x1f680 && r <= 0x1f6c5) ||
		r == 0x1f6cc ||
		(r >= 0x1f6d0 && r <= 0x1f6d2) ||
		(r >= 0x1f6d5 && r <= 0x1f6d8) ||
		(r >= 0x1f6dc && r <= 0x1f6df) ||
		(r >= 0x1f6eb && r <= 0x1f6ec) ||
		(r >= 0x1f6f4 && r <= 0x1f6fc) ||
		(r >= 0x1f7e0 && r <= 0x1f7eb) ||
		r == 0x1f7f0 ||
		(r >= 0x1f90c && r <= 0x1f93a) ||
		(r >= 0x1f93c && r <= 0x1f945) ||
		(r >= 0x1f947 && r <= 0x1f9ff) ||
		(r >= 0x1fa70 && r <= 0x1fa7c) ||
		(r >= 0x1fa80 && r <= 0x1fa8a) ||
		(r >= 0x1fa8e && r <= 0x1fac6) ||
		r == 0x1fac8 ||
		(r >= 0x1facd && r <= 0x1fadc) ||
		(r >= 0x1fadf && r <= 0x1faea) ||
		(r >= 0x1faef && r <= 0x1faf8)
}

// A compact approximation of a Unicode extended grapheme cluster. Handles keycap, VS16,
// ZWJ emoji sequences, skin-tone modifiers and paired regional-indicator flags.
func validCharacter(s string) bool {
	if !utf8.ValidString(s) || len(s) == 0 || len(s) > 64 {
		return false
	}
	rs := []rune(s)
	if len(rs) > 16 {
		return false
	}
	bases := 0
	zwj := false
	regionals := 0
	for i, r := range rs {
		if unicode.IsSpace(r) || unicode.IsControl(r) || r == 0x7f {
			return false
		}
		if r == 0x200d {
			if i == 0 || i == len(rs)-1 {
				return false
			}
			zwj = true
			continue
		}
		if r == 0xfe0f || r == 0xfe0e || r == 0x20e3 || unicode.Is(unicode.Mn, r) || unicode.Is(unicode.Me, r) || r >= 0x1f3fb && r <= 0x1f3ff {
			continue
		}
		if r >= 0x1f1e6 && r <= 0x1f1ff {
			regionals++
			continue
		}
		if unicode.IsLetter(r) || unicode.IsNumber(r) || unicode.IsSymbol(r) || unicode.IsPunct(r) {
			bases++
		} else {
			return false
		}
	}
	if regionals > 0 {
		return regionals == 2 && bases == 0
	}
	if zwj {
		return bases >= 2 && bases <= 6
	}
	return bases == 1
}

type Slot struct {
	Ch   string `json:"ch"`
	Kind string `json:"kind"`
	N    int    `json:"n"`
}
type Obstacle struct {
	X       float64 `json:"x"`
	Y       float64 `json:"y"`
	W       float64 `json:"w"`
	H       float64 `json:"h"`
	Style   string  `json:"style"`
	Expires float64 `json:"expires"`
}
type Bullet struct {
	X, Y, VX, VY, Damage, TTL float64
	Owner, Ch                 string
	Pierce, Homing            bool
	Special                   string
}
type Player struct {
	ID, Name, Ch        string
	C                   *Client
	X, Y, HP, Shield    float64
	Alive, Ready, Fire  bool
	CastPending         bool
	PendingSelected     int
	PendingAim          float64
	PendingUntil        float64
	ShieldUntil         float64
	Slots               []Slot
	Selected            int
	Keys                map[string]bool
	Aim                 float64
	Last                [5]float64
	GuardSlot           int
	Casts, ActionSerial, Kills int
	LastKind            string
	LastInput           time.Time
	Ultimate string
	UltimateCharge, UltimateAim float64
	UltimateSpent, UltimateAiming bool
	UltimateAimUntil, UltimateWindupUntil float64
	InvincibleUntil, InvisibleUntil, HardenedUntil, NamepuUntil float64
	UltimateSerial int
	LastUltimate string
	NamepuUsed bool
}
type Room struct {
	Code, Host, Mode, Theme, Shrink, Phase, Winner, Message string
	Started                                                 time.Time
	Public                                                  bool
	StartedPlayers int
	Players                                                 []*Player
	Obstacles                                               []Obstacle
	Bullets                                                 []Bullet
	DanceUntil                                              float64
}
type Client struct {
	conn    net.Conn
	read    *bufio.Reader
	send    chan []byte
	writeMu sync.Mutex
	room    *Room
	pid     string
	done    chan struct{}
	once    sync.Once
}
type Arena struct {
	mu    sync.Mutex
	rooms map[string]*Room
}

var arena = &Arena{rooms: map[string]*Room{}}

func (r *Room) elapsed() float64 {
	if r.Phase == "lobby" || r.Phase == "countdown" {
		return 0
	}
	return math.Max(0, time.Since(r.Started).Seconds()*1000)
}
func (r *Room) combatants() int {if r.Phase!="lobby"&&r.StartedPlayers>=2{return r.StartedPlayers};return len(r.Players)}
func (r *Room) dimensions() (float64,float64) { return mapDimensions(r.combatants()) }
func (r *Room) zone() map[string]float64 {
 w,h:=r.dimensions()
 scale:=mapScale(r.combatants())
	rad := 1350.0*scale
	switch r.Shrink {
	case "none":
		rad = 1350*scale
	case "instant":
		rad = 180*scale
	default:
		seconds := 120.0
		if r.Shrink == "slow" {
			seconds = 180
		} else if r.Shrink == "fast" {
			seconds = 70
		}
		rad = math.Max(180*scale, (1350-1170*math.Min(1, r.elapsed()/1000/seconds))*scale)
	}
	return map[string]float64{"x": w / 2, "y": h / 2, "r": rad}
}
func (r *Room) broadcast() {
	data := r.state()
	buf, e := json.Marshal(data)
	if e != nil {
		return
	}
	for _, p := range r.Players {
		p.C.enqueue(buf)
	}
}
func (r *Room) state() map[string]any {
	now := float64(time.Now().UnixNano()) / 1e9
	countdownLeft:=0.0
	if r.Phase=="countdown" {countdownLeft=math.Max(0,time.Until(r.Started).Seconds())}
	players := make([]map[string]any, 0, len(r.Players))
	for _, p := range r.Players {
		cd := make([]float64, 5)
		for i := range cd {
			cd[i] = math.Round(math.Max(0, p.Last[i]-now)*100) / 100
		}
		lastKind := any(nil)
		if p.LastKind != "" {
			lastKind = p.LastKind
		}
		char:=p.Ch
        if now<p.NamepuUntil {char="😐"}
        players = append(players, map[string]any{"ultimate":p.Ultimate,"ultimateCharge":p.UltimateCharge,"ultimateSpent":p.UltimateSpent,"ultimateAiming":p.UltimateAiming,"ultimateAimLeft":math.Max(0,p.UltimateAimUntil-now),"invincibleLeft":math.Max(0,p.InvincibleUntil-now),"invisibleLeft":math.Max(0,p.InvisibleUntil-now),"hardenedLeft":math.Max(0,p.HardenedUntil-now),"namepuLeft":math.Max(0,p.NamepuUntil-now),"namepuUsed":p.NamepuUsed,"ultimateSerial":p.UltimateSerial,"lastUltimate":p.LastUltimate,"danceLeft":math.Max(0,r.DanceUntil-now),"id":p.ID,"name":p.Name,"ch":char, "x": math.Round(p.X*10) / 10, "y": math.Round(p.Y*10) / 10, "hp": math.Round(math.Max(0, p.HP)*10) / 10, "alive": p.Alive, "shield": math.Round(math.Max(0, p.Shield)*10) / 10, "shieldLeft": math.Round(math.Max(0, p.ShieldUntil-now)*100) / 100, "ready": p.Ready, "selected": p.Selected, "cooldowns": cd, "guardSlot": p.GuardSlot, "casts": p.Casts, "kills":p.Kills, "actionSerial": p.ActionSerial, "lastKind": lastKind})
	}
	bullets := make([]map[string]any, 0, len(r.Bullets))
	for _, b := range r.Bullets {
		bullets = append(bullets, map[string]any{"x": math.Round(b.X*10) / 10, "y": math.Round(b.Y*10) / 10, "ch": b.Ch, "owner": b.Owner, "pierce": b.Pierce, "homing": b.Homing, "special": b.Special})
	}
	win := any(nil)
	if r.Winner != "" {
		win = r.Winner
	}
	w,h:=r.dimensions()
	return map[string]any{"type": "state", "world":map[string]float64{"w":w,"h":h,"scale":mapScale(r.combatants())}, "phase": r.Phase, "countdownLeft":countdownLeft, "code": r.Code, "host": r.Host, "mode": r.Mode, "theme": r.Theme, "shrink": r.Shrink, "zone": r.zone(), "elapsed": int(r.elapsed()), "obstacles": r.Obstacles, "players": players, "bullets": bullets, "winner": win, "status": r.Message, "public": r.Public}
}
func (c *Client) enqueue(b []byte) {
	select {
	case c.send <- b:
	default:
		select {
		case <-c.send:
		default:
		}
		select {
		case c.send <- b:
		default:
		}
	}
}
func (c *Client) message(value any) {
	data, e := json.Marshal(value)
	if e == nil {
		c.enqueue(data)
	}
}
func (a *Arena) find(code string) *Room { return a.rooms[code] }
func (a *Arena) byID(room *Room, id string) *Player {
	for _, p := range room.Players {
		if p.ID == id {
			return p
		}
	}
	return nil
}
func isKind(s string) bool {
	switch s {
	case "attack", "defense", "heal", "pierce", "homing":
		return true
	}
	return false
}
// All modes accept one Unicode glyph per slot; normal mode derives the stroke value.
func validSlots(values []Slot, custom bool) bool {
	if len(values) != 5 {
		return false
	}
	for _, v := range values {
		if !isKind(v.Kind) || !validCharacter(v.Ch) || v.N < 1 || v.N > 84 {
			return false
		}
		if !custom && strokes(v.Ch) != v.N {
			return false
		}
	}
	return true
}
// Each structure is composed of ordinary rectangles, so existing movement,
// projectile collision, wall rendering and minimap logic work for L, T and U cover.
func obstacleParts(layout string, x, y, w, h, t float64, orientation int) []Obstacle {
	rect := func(x, y, w, h float64) Obstacle {
		return Obstacle{X:x, Y:y, W:w, H:h}
	}
	switch layout {
	case "L":
		barY, columnX := y, x
		if orientation >= 2 { barY = y + h - t }
		if orientation%2 == 1 { columnX = x + w - t }
		return []Obstacle{rect(x,barY,w,t), rect(columnX,y,t,h)}
	case "T":
		switch orientation {
		case 0:
			return []Obstacle{rect(x,y,w,t),rect(x+w/2-t/2,y,t,h)}
		case 1:
			return []Obstacle{rect(x,y,t,h),rect(x,y+h/2-t/2,w,t)}
		case 2:
			return []Obstacle{rect(x,y+h-t,w,t),rect(x+w/2-t/2,y,t,h)}
		default:
			return []Obstacle{rect(x+w-t,y,t,h),rect(x,y+h/2-t/2,w,t)}
		}
	case "U":
		switch orientation {
		case 0:
			return []Obstacle{rect(x,y,w,t),rect(x,y,t,h),rect(x+w-t,y,t,h)}
		case 1:
			return []Obstacle{rect(x,y,t,h),rect(x,y,w,t),rect(x,y+h-t,w,t)}
		case 2:
			return []Obstacle{rect(x,y+h-t,w,t),rect(x,y,t,h),rect(x+w-t,y,t,h)}
		default:
			return []Obstacle{rect(x+w-t,y,t,h),rect(x,y,w,t),rect(x,y+h-t,w,t)}
		}
	}
	return []Obstacle{rect(x,y,w,h)}
}
func newObstacles(theme string) []Obstacle { return newObstaclesSized(theme,W,H,2,"normal") }
func newObstaclesSized(theme string, width,height float64, players int, shrink string) []Obstacle {
 scale:=mapScale(players)
 spawnX,spawnY:=600.0*scale,380.0*scale
 if shrink=="instant" {spawnX,spawnY=145*scale,145*scale}
	kinds := map[string][]string{"shrine": {"stone", "gate", "pillar"}, "sakura": {"hedge", "fence", "lantern"}, "night": {"wall", "barrier", "crystal"}}[theme]
	if len(kinds) == 0 { kinds = []string{"wall", "barrier", "crystal"} }
	out := make([]Obstacle, 0, 60)
	// Keep comparable cover density as the world grows with players.
	groupsTarget:=int(math.Round(16*scale*scale))
	if groupsTarget<9 {groupsTarget=9}
	if groupsTarget>40 {groupsTarget=40}
	for groups, attempts := 0, 0; groups < groupsTarget && attempts < 3500; attempts++ {
		style := kinds[groups%len(kinds)]
		layout := ""
		switch groups%6 {
		case 1: layout = "L"
		case 3: layout = "T"
		case 5: layout = "U"
		}
		wid, hei := 110.0+mathrand.Float64()*125, 40.0+mathrand.Float64()*38
		if mathrand.Float64() < .52 {
			wid = 42 + mathrand.Float64()*40
			hei = 110 + mathrand.Float64()*140
		}
		if style == "pillar" || style == "lantern" || style == "crystal" {
			wid = 65 + mathrand.Float64()*23
			hei = wid
		}
		if layout != "" {
			wid = 175 + mathrand.Float64()*80
			hei = 165 + mathrand.Float64()*75
		}
		x := 105 + mathrand.Float64()*(width-wid-210)
		y := 105 + mathrand.Float64()*(height-hei-210)
		thickness := 43 + mathrand.Float64()*17
		parts := obstacleParts(layout,x,y,wid,hei,thickness,mathrand.Intn(4))
		blocked := false
		for _, part := range parts {
			if part.X < 65 || part.Y < 65 || part.X+part.W > width-65 || part.Y+part.H > height-65 ||
				circleRect(width/2,height/2,180*scale,part) {
				blocked = true
				break
			}
			// Reserve all spawn circles, not only the currently joined players.
			for index := 0; index < players && !blocked; index++ {
				angle := 2 * math.Pi * float64(index) / float64(players)
				px := width/2 + spawnX*math.Cos(angle)
				py := height/2 + spawnY*math.Sin(angle)
				if circleRect(px,py,55,part) { blocked = true }
			}
			for _, old := range out {
				if part.X < old.X+old.W+65 && part.X+part.W > old.X-65 &&
					part.Y < old.Y+old.H+65 && part.Y+part.H > old.Y-65 {
					blocked = true
					break
				}
			}
			if blocked { break }
		}
		if blocked { continue }
		expires := (43 + float64(groups)*4.6 + mathrand.Float64()*3) * 1000
		for _, part := range parts {
			part.Style = style
			part.Expires = expires
			out = append(out,part)
		}
		groups++
	}
	return out
}
func ultimateCost(id string) int {
 switch id {
 case "roman": return 320
 case "slow": return 275
 case "invincible","dance": return 280
 case "invisible": return 240
 case "namepu": return 160
 }
 return 0
}
func chooseUltimate(id string) string { if ultimateCost(id)>0 {return id}; return "roman" }
func ultimateLaunch(room *Room,p *Player,now float64) {
 if p.Ultimate=="roman" {p.UltimateWindupUntil=now+1;return}
 if p.Ultimate=="slow" {angle:=p.UltimateAim;room.Bullets=append(room.Bullets,Bullet{X:p.X,Y:p.Y,VX:math.Cos(angle)*610,VY:math.Sin(angle)*610,Damage:60,TTL:2.5,Owner:p.ID,Ch:"硬化弾",Special:"slow"})}
}
func slotCooldown(kind string, n int) float64 {
	switch kind {
	case "attack":
		return (.65 + float64(n)*.125 + math.Max(0, float64(n-10))*.02)*1.3 + math.Max(0, float64(n-20))*.055 + math.Max(0, float64(n-40))*.14
	case "defense":
		return (9 + float64(n)*.4) * 1.4
	case "heal":
		return (13 + float64(n)*.55) * 1.4
	case "pierce":
		return (7 + float64(n)*.45) * 1.4
	case "homing":
		return (4.5 + float64(n)*.42) * 1.4
	}
	return 10
}
func parseInput(value map[string]json.RawMessage, field string, dst any) {
	_ = json.Unmarshal(value[field], dst)
}
func (a *Arena) handle(c *Client, raw []byte) {
	var m map[string]json.RawMessage
	if len(raw) > 60000 || json.Unmarshal(raw, &m) != nil {
		return
	}
	var typ string
	parseInput(m, "type", &typ)
	a.mu.Lock()
	defer a.mu.Unlock()
	// "match" joins an open public lobby (oldest first) or creates one.
	// A public lobby never starts automatically; only its host can press Start.
	if (typ == "create" || typ == "join" || typ == "match") && c.room == nil {
		var room *Room
		createdRoom := false
		if typ == "match" {
			for _, candidate := range a.rooms {
				if candidate.Public && candidate.Mode == "normal" && candidate.Phase == "lobby" && len(candidate.Players) < 10 {
					if room == nil || candidate.Started.Before(room.Started) {
						room = candidate
					}
				}
			}
		}
		if typ == "create" || (typ == "match" && room == nil) {
			if len(a.rooms) >= maxRooms {
				c.message(map[string]string{"type": "error", "message": "ルーム数の上限に達しました"})
				return
			}
			var mode, theme, shrink string
			parseInput(m, "mode", &mode)
			parseInput(m, "theme", &theme)
			parseInput(m, "shrink", &shrink)
			if typ == "match" || mode != "custom" {
				mode = "normal"
			}
			if theme != "sakura" && theme != "night" && theme != "shrine" {
				theme = []string{"sakura", "night", "shrine"}[mathrand.Intn(3)]
			}
			if mode != "custom" {
				shrink = "normal"
			}
			switch shrink {
			case "slow", "normal", "fast", "none", "instant":
			default:
				shrink = "normal"
			}
			code := randomCode(6)
			for a.rooms[code] != nil {
				code = randomCode(6)
			}
			message := "参加者を待機中"
			if typ == "match" {
				message = "ランダムマッチ募集中（ホストが手動で試合開始）"
			}
			room = &Room{Code: code, Mode: mode, Theme: theme, Shrink: shrink, Phase: "lobby", Started: time.Now(), Public: typ == "match", Message: message, Obstacles: newObstacles(theme)}
			a.rooms[code] = room
			createdRoom = true
		} else if typ == "join" {
			var code string
			parseInput(m, "code", &code)
			room = a.find(strings.ToUpper(strings.TrimSpace(code)))
			if room == nil || room.Phase != "lobby" || len(room.Players) >= 10 {
				c.message(map[string]string{"type": "error", "message": "ルームが見つからない、試合中、または満員です"})
				return
			}
		}
		// A room can only be created or joined with a complete, valid five-slot loadout.
		// Validate here, not only in the separate legacy setup event, so direct
		// WebSocket clients cannot enter the waiting room with empty equipment.
		var slots []Slot
		var ch, ultimate string
		parseInput(m,"ultimate",&ultimate)
		parseInput(m, "slots", &slots)
		parseInput(m, "ch", &ch)
		if !validCharacter(ch) || !validSlots(slots, room.Mode == "custom") {
			if createdRoom {
				delete(a.rooms, room.Code)
			}
			c.message(map[string]string{"type": "error", "message": "5枠の武装文字をすべて設定してください"})
			return
		}
		var name string
		parseInput(m, "name", &name)
		name = strings.TrimSpace(name)
		if name == "" {
			name = "挑戦者"
		}
		rs := []rune(name)
		if len(rs) > 16 {
			name = string(rs[:16])
		}
		pid := randomCode(12)
		p := &Player{ID: pid, C: c, Name: name, Ch: ch, Slots: slots, Ready: true, X: W / 2, Y: H / 2, HP: 600, Alive: true, Keys: map[string]bool{}, GuardSlot: -1, Ultimate: chooseUltimate(ultimate)}
		c.room = room
		c.pid = pid
		room.Players = append(room.Players, p)
		if room.Host == "" {
			room.Host = pid
		}
		c.message(map[string]any{"type": "joined", "id": pid, "code": room.Code, "mode": room.Mode})
		room.broadcast()
		return
	}
	if c.room == nil {
		return
	}
	room := c.room
	p := a.byID(room, c.pid)
	if p == nil {
		return
	}
	switch typ {
	case "editing":
		if room.Phase != "lobby" { return }
		p.Ready = false
		room.broadcast()
	case "return-lobby":
		// The match is finished: keep connections, invites, host and the same room code.
		if room.Phase != "ended" { return }
		room.Phase = "lobby"
		room.StartedPlayers=0
		room.Winner = ""
		room.Message = "再戦の準備中（武装と必殺技を変更できます）"
		room.Bullets = nil
		for _, player := range room.Players {
			player.Fire = false
			player.CastPending = false
			player.Keys = map[string]bool{}
			player.Ready = true
		}
		room.broadcast()
	case "setup":
		if room.Phase != "lobby" {
			return
		}
		var slots []Slot
		var ch string
		parseInput(m, "slots", &slots)
		parseInput(m, "ch", &ch)
		if !validSlots(slots, room.Mode == "custom") || !validCharacter(ch) {
			c.message(map[string]string{"type": "error", "message": "装備データが不正です"})
			return
		}
		var ultimate string
		parseInput(m,"ultimate",&ultimate)
		p.Ultimate=chooseUltimate(ultimate)
		p.Ch = ch
		p.Slots = slots
		p.Ready = true
		room.broadcast()
	case "start":
		if c.pid != room.Host || room.Phase != "lobby" {
			return
		}
		if len(room.Players) < 2 {
			c.message(map[string]string{"type": "error", "message": "2人以上の参加が必要です"})
			return
		}
		for _, pp := range room.Players {
			if !pp.Ready {
				c.message(map[string]string{"type": "error", "message": "全員の準備完了が必要です"})
				return
			}
		}
		room.Phase = "countdown"
		room.StartedPlayers=len(room.Players)
		room.Message = "開始まで3秒"
		room.Started = time.Now().Add(3*time.Second)
		room.Bullets = nil
		room.Winner = ""
		room.DanceUntil=0
		worldW,worldH:=room.dimensions()
		factor:=mapScale(room.combatants())
		room.Obstacles=newObstaclesSized(room.Theme,worldW,worldH,len(room.Players),room.Shrink)
		for i, pp := range room.Players {
			angle := 2 * math.Pi * float64(i) / float64(len(room.Players))
			rx, ry := 600.0*factor, 380.0*factor
			if room.Shrink == "instant" {
				rx, ry = 145*factor, 145*factor // initial safe-zone radius scales too
			}
			pp.X = worldW/2 + rx*math.Cos(angle)
			pp.Y = worldH/2 + ry*math.Sin(angle)
			pp.HP = 600
			pp.Alive = true
			pp.Shield = 0
			pp.Last = [5]float64{}
			pp.GuardSlot = -1
			pp.Selected = 0
			pp.Casts = 0
			pp.Kills = 0
			pp.ActionSerial = 0
			pp.LastKind = ""
			pp.Fire = false
			pp.CastPending = false
			pp.PendingUntil = 0
			pp.UltimateCharge=0;pp.UltimateSpent=false;pp.UltimateAiming=false;pp.UltimateAim=0
			pp.UltimateAimUntil=0;pp.UltimateWindupUntil=0;pp.InvincibleUntil=0;pp.InvisibleUntil=0;pp.HardenedUntil=0;pp.NamepuUntil=0
			pp.UltimateSerial=0;pp.LastUltimate="";pp.NamepuUsed=false
		}
		room.broadcast()
	case "ultimate":
		if room.Phase!="playing" || !p.Alive || p.UltimateSpent || p.UltimateCharge < float64(ultimateCost(p.Ultimate)) {return}
		now:=float64(time.Now().UnixNano())/1e9
		if now<room.DanceUntil || now<p.HardenedUntil {return}
		p.UltimateSpent=true;p.UltimateAiming=false;p.UltimateSerial++;p.LastUltimate=p.Ultimate;p.Fire=false;p.CastPending=false
		switch p.Ultimate {
		case "roman","slow":p.UltimateAiming=true;p.UltimateAim=p.Aim;p.UltimateAimUntil=now+5
		case "invincible":p.InvincibleUntil=now+2.8
		case "dance":room.DanceUntil=now+2
		case "invisible":p.InvisibleUntil=now+4
		case "namepu":p.NamepuUntil=now+5.5;p.NamepuUsed=true
		}
		room.broadcast()
	case "ultimate-aim":
		if room.Phase!="playing" || !p.Alive || !p.UltimateAiming || float64(time.Now().UnixNano())/1e9<p.HardenedUntil {return}
		var angle float64
		parseInput(m,"aim",&angle)
		if math.IsNaN(angle)||math.IsInf(angle,0) {return}
		p.UltimateAim=angle;p.UltimateAiming=false
		ultimateLaunch(room,p,float64(time.Now().UnixNano())/1e9)
	case "cast":
		// Reliable one-shot cast: a quick mobile tap is not lost between 50ms input updates.
		if room.Phase != "playing" || !p.Alive { return }
		now:=float64(time.Now().UnixNano())/1e9
		if p.UltimateAiming || now<p.UltimateWindupUntil || now<p.NamepuUntil || now<room.DanceUntil || now<p.HardenedUntil {return}
		var selected int
		var castAim float64
		parseInput(m, "selected", &selected)
		parseInput(m, "aim", &castAim)
		if selected < 0 || selected >= len(p.Slots) || math.IsNaN(castAim) || math.IsInf(castAim, 0) { return }
		p.PendingSelected = selected
		p.PendingAim = castAim
		p.CastPending = true
		p.PendingUntil = float64(time.Now().UnixNano())/1e9 + 0.4
	case "input":
		if room.Phase != "playing" || !p.Alive {
			return
		}
		if time.Since(p.LastInput) < 10*time.Millisecond {
			return
		}
		p.LastInput = time.Now()
		var keys []string
		parseInput(m, "keys", &keys)
		p.Keys = map[string]bool{}
		for _, key := range keys {
			switch key {
			case "w", "a", "s", "d":
				p.Keys[key] = true
			}
		}
		parseInput(m, "aim", &p.Aim)
		if math.IsNaN(p.Aim) || math.IsInf(p.Aim, 0) {
			p.Aim = 0
		}
		parseInput(m, "fire", &p.Fire)
		parseInput(m, "selected", &p.Selected)
		if p.Selected < 0 {
			p.Selected = 0
		} else if p.Selected > 4 {
			p.Selected = 4
		}
	}
}
func (a *Arena) disconnected(c *Client) {
	a.mu.Lock()
	defer a.mu.Unlock()
	room := c.room
	if room == nil {
		return
	}
	newPlayers := make([]*Player, 0, len(room.Players))
	for _, p := range room.Players {
		if p.ID != c.pid {
			newPlayers = append(newPlayers, p)
		}
	}
	room.Players = newPlayers
	if room.Host == c.pid {
		room.Host = ""
		if len(newPlayers) > 0 {
			room.Host = newPlayers[0].ID
		}
	}
	if len(room.Players) == 0 {
		delete(a.rooms, room.Code)
	} else {
		if room.Phase == "playing" {
			alive := 0
			for _, p := range room.Players {
				if p.Alive {
					alive++
				}
			}
			if alive <= 1 {
				room.Phase = "ended"
				room.Winner = ""
				for _, p := range room.Players {
					if p.Alive {
						room.Winner = p.ID
					}
				}
			}
		}
		room.broadcast()
	}
	c.room = nil
	c.pid = ""
}
func circleRect(x, y, rad float64, o Obstacle) bool {
	px := bound(x, o.X, o.X+o.W)
	py := bound(y, o.Y, o.Y+o.H)
	return (x-px)*(x-px)+(y-py)*(y-py) < rad*rad
}
func hit(p *Player, damage float64, pierce bool, now float64) {
	if !p.Alive || now<p.InvincibleUntil {
		return
	}
	if !pierce && now < p.ShieldUntil {
		absorbed := math.Min(p.Shield, damage)
		p.Shield -= absorbed
		damage -= absorbed
	}
	p.HP = math.Max(0, p.HP-damage)
	if p.HP <= 0 {
		p.Alive = false
	}
}
// The server alone decides when a knock-out earns a player a kill.
// Environmental deaths and already-dead targets never award credit.
func hitFromBullet(room *Room, target *Player, bullet Bullet, now float64) {
 wasAlive:=target.Alive
 if bullet.Special=="roman" { // A landed Roman Cannon instantly defeats every non-invincible player, regardless of shield.
  hit(target,target.HP,true,now)
 } else {hit(target,bullet.Damage,bullet.Pierce || bullet.Special=="slow",now)}
 if wasAlive && !target.Alive && bullet.Owner!=target.ID {
  for _,p:=range room.Players {if p.ID==bullet.Owner {p.Kills++;break}}
 }
}
func (a *Arena) tick(dt float64) {
	a.mu.Lock()
	defer a.mu.Unlock()
	now := float64(time.Now().UnixNano()) / 1e9
	for _, room := range a.rooms {
		if room.Phase=="countdown" {
		 if !time.Now().Before(room.Started) {room.Phase="playing";room.Message="戦闘開始"}
		 room.broadcast()
		 continue
		}
		if room.Phase != "playing" {
			continue
		}
		zone := room.zone()
		radius := zone["r"]
		worldW,worldH:=room.dimensions()
		obs := make([]Obstacle, 0, len(room.Obstacles))
		for _, o := range room.Obstacles {
			if room.elapsed() < o.Expires {
				obs = append(obs, o)
			}
		}
		for _, p := range room.Players {
			if !p.Alive {continue}
			if p.UltimateAiming && now>=p.UltimateAimUntil && now>=p.HardenedUntil {p.UltimateAiming=false;ultimateLaunch(room,p,now)}
			if p.UltimateWindupUntil>0 && now>=p.UltimateWindupUntil && now>=p.HardenedUntil {
				angle:=p.UltimateAim
				room.Bullets=append(room.Bullets,Bullet{X:p.X,Y:p.Y,VX:math.Cos(angle)*590,VY:math.Sin(angle)*590,Damage:600,TTL:2.8,Owner:p.ID,Ch:"ロマン砲",Special:"roman"})
				p.UltimateWindupUntil=0
			}
			dx, dy := 0.0, 0.0
			if p.Keys["d"] {
				dx++
			}
			if p.Keys["a"] {
				dx--
			}
			if p.Keys["s"] {
				dy++
			}
			if p.Keys["w"] {
				dy--
			}
			if now<room.DanceUntil || now<p.NamepuUntil || now<p.HardenedUntil || (p.UltimateWindupUntil>0 && now<p.UltimateWindupUntil) {dx=0;dy=0}
			mag := math.Hypot(dx, dy)
			if mag == 0 {
				mag = 1
			}
			speed:=215.0
			// Hardened players cannot move; no movement-speed multiplier remains.
			nx := bound(p.X+dx/mag*speed*dt, 22, worldW-22)
			collide := false
			for _, o := range obs {
				if circleRect(nx, p.Y, 20, o) {
					collide = true
					break
				}
			}
			if !collide {
				p.X = nx
			}
			ny := bound(p.Y+dy/mag*speed*dt, 22, worldH-22)
			collide = false
			for _, o := range obs {
				if circleRect(p.X, ny, 20, o) {
					collide = true
					break
				}
			}
			if !collide {
				p.Y = ny
			}
			if now>=room.DanceUntil && dist(p.X, p.Y, worldW/2, worldH/2) > radius {
				hit(p, 32*dt, true, now)
			}
			// Keep a one-shot tap for the final 400ms of cooldown.
			// Input packets must not overwrite its slot or aim.
			castNow := p.CastPending && now <= p.PendingUntil
			if p.CastPending && !castNow {
				p.CastPending = false
			}
			castSelected, castAim := p.Selected, p.Aim
			if castNow {
				castSelected, castAim = p.PendingSelected, p.PendingAim
			}
			if !p.Alive || now<p.NamepuUntil || now<room.DanceUntil || now<p.UltimateWindupUntil || now<p.HardenedUntil || p.UltimateAiming || (!p.Fire && !castNow) || len(p.Slots) != 5 {
				continue
			}
			if castSelected < 0 || castSelected >= len(p.Slots) {
				p.CastPending = false
				continue
			}
			if now < p.Last[castSelected] {
				continue
			}
			if castNow {
				p.Selected, p.Aim = castSelected, castAim
				p.CastPending = false
			}
			slot := p.Slots[castSelected]
			kind, n := slot.Kind, slot.N
			switch kind {
			case "attack", "pierce", "homing":
				speed := 420.0
				if kind == "pierce" {
					speed = 480
				} else if kind == "homing" {
					speed = 350
				}
				a := p.Aim
				room.Bullets = append(room.Bullets, Bullet{X: p.X, Y: p.Y, VX: math.Cos(a) * speed, VY: math.Sin(a) * speed, Damage: float64(n * 6), TTL: 2.1, Owner: p.ID, Ch: slot.Ch, Pierce: kind == "pierce", Homing: kind == "homing"})
				if kind == "homing" {
					room.Bullets[len(room.Bullets)-1].TTL = 4.8
				}
			case "defense":
				p.Shield = float64(n * 6)
				p.ShieldUntil = now + 1.8
				p.GuardSlot = p.Selected
			case "heal":
				p.HP = math.Min(600, p.HP+float64(n*4))
			}
			p.Last[castSelected] = now + slotCooldown(kind, n)
			p.Casts++
			p.UltimateCharge=math.Min(float64(ultimateCost(p.Ultimate)),p.UltimateCharge+float64(n))
			if now<p.InvisibleUntil {p.InvisibleUntil=0}
			p.ActionSerial++
			p.LastKind = kind
		}
		newBullets := make([]Bullet, 0, len(room.Bullets))
		for _, b := range room.Bullets {
			if b.Homing {
				var target *Player
				best := math.MaxFloat64
				for _, p := range room.Players {
					if p.ID == b.Owner || !p.Alive || now<p.InvisibleUntil {
						continue
					}
					d := (p.X-b.X)*(p.X-b.X) + (p.Y-b.Y)*(p.Y-b.Y)
					if d < best {
						best = d
						target = p
					}
				}
				if target != nil {
					old := math.Atan2(b.VY, b.VX)
					wanted := math.Atan2(target.Y-b.Y, target.X-b.X)
					delta := math.Atan2(math.Sin(wanted-old), math.Cos(wanted-old))
					angle := old + bound(delta, -3.6*dt, 3.6*dt)
					b.VX = 350 * math.Cos(angle)
					b.VY = 350 * math.Sin(angle)
				}
			}
			b.X += b.VX * dt
			b.Y += b.VY * dt
			b.TTL -= dt
			if b.TTL <= 0 || b.X < 0 || b.X > worldW || b.Y < 0 || b.Y > worldH {
				continue
			}
			if !b.Pierce {
				collide := false
				for _, o := range obs {
					if circleRect(b.X, b.Y, 7, o) {
						collide = true
						break
					}
				}
				if collide {
					continue
				}
			}
			struck := false
			for _, p := range room.Players {
				if p.ID != b.Owner && p.Alive && dist(p.X, p.Y, b.X, b.Y) < func() float64 { if b.Special=="roman" { return 43 }; return 30 }() {
					protected := now<p.InvincibleUntil || now<room.DanceUntil
					if now>=room.DanceUntil {hitFromBullet(room,p,b,now)}
					if b.Special=="slow" && !protected {p.HardenedUntil=now+3;p.Fire=false;p.CastPending=false}
					struck = true
					break
				}
			}
			if !struck {
				newBullets = append(newBullets, b)
			}
		}
		if len(newBullets) > 400 {
			newBullets = newBullets[len(newBullets)-400:]
		}
		room.Bullets = newBullets
		alive := 0
		winner := ""
		for _, p := range room.Players {
			if p.Alive {
				alive++
				winner = p.ID
			}
		}
		if alive <= 1 {
			room.Phase = "ended"
			room.Winner = winner
			room.Message = "勝者決定"
		}
		room.broadcast()
	}
}
func (a *Arena) simulation(ctx context.Context) {
	ticker := time.NewTicker(time.Second / 30)
	defer ticker.Stop()
	last := time.Now()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			now := time.Now()
			dt := bound(now.Sub(last).Seconds(), 0, .065)
			last = now
			a.tick(dt)
		}
	}
}

// WebSocket server, RFC6455, with no external runtime or dependencies.
func websocketKey(key string) string {
	h := sha1.Sum([]byte(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"))
	return base64.StdEncoding.EncodeToString(h[:])
}
func (c *Client) writeFrame(op byte, payload []byte) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	if len(payload) > 0x7fffffff {
		return errors.New("frame exceeds limit")
	}
	header := []byte{0x80 | op, 0}
	if len(payload) < 126 {
		header[1] = byte(len(payload))
	} else if len(payload) < 65536 {
		header[1] = 126
		header = append(header, byte(len(payload)>>8), byte(len(payload)))
	} else {
		header[1] = 127
		wide := make([]byte, 8)
		binary.BigEndian.PutUint64(wide, uint64(len(payload)))
		header = append(header, wide...)
	}
	_ = c.conn.SetWriteDeadline(time.Now().Add(4 * time.Second))
	if _, e := c.conn.Write(append(header, payload...)); e != nil {
		return e
	}
	return nil
}
func (c *Client) writer() {
	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-c.done:
			return
		case <-ticker.C:
			if e := c.writeFrame(0x9, []byte("moji")); e != nil {
				_ = c.conn.Close()
				return
			}
		case data := <-c.send:
			if e := c.writeFrame(1, data); e != nil {
				_ = c.conn.Close()
				return
			}
		}
	}
}
func (c *Client) reader() error {
	for {
		_ = c.conn.SetReadDeadline(time.Now().Add(120 * time.Second))
		a, e := c.read.ReadByte()
		if e != nil {
			return e
		}
		b, e := c.read.ReadByte()
		if e != nil {
			return e
		}
		op := a & 0x0f
		masked := b&0x80 != 0
		size := uint64(b & 0x7f)
		if size == 126 {
			two := make([]byte, 2)
			if _, e = io.ReadFull(c.read, two); e != nil {
				return e
			}
			size = uint64(binary.BigEndian.Uint16(two))
		}
		if size == 127 {
			eight := make([]byte, 8)
			if _, e = io.ReadFull(c.read, eight); e != nil {
				return e
			}
			size = binary.BigEndian.Uint64(eight)
		}
		if !masked || size > 60000 {
			return errors.New("client frame invalid or oversized")
		}
		var mask [4]byte
		if _, e = io.ReadFull(c.read, mask[:]); e != nil {
			return e
		}
		payload := make([]byte, size)
		if _, e = io.ReadFull(c.read, payload); e != nil {
			return e
		}
		for i := range payload {
			payload[i] ^= mask[i%4]
		}
		switch op {
		case 0x1:
			arena.handle(c, payload)
		case 0x8:
			return io.EOF
		case 0x9:
			_ = c.writeFrame(0xa, payload)
		case 0xa:
		default:
			if op != 0 {
				return errors.New("unsupported websocket opcode")
			}
		}
	}
}
func websocketHandler(w http.ResponseWriter, r *http.Request) {
	// Browsers on an unrelated website should not be able to create rooms here.
	if origin := r.Header.Get("Origin"); origin != "" {
		parsed, err := url.Parse(origin)
		if err != nil || (!strings.EqualFold(parsed.Host, r.Host) && !strings.EqualFold(parsed.Host, r.Header.Get("X-Forwarded-Host"))) || (parsed.Scheme != "https" && parsed.Scheme != "http") {
			http.Error(w, "WebSocket origin not allowed", http.StatusForbidden)
			return
		}
	}
	if !strings.EqualFold(r.Header.Get("Upgrade"), "websocket") || !strings.Contains(strings.ToLower(r.Header.Get("Connection")), "upgrade") || r.Header.Get("Sec-WebSocket-Key") == "" {
		http.Error(w, "WebSocket upgrade required", 400)
		return
	}
	if r.Method != "GET" {
		http.Error(w, "method not allowed", 405)
		return
	}
	h, ok := w.(http.Hijacker)
	if !ok {
		http.Error(w, "upgrade unsupported", 500)
		return
	}
	conn, rw, e := h.Hijack()
	if e != nil {
		return
	}
	_, e = rw.WriteString("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + websocketKey(r.Header.Get("Sec-WebSocket-Key")) + "\r\n\r\n")
	if e == nil {
		e = rw.Flush()
	}
	if e != nil {
		_ = conn.Close()
		return
	}
	c := &Client{conn: conn, read: rw.Reader, send: make(chan []byte, 4), done: make(chan struct{})}
	go c.writer()
	_ = c.reader()
	arena.disconnected(c)
	c.once.Do(func() { close(c.done) })
	_ = conn.Close()
}
func getLANIP() string {
	c, e := net.DialTimeout("udp", "192.0.2.1:80", 150*time.Millisecond)
	if e != nil {
		return ""
	}
	defer c.Close()
	addr := c.LocalAddr().(*net.UDPAddr)
	if addr.IP.IsLoopback() {
		return ""
	}
	return addr.IP.String()
}
func browserOpen(url string) {
	switch runtime.GOOS {
	case "windows":
		_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		_ = exec.Command("open", url).Start()
	default:
		_ = exec.Command("xdg-open", url).Start()
	}
}
func getPort(listener net.Listener) int {
	_, part, _ := net.SplitHostPort(listener.Addr().String())
	n, _ := strconv.Atoi(part)
	return n
}
// The legacy CPU lobby is an embedded large HTML page. Inject small shared fixes
// on the server so the same improvements reach / and /index.html without rewriting
// the original multi-megabyte single-file game or losing existing assets.
func mobilePatchedIndex(source string) string {
	const additions = `<link rel="stylesheet" href="/mobile-input-v70.css?v=77"><link rel="stylesheet" href="/ultimate-ui.css?v=82"><script defer src="/mobile-input-v70.js?v=77"></script><script defer src="/ultimate-core.js?v=85"></script><script defer src="/ultimate-cpu.js?v=85"></script><script defer src="/arena-expansion-v72.js?v=80"></script><script defer src="/cpu-battle-v78.js?v=85"></script><script defer src="/mobile-orientation-v80.js?v=83"></script><link rel="stylesheet" href="/mobile-orientation-v80.css?v=80"><link rel="stylesheet" href="/ui-polish-v74.css?v=77"><link rel="stylesheet" href="/cpu-battle-v78.css?v=81">`
	// Four large mode tiles are the ONLY visible mode selector.
	// Retain the original <select> for legacy event handlers and logic; hide its
	// containing field so the mode isn't offered twice. The map dropdown stays visible.
	source = strings.Replace(source,
		`<div class="setting"><label class="label" for="modeSelect">対戦モード</label><select id="modeSelect">`,
		`<div class="setting" id="legacyModeSelector" hidden aria-hidden="true" style="display:none!important"><label class="label" for="modeSelect">対戦モード</label><select id="modeSelect">`, 1)
	// Match CPU normal/custom attack cooldowns to the authoritative online server.
	// Attack CT rises slightly for ordinary characters, with extra escalation after 20 and 40 strokes.
	// Keep stroke values authoritative and avoid fake 12-stroke fallback.
	source = strings.ReplaceAll(source, "n>40", "n>84")
	source = strings.ReplaceAll(source, "max=\"40\"", "max=\"84\"")
	source = strings.ReplaceAll(source, "画数は1〜40", "画数は1〜84")
	source = strings.ReplaceAll(source, "画数1〜40", "画数1〜84")
	source = strings.Replace(source, `if(/\p{Script=Han}/u.test(ch))return 12; // fallback only for unregistered ideographs`,
		`if(/\p{Script=Han}/u.test(ch))return null; // unknown ideographs have no invented value`, 1)
	source = strings.Replace(source, "bgmAudio.volume=.24", "bgmAudio.volume=.10", 1)
	// The original HTML only embeds a small demonstration dictionary. Merge the
	// complete Unihan-based table before any match, then refresh equipped values.
	strokeLoader := `Object.assign(dict, {'イ':2,'ー':1});
if(window.MojiRandom)window.MojiRandom.strokeMap=dict;
window.MojiStrokeReady=Promise.all([
 fetch('/strokes.json').then(r=>{if(!r.ok)throw Error('stroke dictionary unavailable');return r.json()}),
 fetch('/kana-strokes.json').then(r=>{if(!r.ok)throw Error('kana stroke dictionary unavailable');return r.json()})
]).then(([map,kana])=>{
 Object.assign(dict,map,kana);
 if(window.MojiRandom){
   window.MojiRandom.strokeMap=dict;
   window.MojiRandom.invalidateStrokePool?.();
   const oldRoll=window.MojiRandom.roll;
   window.MojiRandom.roll=function(exclude){
    for(let attempt=0;attempt<80;attempt++){
     const ch=oldRoll(exclude);
     if(!/\p{Script=Han}/u.test(ch)||Number.isInteger(dict[ch]))return ch;
    }
    return '火';
   };
 }
 if(typeof updateMode==='function')updateMode();
 if(typeof refreshLobbyStats==='function')refreshLobbyStats();
 return true;
}).catch(err=>{console.warn('画数辞書の取得に失敗',err);return false;});`
	source = strings.Replace(source, "if(window.MojiRandom)window.MojiRandom.strokeMap=dict;", strokeLoader, 1)
	// Both CPU modes use the exact same cooldown curve as the server.
	source = strings.Replace(source, "attack:Math.max(.65,.65+n*.125)", "attack:1.3*Math.max(.65,.65+n*.125+Math.max(0,n-10)*.02)+Math.max(0,n-20)*.055+Math.max(0,n-40)*.14", 1)
	for _, pair := range [][2]string{
		{"defense:9+n*.4", "defense:1.4*(9+n*.4)"},
		{"heal:13+n*.55", "heal:1.4*(13+n*.55)"},
		{"pierce:7+n*.45", "pierce:1.4*(7+n*.45)"},
		{"homing:4.5+n*.42", "homing:1.4*(4.5+n*.42)"},
	} {
		source = strings.Replace(source, pair[0], pair[1], 1)
	}
	// Keep the large legacy CPU game in sync with the shared arena dimensions.
	// Numeric word boundaries avoid touching dates, CSS units and encoded assets.
	source = strings.Replace(source, "cpuView.w=aspect<1?670:1130", "cpuView.w=aspect<1?730:1250", 1)
	source = regexp.MustCompile(`\b1800\b`).ReplaceAllString(source, "2300")
	source = regexp.MustCompile(`\b1050\b`).ReplaceAllString(source, "1300")
	// Permit solo CPU round dimensions to change with selected CPU count.
	source = strings.Replace(source, "const WORLD_W=2300,WORLD_H=1300;", "let WORLD_W=2300,WORLD_H=1300;", 1)
	// Match solo cover density to the variable-size world (9 walls at 2 fighters, 32 at 10).
	source = strings.Replace(source, "while(result.length<14&&attempts++<1300)", "while(result.length<Math.max(9,Math.min(40,Math.round(14*(window.MojiBattleMap?.scale||1)**2)))&&attempts++<1900)", 1)
	// Rendering and minimap must use the scaled world center, not the old fixed center.
	for _,coords := range [][2]string{
	 {"ctx.moveTo(900+zoneRadius,525)","ctx.moveTo(WORLD_W/2+zoneRadius,WORLD_H/2)"},
	 {"ctx.arc(900,525,zoneRadius","ctx.arc(WORLD_W/2,WORLD_H/2,zoneRadius"},
	 {"(900+zoneRadius)/WORLD_W","(WORLD_W/2+zoneRadius)/WORLD_W"},
	 {"900/WORLD_W","(WORLD_W/2)/WORLD_W"},
	 {"525/WORLD_H","(WORLD_H/2)/WORLD_H"},
	 {"crest(900,525,170","crest(WORLD_W/2,WORLD_H/2,170"},
	 {"crest(240,190,82","crest(WORLD_W*.14,WORLD_H*.18,82"},
	 {"crest(1560,845,92","crest(WORLD_W*.87,WORLD_H*.82,92"},
	} {source = strings.ReplaceAll(source,coords[0],coords[1])}


	// Keep CPU spawn and collision-safe obstacle generation centered in the
	// expanded arena. The large CPU HTML contains these legacy literals.
	source = regexp.MustCompile(`\b1150\b`).ReplaceAllString(source, "1350")
	source = strings.ReplaceAll(source, "player={x:650,y:520", "player={x:825,y:650")
	source = strings.ReplaceAll(source, "enemy={x:1160,y:520", "enemy={x:1475,y:650")
	source = strings.ReplaceAll(source, "near(650,520)||near(1160,520)", "near(825,650)||near(1475,650)")
	// The multiplayer battle lives in an iframe inside the CPU lobby. CSS inside
	// the iframe cannot expand its parent's old lobby-sized frame: expand it at the
	// parent level while a match is playing, then restore the exact prior styles.
	const fullscreenBridge = `<script>
(function(){
 let active=null;
 window.addEventListener('message',function(event){
  if(event.origin!==location.origin||event.data?.type!=='moji:embeddedBattle')return;
  const frame=Array.from(document.querySelectorAll('iframe')).find(f=>f.contentWindow===event.source && /multiplayer\.html/.test(f.src));
  if(!frame)return;
  if(event.data.active){
   if(active&&active.frame===frame)return;
   if(active)return;
   const ancestors=[];for(let el=frame.parentElement;el&&el!==document.body;el=el.parentElement){ancestors.push([el,el.style.cssText]);
    el.style.overflow='visible';el.style.transform='none';el.style.filter='none';el.style.contain='none';el.style.clipPath='none';el.style.isolation='auto';}
   active={frame,css:frame.style.cssText,body:document.body.style.overflow,html:document.documentElement.style.overflow,ancestors};
   frame.style.cssText+=';position:fixed!important;inset:0!important;top:0!important;left:0!important;width:100vw!important;height:100dvh!important;max-width:none!important;max-height:none!important;min-width:0!important;min-height:0!important;z-index:2147483000!important;border:0!important;border-radius:0!important;display:block!important;background:#091426!important;';
   document.body.style.overflow='hidden';document.documentElement.style.overflow='hidden';
  } else if(active&&active.frame===frame){
   active.frame.style.cssText=active.css;
   for(const [el,css] of active.ancestors)el.style.cssText=css;
   document.body.style.overflow=active.body;document.documentElement.style.overflow=active.html;
   active=null;
  }
 });
})();
</script>`
	// Omit dead first CPU from the original one-opponent renderer.
	source = strings.Replace(source, "drawMarker(player,avatarChar,false);drawMarker(enemy,'敵',true);", "drawMarker(player,avatarChar,false);if(enemy.hp>0)drawMarker(enemy,'敵',true);", 1)
	source = strings.Replace(source, "miniIcon(mx+player.x/WORLD_W*mw,my+player.y/WORLD_H*mh,'#78c2ff');miniIcon(mx+enemy.x/WORLD_W*mw,my+enemy.y/WORLD_H*mh,'#ff8598');", "miniIcon(mx+player.x/WORLD_W*mw,my+player.y/WORLD_H*mh,'#78c2ff');if(enemy.hp>0)miniIcon(mx+enemy.x/WORLD_W*mw,my+enemy.y/WORLD_H*mh,'#ff8598');", 1)
	return strings.Replace(source, "</head>", additions+fullscreenBridge+"</head>", 1)
}
func main() {
	var internet, noBrowser bool
	var port int
	flag.BoolVar(&internet, "internet", defaultInternetMode == "true", "Expose via a temporary Cloudflare Quick Tunnel URL")
	flag.BoolVar(&noBrowser, "no-browser", false, "Do not open the browser automatically")
	flag.IntVar(&port, "port", 8000, "HTTP/WebSocket port (0 for any free port)")
	flag.Parse()
	if env := os.Getenv("PORT"); env != "" && port == 8000 {
		if n, e := strconv.Atoi(env); e == nil {
			port = n
		}
	}
	listener, e := net.Listen("tcp", fmt.Sprintf("0.0.0.0:%d", port))
	if e != nil && os.Getenv("PORT") == "" {
		log.Printf("ポート %d が使用中: %v。空きポートを試します。", port, e)
		listener, e = net.Listen("tcp", "0.0.0.0:0")
	}
	if e != nil {
		log.Fatal("サーバーの起動に失敗しました:", e)
	}
	actual := getPort(listener)
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	go arena.simulation(ctx)
	files, e := fs.Sub(gameFiles, "public")
	if e != nil {
		log.Fatal(e)
	}
	originalIndex, e := gameFiles.ReadFile("public/index.html")
	if e != nil { log.Fatal("CPU lobby could not load:", e) }
	mobileIndex := mobilePatchedIndex(string(originalIndex))
	if mobileIndex == string(originalIndex) { log.Fatal("CPU lobby HTML has no </head> injection point") }
	mux := http.NewServeMux()
	mux.Handle("/ws", http.HandlerFunc(websocketHandler))
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		arena.mu.Lock()
		count := len(arena.rooms)
		arena.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "name": "文字武装", "version": "7.8", "rooms": count})
	})
	mux.HandleFunc("/lan", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"ip": getLANIP()})
	})
	mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" || r.URL.Path == "/index.html" {
			w.Header().Set("Cache-Control", "no-cache")
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			http.ServeContent(w, r, "index.html", time.Time{}, strings.NewReader(mobileIndex))
			return
		}
		if strings.HasSuffix(r.URL.Path, ".html") || strings.HasSuffix(r.URL.Path, ".css") || strings.HasSuffix(r.URL.Path, ".js") {
			// A stale UI bundle leaves the online arena visually unchanged after deployment.
			w.Header().Set("Cache-Control", "no-cache, must-revalidate")
		}
		http.FileServer(http.FS(files)).ServeHTTP(w, r)
	}))
	srv := &http.Server{Handler: mux, ReadHeaderTimeout: 8 * time.Second}
	go func() {
		if e := srv.Serve(listener); e != nil && e != http.ErrServerClosed {
			log.Print("サーバー停止:", e)
		}
	}()
	localURL := fmt.Sprintf("http://127.0.0.1:%d/", actual)
	fmt.Println("\n===============================================")
	fmt.Println("  文字武装 v7.4 / Python不要")
	fmt.Println("  ローカル: " + localURL)
	fmt.Println("  ルーム作成後に招待リンクをコピーしてください。")
	fmt.Print("===============================================\n\n")
	if internet {
		tunnelURL, e := startTunnel(ctx, actual)
		if e != nil {
			log.Println("公開URL発行失敗:", e, "\nローカル対戦は引き続き利用できます。")
			if !noBrowser {
				browserOpen(localURL)
			}
		} else {
			fmt.Println("\n★ 別Wi-Fi用の公開ゲームURL: " + tunnelURL + "\n★ 友達にはゲーム内の招待リンクを送ります。\n★ このウィンドウを閉じると公開終了です。\n")
			if !noBrowser {
				browserOpen(tunnelURL)
			}
		}
	} else if !noBrowser {
		browserOpen(localURL)
	}
	// Keep the browser server and optional tunnel alive until Ctrl+C or console close.
	<-ctx.Done()
	_ = srv.Shutdown(context.Background())
}

// Tunnel launch is implemented in tunnel.go. The game itself never requires Python.
var _ = filepath.Separator
var defaultInternetMode = "false"
