'use strict';
// @ts-check

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const math = require('../engine/math.js');
const spawn = require('../engine/spawn.js');
const reachability = require('../engine/dungeon/reachability.js');

const ROOT = path.resolve(__dirname, '..');

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
  TRAP_SPIKE: 10,
  TRAP_SLOW: 11,
  PLASMA: 12,
  ARC: 13,
  VENDOR: 14,
  CRACKED: 15,
  LORE: 16,
  CHALLENGE_GATE: 17,
  IMPLANT_SHRINE: 18,
  EVENT_TERMINAL: 19,
  TELEPORT_PAD: 20,
  CRATE: 21,
  TOXIC: 22,
  SHOCK_TILE: 23,
  REPULSOR: 24,
  MAINFRAME_READER: 25,
  NETWORK_PORTAL: 26,
  MESSAGE_CONSOLE: 27,
});

const MAP_W = 80;
const MAP_H = 50;
const TILE = 32;
const TWO_PI = Math.PI * 2;

/**
 * @param {number} t
 * @returns {boolean}
 */
function isPassable(t) {
  return t === T.FLOOR || t === T.STAIRS || t === T.TERMINAL ||
    t === T.DOOR_OPEN || t === T.TRAP_SPIKE || t === T.TRAP_SLOW ||
    t === T.PLASMA || t === T.ARC || t === T.VENDOR || t === T.LORE ||
    t === T.CHALLENGE_GATE || t === T.IMPLANT_SHRINE ||
    t === T.EVENT_TERMINAL || t === T.TELEPORT_PAD || t === T.TOXIC ||
    t === T.SHOCK_TILE || t === T.REPULSOR || t === T.MAINFRAME_READER ||
    t === T.NETWORK_PORTAL || t === T.MESSAGE_CONSOLE;
}

/**
 * @param {number} t
 * @returns {boolean}
 */
function isSeeThrough(t) {
  return t !== T.WALL && t !== T.VOID && t !== T.CRACKED && t !== T.DOOR &&
    t !== T.LOCKED_R && t !== T.LOCKED_B && t !== T.LOCKED_G &&
    t !== T.CHALLENGE_GATE && t !== T.CRATE;
}

/**
 * @param {number} t
 * @returns {boolean}
 */
function isDoor(t) {
  return t === T.DOOR || t === T.LOCKED_R || t === T.LOCKED_B || t === T.LOCKED_G;
}

/**
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {number[][]} map
 * @returns {boolean}
 */
function hasLOS(x1, y1, x2, y2, map) {
  let cx = Math.floor(x1);
  let cy = Math.floor(y1);
  const ex = Math.floor(x2);
  const ey = Math.floor(y2);
  const dx = Math.abs(ex - cx);
  const dy = Math.abs(ey - cy);
  const sx = cx < ex ? 1 : -1;
  const sy = cy < ey ? 1 : -1;
  let err = dx - dy;
  for (let i = 0; i < 100; i++) {
    if (cx === ex && cy === ey) return true;
    if (cx < 0 || cy < 0 || cx >= MAP_W || cy >= MAP_H) return false;
    if (!isSeeThrough(map[cy][cx])) return false;
    const e2 = 2 * err;
    let nx = cx;
    let ny = cy;
    if (e2 > -dy) { err -= dy; nx += sx; }
    if (e2 < dx) { err += dx; ny += sy; }
    if (nx !== cx && ny !== cy &&
        !isSeeThrough(map[cy]?.[nx]) && !isSeeThrough(map[ny]?.[cx])) return false;
    cx = nx;
    cy = ny;
  }
  return true;
}

/**
 * @returns {any}
 */
