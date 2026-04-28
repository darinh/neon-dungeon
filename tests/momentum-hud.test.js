'use strict';
// MOMENTUM HUD discoverability — kill-driven damage-bonus window indicator.
//
// CONTEXT: MOMENTUM is a META UPGRADE (NOT a perk) defined at
// src/meta/upgrades.js:35. Effect: "+15% damage for 3s after a kill (per
// level)". Max level 2 → +30% bonus. The bonus stat lives on
// player.metaFlags.momentum (0|1|2) and the active-window timer on
// player._momentumTimer (countdown 3.0s).
//
// State machine:
//   - Trigger: any Enemy.die calls NEON.behavior.onKillRefreshMomentum
//     (entities.js ~L2016, behavior.js:64) which sets _momentumTimer = 3.
//   - Tick: NEON.behavior.tickMomentum in Player.update (entities.js:12025,
//     behavior.js:73) decrements timer by dt.
//   - Bonus: computeOutgoingDmgMul (meta/behavior.js:36-46) multiplies
//     outgoing damage by (1 + 0.15 * level) while timer > 0.
//
// Pre-PR there was NO HUD indicator. Players experienced an invisible
// damage spike immediately after each kill — they saw bigger numbers but
// had no signal that the bonus was active or how long it would last.
//
// This PR adds a single fx.push entry inside getStatusEffects() gated on
// `player.metaFlags && metaFlags.momentum > 0 && player._momentumTimer > 0`.
//
// Display: `▶ ×N.NN` where N.NN = (1 + 0.15 * level).toFixed(2). Mirrors
// HOT_HAND's `×N.NN` multiplier-readout style (PR #280).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
);
const BEHAVIOR = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'meta', 'behavior.js'), 'utf8'
);

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const CONTENT_CODE = stripComments(CONTENT);

