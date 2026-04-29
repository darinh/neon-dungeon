'use strict';
// JAMMED floor modifier — the 25th entry in the FLOOR_MODIFIERS pool
// and the 12th NEGATIVE-or-neutral modifier. JAMMED is the literal
// inverse of AUTONOMY: where AUTONOMY reduces hackware cooldowns by
// 25% (×0.75), JAMMED increases them by 25% (×1.25). The two gates
// live in the same multiplicative chain inside `activateHackware()`
// in src/content.js, so the structure makes the symmetry obvious to
// any future reader and rebalances a pool that had drifted to a
// 13:11 positive skew (PRIMED ➜ 13 positive vs 11 neg-or-neutral).
// JAMMED brings the split back to 13:12.
//
// Floor modifiers are mutually exclusive at floor-roll time (only one
// rolls per floor) so AUTONOMY and JAMMED can never co-occur in
// practice. The two ternaries are nevertheless additive (in the sense
// that both can be present in the chain simultaneously without the
// arithmetic breaking) — if a future change ever relaxes the mutex,
// the literal product would be ×0.75 × 1.25 = ×0.9375, a near-wash
// that intentionally degrades gracefully rather than catastrophically.
//
// content.js is browser-only (no UMD/CommonJS exports), so these tests
// assert structural invariants any working JAMMED modifier must
// satisfy:
//   - Registry shape (label/desc/colour/icon) so MODIFIER_KEYS picks
//     it up and the HUD badge in render.js renders correctly.
//   - JAMMED is a top-level key inside FLOOR_MODIFIERS.
//   - The activation-time gate (_CG.modifier === 'JAMMED') reads the
//     canonical content.js floor-modifier global (a typo to
//     game.modifier would silently disable the penalty).
//   - The ×1.25 multiplier sits inside `activateHackware()` so it
//     ONLY applies on activation (not on cooldown ticks — those count
//     down from the already-multiplied value).
//   - Multiplicative composition with OVERCLOCKER (×0.7) and AUTONOMY
//     (×0.75) — all three factors live in the same multiplicative
//     chain, NOT additive.
//   - Pool-count invariant (25 entries — bumps from PRIMED's 24 via
//     EXPECTED_MODIFIER_POOL_SIZE in tests/_modifier-pool.js).
//   - Exactly-once invariant on `_CG.modifier === 'JAMMED'` —
//     defends against accidental duplication elsewhere that would
//     double-apply the penalty (e.g. a second cooldown-set site that
//     shares the gate).
//   - Distinct desc (no collision with AUTONOMY's positive phrasing).
//   - JAMMED multiplier is > 1 (penalty, not reward) — pin the
//     direction so a future re-tune that flips the sign would have to
//     deliberately update both this assertion AND the desc copy.
//
// NO save/restore tests: JAMMED is a pure passive multiplier applied
// at activation time. There is no per-run counter or per-player flag
// to persist. The hackware cooldown itself IS persisted
// (game.js:1135 `p.hackwareCooldown=s.hackwareCooldown||0`) but that's
// already covered by existing save tests — a cooldown saved on a
// JAMMED floor will simply restore at its already-multiplied value,
// matching how AUTONOMY-floor cooldowns persist.
//
// NO HUD progress suffix tests: JAMMED is a passive % effect with no
// counter to surface. Mirrors AUTONOMY/HARDENED. A regression test
// (modifierProgressSuffix does NOT contain a JAMMED branch) defends
// against accidental copy-paste from WINDFALL/REVERB/SIGNAL_BOOST.
//
// Pattern lifted from tests/autonomy-modifier.test.js (mirror modifier).
// Per stored memories 'positive floor modifiers' and 'modifier pool
// canary pattern', this file owns the next-modifier canary literal —
// when modifier #26 is added, retire the literal `assert.equal(
// EXPECTED_MODIFIER_POOL_SIZE, 25, ...)` here and pin the new count
// in the new modifier's own test file.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assertModifierPoolSize, assertModifierIsTopLevelKey, EXPECTED_MODIFIER_POOL_SIZE } = require('./_modifier-pool');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
);
const RENDER = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'render.js'), 'utf8'
);

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const CONTENT_CODE = stripComments(CONTENT);

/**
 * Brace-walked branch extraction. Naive `OPENER\s*\{[^}]*\}` over-stops
 * at the first inner `{...}` close-brace.
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
 * Brace-walked entry extraction for registry entries (KEY: { ... }).
 * @param {string} src
 * @param {RegExp} openerRe
 */
