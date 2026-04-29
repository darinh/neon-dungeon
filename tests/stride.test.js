'use strict';
// STRIDE perk — wiring + behaviour tests.
//
// STRIDE is a movement-gated offensive perk. Continuous movement (rate
// >= STRIDE_MOVE_RATE tiles/sec) builds 1 ATK stack per second, capped
// at STRIDE_MAX_STACKS (5), each adding STRIDE_DMG_PER_STACK (5%) to
// Player.effectiveAtk(). Standing still beyond STRIDE_RESET_GRACE (0.3s)
// drops all stacks. Distinct from BERSERKER (low-HP gate) and the meta
// "momentum" upgrade (kill-triggered burst): STRIDE is purely
// movement-gated and stacks additively with both via effectiveAtk().
//
// Source-text wiring tests (entities.js / content.js are browser-only —
// no UMD/CommonJS exports — same pattern as shock-pulse / vaultmaster /
// magpie tests).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ENTITIES = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8');
const CONTENT  = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'content.js'),  'utf8');
const SW       = fs.readFileSync(path.resolve(__dirname, '..', 'sw.js'),              'utf8');

// ─── PERK_POOL entry ──────────────────────────────────────────────────────

test('STRIDE is registered in PERK_POOL with name/icon/desc/colour', () => {
  // Anchor inside the PERK_POOL block to ensure registration (not just a
  // stray reference in a comment).
  const pool = CONTENT.match(/const\s+PERK_POOL\s*=\s*\{[\s\S]*?\n\};/);
  assert.ok(pool, 'PERK_POOL block must be locatable in content.js');
  assert.match(pool[0], /STRIDE\s*:\s*\{[^}]*name\s*:\s*['"]Stride['"]/,
    'PERK_POOL.STRIDE must declare name "Stride"');
  assert.match(pool[0], /STRIDE\s*:\s*\{[^}]*icon\s*:/,
    'PERK_POOL.STRIDE must declare an icon');
  assert.match(pool[0], /STRIDE\s*:\s*\{[^}]*desc\s*:/,
    'PERK_POOL.STRIDE must declare a desc');
  assert.match(pool[0], /STRIDE\s*:\s*\{[^}]*colour\s*:/,
    'PERK_POOL.STRIDE must declare a colour');
});

// ─── Tunable constants ────────────────────────────────────────────────────

test('STRIDE constants live in entities.js with sane bounds', () => {
  const r  = ENTITIES.match(/STRIDE_MOVE_RATE\s*=\s*([\d.]+)/);
  const ps = ENTITIES.match(/STRIDE_PER_STACK\s*=\s*([\d.]+)/);
  const ms = ENTITIES.match(/STRIDE_MAX_STACKS\s*=\s*(\d+)/);
  const dp = ENTITIES.match(/STRIDE_DMG_PER_STACK\s*=\s*([\d.]+)/);
  const rg = ENTITIES.match(/STRIDE_RESET_GRACE\s*=\s*([\d.]+)/);
  assert.ok(r && ps && ms && dp && rg,
    'STRIDE_MOVE_RATE / _PER_STACK / _MAX_STACKS / _DMG_PER_STACK / _RESET_GRACE constants must all be declared');
  const rate = parseFloat(r[1]);
  const perStack = parseFloat(ps[1]);
  const maxStacks = parseInt(ms[1], 10);
  const dmgPerStack = parseFloat(dp[1]);
  const grace = parseFloat(rg[1]);
  // Rate threshold MUST be a tiles/sec value (≥ 0.1) — guards against a
  // future regression that uses tiles/frame (~0.05 at 60fps; 0.029 at
  // 120fps), which would silently flip behaviour at different fps. See
  // stored "stillness/rate trackers" rule.
  assert.ok(rate >= 0.1 && rate <= 2.0,
    `STRIDE_MOVE_RATE must be a tiles/sec rate in [0.1, 2.0], got ${rate}`);
  assert.ok(perStack > 0 && perStack <= 3,
    `STRIDE_PER_STACK should be in (0, 3] s, got ${perStack}`);
  assert.ok(maxStacks >= 3 && maxStacks <= 10,
    `STRIDE_MAX_STACKS should be in [3, 10], got ${maxStacks}`);
  assert.ok(dmgPerStack > 0 && dmgPerStack <= 0.15,
    `STRIDE_DMG_PER_STACK should be in (0, 0.15], got ${dmgPerStack}`);
  assert.ok(grace > 0 && grace <= 1.0,
    `STRIDE_RESET_GRACE should be in (0, 1] s, got ${grace}`);
});

// ─── Player class fields & constructor init ───────────────────────────────

test('Player declares _stride* runtime fields', () => {
  const decl = ENTITIES.match(/class\s+Player\s*\{[\s\S]*?\n\s{2}constructor/);
  assert.ok(decl, 'Player class declaration block must be locatable');
  assert.match(decl[0], /_strideStacks/,    'Player must declare _strideStacks field');
  assert.match(decl[0], /_strideMovingTime/, 'Player must declare _strideMovingTime field');
  assert.match(decl[0], /_strideStillTime/,  'Player must declare _strideStillTime field');
});

test('Player constructor initialises _stride* to 0', () => {
  // Look for the three init lines in the same neighbourhood (post-momentum
  // init block), tolerant of whitespace.
  assert.match(ENTITIES, /this\._strideStacks\s*=\s*0\s*;/,
    'constructor must init this._strideStacks = 0');
  assert.match(ENTITIES, /this\._strideMovingTime\s*=\s*0\s*;/,
    'constructor must init this._strideMovingTime = 0');
  assert.match(ENTITIES, /this\._strideStillTime\s*=\s*0\s*;/,
    'constructor must init this._strideStillTime = 0');
});

// ─── effectiveAtk wiring ──────────────────────────────────────────────────

test('effectiveAtk multiplies by (1 + STRIDE_DMG_PER_STACK * stacks) when STRIDE owned & stacks > 0', () => {
  // Locate the effectiveAtk method body precisely so we don't grep stray
  // matches elsewhere in the file.
  const m = ENTITIES.match(/effectiveAtk\s*\([^)]*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(m, 'effectiveAtk method body must be locatable');
  assert.match(m[0], /this\.perks\.STRIDE/,
    'effectiveAtk must gate the STRIDE bonus on this.perks.STRIDE');
  assert.match(m[0], /STRIDE_DMG_PER_STACK/,
    'effectiveAtk must use STRIDE_DMG_PER_STACK for scaling (no magic numbers)');
  assert.match(m[0], /_strideStacks/,
    'effectiveAtk must read this._strideStacks');
  // BERSERKER must remain — mutual stacking is intended.
  assert.match(m[0], /this\.perks\.BERSERKER/,
    'effectiveAtk must still apply BERSERKER (additive stacking is intentional)');
});

// ─── Tick wiring in Player.update ────────────────────────────────────────

test('Player.update ticks STRIDE using moved/dt rate (frame-rate independent)', () => {
  // Find the tick block by anchoring on the three known signals.
  const tickRe = /\[tick:STRIDE\][\s\S]*?\n\s{4}\}/;
  const m = ENTITIES.match(tickRe);
  assert.ok(m, 'STRIDE tick block must exist in Player.update');
  // moved/dt rate gate (the codified rule: rate threshold, NOT
  // tiles/frame absolute).
  assert.match(m[0], /dist\s*\(\s*this\._prevX\s*,\s*this\._prevY\s*,\s*this\.x\s*,\s*this\.y\s*\)/,
    'STRIDE tick must read post-movement displacement via dist(_prevX,_prevY,x,y)');
  assert.match(m[0], /\/\s*dt/,
    'STRIDE tick must divide moved by dt to get a tiles/sec rate (frame-rate independent)');
  assert.match(m[0], /STRIDE_MOVE_RATE/,
    'STRIDE tick must gate on STRIDE_MOVE_RATE (no magic numbers)');
  assert.match(m[0], /STRIDE_PER_STACK/,
    'STRIDE tick must use STRIDE_PER_STACK to convert time → stacks');
  assert.match(m[0], /STRIDE_MAX_STACKS/,
    'STRIDE tick must clamp at STRIDE_MAX_STACKS');
  assert.match(m[0], /STRIDE_RESET_GRACE/,
    'STRIDE tick must use STRIDE_RESET_GRACE for the standing-still drop');
  // The stillness branch must reset stacks + the moving-time accumulator
  // (otherwise a brief pause buffered by accumulated time would re-grant
  // a free stack on the very next moving frame).
  assert.match(m[0], /this\._strideStacks\s*=\s*0/,
    'STRIDE tick stillness branch must reset _strideStacks to 0');
  assert.match(m[0], /this\._strideMovingTime\s*=\s*0/,
    'STRIDE tick stillness branch must also reset _strideMovingTime to 0');
});

test('STRIDE tick is gated on this.perks.STRIDE (no overhead for non-owners)', () => {
  const tickRe = /\[tick:STRIDE\][\s\S]*?\n\s{4}\}/;
  const m = ENTITIES.match(tickRe);
  assert.ok(m, 'STRIDE tick block must exist');
  assert.match(m[0], /this\.perks\.STRIDE/,
    'STRIDE tick must short-circuit when the player has not picked the perk');
});

test('STRIDE tick is suppressed during shock (movement is force-zeroed anyway)', () => {
  const tickRe = /\[tick:STRIDE\][\s\S]*?\n\s{4}\}/;
  const m = ENTITIES.match(tickRe);
  assert.ok(m, 'STRIDE tick block must exist');
  // Either an explicit shockTimer guard OR the rate test alone would
  // both correctly report not-moving; we require the explicit guard so a
  // future change that allows movement-while-shocked doesn't silently
  // start building stride during a lockdown.
  assert.match(m[0], /shockTimer/,
    'STRIDE tick should reference shockTimer (defensive: explicit "no stride while shocked")');
});

