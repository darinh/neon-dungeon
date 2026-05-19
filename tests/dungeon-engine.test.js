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

test('dungeon topology engine exposes cardinal room graph and boundary helpers', () => {
  assert.deepEqual(topology.CARDINAL_DIRECTIONS, [[1, 0], [-1, 0], [0, 1], [0, -1]]);

  const a = { id: 'a', x: 2, y: 2, w: 4, h: 4 };
  const b = { id: 'b', x: 8, y: 2, w: 4, h: 4 };
  const c = { id: 'c', x: 20, y: 2, w: 4, h: 4 };
  const graph = topology.buildRoomGraph([a, b, c], (left, right) => Math.abs(left.x - right.x) <= 6);
  assert.deepEqual(graph.get(a), [b]);
  assert.deepEqual(graph.get(b), [a]);
  assert.deepEqual(graph.get(c), []);

  assert.equal(topology.roomContainsPoint(a, 2, 2), true);
  assert.equal(topology.roomContainsPoint(a, 5, 5), true);
  assert.equal(topology.roomContainsPoint(a, 6, 5), false);
  assert.equal(topology.roomContainsPoint(a, 5, 6), false);
  assert.equal(topology.roomHasCorner(a, 2, 2), true);
  assert.equal(topology.roomHasCorner(a, 5, 5), true);
  assert.equal(topology.roomHasCorner(a, 3, 2), false);

  assert.deepEqual(topology.outsideFaceForBoundaryTile(a, 3, 2), { x: 3, y: 1, dx: 0, dy: -1 });
  assert.deepEqual(topology.outsideFaceForBoundaryTile(a, 3, 5), { x: 3, y: 6, dx: 0, dy: 1 });
  assert.deepEqual(topology.outsideFaceForBoundaryTile(a, 2, 3), { x: 1, y: 3, dx: -1, dy: 0 });
  assert.deepEqual(topology.outsideFaceForBoundaryTile(a, 5, 3), { x: 6, y: 3, dx: 1, dy: 0 });
  assert.equal(topology.outsideFaceForBoundaryTile(a, 2, 2), null);
});

test('dungeon topology counts cardinal neighbors with injected semantics', () => {
  const calls = [];
  const open = new Set(['4,3', '3,4']);

  const count = topology.countCardinalNeighbors(
    3,
    3,
    (x, y) => {
      calls.push(`match:${x},${y}`);
      return open.has(x + ',' + y);
    },
    (x, y) => {
      calls.push(`exclude:${x},${y}`);
      return x === 2 && y === 3;
    }
  );

  assert.equal(count, 2);
  assert.deepEqual(calls, [
    'exclude:4,3',
    'match:4,3',
    'exclude:2,3',
    'exclude:3,4',
    'match:3,4',
    'exclude:3,2',
    'match:3,2',
  ]);
});

test('dungeon topology finds cardinal-connected positions in traversal order', () => {
  const open = new Set(['3,3', '4,3', '3,4', '2,4', '3,5']);
  const calls = [];

  const cluster = topology.findCardinalConnectedPositions(3, 3, (x, y) => {
    calls.push(x + ',' + y);
    return open.has(x + ',' + y);
  });

  assert.deepEqual(cluster, [
    { x: 3, y: 3 },
    { x: 4, y: 3 },
    { x: 3, y: 4 },
    { x: 2, y: 4 },
    { x: 3, y: 5 },
  ]);
  assert.deepEqual(calls.slice(0, 9), [
    '3,3',
    '4,3',
    '2,3',
    '3,4',
    '3,2',
    '5,3',
    '4,4',
    '4,2',
    '4,4',
  ]);
});

test('dungeon topology connected-position predicate owns bounds and start eligibility', () => {
  const width = 3;
  const height = 3;
  const open = new Set(['0,0', '1,0']);
  const matches = (/** @type {number} */ x, /** @type {number} */ y) =>
    x >= 0 && y >= 0 && x < width && y < height && open.has(x + ',' + y);

  assert.deepEqual(topology.findCardinalConnectedPositions(0, 0, matches), [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ]);
  assert.deepEqual(topology.findCardinalConnectedPositions(2, 2, matches), []);
});

