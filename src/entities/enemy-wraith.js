// @ts-check
'use strict';

/**
 * Find a safe passable tile where a phased WRAITH-style enemy can emerge.
 *
 * @this {Enemy}
 * @param {any} [map]
 * @param {any} [player]
 * @returns {{ x: number, y: number } | null}
 */
Enemy.prototype._wrFindEmergeTile = function _wrFindEmergeTile(map, player) {
  // Try to emerge near perceived target on a passable tile
  const tx = this._tx ?? player.x, ty = this._ty ?? player.y;
  let bestX = null, bestY = null, bestD = Infinity;
  for (let a = 0; a < 20; a++) {
    const angle = rand('combat') * TWO_PI;
    const r = 1.5 + rand('combat') * 2;
    const nx = tx + Math.cos(angle) * r;
    const ny = ty + Math.sin(angle) * r;
    const txx = Math.floor(nx), tyy = Math.floor(ny);
    if (txx < 0 || tyy < 0 || txx >= MAP_W || tyy >= MAP_H) continue;
    if (!isPassable(map[tyy][txx])) continue;
    const dd = dist(nx, ny, tx, ty);
    if (dd < bestD && dd > 1.2) { bestX = nx; bestY = ny; bestD = dd; }
  }
  if (bestX !== null) return { x: bestX, y: bestY };
  // Fallback: current position if passable
  const cx = Math.floor(this.x), cy = Math.floor(this.y);
  if (cx >= 0 && cy >= 0 && cx < MAP_W && cy < MAP_H && isPassable(map[cy][cx])) {
    return { x: this.x, y: this.y };
  }
  // Emergency: search outward for any passable tile
  for (let r = 1; r < 6; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        const tx = Math.floor(this.x) + dx, ty = Math.floor(this.y) + dy;
        if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H && isPassable(map[ty][tx])) {
          return { x: tx + 0.5, y: ty + 0.5 };
        }
      }
    }
  }
  return null;
};
