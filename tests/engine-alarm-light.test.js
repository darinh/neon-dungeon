'use strict';
// engine/alarm-light — pure pulse math + factory tests.
// Engine-pure: no NEON DUNGEON biome ids appear; tests use synthetic
// allowlists to verify the factory pattern in isolation.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const eng = require(path.resolve(__dirname, '..', 'engine', 'alarm-light.js'));

test('isAlarmSlot fires on roughly 1/31 of hashes (~3.2%)', () => {
  let hits = 0;
  const N = 200000;
  for (let h = 0; h < N; h++) if (eng.isAlarmSlot(h)) hits++;
  const rate = hits / N;
  assert.ok(rate > 0.027 && rate < 0.038, `slot rate ${rate} expected ~0.0323`);
});

test('intensity stays inside [0.18, 1.0] for any time and hash', () => {
  for (let h = 0; h < 200; h++) {
    for (let t = 0; t < 50; t += 0.13) {
      const v = eng.intensity(t, h);
      assert.ok(v >= 0.18 - 1e-9 && v <= 1.0 + 1e-9,
        `intensity ${v} out of bounds at t=${t} h=${h}`);
    }
  }
});

test('intensity tolerates non-finite floorTime', () => {
  for (const bad of [undefined, null, NaN, Infinity, -Infinity, 'oops']) {
    const v = eng.intensity(bad, 42);
    assert.ok(Number.isFinite(v), `intensity returned non-finite for ${bad}`);
    assert.ok(v >= 0.18 && v <= 1.0, `intensity out of range for ${bad}: ${v}`);
  }
});

test('createAlarmLight returns a configured surface', () => {
  const al = eng.createAlarmLight({ allowedBiomes: new Set(['alpha', 'beta']) });
  assert.equal(typeof al.isAlarmSlot, 'function');
  assert.equal(typeof al.intensity, 'function');
  assert.equal(typeof al.shouldDraw, 'function');
  assert.ok(al.allowedBiomes instanceof Set);
  assert.equal(al.allowedBiomes.size, 2);
});

test('createAlarmLight accepts an array allowlist', () => {
  const al = eng.createAlarmLight({ allowedBiomes: ['x', 'y', 'z'] });
  assert.equal(al.allowedBiomes.size, 3);
  assert.ok(al.allowedBiomes.has('x'));
});

test('createAlarmLight defaults to empty allowlist', () => {
  for (const opts of [{}, { allowedBiomes: null }, undefined]) {
    const al = eng.createAlarmLight(opts);
    assert.equal(al.allowedBiomes.size, 0);
    for (let h = 0; h < 200; h++) {
      assert.equal(al.shouldDraw('anything', h), false);
    }
  }
});

test('shouldDraw filters by injected allowlist', () => {
  const al = eng.createAlarmLight({ allowedBiomes: new Set(['only-this']) });
  for (let h = 0; h < 1000; h++) {
    const slot = eng.isAlarmSlot(h);
    assert.equal(al.shouldDraw('only-this', h), slot);
    assert.equal(al.shouldDraw('rejected', h), false);
  }
});

test('shouldDraw rejects non-string biome ids without throwing', () => {
  const al = eng.createAlarmLight({ allowedBiomes: new Set(['anything']) });
  for (const bad of [null, undefined, 0, 1, true, {}, []]) {
    assert.equal(al.shouldDraw(bad, 0), false);
  }
});

test('two factory instances do not share state', () => {
  const a = eng.createAlarmLight({ allowedBiomes: ['a'] });
  const b = eng.createAlarmLight({ allowedBiomes: ['b'] });
  assert.equal(a.shouldDraw('a', 0), eng.isAlarmSlot(0));
  assert.equal(a.shouldDraw('b', 0), false);
  assert.equal(b.shouldDraw('b', 0), eng.isAlarmSlot(0));
  assert.equal(b.shouldDraw('a', 0), false);
});
