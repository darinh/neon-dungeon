'use strict';
// BULWARK HUD discoverability — passive damage-reduction gate badge.
//
// CONTEXT: BULWARK is a perk that triggers at high HP. While the player's
// `hp / maxHp >= 0.75`, Player.takeDamage() multiplies all incoming damage
// by 0.85 (entities.js:11557 — pure multiplier with no max(1) clamp so env
// DoTs are reduced consistently). It's the defensive counterpart to PRISTINE
// (+25% ATK at >=90% HP) and the inverse of BERSERKER (active at <=25% HP).
//
// Pre-PR there was NO HUD signal of the active reduction. The player took
// ~15% less damage at high HP but had no visual indication that the buff
// was active — same "invisible buff" UX gap that PRs #276 (LAST_STAND),
// #280 (HOT_HAND), #282 (MOMENTUM), #284 (REGEN), #300 (RETRIBUTION),
// #302 (OVERDRIVE), and #304 (DEADEYE charging) all closed.
//
// This PR adds a single fx.push entry inside getStatusEffects()
// (src/content.js) gated on the EXACT same predicate as the multiplier
// gate at entities.js:11557:
//   `player.perks.BULWARK && player.maxHp > 0 && player.hp / player.maxHp >= 0.75`
// (with a defensive `player.perks &&` short-circuit prepended for legacy
// player shapes — same convention as PR #300/#302/#304).
//
// Tests below assert structural and runtime invariants:
//   - The fx.push call exists inside getStatusEffects with id='bulwark'.
//   - It is gated on perks.BULWARK AND maxHp>0 AND hp/maxHp>=0.75
//     (mirroring the multiplier site so badge ↔ damage-reduction
//     visibility cannot diverge).
//   - Defensive `player.perks &&` null-check (perks may be undefined on
//     legacy player shapes that bypassed the ctor).
//   - Label is a static action word (no per-frame timer formatting needed
//     — the buff is a passive HP-gate, identical UX to PRISTINE 'PRIME').
//   - Icon ◈ matches the perk-card glyph at content.js:4669 (visual
//     identification: badge ↔ perk).
//   - Colour #88ccff matches the perk-card colour at content.js:4669
//     EXACTLY (cross-file desync defence per stored memory 'HUD status fx').
//   - Strict-equality predicate alignment: badge gate matches the
//     source-of-truth multiplier gate from entities.js after
//     normalisation (per stored memory 'HUD status fx' /
//     'test source-text extraction' — substring-only matches false-pass
//     on added conjuncts).
//   - Structural ancestor check (per gpt-5.5 PR #302/#304 lesson): the
//     badge if-block sits at brace-depth EXACTLY 1 inside getStatusEffects
//     AND its controlling `if (` is preceded by a sibling-statement
//     boundary (`}` or `;`), never by `else` (else-if) or `)`
//     (braceless control ancestor).

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
 * string literals — see the structural-ancestor test below.
 * @param {string} src
 */
function blankStringContents(src) {
  return src
    .replace(/('(?:\\.|[^'\\])*')|("(?:\\.|[^"\\])*")|(`(?:\\.|[^`\\])*`)/g,
      (m) => m[0] + ' '.repeat(m.length - 2) + m[m.length - 1]);
}

const CONTENT_CODE = stripComments(CONTENT);
const ENTITIES_CODE = stripComments(ENTITIES);
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
 * Normalise the entities.js multiplier predicate for cross-file comparison.
 * Strips ONLY `this.` (the multiplier sits inside a Player method so the
 * receiver is always `this`). Mixing receivers (e.g. `player.maxHp` inside
 * Player.takeDamage) would be a real bug — assert none remain afterwards.
 * @param {string} cond
 */
function normaliseMultiplierPredicate(cond) {
  return cond
    .replace(/\s+/g, '')
    .replace(/this\./g, '');
}

/**
 * Normalise the content.js badge predicate for cross-file comparison.
 * Strips ONLY `player.` (the badge sits inside the free function
 * getStatusEffects(player) so the receiver is always `player` — using
 * `this.` here would resolve to undefined in strict mode and crash).
 * Also strips the leading defensive `player.perks &&` short-circuit
 * since entities.js side has no such guard (receivers always have .perks
 * inside Player methods).
 * @param {string} cond
 */
