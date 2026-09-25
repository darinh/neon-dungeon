// @ts-check
'use strict';

// Player collision helper for the exploit trial seam (src/entities.js).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ENTITIES = fs.readFileSync(path.join(__dirname, '..', 'src', 'entities.js'), 'utf8');

/** @param {string} name */
function extractFunction(name) {
  const start = ENTITIES.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' must exist');
  let depth = 0;
  for (let i = ENTITIES.indexOf('{', start); i < ENTITIES.length; i++) {
    if (ENTITIES[i] === '{') depth++;
    else if (ENTITIES[i] === '}' && --depth === 0) return ENTITIES.slice(start, i + 1);
  }
  assert.fail(name + ' unbalanced');
}

const TILES = { WALL: 1, FLOOR: 2, SEAM_WALL: 30 };

/** @param {any} neon */
function loadPlayerTilePassable(neon) {
  // eslint-disable-next-line no-new-func -- evaluating project-owned source under test.
  return new Function('T', 'isPassable', 'NEON', '_EG',
    extractFunction('playerTilePassable') + '\nreturn playerTilePassable;'
  )(TILES, (/** @type {number} */ t) => t === TILES.FLOOR, neon, { tag: 'game' });
}

test('playerTilePassable matches isPassable for ordinary tiles', () => {
  const fn = loadPlayerTilePassable({ trials: { playerMayEnterSeam() { return true; } } });
  assert.equal(fn({}, TILES.FLOOR, 1, 1), true);
  assert.equal(fn({}, TILES.WALL, 1, 1), false, 'a wall never becomes passable');
});

test('playerTilePassable delegates only the seam tile to NEON.trials with the live game', () => {
  /** @type {any[]} */
  const calls = [];
  const fn = loadPlayerTilePassable({ trials: { playerMayEnterSeam(/** @type {any[]} */ ...args) { calls.push(args); return args[2] === 7; } } });
  const player = { x: 7.5, y: 3.5 };
  assert.equal(fn(player, TILES.SEAM_WALL, 7, 3), true);
  assert.equal(fn(player, TILES.SEAM_WALL, 8, 3), false);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], [{ tag: 'game' }, player, 7, 3]);
  const noTrials = loadPlayerTilePassable(undefined);
  assert.equal(noTrials(player, TILES.SEAM_WALL, 7, 3), false, 'without the trials module the seam is a wall');
});

test('dash and walk collision both use the seam-aware helper; each dash gets a new serial', () => {
  assert.equal((ENTITIES.match(/noClip \|\| playerTilePassable\(this, map\[/g) || []).length, 4);
  assert.match(ENTITIES, /this\.dashTimer=0\.12;\s*\n\s*this\._dashSerial = \(this\._dashSerial \| 0\) \+ 1;/);
});
