'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const behavior = require(path.resolve(__dirname, '..', 'src', 'meta', 'behavior.js'));

// ─── computeOutgoingDmgMul ─────────────────────────────────────────────────

test('computeOutgoingDmgMul: no flags, no stats → 1', () => {
  const p = {};
  assert.equal(behavior.computeOutgoingDmgMul(p), 1);
});

test('computeOutgoingDmgMul: damageMult stat passes through', () => {
  const p = { damageMult: 1.15 };
  assert.equal(behavior.computeOutgoingDmgMul(p), 1.15);
});

test('computeOutgoingDmgMul: momentum flag with expired timer → no bonus', () => {
  const p = { metaFlags: { momentum: 1 }, _momentumTimer: 0 };
  assert.equal(behavior.computeOutgoingDmgMul(p), 1);
});

test('computeOutgoingDmgMul: momentum L1 active → +15%', () => {
  const p = { metaFlags: { momentum: 1 }, _momentumTimer: 2.5 };
  assert.ok(Math.abs(behavior.computeOutgoingDmgMul(p) - 1.15) < 1e-9);
});

test('computeOutgoingDmgMul: momentum L2 active → +30%', () => {
  const p = { metaFlags: { momentum: 2 }, _momentumTimer: 1 };
  assert.ok(Math.abs(behavior.computeOutgoingDmgMul(p) - 1.30) < 1e-9);
});

test('computeOutgoingDmgMul: damageMult stacks with momentum multiplicatively', () => {
  const p = { damageMult: 1.10, metaFlags: { momentum: 1 }, _momentumTimer: 1 };
  assert.ok(Math.abs(behavior.computeOutgoingDmgMul(p) - 1.10 * 1.15) < 1e-9);
});

// ─── consumeSurgeShot ──────────────────────────────────────────────────────

test('consumeSurgeShot: no flag → always returns 1, still advances counter', () => {
  const p = {};
  for (let i = 1; i <= 20; i++) {
    assert.equal(behavior.consumeSurgeShot(p), 1);
  }
  assert.equal(p._surgeShotCount, 20);
});

test('consumeSurgeShot: L1 triggers on 8th, 16th, 24th shot with 2x', () => {
  const p = { metaFlags: { surge: 1 } };
  const hits = [];
  for (let i = 1; i <= 24; i++) {
    hits.push(behavior.consumeSurgeShot(p));
  }
  // Shots 1-7: 1, shot 8: 2, shots 9-15: 1, shot 16: 2, shots 17-23: 1, shot 24: 2
  assert.equal(hits[7], 2, '8th shot is surge');
  assert.equal(hits[15], 2, '16th shot is surge');
  assert.equal(hits[23], 2, '24th shot is surge');
  assert.equal(hits[6], 1, '7th shot is not surge');
  assert.equal(hits[8], 1, '9th shot is not surge');
});

test('consumeSurgeShot: L2 doubles bonus (+200% = 3x)', () => {
  const p = { metaFlags: { surge: 2 } };
  let trigger = 0;
  for (let i = 1; i <= 8; i++) trigger = behavior.consumeSurgeShot(p);
  assert.equal(trigger, 3);
});

// ─── onKillRefreshMomentum ─────────────────────────────────────────────────

test('onKillRefreshMomentum: no flag → no-op', () => {
  const p = {};
  behavior.onKillRefreshMomentum(p);
  assert.equal(p._momentumTimer, undefined);
});

test('onKillRefreshMomentum: with flag → sets timer to 3', () => {
  const p = { metaFlags: { momentum: 1 } };
  behavior.onKillRefreshMomentum(p);
  assert.equal(p._momentumTimer, 3);
});

test('onKillRefreshMomentum: refreshes timer even if partially elapsed', () => {
  const p = { metaFlags: { momentum: 1 }, _momentumTimer: 0.5 };
  behavior.onKillRefreshMomentum(p);
  assert.equal(p._momentumTimer, 3);
});

test('onKillRefreshMomentum: null player → no crash', () => {
  assert.doesNotThrow(() => behavior.onKillRefreshMomentum(null));
  assert.doesNotThrow(() => behavior.onKillRefreshMomentum(undefined));
});

// ─── tickMomentum ──────────────────────────────────────────────────────────

test('tickMomentum: counts down', () => {
  const p = { _momentumTimer: 2 };
  behavior.tickMomentum(p, 0.5);
  assert.ok(Math.abs(p._momentumTimer - 1.5) < 1e-9);
});

test('tickMomentum: clamps at 0', () => {
  const p = { _momentumTimer: 0.3 };
  behavior.tickMomentum(p, 1);
  assert.equal(p._momentumTimer, 0);
});

test('tickMomentum: zero timer stays zero', () => {
  const p = { _momentumTimer: 0 };
  behavior.tickMomentum(p, 0.5);
  assert.equal(p._momentumTimer, 0);
});

// ─── tickOutOfCombatRegen ──────────────────────────────────────────────────

