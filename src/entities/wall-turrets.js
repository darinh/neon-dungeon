// @ts-check
'use strict';

// Wall turrets load after src/entities.js so they can reuse shared combat,
// projectile, room-index, and wall-facing globals while preserving legacy APIs.

// ─── Wall Turrets ─────────────────────────────────────────────────────────────
const WTURRET_RANGE_HOSTILE = 6;
const WTURRET_RANGE_HACKED  = 7;
const WTURRET_COOLDOWN_HOSTILE = 1.8;
const WTURRET_COOLDOWN_HACKED  = 1.5;
const WTURRET_PROJ_SPD = 7;
const WTURRET_PROJ_RANGE = 10;
const WTURRET_DISABLE_DUR = 3; // EMP disable duration (before hack)

/**
 * @param {any} [x]
 * @param {any} [y]
 * @param {any} [floor]
 * @param {any} [room]
 * @param {any} [wallSide]
 */
function createWallTurret(x, y, floor, room, wallSide) {
  const maxHp = 12 + floor * 3;
  return {
    x, y, hp: maxHp, maxHp, dead: false,
    hacked: false,
    room, floor, wallSide,
    baseAngle: WALL_FACING[wallSide],
    scanAngle: WALL_FACING[wallSide], scanDir: 1,
    shootTimer: 1.0 + rand('spawn'), // stagger first shots
    disabled: false, disableTimer: 0,
    bob: rand('cosmetic') * TWO_PI,
    hackFlash: 0, // brief glow on hack
  };
}

function wallTurretDmg(/** @type {any} */ floor) { return Math.round(5 + floor * 1.5); }

/**
 * @param {any} [t]
 * @param {any} [dmg]
 */
function damageWallTurret(t, dmg) {
  if (!t || t.dead) return;
  t.hp -= dmg;
  if (t.hp <= 0) destroyWallTurret(t);
  else spawnParticles(t.x, t.y, 'SPARK', t.hacked ? '#00ffaa' : '#ff4400', 4);
}

/**
 * @param {any} [t]
 */
