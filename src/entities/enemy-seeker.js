// @ts-check
'use strict';

/**
 * @this {Enemy}
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 * @returns {void}
 */
Enemy.prototype.aiSeeker = function aiSeeker(dt, player, map, d, los) {
  // Read by the seeker draw path; not used for movement.
  this._skProximity = los ? Math.max(0, 1 - d / 6) : 0;

  if (los && this._canTarget() && d <= 1.2 && player.dashTimer <= 0) {
    this._seekerDetonate(player, map);
    return;
  }

  if (los && this._canTarget()) {
    this.moveToward(this._tx, this._ty, this.spd, dt, map);
    if (rand('cosmetic') < dt * (6 + this._skProximity * 12))
      spawnParticles(this.x, this.y, 'SPARK', '#ffdd00', 1);
  } else {
    this.patrol(dt, map);
  }
};

/**
 * @this {Enemy}
 * @param {any} [player]
 * @param {any} [map]
 */
Enemy.prototype._seekerDetonate = function _seekerDetonate(player, map) {
  if (this.dead) return;
  const r = 2;
  const dmg = Math.round(this.atk * 1.5);
  spawnParticles(this.x, this.y, 'EXPLOSION', '#ffdd00', 22);
  spawnParticles(this.x, this.y, 'EXPLOSION', '#ff8800', 10);
  triggerShake(6, 0.2);
  audio.seekerDetonate();
  if (dist(player.x, player.y, this.x, this.y) < r && hasLOS(this.x, this.y, player.x, player.y, map)) {
    player.takeDamage(dmg, 'Seeker Blast');
  }
  for (const e of enemies) {
    if (e === this || e.dead) continue;
    if (e._wrPhased) continue;
    if (dist(e.x, e.y, this.x, this.y) < r && hasLOS(this.x, this.y, e.x, e.y, map)) {
      e.takeDamage(dmg, 'Seeker Blast');
    }
  }
  primeVCoresInRadius(this.x, this.y, r, map);
  damageCratesInRadius(this.x, this.y, r, dmg, map);
  damageBeaconsInRadius(this.x, this.y, r, dmg, map);
  damageShieldGensInRadius(this.x, this.y, r, dmg, map);
  damageCamerasInRadius(this.x, this.y, r, dmg, map);
  damageLasersInRadius(this.x, this.y, r, dmg, map);
  damageWallTurretsInRadius(this.x, this.y, r, dmg, map);
  triggerMinesInRadius(this.x, this.y, r, map);
  // die() is the shared death path (XP, credits, drops, VOLATILE). Do not splice the enemy here.
  this.hp = 0;
  this.die();
};
