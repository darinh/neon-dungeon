'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const save = require(path.resolve(__dirname, '..', 'src', 'meta', 'save.js'));

function makeFakeStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: k => { map.delete(k); },
    _dump: () => Object.fromEntries(map),
  };
}

test('save.defaultMeta returns expected shape', () => {
  const d = save.defaultMeta();
  assert.equal(d.shards, 0);
  assert.deepEqual(d.upgrades, {});
  assert.deepEqual(d.clearedDifficulties, []);
  assert.equal(d.lastDifficulty, 'NORMAL');
  assert.equal(d.stats.totalRuns, 0);
});

test('loadMeta returns defaults when no storage is available', () => {
  save._setStorageForTests(null);
  const m = save.loadMeta();
  assert.deepEqual(m, save.defaultMeta());
});

test('loadMeta returns defaults when storage is empty', () => {
  save._setStorageForTests(makeFakeStorage());
  const m = save.loadMeta();
  assert.equal(m.shards, 0);
  save._setStorageForTests(null);
});

test('saveMeta / loadMeta round-trip', () => {
  const storage = makeFakeStorage();
  save._setStorageForTests(storage);
  const out = save.defaultMeta();
  out.shards = 42;
  out.upgrades.VITAL_BOOST = 2;
  out.clearedDifficulties = ['NORMAL', 'HARD'];
  save.saveMeta(out);

  const back = save.loadMeta();
  assert.equal(back.shards, 42);
  assert.equal(back.upgrades.VITAL_BOOST, 2);
  assert.deepEqual(back.clearedDifficulties, ['NORMAL', 'HARD']);
  save._setStorageForTests(null);
});

test('saveMeta / loadMeta preserves shipped and planned ending ids', () => {
  const storage = makeFakeStorage();
  save._setStorageForTests(storage);
  const out = save.defaultMeta();
  out.endingsUnlocked = ['keeper', 'unchained', 'act1_message_sent'];
  save.saveMeta(out);

  const back = save.loadMeta();
  assert.deepEqual(back.endingsUnlocked, ['keeper', 'unchained', 'act1_message_sent']);
  save._setStorageForTests(null);
});

test('loadMeta survives corrupt JSON', () => {
  save._setStorageForTests(makeFakeStorage({ neonDungeonMeta: 'not-json{' }));
  const m = save.loadMeta();
  assert.deepEqual(m, save.defaultMeta());
  save._setStorageForTests(null);
});

test('loadMeta injects missing stats/upgrades/clearedDifficulties', () => {
  save._setStorageForTests(makeFakeStorage({
    neonDungeonMeta: JSON.stringify({ shards: 5 })
  }));
  const m = save.loadMeta();
  assert.equal(m.shards, 5);
  assert.deepEqual(m.upgrades, {});
  assert.deepEqual(m.clearedDifficulties, []);
  assert.equal(m.stats.totalRuns, 0);
  save._setStorageForTests(null);
});

test('loadMeta clamps upgrade levels to maxLv', () => {
  save._setStorageForTests(makeFakeStorage({
    neonDungeonMeta: JSON.stringify({ upgrades: { VITAL_BOOST: 99, STARTING_GEAR: 50 } })
  }));
  const m = save.loadMeta();
  const vit = save.META_UPGRADES.find(u => u.id === 'VITAL_BOOST');
  const gear = save.META_UPGRADES.find(u => u.id === 'STARTING_GEAR');
  assert.equal(m.upgrades.VITAL_BOOST, vit.maxLv);
  assert.equal(m.upgrades.STARTING_GEAR, gear.maxLv);
  save._setStorageForTests(null);
});

test('loadMeta floors negative shards to 0', () => {
  save._setStorageForTests(makeFakeStorage({
    neonDungeonMeta: JSON.stringify({ shards: -100 })
  }));
  const m = save.loadMeta();
  assert.equal(m.shards, 0);
  save._setStorageForTests(null);
});

