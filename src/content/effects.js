// @ts-check
'use strict';

// Loaded before src/content.js so particle, text, and shake globals keep their names.
// Pool and integration live in NEON.particles. This file owns type speeds, tile coords, and draw style.
const PARTICLE_CAP = 2000;
const PARTICLE_BURST_SCALE_THRESHOLD = 1500;
const _particles = /** @type {any} */ (requireNEON('particles', 'src/content/effects.js'));
const _particleSystem = _particles.createSystem({
  cap: PARTICLE_CAP,
  burstScaleThreshold: PARTICLE_BURST_SCALE_THRESHOLD,
});

/**
 * @param {any} wx
 * @param {any} wy
 * @param {any} type
 * @param {any} colour
 * @param {any} count
 */
function spawnParticles(wx, wy, type, colour, count) {
  // Under extreme stacking, scaleBurst halves new bursts with a floor of one to protect the frame budget.
  count = _particleSystem.scaleBurst(count);
  // REDUCED MOTION halves bursts. Floor at 1: a MUZZLE of 0 would hide the shot tell.
  if (settings.reducedMotion) count = Math.max(1, Math.floor(count * 0.5));
  for (let i=0; i<count; i++) {
    const p = _particleSystem.acquire();
    if (!p) return; // cap reached mid-burst
    const a = rand('cosmetic') * TWO_PI;
    const spd = type==='EXPLOSION' ? rnd(1,4,'cosmetic') : rnd(0.5,3,'cosmetic');
    // Pooled object: every field must be rewritten or the previous burst bleeds through.
    p.x = wx*TILE;
    p.y = wy*TILE;
    p.vx = Math.cos(a)*spd*(TILE/2);
    p.vy = Math.sin(a)*spd*(TILE/2);
    p.life = 1;
    p.maxLife = type==='MUZZLE' ? 0.08 : type==='EXPLOSION' ? 0.5 : rnd(0.3,0.6,'cosmetic');
    p.size = type==='EXPLOSION' ? rnd(3,8,'cosmetic') : rnd(1,3,'cosmetic');
    p.colour = colour;
    p.type = type;
    p.grav = type==='BLOOD' ? 40 : 0;
    p.alive = true;
  }
}

/**
 * @param {any} dt
 */
function updateParticles(dt) {
  _particleSystem.update(dt);
}

// Hoisted to module scope to avoid per-frame closure allocation in the
// drawParticles hot path. drawParticles writes camera coords here, then
// calls _particleSystem.forEach(_drawParticleCb) — the engine iterates,
// the host owns zero per-call allocation.
let _drawCamX = 0, _drawCamY = 0;
/** @param {any} p */
function _drawParticleCb(p) {
  const sx = p.x - _drawCamX, sy = p.y - _drawCamY;
  if (sx < -20 || sx > W+20 || sy < -20 || sy > H+20) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, p.life);
  if (p.type === 'EXPLOSION') {
    ctx.shadowBlur = 10; ctx.shadowColor = p.colour;
    ctx.fillStyle = p.colour;
    NEON.draw.circle(ctx, sx, sy, p.size * (1 - p.life * 0.5 + 0.5));
  } else {
    ctx.fillStyle = p.colour;
    ctx.fillRect(sx - p.size/2, sy - p.size/2, p.size, p.size);
  }
  ctx.restore();
}

/**
 * @param {any} camX
 * @param {any} camY
 */
function drawParticles(camX, camY) {
  _drawCamX = camX;
  _drawCamY = camY;
  _particleSystem.forEach(_drawParticleCb);
}

function clearParticles() {
  _particleSystem.clear();
}

function particleCount() {
  return _particleSystem.count;
}

/** @type {any[]} */ const ambientParticles = [];
const AMB_CAP = 80;
const AMB_SPAWN_INTERVAL = 0.08; // seconds between spawn attempts
let ambSpawnTimer = 0;

/**
 * @param {any} dt
 */
