// @ts-check
'use strict';

/**
 * TETHER — anti-kiting slow-aura chaser (floor 5+, hp=24, atk=0, spd=2.6).
 *
 * The AI presents the aura source via chase/patrol movement and applies the
 * leash accumulator to the real player; Player.update consumes and resets it.
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
  // Apply the leash slow. Use REAL player distance (not taunt `d`)
  // so a hologram cannot drag the slow off the player. Skip when
  // player is missing or already dead.
  if (!player || player.dead) return;
  const pd = dist(this.x, this.y, player.x, player.y);
  if (pd >= TETHER_FIELD_RANGE) return;
  // Linear interpolation: at pd <= TETHER_MELEE_RANGE -> factor 1
  // (no slow, you can melee me); at pd >= TETHER_FIELD_RANGE ->
  // factor TETHER_MIN_FACTOR (max slow). Between, lerp.
  let t = (pd - TETHER_MELEE_RANGE) / (TETHER_FIELD_RANGE - TETHER_MELEE_RANGE);
  if (t < 0) t = 0; else if (t > 1) t = 1;
  const factor = 1 - t * (1 - TETHER_MIN_FACTOR);
  // Multiply onto the per-frame accumulator. Stack multiplicatively
  // across TETHERs but never below the per-mob floor (TETHER_MIN_FACTOR).
  const cur = (player._tetherSlowFactor == null) ? 1 : player._tetherSlowFactor;
  player._tetherSlowFactor = Math.max(TETHER_MIN_FACTOR * 0.6, cur * factor);
};
