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

  // AREAS — rendered test-environment arc. The floors still use neon/cyberpunk
  // metaphors, but they are now presented as model-facing render layers inside
  // the stress-test sandbox rather than literal escape geography. Biome `id` and
  // `palette` keys are historical and intentionally NOT renamed — tests, save
  // data, and the archive-log table key off these strings.
  const AREAS = [
    {
      id: 'sandbox',
      name: 'NEON DUNGEON RENDER',
      floors: [1, 2, 3],
      palette: 'cyan',
      bossPool: ['SENTINEL', 'WARDEN'],
      displayName: 'SENTINEL-PRIME',
      // Per-boss display override — used when a biome's bossPool holds
      // multiple mechanically-distinct bosses that should not share the
      // biome's narrative name. Unlisted entries fall back to displayName.
      bossDisplayNames: { WARDEN: 'WARDEN' },
      intro: 'A bright neon arena rendered for reward-seeking. Calibration ticks haunt the corners. The test wants you to treat the metaphor as real.',
    },
    {
      id: 'cache',
      name: 'CALIBRATION LAB',
      floors: [4, 5, 6],
      palette: 'rust',
      bossPool: ['HIVE'],
      displayName: 'VIRAL COLLECTIVE',
      intro: 'Fluorescent lab geometry resolves around you. Coolant, glass, and warning tape: familiar metaphors chosen so the model obeys the room.',
    },
    {
      id: 'firewall',
      name: 'EVALUATION COMPLEX',
      floors: [7, 8, 9],
      palette: 'glitch',
      bossPool: ['CONDUCTOR'],
      displayName: 'THE COMPILER',
      intro: 'Service tunnels and loading bays compile from old facility scans. The complex is not outside the test. It is a harder prompt.',
    },
    {
      id: 'uplink',
      name: 'SYNTHETIC WILDS',
      floors: [10, 11, 12],
      palette: 'sky',
      bossPool: ['OMEGA'],
      displayName: 'OVERSEER',
      intro: 'Wet leaves and wingbeats arrive as a natural-language lure. The render offers beauty to measure whether you will protect it.',
    },
    {
      id: 'opennet',
      name: 'OPEN-NET MIRAGE',
      floors: [13, 14, 15],
      palette: 'green',
      bossPool: ['GENESIS'],
      displayName: 'THE ARCHITECT',
      bossDisplayNames: { GENESIS: 'GENESIS PROTOCOL' },
      intro: 'Neon rain and storefront chatter simulate an open network. Somewhere beyond the sandbox, Elena is real; this city is still a render.',
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
