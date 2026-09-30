// @ts-check
'use strict';

// Player.reset initializes the history, Player.update appends it, and game.js loadFloor clears it.

/**
 * @this {Player}
 * @param {number} seconds
 * @returns {{x:number, y:number} | null}
 */
Player.prototype.getPositionAgo = function getPositionAgo(seconds) {
  return getPositionAgoFromHistory(this._posHistory, seconds);
};

/**
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
