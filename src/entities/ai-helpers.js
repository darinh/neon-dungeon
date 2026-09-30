// @ts-check
'use strict';

// Loaded after src/entities.js so these helpers can reuse its tuning constants.
/**
 * aimDx/aimDy must be a unit vector. No LoS or immunity — callers add those.
 *
 * @param {number} px
 * @param {number} py
 * @param {number} ox
 * @param {number} oy
 * @param {number} aimDx
 * @param {number} aimDy
 * @param {number} range
 * @param {number} halfAngleRad
 * @returns {boolean}
 */
function isInsideCone(px, py, ox, oy, aimDx, aimDy, range, halfAngleRad) {
  const vx = px - ox, vy = py - oy;
  const d2 = vx*vx + vy*vy;
  if (d2 === 0) return true;
  if (d2 > range * range) return false;
  const len = Math.sqrt(d2);
  // Dot of unit aim with unit (px-ox, py-oy) = cos(angle between them).
  const cosA = (vx * aimDx + vy * aimDy) / len;
  return cosA >= Math.cos(halfAngleRad);
}

/**
 * history is oldest-first; t is age in seconds. Extracted from Player.getPositionAgo so tests need no Player.
 *
 * @param {Array<{t:number,x:number,y:number}> | null | undefined} history
 * @param {number} seconds
 * @returns {{x:number, y:number} | null}
 */
function getPositionAgoFromHistory(history, seconds) {
  if (!history || history.length === 0) return null;
  // Newest-first walk: first age >= seconds is the freshest sample that still qualifies.
  for (let i = history.length - 1; i >= 0; i--) {
    const e = history[i];
    if (e && e.t >= seconds) {
      return { x: e.x, y: e.y };
    }
  }
  return null; // history doesn't go back that far yet
}

/**
 * @param {Array<{t:number,x:number,y:number}> | null | undefined} history
 * @param {number} curX
 * @param {number} curY
 * @param {number} lookahead seconds in the future to project
 * @param {number} sampleSec seconds back to sample for velocity
 * @param {number} velCap maximum |v| in tiles/sec (clamps dashes/teleports)
 * @returns {{x:number, y:number, vx:number, vy:number, vmag:number} | null}
 */
function predictFromHistory(history, curX, curY, lookahead, sampleSec, velCap) {
  if (!history || history.length === 0) return null;
  // Divide by the sample's actual age, not sampleSec. An older sample under jitter inflates velocity and over-leads.
  let past = null;
  for (let i = history.length - 1; i >= 0; i--) {
    const e = history[i];
    if (e && e.t >= sampleSec) { past = e; break; }
  }
  if (!past) return null;
  const dtAge = past.t > 1e-6 ? past.t : sampleSec; // epsilon guard
  const rawVx = (curX - past.x) / dtAge;
  const rawVy = (curY - past.y) / dtAge;
  const rawMag = Math.hypot(rawVx, rawVy);
  let vx = rawVx, vy = rawVy, vmag = rawMag;
  if (rawMag > velCap && rawMag > 0) {
    const k = velCap / rawMag;
    vx = rawVx * k; vy = rawVy * k; vmag = velCap;
  }
  return { x: curX + vx * lookahead, y: curY + vy * lookahead, vx, vy, vmag };
}

/**
 * Speed is clamped so a fast perk cannot make the return shot invisible. Damage is mob-scaled at fire time, not taken from history.
 *
 * @param {Array<{spd?:number,colour?:string}> | null | undefined} shotHistory
 * @returns {{spd:number, colour:string}}
 */
function pickMirrorKinematics(shotHistory) {
  const def = { spd: MIRROR_PROJ_SPD_DEF, colour: '#88ff44' };
  if (!shotHistory || shotHistory.length === 0) return def;
  const last = shotHistory[shotHistory.length - 1];
  if (!last) return def;
  const rawSpd = (typeof last.spd === 'number' && isFinite(last.spd)) ? last.spd : MIRROR_PROJ_SPD_DEF;
  const spd = Math.max(MIRROR_PROJ_SPD_MIN, Math.min(MIRROR_PROJ_SPD_MAX, rawSpd));
  const colour = (typeof last.colour === 'string' && last.colour) ? last.colour : '#88ff44';
  return { spd, colour };
}

