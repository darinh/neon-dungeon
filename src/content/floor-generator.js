// @ts-check
'use strict';

// Dungeon generation, room feature placement, and floor-level content
// orchestration. Loaded before the src/content.js compatibility facade so the
// legacy script-tag globals remain available to game/runtime callers.
//
// Proxy-based alias for the cross-file `game` global. Generation touches many
// runtime-added game props (game._minimapDirty, game.mapRevealed, etc.) that
// don't appear on the typed game shape declared in src/game.js. The proxy
// widens access to `any` and defers resolution. Mirrors the pattern in
// src/render.js (_RG) and src/platform.js (_G).
/** @type {any} */
const _CG = new Proxy({}, {
  get: (_t, p) => /** @type {any} */ (game)[p],
  set: (_t, p, v) => { /** @type {any} */ (game)[p] = v; return true; },
  has: (_t, p) => p in /** @type {any} */ (game),
});
const dungeonTopology = /** @type {any} */ (requireNEON('dungeonTopology', 'src/content/floor-generator.js'));
const dungeonReachability = /** @type {any} */ (requireNEON('dungeonReachability', 'src/content/floor-generator.js'));
const DUNGEON_CARDINAL_DIRECTIONS = /** @type {ReadonlyArray<readonly [number, number]>} */ (dungeonTopology.CARDINAL_DIRECTIONS);
const DUNGEON_DIAGONAL_DIRECTIONS = /** @type {ReadonlyArray<readonly [number, number]>} */ (Object.freeze([
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]));

// ─── Dungeon Generator ───────────────────────────────────────────────────────
/** @returns {any} */
function createMap() {
  return dungeonTopology.createMap(MAP_W, MAP_H, T.WALL);
}

/**
 * @param {any} map
 * @param {any} x
 * @param {any} y
 * @param {any} w
 * @param {any} h
 * @param {any} tile
 */
function carveRect(map, x, y, w, h, tile) {
  dungeonTopology.carveRect(map, x, y, w, h, tile);
}

/**
 * @param {any} map
 * @param {any} x1
 * @param {any} y1
 * @param {any} x2
 * @param {any} y2
 */
function carveCorridor(map, x1, y1, x2, y2) {
  dungeonTopology.carveCorridor(map, x1, y1, x2, y2, T.FLOOR);
}

/**
 * @param {any} rooms
 * @param {any} startRoom
 * @param {any} map
 */
function bfsRooms(rooms, startRoom, map) {
  return dungeonTopology.bfsRooms(rooms, startRoom, (/** @type {any} */ cur, /** @type {any} */ other) =>
    hasLOS(cur.cx, cur.cy, other.cx, other.cy, map) ||
    dist2(cur.cx, cur.cy, other.cx, other.cy) < 400
  );
}

/**
 * @param {number[][]} map
 * @param {any[]} rooms
 * @param {{x:number,y:number}|null|undefined} preferred
 * @returns {{pos:{x:number,y:number}, room:any}|null}
 */
function resolvePreferredSpawnRoom(map, rooms, preferred) {
  return dungeonTopology.resolvePreferredSpawnRoom({
    map,
    rooms,
    preferred,
    isPassable: (/** @type {number} */ tile) => isPassable(tile),
    searchRadius: 12,
  });
}

/**
 * @param {any} floorNum
 * @param {{previousExitPos?: {x:number,y:number}|null}} [opts]
 */
