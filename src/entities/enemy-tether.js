// @ts-check
'use strict';

/**
 * player.update consumes `_tetherSlowFactor` and resets it to 1 each frame.
 *
 * @this {Enemy}
 * @param {number} dt
 * @param {any} player
 * @param {any} map
 * @param {number} d
 * @param {boolean} los
 * @returns {void}
 */
Enemy.prototype.aiTether = function aiTether(dt, player, map, d, los) {
  if (los || (d < TETHER_CHASE_RANGE && this._canTarget())) {
    this.moveToward(this._tx, this._ty, this.spd, dt, map);
  } else {
    this.patrol(dt, map);
  }
  // Real player distance, not taunt `d`: a hologram must not drag the slow off the player.
  if (!player || player.dead) return;
  const pd = dist(this.x, this.y, player.x, player.y);
  if (pd >= TETHER_FIELD_RANGE) return;
  // Factor 1 inside melee range so the player can still hit; max slow is at the field edge.
  let t = (pd - TETHER_MELEE_RANGE) / (TETHER_FIELD_RANGE - TETHER_MELEE_RANGE);
  if (t < 0) t = 0; else if (t > 1) t = 1;
  const factor = 1 - t * (1 - TETHER_MIN_FACTOR);
  // Stack multiplicatively across TETHERs on the per-frame accumulator.
  const cur = (player._tetherSlowFactor == null) ? 1 : player._tetherSlowFactor;
  player._tetherSlowFactor = Math.max(TETHER_MIN_FACTOR * 0.6, cur * factor);
};
