'use strict';
// RETRIBUTION HUD discoverability — clutch-window timer indicator.
//
// CONTEXT: RETRIBUTION is a perk that triggers when Player.takeDamage applies
// non-zero actual damage (entities.js:11568 — `if (this.perks.RETRIBUTION)
// this.retributionTimer = 3`). For the next 3 seconds the player deals +50%
// outgoing damage via effectiveAtk() (entities.js:11349). The timer is
// dt-decremented in Player.update (entities.js:12008) so 30/60/120fps expire
// identically. The perk has no cooldown — every damage-trade refreshes the
// 3s window.
//
// Pre-PR: there was NO HUD indicator that the buff was active. Players in
// hit-trade builds saw their outgoing damage spike after taking a hit but
// had no signal that a buff had triggered, no countdown until expiry, and
// no way to anticipate when to press the advantage. This is the same
// "invisible buff" UX gap that PRs #276 (LAST_STAND clutch window), #280
// (HOT_HAND streak), #282 (MOMENTUM kill-buff), and #284 (REGEN) all closed
// for their respective perks.
//
// This PR adds a single fx.push entry in `getStatusEffects()` (src/content.js)
// gated on `player.perks.RETRIBUTION && player.retributionTimer > 0`,
// mirroring the LAST_STAND active-window pattern (timer-driven, .toFixed(1)
// + 's' label, perk-card icon ☄ + colour #ff2266 from content.js:4512).
//
// content.js is browser-only (UMD-loaded), so these tests assert structural
// invariants on the source text:
//   - The fx.push call exists inside getStatusEffects with id='retribution'.
//   - It is gated on `player.perks.RETRIBUTION && player.retributionTimer > 0`
//     (not just retributionTimer, which would surface a phantom buff to a
//     non-perk-owner if a future regression touched the field).
//   - Defensive `player.perks &&` null-check (perks may be undefined on
//     legacy player shapes that bypassed the ctor).
//   - Label uses .toFixed(1) for sub-second precision (matches the
//     adrenalineTimer / lastStandTimer / burnTimer / shockTimer style —
//     short timers need decimal precision to feel responsive).
//   - Icon ☄ matches the perk-card glyph at content.js:4512 (visual
//     identification: badge ↔ perk).
//   - Colour #ff2266 matches the perk-card colour at content.js:4512
//     EXACTLY (cross-file desync defence per stored memory 'HUD status fx').

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  extractBranch,
  extractIfCondition,
  normaliseMultiplierPredicate,
  normaliseBadgePredicate,
  loadAlignmentSources,
} = require('./_alignment-helpers.js');

const { CONTENT, ENTITIES_CODE, CONTENT_CODE } = loadAlignmentSources(__dirname);

// ─── getStatusEffects() RETRIBUTION fx entry ──────────────────────────

test('getStatusEffects() function body contains a RETRIBUTION-gated fx.push entry', () => {
  // Scope to the getStatusEffects function body via brace-walked extraction
  // so a stray 'retribution' string elsewhere in content.js can't satisfy
  // this assertion (per stored memory 'test source-text extraction').
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch, 'getStatusEffects function body must be locatable');
  assert.match(fnBranch, /id:\s*'retribution'/,
    'getStatusEffects must contain an fx entry with id: "retribution"');
});

test('RETRIBUTION fx entry is gated on perk-ownership AND active timer', () => {
  // Both gates required: WITHOUT perks.RETRIBUTION a regression that sets
  // retributionTimer on a non-owner (e.g. shared timer init) would surface
  // a phantom buff to the player. Pin the AND-composition.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  // Locate the controlling if-statement that wraps the retribution fx.push
  // by anchoring on the .perks.RETRIBUTION substring AND the timer gate.
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*\.perks[^)]*RETRIBUTION[^)]*retributionTimer[^)]*>\s*0[^)]*\)\s*\{/
  );
  assert.ok(ifBranch,
    'RETRIBUTION fx.push must sit inside an if-block that gates on player.perks.RETRIBUTION AND player.retributionTimer > 0');
  assert.match(ifBranch, /id:\s*'retribution'/,
    'RETRIBUTION fx.push must be inside the perks.RETRIBUTION && retributionTimer > 0 gate');
});

