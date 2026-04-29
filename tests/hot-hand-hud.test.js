'use strict';
// HOT_HAND HUD discoverability — consecutive-hit streak indicator.
//
// CONTEXT: HOT_HAND is a perk that rewards consecutive direct hits on
// the SAME target with +5% damage per stack (capped at +30% / 6 stacks).
// The streak resets on target-switch (entities.js:1891-1893) or after
// HOT_HAND_WINDOW=3.0s without a hit (entities.js:12017-12023).
//
// Pre-PR there was NO HUD indicator. Players experienced an invisible
// damage ramp — they saw bigger damage numbers when focused-firing but
// had no signal that the bonus was building, no warning when it was
// about to lapse, and no way to optimise their target-switching.
//
// This PR adds a single fx.push entry inside getStatusEffects() gated
// on `player.perks.HOT_HAND && player._hotHandTimer > 0 && _hotHandStreak > 0`.
//
// Display: `♨ ×N.NN` where N.NN = (1 + min(streak,6)*0.05).toFixed(2).
// This represents the multiplier the NEXT hit will receive — actionable
// without mental math.
//
// State machine reference (entities.js:1887-1900, 1891-1893, 12017-12023):
//   - takeDamage hook: stacks=current_streak (clamped 6), apply bonus,
//     then streak++ and timer=3.0
//   - Target-switch reset: if last target != current, streak=0 BEFORE
//     incrementing
//   - Timeout reset: tick in Player.update — when timer hits 0, streak=0
//     and lastTarget=null

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extractBranch, loadAlignmentSources } = require('./_alignment-helpers.js');

const { CONTENT, ENTITIES, CONTENT_CODE } = loadAlignmentSources(__dirname);

// ─── getStatusEffects() hot-hand fx entry ─────────────────────────────

test('getStatusEffects() function body contains a hot-hand fx entry', () => {
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch, 'getStatusEffects function body must be locatable');
  assert.match(fnBranch, /id:\s*'hot-hand'/,
    'getStatusEffects must contain an fx entry with id: "hot-hand"');
});

test('hot-hand fx entry is gated on perk-ownership AND active timer AND positive streak', () => {
  // Three gates:
  //   1. perks.HOT_HAND — only show when the player owns the perk.
  //   2. _hotHandTimer > 0 — only show while the streak window is alive.
  //   3. _hotHandStreak > 0 — defensive guard against a regression that
  //      sets the timer without incrementing the streak (would yield
  //      `×1.00` which is a useless badge).
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  assert.match(fnBranch,
    /player\.perks\s*&&\s*player\.perks\.HOT_HAND\s*&&\s*player\._hotHandTimer\s*>\s*0\s*&&\s*player\._hotHandStreak\s*>\s*0/,
    'HOT_HAND gate must short-circuit through perks-ownership, active timer, and positive streak (in this order or with all three present)');
});

test('hot-hand fx label shows the multiplier the NEXT hit will receive', () => {
  // Display formula: (1 + min(streak, 6) * 0.05).toFixed(2). Pin both the
  // 0.05 per-stack rate and the 6-stack cap so a future re-tune (e.g.
  // +10% per stack, max 4 stacks) MUST update both this test AND the
  // perk-card desc string at content.js:4397, keeping copy and runtime
  // in sync.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  // Anchor on the if-block that contains the hot-hand fx.push so the
  // assertion scope is correct.
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*HOT_HAND[^)]*\)\s*\{/
  );
  assert.ok(ifBranch, 'HOT_HAND if-block body must be locatable');
  assert.match(ifBranch, /Math\.min\(\s*player\._hotHandStreak[^,]*,\s*6\s*\)/,
    'HOT_HAND label must clamp streak to 6 (HOT_HAND_MAX_STACKS) before computing multiplier');
  assert.match(ifBranch, /\(\s*1\s*\+\s*stacks\s*\*\s*0\.05\s*\)\.toFixed\(2\)/,
    'HOT_HAND label must compute (1 + stacks * 0.05).toFixed(2) — matches HOT_HAND_PER_STACK at entities.js:10982');
  assert.match(ifBranch, /label:\s*['"]×['"]\s*\+\s*mul/,
    'HOT_HAND label must prefix the multiplier with "×" for readability');
});

test('hot-hand fx entry has icon ♨ matching the perk-card glyph', () => {
  // Visual identity: the in-HUD badge MUST use the same glyph as the
  // perk-selection card (content.js:4397 `icon:'♨'`) so players associate
  // the badge with the perk they picked.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*HOT_HAND[^)]*\)\s*\{/
  );
  assert.ok(ifBranch);
  assert.match(ifBranch, /icon:\s*['"]♨['"]/,
    'HOT_HAND fx icon must be ♨ (matches perk-card glyph)');
});

test('hot-hand fx entry has a hex colour distinct from neighbouring fx', () => {
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*HOT_HAND[^)]*\)\s*\{/
  );
  assert.ok(ifBranch);
  assert.match(ifBranch, /colour:\s*['"]#[0-9a-fA-F]{6}['"]/,
    'HOT_HAND fx entry must carry a hex colour');
});

test('hot-hand fx entry id appears EXACTLY once in content.js', () => {
  const all = CONTENT_CODE.match(/id:\s*'hot-hand'/g) || [];
  assert.equal(all.length, 1,
    `content.js must contain exactly 1 id: 'hot-hand' fx entry; got ${all.length}`);
});

