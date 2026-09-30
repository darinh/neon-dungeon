// @ts-check
'use strict';

// Loaded before entities.js so spawnEnemy can share these type predicates.

const BOSS_TYPES = new Set([
  'SENTINEL',
  'WARDEN',
  'HIVE',
  'CONDUCTOR',
  'OMEGA',
  'GENESIS',
]);

const ELITE_EXCLUDED_TYPES = new Set([
  'SNIPER',
  'SUMMONER',
  'HEALER',
  'MIMIC',
  'SIPHON',
  'SEEKER',
  'PULSER',
  'TUNNELLER',
  'ECHOER',
  'RESONATOR',
  'MIRROR',
  'REAPER',
  'GHOST_PROJECTOR',
  'PROPHET',
  'CRYOPHAGE',
  'WARDLING',
  'VENGEANCE',
  'CONDUIT',
  'HARVESTER',
  'MAGNETON',
  'SPECTRE',
  'SAPPER',
  'MAGPIE',
  'TETHER',
  'VAULTMASTER',
  'GULPER',
  'WATCHER',
  'ARCHITECT',
  'NULLIFIER',
]);

const GHOSTABLE_TYPES = new Set([
  'GUARD', 'CRAWLER', 'DRONE', 'BRUTE', 'PHANTOM',
  'CHARGER', 'LEAPER', 'SCORCHER', 'SEEKER', 'REAPER'
]);

/**
 * @param {string} type
 * @returns {boolean}
 */
function isBossEnemyType(type) {
  return BOSS_TYPES.has(type);
}

/**
 * @param {string} type
 * @returns {boolean}
 */
function canRollEliteEnemyType(type) {
  return !isBossEnemyType(type) && !ELITE_EXCLUDED_TYPES.has(type);
}

/**
 * @param {string} type
 * @returns {boolean}
 */
function isGhostableEnemyType(type) {
  return GHOSTABLE_TYPES.has(type);
}
