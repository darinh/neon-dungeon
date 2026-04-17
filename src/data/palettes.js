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

  const BIOME_PALETTES = {
    cyan: {
      wallFill: '#3a3a6a', wallHi: '#5858a0',
      floor: '#252545', floorAccent: '#303058',
      minimapWall: '#1a1a2e', minimapFloor: '#252545',
      dust: ['#66ddff', '#aabbcc'], ambient: '#66ddff',
    },
    rust: {
      wallFill: '#4a2e1e', wallHi: '#9a5a38',
      floor: '#2a0e05', floorAccent: '#4a1e10',
      minimapWall: '#2e1a0a', minimapFloor: '#3a1a0d',
      dust: ['#ff6a3d', '#cc8855'], ambient: '#ff8844',
    },
    glitch: {
      wallFill: '#3a0e3a', wallHi: '#aa00aa',
      floor: '#15002a', floorAccent: '#2a0044',
      minimapWall: '#220d2a', minimapFloor: '#2a0a3e',
      dust: ['#ff00aa', '#aaff00'], ambient: '#ff44cc',
    },
    sky: {
      wallFill: '#2a4a6a', wallHi: '#88ddff',
      floor: '#0a2030', floorAccent: '#1a3040',
      minimapWall: '#14222e', minimapFloor: '#1a2a3a',
      dust: ['#ffffff', '#88ddff'], ambient: '#aaddff',
    },
    green: {
      wallFill: '#0f3a24', wallHi: '#00cc66',
      floor: '#002015', floorAccent: '#003a28',
      minimapWall: '#0a1e14', minimapFloor: '#0f2a1e',
      dust: ['#00ff88', '#44cc66'], ambient: '#44ff99',
    },
  };

  return { BIOME_PALETTES };
}));
