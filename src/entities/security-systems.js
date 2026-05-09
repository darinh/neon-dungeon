// @ts-check
'use strict';

// Security systems load after src/entities.js so they can reuse shared actor,
// trap, and wall-facing globals while publishing the legacy camera/laser helpers.

// ─── Security Cameras ─────────────────────────────────────────────────────────
const CAMERA_CONE_HALF = Math.PI / 6;   // 30° half-angle → 60° beam
const CAMERA_SWEEP_HALF = Math.PI / 3;  // 60° half-sweep → 120° total coverage
const CAMERA_RANGE = 5;                 // tiles
const CAMERA_SWEEP_SPD = Math.PI / 4;   // 45°/s
const CAMERA_ALERT_TIME = 1.5;          // seconds before reinforcements
const CAMERA_REARM_CD = 0.5;            // debounce after losing detection

/**
 * @param {any} [x]
 * @param {any} [y]
 * @param {any} [floor]
 * @param {any} [room]
 * @param {any} [wallSide]
 */
function createCamera(x, y, floor, room, wallSide) {
  const maxHp = 12 + floor * 3;
  const baseAngle = WALL_FACING[wallSide];
  return {
    x, y, hp: maxHp, maxHp, dead: false, room, floor, wallSide,
    baseAngle,
    sweepAngle: 0, sweepDir: 1,      // current offset from base, oscillation direction
    state: 'scanning',                // scanning | alerted | triggered
    alertTimer: 0,
    rearmCd: 0,                       // debounce after returning to scanning
    bob: rand('cosmetic') * TWO_PI,
  };
}

/**
 * @param {any} [c]
 * @param {any} [dmg]
 */
function damageCamera(c, dmg) {
  if (!c || c.dead) return;
  c.hp -= dmg;
  if (c.hp <= 0) destroyCamera(c);
  else spawnParticles(c.x, c.y, 'SPARK', '#ff4444', 4);
}

/**
 * @param {any} [c]
 */
