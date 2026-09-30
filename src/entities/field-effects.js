// @ts-check
'use strict';

/** @type {any[]} */ const disruptionFields = [];
/** @type {any[]} */ const gravityWells = [];
// Frost patches survive the mob that placed them and are cleared in game.js loadFloor (same site as _posHistory).
// Damage uses dash-through immunity (isPlayerDamageImmune).
/** @type {any[]} */ const frostPatches = [];

/**
 * @param {any} [dt]
 * @param {any} [player]
 */
function updateDisruptionFields(dt, player) {
  player.disruptionFieldActive = false;
  for (let i = disruptionFields.length - 1; i >= 0; i--) {
    const f = disruptionFields[i];
    f.age += dt;
    if (f.dead || f.age >= f.maxAge) { f.dead = true; disruptionFields.splice(i, 1); continue; }
    f.tickCd = Math.max(0, f.tickCd - dt);
    if (dist(player.x, player.y, f.x, f.y) < f.radius && !isPlayerDamageImmune()) {
      player.disruptionFieldActive = true;
      if (f.tickCd <= 0) {
        const dps = (3 + (_EG.floor || 1) * 0.5) * getDiff().envDmg;
        const tickDmg = Math.round(dps * 0.5); // 0.5s interval
        player.takeDamage(tickDmg, 'Disruption Field', {
          ignoreInvincible: true,
          ignoreDefense: true,
          skipHitInvincible: true,
          skipHitEffects: true,
          skipReactiveArmor: true,
        });
        f.tickCd = 0.5;
        spawnParticles(player.x, player.y, 'SPARK', '#ff44aa', 3);
        audio.disruptorField();
      }
    }
  }
}

/**
 * @param {any} [camX]
 * @param {any} [camY]
 */
