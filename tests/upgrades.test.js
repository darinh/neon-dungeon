'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const save = require(path.resolve(__dirname, '..', 'src', 'meta', 'save.js'));
const upgrades = require(path.resolve(__dirname, '..', 'src', 'meta', 'upgrades.js'));

function makeFakeStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: k => { map.delete(k); },
    _dump: () => Object.fromEntries(map),
  };
}

// ─── Node table invariants ─────────────────────────────────────────────────

test('UPGRADE_NODES has exactly 12 nodes, 3 branches × 4 tiers', () => {
  assert.equal(upgrades.UPGRADE_NODES.length, 12);
  const byBranch = {};
  for (const n of upgrades.UPGRADE_NODES) {
    byBranch[n.branch] = byBranch[n.branch] || new Set();
    byBranch[n.branch].add(n.tier);
  }
  assert.deepEqual(Object.keys(byBranch).sort(), ['Damage', 'Utility', 'Vitality']);
  for (const b of Object.keys(byBranch)) {
    assert.deepEqual([...byBranch[b]].sort(), [1, 2, 3, 4], `${b} missing tier`);
  }
});

test('UPGRADE_NODES ids are unique and well-formed', () => {
  const ids = new Set();
  for (const n of upgrades.UPGRADE_NODES) {
    assert.ok(typeof n.id === 'string' && n.id.length > 0);
    assert.ok(!ids.has(n.id), 'duplicate id ' + n.id);
    ids.add(n.id);
    assert.ok(n.baseCost > 0, n.id + ' baseCost must be positive');
    assert.ok(n.maxLevel >= 1 && n.maxLevel <= 3, n.id + ' maxLevel out of range');
    assert.ok(typeof n.effect === 'string' && n.effect.length > 0);
  }
});

test('Capstone (tier-4) nodes have maxLevel 1', () => {
  for (const id of ['second_wind', 'surge', 'hacktool']) {
    const n = upgrades.getNode(id);
    assert.ok(n, id + ' must exist');
    assert.equal(n.maxLevel, 1, id + ' should be capstone');
  }
});

// ─── Cost curve ────────────────────────────────────────────────────────────

test('nodeCost returns baseCost for first level, scales linearly', () => {
  // hull_plating: baseCost=3, maxLevel=3 → costs 3, 6, 9
  assert.equal(upgrades.nodeCost('hull_plating', 0), 3);
  assert.equal(upgrades.nodeCost('hull_plating', 1), 6);
  assert.equal(upgrades.nodeCost('hull_plating', 2), 9);
  assert.equal(upgrades.nodeCost('hull_plating', 3), undefined);  // maxed
  // overclock: baseCost=3, maxLevel=3
  assert.equal(upgrades.nodeCost('overclock', 0), 3);
  assert.equal(upgrades.nodeCost('overclock', 2), 9);
  // surge capstone: baseCost=18, maxLevel=1 → only level 1 at 18
  assert.equal(upgrades.nodeCost('surge', 0), 18);
  assert.equal(upgrades.nodeCost('surge', 1), undefined);
});

test('nodeCost returns undefined for unknown ids', () => {
  assert.equal(upgrades.nodeCost('nonexistent', 0), undefined);
});

test('totalSpent sums triangular-number costs across all owned levels', () => {
  // hull_plating @ lv2 → 3 + 6 = 9
  // surge @ lv1 → 18
  // total = 27
  const meta = { upgradeNodes: { hull_plating: 2, surge: 1 } };
  assert.equal(upgrades.totalSpent(meta), 27);
});

test('totalSpent returns 0 for empty meta', () => {
  assert.equal(upgrades.totalSpent({}), 0);
  assert.equal(upgrades.totalSpent({ upgradeNodes: {} }), 0);
  assert.equal(upgrades.totalSpent(null), 0);
});

// ─── Prereq gating ─────────────────────────────────────────────────────────

