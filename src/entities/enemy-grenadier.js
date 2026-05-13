// @ts-check
'use strict';

/**
 * Launch a grenade projectile toward a target tile.
 *
 * @this {Enemy}
 * @param {any} [tx]
 * @param {any} [ty]
 * @param {any} [map]
 */
Enemy.prototype.lobGrenade = function lobGrenade(tx, ty, map) {
  // Create a grenade projectile targeting (tx,ty)
  const [dx, dy] = norm(tx - this.x, ty - this.y);
  const g = new Projectile(this.x, this.y, dx, dy, 6, 0, 20, '#ff6622', false, false);
  g.isGrenade = true;
  g.targetX = tx;
  g.targetY = ty;
  g.grenadeDmg = this.atk; // already floor-scaled from spawnEnemy
  projectiles.push(g);
  audio.grenadeLob();
};

/**
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 */
Enemy.prototype.aiGrenadier = function aiGrenadier(dt, player, map, d, los) {
  this.grenadeTimer = Math.max(0, this.grenadeTimer - dt);
  const bm = this.berserkerMul();
  if (los && d < 5) {
    // Too close — retreat
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
  } else if (los && d <= 12) {
    if (this.grenadeTimer <= 0) {
      this.lobGrenade(this._tx, this._ty, map);
      this.grenadeTimer = Math.max(2.5, 3.5 - (_EG.floor || 1) * 0.1) / (_EG.modifier==='OVERCLOCK'?1.2:1) / bm;
    }
  } else if (d > 12 && los) {
    this.moveToward(this._tx, this._ty, this.spd * 0.7, dt, map);
  } else {
    this.patrol(dt, map);
  }
};
