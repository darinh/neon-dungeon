'use strict';
// Whispers bundle #2 (w-sb-03, w-uk-02, w-on-02) — additive narrative content
// that fills out under-represented late-game biomes (uplink/opennet had 1 each,
// sandbox got an extra mid-tier whisper). Mirrors the format/length contract
// the existing whispers.test.js asserts; this file pins the EXPECTED ids so
// future churn doesn't silently drop them.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const data = require(path.resolve(__dirname, '..', 'src', 'data', 'whispers.js'));
const wmod = require(path.resolve(__dirname, '..', 'src', 'meta', 'whispers.js'));
const save = require(path.resolve(__dirname, '..', 'src', 'meta', 'save.js'));

function makeStorage() {
  const store = {};
  return {
    /** @param {string} k */ getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    /** @param {string} k @param {string} v */ setItem(k, v) { store[k] = String(v); },
    /** @param {string} k */ removeItem(k) { delete store[k]; },
    clear() { for (const k of Object.keys(store)) delete store[k]; },
  };
}

const NEW_IDS = [
  { id: 'w-sb-03', biomeId: 'sandbox', floorMin: 3 },
  { id: 'w-uk-02', biomeId: 'uplink',  floorMin: 11 },
  { id: 'w-on-02', biomeId: 'opennet', floorMin: 14 },
];

test('bundle: each new whisper exists with correct biome + floorMin + voice', () => {
  for (const expected of NEW_IDS) {
    const w = data.WHISPERS.find((/** @type {any} */ x) => x.id === expected.id);
    assert.ok(w, `whisper ${expected.id} present`);
    assert.equal(w.biomeId, expected.biomeId);
    assert.equal(w.floorMin, expected.floorMin);
    assert.equal(typeof w.voice, 'string');
    assert.ok(w.voice.length > 0, `voice non-empty (${expected.id})`);
    assert.ok(w.body.length >= 60 && w.body.length <= 320,
      `body length in contract (${expected.id}): ${w.body.length}`);
  }
});

test('bundle: whisperById resolves each new id to its data row', () => {
  for (const { id } of NEW_IDS) {
    const w = wmod.whisperById(id);
    assert.ok(w, `whisperById(${id})`);
    assert.equal(w.id, id);
  }
});

test('bundle: pickWhisperForFloor can select each new whisper at its floorMin', () => {
  const router = require(path.resolve(__dirname, '..', 'src', 'data', 'biomes.js'));
  for (const { id, biomeId, floorMin } of NEW_IDS) {
    save._setStorageForTests(makeStorage());
    try {
      // Mark every OTHER whisper in the same biome with floorMin <= floorMin
      // as found, so this id is the only candidate. Then pick must return it.
      for (const w of data.WHISPERS) {
        if (w.id === id) continue;
        if (w.biomeId === biomeId && (w.floorMin | 0) <= floorMin) {
          save.addWhisperFound(w.id);
        }
      }
      // Confirm the floor really maps to the expected biome (catches biome
      // drift if someone re-sequences floors).
      const area = router.areaForFloor(floorMin);
      assert.equal(area && area.id, biomeId,
        `floor ${floorMin} maps to ${biomeId}`);
      const picked = wmod.pickWhisperForFloor(floorMin, () => 0);
      assert.ok(picked, `picked at floor ${floorMin}`);
      assert.equal(picked.id, id);
    } finally {
      save._setStorageForTests(null);
    }
  }
});

test('bundle: progress total reflects bundle additions (>= 11)', () => {
  const p = wmod.progress();
  assert.ok(p.total >= 11, `whisper total >= 11 after bundle, got ${p.total}`);
});

test('bundle: sw.js uses stable cache name and network-first freshness', () => {
  const sw = fs.readFileSync(path.resolve(__dirname, '..', 'sw.js'), 'utf8');
  assert.doesNotMatch(sw, /neon-dungeon-v\d+/);
  assert.match(sw, /const\s+CACHE\s*=\s*'neon-dungeon-assets'/);
  assert.match(sw, /cacheFromNetwork\(e\)/);
});