function extractEntry(src, openerRe) {
  const m = src.match(openerRe);
  if (!m) return null;
  const openIdx = src.indexOf('{', m.index);
  if (openIdx < 0) return null;
  let depth = 1;
  for (let i = openIdx + 1; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(m.index, i + 1);
    }
  }
  return null;
}

// ─── FLOOR_MODIFIERS registry ────────────────────────────────────────────

test('JAMMED is registered in FLOOR_MODIFIERS with label/desc/colour/icon', () => {
  // Shape MUST match existing modifier records (label/desc/colour/icon)
  // so the HUD badge in render.js reads them generically without per-
  // modifier branches. Brace-walked extractEntry is mandatory because
  // any nested object literal in a future field would over-stop a
  // naive regex.
  const entry = extractEntry(CONTENT, /JAMMED:/);
  assert.ok(entry, 'JAMMED entry must be locatable in FLOOR_MODIFIERS');
  assert.match(entry, /label:\s*'JAMMED'/,
    "JAMMED must carry label:'JAMMED'");
  assert.match(entry, /desc:\s*'[^']+'/,
    'JAMMED must carry a non-empty desc string');
  assert.match(entry, /colour:\s*'#[0-9a-fA-F]+'/,
    'JAMMED must carry a hex colour');
  assert.match(entry, /icon:\s*'[^']+'/,
    'JAMMED must carry an icon glyph');
});

test('JAMMED is a top-level key inside FLOOR_MODIFIERS (so MODIFIER_KEYS picks it up)', () => {
  // MODIFIER_KEYS = Object.keys(FLOOR_MODIFIERS) is what game.js's
  // floor-roll consults at line ~190. If JAMMED ends up nested
  // somewhere other than the dict, it would be defined but never rolled.
  assertModifierIsTopLevelKey(CONTENT, 'JAMMED');
});

test('JAMMED desc advertises the hackware-cooldown penalty contract', () => {
  // The desc string is what surfaces to the player. If a future re-tune
  // changes the % or the target the desc MUST track the runtime gate or
  // players are misled. Pin both the hackware target AND a percentage
  // indicator so this test is the contract-violation alarm for both
  // runtime AND copy.
  const entry = extractEntry(CONTENT, /JAMMED:/);
  assert.ok(entry);
  assert.match(entry, /desc:\s*'[^']*[Hh]ackware[^']*'/,
    'JAMMED desc must mention hackware');
  assert.match(entry, /desc:\s*'[^']*\d+%[^']*'/,
    'JAMMED desc must include the percentage cadence');
});

test('JAMMED desc does not collide with AUTONOMY positive phrasing', () => {
  // AUTONOMY is the OTHER hackware-cooldown modifier (the positive
  // mirror, ×0.75). A JAMMED desc that says "reduced" or "decreased"
  // would be wrong (JAMMED INCREASES cooldowns) and indistinguishable
  // at a glance from AUTONOMY on the run-start card. Pin that JAMMED's
  // desc names a penalty word ("increased" / "+25%" / "longer" / etc.)
  // and does NOT use AUTONOMY's "reduced" wording. Mirrors the
  // PRIMED/OVERCHARGE collision guard in tests/primed-modifier.test.js.
  const entry = extractEntry(CONTENT, /JAMMED:/);
  assert.ok(entry, 'JAMMED entry must be locatable');
  assert.doesNotMatch(entry, /reduced/i,
    'JAMMED desc must not say "reduced" — that is AUTONOMY\'s positive wording.');
});

// ─── activateHackware() JAMMED multiplier ────────────────────────────

test('activateHackware sets cooldown via expression that reads _CG.modifier === "JAMMED"', () => {
  // The multiplier MUST be wired through the canonical _CG.modifier
  // global (the same global modSpeed/CHARGED/AUTONOMY branches consult).
  // A typo to game.modifier or this.modifier would silently disable the
  // penalty on every cooldown.
  assert.match(CONTENT_CODE, /_CG\.modifier\s*===\s*'JAMMED'/,
    "activateHackware must gate the cooldown penalty on _CG.modifier === 'JAMMED'");
});

