'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const biomes = require(path.resolve(__dirname, '..', 'src', 'data', 'biomes.js'));
const { BIOME_PALETTES } = require(path.resolve(__dirname, '..', 'src', 'data', 'palettes.js'));

test('every AREAS[i].palette has a matching BIOME_PALETTES entry', () => {
  for (const a of biomes.AREAS) {
    assert.ok(
      BIOME_PALETTES[a.palette],
      `AREA ${a.id} has palette key "${a.palette}" with no BIOME_PALETTES entry`
    );
  }
});

test('every palette defines required colour fields', () => {
  const required = ['wallFill','wallHi','floor','floorAccent','minimapWall','minimapFloor','dust','ambient'];
  for (const [key, pal] of Object.entries(BIOME_PALETTES)) {
    for (const f of required) {
      assert.ok(pal[f] !== undefined, `palette "${key}" missing field "${f}"`);
    }
    assert.ok(Array.isArray(pal.dust) && pal.dust.length >= 1, `palette "${key}" dust must be non-empty array`);
    // Every hex field must be a valid 6-digit hex colour.
    for (const f of ['wallFill','wallHi','floor','floorAccent','minimapWall','minimapFloor','ambient']) {
      assert.match(pal[f], /^#[0-9a-fA-F]{6}$/, `palette "${key}" field "${f}" must be #rrggbb`);
    }
    for (const d of pal.dust) {
      assert.match(d, /^#[0-9a-fA-F]{6}$/, `palette "${key}" dust colour must be #rrggbb`);
    }
  }
});

test('palette keys match the expected biome set', () => {
  const paletteKeys = new Set(Object.keys(BIOME_PALETTES));
  const areaKeys = new Set(biomes.AREAS.map(a => a.palette));
  // Palette table may include extras for future biomes; every area key must exist.
  for (const k of areaKeys) assert.ok(paletteKeys.has(k), `missing palette for "${k}"`);
});
