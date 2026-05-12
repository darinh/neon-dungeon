// @ts-check
'use strict';

/**
 * Move an enemy toward a target while applying shared speed modifiers and tile
 * collision.
 *
 * @this {Enemy}
 * @param {any} [tx]
 * @param {any} [ty]
 * @param {any} [spd]
 * @param {any} [dt]
 * @param {any} [map]
 * @param {any} [ignoreWalls]
 * @returns {void}
 */
Enemy.prototype.moveToward = function moveToward(tx, ty, spd, dt, map, ignoreWalls) {
  spd = modSpeed(spd) * this.slowFactor * this.berserkerMul() * (hasAugment('TEMPORAL_DILATION') ? 0.85 : 1);
  const [dx, dy] = norm(tx - this.x, ty - this.y);
  const nx = this.x + dx * spd * dt, ny = this.y + dy * spd * dt;
  if (ignoreWalls) { this.x = nx; this.y = ny; return; }
  const fx = Math.floor(nx), fy = Math.floor(this.y);
  const xf = Math.floor(this.x), yf = Math.floor(ny);
  if (fx >= 0 && fy >= 0 && fx < MAP_W && fy < MAP_H && isPassable(map[fy][fx])) this.x = nx;
  if (xf >= 0 && yf >= 0 && xf < MAP_W && yf < MAP_H && isPassable(map[yf][xf])) this.y = ny;
};

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
