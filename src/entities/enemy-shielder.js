'use strict';
// @ts-check

/**
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 * @returns {void}
 */
Enemy.prototype.aiShielder = function aiShielder(dt, player, map, d, los) {
  // -1 shield up; [0,3) down; [3,5) blink (render); >=5 restore. Render reads the same bands.
  if (this.shieldBrokenTimer >= 0) {
    this.shieldBrokenTimer += dt;
    if (this.shieldBrokenTimer >= 5) {
      this.shieldHp = this.shieldMax || 25;
      this.shieldBrokenTimer = -1;
    }
  }
  // Only update facing when player is visible (prevents wall-hack orientation)
  if (los) this.shieldAngle = Math.atan2(this._ty - this.y, this._tx - this.x);
  if (los && d < 12) {
    this.state = 'CHASE';
    this.moveToward(this._tx, this._ty, this.spd, dt, map);
    if (d < 1.2) this.meleeAttack(player);
  } else {
    this.state = 'PATROL';
    this.patrol(dt, map);
  }
};