function updateAmbient(dt) {
  for (let i = ambientParticles.length - 1; i >= 0; i--) {
    const p = ambientParticles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt / p.maxLife;
    if (p.life <= 0) { ambientParticles.splice(i, 1); continue; }
    if (p.kind === 'DUST') {
      p.vx += (Math.sin(p.seed + lastTime / 2000) * 3 - p.vx) * dt * 0.5;
      p.vy += (Math.cos(p.seed + lastTime / 1700) * 2 - p.vy) * dt * 0.5;
    }
  }

  ambSpawnTimer += dt;
  if (ambSpawnTimer < AMB_SPAWN_INTERVAL || ambientParticles.length >= AMB_CAP) {
    if (ambSpawnTimer >= AMB_SPAWN_INTERVAL) ambSpawnTimer = 0;
    return;
  }
  ambSpawnTimer = 0;

  const dungeon = _CG.dungeon;
  const player = _CG.player;
  if (!dungeon || !player) return;

  const cam = getCamera(player);
  const startX = Math.max(0, Math.floor(cam.x / TILE) - 1);
  const startY = Math.max(0, Math.floor(cam.y / TILE) - 1);
  const endX = Math.min(MAP_W, startX + Math.ceil(W / TILE) + 2);
  const endY = Math.min(MAP_H, startY + Math.ceil((H - layout.hudH) / TILE) + 2);
  const torchR = _CG.modifier === 'BLACKOUT' ? 5 : 9;
  const ptx = Math.floor(player.x), pty = Math.floor(player.y);

  const emitters = [];
  for (let ty = startY; ty < endY; ty++) {
    for (let tx = startX; tx < endX; tx++) {
      if (!dungeon.visited[ty][tx]) continue;
      if (dungeon.secretMask[ty][tx]) continue;
      const tile = dungeon.map[ty][tx];
      // Bound ambient emitters by torch radius, independent of the cached light grid.
      const ddx = tx - ptx, ddy = ty - pty;
      if (ddx * ddx + ddy * ddy > torchR * torchR) continue;

      if (tile === T.FLOOR || tile === T.DOOR_OPEN) {
        if (rand('cosmetic') < 0.008) emitters.push({ kind: 'DUST', tx, ty });
      } else if (tile === T.PLASMA) {
        if (rand('cosmetic') < 0.15) emitters.push({ kind: 'EMBER', tx, ty });
      } else if (tile === T.ARC) {
        const arcActive = Math.sin((_CG.floorTime || 0) * Math.PI) > 0;
        if (arcActive && rand('cosmetic') < 0.12) emitters.push({ kind: 'ZAP', tx, ty });
      } else if (tile === T.CRACKED) {
        const pdx = tx - Math.floor(player.x), pdy = ty - Math.floor(player.y);
        if (pdx * pdx + pdy * pdy <= 16) {
          if (rand('cosmetic') < 0.06) emitters.push({ kind: 'STEAM', tx, ty });
        }
      } else if (tile === T.WALL) {
        if (_CG.sealedEntranceSet && _CG.sealedEntranceSet.has(ty * MAP_W + tx)) {
          if (rand('cosmetic') < 0.18) emitters.push({ kind: 'WISP', tx, ty });
        }
      }
    }
  }

  const budget = AMB_CAP - ambientParticles.length;
  const count = Math.min(emitters.length, budget, 3);
  for (let i = 0; i < count; i++) {
    const idx = rndInt(0, emitters.length - 1, 'cosmetic');
    const e = /** @type {any} */ (emitters.splice(idx, 1)[0]);
    const cx = e.tx * TILE + rnd(2, TILE - 2);
    const cy = e.ty * TILE + rnd(2, TILE - 2);

    switch (e.kind) {
      case 'DUST': {
        let dustPal = ['#66ddff','#aabbcc'];
        try {
          if (typeof NEON !== 'undefined' && NEON.biomes && typeof BIOME_PALETTES !== 'undefined') {
            const a = NEON.biomes.areaForFloor(_CG.floor);
            const bp = a && BIOME_PALETTES[a.palette];
            if (bp && Array.isArray(bp.dust) && bp.dust.length) dustPal = bp.dust;
          }
        } catch(_) {}
        const col = rand('cosmetic') < 0.5 ? dustPal[0] : dustPal[1 % dustPal.length];
        ambientParticles.push({
          kind: 'DUST', x: cx, y: cy,
          vx: rnd(-3, 3), vy: rnd(-3, 3),
          life: 1, maxLife: rnd(3, 6), size: rnd(1, 2.5),
          alpha: rnd(0.06, 0.18), colour: col,
          seed: rand('cosmetic') * 1000,
        });
        break;
      }
      case 'EMBER':
        ambientParticles.push({
          kind: 'EMBER', x: cx, y: cy,
          vx: rnd(-6, 6), vy: rnd(-25, -10),
          life: 1, maxLife: rnd(0.6, 1.2), size: rnd(1.5, 3),
          alpha: rnd(0.3, 0.6, 'cosmetic'), colour: rand('cosmetic') < 0.5 ? '#ff6600' : '#ffaa33',
          seed: 0,
        });
        break;
      case 'ZAP':
        ambientParticles.push({
          kind: 'ZAP', x: cx, y: cy,
          vx: rnd(-15, 15), vy: rnd(-15, 15),
          life: 1, maxLife: rnd(0.08, 0.18), size: rnd(1, 2.5),
          alpha: rnd(0.5, 0.9), colour: '#88eeff',
          seed: 0,
        });
        break;
      case 'STEAM':
        ambientParticles.push({
          kind: 'STEAM', x: cx, y: cy - TILE * 0.3,
          vx: rnd(-2, 2), vy: rnd(-12, -5),
          life: 1, maxLife: rnd(1.0, 2.0), size: rnd(2, 4),
          alpha: rnd(0.06, 0.14), colour: '#8888aa',
          seed: 0,
        });
        break;
      case 'WISP':
        ambientParticles.push({
          kind: 'WISP', x: cx, y: cy,
          vx: rnd(-10, 10), vy: rnd(-10, 10),
          life: 1, maxLife: rnd(0.8, 1.8), size: rnd(2, 4),
          alpha: rnd(0.2, 0.45, 'cosmetic'), colour: rand('cosmetic') < 0.6 ? '#ff3333' : '#ff6644',
          seed: rand('cosmetic') * 1000,
        });
        break;
    }
  }
}

