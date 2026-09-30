// @ts-check
'use strict';
// tileHash is not cryptographic and not collision-free.
// Hosts must reuse one createContextScratch() instance per tile; allocating inside the draw loop churns GC.
// NEIGHBOR_OFFSETS_4 is frozen so a hot-path write throws instead of corrupting the shared table.

(function (root, factory) {
  const v = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = v;
    return;
  }
  const r = /** @type {any} */ (root);
  const ns = /** @type {any} */ (r.NEON = r.NEON || {});
  ns.decor = v;
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  /**
   * @param {number} tx
   * @param {number} ty
   * @param {number} floor
   * @returns {number}
   */
  function tileHash(tx, ty, floor) {
    let h = ((tx * 73856093) ^ (ty * 19349663) ^ ((floor | 0) * 83492791)) >>> 0;
    h ^= h >>> 13;
    return h >>> 0;
  }

  /**
   * @type {ReadonlyArray<readonly [number, number]>}
   */
  const NEIGHBOR_OFFSETS_4 = Object.freeze([
    Object.freeze(/** @type {[number, number]} */ ([0, -1])),
    Object.freeze(/** @type {[number, number]} */ ([0, 1])),
    Object.freeze(/** @type {[number, number]} */ ([-1, 0])),
    Object.freeze(/** @type {[number, number]} */ ([1, 0])),
  ]);

  /**
   * @typedef {Object} DecorContextScratch
   * @property {number} h          per-tile hash (uint32)
   * @property {number} roll       hash bucketed into 0..99
   * @property {('N'|'S'|'E'|'W'|null)} wallSide  which side neighbours a wall, if any
   * @property {number} flicker    per-frame brightness multiplier 0..1
   * @property {boolean} alarmEligible  caller passed an alarm-light gate
   * @property {boolean} decorEligible  caller passed a normal-decor gate
   */

  /**
   * Hosts hold ONE instance at module scope and overwrite its fields each tile.
   * Allocating inside the per-tile draw loop churns GC.
   *
   * @returns {DecorContextScratch}
   */
  function createContextScratch() {
    return { h: 0, roll: 0, wallSide: null, flicker: 0, alarmEligible: false, decorEligible: false };
  }

  return { tileHash, NEIGHBOR_OFFSETS_4, createContextScratch };
}));
