'use strict';
// @ts-check

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readSourceFile } = require('./_source-files.js');

const ENTITIES = readSourceFile(__dirname, 'entities');
const ENEMY_MIMIC = readSourceFile(__dirname, 'entitiesEnemyMimic');
const ENEMY_NEXUS = readSourceFile(__dirname, 'entitiesEnemyNexus');

function makeEnemyCtor() {
  return function Enemy() {};
}

test('MIMIC aiMimic is extracted and callable from an Enemy instance', () => {
  const events = [];
  const sandbox = {
    Enemy: makeEnemyCtor(),
    audio: { mimicReveal: () => events.push(['audio']) },
    spawnParticles: (...args) => events.push(['particles', ...args]),
    triggerShake: (...args) => events.push(['shake', ...args]),
    _EG: { msg: (...args) => events.push(['msg', ...args]) },
    norm: (x, y) => {
      const len = Math.hypot(x, y) || 1;
      return [x / len, y / len];
    },
  };

  vm.runInNewContext(ENEMY_MIMIC, sandbox);
  const mimic = new sandbox.Enemy();
  Object.assign(mimic, {
    x: 0,
    y: 0,
    _tx: 3,
    _ty: 4,
    _disguised: true,
    _revealTimer: 0,
    _mimicBob: 0,
    _canTarget: () => true,
  });

  mimic.aiMimic(0.25, {}, {}, 1.4, true);

  assert.equal(mimic._disguised, false);
  assert.equal(mimic._revealTimer, 0.3);
  assert.equal(mimic._mimicBob, 0.5);
  assert.deepEqual([mimic._mimicLungeDx, mimic._mimicLungeDy], [0.6, 0.8]);
  assert.deepEqual(events.at(-1), ['msg', '⚠ MIMIC!', '#cc33ff']);
});

test('MIMIC aiMimic preserves reveal lunge and burst chase behavior', () => {
  const sandbox = {
    Enemy: makeEnemyCtor(),
    audio: { mimicReveal: () => {} },
    spawnParticles: () => {},
    triggerShake: () => {},
    _EG: { msg: () => {} },
    norm: (x, y) => {
      const len = Math.hypot(x, y) || 1;
      return [x / len, y / len];
    },
  };

  vm.runInNewContext(ENEMY_MIMIC, sandbox);
  const mimic = new sandbox.Enemy();
  Object.assign(mimic, {
    x: 0,
    y: 0,
    _tx: 4,
    _ty: 0,
    _disguised: false,
    _revealTimer: 0.1,
    spd: 2,
    zigzag: 0,
    _canTarget: () => true,
    meleeAttack: (target) => { mimic.meleeTarget = target; },
    moveToward: (...args) => { mimic.moved = args; },
    patrol: (...args) => { mimic.patrolled = args; },
  });
  const player = { id: 'player' };

  mimic.aiMimic(0.2, player, { id: 'map' }, 2.0, true);
  assert.equal(mimic._mimicBurstTimer, 3.0);
  assert.equal(mimic.meleeTarget, player);

  mimic._revealTimer = 0;
  mimic.aiMimic(0.5, player, { id: 'map' }, 5.0, true);
  assert.equal(mimic._mimicBurstTimer, 2.5);
  assert.ok(mimic.moved[2] > mimic.spd, 'burst timer should boost chase speed');

  const blind = new sandbox.Enemy();
  Object.assign(blind, {
    x: 0,
    y: 0,
    _tx: 10,
    _ty: 0,
    _disguised: false,
    _revealTimer: 0,
    spd: 2,
    zigzag: 0,
    _canTarget: () => false,
    moveToward: () => {},
    meleeAttack: () => {},
    patrol: (...args) => { blind.patrolled = args; },
  });
  blind.aiMimic(0.25, player, { id: 'blind-map' }, 9.0, false);
  assert.deepEqual(blind.patrolled, [0.25, { id: 'blind-map' }]);
});

test('NEXUS aiNexus is extracted and preserves link, fire, drift, and patrol paths', () => {
  const sandbox = {
    Enemy: makeEnemyCtor(),
    _EG: { modifier: '' },
    dist: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
    enemiesInRoomIter: () => [],
    audio: { nexusLink: () => {} },
  };

  vm.runInNewContext(ENEMY_NEXUS, sandbox);
  const nexus = new sandbox.Enemy();
  Object.assign(nexus, {
    x: 0,
    y: 0,
    _tx: 8,
    _ty: 0,
    spd: 2,
    atk: 7,
    _nxLinks: [{}, {}, {}],
    _nxLinkTimer: 0,
    _nxFireTimer: 0,
    berserkerMul: () => 2,
    _nxUpdateLinks: () => { nexus.updatedLinks = true; },
    _nxFindAllyCluster: () => ({ x: 6, y: 0 }),
    fireAt: (...args) => { nexus.fired = args; },
    moveToward: (...args) => { nexus.moved = args; },
    patrol: (...args) => { nexus.patrolled = args; },
  });

  nexus.aiNexus(0.2, {}, { id: 'map' }, 8, true);

  assert.equal(nexus.updatedLinks, true);
  assert.equal(nexus._nxLinkTimer, 0.5);
  assert.deepEqual(nexus.fired, [8, 0, 6, 7, 12, '#00eedd']);
  assert.equal(nexus._nxFireTimer, Math.max(1.0, 2.0 - 3 * 0.33) / 2);
  assert.deepEqual(nexus.moved, [6, 0, 0.8, 0.2, { id: 'map' }]);

  const blind = new sandbox.Enemy();
  Object.assign(blind, {
    x: 0,
    y: 0,
    _tx: 8,
    _ty: 0,
    spd: 2,
    atk: 7,
    _nxLinks: [],
    berserkerMul: () => 1,
    _nxUpdateLinks: () => {},
    _nxFindAllyCluster: () => null,
    fireAt: () => {},
    moveToward: () => {},
    patrol: (...args) => { blind.patrolled = args; },
  });
  blind.aiNexus(0.1, {}, { id: 'blind-map' }, 8, false);
  assert.deepEqual(blind.patrolled, [0.1, { id: 'blind-map' }]);
});

test('MIMIC and NEXUS AI bodies stay out of src/entities.js dispatch host', () => {
  assert.match(ENTITIES, /case\s+'MIMIC':\s*this\.aiMimic\(dt,player,map,d,los\);/);
  assert.match(ENTITIES, /case\s+'NEXUS':\s*this\.aiNexus\(dt,player,map,d,los\);/);
  assert.doesNotMatch(ENTITIES, /aiMimic\s*\(\s*dt\s*,\s*player\s*,\s*map\s*,\s*d\s*,\s*los\s*\)\s*\{/);
  assert.doesNotMatch(ENTITIES, /aiNexus\s*\(\s*dt\s*,\s*player\s*,\s*map\s*,\s*d\s*,\s*los\s*\)\s*\{/);
  assert.match(ENEMY_MIMIC, /Enemy\.prototype\.aiMimic\s*=\s*function\s+aiMimic\s*\(/);
  assert.match(ENEMY_NEXUS, /Enemy\.prototype\.aiNexus\s*=\s*function\s+aiNexus\s*\(/);
});
