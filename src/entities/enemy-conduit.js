// @ts-check
'use strict';

// CONDUIT beam hit-test: returns true iff the player's center lies within
// CONDUIT_BEAM_W tiles perpendicular to the segment from this conduit to the
// linked conduit, and projects onto the segment rather than the infinite line.
// Damage immunity is deferred to player.takeDamage.
/**
 * @this {Enemy}
 * @param {any} player
 * @param {any} other
 * @returns {boolean}
 */
Enemy.prototype._cdHitsPlayer = function _cdHitsPlayer(player, other) {
  const ax = this.x, ay = this.y;
  const bx = other.x, by = other.y;
  const px = player.x, py = player.y;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 0.0001) return false; // degenerate (overlapping conduits)
  // Projection parameter t in [0,1] along segment.
  const t = ((px - ax) * dx + (py - ay) * dy) / len2;
  if (t < 0 || t > 1) return false;
  const cx = ax + t * dx, cy = ay + t * dy;
  const ex = px - cx, ey = py - cy;
  return (ex * ex + ey * ey) <= CONDUIT_BEAM_W * CONDUIT_BEAM_W;
};
