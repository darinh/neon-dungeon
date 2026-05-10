// @ts-check
'use strict';

/**
 * Find the lowest-health wounded, non-boss ally close enough for a HEALER pulse.
 *
 * @this {Enemy}
 * @returns {any}
 */
Enemy.prototype._findHealTarget = function _findHealTarget() {
  let best = null, bestRatio = 1;
  for (const e of enemies) {
    if (e === this || e.dead || e.isBoss) continue;
    if (e._wrPhased) continue; // can't heal phased WRAITHs
    if (e.hp >= e.maxHp) continue;
    const ed = dist(this.x, this.y, e.x, e.y);
    if (ed > 6) continue;
    const ratio = e.hp / e.maxHp;
    if (ratio < bestRatio) { bestRatio = ratio; best = e; }
  }
  return best;
};
