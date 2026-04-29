'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const boosts = require(path.resolve(__dirname, '..', 'src', 'meta', 'boosts.js'));

// ─── BOOSTS catalogue ──────────────────────────────────────────────────────

test('vendor catalogue has exactly the 6 issue-spec boosts (HARVEST_SURGE is mob-drop only, not vendor-sold)', () => {
  // HARVEST_SURGE is granted by HARVESTER mob drops, not purchasable. The
  // BOOST_KEYS list now includes it because the registry is shared, so we
  // intersect with the vendor pool by excluding it explicitly.
  const vendorKeys = boosts.BOOST_KEYS.filter(k => k !== 'HARVEST_SURGE').sort();
  assert.deepEqual(
    vendorKeys,
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

test('filterVendorPool excludes CREDIT_CACHE (currency drops are not for sale)', () => {
  // Vendors must never sell CREDIT_CACHE: it's a kill/exploration drop, and
  // its payout scales with floor + meta + augments + difficulty so a flat
  // shop price would create an arbitrage loop at high floors.
  const pool = [
    { id: 'MED_PACK', persistent: false },
    { id: 'CREDIT_CACHE', persistent: false },
    { id: 'XP_CHIP', persistent: false },
  ];
  const filtered = boosts.filterVendorPool(pool);
  assert.equal(filtered.length, 2);
  assert.ok(!filtered.some(u => u.id === 'CREDIT_CACHE'));
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

// ─── TACTICAL_DROP / drop boost pool ───────────────────────────────────────

test('DROP_BOOST_POOL is the curated subset (excludes NANO_MEDIC to avoid heal overlap)', () => {
  // Drop pool excludes NANO_MEDIC: the run drop pool already has MED_PACK
  // (40 HP) and NANO_REPAIR (15 HP). Granting a third heal flavour via
  // TACTICAL_DROP would feel like a duplicate roll. Other 5 boosts are
  // mechanically distinct from existing drops.
  assert.deepEqual(
    boosts.DROP_BOOST_POOL.slice().sort(),
    ['COMBAT_STIM', 'CRIT_MATRIX', 'RECON_PING', 'REFLEX_BOOSTER', 'SHIELD_DRIVER']
  );
  assert.ok(!boosts.DROP_BOOST_POOL.includes('NANO_MEDIC'));
});

test('every DROP_BOOST_POOL id resolves to a real BOOSTS entry', () => {
  // Defends against a typo in DROP_BOOST_POOL silently producing null
  // pickups at runtime — the rollDropBoost path looks up BOOSTS[id] in the
  // TACTICAL_DROP fn.
  for (const id of boosts.DROP_BOOST_POOL) {
    assert.ok(boosts.BOOSTS[id], `DROP_BOOST_POOL contains ${id} but BOOSTS has no entry for it`);
    assert.ok(boosts.BOOSTS[id].apply, `BOOSTS.${id} must have an apply() function`);
  }
});

test('rollDropBoost returns a member of the pool with default rng', () => {
  for (let i = 0; i < 50; i++) {
    const id = boosts.rollDropBoost();
    assert.ok(boosts.DROP_BOOST_POOL.includes(id), `rolled ${id} not in pool`);
  }
});

test('rollDropBoost is deterministic when given a seeded rng', () => {
  // Lock the determinism contract: callers (tests + telemetry) can pass a
  // seeded rng and get a reproducible roll. Index = min(len-1, floor(r*len))
  // so r=1.0 (legal for some PRNGs) maps to the last entry, not the first.
  assert.equal(boosts.rollDropBoost(() => 0), boosts.DROP_BOOST_POOL[0]);
  assert.equal(boosts.rollDropBoost(() => 0.5), boosts.DROP_BOOST_POOL[2]);
  assert.equal(boosts.rollDropBoost(() => 0.999), boosts.DROP_BOOST_POOL[4]);
  // Edge case: rng emits 1.0 — must clamp to last index, not wrap to 0.
  assert.equal(boosts.rollDropBoost(() => 1), boosts.DROP_BOOST_POOL[boosts.DROP_BOOST_POOL.length - 1]);
  // Edge case: rng emits negative (defensive) — must clamp to first index.
  assert.equal(boosts.rollDropBoost(() => -0.5), boosts.DROP_BOOST_POOL[0]);
});

test('rollDropBoost via applyBoost end-to-end grants the rolled buff', () => {
  // Smoke test the full pickup → roll → apply path. Forcing rng=0 hits
  // COMBAT_STIM which is floor-duration so we can assert the activeBoosts
  // flag was set.
  const id = boosts.rollDropBoost(() => 0);
  assert.equal(id, 'COMBAT_STIM');
  const p = { maxHp: 100, hp: 100 };
  assert.equal(boosts.applyBoost(p, id), true);
  assert.equal(boosts.hasBoost(p, 'COMBAT_STIM'), true);
  assert.equal(boosts.getBoostDamageMul(p), boosts.BOOSTS.COMBAT_STIM.dmgMul);
});

test('filterVendorPool excludes TACTICAL_DROP (vendors sell each boost individually)', () => {
  // Vendors must never sell TACTICAL_DROP: each underlying boost is already
  // sold individually at a known price (e.g. COMBAT_STIM = 15). A flat-priced
  // random pick would either be strictly worse than choosing OR, at a
  // discount, an arbitrage loop ("buy random, hope for the 20-credit one").
  const pool = [
    { id: 'MED_PACK', persistent: false },
    { id: 'TACTICAL_DROP', persistent: false },
    { id: 'XP_CHIP', persistent: false },
  ];
  const filtered = boosts.filterVendorPool(pool);
  assert.equal(filtered.length, 2);
  assert.ok(!filtered.some(u => u.id === 'TACTICAL_DROP'));
});
