'use strict';
// PREDATOR elite affix — source-text wiring tests.
//
// PREDATOR is the 7th entry in ELITE_AFFIXES (the smallest content
// registry — 6 affixes had been the steady-state: SHIELDED, BERSERKER,
// REGENERATING, PHASING, VOLATILE, FRENZY). The design space is
// "reactive aggression triggered by the PLAYER taking damage" — a
// clean orthogonal niche to:
//   - BERSERKER: scales with own missing HP (passive, gradual)
//   - FRENZY:    discrete stacks on nearby ALLY death (event-driven,
//                escalating, max 2 stacks)
// PREDATOR fires when the player takes real HP damage (`actual > 0`)
// within 8 tiles, granting a 3-second refresh-only +30% speed/CD buff
// via berserkerMul(). Refresh-only means re-triggering during an
// active window resets the timer rather than stacking — DoT ticks
// (burn/toxic/arc/disruption) keep the buff alive without spamming
// the audio cue (gated on the leading edge `wasInactive` flag inside
// notifyPredatorElites).
//
// The +30% multiplier is mid-range between BERSERKER's max (1.5 at 0
// HP) and FRENZY's first stack (1.4) — intentional. PREDATOR's value
// isn't peak strength but reactive uptime: it punishes the player
// for mistakes (hazard tile damage, DoT ticks, bad positioning)
// rather than escalating with the fight. The 8-tile range is double
// FRENZY's 4-tile death-radius because the trigger fires at most
// once per real-damage event (vs FRENZY's once per kill) and the
// elite needs enough reach to be a meaningful threat at the moment
// the player took the hit.
//
// content.js / entities.js are browser-only (no UMD/CommonJS exports),
// so we can't load Player.takeDamage() / notifyPredatorElites() under
// node:test. Instead, these tests assert the structural invariants
// any working PREDATOR must satisfy: catalog entry, helper function,
// damage-path hook, tick decay, berserkerMul branch, render branch,
// audio binding, player-state init, AND the FIRST ELITE_AFFIX_KEYS
// pool-size canary (=7).
//
// All regex assertions run against COMMENT-STRIPPED source. The
// PREDATOR wiring is heavily documented (the design intent is
// explicit), so a future edit could land a comment that satisfies a
// presence regex even after the executable code was removed. Stripping
// comments first closes that hole and matches the SHIELD_BUBBLE /
// DATA_SPIKE / REPAIR_PROTOCOL test pattern.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content', 'weapons.js'), 'utf8'
);
const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);
const PLATFORM = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'platform.js'), 'utf8'
);

/** @param {string} src */
function stripComments(src) {
  // Strip block comments first, then FULL-LINE // comments only
  // (matches the project convention — see stored memory
  // 'structural test bypass classes' on the over-stripping bug).
  return src.replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/^\s*\/\/[^\n]*$/gm, '');
}

const CONTENT_NC = stripComments(CONTENT);
const ENTITIES_NC = stripComments(ENTITIES);
const PLATFORM_NC = stripComments(PLATFORM);

// Brace-balanced extraction of the FIRST block opened by openerRe in
// src. Lifted from tests/shield-bubble-hackware.test.js — same naive
// depth counter, same string-literal limitation, same bypass-resistance
// guarantee at every call site (assert.ok on null result). Used over
// non-greedy `[\s\S]*?\}\s*\n` regex extraction because non-greedy
// extraction false-matches past `} else if` chains (see stored memory
// 'structural test bypass classes' on the brittle non-greedy pattern).
/**
 * @param {string} src
 * @param {RegExp} openerRe
 */
function extractBlock(src, openerRe) {
  const i = src.search(openerRe);
  if (i < 0) return null;
  const open = src.indexOf('{', i);
  if (open < 0) return null;
  let depth = 1;
  let j = open + 1;
  while (j < src.length && depth > 0) {
    const ch = src[j];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    j++;
  }
  if (depth !== 0) return null;
  return src.slice(i, j);
}

// ─── Catalog entry ────────────────────────────────────────────────────────

