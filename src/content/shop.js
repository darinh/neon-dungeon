// @ts-check
'use strict';

// Loaded before src/content.js so shop helpers stay script-tag globals.

// Rolled now so the shop shows the exact weapon, not a mystery roll at purchase.
function makeWeaponOption() {
  const k=WEAPON_KEYS[rndInt(0,WEAPON_KEYS.length-1)];
  const aw=rollWeapon(k, _CG.floor || 1);
  const rarityCol = RARITY_COLOURS[aw._rarity] || '#aaaaaa';
  const affixDesc = aw._affixes.map((/** @type {any} */ id) => WEAPON_AFFIXES[id]?.desc).filter(Boolean).join(', ');
  const statsDesc = aw.melee ? aw.dmg+' dmg, melee, '+aw.rate+'/s' : aw.dmg+(aw.count>1?'×'+aw.count:'')+' dmg, '+aw.rate+'/s, rng '+aw.range;
  return {
    id:'WEAPON_'+k, name:aw.displayName, colour:aw.colour, rarity:10, persistent:false,
    _rarity: aw._rarity, _rarityColour: rarityCol, _weaponObj: aw,
    desc: statsDesc,
    affixDesc: affixDesc || null,
    fn: (/** @type {any} */ p)=>{
      if (p.collectWeapon) {
        if (p.collectWeapon(aw)) {
          _CG.msg('Collected '+aw.displayName+'! [Scroll] to switch',rarityCol);
          return;
        }
      }
      if (p.equipWeapon) p.equipWeapon(aw);
      else p.weapon=aw;
      _CG.msg('Equipped '+aw.displayName+'!',rarityCol);
    }
  };
}

/**
 * @param {any} exclude
 */
function makeHackwareOption(exclude) {
  const current = _CG.player ? _CG.player.hackware : null;
  const eligible = HACKWARE_KEYS.filter(k => {
    if (exclude && exclude === 'HACKWARE_' + k) return false;
    return true;
  });
  if (eligible.length === 0) return null;
  const key = /** @type {string} */ (eligible[rndInt(0, eligible.length - 1)]);
  const hw = HACKWARE[key];
  const replaces = current ? HACKWARE[current] : null;
  return {
    id:'HACKWARE_'+key, name:hw.name,
    desc:hw.desc + (replaces ? ' [replaces '+replaces.name+']' : ''),
    colour:hw.colour, rarity:0, persistent:false, isHackware:true,
    fn: (/** @type {any} */ p) => {
      p.hackware = key;
      p.hackwareCooldown = 0;
      _CG.msg(hw.icon+' '+hw.name+' INSTALLED', hw.colour);
    }
  };
}

/**
 * @param {any} exclude
 * @returns {any}
 */
function pickUpgradeOption(exclude) {
  // Drops are non-persistent auto-applied upgrades: healing, XP, credits, or a
  // temporary boost. Persistent upgrades, hackware, and weapons stay out of
  // this pool, so game.js needs no choice popup.
  const pool = UPGRADES.filter(u => {
    if (u.persistent) return false;
    if (exclude && u.id === exclude) return false;
    return true;
  });
  // Empty-pool fallback so a gutted UPGRADES table cannot crash pickup.
  if (pool.length === 0) {
    return { id:'MED_PACK', name:'Med-Pack', desc:'+40 HP', colour:'#00ff88',
      rarity:1, persistent:false,
      fn: (/** @type {any} */ p)=>{ p.hp=Math.min(p.maxHp,p.hp+40); } };
  }
  const total = pool.reduce((s,u) => s+u.rarity, 0);
  let r = rand('loot') * total;
  for (const u of pool) { r -= u.rarity; if (r <= 0) return u; }
  return pool[0];
}

/**
 * @param {any} exclude
 */
function makeAugmentShopOption(exclude) {
  const owned = _CG.player ? _CG.player.augments || {} : {};
  const slots = Object.keys(owned).length;
  if (slots >= MAX_AUGMENTS) return null;
  const available = AUGMENT_KEYS.filter(id => !owned[id] && id !== exclude);
  if (!available.length) return null;
  const id = /** @type {string} */ (available[rndInt(0, available.length - 1)]);
  const aug = AUGMENTS[id];
  return {
    id: 'SHOP_AUG_' + id, name: aug.name, isAugment: true,
    desc: aug.icon + ' ' + aug.desc + ' [AUGMENT]',
    colour: aug.colour, price: 120 + (_CG.floor || 1) * 15,
    fn: (/** @type {any} */ p) => {
      if (Object.keys(p.augments).length >= MAX_AUGMENTS || p.augments[id]) {
        _CG.msg('AUGMENT SLOTS FULL', '#993366');
        return;
      }
      p.augments[id] = true;
      audio.augmentInstall();
      _CG.msg(aug.icon + ' ' + aug.name + ' INSTALLED', aug.colour);
      spawnParticles(p.x, p.y, 'EXPLOSION', aug.colour, 12);
    }
  };
}

// Prices are per upgrade id. Rarity is spawn weight, not price.
/** @type {Record<string, any>} */
const SHOP_PRICES = {
  MED_PACK:60, NANO_REPAIR:35, XP_CHIP:45,
  SAW_BLADE:120, PLASMA_ORB:130, NANO_REGEN:80, OVERCLOCK:110, ARMOR_UP:100, RICOCHET:115
};
/**
 * @param {any} id
 * @param {any} floor
 * @param {any} playerUpgrades
 */
