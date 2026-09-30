'use strict';
// Projectile wall/corner regression tests.
//
// content/projectiles.js is browser-loaded, so these tests execute the Projectile slice in
// a VM with the minimal global surface needed by Projectile.update().

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { extractDeclarationSpan } = require('./_source-files.js');

const CONTENT_PROJECTILES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content', 'projectiles.js'), 'utf8'
);

function projectileRuntime(width = 5, height = 5) {
  const projectileSection = extractDeclarationSpan(CONTENT_PROJECTILES, 'PROJECTILE_CAP', 'Projectile');

  const sandbox = {
    MAP_W: width,
    MAP_H: height,
    TILE: 32,
    T: { FLOOR: 0, WALL: 1, CRATE: 2 },
    _CG: { modifier: null, dungeon: { map: null } },
    vcores: [],
    beacons: [],
    shieldGens: [],
    cameras: [],
    lasers: [],
    mines: [],
    wallTurrets: [],
    particles: [],
    crateHits: [],
    detonations: [],
    ricochets: 0,
    audio: { ricochet() { sandbox.ricochets += 1; } },
    NEON: { draw: { line() {}, circle() {} } },
    ctx: { save() {}, restore() {}, set lineCap(_) {}, set globalAlpha(_) {}, set strokeStyle(_) {}, set shadowBlur(_) {}, set shadowColor(_) {}, set lineWidth(_) {}, set fillStyle(_) {} },
    hasAugment() { return false; },
    norm(x, y) {
      const d = Math.hypot(x, y) || 1;
      return [x / d, y / d];
    },
    dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); },
    isPlayerDamageImmune() { return false; },
    isPassable(t) { return t === 0; },
    damageBeacon() {},
    damageShieldGen() {},
    damageCamera() {},
    damageLaserEmitter() {},
    damageWallTurret() {},
    armMine() {},
  };
  sandbox.detonateGrenade = (x, y, dmg) => { sandbox.detonations.push({ x, y, dmg }); };
  sandbox.damageCrateAtTile = (x, y, dmg) => { sandbox.crateHits.push({ x, y, dmg }); };
  sandbox.spawnParticles = (x, y, type, colour, count) => { sandbox.particles.push({ x, y, type, colour, count }); };
  vm.createContext(sandbox);
  vm.runInContext(
    `${projectileSection}\nthis.Projectile = Projectile;`,
    sandbox
  );
  return sandbox;
}

function openMap(width = 5, height = 5) {
  return Array.from({ length: height }, () => Array(width).fill(0));
}

test('Projectile.update blocks straight-line tunneling across an intervening wall tile', () => {
  const rt = projectileRuntime();
  const map = openMap();
  map[1][2] = rt.T.WALL;
  rt._CG.dungeon.map = map;

  const p = new rt.Projectile(1.5, 1.5, 1, 0, 4, 7, 10, '#fff', false, true, 'Test Shot');
  p.update(0.5, map, { x: 4, y: 4, perks: {} }, []);

  assert.equal(p.dead, true, 'projectile should die when its swept path crosses a wall');
  assert.equal(Math.floor(p.x), 1, 'projectile should stop on the last passable tile before the wall');
  assert.equal(rt.particles.at(-1).type, 'SPARK', 'wall impact should still emit spark feedback');
});

test('Projectile.update blocks diagonal tunneling through touching wall corners', () => {
  const rt = projectileRuntime();
  const map = openMap();
  map[1][2] = rt.T.WALL;
  map[2][1] = rt.T.WALL;
  rt._CG.dungeon.map = map;

  const p = new rt.Projectile(1.5, 1.5, 1, 1, 6, 7, 10, '#fff', false, true, 'Test Shot');
  p.update(0.5, map, { x: 4, y: 4, perks: {} }, []);

  assert.equal(p.dead, true, 'projectile should not skip through a closed diagonal corner');
  assert.equal(Math.floor(p.x), 1, 'projectile should stop before the corner cut');
  assert.equal(Math.floor(p.y), 1, 'projectile should stop before the corner cut');
});

test('Projectile.update sweeps arbitrary slopes through every crossed wall tile', () => {
  const rt = projectileRuntime();
  const map = openMap();
  map[0][4] = rt.T.WALL;
  rt._CG.dungeon.map = map;

  const start = { x: 4.914, y: 3.262 };
  const end = { x: 3.864, y: 0.090 };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const p = new rt.Projectile(start.x, start.y, dx, dy, Math.hypot(dx, dy), 7, 10, '#fff', false, true, 'Test Shot');
  p.update(1, map, { x: 4, y: 4, perks: {} }, []);

  assert.equal(p.dead, true, 'projectile should die when an arbitrary-slope segment crosses a wall tile');
  assert.equal(Math.floor(p.x), 4, 'impact should be immediately before the crossed wall tile');
  assert.equal(Math.floor(p.y), 1, 'impact should be near the wall boundary, not the frame-start tile');
});

