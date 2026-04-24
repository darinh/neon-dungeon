'use strict';
// alarm-light decor — pure helpers (intensity, slot probability, biome opt-in).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const al = require(path.resolve(__dirname, '..', 'src', 'meta', 'alarm-light.js'));

test('ALARM_BIOMES contains lab and complex by default', () => {
  assert.equal(al.ALARM_BIOMES.has('cache'), true);
  assert.equal(al.ALARM_BIOMES.has('firewall'), true);
});

test('ALARM_BIOMES excludes biomes that did not opt in', () => {
  for (const id of ['sandbox', 'uplink', 'opennet']) {
    assert.equal(al.ALARM_BIOMES.has(id), false, `${id} should not be in ALARM_BIOMES`);
  }
});

test('shouldDraw returns false for biomes outside the whitelist', () => {
  // Even if the slot bits match, a non-whitelisted biome never gets a beacon.
  for (let h = 0; h < 4096; h++) {
    if (al.shouldDraw('sandbox', h)) {
      assert.fail(`sandbox should never draw alarm light (h=${h})`);
    }
  }
});

test('shouldDraw matches isAlarmSlot for whitelisted biomes', () => {
  for (let h = 0; h < 1000; h++) {
    assert.equal(al.shouldDraw('cache', h), al.isAlarmSlot(h));
    assert.equal(al.shouldDraw('firewall', h), al.isAlarmSlot(h));
  }
});

test('isAlarmSlot fires on roughly 1/31 of hashes (~3.2%)', () => {
  let hits = 0;
  const N = 200000;
  for (let h = 0; h < N; h++) if (al.isAlarmSlot(h)) hits++;
  const rate = hits / N;
  assert.ok(rate > 0.027 && rate < 0.038, `slot rate ${rate} expected ~0.0323`);
});

test('isAlarmSlot is independent of the regular decor roll bits', () => {
  // The decor pipeline keys `roll = h % 100` and slices (h & 1), (h & 3),
  // (h >> 2) & 3, (h >> 3) & 1. Verify isAlarmSlot (h % 23) does not
  // perfectly correlate — pick hashes where (h % 100) is constant and
  // confirm the alarm slot still varies.
  let alarmHits = 0, samples = 0;
  for (let k = 0; k < 200; k++) {
    const h = 7 + k * 100; // (h % 100) === 7 always
    if (al.isAlarmSlot(h)) alarmHits++;
    samples++;
  }
  // Should hit ~4.3% — proves no perfect correlation with the roll bits.
  assert.ok(alarmHits > 2 && alarmHits < 20,
    `alarm hits ${alarmHits}/${samples} suggests correlation with roll`);
});

test('intensity stays inside [0.18, 1.0] for any time and hash', () => {
  for (let h = 0; h < 200; h++) {
    for (let t = 0; t < 50; t += 0.13) {
      const v = al.intensity(t, h);
      assert.ok(v >= 0.18 - 1e-9 && v <= 1.0 + 1e-9,
        `intensity ${v} out of bounds at t=${t} h=${h}`);
    }
  }
});

test('intensity floor keeps the bulb visible in the dark phase', () => {
  // The floor of 0.18 prevents alarm lights from disappearing entirely
  // — they are always at least dimly lit so they read as "powered".
  let minSeen = Infinity;
  for (let h = 0; h < 50; h++) {
    for (let t = 0; t < 20; t += 0.05) {
      minSeen = Math.min(minSeen, al.intensity(t, h));
    }
  }
  assert.ok(minSeen >= 0.18 - 1e-6, `min intensity ${minSeen} below floor`);
  assert.ok(minSeen < 0.20, `min intensity ${minSeen} should approach floor`);
});

test('intensity full swing reaches near 1.0 within a short window', () => {
  // Each tile's beacon should reach near full brightness sometimes — verifies
  // the amplitude (0.82) is real and not muted.
  let maxSeen = -Infinity;
  for (let t = 0; t < 5; t += 0.01) maxSeen = Math.max(maxSeen, al.intensity(t, 0));
  assert.ok(maxSeen > 0.99, `max intensity ${maxSeen} should approach 1.0`);
});

test('intensity is hash-offset so neighbouring tiles do not strobe in unison', () => {
  // Two tiles with different hashes at the same time should usually disagree
  // by a noticeable amount — proves the per-tile phase offset works.
  const t = 1.0;
  const samples = [];
  for (let h = 0; h < 17; h++) samples.push(al.intensity(t, h));
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  assert.ok(max - min > 0.5, `neighbour spread ${max - min} too tight — phase offset broken`);
});

test('intensity tolerates non-finite floorTime', () => {
  // game.floorTime can briefly be undefined during scene transitions.
  // We must not return NaN (would blow up canvas alpha).
  for (const bad of [undefined, null, NaN, Infinity, -Infinity, 'oops']) {
    const v = al.intensity(bad, 42);
    assert.ok(Number.isFinite(v), `intensity returned non-finite for ${bad}`);
    assert.ok(v >= 0.18 && v <= 1.0, `intensity out of range for ${bad}: ${v}`);
  }
});

test('shouldDraw tolerates unknown biome ids without throwing', () => {
  assert.equal(al.shouldDraw('', 0), false);
  assert.equal(al.shouldDraw(null, 0), false);
  assert.equal(al.shouldDraw(undefined, 0), false);
  assert.equal(al.shouldDraw('not-a-biome', 0), false);
});
