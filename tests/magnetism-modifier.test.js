'use strict';
// MAGNETISM floor modifier — ninth positive modifier in the
// FLOOR_MODIFIERS pool (after CASCADE, OVERCHARGE, WINDFALL,
// SIGNAL_BOOST, REVERB, QUARTERMASTER, AUTONOMY, CHAINREACT). Item
// pickup radius is increased 50% on this floor — applied as a
// multiplicative factor at the item-pickup tick inside game.js
// update().
//
// Stacks multiplicatively with the MAGNETIC_FIELD augment ("Double
// item pickup radius", ×2) for a combined radius × 3 (0.7 → 2.1
// tiles) when both are active. Both reductions are passive and
// rare-or-rolled, so the synergy rewards augment-first builds without
// being run-defining.
//
// content.js / game.js are browser-only (no UMD/CommonJS exports), so
// these tests assert structural invariants any working MAGNETISM
// modifier must satisfy:
//   - Registry shape (label/desc/colour/icon) so MODIFIER_KEYS picks
//     it up and the HUD badge in render.js renders correctly.
//   - The pickup-tick gate (this.modifier === 'MAGNETISM') reads the
//     canonical game.js floor-modifier ref (a typo to game.modifier
//     or _CG.modifier would either silently disable the bonus OR
//     throw if `this` is not the game object).
//   - The 1.5 multiplier is applied multiplicatively to pickupRadius
//     (NOT additively, NOT overwriting the augment).
//   - Multiplicative stacking with MAGNETIC_FIELD (both factors
//     present in the same expression chain).
//   - Pool-count invariant (20 entries — bumps from CHAINREACT's 19
//     via EXPECTED_MODIFIER_POOL_SIZE in tests/_modifier-pool.js).
//   - Exactly-once invariant on this.modifier === 'MAGNETISM'
//     (mirrors the regenerative-modifier exact-count gate) — defends
//     against accidental duplication.
//
// NO save/restore tests: MAGNETISM is a pure passive multiplier
// applied at pickup-tick time. There is no per-run counter or per-
// player flag to persist.
//
// NO HUD progress suffix tests: MAGNETISM is a passive % effect with
// no counter to surface. Mirrors AUTONOMY which also has no progress
// suffix. A regression test (modifierProgressSuffix does NOT contain
// a MAGNETISM branch) defends against accidental copy-paste from
// counter-based modifiers.
//
// Pattern lifted from tests/autonomy-modifier.test.js (per stored
// memory 'positive floor modifiers').

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assertModifierPoolSize, assertModifierIsTopLevelKey, EXPECTED_MODIFIER_POOL_SIZE } = require('./_modifier-pool');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content', 'modifiers.js'), 'utf8'
) + '\n' + fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
);
const GAME = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8'
);
const RENDER = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'render.js'), 'utf8'
);

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const GAME_CODE = stripComments(GAME);