test('dungeon topology connected-position helper keeps disjoint host scans separate', () => {
  const width = 6;
  const height = 4;
  const open = new Set(['1,1', '2,1', '4,1', '4,2']);
  const visited = new Set();
  const clusters = [];
  const matches = (/** @type {number} */ x, /** @type {number} */ y) =>
    x >= 0 && y >= 0 && x < width && y < height && open.has(x + ',' + y);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const key = x + ',' + y;
      if (visited.has(key) || !matches(x, y)) continue;
      const cluster = topology.findCardinalConnectedPositions(x, y, matches);
      for (const p of cluster) visited.add(p.x + ',' + p.y);
      clusters.push(cluster);
    }
  }

  assert.deepEqual(clusters, [
    [{ x: 1, y: 1 }, { x: 2, y: 1 }],
    [{ x: 4, y: 1 }, { x: 4, y: 2 }],
  ]);
});

test('dungeon topology engine finds outside entrance room sides in cardinal order', () => {
  const outside = { x: 5, y: 5 };
  const rooms = [
    { id: 'east', x: 6, y: 4, w: 3, h: 3 },
    { id: 'west', x: 2, y: 4, w: 3, h: 3 },
    { id: 'south', x: 4, y: 6, w: 3, h: 3 },
    { id: 'north', x: 4, y: 2, w: 3, h: 3 },
  ];

  assert.deepEqual(topology.findOutsideEntranceRoomSides(rooms, outside.x, outside.y), [
    { dx: 1, dy: 0, bx: 6, by: 5 },
    { dx: -1, dy: 0, bx: 4, by: 5 },
    { dx: 0, dy: 1, bx: 5, by: 6 },
    { dx: 0, dy: -1, bx: 5, by: 4 },
  ]);
});

test('dungeon topology outside entrance room sides skip corner boundary tiles', () => {
  const matchingRoom = { id: 'east', x: 6, y: 4, w: 3, h: 3 };
  const cornerBlocker = { id: 'corner', x: 6, y: 5, w: 2, h: 2 };

  assert.deepEqual(topology.findOutsideEntranceRoomSides([matchingRoom], 5, 5), [
    { dx: 1, dy: 0, bx: 6, by: 5 },
  ]);
  assert.deepEqual(topology.findOutsideEntranceRoomSides([matchingRoom, cornerBlocker], 5, 5), []);
});

test('dungeon topology finds former entrance side padding tiles without corners', () => {
  const room = { x: 2, y: 2, w: 5, h: 4 };

  assert.deepEqual(
    topology.findFormerEntranceSidePaddingTiles(room, 4, 2, 0, -1),
    [{ x: 3, y: 2 }, { x: 5, y: 2 }],
    'top/bottom entrances inspect horizontal side padding in legacy sign order'
  );
  assert.deepEqual(
    topology.findFormerEntranceSidePaddingTiles(room, 2, 4, -1, 0),
    [{ x: 2, y: 3 }],
    'left/right entrances inspect vertical side padding and skip the room corner'
  );
});

test('dungeon topology aligned outside passage repair preserves existing opposite connections', () => {
  const passages = new Set(['5,3']);
  const isOutsidePassageTile = (x, y) => passages.has(x + ',' + y);
  const canCarveOutsidePassageTile = () => false;

  assert.deepEqual(
    topology.findAlignedOutsidePassageRepair(5, 5, { dx: 0, dy: 1 }, isOutsidePassageTile, canCarveOutsidePassageTile),
    { px: 5, py: 4, cx: -1, cy: -1 }
  );
});

