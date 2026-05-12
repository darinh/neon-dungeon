// @ts-check
'use strict';

/**
 * MAGNETON — stationary projectile-bender (floor 6+, hp=50, atk=0, spd=0).
 *
 * Threat model: emits a circular MAGNETON_FIELD_R-tile field that bends
 * in-flight player projectiles toward itself per frame (see
 * `magnetonBendDir`). Atk=0 → no contact damage, no fire. Pure
 * compositional hazard — pairs with melee mobs (their bodyguards) and
 * other ranged threats (your shots curve away from the threat into the
 * magneton). Counter-play: kill the magneton (it has no defense), shoot
 * from extreme range (less time in field = less bend), or lure threats
 * out of the field.
 *
 * Rules:
 *   - Iterate the global `projectiles` array each frame, bending only
 *     `fromPlayer && !dead` projectiles. Enemy projectiles are
 *     intentionally untouched — magnetons should not bend MIRROR/ECHOER
 *     shots into the player.
 *   - LOS gate: bend requires hasLOS(magneton, projectile). Without LOS,
 *     bending around walls feels physics-breaking (shots curving through
 *     solid rock toward an unseen pull source).
 *   - dist^2 fast-reject before LOS to keep this cheap on floors with
 *     many magnetons (LOS does its own raycast and is the expensive op).
 *   - Stun handling: stunTimer > 0 returns early in update() before AI
 *     dispatch — field naturally disables under stun. No telegraph
 *     state to cancel.
 *
 * No room gating: a magneton tucked in a corridor still bends shots
 * passing through the corridor (consistent with the "field is always
 * on" mental model). The LOS gate keeps the influence local.
 *
 * @this {Enemy}
 * @param {number} dt
 * @param {any} player
 * @param {any} map
 * @param {number} d
 * @param {boolean} los
 * @returns {void}
 */
Enemy.prototype.aiMagneton = function aiMagneton(dt, player, map, d, los) {
  void player; void d; void los;
  // Visual pulse — used by draw branch. Drift so clustered spawns
  // don't pulse in lock-step. Real dt (no berserker/OC mods) — purely
  // cosmetic.
  this._mgPulse = (this._mgPulse || 0) + dt;
  // Field bend: iterate projectiles, apply pull to in-range player shots
  // with LOS. Skip dead, non-player, and grenades (grenades are arc-
  // tossed with explicit targetX/targetY — bending dx/dy would make them
  // miss their target tile, which is a fairness violation since the
  // player can see the grenade's intended landing spot).
  const r2 = MAGNETON_FIELD_R * MAGNETON_FIELD_R;
  const mx = this.x, my = this.y;
  for (const p of projectiles) {
    if (!p || p.dead) continue;
    if (!p.fromPlayer) continue;
    if (p.isGrenade) continue;
    // Homing player projectiles (PLASMA_ORB upgrade, SENTRY_DRONE perk
    // — see src/game.js callsites) re-steer toward their target every
    // frame inside Projectile.update, which runs AFTER enemy AI in the
    // game loop. A bend here would be partially undone every frame and
    // the magneton's pull would feel inconsistent. Treat homing as the
    // intentional counter: homing shots pierce the field cleanly.
    if (p.homing) continue;
    const vx = mx - p.x, vy = my - p.y;
    const d2 = vx * vx + vy * vy;
    if (d2 >= r2) continue;
    // LOS gate AFTER cheap dist reject
    if (!hasLOS(mx, my, p.x, p.y, map)) continue;
    const [ndx, ndy] = magnetonBendDir(
      p.x, p.y, p.dx, p.dy, mx, my,
      MAGNETON_FIELD_R, MAGNETON_BEND_STRENGTH, dt
    );
    p.dx = ndx; p.dy = ndy;
  }
};
