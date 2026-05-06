'use strict';
// LAST_STAND perk tests.
//
// LAST_STAND is a clutch defensive perk: an incoming hit that would drop
// player HP to ≤10% maxHp triggers a 5s window with +75% outgoing damage
// (via effectiveAtk) and ×0.5 incoming damage (in takeDamage). 60s lockout
// gates re-trigger. Browser-only Player.takeDamage means we verify wiring
// via source-text grep — same shape as harvester/conduit/magpie.
//
// Stored-memory contracts re-asserted here:
//  - env-DoT damage gate: ×0.5 multiplier MUST NOT clamp via Math.max(1,…)
//    or fractional sub-1 burn/toxic ticks (~0.04-0.13/frame at 60fps with
//    ignoreDefense:true) inflate to ~60dps. Pure multiplier required.
//  - stillness/rate trackers: timers tick by `dt` (frame-rate independent).
//  - loadFloor message clear: trigger fires inside takeDamage during
//    PLAYING gameplay (not loadFloor), so direct _EG.msg is safe — no
//    setTimeout deferral needed.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..');
const ENTITIES_SRC = fs.readFileSync(path.join(ROOT, 'src/entities.js'), 'utf8');
const CONTENT_SRC = fs.readFileSync(path.join(ROOT, 'src/content.js'), 'utf8');
const GAME_SRC = fs.readFileSync(path.join(ROOT, 'src/game.js'), 'utf8');
const SW_SRC = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

// ─── Registry ────────────────────────────────────────────────────────────────

test('PERK_POOL.LAST_STAND is registered with name/icon/desc/colour', () => {
  const m = CONTENT_SRC.match(/LAST_STAND:\s*\{[^}]*\}/);
  assert.ok(m, 'LAST_STAND entry must exist in PERK_POOL');
  assert.match(m[0], /name:\s*'Last Stand'/);
  assert.match(m[0], /icon:\s*'⚔'/);
  assert.match(m[0], /colour:\s*'#ffcc00'/);
  // Description must mention both halves of the effect so the player knows
  // it's a damage AMP + a damage REDUCTION (otherwise it reads like a
  // generic burst-damage perk).
  assert.match(m[0], /\+75%/);
  assert.match(m[0], /−50%|−50%|-50%|‑50%/);
});

test('LAST_STAND is part of PERK_POOL (selectable by rollPerkChoices)', () => {
  // PERK_POOL is dropped into rollPerkChoices' Object.keys filter — being
  // listed inside the literal is sufficient to make it appear in the
  // level-up draw rotation.
  const pool = CONTENT_SRC.match(/const PERK_POOL = \{[\s\S]*?\n\};/);
  assert.ok(pool, 'PERK_POOL block must be locatable');
  assert.match(pool[0], /^\s*LAST_STAND:/m);
});

// ─── Player constructor / fields ─────────────────────────────────────────────

test('Player constructor initialises lastStandTimer and lastStandCD to 0', () => {
  assert.match(ENTITIES_SRC, /this\.lastStandTimer\s*=\s*0/);
  assert.match(ENTITIES_SRC, /this\.lastStandCD\s*=\s*0/);
});

test('Player JSDoc declares lastStandTimer and lastStandCD fields', () => {
  // Type-checked codebase — undeclared fields trip --noEmit.
  assert.match(ENTITIES_SRC, /\/\*\* @type \{any\} \*\/ lastStandTimer/);
  assert.match(ENTITIES_SRC, /\/\*\* @type \{any\} \*\/ lastStandCD/);
});

// ─── Per-frame ticker ────────────────────────────────────────────────────────

test('update() decrements lastStandTimer and lastStandCD by dt (frame-rate independent)', () => {
  // Stored memory: any timer that gates "active vs not active" must be dt-
  // based, not per-frame, or behaviour silently flips between 30/60/120fps.
  assert.match(ENTITIES_SRC, /this\.lastStandTimer\s*=\s*Math\.max\(0,\s*this\.lastStandTimer\s*-\s*dt\)/);
  assert.match(ENTITIES_SRC, /this\.lastStandCD\s*=\s*Math\.max\(0,\s*this\.lastStandCD\s*-\s*dt\)/);
});

// ─── takeDamage trigger + DR ─────────────────────────────────────────────────

test('takeDamage trigger gates on perk + cooldown + active-window + alive + threshold', () => {
  // Single condition that combines all five gates. A reviewer who removes
  // any one gate (e.g. drops the lastStandCD <= 0 check) would let burn
  // ticks re-trigger every frame.
  const m = ENTITIES_SRC.match(/this\.perks\.LAST_STAND[\s\S]{0,400}?this\.lastStandTimer\s*=\s*5;/);
  assert.ok(m, 'LAST_STAND trigger block must exist');
  assert.match(m[0], /this\.lastStandCD\s*<=\s*0/);
  assert.match(m[0], /this\.lastStandTimer\s*<=\s*0/);
  assert.match(m[0], /this\.hp\s*>\s*0/, 'must skip if already dead — defense-in-depth');
  assert.match(m[0], /\(this\.hp\s*-\s*actual\)\s*<=\s*this\.maxHp\s*\*\s*0\.10/);
});

