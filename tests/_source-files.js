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
  'entitiesEnemyShielder',
  'entitiesEnemyReflector',
  'entitiesEnemyDisruptor',
  'entitiesEnemyConduit',
  'entitiesEnemyWardling',
  'entitiesEnemyVengeance',
  'entitiesEnemyResonator',
  'entitiesEnemyWatcher',
  'entitiesEnemyArchitect',
  'entitiesEnemyMirror',
  'entitiesEnemyReaper',
  'entitiesEnemyGhostProjector',
  'entitiesEnemyHealer',
  'entitiesEnemyGrenadier',
  'entitiesEnemyTeleporter',
  'entitiesEnemySniper',
  'entitiesEnemyCharger',
  'entitiesEnemyMimic',
  'entitiesEnemyNexus',
  'entitiesEnemySiphon',
  'entitiesEnemyGraviton',
  'entitiesBossAi',
  'entitiesEnemyPhantom',
  'entitiesEnemyWraith',
  'entitiesEnemyTunneller',
  'entitiesEnemyTempo',
  'entitiesEnemyProjectiles',
  'entitiesEnemyMovement',
  'entitiesEnemyPulser',
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
  'entitiesPlayerProgression',
  'entitiesPlayerSurge',
  'entitiesEnemyLeaper',
  'entitiesEnemyMagneton',
  'entitiesEnemySpectre',
  'entitiesEnemyBasicAi',
  'entitiesEnemyHarvester',
  'entitiesEnemyTether',
  'entitiesEnemyVaultmaster',
  'entitiesEnemyNullifier',
  'entitiesEnemySapper',
  'entitiesEnemyMagpie',
  'entitiesEnemyGulper',
  'entitiesEnemySeeker',
  'entitiesEnemyEchoer',
  'entitiesEnemyProphet',
  'entitiesEnemyCryophage',
  'entitiesEnemyScorcher',
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
  entitiesEnemyShielder: path.join('src', 'entities', 'enemy-shielder.js'),
  entitiesEnemyReflector: path.join('src', 'entities', 'enemy-reflector.js'),
  entitiesEnemyDisruptor: path.join('src', 'entities', 'enemy-disruptor.js'),
  entitiesEnemyConduit: path.join('src', 'entities', 'enemy-conduit.js'),
  entitiesEnemyWardling: path.join('src', 'entities', 'enemy-wardling.js'),
  entitiesEnemyVengeance: path.join('src', 'entities', 'enemy-vengeance.js'),
  entitiesEnemyResonator: path.join('src', 'entities', 'enemy-resonator.js'),
  entitiesEnemyWatcher: path.join('src', 'entities', 'enemy-watcher.js'),
  entitiesEnemyArchitect: path.join('src', 'entities', 'enemy-architect.js'),
  entitiesEnemyMirror: path.join('src', 'entities', 'enemy-mirror.js'),
  entitiesEnemyReaper: path.join('src', 'entities', 'enemy-reaper.js'),
  entitiesEnemyGhostProjector: path.join('src', 'entities', 'enemy-ghost-projector.js'),
  entitiesEnemyHealer: path.join('src', 'entities', 'enemy-healer.js'),
  entitiesEnemyGrenadier: path.join('src', 'entities', 'enemy-grenadier.js'),
  entitiesEnemyTeleporter: path.join('src', 'entities', 'enemy-teleporter.js'),
  entitiesEnemySniper: path.join('src', 'entities', 'enemy-sniper.js'),
  entitiesEnemyCharger: path.join('src', 'entities', 'enemy-charger.js'),
  entitiesEnemyLeaper: path.join('src', 'entities', 'enemy-leaper.js'),
  entitiesEnemyMimic: path.join('src', 'entities', 'enemy-mimic.js'),
  entitiesEnemyNexus: path.join('src', 'entities', 'enemy-nexus.js'),
  entitiesEnemySiphon: path.join('src', 'entities', 'enemy-siphon.js'),
  entitiesEnemyGraviton: path.join('src', 'entities', 'enemy-graviton.js'),
  entitiesBossAi: path.join('src', 'entities', 'boss-ai.js'),
  entitiesEnemyPhantom: path.join('src', 'entities', 'enemy-phantom.js'),
  entitiesEnemyWraith: path.join('src', 'entities', 'enemy-wraith.js'),
  entitiesEnemyTunneller: path.join('src', 'entities', 'enemy-tunneller.js'),
  entitiesEnemySummoner: path.join('src', 'entities', 'enemy-summoner.js'),
  entitiesEnemyTempo: path.join('src', 'entities', 'enemy-tempo.js'),
  entitiesEnemyProjectiles: path.join('src', 'entities', 'enemy-projectiles.js'),
  entitiesEnemyMovement: path.join('src', 'entities', 'enemy-movement.js'),
  entitiesEnemyPulser: path.join('src', 'entities', 'enemy-pulser.js'),
  entitiesSpawnInitializers: path.join('src', 'entities', 'spawn-initializers.js'),
  entitiesEnemySpawning: path.join('src', 'entities', 'enemy-spawning.js'),
  entitiesEliteAffixes: path.join('src', 'entities', 'elite-affixes.js'),
  entitiesStatusEffects: path.join('src', 'entities', 'status-effects.js'),
  entitiesAiHelpers: path.join('src', 'entities', 'ai-helpers.js'),
  entitiesPlayerKinematics: path.join('src', 'entities', 'player-kinematics.js'),
  entitiesPlayerWeapons: path.join('src', 'entities', 'player-weapons.js'),
  entitiesPlayerDamage: path.join('src', 'entities', 'player-damage.js'),
  entitiesPlayerProgression: path.join('src', 'entities', 'player-progression.js'),
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
  entitiesEnemyMagneton: path.join('src', 'entities', 'enemy-magneton.js'),
  entitiesEnemySpectre: path.join('src', 'entities', 'enemy-spectre.js'),
  entitiesEnemyBasicAi: path.join('src', 'entities', 'enemy-basic-ai.js'),
  entitiesEnemyHarvester: path.join('src', 'entities', 'enemy-harvester.js'),
  entitiesEnemyTether: path.join('src', 'entities', 'enemy-tether.js'),
  entitiesEnemyVaultmaster: path.join('src', 'entities', 'enemy-vaultmaster.js'),
  entitiesEnemyNullifier: path.join('src', 'entities', 'enemy-nullifier.js'),
  entitiesEnemySapper: path.join('src', 'entities', 'enemy-sapper.js'),
  entitiesEnemyMagpie: path.join('src', 'entities', 'enemy-magpie.js'),
  entitiesEnemyGulper: path.join('src', 'entities', 'enemy-gulper.js'),
  entitiesEnemySeeker: path.join('src', 'entities', 'enemy-seeker.js'),
  entitiesEnemyEchoer: path.join('src', 'entities', 'enemy-echoer.js'),
  entitiesEnemyProphet: path.join('src', 'entities', 'enemy-prophet.js'),
  entitiesEnemyCryophage: path.join('src', 'entities', 'enemy-cryophage.js'),
  entitiesEnemyScorcher: path.join('src', 'entities', 'enemy-scorcher.js'),
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

