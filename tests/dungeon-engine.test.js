'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const topology = require('../engine/dungeon/topology.js');
const reachability = require('../engine/dungeon/reachability.js');

test('dungeon topology engine carves BSP rooms and corridors with injected tiles', () => {
  const ints = [12, 12, 6, 6, 1, 1, 6, 6, 1, 1];
  const randomCalls = [];
  const dungeon = topology.createBspDungeon({
    width: 20,
    height: 12,
    depth: 1,
    wallTile: 1,
    floorTile: 2,
    rand: () => { randomCalls.push('rand'); return 0; },
    rndInt(min, max) {
      randomCalls.push(`rndInt:${min}-${max}`);
      const next = ints.shift();
      return Math.max(min, Math.min(max, next ?? min));
    },
  });

  assert.equal(dungeon.map.length, 12);
  assert.equal(dungeon.map[0].length, 20);
  assert.ok(dungeon.rooms.length >= 1);
  assert.ok(dungeon.map.some((row) => Array.from(row).includes(2)), 'expected at least one carved floor tile');
  assert.deepEqual(dungeon.rooms.map(({ x, y, w, h, cx, cy }) => ({ x, y, w, h, cx, cy })), [
    { x: 2, y: 1, w: 10, h: 6, cx: 7, cy: 4 },
    { x: 14, y: 1, w: 5, h: 6, cx: 16, cy: 4 },
  ]);
  assert.equal(dungeon.map[4][12], 2, 'corridor should connect the deterministic rooms');
  assert.deepEqual(randomCalls, [
    'rndInt:8-12',
    'rndInt:5-10',
    'rndInt:5-10',
    'rndInt:1-2',
    'rndInt:1-5',
    'rndInt:5-6',
    'rndInt:5-10',
    'rndInt:1-2',
    'rndInt:1-5',
  ]);
});

test('dungeon reachability solver reports physical key-lock progression facts', () => {
  const W = 8, H = 4;
  const map = Array.from({ length: H }, () => new Uint8Array(W).fill(1));
  map[1][1] = 2;
  map[1][2] = 2;
  map[1][3] = 7;
  map[1][4] = 2;
  map[1][5] = 3;

  const solved = reachability.solveKeyLockReachability({
    map,
    start: { x: 1, y: 1 },
    keys: [{ x: 2, y: 1, colour: 'red' }],
    requiredRooms: [{ x: 4, y: 1, w: 2, h: 1, cx: 4, cy: 1 }],
    isOpenTile: (tile) => tile === 2 || tile === 3,
    lockColourForTile: (tile) => tile === 7 ? 'red' : null,
  });

  assert.equal(solved.collectedColours.has('red'), true);
  assert.equal(solved.reachable[1][5], 1);
  assert.deepEqual(solved.unreachableRooms, []);
  assert.deepEqual(solved.missingColours, []);
});

test('dungeon reachability solver does not treat locks as open without keys', () => {
  const W = 8, H = 4;
  const map = Array.from({ length: H }, () => new Uint8Array(W).fill(1));
  map[1][1] = 2;
  map[1][2] = 2;
  map[1][3] = 7;
  map[1][4] = 2;

  const solved = reachability.solveKeyLockReachability({
    map,
    start: { x: 1, y: 1 },
    keys: [],
    requiredRooms: [{ x: 4, y: 1, w: 1, h: 1, cx: 4, cy: 1 }],
    isOpenTile: (tile) => tile === 2,
    lockColourForTile: (tile) => tile === 7 ? 'red' : null,
  });

  assert.equal(solved.collectedColours.has('red'), false);
  assert.equal(solved.reachable[1][4], 0);
  assert.equal(solved.unreachableRooms.length, 1);
  assert.deepEqual(solved.missingColours, ['red']);
});
