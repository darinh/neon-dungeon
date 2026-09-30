// @ts-check
'use strict';

// Loaded before entities.js so spawnEnemy can keep these as script-tag globals.

/**
 * @typedef {{
 *   hp: number,
 *   atk: number,
 *   spd: number,
 *   xpVal: number,
 *   colour: string,
 * }} EnemyBaseStats
 */

/** @type {Readonly<EnemyBaseStats>} */
const FALLBACK_ENEMY_BASE_STATS = Object.freeze({
  hp: 0,
  atk: 0,
  spd: 0,
  xpVal: 0,
  colour: '#ffffff',
});

/** @type {Record<string, EnemyBaseStats>} */
const ENEMY_BASE_STATS = {
  // Boss base HP uses a larger scale; phase transitions are HP-ratio based.
  // spawnEnemy then scales HP and ATK by floor and difficulty (HP also by the floor modifier), and SPD by difficulty only.
  GUARD: { hp: 80, atk: 8, spd: 2, xpVal: 20, colour: '#ff3333' },
  TURRET: { hp: 50, atk: 12, spd: 0, xpVal: 15, colour: '#ffb700' },
  CRAWLER: { hp: 40, atk: 6, spd: 4, xpVal: 10, colour: '#39ff14' },
  SCORCHER: { hp: 56, atk: 9, spd: 2.6, xpVal: 24, colour: '#ff5522' },
  BRUTE: { hp: 140, atk: 16, spd: 1.6, xpVal: 30, colour: '#cc3344' },
  PHANTOM: { hp: 70, atk: 10, spd: 2.5, xpVal: 30, colour: '#cc00ff' },
  DRONE: { hp: 30, atk: 8, spd: 3, xpVal: 12, colour: '#00aaff' },
  SHIELDER: { hp: 100, atk: 10, spd: 1.5, xpVal: 25, colour: '#66eeff' },
  GRENADIER: { hp: 60, atk: 10, spd: 2, xpVal: 20, colour: '#ff6622' },
  SPLITTER: { hp: 80, atk: 8, spd: 2.2, xpVal: 25, colour: '#00ff88' },
  TELEPORTER: { hp: 50, atk: 12, spd: 0, xpVal: 22, colour: '#ff44ff' },
  SNIPER: { hp: 40, atk: 15, spd: 2.5, xpVal: 25, colour: '#ff2266' },
  SUMMONER: { hp: 70, atk: 8, spd: 1.5, xpVal: 30, colour: '#bb44ff' },
  HEALER: { hp: 50, atk: 6, spd: 1.8, xpVal: 22, colour: '#44ffaa' },
  CHARGER: { hp: 90, atk: 14, spd: 1.5, xpVal: 22, colour: '#ff6600' },
  LEAPER: { hp: 60, atk: 11, spd: 3.0, xpVal: 22, colour: '#22ff88' },
  REFLECTOR: { hp: 80, atk: 10, spd: 1.8, xpVal: 28, colour: '#88ddff' },
  DISRUPTOR: { hp: 60, atk: 9, spd: 2.0, xpVal: 25, colour: '#ff44aa' },
  WRAITH: { hp: 70, atk: 13, spd: 2.8, xpVal: 30, colour: '#66ffcc' },
  NEXUS: { hp: 80, atk: 8, spd: 1.8, xpVal: 35, colour: '#00eedd' },
  SIPHON: { hp: 60, atk: 10, spd: 2.2, xpVal: 28, colour: '#dd2244' },
  GRAVITON: { hp: 90, atk: 8, spd: 1.5, xpVal: 30, colour: '#8833ff' },
  SEEKER: { hp: 36, atk: 12, spd: 3.5, xpVal: 12, colour: '#ffdd00' },
  PULSER: { hp: 40, atk: 12, spd: 1.5, xpVal: 15, colour: '#44ddff' },
  MIMIC: { hp: 60, atk: 14, spd: 2.2, xpVal: 25, colour: '#cc33ff' },
  TUNNELLER: { hp: 80, atk: 14, spd: 2.0, xpVal: 26, colour: '#cc8844' },
  ECHOER: { hp: 60, atk: 12, spd: 1.4, xpVal: 26, colour: '#aa66ff' },
  PROPHET: { hp: 55, atk: 12, spd: 1.3, xpVal: 28, colour: '#ffaa22' },
  RESONATOR: { hp: 70, atk: 15, spd: 0, xpVal: 28, colour: '#ff66cc' },
  MIRROR: { hp: 55, atk: 12, spd: 0, xpVal: 26, colour: '#88ff44' },
  REAPER: { hp: 70, atk: 14, spd: 2.4, xpVal: 26, colour: '#cc1144' },
  GHOST_PROJECTOR: { hp: 50, atk: 0, spd: 0, xpVal: 24, colour: '#cc99ff' },
  CRYOPHAGE: { hp: 70, atk: 14, spd: 1.0, xpVal: 28, colour: '#88ddff' },
  WARDLING: { hp: 25, atk: 4, spd: 2.5, xpVal: 10, colour: '#ffcc66' },
  VENGEANCE: { hp: 80, atk: 18, spd: 0, xpVal: 24, colour: '#cc1166' },
  CONDUIT: { hp: 60, atk: 14, spd: 0, xpVal: 20, colour: '#44ffff' },
  HARVESTER: { hp: 30, atk: 8, spd: 1.8, xpVal: 12, colour: '#ff9933' },
  MAGNETON: { hp: 50, atk: 0, spd: 0, xpVal: 22, colour: '#ff44dd' },
  SPECTRE: { hp: 28, atk: 12, spd: 2.4, xpVal: 22, colour: '#eeccff' },
  SAPPER: { hp: 22, atk: 6, spd: 2.8, xpVal: 14, colour: '#ddff44' },
  MAGPIE: { hp: 28, atk: 0, spd: 3.4, xpVal: 12, colour: '#cceeff' },
  TETHER: { hp: 24, atk: 0, spd: 2.6, xpVal: 14, colour: '#ff8866' },
  VAULTMASTER: { hp: 60, atk: 0, spd: 2.0, xpVal: 18, colour: '#ffcc44' },
  GULPER: { hp: 90, atk: 14, spd: 1.4, xpVal: 28, colour: '#bbdd33' },
  WATCHER: { hp: 70, atk: 12, spd: 0, xpVal: 26, colour: '#ffee66' },
  ARCHITECT: { hp: 80, atk: 0, spd: 0, xpVal: 30, colour: '#aa6633' },
  NULLIFIER: { hp: 70, atk: 0, spd: 0, xpVal: 24, colour: '#cc66dd' },
  SHARD: { hp: 30, atk: 5, spd: 3.5, xpVal: 8, colour: '#00cc66' },
  SENTINEL: { hp: 400, atk: 15, spd: 1.5, xpVal: 200, colour: '#ff4444' },
  WARDEN: { hp: 450, atk: 16, spd: 1.8, xpVal: 200, colour: '#ff8800' },
  HIVE: { hp: 650, atk: 18, spd: 1.2, xpVal: 350, colour: '#aa00ff' },
  CONDUCTOR: { hp: 700, atk: 20, spd: 1.4, xpVal: 350, colour: '#00ccff' },
  OMEGA: { hp: 1300, atk: 22, spd: 1.8, xpVal: 800, colour: '#ff00c8' },
  GENESIS: { hp: 1300, atk: 22, spd: 1.0, xpVal: 800, colour: '#ffcc00' },
};

/**
 * @param {string} type
 * @returns {Readonly<EnemyBaseStats>}
 */
function getEnemyBaseStats(type) {
  return ENEMY_BASE_STATS[type] || FALLBACK_ENEMY_BASE_STATS;
}
