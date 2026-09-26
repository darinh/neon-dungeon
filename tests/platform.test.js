// @ts-check
'use strict';

// src/platform.js owns the runtime tile vocabulary (T, isPassable,
// isSeeThrough). The generation fixture carries a copy for vm-based
// generator tests; the two must agree for every tile id or generator tests
// validate a different game than the one players run.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fixture = require('./_generation-fixture.js');

const ROOT = path.resolve(__dirname, '..');
const PLATFORM = fs.readFileSync(path.join(ROOT, 'src/platform.js'), 'utf8');

/** @param {string} name */
function extractFunction(name) {
  const start = PLATFORM.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' must exist');
  let depth = 0;
  for (let i = PLATFORM.indexOf('{', start); i < PLATFORM.length; i++) {
    if (PLATFORM[i] === '{') depth++;
    else if (PLATFORM[i] === '}' && --depth === 0) return PLATFORM.slice(start, i + 1);
  }
  assert.fail(name + ' unbalanced');
}

function loadRuntimeTiles() {
  const tLine = /const T = (\{[^}]*\});/.exec(PLATFORM);
  assert.ok(tLine, 'platform.js must declare the tile enum');
  // eslint-disable-next-line no-new-func -- evaluating project-owned source under test.
  return new Function(
    'const T = ' + tLine[1] + ';\n' + extractFunction('isPassable') + '\n' + extractFunction('isSeeThrough') +
    '\nreturn { T, isPassable, isSeeThrough };'
  )();
}

test('runtime tile enum and predicates match the generation fixture for every tile id', () => {
  const rt = loadRuntimeTiles();
  assert.deepEqual({ ...rt.T }, { ...fixture.T }, 'tile ids must be identical');
  for (const [name, id] of Object.entries(rt.T)) {
    assert.equal(fixture.isPassable(id), rt.isPassable(id), 'isPassable drift for ' + name);
    assert.equal(fixture.isSeeThrough(id), rt.isSeeThrough(id), 'isSeeThrough drift for ' + name);
  }
});

test('trial tiles: lattice nodes and consoles are walkable/see-through; the seam is an opaque wall', () => {
  const { T, isPassable, isSeeThrough } = loadRuntimeTiles();
  for (const id of [T.LOGIC_NODE, T.LOGIC_NODE_LIT, T.SYNC_CONSOLE]) {
    assert.equal(isPassable(id), true);
    assert.equal(isSeeThrough(id), true);
  }
  assert.equal(isPassable(T.SEAM_WALL), false, 'enemies/projectiles treat the seam as wall');
  assert.equal(isSeeThrough(T.SEAM_WALL), false, 'the vault interior stays hidden');
});

test('recordTypedKey keeps every printable key typed in one frame and skips non-printables', () => {
  // eslint-disable-next-line no-new-func -- evaluating project-owned source under test.
  const { recordTypedKey, max } = new Function(
    'const TYPED_CHARS_MAX = 32;\n' + extractFunction('recordTypedKey') + '\nreturn { recordTypedKey, max: TYPED_CHARS_MAX };'
  )();
  /** @type {string[]} */
  const buf = [];
  for (const key of ['F', 'A', 'Shift', 'S', 'T', 'Enter', ' ', 'y', 'ArrowLeft']) recordTypedKey(buf, key);
  assert.deepEqual(buf, ['F', 'A', 'S', 'T', ' ', 'y'], 'fast typing no longer collapses to the last key');
  for (let i = 0; i < 100; i++) recordTypedKey(buf, 'x');
  assert.equal(buf.length, max, 'buffer is bounded');
});

test('clearJust drains the typed-character buffer every frame', () => {
  const src = extractFunction('clearJust');
  assert.match(src, /typedChars\.length = 0;/);
  // eslint-disable-next-line no-new-func -- evaluating project-owned source under test.
  const run = new Function('_input', 'typedChars', '_G', 'blurSeedSetupInput',
    'let lastKey = "x"; let nameEntryTap = {};\n' + src + '\nclearJust(); return { lastKey, nameEntryTap };');
  const typed = ['a', 'b'];
  const out = run({ clearJust() {} }, typed, { state: 'PLAYING' }, () => {});
  assert.deepEqual(typed, []);
  assert.equal(out.lastKey, '');
  assert.equal(out.nameEntryTap, null);
});

test('clampToBossRoom never leaves an entity inside a sealed entrance, and keeps edge-ring floor usable', () => {
  const { T, isPassable } = loadRuntimeTiles();
  const r = { x: 10, y: 10, w: 15, h: 15 };
  /** @type {any} */
  const map = Array.from({ length: 40 }, () => new Array(40).fill(T.FLOOR));
  map[17][10] = T.WALL; // sealed west entrance on the room's own edge ring
  // eslint-disable-next-line no-new-func -- evaluating project-owned source under test.
  const load = (/** @type {any} */ g) => new Function('_G', 'isPassable', extractFunction('clampToBossRoom') + '\nreturn clampToBossRoom;')(g, isPassable);
  const sealed = load({ bossSealed: true, bossRoom: r, dungeon: { map } });
  const knocked = { x: 7.2, y: 17.5 }; // knocked west past the entrance
  sealed(knocked);
  assert.ok(map[Math.floor(knocked.y)][Math.floor(knocked.x)] !== T.WALL, `clamped into the sealed entrance at ${knocked.x}`);
  assert.equal(Math.floor(knocked.x), r.x + 1, 'pulled one tile inside the entrance');
  const edge = { x: 7.2, y: 14.5 }; // same push on a row with no entrance
  sealed(edge);
  assert.equal(edge.x, r.x + 0.5, 'ordinary edge-ring floor is still a valid clamp target');
  const open = load({ bossSealed: false, bossRoom: r, dungeon: { map } });
  const free = { x: 7.2, y: 17.5 };
  open(free);
  assert.equal(free.x, 7.2, 'no clamp before the arena seals');
});
