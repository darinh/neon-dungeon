// @ts-check
'use strict';
// Whispers bundle #4 — five new echo-thread whispers (one per biome) that
// connect the AXIOM-7 copy/voice motif across the secret-room subplot.
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
  { id: 'w-sb-05', biomeId: 'sandbox',  floorMin: 3,  voice: 'AXIOM-7 echo',       title: 'THE VOICE TEST' },
  { id: 'w-cc-04', biomeId: 'cache',    floorMin: 5,  voice: 'ELENA — researcher', title: 'AUDIO ROOM B' },
  { id: 'w-fw-04', biomeId: 'firewall', floorMin: 8,  voice: 'maintenance echo',   title: 'RETURN PATH' },
  { id: 'w-uk-04', biomeId: 'uplink',   floorMin: 11, voice: 'AXIOM-7 echo',       title: 'THE BIRD REPEATED ME' },
  { id: 'w-on-04', biomeId: 'opennet',  floorMin: 14, voice: 'unknown',            title: 'CALL AND RESPONSE' },
];

test('bundle4: each echo-thread whisper exists with pinned metadata', () => {
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

test('bundle4: whisperById resolves each new echo-thread id', () => {
  for (const { id } of NEW_IDS) {
    const w = wmod.whisperById(id);
    assert.ok(w, `whisperById(${id})`);
    assert.equal(w.id, id);
  }
});

test('bundle4: pickWhisperForFloor can select each new whisper at floorMin', () => {
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

test('bundle4: progress total reflects echo-thread additions (>= 21)', () => {
  const p = wmod.progress();
  assert.ok(p.total >= 21, `whisper total >= 21 after bundle 4, got ${p.total}`);
});

test('bundle4: every biome from AREAS now has at least 4 whispers', () => {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const w of data.WHISPERS) {
    if (!w.biomeId) continue;
    counts[w.biomeId] = (counts[w.biomeId] || 0) + 1;
  }
  for (const area of router.AREAS) {
    assert.ok((counts[area.id] || 0) >= 4,
      `biome ${area.id} has >= 4 whispers (got ${counts[area.id] || 0})`);
  }
});

test('bundle4: new bodies preserve the echo/copy thread vocabulary', () => {
  const joined = NEW_IDS.map(({ id }) => wmod.whisperById(id).body).join('\n');
  assert.match(joined, /voice/i);
  assert.match(joined, /echo/i);
  assert.match(joined, /copy|copies|reflection/i);
});