test('prereqMet: tier 1 is always available', () => {
  const meta = { upgradeNodes: {} };
  assert.equal(upgrades.prereqMet(meta, 'hull_plating'), true);
  assert.equal(upgrades.prereqMet(meta, 'overclock'), true);
  assert.equal(upgrades.prereqMet(meta, 'recon'), true);
});

test('prereqMet: higher tiers require previous tier in same branch at lv≥1', () => {
  let meta = { upgradeNodes: {} };
  assert.equal(upgrades.prereqMet(meta, 'regenerator'), false);  // needs hull_plating
  assert.equal(upgrades.prereqMet(meta, 'momentum'), false);     // needs critical_bias
  assert.equal(upgrades.prereqMet(meta, 'surge'), false);        // needs momentum
  meta = { upgradeNodes: { hull_plating: 1 } };
  assert.equal(upgrades.prereqMet(meta, 'regenerator'), true);
  assert.equal(upgrades.prereqMet(meta, 'trauma_kit'), false);   // needs regenerator
  meta = { upgradeNodes: { hull_plating: 1, regenerator: 1, trauma_kit: 1 } };
  assert.equal(upgrades.prereqMet(meta, 'second_wind'), true);
});

test('prereqMet: cross-branch upgrades do not satisfy prereqs', () => {
  const meta = { upgradeNodes: { overclock: 3, critical_bias: 3 } };
  // Damage tree fully unlocked, but Vitality tier 2 still gated.
  assert.equal(upgrades.prereqMet(meta, 'regenerator'), false);
});

// ─── purchase() ────────────────────────────────────────────────────────────

test('purchase: succeeds with cores + prereqs, debits wallet, persists level', () => {
  save._setStorageForTests(makeFakeStorage());
  save.addCores(20);
  const r = upgrades.purchase(null, 'hull_plating');
  assert.deepEqual({ ok: r.ok, cost: r.cost, level: r.level }, { ok: true, cost: 3, level: 1 });
  const m = save.loadMeta();
  assert.equal(m.cores, 17);
  assert.equal(m.upgradeNodes.hull_plating, 1);
  save._setStorageForTests(null);
});

test('purchase: refuses when cores insufficient (wallet unchanged)', () => {
  save._setStorageForTests(makeFakeStorage());
  save.addCores(2);  // hull_plating costs 3
  const r = upgrades.purchase(null, 'hull_plating');
  assert.deepEqual(r, { ok: false, reason: 'cores' });
  assert.equal(save.loadMeta().cores, 2);
  assert.equal(save.loadMeta().upgradeNodes.hull_plating || 0, 0);
  save._setStorageForTests(null);
});

test('purchase: refuses when node already maxed', () => {
  save._setStorageForTests(makeFakeStorage());
  save.addCores(999);
  // Max out hull_plating at level 3.
  for (let i = 0; i < 3; i++) {
    const r = upgrades.purchase(null, 'hull_plating');
    assert.equal(r.ok, true);
  }
  const r = upgrades.purchase(null, 'hull_plating');
  assert.deepEqual(r, { ok: false, reason: 'maxed' });
  assert.equal(save.loadMeta().upgradeNodes.hull_plating, 3);
  save._setStorageForTests(null);
});

test('purchase: refuses when prereq missing', () => {
  save._setStorageForTests(makeFakeStorage());
  save.addCores(999);
  const r = upgrades.purchase(null, 'regenerator');
  assert.deepEqual(r, { ok: false, reason: 'prereq' });
  assert.equal(save.loadMeta().cores, 999);
  save._setStorageForTests(null);
});

test('purchase: unknown id returns reason "unknown"', () => {
  save._setStorageForTests(makeFakeStorage());
  const r = upgrades.purchase(null, 'definitely_not_a_node');
  assert.deepEqual(r, { ok: false, reason: 'unknown' });
  save._setStorageForTests(null);
});

