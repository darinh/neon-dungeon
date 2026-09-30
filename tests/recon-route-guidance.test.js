// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { extractDeclarationSpan, readSourceFile } = require('./_source-files.js');

const RENDER = readSourceFile(__dirname, 'render');
const GAME = readSourceFile(__dirname, 'game');

const T = Object.freeze({
  VOID: 0,
  WALL: 1,
  FLOOR: 2,
  STAIRS: 3,
  TERMINAL: 4,
  DOOR: 5,
  DOOR_OPEN: 6,
  LOCKED_R: 7,
  LOCKED_B: 8,
  LOCKED_G: 9,
});

function loadReconRouteHooks() {
  const source = extractDeclarationSpan(RENDER, 'RECON_ROUTE_DX', 'drawReconRouteOverlay') + `
    hooks = {
      computeReconRoute,
      findReconObjectiveTile,
      getReconRoute,
      isReconRoutePassable,
      shouldDrawReconRoute
    };
  `;
  const context = {
    T,
    hooks: null,
    NEON: {
      biomes: { finalFloor: () => 15 },
      boosts: { hasBoost: (/** @type {any} */ player, /** @type {string} */ id) => !!(player && player.activeBoosts && player.activeBoosts[id]) },
    },
    isPassable: (/** @type {any} */ tile) => tile === T.FLOOR || tile === T.STAIRS || tile === T.TERMINAL || tile === T.DOOR_OPEN,
    doorKeyColour: (/** @type {any} */ tile) => tile === T.LOCKED_R ? 'red' : tile === T.LOCKED_B ? 'blue' : tile === T.LOCKED_G ? 'gold' : null,
  };
  vm.runInNewContext(source, context);
  assert.ok(context.hooks, 'RECON route hooks should load');
  return /** @type {any} */ (context.hooks);
}

/** @param {any[][]} map */
function dungeonFromMap(map) {
  return { map, _mapMutationVersion: 0 };
}

/** @param {any} value */
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('RECON route uses ordinary doors but blocks locked doors without keys', () => {
  const hooks = loadReconRouteHooks();
  const player = /** @type {any} */ ({ x: 0, y: 1, keys: {} });
  const gameState = { floor: 1, bossAlive: false };
  const openDoorRoute = hooks.computeReconRoute(dungeonFromMap([
    [T.WALL, T.WALL, T.WALL, T.WALL],
    [T.FLOOR, T.DOOR, T.FLOOR, T.STAIRS],
    [T.WALL, T.WALL, T.WALL, T.WALL],
  ]), player, gameState, {});
  assert.deepEqual(plain(openDoorRoute.points.map((/** @type {any} */ p) => [p.x, p.y])), [[0, 1], [1, 1], [2, 1], [3, 1]]);

  const lockedRoute = hooks.computeReconRoute(dungeonFromMap([
    [T.WALL, T.WALL, T.WALL, T.WALL, T.WALL],
    [T.FLOOR, T.DOOR, T.FLOOR, T.LOCKED_R, T.STAIRS],
    [T.WALL, T.WALL, T.WALL, T.WALL, T.WALL],
  ]), player, gameState, {});
  assert.equal(lockedRoute, null, 'unowned locked doors must not become route shortcuts');

  player.keys.red = 1;
  const keyedRoute = hooks.computeReconRoute(dungeonFromMap([
    [T.WALL, T.WALL, T.WALL, T.WALL, T.WALL],
    [T.FLOOR, T.DOOR, T.FLOOR, T.LOCKED_R, T.STAIRS],
    [T.WALL, T.WALL, T.WALL, T.WALL, T.WALL],
  ]), player, gameState, {});
  assert.deepEqual(plain(keyedRoute.points.map((/** @type {any} */ p) => [p.x, p.y])), [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]]);
});

