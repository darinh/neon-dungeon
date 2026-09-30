// @ts-check
'use strict';

/**
 * @this {Enemy}
 * @returns {any}
 */
Enemy.prototype._wlFindWard = function _wlFindWard() {
  let best = null;
  let bestD = Infinity;
  for (const e of enemies) {
    if (e === this || e.dead) continue;
    if (e.type === 'WARDLING') continue;   // wardlings don't guard each other (no infinite chains)
    if (e.isShard || e.isBoss) continue;   // bosses have their own kit; shards are short-lived
    if (e.room !== this.room) continue;
    const d = dist(this.x, this.y, e.x, e.y);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
};

// No intercept logic: body sits on the player→ward line so content.js projectile collision absorbs the shot.
// _tx/_ty is taunt-aware, so a hologram decoy pulls the wardling off the real firing line.
/**
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 * @returns {void}
 */
Enemy.prototype.aiWardling = function aiWardling(dt, player, map, d, los) {
  void los; // wardling doesn't shoot — no LoS check needed

  // Re-acquire on a timer (O(n) scan, not every frame). Extra scan only when the current ward dies — a missing ward must not bypass the timer.
  this._wlReacquireTimer = Math.max(0, (this._wlReacquireTimer || 0) - dt);
  if (this._wlReacquireTimer <= 0 || (this._wlWard && this._wlWard.dead)) {
    this._wlWard = this._wlFindWard();
    this._wlReacquireTimer = WARDLING_REWARD_PERIOD;
  }

  const ward = this._wlWard;
  if (!ward || ward.dead) {
    if (this._canTarget()) {
      this.moveToward(this._tx, this._ty, this.spd * WARDLING_PANIC_MUL, dt, map);
      // meleeAttack checks real-player distance, so a taunted chase still whiffs.
      if (d < 1.2) this.meleeAttack(player);
    } else {
      this.patrol(dt, map);
    }
    return;
  }

  const pdx = this._tx - ward.x;
  const pdy = this._ty - ward.y;
  const pmag = Math.hypot(pdx, pdy);
  let tx, ty;
  if (pmag < 0.001) {
    tx = ward.x; ty = ward.y;
  } else {
    const ux = pdx / pmag, uy = pdy / pmag;
    tx = ward.x + ux * WARDLING_GUARD_DIST;
    ty = ward.y + uy * WARDLING_GUARD_DIST;
  }
  this.moveToward(tx, ty, this.spd, dt, map);
  // Contact damage even while guarding. meleeAttack uses real-player distance, so taunt still whiffs.
  if (d < 1.2) this.meleeAttack(player);
};