test('Projectile.update applies crate damage on swept collision', () => {
  const rt = projectileRuntime();
  const map = openMap();
  map[1][2] = rt.T.CRATE;
  rt._CG.dungeon.map = map;

  const p = new rt.Projectile(1.5, 1.5, 1, 0, 4, 7, 10, '#fff', false, true, 'Test Shot');
  p.update(0.5, map, { x: 4, y: 4, perks: {} }, []);

  assert.equal(p.dead, true, 'projectile should stop on a swept crate collision');
  assert.deepEqual(rt.crateHits, [{ x: 2, y: 1, dmg: 7 }], 'swept crate collision should damage the crate tile');
});

test('Projectile.update detonates grenades at swept impact, not frame start', () => {
  const rt = projectileRuntime();
  const map = openMap();
  map[1][4] = rt.T.WALL;
  rt._CG.dungeon.map = map;

  const p = new rt.Projectile(1.5, 1.5, 1, 0, 10, 0, 20, '#fff', false, true, 'Grenade');
  p.isGrenade = true;
  p.grenadeDmg = 42;
  p.update(0.5, map, { x: 4, y: 4, perks: {} }, []);

  assert.equal(p.dead, true, 'grenade should be consumed by swept wall collision');
  assert.equal(rt.detonations.length, 1, 'grenade should detonate once');
  assert.ok(rt.detonations[0].x > 3.9 && rt.detonations[0].x < 4,
    `grenade should detonate just before the wall, got x=${rt.detonations[0].x}`);
  assert.equal(rt.detonations[0].y, 1.5);
  assert.equal(rt.detonations[0].dmg, 42);
});

test('Projectile.update preserves ricochet on swept wall collisions', () => {
  const rt = projectileRuntime();
  const map = openMap();
  map[1][2] = rt.T.WALL;
  rt._CG.dungeon.map = map;

  const p = new rt.Projectile(1.5, 1.5, 1, 0, 4, 7, 10, '#fff', false, true, 'Ricochet Shot');
  p.bouncesLeft = 1;
  p.update(0.5, map, { x: 4, y: 4, perks: {} }, []);

  assert.equal(p.dead, false, 'ricochet projectile should survive the swept wall collision');
  assert.equal(p.bouncesLeft, 0, 'ricochet should consume one bounce');
  assert.ok(p.dx < 0, 'horizontal wall hit should flip x velocity');
  assert.equal(p.dy, 0, 'horizontal wall hit should preserve y velocity');
  assert.equal(rt.ricochets, 1, 'ricochet audio should still fire');
  assert.equal(Math.floor(p.x), 1, 'ricochet should resume from the last passable side of the wall');
});

test('Projectile.update sweep covers map-scale diagonal paths beyond 100 crossings', () => {
  const rt = projectileRuntime(80, 50);
  const map = openMap(80, 50);
  map[44][70] = rt.T.WALL;
  rt._CG.dungeon.map = map;

  const start = { x: 0.1, y: 0.1 };
  const end = { x: 79.9, y: 49.9 };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const p = new rt.Projectile(start.x, start.y, dx, dy, Math.hypot(dx, dy), 7, 200, '#fff', false, true, 'Long Shot');
  p.update(1, map, { x: 4, y: 4, perks: {} }, []);

  assert.equal(p.dead, true, 'long diagonal sweep should not stop after a fixed 100-step cap');
  assert.ok(Math.floor(p.x) === 70 && p.y < 44,
    `impact should occur before the far wall tile, got (${p.x}, ${p.y})`);
});

test('Projectile.update does not damage diagonal crates behind closed wall corners', () => {
  const rt = projectileRuntime();
  const map = openMap();
  map[1][2] = rt.T.WALL;
  map[2][1] = rt.T.WALL;
  map[2][2] = rt.T.CRATE;
  rt._CG.dungeon.map = map;

  const p = new rt.Projectile(1.5, 1.5, 1, 1, 6, 7, 10, '#fff', false, true, 'Test Shot');
  p.update(0.5, map, { x: 4, y: 4, perks: {} }, []);

  assert.equal(p.dead, true, 'projectile should be blocked by the closed corner');
  assert.deepEqual(rt.crateHits, [], 'closed-corner blockage must not damage the diagonal crate behind both walls');
});

