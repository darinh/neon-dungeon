// @ts-check
'use strict';

// Entity source metadata is loaded before entities.js so the legacy script-tag
// globals below are available to entity death rewards and later UI modules.

/** @type {Record<string, any>} */
const CREDIT_VALUES = {GUARD:8, TURRET:6, CRAWLER:4, PHANTOM:12, DRONE:5, SHIELDER:10, GRENADIER:7, SPLITTER:9, TELEPORTER:8, SNIPER:10, SUMMONER:12, HEALER:8, CHARGER:9, SCORCHER:8, BRUTE:12, MIMIC:10, LEAPER:8, REFLECTOR:12, DISRUPTOR:10, WRAITH:12, NEXUS:12, SIPHON:10, GRAVITON:12, SEEKER:5, PULSER:7, ECHOER:9, RESONATOR:10, MIRROR:10, REAPER:10, GHOST_PROJECTOR:9, PROPHET:10, CRYOPHAGE:10, WARDLING:4, VENGEANCE:10, CONDUIT:8, HARVESTER:5, MAGNETON:8, SPECTRE:9, SAPPER:6, MAGPIE:4, TETHER:6, VAULTMASTER:4, GULPER:11, WATCHER:9, ARCHITECT:10, NULLIFIER:10, SHARD:0, SENTINEL:80, WARDEN:80, HIVE:120, CONDUCTOR:120, OMEGA:200, GENESIS:200};

/** @type {Record<string, any>} */
const SOURCE_LABELS = {
  GUARD:'Guard', TURRET:'Turret', CRAWLER:'Crawler', PHANTOM:'Phantom',
  DRONE:'Drone', SHIELDER:'Shielder', GRENADIER:'Grenadier', SPLITTER:'Splitter',
  TELEPORTER:'Teleporter', SNIPER:'Sniper', SUMMONER:'Summoner', HEALER:'Healer', CHARGER:'Charger', MIMIC:'Mimic', LEAPER:'Leaper', REFLECTOR:'Reflector', DISRUPTOR:'Disruptor', WRAITH:'Wraith', NEXUS:'Nexus', SIPHON:'Siphon', GRAVITON:'Graviton', SEEKER:'Seeker', PULSER:'Pulser', ECHOER:'Echoer', 'Echo Shot':'Echo Shot', RESONATOR:'Resonator', 'Resonator Cone':'Resonator Cone', MIRROR:'Mirror', 'Mirror Shot':'Mirror Shot', REAPER:'Reaper', GHOST_PROJECTOR:'Ghost Projector', PROPHET:'Prophet', 'Prophet Shot':'Prophet Shot', CRYOPHAGE:'Cryophage', 'Frost Patch':'Frost Patch', WARDLING:'Wardling', VENGEANCE:'Vengeance', CONDUIT:'Conduit', 'Conduit Beam':'Conduit Beam', HARVESTER:'Harvester', MAGNETON:'Magneton', SPECTRE:'Spectre', SAPPER:'Sapper', MAGPIE:'Magpie', TETHER:'Tether', GULPER:'Gulper', WATCHER:'Watcher', 'Watcher Beam':'Watcher Beam', ARCHITECT:'Architect', NULLIFIER:'Nullifier', SHARD:'Shard', SENTINEL:'Sentinel Mk-I',
  SCORCHER:'Scorcher', BRUTE:'Brute',
  WARDEN:'Warden', HIVE:'Neural Hive', CONDUCTOR:'Conductor', OMEGA:'Omega Core', GENESIS:'Genesis Protocol',
  'Spike Trap':'Spike Trap', 'Plasma':'Plasma', 'Arc Grid':'Arc Grid',
  'Grenade':'Grenade', 'Volatile':'Volatile', 'Void Orb':'Void Orb', 'Warden Slam':'Warden Slam', 'Seeker Blast':'Seeker Blast',
  'Conductor Field':'Conductor Field', 'Conductor Pulse':'Conductor Pulse',
  'Genesis Lance':'Genesis Lance', 'Genesis Field':'Genesis Field', 'Genesis Purge':'Genesis Purge',
  'Nano Swarm':'Nano Swarm', 'Static Field':'Static Field',
  'Volatile Core':'Volatile Core',
  'Sentry Drone':'Sentry Drone',
  'Leaper Shockwave':'Leaper Shockwave',
  'Burn':'Burn', 'Shock':'Shock',
  'Bomb':'Bomb',
  'laser':'Laser Tripwire',
  'Toxic Pool':'Toxic Pool',
  'Wall Turret':'Wall Turret',
  'Reflected':'Reflected',
  'Disruption Field':'Disruption Field',
  'Neural Feedback':'Neural Feedback',
  'Pulser Bolt':'Pulser Bolt',
  'Scorcher Trail':'Scorcher Trail',
};

