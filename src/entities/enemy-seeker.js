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
  // Proximity glow ramp (used by draw)
  this._skProximity = los ? Math.max(0, 1 - d / 6) : 0;

  if (los && this._canTarget() && d <= 1.2 && player.dashTimer <= 0) {
    // Detonate on contact
    this._seekerDetonate(player, map);
    return;
  }

  if (los && this._canTarget()) {
    // Rush directly toward player at full speed
    this.moveToward(this._tx, this._ty, this.spd, dt, map);
    // Trail particles — intensity ramps with proximity
    if (rand('cosmetic') < dt * (6 + this._skProximity * 12))
      spawnParticles(this.x, this.y, 'SPARK', '#ffdd00', 1);
  } else {
    this.patrol(dt, map);
  }
};

/**
 * Detonate a SEEKER, damaging nearby actors and environmental entities.
 *
 * @this {Enemy}
 * @param {any} [player]
 * @param {any} [map]
 */
Enemy.prototype._seekerDetonate = function _seekerDetonate(player, map) {
  if (this.dead) return;
  const r = 2;
  const dmg = Math.round(this.atk * 1.5);
  // Visual + audio
  spawnParticles(this.x, this.y, 'EXPLOSION', '#ffdd00', 22);
  spawnParticles(this.x, this.y, 'EXPLOSION', '#ff8800', 10);
  triggerShake(6, 0.2);
  audio.seekerDetonate();
  // Damage player (LOS-gated)
  if (dist(player.x, player.y, this.x, this.y) < r && hasLOS(this.x, this.y, player.x, player.y, map)) {
    player.takeDamage(dmg, 'Seeker Blast');
  }
  // Damage other enemies
  for (const e of enemies) {
    if (e === this || e.dead) continue;
    if (e._wrPhased) continue;
    if (dist(e.x, e.y, this.x, this.y) < r && hasLOS(this.x, this.y, e.x, e.y, map)) {
      e.takeDamage(dmg, 'Seeker Blast');
    }
  }
  // Chain to env entities
  primeVCoresInRadius(this.x, this.y, r, map);
  damageCratesInRadius(this.x, this.y, r, dmg, map);
  damageBeaconsInRadius(this.x, this.y, r, dmg, map);
  damageShieldGensInRadius(this.x, this.y, r, dmg, map);
  damageCamerasInRadius(this.x, this.y, r, dmg, map);
  damageLasersInRadius(this.x, this.y, r, dmg, map);
  damageWallTurretsInRadius(this.x, this.y, r, dmg, map);
  triggerMinesInRadius(this.x, this.y, r, map);
  // Kill self (normal death path for XP/credits/drops/VOLATILE)
  this.hp = 0;
  this.die();
};