test('PREDATOR is registered in ELITE_AFFIXES with required fields', () => {
  const re = /PREDATOR\s*:\s*\{[^}]*label\s*:\s*'Predator'[^}]*colour\s*:\s*'#[0-9a-fA-F]{6}'[^}]*desc\s*:\s*'[^']+'[^}]*icon\s*:\s*'[^']+'/;
  assert.ok(re.test(CONTENT_NC),
    'ELITE_AFFIXES.PREDATOR must declare label, colour (#hex), desc, and icon');
});

test('PREDATOR colour is perceptually distinct from every other elite affix', () => {
  // Sum-of-channel distance threshold 96 = at least 32-per-channel
  // average. Catches a future edit that flips PREDATOR to e.g.
  // FRENZY's #ff4466 (the closest red-family neighbour). Mirrors the
  // colour-distance pin in tests/shield-bubble-hackware.test.js.
  // Scoped to the ELITE_AFFIXES block so WEAPON_AFFIXES entries
  // (which share the same field shape) don't false-match.
  const block = extractBlock(CONTENT_NC, /const\s+ELITE_AFFIXES\s*=\s*\{/);
  assert.ok(block, 'ELITE_AFFIXES const block must be locatable');
  const colourRe = /([A-Z_]+)\s*:\s*\{[^}]*colour\s*:\s*'#([0-9a-fA-F]{6})'/g;
  const colours = {};
  let m;
  while ((m = colourRe.exec(block)) !== null) colours[m[1]] = m[2];
  assert.ok(colours.PREDATOR, 'PREDATOR colour must be parseable from ELITE_AFFIXES');
  /** @param {string} hex */
  const rgb = (hex) => [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
  const [pr, pg, pb] = rgb(colours.PREDATOR);
  for (const [k, hex] of Object.entries(colours)) {
    if (k === 'PREDATOR') continue;
    const [r, g, b] = rgb(hex);
    const d = Math.abs(r-pr) + Math.abs(g-pg) + Math.abs(b-pb);
    assert.ok(d >= 96,
      `PREDATOR colour #${colours.PREDATOR} too close to ELITE_AFFIX ${k} #${hex} (dist=${d}, need >= 96)`);
  }
});

test('PREDATOR icon is distinct from every other elite affix icon', () => {
  // Scoped to the ELITE_AFFIXES block so WEAPON_AFFIXES / HACKWARE
  // entries (which share the same field shape) don't false-match.
  const block = extractBlock(CONTENT_NC, /const\s+ELITE_AFFIXES\s*=\s*\{/);
  assert.ok(block, 'ELITE_AFFIXES const block must be locatable');
  const iconRe = /([A-Z_]+)\s*:\s*\{[^}]*icon\s*:\s*'([^']+)'/g;
  const icons = {};
  let m;
  while ((m = iconRe.exec(block)) !== null) icons[m[1]] = m[2];
  assert.ok(icons.PREDATOR, 'PREDATOR icon must be parseable from ELITE_AFFIXES');
  for (const [k, ic] of Object.entries(icons)) {
    if (k === 'PREDATOR') continue;
    assert.notEqual(ic, icons.PREDATOR,
      `PREDATOR icon collides with ELITE_AFFIX ${k} (both are '${ic}')`);
  }
});

// ─── ELITE_AFFIXES pool size canary ──────────────────────────────────────
//
// HANDOFF PATTERN: this is the FIRST exact-count canary on the
// ELITE_AFFIXES registry. When the 8th elite affix lands, retire this
// `assert.equal(7, …)` to a `assert.ok(>= 7, …)` regression floor and
// the new affix's own test file pins exact 8. Same pattern as the
// FLOOR_MODIFIERS pool size canary in tests/_modifier-pool.js and the
// HACKWARE pool size canary in tests/shield-bubble-hackware.test.js.
test('ELITE_AFFIXES pool size invariant: PREDATOR brings the registry to exactly 7', () => {
  const block = extractBlock(CONTENT_NC, /const\s+ELITE_AFFIXES\s*=\s*\{/);
  assert.ok(block, 'ELITE_AFFIXES const block must be locatable in content.js');
  // Match top-level keys only — affix entries are flat one-liners with
  // no nested braces, so a simple `KEY:` count at the line start is
  // safe inside the brace-balanced block.
  const keys = block.match(/^\s+[A-Z_]+\s*:\s*\{/gm) || [];
  assert.equal(keys.length, 7,
    `ELITE_AFFIXES must contain EXACTLY 7 entries after PREDATOR landed (got ${keys.length}). When the 8th affix is added, retire this canary to a >= 7 floor and pin the new exact count in the new affix's own test file.`);
});

// ─── notifyPredatorElites helper ─────────────────────────────────────────

test('notifyPredatorElites is defined as a top-level function', () => {
  assert.match(ENTITIES_NC, /function\s+notifyPredatorElites\s*\(\s*px\s*,\s*py\s*\)/,
    'notifyPredatorElites(px, py) must be defined as a top-level function in entities.js');
});

test('notifyPredatorElites filters on eliteAffix === PREDATOR and dist <= 8 tiles', () => {
  const body = extractBlock(ENTITIES_NC, /function\s+notifyPredatorElites\s*\(/);
  assert.ok(body, 'notifyPredatorElites body must be extractable');
  // Affix gate
  assert.match(body, /e\.eliteAffix\s*!==\s*'PREDATOR'/,
    'notifyPredatorElites must skip enemies whose eliteAffix !== "PREDATOR"');
  // Range gate — the 8-tile design-canonical lock-on radius
  assert.match(body, /dist\s*\(\s*e\.x\s*,\s*e\.y\s*,\s*px\s*,\s*py\s*\)\s*<=\s*8\b/,
    'notifyPredatorElites must use a positional 8-tile radius (dist(e.x,e.y,px,py) <= 8)');
  // Dead-enemy skip — mirrors notifyFrenzyElites
  assert.match(body, /e\.dead\b/,
    'notifyPredatorElites must skip dead enemies');
});

test('notifyPredatorElites sets predatorBuffTimer = 3 (refresh, not stack)', () => {
  const body = extractBlock(ENTITIES_NC, /function\s+notifyPredatorElites\s*\(/);
  assert.ok(body, 'notifyPredatorElites body must be extractable');
  // Refresh-only: assignment to literal 3, never compound (`+=`, `+`, etc.)
  assert.match(body, /e\.predatorBuffTimer\s*=\s*3\b/,
    'notifyPredatorElites must REFRESH the buff (e.predatorBuffTimer = 3) — refresh-only is the design contract; stacking would let DoT ticks compound the multiplier');
  // Defend against accidental compound assignment that would let
  // PREDATOR stack via DoT ticks (burn/toxic/arc fire ~60 times/sec).
  // Allowed forms: `e.predatorBuffTimer = 3` and the decay
  // `enemy.predatorBuffTimer = Math.max(0, enemy.predatorBuffTimer - dt)`
  // (which writes via Math.max, NOT a compound op). Forbid +=, -=, *=, /=.
  assert.doesNotMatch(ENTITIES_NC, /predatorBuffTimer\s*(?:\+|-|\*\*?|\/|%)=/,
    'predatorBuffTimer must NEVER use compound assignment (would allow DoT ticks to stack the multiplier — refresh-only is the contract)');
});

test('notifyPredatorElites gates audio + glow on the LEADING edge (wasInactive check)', () => {
  // Leading-edge gate is critical: without it, every DoT tick frame
  // (~60/sec while in burn/toxic/arc) would re-trigger the lock-on
  // chirp and explosion particle burst — sound spam + GC churn.
  const body = extractBlock(ENTITIES_NC, /function\s+notifyPredatorElites\s*\(/);
  assert.ok(body, 'notifyPredatorElites body must be extractable');
  assert.match(body, /predatorBuffTimer\s*<=\s*0/,
    'notifyPredatorElites must gate audio/particle cues on a "was inactive" check (predatorBuffTimer <= 0 BEFORE the refresh)');
  assert.match(body, /audio\.elitePredator\s*\(\s*\)/,
    'notifyPredatorElites must call audio.elitePredator() on the leading edge');
});

// ─── tickEliteAffix decay ────────────────────────────────────────────────

test('tickEliteAffix decays predatorBuffTimer with dt (clamped at 0)', () => {
  const body = extractBlock(ENTITIES_NC, /function\s+tickEliteAffix\s*\(/);
  assert.ok(body, 'tickEliteAffix body must be extractable');
  // Decay form: Math.max(0, ... - dt) — clamps so the timer never
  // goes negative (which would break the leading-edge `<= 0` gate
  // in notifyPredatorElites if a future edit changed the comparison
  // to `< 0`).
  assert.match(body, /aff\s*===\s*'PREDATOR'[\s\S]{0,200}predatorBuffTimer\s*=\s*Math\.max\s*\(\s*0\s*,\s*enemy\.predatorBuffTimer\s*-\s*dt\s*\)/,
    'tickEliteAffix must contain a PREDATOR branch that decays predatorBuffTimer via Math.max(0, predatorBuffTimer - dt)');
});

// ─── berserkerMul branch ─────────────────────────────────────────────────

test('berserkerMul returns 1.3 for PREDATOR while predatorBuffTimer > 0', () => {
  const body = extractBlock(ENTITIES_NC, /berserkerMul\s*\(\s*\)\s*\{/);
  assert.ok(body, 'berserkerMul body must be extractable');
  // The +30% multiplier is the design-canonical value. Pinned exactly
  // because shifting to e.g. 1.5 would put PREDATOR above BERSERKER's
  // peak (also 1.5), eroding the design intent that PREDATOR's value
  // is uptime, not strength.
  assert.match(body, /this\.eliteAffix\s*===\s*'PREDATOR'\s*&&\s*this\.predatorBuffTimer\s*>\s*0\s*\)\s*return\s+1\.3\b/,
    'berserkerMul must return 1.3 (design-canonical +30%) when eliteAffix === PREDATOR && predatorBuffTimer > 0');
});

// ─── Player.takeDamage hook ──────────────────────────────────────────────

test('Player.takeDamage calls notifyPredatorElites after hp deduction', () => {
  // The notify call must appear AFTER `this.hp = Math.max(0, this.hp - actual)`
  // to be in the "real damage landed" zone — earlier placements would
  // either fire on absorb (bubble/SHIELD DRIVER/ENERGY_SHIELD all
  // `return 0` BEFORE this point) or fire pre-deduction with stale hp.
  const hpDeductIdx = ENTITIES_NC.indexOf('this.hp=Math.max(0,this.hp-actual)');
  assert.ok(hpDeductIdx > 0, 'Player.takeDamage hp-deduction line must be locatable');
  const notifyIdx = ENTITIES_NC.indexOf('notifyPredatorElites(this.x, this.y)', hpDeductIdx);
  assert.ok(notifyIdx > hpDeductIdx,
    'notifyPredatorElites(this.x, this.y) must appear AFTER `this.hp = Math.max(0, this.hp - actual)` so it only fires on real HP loss (absorb paths return 0 before reaching here)');
  // And within the same takeDamage method (i.e. before the next class
  // method definition). Bound the gap loosely — the existing in-method
  // gap from hp-deduction to method end is ~2200 chars (REACTIVE_ARMOR
  // + REACTIVE_CORE + SECOND_WIND + trauma_kit blocks), so 4000 chars
  // gives generous room without leaking into the next method.
  assert.ok(notifyIdx - hpDeductIdx < 4000,
    'notifyPredatorElites call drift from hp-deduction is too large — verify it is still inside Player.takeDamage');
});

// ─── Enemy constructor: state init ───────────────────────────────────────

test('Enemy constructor initialises predatorBuffTimer = 0', () => {
  // Without this init, the tickEliteAffix `> 0` gate would see
  // `undefined > 0` (false), the decay branch would never run, AND
  // notifyPredatorElites's `<= 0` leading-edge gate would see
  // `undefined <= 0` (false — undefined coerces to NaN comparison)
  // so the audio cue would NEVER fire on the first hit even if the
  // refresh assignment did. Both behaviours silently break.
  assert.match(ENTITIES_NC, /this\.predatorBuffTimer\s*=\s*0\b/,
    'Enemy constructor must initialise this.predatorBuffTimer = 0');
});

// ─── Enemy.draw render branch ────────────────────────────────────────────

test('Enemy.draw has a PREDATOR aura render branch gated on predatorBuffTimer > 0', () => {
  // Visual feedback is essential — without it, the player can't
  // identify which elite is currently locked on (and therefore can't
  // make positional decisions about which one to focus first).
  assert.match(ENTITIES_NC, /this\.eliteAffix\s*===\s*'PREDATOR'\s*&&\s*this\.predatorBuffTimer\s*>\s*0/,
    'Enemy.draw must contain a PREDATOR render branch gated on `eliteAffix === PREDATOR && predatorBuffTimer > 0`');
});

test('Enemy.draw PREDATOR branch clamps globalAlpha into [0,1]', () => {
  // Per stored memory 'canvas render gotchas': canvas globalAlpha
  // assignments outside [0,1] are silently ignored (the property
  // keeps its previous value). After ctx.save() the previous value
  // is whatever the outer context had. Without explicit clamping,
  // a pulse that goes negative (e.g. base + signed sin) renders at
  // FULL OPACITY for the negative portion of the pulse. The PREDATOR
  // ring uses `0.4 + 0.2 * Math.sin(...)` which stays in [0.2, 0.6]
  // — but multiplied by `frac = predatorBuffTimer/3` (which is in
  // [0,1]) and then potentially scaled by future tweaks, the safest
  // contract is "always clamp before assignment". This test pins
  // the Math.max(0, Math.min(1, ...)) sandwich so a future refactor
  // can't drop the clamp.
  //
  // Anchor on the PREDATOR draw guard EXCLUDING the berserkerMul
  // branch (which has the same `eliteAffix === 'PREDATOR' && this.predatorBuffTimer > 0`
  // shape but is NOT a draw branch — it returns 1.3, no globalAlpha).
  // Differentiator: the draw branch is followed by `ctx.save()`, the
  // berserkerMul branch by `return 1.3`. Search for the draw-branch
  // form by requiring `ctx.save()` immediately after the guard.
  const drawIdx = ENTITIES_NC.search(/this\.eliteAffix\s*===\s*'PREDATOR'\s*&&\s*this\.predatorBuffTimer\s*>\s*0\s*\)\s*\{\s*\n\s*ctx\.save\s*\(/);
  assert.ok(drawIdx > 0, 'PREDATOR draw branch (followed by ctx.save()) must be locatable — not the berserkerMul early-return branch');
  const slice = ENTITIES_NC.slice(drawIdx, drawIdx + 1500);
  assert.match(slice, /ctx\.globalAlpha\s*=\s*Math\.max\s*\(\s*0\s*,\s*Math\.min\s*\(\s*1/,
    'PREDATOR draw branch must clamp globalAlpha into [0,1] via Math.max(0, Math.min(1, …)) — see stored memory "canvas render gotchas" on silent-ignore behaviour');
});

// ─── Audio binding ───────────────────────────────────────────────────────

test('audio.elitePredator() is defined in platform.js with osc + noise calls', () => {
  const body = extractBlock(PLATFORM_NC, /elitePredator\s*\(\s*\)\s*\{/);
  assert.ok(body, 'audio.elitePredator() body must be extractable from platform.js');
  // At least one osc + noise call to confirm the synth body exists
  // (catches an empty-body stub that would silently produce no sound).
  assert.match(body, /\bosc\s*\(/, 'elitePredator must call osc()');
  assert.match(body, /\bnoise\s*\(/, 'elitePredator must call noise() (filtered click for the lock-on chirp)');
});

// ─── rollEliteAffix integration ──────────────────────────────────────────

test('rollEliteAffix does not unconditionally exclude PREDATOR for any enemy type', () => {
  // PREDATOR is intended to roll on most elites. Verify no exclusion
  // entry was accidentally added that filters it out for every type
  // (a `k === 'PREDATOR'` check with no enemyType qualifier would
  // make the affix unrollable).
  const body = extractBlock(CONTENT_NC, /function\s+rollEliteAffix\s*\(/);
  assert.ok(body, 'rollEliteAffix body must be extractable');
  // If a PREDATOR exclusion ever lands, it must be paired with a
  // specific enemyType check (matches the existing PHASING/PHANTOM,
  // VOLATILE/SEEKER, SHIELDED/SHIELDER pattern). A bare `'PREDATOR'`
  // mention with no `enemyType ===` on the same line means a blanket
  // exclusion — fail.
  const lines = body.split('\n');
  for (const line of lines) {
    if (line.includes("'PREDATOR'") && line.includes('return false') && !line.includes('enemyType ===')) {
      assert.fail(`rollEliteAffix has a non-type-gated PREDATOR exclusion: ${line.trim()}`);
    }
  }
});
