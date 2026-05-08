// @ts-check
'use strict';

// Crates load after src/entities.js so they can reuse shared actor arrays and
// map/game globals while publishing the legacy crate helpers consumed by
// projectiles, volatile cores, generation, and enemy damage.

// ─── Crates ───────────────────────────────────────────────────────────────────
/**
 * @param {any} [tx]
 * @param {any} [ty]
 * @param {any} [floor]
 */
function createCrate(tx, ty, floor) {
  const maxHp = 15 + floor * 5;
  return { tx, ty, hp: maxHp, maxHp };
}

/**
 * @param {any} [tx]
 * @param {any} [ty]
 */
function getCrateAt(tx, ty) {
  for (const c of crates) if (c.tx === tx && c.ty === ty) return c;
  return null;
}

/**
 * @param {any} [c]
 * @param {any} [dmg]
 */
function damageCrate(c, dmg) {
  if (!c || c.hp <= 0) return;
  c.hp -= dmg;
  if (c.hp <= 0) destroyCrate(c);
  else spawnParticles(c.tx + 0.5, c.ty + 0.5, 'SPARK', '#88aacc', 3);
}

/**
 * @param {any} [c]
 */
function destroyCrate(c) {
  const map = _EG.dungeon.map;
  map[c.ty][c.tx] = T.FLOOR;
  _EG.markMapMutated();
  spawnParticles(c.tx + 0.5, c.ty + 0.5, 'EXPLOSION', '#667788', 10);
  spawnParticles(c.tx + 0.5, c.ty + 0.5, 'SPARK', '#44ccff', 6);
  audio.crateBreak();
  // 25% chance to drop credits
  if (rand('loot') < 0.25) {
    const amt = _EG.floor * 4;
    _EG.player.credits = (_EG.player.credits || 0) + amt;
    spawnDmgText(c.tx + 0.5, c.ty + 0.2, '+' + amt + '◈', '#39ff14');
  }
  const idx = crates.indexOf(c);
  if (idx >= 0) crates.splice(idx, 1);
}

/**
 * @param {any} [tx]
 * @param {any} [ty]
 * @param {any} [dmg]
 */
function damageCrateAtTile(tx, ty, dmg) {
  const c = getCrateAt(tx, ty);
  if (c) damageCrate(c, dmg);
}

/**
 * @param {any} [wx]
 * @param {any} [wy]
 * @param {any} [radius]
 * @param {any} [dmg]
 * @param {any} [map]
 */
function damageCratesInRadius(wx, wy, radius, dmg, map) {
  for (let i = crates.length - 1; i >= 0; i--) {
    const c = crates[i];
    const cx = c.tx + 0.5, cy = c.ty + 0.5;
    if (dist(wx, wy, cx, cy) < radius && hasLOS(wx, wy, cx, cy, map)) {
      damageCrate(c, dmg);
    }
  }
}
