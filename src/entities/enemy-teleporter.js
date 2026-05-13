// @ts-check
'use strict';

/**
 * @this {Enemy}
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 */
Enemy.prototype.aiTeleporter = function aiTeleporter(dt, player, map, d, los) {
  this.teleportTimer = Math.max(0, this.teleportTimer - dt);
  if (this._materialize > 0) this._materialize -= dt;
  if (this._warpFade > 0) this._warpFade -= dt * 1.5;

  // Emergency blink if player gets close (skip if just teleported or player cloaked)
  if (d < 2 && this._canTarget() && this.teleportTimer > 0.8 && this._materialize <= 0) this.teleportTimer = 0;

  // Teleport cycle
  if (this.teleportTimer <= 0 && this.room) {
    this._warpFromX = this.x;
    this._warpFromY = this.y;
    this._warpFade = 0.6;
    let placed = false;
    for (let a = 0; a < 12; a++) {
      const nx = this.room.x + rnd(1, this.room.w - 1);
      const ny = this.room.y + rnd(1, this.room.h - 1);
      const fx = Math.floor(nx), fy = Math.floor(ny);
      if (fx >= 0 && fy >= 0 && fx < MAP_W && fy < MAP_H && isPassable(map[fy][fx])) {
        this.x = nx; this.y = ny; placed = true; break;
      }
    }
    if (placed) {
      spawnParticles(this.x, this.y, 'EXPLOSION', this.colour, 8);
      audio.teleport();
    }
    const cd = Math.max(2.0, 3.0 - (_EG.floor || 1) * 0.1) / (_EG.modifier === 'OVERCLOCK' ? 1.2 : 1);
    this.teleportTimer = cd;
    this._materialize = 0.4;
    this._burstLeft = 2;
  }

  // Can't attack while materializing
  if (this._materialize > 0) return;

  // Fire burst at player
  if (this._burstLeft > 0 && los && this.shootTimer <= 0) {
    this.fireAt(this._tx, this._ty, 8, this.atk, 14, this.colour);
    this._burstLeft--;
    this.shootTimer = 0.25 / this.berserkerMul();
  }
};

