// @ts-check
'use strict';

// ─── ECHOER AI — Sonar Predictor ────────────────────────────────────────
// Punishes pattern movement: locks onto the player's position from
// ECHOER_LOOKBACK seconds ago, telegraphs a ghost + dashed lane for
// ECHOER_TELEGRAPH seconds, then fires a slow projectile that dissipates
// at the locked point. Counter-play: change direction unpredictably.
//
// States:
//   idle:   on cooldown OR scanning. When room-gated LoS is true and the
//           past-position is reachable (LoS to past-pos), lock and enter
//           aiming.
//   aiming: lock is fixed; ghost+lane render; brief backstep if rushed.
//           Cannot be interrupted by losing LoS to current player —
//           the lane is committed and visible. Stun cancels.
/**
 * @this {Enemy}
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 * @returns {void}
 */
Enemy.prototype.aiEchoer = function aiEchoer(dt, player, map, d, los) {
  void los; // we compute fresh LoS to the past-position below
  const bm = this.berserkerMul();
  const ocMul = _EG.modifier === 'OVERCLOCK' ? 1.2 : 1;
  this._ecCooldown = Math.max(0, (this._ecCooldown || 0) - dt * ocMul * bm);

  // Room-gated: only engage when target or player is inside this echoer's room.
  const inRoom = this.room && (
    (this._tx >= this.room.x && this._tx < this.room.x + this.room.w &&
     this._ty >= this.room.y && this._ty < this.room.y + this.room.h) ||
    (player.x >= this.room.x && player.x < this.room.x + this.room.w &&
     player.y >= this.room.y && player.y < this.room.y + this.room.h));

  // ── Aiming: telegraph window, then fire ──
  if (this._ecState === 'aiming') {
    this._ecAimTimer -= dt; // fixed-rate countdown — fairness > tempo

    // Backstep if player has closed the distance during the telegraph.
    if (d < 3 && this._canTarget()) {
      const [bx, by] = norm(this.x - this._tx, this.y - this._ty);
      this.moveToward(this.x + bx * 4, this.y + by * 4, this.spd * 1.1, dt, map);
    }

    if (this._ecAimTimer <= 0) {
      // Fire toward the locked past-position. Dissipates at the locked
      // point (small overshoot so a player standing exactly there still
      // takes a hit at the lane endpoint).
      const lx = this._ecLockX, ly = this._ecLockY;
      const [dx, dy] = norm(lx - this.x, ly - this.y);
      const range = Math.max(1, dist(this.x, this.y, lx, ly) + 0.5);
      const p = new Projectile(this.x, this.y, dx, dy, ECHOER_PROJ_SPD, this.atk, range, '#aa66ff', false, false);
      p.ownerType = this.type;
      projectiles.push(p);
      if (audio.echoerFire) audio.echoerFire();
      this._ecState = 'idle';
      this._ecAimTimer = 0;
      this._ecCooldown = ECHOER_COOLDOWN;
    }
    return;
  }

  // ── Idle: try to lock when conditions allow ──
  if (this._ecCooldown <= 0 && inRoom && this._canTarget()) {
    // Taunt redirection: when a hologram-taunt is active (_tx/_ty point
    // at the decoy), every other enemy targets the decoy. Mirror that
    // behavior here — lock at the decoy's position rather than reading
    // from the real player's history. Otherwise: use the predictive
    // past-position from player history (the actual ECHOER mechanic).
    let lockX = 0, lockY = 0, haveLock = false;
    const taunt = this._tauntTarget;
    const tauntActive = taunt && taunt.age < taunt.maxAge;
    if (tauntActive) {
      lockX = this._tx; lockY = this._ty; haveLock = true;
    } else {
      const past = _EG.player && _EG.player.getPositionAgo
        ? _EG.player.getPositionAgo(ECHOER_LOOKBACK)
        : null;
      if (past) { lockX = past.x; lockY = past.y; haveLock = true; }
    }
    if (haveLock) {
      // Need LoS from echoer to the lock point. Range gate uses
      // straight-line distance to the lock.
      const dLock = dist(this.x, this.y, lockX, lockY);
      if (dLock < ECHOER_RANGE && hasLOS(this.x, this.y, lockX, lockY, map)) {
        this._ecState = 'aiming';
        this._ecAimTimer = ECHOER_TELEGRAPH;
        this._ecLockX = lockX;
        this._ecLockY = lockY;
        if (audio.echoerLock) audio.echoerLock();
        return;
      }
    }
  }

  // No lock available: hold position. If player rushes within 3 tiles,
  // backstep gently to maintain niche identity (anti-orbit zoner, not
  // a melee combatant).
  if (d < 3 && this._canTarget()) {
    const [bx, by] = norm(this.x - this._tx, this.y - this._ty);
    this.moveToward(this.x + bx * 4, this.y + by * 4, this.spd, dt, map);
  } else if (!inRoom) {
    this.patrol(dt, map);
  }
  // else: hold position (menacing idle)
};
