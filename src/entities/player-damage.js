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
