// @ts-check
'use strict';

/**
 * @this {Enemy}
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 */
Enemy.prototype.aiGraviton = function aiGraviton(dt, player, map, d, los) {
  void player;
  this._gvWells = this._gvWells.filter((/** @type {any} */ w) => w && !w.dead);
  this._gvDeployTimer = Math.max(0, this._gvDeployTimer - dt);
  this._gvFireTimer = Math.max(0, this._gvFireTimer - dt);
  const bm = this.berserkerMul();
  const spd = modSpeed(this.spd) * this.slowFactor * bm * (hasAugment('TEMPORAL_DILATION') ? 0.85 : 1);

  if (los && d < 5) {
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
    // Deployment requires a visible target; an existing well keeps pulling through cloak.
    if (this._gvDeployTimer <= 0 && d > 3) {
      const ox = (rand('combat') - 0.5) * 2;
      const oy = (rand('combat') - 0.5) * 2;
      const wx = this._tx + ox, wy = this._ty + oy;
      const tx = Math.floor(wx), ty = Math.floor(wy);
      if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H && isPassable(map[ty][tx])) {
        if (this._gvWells.length >= 2) {
          this._gvWells[0].dead = true;
          this._gvWells.shift();
        }
        // Derive room from well position (not owner) to handle cross-room LOS
        const wellRoom = _EG.dungeon?.rooms?.find((/** @type {any} */ r) =>
          wx >= r.x && wx < r.x + r.w && wy >= r.y && wy < r.y + r.h) || null;
        const well = { x: wx, y: wy, owner: this, timer: 0, maxTimer: 4, radius: 2.5, dead: false, room: wellRoom };
        gravityWells.push(well);
        this._gvWells.push(well);
        audio.gravitonDeploy();
        spawnParticles(wx, wy, 'EXPLOSION', '#8833ff', 10);
        this._gvDeployTimer = 5.0 / bm;
      }
    }
    else if (this._gvFireTimer <= 0 && this._canTarget()) {
      this.fireAt(this._tx, this._ty, 6, this.atk, 10, this.colour);
      this._gvFireTimer = 3.0 / bm;
    }
  } else if (los && d > 10) {
    this.moveToward(this._tx, this._ty, this.spd * 0.6, dt, map);
  } else {
    this.patrol(dt, map);
  }
};