function drawDisruptionFields(camX, camY) {
  for (const f of disruptionFields) {
    const sx = f.x * TILE - camX, sy = f.y * TILE - camY;
    const r = f.radius * TILE;
    const fade = 1 - (f.age / f.maxAge);
    const pulse = 0.5 + 0.3 * Math.sin(f.age * 5);

    ctx.save();
    ctx.globalAlpha = fade * pulse * 0.25;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    grad.addColorStop(0, 'rgba(255,68,170,0.4)');
    grad.addColorStop(0.7, 'rgba(255,68,170,0.15)');
    grad.addColorStop(1, 'rgba(255,68,170,0)');
    ctx.fillStyle = grad;
    NEON.draw.circle(ctx, sx, sy, r);

    ctx.globalAlpha = fade * pulse * 0.5;
    ctx.strokeStyle = '#ff44aa';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ff44aa';
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -f.age * 30;
    NEON.draw.circleStroke(ctx, sx, sy, r);
    ctx.setLineDash([]);

    ctx.globalAlpha = fade * 0.15;
    ctx.strokeStyle = '#ff88cc';
    ctx.lineWidth = 1;
    for (let j = 0; j < 4; j++) {
      const a = f.age * 3 + j * 1.57;
      const lr = r * (0.3 + 0.4 * Math.sin(a * 2));
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(a) * lr * 0.3, sy + Math.sin(a) * lr * 0.3);
      ctx.lineTo(sx + Math.cos(a) * lr, sy + Math.sin(a) * lr);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// player.update skips the hackwareCooldown tick while hackwareJammed is set; it reads the previous environment update's value because updateNullifierJam runs later in game.js.
// activateHackware in src/content/hackware.js calls isPlayerInNullifierAura directly so same-update activation cannot use the stale cache.
// Iterate live NULLIFIERs: the aura ends with the mob. Stun and any isPlayerDamageImmune state suppress the jam.
// An active jam blocks hackware activation; a cloak or other immunity established before entry suppresses the aura check.
// There is no room or LOS gate, so a nearby NULLIFIER can jam through walls; floor transitions clear the enemy list.
/**
 * @param {any} player
 * @returns {boolean}
 */
function isPlayerInNullifierAura(player) {
  if (!player) return false;
  if (isPlayerDamageImmune()) return false;
  const r2 = NULLIFIER_FIELD_R * NULLIFIER_FIELD_R;
  const px = player.x, py = player.y;
  for (const e of enemies) {
    if (!e || e.dead) continue;
    if (e.type !== 'NULLIFIER') continue;
    if (e.stunTimer && e.stunTimer > 0) continue;
    const vx = e.x - px, vy = e.y - py;
    if (vx * vx + vy * vy < r2) return true;
  }
  return false;
}

/**
 * @param {any} [dt]
 * @param {any} [player]
 */
function updateNullifierJam(dt, player) {
  void dt;
  player.hackwareJammed = isPlayerInNullifierAura(player);
}


/**
 * @param {any} [dt]
 * @param {any} [player]
 */
function updateFrostPatches(dt, player) {
  for (let i = frostPatches.length - 1; i >= 0; i--) {
    const f = frostPatches[i];
    f.age += dt;
    if (f.dead || f.age >= f.maxAge) {
      f.dead = true;
      frostPatches.splice(i, 1);
      continue;
    }
    f.tickCd = Math.max(0, f.tickCd - dt);
    if (dist(player.x, player.y, f.x, f.y) < CRYOPHAGE_PATCH_RADIUS && !isPlayerDamageImmune()) {
      if (f.tickCd <= 0) {
        const fdmg = f.dmg * (hasAugment('BIOFILTER') ? 0.5 : 1);
        player.takeDamage(fdmg, 'Frost Patch', {
          ignoreInvincible: true,
          ignoreDefense: true,
          skipHitInvincible: true,
          skipHitEffects: true,
          skipReactiveArmor: true,
        });
        f.tickCd = CRYOPHAGE_TICK_ICD;
        spawnParticles(player.x, player.y, 'SPARK', '#88ddff', 3);
      }
    }
  }
}

/**
 * @param {any} [camX]
 * @param {any} [camY]
 */
function drawFrostPatches(camX, camY) {
  for (const f of frostPatches) {
    if (f.dead) continue;
    // FOV-cull each patch so hazards do not render through hidden tiles.
    // Damage ticking is independent of visibility.
    const tx = Math.floor(f.x), ty = Math.floor(f.y);
    if (!_EG.dungeon?.visible?.[ty]?.[tx]) continue;
    const sx = f.x * TILE - camX, sy = f.y * TILE - camY;
    const life = 1 - (f.age / f.maxAge);
    const pulse = 0.5 + 0.3 * Math.sin(f.age * 6);
    const r = TILE * 0.42;

    ctx.save();
    ctx.globalAlpha = life * (0.20 + pulse * 0.10);
    ctx.fillStyle = '#88ddff';
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#cceeff';
    ctx.fillRect(sx - r, sy - r, r * 2, r * 2);

    ctx.globalAlpha = life * (0.5 + pulse * 0.3);
    ctx.strokeStyle = '#cceeff';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(sx - r, sy - r, r * 2, r * 2);

    ctx.globalAlpha = life * 0.4;
    ctx.strokeStyle = '#aaeeff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - r * 0.6, sy); ctx.lineTo(sx + r * 0.6, sy);
    ctx.moveTo(sx, sy - r * 0.6); ctx.lineTo(sx, sy + r * 0.6);
    ctx.stroke();

    ctx.restore();
  }
}

/**
 * @param {any} [dt]
 */
function updateGravityWells(dt) {
  for (let i = gravityWells.length - 1; i >= 0; i--) {
    const w = gravityWells[i];
    w.timer += dt;
    if (w.dead || w.timer >= w.maxTimer) {
      w.dead = true;
      gravityWells.splice(i, 1);
      continue;
    }
  }
}

/**
 * @param {any} [camX]
 * @param {any} [camY]
 */
function drawGravityWells(camX, camY) {
  for (const w of gravityWells) {
    if (w.dead) continue;
    const tx = Math.floor(w.x), ty = Math.floor(w.y);
    if (!_EG.dungeon?.visible?.[ty]?.[tx]) continue;
    const sx = w.x * TILE - camX, sy = w.y * TILE - camY;
    const r = w.radius * TILE;
    const life = 1 - (w.timer / w.maxTimer);
    const pulse = 0.5 + 0.3 * Math.sin(w.timer * 6);

    ctx.save();

    ctx.globalAlpha = life * pulse * 0.2;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    grad.addColorStop(0, 'rgba(136,51,255,0.5)');
    grad.addColorStop(0.6, 'rgba(136,51,255,0.2)');
    grad.addColorStop(1, 'rgba(136,51,255,0)');
    ctx.fillStyle = grad;
    NEON.draw.circle(ctx, sx, sy, r);

    ctx.globalAlpha = life * pulse * 0.4;
    ctx.strokeStyle = '#aa55ff';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#8833ff';
    ctx.lineWidth = 1.5;
    for (let ring = 0; ring < 3; ring++) {
      const phase = (w.timer * 2 + ring * 0.33) % 1;
      const ringR = r * (1 - phase);
      ctx.globalAlpha = life * (1 - phase) * 0.35;
      NEON.draw.circleStroke(ctx, sx, sy, ringR);
    }

    ctx.globalAlpha = life * 0.4;
    ctx.fillStyle = '#cc88ff';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#8833ff';
    NEON.draw.circle(ctx, sx, sy, 3 + Math.sin(w.timer * 4) * 1.5);

    ctx.restore();
  }
}
