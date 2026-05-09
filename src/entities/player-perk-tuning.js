// @ts-check
'use strict';

// Player perk tuning constants consumed by src/entities.js Player logic.

// STRIDE perk constants. STRIDE_MOVE_RATE matches the HUNTER tiles/sec
// threshold convention (per stored memory: any "moving vs not moving"
// gate must use moved/dt, NOT a tiles/frame absolute) so behaviour is
// identical at 30/60/120 fps.
const STRIDE_MOVE_RATE = 0.5;     // tiles/sec - counts as "moving"
const STRIDE_PER_STACK = 1.0;     // seconds of movement per stack
const STRIDE_MAX_STACKS = 5;
const STRIDE_DMG_PER_STACK = 0.05; // +5% ATK per stack
const STRIDE_RESET_GRACE = 0.3;   // seconds of stillness before stacks drop

// DEADEYE perk constants. Stillness counterpart to STRIDE - same tiles/sec
// rate threshold convention so behaviour is identical at 30/60/120 fps.
// While the player's movement rate stays BELOW DEADEYE_MOVE_RATE, charge
// builds for DEADEYE_CHARGE_TIME seconds; at full charge the next outgoing
// attack (ranged or melee) gets xDEADEYE_DMG_MUL via the metaMul path in
// shoot(). Once charged, the readiness flag persists across movement
// (kite-and-snipe is intentional) until consumed by a single shot - see
// the DEADEYE tick block in Player.update for the cancel-partial vs
// preserve-ready split.
const DEADEYE_MOVE_RATE = 0.5;    // tiles/sec - at/above counts as "moving"
const DEADEYE_CHARGE_TIME = 1.0;  // seconds of stillness to fully charge
const DEADEYE_DMG_MUL = 1.5;      // +50% damage on the charged attack

// HOT_HAND perk constants. Rewards focused fire on a single target -
// each consecutive direct hit on the SAME enemy adds HOT_HAND_PER_STACK
// damage, up to HOT_HAND_MAX_STACKS extra hits beyond the first. The
// streak resets when the player switches targets (different enemy ref)
// or stops hitting for HOT_HAND_WINDOW seconds. Both reset paths are
// required: the target check rewards laser focus on tanks, the timer
// prevents stale streaks from carrying through long disengagements
// (e.g., a teleport pad sequence with no combat in between).
//
// Bonus formula: bonus = min(streak - 1, HOT_HAND_MAX_STACKS) * HOT_HAND_PER_STACK
//   1st hit on a target  -> streak=1 -> +0%
//   2nd hit              -> streak=2 -> +5%
//   ...
//   7th hit and beyond   -> streak>=7 -> +30% (capped)
//
// Hooks live in Enemy.takeDamage at the same chokepoint as the EXPLOITER
// perk and MARK affix bonuses (BEFORE shield/DR/NEXUS) so the multiplier
// follows the standard damage-mitigation pipeline. Multiplicative with
// EXPLOITER and MARK by design - a focus-fire build that lands its 7th
// consecutive hit on a marked, burning target with EXPLOITER active gets
// (1.30 MARK) x (1.25 EXPLOITER) x (1.30 HOT_HAND) ~= +111% damage. That's
// strong but requires three independent build conditions to align.
const HOT_HAND_PER_STACK = 0.05;   // +5% per consecutive hit
const HOT_HAND_MAX_STACKS = 6;     // cap -> +30% at streak >= 7
const HOT_HAND_WINDOW    = 3.0;    // seconds since last hit before streak resets
