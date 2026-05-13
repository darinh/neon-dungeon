// @ts-check
'use strict';

// ─── ARCHITECT AI — Stationary Fortifier ───────────────────────────────
// Stationary mob (spd=0, atk=0). Periodically converts a FLOOR tile into
// a temporary T.WALL placed BETWEEN the architect and the perceived
// target — creating cover. Wall auto-decays in ARCHITECT_DECAY_TIME.
//
// Counterplay (per design pass):
//   - Move ONTO the targeted tile during the 1.5s telegraph to cancel
//     (the architect refuses to wall an occupied tile).
//   - Break LOS to the architect during target.
//   - Kill the architect (atk=0 makes it a sitting duck once found).
//
// Tile selection rules (pickArchitectTarget below):
//   - BETWEEN architect and target (NOT adjacent to player — prevents
//     telefrag-class griefing per rubber-duck blocking issue #1).
//   - Must be currently T.FLOOR (no overwriting walls, doors, traps).
//   - Must NOT be the architect's own tile.
//   - Must NOT be currently occupied by the player or an enemy.
//
// States: idle → target → recovery → idle.
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

  // Room-gated: only engage when target or player is inside this mob's
  // room. Mirrors the inRoom check in aiResonator/aiMirror/aiWatcher.
  const inRoom = this.room && (
    (this._tx >= this.room.x && this._tx < this.room.x + this.room.w &&
     this._ty >= this.room.y && this._ty < this.room.y + this.room.h) ||
    (player.x >= this.room.x && player.x < this.room.x + this.room.w &&
     player.y >= this.room.y && player.y < this.room.y + this.room.h));

  // ── Recovery: cooling down ──
  if (this._aState === 'recovery') {
    this._aRec -= dt * ocMul * bm;
    if (this._aRec <= 0) {
      this._aState = 'idle';
      this._aIdle = ARCHITECT_IDLE_BASE;
      this._aCommitted = false;
    }
    return;
  }

  // ── Target: telegraphing the build ──
  if (this._aState === 'target') {
    this._aTele -= dt; // fixed-rate countdown — fairness > tempo
    // Visual telegraph (per gpt-5.5 r1 finding — the tile-cancel
    // counterplay is impossible without a visible target indicator).
    // Spawn an earth-tone spark on the target tile each tick. Density
    // is low (1 per ~3 frames) so the visual is readable but not a
    // particle storm. The pre-commit telegraph is the canonical
    // counterplay surface — players need to SEE which tile to occupy.
    if (this._aTarget && rand('cosmetic') < 0.33) {
      spawnParticles(this._aTarget.tx + 0.5, this._aTarget.ty + 0.5,
                     'SPARK', '#aa6633', 1);
    }
    // Mid-telegraph cancellation triggers (per design pass + reviews):
    //   1. LOS lost to perceived target.
    //   2. Target tile became occupied (player moved onto it — the
    //      promised counterplay vector).
    //   3. Target tile is no longer T.FLOOR (e.g. a CRACKED reveal,
    //      another architect placed a wall there, etc.).
    //   4. Player moved ADJACENT to the target tile (Chebyshev < 2
    //      from target). Per gpt-5.3-codex r2: the adjacency rule
    //      from pickArchitectTarget is only enforced at PICK time —
    //      without revalidation during target, the player could
    //      sidestep INTO an adjacent tile during the 1.5s telegraph
    //      and the wall would still commit adjacent (creating the
    //      forced-shove / cheap-prison state the rule exists to
    //      prevent).
    // ANY of these returns the architect to recovery without committing.
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
    // Commit when telegraph timer hits zero.
    if (this._aTele <= 0) {
      // Replace any prior wall this architect placed (one per architect
      // max — per rubber-duck blocking issue #3). Find by `owner === this`.
      for (let i = placedWalls.length - 1; i >= 0; i--) {
        const w = placedWalls[i];
        if (w.owner === this) {
          map[w.ty][w.tx] = w.origTile;
          placedWalls.splice(i, 1);
        }
      }
      // Place the new wall. Store origTile so decay can restore it.
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

  // ── Idle: ticking down to next build attempt ──
  this._aIdle -= dt * ocMul * bm;
  if (this._aIdle > 0) return;
  if (!inRoom || !this._canTarget()) {
    // Reset idle so we don't hammer-attempt every tick when conditions
    // can't be met. Half-base buy-in so the architect re-evaluates
    // promptly when conditions return.
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
  // Pick a target tile BETWEEN the architect and perceived target.
  const targetTile = pickArchitectTarget(this.x, this.y, this._tx, this._ty, map, player);
  if (!targetTile) {
    // No valid placement (e.g. line is solid wall, player is in the
    // tile we'd pick). Brief retry interval.
    this._aIdle = ARCHITECT_IDLE_BASE * 0.4;
    return;
  }
  this._aTarget = targetTile;
  this._aState = 'target';
  this._aTele = ARCHITECT_TARGET_TIME;
  if (audio.architectTarget) audio.architectTarget();
};
