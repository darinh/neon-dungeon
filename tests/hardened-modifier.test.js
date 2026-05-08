'use strict';
// HARDENED floor modifier — first DEFENSIVE positive modifier in the
// FLOOR_MODIFIERS pool. All 9 prior positive modifiers (CASCADE,
// OVERCHARGE, WINDFALL, SIGNAL_BOOST, REVERB, QUARTERMASTER, AUTONOMY,
// CHAINREACT, MAGNETISM) are offensive / economy / uptime. HARDENED
// fills the gap with a passive 20% incoming-damage reduction
// (Player.takeDamage multiplier ×0.8) — the defensive mirror to
// FRAGILE (×1.3) and CORROSIVE (+2 flat).
//
// Wired in Player.takeDamage AFTER the offensive amps (CORROSIVE /
// FRAGILE / HUNTER) so the reduction composes on the post-amp value.
// Mathematically this is irrelevant in practice — floor modifiers are
// mutually exclusive per floor (only one rolls), so HARDENED + FRAGILE
// can't co-occur — but the order keeps the contract documented and
// ready for any future stacking design.
//
// content.js / entities.js are browser-only (no UMD/CommonJS exports),
// so these tests assert structural invariants any working HARDENED
// modifier must satisfy:
//   - Registry shape (label/desc/colour/icon) so MODIFIER_KEYS picks
//     it up and the HUD badge in render.js renders correctly.
//   - HARDENED is a top-level key inside FLOOR_MODIFIERS (so MODIFIER_KEYS
//     includes it via Object.keys — same defence as the prior positive
//     modifiers).
//   - The takeDamage gate `_EG.modifier === 'HARDENED' && !options.ignoreDefense`
//     reads the canonical engine floor-modifier ref AND respects the
//     env-DoT-damage-gate rule (Plasma/Toxic/ArcGrid/etc. pass
//     ignoreDefense:true with sub-1 fractional damage; without the gate
//     the Math.max(1, Math.round(...)) would inflate them to 1/frame =
//     ~60 DPS instakill).
//   - The 0.8 multiplier (NOT 0.7, NOT 0.85) — the chosen value is
//     defensively meaningful but not run-defining.
//   - Math.max(1, ...) preserves the direct-hit minimum-1 contract.
//   - Pool-count invariant (21 entries — bumps from MAGNETISM's 20 via
//     EXPECTED_MODIFIER_POOL_SIZE in tests/_modifier-pool.js).
//   - Exactly-once invariant on _EG.modifier === 'HARDENED' (mirrors
//     the magnetism / regenerative exact-count gates) — defends against
//     accidental duplication.
//   - Distinct from FORTIFIED (which uses the word "Reinforced" in its
//     desc — the chosen "Reactive plating" desc avoids any visual
//     collision in the run-start floor-modifier card).
//
// NO save/restore tests: HARDENED is a pure passive multiplier applied
// at takeDamage time. There is no per-run counter or per-player flag
// to persist. Mirrors AUTONOMY / MAGNETISM (also passive % effects).
//
// NO HUD progress suffix tests: HARDENED is a passive % effect with
// no counter to surface. Mirrors AUTONOMY / MAGNETISM. A regression
// test (modifierProgressSuffix does NOT contain a HARDENED branch)
// defends against accidental copy-paste from counter-based modifiers.
//
// Pattern lifted from tests/magnetism-modifier.test.js (per stored
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
const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
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

test('HARDENED is registered in FLOOR_MODIFIERS with label/desc/colour/icon', () => {
  const entry = extractEntry(CONTENT, /HARDENED:/);
  assert.ok(entry, 'HARDENED entry must be locatable in FLOOR_MODIFIERS');
  assert.match(entry, /label:\s*'HARDENED'/,
    "HARDENED must carry label:'HARDENED'");
  assert.match(entry, /desc:\s*'[^']+'/,
    'HARDENED must carry a non-empty desc string');
  assert.match(entry, /colour:\s*'#[0-9a-fA-F]+'/,
    'HARDENED must carry a hex colour');
  assert.match(entry, /icon:\s*'[^']+'/,
    'HARDENED must carry an icon glyph');
});

test('HARDENED is a top-level key inside FLOOR_MODIFIERS (so MODIFIER_KEYS picks it up)', () => {
  assertModifierIsTopLevelKey(CONTENT, 'HARDENED');
});

test('HARDENED desc avoids "Reinforced" wording (FORTIFIED already owns it)', () => {
  // FORTIFIED desc is 'Reinforced patrols' — a HARDENED desc that also
  // used the word "Reinforced" would create visual collision in the
  // run-start floor-modifier card and confuse the negative/positive
  // distinction. The chosen desc "Reactive plating" reads as protective
  // armoring without colliding with the FORTIFIED naming.
  const entry = extractEntry(CONTENT, /HARDENED:/);
  assert.ok(entry, 'HARDENED entry must be locatable');
  assert.doesNotMatch(entry, /[Rr]einforced/,
    'HARDENED desc must avoid "Reinforced" — FORTIFIED already owns that wording. Use "Reactive plating" or similar protective-armor language.');
});

test('FLOOR_MODIFIERS pool size invariant (HARDENED is registered)', () => {
  // Roll-probability invariant. EXPECTED_MODIFIER_POOL_SIZE in
  // tests/_modifier-pool.js is the single source of truth. The literal
  // "21 (HARDENED added)" canary previously here was retired when
  // OVERFLOW (the next modifier) took over the canary role — this
  // assertion now just confirms the pool count matches whatever the
  // helper says, which still detects accidental dict shrinkage.
  assertModifierPoolSize(CONTENT);
});

// ─── Player.takeDamage wiring ────────────────────────────────────────────

