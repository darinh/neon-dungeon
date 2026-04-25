// @ts-check
'use strict';
// engine/alarm-light.js — pure pulse math + DI factory for alarm-light decor.
//
// Engine layer (🟦): zero NEON DUNGEON nouns. The biome allowlist is injected
// by the game-side wrapper at src/meta/alarm-light.js.
//
// Exports (UMD):
//   isAlarmSlot(h)            — pure: ((h>>>0) % 31) === 0  (~3.2% true)
//   intensity(floorTime, h)   — pure: 0.18 + 0.82 * |sin(t*2.2 + (h%17))|
//   createAlarmLight({ allowedBiomes }) — factory returning a configured
//     surface { allowedBiomes, isAlarmSlot, intensity, shouldDraw } where
//     shouldDraw(biomeId, h) = allowedBiomes.has(biomeId) && isAlarmSlot(h).
//
// Browser: attaches as window.NEON.alarmLightEngine.
// Node:    module.exports = { isAlarmSlot, intensity, createAlarmLight }.
(function (root, factory) {
  const v = factory();
  if (typeof module === 'object' && module.exports) module.exports = v;
  else (/** @type {any} */ (root.NEON = root.NEON || {})).alarmLightEngine = v;
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  // Per-tile probability that a tile is alarm-eligible. Modulus 31 is prime
  // + coprime with 100 (the regular decor roll) so neighbouring tiles don't
  // cluster. Density tuning notes — see src/meta/alarm-light.js header.
  /** @param {number} h */
  function isAlarmSlot(h) {
    return ((h >>> 0) % 31) === 0;
  }

  // intensity — 0..1 brightness for this frame. Slow asymmetric pulse
  // (~0.7 Hz nominal, hash-offset per tile so multiple lights in a room
  // don't sync into a strobe). Floor of 0.18 keeps the bulb visible in
  // the dark phase so it reads as "powered" rather than "dead".
  /** @param {unknown} floorTime @param {number} h */
  function intensity(floorTime, h) {
    const t = (typeof floorTime === 'number' && isFinite(floorTime)) ? floorTime : 0;
    const phase = (h >>> 0) % 17;
    const s = Math.abs(Math.sin(t * 2.2 + phase));
    return 0.18 + 0.82 * s;
  }

  /**
   * Build a configured alarm-light surface bound to a specific biome
   * allowlist. Allows the engine to be reused by other games / decor
   * passes by injecting their own biome ids.
   *
   * @param {{ allowedBiomes?: Set<string> | string[] | null }} [opts]
   */
  function createAlarmLight(opts) {
    const raw = opts && opts.allowedBiomes;
    /** @type {Set<string>} */
    const allowed = (raw instanceof Set)
      ? raw
      : new Set(Array.isArray(raw) ? raw : []);

    /** @param {unknown} biomeId @param {number} h */
    function shouldDraw(biomeId, h) {
      if (typeof biomeId !== 'string' || !allowed.has(biomeId)) return false;
      return isAlarmSlot(h);
    }

    return {
      allowedBiomes: allowed,
      isAlarmSlot,
      intensity,
      shouldDraw,
    };
  }

  return { isAlarmSlot, intensity, createAlarmLight };
}));