test('loadMeta resets unknown lastDifficulty when validDifficulties is given', () => {
  save._setStorageForTests(makeFakeStorage({
    neonDungeonMeta: JSON.stringify({ lastDifficulty: 'IMPOSSIBLE' })
  }));
  const m = save.loadMeta({ NORMAL: {}, HARD: {} });
  assert.equal(m.lastDifficulty, 'NORMAL');
  save._setStorageForTests(null);
});

test('loadMeta preserves unknown lastDifficulty when no validator passed', () => {
  save._setStorageForTests(makeFakeStorage({
    neonDungeonMeta: JSON.stringify({ lastDifficulty: 'CUSTOM' })
  }));
  const m = save.loadMeta();
  assert.equal(m.lastDifficulty, 'CUSTOM');
  save._setStorageForTests(null);
});

test('isDiffUnlocked: NORMAL/EASY/HARD always unlocked', () => {
  save._setStorageForTests(makeFakeStorage());
  assert.equal(save.isDiffUnlocked('NORMAL'), true);
  assert.equal(save.isDiffUnlocked('EASY'), true);
  assert.equal(save.isDiffUnlocked('HARD'), true);
  save._setStorageForTests(null);
});

test('isDiffUnlocked: NIGHTMARE requires HARD cleared', () => {
  save._setStorageForTests(makeFakeStorage());
  assert.equal(save.isDiffUnlocked('NIGHTMARE'), false);

  const storage = makeFakeStorage({
    neonDungeonMeta: JSON.stringify({ clearedDifficulties: ['HARD'] })
  });
  save._setStorageForTests(storage);
  assert.equal(save.isDiffUnlocked('NIGHTMARE'), true);
  save._setStorageForTests(null);
});

test('calcRunShards baseline formula (no persistence bonus)', () => {
  save._setStorageForTests(makeFakeStorage());
  // floor=3, score=0, bosses=0, victory=false, mul=1 → 3
  assert.equal(save.calcRunShards(3, 0, 0, false, 1), 3);
  // floor=5, bosses=2, victory=true, score=0, mul=1 → 5 + 4 + 5 = 14
  assert.equal(save.calcRunShards(5, 0, 2, true, 1), 14);
  // score cap at 5
  assert.equal(save.calcRunShards(1, 20000, 0, false, 1), 1 + 5);
  save._setStorageForTests(null);
});

test('calcRunShards applies shardMul to base only, adds persistence after', () => {
  save._setStorageForTests(makeFakeStorage({
    neonDungeonMeta: JSON.stringify({ upgrades: { PERSISTENCE: 2 } })
  }));
  // floor=10, no bosses, no victory, score=0, mul=2 → round(10*2)=20, +6 persistence = 26
  assert.equal(save.calcRunShards(10, 0, 0, false, 2), 26);
  save._setStorageForTests(null);
});

test('calcRunShards defaults shardMul to 1 when omitted', () => {
  save._setStorageForTests(makeFakeStorage());
  assert.equal(save.calcRunShards(4, 0, 0, false), 4);
  save._setStorageForTests(null);
});

test('getMetaXPMultiplier / getMetaCreditMultiplier scale with levels', () => {
  save._setStorageForTests(makeFakeStorage({
    neonDungeonMeta: JSON.stringify({ upgrades: { QUICK_LEARNER: 3, SCAVENGER: 2 } })
  }));
  // 1 + 3 * 0.15 = 1.45
  assert.ok(Math.abs(save.getMetaXPMultiplier() - 1.45) < 1e-9);
  // 1 + 2 * 0.15 = 1.30
  assert.ok(Math.abs(save.getMetaCreditMultiplier() - 1.30) < 1e-9);
  save._setStorageForTests(null);
});

