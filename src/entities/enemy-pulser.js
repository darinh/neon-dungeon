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
Enemy.prototype.aiPulser = function aiPulser(dt, player, map, d, los) {
  const ocMul = _EG.modifier === 'OVERCLOCK' ? 1.2 : 1;
  const chargeRange = 6;

  if (this._plState === 'idle') {
    this._plCooldown = Math.max(0, (this._plCooldown || 0) - dt);
    if (los && this._canTarget() && d < chargeRange && this._plCooldown <= 0) {
      this._plState = 'charging';
      this._plTimer = 1.0;
      const [dx, dy] = norm(this._tx - this.x, this._ty - this.y);
      this._plAimDx = dx; this._plAimDy = dy;
      audio.pulserCharge();
      return;
    }
    if (los && this._canTarget() && d < chargeRange + 4) {
      this.moveToward(this._tx, this._ty, this.spd, dt, map);
    } else {
      this.patrol(dt, map);
    }
    return;
  }

  if (this._plState === 'charging') {
    // _canTarget is false while cloaked.
    if (!los || !this._canTarget() || d > chargeRange + 2) {
      this._plState = 'idle';
      this._plCooldown = 0.8;
      return;
    }
    const [dx, dy] = norm(this._tx - this.x, this._ty - this.y);
    this._plAimDx = dx; this._plAimDy = dy;
    this._plTimer -= dt * ocMul;
    if (this._plTimer <= 0) {
      const p = new Projectile(this.x, this.y, this._plAimDx, this._plAimDy,
        10, this.atk, 14, this.colour, false, false);
      p.ownerType = 'Pulser Bolt';
      projectiles.push(p);
      audio.pulserFire();
      spawnParticles(this.x, this.y, 'MUZZLE', this.colour, 4);
      this._plState = 'cooldown';
      this._plTimer = 2.5 / ocMul;
    }
    return;
  }

  if (this._plState === 'cooldown') {
    this._plTimer -= dt;
    // Axis-by-axis so a blocked axis does not cancel the free one.
    if (d < chargeRange && this._canTarget()) {
      const [fx, fy] = norm(this.x - this._tx, this.y - this._ty);
      const rSpd = modSpeed(this.spd * 0.5) * this.slowFactor * (hasAugment('TEMPORAL_DILATION') ? 0.85 : 1);
      const nx = this.x + fx * rSpd * dt;
      const ny = this.y + fy * rSpd * dt;
      const fxI = Math.floor(nx), fyI = Math.floor(this.y);
      const xfI = Math.floor(this.x), yfI = Math.floor(ny);
      if (fxI >= 0 && fyI >= 0 && fxI < MAP_W && fyI < MAP_H && isPassable(map[fyI][fxI])) this.x = nx;
      if (xfI >= 0 && xfI < MAP_W && yfI >= 0 && yfI < MAP_H && isPassable(map[yfI][xfI])) this.y = ny;
    }
    if (this._plTimer <= 0) {
      this._plState = 'idle';
      this._plCooldown = 0;
    }
    return;
  }
};
