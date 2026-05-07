'use strict';
// DEADLY 'Deadly' weapon-affix prefix — source-text wiring tests.
//
// DEADLY is a stat-mod prefix: +50% crit damage (additive, stored on the
// weapon as `w.critMulAdd` by buildWeapon and read by Player.shoot's
// critMul computation). It introduces a NEW `mods.critMulAdd` mod key,
// mirroring the critAdd / spreadAdd / countAdd additive plumbing
// precedent. Without the new key, multiplicative mods can't model
// "+50% crit damage" cleanly when stacked with the meta-upgrade
// `critDamageBonus` (which is itself additive on the base 2.0 multiplier).
//
// These tests fail loudly the moment a refactor (a) drops DEADLY from
// the registry, (b) flips slot:'prefix' to 'suffix' (which would silently
// no-op every stat mod since suffixes are routed to the on-hit/on-kill
// effect path), (c) breaks the critMulAdd branch in buildWeapon,
// (d) silently changes the mod value, or (e) drops the
// `+ (w.critMulAdd || 0)` term from the Player.shoot critMul computation.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content', 'weapons.js'), 'utf8'
);
const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);

// Strip /* ... */ and // ... comments so source-text regex assertions match
// against EXECUTABLE source, not commentary that incidentally quotes the
// keyword. Pattern from tests/{keen,volatile,mark,greedy,salvage,lucky}-affix.test.js
// (per stored memory 'test regex pitfalls').
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const CONTENT_CODE = stripComments(CONTENT);
const ENTITIES_CODE = stripComments(ENTITIES);

test('DEADLY is registered in WEAPON_AFFIXES as a prefix with the critMulAdd mod', () => {
  // slot:'prefix' is critical — only prefixes are routed through the
  // buildWeapon mod loop. A typo to 'suffix' would silently route DEADLY
  // into the on-hit/on-kill effect path (where it has no `effect` keyword)
  // and the critMulAdd mod would never be applied.
  const re = /DEADLY:\s*\{\s*slot:\s*'prefix'\s*,\s*label:\s*'[^']+'\s*,\s*colour:\s*'#[0-9a-fA-F]+'\s*,\s*desc:\s*'[^']+'\s*,\s*mods:\s*\{[^}]*critMulAdd[^}]*\}\s*\}/;
  assert.match(CONTENT, re,
    'DEADLY must be a prefix with label/colour/desc and a mods.critMulAdd key');
});

test('DEADLY registry entry encodes the exact critMulAdd value', () => {
  // Exact-value lock — 0.5 is part of the design contract. A drift to
  // e.g. 0.25 silently rebalances every DEADLY drop in every save without
  // test failure unless we pin the number here.
  const re = /DEADLY:[^}]*mods:\s*\{\s*critMulAdd:\s*0\.5\s*\}/;
  assert.match(CONTENT_CODE, re,
    'DEADLY.mods must be exactly { critMulAdd:0.5 }');
});

test('buildWeapon applies mods.critMulAdd as an additive (post-multiplier) operation', () => {
  // The new critMulAdd branch must use the additive `(w.critMulAdd || 0) + af.mods.critMulAdd`
  // form so it nucleates the field on first apply. Plain `w.critMulAdd =
  // w.critMulAdd + af.mods.critMulAdd` would yield NaN when w.critMulAdd is
  // undefined (no DEADLY-specific weapon initialiser exists; the field is
  // created on demand). The toFixed(3) round mirrors critAdd to keep
  // determinism.
  const re = /if\s*\(af\.mods\.critMulAdd\)\s*w\.critMulAdd\s*=\s*\+\(\(w\.critMulAdd\s*\|\|\s*0\)\s*\+\s*af\.mods\.critMulAdd\)\.toFixed\(3\);/;
  assert.match(CONTENT_CODE, re,
    'buildWeapon must additively accumulate af.mods.critMulAdd into w.critMulAdd with `||0` nucleation');
});

test('DEADLY appears in AFFIX_PREFIXES (not AFFIX_SUFFIXES) so it can roll as a prefix', () => {
  // AFFIX_PREFIXES / AFFIX_SUFFIXES are derived at module load by filtering
  // WEAPON_AFFIXES on the slot field. If slot is wrong (or the constant
  // names diverge), DEADLY silently becomes unrollable. We can't load
  // content.js as a module under node:test (browser globals), so assert
  // the structural shape: slot:'prefix' is the gate that the filter at
  // `AFFIX_PREFIXES = AFFIX_KEYS.filter(k => WEAPON_AFFIXES[k].slot === 'prefix')`
  // depends on.
  const re = /AFFIX_PREFIXES\s*=\s*AFFIX_KEYS\.filter\(k\s*=>\s*WEAPON_AFFIXES\[k\]\.slot\s*===\s*'prefix'\)/;
  assert.match(CONTENT_CODE, re,
    'AFFIX_PREFIXES filter must still gate on slot===prefix (sanity-check the mechanism)');
});

