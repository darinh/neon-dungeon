'use strict';
// KINETIC floor modifier — the 23rd entry in the FLOOR_MODIFIERS pool
// and the 12th positive modifier (tipping the balance from 11/11 to
// 12 positive / 11 negative-or-neutral). KINETIC fills the previously
// empty "pure mobility" category — no other modifier in the pool
// touches dash cooldown or move speed.
//
// Wired in the dash-activation block of Player.update() in
// entities.js as a passive multiplier composed into the existing
// dash-cooldown chain:
//   this.dashCooldown = baseCd * metaMul * kineticMul
// where:
//   - baseCd = 0.75 (DASH_MASTER perk) | 1.5 (default)
//   - metaMul = (this.metaFlags && this.metaFlags.dashCooldownMul) || 1
//             — meta-progression cooldown buff (cross-run)
//   - kineticMul = ×0.7 when _EG.modifier === 'KINETIC' on this floor
//
// Per stored memory 'positive floor modifiers', floor modifiers are
// mutually exclusive per floor (only one rolls), so KINETIC + AUTONOMY
// (the other cooldown modifier, hackware-side) cannot co-occur — but
// the multiplicative chain is the canonical compose order for any
// future stacking design.
//
// content.js / entities.js are browser-only (no UMD/CommonJS exports),
// so these tests assert structural invariants any working KINETIC
// modifier must satisfy:
//   - Registry shape (label/desc/colour/icon) so MODIFIER_KEYS picks
//     it up and the HUD badge in render.js renders correctly.
//   - KINETIC is a top-level key inside FLOOR_MODIFIERS (so MODIFIER_KEYS
//     includes it via Object.keys — same defence as prior modifiers).
//   - The dash-cooldown gate `_EG.modifier === 'KINETIC'` reads the
//     canonical engine floor-modifier ref AND the multiplier (0.7,
//     NOT 0.75, NOT 0.8) sits inside the multiplicative chain, NOT
//     additively or as a clamp.
//   - Exactly-once invariant on `_EG.modifier === 'KINETIC'` (mirrors
//     the magnetism / regenerative / hardened / overflow exact-count
//     gates) — defends against accidental duplication.
//   - Pool-count invariant (23 entries — bumps from OVERFLOW's 22 via
//     EXPECTED_MODIFIER_POOL_SIZE in tests/_modifier-pool.js).
//   - Distinct desc (no collision with similar mobility/cooldown wording).
//   - kineticMul multiplies INTO the existing chain at the dash-CD
//     set site (not into the tick-down loop, which would amplify
//     decay rate; not at init, which is a one-shot reset to 0).
//
// NO save/restore tests: KINETIC is a pure passive multiplier applied
// at dash-activation time. Mirrors HARDENED / AUTONOMY / OVERFLOW /
// MAGNETISM.
//
// NO HUD progress suffix tests: passive % effect with no counter.
// A regression test (modifierProgressSuffix does NOT contain a KINETIC
// branch) defends against accidental copy-paste from counter-based
// modifiers.
//
// Pattern lifted from tests/overflow-modifier.test.js.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertModifierPoolSize, assertModifierIsTopLevelKey, EXPECTED_MODIFIER_POOL_SIZE } = require('./_modifier-pool');
const { readSourceFile, stripJsComments } = require('./_source-files.js');

const CONTENT = readSourceFile(__dirname, 'content');
const ENTITIES = readSourceFile(__dirname, 'entities');
const RENDER = readSourceFile(__dirname, 'render');
const ENTITIES_CODE = stripJsComments(ENTITIES);

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

test('KINETIC is registered in FLOOR_MODIFIERS with label/desc/colour/icon', () => {
  const entry = extractEntry(CONTENT, /KINETIC:/);
  assert.ok(entry, 'KINETIC entry must be locatable in FLOOR_MODIFIERS');
  assert.match(entry, /label:\s*'KINETIC'/,
    "KINETIC must carry label:'KINETIC'");
  assert.match(entry, /desc:\s*'[^']+'/,
    'KINETIC must carry a non-empty desc string');
  assert.match(entry, /colour:\s*'#[0-9a-fA-F]+'/,
    'KINETIC must carry a hex colour');
  assert.match(entry, /icon:\s*'[^']+'/,
    'KINETIC must carry an icon glyph');
});