function createGenerationSandbox() {
  const noop = () => {};
  const NEON = {
    save: { META_UPGRADES: [] },
    biomes: {
      finalFloor() { return 15; },
      /** @param {number} n */
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
    console,
    Math,
    Array,
    Uint8Array,
    Float32Array,
    Map,
    Set,
    Proxy,
    Object,
    Number,
    String,
    JSON,
    T,
    MAP_W,
    MAP_H,
    TILE,
    TWO_PI,
    isPassable,
    isSeeThrough,
    isDoor,
    hasLOS,
    ...math,
    NEON,
    _CG: {},
    window: { NEON },
    self: { NEON },
    performance: { now() { return 0; } },
    ctx: {
      save: noop,
      restore: noop,
      beginPath: noop,
      moveTo: noop,
      lineTo: noop,
      stroke: noop,
      fill: noop,
      arc: noop,
      closePath: noop,
      fillRect: noop,
      strokeRect: noop,
      setLineDash: noop,
      translate: noop,
      rotate: noop,
      ellipse: noop,
      fillText: noop,
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, 'src/neon.js'), 'utf8'),
    sandbox
  );
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
    fs.readFileSync(path.join(ROOT, 'src/content/weapons.js'), 'utf8'),
    sandbox
  );
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, 'src/content/upgrades.js'), 'utf8'),
    sandbox
  );
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, 'src/content/pickups.js'), 'utf8'),
    sandbox
  );
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, 'src/content/projectiles.js'), 'utf8'),
    sandbox
  );
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, 'src/content.js'), 'utf8') +
      '\nthis.generateFloor = generateFloor;',
    sandbox
  );
  return sandbox;
}

/**
 * @returns {{sandbox:any, generateFloor(seed:string, floor:number, opts?: any): any}}
 */
function createGenerationFixture() {
  const sandbox = createGenerationSandbox();
  return {
    sandbox,
    /**
     * @param {string} seed
     * @param {number} floor
     * @param {any} [opts]
     * @returns {any}
     */
    generateFloor(seed, floor, opts) {
      sandbox.setSeed(seed);
      return sandbox.withDerivedRngStream(`world:floor:${floor}`, () => sandbox.generateFloor(floor, opts));
    },
  };
}

/**
 * @param {any} dungeon
 * @param {number} tile
 * @returns {{x:number,y:number} | null}
 */
function findTile(dungeon, tile) {
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (dungeon.map[y]?.[x] === tile) return { x, y };
    }
  }
  return null;
}

/**
 * @param {number} tile
 * @returns {boolean}
 */
function isSafeSpawnTile(tile) {
  return isPassable(tile) &&
    tile !== T.TRAP_SPIKE && tile !== T.TRAP_SLOW &&
    tile !== T.PLASMA && tile !== T.ARC && tile !== T.TOXIC &&
    tile !== T.SHOCK_TILE && tile !== T.REPULSOR;
}

/**
 * Mirrors game.loadFloor() exit-position carryover for tests that need the
 * player's actual runtime start tile rather than generateFloor().playerPos.
 *
 * @param {any} dungeon
 * @param {{x:number,y:number} | null} exitPos
 * @param {{guardReachability?: boolean}} [opts]
 * @returns {{x:number,y:number}}
 */
function carriedSpawnForDungeon(dungeon, exitPos, opts = {}) {
  let playerPos = dungeon.playerPos;
  if (!exitPos) return playerPos;
  const near =
    spawn.findNearestPassable(dungeon.map, exitPos.x, exitPos.y, isSafeSpawnTile) ||
    spawn.findNearestPassable(dungeon.map, exitPos.x, exitPos.y, isPassable);
  if (!near) return playerPos;
  if (opts.guardReachability) {
    playerPos = repairDescentSpawnDungeon(dungeon, near);
    return playerPos;
  }
  playerPos = near;
  return playerPos;
}

/**
 * @param {string} seed
 * @param {number} floor
 * @returns {{seed:string, floor:number, dungeon:any, sandbox:any, playerPos:{x:number,y:number}, defaultPlayerPos:{x:number,y:number}, previousExitPos:({x:number,y:number} | null)}}
 */
