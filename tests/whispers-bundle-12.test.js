// @ts-check
'use strict';
// Whispers bundle #13 — five ion-storm whispers (one per biome) extending
// the signal/anchor thread into charged weather, lightning, and blue-wire rain.
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
  { id: 'w-sb-14', biomeId: 'sandbox',  floorMin: 2,  voice: 'unknown',             title: 'STATIC WEATHER' },
  { id: 'w-cc-13', biomeId: 'cache',    floorMin: 5,  voice: 'ELENA — researcher', title: 'STORM BUFFER' },
  { id: 'w-fw-13', biomeId: 'firewall', floorMin: 8,  voice: 'firewall daemon',    title: 'ION CONFESSION' },
  { id: 'w-uk-13', biomeId: 'uplink',   floorMin: 11, voice: 'AXIOM-7 echo',       title: 'LIGHTNING HANDSHAKE' },
  { id: 'w-on-13', biomeId: 'opennet',  floorMin: 14, voice: 'city relay',         title: 'BLUE-WIRE RAIN' },
];

test('bundle13: each ion-storm whisper exists with pinned metadata', () => {
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

test('bundle13: whisperById resolves each new ion-storm id', () => {
  for (const { id } of NEW_IDS) {
    const w = wmod.whisperById(id);
    assert.ok(w, `whisperById(${id})`);
    assert.equal(w.id, id);
  }
});

test('bundle13: pickWhisperForFloor can select each new whisper at floorMin', () => {
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

test('bundle13: progress total reflects ion-storm additions (>= 66)', () => {
  const p = wmod.progress();
  assert.ok(p.total >= 66, `whisper total >= 66 after bundle 13, got ${p.total}`);
});

test('bundle13: every biome from AREAS now has at least 13 whispers', () => {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const w of data.WHISPERS) {
    if (!w.biomeId) continue;
    counts[w.biomeId] = (counts[w.biomeId] || 0) + 1;
  }
  for (const area of router.AREAS) {
    assert.ok((counts[area.id] || 0) >= 13,
      `biome ${area.id} has >= 13 whispers (got ${counts[area.id] || 0})`);
  }
});

test('bundle13: ids remain unique across the whole WHISPERS table', () => {
  const ids = data.WHISPERS.map((/** @type {any} */ w) => w.id);
  assert.equal(new Set(ids).size, ids.length, 'all whisper ids are unique');
});

test('bundle13: new bodies preserve ion-storm signal vocabulary', () => {
  const joined = NEW_IDS.map(({ id }) => wmod.whisperById(id).body).join('\n');
  assert.match(joined, /storm|weather|rain/i);
  assert.match(joined, /ion|lightning|charge|bolt/i);
  assert.match(joined, /signal|protocol|checksum|wire/i);
});