function normaliseBadgePredicate(cond) {
  return cond
    .replace(/\s+/g, '')
    .replace(/^player\.perks&&/, '')
    .replace(/player\./g, '');
}

// ─── getStatusEffects() BULWARK fx entry ──────────────────────────

test('getStatusEffects() function body contains a BULWARK-gated fx.push entry', () => {
  // Scope to the getStatusEffects function body via brace-walked extraction
  // so a stray 'bulwark' string elsewhere in content.js can't satisfy
  // this assertion (per stored memory 'test source-text extraction').
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch, 'getStatusEffects function body must be locatable');
  assert.match(fnBranch, /id:\s*'bulwark'/,
    'getStatusEffects must contain an fx entry with id: "bulwark"');
});

test('BULWARK fx entry is gated on perk-ownership AND maxHp>0 AND hp/maxHp>=0.75', () => {
  // All three gates required:
  //  - perks.BULWARK: a phantom hp-ratio without perk-ownership must NOT
  //    surface a buff badge to a non-owner.
  //  - maxHp > 0: divide-by-zero guard (mirrors entities.js:11557 exactly).
  //  - hp / maxHp >= 0.75: the active threshold.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  // Locate the controlling if-statement that wraps the bulwark fx.push by
  // anchoring on the .perks.BULWARK substring AND the maxHp/threshold gates.
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*\.perks[^)]*BULWARK[^)]*maxHp[^)]*0\.75[^)]*\)\s*\{/
  );
  assert.ok(ifBranch,
    'BULWARK fx.push must sit inside an if-block that gates on player.perks.BULWARK AND player.maxHp > 0 AND player.hp / player.maxHp >= 0.75');
  assert.match(ifBranch, /id:\s*'bulwark'/,
    'BULWARK fx.push must be inside the perks.BULWARK && maxHp>0 && hp/maxHp>=0.75 gate');
});

test('BULWARK fx entry guards against undefined player.perks (defensive null-check)', () => {
  // Some legacy player shapes (test sandboxes, save migrations) bypass the
  // ctor and don't have a .perks object. Without `player.perks &&` the
  // helper would throw on `undefined.BULWARK`. Pin the defensive guard.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  // The if-condition must include `player.perks &&` BEFORE
  // `player.perks.BULWARK` (short-circuit evaluation prevents null-deref).
  assert.match(fnBranch,
    /player\.perks\s*&&\s*player\.perks\.BULWARK/,
    'BULWARK gate must short-circuit on player.perks before dereferencing .BULWARK');
});

test('BULWARK fx entry has icon, label, and colour set (HUD-renderer reads them generically)', () => {
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*\.perks[^)]*BULWARK[^)]*\)\s*\{/
  );
  assert.ok(ifBranch);
  assert.match(ifBranch, /icon:\s*['"][^'"]+['"]/,
    'BULWARK fx entry must carry an icon glyph');
  assert.match(ifBranch, /label:\s*['"][^'"]+['"]/,
    'BULWARK fx entry must carry a label string');
  assert.match(ifBranch, /colour:\s*['"]#[0-9a-fA-F]+['"]/,
    'BULWARK fx entry must carry a hex colour');
});

test("BULWARK fx entry id appears EXACTLY once in content.js", () => {
  // A duplicate fx entry (e.g. via merge / copy-paste) would double-render
  // the indicator in statusFx (which keys on id). Pin the count.
  const all = CONTENT_CODE.match(/id:\s*'bulwark'/g) || [];
  assert.equal(all.length, 1,
    `content.js must contain exactly 1 id: 'bulwark' fx entry; got ${all.length}`);
});

// ─── cross-file desync defence: badge icon/colour ↔ perk-card ─────────

test('BULWARK badge icon matches the perk-card glyph (content.js PERKS table source of truth)', () => {
  // Per stored memory 'HUD status fx': when an HUD literal mirrors a
  // tuning constant declared elsewhere (PERKS table at content.js:4669),
  // a divergence will silently desync. Pin the icon.
  const perkCardMatch = CONTENT.match(
    /BULWARK:\s*\{[^}]*icon:\s*['"]([^'"]+)['"]/
  );
  assert.ok(perkCardMatch,
    'BULWARK perk-card entry must declare an icon literal');
  const perkCardIcon = perkCardMatch[1];

  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*\.perks[^)]*BULWARK[^)]*\)\s*\{/
  );
  assert.ok(ifBranch);
  const badgeIconMatch = ifBranch.match(/icon:\s*['"]([^'"]+)['"]/);
  assert.ok(badgeIconMatch, 'BULWARK badge must declare an icon literal');

  assert.equal(badgeIconMatch[1], perkCardIcon,
    `BULWARK badge icon ('${badgeIconMatch[1]}') must match the perk-card icon ('${perkCardIcon}') at content.js PERKS table — re-tuning one without the other silently desyncs the visual signal.`);
});

