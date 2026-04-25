'use strict';
// spawn.js — findNearestPassable BFS unit tests.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { findNearestPassable } = require(path.resolve(
  __dirname, '..', 'engine', 'spawn.js'
));

// 1 = wall (impassable), 0 = floor (passable). Tiny tile codes for tests.
const PASS = (t) => t === 0;

function makeMap(rows) {
  return rows.map(r => r.split('').map(c => c === '#' ? 1 : 0));
}

test('returns start tile when it is already passable', () => {
  const map = makeMap(['...', '...', '...']);
  const got = findNearestPassable(map, 1, 1, PASS);
  assert.deepEqual(got, { x: 1.5, y: 1.5 });
});

test('walks one tile to find a passable neighbour', () => {
  // Start on a wall surrounded by floor — should pick a 4-neighbour.
  const map = makeMap(['...', '.#.', '...']);
  const got = findNearestPassable(map, 1, 1, PASS);
  assert.ok(got, 'should find a tile');
  // Must be one of the 4 cardinal neighbours of (1,1)
  const candidates = [{x:1.5,y:0.5},{x:0.5,y:1.5},{x:2.5,y:1.5},{x:1.5,y:2.5}];
  assert.ok(candidates.some(c => c.x === got.x && c.y === got.y),
    `got ${JSON.stringify(got)} — expected a 4-neighbour of (1,1)`);
});

test('respects maxRadius (returns null when target is fully walled off)', () => {
  // Start in the dead-center of a 9x9 wall block. With maxRadius=2 the BFS
  // can't reach the floor at the edges (distance 4).
  const rows = [];
  for (let y = 0; y < 9; y++) {
    let r = '';
    for (let x = 0; x < 9; x++) {
      // Floor only at the outer ring (y==0 or y==8 or x==0 or x==8)
      const edge = (y === 0 || y === 8 || x === 0 || x === 8);
      r += edge ? '.' : '#';
    }
    rows.push(r);
  }
  const map = makeMap(rows);
  const got = findNearestPassable(map, 4, 4, PASS, { maxRadius: 2 });
  assert.equal(got, null, 'should give up at maxRadius before reaching edge');
  // With a larger radius it succeeds.
  const got2 = findNearestPassable(map, 4, 4, PASS, { maxRadius: 8 });
  assert.ok(got2, 'should find an edge floor with enough radius');
});

test('clamps out-of-bounds start coords to the map', () => {
  const map = makeMap(['#.', '..']);
  const got = findNearestPassable(map, -50, -50, PASS);
  // Start clamped to (0,0). It's a wall — BFS finds (1,0) or (0,1).
  assert.ok(got);
  assert.ok(
    (got.x === 1.5 && got.y === 0.5) || (got.x === 0.5 && got.y === 1.5),
    `got ${JSON.stringify(got)} — expected a neighbour of (0,0)`
  );
});

test('returns null on empty / malformed map', () => {
  assert.equal(findNearestPassable(null, 0, 0, PASS), null);
  assert.equal(findNearestPassable([], 0, 0, PASS), null);
  assert.equal(findNearestPassable([[]], 0, 0, PASS), null);
  assert.equal(findNearestPassable([[0]], 0, 0, null), null,
    'returns null when isPassable is not a function');
});

test('handles fractional input coords (used by world-space player.x/y)', () => {
  const map = makeMap(['..', '.#']);
  const got = findNearestPassable(map, 1.7, 1.3, PASS);
  // floor(1.7)=1, floor(1.3)=1 → wall. Neighbour at (0,1) or (1,0).
  assert.ok(got);
  assert.ok(
    (got.x === 0.5 && got.y === 1.5) || (got.x === 1.5 && got.y === 0.5),
    `got ${JSON.stringify(got)}`
  );
});
