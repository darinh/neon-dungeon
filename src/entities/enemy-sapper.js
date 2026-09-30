// @ts-check
'use strict';

// Timed-boost drain lives in meleeAttack, gated on dealt > 0 so parry and shield absorbs skip it.
/**
 * @this {Enemy}
 * @param {number} dt
 * @param {any} player
 * @param {any} map
 * @param {number} d
 * @param {boolean} los
 * @returns {void}
 */
Enemy.prototype.aiSapper = function aiSapper(dt, player, map, d, los) {
  if (los || (d < SAPPER_CHASE_RANGE && this._canTarget())) {
    this.moveToward(this._tx, this._ty, this.spd, dt, map);
  } else {
    this.patrol(dt, map);
  }
  // No generic body-collision damage, so atk only lands here.
  // Pass `player` even for a decoy-targeted approach; meleeAttack's real-player range check makes it a hologram whiff.
  if (d < SAPPER_MELEE_RANGE) this.meleeAttack(player);
};