function destroyWallTurret(t) {
  t.dead = true;
  spawnParticles(t.x, t.y, 'EXPLOSION', '#ff6622', 14);
  spawnParticles(t.x, t.y, 'SPARK', '#ff8844', 8);
  audio.turretDestroy();
  const d = getDiff();
  const amt = Math.round(_EG.floor * 3 * getMetaCreditMultiplier() * d.creditMul * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
  _EG.player.credits += amt;
  spawnDmgText(t.x, t.y - 0.3, '+' + amt + '◈', '#ff6622');
  const idx = wallTurrets.indexOf(t);
  if (idx >= 0) wallTurrets.splice(idx, 1);
  _EG.enemyDiedThisFrame = true; // re-evaluate room-clear
}

/**
 * @param {any} [t]
 */
function hackWallTurret(t) {
  if (!t || t.dead || t.hacked) return;
  t.hacked = true;
  t.shootTimer = 0.5; // quick first allied shot
  t.hackFlash = 0.6;
  spawnParticles(t.x, t.y, 'SPARK', '#00ffaa', 10);
  spawnDmgText(t.x, t.y - 0.3, '◇ HACKED', '#00ffaa');
  audio.turretHack();
  _EG.enemyDiedThisFrame = true; // re-evaluate room-clear (was blocking)
}

/**
 * @param {any} [wx]
 * @param {any} [wy]
 * @param {any} [radius]
 * @param {any} [dmg]
 * @param {any} [map]
 */
function damageWallTurretsInRadius(wx, wy, radius, dmg, map) {
  for (let i = wallTurrets.length - 1; i >= 0; i--) {
    const t = wallTurrets[i];
    if (t.dead) continue;
    if (dist(wx, wy, t.x, t.y) < radius && hasLOS(wx, wy, t.x, t.y, map)) {
      damageWallTurret(t, dmg);
    }
  }
}

/**
 * @param {any} [dt]
 */
function updateWallTurrets(dt) {
  const p = _EG.player;
  const map = _EG.dungeon?.map;
  if (!map) return;
  for (let i = wallTurrets.length - 1; i >= 0; i--) {
    const t = wallTurrets[i];
    if (t.dead) continue;
    t.bob += dt * 2;
    if (t.hackFlash > 0) t.hackFlash -= dt;

    // Disabled (EMP'd before hack)
    if (t.disabled) {
      t.disableTimer -= dt;
      if (t.disableTimer <= 0) t.disabled = false;
      continue;
    }

    t.shootTimer -= dt;
    const dmg = wallTurretDmg(t.floor);

    if (t.hacked) {
      // ── Allied: target nearest visible enemy in room ──
      const r = t.room;
      let best = null, bestD = Infinity;
      for (const e of enemiesInRoomIter(r)) {
        if (e.dead || e.isBoss || e._disguised) continue;
        if (e._wrPhased) continue;
        const d = dist(t.x, t.y, e.x, e.y);
        if (d < WTURRET_RANGE_HACKED && d < bestD && hasLOS(t.x, t.y, e.x, e.y, map)) {
          best = e; bestD = d;
        }
      }
      if (best) {
        // Track toward target
        const aimAngle = Math.atan2(best.y - t.y, best.x - t.x);
        t.scanAngle = aimAngle;
        if (t.shootTimer <= 0) {
          const [dx, dy] = norm(best.x - t.x, best.y - t.y);
          const proj = new Projectile(t.x, t.y, dx, dy, WTURRET_PROJ_SPD, dmg, WTURRET_PROJ_RANGE, '#00ffaa', false, false);
          proj.isAllyTurret = true;
          proj.ownerType = 'Wall Turret';
          projectiles.push(proj);
          audio.turretFire();
          t.shootTimer = WTURRET_COOLDOWN_HACKED;
        }
      } else {
        // No target — slow sweep
        t.scanAngle += 0.8 * t.scanDir * dt;
        const halfSweep = Math.PI / 3;
        if (t.scanAngle > t.baseAngle + halfSweep) { t.scanAngle = t.baseAngle + halfSweep; t.scanDir = -1; }
        if (t.scanAngle < t.baseAngle - halfSweep) { t.scanAngle = t.baseAngle - halfSweep; t.scanDir = 1; }
      }
    } else {
      // ── Hostile: target player ──
      const d = dist(t.x, t.y, p.x, p.y);
      if (d < WTURRET_RANGE_HOSTILE && canTargetPlayer() && hasLOS(t.x, t.y, p.x, p.y, map)) {
        const aimAngle = Math.atan2(p.y - t.y, p.x - t.x);
        t.scanAngle = aimAngle;
        if (t.shootTimer <= 0) {
          const [dx, dy] = norm(p.x - t.x, p.y - t.y);
          const proj = new Projectile(t.x, t.y, dx, dy, WTURRET_PROJ_SPD, dmg, WTURRET_PROJ_RANGE, '#ff4400', false, false);
          proj.ownerType = 'Wall Turret';
          projectiles.push(proj);
          audio.turretFire();
          t.shootTimer = WTURRET_COOLDOWN_HOSTILE;
        }
      } else {
        // No target — slow sweep around base angle
        t.scanAngle += 0.6 * t.scanDir * dt;
        const halfSweep = Math.PI / 3;
        if (t.scanAngle > t.baseAngle + halfSweep) { t.scanAngle = t.baseAngle + halfSweep; t.scanDir = -1; }
        if (t.scanAngle < t.baseAngle - halfSweep) { t.scanAngle = t.baseAngle - halfSweep; t.scanDir = 1; }
      }
    }
  }
}

/**
 * @param {any} [camX]
 * @param {any} [camY]
 */
function drawWallTurrets(camX, camY) {
  for (const t of wallTurrets) {
    if (t.dead) continue;
    const tx = Math.floor(t.x), ty = Math.floor(t.y);
    if (!_EG.dungeon?.visible?.[ty]?.[tx]) continue;
    const sx = t.x * TILE - camX, sy = t.y * TILE - camY;
    const isHacked = t.hacked;
    const mainCol = t.disabled ? '#555555' : (isHacked ? '#00ffaa' : '#ff4400');
    const glowCol = t.disabled ? '#333333' : (isHacked ? '#00cc88' : '#cc3300');
    const pulse = 0.6 + 0.3 * Math.sin(t.bob * 1.5);

    ctx.save();

    // Hack flash overlay
    if (t.hackFlash > 0) {
      ctx.globalAlpha = t.hackFlash;
      ctx.fillStyle = '#00ffaa';
      ctx.shadowBlur = 20; ctx.shadowColor = '#00ffaa';
      NEON.draw.circle(ctx, sx, sy, 10);
      ctx.shadowBlur = 0;
    }

    // Wall mount base (small rectangle against wall)
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#334455';
    const ws = t.wallSide;
    const bw = 8, bh = 4;
    if (ws === 'N') ctx.fillRect(sx - bw / 2, sy - bh - 2, bw, bh);
    else if (ws === 'S') ctx.fillRect(sx - bw / 2, sy + 2, bw, bh);
    else if (ws === 'W') ctx.fillRect(sx - bh - 2, sy - bw / 2, bh, bw);
    else ctx.fillRect(sx + 2, sy - bw / 2, bh, bw);

    // Barrel — rotates to scanAngle
    ctx.globalAlpha = pulse;
    ctx.translate(sx, sy);
    ctx.rotate(t.scanAngle);
    // Barrel body
    ctx.fillStyle = mainCol;
    ctx.shadowBlur = 6; ctx.shadowColor = glowCol;
    ctx.fillRect(0, -2.5, 8, 5);
    // Muzzle flash hint
    ctx.fillStyle = glowCol;
    ctx.fillRect(7, -1.5, 3, 3);
    ctx.shadowBlur = 0;
    // Base pivot
    ctx.fillStyle = '#556677';
    NEON.draw.circle(ctx, 0, 0, 3);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // HP bar (when damaged)
    if (t.hp < t.maxHp) {
      const bw2 = 14, bh2 = 2;
      const hpFrac = t.hp / t.maxHp;
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#111'; ctx.fillRect(sx - bw2 / 2, sy - 10, bw2, bh2);
      ctx.fillStyle = isHacked ? '#00ffaa' : '#ff4400';
      ctx.fillRect(sx - bw2 / 2, sy - 10, bw2 * hpFrac, bh2);
    }

    ctx.restore();
  }
}
