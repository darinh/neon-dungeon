// @ts-check
'use strict';

// Aim locks on taunt-aware `_tx,_ty`, so a hologram redirects the cone with no extra branch.
/**
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 */
Enemy.prototype.aiResonator = function aiResonator(dt, player, map, d, los) {
  void d; void los; // recomputed against the lock for fairness
  const bm = this.berserkerMul();
  const ocMul = _EG.modifier === 'OVERCLOCK' ? 1.2 : 1;

  const inRoom = this.room && (
    (this._tx >= this.room.x && this._tx < this.room.x + this.room.w &&
     this._ty >= this.room.y && this._ty < this.room.y + this.room.h) ||
    (player.x >= this.room.x && player.x < this.room.x + this.room.w &&
     player.y >= this.room.y && player.y < this.room.y + this.room.h));

  if (this._rsState === 'telegraph') {
    this._rsTele -= dt; // fixed-rate countdown — fairness > tempo
    if (this._rsTele <= 0) {
      // LoS is rechecked at fire time. takeDamage honors dash i-frames.
      const ax = this._rsAimDx, ay = this._rsAimDy;
      const dx = player.x - this.x, dy = player.y - this.y;
      const dPlayer2 = dx*dx + dy*dy;
      if (dPlayer2 <= RESONATOR_RANGE * RESONATOR_RANGE) {
        if (isInsideCone(player.x, player.y, this.x, this.y,
                         ax, ay, RESONATOR_RANGE, RESONATOR_HALF_RAD)
            && hasLOS(this.x, this.y, player.x, player.y, map)) {
          const dmg = Math.round(this.atk * RESONATOR_DMG_MUL);
          player.takeDamage(dmg, 'Resonator Cone');
        }
      }
      if (audio.resonatorFire) audio.resonatorFire();
      const tipX = this.x + ax * RESONATOR_RANGE * 0.6;
      const tipY = this.y + ay * RESONATOR_RANGE * 0.6;
      spawnParticles(tipX, tipY, 'EXPLOSION', '#ff66cc', 10);
      triggerShake(2, 0.10);
      this._rsState = 'recovery';
      this._rsRec = RESONATOR_RECOVERY;
      this._rsTele = 0;
    }
    return;
  }

  if (this._rsState === 'recovery') {
    this._rsRec -= dt * ocMul * bm;
    if (this._rsRec <= 0) {
      this._rsState = 'idle';
      this._rsCharge = RESONATOR_CHARGE;
    }
    return;
  }

  this._rsCharge = Math.max(0, (this._rsCharge || 0) - dt * ocMul * bm);
  if (this._rsCharge <= 0 && inRoom && this._canTarget()) {
    const dLock = dist(this.x, this.y, this._tx, this._ty);
    // Range gate is INCLUSIVE to match isInsideCone / fire-time geometry.
    // dLock > 0.1 prevents the zero-aim edge case (target sitting exactly
    // on the apex would yield norm(0,0) = [0,0], producing an east-pointing
    // visual that never hits — "phantom cone" bug).
    if (dLock > 0.1 && dLock <= RESONATOR_RANGE && hasLOS(this.x, this.y, this._tx, this._ty, map)) {
      const [dx, dy] = norm(this._tx - this.x, this._ty - this.y);
      this._rsAimDx = dx; this._rsAimDy = dy;
      this._rsState = 'telegraph';
      this._rsTele = RESONATOR_TELEGRAPH;
      if (audio.resonatorCharge) audio.resonatorCharge();
    }
  }
  // Stationary: no patrol. Absence is intentional.
};
