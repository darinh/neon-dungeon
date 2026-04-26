// @ts-check
// src/meta/whispers.js — Secret-room whisper runtime (companion to logs.js).
//
// Whispers (src/data/whispers.js) are a deeper-tier narrative layer than
// the main ARCHIVE logs. They drop ONLY from secret rooms (interact-broken
// cracked walls). This module mirrors the logs.js API for a clean parallel:
//
// Public API:
//   pickWhisperForFloor(floor, rand?)  → whisper | null  — eligible & unfound
//   findWhisper(id)                    → whisper | null  — writes save
//   readWhisper(id)                    → whisper | null  — writes save
//   whisperById(id)                    → whisper | null
//   unreadCount()                      → number
//   progress()                         → {read,total}
//   groupedByBiome()                   → [{biomeId, biomeName, whispers[]}]
//
// Save schema additions handled by src/meta/save.js:
//   whispersFound: string[]
//   whispersRead:  string[]
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (/** @type {any} */ (root.NEON = root.NEON || {})).whispers = factory();
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  function _data() {
    if (typeof module === 'object' && module.exports) {
      return require('../data/whispers.js').WHISPERS;
    }
    const NEON = (/** @type {any} */ (typeof self !== 'undefined' ? self : globalThis)).NEON;
    return (NEON && NEON.whisperData && NEON.whisperData.WHISPERS) || [];
  }

  function _save() {
    if (typeof module === 'object' && module.exports) {
      return require('./save.js');
    }
    const NEON = (/** @type {any} */ (typeof self !== 'undefined' ? self : globalThis)).NEON;
    return (NEON && NEON.save) || null;
  }

  function _biomes() {
    if (typeof module === 'object' && module.exports) {
      return require('../data/biomes.js');
    }
    const NEON = (/** @type {any} */ (typeof self !== 'undefined' ? self : globalThis)).NEON;
    return (NEON && NEON.biomes) || null;
  }

  /** @param {string} id */
  function whisperById(id) {
    if (typeof id !== 'string' || !id) return null;
    for (const w of _data()) if (w.id === id) return w;
    return null;
  }

  // pickWhisperForFloor — returns an unfound whisper eligible for this floor
  // (biome matches and floor >= floorMin), or null. `rand` injectable for tests.
  /** @param {number} floor @param {() => number} [rand] */
  function pickWhisperForFloor(floor, rand) {
    const f = Math.floor(Number(floor));
    if (!Number.isFinite(f) || f < 1) return null;
    const biomes = _biomes();
    const save = _save();
    if (!biomes || !save) return null;
    const area = biomes.areaForFloor(f);
    if (!area) return null;
    const meta = save.loadMeta();
    const found = new Set(meta.whispersFound || []);
    const pool = _data().filter((/** @type {any} */ w) =>
      (w.biomeId == null || w.biomeId === area.id) &&
      f >= (w.floorMin | 0) &&
      !found.has(w.id));
    if (pool.length === 0) return null;
    const r = (typeof rand === 'function') ? rand() : Math.random();
    const idx = Math.max(0, Math.min(pool.length - 1, Math.floor(r * pool.length)));
    return pool[idx];
  }

  /** @param {string} id */
  function findWhisper(id) {
    const w = whisperById(id);
    if (!w) return null;
    const save = _save();
    if (!save) return null;
    const added = save.addWhisperFound(w.id);
    return added ? w : null;
  }

  /** @param {string} id */
  function readWhisper(id) {
    const w = whisperById(id);
    if (!w) return null;
    const save = _save();
    if (!save) return null;
    save.markWhisperRead(w.id);
    return w;
  }

  function unreadCount() {
    const save = _save();
    if (!save) return 0;
    const m = save.loadMeta();
    const read = new Set(m.whispersRead || []);
    let n = 0;
    for (const id of (m.whispersFound || [])) if (!read.has(id)) n++;
    return n;
  }

  function progress() {
    const total = _data().length;
    const save = _save();
    if (!save) return { read: 0, total };
    const m = save.loadMeta();
    const known = new Set(_data().map((/** @type {any} */ w) => w.id));
    const read = (m.whispersRead || []).filter((/** @type {string} */ id) => known.has(id)).length;
    return { read, total };
  }

  function groupedByBiome() {
    const biomes = _biomes();
    /** @type {Map<string, {biomeId:string, biomeName:string, whispers:any[]}>} */
    const by = new Map();
    for (const w of _data()) {
      const bid = w.biomeId || '_any';
      let bucket = by.get(bid);
      if (!bucket) {
        let name = bid === '_any' ? 'UNFILED' : bid.toUpperCase();
        try {
          if (biomes && biomes.AREAS) {
            const a = biomes.AREAS.find((/** @type {any} */ x) => x.id === bid);
            if (a && a.name) name = String(a.name).toUpperCase();
          }
        } catch (_) { /* ignore */ }
        bucket = { biomeId: bid, biomeName: name, whispers: [] };
        by.set(bid, bucket);
      }
      bucket.whispers.push(w);
    }
    return Array.from(by.values());
  }

  return {
    WHISPERS: _data(),
    whisperById, pickWhisperForFloor,
    findWhisper, readWhisper,
    unreadCount, progress, groupedByBiome,
  };
}));
