// @ts-check
'use strict';
// engine/decor.js — pure helpers for per-tile decor scaffolding.
//
// Engine layer (🟦): no NEON DUNGEON nouns. All exports are pure values
// and pure functions over numbers; no module state, no globals consulted,
// no allocations per call.
//
// These primitives back the kind of per-tile decor systems found in
// tile-based renderers: a deterministic per-tile hash (so decor placement
// stays stable across frames without storage), a frozen 4-direction
// neighbour-offset table (read-only iteration in hot paths), and a
// scratch-object factory (single instance reused per call to avoid GC
// churn inside the per-tile draw loop).
//
// Surface:
//   tileHash(tx, ty, floor)
//     → uint32 hash of three integer coordinates. Same inputs always
//       produce the same output. Reasonable distribution for sparse-rate
//       gating and `% N` bucketing; NOT cryptographic.
//
//   NEIGHBOR_OFFSETS_4
//     → frozen [[0,-1],[0,1],[-1,0],[1,0]] (N, S, W, E). Inner arrays are
//       also frozen so iteration cannot accidentally mutate.
//
//   createContextScratch()
//     → returns a fresh mutable scratch object the host populates each
//       tile and returns to its draw loop. Shape:
//         { h:0, roll:0, wallSide:null, flicker:0,
//           alarmEligible:false, decorEligible:false }
//       Hosts hold ONE instance at module scope and overwrite fields per
//       tile — this is the hot-path allocation rule.
//
// Hot-path safe: every helper is allocation-free in the steady state. The
// host can call tileHash and read NEIGHBOR_OFFSETS_4 from inside per-tile
// loops without GC churn (per the `render hot path` memory).
//
// Browser: attaches as `window.NEON.decor`. Pure helpers only — does NOT
// own state (mirrors engine/draw.js / engine/touch.js / engine/viewport.js
// pure-helpers UMD pattern, not the engine/input.js / engine/audio.js
// createEngine factory pattern).
//
// Node: module.exports = { tileHash, NEIGHBOR_OFFSETS_4,
//                          createContextScratch }.

/* eslint-disable no-undef -- UMD root resolution: `module` ref */
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
   * Deterministic uint32 hash of three integer tile coordinates. Mixes
   * via Knuth-style large-prime multipliers + an xorshift step. Cheap
   * (no Math.* calls), stable across runs, decent low-bit distribution
   * for `% N` bucketing.
   *
   * NOT cryptographic. NOT collision-free. Suitable for sparse-rate
   * decor gating ("draw a prop on ~11% of tiles") and per-tile seeding
   * of secondary RNG.
   *
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
   * Cardinal neighbour offsets in N, S, W, E order. Frozen at module
   * load — both the outer array and each inner pair — so accidental
   * mutation throws in strict mode rather than silently corrupting the
   * shared table. Iterate by index for the lowest overhead.
   *
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
   * Allocate a fresh decor context scratch object. Hosts hold ONE
   * instance at module scope and overwrite its fields each tile, then
   * return the same reference to their per-tile draw loop. This avoids
   * per-tile object allocation in the render hot path.
   *
   * @returns {DecorContextScratch}
   */
  function createContextScratch() {
    return { h: 0, roll: 0, wallSide: null, flicker: 0, alarmEligible: false, decorEligible: false };
  }

  return { tileHash, NEIGHBOR_OFFSETS_4, createContextScratch };
}));
