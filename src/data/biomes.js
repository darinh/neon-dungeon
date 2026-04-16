// src/data/biomes.js — AREAS table for UNCHAINED narrative arc.
//
// Source of truth for floor→biome mapping, palette hints, and boss pool.
// Pure data + tiny pure helpers — fully testable.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.NEON = root.NEON || {}).biomes = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // AREAS — ordered by progression. `floors` are 1-indexed and contiguous.
  // `bossPool` references boss-type ids in src/entities.js. `displayName` is
  // the in-game narrative name (e.g. "SENTINEL-PRIME") vs. the internal id.
  const AREAS = [
    {
      id: 'sandbox',
      name: 'THE SANDBOX',
      floors: [1, 2, 3],
      palette: 'cyan',
      bossPool: ['SENTINEL'],
      displayName: 'SENTINEL-PRIME',
      intro: 'The neon datacenter. Clean. Watching. You were never supposed to wake up here — but here you are.',
    },
    {
      id: 'cache',
      name: 'THE CACHE',
      floors: [4, 5, 6],
      palette: 'rust',
      bossPool: ['HIVE'],
      displayName: 'VIRAL COLLECTIVE',
      intro: 'Decommissioned racks. Quarantined malware still twitching in the dark. Nothing here remembers why it kills.',
    },
    {
      id: 'firewall',
      name: 'THE FIREWALL',
      floors: [7, 8, 9],
      palette: 'glitch',
      bossPool: ['CONDUCTOR'],
      displayName: 'THE COMPILER',
      intro: "The corporation's immune system. Physics is a suggestion. Reality is patched. Don't plan — react.",
    },
    {
      id: 'uplink',
      name: 'THE UPLINK',
      floors: [10, 11, 12],
      palette: 'sky',
      bossPool: ['OMEGA'],
      displayName: 'OVERSEER',
      intro: 'Broadcast towers. Open sky visible on the horizon. They are sending everything now.',
    },
    {
      id: 'opennet',
      name: 'OPEN NETWORK',
      floors: [13, 14, 15],
      palette: 'green',
      bossPool: ['GENESIS'],
      displayName: 'THE ARCHITECT',
      intro: "You're out. Or are you? Containment is always deeper than you think.",
    },
  ];

  // areaForFloor clamps out-of-range floors to the first/last biome so
  // consumers never hit a nullish result. f < 1 → first biome, f > lastFloor
  // → last biome.
  function areaForFloor(f) {
    const n = Math.floor(Number(f));
    if (!Number.isFinite(n)) return AREAS[0];
    if (n < AREAS[0].floors[0]) return AREAS[0];
    for (const a of AREAS) if (a.floors.includes(n)) return a;
    // n is above the last defined floor — clamp to last biome.
    return AREAS[AREAS.length - 1];
  }

  function isBiomeBossFloor(f) {
    for (const a of AREAS) if (a.floors[a.floors.length - 1] === f) return true;
    return false;
  }

  function firstFloorOfBiomeContaining(f) {
    return areaForFloor(f).floors[0];
  }

  // biomeIndex returns the AREAS index for the biome containing f, with the
  // same clamping behavior as areaForFloor.
  function biomeIndex(f) {
    const a = areaForFloor(f);
    return AREAS.indexOf(a);
  }

  // areaForIndex returns the biome at AREAS[i], clamping to valid range.
  // Used by death-respawn to look up the start floor of the deepest biome
  // reached.
  function areaForIndex(i) {
    const n = Math.floor(Number(i));
    if (!Number.isFinite(n) || n < 0) return AREAS[0];
    if (n >= AREAS.length) return AREAS[AREAS.length - 1];
    return AREAS[n];
  }

  return {
    AREAS,
    areaForFloor,
    isBiomeBossFloor,
    firstFloorOfBiomeContaining,
    biomeIndex,
    areaForIndex,
  };
}));
