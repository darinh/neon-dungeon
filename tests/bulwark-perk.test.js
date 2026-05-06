'use strict';
// BULWARK perk — wiring + behaviour tests.
//
// BULWARK is a passive defensive perk: while at or above 75% HP, take 15%
// less damage from all sources. The defensive counterpart to PRISTINE
// (+25% ATK at >=90% HP). Implemented as a pure multiplier in
// Player.takeDamage with NO Math.max(1, …) clamp — mirrors LAST_STAND ×0.5
// design so env DoT (Plasma/Toxic/Arc/Disruption/Frost) ticks at fractional
// values are not inflated to ~60 DPS by a max(1) wrap.
//
// Distinct from sibling defensive sources:
//   - THICK_ARMOR (perk)        : +3 DEF flat, applies to direct hits only
//   - TITANIUM_PLATING (augment): -1 flat reduction, direct hits only
//   - KINETIC_DAMPER (augment)  : -20% direct-hit damage (gated)
//   - LAST_STAND (perk)         : -50% triggered at <=10% HP, 60s CD
//   - ENERGY_SHIELD (perk)      : absorb one hit / 30s
//   - BULWARK (perk)            : -15% all damage at >=75% HP (passive)
//
// HP threshold check uses pre-deduction this.hp (mirrors PRISTINE pattern)
// so the hit that crosses BELOW 75% still gets the reduction.
//
// Source-text wiring tests (entities.js / content.js are browser-only —
// no UMD/CommonJS exports — same pattern as glass-cannon / retribution /
// pristine tests).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ENTITIES = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8');
const CONTENT  = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'content.js'),  'utf8');

// Strip JS comments before regex assertions so a "// if (this.perks.X)" comment
// can't satisfy a gate-presence check (mark-affix / reverse-polarity precedent).
/** @param {string} src */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

// ─── PERK_POOL entry ──────────────────────────────────────────────────────