function shopPrice(id, floor, playerUpgrades) {
  const base = SHOP_PRICES[id] || 80;
  const lvl = (playerUpgrades && playerUpgrades[id]) || 0;
  return Math.floor((base + floor * 5) * (1 + lvl * 0.4));
}

/**
 * @param {any} floor
 * @param {any} player
 * @param {any} dungeon
 */
function generateShopItems(floor, player, dungeon) {
  const pool = [];
  pool.push({
    id:'SHOP_HEAL', name:'Full Repair', desc:'Restore all HP',
    colour:'#00ff88', price: 50 + floor * 12,
    fn: (/** @type {any} */ p) => { p.hp = p.maxHp; _CG.msg('Fully repaired!','#00ff88'); }
  });
  if (dungeon) {
    /** @type {any[]} */ const neededColours = [];
    for (let ty=0; ty<MAP_H; ty++) for (let tx=0; tx<MAP_W; tx++) {
      const t = dungeon.map[ty][tx];
      const kc = doorKeyColour(t);
      if (kc && player.keys[kc] <= 0 && !neededColours.includes(kc)) neededColours.push(kc);
    }
    if (neededColours.length > 0) {
      const kc = neededColours[rndInt(0, neededColours.length - 1)];
      const tileCol = kc==='red'?'#ff3333':kc==='blue'?'#3388ff':'#ffcc00';
      pool.push({
        id:'SHOP_KEY_'+kc.toUpperCase(), name:kc.charAt(0).toUpperCase()+kc.slice(1)+' Key',
        desc:'Unlocks '+kc+' doors', colour:tileCol, price: 80 + floor * 8,
        fn: (/** @type {any} */ p) => { p.keys[kc]++; _CG.msg('Bought '+kc.toUpperCase()+' KEY!', tileCol); }
      });
    }
  }
  if (floor >= 3 && rand('loot') < 0.4) {
    const hwKey = /** @type {string} */ (HACKWARE_KEYS[rndInt(0, HACKWARE_KEYS.length - 1, 'loot')]);
    const hw = HACKWARE[hwKey];
    const replaces = player.hackware ? HACKWARE[player.hackware] : null;
    pool.push({
      id:'SHOP_HW_'+hwKey, name:hw.name, isHackware:true,
      desc:hw.desc + (replaces ? ' [replaces '+replaces.name+']' : ''),
      colour:hw.colour, price: 90 + floor * 10,
      fn: (/** @type {any} */ p) => { p.hackware=hwKey; p.hackwareCooldown=0; _CG.msg(hw.icon+' '+hw.name+' INSTALLED',hw.colour); }
    });
  }
  if (floor >= 3 && rand('loot') < 0.2) {
    const augOpt = makeAugmentShopOption(null);
    if (augOpt) pool.push(augOpt);
  }
  // Priced vendor boosts are floor-scoped or one-shots and never grant permanent growth.
  const boostKeys = (typeof NEON !== 'undefined' && NEON.boosts) ? NEON.boosts.BOOST_KEYS.slice() : [];
  shuffleInPlace(boostKeys, 'loot');
  const usedIds = new Set(pool.map(p => p.id));
  for (const bk of boostKeys) {
    if (pool.length >= 3) break;
    const bid = 'BOOST_' + bk;
    if (usedIds.has(bid)) continue;
    const b = NEON.boosts.BOOSTS[bk];
    // Skip boosts with no price. Selling a mob drop would NaN the cost and
    // sell something that must be earned, not bought.
    if (!b || typeof b.price !== 'number') continue;
    pool.push({
      id: bid, name: b.name, desc: b.desc, colour: b.colour,
      price: b.price + Math.floor(floor * 2), // mild floor scaling keeps late-game meaningful
      isBoost: true, boostId: bk, icon: b.icon,
      fn: (/** @type {any} */ p) => {
        NEON.boosts.applyBoost(p, bk);
        // RECON_PING must reveal the minimap now; loadFloor only honours the flag on entry.
        if (bk === 'RECON_PING') { _CG.mapRevealed = true; _CG._minimapDirty = true; }
        _CG.msg(b.icon + ' ' + b.name, b.colour);
      }
    });
    usedIds.add(bid);
  }
  // Backfill from non-persistent consumables only; persistent UPGRADES are not sold for credits.
  const nonPersistentPool = (typeof NEON !== 'undefined' && NEON.boosts)
    ? NEON.boosts.filterVendorPool(UPGRADES)
    : UPGRADES.filter(u => !u.persistent && u.id !== 'CREDIT_CACHE');
  const used = usedIds;
  const eligible = nonPersistentPool.filter((/** @type {any} */ u) => !used.has(u.id));
  const shuffled = shuffleInPlace(eligible.slice(), 'loot');
  while (pool.length < 3 && shuffled.length > 0) {
    const u = shuffled.pop();
    const price = shopPrice(u.id, floor, player ? player.upgrades : {});
    pool.push({
      id:u.id, name:u.name, desc:u.desc, colour:u.colour, price,
      fn: u.fn, persistent:u.persistent, maxLevel:u.maxLevel, levelDesc:u.levelDesc
    });
  }
  while (pool.length < 3) {
    const wo = makeWeaponOption();
    pool.push({ ...wo, price: 70 + floor * 6 });
  }
  return pool.slice(0, 3).map(item => ({ ...item, sold: false }));
}
