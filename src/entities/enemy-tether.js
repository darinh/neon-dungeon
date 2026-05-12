// @ts-check
'use strict';

/**
 * TETHER - anti-kiting slow-aura chaser (floor 5+, hp=24, atk=0, spd=2.6).
 *
 * Slowly chases the player with LOS gating, patrols when blind. Has
 * NO contact damage and no projectiles - its sole mechanic is the
 * passive leash field: every frame, if the player is within
 * TETHER_FIELD_RANGE tiles, multiply player._tetherSlowFactor by a
 * distance-proportional factor (1.0 at body contact, dropping
 * linearly to TETHER_MIN_FACTOR at the field edge).
 *
 * Distance is computed against the REAL player, not the taunt-aware
 * _tx/_ty. Per stored convention, mechanics whose threat must track
 * the real player must recompute dist(this.x,this.y,player.x,player.y)
 * locally because the d arg is taunt-distance and would let a hologram
 * pull the slow off the player.
 *
 * The slow is applied in player.update by reading player._tetherSlowFactor,
 * then resetting it to 1 each frame. That consume-and-clear pattern mirrors
 * toxicSlowActive while accumulating multiplicatively across multiple TETHERs.
 *
 * TETHER is excluded from the elite affix roll as first-ship caution for the
 * aura mechanic; it is easier to add affixes later than to reason about
 * SHIELDED / PHASING / FRENZY interactions up front.
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
  // Apply the leash slow. Use REAL player distance (not taunt d) so a
  // hologram cannot drag the slow off the player.
  if (!player || player.dead) return;
  const pd = dist(this.x, this.y, player.x, player.y);
  if (pd >= TETHER_FIELD_RANGE) return;
  // Linear interpolation: at pd <= TETHER_MELEE_RANGE, factor is 1 (no slow);
  // at pd >= TETHER_FIELD_RANGE, factor is TETHER_MIN_FACTOR (max slow).
  let t = (pd - TETHER_MELEE_RANGE) / (TETHER_FIELD_RANGE - TETHER_MELEE_RANGE);
  if (t < 0) t = 0; else if (t > 1) t = 1;
  const factor = 1 - t * (1 - TETHER_MIN_FACTOR);
  // Multiply onto the per-frame accumulator. Stack multiplicatively across
  // TETHERs but never below the per-mob floor.
  const cur = (player._tetherSlowFactor == null) ? 1 : player._tetherSlowFactor;
  player._tetherSlowFactor = Math.max(TETHER_MIN_FACTOR * 0.6, cur * factor);
};
