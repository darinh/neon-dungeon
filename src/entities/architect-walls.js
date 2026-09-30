// @ts-check
'use strict';

// Loaded after src/entities.js; ARCHITECT AI and the update loop call these.

/**
 * Place BETWEEN the architect and the target, never adjacent to the player.
 * Adjacent walls create cheap-prison / forced-shove states.
 *
 * @param {number} ax architect world x
 * @param {number} ay architect world y
 * @param {number} px perceived target world x
 * @param {number} py perceived target world y
 * @param {any} map dungeon.map 2D array
 * @param {any} player player entity
 * @returns {{tx:number, ty:number} | null}
 */
function pickArchitectTarget(ax, ay, px, py, map, player) {
  // Midpoint first; then alternate progressively farther on either side until a valid tile is found.
  const fractions = [0.5, 0.4, 0.6, 0.3, 0.7];
  // Chebyshev-1 is still a prison. Exact-tile rejection is not enough.
  const ptx = Math.floor(player.x), pty = Math.floor(player.y);
  for (const f of fractions) {
    const wx = ax + (px - ax) * f;
    const wy = ay + (py - ay) * f;
    const tx = Math.floor(wx);
    const ty = Math.floor(wy);
    if (ty < 0 || ty >= map.length || tx < 0 || tx >= (map[0]?.length || 0)) continue;
    if (map[ty][tx] !== T.FLOOR) continue;
    if (Math.floor(ax) === tx && Math.floor(ay) === ty) continue;
    if (Math.max(Math.abs(tx - ptx), Math.abs(ty - pty)) < 2) continue;
    if (_isTileOccupiedByActor(tx, ty, player)) continue;
    return { tx, ty };
  }
  return null;
}

/**
 * Occupied tiles are skipped at pick and refused at commit — standing on
 * the tile is the cancel.
 *
 * @param {number} tx
 * @param {number} ty
 * @param {any} player
 */
function _isTileOccupiedByActor(tx, ty, player) {
  if (Math.floor(player.x) === tx && Math.floor(player.y) === ty) return true;
  for (const e of enemies) {
    if (e.dead) continue;
    if (Math.floor(e.x) === tx && Math.floor(e.y) === ty) return true;
  }
  return false;
}

/**
 * Walls outlive the architect. Decay restores origTile; a later commit by the
 * same architect restores its previous wall immediately.
 *
 * @param {number} dt
 * @param {any} map
 */
function updatePlacedWalls(dt, map) {
  for (let i = placedWalls.length - 1; i >= 0; i--) {
    const w = placedWalls[i];
    w.decayTimer -= dt;
    if (w.decayTimer <= 0) {
      // Do not clobber a tile something else already changed.
      if (map[w.ty]?.[w.tx] === T.WALL) {
        map[w.ty][w.tx] = w.origTile;
        if (typeof _EG.markMapMutated === 'function') _EG.markMapMutated();
        spawnParticles(w.tx + 0.5, w.ty + 0.5, 'SPARK', '#aa6633', 4);
      }
      placedWalls.splice(i, 1);
    }
  }
}
