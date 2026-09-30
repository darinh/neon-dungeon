// @ts-check
'use strict';

/** @type {any[]} */
const pendingEnemySpawns = [];

/**
 * Queue a translucent ghost replay of a previously killed enemy for
 * GHOST_PROJECTOR. The intent goes through pendingEnemySpawns, the same
 * post-enemy-loop queue used by SPLITTER shards and SUMMONER drones.
 * Without deferral, for-of over the live enemies array would update an
 * appended ghost in the frame it spawns.
 *
 * game.js recognises `_ghIsGhost` while flushing the queue, applies the
 * HP/atk/xpValue mutations, and assigns the live ref to
 * projector._gpActiveGhost.
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
