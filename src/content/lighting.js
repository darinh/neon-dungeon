// @ts-check
'use strict';

// Lighting and field-of-view helpers. Loaded before src/content.js so the
// legacy updateLighting global remains available while FOV logic has a smaller
// owner. Runtime globals are resolved only when functions are invoked.

/** @type {any} */
const _LG = new Proxy({}, {
  get: (_t, p) => /** @type {any} */ (game)[p],
  set: (_t, p, v) => { /** @type {any} */ (game)[p] = v; return true; },
  has: (_t, p) => p in /** @type {any} */ (game),
});

/**
 * @param {any} dungeon
 * @param {any} px
 * @param {any} py
 */
function updateLighting(dungeon, px, py) {
  const map = dungeon.map;
  const mod = _LG.modifier;
  const baseR = mod === 'BLACKOUT' ? 5 : 9;
  // RECON meta upgrade (src/meta/save.js applyMetaToPlayer): sensorRadiusMult
  // scales the player FOV radius. Same loop also writes dungeon.visited so this
  // widens both the lit area AND the minimap reveal — matching the upgrade
  // contract '+20% sensor radius (minimap reveal) per level'.
  // Set once at run start; constant for the run; included in the cache key
  // (_fovSensor) defensively in case any future mechanic mutates it mid-run.
  // Sanitize aggressively: corrupted/tampered save data can deliver NaN /
  // Infinity / strings via _LG.player.sensorRadiusMult (the field flows through
  // saveGame's explicit enum but localStorage is user-writable); without the
  // isFinite + bounds check, NaN would blank the FOV and Infinity would hang
  // the per-tile loop.
  let sensorMult = (_LG.player && _LG.player.sensorRadiusMult) || 1;
  if (!Number.isFinite(sensorMult) || sensorMult <= 0) sensorMult = 1;
  if (sensorMult > 8) sensorMult = 8;
  const r = Math.max(1, Math.round(baseR * sensorMult));
  const tx = Math.floor(px), ty = Math.floor(py);
  // Incremental FOV (Phase 2b): if the player is still on the same floor tile
  // and the modifier hasn't changed and no map mutation flagged dirty, the
  // previous frame's light/visible grids are still correct. Skip recompute.
  if (!dungeon._fovDirty &&
      dungeon._fovTx === tx && dungeon._fovTy === ty &&
      dungeon._fovMod === mod &&
      dungeon._fovSensor === sensorMult) {
    return;
  }
  dungeon._fovDirty = false;
  dungeon._fovTx = tx; dungeon._fovTy = ty; dungeon._fovMod = mod;
  dungeon._fovSensor = sensorMult;
  // Clear light and visible each frame (per-row typed-array fill)
  for (let y = 0; y < MAP_H; y++) {
    dungeon.light[y].fill(0);
    dungeon.visible[y].fill(0);
  }
  // Player FOV — LOS-based
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const x = tx + dx, y = ty + dy;
      if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
      if (dungeon.secretMask[y][x]) continue;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > r) continue;
      if (!tileHasLOS(px, py, x, y, map)) continue;
      const l = Math.max(0, 1 - d / r);
      dungeon.light[y][x] = l;
      dungeon.visible[y][x] = 1;
      if (!dungeon.visited[y][x]) { dungeon.visited[y][x] = 1; _LG._minimapDirty = true; }
    }
  // Sconce ambient — only brightens already-visited tiles, no visibility grant.
  // Add deterministic flicker so floors read like unstable lab lighting.
  for (const sc of dungeon.lights) {
    const sdx = sc.x - tx, sdy = sc.y - ty;
    if (Math.abs(sdx) > 6 || Math.abs(sdy) > 6) continue;
    const flickerBase = 0.82 + 0.18 * Math.sin((_LG.floorTime || 0) * 7 + sc.x * 0.73 + sc.y * 1.11);
    const flickerDrop = Math.sin((_LG.floorTime || 0) * 19 + sc.x * 1.7 + sc.y * 2.3) > 0.94 ? 0.55 : 1;
    const sconceMul = flickerBase * flickerDrop;
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = sc.x + dx, y = sc.y + dy;
        if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
        if (dungeon.secretMask[y][x]) continue;
        if (!dungeon.visited[y][x]) continue;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= 4) dungeon.light[y][x] = Math.max(dungeon.light[y][x], 0.4 * sconceMul * (1 - d / 4));
      }
  }
}

// LOS check for FOV: like hasLOS but uses isSeeThrough and blocks diagonal corner-cuts
/**
 * @param {any} x1
 * @param {any} y1
 * @param {any} tx
 * @param {any} ty
 * @param {any} map
 */
function tileHasLOS(x1, y1, tx, ty, map) {
  let cx = Math.floor(x1), cy = Math.floor(y1);
  if (cx === tx && cy === ty) return true;
  const dx = Math.abs(tx - cx), dy = Math.abs(ty - cy);
  const sx = cx < tx ? 1 : -1, sy = cy < ty ? 1 : -1;
  let err = dx - dy;
  for (let i = 0; i < 100; i++) {
    const e2 = 2 * err;
    let nx = cx, ny = cy;
    if (e2 > -dy) { err -= dy; nx += sx; }
    if (e2 < dx)  { err += dx; ny += sy; }
    // Diagonal corner-cut block: both intermediate tiles must be see-through
    if (nx !== cx && ny !== cy) {
      if (!isSeeThrough(map[cy]?.[nx]) && !isSeeThrough(map[ny]?.[cx])) return false;
    }
    cx = nx; cy = ny;
    if (cx === tx && cy === ty) return true;
    if (cx < 0 || cy < 0 || cx >= MAP_W || cy >= MAP_H) return false;
    if (!isSeeThrough(map[cy][cx])) return false;
  }
  return true;
}