test('dungeon topology aligned outside passage repair scans perpendicular directions in cardinal order', () => {
  const passages = new Set(['6,5', '4,5']);
  const carveable = new Set(['5,4', '6,4', '4,4']);
  const isOutsidePassageTile = (x, y) => passages.has(x + ',' + y);
  const canCarveOutsidePassageTile = (x, y) => carveable.has(x + ',' + y);

  assert.deepEqual(
    topology.findAlignedOutsidePassageRepair(5, 5, { dx: 0, dy: 1 }, isOutsidePassageTile, canCarveOutsidePassageTile),
    { px: 5, py: 4, cx: 6, cy: 4 },
    'east-side repair must win before west because CARDINAL_DIRECTIONS starts with east'
  );
});

test('dungeon topology aligned outside passage repair rejects blocked opposite tiles', () => {
  const passages = new Set(['6,5']);
  const isOutsidePassageTile = (x, y) => passages.has(x + ',' + y);
  const canCarveOutsidePassageTile = () => false;

  assert.equal(
    topology.findAlignedOutsidePassageRepair(5, 5, { dx: 0, dy: 1 }, isOutsidePassageTile, canCarveOutsidePassageTile),
    null
  );
});

test('dungeon topology engine exposes padded rectangle overlap helpers', () => {
  const rect = { x: 5, y: 5, w: 4, h: 4 };
  const touching = { x: 9, y: 6, w: 2, h: 2 };
  const overlapping = { x: 8, y: 8, w: 3, h: 3 };

  assert.equal(topology.rectOverlapArea(rect, touching, 0), 0);
  assert.equal(topology.rectOverlapArea(rect, touching, 1), 2);
  assert.equal(topology.rectOverlapArea(rect, overlapping, 0), 1);
  assert.equal(topology.rectOverlapsAnyRoom(rect, [touching], null, 0), false);
  assert.equal(topology.rectOverlapsAnyRoom(rect, [touching], null, 1), true);
  assert.equal(topology.rectOverlapsAnyRoom(rect, [touching], touching, 1), false);
});

test('dungeon topology engine places expanded room rectangles with legacy scoring', () => {
  const room = { id: 'target', x: 10, y: 6, w: 4, h: 3, cx: 12, cy: 7 };
  const placement = topology.findExpandedRoomPlacement({
    room,
    rooms: [room],
    minWidth: 7,
    minHeight: 5,
    mapWidth: 40,
    mapHeight: 25,
    margin: 1,
    padding: 1,
  });

  assert.deepEqual(placement, { x: 9, y: 5, w: 7, h: 5 });
});

test('dungeon topology expanded room placement rejects padded overlaps and empty windows', () => {
  const room = { id: 'target', x: 10, y: 6, w: 4, h: 3, cx: 12, cy: 7 };
  const blocker = { id: 'blocker', x: 9, y: 5, w: 7, h: 5 };

  assert.equal(topology.findExpandedRoomPlacement({
    room,
    rooms: [room, blocker],
    minWidth: 7,
    minHeight: 5,
    mapWidth: 20,
    mapHeight: 14,
    margin: 1,
    padding: 1,
  }), null);
  assert.equal(topology.findExpandedRoomPlacement({
    room: { id: 'edge', x: 1, y: 1, w: 2, h: 2, cx: 2, cy: 2 },
    rooms: [],
    minWidth: 20,
    minHeight: 20,
    mapWidth: 12,
    mapHeight: 12,
    margin: 1,
    padding: 1,
  }), null);
});

