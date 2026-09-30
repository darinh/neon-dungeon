// @ts-check
'use strict';

// Loaded after src/entities.js so Enemy.die() can call these while the bodies
// still see entity constants and room indexes.

// Called from Enemy.die() after per-room bookkeeping and before drops.
// First eligible projector claims the kill. Ghosts, shards, summons, bosses,
// and non-ghostable types are ignored so a haunt cannot recurse.
/**
 * @param {any} deadEnemy
 */
function notifyGhostProjectors(deadEnemy) {
  if (!deadEnemy || !deadEnemy.room) return;
  if (deadEnemy._ghIsGhost) return;        // no haunt-of-haunt
  if (deadEnemy.isShard) return;
  if (deadEnemy._summoned) return;
  if (deadEnemy.isBoss) return;
  if (!isGhostableEnemyType(deadEnemy.type)) return;
  // die() already unregistered this enemy; enemiesByRoom holds live refs only.
  const inRoom = enemiesByRoom.get(deadEnemy.room);
  if (!inRoom) return;
  for (const proj of inRoom) {
    if (!proj || proj.dead) continue;
    if (proj.type !== 'GHOST_PROJECTOR') continue;
    if (proj._gpPendingType) continue;
    if (proj._gpAwaitingFlush) continue;   // flush has not written the ghost back yet
    if (proj._gpActiveGhost && !proj._gpActiveGhost.dead) continue;
    proj._gpPendingType  = deadEnemy.type;
    proj._gpPendingX     = deadEnemy.x;
    proj._gpPendingY     = deadEnemy.y;
    proj._gpPendingDelay = GHOST_PROJECTOR_DELAY;
    if (audio && audio.ghostProjectorMemory) audio.ghostProjectorMemory();
    return;
  }
}

// Only volitional kills charge VENGEANCE, same exclusion as the PACIFIST
// counter: shards, summons, ghosts, bosses, and VENGEANCE itself do not.
/**
 * @param {any} deadEnemy
 */
function notifyVengeance(deadEnemy) {
  if (!deadEnemy || !deadEnemy.room) return;
  if (deadEnemy.type === 'VENGEANCE') return;
  if (deadEnemy._ghIsGhost) return;
  if (deadEnemy.isShard) return;
  if (deadEnemy._summoned) return;
  if (deadEnemy.isBoss) return;
  // Chain deaths (VOLATILE explosions, EXPLOSIVE_KILLS) are not volitional.
  // Same exclusion the combo counter uses.
  if (deadEnemy._volatileKill) return;
  const inRoom = enemiesByRoom.get(deadEnemy.room);
  if (!inRoom) return;
  for (const v of inRoom) {
    if (!v || v.dead) continue;
    if (v.type !== 'VENGEANCE') continue;
    v._vgCharges = (v._vgCharges || 0) + 1;
  }
}
