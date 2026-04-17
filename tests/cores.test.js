'use strict';
// UNCHAINED #39 — CORES currency drops.
// Pure Node tests. The module is UMD-lite, so we require it directly; the
// render helper takes a ctx/camera and is exercised with a fake ctx.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const cores = require(path.resolve(__dirname, '..', 'src', 'meta', 'cores.js'));
const save  = require(path.resolve(__dirname, '..', 'src', 'meta', 'save.js'));

function makeFakeStorage() {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: k => { map.delete(k); },
  };
}

function freshSave() {
  save._setStorageForTests(makeFakeStorage());
}

function makeGame(px, py) {
  return {
    player: { x: px, y: py },
    coreDrops: [],
  };
}

test('spawnCoreDrop appends a drop with clamped value', () => {
  freshSave();
  const g = makeGame(0, 0);
  const d = cores.spawnCoreDrop(g, 5, 5, 2);
  assert.equal(g.coreDrops.length, 1);
  assert.equal(d.value, 2);
  assert.equal(d.dead, false);

  // Non-numeric / zero / negative all clamp to 1 — drops must never be worthless.
  const d0 = cores.spawnCoreDrop(g, 1, 1, 0);
  assert.equal(d0.value, 1);
  const d9 = cores.spawnCoreDrop(g, 1, 1, -3);
  assert.equal(d9.value, 1);
});

test('updateCoreDrops: drop inside pickup radius credits wallet and pulses HUD', () => {
  freshSave();
  const g = makeGame(10, 10);
  cores.spawnCoreDrop(g, 10.2, 10.1, 3); // dist ~0.22 — inside PICKUP_RADIUS
  const before = save.loadMeta().cores;
  const collected = cores.updateCoreDrops(g, 1/60, { save });
  assert.equal(collected, 3);
  assert.equal(g.coreDrops.length, 0);
  assert.equal(save.loadMeta().cores, before + 3);
  assert.ok(g._coreHudPulse > 0, 'HUD pulse timer set');
});

test('updateCoreDrops: magnetic pull engages within MAGNET_RADIUS', () => {
  freshSave();
  const g = makeGame(0, 0);
  // Place a drop 1.5 tiles away — inside magnet (2.0) but outside pickup (0.7).
  cores.spawnCoreDrop(g, 1.5, 0, 1);
  const d = g.coreDrops[0];
  const startDist = Math.hypot(d.x - g.player.x, d.y - g.player.y);
  cores.updateCoreDrops(g, 1/30, { save }); // one frame
  const endDist = Math.hypot(d.x - g.player.x, d.y - g.player.y);
  assert.ok(endDist < startDist, `drop should move closer (start=${startDist}, end=${endDist})`);
});

test('updateCoreDrops: drop outside MAGNET_RADIUS does not move', () => {
  freshSave();
  const g = makeGame(0, 0);
  cores.spawnCoreDrop(g, 5, 0, 1); // well outside magnet
  const d = g.coreDrops[0];
  cores.updateCoreDrops(g, 1/30, { save });
  assert.equal(d.x, 5);
  assert.equal(d.y, 0);
});

test('updateCoreDrops: ticks spawnTime for animation', () => {
  freshSave();
  const g = makeGame(0, 0);
  cores.spawnCoreDrop(g, 5, 0, 1);
  cores.updateCoreDrops(g, 0.25, { save });
  assert.equal(g.coreDrops[0].spawnTime, 0.25);
});

test('vacuumAllCores engages pull on every uncollected drop', () => {
  freshSave();
  const g = makeGame(0, 0);
  cores.spawnCoreDrop(g, 8, 0, 1);  // far
  cores.spawnCoreDrop(g, 1.8, 0, 1); // near
  const n = cores.vacuumAllCores(g);
  assert.equal(n, 2);
  assert.ok(g.coreDrops.every(d => d._vacuum === true));
  // After a frame, the far drop should now be moving toward the player.
  const farBefore = g.coreDrops[0].x;
  cores.updateCoreDrops(g, 1/30, { save });
  assert.ok(g.coreDrops[0].x < farBefore, 'vacuumed far drop moves toward player');
});

