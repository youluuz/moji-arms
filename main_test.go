package main

import (
	"math"
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
