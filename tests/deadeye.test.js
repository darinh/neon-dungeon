'use strict';
// DEADEYE perk — wiring + behaviour tests.
//
// DEADEYE is a stillness-gated offensive perk and the deliberate mirror
// of STRIDE: while the player's movement rate stays BELOW
// DEADEYE_MOVE_RATE for DEADEYE_CHARGE_TIME seconds, a readiness latch
// (_steadyReady) flips true; the next call to Player.shoot() multiplies
// the entire shot intent (ranged + melee + MULTI_SHOT bonus) by
// DEADEYE_DMG_MUL via the metaMul path, then clears the latch. Once
// charged, _steadyReady persists across movement so kite-then-snipe is a
// supported play pattern; only the cancel-partial branch clears the
// in-progress _steadyChargeTime.
//
// Source-text wiring tests (entities.js / content.js are browser-only —
// no UMD/CommonJS exports — same pattern as stride / shock-pulse /
// vaultmaster / magpie tests).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readSourceFile } = require('./_source-files.js');

const ENTITIES = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8');
const CONTENT  = readSourceFile(__dirname, 'content') + '\n' + readSourceFile(__dirname, 'contentStatus');
const CONTENT_PERKS = readSourceFile(__dirname, 'contentPerks');
const GAME     = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'game.js'),     'utf8');
const SAVE     = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'meta', 'save.js'), 'utf8');
const SW       = fs.readFileSync(path.resolve(__dirname, '..', 'sw.js'),              'utf8');

// Strip /* … */ and // … comments from a source span so executable
// gates can't be satisfied by comment text alone (per stored "test
// regex pitfalls" rule).
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

// Canonical brace-walked branch extractor (mirrors execute-affix.test.js,
// recoil-affix.test.js, mark-affix.test.js, hackware.test.js). Required
// for absence-checks (`assert.doesNotMatch`) inside any branch that may
// later contain nested `{...}` (an `if (x) { y; }`, an inline object
// literal, etc.). A naive `else\s*\{[^}]*FORBIDDEN[^}]*\}` would FALSE-PASS
// on `else { if (x) { y; } FORBIDDEN; }` because `[^}]*` cannot span the
// inner block — the regex never matches and the absence assertion silently
// holds. The brace walker isolates exactly one branch by counting depth.
//
// LIMITATION: naive depth counter — does NOT understand string/template/
// regex literals. A `'{KO}'` inside the branch would drift the count and
// `extractBranch` would return null, caught loudly by the
// `assert.ok(branch, …)` guard at every call site.
/**
 * @param {string} src
 * @param {RegExp} openerRe
 */
function extractBranch(src, openerRe) {
  const i = src.search(openerRe);
  if (i < 0) return null;
  const open = src.indexOf('{', i);
  if (open < 0) return null;
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    const ch = src[j];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(i, j + 1);
    }
  }
  return null;
}

// ─── PERK_POOL entry ──────────────────────────────────────────────────────

