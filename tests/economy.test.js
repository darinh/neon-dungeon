'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const boosts = require(path.resolve(__dirname, '..', 'src', 'meta', 'boosts.js'));

// ─── BOOSTS catalogue ──────────────────────────────────────────────────────

test('catalogue has exactly the 6 issue-spec boosts', () => {
  assert.deepEqual(
    boosts.BOOST_KEYS.sort(),
    ['COMBAT_STIM', 'CRIT_MATRIX', 'NANO_MEDIC', 'RECON_PING', 'REFLEX_BOOSTER', 'SHIELD_DRIVER']
  );
});

test('catalogue prices match issue spec', () => {
  assert.equal(boosts.BOOSTS.COMBAT_STIM.price, 15);
  assert.equal(boosts.BOOSTS.REFLEX_BOOSTER.price, 12);
  assert.equal(boosts.BOOSTS.CRIT_MATRIX.price, 18);
  assert.equal(boosts.BOOSTS.SHIELD_DRIVER.price, 20);
  assert.equal(boosts.BOOSTS.NANO_MEDIC.price, 10);
  assert.equal(boosts.BOOSTS.RECON_PING.price, 15);
});

test('floor-duration boosts flag on apply, instant boosts do not', () => {
  const p = { maxHp: 100, hp: 50 };
  boosts.applyBoost(p, 'COMBAT_STIM');
  boosts.applyBoost(p, 'REFLEX_BOOSTER');
  boosts.applyBoost(p, 'CRIT_MATRIX');
  boosts.applyBoost(p, 'RECON_PING');
  assert.equal(p.activeBoosts.COMBAT_STIM, true);
  assert.equal(p.activeBoosts.REFLEX_BOOSTER, true);
  assert.equal(p.activeBoosts.CRIT_MATRIX, true);
  assert.equal(p.activeBoosts.RECON_PING, true);
  // Instant boosts never appear in activeBoosts
  boosts.applyBoost(p, 'NANO_MEDIC');
  boosts.applyBoost(p, 'SHIELD_DRIVER');
  assert.equal(p.activeBoosts.NANO_MEDIC, undefined);
  assert.equal(p.activeBoosts.SHIELD_DRIVER, undefined);
});

// ─── applyBoost effects ────────────────────────────────────────────────────

test('COMBAT_STIM yields +15% damage mul, neutral without', () => {
  const p = {};
  assert.equal(boosts.getBoostDamageMul(p), 1);
  boosts.applyBoost(p, 'COMBAT_STIM');
  assert.equal(boosts.getBoostDamageMul(p), 1.15);
});

test('REFLEX_BOOSTER yields +10% speed mul, neutral without', () => {
  const p = {};
  assert.equal(boosts.getBoostSpeedMul(p), 1);
  boosts.applyBoost(p, 'REFLEX_BOOSTER');
  assert.ok(Math.abs(boosts.getBoostSpeedMul(p) - 1.10) < 1e-9);
});

test('CRIT_MATRIX yields +0.08 crit bonus, neutral without', () => {
  const p = {};
  assert.equal(boosts.getBoostCritBonus(p), 0);
  boosts.applyBoost(p, 'CRIT_MATRIX');
  assert.ok(Math.abs(boosts.getBoostCritBonus(p) - 0.08) < 1e-9);
});

test('NANO_MEDIC heals 40% max HP, capped at maxHp', () => {
  const p = { maxHp: 100, hp: 30 };
  boosts.applyBoost(p, 'NANO_MEDIC');
  assert.equal(p.hp, 70); // 30 + 40
  // Overheal caps at max
  p.hp = 90;
  boosts.applyBoost(p, 'NANO_MEDIC');
  assert.equal(p.hp, 100);
});

test('SHIELD_DRIVER grants one shield charge (stacking)', () => {
  const p = {};
  boosts.applyBoost(p, 'SHIELD_DRIVER');
  assert.equal(p._shieldCharges, 1);
  boosts.applyBoost(p, 'SHIELD_DRIVER');
  assert.equal(p._shieldCharges, 2);
});

