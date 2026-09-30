// @ts-check
'use strict';

// Commits to a predicted tile, not current position. Aiming ignores current LoS; stun cancel is in update(). Shares ECHOER's history ring but queries the future.
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

  const inRoom = this.room && (
    (this._tx >= this.room.x && this._tx < this.room.x + this.room.w &&
     this._ty >= this.room.y && this._ty < this.room.y + this.room.h) ||
    (player.x >= this.room.x && player.x < this.room.x + this.room.w &&
     player.y >= this.room.y && player.y < this.room.y + this.room.h));

  if (this._prState === 'aiming') {
    this._prAimTimer -= dt; // fixed-rate countdown — fairness > tempo

    if (d < 3 && this._canTarget()) {
      const [bx, by] = norm(this.x - this._tx, this.y - this._ty);
      this.moveToward(this.x + bx * 4, this.y + by * 4, this.spd * 1.1, dt, map);
    }

    if (this._prAimTimer <= 0) {
      // +0.5 overshoot so a player standing on the lock still meets the lane endpoint.
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

  if (this._prCooldown <= 0 && inRoom && this._canTarget()) {
    // Taunt: lock the decoy directly. Its zero velocity would fail MIN_VEL and never engage.
    let lockX = 0, lockY = 0, haveLock = false;
    const taunt = this._tauntTarget;
    const tauntActive = taunt && taunt.age < taunt.maxAge;
    if (tauntActive) {
      lockX = this._tx; lockY = this._ty; haveLock = true;
    } else {
      const pred = _EG.player && _EG.player.getPredictedPosition
        ? _EG.player.getPredictedPosition(PROPHET_LOOKAHEAD)
        : null;
      // Below MIN_VEL, do not lock — stillness is the counterplay.
      if (pred && pred.vmag >= PROPHET_MIN_VEL) {
        lockX = pred.x; lockY = pred.y; haveLock = true;
      }
    }
    if (haveLock) {
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

  // In-room with no lock: hold. Backstep only if rushed inside 3 tiles.
  if (d < 3 && this._canTarget()) {
    const [bx, by] = norm(this.x - this._tx, this.y - this._ty);
    this.moveToward(this.x + bx * 4, this.y + by * 4, this.spd, dt, map);
  } else if (!inRoom) {
    this.patrol(dt, map);
  }
};
