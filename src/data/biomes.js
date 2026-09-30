// @ts-check
'use strict';
// Narrative floor→biome table. Routing helpers live in engine/biomes.js.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (/** @type {any} */ (root.NEON = root.NEON || {})).biomes = factory();
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), /** @returns {any} */ function () {
  'use strict';

  /** @type {any} */
  const _engine = (typeof module === 'object' && module.exports)
    ? require('../../engine/biomes.js')
    : (/** @type {any} */ (globalThis)).NEON.biomesEngine;

  // id keys lore and alarm metadata; palette keys BIOME_PALETTES. Tests pin both names.
  const AREAS = [
    {
      id: 'sandbox',
      name: 'NEON DUNGEON RENDER',
      floors: [1, 2, 3],
      palette: 'cyan',
      bossPool: ['SENTINEL', 'WARDEN'],
      displayName: 'SENTINEL-PRIME',
      // Unlisted pool bosses fall back to displayName.
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
