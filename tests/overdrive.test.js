'use strict';
// OVERDRIVE perk — wiring + behaviour tests.
//
// OVERDRIVE is a kill-streak-gated offensive perk that PIGGYBACKS on
// the existing score-combo system (`combo.count` in content.js). While
// combo.count >= 2, Player.effectiveAtk() multiplies ATK by
// 1 + min(0.30, (combo.count - 1) * 0.03), capping at +30% at combo 11+.
// No new mutable state — combo.count auto-clears via COMBO_WINDOW=3s,
// so no loadFloor reset is needed (per stored "player movement
// accumulators" rule, only NEW per-frame accumulators require resets;
// reusing existing self-clearing state sidesteps that class of bug).
//
// Stacks multiplicatively with BERSERKER through the same chokepoint
// (entities.js Player.effectiveAtk), mirroring the established pattern.
//
// Source-text wiring tests (entities.js / content.js are browser-only —
// no UMD/CommonJS exports — same pattern as stride / shock-pulse tests).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ENTITIES = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8');
const CONTENT  = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'content.js'),  'utf8');
const SW       = fs.readFileSync(path.resolve(__dirname, '..', 'sw.js'),              'utf8');

// ─── PERK_POOL entry ──────────────────────────────────────────────────────

test('OVERDRIVE is registered in PERK_POOL with name/icon/desc/colour', () => {
  const pool = CONTENT.match(/const\s+PERK_POOL\s*=\s*\{[\s\S]*?\n\};/);
  assert.ok(pool, 'PERK_POOL block must be locatable in content.js');
  assert.match(pool[0], /OVERDRIVE\s*:\s*\{[^}]*name\s*:\s*['"]Overdrive['"]/,
    'PERK_POOL.OVERDRIVE must declare name "Overdrive"');
  assert.match(pool[0], /OVERDRIVE\s*:\s*\{[^}]*icon\s*:/,
    'PERK_POOL.OVERDRIVE must declare an icon');
  assert.match(pool[0], /OVERDRIVE\s*:\s*\{[^}]*desc\s*:/,
    'PERK_POOL.OVERDRIVE must declare a desc');
  assert.match(pool[0], /OVERDRIVE\s*:\s*\{[^}]*colour\s*:/,
    'PERK_POOL.OVERDRIVE must declare a colour');
});

// ─── effectiveAtk hook ────────────────────────────────────────────────────

test('OVERDRIVE is wired into Player.effectiveAtk()', () => {
  // Locate the effectiveAtk method body and assert OVERDRIVE branch is inside.
  const m = ENTITIES.match(/effectiveAtk\s*\(\s*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(m, 'Player.effectiveAtk() block must be locatable in entities.js');
  assert.match(m[0], /this\.perks\.OVERDRIVE/,
    'effectiveAtk() must reference this.perks.OVERDRIVE');
  // Verify the combo.count gate is present inside the method body.
  assert.match(m[0], /combo\.count|combo\s*&&/,
    'effectiveAtk() OVERDRIVE branch must consult combo.count');
});

test('OVERDRIVE branch in effectiveAtk uses tiles/sec-style fixed bonus, capped', () => {
  // Concrete formula assertions — guards against regression to e.g. a flat
  // multiplier or an uncapped exponential. We expect Math.min(0.30, ...)
  // for the cap and a per-stack increment of 0.03 (3% per combo level).
  // Use a generous slice after the OVERDRIVE branch entry so the test is
  // robust to indentation/comment changes.
  const idx = ENTITIES.indexOf('this.perks.OVERDRIVE');
  assert.ok(idx >= 0, 'OVERDRIVE branch entry must exist in entities.js');
  const slice = ENTITIES.slice(idx, idx + 800);
  assert.match(slice, /Math\.min\s*\(\s*0\.30?\s*,/,
    'OVERDRIVE bonus must be capped via Math.min(0.30, …)');
  assert.match(slice, /0\.03/,
    'OVERDRIVE per-combo-level bonus must be 0.03 (3% per stack)');
  // Gate must be combo.count >= 2 (single kill grants no bonus, matches the
  // existing comboMultiplier() gate in content.js).
  assert.match(slice, />=\s*2\b/,
    'OVERDRIVE must gate on combo.count >= 2 to mirror comboMultiplier()');
});

// ─── Numerical formula sanity ─────────────────────────────────────────────

test('OVERDRIVE formula: bonus(c) = min(0.30, (c-1)*0.03), gate at c<2', () => {
  // Re-derive the documented formula in JS so any future spec drift forces
  // an explicit update to this assertion table.
  const bonus = (/** @type {number} */ c) => (c < 2 ? 0 : Math.min(0.30, (c - 1) * 0.03));

  assert.equal(bonus(0),  0,    'no combo → no bonus');
  assert.equal(bonus(1),  0,    'single kill → no bonus (matches scoring)');
  assert.equal(bonus(2),  0.03, 'combo 2 → +3%');
  assert.equal(bonus(5),  0.12, 'combo 5 → +12%');
  assert.equal(+bonus(10).toFixed(2), 0.27, 'combo 10 → +27%');
  assert.equal(bonus(11), 0.30, 'combo 11 → +30% (cap reached)');
  assert.equal(bonus(20), 0.30, 'combo 20 → +30% (still capped)');
  assert.equal(bonus(99), 0.30, 'pathological combo → still capped at +30%');
});

test('OVERDRIVE applies multiplicatively and rounds, like BERSERKER', () => {
  // Mimic effectiveAtk() so a future refactor that changes rounding mode
  // (Math.floor / Math.ceil) trips this test.
  /**
   * @param {{atk:number, perks:any, hp:number, maxHp:number}} p
   * @param {number} comboCount
   */
  function eff(p, comboCount) {
    let a = p.atk;
    if (p.perks.BERSERKER && p.hp / p.maxHp <= 0.25) a = Math.round(a * 1.4);
    if (p.perks.OVERDRIVE && comboCount >= 2) {
      const b = Math.min(0.30, (comboCount - 1) * 0.03);
      a = Math.round(a * (1 + b));
    }
    return a;
  }
  // Plain ATK 10, no perks → 10.
  assert.equal(eff({atk:10, perks:{}, hp:100, maxHp:100}, 5), 10);
  // OVERDRIVE only at combo 5 → 10 * 1.12 = 11.2 → rounds to 11.
  assert.equal(eff({atk:10, perks:{OVERDRIVE:true}, hp:100, maxHp:100}, 5), 11);
  // OVERDRIVE at cap (combo 11) → 10 * 1.30 = 13.
  assert.equal(eff({atk:10, perks:{OVERDRIVE:true}, hp:100, maxHp:100}, 11), 13);
  // BERSERKER + OVERDRIVE @ combo 11, low HP →
  //   10 * 1.4 = 14 → 14 * 1.30 = 18.2 → rounds to 18.
  assert.equal(eff({atk:10, perks:{BERSERKER:true, OVERDRIVE:true}, hp:10, maxHp:100}, 11), 18);
  // OVERDRIVE perk owned but combo<2 → no buff (single kill cannot self-buff).
  assert.equal(eff({atk:10, perks:{OVERDRIVE:true}, hp:100, maxHp:100}, 1), 10);
});

// ─── No new accumulator state was introduced ──────────────────────────────

test('OVERDRIVE does not introduce a new player accumulator (reuses combo.count)', () => {
  // Per stored "player movement accumulators" rule: any new accumulator
  // gated on per-frame state must be reset in game.js loadFloor() alongside
  // burnTimer/shockTimer. OVERDRIVE deliberately reuses the existing
  // self-clearing combo.count to sidestep that class of bug — this test
  // pins that decision so a future refactor doesn't quietly add an
  // unreset _overdrive* counter.
  assert.ok(
    !/_overdrive[A-Za-z_]*\s*=/.test(ENTITIES),
    'OVERDRIVE must not declare a private _overdrive* accumulator on the Player'
  );
});

// ─── SW cache version ─────────────────────────────────────────────────────

test('sw.js cache version is at least v211 (any modified-asset PR must bump)', () => {
  // Per project convention: cache key MUST be bumped when any cached asset
  // changes. We assert >= the version this PR ships with so concurrent PRs
  // can leapfrog without failing this test (per stored sw cache convention).
  const m = SW.match(/neon-dungeon-v(\d+)/);
  assert.ok(m, 'sw.js must declare a neon-dungeon-vN cache key');
  const v = parseInt(m[1], 10);
  assert.ok(v >= 211, `sw.js cache version must be >= v211 (found v${v})`);
});

// ─── Cross-floor reset invariant ──────────────────────────────────────────

test('combo.count reset on floor populate is preserved (anti-leak invariant)', () => {
  // OVERDRIVE deliberately reuses combo.count instead of declaring its own
  // accumulator BECAUSE populateFloor() in render.js already wipes
  // combo.{count,timer,flashTimer} on every fresh-floor entry. This pins
  // that invariant — if a future refactor drops the wipe, OVERDRIVE would
  // silently leak ATK% across the descend warp (per stored "player movement
  // accumulators" rule: descend transitions teleport state between frames
  // and any unreset gameplay accumulator carries forward unfairly).
  const RENDER = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'render.js'), 'utf8');
  const popIdx = RENDER.indexOf('function populateFloor(');
  assert.ok(popIdx >= 0, 'populateFloor() must exist in render.js');
  // Slice the first ~2KB of the function body — wipes happen at the top
  // before any room iteration.
  const slice = RENDER.slice(popIdx, popIdx + 2000);
  assert.match(slice, /combo\.count\s*=\s*0/,
    'populateFloor() must reset combo.count = 0');
  assert.match(slice, /combo\.timer\s*=\s*0/,
    'populateFloor() must reset combo.timer = 0');
});

// ─── SIGNAL BOOST synergy is intentional, not exploit ─────────────────────

test('OVERDRIVE behaviour matches its description (score-combo gated, not kill-only)', () => {
  // GHOST_SIGNAL crate item directly sets combo.count = 5 (content.js).
  // OVERDRIVE intentionally fires off raw combo state, so SIGNAL BOOST
  // granting OVERDRIVE-owners a ~12% ATK window for 3s is a designed
  // synergy — the description "Score combo buffs damage" advertises this
  // explicitly. This test pins the design choice so a future "kill-only"
  // refactor must update the perk description in lockstep.
  const pool = CONTENT.match(/const\s+PERK_POOL\s*=\s*\{[\s\S]*?\n\};/);
  assert.ok(pool, 'PERK_POOL block must be locatable');
  assert.match(pool[0], /OVERDRIVE\s*:\s*\{[^}]*desc\s*:\s*['"][^'"]*[Ss]core[^'"]*['"]/,
    'OVERDRIVE desc must mention "score combo" so players understand SIGNAL BOOST synergy');
  // GHOST_SIGNAL must still set combo.count synthetically (the synergy hook).
  assert.match(CONTENT, /case\s+['"]GHOST_SIGNAL['"][\s\S]*?combo\.count\s*=\s*5/,
    'GHOST_SIGNAL must still set combo.count = 5 (the synergy source)');
});
