// @ts-check
'use strict';

// ARCHITECT placed walls load after src/entities.js so they can reuse the
// shared placedWalls/enemies collections and publish the legacy helpers used by
// ARCHITECT AI and the game update loop.

// ─── ARCHITECT placed walls ───────────────────────────────────────────────
// Helpers + tick for the ARCHITECT mob's placed walls.

/**
 * Pick a tile BETWEEN (ax,ay) [architect] and (px,py) [perceived target]
 * that is currently T.FLOOR, not occupied by player or any enemy. The
 * "between" rule is THE design constraint (per rubber-duck blocking
 * issue #1) — placing adjacent to the player would create cheap prison
 * states. Walks integer tiles along the line at 0.4..0.7 of the
 * between-distance and returns the first valid candidate.
 *
 * Returns null if no valid placement found (e.g. line is solid wall,
 * player blocks every interpolated tile, etc.).
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
  // Try fractions 0.5, 0.4, 0.6, 0.3, 0.7 — biased toward the midpoint
  // (between architect and target) to maximise cover utility, with
  // fallbacks closer to either end if midpoint is blocked.
  const fractions = [0.5, 0.4, 0.6, 0.3, 0.7];
  // Player tile for adjacency rejection (per gpt-5.5 r1 finding —
  // rubber-duck blocking #1 said "between, NOT adjacent to player";
  // exact-tile rejection alone allowed Chebyshev-1 placements which
  // are still telefrag-class griefing).
  const ptx = Math.floor(player.x), pty = Math.floor(player.y);
  for (const f of fractions) {
    const wx = ax + (px - ax) * f;
    const wy = ay + (py - ay) * f;
    const tx = Math.floor(wx);
    const ty = Math.floor(wy);
    if (ty < 0 || ty >= map.length || tx < 0 || tx >= (map[0]?.length || 0)) continue;
    if (map[ty][tx] !== T.FLOOR) continue; // only convert FLOOR tiles
    // Skip the architect's own tile (paranoia — architect should never
    // wall itself in)
    if (Math.floor(ax) === tx && Math.floor(ay) === ty) continue;
    // Reject tiles adjacent to (or on) the player — Chebyshev distance ≥ 2
    // from the player tile required. This is the canonical rule from the
    // rubber-duck design pass: walling adjacent to the player creates
    // forced-shove / cheap-prison states even if the player isn't ON
    // the target tile at commit time.
    if (Math.max(Math.abs(tx - ptx), Math.abs(ty - pty)) < 2) continue;
    if (_isTileOccupiedByActor(tx, ty, player)) continue;
    return { tx, ty };
  }
  return null;
}

/**
 * Is the integer tile (tx,ty) currently occupied by the player or any
 * non-dead enemy? Used by ARCHITECT both at picking time (skip occupied
 * candidates) and at commit time (refuse to wall an occupied tile —
 * the canonical counterplay vector).
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
 * Tick all placed walls. Decay timer counts down; on expiry, restore
 * origTile and remove from the list. Called from the main update loop
 * each frame. ALSO removes orphan walls if their owner architect died
 * — wait, NO: per design, walls outlive the architect (persistence is
 * the cost of letting the architect live too long). Walls only decay
 * via timer.
 *
 * @param {number} dt
 * @param {any} map
 */
function updatePlacedWalls(dt, map) {
  for (let i = placedWalls.length - 1; i >= 0; i--) {
    const w = placedWalls[i];
    w.decayTimer -= dt;
    if (w.decayTimer <= 0) {
      // Defensive: only restore if the tile is still T.WALL. If something
      // else mutated it (e.g. another architect overwrote, or some future
      // mechanic cleared the wall), leave the current state alone.
      if (map[w.ty]?.[w.tx] === T.WALL) {
        map[w.ty][w.tx] = w.origTile;
        if (typeof _EG.markMapMutated === 'function') _EG.markMapMutated();
        spawnParticles(w.tx + 0.5, w.ty + 0.5, 'SPARK', '#aa6633', 4);
      }
      placedWalls.splice(i, 1);
    }
  }
}
