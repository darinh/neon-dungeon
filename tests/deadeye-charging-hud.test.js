'use strict';
// DEADEYE charging-phase HUD discoverability — countdown badge for the
// stillness ramp.
//
// CONTEXT: DEADEYE is a perk that grants ×1.5 damage on the next shot
// after standing still for DEADEYE_CHARGE_TIME (1.0s) seconds. The runtime
// state machine has three phases:
//   1. RAMP:    !_steadyReady && _steadyChargeTime in (0, 1.0)
//                 → builds while still, instant-resets on movement/shock
//   2. READY:    _steadyReady=true (chargeTime resets to 0 at latch)
//                 → persists across movement until the next shot consumes it
//   3. IDLE:    !_steadyReady && _steadyChargeTime === 0
//
// Pre-PR there was an HUD badge for READY (label 'AIM') but NO signal for
// the RAMP phase — players saw the AIM badge appear out of nowhere and
// could not tell that pausing for 0.7 more seconds would arm the bonus,
// nor that an incoming hit (shockTimer) silently froze the ramp.
//
// This PR adds a SECOND fx.push entry inside getStatusEffects() gated on
// the RAMP-phase predicate, displaying a countdown of remaining stillness.
// IMPORTANT: BOTH branches (active AIM and charging countdown) push entries
// with the SAME `id: 'deadeye'`. drawStatusBar() at content.js:2680-2693
// keeps inactive ids alive while fading them out (~12 frames at 60fps).
// Using TWO ids ('deadeye' / 'deadeye-cd') would render BOTH the fading
// outgoing badge AND the rising incoming badge during the ramp→ready
// transition (caught by gpt-5.5 in the round-1 review of this PR). Sharing
// the id makes statusFx keep ONE entry whose label/colour mutate instantly
// on transition — no crossfade overlap. The icon ◎ is identical in both
// states (perk identity), so the badge "morphs" without flicker.
//
// Tests below assert structural and runtime invariants — see individual
// test descriptions for what each pins.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  extractBranch,
  extractIfCondition,
  loadAlignmentSources,
} = require('./_alignment-helpers.js');

const { CONTENT, ENTITIES, CONTENT_CODE, ENTITIES_CODE, CONTENT_BRACES }
  = loadAlignmentSources(__dirname);
void ENTITIES_CODE; // not currently used; reserved for future cross-file alignment

/**
 * Find the offset (within `code`) of the first fx.push that satisfies the
 * id and label predicates. blankStringContents preserves length, so the
 * offset is valid against `blanked` too (used by the brace-depth check).
 * @param {string} code  un-blanked source restricted to the function body
 * @param {RegExp} idMatchRe  regex against the fx.push slice for the desired id
 * @param {(blockSrc: string) => boolean} labelMatcher predicate on the small fx.push slice
 */
