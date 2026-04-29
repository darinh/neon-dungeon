'use strict';
// GLASS_CANNON HUD discoverability — passive +30% ATK / +25% incoming
// damage trade. The only currently-invisible always-on multiplier perk
// in the roster (every other passive ATK-mod surfaces SOMETHING — STRIDE
// shows RUSH ×N, OVERDRIVE shows ❯ ×N, RETRIBUTION shows ☄ Ns,
// HOT_HAND shows ♨ ×N, MOMENTUM shows the throttle bar, BULWARK shows
// ◈ WARD). Pre-PR the player took 25% extra direct damage with no
// visual cue that GLASS_CANNON was the cause — same UX gap that PRs
// #276/280/282/284/300/302/304/318 closed for their respective buffs.
//
// CONTRACT: the badge is a pure perk-ownership signal — GLASS_CANNON
// has no state (no timer, no stacks, no HP threshold). Owning the
// perk IS the active condition. There are TWO multiplier sites:
//
//   1. OFFENSIVE (entities.js:11661, in Player.effectiveAtk()):
//        if (this.perks.GLASS_CANNON) a = Math.round(a * 1.30);
//      Pure perk-ownership gate — single conjunct, single statement,
//      braceless. This is the ALIGNMENT ANCHOR for the badge.
//
//   2. DEFENSIVE (entities.js:11838, in Player.takeDamage()):
//        if (this.perks.GLASS_CANNON && !options.ignoreDefense) {
//          actual = Math.max(1, Math.round(actual * 1.25));
//        }
//      GLASS_CANNON ownership PLUS the env-DoT exemption clause
//      (Plasma burnDps*dt, Toxic toxDps*dt, Arc Grid, Disruption
//      Field, Frost Patch — all pass sub-1 fractional damage with
//      ignoreDefense:true; without the gate, Math.max(1, …) would
//      inflate ~0.04-0.13/frame env DoT to ~1/frame ≈ 60 DPS
//      instakill at 60 FPS — same gate pattern as
//      FRAGILE/HUNTER/CORROSIVE).
//
// The badge gate matches site 1 EXACTLY. Site 2's extra conjunct
// (`!options.ignoreDefense`) is INTENTIONALLY not mirrored — the
// badge represents "you OWN the perk", not "you are CURRENTLY
// taking direct damage". A truthful badge would either flicker at
// 60Hz during burn-tick (pointless) or omit the trade entirely
// (worse — invisible). The chosen design surfaces the perk
// permanently while the perk is owned, with the defensive-cost
// asymmetry documented in code comments.
//
// Tests below assert structural and runtime invariants:
//   - The fx.push call exists inside getStatusEffects with id='glass-cannon'.
//   - It is gated on perks.GLASS_CANNON only (no extra conjuncts that
//     would silently shift visibility away from "perk-owned").
//   - Defensive `player.perks &&` null-check (perks may be undefined
//     on legacy player shapes that bypassed the ctor).
//   - Label is a static action word (passive perk, no per-frame
//     timer formatting needed — identical UX to BULWARK 'WARD').
//   - Icon ⟁ matches the perk-card glyph at content.js:4718.
//   - Colour #ff66aa matches the perk-card colour at content.js:4718
//     EXACTLY (cross-file desync defence per stored memory 'HUD status fx').
//   - Strict-equality predicate alignment: badge gate matches the
//     OFFENSIVE multiplier gate from entities.js after normalisation
//     (per stored memory 'HUD status fx' / 'cross-file alignment tests').
//   - Structural ancestor check on the BADGE side: depth==1 inside
//     getStatusEffects + sibling-statement boundary predecessor token.
//   - DEFENSIVE-site delta check: the takeDamage gate for GLASS_CANNON
//     differs from the badge gate by EXACTLY the `!options.ignoreDefense`
//     conjunct — closes the bypass class where a future refactor adds
//     a third conjunct on the defensive side that the badge doesn't
//     reflect (e.g. `&& !this._suppressed` would silently shift the
//     defensive cost without surfacing it through the badge).
//   - Multiplier-VALUE pinning: offensive ×1.30 and defensive ×1.25
//     literals are asserted in their expected sites — re-tuning either
//     value should be a deliberate decision, not a silent drift.
//   - Defensive-site brace-depth + body-content checks (mirrors PR #312
//     5-layer pattern): the defensive multiplier sits at depth==1
//     inside Player.takeDamage(), and its if-block body is EXACTLY
//     the canonical statement (no hidden inline gate, no follow-up
//     undo).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  extractBranch,
  extractIfCondition,
  normaliseMultiplierPredicate,
  normaliseBadgePredicate,
  loadAlignmentSources,
} = require('./_alignment-helpers.js');

const { CONTENT, CONTENT_CODE, ENTITIES_CODE, CONTENT_BRACES, ENTITIES_BRACES }
  = loadAlignmentSources(__dirname);

// ─── getStatusEffects() GLASS_CANNON fx entry ──────────────────────────

test('getStatusEffects() function body contains a GLASS_CANNON-gated fx.push entry', () => {
  // Scope to the getStatusEffects function body via brace-walked extraction
  // so a stray 'glass-cannon' string elsewhere in content.js can't satisfy
  // this assertion (per stored memory 'test source-text extraction').
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch, 'getStatusEffects function body must be locatable');
  assert.match(fnBranch, /id:\s*'glass-cannon'/,
    "getStatusEffects must contain an fx entry with id: 'glass-cannon'");
});

test('GLASS_CANNON fx entry is gated on perk-ownership only (no extra conjuncts)', () => {
  // GLASS_CANNON has NO state — no timer, no stacks, no HP threshold.
  // Owning the perk IS the active condition. A future refactor that
  // ADDS a state gate (e.g. `&& !player._cannonSuppressed`) would
  // silently shift visibility away from "perk-owned" — caught here
  // by asserting the if-condition contains EXACTLY the perk-ownership
  // tokens after stripping the defensive short-circuit.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  // Locate the controlling if-statement that wraps the glass-cannon
  // fx.push by anchoring on the .perks.GLASS_CANNON substring.
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*\.perks[^)]*GLASS_CANNON[^)]*\)\s*\{/
  );
  assert.ok(ifBranch,
    'GLASS_CANNON fx.push must sit inside an if-block that gates on player.perks.GLASS_CANNON');
  assert.match(ifBranch, /id:\s*'glass-cannon'/,
    'GLASS_CANNON fx.push must be inside the perks.GLASS_CANNON gate');
});

