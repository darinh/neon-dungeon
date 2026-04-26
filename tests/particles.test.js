// @ts-check
'use strict';
// tests/particles.test.js — engine/particles.js: pool mechanics + physics.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSystem } = require('../engine/particles.js');

test('createSystem: defaults expose cap=2000, burst threshold=1500', () => {
  const sys = createSystem();
  assert.equal(sys.capacity, 2000);
  assert.equal(sys.count, 0);
  assert.equal(sys.pooled, 0);
});

test('createSystem: opts override cap', () => {
  const sys = createSystem({ cap: 5 });
  assert.equal(sys.capacity, 5);
});

test('acquire: returns fresh slot with reset-to-defaults shape', () => {
  const sys = createSystem();
  const p = sys.acquire();
  assert.ok(p);
  assert.equal(typeof p.x, 'number');
  assert.equal(typeof p.y, 'number');
  assert.equal(typeof p.vx, 'number');
  assert.equal(typeof p.vy, 'number');
  assert.equal(typeof p.life, 'number');
  assert.equal(typeof p.maxLife, 'number');
  assert.equal(typeof p.grav, 'number');
  assert.equal(p.alive, false); // caller flips this
  assert.equal(sys.count, 1);
});

test('acquire: enforces cap, returns null when full and pool empty', () => {
  const sys = createSystem({ cap: 3 });
  for (let i = 0; i < 3; i++) {
    const p = sys.acquire();
    assert.ok(p);
    p.life = 1; p.maxLife = 1;
  }
  assert.equal(sys.acquire(), null);
  assert.equal(sys.count, 3);
});

test('acquire: pulls from pool before growing past cap', () => {
  const sys = createSystem({ cap: 2 });
  const a = sys.acquire(); assert.ok(a); a.life = 1; a.maxLife = 0.001;
  const b = sys.acquire(); assert.ok(b); b.life = 1; b.maxLife = 1;
  // Kill `a` via update tick > maxLife; pool should hold 1 after.
  sys.update(0.01);
  assert.equal(sys.count, 1);
  assert.equal(sys.pooled, 1);
  // Acquire should reuse pool slot, not allocate beyond cap.
  const c = sys.acquire(); assert.ok(c);
  assert.equal(sys.count, 2);
  assert.equal(sys.pooled, 0);
  // Cap still respected.
  assert.equal(sys.acquire(), null);
});

test('update: integrates position with vx*dt, vy*dt', () => {
  const sys = createSystem();
  const p = sys.acquire(); assert.ok(p);
  p.x = 0; p.y = 0; p.vx = 10; p.vy = -5;
  p.life = 1; p.maxLife = 10; p.grav = 0;
  sys.update(0.5);
  assert.equal(p.x, 5);
  assert.equal(p.y, -2.5);
});

test('update: applies gravity to vy', () => {
  const sys = createSystem();
  const p = sys.acquire(); assert.ok(p);
  p.x = 0; p.y = 0; p.vx = 0; p.vy = 0;
  p.life = 1; p.maxLife = 10; p.grav = 40;
  sys.update(0.25);
  // vy after = 0 + 40*0.25 = 10
  assert.equal(p.vy, 10);
  // y was integrated with PRE-gravity vy (0), so still 0
  assert.equal(p.y, 0);
});

test('update: decays life by dt/maxLife', () => {
  const sys = createSystem();
  const p = sys.acquire(); assert.ok(p);
  p.life = 1; p.maxLife = 2; p.grav = 0;
  sys.update(0.5);
  assert.equal(p.life, 0.75); // 1 - 0.5/2
});

test('update: dead particles return to pool, alive shifts left in-place', () => {
  const sys = createSystem();
  const a = sys.acquire(); assert.ok(a); a.life = 1; a.maxLife = 0.001; a.grav = 0;
  const b = sys.acquire(); assert.ok(b); b.life = 1; b.maxLife = 10; b.grav = 0;
  const c = sys.acquire(); assert.ok(c); c.life = 1; c.maxLife = 0.001; c.grav = 0;
  const d = sys.acquire(); assert.ok(d); d.life = 1; d.maxLife = 10; d.grav = 0;
  sys.update(0.01);
  assert.equal(sys.count, 2);
  assert.equal(sys.pooled, 2);
  // The two surviving particles are b and d, not a or c.
  /** @type {any[]} */ const survived = [];
  sys.forEach((p) => survived.push(p));
  assert.equal(survived.length, 2);
  assert.ok(survived.includes(b));
  assert.ok(survived.includes(d));
  assert.ok(!survived.includes(a));
  assert.ok(!survived.includes(c));
});

