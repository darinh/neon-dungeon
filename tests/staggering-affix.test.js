'use strict';
// STAGGER 'of Staggering' weapon-affix suffix — source-text wiring tests.
//
// STAGGER is the second slow-on-hit suffix after FROST, but with a distinct
// rhythm: short slows (0.4s) gated by a per-enemy 0.5s ICD. The ICD is the
// whole point — without it, a rapid-fire weapon would chain identical
// 0.4s slows into a permanent 0.5x cripple, eclipsing FROST entirely. With
// the ICD, the effective sustained slow ceiling is roughly 0.4s @ 0.5x +
// 0.1s @ 1.0x per cycle (≈ 80% effective speed under uninterrupted DPS),
// vs FROST's flat 0.7x for 2s.
//
// content.js / entities.js are browser-only (no UMD/CommonJS exports), so
// we can't load applyHitEffects directly. These tests assert the
// structural invariants any working STAGGER suffix must satisfy:
// registry shape (slot/effect keyword), the on-hit gate
// (effects.includes('stagger') / `eff === 'stagger'`), the per-enemy ICD
// gate, the stronger-wins overlap with existing slows, the ICD set, and
// the per-frame ICD decay in Enemy.update.
//
// Each check fails loudly the moment a refactor drops a wire.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
);
const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);

// Strip /* ... */ and // ... comments so source-text regex assertions
// match against EXECUTABLE source, not commentary that incidentally
// quotes the gate token. Pattern from tests/{siphon,greedy,lucky,salvage,
// mark,deadly}-affix.test.js (per stored memory 'test regex pitfalls').
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const ENTITIES_CODE = stripComments(ENTITIES);
const CONTENT_CODE = stripComments(CONTENT);

