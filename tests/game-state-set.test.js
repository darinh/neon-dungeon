// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const gameStates = require(path.join(ROOT, 'src/game-states.js'));
const GAME = read('src/game.js');
const PLATFORM = read('src/platform.js');

/** @param {string} file */
function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

/** @param {Iterable<string>} states */
function assertKnown(states) {
  for (const state of states) {
    assert.equal(gameStates.GAME_STATES_SET.has(state), true, state + ' must be in GAME_STATES');
  }
}

/**
 * @param {string} src
 * @param {RegExp} pattern
 */
function collectMatches(src, pattern) {
  return [...src.matchAll(pattern)].map((m) => m[1]).filter((v) => typeof v === 'string');
}

test('derived game-state sets only contain canonical states', () => {
  assertKnown(Object.values(gameStates.GAME_STATES));
  assertKnown(gameStates.PAUSABLE_STATES);
  assertKnown(gameStates.RUN_SAVE_STATES);
  assertKnown(gameStates.TOUCH_ROUTE_AS_CLICK_STATES);
  assertKnown(gameStates.PAUSE_ACTION_STATES);
});

test('game update and render switch cases are declared in GAME_STATES', () => {
  assertKnown(collectMatches(GAME, /case '([A-Z_]+)'/g));
});

test('game-level state assignments are declared in GAME_STATES', () => {
  const assigned = [
    ...collectMatches(GAME, /\bthis\.setState\('([A-Z_]+)'/g),
    ...collectMatches(GAME, /\bthis\.state\s*=\s*'([A-Z_]+)'/g),
    ...collectMatches(GAME, /\bgame\.state\s*=\s*'([A-Z_]+)'/g),
    ...collectMatches(GAME, /\bstate:\s*'([A-Z_]+)'/g),
    ...collectMatches(read('src/meta/hub.js'), /\bgame\.setState\('([A-Z_]+)'/g),
    ...collectMatches(read('src/meta/hub.js'), /\bgame\.state\s*=\s*'([A-Z_]+)'/g),
    ...collectMatches(read('src/content.js'), /\bgm\.setState\('([A-Z_]+)'/g),
    ...collectMatches(PLATFORM, /\b_G\.setState\('([A-Z_]+)'/g),
  ];
  assertKnown(assigned);
});

test('platform touch state checks are declared in GAME_STATES', () => {
  const platformStateChecks = [
    ...collectMatches(PLATFORM, /_G\.state\s*={2,3}\s*'([A-Z_]+)'/g),
    ...collectMatches(PLATFORM, /_G\.state\s*!={1,2}\s*'([A-Z_]+)'/g),
  ];
  assertKnown(platformStateChecks);
  assert.match(PLATFORM, /TOUCH_ROUTE_AS_CLICK_STATES\.has\(_G\.state\)/);
});

test('run-save and pausable states come from the centralized module', () => {
  assert.equal(gameStates.RUN_SAVE_STATES.has(gameStates.GAME_STATES.WEAPON_SWAP), true);
  assert.equal(gameStates.PAUSABLE_STATES.has(gameStates.GAME_STATES.PLAYING), true);
  assert.match(PLATFORM, /const _RUN_SAVE_STATES = _PG_STATE_DEFS\.RUN_SAVE_STATES/);
  assert.match(PLATFORM, /const _PAUSABLE_STATES = _PG_STATE_DEFS\.PAUSABLE_STATES/);
});

test('src files do not declare independent game-state arrays or sets', () => {
  const stateValues = new Set(Object.values(gameStates.GAME_STATES));
  const files = [
    'src/content.js',
    'src/entities.js',
    'src/game.js',
    'src/meta/hub.js',
    'src/meta/intro.js',
    'src/platform.js',
    'src/render.js',
    ...fs.readdirSync(path.join(ROOT, 'src/data')).map((file) => 'src/data/' + file),
    ...fs.readdirSync(path.join(ROOT, 'src/meta')).map((file) => 'src/meta/' + file),
  ].filter((file, index, all) => file.endsWith('.js') && file !== 'src/game-states.js' && all.indexOf(file) === index);

  for (const file of files) {
    const src = read(file);
    for (const match of src.matchAll(/(?:new\s+Set\s*\()?\[([\s\S]*?)\]/g)) {
      const strings = [...String(match[1] || '').matchAll(/'([A-Z_]+)'/g)]
        .map((m) => m[1])
        .filter((value) => value !== undefined && stateValues.has(value));
      assert.ok(
        strings.length < 3,
        file + ' must not declare an independent array/set of game states: ' + strings.join(', ')
      );
    }
  }
});
