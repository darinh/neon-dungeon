'use strict';
// @ts-check

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const CORE_RUNTIME_SOURCE_KEYS = Object.freeze([
  'content',
  'entities',
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
  contentCombo: path.join('src', 'content', 'combo.js'),
  contentEvents: path.join('src', 'content', 'events.js'),
  contentShop: path.join('src', 'content', 'shop.js'),
  contentPerks: path.join('src', 'content', 'perks.js'),
  contentEffects: path.join('src', 'content', 'effects.js'),
  contentHackware: path.join('src', 'content', 'hackware.js'),
  content: path.join('src', 'content.js'),
  entities: path.join('src', 'entities.js'),
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