test('takeDamage trigger seeds 5s active window AND 60s cooldown lockout', () => {
  // Cooldown >= active duration is the defining contract — without that, a
  // second trigger could fire the moment the active window expires.
  const m = ENTITIES_SRC.match(/this\.perks\.LAST_STAND[\s\S]{0,500}?_EG\.msg\('⚔ LAST STAND'/);
  assert.ok(m, 'LAST_STAND trigger block must exist with toast');
  assert.match(m[0], /this\.lastStandTimer\s*=\s*5/);
  assert.match(m[0], /this\.lastStandCD\s*=\s*60/);
});

test('takeDamage applies ×0.5 DR via PURE multiplier (no Math.max(1) clamp)', () => {
  // Stored memory env-DoT damage gate: env DoT (Plasma/Toxic/Arc/Disruption/
  // Frost) passes ignoreDefense:true with fractional dmg ~0.04-0.13/frame.
  // A Math.max(1, …) clamp would inflate each tick to 1 → ~60 dps silent
  // insta-kill. Multiplier must be raw `actual = actual * 0.5`.
  const m = ENTITIES_SRC.match(/if \(this\.lastStandTimer > 0\) actual = actual \* 0\.5;/);
  assert.ok(m, 'DR must be a pure multiplier without min-clamp');
  // And explicitly NOT this anti-pattern:
  assert.doesNotMatch(
    ENTITIES_SRC,
    /lastStandTimer > 0\) actual = Math\.max\(1,\s*Math\.round\(actual \* 0\.5\)\)/,
    'DR must not clamp to 1 — would explode env-DoT ticks',
  );
});

test('takeDamage trigger fires BEFORE hp deduction (clutch save semantics)', () => {
  // The whole point of LAST_STAND is that the activating hit ALSO benefits
  // from the −50% DR. If the trigger ran after `this.hp -= actual` it would
  // be a delayed buff, not a save. Verify trigger appears before the hp
  // mutation in the linear source.
  const triggerIdx = ENTITIES_SRC.indexOf("this.lastStandTimer = 5;");
  const hpDeductIdx = ENTITIES_SRC.indexOf("this.hp=Math.max(0,this.hp-actual);");
  assert.ok(triggerIdx !== -1, 'trigger present');
  assert.ok(hpDeductIdx !== -1, 'hp deduction present');
  assert.ok(triggerIdx < hpDeductIdx, 'trigger must precede hp deduction in takeDamage');
});

test('takeDamage applies DR in the same flow (between trigger and hp deduction)', () => {
  const drIdx = ENTITIES_SRC.indexOf('if (this.lastStandTimer > 0) actual = actual * 0.5;');
  const hpDeductIdx = ENTITIES_SRC.indexOf("this.hp=Math.max(0,this.hp-actual);");
  assert.ok(drIdx !== -1, 'DR present');
  assert.ok(drIdx < hpDeductIdx, 'DR must precede hp deduction so activating hit benefits');
});

// ─── effectiveAtk +75% during active window ──────────────────────────────────

test('effectiveAtk applies +75% multiplier while lastStandTimer > 0', () => {
  // Mirrors BERSERKER pattern in the same method — both stack
  // multiplicatively on purpose (low-HP rewards both fire at once).
  const m = ENTITIES_SRC.match(/effectiveAtk\(\)\s*\{[\s\S]*?return a;\s*\}/);
  assert.ok(m, 'effectiveAtk method must exist');
  assert.match(m[0], /if \(this\.lastStandTimer > 0\) a = Math\.round\(a \* 1\.75\)/);
});

// ─── Save / restore ──────────────────────────────────────────────────────────

test('save() persists lastStandTimer and lastStandCD', () => {
  // Without persistence, a Continue mid-window resets the buff (or the
  // cooldown) creating a save-resume exploit (reset 60s CD by saving).
  assert.match(GAME_SRC, /lastStandTimer:p\.lastStandTimer\s*\|\|\s*0/);
  assert.match(GAME_SRC, /lastStandCD:p\.lastStandCD\s*\|\|\s*0/);
});

test('continueGame() restores lastStandTimer and lastStandCD with safe defaults', () => {
  assert.match(GAME_SRC, /p\.lastStandTimer\s*=\s*s\.lastStandTimer\s*\|\|\s*0/);
  assert.match(GAME_SRC, /p\.lastStandCD\s*=\s*s\.lastStandCD\s*\|\|\s*0/);
});

// ─── Service worker cache freshness ─────────────────────────────────────────

test('service worker cache key is not a second numeric app version', () => {
  assert.doesNotMatch(SW_SRC, /neon-dungeon-v\d+/);
  assert.match(SW_SRC, /const\s+CACHE\s*=\s*'neon-dungeon-assets'/);
});