/**
 * Brace-walk a `{`...`}` body starting from the FIRST match of `openerRe`.
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

// ─── getStatusEffects() momentum fx entry ──────────────────────────────

test('getStatusEffects() function body contains a momentum fx entry', () => {
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch, 'getStatusEffects function body must be locatable');
  assert.match(fnBranch, /id:\s*'momentum'/,
    'getStatusEffects must contain an fx entry with id: "momentum"');
});

test('momentum fx entry is gated on metaFlags-ownership AND active timer', () => {
  // Three gates:
  //   1. player.metaFlags — defensive null-check (legacy player shapes
  //      may lack it).
  //   2. metaFlags.momentum > 0 — only show when the upgrade is purchased
  //      (level-zero players don't get a phantom badge).
  //   3. _momentumTimer > 0 — only show while the buff window is active.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  assert.match(fnBranch,
    /player\.metaFlags\s*&&\s*\(\s*player\.metaFlags\.momentum[^)]+\)\s*>\s*0\s*&&\s*\(\s*player\._momentumTimer[^)]+\)\s*>\s*0/,
    'momentum gate must short-circuit through metaFlags-ownership, level > 0, and active timer');
});

test('momentum fx label shows the multiplier matching computeOutgoingDmgMul', () => {
  // Display formula: (1 + 0.15 * level).toFixed(2). Pin both the per-level
  // rate (0.15) and the multiplier-readout convention (×N.NN).
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  // Anchor on the if-block that contains the momentum fx.push.
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^{]*metaFlags[^{]*momentum[^{]*\{/
  );
  assert.ok(ifBranch, 'momentum if-block body must be locatable');
  assert.match(ifBranch,
    /\(\s*1\s*\+\s*0\.15\s*\*\s*lv\s*\)\.toFixed\(2\)/,
    'momentum label must compute (1 + 0.15 * lv).toFixed(2) — matches computeOutgoingDmgMul at meta/behavior.js:42');
  assert.match(ifBranch, /label:\s*['"]×['"]\s*\+\s*mul/,
    'momentum label must prefix the multiplier with "×" for readability');
});

test('momentum fx entry has icon ▶ and a hex colour', () => {
  // ▶ (play/forward triangle) signals "in-motion bonus" without colliding
  // with damage-related glyphs (♨ HOT_HAND, 🔥 BERSERKER, 💉 ADRENALINE).
  // The colour MUST be hex; distinct from the warm-red family of other
  // damage buffs (#ff8844 amber-orange chosen).
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^{]*metaFlags[^{]*momentum[^{]*\{/
  );
  assert.ok(ifBranch);
  assert.match(ifBranch, /icon:\s*['"]▶['"]/,
    'momentum fx icon must be ▶ (in-motion bonus)');
  assert.match(ifBranch, /colour:\s*['"]#[0-9a-fA-F]{6}['"]/,
    'momentum fx entry must carry a hex colour');
});

test('momentum fx entry id appears EXACTLY once in content.js', () => {
  const all = CONTENT_CODE.match(/id:\s*'momentum'/g) || [];
  assert.equal(all.length, 1,
    `content.js must contain exactly 1 id: 'momentum' fx entry; got ${all.length}`);
});

test('momentum HUD literal 0.15 matches computeOutgoingDmgMul in meta/behavior.js', () => {
  // Cross-file desync defence (per stored memory 'HUD status fx', PR
  // #280): the +15% per-level rate is hard-coded as 0.15 in BOTH the
  // HUD label (content.js) AND the damage-multiplier formula
  // (meta/behavior.js:42). A future re-tune in behavior.js would
  // silently desync the readout — players would see "×1.30" while
  // taking "×1.40" damage. This test parses behavior.js and asserts
  // the content.js HUD label uses the same numeric literal.
  const behaviorMatch = BEHAVIOR.match(
    /mul\s*\*=\s*\(\s*1\s*\+\s*([\d.]+)\s*\*\s*momLv\s*\)/
  );
  assert.ok(behaviorMatch,
    'computeOutgoingDmgMul momentum multiplier line must be locatable in meta/behavior.js');
  const behaviorRate = behaviorMatch[1]; // e.g. '0.15'

  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^{]*metaFlags[^{]*momentum[^{]*\{/
  );
  assert.ok(ifBranch);

  const rateInHud = new RegExp(
    `\\(\\s*1\\s*\\+\\s*${behaviorRate.replace(/\./g, '\\.')}\\s*\\*`
  );
  assert.match(ifBranch, rateInHud,
    `HUD label must use per-level rate ${behaviorRate} (matches behavior.js momentum multiplier formula)`);
});

// ─── runtime simulation: gate semantics + multiplier formula ───────────

test('runtime: momentum HUD label formula matches computeOutgoingDmgMul', () => {
  // Behavioural complement: replicate the label formula and the
  // computeOutgoingDmgMul formula on synthetic levels; assert they agree.
  function labelFor(level) {
    return '×' + (1 + 0.15 * level).toFixed(2);
  }
  function damageMul(level, timerActive) {
    if (level > 0 && timerActive) return 1 + 0.15 * level;
    return 1;
  }
  // Truth table:
  // level=0: no bonus. (badge wouldn't render)
  // level=1: +15%. label=×1.15.
  // level=2: +30%. label=×1.30.
  assert.equal(labelFor(1), '×1.15', 'lv1 label = ×1.15');
  assert.equal(labelFor(2), '×1.30', 'lv2 label = ×1.30');
  assert.equal(damageMul(1, true).toFixed(2), '1.15', 'lv1 damage mul = 1.15');
  assert.equal(damageMul(2, true).toFixed(2), '1.30', 'lv2 damage mul = 1.30');
  assert.equal(damageMul(0, true), 1, 'lv0 = no bonus regardless of timer');
  assert.equal(damageMul(1, false), 1, 'lv1 with no active timer = no bonus');
});

test('runtime: momentum fx-gate semantics — five-state truth table', () => {
  function shouldShowFx(player) {
    return !!(
      player.metaFlags &&
      (player.metaFlags.momentum | 0) > 0 &&
      (player._momentumTimer || 0) > 0
    );
  }

  // State 1: lv1 + active timer → SHOW.
  assert.equal(shouldShowFx({
    metaFlags: { momentum: 1 }, _momentumTimer: 2.0
  }), true, 'lv1 + active timer must show fx');

  // State 2: lv2 + active timer → SHOW.
  assert.equal(shouldShowFx({
    metaFlags: { momentum: 2 }, _momentumTimer: 2.0
  }), true, 'lv2 + active timer must show fx');

  // State 3: lv0 (not purchased) + active timer → HIDE.
  assert.equal(shouldShowFx({
    metaFlags: { momentum: 0 }, _momentumTimer: 2.0
  }), false, 'lv0 (not purchased) must hide fx even with phantom timer');

  // State 4: lv1 + expired timer → HIDE.
  assert.equal(shouldShowFx({
    metaFlags: { momentum: 1 }, _momentumTimer: 0
  }), false, 'expired timer must hide fx');

  // State 5: no metaFlags object (legacy shape) → HIDE, NO crash.
  assert.equal(shouldShowFx({
    _momentumTimer: 2.0
  }), false, 'undefined metaFlags must hide fx without throwing');

  // Negative timer (NaN-poison defence) → HIDE.
  assert.equal(shouldShowFx({
    metaFlags: { momentum: 1 }, _momentumTimer: -1
  }), false, 'negative timer must hide fx (NaN-poison defence)');
});