/** @type {Record<string, any>} */
const SOURCE_COLOURS = {
  GUARD:'#ff3333', TURRET:'#ffb700', CRAWLER:'#39ff14', PHANTOM:'#cc00ff',
  DRONE:'#00aaff', SHIELDER:'#66eeff', GRENADIER:'#ff6622', SPLITTER:'#00ff88',
  TELEPORTER:'#ff44ff', SNIPER:'#ff2266', SUMMONER:'#bb44ff', HEALER:'#44ffaa', CHARGER:'#ff6600', MIMIC:'#cc33ff', LEAPER:'#22ff88', REFLECTOR:'#88ddff', DISRUPTOR:'#ff44aa', WRAITH:'#66ffcc', NEXUS:'#00eedd', SIPHON:'#dd2244', GRAVITON:'#8833ff', SEEKER:'#ffdd00', PULSER:'#44ddff', ECHOER:'#aa66ff', 'Echo Shot':'#aa66ff', RESONATOR:'#ff66cc', 'Resonator Cone':'#ff66cc', MIRROR:'#88ff44', 'Mirror Shot':'#88ff44', REAPER:'#cc1144', GHOST_PROJECTOR:'#cc99ff', PROPHET:'#ffaa22', 'Prophet Shot':'#ffaa22', CRYOPHAGE:'#88ddff', 'Frost Patch':'#88ddff', WARDLING:'#ffcc66', VENGEANCE:'#cc1166', CONDUIT:'#44ffff', 'Conduit Beam':'#44ffff', HARVESTER:'#ff9933', MAGNETON:'#ff44dd', SPECTRE:'#eeccff', SAPPER:'#ddff44', MAGPIE:'#cceeff', TETHER:'#ff8866', GULPER:'#bbdd33', WATCHER:'#ffee66', 'Watcher Beam':'#ffee66', ARCHITECT:'#aa6633', NULLIFIER:'#cc66dd', SHARD:'#00cc66', SENTINEL:'#ff4444',
  SCORCHER:'#ff5522', BRUTE:'#cc3344',
  WARDEN:'#ff8800', HIVE:'#aa00ff', CONDUCTOR:'#00ccff', OMEGA:'#ff00c8', GENESIS:'#ffcc00',
  'Spike Trap':'#ff6644', 'Plasma':'#ff8800', 'Arc Grid':'#44ccff',
  'Grenade':'#ff6622', 'Volatile':'#ff4422', 'Void Orb':'#aa00ff', 'Warden Slam':'#ff8800', 'Seeker Blast':'#ffdd00',
  'Conductor Field':'#00ccff', 'Conductor Pulse':'#00ccff',
  'Genesis Lance':'#ffcc00', 'Genesis Field':'#ffcc00', 'Genesis Purge':'#ffcc00',
  'Nano Swarm':'#44ff88', 'Static Field':'#44ccff',
  'Volatile Core':'#ff6622',
  'Sentry Drone':'#00e5ff',
  'Leaper Shockwave':'#22ff88',
  'Burn':'#ff6600', 'Shock':'#ffee44',
  'Bomb':'#aa00ff',
  'laser':'#ff6644',
  'Toxic Pool':'#33ff00',
  'Wall Turret':'#ff4400',
  'Reflected':'#88ddff',
  'Disruption Field':'#ff44aa',
  'Wraith':'#66ffcc',
  'Neural Feedback':'#00eedd',
  'Pulser Bolt':'#44ddff',
  'Scorcher Trail':'#ff5a22',
};

function sourceLabel(/** @type {any} */ s) { return SOURCE_LABELS[s] || s; }
function sourceColour(/** @type {any} */ s) { return SOURCE_COLOURS[s] || '#aaaacc'; }

/** @type {Record<string, any>} */
const BOSS_NAMES = {SENTINEL:'SENTINEL MK-I',WARDEN:'WARDEN',HIVE:'NEURAL HIVE',CONDUCTOR:'CONDUCTOR',OMEGA:'OMEGA CORE',GENESIS:'GENESIS PROTOCOL'};
// UNCHAINED #40: biome-narrative displayName overrides. BOSS_NAMES keys that
// appear in AREAS[].bossPool get rewritten to AREAS[].displayName so HUD/
// announce text reads as the narrative name (e.g. SENTINEL-PRIME) while the
// combat class id stays the internal 'SENTINEL'.
(function(){
  try {
    if (typeof NEON !== 'undefined' && NEON.biomes && NEON.biomes.AREAS) {
      for (const a of NEON.biomes.AREAS) {
        if (!a || !a.displayName || !Array.isArray(a.bossPool)) continue;
        const overrides = (a.bossDisplayNames && typeof a.bossDisplayNames === 'object') ? a.bossDisplayNames : null;
        for (const b of a.bossPool) {
          BOSS_NAMES[b] = (overrides && overrides[b]) ? overrides[b] : a.displayName;
        }
      }
    }
  } catch(_) { /* biomes optional -- keep built-in defaults */ }
})();

// Phase transition thresholds as hpPct values (descending); absolute-HP bosses computed at draw time
/** @type {Record<string, number[]>} */
const BOSS_PHASE_MARKS = {
  SENTINEL: [0.33],
  WARDEN:   [0.4],
  HIVE:     [0.70, 0.30],
  CONDUCTOR:[0.55, 0.25],
  OMEGA:    [0.7, 0.4, 0.2],
  GENESIS:  [0.7, 0.35],
};

/**
 * @param {any} [boss]
 */
function getBossPhaseMarks(boss) {
  return BOSS_PHASE_MARKS[boss.type] || [];
}
