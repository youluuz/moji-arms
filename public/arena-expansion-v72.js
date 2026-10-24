/* v7.3 CPU normal/custom arena: safely compose L-, T- and U-shaped
 * cover from existing wall rectangles. Legacy collision, expiry and rendering
 * continue to work because each arm is an ordinary obstacle rectangle.
 */
(function () {
  'use strict';
  const worldW=()=>window.MojiBattleMap?.w||2300, worldH=()=>window.MojiBattleMap?.h||1300;
  const scanned = new WeakSet();
  const installed = new WeakSet();
  function touches(x, y, radius, rect) {
    const nearestX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
    const nearestY = Math.max(rect.y, Math.min(y, rect.y + rect.h));
    return (x-nearestX)**2 + (y-nearestY)**2 < radius**2;
  }
  function playersSafe(rect) {
    if (typeof player !== 'undefined' && player &&
        Number.isFinite(player.x) && touches(player.x,player.y,43,rect)) return false;
    if (typeof enemy !== 'undefined' && enemy &&
        Number.isFinite(enemy.x) && touches(enemy.x,enemy.y,43,rect)) return false;
    if (typeof enemies !== 'undefined' && Array.isArray(enemies)) {
      for (const p of enemies) {
        if (p && Number.isFinite(p.x) && touches(p.x,p.y,43,rect)) return false;
      }
    }
    return true;
  }
  function canPlace(arm, original, walls) {
    if (arm.x < 65 || arm.y < 65 ||
        arm.x+arm.w > worldW()-65 || arm.y+arm.h > worldH()-65) return false;
    if (touches(worldW()/2,worldH()/2,235,arm)) return false;
    for (let count=2;count<=10;count++) {
      for (let i=0;i<count;i++) {
        const a=Math.PI*2*i/count;
        if (touches(worldW()/2+360*Math.cos(a),
                    worldH()/2+290*Math.sin(a),40,arm)) return false;
      }
    }
    for (const wall of walls) {
      if (wall===original) continue; // a shaped arm intentionally joins its bar
      if (arm.x<wall.x+wall.w+25 && arm.x+arm.w>wall.x-25 &&
          arm.y<wall.y+wall.h+25 && arm.y+arm.h>wall.y-25) return false;
    }
    return playersSafe(arm);
  }
  function makeArms(wall, shape, rotation) {
    const horizontal=wall.w>wall.h*1.55;
    const vertical=wall.h>wall.w*1.55;
    if (!horizontal && !vertical) return [];
    const thickness=Math.max(30,Math.min(58,(horizontal?wall.h:wall.w)*.84));
    const reach=105;
    const arms=[];
    if (horizontal) {
      const towardsDown=(rotation&1)===1;
      const y=towardsDown?wall.y:wall.y-reach;
      const h=wall.h+reach;
      const add=x=>arms.push({x,y,w:thickness,h});
      if (shape==='L') add((rotation&2)?wall.x+wall.w-thickness:wall.x);
      if (shape==='T') add(wall.x+(wall.w-thickness)/2);
      if (shape==='U') {add(wall.x);add(wall.x+wall.w-thickness);}
    } else {
      const towardsRight=(rotation&1)===1;
      const x=towardsRight?wall.x:wall.x-reach;
      const w=wall.w+reach;
      const add=y=>arms.push({x,y,w,h:thickness});
      if (shape==='L') add((rotation&2)?wall.y+wall.h-thickness:wall.y);
      if (shape==='T') add(wall.y+(wall.h-thickness)/2);
      if (shape==='U') {add(wall.y);add(wall.y+wall.h-thickness);}
    }
    return arms;
  }
  function applyShapes() {
    if (typeof running==='undefined' || !running ||
        typeof obstacles==='undefined' || !Array.isArray(obstacles)) return;
    const walls=obstacles;
    if (walls.length>56) return;
    const fresh=walls.filter(w=>w && typeof w==='object' &&
      !w.__arenaLArm && !scanned.has(w));
    if (!fresh.length) return;
    for (const base of fresh) scanned.add(base);
    const available=fresh.filter(w=>
      [w.x,w.y,w.w,w.h].every(Number.isFinite) &&
      w.w>0 && w.h>0 && Math.max(w.w,w.h)>=125);
    // A structure may use several arms. Reserve them atomically; never
    // partially install a U-shaped wall near a character or another cover.
    for (const shape of ['L','T','U']) {
      if (walls.some(w=>w.__arenaShape===shape)) continue;
      for (const base of available) {
        if (installed.has(base)) continue;
        let placed=false;
        for (let rotation=0;rotation<4;rotation++) {
          const arms=makeArms(base,shape,rotation);
          if (!arms.length || !arms.every(a=>canPlace(a,base,walls))) continue;
          for (let i=0;i<arms.length;i++) {
            const part={...base,...arms[i],__arenaLArm:true,__arenaShape:shape};
            if (Object.prototype.hasOwnProperty.call(part,'id')) {
              part.id=String(base.id)+'-'+shape+'-'+i;
            }
            walls.push(part);
          }
          installed.add(base);
          placed=true;
          break;
        }
        if (placed) break;
      }
    }
  }
  function frame() {
    try { applyShapes(); } catch (_) { /* Keep controls and attacks running. */ }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
