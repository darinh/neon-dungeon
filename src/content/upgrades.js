// @ts-check
'use strict';

// Loaded before src/content/pickups.js, whose top-level ITEM_TYPES reads UPGRADES at load; later scripts read these globals only when called.
const UPGRADES = [
  {id:'MED_PACK',    name:'Med-Pack',     desc:'+40 HP',               colour:'#00ff88', rarity:40, persistent:false,
   fn: (/** @type {any} */ p)=>{ p.hp=Math.min(p.maxHp,p.hp+40); }},
  {id:'NANO_REPAIR', name:'Nano-Repair',  desc:'+15 HP',               colour:'#88ff88', rarity:35, persistent:false,
   fn: (/** @type {any} */ p)=>{ p.hp=Math.min(p.maxHp,p.hp+15); }},
  {id:'XP_CHIP',     name:'XP Chip',      desc:'+50 XP',               colour:'#ffff00', rarity:20, persistent:false,
   fn: (/** @type {any} */ p)=>{ p.gainXP(50); }},
  // Currency only — no persistent power. Auto-applied on the _isSimple path in src/game.js (not WEAPON_/HACKWARE_), so no popup.
  {id:'CREDIT_CACHE', name:'Credit Cache', desc:'+CR',                  colour:'#ffd700', rarity:50, persistent:false,
   fn: (/** @type {any} */ p)=>{
     const floor = (typeof _CG !== 'undefined' && _CG.floor) ? _CG.floor : 1;
     const base = 15 + floor * 5;
     const metaMul = (typeof getMetaCreditMultiplier === 'function') ? getMetaCreditMultiplier() : 1;
     const siphon = (typeof hasAugment === 'function' && hasAugment('CREDIT_SIPHON')) ? 1.5 : 1;
     // Use the same difficulty creditMul as room-clear and kill credits so this pickup scales with the rest of the economy on EASY and NIGHTMARE.
     const diffMul = (typeof getDiff === 'function') ? (getDiff().creditMul || 1) : 1;
     // SCAVENGER bonus is flat and added after rounding so multipliers cannot scale it. Clamp corrupt saves to 0..32 before flooring.
     let bonus = (p && p.bonusCreditPerPickup) || 0;
     if (!Number.isFinite(bonus) || bonus < 0) bonus = 0;
     if (bonus > 32) bonus = 32;
     bonus = Math.floor(bonus);
     const amt = Math.max(1, Math.round(base * metaMul * siphon * diffMul)) + bonus;
     p.credits = (p.credits || 0) + amt;
     if (typeof spawnDmgText === 'function') spawnDmgText(p.x, p.y, '+' + amt + ' CR', '#ffd700');
   }},
  // Temporary boost via NEON.boosts, not persistent power. Excluded from the vendor pool in src/meta/boosts.js so a flat random pick cannot arbitrage listed prices.
  {id:'TACTICAL_DROP', name:'Tactical Drop', desc:'Random combat boost', colour:'#ff8800', rarity:25, persistent:false,
   fn: (/** @type {any} */ p)=>{
     if (typeof NEON === 'undefined' || !NEON.boosts || !NEON.boosts.rollDropBoost) return;
     const id = NEON.boosts.rollDropBoost();
     if (!id) return;
     const b = NEON.boosts.BOOSTS && NEON.boosts.BOOSTS[id];
     NEON.boosts.applyBoost(p, id);
     // Label the rolled boost; the pickup itself does not name it.
     if (typeof spawnParticles === 'function') spawnParticles(p.x, p.y, 'EXPLOSION', (b && b.colour) || '#ff8800', 12);
     if (typeof audio !== 'undefined' && audio.hackwareCloak) { try { audio.hackwareCloak(); } catch(_){} }
     if (b && _CG && _CG.msg) _CG.msg(b.icon + ' ' + b.name + ' ACTIVE', b.colour);
     if (typeof spawnDmgText === 'function' && b) spawnDmgText(p.x, p.y, b.icon + ' ' + b.name, b.colour);
   }},
  {id:'SAW_BLADE',   name:'Saw Blade',    desc:'Orbital blade circles you',   colour:'#ff3333', rarity:12, persistent:true, maxLevel:4,
   levelDesc: (/** @type {any} */ l)=>(l+1)+' blade'+(l>0?'s':'')+', 12 dmg each',
   fn: (/** @type {any} */ p)=>{ p.upgrades.SAW_BLADE=(p.upgrades.SAW_BLADE||0)+1; }},
  {id:'PLASMA_ORB',  name:'Plasma Orb',   desc:'Auto-fires homing orb',       colour:'#ff44cc', rarity:10, persistent:true, maxLevel:3,
   levelDesc: (/** @type {any} */ l)=>'25 dmg, '+(3-l*0.7).toFixed(1)+'s cooldown',
   fn: (/** @type {any} */ p)=>{ p.upgrades.PLASMA_ORB=(p.upgrades.PLASMA_ORB||0)+1; }},
  {id:'NANO_REGEN',  name:'Nano Regen',   desc:'Passive HP regeneration',     colour:'#44ffaa', rarity:15, persistent:true, maxLevel:5,
   levelDesc: (/** @type {any} */ l)=>'+'+(l+1)+' HP/s',
   fn: (/** @type {any} */ p)=>{ p.upgrades.NANO_REGEN=(p.upgrades.NANO_REGEN||0)+1; }},
  {id:'OVERCLOCK',   name:'Overclock',    desc:'Permanent speed boost',       colour:'#ff00c8', rarity:10, persistent:true, maxLevel:3,
   levelDesc: (/** @type {any} */ l)=>'+'+(15*(l+1))+'% speed',
   fn: (/** @type {any} */ p)=>{ p.upgrades.OVERCLOCK=(p.upgrades.OVERCLOCK||0)+1; p.permSpeedBonus=(p.upgrades.OVERCLOCK)*0.5; }},
  {id:'ARMOR_UP',    name:'Reinforced Armor', desc:'Permanent +3 DEF',        colour:'#00aaff', rarity:12, persistent:true, maxLevel:5,
   levelDesc: (/** @type {any} */ l)=>'+'+(3*(l+1))+' DEF total',
   fn: (/** @type {any} */ p)=>{ p.upgrades.ARMOR_UP=(p.upgrades.ARMOR_UP||0)+1; p.def+=3; }},
  {id:'RICOCHET',   name:'Ricochet Module',  desc:'Bullets bounce off walls', colour:'#00ffff', rarity:8,  persistent:true, maxLevel:3,
   levelDesc: (/** @type {any} */ l)=>(l+1)+' bounce'+(l>0?'s':''),
   fn: (/** @type {any} */ p)=>{ p.upgrades.RICOCHET=(p.upgrades.RICOCHET||0)+1; }},
  {id:'SENTRY_DRONE', name:'Sentry Drone', desc:'Orbiting drone auto-fires at enemies', colour:'#00e5ff', rarity:7, persistent:true, maxLevel:3,
   levelDesc: (/** @type {any} */ l)=>(l+1)+' drone'+(l>0?'s':'')+', 8 dmg, '+(2.0-l*0.4).toFixed(1)+'s cd',
   fn: (/** @type {any} */ p)=>{ p.upgrades.SENTRY_DRONE=(p.upgrades.SENTRY_DRONE||0)+1; }},
];

