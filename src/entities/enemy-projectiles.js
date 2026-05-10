// @ts-check
'use strict';

/**
 * Fire a standard enemy projectile toward a target point.
 *
 * @this {Enemy}
 * @param {any} [px]
 * @param {any} [py]
 * @param {any} [spd]
 * @param {any} [dmg]
 * @param {any} [range]
 * @param {any} [colour]
 * @returns {void}
 */
Enemy.prototype.fireAt = function fireAt(px, py, spd, dmg, range, colour) {
  const [dx, dy] = norm(px - this.x, py - this.y);
  const p = new Projectile(this.x, this.y, dx, dy, spd, dmg, range, colour, false, false);
  p.ownerType = this.type;
  p._owner = this;
  projectiles.push(p);
  audio.shoot(false);
};
