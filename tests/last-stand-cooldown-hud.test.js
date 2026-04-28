'use strict';
// LAST_STAND cooldown HUD discoverability — recharge-state indicator.
//
// CONTEXT: Follow-up to PR #276 which added the active-window indicator
// (✦ N.Ns bright amber, gated on lastStandTimer > 0). This PR adds the
// post-window cooldown indicator (✦ Ns dim amber, gated on lastStandCD > 0)
// in an ELSE-IF branch.
//
// State machine (from entities.js:11527-11530):
//   - Trigger: perk owned + CD <= 0 + timer <= 0 + low-HP hit
//   - On trigger: timer = 5; CD = 60 (BOTH set simultaneously)
//   - Active window (5s): timer counts down, CD continues counting down in
//     parallel
//   - Recharge (~55s): timer === 0, CD continues counting down
//   - Ready: timer === 0 AND CD === 0
//
// HUD priority: active window > cooldown > ready (no badge for ready —
// auto-trigger perk has no player input).
//
// Without this PR (post-#276): players see ✦ N.Ns during the 5s window,
// then NOTHING for 55s. They can't tell "ready" from "recharging" without
// remembering the last trigger time. At low HP this matters for tactical
// decisions ("do I push or play safe?").

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
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

// ─── getStatusEffects() last-stand-cd fx entry ─────────────────────────

test('getStatusEffects() function body contains a last-stand-cd fx entry', () => {
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch, 'getStatusEffects function body must be locatable');
  assert.match(fnBranch, /id:\s*'last-stand-cd'/,
    'getStatusEffects must contain an fx entry with id: "last-stand-cd"');
});

test('last-stand-cd is the ELSE-IF branch of last-stand (mutually exclusive priority)', () => {
  // CRITICAL: the cooldown badge must NOT render simultaneously with the
  // active-window badge. When LAST_STAND just triggered, BOTH timer>0 AND
  // CD>0 are true (entities.js:11529-11530 sets both simultaneously). A
  // separate `if (CD > 0)` block would double-render the badge during the
  // active window. Verify the source uses `else if (...)` chained to the
  // active-window check.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  // Brace-walk to extract the FULL active-window if-block, then assert the
  // immediately-following text starts with `else if (...lastStandCD > 0)`.
  // [^}]* in a flat regex won't traverse the inner fx.push({...}) brace.
  const activeIfBranch = extractBranch(
    fnBranch,
    /if\s*\(\s*player\.perks\s*&&\s*player\.perks\.LAST_STAND\s*&&\s*player\.lastStandTimer\s*>\s*0\s*\)\s*\{/
  );
  assert.ok(activeIfBranch, 'active-window if-block must be locatable for else-if anchor');
  const activeEnd = fnBranch.indexOf(activeIfBranch) + activeIfBranch.length;
  // Slice ~120 chars after the active block; expect `else if (...lastStandCD)`.
  const tail = fnBranch.slice(activeEnd, activeEnd + 200).trimStart();
  assert.match(tail,
    /^else\s+if\s*\([^)]*lastStandCD\s*>\s*0\s*\)/,
    'last-stand-cd MUST be an `else if` chained directly to the lastStandTimer > 0 if-block (no other statements between)');
});

test('last-stand-cd fx entry is gated on perk-ownership AND active cooldown', () => {
  // Same defensive predicate as the active-window branch: perks-ownership
  // gate prevents phantom badges if a regression sets CD on a non-owner
  // (shared-CD init bug). Defensive `player.perks &&` null-check.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  assert.match(fnBranch,
    /else\s+if\s*\(\s*player\.perks\s*&&\s*player\.perks\.LAST_STAND\s*&&\s*player\.lastStandCD\s*>\s*0\s*\)/,
    'cooldown branch must short-circuit on player.perks before dereferencing .LAST_STAND, then gate on lastStandCD > 0');
});

