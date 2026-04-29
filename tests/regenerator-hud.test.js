'use strict';
// Regenerator HUD discoverability — extends the existing 'regen' badge
// in getStatusEffects() to ALSO surface the regenerator meta-upgrade's
// active heal window (not just NANO_REGEN).
//
// CONTEXT: Two distinct healing systems exist:
//   1. NANO_REGEN (an upgrade): heals 1 HP/s per level, always-on while
//      hp < maxHp (game.js:1879-1880). Player picks it up via in-game
//      drops.
//   2. regenerator (a META upgrade): heals 0.5 HP/s per level, gated on
//      `_outOfCombatTimer > 3` (3-second grace after taking damage).
//      Implemented in meta/behavior.js:85-90 tickOutOfCombatRegen,
//      controlled by metaFlags.regenerator level.
//
// Pre-PR the existing 'regen' badge was gated ONLY on NANO_REGEN. Players
// who owned the regenerator meta-upgrade (without NANO_REGEN) saw
// healing happen with NO HUD signal — invisible heal-while-low gameplay
// loop.
//
// This PR extends the existing badge gate to also fire when the
// regenerator meta-upgrade is currently healing (regenPerSec > 0 +
// _outOfCombatTimer > 3 + hp < maxHp). Both systems share the same ♻
// REGEN badge because they feel identical to the player; the badge
// reflects the actual healing state, not just ownership.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { extractBranch, loadAlignmentSources } = require('./_alignment-helpers.js');

const { CONTENT, CONTENT_CODE } = loadAlignmentSources(__dirname);
// regenerator also reads src/meta/behavior.js for the regenPerSec computation;
// custom path not yet generalised — keep this load inline.
const BEHAVIOR = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'meta', 'behavior.js'), 'utf8'
);

// ─── getStatusEffects() regen badge gate extension ─────────────────────

test('regen badge gate references both NANO_REGEN AND regenerator-meta predicates', () => {
  // Pre-PR the gate only checked NANO_REGEN. Post-PR the gate must also
  // include the regenerator meta-upgrade's active-heal predicate so
  // players who own ONLY regenerator (without NANO_REGEN) see the badge.
  // Pin both predicates as required substrings inside getStatusEffects.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch, 'getStatusEffects function body must be locatable');
  // NANO_REGEN ownership predicate must remain (don't regress the legacy
  // gate by accidentally dropping it).
  assert.match(fnBranch, /player\.upgrades\.NANO_REGEN/,
    'getStatusEffects must keep the NANO_REGEN ownership predicate (regression defence)');
  // regenerator-meta predicate must include both regenPerSec ownership
  // AND _outOfCombatTimer > 3 (matches tickOutOfCombatRegen at
  // meta/behavior.js:87 — the actual heal-firing condition).
  assert.match(fnBranch, /player\.regenPerSec/,
    'getStatusEffects must reference player.regenPerSec for the regenerator-meta gate');
  assert.match(fnBranch, /player\._outOfCombatTimer[^>]*>\s*3/,
    'getStatusEffects must gate regenerator-meta on _outOfCombatTimer > 3 (matches tickOutOfCombatRegen)');
});