test('forceCollectAll credits every drop and empties the array', () => {
  freshSave();
  const g = makeGame(0, 0);
  cores.spawnCoreDrop(g, 10, 10, 5);
  cores.spawnCoreDrop(g, -10, -10, 2);
  const before = save.loadMeta().cores;
  const total = cores.forceCollectAll(g, { save });
  assert.equal(total, 7);
  assert.equal(g.coreDrops.length, 0);
  assert.equal(save.loadMeta().cores, before + 7);
});

test('clearCoreDrops wipes without crediting (floor-transition isolation)', () => {
  freshSave();
  const g = makeGame(0, 0);
  cores.spawnCoreDrop(g, 5, 5, 3);
  const before = save.loadMeta().cores;
  cores.clearCoreDrops(g);
  assert.equal(g.coreDrops.length, 0);
  assert.equal(save.loadMeta().cores, before, 'wallet must NOT be credited');
});

test('tickHudPulse drains the timer and clamps at zero', () => {
  const g = { _coreHudPulse: 0.3 };
  cores.tickHudPulse(g, 0.2);
  assert.ok(Math.abs(g._coreHudPulse - 0.1) < 1e-9);
  cores.tickHudPulse(g, 1.0);
  assert.equal(g._coreHudPulse, 0);
  // Missing field: no crash.
  const g2 = {};
  cores.tickHudPulse(g2, 0.1);
  assert.equal(g2._coreHudPulse || 0, 0);
});

test('pickup calls audio.coreCollected via deps', () => {
  freshSave();
  let fired = 0;
  const fakeAudio = { coreCollected: () => { fired++; } };
  const g = makeGame(0, 0);
  cores.spawnCoreDrop(g, 0.1, 0, 1);
  cores.updateCoreDrops(g, 1/60, { save, audio: fakeAudio });
  assert.equal(fired, 1);
});

test('audio errors never break the run', () => {
  freshSave();
  const g = makeGame(0, 0);
  cores.spawnCoreDrop(g, 0.1, 0, 1);
  const bombAudio = { coreCollected: () => { throw new Error('boom'); } };
  // Must not throw.
  cores.updateCoreDrops(g, 1/60, { save, audio: bombAudio });
  assert.equal(save.loadMeta().cores, 1);
});

test('drawCoreDrops: no-op safety on empty/missing inputs', () => {
  // No ctx
  cores.drawCoreDrops(null, [], { x: 0, y: 0 }, 32);
  // No drops
  const fakeCtx = {
    save() {}, restore() {}, translate() {}, rotate() {},
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
    stroke() {}, fill() {}, measureText() { return { width: 0 }; },
  };
  cores.drawCoreDrops(fakeCtx, [], { x: 0, y: 0 }, 32); // should not throw
});

test('_cachedCores reflects wallet after pickup (HUD cache path)', () => {
  freshSave();
  const g = makeGame(0, 0);
  g._cachedCores = 0;
  cores.spawnCoreDrop(g, 0.1, 0, 4);
  cores.updateCoreDrops(g, 1/60, { save });
  assert.equal(g._cachedCores, 4);
  // Second pickup accumulates the cache, not overwrites the wallet.
  cores.spawnCoreDrop(g, 0.1, 0, 2);
  cores.updateCoreDrops(g, 1/60, { save });
  assert.equal(g._cachedCores, 6);
  assert.equal(save.loadMeta().cores, 6);
});

test('forceCollectAll updates _cachedCores (endgame/descent path)', () => {
  freshSave();
  const g = makeGame(0, 0);
  g._cachedCores = 0;
  cores.spawnCoreDrop(g, 40, 40, 10); // boss-like, far from player
  cores.spawnCoreDrop(g, -40, -40, 5);
  const n = cores.forceCollectAll(g, { save });
  assert.equal(n, 15);
  assert.equal(g._cachedCores, 15);
  assert.equal(save.loadMeta().cores, 15);
});
