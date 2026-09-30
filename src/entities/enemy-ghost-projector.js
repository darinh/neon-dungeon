// @ts-check
'use strict';

/**
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 */
Enemy.prototype.aiGhostProjector = function aiGhostProjector(dt, player, map, d, los) {
  void player; void map; void d; void los; // stationary, no engagement logic
  // Drop the stale ref. The field can still hold a dead ghost (for example while this projector is stunned),
  // so the claim check and the renderer test .dead themselves.
  if (this._gpActiveGhost && this._gpActiveGhost.dead) {
    this._gpActiveGhost = null;
  }
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
        // Sentinel until game.js flush assigns _gpActiveGhost. If the flush is
        // delayed by an earlier return, it prevents this pending haunt from
        // being queued again on the next gameplay update.
        this._gpAwaitingFlush = true;
        if (audio && audio.ghostProjectorSpawn) audio.ghostProjectorSpawn();
        spawnParticles(this._gpPendingX, this._gpPendingY, 'EXPLOSION', '#ccaaff', 10);
      } else {
        // Spawn refused (unknown type / no _EG): drop the memory so it can claim again.
        this._gpPendingType = null;
        this._gpPendingDelay = 0;
      }
    }
  }
};
