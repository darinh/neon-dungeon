// @ts-check
'use strict';

/**
 * @this {Enemy}
 * @param {any} [player]
 */
Enemy.prototype.revealMimic = function revealMimic(player) {
  if (!this._disguised) return;
  this._disguised = false;
  this._revealTimer = 0.3;
  audio.mimicReveal();
  spawnParticles(this.x, this.y, 'EXPLOSION', '#cc33ff', 18);
  triggerShake(4, 0.15);
  _EG.msg('⚠ MIMIC!', '#cc33ff');
  const [dx, dy] = norm(this._tx - this.x, this._ty - this.y);
  this._mimicLungeDx = dx;
  this._mimicLungeDy = dy;
};

/**
 * @this {Enemy}
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 */
Enemy.prototype.aiMimic = function aiMimic(dt, player, map, d, los) {
  if (this._revealTimer > 0) {
    this._revealTimer -= dt;
    if (this._revealTimer <= 0) {
      this._mimicBurstTimer = 3.0;
      if (d < 2.5 && this._canTarget()) {
        this.meleeAttack(player);
      }
    }
    return;
  }

  if (this._disguised) {
    this._mimicBob += dt * 2;
    if (d < 1.5) this.revealMimic(player);
    return;
  }

  this._mimicBurstTimer = Math.max(0, (this._mimicBurstTimer || 0) - dt);
  const burstMul = this._mimicBurstTimer > 0 ? 1.0 + 0.36 * (this._mimicBurstTimer / 3.0) : 1.0;
  const spd = this.spd * burstMul;

  if (los || (d < 8 && this._canTarget())) {
    this.zigzag += dt * 5;
    const [dx, dy] = norm(this._tx - this.x, this._ty - this.y);
    const perp = { x: -dy, y: dx };
    const tx = this._tx + perp.x * Math.sin(this.zigzag) * 1.2;
    const ty = this._ty + perp.y * Math.sin(this.zigzag) * 1.2;
    this.moveToward(tx, ty, spd, dt, map);
    if (d < 1.2) this.meleeAttack(player);
  } else {
    this.patrol(dt, map);
  }
};
