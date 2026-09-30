// @ts-check
'use strict';

// Loaded before src/content.js so coordinators keep sharing these script-tag globals.

/** @type {any} */
const _CM = new Proxy({}, {
  get: (_t, p) => /** @type {any} */ (game)[p],
  set: (_t, p, v) => { /** @type {any} */ (game)[p] = v; return true; },
  has: (_t, p) => p in /** @type {any} */ (game),
});

/** @type {Record<string, any>} */
const DIFFICULTIES = {
  EASY:   { id:'EASY',   label:'EASY',   colour:'#39ff14', enemyHp:0.75, enemyAtk:0.75, enemySpd:1.0,  itemDrop:0.25, creditMul:1.2, xpMul:1.0,  eliteRate:0.04, shardMul:0.85, envDmg:0.75, roomLoot:2 },
  NORMAL: { id:'NORMAL', label:'NORMAL', colour:'#00f5ff', enemyHp:1.0,  enemyAtk:1.0,  enemySpd:1.0,  itemDrop:0.15, creditMul:1.0, xpMul:1.0,  eliteRate:0.10, shardMul:1.0,  envDmg:1.0,  roomLoot:1 },
  HARD:      { id:'HARD',      label:'HARD',      colour:'#ff3333', enemyHp:1.5,  enemyAtk:1.3,  enemySpd:1.1,  itemDrop:0.12, creditMul:1.0,  xpMul:1.15, eliteRate:0.18, shardMul:1.3,  envDmg:1.25, roomLoot:1 },
  NIGHTMARE: { id:'NIGHTMARE', label:'NIGHTMARE', colour:'#9400ff', enemyHp:2.0,  enemyAtk:1.6,  enemySpd:1.2,  itemDrop:0.08, creditMul:0.85, xpMul:1.35, eliteRate:0.28, shardMul:1.8,  envDmg:1.5,  roomLoot:0 },
};
const DIFF_ORDER = ['EASY','NORMAL','HARD','NIGHTMARE'];
function getDiff() { return DIFFICULTIES[_CM.difficulty] || DIFFICULTIES.NORMAL; }

/** @type {Record<string, any>} */
const FLOOR_MODIFIERS = {
  BLACKOUT:  { label:'BLACKOUT',  desc:'Emergency lights only',     colour:'#4466aa', icon:'◐' },
  SWARM:     { label:'SWARM',     desc:'Alert — all units respond', colour:'#ff6644', icon:'⚠' },
  FORTIFIED: { label:'FORTIFIED', desc:'Reinforced patrols',        colour:'#66eeff', icon:'🛡' },
  VOLATILE:  { label:'VOLATILE',  desc:'Unstable power cells',      colour:'#ff4422', icon:'💥' },
  SCRAMBLED: { label:'SCRAMBLED', desc:'Targeting interference',     colour:'#cc44ff', icon:'⌁' },
  OVERCLOCK: { label:'OVERCLOCK', desc:'System overclock detected',  colour:'#ffcc00', icon:'⚡' },
  CORROSIVE: { label:'CORROSIVE', desc:'Toxic atmosphere',            colour:'#44ff22', icon:'☣' },
  CHARGED:   { label:'CHARGED',   desc:'Supercharged projectiles',    colour:'#aaccff', icon:'⊕' },
  FRAGILE:   { label:'FRAGILE',   desc:'Glass-cannon protocol',       colour:'#ff88cc', icon:'❖' },
  HUNTER:    { label:'HUNTER',    desc:'Sensors lock stationary prey', colour:'#ff8844', icon:'◎' },
  REGENERATIVE: { label:'REGENERATIVE', desc:'Patrols self-repair when uncontested', colour:'#44ddaa', icon:'✚' },
  CASCADE:   { label:'CASCADE',   desc:'Defeats nearby release medical pulse', colour:'#44ff88', icon:'♥' },
  OVERCHARGE:{ label:'OVERCHARGE',desc:'Every 5th shot guaranteed crit',        colour:'#ffee66', icon:'⚡' },
  WINDFALL:  { label:'WINDFALL',  desc:'Every 5th defeat drops a bonus core',   colour:'#a866ff', icon:'◆' },
  SIGNAL_BOOST: { label:'SIGNAL_BOOST', desc:'Every 5th defeat resets hackware', colour:'#00ddff', icon:'↻' },
  REVERB:    { label:'REVERB',    desc:'Every 5th shot fires a free echo',     colour:'#ff66cc', icon:'♪' },
  QUARTERMASTER: { label:'QUARTERMASTER', desc:'First defeat in each room drops a bonus core', colour:'#ffaa44', icon:'▣' },
  AUTONOMY:  { label:'AUTONOMY',  desc:'Hackware cooldowns reduced 25% on this floor', colour:'#88ff44', icon:'⚙' },
  CHAINREACT:{ label:'CHAINREACT',desc:'Chained defeats within 1.5s award bonus credits', colour:'#ff8866', icon:'⚡' },
  MAGNETISM: { label:'MAGNETISM', desc:'Item pickup radius increased 50% on this floor', colour:'#bb88ff', icon:'⊛' },
  HARDENED:  { label:'HARDENED',  desc:'Reactive plating — incoming damage reduced 20%', colour:'#88aacc', icon:'⊞' },
  OVERFLOW:  { label:'OVERFLOW',  desc:'Surplus data — XP gain +25%', colour:'#66ffaa', icon:'▲' },
  KINETIC:   { label:'KINETIC',   desc:'Inertial primer — dash cooldown -30%', colour:'#88ddff', icon:'»' },
  PRIMED:    { label:'PRIMED',    desc:'Smartlink — first shot in each room crits', colour:'#ffaa00', icon:'◎' },
  JAMMED:    { label:'JAMMED',    desc:'Signal jammed — hackware cooldowns increased 25%', colour:'#cc6644', icon:'⊘' },
  PROXIMITY: { label:'PROXIMITY', desc:'Close-range bonus — enemies within 4t take +30% damage', colour:'#ff66aa', icon:'◉' },
};
const MODIFIER_KEYS = Object.keys(FLOOR_MODIFIERS);
function getMod() { return _CM.modifier && FLOOR_MODIFIERS[_CM.modifier] || null; }
/**
 * @param {any} base
 */
function modSpeed(base) { return _CM.modifier === 'OVERCLOCK' ? base * 1.2 : base; }