test('purchase: linear cost curve consumes 3+6+9 cores for hull_plating max', () => {
  save._setStorageForTests(makeFakeStorage());
  save.addCores(18);
  for (let i = 0; i < 3; i++) {
    const r = upgrades.purchase(null, 'hull_plating');
    assert.equal(r.ok, true, 'level ' + (i + 1));
  }
  // 18 - (3+6+9) = 0
  assert.equal(save.loadMeta().cores, 0);
  save._setStorageForTests(null);
});

test('purchase: mutates passed meta snapshot in addition to storage', () => {
  save._setStorageForTests(makeFakeStorage());
  save.addCores(10);
  const snap = save.loadMeta();
  const r = upgrades.purchase(snap, 'overclock');
  assert.equal(r.ok, true);
  assert.equal(snap.cores, 7);
  assert.equal(snap.upgradeNodes.overclock, 1);
  save._setStorageForTests(null);
});

// ─── applyMetaToPlayer with upgrade nodes ──────────────────────────────────

test('applyMetaToPlayer applies hull_plating (+10 maxHp per level) and refills hp', () => {
  save._setStorageForTests(makeFakeStorage({
    neonDungeonMeta: JSON.stringify({ version: 2, upgradeNodes: { hull_plating: 3 } })
  }));
  const player = { maxHp: 100, hp: 50, def: 0 };
  save.applyMetaToPlayer(player);
  assert.equal(player.maxHp, 130);
  assert.equal(player.hp, 130);
  save._setStorageForTests(null);
});

test('applyMetaToPlayer applies overclock damage mult and critical_bias crit', () => {
  save._setStorageForTests(makeFakeStorage({
    neonDungeonMeta: JSON.stringify({
      version: 2,
      upgradeNodes: { overclock: 2, critical_bias: 3 }
    })
  }));
  const player = { maxHp: 100, hp: 100, def: 0 };
  save.applyMetaToPlayer(player);
  assert.ok(Math.abs(player.damageMult - 1.10) < 1e-9, 'damageMult was ' + player.damageMult);
  assert.ok(Math.abs(player.critChance - 0.12) < 1e-9, 'critChance was ' + player.critChance);
  save._setStorageForTests(null);
});

test('applyMetaToPlayer sets metaFlags for behavioral nodes', () => {
  save._setStorageForTests(makeFakeStorage({
    neonDungeonMeta: JSON.stringify({
      version: 2,
      upgradeNodes: { momentum: 1, surge: 1, second_wind: 1, ghostwalk: 2 }
    })
  }));
  const player = { maxHp: 100, hp: 100, def: 0 };
  save.applyMetaToPlayer(player);
  assert.equal(player.metaFlags.momentum, 1);
  assert.equal(player.metaFlags.surge, 1);
  assert.equal(player.metaFlags.second_wind, 1);
  assert.equal(player.metaFlags.ghostwalk, 2);
  assert.ok(Math.abs(player.dashIFrameBonus - 0.4) < 1e-9);
  save._setStorageForTests(null);
});

test('applyMetaToPlayer: utility nodes set sensorRadiusMult, bonus credits, hackware slots', () => {
  save._setStorageForTests(makeFakeStorage({
    neonDungeonMeta: JSON.stringify({
      version: 2,
      upgradeNodes: { recon: 2, scavenger: 3, hacktool: 1 }
    })
  }));
  const player = { maxHp: 100, hp: 100, def: 0 };
  save.applyMetaToPlayer(player);
  assert.ok(Math.abs(player.sensorRadiusMult - 1.40) < 1e-9, 'sensorRadiusMult was ' + player.sensorRadiusMult);
  assert.equal(player.bonusCreditPerPickup, 3);
  assert.equal(player.hackwareSlots, 4);  // base 3 + 1
  save._setStorageForTests(null);
});

