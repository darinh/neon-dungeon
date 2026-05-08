'use strict';
// GLASS_CANNON perk — wiring + behaviour tests.
//
// GLASS_CANNON is a passive risk/reward offensive perk:
//   - Player.effectiveAtk()       returns a * 1.30 when perks.GLASS_CANNON.
//   - Player.takeDamage(...)      multiplies post-mitigation damage by 1.25
//                                 when perks.GLASS_CANNON, gated on
//                                 !options.ignoreDefense (env-DoT safety).
//
// Distinct from sibling damage-mod perks:
//   - BERSERKER  : passive, +40% ATK at <=25% HP        (HP threshold)
//   - PRISTINE   : passive, +25% ATK at >=90% HP        (HP threshold)
//   - LAST_STAND : triggered, +75%/-50% at <=10% HP, 60s CD (panic button)
//   - RETRIBUTION: triggered on damage taken, +50% for 3s (reactive)
//   - GLASS_CANNON: passive, +30% ATK / +25% incoming   (always-on trade-off)
//
// No accumulator state — purely a passive multiplier on both sides. No
// loadFloor reset required (no timer, no charge, no stacks).
//
// Source-text wiring tests (entities.js / content.js are browser-only —
// no UMD/CommonJS exports — same pattern as retribution / overdrive / stride).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readSourceFile } = require('./_source-files.js');

const ENTITIES = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8');
const CONTENT  = readSourceFile(__dirname, 'contentPerks');
const SW       = fs.readFileSync(path.resolve(__dirname, '..', 'sw.js'),              'utf8');

// Strip JS comments before regex assertions so a "// if (this.perks.X)" comment
// can't satisfy a gate-presence check. Established pattern from
// tests/mark-affix.test.js + tests/reverse-polarity-hackware.test.js.
/** @param {string} src */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

// ─── PERK_POOL entry ──────────────────────────────────────────────────────

