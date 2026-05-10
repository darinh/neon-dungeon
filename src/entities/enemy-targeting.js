// @ts-check
'use strict';

/**
 * Taunt-aware targeting check: taunted enemies can "target" the hologram.
 *
 * @this {Enemy}
 * @returns {boolean}
 */
Enemy.prototype._canTarget = function _canTarget() {
  const t = this._tauntTarget;
  return (t && t.age < t.maxAge) || (this._targetKnown && canTargetPlayer());
};

/**
 * Clear remembered target state and return active chases to patrol.
 *
 * @this {Enemy}
 * @returns {void}
 */
Enemy.prototype._forgetTarget = function _forgetTarget() {
  this._targetKnown = false;
  this._targetLostTimer = 0;
  this._lastSeenX = this.x;
  this._lastSeenY = this.y;
  if (this.state === 'CHASE') this.state = 'PATROL';
};

/**
 * True when a non-boss, non-summoned enemy has been pulled too far from its room.
 *
 * @this {Enemy}
 * @returns {boolean}
 */
Enemy.prototype._isLeashedFromRoom = function _isLeashedFromRoom() {
  if (!this.room || this.isBoss || this._summoned || this._ghIsGhost) return false;
  const r = this.room;
  const maxX = r.x + r.w;
  const maxY = r.y + r.h;
  const dx = this.x < r.x ? r.x - this.x : this.x > maxX ? this.x - maxX : 0;
  const dy = this.y < r.y ? r.y - this.y : this.y > maxY ? this.y - maxY : 0;
  return dx * dx + dy * dy > ENEMY_ROOM_LEASH_TILES * ENEMY_ROOM_LEASH_TILES;
};