const MAX_AUGMENTS = 3;
/** @type {Record<string, any>} */
const AUGMENTS = {
  NEURAL_LINK:      { name:'Neural Link',         icon:'🧠', colour:'#cc44ff', desc:'+25% XP from all sources' },
  TITANIUM_PLATING: { name:'Titanium Plating',     icon:'🛡', colour:'#4488cc', desc:'Reduce all damage by 1' },
  MAGNETIC_FIELD:   { name:'Magnetic Field',       icon:'🧲', colour:'#44ff88', desc:'Double item pickup radius' },
  THERMAL_OPTICS:   { name:'Thermal Optics',       icon:'👁', colour:'#ffcc00', desc:'Enemies visible on minimap' },
  ADRENALINE_INJECTOR:{ name:'Adrenaline Injector',icon:'💉', colour:'#ff4444', desc:'Kill: +30% speed for 2s' },
  OVERCLOCKER:      { name:'Overclocker',          icon:'⚡', colour:'#00ddff', desc:'Hackware cooldowns −30%' },
  ECHO_MAPPER:      { name:'Echo Mapper',          icon:'📡', colour:'#ffffff', desc:'Reveal minimap layout on entry' },
  CREDIT_SIPHON:    { name:'Credit Siphon',        icon:'💰', colour:'#ffaa00', desc:'+50% credits from all sources' },
  SCAVENGER_NANITES:{ name:'Scavenger Nanites',    icon:'🔧', colour:'#88ff44', desc:'10% kill chance: +5 HP' },
  KINETIC_AMPLIFIER:{ name:'Kinetic Amplifier',    icon:'🚀', colour:'#ff8800', desc:'+20% projectile speed' },
  TEMPORAL_DILATION:{ name:'Temporal Dilation',     icon:'⏳', colour:'#88ccff', desc:'All enemies 15% slower' },
  REACTIVE_ARMOR:   { name:'Reactive Armor',        icon:'💥', colour:'#ff6644', desc:'When hit, emit damage pulse' },
  EMERGENCY_CACHE:  { name:'Emergency Cache',       icon:'🔋', colour:'#88ffaa', desc:'Enter floor <30% HP: heal to 50%' },
  KINETIC_DAMPER:   { name:'Kinetic Damper',        icon:'⚙', colour:'#5588aa', desc:'−20% damage from direct hits' },
  BIOFILTER:        { name:'Biofilter',             icon:'🧪', colour:'#aaffcc', desc:'−50% burn DoT and hazard tile damage' },
};
const AUGMENT_KEYS = Object.keys(AUGMENTS);
