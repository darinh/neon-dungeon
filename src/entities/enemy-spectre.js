// @ts-check
'use strict';

/**
 * Stun forces an immediate manifest before AI dispatch, so EMP is not a
 * free phase. phaseImmune is owned here; SPECTRE is excluded from the
 * PHASING elite roll so that tick cannot also write the flag.
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
    // No meleeAttack while phased — contact damage would bypass the immune flag.
    if (los || (d < SPECTRE_CHASE_RANGE && this._canTarget())) {
      this.moveToward(this._tx, this._ty, this.spd, dt, map);
    } else {
      this.patrol(dt, map);
    }
    if (this._spTimer <= 0) {
      this._spState = 'manifest';
      this._spTimer = SPECTRE_MANIFEST_DUR;
      this.phaseImmune = false;
      spawnParticles(this.x, this.y, 'SPARK', '#eeccff', 6);
    }
  } else {
    // Stationary while manifested. Moving here would hide the vulnerability window.
    this.phaseImmune = false;
    if (d < SPECTRE_MELEE_RANGE) this.meleeAttack(player);
    if (this._spTimer <= 0) {
      this._spState = 'phase';
      this._spTimer = SPECTRE_PHASE_DUR;
      this.phaseImmune = true;
    }
  }
};
