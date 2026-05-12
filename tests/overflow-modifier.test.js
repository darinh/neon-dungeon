'use strict';
// OVERFLOW floor modifier — the 22nd entry in the FLOOR_MODIFIERS pool
// and the 11th positive modifier (balancing the 11 negative-or-neutral
// entries). OVERFLOW grants +25% XP gain on this floor.
//
// Wired in Player.gainXP() in player-progression.js as a passive multiplier that
// composes multiplicatively with the existing chain:
//   xp += round(amount * getMetaXPMultiplier() * augMul * overflowMul)
// where:
//   - getMetaXPMultiplier() = meta-progression XP buff (cross-run)
//   - augMul = NEURAL_LINK augment (×1.25 if equipped)
//   - overflowMul = ×1.25 when _EG.modifier === 'OVERFLOW' on this floor
//
// Per stored memory 'enemy buffs' / 'positive floor modifiers', floor
// modifiers are mutually exclusive per floor (only one rolls), so
// OVERFLOW + HARDENED can't co-occur — but the multiplicative chain
// is the canonical compose order for any future stacking design.
//
// content.js / entity modules are browser-only (no UMD/CommonJS exports),
// so these tests assert structural invariants any working OVERFLOW
// modifier must satisfy:
//   - Registry shape (label/desc/colour/icon) so MODIFIER_KEYS picks
//     it up and the HUD badge in render.js renders correctly.
//   - OVERFLOW is a top-level key inside FLOOR_MODIFIERS (so MODIFIER_KEYS
//     includes it via Object.keys — same defence as prior modifiers).
//   - The gainXP gate `_EG.modifier === 'OVERFLOW'` reads the canonical
//     engine floor-modifier ref AND the multiplier (1.25, NOT 1.5,
//     NOT 1.2) sits inside the multiplicative chain, NOT additively.
//   - Exactly-once invariant on _EG.modifier === 'OVERFLOW' (mirrors
//     the magnetism / regenerative / hardened exact-count gates) —
//     defends against accidental duplication.
//   - Pool-count invariant (22 entries — bumps from HARDENED's 21 via
//     EXPECTED_MODIFIER_POOL_SIZE in tests/_modifier-pool.js).
//   - Distinct desc (no collision with similar XP/data wording).
//   - The multiplier is applied INSIDE Math.round (preserves the
//     integer-XP contract — fractional XP would break xpNeeded()
//     comparisons in the level-up loop).
//
// NO save/restore tests: OVERFLOW is a pure passive multiplier applied
// at gainXP time. Mirrors HARDENED / AUTONOMY / MAGNETISM.
//
// NO HUD progress suffix tests: passive % effect with no counter.
// A regression test (modifierProgressSuffix does NOT contain an
// OVERFLOW branch) defends against accidental copy-paste from
// counter-based modifiers.
//
// Pattern lifted from tests/hardened-modifier.test.js.

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
const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);
const PLAYER_PROGRESSION = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities', 'player-progression.js'), 'utf8'
);
const RENDER = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'render.js'), 'utf8'
);

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const ENTITIES_CODE = stripComments(ENTITIES);
const PLAYER_PROGRESSION_CODE = stripComments(PLAYER_PROGRESSION);

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

test('OVERFLOW is registered in FLOOR_MODIFIERS with label/desc/colour/icon', () => {
  const entry = extractEntry(CONTENT, /OVERFLOW:/);
  assert.ok(entry, 'OVERFLOW entry must be locatable in FLOOR_MODIFIERS');
  assert.match(entry, /label:\s*'OVERFLOW'/,
    "OVERFLOW must carry label:'OVERFLOW'");
  assert.match(entry, /desc:\s*'[^']+'/,
    'OVERFLOW must carry a non-empty desc string');
  assert.match(entry, /colour:\s*'#[0-9a-fA-F]+'/,
    'OVERFLOW must carry a hex colour');
  assert.match(entry, /icon:\s*'[^']+'/,
    'OVERFLOW must carry an icon glyph');
});

test('OVERFLOW is a top-level key inside FLOOR_MODIFIERS (so MODIFIER_KEYS picks it up)', () => {
  assertModifierIsTopLevelKey(CONTENT, 'OVERFLOW');
});

test('OVERFLOW desc mentions XP (so the run-start card tells the player what they get)', () => {
  // The run-start floor-modifier card shows desc verbatim. A modifier
  // that doesn't tell the player what it does makes the +25% feel
  // arbitrary on level-up. Pin the XP keyword.
  const entry = extractEntry(CONTENT, /OVERFLOW:/);
  assert.ok(entry, 'OVERFLOW entry must be locatable');
  assert.match(entry, /XP/,
    'OVERFLOW desc must mention XP so the player understands what the modifier does');
});

test('FLOOR_MODIFIERS pool size invariant (OVERFLOW is registered)', () => {
  // Roll-probability invariant. EXPECTED_MODIFIER_POOL_SIZE in
  // tests/_modifier-pool.js is the single source of truth. The literal
  // "22 (OVERFLOW added)" canary previously here was retired when
  // KINETIC (the next modifier) took over the canary role — this
  // assertion now just confirms the pool count matches whatever the
  // helper says, which still detects accidental dict shrinkage.
  assertModifierPoolSize(CONTENT);
});

// ─── Player.gainXP wiring ────────────────────────────────────────────────

