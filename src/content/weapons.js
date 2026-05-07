// @ts-check
'use strict';

// Weapon and elite-affix catalogs plus deterministic weapon construction.
// Loaded before src/content.js so runtime item/shop generation can keep using
// the same globals while this subsystem has a smaller ownership surface.

// ─── Weapons ─────────────────────────────────────────────────────────────────
/** @type {Record<string, any>} */
const WEAPONS = {
  PULSE_PISTOL: { name:'Pulse Pistol', dmg:15, rate:3,   range:10, spread:0,   count:1, colour:'#00f5ff' },
  SCATTER_GUN:  { name:'Scatter Gun',  dmg:8,  rate:1,   range:5,  spread:0.3, count:4, colour:'#ff8800' },
  RAILGUN:      { name:'Railgun',      dmg:60, rate:0.5, range:20, spread:0,   count:1, piercing:true, colour:'#ff00c8' },
  PLASMA_SWORD: { name:'Plasma Sword', dmg:30, rate:2,   range:1.5,spread:0,   count:1, melee:true, colour:'#00ff88' },
  VOID_CANNON:  { name:'Void Cannon',  dmg:45, rate:1.5, range:12, spread:0,   count:1, colour:'#aa00ff' },
};
const WEAPON_KEYS = Object.keys(WEAPONS);

// ─── Weapon Affixes ──────────────────────────────────────────────────────────
/** @type {Record<string, any>} */
const WEAPON_AFFIXES = {
  // Prefixes (stat modifiers) — max 1 per weapon
  RAPID:    { slot:'prefix', label:'Rapid',    colour:'#44ff88', desc:'+30% fire rate',    mods:{rate:1.3} },
  HEAVY:    { slot:'prefix', label:'Heavy',    colour:'#ff6644', desc:'+35% dmg, −20% rate', mods:{dmg:1.35,rate:0.8} },
  EXTENDED: { slot:'prefix', label:'Extended', colour:'#44ccff', desc:'+40% range',        mods:{range:1.4} },
  TWIN:     { slot:'prefix', label:'Twin',     colour:'#ffcc44', desc:'+1 projectile',     mods:{countAdd:1,dmg:0.85} },
  PRECISE:  { slot:'prefix', label:'Precise',  colour:'#ffffff', desc:'Tighter spread',    mods:{spread:0.4} },
  BURST:    { slot:'prefix', label:'Burst',    colour:'#ffaa66', desc:'+50% rate, +1 proj, −20% dmg, −25% range', mods:{rate:1.5,countAdd:1,dmg:0.8,range:0.75} },
  VOLATILE: { slot:'prefix', label:'Volatile', colour:'#ff44dd', desc:'+50% dmg, −20% rate, wider spread', mods:{dmg:1.5,rate:0.8,spreadAdd:0.25} },
  KEEN:     { slot:'prefix', label:'Keen',     colour:'#ffdd00', desc:'+12% crit chance',  mods:{critAdd:0.12} },
  DEADLY:   { slot:'prefix', label:'Deadly',   colour:'#ff2244', desc:'+50% crit damage',  mods:{critMulAdd:0.5} },
  // Suffixes (on-hit / on-kill effects) — max 1 per weapon
  FLAME:    { slot:'suffix', label:'of Flame',     colour:'#ff6600', desc:'Ignites enemies',       effect:'burn' },
  FROST:    { slot:'suffix', label:'of Frost',     colour:'#66ccff', desc:'Slows enemies',         effect:'slow' },
  VAMPIRIC: { slot:'suffix', label:'of Vampirism', colour:'#ff0066', desc:'Steals life on hit',    effect:'leech' },
  THUNDER:  { slot:'suffix', label:'of Thunder',   colour:'#ffff44', desc:'Chain lightning chance', effect:'chain' },
  DETONATE: { slot:'suffix', label:'of Detonation',colour:'#ff4400', desc:'Enemies explode on kill',effect:'explode' },
  VOLTAIC:  { slot:'suffix', label:'of Storms',    colour:'#ffee44', desc:'Shocks enemies on hit',  effect:'shock' },
  RECOIL:   { slot:'suffix', label:'of Recoil',    colour:'#ffaa66', desc:'Knocks enemies back',    effect:'recoil' },
  EXECUTE:  { slot:'suffix', label:'of Execution', colour:'#aa44ff', desc:'Finishes enemies <20% HP', effect:'execute' },
  MARK:     { slot:'suffix', label:'of Marking',   colour:'#ff44aa', desc:'Marks enemies — follow-ups +30%', effect:'mark' },
  GREEDY:   { slot:'suffix', label:'of Greed',     colour:'#ffd700', desc:'+50% credits on kill',   effect:'greedy' },
  SALVAGE:  { slot:'suffix', label:'of Salvage',   colour:'#44ffcc', desc:'10% chance to drop a CORE on kill', effect:'salvage' },
  LUCKY:    { slot:'suffix', label:'of Luck',      colour:'#ffdd66', desc:'8% chance to drop a bonus item on kill', effect:'lucky' },
  SIPHON:   { slot:'suffix', label:'of Siphoning', colour:'#88ff88', desc:'+1 credit per 3 hits',  effect:'siphon' },
  TOXIC:    { slot:'suffix', label:'of Toxin',    colour:'#88dd44', desc:'Stacks poison on hit (max 5)', effect:'poison' },
  STAGGER:  { slot:'suffix', label:'of Staggering',colour:'#88aaff', desc:'Brief slow on hit (per-hit cooldown)', effect:'stagger' },
  PIERCING_HEART: { slot:'suffix', label:'of Piercing Heart', colour:'#ff4488', desc:'+1 Max HP per kill (cap +20)', effect:'pierceheart' },
};
const AFFIX_KEYS = Object.keys(WEAPON_AFFIXES);
const AFFIX_PREFIXES = AFFIX_KEYS.filter(k => WEAPON_AFFIXES[k].slot === 'prefix');
const AFFIX_SUFFIXES = AFFIX_KEYS.filter(k => WEAPON_AFFIXES[k].slot === 'suffix');

