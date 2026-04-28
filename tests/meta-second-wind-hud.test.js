'use strict';
// META second_wind HUD discoverability — extends the existing 'second-wind'
// badge in getStatusEffects() to ALSO surface the META second_wind
// upgrade's revive-available state (not just the SECOND_WIND perk).
//
// CONTEXT: Two distinct revive-on-lethal systems exist, firing
// independently per meta/behavior.js:99:
//   1. SECOND_WIND perk: revives at 30% HP, tracked via
//      player.secondWindUsed boolean. Owned via player.perks.SECOND_WIND.
//   2. second_wind META upgrade: revives at 25% × level HP, tracked via
//      player._metaSecondWindUsed boolean. Owned via
//      player.metaFlags.second_wind.
//
// Pre-PR the existing 'second-wind' badge was gated ONLY on the perk
// version. Players who owned the META second_wind upgrade (without the
// perk) saw NO HUD signal that the safety net was armed.
//
// This PR extends the existing badge gate to fire when EITHER system
// has an unused revive available. Both share the same badge id because
// the player only cares about "do I have a revive ready or not." Same
// pattern as PR #284 (regenerator badge gate extension).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
);

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const CONTENT_CODE = stripComments(CONTENT);

/**
 * Brace-walk a `{`...`}` body starting from the FIRST match of `openerRe`.
 * @param {string} src
 * @param {RegExp} openerRe
 */
function extractBranch(src, openerRe) {
  const m = src.match(openerRe);
  if (!m) return null;
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

// ─── getStatusEffects() second-wind badge gate extension ───────────────

test('second-wind badge gate references BOTH perk AND meta-upgrade predicates', () => {
  // Pre-PR the gate only checked the perk. Post-PR the gate must also
  // include the META second_wind unused-revive predicate so players who
  // own ONLY the META upgrade see the badge.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch, 'getStatusEffects function body must be locatable');
  // Perk predicate must remain (regression defence).
  assert.match(fnBranch, /player\.perks\.SECOND_WIND\s*&&\s*!\s*player\.secondWindUsed/,
    'getStatusEffects must keep the SECOND_WIND perk predicate (regression defence)');
  // Meta predicate must include both ownership AND not-yet-used (matches
  // tryMetaSecondWind at meta/behavior.js:104 — early-returns on either
  // condition false).
  assert.match(fnBranch, /player\.metaFlags[\s\S]{0,80}player\.metaFlags\.second_wind/,
    'getStatusEffects must reference player.metaFlags.second_wind for meta gate');
  assert.match(fnBranch, /!\s*player\._metaSecondWindUsed/,
    'getStatusEffects must gate meta on !_metaSecondWindUsed (revive not yet consumed)');
});

test('second-wind badge fires when EITHER system has an unused revive', () => {
  // Verify the OR-composition: one block that pushes the badge if
  // either perk OR meta has an unused revive.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  // Find the if-block that contains the 'second-wind' fx.push using the
  // _perkSW || _metaSW shape (use [^{]* to span nested parens).
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^{]*_perkSW[^{]*_metaSW[^{]*\{/
  );
  assert.ok(ifBranch, 'second-wind fx if-block must use OR composition of perk + meta predicates');
  assert.match(ifBranch, /id:\s*'second-wind'/,
    "second-wind fx.push must be inside the OR-composed if-block");
});

test('second-wind badge id appears EXACTLY once in content.js (no parallel duplicate badge)', () => {
  // Defends against a future PR adding a second 'second-wind' badge for
  // one of the two systems (would corrupt statusFx[fx.id].alpha tracking).
  const all = CONTENT_CODE.match(/id:\s*'second-wind'/g) || [];
  assert.equal(all.length, 1,
    `content.js must contain exactly 1 id: 'second-wind' fx entry; got ${all.length}`);
});

test('meta predicate includes defensive null-check on player.metaFlags', () => {
  // Legacy player shapes (test sandboxes, save migrations) may lack
  // .metaFlags. Without the null-check, accessing
  // .metaFlags.second_wind would throw. Pin the defensive guard.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  // Locate the _metaSW assignment block and ensure it short-circuits
  // on player.metaFlags BEFORE accessing .second_wind.
  assert.match(fnBranch,
    /_metaSW\s*=\s*player\.metaFlags\s*&&\s*\(\s*player\.metaFlags\.second_wind/,
    'meta predicate must short-circuit on player.metaFlags before dereferencing .second_wind');
});

// ─── runtime simulation: gate semantics ────────────────────────────────

test('runtime: second-wind badge fires for perk-only ownership', () => {
  // Behavioural complement: replicate the OR-gate predicate on
  // synthetic player shapes; verify all four ownership combinations.
  function shouldShowFx(player) {
    const perkSW = player.perks.SECOND_WIND && !player.secondWindUsed;
    const metaSW = player.metaFlags
      && (player.metaFlags.second_wind | 0) > 0
      && !player._metaSecondWindUsed;
    return !!(perkSW || metaSW);
  }

  // Perk owned, not used → SHOW.
  assert.equal(shouldShowFx({
    perks: { SECOND_WIND: true }, secondWindUsed: false,
    metaFlags: {}
  }), true, 'perk-only owner with unused revive must show fx');

  // Meta owned, not used → SHOW.
  assert.equal(shouldShowFx({
    perks: {}, secondWindUsed: false,
    metaFlags: { second_wind: 1 }, _metaSecondWindUsed: false
  }), true, 'meta-only owner with unused revive must show fx');

  // Both owned, both unused → SHOW (single badge, OR-composition).
  assert.equal(shouldShowFx({
    perks: { SECOND_WIND: true }, secondWindUsed: false,
    metaFlags: { second_wind: 1 }, _metaSecondWindUsed: false
  }), true, 'both systems with unused revives must show fx');

  // Perk owned but USED → HIDE.
  assert.equal(shouldShowFx({
    perks: { SECOND_WIND: true }, secondWindUsed: true,
    metaFlags: {}
  }), false, 'perk owner with used revive must hide fx');

  // Meta owned but USED → HIDE.
  assert.equal(shouldShowFx({
    perks: {}, secondWindUsed: false,
    metaFlags: { second_wind: 1 }, _metaSecondWindUsed: true
  }), false, 'meta owner with used revive must hide fx');

  // Both owned but BOTH USED → HIDE (no revives left).
  assert.equal(shouldShowFx({
    perks: { SECOND_WIND: true }, secondWindUsed: true,
    metaFlags: { second_wind: 1 }, _metaSecondWindUsed: true
  }), false, 'both systems used must hide fx');

  // Mixed: perk used + meta unused → SHOW (meta still arms).
  assert.equal(shouldShowFx({
    perks: { SECOND_WIND: true }, secondWindUsed: true,
    metaFlags: { second_wind: 1 }, _metaSecondWindUsed: false
  }), true, 'meta unused (perk used) must still show fx — second revive available');

  // No metaFlags at all (legacy shape), perk owned → SHOW (no crash).
  assert.equal(shouldShowFx({
    perks: { SECOND_WIND: true }, secondWindUsed: false
  }), true, 'undefined metaFlags must not crash; perk gate carries');

  // Neither owned → HIDE.
  assert.equal(shouldShowFx({
    perks: {}, secondWindUsed: false,
    metaFlags: {}
  }), false, 'no second-wind ownership must hide fx');
});
