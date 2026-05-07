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
    const seen = new Set();
    const dedup = edges.filter((e) => {
      const k = e.x + ',' + e.y;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
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

  return {
    CARDINAL_DIRECTIONS,
    createMap,
    carveRect,
    carveCorridor,
    createBspDungeon,
    buildRoomGraph,
    bfsRooms,
    roomContainsPoint,
    roomHasCorner,
    outsideFaceForBoundaryTile,
    findBoundaryEntranceClusters,
    BSPNode,
  };
}));
