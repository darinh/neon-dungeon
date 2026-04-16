'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const save = require(path.resolve(__dirname, '..', 'src', 'meta', 'save.js'));
const modules = require(path.resolve(__dirname, '..', 'src', 'meta', 'modules.js'));

function makeFakeStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: k => { map.delete(k); },
    _dump: () => Object.fromEntries(map),
  };
}

// Helper: fresh meta + storage per test so tests don't leak through _testStorage.
function fresh() {
  const storage = makeFakeStorage();
  save._setStorageForTests(storage);
  return storage;
}

test('MODULES catalog has 10 entries with required fields', () => {
  assert.equal(modules.MODULES.length, 10);
  for (const m of modules.MODULES) {
    assert.equal(typeof m.id, 'string');
    assert.equal(typeof m.name, 'string');
    assert.equal(typeof m.effect, 'string');
    assert.ok(m.id.length > 0 && m.name.length > 0);
  }
});

test('getModule returns entry by id, null for unknown', () => {
  assert.equal(modules.getModule('armor_link').name, 'ARMOR LINK');
  assert.equal(modules.getModule('does_not_exist'), null);
  assert.equal(modules.getModule(null), null);
  assert.equal(modules.getModule(undefined), null);
});

test('canInstall: valid/invalid inputs', () => {
  fresh();
  const meta = save.loadMeta();
  meta.modulesOwned = ['armor_link', 'kinetic_amp'];
  save.saveMeta(meta);

  assert.equal(modules.canInstall(null, 0, 'armor_link'), true);
  assert.equal(modules.canInstall(null, 3, 'armor_link'), false, 'slot out of range');
  assert.equal(modules.canInstall(null, -1, 'armor_link'), false);
  assert.equal(modules.canInstall(null, 0, 'not_owned'), false, 'must be owned');
  assert.equal(modules.canInstall(null, 0, null), false);
  // After install → canInstall returns false for same id in same slot (no-op).
  modules.install(null, 0, 'armor_link');
  assert.equal(modules.canInstall(null, 0, 'armor_link'), false);
  save._setStorageForTests(null);
});

test('install / uninstall round-trip', () => {
  fresh();
  const meta = save.loadMeta();
  meta.modulesOwned = ['armor_link', 'kinetic_amp', 'stim_injector'];
  save.saveMeta(meta);

  modules.install(null, 0, 'armor_link');
  modules.install(null, 1, 'kinetic_amp');
  modules.install(null, 2, 'stim_injector');
  let m = save.loadMeta();
  assert.deepEqual(m.modulesInstalled, ['armor_link', 'kinetic_amp', 'stim_injector']);

  modules.uninstall(null, 1);
  m = save.loadMeta();
  assert.deepEqual(m.modulesInstalled, ['armor_link', null, 'stim_injector']);
  assert.deepEqual(m.modulesOwned, ['armor_link', 'kinetic_amp', 'stim_injector'],
    'uninstall must not remove from inventory');
  save._setStorageForTests(null);
});

test("can't install same id in two different slots — first slot is cleared", () => {
  fresh();
  const meta = save.loadMeta();
  meta.modulesOwned = ['armor_link'];
  save.saveMeta(meta);

  modules.install(null, 0, 'armor_link');
  modules.install(null, 2, 'armor_link');
  const m = save.loadMeta();
  assert.equal(m.modulesInstalled[0], null, 'old slot cleared');
  assert.equal(m.modulesInstalled[2], 'armor_link');
  save._setStorageForTests(null);
});

test('sell removes the module + credits cores at fixed refund of 4', () => {
  fresh();
  const meta = save.loadMeta();
  meta.modulesOwned = ['armor_link', 'kinetic_amp'];
  meta.modulesInstalled = ['armor_link', null, null];
  meta.cores = 10;
  save.saveMeta(meta);

  const refund = modules.sell(null, 'armor_link');
  assert.equal(refund, modules.SELL_PRICE);
  assert.equal(refund, 4);

  const m = save.loadMeta();
  assert.equal(m.cores, 14);
  assert.deepEqual(m.modulesOwned, ['kinetic_amp']);
  assert.equal(m.modulesInstalled[0], null, 'selling removes from slot too');
  save._setStorageForTests(null);
});

