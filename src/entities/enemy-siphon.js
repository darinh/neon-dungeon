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
Enemy.prototype.aiSiphon = function aiSiphon(dt, player, map, d, los) {
  const bm = this.berserkerMul();
  // Frenzy latch: once below 40% HP, permanently activated
  if (!this._spFrenzy && this.hp < this.maxHp * 0.4) {
    this._spFrenzy = true;
    audio.siphonFrenzy();
    spawnParticles(this.x, this.y, 'SPARK', '#dd2244', 12);
  }
  const fireInterval = (this._spFrenzy ? 1.0 : 2.0) / (_EG.modifier === 'OVERCLOCK' ? 1.2 : 1) / bm;
  this._spFireTimer = Math.max(0, (this._spFireTimer || 0) - dt);
  // Drain beam fade
  if (this._spDrainBeam) {
    this._spDrainBeam.t -= dt;
    if (this._spDrainBeam.t <= 0) this._spDrainBeam = null;
  }

  if (los && d < 4) {
    // Too close - retreat
    this.moveToward(this.x + (this.x - this._tx), this.y + (this.y - this._ty), this.spd, dt, map);
  } else if (los && d <= 9) {
    // In range - fire drain projectile
    if (this._spFireTimer <= 0) {
      this.fireAt(this._tx, this._ty, 7, this.atk, 12, '#dd2244');
      this._spFireTimer = fireInterval;
    }
  } else if (los && d > 9) {
    this.moveToward(this._tx, this._ty, this.spd * 0.6, dt, map);
  } else {
    this.patrol(dt, map);
  }
};
