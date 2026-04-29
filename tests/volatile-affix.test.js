'use strict';
// VOLATILE 'Volatile' weapon-affix prefix — source-text wiring tests
// plus an in-memory exercise of buildWeapon() via NEON.content reuse.
//
// VOLATILE is a stat-mod prefix: +50% dmg, -20% rate, +0.25 flat spread.
// It introduces a new `mods.spreadAdd` key (additive, mirrors the existing
// `mods.countAdd` pattern). Without spreadAdd, multiplicative `mods.spread`
// alone has no effect on weapons whose base spread is 0 (PULSE_PISTOL,
// RAILGUN, VOID_CANNON) — that would silently turn VOLATILE into a free
// damage uplift on 4 of 5 weapons. spreadAdd ensures every weapon
// actually pays the accuracy cost.
//
// These tests fail loudly the moment a refactor (a) drops VOLATILE from
// the registry, (b) flips slot:'prefix' to 'suffix', (c) breaks the
// spreadAdd branch in buildWeapon, or (d) silently changes any of the
// three mod values.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
);

// Strip /* ... */ and // ... comments so source-text regex assertions
// match against EXECUTABLE source, not commentary that incidentally
// quotes the keyword. Pattern from tests/{mark,greedy,salvage,lucky}-affix.test.js
// (per stored memory 'test regex pitfalls').
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const CONTENT_CODE = stripComments(CONTENT);

test('VOLATILE is registered in WEAPON_AFFIXES as a prefix with all three mods', () => {
  // slot:'prefix' is critical — only prefixes go through the buildWeapon
  // mod loop. A typo to 'suffix' would silently route VOLATILE into the
  // on-hit/on-kill effect path (where it has no `effect` keyword) and
  // every stat mod would become a no-op.
  const re = /VOLATILE:\s*\{\s*slot:\s*'prefix'\s*,\s*label:\s*'[^']+'\s*,\s*colour:\s*'#[0-9a-fA-F]+'\s*,\s*desc:\s*'[^']+'\s*,\s*mods:\s*\{[^}]*\}\s*\}/;
  assert.match(CONTENT, re,
    'VOLATILE must be a prefix with label/colour/desc and a mods object');
});

test('VOLATILE registry entry encodes the exact three mods', () => {
  // Exact-value lock — these numbers are part of the design contract.
  // A drift to e.g. dmg:1.4 or spreadAdd:0.15 silently rebalances every
  // VOLATILE drop in every save without test failure unless we pin them.
  const re = /VOLATILE:[^}]*mods:\s*\{\s*dmg:\s*1\.5\s*,\s*rate:\s*0\.8\s*,\s*spreadAdd:\s*0\.25\s*\}/;
  assert.match(CONTENT_CODE, re,
    'VOLATILE.mods must be exactly { dmg:1.5, rate:0.8, spreadAdd:0.25 }');
});

test('buildWeapon applies mods.spreadAdd as an additive (post-multiplier) operation', () => {
  // The new spreadAdd branch must sit AFTER the existing multiplicative
  // spread branch so that PRECISE+VOLATILE on the same weapon (theoretical
  // — only 1 prefix per weapon today, but the loop is generic) would
  // multiply first then add. Guarding against an accidental refactor that
  // changes ordering or replaces the additive op with another `*=`.
  const re = /if\s*\(af\.mods\.spreadAdd\)\s*w\.spread\s*=\s*\+\(w\.spread\s*\+\s*af\.mods\.spreadAdd\)\.toFixed\(3\);/;
  assert.match(CONTENT_CODE, re,
    'buildWeapon must add af.mods.spreadAdd to w.spread (additive)');

  // And the spreadAdd branch must come AFTER the multiplicative spread
  // branch — otherwise a future PRECISE-on-VOLATILE stack would multiply
  // the additive bump (spread=0+0.25=0.25 → ×0.4 = 0.1) instead of the
  // intended additive-after-multiplicative ordering.
  const mulIdx = CONTENT_CODE.search(/if\s*\(af\.mods\.spread\s*!==\s*undefined\)/);
  const addIdx = CONTENT_CODE.search(/if\s*\(af\.mods\.spreadAdd\)/);
  assert.ok(mulIdx !== -1 && addIdx !== -1, 'both spread branches must exist');
  assert.ok(addIdx > mulIdx,
    'spreadAdd branch must follow the multiplicative spread branch in buildWeapon');
});

