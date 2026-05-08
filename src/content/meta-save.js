// @ts-check
'use strict';

// Meta-progression compatibility wrappers. Loaded before src/content.js so
// gameplay callers keep the legacy global names while persistence stays owned
// by src/meta/save.js.

const _save = /** @type {any} */ (requireNEON('save', 'src/content/meta-save.js'));
const META_UPGRADES = _save.META_UPGRADES;
const DIFF_UNLOCK_REQS = _save.DIFF_UNLOCK_REQS;

function loadMeta() { return NEON.save.loadMeta(DIFFICULTIES); }
/**
 * @param {any} meta
 */
function saveMeta(meta) { return NEON.save.saveMeta(meta); }
/**
 * @param {any} id
 */
function getMetaLevel(id) { return NEON.save.getMetaLevel(id, DIFFICULTIES); }
/**
 * @param {any} diffId
 */
function isDiffUnlocked(diffId) { return NEON.save.isDiffUnlocked(diffId, DIFFICULTIES); }
/**
 * @param {any} floor
 * @param {any} score
 * @param {any} bc
 * @param {any} vic
 */
function calcRunShards(floor, score, bc, vic) { return NEON.save.calcRunShards(floor, score, bc, vic, getDiff().shardMul); }
/**
 * @param {any} player
 */
function applyMetaToPlayer(player) { return NEON.save.applyMetaToPlayer(player, buildWeapon, () => rand('loot')); }
function getMetaXPMultiplier() { return NEON.save.getMetaXPMultiplier(); }
function getMetaCreditMultiplier() { return NEON.save.getMetaCreditMultiplier(); }
function resetMeta() { return NEON.save.resetMeta(); }
/**
 * @param {any} n
 */
function addCores(n) { return NEON.save.addCores(n); }
/**
 * @param {any} n
 */
function spendCores(n) { return NEON.save.spendCores(n); }
/**
 * @param {any} id
 */
function addLogFound(id) { return NEON.save.addLogFound(id); }
/**
 * @param {any} id
 */
function markLogRead(id) { return NEON.save.markLogRead(id); }
/**
 * @param {any} slot
 * @param {any} moduleId
 */
function installModule(slot, moduleId) { return NEON.save.installModule(slot, moduleId); }
/**
 * @param {any} moduleId
 * @param {any} refund
 */
function sellModule(moduleId, refund) { return NEON.save.sellModule(moduleId, refund); }
