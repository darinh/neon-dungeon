// @ts-check
'use strict';

/**
 * Return the XP required for the player's next level.
 *
 * @this {Player}
 * @returns {number}
 */
Player.prototype.xpNeeded = function xpNeeded() {
  return this.level * 80;
};

/**
 * Add XP, applying floor/meta/augment multipliers and resolving level-ups.
 *
 * @this {Player}
 * @param {any} [amount]
 * @returns {void}
 */
Player.prototype.gainXP = function gainXP(amount) {
  const augMul = hasAugment('NEURAL_LINK') ? 1.25 : 1;
  // OVERFLOW floor modifier: +25% XP gain on this floor. Composes
  // multiplicatively with NEURAL_LINK aug and getMetaXPMultiplier()
  // (meta-progression buff). Floor modifiers are mutually exclusive
  // per floor (only one rolls), so OVERFLOW + HARDENED can't co-occur.
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
  // Trigger perk choice UI after the loop (deferred so XP chips etc. resolve first)
  if (_EG.pendingPerkChoices.length && _EG.state === 'PLAYING') {
    _EG.openNextPerkChoice();
  }
};
