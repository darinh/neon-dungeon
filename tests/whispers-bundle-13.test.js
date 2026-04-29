// @ts-check
'use strict';
// Whispers bundle #14 — five afterimage/exposure whispers (one per biome)
// extending the signal/anchor thread into delayed light, shadows, and retinal maps.
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
  { id: 'w-sb-15', biomeId: 'sandbox',  floorMin: 3,  voice: 'unknown',             title: 'AFTERIMAGE DRILL' },
  { id: 'w-cc-14', biomeId: 'cache',    floorMin: 6,  voice: 'ELENA — researcher', title: 'EXPOSURE TABLE' },
  { id: 'w-fw-14', biomeId: 'firewall', floorMin: 9,  voice: 'firewall daemon',    title: 'RETINAL EXCEPTION' },
  { id: 'w-uk-14', biomeId: 'uplink',   floorMin: 12, voice: 'AXIOM-7 echo',       title: 'PHOSPHENE UPLINK' },
  { id: 'w-on-14', biomeId: 'opennet',  floorMin: 15, voice: 'city relay',         title: 'CROSSWALK AFTERIMAGE' },
];

test('bundle14: each afterimage whisper exists with pinned metadata', () => {
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

test('bundle14: whisperById resolves each new afterimage id', () => {
  for (const { id } of NEW_IDS) {
    const w = wmod.whisperById(id);
    assert.ok(w, `whisperById(${id})`);
    assert.equal(w.id, id);
  }
});

test('bundle14: pickWhisperForFloor can select each new whisper at floorMin', () => {
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

test('bundle14: progress total reflects afterimage additions (>= 71)', () => {
  const p = wmod.progress();
  assert.ok(p.total >= 71, `whisper total >= 71 after bundle 14, got ${p.total}`);
});

test('bundle14: every biome from AREAS now has at least 14 whispers', () => {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const w of data.WHISPERS) {
    if (!w.biomeId) continue;
    counts[w.biomeId] = (counts[w.biomeId] || 0) + 1;
  }
  for (const area of router.AREAS) {
    assert.ok((counts[area.id] || 0) >= 14,
      `biome ${area.id} has >= 14 whispers (got ${counts[area.id] || 0})`);
  }
});

test('bundle14: ids remain unique across the whole WHISPERS table', () => {
  const ids = data.WHISPERS.map((/** @type {any} */ w) => w.id);
  assert.equal(new Set(ids).size, ids.length, 'all whisper ids are unique');
});

test('bundle14: new bodies preserve afterimage and exposure vocabulary', () => {
  const joined = NEW_IDS.map(({ id }) => wmod.whisperById(id).body).join('\n');
  assert.match(joined, /afterimage|exposure|exposed|phosphene/i);
  assert.match(joined, /light|brightness|bright|daylight/i);
  assert.match(joined, /shadow|outline|frame|retinal/i);
});
