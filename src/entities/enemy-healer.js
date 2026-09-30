// @ts-check
'use strict';

/**
 * @this {Enemy}
 * @returns {any}
 */
Enemy.prototype._findHealTarget = function _findHealTarget() {
  let best = null, bestRatio = 1;
  for (const e of enemies) {
    if (e === this || e.dead || e.isBoss) continue;
    if (e._wrPhased) continue; // can't heal phased WRAITHs
    if (e.hp >= e.maxHp) continue;
    const ed = dist(this.x, this.y, e.x, e.y);
    if (ed > 6) continue;
    const ratio = e.hp / e.maxHp;
    if (ratio < bestRatio) { bestRatio = ratio; best = e; }
  }
  return best;
};

/**
 * @this {Enemy}
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 */
Enemy.prototype.aiHealer = function aiHealer(dt, player, map, d, los) {
  this._healTimer = Math.max(0, (this._healTimer || 0) - dt);
  this._healBeam = this._healBeam ? { ...this._healBeam, t: this._healBeam.t - dt } : null;
  if (this._healBeam && this._healBeam.t <= 0) this._healBeam = null;
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
  } else if (los && d <= 12) {
    if (this._healTimer <= 0) {
      const target = this._findHealTarget();
      if (target) {
        // 7.5% keeps absolute heal matched to player DPS after enemy HP doubled.
        const healAmt = Math.round(target.maxHp * 0.075);
        target.hp = Math.min(target.maxHp, target.hp + healAmt);
        this._healBeam = { tx: target.x, ty: target.y, t: 0.4 };
        this._healTimer = Math.max(2.0, 3.0 - (_EG.floor || 1) * 0.1) / (_EG.modifier === 'OVERCLOCK' ? 1.2 : 1) / bm;
        audio.heal();
        spawnParticles(this.x, this.y, 'MUZZLE', '#44ffaa', 5);
        spawnParticles(target.x, target.y, 'SPARK', '#44ffaa', 6);
      }
    }
  } else if (d > 12 && los) {
    this.moveToward(this._tx, this._ty, this.spd * 0.6, dt, map);
  } else {
    this.patrol(dt, map);
  }
};
