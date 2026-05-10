// @ts-check
'use strict';

/**
 * Elite affix combat tempo multiplier: scales speed and cooldowns.
 *
 * @this {Enemy}
 * @returns {number}
 */
Enemy.prototype.berserkerMul = function berserkerMul() {
  if (this.eliteAffix === 'BERSERKER') return 1 + 0.5 * (1 - this.hp / this.maxHp);
  if (this.eliteAffix === 'FRENZY' && this.frenzyStacks > 0) return 1 + 0.4 * this.frenzyStacks;
  if (this.eliteAffix === 'PREDATOR' && this.predatorBuffTimer > 0) return 1.3;
  return 1;
};
