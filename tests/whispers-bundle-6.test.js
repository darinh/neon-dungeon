// @ts-check
'use strict';
// Whispers bundle #7 — five threshold/keyhole whispers (one per biome) that
// extend the secret-room subplot from anchors into doors, gates, and exits.
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
  { id: 'w-sb-08', biomeId: 'sandbox',  floorMin: 3,  voice: 'AXIOM-7 echo',        title: 'THRESHOLD DRILL' },
  { id: 'w-cc-07', biomeId: 'cache',    floorMin: 5,  voice: 'ELENA — researcher',  title: 'KEYHOLE INDEX' },
  { id: 'w-fw-07', biomeId: 'firewall', floorMin: 8,  voice: 'firewall daemon',     title: 'PERMISSION DENIED' },
  { id: 'w-uk-07', biomeId: 'uplink',   floorMin: 11, voice: 'AXIOM-7 echo',        title: 'EXIT INTERVIEW' },
  { id: 'w-on-07', biomeId: 'opennet',  floorMin: 14, voice: 'city relay',          title: 'CROSSWALK SAINT' },
];

test('bundle7: each threshold whisper exists with pinned metadata', () => {
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

test('bundle7: whisperById resolves each new threshold id', () => {
  for (const { id } of NEW_IDS) {
    const w = wmod.whisperById(id);
    assert.ok(w, `whisperById(${id})`);
    assert.equal(w.id, id);
  }
});

test('bundle7: pickWhisperForFloor can select each new whisper at floorMin', () => {
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

test('bundle7: progress total reflects threshold additions (>= 36)', () => {
  const p = wmod.progress();
  assert.ok(p.total >= 36, `whisper total >= 36 after bundle 7, got ${p.total}`);
});

test('bundle7: every biome from AREAS now has at least 7 whispers', () => {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const w of data.WHISPERS) {
    if (!w.biomeId) continue;
    counts[w.biomeId] = (counts[w.biomeId] || 0) + 1;
  }
  for (const area of router.AREAS) {
    assert.ok((counts[area.id] || 0) >= 7,
      `biome ${area.id} has >= 7 whispers (got ${counts[area.id] || 0})`);
  }
});

test('bundle7: new bodies preserve the threshold vocabulary', () => {
  const joined = NEW_IDS.map(({ id }) => wmod.whisperById(id).body).join('\n');
  assert.match(joined, /threshold|gate|keyhole|door/i);
  assert.match(joined, /exit|permission|return/i);
  assert.match(joined, /reflection|shadow|city|facility/i);
});