/**
 * @param {string} src
 * @param {string} [fileName]
 * @returns {import('typescript').SourceFile}
 */
function parseJsSource(src, fileName = 'source.js') {
  return ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
}

/**
 * Declaration text, excluding leading comments. Callers that eval or match
 * this text must not depend on banner comments.
 * @param {import('typescript').SourceFile} sourceFile
 * @param {import('typescript').Node} node
 * @returns {string}
 */
function nodeText(sourceFile, node) {
  return sourceFile.text.slice(node.getStart(sourceFile), node.end);
}

/**
 * @param {import('typescript').Node | undefined} node
 * @returns {string | undefined}
 */
function identifierText(node) {
  return node && ts.isIdentifier(node) ? node.text : undefined;
}

/**
 * @param {import('typescript').Statement} statement
 * @returns {string[]}
 */
function statementNames(statement) {
  /** @type {string[]} */
  const names = [];
  if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) {
    const name = identifierText(statement.name);
    if (name) names.push(name);
  }
  if (ts.isVariableStatement(statement)) {
    for (const decl of statement.declarationList.declarations) {
      const name = identifierText(decl.name);
      if (name) names.push(name);
    }
  }
  return names;
}

/**
 * @param {string} label
 * @returns {never}
 */
function missing(label) {
  throw new Error(label);
}

/**
 * Top-level function, class, or variable declaration, without leading comments.
 * @param {string} src
 * @param {string} name
 * @returns {string}
 */