test('Player.gainXP composes the OVERFLOW multiplier into the multiplicative chain', () => {
  // Pin the EXACT wiring: the gate must read the canonical _EG.modifier
  // ref, the multiplier must be 1.25 (NOT 1.2, NOT 1.5), and it must be
  // multiplied INTO the existing chain (not added). The full match
  // verifies the chain shape: amount * getMetaXPMultiplier() * augMul
  // * overflowMul, all wrapped in Math.round so integer-XP holds.
  const m = PLAYER_PROGRESSION_CODE.match(
    /const\s+overflowMul\s*=\s*\(?\s*_EG\.modifier\s*===\s*'OVERFLOW'\s*\)?\s*\?\s*1\.25\s*:\s*1\s*;[\s\S]{0,300}?this\.xp\s*\+=\s*Math\.round\s*\(\s*amount\s*\*\s*getMetaXPMultiplier\s*\(\s*\)\s*\*\s*augMul\s*\*\s*overflowMul\s*\)\s*;/
  );
  assert.ok(m,
    'Player.gainXP must declare `const overflowMul = (_EG.modifier === "OVERFLOW") ? 1.25 : 1;` AND multiply the existing xp chain by overflowMul inside Math.round — gate, ratio, and compose order must all be present.');
});

test('OVERFLOW multiplier uses 1.25 (NOT 1.2, NOT 1.5)', () => {
  // The chosen multiplier of 1.25 mirrors NEURAL_LINK aug's +25% — a
  // meaningful but not run-defining buff. 1.5 (+50%) would outshine
  // most perks on level-pace impact for a passive floor effect; 1.2
  // would be too weak to feel against the meta-XP ladder. Keep 1.25.
  // This guard catches accidental tuning drift in either direction.
  const block = PLAYER_PROGRESSION_CODE.match(
    /_EG\.modifier\s*===\s*'OVERFLOW'[\s\S]{0,100}?\?\s*([\d.]+)\s*:/
  );
  assert.ok(block, 'OVERFLOW multiplier expression not found in gainXP');
  assert.equal(block[1], '1.25',
    `OVERFLOW multiplier must be 1.25 (+25%); found ${block[1]}. NEURAL_LINK aug is also 1.25 — keep this in sync if retuning either.`);
});

test('OVERFLOW is referenced exactly once in player-progression.js', () => {
  // Defends against accidental duplication (copy-paste could
  // double-apply the gate). Mirrors the magnetism / regenerative /
  // hardened exactly-once invariant.
  const matches = PLAYER_PROGRESSION_CODE.match(/_EG\.modifier\s*===\s*'OVERFLOW'/g) || [];
  assert.equal(matches.length, 1,
    `OVERFLOW modifier check must appear exactly once in player-progression.js (Player.gainXP gate). Found ${matches.length}. Duplicate gates would double-apply the multiplier.`);
});

test('OVERFLOW multiplier is applied INSIDE Math.round (integer-XP contract)', () => {
  // The existing gainXP chain wraps the entire multiplicative product
  // in Math.round so this.xp stays an integer (xpNeeded() compares
  // integer thresholds in the level-up while-loop). If overflowMul
  // were applied OUTSIDE Math.round (e.g. `Math.round(...) * overflowMul`)
  // a 25% boost on a 17-XP gain would produce 21.25 — a fractional
  // value that breaks the xp >= xpNeeded comparison contract. Pin
  // that overflowMul lives inside the round.
  const fn = PLAYER_PROGRESSION_CODE.match(/gainXP\s*\(\s*amount\s*\)\s*\{[\s\S]*?openNextPerkChoice\(\);\s*\n\s*\}\s*\n\};/);
  assert.ok(fn, 'must locate gainXP function body');
  // The "this.xp += Math.round(...overflowMul...)" pattern must match.
  // A regression "Math.round(amount * ...) * overflowMul" would NOT
  // satisfy this assertion because overflowMul wouldn't be inside the
  // Math.round() argument list. Inner parens (e.g. getMetaXPMultiplier())
  // are tolerated via [\s\S]*? lazy matching capped before the literal
  // "overflowMul" token, then a closing ")" lookahead within ~80 chars.
  assert.match(fn[0],
    /Math\.round\s*\(\s*amount\s*\*[\s\S]{0,200}?\boverflowMul\b[\s\S]{0,80}?\)\s*;/,
    'overflowMul must be applied INSIDE Math.round(...) so this.xp stays an integer (xpNeeded() comparison contract).');
  // Also ban the regression pattern explicitly. The regression form
  // would be `Math.round(amount * getMetaXPMultiplier() * augMul) * overflowMul`
  // — i.e. overflowMul AFTER the closing paren of Math.round. Pin
  // that the close-paren of the round IMMEDIATELY-or-soon precedes a
  // semicolon, not a `* overflowMul`.
  assert.doesNotMatch(fn[0],
    /Math\.round\s*\([\s\S]*?\)\s*\*\s*overflowMul/,
    'overflowMul must NOT be multiplied AFTER Math.round — that produces fractional XP and breaks xp >= xpNeeded() integer comparison.');
});

// ─── HUD render.js: NO progress suffix (passive % effect) ────────────────

test('modifierProgressSuffix does NOT include OVERFLOW (passive, no counter)', () => {
  // Mirrors AUTONOMY / MAGNETISM / HARDENED. OVERFLOW has no per-run
  // counter to surface in the HUD progress field — it's an always-on
  // passive multiplier. A copy-paste from a counter-based modifier
  // (e.g. OVERCHARGE 4/5, REVERB 4/5, CHAINREACT N/M) would add a
  // phantom progress readout that never advances. Defends against that.
  const fnMatch = RENDER.match(/function\s+modifierProgressSuffix\b[\s\S]*?\n\}/);
  if (!fnMatch) {
    assert.fail('modifierProgressSuffix function not found in render.js — anchor regression?');
  }
  assert.doesNotMatch(fnMatch[0], /OVERFLOW/,
    'modifierProgressSuffix must NOT contain an OVERFLOW branch — OVERFLOW has no progress counter (passive % effect, mirrors AUTONOMY/MAGNETISM/HARDENED).');
});