test('last-stand-cd label uses Math.ceil for whole-second precision (matches reactive-cd pattern)', () => {
  // Long cooldowns (60s) use coarse whole-second readouts because sub-
  // second precision on a long timer feels frenetic without being
  // actionable. Mirrors reactive-cd at content.js:2358 (8s cooldown,
  // also Math.ceil). Active-window's .toFixed(1) is for the SHORT 5s
  // tactical window; this is for the LONG 60s recharge.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  // Anchor on the else-if branch body via brace-walking to scope the
  // label assertion (avoid false-pass against the active-window label).
  const elseBranch = extractBranch(
    fnBranch,
    /else\s+if\s*\([^)]*lastStandCD\s*>\s*0\s*\)\s*\{/
  );
  assert.ok(elseBranch, 'else-if cooldown branch body must be locatable');
  assert.match(elseBranch,
    /label:\s*Math\.ceil\(\s*player\.lastStandCD\s*\)\s*\+\s*['"]s['"]/,
    'cooldown branch label must use Math.ceil(player.lastStandCD) + "s" (whole-second precision)');
});

test('last-stand-cd colour is dim amber (distinct from active-window bright amber)', () => {
  // Visual contrast carries the state: bright = active, dim = recharging.
  // Same icon (✦) keeps the visual identity so players associate the badge
  // with LAST_STAND regardless of state. The colour MUST be a hex string
  // and MUST NOT collide with the bright #ffaa00 used in the active branch.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const elseBranch = extractBranch(
    fnBranch,
    /else\s+if\s*\([^)]*lastStandCD\s*>\s*0\s*\)\s*\{/
  );
  assert.ok(elseBranch);
  assert.match(elseBranch, /colour:\s*['"]#[0-9a-fA-F]{6}['"]/,
    'cooldown branch must carry a hex colour');
  assert.doesNotMatch(elseBranch, /colour:\s*['"]#ffaa00['"]/i,
    'cooldown branch colour MUST differ from active-window #ffaa00 (state-by-saturation contrast)');
});

test('last-stand-cd fx entry id appears EXACTLY once in content.js', () => {
  // Mirror the active-window's exact-once assertion. statusFx[fx.id] keys
  // by id — a duplicate would double-render the indicator.
  const all = CONTENT_CODE.match(/id:\s*'last-stand-cd'/g) || [];
  assert.equal(all.length, 1,
    `content.js must contain exactly 1 id: 'last-stand-cd' fx entry; got ${all.length}`);
});

// ─── runtime simulation: state-machine truth table ─────────────────────

test('runtime: LAST_STAND HUD truth table covers all four states', () => {
  // Behavioural complement: replicate the if/else-if predicates on
  // synthetic player shapes and verify the 4-state truth table.
  function whichBadge(player) {
    if (player.perks && player.perks.LAST_STAND && player.lastStandTimer > 0) {
      return 'active';
    } else if (player.perks && player.perks.LAST_STAND && player.lastStandCD > 0) {
      return 'cooldown';
    }
    return 'none';
  }

  // State 1: ACTIVE WINDOW — timer > 0, CD > 0 (just triggered).
  // Active wins (priority).
  assert.equal(whichBadge({ perks: { LAST_STAND: true }, lastStandTimer: 4.2, lastStandCD: 59 }),
    'active', 'just-triggered state must show ACTIVE (priority over CD)');

  // State 2: RECHARGING — timer === 0, CD > 0 (window expired).
  assert.equal(whichBadge({ perks: { LAST_STAND: true }, lastStandTimer: 0, lastStandCD: 35 }),
    'cooldown', 'post-window state must show COOLDOWN');

  // State 3: READY — timer === 0, CD === 0 (perk owned, available).
  // No badge per design (auto-trigger perk needs no input).
  assert.equal(whichBadge({ perks: { LAST_STAND: true }, lastStandTimer: 0, lastStandCD: 0 }),
    'none', 'ready state must show NO badge (auto-trigger needs no UI)');

  // State 4: NOT OWNED — perks={}, even with phantom timer/CD.
  assert.equal(whichBadge({ perks: {}, lastStandTimer: 4.2, lastStandCD: 59 }),
    'none', 'phantom timer/CD without perk-ownership must show NO badge');

  // No perks object at all (legacy shape): no crash, no badge.
  assert.equal(whichBadge({ lastStandTimer: 4.2, lastStandCD: 59 }),
    'none', 'undefined perks must show NO badge without throwing');
});

test('runtime: cooldown branch fires AT and BEYOND the active-window expiry', () => {
  // Edge case: the moment timer transitions from > 0 to 0 (next frame
  // after the 5s window closes), the cooldown badge should pick up
  // seamlessly. Verify the boundary at exactly timer === 0.
  function whichBadge(player) {
    if (player.perks && player.perks.LAST_STAND && player.lastStandTimer > 0) {
      return 'active';
    } else if (player.perks && player.perks.LAST_STAND && player.lastStandCD > 0) {
      return 'cooldown';
    }
    return 'none';
  }

  // Boundary: timer JUST hit 0 this frame, CD still > 0.
  assert.equal(whichBadge({ perks: { LAST_STAND: true }, lastStandTimer: 0, lastStandCD: 55 }),
    'cooldown', 'cooldown badge must take over the frame after timer === 0');

  // Boundary: timer at 0.001 (last active frame), CD still > 0.
  assert.equal(whichBadge({ perks: { LAST_STAND: true }, lastStandTimer: 0.001, lastStandCD: 55 }),
    'active', 'active badge must hold while timer > 0 (even if tiny)');

  // Both boundaries together: timer === 0 AND CD === 0 → ready, no badge.
  assert.equal(whichBadge({ perks: { LAST_STAND: true }, lastStandTimer: 0, lastStandCD: 0 }),
    'none', 'ready state at both boundaries must show NO badge');
});
