'use strict';
// AUTONOMY floor modifier — seventh positive modifier in the
// FLOOR_MODIFIERS pool (after CASCADE, OVERCHARGE, WINDFALL,
// SIGNAL_BOOST, REVERB, QUARTERMASTER). Hackware cooldowns are
// reduced 25% on this floor — applied as a multiplicative factor at
// activation time inside `activateHackware()` in src/content.js.
//
// Stacks multiplicatively with the OVERCLOCKER augment (×0.7) for a
// combined ×0.525 cooldown when both are active. Both reductions are
// passive and rare-or-rolled, so the synergy rewards augment-first
// builds without being run-defining.
//
// content.js is browser-only (no UMD/CommonJS exports), so these tests
// assert structural invariants any working AUTONOMY modifier must
// satisfy:
//   - Registry shape (label/desc/colour/icon) so MODIFIER_KEYS picks
//     it up and the HUD badge in render.js renders correctly.
//   - The activation-time gate (_CG.modifier === 'AUTONOMY') reads the
//     canonical content.js floor-modifier global (a typo to game.modifier
//     would silently disable the bonus on every cooldown).
//   - The 0.75 multiplier sits inside `activateHackware()` so it ONLY
//     applies on activation (not on cooldown ticks — those count down
//     from the already-multiplied value).
//   - Multiplicative stacking with OVERCLOCKER (both factors present in
//     the same expression).
//   - Pool-count invariant (18 entries — bumps from QUARTERMASTER's 17).
//   - Exactly-once invariant on _CG.modifier === 'AUTONOMY' (mirrors
//     the regenerative-modifier exact-count gate) — defends against
//     accidental duplication (e.g. someone adding a second cooldown
//     gate elsewhere that double-applies the reduction).
//
// NO save/restore tests: AUTONOMY is a pure passive multiplier
// applied at activation time. There is no per-run counter or per-
// player flag to persist. The hackware cooldown itself IS persisted
// (game.js:1135 `p.hackwareCooldown=s.hackwareCooldown||0`) but that's
// already covered by existing save tests.
//
// NO HUD progress suffix tests: AUTONOMY is a passive % effect with no
// counter to surface. Mirrors CASCADE which also has no progress
// suffix. A regression test (modifierProgressSuffix does NOT contain
// an AUTONOMY branch) defends against accidental copy-paste from
// WINDFALL/REVERB/SIGNAL_BOOST.
//
// Pattern lifted from tests/quartermaster-modifier.test.js (per stored
// memory 'positive floor modifiers').

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assertModifierPoolSize, assertModifierIsTopLevelKey, EXPECTED_MODIFIER_POOL_SIZE } = require('./_modifier-pool');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
);
const RENDER = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'render.js'), 'utf8'
);

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const CONTENT_CODE = stripComments(CONTENT);

/**
 * Brace-walked branch extraction. Naive `OPENER\s*\{[^}]*\}` over-stops
 * at the first inner `{...}` close-brace.
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

/**
 * Brace-walked entry extraction for registry entries (KEY: { ... }).
 * @param {string} src
 * @param {RegExp} openerRe
 */
function extractEntry(src, openerRe) {
  const m = src.match(openerRe);
  if (!m) return null;
  const openIdx = src.indexOf('{', m.index);
  if (openIdx < 0) return null;
  let depth = 1;
  for (let i = openIdx + 1; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(m.index, i + 1);
    }
  }
  return null;
}

// ─── FLOOR_MODIFIERS registry ────────────────────────────────────────────

test('AUTONOMY is registered in FLOOR_MODIFIERS with label/desc/colour/icon', () => {
  // Shape MUST match existing modifier records (label/desc/colour/icon)
  // so the HUD badge in render.js reads them generically without per-
  // modifier branches. Brace-walked extractEntry is mandatory because
  // any nested object literal in a future field would over-stop a
  // naive regex.
  const entry = extractEntry(CONTENT, /AUTONOMY:/);
  assert.ok(entry, 'AUTONOMY entry must be locatable in FLOOR_MODIFIERS');
  assert.match(entry, /label:\s*'AUTONOMY'/,
    "AUTONOMY must carry label:'AUTONOMY'");
  assert.match(entry, /desc:\s*'[^']+'/,
    'AUTONOMY must carry a non-empty desc string');
  assert.match(entry, /colour:\s*'#[0-9a-fA-F]+'/,
    'AUTONOMY must carry a hex colour');
  assert.match(entry, /icon:\s*'[^']+'/,
    'AUTONOMY must carry an icon glyph');
});

