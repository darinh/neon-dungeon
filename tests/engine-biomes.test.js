'use strict';
// tests/engine-biomes.test.js — pure engine tests for createBiomeRouter.
// Synthetic area tables only — no NEON content. Wired-surface coverage
// (NEON-specific area data, palette keys, narrative text) lives in
// tests/biomes.test.js.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { createBiomeRouter } = require(path.resolve(__dirname, '..', 'engine', 'biomes.js'));

function makeAreas() {
  return [
    { id: 'a', floors: [1, 2, 3] },
    { id: 'b', floors: [4, 5] },
    { id: 'c', floors: [6, 7, 8, 9] },
  ];
}

test('createBiomeRouter exposes the configured areas array', () => {
  const areas = makeAreas();
  const r = createBiomeRouter(areas);
  assert.equal(r.areas, areas);
});

test('createBiomeRouter throws on empty / non-array input', () => {
  assert.throws(() => createBiomeRouter([]), /non-empty array/);
  // @ts-expect-error invalid arg under test
  assert.throws(() => createBiomeRouter(null), /non-empty array/);
  // @ts-expect-error invalid arg under test
  assert.throws(() => createBiomeRouter(undefined), /non-empty array/);
});

test('createBiomeRouter throws when an area is missing floors[]', () => {
  assert.throws(() => createBiomeRouter([{ id: 'bad' }]), /missing floors/);
  assert.throws(() => createBiomeRouter([{ id: 'a', floors: [1] }, { id: 'bad', floors: [] }]), /missing floors/);
});

test('areaForFloor returns the area whose floors[] contains f', () => {
  const r = createBiomeRouter(makeAreas());
  assert.equal(r.areaForFloor(1).id, 'a');
  assert.equal(r.areaForFloor(3).id, 'a');
  assert.equal(r.areaForFloor(4).id, 'b');
  assert.equal(r.areaForFloor(5).id, 'b');
  assert.equal(r.areaForFloor(6).id, 'c');
  assert.equal(r.areaForFloor(9).id, 'c');
});

test('areaForFloor clamps below-range to first area', () => {
  const r = createBiomeRouter(makeAreas());
  assert.equal(r.areaForFloor(0).id, 'a');
  assert.equal(r.areaForFloor(-5).id, 'a');
});

test('areaForFloor clamps above-range to last area', () => {
  const r = createBiomeRouter(makeAreas());
  assert.equal(r.areaForFloor(10).id, 'c');
  assert.equal(r.areaForFloor(9999).id, 'c');
});

test('areaForFloor handles non-finite input by returning first area', () => {
  const r = createBiomeRouter(makeAreas());
  assert.equal(r.areaForFloor(NaN).id, 'a');
  assert.equal(r.areaForFloor(Infinity).id, 'a');  // !isFinite → first
  assert.equal(r.areaForFloor(-Infinity).id, 'a');
});

test('areaForFloor floors fractional input', () => {
  const r = createBiomeRouter(makeAreas());
  assert.equal(r.areaForFloor(3.9).id, 'a'); // floor(3.9) = 3
  assert.equal(r.areaForFloor(4.5).id, 'b'); // floor(4.5) = 4
});

test('isBiomeBossFloor true only for the last floor of each area', () => {
  const r = createBiomeRouter(makeAreas());
  assert.equal(r.isBiomeBossFloor(3), true);
  assert.equal(r.isBiomeBossFloor(5), true);
  assert.equal(r.isBiomeBossFloor(9), true);
  assert.equal(r.isBiomeBossFloor(1), false);
  assert.equal(r.isBiomeBossFloor(4), false);
  assert.equal(r.isBiomeBossFloor(6), false);
  assert.equal(r.isBiomeBossFloor(99), false);
});

test('firstFloorOfBiomeContaining returns floors[0] of the matching area', () => {
  const r = createBiomeRouter(makeAreas());
  assert.equal(r.firstFloorOfBiomeContaining(2), 1);
  assert.equal(r.firstFloorOfBiomeContaining(5), 4);
  assert.equal(r.firstFloorOfBiomeContaining(8), 6);
});

test('biomeIndex returns the integer index of the matching area', () => {
  const r = createBiomeRouter(makeAreas());
  assert.equal(r.biomeIndex(1), 0);
  assert.equal(r.biomeIndex(4), 1);
  assert.equal(r.biomeIndex(7), 2);
});

test('areaForIndex clamps negative and overflow indexes', () => {
  const r = createBiomeRouter(makeAreas());
  assert.equal(r.areaForIndex(0).id, 'a');
  assert.equal(r.areaForIndex(2).id, 'c');
  assert.equal(r.areaForIndex(-1).id, 'a');
  assert.equal(r.areaForIndex(99).id, 'c');
  assert.equal(r.areaForIndex(NaN).id, 'a');
});

test('finalFloor returns the last floor of the last area', () => {
  assert.equal(createBiomeRouter(makeAreas()).finalFloor(), 9);
  assert.equal(createBiomeRouter([{ id: 'only', floors: [42] }]).finalFloor(), 42);
});

test('areas with non-contiguous floors still route correctly', () => {
  const r = createBiomeRouter([
    { id: 'odd', floors: [1, 3, 5] },
    { id: 'even', floors: [2, 4, 6] },
  ]);
  assert.equal(r.areaForFloor(1).id, 'odd');
  assert.equal(r.areaForFloor(2).id, 'even');
  assert.equal(r.areaForFloor(3).id, 'odd');
  assert.equal(r.areaForFloor(4).id, 'even');
  assert.equal(r.isBiomeBossFloor(5), true);  // last of odd
  assert.equal(r.isBiomeBossFloor(6), true);  // last of even
  assert.equal(r.finalFloor(), 6);            // last area's last floor
});
