// @ts-check
'use strict';

// Loaded after src/entities.js. Enemy mitigation, generation, projectiles, hackware, explosions, updates, and rendering call these globals.
const SHIELD_GEN_DR = 0.35; // fraction of damage removed for enemies inside the room

/**
 * @param {any} [x]
 * @param {any} [y]
 * @param {any} [floor]
 * @param {any} [room]
 */
function createShieldGen(x, y, floor, room) {
  const maxHp = 15 + floor * 4;
  return { x, y, hp: maxHp, maxHp, dead: false, room, floor, bob: rand('cosmetic') * TWO_PI };
}

/**
 * @param {any} [g]
 * @param {any} [dmg]
 */
function damageShieldGen(g, dmg) {
  if (!g || g.dead) return;
  g.hp -= dmg;
  if (g.hp <= 0) destroyShieldGen(g);
  else spawnParticles(g.x, g.y, 'SPARK', '#00ccff', 4);
}

/**
 * @param {any} [g]
 */
function destroyShieldGen(g) {
  g.dead = true;
  spawnParticles(g.x, g.y, 'EXPLOSION', '#00ccff', 18);
  spawnParticles(g.x, g.y, 'SPARK', '#88eeff', 10);
  audio.generatorDestroy();
  const d = getDiff();
  const amt = Math.round(_EG.floor * 5 * getMetaCreditMultiplier() * d.creditMul * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
  _EG.player.credits += amt;
  spawnDmgText(g.x, g.y - 0.3, '+' + amt + '◈', '#00ccff');
  const empR = 3, empDur = 0.8, map = _EG.dungeon.map;
  for (const e of enemies) {
    if (e.dead || e.isBoss || e._disguised) continue;
    if (e._wrPhased) continue;
    if (dist(e.x, e.y, g.x, g.y) < empR && hasLOS(g.x, g.y, e.x, e.y, map)) {
      e.stunTimer = Math.max(e.stunTimer || 0, empDur);
      spawnParticles(e.x, e.y, 'SPARK', '#00ccff', 3);
      spawnDmgText(e.x, e.y, 'STUN', '#00ccff');
    }
  }
  triggerShake(4, 0.15);
  const idx = shieldGens.indexOf(g);
  if (idx >= 0) shieldGens.splice(idx, 1);
}

/**
 * @param {any} [wx]
 * @param {any} [wy]
 * @param {any} [radius]
 * @param {any} [dmg]
 * @param {any} [map]
 */
function damageShieldGensInRadius(wx, wy, radius, dmg, map) {
  for (let i = shieldGens.length - 1; i >= 0; i--) {
    const g = shieldGens[i];
    if (g.dead) continue;
    if (dist(wx, wy, g.x, g.y) < radius && hasLOS(wx, wy, g.x, g.y, map)) {
      damageShieldGen(g, dmg);
    }
  }
}

/**
 * @param {any} [e]
 */
function isEnemyShieldGenProtected(e) {
  if (e.dead || e._disguised) return false;
  for (const g of shieldGens) {
    if (g.dead) continue;
    if (e.room !== g.room) continue;
    // Spatial bounds check — enemy must be physically inside the room
    const r = g.room;
    if (e.x >= r.x && e.x < r.x + r.w && e.y >= r.y && e.y < r.y + r.h) return true;
  }
  return false;
}

/**
 * @param {any} [dt]
 */
function updateShieldGens(dt) {
  for (const g of shieldGens) {
    if (g.dead) continue;
    g.bob += dt * 2;
  }
}

/**
 * @param {any} [camX]
 * @param {any} [camY]
 */
function drawShieldGens(camX, camY) {
  for (const g of shieldGens) {
    if (g.dead) continue;
    const tx = Math.floor(g.x), ty = Math.floor(g.y);
    if (!_EG.dungeon?.visible?.[ty]?.[tx]) continue;
    const sx = g.x * TILE - camX, sy = g.y * TILE - camY;
    const pulse = 0.6 + 0.3 * Math.sin(g.bob * 2);
    const t = g.bob;

    const r = g.room;
    for (const e of enemiesInRoomIter(r)) {
      if (e.dead || e._disguised) continue;
      if (e.x < r.x || e.x >= r.x + r.w || e.y < r.y || e.y >= r.y + r.h) continue;
      const ex = e.x * TILE - camX, ey = e.y * TILE - camY;
      ctx.save();
      ctx.globalAlpha = 0.15 + 0.1 * Math.sin(t * 3 + e.x);
      ctx.strokeStyle = '#00ccff';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      NEON.draw.line(ctx, sx, sy, ex, ey);
      ctx.setLineDash([]);
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.shadowBlur = 12; ctx.shadowColor = '#00ccff';
    ctx.strokeStyle = '#00ccff'; ctx.lineWidth = 1.5;
    ctx.translate(sx, sy);
    const rot = t * 0.5;
    ctx.rotate(rot);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (TWO_PI / 6) * i;
      const hx = Math.cos(a) * 7, hy = Math.sin(a) * 7;
      if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
    }
    ctx.closePath(); ctx.stroke();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.8 + 0.2 * Math.sin(t * 4);
    ctx.shadowBlur = 8; ctx.shadowColor = '#44eeff';
    ctx.fillStyle = '#44eeff';
    NEON.draw.circle(ctx, sx, sy, 3);
    ctx.restore();

    if (g.hp < g.maxHp) {
      const bw = 16, bh = 2, bx = sx - bw / 2, by = sy - 14;
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#113'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#00ccff'; ctx.fillRect(bx, by, bw * (g.hp / g.maxHp), bh);
      ctx.restore();
    }
  }
}
