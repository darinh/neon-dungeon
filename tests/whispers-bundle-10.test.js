// @ts-check
'use strict';
// Whispers bundle #11 — five ghost-route whispers (one per biome) extending
// the dead-drop thread into hidden paths, detours, and wayfinding signals.
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
  { id: 'w-sb-12', biomeId: 'sandbox',  floorMin: 2,  voice: 'unknown',             title: 'CHALK ROUTE' },
  { id: 'w-cc-11', biomeId: 'cache',    floorMin: 5,  voice: 'ELENA — researcher', title: 'ROUTE CACHE' },
  { id: 'w-fw-11', biomeId: 'firewall', floorMin: 8,  voice: 'maintenance echo',   title: 'ACCESS DETOUR' },
  { id: 'w-uk-11', biomeId: 'uplink',   floorMin: 11, voice: 'AXIOM-7 echo',       title: 'GHOST ROUTE PING' },
  { id: 'w-on-11', biomeId: 'opennet',  floorMin: 14, voice: 'city relay',         title: 'NIGHT BUS TRANSFER' },
];

test('bundle11: each ghost-route whisper exists with pinned metadata', () => {
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

test('bundle11: whisperById resolves each new ghost-route id', () => {
  for (const { id } of NEW_IDS) {
    const w = wmod.whisperById(id);
    assert.ok(w, `whisperById(${id})`);
    assert.equal(w.id, id);
  }
});

test('bundle11: pickWhisperForFloor can select each new whisper at floorMin', () => {
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

test('bundle11: progress total reflects ghost-route additions (>= 56)', () => {
  const p = wmod.progress();
  assert.ok(p.total >= 56, `whisper total >= 56 after bundle 11, got ${p.total}`);
});

test('bundle11: every biome from AREAS now has at least 11 whispers', () => {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const w of data.WHISPERS) {
    if (!w.biomeId) continue;
    counts[w.biomeId] = (counts[w.biomeId] || 0) + 1;
  }
  for (const area of router.AREAS) {
    assert.ok((counts[area.id] || 0) >= 11,
      `biome ${area.id} has >= 11 whispers (got ${counts[area.id] || 0})`);
  }
});

test('bundle11: ids remain unique across the whole WHISPERS table', () => {
  const ids = data.WHISPERS.map((/** @type {any} */ w) => w.id);
  assert.equal(new Set(ids).size, ids.length, 'all whisper ids are unique');
});

test('bundle11: new bodies preserve ghost-route wayfinding vocabulary', () => {
  const joined = NEW_IDS.map(({ id }) => wmod.whisperById(id).body).join('\n');
  assert.match(joined, /route|routes|path|paths|detour/i);
  assert.match(joined, /follow|move|stops|arrows|ladder/i);
  assert.match(joined, /ghost|signal|map|sign|transfer/i);
});
