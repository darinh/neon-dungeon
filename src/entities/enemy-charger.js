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
Enemy.prototype.aiCharger = function aiCharger(dt, player, map, d, los) {
  this._chgCooldown = Math.max(0, (this._chgCooldown || 0) - dt);
  const bm = this.berserkerMul();

  if (this._chgState === 'charging') {
    this._chgDur -= dt;
    const cspd = 5.5 * bm;
    const nx = this.x + this._chgDx * cspd * dt;
    const ny = this.y + this._chgDy * cspd * dt;
    const fx = Math.floor(nx), fy = Math.floor(this.y);
    const xf = Math.floor(this.x), yf = Math.floor(ny);
    let hitWall = false;
    if (fx >= 0 && fy >= 0 && fx < MAP_W && fy < MAP_H && isPassable(map[fy][fx])) { this.x = nx; }
    else hitWall = true;
    if (xf >= 0 && yf >= 0 && xf < MAP_W && yf < MAP_H && isPassable(map[yf][xf])) { this.y = ny; }
    else hitWall = true;

    if (dist(this.x, this.y, player.x, player.y) < 1.2 && this._canTarget()) {
      const dealt = player.takeDamage(Math.round(this.atk * 1.5), this.type);
      if (dealt > 0) {
        const [kx, ky] = norm(player.x - this.x, player.y - this.y);
        // Wall-aware knockback: each axis is tested independently so a wall on one axis does not cancel the other.
        const nx = player.x + kx * 2, ny = player.y + ky * 2;
        const fxK = Math.floor(nx), fyK = Math.floor(player.y);
        const xfK = Math.floor(player.x), yfK = Math.floor(ny);
        if (fxK >= 0 && fxK < MAP_W && fyK >= 0 && fyK < MAP_H && isPassable(map[fyK][fxK])) player.x = nx;
        if (xfK >= 0 && xfK < MAP_W && yfK >= 0 && yfK < MAP_H && isPassable(map[yfK][xfK])) player.y = ny;
        spawnParticles(player.x, player.y, 'SPARK', '#ff6600', 8);
        triggerShake(5, 0.15);
        audio.chargerImpact();
      }
      this._chgState = 'idle';
      this._chgCooldown = Math.max(2.5, 3.5 - (_EG.floor || 1) * 0.1) / (_EG.modifier === 'OVERCLOCK' ? 1.2 : 1);
      return;
    }

    if (hitWall || this._chgDur <= 0) {
      if (hitWall) {
        spawnParticles(this.x, this.y, 'SPARK', '#ff6600', 6);
        triggerShake(3, 0.1);
        audio.chargerImpact();
        if (fx >= 0 && fx < MAP_W && fy >= 0 && fy < MAP_H && map[fy]?.[fx] === T.CRATE) damageCrateAtTile(fx, fy, Math.round(this.atk * 1.5));
        if (xf >= 0 && xf < MAP_W && yf >= 0 && yf < MAP_H && map[yf]?.[xf] === T.CRATE) damageCrateAtTile(xf, yf, Math.round(this.atk * 1.5));
      }
      this._chgState = 'idle';
      this.stunTimer = Math.max(this.stunTimer, 1.0);
      this._chgCooldown = Math.max(2.5, 3.5 - (_EG.floor || 1) * 0.1) / (_EG.modifier === 'OVERCLOCK' ? 1.2 : 1);
      return;
    }

    if (rand('cosmetic') < dt * 20) spawnParticles(this.x, this.y, 'SPARK', '#ff6600', 1);
    return;
  }

  if (this._chgState === 'windup') {
    if (!los || !this._canTarget()) {
      this._chgState = 'idle';
      this._chgCooldown = 1.0;
      return;
    }
    this._chgWindup -= dt;
    if (rand('cosmetic') < dt * 10) spawnParticles(this.x, this.y, 'SPARK', '#ff6600', 1);
    if (this._chgWindup <= 0) {
      this._chgState = 'charging';
      this._chgDur = 0.4;
      audio.chargerWindup();
    }
    return;
  }

  if (los && d < 2) {
    // Point-blank: melee, don't charge.
    this.moveToward(this._tx, this._ty, this.spd, dt, map);
    if (d < 1.2) {
      this.meleeAttack(player);
      this._chgCooldown = Math.max(this._chgCooldown, 1.5);
    }
  } else if (los && d >= 3 && d <= 10 && this._chgCooldown <= 0) {
    const [dx, dy] = norm(this._tx - this.x, this._ty - this.y);
    this._chgDx = dx; this._chgDy = dy;
    this._chgState = 'windup';
    this._chgWindup = 0.6;
  } else if (los && d < 8) {
    this.moveToward(this._tx, this._ty, this.spd, dt, map);
    if (d < 1.2) this.meleeAttack(player);
  } else {
    this.patrol(dt, map);
  }
};

