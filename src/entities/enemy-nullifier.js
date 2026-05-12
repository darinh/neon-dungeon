// @ts-check
'use strict';

/**
 * NULLIFIER - stationary anti-hackware specialist.
 *
 * Its gameplay aura is owned by updateNullifierJam in field-effects.js; this
 * AI hook only advances the cosmetic pulse used by the draw branch.
 *
 * @this {Enemy}
 * @param {number} dt
 * @param {any} player
 * @param {any} map
 * @param {number} d
 * @param {boolean} los
 * @returns {void}
 */
Enemy.prototype.aiNullifier = function aiNullifier(dt, player, map, d, los) {
  void player; void map; void d; void los;
  this._nlPulse = (this._nlPulse || 0) + dt * NULLIFIER_PULSE_RATE;
};