function generateFloorWithGameSpawnFixture(seed, floor) {
  const fixture = createGenerationFixture();
  const previous = floor > 1 ? fixture.generateFloor(seed, floor - 1) : null;
  const previousExitPos = previous ? findTile(previous, T.STAIRS) : null;
  const standalone = fixture.generateFloor(seed, floor);
  const defaultPlayerPos = standalone.playerPos;
  const dungeon = fixture.generateFloor(seed, floor, previousExitPos ? { previousExitPos } : undefined);
  let playerPos = dungeon.playerPos;
  if (previousExitPos && !dungeon.preferredSpawnResolved) {
    playerPos =
      spawn.findNearestPassable(dungeon.map, previousExitPos.x, previousExitPos.y, isSafeSpawnTile) ||
      spawn.findNearestPassable(dungeon.map, previousExitPos.x, previousExitPos.y, isPassable) ||
      playerPos;
  }
  if (previousExitPos) playerPos = repairDescentSpawnDungeon(dungeon, playerPos);
  return { seed, floor, sandbox: fixture.sandbox, dungeon, playerPos, defaultPlayerPos, previousExitPos };
}

/**
 * Convenience wrapper for one-off regressions.
 *
 * @param {string} seed
 * @param {number} floor
 * @returns {{seed:string, floor:number, dungeon:any, sandbox:any}}
 */
function generateFloorFixture(seed, floor) {
  const fixture = createGenerationFixture();
  return {
    seed,
    floor,
    sandbox: fixture.sandbox,
    dungeon: fixture.generateFloor(seed, floor),
  };
}

/**
 * @param {number} tile
 * @param {Set<string>} have
 * @returns {boolean}
 */
function isOpenForKeys(tile, have) {
  return isPassable(tile) || tile === T.DOOR || tile === T.CRACKED || tile === T.CRATE ||
    (tile === T.LOCKED_R && have.has('red')) ||
    (tile === T.LOCKED_B && have.has('blue')) ||
    (tile === T.LOCKED_G && have.has('gold'));
}

/**
 * @param {number} tile
 * @returns {boolean}
 */
function isOpenForEngineKeyReach(tile) {
  return isPassable(tile) || tile === T.DOOR || tile === T.CRACKED || tile === T.CRATE;
}

/**
 * @param {any} dungeon
 * @param {Set<string>} have
 * @returns {Uint8Array[]}
 */
function computeReach(dungeon, have) {
  const map = dungeon.map;
  const sx = Math.floor(dungeon.playerPos.x);
  const sy = Math.floor(dungeon.playerPos.y);
  const vis = Array.from({ length: MAP_H }, () => new Uint8Array(MAP_W));
  const q = [{ x: sx, y: sy }];
  vis[sy][sx] = 1;
  while (q.length) {
    const next = q.shift();
    if (!next) break;
    const { x, y } = next;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H || vis[ny][nx]) continue;
      const tile = map[ny][nx];
      if (!isOpenForKeys(tile, have)) continue;
      vis[ny][nx] = 1;
      q.push({ x: nx, y: ny });
    }
  }
  return vis;
}

/**
 * @param {any} dungeon
 * @returns {{vis:Uint8Array[], have:Set<string>}}
 */
function physicalReachWithKeys(dungeon) {
  const solved = reachability.solveKeyLockReachability({
    map: dungeon.map,
    start: { x: Math.floor(dungeon.playerPos.x), y: Math.floor(dungeon.playerPos.y) },
    keys: dungeon.keyItems || [],
    isOpenTile: isOpenForEngineKeyReach,
    lockColourForTile,
  });
  return { vis: solved.reachable, have: solved.collectedColours, solved };
}

/**
 * @param {any} dungeon
 * @param {{x:number,y:number}} pos
 */
function roomAtDungeon(dungeon, pos) {
  const x = Math.floor(pos.x);
  const y = Math.floor(pos.y);
  return (dungeon.rooms || []).find((room) =>
    x >= room.x && x < room.x + room.w &&
    y >= room.y && y < room.y + room.h
  ) || null;
}

