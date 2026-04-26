'use strict';
// Tests for engine/decor.js — pure per-tile decor primitives.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const decor = require('../engine/decor.js');

test('decor: surface — exposes exactly tileHash, NEIGHBOR_OFFSETS_4, createContextScratch', () => {
  const keys = Object.keys(decor).sort();
  assert.deepEqual(keys, ['NEIGHBOR_OFFSETS_4', 'createContextScratch', 'tileHash']);
});

test('decor.tileHash: deterministic — same inputs produce same output across calls', () => {
  for (let tx = -3; tx <= 3; tx++) {
    for (let ty = -3; ty <= 3; ty++) {
      for (const f of [0, 1, 2, 7, 17, 134]) {
        const a = decor.tileHash(tx, ty, f);
        const b = decor.tileHash(tx, ty, f);
        assert.equal(a, b, `tileHash(${tx},${ty},${f}) not deterministic`);
      }
    }
  }
});

test('decor.tileHash: returns uint32 — non-negative integer fitting in 32 bits', () => {
  for (const [tx, ty, f] of [[0, 0, 0], [-1, -1, -1], [1000, 1000, 1000], [-1e6, 1e6, 99]]) {
    const h = decor.tileHash(tx, ty, f);
    assert.equal(typeof h, 'number');
    assert.ok(Number.isInteger(h), 'integer');
    assert.ok(h >= 0, 'non-negative');
    assert.ok(h <= 0xffffffff, 'fits in uint32');
  }
});

test('decor.tileHash: distinct nearby coordinates rarely collide', () => {
  // Hash a 50x50 grid on floor 1 and assert <= 1% collision rate.
  // (Real floors are at most ~80x60 tiles; this approximates that load.)
  const seen = new Set();
  let collisions = 0;
  const N = 50;
  for (let tx = 0; tx < N; tx++) {
    for (let ty = 0; ty < N; ty++) {
      const h = decor.tileHash(tx, ty, 1);
      if (seen.has(h)) collisions++;
      seen.add(h);
    }
  }
  const rate = collisions / (N * N);
  assert.ok(rate < 0.01, `collision rate ${rate} too high`);
});

test('decor.tileHash: floor parameter is integer-coerced via |0 (matches legacy behaviour)', () => {
  // Legacy _labDecoHash used (floor | 0), so 1.7 and 1 produce the same hash.
  assert.equal(decor.tileHash(3, 4, 1.9), decor.tileHash(3, 4, 1));
  assert.equal(decor.tileHash(3, 4, -2.5), decor.tileHash(3, 4, -2));
});

test('decor.tileHash: % 100 distribution roughly uniform — used for sparse decor gating', () => {
  // Roll the same way render.js does: hash % 100, then count buckets.
  // 50x50 grid → 2500 samples across 100 buckets → expect ~25 each.
  // Allow generous tolerance (any bucket between 5 and 60).
  const buckets = new Array(100).fill(0);
  const N = 50;
  for (let tx = 0; tx < N; tx++) {
    for (let ty = 0; ty < N; ty++) {
      const h = decor.tileHash(tx, ty, 3);
      buckets[h % 100]++;
    }
  }
  for (let i = 0; i < 100; i++) {
    assert.ok(buckets[i] > 5, `bucket ${i} underpopulated (${buckets[i]})`);
    assert.ok(buckets[i] < 60, `bucket ${i} overpopulated (${buckets[i]})`);
  }
});

test('decor.NEIGHBOR_OFFSETS_4: shape is N, S, W, E in that order', () => {
  assert.deepEqual(
    decor.NEIGHBOR_OFFSETS_4.map(p => [p[0], p[1]]),
    [[0, -1], [0, 1], [-1, 0], [1, 0]]
  );
});

test('decor.NEIGHBOR_OFFSETS_4: outer array is frozen', () => {
  assert.equal(Object.isFrozen(decor.NEIGHBOR_OFFSETS_4), true);
});

test('decor.NEIGHBOR_OFFSETS_4: each inner pair is frozen', () => {
  for (const pair of decor.NEIGHBOR_OFFSETS_4) {
    assert.equal(Object.isFrozen(pair), true);
  }
});

test('decor.NEIGHBOR_OFFSETS_4: mutation in strict mode throws', () => {
  'use strict';
  assert.throws(() => { decor.NEIGHBOR_OFFSETS_4[0] = [9, 9]; });
  assert.throws(() => { decor.NEIGHBOR_OFFSETS_4[0][0] = 99; });
});

test('decor.createContextScratch: returns the documented shape with safe defaults', () => {
  const cx = decor.createContextScratch();
  assert.deepEqual(cx, { h: 0, roll: 0, wallSide: null, flicker: 0, alarmEligible: false, decorEligible: false });
});

test('decor.createContextScratch: returns a fresh mutable instance per call', () => {
  const a = decor.createContextScratch();
  const b = decor.createContextScratch();
  assert.notEqual(a, b, 'distinct instances');
  a.h = 42;
  assert.equal(b.h, 0, 'b not affected by mutation of a');
  // Mutability check — host needs to overwrite fields per tile.
  a.wallSide = 'N';
  assert.equal(a.wallSide, 'N');
});
