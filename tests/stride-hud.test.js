'use strict';
// STRIDE HUD discoverability — multiplier-readout enhancement.
//
// CONTEXT: STRIDE is a perk that builds movement-stacks (max 5) while the
// player keeps moving above STRIDE_MOVE_RATE tiles/sec. While `_strideStacks
// > 0`, Player.effectiveAtk() multiplies ATK by `1 + STRIDE_DMG_PER_STACK
// * stacks` (entities.js:11328-11333). With STRIDE_DMG_PER_STACK = 0.05
// and STRIDE_MAX_STACKS = 5, the buff scales ×1.05 → ×1.25.
//
// Pre-PR the badge label was `RUSH ×N` where N is the raw STACK COUNT
// (1..5). That visually collided with the multiplier-readout convention
// (`×N.NN`) used by every other ATK-buff badge in this file —
//   HOT_HAND   (PR #280): `×1.05`..`×1.30` (per-shot streak)
//   MOMENTUM   (PR #282): `×1.15`..`×1.30` (post-kill window)
//   OVERDRIVE  (PR #302): `×1.03`..`×1.30` (combo ramp)
// — forcing players to mentally compute the 5%-per-stack multiplier from
// the bare count. This PR replaces the count with the readout `RUSH ×1.15`
// so the actual ATK multiplier surfaces directly. The action-word "RUSH"
// prefix is preserved (matches WARD/RAGE/PRIME/AIM single-noun identity
// style) so the badge remains visually identifiable as STRIDE-the-perk.
//
// Tests below assert structural and runtime invariants (mirrors the
// 4-layered alignment-test defence established by PR #306 BULWARK after
// gpt-5.5 review — see stored memory 'HUD status fx'):
//   - The fx.push call exists inside getStatusEffects with id='stride'.
//   - It is gated on perks.STRIDE AND ss > 0 (mirroring the multiplier
//     site at entities.js:11331 so badge ↔ multiplier visibility cannot
//     diverge).
//   - Defensive `player.perks &&` null-check (perks may be undefined on
//     legacy player shapes that bypassed the ctor).
//   - Label uses the multiplier-readout convention `RUSH ×N.NN` matching
//     HOT_HAND / MOMENTUM / OVERDRIVE.
//   - Icon ⇶ matches the perk-card glyph at content.js:4687 (visual
//     identification: badge ↔ perk).
//   - Colour #00ffaa matches the perk-card colour at content.js:4687
//     EXACTLY (cross-file desync defence per stored memory 'HUD status fx').
//   - HUD literal 0.05 matches the entities.js STRIDE_DMG_PER_STACK
//     constant EXACTLY (cross-file desync defence per stored memory
//     'HUD status fx', mirrors the HOT_HAND HOT_HAND_PER_STACK desync test).
//   - Strict-equality predicate alignment: badge gate matches the
//     source-of-truth multiplier gate from entities.js after side-specific
//     normalisation (per stored memory 'HUD status fx' — substring-only
//     matches false-pass on added conjuncts).
//   - Structural ancestor check on BOTH sides (per gpt-5.5 BULWARK r3
//     lesson): the badge if-block AND the multiplier if-block sit at
//     brace-depth EXACTLY 1 inside their containing function bodies AND
//     each controlling `if (` is preceded by a sibling-statement boundary
//     (`}` or `;`), never by `else` or `)` or `{`.
//   - Pre-normalisation receiver-qualification (per gpt-5.5 BULWARK r2
//     lesson): every perks/_strideStacks reference must be qualified on
//     the appropriate receiver — bare identifiers would throw at runtime
//     but produce a "clean" post-normalisation form that false-passes.
//   - Side-specific normalisation + leftover-token assertion (per gpt-5.5
//     BULWARK r1 lesson): badge strips ONLY `player.`, multiplier strips
//     ONLY `this.`. Then assert no `\bthis\b` in normalised badge and no
//     `\bplayer\b` in normalised multiplier.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  extractBranch,
  extractIfCondition,
  normaliseMultiplierPredicate,
  normaliseBadgePredicate,
  loadAlignmentSources,
} = require('./_alignment-helpers.js');

