// @ts-check
'use strict';
// Whispers bundle #8 — five black-ice lockdown whispers (one per biome) that
// reframe quarantine/freeze imagery as protective, not merely hostile.
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
  { id: 'w-sb-09', biomeId: 'sandbox',  floorMin: 2,  voice: 'unknown',             title: 'COLD BOOT WARNING' },
  { id: 'w-cc-08', biomeId: 'cache',    floorMin: 6,  voice: 'ELENA — researcher',  title: 'QUARANTINE SHELF' },
  { id: 'w-fw-08', biomeId: 'firewall', floorMin: 9,  voice: 'black ice',           title: 'LOCKDOWN CATECHISM' },
  { id: 'w-uk-08', biomeId: 'uplink',   floorMin: 12, voice: 'AXIOM-7 echo',        title: 'FROST ON THE ANTENNA' },
  { id: 'w-on-08', biomeId: 'opennet',  floorMin: 15, voice: 'city relay',          title: 'THE LAST BLUE LIGHT' },
];

test('bundle8: each black-ice whisper exists with pinned metadata', () => {
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

test('bundle8: whisperById resolves each new black-ice id', () => {
  for (const { id } of NEW_IDS) {
    const w = wmod.whisperById(id);
    assert.ok(w, `whisperById(${id})`);
    assert.equal(w.id, id);
  }
});

test('bundle8: pickWhisperForFloor can select each new whisper at floorMin', () => {
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

test('bundle8: progress total reflects black-ice additions (>= 41)', () => {
  const p = wmod.progress();
  assert.ok(p.total >= 41, `whisper total >= 41 after bundle 8, got ${p.total}`);
});

test('bundle8: every biome from AREAS now has at least 8 whispers', () => {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const w of data.WHISPERS) {
    if (!w.biomeId) continue;
    counts[w.biomeId] = (counts[w.biomeId] || 0) + 1;
  }
  for (const area of router.AREAS) {
    assert.ok((counts[area.id] || 0) >= 8,
      `biome ${area.id} has >= 8 whispers (got ${counts[area.id] || 0})`);
  }
});

test('bundle8: new bodies preserve lockdown and protection vocabulary', () => {
  const joined = NEW_IDS.map(({ id }) => wmod.whisperById(id).body).join('\n');
  assert.match(joined, /black ice|ice|frost|freeze|cold/i);
  assert.match(joined, /lock|quarantine|guard|shelter|protect/i);
  assert.match(joined, /name|memory|signal|corridor|exit/i);
});
