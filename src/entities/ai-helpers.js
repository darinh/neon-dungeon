// @ts-check
'use strict';

// Pure AI helper functions load after src/entities.js so they can reuse tuning
// constants while entity methods resolve these globals when gameplay runs.

/**
 * Pure helper: is point (px,py) inside a cone with apex (ox,oy), aim
 * direction (aimDx,aimDy) (assumed unit vector), depth `range` and
 * half-angle `halfAngleRad` (radians). Apex itself counts as inside.
 *
 * Used by the RESONATOR fire step and tested directly. Keeping this
 * pure (no LoS, no immunity) means the geometry is independently
 * verifiable; LoS / immunity gates are layered on at the call site.
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
  if (d2 === 0) return true;          // point is at the apex
  if (d2 > range * range) return false;
  const len = Math.sqrt(d2);
  // Dot of unit aim with unit (px-ox, py-oy) = cos(angle between them).
  const cosA = (vx * aimDx + vy * aimDy) / len;
  return cosA >= Math.cos(halfAngleRad);
}

/**
 * Pure helper: returns the entry from a {t,x,y} position history that is
 * AT LEAST `seconds` old, preferring the freshest such entry (i.e. the
 * sample closest to the lookback target without going under it). Returns
 * null if no entry is old enough yet (player hasn't been alive long
 * enough or history was just cleared on floor transition).
 *
 * Extracted from Player.getPositionAgo so it's testable without
 * instantiating the browser-bound Player class. The history array is
 * ordered oldest-first (entries[0].t is the largest age).
 *
 * @param {Array<{t:number,x:number,y:number}> | null | undefined} history
 * @param {number} seconds
 * @returns {{x:number, y:number} | null}
 */
function getPositionAgoFromHistory(history, seconds) {
  if (!history || history.length === 0) return null;
  // Walk newest->oldest; first entry with age >= seconds is the freshest
  // sample that still satisfies the lookback. This biases toward "just
  // old enough" rather than "very old", giving more recent causality.
  for (let i = history.length - 1; i >= 0; i--) {
    const e = history[i];
    if (e && e.t >= seconds) {
      return { x: e.x, y: e.y };
    }
  }
  return null; // history doesn't go back that far yet
}

/**
 * Pure helper: predict the player's position `lookahead` seconds in the
 * future by linear extrapolation from velocity. Velocity is estimated by
 * (current position - sample `sampleSec` seconds ago) / sampleSec, then
 * clamped to `velCap` tiles/sec to neutralise dash/teleport blowups
 * (a 0.2s dash that covers 4 tiles would otherwise project 12 tiles
 * downrange and fire into a wall).
 *
 * Returns null if history doesn't reach back `sampleSec` (e.g. just
 * spawned, just changed floors) — caller is expected to fall through
 * to a no-lock branch in that case.
 *
 * Used by PROPHET (the inverse of ECHOER): rewards stillness, punishes
 * straight-line motion. Extracted so it's testable without instantiating
 * browser-bound classes.
 *
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
  // Walk newest->oldest; pick the freshest entry whose age >= sampleSec.
  // Mirrors getPositionAgoFromHistory's selection rule, but we keep the
  // entry's actual age so we can divide by it (not by the requested
  // `sampleSec`). Using the requested seconds as the denominator inflates
  // velocity whenever the chosen sample is older than requested — common
  // under frame-time jitter / low FPS — and over-leads the shot.
  // (Bug caught by gpt-5.3-codex review of PR #137.)
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
 * Pure helper: pick safe projectile kinematics for a MIRROR shot from the
 * player's _shotHistory ring. Returns the most recent entry's speed and
 * colour, clamped into the fair band (MIRROR_PROJ_SPD_MIN..MAX) so a
 * future bullet-time perk can't yield invisible-fast return shots, and
 * defaulted when the player hasn't fired yet (or has only used melee).
 *
 * Damage is intentionally NOT pulled from history — it's mob-scaled at
 * fire time so the player's late-game crit/perk damage never returns.
 *
 * Extracted so it's testable without instantiating browser-bound classes.
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
 * Pure helper: compute the new (dx,dy) direction for a projectile after
 * one frame of MAGNETON pull. Inputs:
 *   px, py     — projectile position (tile coords)
 *   dx, dy     — current unit direction (caller guarantees normalised)
 *   mx, my     — magneton position (tile coords)
 *   fieldR     — field radius (tiles); no bend at or beyond
 *   strength   — base lerp rate (1/sec) at field center; scales with proximity
 *   dt         — frame delta (seconds)
 *
 * Returns [ndx, ndy] — new unit direction. Returns [dx, dy] unchanged when:
 *   - distance to magneton >= fieldR (out of range), or
 *   - distance to magneton <= MAGNETON_SAFE_R (apex / NaN guard), or
 *   - the lerp produces a degenerate zero vector (defensive — should not
 *     happen with strength*dt clamped to <= 1, but guards against a future
 *     regression where the call sequence forgets to clamp).
 *
 * Used by aiMagneton and tested directly. Pure — no globals, no allocs
 * beyond the [ndx,ndy] tuple. Keep this self-contained so the unit tests
 * can vm-extract it without dragging in module state.
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
 * Decide whether a MAGPIE's remembered pickup target can no longer be chased.
 *
 * @param {any | null | undefined} target
 * @param {Array<any>} candidates
 * @returns {boolean}
 */
function isMagpieTargetStale(target, candidates) {
  return !!target && (target.dead || candidates.indexOf(target) === -1);
}

/**
 * Decide whether a MAGPIE is close enough to consume its remembered target.
 *
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
 * Decide whether a MAGPIE carrying stolen credits should flee the real player.
 *
 * @param {number} stolenCredits
 * @param {number} playerDistance
 * @param {number} fleeRange
 * @returns {boolean}
 */
function shouldMagpieFlee(stolenCredits, playerDistance, fleeRange) {
  return (stolenCredits || 0) > 0 && playerDistance < fleeRange;
}

/**
 * Pick the nearest loot target a MAGPIE may steal. Returns the original item
 * object so aiMagpie can later mark that exact pickup dead when it is grabbed.
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
 * Project a MAGPIE flee target away from the real player while it carries loot.
 *
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
 * Compute how many credits a MAGPIE banks when it steals a generic pickup.
 *
 * @param {number} floorNum
 * @param {number} base
 * @param {number} perFloor
 * @returns {number}
 */
function magpieStolenCreditsForFloor(floorNum, base, perFloor) {
  return base + floorNum * perFloor;
}
