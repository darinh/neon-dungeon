'use strict';
// SIPHON 'of Siphoning' weapon-affix suffix — source-text wiring tests.
//
// SIPHON is the first per-HIT credit affix (GREEDY/SALVAGE/LUCKY are all
// on-kill). It routes through applyHitEffects in src/entities.js via the
// shared `ctx.effects.includes('siphon')` switch, accumulating a
// counter on the player object and granting +1 credit every 3rd hit.
//
// content.js / entities.js are browser-only (no UMD/CommonJS exports), so
// we can't load applyHitEffects directly under node:test. Instead, these
// tests assert the structural invariants any working SIPHON suffix must
// satisfy: registry shape (slot/effect keyword), the on-hit gate
// (effects.includes('siphon')), the threshold-3 trigger, the +1 credit
// grant + reset, and the gold-text feedback.
//
// Each check fails loudly the moment a refactor drops a wire — same
// silent-removal failure mode that bit GREEDY / LUCKY / SALVAGE reviews.

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

// Strip /* ... */ and // ... comments so source-text regex assertions
// match against EXECUTABLE source, not commentary that incidentally
// quotes the gate token. Pattern from tests/{greedy,lucky,salvage,
// mark,deadly}-affix.test.js (per stored memory 'test regex pitfalls').
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const ENTITIES_CODE = stripComments(ENTITIES);

test('SIPHON is registered in WEAPON_AFFIXES as a suffix with effect:siphon', () => {
  // slot:'suffix' is critical — slot routes the affix through the on-hit
  // / on-kill effect path. A typo to 'prefix' would silently route into
  // the mod-loop in buildWeapon() and never reach the on-hit gate.
  // effect:'siphon' is the keyword applyHitEffects switches on; if it
  // diverges from the gate string the suffix becomes a cosmetic no-op.
  const re = /SIPHON:\s*\{\s*slot:\s*'suffix'\s*,\s*label:\s*'[^']+'\s*,\s*colour:\s*'#[0-9a-fA-F]+'\s*,\s*desc:\s*'[^']+'\s*,\s*effect:\s*'siphon'\s*\}/;
  assert.match(CONTENT, re,
    "SIPHON must be a suffix with label/colour/desc and effect:'siphon'");
});

test('applyHitEffects has a siphon branch gated on eff === "siphon"', () => {
  // SIPHON is on-HIT (not on-kill like GREEDY/LUCKY/SALVAGE), so the
  // gate lives in applyHitEffects, not Enemy.die(). The branch must
  // match the per-eff pattern used by every other on-hit suffix
  // (burn/slow/leech/chain/shock/recoil/execute/mark) so the loop
  // dispatches into it. A literal string match would pass on a
  // comment that quotes 'siphon' — strip comments first.
  assert.match(ENTITIES_CODE, /eff\s*===\s*'siphon'/,
    "applyHitEffects must have an `eff === 'siphon'` branch");
});

test('SIPHON branch lives inside applyHitEffects (not applyOnKill)', () => {
  // Per-hit affixes route through applyHitEffects. If a future refactor
  // accidentally moves the branch into applyOnKill, the counter would
  // only tick on KILLS — defeating the whole "drip from sustained DPS"
  // design. Anchor by checking the siphon gate appears BETWEEN the
  // applyHitEffects function declaration and the applyOnKill function
  // declaration.
  const fxIdx = ENTITIES_CODE.indexOf('function applyHitEffects(');
  const okIdx = ENTITIES_CODE.indexOf('function applyOnKill(');
  const sipIdx = ENTITIES_CODE.indexOf("eff === 'siphon'");
  assert.ok(fxIdx !== -1, 'applyHitEffects function must exist');
  assert.ok(okIdx !== -1, 'applyOnKill function must exist');
  assert.ok(sipIdx !== -1, 'siphon branch must exist');
  assert.ok(sipIdx > fxIdx && sipIdx < okIdx,
    'SIPHON branch must live inside applyHitEffects, not applyOnKill');
});

