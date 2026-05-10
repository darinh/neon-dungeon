// @ts-check
'use strict';

/**
 * Consume one player weapon shot for the SURGE meta-upgrade cadence.
 *
 * @this {Player}
 * @returns {number}
 */
Player.prototype._consumeSurgeShot = function _consumeSurgeShot() {
  return NEON.behavior.consumeSurgeShot(this);
};