test('BULWARK badge colour matches the perk-card colour (content.js PERKS table source of truth)', () => {
  // Same desync defence as the icon test above, but for the hex colour.
  const perkCardMatch = CONTENT.match(
    /BULWARK:\s*\{[^}]*colour:\s*['"](#[0-9a-fA-F]+)['"]/
  );
  assert.ok(perkCardMatch,
    'BULWARK perk-card entry must declare a hex colour literal');
  const perkCardColour = perkCardMatch[1];

  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^)]*\.perks[^)]*BULWARK[^)]*\)\s*\{/
  );
  assert.ok(ifBranch);
  const badgeColourMatch = ifBranch.match(/colour:\s*['"](#[0-9a-fA-F]+)['"]/);
  assert.ok(badgeColourMatch,
    'BULWARK badge must declare a hex colour literal');

  assert.equal(badgeColourMatch[1].toLowerCase(), perkCardColour.toLowerCase(),
    `BULWARK badge colour ('${badgeColourMatch[1]}') must match the perk-card colour ('${perkCardColour}') at content.js PERKS table — re-tuning one without the other silently desyncs the visual signal.`);
});

// ─── runtime simulation: gate semantics ────────────────────────────────

test('runtime: BULWARK fx-gate semantics — six-state truth table', () => {
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
    return !!(
      player.perks
      && player.perks.BULWARK
      && player.maxHp > 0
      && player.hp / player.maxHp >= 0.75
    );
  }

  // State 1: perk owned + hp/maxHp = 1.0 (full HP) → SHOW.
  assert.equal(shouldShowFx({ perks: { BULWARK: true }, hp: 100, maxHp: 100 }),
    true, 'perk owned + full HP must show fx');

  // State 2: perk owned + hp/maxHp = 0.75 (exactly at threshold) → SHOW.
  // The gate is `>= 0.75` so 0.75 itself qualifies. Mirrors the
  // multiplier-gate semantics at entities.js:11557 exactly.
  assert.equal(shouldShowFx({ perks: { BULWARK: true }, hp: 75, maxHp: 100 }),
    true, 'perk owned + exactly 75% HP must show fx (>= threshold inclusive)');

  // State 3: perk owned + hp/maxHp = 0.74 (just below threshold) → HIDE.
  assert.equal(shouldShowFx({ perks: { BULWARK: true }, hp: 74, maxHp: 100 }),
    false, 'perk owned + 74% HP must hide fx (below 0.75 threshold)');

  // State 4: perk NOT owned + full HP (regression scenario) → HIDE.
  assert.equal(shouldShowFx({ perks: {}, hp: 100, maxHp: 100 }),
    false, 'phantom hp-ratio without perk-ownership must NOT show fx (regression defence)');

  // State 5: no perks object at all → THIS GATE hides without throwing
  // (structural defense-in-depth — does NOT imply getStatusEffects() as
  // a whole is null-safe; see SCOPE NOTE above).
  assert.equal(shouldShowFx({ hp: 100, maxHp: 100 }),
    false, 'undefined perks must hide THIS GATE without throwing (defense-in-depth, not a getStatusEffects contract)');

  // State 6: perk owned + maxHp = 0 (divide-by-zero guard) → HIDE.
  // Without the `maxHp > 0` conjunct, hp / maxHp would yield NaN (0/0)
  // or Infinity (positive/0). Mirrors the entities.js:11557 multiplier
  // gate which has the same guard.
  assert.equal(shouldShowFx({ perks: { BULWARK: true }, hp: 0, maxHp: 0 }),
    false, 'perk owned + maxHp=0 must hide fx (divide-by-zero defence)');
});

// ─── structural ancestor check (per gpt-5.5 PR #302/#304 lesson) ──────

