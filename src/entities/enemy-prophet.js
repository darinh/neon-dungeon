'use strict';
// @ts-check

// ─── PROPHET AI — Future-Sight Predictor ────────────────────────────────
// The inverse of ECHOER. Locks onto the player's PREDICTED position
// PROPHET_LOOKAHEAD seconds ahead by linearly extrapolating velocity
// sampled over PROPHET_VEL_SAMPLE, telegraphs a ghost+lane, then fires.
// Counter-play: stop/feint; stillness below PROPHET_MIN_VEL prevents lock.
//
// Difference vs SNIPER: SNIPER tracks current position and line of sight;
// PROPHET commits to a future point and needs LoS to that future tile.
// Difference vs ECHOER: ECHOER punishes repetition (past position);
// PROPHET punishes continued motion (future position). They share the
// same player history ring but query opposite helpers.
//
// Hologram-taunt: when a taunt is active, lock at the decoy's
// position directly (no prediction — the decoy doesn't move). Mirrors
// the same explicit branch ECHOER needed because both mobs sample
// player state outside the canonical _tx/_ty path.
//
// States:
//   idle:   on cooldown OR scanning. When room-gated LoS is true and
//           the predicted future point is reachable (LoS to predicted)
//           AND vmag >= MIN_VEL, lock and enter aiming.
//   aiming: lock is fixed; ghost+lane render; brief backstep if rushed.
//           Cannot be interrupted by losing LoS to the current player —
//           the lane is committed and visible. Stun cancels.
/**
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 * @returns {void}
 */
Enemy.prototype.aiProphet = function aiProphet(dt, player, map, d, los) {
  void los; // we compute fresh LoS to the predicted point below
  const bm = this.berserkerMul();
  const ocMul = _EG.modifier === 'OVERCLOCK' ? 1.2 : 1;
  this._prCooldown = Math.max(0, (this._prCooldown || 0) - dt * ocMul * bm);

  // Room-gated: only engage when target or player is inside this prophet's room.
  const inRoom = this.room && (
    (this._tx >= this.room.x && this._tx < this.room.x + this.room.w &&
     this._ty >= this.room.y && this._ty < this.room.y + this.room.h) ||
    (player.x >= this.room.x && player.x < this.room.x + this.room.w &&
     player.y >= this.room.y && player.y < this.room.y + this.room.h));

  // ── Aiming: telegraph window, then fire ──
  if (this._prState === 'aiming') {
    this._prAimTimer -= dt; // fixed-rate countdown — fairness > tempo

    // Backstep if player has closed the distance during the telegraph.
    if (d < 3 && this._canTarget()) {
      const [bx, by] = norm(this.x - this._tx, this.y - this._ty);
      this.moveToward(this.x + bx * 4, this.y + by * 4, this.spd * 1.1, dt, map);
    }

    if (this._prAimTimer <= 0) {
      // Fire toward the locked future-position. Range is the straight
      // line to the lock plus a small overshoot so a player standing
      // exactly on the predicted point still takes the lane endpoint.
      const lx = this._prLockX, ly = this._prLockY;
      const [dx, dy] = norm(lx - this.x, ly - this.y);
      const range = Math.max(1, dist(this.x, this.y, lx, ly) + 0.5);
      const p = new Projectile(this.x, this.y, dx, dy, PROPHET_PROJ_SPD, this.atk, range, '#ffaa22', false, false);
      p.ownerType = 'Prophet Shot';
      projectiles.push(p);
      if (audio.prophetFire) audio.prophetFire();
      this._prState = 'idle';
      this._prAimTimer = 0;
      this._prCooldown = PROPHET_COOLDOWN;
    }
    return;
  }

  // ── Idle: try to lock when conditions allow ──
  if (this._prCooldown <= 0 && inRoom && this._canTarget()) {
    // Taunt redirection: when a hologram-taunt is active (_tx/_ty
    // point at the decoy), lock the decoy directly — predicting from
    // the decoy's velocity (zero) would otherwise trip the MIN_VEL
    // gate and PROPHET would never engage the decoy. Mirrors
    // aiEchoer's explicit taunt branch (lesson from PR #132 review).
    let lockX = 0, lockY = 0, haveLock = false;
    const taunt = this._tauntTarget;
    const tauntActive = taunt && taunt.age < taunt.maxAge;
    if (tauntActive) {
      lockX = this._tx; lockY = this._ty; haveLock = true;
    } else {
      const pred = _EG.player && _EG.player.getPredictedPosition
        ? _EG.player.getPredictedPosition(PROPHET_LOOKAHEAD)
        : null;
      // Stillness gate: refuse to lock on a near-stationary player.
      // That's the niche. Without this check PROPHET degenerates into
      // a slow-telegraph basic shooter.
      if (pred && pred.vmag >= PROPHET_MIN_VEL) {
        lockX = pred.x; lockY = pred.y; haveLock = true;
      }
    }
    if (haveLock) {
      // LoS + range gate to the predicted point. Range uses straight-
      // line distance to the lock (so a future point behind a wall
      // both fails LoS AND yields a sensible range cap).
      const dLock = dist(this.x, this.y, lockX, lockY);
      if (dLock < PROPHET_RANGE && hasLOS(this.x, this.y, lockX, lockY, map)) {
        this._prState = 'aiming';
        this._prAimTimer = PROPHET_TELEGRAPH;
        this._prLockX = lockX;
        this._prLockY = lockY;
        if (audio.prophetLock) audio.prophetLock();
        return;
      }
    }
  }

  // No lock available: hold position. If player rushes within 3 tiles,
  // backstep gently to maintain niche identity (anti-orbit zoner).
  if (d < 3 && this._canTarget()) {
    const [bx, by] = norm(this.x - this._tx, this.y - this._ty);
    this.moveToward(this.x + bx * 4, this.y + by * 4, this.spd, dt, map);
  } else if (!inRoom) {
    this.patrol(dt, map);
  }
  // else: hold position (menacing idle)
};
