// @ts-check
// UNCHAINED Phase 3 (#38) — In-run temp boosts.
//
// Replaces permanent-upgrade slots in the vendor pool. Credits now buy only
// floor-scoped power: damage, speed, crit, a one-shot shield charge, an
// instant heal, or a full-floor minimap reveal.
//
// Design notes:
//   * Every boost is either "floor" (active for current floor) or "instant"
//     (applied once on purchase, no duration).
//   * `player.activeBoosts` is a plain {id: true} map — cleared by
//     clearFloorBoosts() on every fresh floor transition (not on save-resume).
//   * SHIELD_DRIVER is "instant" — it grants `player._shieldCharges` which
//     persists until consumed by takeDamage OR wiped by clearFloorBoosts.
//   * NANO_MEDIC fires once and leaves no residue.
//   * RECON_PING flips `player.activeBoosts.RECON_PING` and the HUD + minimap
//     system read it per-floor (clearFloorBoosts wipes it).
//
// All helpers are pure on their `player` argument so this module is testable
// without the browser runtime.

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    /** @type {any} */ (root).NEON = /** @type {any} */ (root).NEON || {};
    /** @type {any} */ (root).NEON.boosts = factory();
  }
})(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {

  // Boost catalogue. `apply` runs at purchase time; `duration` controls whether
  // the boost lingers as an active flag until floor transition.
  /** @type {Record<string, any>} */
  const BOOSTS = {
    COMBAT_STIM: {
      id: 'COMBAT_STIM', name: 'COMBAT STIM', icon: '⚔',
      desc: '+15% damage (this floor)', colour: '#ff6644', price: 15,
      duration: 'floor', dmgMul: 1.15,
      apply: function (/** @type {any} */ player) { player.activeBoosts = player.activeBoosts || {}; player.activeBoosts.COMBAT_STIM = true; }
    },
    REFLEX_BOOSTER: {
      id: 'REFLEX_BOOSTER', name: 'REFLEX BOOSTER', icon: '»',
      desc: '+10% move speed (this floor)', colour: '#44ff88', price: 12,
      duration: 'floor', spdMul: 1.10,
      apply: function (/** @type {any} */ player) { player.activeBoosts = player.activeBoosts || {}; player.activeBoosts.REFLEX_BOOSTER = true; }
    },
    CRIT_MATRIX: {
      id: 'CRIT_MATRIX', name: 'CRIT MATRIX', icon: '✦',
      desc: '+8% crit chance (this floor)', colour: '#ffdd44', price: 18,
      duration: 'floor', critBonus: 0.08,
      apply: function (/** @type {any} */ player) { player.activeBoosts = player.activeBoosts || {}; player.activeBoosts.CRIT_MATRIX = true; }
    },
    SHIELD_DRIVER: {
      id: 'SHIELD_DRIVER', name: 'SHIELD DRIVER', icon: '◈',
      desc: '+1 shield charge (absorbs next hit)', colour: '#44aaff', price: 20,
      duration: 'instant',
      apply: function (/** @type {any} */ player) { player._shieldCharges = (player._shieldCharges | 0) + 1; }
    },
    NANO_MEDIC: {
      id: 'NANO_MEDIC', name: 'NANO-MEDIC', icon: '✚',
      desc: 'Heal 40% max HP now', colour: '#00ffaa', price: 10,
      duration: 'instant',
      apply: function (/** @type {any} */ player) {
        const heal = Math.round((player.maxHp || 0) * 0.4);
        player.hp = Math.min(player.maxHp || 0, (player.hp || 0) + heal);
      }
    },
    RECON_PING: {
      id: 'RECON_PING', name: 'RECON PING', icon: '⌬',
      desc: 'Reveal full minimap (this floor)', colour: '#44ccff', price: 15,
      duration: 'floor',
      apply: function (/** @type {any} */ player) { player.activeBoosts = player.activeBoosts || {}; player.activeBoosts.RECON_PING = true; }
    }
  };

  const BOOST_KEYS = Object.keys(BOOSTS);

  // Buy-time application. Returns true if applied (always true for now; kept
  // as a boolean so future gating — e.g. max-stack — has an opt-out channel).
  /** @param {any} player @param {string} id */
  function applyBoost(player, id) {
    const b = BOOSTS[id];
    if (!b || !player) return false;
    b.apply(player);
    return true;
  }

  // Wipe all floor-scoped boosts + consume the one-shot shield charge. Called
  // from game.loadFloor on every fresh transition. Save-resume does NOT call
  // this (continuing a run keeps purchased power until the floor ends — the
  // boost state is serialised in saveGame and restored in continueGame).
  /** @param {any} player */
  function clearFloorBoosts(player) {
    if (!player) return;
    player.activeBoosts = {};
    player._shieldCharges = 0;
  }

  // Does the player have a floor-duration boost active right now?
  /** @param {any} player @param {string} id */
  function hasBoost(player, id) {
    return !!(player && player.activeBoosts && player.activeBoosts[id]);
  }

  // Aggregate multipliers/bonuses. All default to neutral when inactive.
  /** @param {any} player */
  function getBoostDamageMul(player) {
    return hasBoost(player, 'COMBAT_STIM') ? BOOSTS.COMBAT_STIM.dmgMul : 1;
  }
  /** @param {any} player */
  function getBoostSpeedMul(player) {
    return hasBoost(player, 'REFLEX_BOOSTER') ? BOOSTS.REFLEX_BOOSTER.spdMul : 1;
  }
  /** @param {any} player */
  function getBoostCritBonus(player) {
    return hasBoost(player, 'CRIT_MATRIX') ? BOOSTS.CRIT_MATRIX.critBonus : 0;
  }

  // Consume one shield charge if available. Returns true when a hit was
  // absorbed. Caller is expected to short-circuit their damage path.
  /** @param {any} player */
  function consumeShieldCharge(player) {
    if (!player || (player._shieldCharges | 0) <= 0) return false;
    player._shieldCharges = (player._shieldCharges | 0) - 1;
    return true;
  }

  // HUD strip data. Returns an ordered array of {id, name, icon, colour,
  // detail} entries for the HUD to render below the minimap.
  /** @param {any} player */
  function getActiveBoostList(player) {
    /** @type {Array<{id:string,name:string,icon:string,colour:string,detail:string}>} */
    const out = [];
    if (!player) return out;
    // Floor-scoped first, then the one-shot shield if any charges remain.
    if (hasBoost(player, 'COMBAT_STIM'))    out.push({ id: 'COMBAT_STIM',    name: BOOSTS.COMBAT_STIM.name,    icon: BOOSTS.COMBAT_STIM.icon,    colour: BOOSTS.COMBAT_STIM.colour,    detail: 'FLOOR' });
    if (hasBoost(player, 'REFLEX_BOOSTER')) out.push({ id: 'REFLEX_BOOSTER', name: BOOSTS.REFLEX_BOOSTER.name, icon: BOOSTS.REFLEX_BOOSTER.icon, colour: BOOSTS.REFLEX_BOOSTER.colour, detail: 'FLOOR' });
    if (hasBoost(player, 'CRIT_MATRIX'))    out.push({ id: 'CRIT_MATRIX',    name: BOOSTS.CRIT_MATRIX.name,    icon: BOOSTS.CRIT_MATRIX.icon,    colour: BOOSTS.CRIT_MATRIX.colour,    detail: 'FLOOR' });
    if (hasBoost(player, 'RECON_PING'))     out.push({ id: 'RECON_PING',     name: BOOSTS.RECON_PING.name,     icon: BOOSTS.RECON_PING.icon,     colour: BOOSTS.RECON_PING.colour,     detail: 'FLOOR' });
    const sc = player._shieldCharges | 0;
    if (sc > 0) out.push({ id: 'SHIELD_DRIVER', name: BOOSTS.SHIELD_DRIVER.name, icon: BOOSTS.SHIELD_DRIVER.icon, colour: BOOSTS.SHIELD_DRIVER.colour, detail: '×' + sc });
    return out;
  }

  // Remove permanent-stat entries from an UPGRADES-style list. Used by
  // content.js generateShopItems so vendors no longer sell persistent growth.
  // Kept here (rather than inlined in content.js) so tests can lock the
  // behaviour down without requiring the browser bundle.
  /** @param {any} upgrades */
  function filterVendorPool(upgrades) {
    if (!Array.isArray(upgrades)) return [];
    return upgrades.filter(function (/** @type {any} */ u) { return u && u.persistent !== true; });
  }

  return {
    BOOSTS: BOOSTS,
    BOOST_KEYS: BOOST_KEYS,
    applyBoost: applyBoost,
    clearFloorBoosts: clearFloorBoosts,
    hasBoost: hasBoost,
    getBoostDamageMul: getBoostDamageMul,
    getBoostSpeedMul: getBoostSpeedMul,
    getBoostCritBonus: getBoostCritBonus,
    consumeShieldCharge: consumeShieldCharge,
    getActiveBoostList: getActiveBoostList,
    filterVendorPool: filterVendorPool
  };
});
