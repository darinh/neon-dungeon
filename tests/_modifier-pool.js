'use strict';
// Floor-modifier pool-size assertion helper. Centralised because the
// assertion text was previously identical across 6 *-modifier.test.js
// files except for the count literal and the "after X added" suffix.
// Adding a new modifier required bumping the assertion in N+1 files
// (the N existing modifier-test files + the new modifier's own test
// file). At N=6 (post PR #268, CHAINREACT) this became maintenance
// friction — that PR had to mechanically update 5 files for a 1-line
// invariant.
//
// A single helper means future modifier additions touch only:
//   1. The new modifier's entry in src/content.js FLOOR_MODIFIERS dict
//   2. The new modifier's gameplay logic in entities.js / content.js
//   3. EXPECTED_MODIFIER_POOL_SIZE in this file (1 line)
//   4. The new modifier's own test file with its own pool-count
//      assertion (which references EXPECTED_MODIFIER_POOL_SIZE)
//
// Per-file pool-count tests are kept (rather than collapsed into one
// shared test) so a future regression that drops the dict size still
// fails inside EVERY modifier's test suite — the failure points the
// reviewer at every modifier whose roll probability just shifted, not
// just at one canonical "pool" suite.
//
// Filename uses the underscore prefix to mark it as a non-test helper.
// Test runner pattern in package.json is `node --test tests/*.test.js`
// so this file (no `.test.js` suffix) will NOT be picked up as a
// test file.

const assert = require('node:assert/strict');

const EXPECTED_MODIFIER_POOL_SIZE = 20;

/**
 * Assert that FLOOR_MODIFIERS in src/content.js contains exactly the
 * expected number of top-level entries. Counts lines matching
 * `^\s*[A-Z_]+:\s*\{` inside the FLOOR_MODIFIERS dict body — top-level
 * keys only (won't double-count nested object literals in fields).
 *
 * @param {string} content - Raw text of src/content.js.
 * @returns {void} - Throws via assert.equal on mismatch.
 */
function assertModifierPoolSize(content) {
  const startIdx = content.indexOf('const FLOOR_MODIFIERS');
  assert.ok(startIdx !== -1, 'FLOOR_MODIFIERS dict must exist in content.js');
  const endIdx = content.indexOf('};', startIdx);
  assert.ok(endIdx > startIdx, 'FLOOR_MODIFIERS dict must terminate with };');
  const dictBody = content.slice(startIdx, endIdx);
  const keys = dictBody.match(/^\s*[A-Z_]+:\s*\{/gm) || [];
  assert.equal(keys.length, EXPECTED_MODIFIER_POOL_SIZE,
    `FLOOR_MODIFIERS must contain ${EXPECTED_MODIFIER_POOL_SIZE} entries (Object.keys-driven roll probability invariant); found ${keys.length}`);
}

/**
 * Assert that a specific modifier name is registered as a top-level key
 * inside FLOOR_MODIFIERS. This is the second invariant every per-modifier
 * test suite verifies — the modifier dict can be present and valid but
 * the modifier's own entry can be nested inside another field (typo) or
 * missing entirely. MODIFIER_KEYS = Object.keys(FLOOR_MODIFIERS) is what
 * game.js's floor-roll consults at line ~190; if a modifier ends up
 * nested somewhere other than the dict, it would be defined but never
 * rolled.
 *
 * Centralised because the prior per-file implementation duplicated
 * this 6-line check across 9 *-modifier.test.js files (cascade,
 * overcharge, windfall, signal-boost, reverb, quartermaster, autonomy,
 * chainreact, magnetism). Centralising also fixes the latent
 * `startIdx > 0` boundary bug (carried into the per-file copies before
 * being caught in adversarial review of PR #270).
 *
 * @param {string} content - Raw text of src/content.js.
 * @param {string} modifierName - Modifier key (e.g. 'CHAINREACT').
 * @returns {void} - Throws via assert.ok on missing dict, missing
 *   terminator, or modifier-key not present at top level.
 */
function assertModifierIsTopLevelKey(content, modifierName) {
  assert.ok(typeof modifierName === 'string' && /^[A-Z_]+$/.test(modifierName),
    `modifierName must be an UPPERCASE_UNDERSCORE string; got ${modifierName}`);
  const startIdx = content.indexOf('const FLOOR_MODIFIERS');
  assert.ok(startIdx !== -1, 'FLOOR_MODIFIERS dict must exist in content.js');
  const endIdx = content.indexOf('};', startIdx);
  assert.ok(endIdx > startIdx, 'FLOOR_MODIFIERS dict must terminate with };');
  const dictBody = content.slice(startIdx, endIdx);
  // Match `^\s*MODIFIER_NAME:` to scope to a top-level key in the dict
  // (won't match nested object-literal fields with the same name).
  const keyRe = new RegExp(`^\\s*${modifierName}:`, 'm');
  assert.ok(keyRe.test(dictBody),
    `${modifierName} must be a top-level key inside FLOOR_MODIFIERS so MODIFIER_KEYS includes it`);
}

module.exports = { assertModifierPoolSize, assertModifierIsTopLevelKey, EXPECTED_MODIFIER_POOL_SIZE };
