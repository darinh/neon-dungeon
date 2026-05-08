// @ts-check
'use strict';

// Room-scoped enemy index. Support structure for broadphase users such as wall
// turret acquisition, NEXUS link candidates, room-clear detection, and
// vengeance/frenzy notifications. Loaded before src/entities.js so the entity
// core can reference these helpers from function/method bodies.

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

// Convenience iterator. Safe when `room` is null/undefined or empty. Callers
// still must guard for e.dead / e._disguised / e._wrPhased etc.
const _EMPTY_ENEMY_SET = new Set();

/**
 * @param {any} [room]
 */
function enemiesInRoomIter(room) {
  if (!room) return _EMPTY_ENEMY_SET;
  return enemiesByRoom.get(room) || _EMPTY_ENEMY_SET;
}
