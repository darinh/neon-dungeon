'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const math = require('../engine/math.js');

const T = {
  VOID:0, WALL:1, FLOOR:2, STAIRS:3, TERMINAL:4, DOOR:5, DOOR_OPEN:6,
  LOCKED_R:7, LOCKED_B:8, LOCKED_G:9, TRAP_SPIKE:10, TRAP_SLOW:11,
  PLASMA:12, ARC:13, VENDOR:14, CRACKED:15, LORE:16, CHALLENGE_GATE:17,
  IMPLANT_SHRINE:18, EVENT_TERMINAL:19, TELEPORT_PAD:20, CRATE:21,
  TOXIC:22, SHOCK_TILE:23, REPULSOR:24, MAINFRAME_READER:25,
  NETWORK_PORTAL:26, MESSAGE_CONSOLE:27
};
const MAP_W = 80;
const MAP_H = 50;
const TILE = 32;
const TWO_PI = Math.PI * 2;

function isPassable(t) {
  return t === T.FLOOR || t === T.STAIRS || t === T.TERMINAL ||
    t === T.DOOR_OPEN || t === T.TRAP_SPIKE || t === T.TRAP_SLOW ||
    t === T.PLASMA || t === T.ARC || t === T.VENDOR || t === T.LORE ||
    t === T.CHALLENGE_GATE || t === T.IMPLANT_SHRINE ||
    t === T.EVENT_TERMINAL || t === T.TELEPORT_PAD || t === T.TOXIC ||
    t === T.SHOCK_TILE || t === T.REPULSOR || t === T.MAINFRAME_READER ||
    t === T.NETWORK_PORTAL || t === T.MESSAGE_CONSOLE;
}

function isSeeThrough(t) {
  return t !== T.WALL && t !== T.VOID && t !== T.CRACKED && t !== T.DOOR &&
    t !== T.LOCKED_R && t !== T.LOCKED_B && t !== T.LOCKED_G && t !== T.CRATE;
}

function isDoor(t) {
  return t === T.DOOR || t === T.LOCKED_R || t === T.LOCKED_B || t === T.LOCKED_G;
}

function hasLOS(x1, y1, x2, y2, map) {
  let cx = Math.floor(x1), cy = Math.floor(y1);
  const ex = Math.floor(x2), ey = Math.floor(y2);
  const dx = Math.abs(ex - cx), dy = Math.abs(ey - cy);
  const sx = cx < ex ? 1 : -1, sy = cy < ey ? 1 : -1;
  let err = dx - dy;
  for (let i = 0; i < 100; i++) {
    if (cx === ex && cy === ey) return true;
    if (cx < 0 || cy < 0 || cx >= MAP_W || cy >= MAP_H) return false;
    if (!isSeeThrough(map[cy][cx])) return false;
    const e2 = 2 * err;
    let nx = cx, ny = cy;
    if (e2 > -dy) { err -= dy; nx += sx; }
    if (e2 < dx) { err += dx; ny += sy; }
    if (nx !== cx && ny !== cy &&
        !isSeeThrough(map[cy]?.[nx]) && !isSeeThrough(map[ny]?.[cx])) return false;
    cx = nx; cy = ny;
  }
  return true;
}

function loadGenerateFloor() {
  const noop = () => {};
  const NEON = {
    save: { META_UPGRADES: [] },
    biomes: {
      finalFloor() { return 15; },
      isBiomeBossFloor(n) { return [3, 6, 9, 12, 15].includes(n); },
    },
    whispers: { pickWhisperForFloor() { return null; } },
    boosts: { BOOSTS: [] },
    cores: {},
    events: { EVENTS: [] },
    augments: { AUGMENTS: [] },
    particles: { createSystem() { return { spawn: noop, update: noop, draw: noop, clear: noop }; } },
    draw: { circle: noop, circleStroke: noop, line: noop, arcStroke: noop },
  };
  const sandbox = {
    console, Math, Array, Uint8Array, Float32Array, Map, Set, Proxy, Object,
    Number, String, JSON, T, MAP_W, MAP_H, TILE, TWO_PI, isPassable,
    isSeeThrough, isDoor, hasLOS, ...math, NEON, _CG: {}, window: { NEON },
    self: { NEON }, performance: { now() { return 0; } },
    ctx: {
      save: noop, restore: noop, beginPath: noop, moveTo: noop, lineTo: noop,
      stroke: noop, fill: noop, arc: noop, closePath: noop, fillRect: noop,
      strokeRect: noop, setLineDash: noop, translate: noop, rotate: noop,
      ellipse: noop, fillText: noop,
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, 'engine/dungeon/topology.js'), 'utf8') +
      '\nthis.dungeonTopologyLoaded = !!NEON.dungeonTopology;',
    sandbox
  );
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, 'engine/dungeon/reachability.js'), 'utf8') +
      '\nthis.dungeonReachabilityLoaded = !!NEON.dungeonReachability;',
    sandbox
  );
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, 'src/content.js'), 'utf8') +
      '\nthis.generateFloor = generateFloor;',
    sandbox
  );
  return sandbox;
}