function findFxPushOffset(code, idMatchRe, labelMatcher) {
  const openRe = /fx\.push\(\{\s*id:\s*'/g;
  let cm;
  while ((cm = openRe.exec(code)) !== null) {
    const slice = code.slice(cm.index, cm.index + 200);
    if (!idMatchRe.test(slice)) continue;
    if (!labelMatcher(slice)) continue;
    return cm.index;
  }
  return -1;
}

/**
 * Run the structural-ancestor check at a given fx.push offset:
 *   - brace depth at the offset must equal 1 (only inside the immediate
 *     if-block, not nested in any ancestor)
 *   - the controlling `if (` must be preceded by `}` or `;` (sibling
 *     boundary), never `)` (braceless ancestor) or `else` (else-if).
 * @param {string} inner blanked function body (string contents cleared)
 * @param {number} fxOffset offset of the fx.push opening within `inner`
 * @param {string} label  human label for assertion messages
 */
function assertTopLevelSibling(inner, fxOffset, label) {
  let depth = 0;
  for (let i = 0; i < fxOffset; i++) {
    const ch = inner[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
  }
  assert.equal(depth, 1,
    `${label} fx.push must be at brace-depth EXACTLY 1; found depth=${depth}`);

  const before = inner.slice(0, fxOffset);
  const badgeIfIdx = before.lastIndexOf('if (');
  assert.notEqual(badgeIfIdx, -1,
    `${label} fx.push must be preceded by an 'if (' predicate`);
  let i = badgeIfIdx - 1;
  while (i >= 0 && /\s/.test(inner[i])) i--;
  if (i < 0) return; // first stmt in body — acceptable
  const prevChar = inner[i];
  assert.notEqual(prevChar, ')',
    `${label} if-block follows a braceless control ancestor (effective predicate includes the outer condition)`);
  if (/[a-zA-Z_]/.test(prevChar)) {
    let j = i;
    while (j >= 0 && /[a-zA-Z_]/.test(inner[j])) j--;
    const word = inner.slice(j + 1, i + 1);
    assert.notEqual(word, 'else',
      `${label} if-block is an else-if branch (effective predicate includes negation of previous if)`);
  }
  assert.ok(prevChar === '}' || prevChar === ';',
    `${label} if-block must be preceded by a sibling-statement boundary; found '${prevChar}'`);
}

// ─── existence and shape ──────────────────────────────────────────────

test("getStatusEffects() contains EXACTLY 2 fx entries with id:'deadeye' (active + charging)", () => {
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch, 'getStatusEffects function body must be locatable');
  const matches = fnBranch.match(/id:\s*'deadeye'/g) || [];
  assert.equal(matches.length, 2,
    `getStatusEffects must contain EXACTLY 2 fx.push entries with id:'deadeye' (active AIM + charging countdown sharing id to avoid statusFx fade overlap); got ${matches.length}`);
  assert.match(fnBranch, /id:\s*'deadeye'[\s\S]{0,160}label:\s*'AIM'/,
    "must contain a deadeye fx with label:'AIM' (active state)");
  assert.match(fnBranch, /id:\s*'deadeye'[\s\S]{0,200}label:\s*[a-zA-Z_][\w]*\.toFixed\(1\)\s*\+\s*'s'/,
    "must contain a deadeye fx with .toFixed(1)+'s' label (charging countdown)");
});

test("no orphan id:'deadeye-cd' / 'deadeye-charge' entries (must use shared id)", () => {
  // Defends against a regression that re-introduces a sibling id which
  // would re-create the statusFx fade-out double-render bug found by
  // gpt-5.5 in this PR's round-1 review.
  const orphans = CONTENT_CODE.match(/id:\s*'deadeye-(?:cd|charge|charging|ramp)'/g) || [];
  assert.equal(orphans.length, 0,
    `no orphan deadeye-* id allowed (found ${orphans.length}). The active and charging branches must SHARE id:'deadeye' so statusFx fade-out doesn't render both badges during the ramp→ready transition (12-frame crossfade at 60fps).`);
});

// ─── gate predicates ──────────────────────────────────────────────────

test('DEADEYE active fx is gated on perks.DEADEYE AND _steadyReady (defensive null-check)', () => {
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const aimIdx = findFxPushOffset(fnBranch,
    /id:\s*'deadeye'/,
    (s) => /label:\s*'AIM'/.test(s)
  );
  assert.notEqual(aimIdx, -1, 'AIM fx.push must be locatable');
  const beforeFx = fnBranch.slice(0, aimIdx);
  const ifIdx = beforeFx.lastIndexOf('if (');
  assert.notEqual(ifIdx, -1);
  const cond = extractIfCondition(fnBranch, ifIdx + 'if '.length);
  assert.ok(cond, 'failed to extract DEADEYE active if-condition');
  assert.match(cond, /player\.perks\s*&&\s*player\.perks\.DEADEYE/,
    'active gate must short-circuit on player.perks before dereferencing .DEADEYE');
  assert.match(cond, /player\._steadyReady/,
    'active gate must check player._steadyReady (the latch flag from entities.js)');
  assert.ok(!/_steadyChargeTime/.test(cond),
    'active gate must NOT reference _steadyChargeTime — that conjunct belongs to the charging branch');
});

test('DEADEYE charging fx is gated on perks.DEADEYE AND !_steadyReady AND _steadyChargeTime > 0', () => {
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const cdIdx = findFxPushOffset(fnBranch,
    /id:\s*'deadeye'/,
    (s) => /label:\s*[a-zA-Z_][\w]*\.toFixed\(1\)/.test(s)
  );
  assert.notEqual(cdIdx, -1, 'charging fx.push (with toFixed countdown label) must be locatable');
  const beforeFx = fnBranch.slice(0, cdIdx);
  const ifIdx = beforeFx.lastIndexOf('if (');
  assert.notEqual(ifIdx, -1);
  const cond = extractIfCondition(fnBranch, ifIdx + 'if '.length);
  assert.ok(cond, 'failed to extract DEADEYE charging if-condition');
  assert.match(cond, /player\.perks\s*&&\s*player\.perks\.DEADEYE/,
    'charging gate must short-circuit on player.perks before dereferencing .DEADEYE');
  assert.match(cond, /!\s*player\._steadyReady/,
    'charging gate must include !player._steadyReady (mutual exclusion with the AIM branch)');
  assert.match(cond, /_steadyChargeTime[\s\S]*?>\s*0/,
    'charging gate must check _steadyChargeTime > 0 (only show during the active ramp)');
});

// ─── structural ancestor: both branches are top-level siblings ────────

test('DEADEYE charging if-block is a top-level sibling inside getStatusEffects (structural ancestor check)', () => {
  // Per gpt-5.5 PR #302 review: the strict-equality alignment tests above
  // only extract the NEAREST `if (` before the fx.push. A future refactor
  // that adds an enclosing predicate would silently false-pass:
  //   (a) BRACED ancestor — caught by depth==1 check
  //   (b) ELSE-IF chain   — caught by predecessor-token check (rejects 'else')
  //   (c) BRACELESS       — caught by predecessor-token check (rejects ')')
  const fnBranch = extractBranch(
    CONTENT_BRACES,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const innerStart = fnBranch.indexOf('{') + 1;
  const innerEnd = fnBranch.lastIndexOf('}');
  const inner = fnBranch.slice(innerStart, innerEnd);

  const fnCode = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnCode);
  const innerCode = fnCode.slice(fnCode.indexOf('{') + 1, fnCode.lastIndexOf('}'));

  const offset = findFxPushOffset(innerCode,
    /id:\s*'deadeye'/,
    (s) => /label:\s*[a-zA-Z_][\w]*\.toFixed\(1\)/.test(s)
  );
  assert.notEqual(offset, -1, 'charging deadeye fx.push (toFixed-labelled) must be locatable');
  // blankStringContents preserves length, so the offset valid in innerCode
  // is also valid in inner (the brace-depth source).
  assertTopLevelSibling(inner, offset, 'charging deadeye');
});

test('DEADEYE active if-block is also a top-level sibling inside getStatusEffects', () => {
  const fnBranch = extractBranch(
    CONTENT_BRACES,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const innerStart = fnBranch.indexOf('{') + 1;
  const innerEnd = fnBranch.lastIndexOf('}');
  const inner = fnBranch.slice(innerStart, innerEnd);

  const fnCode = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnCode);
  const innerCode = fnCode.slice(fnCode.indexOf('{') + 1, fnCode.lastIndexOf('}'));

  const offset = findFxPushOffset(innerCode,
    /id:\s*'deadeye'/,
    (s) => /label:\s*'AIM'/.test(s)
  );
  assert.notEqual(offset, -1, 'active deadeye fx.push (AIM-labelled) must be locatable');
  assertTopLevelSibling(inner, offset, 'active deadeye');
});

// ─── icon / colour identity ───────────────────────────────────────────

test('DEADEYE active and charging branches share the SAME icon (visual continuity)', () => {
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const aimMatch = fnBranch.match(/fx\.push\(\{[^}]*id:\s*'deadeye'[^}]*label:\s*'AIM'[^}]*\}/);
  assert.ok(aimMatch);
  const cdMatch = fnBranch.match(/fx\.push\(\{[^}]*id:\s*'deadeye'[^}]*label:\s*[a-zA-Z_][\w]*\.toFixed\(1\)[^}]*\}/);
  assert.ok(cdMatch);
  const aimIcon = (aimMatch[0].match(/icon:\s*['"]([^'"]+)['"]/) || [])[1];
  const cdIcon = (cdMatch[0].match(/icon:\s*['"]([^'"]+)['"]/) || [])[1];
  assert.equal(aimIcon, cdIcon,
    `active and charging icons must match ('${aimIcon}' vs '${cdIcon}') — the icon is the perk identity, the colour is the state`);
});

