// @ts-check
'use strict';

/**
 * @this {Player}
 * @returns {number}
 */
Player.prototype.computeOutgoingDmgMul = function computeOutgoingDmgMul() {
  return NEON.behavior.computeOutgoingDmgMul(this);
};

/**
 * @this {Player}
 * @returns {number}
 */
Player.prototype.effectiveAtk = function effectiveAtk() {
  let a = this.atk;
  if (this.perks.BERSERKER && this.hp / this.maxHp <= 0.25) a = Math.round(a * 1.4);
  if (this.lastStandTimer > 0) a = Math.round(a * 1.75);
  if (this.perks.PRISTINE && this.hp / this.maxHp >= 0.90) a = Math.round(a * 1.25);
  const ss = this._strideStacks || 0;
  if (this.perks.STRIDE && ss > 0) {
    a = Math.round(a * (1 + STRIDE_DMG_PER_STACK * ss));
  }
  if (this.perks.OVERDRIVE) {
    // Uses combo.count; updateCombo expires it after COMBO_WINDOW, and populateFloor also resets it.
    const c = (typeof combo !== 'undefined' && combo) ? combo.count : 0;
    if (c >= 2) {
      const bonus = Math.min(0.30, (c - 1) * 0.03);
      a = Math.round(a * (1 + bonus));
    }
  }
  if (this.perks.RETRIBUTION && this.retributionTimer > 0) a = Math.round(a * 1.5);
  // Paired +25% incoming amp lives in takeDamage, gated on !options.ignoreDefense so env DoT is not amplified.
  if (this.perks.GLASS_CANNON) a = Math.round(a * 1.30);
  return a;
};

/**
 * @this {Player}
 * @param {string} source
 * @param {number} amount
 * @returns {void}
 */
Player.prototype.logDamage = function logDamage(source, amount) {
  this.damageLog[source] = (this.damageLog[source] || 0) + amount;
};
