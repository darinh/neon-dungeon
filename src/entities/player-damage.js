// @ts-check
'use strict';

/**
 * Compute the player's outgoing weapon damage multiplier.
 *
 * @this {Player}
 * @returns {number}
 */
Player.prototype.computeOutgoingDmgMul = function computeOutgoingDmgMul() {
  return NEON.behavior.computeOutgoingDmgMul(this);
};

/**
 * Compute the player's current attack value after active perk modifiers.
 *
 * @this {Player}
 * @returns {number}
 */
Player.prototype.effectiveAtk = function effectiveAtk() {
  let a = this.atk;
  if (this.perks.BERSERKER && this.hp / this.maxHp <= 0.25) a = Math.round(a * 1.4);
  if (this.lastStandTimer > 0) a = Math.round(a * 1.75);
  if (this.perks.PRISTINE && this.hp / this.maxHp >= 0.90) a = Math.round(a * 1.25);
  // STRIDE: movement-built stacks. Multiplicative on top of any other
  // ATK-mod perks — they each gate on independent player state.
  const ss = this._strideStacks || 0;
  if (this.perks.STRIDE && ss > 0) {
    a = Math.round(a * (1 + STRIDE_DMG_PER_STACK * ss));
  }
  if (this.perks.OVERDRIVE) {
    // OVERDRIVE: piggybacks on the score-combo system (combo.count auto-clears
    // via COMBO_WINDOW=3s, so no loadFloor reset needed). +3% ATK per combo
    // level above 1, capped at +30% (combo 11+). Stacks multiplicatively with
    // BERSERKER, mirroring the established additive-by-default chokepoint.
    const c = (typeof combo !== 'undefined' && combo) ? combo.count : 0;
    if (c >= 2) {
      const bonus = Math.min(0.30, (c - 1) * 0.03);
      a = Math.round(a * (1 + bonus));
    }
  }
  // RETRIBUTION perk: +50% ATK while retributionTimer > 0. Multiplicative on
  // top of any other ATK-mod perks (each gates on independent player state,
  // so hit-trade builds can stack RETRIBUTION with BERSERKER/PRISTINE/
  // STRIDE/OVERDRIVE/LAST_STAND for brief windows by design).
  if (this.perks.RETRIBUTION && this.retributionTimer > 0) a = Math.round(a * 1.5);
  // GLASS_CANNON perk: passive +30% ATK with a paired +25% incoming damage
  // amp in takeDamage. Multiplicative on top of every other ATK-mod perk
  // (each gates on independent player state, by design — see RETRIBUTION
  // note above). The defensive cost lives in takeDamage gated on
  // !options.ignoreDefense so env DoT (Plasma/Toxic/Arc/Disruption/Frost)
  // doesn't get amplified into instakill territory; that is the
  // GLASS_CANNON safety contract — see takeDamage block.
  if (this.perks.GLASS_CANNON) a = Math.round(a * 1.30);
  return a;
};

/**
 * Add real player HP damage to the run damage-source log.
 *
 * @this {Player}
 * @param {string} source
 * @param {number} amount
 * @returns {void}
 */
Player.prototype.logDamage = function logDamage(source, amount) {
  this.damageLog[source] = (this.damageLog[source] || 0) + amount;
};
