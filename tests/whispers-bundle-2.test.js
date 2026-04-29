'use strict';
// Whispers bundle #3 — five new whispers (one per biome) extending the
// secret-room lore arc. Mirrors the format/length contract asserted by
// the original whispers.test.js and pins the EXPECTED ids so future churn
// doesn't silently drop them.
//
// Each new whisper threads through an existing piece of lore:
//   w-sb-04 → AXIOM-3 chair-count callback to w-sb-02
//   w-cc-03 → ELENA notebook continuity from w-cc-01 (March 14 → March 19)
//   w-fw-03 → "negative floors" callback to w-sb-03
//   w-uk-03 → counter-advice to w-uk-01 ("don't break the loop that way")
//   w-on-03 → emotional payoff at the top of the tower / w-on-01 transmitter
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const data = require(path.resolve(__dirname, '..', 'src', 'data', 'whispers.js'));
const wmod = require(path.resolve(__dirname, '..', 'src', 'meta', 'whispers.js'));
const save = require(path.resolve(__dirname, '..', 'src', 'meta', 'save.js'));
const router = require(path.resolve(__dirname, '..', 'src', 'data', 'biomes.js'));

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
  { id: 'w-sb-04', biomeId: 'sandbox',  floorMin: 2,  voice: 'AXIOM-3' },
  { id: 'w-cc-03', biomeId: 'cache',    floorMin: 6,  voice: 'ELENA — researcher' },
  { id: 'w-fw-03', biomeId: 'firewall', floorMin: 9,  voice: 'unknown' },
  { id: 'w-uk-03', biomeId: 'uplink',   floorMin: 12, voice: 'unknown' },
  { id: 'w-on-03', biomeId: 'opennet',  floorMin: 15, voice: 'ELENA — researcher' },
];

test('bundle3: each new whisper exists with correct biome + floorMin + voice', () => {
  for (const expected of NEW_IDS) {
    const w = data.WHISPERS.find((/** @type {any} */ x) => x.id === expected.id);
    assert.ok(w, `whisper ${expected.id} present`);
    assert.equal(w.biomeId, expected.biomeId);
    assert.equal(w.floorMin, expected.floorMin);
    assert.equal(w.voice, expected.voice);
    assert.ok(w.body.length >= 60 && w.body.length <= 320,
      `body length in contract (${expected.id}): ${w.body.length}`);
    assert.ok(w.title && w.title.length > 0, `title non-empty (${expected.id})`);
  }
});

test('bundle3: whisperById resolves each new id to its data row', () => {
  for (const { id } of NEW_IDS) {
    const w = wmod.whisperById(id);
    assert.ok(w, `whisperById(${id})`);
    assert.equal(w.id, id);
  }
});

test('bundle3: pickWhisperForFloor can select each new whisper at its floorMin', () => {
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

test('bundle3: progress total reflects bundle additions (>= 16)', () => {
  const p = wmod.progress();
  assert.ok(p.total >= 16, `whisper total >= 16 after bundle 3, got ${p.total}`);
});

test('bundle3: ids remain unique across the whole WHISPERS table', () => {
  const seen = new Set();
  for (const w of data.WHISPERS) {
    assert.ok(!seen.has(w.id), `duplicate id ${w.id}`);
    seen.add(w.id);
  }
});

test('bundle3: every biome from AREAS now has at least 3 whispers', () => {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const w of data.WHISPERS) {
    if (!w.biomeId) continue;
    counts[w.biomeId] = (counts[w.biomeId] || 0) + 1;
  }
  for (const area of router.AREAS) {
    assert.ok((counts[area.id] || 0) >= 3,
      `biome ${area.id} has >= 3 whispers (got ${counts[area.id] || 0})`);
  }
});