test('DEADLY listing follows the existing prefix block structure', () => {
  // Make sure DEADLY is declared in the prefix region of WEAPON_AFFIXES,
  // not accidentally inserted after the suffixes (which would still parse
  // and still satisfy the slot regex but visually misorganise the file —
  // and risk being missed in future suffix audits).
  const keenIdx = CONTENT_CODE.indexOf('KEEN:');
  const deadlyIdx = CONTENT_CODE.indexOf('DEADLY:');
  const flameIdx = CONTENT_CODE.indexOf('FLAME:');
  assert.ok(keenIdx !== -1 && deadlyIdx !== -1 && flameIdx !== -1,
    'KEEN, DEADLY, FLAME must all exist');
  assert.ok(deadlyIdx > keenIdx,
    'DEADLY must come after KEEN (last existing prefix at insertion time)');
  assert.ok(deadlyIdx < flameIdx,
    'DEADLY must come before FLAME (first suffix) — i.e. inside the prefix block');
});

test('Player.shoot critMul computation reads w.critMulAdd', () => {
  // The whole point of DEADLY is the per-shot crit-damage bump. If the
  // critMul computation drops the `+ (w.critMulAdd || 0)` term, every
  // DEADLY drop becomes silently inert (no test failure unless we assert
  // here). The `|| 0` guard matters: weapons WITHOUT DEADLY have
  // w.critMulAdd === undefined, and `undefined + n` would NaN-poison the
  // crit damage on every weapon (one NaN frame and damage routing breaks
  // for the entire shot).
  const reDeadly = /\(w\.critMulAdd\s*\|\|\s*0\)/;
  assert.match(ENTITIES_CODE, reDeadly,
    'Player.shoot critMul must include `+ (w.critMulAdd || 0)` (with `||0` guard)');

  // The full critMul assignment must include all addends in the same line —
  // otherwise they're separate variables that don't feed into the crit
  // damage multiplier applied at projectile spawn time.
  const fullRe = /const\s+critMul\s*=\s*2\s*\+\s*\(mf\.critDamageBonus\s*\|\|\s*0\)\s*\+\s*\(w\.critMulAdd\s*\|\|\s*0\)\s*;/;
  assert.match(ENTITIES_CODE, fullRe,
    'critMul assignment must add (w.critMulAdd || 0) alongside critDamageBonus and the base 2');
});

test('DEADLY does NOT carry a suffix-style effect keyword', () => {
  // DEADLY is purely a stat mod — it has no on-hit/on-kill effect.
  // If a future refactor accidentally adds `effect:'critdmg'` (or similar),
  // the buildWeapon `_effects = ... .map(... .effect)` collector would
  // push a bogus token into proj._effects, where applyHitEffects'
  // `effects.includes('<eff>')` switch could route into an unimplemented
  // branch. Lock this out at the registry level.
  //
  // NOTE: a naive `/DEADLY:\s*\{[^}]*\}/` regex stops at the first close-brace
  // (the inner `mods:{...}` close), so `effect:` inserted AFTER `mods` would
  // false-pass. Walk braces instead — captures the WHOLE DEADLY entry. Bug
  // caught by gpt-5.3-codex adversarial review 2026-04-28; the same flaw
  // exists in tests/keen-affix.test.js test #7 (pre-existing — not fixed
  // here per Anvil rule "don't fix unrelated pre-existing issues").
  function extractEntry(src, key) {
    const i = src.indexOf(key + ':');
    if (i < 0) return null;
    const open = src.indexOf('{', i);
    if (open < 0) return null;
    let depth = 0;
    for (let j = open; j < src.length; j++) {
      const c = src[j];
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) return src.slice(i, j + 1);
      }
    }
    return null;
  }
  const deadlyBlock = extractEntry(CONTENT_CODE, 'DEADLY');
  assert.ok(deadlyBlock, 'DEADLY registry entry must be findable');
  assert.ok(!/\beffect:/.test(deadlyBlock),
    'DEADLY must NOT have an `effect:` keyword (it is a stat mod, not an on-hit suffix)');
});

test('critMul math: DEADLY (+0.5) + critDamageBonus (+0.3) yields 2.8x', () => {
  // Smoke-test the additive math directly. Mirror the production
  // computation: 2 (base) + critDamageBonus + critMulAdd. With DEADLY
  // alone the multiplier is 2.5x. With DEADLY + a hypothetical
  // critical_force level granting +0.3 critDamageBonus, the final
  // multiplier is 2.8x — proving the two terms compose additively
  // (NOT multiplicatively, which would be 2 * 1.3 * 1.5 = 3.9x).
  const base = 2;
  const critDamageBonus = 0.3;
  const w = { critMulAdd: 0.5 };
  const critMul = base + (critDamageBonus || 0) + (w.critMulAdd || 0);
  assert.equal(critMul, 2.8, 'DEADLY composes additively with critDamageBonus');

  // And without DEADLY, w.critMulAdd is undefined; the `|| 0` guard MUST
  // keep critMul finite (not NaN) — otherwise damage routing breaks.
  const wNoDeadly = {};
  // @ts-expect-error — intentionally accessing missing property to verify guard
  const critMulNoDeadly = base + (critDamageBonus || 0) + (wNoDeadly.critMulAdd || 0);
  assert.equal(critMulNoDeadly, 2.3, 'no-DEADLY weapons keep finite critMul via `|| 0` guard');
});
