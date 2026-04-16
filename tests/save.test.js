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
