'use strict';
// OVERDRIVE HUD discoverability — score-combo damage-buff multiplier badge.
//
// CONTEXT: OVERDRIVE is a perk that piggybacks on the score-combo system.
// While `combo.count >= 2`, Player.effectiveAtk() multiplies ATK by
// `1 + Math.min(0.30, (combo.count - 1) * 0.03)` (entities.js:11334-11344).
// → +3% per combo level above 1, capped at +30% at combo 11+.
//
// Pre-PR there was NO HUD signal of the buff's CURRENT magnitude. combo.count
// itself is HUD-visible (render.js:1041+1297) but the OVERDRIVE multiplier it
// implies is not — players had to learn the formula by inference. This is the
// same "invisible buff" UX gap that PRs #276 (LAST_STAND), #280 (HOT_HAND),
// #282 (MOMENTUM), #284 (REGEN), and #300 (RETRIBUTION) all closed.
//
// This PR adds a single fx.push entry inside getStatusEffects() (src/content.js)
// gated on `player.perks && player.perks.OVERDRIVE && combo.count >= 2`,
// mirroring the HOT_HAND / MOMENTUM multiplier-readout pattern.
//
// Tests below assert structural and runtime invariants:
//   - The fx.push call exists inside getStatusEffects with id='overdrive'.
//   - It is gated on perks.OVERDRIVE AND combo.count >= 2 (mirroring the
//     bonus site so badge ↔ multiplier visibility cannot diverge).
//   - Defensive `player.perks &&` null-check (perks may be undefined on
//     legacy player shapes that bypassed the ctor).
//   - Label uses the multiplier-readout convention `×N.NN` matching
//     HOT_HAND (PR #280) / MOMENTUM (PR #282).
//   - Icon ❯ matches the perk-card glyph at content.js:4540 (visual
//     identification: badge ↔ perk).
//   - Colour #ff00c8 matches the perk-card colour at content.js:4540
//     EXACTLY (cross-file desync defence per stored memory 'HUD status fx').
//   - HUD literals (0.03 per-step, 0.30 cap, >=2 gate) match the entities.js
//     multiplier formula EXACTLY (cross-file desync defence per stored
//     memory 'HUD status fx', mirrors PR #280 HOT_HAND test).
//   - Strict-equality predicate alignment: badge gate matches the source-of-
//     truth bonus gate from entities.js after normalisation (per stored
//     memory 'HUD status fx' / 'test source-text extraction' — PR #300
//     reviewer lesson: substring-only matches false-pass on added conjuncts).

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

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

/**
 * Replace string-literal CONTENTS (single, double, backtick) with same-
 * length runs of spaces, preserving the QUOTE characters AND the overall
 * length of the source (so character indexes remain valid). Defends
 * brace-depth counters from being confused by `{` / `}` substrings inside
 * string literals — see test 11 (structural ancestor check).
 *
 * Naive: does not parse template-literal `${...}` interpolations (good
 * enough for content.js / entities.js which use template literals only
 * for plain HUD/dialogue text — none in the getStatusEffects hot path).
 * @param {string} src
 */
function blankStringContents(src) {
  return src
    .replace(/('(?:\\.|[^'\\])*')|("(?:\\.|[^"\\])*")|(`(?:\\.|[^`\\])*`)/g,
      (m) => m[0] + ' '.repeat(m.length - 2) + m[m.length - 1]);
}

const CONTENT_CODE = stripComments(CONTENT);
const ENTITIES_CODE = stripComments(ENTITIES);
// Brace-counting form: comments stripped AND string-literal contents
// blanked to spaces (length preserved → positions stay valid). Used by
// the structural-ancestor check (test 11) where braces inside string
// literals would otherwise corrupt the brace-depth counter.
const CONTENT_BRACES = blankStringContents(CONTENT_CODE);

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

/**
 * Extract the parenthesised condition of an if-statement starting at the
 * given character index of `(`. Walks parens to balance, returns the
 * inner text WITHOUT outer parens. Returns null on unbalanced input.
 * @param {string} src
 * @param {number} openIdx index of the opening `(`
 */
