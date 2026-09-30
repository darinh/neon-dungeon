// @ts-check
'use strict';

/**
 * @this {Enemy}
 * @param {any} [map]
 * @param {any} [player]
 */
Enemy.prototype._phReposition = function _phReposition(map, player) {
  if (!this.room) return;
  let bestX = this.x, bestY = this.y, bestD = 0;
  for (let a = 0; a < 15; a++) {
    const nx = this.room.x + rnd(1, this.room.w - 1);
    const ny = this.room.y + rnd(1, this.room.h - 1);
    const fx = Math.floor(nx), fy = Math.floor(ny);
    if (fx >= 0 && fy >= 0 && fx < MAP_W && fy < MAP_H && isPassable(map[fy][fx])) {
      const dd = dist(nx, ny, this._tx, this._ty);
      if (dd > bestD && dd > 3) { bestX = nx; bestY = ny; bestD = dd; }
    }
  }
  this.x = bestX; this.y = bestY;
};

/**
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 * @returns {void}
 */
Enemy.prototype.aiPhantom = function aiPhantom(dt, player, map, d, los) {
  const bm = this.berserkerMul();
  const ocMul = _EG.modifier==='OVERCLOCK' ? 1.2 : 1;

  if (this._phState === 'cloaked') {
    this._phTimer -= dt * ocMul;
    if (los && this._canTarget() && d < 10) {
      const spd = modSpeed(this.spd * 1.3) * this.slowFactor * bm * (hasAugment('TEMPORAL_DILATION') ? 0.85 : 1);
      this.moveToward(this._tx, this._ty, spd, dt, map);
    } else {
      this.patrol(dt, map);
    }
    if (d < 2.5 && this._canTarget()) {
      this._phReposition(map, player);
      this._phTimer = 1.5 + rand('combat');
      return;
    }
    if (this._phTimer <= 0 && los && this._canTarget() && d >= 2.5 && d <= 8) {
      this._phState = 'telegraph';
      this._phTimer = 0.4;
      this.visible = true;
      const [dx, dy] = norm(this._tx - this.x, this._ty - this.y);
      this._phAimDx = dx; this._phAimDy = dy;
      return;
    }
    if (this._phTimer <= 0) this._phTimer = 1.0 + rand('combat') * 1.5;
    return;
  }

  if (this._phState === 'telegraph') {
    if (!los || !this._canTarget()) {
      this._phState = 'cloaked';
      this._phTimer = 1.5 + rand('combat');
      this.visible = false;
      return;
    }
    this._phTimer -= dt;
    if (this._phTimer <= 0) {
      this._phState = 'attacking';
      this._phBurstLeft = 2;
      this._phBurstDelay = 0;
      audio.phantomUncloak();
    }
    return;
  }

  if (this._phState === 'attacking') {
    this._phBurstDelay -= dt;
    if (this._phBurstLeft > 0 && this._phBurstDelay <= 0) {
      const p = new Projectile(this.x, this.y, this._phAimDx, this._phAimDy,
        8, this.atk, 14, this.colour, false, false);
      p.ownerType = this.type;
      projectiles.push(p);
      audio.phantomStrike();
      spawnParticles(this.x, this.y, 'MUZZLE', this.colour, 2);
      this._phBurstLeft--;
      this._phBurstDelay = 0.15;
    }
    if (this._phBurstLeft <= 0 && this._phBurstDelay <= 0) {
      this._phState = 'cooldown';
      this._phTimer = 1.5 / bm;
    }
    return;
  }

  if (this._phState === 'cooldown') {
    this._phTimer -= dt;
    if (d < 5 && this._canTarget()) {
      const [fx, fy] = norm(this.x - this._tx, this.y - this._ty);
      const rSpd = modSpeed(this.spd) * this.slowFactor * bm * (hasAugment('TEMPORAL_DILATION') ? 0.85 : 1);
      const nx = this.x + fx * rSpd * dt;
      const ny = this.y + fy * rSpd * dt;
      const fxI = Math.floor(nx), fyI = Math.floor(this.y);
      const xfI = Math.floor(this.x), yfI = Math.floor(ny);
      if (fxI >= 0 && fyI >= 0 && fxI < MAP_W && fyI < MAP_H && isPassable(map[fyI][fxI])) this.x = nx;
      if (xfI >= 0 && xfI < MAP_W && yfI >= 0 && yfI < MAP_H && isPassable(map[yfI][xfI])) this.y = ny;
    }
    if (this._phTimer <= 0) {
      this._phState = 'cloaked';
      this._phTimer = 2 + rand('combat') * 2;
      this.visible = false;
      audio.phantomCloak();
      if (!los || d > 8) this._phReposition(map, player);
    }
    return;
  }
};
