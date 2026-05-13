// @ts-check
'use strict';

// ─── WATCHER AI — Stationary Sweeping-Cone Lighthouse ──────────────────
// Stationary mob (spd=0). A faint vision cone rotates continuously at
// WATCHER_SWEEP_RATE rad/s — always visible, telegraphing the sweep
// rhythm so the player can plan crossings perpendicular to the cone.
// When the player crosses the cone (inside arc + range + LOS + canTarget)
// and the WATCHER is in the sweep state, the angle locks, the wedge
// intensifies (telegraph), and after WATCHER_TELEGRAPH seconds it fires
// a hitscan beam (no projectile) for atk * WATCHER_DMG_MUL.
//
// States:
//   sweep:     _wAng advances at WATCHER_SWEEP_RATE rad/s. Each frame,
//              hit-test player against current cone+range+LOS. On hit,
//              lock the aim, transition to telegraph.
//   telegraph: _wTele ticks down; cone wedge rendered intensely. On 0,
//              fire (re-test player against locked cone+range+LOS),
//              transition to recovery. Aim is FROZEN — sweep does not
//              advance, giving the player a clear dash window.
//   recovery:  _wRec ticks down; on 0, return to sweep (resume rotation
//              from the locked angle — no snap-back).
//
// Aim source for telegraph: the WATCHER's own _wAng (sweep), NOT _tx/_ty.
// The cone direction is mechanical — set by the sweep angle at the
// moment a perceived target (player or hologram) crosses the cone.
// Hologram decoys can TRIGGER a lock (the lock-test uses _tx/_ty so
// taunts pass through, mirroring RESONATOR/MIRROR convention) but the
// beam direction itself is the swept angle, not the decoy position —
// so the player can still dodge by moving out of the locked direction
// during telegraph, even when a hologram triggered the lock.
//
// Why floor 6+: this is a positioning-puzzle mob; players need basic
// combat literacy first. Sits in the same slot as RESONATOR but with
// a distinct verb (continuous sweep vs aimed cone).
//
// Excluded from elite affix roll: same first-ship caution as the other
// recently-introduced cone-style mobs (RESONATOR / MIRROR / GULPER) —
// easier to layer SHIELDED / FRENZY interactions later than to debug
// them simultaneously with a brand-new mechanic.
/**
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 */
Enemy.prototype.aiWatcher = function aiWatcher(dt, player, map, d, los) {
  void d; void los; // recomputed against the locked aim for fairness
  const bm = this.berserkerMul();
  const ocMul = _EG.modifier === 'OVERCLOCK' ? 1.2 : 1;

  // Room-gated: only engage when target or player is inside this watcher's
  // room. Mirrors the inRoom check in aiResonator/aiMirror.
  const inRoom = this.room && (
    (this._tx >= this.room.x && this._tx < this.room.x + this.room.w &&
     this._ty >= this.room.y && this._ty < this.room.y + this.room.h) ||
    (player.x >= this.room.x && player.x < this.room.x + this.room.w &&
     player.y >= this.room.y && player.y < this.room.y + this.room.h));

  // ── Telegraph: cone locked, fire on completion ──
  if (this._wState === 'telegraph') {
    this._wTele -= dt; // fixed-rate countdown — fairness > tempo
    if (this._wTele <= 0) {
      // FIRE: hit-test player against the LOCKED cone (NOT the live sweep
      // angle — telegraph freezes the aim). LOS rechecked at fire-time
      // (defense in depth). Damage honors player damage immunity, so
      // dash i-frames are the canonical pass-through counter.
      const ax = Math.cos(this._wLockAng), ay = Math.sin(this._wLockAng);
      const dx = player.x - this.x, dy = player.y - this.y;
      const dPlayer2 = dx * dx + dy * dy;
      if (dPlayer2 <= WATCHER_RANGE * WATCHER_RANGE) {
        if (isInsideCone(player.x, player.y, this.x, this.y,
                         ax, ay, WATCHER_RANGE, WATCHER_HALF_RAD)
            && hasLOS(this.x, this.y, player.x, player.y, map)) {
          const dmg = Math.round(this.atk * WATCHER_DMG_MUL);
          player.takeDamage(dmg, 'Watcher Beam');
        }
      }
      if (audio.watcherFire) audio.watcherFire();
      // Visual punch — yellow shockwave at the apex along the locked aim.
      const tipX = this.x + ax * WATCHER_RANGE * 0.5;
      const tipY = this.y + ay * WATCHER_RANGE * 0.5;
      spawnParticles(tipX, tipY, 'EXPLOSION', '#ffee66', 10);
      triggerShake(2, 0.10);
      this._wState = 'recovery';
      this._wRec = WATCHER_RECOVERY;
      this._wTele = 0;
      // Mark the recovery as a REAL fire — the render branch keys its
      // beam-flash visual on this flag (cleared on sweep resume and on
      // stun-cancel) so a stunned/cancelled telegraph never renders a
      // fake "beam fired" line.
      this._wFired = true;
    }
    return;
  }

  // ── Recovery: cooling down, sweep paused ──
  if (this._wState === 'recovery') {
    this._wRec -= dt * ocMul * bm;
    if (this._wRec <= 0) {
      this._wState = 'sweep';
      // Beam-flash visual is one-shot per fire — clear on sweep resume so
      // the next telegraph can re-arm cleanly.
      this._wFired = false;
    }
    return;
  }

  // ── Sweep: rotate cone, scan for perceived-target crossing ──
  // Advance angle (modulo 2*PI to keep it bounded — JS floats are fine
  // for thousands of rotations but the modulo keeps the value tidy for
  // any future test asserts and is essentially free).
  this._wAng = (this._wAng + dt * WATCHER_SWEEP_RATE * ocMul * bm) % (Math.PI * 2);

  // Hit-test against current sweep angle using the TAUNT-AWARE perceived
  // target (_tx/_ty — hologram during decoy, player otherwise). This is
  // the same convention RESONATOR/MIRROR/etc. use: the lock-trigger
  // honors holograms (a decoy inside a watcher's swept cone forces a
  // telegraph commit — counterplay-relevant, lets the player BAIT
  // wasted shots). The fire-time damage hit-test below uses the REAL
  // player position, so a hologram trigger that fires while the real
  // player is OUT of the locked beam deals no damage. Mismatched
  // gates (inRoom on _tx/_ty + lock-test on player.x/y) would let a
  // hologram inside the room redirect engagement onto the real player
  // even when the real player is outside the room — the bug fixed here.
  if (!inRoom || !this._canTarget()) return;
  const dx = this._tx - this.x, dy = this._ty - this.y;
  const dPerceived2 = dx * dx + dy * dy;
  if (dPerceived2 > WATCHER_RANGE * WATCHER_RANGE) return;
  const ax = Math.cos(this._wAng), ay = Math.sin(this._wAng);
  if (!isInsideCone(this._tx, this._ty, this.x, this.y,
                    ax, ay, WATCHER_RANGE, WATCHER_HALF_RAD)) return;
  if (!hasLOS(this.x, this.y, this._tx, this._ty, map)) return;
  // LOCK: freeze aim at current sweep angle, enter telegraph. Aim is
  // FROZEN (not aimed at the perceived target) — the cone direction
  // is mechanical, set by the sweep angle at the moment of trigger.
  // The player can dodge by moving out of the locked beam direction
  // during the telegraph window.
  this._wLockAng = this._wAng;
  this._wState = 'telegraph';
  this._wTele = WATCHER_TELEGRAPH;
  if (audio.watcherCharge) audio.watcherCharge();
  // Stationary: never patrol, never reposition. Sitting duck by design.
};
