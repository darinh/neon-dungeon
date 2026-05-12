// @ts-check
'use strict';

/**
 * VAULTMASTER — economic-inverse mob (floor 4+, hp=60, atk=0, spd=2.0).
 *
 * The AI only presents the mob to be hit; coin ejection stays in takeDamage
 * where post-mitigation hit context and the per-hit ICD are available.
 *
 * @this {Enemy}
 * @param {number} dt
 * @param {any} player
 * @param {any} map
 * @param {number} d
 * @param {boolean} los
 * @returns {void}
 */
Enemy.prototype.aiVaultmaster = function aiVaultmaster(dt, player, map, d, los) {
  void player;
  if (los || (d < VAULTMASTER_ENGAGE_RANGE && this._canTarget())) {
    this.moveToward(this._tx, this._ty, this.spd, dt, map);
  } else {
    this.patrol(dt, map);
  }
};