const { CONTENT, CONTENT_CODE, ENTITIES_CODE, CONTENT_BRACES }
  = loadAlignmentSources(__dirname);
const PLAYER_PERK_TUNING = require('./_source-files.js').readSourceFile(__dirname, 'entitiesPlayerPerkTuning');

// ─── getStatusEffects() STRIDE fx entry ─────────────────────────────────

test('getStatusEffects() function body contains a STRIDE-gated fx.push entry', () => {
  // Scope to the getStatusEffects function body via brace-walked extraction
  // so a stray 'stride' string elsewhere in content.js can't satisfy
  // this assertion (per stored memory 'test source-text extraction').
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch, 'getStatusEffects function body must be locatable');
  assert.match(fnBranch, /id:\s*'stride'/,
    'getStatusEffects must contain an fx entry with id: "stride"');
});

test('STRIDE fx entry is gated on perk-ownership AND ss > 0', () => {
  // Two gates required:
  //  - perks.STRIDE: a phantom stack count without perk-ownership must NOT
  //    surface a buff badge to a non-owner.
  //  - ss > 0: active-stack gate; mirrors entities.js:11331 exactly.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  // Locate the controlling if-statement that wraps the stride fx.push by
  // anchoring on the .perks.STRIDE substring AND `ss > 0`.
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*\.perks[^)]*STRIDE[^)]*ss\s*>\s*0[^)]*\)\s*\{/
  );
  assert.ok(ifBranch,
    'STRIDE fx.push must sit inside an if-block that gates on player.perks.STRIDE AND ss > 0');
  assert.match(ifBranch, /id:\s*'stride'/,
    'STRIDE fx.push must be inside the perks.STRIDE && ss > 0 gate');
});

test('STRIDE fx entry guards against undefined player.perks (defensive null-check)', () => {
  // Some legacy player shapes (test sandboxes, save migrations) bypass the
  // ctor and don't have a .perks object. Without `player.perks &&` the
  // helper would throw on `undefined.STRIDE`. Pin the defensive guard.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  // The if-condition must include `player.perks &&` BEFORE
  // `player.perks.STRIDE` (short-circuit evaluation prevents null-deref).
  assert.match(fnBranch,
    /player\.perks\s*&&\s*player\.perks\.STRIDE/,
    'STRIDE gate must short-circuit on player.perks before dereferencing .STRIDE');
});

test('STRIDE fx label uses the multiplier-readout form `RUSH ×` + mul', () => {
  // Display formula: 'RUSH ×' + (1 + 0.05 * ss).toFixed(2). Pin every
  // literal in the label expression so a future re-tune in either file
  // fails loudly. Mirrors HOT_HAND (PR #280) and MOMENTUM (PR #282) and
  // OVERDRIVE (PR #302) multiplier-readout style. The `RUSH ` prefix is
  // STRIDE-specific (action-word identity, mirrors WARD/RAGE/PRIME/AIM).
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*STRIDE[^)]*\)\s*\{/
  );
  assert.ok(ifBranch, 'STRIDE if-block body must be locatable');
  assert.match(ifBranch,
    /\(\s*1\s*\+\s*0\.05\s*\*\s*ss\s*\)\.toFixed\(2\)/,
    'STRIDE label must compute (1 + 0.05 * ss).toFixed(2) — matches entities.js STRIDE_DMG_PER_STACK formula');
  assert.match(ifBranch, /label:\s*['"]RUSH ×['"]\s*\+\s*mul/,
    'STRIDE label must prefix the multiplier with `RUSH ×` (action-word identity + readout convention)');
});

test('STRIDE fx entry id appears EXACTLY once in content.js', () => {
  // A duplicate fx entry (e.g. via merge / copy-paste) would double-render
  // the indicator in statusFx (which keys on id). Pin the count.
  const all = CONTENT_CODE.match(/id:\s*'stride'/g) || [];
  assert.equal(all.length, 1,
    `content.js must contain exactly 1 id: 'stride' fx entry; got ${all.length}`);
});

// ─── cross-file desync defence: badge icon/colour ↔ perk-card ───────────

