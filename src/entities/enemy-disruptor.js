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
Enemy.prototype.aiDisruptor = function aiDisruptor(dt, player, map, d, los) {
  this._dFields = this._dFields.filter((/** @type {any} */ f) => f && !f.dead);
  this._dDeployTimer = Math.max(0, this._dDeployTimer - dt);
  this._dFireTimer = Math.max(0, this._dFireTimer - dt);
  const bm = this.berserkerMul();
  const spd = modSpeed(this.spd) * this.slowFactor * bm * (hasAugment('TEMPORAL_DILATION') ? 0.85 : 1);

  if (los && d < 4) {
    const [dx, dy] = norm(this.x - this._tx, this.y - this._ty);
    const nx = this.x + dx * spd * dt;
    const ny = this.y + dy * spd * dt;
    const fx = Math.floor(nx), fy = Math.floor(this.y);
    const xf = Math.floor(this.x), yf = Math.floor(ny);
    let moved = false;
    if (fx >= 0 && fy >= 0 && fx < MAP_W && fy < MAP_H && isPassable(map[fy][fx])) { this.x = nx; moved = true; }
    if (xf >= 0 && yf >= 0 && xf < MAP_W && yf < MAP_H && isPassable(map[yf][xf])) { this.y = ny; moved = true; }
    if (!moved) this.patrol(dt, map);
  } else if (los && d <= 10) {
    this.state = 'ATTACK';
    // Field before shot: the else-if below must not fire in the same frame as a deploy.
    if (this._dDeployTimer <= 0 && this._canTarget() && d > 2) {
      const ox = (rand('combat') - 0.5) * 1.5;
      const oy = (rand('combat') - 0.5) * 1.5;
      const fx = this._tx + ox, fy = this._ty + oy;
      const tx = Math.floor(fx), ty = Math.floor(fy);
      if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H && isPassable(map[ty][tx])) {
        if (this._dFields.length >= 2) {
          this._dFields[0].dead = true;
          this._dFields.shift();
        }
        const field = { x: fx, y: fy, age: 0, maxAge: 5, radius: 2, tickCd: 0, dead: false };
        disruptionFields.push(field);
        this._dFields.push(field);
        audio.disruptorDeploy();
        spawnParticles(fx, fy, 'EXPLOSION', '#ff44aa', 8);
        this._dDeployTimer = 4.0 / bm;
      }
    }
    else if (this._dFireTimer <= 0 && this._canTarget()) {
      this.fireAt(this._tx, this._ty, 7, this.atk, 12, this.colour);
      this._dFireTimer = 2.5 / bm;
    }
  } else if (los && d > 10) {
    this.moveToward(this._tx, this._ty, this.spd * 0.7, dt, map);
  } else {
    this.state = 'PATROL';
    this.patrol(dt, map);
  }
};
