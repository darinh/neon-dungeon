// @ts-check
'use strict';

/**
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 */
Enemy.prototype.aiVengeance = function aiVengeance(dt, player, map, d, los) {
  void los;

  if (this._vgState === 'rush') {
    this._vgRushTimer -= dt;
    if (this._vgRushTimer <= 0) {
      this._vgState = 'idle';
      this._vgRushTimer = 0;
      this._vgCharges = 0;
      return;
    }
    // Combined timer: above VENGEANCE_RUSH_DURATION is still the telegraph.
    const inStrike = this._vgRushTimer <= VENGEANCE_RUSH_DURATION;
    if (inStrike && this._canTarget()) {
      // Raw speed. moveToward applies OVERCLOCK and berserkerMul; pre-multiplying would apply both twice. Base spd is 0, so this is a constant.
      this.moveToward(this._tx, this._ty, VENGEANCE_RUSH_SPD, dt, map);
      if (d < 1.2) this.meleeAttack(player);
    }
    return;
  }

  if (this._vgCharges >= VENGEANCE_THRESHOLD && this._canTarget()) {
    const dLock = dist(this.x, this.y, this._tx, this._ty);
    if (dLock <= VENGEANCE_RANGE && hasLOS(this.x, this.y, this._tx, this._ty, map)) {
      this._vgState = 'rush';
      // Telegraph, then strike. Sub-phase is remaining versus VENGEANCE_RUSH_DURATION.
      this._vgRushTimer = VENGEANCE_TELEGRAPH + VENGEANCE_RUSH_DURATION;
      if (audio.vengeanceCharge) audio.vengeanceCharge();
      return;
    }
  }
  // Stationary, but walking into the body still hurts.
  if (d < 1.2) this.meleeAttack(player);
};
