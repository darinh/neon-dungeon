// @ts-check
'use strict';

// CONDUIT beam hit-test: returns true iff the player's center lies within
// CONDUIT_BEAM_W tiles perpendicular to the segment from this conduit to the
// linked conduit, and projects onto the segment rather than the infinite line.
// Damage immunity is deferred to player.takeDamage.
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
  // Projection parameter t in [0,1] along segment.
  const t = ((px - ax) * dx + (py - ay) * dy) / len2;
  if (t < 0 || t > 1) return false;
  const cx = ax + t * dx, cy = ay + t * dy;
  const ex = px - cx, ey = py - cy;
  return (ex * ex + ey * ey) <= CONDUIT_BEAM_W * CONDUIT_BEAM_W;
};

// ─── CONDUIT AI — Paired-Beam Mob ──────────────────────────────────────
// Stationary mob (spd=0). Threat budget is in PAIRING:
//   solo: weak basic shot every CONDUIT_SOLO_FIRE_CD seconds (anti-XP-camp).
//   paired: each ALIVE same-room CONDUIT pair forms a damaging beam line
//           between bodies. Player perpendicular distance to the segment
//           < CONDUIT_BEAM_W, projection within [0,L], and not damage-immune
//           → damage with per-LINK ICD (CONDUIT_BEAM_ICD).
//
// Pair ownership: deterministic by _cdEid. For any pair (A,B), the lower-
// _cdEid conduit OWNS the link — runs ICD + damage check + emits the draw
// line. The higher-eid one is silent for that pair. Prevents double-damage
// and double-draw without a global pass.
//
// LoS: pair link requires hasLOS between the two CONDUIT bodies. A wall
// segment between them breaks the beam. Solo fire requires LoS to player.
//
// Counter-play: dash through (i-frames), kill one conduit, or flank.
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

  // Drain ICDs first (always — even when no partner present this frame,
  // so a freshly-broken link doesn't carry a stale value into the next
  // pairing). Use real dt (no mods) — ICD is a fairness contract, not a
  // tempo knob.
  if (this._cdLinkICD && this._cdLinkICD.size > 0) {
    for (const k of this._cdLinkICD.keys()) {
      const v = this._cdLinkICD.get(k) - dt;
      if (v <= 0) this._cdLinkICD.delete(k);
      else this._cdLinkICD.set(k, v);
    }
  }

  // Pair scan: same-room CONDUITs only. enemiesByRoom is the canonical
  // O(1)-lookup Set used by VENGEANCE/REAPER notifications. Skip dead,
  // skip self, skip non-CONDUIT, skip stunned partners (stunned partners
  // can't form a coherent beam — fairness contract: stun = beam off).
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
      // Only the LOWER-_cdEid conduit handles damage for this pair.
      if (this._cdEid >= other._cdEid) continue;
      // LoS between bodies — wall breaks the beam.
      if (!hasLOS(this.x, this.y, other.x, other.y, map)) continue;
      // Per-link ICD gate.
      const icd = this._cdLinkICD.get(other._cdEid) || 0;
      if (icd > 0) continue;
      // Hit-test player against segment (this) → (other).
      if (this._cdHitsPlayer(player, other)) {
        const dmg = Math.max(1, Math.round(this.atk * CONDUIT_BEAM_DMG_MUL));
        player.takeDamage(dmg, 'Conduit Beam');
        this._cdLinkICD.set(other._cdEid, CONDUIT_BEAM_ICD);
        if (audio.conduitBeam) audio.conduitBeam();
      }
    }
    // Garbage-collect ICD entries for partners that have died or left
    // the room. Without this the Map grows unbounded across the run.
    if (this._cdLinkICD.size > 0) {
      for (const k of this._cdLinkICD.keys()) {
        if (!livePartnerEids.has(k)) this._cdLinkICD.delete(k);
      }
    }
  } else if (this._cdLinkICD && this._cdLinkICD.size > 0) {
    // No room set — can happen if the conduit's room ref is cleared.
    // Wipe ICDs to keep state clean.
    this._cdLinkICD.clear();
  }

  // Solo fire: only when NO live same-room partners. Prevents
  // double-pressure (beam + projectile) and gives the player a clean
  // "kill one, fight one" decision after breaking the link.
  //
  // CRITICAL: drain the timer ONLY while solo. If we drained it during
  // pairing, the survivor of a long-paired room would fire a solo shot
  // the SAME FRAME the partner died (the timer would already be deeply
  // negative) — instant unfair punishment for the player breaking the
  // link. Caught by codex+gpt-5.5+opus on initial PR review.
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
    // While paired: hold the solo timer at its initial-stagger value so
    // that when the pair eventually breaks, the survivor still has a
    // grace period before firing (matching the spawn-time stagger
    // contract). Clamps to >= 0.5s.
    if (this._cdSoloTimer < 0.5) this._cdSoloTimer = 0.5;
  }

  // Body contact melee — same body-touch fairness as every other
  // stationary mob (RESONATOR/MIRROR/VENGEANCE). Walking INTO a
  // turret should hurt.
  const dPlayerLive = dist(this.x, this.y, player.x, player.y);
  if (dPlayerLive < 1.2) this.meleeAttack(player);
};
