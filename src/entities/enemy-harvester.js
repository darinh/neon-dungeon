// @ts-check
'use strict';

/**
 * HARVESTER - fragile melee chaser whose reward is handled by Enemy.die().
 *
 * @this {Enemy}
 * @param {number} dt
 * @param {any} player
 * @param {any} map
 * @param {number} d
 * @param {boolean} los
 * @returns {void}
 */
Enemy.prototype.aiHarvester = function aiHarvester(dt, player, map, d, los) {
  if (los || (d < 8 && this._canTarget())) {
    this.moveToward(this._tx, this._ty, this.spd, dt, map);
    if (d < 1.2) this.meleeAttack(player);
  } else {
    this.patrol(dt, map);
  }
};