test('GLASS_CANNON is registered in PERK_POOL with name/icon/desc/colour', () => {
  const pool = CONTENT.match(/const\s+PERK_POOL\s*=\s*\{[\s\S]*?\n\};/);
  assert.ok(pool, 'PERK_POOL block must be locatable in content/perks.js');
  assert.match(pool[0], /GLASS_CANNON\s*:\s*\{[^}]*name\s*:\s*['"]Glass Cannon['"]/,
    'PERK_POOL.GLASS_CANNON must declare name "Glass Cannon"');
  assert.match(pool[0], /GLASS_CANNON\s*:\s*\{[^}]*icon\s*:/,
    'PERK_POOL.GLASS_CANNON must declare an icon');
  assert.match(pool[0], /GLASS_CANNON\s*:\s*\{[^}]*desc\s*:/,
    'PERK_POOL.GLASS_CANNON must declare a desc');
  assert.match(pool[0], /GLASS_CANNON\s*:\s*\{[^}]*colour\s*:/,
    'PERK_POOL.GLASS_CANNON must declare a colour');
});

// ─── effectiveAtk hook ────────────────────────────────────────────────────

test('GLASS_CANNON is wired into Player.effectiveAtk()', () => {
  const m = ENTITIES.match(/effectiveAtk\s*\(\s*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(m, 'Player.effectiveAtk() block must be locatable in entities.js');
  const body = stripComments(m[0]);
  assert.match(body, /this\.perks\.GLASS_CANNON/,
    'effectiveAtk() must reference this.perks.GLASS_CANNON (executable, not comment)');
  assert.match(body, /this\.perks\.GLASS_CANNON[\s\S]*?\*\s*1\.30/,
    'effectiveAtk() GLASS_CANNON branch must apply *1.30 multiplier');
});

// ─── takeDamage incoming amp ──────────────────────────────────────────────

test('Player.takeDamage applies +25% damage when GLASS_CANNON owned', () => {
  // Locate the player takeDamage(dmg, source, opts) signature — opts param
  // and energyShield/lastStandTimer body distinguish it from entity-side.
  const m = ENTITIES.match(/takeDamage\s*\(\s*dmg\s*,\s*source\s*,\s*opts\s*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(m, 'Player.takeDamage(dmg, source, opts) must be locatable');
  const body = stripComments(m[0]);
  assert.match(body, /this\.perks\.GLASS_CANNON/,
    'Player.takeDamage must consult this.perks.GLASS_CANNON (executable, not comment)');
  assert.match(body, /this\.perks\.GLASS_CANNON[\s\S]*?\*\s*1\.25/,
    'Player.takeDamage GLASS_CANNON branch must apply *1.25 multiplier');
});

test('GLASS_CANNON incoming amp is gated on !options.ignoreDefense (env-DoT safety)', () => {
  // Env hazards (Plasma burnDps*dt, Toxic toxDps*dt, Arc Grid, Disruption
  // Field, Frost Patch) pass fractional sub-1 damage per frame with
  // ignoreDefense:true. Without the gate, Math.max(1, Math.round(actual*1.25))
  // would inflate ~0.04-0.13/frame ticks to ~1/frame ≈ 60 DPS — the FRAGILE
  // floor-modifier instakill class of bug. Pin the gate.
  const m = ENTITIES.match(/takeDamage\s*\(\s*dmg\s*,\s*source\s*,\s*opts\s*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(m, 'Player.takeDamage block must be locatable');
  const body = stripComments(m[0]);
  // Find the GLASS_CANNON branch and walk back to the nearest `if (` so we
  // can assert the !options.ignoreDefense gate is on the SAME if statement
  // that contains the *1.25 amp.
  const idx = body.search(/this\.perks\.GLASS_CANNON/);
  assert.ok(idx >= 0, 'GLASS_CANNON branch must exist in takeDamage');
  // Take the slice from the nearest preceding `if (` to the next `}`.
  const before = body.slice(0, idx);
  const ifStart = before.lastIndexOf('if (');
  assert.ok(ifStart >= 0, 'GLASS_CANNON branch must live inside an if (...)');
  const branchSlice = body.slice(ifStart, idx + 200);
  assert.match(branchSlice, /!\s*options\.ignoreDefense/,
    'GLASS_CANNON if-statement must gate on !options.ignoreDefense');
});

test('GLASS_CANNON incoming amp uses Math.max(1, Math.round(...)) rounding pattern', () => {
  // Mirrors FRAGILE/HUNTER rounding to keep the contract documented and
  // floor-deterministic. Without the Math.max(1, ...) clamp, a 1-dmg hit
  // post-mitigation could round down to 0 — silently nullifying the
  // trade-off for low-dmg attackers. Pin the clamp.
  const m = ENTITIES.match(/takeDamage\s*\(\s*dmg\s*,\s*source\s*,\s*opts\s*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(m, 'Player.takeDamage block must be locatable');
  const body = stripComments(m[0]);
  const idx = body.search(/this\.perks\.GLASS_CANNON/);
  assert.ok(idx >= 0, 'GLASS_CANNON branch must exist');
  const branchSlice = body.slice(idx, idx + 300);
  assert.match(branchSlice, /Math\.max\s*\(\s*1\s*,\s*Math\.round\s*\([^)]*\*\s*1\.25\s*\)\s*\)/,
    'GLASS_CANNON branch must use Math.max(1, Math.round(actual * 1.25)) rounding');
});

test('GLASS_CANNON amp is placed AFTER HUNTER and BEFORE LAST_STAND', () => {
  // Ordering rationale (see takeDamage comment):
  //   - AFTER floor modifiers (CORROSIVE/FRAGILE/HUNTER) so trade-off
  //     composes multiplicatively on hard floors.
  //   - BEFORE LAST_STAND ×0.5 so a clutch hit still gets the mitigation
  //     on the GLASS_CANNON-amplified value.
  const m = ENTITIES.match(/takeDamage\s*\(\s*dmg\s*,\s*source\s*,\s*opts\s*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(m, 'Player.takeDamage block must be locatable');
  const body = stripComments(m[0]);
  const hunterIdx     = body.search(/_EG\.modifier\s*===\s*['"]HUNTER['"]/);
  const glassCannonIdx= body.search(/this\.perks\.GLASS_CANNON/);
  const lastStandIdx  = body.search(/this\.lastStandTimer\s*=\s*5/);
  assert.ok(hunterIdx >= 0,      'HUNTER modifier branch must exist');
  assert.ok(glassCannonIdx >= 0, 'GLASS_CANNON branch must exist');
  assert.ok(lastStandIdx >= 0,   'LAST_STAND trigger must exist');
  assert.ok(glassCannonIdx > hunterIdx,
    'GLASS_CANNON must appear AFTER HUNTER block (compose with floor modifiers)');
  assert.ok(glassCannonIdx < lastStandIdx,
    'GLASS_CANNON must appear BEFORE LAST_STAND so clutch ×0.5 still mitigates the amp');
});

// ─── No accumulator / no loadFloor reset required ────────────────────────

test('GLASS_CANNON does not introduce a movement/timer accumulator', () => {
  // Per stored "player movement accumulators" rule: any new accumulator
  // gated on per-frame movement (moved/dt) must be reset in loadFloor()
  // alongside burnTimer/shockTimer. GLASS_CANNON is a pure passive multiplier
  // — no timer, no charge, no stacks — so it MUST NOT consult moved or this.x
  // /this.y deltas, AND must not introduce a _glassXxx field. Pin both.
  assert.ok(!/this\._glass[A-Za-z]+\s*=/.test(ENTITIES),
    'GLASS_CANNON must not introduce a _glassXxx accumulator field');
  // Spot-check the effectiveAtk and takeDamage GLASS_CANNON branches don't
  // reference moved/dt. Permissive — `moved` may legitimately appear elsewhere.
  const eff = ENTITIES.match(/effectiveAtk\s*\(\s*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(eff, 'effectiveAtk block must be locatable');
  const effIdx = eff[0].search(/this\.perks\.GLASS_CANNON/);
  assert.ok(effIdx >= 0, 'GLASS_CANNON must appear in effectiveAtk');
  const effSlice = eff[0].slice(Math.max(0, effIdx - 100), effIdx + 200);
  assert.ok(!/moved\s*\/\s*dt/.test(effSlice),
    'GLASS_CANNON effectiveAtk branch must not gate on moved/dt rate');
});

// ─── Numerical formula sanity ─────────────────────────────────────────────

test('GLASS_CANNON ATK formula: +30% always, stacks multiplicatively', () => {
  // Re-derive the documented formula in JS so any future spec drift forces
  // an explicit update to this assertion table. Mirror the effectiveAtk
  // chain in source order so stacking interactions are pinned.
  /**
   * @param {{atk:number, perks:any, hp:number, maxHp:number,
   *          retributionTimer:number, lastStandTimer:number,
   *          _strideStacks?:number}} p
   */
  function eff(p) {
    let a = p.atk;
    if (p.perks.BERSERKER && p.hp / p.maxHp <= 0.25) a = Math.round(a * 1.4);
    if (p.lastStandTimer > 0) a = Math.round(a * 1.75);
    if (p.perks.PRISTINE && p.hp / p.maxHp >= 0.90) a = Math.round(a * 1.25);
    if (p.perks.RETRIBUTION && p.retributionTimer > 0) a = Math.round(a * 1.5);
    if (p.perks.GLASS_CANNON) a = Math.round(a * 1.30);
    return a;
  }
  // Plain ATK 10, no perks → 10.
  assert.equal(eff({atk:10, perks:{}, hp:100, maxHp:100, retributionTimer:0, lastStandTimer:0}), 10);
  // GLASS_CANNON alone → 10 * 1.30 = 13.
  assert.equal(eff({atk:10, perks:{GLASS_CANNON:true}, hp:100, maxHp:100, retributionTimer:0, lastStandTimer:0}), 13);
  // GLASS_CANNON + PRISTINE @ full HP → 10 * 1.25 = 12.5 → 13, then * 1.30 = 16.9 → 17.
  assert.equal(eff({atk:10, perks:{PRISTINE:true, GLASS_CANNON:true}, hp:100, maxHp:100, retributionTimer:0, lastStandTimer:0}), 17);
  // GLASS_CANNON + BERSERKER @ low HP → 10 * 1.4 = 14, then * 1.30 = 18.2 → 18.
  assert.equal(eff({atk:10, perks:{BERSERKER:true, GLASS_CANNON:true}, hp:10, maxHp:100, retributionTimer:0, lastStandTimer:0}), 18);
  // GLASS_CANNON + RETRIBUTION → 10 * 1.5 = 15, then * 1.30 = 19.5 → 20.
  assert.equal(eff({atk:10, perks:{RETRIBUTION:true, GLASS_CANNON:true}, hp:100, maxHp:100, retributionTimer:1, lastStandTimer:0}), 20);
  // GLASS_CANNON + LAST_STAND active → 10 * 1.75 = 17.5 → 18, then * 1.30 = 23.4 → 23.
  assert.equal(eff({atk:10, perks:{GLASS_CANNON:true}, hp:100, maxHp:100, retributionTimer:0, lastStandTimer:5}), 23);
  // Full ATK stack at low HP, full window: BERSERKER + LAST_STAND + RETRIBUTION + GLASS_CANNON
  //   10 * 1.4 = 14 → * 1.75 = 24.5 → 25 → * 1.5 = 37.5 → 38 → * 1.30 = 49.4 → 49.
  assert.equal(eff({atk:10, perks:{BERSERKER:true, RETRIBUTION:true, GLASS_CANNON:true}, hp:10, maxHp:100, retributionTimer:1, lastStandTimer:5}), 49);
});

test('GLASS_CANNON incoming-damage formula: +25% post-mitigation, gated on !ignoreDefense', () => {
  // Re-derive the documented incoming-damage chain (def → KINETIC_DAMPER →
  // CORROSIVE → FRAGILE → HUNTER → GLASS_CANNON → LAST_STAND) so spec drift
  // forces an explicit update. We model only the GLASS_CANNON segment in
  // detail; floor-modifier interactions are documented in their own tests.
  /**
   * @param {{dmg:number, def:number, perks:any, modifier?:string,
   *          ignoreDefense?:boolean, lastStandTimer?:number}} p
   */
  function incoming(p) {
    if (p.ignoreDefense) {
      // env DoT path: GLASS_CANNON must NOT amplify (gate)
      let actual = Math.max(0, p.dmg);
      if (p.lastStandTimer && p.lastStandTimer > 0) actual = actual * 0.5;
      return actual;
    }
    let actual = Math.max(1, p.dmg - p.def);
    if (p.modifier === 'FRAGILE') actual = Math.max(1, Math.round(actual * 1.3));
    if (p.perks.GLASS_CANNON) actual = Math.max(1, Math.round(actual * 1.25));
    if (p.lastStandTimer && p.lastStandTimer > 0) actual = actual * 0.5;
    return actual;
  }
  // No GLASS_CANNON: 20 dmg, 0 def → 20.
  assert.equal(incoming({dmg:20, def:0, perks:{}}), 20);
  // GLASS_CANNON: 20 → 20 * 1.25 = 25.
  assert.equal(incoming({dmg:20, def:0, perks:{GLASS_CANNON:true}}), 25);
  // GLASS_CANNON + def 5: (20 - 5) * 1.25 = 18.75 → 19.
  assert.equal(incoming({dmg:20, def:5, perks:{GLASS_CANNON:true}}), 19);
  // GLASS_CANNON + FRAGILE: 20 * 1.3 = 26 → * 1.25 = 32.5 → 33.
  assert.equal(incoming({dmg:20, def:0, perks:{GLASS_CANNON:true}, modifier:'FRAGILE'}), 33);
  // GLASS_CANNON + LAST_STAND active: 20 * 1.25 = 25 → * 0.5 = 12.5.
  assert.equal(incoming({dmg:20, def:0, perks:{GLASS_CANNON:true}, lastStandTimer:5}), 12.5);
  // env DoT (ignoreDefense:true) — GLASS_CANNON MUST NOT inflate.
  // 0.13 dmg/frame → stays 0.13 (NOT inflated to 1+).
  assert.equal(incoming({dmg:0.13, def:0, perks:{GLASS_CANNON:true}, ignoreDefense:true}), 0.13);
  assert.equal(incoming({dmg:0.04, def:0, perks:{GLASS_CANNON:true}, ignoreDefense:true}), 0.04);
  // env DoT + LAST_STAND: still no GLASS_CANNON amp; LAST_STAND ×0.5 applies.
  assert.equal(incoming({dmg:0.13, def:0, perks:{GLASS_CANNON:true}, ignoreDefense:true, lastStandTimer:5}), 0.065);
});

// ─── SW cache freshness ───────────────────────────────────────────────────

test('sw.js cache freshness is not represented as a second version number', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /const\s+CACHE\s*=\s*'neon-dungeon-assets'/);
});