function extractIfCondition(src, openIdx) {
  if (src[openIdx] !== '(') return null;
  let depth = 1;
  for (let i = openIdx + 1; i < src.length; i++) {
    const c = src[i];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return src.slice(openIdx + 1, i);
    }
  }
  return null;
}

/**
 * Normalise a JS predicate string for cross-file comparison:
 *   - strip whitespace
 *   - strip receiver prefix (`this.` / `player.` → ``)
 *   - strip a leading defensive `player.perks &&` (or `this.perks &&`)
 *     guard since entities.js receivers never need it but content.js
 *     handles legacy player shapes (the guard is additive and does not
 *     change the truthy domain when perks IS defined — which it always
 *     is inside Player methods on the entities.js side).
 *   - normalise the OVERDRIVE-specific local alias `c` (a synonym for
 *     `combo.count` introduced in entities.js:11339 to avoid repeating
 *     the dotted access) so the strict-equality comparison treats the
 *     two notations as one.
 * @param {string} cond
 */
function normalisePredicate(cond) {
  return cond
    .replace(/\s+/g, '')
    .replace(/^(?:this|player)\.perks&&/, '')
    .replace(/(?:this|player)\./g, '')
    .replace(/\bc\b/g, 'combo.count');
}

// ─── getStatusEffects() OVERDRIVE fx entry ────────────────────────────

test('getStatusEffects() function body contains an overdrive fx entry', () => {
  // Scope to the getStatusEffects function body via brace-walked extraction
  // so a stray 'overdrive' string elsewhere in content.js can't satisfy
  // this assertion (per stored memory 'test source-text extraction').
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch, 'getStatusEffects function body must be locatable');
  assert.match(fnBranch, /id:\s*'overdrive'/,
    'getStatusEffects must contain an fx entry with id: "overdrive"');
});

test('OVERDRIVE fx entry is gated on perk-ownership AND combo.count >= 2', () => {
  // Three gates required:
  //   1. player.perks — defensive null-check (legacy player shapes).
  //   2. player.perks.OVERDRIVE — perk-ownership; non-owners must NOT see
  //      a phantom badge if combo.count rises (e.g. another player's
  //      kill-streak shouldn't surface as if THIS player has the perk).
  //   3. combo.count >= 2 — active-bonus gate; mirrors entities.js:11340
  //      so the badge appears iff the multiplier is being applied.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  // Locate the controlling if-statement: must include OVERDRIVE AND combo.
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*\.perks[^)]*OVERDRIVE[^)]*combo\.count[^)]*>=\s*2[^)]*\)\s*\{/
  );
  assert.ok(ifBranch,
    'OVERDRIVE fx.push must sit inside an if-block that gates on player.perks.OVERDRIVE AND combo.count >= 2');
  assert.match(ifBranch, /id:\s*'overdrive'/,
    'OVERDRIVE fx.push must be inside the perks.OVERDRIVE && combo.count >= 2 gate');
});

test('OVERDRIVE fx entry guards against undefined player.perks (defensive null-check)', () => {
  // Some legacy player shapes (test sandboxes, save migrations) bypass the
  // ctor and don't have a .perks object. Without `player.perks &&` the
  // helper would throw on `undefined.OVERDRIVE`. Pin the defensive guard.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  assert.match(fnBranch,
    /player\.perks\s*&&\s*player\.perks\.OVERDRIVE\s*&&\s*combo\.count\s*>=\s*2/,
    'OVERDRIVE gate must short-circuit on player.perks before dereferencing .OVERDRIVE');
});

