// @ts-check
'use strict';

/**
 * Reveal a disguised MIMIC and lock its initial lunge toward the perceived target.
 *
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
  // Lock lunge direction toward perceived target
  const [dx, dy] = norm(this._tx - this.x, this._ty - this.y);
  this._mimicLungeDx = dx;
  this._mimicLungeDy = dy;
};

/**
 * MIMIC AI: disguised item bob, reveal telegraph, then burst melee chase.
 *
 * @this {Enemy}
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 */
Enemy.prototype.aiMimic = function aiMimic(dt, player, map, d, los) {
  // Reveal telegraph: expanding ring, no AI yet
  if (this._revealTimer > 0) {
    this._revealTimer -= dt;
    if (this._revealTimer <= 0) {
      // Lunge attack toward player position at reveal
      this._mimicBurstTimer = 3.0;
      if (d < 2.5 && this._canTarget()) {
        this.meleeAttack(player);
      }
    }
    return;
  }

  // Disguised: bob like an item, check proximity
  if (this._disguised) {
    this._mimicBob += dt * 2;
    if (d < 1.5) this.revealMimic(player);
    return;
  }

  // Combat: fast melee chase (burst speed decays over 3s)
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
