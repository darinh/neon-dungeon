// @ts-check
'use strict';

// Death notification hooks load after src/entities.js so Enemy.die() can call
// them at runtime while the hook bodies reuse entity constants and room indexes.

// GHOST_PROJECTOR kill hook. Called from Enemy.die() AFTER per-room
// bookkeeping but BEFORE drops/credits. Walks live projectors in the
// dead enemy's room; the first eligible projector (no pending memory,
// no active ghost) claims the kill and arms a haunt. Anti-recursion:
// ghosts (_ghIsGhost), shards, summons, bosses, and types not in
// GHOSTABLE_TYPES are silently ignored. Stationary projectors only;
// the projector itself is excluded from the allowlist so we never
// haunt a projector death.
/**
 * @param {any} deadEnemy
 */
function notifyGhostProjectors(deadEnemy) {
  if (!deadEnemy || !deadEnemy.room) return;
  if (deadEnemy._ghIsGhost) return;        // no haunt-of-haunt
  if (deadEnemy.isShard) return;
  if (deadEnemy._summoned) return;
  if (deadEnemy.isBoss) return;
  if (!GHOSTABLE_TYPES.has(deadEnemy.type)) return;
  // Iterate the room's enemy set. enemiesByRoom stores LIVE refs; dead
  // entries are pruned by unregisterEnemyFromRoom in die(). The dead
  // enemy itself was just unregistered above the call site.
  const inRoom = enemiesByRoom.get(deadEnemy.room);
  if (!inRoom) return;
  for (const proj of inRoom) {
    if (!proj || proj.dead) continue;
    if (proj.type !== 'GHOST_PROJECTOR') continue;
    if (proj._gpPendingType) continue;     // already pending
    if (proj._gpAwaitingFlush) continue;   // queued, awaiting flush back-assign
    if (proj._gpActiveGhost && !proj._gpActiveGhost.dead) continue; // ghost still out
    proj._gpPendingType  = deadEnemy.type;
    proj._gpPendingX     = deadEnemy.x;
    proj._gpPendingY     = deadEnemy.y;
    proj._gpPendingDelay = GHOST_PROJECTOR_DELAY;
    if (audio && audio.ghostProjectorMemory) audio.ghostProjectorMemory();
    return;                                 // first claim wins
  }
}

// VENGEANCE retaliation hook — called from die() to increment _vgCharges
// on every alive VENGEANCE in the dead enemy's room. Same exclusion
// philosophy as PACIFIST quest counter: skip shards / summons / ghosts
// / bosses / VENGEANCE itself, so only volitional kills count.
//
// Multiple VENGEANCEs in the same room each receive their own per-instance
// charge increment — they're independent counters, not a shared pool.
// This means a 2-VENGEANCE room presents a coordinated double-rush at
// the same threshold, telegraphed simultaneously (the player gets two
// committed dashes to dodge in one window).
/**
 * @param {any} deadEnemy
 */
function notifyVengeance(deadEnemy) {
  if (!deadEnemy || !deadEnemy.room) return;
  if (deadEnemy.type === 'VENGEANCE') return; // a vengeance kill doesn't charge other vengeances
  if (deadEnemy._ghIsGhost) return;
  if (deadEnemy.isShard) return;
  if (deadEnemy._summoned) return;
  if (deadEnemy.isBoss) return;
  // Incidental chain deaths (VOLATILE modifier explosions, EXPLOSIVE_KILLS
  // perk cascades) are not "volitional kills" — the player intended to
  // kill the trigger, not every adjacent enemy. Same exclusion the combo
  // counter uses (entities.js:1167). Caught by gpt-5.3-codex on initial
  // VENGEANCE PR review.
  if (deadEnemy._volatileKill) return;
  const inRoom = enemiesByRoom.get(deadEnemy.room);
  if (!inRoom) return;
  for (const v of inRoom) {
    if (!v || v.dead) continue;
    if (v.type !== 'VENGEANCE') continue;
    v._vgCharges = (v._vgCharges || 0) + 1;
  }
}