function physicalReachWithKeys(dungeon) {
  const map = dungeon.map;
  const sx = Math.floor(dungeon.playerPos.x);
  const sy = Math.floor(dungeon.playerPos.y);
  const have = new Set();
  const keyItems = dungeon.keyItems || [];
  let vis = Array.from({ length: MAP_H }, () => new Uint8Array(MAP_W));
  let changed = true;
  while (changed) {
    changed = false;
    vis = Array.from({ length: MAP_H }, () => new Uint8Array(MAP_W));
    const q = [{ x: sx, y: sy }];
    vis[sy][sx] = 1;
    while (q.length) {
      const { x, y } = q.shift();
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H || vis[ny][nx]) continue;
        const tile = map[ny][nx];
        const open = isPassable(tile) || tile === T.DOOR || tile === T.CRACKED ||
          (tile === T.LOCKED_R && have.has('red')) ||
          (tile === T.LOCKED_B && have.has('blue')) ||
          (tile === T.LOCKED_G && have.has('gold'));
        if (!open) continue;
        vis[ny][nx] = 1;
        q.push({ x: nx, y: ny });
      }
    }
    for (const key of keyItems) {
      if (!have.has(key.colour) && vis[key.y]?.[key.x]) {
        have.add(key.colour);
        changed = true;
      }
    }
  }
  return { vis, have };
}

function reachWithAllLocksOpen(dungeon) {
  const map = dungeon.map;
  const sx = Math.floor(dungeon.playerPos.x);
  const sy = Math.floor(dungeon.playerPos.y);
  const vis = Array.from({ length: MAP_H }, () => new Uint8Array(MAP_W));
  const q = [{ x: sx, y: sy }];
  vis[sy][sx] = 1;
  while (q.length) {
    const { x, y } = q.shift();
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H || vis[ny][nx]) continue;
      const tile = map[ny][nx];
      const open = isPassable(tile) || tile === T.DOOR || tile === T.CRACKED ||
        tile === T.LOCKED_R || tile === T.LOCKED_B || tile === T.LOCKED_G;
      if (!open) continue;
      vis[ny][nx] = 1;
      q.push({ x: nx, y: ny });
    }
  }
  return vis;
}

function emptyTestMap() {
  return Array.from({ length: MAP_H }, () => new Uint8Array(MAP_W).fill(T.WALL));
}

function makeTraversalFixture({ includeKey = true } = {}) {
  const map = emptyTestMap();
  map[1][1] = T.FLOOR;
  map[1][2] = T.FLOOR;
  map[1][3] = T.LOCKED_R;
  map[1][4] = T.FLOOR;
  map[1][5] = T.STAIRS;
  if (includeKey) map[1][2] = T.FLOOR;
  return {
    map,
    rooms: [
      { x: 1, y: 1, w: 2, h: 1, cx: 1, cy: 1 },
      { x: 4, y: 1, w: 2, h: 1, cx: 4, cy: 1 },
    ],
    spawnRoom: { x: 1, y: 1, w: 1, h: 1, cx: 1, cy: 1 },
    playerPos: { x: 1.5, y: 1.5 },
    keyItems: includeKey ? [{ x: 2, y: 1, colour: 'red', tileColour: '#ff3333' }] : [],
  };
}

function lockColours(dungeon) {
  const colours = new Set();
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const tile = dungeon.map[y][x];
      if (tile === T.LOCKED_R) colours.add('red');
      if (tile === T.LOCKED_B) colours.add('blue');
      if (tile === T.LOCKED_G) colours.add('gold');
    }
  }
  return colours;
}

