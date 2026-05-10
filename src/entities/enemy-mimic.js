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
