// @ts-check
'use strict';

// Lock trigger uses _tx/_ty so a hologram can bait a shot. Damage uses the
// real player against the frozen sweep angle, not the decoy position.
/**
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 */
Enemy.prototype.aiWatcher = function aiWatcher(dt, player, map, d, los) {
  void d; void los; // recomputed against the locked aim for fairness
  const bm = this.berserkerMul();
  const ocMul = _EG.modifier === 'OVERCLOCK' ? 1.2 : 1;

  const inRoom = this.room && (
    (this._tx >= this.room.x && this._tx < this.room.x + this.room.w &&
     this._ty >= this.room.y && this._ty < this.room.y + this.room.h) ||
    (player.x >= this.room.x && player.x < this.room.x + this.room.w &&
     player.y >= this.room.y && player.y < this.room.y + this.room.h));

  if (this._wState === 'telegraph') {
    this._wTele -= dt; // fixed-rate countdown — fairness > tempo
    if (this._wTele <= 0) {
      // Locked angle and the real player, not the live sweep or _tx/_ty.
      // takeDamage honors dash i-frames.
      const ax = Math.cos(this._wLockAng), ay = Math.sin(this._wLockAng);
      const dx = player.x - this.x, dy = player.y - this.y;
      const dPlayer2 = dx * dx + dy * dy;
      if (dPlayer2 <= WATCHER_RANGE * WATCHER_RANGE) {
        if (isInsideCone(player.x, player.y, this.x, this.y,
                         ax, ay, WATCHER_RANGE, WATCHER_HALF_RAD)
            && hasLOS(this.x, this.y, player.x, player.y, map)) {
          const dmg = Math.round(this.atk * WATCHER_DMG_MUL);
          player.takeDamage(dmg, 'Watcher Beam');
        }
      }
      if (audio.watcherFire) audio.watcherFire();
      const tipX = this.x + ax * WATCHER_RANGE * 0.5;
      const tipY = this.y + ay * WATCHER_RANGE * 0.5;
      spawnParticles(tipX, tipY, 'EXPLOSION', '#ffee66', 10);
      triggerShake(2, 0.10);
      this._wState = 'recovery';
      this._wRec = WATCHER_RECOVERY;
      this._wTele = 0;
      // Render keys the beam flash on this. Cleared on sweep resume and stun-cancel
      // so a cancelled telegraph never draws a fake beam.
      this._wFired = true;
    }
    return;
  }

  if (this._wState === 'recovery') {
    this._wRec -= dt * ocMul * bm;
    if (this._wRec <= 0) {
      this._wState = 'sweep';
      this._wFired = false;
    }
    return;
  }

  this._wAng = (this._wAng + dt * WATCHER_SWEEP_RATE * ocMul * bm) % (Math.PI * 2);

  // Lock test uses _tx/_ty (taunt). inRoom also accepts _tx/_ty so a hologram
  // in-room cannot retarget a player who is outside the room.
  if (!inRoom || !this._canTarget()) return;
  const dx = this._tx - this.x, dy = this._ty - this.y;
  const dPerceived2 = dx * dx + dy * dy;
  if (dPerceived2 > WATCHER_RANGE * WATCHER_RANGE) return;
  const ax = Math.cos(this._wAng), ay = Math.sin(this._wAng);
  if (!isInsideCone(this._tx, this._ty, this.x, this.y,
                    ax, ay, WATCHER_RANGE, WATCHER_HALF_RAD)) return;
  if (!hasLOS(this.x, this.y, this._tx, this._ty, map)) return;
  // Freeze the sweep angle, not the perceived target, so the beam stays dodgeable.
  this._wLockAng = this._wAng;
  this._wState = 'telegraph';
  this._wTele = WATCHER_TELEGRAPH;
  if (audio.watcherCharge) audio.watcherCharge();
  // No patrol: a missing move call here is the stationary design, not an omission.
};