test('dungeon topology engine clusters room boundary entrances with injected open-tile semantics', () => {
  const WALL = 1, FLOOR = 2, DOOR = 5, LOCKED = 7;
  const map = topology.createMap(8, 8, WALL);
  const room = { x: 2, y: 2, w: 4, h: 4 };
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) map[y][x] = FLOOR;
  }

  map[1][3] = FLOOR;
  map[1][4] = DOOR;
  map[6][3] = FLOOR;
  map[3][1] = FLOOR;
  map[4][6] = FLOOR;
  map[1][2] = FLOOR;
  map[2][2] = FLOOR;
  map[6][4] = LOCKED;

  const clusters = topology.findBoundaryEntranceClusters(map, room, (tile) => tile === FLOOR || tile === DOOR);
  assert.deepEqual(clusters, [
    [{ x: 3, y: 2 }, { x: 4, y: 2 }],
    [{ x: 3, y: 5 }],
    [{ x: 2, y: 3 }],
    [{ x: 5, y: 4 }],
  ]);
});

test('dungeon topology engine scans corner-inclusive room boundary openings in legacy order', () => {
  const WALL = 1, FLOOR = 2;
  const map = topology.createMap(5, 5, WALL);
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) map[y][x] = FLOOR;
  }

  const openings = topology.findRoomBoundaryOpenings(
    map,
    { x: 1, y: 1, w: 3, h: 3 },
    (tile) => tile === FLOOR
  );

  assert.deepEqual(openings, [
    { x: 1, y: 1 },
    { x: 1, y: 3 },
    { x: 2, y: 1 },
    { x: 2, y: 3 },
    { x: 3, y: 1 },
    { x: 3, y: 3 },
    { x: 1, y: 2 },
    { x: 3, y: 2 },
  ]);
});

test('dungeon topology room boundary openings honor bounds and position exclusions', () => {
  const WALL = 1, FLOOR = 2;
  const map = topology.createMap(6, 6, WALL);
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) map[y][x] = FLOOR;
  }
  const room = { x: 1, y: 1, w: 3, h: 3 };

  assert.deepEqual(topology.findRoomBoundaryOpenings(
    map,
    room,
    (tile) => tile === FLOOR,
    (x, y) => (x === 2 && y === 1) || (x === 0 && y === 2)
  ), [
    { x: 1, y: 1 },
    { x: 1, y: 3 },
    { x: 2, y: 3 },
    { x: 3, y: 1 },
    { x: 3, y: 3 },
    { x: 3, y: 2 },
  ]);

  assert.deepEqual(topology.findRoomBoundaryOpenings(
    map,
    { x: 0, y: 0, w: 3, h: 3 },
    (tile) => tile === FLOOR
  ), [
    { x: 0, y: 2 },
    { x: 1, y: 2 },
    { x: 2, y: 2 },
    { x: 2, y: 0 },
    { x: 2, y: 1 },
  ]);

  assert.deepEqual(topology.findRoomBoundaryOpenings(
    map,
    room,
    (tile) => tile === FLOOR,
    () => true
  ), []);
  assert.notDeepEqual(topology.findRoomBoundaryOpenings(map, room, (tile) => tile === FLOOR), []);
});

test('dungeon topology engine scans room boundary gates with outside faces', () => {
  const WALL = 1, FLOOR = 2, LOCKED = 7, CRACKED = 15, CHALLENGE_GATE = 17;
  const map = topology.createMap(5, 5, WALL);
  const room = { x: 1, y: 1, w: 3, h: 3 };
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) map[y][x] = FLOOR;
  }
  map[1][1] = LOCKED;
  map[1][2] = CRACKED;
  map[3][3] = CHALLENGE_GATE;

  assert.deepEqual(
    topology.findRoomBoundaryGates(
      map,
      room,
      (tile) => tile === LOCKED || tile === CRACKED || tile === CHALLENGE_GATE
    ),
    [
      { x: 1, y: 1, ox: 1, oy: 0 },
      { x: 2, y: 1, ox: 2, oy: 0 },
      { x: 3, y: 3, ox: 3, oy: 4 },
      { x: 1, y: 1, ox: 0, oy: 1 },
      { x: 3, y: 3, ox: 4, oy: 3 },
    ],
    'scan order and corner duplicate faces must match the legacy repair code'
  );
});

