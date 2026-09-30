// @ts-check
'use strict';

// Loaded before entities.js so room population, event spawns, and support devices share the same globals.

/** @type {Record<string, any>} */
const ENEMY_WEIGHTS = {
  GUARD:    { base: 40, perFloor: -3 },   // negative perFloor: common early, fades
  TURRET:   { base: 20, perFloor: 1 },
  CRAWLER:  { base: 10, perFloor: 3 },
  SCORCHER: { base: 2,  perFloor: 2, minFloor: 4 },
  BRUTE:    { base: 3,  perFloor: 2, minFloor: 3 },
  PHANTOM:  { base: 2,  perFloor: 2, minFloor: 5 },
  DRONE:    { base: 5,  perFloor: 3 },
  SHIELDER: { base: 3,  perFloor: 2, minFloor: 3 },
  SPLITTER: { base: 2,  perFloor: 2, minFloor: 4 },
  GRENADIER:  { base: 1,  perFloor: 2, minFloor: 5 },
  TELEPORTER: { base: 1,  perFloor: 2, minFloor: 6 },
  SNIPER:     { base: 1,  perFloor: 2, minFloor: 7 },
  SUMMONER:   { base: 1,  perFloor: 2, minFloor: 6 },
  HEALER:     { base: 1,  perFloor: 2, minFloor: 5 },
  CHARGER:    { base: 2,  perFloor: 2, minFloor: 4 },
  LEAPER:     { base: 4,  perFloor: 2, minFloor: 2 },
  REFLECTOR:  { base: 1,  perFloor: 2, minFloor: 7 },
  DISRUPTOR:  { base: 1,  perFloor: 2, minFloor: 6 },
  WRAITH:     { base: 1,  perFloor: 2, minFloor: 8 },
  NEXUS:      { base: 1,  perFloor: 2, minFloor: 9 },
  SIPHON:     { base: 1,  perFloor: 2, minFloor: 8 },
  GRAVITON:   { base: 1,  perFloor: 2, minFloor: 7 },
  SEEKER:     { base: 2,  perFloor: 3, minFloor: 3 },
  PULSER:     { base: 5,  perFloor: 1, minFloor: 2 },
  TUNNELLER:  { base: 2,  perFloor: 2, minFloor: 4 },
  ECHOER:     { base: 2,  perFloor: 2, minFloor: 5 },
  PROPHET:    { base: 2,  perFloor: 2, minFloor: 6 },
  RESONATOR:  { base: 2,  perFloor: 2, minFloor: 6 },
  MIRROR:     { base: 2,  perFloor: 1, minFloor: 8 },
  REAPER:     { base: 2,  perFloor: 2, minFloor: 7 },
  GHOST_PROJECTOR: { base: 1, perFloor: 1, minFloor: 8 },
  CRYOPHAGE:  { base: 2,  perFloor: 1, minFloor: 6 },
  WARDLING:   { base: 2,  perFloor: 1, minFloor: 5 },
  VENGEANCE:  { base: 1,  perFloor: 1, minFloor: 7 },
  CONDUIT:    { base: 1,  perFloor: 1, minFloor: 8 },
  HARVESTER:  { base: 4,  perFloor: 1, minFloor: 4 },
  MAGNETON:   { base: 2,  perFloor: 1, minFloor: 6 },
  SPECTRE:    { base: 2,  perFloor: 1, minFloor: 7 },
  SAPPER:     { base: 2,  perFloor: 1, minFloor: 5 },
  MAGPIE:     { base: 2,  perFloor: 1, minFloor: 4 },
  TETHER:     { base: 2,  perFloor: 1, minFloor: 5 },
  VAULTMASTER:{ base: 2,  perFloor: 1, minFloor: 4 },
  GULPER:     { base: 2,  perFloor: 1, minFloor: 6 },
  WATCHER:    { base: 2,  perFloor: 1, minFloor: 6 },
  ARCHITECT:  { base: 2,  perFloor: 1, minFloor: 7 },
  NULLIFIER:  { base: 1,  perFloor: 1, minFloor: 6 },
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
    if (cfg.minFloor && floorNum < cfg.minFloor) continue;
    const w = Math.max(1, cfg.base + cfg.perFloor * (floorNum - 1));
    weights.push({ type: t, w });
    total += w;
  }
  let r = rand('spawn') * total;
  for (const { type, w } of weights) { r -= w; if (r <= 0) return type; }
  return 'GUARD';
}