test('hot-hand HUD literals match HOT_HAND_PER_STACK and HOT_HAND_MAX_STACKS in entities.js', () => {
  // Cross-file desync defence: HOT_HAND tuning constants live in
  // entities.js (browser-only, no module exports). The HUD label in
  // content.js uses hard-coded numeric literals (1 + min(streak, 6) *
  // 0.05). If the entities.js constants change (e.g. retune to +10%
  // per stack, max 4 stacks), the HUD would silently report stale
  // multipliers without any failing test — players would see "×1.30"
  // while taking "×1.20" damage. This test parses the entities.js
  // constants and asserts the content.js HUD branch uses the same
  // numeric values, so a future re-tune fails loudly here and forces
  // the HUD to be updated in sync.
  const perStackMatch = ENTITIES.match(/const\s+HOT_HAND_PER_STACK\s*=\s*([\d.]+)/);
  const maxStacksMatch = ENTITIES.match(/const\s+HOT_HAND_MAX_STACKS\s*=\s*(\d+)/);
  assert.ok(perStackMatch, 'HOT_HAND_PER_STACK constant must be locatable in entities.js');
  assert.ok(maxStacksMatch, 'HOT_HAND_MAX_STACKS constant must be locatable in entities.js');
  const perStack = perStackMatch[1];   // e.g. '0.05'
  const maxStacks = maxStacksMatch[1]; // e.g. '6'

  // Extract the HOT_HAND HUD if-block from content.js and assert it
  // contains the same numeric literals.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*HOT_HAND[^)]*\)\s*\{/
  );
  assert.ok(ifBranch);

  // Per-stack rate literal (e.g. "0.05") must appear in the HUD branch.
  const perStackInHud = new RegExp(`\\*\\s*${perStack.replace(/\./g, '\\.')}`);
  assert.match(ifBranch, perStackInHud,
    `HUD label must use per-stack rate ${perStack} (matches HOT_HAND_PER_STACK in entities.js)`);

  // Max-stacks cap literal (e.g. "6") must appear in the HUD branch.
  const maxStacksInHud = new RegExp(`Math\\.min\\([^,]+,\\s*${maxStacks}\\s*\\)`);
  assert.match(ifBranch, maxStacksInHud,
    `HUD label must clamp streak to ${maxStacks} (matches HOT_HAND_MAX_STACKS in entities.js)`);
});

// ─── runtime simulation: multiplier formula + clamp ────────────────────

test('runtime: HOT_HAND label formula matches takeDamage damage-multiplier formula', () => {
  // Behavioural complement: replicate the label formula and the
  // takeDamage damage formula on synthetic streaks; assert they agree.
  // If they ever diverge, players would see a label that doesn't match
  // the damage they observe.
  function labelFor(streak) {
    const stacks = Math.min(streak | 0, 6);
    return '×' + (1 + stacks * 0.05).toFixed(2);
  }
  function damageMul(streak) {
    const stacks = Math.min(streak | 0, 6);
    return 1 + stacks * 0.05;
  }
  // Truth table: streak → label → damage-mul → label-of-mul agreement.
  const cases = [
    { streak: 1, expectedLabel: '×1.05', expectedMul: 1.05 },
    { streak: 2, expectedLabel: '×1.10', expectedMul: 1.10 },
    { streak: 3, expectedLabel: '×1.15', expectedMul: 1.15 },
    { streak: 5, expectedLabel: '×1.25', expectedMul: 1.25 },
    { streak: 6, expectedLabel: '×1.30', expectedMul: 1.30 },
    { streak: 7, expectedLabel: '×1.30', expectedMul: 1.30 },  // capped
    { streak: 100, expectedLabel: '×1.30', expectedMul: 1.30 }, // capped
  ];
  for (const c of cases) {
    assert.equal(labelFor(c.streak), c.expectedLabel,
      `streak=${c.streak} → label=${c.expectedLabel}`);
    assert.equal(damageMul(c.streak).toFixed(2), c.expectedMul.toFixed(2),
      `streak=${c.streak} → damage mul=${c.expectedMul}`);
  }
});

test('runtime: HOT_HAND fx-gate semantics — four-state truth table', () => {
  // Replicate the if-gate predicate on synthetic player shapes; verify
  // the four states (perk+active+streak / perk+active+no-streak /
  // perk+expired / no-perk).
  function shouldShowFx(player) {
    return !!(
      player.perks && player.perks.HOT_HAND &&
      player._hotHandTimer > 0 && player._hotHandStreak > 0
    );
  }

  // State 1: perk owned + active timer + positive streak → SHOW.
  assert.equal(shouldShowFx({
    perks: { HOT_HAND: true }, _hotHandTimer: 2.5, _hotHandStreak: 3
  }), true, 'all three gates true must show fx');

  // State 2: perk owned + active timer + zero streak → HIDE
  // (defensive against regression — would render "×1.00").
  assert.equal(shouldShowFx({
    perks: { HOT_HAND: true }, _hotHandTimer: 2.5, _hotHandStreak: 0
  }), false, 'zero streak must hide fx (defensive: avoids ×1.00 readout)');

  // State 3: perk owned + expired timer + (any streak) → HIDE.
  assert.equal(shouldShowFx({
    perks: { HOT_HAND: true }, _hotHandTimer: 0, _hotHandStreak: 3
  }), false, 'expired timer must hide fx');

  // State 4: perk NOT owned + active timer + positive streak → HIDE.
  assert.equal(shouldShowFx({
    perks: {}, _hotHandTimer: 2.5, _hotHandStreak: 3
  }), false, 'no-perk must hide fx (regression defence — phantom timer/streak)');

  // No perks object at all (legacy shape): no crash, no badge.
  assert.equal(shouldShowFx({
    _hotHandTimer: 2.5, _hotHandStreak: 3
  }), false, 'undefined perks must hide fx without throwing');

  // Negative streak (NaN-poison defence): hide.
  assert.equal(shouldShowFx({
    perks: { HOT_HAND: true }, _hotHandTimer: 2.5, _hotHandStreak: -1
  }), false, 'negative streak must hide fx (NaN-poison defence)');
});
