// @ts-check

// Non-damaging. Boss stun matches takeDamage's boss cap and applies no knockback so arenas stay pinned. Radius, stun, and knock constants live in src/content/pickups.js.
function triggerShockPulse() {
  const player = _EG.player;
  const map = _EG.dungeon && _EG.dungeon.map;
  if (!player || !map) return 0;
  const r = SHOCK_PULSE_RADIUS;
  let hit = 0;
  for (const e of enemies) {
    if (!e || e.dead) continue;
    // Stunning a disguised mimic leaks it in the "N STUNNED" toast and breaks the ambush.
    if (e._disguised) continue;
    const dx0 = e.x - player.x, dy0 = e.y - player.y;
    const d = Math.hypot(dx0, dy0);
    if (d >= r) continue;
    if (!hasLOS(player.x, player.y, e.x, e.y, map)) continue;
    if (e.isBoss) {
      e.stunTimer = Math.max(e.stunTimer || 0, SHOCK_PULSE_BOSS_STUN);
      hit++;
      continue;
    }
    // Swept in 0.25-tile steps. A single snap tunnels through interior walls when the displacement is over 1 tile.
    let nxv, nyv;
    if (d > 0.0001) { nxv = dx0 / d; nyv = dy0 / d; }
    else { nxv = 1; nyv = 0; }
    const STEP = 0.25;
    const steps = Math.ceil(SHOCK_PULSE_KNOCK / STEP);
    let curX = e.x, curY = e.y;
    for (let s = 0; s < steps; s++) {
      const tryX = curX + nxv * STEP;
      const tryY = curY + nyv * STEP;
      const fxK = Math.floor(tryX), fyK = Math.floor(curY);
      const xfK = Math.floor(curX), yfK = Math.floor(tryY);
      const xOk = fxK >= 0 && fxK < MAP_W && fyK >= 0 && fyK < MAP_H && isPassable(map[fyK][fxK]);
      const yOk = xfK >= 0 && xfK < MAP_W && yfK >= 0 && yfK < MAP_H && isPassable(map[yfK][xfK]);
      if (!xOk && !yOk) break;
      if (xOk) curX = tryX;
      if (yOk) curY = tryY;
    }
    // Both axes can be passable while the diagonal corner tile is a wall.
    const finalFx = Math.floor(curX), finalFy = Math.floor(curY);
    if (finalFx >= 0 && finalFx < MAP_W && finalFy >= 0 && finalFy < MAP_H && isPassable(map[finalFy][finalFx])) {
      e.x = curX;
      e.y = curY;
    }
    e.stunTimer = Math.max(e.stunTimer || 0, SHOCK_PULSE_STUN);
    hit++;
  }
  spawnParticles(player.x, player.y, 'EXPLOSION', '#66e0ff', 18);
  spawnParticles(player.x, player.y, 'SPARK',     '#aaf0ff', 10);
  triggerShake(5, 0.18);
  try { if (typeof audio !== 'undefined' && audio.shockPulse) audio.shockPulse(); } catch (_) { /* test stub */ }
  return hit;
}