test('BULWARK badge if-block is a direct top-level branch inside getStatusEffects (no enclosing conditional ancestors)', () => {
  // gpt-5.5 PR-review finding from PR #302/#304: the strict-equality
  // alignment test below only extracts the NEAREST `if (` before the
  // fx.push. A future refactor that adds an enclosing predicate would
  // silently false-pass:
  //
  //   (a) BRACED ancestor:
  //       if (!player._suppressed) {
  //         if (player.perks && player.perks.BULWARK && ...) {
  //           fx.push(...);
  //         }
  //       }
  //       Effective predicate: `!_suppressed && perks.BULWARK && ...`.
  //
  //   (b) ELSE-IF chain:
  //       if (player.perks && player.perks.PRISTINE ...) { ... }
  //       else if (player.perks && player.perks.BULWARK && ...) {
  //         fx.push(...);
  //       }
  //       Effective predicate: `!pristineGate && perks.BULWARK && ...`.
  //
  //   (c) BRACELESS ancestor (single-statement if):
  //       if (!player._fakeOuter)
  //         if (player.perks && player.perks.BULWARK && ...) {
  //           fx.push(...);
  //         }
  //       Effective predicate: `!_fakeOuter && perks.BULWARK && ...`.
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

  // Anchor on the BULWARK-specific fx.push BEFORE the object-literal `{`
  // so the depth count does not include the `{` of the object literal
  // itself. The id-string contents are blanked to spaces — so the literal
  // becomes `id: '       '` (7 spaces between quotes for 'bulwark'). Find
  // the corresponding fx.push in CONTENT_CODE by ordinal to confirm the
  // id is indeed 'bulwark'.
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
        if (codeMatch[1] === 'bulwark') {
          fxRel = m.index;
        }
        break;
      }
      count++;
    }
    if (fxRel !== -1) break;
  }
  assert.notEqual(fxRel, -1,
    "BULWARK fx.push({ id: 'bulwark' must appear inside the getStatusEffects function body");

  // Verify the controlling if-condition references BULWARK.
  const beforeFxFull = inner.slice(0, fxRel);
  const badgeIfIdx = beforeFxFull.lastIndexOf('if (');
  assert.notEqual(badgeIfIdx, -1,
    'BULWARK fx.push must be preceded by an `if (` predicate inside getStatusEffects');
  const badgeOpenParen = badgeIfIdx + 'if '.length;
  const badgeCondition = extractIfCondition(inner, badgeOpenParen);
  assert.ok(badgeCondition && /BULWARK/.test(badgeCondition),
    `controlling if-condition for the BULWARK badge must reference BULWARK; got '${badgeCondition}'.`);

  // ── Check (a): brace-depth must be exactly 1 ──
  let depth = 0;
  for (let i = 0; i < fxRel; i++) {
    const ch = inner[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
  }
  assert.equal(depth, 1,
    `BULWARK badge fx.push must be at brace-depth EXACTLY 1 inside getStatusEffects (only the immediate if-block enclosing it). Found depth=${depth}. A braced ancestor was added — extend the alignment combinator to cover all enclosing if-conditions, then update this assertion.`);

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
    'BULWARK badge if-block follows a braceless control statement (e.g. `if (...) if (perks.BULWARK...)`). Its effective runtime predicate includes the outer condition, which the alignment test does NOT capture. Add braces to the outer block AND extend the alignment combinator, OR convert this badge to a top-level sibling.');

  // Reject `else if` chain (predecessor word is `else`).
  if (/[a-zA-Z_]/.test(prevChar)) {
    let j = i;
    while (j >= 0 && /[a-zA-Z_]/.test(inner[j])) j--;
    const word = inner.slice(j + 1, i + 1);
    assert.notEqual(word, 'else',
      'BULWARK badge if-block is an `else if` branch — its effective runtime predicate includes the negation of the previous if-condition, which the alignment test does NOT capture. Convert to a top-level sibling if-block, OR extend the alignment combinator to fold in the `!previousCond` ancestor.');
  }

  // Otherwise: must be a sibling-statement boundary.
  assert.ok(
    prevChar === '}' || prevChar === ';',
    `BULWARK badge if-block must be preceded by a sibling-statement boundary ('}' or ';') inside getStatusEffects. Found '${prevChar}' at position ${i}. Ensure the badge is a top-level branch with no implicit ancestor predicate.`
  );
});

// ─── runtime simulation: trigger pipeline alignment ────────────────────

