// @ts-check
'use strict';

// ─── VENGEANCE AI — Kill-Charged Retaliator ────────────────────────────
// Stationary turret (spd=0 base) that listens for in-room kills via the
// notifyVengeance hook and accumulates _vgCharges. On reaching
// VENGEANCE_THRESHOLD, transitions to RUSH state — telegraphs for
// VENGEANCE_TELEGRAPH seconds, then dashes at VENGEANCE_RUSH_SPD toward
// the player for VENGEANCE_RUSH_DURATION seconds, dealing melee damage
// on contact. After the rush ends (whether the player was hit or
// dodged) the charges and state reset.
//
// Niche: punishes mass-clearing. Slow play around a VENGEANCE is safe;
// hyperblasting a room triggers retaliation. Counter-play: priority-
// kill the VENGEANCE, dash through the strike (i-frames), or keep
// kills below the threshold by leaving VENGEANCE-adjacent enemies
// alive while you handle the rest.
//
// Hologram-taunt: rush commits to _tx/_ty (canonical, taunt-aware).
// A decoy throws the dash off-line — bait reward.
//
// States:
//   idle:  charges accumulate via notifyVengeance. When >= threshold
//          AND can target AND in LoS+range, enter rush.
//   rush:  _vgRushTimer ticks down. While > VENGEANCE_RUSH_DURATION,
//          we're in the TELEGRAPH sub-phase (render warning, hold
//          position). Once <= VENGEANCE_RUSH_DURATION, we're in the
//          STRIKE sub-phase (move toward _tx/_ty at VENGEANCE_RUSH_SPD,
//          melee on contact). On 0, reset.
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
      // Rush complete — reset.
      this._vgState = 'idle';
      this._vgRushTimer = 0;
      this._vgCharges = 0;
      return;
    }
    // STRIKE sub-phase: timer below the duration threshold means
    // telegraph window has expired and we're now committed to moving
    // toward the player (or decoy via _tx/_ty).
    const inStrike = this._vgRushTimer <= VENGEANCE_RUSH_DURATION;
    if (inStrike && this._canTarget()) {
      // Pass the raw rush speed — moveToward applies modSpeed
      // (OVERCLOCK +20%) + berserkerMul internally. Pre-multiplying
      // here would DOUBLE-apply both modifiers (caught by gpt-5.5
      // on initial PR review). VENGEANCE has spd=0 base so we use a
      // constant rather than `this.spd * mul`.
      this.moveToward(this._tx, this._ty, VENGEANCE_RUSH_SPD, dt, map);
      if (d < 1.2) this.meleeAttack(player);
    }
    return;
  }

  // IDLE: arm rush when charged + can target + in range with LoS.
  if (this._vgCharges >= VENGEANCE_THRESHOLD && this._canTarget()) {
    const dLock = dist(this.x, this.y, this._tx, this._ty);
    if (dLock <= VENGEANCE_RANGE && hasLOS(this.x, this.y, this._tx, this._ty, map)) {
      this._vgState = 'rush';
      // Combined timer: telegraph THEN strike. Sub-phase determined
      // by remaining vs strike-duration in the rush handler above.
      this._vgRushTimer = VENGEANCE_TELEGRAPH + VENGEANCE_RUSH_DURATION;
      if (audio.vengeanceCharge) audio.vengeanceCharge();
      return;
    }
  }
  // No rush available: hold position. Body-contact melee for the
  // player who runs INTO the turret (rare but consistent with how
  // every other body-melee mob behaves).
  if (d < 1.2) this.meleeAttack(player);
};
