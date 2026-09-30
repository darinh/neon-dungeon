// @ts-check
'use strict';

/**
 * @this {Enemy}
 * @param {any} [map]
 * @param {any} [player]
 * @returns {{ x: number, y: number } | null}
 */
Enemy.prototype._wrFindEmergeTile = function _wrFindEmergeTile(map, player) {
  const tx = this._tx ?? player.x, ty = this._ty ?? player.y;
  let bestX = null, bestY = null, bestD = Infinity;
  for (let a = 0; a < 20; a++) {
    const angle = rand('combat') * TWO_PI;
    const r = 1.5 + rand('combat') * 2;
    const nx = tx + Math.cos(angle) * r;
    const ny = ty + Math.sin(angle) * r;
    const txx = Math.floor(nx), tyy = Math.floor(ny);
    if (txx < 0 || tyy < 0 || txx >= MAP_W || tyy >= MAP_H) continue;
    if (!isPassable(map[tyy][txx])) continue;
    const dd = dist(nx, ny, tx, ty);
    if (dd < bestD && dd > 1.2) { bestX = nx; bestY = ny; bestD = dd; }
  }
  if (bestX !== null) return { x: bestX, y: bestY };
  const cx = Math.floor(this.x), cy = Math.floor(this.y);
  if (cx >= 0 && cy >= 0 && cx < MAP_W && cy < MAP_H && isPassable(map[cy][cx])) {
    return { x: this.x, y: this.y };
  }
  for (let r = 1; r < 6; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        const tx = Math.floor(this.x) + dx, ty = Math.floor(this.y) + dy;
        if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H && isPassable(map[ty][tx])) {
          return { x: tx + 0.5, y: ty + 0.5 };
        }
      }
    }
  }
  return null;
};

/**
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 * @returns {void}
 */
Enemy.prototype.aiWraith = function aiWraith(dt, player, map, d, los) {
  const bm = this.berserkerMul();
  const ocMul = _EG.modifier === 'OVERCLOCK' ? 1.2 : 1;
  this._wrHitICD = Math.max(0, (this._wrHitICD || 0) - dt);

  if (this._wrState === 'phased') {
    this._wrTimer -= dt * ocMul;
    // No passability check: phased movement ignores walls.
    const spd = modSpeed(this.spd * 1.2) * this.slowFactor * bm * (hasAugment('TEMPORAL_DILATION') ? 0.85 : 1);
    const [dx, dy] = norm(this._tx - this.x, this._ty - this.y);
    const nx = this.x + dx * spd * dt;
    const ny = this.y + dy * spd * dt;
    this.x = Math.max(0.1, Math.min(MAP_W - 0.1, nx));
    this.y = Math.max(0.1, Math.min(MAP_H - 0.1, ny));
    if (rand('cosmetic') < dt * 6) spawnParticles(this.x, this.y, 'MUZZLE', '#66ffcc', 1);
    if (this._wrTimer <= 0 || (d < 3 && this._canTarget())) {
      const ex = this._wrFindEmergeTile(map, player);
      if (ex) {
        this.x = ex.x; this.y = ex.y;
        this._wrState = 'emerging';
        this._wrTimer = 0.5;
        audio.wraithPhaseIn();
      } else {
        this._wrTimer = 0.5;
      }
    }
    return;
  }

  if (this._wrState === 'emerging') {
    this._wrTimer -= dt;
    if (this._wrTimer <= 0) {
      this._wrState = 'corporeal';
      this._wrTimer = 2.0 + rand('combat');
      this._wrPhased = false;
      this._wrFireTimer = 0.3; // delay before the first corporeal shot
    }
    return;
  }

  if (this._wrState === 'corporeal') {
    this._wrTimer -= dt * ocMul;
    this._wrFireTimer = Math.max(0, (this._wrFireTimer || 0) - dt);
    if (los && d > 6) {
      this.moveToward(this._tx, this._ty, this.spd, dt, map);
    } else if (d < 3) {
      const [rx, ry] = norm(this.x - this._tx, this.y - this._ty);
      const rSpd = modSpeed(this.spd * 0.8) * this.slowFactor * bm * (hasAugment('TEMPORAL_DILATION') ? 0.85 : 1);
      const nx = this.x + rx * rSpd * dt;
      const ny = this.y + ry * rSpd * dt;
      const fxI = Math.floor(nx), fyI = Math.floor(this.y);
      const xfI = Math.floor(this.x), yfI = Math.floor(ny);
      if (fxI >= 0 && fyI >= 0 && fxI < MAP_W && fyI < MAP_H && isPassable(map[fyI][fxI])) this.x = nx;
      if (xfI >= 0 && xfI < MAP_W && yfI >= 0 && yfI < MAP_H && isPassable(map[yfI][xfI])) this.y = ny;
    } else if (los) {
      this.moveToward(this._tx, this._ty, this.spd * 0.5, dt, map);
    } else {
      this.patrol(dt, map);
    }
    if (this._wrFireTimer <= 0 && los && this._canTarget() && d < 10) {
      this.fireAt(this._tx, this._ty, 6, this.atk, 12, this.colour);
      this._wrFireTimer = 1.5 / bm;
    }
    if (this._wrTimer <= 0) {
      this._wrState = 'fading';
      this._wrTimer = 0.4;
      audio.wraithPhaseOut();
    }
    return;
  }

  // Still damageable: _wrPhased stays false until the timer ends.
  if (this._wrState === 'fading') {
    this._wrTimer -= dt;
    if (this._wrTimer <= 0) {
      this._wrState = 'phased';
      this._wrTimer = 2.0 + rand('combat');
      this._wrPhased = true;
    }
    return;
  }
};