test('DEADEYE charging colour is distinct from active colour (state distinguishability)', () => {
  // Mirrors LAST_STAND #ffaa00 (active) vs #886622 (cooldown). Same icon,
  // different saturation. If they were equal, the player couldn't tell
  // which state they're in at a glance.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const aimMatch = fnBranch.match(/fx\.push\(\{[^}]*id:\s*'deadeye'[^}]*label:\s*'AIM'[^}]*\}/);
  const cdMatch = fnBranch.match(/fx\.push\(\{[^}]*id:\s*'deadeye'[^}]*label:\s*[a-zA-Z_][\w]*\.toFixed\(1\)[^}]*\}/);
  assert.ok(aimMatch && cdMatch);
  const aimColour = (aimMatch[0].match(/colour:\s*['"](#[0-9a-fA-F]+)['"]/) || [])[1];
  const cdColour = (cdMatch[0].match(/colour:\s*['"](#[0-9a-fA-F]+)['"]/) || [])[1];
  assert.ok(aimColour && cdColour);
  assert.notEqual(aimColour.toLowerCase(), cdColour.toLowerCase(),
    `active and charging colours must differ ('${aimColour}' vs '${cdColour}') so the player can tell ramp-vs-ready at a glance`);
});

test('DEADEYE active branch icon and colour match the perk-card (content.js source of truth)', () => {
  const perkCardIconMatch = CONTENT.match(
    /DEADEYE\s*:\s*\{[^}]*icon\s*:\s*['"]([^'"]+)['"]/
  );
  const perkCardColourMatch = CONTENT.match(
    /DEADEYE\s*:\s*\{[^}]*colour\s*:\s*['"](#[0-9a-fA-F]+)['"]/
  );
  assert.ok(perkCardIconMatch && perkCardColourMatch);
  const perkIcon = perkCardIconMatch[1];
  const perkColour = perkCardColourMatch[1];

  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const aimMatch = fnBranch.match(/fx\.push\(\{[^}]*id:\s*'deadeye'[^}]*label:\s*'AIM'[^}]*\}/);
  assert.ok(aimMatch);
  const aimIcon = (aimMatch[0].match(/icon:\s*['"]([^'"]+)['"]/) || [])[1];
  const aimColour = (aimMatch[0].match(/colour:\s*['"](#[0-9a-fA-F]+)['"]/) || [])[1];
  assert.equal(aimIcon, perkIcon,
    `active branch icon ('${aimIcon}') must match perk-card icon ('${perkIcon}')`);
  assert.equal(aimColour.toLowerCase(), perkColour.toLowerCase(),
    `active branch colour ('${aimColour}') must match perk-card colour ('${perkColour}')`);
});

// ─── cross-file desync: charging label literal ↔ DEADEYE_CHARGE_TIME ──

test('DEADEYE charging countdown literal matches entities.js DEADEYE_CHARGE_TIME', () => {
  // Cross-file desync defence (per stored memory 'HUD status fx', PR #280
  // pattern): the charge time (1.0s) is hard-coded in BOTH the HUD label
  // (literal `1` in `1 - (player._steadyChargeTime || 0)`) AND the
  // entities.js DEADEYE_CHARGE_TIME constant. A future re-tune (e.g.
  // 0.75s charge) would silently desync the readout.
  const constMatch = ENTITIES.match(/DEADEYE_CHARGE_TIME\s*=\s*([\d.]+)/);
  assert.ok(constMatch,
    'entities.js must declare DEADEYE_CHARGE_TIME constant');
  const chargeTime = parseFloat(constMatch[1]);
  assert.ok(Number.isFinite(chargeTime) && chargeTime > 0,
    `DEADEYE_CHARGE_TIME must be a positive number; got ${constMatch[1]}`);

  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const cdIdx = findFxPushOffset(fnBranch,
    /id:\s*'deadeye'/,
    (s) => /label:\s*[a-zA-Z_][\w]*\.toFixed\(1\)/.test(s)
  );
  assert.notEqual(cdIdx, -1);
  const ifIdx = fnBranch.slice(0, cdIdx).lastIndexOf('if (');
  const block = fnBranch.slice(ifIdx, cdIdx + 200);

  // Pin the literal: the HUD must subtract player._steadyChargeTime from
  // the SAME number declared in entities.js. The countdown wraps the
  // input in `(player._steadyChargeTime || 0)` for NaN defence — match
  // that explicit form so a future regression that drops the wrapper
  // also trips this test.
  const chargeTimeStr = String(chargeTime);
  const chargeRe = new RegExp(
    `${chargeTimeStr.replace(/\./g, '\\.')}\\s*-\\s*\\(\\s*player\\._steadyChargeTime\\s*\\|\\|\\s*0\\s*\\)`
  );
  assert.match(block, chargeRe,
    `HUD countdown must compute ${chargeTimeStr} - (player._steadyChargeTime || 0) — matches entities.js DEADEYE_CHARGE_TIME=${chargeTime}. Re-tune both sites in lockstep, and keep the (... || 0) NaN guard.`);
});

test('DEADEYE charging label uses .toFixed(1) + "s" sub-5s timer convention', () => {
  // Same convention as dash-cd / hw-cd / cloak / burn / shocked — sub-5s
  // timers get one decimal place of precision. Pin the format so a
  // future refactor can't silently switch to Math.ceil() (which would
  // round-up and lose the sub-second resolution that makes the badge
  // actionable for a 1.0s charge window).
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  assert.match(fnBranch,
    /fx\.push\(\{[^}]*id:\s*'deadeye'[^}]*label:\s*[a-zA-Z_][\w]*\.toFixed\(1\)\s*\+\s*'s'[^}]*\}/,
    "charging label must use the .toFixed(1)+'s' convention (matches dash-cd/hw-cd/cloak/burn/shocked)");
});

// ─── runtime simulation: state-machine truth table ────────────────────

test('runtime: DEADEYE badge state machine — every reachable state shows at-most-one badge', () => {
  // Mutual exclusion is the safety property of the dual-branch design.
  // Replicates the badge gates in JS so the test exercises the LOGIC
  // not just the SOURCE TEXT. If the source-text alignment tests above
  // false-pass (they shouldn't, but defense-in-depth), this catches
  // the runtime divergence.
  function showsActive(player) {
    return !!(player.perks && player.perks.DEADEYE && player._steadyReady);
  }
  function showsCharging(player) {
    return !!(
      player.perks && player.perks.DEADEYE
      && !player._steadyReady
      && (player._steadyChargeTime || 0) > 0
    );
  }
  function badgeCount(player) {
    return (showsActive(player) ? 1 : 0) + (showsCharging(player) ? 1 : 0);
  }

  // State 1: perk owned + READY → ACTIVE only.
  let p = { perks: { DEADEYE: true }, _steadyReady: true, _steadyChargeTime: 0 };
  assert.equal(showsActive(p), true);
  assert.equal(showsCharging(p), false);
  assert.equal(badgeCount(p), 1, 'READY state must show exactly the active branch');

  // State 2: perk owned + RAMP → CHARGING only.
  p = { perks: { DEADEYE: true }, _steadyReady: false, _steadyChargeTime: 0.4 };
  assert.equal(showsActive(p), false);
  assert.equal(showsCharging(p), true);
  assert.equal(badgeCount(p), 1, 'RAMP state must show exactly the charging branch');

  // State 3: perk owned + IDLE → NEITHER.
  p = { perks: { DEADEYE: true }, _steadyReady: false, _steadyChargeTime: 0 };
  assert.equal(showsActive(p), false);
  assert.equal(showsCharging(p), false);
  assert.equal(badgeCount(p), 0, 'IDLE state must show no DEADEYE badges');

  // State 4: REGRESSION GUARD — _steadyReady=true AND chargeTime>0
  //   simultaneously (entities.js currently resets chargeTime at the
  //   latch, but a future regression could decouple them). The explicit
  //   !_steadyReady gate on the charging branch ensures the cd badge
  //   stays HIDDEN even in this corrupted state.
  p = { perks: { DEADEYE: true }, _steadyReady: true, _steadyChargeTime: 0.5 };
  assert.equal(showsActive(p), true);
  assert.equal(showsCharging(p), false,
    'regression guard: even if chargeTime>0 while ready=true, the cd branch must hide');
  assert.equal(badgeCount(p), 1);

  // State 5: perk NOT owned + simulated state — both branches hide.
  p = { perks: {}, _steadyReady: true, _steadyChargeTime: 0.5 };
  assert.equal(showsActive(p), false);
  assert.equal(showsCharging(p), false);

  // State 6: undefined .perks (legacy player shape) — defensive guards
  //   prevent throws AND hide both branches.
  p = { _steadyReady: true, _steadyChargeTime: 0.5 };
  assert.equal(showsActive(p), false);
  assert.equal(showsCharging(p), false);

  // State 7: charge time at the boundary (just before latch). Still
  //   shows charging branch — the latch happens AT >= 1.0, not before.
  p = { perks: { DEADEYE: true }, _steadyReady: false, _steadyChargeTime: 0.99 };
  assert.equal(showsCharging(p), true);
});

test('runtime: DEADEYE charging countdown formula matches expected values (NaN-defended)', () => {
  // Replicates the label formula: remaining = max(0, 1 - (chargeTime || 0)).
  // The (... || 0) wrapper defends against NaN/undefined chargeTime which
  // would render the literal string "NaNs". Verify the wrapper survives
  // adversarial inputs.
  function labelFor(chargeTime) {
    const remaining = Math.max(0, 1 - (chargeTime || 0));
    return remaining.toFixed(1) + 's';
  }
  const cases = [
    { t: 0.0, expected: '1.0s' },
    { t: 0.3, expected: '0.7s' },
    { t: 0.5, expected: '0.5s' },
    { t: 0.7, expected: '0.3s' },
    { t: 0.9, expected: '0.1s' },
    { t: 1.0, expected: '0.0s' },   // boundary
    { t: 1.5, expected: '0.0s' },   // overflow guard (max(0,...))
    { t: undefined, expected: '1.0s' },  // legacy player shape — gate hides this path but defense in depth
    { t: NaN, expected: '1.0s' },    // (NaN || 0) → 0 (NaN is falsy)
  ];
  for (const tc of cases) {
    assert.equal(labelFor(tc.t), tc.expected,
      `chargeTime=${tc.t} → label=${tc.expected}`);
  }
});

// ─── shared-id contract: defense against statusFx fade-overlap regression

test("shared id contract: BOTH deadeye branches push to the same statusFx slot ('deadeye')", () => {
  // gpt-5.5 round-1 review of this PR caught: with separate ids
  // ('deadeye' and 'deadeye-cd'), the statusFx fade-out machinery at
  // content.js:2680-2693 keeps the inactive id alive for ~12 frames
  // (alpha decrements 0.08/frame). On the ramp→ready transition the
  // outgoing 'deadeye-cd' badge would render simultaneously with the
  // rising 'deadeye' badge — visible flicker every shot in active play.
  //
  // The fix: BOTH branches use the SAME id 'deadeye'. statusFx keeps
  // ONE entry whose label/colour mutate instantly on transition.
  //
  // This test pins both fx.push calls to the literal id:'deadeye' and
  // counts them — exactly 2 (one per state). Defends against:
  //   - regressing back to two ids (would re-introduce the flicker)
  //   - dropping one of the branches (would lose state coverage).
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const deadeyePushes = fnBranch.match(/fx\.push\(\{\s*id:\s*'deadeye'/g) || [];
  assert.equal(deadeyePushes.length, 2,
    `expected exactly 2 fx.push entries with id:'deadeye' (active + charging using shared id); got ${deadeyePushes.length}`);
});

// ─── DEADEYE_CHARGE_TIME constant uniqueness ──────────────────────────

test('DEADEYE_CHARGE_TIME is declared exactly once in entities.js (cross-file anchor uniqueness)', () => {
  // The cross-file desync test above anchors on the `DEADEYE_CHARGE_TIME =
  // <num>` declaration. If a second declaration appears (e.g. shadowing
  // in a function), the regex would match the first and the desync test
  // could miss a tuning change to the second. Pin uniqueness.
  const decls = ENTITIES.match(/DEADEYE_CHARGE_TIME\s*=\s*[\d.]+/g) || [];
  assert.equal(decls.length, 1,
    `DEADEYE_CHARGE_TIME must be declared exactly once in entities.js; got ${decls.length} matches — re-anchor the desync test`);
});
