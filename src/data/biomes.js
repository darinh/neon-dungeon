// src/data/biomes.js — AREAS table for UNCHAINED narrative arc.
//
// Source of truth for floor→biome mapping, palette hints, and boss pool.
// Pure data + tiny pure helpers — fully testable.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.NEON = root.NEON || {}).biomes = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

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

  // finalFloor returns the last floor of the last biome — the CORE/victory
  // floor. Derived from AREAS so changing biome counts doesn't require
  // chasing down magic numbers across the codebase.
  function finalFloor() {
    const last = AREAS[AREAS.length - 1];
    return last.floors[last.floors.length - 1];
  }

  return {
    AREAS,
    areaForFloor,
    isBiomeBossFloor,
    firstFloorOfBiomeContaining,
    biomeIndex,
    areaForIndex,
    finalFloor,
  };
}));
