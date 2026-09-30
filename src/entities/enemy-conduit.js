// @ts-check
'use strict';

// Segment, not the infinite line. Damage immunity is player.takeDamage's job.
/**
 * @this {Enemy}
 * @param {any} player
 * @param {any} other
 * @returns {boolean}
 */
Enemy.prototype._cdHitsPlayer = function _cdHitsPlayer(player, other) {
  const ax = this.x, ay = this.y;
  const bx = other.x, by = other.y;
  const px = player.x, py = player.y;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 0.0001) return false; // degenerate (overlapping conduits)
  const t = ((px - ax) * dx + (py - ay) * dy) / len2;
  if (t < 0 || t > 1) return false;
  const cx = ax + t * dx, cy = ay + t * dy;
  const ex = px - cx, ey = py - cy;
  return (ex * ex + ey * ey) <= CONDUIT_BEAM_W * CONDUIT_BEAM_W;
};

/**
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 */
Enemy.prototype.aiConduit = function aiConduit(dt, player, map, d, los) {
  void d; void los;
  const bm = this.berserkerMul();
  const ocMul = _EG.modifier === 'OVERCLOCK' ? 1.2 : 1;

  // Always, even with no partner, so a broken link does not carry a stale ICD. Real dt: the ICD is not a tempo knob.
  if (this._cdLinkICD && this._cdLinkICD.size > 0) {
    for (const k of this._cdLinkICD.keys()) {
      const v = this._cdLinkICD.get(k) - dt;
      if (v <= 0) this._cdLinkICD.delete(k);
      else this._cdLinkICD.set(k, v);
    }
  }

  // Stunned partners cannot form a beam.
  let pairCount = 0;
  const inRoom = this.room ? enemiesByRoom.get(this.room) : null;
  if (inRoom) {
    const livePartnerEids = new Set();
    for (const other of inRoom) {
      if (other === this || !other || other.dead) continue;
      if (other.type !== 'CONDUIT') continue;
      if (typeof other._cdEid !== 'number') continue;
      if (other.stunTimer && other.stunTimer > 0) continue;
      livePartnerEids.add(other._cdEid);
      pairCount++;
      // Lower _cdEid owns damage checks; rendering intentionally draws from both endpoints.
      if (this._cdEid >= other._cdEid) continue;
      if (!hasLOS(this.x, this.y, other.x, other.y, map)) continue;
      const icd = this._cdLinkICD.get(other._cdEid) || 0;
      if (icd > 0) continue;
      if (this._cdHitsPlayer(player, other)) {
        const dmg = Math.max(1, Math.round(this.atk * CONDUIT_BEAM_DMG_MUL));
        player.takeDamage(dmg, 'Conduit Beam');
        this._cdLinkICD.set(other._cdEid, CONDUIT_BEAM_ICD);
        if (audio.conduitBeam) audio.conduitBeam();
      }
    }
    // Otherwise the Map grows unbounded across the run.
    if (this._cdLinkICD.size > 0) {
      for (const k of this._cdLinkICD.keys()) {
        if (!livePartnerEids.has(k)) this._cdLinkICD.delete(k);
      }
    }
  } else if (this._cdLinkICD && this._cdLinkICD.size > 0) {
    // Room ref can be cleared; do not keep ICDs for a room we no longer occupy.
    this._cdLinkICD.clear();
  }

  // Drain only while solo. Draining during a pair would already be negative when the partner dies, so the survivor would fire the same frame.
  if (pairCount === 0) {
    this._cdSoloTimer -= dt * ocMul * bm;
    if (this._cdSoloTimer <= 0) {
      if (this._canTarget()) {
        const tx = this._tx, ty = this._ty;
        const ddx = tx - this.x, ddy = ty - this.y;
        const dPlayer = Math.hypot(ddx, ddy);
        if (dPlayer > 0.1 && dPlayer <= CONDUIT_SOLO_RANGE && hasLOS(this.x, this.y, tx, ty, map)) {
          const dmg = Math.max(1, Math.round(this.atk * CONDUIT_SOLO_DMG_MUL));
          this.fireAt(tx, ty, CONDUIT_SOLO_PROJ_SPD, dmg, CONDUIT_SOLO_RANGE, '#44ffff');
          if (audio.conduitFire) audio.conduitFire();
        }
      }
      this._cdSoloTimer = CONDUIT_SOLO_FIRE_CD;
    }
  } else {
    // Hold a grace period so breaking the pair does not fire a solo shot immediately.
    if (this._cdSoloTimer < 0.5) this._cdSoloTimer = 0.5;
  }

  // Stationary, but walking into the body still hurts.
  const dPlayerLive = dist(this.x, this.y, player.x, player.y);
  if (dPlayerLive < 1.2) this.meleeAttack(player);
};
