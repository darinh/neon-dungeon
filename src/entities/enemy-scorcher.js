'use strict';
// @ts-check

// ─── SCORCHER AI — Fire-Trail Pressure Unit ─────────────────────────────
/**
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 * @returns {void}
 */
Enemy.prototype.aiScorcher = function aiScorcher(dt, player, map, d, los) {
  this._scTrailTimer = Math.max(0, (this._scTrailTimer || 0) - dt);
  if (los || (d < 9 && this._canTarget())) {
    this.zigzag += dt * 4;
    const [dx, dy] = norm(this._tx - this.x, this._ty - this.y);
    const perp = { x: -dy, y: dx };
    const orbit = Math.sin((this._scStrafeSeed || 0) + this.zigzag) * 1.3;
    let tx = this._tx + perp.x * orbit;
    let ty = this._ty + perp.y * orbit;
    if (d < 2.2) {
      tx = this.x - dx * 2.2 + perp.x * orbit * 0.7;
      ty = this.y - dy * 2.2 + perp.y * orbit * 0.7;
    }
    this.moveToward(tx, ty, this.spd, dt, map);
    if (d < 1.2) this.meleeAttack(player);
    if (this._scTrailTimer <= 0) {
      let overlap = false;
      for (const z of hazardZones) {
        if (z.source !== 'Scorcher Trail') continue;
        if (z.age < 0.6 && dist(z.x, z.y, this.x, this.y) < 0.8) { overlap = true; break; }
      }
      if (!overlap) {
        hazardZones.push({
          x: this.x, y: this.y, radius: 0.75, age: 0, maxAge: 2.2, tickCd: 0,
          armTimer: 0.12, dmg: Math.max(1, Math.round(this.atk * 0.55)),
          colour: '#ff5a22', source: 'Scorcher Trail'
        });
        spawnParticles(this.x, this.y, 'SPARK', '#ff5a22', 2);
      }
      this._scTrailTimer = 0.35;
    }
  } else {
    this.patrol(dt, map);
  }
};