/**
 * @param {any} dungeon
 * @param {any} room
 */
function roomEligibleForDescentStart(dungeon, room) {
  return !!room && room !== dungeon.bossRoom && room !== dungeon.mainframeRoom && !room.roomType;
}

/**
 * @param {any} dungeon
 * @param {any} room
 * @param {{x:number,y:number}} origin
 */
function nearestSafeTileInRoom(dungeon, room, origin) {
  let best = null;
  let bestScore = Infinity;
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      if (!isSafeSpawnTile(dungeon.map[y]?.[x])) continue;
      const score = Math.abs((x + 0.5) - origin.x) + Math.abs((y + 0.5) - origin.y);
      if (score < bestScore) {
        bestScore = score;
        best = { x: x + 0.5, y: y + 0.5 };
      }
    }
  }
  return best;
}

/**
 * @param {any} dungeon
 * @param {{x:number,y:number}} playerPos
 */
function normalizeDescentSpawnDungeon(dungeon, playerPos) {
  const currentRoom = roomAtDungeon(dungeon, playerPos);
  if (roomEligibleForDescentStart(dungeon, currentRoom)) {
    if (isSafeSpawnTile(dungeon.map[Math.floor(playerPos.y)]?.[Math.floor(playerPos.x)])) return { playerPos, room: currentRoom };
    const safeSpawn = nearestSafeTileInRoom(dungeon, currentRoom, playerPos);
    if (safeSpawn) return { playerPos: safeSpawn, room: currentRoom };
  }
  let best = null;
  let bestScore = Infinity;
  for (const room of dungeon.rooms || []) {
    if (!roomEligibleForDescentStart(dungeon, room)) continue;
    const roomSpawn = nearestSafeTileInRoom(dungeon, room, playerPos);
    if (!roomSpawn) continue;
    const score = Math.abs(roomSpawn.x - playerPos.x) + Math.abs(roomSpawn.y - playerPos.y);
    if (score < bestScore) {
      bestScore = score;
      best = { playerPos: roomSpawn, room };
    }
  }
  return best || { playerPos, room: currentRoom };
}

/**
 * @param {number} tile
 */
function lockColourForTile(tile) {
  if (tile === T.LOCKED_R) return 'red';
  if (tile === T.LOCKED_B) return 'blue';
  if (tile === T.LOCKED_G) return 'gold';
  return null;
}

/**
 * @param {any} dungeon
 * @param {string} colour
 */
function downgradeLockedDoorsByColour(dungeon, colour) {
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (lockColourForTile(dungeon.map[y][x]) === colour) dungeon.map[y][x] = T.FLOOR;
    }
  }
}

/**
 * @param {any} dungeon
 * @param {any} room
 */
function downgradeLockedRoomBoundary(dungeon, room) {
  for (let x = room.x; x < room.x + room.w; x++) {
    if (isLockedDoorTile(dungeon.map[room.y]?.[x])) dungeon.map[room.y][x] = T.FLOOR;
    const bottomY = room.y + room.h - 1;
    if (isLockedDoorTile(dungeon.map[bottomY]?.[x])) dungeon.map[bottomY][x] = T.FLOOR;
  }
  for (let y = room.y; y < room.y + room.h; y++) {
    if (isLockedDoorTile(dungeon.map[y]?.[room.x])) dungeon.map[y][room.x] = T.FLOOR;
    const rightX = room.x + room.w - 1;
    if (isLockedDoorTile(dungeon.map[y]?.[rightX])) dungeon.map[y][rightX] = T.FLOOR;
  }
}

/**
 * @param {any} dungeon
 * @param {any} startRoom
 * @param {any} originalSpawnRoom
 */