test('STRIDE badge icon matches the perk-card glyph (content.js PERK_POOL source of truth)', () => {
  // Per stored memory 'HUD status fx': when an HUD literal mirrors a
  // tuning constant declared elsewhere (PERK_POOL table at content.js:4687),
  // a divergence will silently desync. Pin the icon.
  const perkCardMatch = CONTENT.match(
    /STRIDE:\s*\{[^}]*icon:\s*['"]([^'"]+)['"]/
  );
  assert.ok(perkCardMatch,
    'STRIDE perk-card entry must declare an icon literal');
  const perkCardIcon = perkCardMatch[1];

  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*\.perks[^)]*STRIDE[^)]*\)\s*\{/
  );
  assert.ok(ifBranch);
  const badgeIconMatch = ifBranch.match(/icon:\s*['"]([^'"]+)['"]/);
  assert.ok(badgeIconMatch, 'STRIDE badge must declare an icon literal');

  assert.equal(badgeIconMatch[1], perkCardIcon,
    `STRIDE badge icon ('${badgeIconMatch[1]}') must match the perk-card icon ('${perkCardIcon}') at content.js PERK_POOL — re-tuning one without the other silently desyncs the visual signal.`);
});

test('STRIDE badge colour matches the perk-card colour (content.js PERK_POOL source of truth)', () => {
  // Same desync defence as the icon test above, but for the hex colour.
  const perkCardMatch = CONTENT.match(
    /STRIDE:\s*\{[^}]*colour:\s*['"](#[0-9a-fA-F]+)['"]/
  );
  assert.ok(perkCardMatch,
    'STRIDE perk-card entry must declare a hex colour literal');
  const perkCardColour = perkCardMatch[1];

  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*\.perks[^)]*STRIDE[^)]*\)\s*\{/
  );
  assert.ok(ifBranch);
  const badgeColourMatch = ifBranch.match(/colour:\s*['"](#[0-9a-fA-F]+)['"]/);
  assert.ok(badgeColourMatch,
    'STRIDE badge must declare a hex colour literal');

  assert.equal(badgeColourMatch[1].toLowerCase(), perkCardColour.toLowerCase(),
    `STRIDE badge colour ('${badgeColourMatch[1]}') must match the perk-card colour ('${perkCardColour}') at content.js PERK_POOL — re-tuning one without the other silently desyncs the visual signal.`);
});

// ─── cross-file desync defence: HUD literal 0.05 ↔ STRIDE_DMG_PER_STACK ─

test('STRIDE HUD per-stack literal (0.05) matches player-perk-tuning STRIDE_DMG_PER_STACK constant', () => {
  // Cross-file desync defence (per stored memory 'HUD status fx', mirrors
  // PR #280 HOT_HAND HOT_HAND_PER_STACK test): the per-stack rate (0.05)
  // is hard-coded in BOTH the HUD label (content.js, as a literal `0.05`)
  // AND the STRIDE_DMG_PER_STACK constant. A future
  // re-tune (e.g. +7% per stack) would silently desync — players would see
  // "×1.15" while taking "×1.21" damage. This test extracts the constant
  // from player-perk-tuning.js and asserts the content.js HUD literal matches.
  const constMatch = PLAYER_PERK_TUNING.match(
    /const\s+STRIDE_DMG_PER_STACK\s*=\s*([\d.]+)\s*;/
  );
  assert.ok(constMatch,
    'player-perk-tuning.js must declare `const STRIDE_DMG_PER_STACK = <number>;`');
  const constValue = constMatch[1]; // e.g. '0.05'

  // Extract the STRIDE HUD if-block from content.js.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*STRIDE[^)]*\)\s*\{/
  );
  assert.ok(ifBranch);

  // The HUD label must use the SAME per-stack rate.
  const hudFormulaRe = new RegExp(
    `\\(\\s*1\\s*\\+\\s*${constValue.replace(/\./g, '\\.')}\\s*\\*\\s*ss\\s*\\)\\.toFixed\\(2\\)`
  );
  assert.match(ifBranch, hudFormulaRe,
    `HUD label must use per-stack rate=${constValue} (matches player-perk-tuning.js STRIDE_DMG_PER_STACK constant). If the constant was re-tuned, update the HUD literal in content.js.`);
});

