// @ts-check
'use strict';
// engine/dungeon/topology.js — reusable room/corridor topology helpers.
//
// Engine layer: no game content, no narrative, no tile vocabulary beyond
// caller-injected numeric wall/floor tile ids.
(function (root, factory) {
  const v = factory();
  if (typeof module === 'object' && module.exports) module.exports = v;
  else {
    const ns = /** @type {any} */ (root.NEON = root.NEON || {});
    ns.dungeonTopology = v;
  }
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  const CARDINAL_DIRECTIONS = /** @type {ReadonlyArray<readonly [number, number]>} */ (Object.freeze([
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]));

  /**
   * @param {number} width
   * @param {number} height
   * @param {number} fillTile
   * @returns {Uint8Array[]}
   */
  function createMap(width, height, fillTile) {
    return Array.from({ length: height }, () => new Uint8Array(width).fill(fillTile));
  }

  /**
   * @param {ArrayLike<ArrayLike<number>>} map
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {number} tile
   */
  function carveRect(map, x, y, w, h, tile) {
    const height = map.length;
    const width = height > 0 ? (map[0]?.length || 0) : 0;
    for (let ty = y; ty < y + h; ty++) {
      const row = /** @type {any} */ (map[ty]);
      if (!row || ty < 0 || ty >= height) continue;
      for (let tx = x; tx < x + w; tx++) {
        if (tx >= 0 && tx < width) row[tx] = tile;
      }
    }
  }

  /**
   * @param {ArrayLike<ArrayLike<number>>} map
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   * @param {number} tile
   */
  function carveCorridor(map, x1, y1, x2, y2, tile) {
    let x = x1, y = y1;
    while (x !== x2) {
      const row = /** @type {any} */ (map[y]);
      if (row) row[x] = tile;
      x += x < x2 ? 1 : -1;
    }
    while (y !== y2) {
      const row = /** @type {any} */ (map[y]);
      if (row) row[x] = tile;
      y += y < y2 ? 1 : -1;
    }
  }

  class BSPNode {
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     * @param {{ rand: () => number, rndInt: (min:number, max:number) => number, floorTile: number }} opts
     */
    constructor(x, y, w, h, opts) {
      this.x = x; this.y = y; this.w = w; this.h = h;
      /** @type {BSPNode|null} */ this.left = null;
      /** @type {BSPNode|null} */ this.right = null;
      /** @type {{x:number,y:number,w:number,h:number,cx:number,cy:number}|null} */
      this.room = null;
      this._opts = opts;
    }

    /** @param {number} depth */
    split(depth) {
      if (depth <= 0 || (this.w < 16 && this.h < 16)) return;
      const horiz = this.h > this.w ? true : this.w > this.h ? false : this._opts.rand() < 0.5;
      if (horiz) {
        const split = this._opts.rndInt(8, this.h - 8);
        this.left = new BSPNode(this.x, this.y, this.w, split, this._opts);
        this.right = new BSPNode(this.x, this.y + split, this.w, this.h - split, this._opts);
      } else {
        const split = this._opts.rndInt(8, this.w - 8);
        this.left = new BSPNode(this.x, this.y, split, this.h, this._opts);
        this.right = new BSPNode(this.x + split, this.y, this.w - split, this.h, this._opts);
      }
      this.left.split(depth - 1);
      this.right.split(depth - 1);
    }

    /** @returns {BSPNode[]} */
    getLeaves() {
      if (!this.left && !this.right) return [this];
      return [...(this.left?.getLeaves() ?? []), ...(this.right?.getLeaves() ?? [])];
    }

    /** @param {ArrayLike<ArrayLike<number>>} map */
    carveRooms(map) {
      if (!this.left && !this.right) {
        const rw = this._opts.rndInt(5, Math.max(6, this.w - 2));
        const rh = this._opts.rndInt(5, Math.max(6, this.h - 2));
        const rx = this.x + this._opts.rndInt(1, Math.max(2, this.w - rw - 1));
        const ry = this.y + this._opts.rndInt(1, Math.max(2, this.h - rh - 1));
        this.room = { x: rx, y: ry, w: rw, h: rh,
          cx: Math.floor(rx + rw / 2), cy: Math.floor(ry + rh / 2) };
        carveRect(map, rx, ry, rw, rh, this._opts.floorTile);
        return;
      }
      this.left?.carveRooms(map);
      this.right?.carveRooms(map);
      const lr = this.left?.getRoom();
      const rr = this.right?.getRoom();
      if (lr && rr) carveCorridor(map, lr.cx, lr.cy, rr.cx, rr.cy, this._opts.floorTile);
    }

    /** @returns {{x:number,y:number,w:number,h:number,cx:number,cy:number}|null} */
    getRoom() {
      if (this.room) return this.room;
      const l = this.left?.getRoom(), r = this.right?.getRoom();
      if (!l) return r || null;
      if (!r) return l;
      return this._opts.rand() < 0.5 ? l : r;
    }
  }

  /**
   * @param {{
   *   width: number,
   *   height: number,
   *   depth: number,
   *   wallTile: number,
   *   floorTile: number,
   *   rand: () => number,
   *   rndInt: (min:number, max:number) => number,
   * }} opts
   */
  function createBspDungeon(opts) {
    const map = createMap(opts.width, opts.height, opts.wallTile);
    const root = new BSPNode(0, 0, opts.width, opts.height, {
      rand: opts.rand,
      rndInt: opts.rndInt,
      floorTile: opts.floorTile,
    });
    root.split(opts.depth);
    root.carveRooms(map);
    const rooms = root.getLeaves().map((l) => l.room).filter(Boolean);
    return { map, root, rooms };
  }

  /**
   * @param {any[]} rooms
   * @param {(a:any, b:any) => boolean} areConnected
   * @returns {Map<any, any[]>}
   */
  function buildRoomGraph(rooms, areConnected) {
    const graph = new Map();
    for (const room of rooms) {
      /** @type {any[]} */
      const neighbors = [];
      for (const other of rooms) {
        if (other === room) continue;
        if (areConnected(room, other)) neighbors.push(other);
      }
      graph.set(room, neighbors);
    }
    return graph;
  }

  /**
   * @param {any[]} rooms
   * @param {any} startRoom
   * @param {(a:any, b:any) => boolean} areConnected
   * @returns {Map<any, number>}
   */
  function bfsRooms(rooms, startRoom, areConnected) {
    const dist = new Map();
    const q = [startRoom];
    dist.set(startRoom, 0);
    while (q.length) {
      const cur = q.shift();
      for (const other of rooms) {
        if (dist.has(other)) continue;
        if (areConnected(cur, other)) {
          dist.set(other, dist.get(cur) + 1);
          q.push(other);
        }
      }
    }
    return dist;
  }

  /**
   * @param {{x:number,y:number,w:number,h:number}} room
   * @param {number} x
   * @param {number} y
   */
  function roomContainsPoint(room, x, y) {
    return x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h;
  }

  /**
   * Overlap area between a candidate rectangle, optionally expanded by
   * candidate-side padding, and an existing room rectangle.
   *
   * @param {{x:number,y:number,w:number,h:number}} rect
   * @param {{x:number,y:number,w:number,h:number}} room
   * @param {number} [padding]
   */
  function rectOverlapArea(rect, room, padding = 0) {
    const ax1 = rect.x - padding, ay1 = rect.y - padding;
    const ax2 = rect.x + rect.w + padding, ay2 = rect.y + rect.h + padding;
    const bx1 = room.x, by1 = room.y, bx2 = room.x + room.w, by2 = room.y + room.h;
    const ox = Math.max(0, Math.min(ax2, bx2) - Math.max(ax1, bx1));
    const oy = Math.max(0, Math.min(ay2, by2) - Math.max(ay1, by1));
    return ox * oy;
  }

  /**
   * @param {{x:number,y:number,w:number,h:number}} rect
   * @param {Array<{x:number,y:number,w:number,h:number}>} rooms
   * @param {{x:number,y:number,w:number,h:number}|null|undefined} ignoredRoom
   * @param {number} [padding]
   */
  function rectOverlapsAnyRoom(rect, rooms, ignoredRoom, padding = 0) {
    for (const room of rooms) {
      if (room === ignoredRoom) continue;
      if (rectOverlapArea(rect, room, padding) > 0) return true;
    }
    return false;
  }

  /**
   * @param {{x:number,y:number}[]} positions
   * @returns {{x:number,y:number}[]}
   */
  function dedupPositions(positions) {
    const seen = new Set();
    return positions.filter((p) => {
      const key = p.x + ',' + p.y;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Finds the closest placement for a rectangle expanded around a room centre.
   * Scan order intentionally preserves legacy generation tie-breaks: x is the
   * outer loop, y is the inner loop, and equal scores keep the first candidate.
   *
   * @param {{
   *   room: {x:number,y:number,w:number,h:number,cx:number,cy:number},
   *   rooms: Array<{x:number,y:number,w:number,h:number}>,
   *   minWidth: number,
   *   minHeight: number,
   *   mapWidth: number,
   *   mapHeight: number,
   *   margin?: number,
   *   padding?: number,
   * }} opts
   * @returns {{x:number,y:number,w:number,h:number}|null}
   */
  function findExpandedRoomPlacement(opts) {
    const room = opts.room;
    const w = Math.max(room.w, opts.minWidth);
    const h = Math.max(room.h, opts.minHeight);
    const margin = opts.margin ?? 1;
    const padding = opts.padding ?? 1;
    const maxX = opts.mapWidth - w - margin;
    const maxY = opts.mapHeight - h - margin;
    const desiredX = Math.max(margin, Math.min(maxX, room.cx - Math.floor(w / 2)));
    const desiredY = Math.max(margin, Math.min(maxY, room.cy - Math.floor(h / 2)));
    const xMin = Math.max(margin, room.cx - w + 1);
    const xMax = Math.min(room.cx, maxX);
    const yMin = Math.max(margin, room.cy - h + 1);
    const yMax = Math.min(room.cy, maxY);
    /** @type {{x:number,y:number,w:number,h:number}|null} */
    let best = null;
    let bestScore = Infinity;
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        const rect = { x, y, w, h };
        if (rectOverlapsAnyRoom(rect, opts.rooms, room, padding)) continue;
        const score = Math.abs(x - desiredX) + Math.abs(y - desiredY);
        if (score < bestScore) { bestScore = score; best = rect; }
      }
    }
    return best;
  }

  /**
   * Resolve a preferred spawn point by cardinally searching for the first
   * passable tile that belongs to a generated room. The host owns tile
   * semantics through `isPassable`; this helper only owns grid search/order.
   *
   * @param {{
   *   map: ArrayLike<ArrayLike<number>>,
   *   rooms: Array<{x:number,y:number,w:number,h:number}>,
   *   preferred?: {x:number,y:number}|null,
   *   isPassable: (tile:number) => boolean,
   *   searchRadius: number,
   * }} opts
   * @returns {{pos:{x:number,y:number}, room:any}|null}
   */
  function resolvePreferredSpawnRoom(opts) {
    const map = opts.map;
    const rooms = opts.rooms;
    const preferred = opts.preferred;
    if (!preferred || !map || !rooms || !rooms.length) return null;
    const h = map.length;
    const w = h > 0 ? (map[0]?.length || 0) : 0;
    if (!h || !w) return null;
    const sx = Math.max(0, Math.min(w - 1, Math.floor(preferred.x)));
    const sy = Math.max(0, Math.min(h - 1, Math.floor(preferred.y)));
    const visited = new Set();
    /** @type {{x:number,y:number,d:number}[]} */
    const q = [{ x: sx, y: sy, d: 0 }];
    visited.add(sy * w + sx);
    while (q.length) {
      const cur = q.shift();
      if (!cur || cur.d > opts.searchRadius) continue;
      const tile = Number(map[cur.y]?.[cur.x]);
      if (opts.isPassable(tile)) {
        const pos = { x: cur.x + 0.5, y: cur.y + 0.5 };
        const room = rooms.find((r) => roomContainsPoint(r, pos.x, pos.y));
        if (room) return { pos, room };
      }
      for (const dir of CARDINAL_DIRECTIONS) {
        const nx = cur.x + (dir[0] || 0), ny = cur.y + (dir[1] || 0);
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const key = ny * w + nx;
        if (visited.has(key)) continue;
        visited.add(key);
        q.push({ x: nx, y: ny, d: cur.d + 1 });
      }
    }
    return null;
  }

  /**
   * @param {{x:number,y:number,w:number,h:number}} room
   * @param {number} x
   * @param {number} y
   */
  function roomHasCorner(room, x, y) {
    return (x === room.x || x === room.x + room.w - 1) &&
      (y === room.y || y === room.y + room.h - 1);
  }

  /**
   * @param {{x:number,y:number,w:number,h:number}} room
   * @param {number} x
   * @param {number} y
   * @returns {{x:number,y:number,dx:number,dy:number}|null}
   */
  function outsideFaceForBoundaryTile(room, x, y) {
    if (y === room.y && x > room.x && x < room.x + room.w - 1) return { x, y: y - 1, dx: 0, dy: -1 };
    if (y === room.y + room.h - 1 && x > room.x && x < room.x + room.w - 1) return { x, y: y + 1, dx: 0, dy: 1 };
    if (x === room.x && y > room.y && y < room.y + room.h - 1) return { x: x - 1, y, dx: -1, dy: 0 };
    if (x === room.x + room.w - 1 && y > room.y && y < room.y + room.h - 1) return { x: x + 1, y, dx: 1, dy: 0 };
    return null;
  }

  /**
   * Finds room boundary sides adjacent to an outside entrance tile. Scan order
   * follows `CARDINAL_DIRECTIONS`, and boundary tiles that are corners of any
   * room are skipped to preserve single-face entrance semantics.
   *
   * @param {Array<{x:number,y:number,w:number,h:number}>} rooms
   * @param {number} x
   * @param {number} y
   * @returns {{dx:number,dy:number,bx:number,by:number}[]}
   */
  function findOutsideEntranceRoomSides(rooms, x, y) {
    /** @type {{dx:number,dy:number,bx:number,by:number}[]} */
    const roomSides = [];
    for (const [dx, dy] of CARDINAL_DIRECTIONS) {
      const bx = x + dx;
      const by = y + dy;
      if (rooms.some((room) => roomHasCorner(room, bx, by))) continue;
      if (rooms.some((room) => {
        const outside = outsideFaceForBoundaryTile(room, bx, by);
        return outside?.x === x && outside?.y === y;
      })) roomSides.push({ dx, dy, bx, by });
    }
    return roomSides;
  }

  /**
   * Counts cardinally adjacent outside-passage tiles around a point, optionally
   * excluding one complete coordinate pair from the count. The host owns tile semantics.
   *
   * @param {number} x
   * @param {number} y
   * @param {(x:number,y:number) => boolean} isOutsidePassageTile
   * @param {number} [exceptX]
   * @param {number} [exceptY]
   * @returns {number}
   */
  function countOutsidePassageConnections(x, y, isOutsidePassageTile, exceptX, exceptY) {
    let degree = 0;
    const hasExcludedCoordinate = exceptX !== undefined && exceptY !== undefined;
    for (const [dx, dy] of CARDINAL_DIRECTIONS) {
      const nx = x + dx;
      const ny = y + dy;
      if (hasExcludedCoordinate && nx === exceptX && ny === exceptY) continue;
      if (isOutsidePassageTile(nx, ny)) degree++;
    }
    return degree;
  }

  /**
   * Finds the topology-only repair positions needed to align a one-sided
   * outside entrance with an existing outside passage. The host injects tile
   * semantics; this helper only owns coordinate search and cardinal order.
   *
   * @param {number} x
   * @param {number} y
   * @param {{dx:number,dy:number}} side
   * @param {(x:number,y:number) => boolean} isOutsidePassageTile
   * @param {(x:number,y:number) => boolean} canCarveOutsidePassageTile
   * @returns {{px:number,py:number,cx:number,cy:number}|null}
   */
  function findAlignedOutsidePassageRepair(x, y, side, isOutsidePassageTile, canCarveOutsidePassageTile) {
    const px = x - side.dx;
    const py = y - side.dy;
    const degree = countOutsidePassageConnections(px, py, isOutsidePassageTile, x, y);
    if (degree > 0) return { px, py, cx: -1, cy: -1 };
    if (!isOutsidePassageTile(px, py) && !canCarveOutsidePassageTile(px, py)) return null;
    for (const [dx, dy] of CARDINAL_DIRECTIONS) {
      if (dx * side.dx + dy * side.dy !== 0) continue;
      if (!isOutsidePassageTile(x + dx, y + dy)) continue;
      const cx = px + dx;
      const cy = py + dy;
      if (isOutsidePassageTile(cx, cy) || canCarveOutsidePassageTile(cx, cy)) return { px, py, cx, cy };
    }
    return null;
  }

  /**
   * Finds boundary tiles where both the room edge and the outside-facing tile
   * satisfy the caller's open-tile predicate, then groups cardinal-adjacent
   * boundary tiles. Scan order intentionally mirrors the legacy generator:
   * top edge, bottom edge, left edge, right edge.
   *
   * @param {ArrayLike<ArrayLike<number>>} map
   * @param {{x:number,y:number,w:number,h:number}} room
   * @param {(tile:number) => boolean} isOpenTile
   * @returns {{x:number,y:number}[][]}
   */
  function findBoundaryEntranceClusters(map, room, isOpenTile) {
    const height = map.length;
    const width = height > 0 ? (map[0]?.length || 0) : 0;
    /** @type {{x:number,y:number}[]} */
    const edges = [];
    for (let tx = room.x; tx < room.x + room.w; tx++) {
      if (tx > room.x && tx < room.x + room.w - 1 && room.y > 0 && tx >= 0 && tx < width &&
          isOpenTile(Number(map[room.y]?.[tx])) && isOpenTile(Number(map[room.y - 1]?.[tx]))) {
        edges.push({ x: tx, y: room.y });
      }
      const by = room.y + room.h - 1;
      if (tx > room.x && tx < room.x + room.w - 1 && by < height - 1 && tx >= 0 && tx < width &&
          isOpenTile(Number(map[by]?.[tx])) && isOpenTile(Number(map[by + 1]?.[tx]))) {
        edges.push({ x: tx, y: by });
      }
    }
    for (let ty = room.y; ty < room.y + room.h; ty++) {
      if (ty > room.y && ty < room.y + room.h - 1 && room.x > 0 && ty >= 0 && ty < height &&
          isOpenTile(Number(map[ty]?.[room.x])) && isOpenTile(Number(map[ty]?.[room.x - 1]))) {
        edges.push({ x: room.x, y: ty });
      }
      const bx = room.x + room.w - 1;
      if (ty > room.y && ty < room.y + room.h - 1 && bx < width - 1 && ty >= 0 && ty < height &&
          isOpenTile(Number(map[ty]?.[bx])) && isOpenTile(Number(map[ty]?.[bx + 1]))) {
        edges.push({ x: bx, y: ty });
      }
    }
    const dedup = dedupPositions(edges);
    const used = new Set();
    /** @type {{x:number,y:number}[][]} */
    const clusters = [];
    for (const e of dedup) {
      const k = e.x + ',' + e.y;
      if (used.has(k)) continue;
      const cl = [e];
      used.add(k);
      let qi = 0;
      while (qi < cl.length) {
        const c = /** @type {{x:number,y:number}} */ (cl[qi++]);
        for (const o of dedup) {
          const ok = o.x + ',' + o.y;
          if (used.has(ok)) continue;
          if (Math.abs(c.x - o.x) + Math.abs(c.y - o.y) === 1) {
            cl.push(o);
            used.add(ok);
          }
        }
      }
      clusters.push(cl);
    }
    return clusters;
  }

  /**
   * Finds open room-boundary tiles with open outside-facing neighbours. Unlike
   * `findBoundaryEntranceClusters`, this flat scan intentionally includes room
   * corners and preserves the legacy perimeter order: top/bottom per x, then
   * left/right per y. Duplicate corner hits keep their first occurrence.
   *
   * @param {ArrayLike<ArrayLike<number>>} map
   * @param {{x:number,y:number,w:number,h:number}} room
   * @param {(tile:number) => boolean} isOpenTile
   * @param {(x:number, y:number) => boolean} [isPositionExcluded]
   * @returns {{x:number,y:number}[]}
   */
  function findRoomBoundaryOpenings(map, room, isOpenTile, isPositionExcluded) {
    const height = map.length;
    const width = height > 0 ? (map[0]?.length || 0) : 0;
    /** @type {{x:number,y:number}[]} */
    const openings = [];
    const isAllowedPosition = (/** @type {number} */ x, /** @type {number} */ y) =>
      !isPositionExcluded || !isPositionExcluded(x, y);
    const topY = room.y;
    const bottomY = room.y + room.h - 1;
    const leftX = room.x;
    const rightX = room.x + room.w - 1;

    for (let tx = room.x; tx < room.x + room.w; tx++) {
      if (topY > 0 && tx >= 0 && tx < width &&
          isOpenTile(Number(map[topY]?.[tx])) && isOpenTile(Number(map[topY - 1]?.[tx])) &&
          isAllowedPosition(tx, topY) && isAllowedPosition(tx, topY - 1)) {
        openings.push({ x: tx, y: topY });
      }
      if (bottomY < height - 1 && tx >= 0 && tx < width &&
          isOpenTile(Number(map[bottomY]?.[tx])) && isOpenTile(Number(map[bottomY + 1]?.[tx])) &&
          isAllowedPosition(tx, bottomY) && isAllowedPosition(tx, bottomY + 1)) {
        openings.push({ x: tx, y: bottomY });
      }
    }
    for (let ty = room.y; ty < room.y + room.h; ty++) {
      if (leftX > 0 && leftX < width && ty >= 0 && ty < height &&
          isOpenTile(Number(map[ty]?.[leftX])) && isOpenTile(Number(map[ty]?.[leftX - 1])) &&
          isAllowedPosition(leftX, ty) && isAllowedPosition(leftX - 1, ty)) {
        openings.push({ x: leftX, y: ty });
      }
      if (rightX < width - 1 && rightX >= 0 && ty >= 0 && ty < height &&
          isOpenTile(Number(map[ty]?.[rightX])) && isOpenTile(Number(map[ty]?.[rightX + 1])) &&
          isAllowedPosition(rightX, ty) && isAllowedPosition(rightX + 1, ty)) {
        openings.push({ x: rightX, y: ty });
      }
    }
    return dedupPositions(openings);
  }

  /**
   * Finds the first tile matching `isTargetTile` inside the room rectangle plus
   * a caller-selected surrounding padding. Scan order is y-major, then x-min to
   * x-max, preserving legacy room-neighbourhood searches.
   *
   * @param {ArrayLike<ArrayLike<number>>} map
   * @param {{x:number,y:number,w:number,h:number}} room
   * @param {(tile:number) => boolean} isTargetTile
   * @param {number} [padding]
   * @returns {{x:number,y:number}|null}
   */
  function findRoomNeighborhoodTile(map, room, isTargetTile, padding = 1) {
    const height = map.length;
    const width = height > 0 ? (map[0]?.length || 0) : 0;
    if (!height || !width) return null;
    const pad = Math.max(0, Math.floor(padding));
    const yMin = Math.max(0, room.y - pad);
    const yMax = Math.min(height - 1, room.y + room.h + pad - 1);
    const xMin = Math.max(0, room.x - pad);
    const xMax = Math.min(width - 1, room.x + room.w + pad - 1);
    for (let y = yMin; y <= yMax; y++) {
      for (let x = xMin; x <= xMax; x++) {
        if (isTargetTile(Number(map[y]?.[x]))) return { x, y };
      }
    }
    return null;
  }

  return {
    CARDINAL_DIRECTIONS,
    createMap,
    carveRect,
    carveCorridor,
    createBspDungeon,
    buildRoomGraph,
    bfsRooms,
    roomContainsPoint,
    rectOverlapArea,
    rectOverlapsAnyRoom,
    findExpandedRoomPlacement,
    resolvePreferredSpawnRoom,
    roomHasCorner,
    outsideFaceForBoundaryTile,
    findOutsideEntranceRoomSides,
    countOutsidePassageConnections,
    findAlignedOutsidePassageRepair,
    findBoundaryEntranceClusters,
    findRoomBoundaryOpenings,
    findRoomNeighborhoodTile,
    BSPNode,
  };
}));