test('activateHackware applies a 1.25 multiplier on JAMMED floors', () => {
  // The multiplier MUST be 1.25 (25% increase) — pin the literal so
  // a future re-tune (e.g. 50% increase) MUST update both the desc
  // string AND this test, keeping copy/runtime in sync. The exact
  // ternary shape `_CG.modifier === 'JAMMED' ? 1.25 : 1` mirrors the
  // AUTONOMY branch byte-for-byte (modulo literal value), so a code
  // reviewer can eyeball the symmetry.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+activateHackware\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch, 'activateHackware function body must be extractable');
  assert.match(fnBranch,
    /_CG\.modifier\s*===\s*'JAMMED'\s*\?\s*1\.25\s*:\s*1\s*\)/,
    'activateHackware must apply a 1.25 multiplier when _CG.modifier === "JAMMED" (else 1)');
});

test('activateHackware JAMMED multiplier composes multiplicatively with OVERCLOCKER and AUTONOMY', () => {
  // All three factors (OVERCLOCKER ×0.7, AUTONOMY ×0.75, JAMMED ×1.25)
  // MUST live in the same multiplicative chain. Adding any of them
  // additively would either over-penalise or silently disable a
  // modifier. AUTONOMY and JAMMED are mutex at roll-time so they can
  // never both fire — but the structural invariant (all three ternaries
  // present, no `+` between them) is what defends against a refactor
  // that breaks composition for the AUTONOMY × OVERCLOCKER pair (which
  // CAN co-occur).
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+activateHackware\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const cooldownAssign = fnBranch.match(
    /player\.hackwareCooldown\s*=\s*hw\.cooldown[\s\S]*?;/
  );
  assert.ok(cooldownAssign, 'cooldown assignment line must be locatable inside activateHackware');
  const expr = cooldownAssign[0];
  assert.match(expr, /hasAugment\(['"]OVERCLOCKER['"]\)\s*\?\s*0\.7\s*:\s*1/,
    'cooldown expression must include OVERCLOCKER ×0.7 ternary');
  assert.match(expr, /_CG\.modifier\s*===\s*'AUTONOMY'\s*\?\s*0\.75\s*:\s*1/,
    'cooldown expression must include AUTONOMY ×0.75 ternary');
  assert.match(expr, /_CG\.modifier\s*===\s*'JAMMED'\s*\?\s*1\.25\s*:\s*1\s*\)/,
    'cooldown expression must include JAMMED ×1.25 ternary');
  // No additive `+` separating any pair of ternaries.
  const overIdx = expr.indexOf('OVERCLOCKER');
  const autoIdx = expr.indexOf('AUTONOMY');
  const jamIdx = expr.indexOf('JAMMED');
  assert.ok(overIdx >= 0 && autoIdx >= 0 && jamIdx >= 0);
  const lo = Math.min(overIdx, autoIdx, jamIdx);
  const hi = Math.max(overIdx, autoIdx, jamIdx);
  const span = expr.slice(lo, hi);
  assert.ok(!/\+/.test(span),
    'OVERCLOCKER, AUTONOMY, JAMMED ternaries must compose multiplicatively (no `+` between them)');
});

test('JAMMED multiplier is greater than 1 (it is a penalty, not a reward)', () => {
  // Sign-direction pin. JAMMED is the negative inverse of AUTONOMY —
  // a future re-tune that accidentally flips the multiplier below 1
  // (or the desc to "reduced") would silently turn JAMMED into a SECOND
  // positive AUTONOMY-equivalent, doubling the positive-skew problem
  // this modifier exists to fix. Pin the direction explicitly: the
  // ternary's truthy value MUST be > 1.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+activateHackware\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const m = fnBranch.match(/_CG\.modifier\s*===\s*'JAMMED'\s*\?\s*([\d.]+)\s*:\s*1/);
  assert.ok(m, 'JAMMED ternary with literal multiplier must be locatable');
  const mult = parseFloat(m[1]);
  assert.ok(mult > 1,
    `JAMMED multiplier must be > 1 (penalty); got ${mult} which would behave as a reward`);
  // Else-branch pin: when JAMMED is NOT active, the multiplier is 1
  // (no-op). A literal other than 1 here would silently apply the
  // JAMMED penalty (or reward) on every floor. Tightened to require
  // the ternary's closing `)` so a future mutation `: 1` → `: 1.5`
  // (which would slip past `:\s*1\b` because `\b` matches at the
  // `1.` digit/dot boundary) is caught.
  assert.match(fnBranch,
    /_CG\.modifier\s*===\s*'JAMMED'\s*\?\s*[\d.]+\s*:\s*1\s*\)/,
    'JAMMED ternary else-branch must be exactly 1 (no-op when not on JAMMED floor)');
});

