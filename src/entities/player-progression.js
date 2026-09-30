// @ts-check
'use strict';

/**
 * @this {Player}
 * @returns {number}
 */
Player.prototype.xpNeeded = function xpNeeded() {
  return this.level * 80;
};

/**
 * @this {Player}
 * @param {any} [amount]
 * @returns {void}
 */
Player.prototype.gainXP = function gainXP(amount) {
  const augMul = hasAugment('NEURAL_LINK') ? 1.25 : 1;
  // Floor modifiers are mutually exclusive, so OVERFLOW and HARDENED cannot both apply.
  const overflowMul = (_EG.modifier === 'OVERFLOW') ? 1.25 : 1;
  this.xp += Math.round(amount * getMetaXPMultiplier() * augMul * overflowMul);
  while (this.xp >= this.xpNeeded() && this.level < 10) {
    this.xp -= this.xpNeeded();
    this.level++;
    this.maxHp += 20; this.hp = this.maxHp;
    this.atk += 3; this.def += 1;
    this.levelFlash = 1.5;
    audio.levelUp();
    _EG.msg('LEVEL UP! Now level ' + this.level, '#00f5ff');
    if (PERK_LEVELS.includes(this.level)) {
      _EG.pendingPerkChoices.push(this.level);
    }
    if (this.level === 10) grantCapstone(this);
  }
  // After the loop so stacked XP chips resolve before the perk UI opens.
  if (_EG.pendingPerkChoices.length && _EG.state === 'PLAYING') {
    _EG.openNextPerkChoice();
  }
};
