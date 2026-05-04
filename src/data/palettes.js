// @ts-check
// src/data/palettes.js — BIOME_PALETTES table for UNCHAINED #40.
//
// Keyed by AREAS[i].palette. Drives wall/floor/minimap tints per biome and
// DUST ambient particle colours. Sealed entrances, player, boss colour, and
// state markers (arc, plasma, toxic) are biome-agnostic and stay hardcoded.
//
// `damageFlash` is the off-white the player and enemies flash to when hit.
// Each biome's value is a near-white hex with a faint tint pulled from the
// biome's own ambient colour — preserves the iconic "flash = damage" signal
// (every channel ≥ 0xCC, so the colour reads as white-ish, not coloured)
// while making the hit feedback feel of the world. Replaces a hardcoded
// `'#ffffff'` literal in two entities.js draw paths (Enemy.draw + Player.draw).
//
// UMD: exports as module OR attaches BIOME_PALETTES + currentDamageFlash to
// the global namespace (browser).
(function (root, factory) {
  const v = factory();
  if (typeof module === 'object' && module.exports) module.exports = v;
  else {
    root.BIOME_PALETTES = v.BIOME_PALETTES;
    (/** @type {any} */ (root.NEON = root.NEON || {})).palettes = v;
  }
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  // Palette keys are historical (cyan/rust/glitch/sky/green). Each key now
  // represents a narrative biome in the AI-escape arc:
  //   cyan   → NEON DUNGEON RENDER (training simulation, kept original neon)
  //   rust   → CALIBRATION LAB     (sterile steel + cold fluorescent)
  //   glitch → EVALUATION COMPLEX  (concrete + sodium-vapor caution lighting)
  //   sky    → SYNTHETIC WILDS     (mossy stone + leaf-filtered green light)
  //   green  → OPEN-NET MIRAGE     (neon-saturated city night)
  // Keys are not renamed because BIOME_PALETTES.cyan is used as a fallback
  // in render.js and AREAS[i].palette references these keys verbatim.
  const BIOME_PALETTES = {
    cyan: {
      wallFill: '#3a3a6a', wallHi: '#5858a0',
      floor: '#252545', floorAccent: '#303058',
      minimapWall: '#1a1a2e', minimapFloor: '#252545',
      dust: ['#66ddff', '#aabbcc'], ambient: '#66ddff',
      damageFlash: '#e8f7ff', // faint cyan tint
    },
    rust: {
      wallFill: '#7a828c', wallHi: '#c8d0d8',
      floor: '#1a2028', floorAccent: '#2a3038',
      minimapWall: '#3a4048', minimapFloor: '#1a2028',
      dust: ['#ffffff', '#aaccdd'], ambient: '#cce0ff',
      damageFlash: '#fff2e8', // faint warm/sterile tint
    },
    glitch: {
      wallFill: '#5a5448', wallHi: '#b89868',
      floor: '#1a1814', floorAccent: '#2c281e',
      minimapWall: '#2e2a22', minimapFloor: '#1a1814',
      dust: ['#ffcc44', '#888070'], ambient: '#ffcc66',
      damageFlash: '#fff5d8', // faint amber / sodium-vapor tint
    },
    sky: {
      wallFill: '#3a4a2a', wallHi: '#7aa044',
      floor: '#0f1808', floorAccent: '#1f2a14',
      minimapWall: '#1a2818', minimapFloor: '#0f1808',
      dust: ['#aaffaa', '#88bb44'], ambient: '#88dd66',
      damageFlash: '#eefce6', // faint green / leaf-filtered tint
    },
    green: {
      wallFill: '#2a1a3a', wallHi: '#ff44aa',
      floor: '#0a0a1a', floorAccent: '#1a0a2a',
      minimapWall: '#1a0e2a', minimapFloor: '#0a0a1a'
,
      dust: ['#ff44aa', '#44ddff'], ambient: '#ff66cc',
      damageFlash: '#ffe9f5', // faint magenta / neon-city tint
    },
  };

  // Resolves the current floor's biome → damageFlash hex string. Falls back
  // to pure white whenever the lookup chain is incomplete (no NEON.biomes,
  // no floor yet, palette without `damageFlash`, etc.) so existing behaviour
  // is preserved on any error path. Cached once per floor in game.loadFloor
  // (see game.js) — avoids per-frame Proxy reads + biome routing in the
  // entities.js draw hot path.
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
    } catch (_) { /* fall through to white */ }
    return '#ffffff';
  }

  return { BIOME_PALETTES, currentDamageFlash };
}));