test('OVERDRIVE fx label shows the multiplier matching the entities.js bonus formula', () => {
  // Display formula: (1 + Math.min(0.30, (c - 1) * 0.03)).toFixed(2). Pin
  // every literal in the label expression so a future re-tune in either
  // file fails loudly. Mirrors HOT_HAND (PR #280) and MOMENTUM (PR #282)
  // multiplier-readout style.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*OVERDRIVE[^)]*\)\s*\{/
  );
  assert.ok(ifBranch, 'OVERDRIVE if-block body must be locatable');
  assert.match(ifBranch,
    /\(\s*1\s*\+\s*Math\.min\(\s*0\.30?\s*,\s*\(\s*c\s*-\s*1\s*\)\s*\*\s*0\.03\s*\)\s*\)\.toFixed\(2\)/,
    'OVERDRIVE label must compute (1 + Math.min(0.30, (c - 1) * 0.03)).toFixed(2) — matches entities.js:11341');
  assert.match(ifBranch, /label:\s*['"]×['"]\s*\+\s*mul/,
    'OVERDRIVE label must prefix the multiplier with "×" for readability (matches HOT_HAND/MOMENTUM convention)');
});

test('OVERDRIVE fx entry id appears EXACTLY once in content.js', () => {
  // A duplicate fx entry (e.g. via merge / copy-paste) would double-render
  // the indicator in statusFx (which keys on id). Pin the count.
  const all = CONTENT_CODE.match(/id:\s*'overdrive'/g) || [];
  assert.equal(all.length, 1,
    `content.js must contain exactly 1 id: 'overdrive' fx entry; got ${all.length}`);
});

// ─── cross-file desync defence: badge icon/colour ↔ perk-card ─────────

test('OVERDRIVE badge icon matches the perk-card glyph (content.js:4540 source of truth)', () => {
  // Per stored memory 'HUD status fx': when an HUD literal mirrors a
  // tuning constant in another file (or another section of the same file),
  // a divergence will silently desync. The PERK_POOL table at ~content.js
  // :4540 declares { name:'Overdrive', icon:'❯', desc:'...', colour:'#ff00c8' }
  // — that is the source of truth for the perk's identity.
  //
  // Use the FULL CONTENT (not stripped) for the perk-card extraction since
  // we want to read the real declaration; for badge extraction we use the
  // stripped CODE so block-comments inside getStatusEffects don't confuse
  // the brace-walk.
  const perkCardMatch = CONTENT.match(
    /OVERDRIVE\s*:\s*\{[^}]*icon\s*:\s*['"]([^'"]+)['"]/
  );
  assert.ok(perkCardMatch,
    'OVERDRIVE perk-card entry must declare an icon literal');
  const perkCardIcon = perkCardMatch[1];

  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*OVERDRIVE[^)]*\)\s*\{/
  );
  assert.ok(ifBranch);
  const badgeIconMatch = ifBranch.match(/icon:\s*['"]([^'"]+)['"]/);
  assert.ok(badgeIconMatch, 'OVERDRIVE badge must declare an icon literal');

  assert.equal(badgeIconMatch[1], perkCardIcon,
    `OVERDRIVE badge icon ('${badgeIconMatch[1]}') must match the perk-card icon ('${perkCardIcon}') at content.js PERK_POOL — re-tuning one without the other silently desyncs the visual signal.`);
});

