// @ts-check
'use strict';

/** @type {any[]} */
const pendingEnemySpawns = [];

/**
 * Queue a translucent ghost replay of a previously-killed enemy. Used by
 * GHOST_PROJECTOR. Pushes the spawn intent onto pendingEnemySpawns so the
 * ghost is materialised AFTER the current enemy update loop completes —
 * the deferred-spawn convention every other in-loop spawner uses
 * (SPLITTER → SHARDs, SUMMONER → DRONEs, BRUTE → adds, CONDUCTOR → adds).
 * Without deferral the ghost gets `update()` in the same frame it spawns
 * because for-of over the live `enemies` array visits appended entries.
 *
 * The flush in game.js (`pendingEnemySpawns` block) recognises the
 * `_ghIsGhost` marker and applies the HP/atk/xpValue mutations and back-
 * assigns the live ref to projector._gpActiveGhost.
 *
 * Returns true if a spawn was queued, false on validation failure.
 *
 * @param {string} type      ghostable enemy type
 * @param {number} x         tile x
 * @param {number} y         tile y
 * @param {any}    room      room reference (for AI room-gating)
 * @param {any}    projector the GHOST_PROJECTOR claiming this ghost
 * @returns {boolean}
 */
function spawnGhost(type, x, y, room, projector) {
  if (!_EG || !isGhostableEnemyType(type)) return false;
  const floorNum = _EG.floor || 1;
  pendingEnemySpawns.push({
    type, x, y, floor: floorNum, room,
    _ghIsGhost: true,
    _ghOwnerProjector: projector,
  });
  return true;
}