function relocateStairsOutOfStartRoom(dungeon, startRoom, originalSpawnRoom) {
  if (!roomContainsTile(dungeon, startRoom, T.STAIRS)) return;
  let bestRoom = null;
  let bestScore = -1;
  for (const room of dungeon.rooms || []) {
    if (room === startRoom || room === originalSpawnRoom || !roomEligibleForDescentStart(dungeon, room)) continue;
    const score = Math.abs(room.cx - startRoom.cx) + Math.abs(room.cy - startRoom.cy);
    if (score > bestScore) {
      bestScore = score;
      bestRoom = room;
    }
  }
  if (!bestRoom) return;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (dungeon.map[y][x] === T.STAIRS) dungeon.map[y][x] = T.FLOOR;
    }
  }
  dungeon.map[bestRoom.cy][bestRoom.cx] = T.STAIRS;
  dungeon.stairRoom = bestRoom;
}

/**
 * @param {any} dungeon
 * @param {{x:number,y:number}} playerPos
 * @returns {{x:number,y:number}}
 */
function repairDescentSpawnDungeon(dungeon, playerPos) {
  const originalSpawnRoom = dungeon.defaultSpawnRoom || dungeon.spawnRoom;
  const normalized = normalizeDescentSpawnDungeon(dungeon, playerPos);
  const startRoom = normalized.room;
  playerPos = normalized.playerPos;
  if (startRoom) {
    dungeon.spawnRoom = startRoom;
    relocateStairsOutOfStartRoom(dungeon, startRoom, originalSpawnRoom);
    downgradeLockedRoomBoundary(dungeon, startRoom);
  }
  dungeon.playerPos = { x: playerPos.x, y: playerPos.y };
  for (let repair = 0; repair < 3; repair++) {
    const reach = physicalReachWithKeys(dungeon);
    const missing = [...lockColours(dungeon)].filter((colour) => !reach.have.has(colour));
    if (missing.length === 0) break;
    for (const colour of missing) downgradeLockedDoorsByColour(dungeon, colour);
  }
  return playerPos;
}

/**
 * @param {any} dungeon
 * @returns {Set<string>}
 */
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

/**
 * @param {any} dungeon
 * @param {any} room
 * @param {number} tile
 * @returns {boolean}
 */
function roomContainsTile(dungeon, room, tile) {
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      if (dungeon.map[y]?.[x] === tile) return true;
    }
  }
  return false;
}

/**
 * @param {number} tile
 * @returns {boolean}
 */
function isLockedDoorTile(tile) {
  return tile === T.LOCKED_R || tile === T.LOCKED_B || tile === T.LOCKED_G;
}

/**
 * @param {any} dungeon
 * @param {any} room
 * @returns {{x:number,y:number,tile:number}[]}
 */
function lockedDoorTilesOnRoomBoundary(dungeon, room) {
  /** @type {{x:number,y:number,tile:number}[]} */
  const out = [];
  for (let x = room.x; x < room.x + room.w; x++) {
    const top = dungeon.map[room.y]?.[x];
    if (isLockedDoorTile(top)) out.push({ x, y: room.y, tile: top });
    const bottomY = room.y + room.h - 1;
    const bottom = dungeon.map[bottomY]?.[x];
    if (isLockedDoorTile(bottom)) out.push({ x, y: bottomY, tile: bottom });
  }
  for (let y = room.y; y < room.y + room.h; y++) {
    const left = dungeon.map[y]?.[room.x];
    if (isLockedDoorTile(left)) out.push({ x: room.x, y, tile: left });
    const rightX = room.x + room.w - 1;
    const right = dungeon.map[y]?.[rightX];
    if (isLockedDoorTile(right)) out.push({ x: rightX, y, tile: right });
  }
  return out;
}

module.exports = {
  MAP_H,
  MAP_W,
  T,
  computeReach,
  carriedSpawnForDungeon,
  createGenerationFixture,
  findTile,
  generateFloorFixture,
  generateFloorWithGameSpawnFixture,
  hasLOS,
  isDoor,
  isPassable,
  isSafeSpawnTile,
  isSeeThrough,
  lockColours,
  lockedDoorTilesOnRoomBoundary,
  physicalReachWithKeys,
  roomContainsTile,
};
