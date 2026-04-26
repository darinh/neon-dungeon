// @ts-check
'use strict';
// engine/particles.js — pooled particle system: pool + physics integration.
//
// Engine layer (🟦): no NEON DUNGEON nouns. Owns the data structure (a
// capped object pool with compact-in-place reclamation) and the per-frame
// physics step (Euler integration of velocity + gravity + lifetime decay).
// Knows NOTHING about particle "types" (EXPLOSION/SPARK/BLOOD/etc),
// colours, draw style, tile sizes, or the canvas. Those are gameplay
// vocabulary and stay in the host's content layer.
//
// Surface (factory):
//   createSystem({ cap?, burstScaleThreshold? })
//     → system. `cap` is the hard ceiling on TOTAL allocated slots
//       (alive + pooled). `burstScaleThreshold` is the alive-count above
//       which `scaleBurst()` halves new burst sizes to protect the frame
//       budget. Both have sensible defaults.
//
// System surface:
//   acquire()         → a fresh-or-recycled particle slot, or null if the
//                       pool is empty and `cap` is reached. Caller is
//                       responsible for filling EVERY field — slots may
//                       carry stale data from a previous life.
//   release(p)        → manually return a slot to the free pool. Normally
//                       not needed: `update()` reclaims dead slots
//                       automatically. Useful for synchronous purges.
//   update(dt)        → integrates each alive particle:
//                         x  += vx*dt
//                         y  += vy*dt
//                         vy += grav*dt
//                         life -= dt / maxLife
//                       Then compacts in-place and releases dead slots
//                       (life <= 0) back to the pool. O(n) over alive
//                       count, zero allocation in the steady state.
//   forEach(cb)       → iterates alive particles by index, lowest overhead.
//                       cb receives (particle, index).
//   clear()           → release every alive particle back to the pool.
//   scaleBurst(n)     → returns `max(1, n*0.5 | 0)` when alive count
//                       exceeds `burstScaleThreshold`, else `n` unchanged.
//                       Pure helper for callers building burst spawns.
//   count             → live particle count (getter).
//   pooled            → free-pool size (getter, mostly for tests).
//   capacity          → the hard cap (getter).
//
// Particle shape (engine-relevant fields only):
//   { x, y, vx, vy, life, maxLife, grav, alive }
// Plus carrier fields that engine ignores but preserves through the pool:
//   { size, colour, type }
// Hosts may attach more fields at will; the engine never reads them.
//
// Hot-path safe: zero allocation per update tick once the pool has warmed
// up. The compact-in-place pattern ensures `splice()` never runs in the
// per-frame path (per the `render hot path` memory).
//
// Browser: attaches as `window.NEON.particles` with `{ createSystem }`.
// Node: module.exports = { createSystem } (for tests).

/* eslint-disable no-undef -- UMD root resolution: `module` ref */
(function (root, factory) {
  const v = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = v;
    return;
  }
  const r = /** @type {any} */ (root);
  const ns = /** @type {any} */ (r.NEON = r.NEON || {});
  ns.particles = v;
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  /**
   * @typedef {Object} Particle
   * @property {number} x
   * @property {number} y
   * @property {number} vx
   * @property {number} vy
   * @property {number} life      remaining life, 1..0
   * @property {number} maxLife   total life in seconds; controls decay rate
   * @property {number} grav      vertical acceleration (units/s²)
   * @property {boolean} alive
   * @property {number} [size]    carrier — engine ignores
   * @property {string} [colour]  carrier — engine ignores
   * @property {string} [type]    carrier — engine ignores
   */

  /** @returns {Particle} */
  function _newSlot() {
    return {
      x: 0, y: 0, vx: 0, vy: 0,
      life: 0, maxLife: 1, grav: 0, alive: false,
      size: 1, colour: '#fff', type: '',
    };
  }

  /**
   * @param {{ cap?: number, burstScaleThreshold?: number }} [opts]
   */
  function createSystem(opts) {
    const cap = (opts && typeof opts.cap === 'number') ? (opts.cap | 0) : 2000;
    const burstScaleThreshold = (opts && typeof opts.burstScaleThreshold === 'number')
      ? (opts.burstScaleThreshold | 0)
      : 1500;

    /** @type {Particle[]} */ const alive = [];
    /** @type {Particle[]} */ const pool = [];

    function acquire() {
      const recycled = pool.pop();
      if (recycled) {
        alive.push(recycled);
        return recycled;
      }
      // Pool empty — check cap before allocating new.
      if (alive.length >= cap) return null;
      const p = _newSlot();
      alive.push(p);
      return p;
    }

    /** @param {Particle} p */
    function release(p) {
      const idx = alive.indexOf(p);
      if (idx === -1) return;
      p.alive = false;
      alive.splice(idx, 1);
      pool.push(p);
    }

    /** @param {number} dt */
    function update(dt) {
      let w = 0;
      for (let r = 0, n = alive.length; r < n; r++) {
        const p = alive[r];
        if (!p) continue; // satisfies noUncheckedIndexedAccess
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.grav * dt;
        p.life -= dt / p.maxLife;
        if (p.life <= 0) {
          p.alive = false;
          pool.push(p);
        } else {
          if (w !== r) alive[w] = p;
          w++;
        }
      }
      alive.length = w;
    }

    /** @param {(p: Particle, i: number) => void} cb */
    function forEach(cb) {
      for (let i = 0, n = alive.length; i < n; i++) {
        const p = alive[i];
        if (p) cb(p, i);
      }
    }

    function clear() {
      for (let i = 0, n = alive.length; i < n; i++) {
        const p = alive[i];
        if (!p) continue;
        p.alive = false;
        pool.push(p);
      }
      alive.length = 0;
    }

    /**
     * @param {number} n
     * @returns {number}
     */
    function scaleBurst(n) {
      if (alive.length > burstScaleThreshold) {
        const scaled = (n * 0.5) | 0;
        return scaled < 1 ? 1 : scaled;
      }
      return n;
    }

    return {
      acquire,
      release,
      update,
      forEach,
      clear,
      scaleBurst,
      get count() { return alive.length; },
      get pooled() { return pool.length; },
      get capacity() { return cap; },
    };
  }

  return { createSystem };
}));