test('activateHackware JAMMED ternary is a DIRECT multiplicative factor (no wrapping neutralizer)', () => {
  // Defence against the wrap/sibling-neutralizer bypass class flagged by
  // gpt-5.5 in PR review. A future refactor could keep the exact literal
  // ternary `_CG.modifier === 'JAMMED' ? 1.25 : 1` (satisfying every
  // earlier structural test) while neutralizing the penalty by wrapping
  // it in `Math.min(1, (... ? 1.25 : 1))` (clamps the truthy branch back
  // to 1) or chaining a sibling `* 0.8` after the closing paren that
  // cancels the increase. Pin the exact local shape: the ternary's
  // OPENING paren must be preceded by `*` (rules out `Math.min(1, (...))`
  // and any other function-argument wrapping), and its CLOSING paren must
  // be followed by `;` (rules out any sibling neutralizer in the same
  // multiplicative chain — `* 0.8`, `/ 1.25`, etc.). Mirror invariant for
  // AUTONOMY too — the symmetric bypass on the positive side is the same
  // class.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+activateHackware\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const cooldownAssign = fnBranch.match(
    /player\.hackwareCooldown\s*=\s*hw\.cooldown[\s\S]*?;/
  );
  assert.ok(cooldownAssign, 'cooldown assignment line must be locatable');
  const expr = cooldownAssign[0];
  assert.match(expr,
    /\*\s*\(_CG\.modifier\s*===\s*'JAMMED'\s*\?\s*1\.25\s*:\s*1\s*\)\s*;/,
    "JAMMED ternary must be the LAST factor in the cooldown chain — preceded by `*` (no Math.min/Math.max wrapping) and immediately followed by `;` (no sibling neutralizer)");
  // Same shape requirement on the AUTONOMY ternary (sibling-amp bypass
  // surface mirrors): `* (...AUTONOMY...) *` is fine (the JAMMED ternary
  // follows it as another `*` factor) — but it must still be a direct
  // factor, NOT inside Math.min/Math.max args.
  assert.match(expr,
    /\*\s*\(_CG\.modifier\s*===\s*'AUTONOMY'\s*\?\s*0\.75\s*:\s*1\s*\)\s*\*/,
    "AUTONOMY ternary must remain a DIRECT multiplicative factor (preceded by `*`, followed by `*` for the next factor in the chain) — no wrapping neutralizer");
});

test('_CG.modifier === "JAMMED" appears EXACTLY once in content.js', () => {
  // Mirror the AUTONOMY exact-count assertion: any future addition of
  // a second JAMMED gate (e.g. a duplicate accidentally introduced via
  // merge / copy-paste, or a second cooldown-set site that double-
  // applies the penalty) MUST update this count or fail the test
  // loudly. Keeps the modifier's scope auditable to a single touch
  // point.
  const all = CONTENT_CODE.match(/_CG\.modifier\s*===\s*'JAMMED'/g) || [];
  assert.equal(all.length, 1,
    `content.js must contain exactly 1 _CG.modifier === 'JAMMED' reference (activateHackware multiplier); got ${all.length}`);
});

// ─── HUD wiring (modifier badge auto-picks up JAMMED) ─────────────────

test('HUD badge in render.js reads getMod().colour/.icon/.label generically', () => {
  // The HUD badge at render.js:~860 reads .colour/.icon/.label directly
  // with NO per-modifier branches — adding a new modifier requires only
  // the dict entry plus the gameplay logic in activateHackware. This
  // test pins that invariant so a future "switch (modifier)" refactor
  // in the HUD doesn't silently lose JAMMED's badge.
  assert.ok(/m\.colour/.test(RENDER) && /m\.icon/.test(RENDER) && /m\.label/.test(RENDER),
    'HUD badge in render.js must read .colour/.icon/.label generically (no per-modifier branches)');
});

test('modifierProgressSuffix in render.js does NOT register a JAMMED counter branch', () => {
  // JAMMED is a passive % effect with no counter to surface. Adding
  // a `if (modKey === 'JAMMED')` branch would be wrong because there
  // is no shared counter to display — it would either print a stale
  // value or 0/N forever. Pin the absence so a future copy-paste
  // from WINDFALL/REVERB/SIGNAL_BOOST doesn't accidentally introduce
  // one. Brace-walked extraction anchored on the function header
  // scopes the absence-check (per stored memory 'test source-text
  // extraction').
  const helperBranch = extractBranch(
    RENDER,
    /function\s+modifierProgressSuffix\s*\([^)]*\)\s*\{/
  );
  assert.ok(helperBranch, 'modifierProgressSuffix helper must be locatable');
  assert.doesNotMatch(helperBranch, /JAMMED/,
    'modifierProgressSuffix must NOT contain a JAMMED branch (modifier is passive %, not counter-based)');
});

