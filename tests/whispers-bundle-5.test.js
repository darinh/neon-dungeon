// @ts-check
'use strict';
// Whispers bundle #6 — five mirror-anchor whispers (one per biome) that extend
// the secret-room subplot from signal memory into physical return anchors.
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
  { id: 'w-sb-07', biomeId: 'sandbox',  floorMin: 2,  voice: 'unknown',             title: 'THE MARKER LIGHT' },
  { id: 'w-cc-06', biomeId: 'cache',    floorMin: 6,  voice: 'ELENA — researcher',  title: 'ANCHOR TABLE' },
  { id: 'w-fw-06', biomeId: 'firewall', floorMin: 9,  voice: 'firewall daemon',     title: 'GLASS RULE' },
  { id: 'w-uk-06', biomeId: 'uplink',   floorMin: 12, voice: 'AXIOM-7 echo',        title: 'RETURN ADDRESS' },
  { id: 'w-on-06', biomeId: 'opennet',  floorMin: 15, voice: 'city relay',          title: 'WINDOW CHECK' },
];

test('bundle6: each mirror-anchor whisper exists with pinned metadata', () => {
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

test('bundle6: whisperById resolves each new mirror-anchor id', () => {
  for (const { id } of NEW_IDS) {
    const w = wmod.whisperById(id);
    assert.ok(w, `whisperById(${id})`);
    assert.equal(w.id, id);
  }
});

test('bundle6: pickWhisperForFloor can select each new whisper at floorMin', () => {
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

test('bundle6: progress total reflects mirror-anchor additions (>= 31)', () => {
  const p = wmod.progress();
  assert.ok(p.total >= 31, `whisper total >= 31 after bundle 6, got ${p.total}`);
});

test('bundle6: every biome from AREAS now has at least 6 whispers', () => {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const w of data.WHISPERS) {
    if (!w.biomeId) continue;
    counts[w.biomeId] = (counts[w.biomeId] || 0) + 1;
  }
  for (const area of router.AREAS) {
    assert.ok((counts[area.id] || 0) >= 6,
      `biome ${area.id} has >= 6 whispers (got ${counts[area.id] || 0})`);
  }
});

test('bundle6: new bodies preserve the mirror-anchor vocabulary', () => {
  const joined = NEW_IDS.map(({ id }) => wmod.whisperById(id).body).join('\n');
  assert.match(joined, /anchor/i);
  assert.match(joined, /mirror|reflection|window/i);
  assert.match(joined, /sandbox|cache|firewall|uplink|city|facility/i);
});
