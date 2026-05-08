// @ts-check
'use strict';

// Vendor/shop option orchestration. Loaded before src/content.js so the shop
// helper surface keeps its legacy globals while the vendor code has a smaller
// ownership surface.

// Generate a weapon upgrade option (pre-rolled so player sees exact weapon)
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
  // Pick a random hackware module different from what player has and the excluded id
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
      p.hackwareCooldown = 0; // fresh cooldown on equip
      _CG.msg(hw.icon+' '+hw.name+' INSTALLED', hw.colour);
    }
  };
}

/**
 * @param {any} exclude
 * @returns {any}
 */
function pickUpgradeOption(exclude) {
  // LOOT PHILOSOPHY (user rule, repeated 100+ times): NEVER drop permanent
  // power-ups for free. Drops are heals + XP only. Persistent items (saws,
  // sentries, regen, armor, ricochet, plasma orb, overclock) are filtered
  // out of the run drop pool entirely — they live in meta-progression /
  // shops / future weapon-terminal upgrades. Hackware + weapons removed
  // from drops too: hackware is a permanent equip; weapons live in secret
  // rooms only (per user). This collapses pickUpgradeOption to MED_PACK,
  // NANO_REPAIR, XP_CHIP — all "simple" so the existing auto-apply path at
  // src/game.js:1400-1409 handles them with no popup. Stored as repo
  // memory: subject "loot philosophy".
  const pool = UPGRADES.filter(u => {
    if (u.persistent) return false;
    if (exclude && u.id === exclude) return false;
    return true;
  });
  // Defensive fallback — should never trigger because MED_PACK/NANO_REPAIR/
  // XP_CHIP are always present and non-persistent. If the table is ever
  // edited to remove them all, fall back to a minimal heal so we don't
  // crash the pickup path.
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
      // Guard: don't exceed max slots or install duplicates
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

// ─── Vendor / Shop ───────────────────────────────────────────────────────────
// Shop prices are explicit per upgrade id (not derived from rarity which is spawn weight)
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
  // Always offer a heal option
  pool.push({
    id:'SHOP_HEAL', name:'Full Repair', desc:'Restore all HP',
    colour:'#00ff88', price: 50 + floor * 12,
    fn: (/** @type {any} */ p) => { p.hp = p.maxHp; _CG.msg('Fully repaired!','#00ff88'); }
  });
  // Offer a key if the floor has locked doors the player can't open
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
  // Offer a hackware module on floor 3+ (~40% chance per vendor)
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
  // Offer an augment on floor 3+ (~20% chance, if player has room)
  if (floor >= 3 && rand('loot') < 0.2) {
    const augOpt = makeAugmentShopOption(null);
    if (augOpt) pool.push(augOpt);
  }
  // UNCHAINED #38: temp-boost consumables replace permanent in-run upgrades.
  // Fill ~2 of the 3 slots with random picks from the boost pool. These are
  // floor-scoped (or instant one-shots) and never grant permanent growth.
  const boostKeys = (typeof NEON !== 'undefined' && NEON.boosts) ? NEON.boosts.BOOST_KEYS.slice() : [];
  // Shuffle boost keys for variety across vendors.
  shuffleInPlace(boostKeys, 'loot');
  const usedIds = new Set(pool.map(p => p.id));
  for (const bk of boostKeys) {
    if (pool.length >= 3) break;
    const bid = 'BOOST_' + bk;
    if (usedIds.has(bid)) continue;
    const b = NEON.boosts.BOOSTS[bk];
    // Skip non-vendor boosts (mob-drop only — e.g. HARVEST_SURGE has no
    // price; selling it would NaN the cost and break the rule that mob
    // drops are earned not purchased).
    if (!b || typeof b.price !== 'number') continue;
    pool.push({
      id: bid, name: b.name, desc: b.desc, colour: b.colour,
      price: b.price + Math.floor(floor * 2), // mild floor scaling keeps late-game meaningful
      isBoost: true, boostId: bk, icon: b.icon,
      fn: (/** @type {any} */ p) => {
        NEON.boosts.applyBoost(p, bk);
        // UNCHAINED #38: RECON PING flips the runtime minimap reveal
        // immediately (loadFloor already honours the flag on floor entry).
        if (bk === 'RECON_PING') { _CG.mapRevealed = true; _CG._minimapDirty = true; }
        _CG.msg(b.icon + ' ' + b.name, b.colour);
      }
    });
    usedIds.add(bid);
  }
  // Backfill from the non-persistent UPGRADES pool (consumables only — heals,
  // XP chips, void shards). Permanent stat growth is no longer sold for
  // credits (UNCHAINED #38).
  const nonPersistentPool = (typeof NEON !== 'undefined' && NEON.boosts)
    ? NEON.boosts.filterVendorPool(UPGRADES)
    : UPGRADES.filter(u => !u.persistent && u.id !== 'CREDIT_CACHE');
  const used = usedIds;
  const eligible = nonPersistentPool.filter((/** @type {any} */ u) => !used.has(u.id));
  // Shuffle eligible and pick enough to fill 3 total slots
  const shuffled = shuffleInPlace(eligible.slice(), 'loot');
  while (pool.length < 3 && shuffled.length > 0) {
    const u = shuffled.pop();
    const price = shopPrice(u.id, floor, player ? player.upgrades : {});
    pool.push({
      id:u.id, name:u.name, desc:u.desc, colour:u.colour, price,
      fn: u.fn, persistent:u.persistent, maxLevel:u.maxLevel, levelDesc:u.levelDesc
    });
  }
  // If still < 3, add a weapon option
  while (pool.length < 3) {
    const wo = makeWeaponOption();
    pool.push({ ...wo, price: 70 + floor * 6 });
  }
  return pool.slice(0, 3).map(item => ({ ...item, sold: false }));
}
