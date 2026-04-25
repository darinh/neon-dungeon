// @ts-check
'use strict';
// src/meta/alarm-light.js — atmospheric alarm-light decor math.
//
// Pure helpers used by render.js to decide whether a wall-mounted decor
// slot should become a pulsing red alarm beacon, and what intensity to
// draw it at this frame. Canvas draw lives in render.js (uses module
// globals like ctx/TILE); only the math + biome opt-in live here so they
// can be unit tested without a DOM.
//
// UMD: exports as Node module OR attaches to global NEON.alarmLight.
(function (root, factory) {
  const v = factory();
  if (typeof module === 'object' && module.exports) module.exports = v;
  else (/** @type {any} */ (root.NEON = root.NEON || {})).alarmLight = v;
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  // Biomes that opt in to alarm lights. Keyed by AREAS[i].id from
  // src/data/biomes.js. Other biomes can join by adding their id here —
  // no render.js change required.
  const ALARM_BIOMES = new Set(['cache', 'firewall']);

  // Per-tile probability that a tile is alarm-eligible. Independent of
  // the regular decor-density roll, so alarms aren't competing with
  // consoles for the same scarce "wall-mount" budget. Modulus 31 is
  // prime + coprime with 100 (the regular roll modulus) so neighboring
  // tiles don't cluster.
  //
  // Density tuning: ~3.2% raw, but the floor-hash distribution biases
  // (h % 31) ≈ 2× higher than uniform on small structured tile ranges,
  // so observed density per room ends up:
  //   5×5  →  ~1.0 alarms
  //   8×8  →  ~1.8 alarms
  //   12×12 → ~2.8 alarms
  // Lands inside the requested 1-3 per room band across the typical
  // room-size mix. Verified empirically with the seed used by the
  // procedural generator.
  /** @param {number} h */
  function isAlarmSlot(h) {
    return ((h >>> 0) % 31) === 0;
  }

  // shouldDraw — true iff this biome opts in AND the tile won the slot.
  // Call from render.js with the biome id and the per-tile decor hash.
  /** @param {string} biomeId @param {number} h */
  function shouldDraw(biomeId, h) {
    if (!ALARM_BIOMES.has(biomeId)) return false;
    return isAlarmSlot(h);
  }

  // intensity — 0..1 brightness for this frame. Slow asymmetric pulse
  // (~0.7 Hz nominal, hash-offset per tile so multiple lights in a room
  // don't sync into a strobe). Floor of 0.18 keeps the bulb visible in
  // the dark phase so it reads as "powered" rather than "dead".
  //
  // floorTime is seconds (game.floorTime). h is the tile decor hash —
  // any 32-bit unsigned int works.
  /** @param {number} floorTime @param {number} h */
  function intensity(floorTime, h) {
    const t = (typeof floorTime === 'number' && isFinite(floorTime)) ? floorTime : 0;
    const phase = (h >>> 0) % 17; // 0..16, integer rad offset
    const s = Math.abs(Math.sin(t * 2.2 + phase));
    return 0.18 + 0.82 * s;
  }

  return {
    ALARM_BIOMES,
    isAlarmSlot,
    shouldDraw,
    intensity,
  };
}));