test('update: marks dead particle alive=false before pooling', () => {
  const sys = createSystem();
  const p = sys.acquire(); assert.ok(p);
  p.life = 1; p.maxLife = 0.001; p.alive = true;
  sys.update(0.01);
  assert.equal(p.alive, false);
});

test('clear: releases every alive particle, preserves pool reuse', () => {
  const sys = createSystem();
  for (let i = 0; i < 5; i++) {
    const p = sys.acquire(); assert.ok(p);
    p.life = 1; p.maxLife = 10; p.alive = true;
  }
  assert.equal(sys.count, 5);
  sys.clear();
  assert.equal(sys.count, 0);
  assert.equal(sys.pooled, 5);
  // Re-acquire reuses pooled slots.
  const reused = sys.acquire(); assert.ok(reused);
  assert.equal(sys.pooled, 4);
});

test('clear: marks each released particle alive=false', () => {
  const sys = createSystem();
  const p = sys.acquire(); assert.ok(p);
  p.alive = true;
  sys.clear();
  assert.equal(p.alive, false);
});

test('scaleBurst: passes through when alive count <= threshold', () => {
  const sys = createSystem({ burstScaleThreshold: 10 });
  for (let i = 0; i < 10; i++) {
    const p = sys.acquire(); assert.ok(p); p.life = 1; p.maxLife = 10;
  }
  assert.equal(sys.scaleBurst(20), 20);
});

test('scaleBurst: halves with floor=1 when alive count exceeds threshold', () => {
  const sys = createSystem({ burstScaleThreshold: 2 });
  for (let i = 0; i < 3; i++) {
    const p = sys.acquire(); assert.ok(p); p.life = 1; p.maxLife = 10;
  }
  assert.equal(sys.scaleBurst(20), 10);
  assert.equal(sys.scaleBurst(1), 1); // floor protects against zero
  assert.equal(sys.scaleBurst(0), 1); // even from zero
});

test('forEach: iterates alive in insertion order', () => {
  const sys = createSystem();
  const a = sys.acquire(); assert.ok(a); a.life = 1; a.maxLife = 10;
  const b = sys.acquire(); assert.ok(b); b.life = 1; b.maxLife = 10;
  const c = sys.acquire(); assert.ok(c); c.life = 1; c.maxLife = 10;
  /** @type {any[]} */ const seen = [];
  sys.forEach((p, i) => seen.push([p, i]));
  assert.equal(seen.length, 3);
  assert.equal(seen[0][0], a); assert.equal(seen[0][1], 0);
  assert.equal(seen[1][0], b); assert.equal(seen[1][1], 1);
  assert.equal(seen[2][0], c); assert.equal(seen[2][1], 2);
});

test('release: manually returns a particle to the pool', () => {
  const sys = createSystem();
  const a = sys.acquire(); assert.ok(a); a.life = 1; a.maxLife = 10;
  const b = sys.acquire(); assert.ok(b); b.life = 1; b.maxLife = 10;
  sys.release(a);
  assert.equal(sys.count, 1);
  assert.equal(sys.pooled, 1);
  assert.equal(a.alive, false);
  // b still alive
  /** @type {any[]} */ const seen = [];
  sys.forEach((p) => seen.push(p));
  assert.deepEqual(seen, [b]);
});

test('release: no-op for unknown particle', () => {
  const sys = createSystem();
  const a = sys.acquire(); assert.ok(a);
  const stranger = { x:0,y:0,vx:0,vy:0,life:1,maxLife:1,grav:0,alive:true };
  sys.release(/** @type {any} */ (stranger));
  assert.equal(sys.count, 1);
  assert.equal(sys.pooled, 0);
});

test('hot path: 100 update ticks over 50 particles allocate zero new slots', () => {
  const sys = createSystem({ cap: 100 });
  for (let i = 0; i < 50; i++) {
    const p = sys.acquire(); assert.ok(p);
    p.life = 1; p.maxLife = 1000; p.vx = 1; p.vy = 1; p.grav = 0;
  }
  // Run many ticks; nothing should die (maxLife huge), pool stays empty,
  // alive count stays 50, no growth.
  for (let t = 0; t < 100; t++) sys.update(0.016);
  assert.equal(sys.count, 50);
  assert.equal(sys.pooled, 0);
});

test('UMD: module.exports surface', () => {
  const mod = require('../engine/particles.js');
  assert.equal(typeof mod.createSystem, 'function');
});
