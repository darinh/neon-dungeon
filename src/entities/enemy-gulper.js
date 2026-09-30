// @ts-check
'use strict';

/**
 * Stun defuse (state, timers, and stacks) is in update() before this runs.
 *
 * @this {Enemy}
 * @param {number} dt
 * @param {any} player
 * @param {any} map
 * @param {number} d
 * @param {boolean} los
 * @returns {void}
 */
Enemy.prototype.aiGulper = function aiGulper(dt, player, map, d, los) {
  if (typeof this._glStacks !== 'number') this._glStacks = 0;
  if (typeof this._glState !== 'string') this._glState = 'chase';
  if (typeof this._glChargeTimer !== 'number') this._glChargeTimer = 0;
  if (typeof this._glRecoverTimer !== 'number') this._glRecoverTimer = 0;
  if (typeof this._glAimAngle !== 'number') this._glAimAngle = 0;
  if (typeof this._glPulse !== 'number') this._glPulse = 0;
  this._glPulse += dt;

  // Chase lerps toward taunt-aware _tx/_ty. Charge and recovery keep the lock so the cone is a static telegraph.
  if (this._glState === 'chase') {
    const targetAng = Math.atan2(this._ty - this.y, this._tx - this.x);
    let diff = targetAng - this._glAimAngle;
    while (diff > Math.PI) diff -= TWO_PI;
    while (diff < -Math.PI) diff += TWO_PI;
    this._glAimAngle += diff * Math.min(1, GULPER_FACE_LERP * dt);
  }
  const aimDx = Math.cos(this._glAimAngle);
  const aimDy = Math.sin(this._glAimAngle);

  // Eat only in chase so the cone draw matches. Skip grenades and homing, same as MAGNETON.
  if (this._glState === 'chase' && this._glStacks < GULPER_MAX_STACKS) {
    for (const p of projectiles) {
      if (!p || p.dead) continue;
      if (!p.fromPlayer) continue;
      if (p.isGrenade) continue;
      if (p.homing) continue;
      if (!isInsideCone(p.x, p.y, this.x, this.y, aimDx, aimDy,
                        GULPER_MOUTH_RANGE, GULPER_MOUTH_HALF_ANGLE)) continue;
      // LOS after the cheap cone reject so a corner cannot be eaten through.
      if (!hasLOS(this.x, this.y, p.x, p.y, map)) continue;
      p.dead = true;
      // Cap matches the visible tooth count; damage must not scale past it.
      this._glStacks = Math.min(GULPER_MAX_STACKS, this._glStacks + 1);
      spawnParticles(p.x, p.y, 'SPARK', this.colour, 2);
      if (this._glStacks >= GULPER_MAX_STACKS) break;
    }
  }

  if (this._glState === 'chase') {
    // Needs LOS: a telegraph the player cannot see is not reactable.
    if (this._glStacks >= GULPER_MAX_STACKS && los && this._canTarget()) {
      this._glState = 'charging';
      this._glChargeTimer = GULPER_BELCH_TELEGRAPH;
      // Lock _glAimAngle here; belch fires along it, not toward _tx/_ty.
      try { if (typeof audio !== 'undefined' && audio.gulperCharge) audio.gulperCharge(); }
      catch (_) { /* test stub */ }
    } else {
      if (los && this._canTarget() && d < 14) this.state = 'CHASE';
      else if (!los || d > 16) this.state = 'PATROL';
      if (this.state === 'CHASE') {
        this.moveToward(this._tx, this._ty, this.spd, dt, map);
        if (d < 1.2) this.meleeAttack(player);
      } else {
        this.patrol(dt, map);
      }
    }
  } else if (this._glState === 'charging') {
    this._glChargeTimer -= dt;
    // No movement while charging; contact melee still applies.
    if (d < 1.2) this.meleeAttack(player);
    if (this._glChargeTimer <= 0) {
      // One tile along the lock so fireAt's normalisation keeps that unit vector.
      const stacksConsumed = this._glStacks;
      const dmg = this.atk + GULPER_BELCH_DMG_PER_STACK * stacksConsumed;
      const tx = this.x + aimDx;
      const ty = this.y + aimDy;
      this.fireAt(tx, ty, GULPER_BELCH_SPD, dmg,
                  GULPER_BELCH_RANGE, this.colour);
      try { if (typeof audio !== 'undefined' && audio.gulperBelch) audio.gulperBelch(); }
      catch (_) { /* test stub */ }
      spawnParticles(this.x + aimDx * 0.6, this.y + aimDy * 0.6,
                     'SPARK', this.colour, 6);
      this._glStacks = 0;
      this._glChargeTimer = 0;
      this._glRecoverTimer = GULPER_BELCH_RECOVERY;
      this._glState = 'recovery';
    }
  } else if (this._glState === 'recovery') {
    this._glRecoverTimer -= dt;
    if (d < 1.2) this.meleeAttack(player);
    if (this._glRecoverTimer <= 0) {
      this._glState = 'chase';
    }
  }
};
