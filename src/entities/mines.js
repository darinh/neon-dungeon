// @ts-check
'use strict';

// Proximity mines load after src/entities.js so they can reuse shared actor
// collections and publish the legacy globals used by generation, projectiles,
// explosions, game updates, and rendering.

// ─── Proximity Mines ──────────────────────────────────────────────────────────
const MINE_TRIGGER_RADIUS = 0.9;  // proximity trigger
const MINE_REVEAL_RADIUS  = 3.0;  // visible shimmer
const MINE_BLAST_RADIUS   = 2.0;
const MINE_FUSE_NORMAL    = 0.8;  // walked-into fuse
const MINE_FUSE_SHOT      = 0.3;  // shot-by-projectile fuse

/**
 * @param {any} [x]
 * @param {any} [y]
 * @param {any} [floor]
 * @param {any} [room]
 */
function createMine(x, y, floor, room) {
  const dmg = 12 + floor * 3;
  return { x, y, dmg, state: 'dormant', fuse: 0, revealed: false, dead: false,
           room, floor, bob: rand('cosmetic') * TWO_PI, flash: 0 };
}

/**
 * @param {any} [m]
 * @param {any} [fuseTime]
 */
function armMine(m, fuseTime) {
  if (!m || m.dead || m.state !== 'dormant') return;
  m.state = 'armed';
  m.fuse = fuseTime;
  audio.mineArm();
}

/**
 * @param {any} [m]
 */
function detonateMine(m) {
  if (!m || m.dead) return;
  m.dead = true;
  m.state = 'detonated';
  const r = MINE_BLAST_RADIUS;
  const map = _EG.dungeon.map;
  spawnParticles(m.x, m.y, 'EXPLOSION', '#ff8800', 18);
  spawnParticles(m.x, m.y, 'EXPLOSION', '#ffcc44', 8);
  triggerShake(6, 0.2);
  audio.mineExplode();
  // Damage enemies (LOS-gated)
  for (const e of enemies) {
    if (e.dead) continue;
    if (dist(e.x, e.y, m.x, m.y) < r && hasLOS(m.x, m.y, e.x, e.y, map)) {
      e.takeDamage(m.dmg, 'Proximity Mine');
    }
  }
  // Damage player (environmental — bypasses defense)
  const p = _EG.player;
  if (dist(p.x, p.y, m.x, m.y) < r && !isPlayerDamageImmune() && hasLOS(m.x, m.y, p.x, p.y, map)) {
    p.takeDamage(m.dmg, 'Proximity Mine', { ignoreDefense: true });
  }
  // Chain to nearby mines (staggered fuse for cascade effect)
  triggerMinesInRadius(m.x, m.y, r, map);
  // Chain to volatile cores
  primeVCoresInRadius(m.x, m.y, r, map);
  // Damage nearby crates
  damageCratesInRadius(m.x, m.y, r, m.dmg, map);
  // Damage nearby beacons
  damageBeaconsInRadius(m.x, m.y, r, m.dmg, map);
  // Damage nearby shield generators
  damageShieldGensInRadius(m.x, m.y, r, m.dmg, map);
  // Damage nearby cameras
  damageCamerasInRadius(m.x, m.y, r, m.dmg, map);
  // Damage nearby laser tripwire emitters
  damageLasersInRadius(m.x, m.y, r, m.dmg, map);
  // Damage nearby wall turrets
  damageWallTurretsInRadius(m.x, m.y, r, m.dmg, map);
  // Remove from array
  const idx = mines.indexOf(m);
  if (idx >= 0) mines.splice(idx, 1);
}

/**
 * @param {any} [wx]
 * @param {any} [wy]
 * @param {any} [radius]
 * @param {any} [map]
 */
function triggerMinesInRadius(wx, wy, radius, map) {
  for (const m of mines) {
    if (m.dead || m.state !== 'dormant') continue;
    if (dist(wx, wy, m.x, m.y) < radius && hasLOS(wx, wy, m.x, m.y, map)) {
      m.state = 'armed';
      m.fuse = 0.1 + rand('combat') * 0.15; // stagger for cascade
      // No arm SFX for chain — the explosion is the feedback
    }
  }
}

/**
 * @param {any} [dt]
 */
function updateMines(dt) {
  const p = _EG.player;
  for (let i = mines.length - 1; i >= 0; i--) {
    const m = mines[i];
    if (m.dead) continue;
    m.bob += dt * 2;

    // Reveal when player is nearby (persistent for the floor)
    if (!m.revealed && dist(p.x, p.y, m.x, m.y) < MINE_REVEAL_RADIUS) {
      m.revealed = true;
    }

    if (m.state === 'dormant') {
      // Check proximity trigger — player
      if (dist(p.x, p.y, m.x, m.y) < MINE_TRIGGER_RADIUS) {
        armMine(m, MINE_FUSE_NORMAL);
      }
      // Check proximity trigger — enemies
      if (m.state === 'dormant') {
        for (const e of enemies) {
          if (e.dead) continue;
          if (dist(e.x, e.y, m.x, m.y) < MINE_TRIGGER_RADIUS) {
            armMine(m, MINE_FUSE_NORMAL);
            break;
          }
        }
      }
    } else if (m.state === 'armed') {
      m.fuse -= dt;
      m.flash += dt * 20;
      if (m.fuse <= 0) {
        detonateMine(m);
      }
    }
  }
}

/**
 * @param {any} [camX]
 * @param {any} [camY]
 */
function drawMines(camX, camY) {
  for (const m of mines) {
    if (m.dead) continue;
    const tx = Math.floor(m.x), ty = Math.floor(m.y);
    if (!_EG.dungeon?.visible?.[ty]?.[tx]) continue;
    const sx = m.x * TILE - camX, sy = m.y * TILE - camY;
    ctx.save();

    if (m.state === 'armed') {
      // Armed: rapid red flash + expanding ring
      const flashAlpha = 0.6 + 0.4 * Math.sin(m.flash);
      ctx.globalAlpha = flashAlpha;
      ctx.fillStyle = '#ff2200';
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#ff4400';
      NEON.draw.circle(ctx, sx, sy, 6);
      // Expanding warning ring
      const ringR = 6 + (1 - m.fuse / MINE_FUSE_NORMAL) * 12;
      ctx.globalAlpha = Math.max(0, flashAlpha * 0.5);
      ctx.strokeStyle = '#ff4400';
      ctx.lineWidth = 1.5;
      NEON.draw.circleStroke(ctx, sx, sy, ringR);
    } else if (m.revealed) {
      // Revealed: visible orange hazard shimmer
      const pulse = 0.3 + 0.2 * Math.sin(m.bob * 1.5);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#ff8800';
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#ff6600';
      NEON.draw.circle(ctx, sx, sy, 4);
      // Small hazard indicator
      ctx.globalAlpha = pulse * 0.5;
      ctx.strokeStyle = '#ff8800';
      ctx.lineWidth = 1;
      NEON.draw.circleStroke(ctx, sx, sy, 7);
    } else {
      // Dormant: very subtle shimmer (attentive players can spot)
      const pulse = 0.08 + 0.05 * Math.sin(m.bob);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#ff6600';
      NEON.draw.circle(ctx, sx, sy, 3);
    }

    ctx.restore();
  }
}