test('RETRIBUTION fx entry guards against undefined player.perks (defensive null-check)', () => {
  // Some legacy player shapes (test sandboxes, save migrations) bypass the
  // ctor and don't have a .perks object. Without `player.perks &&` the
  // helper would throw on `undefined.RETRIBUTION`. Pin the defensive guard.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  // The if-condition must include `player.perks &&` BEFORE
  // `player.perks.RETRIBUTION` (short-circuit evaluation prevents null-deref).
  assert.match(fnBranch,
    /player\.perks\s*&&\s*player\.perks\.RETRIBUTION\s*&&\s*player\.retributionTimer\s*>\s*0/,
    'RETRIBUTION gate must short-circuit on player.perks before dereferencing .RETRIBUTION');
});

test('RETRIBUTION fx label uses toFixed(1) for sub-second precision (matches adrenalineTimer pattern)', () => {
  // Short timers (3s) need decimal precision so the player can see the
  // window closing in real-time. `Math.ceil(timer)+'s'` (the pattern used
  // by reactive-armor's 8s cooldown / last-stand-cd's 60s cooldown) would
  // round 0.4s up to '1s' until the very last frame — feels unresponsive
  // for a clutch window.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*\.perks[^)]*RETRIBUTION[^)]*\)\s*\{/
  );
  assert.ok(ifBranch);
  assert.match(ifBranch,
    /label:\s*player\.retributionTimer\.toFixed\(1\)\s*\+\s*['"]s['"]/,
    'RETRIBUTION fx label must use .toFixed(1) + "s" (sub-second precision for the 3s clutch window)');
});

test('RETRIBUTION fx entry has icon and colour set (HUD-renderer reads them generically)', () => {
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*\.perks[^)]*RETRIBUTION[^)]*\)\s*\{/
  );
  assert.ok(ifBranch);
  assert.match(ifBranch, /icon:\s*['"][^'"]+['"]/,
    'RETRIBUTION fx entry must carry an icon glyph');
  assert.match(ifBranch, /colour:\s*['"]#[0-9a-fA-F]+['"]/,
    'RETRIBUTION fx entry must carry a hex colour');
});

test('RETRIBUTION fx entry id appears EXACTLY once in content.js', () => {
  // A duplicate fx entry (e.g. via merge / copy-paste) would double-render
  // the indicator in statusFx (which keys on id). Pin the count.
  const all = CONTENT_CODE.match(/id:\s*'retribution'/g) || [];
  assert.equal(all.length, 1,
    `content.js must contain exactly 1 id: 'retribution' fx entry; got ${all.length}`);
});

// ─── cross-file desync defence: badge icon/colour ↔ perk-card ─────────

test('RETRIBUTION badge icon matches the perk-card glyph (content.js:4512 source of truth)', () => {
  // Per stored memory 'HUD status fx': when an HUD literal mirrors a
  // tuning constant in another file (or another section of the same file),
  // a divergence will silently desync. The PERKS table at ~content.js:4512
  // declares { name:'Retribution', icon:'☄', desc:'...', colour:'#ff2266' }
  // — that is the source of truth for the perk's identity. The badge
  // icon must match so players see the same glyph on the perk-card and
  // in the HUD.
  //
  // Extract the perk-card icon from the PERKS table entry by anchoring
  // on the RETRIBUTION key and reading the icon literal that follows.
  const perkCardMatch = CONTENT.match(
    /RETRIBUTION:\s*\{[^}]*icon:\s*['"]([^'"]+)['"]/
  );
  assert.ok(perkCardMatch,
    'RETRIBUTION perk-card entry must declare an icon literal');
  const perkCardIcon = perkCardMatch[1];

  // Extract the badge icon from the getStatusEffects fx.push.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*\.perks[^)]*RETRIBUTION[^)]*\)\s*\{/
  );
  assert.ok(ifBranch);
  const badgeIconMatch = ifBranch.match(/icon:\s*['"]([^'"]+)['"]/);
  assert.ok(badgeIconMatch, 'RETRIBUTION badge must declare an icon literal');

  assert.equal(badgeIconMatch[1], perkCardIcon,
    `RETRIBUTION badge icon ('${badgeIconMatch[1]}') must match the perk-card icon ('${perkCardIcon}') at content.js PERKS table — re-tuning one without the other silently desyncs the visual signal.`);
});

test('RETRIBUTION badge colour matches the perk-card colour (content.js:4512 source of truth)', () => {
  // Same desync defence as the icon test above, but for the hex colour.
  const perkCardMatch = CONTENT.match(
    /RETRIBUTION:\s*\{[^}]*colour:\s*['"](#[0-9a-fA-F]+)['"]/
  );
  assert.ok(perkCardMatch,
    'RETRIBUTION perk-card entry must declare a hex colour literal');
  const perkCardColour = perkCardMatch[1];

  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*\.perks[^)]*RETRIBUTION[^)]*\)\s*\{/
  );
  assert.ok(ifBranch);
  const badgeColourMatch = ifBranch.match(/colour:\s*['"](#[0-9a-fA-F]+)['"]/);
  assert.ok(badgeColourMatch,
    'RETRIBUTION badge must declare a hex colour literal');

  assert.equal(badgeColourMatch[1].toLowerCase(), perkCardColour.toLowerCase(),
    `RETRIBUTION badge colour ('${badgeColourMatch[1]}') must match the perk-card colour ('${perkCardColour}') at content.js PERKS table — re-tuning one without the other silently desyncs the visual signal.`);
});

