// @ts-check
'use strict';

/** @type {any[]} */ const disruptionFields = [];
/** @type {any[]} */ const gravityWells = [];
// Frost patches: persistent area-denial tiles laid down by CRYOPHAGE after
// its telegraph commits. Each patch is { x, y, age, maxAge, tickCd, dead }.
// Patches survive the mob that placed them (committed denial) and are
// cleared on floor transition (game.js loadFloor — same place _posHistory
// is reset). Damage uses dash-through canonical immunity.
/** @type {any[]} */ const frostPatches = [];

// ─── Disruption Fields (DISRUPTOR area-denial zones) ──────────────────────────
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
    // Player damage + debuff
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
    // Outer pulsing circle
    ctx.globalAlpha = fade * pulse * 0.25;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    grad.addColorStop(0, 'rgba(255,68,170,0.4)');
    grad.addColorStop(0.7, 'rgba(255,68,170,0.15)');
    grad.addColorStop(1, 'rgba(255,68,170,0)');
    ctx.fillStyle = grad;
    NEON.draw.circle(ctx, sx, sy, r);

    // Edge ring
    ctx.globalAlpha = fade * pulse * 0.5;
    ctx.strokeStyle = '#ff44aa';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ff44aa';
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -f.age * 30;
    NEON.draw.circleStroke(ctx, sx, sy, r);
    ctx.setLineDash([]);

    // Inner interference lines (visual noise)
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

// ─── NULLIFIER Jam Aura (anti-hackware) ──────────────────────────────────
// Persistent radial aura tied to NULLIFIER mob lifetime. Inside any live
// NULLIFIER's NULLIFIER_FIELD_R-tile aura: player.hackwareCooldown does NOT
// tick down (gate on the player.update line that decrements the counter)
// AND activateHackware() bails out (gate added to the canonical guard at
// the top of activateHackware in src/content.js — emits an audio cue +
// "JAMMED" floater for player feedback).
//
// Two consumers, two access paths:
//   - Cooldown-tick gate (player.update) uses the CACHED flag
//     player.hackwareJammed, set by updateNullifierJam each frame. The
//     flag is one frame stale relative to player position (call order is
//     player.update → ... → updateNullifierJam, mirroring DISRUPTOR's
//     existing pattern). For cooldown ticking that's invisible — losing
//     1/60s of cooldown progress on a 10s cooldown is 0.17%.
//   - Activation gate (activateHackware) calls isPlayerInNullifierAura
//     DIRECTLY for a FRESH same-frame check. Staleness here would let a
//     player who steps into an aura on the same frame as pressing the
//     hackware key sneak an activation past the gate (boundary exploit;
//     called out by gpt-5.3-codex r1 + gpt-5.5 r1 of the NULLIFIER PR).
//     Fresh compute eliminates the 1-frame window entirely.
//
// Why iterating the live `enemies` array rather than a separate module-
// level array (compare DISRUPTOR's disruptionFields): the aura is
// intrinsic to the mob — there's no decay, no drift, no independent
// lifetime. Iterating enemies adds one player.x/y distance check per
// frame to the existing per-frame walk; storing a parallel field array
// would require sync on spawn, death, room transitions, and floor
// changes, with no benefit. Same architectural choice as MAGNETON.
//
// Stun gating: stunTimer === 0 is the live-aura precondition. The early
// return at the top of Enemy.update (stunTimer > 0) already prevents
// aiNullifier from running, but the jam GATE is checked here OUTSIDE
// the AI dispatch — without the explicit stunTimer check this loop
// would happily set hackwareJammed for stunned NULLIFIERs that aren't
// running their AI. EMP_BURST/EMP_LINE/SHOCK should defuse the jam, so
// this gate is not optional.
//
// isPlayerDamageImmune gate: matches DISRUPTOR's precedent at line ~11519
// (callout from claude-opus-4.7 r1 of the NULLIFIER PR). A dashing or
// cloaked player gets a clean pass — dash-through becomes legitimate
// counterplay, mirroring how DISRUPTOR fields work. Note: PHASE_CLOAK is
// itself a hackware, so you CANNOT pop cloak inside an aura (the
// activateHackware gate fires first); pre-cloaking outside the aura
// IS the intended counterplay vector.
//
// Cross-room semantics: the aura is GLOBAL (no room gating). A NULLIFIER
// in a neighbouring room can jam through walls if you're within radius.
// Intentional and matches the convention for stationary field-emitters
// (DISRUPTOR fields, gravity wells, MAGNETON fields all reach through
// walls). Floor-transition wipe of `enemies` cleans up cross-floor leak.

/**
 * Pure boolean check — is the player currently inside any live unstunned
 * NULLIFIER's aura, AND not damage-immune (dash i-frames / cloak)?
 * Called from BOTH updateNullifierJam (caches the result on the player
 * for the cooldown-tick gate) AND activateHackware (fresh same-frame
 * check, eliminates 1-frame staleness for the activation path).
 *
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


// ─── Frost Patches (CRYOPHAGE area-denial tiles) ──────────────────────────────
// Each patch is { x, y, age, maxAge, tickCd, dmg, dead }.
// Lifecycle: spawned at telegraph commit in aiCryophage; ticks down per
// frame; deals damage when the player overlaps and per-patch ICD is ready.
// Dash i-frames pass through (canonical via isPlayerDamageImmune).
// Cleared on floor transition by game.js loadFloor.
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
    // FOV-cull per patch — frozen tiles outside the player's vision
    // shouldn't render (they still tick if entered, but the player
    // would never see the warning before stepping in).
    const tx = Math.floor(f.x), ty = Math.floor(f.y);
    if (!_EG.dungeon?.visible?.[ty]?.[tx]) continue;
    const sx = f.x * TILE - camX, sy = f.y * TILE - camY;
    const life = 1 - (f.age / f.maxAge);
    const pulse = 0.5 + 0.3 * Math.sin(f.age * 6);
    const r = TILE * 0.42;

    ctx.save();
    // Frosted tile fill
    ctx.globalAlpha = life * (0.20 + pulse * 0.10);
    ctx.fillStyle = '#88ddff';
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#cceeff';
    ctx.fillRect(sx - r, sy - r, r * 2, r * 2);

    // Crystalline edge ring
    ctx.globalAlpha = life * (0.5 + pulse * 0.3);
    ctx.strokeStyle = '#cceeff';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(sx - r, sy - r, r * 2, r * 2);

    // Inner crystal lattice (4 short spokes from centre)
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

// ─── Gravity Wells ────────────────────────────────────────────────────────────
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

    // Inward-pulling gradient
    ctx.globalAlpha = life * pulse * 0.2;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    grad.addColorStop(0, 'rgba(136,51,255,0.5)');
    grad.addColorStop(0.6, 'rgba(136,51,255,0.2)');
    grad.addColorStop(1, 'rgba(136,51,255,0)');
    ctx.fillStyle = grad;
    NEON.draw.circle(ctx, sx, sy, r);

    // Concentric rings pulsing inward
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

    // Centre core glow
    ctx.globalAlpha = life * 0.4;
    ctx.fillStyle = '#cc88ff';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#8833ff';
    NEON.draw.circle(ctx, sx, sy, 3 + Math.sin(w.timer * 4) * 1.5);

    ctx.restore();
  }
}