// ─── runtime simulation: multiplier formula truth table ─────────────────

test('runtime: STRIDE label formula matches entities.js multiplier formula across stack domain', () => {
  // Behavioural complement: replicate the label formula and the entities.js
  // multiplier formula on synthetic stack counts; assert they agree across
  // the full domain (gate, ramp, max).
  function labelFor(ss) {
    if (ss <= 0) return null; // badge wouldn't render
    return 'RUSH ×' + (1 + 0.05 * ss).toFixed(2);
  }
  function damageMul(ss) {
    if (ss <= 0) return 1;
    return 1 + 0.05 * ss;
  }
  // Truth table: stacks → label → damage-mul.
  const cases = [
    { ss: 1, expectedLabel: 'RUSH ×1.05', expectedMul: 1.05 },
    { ss: 2, expectedLabel: 'RUSH ×1.10', expectedMul: 1.10 },
    { ss: 3, expectedLabel: 'RUSH ×1.15', expectedMul: 1.15 },
    { ss: 4, expectedLabel: 'RUSH ×1.20', expectedMul: 1.20 },
    { ss: 5, expectedLabel: 'RUSH ×1.25', expectedMul: 1.25 }, // STRIDE_MAX_STACKS
  ];
  for (const tc of cases) {
    assert.equal(labelFor(tc.ss), tc.expectedLabel,
      `ss=${tc.ss} → label=${tc.expectedLabel}`);
    assert.equal(damageMul(tc.ss).toFixed(2), tc.expectedMul.toFixed(2),
      `ss=${tc.ss} → damage mul=${tc.expectedMul}`);
  }
});

test('runtime: STRIDE fx-gate semantics — five-state truth table', () => {
  // Behavioural complement: replicate the gate predicate on synthetic
  // player shapes and verify the truth table.
  //
  // SCOPE NOTE (per gpt-5.5 PR-review convention): this is a STRUCTURAL
  // assertion about THIS gate's predicate, not a guarantee that
  // getStatusEffects() as a whole is null-safe — the function unguarded-
  // derefs `player.perks.ENERGY_SHIELD` earlier at content.js:2292, so
  // a real call with `player = { ... }` lacking .perks would crash before
  // reaching this gate. The defensive `player.perks &&` short-circuit
  // here is defense-in-depth: if a future refactor removes the earlier
  // ENERGY_SHIELD branch, this gate will not regress into a null-deref.
  function shouldShowFx(player) {
    const ss = (player._strideStacks || 0);
    return !!(
      player.perks
      && player.perks.STRIDE
      && ss > 0
    );
  }

  // State 1: perk owned + 3 stacks → SHOW.
  assert.equal(shouldShowFx({ perks: { STRIDE: true }, _strideStacks: 3 }),
    true, 'perk owned + 3 stacks must show fx');

  // State 2: perk owned + 1 stack (minimum active state) → SHOW.
  assert.equal(shouldShowFx({ perks: { STRIDE: true }, _strideStacks: 1 }),
    true, 'perk owned + 1 stack must show fx (>= 1 inclusive)');

  // State 3: perk owned + 0 stacks (idle) → HIDE.
  assert.equal(shouldShowFx({ perks: { STRIDE: true }, _strideStacks: 0 }),
    false, 'perk owned + 0 stacks must hide fx (no buff to surface)');

  // State 4: perk NOT owned + 5 stacks (regression scenario — phantom
  // _strideStacks without perk-ownership must NOT show a phantom badge).
  assert.equal(shouldShowFx({ perks: {}, _strideStacks: 5 }),
    false, 'phantom stacks without perk-ownership must NOT show fx (regression defence)');

  // State 5: no perks object at all → THIS GATE hides without throwing
  // (structural defense-in-depth — does NOT imply getStatusEffects() as
  // a whole is null-safe; see SCOPE NOTE above).
  assert.equal(shouldShowFx({ _strideStacks: 5 }),
    false, 'undefined perks must hide THIS GATE without throwing (defense-in-depth, not a getStatusEffects contract)');
});

// ─── structural ancestor check (per gpt-5.5 PR #302/#304/#306 lesson) ──

