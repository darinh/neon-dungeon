// @ts-check
'use strict';

// Fuse bombs are loaded after src/entities.js so this subsystem can reuse
// entities globals such as _EG and enemies while still publishing the legacy
// script-tag globals consumed by Player, render.js, and game.js.

/** @type {any[]} */ const fuseShards = [];

// ─── Fuse Bomb (tap-tap V) ───────────────────────────────────────────────────
// FuseShard replaces the old consumable VOID_SHARD detonation. Players tap V
// to drop one at their feet (3s telegraph: slow→fast→rapid flash), then tap V
// again to detonate ALL active fuses early (panic mode). Bombs are infinite,
// gated by BOMB_DROP_COOLDOWN to prevent literal spam without limiting
// strategic chains. Wall-shatter + secret-room reveal logic preserved from the
// original useVoidShard.
const FUSE_DURATION       = 3.0;   // seconds from drop to auto-detonate
const FUSE_PHASE_FAST     = 1.5;   // s remaining when flash speeds up
const FUSE_PHASE_RAPID    = 0.5;   // s remaining when flash goes rapid
const FUSE_FLASH_SLOW     = 0.50;  // toggle period in slow phase (s)
const FUSE_FLASH_FAST     = 0.20;  // toggle period in fast phase (s)
const FUSE_FLASH_RAPID    = 0.08;  // toggle period in rapid phase (s)
const BOMB_DROP_COOLDOWN  = 1.0;   // min seconds between drops
const BOMB_BLAST_RADIUS   = 6;     // tiles (matches old useVoidShard)
const BOMB_DAMAGE         = 80;    // matches old useVoidShard

class FuseShard {
  /**
   * @param {number} x
   * @param {number} y
   */
  constructor(x, y) {
    this.x = x; this.y = y;
    this.fuseTime = FUSE_DURATION;
    this.dead = false;
    this._elapsed = 0;
  }
  /**
   * @param {number} dt
   */
  update(dt) {
    if (this.dead) return;
    this.fuseTime -= dt;
    this._elapsed += dt;
    if (this.fuseTime <= 0) this.detonate();
  }
  detonate() {
    if (this.dead) return;
    this.dead = true;
    _detonateBombAt(this.x, this.y);
  }
  /**
   * @param {number} camX
   * @param {number} camY
   */
  draw(camX, camY) {
    if (this.dead) return;
    // camX/camY are pixel-space (see getCamera in render.js); world->screen
    // is `pos * TILE - cam`, matching every other draw* in this file
    // (drawMines, drawCameras, drawWallTurrets, ...). The earlier
    // `(pos - cam) * TILE` form treated cam as tile-space, which placed the
    // bomb thousands of pixels off-screen so it was never visible.
    const sx = this.x * TILE - camX;
    const sy = this.y * TILE - camY;
    const remaining = this.fuseTime;
    let period;
    if (remaining > FUSE_PHASE_FAST) period = FUSE_FLASH_SLOW;
    else if (remaining > FUSE_PHASE_RAPID) period = FUSE_FLASH_FAST;
    else period = FUSE_FLASH_RAPID;
    const on = (Math.floor(this._elapsed / period) % 2) === 0;
    ctx.save();
    ctx.shadowBlur = on ? 18 : 6;
    ctx.shadowColor = '#aa00ff';
    ctx.fillStyle = on ? '#ff66ff' : '#aa00ff';
    NEON.draw.circle(ctx, sx, sy, 7);
    ctx.fillStyle = on ? '#ffffff' : '#cc44cc';
    NEON.draw.circle(ctx, sx, sy, 3);
    ctx.restore();
  }
}

/**
 * Bomb detonation: damage mobs in radius, shatter cracked walls, reveal
 * adjacent secret rooms. Called by FuseShard.detonate() (auto-fuse expiry or
 * panic-tap). Mirrors old useVoidShard's side-effects exactly.
 * @param {number} x
 * @param {number} y
 */
function _detonateBombAt(x, y) {
  const map = _EG.dungeon && _EG.dungeon.map;
  for (const e of enemies) {
    if (!e.dead && !e._wrPhased && map &&
        dist(x, y, e.x, e.y) < BOMB_BLAST_RADIUS &&
        hasLOS(x, y, e.x, e.y, map)) {
      e.takeDamage(BOMB_DAMAGE, 'Bomb');
    }
  }
  spawnParticles(x, y, 'EXPLOSION', '#aa00ff', 30);
  triggerShake(10, 0.3);
  let wallsBroken = 0;
  if (map) {
    const cx = Math.floor(x), cy = Math.floor(y);
    const R = BOMB_BLAST_RADIUS;
    const x0 = Math.max(0, cx - R), x1 = Math.min(MAP_W - 1, cx + R);
    const y0 = Math.max(0, cy - R), y1 = Math.min(MAP_H - 1, cy + R);
    for (let ty = y0; ty <= y1; ty++) {
      const row = map[ty]; if (!row) continue;
      for (let tx = x0; tx <= x1; tx++) {
        if (row[tx] !== T.CRACKED) continue;
        if (dist(x, y, tx + 0.5, ty + 0.5) >= R) continue;
        if (!hasLOS(x, y, tx + 0.5, ty + 0.5, map)) continue;
        row[tx] = T.FLOOR;
        wallsBroken++;
        spawnParticles(tx + 0.5, ty + 0.5, 'EXPLOSION', '#ffb700', 12);
        if (_EG.dungeon && Array.isArray(_EG.dungeon.secretRooms)) {
          for (const sr of _EG.dungeon.secretRooms) {
            if (sr.secretRevealed) continue;
            if (tx >= sr.x - 1 && tx <= sr.x + sr.w && ty >= sr.y - 1 && ty <= sr.y + sr.h) {
              if (typeof _EG.revealSecretRoom === 'function') _EG.revealSecretRoom(sr);
              break;
            }
          }
        }
      }
    }
    if (wallsBroken > 0) {
      if (typeof _EG.markMapMutated === 'function') _EG.markMapMutated();
      audio.wallBreak();
    }
  }
  if (wallsBroken > 0) {
    _EG.msg('BOMB DETONATED — ' + wallsBroken + ' wall' + (wallsBroken > 1 ? 's' : '') + ' shattered!', '#ffb700');
  } else {
    _EG.msg('BOMB DETONATED!', '#aa00ff');
  }
}

/**
 * Per-frame update + dead-bomb prune. Called from game.js update loop.
 * @param {number} dt
 */
function updateFuseShards(dt) {
  for (const fs of fuseShards) fs.update(dt);
  for (let i = fuseShards.length - 1; i >= 0; i--) {
    if (fuseShards[i].dead) fuseShards.splice(i, 1);
  }
}

/**
 * Per-frame draw. Called from game.js render loop, drawn between items and
 * enemies so the bomb is visible above ground but obscured by mobs (so a
 * planted bomb under a charging enemy still looks "in the world").
 * @param {number} camX
 * @param {number} camY
 */
function drawFuseShards(camX, camY) {
  for (const fs of fuseShards) fs.draw(camX, camY);
}

function clearFuseShards() { fuseShards.length = 0; }