test('sell returns 0 for unowned module (no cores credited)', () => {
  fresh();
  const meta = save.loadMeta();
  meta.cores = 10;
  save.saveMeta(meta);
  const refund = modules.sell(null, 'armor_link');
  assert.equal(refund, 0);
  assert.equal(save.loadMeta().cores, 10);
  save._setStorageForTests(null);
});

test('full inventory: install into occupied slot overwrites (keeps owned)', () => {
  fresh();
  const meta = save.loadMeta();
  meta.modulesOwned = ['armor_link', 'kinetic_amp'];
  save.saveMeta(meta);

  const prev1 = modules.install(null, 0, 'armor_link');
  assert.equal(prev1, null);
  const prev2 = modules.install(null, 0, 'kinetic_amp');
  assert.equal(prev2, 'armor_link', 'install returns previously-installed id');

  const m = save.loadMeta();
  assert.equal(m.modulesInstalled[0], 'kinetic_amp');
  assert.ok(m.modulesOwned.includes('armor_link'), 'overwritten module still owned');
  save._setStorageForTests(null);
});

test('rollModuleDrop — rare-terminal returns valid id or null (25% rate)', () => {
  // Deterministic stub: Math.random cycling through known values.
  const orig = Math.random;
  try {
    // First call: 0.10 (< 0.25 → drop). Second: index selector 0.0 → index 0.
    let calls = 0;
    Math.random = () => { calls++; return calls === 1 ? 0.10 : 0.0; };
    const id = modules.rollModuleDrop({ source: 'rare-terminal' });
    assert.equal(typeof id, 'string');
    assert.ok(modules.getModule(id), 'id is a valid module');
  } finally { Math.random = orig; }

  try {
    Math.random = () => 0.50; // > 0.25 → miss
    const id = modules.rollModuleDrop({ source: 'rare-terminal' });
    assert.equal(id, null);
  } finally { Math.random = orig; }
});

test('rollModuleDrop — boss sources always return a valid id', () => {
  const orig = Math.random;
  try {
    for (const source of ['boss-non-final', 'boss-genesis']) {
      for (let r = 0; r < 5; r++) {
        Math.random = () => r / 5;
        const id = modules.rollModuleDrop({ source });
        assert.equal(typeof id, 'string', source + ' must always drop');
        assert.ok(modules.getModule(id), source + ' must return valid id');
      }
    }
  } finally { Math.random = orig; }
});

test('addRunPickup + commitRunModules: floor-clear commit flow', () => {
  fresh();
  const game = {};
  assert.equal(modules.addRunPickup(game, 'armor_link'), true);
  assert.equal(modules.addRunPickup(game, 'kinetic_amp'), true);
  assert.equal(modules.addRunPickup(game, 'bogus_id'), false, 'bad ids rejected');

  assert.deepEqual(game.runModules, ['armor_link', 'kinetic_amp']);
  // Before commit, meta inventory is untouched.
  assert.deepEqual(save.loadMeta().modulesOwned, []);

  const committed = modules.commitRunModules(game);
  assert.equal(committed, 2);
  assert.deepEqual(save.loadMeta().modulesOwned, ['armor_link', 'kinetic_amp']);
  assert.deepEqual(game.runModules, [], 'runModules cleared after commit');
  save._setStorageForTests(null);
});

test('clearRunModules discards pickups (death path)', () => {
  fresh();
  const game = {};
  modules.addRunPickup(game, 'armor_link');
  modules.addRunPickup(game, 'kinetic_amp');
  modules.clearRunModules(game);
  assert.deepEqual(game.runModules, []);
  // Meta inventory must remain empty — death must not commit.
  assert.deepEqual(save.loadMeta().modulesOwned, []);
  save._setStorageForTests(null);
});

