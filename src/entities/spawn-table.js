// @ts-check
'use strict';

// Enemy weighted selection table. Loaded before entities.js so room population,
// event spawns, and support devices can all share the same classic globals.

/** @type {Record<string, any>} */
const ENEMY_WEIGHTS = {
  GUARD:    { base: 40, perFloor: -3 },   // common early, fades
  TURRET:   { base: 20, perFloor: 1 },    // steady
  CRAWLER:  { base: 10, perFloor: 3 },    // ramps up mid-game
  SCORCHER: { base: 2,  perFloor: 2, minFloor: 4 },  // fire-trail pressure unit
  BRUTE:    { base: 3,  perFloor: 2, minFloor: 3 },  // melee-only heavy pursuer
  PHANTOM:  { base: 2,  perFloor: 2, minFloor: 5 },  // stealth assassin
  DRONE:    { base: 5,  perFloor: 3 },    // late-game ranged
  SHIELDER: { base: 3,  perFloor: 2, minFloor: 3 },  // mid-game tank
  SPLITTER: { base: 2,  perFloor: 2, minFloor: 4 },  // splits into SHARDs on death
  GRENADIER:  { base: 1,  perFloor: 2, minFloor: 5 },  // late-game zone denial
  TELEPORTER: { base: 1,  perFloor: 2, minFloor: 6 },  // deep-floor blinker
  SNIPER:     { base: 1,  perFloor: 2, minFloor: 7 },  // glass-cannon laser sight
  SUMMONER:   { base: 1,  perFloor: 2, minFloor: 6 },  // spawns minion drones
  HEALER:     { base: 1,  perFloor: 2, minFloor: 5 },  // heals wounded allies
  CHARGER:    { base: 2,  perFloor: 2, minFloor: 4 },  // charge-attack melee rusher
  LEAPER:     { base: 4,  perFloor: 2, minFloor: 2 },  // jumping shockwave attacker — appears early
  REFLECTOR:  { base: 1,  perFloor: 2, minFloor: 7 },  // projectile-reflecting shield
  DISRUPTOR:  { base: 1,  perFloor: 2, minFloor: 6 },  // area-denial field deployer
  WRAITH:     { base: 1,  perFloor: 2, minFloor: 8 },  // wall-phasing ethereal predator
  NEXUS:      { base: 1,  perFloor: 2, minFloor: 9 },  // neural command node, buffs linked allies
  SIPHON:     { base: 1,  perFloor: 2, minFloor: 8 },  // life-draining predator
  GRAVITON:   { base: 1,  perFloor: 2, minFloor: 7 },  // gravity well deployer
  SEEKER:     { base: 2,  perFloor: 3, minFloor: 3 },  // kamikaze explosive drone
  PULSER:     { base: 5,  perFloor: 1, minFloor: 2 },  // telegraphed charge-up attacker
  TUNNELLER:  { base: 2,  perFloor: 2, minFloor: 4 },  // burrows underground, surfaces beneath player with AoE telegraph
  ECHOER:     { base: 2,  perFloor: 2, minFloor: 5 },  // sonar predictor — fires at where the player WAS (anti-pattern punisher)
  PROPHET:    { base: 2,  perFloor: 2, minFloor: 6 },  // future-sight predictor — fires at where the player WILL BE (anti-motion punisher)
  RESONATOR:  { base: 2,  perFloor: 2, minFloor: 6 },  // stationary cone battery — telegraphed 60° wedge, dash-through counter
  MIRROR:     { base: 2,  perFloor: 1, minFloor: 8 },  // stationary mimic battery — fires single shot using player's last-fired kinematics
  REAPER:     { base: 2,  perFloor: 2, minFloor: 7 },  // aggression-punishing chaser — frenzy at 5 kills in current room
  GHOST_PROJECTOR: { base: 1, perFloor: 1, minFloor: 8 },  // stationary lens — replays a ghost of the last ghostable kill in its room
  CRYOPHAGE:  { base: 2,  perFloor: 1, minFloor: 6 },  // frost-patch layer — telegraphs a 5-tile + lattice on the player's CURRENT tile (anti-camping)
  WARDLING:   { base: 2,  perFloor: 1, minFloor: 5 },  // fragile bodyguard — physically intercepts player projectiles aimed at its ward (compositional)
  VENGEANCE:  { base: 1,  perFloor: 1, minFloor: 7 },  // kill-charged retaliator — accumulates charges from in-room kills, commits one telegraphed power-rush at threshold
  CONDUIT:    { base: 1,  perFloor: 1, minFloor: 8 },  // paired-beam mob — solo: weak basic shots, paired: damaging beam between bodies (compositional anti-camping)
  HARVESTER:  { base: 4,  perFloor: 1, minFloor: 4 },  // fragile chaser — drops a temp damage-surge pickup on death (no permanent power)
  MAGNETON:   { base: 2,  perFloor: 1, minFloor: 6 },  // stationary projectile-bender — pulls player shots toward itself (anti-spam, compositional)
  SPECTRE:    { base: 2,  perFloor: 1, minFloor: 7 },  // phase/manifest cycler — invulnerable & harmless during phase, vulnerable & dangerous during manifest (timing-based)
  SAPPER:     { base: 2,  perFloor: 1, minFloor: 5 },  // boost-drain leech — fast fragile chaser, drains time from active timed boosts on contact (anti-buff-stacking, compositional)
  MAGPIE:     { base: 2,  perFloor: 1, minFloor: 4 },  // loot-thief — fast fragile non-damaging mob that races to dropped Items, banks credits, drops a hoard pickup on death (currency-economy pressure)
  TETHER:     { base: 2,  perFloor: 1, minFloor: 5 },  // anti-kiting slow-aura — slow fragile chaser, NO contact damage; passive leash field slows player proportional to distance (closer = faster, inversion of normal kite-and-shoot instinct)
  VAULTMASTER:{ base: 2,  perFloor: 1, minFloor: 4 },  // economic-inverse — slow non-damaging chaser, ejects a small VaultCoin pickup on every hit (ICD-throttled), drops a jackpot pickup on death (risk/reward: kill fast for safety vs milk for credits, opposite verb of MAGPIE)
  GULPER:     { base: 2,  perFloor: 1, minFloor: 6 },  // projectile-eating mid-tank — slow chaser with front-facing mouth-cone that destroys player shots and stacks; at max stacks belches a fat slow projectile (anti-spam, compositional — counter via flank/melee/burst, distinct from MAGNETON which only bends)
  WATCHER:    { base: 2,  perFloor: 1, minFloor: 6 },  // sweeping vision-cone lighthouse — stationary, cone rotates continuously at WATCHER_SWEEP_RATE; on player-cross it locks+telegraphs+fires a hitscan beam (anti-camping, anti-static-positioning — counter by perpendicular crossings, dash through telegraph, or LOS break, distinct from RESONATOR which AIMS the cone)
  ARCHITECT:  { base: 2,  perFloor: 1, minFloor: 7 },  // stationary fortifier — atk=0, periodically converts a FLOOR tile BETWEEN itself and the perceived target into a temporary T.WALL (auto-decays in 12s), creating cover. Counterplay: kill the architect, break LOS, or move ONTO the targeted tile to cancel the build (between-geometry rule prevents telefrag-class griefing)
  NULLIFIER:  { base: 1,  perFloor: 1, minFloor: 6 },  // stationary anti-hackware specialist — atk=0, projects persistent radial jam aura (NULLIFIER_FIELD_R tiles); inside aura, player.hackwareCooldown does NOT tick AND activateHackware fails. First mob whose entire role is anti-hackware (gap fill: SAPPER drains TIMED BOOSTS, DISRUPTOR drops decaying fields). Counterplay: leave aura OR kill the mob (stun also defuses, since stunTimer > 0 returns early before aiNullifier and gates updateNullifierJam too)
};
const ENEMY_TYPES_LIST = Object.keys(ENEMY_WEIGHTS);

/**
 * @param {any} [floorNum]
 */
function pickEnemyType(floorNum) {
  const weights = [];
  let total = 0;
  for (const t of ENEMY_TYPES_LIST) {
    const cfg = ENEMY_WEIGHTS[t];
    if (cfg.minFloor && floorNum < cfg.minFloor) continue; // floor-gated
    const w = Math.max(1, cfg.base + cfg.perFloor * (floorNum - 1));
    weights.push({ type: t, w });
    total += w;
  }
  let r = rand('spawn') * total;
  for (const { type, w } of weights) { r -= w; if (r <= 0) return type; }
  return 'GUARD';
}
