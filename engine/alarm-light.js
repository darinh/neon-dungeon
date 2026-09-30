// @ts-check
'use strict';
// Biome allowlist is injected by src/meta/alarm-light.js; this file has no game nouns.
(function (root, factory) {
  const v = factory();
  if (typeof module === 'object' && module.exports) module.exports = v;
  else (/** @type {any} */ (root.NEON = root.NEON || {})).alarmLightEngine = v;
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  // 31 is coprime with the decor roll's 100 (src/render.js, same hash), so alarm slots are independent of decor eligibility.
  /** @param {number} h */
  function isAlarmSlot(h) {
    return ((h >>> 0) % 31) === 0;
  }

  // abs(sin) at 2.2 rad/s is ~0.7 Hz; per-tile phase stops a room strobing in sync. 0.18 floor stays visibly powered.
  /** @param {unknown} floorTime @param {number} h */
  function intensity(floorTime, h) {
    const t = (typeof floorTime === 'number' && isFinite(floorTime)) ? floorTime : 0;
    const phase = (h >>> 0) % 17;
    const s = Math.abs(Math.sin(t * 2.2 + phase));
    return 0.18 + 0.82 * s;
  }

  /**
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