// ─── Elite Enemy Affixes ──────────────────────────────────────────────────────
/** @type {Record<string, any>} */
const ELITE_AFFIXES = {
  SHIELDED:     { label:'Shielded',     colour:'#4488ff', desc:'Energy shield absorbs damage', icon:'◈' },
  BERSERKER:    { label:'Berserker',    colour:'#ff2222', desc:'Faster at low HP',             icon:'⚡' },
  REGENERATING: { label:'Regenerating', colour:'#22ff44', desc:'Slowly heals over time',       icon:'♻' },
  PHASING:      { label:'Phasing',      colour:'#cc88ff', desc:'Periodically invulnerable',    icon:'◇' },
  VOLATILE:     { label:'Volatile',     colour:'#ff6600', desc:'Explodes on death',            icon:'💥' },
  FRENZY:       { label:'Frenzy',       colour:'#ff4466', desc:'Enrages when allies die',      icon:'🔥' },
  PREDATOR:     { label:'Predator',     colour:'#ff0099', desc:'Locks on when player is hit',  icon:'🎯' },
};
const ELITE_AFFIX_KEYS = Object.keys(ELITE_AFFIXES);

/**
 * @param {any} enemyType
 */
function rollEliteAffix(enemyType) {
  // Filter out redundant combos
  const eligible = ELITE_AFFIX_KEYS.filter(k => {
    if (k === 'PHASING' && enemyType === 'PHANTOM') return false; // already phases
    if (k === 'VOLATILE' && enemyType === 'SEEKER') return false; // seeker already explodes
    // SHIELDER's directional shield uses the shared shieldHp pool (entities.js
    // takeDamage / aiShielder). The SHIELDED affix's regen at entities.js:306
    // would beat the 5s broken-recovery contract by restoring shieldHp at
    // 2s of no-hits. Disallow the combo to keep the directional shield's
    // state machine deterministic.
    if (k === 'SHIELDED' && enemyType === 'SHIELDER') return false;
    return true;
  });
  return eligible[rndInt(0, eligible.length - 1)];
}

/**
 * @param {any} affixId
 * @param {any} baseWeapon
 */
function affixEligible(affixId, baseWeapon) {
  if (affixId === 'PRECISE'  && baseWeapon.spread === 0) return false;
  if (affixId === 'TWIN'     && baseWeapon.melee)        return false;
  if (affixId === 'BURST'    && baseWeapon.melee)        return false;
  if (affixId === 'EXTENDED' && baseWeapon.melee)        return false;
  return true;
}