function destroyCamera(c) {
  c.dead = true;
  c.state = 'triggered'; // prevent further logic
  spawnParticles(c.x, c.y, 'EXPLOSION', '#ff4444', 14);
  spawnParticles(c.x, c.y, 'SPARK', '#ff8844', 8);
  audio.cameraDestroy();
  const d = getDiff();
  const amt = Math.round(_EG.floor * 4 * getMetaCreditMultiplier() * d.creditMul * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
  _EG.player.credits += amt;
  spawnDmgText(c.x, c.y - 0.3, '+' + amt + '◈', '#ff4444');
  const idx = cameras.indexOf(c);
  if (idx >= 0) cameras.splice(idx, 1);
  _EG.enemyDiedThisFrame = true; // re-evaluate room-clear
}

/**
 * @param {any} [wx]
 * @param {any} [wy]
 * @param {any} [radius]
 * @param {any} [dmg]
 * @param {any} [map]
 */
function damageCamerasInRadius(wx, wy, radius, dmg, map) {
  for (let i = cameras.length - 1; i >= 0; i--) {
    const c = cameras[i];
    if (c.dead) continue;
    if (dist(wx, wy, c.x, c.y) < radius && hasLOS(wx, wy, c.x, c.y, map)) {
      damageCamera(c, dmg);
    }
  }
}

// Normalize angle to [-PI, PI]
/**
 * @param {any} [a]
 */
function normalizeAngle(a) {
  while (a > Math.PI) a -= TWO_PI;
  while (a < -Math.PI) a += TWO_PI;
  return a;
}

/**
 * @param {any} [dt]
 */
function updateCameras(dt) {
  const p = _EG.player;
  const map = _EG.dungeon?.map;
  if (!map) return;
  for (let i = cameras.length - 1; i >= 0; i--) {
    const c = cameras[i];
    if (c.dead) continue;
    c.bob += dt * 2;

    // Sweep oscillation
    c.sweepAngle += CAMERA_SWEEP_SPD * c.sweepDir * dt;
    if (c.sweepAngle > CAMERA_SWEEP_HALF) { c.sweepAngle = CAMERA_SWEEP_HALF; c.sweepDir = -1; }
    if (c.sweepAngle < -CAMERA_SWEEP_HALF) { c.sweepAngle = -CAMERA_SWEEP_HALF; c.sweepDir = 1; }

    const currentAngle = c.baseAngle + c.sweepAngle;

    // Tick rearm cooldown
    if (c.rearmCd > 0) c.rearmCd -= dt;

    // Detection check: player in room, in cone, LOS, targetable
    const r = c.room;
    const inRoom = p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
    let detected = false;
    if (inRoom && canTargetPlayer()) {
      const dx = p.x - c.x, dy = p.y - c.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < CAMERA_RANGE && d > 0.1) {
        const angleToPlayer = Math.atan2(dy, dx);
        const diff = Math.abs(normalizeAngle(angleToPlayer - currentAngle));
        if (diff < CAMERA_CONE_HALF && hasLOS(c.x, c.y, p.x, p.y, map)) {
          detected = true;
        }
      }
    }

    if (c.state === 'scanning') {
      if (detected && c.rearmCd <= 0) {
        c.state = 'alerted';
        c.alertTimer = CAMERA_ALERT_TIME;
        audio.cameraDetect();
        _EG.msg('⚠ CAMERA ALERT', '#ff6644');
      }
    } else if (c.state === 'alerted') {
      if (!detected) {
        // Player left cone — return to scanning with debounce
        c.state = 'scanning';
        c.rearmCd = CAMERA_REARM_CD;
        _EG.enemyDiedThisFrame = true; // re-evaluate room-clear (was blocked while alerted)
      } else {
        c.alertTimer -= dt;
        if (c.alertTimer <= 0) {
          // Alert triggered — spawn reinforcements
          c.state = 'triggered';
          c.dead = true;
          audio.cameraAlert();
          _EG.msg('⚠ SECURITY RESPONSE INCOMING', '#ff3333');
          spawnParticles(c.x, c.y, 'EXPLOSION', '#ff3333', 12);
          const count = rndInt(2, 3);
          for (let j = 0; j < count; j++) {
            const type = pickEnemyType(c.floor);
            let ex, ey, att = 0;
            do {
              ex = r.x + rnd(1, r.w - 1);
              ey = r.y + rnd(1, r.h - 1);
              att++;
            } while (att < 20 && (
              !isPassable(map[Math.floor(ey)]?.[Math.floor(ex)]) ||
              dist(ex, ey, p.x, p.y) < 3
            ));
            if (!isPassable(map[Math.floor(ey)]?.[Math.floor(ex)])) continue;
            pendingEnemySpawns.push({ type, x: ex, y: ey, floor: c.floor, room: r });
          }
          cameras.splice(i, 1);
        }
      }
    }
  }
}

/**
 * @param {any} [camX]
 * @param {any} [camY]
 */