test('applyMetaToPlayer applies installed-module effects', () => {
  fresh();
  const meta = save.loadMeta();
  meta.modulesOwned = ['armor_link', 'stim_injector', 'targeting_array', 'reactive_core'];
  meta.modulesInstalled = ['armor_link', 'stim_injector', 'targeting_array'];
  save.saveMeta(meta);

  const player = { maxHp: 100, hp: 100, atk: 10, def: 2, spd: 3.5 };
  save.applyMetaToPlayer(player);

  assert.equal(player.maxHp, 115, 'armor_link +15 maxHp');
  assert.equal(player.hp, 115, 'armor_link refills hp');
  assert.ok(Math.abs(player.spd - 3.85) < 1e-9, 'stim_injector +10% speed');
  assert.ok(player.metaFlags, 'metaFlags object exists');
  assert.ok(Math.abs(player.metaFlags.critChanceBonus - 0.03) < 1e-9);
  assert.ok(Math.abs(player.metaFlags.critDamageBonus - 0.15) < 1e-9);
  assert.ok(Math.abs(player.metaFlags.moveSpeedMul - 1.10) < 1e-9);
  save._setStorageForTests(null);
});

test('applyMetaToPlayer is a no-op when no modules installed', () => {
  fresh();
  const player = { maxHp: 100, hp: 100, atk: 10, def: 2, spd: 3.5 };
  save.applyMetaToPlayer(player);
  assert.equal(player.maxHp, 100);
  assert.equal(player.spd, 3.5);
  save._setStorageForTests(null);
});

test('panel state + key handler: install from inventory into empty slot', () => {
  fresh();
  const meta = save.loadMeta();
  meta.modulesOwned = ['armor_link'];
  save.saveMeta(meta);

  const state = modules.defaultPanelState();
  // Focus inventory, press Enter → installs into slot 0.
  assert.equal(modules.handleModuleSlotsKey(null, state, 'Tab'), 'handled');
  assert.equal(state.focus, 'inv');
  assert.equal(modules.handleModuleSlotsKey(null, state, 'Enter'), 'handled');
  assert.equal(save.loadMeta().modulesInstalled[0], 'armor_link');
  save._setStorageForTests(null);
});

test('panel key handler: S → confirm → Y sells', () => {
  fresh();
  const meta = save.loadMeta();
  meta.modulesOwned = ['armor_link'];
  meta.cores = 0;
  save.saveMeta(meta);

  const state = modules.defaultPanelState();
  state.focus = 'inv';
  assert.equal(modules.handleModuleSlotsKey(null, state, 'S'), 'handled');
  assert.equal(state.confirmSell, true);
  assert.equal(modules.handleModuleSlotsKey(null, state, 'Y'), 'handled');
  assert.equal(state.confirmSell, false);
  const m = save.loadMeta();
  assert.equal(m.cores, 4);
  assert.deepEqual(m.modulesOwned, []);
  save._setStorageForTests(null);
});

test('panel key handler: S → confirm → N cancels', () => {
  fresh();
  const meta = save.loadMeta();
  meta.modulesOwned = ['armor_link'];
  meta.cores = 0;
  save.saveMeta(meta);

  const state = modules.defaultPanelState();
  state.focus = 'inv';
  modules.handleModuleSlotsKey(null, state, 'S');
  modules.handleModuleSlotsKey(null, state, 'N');
  assert.equal(state.confirmSell, false);
  const m = save.loadMeta();
  assert.equal(m.cores, 0, 'no refund on cancel');
  assert.deepEqual(m.modulesOwned, ['armor_link']);
  save._setStorageForTests(null);
});

test('panel drawModuleSlotsPanel does not throw with stub ctx', () => {
  fresh();
  const calls = [];
  const ctx = new Proxy({}, {
    get() {
      return function () { calls.push(arguments); };
    },
    set() { return true; },
  });
  // Proxy swallows property sets too; just confirm no throw.
  modules.drawModuleSlotsPanel(ctx, 0, 0, 400, 300, {}, modules.defaultPanelState());
  assert.ok(calls.length > 0, 'draw called canvas ops');
  save._setStorageForTests(null);
});
