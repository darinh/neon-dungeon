// @ts-check

// SHOCK_PULSE pickup (src/content/pickups.js: ShockPulsePickup) detonation. AoE,
// LOS-gated knockback + brief stun centred on the player. NON-DAMAGING:
// the payoff is positional (panic-eject a swarm). Bosses get a clipped
// stun (0.3s — same cap as enemy.takeDamage's boss stunTimer branch) and
// NO knockback so designed boss arenas don't break.
//
// Knockback math mirrors CHARGER's wall-aware push (src/entities.js
// ~4588): each axis is checked independently against isPassable, so an
// enemy pinned against a wall is shoved along the open axis only and
// never tunnels into geometry. SHOCK_PULSE_RADIUS / _STUN / _BOSS_STUN /
// _KNOCK live in src/content/pickups.js next to the pickup class.
function triggerShockPulse() {
  const player = _EG.player;
  const map = _EG.dungeon && _EG.dungeon.map;
  if (!player || !map) return 0;
  const r = SHOCK_PULSE_RADIUS;
  let hit = 0;
  for (const e of enemies) {
    if (!e || e.dead) continue;
    // Skip disguised mimics — same precedent as EMP / shield-gen EMP
    // (src/content.js EMP branch + src/entities.js shield-gen damage).
    // Stunning a disguised mimic would leak its presence in the
    // "N STUNNED" toast and break the ambush before reveal.
    if (e._disguised) continue;
    const dx0 = e.x - player.x, dy0 = e.y - player.y;
    const d = Math.hypot(dx0, dy0);
    if (d >= r) continue;
    if (!hasLOS(player.x, player.y, e.x, e.y, map)) continue;
    if (e.isBoss) {
      // Bosses: stun-only, no knockback.
      e.stunTimer = Math.max(e.stunTimer || 0, SHOCK_PULSE_BOSS_STUN);
      hit++;
      continue;
    }
    // Wall-aware swept knockback. Walks along the away-from-player
    // vector in small (0.25 tile) increments and commits the LAST
    // passable position, axis-independently. The single-snap pattern
    // CHARGER uses for player push (src/entities.js ~4588) can tunnel
    // through interior walls when the displacement >1 tile; sweeping
    // prevents that for the larger SHOCK_PULSE_KNOCK distance.
    let nxv, nyv;
    if (d > 0.0001) { nxv = dx0 / d; nyv = dy0 / d; }
    else { nxv = 1; nyv = 0; }
    const STEP = 0.25;
    const steps = Math.ceil(SHOCK_PULSE_KNOCK / STEP);
    let curX = e.x, curY = e.y;
    for (let s = 0; s < steps; s++) {
      const tryX = curX + nxv * STEP;
      const tryY = curY + nyv * STEP;
      // Axis-independent passability check at each step — slide along
      // walls instead of stopping dead, so a glancing-angle push still
      // travels along the open axis.
      const fxK = Math.floor(tryX), fyK = Math.floor(curY);
      const xfK = Math.floor(curX), yfK = Math.floor(tryY);
      const xOk = fxK >= 0 && fxK < MAP_W && fyK >= 0 && fyK < MAP_H && isPassable(map[fyK][fxK]);
      const yOk = xfK >= 0 && xfK < MAP_W && yfK >= 0 && yfK < MAP_H && isPassable(map[yfK][xfK]);
      if (!xOk && !yOk) break;
      if (xOk) curX = tryX;
      if (yOk) curY = tryY;
    }
    // Final combined-tile guard: ensure the resting tile is passable
    // even when both single-axis checks accept it (defends against the
    // diagonal-corner case where map[yK][xK] is itself a wall).
    const finalFx = Math.floor(curX), finalFy = Math.floor(curY);
    if (finalFx >= 0 && finalFx < MAP_W && finalFy >= 0 && finalFy < MAP_H && isPassable(map[finalFy][finalFx])) {
      e.x = curX;
      e.y = curY;
    }
    e.stunTimer = Math.max(e.stunTimer || 0, SHOCK_PULSE_STUN);
    hit++;
  }
  // Visual + audio feedback. Cyan ring particles emanating from player.
  spawnParticles(player.x, player.y, 'EXPLOSION', '#66e0ff', 18);
  spawnParticles(player.x, player.y, 'SPARK',     '#aaf0ff', 10);
  triggerShake(5, 0.18);
  try { if (typeof audio !== 'undefined' && audio.shockPulse) audio.shockPulse(); } catch (_) { /* test stub */ }
  return hit;
}
