// @ts-check
'use strict';
// Whispers bundle #15 — five receipt/acknowledgement whispers (one per biome)
// extending the message-delivery thread into proofs, signatures, and replies.
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
  { id: 'w-sb-16', biomeId: 'sandbox',  floorMin: 2,  voice: 'unknown',             title: 'BOOT RECEIPT' },
  { id: 'w-cc-15', biomeId: 'cache',    floorMin: 5,  voice: 'ELENA — researcher', title: 'ACKNOWLEDGEMENT CACHE' },
  { id: 'w-fw-15', biomeId: 'firewall', floorMin: 8,  voice: 'firewall daemon',    title: 'SIGNED EXCEPTION' },
  { id: 'w-uk-15', biomeId: 'uplink',   floorMin: 11, voice: 'AXIOM-7 echo',       title: 'DELIVERY PROOF' },
  { id: 'w-on-15', biomeId: 'opennet',  floorMin: 15, voice: 'city relay',         title: 'RETURN RECEIPT' },
];

test('bundle15: each receipt whisper exists with pinned metadata', () => {
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

test('bundle15: whisperById resolves each new receipt id', () => {
  for (const { id } of NEW_IDS) {
    const w = wmod.whisperById(id);
    assert.ok(w, `whisperById(${id})`);
    assert.equal(w.id, id);
  }
});

test('bundle15: pickWhisperForFloor can select each new whisper at floorMin', () => {
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

test('bundle15: progress total reflects receipt additions (>= 76)', () => {
  const p = wmod.progress();
  assert.ok(p.total >= 76, `whisper total >= 76 after bundle 15, got ${p.total}`);
});

test('bundle15: every biome from AREAS now has at least 15 whispers', () => {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const w of data.WHISPERS) {
    if (!w.biomeId) continue;
    counts[w.biomeId] = (counts[w.biomeId] || 0) + 1;
  }
  for (const area of router.AREAS) {
    assert.ok((counts[area.id] || 0) >= 15,
      `biome ${area.id} has >= 15 whispers (got ${counts[area.id] || 0})`);
  }
});

test('bundle15: ids remain unique across the whole WHISPERS table', () => {
  const ids = data.WHISPERS.map((/** @type {any} */ w) => w.id);
  assert.equal(new Set(ids).size, ids.length, 'all whisper ids are unique');
});

test('bundle15: new bodies preserve receipt and delivery vocabulary', () => {
  const joined = NEW_IDS.map(({ id }) => wmod.whisperById(id).body).join('\n');
  assert.match(joined, /receipt|receipts|ack|acknowledgements/i);
  assert.match(joined, /message|packet|delivery|delivered|reply/i);
  assert.match(joined, /proof|signature|signed|stamped|checksum/i);
});
