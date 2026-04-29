'use strict';
// LAST_STAND HUD discoverability — clutch-window timer indicator.
//
// CONTEXT: LAST_STAND is a perk that triggers when the player takes a hit
// that would drop them at or below a low-HP threshold. For 5 seconds after
// triggering, the player takes 50% damage AND deals +75% damage (entities.js
// :11326 + :11536). Then the perk goes on a 60s cooldown.
//
// Pre-PR: there was NO HUD indicator that the clutch window had fired —
// players experienced "I should be dead but I'm not, and I don't know why,
// and I'm about to die again because I didn't capitalise on the buff."
//
// This PR adds a single fx.push entry in `getStatusEffects()` (src/content.js)
// gated on `player.perks.LAST_STAND && player.lastStandTimer > 0`, mirroring
// the adrenalineTimer pattern (timer-driven, seconds-remaining label).
//
// content.js is browser-only (UMD-loaded), so these tests assert structural
// invariants on the source text:
//   - The fx.push call exists inside getStatusEffects with id='last-stand'.
//   - It is gated on `player.perks.LAST_STAND && player.lastStandTimer > 0`
//     (not just lastStandTimer, which would make non-perk-owners see a
//     phantom buff during a regression that touches the field).
//   - Defensive `player.perks &&` null-check (perks may be undefined on
//     legacy player shapes that bypassed the ctor).
//   - Label uses .toFixed(1) for sub-second precision (matches the
//     adrenalineTimer / burnTimer / shockTimer style — short timers need
//     decimal precision to feel responsive).
//   - Icon and colour are distinct enough to read against neighbouring
//     fx entries.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extractBranch, loadAlignmentSources } = require('./_alignment-helpers.js');

const { CONTENT, CONTENT_CODE } = loadAlignmentSources(__dirname);

// ─── getStatusEffects() LAST_STAND fx entry ───────────────────────────

test('getStatusEffects() function body contains a LAST_STAND-gated fx.push entry', () => {
  // Scope to the getStatusEffects function body via brace-walked extraction
  // so a stray 'last-stand' string elsewhere in content.js can't satisfy
  // this assertion (per stored memory 'test source-text extraction').
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch, 'getStatusEffects function body must be locatable');
  assert.match(fnBranch, /id:\s*'last-stand'/,
    'getStatusEffects must contain an fx entry with id: "last-stand"');
});

test('LAST_STAND fx entry is gated on perk-ownership AND active timer', () => {
  // Both gates required: WITHOUT perks.LAST_STAND a regression that sets
  // lastStandTimer on a non-owner (e.g. via shared timer init) would
  // surface a phantom buff to the player. Pin the AND-composition.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  // Locate the controlling if-statement that wraps the last-stand fx.push
  // by anchoring on the .perks.LAST_STAND substring.
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*\.perks[^)]*LAST_STAND[^)]*lastStandTimer[^)]*>\s*0[^)]*\)\s*\{/
  );
  assert.ok(ifBranch,
    'LAST_STAND fx.push must sit inside an if-block that gates on player.perks.LAST_STAND AND player.lastStandTimer > 0');
  assert.match(ifBranch, /id:\s*'last-stand'/,
    'LAST_STAND fx.push must be inside the perks.LAST_STAND && lastStandTimer > 0 gate');
});

test('LAST_STAND fx entry guards against undefined player.perks (defensive null-check)', () => {
  // Some legacy player shapes (test sandboxes, save migrations) bypass the
  // ctor and don't have a .perks object. Without `player.perks &&` the
  // helper would throw on `undefined.LAST_STAND`. Pin the defensive guard.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  // The if-condition must include `player.perks &&` BEFORE `player.perks.LAST_STAND`
  // (short-circuit evaluation prevents the null-deref).
  assert.match(fnBranch,
    /player\.perks\s*&&\s*player\.perks\.LAST_STAND\s*&&\s*player\.lastStandTimer\s*>\s*0/,
    'LAST_STAND gate must short-circuit on player.perks before dereferencing .LAST_STAND');
});

test('LAST_STAND fx label uses toFixed(1) for sub-second precision (matches adrenalineTimer pattern)', () => {
  // Short timers (5s) need decimal precision so the player can see the
  // window closing in real-time. `Math.ceil(timer)+'s'` (the pattern used
  // by reactive-armor's 8s cooldown) would round 0.4s up to '1s' until
  // the very last frame — feels unresponsive for a clutch window.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  // Anchor on the last-stand fx.push line to scope the label assertion.
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*\.perks[^)]*LAST_STAND[^)]*\)\s*\{/
  );
  assert.ok(ifBranch);
  assert.match(ifBranch,
    /label:\s*player\.lastStandTimer\.toFixed\(1\)\s*\+\s*['"]s['"]/,
    'LAST_STAND fx label must use .toFixed(1) + "s" (sub-second precision for the 5s clutch window)');
});

test('LAST_STAND fx entry has icon and colour set (HUD-renderer reads them generically)', () => {
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*\.perks[^)]*LAST_STAND[^)]*\)\s*\{/
  );
  assert.ok(ifBranch);
  assert.match(ifBranch, /icon:\s*['"][^'"]+['"]/,
    'LAST_STAND fx entry must carry an icon glyph');
  assert.match(ifBranch, /colour:\s*['"]#[0-9a-fA-F]+['"]/,
    'LAST_STAND fx entry must carry a hex colour');
});

test('LAST_STAND fx entry id appears EXACTLY once in content.js', () => {
  // Mirror the regenerative-modifier exact-count assertion: a duplicate
  // fx entry (e.g. accidentally introduced via merge / copy-paste) would
  // double-render the indicator in statusFx (which keys on id). Pin the
  // count.
  const all = CONTENT_CODE.match(/id:\s*'last-stand'/g) || [];
  assert.equal(all.length, 1,
    `content.js must contain exactly 1 id: 'last-stand' fx entry; got ${all.length}`);
});

// ─── runtime simulation: gate semantics ────────────────────────────────

test('runtime: LAST_STAND fx-gate semantics — three-state truth table', () => {
  // Behavioural complement: replicate the gate predicate on synthetic
  // player shapes and verify the truth table.
  function shouldShowFx(player) {
    return !!(player.perks && player.perks.LAST_STAND && player.lastStandTimer > 0);
  }

  // Perk owned + active window → show.
  assert.equal(shouldShowFx({ perks: { LAST_STAND: true }, lastStandTimer: 3.2 }),
    true, 'perk owned + timer active must show fx');

  // Perk owned + no active window → hide.
  assert.equal(shouldShowFx({ perks: { LAST_STAND: true }, lastStandTimer: 0 }),
    false, 'perk owned but timer expired must hide fx');

  // Perk NOT owned + active window (regression scenario) → hide.
  assert.equal(shouldShowFx({ perks: {}, lastStandTimer: 3.2 }),
    false, 'phantom timer without perk-ownership must NOT show fx (regression defence)');

  // No perks object at all (legacy shape) → hide, NO crash.
  assert.equal(shouldShowFx({ lastStandTimer: 3.2 }),
    false, 'undefined perks must hide fx without throwing');

  // Negative timer (NaN-poison defence) → hide.
  assert.equal(shouldShowFx({ perks: { LAST_STAND: true }, lastStandTimer: -1 }),
    false, 'negative timer must hide fx (NaN-poison defence)');
});
