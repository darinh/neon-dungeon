'use strict';
// @ts-check

// frostPatches are global and outlive this mob; game.js loadFloor clears them.
/**
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 * @returns {void}
 */
Enemy.prototype.aiCryophage = function aiCryophage(dt, player, map, d, los) {
  void d; void los; // recomputed against the lock for fairness
  const bm = this.berserkerMul();
  const ocMul = _EG.modifier === 'OVERCLOCK' ? 1.2 : 1;
  this._cyCooldown = Math.max(0, (this._cyCooldown || 0) - dt * ocMul * bm);

  const inRoom = this.room && (
    (this._tx >= this.room.x && this._tx < this.room.x + this.room.w &&
     this._ty >= this.room.y && this._ty < this.room.y + this.room.h) ||
    (player.x >= this.room.x && player.x < this.room.x + this.room.w &&
     player.y >= this.room.y && player.y < this.room.y + this.room.h));

  if (this._cyState === 'aiming') {
    this._cyAimTimer -= dt; // fixed-rate countdown — fairness > tempo

    if (this._cyAimTimer <= 0) {
      // Lock-time tile list. Player movement during the telegraph does not move the lattice.
      const tiles = /** @type {{x:number,y:number}[]} */ (this._cyTiles || []);
      for (const t of tiles) {
        frostPatches.push({
          x: t.x, y: t.y,
          age: 0, maxAge: CRYOPHAGE_PATCH_LIFE,
          tickCd: 0,
          dmg: Math.max(1, Math.round(this.atk * CRYOPHAGE_DMG_MUL)),
          dead: false,
        });
      }
      if (audio.cryophageCommit) audio.cryophageCommit();
      this._cyState = 'idle';
      this._cyAimTimer = 0;
      this._cyTiles = null;
      this._cyCooldown = CRYOPHAGE_COOLDOWN;
      return;
    }

    // Drift so a kited cryophage does not stick on geometry during the telegraph.
    if (this._canTarget()) {
      const [bx, by] = norm(this._tx - this.x, this._ty - this.y);
      this.moveToward(this.x + bx * 4, this.y + by * 4, this.spd * 0.5, dt, map);
    }
    return;
  }

  if (this._cyCooldown <= 0 && inRoom && this._canTarget()) {
    // _tx/_ty is already taunt-aware. Snap to tile centres so the lattice sits on the grid.
    const lockX = Math.floor(this._tx) + 0.5;
    const lockY = Math.floor(this._ty) + 0.5;
    const dLock = dist(this.x, this.y, lockX, lockY);
    if (dLock < CRYOPHAGE_RANGE && hasLOS(this.x, this.y, lockX, lockY, map)) {
      // Same list feeds the telegraph draw and the commit, so wall and out-of-bounds tiles never warn.
      const candidates = [
        { x: lockX,     y: lockY     },
        { x: lockX + 1, y: lockY     },
        { x: lockX - 1, y: lockY     },
        { x: lockX,     y: lockY + 1 },
        { x: lockX,     y: lockY - 1 },
      ];
      /** @type {{x:number,y:number}[]} */
      const tiles = [];
      for (const t of candidates) {
        const tx = Math.floor(t.x), ty = Math.floor(t.y);
        if (!map || ty < 0 || tx < 0 || !map[ty] || map[ty][tx] === undefined) continue;
        if (typeof isPassable === 'function' && !isPassable(map[ty][tx])) continue;
        tiles.push(t);
      }
      // Abort rather than telegraph an empty lattice.
      if (tiles.length === 0) {
        this._cyCooldown = 0.6;
        return;
      }
      this._cyState = 'aiming';
      this._cyAimTimer = CRYOPHAGE_TELEGRAPH;
      this._cyLockX = lockX;
      this._cyLockY = lockY;
      this._cyTiles = tiles;
      if (audio.cryophageLock) audio.cryophageLock();
      return;
    }
  }

  if (inRoom && this._canTarget()) {
    this.moveToward(this._tx, this._ty, this.spd, dt, map);
  } else if (!inRoom) {
    this.patrol(dt, map);
  }
};