test('STRIDE badge if-block is a direct top-level branch inside getStatusEffects (no enclosing conditional ancestors)', () => {
  // gpt-5.5 PR-review finding from PR #302/#304/#306: the strict-equality
  // alignment test below only extracts the NEAREST `if (` before the
  // fx.push. A future refactor that adds an enclosing predicate would
  // silently false-pass:
  //
  //   (a) BRACED ancestor:
  //       if (!player._suppressed) {
  //         if (player.perks && player.perks.STRIDE && ss > 0) {
  //           fx.push(...);
  //         }
  //       }
  //       Effective predicate: `!_suppressed && perks.STRIDE && ss > 0`.
  //
  //   (b) ELSE-IF chain:
  //       if (player.perks && player.perks.PRISTINE ...) { ... }
  //       else if (player.perks && player.perks.STRIDE && ss > 0) {
  //         fx.push(...);
  //       }
  //       Effective predicate: `!pristineGate && perks.STRIDE && ss > 0`.
  //
  //   (c) BRACELESS ancestor (single-statement if):
  //       if (!player._fakeOuter)
  //         if (player.perks && player.perks.STRIDE && ss > 0) {
  //           fx.push(...);
  //         }
  //       Effective predicate: `!_fakeOuter && perks.STRIDE && ss > 0`.
  //
  // (a) increases brace-depth → caught by the depth==1 check.
  // (b) and (c) DO NOT increase brace-depth → caught by the predecessor-
  //     token check below.
  //
  // Brace-depth source uses CONTENT_BRACES (string literals blanked) so a
  // future badge containing `{` or `}` in a label/icon string can't fool
  // the counter.

  const fnBranch = extractBranch(
    CONTENT_BRACES,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const innerStart = fnBranch.indexOf('{') + 1;
  const innerEnd = fnBranch.lastIndexOf('}');
  const inner = fnBranch.slice(innerStart, innerEnd);

  // Anchor on the STRIDE-specific fx.push BEFORE the object-literal `{`
  // so the depth count does not include the `{` of the object literal
  // itself. The id-string contents are blanked to spaces — so the literal
  // becomes `id: '      '` (6 spaces between quotes for 'stride'). Find
  // the corresponding fx.push in CONTENT_CODE by ordinal to confirm the
  // id is indeed 'stride'.
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
        if (codeMatch[1] === 'stride') {
          fxRel = m.index;
        }
        break;
      }
      count++;
    }
    if (fxRel !== -1) break;
  }
  assert.notEqual(fxRel, -1,
    "STRIDE fx.push({ id: 'stride' must appear inside the getStatusEffects function body");

  // Verify the controlling if-condition references STRIDE.
  const beforeFxFull = inner.slice(0, fxRel);
  const badgeIfIdx = beforeFxFull.lastIndexOf('if (');
  assert.notEqual(badgeIfIdx, -1,
    'STRIDE fx.push must be preceded by an `if (` predicate inside getStatusEffects');
  const badgeOpenParen = badgeIfIdx + 'if '.length;
  const badgeCondition = extractIfCondition(inner, badgeOpenParen);
  assert.ok(badgeCondition && /STRIDE/.test(badgeCondition),
    `controlling if-condition for the STRIDE badge must reference STRIDE; got '${badgeCondition}'.`);

  // ── Check (a): brace-depth must be exactly 1 ──
  let depth = 0;
  for (let i = 0; i < fxRel; i++) {
    const ch = inner[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
  }
  assert.equal(depth, 1,
    `STRIDE badge fx.push must be at brace-depth EXACTLY 1 inside getStatusEffects (only the immediate if-block enclosing it). Found depth=${depth}. A braced ancestor was added — extend the alignment combinator to cover all enclosing if-conditions, then update this assertion.`);

  // ── Check (b) + (c): predecessor token of the controlling `if (` ──
  // Walk backwards from `if (` through whitespace; the first non-whitespace
  // character should be:
  //   - start-of-body (i < 0)            → fine, badge is the very first stmt
  //   - `}` (closing brace of sibling stmt) → fine, sibling boundary
  //   - `;` (statement terminator)       → fine, sibling boundary
  //   - `)` (closing paren of for/while/if) → BAD, braceless control ancestor
  //   - `e` (last char of `else`)        → BAD if word is `else` (else-if)
  let i = badgeIfIdx - 1;
  while (i >= 0 && /\s/.test(inner[i])) i--;
  if (i < 0) {
    // `if (` is the first statement in the function body. Acceptable.
    return;
  }
  const prevChar = inner[i];

  // Reject braceless control ancestor.
  assert.notEqual(prevChar, ')',
    'STRIDE badge if-block follows a braceless control statement (e.g. `if (...) if (perks.STRIDE...)`). Its effective runtime predicate includes the outer condition, which the alignment test does NOT capture. Add braces to the outer block AND extend the alignment combinator, OR convert this badge to a top-level sibling.');

  // Reject `else if` chain (predecessor word is `else`).
  if (/[a-zA-Z_]/.test(prevChar)) {
    let j = i;
    while (j >= 0 && /[a-zA-Z_]/.test(inner[j])) j--;
    const word = inner.slice(j + 1, i + 1);
    assert.notEqual(word, 'else',
      'STRIDE badge if-block is an `else if` branch — its effective runtime predicate includes the negation of the previous if-condition, which the alignment test does NOT capture. Convert to a top-level sibling if-block, OR extend the alignment combinator to fold in the `!previousCond` ancestor.');
  }

  // Otherwise: must be a sibling-statement boundary.
  assert.ok(
    prevChar === '}' || prevChar === ';',
    `STRIDE badge if-block must be preceded by a sibling-statement boundary ('}' or ';') inside getStatusEffects. Found '${prevChar}' at position ${i}. Ensure the badge is a top-level branch with no implicit ancestor predicate.`
  );
});

