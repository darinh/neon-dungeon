// @ts-check
'use strict';

// ─── MIRROR AI — Stationary Mimic Battery ──────────────────────────────
// Stationary mob (spd=0). Cycles silently, then commits to a single
// projectile telegraphed for MIRROR_TELEGRAPH seconds before firing.
// The hook: kinematics (speed, colour, range) are pulled from the
// player's last fired ranged shot — so the projectile coming back is
// visually + mechanically a copy of the player's own gun. Damage is
// mob-scaled (this.atk * MIRROR_DMG_MUL); the player's actual damage
// roll is NEVER replayed (late-game crits/perks would yield 200+ dmg).
// Replayed projectile is intentionally vanilla: no piercing, no
// ricochet, no homing — those player perks must not leak into enemy
// projectiles.
//
// Aim source is `_tx,_ty` (canonical taunt-aware target), so hologram
// decoys redirect the shot correctly with no special branch.
//
// States:
//   idle:      _miCharge ticks down. When 0 + inRoom + canTarget + LoS,
//              lock aim at (_tx,_ty), resolve kinematics from
//              player._shotHistory, enter telegraph.
//   telegraph: _miTele ticks down; aim line + colour-tinted ring rendered.
//              On 0, fire one projectile, transition to recovery.
//   recovery:  _miRec ticks down; on 0, reset _miCharge, return to idle.
/**
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 */
Enemy.prototype.aiMirror = function aiMirror(dt, player, map, d, los) {
  void d; void los; // recomputed against the lock for fairness
  const bm = this.berserkerMul();
  const ocMul = _EG.modifier === 'OVERCLOCK' ? 1.2 : 1;

  // Room-gated: only engage when target or player is inside this mob's room.
  const inRoom = this.room && (
    (this._tx >= this.room.x && this._tx < this.room.x + this.room.w &&
     this._ty >= this.room.y && this._ty < this.room.y + this.room.h) ||
    (player.x >= this.room.x && player.x < this.room.x + this.room.w &&
     player.y >= this.room.y && player.y < this.room.y + this.room.h));

  // ── Telegraph: aim line visible, fire on completion ──
  if (this._miState === 'telegraph') {
    this._miTele -= dt; // fixed-rate countdown — fairness > tempo
    if (this._miTele <= 0) {
      // FIRE: spawn a single projectile aimed at (_tx,_ty) using the
      // cached kinematics. Use the LOCKED aim (set at telegraph entry)
      // — chasing a moving player during the telegraph would defeat
      // the fairness window.
      const ax = this._miAimDx, ay = this._miAimDy;
      const dmg = Math.round(this.atk * MIRROR_DMG_MUL);
      const spd = this._miShotSpd || MIRROR_PROJ_SPD_DEF;
      const colour = this._miShotColour || '#88ff44';
      // Vanilla projectile — never piercing, never homing, never bouncing.
      // The 'false, false' tail is (piercing, friendly) per Projectile ctor.
      const p = new Projectile(this.x, this.y, ax, ay, spd, dmg,
                                MIRROR_PROJ_RANGE, colour, false, false);
      // Override the post-construction speed so the MIRROR_PROJ_SPD_*
      // clamp stays authoritative — Projectile._init applies the global
      // CHARGED modifier (*1.4) and KINETIC_AMPLIFIER multipliers
      // unconditionally, which would otherwise leak past our clamp band
      // and produce invisible-fast return shots on CHARGED floors.
      p.spd = spd;
      // Damage attribution: tag with our source label so death recap
      // and damage logs show "Mirror Shot" instead of generic "Projectile".
      p.ownerType = 'Mirror Shot';
      projectiles.push(p);
      if (audio.mirrorFire) audio.mirrorFire();
      spawnParticles(this.x, this.y, 'MUZZLE', colour, 4);
      triggerShake(1.5, 0.08);
      this._miState = 'recovery';
      this._miRec = MIRROR_RECOVERY;
      this._miTele = 0;
    }
    return;
  }

  // ── Recovery: cooling down, no aim attempts ──
  if (this._miState === 'recovery') {
    this._miRec -= dt * ocMul * bm;
    if (this._miRec <= 0) {
      this._miState = 'idle';
      this._miCharge = MIRROR_CHARGE;
    }
    return;
  }

  // ── Idle: silent charge, then try to commit ──
  this._miCharge = Math.max(0, (this._miCharge || 0) - dt * ocMul * bm);
  if (this._miCharge <= 0 && inRoom && this._canTarget()) {
    const dLock = dist(this.x, this.y, this._tx, this._ty);
    // Range gate is INCLUSIVE to match the engagement intuition.
    // dLock > 0.1 prevents the zero-aim edge case (target sitting exactly
    // on the apex would yield norm(0,0) = [0,0], producing an east-pointing
    // shot that misses — "phantom shot" bug; same lesson as RESONATOR).
    if (dLock > 0.1 && dLock <= MIRROR_RANGE && hasLOS(this.x, this.y, this._tx, this._ty, map)) {
      const [dx, dy] = norm(this._tx - this.x, this._ty - this.y);
      this._miAimDx = dx; this._miAimDy = dy;
      // Resolve kinematics at LOCK time (not fire time) so the telegraph
      // colour matches the shot the player is about to receive.
      const k = pickMirrorKinematics(player && player._shotHistory);
      this._miShotSpd = k.spd;
      this._miShotColour = k.colour;
      this._miState = 'telegraph';
      this._miTele = MIRROR_TELEGRAPH;
      if (audio.mirrorCharge) audio.mirrorCharge();
    }
  }
  // Stationary: never patrol, never reposition. Sitting duck by design.
};
