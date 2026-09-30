// @ts-check
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    /** @type {any} */ (root).NEON = /** @type {any} */ (root).NEON || {};
    /** @type {any} */ (root).NEON.boosts = factory();
  }
})(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {

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
    // Timed: tickBoosts clears the flag when the timer expires. Mob drops must not grant permanent power.
    HARVEST_SURGE: {
      id: 'HARVEST_SURGE', name: 'HARVEST SURGE', icon: '⚡',
      desc: '+50% weapon dmg (8s)', colour: '#ff9933',
      duration: 'timed', durationSec: 8, dmgMul: 1.5,
      apply: function (/** @type {any} */ player) {
        player.activeBoosts = player.activeBoosts || {};
        player.activeBoosts.HARVEST_SURGE = true;
        player._boostTimers = player._boostTimers || {};
        // A second pickup resets the window instead of extending it, so stacks cannot be farmed by waiting.
        player._boostTimers.HARVEST_SURGE = 8;
      }
    }
  };

  const BOOST_KEYS = Object.keys(BOOSTS);

  /** @param {any} player @param {string} id */
  function applyBoost(player, id) {
    const b = BOOSTS[id];
    if (!b || !player) return false;
    b.apply(player);
    return true;
  }

  // game.loadFloor on a fresh transition, not save-resume. continueGame restores the saved boost state.
  /** @param {any} player */
  function clearFloorBoosts(player) {
    if (!player) return;
    player.activeBoosts = {};
    player._shieldCharges = 0;
    // A timed buff that has not expired does not carry across the stairs.
    player._boostTimers = {};
  }

  // Clear the flag in the same frame the timer hits zero, or multipliers stay on until the next tick.
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

  // SAPPER leech-on-hit. Expire the flag in this call if the drain hits zero; tickBoosts would not clear it until the next frame. Callers pass the combat rng so drain order is seed-stable.
  /** @param {any} player @param {number} secs @param {() => number} [randomFn] @returns {string | null} */
  function drainTimedBoost(player, secs, randomFn) {
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
    const rng = randomFn || (typeof rand !== 'undefined' ? () => rand('combat') : Math.random);
    const pick = ids[Math.floor(rng() * ids.length)];
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

  /** @param {any} player @param {string} id */
  function hasBoost(player, id) {
    return !!(player && player.activeBoosts && player.activeBoosts[id]);
  }

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

  // Caller must skip the rest of the damage path when this returns true.
  /** @param {any} player */
  function consumeShieldCharge(player) {
    if (!player || (player._shieldCharges | 0) <= 0) return false;
    player._shieldCharges = (player._shieldCharges | 0) - 1;
    return true;
  }

  // Order is the HUD strip below the minimap.
  /** @param {any} player */
  function getActiveBoostList(player) {
    /** @type {Array<{id:string,name:string,icon:string,colour:string,detail:string}>} */
    const out = [];
    if (!player) return out;
    if (hasBoost(player, 'COMBAT_STIM'))    out.push({ id: 'COMBAT_STIM',    name: BOOSTS.COMBAT_STIM.name,    icon: BOOSTS.COMBAT_STIM.icon,    colour: BOOSTS.COMBAT_STIM.colour,    detail: 'FLOOR' });
    if (hasBoost(player, 'REFLEX_BOOSTER')) out.push({ id: 'REFLEX_BOOSTER', name: BOOSTS.REFLEX_BOOSTER.name, icon: BOOSTS.REFLEX_BOOSTER.icon, colour: BOOSTS.REFLEX_BOOSTER.colour, detail: 'FLOOR' });
    if (hasBoost(player, 'CRIT_MATRIX'))    out.push({ id: 'CRIT_MATRIX',    name: BOOSTS.CRIT_MATRIX.name,    icon: BOOSTS.CRIT_MATRIX.icon,    colour: BOOSTS.CRIT_MATRIX.colour,    detail: 'FLOOR' });
    if (hasBoost(player, 'RECON_PING'))     out.push({ id: 'RECON_PING',     name: BOOSTS.RECON_PING.name,     icon: BOOSTS.RECON_PING.icon,     colour: BOOSTS.RECON_PING.colour,     detail: 'FLOOR' });
    if (hasBoost(player, 'HARVEST_SURGE')) {
      const remaining = (player._boostTimers && player._boostTimers.HARVEST_SURGE) || 0;
      out.push({ id: 'HARVEST_SURGE', name: BOOSTS.HARVEST_SURGE.name, icon: BOOSTS.HARVEST_SURGE.icon, colour: BOOSTS.HARVEST_SURGE.colour, detail: Math.ceil(remaining) + 's' });
    }
    const sc = player._shieldCharges | 0;
    if (sc > 0) out.push({ id: 'SHIELD_DRIVER', name: BOOSTS.SHIELD_DRIVER.name, icon: BOOSTS.SHIELD_DRIVER.icon, colour: BOOSTS.SHIELD_DRIVER.colour, detail: '×' + sc });
    return out;
  }

  // CREDIT_CACHE is currency bought with currency (arbitrage once floor scaling applies). TACTICAL_DROP resells a boost the vendor already prices individually. Lives here so the filter can be tested without the browser bundle.
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

  // NANO_MEDIC is excluded: it duplicates the MED_PACK heal drop. Order is stable so tests can lock the roll.
  const DROP_BOOST_POOL = ['COMBAT_STIM', 'REFLEX_BOOSTER', 'CRIT_MATRIX', 'SHIELD_DRIVER', 'RECON_PING'];

  // Math.min(len - 1, ...), not `% len`: a seeded rng that emits 1.0 must still land on the last index.
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