// Brace-walked branch extraction: find the opener regex, then walk
// braces to the matching close. Used to scope absence-checks INSIDE a
// specific if/else branch so a regression in one branch isn't masked
// by similar text in a neighbouring branch. Pattern from
// tests/{execute,recoil,mark}-affix.test.js (per stored memory
// 'test source-text extraction').
/**
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

test('STAGGER is registered in WEAPON_AFFIXES as a suffix with effect:stagger', () => {
  // slot:'suffix' is critical — slot routes the affix through the on-hit
  // / on-kill effect path. A typo to 'prefix' would silently route into
  // the mod-loop in buildWeapon() and never reach the on-hit gate.
  // effect:'stagger' is the keyword applyHitEffects switches on; if it
  // diverges from the gate string the suffix becomes a cosmetic no-op.
  // The trailing `\s*\}` anchors the closing brace immediately after
  // effect:'stagger' — adding any other key (like a stray `mods:`) would
  // FAIL this match, locking the entry shape in.
  const re = /STAGGER:\s*\{\s*slot:\s*'suffix'\s*,\s*label:\s*'[^']+'\s*,\s*colour:\s*'#[0-9a-fA-F]+'\s*,\s*desc:\s*'[^']+'\s*,\s*effect:\s*'stagger'\s*\}/;
  assert.match(CONTENT, re,
    "STAGGER must be a suffix with label/colour/desc and effect:'stagger'");
});

test('STAGGER label is exactly "of Staggering"', () => {
  // Label is part of the player-facing identity contract — content.js
  // generated weapon names concatenate label, and the THE GAP archive
  // matches on full weapon name strings. Drift would silently break
  // those references.
  assert.match(CONTENT_CODE, /STAGGER:\s*\{[^}]*label:\s*'of Staggering'/,
    'STAGGER label must be exactly "of Staggering"');
});

test('applyHitEffects has a stagger branch gated on eff === "stagger"', () => {
  // The branch must match the per-eff pattern used by every other on-hit
  // suffix (burn/slow/leech/chain/shock/recoil/execute/mark/siphon/poison)
  // so the loop dispatches into it. A literal string match would pass on
  // a comment that quotes 'stagger' — strip comments first.
  assert.match(ENTITIES_CODE, /eff\s*===\s*'stagger'/,
    "applyHitEffects must have an `eff === 'stagger'` branch");
});

test('STAGGER branch lives inside applyHitEffects (not applyOnKill)', () => {
  // Per-hit affixes route through applyHitEffects. If a future refactor
  // accidentally moves the branch into applyOnKill, the slow would only
  // tick on KILLS — making STAGGER trivially worse than FROST in every
  // scenario. Anchor by checking the stagger gate appears BETWEEN the
  // applyHitEffects function declaration and the applyOnKill function
  // declaration. Same pattern as siphon-affix.test.js.
  const fxIdx = ENTITIES_CODE.indexOf('function applyHitEffects(');
  const okIdx = ENTITIES_CODE.indexOf('function applyOnKill(');
  const stIdx = ENTITIES_CODE.indexOf("eff === 'stagger'");
  assert.ok(fxIdx !== -1, 'applyHitEffects function must exist');
  assert.ok(okIdx !== -1, 'applyOnKill function must exist');
  assert.ok(stIdx !== -1, 'stagger branch must exist');
  assert.ok(stIdx > fxIdx && stIdx < okIdx,
    'STAGGER branch must live inside applyHitEffects, not applyOnKill');
});

test('STAGGER branch checks per-enemy _staggerICD and exits when > 0', () => {
  // The whole point of STAGGER is the ICD. Without the gate, rapid-fire
  // weapons would re-apply the 0.4s slow on every hit, producing a
  // permanent 0.5x cripple that eclipses FROST entirely. The gate must
  // read enemy._staggerICD with `|| 0` nucleation (so undefined is
  // treated as zero — matches the recoil/shock pattern), and `continue`
  // out of the for-loop iteration when it's positive. Use brace-walked
  // extraction so the assertion is scoped to JUST the stagger branch.
  const branch = extractBranch(ENTITIES_CODE, /else if\s*\(\s*eff\s*===\s*'stagger'\s*\)\s*\{/);
  assert.ok(branch, 'stagger branch must be extractable');
  assert.match(branch, /enemy\._staggerICD\s*\|\|\s*0/,
    'stagger branch must read enemy._staggerICD with `|| 0` nucleation');
  // The ICD gate must `continue` (skip the rest of the iteration) when
  // the ICD is still ticking. A `return` would abort the whole effects
  // loop (breaking subsequent multi-affix dispatch); a missing exit
  // would defeat the whole gate.
  assert.match(branch, /if\s*\(\s*icd\s*>\s*0\s*\)\s*continue/,
    'stagger branch must `continue` when ICD > 0');
});

test('STAGGER branch sets _staggerICD to 0.5 (locks the ICD duration)', () => {
  // The sustained-DPS effective slow ceiling depends on the ICD/duration
  // ratio: 0.4s slow + 0.1s recovery per 0.5s cycle ≈ 80% effective speed.
  // Drifting the ICD shorter (e.g., 0.3s) would push the effective ceiling
  // toward FROST (0.7x) and eclipse FROST's design contract; longer (e.g.,
  // 1.0s) would make STAGGER feel undertuned vs FROST. Lock the value.
  const branch = extractBranch(ENTITIES_CODE, /else if\s*\(\s*eff\s*===\s*'stagger'\s*\)\s*\{/);
  assert.ok(branch);
  assert.match(branch, /enemy\._staggerICD\s*=\s*0\.5/,
    'stagger branch must set _staggerICD = 0.5');
});

test('STAGGER uses stronger-wins overlap with existing slows', () => {
  // The canonical pattern (STATIC_FIELD at content.js:~1273) is:
  //   e.slowTimer  = Math.max(e.slowTimer  || 0, <new dur>);
  //   e.slowFactor = Math.min(e.slowFactor || 1, <new factor>);
  // This ensures a STAGGER hit during an existing FROST slow doesn't
  // truncate the FROST timer (Math.max), AND applies STAGGER's stronger
  // 0.5x factor (Math.min) for the remainder. Anything else — straight
  // assignment, or Math.min on the timer — would be a regression.
  const branch = extractBranch(ENTITIES_CODE, /else if\s*\(\s*eff\s*===\s*'stagger'\s*\)\s*\{/);
  assert.ok(branch);
  assert.match(branch, /enemy\.slowTimer\s*=\s*Math\.max\(\s*enemy\.slowTimer\s*\|\|\s*0\s*,\s*0\.4\s*\)/,
    'stagger must use Math.max for slowTimer (stronger-wins, never truncates a longer existing slow)');
  assert.match(branch, /enemy\.slowFactor\s*=\s*Math\.min\(\s*enemy\.slowFactor\s*\|\|\s*1\s*,\s*0\.5\s*\)/,
    'stagger must use Math.min for slowFactor (stronger-wins, applies 0.5x if it beats current)');
});

test('STAGGER skips phased mobs (defensive: no slow on intangible WRAITH)', () => {
  // Defensive parity with recoil/chain branches at entities.js:~1028,
  // ~1066. Existing prefilters at content.js:3411 + entities.js:9588
  // already block damage to phased mobs, but if a future damage path
  // skips those filters the on-hit effects shouldn't visibly stutter
  // an intangible mob. Asserts the guard exists in the stagger branch.
  const branch = extractBranch(ENTITIES_CODE, /else if\s*\(\s*eff\s*===\s*'stagger'\s*\)\s*\{/);
  assert.ok(branch);
  assert.match(branch, /enemy\._wrPhased[\s\S]{0,40}continue/,
    'stagger must `continue` when enemy._wrPhased is true');
});

test('Enemy.update ticks down _staggerICD by dt', () => {
  // Without the per-frame decay, the ICD would never reset and the
  // affix would fire exactly once per enemy lifetime — making STAGGER
  // strictly worse than FROST. The decay sits next to _shockICD and
  // _recoilICD in the canonical "ICD decay block" of Enemy.update.
  // Brace-walked is overkill here (a one-liner), so a tight regex is
  // fine but include `dt` to lock the rate.
  assert.match(ENTITIES_CODE,
    /enemy\._staggerICD\s*>\s*0\)\s*enemy\._staggerICD\s*-=\s*dt/,
    'Enemy.update must decay enemy._staggerICD by dt every frame');
});

test('_staggerICD is declared as an Enemy class field (alphabetical block)', () => {
  // Per-enemy fields must be declared in the Enemy class field block so
  // the per-instance hidden-class shape is consistent (V8 perf) and so
  // the type-check (// @ts-check) doesn't flag the read in
  // applyHitEffects as access-of-undeclared-property. Adjacent declared
  // ICD fields are _recoilICD and _shockICD.
  assert.match(ENTITIES,
    /\/\*\*\s*@type\s*\{any\}\s*\*\/\s*_staggerICD;/,
    '_staggerICD must be declared as an Enemy class field with @type {any}');
});

test('STAGGER feedback particle uses MUZZLE shape with the affix colour', () => {
  // FROST uses a MUZZLE pulse in #66ccff; STAGGER reuses the MUZZLE
  // shape but with the affix's own #88aaff (slightly more violet) so
  // the player can visually distinguish the two slow sources. A SPARK
  // shape (used by recoil/shock) would conflict with the "stutter" feel.
  const branch = extractBranch(ENTITIES_CODE, /else if\s*\(\s*eff\s*===\s*'stagger'\s*\)\s*\{/);
  assert.ok(branch);
  assert.match(branch, /spawnParticles\([^)]*'MUZZLE'\s*,\s*'#88aaff'/,
    "STAGGER must spawn MUZZLE particles in #88aaff (matches affix colour)");
});