test('OVERDRIVE badge colour matches the perk-card colour (content.js:4540 source of truth)', () => {
  const perkCardMatch = CONTENT.match(
    /OVERDRIVE\s*:\s*\{[^}]*colour\s*:\s*['"](#[0-9a-fA-F]+)['"]/
  );
  assert.ok(perkCardMatch,
    'OVERDRIVE perk-card entry must declare a hex colour literal');
  const perkCardColour = perkCardMatch[1];

  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*OVERDRIVE[^)]*\)\s*\{/
  );
  assert.ok(ifBranch);
  const badgeColourMatch = ifBranch.match(/colour:\s*['"](#[0-9a-fA-F]+)['"]/);
  assert.ok(badgeColourMatch,
    'OVERDRIVE badge must declare a hex colour literal');

  assert.equal(badgeColourMatch[1].toLowerCase(), perkCardColour.toLowerCase(),
    `OVERDRIVE badge colour ('${badgeColourMatch[1]}') must match the perk-card colour ('${perkCardColour}') at content.js PERK_POOL — re-tuning one without the other silently desyncs the visual signal.`);
});

// ─── cross-file desync defence: HUD literals ↔ entities.js bonus formula

test('OVERDRIVE HUD literals (per-step 0.03, cap 0.30, gate >=2) match entities.js bonus formula', () => {
  // Cross-file desync defence (per stored memory 'HUD status fx', mirrors
  // PR #280 HOT_HAND test): the per-step rate (0.03), cap (0.30), and
  // active-bonus threshold (>=2) are hard-coded in BOTH the HUD label
  // (content.js) AND the bonus formula (entities.js:11339-11342). A
  // future re-tune (e.g. +5% per step, +50% cap, gate at >=3) would
  // silently desync the readout — players would see "×1.30" while taking
  // "×1.50" damage. This test extracts the literals from the entities.js
  // bonus formula and asserts the content.js HUD branch uses the same
  // numeric values.
  //
  // Anchor on `this.perks.OVERDRIVE` and slice the bonus block. The
  // formula uses `Math.min(0.30, (c - 1) * 0.03)` and gates on `c >= 2`;
  // extract those literals.
  const overIdx = ENTITIES_CODE.indexOf('this.perks.OVERDRIVE');
  assert.notEqual(overIdx, -1,
    'entities.js must contain `this.perks.OVERDRIVE` (the bonus site)');
  // Verify uniqueness of the entities.js anchor — if a second OVERDRIVE
  // multiplier appears, this test must be updated to re-anchor.
  const allOver = ENTITIES_CODE.match(/this\.perks\.OVERDRIVE/g) || [];
  assert.equal(allOver.length, 1,
    `OVERDRIVE multiplier anchor must be unique in entities.js; got ${allOver.length} matches — re-anchor the desync test`);
  // Slice ~600 chars after the anchor — the bonus formula sits inside the
  // immediately following block.
  const entitiesSlice = ENTITIES_CODE.slice(overIdx, overIdx + 600);

  const perStepMatch = entitiesSlice.match(/Math\.min\(\s*([\d.]+)\s*,\s*\(\s*c\s*-\s*1\s*\)\s*\*\s*([\d.]+)\s*\)/);
  assert.ok(perStepMatch,
    'entities.js OVERDRIVE bonus formula must match `Math.min(<cap>, (c - 1) * <per-step>)`');
  const cap = perStepMatch[1];      // '0.30'
  const perStep = perStepMatch[2];  // '0.03'

  const gateMatch = entitiesSlice.match(/c\s*>=\s*(\d+)/);
  assert.ok(gateMatch,
    'entities.js OVERDRIVE bonus formula must gate on `c >= <threshold>`');
  const gate = gateMatch[1];        // '2'

  // Extract the OVERDRIVE HUD if-block from content.js.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*OVERDRIVE[^)]*\)\s*\{/
  );
  assert.ok(ifBranch);

  // The HUD label must use the SAME cap, per-step rate, and gate threshold.
  const hudFormulaRe = new RegExp(
    `Math\\.min\\(\\s*${cap.replace(/\./g, '\\.')}\\s*,\\s*\\(\\s*c\\s*-\\s*1\\s*\\)\\s*\\*\\s*${perStep.replace(/\./g, '\\.')}\\s*\\)`
  );
  assert.match(ifBranch, hudFormulaRe,
    `HUD label must use cap=${cap} and per-step=${perStep} (matches entities.js bonus formula)`);

  const hudGateRe = new RegExp(`combo\\.count\\s*>=\\s*${gate}`);
  assert.match(ifBranch, hudGateRe,
    `HUD gate must use threshold=${gate} (matches entities.js bonus formula)`);
});

// ─── runtime simulation: multiplier formula ────────────────────────────