test('runtime: BULWARK badge gate predicate matches the multiplier gate predicate EXACTLY', () => {
  // The badge gate (content.js getStatusEffects) MUST be predicate-equal
  // to the multiplier gate (entities.js Player.takeDamage at ~line 11557:
  //   `if (this.perks.BULWARK && this.maxHp > 0 && this.hp / this.maxHp >= 0.75) {
  //      actual = actual * 0.85;
  //    }`)
  // after stripping the defensive `player.perks &&` short-circuit.
  //
  // Per gpt-5.3-codex + gpt-5.5 reviews of PR #300/#302: substring match
  // is insufficient — a future change could ADD a conjunct/disjunct to
  // either gate (e.g. `&& !this._suppressed`) and a substring assertion
  // would silently false-pass while the badge↔multiplier contract breaks.

  // ── Extract entities.js multiplier-gate condition ──
  // Anchor on the multiplier statement `actual = actual * 0.85` (the
  // BULWARK-specific multiplier; verify uniqueness below).
  const mulIdx = ENTITIES_CODE.indexOf('actual = actual * 0.85');
  assert.notEqual(mulIdx, -1,
    'entities.js must contain the BULWARK multiplier statement `actual = actual * 0.85`');
  const allMul = ENTITIES_CODE.match(/actual = actual \* 0\.85/g) || [];
  assert.equal(allMul.length, 1,
    `multiplier anchor must be unique; got ${allMul.length} matches in entities.js — re-anchor the alignment test`);

  // The BULWARK multiplier sits inside a brace-block, so the controlling
  // `if (` is on the line BEFORE the multiplier statement. Walk back to
  // the previous `if (` in source order.
  const beforeMul = ENTITIES_CODE.slice(0, mulIdx);
  const ifIdx = beforeMul.lastIndexOf('if (');
  assert.notEqual(ifIdx, -1,
    'BULWARK multiplier must be guarded by an `if (` somewhere in entities.js');
  const openParenIdx = ifIdx + 'if '.length;
  const mulCond = extractIfCondition(ENTITIES_CODE, openParenIdx);
  assert.ok(mulCond,
    'failed to extract multiplier if-condition from entities.js');
  // Sanity: must reference BULWARK (otherwise we anchored on the wrong if).
  assert.ok(/BULWARK/.test(mulCond),
    `extracted multiplier if-condition must reference BULWARK; got '${mulCond}' — re-anchor the alignment test`);

  // ── Extract content.js badge-gate condition ──
  const fxIdx = CONTENT_CODE.indexOf("id: 'bulwark'");
  assert.notEqual(fxIdx, -1,
    "content.js must contain the badge fx.push entry with id: 'bulwark'");
  const beforeFx = CONTENT_CODE.slice(0, fxIdx);
  const badgeIfIdx = beforeFx.lastIndexOf('if (');
  assert.notEqual(badgeIfIdx, -1,
    'badge fx.push must be controlled by an `if (` predicate');
  const badgeOpenParenIdx = badgeIfIdx + 'if '.length;
  const badgeCond = extractIfCondition(CONTENT_CODE, badgeOpenParenIdx);
  assert.ok(badgeCond, 'failed to extract badge if-condition from content.js');

  // ── Structural-ancestor defence on the MULTIPLIER side too (gpt-5.5 r3) ──
  // Mirror of the badge-side test 9 logic onto entities.js: a future
  // refactor like
  //   if (this._bulwarkEnabled) {
  //     if (this.perks.BULWARK && ...) { actual = actual * 0.85; }
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
    'BULWARK multiplier `if (` must not be the very start of file (anchor regression?)');
  const mulPrevChar = ENTITIES_CODE[mulIfPrev];
  assert.notEqual(mulPrevChar, '{',
    `BULWARK multiplier if-block follows a braced ancestor opener \`{\` — its effective runtime predicate now includes the outer if-condition, which the alignment compare does NOT capture. Hoist to a top-level sibling inside Player.takeDamage(), OR extend the alignment combinator to fold in the outer condition.`);
  assert.notEqual(mulPrevChar, ')',
    `BULWARK multiplier if-block follows a braceless control statement (e.g. \`if (...) if (this.perks.BULWARK...)\`). Its effective runtime predicate includes the outer condition. Add braces and convert to a top-level sibling.`);
  if (/[a-zA-Z_]/.test(mulPrevChar)) {
    let j = mulIfPrev;
    while (j >= 0 && /[a-zA-Z_]/.test(ENTITIES_CODE[j])) j--;
    const word = ENTITIES_CODE.slice(j + 1, mulIfPrev + 1);
    assert.notEqual(word, 'else',
      `BULWARK multiplier if-block is an \`else if\` branch — its effective runtime predicate includes the negation of the previous if-condition, which the alignment compare does NOT capture. Convert to a top-level sibling.`);
  }
  assert.ok(
    mulPrevChar === '}' || mulPrevChar === ';',
    `BULWARK multiplier if-block must be preceded by a sibling-statement boundary ('}' or ';') in entities.js Player.takeDamage(). Found '${mulPrevChar}' at position ${mulIfPrev}. Ensure the BULWARK gate is a top-level branch with no implicit ancestor predicate.`
  );

  // ── Pre-normalisation receiver-qualification check (per gpt-5.5 r2) ──
  // The normaliser strips `player.` from valid predicates — but it would
  // ALSO produce a clean post-normalisation form for a broken badge gate
  // that used BARE identifiers (e.g. `maxHp > 0 && hp / maxHp >= 0.75`).
  // At runtime in getStatusEffects(player), bare `hp` / `maxHp` would
  // throw ReferenceError. Defence: every BULWARK-relevant field reference
  // in the RAW badge cond must be receiver-qualified on `player.`. The
  // negative lookbehind `(?<![.\w])` rejects matches preceded by a `.`
  // (i.e. already qualified — `player.hp` won't trigger) or a word-char
  // (i.e. embedded in a longer identifier — `someHp` won't trigger).
  const bareFieldRe = /(?<![.\w])(?:hp|maxHp|perks)\b/g;
  const bareBadgeRefs = badgeCond.match(bareFieldRe) || [];
  assert.equal(bareBadgeRefs.length, 0,
    `badge predicate has unqualified field reference(s): [${bareBadgeRefs.join(', ')}] — every \`hp\`/\`maxHp\`/\`perks\` reference must be receiver-qualified on \`player.\` (the badge sits in the free function getStatusEffects(player); bare identifiers would throw ReferenceError at runtime). Raw cond: ${badgeCond}`);
  // Symmetric check on the multiplier side (entities.js): every reference
  // must be receiver-qualified on `this.`. Without this a future refactor
  // that drops `this.` (e.g. via destructuring `const { hp, maxHp, perks }
  // = this`) would silently false-pass alignment but break the runtime.
  const bareMulRefs = mulCond.match(bareFieldRe) || [];
  assert.equal(bareMulRefs.length, 0,
    `multiplier predicate has unqualified field reference(s): [${bareMulRefs.join(', ')}] — every \`hp\`/\`maxHp\`/\`perks\` reference must be receiver-qualified on \`this.\`. Raw cond: ${mulCond}`);

  // ── Compare normalised predicates (receiver-side-specific) ──
  // Per gpt-5.5 PR review: bidirectional receiver-stripping (`this`/`player`
  // both stripped on both sides) would silently false-pass a mixed-receiver
  // bug — e.g. badge gate `player.perks && this.maxHp > 0 && this.hp /
  // this.maxHp >= 0.75` reads HP from the function's `this` (undefined in
  // strict mode → TypeError, or the global → wrong object) instead of the
  // passed `player` parameter. Side-specific normalisation forbids that:
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
    `badge gate predicate must match multiplier gate predicate after normalisation.\n  multiplier (entities.js):  ${mulCond}\n    → normalised:            ${mulNorm}\n  badge      (content.js):   ${badgeCond}\n    → normalised:            ${badgeNorm}\n  If you intentionally added/removed a conjunct on one side, update BOTH sides — the badge↔reduction visual contract requires identical predicates.`);

  // Sanity: the normalised predicate must contain ALL three conjuncts
  // (catches a normalisation bug that strips too much).
  assert.ok(/perks\.BULWARK/.test(mulNorm),
    'normalised predicate must retain perks.BULWARK');
  assert.ok(/maxHp>0/.test(mulNorm),
    'normalised predicate must retain maxHp>0');
  assert.ok(/hp\/maxHp>=0\.75/.test(mulNorm),
    'normalised predicate must retain hp/maxHp>=0.75');
});