test('DEADEYE is registered in PERK_POOL with name/icon/desc/colour', () => {
  const pool = CONTENT_PERKS.match(/const\s+PERK_POOL\s*=\s*\{[\s\S]*?\n\};/);
  assert.ok(pool, 'PERK_POOL block must be locatable in content/perks.js');
  assert.match(pool[0], /DEADEYE\s*:\s*\{[^}]*name\s*:\s*['"]Deadeye['"]/,
    'PERK_POOL.DEADEYE must declare name "Deadeye"');
  assert.match(pool[0], /DEADEYE\s*:\s*\{[^}]*icon\s*:/,
    'PERK_POOL.DEADEYE must declare an icon');
  assert.match(pool[0], /DEADEYE\s*:\s*\{[^}]*desc\s*:/,
    'PERK_POOL.DEADEYE must declare a desc');
  assert.match(pool[0], /DEADEYE\s*:\s*\{[^}]*colour\s*:/,
    'PERK_POOL.DEADEYE must declare a colour');
});

// ─── Tunable constants ────────────────────────────────────────────────────

test('DEADEYE constants live in entities.js with sane bounds', () => {
  const r = ENTITIES.match(/DEADEYE_MOVE_RATE\s*=\s*([\d.]+)/);
  const c = ENTITIES.match(/DEADEYE_CHARGE_TIME\s*=\s*([\d.]+)/);
  const d = ENTITIES.match(/DEADEYE_DMG_MUL\s*=\s*([\d.]+)/);
  assert.ok(r && c && d,
    'DEADEYE_MOVE_RATE / _CHARGE_TIME / _DMG_MUL constants must all be declared');
  const rate = parseFloat(r[1]);
  const charge = parseFloat(c[1]);
  const mul = parseFloat(d[1]);
  // Must be a tiles/sec rate (per stored "stillness/rate trackers"
  // rule). Values < 0.1 would be approaching tiles/frame; > 2.0 would
  // count slow drift as "still".
  assert.ok(rate >= 0.1 && rate <= 2.0,
    `DEADEYE_MOVE_RATE must be a tiles/sec rate in [0.1, 2.0], got ${rate}`);
  assert.ok(charge > 0 && charge <= 5.0,
    `DEADEYE_CHARGE_TIME should be in (0, 5] s, got ${charge}`);
  assert.ok(mul > 1 && mul <= 3,
    `DEADEYE_DMG_MUL should be in (1, 3], got ${mul}`);
});

// ─── Player class fields & constructor init ───────────────────────────────

test('Player declares _steady* runtime fields', () => {
  const decl = ENTITIES.match(/class\s+Player\s*\{[\s\S]*?\n\s{2}constructor/);
  assert.ok(decl, 'Player class declaration block must be locatable');
  assert.match(decl[0], /_steadyChargeTime/, 'Player must declare _steadyChargeTime field');
  assert.match(decl[0], /_steadyReady/,      'Player must declare _steadyReady field');
});

test('Player constructor initialises _steady* state', () => {
  assert.match(ENTITIES, /this\._steadyChargeTime\s*=\s*0\s*;/,
    'constructor must init this._steadyChargeTime = 0');
  assert.match(ENTITIES, /this\._steadyReady\s*=\s*false\s*;/,
    'constructor must init this._steadyReady = false');
});

// ─── shoot() consume wiring ───────────────────────────────────────────────

test('shoot() applies DEADEYE_DMG_MUL via metaMul and consumes the latch', () => {
  // Locate the shoot method body precisely.
  const m = ENTITIES.match(/shoot\s*\([^)]*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(m, 'shoot method body must be locatable');
  const stripped = stripComments(m[0]);
  // The gate must be on this.perks.DEADEYE && this._steadyReady (both
  // perk ownership AND latch). A bare `_steadyReady` check would fire
  // for non-owners (the latch is never set without the perk, but
  // defence-in-depth catches a future bug where another mechanic flips
  // the flag).
  assert.match(stripped, /this\.perks\.DEADEYE\s*&&\s*this\._steadyReady/,
    'shoot() must gate on perks.DEADEYE && _steadyReady');
  assert.match(stripped, /DEADEYE_DMG_MUL/,
    'shoot() must scale by DEADEYE_DMG_MUL (no magic numbers)');
  // Latch must be cleared on consume — otherwise the buff would apply
  // to every subsequent shot until the player walks.
  assert.match(stripped, /this\._steadyReady\s*=\s*false/,
    'shoot() must clear _steadyReady after consuming the buff');
});

test('shoot() folds the deadeye multiplier through metaMul (covers melee + MULTI_SHOT bonus uniformly)', () => {
  const m = ENTITIES.match(/shoot\s*\([^)]*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(m, 'shoot method body must be locatable');
  const stripped = stripComments(m[0]);
  // The multiplier must be folded into a single combined value used by
  // every damage path inside shoot() — otherwise melee attacks or the
  // MULTI_SHOT bonus would silently miss the buff. The `finalMetaMul`
  // identifier is the conventional vehicle.
  assert.match(stripped, /finalMetaMul\s*=\s*metaMul\s*\*\s*deadeyeMul/,
    'shoot() must compose deadeyeMul into a finalMetaMul that downstream paths use');
  // Every dmg-formula site downstream must consume finalMetaMul (not
  // raw metaMul) — three known sites: melee, primary projectile loop,
  // MULTI_SHOT bonus.
  const finalRefs = (stripped.match(/finalMetaMul/g) || []).length;
  assert.ok(finalRefs >= 4,
    `shoot() must reference finalMetaMul at the dmg-formula sites (melee, primary, multi-shot); found ${finalRefs} refs (expected ≥ 4: 1 declaration + 3 uses)`);
  // No stray bare-metaMul damage-formula site should remain inside
  // shoot() — that would silently skip the deadeye bonus.
  assert.doesNotMatch(stripped, /\)\s*\*\s*metaMul\b/,
    'shoot() must not leave any "* metaMul" damage formula — they should all be "* finalMetaMul" so DEADEYE applies');
});

// ─── Tick wiring in Player.update ────────────────────────────────────────

test('Player.update ticks DEADEYE using moved/dt rate (frame-rate independent)', () => {
  const tickRe = /\[tick:DEADEYE\][\s\S]*?\n\s{4}\}/;
  const m = ENTITIES.match(tickRe);
  assert.ok(m, 'DEADEYE tick block must exist in Player.update');
  const stripped = stripComments(m[0]);
  assert.match(stripped, /dist\s*\(\s*this\._prevX\s*,\s*this\._prevY\s*,\s*this\.x\s*,\s*this\.y\s*\)/,
    'DEADEYE tick must read post-movement displacement via dist(_prevX,_prevY,x,y)');
  assert.match(stripped, /\/\s*dt/,
    'DEADEYE tick must divide moved by dt to get a tiles/sec rate (frame-rate independent)');
  assert.match(stripped, /DEADEYE_MOVE_RATE/,
    'DEADEYE tick must gate on DEADEYE_MOVE_RATE (no magic numbers)');
  assert.match(stripped, /DEADEYE_CHARGE_TIME/,
    'DEADEYE tick must compare _steadyChargeTime against DEADEYE_CHARGE_TIME');
});

test('DEADEYE tick is gated on this.perks.DEADEYE (no overhead for non-owners)', () => {
  const tickRe = /\[tick:DEADEYE\][\s\S]*?\n\s{4}\}/;
  const m = ENTITIES.match(tickRe);
  assert.ok(m, 'DEADEYE tick block must exist');
  const stripped = stripComments(m[0]);
  assert.match(stripped, /this\.perks\.DEADEYE/,
    'DEADEYE tick must short-circuit when the player has not picked the perk');
});

test('DEADEYE tick is suppressed during shock (force-zeroed movement should not grant a free charge)', () => {
  const tickRe = /\[tick:DEADEYE\][\s\S]*?\n\s{4}\}/;
  const m = ENTITIES.match(tickRe);
  assert.ok(m, 'DEADEYE tick block must exist');
  const stripped = stripComments(m[0]);
  assert.match(stripped, /shockTimer/,
    'DEADEYE tick must reference shockTimer (defensive: explicit "no charge while shocked")');
});

