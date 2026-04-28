// @ts-check
// UNCHAINED Phase 2 (#36) — pure runtime behaviour helpers for upgrade-node
// flags set on player.metaFlags by save.applyMetaToPlayer(). Kept in a small
// isolated module so the logic can be unit-tested without constructing a full
// Player (entities.js is a browser-global script, not CommonJS importable).
//
// Hooks wired from src/entities.js:
//   - Player.shoot       → computeOutgoingDmgMul + consumeSurgeShot
//   - Enemy.die          → onKillRefreshMomentum
//   - Player.update      → tickMomentum + tickOutOfCombatRegen
//   - Player.takeDamage  → resetOutOfCombat (on actual damage) + tryMetaSecondWind
//
// Design notes:
//   * All functions are defensive on missing metaFlags / undefined fields.
//   * `player` is duck-typed — any object with the listed fields works. This
//     is what lets us unit-test with plain literals.
//   * Surge intentionally counts *attacks* (one per shoot() call), not
//     per-projectile hits. Rationale: a multi-pellet or piercing shot is one
//     attack, so triggering surge on "every 8th attack" matches the UX
//     described by the Upgrade Matrix tooltip and is deterministic per shot.

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    /** @type {any} */ (root).NEON = /** @type {any} */ (root).NEON || {};
    /** @type {any} */ (root).NEON.behavior = factory();
  }
})(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {

  // Overall outgoing-damage multiplier from persistent upgrade nodes
  // (excluding surge which is consumed separately at shot time).
  //   damageMult : stat carrier from overclock (1 + 0.05*level)
  //   momentum   : flag — while _momentumTimer > 0, +15% damage per level
  /** @param {any} player */
  function computeOutgoingDmgMul(player) {
    let mul = player.damageMult || 1;
    const f = player.metaFlags;
    if (f) {
      const momLv = f.momentum | 0;
      if (momLv > 0 && (player._momentumTimer || 0) > 0) {
        mul *= (1 + 0.15 * momLv);
      }
    }
    return mul;
  }

  // Advance the surge shot counter and return the multiplier for *this* shot.
  // Returns 1 when surge doesn't trigger. Mutates player._surgeShotCount.
  /** @param {any} player */
  function consumeSurgeShot(player) {
    const f = player.metaFlags;
    const surgeLv = f ? (f.surge | 0) : 0;
    player._surgeShotCount = ((player._surgeShotCount | 0) + 1) | 0;
    if (surgeLv > 0 && player._surgeShotCount % 8 === 0) {
      return 1 + 1.0 * surgeLv;
    }
    return 1;
  }

  // Called from Enemy.die() — refresh the 3-second momentum window on any
  // enemy death. No-op when player has no momentum node.
  /** @param {any} player */
  function onKillRefreshMomentum(player) {
    if (!player || !player.metaFlags) return;
    if ((player.metaFlags.momentum | 0) > 0) {
      player._momentumTimer = 3;
    }
  }

  // Countdown the momentum window. Safe on players without the flag.
  /** @param {any} player @param {number} dt */
  function tickMomentum(player, dt) {
    if ((player._momentumTimer || 0) > 0) {
      player._momentumTimer = Math.max(0, player._momentumTimer - dt);
    }
  }

  // Out-of-combat regen tick. Resets-to-zero are the caller's responsibility
  // (done in takeDamage via resetOutOfCombat). 3-second "out of combat"
  // threshold chosen to match typical ARPG regen grace periods — short
  // enough to be felt during exploration, long enough to not trivialise
  // combat encounters.
  /** @param {any} player @param {number} dt */
  function tickOutOfCombatRegen(player, dt) {
    player._outOfCombatTimer = (player._outOfCombatTimer || 0) + dt;
    if (player.regenPerSec && player._outOfCombatTimer > 3 && player.hp < player.maxHp) {
      player.hp = Math.min(player.maxHp, player.hp + player.regenPerSec * dt);
    }
  }

  /** @param {any} player */
  function resetOutOfCombat(player) {
    player._outOfCombatTimer = 0;
  }

  // Attempt the meta second_wind revive. Returns true if it fired (caller
  // must then apply visual/audio fx and skip the death path). Parallel to
  // the legacy SECOND_WIND perk — they fire independently.
  /** @param {any} player */
  function tryMetaSecondWind(player) {
    const f = player.metaFlags;
    const lv = f ? (f.second_wind | 0) : 0;
    if (lv <= 0 || player._metaSecondWindUsed) return false;
    player._metaSecondWindUsed = true;
    player.hp = Math.max(1, Math.round(player.maxHp * (0.25 * lv)));
    return true;
  }

  // trauma_kit panic-button auto-heal. Reinterpreted from the upgrade matrix
  // contract "Start each run with N nano-medic consumables" because the game
  // has no boost-inventory system to honour the literal reading. Mechanic:
  // when the player drops below 25% maxHp from a non-lethal hit and at least
  // one charge is available, consume one charge and heal 40% maxHp (matching
  // the NANO_MEDIC vendor boost). Distinct from second_wind (which fires on
  // LETHAL damage) — this fires on chip damage that crosses the panic
  // threshold while the player is still alive. Returns true on consumption
  // so callers can apply visual/audio fx. Charges seeded by
  // applyMetaToPlayer(trauma_kit) and persisted on save/resume so a Continue
  // mid-run preserves remaining charges. Defensive on missing fields. The
  // 40% heal is large enough to bump the player well above 25%, so a single
  // hit cannot consume two charges in a row — re-arming requires the player
  // to be ground back down across the 25% line again.
  /** @param {any} player */
  function tryTraumaKit(player) {
    if (!player) return false;
    const charges = player._nanoMedicCharges | 0;
    if (charges <= 0) return false;
    const maxHp = player.maxHp || 0;
    if (!Number.isFinite(maxHp) || maxHp <= 0) return false;
    // Reject non-finite hp explicitly — without this, NaN bypasses both
    // the lethal-hit gate (NaN <= 0 is false) AND the threshold gate
    // (NaN >= ... is false), so a corrupted save with hp=NaN would
    // silently drain every charge while hp stayed NaN. Same defence as
    // the sensorRadiusMult sanitization in src/content.js updateLighting
    // (per stored memory 'FOV cache key').
    if (!Number.isFinite(player.hp)) return false;
    if (player.hp <= 0) return false; // leave revives to second_wind
    if (player.hp >= maxHp * 0.25) return false;
    player._nanoMedicCharges = charges - 1;
    const heal = Math.round(maxHp * 0.4);
    player.hp = Math.min(maxHp, player.hp + heal);
    return true;
  }

  return {
    computeOutgoingDmgMul,
    consumeSurgeShot,
    onKillRefreshMomentum,
    tickMomentum,
    tickOutOfCombatRegen,
    resetOutOfCombat,
    tryMetaSecondWind,
    tryTraumaKit,
  };
});
