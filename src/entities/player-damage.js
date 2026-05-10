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