function generateFloor(floorNum, opts) {
  const bsp = dungeonTopology.createBspDungeon({
    width: MAP_W,
    height: MAP_H,
    depth: 5,
    wallTile: T.WALL,
    floorTile: T.FLOOR,
    rand: () => rand('world'),
    rndInt,
  });
  const map = bsp.map;
  const rooms = bsp.rooms;

  // Pick spawn room — try several candidates and pick the one that maximizes
  // BFS distance to the farthest room (ensures exit is far from spawn).
  let spawnRoom = rooms[0];
  if (rooms.length > 3) {
    const candidates = [];
    for (let ci = 0; ci < Math.min(rooms.length, 6); ci++) candidates.push(rooms[ci]);
    // Also try a random room for variety
    candidates.push(rooms[rndInt(0, rooms.length - 1)]);
    let bestMaxD = 0;
    for (const c of candidates) {
      const cd = bfsRooms(rooms, c, map);
      let cMax = 0;
      for (const [,dd] of cd) { if (dd > cMax) cMax = dd; }
      if (cMax > bestMaxD) { bestMaxD = cMax; spawnRoom = c; }
    }
  }
  const defaultSpawnRoom = spawnRoom;
  let playerPos = { x: spawnRoom.cx + 0.5, y: spawnRoom.cy + 0.5 };
  const preferredSpawn = resolvePreferredSpawnRoom(map, rooms, opts && opts.previousExitPos);
  if (preferredSpawn) {
    spawnRoom = preferredSpawn.room;
    playerPos = preferredSpawn.pos;
  }

  // Furthest room from spawn for stairs
  let dist = bfsRooms(rooms, spawnRoom, map);
  let farthest = spawnRoom, farthestD = 0;
  for (const [r,d] of dist) {
    if (preferredSpawn && r === defaultSpawnRoom) continue;
    if (preferredSpawn && r === spawnRoom) continue;
    if (d>farthestD) { farthestD=d; farthest=r; }
  }
  if (preferredSpawn && farthest === spawnRoom) {
    let bestRoom = null;
    let bestScore = -1;
    for (const r of rooms) {
      if (!r || r === spawnRoom || r === defaultSpawnRoom || r.roomType) continue;
      const score = Math.abs(r.cx - spawnRoom.cx) + Math.abs(r.cy - spawnRoom.cy);
      if (score > bestScore) { bestScore = score; bestRoom = r; }
    }
    if (bestRoom) farthest = bestRoom;
  }
  const _finalFloor = (typeof NEON !== 'undefined' && NEON.biomes && NEON.biomes.finalFloor) ? NEON.biomes.finalFloor() : 15;
  const _isBossFloor = (typeof NEON !== 'undefined' && NEON.biomes && NEON.biomes.isBiomeBossFloor) ? NEON.biomes.isBiomeBossFloor(floorNum) : (floorNum===3||floorNum===6||floorNum===10);

  /** @type {any} */
  let mainframeRoom = null;
  if (floorNum >= _finalFloor) {
    const MAINFRAME_MIN_W = 18;
    const MAINFRAME_MIN_H = 10;
    const originalFarthest = farthest;
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     * @param {any} ignoredRoom
     */
    const overlapsOtherRoom = (x, y, w, h, ignoredRoom) => {
      const ox1 = x - 1, oy1 = y - 1, ox2 = x + w + 1, oy2 = y + h + 1;
      for (const r of rooms) {
        if (r === ignoredRoom) continue;
        const rx1 = r.x, ry1 = r.y, rx2 = r.x + r.w, ry2 = r.y + r.h;
        if (ox1 < rx2 && ox2 > rx1 && oy1 < ry2 && oy2 > ry1) return true;
      }
      return false;
    };
    /**
     * @param {any} room
     */
    const findMainframeRectForRoom = (room) => {
      const w = Math.max(room.w, MAINFRAME_MIN_W);
      const h = Math.max(room.h, MAINFRAME_MIN_H);
      const desiredX = Math.max(1, Math.min(MAP_W - w - 1, room.cx - Math.floor(w / 2)));
      const desiredY = Math.max(1, Math.min(MAP_H - h - 1, room.cy - Math.floor(h / 2)));
      const xMin = Math.max(1, room.cx - w + 1);
      const xMax = Math.min(room.cx, MAP_W - w - 1);
      const yMin = Math.max(1, room.cy - h + 1);
      const yMax = Math.min(room.cy, MAP_H - h - 1);
      let best = null;
      let bestScore = Infinity;
      for (let x = xMin; x <= xMax; x++) {
        for (let y = yMin; y <= yMax; y++) {
          if (overlapsOtherRoom(x, y, w, h, room)) continue;
          const score = Math.abs(x - desiredX) + Math.abs(y - desiredY);
          if (score < bestScore) { bestScore = score; best = { x, y, w, h }; }
        }
      }
      return best;
    };
    const mainframeCandidates = [...rooms]
      .filter((/** @type {any} */ r) => r !== spawnRoom)
      .sort((/** @type {any} */ a, /** @type {any} */ b) => (dist.get(b) || 0) - (dist.get(a) || 0));
    let rect = null;
    for (const r of mainframeCandidates) {
      rect = findMainframeRectForRoom(r);
      if (rect) { mainframeRoom = r; break; }
    }
    if (!rect) {
      /** @type {{x:number,y:number,w:number,h:number}|null} */
      let best = null;
      let bestScore = Infinity;
      for (let x = 1; x <= MAP_W - MAINFRAME_MIN_W - 1; x++) {
        for (let y = 1; y <= MAP_H - MAINFRAME_MIN_H - 1; y++) {
          if (overlapsOtherRoom(x, y, MAINFRAME_MIN_W, MAINFRAME_MIN_H, null)) continue;
          const cx = Math.floor(x + MAINFRAME_MIN_W / 2);
          const cy = Math.floor(y + MAINFRAME_MIN_H / 2);
          const score = Math.abs(cx - originalFarthest.cx) + Math.abs(cy - originalFarthest.cy);
          if (score < bestScore) { bestScore = score; best = { x, y, w: MAINFRAME_MIN_W, h: MAINFRAME_MIN_H }; }
        }
      }
      if (!best) {
        for (let x = 1; x <= MAP_W - MAINFRAME_MIN_W - 1; x++) {
          for (let y = 1; y <= MAP_H - MAINFRAME_MIN_H - 1; y++) {
            const sx1 = spawnRoom.x - 1, sy1 = spawnRoom.y - 1, sx2 = spawnRoom.x + spawnRoom.w + 1, sy2 = spawnRoom.y + spawnRoom.h + 1;
            if (x < sx2 && x + MAINFRAME_MIN_W > sx1 && y < sy2 && y + MAINFRAME_MIN_H > sy1) continue;
            const cx = Math.floor(x + MAINFRAME_MIN_W / 2);
            const cy = Math.floor(y + MAINFRAME_MIN_H / 2);
            let overlapPenalty = 0;
            for (const r of rooms) {
              if (r === spawnRoom) continue;
              const ox = Math.max(0, Math.min(x + MAINFRAME_MIN_W + 1, r.x + r.w) - Math.max(x - 1, r.x));
              const oy = Math.max(0, Math.min(y + MAINFRAME_MIN_H + 1, r.y + r.h) - Math.max(y - 1, r.y));
              overlapPenalty += ox * oy;
            }
            const score = overlapPenalty * 1000 + Math.abs(cx - originalFarthest.cx) + Math.abs(cy - originalFarthest.cy);
            if (score < bestScore) { bestScore = score; best = { x, y, w: MAINFRAME_MIN_W, h: MAINFRAME_MIN_H }; }
          }
        }
        if (best) {
          for (let i = rooms.length - 1; i >= 0; i--) {
            const r = rooms[i];
            if (r === spawnRoom) continue;
            const ox = Math.max(0, Math.min(best.x + best.w + 1, r.x + r.w) - Math.max(best.x - 1, r.x));
            const oy = Math.max(0, Math.min(best.y + best.h + 1, r.y + r.h) - Math.max(best.y - 1, r.y));
            if (ox * oy > 0) rooms.splice(i, 1);
          }
        }
      }
      rect = best || { x: 1, y: 1, w: MAINFRAME_MIN_W, h: MAINFRAME_MIN_H };
      mainframeRoom = { x: rect.x, y: rect.y, w: rect.w, h: rect.h, cx: Math.floor(rect.x + rect.w / 2), cy: Math.floor(rect.y + rect.h / 2), roomType: 'mainframe' };
      rooms.push(mainframeRoom);
      carveCorridor(map, originalFarthest.cx, originalFarthest.cy, mainframeRoom.cx, mainframeRoom.cy);
    }
    farthest = mainframeRoom;
    mainframeRoom.roomType = 'mainframe';
    mainframeRoom.x = rect.x; mainframeRoom.y = rect.y; mainframeRoom.w = rect.w; mainframeRoom.h = rect.h;
    mainframeRoom.cx = Math.floor(rect.x + rect.w / 2); mainframeRoom.cy = Math.floor(rect.y + rect.h / 2);
    carveRect(map, rect.x, rect.y, rect.w, rect.h, T.FLOOR);
    const cy = mainframeRoom.cy;
    const reader = { x: mainframeRoom.x + 3, y: cy };
    const portal = { x: mainframeRoom.cx, y: cy };
    const consoleTile = { x: mainframeRoom.x + mainframeRoom.w - 4, y: cy };
    const core = { x: mainframeRoom.cx, y: Math.min(mainframeRoom.y + mainframeRoom.h - 3, cy + 3) };
    map[reader.y][reader.x] = T.MAINFRAME_READER;
    map[portal.y][portal.x] = T.NETWORK_PORTAL;
    map[consoleTile.y][consoleTile.x] = T.MESSAGE_CONSOLE;
    map[core.y][core.x] = T.TERMINAL;
    mainframeRoom.interactables = { reader, portal, console: consoleTile, core };
    dist = bfsRooms(rooms, spawnRoom, map);
  } else {
    map[farthest.cy][farthest.cx] = T.STAIRS;
  }

  // boss room on biome-final floors (3,6,9,12,15 for the 5-biome arc)
  /** @type {any} */ let bossRoom = null;
  /** @type {any[]} */ let bossEntrances = [];
  if (_isBossFloor) {
    // use the room furthest from spawn that isn't the stair room
    let br = null, bd = 0;
    for (const [r,d] of dist) {
      if (r===farthest) continue;
      if (d>bd) { bd=d; br=r; }
    }
    bossRoom = br || rooms[Math.floor(rooms.length/2)];

    // Enforce minimum boss room size (15×15) by expanding if needed
    const MIN_BOSS = 15;
    if (bossRoom.w < MIN_BOSS || bossRoom.h < MIN_BOSS) {
      const nw = Math.max(bossRoom.w, MIN_BOSS);
      const nh = Math.max(bossRoom.h, MIN_BOSS);
      const desiredX = Math.max(1, Math.min(MAP_W - nw - 1, bossRoom.cx - Math.floor(nw/2)));
      const desiredY = Math.max(1, Math.min(MAP_H - nh - 1, bossRoom.cy - Math.floor(nh/2)));
      const xMin = Math.max(1, bossRoom.cx - nw + 1);
      const xMax = Math.min(bossRoom.cx, MAP_W - nw - 1);
      const yMin = Math.max(1, bossRoom.cy - nh + 1);
      const yMax = Math.min(bossRoom.cy, MAP_H - nh - 1);
      /** @type {{x:number,y:number}|null} */
      let bossRect = null;
      let bestScore = Infinity;
      for (let x = xMin; x <= xMax; x++) {
        for (let y = yMin; y <= yMax; y++) {
          const ox1 = x - 1, oy1 = y - 1, ox2 = x + nw + 1, oy2 = y + nh + 1;
          let blocked = false;
          for (const r of rooms) {
            if (r === bossRoom) continue;
            const rx1 = r.x, ry1 = r.y, rx2 = r.x + r.w, ry2 = r.y + r.h;
            if (ox1 < rx2 && ox2 > rx1 && oy1 < ry2 && oy2 > ry1) { blocked = true; break; }
          }
          if (blocked) continue;
          const score = Math.abs(x - desiredX) + Math.abs(y - desiredY);
          if (score < bestScore) { bestScore = score; bossRect = { x, y }; }
        }
      }
      if (bossRect) {
        const nx = bossRect.x;
        const ny = bossRect.y;
        bossRoom.x = nx; bossRoom.y = ny; bossRoom.w = nw; bossRoom.h = nh;
        bossRoom.cx = Math.floor(nx + nw/2); bossRoom.cy = Math.floor(ny + nh/2);
        carveRect(map, nx, ny, nw, nh, T.FLOOR);
        // re-carve corridors to this room from neighbours, never through the mainframe.
        for (const r of rooms) {
          if (r === bossRoom || r.roomType === 'mainframe') continue;
          const dx = Math.abs(r.cx - bossRoom.cx), dy = Math.abs(r.cy - bossRoom.cy);
          if (dx < 20 && dy < 20) carveCorridor(map, r.cx, r.cy, bossRoom.cx, bossRoom.cy);
        }
      }
      // Re-place stairs/terminal in case expansion overwrote it.
      if (floorNum >= _finalFloor && farthest.interactables && farthest.interactables.core) {
        const core = farthest.interactables.core;
        map[core.y][core.x] = T.TERMINAL;
      } else {
        map[farthest.cy][farthest.cx] = T.STAIRS;
      }
    }

    // Record entrance tiles: floor tiles on the boss room boundary that
    // connect to a CORRIDOR tile (not the interior of another adjacent
    // room). Without the corridor check, when the boss room shares a
    // boundary with another room (no carved-corridor gap between them),
    // every shared boundary tile would be sealed to WALL on boss-spawn —
    // putting walls INSIDE the neighbouring room and trapping the player
    // against them (reported by user 2026-04-20 b95c0573: 'the fence that
    // surrounds a boss should not leave a room's boundary. It went into
    // another room and trapped me against a wall').
    //
    // Both the boundary tile AND its outside neighbour must NOT be inside
    // another room — boundary check catches overlapping-rect gen edge
    // cases (where the boundary tile itself is shared); outside check
    // catches abutting-rooms (most common case).
    const rx=bossRoom.x, ry=bossRoom.y, rw=bossRoom.w, rh=bossRoom.h;
    /** @param {number} px @param {number} py */
    const isInsideAnotherRoom = (px, py) => {
      for (const r of rooms) {
        if (r === bossRoom) continue;
        if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return true;
      }
      return false;
    };
    /** Filtered + safe scan — both edge tile and outside tile must be
     *  outside any other room. */
    const _scanFiltered = () => {
      /** @type {Array<{x:number,y:number}>} */
      const out = [];
      for (let tx=rx; tx<rx+rw; tx++) {
        if (ry>0 && map[ry][tx]===T.FLOOR && map[ry-1][tx]===T.FLOOR
            && !isInsideAnotherRoom(tx, ry) && !isInsideAnotherRoom(tx, ry-1))
          out.push({x:tx, y:ry});
        const by=ry+rh-1;
        if (by<MAP_H-1 && map[by][tx]===T.FLOOR && map[by+1][tx]===T.FLOOR
            && !isInsideAnotherRoom(tx, by) && !isInsideAnotherRoom(tx, by+1))
          out.push({x:tx, y:by});
      }
      for (let ty=ry; ty<ry+rh; ty++) {
        if (rx>0 && map[ty][rx]===T.FLOOR && map[ty][rx-1]===T.FLOOR
            && !isInsideAnotherRoom(rx, ty) && !isInsideAnotherRoom(rx-1, ty))
          out.push({x:rx, y:ty});
        const bx=rx+rw-1;
        if (bx<MAP_W-1 && map[ty][bx]===T.FLOOR && map[ty][bx+1]===T.FLOOR
            && !isInsideAnotherRoom(bx, ty) && !isInsideAnotherRoom(bx+1, ty))
          out.push({x:bx, y:ty});
      }
      return out;
    };
    /** Unfiltered fallback — original logic, keeps lock-arena mechanic
     *  working even in the degenerate case where the boss room only
     *  shares boundaries with other rooms (no corridor entrance). The
     *  re-carve loop at L2198-2202 makes this near-impossible in
     *  practice but the fallback is here for safety: the lesser evil
     *  is the original cosmetic bug (wall poking into neighbour) vs
     *  losing boss arena lockout entirely. */
    const _scanUnfiltered = () => {
      /** @type {Array<{x:number,y:number}>} */
      const out = [];
      for (let tx=rx; tx<rx+rw; tx++) {
        if (ry>0 && map[ry][tx]===T.FLOOR && map[ry-1][tx]===T.FLOOR) out.push({x:tx, y:ry});
        const by=ry+rh-1;
        if (by<MAP_H-1 && map[by][tx]===T.FLOOR && map[by+1][tx]===T.FLOOR) out.push({x:tx, y:by});
      }
      for (let ty=ry; ty<ry+rh; ty++) {
        if (rx>0 && map[ty][rx]===T.FLOOR && map[ty][rx-1]===T.FLOOR) out.push({x:rx, y:ty});
        const bx=rx+rw-1;
        if (bx<MAP_W-1 && map[ty][bx]===T.FLOOR && map[ty][bx+1]===T.FLOOR) out.push({x:bx, y:ty});
      }
      return out;
    };
    const filtered = _scanFiltered();
    const chosen = filtered.length > 0 ? filtered : _scanUnfiltered();
    for (const e of chosen) bossEntrances.push(e);
    // Deduplicate — corners scanned by both edge loops cause permanent seal bug
    const seen = new Set();
    bossEntrances = bossEntrances.filter(e => {
      const k = e.x + ',' + e.y;
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  }

  if (mainframeRoom && mainframeRoom.interactables) {
    const { reader, portal, console: consoleTile, core } = mainframeRoom.interactables;
    carveRect(map, mainframeRoom.x, mainframeRoom.y, mainframeRoom.w, mainframeRoom.h, T.FLOOR);
    map[reader.y][reader.x] = T.MAINFRAME_READER;
    map[portal.y][portal.x] = T.NETWORK_PORTAL;
    map[consoleTile.y][consoleTile.x] = T.MESSAGE_CONSOLE;
    map[core.y][core.x] = T.TERMINAL;
  }

  // lights
  const lights = [];
  for (const r of rooms) {
    lights.push({x:r.x+1,y:r.y+1});
    lights.push({x:r.x+r.w-2,y:r.y+r.h-2});
  }

  // fog of war
  /** @type {any} */ const visited = Array.from({length:MAP_H},()=>new Uint8Array(MAP_W));
  /** @type {any} */ const light   = Array.from({length:MAP_H},()=>new Float32Array(MAP_W));
  /** @type {any} */ const visible = Array.from({length:MAP_H},()=>new Uint8Array(MAP_W));

  // ── Room types: assign special purposes ──────────────────────────────────
  // Types: null (normal), 'armory', 'medbay', 'shrine', 'vault'
  const ROOM_TYPES = ['armory','medbay','shrine','vault'];
  /** @type {Record<string, any>} */ const ROOM_COLOURS = {armory:'#2a1a10',medbay:'#0a1a15',shrine:'#1a0a20',vault:'#1a1a05',vendor:'#0a1a0f',secret:'#1a1005',challenge:'#1a0a0a',implant:'#0f0a1a',event:'#0a1a1a',mainframe:'#081828'};
  /** @type {any[]} */ const specialRooms = [];
  const eligible = rooms.filter((/** @type {any} */ r) => r!==spawnRoom && r!==farthest && r!==bossRoom && r.w*r.h>=20);

  // ── Vendor room (floor 2+, one per non-boss floor) — reserved first ─────
  /** @type {any} */ let vendorRoom = null;
  if (floorNum >= 2 && !bossRoom) {
    const vendorEligible = eligible.filter((/** @type {any} */ r) => r.w >= 5 && r.h >= 5);
    if (vendorEligible.length > 0) {
      vendorRoom = vendorEligible[rndInt(0, vendorEligible.length - 1)];
      vendorRoom.roomType = 'vendor';
      specialRooms.push(vendorRoom);
      map[vendorRoom.cy][vendorRoom.cx] = T.VENDOR;
    }
  }

  // ── Special room rotation (excluding vendor room) ───────────────────────
  const specialEligible = eligible.filter((/** @type {any} */ r) => r !== vendorRoom);
  const numSpecial = Math.min(specialEligible.length, Math.floor(floorNum/2)+1);
  const picked = shuffleInPlace(specialEligible.slice(), 'world').slice(0,numSpecial);
  for (let i=0; i<picked.length; i++) {
    const r = picked[i];
    r.roomType = ROOM_TYPES[i % ROOM_TYPES.length];
    specialRooms.push(r);
  }

  // ── Doors: place at room-corridor junctions (chokepoints only) ──────────
  // Helper: find entrance clusters for a room (groups of adjacent boundary
  // tiles on the room wall line). Returns array of arrays.
  /**
   * @param {any} room
   * @returns {{x:number,y:number}[][]}
   */
  function getEntranceClusters(room) {
    const isOpenEntranceTile = (/** @type {any} */ t) => t === T.FLOOR || t === T.DOOR;
    return dungeonTopology.findBoundaryEntranceClusters(map, room, isOpenEntranceTile);
  }

  /**
   * @param {any[]} cluster
   * @returns {any}
   */
  function keepSingleEntranceTile(cluster) {
    const sorted = cluster.slice().sort((/** @type {any} */ a, /** @type {any} */ b) => (a.y - b.y) || (a.x - b.x));
    const keep = sorted[Math.floor(sorted.length / 2)];
    for (const e of sorted) {
      if (e !== keep) map[e.y][e.x] = T.WALL;
    }
    return keep;
  }

  /** @param {any} tile */
  function isDoorLikeEntranceTile(tile) {
    return tile === T.DOOR || tile === T.LOCKED_R || tile === T.LOCKED_B ||
      tile === T.LOCKED_G || tile === T.CHALLENGE_GATE || tile === T.CRACKED;
  }

  /** @param {number} x @param {number} y */
  function tileInsideAnyRoom(x, y) {
    return rooms.some((/** @type {any} */ r) => dungeonTopology.roomContainsPoint(r, x, y));
  }

  /** @param {number} x @param {number} y */
  function tileOnRoomCorner(x, y) {
    return rooms.some((/** @type {any} */ r) => dungeonTopology.roomHasCorner(r, x, y));
  }

  /**
   * @param {any} room
   * @param {number} x
   * @param {number} y
   */
  function outsideFaceForBoundaryTile(room, x, y) {
    return dungeonTopology.outsideFaceForBoundaryTile(room, x, y);
  }

  /**
   * @param {any} room
   * @param {number} x
   * @param {number} y
   * @param {number} dx
   * @param {number} dy
   */
  function repairFormerEntranceSidePadding(room, x, y, dx, dy) {
    const px = dy === 0 ? 0 : 1;
    const py = dx === 0 ? 0 : 1;
    for (const sign of [-1, 1]) {
      const sx = x + px * sign;
      const sy = y + py * sign;
      if (sx < room.x || sx >= room.x + room.w || sy < room.y || sy >= room.y + room.h) continue;
      if ((sx === room.x || sx === room.x + room.w - 1) && (sy === room.y || sy === room.y + room.h - 1)) continue;
      if (map[sy]?.[sx] === T.WALL || map[sy]?.[sx] === T.VOID) map[sy][sx] = T.FLOOR;
    }
  }

  function normalizeEntranceTilesOutsideRooms() {
    /** @type {{fromX:number,fromY:number,toX:number,toY:number,tile:any}[]} */
    const moved = [];
    for (const room of rooms) {
      for (let tx = room.x + 1; tx < room.x + room.w - 1; tx++) {
        normalizeBoundaryEntrance(room, tx, room.y, moved);
        normalizeBoundaryEntrance(room, tx, room.y + room.h - 1, moved);
      }
      for (let ty = room.y + 1; ty < room.y + room.h - 1; ty++) {
        normalizeBoundaryEntrance(room, room.x, ty, moved);
        normalizeBoundaryEntrance(room, room.x + room.w - 1, ty, moved);
      }
    }
    return moved;
  }

  function repairOutsideEntranceRoomEdges() {
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        if (!isDoorLikeEntranceTile(map[y][x]) || tileInsideAnyRoom(x, y)) continue;
        for (const room of rooms) {
          const neighbors = /** @type {{bx:number,by:number,dx:number,dy:number}[]} */ ([
            { bx: x, by: y - 1, dx: 0, dy: 1 },
            { bx: x, by: y + 1, dx: 0, dy: -1 },
            { bx: x - 1, by: y, dx: 1, dy: 0 },
            { bx: x + 1, by: y, dx: -1, dy: 0 },
          ]);
          for (const n of neighbors) {
            const outside = outsideFaceForBoundaryTile(room, n.bx, n.by);
            if (!outside || outside.x !== x || outside.y !== y) continue;
            repairFormerEntranceSidePadding(room, n.bx, n.by, n.dx, n.dy);
          }
        }
      }
    }
  }

  /** @param {number} x @param {number} y */
  function outsidePassageDegree(x, y) {
    let degree = 0;
    for (const [dx, dy] of DUNGEON_CARDINAL_DIRECTIONS) {
      const nx = x + dx;
      const ny = y + dy;
      if (tileInsideAnyRoom(nx, ny)) continue;
      const t = map[ny]?.[nx];
      if (t !== T.WALL && t !== T.VOID) degree++;
    }
    return degree;
  }

  /** @param {any} tile */
  function isOpenDoorBypassTile(tile) {
    return tile !== undefined && tile !== null && tile !== T.WALL && tile !== T.VOID && !isDoorLikeEntranceTile(tile);
  }

  function sealDoorBypassCorners() {
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        if (!isDoorLikeEntranceTile(map[y][x])) continue;
        for (const [dx, dy] of DUNGEON_DIAGONAL_DIRECTIONS) {
          if (
            isOpenDoorBypassTile(map[y]?.[x + dx]) &&
            isOpenDoorBypassTile(map[y + dy]?.[x]) &&
            isOpenDoorBypassTile(map[y + dy]?.[x + dx])
          ) {
            map[y + dy][x + dx] = T.WALL;
          }
        }
      }
    }
  }

  function repairDoorBypassSealedEntranceStubs() {
    /** @param {number} x @param {number} y */
    const canCarveStubExtensionTile = (x, y) => {
      if (x <= 0 || y <= 0 || x >= MAP_W - 1 || y >= MAP_H - 1 || tileOnRoomCorner(x, y)) return false;
      const tile = map[y]?.[x];
      return tile === T.WALL || tile === T.VOID;
    };
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        if (!isDoorLikeEntranceTile(map[y][x]) || tileInsideAnyRoom(x, y)) continue;
        const roomSides = outsideEntranceRoomSides(x, y);
        const side = roomSides[0];
        if (roomSides.length !== 1 || !side) continue;
        const px = x - side.dx;
        const py = y - side.dy;
        if (!isOutsidePassageTile(px, py) || outsidePassageConnectionCount(px, py, x, y) > 0) continue;
        const nx = px - side.dx;
        const ny = py - side.dy;
        if (canCarveOutsidePassageTile(nx, ny) || canCarveStubExtensionTile(nx, ny)) map[ny][nx] = T.FLOOR;
      }
    }
  }

  /** @param {number} x @param {number} y */
  function adjacentDoorLikeEntranceCount(x, y) {
    let count = 0;
    for (const [dx, dy] of DUNGEON_CARDINAL_DIRECTIONS) {
      if (isDoorLikeEntranceTile(map[y + dy]?.[x + dx])) count++;
    }
    return count;
  }

  /** @param {any} tile */
  function isReplaceableDoorEntranceTile(tile) {
    return tile === T.DOOR || tile === T.LOCKED_R || tile === T.LOCKED_B || tile === T.LOCKED_G;
  }

  /** @param {number} x @param {number} y */
  function outsideEntranceRoomSides(x, y) {
    /** @type {{dx:number,dy:number,bx:number,by:number}[]} */
    const roomSides = [];
    for (const [dx, dy] of DUNGEON_CARDINAL_DIRECTIONS) {
      const bx = x + dx;
      const by = y + dy;
      if (tileOnRoomCorner(bx, by)) continue;
      if (rooms.some((/** @type {any} */ r) => {
        const outside = outsideFaceForBoundaryTile(r, bx, by);
        return outside?.x === x && outside?.y === y;
      })) roomSides.push({ dx, dy, bx, by });
    }
    return roomSides;
  }

  /** @param {number} x @param {number} y */
  function isOutsidePassageTile(x, y) {
    if (x <= 0 || y <= 0 || x >= MAP_W - 1 || y >= MAP_H - 1) return false;
    const t = map[y]?.[x];
    return !tileInsideAnyRoom(x, y) && t !== undefined && t !== null && t !== T.WALL && t !== T.VOID;
  }

  /** @param {number} x @param {number} y */
  function canCarveOutsidePassageTile(x, y) {
    if (x <= 0 || y <= 0 || x >= MAP_W - 1 || y >= MAP_H - 1 || tileInsideAnyRoom(x, y)) return false;
    return map[y]?.[x] === T.WALL || map[y]?.[x] === T.VOID;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} exceptX
   * @param {number} exceptY
   */
  function outsidePassageConnectionCount(x, y, exceptX, exceptY) {
    let degree = 0;
    for (const [dx, dy] of DUNGEON_CARDINAL_DIRECTIONS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx === exceptX && ny === exceptY) continue;
      if (isOutsidePassageTile(nx, ny)) degree++;
    }
    return degree;
  }

  /** @param {number} x @param {number} y @param {{dx:number,dy:number}} side */
  function hasConnectedPassageOppositeRoomSide(x, y, side) {
    const px = x - side.dx;
    const py = y - side.dy;
    return isOutsidePassageTile(px, py) && outsidePassageConnectionCount(px, py, x, y) > 0;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {{dx:number,dy:number}} side
   */
  function findAlignedOutsidePassageRepair(x, y, side) {
    const px = x - side.dx;
    const py = y - side.dy;
    if (outsidePassageConnectionCount(px, py, x, y) > 0) return { px, py, cx: -1, cy: -1 };
    if (!isOutsidePassageTile(px, py) && !canCarveOutsidePassageTile(px, py)) return null;
    for (const [dx, dy] of DUNGEON_CARDINAL_DIRECTIONS) {
      if (dx * side.dx + dy * side.dy !== 0) continue;
      if (!isOutsidePassageTile(x + dx, y + dy)) continue;
      const cx = px + dx;
      const cy = py + dy;
      if (isOutsidePassageTile(cx, cy) || canCarveOutsidePassageTile(cx, cy)) return { px, py, cx, cy };
    }
    return null;
  }

  /** @param {number} x @param {number} y @param {{dx:number,dy:number}} side */
  function repairAlignedOutsideEntrancePassage(x, y, side) {
    const repair = findAlignedOutsidePassageRepair(x, y, side);
    if (!repair) return false;
    if (map[repair.py]?.[repair.px] === T.WALL || map[repair.py]?.[repair.px] === T.VOID) map[repair.py][repair.px] = T.FLOOR;
    if (repair.cx >= 0 && repair.cy >= 0 && (map[repair.cy]?.[repair.cx] === T.WALL || map[repair.cy]?.[repair.cx] === T.VOID)) {
      map[repair.cy][repair.cx] = T.FLOOR;
    }
    return outsidePassageConnectionCount(repair.px, repair.py, x, y) > 0;
  }

  /** @param {number} x @param {number} y */
  function hasAlignedOutsideEntrancePassage(x, y) {
    const roomSides = outsideEntranceRoomSides(x, y);
    if (roomSides.length === 2) {
      const a = roomSides[0];
      const b = roomSides[1];
      if (!a || !b) return false;
      return a.dx + b.dx === 0 && a.dy + b.dy === 0;
    }
    if (roomSides.length !== 1) return false;
    const side = roomSides[0];
    return !!side && hasConnectedPassageOppositeRoomSide(x, y, side);
  }

  function repairMisalignedOutsideEntrancePassages() {
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        if (!isDoorLikeEntranceTile(map[y][x]) || tileInsideAnyRoom(x, y)) continue;
        const roomSides = outsideEntranceRoomSides(x, y);
        const side = roomSides[0];
        if (roomSides.length !== 1 || !side || hasConnectedPassageOppositeRoomSide(x, y, side)) continue;
        repairAlignedOutsideEntrancePassage(x, y, side);
      }
    }
  }

  function collapseAdjacentOutsideEntranceTilesToFloor() {
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        if (!isDoorLikeEntranceTile(map[y][x]) || tileInsideAnyRoom(x, y)) continue;
        const adjacentBlocker = DUNGEON_CARDINAL_DIRECTIONS
          .some(([dx, dy]) => {
            const t = map[y + dy]?.[x + dx];
            return isDoorLikeEntranceTile(t) && t !== T.DOOR;
          });
        if (adjacentBlocker) map[y][x] = T.FLOOR;
      }
    }
    /** @type {Set<string>} */
    const visitedDoorTiles = new Set();
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        if (!isDoorLikeEntranceTile(map[y][x]) || tileInsideAnyRoom(x, y)) continue;
        const key = x + ',' + y;
        if (visitedDoorTiles.has(key)) continue;
        const cluster = [{ x, y }];
        visitedDoorTiles.add(key);
        for (let qi = 0; qi < cluster.length; qi++) {
          const c = /** @type {any} */ (cluster[qi]);
          for (const [dx, dy] of DUNGEON_CARDINAL_DIRECTIONS) {
            const nx = c.x + dx, ny = c.y + dy;
            const nk = nx + ',' + ny;
            if (visitedDoorTiles.has(nk) || !isDoorLikeEntranceTile(map[ny]?.[nx]) || tileInsideAnyRoom(nx, ny)) continue;
            visitedDoorTiles.add(nk);
            cluster.push({ x: nx, y: ny });
          }
        }
        if (cluster.length <= 1) continue;
        const sorted = cluster.slice().sort((/** @type {any} */ a, /** @type {any} */ b) => (a.y - b.y) || (a.x - b.x));
        const keep = sorted.find((/** @type {any} */ e) => map[e.y]?.[e.x] !== T.DOOR) || sorted[Math.floor(sorted.length / 2)];
        for (const e of cluster) {
          if (e === keep) continue;
          map[e.y][e.x] = T.FLOOR;
        }
      }
    }
  }

  function clearDeadOutsideEntranceTiles() {
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        if (!isDoorLikeEntranceTile(map[y][x]) || tileInsideAnyRoom(x, y)) continue;
        const roomSides = outsideEntranceRoomSides(x, y);
        let sealedRoomSide = false;
        for (const side of roomSides) {
          const roomTile = map[side.by]?.[side.bx];
          if (roomTile === T.WALL || roomTile === T.VOID || isDoorLikeEntranceTile(roomTile)) {
            sealedRoomSide = true;
            break;
          }
        }
        if (sealedRoomSide) { map[y][x] = T.FLOOR; continue; }
        const side = roomSides[0];
        if (roomSides.length === 1 && side && !hasConnectedPassageOppositeRoomSide(x, y, side)) map[y][x] = T.FLOOR;
      }
    }
  }

  /** @param {any} room @param {any} tile */
  function roomHasRingTile(room, tile) {
    return !!findRingTile(room, tile);
  }

  /** @param {any} room @param {any} tile */
  function findRingTile(room, tile) {
    for (let y = Math.max(0, room.y - 1); y <= Math.min(MAP_H - 1, room.y + room.h); y++) {
      for (let x = Math.max(0, room.x - 1); x <= Math.min(MAP_W - 1, room.x + room.w); x++) {
        if (map[y]?.[x] === tile) return { x, y };
      }
    }
    return null;
  }

  /** @param {any} room @param {any} tile */
  function placeOutsideEntranceForRoom(room, tile) {
    /** @type {{bx:number,by:number,ox:number,oy:number,dx:number,dy:number,score:number}[]} */
    const candidates = [];
    /**
     * @param {number} bx
     * @param {number} by
     */
    const addCandidate = (bx, by) => {
      const outside = outsideFaceForBoundaryTile(room, bx, by);
      if (!outside || outside.x <= 0 || outside.y <= 0 || outside.x >= MAP_W - 1 || outside.y >= MAP_H - 1) return;
      if (tileInsideAnyRoom(outside.x, outside.y)) return;
      const outsideTile = map[outside.y]?.[outside.x];
      const replacingDoor = isReplaceableDoorEntranceTile(outsideTile);
      if (isDoorLikeEntranceTile(outsideTile) && !replacingDoor) return;
      if (adjacentDoorLikeEntranceCount(outside.x, outside.y) > 0) return;
      const roomSides = outsideEntranceRoomSides(outside.x, outside.y);
      const roomSideCount = roomSides.length;
      const passageDegree = outsidePassageDegree(outside.x, outside.y);
      let alignmentScore = 0;
      if (roomSideCount < 2) {
        const side = roomSides[0];
        const hasAlignedPassage = !!side && hasConnectedPassageOppositeRoomSide(outside.x, outside.y, side);
        const canRepairAlignedPassage = !!side && !!findAlignedOutsidePassageRepair(outside.x, outside.y, side);
        if (!hasAlignedPassage && !canRepairAlignedPassage) return;
        alignmentScore = hasAlignedPassage ? 20 : 5;
      }
      const score = alignmentScore + (outsideTile !== T.WALL && outsideTile !== T.VOID ? 10 : 0) + passageDegree + roomSideCount;
      candidates.push({ bx, by, ox: outside.x, oy: outside.y, dx: outside.dx, dy: outside.dy, score });
    };
    for (let tx = room.x + 1; tx < room.x + room.w - 1; tx++) {
      addCandidate(tx, room.y);
      addCandidate(tx, room.y + room.h - 1);
    }
    for (let ty = room.y + 1; ty < room.y + room.h - 1; ty++) {
      addCandidate(room.x, ty);
      addCandidate(room.x + room.w - 1, ty);
    }
    candidates.sort((a, b) => b.score - a.score);
    const picked = candidates[0];
    if (!picked) return null;
    map[picked.by][picked.bx] = T.FLOOR;
    map[picked.oy][picked.ox] = tile;
    const roomSides = outsideEntranceRoomSides(picked.ox, picked.oy);
    const side = roomSides[0];
    if (roomSides.length === 1 && side) repairAlignedOutsideEntrancePassage(picked.ox, picked.oy, side);
    repairFormerEntranceSidePadding(room, picked.bx, picked.by, picked.dx, picked.dy);
    return { x: picked.ox, y: picked.oy };
  }

  function ensureSpecialRoomEntrances() {
    if (challengeRoom) {
      for (let i = challengeEntrances.length - 1; i >= 0; i--) {
        const entry = challengeEntrances[i];
        if (!entry || map[entry.y]?.[entry.x] === T.CHALLENGE_GATE) continue;
        challengeEntrances.splice(i, 1);
      }
      if (challengeEntrances.length === 0) {
        const gate = findRingTile(challengeRoom, T.CHALLENGE_GATE) || placeOutsideEntranceForRoom(challengeRoom, T.CHALLENGE_GATE);
        if (gate) challengeEntrances.push(gate);
      }
    }
    for (const secret of secretRooms) {
      if (roomHasRingTile(secret, T.CRACKED)) continue;
      placeOutsideEntranceForRoom(secret, T.CRACKED);
    }
  }

  function removeKeysWithoutLiveLocks() {
    const hasLock = {
      red: false,
      blue: false,
      gold: false,
    };
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const tile = map[y][x];
        if (tile === T.LOCKED_R) hasLock.red = true;
        else if (tile === T.LOCKED_B) hasLock.blue = true;
        else if (tile === T.LOCKED_G) hasLock.gold = true;
      }
    }
    for (let i = keyItems.length - 1; i >= 0; i--) {
      const key = keyItems[i];
      if (!key || hasLock[/** @type {'red'|'blue'|'gold'} */ (key.colour)]) continue;
      keyItems.splice(i, 1);
    }
  }

  const passable = (/** @type {any} */ t) =>
    t === T.FLOOR || t === T.DOOR || t === T.DOOR_OPEN ||
      t === T.STAIRS || t === T.TERMINAL ||
      t === T.TRAP_SPIKE || t === T.TRAP_SLOW || t === T.TOXIC ||
      t === T.PLASMA || t === T.ARC || t === T.SHOCK_TILE || t === T.REPULSOR ||
      t === T.CRACKED ||
      t === T.VENDOR || t === T.LORE || t === T.TELEPORT_PAD ||
      t === T.MAINFRAME_READER || t === T.NETWORK_PORTAL || t === T.MESSAGE_CONSOLE ||
      t === T.IMPLANT_SHRINE || t === T.EVENT_TERMINAL ||
      t === T.CHALLENGE_GATE;

  /** @param {any} t */
  function lockColourForTile(t) {
    return t === T.LOCKED_R ? 'red' : t === T.LOCKED_B ? 'blue' : t === T.LOCKED_G ? 'gold' : null;
  }

  /** @param {any} t */
  function keyPlacementOpenTile(t) {
    // Key-placement reach keeps cracked walls blocked; crates remain open as in the legacy BFS.
    return Number.isFinite(t) && t !== T.WALL && t !== T.VOID && t !== T.CRACKED && !lockColourForTile(t);
  }

  /**
   * @param {any[]} requiredRooms
   */
  function solveProgressionReachability(requiredRooms) {
    return dungeonReachability.solveKeyLockReachability({
      map,
      start: { x: spawnRoom.cx, y: spawnRoom.cy },
      keys: keyItems,
      requiredRooms,
      isOpenTile: passable,
      lockColourForTile,
    });
  }

  /** @param {Set<string>} haveColours */
  function computeKeyPlacementReach(haveColours) {
    const solved = dungeonReachability.solveKeyLockReachability({
      map,
      start: { x: spawnRoom.cx, y: spawnRoom.cy },
      keys: keyItems,
      isOpenTile: keyPlacementOpenTile,
      lockColourForTile,
    });
    return solved.computeReach(haveColours);
  }

  function repairPostRelocationLockReachability() {
    const lockTileForColour = { red: T.LOCKED_R, blue: T.LOCKED_B, gold: T.LOCKED_G };
    const solvedReach = solveProgressionReachability(rooms);
    if (solvedReach.unreachableRooms.length === 0) return;
    for (const colour of solvedReach.missingColours) {
      const lockTile = lockTileForColour[/** @type {'red'|'blue'|'gold'} */ (colour)];
      for (let y = 0; y < MAP_H; y++) {
        for (let x = 0; x < MAP_W; x++) {
          if (map[y][x] === lockTile) map[y][x] = T.DOOR;
        }
      }
    }
  }

  function repairReachabilityAfterDoorCornerSealing() {
    /** @param {any} room */
    const outsideEntranceGatesForRoom = (room) => {
      /** @type {{x:number,y:number,ox:number,oy:number}[]} */
      const gates = [];
      for (let y = 1; y < MAP_H - 1; y++) {
        for (let x = 1; x < MAP_W - 1; x++) {
          if (!isDoorLikeEntranceTile(map[y][x]) || tileInsideAnyRoom(x, y)) continue;
          for (const [dx, dy] of DUNGEON_CARDINAL_DIRECTIONS) {
            const bx = x + dx;
            const by = y + dy;
            const outside = outsideFaceForBoundaryTile(room, bx, by);
            if (outside?.x === x && outside?.y === y) gates.push({ x, y, ox: x - dx, oy: y - dy });
          }
        }
      }
      return gates;
    };
    for (let repair = 0; repair < rooms.length; repair++) {
      const solvedReach = solveProgressionReachability(rooms);
      const blocked = solvedReach.unreachableRooms[0];
      if (!blocked) break;
      const gates = outsideEntranceGatesForRoom(blocked);
      const gate = gates.find((/** @type {any} */ g) =>
        g.ox >= 0 && g.oy >= 0 && g.ox < MAP_W && g.oy < MAP_H && !solvedReach.reachable[g.oy]?.[g.ox]
      ) || gates[0];
      if (gate) {
        const outsideInBounds = gate.ox >= 0 && gate.oy >= 0 && gate.ox < MAP_W && gate.oy < MAP_H;
        carveProtectedRescueCorridorTo(outsideInBounds ? gate.ox : gate.x, outsideInBounds ? gate.oy : gate.y);
      } else {
        carveProtectedRescueCorridorTo(blocked.cx, blocked.cy);
      }
    }
  }

  /**
   * @param {any} room
   * @param {number} x
   * @param {number} y
   * @param {{fromX:number,fromY:number,toX:number,toY:number,tile:any}[]} moved
   */
  function normalizeBoundaryEntrance(room, x, y, moved) {
    const tile = map[y]?.[x];
    if (!isDoorLikeEntranceTile(tile)) return;
    const outside = outsideFaceForBoundaryTile(room, x, y);
    if (!outside || outside.x <= 0 || outside.y <= 0 || outside.x >= MAP_W - 1 || outside.y >= MAP_H - 1 || tileInsideAnyRoom(outside.x, outside.y)) {
      map[y][x] = T.FLOOR;
      repairFormerEntranceSidePadding(room, x, y, 0, 0);
      return;
    }
    map[y][x] = T.FLOOR;
    map[outside.y][outside.x] = tile;
    repairFormerEntranceSidePadding(room, x, y, outside.dx, outside.dy);
    moved.push({ fromX: x, fromY: y, toX: outside.x, toY: outside.y, tile });
  }

  /**
   * @param {number} tx
   * @param {number} ty
   */
  function carveProtectedRescueCorridorTo(tx, ty) {
    const sx = spawnRoom.cx;
    const sy = spawnRoom.cy;
    /** @type {{x:number,y:number}[]} */
    const q = [{ x: sx, y: sy }];
    /** @type {Int16Array[]} */
    const prev = Array.from({ length: MAP_H }, () => new Int16Array(MAP_W).fill(-1));
    const startRow = prev[sy];
    if (!startRow) return;
    startRow[sx] = sy * MAP_W + sx;
    for (let qi = 0; qi < q.length; qi++) {
      const current = q[qi];
      if (!current) continue;
      const { x, y } = current;
      if (x === tx && y === ty) break;
      const dirs = /** @type {const} */ ([[1, 0], [-1, 0], [0, 1], [0, -1]]);
      for (const dir of dirs) {
        const dx = dir[0];
        const dy = dir[1];
        const nx = x + dx;
        const ny = y + dy;
        const prevRow = prev[ny];
        if (nx <= 0 || ny <= 0 || nx >= MAP_W - 1 || ny >= MAP_H - 1 || !prevRow) continue;
        const seen = prevRow[nx];
        if (seen === undefined || seen >= 0) continue;
        prevRow[nx] = y * MAP_W + x;
        q.push({ x: nx, y: ny });
      }
    }
    const targetRow = prev[ty];
    const targetSeen = targetRow?.[tx];
    if (targetSeen === undefined || targetSeen < 0) {
      let cx = sx, cy = sy;
      while (cx !== tx) {
        if (map[cy][cx] === T.WALL || map[cy][cx] === T.VOID) map[cy][cx] = T.FLOOR;
        cx += cx < tx ? 1 : -1;
      }
      while (cy !== ty) {
        if (map[cy][cx] === T.WALL || map[cy][cx] === T.VOID) map[cy][cx] = T.FLOOR;
        cy += cy < ty ? 1 : -1;
      }
      if (map[cy][cx] === T.WALL || map[cy][cx] === T.VOID) map[cy][cx] = T.FLOOR;
      return;
    }
    let cx = tx;
    let cy = ty;
    while (!(cx === sx && cy === sy)) {
      if (map[cy][cx] === T.WALL || map[cy][cx] === T.VOID) map[cy][cx] = T.FLOOR;
      const pathRow = prev[cy];
      if (!pathRow) break;
      const p = pathRow[cx];
      if (p === undefined || p < 0) break;
      cy = Math.floor(p / MAP_W);
      cx = p % MAP_W;
    }
  }

  function clearOrphanEntranceTiles() {
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        // Before normalizeEntranceTilesOutsideRooms(), normal/locked doors still
        // occupy the room boundary. Only clear already-relocated outside tiles.
        if (tileInsideAnyRoom(x, y)) continue;
        if (isDoorLikeEntranceTile(map[y][x]) && (tileOnRoomCorner(x, y) || !hasAlignedOutsideEntrancePassage(x, y))) map[y][x] = T.FLOOR;
      }
    }
  }

  function collapseAdjacentEntranceTiles() {
    /** @type {Set<string>} */
    const visitedDoorTiles = new Set();
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        if (!isDoorLikeEntranceTile(map[y][x])) continue;
        const key = x + ',' + y;
        if (visitedDoorTiles.has(key)) continue;
        const cluster = [{ x, y }];
        visitedDoorTiles.add(key);
        for (let qi = 0; qi < cluster.length; qi++) {
          const c = /** @type {any} */ (cluster[qi]);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = c.x + dx, ny = c.y + dy;
            const nk = nx + ',' + ny;
            if (visitedDoorTiles.has(nk) || !isDoorLikeEntranceTile(map[ny]?.[nx])) continue;
            visitedDoorTiles.add(nk);
            cluster.push({ x: nx, y: ny });
          }
        }
        if (cluster.length > 1) keepSingleEntranceTile(cluster);
      }
    }
  }

  function thinWideCorridors() {
    /** @type {any} */
    const inRoom = Array.from({length: MAP_H}, () => new Uint8Array(MAP_W));
    for (const r of rooms) {
      for (let ty = r.y; ty < r.y + r.h; ty++) {
        for (let tx = r.x; tx < r.x + r.w; tx++) {
          if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H) inRoom[ty][tx] = 1;
        }
      }
    }
    /** @param {number} x @param {number} y */
    const isCorridor = (x, y) => {
      const t = map[y]?.[x];
      return !inRoom[y]?.[x] && t !== T.WALL && t !== T.VOID;
    };
    const allRoomsReachable = () => {
      const solvedReach = solveProgressionReachability(rooms);
      return solvedReach.unreachableRooms.length === 0;
    };
    let changed = true;
    while (changed) {
      changed = false;
      for (let y = 1; y < MAP_H - 2; y++) {
        for (let x = 1; x < MAP_W - 2; x++) {
          if (isCorridor(x, y) && isCorridor(x + 1, y) &&
              isCorridor(x, y + 1) && isCorridor(x + 1, y + 1)) {
            const candidates = [
              { x: x + 1, y: y + 1 },
              { x: x + 1, y },
              { x, y: y + 1 },
              { x, y },
            ];
            for (const c of candidates) {
              if (isDoorLikeEntranceTile(map[c.y][c.x])) continue;
              const snapshot = map.map((/** @type {any} */ row) => row.slice());
              map[c.y][c.x] = T.WALL;
              if (allRoomsReachable()) {
                changed = true;
                break;
              }
              for (let ry = 0; ry < MAP_H; ry++) map[ry] = snapshot[ry];
            }
          }
        }
      }
    }
  }

  for (const r of rooms) {
    if (r === bossRoom) continue;
    const clusters = getEntranceClusters(r);
    for (const cl of clusters) {
      if (cl.length > 1) keepSingleEntranceTile(cl);
    }
  }

  for (const r of rooms) {
    if (r === bossRoom) continue;
    const clusters = getEntranceClusters(r);
    // Single room-boundary entrance tiles become optional doors.
    for (const cl of clusters) {
      if (cl.length === 1 && rand('world') < 0.5) {
        for (const e of cl) map[e.y][e.x] = T.DOOR;
      }
    }
  }

  // ── Locked doors + keys (floor 2+) ──────────────────────────────────────
  // Lock meaningful targets: stair room first, then special rooms, then random.
  // All narrow entrance clusters of the target room are locked so the room
  // is truly gated (no walking around a single locked tile).
  /** @type {{x:number,y:number,colour:string,tileColour:string}[]} */
  const keyItems = [];
  if (floorNum >= 2) {
    // Build priority list: stair room > special rooms > eligible randoms
    const lockPriority = [];
    if (farthest !== spawnRoom && farthest !== bossRoom && farthest.roomType !== 'mainframe') lockPriority.push(farthest);
    for (const r of specialRooms) {
      if (!lockPriority.includes(r) && r.roomType !== 'vendor' && r.roomType !== 'secret') lockPriority.push(r);
    }
    const fallback = rooms.filter((/** @type {any} */ r) =>
      r !== spawnRoom && r !== farthest && r !== bossRoom &&
      !specialRooms.includes(r) && r.w * r.h >= 20
    );
    lockPriority.push(...shuffleInPlace(fallback.slice(), 'world'));

    const numLocked = floorNum >= 7 ? 3 : floorNum >= 4 ? 2 : 1;
    const colours = ['red','blue','gold'];
    const lockTiles = [T.LOCKED_R, T.LOCKED_B, T.LOCKED_G];
    const lockColours = ['#ff3333','#3388ff','#ffcc00'];
    let placed = 0;

    for (const lr of lockPriority) {
      if (placed >= numLocked) break;
      const ci = Math.min(placed, 2);
      // Entrance clusters were already narrowed to one room-boundary tile;
      // lock every current entrance so the room cannot be bypassed.
      const cls = getEntranceClusters(lr);
      const narrowClusters = cls.filter(cl => cl.length <= 2);
      if (!narrowClusters.length) continue; // can't meaningfully gate this room

      // Convert every tile in every entrance cluster to a locked door.
      const lockedTiles = [];
      for (const cl of narrowClusters) {
        for (const e of cl) {
          map[e.y][e.x] = lockTiles[ci];
          lockedTiles.push(e);
        }
      }

      /** @type {Set<string>} */
      const placedColours = new Set();
      let vis2 = computeKeyPlacementReach(placedColours);
      let expanded = true;
      let keySafety = 6;
      while (expanded && keySafety-- > 0) {
        expanded = false;
        for (const ki of keyItems) {
          if (!placedColours.has(ki.colour) && vis2[ki.y]?.[ki.x]) {
            placedColours.add(ki.colour);
            expanded = true;
          }
        }
        if (expanded) vis2 = computeKeyPlacementReach(placedColours);
      }
      const keyOccupied = (/** @type {any} */ r) => keyItems.some((/** @type {any} */ ki) => ki.x === r.cx && ki.y === r.cy);
      const keyEligible = rooms.filter((/** @type {any} */ r) =>
        r !== lr && r !== spawnRoom && r !== bossRoom && r.roomType !== 'secret' &&
        !keyOccupied(r) && vis2[r.cy][r.cx]
      );
      const preferredKeyRooms = keyEligible.filter((/** @type {any} */ r) =>
        r !== farthest && r.roomType !== 'vendor'
      );
      // Find a reachable, already-explorable room to place the key. Never put
      // progression keys in the spawn room: that creates "locked start room"
      // layouts that are technically solvable but read as broken generation.
      const keyRoom = preferredKeyRooms.length ? preferredKeyRooms : keyEligible;
      if (keyRoom.length) {
        const kr = keyRoom[rndInt(0, keyRoom.length-1)];
        keyItems.push({
          x: kr.cx,
          y: kr.cy,
          colour: /** @type {string} */ (colours[ci]),
          tileColour: /** @type {string} */ (lockColours[ci])
        });
        lr.hasLoot = true;
        placed++;
      } else {
        // Can't safely place key — revert locks to floor.
        for (const e of lockedTiles) map[e.y][e.x] = T.FLOOR;
      }
    }
  }

  // ── Secret room (every floor, one per floor) ─────────────────────────────
  /** @type {any[]} */ const secretRooms = [];
  /** @type {any[]} */ const whisperItems = [];
  {
    // Candidates: not spawn, not stair, not boss, not already special, decent size
    const secretEligible = rooms.filter((/** @type {any} */ r) =>
      r !== spawnRoom && r !== farthest && r !== bossRoom && !r.roomType && r.w * r.h >= 20
    );
    // Shuffle and try to find one with a normalized single-tile entrance.
    const shuffled = shuffleInPlace(secretEligible.slice(), 'world');
    for (const r of shuffled) {
      const cls = getEntranceClusters(r);
      const narrow = cls.filter(cl => cl.length <= 2);
      if (!narrow.length) continue; // no entrance to convert into a cracked wall

      r.roomType = 'secret';
      r.secretRevealed = false;
      specialRooms.push(r);
      secretRooms.push(r);

      // Wall off ALL entrances
      for (const cl of cls) {
        for (const e of cl) map[e.y][e.x] = T.WALL;
      }
      // Place T.CRACKED at one narrow cluster (the "hidden entrance")
      const crackedCluster = /** @type {any} */ (narrow[rndInt(0, narrow.length - 1)]);
      for (const e of crackedCluster) map[e.y][e.x] = T.CRACKED;

      // Whispers subplot — narrative fragments found in secret rooms.
      // Try to spawn one whisper item at the secret room's center. NEON.whispers
      // returns null if no eligible unread whisper for this floor's biome, in
      // which case the secret room still rewards the player with normal loot
      // (the per-room loot pass at render.js handles that). Try/catch keeps
      // gen resilient if the meta module isn't loaded yet (e.g. early Node
      // tests of generateFloor).
      try {
        if (typeof NEON !== 'undefined' && NEON.whispers && NEON.whispers.pickWhisperForFloor) {
          const w = NEON.whispers.pickWhisperForFloor(floorNum, () => rand('event'));
          if (w && w.id) {
            whisperItems.push({ x: r.cx + 0.5, y: r.cy + 0.5, whisperId: w.id });
          }
        }
      } catch (_) { /* gen-time meta unavailable; skip whisper this floor */ }

      break; // only one secret room per floor
    }
  }

  // ── Challenge Room (floor 2+, non-boss): optional wave-based arena ─────
  /** @type {any} */ let challengeRoom = null;
  /** @type {any[]} */ const challengeEntrances = [];
  if (floorNum >= 2 && !bossRoom) {
    const challengeEligible = rooms.filter((/** @type {any} */ r) =>
      r !== spawnRoom && r !== farthest && !r.roomType &&
      !specialRooms.includes(r) && r.w * r.h >= 30
    );
    const shuffledCh = shuffleInPlace(challengeEligible.slice(), 'world');
    for (const r of shuffledCh) {
      const cls = getEntranceClusters(r);
      // Only pick rooms where ALL entrance clusters are narrow (≤2 tiles)
      if (cls.length === 0) continue;
      if (cls.some(cl => cl.length > 2)) continue;
      r.roomType = 'challenge';
      challengeRoom = r;
      specialRooms.push(r);
      // Replace entrance tiles with challenge gates
      for (const cl of cls) {
        for (const e of cl) {
          map[e.y][e.x] = T.CHALLENGE_GATE;
          challengeEntrances.push({ x: e.x, y: e.y });
        }
      }
      break; // one per floor
    }
  }

  // ── Implant Room (floor 2+, non-boss, ~50% chance): augment shrine ─────
  /** @type {any} */ let implantRoom = null;
  if (floorNum >= 2 && !bossRoom && rand('world') < 0.5) {
    const implantEligible = rooms.filter((/** @type {any} */ r) =>
      r !== spawnRoom && r !== farthest && !r.roomType &&
      !specialRooms.includes(r) && r.w * r.h >= 16
    );
    if (implantEligible.length > 0) {
      implantRoom = implantEligible[rndInt(0, implantEligible.length - 1)];
      implantRoom.roomType = 'implant';
      specialRooms.push(implantRoom);
      map[implantRoom.cy][implantRoom.cx] = T.IMPLANT_SHRINE;
    }
  }

  // ── Event Room (floor 2+, non-boss): risk/reward encounter terminal ───
  /** @type {any} */ let eventRoom = null;
  if (floorNum >= 2 && !bossRoom) {
    const eventEligible = rooms.filter((/** @type {any} */ r) =>
      r !== spawnRoom && r !== farthest && !r.roomType &&
      !specialRooms.includes(r) && r.w * r.h >= 16
    );
    if (eventEligible.length > 0) {
      eventRoom = eventEligible[rndInt(0, eventEligible.length - 1)];
      eventRoom.roomType = 'event';
      specialRooms.push(eventRoom);
      map[eventRoom.cy][eventRoom.cx] = T.EVENT_TERMINAL;
    }
  }

  collapseAdjacentEntranceTiles();
  // ── Prune dead-end corridor tiles ─────────────────────────────────────
  // After secret rooms, locked doors, and challenge rooms wall off entrances,
  // some corridor segments become dead ends (floor tile with only 1 passable
  // neighbour that isn't inside any room). Iteratively fill them so players
  // never walk down a tunnel to nowhere.
  {
    // Build room membership lookup
    /** @type {any} */ const inRoom = Array.from({length: MAP_H}, () => new Uint8Array(MAP_W));
    for (const r of rooms) {
      for (let ty = r.y; ty < r.y + r.h; ty++)
        for (let tx = r.x; tx < r.x + r.w; tx++)
          if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H) inRoom[ty][tx] = 1;
    }
    let pruned = true;
    const connects = (/** @type {any} */ t) => t !== T.WALL && t !== T.VOID; // doors/locks/cracked all count
    while (pruned) {
      pruned = false;
      for (let y = 1; y < MAP_H - 1; y++) {
        for (let x = 1; x < MAP_W - 1; x++) {
          if (map[y][x] !== T.FLOOR || inRoom[y][x]) continue;
          let adj = 0;
          if (connects(map[y-1][x])) adj++;
          if (connects(map[y+1][x])) adj++;
          if (connects(map[y][x-1])) adj++;
          if (connects(map[y][x+1])) adj++;
          if (adj <= 1) { map[y][x] = T.WALL; pruned = true; }
        }
      }
    }
  }

  thinWideCorridors();
  repairMisalignedOutsideEntrancePassages();
  clearOrphanEntranceTiles();

  // ── All-rooms reachability gate (key-cascade BFS) ──────────────────────
  // Goal: from spawn, the player must be able to reach EVERY room — not just
  // the stairs. Special rooms (vendor / lore / event terminal / shrine /
  // challenge) host gameplay-critical interactions; if any becomes unreachable
  // due to lock placement + later passes (secret rooms, dead-end pruning), the
  // floor feels broken even when technically completable.
  //
  // User reports on floor 3 (twice on 2026-04-25 / 6bc2e985):
  //   "spawned into a room with the exit and a red key door, but no red key,
  //    so I can't explore the floor or fight the miniboss"
  //
  // The previous fix only checked KEY-item reachability and missed the case
  // where a key is reachable but the rooms it would unlock are still gated
  // behind ANOTHER unreachable lock (multi-color cascades) or the key is
  // simply absent for a placed lock (lockPriority/keyRoom empty edge cases).
  //
  // Algorithm:
  //   1. BFS from spawn through `passable` tiles + locks of any colour for
  //      which a reachable key exists. Iterate until fixed point (each pass
  //      may discover new keys, which open new locks, exposing more keys).
  //   2. If any room has zero reachable tiles after fixed point, downgrade
  //      every locked door whose colour the player COULDN'T pick up. The
  //      floor loses some gating gameplay but every room becomes reachable.
  //   3. If rooms are still unreachable (e.g. structurally walled by gen),
  //      the rescue-corridor pass below carves spawn→stairs as a last resort.
  //
  // Tile vocabulary kept in sync with src/platform.js isPassable() so this
  // gen-time reachability matches what the player actually experiences. The
  // notable additions over the prior fix are T.PLASMA, T.ARC (walkable
  // hazards — runtime isPassable allows them, the prior gen-time check did
  // not) and T.CRACKED (interact-breakable per game.js:663,1691 — secret
  // rooms ARE reachable to the player without keys/upgrades, so they should
  // count as reachable here too). T.DOOR (closed) stays passable because the
  // player can open closed doors via interact; that diverges from runtime
  // isPassable but is intentional (matches dungeon-gen connectivity intent).
  {
    const solvedReach = solveProgressionReachability(rooms);
    const computeReach = solvedReach.computeReach;
    /** @type {any} */ let reach = solvedReach.reachable;
    // After fixed point, `reach` reflects max possible exploration with all
    // collectible keys. Check every room for at least one reachable tile.
    /** @param {{x:number,y:number,w:number,h:number,cx:number,cy:number}} room */
    const roomTouchesReach = (room) => dungeonReachability.roomTouchesReach(room, reach);
    const unreachableWithKeys = solvedReach.unreachableRooms;
    if (unreachableWithKeys.length > 0) {
      // Downgrade every locked door whose colour the player couldn't pick up.
      // This includes colours with no key item placed at all (the
      // lockPriority/keyRoom empty-fallback edge case in the lock-placement
      // loop above).
      const lockTileForColour = { red: T.LOCKED_R, blue: T.LOCKED_B, gold: T.LOCKED_G };
      for (const colour of solvedReach.missingColours) {
        const lt = lockTileForColour[/** @type {'red'|'blue'|'gold'} */ (colour)];
        for (let y = 0; y < MAP_H; y++) {
          for (let x = 0; x < MAP_W; x++) {
            if (map[y][x] === lt) map[y][x] = T.FLOOR;
          }
        }
      }
      // After downgrading, recompute reach (no longer gated by missing keys).
      reach = computeReach(new Set(['red', 'blue', 'gold']));
    }

    /**
     * @param {any} room
     * @returns {{x:number,y:number,ox:number,oy:number}[]}
     */
    const roomBoundaryGates = (room) => {
      /** @type {{x:number,y:number,ox:number,oy:number}[]} */
      const gates = [];
      for (let tx = room.x; tx < room.x + room.w; tx++) {
        const top = map[room.y]?.[tx];
        if (top === T.LOCKED_R || top === T.LOCKED_B || top === T.LOCKED_G || top === T.CRACKED || top === T.CHALLENGE_GATE) {
          gates.push({ x: tx, y: room.y, ox: tx, oy: room.y - 1 });
        }
        const by = room.y + room.h - 1;
        const bottom = map[by]?.[tx];
        if (bottom === T.LOCKED_R || bottom === T.LOCKED_B || bottom === T.LOCKED_G || bottom === T.CRACKED || bottom === T.CHALLENGE_GATE) {
          gates.push({ x: tx, y: by, ox: tx, oy: by + 1 });
        }
      }
      for (let ty = room.y; ty < room.y + room.h; ty++) {
        const left = map[ty]?.[room.x];
        if (left === T.LOCKED_R || left === T.LOCKED_B || left === T.LOCKED_G || left === T.CRACKED || left === T.CHALLENGE_GATE) {
          gates.push({ x: room.x, y: ty, ox: room.x - 1, oy: ty });
        }
        const bx = room.x + room.w - 1;
        const right = map[ty]?.[bx];
        if (right === T.LOCKED_R || right === T.LOCKED_B || right === T.LOCKED_G || right === T.CRACKED || right === T.CHALLENGE_GATE) {
          gates.push({ x: bx, y: ty, ox: bx + 1, oy: ty });
        }
      }
      return gates;
    };

    // Final repair pass: validate with ALL locks open using the same 4-way
    // movement the player has. If a gated room is unreachable, carve to the
    // OUTSIDE face of its gate so the lock still matters; only ungated rooms
    // get a direct rescue corridor to their centre.
    for (let repair = 0; repair < rooms.length; repair++) {
      reach = computeReach(new Set(['red', 'blue', 'gold']));
      const blocked = rooms.find((/** @type {any} */ r) => !roomTouchesReach(r));
      if (!blocked) break;
      const gates = roomBoundaryGates(blocked);
      if (gates.length > 0) {
        const gate = gates.find((/** @type {any} */ g) =>
          g.ox >= 0 && g.oy >= 0 && g.ox < MAP_W && g.oy < MAP_H && !reach[g.oy]?.[g.ox]
        ) || gates[0];
        if (gate) {
          const outsideInBounds = gate.ox >= 0 && gate.oy >= 0 && gate.ox < MAP_W && gate.oy < MAP_H;
          carveProtectedRescueCorridorTo(outsideInBounds ? gate.ox : gate.x, outsideInBounds ? gate.oy : gate.y);
        }
      } else {
        carveProtectedRescueCorridorTo(blocked.cx, blocked.cy);
      }
    }
  }

  // ── Reachability guarantee: spawn → stairs must always be connected ────
  // BFS from spawn across all non-wall/void tiles (doors + locked doors
  // count as passable since the player will acquire keys). If stairs are
  // unreachable, carve a rescue corridor. Structured as a reusable helper
  // so it can later double as a player power-up (path visualisation).
  {
    const sx = spawnRoom.cx, sy = spawnRoom.cy;
    const stairTile = floorNum >= _finalFloor ? T.TERMINAL : T.STAIRS;
    /** @type {any} */ const vis = Array.from({length: MAP_H}, () => new Uint8Array(MAP_W));
    /** @type {any} */ const prev = Array.from({length: MAP_H}, () => new Int16Array(MAP_W).fill(-1));
    const q = [{x: sx, y: sy}];
    vis[sy][sx] = 1;
    let stairX = -1, stairY = -1;
    // Find stairs position
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++)
        if (map[y][x] === stairTile) { stairX = x; stairY = y; }

    while (q.length) {
      const {x, y} = /** @type {{x:any,y:any}} */ (q.shift());
      if (x === stairX && y === stairY) break;
      for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
        if (vis[ny][nx]) continue;
        const t = map[ny][nx];
        if (t === T.WALL || t === T.VOID) continue;
        vis[ny][nx] = 1;
        prev[ny][nx] = y * MAP_W + x;
        q.push({x: nx, y: ny});
      }
    }

    if (!vis[stairY][stairX]) {
      // Stairs unreachable — carve rescue corridor, only overwriting WALL/VOID
      let cx = sx, cy = sy;
      while (cx !== stairX) { if (map[cy][cx] === T.WALL || map[cy][cx] === T.VOID) map[cy][cx] = T.FLOOR; cx += cx < stairX ? 1 : -1; }
      while (cy !== stairY) { if (map[cy][cx] === T.WALL || map[cy][cx] === T.VOID) map[cy][cx] = T.FLOOR; cy += cy < stairY ? 1 : -1; }
    }
  }

  thinWideCorridors();
  clearOrphanEntranceTiles();

  {
    /** @param {any} room */
    const roomBoundaryGates = (room) => {
      /** @type {{x:number,y:number,ox:number,oy:number}[]} */
      const gates = [];
      for (let tx = room.x; tx < room.x + room.w; tx++) {
        const top = map[room.y]?.[tx];
        if (top === T.LOCKED_R || top === T.LOCKED_B || top === T.LOCKED_G || top === T.CRACKED || top === T.CHALLENGE_GATE) gates.push({ x: tx, y: room.y, ox: tx, oy: room.y - 1 });
        const by = room.y + room.h - 1;
        const bottom = map[by]?.[tx];
        if (bottom === T.LOCKED_R || bottom === T.LOCKED_B || bottom === T.LOCKED_G || bottom === T.CRACKED || bottom === T.CHALLENGE_GATE) gates.push({ x: tx, y: by, ox: tx, oy: by + 1 });
      }
      for (let ty = room.y; ty < room.y + room.h; ty++) {
        const left = map[ty]?.[room.x];
        if (left === T.LOCKED_R || left === T.LOCKED_B || left === T.LOCKED_G || left === T.CRACKED || left === T.CHALLENGE_GATE) gates.push({ x: room.x, y: ty, ox: room.x - 1, oy: ty });
        const bx = room.x + room.w - 1;
        const right = map[ty]?.[bx];
        if (right === T.LOCKED_R || right === T.LOCKED_B || right === T.LOCKED_G || right === T.CRACKED || right === T.CHALLENGE_GATE) gates.push({ x: bx, y: ty, ox: bx + 1, oy: ty });
      }
      return gates;
    };
    for (let repair = 0; repair < rooms.length; repair++) {
      const solvedReach = solveProgressionReachability(rooms);
      const blocked = solvedReach.unreachableRooms[0];
      if (!blocked) break;
      const gates = roomBoundaryGates(blocked);
      const gate = gates.find((/** @type {any} */ g) =>
        g.ox >= 0 && g.oy >= 0 && g.ox < MAP_W && g.oy < MAP_H && !solvedReach.reachable[g.oy]?.[g.ox]
      ) || gates[0];
      if (gate) {
        const outsideInBounds = gate.ox >= 0 && gate.oy >= 0 && gate.ox < MAP_W && gate.oy < MAP_H;
        carveProtectedRescueCorridorTo(outsideInBounds ? gate.ox : gate.x, outsideInBounds ? gate.oy : gate.y);
      } else {
        carveProtectedRescueCorridorTo(blocked.cx, blocked.cy);
      }
    }
  }

  thinWideCorridors();
  const relocatedEntrances = normalizeEntranceTilesOutsideRooms();
  collapseAdjacentOutsideEntranceTilesToFloor();
  repairOutsideEntranceRoomEdges();
  repairMisalignedOutsideEntrancePassages();
  clearDeadOutsideEntranceTiles();
  ensureSpecialRoomEntrances();
  repairMisalignedOutsideEntrancePassages();
  collapseAdjacentOutsideEntranceTilesToFloor();
  repairOutsideEntranceRoomEdges();
  ensureSpecialRoomEntrances();
  repairMisalignedOutsideEntrancePassages();
  clearDeadOutsideEntranceTiles();
  repairPostRelocationLockReachability();
  removeKeysWithoutLiveLocks();
  thinWideCorridors();
  repairMisalignedOutsideEntrancePassages();
  clearDeadOutsideEntranceTiles();
  ensureSpecialRoomEntrances();
  removeKeysWithoutLiveLocks();
  thinWideCorridors();
  clearDeadOutsideEntranceTiles();
  ensureSpecialRoomEntrances();
  removeKeysWithoutLiveLocks();
  for (let repair = 0; repair < 3; repair++) {
    sealDoorBypassCorners();
    repairDoorBypassSealedEntranceStubs();
    repairReachabilityAfterDoorCornerSealing();
  }
  sealDoorBypassCorners();
  repairDoorBypassSealedEntranceStubs();
  sealDoorBypassCorners();
  for (const move of relocatedEntrances) {
    if (move.tile !== T.CHALLENGE_GATE) continue;
    const entry = challengeEntrances.find((/** @type {any} */ e) => e.x === move.fromX && e.y === move.fromY);
    if (entry) { entry.x = move.toX; entry.y = move.toY; }
  }
  for (let i = challengeEntrances.length - 1; i >= 0; i--) {
    const entry = challengeEntrances[i];
    if (!entry || map[entry.y]?.[entry.x] === T.CHALLENGE_GATE) continue;
    challengeEntrances.splice(i, 1);
  }

  // ── Traps (floor 3+) ────────────────────────────────────────────────────
  if (floorNum >= 3) {
    for (const r of rooms) {
      // Skip spawn (player needs safe arrival), boss (boss room is its own
      // hazard), and special rooms — secret rooms in particular, because the
      // whisper item spawns at the room center (see secret-room placement
      // above) and a trap landing on that exact tile would visually replace
      // the whisper. Special rooms (vendor/lore/event/shrine/challenge) host
      // gameplay-critical interactions that traps would clutter.
      if (r === spawnRoom || r === bossRoom || r.roomType) continue;
      const trapCount = rndInt(0, Math.min(3, Math.floor(floorNum/3)));
      for (let t=0; t<trapCount; t++) {
        const tx = r.x + rndInt(1, r.w-2);
        const ty = r.y + rndInt(1, r.h-2);
        if (map[ty][tx] === T.FLOOR) {
          // Trap mix: 55% spike (damage), 22% slow (impede), 13% shock
          // (movement-suppress), 10% repulsor (positional knockback).
          // Status hazards (shock, repulsor) stay rare because they commit
          // the player in place / displace them — over-spawning trivialises
          // rooms. Repulsor is the rarest because adjacent repulsors can
          // chain a forced detour that's hard to plan around.
          const roll = rand('world');
          map[ty][tx] = roll < 0.55 ? T.TRAP_SPIKE
                      : roll < 0.77 ? T.TRAP_SLOW
                      : roll < 0.90 ? T.SHOCK_TILE
                      : T.REPULSOR;
        }
      }
    }
  }

  // ── Toxic Pools (floor 3+): corrosive pools that damage player AND enemies ──
  if (floorNum >= 3) {
    for (const r of rooms) {
      if (r === spawnRoom || r === bossRoom || r.roomType) continue;
      if (rand('world') > 0.30) continue; // ~30% of eligible rooms
      const sx = r.x + rndInt(2, r.w-3);
      const sy = r.y + rndInt(2, r.h-3);
      if (map[sy][sx] !== T.FLOOR) continue;
      map[sy][sx] = T.TOXIC;
      const poolSize = rndInt(2, 4);
      let cx = sx, cy = sy;
      for (let p = 1; p < poolSize; p++) {
        const dirs = /** @type {[number,number][]} */ ([[0,1],[0,-1],[1,0],[-1,0]]);
        const [ddx, ddy] = /** @type {[number,number]} */ (dirs[rndInt(0, 3)]);
        const nx = cx + ddx, ny = cy + ddy;
        if (nx > r.x && nx < r.x+r.w-1 && ny > r.y && ny < r.y+r.h-1 && map[ny][nx] === T.FLOOR) {
          map[ny][nx] = T.TOXIC;
          cx = nx; cy = ny;
        }
      }
    }
  }

  // ── Plasma Vents (floor 4+): clustered pools in normal rooms ─────────
  if (floorNum >= 4) {
    for (const r of rooms) {
      if (r === spawnRoom || r === bossRoom || r.roomType) continue;
      if (rand('world') > 0.35) continue; // ~35% of eligible rooms
      // Seed tile for the pool
      const sx = r.x + rndInt(2, r.w-3);
      const sy = r.y + rndInt(2, r.h-3);
      if (map[sy][sx] !== T.FLOOR) continue;
      map[sy][sx] = T.PLASMA;
      // Grow pool via random-walk from seed (2-4 total tiles)
      const poolSize = rndInt(2, 4);
      let cx = sx, cy = sy;
      for (let p = 1; p < poolSize; p++) {
        const dirs = /** @type {[number,number][]} */ ([[0,1],[0,-1],[1,0],[-1,0]]);
        const [ddx, ddy] = /** @type {[number,number]} */ (dirs[rndInt(0, 3)]);
        const nx = cx + ddx, ny = cy + ddy;
        if (nx > r.x && nx < r.x+r.w-1 && ny > r.y && ny < r.y+r.h-1 && map[ny][nx] === T.FLOOR) {
          map[ny][nx] = T.PLASMA;
          cx = nx; cy = ny;
        }
      }
    }
  }

  // ── Lore Terminals (floor 1+, non-boss): guaranteed opening frame + floor-scaled extras ────
  /** @type {{x:number,y:number}[]} */
  const loreTerminals = [];
  /** @param {any} r */
  function placeLoreTerminalInRoom(r) {
    for (let attempt = 0; attempt < 16; attempt++) {
      const tx = r.x + rndInt(1, r.w - 2);
      const ty = r.y + rndInt(1, r.h - 2);
      if (tx === r.cx && ty === r.cy) continue;
      if (map[ty][tx] === T.FLOOR) {
        map[ty][tx] = T.LORE;
        loreTerminals.push({ x: tx, y: ty });
        return true;
      }
    }
    for (let ty = r.y + 1; ty < r.y + r.h - 1; ty++) {
      for (let tx = r.x + 1; tx < r.x + r.w - 1; tx++) {
        if (tx === r.cx && ty === r.cy) continue;
        if (map[ty][tx] === T.FLOOR) {
          map[ty][tx] = T.LORE;
          loreTerminals.push({ x: tx, y: ty });
          return true;
        }
      }
    }
    return false;
  }
  if (floorNum >= 1 && !bossRoom) {
    if (floorNum === 1) placeLoreTerminalInRoom(spawnRoom);
    const loreEligible = rooms.filter((/** @type {any} */ r) =>
      r !== spawnRoom && r !== farthest && r.roomType !== 'vendor' &&
      r.roomType !== 'secret' && r.roomType !== 'event' && r.w * r.h >= 12
    );
    const numLore = Math.min(loreEligible.length, floorNum >= 5 ? 2 : floorNum >= 2 ? 1 : 0);
    const loreRooms = shuffleInPlace(loreEligible.slice(), 'world').slice(0, numLore);
    for (const r of loreRooms) {
      placeLoreTerminalInRoom(r);
    }
  }

  // ── Arc Grids (floor 5+): pulsing hazards in corridors ───────────────
  if (floorNum >= 5) {
    // Build room mask to identify corridor tiles
    /** @type {any} */ const roomMask = Array.from({length:MAP_H}, ()=>new Uint8Array(MAP_W));
    for (const r of rooms) {
      for (let ty = r.y; ty < r.y + r.h; ty++)
        for (let tx = r.x; tx < r.x + r.w; tx++)
          roomMask[ty][tx] = 1;
    }
    // Collect corridor floor tiles (not adjacent to doors/stairs/terminals)
    const corridorTiles = [];
    for (let ty = 1; ty < MAP_H-1; ty++) {
      for (let tx = 1; tx < MAP_W-1; tx++) {
        if (map[ty][tx] !== T.FLOOR || roomMask[ty][tx]) continue;
        // Skip if adjacent to door, stairs, terminal, or locked door
        let nearSpecial = false;
        for (const [ddx, ddy] of /** @type {[number,number][]} */ ([[0,1],[0,-1],[1,0],[-1,0]])) {
          const nt = map[ty+ddy]?.[tx+ddx];
          if (nt===T.STAIRS||nt===T.TERMINAL||nt===T.VENDOR||nt===T.LORE||nt===T.IMPLANT_SHRINE||nt===T.EVENT_TERMINAL||nt===T.MAINFRAME_READER||nt===T.NETWORK_PORTAL||nt===T.MESSAGE_CONSOLE||isDoor(nt)||nt===T.DOOR_OPEN) { nearSpecial = true; break; }
        }
        if (!nearSpecial) corridorTiles.push({x:tx, y:ty});
      }
    }
    // Place arc grids: ~1 per 12 corridor tiles, capped
    const arcCount = Math.min(Math.floor(corridorTiles.length / 12) + 1, 6 + floorNum);
    const shuffled = shuffleInPlace(corridorTiles.slice(), 'world');
    let placed = 0;
    for (const ct of shuffled) {
      if (placed >= arcCount) break;
      // Don't place adjacent to another arc
      let adjArc = false;
      for (const [ddx, ddy] of /** @type {[number,number][]} */ ([[0,1],[0,-1],[1,0],[-1,0]])) {
        if (map[ct.y+ddy]?.[ct.x+ddx] === T.ARC) { adjArc = true; break; }
      }
      if (adjArc) continue;
      map[ct.y][ct.x] = T.ARC;
      placed++;
    }
  }

  // ── Teleport Pads (floor 3+, non-boss): linked pairs for fast travel ───
  const teleportPads = [];
  if (floorNum >= 3 && !bossRoom) {
    const padEligible = rooms.filter((/** @type {any} */ r) =>
      r !== spawnRoom && r !== farthest && !r.roomType &&
      !specialRooms.includes(r) && r.w * r.h >= 16 &&
      map[r.cy][r.cx] === T.FLOOR
    );
    // Want pairs of rooms far apart — sort by BFS distance from spawn and pair extremes
    const pairCount = floorNum >= 6 ? 2 : 1;
    const shuffled = shuffleInPlace(padEligible.slice(), 'world');
    const used = new Set();
    for (let p = 0; p < pairCount && shuffled.length - used.size >= 2; p++) {
      let bestA = null, bestB = null, bestDist = 0;
      for (let i = 0; i < shuffled.length; i++) {
        if (used.has(i)) continue;
        for (let j = i + 1; j < shuffled.length; j++) {
          if (used.has(j)) continue;
          const d = Math.abs(shuffled[i].cx - shuffled[j].cx) + Math.abs(shuffled[i].cy - shuffled[j].cy);
          if (d > bestDist) { bestDist = d; bestA = i; bestB = j; }
        }
      }
      if (bestA !== null && bestDist >= 15) {
        const rA = shuffled[/** @type {number} */ (bestA)], rB = shuffled[/** @type {number} */ (bestB)];
        map[rA.cy][rA.cx] = T.TELEPORT_PAD;
        map[rB.cy][rB.cx] = T.TELEPORT_PAD;
        teleportPads.push({ x1: rA.cx, y1: rA.cy, x2: rB.cx, y2: rB.cy, pairIndex: p });
        used.add(bestA);
        used.add(bestB);
      }
    }
  }

  // Room colour map (floor tile → tint)
  /** @type {any} */ const roomColour = Array.from({length:MAP_H},()=>new Array(MAP_W).fill(null));
  for (const r of rooms) {
    if (!r.roomType) continue;
    const col = ROOM_COLOURS[r.roomType];
    for (let ty=r.y; ty<r.y+r.h; ty++)
      for (let tx=r.x; tx<r.x+r.w; tx++)
        if (map[ty][tx]===T.FLOOR) roomColour[ty][tx]=col;
  }

  // Secret room mask — tiles inside unrevealed secret rooms are hidden from lighting/rendering
  // Cracked entrance tiles are excluded so they can receive light and render crack visuals
  /** @type {any} */ const secretMask = Array.from({length:MAP_H},()=>new Uint8Array(MAP_W));
  for (const r of secretRooms) {
    for (let ty=r.y; ty<r.y+r.h; ty++)
      for (let tx=r.x; tx<r.x+r.w; tx++)
        if (map[ty][tx] !== T.CRACKED) secretMask[ty][tx] = 1;
  }

  return { map, rooms, spawnRoom, defaultSpawnRoom, preferredSpawnResolved: !!preferredSpawn, stairRoom:farthest, bossRoom, bossEntrances, mainframeRoom, playerPos, lights, visited, light, visible, keyItems, whisperItems, roomColour, specialRooms, vendorRoom, secretRooms, secretMask, loreTerminals, challengeRoom, challengeEntrances, eventRoom, teleportPads };
}
