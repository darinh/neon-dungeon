'use strict';
// @ts-check

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const CORE_RUNTIME_SOURCE_KEYS = Object.freeze([
  'content',
  'entitiesSpawnModifiers',
  'entitiesEnemyAwareness',
  'entitiesEnemyAbilityTuning',
  'entitiesPlayerPerkTuning',
  'entitiesRuntimeGlobals',
  'entitiesRuntimeCollections',
  'entitiesPlayerCheats',
  'entities',
  'entitiesEnemyTargeting',
  'entitiesEnemyProjectileDefense',
  'entitiesEnemyConduit',
  'entitiesEnemyWardling',
  'entitiesEnemyHealer',
  'entitiesEnemyGrenadier',
  'entitiesEnemyMimic',
  'entitiesEnemyNexus',
  'entitiesEnemyPhantom',
  'entitiesEnemyWraith',
  'entitiesEnemyTempo',
  'entitiesEnemyProjectiles',
  'entitiesEnemyMovement',
  'entitiesSpawnInitializers',
  'entitiesEnemySpawning',
  'entitiesCombatEffects',
  'entitiesDeferredSpawns',
  'entitiesEnemySummoner',
  'entitiesShockPulse',
  'entitiesPlayerBombs',
  'entitiesPlayerKinematics',
  'entitiesPlayerWeapons',
  'entitiesPlayerDamage',
  'entitiesPlayerSurge',
  'render',
  'game',
]);

const SOURCE_FILE_PATHS = Object.freeze({
  platform: path.join('src', 'platform.js'),
  contentTerminals: path.join('src', 'content', 'terminals.js'),
  contentWeapons: path.join('src', 'content', 'weapons.js'),
  contentUpgrades: path.join('src', 'content', 'upgrades.js'),
  contentPickups: path.join('src', 'content', 'pickups.js'),
  contentProjectiles: path.join('src', 'content', 'projectiles.js'),
  contentMusic: path.join('src', 'content', 'music.js'),
  contentModifiers: path.join('src', 'content', 'modifiers.js'),
  contentMetaSave: path.join('src', 'content', 'meta-save.js'),
  contentCombo: path.join('src', 'content', 'combo.js'),
  contentEvents: path.join('src', 'content', 'events.js'),
  contentShop: path.join('src', 'content', 'shop.js'),
  contentPerks: path.join('src', 'content', 'perks.js'),
  contentEffects: path.join('src', 'content', 'effects.js'),
  contentHackware: path.join('src', 'content', 'hackware.js'),
  contentStatus: path.join('src', 'content', 'status.js'),
  contentLighting: path.join('src', 'content', 'lighting.js'),
  contentFloorGenerator: path.join('src', 'content', 'floor-generator.js'),
  content: path.join('src', 'content.js'),
  entitiesSourceMetadata: path.join('src', 'entities', 'source-metadata.js'),
  entitiesSpawnTable: path.join('src', 'entities', 'spawn-table.js'),
  entitiesEnemyStats: path.join('src', 'entities', 'enemy-stats.js'),
  entitiesEnemyClassification: path.join('src', 'entities', 'enemy-classification.js'),
  entitiesSpawnModifiers: path.join('src', 'entities', 'spawn-modifiers.js'),
  entitiesEnemyAwareness: path.join('src', 'entities', 'enemy-awareness.js'),
  entitiesEnemyAbilityTuning: path.join('src', 'entities', 'enemy-ability-tuning.js'),
  entitiesPlayerPerkTuning: path.join('src', 'entities', 'player-perk-tuning.js'),
  entitiesRuntimeGlobals: path.join('src', 'entities', 'runtime-globals.js'),
  entitiesRuntimeCollections: path.join('src', 'entities', 'runtime-collections.js'),
  entitiesPlayerCheats: path.join('src', 'entities', 'player-cheats.js'),
  entitiesRoomIndex: path.join('src', 'entities', 'room-index.js'),
  entities: path.join('src', 'entities.js'),
  entitiesEnemyTargeting: path.join('src', 'entities', 'enemy-targeting.js'),
  entitiesEnemyProjectileDefense: path.join('src', 'entities', 'enemy-projectile-defense.js'),
  entitiesEnemyConduit: path.join('src', 'entities', 'enemy-conduit.js'),
  entitiesEnemyWardling: path.join('src', 'entities', 'enemy-wardling.js'),
  entitiesEnemyHealer: path.join('src', 'entities', 'enemy-healer.js'),
  entitiesEnemyGrenadier: path.join('src', 'entities', 'enemy-grenadier.js'),
  entitiesEnemyMimic: path.join('src', 'entities', 'enemy-mimic.js'),
  entitiesEnemyNexus: path.join('src', 'entities', 'enemy-nexus.js'),
  entitiesEnemyPhantom: path.join('src', 'entities', 'enemy-phantom.js'),
  entitiesEnemyWraith: path.join('src', 'entities', 'enemy-wraith.js'),
  entitiesEnemySummoner: path.join('src', 'entities', 'enemy-summoner.js'),
  entitiesEnemyTempo: path.join('src', 'entities', 'enemy-tempo.js'),
  entitiesEnemyProjectiles: path.join('src', 'entities', 'enemy-projectiles.js'),
  entitiesEnemyMovement: path.join('src', 'entities', 'enemy-movement.js'),
  entitiesSpawnInitializers: path.join('src', 'entities', 'spawn-initializers.js'),
  entitiesEnemySpawning: path.join('src', 'entities', 'enemy-spawning.js'),
  entitiesEliteAffixes: path.join('src', 'entities', 'elite-affixes.js'),
  entitiesStatusEffects: path.join('src', 'entities', 'status-effects.js'),
  entitiesAiHelpers: path.join('src', 'entities', 'ai-helpers.js'),
  entitiesPlayerKinematics: path.join('src', 'entities', 'player-kinematics.js'),
  entitiesPlayerWeapons: path.join('src', 'entities', 'player-weapons.js'),
  entitiesPlayerDamage: path.join('src', 'entities', 'player-damage.js'),
  entitiesPlayerSurge: path.join('src', 'entities', 'player-surge.js'),
  entitiesArchitectWalls: path.join('src', 'entities', 'architect-walls.js'),
  entitiesBeacons: path.join('src', 'entities', 'beacons.js'),
  entitiesCrates: path.join('src', 'entities', 'crates.js'),
  entitiesMines: path.join('src', 'entities', 'mines.js'),
  entitiesShieldGenerators: path.join('src', 'entities', 'shield-generators.js'),
  entitiesWallFacing: path.join('src', 'entities', 'wall-facing.js'),
  entitiesSecuritySystems: path.join('src', 'entities', 'security-systems.js'),
  entitiesWallTurrets: path.join('src', 'entities', 'wall-turrets.js'),
  entitiesFieldEffects: path.join('src', 'entities', 'field-effects.js'),
  entitiesDeathHooks: path.join('src', 'entities', 'death-hooks.js'),
  entitiesFuseShards: path.join('src', 'entities', 'fuse-shards.js'),
  entitiesPlayerBombs: path.join('src', 'entities', 'player-bombs.js'),
  entitiesRenderPasses: path.join('src', 'entities', 'render-passes.js'),
  entitiesVolatileCores: path.join('src', 'entities', 'volatile-cores.js'),
  entitiesCombatEffects: path.join('src', 'entities', 'combat-effects.js'),
  entitiesDeferredSpawns: path.join('src', 'entities', 'deferred-spawns.js'),
  entitiesShockPulse: path.join('src', 'entities', 'shock-pulse.js'),
  render: path.join('src', 'render.js'),
  game: path.join('src', 'game.js'),
});