test('RECON route cache invalidates on player keys and map mutation version', () => {
  const hooks = loadReconRouteHooks();
  const dungeon = dungeonFromMap([
    [T.WALL, T.WALL, T.WALL, T.WALL, T.WALL],
    [T.FLOOR, T.LOCKED_R, T.FLOOR, T.FLOOR, T.STAIRS],
    [T.WALL, T.WALL, T.WALL, T.WALL, T.WALL],
  ]);
  const player = /** @type {any} */ ({ x: 0, y: 1, keys: {}, activeBoosts: { RECON_PING: true } });
  const gameState = { floor: 1, bossAlive: false, cheats: { revealMap: false } };

  assert.equal(hooks.getReconRoute(dungeon, player, gameState), null);
  player.keys.red = 1;
  const keyedRoute = hooks.getReconRoute(dungeon, player, gameState);
  assert.ok(keyedRoute, 'key pickup should invalidate the previously blocked route cache');
  assert.deepEqual(plain(keyedRoute.points[keyedRoute.points.length - 1]), { x: 4, y: 1 });

  const row = dungeon.map[1];
  assert.ok(row);
  row[2] = T.WALL;
  dungeon._mapMutationVersion += 1;
  assert.equal(hooks.getReconRoute(dungeon, player, gameState), null, 'map mutation version should invalidate stale cached paths');
});

test('RECON route is a RECON or cheat affordance, not plain ECHO map reveal', () => {
  const hooks = loadReconRouteHooks();
  const player = /** @type {any} */ ({ keys: {}, activeBoosts: {} });
  assert.equal(hooks.shouldDrawReconRoute({ mapRevealed: true, cheats: { revealMap: false } }, player), false);
  player.activeBoosts.RECON_PING = true;
  assert.equal(hooks.shouldDrawReconRoute({ mapRevealed: true, cheats: { revealMap: false } }, player), true);
  assert.equal(hooks.getReconRoute(dungeonFromMap([[T.FLOOR, T.STAIRS]]), { x: 0, y: 0, keys: {}, activeBoosts: { RECON_PING: true } }, null), null);
  player.activeBoosts.RECON_PING = false;
  assert.equal(hooks.shouldDrawReconRoute({ mapRevealed: false, cheats: { revealMap: true } }, player), true);
});

test('RECON objective targets boss room while the core terminal is locked', () => {
  const hooks = loadReconRouteHooks();
  const dungeon = dungeonFromMap([
    [T.WALL, T.WALL, T.WALL, T.WALL],
    [T.FLOOR, T.FLOOR, T.WALL, T.TERMINAL],
    [T.WALL, T.WALL, T.WALL, T.WALL],
  ]);
  const player = { x: 0, y: 1, keys: {} };
  const bossTarget = hooks.findReconObjectiveTile(dungeon, player, {
    floor: 15,
    bossAlive: true,
    bossRoom: { cx: 1, cy: 1 },
  });
  assert.deepEqual(plain(bossTarget), { x: 1, y: 1, kind: 'boss' });

  const coreTarget = hooks.findReconObjectiveTile(dungeon, player, {
    floor: 15,
    bossAlive: false,
  });
  assert.deepEqual(plain(coreTarget), { x: 3, y: 1, kind: 'core' });
});

test('render draws RECON route overlays on both minimap surfaces', () => {
  assert.match(RENDER, /drawReconRouteOverlay\(getReconRoute\(dungeon, player, _RG\), MX, MY, sx, sy, false\)/);
  assert.match(RENDER, /drawReconRouteOverlay\(getReconRoute\(dungeon, player, _RG\), mx, my, sx, sy, true\)/);
});

test('map mutations advance route-cache version as well as minimap and FOV invalidation', () => {
  const match = GAME.match(/markMapMutated\(\)\s*{([\s\S]*?)\n  },/);
  assert.ok(match, 'game.markMapMutated source must be present');
  const body = match[1] || '';
  let clearLosCalls = 0;
  function clearLosCache() { clearLosCalls += 1; }
  const context = {
    clearLosCache,
    target: {
      _minimapDirty: false,
      dungeon: { _fovDirty: false, _mapMutationVersion: 2 },
    },
  };
  vm.runInNewContext(`
    function markMapMutated() {${body}
    }
    markMapMutated.call(target);
  `, context);
  assert.equal(context.target._minimapDirty, true);
  assert.equal(clearLosCalls, 1);
  assert.equal(context.target.dungeon._fovDirty, true);
  assert.equal(context.target.dungeon._mapMutationVersion, 3);
});
