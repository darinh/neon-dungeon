// @ts-check
// save.js owns addCores/spendCores; this file owns in-world drops, pull, and transition collection.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (/** @type {any} */ (root.NEON = root.NEON || {})).cores = factory();
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  // Tile radius. Inside PICKUP_RADIUS the drop is collected instead.
  const MAGNET_RADIUS = 2.0;
  const PICKUP_RADIUS = 0.7;
  // Maximum pull speed in tiles per second; vacuumed drops use it directly.
  const MAGNET_MAX_SPEED = 10.0;
  // Seconds.
  const PULSE_DURATION = 0.5;
  // Seconds.
  const VACUUM_FADE = 0.3;

  /** @param {any} game */
  function _ensureDrops(game) {
    if (!game.coreDrops) game.coreDrops = [];
    return game.coreDrops;
  }

  // Drops are not serialised; descent credits any remainder before loading the next floor.
  /** @param {number} x @param {number} y @param {number} value */
  function _makeDrop(x, y, value) {
    return {
      x: x, y: y,
      vx: 0, vy: 0,
      value: Math.max(1, Math.floor(Number(value) || 1)),
      spawnTime: 0,         // age in seconds — drives bob/spin anims
      _vacuum: false,       // true once the floor-clear vacuum has engaged
      dead: false,
    };
  }

  /** @param {any} game @param {number} x @param {number} y @param {number} value */
  function spawnCoreDrop(game, x, y, value) {
    if (!game || typeof x !== 'number' || typeof y !== 'number') return null;
    const drops = _ensureDrops(game);
    const d = _makeDrop(x, y, value);
    drops.push(d);
    return d;
  }

  /** @param {any} game */
  function pulseHud(game) {
    game._coreHudPulse = PULSE_DURATION;
  }

  // Wallet writes go through save.addCores. audio, particles, and text are optional so tests can omit them.
  /** @param {any} game @param {any} drop @param {any} deps */
  function _collect(game, drop, deps) {
    drop.dead = true;
    const save = deps && deps.save;
    const addCoresFn = save && save.addCores;
    if (addCoresFn) {
      const newTotal = addCoresFn(drop.value);
      // Cache the post-pickup wallet count so HUD renders without reading
      // localStorage every frame. startGame and continueGame seed this field; forceCollectAll also updates it.
      if (typeof newTotal === 'number') game._cachedCores = newTotal;
    }
    pulseHud(game);
    const audio = deps && deps.audio;
    if (audio && typeof audio.coreCollected === 'function') {
      try { audio.coreCollected(); } catch (_) { /* never break a run */ }
    }
    const sp = deps && deps.spawnParticles;
    if (typeof sp === 'function') {
      try { sp(drop.x, drop.y, 'SPARK', '#44e5ff', 8); } catch (_) { /* optional fx */ }
    }
    const st = deps && deps.spawnDmgText;
    if (typeof st === 'function') {
      try { st(drop.x, drop.y, '+' + drop.value + '◆', '#a866ff'); } catch (_) { /* optional fx */ }
    }
  }

  // Mutations go through addCores, pulseHud, and injected fx so tests can stub them.
  /** @param {any} game @param {number} dt @param {any} [deps] */
  function updateCoreDrops(game, dt, deps) {
    const drops = game && game.coreDrops;
    if (!drops || drops.length === 0) return 0;
    const player = game.player;
    if (!player) return 0;
    let collected = 0;
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      if (d.dead) { drops.splice(i, 1); continue; }
      d.spawnTime += dt;
      const dx = player.x - d.x, dy = player.y - d.y;
      const dist = Math.hypot(dx, dy);
      if (dist < PICKUP_RADIUS) {
        _collect(game, d, deps);
        drops.splice(i, 1);
        collected += d.value;
        continue;
      }
      // Vacuum ignores MAGNET_RADIUS.
      const engaged = d._vacuum || dist < MAGNET_RADIUS;
      if (engaged && dist > 1e-6) {
        const strength = d._vacuum
          ? MAGNET_MAX_SPEED
          : Math.min(MAGNET_MAX_SPEED, MAGNET_MAX_SPEED * (1 - dist / MAGNET_RADIUS) + 2);
        const nx = dx / dist, ny = dy / dist;
        d.x += nx * strength * dt;
        d.y += ny * strength * dt;
      }
    }
    return collected;
  }

  // camera is pixel-space (getCamera in src/render.js); d.x/d.y are tile-space.
  /** @param {CanvasRenderingContext2D} ctx @param {any[]} drops @param {{x:number,y:number}} camera @param {number} tileSize */
  function drawCoreDrops(ctx, drops, camera, tileSize) {
    if (!ctx || !drops || drops.length === 0) return;
    const TSZ = tileSize || 32;
    for (const d of drops) {
      if (d.dead) continue;
      const sx = d.x * TSZ - camera.x;
      const sy = d.y * TSZ - camera.y;
      const bob = Math.sin(d.spawnTime * 3) * 2;
      const rot = d.spawnTime * 1.2;
      const r = 5 + (d.value >= 5 ? 2 : 0);  // bigger glyph for boss drops
      ctx.save();
      ctx.translate(sx, sy + bob);
      ctx.rotate(rot);
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#44e5ff';
      ctx.strokeStyle = '#44e5ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#a866ff';
      ctx.fillStyle = '#a866ff';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        const px = Math.cos(a) * (r - 2);
        const py = Math.sin(a) * (r - 2);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // game.loadFloor() calls this so drops do not leak across floors.
  /** @param {any} game */
  function clearCoreDrops(game) { if (game) game.coreDrops = []; }

  // Marks every drop for radius-independent pull; current descent uses forceCollectAll().
  /** @param {any} game */
  function vacuumAllCores(game) {
    const drops = game && game.coreDrops;
    if (!drops || drops.length === 0) return 0;
    for (const d of drops) d._vacuum = true;
    return drops.length;
  }

  // Descent and endRun credit every remaining drop with no per-drop fx.
  /** @param {any} game @param {any} [deps] */
  function forceCollectAll(game, deps) {
    const drops = game && game.coreDrops;
    if (!drops || drops.length === 0) return 0;
    let total = 0;
    const save = deps && deps.save;
    const addCoresFn = save && save.addCores;
    let latest = null;
    for (const d of drops) {
      if (d.dead) continue;
      total += d.value;
      if (addCoresFn) latest = addCoresFn(d.value);
    }
    if (typeof latest === 'number') game._cachedCores = latest;
    game.coreDrops = [];
    if (total > 0) pulseHud(game);
    return total;
  }

  // Renderer reads _coreHudPulse to emphasise the readout.
  /** @param {any} game @param {number} dt */
  function tickHudPulse(game, dt) {
    if (!game) return;
    if ((game._coreHudPulse || 0) > 0) {
      game._coreHudPulse = Math.max(0, game._coreHudPulse - dt);
    }
  }

  return {
    MAGNET_RADIUS, PICKUP_RADIUS, MAGNET_MAX_SPEED, PULSE_DURATION, VACUUM_FADE,
    spawnCoreDrop, updateCoreDrops, drawCoreDrops,
    clearCoreDrops, vacuumAllCores, forceCollectAll,
    pulseHud, tickHudPulse,
  };
}));
