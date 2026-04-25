// @ts-check
// src/meta/cores.js — CORES currency world-entities (UNCHAINED #39)
//
// Cores are the post-run persistent currency introduced in UNCHAINED Phase 1.
// save.js owns the wallet math (addCores / spendCores); this module owns the
// in-world pickup: drop spawning, magnetic pull toward the player, collection
// fx, HUD-pulse timer, and floor-transition vacuum.
//
// UMD-lite: exposes NEON.cores in the browser and module.exports in Node, so
// tests can exercise the pure math without a DOM/canvas.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (/** @type {any} */ (root.NEON = root.NEON || {})).cores = factory();
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  // Magnetic pull starts when the player is within this tile radius; below
  // PICKUP_RADIUS the drop is collected outright.
  const MAGNET_RADIUS = 2.0;
  const PICKUP_RADIUS = 0.7;
  // Max pull speed in tiles/second when the drop is right at the magnet edge.
  // Accelerates toward the player as distance shrinks (see updateCoreDrops).
  const MAGNET_MAX_SPEED = 10.0;
  // HUD pulse duration (seconds) after a pickup.
  const PULSE_DURATION = 0.5;
  // Drops older than this are auto-vacuumed on floor-clear to avoid stragglers
  // blocking the "drops clear on floor transition" acceptance criterion.
  const VACUUM_FADE = 0.3;

  /** @param {any} game */
  function _ensureDrops(game) {
    if (!game.coreDrops) game.coreDrops = [];
    return game.coreDrops;
  }

  // CoreDrop — a single in-world pickup. Plain data object: no prototype chain,
  // so it round-trips cleanly through save/resume if we ever serialise floor
  // state (currently we don't; drops vacuum on descent).
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

  // pulseHud — public helper so callers that bypass updateCoreDrops (e.g. a
  // future "boss death auto-credit" path) can still flash the HUD readout.
  /** @param {any} game */
  function pulseHud(game) {
    game._coreHudPulse = PULSE_DURATION;
  }

  // Adds cores to the persistent wallet and triggers the pickup fx. `value` is
  // clamped positive; the helper routes through the `save` module so all
  // wallet mutations land in one place. `audio` and `spawnParticles` /
  // `spawnDmgText` are optional — tests pass undefined, the browser passes the
  // real globals.
  /** @param {any} game @param {any} drop @param {any} deps */
  function _collect(game, drop, deps) {
    drop.dead = true;
    const save = deps && deps.save;
    const addCoresFn = save && save.addCores;
    if (addCoresFn) {
      const newTotal = addCoresFn(drop.value);
      // Cache the post-pickup wallet count so HUD renders without reading
      // localStorage every frame. Nothing else writes this field.
      if (typeof newTotal === 'number') game._cachedCores = newTotal;
    }
    pulseHud(game);
    const audio = deps && deps.audio;
    if (audio && typeof audio.coreCollected === 'function') {
      try { audio.coreCollected(); } catch (_) { /* never break a run */ }
    }
    const sp = deps && deps.spawnParticles;
    if (typeof sp === 'function') {
      try { sp(drop.x, drop.y, 'SPARK', '#44e5ff', 8); } catch (_) { /* ignore */ }
    }
    const st = deps && deps.spawnDmgText;
    if (typeof st === 'function') {
      try { st(drop.x, drop.y, '+' + drop.value + '◆', '#a866ff'); } catch (_) { /* ignore */ }
    }
  }

  // updateCoreDrops — advances spawnTime, applies magnetic pull toward the
  // player, and collects drops that cross PICKUP_RADIUS. Pure w.r.t. the game
  // object: all mutations go through addCores / pulseHud / the injected fx
  // helpers so Node tests can drive the whole pipeline with stubs.
  //
  // `deps` is a dependency bag: { save, audio, spawnParticles, spawnDmgText }.
  // In the browser we pass the globals; Node tests pass stubs or omit the bag.
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
      // Pickup short-circuit: inside pickup radius, collect immediately.
      if (dist < PICKUP_RADIUS) {
        _collect(game, d, deps);
        drops.splice(i, 1);
        collected += d.value;
        continue;
      }
      // Magnetic pull: accelerate toward the player when within MAGNET_RADIUS
      // OR when the floor-clear vacuum has been engaged (ignore radius gate).
      const engaged = d._vacuum || dist < MAGNET_RADIUS;
      if (engaged && dist > 1e-6) {
        // Closer → faster. Linear falloff; clamped to [0, MAGNET_MAX_SPEED].
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

  // drawCoreDrops — cyan-purple rotating hexagon glyph with a gentle vertical
  // bob. Mirrors the drawing idiom used by items.js (`worldTile * TILE - camPx`).
  // `camera` is pixel-space (matches getCamera() in src/render.js); `d.x/d.y`
  // are tile-space. Browser-only: Node tests never call this.
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
      // Outer glow ring — cyan.
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
      // Inner fill — purple core.
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

  // clearCoreDrops — called by game.loadFloor() so drops never leak between
  // floors. Tests call it explicitly to isolate cases.
  /** @param {any} game */
  function clearCoreDrops(game) { if (game) game.coreDrops = []; }

  // vacuumAllCores — engages magnetic pull on every uncollected drop so the
  // player sweeps them up during the floor-transition fade. Called from
  // game.descend(). Returns the count of drops engaged so callers can log /
  // message if they want.
  /** @param {any} game */
  function vacuumAllCores(game) {
    const drops = game && game.coreDrops;
    if (!drops || drops.length === 0) return 0;
    for (const d of drops) d._vacuum = true;
    return drops.length;
  }

  // forceCollectAll — the hard-vacuum fallback used when the floor actually
  // transitions before the magnetic pull finishes. Credits every remaining
  // drop directly (no fx) and empties the array. Safe no-op if empty.
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

  // tickHudPulse — drains the HUD-pulse timer. Renderer reads game._coreHudPulse
  // to decide whether to emphasise the readout. Exposed as a helper so the
  // game-loop integration is one call.
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
