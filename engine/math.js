// @ts-check
'use strict';
// engine/math.js — pure math + RNG primitives, zero engine state.
//
// Engine layer (🟦): no NEON DUNGEON nouns, no DOM, no globals beyond UMD mount.
// All functions are referentially transparent except `rnd`/`rndInt`, which are
// thin wrappers over `Math.random()` and inherit its non-determinism.
//
// Surface:
//   rnd(min, max)            → uniform float in [min, max)
//   rndInt(min, max)         → uniform int in [min, max] inclusive
//   clamp(v, lo, hi)         → v constrained to [lo, hi]
//   dist(ax, ay, bx, by)     → euclidean distance
//   dist2(ax, ay, bx, by)    → squared distance (cheap; preferred for compares)
//   norm(dx, dy)             → [nx, ny] unit vector; (0,0) → (0,0)
//   lerp(a, b, t)            → linear interp; no clamping of t
//
// Browser: attaches as `window.NEON.math` AND mounts each function as a bare
// global (rnd/rndInt/clamp/dist/dist2/norm/lerp) for back-compat with the
// existing UMD script-tag callers in src/*.js. Must load BEFORE src/platform.js.
//
// Node: module.exports = { rnd, rndInt, clamp, dist, dist2, norm, lerp }.
(function (root, factory) {
  const v = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = v;
    return;
  }
  const r = /** @type {any} */ (root);
  const ns = /** @type {any} */ (r.NEON = r.NEON || {});
  ns.math = v;
  // Bare globals for back-compat with existing call sites.
  r.rnd = v.rnd;
  r.rndInt = v.rndInt;
  r.clamp = v.clamp;
  r.dist = v.dist;
  r.dist2 = v.dist2;
  r.norm = v.norm;
  r.lerp = v.lerp;
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  /** @param {number} min @param {number} max */
  function rnd(min, max) { return min + Math.random() * (max - min); }

  /** @param {number} min @param {number} max */
  function rndInt(min, max) { return Math.floor(rnd(min, max + 1)); }

  /** @param {number} v @param {number} lo @param {number} hi */
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /** @param {number} ax @param {number} ay @param {number} bx @param {number} by */
  function dist(ax, ay, bx, by) {
    const dx = ax - bx, dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** @param {number} ax @param {number} ay @param {number} bx @param {number} by */
  function dist2(ax, ay, bx, by) {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  }

  /** @param {number} dx @param {number} dy @returns {[number, number]} */
  function norm(dx, dy) {
    const l = Math.sqrt(dx * dx + dy * dy) || 1;
    return [dx / l, dy / l];
  }

  /** @param {number} a @param {number} b @param {number} t */
  function lerp(a, b, t) { return a + (b - a) * t; }

  return { rnd, rndInt, clamp, dist, dist2, norm, lerp };
}));