// ─── runtime simulation: gate semantics ────────────────────────────────

test('runtime: RETRIBUTION fx-gate semantics — five-state truth table', () => {
  // Behavioural complement: replicate the gate predicate on synthetic
  // player shapes and verify the truth table. Mirrors the LAST_STAND
  // companion test at tests/last-stand-hud.test.js.
  //
  // SCOPE NOTE (per gpt-5.5 review): this is a STRUCTURAL assertion
  // about THIS gate's predicate, not a guarantee that getStatusEffects()
  // as a whole is null-safe — the function unguarded-derefs
  // `player.perks.ENERGY_SHIELD` earlier at content.js:2292, so a real
  // call with `player = { retributionTimer: 2.4 }` would crash before
  // reaching this gate. The defensive `player.perks &&` short-circuit
  // in the RETRIBUTION gate is defense-in-depth: if a future refactor
  // moves the badge gate, removes the earlier ENERGY_SHIELD branch, or
  // adds an early `if (!player.perks) return fx` short-circuit, this
  // gate will not regress into a null-deref.
  function shouldShowFx(player) {
    return !!(player.perks && player.perks.RETRIBUTION && player.retributionTimer > 0);
  }

  // Perk owned + active window → show.
  assert.equal(shouldShowFx({ perks: { RETRIBUTION: true }, retributionTimer: 2.4 }),
    true, 'perk owned + timer active must show fx');

  // Perk owned + no active window → hide.
  assert.equal(shouldShowFx({ perks: { RETRIBUTION: true }, retributionTimer: 0 }),
    false, 'perk owned but timer expired must hide fx');

  // Perk NOT owned + active window (regression scenario) → hide.
  assert.equal(shouldShowFx({ perks: {}, retributionTimer: 2.4 }),
    false, 'phantom timer without perk-ownership must NOT show fx (regression defence)');

  // No perks object at all → THIS GATE hides without throwing (structural
  // defense-in-depth — does NOT imply getStatusEffects() as a whole is
  // null-safe; see SCOPE NOTE above).
  assert.equal(shouldShowFx({ retributionTimer: 2.4 }),
    false, 'undefined perks must hide THIS GATE without throwing (defense-in-depth, not a getStatusEffects contract)');

  // Negative timer (NaN-poison defence) → hide.
  assert.equal(shouldShowFx({ perks: { RETRIBUTION: true }, retributionTimer: -1 }),
    false, 'negative timer must hide fx (NaN-poison defence)');
});

// ─── runtime simulation: trigger pipeline alignment ────────────────────