test('Player.takeDamage applies HARDENED multiplier with correct gate', () => {
  // Match the full HARDENED block. The gate MUST include `!options.ignoreDefense`
  // (env-DoT-damage-gate rule — without it, sub-1 fractional damage from
  // Plasma / Toxic / Arc Grid / etc. would inflate to 1/frame via Math.max(1,
  // Math.round(...)) producing ~60 DPS instakill at 60 FPS). Mirrors the
  // CORROSIVE / FRAGILE / HUNTER gate pattern in the same method.
  const m = ENTITIES_CODE.match(
    /if\s*\(\s*_EG\.modifier\s*===\s*'HARDENED'\s*&&\s*!options\.ignoreDefense\s*\)\s*\{[\s\S]{0,200}?actual\s*=\s*Math\.max\s*\(\s*1\s*,\s*Math\.round\s*\(\s*actual\s*\*\s*0\.8\s*\)\s*\)\s*;[\s\S]{0,40}?\}/
  );
  assert.ok(m,
    'Player.takeDamage must include `if (_EG.modifier === "HARDENED" && !options.ignoreDefense) { actual = Math.max(1, Math.round(actual * 0.8)); }` — gate, multiplier, and Math.max(1, ...) floor-clamp must all be present.');
});

test('HARDENED multiplier uses 0.8 (NOT 0.7, NOT 0.85)', () => {
  // The chosen multiplier of 0.8 is design-intentional: defensively
  // meaningful (-20% on every hit) but not run-defining. 0.7 (-30%) would
  // outshine BULWARK perk's 0.85 (-15%) for a passive floor effect that
  // requires no perk pick; 0.85 would be too weak to feel. Keep 0.8.
  // This guard catches accidental tuning drift in either direction.
  const hardenedBlock = ENTITIES_CODE.match(
    /_EG\.modifier\s*===\s*'HARDENED'[\s\S]{0,300}?actual\s*\*\s*([\d.]+)/
  );
  assert.ok(hardenedBlock, 'HARDENED multiplier expression not found in takeDamage');
  assert.equal(hardenedBlock[1], '0.8',
    `HARDENED multiplier must be 0.8 (-20%); found ${hardenedBlock[1]}. If retuning, update both the constant and this assertion AND document the rationale (BULWARK perk is 0.85 for context).`);
});

test('HARDENED is referenced exactly once in entities.js takeDamage region', () => {
  // Defends against accidental duplication (copy-paste from CORROSIVE /
  // FRAGILE / HUNTER could double-apply the gate). Mirrors the magnetism
  // / regenerative exactly-once invariant.
  const matches = ENTITIES_CODE.match(/_EG\.modifier\s*===\s*'HARDENED'/g) || [];
  assert.equal(matches.length, 1,
    `HARDENED modifier check must appear exactly once in entities.js (Player.takeDamage gate). Found ${matches.length}. Duplicate gates would double-apply the multiplier.`);
});

test('HARDENED block sits AFTER the offensive amp blocks (CORROSIVE/FRAGILE/HUNTER)', () => {
  // Ordering invariant: offensive amps modify `actual` upward, then
  // HARDENED modifies it downward. With mutual-exclusivity per floor
  // this ordering is mathematically irrelevant today, but the contract
  // is documented and ready for any future stacking design. Reversing
  // the order would silently shift the runtime semantics.
  const hardenedIdx = ENTITIES_CODE.indexOf("_EG.modifier === 'HARDENED'");
  const corrosiveIdx = ENTITIES_CODE.indexOf("_EG.modifier === 'CORROSIVE'");
  const fragileIdx = ENTITIES_CODE.indexOf("_EG.modifier === 'FRAGILE'");
  const hunterIdx = ENTITIES_CODE.indexOf("_EG.modifier === 'HUNTER'");
  assert.ok(hardenedIdx > 0, 'HARDENED gate must exist');
  assert.ok(corrosiveIdx > 0, 'CORROSIVE gate must exist (anchor)');
  assert.ok(fragileIdx > 0, 'FRAGILE gate must exist (anchor)');
  assert.ok(hunterIdx > 0, 'HUNTER gate must exist (anchor)');
  assert.ok(hardenedIdx > corrosiveIdx,
    'HARDENED block must follow CORROSIVE in source order so the reduction composes on amplified damage.');
  assert.ok(hardenedIdx > fragileIdx,
    'HARDENED block must follow FRAGILE in source order so the reduction composes on amplified damage.');
  assert.ok(hardenedIdx > hunterIdx,
    'HARDENED block must follow HUNTER in source order so the reduction composes on amplified damage.');
});

// ─── HUD render.js: NO progress suffix (passive % effect) ────────────────

test('modifierProgressSuffix does NOT include HARDENED (passive, no counter)', () => {
  // Mirrors AUTONOMY / MAGNETISM. HARDENED has no per-run counter to
  // surface in the HUD progress field — it's an always-on passive
  // multiplier. A copy-paste from a counter-based modifier (e.g.
  // OVERCHARGE 4/5, REVERB 4/5, CHAINREACT N/M) would add a phantom
  // progress readout that never advances. Defends against that.
  const fnMatch = RENDER.match(/function\s+modifierProgressSuffix\b[\s\S]*?\n\}/);
  if (!fnMatch) {
    // If the function name changes, fail loudly so the test maintainer
    // updates both the anchor and the assertion intentionally.
    assert.fail('modifierProgressSuffix function not found in render.js — anchor regression?');
  }
  assert.doesNotMatch(fnMatch[0], /HARDENED/,
    'modifierProgressSuffix must NOT contain a HARDENED branch — HARDENED has no progress counter (passive % effect, mirrors AUTONOMY/MAGNETISM).');
});