function drawCameras(camX, camY) {
  const map = _EG.dungeon?.map;
  for (const c of cameras) {
    if (c.dead) continue;
    const tx = Math.floor(c.x), ty = Math.floor(c.y);
    if (!_EG.dungeon?.visible?.[ty]?.[tx]) continue;
    const sx = c.x * TILE - camX, sy = c.y * TILE - camY;
    const currentAngle = c.baseAngle + c.sweepAngle;

    // Draw vision cone (raycast-clipped against walls)
    const coneSteps = 16;
    const coneColor = c.state === 'alerted' ? '#ff4422' : '#ff2200';
    const coneAlpha = c.state === 'alerted'
      ? 0.18 + 0.12 * Math.sin(c.bob * 8) // fast pulse when alerted
      : 0.08 + 0.03 * Math.sin(c.bob * 2);

    ctx.save();
    ctx.globalAlpha = coneAlpha;
    ctx.fillStyle = coneColor;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    for (let s = 0; s <= coneSteps; s++) {
      const a = currentAngle - CAMERA_CONE_HALF + (CAMERA_CONE_HALF * 2) * (s / coneSteps);
      // Raycast to find effective range (clip at walls)
      let reach = CAMERA_RANGE;
      for (let step = 0.5; step <= CAMERA_RANGE; step += 0.5) {
        const rx = c.x + Math.cos(a) * step;
        const ry = c.y + Math.sin(a) * step;
        const rtx = Math.floor(rx), rty = Math.floor(ry);
        if (rtx < 0 || rty < 0 || rtx >= 80 || rty >= 50) { reach = step - 0.5; break; }
        const tile = map[rty]?.[rtx];
        if (tile !== undefined && !isSeeThrough(tile)) { reach = step - 0.25; break; }
      }
      reach = Math.max(0.5, reach);
      const ex = sx + Math.cos(a) * reach * TILE;
      const ey = sy + Math.sin(a) * reach * TILE;
      ctx.lineTo(ex, ey);
    }
    ctx.closePath();
    ctx.fill();

    // Cone edge lines (raycast-clipped to match filled cone)
    ctx.globalAlpha = coneAlpha * 1.5;
    ctx.strokeStyle = coneColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const edgeA of [currentAngle - CAMERA_CONE_HALF, currentAngle + CAMERA_CONE_HALF]) {
      let reach = CAMERA_RANGE;
      for (let step = 0.5; step <= CAMERA_RANGE; step += 0.5) {
        const rx = c.x + Math.cos(edgeA) * step;
        const ry = c.y + Math.sin(edgeA) * step;
        const rtx = Math.floor(rx), rty = Math.floor(ry);
        if (rtx < 0 || rty < 0 || rtx >= 80 || rty >= 50) { reach = step - 0.5; break; }
        const tile = map[rty]?.[rtx];
        if (tile !== undefined && !isSeeThrough(tile)) { reach = step - 0.25; break; }
      }
      reach = Math.max(0.5, reach);
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(edgeA) * reach * TILE, sy + Math.sin(edgeA) * reach * TILE);
    }
    ctx.stroke();
    ctx.restore();

    // Draw camera body
    ctx.save();
    const baseColour = c.state === 'alerted' ? '#ff4422' : '#cc2200';
    const glowColour = c.state === 'alerted' ? '#ff6644' : '#ff3300';
    ctx.shadowBlur = c.state === 'alerted' ? 10 : 5;
    ctx.shadowColor = glowColour;

    // Camera housing (small rectangle oriented to wall)
    ctx.translate(sx, sy);
    ctx.rotate(c.baseAngle);
    ctx.fillStyle = '#333';
    ctx.fillRect(-4, -3, 8, 6);
    ctx.fillStyle = baseColour;
    ctx.fillRect(-3, -2, 6, 4);

    // Lens dot
    const lensPulse = c.state === 'alerted' ? 1.0 : 0.6 + 0.3 * Math.sin(c.bob * 2);
    ctx.globalAlpha = lensPulse;
    ctx.fillStyle = c.state === 'alerted' ? '#ff8866' : '#ff4400';
    NEON.draw.circle(ctx, 2, 0, 2);

    ctx.restore();

    // Alert countdown bar
    if (c.state === 'alerted') {
      const bw = 16, bh = 2;
      const bx = sx - bw / 2, by = sy - 12;
      const pct = c.alertTimer / CAMERA_ALERT_TIME;
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#331100';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = pct > 0.3 ? '#ff6622' : '#ff2200';
      ctx.fillRect(bx, by, bw * pct, bh);
      ctx.restore();
    }

    // HP bar when damaged
    if (c.hp < c.maxHp) {
      const bw = 16, bh = 2, bx = sx - bw / 2, by = sy - 14;
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#113';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(bx, by, bw * (c.hp / c.maxHp), bh);
      ctx.restore();
    }
  }
}

// ─── Laser Tripwires ──────────────────────────────────────────────────────────
const LASER_HIT_CD = 2.0;      // seconds between re-triggering on same laser
const LASER_DISABLE_DUR = 3.0; // EMP disable duration
const LASER_CYCLE_ON = 1.5;    // seconds beam stays on (cycling lasers)
const LASER_CYCLE_OFF = 1.5;   // seconds beam stays off (cycling lasers)
const LASER_REARM_GRACE = 0.2; // grace period after cycle-on before beam can hit