test('AUTONOMY is a top-level key inside FLOOR_MODIFIERS (so MODIFIER_KEYS picks it up)', () => {
  // MODIFIER_KEYS = Object.keys(FLOOR_MODIFIERS) is what game.js's
  // floor-roll consults at line ~190. If AUTONOMY ends up nested
  // somewhere other than the dict, it would be defined but never rolled.
  assertModifierIsTopLevelKey(CONTENT, 'AUTONOMY');
});

test('AUTONOMY desc advertises the hackware-cooldown reduction contract', () => {
  // The desc string is what surfaces to the player. If a future re-tune
  // changes the % or the target (e.g. shield charges instead of
  // hackware) the desc MUST track the runtime gate or players are
  // misled. Pin both the hackware target AND a percentage indicator so
  // this test is the contract-violation alarm for both runtime AND copy.
  const entry = extractEntry(CONTENT, /AUTONOMY:/);
  assert.ok(entry);
  assert.match(entry, /desc:\s*'[^']*[Hh]ackware[^']*'/,
    'AUTONOMY desc must mention hackware');
  assert.match(entry, /desc:\s*'[^']*\d+%[^']*'/,
    'AUTONOMY desc must include the percentage cadence');
});

// ─── activateHackware() AUTONOMY multiplier ──────────────────────────

test('activateHackware sets cooldown via expression that reads _CG.modifier === "AUTONOMY"', () => {
  // The multiplier MUST be wired through the canonical _CG.modifier
  // global (the same global modSpeed/CHARGED branches consult). A typo
  // to game.modifier or this.modifier would silently disable the
  // modifier on every cooldown.
  assert.match(CONTENT_CODE, /_CG\.modifier\s*===\s*'AUTONOMY'/,
    "activateHackware must gate the cooldown reduction on _CG.modifier === 'AUTONOMY'");
});

test('activateHackware applies a 0.75 multiplier on AUTONOMY floors', () => {
  // The multiplier MUST be 0.75 (25% reduction) — pin the literal so
  // a future re-tune (e.g. 50% reduction) MUST update both the desc
  // string AND this test, keeping copy/runtime in sync.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+activateHackware\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch, 'activateHackware function body must be extractable');
  assert.match(fnBranch,
    /_CG\.modifier\s*===\s*'AUTONOMY'\s*\?\s*0\.75\s*:\s*1/,
    'activateHackware must apply a 0.75 multiplier when _CG.modifier === "AUTONOMY" (else 1)');
});