/**
 * Tile coords. dx/dy must already be unit length. strength is 1/sec at field center.
 * MAGNETON_SAFE_R skips the apex so a zero vector cannot NaN the normalise.
 * No allocs beyond the returned pair so tests can extract this function alone.
 *
 * @param {number} px
 * @param {number} py
 * @param {number} dx
 * @param {number} dy
 * @param {number} mx
 * @param {number} my
 * @param {number} fieldR
 * @param {number} strength
 * @param {number} dt
 * @returns {[number, number]}
 */
function magnetonBendDir(px, py, dx, dy, mx, my, fieldR, strength, dt) {
  const vx = mx - px, vy = my - py;
  const d2 = vx * vx + vy * vy;
  const r2 = fieldR * fieldR;
  if (d2 >= r2) return [dx, dy];
  const dToMag = Math.sqrt(d2);
  if (dToMag <= MAGNETON_SAFE_R) return [dx, dy];
  const gx = vx / dToMag, gy = vy / dToMag;
  const proximity = 1 - (dToMag / fieldR);
  const alpha = Math.min(1, Math.max(0, strength * proximity * dt));
  const ndx = dx + (gx - dx) * alpha;
  const ndy = dy + (gy - dy) * alpha;
  const len = Math.sqrt(ndx * ndx + ndy * ndy);
  if (len <= 1e-9) return [dx, dy];
  return [ndx / len, ndy / len];
}

/**
 * @param {any | null | undefined} target
 * @param {Array<any>} candidates
 * @returns {boolean}
 */
function isMagpieTargetStale(target, candidates) {
  return !!target && (target.dead || candidates.indexOf(target) === -1);
}

/**
 * @param {any} target
 * @param {number} x
 * @param {number} y
 * @param {number} grabRange
 * @returns {boolean}
 */
function isMagpieTargetInGrabRange(target, x, y, grabRange) {
  const dx = target.x - x, dy = target.y - y;
  return dx * dx + dy * dy <= grabRange * grabRange;
}

/**
 * @param {number} stolenCredits
 * @param {number} playerDistance
 * @param {number} fleeRange
 * @returns {boolean}
 */
function shouldMagpieFlee(stolenCredits, playerDistance, fleeRange) {
  return (stolenCredits || 0) > 0 && playerDistance < fleeRange;
}

/**
 * Returns the same item object so aiMagpie can mark that pickup dead.
 * Keys, harvest, whispers, and hoards are not loot; a hoard would loop between magpies.
 *
 * @param {Array<any>} candidates
 * @param {number} x
 * @param {number} y
 * @param {number} scanRange
 * @returns {any | null}
 */
function pickMagpieTarget(candidates, x, y, scanRange) {
  let best = null;
  let bestD2 = scanRange * scanRange;
  for (const it of candidates) {
    if (!it || it.dead) continue;
    if (it.isKey || it.isHarvest || it.isWhisper || it.isHoard) continue;
    const dx = it.x - x, dy = it.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = it;
    }
  }
  return best;
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} playerX
 * @param {number} playerY
 * @param {number} fleeRange
 * @returns {{x:number, y:number}}
 */
function pickMagpieFleeTarget(x, y, playerX, playerY, fleeRange) {
  const dx = x - playerX, dy = y - playerY;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: x + (dx / len) * fleeRange,
    y: y + (dy / len) * fleeRange,
  };
}

/**
 * @param {number} floorNum
 * @param {number} base
 * @param {number} perFloor
 * @returns {number}
 */
function magpieStolenCreditsForFloor(floorNum, base, perFloor) {
  return base + floorNum * perFloor;
}
