// @ts-check
'use strict';
// No gameplay nouns: particle types, colours, draw style, and tile size stay in the host.
// acquire() may return a recycled slot with stale fields; the caller must fill every field.
// update() compacts in place and does not allocate once the pool is warm (no splice on the hot path).
// cap counts alive + pooled slots. scaleBurst halves new bursts above burstScaleThreshold to protect the frame.

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
