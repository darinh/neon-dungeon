// @ts-check
'use strict';

/**
 * SAPPER - boost-drain leech (floor 5+, hp=22, atk=6, spd=2.8).
 *
 * Pure melee chaser: pursues the player with LOS gating, patrols
 * when blind, calls meleeAttack on adjacency. The leech-on-hit side
 * effect lives INSIDE meleeAttack alongside CRAWLER's burn (gated
 * on `dealt > 0` so a parry / shield-absorb correctly skips the
 * drain). See SAPPER_* constants block for design intent.
 *
 * Excluded from the elite affix roll: while the affix flags don't
 * directly conflict with anything SAPPER touches, the drain
 * mechanic is novel enough that we keep the surface area minimal
 * for the first ship - easier to add later than to reason about
 * SHIELDED / PHASING / FRENZY interactions for a brand-new
 * mechanic. Mirror the existing exclusion pattern for
 * recently-introduced mobs (HARVESTER / MAGNETON / SPECTRE).
 *
 * @this {Enemy}
 * @param {number} dt
 * @param {any} player
 * @param {any} map
 * @param {number} d
 * @param {boolean} los
 * @returns {void}
 */
Enemy.prototype.aiSapper = function aiSapper(dt, player, map, d, los) {
  if (los || (d < SAPPER_CHASE_RANGE && this._canTarget())) {
    this.moveToward(this._tx, this._ty, this.spd, dt, map);
  } else {
    this.patrol(dt, map);
  }
  // Explicit melee on contact - without this, atk is decorative
  // (no generic enemy-body collision damage path exists).
  // meleeAttack is taunt-aware internally; passing `player` is
  // correct even when the mob is targeting a hologram decoy.
  if (d < SAPPER_MELEE_RANGE) this.meleeAttack(player);
};