test('applyMetaToPlayer: trauma_kit + regenerator stat carriers', () => {
  save._setStorageForTests(makeFakeStorage({
    neonDungeonMeta: JSON.stringify({
      version: 2,
      upgradeNodes: { hull_plating: 1, regenerator: 2, trauma_kit: 1 }
    })
  }));
  const player = { maxHp: 100, hp: 100, def: 0 };
  save.applyMetaToPlayer(player);
  assert.ok(Math.abs(player.regenPerSec - 1.0) < 1e-9);
  assert.equal(player.startingNanoMedics, 1);
  save._setStorageForTests(null);
});

test('applyMetaToPlayer: empty upgradeNodes leaves metaFlags untouched (no allocation)', () => {
  save._setStorageForTests(makeFakeStorage());
  const player = { maxHp: 100, hp: 100, def: 0 };
  save.applyMetaToPlayer(player);
  assert.equal(player.metaFlags, undefined);
  save._setStorageForTests(null);
});

test('applyMetaToPlayer ignores legacy upgrades and node upgrades coexisting cleanly', () => {
  save._setStorageForTests(makeFakeStorage({
    neonDungeonMeta: JSON.stringify({
      version: 2,
      upgrades: { VITAL_BOOST: 1 },           // legacy: +10 maxHp
      upgradeNodes: { hull_plating: 1 }       // new: +10 maxHp
    })
  }));
  const player = { maxHp: 100, hp: 50, def: 0 };
  save.applyMetaToPlayer(player);
  // Both contributors stack: 100 + 10 + 10 = 120.
  assert.equal(player.maxHp, 120);
  assert.equal(player.hp, 120);
  save._setStorageForTests(null);
});

// ─── Terminal panel input wiring ───────────────────────────────────────────

test('handleUpgradeInput: arrow keys move the selector and wrap', () => {
  const sel = upgrades.defaultSelectorState();
  assert.deepEqual(sel, { col: 0, row: 0 });
  upgrades.handleUpgradeInput('ArrowRight', {}, sel);
  assert.equal(sel.col, 1);
  upgrades.handleUpgradeInput('ArrowLeft', {}, sel);
  upgrades.handleUpgradeInput('ArrowLeft', {}, sel);
  assert.equal(sel.col, 2);  // wrapped
  upgrades.handleUpgradeInput('ArrowDown', {}, sel);
  upgrades.handleUpgradeInput('ArrowDown', {}, sel);
  upgrades.handleUpgradeInput('ArrowDown', {}, sel);
  upgrades.handleUpgradeInput('ArrowDown', {}, sel);
  assert.equal(sel.row, 0);  // wrapped 0→1→2→3→0
});

test('handleUpgradeInput: Enter triggers purchase via game.meta', () => {
  save._setStorageForTests(makeFakeStorage());
  save.addCores(50);
  let sfxCalls = 0;
  const game = {
    meta: save.loadMeta(),
    audio: { upgradePurchased: () => { sfxCalls++; } }
  };
  const sel = { col: 0, row: 0 };  // Vitality tier 1 = hull_plating
  upgrades.handleUpgradeInput('Enter', game, sel);
  assert.equal(sfxCalls, 1);
  assert.equal(save.loadMeta().upgradeNodes.hull_plating, 1);
  // Insufficient prereq: try second_wind directly (Vitality tier 4)
  sel.col = 0; sel.row = 3;
  upgrades.handleUpgradeInput('Enter', game, sel);
  assert.equal(sfxCalls, 1, 'no sfx on failed purchase');
  assert.ok(!save.loadMeta().upgradeNodes.second_wind);
  save._setStorageForTests(null);
});

test('createUpgradeMatrixPanel returns terminal-panel API shape', () => {
  const panel = upgrades.createUpgradeMatrixPanel({});
  assert.equal(panel.id, 'upgrade_matrix');
  assert.equal(typeof panel.label, 'string');
  assert.equal(typeof panel.update, 'function');
  assert.equal(typeof panel.draw, 'function');
  assert.equal(typeof panel.onOpen, 'function');
  assert.equal(typeof panel.onClose, 'function');
  // draw is a no-op when ctx is missing — must not throw.
  panel.draw(null, 0, 0, 100, 100);
});