test('BULWARK is registered in PERK_POOL with name/icon/desc/colour', () => {
  const pool = CONTENT.match(/const\s+PERK_POOL\s*=\s*\{[\s\S]*?\n\};/);
  assert.ok(pool, 'PERK_POOL block must be locatable in content.js');
  assert.match(pool[0], /BULWARK\s*:\s*\{[^}]*name\s*:\s*['"]Bulwark['"]/,
    'PERK_POOL.BULWARK must declare name "Bulwark"');
  assert.match(pool[0], /BULWARK\s*:\s*\{[^}]*icon\s*:/,
    'PERK_POOL.BULWARK must declare an icon');
  assert.match(pool[0], /BULWARK\s*:\s*\{[^}]*desc\s*:/,
    'PERK_POOL.BULWARK must declare a desc');
  assert.match(pool[0], /BULWARK\s*:\s*\{[^}]*colour\s*:/,
    'PERK_POOL.BULWARK must declare a colour');
});

// ─── takeDamage hook ──────────────────────────────────────────────────────

test('Player.takeDamage applies *0.85 when BULWARK owned and HP >= 75%', () => {
  const m = ENTITIES.match(/takeDamage\s*\(\s*dmg\s*,\s*source\s*,\s*opts\s*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(m, 'Player.takeDamage(dmg, source, opts) must be locatable');
  const body = stripComments(m[0]);
  assert.match(body, /this\.perks\.BULWARK/,
    'Player.takeDamage must consult this.perks.BULWARK (executable, not comment)');
  assert.match(body, /this\.perks\.BULWARK[\s\S]*?this\.hp\s*\/\s*this\.maxHp\s*>=\s*0\.75/,
    'BULWARK branch must gate on this.hp / this.maxHp >= 0.75');
  assert.match(body, /this\.perks\.BULWARK[\s\S]*?\*\s*0\.85/,
    'BULWARK branch must apply *0.85 multiplier');
});

test('BULWARK uses pure multiplier (NO Math.max(1, …) clamp — env DoT safety)', () => {
  // Env hazards (Plasma burnDps*dt, Toxic toxDps*dt, Arc Grid, Disruption
  // Field, Frost Patch) pass fractional sub-1 damage per frame with
  // ignoreDefense:true. A Math.max(1, Math.round(0.13 * 0.85)) clamp would
  // inflate ~0.13/frame env DoT to ~1/frame ≈ 60 DPS instakill. The
  // BULWARK branch MUST mirror LAST_STAND's clampless pattern. Pin it.
  const m = ENTITIES.match(/takeDamage\s*\(\s*dmg\s*,\s*source\s*,\s*opts\s*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(m, 'Player.takeDamage block must be locatable');
  const body = stripComments(m[0]);
  const idx = body.search(/this\.perks\.BULWARK/);
  assert.ok(idx >= 0, 'BULWARK branch must exist');
  const branchSlice = body.slice(idx, idx + 300);
  // Must NOT use Math.max(1, ...) clamp on the *0.85 line.
  assert.ok(!/Math\.max\s*\(\s*1\s*,\s*Math\.round\s*\([^)]*\*\s*0\.85/.test(branchSlice),
    'BULWARK branch must NOT use Math.max(1, Math.round(...*0.85)) clamp (would inflate env DoT)');
  // Must apply pure *0.85 multiplier.
  assert.match(branchSlice, /actual\s*=\s*actual\s*\*\s*0\.85/,
    'BULWARK branch must apply pure `actual = actual * 0.85` (no clamp)');
});

test('BULWARK is placed AFTER LAST_STAND and BEFORE hp deduction', () => {
  // Placement rationale: AFTER all amp blocks (CORROSIVE/FRAGILE/HUNTER/
  // GLASS_CANNON) so BULWARK reduces final amplified damage. AFTER
  // LAST_STAND ×0.5 (commutative — both pure multipliers — so order doesn't
  // matter mathematically; BULWARK chosen as the final defense layer per
  // the in-source comment). BEFORE the hp deduction (otherwise the
  // reduction is a no-op).
  const m = ENTITIES.match(/takeDamage\s*\(\s*dmg\s*,\s*source\s*,\s*opts\s*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(m, 'Player.takeDamage block must be locatable');
  const body = stripComments(m[0]);
  const lastStandIdx = body.search(/this\.lastStandTimer\s*>\s*0\)\s*actual\s*=\s*actual\s*\*\s*0\.5/);
  const bulwarkIdx   = body.search(/this\.perks\.BULWARK/);
  const hpDedIdx     = body.indexOf('this.hp=Math.max(0,this.hp-actual)');
  assert.ok(lastStandIdx >= 0, 'LAST_STAND ×0.5 line must exist');
  assert.ok(bulwarkIdx   >= 0, 'BULWARK branch must exist');
  assert.ok(hpDedIdx     >= 0, 'hp deduction line must exist');
  assert.ok(bulwarkIdx > lastStandIdx,
    'BULWARK must appear AFTER LAST_STAND ×0.5 (final defense layer)');
  assert.ok(bulwarkIdx < hpDedIdx,
    'BULWARK must appear BEFORE hp deduction (otherwise the reduction is a no-op)');
});

test('BULWARK gates on this.maxHp > 0 (divide-by-zero guard)', () => {
  // Defensive guard: this.hp / this.maxHp can NaN if maxHp is somehow 0
  // (shouldn't happen, but PRISTINE / BERSERKER both elide this guard,
  // making them implicitly relying on maxHp invariants). BULWARK pins
  // the guard explicitly because the takeDamage path is on the critical
  // damage flow — a NaN comparison would silently disable the perk.
  const m = ENTITIES.match(/takeDamage\s*\(\s*dmg\s*,\s*source\s*,\s*opts\s*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(m, 'Player.takeDamage block must be locatable');
  const body = stripComments(m[0]);
  const idx = body.search(/this\.perks\.BULWARK/);
  assert.ok(idx >= 0, 'BULWARK branch must exist');
  const branchSlice = body.slice(idx, idx + 200);
  assert.match(branchSlice, /this\.maxHp\s*>\s*0/,
    'BULWARK if-condition must include `this.maxHp > 0` divide-by-zero guard');
});

// ─── No accumulator / no loadFloor reset required ────────────────────────

test('BULWARK does not introduce a movement/timer accumulator', () => {
  // Per stored "player movement accumulators" rule: any new accumulator
  // gated on per-frame movement (moved/dt) must be reset in loadFloor()
  // alongside burnTimer/shockTimer. BULWARK is a pure passive multiplier
  // — no timer, no charge, no stacks — so it MUST NOT consult moved or
  // this.x/this.y deltas, AND must not introduce a _bulwarkXxx field.
  assert.ok(!/this\._bulwark[A-Za-z]+\s*=/.test(ENTITIES),
    'BULWARK must not introduce a _bulwarkXxx accumulator field');
  // Spot-check the BULWARK takeDamage branch doesn't reference moved/dt.
  const m = ENTITIES.match(/takeDamage\s*\(\s*dmg\s*,\s*source\s*,\s*opts\s*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(m, 'takeDamage block must be locatable');
  const body = stripComments(m[0]);
  const idx = body.search(/this\.perks\.BULWARK/);
  assert.ok(idx >= 0, 'BULWARK must appear in takeDamage');
  const branchSlice = body.slice(Math.max(0, idx - 100), idx + 200);
  assert.ok(!/moved\s*\/\s*dt/.test(branchSlice),
    'BULWARK branch must not gate on moved/dt rate');
});

// ─── Numerical formula sanity ─────────────────────────────────────────────

test('BULWARK incoming-damage formula: *0.85 only at >=75% HP, no clamp', () => {
  // Re-derive the documented incoming-damage chain (def → CORROSIVE →
  // FRAGILE → HUNTER → GLASS_CANNON → LAST_STAND → BULWARK) so spec
  // drift forces an explicit update.
  /**
   * @param {{dmg:number, def:number, hp:number, maxHp:number, perks:any,
   *          modifier?:string, ignoreDefense?:boolean,
   *          lastStandTimer?:number}} p
   */
  function incoming(p) {
    let actual;
    if (p.ignoreDefense) {
      actual = Math.max(0, p.dmg);
    } else {
      actual = Math.max(1, p.dmg - p.def);
    }
    if (p.modifier === 'CORROSIVE' && !p.ignoreDefense) actual += 2;
    if (p.modifier === 'FRAGILE' && !p.ignoreDefense) actual = Math.max(1, Math.round(actual * 1.3));
    if (p.perks.GLASS_CANNON && !p.ignoreDefense) actual = Math.max(1, Math.round(actual * 1.25));
    if (actual <= 0) return 0;
    if (p.lastStandTimer && p.lastStandTimer > 0) actual = actual * 0.5;
    if (p.perks.BULWARK && p.maxHp > 0 && p.hp / p.maxHp >= 0.75) actual = actual * 0.85;
    return actual;
  }
  // No BULWARK: 20 dmg, 0 def, full HP → 20.
  assert.equal(incoming({dmg:20, def:0, hp:100, maxHp:100, perks:{}}), 20);
  // BULWARK at 100% HP → 20 * 0.85 = 17.
  assert.equal(incoming({dmg:20, def:0, hp:100, maxHp:100, perks:{BULWARK:true}}), 17);
  // BULWARK at exactly 75% HP → still active (>=, not >) → 20 * 0.85 = 17.
  assert.equal(incoming({dmg:20, def:0, hp:75, maxHp:100, perks:{BULWARK:true}}), 17);
  // BULWARK at 74% HP → inactive → 20.
  assert.equal(incoming({dmg:20, def:0, hp:74, maxHp:100, perks:{BULWARK:true}}), 20);
  // BULWARK + def 5: (20 - 5) * 0.85 = 12.75.
  assert.equal(incoming({dmg:20, def:5, hp:100, maxHp:100, perks:{BULWARK:true}}), 12.75);
  // BULWARK + GLASS_CANNON @ 100% HP: 20 * 1.25 = 25 → * 0.85 = 21.25.
  assert.equal(incoming({dmg:20, def:0, hp:100, maxHp:100, perks:{BULWARK:true, GLASS_CANNON:true}}), 21.25);
  // BULWARK + FRAGILE @ 100% HP: 20 * 1.3 = 26 → * 0.85 = 22.1.
  assert.ok(Math.abs(incoming({dmg:20, def:0, hp:100, maxHp:100, perks:{BULWARK:true}, modifier:'FRAGILE'}) - 22.1) < 1e-9,
    'BULWARK + FRAGILE: 20 * 1.3 * 0.85 ≈ 22.1');
  // env DoT (ignoreDefense:true) — BULWARK still applies (mirrors LAST_STAND):
  //   0.13 * 0.85 = 0.1105 — fractional preserved, NOT inflated to 1.
  assert.ok(Math.abs(incoming({dmg:0.13, def:0, hp:100, maxHp:100, perks:{BULWARK:true}, ignoreDefense:true}) - 0.1105) < 1e-9,
    'BULWARK on env DoT preserves fractional value (no Math.max clamp)');
  // env DoT WITHOUT BULWARK at high HP: 0.13 stays 0.13.
  assert.equal(incoming({dmg:0.13, def:0, hp:100, maxHp:100, perks:{}, ignoreDefense:true}), 0.13);
  // BULWARK at 0% HP edge: hp=0 → 0/maxHp = 0 < 0.75 → inactive.
  assert.equal(incoming({dmg:20, def:0, hp:0, maxHp:100, perks:{BULWARK:true}}), 20);
  // BULWARK + LAST_STAND active (theoretical — they're mutually exclusive
  // in normal play because BULWARK gates >=75% HP and LAST_STAND triggers
  // <=10% HP, but the math must still compose cleanly):
  //   20 * 0.5 (LAST_STAND) * 0.85 (BULWARK at high HP) = 8.5.
  assert.equal(incoming({dmg:20, def:0, hp:100, maxHp:100, perks:{BULWARK:true}, lastStandTimer:5}), 8.5);
});

test('BULWARK HP threshold uses pre-deduction HP (mirrors PRISTINE)', () => {
  // The hit that drops player from 76% to 50% HP STILL benefits from
  // BULWARK because the threshold check uses this.hp (pre-deduction).
  // This mirrors PRISTINE's effectiveAtk gate (`this.hp / this.maxHp >=
  // 0.90`) which also reads pre-attack HP. Pin the comparison position.
  const m = ENTITIES.match(/takeDamage\s*\(\s*dmg\s*,\s*source\s*,\s*opts\s*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(m, 'Player.takeDamage block must be locatable');
  const body = stripComments(m[0]);
  const bulwarkIdx = body.search(/this\.perks\.BULWARK/);
  const hpDedIdx   = body.indexOf('this.hp=Math.max(0,this.hp-actual)');
  assert.ok(bulwarkIdx >= 0 && hpDedIdx >= 0, 'both lines must exist');
  assert.ok(bulwarkIdx < hpDedIdx,
    'BULWARK HP-threshold check must occur BEFORE hp deduction (so threshold reads pre-hit HP)');
});

// ─── sw.js intentionally has no numeric cache assertion; see AGENTS.md.