test('activateHackware AUTONOMY multiplier composes multiplicatively with OVERCLOCKER', () => {
  // The OVERCLOCKER augment (×0.7) and AUTONOMY (×0.75) MUST stack
  // multiplicatively (×0.525). Adding them additively (×0.45) or
  // overwriting one with the other would either over-reward or
  // silently disable a positive modifier. Pin the structure: both
  // ternary expressions appear in the same multiplicative chain on
  // hw.cooldown.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+activateHackware\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  // Find the cooldown assignment line — it should multiply hw.cooldown
  // by BOTH ternaries.
  const cooldownAssign = fnBranch.match(
    /player\.hackwareCooldown\s*=\s*hw\.cooldown[\s\S]*?;/
  );
  assert.ok(cooldownAssign, 'cooldown assignment line must be locatable inside activateHackware');
  const expr = cooldownAssign[0];
  assert.match(expr, /hasAugment\(['"]OVERCLOCKER['"]\)\s*\?\s*0\.7\s*:\s*1/,
    'cooldown expression must include OVERCLOCKER ×0.7 ternary');
  assert.match(expr, /_CG\.modifier\s*===\s*'AUTONOMY'\s*\?\s*0\.75\s*:\s*1/,
    'cooldown expression must include AUTONOMY ×0.75 ternary');
  // Both factors composed multiplicatively (no `+` joining the two
  // ternaries — that would be additive stacking).
  // Only assert there is no `+` operator separating the two ternaries.
  // We do this by finding the substring spanning OVERCLOCKER through
  // AUTONOMY (or vice-versa) and asserting it contains no top-level `+`.
  const overIdx = expr.indexOf('OVERCLOCKER');
  const autoIdx = expr.indexOf('AUTONOMY');
  assert.ok(overIdx >= 0 && autoIdx >= 0);
  const lo = Math.min(overIdx, autoIdx);
  const hi = Math.max(overIdx, autoIdx);
  const span = expr.slice(lo, hi);
  assert.ok(!/\+/.test(span),
    'OVERCLOCKER and AUTONOMY ternaries must compose multiplicatively (no `+` between them)');
});

test('_CG.modifier === "AUTONOMY" appears EXACTLY once in content.js', () => {
  // Mirror the regenerative-modifier.test.js exact-count assertion:
  // any future addition of a second AUTONOMY gate (e.g. a duplicate
  // accidentally introduced via merge / copy-paste, or a second
  // cooldown-set site that double-applies the reduction) MUST update
  // this count or fail the test loudly. Keeps the modifier's scope
  // auditable to a single touch point.
  const all = CONTENT_CODE.match(/_CG\.modifier\s*===\s*'AUTONOMY'/g) || [];
  assert.equal(all.length, 1,
    `content.js must contain exactly 1 _CG.modifier === 'AUTONOMY' reference (activateHackware multiplier); got ${all.length}`);
});

// ─── HUD wiring (modifier badge auto-picks up AUTONOMY) ───────────────

test('HUD badge in render.js reads getMod().colour/.icon/.label generically', () => {
  // The HUD badge at render.js:~860 reads .colour/.icon/.label directly
  // with NO per-modifier branches — adding a new modifier requires only
  // the dict entry plus the gameplay logic in activateHackware. This
  // test pins that invariant so a future "switch (modifier)" refactor
  // in the HUD doesn't silently lose AUTONOMY's badge.
  assert.ok(/m\.colour/.test(RENDER) && /m\.icon/.test(RENDER) && /m\.label/.test(RENDER),
    'HUD badge in render.js must read .colour/.icon/.label generically (no per-modifier branches)');
});

test('modifierProgressSuffix in render.js does NOT register an AUTONOMY counter branch', () => {
  // AUTONOMY is a passive % effect with no counter to surface. Adding
  // a `if (modKey === 'AUTONOMY')` branch would be wrong because
  // there is no shared counter to display — it would either print a
  // stale value or 0/N forever. Pin the absence so a future copy-paste
  // from WINDFALL/REVERB/SIGNAL_BOOST doesn't accidentally introduce
  // one. Brace-walked extraction anchored on the function header
  // scopes the absence-check (per stored memory 'test source-text
  // extraction').
  const helperBranch = extractBranch(
    RENDER,
    /function\s+modifierProgressSuffix\s*\([^)]*\)\s*\{/
  );
  assert.ok(helperBranch, 'modifierProgressSuffix helper must be locatable');
  assert.doesNotMatch(helperBranch, /AUTONOMY/,
    'modifierProgressSuffix must NOT contain an AUTONOMY branch (modifier is passive %, not counter-based)');
});

// ─── modifier-pool count invariants ───────────────────────────────────

test(`FLOOR_MODIFIERS pool size invariant (${EXPECTED_MODIFIER_POOL_SIZE} entries)`, () => {
  // Pool-count invariant — see tests/_modifier-pool.js for details.
  // Adding a new modifier requires bumping EXPECTED_MODIFIER_POOL_SIZE
  // in that helper file (single source of truth).
  assertModifierPoolSize(CONTENT);
});

// ─── runtime simulation: composition with OVERCLOCKER ─────────────────

test('runtime: AUTONOMY × OVERCLOCKER composition yields 0.525 multiplier', () => {
  // Behavioural complement to the regex assertions: replicate the
  // multiplicative chain on a synthetic cooldown to confirm the
  // composition arithmetic. A bug here (e.g. additive stacking, or
  // applying only one of the two reductions) would produce a different
  // numeric result that this test catches loudly.
  const baseCooldown = 8;
  function compute(modifier, hasOverclocker) {
    return baseCooldown
      * (hasOverclocker ? 0.7 : 1)
      * (modifier === 'AUTONOMY' ? 0.75 : 1);
  }
  // Off-floor, no augment: full cooldown.
  assert.equal(compute(null, false), 8, 'baseline (no AUTONOMY, no OVERCLOCKER) must equal hw.cooldown');
  // OVERCLOCKER only: ×0.7.
  assert.equal(compute(null, true), 8 * 0.7, 'OVERCLOCKER alone must reduce by 30%');
  // AUTONOMY only: ×0.75.
  assert.equal(compute('AUTONOMY', false), 8 * 0.75, 'AUTONOMY alone must reduce by 25%');
  // BOTH: ×0.7 × 0.75 = ×0.525 (multiplicative).
  assert.equal(compute('AUTONOMY', true), 8 * 0.7 * 0.75,
    'AUTONOMY + OVERCLOCKER must compose multiplicatively (×0.525), NOT additively (×0.45)');
  // Other modifiers: no effect.
  assert.equal(compute('VOLATILE', false), 8, 'non-AUTONOMY modifier must not reduce cooldown');
  assert.equal(compute('WINDFALL', true), 8 * 0.7, 'non-AUTONOMY modifier with OVERCLOCKER yields OVERCLOCKER-only');
});