test('dungeon topology engine scans outside entrance gates for a room', () => {
  const WALL = 1, FLOOR = 2, DOOR = 5, LOCKED = 7;
  const map = topology.createMap(7, 7, WALL);
  const room = { x: 2, y: 2, w: 3, h: 3 };
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) map[y][x] = FLOOR;
  }
  map[1][3] = DOOR;
  map[3][1] = LOCKED;
  map[3][5] = DOOR;
  map[5][3] = LOCKED;

  assert.deepEqual(
    topology.findOutsideEntranceGatesForRoom(
      map,
      room,
      (tile) => tile === DOOR || tile === LOCKED,
      (x, y) => topology.roomContainsPoint(room, x, y)
    ),
    [
      { x: 3, y: 1, ox: 3, oy: 0 },
      { x: 1, y: 3, ox: 0, oy: 3 },
      { x: 5, y: 3, ox: 6, oy: 3 },
      { x: 3, y: 5, ox: 3, oy: 6 },
    ],
    'scan order must stay y-major/x-major with cardinal face matching'
  );
});

test('dungeon topology outside entrance gate scan skips room-interior gates', () => {
  const WALL = 1, FLOOR = 2, DOOR = 5;
  const map = topology.createMap(7, 7, WALL);
  const room = { x: 2, y: 2, w: 3, h: 3 };
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) map[y][x] = FLOOR;
  }
  map[1][3] = DOOR;
  map[2][3] = DOOR;

  assert.deepEqual(
    topology.findOutsideEntranceGatesForRoom(
      map,
      room,
      (tile) => tile === DOOR,
      (x, y) => topology.roomContainsPoint(room, x, y)
    ),
    [{ x: 3, y: 1, ox: 3, oy: 0 }]
  );
});

test('dungeon topology engine finds room-neighborhood tiles in legacy y-major order', () => {
  const WALL = 1, FLOOR = 2, TARGET = 9;
  const map = topology.createMap(7, 6, WALL);
  const room = { x: 2, y: 2, w: 3, h: 2 };
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) map[y][x] = FLOOR;
  }
  map[1][5] = TARGET;
  map[2][1] = TARGET;
  map[4][2] = TARGET;

  assert.deepEqual(
    topology.findRoomNeighborhoodTile(map, room, (tile) => tile === TARGET),
    { x: 5, y: 1 },
    'scan order must be y-major over the one-tile padded room neighbourhood'
  );
  map[1][5] = WALL;
  assert.deepEqual(topology.findRoomNeighborhoodTile(map, room, (tile) => tile === TARGET), { x: 1, y: 2 });
  assert.equal(topology.findRoomNeighborhoodTile(map, room, (tile) => tile === TARGET, 0), null);
});

test('dungeon topology room-neighborhood tile scan clamps to map bounds', () => {
  const WALL = 1, TARGET = 9;
  const map = topology.createMap(4, 4, WALL);
  const room = { x: 0, y: 0, w: 2, h: 2 };
  map[2][2] = TARGET;

  assert.deepEqual(topology.findRoomNeighborhoodTile(map, room, (tile) => tile === TARGET), { x: 2, y: 2 });
  assert.equal(topology.findRoomNeighborhoodTile([], room, (tile) => tile === TARGET), null);
});

test('dungeon topology prunes interior dead-end grid tiles with injected semantics', () => {
  const WALL = 1, FLOOR = 2, DOOR = 5;
  const map = topology.createMap(7, 5, WALL);
  map[2][1] = FLOOR;
  map[2][2] = FLOOR;
  map[2][3] = FLOOR;
  map[2][4] = DOOR;

  const pruned = topology.pruneDeadEndGridTiles({
    map,
    fillTile: WALL,
    isPrunableTile: (tile) => tile === FLOOR,
    connectsTile: (tile) => tile !== WALL,
  });

  assert.equal(pruned, 3);
  assert.equal(map[2][1], WALL);
  assert.equal(map[2][2], WALL);
  assert.equal(map[2][3], WALL);
  assert.equal(map[2][4], DOOR);
});