test('runtime: RETRIBUTION badge gate predicate matches the multiplier gate predicate EXACTLY', () => {
  // The badge gate (content.js getStatusEffects) MUST be predicate-equal
  // to the multiplier gate (entities.js effectiveAtk, line ~11349:
  //   `if (this.perks.RETRIBUTION && this.retributionTimer > 0) a = Math.round(a * 1.5);`)
  // after stripping the defensive `player.perks &&` short-circuit.
  //
  // Per gpt-5.3-codex + gpt-5.5 reviews: a substring match is insufficient
  // — a future change could ADD a conjunct/disjunct to either gate
  // (e.g. `&& !this._suppressed`, `|| forceBuff`) and a substring assertion
  // would silently false-pass while the badge↔multiplier contract breaks.
  // This test extracts the FULL if-condition from BOTH sides and asserts
  // strict equality after side-specific normalisation (PR #312/#318 pattern,
  // upgraded from older bidirectional pattern in PR #351 / this PR).

  // ── Extract entities.js multiplier-gate condition ──
  // Anchor on the multiplier statement `a = Math.round(a * 1.5)` (the
  // RETRIBUTION-specific multiplier; no other site uses this exact
  // expression — verified below). Walk back from there to find the
  // controlling `if (`.
  const mulIdx = ENTITIES_CODE.indexOf('a = Math.round(a * 1.5)');
  assert.notEqual(mulIdx, -1,
    'entities.js must contain the RETRIBUTION multiplier statement `a = Math.round(a * 1.5)`');
  // Verify uniqueness — if another perk later adds the same multiplier,
  // this anchor stops being a stable reference and the test must be
  // updated to re-anchor on something specific.
  const allMul = ENTITIES_CODE.match(/a = Math\.round\(a \* 1\.5\)/g) || [];
  assert.equal(allMul.length, 1,
    `multiplier anchor must be unique; got ${allMul.length} matches in entities.js — re-anchor the alignment test`);

  // Walk backwards from mulIdx to find the most recent `if (` on the
  // same line (the multiplier is a single-line if-statement, no braces).
  const lineStart = ENTITIES_CODE.lastIndexOf('\n', mulIdx) + 1;
  const linePrefix = ENTITIES_CODE.slice(lineStart, mulIdx);
  const ifLocalIdx = linePrefix.indexOf('if (');
  assert.notEqual(ifLocalIdx, -1,
    'multiplier statement must be guarded by an `if (` on the same line');
  const ifAbsIdx = lineStart + ifLocalIdx;
  const openParenIdx = ifAbsIdx + 'if '.length; // points at '('
  const mulCond = extractIfCondition(ENTITIES_CODE, openParenIdx);
  assert.ok(mulCond,
    'failed to extract multiplier if-condition from entities.js');

  // ── Extract content.js badge-gate condition ──
  // Anchor on `id: 'retribution'` and walk back to the controlling `if (`.
  const fxIdx = CONTENT_CODE.indexOf("id: 'retribution'");
  assert.notEqual(fxIdx, -1,
    "content.js must contain the badge fx.push entry with id: 'retribution'");
  // Walk backwards to find the nearest `if (` BEFORE this fx.push. The
  // immediately-preceding if is the controlling gate (no nested if-blocks
  // inside the gate per the implementation pattern).
  const beforeFx = CONTENT_CODE.slice(0, fxIdx);
  const badgeIfIdx = beforeFx.lastIndexOf('if (');
  assert.notEqual(badgeIfIdx, -1,
    'badge fx.push must be controlled by an `if (` predicate');
  const badgeOpenParenIdx = badgeIfIdx + 'if '.length;
  const badgeCond = extractIfCondition(CONTENT_CODE, badgeOpenParenIdx);
  assert.ok(badgeCond,
    'failed to extract badge if-condition from content.js');

  // ── Compare normalised predicates (side-specific, per PR #312/#318/#351) ──
  // Multiplier side: strips ONLY `this.`. Badge side: strips ONLY `player.`
  // (plus leading defensive `player.perks &&`). Side-specific stripping
  // (NOT bidirectional) fails loudly on mixed-receiver bugs that
  // bidirectional stripping silently masks (e.g. `player.perks &&
  // this.perks.RETRIBUTION` would crash at runtime since `this` is
  // undefined inside getStatusEffects(player); bidirectional strip
  // would silently false-pass).
  const mulNorm = normaliseMultiplierPredicate(mulCond);
  const badgeNorm = normaliseBadgePredicate(badgeCond);

  // Side-specific leftover-token assertions (per PR #312/#318/#351):
  // mixing receivers is a real bug.
  assert.ok(!/\bplayer\b/.test(mulNorm),
    `multiplier predicate (entities.js) must not reference \`player\` — found leftover after normalisation: ${mulNorm}. The multiplier sits inside Player.effectiveAtk(); mixing receivers is a real bug.`);
  assert.ok(!/\bthis\b/.test(badgeNorm),
    `badge predicate (content.js) must not reference \`this\` — found leftover after normalisation: ${badgeNorm}. The badge sits inside the free function getStatusEffects(player); using \`this\` would resolve to undefined in strict mode (TypeError) or the global object (wrong receiver).`);

  assert.equal(badgeNorm, mulNorm,
    `badge gate predicate must match multiplier gate predicate after side-specific normalisation.\n  multiplier (entities.js):  ${mulCond}\n    → normalised:            ${mulNorm}\n  badge      (content.js):   ${badgeCond}\n    → normalised:            ${badgeNorm}\n  If you intentionally added/removed a conjunct on one side, update BOTH sides — the badge↔bonus visual contract requires identical predicates.`);

  // Sanity: the normalised predicate must contain BOTH the perk-ownership
  // gate AND the timer gate (catches a normalisation bug that strips too
  // much).
  assert.ok(/perks\.RETRIBUTION/.test(mulNorm),
    'normalised predicate must retain perks.RETRIBUTION');
  assert.ok(/retributionTimer>0/.test(mulNorm),
    'normalised predicate must retain retributionTimer>0');
});