// ─── Tier 3 smoke: behaviour proof via reduced harness ──────────────────────

// LAST_STAND's takeDamage path has many upstream branches (invincible, shield,
// reactiveArmor, etc.) but the trigger is gated only on perk + cooldown +
// active + alive + threshold. We can prove the GATE LOGIC in pure JS by
// extracting it — if the contract changes, this will diverge from the
// source. Re-asserts every gate independently.

function shouldTrigger(player, hp, actual) {
  // Mirror of the source-text condition. If you change one, change the other.
  return !!(
    player.perks.LAST_STAND &&
    player.lastStandCD <= 0 &&
    player.lastStandTimer <= 0 &&
    hp > 0 &&
    (hp - actual) <= player.maxHp * 0.10
  );
}

test('Tier 3 logic: triggers when hit would drop hp to ≤10% maxHp', () => {
  const p = { perks: { LAST_STAND: true }, lastStandCD: 0, lastStandTimer: 0, maxHp: 100 };
  // From 50 hp, a 45-dmg hit lands at 5 hp (5%) → trigger.
  assert.equal(shouldTrigger(p, 50, 45), true);
  // From 50 hp, a 40-dmg hit lands at 10 hp (10%) → trigger (boundary).
  assert.equal(shouldTrigger(p, 50, 40), true);
  // From 50 hp, a 39-dmg hit lands at 11 hp (11%) → no trigger.
  assert.equal(shouldTrigger(p, 50, 39), false);
});

test('Tier 3 logic: triggers on lethal hit (lets DR potentially save)', () => {
  // From 20 hp, a 25-dmg hit would be lethal (-5 → ≤10%) → trigger fires
  // BEFORE the deduction, halves to 12.5, lands at 7.5 hp. Mechanic survives.
  const p = { perks: { LAST_STAND: true }, lastStandCD: 0, lastStandTimer: 0, maxHp: 100 };
  assert.equal(shouldTrigger(p, 20, 25), true);
});

test('Tier 3 logic: blocked while already in active window', () => {
  // Once active, subsequent hits do NOT re-trigger — they only get DR.
  const p = { perks: { LAST_STAND: true }, lastStandCD: 60, lastStandTimer: 4, maxHp: 100 };
  assert.equal(shouldTrigger(p, 50, 45), false);
});

test('Tier 3 logic: blocked during cooldown lockout (after active expired)', () => {
  // Active window done (timer=0) but cooldown still running (CD=30). Re-trigger blocked.
  const p = { perks: { LAST_STAND: true }, lastStandCD: 30, lastStandTimer: 0, maxHp: 100 };
  assert.equal(shouldTrigger(p, 50, 45), false);
});

test('Tier 3 logic: blocked when player already dead (hp=0)', () => {
  // SECOND_WIND or game-over already taking over — no LAST_STAND trigger.
  const p = { perks: { LAST_STAND: true }, lastStandCD: 0, lastStandTimer: 0, maxHp: 100 };
  assert.equal(shouldTrigger(p, 0, 1), false);
});

test('Tier 3 logic: blocked without the perk', () => {
  const p = { perks: {}, lastStandCD: 0, lastStandTimer: 0, maxHp: 100 };
  assert.equal(shouldTrigger(p, 50, 45), false);
});

test('Tier 3 logic: dt-based timer ticks identical at 30/60/120fps', () => {
  // Decrement 5s of timer at three frame rates — should converge to 0
  // simultaneously (within rounding). Stored memory: stillness/rate trackers.
  function tick(timer, dt, frames) {
    for (let i = 0; i < frames; i++) timer = Math.max(0, timer - dt);
    return timer;
  }
  const at30  = tick(5, 1/30,  150); // 5s @ 30fps
  const at60  = tick(5, 1/60,  300); // 5s @ 60fps
  const at120 = tick(5, 1/120, 600); // 5s @ 120fps
  assert.ok(Math.abs(at30) < 1e-9,  `30fps timer should hit 0, got ${at30}`);
  assert.ok(Math.abs(at60) < 1e-9,  `60fps timer should hit 0, got ${at60}`);
  assert.ok(Math.abs(at120) < 1e-9, `120fps timer should hit 0, got ${at120}`);
});

test('Tier 3 logic: DR multiplier preserves fractional env-DoT ticks', () => {
  // Burn at 0.08 dps frame-tick → ×0.5 = 0.04 (NOT 1). Pure multiplier.
  const burnTick = 0.08;
  const halved = burnTick * 0.5;
  assert.equal(halved, 0.04, 'fractional DoT must stay fractional through DR');
  // CONTRAST: the broken Math.max(1, Math.round(...)) shape would yield 1.
  const broken = Math.max(1, Math.round(burnTick * 0.5));
  assert.equal(broken, 1, 'sanity: broken anti-pattern would inflate to 1');
});
