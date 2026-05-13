// @ts-check
'use strict';

/**
 * Find the nearest non-WARDLING, non-shard, non-boss enemy in this wardling's
 * room. Returns null if no such enemy exists.
 *
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
    if (e.room !== this.room) continue;    // room-scoped only
    const d = dist(this.x, this.y, e.x, e.y);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
};

// ─── WARDLING AI — Fragile Bodyguard (positional intercept) ────────────
// The first compositional mob: WARDLING bonds to a "ward" (the nearest
// non-WARDLING, non-shard, non-boss enemy in its room) and physically
// positions itself between the player and the ward. Player projectiles
// travelling player→ward pass through WARDLING's hitbox FIRST, so the
// bodyguard naturally absorbs the shot — no special intercept logic
// required, just geometric positioning + the standard projectile-vs-
// enemy collision in content.js.
//
// No ranged attack. Damage is melee-only (atk=4, low). The threat is
// the buff to its ward, not its own DPS. A WARDLING in a room with a
// SHIELDER, REFLECTOR, RESONATOR, or any other "must-kill" target
// converts that target into a multi-step kill problem.
//
// Counter-play tiers:
//   1. Flank — orbit until WARDLING / ward / player are non-collinear
//   2. Kill the WARDLING (hp=25 base — fragile)
//   3. Bombs — area damage bypasses the line entirely
//   4. Wait for ward death by other means (fire trails, etc.)
//
// No-ward fallback: when ward dies or no ward exists in the room, the
// WARDLING enters PANIC — speeds up by WARDLING_PANIC_MUL and chases
// the player directly (basic melee). This keeps a solo WARDLING from
// becoming a free-XP statue.
//
// Hologram-taunt: the canonical _tx/_ty already redirects to the decoy.
// The interception line becomes ward → decoy, which means the WARDLING
// moves to a position the player isn't actually shooting at — the
// decoy bait costs the WARDLING its protective positioning. Working
// as intended (lesson from PROPHET / CRYOPHAGE: trust _tx/_ty).
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

  // Re-acquire ward periodically (not every frame — O(n) scan; cheap
  // but no need to do it 60 Hz). Also re-acquire IMMEDIATELY when the
  // current ward dies so the panic branch can fire next frame.
  //
  // Bug-class guard: a previous version checked `!this._wlWard` in the
  // re-acquire condition, which short-circuited past the timer when no
  // ward was found — degrading to a per-frame scan in solo/orphan
  // rooms. Caught by claude-opus-4.6 review. Now: timer ALWAYS gates
  // the scan; only an alive ward dying triggers an extra scan.
  this._wlReacquireTimer = Math.max(0, (this._wlReacquireTimer || 0) - dt);
  if (this._wlReacquireTimer <= 0 || (this._wlWard && this._wlWard.dead)) {
    this._wlWard = this._wlFindWard();
    this._wlReacquireTimer = WARDLING_REWARD_PERIOD;
  }

  const ward = this._wlWard;
  if (!ward || ward.dead) {
    // Panic: no ward to guard. Chase the canonical target (player or
    // taunt decoy via _tx/_ty) at boosted speed. A solo WARDLING is
    // a fragile rusher — easy XP for the player who isolates it.
    if (this._canTarget()) {
      this.moveToward(this._tx, this._ty, this.spd * WARDLING_PANIC_MUL, dt, map);
      // Melee on contact — without this, atk is decorative. meleeAttack
      // does its own real-player distance check, so a hologram-taunted
      // chase still whiffs (decoy bait works as expected).
      if (d < 1.2) this.meleeAttack(player);
    } else {
      this.patrol(dt, map);
    }
    return;
  }

  // Compute the interception point: ward's position + unit-vector
  // (toward _tx/_ty) * WARDLING_GUARD_DIST. _tx/_ty is canonical
  // (taunt-aware), so a hologram redirects the WARDLING off-line —
  // intentional bait reward, see banner comment.
  const pdx = this._tx - ward.x;
  const pdy = this._ty - ward.y;
  const pmag = Math.hypot(pdx, pdy);
  let tx, ty;
  if (pmag < 0.001) {
    // Player is ON the ward (melee range). Nothing to intercept —
    // hold position adjacent to the ward so player projectiles in
    // any direction still go through the WARDLING first.
    tx = ward.x; ty = ward.y;
  } else {
    const ux = pdx / pmag, uy = pdy / pmag;
    tx = ward.x + ux * WARDLING_GUARD_DIST;
    ty = ward.y + uy * WARDLING_GUARD_DIST;
  }
  this.moveToward(tx, ty, this.spd, dt, map);
  // Body-contact melee — even while guarding, if the player runs INTO
  // the WARDLING (e.g. dashing past), the bodyguard scratches them.
  // Real-player distance check inside meleeAttack handles taunt cases.
  if (d < 1.2) this.meleeAttack(player);
};
