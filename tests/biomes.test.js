'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const biomes = require(path.resolve(__dirname, '..', 'src', 'data', 'biomes.js'));

test('AREAS cover floors 1-15 contiguously without gaps or overlaps', () => {
  const floors = biomes.AREAS.flatMap(a => a.floors);
  floors.sort((a, b) => a - b);
  assert.deepEqual(floors, [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]);
});

test('AREA ids are unique', () => {
  const ids = new Set();
  for (const a of biomes.AREAS) {
    assert.ok(!ids.has(a.id), `duplicate biome id: ${a.id}`);
    ids.add(a.id);
  }
});

test('every AREA has required fields', () => {
  for (const a of biomes.AREAS) {
    assert.ok(typeof a.id === 'string' && a.id.length > 0);
    assert.ok(typeof a.name === 'string' && a.name.length > 0);
    assert.ok(Array.isArray(a.floors) && a.floors.length > 0);
    assert.ok(typeof a.palette === 'string');
    assert.ok(Array.isArray(a.bossPool) && a.bossPool.length > 0);
    assert.ok(typeof a.displayName === 'string' && a.displayName.length > 0);
    assert.ok(typeof a.intro === 'string' && a.intro.length > 0);
  }
});

test('areaForFloor maps boundary floors correctly', () => {
  assert.equal(biomes.areaForFloor(1).id,  'sandbox');
  assert.equal(biomes.areaForFloor(3).id,  'sandbox');
  assert.equal(biomes.areaForFloor(4).id,  'cache');
  assert.equal(biomes.areaForFloor(6).id,  'cache');
  assert.equal(biomes.areaForFloor(7).id,  'firewall');
  assert.equal(biomes.areaForFloor(9).id,  'firewall');
  assert.equal(biomes.areaForFloor(10).id, 'uplink');
  assert.equal(biomes.areaForFloor(12).id, 'uplink');
  assert.equal(biomes.areaForFloor(13).id, 'opennet');
  assert.equal(biomes.areaForFloor(15).id, 'opennet');
});

test('areaForFloor clamps out-of-range to first/last biome', () => {
  assert.equal(biomes.areaForFloor(0).id,   'sandbox');
  assert.equal(biomes.areaForFloor(-5).id,  'sandbox');
  // Above the last defined floor clamps to the LAST biome, not the first —
  // matches UNCHAINED #34 AC: "clamp to first/last biome, never throw".
  assert.equal(biomes.areaForFloor(16).id,  'opennet');
  assert.equal(biomes.areaForFloor(999).id, 'opennet');
  assert.equal(biomes.areaForFloor(NaN).id, 'sandbox');
});

test('isBiomeBossFloor identifies biome-final floors only', () => {
  assert.equal(biomes.isBiomeBossFloor(3),  true);
  assert.equal(biomes.isBiomeBossFloor(6),  true);
  assert.equal(biomes.isBiomeBossFloor(9),  true);
  assert.equal(biomes.isBiomeBossFloor(12), true);
  assert.equal(biomes.isBiomeBossFloor(15), true);
  // non-boss floors
  for (const f of [1,2,4,5,7,8,10,11,13,14]) {
    assert.equal(biomes.isBiomeBossFloor(f), false, `floor ${f} is not a biome boss floor`);
  }
});

test('firstFloorOfBiomeContaining returns the biome entry floor', () => {
  assert.equal(biomes.firstFloorOfBiomeContaining(1),  1);
  assert.equal(biomes.firstFloorOfBiomeContaining(3),  1);
  assert.equal(biomes.firstFloorOfBiomeContaining(5),  4);
  assert.equal(biomes.firstFloorOfBiomeContaining(11), 10);
});

test('biomeIndex returns 0..N-1 per biome and clamps like areaForFloor', () => {
  assert.equal(biomes.biomeIndex(1),   0); // sandbox
  assert.equal(biomes.biomeIndex(4),   1); // cache
  assert.equal(biomes.biomeIndex(7),   2); // firewall
  assert.equal(biomes.biomeIndex(10),  3); // uplink
  assert.equal(biomes.biomeIndex(13),  4); // opennet
  assert.equal(biomes.biomeIndex(15),  4);
  // out-of-range clamps
  assert.equal(biomes.biomeIndex(0),   0);
  assert.equal(biomes.biomeIndex(16),  4);
  assert.equal(biomes.biomeIndex(999), 4);
});

test('areaForIndex clamps invalid indices and returns correct biome', () => {
  assert.equal(biomes.areaForIndex(0).id, 'sandbox');
  assert.equal(biomes.areaForIndex(1).id, 'cache');
  assert.equal(biomes.areaForIndex(2).id, 'firewall');
  assert.equal(biomes.areaForIndex(3).id, 'uplink');
  assert.equal(biomes.areaForIndex(4).id, 'opennet');
  // clamps
  assert.equal(biomes.areaForIndex(-1).id, 'sandbox');
  assert.equal(biomes.areaForIndex(99).id, 'opennet');
  assert.equal(biomes.areaForIndex(NaN).id, 'sandbox');
});

// UNCHAINED #34 AC: "cases for the death-respawn lookup at every biome
// boundary (floor 1, 4, 7, 10, 13), plus a 'floor 16 clamps to opennet' test."
// Death respawn computes: areaForIndex(meta.deepestBiome).floors[0] where
// deepestBiome = biomeIndex(deepestFloorEntered).
test('death-respawn: boundary floors map to that biome first floor', () => {
  const boundary = [
    { enter: 1,  expect: 1  }, // sandbox → 1
    { enter: 4,  expect: 4  }, // cache → 4
    { enter: 7,  expect: 7  }, // firewall → 7
    { enter: 10, expect: 10 }, // uplink → 10
    { enter: 13, expect: 13 }, // opennet → 13
  ];
  for (const b of boundary) {
    const idx = biomes.biomeIndex(b.enter);
    const startFloor = biomes.areaForIndex(idx).floors[0];
    assert.equal(startFloor, b.expect, `entering floor ${b.enter} → respawn at ${b.expect}, got ${startFloor}`);
  }
});

test('death-respawn: floor 16 clamps to opennet (respawns at 13)', () => {
  const idx = biomes.biomeIndex(16);
  assert.equal(biomes.areaForIndex(idx).id, 'opennet');
  assert.equal(biomes.areaForIndex(idx).floors[0], 13);
});

test('finalFloor returns the last floor of the last biome', () => {
  assert.equal(biomes.finalFloor(), 15);
});

test('every bossPool member is a known enemy/boss id string', () => {
  // Type-shape guard — individual enemy registration is in src/entities.js.
  // This test catches typos in biomes.js without importing the monolith.
  const seen = new Set();
  for (const a of biomes.AREAS) {
    for (const b of a.bossPool) {
      assert.equal(typeof b, 'string');
      assert.ok(b.length > 0);
      seen.add(b);
    }
  }
  // All five bosses expected at least once.
  for (const expected of ['SENTINEL','HIVE','CONDUCTOR','OMEGA','GENESIS']) {
    assert.ok(seen.has(expected), `bossPool missing ${expected}`);
  }
});