/**
 * @param {any} [x1]
 * @param {any} [y1]
 * @param {any} [x2]
 * @param {any} [y2]
 * @param {any} [floor]
 * @param {any} [room]
 * @param {any} [axis]
 * @param {any} [cycling]
 */
function createLaser(x1, y1, x2, y2, floor, room, axis, cycling) {
  const emitterHp = 10 + floor * 3;
  return {
    x1, y1, x2, y2,
    hpA: emitterHp, hpB: emitterHp, maxHp: emitterHp,
    deadA: false, deadB: false,
    dead: false,
    room, floor, axis,
    cycling,
    active: true,
    cycleTimer: cycling ? LASER_CYCLE_ON : 0,
    hitCd: 0,
    disabled: false,
    disableTimer: 0,
    rearmGrace: 0,
    _emitB: {},  // unique Map key for Static Field hitMap on emitter B
    bob: rand('cosmetic') * TWO_PI,
  };
}

/**
 * @param {any} [l]
 * @param {any} [which]
 */
function destroyLaserEmitter(l, which) {
  if (which === 'A') l.deadA = true;
  else l.deadB = true;
  const ex = which === 'A' ? l.x1 : l.x2;
  const ey = which === 'A' ? l.y1 : l.y2;
  spawnParticles(ex, ey, 'EXPLOSION', '#ff6644', 12);
  spawnParticles(ex, ey, 'SPARK', '#ffaa44', 6);
  audio.laserDestroy();
  // Beam is gone — mark entire laser dead
  l.dead = true;
  l.active = false;
  const d = getDiff();
  const amt = Math.round(_EG.floor * 3 * getMetaCreditMultiplier() * d.creditMul * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
  _EG.player.credits += amt;
  const mx = (l.x1 + l.x2) / 2, my = (l.y1 + l.y2) / 2;
  spawnDmgText(mx, my - 0.3, '+' + amt + '◈', '#ff6644');
  const idx = lasers.indexOf(l);
  if (idx >= 0) lasers.splice(idx, 1);
}

/**
 * @param {any} [l]
 * @param {any} [which]
 * @param {any} [dmg]
 */
function damageLaserEmitter(l, which, dmg) {
  if (l.dead) return;
  if (which === 'A') {
    if (l.deadA) return;
    l.hpA -= dmg;
    if (l.hpA <= 0) { destroyLaserEmitter(l, 'A'); return; }
    spawnParticles(l.x1, l.y1, 'SPARK', '#ff6644', 4);
  } else {
    if (l.deadB) return;
    l.hpB -= dmg;
    if (l.hpB <= 0) { destroyLaserEmitter(l, 'B'); return; }
    spawnParticles(l.x2, l.y2, 'SPARK', '#ff6644', 4);
  }
}

/**
 * @param {any} [wx]
 * @param {any} [wy]
 * @param {any} [radius]
 * @param {any} [dmg]
 * @param {any} [map]
 */
function damageLasersInRadius(wx, wy, radius, dmg, map) {
  for (let i = lasers.length - 1; i >= 0; i--) {
    const l = lasers[i];
    if (l.dead) continue;
    // Check both emitters
    if (!l.deadA && dist(wx, wy, l.x1, l.y1) < radius && hasLOS(wx, wy, l.x1, l.y1, map)) {
      damageLaserEmitter(l, 'A', dmg);
    }
    if (l.dead) continue; // might have been destroyed above
    if (!l.deadB && dist(wx, wy, l.x2, l.y2) < radius && hasLOS(wx, wy, l.x2, l.y2, map)) {
      damageLaserEmitter(l, 'B', dmg);
    }
  }
}

// Segment intersection: does segment (px,py)→(px2,py2) cross laser beam?
/**
 * @param {any} [l]
 * @param {any} [px]
 * @param {any} [py]
 * @param {any} [px2]
 * @param {any} [py2]
 */
function crossesLaserBeam(l, px, py, px2, py2) {
  // Beam from (l.x1,l.y1) to (l.x2,l.y2), player from (px,py) to (px2,py2)
  const d1x = l.x2 - l.x1, d1y = l.y2 - l.y1;
  const d2x = px2 - px, d2y = py2 - py;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-10) return false; // parallel
  const t = ((px - l.x1) * d2y - (py - l.y1) * d2x) / denom;
  const u = ((px - l.x1) * d1y - (py - l.y1) * d1x) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

// Check if beam path is clear of opaque tiles
/**
 * @param {any} [l]
 * @param {any} [map]
 */
function isBeamClear(l, map) {
  const steps = Math.ceil(dist(l.x1, l.y1, l.x2, l.y2) * 2);
  for (let s = 1; s < steps; s++) {
    const frac = s / steps;
    const bx = l.x1 + (l.x2 - l.x1) * frac;
    const by = l.y1 + (l.y2 - l.y1) * frac;
    const tx = Math.floor(bx), ty = Math.floor(by);
    if (tx < 0 || ty < 0 || tx >= 80 || ty >= 50) return false;
    const tile = map[ty]?.[tx];
    if (tile !== undefined && !isSeeThrough(tile)) return false;
  }
  return true;
}

/**
 * @param {any} [dt]
 */
function updateLasers(dt) {
  const p = _EG.player;
  const map = _EG.dungeon?.map;
  if (!map) return;
  for (let i = lasers.length - 1; i >= 0; i--) {
    const l = lasers[i];
    if (l.dead) continue;
    l.bob += dt * 2;

    // EMP disable timer
    if (l.disabled) {
      l.disableTimer -= dt;
      if (l.disableTimer <= 0) {
        l.disabled = false;
        l.rearmGrace = LASER_REARM_GRACE;
      }
      continue;
    }

    // Tick rearm grace
    if (l.rearmGrace > 0) l.rearmGrace -= dt;

    // Cycling logic
    if (l.cycling) {
      l.cycleTimer -= dt;
      if (l.active && l.cycleTimer <= 0) {
        l.active = false;
        l.cycleTimer = LASER_CYCLE_OFF;
      } else if (!l.active && l.cycleTimer <= 0) {
        l.active = true;
        l.cycleTimer = LASER_CYCLE_ON;
        l.rearmGrace = LASER_REARM_GRACE;
      }
    }

    // Hit cooldown
    if (l.hitCd > 0) l.hitCd -= dt;

    // Beam active? Check path clear (crates can block)
    if (!l.active) continue;
    if (!isBeamClear(l, map)) continue;

    // Player crossing detection (segment intersection with player prev→current pos)
    if (l.hitCd <= 0 && l.rearmGrace <= 0 && canTargetPlayer()) {
      const prevX = p._prevX !== undefined ? p._prevX : p.x;
      const prevY = p._prevY !== undefined ? p._prevY : p.y;
      // Also check if player is currently overlapping the beam (standing on it)
      const onBeam = crossesLaserBeam(l, prevX, prevY, p.x, p.y);
      // Proximity check for standing near beam line
      let nearBeam = false;
      if (!onBeam) {
        // Point-to-segment distance check for player radius
        const ax = l.x1, ay = l.y1, bx = l.x2, by = l.y2;
        const abx = bx - ax, aby = by - ay;
        const apx = p.x - ax, apy = p.y - ay;
        const ab2 = abx * abx + aby * aby;
        const t = ab2 > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2)) : 0;
        const closestX = ax + t * abx, closestY = ay + t * aby;
        nearBeam = dist(p.x, p.y, closestX, closestY) < 0.25;
      }
      if (onBeam || nearBeam) {
        // Dash bypasses laser tripwires
        if (p.dashTimer > 0) continue;
        const dmg = 8 + l.floor * 2;
        const actual = p.takeDamage(dmg, 'laser');
        if (actual > 0) {
          l.hitCd = LASER_HIT_CD;
          // Apply brief shock (movement suppress)
          p.shockTimer = Math.max(p.shockTimer || 0, 0.3);
          audio.laserHit();
          spawnParticles(p.x, p.y, 'SPARK', '#ff8844', 8);
          _EG.msg('⚡ LASER TRIP', '#ff8844');
        }
      }
    }
  }
}

