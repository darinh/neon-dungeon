// @ts-check
// Keyed by AREAS[i].palette. Sealed entrances, player, boss colour, and
// state markers stay biome-agnostic and hardcoded elsewhere.
// damageFlash is a near-white hit flash (every channel ≥ 0xCC) with a faint
// biome tint so it still reads as damage, not as a coloured light.
(function (root, factory) {
  const v = factory();
  if (typeof module === 'object' && module.exports) module.exports = v;
  else {
    root.BIOME_PALETTES = v.BIOME_PALETTES;
    (/** @type {any} */ (root.NEON = root.NEON || {})).palettes = v;
  }
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  // Keys stay cyan/rust/glitch/sky/green: render.js falls back to
  // BIOME_PALETTES.cyan and AREAS[i].palette names them verbatim.
  // cyan neon dungeon render, rust calibration lab, glitch evaluation complex,
  // sky synthetic wilds, green open-net mirage.
  const BIOME_PALETTES = {
    cyan: {
      wallFill: '#3a3a6a', wallHi: '#5858a0',
      floor: '#252545', floorAccent: '#303058',
      minimapWall: '#1a1a2e', minimapFloor: '#252545',
      dust: ['#66ddff', '#aabbcc'], ambient: '#66ddff',
      damageFlash: '#e8f7ff',
    },
    rust: {
      wallFill: '#7a828c', wallHi: '#c8d0d8',
      floor: '#1a2028', floorAccent: '#2a3038',
      minimapWall: '#3a4048', minimapFloor: '#1a2028',
      dust: ['#ffffff', '#aaccdd'], ambient: '#cce0ff',
      damageFlash: '#fff2e8',
    },
    glitch: {
      wallFill: '#5a5448', wallHi: '#b89868',
      floor: '#1a1814', floorAccent: '#2c281e',
      minimapWall: '#2e2a22', minimapFloor: '#1a1814',
      dust: ['#ffcc44', '#888070'], ambient: '#ffcc66',
      damageFlash: '#fff5d8',
    },
    sky: {
      wallFill: '#3a4a2a', wallHi: '#7aa044',
      floor: '#0f1808', floorAccent: '#1f2a14',
      minimapWall: '#1a2818', minimapFloor: '#0f1808',
      dust: ['#aaffaa', '#88bb44'], ambient: '#88dd66',
      damageFlash: '#eefce6',
    },
    green: {
      wallFill: '#2a1a3a', wallHi: '#ff44aa',
      floor: '#0a0a1a', floorAccent: '#1a0a2a',
      minimapWall: '#1a0e2a', minimapFloor: '#0a0a1a'
,
      dust: ['#ff44aa', '#44ddff'], ambient: '#ff66cc',
      damageFlash: '#ffe9f5',
    },
  };

  // Callers cache this once per floor (game.loadFloor). Do not call it from
  // the entities.js draw hot path — that path cannot afford the lookup.
  /**
   * @param {number} [floorNum]
   * @returns {string}
   */
  function currentDamageFlash(floorNum) {
    try {
      if (typeof NEON !== 'undefined' && NEON.biomes && floorNum) {
        const a = NEON.biomes.areaForFloor(floorNum);
        const p = a && BIOME_PALETTES[/** @type {keyof typeof BIOME_PALETTES} */ (a.palette)];
        if (p && typeof p.damageFlash === 'string') return p.damageFlash;
      }
    } catch (_) { /* lookup failure falls through */ }
    return '#ffffff';
  }

  return { BIOME_PALETTES, currentDamageFlash };
}));
