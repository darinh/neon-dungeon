// @ts-check
'use strict';

// Leech-on-hit lives in meleeAttack, gated on dealt > 0 so parry and shield skip the drain.
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
  // meleeAttack is taunt-aware: pass `player` even when the target is a decoy.
  if (d < SAPPER_MELEE_RANGE) this.meleeAttack(player);
};
