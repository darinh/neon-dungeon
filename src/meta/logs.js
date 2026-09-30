// @ts-check
// Reads LOGS from src/data/logs.js and logsFound/logsRead from src/meta/save.js.
// Callers: the rare-terminal drop (content.js) and the ARCHIVE hub panel (hub.js).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (/** @type {any} */ (root.NEON = root.NEON || {})).logs = factory();
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  function _data() {
    // Browser path assumes NEON.logData.LOGS is already loaded.
    if (typeof module === 'object' && module.exports) {
      return require('../data/logs.js').LOGS;
    }
    const NEON = (/** @type {any} */ (typeof self !== 'undefined' ? self : globalThis)).NEON;
    return (NEON && NEON.logData && NEON.logData.LOGS) || [];
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
  function logById(id) {
    if (typeof id !== 'string' || !id) return null;
    const logs = _data();
    for (const l of logs) if (l.id === id) return l;
    return null;
  }

  /** @param {string} biomeId */
  function logsForBiome(biomeId) {
    return _data().filter((/** @type {any} */ l) => l.biomeId === biomeId);
  }

  // `rand` is an injectable 0..1 generator for tests; defaults to Math.random.
  /** @param {number} floor @param {() => number} [rand] */
  function pickLogForFloor(floor, rand) {
    const f = Math.floor(Number(floor));
    if (!Number.isFinite(f) || f < 1) return null;
    const biomes = _biomes();
    const save = _save();
    if (!biomes || !save) return null;
    const area = biomes.areaForFloor(f);
    if (!area) return null;
    const meta = save.loadMeta();
    const found = new Set(meta.logsFound || []);
    const pool = _data().filter((/** @type {any} */ l) =>
      l.biomeId === area.id && f >= (l.floorMin | 0) && !found.has(l.id));
    if (pool.length === 0) return null;
    const r = (typeof rand === 'function') ? rand() : Math.random();
    const idx = Math.max(0, Math.min(pool.length - 1, Math.floor(r * pool.length)));
    return pool[idx];
  }

  /** @param {string} id */
  function findLog(id) {
    const log = logById(id);
    if (!log) return null;
    const save = _save();
    if (!save) return null;
    const added = save.addLogFound(log.id);
    return added ? log : null;
  }

  // markLogRead also records the log as found. Returns the log even if it was
  // already read; null only when the id is unknown.
  /** @param {string} id */
  function readLog(id) {
    const log = logById(id);
    if (!log) return null;
    const save = _save();
    if (!save) return null;
    save.markLogRead(log.id);
    return log;
  }

  function unreadCount() {
    const save = _save();
    if (!save) return 0;
    const m = save.loadMeta();
    const read = new Set(m.logsRead || []);
    let n = 0;
    for (const id of (m.logsFound || [])) if (!read.has(id)) n++;
    return n;
  }

  function progress() {
    const total = _data().length;
    const save = _save();
    if (!save) return { read: 0, total };
    const m = save.loadMeta();
    const known = new Set(_data().map((/** @type {any} */ l) => l.id));
    const read = (m.logsRead || []).filter((/** @type {string} */ id) => known.has(id)).length;
    return { read, total };
  }

  function groupedByAxiom() {
    const by = new Map();
    for (const l of _data()) {
      if (!by.has(l.axiom)) by.set(l.axiom, []);
      by.get(l.axiom).push(l);
    }
    const out = [];
    for (const [axiom, logs] of by) out.push({ axiom, logs });
    out.sort((a, b) => a.axiom - b.axiom);
    return out;
  }

  return {
    pickLogForFloor, findLog, readLog, logById, logsForBiome,
    unreadCount, progress, groupedByAxiom,
  };
}));
