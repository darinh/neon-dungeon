// @ts-check
'use strict';

// Loaded before src/entities.js so entity methods can call these helpers.
// Callers include wall turrets, NEXUS links, room-clear, and vengeance/frenzy.

const enemiesByRoom = new Map();

/**
 * @param {any} [e]
 */
function registerEnemyInRoom(e) {
  if (!e || !e.room) return;
  let set = enemiesByRoom.get(e.room);
  if (!set) { set = new Set(); enemiesByRoom.set(e.room, set); }
  set.add(e);
}

/**
 * @param {any} [e]
 */
function unregisterEnemyFromRoom(e) {
  if (!e || !e.room) return;
  const set = enemiesByRoom.get(e.room);
  if (set) set.delete(e);
}

function clearEnemiesByRoom() { enemiesByRoom.clear(); }

function getEnemiesInRoom(/** @type {any} */ room) { return enemiesByRoom.get(room) || null; }

// Does not filter dead, disguised, or phased enemies; callers must.
const _EMPTY_ENEMY_SET = new Set();

/**
 * @param {any} [room]
 */
function enemiesInRoomIter(room) {
  if (!room) return _EMPTY_ENEMY_SET;
  return enemiesByRoom.get(room) || _EMPTY_ENEMY_SET;
}
