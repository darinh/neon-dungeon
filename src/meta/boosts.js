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
    },
    // HARVESTER drop — short-window damage surge. `duration: 'timed'` triggers
    // the _boostTimers path: applyBoost seeds the timer, tickBoosts ticks it
    // down and clears the activeBoosts flag when it expires. Strictly temp
    // per the design rule "no permanent power-ups from mob drops".
    HARVEST_SURGE: {
      id: 'HARVEST_SURGE', name: 'HARVEST SURGE', icon: '⚡',
      desc: '+50% weapon dmg (8s)', colour: '#ff9933',
      duration: 'timed', durationSec: 8, dmgMul: 1.5,
      apply: function (/** @type {any} */ player) {
        player.activeBoosts = player.activeBoosts || {};
        player.activeBoosts.HARVEST_SURGE = true;
        player._boostTimers = player._boostTimers || {};
        // Refresh on stack — picking up a second pickup mid-buff resets the
        // window rather than extending it (prevents pacifist-stack abuse).
        player._boostTimers.HARVEST_SURGE = 8;
      }
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
    // Timed boosts (HARVESTER drop, future seconds-windowed buffs) are also
    // reset on floor transition — short-window buffs that hadn't expired by
    // the time you reach the stairs do not carry over.
    player._boostTimers = {};
  }

  // Tick all timed-duration boosts. Removes the activeBoosts flag the moment
  // a timer hits zero so multipliers (getBoostDamageMul/etc.) flip back to
  // neutral on the very same frame. Defensive on missing _boostTimers map.
  /** @param {any} player @param {number} dt */
  function tickBoosts(player, dt) {
    if (!player) return;
    const timers = player._boostTimers;
    if (!timers) return;
    for (const id in timers) {
      if (!Object.prototype.hasOwnProperty.call(timers, id)) continue;
      const remaining = (timers[id] || 0) - dt;
      if (remaining <= 0) {
        delete timers[id];
        if (player.activeBoosts) delete player.activeBoosts[id];
      } else {
        timers[id] = remaining;
      }
    }
  }

  // Drain `secs` seconds from a single, randomly-chosen ACTIVE timed boost.
  // Used by SAPPER's leech-on-hit. Returns the boost id that was drained,
  // or null when the player has no timed boost active (no-op — never
  // punishes empty inventory). Mirrors tickBoosts's expiration semantics:
  // if the drain takes the timer to 0 or below, both the timer entry AND
  // the activeBoosts flag are cleared atomically (without this, multipliers
  // would stay enabled with no remaining time, which tickBoosts only cleans
  // up the next frame — safer to expire eagerly).
  //
  // Defensive on missing/empty maps. Random selection uses the standard
  // Math.random() (no injection seam needed — drain order doesn't affect
  // any of our deterministic test paths).
  /** @param {any} player @param {number} secs @returns {string | null} */
  function drainTimedBoost(player, secs) {
    if (!player || !(secs > 0)) return null;
    const timers = player._boostTimers;
    if (!timers) return null;
    /** @type {string[]} */
    const ids = [];
    for (const id in timers) {
      if (!Object.prototype.hasOwnProperty.call(timers, id)) continue;
      if ((timers[id] || 0) > 0) ids.push(id);
    }
    if (ids.length === 0) return null;
    const pick = ids[Math.floor(Math.random() * ids.length)];
    if (!pick) return null;
    const remaining = (timers[pick] || 0) - secs;
    if (remaining <= 0) {
      delete timers[pick];
      if (player.activeBoosts) delete player.activeBoosts[pick];
    } else {
      timers[pick] = remaining;
    }
    return pick;
  }

  // Does the player have a floor-duration boost active right now?
  /** @param {any} player @param {string} id */
  function hasBoost(player, id) {
    return !!(player && player.activeBoosts && player.activeBoosts[id]);
  }

  // Aggregate multipliers/bonuses. All default to neutral when inactive.
  /** @param {any} player */
  function getBoostDamageMul(player) {
    let mul = hasBoost(player, 'COMBAT_STIM') ? BOOSTS.COMBAT_STIM.dmgMul : 1;
    if (hasBoost(player, 'HARVEST_SURGE')) mul *= BOOSTS.HARVEST_SURGE.dmgMul;
    return mul;
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
    // Timed surge — show remaining seconds (rounded up) so the HUD ticks
    // visibly and the player can decide whether to commit to a burst.
    if (hasBoost(player, 'HARVEST_SURGE')) {
      const remaining = (player._boostTimers && player._boostTimers.HARVEST_SURGE) || 0;
      out.push({ id: 'HARVEST_SURGE', name: BOOSTS.HARVEST_SURGE.name, icon: BOOSTS.HARVEST_SURGE.icon, colour: BOOSTS.HARVEST_SURGE.colour, detail: Math.ceil(remaining) + 's' });
    }
    const sc = player._shieldCharges | 0;
    if (sc > 0) out.push({ id: 'SHIELD_DRIVER', name: BOOSTS.SHIELD_DRIVER.name, icon: BOOSTS.SHIELD_DRIVER.icon, colour: BOOSTS.SHIELD_DRIVER.colour, detail: '×' + sc });
    return out;
  }

  // Remove permanent-stat entries from an UPGRADES-style list. Used by
  // content.js generateShopItems so vendors no longer sell persistent growth.
  // Also excludes currency drops (CREDIT_CACHE) — buying currency with
  // currency would either be a no-op or, with floor scaling + multipliers, an
  // arbitrage loop. TACTICAL_DROP is also vendor-excluded: it grants a random
  // boost that vendors already sell individually for known prices, so a flat
  // shopPrice would be either strictly worse (one boost vs choosing) or, at a
  // discount, an arbitrage loop. Kept here (rather than inlined in content.js)
  // so tests can lock the behaviour down without requiring the browser bundle.
  /** @param {any} upgrades */
  function filterVendorPool(upgrades) {
    if (!Array.isArray(upgrades)) return [];
    return upgrades.filter(function (/** @type {any} */ u) {
      if (!u) return false;
      if (u.persistent === true) return false;
      if (u.id === 'CREDIT_CACHE') return false;
      if (u.id === 'TACTICAL_DROP') return false;
      return true;
    });
  }

  // Curated subset of BOOSTS eligible for the TACTICAL_DROP random pickup.
  // Excludes NANO_MEDIC (overlaps with the existing MED_PACK heal drop and
  // would feel like a duplicate roll). Order is stable for testability and
  // for deterministic rng-seeded weights if we ever add per-boost rarity.
  const DROP_BOOST_POOL = ['COMBAT_STIM', 'REFLEX_BOOSTER', 'CRIT_MATRIX', 'SHIELD_DRIVER', 'RECON_PING'];

  // Pick a random boost id from the drop pool. Deterministic via the supplied
  // rng (defaults to Math.random) so tests can lock behaviour. Returns null if
  // the pool is empty (defensive — shouldn't happen at runtime). Uses
  // `Math.min(len-1, ...)` rather than `% len` so that a seeded rng emitting
  // 1.0 (allowed by some PRNGs even though Math.random spec is [0,1)) maps
  // to the last index, preserving a uniform distribution at the upper bound.
  /** @param {() => number} [rng] */
  function rollDropBoost(rng) {
    const r = (typeof rng === 'function') ? rng : Math.random;
    const len = DROP_BOOST_POOL.length;
    if (!len) return null;
    const idx = Math.min(len - 1, Math.max(0, Math.floor(r() * len)));
    return DROP_BOOST_POOL[idx];
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
    tickBoosts: tickBoosts,
    drainTimedBoost: drainTimedBoost,
    getActiveBoostList: getActiveBoostList,
    filterVendorPool: filterVendorPool,
    DROP_BOOST_POOL: DROP_BOOST_POOL,
    rollDropBoost: rollDropBoost
  };
});