/**
 * @param {any} [camX]
 * @param {any} [camY]
 */
function drawLasers(camX, camY) {
  const map = _EG.dungeon?.map;
  if (!map) return;
  for (const l of lasers) {
    if (l.dead) continue;
    // Visibility: either emitter visible
    const t1x = Math.floor(l.x1), t1y = Math.floor(l.y1);
    const t2x = Math.floor(l.x2), t2y = Math.floor(l.y2);
    const vis1 = _EG.dungeon?.visible?.[t1y]?.[t1x];
    const vis2 = _EG.dungeon?.visible?.[t2y]?.[t2x];
    if (!vis1 && !vis2) continue;

    const s1x = l.x1 * TILE - camX, s1y = l.y1 * TILE - camY;
    const s2x = l.x2 * TILE - camX, s2y = l.y2 * TILE - camY;

    // Draw beam line
    if (!l.disabled) {
      const beamClear = isBeamClear(l, map);
      if (l.active && beamClear) {
        // Active beam — bright red/orange line with glow
        const pulse = 0.6 + 0.2 * Math.sin(l.bob * 4);
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = '#ff4422';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ff4422';
        NEON.draw.line(ctx, s1x, s1y, s2x, s2y);
        // Inner bright core
        ctx.globalAlpha = pulse * 0.8;
        ctx.strokeStyle = '#ff8866';
        ctx.lineWidth = 1;
        ctx.shadowBlur = 4;
        NEON.draw.line(ctx, s1x, s1y, s2x, s2y);
        ctx.restore();
      } else if (l.cycling && !l.active) {
        // Cycling off — dim dotted line
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = '#ff4422';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        NEON.draw.line(ctx, s1x, s1y, s2x, s2y);
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    // Draw emitter A
    if (!l.deadA) {
      ctx.save();
      const col = l.disabled ? '#666' : '#ff6644';
      const glow = l.disabled ? '#444' : '#ff8844';
      ctx.shadowBlur = l.disabled ? 2 : 6;
      ctx.shadowColor = glow;
      ctx.fillStyle = '#333';
      ctx.fillRect(s1x - 3, s1y - 3, 6, 6);
      ctx.fillStyle = col;
      ctx.fillRect(s1x - 2, s1y - 2, 4, 4);
      // Lens pulse
      if (!l.disabled) {
        const lp = l.active ? 0.8 + 0.2 * Math.sin(l.bob * 3) : 0.3;
        ctx.globalAlpha = lp;
        ctx.fillStyle = '#ffaa66';
        NEON.draw.circle(ctx, s1x, s1y, 1.5);
      }
      ctx.restore();
      // HP bar when damaged
      if (l.hpA < l.maxHp) {
        const bw = 14, bh = 2, bx = s1x - bw / 2, by = s1y - 8;
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#113';
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(bx, by, bw * (l.hpA / l.maxHp), bh);
        ctx.restore();
      }
    }

    // Draw emitter B
    if (!l.deadB) {
      ctx.save();
      const col = l.disabled ? '#666' : '#ff6644';
      const glow = l.disabled ? '#444' : '#ff8844';
      ctx.shadowBlur = l.disabled ? 2 : 6;
      ctx.shadowColor = glow;
      ctx.fillStyle = '#333';
      ctx.fillRect(s2x - 3, s2y - 3, 6, 6);
      ctx.fillStyle = col;
      ctx.fillRect(s2x - 2, s2y - 2, 4, 4);
      if (!l.disabled) {
        const lp = l.active ? 0.8 + 0.2 * Math.sin(l.bob * 3) : 0.3;
        ctx.globalAlpha = lp;
        ctx.fillStyle = '#ffaa66';
        NEON.draw.circle(ctx, s2x, s2y, 1.5);
      }
      ctx.restore();
      if (l.hpB < l.maxHp) {
        const bw = 14, bh = 2, bx = s2x - bw / 2, by = s2y - 8;
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#113';
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(bx, by, bw * (l.hpB / l.maxHp), bh);
        ctx.restore();
      }
    }

    // Disabled sparking effect
    if (l.disabled) {
      if (rand('cosmetic') < 0.1) {
        spawnParticles(l.x1, l.y1, 'SPARK', '#00ddff', 1);
        spawnParticles(l.x2, l.y2, 'SPARK', '#00ddff', 1);
      }
    }
  }
}