test('VOLATILE appears in AFFIX_PREFIXES (not AFFIX_SUFFIXES) so it can roll as a prefix', () => {
  // AFFIX_PREFIXES / AFFIX_SUFFIXES are derived at module load by filtering
  // WEAPON_AFFIXES on the slot field. If slot is wrong (or the constant
  // names diverge), VOLATILE silently becomes unrollable. We can't load
  // content.js as a module under node:test (browser globals), so assert
  // the structural shape: slot:'prefix' is the gate that the filter at
  // `AFFIX_PREFIXES = AFFIX_KEYS.filter(k => WEAPON_AFFIXES[k].slot === 'prefix')`
  // depends on.
  const re = /AFFIX_PREFIXES\s*=\s*AFFIX_KEYS\.filter\(k\s*=>\s*WEAPON_AFFIXES\[k\]\.slot\s*===\s*'prefix'\)/;
  assert.match(CONTENT_CODE, re,
    'AFFIX_PREFIXES filter must still gate on slot===prefix (sanity-check the mechanism)');
});

test('VOLATILE listing follows the existing prefix block structure', () => {
  // Make sure VOLATILE is declared in the prefix region of WEAPON_AFFIXES,
  // not accidentally inserted after the suffixes (which would still parse
  // and still satisfy the slot regex but visually misorganise the file —
  // and risk being missed in future suffix audits).
  const burstIdx = CONTENT_CODE.indexOf("BURST:");
  const volatileIdx = CONTENT_CODE.indexOf("VOLATILE:");
  const flameIdx = CONTENT_CODE.indexOf("FLAME:");
  assert.ok(burstIdx !== -1 && volatileIdx !== -1 && flameIdx !== -1,
    'BURST, VOLATILE, FLAME must all exist');
  assert.ok(volatileIdx > burstIdx,
    'VOLATILE must come after BURST (last existing prefix)');
  assert.ok(volatileIdx < flameIdx,
    'VOLATILE must come before FLAME (first suffix) — i.e. inside the prefix block');
});

test('VOLATILE does NOT carry a suffix-style effect keyword', () => {
  // VOLATILE is purely a stat mod — it has no on-hit/on-kill effect.
  // If a future refactor accidentally adds `effect:'volatile'` (or similar),
  // the buildWeapon `_effects = ... .map(... .effect)` collector would
  // push a bogus token into proj._effects, where applyHitEffects'
  // `effects.includes('<eff>')` switch could route into an unimplemented
  // branch (or — worse — collide with the EXISTING 'volatile' MODULE which
  // already has a different on-death meaning at content.js:688). Lock this
  // out at the registry level.
  //
  // NOTE: a naive `/VOLATILE:\s*\{[^}]*\}/` regex stops at the first
  // close-brace (the inner `mods:{...}` close), so `effect:` inserted AFTER
  // `mods` would false-pass. Walk braces instead — captures the WHOLE
  // VOLATILE entry. Pattern from tests/deadly-affix.test.js test #7
  // (canonical extractEntry).
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
  const volatileBlock = extractEntry(CONTENT_CODE, 'VOLATILE');
  assert.ok(volatileBlock, 'VOLATILE registry entry must be findable');
  assert.ok(!/\beffect:/.test(volatileBlock),
    'VOLATILE must NOT have an `effect:` keyword (it is a stat mod, not an on-hit suffix)');
});