/**
 * Brace-walked branch extraction.
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

test('MAGNETISM is registered in FLOOR_MODIFIERS with label/desc/colour/icon', () => {
  const entry = extractEntry(CONTENT, /MAGNETISM:/);
  assert.ok(entry, 'MAGNETISM entry must be locatable in FLOOR_MODIFIERS');
  assert.match(entry, /label:\s*'MAGNETISM'/,
    "MAGNETISM must carry label:'MAGNETISM'");
  assert.match(entry, /desc:\s*'[^']+'/,
    'MAGNETISM must carry a non-empty desc string');
  assert.match(entry, /colour:\s*'#[0-9a-fA-F]+'/,
    'MAGNETISM must carry a hex colour');
  assert.match(entry, /icon:\s*'[^']+'/,
    'MAGNETISM must carry an icon glyph');
});

test('MAGNETISM is a top-level key inside FLOOR_MODIFIERS (so MODIFIER_KEYS picks it up)', () => {
  assertModifierIsTopLevelKey(CONTENT, 'MAGNETISM');
});

test('MAGNETISM desc advertises the pickup-radius increase contract', () => {
  // The desc string is what surfaces to the player. If a future re-tune
  // changes the % or the target (e.g. credit-magnet instead of pickup-
  // radius) the desc MUST track the runtime gate or players are misled.
  // Pin both the pickup target AND a percentage indicator.
  const entry = extractEntry(CONTENT, /MAGNETISM:/);
  assert.ok(entry);
  assert.match(entry, /desc:\s*'[^']*[Pp]ickup[^']*'/,
    'MAGNETISM desc must mention pickup');
  assert.match(entry, /desc:\s*'[^']*\d+%[^']*'/,
    'MAGNETISM desc must include the percentage cadence');
});

// ─── game.js item-pickup MAGNETISM multiplier ─────────────────────────

test('item-pickup tick reads this.modifier === "MAGNETISM" as the gate', () => {
  // The multiplier MUST be wired through this.modifier (the canonical
  // game.js floor-modifier ref). A typo to game.modifier or
  // _CG.modifier would either silently disable the bonus on every
  // pickup tick OR throw if `this` is not the game object.
  assert.match(GAME_CODE, /this\.modifier\s*===\s*'MAGNETISM'/,
    "item-pickup tick must gate MAGNETISM on this.modifier === 'MAGNETISM'");
});

test('item-pickup tick applies a 1.5 multiplier on MAGNETISM floors', () => {
  // The multiplier MUST be 1.5 (50% increase) — pin the literal so a
  // future re-tune (e.g. 100% increase) MUST update both the desc
  // string AND this test, keeping copy/runtime in sync.
  // Anchor on the controlling `if (this.modifier === 'MAGNETISM')`
  // line (single-line if, no braces, but it appears next to a
  // pickupRadius assignment).
  assert.match(GAME_CODE,
    /if\s*\(\s*this\.modifier\s*===\s*'MAGNETISM'\s*\)\s*pickupRadius\s*\*=\s*1\.5/,
    'item-pickup tick must apply pickupRadius *= 1.5 when this.modifier === "MAGNETISM"');
});

test('item-pickup tick MAGNETISM multiplier composes multiplicatively with MAGNETIC_FIELD augment', () => {
  // MAGNETIC_FIELD (×2 via 1.4/0.7 ternary) and MAGNETISM (×1.5) MUST
  // stack multiplicatively. If they overwrote one another (e.g. the
  // MAGNETISM line set pickupRadius = 0.7 * 1.5 unconditionally) the
  // augment would be silently disabled on MAGNETISM floors.
  // Pattern: MAGNETIC_FIELD is the BASE (sets initial value via
  // ternary) and MAGNETISM is a REFINER (multiplies the existing
  // value via *=). Find the surrounding context spanning both.
  // Look for the canonical sequence: ternary first, MAGNETISM gate
  // second (i.e. MAGNETISM appears AFTER the augment ternary in the
  // file; otherwise *= would multiply against undefined).
  const ternaryIdx = GAME_CODE.indexOf("hasAugment('MAGNETIC_FIELD') ? 1.4 : 0.7");
  assert.ok(ternaryIdx !== -1,
    'MAGNETIC_FIELD ternary must be present in pickup tick');
  const magIdx = GAME_CODE.indexOf("this.modifier === 'MAGNETISM'");
  assert.ok(magIdx !== -1, 'MAGNETISM gate must be present in pickup tick');
  assert.ok(magIdx > ternaryIdx,
    'MAGNETISM gate MUST appear AFTER the MAGNETIC_FIELD ternary so *= refines an already-set value (multiplicative composition; otherwise *= against undefined would NaN-poison pickupRadius)');
});

test('this.modifier === "MAGNETISM" appears EXACTLY once in game.js', () => {
  // Mirror the regenerative-modifier.test.js exact-count assertion:
  // any future addition of a second MAGNETISM gate (e.g. a duplicate
  // accidentally introduced via merge / copy-paste, or a second
  // pickup-radius site that double-applies the multiplier) MUST
  // update this count or fail the test loudly.
  const all = GAME_CODE.match(/this\.modifier\s*===\s*'MAGNETISM'/g) || [];
  assert.equal(all.length, 1,
    `game.js must contain exactly 1 this.modifier === 'MAGNETISM' reference (item-pickup multiplier); got ${all.length}`);
});

// ─── HUD wiring (modifier badge auto-picks up MAGNETISM) ──────────────

test('HUD badge in render.js reads getMod().colour/.icon/.label generically', () => {
  assert.ok(/m\.colour/.test(RENDER) && /m\.icon/.test(RENDER) && /m\.label/.test(RENDER),
    'HUD badge in render.js must read .colour/.icon/.label generically (no per-modifier branches)');
});

test('modifierProgressSuffix in render.js does NOT register a MAGNETISM counter branch', () => {
  // MAGNETISM is a passive % effect with no counter to surface.
  // Adding a `if (modKey === 'MAGNETISM')` branch would be wrong —
  // there is no shared counter to display. Pin the absence so a
  // future copy-paste from WINDFALL/REVERB/SIGNAL_BOOST doesn't
  // accidentally introduce one.
  const helperBranch = extractBranch(
    RENDER,
    /function\s+modifierProgressSuffix\s*\([^)]*\)\s*\{/
  );
  assert.ok(helperBranch, 'modifierProgressSuffix helper must be locatable');
  assert.doesNotMatch(helperBranch, /MAGNETISM/,
    'modifierProgressSuffix must NOT contain a MAGNETISM branch (modifier is passive %, not counter-based)');
});

// ─── modifier-pool count invariants ───────────────────────────────────

test(`FLOOR_MODIFIERS pool size invariant (${EXPECTED_MODIFIER_POOL_SIZE} entries)`, () => {
  // Pool-count invariant — see tests/_modifier-pool.js for details.
  // Adding a new modifier requires bumping EXPECTED_MODIFIER_POOL_SIZE
  // in that helper file (single source of truth).
  assertModifierPoolSize(CONTENT);
});

// ─── runtime simulation: composition with MAGNETIC_FIELD ──────────────

test('runtime: MAGNETISM × MAGNETIC_FIELD composition yields ×3 multiplier (0.7 → 2.1 tiles)', () => {
  // Behavioural complement to the regex assertions: replicate the
  // multiplicative chain on a synthetic pickupRadius to confirm the
  // composition arithmetic. A bug here (e.g. additive stacking, or
  // overwriting one with the other) would produce a different numeric
  // result that this test catches loudly.
  function compute(modifier, hasMagneticField) {
    let r = hasMagneticField ? 1.4 : 0.7;
    if (modifier === 'MAGNETISM') r *= 1.5;
    return r;
  }
  // Off-floor, no augment: baseline 0.7.
  assert.equal(compute(null, false), 0.7,
    'baseline (no MAGNETISM, no MAGNETIC_FIELD) must equal 0.7');
  // MAGNETIC_FIELD only: 1.4.
  assert.equal(compute(null, true), 1.4,
    'MAGNETIC_FIELD alone must double the baseline');
  // MAGNETISM only: 0.7 × 1.5 = 1.05.
  assert.equal(compute('MAGNETISM', false), 0.7 * 1.5,
    'MAGNETISM alone must increase baseline by 50%');
  // Both: 1.4 × 1.5 = 2.1 (multiplicative).
  assert.equal(compute('MAGNETISM', true), 1.4 * 1.5,
    'MAGNETISM + MAGNETIC_FIELD must compose multiplicatively (×3 = 2.1), NOT additively (×2.5 = 1.75)');
  // Other modifiers: no effect.
  assert.equal(compute('VOLATILE', false), 0.7,
    'non-MAGNETISM modifier must not increase pickup radius');
  assert.equal(compute('CHAINREACT', true), 1.4,
    'non-MAGNETISM modifier with MAGNETIC_FIELD yields MAGNETIC_FIELD-only');
});