function extractDeclaration(src, name) {
  const sourceFile = parseJsSource(src);
  /** @type {import('typescript').Statement[]} */
  const found = sourceFile.statements.filter((statement) => statementNames(statement).includes(name));
  if (found.length !== 1) missing(`Expected 1 top-level declaration named ${name}, found ${found.length}`);
  const statement = found[0];
  if (!statement) missing(`Expected 1 top-level declaration named ${name}, found 0`);
  return nodeText(sourceFile, statement);
}

/**
 * Inclusive source from the top-level declaration startName through endName.
 * Leading comments on startName are excluded; comments between the two are kept
 * only because they sit in the raw span, and eval does not require them.
 * @param {string} src
 * @param {string} startName
 * @param {string} endName
 * @returns {string}
 */
function extractDeclarationSpan(src, startName, endName) {
  const sourceFile = parseJsSource(src);
  const starts = sourceFile.statements.filter((statement) => statementNames(statement).includes(startName));
  const ends = sourceFile.statements.filter((statement) => statementNames(statement).includes(endName));
  if (starts.length !== 1) missing(`Expected 1 span start named ${startName}, found ${starts.length}`);
  if (ends.length !== 1) missing(`Expected 1 span end named ${endName}, found ${ends.length}`);
  const start = starts[0];
  const end = ends[0];
  if (!start || !end) missing('Declaration span bounds missing');
  if (start.getStart(sourceFile) > end.getStart(sourceFile)) {
    missing(`${startName} does not precede ${endName}`);
  }
  return sourceFile.text.slice(start.getStart(sourceFile), end.end);
}

/**
 * @typedef {object} SourceContainer
 * @property {string} [className]
 * @property {string} [method]
 * @property {string} [functionName]
 */

/**
 * @param {import('typescript').SourceFile} sourceFile
 * @param {SourceContainer} container
 * @returns {import('typescript').Node}
 */
