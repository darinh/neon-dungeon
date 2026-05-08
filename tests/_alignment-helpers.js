'use strict';
// @ts-check
//
// Shared helpers for cross-file HUD-badge ↔ runtime-multiplier alignment
// tests. Extracted from tests/bulwark-hud.test.js (PR #306+#312) and
// tests/glass-cannon-hud.test.js (PR #318) where the canonical 5-layer
// (BULWARK braced single-site) and 9-layer (GLASS_CANNON two-site /
// braceless) alignment-test patterns are documented.
//
// PURPOSE: when an HUD badge in src/content.js getStatusEffects() must
// stay in lock-step with a runtime multiplier in src/entities.js or a
// source-of-truth declaration in a split content module, substring-only matches
// silently false-pass on any added conjunct/disjunct or any structural
// refactor that hoists the if-block under an outer condition. The
// canonical pattern parses the source text of both files, extracts the
// controlling if-condition AND the brace-depth context AND the if-block
// body content, then asserts strict equality after side-specific
// receiver normalisation.
//
// The helpers in this module are PURE source-text manipulation. They
// have no game knowledge — every alignment test composes them with
// perk-specific anchor regexes and assertion messages.
//
// USAGE (typical alignment test):
//
//   const {
//     stripComments, blankStringContents, extractBranch,
//     extractIfCondition, normaliseMultiplierPredicate,
//     normaliseBadgePredicate, loadAlignmentSources,
//   } = require('./_alignment-helpers.js');
//
//   const { CONTENT, ENTITIES, CONTENT_CODE, ENTITIES_CODE,
//     CONTENT_BRACES, ENTITIES_BRACES } = loadAlignmentSources(__dirname);
//
//   test('FOO badge gate matches multiplier gate exactly', () => {
//     const fnBranch = extractBranch(
//       CONTENT_CODE,
//       /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
//     );
//     // ... extract badge cond, multiplier cond, normalise, compare ...
//   });
//
// CONVENTIONS:
//   - extractBranch / extractIfCondition / blankStringContents return
//     null on malformed input rather than throwing — every caller MUST
//     `assert.ok(result, '...')` immediately to fail loudly with a
//     domain-specific message.
//   - openerRe passed to extractBranch MUST be NON-GLOBAL — extractBranch
//     uses `src.match(openerRe).index` and the global-flag form returns
//     an array with no `.index` (per stored memory 'test source-text
//     extraction' — caused a real false-failure during PR #312).
//   - blankStringContents preserves character offsets — positions
//     computed against either the original or blanked text are
//     interchangeable. Use blanked text for brace/paren walks; use
//     original for assertion error messages.
//   - normaliseMultiplierPredicate / normaliseBadgePredicate are
//     SIDE-SPECIFIC — multiplier strips only `this.`, badge strips only
//     `player.` (plus the leading defensive `player.perks &&`
//     short-circuit). After normalisation, callers MUST assert the
//     OPPOSITE-receiver token does NOT leak through (e.g. multiplier
//     normalised must not contain `\bplayer\b`). Mixing receivers is a
//     real bug that bidirectional stripping would silently false-pass.
//
// MIGRATION NOTE: this module currently powers tests/bulwark-hud.test.js
// and tests/glass-cannon-hud.test.js. ~15 other HUD test files
// (overdrive, hot-hand, retribution, last-stand, last-stand-cooldown,
// deadeye-charging, momentum, regenerator, meta-second-wind, floor-
// modifier-progress, piercing-heart, siphon, trauma-kit, surge-counter,
// stride) duplicate a SUBSET of these helpers (typically just
// stripComments + extractBranch). Future PRs should incrementally
// migrate them when next touched. Do NOT mass-migrate in one PR —
// blast radius is too high to verify mutation semantics on all 17
// files at once.

const {
  blankStringContents,
  readSourceFile,
  stripJsComments,
} = require('./_source-files.js');

/**
 * Strip both block (`/* ... *​/`) and line (`// ...`) comments from
 * source text. Used to prevent comment text from being matched by
 * structural anchor regexes (e.g. a comment containing `if (` would
 * otherwise interfere with `lastIndexOf('if (')`).
 *
 * Delegates to tests/_source-files.js so future source-file splits have one
 * place to update source text loading/comment handling.
 *
 * @param {string} src
 * @returns {string}
 */
function stripComments(src) {
  return stripJsComments(src);
}

/**
 * Brace-walk a `{`...`}` body starting from the FIRST match of
 * `openerRe`. Returns the slice from the start of the match through
 * the matching closing `}` (inclusive), or null if no match / no
 * balancing brace.
 *
 * @param {string} src
 * @param {RegExp} openerRe MUST be non-global. Uses `src.match(openerRe).index`
 *   — the global-flag form returns an array with no `.index` and would
 *   produce a confusing `cannot read property of undefined` error.
 * @returns {string | null}
 */
