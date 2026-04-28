'use strict';
// KEEN 'Keen' weapon-affix prefix — source-text wiring tests.
//
// KEEN is a stat-mod prefix: +12% crit chance (additive, stored on the
// weapon as `w.critAdd` by buildWeapon and read by Player.shoot's
// critChance computation). It introduces a NEW `mods.critAdd` mod key,
// mirroring the spreadAdd/countAdd additive plumbing precedent. Without
// the new key, multiplicative mods can't model "+X% chance to crit"
// because the base critChance is often 0 (no CRITICAL_HIT perk +
// no critical_bias upgrade) — multiplying by anything still yields 0.
//
// These tests fail loudly the moment a refactor (a) drops KEEN from the
// registry, (b) flips slot:'prefix' to 'suffix' (which would silently
// no-op every stat mod since suffixes are routed to the on-hit/on-kill
// effect path), (c) breaks the critAdd branch in buildWeapon, (d) silently
// changes the mod value, or (e) drops the `+ (w.critAdd || 0)` term from
// the Player.shoot critChance computation.

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

// Strip /* ... */ and // ... comments so source-text regex assertions match
// against EXECUTABLE source, not commentary that incidentally quotes the
// keyword. Pattern from tests/{volatile,mark,greedy,salvage,lucky}-affix.test.js
// (per stored memory 'test regex pitfalls').
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const CONTENT_CODE = stripComments(CONTENT);
const ENTITIES_CODE = stripComments(ENTITIES);

test('KEEN is registered in WEAPON_AFFIXES as a prefix with the critAdd mod', () => {
  // slot:'prefix' is critical — only prefixes are routed through the
  // buildWeapon mod loop. A typo to 'suffix' would silently route KEEN
  // into the on-hit/on-kill effect path (where it has no `effect` keyword)
  // and the critAdd mod would never be applied.
  const re = /KEEN:\s*\{\s*slot:\s*'prefix'\s*,\s*label:\s*'[^']+'\s*,\s*colour:\s*'#[0-9a-fA-F]+'\s*,\s*desc:\s*'[^']+'\s*,\s*mods:\s*\{[^}]*critAdd[^}]*\}\s*\}/;
  assert.match(CONTENT, re,
    'KEEN must be a prefix with label/colour/desc and a mods.critAdd key');
});

test('KEEN registry entry encodes the exact critAdd value', () => {
  // Exact-value lock — 0.12 is part of the design contract. A drift to
  // e.g. 0.20 silently rebalances every KEEN drop in every save without
  // test failure unless we pin the number here.
  const re = /KEEN:[^}]*mods:\s*\{\s*critAdd:\s*0\.12\s*\}/;
  assert.match(CONTENT_CODE, re,
    'KEEN.mods must be exactly { critAdd:0.12 }');
});

test('buildWeapon applies mods.critAdd as an additive (post-multiplier) operation', () => {
  // The new critAdd branch must use the additive `(w.critAdd || 0) + af.mods.critAdd`
  // form so it nucleates the field on first apply. Plain `w.critAdd =
  // w.critAdd + af.mods.critAdd` would yield NaN when w.critAdd is undefined
  // (no KEEN-specific weapon initialiser exists; the field is created on
  // demand). The toFixed(3) round mirrors spreadAdd to keep determinism.
  const re = /if\s*\(af\.mods\.critAdd\)\s*w\.critAdd\s*=\s*\+\(\(w\.critAdd\s*\|\|\s*0\)\s*\+\s*af\.mods\.critAdd\)\.toFixed\(3\);/;
  assert.match(CONTENT_CODE, re,
    'buildWeapon must additively accumulate af.mods.critAdd into w.critAdd with `||0` nucleation');
});

test('KEEN appears in AFFIX_PREFIXES (not AFFIX_SUFFIXES) so it can roll as a prefix', () => {
  // AFFIX_PREFIXES / AFFIX_SUFFIXES are derived at module load by filtering
  // WEAPON_AFFIXES on the slot field. If slot is wrong (or the constant
  // names diverge), KEEN silently becomes unrollable. We can't load
  // content.js as a module under node:test (browser globals), so assert
  // the structural shape: slot:'prefix' is the gate that the filter at
  // `AFFIX_PREFIXES = AFFIX_KEYS.filter(k => WEAPON_AFFIXES[k].slot === 'prefix')`
  // depends on.
  const re = /AFFIX_PREFIXES\s*=\s*AFFIX_KEYS\.filter\(k\s*=>\s*WEAPON_AFFIXES\[k\]\.slot\s*===\s*'prefix'\)/;
  assert.match(CONTENT_CODE, re,
    'AFFIX_PREFIXES filter must still gate on slot===prefix (sanity-check the mechanism)');
});

