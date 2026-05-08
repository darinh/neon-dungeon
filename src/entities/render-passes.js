// @ts-check
'use strict';

// Entity render passes are loaded after src/entities.js so they can reuse
// entity constants and collections while publishing the legacy global helpers
// invoked by game.js.

// REAPER player-ring telegraph render pass. Drawn from game.js BEFORE the
// player sprite so the ring sits underneath the player. Iterates the global
// `enemies` list — bypasses the per-enemy FOV/cull in Enemy.draw because
// the on-player warning must remain visible even when the reaper itself
// is off-screen (detect range 14 tiles can exceed the vertical half-screen
// at default zoom, so a marked player could otherwise see no warning).
/**
 * @param {any} camX
 * @param {any} camY
 */
function drawReaperPlayerRings(camX, camY) {
  if (!_EG || !_EG.player || _EG.player.dead) return;
  const pl = _EG.player;
  const psx = pl.x * TILE - camX;
  const psy = pl.y * TILE - camY;
  for (const e of enemies) {
    if (e.dead || e.type !== 'REAPER') continue;
    if (e._reState === 'telegraph' && e._reTele > 0) {
      const progress = 1 - Math.max(0, Math.min(1, e._reTele / REAPER_TELEGRAPH));
      const ringPulse = 0.5 + 0.5 * Math.sin(progress * 28);
      ctx.save();
      ctx.globalAlpha = (0.45 + progress * 0.45) * ringPulse;
      ctx.strokeStyle = '#ff2244';
      ctx.shadowBlur = 10 + progress * 14;
      ctx.shadowColor = '#ff2244';
      ctx.lineWidth = 1.8 + progress * 2.2;
      ctx.setLineDash([6, 5]);
      ctx.lineDashOffset = -progress * 24;
      NEON.draw.circleStroke(ctx, psx, psy, TILE * (0.7 + 0.3 * (1 - progress)));
      ctx.setLineDash([]);
      ctx.restore();
    } else if (e._reFrenzied && e._reFrenzy > 0) {
      const remain = Math.max(0, Math.min(1, e._reFrenzy / REAPER_FRENZY_DURATION));
      const fp = 0.5 + 0.5 * Math.sin((e.bobAngle || 0) * 6);
      ctx.save();
      ctx.globalAlpha = 0.18 * remain * (0.6 + 0.4 * fp);
      ctx.strokeStyle = '#cc1144';
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#ff2244';
      ctx.lineWidth = 1.4;
      NEON.draw.circleStroke(ctx, psx, psy, TILE * 0.85);
      ctx.restore();
    }
  }
}

// TETHER leash render pass. Drawn from game.js BEFORE the player sprite
// so the leash sits underneath the player. Iterates global `enemies`
// — bypasses per-enemy FOV cull (drawn even if TETHER body is offscreen
// at the edge of FIELD_RANGE, so the source of the slow is always
// legible). Only renders for live TETHERs whose REAL distance to the
// player is within TETHER_FIELD_RANGE — matches the slow trigger
// exactly. Telegraph parity: the visual exists if and only if the slow
// is being applied, so the player can never wonder "why am I slow".
/**
 * @param {any} camX
 * @param {any} camY
 */
function drawTetherLeashes(camX, camY) {
  if (!_EG || !_EG.player || _EG.player.dead) return;
  const pl = _EG.player;
  const psx = pl.x * TILE - camX;
  const psy = pl.y * TILE - camY;
  for (const e of enemies) {
    if (e.dead || e.type !== 'TETHER') continue;
    const pd = dist(e.x, e.y, pl.x, pl.y);
    if (pd >= TETHER_FIELD_RANGE) continue;
    const esx = e.x * TILE - camX;
    const esy = e.y * TILE - camY;
    // Slow strength normalised 0..1 for visual intensity. At melee
    // range strength->0 (no leash needed since slow is 0); at field
    // edge strength->1 (max leash drawn). Mirrors aiTether's lerp.
    let t = (pd - TETHER_MELEE_RANGE) / (TETHER_FIELD_RANGE - TETHER_MELEE_RANGE);
    if (t < 0) t = 0; else if (t > 1) t = 1;
    if (t <= 0) continue; // factor==1 (pd<=MELEE_RANGE), no slow -> no leash needed
    const phase = (e._teLashPhase || 0);
    ctx.save();
    ctx.globalAlpha = 0.30 + 0.30 * t;
    ctx.strokeStyle = '#ff8866';
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#ff8866';
    ctx.lineWidth = 1.2 + 1.0 * t;
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -((Date.now() / 30) % 1000) - phase * 4;
    NEON.draw.line(ctx, esx, esy, psx, psy);
    ctx.setLineDash([]);
    ctx.restore();
  }
}
