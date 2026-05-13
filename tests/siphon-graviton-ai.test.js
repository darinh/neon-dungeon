'use strict';
// @ts-check

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readSourceFile } = require('./_source-files.js');

const ENTITIES = readSourceFile(__dirname, 'entities');
const ENEMY_SIPHON = readSourceFile(__dirname, 'entitiesEnemySiphon');
const ENEMY_GRAVITON = readSourceFile(__dirname, 'entitiesEnemyGraviton');

function makeEnemyCtor() {
  return function Enemy() {};
}

test('SIPHON aiSiphon is extracted and preserves frenzy fire behavior', () => {
  const events = [];
  const sandbox = {
    Enemy: makeEnemyCtor(),
    _EG: { modifier: 'OVERCLOCK' },
    audio: { siphonFrenzy: () => events.push(['audio']) },
    spawnParticles: (...args) => events.push(['particles', ...args]),
  };

  vm.runInNewContext(ENEMY_SIPHON, sandbox);
  const siphon = new sandbox.Enemy();
  Object.assign(siphon, {
    x: 2,
    y: 2,
    _tx: 8,
    _ty: 2,
    hp: 3,
    maxHp: 10,
    atk: 4,
    spd: 2,
    _spFireTimer: 0,
    _spDrainBeam: { t: 0.5 },
    berserkerMul: () => 2,
    fireAt: (...args) => { siphon.fired = args; },
    moveToward: (...args) => { siphon.moved = args; },
    patrol: (...args) => { siphon.patrolled = args; },
  });

  siphon.aiSiphon(0.25, {}, { id: 'map' }, 8, true);

  assert.equal(siphon._spFrenzy, true);
  assert.deepEqual(events[0], ['audio']);
  assert.deepEqual(events[1], ['particles', 2, 2, 'SPARK', '#dd2244', 12]);
  assert.deepEqual(siphon.fired, [8, 2, 7, 4, 12, '#dd2244']);
  assert.equal(siphon._spFireTimer, 1 / 1.2 / 2);
  assert.equal(siphon._spDrainBeam.t, 0.25);
  assert.equal(siphon.moved, undefined);
  assert.equal(siphon.patrolled, undefined);
});

test('GRAVITON aiGraviton is extracted and preserves gravity well deployment', () => {
  const gravityWells = [];
  const events = [];
  const sandbox = {
    Enemy: makeEnemyCtor(),
    _EG: { dungeon: { rooms: [{ x: 0, y: 0, w: 10, h: 10 }] } },
    MAP_W: 20,
    MAP_H: 20,
    gravityWells,
    audio: { gravitonDeploy: () => events.push(['audio']) },
    spawnParticles: (...args) => events.push(['particles', ...args]),
    hasAugment: () => false,
    isPassable: () => true,
    modSpeed: speed => speed,
    norm: (x, y) => {
      const len = Math.hypot(x, y) || 1;
      return [x / len, y / len];
    },
    rand: () => 0.5,
  };

  vm.runInNewContext(ENEMY_GRAVITON, sandbox);
  const graviton = new sandbox.Enemy();
  Object.assign(graviton, {
    x: 0,
    y: 0,
    _tx: 5,
    _ty: 6,
    atk: 3,
    spd: 2,
    slowFactor: 1,
    colour: '#8833ff',
    _gvWells: [],
    _gvDeployTimer: 0,
    _gvFireTimer: 0,
    berserkerMul: () => 2,
    _canTarget: () => true,
    fireAt: (...args) => { graviton.fired = args; },
    moveToward: (...args) => { graviton.moved = args; },
    patrol: (...args) => { graviton.patrolled = args; },
  });
  const map = Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => 1));

  graviton.aiGraviton(0.25, {}, map, 7, true);

  assert.equal(graviton.state, 'ATTACK');
  assert.equal(gravityWells.length, 1);
  assert.equal(graviton._gvWells.length, 1);
  assert.equal(gravityWells[0].x, 5);
  assert.equal(gravityWells[0].y, 6);
  assert.equal(gravityWells[0].owner, graviton);
  assert.equal(gravityWells[0].room, sandbox._EG.dungeon.rooms[0]);
  assert.equal(graviton._gvDeployTimer, 5 / 2);
  assert.deepEqual(events[0], ['audio']);
  assert.deepEqual(events[1], ['particles', 5, 6, 'EXPLOSION', '#8833ff', 10]);
  assert.equal(graviton.fired, undefined);
  assert.equal(graviton.moved, undefined);
  assert.equal(graviton.patrolled, undefined);
});