// ─── HUD chip wiring ──────────────────────────────────────────────────────

test('HUD computeStatusFx pushes a stride chip when stacks > 0', () => {
  // Anchor the chip push so a future rename of label/icon is caught.
  // Post-multiplier-readout (stride-multiplier-readout PR): the label is
  // the readout `'RUSH ×' + mul` (mul = (1 + 0.05 * ss).toFixed(2))
  // rather than the raw stack count. The cross-file alignment of the
  // formula is exhaustively tested in tests/stride-hud.test.js — this
  // test just pins the broad chip-shape (id, label-prefix, gate).
  assert.match(CONTENT, /id:\s*['"]stride['"]/,
    'HUD chip must use id "stride"');
  assert.match(CONTENT, /label:\s*['"]RUSH ×['"]\s*\+\s*mul/,
    'HUD chip label must use the multiplier-readout form `RUSH ×` + mul');
  assert.match(CONTENT, /player\.perks\s*&&\s*player\.perks\.STRIDE\s*&&\s*ss\s*>\s*0/,
    'HUD chip must gate on player.perks && player.perks.STRIDE && ss > 0 (defensive null-check + entities.js alias mirror)');
});

// ─── Service worker cache version ─────────────────────────────────────────

test('sw.js cache version is at least v210', () => {
  // Match the develop convention of an additive bump per shipped
  // user-visible change. Open PRs claim v198–v209 in parallel; this PR
  // takes v210 to avoid collision until merge order resolves.
  const m = SW.match(/neon-dungeon-v(\d+)/);
  assert.ok(m, 'sw.js must declare a neon-dungeon-vN cache key');
  const v = parseInt(m[1], 10);
  assert.ok(v >= 210, `sw cache version must be >= v210 (STRIDE), got v${v}`);
});

// ─── Floor transition: STRIDE stacks must reset ──────────────────────────

test('loadFloor() resets _stride* state (no warp-into-new-floor stack leak)', () => {
  // Without an explicit reset, the cross-frame teleport from descend()
  // (player.x/y mutated between frames during loadFloor) would yield a
  // huge moved/dt on the very next update, the rate gate would treat
  // the warp as "moving", and full RUSH ×N stacks would survive into the
  // new floor for free. Mirrors the existing `burnTimer = 0` reset on
  // the same line.
  const GAME = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8');
  const m = GAME.match(/loadFloor\s*\([^)]*\)\s*\{[\s\S]*?(?:\n\s{2}\}|\n\}\s*\n)/);
  assert.ok(m, 'loadFloor method body must be locatable in game.js');
  assert.match(m[0], /this\.player\._strideStacks\s*=\s*0/,
    'loadFloor must reset player._strideStacks to 0 on floor transition');
  assert.match(m[0], /this\.player\._strideMovingTime\s*=\s*0/,
    'loadFloor must reset player._strideMovingTime to 0 on floor transition');
  assert.match(m[0], /this\.player\._strideStillTime\s*=\s*0/,
    'loadFloor must reset player._strideStillTime to 0 on floor transition');
});

// ─── Save/load: STRIDE stacks are runtime-only (NOT persisted) ────────────

test('STRIDE stacks are NOT serialized in save snapshots (runtime-only)', () => {
  // Mirrors the HUNTER stillness / momentum convention: transient
  // movement state should not survive a save/load round-trip — picking
  // up where you left off shouldn't gift you the prior frame's RUSH.
  // The perk OWNERSHIP (player.perks.STRIDE) IS persisted through the
  // generic perks dict; only the stack counters are runtime-only.
  const SAVE = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'meta', 'save.js'), 'utf8');
  assert.doesNotMatch(SAVE, /_strideStacks/,
    'save.js must not serialize _strideStacks (runtime-only state)');
  assert.doesNotMatch(SAVE, /_strideMovingTime/,
    'save.js must not serialize _strideMovingTime (runtime-only state)');
  assert.doesNotMatch(SAVE, /_strideStillTime/,
    'save.js must not serialize _strideStillTime (runtime-only state)');
});
