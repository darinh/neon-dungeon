'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  MAP_H,
  MAP_W,
  T,
  computeReach,
  carriedSpawnForDungeon,
  createGenerationFixture,
  findTile,
  generateFloorFixture,
  generateFloorWithGameSpawnFixture,
  lockColours,
  lockedDoorTilesOnRoomBoundary,
  physicalReachWithKeys,
  roomContainsTile,
} = require('./_generation-fixture.js');

const GAME = fs.readFileSync(path.join(__dirname, '..', 'src', 'game.js'), 'utf8');

function reachWithAllLocksOpen(dungeon) {
  return computeReach(dungeon, new Set(['red', 'blue', 'gold']));
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

test('progression reachability treats openable and destructible blockers as traversable', () => {
  const map = emptyTestMap();
  map[1][1] = T.FLOOR;
  map[1][2] = T.DOOR;
  map[1][3] = T.CRACKED;
  map[1][4] = T.CRATE;
  map[1][5] = T.FLOOR;
  const dungeon = {
    map,
    rooms: [],
    spawnRoom: { x: 1, y: 1, w: 1, h: 1, cx: 1, cy: 1 },
    playerPos: { x: 1.5, y: 1.5 },
    keyItems: [{ x: 5, y: 1, colour: 'red', tileColour: '#ff3333' }],
  };
  const reach = physicalReachWithKeys(dungeon);
  assert.equal(reach.have.has('red'), true, 'closed doors, cracked walls, and crates are player-clearable for progression');
});

test('seed 1111-1111-1111 floor 6 has no movement-unreachable required rooms', () => {
  const { dungeon } = generateFloorFixture('1111-1111-1111', 6);
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

function roomAt(dungeon, pos) {
  return dungeon.rooms.find((room) =>
    pos.x >= room.x && pos.x < room.x + room.w &&
    pos.y >= room.y && pos.y < room.y + room.h
  ) || null;
}

function assertAllRequiredRoomsReachableFrom(dungeon, playerPos) {
  const oldPlayerPos = dungeon.playerPos;
  dungeon.playerPos = playerPos;
  try {
    assertAllRequiredRoomsReachable(dungeon);
  } finally {
    dungeon.playerPos = oldPlayerPos;
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
  const fixture = createGenerationFixture();
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
    for (let floor = 1; floor <= 15; floor++) {
      const dungeon = fixture.generateFloor(seed, floor);
      assertAllRequiredRoomsReachable(dungeon);
      assertNoSpawnRoomKeys(dungeon);
      assertNoDuplicateKeyTiles(dungeon);
    }
  }
});

test('seed 1111-1111-1111 floor 2 does not solve locks by putting the red key in spawn', () => {
  const { dungeon } = generateFloorFixture('1111-1111-1111', 2);
  assertAllRequiredRoomsReachable(dungeon);
  assertNoSpawnRoomKeys(dungeon);
});

test('seed 1111-1111-1111 floor 2 does not put stairs in a red-locked spawn room', () => {
  const { dungeon } = generateFloorFixture('1111-1111-1111', 2);
  const redKey = (dungeon.keyItems || []).find((key) => key.colour === 'red');
  const preLockReach = computeReach(dungeon, new Set());
  const locks = lockColours(dungeon);
  assert.equal(
    roomContainsTile(dungeon, dungeon.spawnRoom, T.STAIRS),
    false,
    'stairs must not generate inside the starting room'
  );
  assert.deepEqual(
    lockedDoorTilesOnRoomBoundary(dungeon, dungeon.spawnRoom),
    [],
    'starting room boundary must not be sealed by progression locks'
  );
  if (locks.has('red')) {
    assert.ok(redKey, 'floor has red locks, so a red key must exist');
    assert.equal(
      preLockReach[redKey.y]?.[redKey.x],
      1,
      'red key must be reachable before opening any red locked door'
    );
  }
});

test('seed 1111-1111-1111 floor 2 fixture uses the same descent spawn guard as game.loadFloor', () => {
  assert.match(
    GAME,
    /const progressionProblem = floorProgressionProblem\(this\.dungeon\.map, near, this\.dungeon\.keyItems \|\| \[\], this\.player && this\.player\.keys\);[\s\S]*if \(!progressionProblem\) spawn = near;/
  );

  const fixture = createGenerationFixture();
  const floor1 = fixture.generateFloor('1111-1111-1111', 1);
  const floor2 = fixture.generateFloor('1111-1111-1111', 2);
  const floor1Exit = findTile(floor1, T.STAIRS);
  assert.ok(floor1Exit, 'floor 1 must have stairs for descent carryover');

  const unguardedSpawn = carriedSpawnForDungeon(floor2, floor1Exit, { guardReachability: false });
  const unguardedRoom = roomAt(floor2, unguardedSpawn);
  assert.ok(unguardedRoom, 'unguarded carried spawn should land in a room');
  assert.equal(
    roomContainsTile(floor2, unguardedRoom, T.STAIRS),
    true,
    'the unguarded loadFloor carryover reproduces the reported wrong floor-2 start room'
  );
  assert.notDeepEqual(
    unguardedSpawn,
    floor2.playerPos,
    'standalone generateFloor() default spawn is not the runtime descent spawn without the guard'
  );

  const runtime = generateFloorWithGameSpawnFixture('1111-1111-1111', 2);
  const runtimeRoom = roomAt(runtime.dungeon, runtime.playerPos);
  assert.ok(runtimeRoom, 'guarded runtime spawn should land in a room');
  assert.equal(
    roomContainsTile(runtime.dungeon, runtimeRoom, T.STAIRS),
    false,
    'guarded runtime spawn must not start in the stairs room'
  );
  assert.deepEqual(
    runtime.playerPos,
    runtime.defaultPlayerPos,
    'invalid exit-position carryover should fall back to the generated spawn'
  );
  assert.deepEqual(
    lockedDoorTilesOnRoomBoundary(runtime.dungeon, runtimeRoom),
    [],
    'guarded runtime spawn room boundary must not be sealed by progression locks'
  );
  assertAllRequiredRoomsReachableFrom(runtime.dungeon, runtime.playerPos);
});