test('dungeon topology dead-end pruning honors coordinate exclusions', () => {
  const WALL = 1, FLOOR = 2;
  const map = topology.createMap(6, 5, WALL);
  map[2][1] = FLOOR;
  map[2][2] = FLOOR;
  map[2][3] = FLOOR;
  const calls = [];

  const pruned = topology.pruneDeadEndGridTiles({
    map,
    fillTile: WALL,
    isPrunableTile: (tile) => tile === FLOOR,
    connectsTile(tile, x, y) {
      calls.push({ tile, x, y });
      return tile === FLOOR;
    },
    isPositionExcluded: (x, y) => x === 3 && y === 2,
  });

  assert.equal(pruned, 2);
  assert.equal(map[2][1], WALL);
  assert.equal(map[2][2], WALL);
  assert.equal(map[2][3], FLOOR);
  assert.ok(calls.some((call) => call.x === 3 && call.y === 2), 'connectivity predicate receives neighbour coordinates');
});

test('dungeon topology dead-end pruning makes progress even with unsafe fill predicates', () => {
  const FLOOR = 2;
  const map = topology.createMap(4, 4, 0);
  map[1][1] = FLOOR;

  const pruned = topology.pruneDeadEndGridTiles({
    map,
    fillTile: FLOOR,
    isPrunableTile: (tile) => tile === FLOOR,
    connectsTile: () => false,
  });

  assert.equal(pruned, 0);
  assert.equal(map[1][1], FLOOR);
});

test('dungeon topology engine resolves preferred spawn rooms with injected passability', () => {
  const WALL = 1, FLOOR = 2;
  const map = topology.createMap(8, 6, WALL);
  const rooms = [
    { id: 'near-east', x: 3, y: 2, w: 2, h: 2 },
    { id: 'south', x: 1, y: 4, w: 2, h: 1 },
  ];
  map[2][3] = FLOOR;
  map[3][3] = FLOOR;
  map[4][1] = FLOOR;
  /** @type {number[]} */
  const predicateInputs = [];

  const resolved = topology.resolvePreferredSpawnRoom({
    map,
    rooms,
    preferred: { x: -20, y: 2.7 },
    isPassable(tile) {
      predicateInputs.push(tile);
      return tile === FLOOR;
    },
    searchRadius: 12,
  });

  assert.deepEqual(resolved && { pos: resolved.pos, roomId: resolved.room.id }, {
    pos: { x: 3.5, y: 2.5 },
    roomId: 'near-east',
  });
  assert.ok(predicateInputs.every((tile) => typeof tile === 'number'), 'predicate receives tile codes');
});

test('dungeon topology preferred-spawn search stays cardinal and deterministic', () => {
  const WALL = 1, FLOOR = 2;
  const map = topology.createMap(5, 5, WALL);
  map[2][3] = FLOOR;
  map[2][1] = FLOOR;
  map[3][2] = FLOOR;
  const rooms = [
    { id: 'east', x: 3, y: 2, w: 1, h: 1 },
    { id: 'west', x: 1, y: 2, w: 1, h: 1 },
    { id: 'south', x: 2, y: 3, w: 1, h: 1 },
  ];

  const resolved = topology.resolvePreferredSpawnRoom({
    map,
    rooms,
    preferred: { x: 2, y: 2 },
    isPassable: (tile) => tile === FLOOR,
    searchRadius: 1,
  });

  assert.equal(resolved?.room.id, 'east', 'cardinal order preserves +x, -x, +y, -y tie-break');
  map[2][3] = WALL;
  map[2][1] = WALL;
  map[3][2] = WALL;
  map[3][3] = FLOOR;
  assert.equal(
    topology.resolvePreferredSpawnRoom({
      map,
      rooms: [{ id: 'diagonal', x: 3, y: 3, w: 1, h: 1 }],
      preferred: { x: 2, y: 2 },
      isPassable: (tile) => tile === FLOOR,
      searchRadius: 1,
    }),
    null,
    'diagonal-only passable tiles are not found within a cardinal radius of 1'
  );
});