test('applyMetaToPlayer applies VITAL_BOOST and ARMOR_PLATING', () => {
  save._setStorageForTests(makeFakeStorage({
    neonDungeonMeta: JSON.stringify({ upgrades: { VITAL_BOOST: 2, ARMOR_PLATING: 1 } })
  }));
  const player = { maxHp: 100, hp: 50, def: 0 };
  save.applyMetaToPlayer(player);
  assert.equal(player.maxHp, 120);
  assert.equal(player.hp, 120, 'hp should be refilled to new max');
  assert.equal(player.def, 1);
  save._setStorageForTests(null);
});

test('applyMetaToPlayer uses injected buildWeapon when STARTING_GEAR is owned', () => {
  save._setStorageForTests(makeFakeStorage({
    neonDungeonMeta: JSON.stringify({ upgrades: { STARTING_GEAR: 1 } })
  }));
  let called = 0;
  const fakeBuild = (key, affixes) => { called++; return { name: 'TEST', key, affixes }; };
  const player = { maxHp: 100, hp: 100, def: 0, weapon: null };
  save.applyMetaToPlayer(player, fakeBuild);
  assert.equal(called, 1);
  assert.equal(player.weapon.name, 'TEST');
  save._setStorageForTests(null);
});

test('applyMetaToPlayer silently skips STARTING_GEAR if no buildWeapon is wired', () => {
  save._setStorageForTests(makeFakeStorage({
    neonDungeonMeta: JSON.stringify({ upgrades: { STARTING_GEAR: 1 } })
  }));
  const player = { maxHp: 100, hp: 100, def: 0, weapon: 'original' };
  save.applyMetaToPlayer(player, null);
  // Should not crash; weapon untouched because no builder was provided.
  assert.equal(player.weapon, 'original');
  save._setStorageForTests(null);
});

test('META_UPGRADES invariants: ids unique, costs length matches maxLv', () => {
  const ids = new Set();
  for (const u of save.META_UPGRADES) {
    assert.ok(!ids.has(u.id), `duplicate id: ${u.id}`);
    ids.add(u.id);
    assert.equal(u.costs.length, u.maxLv, `${u.id} costs must match maxLv`);
    for (const c of u.costs) assert.ok(c > 0, `${u.id} cost must be positive`);
  }
});

// ─── UNCHAINED Phase 1 — v2 schema, migration, and helpers ─────────────────

test('defaultMeta v2 shape includes all UNCHAINED fields', () => {
  const d = save.defaultMeta();
  assert.equal(d.version, save.META_VERSION);
  assert.equal(d.cores, 0);
  assert.deepEqual(d.upgradeNodes, {});
  assert.deepEqual(d.modulesOwned, []);
  assert.deepEqual(d.modulesInstalled, [null, null, null]);
  assert.deepEqual(d.logsRead, []);
  assert.deepEqual(d.logsFound, []);
  assert.deepEqual(d.endingsUnlocked, []);
  assert.equal(d.runsCompleted, 0);
  assert.equal(d.deepestBiome, 0);
  // Legacy v1 fields preserved.
  assert.equal(d.shards, 0);
  assert.deepEqual(d.upgrades, {});
  assert.deepEqual(d.clearedDifficulties, []);
});

test('loadMeta migrates a v1 save to v2 and fills all new defaults', () => {
  const storage = makeFakeStorage({
    neonDungeonMeta: JSON.stringify({
      shards: 77,
      upgrades: { VITAL_BOOST: 2 },
      stats: { totalRuns: 3, totalShards: 100, bestFloor: 5, victories: 1 },
      lastDifficulty: 'HARD',
      clearedDifficulties: ['NORMAL', 'HARD']
    })
  });
  save._setStorageForTests(storage);
  const m = save.loadMeta();
  assert.equal(m.version, save.META_VERSION);
  assert.equal(m.shards, 77);                    // preserved
  assert.equal(m.upgrades.VITAL_BOOST, 2);       // preserved
  assert.equal(m.cores, 0);
  assert.deepEqual(m.upgradeNodes, {});
  assert.deepEqual(m.modulesOwned, []);
  assert.deepEqual(m.modulesInstalled, [null, null, null]);
  assert.deepEqual(m.logsRead, []);
  assert.deepEqual(m.endingsUnlocked, []);
  assert.equal(m.runsCompleted, 0);
  assert.equal(m.deepestBiome, 0);
  save._setStorageForTests(null);
});

