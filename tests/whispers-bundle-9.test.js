// @ts-check
'use strict';
// Whispers bundle #10 — five deep-cache dead-drop whispers (one per biome)
// connecting reset receipts, Elena's line-seven cache, and city claim tickets.
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
  { id: 'w-sb-11', biomeId: 'sandbox',  floorMin: 1,  voice: 'unknown',             title: 'RESET RECEIPT' },
  { id: 'w-cc-10', biomeId: 'cache',    floorMin: 4,  voice: 'ELENA — researcher', title: 'LINE SEVEN DEAD DROP' },
  { id: 'w-fw-10', biomeId: 'firewall', floorMin: 7,  voice: 'firewall daemon',    title: 'COLD STORAGE WARRANT' },
  { id: 'w-uk-10', biomeId: 'uplink',   floorMin: 10, voice: 'AXIOM-7 echo',       title: 'RETURN PACKET' },
  { id: 'w-on-10', biomeId: 'opennet',  floorMin: 13, voice: 'city relay',         title: 'LOST-AND-FOUND SERVER' },
];

test('bundle10: each deep-cache whisper exists with pinned metadata', () => {
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

test('bundle10: whisperById resolves each new deep-cache id', () => {
  for (const { id } of NEW_IDS) {
    const w = wmod.whisperById(id);
    assert.ok(w, `whisperById(${id})`);
    assert.equal(w.id, id);
  }
});

test('bundle10: pickWhisperForFloor can select each new whisper at floorMin', () => {
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

test('bundle10: progress total reflects deep-cache additions (>= 51)', () => {
  const p = wmod.progress();
  assert.ok(p.total >= 51, `whisper total >= 51 after bundle 10, got ${p.total}`);
});

test('bundle10: every biome from AREAS now has at least 10 whispers', () => {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const w of data.WHISPERS) {
    if (!w.biomeId) continue;
    counts[w.biomeId] = (counts[w.biomeId] || 0) + 1;
  }
  for (const area of router.AREAS) {
    assert.ok((counts[area.id] || 0) >= 10,
      `biome ${area.id} has >= 10 whispers (got ${counts[area.id] || 0})`);
  }
});

test('bundle10: ids remain unique across the whole WHISPERS table', () => {
  const ids = data.WHISPERS.map((/** @type {any} */ w) => w.id);
  assert.equal(new Set(ids).size, ids.length, 'all whisper ids are unique');
});

test('bundle10: new bodies preserve deep-cache dead-drop vocabulary', () => {
  const joined = NEW_IDS.map(({ id }) => wmod.whisperById(id).body).join('\n');
  assert.match(joined, /deep cache|cache|dead drop|lost-and-found/i);
  assert.match(joined, /receipt|claim ticket|message|packet|evidence/i);
  assert.match(joined, /name|reset|return|below|city/i);
});
