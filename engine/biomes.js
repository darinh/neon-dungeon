// @ts-check
'use strict';
// Callers inject the area table. Narrative fields live in src/data/biomes.js, not here.
(function (root, factory) {
  const v = factory();
  if (typeof module === 'object' && module.exports) module.exports = v;
  else (/** @type {any} */ (root.NEON = root.NEON || {})).biomesEngine = v;
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  /**
   * @param {Array<{ floors: number[] } & Record<string, any>>} areas
   */
  function createBiomeRouter(areas) {
    if (!Array.isArray(areas) || areas.length === 0) {
      throw new Error('createBiomeRouter: areas must be a non-empty array');
    }
    for (let i = 0; i < areas.length; i++) {
      const a = areas[i];
      if (!a || !Array.isArray(a.floors) || a.floors.length === 0) {
        throw new Error('createBiomeRouter: area[' + i + '] missing floors[]');
      }
    }

    /** @param {number} f */
    function areaForFloor(f) {
      const n = Math.floor(Number(f));
      const first = /** @type {any} */ (areas[0]);
      const last = /** @type {any} */ (areas[areas.length - 1]);
      if (!Number.isFinite(n)) return first;
      if (n < (first.floors[0] ?? 1)) return first;
      for (const a of areas) if (a.floors.includes(n)) return a;
      // Above the last defined floor, clamp to the last area.
      return last;
    }

    /** @param {number} f */
    function isBiomeBossFloor(f) {
      for (const a of areas) if (a.floors[a.floors.length - 1] === f) return true;
      return false;
    }

    /** @param {number} f */
    function firstFloorOfBiomeContaining(f) {
      return /** @type {number} */ (areaForFloor(f).floors[0]);
    }

    /** @param {number} f */
    function biomeIndex(f) {
      const a = areaForFloor(f);
      return areas.indexOf(a);
    }

    /** @param {number} i */
    function areaForIndex(i) {
      const n = Math.floor(Number(i));
      const first = /** @type {any} */ (areas[0]);
      const last = /** @type {any} */ (areas[areas.length - 1]);
      if (!Number.isFinite(n) || n < 0) return first;
      if (n >= areas.length) return last;
      return /** @type {any} */ (areas[n]) ?? first;
    }

    function finalFloor() {
      const last = /** @type {any} */ (areas[areas.length - 1]);
      return /** @type {number} */ (last.floors[last.floors.length - 1]);
    }

    return {
      areas,
      areaForFloor,
      isBiomeBossFloor,
      firstFloorOfBiomeContaining,
      biomeIndex,
      areaForIndex,
      finalFloor,
    };
  }

  return { createBiomeRouter };
}));
