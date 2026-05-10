// @ts-check
'use strict';

/**
 * Pick or pursue an in-room patrol target.
 *
 * @this {Enemy}
 * @param {any} [dt]
 * @param {any} [map]
 * @returns {void}
 */
Enemy.prototype.patrol = function patrol(dt, map) {
  if (!this.patrolTarget || dist(this.x, this.y, this.patrolTarget.x, this.patrolTarget.y) < 0.5) {
    if (this.room) {
      this.patrolTarget = {
        x: this.room.x + rnd(1, this.room.w - 1),
        y: this.room.y + rnd(1, this.room.h - 1)
      };
    }
  }
  if (this.patrolTarget) this.moveToward(this.patrolTarget.x, this.patrolTarget.y, this.spd * 0.5, dt, map);
};
