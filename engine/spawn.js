// @ts-check
// engine/spawn.js — spawn-position utilities.
//
// findNearestPassable: BFS from a target tile to the closest passable tile
// within `maxRadius` rings. Used by game.loadFloor() to drop the player near
// the previous floor's exit position rather than always at dungeon.playerPos.
//
// Pure function — no globals, no canvas, no audio. Node-test friendly.
//
// API:
//   findNearestPassable(map, fx, fy, isPassable, opts?) → {x, y} | null
//     map       2D grid of tile codes, map[y][x]
//     fx, fy    starting world coords (any number; floored internally)
//     isPassable function(tileCode) → boolean
//     opts      { maxRadius?: number = 12 }
//   Return: tile-center coords {x: tx + 0.5, y: ty + 0.5} or null.
//
// Caller is responsible for clamping fx/fy to map bounds before calling.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (/** @type {any} */ (root.NEON = root.NEON || {})).spawn = factory();
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  /**
   * @param {Array<Array<number>>} map
   * @param {number} fx
   * @param {number} fy
   * @param {(tile: number) => boolean} isPassable
   * @param {{ maxRadius?: number }} [opts]
   * @returns {{ x: number, y: number } | null}
   */
  function findNearestPassable(map, fx, fy, isPassable, opts) {
    if (!map || !map.length || typeof isPassable !== 'function') return null;
    const H = map.length;
    const row0 = map[0];
    const W = row0 ? row0.length : 0;
    if (W === 0) return null;
    const maxRadius = (opts && opts.maxRadius != null) ? (opts.maxRadius | 0) : 12;
    const sx = Math.max(0, Math.min(W - 1, Math.floor(fx)));
    const sy = Math.max(0, Math.min(H - 1, Math.floor(fy)));

    // Check the start tile first.
    const startRow = map[sy];
    if (startRow && isPassable(/** @type {number} */ (startRow[sx]))) {
      return { x: sx + 0.5, y: sy + 0.5 };
    }

    // BFS (4-neighbour). Marking visited via a Set of "y*W+x" keys keeps the
    // hot path simple. Caps at maxRadius rings to avoid pathological search
    // on huge open maps when the start is in a void/locked region.
    const visited = new Set();
    visited.add(sy * W + sx);
    /** @type {Array<[number, number, number]>} */
    let frontier = [[sx, sy, 0]];
    while (frontier.length) {
      /** @type {Array<[number, number, number]>} */
      const next = [];
      for (let i = 0; i < frontier.length; i++) {
        const cell = frontier[i];
        if (!cell) continue;
        const x = cell[0], y = cell[1], d = cell[2];
        if (d >= maxRadius) continue;
        const neighbours = [[x+1,y],[x-1,y],[x,y+1],[x,y-1]];
        for (let j = 0; j < 4; j++) {
          const nb = neighbours[j];
          if (!nb) continue;
          const nx = /** @type {number} */ (nb[0]);
          const ny = /** @type {number} */ (nb[1]);
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const key = ny * W + nx;
          if (visited.has(key)) continue;
          visited.add(key);
          const nrow = map[ny];
          if (nrow && isPassable(/** @type {number} */ (nrow[nx]))) {
            return { x: nx + 0.5, y: ny + 0.5 };
          }
          next.push([nx, ny, d + 1]);
        }
      }
      frontier = next;
    }
    return null;
  }

  return { findNearestPassable };
}));
