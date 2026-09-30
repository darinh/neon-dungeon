// @ts-check
'use strict';

// Telegraph is fixed-rate (not scaled by OVERCLOCK/berserk) so the cancel
// window stays fair. Adjacency is rechecked here; pickArchitectTarget only
// enforces it at pick time.
/**
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 */
Enemy.prototype.aiArchitect = function aiArchitect(dt, player, map, d, los) {
  void d; void los; // recomputed against perceived target for fairness
  const bm = this.berserkerMul();
  const ocMul = _EG.modifier === 'OVERCLOCK' ? 1.2 : 1;

  const inRoom = this.room && (
    (this._tx >= this.room.x && this._tx < this.room.x + this.room.w &&
     this._ty >= this.room.y && this._ty < this.room.y + this.room.h) ||
    (player.x >= this.room.x && player.x < this.room.x + this.room.w &&
     player.y >= this.room.y && player.y < this.room.y + this.room.h));

  if (this._aState === 'recovery') {
    this._aRec -= dt * ocMul * bm;
    if (this._aRec <= 0) {
      this._aState = 'idle';
      this._aIdle = ARCHITECT_IDLE_BASE;
      this._aCommitted = false;
    }
    return;
  }

  if (this._aState === 'target') {
    this._aTele -= dt; // fixed-rate countdown — fairness > tempo
    // ~1 spark / 3 frames: dense enough to mark the tile, not a particle storm.
    if (this._aTarget && rand('cosmetic') < 0.33) {
      spawnParticles(this._aTarget.tx + 0.5, this._aTarget.ty + 0.5,
                     'SPARK', '#aa6633', 1);
    }
    // Revalidate adjacency: pick-time Chebyshev>=2 does not hold for the 1.5s window.
    const t = this._aTarget;
    const cancelledLOS = !hasLOS(this.x, this.y, this._tx, this._ty, map);
    const cancelledOccupied = t && _isTileOccupiedByActor(t.tx, t.ty, player);
    const cancelledTileType = t && map[t.ty]?.[t.tx] !== T.FLOOR;
    const cancelledAdjacent = t && Math.max(
      Math.abs(t.tx - Math.floor(player.x)),
      Math.abs(t.ty - Math.floor(player.y))
    ) < 2;
    if (!t || cancelledLOS || cancelledOccupied || cancelledTileType || cancelledAdjacent) {
      this._aState = 'recovery';
      this._aRec = ARCHITECT_RECOVERY;
      this._aTele = 0;
      this._aTarget = null;
      return;
    }
    if (this._aTele <= 0) {
      // One live wall per architect. Replace by owner, not by tile.
      for (let i = placedWalls.length - 1; i >= 0; i--) {
        const w = placedWalls[i];
        if (w.owner === this) {
          map[w.ty][w.tx] = w.origTile;
          placedWalls.splice(i, 1);
        }
      }
      const origTile = map[t.ty][t.tx];
      map[t.ty][t.tx] = T.WALL;
      placedWalls.push({
        tx: t.tx, ty: t.ty, origTile,
        decayTimer: ARCHITECT_DECAY_TIME, owner: this,
      });
      if (typeof _EG.markMapMutated === 'function') _EG.markMapMutated();
      if (audio.architectCommit) audio.architectCommit();
      spawnParticles(t.tx + 0.5, t.ty + 0.5, 'EXPLOSION', '#aa6633', 8);
      this._aState = 'recovery';
      this._aRec = ARCHITECT_RECOVERY;
      this._aTele = 0;
      this._aTarget = null;
      this._aCommitted = true;
    }
    return;
  }

  this._aIdle -= dt * ocMul * bm;
  if (this._aIdle > 0) return;
  if (!inRoom || !this._canTarget()) {
    // Half interval so a failed attempt does not retry every frame.
    this._aIdle = ARCHITECT_IDLE_BASE * 0.5;
    return;
  }
  const dx = this._tx - this.x, dy = this._ty - this.y;
  const dPerceived2 = dx * dx + dy * dy;
  if (dPerceived2 > ARCHITECT_RANGE * ARCHITECT_RANGE) {
    this._aIdle = ARCHITECT_IDLE_BASE * 0.5;
    return;
  }
  if (!hasLOS(this.x, this.y, this._tx, this._ty, map)) {
    this._aIdle = ARCHITECT_IDLE_BASE * 0.5;
    return;
  }
  const targetTile = pickArchitectTarget(this.x, this.y, this._tx, this._ty, map, player);
  if (!targetTile) {
    this._aIdle = ARCHITECT_IDLE_BASE * 0.4;
    return;
  }
  this._aTarget = targetTile;
  this._aState = 'target';
  this._aTele = ARCHITECT_TARGET_TIME;
  if (audio.architectTarget) audio.architectTarget();
};
