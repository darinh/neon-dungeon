'use strict';

const { createHash } = require('node:crypto');
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
  isSafeSpawnTile,
  lockColours,
  lockedDoorTilesOnRoomBoundary,
  physicalReachWithKeys,
  roomContainsTile,
} = require('./_generation-fixture.js');

const GAME = fs.readFileSync(path.join(__dirname, '..', 'src', 'game.js'), 'utf8');
const FLOOR_GENERATOR = fs.readFileSync(path.join(__dirname, '..', 'src', 'content', 'floor-generator.js'), 'utf8');

function reachWithAllLocksOpen(dungeon) {
  return computeReach(dungeon, new Set(['red', 'blue', 'gold']));
}

function emptyTestMap() {
  return Array.from({ length: MAP_H }, () => new Uint8Array(MAP_W).fill(T.WALL));
}

function dungeonGenerationDigest(dungeon) {
  const roomSummary = (room) => room && {
    x: room.x,
    y: room.y,
    w: room.w,
    h: room.h,
    cx: room.cx,
    cy: room.cy,
    roomType: room.roomType || null,
  };
  const summary = {
    map: dungeon.map.map((row) => Array.from(row).join(',')).join(';'),
    rooms: (dungeon.rooms || []).map(roomSummary),
    playerPos: dungeon.playerPos,
    spawnRoom: roomSummary(dungeon.spawnRoom),
    stairRoom: roomSummary(dungeon.stairRoom),
    bossRoom: roomSummary(dungeon.bossRoom),
    mainframeRoom: roomSummary(dungeon.mainframeRoom),
    keyItems: dungeon.keyItems || [],
    whisperItems: dungeon.whisperItems || [],
    challengeEntrances: dungeon.challengeEntrances || [],
    bossEntrances: dungeon.bossEntrances || [],
  };
  return createHash('sha256').update(JSON.stringify(summary)).digest('hex');
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

test('progression reachability follows player-interaction tile semantics', () => {
  const map = emptyTestMap();
  map[1][1] = T.FLOOR;
  map[1][2] = T.DOOR;
  map[1][3] = T.CRACKED;
  map[1][4] = T.CRATE;
  map[1][5] = T.CHALLENGE_GATE;
  map[1][6] = T.TRAP_SPIKE;
  map[1][7] = T.TRAP_SLOW;
  map[1][8] = T.PLASMA;
  map[1][9] = T.ARC;
  map[1][10] = T.TOXIC;
  map[1][11] = T.SHOCK_TILE;
  map[1][12] = T.REPULSOR;
  map[1][13] = T.FLOOR;
  const dungeon = {
    map,
    rooms: [],
    spawnRoom: { x: 1, y: 1, w: 1, h: 1, cx: 1, cy: 1 },
    playerPos: { x: 1.5, y: 1.5 },
    keyItems: [{ x: 13, y: 1, colour: 'red', tileColour: '#ff3333' }],
  };
  const reach = physicalReachWithKeys(dungeon);
  assert.equal(
    reach.have.has('red'),
    true,
    'closed doors, cracked walls, crates, challenge gates, and runtime-walkable hazards are valid progression traversal'
  );
});

test('physical reachability fixture delegates to engine solver without changing traversal semantics', () => {
  const { dungeon } = generateFloorFixture('1111-1111-1111', 2);
  const reach = physicalReachWithKeys(dungeon);
  const diagnostic = computeReach(dungeon, reach.have);
  for (let y = 0; y < MAP_H; y++) {
    assert.deepEqual(Array.from(reach.vis[y]), Array.from(diagnostic[y]), `row ${y}`);
  }
});

test('documented traversal semantics distinguish blockers, interactions, hazards, and key locks', () => {
  const map = emptyTestMap();
  map[2][1] = T.FLOOR;
  map[1][1] = T.WALL;
  map[3][1] = T.VOID;
  const pathTiles = [
    T.DOOR,
    T.CRACKED,
    T.CHALLENGE_GATE,
    T.TRAP_SPIKE,
    T.TRAP_SLOW,
    T.PLASMA,
    T.ARC,
    T.TOXIC,
    T.SHOCK_TILE,
    T.REPULSOR,
    T.LOCKED_R,
    T.STAIRS,
  ];
  for (let i = 0; i < pathTiles.length; i++) map[2][2 + i] = pathTiles[i];
  const dungeon = {
    map,
    rooms: [],
    spawnRoom: { x: 1, y: 2, w: 1, h: 1, cx: 1, cy: 2 },
    playerPos: { x: 1.5, y: 2.5 },
    keyItems: [{ x: 11, y: 2, colour: 'red', tileColour: '#ff3333' }],
  };

  const reach = physicalReachWithKeys(dungeon);
  assert.equal(reach.vis[1][1], 0, 'walls remain permanent blockers');
  assert.equal(reach.vis[3][1], 0, 'void remains a permanent blocker');
  assert.equal(reach.have.has('red'), true, 'keys on runtime-walkable hazard tiles are physically collectible');
  assert.equal(reach.vis[2][12], 1, 'matching key pickup opens red locks during fixed-point traversal');
  assert.equal(reach.vis[2][13], 1, 'stairs remain reachable after interactable gates, hazards, and keyed locks');
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

function tileInsideRoom(dungeon, x, y) {
  return dungeon.rooms.some((room) =>
    x >= room.x && x < room.x + room.w &&
    y >= room.y && y < room.y + room.h
  );
}

function tileOnRoomBoundary(dungeon, x, y) {
  return dungeon.rooms.some((room) =>
    x >= room.x && x < room.x + room.w &&
    y >= room.y && y < room.y + room.h &&
    (x === room.x || x === room.x + room.w - 1 || y === room.y || y === room.y + room.h - 1)
  );
}

function tileOnRoomCorner(dungeon, x, y) {
  return dungeon.rooms.some((room) =>
    (x === room.x || x === room.x + room.w - 1) &&
    (y === room.y || y === room.y + room.h - 1)
  );
}

function isNormalOrLockedDoorTile(tile) {
  return tile === T.DOOR || tile === T.LOCKED_R || tile === T.LOCKED_B || tile === T.LOCKED_G;
}

function isDoorLikeTile(tile) {
  return isNormalOrLockedDoorTile(tile) || tile === T.CHALLENGE_GATE || tile === T.CRACKED;
}

function isWallLikeTile(tile) {
  return tile === T.WALL || tile === T.VOID || tile == null;
}

function isWalkAroundDoorTile(tile) {
  return !isWallLikeTile(tile) && !isDoorLikeTile(tile);
}

function isSealedDoorBypassCorner(dungeon, doorX, doorY, cornerX, cornerY) {
  const dx = cornerX - doorX;
  const dy = cornerY - doorY;
  return Math.abs(dx) === 1 &&
    Math.abs(dy) === 1 &&
    isWallLikeTile(dungeon.map[cornerY]?.[cornerX]) &&
    isWalkAroundDoorTile(dungeon.map[doorY]?.[cornerX]) &&
    isWalkAroundDoorTile(dungeon.map[cornerY]?.[doorX]);
}

function isCorridorTile(dungeon, x, y) {
  const tile = dungeon.map[y]?.[x];
  return !tileInsideRoom(dungeon, x, y) && tile !== T.WALL && tile !== T.VOID;
}

function isOutsidePassageTile(dungeon, x, y) {
  if (x <= 0 || y <= 0 || x >= MAP_W - 1 || y >= MAP_H - 1) return false;
  return !tileInsideRoom(dungeon, x, y) && !isWallLikeTile(dungeon.map[y]?.[x]);
}

function isLiveEntranceConnectionTile(dungeon, x, y) {
  const tile = dungeon.map[y]?.[x];
  return isOutsidePassageTile(dungeon, x, y) || (tileInsideRoom(dungeon, x, y) && isWalkAroundDoorTile(tile));
}

function roomBoundaryNeighborsForEntrance(dungeon, x, y) {
  return [[1, 0], [-1, 0], [0, 1], [0, -1]]
    .map(([dx, dy]) => ({ dx, dy, bx: x + dx, by: y + dy }))
    .filter(({ bx, by }) => tileOnRoomBoundary(dungeon, bx, by));
}

function outsidePassageConnectionCount(dungeon, x, y, exceptX, exceptY) {
  return [[1, 0], [-1, 0], [0, 1], [0, -1]]
    .filter(([dx, dy]) => x + dx !== exceptX || y + dy !== exceptY)
    .filter(([dx, dy]) => isLiveEntranceConnectionTile(dungeon, x + dx, y + dy))
    .length;
}

function connectedPassageOppositeRoomSide(dungeon, x, y, side) {
  const px = x - side.dx;
  const py = y - side.dy;
  if (!isOutsidePassageTile(dungeon, px, py)) return { ok: false, reason: 'missing' };
  if (outsidePassageConnectionCount(dungeon, px, py, x, y) <= 0) return { ok: false, reason: 'stub' };
  return { ok: true, reason: '' };
}

function assertOutwardSingleTileEntrances(dungeon, label) {
  const failures = [];
  for (let y = 1; y < MAP_H - 1; y++) {
    for (let x = 1; x < MAP_W - 1; x++) {
      const tile = dungeon.map[y][x];
      if (!isDoorLikeTile(tile)) continue;
      if (tileInsideRoom(dungeon, x, y)) failures.push(`${label}: door-like tile is still inside a room at ${x},${y}`);
      if (tileOnRoomBoundary(dungeon, x, y)) failures.push(`${label}: door-like tile still occupies the room boundary at ${x},${y}`);
      if (tileOnRoomCorner(dungeon, x, y)) failures.push(`${label}: door-like tile on room corner at ${x},${y}`);
      const roomSides = roomBoundaryNeighborsForEntrance(dungeon, x, y);
      if (roomSides.length < 1 || roomSides.length > 2) {
        failures.push(`${label}: door-like tile should sit outside one room boundary or between two room boundaries at ${x},${y}, found ${roomSides.length}`);
      }
      if (roomSides.length === 2 && (roomSides[0].dx + roomSides[1].dx !== 0 || roomSides[0].dy + roomSides[1].dy !== 0)) {
        failures.push(`${label}: two-sided door-like tile should bridge opposite room boundaries at ${x},${y}`);
      }
      for (const side of roomSides) {
        const roomTile = dungeon.map[side.by]?.[side.bx];
        if (isWallLikeTile(roomTile) || isDoorLikeTile(roomTile)) failures.push(`${label}: room-side boundary tile was not restored to floor at ${side.bx},${side.by}`);
        const px = side.dy === 0 ? 0 : 1;
        const py = side.dx === 0 ? 0 : 1;
        for (const sign of [-1, 1]) {
          const sx = side.bx + px * sign;
          const sy = side.by + py * sign;
          if (
            tileInsideRoom(dungeon, sx, sy) &&
            !tileOnRoomCorner(dungeon, sx, sy) &&
            isWallLikeTile(dungeon.map[sy]?.[sx]) &&
            !isSealedDoorBypassCorner(dungeon, x, y, sx, sy)
          ) {
            failures.push(`${label}: side-wall padding still bulges into the room at ${sx},${sy}`);
          }
        }
      }
      if (roomSides.length === 1) {
        const alignedPassage = connectedPassageOppositeRoomSide(dungeon, x, y, roomSides[0]);
        if (!alignedPassage.ok && alignedPassage.reason === 'stub') {
          failures.push(`${label}: aligned passage is a dead-end stub at ${x},${y}`);
        } else if (!alignedPassage.ok) {
          failures.push(`${label}: door-like tile is next to a hallway but not aligned with it at ${x},${y}`);
        }
      }
      const adjacentDoor = [[1, 0], [-1, 0], [0, 1], [0, -1]]
        .some(([dx, dy]) => isDoorLikeTile(dungeon.map[y + dy]?.[x + dx]));
      if (adjacentDoor) failures.push(`${label}: adjacent double door/gate tile at ${x},${y}`);
    }
  }
  assert.deepEqual(failures, []);
}

function assertNormalLockedDoorsRelocatedOutward(dungeon, label) {
  const failures = [];
  let doorCount = 0;
  for (let y = 1; y < MAP_H - 1; y++) {
    for (let x = 1; x < MAP_W - 1; x++) {
      const tile = dungeon.map[y][x];
      if (!isNormalOrLockedDoorTile(tile)) continue;
      doorCount++;
      if (tileInsideRoom(dungeon, x, y)) failures.push(`${label}: normal/locked door is still inside a room at ${x},${y}`);
      if (tileOnRoomBoundary(dungeon, x, y)) failures.push(`${label}: normal/locked door still occupies the room boundary at ${x},${y}`);
      const roomSides = roomBoundaryNeighborsForEntrance(dungeon, x, y);
      if (roomSides.length < 1 || roomSides.length > 2) {
        failures.push(`${label}: normal/locked door should sit outside one room boundary or between two room boundaries at ${x},${y}, found ${roomSides.length}`);
      }
      if (roomSides.length === 1) {
        const alignedPassage = connectedPassageOppositeRoomSide(dungeon, x, y, roomSides[0]);
        if (!alignedPassage.ok) failures.push(`${label}: normal/locked door is not aligned with a live outside passage at ${x},${y}`);
      }
    }
  }
  if (doorCount <= 0) failures.push(`${label}: normal/locked doors must survive outside-wall relocation`);
  assert.deepEqual(failures, []);
}

function assertNoWideCorridors(dungeon, label) {
  const failures = [];
  for (let y = 1; y < MAP_H - 2; y++) {
    for (let x = 1; x < MAP_W - 2; x++) {
      if (isCorridorTile(dungeon, x, y) &&
          isCorridorTile(dungeon, x + 1, y) &&
          isCorridorTile(dungeon, x, y + 1) &&
          isCorridorTile(dungeon, x + 1, y + 1)) {
        const adjacentRoomEdges = [
          [x - 1, y], [x - 1, y + 1], [x + 2, y], [x + 2, y + 1],
          [x, y - 1], [x + 1, y - 1], [x, y + 2], [x + 1, y + 2],
        ].filter(([ax, ay]) => tileInsideRoom(dungeon, ax, ay)).length;
        if (adjacentRoomEdges >= 2) continue;
        failures.push(`${label}: 2x2 corridor block at ${x},${y}`);
      }
    }
  }
  assert.deepEqual(failures, []);
}

function assertNoDoorBypassCorners(dungeon, label) {
  const failures = [];
  for (let y = 1; y < MAP_H - 1; y++) {
    for (let x = 1; x < MAP_W - 1; x++) {
      if (!isDoorLikeTile(dungeon.map[y][x])) continue;
      for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        if (
          isWalkAroundDoorTile(dungeon.map[y][x + dx]) &&
          isWalkAroundDoorTile(dungeon.map[y + dy][x]) &&
          isWalkAroundDoorTile(dungeon.map[y + dy][x + dx])
        ) {
          failures.push(`${label}: walk-around corner ${x + dx},${y + dy} bypasses door-like tile at ${x},${y}`);
        }
      }
    }
  }
  assert.deepEqual(failures, []);
}

function gridHasDoorBypassCorner(grid) {
  for (let y = 1; y < grid.length - 1; y++) {
    for (let x = 1; x < grid[y].length - 1; x++) {
      if (!isDoorLikeTile(grid[y][x])) continue;
      for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        if (
          isWalkAroundDoorTile(grid[y][x + dx]) &&
          isWalkAroundDoorTile(grid[y + dy][x]) &&
          isWalkAroundDoorTile(grid[y + dy][x + dx])
        ) return true;
      }
    }
  }
  return false;
}

test('door placement invariant rejects walk-around 3x3 door bypasses', () => {
  const F = T.FLOOR;
  const W = T.WALL;
  const D = T.DOOR;
  const cases = [
    {
      label: 'reported floor bypass',
      grid: [[F, W, F], [F, D, F], [F, F, F]],
      bypass: true,
    },
    {
      label: 'non-floor walkable bypass corner',
      grid: [[F, W, F], [F, D, F], [F, T.TRAP_SPIKE, T.PLASMA]],
      bypass: true,
    },
    {
      label: 'normal T intersection',
      grid: [[F, W, F], [F, D, F], [W, F, W]],
      bypass: false,
    },
    {
      label: 'L path door',
      grid: [[W, W, W], [F, D, W], [W, F, W]],
      bypass: false,
    },
    {
      label: 'four-way intersection',
      grid: [[W, F, W], [F, D, F], [W, F, W]],
      bypass: false,
    },
  ];
  for (const c of cases) assert.equal(gridHasDoorBypassCorner(c.grid), c.bypass, c.label);
});

test('floor generator door bypass sealer checks open corners, not only floor corners', () => {
  assert.match(FLOOR_GENERATOR, /dungeonTopology\.visitDiagonalBypassCornerSeals\(\s*map,\s*isDoorLikeEntranceTile,\s*isOpenDoorBypassTile,/);
  assert.doesNotMatch(FLOOR_GENERATOR, /map\[y \+ dy\]\?\.\[x \+ dx\] === T\.FLOOR/);
});

function assertNormalRuntimeStart(runtime, reason = '') {
  const prefix = reason ? `[${reason}] ` : '';
  const runtimeRoom = roomAt(runtime.dungeon, runtime.playerPos);
  const defaultRoom = roomAt(runtime.dungeon, runtime.defaultPlayerPos);
  const spawnTile = runtime.dungeon.map[Math.floor(runtime.playerPos.y)]?.[Math.floor(runtime.playerPos.x)];
  assert.ok(runtimeRoom, prefix + 'runtime spawn should normalize to a room');
  assert.equal(isSafeSpawnTile(spawnTile), true, prefix + 'runtime spawn must land on a safe final tile');
  assert.equal(runtimeRoom.roomType || null, null, prefix + 'runtime spawn room must be a normal room so populateFloor can safely skip it');
  assert.notEqual(runtimeRoom, runtime.dungeon.bossRoom, prefix + 'runtime spawn room must not be the boss room');
  assert.notEqual(runtimeRoom, runtime.dungeon.mainframeRoom, prefix + 'runtime spawn room must not be the mainframe room');
  assert.equal(runtime.dungeon.spawnRoom, runtimeRoom, prefix + 'normalized runtime room becomes the spawn room');
  assert.equal(roomContainsTile(runtime.dungeon, runtimeRoom, T.STAIRS), false, prefix + 'runtime start room must not contain stairs');
  assert.deepEqual(lockedDoorTilesOnRoomBoundary(runtime.dungeon, runtimeRoom), [], prefix + 'runtime start room boundary must not be sealed by progression locks');
  const stairs = findTile(runtime.dungeon, T.STAIRS);
  assert.ok(stairs, prefix + 'runtime floor must still contain stairs after repair');
  const stairRoom = roomAt(runtime.dungeon, { x: stairs.x + 0.5, y: stairs.y + 0.5 });
  assert.ok(stairRoom, prefix + 'stairs should remain in a room after relocation');
  assert.notEqual(stairRoom, defaultRoom, prefix + 'relocated stairs must not move into the standalone generateFloor() spawn room');
  assert.equal(stairRoom.roomType || null, null, prefix + 'relocated stairs must stay in a normal room so special-room setup cannot overwrite them');
  assertAllRequiredRoomsReachableFrom(runtime.dungeon, runtime.playerPos);
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

function assertSpecialEntranceInvariants(dungeon, label) {
  if (dungeon.challengeRoom) {
    assert.ok((dungeon.challengeEntrances || []).length > 0, `${label}: challenge room has no live entrance metadata`);
    for (const entry of dungeon.challengeEntrances || []) {
      assert.equal(dungeon.map[entry.y]?.[entry.x], T.CHALLENGE_GATE, `${label}: stale challenge entrance metadata at ${entry.x},${entry.y}`);
    }
  }
  for (const secret of dungeon.secretRooms || []) {
    let cracked = 0;
    for (let y = Math.max(0, secret.y - 1); y <= Math.min(MAP_H - 1, secret.y + secret.h); y++) {
      for (let x = Math.max(0, secret.x - 1); x <= Math.min(MAP_W - 1, secret.x + secret.w); x++) {
        if (dungeon.map[y]?.[x] === T.CRACKED) {
          cracked++;
          assert.equal(dungeon.secretMask[y][x], 0,
            `${label}: cracked entrance at ${x},${y} must stay visible outside the secret mask`);
        }
      }
    }
    assert.ok(cracked > 0, `${label}: secret room at ${secret.x},${secret.y} has no cracked entrance`);
  }
  const lockTiles = {
    red: T.LOCKED_R,
    blue: T.LOCKED_B,
    gold: T.LOCKED_G,
  };
  for (const key of dungeon.keyItems || []) {
    const lockTile = lockTiles[key.colour];
    assert.ok(lockTile, `${label}: key has unknown colour ${key.colour}`);
    assert.ok(dungeon.map.some((row) => Array.from(row).includes(lockTile)), `${label}: ${key.colour} key exists without a matching live lock`);
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
    'fuzz-4',
    'passage-13',
  ];
  for (const seed of seeds) {
    for (let floor = 1; floor <= 15; floor++) {
      const dungeon = fixture.generateFloor(seed, floor);
      assertAllRequiredRoomsReachable(dungeon);
      assertNoSpawnRoomKeys(dungeon);
      assertNoDuplicateKeyTiles(dungeon);
      assertSpecialEntranceInvariants(dungeon, `${seed} floor ${floor}`);
      assertNormalLockedDoorsRelocatedOutward(dungeon, `${seed} floor ${floor}`);
      assertOutwardSingleTileEntrances(dungeon, `${seed} floor ${floor}`);
      assertNoDoorBypassCorners(dungeon, `${seed} floor ${floor}`);
      assertNoWideCorridors(dungeon, `${seed} floor ${floor}`);
    }
  }
});

test('sampled seeded generation digests stay stable across topology extraction', () => {
  const fixture = createGenerationFixture();
  const expected = new Map([
    ['1111-1111-1111 floor 2', '9fe099642f78901b2ee81a6677364422f4b5f35d8cd2aaf5b766fdb2051f840b'],
    ['1111-1111-1111 floor 6', 'ade758383ac23e318b6332f490fc9c85c64455186795d8611568d9a78ac8fd1d'],
    ['FACE-FEED-BEEF floor 3', 'f6b8ab53fac76bddc5425437e39ced77c2b7183650df74b595955799f0dbc328'],
    ['CAFE-BABE-0001 floor 8', '17b6d82826e358a388789784d4394ad13450cd7c0e1fbadf9b8b5b5acfb33801'],
    ['DEAD-BEEF-CAFE floor 15', '8faec8b11dbd86477a74876e4da61c8522a9f7936717b4c7c229be502d8a2f33'],
  ]);
  for (const [label, digest] of expected) {
    const [seed, , floorText] = label.split(' ');
    const dungeon = fixture.generateFloor(seed, Number(floorText));
    assert.equal(dungeonGenerationDigest(dungeon), digest, label);
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

test('seed 1111-1111-1111 floor 2 preserves descent start and repairs that room', () => {
  assert.match(
    GAME,
    /spawn = repairDescentSpawnFloor\(this\.dungeon, spawn, this\.player && this\.player\.keys\);/
  );
  assert.match(
    GAME,
    /generateFloor\(n, descentExitPos \? \{ previousExitPos: descentExitPos \} : undefined\)/
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
  const defaultRoom = roomAt(runtime.dungeon, runtime.defaultPlayerPos);
  assert.ok(runtimeRoom, 'runtime spawn should land in a room');
  assert.ok(defaultRoom, 'standalone default spawn room should still be identifiable');
  assert.equal(
    `${runtime.playerPos.x},${runtime.playerPos.y}`,
    `${unguardedSpawn.x},${unguardedSpawn.y}`,
    'runtime descent spawn must stay below the previous floor exit instead of falling back to generated spawn'
  );
  assert.notDeepEqual(
    runtime.playerPos,
    runtime.defaultPlayerPos,
    'runtime descent spawn must not use standalone generateFloor() default spawn for this regression'
  );
  assert.equal(
    runtime.dungeon.spawnRoom,
    runtimeRoom,
    'room containing the carried descent spawn becomes the runtime starting room'
  );
  assert.notEqual(
    runtime.dungeon.defaultSpawnRoom,
    runtime.dungeon.spawnRoom,
    'generator must remember the standalone default spawn separately from the carried runtime spawn'
  );
  assertNormalRuntimeStart(runtime);
});

test('runtime descent start normalizes corridor, special, and boss-room carryover cases', () => {
  const cases = [
    { seed: '1111-1111-1111', floor: 3, reason: 'raw carried spawn lands in a corridor' },
    { seed: 'special-search-1', floor: 7, reason: 'raw carried spawn lands in a vendor room' },
    { seed: '1000', floor: 3, reason: 'raw carried spawn lands in the boss room' },
  ];
  for (const c of cases) {
    const runtime = generateFloorWithGameSpawnFixture(c.seed, c.floor);
    assertNormalRuntimeStart(runtime, c.reason);
  }
});

test('runtime descent does not abandon sparse previous-exit fallback to generated default spawn', () => {
  const cases = [
    { seed: '1006', floor: 14 },
    { seed: '1049', floor: 8 },
  ];
  for (const c of cases) {
    const runtime = generateFloorWithGameSpawnFixture(c.seed, c.floor);
    assert.equal(runtime.dungeon.preferredSpawnResolved, false, `${c.seed} floor ${c.floor} should exercise unresolved preferred-spawn fallback`);
    assertNormalRuntimeStart(runtime, `${c.seed} floor ${c.floor}`);
    const carriedDistance = Math.abs(runtime.playerPos.x - (runtime.previousExitPos.x + 0.5)) +
      Math.abs(runtime.playerPos.y - (runtime.previousExitPos.y + 0.5));
    const defaultDistance = Math.abs(runtime.defaultPlayerPos.x - (runtime.previousExitPos.x + 0.5)) +
      Math.abs(runtime.defaultPlayerPos.y - (runtime.previousExitPos.y + 0.5));
    assert.ok(
      carriedDistance < defaultDistance,
      `${c.seed} floor ${c.floor} should stay closer to the previous exit than the standalone default spawn`
    );
  }
});

test('runtime descent repairs preferred spawn tiles that later become doors', () => {
  const cases = [
    { seed: '1002', floor: 9 },
    { seed: '1016', floor: 5 },
  ];
  for (const c of cases) {
    const runtime = generateFloorWithGameSpawnFixture(c.seed, c.floor);
    assert.equal(runtime.dungeon.preferredSpawnResolved, true, `${c.seed} floor ${c.floor} should resolve the preferred room during generation`);
    assertNormalRuntimeStart(runtime, `${c.seed} floor ${c.floor}`);
    const spawnTile = runtime.dungeon.map[Math.floor(runtime.playerPos.y)]?.[Math.floor(runtime.playerPos.x)];
    assert.notEqual(spawnTile, T.DOOR, `${c.seed} floor ${c.floor} spawn tile must move off closed doors`);
  }
});

test('runtime stair relocation keeps stairs out of special rooms that populateFloor may overwrite', () => {
  const runtime = generateFloorWithGameSpawnFixture('1111-1111-1111', 14);
  const runtimeRoom = roomAt(runtime.dungeon, runtime.playerPos);
  assert.ok(runtimeRoom, 'runtime spawn should land in a room');
  assert.equal(roomContainsTile(runtime.dungeon, runtimeRoom, T.STAIRS), false);
  const stairs = findTile(runtime.dungeon, T.STAIRS);
  assert.ok(stairs, 'stairs must still exist after runtime repair');
  const stairRoom = roomAt(runtime.dungeon, { x: stairs.x + 0.5, y: stairs.y + 0.5 });
  assert.ok(stairRoom, 'stairs should be placed inside a room');
  assert.equal(stairRoom.roomType || null, null, 'stairs must not relocate into medbay/vendor/event/shrine/special rooms');
});
