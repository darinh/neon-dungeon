// @ts-check
'use strict';

// Loaded after src/entities.js so it can use shared actor arrays, trap damage, and the globals generation, projectiles, and game call.
/**
 * @param {any} [x]
 * @param {any} [y]
 */
function createVCore(x, y) {
  return { x, y, primed: false, timer: 0, dead: false, bob: rand('cosmetic') * TWO_PI, glow: 0 };
}

/**
 * @param {any} [wx]
 * @param {any} [wy]
 * @param {any} [radius]
 * @param {any} [map]
 */
function primeVCoresInRadius(wx, wy, radius, map) {
  for (const c of vcores) {
    if (c.dead || c.primed) continue;
    if (dist(wx, wy, c.x, c.y) < radius && hasLOS(wx, wy, c.x, c.y, map)) {
      c.primed = true;
      c.timer = 0.15 + rand('combat') * 0.2; // stagger for chain cascade
      audio.corePrime();
    }
  }
}

/**
 * @param {any} [c]
 */
function detonateVCore(c) {
  c.dead = true;
  const r = 2.2;
  const dmg = 30 + _EG.floor * 3;
  const map = _EG.dungeon.map;
  spawnParticles(c.x, c.y, 'EXPLOSION', '#ff6622', 22);
  spawnParticles(c.x, c.y, 'EXPLOSION', '#ffaa00', 10);
  triggerShake(8, 0.25);
  audio.coreDetonate();
  for (const e of enemies) {
    if (e.dead) continue;
    if (dist(e.x, e.y, c.x, c.y) < r && hasLOS(c.x, c.y, e.x, e.y, map)) {
      e.takeDamage(dmg, 'Volatile Core');
    }
  }
  const p = _EG.player;
  if (dist(p.x, p.y, c.x, c.y) < r && !isPlayerDamageImmune() && hasLOS(c.x, c.y, p.x, p.y, map)) {
    p.takeDamage(dmg, 'Volatile Core');
  }
  primeVCoresInRadius(c.x, c.y, r, map);
  damageCratesInRadius(c.x, c.y, r, dmg, map);
  damageBeaconsInRadius(c.x, c.y, r, dmg, map);
  damageShieldGensInRadius(c.x, c.y, r, dmg, map);
  damageCamerasInRadius(c.x, c.y, r, dmg, map);
  damageLasersInRadius(c.x, c.y, r, dmg, map);
  damageWallTurretsInRadius(c.x, c.y, r, dmg, map);
  triggerMinesInRadius(c.x, c.y, r, map);
}

/**
 * @param {any} [dt]
 */
function updateVCores(dt) {
  for (const c of vcores) {
    if (c.dead) continue;
    c.bob += dt * 2;
    if (c.primed) {
      c.timer -= dt;
      c.glow += dt * 12;
      if (c.timer <= 0) detonateVCore(c);
    } else {
      c.glow = 0.5 + 0.3 * Math.sin(c.bob);
    }
  }
}

/**
 * @param {any} [camX]
 * @param {any} [camY]
 */
function drawVCores(camX, camY) {
  for (const c of vcores) {
    if (c.dead) continue;
    const tx = Math.floor(c.x), ty = Math.floor(c.y);
    if (!_EG.dungeon?.visible?.[ty]?.[tx]) continue;
    const sx = c.x * TILE - camX, sy = c.y * TILE - camY;
    ctx.save();
    if (c.primed) {
      const flash = Math.sin(c.glow * 3) > 0 ? 1.0 : 0.4;
      ctx.globalAlpha = flash;
      ctx.shadowBlur = 16; ctx.shadowColor = '#ff2200';
      ctx.fillStyle = '#ff3311';
      NEON.draw.circle(ctx, sx, sy, 6);
      ctx.fillStyle = '#ffcc00';
      NEON.draw.circle(ctx, sx, sy, 3);
    } else {
      ctx.globalAlpha = 0.6 + c.glow * 0.3;
      ctx.shadowBlur = 10; ctx.shadowColor = '#ff6622';
      ctx.fillStyle = '#ff6622';
      NEON.draw.circle(ctx, sx, sy, 5);
      ctx.globalAlpha = 0.9;
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffaa44';
      NEON.draw.circle(ctx, sx, sy, 2.5);
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = c.primed ? 0.9 : 0.5;
    ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('!', sx, sy - 9);
    ctx.restore();
  }
}
