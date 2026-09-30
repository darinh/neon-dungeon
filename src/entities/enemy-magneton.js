// @ts-check
'use strict';

// Field drops under stun: update() returns before this AI runs.
/**
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
  // Draw-only pulse. Real dt (no berserker/OC) so clustered spawns don't lock-step.
  this._mgPulse = (this._mgPulse || 0) + dt;
  // Grenades detonate on reaching targetX/targetY, so bending dx/dy would carry them off target.
  const r2 = MAGNETON_FIELD_R * MAGNETON_FIELD_R;
  const mx = this.x, my = this.y;
  for (const p of projectiles) {
    if (!p || p.dead) continue;
    if (!p.fromPlayer) continue;
    if (p.isGrenade) continue;
    // Homing re-steers in Projectile.update, which runs after enemy AI,
    // so a bend here would be undone every frame. Homing pierces the field.
    if (p.homing) continue;
    const vx = mx - p.x, vy = my - p.y;
    const d2 = vx * vx + vy * vy;
    if (d2 >= r2) continue;
    // LOS after the dist reject: the raycast is the expensive check.
    if (!hasLOS(mx, my, p.x, p.y, map)) continue;
    const [ndx, ndy] = magnetonBendDir(
      p.x, p.y, p.dx, p.dy, mx, my,
      MAGNETON_FIELD_R, MAGNETON_BEND_STRENGTH, dt
    );
    p.dx = ndx; p.dy = ndy;
  }
};