// Deterministic weapon construction from base key + affix list
/**
 * @param {any} baseKey
 * @param {any} affixIds
 */
function buildWeapon(baseKey, affixIds) {
  const base = WEAPONS[baseKey];
  if (!base) return { ...WEAPONS.PULSE_PISTOL, _base:'PULSE_PISTOL', _affixes:[], _rarity:0, displayName:'Pulse Pistol' };
  const w = { ...base, _base:baseKey, _affixes:[...affixIds], _rarity:affixIds.length };
  // Apply prefix stat mods (multiplicative, except countAdd / spreadAdd /
  // critAdd / critMulAdd which are additive)
  for (const id of affixIds) {
    const af = WEAPON_AFFIXES[id];
    if (!af || !af.mods) continue;
    if (af.mods.dmg)      w.dmg    = Math.round(w.dmg * af.mods.dmg);
    if (af.mods.rate)     w.rate   = +(w.rate * af.mods.rate).toFixed(2);
    if (af.mods.range)    w.range  = +(w.range * af.mods.range).toFixed(1);
    if (af.mods.spread !== undefined) w.spread = +(w.spread * af.mods.spread).toFixed(3);
    if (af.mods.spreadAdd) w.spread = +(w.spread + af.mods.spreadAdd).toFixed(3);
    if (af.mods.countAdd) w.count  = w.count + af.mods.countAdd;
    if (af.mods.critAdd)  w.critAdd = +((w.critAdd || 0) + af.mods.critAdd).toFixed(3);
    if (af.mods.critMulAdd) w.critMulAdd = +((w.critMulAdd || 0) + af.mods.critMulAdd).toFixed(3);
  }
  // Build display name: "Rapid Pulse Pistol of Flame"
  const prefix = affixIds.find((/** @type {any} */ id) => WEAPON_AFFIXES[id]?.slot === 'prefix');
  const suffix = affixIds.find((/** @type {any} */ id) => WEAPON_AFFIXES[id]?.slot === 'suffix');
  let dn = base.name;
  if (prefix) dn = WEAPON_AFFIXES[prefix].label + ' ' + dn;
  if (suffix) dn = dn + ' ' + WEAPON_AFFIXES[suffix].label;
  w.displayName = dn;
  // Collect on-hit/on-kill effects
  w._effects = affixIds.map((/** @type {any} */ id) => WEAPON_AFFIXES[id]?.effect).filter(Boolean);
  return w;
}

// Roll random affixes based on floor depth
/**
 * @param {any} baseKey
 * @param {any} floor
 */
function rollWeapon(baseKey, floor) {
  if (floor <= 1) return buildWeapon(baseKey, []);
  const base = WEAPONS[baseKey];
  if (!base) return buildWeapon(baseKey, []);
  // Affix chance tiers
  let pTwo, pOne;
  if (floor <= 3)      { pTwo = 0;    pOne = 0.50; }
  else if (floor <= 5) { pTwo = 0.25; pOne = 0.45; }
  else                 { pTwo = 0.40; pOne = 0.40; }
  const roll = rand('loot');
  let wantCount;
  if (roll < pTwo)           wantCount = 2;
  else if (roll < pTwo+pOne) wantCount = 1;
  else                       wantCount = 0;
  if (wantCount === 0) return buildWeapon(baseKey, []);
  const affixes = [];
  // Pick eligible prefix
  const eligPre = AFFIX_PREFIXES.filter(id => affixEligible(id, base));
  // Pick eligible suffix
  const eligSuf = AFFIX_SUFFIXES.filter(id => affixEligible(id, base));
  if (wantCount >= 2 && eligPre.length && eligSuf.length) {
    affixes.push(eligPre[rndInt(0, eligPre.length - 1, 'loot')]);
    affixes.push(eligSuf[rndInt(0, eligSuf.length - 1, 'loot')]);
  } else if (wantCount >= 1) {
    // Pick from either pool
    const combined = [...eligPre, ...eligSuf];
    if (combined.length) affixes.push(combined[rndInt(0, combined.length - 1, 'loot')]);
  }
  return buildWeapon(baseKey, affixes);
}

// Rarity border colours for UI
const RARITY_COLOURS = ['#aaaaaa', '#39ff14', '#cc44ff']; // common, uncommon, rare
const RARITY_LABELS  = ['COMMON', 'UNCOMMON', 'RARE'];