test('regen badge fires when EITHER system would heal AND hp < maxHp', () => {
  // Verify the OR-composition: one block that pushes the badge if either
  // NANO_REGEN OR regenerator-meta is active, gated by hp < maxHp at the
  // top level so a fully-healed player sees no badge regardless of
  // ownership.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  // Find the if-block that contains the 'regen' fx.push.
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^{]*_nanoRegen[^{]*_metaRegen[^{]*\{/
  );
  assert.ok(ifBranch, 'regen fx if-block must use OR composition of nano + meta predicates');
  assert.match(ifBranch, /id:\s*'regen'/,
    "regen fx.push must be inside the OR-composed if-block");
  assert.match(ifBranch, /player\.hp\s*<\s*player\.maxHp/,
    'top-level if-block must gate on hp < maxHp');
});

test('regen badge id appears EXACTLY once in content.js (no parallel duplicate badge)', () => {
  // Defends against a future PR adding a second 'regen' badge for one
  // of the two systems (would corrupt statusFx[fx.id].alpha tracking).
  const all = CONTENT_CODE.match(/id:\s*'regen'/g) || [];
  assert.equal(all.length, 1,
    `content.js must contain exactly 1 id: 'regen' fx entry; got ${all.length}`);
});

test('regen meta gate threshold (3) matches tickOutOfCombatRegen in meta/behavior.js (cross-file desync defence)', () => {
  // Cross-file desync defence (per stored memory 'HUD status fx', PRs
  // #280/#282): the OOC grace threshold is hard-coded as 3 in BOTH the
  // HUD gate (content.js) AND the heal-firing gate (meta/behavior.js
  // :87). content.js / meta/behavior.js are browser-loaded with no
  // module exports so cross-file imports aren't possible. A future
  // re-tune in behavior.js would silently desync the badge — players
  // would see "REGEN" while NOT being healed (or vice-versa). Parse
  // behavior.js and assert the content.js HUD uses the same literal.
  const behaviorMatch = BEHAVIOR.match(
    /player\._outOfCombatTimer\s*>\s*(\d+(?:\.\d+)?)/
  );
  assert.ok(behaviorMatch,
    'tickOutOfCombatRegen heal-firing predicate must be locatable in meta/behavior.js');
  const behaviorThreshold = behaviorMatch[1]; // e.g. '3'

  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const thresholdInHud = new RegExp(
    `_outOfCombatTimer[^>]*>\\s*${behaviorThreshold.replace(/\./g, '\\.')}`
  );
  assert.match(fnBranch, thresholdInHud,
    `HUD gate must use OOC threshold ${behaviorThreshold} (matches tickOutOfCombatRegen heal-firing predicate at meta/behavior.js:87)`);
});

// ─── runtime simulation: gate semantics ────────────────────────────────

test('runtime: regen badge fires for NANO_REGEN-only ownership', () => {
  // Behavioural complement: replicate the OR-gate predicate on
  // synthetic player shapes; verify all four ownership combinations.
  function shouldShowFx(player) {
    const nanoRegen = (player.upgrades.NANO_REGEN || 0) > 0;
    const metaRegen = (player.regenPerSec || 0) > 0
      && (player._outOfCombatTimer || 0) > 3;
    return (nanoRegen || metaRegen) && player.hp < player.maxHp;
  }

  // NANO_REGEN only (no meta), hp damaged → SHOW.
  assert.equal(shouldShowFx({
    upgrades: { NANO_REGEN: 1 }, regenPerSec: 0,
    _outOfCombatTimer: 5, hp: 50, maxHp: 100
  }), true, 'NANO_REGEN owner with damage must show fx');

  // regenerator only (no NANO_REGEN), OOC > 3, hp damaged → SHOW.
  assert.equal(shouldShowFx({
    upgrades: { NANO_REGEN: 0 }, regenPerSec: 0.5,
    _outOfCombatTimer: 5, hp: 50, maxHp: 100
  }), true, 'regenerator owner past OOC threshold must show fx');

  // regenerator only, OOC < 3 (still in grace) → HIDE (no heal yet).
  assert.equal(shouldShowFx({
    upgrades: { NANO_REGEN: 0 }, regenPerSec: 0.5,
    _outOfCombatTimer: 1.5, hp: 50, maxHp: 100
  }), false, 'regenerator owner WITHIN grace period must hide fx (no heal happening)');

  // Both systems, hp damaged → SHOW (single badge).
  assert.equal(shouldShowFx({
    upgrades: { NANO_REGEN: 2 }, regenPerSec: 1.0,
    _outOfCombatTimer: 5, hp: 50, maxHp: 100
  }), true, 'both systems active must show fx');

  // Neither system → HIDE.
  assert.equal(shouldShowFx({
    upgrades: { NANO_REGEN: 0 }, regenPerSec: 0,
    _outOfCombatTimer: 5, hp: 50, maxHp: 100
  }), false, 'no regen ownership must hide fx');

  // Either system + fully healed (hp === maxHp) → HIDE.
  assert.equal(shouldShowFx({
    upgrades: { NANO_REGEN: 1 }, regenPerSec: 0,
    _outOfCombatTimer: 5, hp: 100, maxHp: 100
  }), false, 'fully-healed player must hide fx (no heal needed)');
});
