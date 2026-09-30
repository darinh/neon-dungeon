// @ts-check
'use strict';

// Locks a past position, telegraphs it, then sets the shot range half a tile beyond it.
// Losing current LoS does not cancel an active aim; Enemy.update cancels it
// on stun, so the lane stays committed unless the ECHOER is stunned.
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

  // Lock acquisition is room-gated: start aiming only when the target or player is inside this echoer's room.
  const inRoom = this.room && (
    (this._tx >= this.room.x && this._tx < this.room.x + this.room.w &&
     this._ty >= this.room.y && this._ty < this.room.y + this.room.h) ||
    (player.x >= this.room.x && player.x < this.room.x + this.room.w &&
     player.y >= this.room.y && player.y < this.room.y + this.room.h));

  if (this._ecState === 'aiming') {
    this._ecAimTimer -= dt; // fixed-rate countdown — fairness > tempo

    if (d < 3 && this._canTarget()) {
      const [bx, by] = norm(this.x - this._tx, this.y - this._ty);
      this.moveToward(this.x + bx * 4, this.y + by * 4, this.spd * 1.1, dt, map);
    }

    if (this._ecAimTimer <= 0) {
      // Range overshoots the lock by 0.5 so a player standing on the point is still hit.
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

  if (this._ecCooldown <= 0 && inRoom && this._canTarget()) {
    // A hologram taunt points _tx/_ty at the decoy, like other enemies.
    // Lock there instead of the player's history.
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

  // Backstep when rushed: this is a zoner, not a melee fighter.
  if (d < 3 && this._canTarget()) {
    const [bx, by] = norm(this.x - this._tx, this.y - this._ty);
    this.moveToward(this.x + bx * 4, this.y + by * 4, this.spd, dt, map);
  } else if (!inRoom) {
    this.patrol(dt, map);
  }
};
