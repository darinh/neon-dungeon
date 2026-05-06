'use strict';
// RETRIBUTION perk — wiring + behaviour tests.
//
// RETRIBUTION is a reactive offensive perk: when Player.takeDamage applies
// real (non-absorbed) damage, retributionTimer is set to 3s and
// effectiveAtk() returns atk * 1.5 while the timer is positive.
//
// Distinct from sibling damage-mod perks:
//   - BERSERKER  : passive, +40% ATK at <=25% HP        (HP threshold)
//   - PRISTINE   : passive, +25% ATK at >=90% HP        (HP threshold)
//   - LAST_STAND : triggered, +75%/-50% at <=10% HP, 60s CD (panic button)
//   - RETRIBUTION: triggered on damage taken, +50% for 3s, no CD (reactive)
//
// Self-clearing: retributionTimer is dt-decay, movement-independent — no
// loadFloor reset required (descend-warp can't inflate a wall-clock
// countdown the way it inflates the moved/dt rate that gates STRIDE/HUNTER).
//
// Named RETRIBUTION (not VENGEANCE) to avoid player-facing collision with
// the existing VENGEANCE mob (entities.js:303 retaliator). The two share
// no code paths — different namespaces (PERK_POOL vs entity types) — but
// the rename keeps UX unambiguous.
//
// Source-text wiring tests (entities.js / content.js are browser-only —
// no UMD/CommonJS exports — same pattern as overdrive / stride tests).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ENTITIES = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8');
const CONTENT  = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'content.js'),  'utf8');
const SW       = fs.readFileSync(path.resolve(__dirname, '..', 'sw.js'),              'utf8');

// Strip JS comments before regex assertions so a `// this.retributionTimer = 3`
// commented-out gate can't satisfy a presence check (mark-affix /
// reverse-polarity / bulwark / hot-hand / glass-cannon precedent).
/** @param {string} src */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const ENTITIES_NC = stripComments(ENTITIES);
const CONTENT_NC  = stripComments(CONTENT);

// ─── PERK_POOL entry ──────────────────────────────────────────────────────

