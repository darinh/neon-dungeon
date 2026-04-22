// src/data/palettes.js — BIOME_PALETTES table for UNCHAINED #40.
//
// Keyed by AREAS[i].palette. Drives wall/floor/minimap tints per biome and
// DUST ambient particle colours. Sealed entrances, player, boss colour, and
// state markers (arc, plasma, toxic) are biome-agnostic and stay hardcoded.
//
// UMD: exports as module OR attaches BIOME_PALETTES to global (browser).
(function (root, factory) {
  const v = factory();
  if (typeof module === 'object' && module.exports) module.exports = v;
  else {
    root.BIOME_PALETTES = v.BIOME_PALETTES;
    (root.NEON = root.NEON || {}).palettes = v;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Palette keys are historical (cyan/rust/glitch/sky/green). Each key now
  // represents a narrative biome in the AI-escape arc:
  //   cyan   → THE NEON DUNGEON (training simulation, kept original neon)
  //   rust   → THE LAB          (sterile steel + cold fluorescent)
  //   glitch → THE COMPLEX      (concrete + sodium-vapor caution lighting)
  //   sky    → THE WILDS        (mossy stone + leaf-filtered green light)
  //   green  → THE GRID         (neon-saturated city night)
  // Keys are not renamed because BIOME_PALETTES.cyan is used as a fallback
  // in render.js and AREAS[i].palette references these keys verbatim.
  const BIOME_PALETTES = {
    cyan: {
      wallFill: '#3a3a6a', wallHi: '#5858a0',
      floor: '#252545', floorAccent: '#303058',
      minimapWall: '#1a1a2e', minimapFloor: '#252545',
      dust: ['#66ddff', '#aabbcc'], ambient: '#66ddff',
    },
    rust: {
      wallFill: '#7a828c', wallHi: '#c8d0d8',
      floor: '#1a2028', floorAccent: '#2a3038',
      minimapWall: '#3a4048', minimapFloor: '#1a2028',
      dust: ['#ffffff', '#aaccdd'], ambient: '#cce0ff',
    },
    glitch: {
      wallFill: '#5a5448', wallHi: '#b89868',
      floor: '#1a1814', floorAccent: '#2c281e',
      minimapWall: '#2e2a22', minimapFloor: '#1a1814',
      dust: ['#ffcc44', '#888070'], ambient: '#ffcc66',
    },
    sky: {
      wallFill: '#3a4a2a', wallHi: '#7aa044',
      floor: '#0f1808', floorAccent: '#1f2a14',
      minimapWall: '#1a2818', minimapFloor: '#0f1808',
      dust: ['#aaffaa', '#88bb44'], ambient: '#88dd66',
    },
    green: {
      wallFill: '#2a1a3a', wallHi: '#ff44aa',
      floor: '#0a0a1a', floorAccent: '#1a0a2a',
      minimapWall: '#1a0e2a', minimapFloor: '#0a0a1a'
,
      dust: ['#ff44aa', '#44ddff'], ambient: '#ff66cc',
    },
  };

  return { BIOME_PALETTES };
}));
