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
  // A dead ghost still occupies the slot and blocks the next claim.
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
        // Sentinel for the same-frame window before game.js flush assigns
        // _gpActiveGhost. Without it a second kill this frame arms another
        // pending memory, leaving both an active ghost and a new claim.
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