test('physical reachability uses key pickup instead of treating every lock as open', () => {
  const solvable = makeTraversalFixture({ includeKey: true });
  const solvedReach = physicalReachWithKeys(solvable);
  assert.equal(solvedReach.have.has('red'), true);
  assert.equal(solvedReach.vis[1][5], 1, 'reachable red key should open the red lock');

  const unsolved = makeTraversalFixture({ includeKey: false });
  const physical = physicalReachWithKeys(unsolved);
  assert.equal(physical.have.has('red'), false);
  assert.equal(physical.vis[1][5], 0, 'physical traversal must not cross locked doors without the key');

  const allOpen = reachWithAllLocksOpen(unsolved);
  assert.equal(allOpen[1][5], 1, 'all-locks-open diagnostics are intentionally weaker than physical traversal');
});

test('physical reachability is cardinal and does not allow corner walking', () => {
  const map = emptyTestMap();
  map[1][1] = T.FLOOR;
  map[2][2] = T.STAIRS;
  const dungeon = {
    map,
    rooms: [],
    spawnRoom: { x: 1, y: 1, w: 1, h: 1, cx: 1, cy: 1 },
    playerPos: { x: 1.5, y: 1.5 },
    keyItems: [],
  };
  const reach = physicalReachWithKeys(dungeon);
  assert.equal(reach.vis[2][2], 0, 'diagonal-only adjacency must not be reachable');
});

test('seed 1111-1111-1111 floor 6 has no movement-unreachable required rooms', () => {
  const sandbox = loadGenerateFloor();
  sandbox.setSeed('1111-1111-1111');
  const dungeon = sandbox.withDerivedRngStream('world:floor:6', () => sandbox.generateFloor(6));
  assertAllRequiredRoomsReachable(dungeon);
});

function assertAllRequiredRoomsReachable(dungeon) {
  const reach = physicalReachWithKeys(dungeon);
  const unreachable = dungeon.rooms
    .filter((room) => !reach.vis[room.cy]?.[room.cx])
    .map((room) => ({ x: room.cx, y: room.cy, type: room.roomType || 'normal' }));
  assert.equal(unreachable.length, 0, JSON.stringify(unreachable));
  for (const colour of lockColours(dungeon)) {
    assert.equal(reach.have.has(colour), true, `locked ${colour} doors exist but ${colour} key was not physically reachable`);
  }
}

function assertNoSpawnRoomKeys(dungeon) {
  const spawn = dungeon.spawnRoom;
  const spawnKeys = (dungeon.keyItems || []).filter((key) =>
    key.x >= spawn.x && key.x < spawn.x + spawn.w &&
    key.y >= spawn.y && key.y < spawn.y + spawn.h
  );
  assert.equal(spawnKeys.length, 0, 'progression keys must not spawn in the starting room');
}

function assertNoDuplicateKeyTiles(dungeon) {
  const seen = new Set();
  for (const key of dungeon.keyItems || []) {
    const pos = `${key.x},${key.y}`;
    assert.equal(seen.has(pos), false, `multiple progression keys spawned at ${pos}`);
    seen.add(pos);
  }
}

test('sampled seeded floors keep all required rooms movement-reachable after lock repair', () => {
  const sandbox = loadGenerateFloor();
  const seeds = [
    '1111-1111-1111',
    '2222-2222-2222',
    '3333-3333-3333',
    '4444-4444-4444',
    '5555-5555-5555',
    '6666-6666-6666',
    '7777-7777-7777',
    '8888-8888-8888',
  ];
  for (const seed of seeds) {
    sandbox.setSeed(seed);
    for (let floor = 1; floor <= 15; floor++) {
      const dungeon = sandbox.withDerivedRngStream(`world:floor:${floor}`, () => sandbox.generateFloor(floor));
      assertAllRequiredRoomsReachable(dungeon);
      assertNoSpawnRoomKeys(dungeon);
      assertNoDuplicateKeyTiles(dungeon);
    }
  }
});

test('seed 1111-1111-1111 floor 2 does not solve locks by putting the red key in spawn', () => {
  const sandbox = loadGenerateFloor();
  sandbox.setSeed('1111-1111-1111');
  const dungeon = sandbox.withDerivedRngStream('world:floor:2', () => sandbox.generateFloor(2));
  assertAllRequiredRoomsReachable(dungeon);
  assertNoSpawnRoomKeys(dungeon);
});
