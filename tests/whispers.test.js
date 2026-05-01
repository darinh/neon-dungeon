'use strict';
// src/data/whispers.js + src/meta/whispers.js — secret-room subplot tests.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const data = require(path.resolve(__dirname, '..', 'src', 'data', 'whispers.js'));
const wmod = require(path.resolve(__dirname, '..', 'src', 'meta', 'whispers.js'));
const save = require(path.resolve(__dirname, '..', 'src', 'meta', 'save.js'));

// Tiny in-memory storage so loadMeta/saveMeta cycle works in Node.
function makeStorage() {
  const store = {};
  return {
    /** @param {string} k */ getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    /** @param {string} k @param {string} v */ setItem(k, v) { store[k] = String(v); },
    /** @param {string} k */ removeItem(k) { delete store[k]; },
    clear() { for (const k of Object.keys(store)) delete store[k]; },
  };
}

test('whispers data: has WHISPERS array with at least 5 entries', () => {
  assert.ok(Array.isArray(data.WHISPERS), 'WHISPERS is array');
  assert.ok(data.WHISPERS.length >= 5, 'at least 5 whispers shipped');
});

test('whispers data: every entry has required fields with correct types', () => {
  for (const w of data.WHISPERS) {
    assert.equal(typeof w.id, 'string');
    assert.ok(w.id.length > 0, `whisper id non-empty: ${w.id}`);
    assert.equal(typeof w.title, 'string');
    assert.equal(typeof w.body, 'string');
    assert.ok(w.body.length >= 60, `body >= 60 chars (${w.id}): ${w.body.length}`);
    assert.ok(w.body.length <= 320, `body <= 320 chars (${w.id}): ${w.body.length}`);
    assert.equal(typeof w.voice, 'string');
    assert.equal(typeof w.floorMin, 'number');
    assert.ok(w.floorMin >= 1, `floorMin >= 1 (${w.id})`);
    assert.ok(w.biomeId === null || typeof w.biomeId === 'string',
      `biomeId is string|null (${w.id})`);
  }
});

test('whispers data: ids are unique', () => {
  const seen = new Set();
  for (const w of data.WHISPERS) {
    assert.ok(!seen.has(w.id), `duplicate whisper id: ${w.id}`);
    seen.add(w.id);
  }
});

test('whispers meta: whisperById finds known + returns null for unknown', () => {
  const first = data.WHISPERS[0];
  assert.equal(wmod.whisperById(first.id), first);
  assert.equal(wmod.whisperById('nonexistent'), null);
  assert.equal(wmod.whisperById(''), null);
  assert.equal(wmod.whisperById(/** @type {any} */ (42)), null);
});

test('whispers meta: groupedByBiome returns all biomes with their whispers', () => {
  const groups = wmod.groupedByBiome();
  assert.ok(Array.isArray(groups));
  assert.ok(groups.length > 0);
  let total = 0;
  for (const g of groups) {
    assert.equal(typeof g.biomeId, 'string');
    assert.equal(typeof g.biomeName, 'string');
    assert.ok(Array.isArray(g.whispers));
    total += g.whispers.length;
  }
  assert.equal(total, data.WHISPERS.length, 'every whisper accounted for in groups');
});

test('save: addWhisperFound + markWhisperRead persist across loadMeta', () => {
  save._setStorageForTests(makeStorage());
  try {
    const id = data.WHISPERS[0].id;
    assert.equal(save.addWhisperFound(id), true, 'first add returns true');
    assert.equal(save.addWhisperFound(id), false, 'second add returns false (idempotent)');
    let m = save.loadMeta();
    assert.ok(Array.isArray(m.whispersFound));
    assert.ok(m.whispersFound.includes(id));
    assert.ok(!m.whispersRead.includes(id));
    assert.equal(save.markWhisperRead(id), true);
    assert.equal(save.markWhisperRead(id), false, 'second mark is no-op');
    m = save.loadMeta();
    assert.ok(m.whispersRead.includes(id));
  } finally {
    save._setStorageForTests(null);
  }
});

test('save: addWhisperFound rejects bad input', () => {
  save._setStorageForTests(makeStorage());
  try {
    assert.equal(save.addWhisperFound(''), false);
    assert.equal(save.addWhisperFound(/** @type {any} */ (null)), false);
    assert.equal(save.addWhisperFound(/** @type {any} */ (123)), false);
    assert.equal(save.markWhisperRead(''), false);
  } finally {
    save._setStorageForTests(null);
  }
});

test('whispers meta: progress reflects read count vs total data size', () => {
  save._setStorageForTests(makeStorage());
  try {
    let p = wmod.progress();
    assert.equal(p.read, 0);
    assert.equal(p.total, data.WHISPERS.length);
    save.markWhisperRead(data.WHISPERS[0].id);
    save.markWhisperRead(data.WHISPERS[1].id);
    p = wmod.progress();
    assert.equal(p.read, 2);
  } finally {
    save._setStorageForTests(null);
  }
});

test('whispers meta: unreadCount tracks found-but-not-read', () => {
  save._setStorageForTests(makeStorage());
  try {
    save.addWhisperFound(data.WHISPERS[0].id);
    save.addWhisperFound(data.WHISPERS[1].id);
    assert.equal(wmod.unreadCount(), 2);
    save.markWhisperRead(data.WHISPERS[0].id);
    assert.equal(wmod.unreadCount(), 1);
  } finally {
    save._setStorageForTests(null);
  }
});

test('whispers meta: pickWhisperForFloor returns null on bad input', () => {
  assert.equal(wmod.pickWhisperForFloor(0), null);
  assert.equal(wmod.pickWhisperForFloor(-1), null);
  assert.equal(wmod.pickWhisperForFloor(/** @type {any} */ ('abc')), null);
});

test('whispers meta: pickWhisperForFloor honors found-set + floorMin + biome', () => {
  save._setStorageForTests(makeStorage());
  try {
    // Floor 1 = sandbox biome. Should pick a sandbox whisper with floorMin <= 1.
    let picks = 0;
    for (let i = 0; i < 50; i++) {
      const w = wmod.pickWhisperForFloor(1, () => Math.random());
      if (w) { picks++; assert.equal(w.biomeId, 'sandbox'); assert.ok(w.floorMin <= 1); }
    }
    assert.ok(picks > 0, 'at least one sandbox whisper should be pickable on floor 1');
    // Mark all sandbox/floor-1-eligible as found → next pick must be null.
    for (const w of data.WHISPERS) {
      if (w.biomeId === 'sandbox' && w.floorMin <= 1) save.addWhisperFound(w.id);
    }
    assert.equal(wmod.pickWhisperForFloor(1, () => 0), null,
      'no eligible whispers after all marked found');
  } finally {
    save._setStorageForTests(null);
  }
});

test('save schema: defaultMeta includes whispersFound and whispersRead arrays', () => {
  const m = save.defaultMeta();
  assert.ok(Array.isArray(m.whispersFound));
  assert.ok(Array.isArray(m.whispersRead));
  assert.equal(m.whispersFound.length, 0);
  assert.equal(m.whispersRead.length, 0);
});

test('save schema: META_VERSION is at least 3 (whispers fields added)', () => {
  assert.ok(save.META_VERSION >= 3);
});