test('dungeon topology preferred-spawn search handles empty inputs and bounded radius', () => {
  const WALL = 1, FLOOR = 2;
  const map = topology.createMap(6, 3, WALL);
  const rooms = [{ id: 'far', x: 5, y: 1, w: 1, h: 1 }];
  map[1][5] = FLOOR;

  assert.equal(topology.resolvePreferredSpawnRoom({
    map,
    rooms,
    preferred: null,
    isPassable: (tile) => tile === FLOOR,
    searchRadius: 12,
  }), null);
  assert.equal(topology.resolvePreferredSpawnRoom({
    map,
    rooms: [],
    preferred: { x: 1, y: 1 },
    isPassable: (tile) => tile === FLOOR,
    searchRadius: 12,
  }), null);
  assert.equal(topology.resolvePreferredSpawnRoom({
    map,
    rooms,
    preferred: { x: 1, y: 1 },
    isPassable: (tile) => tile === FLOOR,
    searchRadius: 2,
  }), null);
  assert.equal(topology.resolvePreferredSpawnRoom({
    map,
    rooms,
    preferred: { x: Number.NaN, y: 1 },
    isPassable: (tile) => tile === FLOOR,
    searchRadius: 12,
  }), null);
});

test('dungeon topology interior grid BFS path preserves cardinal tie-breaks', () => {
  assert.deepEqual(
    topology.findInteriorGridBfsPath(6, 6, { x: 2, y: 2 }, { x: 4, y: 4 }),
    [
      { x: 4, y: 4 },
      { x: 4, y: 3 },
      { x: 4, y: 2 },
      { x: 3, y: 2 },
    ]
  );
});

test('dungeon topology interior grid BFS path rejects boundary targets and handles start target', () => {
  assert.equal(topology.findInteriorGridBfsPath(6, 6, { x: 2, y: 2 }, { x: 0, y: 2 }), null);
  assert.deepEqual(topology.findInteriorGridBfsPath(6, 6, { x: 2, y: 2 }, { x: 2, y: 2 }), []);
});

test('dungeon topology reports caller-defined grid reachability', () => {
  const W = 1;
  const F = 2;
  const map = [
    new Uint8Array([F, F, F, W]),
    new Uint8Array([W, W, F, W]),
    new Uint8Array([F, F, F, F]),
  ];
  const isOpenTile = (/** @type {number} */ tile) => tile === F;

  assert.equal(topology.canReachGridPosition(map, { x: 0, y: 0 }, { x: 3, y: 2 }, isOpenTile), true);
  assert.equal(topology.canReachGridPosition(map, { x: 0, y: 0 }, { x: 0, y: 2 }, isOpenTile), true);
  assert.equal(topology.canReachGridPosition(map, { x: 0, y: 0 }, { x: 3, y: 0 }, isOpenTile), false);
  assert.equal(topology.canReachGridPosition(map, { x: 0, y: 0 }, { x: 9, y: 9 }, isOpenTile), false);
});

test('dungeon topology treats the start grid position as already reachable', () => {
  const W = 1;
  const map = [new Uint8Array([W])];
  const calls = [];

  assert.equal(topology.canReachGridPosition(map, { x: 0, y: 0 }, { x: 0, y: 0 }, (tile) => {
    calls.push(tile);
    return false;
  }), true);
  assert.deepEqual(calls, []);
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
  assert.deepEqual(solved.blockedEdges, [{ x: 3, y: 1, colour: 'red' }]);
  assert.deepEqual(solved.repairHints, [
    { kind: 'downgrade-lock-colour', colour: 'red' },
    { kind: 'connect-room', room: { x: 4, y: 1, w: 1, h: 1, cx: 4, cy: 1 } },
  ]);
});