test('GLASS_CANNON fx entry guards against undefined player.perks (defensive null-check)', () => {
  // Some legacy player shapes (test sandboxes, save migrations) bypass
  // the ctor and don't have a .perks object. Without `player.perks &&`
  // the helper would throw on `undefined.GLASS_CANNON`. Pin the guard.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  // The if-condition must include `player.perks &&` BEFORE
  // `player.perks.GLASS_CANNON` (short-circuit prevents null-deref).
  assert.match(fnBranch,
    /player\.perks\s*&&\s*player\.perks\.GLASS_CANNON/,
    'GLASS_CANNON gate must short-circuit on player.perks before dereferencing .GLASS_CANNON');
});

test('GLASS_CANNON fx entry has icon, label, and colour set (HUD-renderer reads them generically)', () => {
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*\.perks[^)]*GLASS_CANNON[^)]*\)\s*\{/
  );
  assert.ok(ifBranch);
  assert.match(ifBranch, /icon:\s*['"][^'"]+['"]/,
    'GLASS_CANNON fx entry must carry an icon glyph');
  assert.match(ifBranch, /label:\s*['"][^'"]+['"]/,
    'GLASS_CANNON fx entry must carry a label string');
  assert.match(ifBranch, /colour:\s*['"]#[0-9a-fA-F]+['"]/,
    'GLASS_CANNON fx entry must carry a hex colour');
});

test("GLASS_CANNON fx entry id appears EXACTLY once in content.js", () => {
  // A duplicate fx entry (e.g. via merge / copy-paste) would double-render
  // the indicator in statusFx (which keys on id). Pin the count.
  const all = CONTENT_CODE.match(/id:\s*'glass-cannon'/g) || [];
  assert.equal(all.length, 1,
    `content.js must contain exactly 1 id: 'glass-cannon' fx entry; got ${all.length}`);
});

// ─── cross-file desync defence: badge icon/colour ↔ perk-card ─────────

test('GLASS_CANNON badge icon matches the perk-card glyph (content.js PERKS table source of truth)', () => {
  // Per stored memory 'HUD status fx': when an HUD literal mirrors a
  // tuning constant declared elsewhere (PERKS table at content.js:4718),
  // a divergence will silently desync. Pin the icon.
  const perkCardMatch = CONTENT.match(
    /GLASS_CANNON:\s*\{[^}]*icon:\s*['"]([^'"]+)['"]/
  );
  assert.ok(perkCardMatch,
    'GLASS_CANNON perk-card entry must declare an icon literal');
  const perkCardIcon = perkCardMatch[1];

  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*\.perks[^)]*GLASS_CANNON[^)]*\)\s*\{/
  );
  assert.ok(ifBranch);
  const badgeIconMatch = ifBranch.match(/icon:\s*['"]([^'"]+)['"]/);
  assert.ok(badgeIconMatch, 'GLASS_CANNON badge must declare an icon literal');

  assert.equal(badgeIconMatch[1], perkCardIcon,
    `GLASS_CANNON badge icon ('${badgeIconMatch[1]}') must match the perk-card icon ('${perkCardIcon}') at content.js PERKS table — re-tuning one without the other silently desyncs the visual signal.`);
});

test('GLASS_CANNON badge colour matches the perk-card colour (content.js PERKS table source of truth)', () => {
  // Same desync defence as the icon test above, but for the hex colour.
  const perkCardMatch = CONTENT.match(
    /GLASS_CANNON:\s*\{[^}]*colour:\s*['"](#[0-9a-fA-F]+)['"]/
  );
  assert.ok(perkCardMatch,
    'GLASS_CANNON perk-card entry must declare a hex colour literal');
  const perkCardColour = perkCardMatch[1];

  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*\.perks[^)]*GLASS_CANNON[^)]*\)\s*\{/
  );
  assert.ok(ifBranch);
  const badgeColourMatch = ifBranch.match(/colour:\s*['"](#[0-9a-fA-F]+)['"]/);
  assert.ok(badgeColourMatch,
    'GLASS_CANNON badge must declare a hex colour literal');

  assert.equal(badgeColourMatch[1].toLowerCase(), perkCardColour.toLowerCase(),
    `GLASS_CANNON badge colour ('${badgeColourMatch[1]}') must match the perk-card colour ('${perkCardColour}') at content.js PERKS table — re-tuning one without the other silently desyncs the visual signal.`);
});

// ─── runtime simulation: gate semantics ────────────────────────────────

test('runtime: GLASS_CANNON fx-gate semantics — three-state truth table', () => {
  // Behavioural complement: replicate the gate predicate on synthetic
  // player shapes and verify the truth table.
  //
  // SCOPE NOTE (per gpt-5.5 PR-review convention): this is a STRUCTURAL
  // assertion about THIS gate's predicate, not a guarantee that
  // getStatusEffects() as a whole is null-safe — the function unguarded-
  // derefs `player.perks.ENERGY_SHIELD` earlier at content.js:2292, so
  // a real call with `player = { ... }` lacking .perks would crash
  // before reaching this gate. The defensive `player.perks &&` short-
  // circuit here is defense-in-depth.
  function shouldShowFx(player) {
    return !!(player.perks && player.perks.GLASS_CANNON);
  }

  // State 1: perk owned → SHOW.
  assert.equal(shouldShowFx({ perks: { GLASS_CANNON: true } }),
    true, 'perk owned must show fx');

  // State 2: perk NOT owned (regression scenario) → HIDE.
  assert.equal(shouldShowFx({ perks: {} }),
    false, 'phantom owner without perk-ownership must NOT show fx (regression defence)');

  // State 3: no perks object at all → THIS GATE hides without throwing
  // (structural defense-in-depth — does NOT imply getStatusEffects() as
  // a whole is null-safe; see SCOPE NOTE above).
  assert.equal(shouldShowFx({}),
    false, 'undefined perks must hide THIS GATE without throwing (defense-in-depth, not a getStatusEffects contract)');
});

// ─── structural ancestor check (per gpt-5.5 PR #302/#304/#312 lesson) ──