/**
 * @param {string} key
 * @returns {key is keyof SOURCE_FILE_PATHS}
 */
function isSourceFileKey(key) {
  return Object.prototype.hasOwnProperty.call(SOURCE_FILE_PATHS, key);
}

/**
 * Resolve a source file path relative to the repository root. Tests pass
 * `__dirname` so the helper keeps the script-tag source inventory in one place.
 *
 * @param {string} testsDir
 * @param {keyof SOURCE_FILE_PATHS} key
 * @returns {string}
 */
function resolveSourceFile(testsDir, key) {
  if (!isSourceFileKey(key)) {
    throw new Error(`Unknown source file key: ${String(key)}`);
  }
  return path.resolve(testsDir, '..', SOURCE_FILE_PATHS[key]);
}

/**
 * @param {string} testsDir
 * @param {keyof SOURCE_FILE_PATHS} key
 * @returns {string}
 */
function readSourceFile(testsDir, key) {
  return fs.readFileSync(resolveSourceFile(testsDir, key), 'utf8');
}

/**
 * @param {string} testsDir
 * @param {readonly (keyof SOURCE_FILE_PATHS)[]} [keys]
 * @returns {Record<string, string>}
 */
function readSourceFiles(testsDir, keys = CORE_RUNTIME_SOURCE_KEYS) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const key of keys) out[key] = readSourceFile(testsDir, key);
  return out;
}

/**
 * Strip JavaScript comments while preserving strings, template literals, regex
 * literals, and source line breaks.
 *
 * @param {string} src
 * @returns {string}
 */
function stripJsComments(src) {
  const sourceFile = ts.createSourceFile('source.js', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const ranges = collectCommentRanges(src, sourceFile);
  if (ranges.length === 0) return src;

  let out = '';
  let cursor = 0;
  for (const range of ranges) {
    if (range.pos < cursor) continue;
    out += src.slice(cursor, range.pos);
    out += src.slice(range.pos, range.end).replace(/[^\r\n]/g, '');
    cursor = range.end;
  }
  return out + src.slice(cursor);
}

/**
 * @param {string} src
 * @param {import('typescript').SourceFile} sourceFile
 * @returns {import('typescript').CommentRange[]}
 */
function collectCommentRanges(src, sourceFile) {
  /** @type {Map<string, import('typescript').CommentRange>} */
  const ranges = new Map();

  /**
   * @param {number} pos
   */
  function addRangesAt(pos) {
    for (const range of ts.getLeadingCommentRanges(src, pos) || []) {
      ranges.set(`${range.pos}:${range.end}`, range);
    }
    for (const range of ts.getTrailingCommentRanges(src, pos) || []) {
      ranges.set(`${range.pos}:${range.end}`, range);
    }
  }

  /**
   * @param {import('typescript').Node} node
   */
  function visit(node) {
    addRangesAt(node.pos);
    addRangesAt(node.end);
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  addRangesAt(src.length);
  return Array.from(ranges.values()).sort((a, b) => a.pos - b.pos);
}

/**
 * Replace string-literal contents with same-length spaces, preserving quote
 * characters and total string length.
 *
 * @param {string} src
 * @returns {string}
 */
function blankStringContents(src) {
  return src.replace(/('(?:\\.|[^'\\])*')|("(?:\\.|[^"\\])*")|(`(?:\\.|[^`\\])*`)/g,
    (m) => m[0] + ' '.repeat(m.length - 2) + m[m.length - 1]);
}

module.exports = {
  CORE_RUNTIME_SOURCE_KEYS,
  SOURCE_FILE_PATHS,
  blankStringContents,
  readSourceFile,
  readSourceFiles,
  resolveSourceFile,
  stripJsComments,
};
