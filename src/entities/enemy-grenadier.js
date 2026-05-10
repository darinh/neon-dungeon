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