test('GLASS_CANNON badge if-block is a direct top-level branch inside getStatusEffects (no enclosing conditional ancestors)', () => {
  // gpt-5.5 PR-review finding from PR #302/#304: the strict-equality
  // alignment test below only extracts the NEAREST `if (` before the
  // fx.push. A future refactor that adds an enclosing predicate would
  // silently false-pass:
  //
  //   (a) BRACED ancestor:
  //       if (!player._suppressed) {
  //         if (player.perks && player.perks.GLASS_CANNON) {
  //           fx.push(...);
  //         }
  //       }
  //       Effective predicate: `!_suppressed && perks.GLASS_CANNON`.
  //
  //   (b) ELSE-IF chain:
  //       if (player.perks && player.perks.SOMETHING) { ... }
  //       else if (player.perks && player.perks.GLASS_CANNON) {
  //         fx.push(...);
  //       }
  //       Effective predicate: `!somethingGate && perks.GLASS_CANNON`.
  //
  //   (c) BRACELESS ancestor (single-statement if):
  //       if (!player._fakeOuter)
  //         if (player.perks && player.perks.GLASS_CANNON) {
  //           fx.push(...);
  //         }
  //       Effective predicate: `!_fakeOuter && perks.GLASS_CANNON`.
  //
  // (a) increases brace-depth → caught by the depth==1 check.
  // (b) and (c) DO NOT increase brace-depth → caught by the predecessor-
  //     token check below.
  //
  // Brace-depth source uses CONTENT_BRACES (string literals blanked) so
  // a future badge containing `{` or `}` in a label/icon string can't
  // fool the counter.
  const fnBranch = extractBranch(
    CONTENT_BRACES,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const innerStart = fnBranch.indexOf('{') + 1;
  const innerEnd = fnBranch.lastIndexOf('}');
  const inner = fnBranch.slice(innerStart, innerEnd);

  // Anchor on the GLASS_CANNON-specific fx.push BEFORE the object-literal
  // `{` so the depth count does not include the `{` of the object literal
  // itself. The id-string contents are blanked to spaces. Find the
  // corresponding fx.push in CONTENT_CODE by ordinal to confirm the id
  // is indeed 'glass-cannon'.
  const fxRe = /fx\.push\(\{\s*id:\s*'\s*'/g;
  let fxRel = -1;
  let m;
  while ((m = fxRe.exec(inner)) !== null) {
    const fnCode = extractBranch(
      CONTENT_CODE,
      /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
    );
    if (!fnCode) continue;
    const innerCode = fnCode.slice(fnCode.indexOf('{') + 1, fnCode.lastIndexOf('}'));
    const ordinal = (inner.slice(0, m.index).match(/fx\.push\(\{\s*id:\s*'\s*'/g) || []).length;
    const codeRe = /fx\.push\(\{\s*id:\s*'([^']+)'/g;
    let codeMatch;
    let count = 0;
    while ((codeMatch = codeRe.exec(innerCode)) !== null) {
      if (count === ordinal) {
        if (codeMatch[1] === 'glass-cannon') {
          fxRel = m.index;
        }
        break;
      }
      count++;
    }
    if (fxRel !== -1) break;
  }
  assert.notEqual(fxRel, -1,
    "GLASS_CANNON fx.push({ id: 'glass-cannon' must appear inside the getStatusEffects function body");

  // Verify the controlling if-condition references GLASS_CANNON.
  const beforeFxFull = inner.slice(0, fxRel);
  const badgeIfIdx = beforeFxFull.lastIndexOf('if (');
  assert.notEqual(badgeIfIdx, -1,
    'GLASS_CANNON fx.push must be preceded by an `if (` predicate inside getStatusEffects');
  const badgeOpenParen = badgeIfIdx + 'if '.length;
  const badgeCondition = extractIfCondition(inner, badgeOpenParen);
  assert.ok(badgeCondition && /GLASS_CANNON/.test(badgeCondition),
    `controlling if-condition for the GLASS_CANNON badge must reference GLASS_CANNON; got '${badgeCondition}'.`);

  // ── Check (a): brace-depth must be exactly 1 ──
  let depth = 0;
  for (let i = 0; i < fxRel; i++) {
    const ch = inner[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
  }
  assert.equal(depth, 1,
    `GLASS_CANNON badge fx.push must be at brace-depth EXACTLY 1 inside getStatusEffects (only the immediate if-block enclosing it). Found depth=${depth}. A braced ancestor was added — extend the alignment combinator to cover all enclosing if-conditions, then update this assertion.`);

  // ── Check (b) + (c): predecessor token of the controlling `if (` ──
  let i = badgeIfIdx - 1;
  while (i >= 0 && /\s/.test(inner[i])) i--;
  if (i < 0) {
    // `if (` is the first statement in the function body. Acceptable.
    return;
  }
  const prevChar = inner[i];

  // Reject braceless control ancestor.
  assert.notEqual(prevChar, ')',
    'GLASS_CANNON badge if-block follows a braceless control statement (e.g. `if (...) if (perks.GLASS_CANNON)`). Its effective runtime predicate includes the outer condition, which the alignment test does NOT capture. Add braces to the outer block AND extend the alignment combinator, OR convert this badge to a top-level sibling.');

  // Reject `else if` chain (predecessor word is `else`).
  if (/[a-zA-Z_]/.test(prevChar)) {
    let j = i;
    while (j >= 0 && /[a-zA-Z_]/.test(inner[j])) j--;
    const word = inner.slice(j + 1, i + 1);
    assert.notEqual(word, 'else',
      'GLASS_CANNON badge if-block is an `else if` branch — its effective runtime predicate includes the negation of the previous if-condition, which the alignment test does NOT capture. Convert to a top-level sibling if-block, OR extend the alignment combinator to fold in the `!previousCond` ancestor.');
  }

  // Otherwise: must be a sibling-statement boundary.
  assert.ok(
    prevChar === '}' || prevChar === ';',
    `GLASS_CANNON badge if-block must be preceded by a sibling-statement boundary ('}' or ';') inside getStatusEffects. Found '${prevChar}' at position ${i}. Ensure the badge is a top-level branch with no implicit ancestor predicate.`
  );
});

// ─── runtime simulation: trigger pipeline alignment (offensive site) ───

test('runtime: GLASS_CANNON badge gate matches OFFENSIVE multiplier gate EXACTLY (effectiveAtk site)', () => {
  // The badge gate (content.js getStatusEffects) MUST be predicate-equal
  // to the OFFENSIVE multiplier gate (entities.js Player.effectiveAtk
  // at ~line 11661):
  //   `if (this.perks.GLASS_CANNON) a = Math.round(a * 1.30);`
  // after stripping the defensive `player.perks &&` short-circuit.
  //
  // The badge is anchored to the OFFENSIVE site (not the defensive site)
  // because the offensive site is a pure perk-ownership gate, while the
  // defensive site has an additional `!options.ignoreDefense` env-DoT
  // exemption. The defensive-site delta is asserted in a separate test
  // below.
  //
  // Per gpt-5.3-codex + gpt-5.5 reviews of PR #300/#302/#312: substring
  // match is insufficient — a future change could ADD a conjunct to
  // either gate (e.g. `&& !this._suppressed`) and a substring assertion
  // would silently false-pass while the badge↔buff contract breaks.

  // ── Extract entities.js OFFENSIVE multiplier-gate condition ──
  // Anchor on the multiplier statement `a = Math.round(a * 1.30)` (the
  // GLASS_CANNON-specific offensive multiplier; verify uniqueness below).
  const mulIdx = ENTITIES_CODE.indexOf('a = Math.round(a * 1.30)');
  assert.notEqual(mulIdx, -1,
    'entities.js must contain the GLASS_CANNON offensive multiplier statement `a = Math.round(a * 1.30)`');
  const allMul = ENTITIES_CODE.match(/a = Math\.round\(a \* 1\.30\)/g) || [];
  assert.equal(allMul.length, 1,
    `offensive multiplier anchor must be unique; got ${allMul.length} matches in entities.js — re-anchor the alignment test`);

  // The GLASS_CANNON offensive site is BRACELESS:
  //   `if (this.perks.GLASS_CANNON) a = Math.round(a * 1.30);`
  // The controlling `if (` is on the SAME line, immediately before. Walk
  // back from the multiplier to the previous `if (` in source order.
  const beforeMul = ENTITIES_CODE.slice(0, mulIdx);
  const ifIdx = beforeMul.lastIndexOf('if (');
  assert.notEqual(ifIdx, -1,
    'GLASS_CANNON offensive multiplier must be guarded by an `if (` somewhere in entities.js');
  const openParenIdx = ifIdx + 'if '.length;
  const mulCond = extractIfCondition(ENTITIES_CODE, openParenIdx);
  assert.ok(mulCond,
    'failed to extract offensive multiplier if-condition from entities.js');
  // Sanity: must reference GLASS_CANNON (otherwise we anchored on the wrong if).
  assert.ok(/GLASS_CANNON/.test(mulCond),
    `extracted offensive multiplier if-condition must reference GLASS_CANNON; got '${mulCond}' — re-anchor the alignment test`);

  // ── Extract content.js badge-gate condition ──
  const fxIdx = CONTENT_CODE.indexOf("id: 'glass-cannon'");
  assert.notEqual(fxIdx, -1,
    "content.js must contain the badge fx.push entry with id: 'glass-cannon'");
  const beforeFx = CONTENT_CODE.slice(0, fxIdx);
  const badgeIfIdx = beforeFx.lastIndexOf('if (');
  assert.notEqual(badgeIfIdx, -1,
    'badge fx.push must be controlled by an `if (` predicate');
  const badgeOpenParenIdx = badgeIfIdx + 'if '.length;
  const badgeCond = extractIfCondition(CONTENT_CODE, badgeOpenParenIdx);
  assert.ok(badgeCond, 'failed to extract badge if-condition from content.js');

  // ── Pre-normalisation receiver-qualification check (per gpt-5.5 r2) ──
  // The normaliser strips `player.` from valid predicates — but it would
  // ALSO produce a clean post-normalisation form for a broken badge gate
  // that used BARE identifiers (e.g. `GLASS_CANNON`). At runtime in
  // getStatusEffects(player), bare `GLASS_CANNON` would throw
  // ReferenceError. Defence: every GLASS_CANNON-relevant field reference
  // in the RAW badge cond must be receiver-qualified on `player.`.
  const bareFieldRe = /(?<![.\w])(?:perks)\b/g;
  const bareBadgeRefs = badgeCond.match(bareFieldRe) || [];
  assert.equal(bareBadgeRefs.length, 0,
    `badge predicate has unqualified field reference(s): [${bareBadgeRefs.join(', ')}] — every \`perks\` reference must be receiver-qualified on \`player.\` (the badge sits in the free function getStatusEffects(player); bare identifiers would throw ReferenceError at runtime). Raw cond: ${badgeCond}`);
  // Symmetric check on the multiplier side (entities.js): every reference
  // must be receiver-qualified on `this.`.
  const bareMulRefs = mulCond.match(bareFieldRe) || [];
  assert.equal(bareMulRefs.length, 0,
    `offensive multiplier predicate has unqualified field reference(s): [${bareMulRefs.join(', ')}] — every \`perks\` reference must be receiver-qualified on \`this.\`. Raw cond: ${mulCond}`);

  // ── Compare normalised predicates (receiver-side-specific) ──
  const mulNorm = normaliseMultiplierPredicate(mulCond);
  const badgeNorm = normaliseBadgePredicate(badgeCond);
  assert.ok(!/\bplayer\b/.test(mulNorm),
    `offensive multiplier predicate (entities.js) must not reference \`player\` — found leftover after normalisation: ${mulNorm}. The multiplier sits inside a Player method; mixing receivers is a real bug.`);
  assert.ok(!/\bthis\b/.test(badgeNorm),
    `badge predicate (content.js) must not reference \`this\` — found leftover after normalisation: ${badgeNorm}. The badge sits inside the free function getStatusEffects(player); using \`this\` would resolve to undefined in strict mode (TypeError) or the global object (wrong receiver).`);
  assert.equal(badgeNorm, mulNorm,
    `badge gate predicate must match OFFENSIVE multiplier gate predicate after normalisation.\n  multiplier (entities.js):  ${mulCond}\n    → normalised:            ${mulNorm}\n  badge      (content.js):   ${badgeCond}\n    → normalised:            ${badgeNorm}\n  If you intentionally added/removed a conjunct on one side, update BOTH sides — the badge↔perk-ownership visual contract requires identical predicates.`);

  // Sanity: the normalised predicate must contain the GLASS_CANNON conjunct
  // (catches a normalisation bug that strips too much).
  assert.ok(/perks\.GLASS_CANNON/.test(mulNorm),
    'normalised predicate must retain perks.GLASS_CANNON');
  // Pure perk-ownership: the normalised gate should be EXACTLY
  // `perks.GLASS_CANNON` — no other tokens. Catches a future addition
  // of a state conjunct that the receiver-qualification check doesn't.
  assert.equal(mulNorm, 'perks.GLASS_CANNON',
    `OFFENSIVE multiplier gate must be EXACTLY \`this.perks.GLASS_CANNON\` (pure perk-ownership). Found normalised: '${mulNorm}'. GLASS_CANNON is a stateless always-on perk; adding a state conjunct would break the badge↔perk contract.`);
});

// ─── OFFENSIVE-site consequent check (per gpt-5.3-codex review round 1) ─

test('OFFENSIVE if-statement consequent IS the multiplier statement (braceless-if decoy defence)', () => {
  // gpt-5.3-codex review round 1 finding: the OFFENSIVE alignment test
  // (`badge gate matches OFFENSIVE multiplier gate EXACTLY`) anchors via
  //   mulIdx     = ENTITIES_CODE.indexOf('a = Math.round(a * 1.30)');
  //   ifIdx      = beforeMul.lastIndexOf('if (');
  //   mulCond    = extractIfCondition(ENTITIES_CODE, ifIdx + 'if '.length);
  // and asserts /GLASS_CANNON/.test(mulCond). It does NOT verify that
  // this `if (` actually CONTROLS the multiplier statement. A decoy
  // pattern can false-pass:
  //
  //   if (this.perks.GLASS_CANNON) noop();    // decoy GLASS_CANNON if
  //   a = Math.round(a * 1.30);                // UNCONDITIONAL multiplier!
  //
  // `lastIndexOf('if (')` would find the decoy, the extracted condition
  // would match GLASS_CANNON, the alignment compare would pass — BUT
  // the runtime contract is broken (everyone gets +30% ATK regardless
  // of perk-ownership). The defensive site is protected by the body-
  // content check (braced `{...}` body must equal the canonical statement),
  // but the offensive site is BRACELESS, so there's no body to check.
  //
  // Defence: locate the GLASS_CANNON-specific offensive `if (`, walk
  // its predicate to the closing `)`, then assert that the IMMEDIATE
  // consequent (next non-whitespace through the next `;`) is EXACTLY
  // the multiplier statement `a = Math.round(a * 1.30);`. This is the
  // braceless-if equivalent of the body-content check on the defensive
  // side.
  //
  // Anchor on the GLASS_CANNON-specific offensive if-predicate via
  // brace-blanked source so a `)` inside a string literal in some
  // future neighbouring code can't fool the paren-walk.
  const offIfRe = /if\s*\(\s*this\.perks\.GLASS_CANNON\s*\)/g;
  const offMatches = [];
  let m;
  while ((m = offIfRe.exec(ENTITIES_BRACES)) !== null) {
    offMatches.push({ idx: m.index, full: m[0] });
  }
  assert.equal(offMatches.length, 1,
    `OFFENSIVE \`if (this.perks.GLASS_CANNON)\` predicate must be unique in entities.js (found ${offMatches.length}); decoy-defence anchor would be ambiguous — re-anchor or rename the duplicate.`);
  const offIf = offMatches[0];
  // Find the closing `)` of the predicate.
  const openParenIdx = offIf.idx + offIf.full.indexOf('(');
  let depth = 1;
  let closeParenIdx = -1;
  for (let k = openParenIdx + 1; k < ENTITIES_BRACES.length; k++) {
    const ch = ENTITIES_BRACES[k];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) { closeParenIdx = k; break; }
    }
  }
  assert.notEqual(closeParenIdx, -1,
    'failed to find closing `)` of OFFENSIVE GLASS_CANNON if-predicate — anchor regression?');
  // Walk forward past whitespace; the consequent begins at the first
  // non-whitespace char.
  let consequentStart = -1;
  for (let k = closeParenIdx + 1; k < ENTITIES_BRACES.length; k++) {
    if (!/\s/.test(ENTITIES_BRACES[k])) { consequentStart = k; break; }
  }
  assert.notEqual(consequentStart, -1,
    'failed to find consequent of OFFENSIVE GLASS_CANNON if — anchor regression?');
  // Reject braced consequent — the offensive site is intentionally
  // braceless (matches the surrounding effectiveAtk() style of single-
  // line ATK perk amps). A future refactor to `if (...) { ... }` would
  // change brace-depth in unexpected ways and should be a deliberate
  // decision; require this assertion to be updated alongside.
  assert.notEqual(ENTITIES_BRACES[consequentStart], '{',
    `OFFENSIVE GLASS_CANNON if-statement must be BRACELESS (matches the braceless single-line style of every other ATK-amp in effectiveAtk: BERSERKER/PRISTINE/RETRIBUTION). A braced form would silently allow a body of multiple statements; if you intentionally added braces, also extend this defence to walk the body and assert the canonical statement is the only one inside.`);
  // Find the terminating `;` of the consequent statement.
  let semiIdx = -1;
  for (let k = consequentStart; k < ENTITIES_BRACES.length; k++) {
    if (ENTITIES_BRACES[k] === ';') { semiIdx = k; break; }
  }
  assert.notEqual(semiIdx, -1,
    'failed to find `;` terminating the OFFENSIVE consequent statement — anchor regression?');
  // Use ENTITIES_CODE (NOT ENTITIES_BRACES) for the slice so the
  // assertion error message shows the real source. blankStringContents
  // preserves length, so positions are interchangeable.
  const consequent = ENTITIES_CODE.slice(consequentStart, semiIdx + 1).trim();
  assert.equal(consequent, 'a = Math.round(a * 1.30);',
    `OFFENSIVE GLASS_CANNON if-consequent must be EXACTLY \`a = Math.round(a * 1.30);\` (whitespace-trimmed). Found:\n  ${consequent}\n\nA decoy bypass was introduced — the controlling \`if (this.perks.GLASS_CANNON)\` no longer owns the +30% multiplier statement. Either form silently breaks the badge↔buff contract: the badge fires on perk-ownership alone, but the multiplier now executes unconditionally (or via a different statement). The alignment test alone would false-pass (it only verifies the if-condition references GLASS_CANNON, not what the if controls). Restore the canonical single-statement form OR update this assertion alongside the new structure.`);

  // ── Successor-statement check (per gpt-5.3-codex review round 2) ────
  // Round 2 finding: the consequent check pins the FIRST statement
  // controlled by the GLASS_CANNON if, but does NOT prevent an
  // UNCONDITIONAL sibling amp inserted right AFTER the if-statement
  // (e.g. `if (this.perks.GLASS_CANNON) a = Math.round(a * 1.30);
  //         a = Math.round(1.3 * a);  // unconditional second amp`).
  // The behavioural formula tests in tests/glass-cannon-perk.test.js
  // RE-DERIVE the formula in JS rather than executing entities.js, so
  // they wouldn't catch a sibling amp inserted in entities.js.
  //
  // Defence: the GLASS_CANNON line is INTENTIONALLY the last modifier
  // in effectiveAtk() — immediately followed by `return a;`. Pin the
  // successor statement so any sibling amp inserted between
  // GLASS_CANNON and the return is caught.
  //
  // Walk forward from semiIdx through whitespace; the next non-
  // whitespace tokens must be `return a;`.
  let postIdx = semiIdx + 1;
  while (postIdx < ENTITIES_BRACES.length && /\s/.test(ENTITIES_BRACES[postIdx])) postIdx++;
  // Successor statement extends to the next `;`.
  let postSemiIdx = -1;
  for (let k = postIdx; k < ENTITIES_BRACES.length; k++) {
    if (ENTITIES_BRACES[k] === ';') { postSemiIdx = k; break; }
  }
  assert.notEqual(postSemiIdx, -1,
    'failed to find `;` terminating the statement following the OFFENSIVE GLASS_CANNON if — anchor regression?');
  const successor = ENTITIES_CODE.slice(postIdx, postSemiIdx + 1).trim();
  assert.equal(successor, 'return a;',
    `Statement immediately following the OFFENSIVE GLASS_CANNON if-statement must be EXACTLY \`return a;\` (whitespace-trimmed). Found:\n  ${successor}\n\nA sibling statement was inserted between the GLASS_CANNON line and the return. If it's a new ATK modifier, it bypasses the GLASS_CANNON gate (applies unconditionally) AND breaks the documented effectiveAtk modifier order (BERSERKER → LAST_STAND → PRISTINE → STRIDE → OVERDRIVE → RETRIBUTION → GLASS_CANNON → return). If it's intentional (e.g. a new perk ordered AFTER GLASS_CANNON), update both this assertion AND the existing behavioural formula test in tests/glass-cannon-perk.test.js (which models the chain in re-derived JS and would otherwise lie about runtime output).`);
});

// ─── DEFENSIVE-site delta check ────────────────────────────────────────

test('DEFENSIVE multiplier gate (takeDamage site) differs from badge gate by EXACTLY `!options.ignoreDefense`', () => {
  // The defensive-cost site at entities.js:11838 reads:
  //   `if (this.perks.GLASS_CANNON && !options.ignoreDefense) {
  //      actual = Math.max(1, Math.round(actual * 1.25));
  //    }`
  // The extra `!options.ignoreDefense` conjunct is the env-DoT exemption
  // (Plasma/Toxic/Arc/Disruption/Frost pass sub-1 fractional damage with
  // ignoreDefense:true; without the gate Math.max(1, …) would inflate
  // ~0.04-0.13/frame env DoT to ~1/frame ≈ 60 DPS instakill).
  //
  // The badge gate INTENTIONALLY does NOT mirror this — the badge is
  // "you OWN the perk", not "you are CURRENTLY taking direct damage".
  // BUT: a future refactor that adds a THIRD conjunct on the defensive
  // side (e.g. `&& !this._cannonShield`) would silently break the
  // badge↔defensive-cost contract — the player would see GLASS but
  // the defensive cost wouldn't apply. Caught here by asserting the
  // defensive gate's set of conjuncts is EXACTLY {perks.GLASS_CANNON,
  // !options.ignoreDefense} after normalisation.

  // Anchor on the defensive multiplier statement
  // `actual = Math.max(1, Math.round(actual * 1.25))` (the GLASS_CANNON-
  // specific defensive multiplier; verify uniqueness).
  const defMulIdx = ENTITIES_CODE.indexOf('actual = Math.max(1, Math.round(actual * 1.25))');
  assert.notEqual(defMulIdx, -1,
    'entities.js must contain the GLASS_CANNON defensive multiplier statement');
  const allDefMul = ENTITIES_CODE.match(/actual = Math\.max\(1, Math\.round\(actual \* 1\.25\)\)/g) || [];
  assert.equal(allDefMul.length, 1,
    `defensive multiplier anchor must be unique; got ${allDefMul.length} matches in entities.js — re-anchor the alignment test`);

  const beforeDef = ENTITIES_CODE.slice(0, defMulIdx);
  const ifIdx = beforeDef.lastIndexOf('if (');
  assert.notEqual(ifIdx, -1,
    'GLASS_CANNON defensive multiplier must be guarded by an `if (` somewhere in entities.js');
  const openParenIdx = ifIdx + 'if '.length;
  const defCond = extractIfCondition(ENTITIES_CODE, openParenIdx);
  assert.ok(defCond,
    'failed to extract defensive multiplier if-condition from entities.js');
  assert.ok(/GLASS_CANNON/.test(defCond),
    `extracted defensive multiplier if-condition must reference GLASS_CANNON; got '${defCond}' — re-anchor the alignment test`);

  // Normalise and assert the EXACT canonical form.
  const defNorm = normaliseMultiplierPredicate(defCond);
  assert.equal(defNorm, 'perks.GLASS_CANNON&&!options.ignoreDefense',
    `DEFENSIVE multiplier gate must be EXACTLY \`this.perks.GLASS_CANNON && !options.ignoreDefense\` (perk-ownership + env-DoT exemption). Found normalised: '${defNorm}'. A third conjunct was added (e.g. \`&& !this._cannonShield\`) — this silently breaks the badge↔defensive-cost contract: the badge fires on perk-ownership alone, but the defensive cost now requires ownership ∧ extra-gate. Either remove the extra gate, OR mirror it in the badge predicate, OR update this assertion AND document the divergence.`);
});

// ─── DEFENSIVE-site brace-depth + body-content checks (5-layer pattern) ─

test('DEFENSIVE multiplier sits at brace-depth EXACTLY 1 inside Player.takeDamage() body', () => {
  // KNOWN GAP closure pattern from PR #312 (BULWARK 5-layer): the
  // predecessor-token check is bypassed by an outer-if with an
  // intervening sibling stmt:
  //   if (someOuter) {
  //     foo;                                           // intervening stmt
  //     if (this.perks.GLASS_CANNON && !options.ignoreDefense) {
  //       actual = Math.max(1, Math.round(actual * 1.25));
  //     }
  //   }
  // Effective runtime predicate: `someOuter && perks.GLASS_CANNON &&
  // !options.ignoreDefense` — strictly stronger than the badge gate.
  //
  // Defence: extract the FULL Player.takeDamage() body via brace-walk,
  // then count `{` minus `}` from start of body to the GLASS_CANNON
  // defensive multiplier statement position. Depth must be EXACTLY 1.
  //
  // Brace-counting uses ENTITIES_BRACES (string literals blanked) so
  // a future code change containing `{` / `}` inside a string can't
  // fool the counter.
  const takeDamageReG = /takeDamage\s*\(\s*dmg\s*,\s*source\s*,\s*opts\s*\)\s*\{/g;
  const takeDamageMatches = ENTITIES_BRACES.match(takeDamageReG) || [];
  assert.equal(takeDamageMatches.length, 1,
    `Player.takeDamage(dmg, source, opts) signature must be unique in entities.js (found ${takeDamageMatches.length}); brace-depth anchor would be ambiguous — re-anchor or rename the duplicate.`);

  const tdBranch = extractBranch(ENTITIES_BRACES, /takeDamage\s*\(\s*dmg\s*,\s*source\s*,\s*opts\s*\)\s*\{/);
  assert.ok(tdBranch,
    'failed to extract Player.takeDamage() body via brace-walk — anchor regex may be stale.');
  const tdBranchAbsIdx = ENTITIES_BRACES.indexOf(tdBranch);
  assert.notEqual(tdBranchAbsIdx, -1,
    'extractBranch returned a slice not located in ENTITIES_BRACES — internal regression.');
  const tdBodyStart = tdBranchAbsIdx + tdBranch.indexOf('{') + 1;
  const tdBodyEnd = tdBranchAbsIdx + tdBranch.lastIndexOf('}');

  const defMulIdx = ENTITIES_CODE.indexOf('actual = Math.max(1, Math.round(actual * 1.25))');
  assert.notEqual(defMulIdx, -1,
    'GLASS_CANNON defensive multiplier statement must be present');
  assert.ok(defMulIdx > tdBodyStart && defMulIdx < tdBodyEnd,
    `GLASS_CANNON defensive multiplier (pos=${defMulIdx}) must sit inside Player.takeDamage() body (${tdBodyStart}..${tdBodyEnd}). It moved out of takeDamage — re-anchor the alignment test on its new home.`);

  let depth = 0;
  for (let k = tdBodyStart; k < defMulIdx; k++) {
    const ch = ENTITIES_BRACES[k];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
  }
  assert.equal(depth, 1,
    `GLASS_CANNON defensive multiplier must sit at brace-depth EXACTLY 1 inside Player.takeDamage() body. Found depth=${depth} — an enclosing block was added (e.g. \`if (outer) { ...; if (GLASS_CANNON && !ignoreDefense) { actual = Math.max(...); } }\`). Effective runtime predicate is now the conjunction of all enclosing conditions, which the alignment compare does NOT capture. NOTE: this assertion implicitly requires the GLASS_CANNON defensive gate to be a BRACED if-block — a refactor to the braceless form would produce depth=0 and trip this assertion. Hoist back to a top-level sibling statement inside takeDamage(), OR extend the alignment combinator to fold in every enclosing if-condition.`);
});

test('DEFENSIVE if-block body is EXACTLY the canonical multiplier statement (no hidden inline gate)', () => {
  // Catches a bypass class the depth check alone misses: a runtime gate
  // ADDED INSIDE the GLASS_CANNON defensive if-block, e.g.
  //   if (this.perks.GLASS_CANNON && !options.ignoreDefense) {
  //     this._someFlag && (actual = Math.max(1, Math.round(actual * 1.25)));
  //   }
  // or a subsequent undo statement:
  //   if (this.perks.GLASS_CANNON && !options.ignoreDefense) {
  //     actual = Math.max(1, Math.round(actual * 1.25));
  //     this._cannonShield && (actual = -1);              // hidden override
  //   }
  // Both pass the alignment compare AND depth==1 check, but the EFFECTIVE
  // multiplier predicate is now GLASS_CANNON ∧ !ignoreDefense ∧ extra-gate.
  //
  // Defence: extract the GLASS_CANNON defensive if-block BODY, strip
  // whitespace, and assert it is EXACTLY
  //   `actual = Math.max(1, Math.round(actual * 1.25));`
  // No additional statements, no inline guards, no destructuring.
  const defMulIdx = ENTITIES_CODE.indexOf('actual = Math.max(1, Math.round(actual * 1.25))');
  assert.notEqual(defMulIdx, -1);
  const beforeDef = ENTITIES_BRACES.slice(0, defMulIdx);
  const ifIdx = beforeDef.lastIndexOf('if (');
  assert.notEqual(ifIdx, -1);

  // Walk forward from `if (` to find the closing `)` of the predicate.
  let condDepth = 0;
  let condEndIdx = -1;
  for (let k = ifIdx; k < ENTITIES_BRACES.length; k++) {
    const ch = ENTITIES_BRACES[k];
    if (ch === '(') condDepth++;
    else if (ch === ')') {
      condDepth--;
      if (condDepth === 0) { condEndIdx = k; break; }
    }
  }
  assert.notEqual(condEndIdx, -1,
    'failed to find closing `)` of GLASS_CANNON defensive controlling if-predicate — anchor regression?');
  let bodyOpenIdx = -1;
  for (let k = condEndIdx + 1; k < ENTITIES_BRACES.length; k++) {
    const ch = ENTITIES_BRACES[k];
    if (ch === '{') { bodyOpenIdx = k; break; }
    if (!/\s/.test(ch)) {
      assert.fail(`GLASS_CANNON defensive if-block must be braced — first non-whitespace char after the controlling \`if (...)\` predicate is '${ch}', not '{'.`);
    }
  }
  assert.notEqual(bodyOpenIdx, -1);
  let bodyDepth = 1;
  let bodyCloseIdx = -1;
  for (let k = bodyOpenIdx + 1; k < ENTITIES_BRACES.length; k++) {
    const ch = ENTITIES_BRACES[k];
    if (ch === '{') bodyDepth++;
    else if (ch === '}') {
      bodyDepth--;
      if (bodyDepth === 0) { bodyCloseIdx = k; break; }
    }
  }
  assert.notEqual(bodyCloseIdx, -1);
  // Use ENTITIES_CODE (NOT ENTITIES_BRACES) for the body slice so the
  // assertion error message shows the real source.
  const defBody = ENTITIES_CODE.slice(bodyOpenIdx + 1, bodyCloseIdx).trim();
  assert.equal(defBody, 'actual = Math.max(1, Math.round(actual * 1.25));',
    `GLASS_CANNON defensive if-block body must be EXACTLY \`actual = Math.max(1, Math.round(actual * 1.25));\` (whitespace-trimmed). Found:\n  ${defBody}\n\nA runtime gate was added inside the block, or extra statements were introduced. Either form silently breaks the badge↔defensive-cost contract: the badge fires on perk-ownership alone, but the multiplier now requires ownership ∧ !ignoreDefense ∧ extra-gate. Hoist any extra logic OUTSIDE the if-block, OR update both this assertion AND the badge predicate to reflect the new gate.`);

  // ── Successor-statement check (per gpt-5.3-codex review round 2) ────
  // Round 2 finding: the body-content check pins the canonical statement
  // INSIDE the GLASS_CANNON defensive block, but does NOT prevent an
  // UNCONDITIONAL sibling amp inserted right AFTER the block (e.g.
  //   if (this.perks.GLASS_CANNON && !options.ignoreDefense) {
  //     actual = Math.max(1, Math.round(actual * 1.25));
  //   }
  //   actual = Math.max(1, Math.ceil(actual * 1.25));   // sibling amp!
  // ).
  //
  // Defence: the GLASS_CANNON defensive block is INTENTIONALLY followed
  // by `if (actual <= 0) return 0;` (the post-mitigation early-return
  // gate that LAST_STAND, BULWARK, etc. all sit AFTER). Pin this
  // successor so any sibling amp inserted between the GLASS_CANNON
  // block and the early-return is caught.
  //
  // Walk forward from bodyCloseIdx through whitespace; the next non-
  // whitespace token must be the start of `if (actual <= 0) return 0;`.
  let postIdx = bodyCloseIdx + 1;
  while (postIdx < ENTITIES_BRACES.length && /\s/.test(ENTITIES_BRACES[postIdx])) postIdx++;
  // Successor statement extends to the next `;`. (For `if (cond) return 0;`
  // the `;` after `return 0` terminates the whole single-line if.)
  let postSemiIdx = -1;
  for (let k = postIdx; k < ENTITIES_BRACES.length; k++) {
    if (ENTITIES_BRACES[k] === ';') { postSemiIdx = k; break; }
  }
  assert.notEqual(postSemiIdx, -1,
    'failed to find `;` terminating the statement following the GLASS_CANNON defensive block — anchor regression?');
  const successor = ENTITIES_CODE.slice(postIdx, postSemiIdx + 1).trim();
  assert.equal(successor, 'if (actual <= 0) return 0;',
    `Statement immediately following the GLASS_CANNON defensive if-block must be EXACTLY \`if (actual <= 0) return 0;\` (the post-mitigation early-return gate). Found:\n  ${successor}\n\nA sibling statement was inserted between the GLASS_CANNON block and the early-return. If it's a new incoming-damage modifier, it bypasses the GLASS_CANNON+ignoreDefense gate (applies regardless of perk-ownership AND inflates env DoT into instakill territory). If it's intentional (e.g. a new amp deliberately ordered AFTER GLASS_CANNON but BEFORE the early-return), update both this assertion AND the behavioural formula test in tests/glass-cannon-perk.test.js (which models the chain in re-derived JS and would otherwise lie about runtime output).`);
});

// ─── multiplier-VALUE pinning (re-tune defence) ────────────────────────

test('GLASS_CANNON multiplier values pinned: offensive ×1.30 and defensive ×1.25', () => {
  // The +30/-25 trade is the perk's identity. Re-tuning either value
  // should be a deliberate decision visible in code review, not a
  // silent drift. Pin both literals.
  const offCount = (ENTITIES_CODE.match(/a = Math\.round\(a \* 1\.30\)/g) || []).length;
  assert.equal(offCount, 1,
    `GLASS_CANNON offensive multiplier literal \`a = Math.round(a * 1.30)\` must appear exactly once in entities.js; found ${offCount}. The +30% ATK literal is the perk's identity — re-tune intentionally.`);
  const defCount = (ENTITIES_CODE.match(/actual = Math\.max\(1, Math\.round\(actual \* 1\.25\)\)/g) || []).length;
  assert.equal(defCount, 1,
    `GLASS_CANNON defensive multiplier literal \`actual = Math.max(1, Math.round(actual * 1.25))\` must appear exactly once in entities.js; found ${defCount}. The +25% damage-taken literal is the perk's identity — re-tune intentionally.`);

  // Cross-check: the perk-card desc string at content.js:4718 declares
  // "+30% damage dealt, +25% damage taken". Pin the percentages so a
  // re-tune of the multipliers without updating the desc (or vice
  // versa) is caught.
  const descMatch = CONTENT.match(
    /GLASS_CANNON:\s*\{[^}]*desc:\s*['"]([^'"]+)['"]/
  );
  assert.ok(descMatch, 'GLASS_CANNON perk-card must declare a desc literal');
  assert.match(descMatch[1], /\+30%/,
    `GLASS_CANNON perk-card desc must reference '+30%' (offensive multiplier). Found: '${descMatch[1]}'. Re-tune of multiplier without updating desc — desync.`);
  assert.match(descMatch[1], /\+25%/,
    `GLASS_CANNON perk-card desc must reference '+25%' (defensive multiplier). Found: '${descMatch[1]}'. Re-tune of multiplier without updating desc — desync.`);
});
