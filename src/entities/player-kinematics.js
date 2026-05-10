// @ts-check
'use strict';

// Player history accessors used by predictive enemies. The history ring itself
// remains owned by Player.reset()/update(); this module keeps the accessors next
// to the shared pure kinematics helpers.

/**
 * Returns the player's recorded position from `seconds` ago, or null if the
 * history doesn't go back that far (e.g. just spawned, just crossed a floor).
 *
 * @this {Player}
 * @param {number} seconds
 * @returns {{x:number, y:number} | null}
 */
Player.prototype.getPositionAgo = function getPositionAgo(seconds) {
  return getPositionAgoFromHistory(this._posHistory, seconds);
};

/**
 * Returns the player's predicted position `seconds` in the future, extrapolated
 * from the current position and recent velocity.
 *
 * @this {Player}
 * @param {number} seconds
 * @returns {{x:number, y:number, vx:number, vy:number, vmag:number} | null}
 */
Player.prototype.getPredictedPosition = function getPredictedPosition(seconds) {
  return predictFromHistory(
    this._posHistory, this.x, this.y,
    seconds, PROPHET_VEL_SAMPLE, PROPHET_VEL_CAP
  );
};