test('tickOutOfCombatRegen: no regenPerSec → no heal, timer still accumulates', () => {
  const p = { hp: 50, maxHp: 100, _outOfCombatTimer: 0 };
  behavior.tickOutOfCombatRegen(p, 1);
  assert.equal(p.hp, 50);
  assert.equal(p._outOfCombatTimer, 1);
});

test('tickOutOfCombatRegen: with regen but < 3s out of combat → no heal', () => {
  const p = { hp: 50, maxHp: 100, regenPerSec: 0.5, _outOfCombatTimer: 0 };
  behavior.tickOutOfCombatRegen(p, 2);
  assert.equal(p._outOfCombatTimer, 2);
  assert.equal(p.hp, 50);
});

test('tickOutOfCombatRegen: > 3s out of combat → heal regenPerSec * dt', () => {
  const p = { hp: 50, maxHp: 100, regenPerSec: 2, _outOfCombatTimer: 5 };
  behavior.tickOutOfCombatRegen(p, 0.5);
  assert.ok(Math.abs(p.hp - 51) < 1e-9);  // 50 + 2*0.5
});

test('tickOutOfCombatRegen: caps at maxHp', () => {
  const p = { hp: 99, maxHp: 100, regenPerSec: 10, _outOfCombatTimer: 10 };
  behavior.tickOutOfCombatRegen(p, 1);
  assert.equal(p.hp, 100);
});

test('tickOutOfCombatRegen: no-op at full HP', () => {
  const p = { hp: 100, maxHp: 100, regenPerSec: 5, _outOfCombatTimer: 10 };
  behavior.tickOutOfCombatRegen(p, 1);
  assert.equal(p.hp, 100);
});

// ─── resetOutOfCombat ──────────────────────────────────────────────────────

test('resetOutOfCombat: sets _outOfCombatTimer to 0', () => {
  const p = { _outOfCombatTimer: 10 };
  behavior.resetOutOfCombat(p);
  assert.equal(p._outOfCombatTimer, 0);
});

// ─── tryMetaSecondWind ─────────────────────────────────────────────────────

test('tryMetaSecondWind: no flag → returns false, hp unchanged', () => {
  const p = { hp: 0, maxHp: 100 };
  assert.equal(behavior.tryMetaSecondWind(p), false);
  assert.equal(p.hp, 0);
});

test('tryMetaSecondWind: L1 fires once per run, revives at 25% maxHp', () => {
  const p = { hp: 0, maxHp: 100, metaFlags: { second_wind: 1 } };
  assert.equal(behavior.tryMetaSecondWind(p), true);
  assert.equal(p.hp, 25);
  assert.equal(p._metaSecondWindUsed, true);
});

test('tryMetaSecondWind: L2 revives at 50% maxHp', () => {
  const p = { hp: 0, maxHp: 100, metaFlags: { second_wind: 2 } };
  assert.equal(behavior.tryMetaSecondWind(p), true);
  assert.equal(p.hp, 50);
});

test('tryMetaSecondWind: second call in same run → false, hp unchanged', () => {
  const p = { hp: 0, maxHp: 100, metaFlags: { second_wind: 1 } };
  behavior.tryMetaSecondWind(p);
  p.hp = 0; // pretend lethal damage again
  assert.equal(behavior.tryMetaSecondWind(p), false);
  assert.equal(p.hp, 0);
});

test('tryMetaSecondWind: always leaves hp >= 1 (floor protection)', () => {
  const p = { hp: 0, maxHp: 3, metaFlags: { second_wind: 1 } };  // 25% of 3 = 0.75 → rounds to 1
  assert.equal(behavior.tryMetaSecondWind(p), true);
  assert.ok(p.hp >= 1);
});

// ─── integration: full shot flow ───────────────────────────────────────────

test('integration: kill refreshes momentum, momentum boosts next shot, expires after 3s', () => {
  const p = { metaFlags: { momentum: 1, surge: 0 } };
  // No momentum before first kill.
  assert.equal(behavior.computeOutgoingDmgMul(p), 1);
  // Kill an enemy.
  behavior.onKillRefreshMomentum(p);
  // Now boosted.
  assert.ok(Math.abs(behavior.computeOutgoingDmgMul(p) - 1.15) < 1e-9);
  // Tick 3 full seconds → expires.
  behavior.tickMomentum(p, 3);
  assert.equal(p._momentumTimer, 0);
  assert.equal(behavior.computeOutgoingDmgMul(p), 1);
});

test('integration: surge + momentum stack on the trigger shot', () => {
  const p = { metaFlags: { momentum: 1, surge: 1 }, _momentumTimer: 2 };
  // Fire 7 shots, no surge.
  for (let i = 0; i < 7; i++) behavior.consumeSurgeShot(p);
  // 8th shot — surge triggers.
  const surgeMul = behavior.consumeSurgeShot(p);
  const momMul = behavior.computeOutgoingDmgMul(p);
  assert.equal(surgeMul, 2);
  assert.ok(Math.abs(momMul - 1.15) < 1e-9);
  // Combined effect: 2 * 1.15 = 2.3x
  assert.ok(Math.abs(surgeMul * momMul - 2.3) < 1e-9);
});
