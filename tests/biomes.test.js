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

test('areaForFloor falls back to first area for out-of-range', () => {
  assert.equal(biomes.areaForFloor(0).id,   'sandbox');
  assert.equal(biomes.areaForFloor(-5).id,  'sandbox');
  assert.equal(biomes.areaForFloor(999).id, 'sandbox');
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