test('SIPHON increments _siphonHits counter on the player', () => {
  // The counter must accumulate on the PLAYER (not per-enemy) so it
  // ticks across enemies and weapon swaps within a run. Per-enemy
  // counters (e.g. on `enemy._siphonHits`) would reset every kill and
  // make the +1 trigger unreachable on single-shot mobs. Anchor the
  // assertion inside the siphon branch via brace-walked extraction so
  // the regex can't drift into a neighbouring branch.
  const sipIdx = ENTITIES_CODE.indexOf("eff === 'siphon'");
  assert.ok(sipIdx !== -1, 'siphon branch must exist');
  // Walk braces from siphon match's opening '{' to its matching close.
  const openIdx = ENTITIES_CODE.indexOf('{', sipIdx);
  assert.ok(openIdx !== -1, 'siphon branch must have an opening brace');
  let depth = 0, end = -1;
  for (let i = openIdx; i < ENTITIES_CODE.length; i++) {
    const c = ENTITIES_CODE[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  assert.ok(end > openIdx, 'siphon branch must have a matching close brace');
  const branch = ENTITIES_CODE.slice(openIdx, end + 1);
  // _siphonHits must be incremented from a player-bound reference.
  // Match `<ident>._siphonHits = (<ident>._siphonHits || 0) + 1` to lock
  // both the field name and the safe nucleation pattern.
  const incMatch = branch.match(/(\w+)\._siphonHits\s*=\s*\(\s*(\w+)\._siphonHits\s*\|\|\s*0\s*\)\s*\+\s*1/);
  assert.ok(incMatch, 'SIPHON must increment <ident>._siphonHits with `|| 0` nucleation');
  assert.strictEqual(incMatch[1], incMatch[2],
    'increment LHS and RHS must reference the same binding (no cross-binding leaks)');
  // Critical: the binding must also hold `.credits` (player-only field
  // — see grep across entities.js: every `.credits` access is on
  // `_EG.player` or a local alias). This pins the binding to the
  // PLAYER, not an enemy or other entity. A per-enemy counter mutation
  // (e.g. `enemy._siphonHits`) would set _siphonHits on the enemy but
  // grant credit on the player — the binding mismatch is exactly the
  // bug to catch.
  const ident = incMatch[1];
  // Escape regex special chars in the identifier (defensive — should
  // already be word-chars-only, but cheap).
  const identRe = new RegExp(`\\b${ident.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.credits\\s*\\+=\\s*1\\b`);
  assert.match(branch, identRe,
    `SIPHON must grant the credit on the SAME binding as _siphonHits (got ${ident}) — confirms it's the player`);
});

test('SIPHON triggers at threshold 3 (every 3rd hit grants +1 credit)', () => {
  // The threshold is the entire balance lever. Bumping to 2 makes
  // SIPHON nearly double GREEDY for shotguns; bumping to 5+ makes it
  // feel inert. Pin the value so an unintentional re-tune is caught.
  const sipIdx = ENTITIES_CODE.indexOf("eff === 'siphon'");
  assert.ok(sipIdx !== -1, 'siphon branch must exist');
  const openIdx = ENTITIES_CODE.indexOf('{', sipIdx);
  let depth = 0, end = -1;
  for (let i = openIdx; i < ENTITIES_CODE.length; i++) {
    const c = ENTITIES_CODE[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  const branch = ENTITIES_CODE.slice(openIdx, end + 1);
  assert.match(branch, /_siphonHits\s*>=\s*3/,
    'SIPHON must trigger when _siphonHits >= 3');
});

test('SIPHON resets the counter and grants +1 credit on trigger', () => {
  // After firing, the counter MUST reset to 0 — without the reset,
  // every subsequent hit would re-trigger (counter stays at 3+),
  // making SIPHON grant +1 credit per hit (3× the design value).
  // The credit grant is the entire point — without `+= 1` the suffix
  // is a cosmetic no-op.
  const sipIdx = ENTITIES_CODE.indexOf("eff === 'siphon'");
  assert.ok(sipIdx !== -1, 'siphon branch must exist');
  const openIdx = ENTITIES_CODE.indexOf('{', sipIdx);
  let depth = 0, end = -1;
  for (let i = openIdx; i < ENTITIES_CODE.length; i++) {
    const c = ENTITIES_CODE[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  const branch = ENTITIES_CODE.slice(openIdx, end + 1);
  assert.match(branch, /_siphonHits\s*=\s*0/,
    'SIPHON must reset _siphonHits to 0 on trigger');
  assert.match(branch, /\.credits\s*\+=\s*1\b/,
    'SIPHON must grant +1 credit on trigger');
});

test('SIPHON emits a "+1 CR" floating text in green for player feedback', () => {
  // Per-hit credit drip is small enough that without floating-text
  // feedback the player won't notice it firing in a busy frame. Green
  // (#88ff88) distinguishes it from GREEDY's gold (#ffd700) so a
  // weapon with both equipped shows two distinct credit-source colours.
  const sipIdx = ENTITIES_CODE.indexOf("eff === 'siphon'");
  assert.ok(sipIdx !== -1, 'siphon branch must exist');
  const openIdx = ENTITIES_CODE.indexOf('{', sipIdx);
  let depth = 0, end = -1;
  for (let i = openIdx; i < ENTITIES_CODE.length; i++) {
    const c = ENTITIES_CODE[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  const branch = ENTITIES_CODE.slice(openIdx, end + 1);
  assert.match(branch, /spawnDmgText\([^)]*'\+1 CR'[^)]*'#88ff88'/,
    'SIPHON must emit a "+1 CR" floating text in green (#88ff88)');
});

test('SIPHON null-guards on _EG.player (defense in depth)', () => {
  // applyHitEffects is invoked only from takeDamage, which is itself
  // only called when there's a player firing — so _EG.player should
  // always be defined. But the guard is cheap (no-op when player
  // exists) and defends against any future test harness or replay
  // path that drives takeDamage with no live player. Pattern matches
  // the `if (_EG.player) { ... }` guard in the LEECH branch.
  const sipIdx = ENTITIES_CODE.indexOf("eff === 'siphon'");
  assert.ok(sipIdx !== -1, 'siphon branch must exist');
  const openIdx = ENTITIES_CODE.indexOf('{', sipIdx);
  let depth = 0, end = -1;
  for (let i = openIdx; i < ENTITIES_CODE.length; i++) {
    const c = ENTITIES_CODE[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  const branch = ENTITIES_CODE.slice(openIdx, end + 1);
  // The branch must reference _EG.player (so it's player-scoped) AND
  // have a null-guard that bails early (`continue`) or wraps the
  // sensitive ops (`if (_EG.player)`). Either pattern is acceptable:
  //   (a) const x = _EG.player; if (!x) continue;
  //   (b) if (!_EG.player) continue;
  //   (c) if (_EG.player) { ... }
  // All three guarantee no dereference on null.
  assert.match(branch, /_EG\.player/,
    'SIPHON branch must reference _EG.player (player-scoped state)');
  const hasGuard = /if\s*\(\s*!\s*\w+\s*\)\s*continue/.test(branch)
    || /if\s*\(\s*!\s*_EG\.player\s*\)\s*continue/.test(branch)
    || /if\s*\(\s*_EG\.player\s*\)/.test(branch);
  assert.ok(hasGuard,
    'SIPHON branch must null-guard against missing _EG.player (early continue or if-wrap)');
});

test('SIPHON proc-isolation comes for free via applyHitEffects gate', () => {
  // applyHitEffects is invoked at entities.js ~1781 with
  // `if (!ctx.isProc) applyHitEffects(...)`. So procs (THUNDER chain
  // with isProc:true, RICOCHET with isProc:true) NEVER reach the
  // siphon branch — they bypass applyHitEffects entirely. This test
  // pins that gate so a refactor that hoists applyHitEffects into the
  // unconditional path doesn't silently make procs tick the counter.
  // Pattern: `if (!<ident>.isProc) applyHitEffects(`.
  assert.match(ENTITIES_CODE, /if\s*\(\s*!\s*\w+\.isProc\s*\)\s*applyHitEffects\(/,
    'applyHitEffects must remain gated behind !ctx.isProc so procs do not tick the SIPHON counter');
});

test('SIPHON does not appear in applyOnKill (per-hit, not per-kill)', () => {
  // GREEDY/SALVAGE/LUCKY all live in Enemy.die() AFTER the base credit
  // award. SIPHON must NOT appear there — accidentally adding a
  // duplicate on-kill branch would double-credit (once per hit + once
  // on the killing-blow hit). Anchor by isolating the function body
  // of applyOnKill via brace walking and asserting absence.
  const okIdx = ENTITIES_CODE.indexOf('function applyOnKill(');
  assert.ok(okIdx !== -1, 'applyOnKill function must exist');
  const openIdx = ENTITIES_CODE.indexOf('{', okIdx);
  let depth = 0, end = -1;
  for (let i = openIdx; i < ENTITIES_CODE.length; i++) {
    const c = ENTITIES_CODE[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  assert.ok(end > openIdx, 'applyOnKill must have a matching close brace');
  const body = ENTITIES_CODE.slice(openIdx, end + 1);
  assert.ok(!/['"]siphon['"]/.test(body),
    "SIPHON must NOT appear in applyOnKill (it is per-HIT, not per-kill)");
  assert.ok(!/_siphonHits/.test(body),
    "_siphonHits must NOT be referenced in applyOnKill (per-HIT only)");
});

test('SIPHON colour (#88ff88) is distinct from GREEDY gold (#ffd700)', () => {
  // Both are credit-related affixes; using the same colour would
  // visually conflate them on a weapon with both equipped. Pin the
  // SIPHON colour and assert it differs from GREEDY's gold so a
  // future tune that picks gold for SIPHON gets caught here.
  const sipMatch = CONTENT.match(/SIPHON:\s*\{[^}]*colour:\s*'(#[0-9a-fA-F]+)'/);
  const grdMatch = CONTENT.match(/GREEDY:\s*\{[^}]*colour:\s*'(#[0-9a-fA-F]+)'/);
  assert.ok(sipMatch, 'SIPHON registry entry must have a colour field');
  assert.ok(grdMatch, 'GREEDY registry entry must have a colour field');
  assert.notStrictEqual(sipMatch[1].toLowerCase(), grdMatch[1].toLowerCase(),
    'SIPHON colour must differ from GREEDY (both grant credits — visually distinct)');
});
