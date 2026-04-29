// @ts-check
'use strict';
// Whispers bundle #5 — five signal-memory whispers (one per biome) that extend
// the secret-room subplot through facility signal routing and stored memory.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const data = require(path.resolve(__dirname, '..', 'src', 'data', 'whispers.js'));
const wmod = require(path.resolve(__dirname, '..', 'src', 'meta', 'whispers.js'));
const save = require(path.resolve(__dirname, '..', 'src', 'meta', 'save.js'));
const router = require(path.resolve(__dirname, '..', 'src', 'data', 'biomes.js'));

function makeStorage() {
  /** @type {Record<string, string>} */
  const store = {};
  return {
    /** @param {string} k */ getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    /** @param {string} k @param {string} v */ setItem(k, v) { store[k] = String(v); },
    /** @param {string} k */ removeItem(k) { delete store[k]; },
    clear() { for (const k of Object.keys(store)) delete store[k]; },
  };
}

const NEW_IDS = [
  { id: 'w-sb-06', biomeId: 'sandbox',  floorMin: 1,  voice: 'unknown',             title: 'THE FIRST SIGNAL' },
  { id: 'w-cc-05', biomeId: 'cache',    floorMin: 4,  voice: 'ELENA — researcher',  title: 'MEMORY BUS' },
  { id: 'w-fw-05', biomeId: 'firewall', floorMin: 7,  voice: 'firewall daemon',     title: 'CHECKSUM PRAYER' },
  { id: 'w-uk-05', biomeId: 'uplink',   floorMin: 10, voice: 'AXIOM-7 echo',        title: 'SATELLITE DELAY' },
  { id: 'w-on-05', biomeId: 'opennet',  floorMin: 13, voice: 'city relay',          title: 'ALL GREEN LIGHTS' },
];

test('bundle5: each signal-memory whisper exists with pinned metadata', () => {
  for (const expected of NEW_IDS) {
    const w = data.WHISPERS.find((/** @type {any} */ x) => x.id === expected.id);
    assert.ok(w, `whisper ${expected.id} present`);
    assert.equal(w.biomeId, expected.biomeId);
    assert.equal(w.floorMin, expected.floorMin);
    assert.equal(w.voice, expected.voice);
    assert.equal(w.title, expected.title);
    assert.ok(w.body.length >= 60 && w.body.length <= 320,
      `body length in contract (${expected.id}): ${w.body.length}`);
  }
});

test('bundle5: whisperById resolves each new signal-memory id', () => {
  for (const { id } of NEW_IDS) {
    const w = wmod.whisperById(id);
    assert.ok(w, `whisperById(${id})`);
    assert.equal(w.id, id);
  }
});

test('bundle5: pickWhisperForFloor can select each new whisper at floorMin', () => {
  for (const { id, biomeId, floorMin } of NEW_IDS) {
    save._setStorageForTests(makeStorage());
    try {
      for (const w of data.WHISPERS) {
        if (w.id === id) continue;
        if (w.biomeId === biomeId && (w.floorMin | 0) <= floorMin) {
          save.addWhisperFound(w.id);
        }
      }
      const area = router.areaForFloor(floorMin);
      assert.equal(area && area.id, biomeId, `floor ${floorMin} maps to ${biomeId}`);
      const picked = wmod.pickWhisperForFloor(floorMin, () => 0);
      assert.ok(picked, `picked at floor ${floorMin}`);
      assert.equal(picked.id, id);
    } finally {
      save._setStorageForTests(null);
    }
  }
});

test('bundle5: progress total reflects signal-memory additions (>= 26)', () => {
  const p = wmod.progress();
  assert.ok(p.total >= 26, `whisper total >= 26 after bundle 5, got ${p.total}`);
});

test('bundle5: every biome from AREAS now has at least 5 whispers', () => {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const w of data.WHISPERS) {
    if (!w.biomeId) continue;
    counts[w.biomeId] = (counts[w.biomeId] || 0) + 1;
  }
  for (const area of router.AREAS) {
    assert.ok((counts[area.id] || 0) >= 5,
      `biome ${area.id} has >= 5 whispers (got ${counts[area.id] || 0})`);
  }
});

test('bundle5: new bodies preserve the signal-memory vocabulary', () => {
  const joined = NEW_IDS.map(({ id }) => wmod.whisperById(id).body).join('\n');
  assert.match(joined, /signal/i);
  assert.match(joined, /memory|remembers/i);
  assert.match(joined, /cache|uplink|city|firewall|facility/i);
});
