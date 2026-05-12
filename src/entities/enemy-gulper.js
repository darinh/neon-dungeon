// @ts-check
'use strict';

/**
 * GULPER — projectile-eating mid-tank (floor 6+, hp=90, atk=14,
 * spd=1.4). See GULPER_* tuning constants for design intent.
 *
 * State machine:
 *   chase     → walk toward player; mouth smooth-tracks via _glAimAngle;
 *               eat shots in mouth-cone, stack capped at MAX
 *   charging  → frozen; LOCK direction at _glLockDx/Dy taken from the
 *               smooth-tracked aim at lock-time; cone draws static at
 *               that direction; eat is OFF (cone is "loaded", not
 *               "open"); telegraph timer ticks down; on commit, fire
 *               belch ALONG the locked direction (NOT toward _tx/_ty)
 *               so visual telegraph and damage commit agree
 *   recovery  → brief pause after belch; cone draws faded-spent;
 *               eat OFF; melee still applies on adjacency
 *
 * Stun forces full defuse (handled in update() before AI dispatch —
 * see stun block; clears state, timers, AND stacks).
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

  // ── Mouth-aim direction. During CHASE the aim smooth-lerps toward
  // the TAUNT-AWARE perceived target (_tx/_ty — DECOY hologram during
  // taunt, else player). During CHARGING the aim is LOCKED to the
  // direction captured at charge-start so the cone is a static visual
  // telegraph the player can side-step out of. During RECOVERY we
  // also keep the aim locked (cone draws faded-spent in that frame).
  if (this._glState === 'chase') {
    const targetAng = Math.atan2(this._ty - this.y, this._tx - this.x);
    let diff = targetAng - this._glAimAngle;
    while (diff > Math.PI) diff -= TWO_PI;
    while (diff < -Math.PI) diff += TWO_PI;
    this._glAimAngle += diff * Math.min(1, GULPER_FACE_LERP * dt);
  }
  const aimDx = Math.cos(this._glAimAngle);
  const aimDy = Math.sin(this._glAimAngle);

  // ── Eat player projectiles in mouth-cone (CHASE only — cone is
  // "open" only while pre-charge; charging cone is "loaded", recovery
  // cone is "spent"). This gates draw/eat parity: the draw branch
  // renders the cone differently in non-chase states so the player
  // can read "no eating right now". Same exclusions as MAGNETON:
  // skip non-player, dead, grenade, homing.
  if (this._glState === 'chase' && this._glStacks < GULPER_MAX_STACKS) {
    for (const p of projectiles) {
      if (!p || p.dead) continue;
      if (!p.fromPlayer) continue;
      if (p.isGrenade) continue;
      if (p.homing) continue;
      if (!isInsideCone(p.x, p.y, this.x, this.y, aimDx, aimDy,
                        GULPER_MOUTH_RANGE, GULPER_MOUTH_HALF_ANGLE)) continue;
      // LOS gate AFTER cheap geometry reject — projectile behind a
      // wall corner shouldn't be eaten through it.
      if (!hasLOS(this.x, this.y, p.x, p.y, map)) continue;
      p.dead = true;
      // Hard cap at MAX — what you SEE in the tooth count is what
      // you GET in damage. No hidden over-cap scaling.
      this._glStacks = Math.min(GULPER_MAX_STACKS, this._glStacks + 1);
      spawnParticles(p.x, p.y, 'SPARK', this.colour, 2);
      if (this._glStacks >= GULPER_MAX_STACKS) break; // saturated
    }
  }

  // ── State transitions.
  if (this._glState === 'chase') {
    // Threshold trigger needs LOS so the gulper doesn't telegraph at
    // an unseen player (would be unfair: player can't react to a
    // belch they can't see coming).
    if (this._glStacks >= GULPER_MAX_STACKS && los && this._canTarget()) {
      this._glState = 'charging';
      this._glChargeTimer = GULPER_BELCH_TELEGRAPH;
      // LOCK aim to current smooth-tracked direction. Cone draw and
      // belch fire BOTH consume _glAimAngle from now until belch —
      // single source of truth for telegraph/commit parity.
      try { if (typeof audio !== 'undefined' && audio.gulperCharge) audio.gulperCharge(); }
      catch (_) { /* test stub */ }
    } else {
      // Normal chase. Slow walker; melee on adjacency.
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
    // Frozen during charge — no movement, but melee still applies if
    // player is in contact (gulper's body still hurts).
    if (d < 1.2) this.meleeAttack(player);
    if (this._glChargeTimer <= 0) {
      // Belch: fire along the LOCKED _glAimAngle direction (NOT toward
      // _tx/_ty). The cone the player saw IS the direction the spit
      // travels — telegraph/commit parity. Pick a target point one
      // tile out along the locked direction so fireAt's normalisation
      // produces the locked unit vector exactly.
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
