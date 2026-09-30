// @ts-check
'use strict';

/**
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 * @returns {void}
 */
Enemy.prototype.aiReflector = function aiReflector(dt, player, map, d, los) {
  // Tracking lag is intentional.
  if (los) {
    const target = Math.atan2(this._ty - this.y, this._tx - this.x);
    let diff = target - this._rfAngle;
    while (diff > Math.PI) diff -= TWO_PI;
    while (diff < -Math.PI) diff += TWO_PI;
    this._rfAngle += diff * Math.min(1, 3 * dt);
  }
  const bm = this.berserkerMul();
  if (los && d < 4) {
    const [dx, dy] = norm(this.x - this._tx, this.y - this._ty);
    const retreatSpd = modSpeed(this.spd) * this.slowFactor * bm * (hasAugment('TEMPORAL_DILATION') ? 0.85 : 1);
    const nx = this.x + dx * retreatSpd * dt;
    const ny = this.y + dy * retreatSpd * dt;
    const fx = Math.floor(nx), fy = Math.floor(this.y);
    const xf = Math.floor(this.x), yf = Math.floor(ny);
    let moved = false;
    if (fx >= 0 && fy >= 0 && fx < MAP_W && fy < MAP_H && isPassable(map[fy][fx])) { this.x = nx; moved = true; }
    if (xf >= 0 && yf >= 0 && xf < MAP_W && yf < MAP_H && isPassable(map[yf][xf])) { this.y = ny; moved = true; }
    if (!moved) this.patrol(dt, map);
  } else if (los && d <= 10) {
    this.state = 'ATTACK';
    if (this.shootTimer <= 0) {
      this.fireAt(this._tx, this._ty, 7, this.atk, 14, this.colour);
      this.shootTimer = 2.5 / bm;
    }
  } else if (los && d > 10) {
    this.moveToward(this._tx, this._ty, this.spd * 0.7, dt, map);
  } else {
    this.state = 'PATROL';
    this.patrol(dt, map);
  }
};
