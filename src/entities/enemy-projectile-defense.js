// @ts-check
'use strict';

/**
 * @this {Enemy}
 * @param {any} [proj]
 * @returns {boolean}
 */
Enemy.prototype.blocksProjectile = function blocksProjectile(proj) {
  // Piercing and orbitals are excluded by the caller. A blocked hit damages shieldHp at the call site, not here. shieldBrokenTimer is seconds since break; -1 means intact.
  if (this.type === 'SHIELDER' && !this.dead && this.shieldHp > 0) {
    const incomingAngle = Math.atan2(-proj.dy, -proj.dx);
    let diff = incomingAngle - this.shieldAngle;
    while (diff > Math.PI) diff -= TWO_PI;
    while (diff < -Math.PI) diff += TWO_PI;
    return Math.abs(diff) < Math.PI / 3;
  }
  // Ally turret shots only. Player projectiles are reflected instead.
  if (this.type === 'REFLECTOR' && !this.dead) {
    const incomingAngle = Math.atan2(-proj.dy, -proj.dx);
    let diff = incomingAngle - this._rfAngle;
    while (diff > Math.PI) diff -= TWO_PI;
    while (diff < -Math.PI) diff += TWO_PI;
    return Math.abs(diff) < Math.PI / 4;
  }
  return false;
};

/**
 * @this {Enemy}
 * @param {any} [proj]
 * @returns {boolean}
 */
Enemy.prototype.reflectsProjectile = function reflectsProjectile(proj) {
  if (this.type !== 'REFLECTOR' || this.dead) return false;
  const incomingAngle = Math.atan2(-proj.dy, -proj.dx);
  let diff = incomingAngle - this._rfAngle;
  while (diff > Math.PI) diff -= TWO_PI;
  while (diff < -Math.PI) diff += TWO_PI;
  return Math.abs(diff) < Math.PI / 4;
};
