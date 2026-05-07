'use strict';
// GREEDY 'of Greed' weapon-affix suffix — source-text wiring tests.
//
// content.js / entities.js are browser-only (no UMD/CommonJS exports), so
// we can't load die() / applyHitEffects directly under node:test. Instead,
// these tests assert the structural invariants any working GREEDY suffix
// must satisfy: registry shape (slot/effect keyword), the on-kill
// gates (!isProc / effects.includes('greedy') / !isShard / !isSummon),
// and that the bonus is added to player credits with VFX feedback.
//
// Each check fails loudly the moment a refactor drops a wire — same
// silent-removal failure mode that bit RECOIL/SHOCK_PULSE/HUNTER reviews.

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

// Strip /* ... */ and // ... comments so source-text regex assertions
// match against EXECUTABLE source, not commentary that incidentally
// quotes the gate token. Pattern from tests/mark-affix.test.js and
// tests/reverse-polarity-hackware.test.js (per stored memory
// 'test regex pitfalls').
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const ENTITIES_CODE = stripComments(ENTITIES);

test('GREEDY is registered in WEAPON_AFFIXES as a suffix with effect:greedy', () => {
  // slot:'suffix' is critical — slot routes the affix through the on-hit
  // / on-kill effect path. A typo to 'prefix' would silently route into
  // the mod-loop in buildWeapon() and never reach the on-kill gate.
  // effect:'greedy' is the keyword die() switches on; if it diverges
  // from the gate string the suffix becomes a cosmetic no-op.
  const re = /GREEDY:\s*\{\s*slot:\s*'suffix'\s*,\s*label:\s*'[^']+'\s*,\s*colour:\s*'#[0-9a-fA-F]+'\s*,\s*desc:\s*'[^']+'\s*,\s*effect:\s*'greedy'\s*\}/;
  assert.match(CONTENT, re,
    "GREEDY must be a suffix with label/colour/desc and effect:'greedy'");
});

test('Enemy.die() reads _lastHitCtx and gates the bonus on effects.includes("greedy")', () => {
  // The bonus must be wired through the existing _lastHitCtx pipe so the
  // ctx propagates from Player.shoot → Projectile → enemy.takeDamage →
  // _lastHitCtx (set unconditionally at takeDamage entry). A literal
  // string match for the gate token would pass on a comment that quotes
  // 'greedy' — strip comments first.
  assert.match(ENTITIES_CODE, /effects\.includes\(\s*'greedy'\s*\)/,
    "die() must gate on _lastHitCtx.effects.includes('greedy')");
});

test('GREEDY on-kill gates on !isProc (proc finishers do not credit Greedy)', () => {
  // If a non-Greedy proc (THUNDER chain, EXPLOSIVE_KILLS, RICOCHET hit)
  // finishes the enemy, _lastHitCtx will be that proc's context —
  // {isProc:true}. Without the !isProc gate, those procs would credit
  // a Greedy bonus they didn't earn. Mirrors applyOnKill at
  // entities.js:1158-1162.
  // Anchor on the greedy-includes match and walk back to find the gate.
  const idx = ENTITIES_CODE.indexOf("effects.includes('greedy')");
  assert.ok(idx !== -1, 'greedy gate must exist');
  // Search the preceding ~400 chars for !_gctx?.isProc or !ctx.isProc style.
  const head = ENTITIES_CODE.slice(Math.max(0, idx - 400), idx);
  assert.match(head, /!\s*[\w.]*isProc/,
    'on-kill GREEDY block must gate on !isProc to skip proc finishers');
});

test('GREEDY skips summons and shards (defense in depth)', () => {
  // Summons already have baseCr=0 via line 1925, but the gate documents
  // intent and survives any future change that grants summons a base
  // credit. Mirrors the !this.isShard && !isSummon gate used by
  // HARVESTER/MAGPIE/VAULTMASTER drops above.
  const idx = ENTITIES_CODE.indexOf("effects.includes('greedy')");
  assert.ok(idx !== -1, 'greedy gate must exist');
  // Search a wider window because the gate spans multiple lines.
  const window = ENTITIES_CODE.slice(Math.max(0, idx - 400), idx + 600);
  assert.match(window, /!\s*this\.isShard/,
    'GREEDY block must skip this.isShard');
  assert.match(window, /!\s*isSummon/,
    'GREEDY block must skip isSummon');
});

test('GREEDY adds bonus to player.credits and emits gold +CR feedback', () => {
  // The credit grant is the entire point — without this line the suffix
  // is a cosmetic no-op. The +CR text and gold particles confirm the
  // player gets unambiguous feedback even on a small screen / busy frame
  // (mirrors VAULTMASTER and bounty bonus visual contracts).
  const idx = ENTITIES_CODE.indexOf("effects.includes('greedy')");
  assert.ok(idx !== -1, 'greedy gate must exist');
  const window = ENTITIES_CODE.slice(idx, idx + 800);
  assert.match(window, /_EG\.player\.credits\s*\+=\s*bonusCr/,
    'GREEDY must add bonusCr to player.credits');
  assert.match(window, /spawnDmgText\([^)]*'\+'\s*\+\s*bonusCr\s*\+\s*' CR'[^)]*'#ffd700'/,
    'GREEDY must emit a "+N CR" floating text in gold');
});

test('GREEDY bonus is +50% of base credit drop, rounded, with sub-1 zero-suppress', () => {
  // 0.5 multiplier is the design — too high (×2) trivializes economy,
  // too low (×0.1) makes the suffix never feel rewarding. Pin the
  // value so an unintentional re-tune is caught in review.
  // Math.round + bonusCr > 0 guard prevents low-CR mobs (e.g. early-floor
  // GRUNTs) from showing "+0 CR" floating text on every kill (visual
  // noise; the suffix should feel premium).
  const idx = ENTITIES_CODE.indexOf("effects.includes('greedy')");
  assert.ok(idx !== -1, 'greedy gate must exist');
  const window = ENTITIES_CODE.slice(idx, idx + 800);
  assert.match(window, /Math\.round\(\s*cr\s*\*\s*0\.5\s*\)/,
    'GREEDY bonus must be Math.round(cr * 0.5) — 50% of base credit drop');
  assert.match(window, /if\s*\(\s*bonusCr\s*>\s*0\s*\)/,
    'GREEDY must skip the message/particle when bonusCr rounds to 0');
});

test('GREEDY block runs AFTER the base credit award (so it stacks, not replaces)', () => {
  // The bonus must be additive on top of the existing CR award. If the
  // block ran before `_EG.player.credits += cr` we'd double-add, miscount,
  // or replace. Anchor on positions: the base award must precede the gate.
  const baseAwardIdx = ENTITIES_CODE.indexOf('_EG.player.credits += cr');
  const greedyGateIdx = ENTITIES_CODE.indexOf("effects.includes('greedy')");
  assert.ok(baseAwardIdx !== -1, 'base credit award line must exist');
  assert.ok(greedyGateIdx > baseAwardIdx,
    'GREEDY bonus block must come AFTER the base credit award so it stacks');
});