test('Projectile.update ignores unrelated endpoint-corner blockers after a clear swept path', () => {
  const rt = projectileRuntime();
  const map = openMap();
  map[1][4] = rt.T.WALL;
  map[2][1] = rt.T.WALL;
  rt._CG.dungeon.map = map;

  const start = { x: 1.5, y: 1.5 };
  const end = { x: 4.5, y: 2.5 };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const p = new rt.Projectile(start.x, start.y, dx, dy, Math.hypot(dx, dy), 7, 10, '#fff', false, true, 'Clear Shot');
  p.update(1, map, { x: 4, y: 4, perks: {} }, []);

  assert.equal(p.dead, false, 'clear arbitrary-slope path should not be killed by endpoint-only corner blockers');
  assert.equal(Math.floor(p.x), 4);
  assert.equal(Math.floor(p.y), 2);
});

test('Projectile.update treats near-equal grid-vertex crossings as simultaneous', () => {
  const rt = projectileRuntime(10, 6);
  const map = openMap(10, 6);
  map[2][5] = rt.T.WALL;
  rt._CG.dungeon.map = map;

  const start = { x: 1.5, y: 1.5 };
  const end = { x: 8.5, y: 4.5 };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const p = new rt.Projectile(start.x, start.y, dx, dy, Math.hypot(dx, dy), 7, 20, '#fff', false, true, 'Vertex Graze');
  p.update(1, map, { x: 4, y: 4, perks: {} }, []);

  assert.equal(p.dead, false, 'single-wall vertex graze should not become a false wall hit from float drift');
  assert.equal(Math.floor(p.x), 8);
  assert.equal(Math.floor(p.y), 4);
});

test('Projectile.update damages crate side of arbitrary-slope closed corner ties', () => {
  const rt = projectileRuntime(10, 6);
  const map = openMap(10, 6);
  map[2][5] = rt.T.WALL;
  map[3][4] = rt.T.CRATE;
  rt._CG.dungeon.map = map;

  const start = { x: 1.5, y: 1.5 };
  const end = { x: 8.5, y: 4.5 };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const p = new rt.Projectile(start.x, start.y, dx, dy, Math.hypot(dx, dy), 7, 20, '#fff', false, true, 'Closed Corner');
  p.update(1, map, { x: 4, y: 4, perks: {} }, []);

  assert.equal(p.dead, true, 'wall+crate grid-vertex tie should be treated as a closed corner');
  assert.deepEqual(rt.crateHits, [{ x: 4, y: 3, dmg: 7 }], 'closed corner should damage the crate side tile, not skip it');
});

test('Projectile.update kills ricochet projectiles that sweep out of bounds', () => {
  const rt = projectileRuntime();
  const map = openMap();
  rt._CG.dungeon.map = map;

  const p = new rt.Projectile(3.5, 2.5, 1, 0, 4, 7, 10, '#fff', false, true, 'Edge Ricochet');
  p.bouncesLeft = 1;
  p.update(0.5, map, { x: 4, y: 4, perks: {} }, []);

  assert.equal(p.dead, true, 'ricochet projectile should die when sweeping out of bounds');
  assert.equal(p.bouncesLeft, 1, 'out-of-bounds exit should not consume a ricochet bounce');
  assert.equal(rt.ricochets, 0, 'out-of-bounds exit should not play ricochet audio');
});

test('Projectile.update kills ricochet projectiles that sweep diagonally out of bounds', () => {
  const rt = projectileRuntime();
  const map = openMap();
  rt._CG.dungeon.map = map;

  const p = new rt.Projectile(0.1, 0.1, -1, -1, 4, 7, 10, '#fff', false, true, 'Corner Ricochet');
  p.bouncesLeft = 1;
  p.update(0.5, map, { x: 4, y: 4, perks: {} }, []);

  assert.equal(p.dead, true, 'diagonal out-of-bounds exit should kill ricochet projectile');
  assert.equal(p.bouncesLeft, 1, 'diagonal out-of-bounds exit should not consume a ricochet bounce');
  assert.equal(rt.ricochets, 0, 'diagonal out-of-bounds exit should not play ricochet audio');
});

test('Projectile.update detonates grenades at swept out-of-bounds exit point', () => {
  const rt = projectileRuntime();
  const map = openMap();
  rt._CG.dungeon.map = map;

  const p = new rt.Projectile(1.5, 2.5, 1, 0, 10, 0, 20, '#fff', false, true, 'Grenade');
  p.isGrenade = true;
  p.grenadeDmg = 42;
  p.update(0.5, map, { x: 4, y: 4, perks: {} }, []);

  assert.equal(p.dead, true, 'grenade should be consumed when sweeping out of bounds');
  assert.equal(rt.detonations.length, 1, 'grenade should detonate once at the map edge');
  assert.ok(rt.detonations[0].x > 4.9 && rt.detonations[0].x < 5,
    `OOB grenade should detonate just inside the edge, got x=${rt.detonations[0].x}`);
  assert.equal(rt.detonations[0].y, 2.5);
  assert.equal(rt.detonations[0].dmg, 42);
});
