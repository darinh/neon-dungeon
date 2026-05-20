// @ts-check
'use strict';
// engine/dungeon/reachability.js — generic key/lock reachability solver.
//
// Engine layer: callers inject tile semantics and game policy. This module
// reports traversal facts; it does not mutate maps or choose repair strategy.
(function (root, factory) {
  const v = factory();
  if (typeof module === 'object' && module.exports) module.exports = v;
  else {
    const ns = /** @type {any} */ (root.NEON = root.NEON || {});
    ns.dungeonReachability = v;
  }
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  /** @typedef {{x:number,y:number,w?:number,h?:number,cx?:number,cy?:number,[key:string]:any}} RoomLike */
  /** @typedef {{x:number,y:number,colour?:string,color?:string,[key:string]:any}} KeyLike */
  /** @typedef {{x:number,y:number,colour:string}} BlockedEdge */
  /** @typedef {{kind:'downgrade-lock-colour',colour:string}|{kind:'connect-room',room:RoomLike}} RepairHint */

  /**
   * @param {ArrayLike<ArrayLike<number>>} map
   * @returns {{width:number,height:number}}
   */
  function mapSize(map) {
    const height = map.length;
    const width = height > 0 ? (map[0]?.length || 0) : 0;
    return { width, height };
  }

  /**
   * @param {RoomLike} room
   * @param {Uint8Array[]} reachable
   */
  function roomTouchesReach(room, reachable) {
    if (room.cy != null && room.cx != null && reachable[room.cy]?.[room.cx]) return true;
    const x0 = Math.max(0, Math.floor(room.x || 0));
    const y0 = Math.max(0, Math.floor(room.y || 0));
    const x1 = Math.floor(x0 + (room.w || 1));
    const y1 = Math.floor(y0 + (room.h || 1));
    for (let y = y0; y < y1; y++) {
      const row = reachable[y];
      if (!row) continue;
      for (let x = x0; x < x1; x++) {
        if (row[x]) return true;
      }
    }
    return false;
  }

  /**
   * @param {{
   *   map: ArrayLike<ArrayLike<number>>,
   *   start: {x:number,y:number},
   *   keys?: KeyLike[],
   *   requiredRooms?: RoomLike[],
   *   isOpenTile: (tile:number) => boolean,
   *   lockColourForTile?: (tile:number) => string | null | undefined,
   * }} opts
   */
  function solveKeyLockReachability(opts) {
    const { width, height } = mapSize(opts.map);
    const keys = opts.keys || [];
    /** @type {Set<string>} */
    const collectedColours = new Set();
    /** @type {Uint8Array[]} */
    let reachable = Array.from({ length: height }, () => new Uint8Array(width));

    /** @param {Set<string>} have */
    const computeReach = (have) => {
      const vis = Array.from({ length: height }, () => new Uint8Array(width));
      const sx = Math.floor(opts.start.x);
      const sy = Math.floor(opts.start.y);
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) return vis;
      const q = [{ x: sx, y: sy }];
      const startRow = vis[sy];
      if (!startRow) return vis;
      startRow[sx] = 1;
      for (let qi = 0; qi < q.length; qi++) {
        const { x, y } = /** @type {{x:number,y:number}} */ (q[qi]);
        for (const dir of /** @type {const} */ ([[0, -1], [0, 1], [-1, 0], [1, 0]])) {
          const nx = x + dir[0], ny = y + dir[1];
          const row = vis[ny];
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || !row || row[nx]) continue;
          const tile = Number(opts.map[ny]?.[nx]);
          const lockColour = opts.lockColourForTile ? opts.lockColourForTile(tile) : null;
          const open = opts.isOpenTile(tile) || (lockColour ? have.has(lockColour) : false);
          if (!open) continue;
          row[nx] = 1;
          q.push({ x: nx, y: ny });
        }
      }
      return vis;
    };

    let progressed = true;
    let safety = Math.max(1, keys.length + 1);
    while (progressed && safety-- > 0) {
      progressed = false;
      reachable = computeReach(collectedColours);
      for (const key of keys) {
        const colour = key.colour || key.color;
        if (!colour || collectedColours.has(colour)) continue;
        if (reachable[key.y]?.[key.x]) {
          collectedColours.add(String(colour));
          progressed = true;
        }
      }
    }

    const requiredRooms = opts.requiredRooms || [];
    const unreachableRooms = requiredRooms.filter((room) => !roomTouchesReach(room, reachable));

    /** @type {Set<string>} */
    const lockColours = new Set();
    if (opts.lockColourForTile) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const colour = opts.lockColourForTile(Number(opts.map[y]?.[x]));
          if (colour) lockColours.add(colour);
        }
      }
    }
    const missingColours = Array.from(lockColours).filter((colour) => !collectedColours.has(colour));
    /** @type {BlockedEdge[]} */
    const blockedEdges = [];
    if (opts.lockColourForTile) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (reachable[y]?.[x]) continue;
          const colour = opts.lockColourForTile(Number(opts.map[y]?.[x]));
          if (!colour) continue;
          for (const dir of /** @type {const} */ ([[0, -1], [0, 1], [-1, 0], [1, 0]])) {
            const nx = x + dir[0], ny = y + dir[1];
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            if (reachable[ny]?.[nx]) {
              blockedEdges.push({ x, y, colour: String(colour) });
              break;
            }
          }
        }
      }
    }
    /** @type {RepairHint[]} */
    const repairHints = [
      ...missingColours.map((colour) => ({ kind: /** @type {const} */ ('downgrade-lock-colour'), colour })),
      ...unreachableRooms.map((room) => ({ kind: /** @type {const} */ ('connect-room'), room })),
    ];

    return {
      reachable,
      collectedColours,
      unreachableRooms,
      missingColours,
      blockedEdges,
      repairHints,
      computeReach,
    };
  }

  return { solveKeyLockReachability, roomTouchesReach };
}));