// ─── runtime simulation: trigger pipeline alignment (4-layered defence) ─

test('runtime: STRIDE badge gate predicate matches the multiplier gate predicate EXACTLY', () => {
  // The badge gate (content.js getStatusEffects) MUST be predicate-equal
  // to the multiplier gate (entities.js Player.effectiveAtk at ~line 11331:
  //   `const ss = this._strideStacks || 0;`
  //   `if (this.perks.STRIDE && ss > 0) {
  //      a = Math.round(a * (1 + STRIDE_DMG_PER_STACK * ss));
  //    }`)
  // after stripping the defensive `player.perks &&` short-circuit.
  //
  // Per gpt-5.3-codex + gpt-5.5 reviews of PR #300/#302/#306: substring
  // match is insufficient — a future change could ADD a conjunct/disjunct
  // to either gate (e.g. `&& !this._suppressed`) and a substring assertion
  // would silently false-pass while the badge↔multiplier contract breaks.

  // ── Extract entities.js multiplier-gate condition ──
  // Anchor on the multiplier statement `(1 + STRIDE_DMG_PER_STACK * ss)`
  // which is unique inside Player.effectiveAtk.
  const mulIdx = ENTITIES_CODE.indexOf('(1 + STRIDE_DMG_PER_STACK * ss)');
  assert.notEqual(mulIdx, -1,
    'entities.js must contain the STRIDE multiplier expression `(1 + STRIDE_DMG_PER_STACK * ss)`');
  const allMul = ENTITIES_CODE.match(/\(1 \+ STRIDE_DMG_PER_STACK \* ss\)/g) || [];
  assert.equal(allMul.length, 1,
    `multiplier anchor must be unique; got ${allMul.length} matches in entities.js — re-anchor the alignment test`);

  // The STRIDE multiplier sits inside a brace-block, so the controlling
  // `if (` is on the line BEFORE the multiplier statement. Walk back to
  // the previous `if (` in source order.
  const beforeMul = ENTITIES_CODE.slice(0, mulIdx);
  const ifIdx = beforeMul.lastIndexOf('if (');
  assert.notEqual(ifIdx, -1,
    'STRIDE multiplier must be guarded by an `if (` somewhere in entities.js');
  const openParenIdx = ifIdx + 'if '.length;
  const mulCond = extractIfCondition(ENTITIES_CODE, openParenIdx);
  assert.ok(mulCond,
    'failed to extract multiplier if-condition from entities.js');
  // Sanity: must reference STRIDE (otherwise we anchored on the wrong if).
  assert.ok(/STRIDE/.test(mulCond),
    `extracted multiplier if-condition must reference STRIDE; got '${mulCond}' — re-anchor the alignment test`);

  // ── Extract content.js badge-gate condition ──
  const fxIdx = CONTENT_CODE.indexOf("id: 'stride'");
  assert.notEqual(fxIdx, -1,
    "content.js must contain the badge fx.push entry with id: 'stride'");
  const beforeFx = CONTENT_CODE.slice(0, fxIdx);
  const badgeIfIdx = beforeFx.lastIndexOf('if (');
  assert.notEqual(badgeIfIdx, -1,
    'badge fx.push must be controlled by an `if (` predicate');
  const badgeOpenParenIdx = badgeIfIdx + 'if '.length;
  const badgeCond = extractIfCondition(CONTENT_CODE, badgeOpenParenIdx);
  assert.ok(badgeCond, 'failed to extract badge if-condition from content.js');

  // ── Layer 2: structural-ancestor defence on the MULTIPLIER side too ──
  // (gpt-5.5 BULWARK r3 lesson). Mirror of the badge-side test 9 logic
  // onto entities.js: a future refactor like
  //   if (this._strideEnabled) {
  //     if (this.perks.STRIDE && ss > 0) { a = Math.round(...); }
  //   }
  // would silently shift the runtime predicate without breaking the
  // strict-equality alignment compare (which only extracts the nearest
  // `if (` before the multiplier). Defence: walk back from the multiplier
  // `if (` through whitespace; the first non-whitespace character must be
  // a sibling-statement boundary (`}` or `;`), never `{` (braced ancestor),
  // `)` (braceless control ancestor), or the word `else` (else-if chain).
  let mulIfPrev = ifIdx - 1;
  while (mulIfPrev >= 0 && /\s/.test(ENTITIES_CODE[mulIfPrev])) mulIfPrev--;
  assert.ok(mulIfPrev >= 0,
    'STRIDE multiplier `if (` must not be the very start of file (anchor regression?)');
  const mulPrevChar = ENTITIES_CODE[mulIfPrev];
  assert.notEqual(mulPrevChar, '{',
    `STRIDE multiplier if-block follows a braced ancestor opener \`{\` — its effective runtime predicate now includes the outer if-condition, which the alignment compare does NOT capture. Hoist to a top-level sibling inside Player.effectiveAtk(), OR extend the alignment combinator to fold in the outer condition.`);
  assert.notEqual(mulPrevChar, ')',
    `STRIDE multiplier if-block follows a braceless control statement (e.g. \`if (...) if (this.perks.STRIDE...)\`). Its effective runtime predicate includes the outer condition. Add braces and convert to a top-level sibling.`);
  if (/[a-zA-Z_]/.test(mulPrevChar)) {
    let j = mulIfPrev;
    while (j >= 0 && /[a-zA-Z_]/.test(ENTITIES_CODE[j])) j--;
    const word = ENTITIES_CODE.slice(j + 1, mulIfPrev + 1);
    assert.notEqual(word, 'else',
      `STRIDE multiplier if-block is an \`else if\` branch — its effective runtime predicate includes the negation of the previous if-condition, which the alignment compare does NOT capture. Convert to a top-level sibling.`);
  }
  assert.ok(
    mulPrevChar === '}' || mulPrevChar === ';',
    `STRIDE multiplier if-block must be preceded by a sibling-statement boundary ('}' or ';') in entities.js Player.effectiveAtk(). Found '${mulPrevChar}' at position ${mulIfPrev}. Ensure the STRIDE gate is a top-level branch with no implicit ancestor predicate.`
  );

  // ── Layer 3: pre-normalisation receiver-qualification check ──
  // (gpt-5.5 BULWARK r2 lesson). The normaliser strips `player.` from valid
  // predicates — but it would ALSO produce a clean post-normalisation
  // form for a broken badge gate that used BARE identifiers (e.g.
  // `perks.STRIDE && _strideStacks > 0` without `player.` prefix). At
  // runtime in getStatusEffects(player), bare `perks` / `_strideStacks`
  // would throw ReferenceError. Defence: every STRIDE-relevant field
  // reference in the RAW badge cond must be receiver-qualified on
  // `player.`. The negative lookbehind `(?<![.\w])` rejects matches
  // preceded by a `.` (i.e. already qualified — `player.perks` won't
  // trigger) or a word-char (i.e. embedded in a longer identifier).
  // NOTE: `ss` is intentionally OMITTED from this check — it's a local
  // alias declared on the line above the gate (`const ss = (player.
  // _strideStacks || 0);` in content.js, `const ss = this._strideStacks
  // || 0;` in entities.js), not a field that needs qualification.
  const bareFieldRe = /(?<![.\w])(?:perks|_strideStacks)\b/g;
  const bareBadgeRefs = badgeCond.match(bareFieldRe) || [];
  assert.equal(bareBadgeRefs.length, 0,
    `badge predicate has unqualified field reference(s): [${bareBadgeRefs.join(', ')}] — every \`perks\`/\`_strideStacks\` reference must be receiver-qualified on \`player.\` (the badge sits in the free function getStatusEffects(player); bare identifiers would throw ReferenceError at runtime). Raw cond: ${badgeCond}`);
  // Symmetric check on the multiplier side (entities.js): every reference
  // must be receiver-qualified on `this.`. Without this a future refactor
  // that drops `this.` (e.g. via destructuring `const { perks } = this`)
  // would silently false-pass alignment but break the runtime contract.
  const bareMulRefs = mulCond.match(bareFieldRe) || [];
  assert.equal(bareMulRefs.length, 0,
    `multiplier predicate has unqualified field reference(s): [${bareMulRefs.join(', ')}] — every \`perks\`/\`_strideStacks\` reference must be receiver-qualified on \`this.\`. Raw cond: ${mulCond}`);

  // ── Layer 4: side-specific normalisation + leftover-token assertion ──
  // (gpt-5.5 BULWARK r1 lesson). Bidirectional receiver-stripping
  // (`this`/`player` both stripped on both sides) would silently false-
  // pass a mixed-receiver bug — e.g. badge gate `player.perks &&
  // this.perks.STRIDE && ss > 0` would normalise cleanly but at runtime
  // `this.perks` resolves to undefined in strict mode (TypeError).
  // Side-specific normalisation forbids that:
  //   - multiplier (entities.js): strips `this.` only.
  //   - badge      (content.js):  strips `player.` only (plus the leading
  //                               defensive `player.perks &&` short-circuit).
  // Then assert no foreign-receiver tokens leaked through.
  const mulNorm = normaliseMultiplierPredicate(mulCond);
  const badgeNorm = normaliseBadgePredicate(badgeCond);
  assert.ok(!/\bplayer\b/.test(mulNorm),
    `multiplier predicate (entities.js) must not reference \`player\` — found leftover after normalisation: ${mulNorm}. The multiplier sits inside a Player method; mixing receivers is a real bug.`);
  assert.ok(!/\bthis\b/.test(badgeNorm),
    `badge predicate (content.js) must not reference \`this\` — found leftover after normalisation: ${badgeNorm}. The badge sits inside the free function getStatusEffects(player); using \`this\` would resolve to undefined in strict mode (TypeError) or the global object (wrong receiver).`);
  assert.equal(badgeNorm, mulNorm,
    `badge gate predicate must match multiplier gate predicate after normalisation.\n  multiplier (entities.js):  ${mulCond}\n    → normalised:            ${mulNorm}\n  badge      (content.js):   ${badgeCond}\n    → normalised:            ${badgeNorm}\n  If you intentionally added/removed a conjunct on one side, update BOTH sides — the badge↔multiplier visual contract requires identical predicates.`);

  // Sanity: the normalised predicate must contain BOTH conjuncts (catches
  // a normalisation bug that strips too much).
  assert.ok(/perks\.STRIDE/.test(mulNorm),
    'normalised predicate must retain perks.STRIDE');
  assert.ok(/ss>0/.test(mulNorm),
    'normalised predicate must retain ss>0');
});
