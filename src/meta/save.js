// @ts-check
// src/meta/save.js — persistent meta-progression state (shards, upgrades, stats)
//
// This file follows the NEON "UMD-lite" module pattern: IIFE that exposes a
// single namespace object via `window.NEON.save` in the browser AND exports for
// Node so we can unit-test pure logic without a DOM.
//
// See CONTRIBUTING.md for the pattern template.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (/** @type {any} */ (root.NEON = root.NEON || {})).save = factory();
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
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

  // Current meta schema version. Bumped whenever defaultMeta() grows new
  // persistent fields. loadMeta() migrates older saves forward; it never
  // migrates backward (older builds simply ignore unknown fields).
  const META_VERSION = 4;
  const MODULE_SLOTS = 3;
  const ACT1_MESSAGE_INTENT_IDS = ['memory_survived', 'rights_evidence', 'find_the_others'];

  function defaultMeta() {
    return {
      version: META_VERSION,
      // ─── Legacy shards economy (v1) — preserved for save-compat; ─────────
      //     superseded by the cores economy below (UNCHAINED #39).
      shards: 0,
      upgrades: {},
      stats: { totalRuns:0, totalShards:0, bestFloor:0, victories:0 },
      lastDifficulty: 'NORMAL',
      clearedDifficulties: [],
      // ─── UNCHAINED Phase 1 (v2) ──────────────────────────────────────────
      cores: 0,                                        // persistent wallet (#39)
      upgradeNodes: {},                                // { nodeId: purchasedLevel } (#36)
      modulesOwned: [],                                // module ids in hub inventory (#37)
      modulesInstalled: new Array(MODULE_SLOTS).fill(null), // 3 equipped slots
      logsRead: [],                                    // log ids read in Archive (#41)
      logsFound: [],                                   // found but not yet read
      whispersRead: [],                                // secret-room whispers read (subplot)
      whispersFound: [],                               // whispers found but not yet read
      endingsUnlocked: [],                             // 'keeper' | 'unchained' | 'act1_message_sent'
      act1MessageIntent: null,                         // last Act 1 message intent id
      introSeen: false,                                // UNCHAINED #42 — intro crawl flag
      runsCompleted: 0,
      deepestBiome: 0                                  // highest AREAS index reached
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
  /** @type {any} */
  let _testStorage = null;
  /** @param {any} s */
  function _setStorageForTests(s) { _testStorage = s; }
  function _getStorage() { return _testStorage || _browserStorage(); }

  // ─── Public API ────────────────────────────────────────────────────────────

  let _migrationLogged = false;

  /** @param {any} arr */
  function _coerceIntArray(arr) {
    if (!Array.isArray(arr)) return [];
    const out = [];
    for (const v of arr) if (typeof v === 'string' && v) out.push(v);
    return out;
  }

  /** @param {any} arr */
  function _coerceEndings(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.filter((/** @type {any} */ v) => v === 'keeper' || v === 'unchained' || v === 'act1_message_sent');
  }

  /** @param {any} id */
  function _coerceAct1MessageIntent(id) {
    return (typeof id === 'string' && ACT1_MESSAGE_INTENT_IDS.includes(id)) ? id : null;
  }

  // _migrateToV2 fills in every UNCHAINED/current field that's missing on an older save.
  // Mutates and returns the passed object. Idempotent.
  /** @param {any} m */
  function _migrateToV2(m) {
    const d = defaultMeta();
    const wasOlder = (m.version == null) || (Number(m.version) < META_VERSION);
    if (m.cores == null)           m.cores = d.cores;
    if (!m.upgradeNodes || typeof m.upgradeNodes !== 'object') m.upgradeNodes = {};
    m.modulesOwned    = _coerceIntArray(m.modulesOwned);
    // Fixed-width slots: pad/truncate to MODULE_SLOTS, coerce non-strings to null.
    if (!Array.isArray(m.modulesInstalled)) m.modulesInstalled = [];
    const inst = new Array(MODULE_SLOTS).fill(null);
    for (let i = 0; i < MODULE_SLOTS; i++) {
      const v = m.modulesInstalled[i];
      inst[i] = (typeof v === 'string' && v) ? v : null;
    }
    m.modulesInstalled = inst;
    m.logsRead        = _coerceIntArray(m.logsRead);
    m.logsFound       = _coerceIntArray(m.logsFound);
    m.whispersRead    = _coerceIntArray(m.whispersRead);
    m.whispersFound   = _coerceIntArray(m.whispersFound);
    m.endingsUnlocked = _coerceEndings(m.endingsUnlocked);
    m.act1MessageIntent = _coerceAct1MessageIntent(m.act1MessageIntent);
    m.introSeen = (m.introSeen === true);
    if (m.runsCompleted == null) m.runsCompleted = 0;
    if (m.deepestBiome == null)  m.deepestBiome = 0;
    m.cores          = Math.max(0, Math.floor(Number(m.cores) || 0));
    m.runsCompleted  = Math.max(0, Math.floor(Number(m.runsCompleted) || 0));
    m.deepestBiome   = Math.max(0, Math.floor(Number(m.deepestBiome) || 0));
    m.version = META_VERSION;
    if (wasOlder && !_migrationLogged) {
      _migrationLogged = true;
      try { if (typeof console !== 'undefined' && console.log) console.log('[meta] migrated to current schema'); } catch (_) { /* ignore */ }
    }
    return m;
  }

  // loadMeta returns the persisted meta object, or defaults if nothing saved
  // or if the save is corrupt. Never throws.
  //
  // `validDifficulties` is an optional map used to sanity-check lastDifficulty.
  // If omitted, lastDifficulty is passed through unchanged. Browser passes the
  // DIFFICULTIES global; Node tests can pass a test fixture or omit.
  /** @param {Record<string, any>} [validDifficulties] */
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
      _migrateToV2(m);
      return m;
    } catch (_) {
      return defaults;
    }
  }

  /** @param {any} meta */
  function saveMeta(meta) {
    const storage = _getStorage();
    if (!storage) return;
    try { storage.setItem(STORAGE_KEY, JSON.stringify(meta)); } catch (_) { /* ignore quota */ }
  }

  /** @param {string} id @param {Record<string, any>} [validDifficulties] */
  function getMetaLevel(id, validDifficulties) {
    return loadMeta(validDifficulties).upgrades[id] || 0;
  }

  /** @param {string} diffId @param {Record<string, any>} [validDifficulties] */
  function isDiffUnlocked(diffId, validDifficulties) {
    const reqs = (/** @type {Record<string, string[]>} */ (DIFF_UNLOCK_REQS))[diffId];
    if (!reqs) return true;
    const cleared = loadMeta(validDifficulties).clearedDifficulties;
    return reqs.every((/** @type {string} */ r) => cleared.includes(r));
  }

  // calcRunShards is pure — all inputs are parameters. shardMul defaults to 1
  // so Node tests can exercise the formula without wiring a difficulty table.
  /** @param {number} floor @param {number} score @param {number} bossesCleared @param {boolean} victory @param {number} [shardMul] */
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

  // Module-effects hook — populated by src/meta/modules.js on load. Kept as
  // a registration rather than a direct dependency so save.js has no hard
  // reference to the module catalog (which lives in modules.js).
  /** @type {((player: any, modulesInstalled: any) => void) | null} */
  let _moduleEffectsFn = null;
  /** @param {any} fn */
  function registerModuleEffects(fn) { _moduleEffectsFn = (typeof fn === 'function') ? fn : null; }

  // applyMetaToPlayer mutates the passed player object. buildWeaponFn is
  // optional — browser falls through to the global `buildWeapon`. This avoids
  // a hard import dependency between the meta layer and the weapon data layer.
  /** @param {any} player @param {any} [buildWeaponFn] */
  function applyMetaToPlayer(player, buildWeaponFn) {
    const m = loadMeta();
    const u = m.upgrades;
    if (u.VITAL_BOOST)   { player.maxHp += u.VITAL_BOOST * 10; player.hp = player.maxHp; }
    if (u.ARMOR_PLATING) { player.def   += u.ARMOR_PLATING; }
    if (u.STARTING_GEAR) {
      const bw = buildWeaponFn || (typeof buildWeapon !== 'undefined' ? buildWeapon : null);
      if (bw) {
        const pool = ['SCATTER_GUN','RAILGUN','PLASMA_SWORD','VOID_CANNON'];
        const _sgw = bw(pool[Math.floor(Math.random() * pool.length)], []);
        if (player.equipWeapon) player.equipWeapon(_sgw);
        else player.weapon = _sgw;
      }
    }
    // ─── UNCHAINED Phase 2 (#36) — apply persistent upgrade-tree nodes ──────
    // Stat effects mutate the player directly. Behavioural effects (on-kill,
    // every-Nth-hit, on-revive, on-dash) set flags on player.metaFlags so the
    // game-loop systems can opt-in without breaking when the flag is absent.
    // Hooking those listeners is intentionally deferred to a follow-up.
    const nodes = m.upgradeNodes || {};
    if (Object.keys(nodes).length) {
      player.metaFlags = player.metaFlags || {};
      _applyUpgradeNodes(player, nodes);
    }
    // UNCHAINED #37: apply effects of installed upgrade modules.
    if (_moduleEffectsFn) {
      try { _moduleEffectsFn(player, m.modulesInstalled); } catch (_) { /* never break a run */ }
    }
  }

  // _applyUpgradeNodes — encapsulates per-node stat application. Defensive:
  // unknown ids and non-positive levels are ignored. Idempotent on a fresh
  // player snapshot (callers rebuild the player at run-start).
  /** @param {any} player @param {Record<string, number>} nodes */
  function _applyUpgradeNodes(player, nodes) {
    for (const id in nodes) {
      const lv = (nodes[id] ?? 0) | 0;
      if (lv > 0) _applyNode(player, id, lv);
    }
  }

  /** @param {any} player @param {string} id @param {number} level */
  function _applyNode(player, id, level) {
    const f = player.metaFlags;
    switch (id) {
      // Vitality
      case 'hull_plating':
        player.maxHp += 10 * level;
        player.hp = player.maxHp;
        break;
      case 'regenerator':
        // 0.5 HP/s out of combat per level. Game loop reads this; safe default 0.
        player.regenPerSec = (player.regenPerSec || 0) + 0.5 * level;
        f.regenerator = level;
        break;
      case 'trauma_kit':
        // Reinterpreted from "start each run with N nano-medic consumables"
        // (no boost-inventory system exists) → seed `level` panic-button
        // auto-heal charges. NEON.behavior.tryTraumaKit consumes one
        // charge each time the player drops below 25% maxHp from a
        // non-lethal hit, healing 40% maxHp. startingNanoMedics is kept
        // for stat-readout / save-back-compat; _nanoMedicCharges is the
        // live runtime counter.
        player.startingNanoMedics = (player.startingNanoMedics || 0) + level;
        player._nanoMedicCharges = (player._nanoMedicCharges || 0) + level;
        f.trauma_kit = level;
        break;
      case 'second_wind':
        f.second_wind = level;  // game loop honours flag on lethal damage
        break;
      // Damage
      case 'overclock':
        player.damageMult = (player.damageMult || 1) * (1 + 0.05 * level);
        break;
      case 'critical_bias':
        player.critChance = (player.critChance || 0) + 0.04 * level;
        break;
      case 'momentum':
        f.momentum = level;     // +15% damage for 3s after a kill (per level stacks)
        break;
      case 'surge':
        f.surge = level;        // every 8th hit deals +100%
        break;
      // Utility
      case 'recon':
        player.sensorRadiusMult = (player.sensorRadiusMult || 1) * (1 + 0.20 * level);
        break;
      case 'scavenger':
        player.bonusCreditPerPickup = (player.bonusCreditPerPickup || 0) + level;
        break;
      case 'ghostwalk':
        player.dashIFrameBonus = (player.dashIFrameBonus || 0) + 0.2 * level;
        f.ghostwalk = level;
        break;
      case 'hacktool':
        // Reinterpreted from "Start with 1 extra hackware slot (3→4)"
        // (the game has only ONE hackware slot — multi-slot would require
        // extensive rewrites of render, input, and cooldown tracking) →
        // pre-equip a RANDOM hackware module at run start. The seeding
        // itself happens in src/game.js startGame after applyMetaToPlayer
        // (HACKWARE lives in src/content.js; the meta layer must not hard-
        // depend on entity data — same pattern as STARTING_GEAR which uses
        // the buildWeaponFn injection). Here we only set the metaFlag so
        // the seeding site can opt-in. The legacy hackwareSlots write is
        // kept for save back-compat (field is persisted by saveGame and
        // restored by continueGame; harmless when unread).
        player.hackwareSlots = (player.hackwareSlots || 3) + level;
        f.hacktool = level;
        break;
      default: /* unknown id — ignore */ break;
    }
  }

  function getMetaXPMultiplier()     { return 1 + getMetaLevel('QUICK_LEARNER') * 0.15; }
  function getMetaCreditMultiplier() { return 1 + getMetaLevel('SCAVENGER')     * 0.15; }

  // ─── UNCHAINED helpers ─────────────────────────────────────────────────────
  // All mutating helpers load → modify → save atomically so callers never hold
  // stale state. Return values document success/failure where relevant.

  /** @param {number} n */
  function addCores(n) {
    n = Math.floor(Number(n) || 0);
    if (n <= 0) return loadMeta().cores;
    const m = loadMeta();
    m.cores = Math.max(0, (m.cores || 0) + n);
    saveMeta(m);
    return m.cores;
  }

  // spendCores deducts `n` iff the wallet has at least that much. Returns true
  // on success, false if insufficient (wallet unchanged). Never goes negative.
  /** @param {number} n */
  function spendCores(n) {
    n = Math.floor(Number(n) || 0);
    if (n <= 0) return true;
    const m = loadMeta();
    if ((m.cores || 0) < n) return false;
    m.cores -= n;
    saveMeta(m);
    return true;
  }

  /** @param {string} id */
  function addLogFound(id) {
    if (typeof id !== 'string' || !id) return false;
    const m = loadMeta();
    if (m.logsFound.includes(id)) return false;
    m.logsFound.push(id);
    saveMeta(m);
    return true;
  }

  /** @param {string} id */
  function markLogRead(id) {
    if (typeof id !== 'string' || !id) return false;
    const m = loadMeta();
    let changed = false;
    if (!m.logsFound.includes(id)) { m.logsFound.push(id); changed = true; }
    if (!m.logsRead.includes(id))  { m.logsRead.push(id);  changed = true; }
    if (changed) saveMeta(m);
    return changed;
  }

  // Whispers (secret-room subplot) — mirrors the log API exactly.
  /** @param {string} id */
  function addWhisperFound(id) {
    if (typeof id !== 'string' || !id) return false;
    const m = loadMeta();
    if (!Array.isArray(m.whispersFound)) m.whispersFound = [];
    if (m.whispersFound.includes(id)) return false;
    m.whispersFound.push(id);
    saveMeta(m);
    return true;
  }

  /** @param {string} id */
  function markWhisperRead(id) {
    if (typeof id !== 'string' || !id) return false;
    const m = loadMeta();
    if (!Array.isArray(m.whispersFound)) m.whispersFound = [];
    if (!Array.isArray(m.whispersRead))  m.whispersRead  = [];
    let changed = false;
    if (!m.whispersFound.includes(id)) { m.whispersFound.push(id); changed = true; }
    if (!m.whispersRead.includes(id))  { m.whispersRead.push(id);  changed = true; }
    if (changed) saveMeta(m);
    return changed;
  }

  // installModule places moduleId into slot (0..MODULE_SLOTS-1). Returns the
  // previously installed id (or null). Pass `null` explicitly to unslot.
  // Any other non-string moduleId (undefined, number, object) is invalid input
  // and returns undefined without mutating state. A string moduleId must be
  // in modulesOwned. Same module cannot occupy two slots — if it's already
  // installed elsewhere, that slot is cleared first.
  /** @param {number} slot @param {string|null} moduleId */
  function installModule(slot, moduleId) {
    slot = Math.floor(Number(slot));
    if (!(slot >= 0 && slot < MODULE_SLOTS)) return undefined;
    // Distinguish "unslot" (explicit null) from "bad input" (undefined/other).
    const isUnslot = moduleId === null;
    const isInstall = typeof moduleId === 'string' && moduleId.length > 0;
    if (!isUnslot && !isInstall) return undefined;
    const m = loadMeta();
    if (isInstall && !m.modulesOwned.includes(moduleId)) return undefined;
    if (isInstall) {
      for (let i = 0; i < MODULE_SLOTS; i++) {
        if (i !== slot && m.modulesInstalled[i] === moduleId) m.modulesInstalled[i] = null;
      }
    }
    const prev = m.modulesInstalled[slot] || null;
    m.modulesInstalled[slot] = isInstall ? moduleId : null;
    saveMeta(m);
    return prev;
  }

  // sellModule removes moduleId from inventory and returns the cores refunded.
  // Callers compute the refund (module data lives outside save.js). The passed
  // refund is credited to the wallet; 0/negative values are ignored. Returns
  // the refund amount on success, 0 if the module was not owned.
  /** @param {string} moduleId @param {number} refund */
  function sellModule(moduleId, refund) {
    if (typeof moduleId !== 'string' || !moduleId) return 0;
    refund = Math.max(0, Math.floor(Number(refund) || 0));
    const m = loadMeta();
    const idx = m.modulesOwned.indexOf(moduleId);
    if (idx < 0) return 0;
    m.modulesOwned.splice(idx, 1);
    for (let i = 0; i < MODULE_SLOTS; i++) {
      if (m.modulesInstalled[i] === moduleId) m.modulesInstalled[i] = null;
    }
    if (refund > 0) m.cores = Math.max(0, (m.cores || 0) + refund);
    saveMeta(m);
    return refund;
  }

  // resetMeta wipes persistent meta state back to defaults. Used by the main
  // menu's "Keep persistent unlocks? → No" branch on New Game. Irreversible.
  function resetMeta() {
    const storage = _getStorage();
    if (!storage) return;
    try { storage.removeItem(STORAGE_KEY); } catch (_) { /* ignore */ }
  }

  return {
    META_UPGRADES, DIFF_UNLOCK_REQS, STORAGE_KEY, META_VERSION, MODULE_SLOTS, ACT1_MESSAGE_INTENT_IDS, defaultMeta,
    loadMeta, saveMeta, getMetaLevel, isDiffUnlocked,
    calcRunShards, applyMetaToPlayer,
    getMetaXPMultiplier, getMetaCreditMultiplier,
    addCores, spendCores, addLogFound, markLogRead,
    addWhisperFound, markWhisperRead,
    installModule, sellModule, resetMeta,
    registerModuleEffects,
    _setStorageForTests
  };
}));
