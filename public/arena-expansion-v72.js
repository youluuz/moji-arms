/* v7.2: CPU normal/custom - compose L-shaped cover from existing wall rectangles.
   Each extra arm uses the legacy wall renderer and collision checks unchanged. */
(function () {
  'use strict';
  const marked = new WeakSet();
  const WORLD_W = 2100, WORLD_H = 1200, MAX_CORNERS = 3;
  function circleTouchesRect(px, py, radius, o) {
    const nearestX = Math.max(o.x, Math.min(px, o.x + o.w));
    const nearestY = Math.max(o.y, Math.min(py, o.y + o.h));
    return (px - nearestX) ** 2 + (py - nearestY) ** 2 < radius ** 2;
  }
  function canPlace(arm, original, walls) {
    if (arm.x < 65 || arm.y < 65 || arm.x + arm.w > WORLD_W - 65 || arm.y + arm.h > WORLD_H - 65) return false;
    if (circleTouchesRect(WORLD_W / 2, WORLD_H / 2, 235, arm)) return false;
    for (let count = 2; count <= 10; count++) {
      for (let i = 0; i < count; i++) {
        const a = Math.PI * 2 * i / count;
        if (circleTouchesRect(WORLD_W / 2 + 360 * Math.cos(a), WORLD_H / 2 + 290 * Math.sin(a), 40, arm)) return false;
      }
    }
    for (const other of walls) {
      if (other === original || other.__arenaLArm) continue;
      if (arm.x < other.x + other.w + 25 && arm.x + arm.w > other.x - 25 &&
          arm.y < other.y + other.h + 25 && arm.y + arm.h > other.y - 25) return false;
    }
    // Don't grow a wall over a moving fighter when a round is already running.
    if (typeof player !== 'undefined' && player && Number.isFinite(player.x) &&
        circleTouchesRect(player.x, player.y, 43, arm)) return false;
    if (typeof enemy !== 'undefined' && enemy && Number.isFinite(enemy.x) &&
        circleTouchesRect(enemy.x, enemy.y, 43, arm)) return false;
    if (typeof enemies !== 'undefined' && Array.isArray(enemies)) {
      for (const e of enemies) if (e && Number.isFinite(e.x) && circleTouchesRect(e.x, e.y, 43, arm)) return false;
    }
    return true;
  }
  function makeArm(wall, rotation) {
    const horizontal = wall.w > wall.h * 1.55;
    const vertical = wall.h > wall.w * 1.55;
    if (!horizontal && !vertical) return null;
    const thickness = Math.max(30, Math.min(58, horizontal ? wall.h * .85 : wall.w * .85));
    if (horizontal) {
      const right = (rotation & 1) === 1, down = (rotation & 2) === 2;
      return {
        x: right ? wall.x + wall.w - thickness : wall.x,
        y: down ? wall.y + wall.h * .45 : wall.y - 125,
        w: thickness, h: 125 + wall.h * .55
      };
    }
    const bottom = (rotation & 1) === 1, right = (rotation & 2) === 2;
    return {
      x: right ? wall.x + wall.w * .45 : wall.x - 125,
      y: bottom ? wall.y + wall.h - thickness : wall.y,
      w: 125 + wall.w * .55, h: thickness
    };
  }
  function applyCorners() {
    if (typeof running === 'undefined' || !running ||
        typeof obstacles === 'undefined' || !Array.isArray(obstacles)) return;
    const walls = obstacles;
    if (walls.length > 42) return;
    let corners = walls.filter(o => o && o.__arenaLArm).length;
    for (const wall of walls.slice(0, 20)) {
      if (corners >= MAX_CORNERS) break;
      if (!wall || typeof wall !== 'object' || marked.has(wall) || wall.__arenaLArm) continue;
      marked.add(wall);
      if (![wall.x, wall.y, wall.w, wall.h].every(Number.isFinite)) continue;
      if (Math.max(wall.w, wall.h) < 125) continue;
      for (let rot = 0; rot < 4; rot++) {
        const arm = makeArm(wall, rot);
        if (!arm || !canPlace(arm, wall, walls)) continue;
        const extended = { ...wall, ...arm, __arenaLArm: true };
        if (Object.prototype.hasOwnProperty.call(extended, 'id')) extended.id = String(extended.id) + '-L';
        walls.push(extended);
        corners++;
        break;
      }
    }
  }
  function frame() {
    try { applyCorners(); } catch (_) { /* Never interrupt attacks or rendering. */ }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();