// @ts-check
'use strict';

// Level-up perk and augment-choice helpers. Loaded before src/content.js so
// runtime callers keep using the same globals while progression choices have a
// smaller ownership surface. Functions intentionally resolve _CG/game globals
// only when invoked after all runtime scripts have loaded.

// Choose-one-of-three at levels 2, 4, 6, 8. Auto-Laser capstone at level 10.
/** @type {Record<string, any>} */
const PERK_POOL = {
  LASER_SIGHT:     { name:'Laser Sight',     icon:'◎', desc:'Shows aim trajectory',                colour:'#00f5ff' },
  THREAT_SENSE:    { name:'Threat Sense',     icon:'⚠', desc:'Detects nearby off-screen foes',      colour:'#ff6644' },
  PIERCING_ROUNDS: { name:'Piercing Rounds',  icon:'⟫', desc:'Shots pierce one extra enemy',        colour:'#ff00c8' },
  ENERGY_SHIELD:   { name:'Energy Shield',    icon:'🛡', desc:'Absorbs one hit every 30s',           colour:'#4488ff' },
  VAMPIRIC:        { name:'Vampiric',         icon:'♥', desc:'Heal 2 HP per kill',                  colour:'#ff3366' },
  ADRENALINE:      { name:'Adrenaline',       icon:'⚡', desc:'+20% move speed',                     colour:'#39ff14' },
  RAPID_FIRE:      { name:'Rapid Fire',       icon:'»', desc:'-15% fire cooldown',                  colour:'#ffaa00' },
  CRITICAL_HIT:    { name:'Critical Hit',     icon:'✦', desc:'15% chance for 2× damage',            colour:'#ffdd00' },
  THICK_ARMOR:     { name:'Thick Armor',      icon:'█', desc:'+3 DEF',                              colour:'#88aacc' },
  BERSERKER:       { name:'Berserker',        icon:'🔥', desc:'+40% ATK below 25% HP',               colour:'#ff4400' },
  DASH_MASTER:     { name:'Dash Master',      icon:'⇒', desc:'Dash cooldown halved',                colour:'#ffb700' },
  HP_REGEN:        { name:'Nano Repair',      icon:'✚', desc:'Regen 1 HP every 3s',                 colour:'#00ff88' },
  EXPLOSIVE_KILLS: { name:'Explosive Kills',  icon:'💥', desc:'Enemies explode on death',            colour:'#ff6600' },
  MULTI_SHOT:      { name:'Multi-Shot',       icon:'⫸', desc:'Fire an extra 60%-damage projectile', colour:'#cc44ff' },
  SECOND_WIND:     { name:'Second Wind',      icon:'↺', desc:'Revive once per floor at 30% HP',     colour:'#00ddff' },
  PARRY:           { name:'Phase Parry',      icon:'⇄', desc:'Dash reflects enemy shots',           colour:'#aaffee' },
  LAST_STAND:      { name:'Last Stand',       icon:'⚔', desc:'Hit to ≤10% HP: +75% dmg, −50% taken (5s, 60s CD)', colour:'#ffcc00' },
  PRISTINE:        { name:'Pristine',          icon:'✧', desc:'+25% damage at or above 90% HP',       colour:'#88ffee' },
  STRIDE:          { name:'Stride',           icon:'⇶', desc:'Continuous movement: +5% ATK / sec (max 5)', colour:'#00ffaa' },
  DEADEYE:         { name:'Deadeye',          icon:'◎', desc:'Stand still 1s: next shot deals +50% damage', colour:'#ffee88' },
  OVERDRIVE:       { name:'Overdrive',         icon:'❯', desc:'Score combo buffs damage (+3%/level, max +30%)', colour:'#ff00c8' },
  RETRIBUTION:     { name:'Retribution',       icon:'☄', desc:'Take damage: +50% ATK for 3s',          colour:'#ff2266' },
  GLASS_CANNON:    { name:'Glass Cannon',      icon:'⟁', desc:'+30% damage dealt, +25% damage taken',  colour:'#ff66aa' },
  BULWARK:         { name:'Bulwark',           icon:'◈', desc:'−15% damage taken at or above 75% HP',   colour:'#88ccff' },
  EXPLOITER:       { name:'Exploiter',         icon:'🎯', desc:'+25% damage to enemies with status effects', colour:'#ff8844' },
  HOT_HAND:        { name:'Hot Hand',           icon:'♨', desc:'Consecutive hits on same target: +5% per stack (max +30%)', colour:'#ff5522' },
};
const PERK_CAPSTONE = { id:'AUTO_LASER', name:'Auto-Laser', icon:'⚡', desc:'Fires beam at nearest foe', colour:'#ff2222' };
const PERK_LEVELS = [2, 4, 6, 8]; // levels that trigger a perk choice

/**
 * @param {any} player
 * @param {any} count
 */
function rollPerkChoices(player, count) {
  const available = Object.keys(PERK_POOL).filter(id => !player.perks[id]);
  // Fisher-Yates shuffle, take first `count`
  shuffleInPlace(available, 'loot');
  return available.slice(0, Math.min(count, available.length));
}

/**
 * @param {any} player
 * @param {any} id
 */
function applyPerk(player, id) {
  player.perks[id] = true;
  const perk = PERK_POOL[id];
  if (id === 'ENERGY_SHIELD') player.energyShield = true;
  if (id === 'THICK_ARMOR') player.def += 3;
  if (perk) setTimeout(() => _CG.msg('⚡ PERK: '+perk.name, perk.colour), 200);
}

/**
 * @param {any} player
 */
function grantCapstone(player) {
  if (!player.perks.AUTO_LASER) {
    player.perks.AUTO_LASER = true;
    setTimeout(() => _CG.msg('⚡ CAPSTONE: '+PERK_CAPSTONE.name, PERK_CAPSTONE.colour), 200);
  }
}

/**
 * @param {any} id
 */
function hasAugment(id) { return !!(_CG.player && _CG.player.augments[id]); }

/**
 * @param {any} player
 * @param {any} count
 */
function rollAugmentChoices(player, count) {
  const owned = player.augments || {};
  const available = AUGMENT_KEYS.filter(id => !owned[id]);
  // Fisher-Yates shuffle
  for (let i = available.length - 1; i > 0; i--) {
    const j = rndInt(0, i);
    [available[i], available[j]] = [/** @type {string} */ (available[j]), /** @type {string} */ (available[i])];
  }
  return available.slice(0, count);
}
