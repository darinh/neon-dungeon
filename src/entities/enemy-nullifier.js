// @ts-check
'use strict';

/**
 * NULLIFIER - stationary anti-hackware specialist (floor 6+, hp=70,
 * atk=0, spd=0, xpVal=24, colour #cc66dd).
 *
 * The mob has NO direct AI behaviour - it neither moves nor attacks nor
 * fires. Its entire role is the persistent jam aura that gates
 * player.hackwareCooldown ticking AND blocks activateHackware. That
 * gating lives in updateNullifierJam (called from the main game loop
 * next to updateDisruptionFields) which iterates live NULLIFIERs and
 * sets player.hackwareJammed when the player is inside any aura.
 *
 * Why a no-op AI method: the canonical AI dispatch switch in
 * Enemy.update() routes every mob type to a dedicated method; if
 * NULLIFIER had no case it would fall through to the default GUARD
 * chase, which at spd=0 is a no-op anyway BUT would also try
 * canMelee/meleeAttack with atk=0 (also a no-op, so harmless), AND
 * tick attackTimer/shootTimer for nothing. Routing here makes the
 * inertness explicit and matches the convention every other
 * stationary mob (TURRET, MAGNETON, RESONATOR, MIRROR, GHOST_PROJECTOR,
 * ARCHITECT, WATCHER) follows: a named method that owns the type's
 * behaviour, even when that behaviour is "advance a visual pulse".
 *
 * Stun handling: stunTimer > 0 returns early in update() before AI
 * dispatch, so the field naturally disables under stun. updateNullifierJam
 * ALSO gates on stunTimer === 0 as a defense-in-depth check - without it,
 * a future change to the early-return convention could silently let stunned
 * NULLIFIERs keep jamming.
 *
 * @this {Enemy}
 * @param {number} dt
 * @param {any} player
 * @param {any} map
 * @param {number} d
 * @param {boolean} los
 * @returns {void}
 */
Enemy.prototype.aiNullifier = function aiNullifier(dt, player, map, d, los) {
  void player; void map; void d; void los;
  // Visual pulse: real dt, no berserker/OC mods; purely cosmetic.
  this._nlPulse = (this._nlPulse || 0) + dt * NULLIFIER_PULSE_RATE;
};