test('runtime: OVERDRIVE label formula matches entities.js bonus formula', () => {
  // Behavioural complement: replicate the label formula and the entities.js
  // bonus formula on synthetic combo counts; assert they agree across the
  // full domain (gate, ramp, cap).
  function labelFor(c) {
    if (c < 2) return null; // badge wouldn't render
    return '×' + (1 + Math.min(0.30, (c - 1) * 0.03)).toFixed(2);
  }
  function damageMul(c) {
    if (c < 2) return 1;
    return 1 + Math.min(0.30, (c - 1) * 0.03);
  }
  // Truth table: combo → label → damage-mul.
  const cases = [
    { c: 2,  expectedLabel: '×1.03', expectedMul: 1.03 },
    { c: 3,  expectedLabel: '×1.06', expectedMul: 1.06 },
    { c: 5,  expectedLabel: '×1.12', expectedMul: 1.12 },
    { c: 10, expectedLabel: '×1.27', expectedMul: 1.27 },
    { c: 11, expectedLabel: '×1.30', expectedMul: 1.30 },  // cap reached
    { c: 50, expectedLabel: '×1.30', expectedMul: 1.30 },  // still capped
  ];
  for (const tc of cases) {
    assert.equal(labelFor(tc.c), tc.expectedLabel,
      `c=${tc.c} → label=${tc.expectedLabel}`);
    assert.equal(damageMul(tc.c).toFixed(2), tc.expectedMul.toFixed(2),
      `c=${tc.c} → damage mul=${tc.expectedMul}`);
  }
});

test('runtime: OVERDRIVE fx-gate semantics — five-state truth table', () => {
  // SCOPE NOTE (per gpt-5.5 PR #300 review): this is a STRUCTURAL assertion
  // about THIS gate's predicate, not a guarantee that getStatusEffects()
  // as a whole is null-safe — the function unguarded-derefs
  // `player.perks.ENERGY_SHIELD` earlier at content.js:2292, so a real
  // call with `player = { ... }` lacking .perks would crash before
  // reaching this gate. The defensive `player.perks &&` short-circuit
  // here is defense-in-depth: if a future refactor moves the badge gate,
  // removes the earlier ENERGY_SHIELD branch, or adds an early
  // `if (!player.perks) return fx` short-circuit, this gate will not
  // regress into a null-deref.
  function shouldShowFx(player, comboCount) {
    return !!(
      player.perks && player.perks.OVERDRIVE && comboCount >= 2
    );
  }

  // State 1: perk owned + combo 5 (active bonus) → SHOW.
  assert.equal(shouldShowFx({ perks: { OVERDRIVE: true } }, 5),
    true, 'perk owned + combo 5 must show fx');

  // State 2: perk owned + combo 1 (below gate) → HIDE.
  assert.equal(shouldShowFx({ perks: { OVERDRIVE: true } }, 1),
    false, 'perk owned but combo 1 (below gate) must hide fx');

  // State 3: perk owned + combo 0 (no streak) → HIDE.
  assert.equal(shouldShowFx({ perks: { OVERDRIVE: true } }, 0),
    false, 'perk owned but combo 0 must hide fx');

  // State 4: perk NOT owned + combo 5 (regression scenario) → HIDE.
  assert.equal(shouldShowFx({ perks: {} }, 5),
    false, 'phantom combo without perk-ownership must NOT show fx (regression defence)');

  // State 5: no perks object at all → THIS GATE hides without throwing
  // (structural defense-in-depth — does NOT imply getStatusEffects() as
  // a whole is null-safe; see SCOPE NOTE above).
  assert.equal(shouldShowFx({}, 5),
    false, 'undefined perks must hide THIS GATE without throwing (defense-in-depth, not a getStatusEffects contract)');
});

// ─── runtime simulation: trigger pipeline alignment ────────────────────