function findContainer(sourceFile, container) {
  /** @type {import('typescript').Node[]} */
  const found = [];
  /**
   * @param {import('typescript').Node} node
   */
  function visit(node) {
    if (container.className && container.method && ts.isMethodDeclaration(node)) {
      const parent = node.parent;
      if (ts.isClassDeclaration(parent)
        && identifierText(parent.name) === container.className
        && identifierText(node.name) === container.method) {
        found.push(node);
      }
    } else if (container.functionName && ts.isFunctionDeclaration(node)
      && identifierText(node.name) === container.functionName) {
      found.push(node);
    } else if (!container.className && !container.functionName && container.method
      && ts.isMethodDeclaration(node) && identifierText(node.name) === container.method) {
      found.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (found.length !== 1) {
    const label = container.className
      ? `${container.className}.${container.method}`
      : (container.functionName || container.method || 'container');
    missing(`Expected 1 source container ${label}, found ${found.length}`);
  }
  const only = found[0];
  if (!only) missing('Source container not found');
  return only;
}

/**
 * @param {import('typescript').Node} container
 * @returns {import('typescript').Statement[]}
 */
function containerStatements(container) {
  if (ts.isFunctionLike(container) && container.body && ts.isBlock(container.body)) {
    return [...container.body.statements];
  }
  missing('Container has no statement body');
}

/**
 * Method text, excluding leading comments.
 * @param {string} src
 * @param {string} className
 * @param {string} methodName
 * @returns {string}
 */
function extractMethod(src, className, methodName) {
  const sourceFile = parseJsSource(src);
  return nodeText(sourceFile, findContainer(sourceFile, { className, method: methodName }));
}

/**
 * Direct statements of a function or method, from the first whose text includes
 * fromIncludes up to (not including) the later statement whose text includes
 * untilIncludes.
 * @param {string} src
 * @param {SourceContainer & { fromIncludes: string, untilIncludes: string }} spec
 * @returns {string}
 */
function extractStatementRange(src, spec) {
  const sourceFile = parseJsSource(src);
  const statements = containerStatements(findContainer(sourceFile, spec));
  const startIdx = statements.findIndex((statement) => statement.getText(sourceFile).includes(spec.fromIncludes));
  if (startIdx < 0) missing(`Start statement not found: ${spec.fromIncludes}`);
  const endIdx = statements.findIndex((statement, index) => (
    index > startIdx && statement.getText(sourceFile).includes(spec.untilIncludes)
  ));
  if (endIdx < 0) missing(`End statement not found: ${spec.untilIncludes}`);
  const start = statements[startIdx];
  const end = statements[endIdx];
  if (!start || !end) missing('Statement range bounds missing');
  return sourceFile.text.slice(start.getStart(sourceFile), end.getStart(sourceFile));
}

/**
 * @param {import('typescript').Node[]} nodes
 * @returns {import('typescript').Node[]}
 */
function innermostNodes(nodes) {
  return nodes.filter((node) => !nodes.some((other) => (
    other !== node && node.pos <= other.pos && other.end <= node.end
  )));
}

/**
 * Unique if or for statement inside a container. Nested matches keep the innermost.
 * @param {string} src
 * @param {SourceContainer & { kind: 'if' | 'for', includes: readonly string[] }} spec
 * @returns {string}
 */
function extractMatchingStatement(src, spec) {
  const sourceFile = parseJsSource(src);
  const container = findContainer(sourceFile, spec);
  /** @type {import('typescript').Statement[]} */
  const hits = [];
  /**
   * @param {import('typescript').Node} node
   */
  function visit(node) {
    const isKind = spec.kind === 'if' ? ts.isIfStatement(node) : ts.isForStatement(node);
    if (isKind) {
      const text = node.getText(sourceFile);
      if (spec.includes.every((part) => text.includes(part))) hits.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(container);
  const matches = innermostNodes(hits);
  if (matches.length !== 1) {
    missing(`Expected 1 ${spec.kind} statement matching ${spec.includes.join(' + ')}, found ${matches.length}`);
  }
  const match = matches[0];
  if (!match) missing('Matching statement missing');
  return nodeText(sourceFile, match);
}

/**
 * Start offset of the unique innermost statement whose text includes every marker.
 * A string marker matches one phrase; an array requires all phrases, so a nested
 * statement cannot satisfy a marker that only the outer statement contains.
 * @param {string} src
 * @param {SourceContainer & { includes: string | readonly string[] }} spec
 * @returns {number}
 */
function statementStart(src, spec) {
  const sourceFile = parseJsSource(src);
  const container = findContainer(sourceFile, spec);
  const parts = typeof spec.includes === 'string' ? [spec.includes] : spec.includes;
  /** @type {import('typescript').Statement[]} */
  const hits = [];
  /**
   * @param {import('typescript').Node} node
   */
  function visit(node) {
    if (ts.isStatement(node)) {
      const text = node.getText(sourceFile);
      if (parts.every((part) => text.includes(part))) hits.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(container);
  const matches = innermostNodes(hits);
  if (matches.length !== 1) missing(`Expected 1 statement containing ${parts.join(' + ')}, found ${matches.length}`);
  const match = matches[0];
  if (!match) missing('Statement missing');
  return match.getStart(sourceFile);
}

/**
 * Branch offsets relative to the named function declaration.
 * @param {string} src
 * @param {string} functionName
 * @param {string} conditionText
 * @returns {{ thenStart: number, thenEnd: number, elseStart: number, elseEnd: number }}
 */
function ifBranchOffsets(src, functionName, conditionText) {
  const sourceFile = parseJsSource(src);
  const fn = findContainer(sourceFile, { functionName });
  const fnStart = fn.getStart(sourceFile);
  /** @type {import('typescript').IfStatement[]} */
  const hits = [];
  /**
   * @param {import('typescript').Node} node
   */
  function visit(node) {
    if (ts.isIfStatement(node) && node.expression.getText(sourceFile) === conditionText) hits.push(node);
    ts.forEachChild(node, visit);
  }
  visit(fn);
  if (hits.length !== 1) missing(`Expected 1 if (${conditionText}) in ${functionName}, found ${hits.length}`);
  const branch = hits[0];
  if (!branch || !branch.elseStatement) missing(`if (${conditionText}) has no else`);
  return {
    thenStart: branch.thenStatement.getStart(sourceFile) - fnStart,
    thenEnd: branch.thenStatement.end - fnStart,
    elseStart: branch.elseStatement.getStart(sourceFile) - fnStart,
    elseEnd: branch.elseStatement.end - fnStart,
  };
}

module.exports = {
  CORE_RUNTIME_SOURCE_KEYS,
  SOURCE_FILE_PATHS,
  blankStringContents,
  extractDeclaration,
  extractDeclarationSpan,
  extractMatchingStatement,
  extractMethod,
  extractStatementRange,
  ifBranchOffsets,
  parseJsSource,
  readSourceFile,
  readSourceFiles,
  resolveSourceFile,
  statementStart,
  stripJsComments,
};
