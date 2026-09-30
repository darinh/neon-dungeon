// @ts-check
// metaFlags come from save.applyMetaToPlayer. Isolated so tests need no Player (entities.js is not CommonJS).
// Wired from entities.js: shoot → computeOutgoingDmgMul + consumeSurgeShot; die → onKillRefreshMomentum; update → tickMomentum + tickOutOfCombatRegen; takeDamage → resetOutOfCombat + tryMetaSecondWind.
// Surge counts shoot() calls, not projectiles, so a multi-pellet shot is one attack.

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    /** @type {any} */ (root).NEON = /** @type {any} */ (root).NEON || {};
    /** @type {any} */ (root).NEON.behavior = factory();
  }
})(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {

  // Surge is applied in consumeSurgeShot, not here.
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

  /** @param {any} player */
  function onKillRefreshMomentum(player) {
    if (!player || !player.metaFlags) return;
    if ((player.metaFlags.momentum | 0) > 0) {
      player._momentumTimer = 3;
    }
  }

  /** @param {any} player @param {number} dt */
  function tickMomentum(player, dt) {
    if ((player._momentumTimer || 0) > 0) {
      player._momentumTimer = Math.max(0, player._momentumTimer - dt);
    }
  }

  // Caller (takeDamage → resetOutOfCombat) owns the reset; this only counts up.
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

  // True means the caller skips death and plays fx. Independent of the SECOND_WIND perk.
  /** @param {any} player */
  function tryMetaSecondWind(player) {
    const f = player.metaFlags;
    const lv = f ? (f.second_wind | 0) : 0;
    if (lv <= 0 || player._metaSecondWindUsed) return false;
    player._metaSecondWindUsed = true;
    player.hp = Math.max(1, Math.round(player.maxHp * (0.25 * lv)));
    return true;
  }

  // No consumable inventory, so charges auto-heal under 25% HP. Not second_wind (that is lethal). 40% heal means one hit cannot spend two charges.
  /** @param {any} player */
  function tryTraumaKit(player) {
    if (!player) return false;
    const charges = player._nanoMedicCharges | 0;
    if (charges <= 0) return false;
    const maxHp = player.maxHp || 0;
    if (!Number.isFinite(maxHp) || maxHp <= 0) return false;
    // NaN fails both hp <= 0 and the 25% gate, so it would drain every charge.
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
