// @ts-check
'use strict';

/**
 * SPECTRE — phase/manifest cycler (floor 7+, hp=28, atk=12, spd=2.4).
 *
 * State machine (see SPECTRE_* constants block for tuning + design
 * intent):
 *
 *   phase    → invulnerable, chases, deals NO contact damage. Body
 *              drawn translucent. Last SPECTRE_TELEGRAPH_DUR of the
 *              window ramps alpha for "about to manifest" tell.
 *   manifest → vulnerable, stationary (no chase, no patrol), deals
 *              contact damage on adjacency. Body drawn solid + glowing
 *              ring (vulnerability tell + window indicator).
 *
 * The cycle loops indefinitely until killed during a manifest window.
 * Stun coupling: stun forces immediate manifest with a fixed short
 * window so EMP/Shock isn't counter-productive (handled in update()
 * before AI dispatch — see stun block).
 *
 * Damage absorption is implemented via the existing `phaseImmune`
 * flag (already consumed by takeDamage to print the 'PHASE' label and
 * return 0). SPECTRE is excluded from the elite-affix roll so the
 * PHASING affix tick can't double-manage the same flag.
 *
 * @this {Enemy}
 * @param {number} dt
 * @param {any} player
 * @param {any} map
 * @param {number} d
 * @param {boolean} los
 * @returns {void}
 */
Enemy.prototype.aiSpectre = function aiSpectre(dt, player, map, d, los) {
  this._spTimer -= dt;
  if (this._spState === 'phase') {
    this.phaseImmune = true;
    // Chase the player (LOS-gated like other chasers). No contact damage
    // — we explicitly do NOT call meleeAttack here. Patrol when blind.
    if (los || (d < SPECTRE_CHASE_RANGE && this._canTarget())) {
      this.moveToward(this._tx, this._ty, this.spd, dt, map);
    } else {
      this.patrol(dt, map);
    }
    if (this._spTimer <= 0) {
      this._spState = 'manifest';
      this._spTimer = SPECTRE_MANIFEST_DUR;
      this.phaseImmune = false;
      // Tiny solidify burst — visual confirmation of state change.
      spawnParticles(this.x, this.y, 'SPARK', '#eeccff', 6);
    }
  } else {
    // 'manifest' — stationary, vulnerable, melee on adjacency.
    this.phaseImmune = false;
    if (d < SPECTRE_MELEE_RANGE) this.meleeAttack(player);
    if (this._spTimer <= 0) {
      this._spState = 'phase';
      this._spTimer = SPECTRE_PHASE_DUR;
      this.phaseImmune = true;
    }
  }
};
