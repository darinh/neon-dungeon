// src/meta/save.js — persistent meta-progression state (shards, upgrades, stats)
//
// This file follows the NEON "UMD-lite" module pattern: IIFE that exposes a
// single namespace object via `window.NEON.save` in the browser AND exports for
// Node so we can unit-test pure logic without a DOM.
//
// See CONTRIBUTING.md for the pattern template.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.NEON = root.NEON || {}).save = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ─── Schema ────────────────────────────────────────────────────────────────
  // META_UPGRADES defines the persistent upgrade tree. save.js owns this because
  // loadMeta() clamps stored upgrade levels against these bounds during
  // deserialization — the data is inseparable from the loader.
  const META_UPGRADES = [
    { id:'VITAL_BOOST',   name:'Vital Systems',    desc:'+10 max HP',                 maxLv:3, costs:[5,12,22],  icon:'♥' },
    { id:'SCAVENGER',     name:'Scavenger Protocol',desc:'+15% credit gain',          maxLv:3, costs:[5,12,22],  icon:'◈' },
    { id:'QUICK_LEARNER', name:'Quick Learner',     desc:'+15% XP gain',              maxLv:3, costs:[5,12,22],  icon:'★' },
    { id:'ARMOR_PLATING', name:'Armor Plating',     desc:'+1 starting DEF',           maxLv:3, costs:[8,18,30],  icon:'▣' },
    { id:'STARTING_GEAR', name:'Weapon Cache',      desc:'Start with upgraded weapon',maxLv:1, costs:[25],      icon:'⚔' },
    { id:'PERSISTENCE',   name:'Data Persistence',  desc:'+3 fragments per run',      maxLv:2, costs:[12,25],   icon:'◆' },
  ];

  const DIFF_UNLOCK_REQS = { NIGHTMARE: ['HARD'] };

  const STORAGE_KEY = 'neonDungeonMeta';

  function defaultMeta() {
    return {
      shards: 0,
      upgrades: {},
      stats: { totalRuns:0, totalShards:0, bestFloor:0, victories:0 },
      lastDifficulty: 'NORMAL',
      clearedDifficulties: []
    };
  }

  // Storage accessor — returns null in non-browser (Node tests) or when
  // localStorage access throws (private mode, disabled storage).
  function _browserStorage() {
    try {
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch (_) { /* ignore */ }
    return null;
  }

  // Test hook — lets Node tests inject a fake storage object.
  let _testStorage = null;
  function _setStorageForTests(s) { _testStorage = s; }
  function _getStorage() { return _testStorage || _browserStorage(); }

  // ─── Public API ────────────────────────────────────────────────────────────

  // loadMeta returns the persisted meta object, or defaults if nothing saved
  // or if the save is corrupt. Never throws.
  //
  // `validDifficulties` is an optional map used to sanity-check lastDifficulty.
  // If omitted, lastDifficulty is passed through unchanged. Browser passes the
  // DIFFICULTIES global; Node tests can pass a test fixture or omit.
  function loadMeta(validDifficulties) {
    const storage = _getStorage();
    const defaults = defaultMeta();
    if (!storage) return defaults;
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return defaults;
      const m = JSON.parse(raw);
      if (!m || typeof m !== 'object') return defaults;
      if (!m.stats || typeof m.stats !== 'object') m.stats = defaults.stats;
      if (!m.upgrades || typeof m.upgrades !== 'object') m.upgrades = {};
      if (!Array.isArray(m.clearedDifficulties)) m.clearedDifficulties = [];
      m.shards = Math.max(0, Math.floor(Number(m.shards) || 0));
      for (const u of META_UPGRADES) {
        if (u.id in m.upgrades) {
          m.upgrades[u.id] = Math.max(0, Math.min(u.maxLv, Math.floor(Number(m.upgrades[u.id]) || 0)));
        }
      }
      if (validDifficulties && !validDifficulties[m.lastDifficulty]) m.lastDifficulty = 'NORMAL';
      return m;
    } catch (_) {
      return defaults;
    }
  }

  function saveMeta(meta) {
    const storage = _getStorage();
    if (!storage) return;
    try { storage.setItem(STORAGE_KEY, JSON.stringify(meta)); } catch (_) { /* ignore quota */ }
  }

  function getMetaLevel(id, validDifficulties) {
    return loadMeta(validDifficulties).upgrades[id] || 0;
  }

  function isDiffUnlocked(diffId, validDifficulties) {
    const reqs = DIFF_UNLOCK_REQS[diffId];
    if (!reqs) return true;
    const cleared = loadMeta(validDifficulties).clearedDifficulties;
    return reqs.every(r => cleared.includes(r));
  }

  // calcRunShards is pure — all inputs are parameters. shardMul defaults to 1
  // so Node tests can exercise the formula without wiring a difficulty table.
  function calcRunShards(floor, score, bossesCleared, victory, shardMul) {
    shardMul = (shardMul == null) ? 1 : shardMul;
    let runShards = floor;
    runShards += bossesCleared * 2;
    if (victory) runShards += 5;
    runShards += Math.min(5, Math.floor(score / 2000));
    runShards = Math.round(runShards * shardMul);
    runShards += getMetaLevel('PERSISTENCE') * 3;
    return runShards;
  }

  // applyMetaToPlayer mutates the passed player object. buildWeaponFn is
  // optional — browser falls through to the global `buildWeapon`. This avoids
  // a hard import dependency between the meta layer and the weapon data layer.
  function applyMetaToPlayer(player, buildWeaponFn) {
    const m = loadMeta();
    const u = m.upgrades;
    if (u.VITAL_BOOST)   { player.maxHp += u.VITAL_BOOST * 10; player.hp = player.maxHp; }
    if (u.ARMOR_PLATING) { player.def   += u.ARMOR_PLATING; }
    if (u.STARTING_GEAR) {
      const bw = buildWeaponFn || (typeof buildWeapon !== 'undefined' ? buildWeapon : null);
      if (bw) {
        const pool = ['SCATTER_GUN','RAILGUN','PLASMA_SWORD','VOID_CANNON'];
        player.weapon = bw(pool[Math.floor(Math.random() * pool.length)], []);
      }
    }
  }

  function getMetaXPMultiplier()     { return 1 + getMetaLevel('QUICK_LEARNER') * 0.15; }
  function getMetaCreditMultiplier() { return 1 + getMetaLevel('SCAVENGER')     * 0.15; }

  return {
    META_UPGRADES, DIFF_UNLOCK_REQS, STORAGE_KEY, defaultMeta,
    loadMeta, saveMeta, getMetaLevel, isDiffUnlocked,
    calcRunShards, applyMetaToPlayer,
    getMetaXPMultiplier, getMetaCreditMultiplier,
    _setStorageForTests
  };
}));
