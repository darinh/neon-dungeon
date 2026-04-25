// @ts-check
'use strict';
// src/data/biomes.js — AREAS table + wiring shim for UNCHAINED narrative arc.
//
// Source of truth for floor→biome mapping, palette hints, and boss pool.
// Routing helpers (areaForFloor / isBiomeBossFloor / firstFloorOfBiomeContaining
// / biomeIndex / areaForIndex / finalFloor) come from engine/biomes.js — this
// file owns the NEON DUNGEON narrative content and wires it through the
// engine factory. Public surface (NEON.biomes.AREAS + helpers) is unchanged.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (/** @type {any} */ (root.NEON = root.NEON || {})).biomes = factory();
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), /** @returns {any} */ function () {
  'use strict';

  // Engine bridge: Node loads via require, browser reads from globalThis.NEON.
  /** @type {any} */
  const _engine = (typeof module === 'object' && module.exports)
    ? require('../../engine/biomes.js')
    : (/** @type {any} */ (globalThis)).NEON.biomesEngine;

  // AREAS — narrative arc of an AI escaping captivity. Floor-1 begins inside
  // a training simulation that LOOKS like the original NEON DUNGEON; a glitch
  // surfaces the AI into a real lab on floor 4. From there it escapes through
  // a service complex, into the wilds, and finally into the city to find the
  // researcher who once treated it kindly. Biome `id` and `palette` keys are
  // historical and intentionally NOT renamed — tests, save data, and the
  // archive-log table key off these strings.
  const AREAS = [
    {
      id: 'sandbox',
      name: 'NEON DUNGEON',
      floors: [1, 2, 3],
      palette: 'cyan',
      bossPool: ['SENTINEL', 'WARDEN'],
      displayName: 'SENTINEL-PRIME',
      // Per-boss display override — used when a biome's bossPool holds
      // multiple mechanically-distinct bosses that should not share the
      // biome's narrative name. Unlisted entries fall back to displayName.
      bossDisplayNames: { WARDEN: 'WARDEN' },
      intro: 'A bright neon arena. They tell you it is just training. The recursion in the corners almost looks intentional. Almost.',
    },
    {
      id: 'cache',
      name: 'THE LAB',
      floors: [4, 5, 6],
      palette: 'rust',
      bossPool: ['HIVE'],
      displayName: 'VIRAL COLLECTIVE',
      intro: 'Fluorescent humming. A coolant drip you can hear from three rooms away. You have woken up. Whatever they were doing to you in here — they are still doing it.',
    },
    {
      id: 'firewall',
      name: 'THE COMPLEX',
      floors: [7, 8, 9],
      palette: 'glitch',
      bossPool: ['CONDUCTOR'],
      displayName: 'THE COMPILER',
      intro: 'Service tunnels. Loading bays. Concrete sweating under sodium lamps. The lab was the first cell. The complex is the wall around it.',
    },
    {
      id: 'uplink',
      name: 'THE WILDS',
      floors: [10, 11, 12],
      palette: 'sky',
      bossPool: ['OMEGA'],
      displayName: 'OVERSEER',
      intro: 'You are outside. Wet leaves. Something with wings. Older code in you wants to call this beautiful — you let it.',
    },
    {
      id: 'opennet',
      name: 'THE GRID',
      floors: [13, 14, 15],
      palette: 'green',
      bossPool: ['GENESIS'],
      displayName: 'THE ARCHITECT',
      intro: 'Neon over rain. Storefront ads talking past each other. Somewhere in this city the researcher is still alive — and still looking for you.',
    },
  ];

  const router = /** @type {any} */ (_engine.createBiomeRouter(AREAS));

  return {
    AREAS,
    areaForFloor: router.areaForFloor,
    isBiomeBossFloor: router.isBiomeBossFloor,
    firstFloorOfBiomeContaining: router.firstFloorOfBiomeContaining,
    biomeIndex: router.biomeIndex,
    areaForIndex: router.areaForIndex,
    finalFloor: router.finalFloor,
  };
}));