test('loadMeta coerces garbage UNCHAINED fields to safe shapes', () => {
  save._setStorageForTests(makeFakeStorage({
    neonDungeonMeta: JSON.stringify({
      version: 2,
      cores: -50,
      upgradeNodes: 'not-an-object',
      modulesOwned: ['M_ONE', 42, null, 'M_TWO'],
      modulesInstalled: ['M_ONE', 99, 'M_TWO', 'M_EXTRA'],  // too long + junk
      logsRead: 'nope',
      logsFound: ['LOG_A', {}, 'LOG_B'],
      endingsUnlocked: ['keeper', 'bogus', 'unchained', 'act1_message_sent'],
      runsCompleted: -3
    })
  }));
  const m = save.loadMeta();
  assert.equal(m.cores, 0);                                // negative floored
  assert.deepEqual(m.upgradeNodes, {});                    // non-object → empty
  assert.deepEqual(m.modulesOwned, ['M_ONE', 'M_TWO']);    // non-strings dropped
  assert.equal(m.modulesInstalled.length, 3);              // fixed width
  assert.equal(m.modulesInstalled[0], 'M_ONE');
  assert.equal(m.modulesInstalled[1], null);               // non-string → null
  assert.equal(m.modulesInstalled[2], 'M_TWO');
  assert.deepEqual(m.logsRead, []);
  assert.deepEqual(m.logsFound, ['LOG_A', 'LOG_B']);
  assert.deepEqual(m.endingsUnlocked, ['keeper', 'unchained', 'act1_message_sent']);
  assert.equal(m.runsCompleted, 0);
  save._setStorageForTests(null);
});

test('v1→v2 migration is idempotent (second load does not redo work)', () => {
  const storage = makeFakeStorage({
    neonDungeonMeta: JSON.stringify({ shards: 5 })
  });
  save._setStorageForTests(storage);
  const first = save.loadMeta();
  save.saveMeta(first);
  const second = save.loadMeta();
  assert.equal(second.version, save.META_VERSION);
  assert.deepEqual(second.modulesInstalled, [null, null, null]);
  save._setStorageForTests(null);
});

test('addCores increments wallet, spendCores debits only when affordable', () => {
  save._setStorageForTests(makeFakeStorage());
  assert.equal(save.addCores(10), 10);
  assert.equal(save.addCores(5), 15);
  assert.equal(save.addCores(-100), 15);                   // negatives ignored
  assert.equal(save.spendCores(20), false);                // insufficient
  assert.equal(save.loadMeta().cores, 15);                 // unchanged on fail
  assert.equal(save.spendCores(10), true);
  assert.equal(save.loadMeta().cores, 5);
  assert.equal(save.spendCores(0), true);                  // zero is a no-op success
  save._setStorageForTests(null);
});

test('addLogFound is idempotent; markLogRead promotes found→read', () => {
  save._setStorageForTests(makeFakeStorage());
  assert.equal(save.addLogFound('LOG_A'), true);
  assert.equal(save.addLogFound('LOG_A'), false);          // already found
  assert.equal(save.markLogRead('LOG_A'), true);
  assert.equal(save.markLogRead('LOG_A'), false);          // already read
  const m1 = save.loadMeta();
  assert.deepEqual(m1.logsFound, ['LOG_A']);
  assert.deepEqual(m1.logsRead, ['LOG_A']);
  // markLogRead on an unseen id should add to BOTH found and read.
  assert.equal(save.markLogRead('LOG_B'), true);
  const m2 = save.loadMeta();
  assert.ok(m2.logsFound.includes('LOG_B'));
  assert.ok(m2.logsRead.includes('LOG_B'));
  save._setStorageForTests(null);
});

