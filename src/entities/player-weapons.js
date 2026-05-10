// @ts-check
'use strict';

/**
 * Cycle the active weapon belt slot.
 *
 * @this {Player}
 * @param {number} [dir]
 * @returns {void}
 */
Player.prototype.cycleWeapon = function cycleWeapon(dir) {
  if (!this.weapons || this.weapons.length <= 1) return;
  this.weaponIdx = (this.weaponIdx + (dir || 1) + this.weapons.length) % this.weapons.length;
  this.weapon = this.weapons[this.weaponIdx];
  this.shootCooldown = 0;
};

/**
 * Add a weapon to the belt when a slot is open.
 *
 * @this {Player}
 * @param {any} w
 * @returns {boolean}
 */
Player.prototype.collectWeapon = function collectWeapon(w) {
  if (!this.weapons) { this.weapons = [this.weapon]; this.weaponIdx = 0; }
  const MAX_BELT = 3;
  if (this.weapons.length < MAX_BELT) {
    this.weapons.push(w);
    return true;
  }
  return false;
};

/**
 * Replace a weapon belt slot.
 *
 * @this {Player}
 * @param {number} slotIdx
 * @param {any} w
 * @returns {void}
 */
Player.prototype.swapWeapon = function swapWeapon(slotIdx, w) {
  if (!this.weapons || slotIdx < 0 || slotIdx >= this.weapons.length) return;
  this.weapons[slotIdx] = w;
  if (slotIdx === this.weaponIdx) this.weapon = w;
};

/**
 * Equip a weapon in the active belt slot.
 *
 * @this {Player}
 * @param {any} w
 * @returns {void}
 */
Player.prototype.equipWeapon = function equipWeapon(w) {
  if (!this.weapons) { this.weapons = []; this.weaponIdx = 0; }
  this.weapon = w;
  this.weapons[this.weaponIdx] = w;
  this.shootCooldown = 0;
};