test('KEEN listing follows the existing prefix block structure', () => {
  // Make sure KEEN is declared in the prefix region of WEAPON_AFFIXES,
  // not accidentally inserted after the suffixes (which would still parse
  // and still satisfy the slot regex but visually misorganise the file —
  // and risk being missed in future suffix audits).
  const volatileIdx = CONTENT_CODE.indexOf('VOLATILE:');
  const keenIdx = CONTENT_CODE.indexOf('KEEN:');
  const flameIdx = CONTENT_CODE.indexOf('FLAME:');
  assert.ok(volatileIdx > 0 && keenIdx > 0 && flameIdx > 0,
    'VOLATILE, KEEN, FLAME must all exist');
  assert.ok(keenIdx > volatileIdx,
    'KEEN must come after VOLATILE (last existing prefix at insertion time)');
  assert.ok(keenIdx < flameIdx,
    'KEEN must come before FLAME (first suffix) — i.e. inside the prefix block');
});

test('Player.shoot critChance computation reads w.critAdd AND this.critChance', () => {
  // The whole point of KEEN is the per-shot crit-chance bump. If the
  // critChance computation drops the `+ (w.critAdd || 0)` term, every KEEN
  // drop becomes silently inert (no test failure unless we assert here).
  // The `|| 0` guard matters: weapons WITHOUT KEEN have w.critAdd === undefined,
  // and `undefined + n` would NaN-poison the crit roll for every weapon.
  const reKeen = /\(w\.critAdd\s*\|\|\s*0\)/;
  assert.match(ENTITIES_CODE, reKeen,
    'Player.shoot critChance must include `+ (w.critAdd || 0)` (with `||0` guard)');

  // The `this.critChance` term restores the `critical_bias` meta upgrade
  // (save.js writes `player.critChance += 0.04 * level`). Pre-KEEN this
  // field was set but never read — adversarial review caught it co-located
  // with the KEEN wiring. Lock the term in so it can't regress silently.
  const reMeta = /\(this\.critChance\s*\|\|\s*0\)/;
  assert.match(ENTITIES_CODE, reMeta,
    'Player.shoot critChance must include `+ (this.critChance || 0)` so the critical_bias upgrade is honoured');

  // And both terms must live in the SAME assignment line as the other
  // crit-chance addends — otherwise they're separate variables that don't
  // feed into the `Math.random() < critChance` rolls.
  const fullRe = /const\s+critChance\s*=\s*\([^)]+CRITICAL_HIT[^)]+\)\s*\+\s*critBonus\s*\+\s*\(mf\.critChanceBonus\s*\|\|\s*0\)\s*\+\s*\(w\.critAdd\s*\|\|\s*0\)\s*\+\s*\(this\.critChance\s*\|\|\s*0\)\s*;/;
  assert.match(ENTITIES_CODE, fullRe,
    'critChance assignment must add (w.critAdd || 0) and (this.critChance || 0) alongside CRITICAL_HIT/critBonus/critChanceBonus');
});

test('KEEN does NOT carry a suffix-style effect keyword', () => {
  // KEEN is purely a stat mod — it has no on-hit/on-kill effect.
  // If a future refactor accidentally adds `effect:'crit'` (or similar),
  // the buildWeapon `_effects = ... .map(... .effect)` collector at
  // content.js:1617 would push a bogus token into proj._effects, where
  // applyHitEffects' `effects.includes('<eff>')` switch could route into
  // an unimplemented branch. Lock this out at the registry level.
  const keenBlock = CONTENT_CODE.match(/KEEN:\s*\{[^}]*\}/);
  assert.ok(keenBlock, 'KEEN registry entry must be findable');
  assert.ok(!/effect:/.test(keenBlock[0]),
    'KEEN must NOT have an `effect:` keyword (it is a stat mod, not an on-hit suffix)');
});