test('SIPHON aiSiphon preserves retreat, chase, and patrol branches', () => {
  const sandbox = {
    Enemy: makeEnemyCtor(),
    _EG: { modifier: '' },
    audio: { siphonFrenzy: () => {} },
    spawnParticles: () => {},
  };
  vm.runInNewContext(ENEMY_SIPHON, sandbox);

  const close = new sandbox.Enemy();
  Object.assign(close, {
    x: 4,
    y: 4,
    _tx: 6,
    _ty: 4,
    hp: 10,
    maxHp: 10,
    spd: 2,
    _spFireTimer: 1,
    berserkerMul: () => 1,
    moveToward: (...args) => { close.moved = args; },
    fireAt: () => { close.fired = true; },
    patrol: () => { close.patrolled = true; },
  });
  close.aiSiphon(0.1, {}, { id: 'map' }, 3, true);
  assert.deepEqual(close.moved, [2, 4, 2, 0.1, { id: 'map' }]);
  assert.equal(close.fired, undefined);
  assert.equal(close.patrolled, undefined);

  const far = new sandbox.Enemy();
  Object.assign(far, {
    x: 0,
    y: 0,
    _tx: 10,
    _ty: 0,
    hp: 10,
    maxHp: 10,
    spd: 2,
    _spFireTimer: 1,
    berserkerMul: () => 1,
    moveToward: (...args) => { far.moved = args; },
    fireAt: () => { far.fired = true; },
    patrol: () => { far.patrolled = true; },
  });
  far.aiSiphon(0.2, {}, { id: 'far-map' }, 10, true);
  assert.deepEqual(far.moved, [10, 0, 1.2, 0.2, { id: 'far-map' }]);
  assert.equal(far.fired, undefined);
  assert.equal(far.patrolled, undefined);

  const blind = new sandbox.Enemy();
  Object.assign(blind, {
    x: 0,
    y: 0,
    _tx: 10,
    _ty: 0,
    hp: 10,
    maxHp: 10,
    _spFireTimer: 1,
    berserkerMul: () => 1,
    moveToward: () => { blind.moved = true; },
    fireAt: () => { blind.fired = true; },
    patrol: (...args) => { blind.patrolled = args; },
  });
  blind.aiSiphon(0.3, {}, { id: 'blind-map' }, 8, false);
  assert.deepEqual(blind.patrolled, [0.3, { id: 'blind-map' }]);
  assert.equal(blind.fired, undefined);
  assert.equal(blind.moved, undefined);
});

test('GRAVITON aiGraviton preserves fallback fire, retreat, and patrol branches', () => {
  const sandbox = {
    Enemy: makeEnemyCtor(),
    _EG: { dungeon: { rooms: [] } },
    MAP_W: 20,
    MAP_H: 20,
    gravityWells: [],
    audio: { gravitonDeploy: () => {} },
    spawnParticles: () => {},
    hasAugment: () => false,
    isPassable: tile => tile === 1,
    modSpeed: speed => speed,
    norm: (x, y) => {
      const len = Math.hypot(x, y) || 1;
      return [x / len, y / len];
    },
    rand: () => 0.5,
  };
  vm.runInNewContext(ENEMY_GRAVITON, sandbox);
  const map = Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => 1));

  const fallback = new sandbox.Enemy();
  Object.assign(fallback, {
    x: 0,
    y: 0,
    _tx: 8,
    _ty: 0,
    atk: 5,
    spd: 2,
    slowFactor: 1,
    colour: '#8833ff',
    _gvWells: [{ dead: true }, { dead: false }],
    _gvDeployTimer: 1,
    _gvFireTimer: 0,
    berserkerMul: () => 2,
    _canTarget: () => true,
    fireAt: (...args) => { fallback.fired = args; },
    moveToward: (...args) => { fallback.moved = args; },
    patrol: (...args) => { fallback.patrolled = args; },
  });
  fallback.aiGraviton(0.25, {}, map, 7, true);
  assert.equal(fallback._gvWells.length, 1);
  assert.deepEqual(fallback.fired, [8, 0, 6, 5, 10, '#8833ff']);
  assert.equal(fallback._gvFireTimer, 3 / 2);
  assert.equal(fallback.moved, undefined);
  assert.equal(fallback.patrolled, undefined);

  const close = new sandbox.Enemy();
  Object.assign(close, {
    x: 4,
    y: 4,
    _tx: 6,
    _ty: 4,
    spd: 2,
    slowFactor: 1,
    _gvWells: [],
    _gvDeployTimer: 1,
    _gvFireTimer: 1,
    berserkerMul: () => 1,
    patrol: (...args) => { close.patrolled = args; },
  });
  close.aiGraviton(0.5, {}, map, 3, true);
  assert.equal(close.x, 3);
  assert.equal(close.y, 4);
  assert.equal(close.patrolled, undefined);

  const blind = new sandbox.Enemy();
  Object.assign(blind, {
    x: 0,
    y: 0,
    _tx: 8,
    _ty: 0,
    spd: 2,
    slowFactor: 1,
    _gvWells: [],
    _gvDeployTimer: 1,
    _gvFireTimer: 1,
    berserkerMul: () => 1,
    fireAt: () => { blind.fired = true; },
    moveToward: () => { blind.moved = true; },
    patrol: (...args) => { blind.patrolled = args; },
  });
  blind.aiGraviton(0.3, {}, map, 8, false);
  assert.deepEqual(blind.patrolled, [0.3, map]);
  assert.equal(blind.fired, undefined);
  assert.equal(blind.moved, undefined);
});

test('SIPHON and GRAVITON AI bodies stay out of src/entities.js dispatch host', () => {
  assert.match(ENTITIES, /case\s+'SIPHON':\s*this\.aiSiphon\(dt,player,map,d,los\);/);
  assert.match(ENTITIES, /case\s+'GRAVITON':\s*this\.aiGraviton\(dt,player,map,d,los\);/);
  assert.doesNotMatch(ENTITIES, /aiSiphon\s*\(\s*dt\s*,\s*player\s*,\s*map\s*,\s*d\s*,\s*los\s*\)\s*\{/);
  assert.doesNotMatch(ENTITIES, /aiGraviton\s*\(\s*dt\s*,\s*player\s*,\s*map\s*,\s*d\s*,\s*los\s*\)\s*\{/);
  assert.match(ENEMY_SIPHON, /Enemy\.prototype\.aiSiphon\s*=\s*function\s+aiSiphon\s*\(/);
  assert.match(ENEMY_GRAVITON, /Enemy\.prototype\.aiGraviton\s*=\s*function\s+aiGraviton\s*\(/);
});
