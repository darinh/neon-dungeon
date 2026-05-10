// @ts-check
'use strict';

/**
 * Return true when this enemy's directional defense blocks a projectile.
 *
 * @this {Enemy}
 * @param {any} [proj]
 * @returns {boolean}
 */
Enemy.prototype.blocksProjectile = function blocksProjectile(proj) {
  // SHIELDER: 120° frontal arc — blocks player projectiles (not piercing/
  // orbitals). Shield is BREAKABLE: each blocked hit deals damage to shieldHp
  // at the call site. shieldBrokenTimer is elapsed time since break (-1 means
  // not broken).
  if (this.type === 'SHIELDER' && !this.dead && this.shieldHp > 0) {
    const incomingAngle = Math.atan2(-proj.dy, -proj.dx);
    let diff = incomingAngle - this.shieldAngle;
    while (diff > Math.PI) diff -= TWO_PI;
    while (diff < -Math.PI) diff += TWO_PI;
    return Math.abs(diff) < Math.PI / 3;
  }
  // REFLECTOR: 90° arc — blocks ally turret projectiles (player projectiles are reflected instead).
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
 * Return true when this enemy reflects an incoming player projectile.
 *
 * @this {Enemy}
 * @param {any} [proj]
 * @returns {boolean}
 */
Enemy.prototype.reflectsProjectile = function reflectsProjectile(proj) {
  // REFLECTOR: 90° frontal arc reflects player projectiles back at them.
  if (this.type !== 'REFLECTOR' || this.dead) return false;
  const incomingAngle = Math.atan2(-proj.dy, -proj.dx);
  let diff = incomingAngle - this._rfAngle;
  while (diff > Math.PI) diff -= TWO_PI;
  while (diff < -Math.PI) diff += TWO_PI;
  return Math.abs(diff) < Math.PI / 4;
};