/**
 * @param {any} camX
 * @param {any} camY
 */
function drawAmbient(camX, camY) {
  for (const p of ambientParticles) {
    const sx = p.x - camX, sy = p.y - camY;
    if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;
    const a = p.alpha * Math.min(1, p.life * 2) * Math.min(1, (1 - p.life) * 3 + 0.3);
    if (a < 0.01) continue;
    ctx.save();
    ctx.globalAlpha = a;
    if (p.kind === 'ZAP') {
      ctx.shadowBlur = 6; ctx.shadowColor = p.colour;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
    } else if (p.kind === 'WISP') {
      ctx.shadowBlur = 8; ctx.shadowColor = p.colour;
      ctx.fillStyle = p.colour;
      NEON.draw.circle(ctx, sx, sy, p.size * (0.5 + 0.5 * p.life));
    } else if (p.kind === 'EMBER') {
      ctx.fillStyle = p.colour;
      const flicker = 0.7 + 0.3 * Math.sin(lastTime / 60 + p.seed);
      ctx.globalAlpha = a * flicker;
      ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
    } else {
      ctx.fillStyle = p.colour;
      ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
    }
    ctx.restore();
  }
}

/** @type {any[]} */ const floatingTexts = [];
/**
 * @param {any} wx
 * @param {any} wy
 * @param {any} text
 * @param {any} colour
 */
function spawnDmgText(wx, wy, text, colour) {
  if (!settings.damageNumbers) return;
  if (floatingTexts.length >= 20) floatingTexts.shift();
  // Damage paths multiply floats (31.999999999999996). Round here so call sites
  // stay unrounded; non-numeric labels ('CRIT!', '+5') are left alone.
  if (typeof text === 'number' && Number.isFinite(text)) text = Math.round(text);
  floatingTexts.push({
    x: wx * TILE + rnd(-6, 6), y: wy * TILE - 8,
    vy: -40, life: 1, text: String(text), colour
  });
}
/**
 * @param {any} dt
 */
function updateFloatingTexts(dt) {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const f = floatingTexts[i];
    f.y += f.vy * dt;
    f.vy *= Math.pow(0.35, dt);
    f.life -= dt * 1.4;
    if (f.life <= 0) floatingTexts.splice(i, 1);
  }
}
/**
 * @param {any} camX
 * @param {any} camY
 */
function drawFloatingTexts(camX, camY) {
  // One font string per frame: 10+ texts, and a per-text template literal would churn.
  const fontPx = Math.max(8, Math.round(15 * settings.textScale));
  const fontStr = `bold ${fontPx}px monospace`;
  for (const f of floatingTexts) {
    const sx = f.x - camX, sy = f.y - camY;
    if (sx < -40 || sx > W + 40 || sy < -20 || sy > H + 20) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.shadowBlur = 6; ctx.shadowColor = f.colour;
    ctx.fillStyle = f.colour;
    ctx.font = fontStr;
    ctx.textAlign = 'center';
    ctx.fillText(f.text, sx, sy);
    ctx.restore();
  }
}

const shake = { intensity: 0, timer: 0, ox: 0, oy: 0 };
/**
 * @param {any} intensity
 * @param {any} duration
 */
function triggerShake(intensity, duration = 0.25) {
  if (!settings.screenShake) return;
  if (intensity > shake.intensity) {
    shake.intensity = intensity;
    shake.timer = duration;
  }
}
/**
 * @param {any} dt
 */
function updateShake(dt) {
  if (!settings.screenShake || shake.timer <= 0) { shake.intensity = 0; shake.timer = 0; shake.ox = shake.oy = 0; return; }
  shake.timer -= dt;
  const t = Math.max(0, shake.timer);
  const mag = shake.intensity * (t / 0.25);
  shake.ox = (rand('cosmetic') * 2 - 1) * mag;
  shake.oy = (rand('cosmetic') * 2 - 1) * mag;
  if (shake.timer <= 0) { shake.intensity = 0; shake.ox = shake.oy = 0; }
}
