// @ts-check
// src/meta/modules.js — UPGRADE MODULES (UNCHAINED #37)
//
// Persistent equippable items dropped by rare terminals and bosses. Up to
// 3 install slots on the player; sellable back for a fixed 4-core refund.
//
// This module owns the MODULES catalog and all behaviour-effect logic.
// save.js keeps the storage schema (modulesOwned, modulesInstalled) and
// delegates to us via the registerModuleEffects hook so the catalog and
// the storage layer stay decoupled.
//
// Same UMD-lite pattern as save.js — works in the browser via
// `window.NEON.modules` and in Node tests via `require`.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./save.js'));
  else (/** @type {any} */ (root.NEON = root.NEON || {})).modules = factory((root.NEON && root.NEON.save) || null);
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function (/** @type {any} */ save) {
  'use strict';

  // ─── Catalog ───────────────────────────────────────────────────────────────
  const MODULES = [
    { id:'armor_link',          name:'ARMOR LINK',          effect:'+15 max HP' },
    { id:'kinetic_amp',         name:'KINETIC AMP',         effect:'+8% damage' },
    { id:'stim_injector',       name:'STIM INJECTOR',       effect:'+10% movement speed' },
    { id:'neural_coprocessor',  name:'NEURAL COPROCESSOR',  effect:'+1 hackware slot (stacks with hacktool)' },
    { id:'shield_capacitor',    name:'SHIELD CAPACITOR',    effect:'Start each floor with 1 shield charge' },
    { id:'ammo_reclaimer',      name:'AMMO RECLAIMER',      effect:'10% chance pickups give double credits' },
    { id:'targeting_array',     name:'TARGETING ARRAY',     effect:'+3% crit chance, +15% crit damage' },
    { id:'kinetic_buffer',      name:'KINETIC BUFFER',      effect:'-10% knockback taken' },
    { id:'dash_cooler',         name:'DASH COOLER',         effect:'-15% dash cooldown' },
    { id:'reactive_core',       name:'REACTIVE CORE',       effect:'Reflect 10% of incoming damage to attacker' },
  ];

  const SELL_PRICE = 4;             // fixed v1 — sell refund in cores
  const RARE_TERMINAL_DROP_PCT = 0.25;
  const BOSS_GENESIS_CORES = 10;    // final-boss bonus (issue #39 may wire this)

  /** @type {Record<string, any>} */
  const _byId = Object.create(null);
  for (const m of MODULES) _byId[m.id] = m;

  /** @param {string} id */
  function getModule(id) { return (typeof id === 'string' && _byId[id]) || null; }

  // ─── State queries ─────────────────────────────────────────────────────────
  // `meta` may be a loaded save object; when omitted we load on demand.
  /** @param {any} meta */
  function _meta(meta) { return meta || (save ? save.loadMeta() : null); }

  // canInstall: true iff `id` is a valid owned module AND `slot` is a valid
  // index AND the slot is not already occupied by the same id in another slot
  // (save.installModule clears dupes anyway; we still surface this so the UI
  // can preview the move). An empty slot containing the same id is a no-op
  // and reports false.
  /** @param {any} meta @param {number} slot @param {string} id */
  function canInstall(meta, slot, id) {
    const m = _meta(meta);
    if (!m) return false;
    slot = Math.floor(Number(slot));
    const slots = save ? save.MODULE_SLOTS : 3;
    if (!(slot >= 0 && slot < slots)) return false;
    if (!getModule(id)) return false;
    if (!m.modulesOwned.includes(id)) return false;
    if (m.modulesInstalled[slot] === id) return false;
    return true;
  }

  /** @param {any} meta @param {number} slot @param {string} id */
  function install(meta, slot, id)   { void meta; return save ? save.installModule(slot, id)   : undefined; }
  /** @param {any} meta @param {number} slot */
  function uninstall(meta, slot)     { void meta; return save ? save.installModule(slot, null) : undefined; }

  // sell: thin wrapper that bakes in the v1 fixed refund. Returns refund
  // actually credited (0 if unowned).
  /** @param {any} meta @param {string} id */
  function sell(meta, id) { void meta;
    if (!save) return 0;
    return save.sellModule(id, SELL_PRICE);
  }

  // ─── Drops ─────────────────────────────────────────────────────────────────
  // rollModuleDrop: returns a module id or null per source rules.
  //   source='rare-terminal'  → 25% chance of drop, else null.
  //   source='boss-non-final' → guaranteed drop.
  //   source='boss-genesis'   → guaranteed drop (+10 cores awarded separately
  //                             by the boss hook; see #39 follow-up).
  // Unknown sources: guaranteed drop (treated as boss-style).
  /** @param {{source?: string, rng?: () => number}} [opts] */
  function rollModuleDrop(opts) {
    const source = (opts && opts.source) || '';
    const rng = (opts && typeof opts.rng === 'function')
      ? opts.rng
      : (typeof rand !== 'undefined' ? () => rand('loot') : Math.random);
    if (source === 'rare-terminal') {
      if (rng() >= RARE_TERMINAL_DROP_PCT) return null;
    }
    return /** @type {{id:string}} */ (MODULES[Math.floor(rng() * MODULES.length)]).id;
  }

  // ─── Run-pickup (transient) ────────────────────────────────────────────────
  // Modules dropped during a run live in game.runModules and are only
  // committed to meta.modulesOwned on floor clear or victory. On death they
  // are discarded — the run's transient array is simply dropped when the
  // next run starts.
  /** @param {any} game @param {string} id */
  function addRunPickup(game, id) {
    if (!game || !getModule(id)) return false;
    if (!Array.isArray(game.runModules)) game.runModules = [];
    game.runModules.push(id);
    return true;
  }

  /** @param {any} game */
  function commitRunModules(game) {
    if (!save) return 0;
    if (!game || !Array.isArray(game.runModules) || !game.runModules.length) return 0;
    const m = save.loadMeta();
    let n = 0;
    for (const id of game.runModules) {
      if (getModule(id)) { m.modulesOwned.push(id); n++; }
    }
    game.runModules = [];
    if (n > 0) save.saveMeta(m);
    return n;
  }

  /** @param {any} game */
  function clearRunModules(game) { if (game) game.runModules = []; }

  // ─── Effect application (called by save.applyMetaToPlayer) ─────────────────
  // Stat tweaks mutate the player directly; behavioural effects land on
  // player.metaFlags (same pattern as UNCHAINED #36 hub upgrades). Flag
  // semantics are documented inline — consumers read them wherever the
  // relevant game mechanic lives.
  /** @param {any} player @param {Array<string|null|undefined>} installedIds */
  function applyModulesToPlayer(player, installedIds) {
    if (!player || !Array.isArray(installedIds)) return;
    player.metaFlags = player.metaFlags || {};
    const f = player.metaFlags;
    for (const id of installedIds) {
      if (!id) continue;
      switch (id) {
        case 'armor_link':
          player.maxHp += 15; player.hp = player.maxHp;
          break;
        case 'kinetic_amp':
          // +8% damage. Stat tweak on base atk so effectiveAtk() picks it up.
          player.atk = Math.round(player.atk * 1.08);
          f.damageMul = (f.damageMul || 1) * 1.08;
          break;
        case 'stim_injector':
          player.spd = player.spd * 1.10;
          f.moveSpeedMul = (f.moveSpeedMul || 1) * 1.10;
          break;
        case 'neural_coprocessor':
          // +1 hackware slot — stacks with the hacktool upgrade.
          f.extraHackwareSlots = (f.extraHackwareSlots || 0) + 1;
          player.hackwareSlots = (player.hackwareSlots || 3) + 1;
          break;
        case 'shield_capacitor':
          // Floor-start shield charge — consumer: loadFloor() grants +1 shield.
          f.floorStartShieldCharges = (f.floorStartShieldCharges || 0) + 1;
          break;
        case 'ammo_reclaimer':
          // Consumer: credit-pickup code rolls against this each time.
          f.doubleCreditChance = (f.doubleCreditChance || 0) + 0.10;
          break;
        case 'targeting_array':
          f.critChanceBonus = (f.critChanceBonus || 0) + 0.03;
          f.critDamageBonus = (f.critDamageBonus || 0) + 0.15;
          break;
        case 'kinetic_buffer':
          // Multiplicative — stacking two would give 0.9*0.9=0.81.
          f.knockbackTakenMul = (f.knockbackTakenMul == null ? 1 : f.knockbackTakenMul) * 0.90;
          break;
        case 'dash_cooler':
          f.dashCooldownMul = (f.dashCooldownMul == null ? 1 : f.dashCooldownMul) * 0.85;
          break;
        case 'reactive_core':
          f.reflectDamagePct = (f.reflectDamagePct || 0) + 0.10;
          break;
        default:
          // Unknown id — ignore silently. A stale save could reference a
          // module that was removed from the catalog.
          break;
      }
    }
  }

  // Register with save.js so applyMetaToPlayer picks up module effects.
  if (save && typeof save.registerModuleEffects === 'function') {
    save.registerModuleEffects(applyModulesToPlayer);
  }

  // ─── Hub terminal panel (for #35 integration) ──────────────────────────────
  // Minimal self-contained renderer + input handler. #35 will wire this
  // into the hub terminal UI once merged; the API is deliberately small.
  //
  // state shape: {
  //   focus: 'slot'|'inv',  // which column is focused
  //   slotIdx: 0..2,
  //   invIdx:  0..n-1,
  //   confirmSell: boolean, // one-shot "SELL for 4 cores? [Y/N]" prompt
  // }
  function defaultPanelState() {
    return { focus: 'slot', slotIdx: 0, invIdx: 0, confirmSell: false };
  }

  /** @param {CanvasRenderingContext2D|null|undefined} ctx @param {number} x @param {number} y @param {number} w @param {number} h @param {any} game @param {any} state */
  function drawModuleSlotsPanel(ctx, x, y, w, h, game, state) { void game;
    if (!ctx) return;
    if (!state) state = defaultPanelState();
    const meta = save ? save.loadMeta() : { modulesInstalled:[null,null,null], modulesOwned:[], cores:0 };
    const slots = meta.modulesInstalled;
    const owned = meta.modulesOwned;

    ctx.save();
    ctx.fillStyle = '#050812';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#22ddff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    // textAlign/textBaseline reset — drawHub leaves textAlign='center' from
    // its prompt line (hub.js _drawHub), which would center every label in
    // this panel on its x coord and bleed half-text past the left edge.
    ctx.textAlign = 'left';
    ctx.fillStyle = '#22ddff';
    ctx.font = '14px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText('MODULE SLOTS', x + 12, y + 10);
    ctx.fillStyle = '#99bbcc';
    ctx.fillText('CORES: ' + (meta.cores | 0), x + w - 140, y + 10);

    const col1X = x + 12,  col1W = Math.floor(w * 0.42);
    const col2X = x + col1W + 24, col2W = w - col1W - 36;
    const rowH  = 22;
    const topY  = y + 40;

    // ── Slot column ──
    ctx.font = '12px monospace';
    for (let i = 0; i < slots.length; i++) {
      const rowY = topY + i * rowH;
      const focused = state.focus === 'slot' && state.slotIdx === i;
      ctx.fillStyle = focused ? '#113344' : '#0a1520';
      ctx.fillRect(col1X, rowY, col1W, rowH - 2);
      ctx.strokeStyle = focused ? '#22ddff' : '#224455';
      ctx.strokeRect(col1X + 0.5, rowY + 0.5, col1W - 1, rowH - 3);
      const id = slots[i];
      const mod = getModule(id);
      ctx.fillStyle = mod ? '#eeffff' : '#557788';
      ctx.fillText('SLOT ' + (i + 1) + ': ' + (mod ? mod.name : '— EMPTY —'), col1X + 6, rowY + 5);
    }

    // ── Inventory column ──
    ctx.fillStyle = '#99bbcc';
    ctx.fillText('INVENTORY (' + owned.length + ')', col2X, topY - 16);
    const maxRows = Math.floor((h - 80) / rowH);
    const shown = Math.min(owned.length, maxRows);
    for (let i = 0; i < shown; i++) {
      const rowY = topY + i * rowH;
      const focused = state.focus === 'inv' && state.invIdx === i;
      ctx.fillStyle = focused ? '#113344' : '#0a1520';
      ctx.fillRect(col2X, rowY, col2W, rowH - 2);
      ctx.strokeStyle = focused ? '#22ddff' : '#224455';
      ctx.strokeRect(col2X + 0.5, rowY + 0.5, col2W - 1, rowH - 3);
      const mod = getModule(owned[i]);
      ctx.fillStyle = '#eeffff';
      ctx.fillText(mod ? mod.name : owned[i], col2X + 6, rowY + 5);
    }
    if (owned.length === 0) {
      ctx.fillStyle = '#557788';
      ctx.fillText('(no modules yet)', col2X + 6, topY + 5);
    }

    // ── Effect descr of current focus (word-wrapped) ──
    const focusedId = state.focus === 'slot' ? slots[state.slotIdx] : owned[state.invIdx];
    const focusedMod = getModule(focusedId);
    if (focusedMod) {
      ctx.fillStyle = '#66ccff';
      const descMaxW = w - 24;
      const descText = focusedMod.name + ' — ' + focusedMod.effect;
      if (ctx.measureText(descText).width <= descMaxW) {
        ctx.fillText(descText, x + 12, y + h - 42);
      } else {
        const dWords = descText.split(' ');
        let dLine = '', dy = y + h - 56;
        for (const dw of dWords) {
          const dt = dLine ? (dLine + ' ' + dw) : dw;
          if (ctx.measureText(dt).width > descMaxW && dLine) {
            ctx.fillText(dLine, x + 12, dy); dy += 14; dLine = dw;
          } else { dLine = dt; }
        }
        if (dLine) ctx.fillText(dLine, x + 12, dy);
      }
    }

    // ── Hints / confirm prompt (compact on narrow panels) ──
    ctx.fillStyle = '#557788';
    if (state.confirmSell) {
      ctx.fillStyle = '#ffcc22';
      ctx.fillText('SELL for ' + SELL_PRICE + ' cores? [Y/N]', x + 12, y + h - 20);
    } else {
      const hintText = w < 420
        ? '[TAB] switch [ENTER] act [S] sell [ESC] exit'
        : '[TAB] switch  [ENTER] install/uninstall  [S] sell  [ESC] exit';
      ctx.fillText(hintText, x + 12, y + h - 20);
    }
    ctx.restore();
  }

  // handleModuleSlotsKey mutates `state` and meta storage. Returns:
  //   'exit'     → caller should close the panel (ESC).
  //   'handled'  → input consumed.
  //   'ignored'  → caller may handle the key itself.
  /** @param {any} game @param {any} state @param {string} key */
  function handleModuleSlotsKey(game, state, key) { void game;
    if (!state) return 'ignored';
    const meta = save ? save.loadMeta() : null;
    if (!meta) return 'ignored';
    const slots = meta.modulesInstalled;
    const owned = meta.modulesOwned;

    // Confirm dialog short-circuits navigation.
    if (state.confirmSell) {
      if (key === 'y' || key === 'Y') {
        const id = owned[state.invIdx];
        if (id) {
          sell(null, id);
          // clamp invIdx after removal
          const nowOwned = save.loadMeta().modulesOwned;
          if (state.invIdx >= nowOwned.length) state.invIdx = Math.max(0, nowOwned.length - 1);
        }
        state.confirmSell = false;
        return 'handled';
      }
      if (key === 'n' || key === 'N' || key === 'Escape') {
        state.confirmSell = false;
        return 'handled';
      }
      return 'handled';
    }

    switch (key) {
      case 'Escape': return 'exit';
      case 'Tab':
        state.focus = (state.focus === 'slot') ? 'inv' : 'slot';
        return 'handled';
      case 'ArrowUp':
        if (state.focus === 'slot') state.slotIdx = Math.max(0, state.slotIdx - 1);
        else                        state.invIdx  = Math.max(0, state.invIdx - 1);
        return 'handled';
      case 'ArrowDown':
        if (state.focus === 'slot') state.slotIdx = Math.min(slots.length - 1, state.slotIdx + 1);
        else if (owned.length)      state.invIdx  = Math.min(owned.length - 1, state.invIdx + 1);
        return 'handled';
      case 'Enter':
        if (state.focus === 'slot') {
          // Uninstall focused slot (if occupied).
          if (slots[state.slotIdx]) uninstall(null, state.slotIdx);
        } else {
          // Install focused inventory module into first empty slot (or slot 0).
          const id = owned[state.invIdx];
          if (id) {
            let target = slots.indexOf(null);
            if (target < 0) target = 0;
            install(null, target, id);
          }
        }
        return 'handled';
      case 's': case 'S':
        if (state.focus === 'inv' && owned[state.invIdx]) {
          state.confirmSell = true;
        }
        return 'handled';
      default:
        return 'ignored';
    }
  }

  return {
    MODULES, SELL_PRICE, RARE_TERMINAL_DROP_PCT, BOSS_GENESIS_CORES,
    getModule, canInstall, install, uninstall, sell,
    rollModuleDrop,
    addRunPickup, commitRunModules, clearRunModules,
    applyModulesToPlayer,
    defaultPanelState, drawModuleSlotsPanel, handleModuleSlotsKey,
  };
}));
