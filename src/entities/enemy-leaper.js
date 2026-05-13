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
Enemy.prototype.aiLeaper = function aiLeaper(dt, player, map, d, los) {
  this._lpCooldown = Math.max(0, (this._lpCooldown || 0) - dt);

  // Recovery: vulnerable after landing
  if (this._lpState === 'recovery') {
    this._lpRecovery -= dt;
    if (this._lpRecovery <= 0) {
      this._lpState = 'idle';
      this._lpCooldown = Math.max(2.0, 3.0 - (_EG.floor || 1) * 0.1);
    }
    return;
  }

  // Airborne: lerp to locked target position
  if (this._lpState === 'airborne') {
    this._lpAirTime -= dt;
    const t = 1 - Math.max(0, this._lpAirTime) / 0.35;
    this.x = this._lpFromX + (this._lpTargetX - this._lpFromX) * t;
    this.y = this._lpFromY + (this._lpTargetY - this._lpFromY) * t;
    // Parabolic height for visual (stored for draw, not real position)
    this._lpHeight = 4 * t * (1 - t) * 1.5; // peak at 1.5 tiles height

    if (this._lpAirTime <= 0) {
      // Land at target
      this.x = this._lpTargetX;
      this.y = this._lpTargetY;
      this._lpHeight = 0;
      this._lpState = 'recovery';
      this._lpRecovery = 1.0;
      audio.leaperLand();
      spawnParticles(this.x, this.y, 'EXPLOSION', '#22ff88', 14);
      triggerShake(4, 0.15);

      // Shockwave: 2-tile radius, LOS-gated, damages player + env
      const shockR = 2;
      const shockDmg = Math.round(this.atk * 1.2);
      if (dist(this.x, this.y, player.x, player.y) < shockR && this._canTarget() &&
          hasLOS(this.x, this.y, player.x, player.y, map)) {
        player.takeDamage(shockDmg, 'Leaper Shockwave');
      }
      // Environmental damage via proper helpers (handle destruction + rewards)
      if (typeof damageCratesInRadius === 'function') damageCratesInRadius(this.x, this.y, shockR, shockDmg, map);
      primeVCoresInRadius(this.x, this.y, shockR, map);
      damageBeaconsInRadius(this.x, this.y, shockR, shockDmg, map);
      damageShieldGensInRadius(this.x, this.y, shockR, shockDmg, map);
      damageCamerasInRadius(this.x, this.y, shockR, shockDmg, map);
      damageLasersInRadius(this.x, this.y, shockR, shockDmg, map);
      damageWallTurretsInRadius(this.x, this.y, shockR, shockDmg, map);
      // Trigger nearby mines
      for (const m of mines) {
        if (m.dead || m.state === 'detonated') continue;
        if (dist(this.x, this.y, m.x, m.y) < shockR) {
          m.state = 'armed';
          m.fuse = 0.1;
        }
      }
    }
    return;
  }

  // Windup: telegraph before jump
  if (this._lpState === 'windup') {
    if (!los || !this._canTarget()) {
      this._lpState = 'idle';
      this._lpCooldown = 1.0;
      return;
    }
    this._lpWindup -= dt;
    if (rand('cosmetic') < dt * 12) spawnParticles(this.x, this.y, 'SPARK', '#22ff88', 1);
    if (this._lpWindup <= 0) {
      // Validate landing tile: must be passable and have LOS from current pos
      const tx = Math.floor(this._lpTargetX), ty = Math.floor(this._lpTargetY);
      if (tx >= 0 && tx < MAP_W && ty >= 0 && ty < MAP_H &&
          isPassable(map[ty][tx]) && hasLOS(this.x, this.y, this._lpTargetX, this._lpTargetY, map)) {
        this._lpState = 'airborne';
        this._lpAirTime = 0.35;
        this._lpFromX = this.x;
        this._lpFromY = this.y;
        this._lpHeight = 0;
        audio.leaperWindup();
      } else {
        // Invalid target - cancel
        this._lpState = 'idle';
        this._lpCooldown = 1.0;
      }
    }
    return;
  }

  // Idle: patrol, approach, or initiate leap
  if (this.stunTimer > 0) return; // stun prevents leap initiation
  if (los && d >= 3 && d <= 10 && this._lpCooldown <= 0) {
    if (!/** @type {any} */ (this)._lpHasActivePeer()) {
      this._lpState = 'windup';
      this._lpWindup = 0.5;
      this._lpTargetX = this._tx;
      this._lpTargetY = this._ty;
      return;
    }
  }
  if (los && d < 6) {
    this.moveToward(this._tx, this._ty, this.spd, dt, map);
    if (d < 1.2) this.meleeAttack(player);
  } else {
    this.patrol(dt, map);
  }
};