test('consumeShieldCharge decrements and reports absorb', () => {
  const p = { _shieldCharges: 2 };
  assert.equal(boosts.consumeShieldCharge(p), true);
  assert.equal(p._shieldCharges, 1);
  assert.equal(boosts.consumeShieldCharge(p), true);
  assert.equal(p._shieldCharges, 0);
  assert.equal(boosts.consumeShieldCharge(p), false);
  assert.equal(p._shieldCharges, 0);
});

test('consumeShieldCharge on player without charges is a no-op', () => {
  assert.equal(boosts.consumeShieldCharge(null), false);
  assert.equal(boosts.consumeShieldCharge({}), false);
});

// ─── clearFloorBoosts ──────────────────────────────────────────────────────

test('clearFloorBoosts wipes floor flags and shield charges', () => {
  const p = { maxHp: 100, hp: 50 };
  boosts.applyBoost(p, 'COMBAT_STIM');
  boosts.applyBoost(p, 'REFLEX_BOOSTER');
  boosts.applyBoost(p, 'SHIELD_DRIVER');
  boosts.applyBoost(p, 'SHIELD_DRIVER');
  assert.equal(p.activeBoosts.COMBAT_STIM, true);
  assert.equal(p._shieldCharges, 2);
  boosts.clearFloorBoosts(p);
  assert.deepEqual(p.activeBoosts, {});
  assert.equal(p._shieldCharges, 0);
});

test('clearFloorBoosts is safe on bare players and null', () => {
  boosts.clearFloorBoosts(null);
  const p = {};
  boosts.clearFloorBoosts(p);
  assert.deepEqual(p.activeBoosts, {});
  assert.equal(p._shieldCharges, 0);
});

// ─── hasBoost ──────────────────────────────────────────────────────────────

test('hasBoost returns false for unknown / uninitialised players', () => {
  assert.equal(boosts.hasBoost(null, 'COMBAT_STIM'), false);
  assert.equal(boosts.hasBoost({}, 'COMBAT_STIM'), false);
  assert.equal(boosts.hasBoost({ activeBoosts: {} }, 'COMBAT_STIM'), false);
});

// ─── getActiveBoostList ────────────────────────────────────────────────────

test('getActiveBoostList empty when nothing active', () => {
  assert.deepEqual(boosts.getActiveBoostList({}), []);
});

test('getActiveBoostList returns floor boosts then shield stack count', () => {
  const p = { _shieldCharges: 3 };
  boosts.applyBoost(p, 'COMBAT_STIM');
  boosts.applyBoost(p, 'REFLEX_BOOSTER');
  const list = boosts.getActiveBoostList(p);
  assert.equal(list.length, 3);
  assert.equal(list[0].id, 'COMBAT_STIM');
  assert.equal(list[1].id, 'REFLEX_BOOSTER');
  assert.equal(list[2].id, 'SHIELD_DRIVER');
  assert.equal(list[2].detail, '×3');
});

// ─── filterVendorPool ──────────────────────────────────────────────────────

test('filterVendorPool strips persistent upgrades', () => {
  const pool = [
    { id: 'MED_PACK', persistent: false },
    { id: 'SAW_BLADE', persistent: true, maxLevel: 4 },
    { id: 'XP_CHIP', persistent: false },
    { id: 'ARMOR_UP', persistent: true, maxLevel: 5 },
  ];
  const filtered = boosts.filterVendorPool(pool);
  assert.equal(filtered.length, 2);
  assert.equal(filtered[0].id, 'MED_PACK');
  assert.equal(filtered[1].id, 'XP_CHIP');
});

test('filterVendorPool tolerates null / non-array', () => {
  assert.deepEqual(boosts.filterVendorPool(null), []);
  assert.deepEqual(boosts.filterVendorPool(undefined), []);
});

// ─── applyBoost safety ─────────────────────────────────────────────────────

test('applyBoost with unknown id is a no-op returning false', () => {
  const p = {};
  assert.equal(boosts.applyBoost(p, 'NOT_A_BOOST'), false);
  assert.deepEqual(p, {});
});

test('applyBoost with null player returns false', () => {
  assert.equal(boosts.applyBoost(null, 'COMBAT_STIM'), false);
});
