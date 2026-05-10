// @ts-check
'use strict';

/**
 * Reposition a cloaked PHANTOM inside its current room, preferring tiles away
 * from the current target.
 *
 * @this {Enemy}
 * @param {any} [map]
 * @param {any} [player]
 */
Enemy.prototype._phReposition = function _phReposition(map, player) {
  if (!this.room) return;
  let bestX = this.x, bestY = this.y, bestD = 0;
  for (let a = 0; a < 15; a++) {
    const nx = this.room.x + rnd(1, this.room.w - 1);
    const ny = this.room.y + rnd(1, this.room.h - 1);
    const fx = Math.floor(nx), fy = Math.floor(ny);
    if (fx >= 0 && fy >= 0 && fx < MAP_W && fy < MAP_H && isPassable(map[fy][fx])) {
      const dd = dist(nx, ny, this._tx, this._ty);
      if (dd > bestD && dd > 3) { bestX = nx; bestY = ny; bestD = dd; }
    }
  }
  this.x = bestX; this.y = bestY;
};
