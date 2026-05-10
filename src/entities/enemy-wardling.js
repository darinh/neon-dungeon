// @ts-check
'use strict';

/**
 * Find the nearest non-WARDLING, non-shard, non-boss enemy in this wardling's
 * room. Returns null if no such enemy exists.
 *
 * @this {Enemy}
 * @returns {any}
 */
Enemy.prototype._wlFindWard = function _wlFindWard() {
  let best = null;
  let bestD = Infinity;
  for (const e of enemies) {
    if (e === this || e.dead) continue;
    if (e.type === 'WARDLING') continue;   // wardlings don't guard each other (no infinite chains)
    if (e.isShard || e.isBoss) continue;   // bosses have their own kit; shards are short-lived
    if (e.room !== this.room) continue;    // room-scoped only
    const d = dist(this.x, this.y, e.x, e.y);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
};