test('KINETIC is a top-level key inside FLOOR_MODIFIERS (so MODIFIER_KEYS picks it up)', () => {
  assertModifierIsTopLevelKey(CONTENT, 'KINETIC');
});

test('KINETIC desc mentions dash (so the run-start card tells the player what they get)', () => {
  // The run-start floor-modifier card shows desc verbatim. A modifier
  // that doesn't tell the player what it does makes the cooldown buff
  // feel arbitrary on the next dash. Pin the dash keyword (case-insensitive
  // — "Dash" or "dash" both acceptable in flavour text).
  const entry = extractEntry(CONTENT, /KINETIC:/);
  assert.ok(entry, 'KINETIC entry must be locatable');
  assert.match(entry, /dash/i,
    'KINETIC desc must mention dash (case-insensitive) so the player understands what the modifier does');
});

test('KINETIC desc does not collide with AUTONOMY (hackware) phrasing', () => {
  // AUTONOMY is the other cooldown-reduction modifier (hackware side).
  // A KINETIC desc that reads "cooldowns reduced" would collide on the
  // run-start card and be indistinguishable at a glance. Pin that
  // KINETIC's desc names "dash" specifically so the two passive
  // cooldown buffs read distinctly. Mirrors the FORTIFIED-vs-HARDENED
  // "Reinforced" guard in hardened-modifier.test.js.
  const entry = extractEntry(CONTENT, /KINETIC:/);
  assert.ok(entry, 'KINETIC entry must be locatable');
  assert.doesNotMatch(entry, /[Hh]ackware/,
    'KINETIC desc must not mention "hackware" — AUTONOMY already owns that domain.');
});

test('FLOOR_MODIFIERS pool size invariant (KINETIC is registered)', () => {
  // Roll-probability invariant. EXPECTED_MODIFIER_POOL_SIZE in
  // tests/_modifier-pool.js is the single source of truth. The literal
  // "23 (KINETIC added)" canary previously here was retired when
  // PRIMED (the next modifier) took over the canary role — this
  // assertion now just confirms the pool count matches whatever the
  // helper says, which still detects accidental dict shrinkage.
  assertModifierPoolSize(CONTENT);
});

// ─── Player dash-activation wiring ───────────────────────────────────────

test('Player dash-activation composes the KINETIC multiplier into the dashCooldown chain', () => {
  // Pin the EXACT wiring: the gate must read the canonical _EG.modifier
  // ref, the multiplier must be 0.7 (NOT 0.75, NOT 0.8), and it must be
  // multiplied INTO the existing chain (not added, not clamped). The
  // full match verifies the chain shape: baseCd * metaMul * kineticMul.
  const m = ENTITIES_CODE.match(
    /const\s+kineticMul\s*=\s*\(?\s*_EG\.modifier\s*===\s*'KINETIC'\s*\)?\s*\?\s*0\.7\s*:\s*1\s*;[\s\S]{0,300}?this\.dashCooldown\s*=\s*baseCd\s*\*\s*\(\(this\.metaFlags\s*&&\s*this\.metaFlags\.dashCooldownMul\)\s*\|\|\s*1\)\s*\*\s*kineticMul\s*;/
  );
  assert.ok(m,
    'Player.update dash branch must declare `const kineticMul = (_EG.modifier === "KINETIC") ? 0.7 : 1;` AND multiply the existing dashCooldown chain by kineticMul — gate, ratio, and compose order must all be present.');
});