test('RETRIBUTION is registered in PERK_POOL with name/icon/desc/colour', () => {
  const pool = CONTENT_NC.match(/const\s+PERK_POOL\s*=\s*\{[\s\S]*?\n\};/);
  assert.ok(pool, 'PERK_POOL block must be locatable in content.js (post-strip)');
  assert.match(pool[0], /RETRIBUTION\s*:\s*\{[^}]*name\s*:\s*['"]Retribution['"]/,
    'PERK_POOL.RETRIBUTION must declare name "Retribution"');
  assert.match(pool[0], /RETRIBUTION\s*:\s*\{[^}]*icon\s*:/,
    'PERK_POOL.RETRIBUTION must declare an icon');
  assert.match(pool[0], /RETRIBUTION\s*:\s*\{[^}]*desc\s*:/,
    'PERK_POOL.RETRIBUTION must declare a desc');
  assert.match(pool[0], /RETRIBUTION\s*:\s*\{[^}]*colour\s*:/,
    'PERK_POOL.RETRIBUTION must declare a colour');
});

test('RETRIBUTION name does not collide with VENGEANCE mob', () => {
  // The VENGEANCE retaliator mob (entities.js:303) shares no code path but
  // shares the natural-language concept. Pin the rename so a future drift
  // back to "VENGEANCE" doesn't quietly create player-facing ambiguity.
  // Strip comments so a `// VENGEANCE: { ... }` reference doesn't trip the guard.
  const pool = CONTENT_NC.match(/const\s+PERK_POOL\s*=\s*\{[\s\S]*?\n\};/);
  assert.ok(pool, 'PERK_POOL block must be locatable');
  assert.ok(!/VENGEANCE\s*:\s*\{/.test(pool[0]),
    'PERK_POOL must NOT declare a VENGEANCE entry (collides with mob name)');
});

// ─── Player state initialisation ──────────────────────────────────────────

test('Player constructor initialises this.retributionTimer = 0', () => {
  // Must be initialised in the Player constructor so save/load and reset
  // paths see a defined value (not undefined). Sibling timers (cloakTimer,
  // lastStandTimer) follow the same pattern.
  assert.match(ENTITIES_NC, /this\.retributionTimer\s*=\s*0\s*;/,
    'Player constructor must initialise retributionTimer to 0 in EXECUTABLE code');
});

// ─── effectiveAtk hook ────────────────────────────────────────────────────

test('RETRIBUTION is wired into Player.effectiveAtk()', () => {
  const m = ENTITIES_NC.match(/effectiveAtk\s*\(\s*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(m, 'Player.effectiveAtk() block must be locatable in entities.js (post-strip)');
  assert.match(m[0], /this\.perks\.RETRIBUTION/,
    'effectiveAtk() must reference this.perks.RETRIBUTION in EXECUTABLE code');
  assert.match(m[0], /this\.retributionTimer\s*>\s*0/,
    'effectiveAtk() must gate RETRIBUTION on retributionTimer > 0 in EXECUTABLE code');
  assert.match(m[0], /\*\s*1\.5/,
    'effectiveAtk() RETRIBUTION branch must apply *1.5 multiplier in EXECUTABLE code');
});

// ─── takeDamage trigger ───────────────────────────────────────────────────

test('Player.takeDamage arms retributionTimer = 3 when perk owned', () => {
  // Locate the player takeDamage(dmg, source, opts) signature (NOT the
  // entity-side takeDamage(dmg, hitCtx) signature). Identify by the opts
  // parameter and the player-specific energyShield/lastStandTimer body.
  const m = ENTITIES_NC.match(/takeDamage\s*\(\s*dmg\s*,\s*source\s*,\s*opts\s*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(m, 'Player.takeDamage(dmg, source, opts) must be locatable (post-strip)');
  assert.match(m[0], /this\.perks\.RETRIBUTION/,
    'Player.takeDamage must consult this.perks.RETRIBUTION in EXECUTABLE code');
  assert.match(m[0], /this\.retributionTimer\s*=\s*3\b/,
    'Player.takeDamage must set retributionTimer to 3 (seconds) on real hits in EXECUTABLE code');
});

test('RETRIBUTION trigger placed AFTER hp deduction (so absorbed hits do not arm)', () => {
  // Early-return paths in takeDamage:
  //   - invincibleTimer > 0 (dash i-frames)
  //   - PHASE CLOAK immunity
  //   - SHIELD DRIVER absorb
  //   - ENERGY_SHIELD perk absorb
  //   - actual <= 0 (after def/CORROSIVE/FRAGILE/HUNTER mitigation)
  // All return BEFORE the hp deduction. So gating the trigger on a position
  // after `this.hp = Math.max(0, this.hp - actual)` automatically inherits
  // the early-returns and only fires on real damage taken.
  const m = ENTITIES_NC.match(/takeDamage\s*\(\s*dmg\s*,\s*source\s*,\s*opts\s*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(m, 'Player.takeDamage block must be locatable (post-strip)');
  const body = m[0];
  const hpDedIdx       = body.indexOf('this.hp=Math.max(0,this.hp-actual)');
  const retributionIdx = body.search(/this\.retributionTimer\s*=\s*3/);
  assert.ok(hpDedIdx >= 0,       'hp deduction line must exist in EXECUTABLE code');
  assert.ok(retributionIdx >= 0, 'RETRIBUTION trigger line must exist in EXECUTABLE code');
  assert.ok(retributionIdx > hpDedIdx,
    'RETRIBUTION trigger must appear AFTER hp deduction so absorbed hits do not arm');
});

// ─── Per-frame decay ──────────────────────────────────────────────────────

test('Player.update decays retributionTimer by dt (movement-independent)', () => {
  // Decay must use Math.max(0, x - dt) — same idiom as lastStandTimer /
  // reactiveArmorCD — so 30/60/120 fps expire at the same wall-clock time.
  // Movement-independent dt-decay sidesteps the descend-warp inflation
  // class of bug (per stored player-movement-accumulator rule).
  assert.match(ENTITIES_NC,
    /this\.retributionTimer\s*=\s*Math\.max\s*\(\s*0\s*,\s*this\.retributionTimer\s*-\s*dt\s*\)/,
    'Player.update must decay retributionTimer via Math.max(0, retributionTimer - dt) in EXECUTABLE code');
});

// ─── Numerical formula sanity ─────────────────────────────────────────────

test('RETRIBUTION formula: +50% ATK while timer > 0, 0 otherwise', () => {
  // Re-derive the documented formula in JS so any future spec drift forces
  // an explicit update to this assertion table. Mirror the effectiveAtk
  // chain so stacking interactions are pinned.
  /**
   * @param {{atk:number, perks:any, hp:number, maxHp:number, retributionTimer:number}} p
   */
  function eff(p) {
    let a = p.atk;
    if (p.perks.BERSERKER && p.hp / p.maxHp <= 0.25) a = Math.round(a * 1.4);
    if (p.perks.PRISTINE && p.hp / p.maxHp >= 0.90) a = Math.round(a * 1.25);
    if (p.perks.RETRIBUTION && p.retributionTimer > 0) a = Math.round(a * 1.5);
    return a;
  }
  // Plain ATK 10, no perks → 10.
  assert.equal(eff({atk:10, perks:{}, hp:100, maxHp:100, retributionTimer:0}), 10);
  // RETRIBUTION owned, timer 0 (no damage taken yet) → no buff.
  assert.equal(eff({atk:10, perks:{RETRIBUTION:true}, hp:100, maxHp:100, retributionTimer:0}), 10);
  // RETRIBUTION owned, timer 1.5s (mid-window) → 10 * 1.5 = 15.
  assert.equal(eff({atk:10, perks:{RETRIBUTION:true}, hp:100, maxHp:100, retributionTimer:1.5}), 15);
  // RETRIBUTION owned, timer 0.001s (about-to-expire) → still buffed (>0 gate).
  assert.equal(eff({atk:10, perks:{RETRIBUTION:true}, hp:100, maxHp:100, retributionTimer:0.001}), 15);
  // PRISTINE + RETRIBUTION @ full HP, mid-window → 10 * 1.25 = 12.5 → 13, then * 1.5 = 19.5 → 20.
  assert.equal(eff({atk:10, perks:{PRISTINE:true, RETRIBUTION:true}, hp:100, maxHp:100, retributionTimer:1}), 20);
  // BERSERKER + RETRIBUTION @ low HP, mid-window → 10 * 1.4 = 14, then * 1.5 = 21.
  assert.equal(eff({atk:10, perks:{BERSERKER:true, RETRIBUTION:true}, hp:10, maxHp:100, retributionTimer:1}), 21);
});

// ─── Distinctness from siblings ───────────────────────────────────────────

test('RETRIBUTION is independent state — does not collide with lastStandTimer', () => {
  // RETRIBUTION and LAST_STAND are deliberately separate timers. Sharing a
  // backing field would make a Retribution refresh accidentally also reset
  // the LAST_STAND clutch window, or vice-versa. Pin the field-name split.
  assert.ok(/this\.lastStandTimer\s*=\s*0\s*;/.test(ENTITIES_NC),
    'lastStandTimer must remain its own field (regression guard) in EXECUTABLE code');
  assert.ok(/this\.retributionTimer\s*=\s*0\s*;/.test(ENTITIES_NC),
    'retributionTimer must be its own field (regression guard) in EXECUTABLE code');
});

// ─── No movement-rate accumulator was introduced ──────────────────────────

test('RETRIBUTION does not introduce a movement-rate accumulator (dt-decay only)', () => {
  // Per stored "player movement accumulators" rule: any new accumulator
  // gated on per-frame movement (moved/dt) must be reset in loadFloor()
  // alongside burnTimer/shockTimer, otherwise descend-warp inflates the
  // rate. RETRIBUTION is a wall-clock countdown — it MUST NOT consult moved
  // or this.x/this.y deltas. Pin that decision.
  const triggerIdx = ENTITIES_NC.search(/this\.retributionTimer\s*=\s*3/);
  const decayIdx   = ENTITIES_NC.search(/this\.retributionTimer\s*=\s*Math\.max/);
  assert.ok(triggerIdx >= 0 && decayIdx >= 0, 'both RETRIBUTION sites must exist (post-strip)');
  const triggerSlice = ENTITIES_NC.slice(Math.max(0, triggerIdx - 300), triggerIdx + 300);
  const decaySlice   = ENTITIES_NC.slice(Math.max(0, decayIdx   - 300), decayIdx   + 300);
  // Permissive — `moved` may legitimately appear elsewhere in update();
  // we only care that RETRIBUTION itself doesn't gate on movement rate.
  assert.ok(!/moved\s*\/\s*dt/.test(triggerSlice),
    'RETRIBUTION trigger must not gate on moved/dt rate');
  assert.ok(!/moved\s*\/\s*dt/.test(decaySlice),
    'RETRIBUTION decay must not gate on moved/dt rate');
});

// ─── SW cache freshness ───────────────────────────────────────────────────

test('sw.js cache freshness is not tied to a manual numeric cache version', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /cacheFromNetwork\(e\)/);
});