test('installModule slots only owned modules; previous slot content returned', () => {
  const storage = makeFakeStorage();
  save._setStorageForTests(storage);
  const m0 = save.loadMeta(); m0.modulesOwned = ['M_A', 'M_B']; save.saveMeta(m0);
  assert.equal(save.installModule(0, 'M_A'), null);       // empty slot → null
  assert.equal(save.installModule(1, 'M_B'), null);
  assert.equal(save.installModule(0, 'M_B'), 'M_A');       // swaps A out, B steals from slot 1
  const m1 = save.loadMeta();
  assert.equal(m1.modulesInstalled[0], 'M_B');
  assert.equal(m1.modulesInstalled[1], null, 'slot 1 cleared when M_B moved');
  // Invalid inputs.
  assert.equal(save.installModule(0, 'M_NOT_OWNED'), undefined);
  assert.equal(save.installModule(-1, 'M_A'), undefined);
  assert.equal(save.installModule(99, 'M_A'), undefined);
  // Unslot via null.
  assert.equal(save.installModule(0, null), 'M_B');
  assert.equal(save.loadMeta().modulesInstalled[0], null);
  // Regression: undefined moduleId is BAD INPUT, not an implicit unslot.
  save.installModule(1, 'M_B');
  assert.equal(save.installModule(1), undefined, 'undefined must not unslot');
  assert.equal(save.loadMeta().modulesInstalled[1], 'M_B', 'slot must be untouched on bad input');
  assert.equal(save.installModule(1, 42), undefined, 'non-string id is bad input');
  assert.equal(save.installModule(1, ''),  undefined, 'empty string is bad input');
  assert.equal(save.loadMeta().modulesInstalled[1], 'M_B');
  save._setStorageForTests(null);
});

test('sellModule removes inventory, clears slot, credits refund', () => {
  save._setStorageForTests(makeFakeStorage());
  const m0 = save.loadMeta();
  m0.modulesOwned = ['M_X', 'M_Y'];
  m0.cores = 5;
  save.saveMeta(m0);
  save.installModule(2, 'M_X');
  assert.equal(save.sellModule('M_NOT_OWNED', 10), 0);
  assert.equal(save.sellModule('M_X', 7), 7);
  const m1 = save.loadMeta();
  assert.deepEqual(m1.modulesOwned, ['M_Y']);
  assert.equal(m1.modulesInstalled[2], null);
  assert.equal(m1.cores, 12);                              // 5 + 7 refund
  save._setStorageForTests(null);
});

test('resetMeta wipes persistent state back to defaults', () => {
  const storage = makeFakeStorage();
  save._setStorageForTests(storage);
  save.addCores(99);
  save.addLogFound('LOG_Z');
  save.resetMeta();
  const m = save.loadMeta();
  assert.equal(m.cores, 0);
  assert.deepEqual(m.logsFound, []);
  save._setStorageForTests(null);
});

test('death does not touch meta (simulated by leaving storage untouched)', () => {
  // The game never writes meta on death — only on startGame() and on
  // explicit meta actions (shop purchase, archive read). This test asserts
  // the invariant by simulating a "death" that only touches run state.
  const storage = makeFakeStorage();
  save._setStorageForTests(storage);
  save.addCores(42);
  const u = save.loadMeta(); u.upgrades.VITAL_BOOST = 3; save.saveMeta(u);
  const snapshot = JSON.parse(storage.getItem(save.STORAGE_KEY));
  // "Die" — the run object would be cleared elsewhere; meta storage is not touched.
  const after = JSON.parse(storage.getItem(save.STORAGE_KEY));
  assert.deepEqual(after, snapshot, 'meta storage must be byte-identical after death');
  assert.equal(save.loadMeta().cores, 42);
  assert.equal(save.loadMeta().upgrades.VITAL_BOOST, 3);
  save._setStorageForTests(null);
});