test('KINETIC multiplier uses 0.7 (NOT 0.75, NOT 0.8)', () => {
  // The chosen multiplier of 0.7 (-30%) is a deliberate +5% step over
  // AUTONOMY's 0.75 (-25% hackware) — dash CD is a tactical, situational
  // resource (i-frames + repositioning) rather than always-on like
  // hackware or HARDENED defense, so a slightly stronger reduction
  // keeps the modifier feeling impactful without being run-defining.
  // 0.8 would be too weak to feel against the 1.5s base; 0.5 would
  // outshine DASH_MASTER itself. Keep 0.7. This guard catches accidental
  // tuning drift in either direction.
  const block = ENTITIES_CODE.match(
    /_EG\.modifier\s*===\s*'KINETIC'[\s\S]{0,100}?\?\s*([\d.]+)\s*:/
  );
  assert.ok(block, 'KINETIC multiplier expression not found in dash branch');
  assert.equal(block[1], '0.7',
    `KINETIC multiplier must be 0.7 (-30%); found ${block[1]}.`);
});

test('KINETIC is referenced exactly once in entities.js', () => {
  // Defends against accidental duplication (copy-paste could
  // double-apply the gate, producing 0.49× cooldown). Mirrors the
  // magnetism / regenerative / hardened / overflow exactly-once
  // invariant.
  const matches = ENTITIES_CODE.match(/_EG\.modifier\s*===\s*'KINETIC'/g) || [];
  assert.equal(matches.length, 1,
    `KINETIC modifier check must appear exactly once in entities.js (Player dash-activation gate). Found ${matches.length}. Duplicate gates would compound the multiplier (×0.49 instead of ×0.7).`);
});

test('KINETIC multiplier is wired at the dashCooldown SET site, not the tick-down or init', () => {
  // The dash-cooldown lifecycle has three sites in entities.js:
  //   1. init (this.dashCooldown=0 in constructor) — irrelevant; CD
  //      starts at 0 anyway and KINETIC has nothing to multiply.
  //   2. tick-down (this.dashCooldown=Math.max(0,this.dashCooldown-dt))
  //      — wiring KINETIC here would multiply the DECAY RATE, not
  //      the cooldown itself, producing a different (and wrong)
  //      effect: a faster-than-realtime countdown rather than a
  //      smaller starting value. Worse, the math (max with 0) would
  //      no longer behave correctly with a fractional kineticMul on
  //      `dt`.
  //   3. set on dash trigger (this.dashCooldown=baseCd*metaMul) —
  //      the canonical site. Wiring KINETIC here applies the buff
  //      ONCE per dash to the starting cooldown value, which is
  //      what the modifier semantics demand.
  // Pin that the KINETIC reference appears immediately above (or
  // adjacent to) a dashCooldown ASSIGNMENT including baseCd, not
  // a dashCooldown DECREMENT or initialization.
  const kineticContext = ENTITIES_CODE.match(
    /_EG\.modifier\s*===\s*'KINETIC'[\s\S]{0,200}?this\.dashCooldown\s*=\s*baseCd/
  );
  assert.ok(kineticContext,
    'KINETIC gate must be co-located with the canonical dashCooldown=baseCd*... SET site, not the init or tick-down. Wiring at the wrong site would multiply decay rate or do nothing.');
});

// ─── HUD render.js: NO progress suffix (passive % effect) ────────────────

test('modifierProgressSuffix does NOT include KINETIC (passive, no counter)', () => {
  // Mirrors AUTONOMY / MAGNETISM / HARDENED / OVERFLOW. KINETIC has no
  // per-run counter to surface in the HUD progress field — it's an
  // always-on passive multiplier. A copy-paste from a counter-based
  // modifier (e.g. OVERCHARGE 4/5, REVERB 4/5, CHAINREACT N/M) would
  // add a phantom progress readout that never advances. Defends against
  // that.
  const fnMatch = RENDER.match(/function\s+modifierProgressSuffix\b[\s\S]*?\n\}/);
  if (!fnMatch) {
    assert.fail('modifierProgressSuffix function not found in render.js — anchor regression?');
  }
  assert.doesNotMatch(fnMatch[0], /KINETIC/,
    'modifierProgressSuffix must NOT contain a KINETIC branch — KINETIC has no progress counter (passive % effect, mirrors AUTONOMY/MAGNETISM/HARDENED/OVERFLOW).');
});
