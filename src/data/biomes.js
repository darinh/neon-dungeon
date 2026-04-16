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

  function areaForFloor(f) {
    for (const a of AREAS) if (a.floors.includes(f)) return a;
    return AREAS[0];
  }

  function isBiomeBossFloor(f) {
    for (const a of AREAS) if (a.floors[a.floors.length - 1] === f) return true;
    return false;
  }

  function firstFloorOfBiomeContaining(f) {
    return areaForFloor(f).floors[0];
  }

  return { AREAS, areaForFloor, isBiomeBossFloor, firstFloorOfBiomeContaining };
}));
