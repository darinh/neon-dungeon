'use strict';
// @ts-check

// ─── CRYOPHAGE AI — Frost-Patch Layer (area denial) ────────────────────
// Slow walker (spd=1.0) that periodically commits to a frost lattice
// anchored on the player's CURRENT tile at lock-time. Telegraphs a 5-tile
// cyan + glyph (centre tile + 4 cardinals) for CRYOPHAGE_TELEGRAPH
// seconds, then commits — patches persist for CRYOPHAGE_PATCH_LIFE
// seconds and damage the player on entry (per-patch ICD), with dash
// i-frames as the canonical pass-through.
//
// Niche: punishes camping / standing still. Distinct from PROPHET
// (predicted future point) and ECHOER (historical position) — CRYOPHAGE
// freezes wherever you ARE the moment it locks. Counter-play is to leave
// the centre tile during the telegraph window and route around the
// patches afterwards. If trapped, dash through (canonical answer).
//
// Patches are global (`frostPatches`) and survive the cryophage's death
// — committed denial. They are cleared on floor transition (game.js
// loadFloor — same place _posHistory resets).
//
// Hologram-taunt: when a taunt is active, lock the decoy's tile (the
// canonical _tx/_ty already reflects this). Patches commit at the
// decoy's location, denying the area the player was trying to lure
// the cryophage toward — the bait costs you positional control too.
//
// States:
//   idle:   _cyCooldown ticks. When room-gated, in range, and LoS holds,
//           snap to the target tile and enter aiming.
//   aiming: _cyAimTimer counts down; cyan + telegraph rendered. On 0,
//           commit 5 frostPatches and reset to idle with full cooldown.
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

  // Room-gated: only engage when target or player is inside this cryophage's room.
  const inRoom = this.room && (
    (this._tx >= this.room.x && this._tx < this.room.x + this.room.w &&
     this._ty >= this.room.y && this._ty < this.room.y + this.room.h) ||
    (player.x >= this.room.x && player.x < this.room.x + this.room.w &&
     player.y >= this.room.y && player.y < this.room.y + this.room.h));

  // ── Aiming: telegraph window, then commit patches ──
  if (this._cyState === 'aiming') {
    this._cyAimTimer -= dt; // fixed-rate countdown — fairness > tempo

    if (this._cyAimTimer <= 0) {
      // COMMIT: spawn patches on the pre-filtered tile list locked at
      // the start of the telegraph window. Each patch is independent
      // (its own ICD, life, dead flag) so a patch destroyed early
      // doesn't affect the others. Geometry is FROZEN at lock time —
      // the player's mid-telegraph movement does NOT relocate the
      // lattice (that's the whole anti-camping niche).
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

    // While aiming, drift slightly toward the player so a kited cryophage
    // doesn't get stuck on geometry. Half-speed during telegraph.
    if (this._canTarget()) {
      const [bx, by] = norm(this._tx - this.x, this._ty - this.y);
      this.moveToward(this.x + bx * 4, this.y + by * 4, this.spd * 0.5, dt, map);
    }
    return;
  }

  // ── Idle: try to lock when conditions allow ──
  if (this._cyCooldown <= 0 && inRoom && this._canTarget()) {
    // Lock onto the player's CURRENT tile (canonical _tx/_ty handles
    // taunt redirection — the decoy's tile becomes the lock if active).
    // Snap to tile centres so the + lattice aligns with the grid.
    const lockX = Math.floor(this._tx) + 0.5;
    const lockY = Math.floor(this._ty) + 0.5;
    const dLock = dist(this.x, this.y, lockX, lockY);
    if (dLock < CRYOPHAGE_RANGE && hasLOS(this.x, this.y, lockX, lockY, map)) {
      // Pre-filter the lattice tiles ONCE at lock time. The same list
      // is consumed by both the draw branch (telegraph glyphs) and the
      // commit block (patch spawn) so the player's "what I see is what
      // commits" contract holds — wall tiles never render a warning,
      // and out-of-bounds coordinates never sneak past a missing
      // map[ty] guard. (Both gaps caught by adversarial review.)
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
        // Bounds check FIRST — rejects negative or beyond-extent tiles.
        if (!map || ty < 0 || tx < 0 || !map[ty] || map[ty][tx] === undefined) continue;
        if (typeof isPassable === 'function' && !isPassable(map[ty][tx])) continue;
        tiles.push(t);
      }
      // If everything filtered (e.g. cryophage lined up against a wall
      // corner with the player on a non-existent tile), abort the lock
      // entirely — telegraphing zero patches just wastes the cooldown
      // and confuses the player.
      if (tiles.length === 0) {
        this._cyCooldown = 0.6; // short retry — try again soon
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

  // No lock available: chase the player at base speed (out of range or
  // no LoS — the slow walker has to close the gap before it can lock).
  if (inRoom && this._canTarget()) {
    this.moveToward(this._tx, this._ty, this.spd, dt, map);
  } else if (!inRoom) {
    this.patrol(dt, map);
  }
};