function extractBranch(src, openerRe) {
  const m = src.match(openerRe);
  if (!m || m.index === undefined) return null;
  const startIdx = m.index + m[0].length;
  let depth = 1;
  for (let i = startIdx; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(m.index, i + 1);
    }
  }
  return null;
}

/**
 * Extract the parenthesised condition of an if-statement (or any
 * paren-balanced expression) starting at the given character index of
 * `(`. Walks parens to balance, returns the inner text WITHOUT outer
 * parens. Returns null on malformed input (no `(` at openIdx, or no
 * balancing `)`).
 *
 * @param {string} src
 * @param {number} openIdx index of the opening `(`
 * @returns {string | null}
 */
function extractIfCondition(src, openIdx) {
  if (src[openIdx] !== '(') return null;
  let depth = 1;
  for (let i = openIdx + 1; i < src.length; i++) {
    const c = src[i];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return src.slice(openIdx + 1, i);
    }
  }
  return null;
}

/**
 * Normalise an entities.js multiplier predicate for cross-file
 * comparison. Strips ONLY `this.` (the multiplier sits inside a
 * Player method so the receiver is always `this`). Mixing receivers
 * (e.g. `player.maxHp` inside Player.takeDamage) would be a real
 * bug — callers MUST assert no `\bplayer\b` remains afterwards
 * (this function deliberately does not strip `player.` so that
 * leftover bare `player` tokens fail loudly downstream).
 *
 * @param {string} cond
 * @returns {string}
 */
function normaliseMultiplierPredicate(cond) {
  return cond
    .replace(/\s+/g, '')
    .replace(/this\./g, '');
}

/**
 * Normalise the content.js badge predicate for cross-file comparison.
 * Strips ONLY `player.` (the badge sits inside the free function
 * getStatusEffects(player) so the receiver is always `player` — using
 * `this.` here would resolve to undefined in strict mode and crash).
 * Also strips the leading defensive `player.perks &&` short-circuit
 * since entities.js side has no such guard (receivers always have
 * .perks inside Player methods).
 *
 * Side-specific stripping (NOT bidirectional) is deliberate — it lets
 * a leftover `\bthis\b` token in the badge gate fail loudly downstream
 * (since it would resolve to undefined / wrong receiver at runtime),
 * which a bidirectional `this.|player.` strip would silently mask.
 *
 * @param {string} cond
 * @returns {string}
 */
function normaliseBadgePredicate(cond) {
  return cond
    .replace(/\s+/g, '')
    .replace(/^player\.perks&&/, '')
    .replace(/player\./g, '');
}

/**
 * Load the source text of `src/content.js`, split companion content modules,
 * and `src/entities.js`, then return six derived buffers used by every
 * alignment test:
 *   - CONTENT / ENTITIES         — raw source (with comments + string literals)
 *   - CONTENT_CODE / ENTITIES_CODE — comments stripped (anchor regexes
 *                                    won't accidentally match comments)
 *   - CONTENT_BRACES / ENTITIES_BRACES — comments stripped AND string-
 *                                        literal contents blanked (safe
 *                                        for brace/paren-depth walks)
 *
 * Resolves paths relative to `testsDir` (typically `__dirname` from
 * the calling test file). All three buffer pairs share the same
 * character offsets — positions computed against any pair are
 * interchangeable with the others.
 *
 * @param {string} testsDir absolute path to the tests/ directory
 *   (typically `__dirname` from the calling test file)
 * @returns {{
 *   CONTENT: string, ENTITIES: string,
 *   CONTENT_CODE: string, ENTITIES_CODE: string,
 *   CONTENT_BRACES: string, ENTITIES_BRACES: string,
 * }}
 */
function loadAlignmentSources(testsDir) {
  const CONTENT = readSourceFile(testsDir, 'content') + '\n' + readSourceFile(testsDir, 'contentPerks');
  const ENTITIES = readSourceFile(testsDir, 'entities');
  const CONTENT_CODE = stripComments(CONTENT);
  const ENTITIES_CODE = stripComments(ENTITIES);
  const CONTENT_BRACES = blankStringContents(CONTENT_CODE);
  const ENTITIES_BRACES = blankStringContents(ENTITIES_CODE);
  return { CONTENT, ENTITIES, CONTENT_CODE, ENTITIES_CODE, CONTENT_BRACES, ENTITIES_BRACES };
}

module.exports = {
  stripComments,
  blankStringContents,
  extractBranch,
  extractIfCondition,
  normaliseMultiplierPredicate,
  normaliseBadgePredicate,
  loadAlignmentSources,
};