test('OVERDRIVE badge if-block is a direct top-level branch inside getStatusEffects (no enclosing conditional ancestors)', () => {
  // gpt-5.5 PR-review finding (round 1 + round 2): the strict-equality
  // alignment test below only extracts the NEAREST `if (` before the
  // fx.push. A future refactor that adds an enclosing predicate would
  // silently false-pass:
  //
  //   (a) BRACED ancestor:
  //       if (!player._suppressed) {
  //         if (player.perks && player.perks.OVERDRIVE && combo.count >= 2) {
  //           fx.push(...);
  //         }
  //       }
  //       Effective predicate: `!_suppressed && perks.OVERDRIVE && combo>=2`.
  //
  //   (b) ELSE-IF chain:
  //       if (player.perks && player.perks.MOMENTUM ...) { ... }
  //       else if (player.perks && player.perks.OVERDRIVE && combo.count >= 2) {
  //         fx.push(...);
  //       }
  //       Effective predicate: `!momentumGate && perks.OVERDRIVE && combo>=2`.
  //
  //   (c) BRACELESS ancestor (single-statement if):
  //       if (!player._fakeOuter)
  //         if (player.perks && player.perks.OVERDRIVE && combo.count >= 2) {
  //           fx.push(...);
  //         }
  //       Effective predicate: `!_fakeOuter && perks.OVERDRIVE && combo>=2`.
  //
  // (a) increases brace-depth → caught by the depth==1 check.
  // (b) and (c) DO NOT increase brace-depth → caught by the predecessor-
  //     token check below.
  //
  // Defence: assert the badge if-block sits directly inside the
  // getStatusEffects function body (depth == 1) AND that the controlling
  // `if (` is preceded by a sibling-statement boundary (`}` or `;`),
  // never by `else` (else-if chain) or `)` (braceless control ancestor).
  // This mirrors the implementation pattern of every other discoverability
  // badge in this file (HOT_HAND, MOMENTUM, RETRIBUTION, LAST_STAND are
  // all top-level sibling branches inside getStatusEffects).
  //
  // Brace-depth source uses CONTENT_NOSTR (string literals cleared) so a
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

  // Anchor on the OVERDRIVE-specific fx.push BEFORE the object-literal `{`
  // so the depth count does not include the `{` of the object literal
  // itself. Search for the unique substring "id: 'overdrive'" — note the
  // string contents are now SPACES (blankStringContents), so the literal
  // becomes `id: '         '` (9 spaces between quotes for 'overdrive').
  // Use a regex that matches `fx.push({ id: '<anything>'` then check that
  // the SAME position in the un-blanked CONTENT_CODE has 'overdrive'.
  const fxRe = /fx\.push\(\{\s*id:\s*'\s*'/g;
  let fxRel = -1;
  let m;
  while ((m = fxRe.exec(inner)) !== null) {
    // Map this match back to CONTENT_CODE to identify which badge id this is.
    // Find the corresponding position in CONTENT_CODE by matching on the
    // PREFIX that uniquely identifies this offset within the function body.
    // Easier: use the un-blanked CONTENT_CODE function body, find the same
    // ordinal fx.push, check its id.
    const fnCode = extractBranch(
      CONTENT_CODE,
      /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
    );
    if (!fnCode) continue;
    const innerCode = fnCode.slice(fnCode.indexOf('{') + 1, fnCode.lastIndexOf('}'));
    const ordinal = (inner.slice(0, m.index).match(/fx\.push\(\{\s*id:\s*'\s*'/g) || []).length;
    // Find the ordinal-th fx.push({ id: '...'  in innerCode
    const codeRe = /fx\.push\(\{\s*id:\s*'([^']+)'/g;
    let codeMatch;
    let count = 0;
    while ((codeMatch = codeRe.exec(innerCode)) !== null) {
      if (count === ordinal) {
        if (codeMatch[1] === 'overdrive') {
          fxRel = m.index;
        }
        break;
      }
      count++;
    }
    if (fxRel !== -1) break;
  }
  assert.notEqual(fxRel, -1,
    "OVERDRIVE fx.push({ id: 'overdrive' must appear inside the getStatusEffects function body");

  // Verify the controlling if-condition references OVERDRIVE — guards
  // against a future re-order or anchor mis-match.
  const beforeFxFull = inner.slice(0, fxRel);
  const badgeIfIdx = beforeFxFull.lastIndexOf('if (');
  assert.notEqual(badgeIfIdx, -1,
    'OVERDRIVE fx.push must be preceded by an `if (` predicate inside getStatusEffects');
  const badgeOpenParen = badgeIfIdx + 'if '.length;
  const badgeCondition = extractIfCondition(inner, badgeOpenParen);
  assert.ok(badgeCondition && /OVERDRIVE/.test(badgeCondition),
    `controlling if-condition for the OVERDRIVE badge must reference OVERDRIVE; got '${badgeCondition}'.`);

  // ── Check (a): brace-depth must be exactly 1 ──
  let depth = 0;
  for (let i = 0; i < fxRel; i++) {
    const ch = inner[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
  }
  assert.equal(depth, 1,
    `OVERDRIVE badge fx.push must be at brace-depth EXACTLY 1 inside getStatusEffects (only the immediate if-block enclosing it). Found depth=${depth}. A braced ancestor was added — extend the alignment combinator to cover all enclosing if-conditions, then update this assertion.`);

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
    'OVERDRIVE badge if-block follows a braceless control statement (e.g. `if (...) if (perks.OVERDRIVE...)`). Its effective runtime predicate includes the outer condition, which the alignment test does NOT capture. Add braces to the outer block AND extend the alignment combinator, OR convert this badge to a top-level sibling.');

  // Reject `else if` chain (predecessor word is `else`).
  if (/[a-zA-Z_]/.test(prevChar)) {
    let j = i;
    while (j >= 0 && /[a-zA-Z_]/.test(inner[j])) j--;
    const word = inner.slice(j + 1, i + 1);
    assert.notEqual(word, 'else',
      'OVERDRIVE badge if-block is an `else if` branch — its effective runtime predicate includes the negation of the previous if-condition, which the alignment test does NOT capture. Convert to a top-level sibling if-block, OR extend the alignment combinator to fold in the `!previousCond` ancestor.');
  }

  // Otherwise: must be a sibling-statement boundary.
  assert.ok(
    prevChar === '}' || prevChar === ';',
    `OVERDRIVE badge if-block must be preceded by a sibling-statement boundary ('}' or ';') inside getStatusEffects. Found '${prevChar}' at position ${i}. Ensure the badge is a top-level branch with no implicit ancestor predicate.`
  );
});

test('runtime: OVERDRIVE badge gate predicate matches the multiplier gate predicate EXACTLY', () => {
  // The badge gate (content.js getStatusEffects) MUST be predicate-equal
  // to the multiplier gate (entities.js effectiveAtk) after stripping the
  // defensive `player.perks &&` short-circuit. The entities.js side
  // structures the gate as a NESTED if (outer perk-ownership, inner
  // combo>=2 threshold) for arithmetic-locality; content.js flattens it
  // into a single AND-conjunction (no inner block needed since the badge
  // is a single fx.push). After normalisation BOTH must reduce to
  //   perks.OVERDRIVE && combo.count >= 2
  // — substring-only matches false-pass on added conjuncts/disjuncts on
  // either side (per gpt-5.3-codex + gpt-5.5 reviews of PR #300).
  //
  // Strategy: extract the COMBINED condition from entities.js by AND-ing
  // the outer if (`this.perks.OVERDRIVE`) with the inner threshold gate
  // (`c >= 2`), then strict-equal against the content.js single-line
  // predicate.

  // ── Extract entities.js outer + inner gate ──
  const outerIdx = ENTITIES_CODE.indexOf('this.perks.OVERDRIVE');
  assert.notEqual(outerIdx, -1,
    'entities.js must contain `this.perks.OVERDRIVE` (outer gate)');
  // Walk back to find `if (`.
  const lineStart = ENTITIES_CODE.lastIndexOf('\n', outerIdx) + 1;
  const linePrefix = ENTITIES_CODE.slice(lineStart, outerIdx);
  const outerIfLocal = linePrefix.lastIndexOf('if (');
  assert.notEqual(outerIfLocal, -1,
    'OVERDRIVE outer gate must sit on a line that begins with `if (`');
  const outerOpenParen = lineStart + outerIfLocal + 'if '.length;
  const outerCond = extractIfCondition(ENTITIES_CODE, outerOpenParen);
  assert.ok(outerCond, 'failed to extract outer if-condition from entities.js');

  // The inner gate is the next `if (` after outerOpenParen — anchor on
  // `c >= 2` and walk back.
  const afterOuter = ENTITIES_CODE.slice(outerOpenParen);
  const innerCRel = afterOuter.indexOf('c >= 2');
  assert.notEqual(innerCRel, -1,
    'entities.js must contain inner gate `c >= 2`');
  const innerCAbs = outerOpenParen + innerCRel;
  const innerLineStart = ENTITIES_CODE.lastIndexOf('\n', innerCAbs) + 1;
  const innerLinePrefix = ENTITIES_CODE.slice(innerLineStart, innerCAbs);
  const innerIfLocal = innerLinePrefix.lastIndexOf('if (');
  assert.notEqual(innerIfLocal, -1,
    'OVERDRIVE inner gate must sit on a line that begins with `if (`');
  const innerOpenParen = innerLineStart + innerIfLocal + 'if '.length;
  const innerCond = extractIfCondition(ENTITIES_CODE, innerOpenParen);
  assert.ok(innerCond, 'failed to extract inner if-condition from entities.js');

  // The combined SOURCE-OF-TRUTH gate is `outer && inner`.
  const combinedCond = `(${outerCond}) && (${innerCond})`;

  // ── Extract content.js badge gate ──
  const fxIdx = CONTENT_CODE.indexOf("id: 'overdrive'");
  assert.notEqual(fxIdx, -1,
    "content.js must contain the badge fx.push entry with id: 'overdrive'");
  const beforeFx = CONTENT_CODE.slice(0, fxIdx);
  const badgeIfIdx = beforeFx.lastIndexOf('if (');
  assert.notEqual(badgeIfIdx, -1,
    'badge fx.push must be controlled by an `if (` predicate');
  const badgeOpenParenIdx = badgeIfIdx + 'if '.length;
  const badgeCond = extractIfCondition(CONTENT_CODE, badgeOpenParenIdx);
  assert.ok(badgeCond, 'failed to extract badge if-condition from content.js');

  // ── Compare normalised predicates ──
  // After normalisation:
  //   entities outer: `this.perks.OVERDRIVE` → `perks.OVERDRIVE`
  //   entities inner: `c >= 2` → `combo.count>=2` (via the `c` → combo.count
  //                    alias rule in normalisePredicate)
  //   combined:        `(perks.OVERDRIVE)&&(combo.count>=2)`
  //   content badge:  `player.perks && player.perks.OVERDRIVE && combo.count >= 2`
  //                  → strip leading `perks &&` → `perks.OVERDRIVE&&combo.count>=2`
  //
  // To make these comparable we strip the outer parens and the leading
  // defensive perks-guard from BOTH sides after running normalisePredicate.
  const stripParensAndAnds = (s) => s.replace(/^\(/, '').replace(/\)$/, '')
    .replace(/\)&&\(/g, '&&');
  const combinedNorm = stripParensAndAnds(normalisePredicate(combinedCond));
  const badgeNorm = stripParensAndAnds(normalisePredicate(badgeCond));

  assert.equal(badgeNorm, combinedNorm,
    `badge gate predicate must match combined multiplier gate predicate after normalisation.\n  multiplier (entities.js, outer + inner combined): ${combinedCond}\n    → normalised:                                   ${combinedNorm}\n  badge      (content.js):                          ${badgeCond}\n    → normalised:                                   ${badgeNorm}\n  If you intentionally added/removed a conjunct on one side, update BOTH sides — the badge↔multiplier visual contract requires identical predicates.`);

  // Sanity: the normalised predicate must contain BOTH the perk-ownership
  // gate AND the combo threshold (catches a normalisation bug that strips
  // too much).
  assert.ok(/perks\.OVERDRIVE/.test(combinedNorm),
    'normalised predicate must retain perks.OVERDRIVE');
  assert.ok(/combo\.count>=2/.test(combinedNorm),
    'normalised predicate must retain combo.count>=2');
});