test('DEADEYE moving branch cancels partial charge but does NOT clear an existing readiness latch', () => {
  const tickRe = /\[tick:DEADEYE\][\s\S]*?\n\s{4}\}/;
  const m = ENTITIES.match(tickRe);
  assert.ok(m, 'DEADEYE tick block must exist');
  const stripped = stripComments(m[0]);
  // The `else` (moving) branch must zero _steadyChargeTime so a brief
  // pause buffered by accumulated time can't re-grant a free charge on
  // the very next still frame (the same defence STRIDE has).
  assert.match(stripped, /else\s*\{\s*this\._steadyChargeTime\s*=\s*0\s*;?\s*\}/,
    'DEADEYE tick moving branch must reset _steadyChargeTime to 0');
  // The moving branch must NOT clear _steadyReady — kite-then-snipe is
  // a supported play pattern and the latch persists once set.
  //
  // Anchor on the SPECIFIC controlling if: `if (rateD < DEADEYE_MOVE_RATE
  // && this.shockTimer <= 0) { ... } else { ... }`. Walk past the still
  // branch, then brace-walk the matching else. A naive
  // `assert.doesNotMatch(stripped, /else\s*\{[^}]*FORBIDDEN[^}]*\}/)`
  // FALSE-PASSES if FORBIDDEN sits after an inner `{...}` (the KEEN
  // affix audit failure class). Searching for the first generic
  // `} else {` is also unsafe — a future refactor that adds an inner
  // else (e.g. inside `if (!this._steadyReady)`) would mis-target.
  // Pinning on the FULL controlling condition (both rateD AND shockTimer
  // predicates, in either order) is robust to all three classes — and
  // also forces the anchor to track the design contract that DEADEYE
  // must NOT charge while shocked (asserted independently in test #9).
  // We allow the two predicates in either order so a `&&` reorder
  // doesn't break the test gratuitously.
  const stillIfReA =
    /if\s*\(\s*rateD\s*<\s*DEADEYE_MOVE_RATE\s*&&\s*this\.shockTimer\s*<=\s*0\s*\)\s*\{/g;
  const stillIfReB =
    /if\s*\(\s*this\.shockTimer\s*<=\s*0\s*&&\s*rateD\s*<\s*DEADEYE_MOVE_RATE\s*\)\s*\{/g;
  const matchesA = stripped.match(stillIfReA) || [];
  const matchesB = stripped.match(stillIfReB) || [];
  const totalControllers = matchesA.length + matchesB.length;
  // Require the controlling if to be UNIQUE in the DEADEYE tick. A
  // duplicate would itself be a bug (dead code or inadvertent re-entry)
  // AND would let an absence-check on the wrong copy's else false-pass.
  // Failing loudly here is preferable to silently picking the first.
  assert.equal(totalControllers, 1,
    `DEADEYE controlling if must appear exactly once in the tick block (found ${totalControllers}). ` +
    'Either the if is missing entirely (regression) or duplicated (would let the moving-branch absence check target the wrong copy).');
  let stillStart = stripped.search(stillIfReA);
  if (stillStart < 0) stillStart = stripped.search(stillIfReB);
  assert.ok(stillStart >= 0,
    'DEADEYE controlling if (rateD < DEADEYE_MOVE_RATE && this.shockTimer <= 0) must be locatable — both predicates required so an unrelated `if (rateD < DEADEYE_MOVE_RATE)` elsewhere cannot mis-target the moving-branch absence check');
  const stillOpen = stripped.indexOf('{', stillStart);
  let depth = 0;
  let stillEnd = -1;
  for (let j = stillOpen; j < stripped.length; j++) {
    if (stripped[j] === '{') depth++;
    else if (stripped[j] === '}') {
      depth--;
      if (depth === 0) { stillEnd = j; break; }
    }
  }
  assert.ok(stillEnd > 0, 'controlling if body must brace-balance');
  const afterStill = stripped.slice(stillEnd + 1);
  const elseMatch = afterStill.match(/^\s*else\s*\{/);
  assert.ok(elseMatch,
    'controlling if must be paired with `else {` (no intervening else-if)');
  const elseBranch = extractBranch(afterStill, /else\s*\{/);
  assert.ok(elseBranch,
    'DEADEYE moving branch (paired `else {…}`) must be locatable');
  assert.doesNotMatch(elseBranch, /this\._steadyReady\s*=\s*false/,
    'DEADEYE tick moving branch must NOT clear _steadyReady (kite-then-snipe is intentional)');
});

test('DEADEYE charge does not over-tick once latched (re-charging gated on !_steadyReady)', () => {
  const tickRe = /\[tick:DEADEYE\][\s\S]*?\n\s{4}\}/;
  const m = ENTITIES.match(tickRe);
  assert.ok(m, 'DEADEYE tick block must exist');
  const stripped = stripComments(m[0]);
  // Once _steadyReady is true, _steadyChargeTime should not keep
  // incrementing — otherwise a long camp would push it to absurd
  // values that take a full second to re-cancel after movement starts.
  // The conventional gate is `if (!this._steadyReady)`.
  assert.match(stripped, /if\s*\(\s*!\s*this\._steadyReady\s*\)/,
    'DEADEYE tick must gate _steadyChargeTime accumulation on !_steadyReady (no over-tick once latched)');
});

// ─── HUD chip wiring ──────────────────────────────────────────────────────

test('HUD computeStatusFx pushes a deadeye chip when _steadyReady', () => {
  const stripped = stripComments(CONTENT);
  assert.match(stripped, /id:\s*['"]deadeye['"]/,
    'HUD chip must use id "deadeye"');
  assert.match(stripped, /label:\s*['"]AIM['"]/,
    'HUD chip label must surface as "AIM"');
  assert.match(stripped, /player\.perks\.DEADEYE\s*&&\s*player\._steadyReady/,
    'HUD chip must gate on perks.DEADEYE && _steadyReady');
});

// ─── Floor transition: DEADEYE state must reset ──────────────────────────

test('loadFloor() resets _steady* state (no warp-into-new-floor latch leak)', () => {
  const m = GAME.match(/loadFloor\s*\([^)]*\)\s*\{[\s\S]*?(?:\n\s{2}\}|\n\}\s*\n)/);
  assert.ok(m, 'loadFloor method body must be locatable in game.js');
  const stripped = stripComments(m[0]);
  assert.match(stripped, /this\.player\._steadyChargeTime\s*=\s*0/,
    'loadFloor must reset player._steadyChargeTime to 0 on floor transition');
  assert.match(stripped, /this\.player\._steadyReady\s*=\s*false/,
    'loadFloor must reset player._steadyReady to false on floor transition');
});

// ─── Save/load: DEADEYE state is runtime-only ─────────────────────────────

test('DEADEYE state is NOT serialized in save snapshots (runtime-only)', () => {
  // Mirrors STRIDE / HUNTER / momentum convention: transient charge
  // state should not survive a save/load round-trip — picking up where
  // you left off shouldn't gift you a stale AIM latch.
  assert.doesNotMatch(SAVE, /_steadyChargeTime/,
    'save.js must not serialize _steadyChargeTime (runtime-only state)');
  assert.doesNotMatch(SAVE, /_steadyReady/,
    'save.js must not serialize _steadyReady (runtime-only state)');
});

// ─── Service worker cache freshness ───────────────────────────────────────

test('sw.js cache freshness is not a numeric cache key', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /const\s+CACHE\s*=\s*'neon-dungeon-assets'/);
});