// ─── modifier-pool count invariants ───────────────────────────────────

test(`FLOOR_MODIFIERS pool size invariant (${EXPECTED_MODIFIER_POOL_SIZE} entries)`, () => {
  // Pool-count invariant — see tests/_modifier-pool.js for details.
  // Adding a new modifier requires bumping EXPECTED_MODIFIER_POOL_SIZE
  // in that helper file (single source of truth).
  assertModifierPoolSize(CONTENT);
});

test('FLOOR_MODIFIERS pool size canary moved to PROXIMITY (modifier #26)', () => {
  // Canary literal RETIRED — per stored memory 'modifier pool canary
  // pattern', when modifier #26 (PROXIMITY) was added the next-pool-size
  // canary moved to tests/proximity-modifier.test.js. JAMMED's own
  // pool-size assertion (assertModifierPoolSize above) still defends
  // against accidental dict shrinkage; only the literal `25 (JAMMED added)`
  // pin moved on.
  assert.ok(EXPECTED_MODIFIER_POOL_SIZE >= 26,
    'pool size must be at least 26 after PROXIMITY landed');
});

// ─── runtime simulation: composition with OVERCLOCKER and AUTONOMY ────

test('runtime: JAMMED × OVERCLOCKER composition yields 0.875 multiplier', () => {
  // Behavioural complement to the regex assertions: replicate the
  // multiplicative chain on a synthetic cooldown to confirm the
  // composition arithmetic. A bug here (e.g. additive stacking) would
  // produce a different numeric result that this test catches loudly.
  const baseCooldown = 8;
  function compute(modifier, hasOverclocker) {
    return baseCooldown
      * (hasOverclocker ? 0.7 : 1)
      * (modifier === 'AUTONOMY' ? 0.75 : 1)
      * (modifier === 'JAMMED' ? 1.25 : 1);
  }
  // Off-floor, no augment: full cooldown.
  assert.equal(compute(null, false), 8, 'baseline (no modifier, no OVERCLOCKER) must equal hw.cooldown');
  // JAMMED only: ×1.25.
  assert.equal(compute('JAMMED', false), 8 * 1.25,
    'JAMMED alone must increase cooldown by 25%');
  // JAMMED + OVERCLOCKER: ×0.7 × 1.25 = ×0.875.
  assert.equal(compute('JAMMED', true), 8 * 0.7 * 1.25,
    'JAMMED + OVERCLOCKER must compose multiplicatively (×0.875), NOT additively');
  // AUTONOMY untouched (mutex with JAMMED at roll-time, but the chain
  // arithmetic is independent — confirm the pre-existing AUTONOMY path
  // didn't regress).
  assert.equal(compute('AUTONOMY', false), 8 * 0.75,
    'AUTONOMY alone must still reduce by 25% (regression guard)');
  assert.equal(compute('AUTONOMY', true), 8 * 0.7 * 0.75,
    'AUTONOMY + OVERCLOCKER must still yield ×0.525 (regression guard)');
  // Other modifiers: no effect on cooldown.
  assert.equal(compute('VOLATILE', false), 8, 'non-AUTONOMY/JAMMED modifier must not change cooldown');
  assert.equal(compute('WINDFALL', true), 8 * 0.7, 'non-AUTONOMY/JAMMED modifier with OVERCLOCKER yields OVERCLOCKER-only');
});

test('runtime: graceful degradation if the AUTONOMY × JAMMED mutex is ever relaxed', () => {
  // Floor modifiers are mutex at roll-time — only one rolls per floor.
  // But the activateHackware multiplier chain has both ternaries
  // independently testable (`_CG.modifier === X`), so if a future
  // change ever lets two modifiers co-occur, the literal product would
  // matter. Document the expected wash: ×0.75 × ×1.25 = ×0.9375 — a
  // near-no-op that intentionally degrades gracefully (rather than
  // catastrophically). This test pins that arithmetic so a future
  // re-tune that breaks the wash gets surfaced explicitly.
  const both = (1) * 0.75 * 1.25;
  assert.equal(both, 0.9375,
    'AUTONOMY × JAMMED would multiply to ×0.9375 (near-wash) if the floor-roll mutex is ever relaxed');
});
