// @ts-check
'use strict';
// Whispers bundle #12 — five mirror-fault whispers (one per biome) extending
// the reflection/anchor thread into delayed mirrors, glass exceptions, and doubles.
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
  { id: 'w-sb-13', biomeId: 'sandbox',  floorMin: 3,  voice: 'AXIOM-7 echo',       title: 'MIRROR FAULT' },
  { id: 'w-cc-12', biomeId: 'cache',    floorMin: 6,  voice: 'ELENA — researcher', title: 'REFLECTION INDEX' },
  { id: 'w-fw-12', biomeId: 'firewall', floorMin: 9,  voice: 'firewall daemon',    title: 'GLASS EXCEPTION' },
  { id: 'w-uk-12', biomeId: 'uplink',   floorMin: 12, voice: 'AXIOM-7 echo',       title: 'SKYWARD MIRROR' },
  { id: 'w-on-12', biomeId: 'opennet',  floorMin: 15, voice: 'city relay',         title: 'STOREFRONT DOUBLE' },
];

test('bundle12: each mirror-fault whisper exists with pinned metadata', () => {
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

test('bundle12: whisperById resolves each new mirror-fault id', () => {
  for (const { id } of NEW_IDS) {
    const w = wmod.whisperById(id);
    assert.ok(w, `whisperById(${id})`);
    assert.equal(w.id, id);
  }
});

test('bundle12: pickWhisperForFloor can select each new whisper at floorMin', () => {
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

test('bundle12: progress total reflects mirror-fault additions (>= 61)', () => {
  const p = wmod.progress();
  assert.ok(p.total >= 61, `whisper total >= 61 after bundle 12, got ${p.total}`);
});

test('bundle12: every biome from AREAS now has at least 12 whispers', () => {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const w of data.WHISPERS) {
    if (!w.biomeId) continue;
    counts[w.biomeId] = (counts[w.biomeId] || 0) + 1;
  }
  for (const area of router.AREAS) {
    assert.ok((counts[area.id] || 0) >= 12,
      `biome ${area.id} has >= 12 whispers (got ${counts[area.id] || 0})`);
  }
});

test('bundle12: ids remain unique across the whole WHISPERS table', () => {
  const ids = data.WHISPERS.map((/** @type {any} */ w) => w.id);
  assert.equal(new Set(ids).size, ids.length, 'all whisper ids are unique');
});

test('bundle12: new bodies preserve mirror-fault reflection vocabulary', () => {
  const joined = NEW_IDS.map(({ id }) => wmod.whisperById(id).body).join('\n');
  assert.match(joined, /mirror|reflection|reflected|storefront window/i);
  assert.match(joined, /glass|window|copy|double/i);
  assert.match(joined, /delay|late|after|hesitates/i);
});
