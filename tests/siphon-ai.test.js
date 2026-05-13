'use strict';
// @ts-check

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readSourceFile } = require('./_source-files.js');

const ENEMY_SIPHON = readSourceFile(__dirname, 'entitiesEnemySiphon');

function makeSandbox(events = []) {
  return {
    Enemy: function Enemy() {},
    audio: { siphonFrenzy: () => events.push(['audio']) },
    spawnParticles: (...args) => events.push(['particles', ...args]),
    _EG: { modifier: 'OVERCLOCK' },
  };
}

test('aiSiphon prototype helper is callable and preserves frenzy drain firing', () => {
  const events = [];
  const sandbox = makeSandbox(events);
  vm.runInNewContext(ENEMY_SIPHON, sandbox);
  const siphon = new sandbox.Enemy();
  const fireCalls = [];
  const map = { id: 'map' };
  Object.assign(siphon, {
    x: 0,
    y: 0,
    _tx: 5,
    _ty: 0,
    hp: 3,
    maxHp: 10,
    atk: 6,
    spd: 2,
    _spFrenzy: false,
    _spFireTimer: 0,
    _spDrainBeam: { t: 0.1 },
    berserkerMul: () => 2,
    fireAt: (...args) => { fireCalls.push(args); },
    moveToward: () => { throw new Error('in-range SIPHON should not move'); },
    patrol: () => { throw new Error('in-range SIPHON should not patrol'); },
  });

  siphon.aiSiphon(0.25, {}, map, 5, true);

  assert.equal(siphon._spFrenzy, true);
  assert.deepEqual(events[0], ['audio']);
  assert.deepEqual(events[1], ['particles', 0, 0, 'SPARK', '#dd2244', 12]);
  assert.equal(siphon._spDrainBeam, null);
  assert.deepEqual(fireCalls, [[5, 0, 7, 6, 12, '#dd2244']]);
  assert.equal(siphon._spFireTimer, 1 / 1.2 / 2);

  fireCalls.length = 0;
  siphon._spFireTimer = 0.5;
  siphon.aiSiphon(0.1, {}, map, 5, true);
  assert.deepEqual(fireCalls, []);
  assert.ok(Math.abs(siphon._spFireTimer - 0.4) < 1e-12);
});

test('aiSiphon prototype helper preserves range movement and patrol branches', () => {
  const sandbox = makeSandbox();
  sandbox._EG.modifier = '';
  vm.runInNewContext(ENEMY_SIPHON, sandbox);
  const calls = [];
  const map = { id: 'map' };
  const siphon = new sandbox.Enemy();
  Object.assign(siphon, {
    x: 0,
    y: 0,
    _tx: 3,
    _ty: 4,
    hp: 10,
    maxHp: 10,
    atk: 6,
    spd: 2,
    _spFireTimer: 3,
    berserkerMul: () => 1,
    fireAt: (...args) => { calls.push(['fireAt', ...args]); },
    moveToward: (...args) => { calls.push(['moveToward', ...args]); },
    patrol: (...args) => { calls.push(['patrol', ...args]); },
  });

  siphon.aiSiphon(0.25, {}, map, 3, true);
  siphon.aiSiphon(0.5, {}, map, 10, true);
  siphon.aiSiphon(0.75, {}, map, 10, false);

  assert.deepEqual(calls, [
    ['moveToward', -3, -4, 2, 0.25, map],
    ['moveToward', 3, 4, 1.2, 0.5, map],
    ['patrol', 0.75, map],
  ]);
});
