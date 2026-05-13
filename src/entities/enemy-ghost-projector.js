// @ts-check
'use strict';

// ─── GHOST_PROJECTOR AI — Stationary Memory Lens ──────────────────────
// Floor 8+. Stationary mob (spd=0, no attack of its own). Listens for
// ghostable kills in its room via notifyGhostProjectors() (called from
// Enemy.die). When a memory is claimed, _gpPendingDelay counts down from
// GHOST_PROJECTOR_DELAY (3.0s); on 0, spawnGhost() conjures a translucent
// replay at the kill site with reduced HP/atk. The active ghost ref is
// held in _gpActiveGhost so we don't claim a new memory until the ghost
// dies/expires.
//
// States are implicit:
//   idle:      no memory, no active ghost. Claimable.
//   pending:   _gpPendingType set, _gpPendingDelay > 0. Visual telegraph
//              (orb at projector + ghosting at spawn site). Stun cancels.
//   haunting:  _gpActiveGhost is alive. New memories blocked.
//
// Counter-play: kill the projector before its 3s delay expires (HP is
// low, no defenses). Or stun it (drops the pending memory). Ghosts
// themselves are normal enemies — kill them as usual.
/**
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 */
Enemy.prototype.aiGhostProjector = function aiGhostProjector(dt, player, map, d, los) {
  void player; void map; void d; void los; // stationary, no engagement logic
  // Free the active-ghost slot once the ghost is gone, so the next
  // ghostable kill in the room can claim a new memory.
  if (this._gpActiveGhost && this._gpActiveGhost.dead) {
    this._gpActiveGhost = null;
  }
  // Pending memory: tick down delay, queue ghost on completion.
  if (this._gpPendingType && !this._gpAwaitingFlush) {
    this._gpPendingDelay -= dt;
    if (this._gpPendingDelay <= 0) {
      const queued = spawnGhost(
        this._gpPendingType,
        this._gpPendingX,
        this._gpPendingY,
        this.room,
        this
      );
      if (queued) {
        // Sentinel: blocks notifyGhostProjectors from re-claiming this
        // projector during the same-frame window between queueing and
        // the flush back-assigning _gpActiveGhost. Without this, a
        // second ghostable kill in the same frame (e.g. SEEKER death
        // explosion chain) would arm a NEW pending memory — and the
        // flush would then leave us with both an active ghost AND a
        // new pending claim, violating the per-projector single-
        // projection rule. Cleared by the flush in game.js along with
        // _gpPendingType when _gpActiveGhost is back-assigned.
        this._gpAwaitingFlush = true;
        if (audio && audio.ghostProjectorSpawn) audio.ghostProjectorSpawn();
        spawnParticles(this._gpPendingX, this._gpPendingY, 'EXPLOSION', '#ccaaff', 10);
      } else {
        // Spawn refused (unknown type / no _EG) — drop the memory so
        // the projector becomes claimable again next frame.
        this._gpPendingType = null;
        this._gpPendingDelay = 0;
      }
    }
  }
};
