// @ts-check
'use strict';

// Phase 3D batch 5: Proxy-based alias for the cross-file `game` global.
// entities.js touches many runtime-added game props (player, dungeon,
// _chainBolts, etc.) that don't appear on the typed shape declared in
// src/game.js. The proxy widens access to any and defers resolution.
// Mirrors src/render.js (_RG), src/platform.js (_G), src/content.js (_CG).
/** @type {any} */
const _EG = new Proxy({}, {
  get: (_t, p) => /** @type {any} */ (game)[p],
  set: (_t, p, v) => { /** @type {any} */ (game)[p] = v; return true; },
  has: (_t, p) => p in /** @type {any} */ (game),
});


// ─── Enemies ─────────────────────────────────────────────────────────────────
/** @type {any[]} */ const enemies = [];
/** @type {any[]} */ const items   = [];
/** @type {any[]} */ const hazardZones = [];
/** @type {any[]} */ const fuseShards = [];
/** @type {any[]} */ const vcores  = [];
/** @type {any[]} */ const crates  = [];
/** @type {any[]} */ const beacons = [];
/** @type {any[]} */ const mines   = [];
/** @type {any[]} */ const shieldGens = [];
/** @type {any[]} */ const cameras = [];
/** @type {any[]} */ const lasers  = [];
/** @type {any[]} */ const wallTurrets = [];
/** @type {any[]} */ const disruptionFields = [];
/** @type {any[]} */ const gravityWells = [];
// Frost patches: persistent area-denial tiles laid down by CRYOPHAGE after
// its telegraph commits. Each patch is { x, y, age, maxAge, tickCd, dead }.
// Patches survive the mob that placed them (committed denial) and are
// cleared on floor transition (game.js loadFloor — same place _posHistory
// is reset). Damage uses dash-through canonical immunity.
/** @type {any[]} */ const frostPatches = [];

// Phase 2c — room-scoped enemy index. Support structure for Phase 4 broadphase
// (wall turret acquisition, NEXUS link candidates, room-clear detection, frenzy
// notify). Maintained by registerEnemyInRoom() from spawnEnemy() and
// unregisterEnemyFromRoom() from Enemy.die(). Reset in populateFloor().
const enemiesByRoom = new Map();
/**
 * @param {any} [e]
 */
function registerEnemyInRoom(e) {
  if (!e || !e.room) return;
  let set = enemiesByRoom.get(e.room);
  if (!set) { set = new Set(); enemiesByRoom.set(e.room, set); }
  set.add(e);
}
/**
 * @param {any} [e]
 */
function unregisterEnemyFromRoom(e) {
  if (!e || !e.room) return;
  const set = enemiesByRoom.get(e.room);
  if (set) set.delete(e);
}
function clearEnemiesByRoom() { enemiesByRoom.clear(); }
function getEnemiesInRoom(/** @type {any} */ room) { return enemiesByRoom.get(room) || null; }

// REAPER player-ring telegraph render pass. Drawn from game.js BEFORE the
// player sprite so the ring sits underneath the player. Iterates the global
// `enemies` list — bypasses the per-enemy FOV/cull in Enemy.draw because
// the on-player warning must remain visible even when the reaper itself
// is off-screen (detect range 14 tiles can exceed the vertical half-screen
// at default zoom, so a marked player could otherwise see no warning).
/**
 * @param {any} camX
 * @param {any} camY
 */
function drawReaperPlayerRings(camX, camY) {
  if (!_EG || !_EG.player || _EG.player.dead) return;
  const pl = _EG.player;
  const psx = pl.x * TILE - camX;
  const psy = pl.y * TILE - camY;
  for (const e of enemies) {
    if (e.dead || e.type !== 'REAPER') continue;
    if (e._reState === 'telegraph' && e._reTele > 0) {
      const progress = 1 - Math.max(0, Math.min(1, e._reTele / REAPER_TELEGRAPH));
      const ringPulse = 0.5 + 0.5 * Math.sin(progress * 28);
      ctx.save();
      ctx.globalAlpha = (0.45 + progress * 0.45) * ringPulse;
      ctx.strokeStyle = '#ff2244';
      ctx.shadowBlur = 10 + progress * 14;
      ctx.shadowColor = '#ff2244';
      ctx.lineWidth = 1.8 + progress * 2.2;
      ctx.setLineDash([6, 5]);
      ctx.lineDashOffset = -progress * 24;
      NEON.draw.circleStroke(ctx, psx, psy, TILE * (0.7 + 0.3 * (1 - progress)));
      ctx.setLineDash([]);
      ctx.restore();
    } else if (e._reFrenzied && e._reFrenzy > 0) {
      const remain = Math.max(0, Math.min(1, e._reFrenzy / REAPER_FRENZY_DURATION));
      const fp = 0.5 + 0.5 * Math.sin((e.bobAngle || 0) * 6);
      ctx.save();
      ctx.globalAlpha = 0.18 * remain * (0.6 + 0.4 * fp);
      ctx.strokeStyle = '#cc1144';
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#ff2244';
      ctx.lineWidth = 1.4;
      NEON.draw.circleStroke(ctx, psx, psy, TILE * 0.85);
      ctx.restore();
    }
  }
}
// Phase 4 — convenience iterator. Safe when `room` is null/undefined or empty.
// Callers still must guard for e.dead / e._disguised / e._wrPhased etc.
const _EMPTY_ENEMY_SET = new Set();
/**
 * @param {any} [room]
 */
function enemiesInRoomIter(room) {
  if (!room) return _EMPTY_ENEMY_SET;
  return enemiesByRoom.get(room) || _EMPTY_ENEMY_SET;
}

// GHOST_PROJECTOR kill hook. Called from Enemy.die() AFTER per-room
// bookkeeping but BEFORE drops/credits. Walks live projectors in the
// dead enemy's room; the first eligible projector (no pending memory,
// no active ghost) claims the kill and arms a haunt. Anti-recursion:
// ghosts (_ghIsGhost), shards, summons, bosses, and types not in
// GHOSTABLE_TYPES are silently ignored. Stationary projectors only;
// the projector itself is excluded from the allowlist so we never
// haunt a projector death.
/**
 * @param {any} deadEnemy
 */
function notifyGhostProjectors(deadEnemy) {
  if (!deadEnemy || !deadEnemy.room) return;
  if (deadEnemy._ghIsGhost) return;        // no haunt-of-haunt
  if (deadEnemy.isShard) return;
  if (deadEnemy._summoned) return;
  if (deadEnemy.isBoss) return;
  if (!GHOSTABLE_TYPES.has(deadEnemy.type)) return;
  // Iterate the room's enemy set. enemiesByRoom stores LIVE refs; dead
  // entries are pruned by unregisterEnemyFromRoom in die(). The dead
  // enemy itself was just unregistered above the call site.
  const inRoom = enemiesByRoom.get(deadEnemy.room);
  if (!inRoom) return;
  for (const proj of inRoom) {
    if (!proj || proj.dead) continue;
    if (proj.type !== 'GHOST_PROJECTOR') continue;
    if (proj._gpPendingType) continue;     // already pending
    if (proj._gpAwaitingFlush) continue;   // queued, awaiting flush back-assign
    if (proj._gpActiveGhost && !proj._gpActiveGhost.dead) continue; // ghost still out
    proj._gpPendingType  = deadEnemy.type;
    proj._gpPendingX     = deadEnemy.x;
    proj._gpPendingY     = deadEnemy.y;
    proj._gpPendingDelay = GHOST_PROJECTOR_DELAY;
    if (audio && audio.ghostProjectorMemory) audio.ghostProjectorMemory();
    return;                                 // first claim wins
  }
}

/** @type {Record<string, any>} */
const CREDIT_VALUES = {GUARD:8, TURRET:6, CRAWLER:4, PHANTOM:12, DRONE:5, SHIELDER:10, GRENADIER:7, SPLITTER:9, TELEPORTER:8, SNIPER:10, SUMMONER:12, HEALER:8, CHARGER:9, SCORCHER:8, BRUTE:12, MIMIC:10, LEAPER:8, REFLECTOR:12, DISRUPTOR:10, WRAITH:12, NEXUS:12, SIPHON:10, GRAVITON:12, SEEKER:5, PULSER:7, ECHOER:9, RESONATOR:10, MIRROR:10, REAPER:10, GHOST_PROJECTOR:9, PROPHET:10, CRYOPHAGE:10, SHARD:0, SENTINEL:80, WARDEN:80, HIVE:120, CONDUCTOR:120, OMEGA:200, GENESIS:200};

// ECHOER tuning constants — exported on globalThis for cross-file test reads
// but kept as module-local for hot-path lookup. Tweak with caution: these
// directly drive perceived fairness of the predictive shot.
const ECHOER_LOOKBACK   = 1.0;  // seconds back to sample the player's position
const ECHOER_TELEGRAPH  = 0.8;  // ghost+lane visible duration before fire
const ECHOER_COOLDOWN   = 2.5;  // seconds between aim attempts (post-fire)
const ECHOER_RANGE      = 14;   // tiles — max lock distance (echoer→past-pos)
const ECHOER_PROJ_SPD   = 9;    // tiles/sec — slow & dodgeable

// PROPHET tuning constants — the inverse of ECHOER. PROPHET extrapolates the
// player's velocity forward by PROPHET_LOOKAHEAD seconds and locks onto the
// PREDICTED future position. Counter-play: stop, turn, or reverse direction
// during the telegraph window — linear extrapolation misses any non-linear
// motion. PROPHET will not lock if the player's velocity is below
// PROPHET_MIN_VEL (a stationary player has nothing to predict from), giving
// the niche a clean "stillness is safety" identity opposite to ECHOER's
// "motion is safety". Tweak with care.
const PROPHET_LOOKAHEAD  = 0.6;  // seconds ahead to extrapolate the player's position
const PROPHET_VEL_SAMPLE = 0.2;  // seconds back to sample for velocity estimate
const PROPHET_TELEGRAPH  = 0.7;  // ghost+lane visible duration before fire
const PROPHET_COOLDOWN   = 2.8;  // seconds between aim attempts (post-fire)
const PROPHET_RANGE      = 13;   // tiles — max lock distance (prophet→predicted)
const PROPHET_PROJ_SPD   = 11;   // tiles/sec — fast (must arrive at the future point on time)
const PROPHET_MIN_VEL    = 1.5;  // tiles/sec — minimum player velocity required to lock
const PROPHET_VEL_CAP    = 10;   // tiles/sec — clamp velocity to avoid dash/teleport blowup

// CRYOPHAGE tuning constants — area-denial frost-patch layer (floor 6+).
// Cycle: idle (cooldown) → aiming (telegraph 5-tile + pattern centred on the
// player's CURRENT tile) → patches commit at telegraph end and persist for
// PATCH_LIFE seconds, dealing damage on entry with per-patch ICD.
//
// Niche: punishes camping a position. Distinct from PROPHET (predicted point)
// and ECHOER (historical position) — CRYOPHAGE freezes wherever you ARE the
// moment it locks. Counter-play is to leave your tile during the telegraph
// (1.0s window) and not return through the patches. If trapped, dash through
// (canonical i-frame pass via isPlayerDamageImmune).
const CRYOPHAGE_TELEGRAPH    = 1.0;   // seconds the cyan + glyph is visible before patches commit
const CRYOPHAGE_COOLDOWN     = 3.5;   // seconds between aim attempts (post-commit)
const CRYOPHAGE_RANGE        = 8;     // tiles — max LoS distance to attempt a lock
const CRYOPHAGE_PATCH_LIFE   = 2.5;   // seconds each frost patch lingers after commit
const CRYOPHAGE_PATCH_RADIUS = 0.6;   // tiles — damage radius from each patch centre
const CRYOPHAGE_TICK_ICD     = 0.5;   // seconds between damage ticks per patch
const CRYOPHAGE_DMG_MUL      = 0.45;  // damage = round(atk * 0.45) per tick

// RESONATOR tuning constants — exported on globalThis for cross-file test reads.
// Stationary mob: silent charge → telegraphed cone → instant fire → recovery.
// Counter-play is dash-through (existing dash i-frames in isPlayerDamageImmune)
// or stepping out of the wedge during the TELEGRAPH window. Tweak the
// telegraph in particular with care — it's the entire fairness budget.
const RESONATOR_CHARGE     = 2.2;            // silent windup before telegraph
const RESONATOR_TELEGRAPH  = 0.8;            // wedge visible — fairness window
const RESONATOR_RECOVERY   = 1.0;            // post-fire cooldown
const RESONATOR_RANGE      = 6;              // tiles — cone depth
const RESONATOR_CONE_DEG   = 60;             // full cone angular width (degrees)
const RESONATOR_DMG_MUL    = 0.8;            // damage = atk * 0.8
const RESONATOR_HALF_RAD   = (RESONATOR_CONE_DEG * 0.5) * Math.PI / 180; // precomputed

// MIRROR tuning constants — exported on globalThis for cross-file test reads.
// Stationary mob whose hook is mimicry: it fires a single projectile at the
// player using the kinematics (speed, colour, range) of the player's *last*
// fired ranged shot. Damage is mob-scaled (this.atk * MIRROR_DMG_MUL) — the
// player's actual damage roll is NEVER replayed, since late-game crits/perks
// would yield 200+ dmg returns. Replayed projectile is intentionally vanilla:
// no piercing, no ricochet, no homing — those player perks must not leak
// into enemy projectiles. Counter-play: dash i-frames pass through (canonical
// for telegraphed mobs) and the mob is vulnerable during the visible aim line.
const MIRROR_CHARGE        = 2.5;            // silent windup before telegraph
const MIRROR_TELEGRAPH     = 1.0;            // aim line visible — fairness window
const MIRROR_RECOVERY      = 1.5;            // post-fire cooldown
const MIRROR_RANGE         = 12;             // tiles — max engage / aim distance
const MIRROR_DMG_MUL       = 1.0;            // damage = atk * mul (mob-scaled, NOT player-scaled)
const MIRROR_PROJ_SPD_DEF  = 9;              // tile/sec fallback if shotHistory empty
const MIRROR_PROJ_SPD_MIN  = 4;              // clamp player kinematics into a fair band
const MIRROR_PROJ_SPD_MAX  = 14;
const MIRROR_PROJ_RANGE    = 16;             // tiles — projectile lifetime range
const SHOT_HISTORY_LEN     = 4;              // ring cap on player._shotHistory

// REAPER tuning constants — exported on globalThis for cross-file test reads.
// REAPER is a melee chaser whose threat scales with PLAYER aggression rather
// than floor number. Hits player.killsInCurrentRoom >= REAPER_FRENZY_THRESHOLD
// → enters a visible 1.0s telegraph (red ring drawn ON THE PLAYER) → then a
// 4.0s frenzy at +60% spd with stun-immunity. Triggers at most once per room
// visit (per-instance _reHasFrenzied flag, cleared on player room change).
// Telegraph and frenzy timers PAUSE while the player is outside this REAPER's
// room — fairness rule, otherwise the punish ticks down off-screen and the
// player escapes for free. Stun received during telegraph cancels it (matches
// other telegraph mobs at the stun branch in update()) but _reHasFrenzied
// stays true — EMP is a one-shot defuse, not a re-trigger reset.
const REAPER_FRENZY_THRESHOLD = 5;            // kills in current room to arm
const REAPER_TELEGRAPH        = 1.0;          // seconds — red ring on player
const REAPER_FRENZY_DURATION  = 4.0;          // seconds — +60% spd window
const REAPER_FRENZY_SPD_MUL   = 1.6;          // chase speed multiplier in frenzy
const REAPER_DETECT_RANGE     = 14;           // tiles — chase pickup range

// GHOST_PROJECTOR tuning constants. Stationary "lens" mob (floor 8+) that
// memorises the type+position of the most recent ghostable enemy killed in
// its room and, after a delay, spawns a translucent ghost replay at that
// site with reduced HP/atk and a fixed lifetime. The ghost has the same AI
// as the original type, awards no XP/credits/cores/drops/combo (treated as
// a summon for reward purposes), and is excluded from elite affix rolls.
//
// Per-projector single-projection: while a pending memory is in countdown
// OR an active ghost is alive, the projector ignores further kills. Once
// the active ghost dies/expires, the projector becomes free again.
//
// Anti-recursion: the kill hook skips ghosts (no haunting from haunting),
// shards, summons, and bosses. GHOSTABLE_TYPES is a tight allowlist of
// "simple" mobs whose AI replays cleanly without spawn-init quirks
// (TUNNELLER underground state, MIMIC disguise, SUMMONER cascade etc).
//
// Stun cancels any pending haunt (the projector forgets its memory) — a
// fair defuse path that mirrors REAPER/RESONATOR/MIRROR stun semantics.
const GHOST_PROJECTOR_DELAY     = 3.0;         // seconds — memory → ghost spawn
const GHOST_PROJECTOR_GHOST_LIFE= 6.0;         // seconds — ghost lifetime
const GHOST_PROJECTOR_HP_MUL    = 0.5;         // ghost HP fraction
const GHOST_PROJECTOR_ATK_MUL   = 0.5;         // ghost damage fraction
const GHOSTABLE_TYPES = new Set([
  'GUARD', 'CRAWLER', 'DRONE', 'BRUTE', 'PHANTOM',
  'CHARGER', 'LEAPER', 'SCORCHER', 'SEEKER', 'REAPER'
]);

/**
 * Pure helper: is point (px,py) inside a cone with apex (ox,oy), aim
 * direction (aimDx,aimDy) (assumed unit vector), depth `range` and
 * half-angle `halfAngleRad` (radians). Apex itself counts as inside.
 *
 * Used by the RESONATOR fire step and tested directly. Keeping this
 * pure (no LoS, no immunity) means the geometry is independently
 * verifiable; LoS / immunity gates are layered on at the call site.
 *
 * @param {number} px
 * @param {number} py
 * @param {number} ox
 * @param {number} oy
 * @param {number} aimDx
 * @param {number} aimDy
 * @param {number} range
 * @param {number} halfAngleRad
 * @returns {boolean}
 */
function isInsideCone(px, py, ox, oy, aimDx, aimDy, range, halfAngleRad) {
  const vx = px - ox, vy = py - oy;
  const d2 = vx*vx + vy*vy;
  if (d2 === 0) return true;          // point is at the apex
  if (d2 > range * range) return false;
  const len = Math.sqrt(d2);
  // Dot of unit aim with unit (px-ox, py-oy) = cos(angle between them).
  const cosA = (vx * aimDx + vy * aimDy) / len;
  return cosA >= Math.cos(halfAngleRad);
}

/**
 * Pure helper: returns the entry from a {t,x,y} position history that is
 * AT LEAST `seconds` old, preferring the freshest such entry (i.e. the
 * sample closest to the lookback target without going under it). Returns
 * null if no entry is old enough yet (player hasn't been alive long
 * enough or history was just cleared on floor transition).
 *
 * Extracted from Player.getPositionAgo so it's testable without
 * instantiating the browser-bound Player class. The history array is
 * ordered oldest-first (entries[0].t is the largest age).
 *
 * @param {Array<{t:number,x:number,y:number}> | null | undefined} history
 * @param {number} seconds
 * @returns {{x:number, y:number} | null}
 */
function getPositionAgoFromHistory(history, seconds) {
  if (!history || history.length === 0) return null;
  // Walk newest→oldest; first entry with age >= seconds is the freshest
  // sample that still satisfies the lookback. This biases toward "just
  // old enough" rather than "very old", giving more recent causality.
  for (let i = history.length - 1; i >= 0; i--) {
    const e = history[i];
    if (e && e.t >= seconds) {
      return { x: e.x, y: e.y };
    }
  }
  return null; // history doesn't go back that far yet
}

/**
 * Pure helper: predict the player's position `lookahead` seconds in the
 * future by linear extrapolation from velocity. Velocity is estimated by
 * (current position − sample `sampleSec` seconds ago) / sampleSec, then
 * clamped to `velCap` tiles/sec to neutralise dash/teleport blowups
 * (a 0.2s dash that covers 4 tiles would otherwise project 12 tiles
 * downrange and fire into a wall).
 *
 * Returns null if history doesn't reach back `sampleSec` (e.g. just
 * spawned, just changed floors) — caller is expected to fall through
 * to a no-lock branch in that case.
 *
 * Used by PROPHET (the inverse of ECHOER): rewards stillness, punishes
 * straight-line motion. Extracted so it's testable without instantiating
 * browser-bound classes.
 *
 * @param {Array<{t:number,x:number,y:number}> | null | undefined} history
 * @param {number} curX
 * @param {number} curY
 * @param {number} lookahead seconds in the future to project
 * @param {number} sampleSec seconds back to sample for velocity
 * @param {number} velCap maximum |v| in tiles/sec (clamps dashes/teleports)
 * @returns {{x:number, y:number, vx:number, vy:number, vmag:number} | null}
 */
function predictFromHistory(history, curX, curY, lookahead, sampleSec, velCap) {
  if (!history || history.length === 0) return null;
  // Walk newest→oldest; pick the freshest entry whose age >= sampleSec.
  // Mirrors getPositionAgoFromHistory's selection rule, but we keep the
  // entry's actual age so we can divide by it (not by the requested
  // `sampleSec`). Using the requested seconds as the denominator inflates
  // velocity whenever the chosen sample is older than requested — common
  // under frame-time jitter / low FPS — and over-leads the shot.
  // (Bug caught by gpt-5.3-codex review of PR #137.)
  let past = null;
  for (let i = history.length - 1; i >= 0; i--) {
    const e = history[i];
    if (e && e.t >= sampleSec) { past = e; break; }
  }
  if (!past) return null;
  const dtAge = past.t > 1e-6 ? past.t : sampleSec; // epsilon guard
  const rawVx = (curX - past.x) / dtAge;
  const rawVy = (curY - past.y) / dtAge;
  const rawMag = Math.hypot(rawVx, rawVy);
  let vx = rawVx, vy = rawVy, vmag = rawMag;
  if (rawMag > velCap && rawMag > 0) {
    const k = velCap / rawMag;
    vx = rawVx * k; vy = rawVy * k; vmag = velCap;
  }
  return { x: curX + vx * lookahead, y: curY + vy * lookahead, vx, vy, vmag };
}

/**
 * Pure helper: pick safe projectile kinematics for a MIRROR shot from the
 * player's _shotHistory ring. Returns the most recent entry's speed and
 * colour, clamped into the fair band (MIRROR_PROJ_SPD_MIN..MAX) so a
 * future bullet-time perk can't yield invisible-fast return shots, and
 * defaulted when the player hasn't fired yet (or has only used melee).
 *
 * Damage is intentionally NOT pulled from history — it's mob-scaled at
 * fire time so the player's late-game crit/perk damage never returns.
 *
 * Extracted so it's testable without instantiating browser-bound classes.
 *
 * @param {Array<{spd?:number,colour?:string}> | null | undefined} shotHistory
 * @returns {{spd:number, colour:string}}
 */
function pickMirrorKinematics(shotHistory) {
  const def = { spd: MIRROR_PROJ_SPD_DEF, colour: '#88ff44' };
  if (!shotHistory || shotHistory.length === 0) return def;
  const last = shotHistory[shotHistory.length - 1];
  if (!last) return def;
  const rawSpd = (typeof last.spd === 'number' && isFinite(last.spd)) ? last.spd : MIRROR_PROJ_SPD_DEF;
  const spd = Math.max(MIRROR_PROJ_SPD_MIN, Math.min(MIRROR_PROJ_SPD_MAX, rawSpd));
  const colour = (typeof last.colour === 'string' && last.colour) ? last.colour : '#88ff44';
  return { spd, colour };
}
/** @type {Record<string, any>} */
const SOURCE_LABELS = {
  GUARD:'Guard', TURRET:'Turret', CRAWLER:'Crawler', PHANTOM:'Phantom',
  DRONE:'Drone', SHIELDER:'Shielder', GRENADIER:'Grenadier', SPLITTER:'Splitter',
  TELEPORTER:'Teleporter', SNIPER:'Sniper', SUMMONER:'Summoner', HEALER:'Healer', CHARGER:'Charger', MIMIC:'Mimic', LEAPER:'Leaper', REFLECTOR:'Reflector', DISRUPTOR:'Disruptor', WRAITH:'Wraith', NEXUS:'Nexus', SIPHON:'Siphon', GRAVITON:'Graviton', SEEKER:'Seeker', PULSER:'Pulser', ECHOER:'Echoer', 'Echo Shot':'Echo Shot', RESONATOR:'Resonator', 'Resonator Cone':'Resonator Cone', MIRROR:'Mirror', 'Mirror Shot':'Mirror Shot', REAPER:'Reaper', GHOST_PROJECTOR:'Ghost Projector', PROPHET:'Prophet', 'Prophet Shot':'Prophet Shot', CRYOPHAGE:'Cryophage', 'Frost Patch':'Frost Patch', SHARD:'Shard', SENTINEL:'Sentinel Mk-I',
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
  TELEPORTER:'#ff44ff', SNIPER:'#ff2266', SUMMONER:'#bb44ff', HEALER:'#44ffaa', CHARGER:'#ff6600', MIMIC:'#cc33ff', LEAPER:'#22ff88', REFLECTOR:'#88ddff', DISRUPTOR:'#ff44aa', WRAITH:'#66ffcc', NEXUS:'#00eedd', SIPHON:'#dd2244', GRAVITON:'#8833ff', SEEKER:'#ffdd00', PULSER:'#44ddff', ECHOER:'#aa66ff', 'Echo Shot':'#aa66ff', RESONATOR:'#ff66cc', 'Resonator Cone':'#ff66cc', MIRROR:'#88ff44', 'Mirror Shot':'#88ff44', REAPER:'#cc1144', GHOST_PROJECTOR:'#cc99ff', PROPHET:'#ffaa22', 'Prophet Shot':'#ffaa22', CRYOPHAGE:'#88ddff', 'Frost Patch':'#88ddff', SHARD:'#00cc66', SENTINEL:'#ff4444',
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
  } catch(_) { /* biomes optional — keep built-in defaults */ }
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
/** @type {any[]} */
const pendingEnemySpawns = [];

// ─── Weapon Affix Effect Application ─────────────────────────────────────────
// Called on every weapon hit (projectile or melee). hitCtx = {name, affixes, effects, isProc}
/**
 * @param {any} [enemy]
 * @param {any} [actualDmg]
 * @param {any} [hitCtx]
 */
function applyHitEffects(enemy, actualDmg, hitCtx) {
  const effects = hitCtx.effects || [];
  if (!effects.length) return;
  for (const eff of effects) {
    if (eff === 'burn') {
      enemy.burnTimer = 3; enemy.burnDps = 3;
      spawnParticles(enemy.x, enemy.y, 'MUZZLE', '#ff6600', 3);
    } else if (eff === 'slow') {
      enemy.slowTimer = 2; enemy.slowFactor = 0.7;
      spawnParticles(enemy.x, enemy.y, 'MUZZLE', '#66ccff', 3);
    } else if (eff === 'leech') {
      const heal = Math.max(1, Math.round(actualDmg * 0.08));
      if (_EG.player) {
        _EG.player.hp = Math.min(_EG.player.maxHp, _EG.player.hp + heal);
        spawnDmgText(_EG.player.x, _EG.player.y, '+' + heal, '#ff0066');
      }
    } else if (eff === 'chain') {
      if (Math.random() < 0.20) {
        // Find nearest alive enemy within 3 tiles
        let best = null, bestD = 3;
        for (const e of enemies) {
          if (e === enemy || e.dead) continue;
          if (e._wrPhased) continue;
          const d = dist(enemy.x, enemy.y, e.x, e.y);
          if (d < bestD) { bestD = d; best = e; }
        }
        if (best) {
          const chainDmg = Math.round(actualDmg * 0.5);
          best.takeDamage(chainDmg, { name: hitCtx.name, isProc: true });
          // Visual: lightning bolt stored for rendering
          if (!_EG._chainBolts) _EG._chainBolts = [];
          _EG._chainBolts.push({ x1:enemy.x, y1:enemy.y, x2:best.x, y2:best.y, timer:0.15, colour:'#ffff44' });
          audio.hit(false, 'Railgun'); // zap sound
        }
      }
    }
    else if (eff === 'shock') {
      // Voltaic: brief stun with per-enemy ICD to prevent perma-stun
      const icd = enemy._shockICD || 0;
      if (icd <= 0) {
        const dur = enemy.isBoss ? 0.3 : 0.6;
        enemy.stunTimer = Math.max(enemy.stunTimer || 0, dur);
        enemy._shockICD = 2.0; // can't re-shock same enemy for 2s
        spawnParticles(enemy.x, enemy.y, 'SPARK', '#ffee44', 6);
        audio.voltaicHit();
      }
    }
    // 'explode' is handled in applyOnKill
  }
}

// Called when an enemy dies — checks for on-kill affix effects
/**
 * @param {any} [enemy]
 */
function applyOnKill(enemy) {
  const ctx = enemy._lastHitCtx;
  if (!ctx || ctx.isProc) return;
  const effects = ctx.effects || [];
  if (!effects.includes('explode')) return;
  // AoE explosion (similar to VOLATILE but from weapon affix)
  const aoeR = 2, aoeDmg = 25;
  spawnParticles(enemy.x, enemy.y, 'EXPLOSION', '#ff4400', 18);
  triggerShake(5, 0.18);
  for (const e of enemies) {
    if (e === enemy || e.dead) continue;
    if (dist(e.x, e.y, enemy.x, enemy.y) < aoeR && hasLOS(enemy.x, enemy.y, e.x, e.y, _EG.dungeon.map)) {
      e.takeDamage(aoeDmg, { name: 'Detonation', isProc: true });
    }
  }
  // Also damage player if in range
  const p = _EG.player;
  if (p && dist(p.x, p.y, enemy.x, enemy.y) < aoeR && hasLOS(enemy.x, enemy.y, p.x, p.y, _EG.dungeon.map)) {
    p.takeDamage(Math.round(aoeDmg * 0.5), 'Detonation');
  }
  // Destroy nearby crates
  damageCratesInRadius(enemy.x, enemy.y, aoeR, aoeDmg, _EG.dungeon.map);
  // Damage nearby beacons
  damageBeaconsInRadius(enemy.x, enemy.y, aoeR, aoeDmg, _EG.dungeon.map);
  // Damage nearby shield generators
  damageShieldGensInRadius(enemy.x, enemy.y, aoeR, aoeDmg, _EG.dungeon.map);
  // Damage nearby cameras
  damageCamerasInRadius(enemy.x, enemy.y, aoeR, aoeDmg, _EG.dungeon.map);
  // Damage nearby laser tripwire emitters
  damageLasersInRadius(enemy.x, enemy.y, aoeR, aoeDmg, _EG.dungeon.map);
  // Damage nearby wall turrets
  damageWallTurretsInRadius(enemy.x, enemy.y, aoeR, aoeDmg, _EG.dungeon.map);
  // Trigger nearby mines
  triggerMinesInRadius(enemy.x, enemy.y, aoeR, _EG.dungeon.map);
}

// Tick enemy status effects (called in update loop per enemy)
/**
 * @param {any} [enemy]
 * @param {any} [dt]
 */
function tickEnemyStatusEffects(enemy, dt) {
  // Burn
  if (enemy.burnTimer > 0) {
    enemy.burnTimer -= dt;
    // PHASING: burn timer ticks but deals no damage during immune window
    if (!enemy.phaseImmune && !enemy._wrPhased) {
      let dmg = enemy.burnDps * dt;
      // SHIELDED: burn resets regen delay and damages shield first.
      // Gated on the SHIELDED affix specifically — SHIELDER's directional
      // shield (which also uses shieldHp) must NOT be drained from
      // omnidirectional DoT (would bypass the front-arc-only design AND
      // would leave shieldBrokenTimer unset → permanent shield-down bug).
      if (enemy.eliteAffix === 'SHIELDED') {
        enemy.shieldRegenDelay = 0;
        if (enemy.shieldHp > 0) {
          const absorbed = Math.min(enemy.shieldHp, dmg);
          enemy.shieldHp -= absorbed;
          dmg -= absorbed;
        }
      }
      if (dmg > 0) enemy.hp -= dmg;
      if (Math.random() < dt * 4) spawnParticles(enemy.x, enemy.y, 'MUZZLE', '#ff6600', 1);
      if (enemy.hp <= 0 && !enemy.dead) {
        enemy.hp = 0;
        if (!enemy._lastHitCtx) enemy._lastHitCtx = { name:'Burn', isProc:true };
        else enemy._lastHitCtx.isProc = false;
        enemy.die();
      }
    }
    if (enemy.burnTimer <= 0) { enemy.burnTimer = 0; enemy.burnDps = 0; }
  }
  // Slow decay
  if (enemy.slowTimer > 0) {
    enemy.slowTimer -= dt;
    if (enemy.slowTimer <= 0) { enemy.slowTimer = 0; enemy.slowFactor = 1; }
  }
  // Voltaic shock ICD decay
  if (enemy._shockICD > 0) enemy._shockICD -= dt;
}

// Tick elite affix behaviours (called per enemy per frame)
/**
 * @param {any} [enemy]
 * @param {any} [dt]
 */
function tickEliteAffix(enemy, dt) {
  if (!enemy.elite || !enemy.eliteAffix) return;
  const aff = enemy.eliteAffix;
  // SHIELDED: regenerate shield after 2s of not being hit
  if (aff === 'SHIELDED' && enemy.shieldHp < enemy.shieldMax) {
    enemy.shieldRegenDelay += dt;
    if (enemy.shieldRegenDelay >= 2) {
      enemy.shieldHp = Math.min(enemy.shieldMax, enemy.shieldHp + 8 * dt);
      if (Math.random() < dt * 3) spawnParticles(enemy.x, enemy.y, 'MUZZLE', '#4488ff', 1);
    }
  }
  // BERSERKER: speed/attack multiplier scales with missing HP (up to +50%)
  // (Applied dynamically in moveToward and meleeAttack via berserkerMul())
  // REGENERATING: heal 2.5% maxHp per second
  if (aff === 'REGENERATING' && enemy.hp < enemy.maxHp) {
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * 0.025 * dt);
    if (Math.random() < dt * 2) spawnParticles(enemy.x, enemy.y, 'MUZZLE', '#22ff44', 1);
  }
  // PHASING: cycle 0→4s, immune during 3→4
  if (aff === 'PHASING') {
    enemy.phaseTimer += dt;
    if (enemy.phaseTimer >= 4) enemy.phaseTimer -= 4;
    const wasImmune = enemy.phaseImmune;
    enemy.phaseImmune = enemy.phaseTimer >= 3;
    if (enemy.phaseImmune && !wasImmune) audio.phaseShift();
  }
  // VOLATILE: pulsing orange particles (visual warning)
  if (aff === 'VOLATILE' && Math.random() < dt * 1.5) {
    spawnParticles(enemy.x, enemy.y, 'MUZZLE', '#ff6600', 1);
  }
  // FRENZY: speed/attack boost from stacks (applied dynamically via frenzyMul())
  // Stacks granted by notifyFrenzyElites() on nearby ally death
}

// Notify FRENZY-affix elites within 4 tiles of a death — grant a frenzy stack
/**
 * @param {any} [deathX]
 * @param {any} [deathY]
 */
function notifyFrenzyElites(deathX, deathY) {
  for (const e of enemies) {
    if (e.dead || e.eliteAffix !== 'FRENZY') continue;
    if (e.frenzyStacks >= 2) continue; // max 2 stacks
    if (dist(e.x, e.y, deathX, deathY) <= 4) {
      e.frenzyStacks++;
      spawnParticles(e.x, e.y, 'EXPLOSION', '#ff4466', 8);
      audio.eliteFrenzy();
      _EG.msg('⚡ FRENZY!', '#ff4466');
    }
  }
}


class Enemy {
  /** @type {any} */ _arcSpin;
  /** @type {any} */ _burstLeft;
  /** @type {any} */ _challengeWave;
  /** @type {any} */ _chargeDur;
  /** @type {any} */ _chargeDx;
  /** @type {any} */ _chargeDy;
  /** @type {any} */ _chargeState;
  /** @type {any} */ _chargeWindup;
  /** @type {any} */ _chgCooldown;
  /** @type {any} */ _chgDur;
  /** @type {any} */ _chgDx;
  /** @type {any} */ _chgDy;
  /** @type {any} */ _chgState;
  /** @type {any} */ _chgWindup;
  /** @type {any} */ _dDeployTimer;
  /** @type {any} */ _dFields;
  /** @type {any} */ _dFireTimer;
  /** @type {any} */ _despawning;
  /** @type {any} */ _dischargeChannel;
  /** @type {any} */ _disguised;
  /** @type {any} */ _endgameOffered;
  /** @type {any} */ _gvDeployTimer;
  /** @type {any} */ _gvFireTimer;
  /** @type {any} */ _gvWells;
  /** @type {any} */ _healBeam;
  /** @type {any} */ _healTimer;
  /** @type {any} */ _isBounty;
  /** @type {any} */ _lanceLock;
  /** @type {any} */ _lanceTelegraph;
  /** @type {any} */ _laserTarget;
  /** @type {any} */ _laserTimer;
  /** @type {any} */ _lastHitCtx;
  /** @type {any} */ _lpAirTime;
  /** @type {any} */ _lpCooldown;
  /** @type {any} */ _lpFromX;
  /** @type {any} */ _lpFromY;
  /** @type {any} */ _lpHeight;
  /** @type {any} */ _lpRecovery;
  /** @type {any} */ _lpState;
  /** @type {any} */ _lpTargetX;
  /** @type {any} */ _lpTargetY;
  /** @type {any} */ _lpWindup;
  /** @type {any} */ _materialize;
  /** @type {any} */ _mimicBob;
  /** @type {any} */ _mimicBurstTimer;
  /** @type {any} */ _mimicColour;
  /** @type {any} */ _mimicLungeDx;
  /** @type {any} */ _mimicLungeDy;
  /** @type {any} */ _nxBoosted;
  /** @type {any} */ _nxFireTimer;
  /** @type {any} */ _nxLinkTimer;
  /** @type {any} */ _nxLinks;
  /** @type {any} */ _phAimDx;
  /** @type {any} */ _phAimDy;
  /** @type {any} */ _phBurstDelay;
  /** @type {any} */ _phBurstLeft;
  /** @type {any} */ _phState;
  /** @type {any} */ _phTimer;
  /** @type {any} */ _plAimDx;
  /** @type {any} */ _plAimDy;
  /** @type {any} */ _plCooldown;
  /** @type {any} */ _plState;
  /** @type {any} */ _plTimer;
  /** @type {any} */ _repositionTarget;
  /** @type {any} */ _repositionTimer;
  /** @type {any} */ _revealTimer;
  /** @type {any} */ _rfAngle;
  /** @type {any} */ _scStrafeSeed;
  /** @type {any} */ _scTrailTimer;
  /** @type {any} */ _shockICD;
  /** @type {any} */ _skProximity;
  /** @type {any} */ _sniperCooldown;
  /** @type {any} */ _spDrainBeam;
  /** @type {any} */ _spFireTimer;
  /** @type {any} */ _spFrenzy;
  /** @type {any} */ _spiralSpin;
  /** @type {any} */ _summonTimer;
  /** @type {any} */ _summoned;
  /** @type {any} */ _summons;
  /** @type {any} */ _tauntTarget;
  /** @type {any} */ _ecState;
  /** @type {any} */ _ecAimTimer;
  /** @type {any} */ _ecCooldown;
  /** @type {any} */ _ecLockX;
  /** @type {any} */ _ecLockY;
  /** @type {any} */ _prState;
  /** @type {any} */ _prAimTimer;
  /** @type {any} */ _prCooldown;
  /** @type {any} */ _prLockX;
  /** @type {any} */ _prLockY;
  /** @type {any} */ _cyState;
  /** @type {any} */ _cyAimTimer;
  /** @type {any} */ _cyCooldown;
  /** @type {any} */ _cyLockX;
  /** @type {any} */ _cyLockY;
  /** @type {any} */ _cyTiles;
  /** @type {any} */ _rsState;
  /** @type {any} */ _rsCharge;
  /** @type {any} */ _rsTele;
  /** @type {any} */ _rsRec;
  /** @type {any} */ _rsAimDx;
  /** @type {any} */ _rsAimDy;
  /** @type {any} */ _miState;
  /** @type {any} */ _miCharge;
  /** @type {any} */ _miTele;
  /** @type {any} */ _miRec;
  /** @type {any} */ _miAimDx;
  /** @type {any} */ _miAimDy;
  /** @type {any} */ _miShotSpd;
  /** @type {any} */ _miShotColour;
  /** @type {any} */ _reState;
  /** @type {any} */ _reTele;
  /** @type {any} */ _reFrenzy;
  /** @type {any} */ _reFrenzied;
  /** @type {any} */ _reHasFrenzied;
  /** @type {any} */ _gpPendingType;
  /** @type {any} */ _gpPendingX;
  /** @type {any} */ _gpPendingY;
  /** @type {any} */ _gpPendingDelay;
  /** @type {any} */ _gpActiveGhost;
  /** @type {any} */ _gpAwaitingFlush;
  /** @type {any} */ _ghIsGhost;
  /** @type {any} */ _ghLife;
  /** @type {any} */ _tnState;
  /** @type {any} */ _tnTimer;
  /** @type {any} */ _tnTargetX;
  /** @type {any} */ _tnTargetY;
  /** @type {any} */ _tx;
  /** @type {any} */ _ty;
  /** @type {any} */ _unchainedPhase;
  /** @type {any} */ _volatileKill;
  /** @type {any} */ _warpFade;
  /** @type {any} */ _warpFromX;
  /** @type {any} */ _warpFromY;
  /** @type {any} */ _wrFireTimer;
  /** @type {any} */ _wrHitICD;
  /** @type {any} */ _wrPhased;
  /** @type {any} */ _wrState;
  /** @type {any} */ _wrTimer;
  /** @type {any} */ atk;
  /** @type {any} */ attackTimer;
  /** @type {any} */ bobAngle;
  /** @type {any} */ bossTimers;
  /** @type {any} */ burnDps;
  /** @type {any} */ burnTimer;
  /** @type {any} */ colour;
  /** @type {any} */ dead;
  /** @type {any} */ elite;
  /** @type {any} */ eliteAffix;
  /** @type {any} */ flashTimer;
  /** @type {any} */ frenzyStacks;
  /** @type {any} */ g;
  /** @type {any} */ grenadeTimer;
  /** @type {any} */ hp;
  /** @type {any} */ isBoss;
  /** @type {any} */ isShard;
  /** @type {any} */ maxHp;
  /** @type {any} */ patrolTarget;
  /** @type {any} */ phase;
  /** @type {any} */ phaseImmune;
  /** @type {any} */ phaseTimer;
  /** @type {any} */ prevPhase;
  /** @type {any} */ room;
  /** @type {any} */ shieldAngle;
  /** @type {any} */ shieldBurstTimer;
  /** @type {any} */ shieldHp;
  /** @type {any} */ shieldMax;
  /** @type {any} */ shieldRegenDelay;
  /** @type {any} */ shieldBrokenTimer;
  /** @type {any} */ shootTimer;
  /** @type {any} */ slowFactor;
  /** @type {any} */ slowTimer;
  /** @type {any} */ spawnCooldown;
  /** @type {any} */ spd;
  /** @type {any} */ state;
  /** @type {any} */ stunTimer;
  /** @type {any} */ teleportTimer;
  /** @type {any} */ type;
  /** @type {any} */ visible;
  /** @type {any} */ voidOrbs;
  /** @type {any} */ x;
  /** @type {any} */ xpValue;
  /** @type {any} */ y;
  /** @type {any} */ zigzag;
  /** @type {any} */ _bountyRevealed;
  /** @type {any} */ _summonerRef;
  /** @type {any} */ _toxicDmgCD;
  /** @type {any} */ origTile;
  /**
   * @param {any} [x]
   * @param {any} [y]
   * @param {any} [hp]
   * @param {any} [atk]
   * @param {any} [spd]
   * @param {any} [xpVal]
   * @param {any} [colour]
   * @param {any} [type]
   */
  constructor(x,y,hp,atk,spd,xpVal,colour,type) {
    this.x=x; this.y=y;
    this.hp=hp; this.maxHp=hp;
    this.atk=atk; this.spd=spd;
    this.xpValue=xpVal; this.colour=colour; this.type=type;
    this.dead=false;
    this.state='PATROL';
    this.patrolTarget=null;
    this.attackTimer=0;
    this.shootTimer=0;
    this.bobAngle=Math.random()*TWO_PI;
    this.visible=true;
    this.teleportTimer=0;
    this.zigzag=0;
    this.room=null;
    this.isBoss=false;
    this.elite=false;
    this.phase=1;
    this.bossTimers={};
    this.spawnCooldown=0;
    this.shieldBurstTimer=0;
    this.flashTimer=0;
    this.voidOrbs=[];
    this.prevPhase=1;
    this.shieldAngle=0;    // SHIELDER: facing angle toward player
    this.grenadeTimer=0;   // GRENADIER: cooldown between lobs
    // Elite affix state
    this.eliteAffix=null;
    this.shieldHp=0; this.shieldMax=0; this.shieldRegenDelay=0;
    this.phaseTimer=0; this.phaseImmune=false;
    this.frenzyStacks=0; // FRENZY affix: stacks gained from nearby ally deaths (max 2)
    // Weapon affix status effects
    this.burnTimer=0; this.burnDps=0;
    this.slowTimer=0; this.slowFactor=1;  // 1 = normal speed
    this.stunTimer=0;                     // hackware EMP stun duration
    this._lastHitCtx=null;                // weapon context of last hit (for on-kill effects)
    // Holo Decoy taunt redirection
    this._tauntTarget=null;               // active hologram effect (or null)
    this._tx=x; this._ty=y;              // perceived target position (hologram or player)
  }

  /**
   * @param {any} [dmg]
   * @param {any} [hitCtx]
   */
  takeDamage(dmg, hitCtx) {
    if (this.dead) return 0;
    // PHASING elite affix: immune during phase window
    if (this.phaseImmune) {
      spawnDmgText(this.x, this.y, 'PHASE', '#cc88ff');
      return 0;
    }
    // WRAITH: immune while phased or emerging — damage extends corporeal timer
    if (this._wrPhased) {
      spawnDmgText(this.x, this.y, 'PHASED', '#66ffcc');
      return 0;
    }
    if (this.type === 'WRAITH' && this._wrState === 'corporeal') {
      // Extend corporeal window on hit (ICD 0.5s, +0.3s per hit, cap 3s)
      if ((this._wrHitICD || 0) <= 0) {
        this._wrTimer = Math.min(3.0, this._wrTimer + 0.3);
        this._wrHitICD = 0.5;
      }
    }
    if (this.type==='PHANTOM' && (this._phState==='cloaked'||this._phState==='telegraph')) {
      this._phState='cooldown'; this._phTimer=1.5; this.visible=true;
      audio.phantomUncloak();
    }
    // MIMIC: damage forces reveal (capture state first for shield gen DR check)
    const wasDisguised = this._disguised;
    if (this._disguised) this.revealMimic(_EG.player);
    // SHIELDED: any hit resets shield regen delay
    if (this.eliteAffix === 'SHIELDED') this.shieldRegenDelay = 0;
    // SHIELDED elite affix: absorb with shield first. Gated on the affix
    // explicitly so SHIELDER's directional shield (also uses shieldHp) is
    // NOT triggered here — SHIELDER consumes its shield only via frontal
    // projectile blocks at content.js, never from omnidirectional damage.
    if (this.eliteAffix === 'SHIELDED' && this.shieldHp > 0) {
      const absorbed = Math.min(this.shieldHp, dmg);
      this.shieldHp -= absorbed;
      dmg -= absorbed;
      this.flashTimer = 0.1;
      spawnDmgText(this.x, this.y, absorbed, '#4488ff');
      if (this.shieldHp <= 0) {
        spawnParticles(this.x, this.y, 'EXPLOSION', '#4488ff', 10);
        audio.shieldBreak();
      }
      if (dmg <= 0) return absorbed;
    }
    // Shield Generator DR — reduce incoming damage while room generator is active
    // Skip if enemy was disguised when hit (mimic first-hit shouldn't benefit)
    if (!wasDisguised && isEnemyShieldGenProtected(this)) {
      dmg = Math.max(1, Math.round(dmg * (1 - SHIELD_GEN_DR)));
    }
    // NEXUS link DR — linked enemies take 25% less damage
    if (this._nxBoosted) {
      dmg = Math.max(1, Math.round(dmg * 0.75));
    }
    const actual = Math.min(this.hp, dmg);
    this.hp -= dmg;
    this.flashTimer = 0.1;
    spawnDmgText(this.x, this.y, dmg, this.hp <= 0 ? '#ffcc00' : '#ffffff');
    // Normalize hitCtx — accept string (legacy) or object
    const ctx = typeof hitCtx === 'string' ? { name:hitCtx } : (hitCtx || {});
    this._lastHitCtx = ctx;
    // Apply weapon affix on-hit effects (procs don't re-proc)
    if (!ctx.isProc) applyHitEffects(this, actual, ctx);
    // UNCHAINED #42 — GENESIS endgame-choice intercept. First mortal blow
    // halts the kill at 1 HP and opens the THE ARCHITECT dialog; the _unchainedPhase
    // form (post-REFUSE) dies normally, granting the 'unchained' ending in endRun.
    if (this.type === 'GENESIS' && !this._unchainedPhase && this._endgameOffered && !this.dead) {
      if (this.hp <= 0) this.hp = 1;
      return actual;
    }
    if (this.hp <= 0 && this.type === 'GENESIS' && !this._unchainedPhase && !this._endgameOffered) {
      this.hp = 1;
      this._endgameOffered = true;
      this._lanceTelegraph = 0; this._lanceLock = null;
      if (typeof game !== 'undefined' && _EG.openEndgameChoice) _EG.openEndgameChoice(this);
      audio.hit(false, ctx.name || null);
      return actual;
    }
    if (this.hp<=0) { this.hp=0; this.die(); }
    else { const wn = ctx.name || null; audio.hit(false, wn); }
    return actual;
  }

  die() {
    if (this.dead) return;
    this.dead=true;
    unregisterEnemyFromRoom(this);
    // GHOST_PROJECTOR haunt hook — must fire BEFORE the _despawning early
    // return so a non-summon kill in a room with a projector arms a haunt
    // even if the kill came via cascade-adjacent paths. The hook itself
    // gates on _summoned/_ghIsGhost/isShard/isBoss/type.
    notifyGhostProjectors(this);
    // SUMMONER cascade: despawn all active summons silently
    if (this._summons) {
      for (const s of this._summons) {
        if (!s.dead) { s._despawning = true; s.die(); }
      }
    }
    // Silent despawn for summoned minions when their summoner dies
    if (this._despawning) {
      _EG.enemyDiedThisFrame=true;
      spawnParticles(this.x, this.y, 'SPARK', this.colour, 6);
      return;
    }
    _EG.enemyDiedThisFrame=true;
    audio.death();
    if (this.type === 'GENESIS' && this._unchainedPhase && typeof game !== 'undefined') {
      _EG._lastEnding = 'unchained';
    }
    spawnParticles(this.x,this.y,'EXPLOSION',this.colour,12);
    // Summoned minions: reduced rewards (like shards — no drops, no combo, no kill count).
    // Ghosts (GHOST_PROJECTOR replays) are treated as summons for rewards: no drops,
    // no credits, no XP, no combo, no kill count, no REAPER aggression bump.
    const isSummon = !!this._summoned || !!this._ghIsGhost;
    // Weapon affix on-kill effects (before drops/scoring)
    applyOnKill(this);
    // UNCHAINED #36 momentum: refresh player damage-bonus window on any kill.
    NEON.behavior.onKillRefreshMomentum(_EG.player);
    const d=getDiff();
    const dropRate = _EG.modifier === 'FORTIFIED' ? d.itemDrop * 1.3 : d.itemDrop;
    // MIMIC: guaranteed single drop (suppress normal roll)
    if (this.type === 'MIMIC') {
      items.push(new Item(this.x, this.y));
    } else if (!this.isShard && !isSummon && Math.random()<dropRate) {
      items.push(new Item(this.x,this.y));
    }
    _EG.player.gainXP(Math.round(this.xpValue*d.xpMul));
    // Combo: SHARDs, summons, and VOLATILE chain kills don't build streak
    const comboEligible = !this.isShard && !isSummon && !this._volatileKill;
    if (comboEligible) registerKill(this.isBoss);
    const mul = this.isBoss ? comboBossMultiplier() : comboMultiplier();
    _EG.player.score += Math.round(this.xpValue * _EG.floor * mul);
    // Quest kill counter (PACIFIST etc.) — exclude ghosts only (preserves
    // existing summon-counts-as-kill behavior). The player did not summon
    // the ghost, the projector did, and the ghost will expire on its own —
    // so killing one shouldn't break a pacifist run. (gpt-5.5 review #2,
    // ghost-projector PR.)
    if (_EG.quest && _EG.quest.kills !== undefined && !this._ghIsGhost) _EG.quest.kills++;
    if (!this.isShard && !isSummon) _EG.player.enemiesKilled++;
    // REAPER aggression counter — only count kills in the player's current
    // room. We compute room-at-death-time from player position (NOT the
    // cached player._currentRoom) because player.update() can trigger
    // kills mid-frame (e.g. bomb fuse detonation) BEFORE the per-frame
    // room-change refresh in updatePlaying() has run. Excludes shards/
    // summons via the same gate as enemiesKilled.
    if (!this.isShard && !isSummon && this.room) {
      const _pl = _EG.player;
      const _pInRoom = _pl &&
        _pl.x >= this.room.x && _pl.x < this.room.x + this.room.w &&
        _pl.y >= this.room.y && _pl.y < this.room.y + this.room.h;
      if (_pInRoom) {
        _pl.killsInCurrentRoom = (_pl.killsInCurrentRoom || 0) + 1;
      }
    }
    const baseCr = isSummon ? 0 : (CREDIT_VALUES[this.type] || 5);
    const creditSiphonMul = hasAugment('CREDIT_SIPHON') ? 1.5 : 1;
    const corrosiveMul = _EG.modifier === 'CORROSIVE' ? 1.5 : 1;
    const cr = Math.round(baseCr * (1 + _EG.floor * 0.15) * getMetaCreditMultiplier() * d.creditMul * creditSiphonMul * corrosiveMul * 0.85); // UNCHAINED #38: -15% credit drops (credits are now consumable-only)
    _EG.player.credits += cr;
    if (this.isBoss) _EG.bossesCleared++;
    // UNCHAINED #39: CORES drops on elite/boss kills. Summons / shard-split
    // enemies don't drop cores (same rule as items/credits). isBoss takes
    // precedence over elite so the boss amount is final.
    if (!isSummon && !this.isShard && typeof NEON !== 'undefined' && NEON.cores && NEON.cores.spawnCoreDrop) {
      let coreVal = 0;
      if (this.isBoss) {
        coreVal = (this.type === 'GENESIS') ? 10 : 5;
      } else if (this.elite) {
        coreVal = 1 + Math.floor(Math.random() * 2); // 1–2 uniform
      }
      if (coreVal > 0) NEON.cores.spawnCoreDrop(game, this.x, this.y, coreVal);
    }
    // Vampiric perk: heal on kill
    if (_EG.player.perks.VAMPIRIC && !this.isShard) {
      const heal = 2;
      _EG.player.hp = Math.min(_EG.player.maxHp, _EG.player.hp + heal);
      spawnDmgText(_EG.player.x, _EG.player.y, '+'+heal, '#ff3366');
    }
    // SCAVENGER_NANITES augment: 10% kill chance to heal 5 HP
    if (hasAugment('SCAVENGER_NANITES') && !this.isShard && Math.random() < 0.10) {
      _EG.player.hp = Math.min(_EG.player.maxHp, _EG.player.hp + 5);
      spawnDmgText(_EG.player.x, _EG.player.y, '+5', '#88ff44');
    }
    // ADRENALINE_INJECTOR augment: +30% speed for 2s on kill
    if (hasAugment('ADRENALINE_INJECTOR') && !this.isShard) {
      _EG.player.adrenalineTimer = 2;
    }
    // Bounty target: bonus rewards
    if (this._isBounty) {
      const bCr = Math.round((30 + _EG.floor * 8) * creditSiphonMul * corrosiveMul);
      _EG.player.credits += bCr;
      _EG.player.score += 150 * _EG.floor;
      _EG.player.bountiesCollected++;
      items.push(new Item(this.x, this.y)); // guaranteed bonus drop
      audio.bountyKill();
      _EG.msg('BOUNTY ELIMINATED  +' + bCr + ' CR  +' + (150 * _EG.floor) + ' pts', '#ffd700');
      spawnParticles(this.x, this.y, 'EXPLOSION', '#ffd700', 20);
      triggerShake(5, 0.2);
    }
    // Death explosion: VOLATILE modifier and/or EXPLOSIVE_KILLS perk (shared helper, non-stacking)
    const wantExplosion = (_EG.modifier === 'VOLATILE' || _EG.player.perks.EXPLOSIVE_KILLS) && !this.isBoss && !this._volatileKill;
    if (wantExplosion) {
      const bothActive = _EG.modifier === 'VOLATILE' && _EG.player.perks.EXPLOSIVE_KILLS;
      const vr = bothActive ? 2.5 : 2;
      const vdmg = (bothActive ? 20 : 15) + _EG.floor * 2;
      const col = _EG.modifier === 'VOLATILE' ? '#ff4422' : '#ff6600';
      spawnParticles(this.x, this.y, 'EXPLOSION', col, 18);
      triggerShake(6, 0.2);
      const p = _EG.player;
      // VOLATILE hurts the player; perk-only does not
      if (_EG.modifier === 'VOLATILE' && dist(p.x, p.y, this.x, this.y) < vr && hasLOS(this.x, this.y, p.x, p.y, _EG.dungeon.map)) {
        p.takeDamage(vdmg, 'Volatile');
      }
      for (const e of enemies) {
        if (e === this || e.dead) continue;
        if (e._wrPhased) continue;
        if (dist(e.x, e.y, this.x, this.y) < vr && hasLOS(this.x, this.y, e.x, e.y, _EG.dungeon.map)) {
          e._volatileKill = true;
          e.takeDamage(vdmg, _EG.modifier === 'VOLATILE' ? 'Volatile' : 'Explosion');
          if (!e.dead) e._volatileKill = false;
        }
      }
      // Chain to volatile cores
      primeVCoresInRadius(this.x, this.y, vr, _EG.dungeon.map);
      // Destroy nearby crates
      damageCratesInRadius(this.x, this.y, vr, vdmg, _EG.dungeon.map);
      // Damage nearby beacons
      damageBeaconsInRadius(this.x, this.y, vr, vdmg, _EG.dungeon.map);
      // Damage nearby shield generators
      damageShieldGensInRadius(this.x, this.y, vr, vdmg, _EG.dungeon.map);
      // Damage nearby cameras
      damageCamerasInRadius(this.x, this.y, vr, vdmg, _EG.dungeon.map);
      // Damage nearby laser tripwire emitters
      damageLasersInRadius(this.x, this.y, vr, vdmg, _EG.dungeon.map);
      // Damage nearby wall turrets
      damageWallTurretsInRadius(this.x, this.y, vr, vdmg, _EG.dungeon.map);
      // Trigger nearby mines
      triggerMinesInRadius(this.x, this.y, vr, _EG.dungeon.map);
    }
    // NEXUS death: neural feedback — stun + damage all linked enemies
    if (this.type === 'NEXUS' && this._nxLinks) {
      const feedbackDmg = 10 + (_EG.floor || 1) * 2;
      for (const linked of this._nxLinks) {
        if (linked.dead) continue;
        linked._nxBoosted = false;
        linked.stunTimer = Math.max(linked.stunTimer || 0, 1.5);
        linked.takeDamage(feedbackDmg, 'Neural Feedback');
      }
      this._nxLinks = [];
      spawnParticles(this.x, this.y, 'EXPLOSION', '#00eedd', 20);
      triggerShake(5, 0.2);
      audio.nexusDeath();
    }
    // GRAVITON death: collapse all owned gravity wells
    if (this.type === 'GRAVITON' && this._gvWells) {
      for (const w of this._gvWells) {
        if (!w.dead) {
          w.dead = true;
          spawnParticles(w.x, w.y, 'SPARK', '#8833ff', 6);
          audio.gravitonCollapse();
        }
      }
      this._gvWells = [];
      spawnParticles(this.x, this.y, 'EXPLOSION', '#8833ff', 15);
    }
    // SPLITTER: queue 2 SHARDs (deferred to avoid same-frame hits)
    if (this.type === 'SPLITTER') {
      audio.enemySplit();
      spawnParticles(this.x, this.y, 'EXPLOSION', '#00ff88', 15);
      const map = _EG.dungeon.map;
      for (let s = 0; s < 2; s++) {
        let sx = this.x + rnd(-1, 1), sy = this.y + rnd(-1, 1);
        const fx = Math.floor(sx), fy = Math.floor(sy);
        if (fx < 0 || fy < 0 || fx >= MAP_W || fy >= MAP_H || !isPassable(map[fy][fx])) {
          sx = this.x; sy = this.y;
        }
        pendingEnemySpawns.push({ type: 'SHARD', x: sx, y: sy, floor: _EG.floor, room: this.room, _challengeWave: !!this._challengeWave });
      }
    }
    // VOLATILE elite affix: death explosion (2-tile AoE, ATK×1.5, LOS-gated)
    if (this.eliteAffix === 'VOLATILE') {
      const vr = 2;
      const vdmg = Math.round(this.atk * 1.5);
      spawnParticles(this.x, this.y, 'EXPLOSION', '#ff6600', 22);
      triggerShake(7, 0.25);
      audio.eliteVolatile();
      const p = _EG.player;
      if (dist(p.x, p.y, this.x, this.y) < vr && p.dashTimer <= 0 && hasLOS(this.x, this.y, p.x, p.y, _EG.dungeon.map)) {
        p.takeDamage(vdmg, 'Volatile Elite');
      }
      for (const e of enemies) {
        if (e === this || e.dead || e._wrPhased) continue;
        if (dist(e.x, e.y, this.x, this.y) < vr && hasLOS(this.x, this.y, e.x, e.y, _EG.dungeon.map)) {
          e._volatileKill = true;
          e.takeDamage(vdmg, 'Volatile Elite');
          if (!e.dead) e._volatileKill = false;
        }
      }
      primeVCoresInRadius(this.x, this.y, vr, _EG.dungeon.map);
      damageCratesInRadius(this.x, this.y, vr, vdmg, _EG.dungeon.map);
      damageBeaconsInRadius(this.x, this.y, vr, vdmg, _EG.dungeon.map);
      damageShieldGensInRadius(this.x, this.y, vr, vdmg, _EG.dungeon.map);
      damageCamerasInRadius(this.x, this.y, vr, vdmg, _EG.dungeon.map);
      damageLasersInRadius(this.x, this.y, vr, vdmg, _EG.dungeon.map);
      damageWallTurretsInRadius(this.x, this.y, vr, vdmg, _EG.dungeon.map);
      triggerMinesInRadius(this.x, this.y, vr, _EG.dungeon.map);
    }
    // FRENZY elite affix: notify nearby frenzy elites of this death
    notifyFrenzyElites(this.x, this.y);
  }

  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   */
  update(dt, player, map) {
    if (this.dead) return;
    this.bobAngle+=dt*3;
    this.flashTimer=Math.max(0,this.flashTimer-dt);

    // GHOST lifetime tick — ticks even while stunned (stun shouldn't extend
    // a haunting). Silent despawn (no drops/credits) via _despawning latch
    // so die() takes the SUMMONER-cascade rewards-suppressed path.
    if (this._ghIsGhost) {
      this._ghLife = (this._ghLife || 0) - dt;
      if (this._ghLife <= 0) {
        this._despawning = true;
        this.die();
        return;
      }
    }

    // Set perceived target position (hologram taunt redirection)
    this._tx = player.x; this._ty = player.y;
    const _t = this._tauntTarget;
    if (_t && _t.age < _t.maxAge) { this._tx = _t.x; this._ty = _t.y; }
    else if (_t) { this._tauntTarget = null; }

    // Stun: freeze AI + cooldown timers while stunned
    // REAPER frenzy: full stun immunity. Drop any incoming stun BEFORE the
    // generic block so the reaper keeps chasing through EMP/Shock during the
    // 4s frenzy window — the player must out-position, not stun-defuse.
    if (this.stunTimer > 0 && this.type === 'REAPER' && this._reFrenzied) {
      this.stunTimer = 0;
    }
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      // Cancel sniper charge on stun — don't let it resume after stun ends
      if (this._laserTimer > 0) { this._laserTimer = 0; this._laserTarget = null; this._sniperCooldown = 0.8; }
      if (this._chargeState && this._chargeState !== 'idle') { this._chargeState = 'idle'; this._chargeDur = 0; this.bossTimers.charge = 1.5; }
      if (this._chgState && this._chgState !== 'idle') { this._chgState = 'idle'; this._chgCooldown = 2.0; }
      if (this._lpState === 'windup') { this._lpState = 'idle'; this._lpCooldown = 1.5; this._lpHeight = 0; }
      // Cancel pulser charge on stun — don't let it resume after stun ends
      if (this._plState === 'charging') { this._plState = 'idle'; this._plCooldown = 0.8; }
      // Cancel echoer aim on stun — don't fire after stun ends
      if (this._ecState === 'aiming') { this._ecState = 'idle'; this._ecAimTimer = 0; this._ecCooldown = 0.8; }
      // Cancel prophet aim on stun — same fairness contract as echoer.
      if (this._prState === 'aiming') { this._prState = 'idle'; this._prAimTimer = 0; this._prCooldown = 0.8; }
      // Cancel CRYOPHAGE aim on stun — defusing the layer before its
      // telegraph commits drops the queued patches entirely. Same
      // contract as echoer/prophet/resonator: can't fire after stun ends.
      if (this._cyState === 'aiming') { this._cyState = 'idle'; this._cyAimTimer = 0; this._cyTiles = null; this._cyCooldown = 0.8; }
      // Cancel resonator telegraph on stun — drop straight to recovery so the
      // wedge doesn't fire after stun ends and the player can punish the stun.
      if (this._rsState === 'telegraph') { this._rsState = 'recovery'; this._rsRec = RESONATOR_RECOVERY; this._rsTele = 0; }
      // Cancel mirror telegraph on stun — drop straight to recovery so the
      // shot doesn't fire after stun ends and the player can punish the stun.
      if (this._miState === 'telegraph') { this._miState = 'recovery'; this._miRec = MIRROR_RECOVERY; this._miTele = 0; }
      // Cancel REAPER telegraph on stun — return to idle so the frenzy
      // doesn't trigger after stun ends. _reHasFrenzied stays true (one-shot
      // defuse, not a re-trigger reset — re-arm only on player room change).
      if (this._reState === 'telegraph') { this._reState = 'idle'; this._reTele = 0; }
      // Cancel GHOST_PROJECTOR pending haunt on stun — defusing the
      // projector before its delay expires drops the memory entirely
      // (the slot frees up for the next ghostable kill in the room).
      // Does NOT clear _gpAwaitingFlush — once the spawn is queued the
      // ghost is materialising whether the projector is stunned or not
      // (the queue is committed). The flush will clear awaiting-flush
      // along with the back-assign.
      if (this.type === 'GHOST_PROJECTOR' && this._gpPendingType) {
        this._gpPendingType = null;
        this._gpPendingDelay = 0;
      }
      if (this._lanceTelegraph > 0) { this._lanceTelegraph = 0; this._lanceLock = null; }
      // NEXUS: stun breaks all neural links
      if (this._nxLinks && this._nxLinks.length > 0) {
        for (const e of this._nxLinks) { if (e && !e.dead) e._nxBoosted = false; }
        this._nxLinks = [];
      }
      // WRAITH: stun forces corporeal — must find valid tile first
      if (this._wrState && this._wrState !== 'corporeal') {
        const emerge = this._wrFindEmergeTile(map, _EG.player);
        if (emerge) {
          this.x = emerge.x; this.y = emerge.y;
          this._wrState = 'corporeal'; this._wrTimer = 2.0;
          this._wrPhased = false;
          audio.wraithPhaseIn();
        } else {
          // No valid tile — clear stun, stay phased (can't materialize in wall)
          this.stunTimer = 0;
        }
      }
      // TUNNELLER: stun forces surfacing — abort burrow/telegraph at a passable tile
      if (this.type === 'TUNNELLER' && this._tnState && this._tnState !== 'surfaced') {
        const emerge = this._wrFindEmergeTile(map, _EG.player);
        if (emerge) {
          this.x = emerge.x; this.y = emerge.y;
          this._tnState = 'surfaced';
          this._tnTimer = 3.0;
          this._wrPhased = false;
          audio.wraithPhaseIn();
        } else {
          // No valid tile — drop stun, stay buried
          this.stunTimer = 0;
        }
      }
      // SIPHON: drain beam visual continues fading during stun
      if (this._spDrainBeam) { this._spDrainBeam.t -= dt; if (this._spDrainBeam.t <= 0) this._spDrainBeam = null; }
      if (Math.random() < dt * 6) spawnParticles(this.x, this.y, 'SPARK', '#00ddff', 1);
      // LEAPER airborne/recovery must complete even while stunned (can't freeze mid-air)
      if (this._lpState === 'airborne' || this._lpState === 'recovery') {
        this.aiLeaper(dt, player, map, 0, false);
      }
      return; // skip all AI, leave attack/shoot timers frozen
    }

    this.attackTimer=Math.max(0,this.attackTimer-dt);
    this.shootTimer =Math.max(0,this.shootTimer-dt);
    this.spawnCooldown=Math.max(0,this.spawnCooldown-dt);

    const d = dist(this.x,this.y,this._tx,this._ty);
    const targetable = (this._tauntTarget && this._tauntTarget.age < this._tauntTarget.maxAge) || canTargetPlayer();
    const los = targetable && d<15 && hasLOS(this.x,this.y,this._tx,this._ty,map);

    // type-specific AI
    switch(this.type) {
      case 'GUARD':    this.aiGuard(dt,player,map,d,los);    break;
      case 'TURRET':   this.aiTurret(dt,player,map,d,los);   break;
      case 'CRAWLER':  this.aiCrawler(dt,player,map,d,los);  break;
      case 'PHANTOM':  this.aiPhantom(dt,player,map,d,los);  break;
      case 'DRONE':    this.aiDrone(dt,player,map,d,los);    break;
      case 'SHIELDER': this.aiShielder(dt,player,map,d,los); break;
      case 'GRENADIER':this.aiGrenadier(dt,player,map,d,los);break;
      case 'SPLITTER': this.aiSplitter(dt,player,map,d,los);break;
      case 'TELEPORTER':this.aiTeleporter(dt,player,map,d,los);break;
      case 'SNIPER':   this.aiSniper(dt,player,map,d,los);   break;
      case 'SUMMONER': this.aiSummoner(dt,player,map,d,los); break;
      case 'HEALER':  this.aiHealer(dt,player,map,d,los);  break;
      case 'CHARGER': this.aiCharger(dt,player,map,d,los); break;
      case 'SCORCHER':this.aiScorcher(dt,player,map,d,los);break;
      case 'BRUTE':   this.aiBrute(dt,player,map,d,los);   break;
      case 'LEAPER':  this.aiLeaper(dt,player,map,d,los);  break;
      case 'REFLECTOR':this.aiReflector(dt,player,map,d,los);break;
      case 'DISRUPTOR':this.aiDisruptor(dt,player,map,d,los);break;
      case 'WRAITH':  this.aiWraith(dt,player,map,d,los);  break;
      case 'NEXUS':   this.aiNexus(dt,player,map,d,los);  break;
      case 'SIPHON':  this.aiSiphon(dt,player,map,d,los); break;
      case 'GRAVITON':this.aiGraviton(dt,player,map,d,los);break;
      case 'SEEKER':  this.aiSeeker(dt,player,map,d,los);  break;
      case 'PULSER':  this.aiPulser(dt,player,map,d,los); break;
      case 'ECHOER':  this.aiEchoer(dt,player,map,d,los); break;
      case 'PROPHET': this.aiProphet(dt,player,map,d,los); break;
      case 'CRYOPHAGE':this.aiCryophage(dt,player,map,d,los); break;
      case 'RESONATOR':this.aiResonator(dt,player,map,d,los); break;
      case 'MIRROR':  this.aiMirror(dt,player,map,d,los); break;
      case 'REAPER':  this.aiReaper(dt,player,map,d,los); break;
      case 'GHOST_PROJECTOR': this.aiGhostProjector(dt,player,map,d,los); break;
      case 'MIMIC':   this.aiMimic(dt,player,map,d,los);  break;
      case 'TUNNELLER':this.aiTunneller(dt,player,map,d,los); break;
      case 'SHARD':    this.aiShard(dt,player,map,d,los);   break;
      case 'SENTINEL': this.aiBossSentinel(dt,player,map,d,los); break;
      case 'WARDEN':   this.aiBossWarden(dt,player,map,d,los);   break;
      case 'HIVE':     this.aiBossHive(dt,player,map,d,los);     break;
      case 'CONDUCTOR':this.aiBossConductor(dt,player,map,d,los);break;
      case 'OMEGA':    this.aiBossOmega(dt,player,map,d,los);    break;
      case 'GENESIS':  this.aiBossGenesis(dt,player,map,d,los);  break;
    }
  }

  // Elite affix combat tempo multiplier — scales speed and cooldowns
  // BERSERKER: scales with missing HP (1.0 → 1.5)
  // FRENZY: +40% per stack from nearby ally deaths (max 2 stacks = 1.8)
  berserkerMul() {
    if (this.eliteAffix === 'BERSERKER') return 1 + 0.5 * (1 - this.hp / this.maxHp);
    if (this.eliteAffix === 'FRENZY' && this.frenzyStacks > 0) return 1 + 0.4 * this.frenzyStacks;
    return 1;
  }

  // Taunt-aware targeting check: taunted enemies can "target" the hologram
  _canTarget() {
    const t = this._tauntTarget;
    return (t && t.age < t.maxAge) || canTargetPlayer();
  }

  /**
   * @param {any} [tx]
   * @param {any} [ty]
   * @param {any} [spd]
   * @param {any} [dt]
   * @param {any} [map]
   * @param {any} [ignoreWalls]
   */
  moveToward(tx,ty,spd,dt,map,ignoreWalls) {
    spd = modSpeed(spd) * this.slowFactor * this.berserkerMul() * (hasAugment('TEMPORAL_DILATION') ? 0.85 : 1);
    const [dx,dy]=norm(tx-this.x,ty-this.y);
    const nx=this.x+dx*spd*dt, ny=this.y+dy*spd*dt;
    if (ignoreWalls) { this.x=nx; this.y=ny; return; }
    const fx=Math.floor(nx), fy=Math.floor(this.y);
    const xf=Math.floor(this.x), yf=Math.floor(ny);
    if (fx>=0&&fy>=0&&fx<MAP_W&&fy<MAP_H && isPassable(map[fy][fx])) this.x=nx;
    if (xf>=0&&yf>=0&&xf<MAP_W&&yf<MAP_H && isPassable(map[yf][xf])) this.y=ny;
  }

  /**
   * @param {any} [dt]
   * @param {any} [map]
   */
  patrol(dt,map) {
    if (!this.patrolTarget || dist(this.x,this.y,this.patrolTarget.x,this.patrolTarget.y)<0.5) {
      if (this.room) {
        this.patrolTarget={
          x:this.room.x+rnd(1,this.room.w-1),
          y:this.room.y+rnd(1,this.room.h-1)
        };
      }
    }
    if (this.patrolTarget) this.moveToward(this.patrolTarget.x,this.patrolTarget.y,this.spd*0.5,dt,map);
  }

  /**
   * @param {any} [player]
   */
  meleeAttack(player) {
    if (this.attackTimer<=0 && this._canTarget()) {
      if (dist(this.x, this.y, player.x, player.y) > 1.2) return; // hologram whiff
      const dealt = player.takeDamage(this.atk, this.type);
      const baseCd = _EG.modifier==='OVERCLOCK' ? 0.83 : 1.0;
      this.attackTimer = baseCd / this.berserkerMul();
      spawnParticles(player.x,player.y,'SPARK','#ff4444',5);
      // CRAWLER inflicts burn on successful hit
      if (dealt > 0 && this.type === 'CRAWLER') {
        const wasBurning = player.burnTimer > 0;
        player.burnTimer = Math.max(player.burnTimer, 2);
        player.burnDps = Math.max(player.burnDps, 2 + _EG.floor * 0.3);
        if (!wasBurning) audio.playerBurn();
      }
    }
  }

  /**
   * @param {any} [px]
   * @param {any} [py]
   * @param {any} [spd]
   * @param {any} [dmg]
   * @param {any} [range]
   * @param {any} [colour]
   */
  fireAt(px,py,spd,dmg,range,colour) {
    const [dx,dy]=norm(px-this.x,py-this.y);
    const p=new Projectile(this.x,this.y,dx,dy,spd,dmg,range,colour,false,false);
    p.ownerType=this.type;
    p._owner=this;
    projectiles.push(p);
    audio.shoot(false);
  }

  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiGuard(dt,player,map,d,los) {
    const detectRange = 10 + (_EG.floor || 1) * 0.4;
    if (los && d<detectRange) { this.state='CHASE'; }
    else if (d>detectRange+2) { this.state='PATROL'; }
    if (this.state==='PATROL') this.patrol(dt,map);
    else {
      this.moveToward(this._tx,this._ty,this.spd,dt,map);
      if (d<1.2) this.meleeAttack(player);
    }
  }

  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiTurret(dt,player,map,d,los) {
    const cooldown = Math.max(1.0, 2.0 - (_EG.floor || 1) * 0.11) / (_EG.modifier==='OVERCLOCK'?1.2:1);
    if (los && d<12 && this.shootTimer<=0) {
      this.fireAt(this._tx,this._ty,8,this.atk,13,'#ffb700');
      this.shootTimer=cooldown / this.berserkerMul();
    }
  }

  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiCrawler(dt,player,map,d,los) {
    if (los||(d<8 && this._canTarget())) {
      this.zigzag+=dt*5;
      const [dx,dy]=norm(this._tx-this.x,this._ty-this.y);
      const perp={x:-dy,y:dx};
      const tx=this._tx+perp.x*Math.sin(this.zigzag)*1.5;
      const ty=this._ty+perp.y*Math.sin(this.zigzag)*1.5;
      this.moveToward(tx,ty,this.spd,dt,map);
      if (d<1.2) this.meleeAttack(player);
    } else this.patrol(dt,map);
  }

  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiScorcher(dt,player,map,d,los) {
    this._scTrailTimer = Math.max(0, (this._scTrailTimer || 0) - dt);
    if (los || (d < 9 && this._canTarget())) {
      this.zigzag += dt * 4;
      const [dx, dy] = norm(this._tx - this.x, this._ty - this.y);
      const perp = { x: -dy, y: dx };
      const orbit = Math.sin((this._scStrafeSeed || 0) + this.zigzag) * 1.3;
      let tx = this._tx + perp.x * orbit;
      let ty = this._ty + perp.y * orbit;
      if (d < 2.2) {
        tx = this.x - dx * 2.2 + perp.x * orbit * 0.7;
        ty = this.y - dy * 2.2 + perp.y * orbit * 0.7;
      }
      this.moveToward(tx, ty, this.spd, dt, map);
      if (d < 1.2) this.meleeAttack(player);
      if (this._scTrailTimer <= 0) {
        let overlap = false;
        for (const z of hazardZones) {
          if (z.source !== 'Scorcher Trail') continue;
          if (z.age < 0.6 && dist(z.x, z.y, this.x, this.y) < 0.8) { overlap = true; break; }
        }
        if (!overlap) {
          hazardZones.push({
            x: this.x, y: this.y, radius: 0.75, age: 0, maxAge: 2.2, tickCd: 0,
            armTimer: 0.12, dmg: Math.max(1, Math.round(this.atk * 0.55)),
            colour: '#ff5a22', source: 'Scorcher Trail'
          });
          spawnParticles(this.x, this.y, 'SPARK', '#ff5a22', 2);
        }
        this._scTrailTimer = 0.35;
      }
    } else {
      this.patrol(dt, map);
    }
  }

  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiBrute(dt,player,map,d,los) {
    if (los && this._canTarget() && d < 14) this.state = 'CHASE';
    else if (!los || !this._canTarget() || d > 16) this.state = 'PATROL';
    if (this.state !== 'CHASE') { this.patrol(dt, map); return; }
    const chaseSpd = d < 2.0 ? this.spd * 0.65 : this.spd * 0.9;
    this.moveToward(this._tx, this._ty, chaseSpd, dt, map);
    if (d < 1.3) this.meleeAttack(player);
  }

  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiPhantom(dt,player,map,d,los) {
    const bm = this.berserkerMul();
    const ocMul = _EG.modifier==='OVERCLOCK' ? 1.2 : 1;

    // ── Cloaked: stalk toward player, transition to telegraph ──
    if (this._phState === 'cloaked') {
      this._phTimer -= dt * ocMul;
      if (los && this._canTarget() && d < 10) {
        const spd = modSpeed(this.spd * 1.3) * this.slowFactor * bm * (hasAugment('TEMPORAL_DILATION') ? 0.85 : 1);
        this.moveToward(this._tx, this._ty, spd, dt, map);
      } else {
        this.patrol(dt, map);
      }
      // Close-range escape: reposition if player walks into us
      if (d < 2.5 && this._canTarget()) {
        this._phReposition(map, player);
        this._phTimer = 1.5 + Math.random();
        return;
      }
      // Ready to attack: need LOS, target, and be in sweet range
      if (this._phTimer <= 0 && los && this._canTarget() && d >= 2.5 && d <= 8) {
        this._phState = 'telegraph';
        this._phTimer = 0.4;
        this.visible = true;
        const [dx, dy] = norm(this._tx - this.x, this._ty - this.y);
        this._phAimDx = dx; this._phAimDy = dy;
        return;
      }
      // Timer expired but can't attack — reset
      if (this._phTimer <= 0) this._phTimer = 1.0 + Math.random() * 1.5;
      return;
    }

    // ── Telegraph: warning shimmer before attack ──
    if (this._phState === 'telegraph') {
      if (!los || !this._canTarget()) {
        this._phState = 'cloaked';
        this._phTimer = 1.5 + Math.random();
        this.visible = false;
        return;
      }
      this._phTimer -= dt;
      if (this._phTimer <= 0) {
        this._phState = 'attacking';
        this._phBurstLeft = 2;
        this._phBurstDelay = 0;
        audio.phantomUncloak();
      }
      return;
    }

    // ── Attacking: fire burst of 2 shots ──
    if (this._phState === 'attacking') {
      this._phBurstDelay -= dt;
      if (this._phBurstLeft > 0 && this._phBurstDelay <= 0) {
        const p = new Projectile(this.x, this.y, this._phAimDx, this._phAimDy,
          8, this.atk, 14, this.colour, false, false);
        p.ownerType = this.type;
        projectiles.push(p);
        audio.phantomStrike();
        spawnParticles(this.x, this.y, 'MUZZLE', this.colour, 2);
        this._phBurstLeft--;
        this._phBurstDelay = 0.15;
      }
      if (this._phBurstLeft <= 0 && this._phBurstDelay <= 0) {
        this._phState = 'cooldown';
        this._phTimer = 1.5 / bm;
      }
      return;
    }

    // ── Cooldown: visible and retreating, then re-cloak ──
    if (this._phState === 'cooldown') {
      this._phTimer -= dt;
      if (d < 5 && this._canTarget()) {
        const [fx, fy] = norm(this.x - this._tx, this.y - this._ty);
        const rSpd = modSpeed(this.spd) * this.slowFactor * bm * (hasAugment('TEMPORAL_DILATION') ? 0.85 : 1);
        const nx = this.x + fx * rSpd * dt;
        const ny = this.y + fy * rSpd * dt;
        const fxI = Math.floor(nx), fyI = Math.floor(this.y);
        const xfI = Math.floor(this.x), yfI = Math.floor(ny);
        if (fxI >= 0 && fyI >= 0 && fxI < MAP_W && fyI < MAP_H && isPassable(map[fyI][fxI])) this.x = nx;
        if (xfI >= 0 && xfI < MAP_W && yfI >= 0 && yfI < MAP_H && isPassable(map[yfI][xfI])) this.y = ny;
      }
      if (this._phTimer <= 0) {
        this._phState = 'cloaked';
        this._phTimer = 2 + Math.random() * 2;
        this.visible = false;
        audio.phantomCloak();
        if (!los || d > 8) this._phReposition(map, player);
      }
      return;
    }
  }

  /**
   * @param {any} [map]
   * @param {any} [player]
   */
  _phReposition(map, player) {
    if (!this.room) return;
    let bestX = this.x, bestY = this.y, bestD = 0;
    for (let a = 0; a < 15; a++) {
      const nx = this.room.x + rnd(1, this.room.w - 1);
      const ny = this.room.y + rnd(1, this.room.h - 1);
      const fx = Math.floor(nx), fy = Math.floor(ny);
      if (fx >= 0 && fy >= 0 && fx < MAP_W && fy < MAP_H && isPassable(map[fy][fx])) {
        const dd = dist(nx, ny, this._tx, this._ty);
        if (dd > bestD && dd > 3) { bestX = nx; bestY = ny; bestD = dd; }
      }
    }
    this.x = bestX; this.y = bestY;
  }

  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiDrone(dt,player,map,d,los) {
    const cooldown = Math.max(0.9, 1.5 - (_EG.floor || 1) * 0.07) / (_EG.modifier==='OVERCLOCK'?1.2:1);
    if (d<15 && this._canTarget()) {
      // Drones respect walls when boss room is sealed
      const canPhase = !_EG.bossSealed && !_EG.challengeSealed;
      this.moveToward(this._tx,this._ty,this.spd,dt,map,canPhase);
      if (this.shootTimer<=0) {
        this.fireAt(this._tx,this._ty,7,this.atk,16,'#00aaff');
        this.shootTimer=cooldown / this.berserkerMul();
      }
    }
  }

  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiShielder(dt,player,map,d,los) {
    // Tick the broken-shield recovery timer.
    //   shieldBrokenTimer === -1 → shield is up (or never broken yet)
    //   0 ≤ t < 3                → shield down, no visual
    //   3 ≤ t < 5                → shield blinking back into existence
    //   t ≥ 5                    → restore shield to full + clear timer
    if (this.shieldBrokenTimer >= 0) {
      this.shieldBrokenTimer += dt;
      if (this.shieldBrokenTimer >= 5) {
        this.shieldHp = this.shieldMax || 25;
        this.shieldBrokenTimer = -1;
      }
    }
    // Only update facing when player is visible (prevents wall-hack orientation)
    if (los) this.shieldAngle = Math.atan2(this._ty - this.y, this._tx - this.x);
    if (los && d < 12) {
      this.state = 'CHASE';
      this.moveToward(this._tx, this._ty, this.spd, dt, map);
      if (d < 1.2) this.meleeAttack(player);
    } else {
      this.state = 'PATROL';
      this.patrol(dt, map);
    }
  }

  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiReflector(dt,player,map,d,los) {
    // Smooth-lerp shield facing toward player (with tracking lag)
    if (los) {
      const target = Math.atan2(this._ty - this.y, this._tx - this.x);
      let diff = target - this._rfAngle;
      while (diff > Math.PI) diff -= TWO_PI;
      while (diff < -Math.PI) diff += TWO_PI;
      this._rfAngle += diff * Math.min(1, 3 * dt);
    }
    const bm = this.berserkerMul();
    if (los && d < 4) {
      // Too close — retreat
      const [dx, dy] = norm(this.x - this._tx, this.y - this._ty);
      const retreatSpd = modSpeed(this.spd) * this.slowFactor * bm * (hasAugment('TEMPORAL_DILATION') ? 0.85 : 1);
      const nx = this.x + dx * retreatSpd * dt;
      const ny = this.y + dy * retreatSpd * dt;
      const fx = Math.floor(nx), fy = Math.floor(this.y);
      const xf = Math.floor(this.x), yf = Math.floor(ny);
      let moved = false;
      if (fx >= 0 && fy >= 0 && fx < MAP_W && fy < MAP_H && isPassable(map[fy][fx])) { this.x = nx; moved = true; }
      if (xf >= 0 && yf >= 0 && xf < MAP_W && yf < MAP_H && isPassable(map[yf][xf])) { this.y = ny; moved = true; }
      if (!moved) this.patrol(dt, map);
    } else if (los && d <= 10) {
      // Hold position and fire
      this.state = 'ATTACK';
      if (this.shootTimer <= 0) {
        this.fireAt(this._tx, this._ty, 7, this.atk, 14, this.colour);
        this.shootTimer = 2.5 / bm;
      }
    } else if (los && d > 10) {
      this.moveToward(this._tx, this._ty, this.spd * 0.7, dt, map);
    } else {
      this.state = 'PATROL';
      this.patrol(dt, map);
    }
  }

  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiDisruptor(dt, player, map, d, los) {
    // Prune dead field refs
    this._dFields = this._dFields.filter((/** @type {any} */ f) => f && !f.dead);
    this._dDeployTimer = Math.max(0, this._dDeployTimer - dt);
    this._dFireTimer = Math.max(0, this._dFireTimer - dt);
    const bm = this.berserkerMul();
    const spd = modSpeed(this.spd) * this.slowFactor * bm * (hasAugment('TEMPORAL_DILATION') ? 0.85 : 1);

    if (los && d < 4) {
      // Too close — retreat
      const [dx, dy] = norm(this.x - this._tx, this.y - this._ty);
      const nx = this.x + dx * spd * dt;
      const ny = this.y + dy * spd * dt;
      const fx = Math.floor(nx), fy = Math.floor(this.y);
      const xf = Math.floor(this.x), yf = Math.floor(ny);
      let moved = false;
      if (fx >= 0 && fy >= 0 && fx < MAP_W && fy < MAP_H && isPassable(map[fy][fx])) { this.x = nx; moved = true; }
      if (xf >= 0 && yf >= 0 && xf < MAP_W && yf < MAP_H && isPassable(map[yf][xf])) { this.y = ny; moved = true; }
      if (!moved) this.patrol(dt, map);
    } else if (los && d <= 10) {
      this.state = 'ATTACK';
      // Deploy disruption field (priority over shooting)
      if (this._dDeployTimer <= 0 && this._canTarget() && d > 2) {
        // Place field near player with small offset, validated to passable tile
        const ox = (Math.random() - 0.5) * 1.5;
        const oy = (Math.random() - 0.5) * 1.5;
        const fx = this._tx + ox, fy = this._ty + oy;
        const tx = Math.floor(fx), ty = Math.floor(fy);
        if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H && isPassable(map[ty][tx])) {
          // If at cap, remove oldest
          if (this._dFields.length >= 2) {
            this._dFields[0].dead = true;
            this._dFields.shift();
          }
          const field = { x: fx, y: fy, age: 0, maxAge: 5, radius: 2, tickCd: 0, dead: false };
          disruptionFields.push(field);
          this._dFields.push(field);
          audio.disruptorDeploy();
          spawnParticles(fx, fy, 'EXPLOSION', '#ff44aa', 8);
          this._dDeployTimer = 4.0 / bm;
        }
      }
      // Secondary ranged attack
      else if (this._dFireTimer <= 0 && this._canTarget()) {
        this.fireAt(this._tx, this._ty, 7, this.atk, 12, this.colour);
        this._dFireTimer = 2.5 / bm;
      }
    } else if (los && d > 10) {
      this.moveToward(this._tx, this._ty, this.spd * 0.7, dt, map);
    } else {
      this.state = 'PATROL';
      this.patrol(dt, map);
    }
  }

  // ── WRAITH: ethereal wall-phasing predator ──
  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiWraith(dt, player, map, d, los) {
    const bm = this.berserkerMul();
    const ocMul = _EG.modifier === 'OVERCLOCK' ? 1.2 : 1;
    this._wrHitICD = Math.max(0, (this._wrHitICD || 0) - dt);

    // ── Phased: move through walls toward player ──
    if (this._wrState === 'phased') {
      this._wrTimer -= dt * ocMul;
      // Move toward player ignoring walls, respecting map bounds and room bounds
      const spd = modSpeed(this.spd * 1.2) * this.slowFactor * bm * (hasAugment('TEMPORAL_DILATION') ? 0.85 : 1);
      const [dx, dy] = norm(this._tx - this.x, this._ty - this.y);
      const nx = this.x + dx * spd * dt;
      const ny = this.y + dy * spd * dt;
      // Clamp to map bounds
      this.x = Math.max(0.1, Math.min(MAP_W - 0.1, nx));
      this.y = Math.max(0.1, Math.min(MAP_H - 0.1, ny));
      // Ghost trail particle
      if (Math.random() < dt * 6) spawnParticles(this.x, this.y, 'MUZZLE', '#66ffcc', 1);
      // Ready to emerge: close enough or timer expired
      if (this._wrTimer <= 0 || (d < 3 && this._canTarget())) {
        // Find nearest passable tile to emerge on — stay phased if none found
        const ex = this._wrFindEmergeTile(map, player);
        if (ex) {
          this.x = ex.x; this.y = ex.y;
          this._wrState = 'emerging';
          this._wrTimer = 0.5;
          audio.wraithPhaseIn();
        } else {
          this._wrTimer = 0.5; // retry shortly
        }
      }
      return;
    }

    // ── Emerging: telegraph before materializing ──
    if (this._wrState === 'emerging') {
      this._wrTimer -= dt;
      if (this._wrTimer <= 0) {
        this._wrState = 'corporeal';
        this._wrTimer = 2.0 + Math.random();
        this._wrPhased = false;
        this._wrFireTimer = 0.3; // brief delay before first shot
      }
      return;
    }

    // ── Corporeal: normal combat behavior ──
    if (this._wrState === 'corporeal') {
      this._wrTimer -= dt * ocMul;
      this._wrFireTimer = Math.max(0, (this._wrFireTimer || 0) - dt);
      // Approach or retreat based on distance
      if (los && d > 6) {
        this.moveToward(this._tx, this._ty, this.spd, dt, map);
      } else if (d < 3) {
        // Retreat
        const [rx, ry] = norm(this.x - this._tx, this.y - this._ty);
        const rSpd = modSpeed(this.spd * 0.8) * this.slowFactor * bm * (hasAugment('TEMPORAL_DILATION') ? 0.85 : 1);
        const nx = this.x + rx * rSpd * dt;
        const ny = this.y + ry * rSpd * dt;
        const fxI = Math.floor(nx), fyI = Math.floor(this.y);
        const xfI = Math.floor(this.x), yfI = Math.floor(ny);
        if (fxI >= 0 && fyI >= 0 && fxI < MAP_W && fyI < MAP_H && isPassable(map[fyI][fxI])) this.x = nx;
        if (xfI >= 0 && xfI < MAP_W && yfI >= 0 && yfI < MAP_H && isPassable(map[yfI][xfI])) this.y = ny;
      } else if (los) {
        this.moveToward(this._tx, this._ty, this.spd * 0.5, dt, map);
      } else {
        this.patrol(dt, map);
      }
      // Ranged attack
      if (this._wrFireTimer <= 0 && los && this._canTarget() && d < 10) {
        this.fireAt(this._tx, this._ty, 6, this.atk, 12, this.colour);
        this._wrFireTimer = 1.5 / bm;
      }
      // Ready to phase out
      if (this._wrTimer <= 0) {
        this._wrState = 'fading';
        this._wrTimer = 0.4;
        audio.wraithPhaseOut();
      }
      return;
    }

    // ── Fading: phase-out telegraph, still damageable ──
    if (this._wrState === 'fading') {
      this._wrTimer -= dt;
      if (this._wrTimer <= 0) {
        this._wrState = 'phased';
        this._wrTimer = 2.0 + Math.random();
        this._wrPhased = true;
      }
      return;
    }
  }

  /**
   * @param {any} [map]
   * @param {any} [player]
   */
  _wrFindEmergeTile(map, player) {
    // Try to emerge near perceived target on a passable tile
    const tx = this._tx ?? player.x, ty = this._ty ?? player.y;
    let bestX = null, bestY = null, bestD = Infinity;
    for (let a = 0; a < 20; a++) {
      const angle = Math.random() * TWO_PI;
      const r = 1.5 + Math.random() * 2;
      const nx = tx + Math.cos(angle) * r;
      const ny = ty + Math.sin(angle) * r;
      const txx = Math.floor(nx), tyy = Math.floor(ny);
      if (txx < 0 || tyy < 0 || txx >= MAP_W || tyy >= MAP_H) continue;
      if (!isPassable(map[tyy][txx])) continue;
      const dd = dist(nx, ny, tx, ty);
      if (dd < bestD && dd > 1.2) { bestX = nx; bestY = ny; bestD = dd; }
    }
    if (bestX !== null) return { x: bestX, y: bestY };
    // Fallback: current position if passable
    const cx = Math.floor(this.x), cy = Math.floor(this.y);
    if (cx >= 0 && cy >= 0 && cx < MAP_W && cy < MAP_H && isPassable(map[cy][cx])) {
      return { x: this.x, y: this.y };
    }
    // Emergency: search outward for any passable tile
    for (let r = 1; r < 6; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          const tx = Math.floor(this.x) + dx, ty = Math.floor(this.y) + dy;
          if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H && isPassable(map[ty][tx])) {
            return { x: tx + 0.5, y: ty + 0.5 };
          }
        }
      }
    }
    return null;
  }

  // ─── TUNNELLER AI — Burrowing Ambusher ──────────────────────────────────
  // States:
  //   tunneling: intangible (`_wrPhased=true`), drifts toward player
  //              ignoring walls. Only a dust mound is rendered at its tile.
  //              Cannot be hit/healed/targeted thanks to existing _wrPhased
  //              gates across the codebase.
  //   surfacing: locked at a passable tile near the player. 1.0s expanding-
  //              ring telegraph. Still intangible. AT END deals AoE damage
  //              within 1.4 tiles, then becomes corporeal.
  //   surfaced:  3s window of normal melee combat. Then re-burrow.
  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiTunneller(dt, player, map, d, los) {
    void los;
    const bm = this.berserkerMul();
    const ocMul = _EG.modifier === 'OVERCLOCK' ? 1.2 : 1;

    // ── Tunneling: intangible pursuit underground ──
    if (this._tnState === 'tunneling') {
      this._tnTimer -= dt * ocMul;
      // Drift toward player ignoring walls; faster while burrowed.
      const tspd = modSpeed(this.spd * 1.5) * this.slowFactor * bm * (hasAugment('TEMPORAL_DILATION') ? 0.85 : 1);
      const [dx, dy] = norm(this._tx - this.x, this._ty - this.y);
      const nx = this.x + dx * tspd * dt;
      const ny = this.y + dy * tspd * dt;
      this.x = Math.max(0.1, Math.min(MAP_W - 0.1, nx));
      this.y = Math.max(0.1, Math.min(MAP_H - 0.1, ny));
      // Dust trail particle puff at current tile (visible warning)
      if (Math.random() < dt * 8) spawnParticles(this.x, this.y, 'SPARK', '#cc8844', 1);

      // Surface when close to player or timer expires — only on a passable tile.
      const closeToTarget = d < 1.5 && this._canTarget();
      if (this._tnTimer <= 0 || closeToTarget) {
        const emerge = this._wrFindEmergeTile(map, player);
        if (emerge) {
          this.x = emerge.x; this.y = emerge.y;
          this._tnTargetX = emerge.x; this._tnTargetY = emerge.y;
          this._tnState = 'surfacing';
          this._tnTimer = 1.0; // telegraph window
          audio.wraithPhaseOut();
        } else {
          // No valid tile — keep burrowing briefly
          this._tnTimer = 0.5;
        }
      }
      return;
    }

    // ── Surfacing: locked telegraph + AoE on emerge ──
    if (this._tnState === 'surfacing') {
      this._tnTimer -= dt;
      // Hold position while telegraphing
      this.x = this._tnTargetX;
      this.y = this._tnTargetY;
      // Steady dust spurts during telegraph
      if (Math.random() < dt * 14) spawnParticles(this.x, this.y, 'SPARK', '#cc8844', 1);
      if (this._tnTimer <= 0) {
        // Emerge: AoE damage at 1.4 tile radius (telegraphed for ~1s, fair).
        const aoeR = 1.4;
        const aoeDmg = Math.round(this.atk * 1.0);
        if (dist(this.x, this.y, player.x, player.y) < aoeR && this._canTarget()) {
          player.takeDamage(aoeDmg, 'Tunneller Eruption');
        }
        spawnParticles(this.x, this.y, 'EXPLOSION', '#cc8844', 16);
        triggerShake(3, 0.18);
        audio.wraithPhaseIn();
        this._tnState = 'surfaced';
        this._tnTimer = 3.0;
        this._wrPhased = false;
        this.attackTimer = 0.4; // brief pause before first melee swing
      }
      return;
    }

    // ── Surfaced: 3s window of normal melee combat ──
    if (this._tnState === 'surfaced') {
      this._tnTimer -= dt * ocMul;
      if (los && d < 12) {
        this.moveToward(this._tx, this._ty, this.spd, dt, map);
      } else if (this._tx !== undefined) {
        this.moveToward(this._tx, this._ty, this.spd * 0.7, dt, map);
      } else {
        this.patrol(dt, map);
      }
      if (d < 1.2) this.meleeAttack(player);
      // Re-burrow when window expires
      if (this._tnTimer <= 0) {
        this._tnState = 'tunneling';
        this._tnTimer = 1.5 + Math.random() * 1.0;
        this._wrPhased = true;
        audio.wraithPhaseOut();
      }
      return;
    }
  }

  // ─── ECHOER AI — Sonar Predictor ────────────────────────────────────────
  // Punishes pattern movement: locks onto the player's position from
  // ECHOER_LOOKBACK seconds ago, telegraphs a ghost + dashed lane for
  // ECHOER_TELEGRAPH seconds, then fires a slow projectile that dissipates
  // at the locked point. Counter-play: change direction unpredictably.
  //
  // States:
  //   idle:   on cooldown OR scanning. When room-gated LoS is true and the
  //           past-position is reachable (LoS to past-pos), lock and enter
  //           aiming.
  //   aiming: lock is fixed; ghost+lane render; brief backstep if rushed.
  //           Cannot be interrupted by losing LoS to current player —
  //           the lane is committed and visible. Stun cancels.
  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiEchoer(dt, player, map, d, los) {
    void los; // we compute fresh LoS to the past-position below
    const bm = this.berserkerMul();
    const ocMul = _EG.modifier === 'OVERCLOCK' ? 1.2 : 1;
    this._ecCooldown = Math.max(0, (this._ecCooldown || 0) - dt * ocMul * bm);

    // Room-gated: only engage when target or player is inside this echoer's room.
    const inRoom = this.room && (
      (this._tx >= this.room.x && this._tx < this.room.x + this.room.w &&
       this._ty >= this.room.y && this._ty < this.room.y + this.room.h) ||
      (player.x >= this.room.x && player.x < this.room.x + this.room.w &&
       player.y >= this.room.y && player.y < this.room.y + this.room.h));

    // ── Aiming: telegraph window, then fire ──
    if (this._ecState === 'aiming') {
      this._ecAimTimer -= dt; // fixed-rate countdown — fairness > tempo

      // Backstep if player has closed the distance during the telegraph.
      if (d < 3 && this._canTarget()) {
        const [bx, by] = norm(this.x - this._tx, this.y - this._ty);
        this.moveToward(this.x + bx * 4, this.y + by * 4, this.spd * 1.1, dt, map);
      }

      if (this._ecAimTimer <= 0) {
        // Fire toward the locked past-position. Dissipates at the locked
        // point (small overshoot so a player standing exactly there still
        // takes a hit at the lane endpoint).
        const lx = this._ecLockX, ly = this._ecLockY;
        const [dx, dy] = norm(lx - this.x, ly - this.y);
        const range = Math.max(1, dist(this.x, this.y, lx, ly) + 0.5);
        const p = new Projectile(this.x, this.y, dx, dy, ECHOER_PROJ_SPD, this.atk, range, '#aa66ff', false, false);
        p.ownerType = this.type;
        projectiles.push(p);
        if (audio.echoerFire) audio.echoerFire();
        this._ecState = 'idle';
        this._ecAimTimer = 0;
        this._ecCooldown = ECHOER_COOLDOWN;
      }
      return;
    }

    // ── Idle: try to lock when conditions allow ──
    if (this._ecCooldown <= 0 && inRoom && this._canTarget()) {
      // Taunt redirection: when a hologram-taunt is active (_tx/_ty point
      // at the decoy), every other enemy targets the decoy. Mirror that
      // behavior here — lock at the decoy's position rather than reading
      // from the real player's history. Otherwise: use the predictive
      // past-position from player history (the actual ECHOER mechanic).
      let lockX = 0, lockY = 0, haveLock = false;
      const taunt = this._tauntTarget;
      const tauntActive = taunt && taunt.age < taunt.maxAge;
      if (tauntActive) {
        lockX = this._tx; lockY = this._ty; haveLock = true;
      } else {
        const past = _EG.player && _EG.player.getPositionAgo
          ? _EG.player.getPositionAgo(ECHOER_LOOKBACK)
          : null;
        if (past) { lockX = past.x; lockY = past.y; haveLock = true; }
      }
      if (haveLock) {
        // Need LoS from echoer to the lock point. Range gate uses
        // straight-line distance to the lock.
        const dLock = dist(this.x, this.y, lockX, lockY);
        if (dLock < ECHOER_RANGE && hasLOS(this.x, this.y, lockX, lockY, map)) {
          this._ecState = 'aiming';
          this._ecAimTimer = ECHOER_TELEGRAPH;
          this._ecLockX = lockX;
          this._ecLockY = lockY;
          if (audio.echoerLock) audio.echoerLock();
          return;
        }
      }
    }

    // No lock available: hold position. If player rushes within 3 tiles,
    // backstep gently to maintain niche identity (anti-orbit zoner, not
    // a melee combatant).
    if (d < 3 && this._canTarget()) {
      const [bx, by] = norm(this.x - this._tx, this.y - this._ty);
      this.moveToward(this.x + bx * 4, this.y + by * 4, this.spd, dt, map);
    } else if (!inRoom) {
      this.patrol(dt, map);
    }
    // else: hold position (menacing idle)
  }

  // ─── PROPHET AI — Future-Sight Predictor ────────────────────────────────
  // The inverse of ECHOER. Locks onto the player's PREDICTED position
  // PROPHET_LOOKAHEAD seconds ahead by linearly extrapolating velocity
  // from the shared _posHistory ring. Telegraphs a dashed lane + ghost at
  // the future point for PROPHET_TELEGRAPH seconds, then fires a fast
  // projectile timed to arrive at the lock.
  //
  // Counter-play: stop, turn, or reverse direction during the telegraph.
  // Linear extrapolation cannot follow non-linear motion, so any
  // direction change inside the telegraph window makes the shot miss.
  // PROPHET refuses to lock on a near-stationary player (vmag <
  // PROPHET_MIN_VEL) — there's nothing to predict from a still target,
  // and locking on the current position would just be a basic delayed
  // shot. Result: stillness is safe, motion is dangerous — opposite of
  // ECHOER.
  //
  // Hologram-taunt: when a taunt is active, lock at the decoy's
  // position directly (no prediction — the decoy doesn't move). Mirrors
  // the same explicit branch ECHOER needed because both mobs sample
  // player state outside the canonical _tx/_ty path.
  //
  // States:
  //   idle:   on cooldown OR scanning. When room-gated LoS is true and
  //           the predicted future point is reachable (LoS to predicted)
  //           AND vmag >= MIN_VEL, lock and enter aiming.
  //   aiming: lock is fixed; ghost+lane render; brief backstep if rushed.
  //           Cannot be interrupted by losing LoS to the current player —
  //           the lane is committed and visible. Stun cancels.
  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiProphet(dt, player, map, d, los) {
    void los; // we compute fresh LoS to the predicted point below
    const bm = this.berserkerMul();
    const ocMul = _EG.modifier === 'OVERCLOCK' ? 1.2 : 1;
    this._prCooldown = Math.max(0, (this._prCooldown || 0) - dt * ocMul * bm);

    // Room-gated: only engage when target or player is inside this prophet's room.
    const inRoom = this.room && (
      (this._tx >= this.room.x && this._tx < this.room.x + this.room.w &&
       this._ty >= this.room.y && this._ty < this.room.y + this.room.h) ||
      (player.x >= this.room.x && player.x < this.room.x + this.room.w &&
       player.y >= this.room.y && player.y < this.room.y + this.room.h));

    // ── Aiming: telegraph window, then fire ──
    if (this._prState === 'aiming') {
      this._prAimTimer -= dt; // fixed-rate countdown — fairness > tempo

      // Backstep if player has closed the distance during the telegraph.
      if (d < 3 && this._canTarget()) {
        const [bx, by] = norm(this.x - this._tx, this.y - this._ty);
        this.moveToward(this.x + bx * 4, this.y + by * 4, this.spd * 1.1, dt, map);
      }

      if (this._prAimTimer <= 0) {
        // Fire toward the locked future-position. Range is the straight
        // line to the lock plus a small overshoot so a player standing
        // exactly on the predicted point still takes the lane endpoint.
        const lx = this._prLockX, ly = this._prLockY;
        const [dx, dy] = norm(lx - this.x, ly - this.y);
        const range = Math.max(1, dist(this.x, this.y, lx, ly) + 0.5);
        const p = new Projectile(this.x, this.y, dx, dy, PROPHET_PROJ_SPD, this.atk, range, '#ffaa22', false, false);
        p.ownerType = 'Prophet Shot';
        projectiles.push(p);
        if (audio.prophetFire) audio.prophetFire();
        this._prState = 'idle';
        this._prAimTimer = 0;
        this._prCooldown = PROPHET_COOLDOWN;
      }
      return;
    }

    // ── Idle: try to lock when conditions allow ──
    if (this._prCooldown <= 0 && inRoom && this._canTarget()) {
      // Taunt redirection: when a hologram-taunt is active (_tx/_ty
      // point at the decoy), lock the decoy directly — predicting from
      // the decoy's velocity (zero) would otherwise trip the MIN_VEL
      // gate and PROPHET would never engage the decoy. Mirrors
      // aiEchoer's explicit taunt branch (lesson from PR #132 review).
      let lockX = 0, lockY = 0, haveLock = false;
      const taunt = this._tauntTarget;
      const tauntActive = taunt && taunt.age < taunt.maxAge;
      if (tauntActive) {
        lockX = this._tx; lockY = this._ty; haveLock = true;
      } else {
        const pred = _EG.player && _EG.player.getPredictedPosition
          ? _EG.player.getPredictedPosition(PROPHET_LOOKAHEAD)
          : null;
        // Stillness gate: refuse to lock on a near-stationary player.
        // That's the niche. Without this check PROPHET degenerates into
        // a slow-telegraph basic shooter.
        if (pred && pred.vmag >= PROPHET_MIN_VEL) {
          lockX = pred.x; lockY = pred.y; haveLock = true;
        }
      }
      if (haveLock) {
        // LoS + range gate to the predicted point. Range uses straight-
        // line distance to the lock (so a future point behind a wall
        // both fails LoS AND yields a sensible range cap).
        const dLock = dist(this.x, this.y, lockX, lockY);
        if (dLock < PROPHET_RANGE && hasLOS(this.x, this.y, lockX, lockY, map)) {
          this._prState = 'aiming';
          this._prAimTimer = PROPHET_TELEGRAPH;
          this._prLockX = lockX;
          this._prLockY = lockY;
          if (audio.prophetLock) audio.prophetLock();
          return;
        }
      }
    }

    // No lock available: hold position. If player rushes within 3 tiles,
    // backstep gently to maintain niche identity (anti-orbit zoner).
    if (d < 3 && this._canTarget()) {
      const [bx, by] = norm(this.x - this._tx, this.y - this._ty);
      this.moveToward(this.x + bx * 4, this.y + by * 4, this.spd, dt, map);
    } else if (!inRoom) {
      this.patrol(dt, map);
    }
    // else: hold position (menacing idle)
  }

  // ─── CRYOPHAGE AI — Frost-Patch Layer (area denial) ────────────────────
  // Slow walker (spd=1.0) that periodically commits to a frost lattice
  // anchored on the player's CURRENT tile at lock-time. Telegraphs a 5-tile
  // cyan + glyph (centre tile + 4 cardinals) for CRYOPHAGE_TELEGRAPH
  // seconds, then commits — patches persist for CRYOPHAGE_PATCH_LIFE
  // seconds and damage the player on entry (per-patch ICD), with dash
  // i-frames as the canonical pass-through.
  //
  // Niche: punishes camping / standing still. Distinct from PROPHET
  // (predicted future point) and ECHOER (historical position) — CRYOPHAGE
  // freezes wherever you ARE the moment it locks. Counter-play is to leave
  // the centre tile during the telegraph window and route around the
  // patches afterwards. If trapped, dash through (canonical answer).
  //
  // Patches are global (`frostPatches`) and survive the cryophage's death
  // — committed denial. They are cleared on floor transition (game.js
  // loadFloor — same place _posHistory resets).
  //
  // Hologram-taunt: when a taunt is active, lock the decoy's tile (the
  // canonical _tx/_ty already reflects this). Patches commit at the
  // decoy's location, denying the area the player was trying to lure
  // the cryophage toward — the bait costs you positional control too.
  //
  // States:
  //   idle:   _cyCooldown ticks. When room-gated, in range, and LoS holds,
  //           snap to the target tile and enter aiming.
  //   aiming: _cyAimTimer counts down; cyan + telegraph rendered. On 0,
  //           commit 5 frostPatches and reset to idle with full cooldown.
  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiCryophage(dt, player, map, d, los) {
    void d; void los; // recomputed against the lock for fairness
    const bm = this.berserkerMul();
    const ocMul = _EG.modifier === 'OVERCLOCK' ? 1.2 : 1;
    this._cyCooldown = Math.max(0, (this._cyCooldown || 0) - dt * ocMul * bm);

    // Room-gated: only engage when target or player is inside this cryophage's room.
    const inRoom = this.room && (
      (this._tx >= this.room.x && this._tx < this.room.x + this.room.w &&
       this._ty >= this.room.y && this._ty < this.room.y + this.room.h) ||
      (player.x >= this.room.x && player.x < this.room.x + this.room.w &&
       player.y >= this.room.y && player.y < this.room.y + this.room.h));

    // ── Aiming: telegraph window, then commit patches ──
    if (this._cyState === 'aiming') {
      this._cyAimTimer -= dt; // fixed-rate countdown — fairness > tempo

      if (this._cyAimTimer <= 0) {
        // COMMIT: spawn patches on the pre-filtered tile list locked at
        // the start of the telegraph window. Each patch is independent
        // (its own ICD, life, dead flag) so a patch destroyed early
        // doesn't affect the others. Geometry is FROZEN at lock time —
        // the player's mid-telegraph movement does NOT relocate the
        // lattice (that's the whole anti-camping niche).
        const tiles = /** @type {{x:number,y:number}[]} */ (this._cyTiles || []);
        for (const t of tiles) {
          frostPatches.push({
            x: t.x, y: t.y,
            age: 0, maxAge: CRYOPHAGE_PATCH_LIFE,
            tickCd: 0,
            dmg: Math.max(1, Math.round(this.atk * CRYOPHAGE_DMG_MUL)),
            dead: false,
          });
        }
        if (audio.cryophageCommit) audio.cryophageCommit();
        this._cyState = 'idle';
        this._cyAimTimer = 0;
        this._cyTiles = null;
        this._cyCooldown = CRYOPHAGE_COOLDOWN;
        return;
      }

      // While aiming, drift slightly toward the player so a kited cryophage
      // doesn't get stuck on geometry. Half-speed during telegraph.
      if (this._canTarget()) {
        const [bx, by] = norm(this._tx - this.x, this._ty - this.y);
        this.moveToward(this.x + bx * 4, this.y + by * 4, this.spd * 0.5, dt, map);
      }
      return;
    }

    // ── Idle: try to lock when conditions allow ──
    if (this._cyCooldown <= 0 && inRoom && this._canTarget()) {
      // Lock onto the player's CURRENT tile (canonical _tx/_ty handles
      // taunt redirection — the decoy's tile becomes the lock if active).
      // Snap to tile centres so the + lattice aligns with the grid.
      const lockX = Math.floor(this._tx) + 0.5;
      const lockY = Math.floor(this._ty) + 0.5;
      const dLock = dist(this.x, this.y, lockX, lockY);
      if (dLock < CRYOPHAGE_RANGE && hasLOS(this.x, this.y, lockX, lockY, map)) {
        // Pre-filter the lattice tiles ONCE at lock time. The same list
        // is consumed by both the draw branch (telegraph glyphs) and the
        // commit block (patch spawn) so the player's "what I see is what
        // commits" contract holds — wall tiles never render a warning,
        // and out-of-bounds coordinates never sneak past a missing
        // map[ty] guard. (Both gaps caught by adversarial review.)
        const candidates = [
          { x: lockX,     y: lockY     },
          { x: lockX + 1, y: lockY     },
          { x: lockX - 1, y: lockY     },
          { x: lockX,     y: lockY + 1 },
          { x: lockX,     y: lockY - 1 },
        ];
        /** @type {{x:number,y:number}[]} */
        const tiles = [];
        for (const t of candidates) {
          const tx = Math.floor(t.x), ty = Math.floor(t.y);
          // Bounds check FIRST — rejects negative or beyond-extent tiles.
          if (!map || ty < 0 || tx < 0 || !map[ty] || map[ty][tx] === undefined) continue;
          if (typeof isPassable === 'function' && !isPassable(map[ty][tx])) continue;
          tiles.push(t);
        }
        // If everything filtered (e.g. cryophage lined up against a wall
        // corner with the player on a non-existent tile), abort the lock
        // entirely — telegraphing zero patches just wastes the cooldown
        // and confuses the player.
        if (tiles.length === 0) {
          this._cyCooldown = 0.6; // short retry — try again soon
          return;
        }
        this._cyState = 'aiming';
        this._cyAimTimer = CRYOPHAGE_TELEGRAPH;
        this._cyLockX = lockX;
        this._cyLockY = lockY;
        this._cyTiles = tiles;
        if (audio.cryophageLock) audio.cryophageLock();
        return;
      }
    }

    // No lock available: chase the player at base speed (out of range or
    // no LoS — the slow walker has to close the gap before it can lock).
    if (inRoom && this._canTarget()) {
      this.moveToward(this._tx, this._ty, this.spd, dt, map);
    } else if (!inRoom) {
      this.patrol(dt, map);
    }
  }

  // ─── RESONATOR AI — Stationary Sonic-Cone Battery ──────────────────────
  // Stationary mob (spd=0). Cycles silently, then commits to a 60° sonic
  // cone telegraphed for RESONATOR_TELEGRAPH seconds before firing once.
  // Fire is instant (no projectile) — damage applies the frame the
  // telegraph timer hits 0 to any unit inside the locked cone arc that
  // also has LoS and isn't damage-immune (dash i-frames pass through).
  //
  // Aim source is `_tx,_ty` (canonical taunt-aware target), so hologram
  // decoys redirect the cone correctly with no special branch — unlike
  // ECHOER which had to special-case taunt because it sampled player
  // history directly.
  //
  // States:
  //   idle:      _rsCharge ticks down. When 0 + inRoom + canTarget + LoS,
  //              lock cone aim at (_tx,_ty) and enter telegraph.
  //   telegraph: _rsTele ticks down; cone wedge rendered. On 0, fire,
  //              transition to recovery.
  //   recovery:  _rsRec ticks down; on 0, reset _rsCharge, return to idle.
  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiResonator(dt, player, map, d, los) {
    void d; void los; // recomputed against the lock for fairness
    const bm = this.berserkerMul();
    const ocMul = _EG.modifier === 'OVERCLOCK' ? 1.2 : 1;

    // Room-gated: only engage when target or player is inside this resonator's room.
    const inRoom = this.room && (
      (this._tx >= this.room.x && this._tx < this.room.x + this.room.w &&
       this._ty >= this.room.y && this._ty < this.room.y + this.room.h) ||
      (player.x >= this.room.x && player.x < this.room.x + this.room.w &&
       player.y >= this.room.y && player.y < this.room.y + this.room.h));

    // ── Telegraph: lane visible, fire on completion ──
    if (this._rsState === 'telegraph') {
      this._rsTele -= dt; // fixed-rate countdown — fairness > tempo
      if (this._rsTele <= 0) {
        // FIRE: hit-test player against locked cone. LoS is rechecked at
        // fire-time (defense in depth — though map is static during a
        // telegraph window). Damage honors player damage immunity, so
        // dash i-frames are the canonical pass-through counter.
        const ax = this._rsAimDx, ay = this._rsAimDy;
        const dx = player.x - this.x, dy = player.y - this.y;
        const dPlayer2 = dx*dx + dy*dy;
        if (dPlayer2 <= RESONATOR_RANGE * RESONATOR_RANGE) {
          if (isInsideCone(player.x, player.y, this.x, this.y,
                           ax, ay, RESONATOR_RANGE, RESONATOR_HALF_RAD)
              && hasLOS(this.x, this.y, player.x, player.y, map)) {
            const dmg = Math.round(this.atk * RESONATOR_DMG_MUL);
            player.takeDamage(dmg, 'Resonator Cone');
          }
        }
        if (audio.resonatorFire) audio.resonatorFire();
        // Visual punch — pink shockwave at the apex along the aim line.
        const tipX = this.x + ax * RESONATOR_RANGE * 0.6;
        const tipY = this.y + ay * RESONATOR_RANGE * 0.6;
        spawnParticles(tipX, tipY, 'EXPLOSION', '#ff66cc', 10);
        triggerShake(2, 0.10);
        this._rsState = 'recovery';
        this._rsRec = RESONATOR_RECOVERY;
        this._rsTele = 0;
      }
      return;
    }

    // ── Recovery: cooling down, no aim attempts ──
    if (this._rsState === 'recovery') {
      this._rsRec -= dt * ocMul * bm;
      if (this._rsRec <= 0) {
        this._rsState = 'idle';
        this._rsCharge = RESONATOR_CHARGE;
      }
      return;
    }

    // ── Idle: silent charge, then try to commit ──
    this._rsCharge = Math.max(0, (this._rsCharge || 0) - dt * ocMul * bm);
    if (this._rsCharge <= 0 && inRoom && this._canTarget()) {
      const dLock = dist(this.x, this.y, this._tx, this._ty);
      // Range gate is INCLUSIVE to match isInsideCone / fire-time geometry.
      // dLock > 0.1 prevents the zero-aim edge case (target sitting exactly
      // on the apex would yield norm(0,0) = [0,0], producing an east-pointing
      // visual that never hits — "phantom cone" bug).
      if (dLock > 0.1 && dLock <= RESONATOR_RANGE && hasLOS(this.x, this.y, this._tx, this._ty, map)) {
        const [dx, dy] = norm(this._tx - this.x, this._ty - this.y);
        this._rsAimDx = dx; this._rsAimDy = dy;
        this._rsState = 'telegraph';
        this._rsTele = RESONATOR_TELEGRAPH;
        if (audio.resonatorCharge) audio.resonatorCharge();
      }
    }
    // Stationary: never patrol, never reposition. Sitting duck by design.
  }

  // ─── MIRROR AI — Stationary Mimic Battery ──────────────────────────────
  // Stationary mob (spd=0). Cycles silently, then commits to a single
  // projectile telegraphed for MIRROR_TELEGRAPH seconds before firing.
  // The hook: kinematics (speed, colour, range) are pulled from the
  // player's last fired ranged shot — so the projectile coming back is
  // visually + mechanically a copy of the player's own gun. Damage is
  // mob-scaled (this.atk * MIRROR_DMG_MUL); the player's actual damage
  // roll is NEVER replayed (late-game crits/perks would yield 200+ dmg).
  // Replayed projectile is intentionally vanilla: no piercing, no
  // ricochet, no homing — those player perks must not leak into enemy
  // projectiles.
  //
  // Aim source is `_tx,_ty` (canonical taunt-aware target), so hologram
  // decoys redirect the shot correctly with no special branch.
  //
  // States:
  //   idle:      _miCharge ticks down. When 0 + inRoom + canTarget + LoS,
  //              lock aim at (_tx,_ty), resolve kinematics from
  //              player._shotHistory, enter telegraph.
  //   telegraph: _miTele ticks down; aim line + colour-tinted ring rendered.
  //              On 0, fire one projectile, transition to recovery.
  //   recovery:  _miRec ticks down; on 0, reset _miCharge, return to idle.
  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiMirror(dt, player, map, d, los) {
    void d; void los; // recomputed against the lock for fairness
    const bm = this.berserkerMul();
    const ocMul = _EG.modifier === 'OVERCLOCK' ? 1.2 : 1;

    // Room-gated: only engage when target or player is inside this mob's room.
    const inRoom = this.room && (
      (this._tx >= this.room.x && this._tx < this.room.x + this.room.w &&
       this._ty >= this.room.y && this._ty < this.room.y + this.room.h) ||
      (player.x >= this.room.x && player.x < this.room.x + this.room.w &&
       player.y >= this.room.y && player.y < this.room.y + this.room.h));

    // ── Telegraph: aim line visible, fire on completion ──
    if (this._miState === 'telegraph') {
      this._miTele -= dt; // fixed-rate countdown — fairness > tempo
      if (this._miTele <= 0) {
        // FIRE: spawn a single projectile aimed at (_tx,_ty) using the
        // cached kinematics. Use the LOCKED aim (set at telegraph entry)
        // — chasing a moving player during the telegraph would defeat
        // the fairness window.
        const ax = this._miAimDx, ay = this._miAimDy;
        const dmg = Math.round(this.atk * MIRROR_DMG_MUL);
        const spd = this._miShotSpd || MIRROR_PROJ_SPD_DEF;
        const colour = this._miShotColour || '#88ff44';
        // Vanilla projectile — never piercing, never homing, never bouncing.
        // The 'false, false' tail is (piercing, friendly) per Projectile ctor.
        const p = new Projectile(this.x, this.y, ax, ay, spd, dmg,
                                  MIRROR_PROJ_RANGE, colour, false, false);
        // Override the post-construction speed so the MIRROR_PROJ_SPD_*
        // clamp stays authoritative — Projectile._init applies the global
        // CHARGED modifier (*1.4) and KINETIC_AMPLIFIER multipliers
        // unconditionally, which would otherwise leak past our clamp band
        // and produce invisible-fast return shots on CHARGED floors.
        p.spd = spd;
        // Damage attribution: tag with our source label so death recap
        // and damage logs show "Mirror Shot" instead of generic "Projectile".
        p.ownerType = 'Mirror Shot';
        projectiles.push(p);
        if (audio.mirrorFire) audio.mirrorFire();
        spawnParticles(this.x, this.y, 'MUZZLE', colour, 4);
        triggerShake(1.5, 0.08);
        this._miState = 'recovery';
        this._miRec = MIRROR_RECOVERY;
        this._miTele = 0;
      }
      return;
    }

    // ── Recovery: cooling down, no aim attempts ──
    if (this._miState === 'recovery') {
      this._miRec -= dt * ocMul * bm;
      if (this._miRec <= 0) {
        this._miState = 'idle';
        this._miCharge = MIRROR_CHARGE;
      }
      return;
    }

    // ── Idle: silent charge, then try to commit ──
    this._miCharge = Math.max(0, (this._miCharge || 0) - dt * ocMul * bm);
    if (this._miCharge <= 0 && inRoom && this._canTarget()) {
      const dLock = dist(this.x, this.y, this._tx, this._ty);
      // Range gate is INCLUSIVE to match the engagement intuition.
      // dLock > 0.1 prevents the zero-aim edge case (target sitting exactly
      // on the apex would yield norm(0,0) = [0,0], producing an east-pointing
      // shot that misses — "phantom shot" bug; same lesson as RESONATOR).
      if (dLock > 0.1 && dLock <= MIRROR_RANGE && hasLOS(this.x, this.y, this._tx, this._ty, map)) {
        const [dx, dy] = norm(this._tx - this.x, this._ty - this.y);
        this._miAimDx = dx; this._miAimDy = dy;
        // Resolve kinematics at LOCK time (not fire time) so the telegraph
        // colour matches the shot the player is about to receive.
        const k = pickMirrorKinematics(player && player._shotHistory);
        this._miShotSpd = k.spd;
        this._miShotColour = k.colour;
        this._miState = 'telegraph';
        this._miTele = MIRROR_TELEGRAPH;
        if (audio.mirrorCharge) audio.mirrorCharge();
      }
    }
    // Stationary: never patrol, never reposition. Sitting duck by design.
  }

  // ─── REAPER AI — Aggression-Punishing Frenzy Chaser ────────────────────
  // Floor 7+. Melee chaser whose threat scales with PLAYER aggression
  // (player.killsInCurrentRoom) instead of with floor number. Reward
  // careful pacing, punish spam-clearing.
  //
  // States:
  //   idle:      chase player at base spd; melee on contact (d<1.2). Each
  //              frame, if player is in this REAPER's room AND
  //              killsInCurrentRoom >= REAPER_FRENZY_THRESHOLD AND we
  //              haven't already frenzied this room visit, enter telegraph.
  //   telegraph: _reTele ticks down (REAPER_TELEGRAPH s) ONLY while player
  //              is in our room. Visible red ring drawn ON THE PLAYER.
  //              Chase continues. On 0, enter frenzy and set _reHasFrenzied
  //              so we don't re-trigger this room visit. Stun cancels (see
  //              update() stun branch).
  //   frenzy:    _reFrenzy ticks down (REAPER_FRENZY_DURATION s) ONLY while
  //              player is in our room. Chase speed = base * 1.6.
  //              Stun-immune (handled in update() stun branch).
  //
  // Reset: player room change clears killsInCurrentRoom AND _reHasFrenzied
  // for every REAPER in the new room (handled in game.js updatePlaying).
  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiReaper(dt, player, map, d, los) {
    void los; // chase doesn't gate on LoS — the reaper hunts by sound
    // Player-in-room test using THIS reaper's room (not player._currentRoom)
    // because reapers in rooms the player is leaving still need to know to
    // PAUSE rather than continue ticking off-screen.
    const playerInRoom = !!(this.room &&
      player.x >= this.room.x && player.x < this.room.x + this.room.w &&
      player.y >= this.room.y && player.y < this.room.y + this.room.h);

    // Telegraph: pause while player is out of our room (fairness rule).
    if (this._reState === 'telegraph') {
      if (playerInRoom) {
        this._reTele -= dt;
        if (this._reTele <= 0) {
          this._reState = 'frenzy';
          this._reFrenzy = REAPER_FRENZY_DURATION;
          this._reFrenzied = true;
          // _reHasFrenzied was already latched on telegraph entry — leave it.
          this._reTele = 0;
          if (audio.reaperFrenzy) audio.reaperFrenzy();
          spawnParticles(this.x, this.y, 'EXPLOSION', '#cc1144', 8);
        }
      }
      // Continue chasing during telegraph (no movement freeze).
    } else if (this._reState === 'frenzy') {
      if (playerInRoom) {
        this._reFrenzy -= dt;
        if (this._reFrenzy <= 0) {
          this._reState = 'idle';
          this._reFrenzy = 0;
          this._reFrenzied = false;
        }
      }
    } else {
      // idle: arm telegraph if conditions met
      const kills = (player && player.killsInCurrentRoom) || 0;
      if (playerInRoom && !this._reHasFrenzied && kills >= REAPER_FRENZY_THRESHOLD &&
          this._canTarget()) {
        this._reState = 'telegraph';
        this._reTele = REAPER_TELEGRAPH;
        // Consume the per-room latch IMMEDIATELY on telegraph entry (not
        // on frenzy entry). That way a stun-cancel during telegraph still
        // counts as the player's "one-shot defuse for this room visit"
        // — re-arm only happens on player room change.
        this._reHasFrenzied = true;
        if (audio.reaperTelegraph) audio.reaperTelegraph();
      }
    }

    // Chase logic — read frenzy via local multiplier (NEVER mutate this.spd
    // or the buff leaks into save/restore and difficulty scaling).
    if (d < REAPER_DETECT_RANGE && this._canTarget()) {
      const chaseSpd = this.spd * (this._reFrenzied ? REAPER_FRENZY_SPD_MUL : 1);
      this.moveToward(this._tx, this._ty, chaseSpd, dt, map);
      if (d < 1.2) this.meleeAttack(player);
    } else {
      this.patrol(dt, map);
    }
  }

  // ─── GHOST_PROJECTOR AI — Stationary Memory Lens ──────────────────────
  // Floor 8+. Stationary mob (spd=0, no attack of its own). Listens for
  // ghostable kills in its room via notifyGhostProjectors() (called from
  // Enemy.die). When a memory is claimed, _gpPendingDelay counts down from
  // GHOST_PROJECTOR_DELAY (3.0s); on 0, spawnGhost() conjures a translucent
  // replay at the kill site with reduced HP/atk. The active ghost ref is
  // held in _gpActiveGhost so we don't claim a new memory until the ghost
  // dies/expires.
  //
  // States are implicit:
  //   idle:      no memory, no active ghost. Claimable.
  //   pending:   _gpPendingType set, _gpPendingDelay > 0. Visual telegraph
  //              (orb at projector + ghosting at spawn site). Stun cancels.
  //   haunting:  _gpActiveGhost is alive. New memories blocked.
  //
  // Counter-play: kill the projector before its 3s delay expires (HP is
  // low, no defenses). Or stun it (drops the pending memory). Ghosts
  // themselves are normal enemies — kill them as usual.
  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiGhostProjector(dt, player, map, d, los) {
    void player; void map; void d; void los; // stationary, no engagement logic
    // Free the active-ghost slot once the ghost is gone, so the next
    // ghostable kill in the room can claim a new memory.
    if (this._gpActiveGhost && this._gpActiveGhost.dead) {
      this._gpActiveGhost = null;
    }
    // Pending memory: tick down delay, queue ghost on completion.
    if (this._gpPendingType && !this._gpAwaitingFlush) {
      this._gpPendingDelay -= dt;
      if (this._gpPendingDelay <= 0) {
        const queued = spawnGhost(
          this._gpPendingType,
          this._gpPendingX,
          this._gpPendingY,
          this.room,
          this
        );
        if (queued) {
          // Sentinel: blocks notifyGhostProjectors from re-claiming this
          // projector during the same-frame window between queueing and
          // the flush back-assigning _gpActiveGhost. Without this, a
          // second ghostable kill in the same frame (e.g. SEEKER death
          // explosion chain) would arm a NEW pending memory — and the
          // flush would then leave us with both an active ghost AND a
          // new pending claim, violating the per-projector single-
          // projection rule. Cleared by the flush in game.js along with
          // _gpPendingType when _gpActiveGhost is back-assigned.
          this._gpAwaitingFlush = true;
          if (audio && audio.ghostProjectorSpawn) audio.ghostProjectorSpawn();
          spawnParticles(this._gpPendingX, this._gpPendingY, 'EXPLOSION', '#ccaaff', 10);
        } else {
          // Spawn refused (unknown type / no _EG) — drop the memory so
          // the projector becomes claimable again next frame.
          this._gpPendingType = null;
          this._gpPendingDelay = 0;
        }
      }
    }
  }

  /**
   * @param {any} [proj]
   */
  blocksProjectile(proj) {
    // SHIELDER: 120° frontal arc — blocks player projectiles (not piercing/
    // orbitals). Shield is now BREAKABLE: each blocked hit deals damage to
    // shieldHp at the call site (content.js). When shieldHp drops to 0 the
    // shield disappears for ~3s, blinks back in over the next 2s, and is
    // fully operational again at 5s. shieldBrokenTimer is the time elapsed
    // since the shield broke (-1 means not broken).
    if (this.type === 'SHIELDER' && !this.dead && this.shieldHp > 0) {
      const incomingAngle = Math.atan2(-proj.dy, -proj.dx);
      let diff = incomingAngle - this.shieldAngle;
      while (diff > Math.PI) diff -= TWO_PI;
      while (diff < -Math.PI) diff += TWO_PI;
      return Math.abs(diff) < Math.PI / 3;
    }
    // REFLECTOR: 90° arc — blocks ally turret projectiles (player projs are reflected instead)
    if (this.type === 'REFLECTOR' && !this.dead) {
      const incomingAngle = Math.atan2(-proj.dy, -proj.dx);
      let diff = incomingAngle - this._rfAngle;
      while (diff > Math.PI) diff -= TWO_PI;
      while (diff < -Math.PI) diff += TWO_PI;
      return Math.abs(diff) < Math.PI / 4;
    }
    return false;
  }

  /**
   * @param {any} [proj]
   */
  reflectsProjectile(proj) {
    // REFLECTOR: 90° frontal arc reflects player projectiles back at them
    if (this.type !== 'REFLECTOR' || this.dead) return false;
    const incomingAngle = Math.atan2(-proj.dy, -proj.dx);
    let diff = incomingAngle - this._rfAngle;
    while (diff > Math.PI) diff -= TWO_PI;
    while (diff < -Math.PI) diff += TWO_PI;
    return Math.abs(diff) < Math.PI / 4;
  }

  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiGrenadier(dt,player,map,d,los) {
    this.grenadeTimer = Math.max(0, this.grenadeTimer - dt);
    const bm = this.berserkerMul();
    if (los && d < 5) {
      // Too close — retreat
      const [dx, dy] = norm(this.x - this._tx, this.y - this._ty);
      const retreatSpd = modSpeed(this.spd) * this.slowFactor * bm * (hasAugment('TEMPORAL_DILATION') ? 0.85 : 1);
      const nx = this.x + dx * retreatSpd * dt;
      const ny = this.y + dy * retreatSpd * dt;
      const fx = Math.floor(nx), fy = Math.floor(this.y);
      const xf = Math.floor(this.x), yf = Math.floor(ny);
      let moved = false;
      if (fx >= 0 && fy >= 0 && fx < MAP_W && fy < MAP_H && isPassable(map[fy][fx])) { this.x = nx; moved = true; }
      if (xf >= 0 && yf >= 0 && xf < MAP_W && yf < MAP_H && isPassable(map[yf][xf])) { this.y = ny; moved = true; }
      if (!moved) this.patrol(dt, map);
    } else if (los && d <= 12) {
      if (this.grenadeTimer <= 0) {
        this.lobGrenade(this._tx, this._ty, map);
        this.grenadeTimer = Math.max(2.5, 3.5 - (_EG.floor || 1) * 0.1) / (_EG.modifier==='OVERCLOCK'?1.2:1) / bm;
      }
    } else if (d > 12 && los) {
      this.moveToward(this._tx, this._ty, this.spd * 0.7, dt, map);
    } else {
      this.patrol(dt, map);
    }
  }

  /**
   * @param {any} [tx]
   * @param {any} [ty]
   * @param {any} [map]
   */
  lobGrenade(tx, ty, map) {
    // Create a grenade projectile targeting (tx,ty)
    const [dx, dy] = norm(tx - this.x, ty - this.y);
    const g = new Projectile(this.x, this.y, dx, dy, 6, 0, 20, '#ff6622', false, false);
    g.isGrenade = true;
    g.targetX = tx;
    g.targetY = ty;
    g.grenadeDmg = this.atk; // already floor-scaled from spawnEnemy
    projectiles.push(g);
    audio.grenadeLob();
  }

  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiSplitter(dt,player,map,d,los) {
    const speedMul = this.hp < this.maxHp * 0.3 ? 1.3 : 1;
    if (los && d < 10) {
      this.state = 'CHASE';
      this.moveToward(this._tx, this._ty, this.spd * speedMul, dt, map);
      if (d < 1.2) this.meleeAttack(player);
    } else {
      this.state = 'PATROL';
      this.patrol(dt, map);
    }
  }

  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiShard(dt,player,map,d,los) {
    if (los || (d < 8 && this._canTarget())) {
      this.zigzag += dt * 6;
      const [dx, dy] = norm(this._tx - this.x, this._ty - this.y);
      const perp = { x: -dy, y: dx };
      const tx = this._tx + perp.x * Math.sin(this.zigzag) * 1.2;
      const ty = this._ty + perp.y * Math.sin(this.zigzag) * 1.2;
      this.moveToward(tx, ty, this.spd, dt, map);
      if (d < 1.2) this.meleeAttack(player);
    } else this.patrol(dt, map);
  }

  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiTeleporter(dt,player,map,d,los) {
    this.teleportTimer = Math.max(0, this.teleportTimer - dt);
    if (this._materialize > 0) this._materialize -= dt;
    if (this._warpFade > 0) this._warpFade -= dt * 1.5;

    // Emergency blink if player gets close (skip if just teleported or player cloaked)
    if (d < 2 && this._canTarget() && this.teleportTimer > 0.8 && this._materialize <= 0) this.teleportTimer = 0;

    // Teleport cycle
    if (this.teleportTimer <= 0 && this.room) {
      this._warpFromX = this.x;
      this._warpFromY = this.y;
      this._warpFade = 0.6;
      let placed = false;
      for (let a = 0; a < 12; a++) {
        const nx = this.room.x + rnd(1, this.room.w - 1);
        const ny = this.room.y + rnd(1, this.room.h - 1);
        const fx = Math.floor(nx), fy = Math.floor(ny);
        if (fx >= 0 && fy >= 0 && fx < MAP_W && fy < MAP_H && isPassable(map[fy][fx])) {
          this.x = nx; this.y = ny; placed = true; break;
        }
      }
      if (placed) {
        spawnParticles(this.x, this.y, 'EXPLOSION', this.colour, 8);
        audio.teleport();
      }
      const cd = Math.max(2.0, 3.0 - (_EG.floor || 1) * 0.1) / (_EG.modifier === 'OVERCLOCK' ? 1.2 : 1);
      this.teleportTimer = cd;
      this._materialize = 0.4;
      this._burstLeft = 2;
    }

    // Can't attack while materializing
    if (this._materialize > 0) return;

    // Fire burst at player
    if (this._burstLeft > 0 && los && this.shootTimer <= 0) {
      this.fireAt(this._tx, this._ty, 8, this.atk, 14, this.colour);
      this._burstLeft--;
      this.shootTimer = 0.25 / this.berserkerMul();
    }
  }

  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiSniper(dt,player,map,d,los) {
    this._sniperCooldown = Math.max(0, (this._sniperCooldown || 0) - dt);
    this._repositionTimer = Math.max(0, (this._repositionTimer || 0) - dt);

    // Room-gated: only aggro when target or player is inside this sniper's room
    const inRoom = this.room && (
      (this._tx >= this.room.x && this._tx < this.room.x + this.room.w &&
       this._ty >= this.room.y && this._ty < this.room.y + this.room.h) ||
      (player.x >= this.room.x && player.x < this.room.x + this.room.w &&
       player.y >= this.room.y && player.y < this.room.y + this.room.h));

    // Cancel charge conditions: lost LOS, player cloaked, stunned, or player fled room
    if (this._laserTimer > 0) {
      if (!los || !this._canTarget() || !inRoom || this.stunTimer > 0 || d < 3) {
        this._laserTimer = 0;
        this._laserTarget = null;
        this._sniperCooldown = 0.8; // post-cancel cooldown
        if (d < 3 && this._canTarget()) {
          // Flee if too close
          const [fx, fy] = norm(this.x - this._tx, this.y - this._ty);
          this.moveToward(this.x + fx * 5, this.y + fy * 5, this.spd * 1.3, dt, map);
        }
        return;
      }
      // Charging — count down (fixed rate, unaffected by OVERCLOCK/berserker)
      this._laserTimer -= dt;
      if (this._laserTimer <= 0) {
        // Fire along the locked direction
        const tx = this._laserTarget.x, ty = this._laserTarget.y;
        const [dx, dy] = norm(tx - this.x, ty - this.y);
        const p = new Projectile(this.x, this.y, dx, dy, 14, this.atk, 20, this.colour, false, false);
        p.ownerType = this.type;
        projectiles.push(p);
        audio.sniperFire();
        this._laserTarget = null;
        this._repositionTimer = 1.0 / this.berserkerMul() / (_EG.modifier === 'OVERCLOCK' ? 1.2 : 1);
        this._sniperCooldown = Math.max(2.5, 3.5 - (_EG.floor || 1) * 0.1) / this.berserkerMul() / (_EG.modifier === 'OVERCLOCK' ? 1.2 : 1);
      }
      return;
    }

    // Repositioning after firing — move to a far tile in the room
    if (this._repositionTimer > 0 && this.room) {
      if (!this._repositionTarget) {
        // Pick a passable tile far from player
        let bestX = this.x, bestY = this.y, bestDist = 0;
        for (let a = 0; a < 15; a++) {
          const nx = this.room.x + rnd(1, this.room.w - 1);
          const ny = this.room.y + rnd(1, this.room.h - 1);
          const fx = Math.floor(nx), fy = Math.floor(ny);
          if (fx >= 0 && fy >= 0 && fx < MAP_W && fy < MAP_H && isPassable(map[fy][fx])) {
            const dd = dist(nx, ny, this._tx, this._ty);
            if (dd > bestDist) { bestX = nx; bestY = ny; bestDist = dd; }
          }
        }
        this._repositionTarget = { x: bestX, y: bestY };
      }
      this.moveToward(this._repositionTarget.x, this._repositionTarget.y, this.spd * 1.5, dt, map);
      if (dist(this.x, this.y, this._repositionTarget.x, this._repositionTarget.y) < 0.5) {
        this._repositionTarget = null;
        this._repositionTimer = 0;
      }
      return;
    }
    this._repositionTarget = null;

    // Idle / patrol / lock-on
    if (inRoom && los && d < 15 && this._canTarget() && this._sniperCooldown <= 0) {
      // Lock on
      this._laserTarget = { x: this._tx, y: this._ty };
      this._laserTimer = 1.5;
      audio.sniperCharge();
    } else if (!inRoom || !los) {
      this.patrol(dt, map);
    }
    // If in room with LOS but on cooldown, hold position (menacing idle)
  }

  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiSummoner(dt,player,map,d,los) {
    this._summonTimer = Math.max(0, (this._summonTimer || 0) - dt);
    // Prune dead summons from tracking array
    if (this._summons) this._summons = this._summons.filter((/** @type {any} */ s) => !s.dead);
    const bm = this.berserkerMul();
    if (los && d < 5) {
      // Too close — retreat
      const [dx, dy] = norm(this.x - this._tx, this.y - this._ty);
      const retreatSpd = modSpeed(this.spd) * this.slowFactor * bm * (hasAugment('TEMPORAL_DILATION') ? 0.85 : 1);
      const nx = this.x + dx * retreatSpd * dt;
      const ny = this.y + dy * retreatSpd * dt;
      const fx = Math.floor(nx), fy = Math.floor(this.y);
      const xf = Math.floor(this.x), yf = Math.floor(ny);
      let moved = false;
      if (fx >= 0 && fy >= 0 && fx < MAP_W && fy < MAP_H && isPassable(map[fy][fx])) { this.x = nx; moved = true; }
      if (xf >= 0 && yf >= 0 && xf < MAP_W && yf < MAP_H && isPassable(map[yf][xf])) { this.y = ny; moved = true; }
      if (!moved) this.patrol(dt, map);
    } else if (los && d <= 14) {
      // In range — summon minions if cooldown ready
      if (this._summonTimer <= 0 && (this._summons || []).length < 3) {
        this.summonMinion(map);
        this._summonTimer = Math.max(3.5, 5 - (_EG.floor || 1) * 0.15) / (_EG.modifier==='OVERCLOCK'?1.2:1) / bm;
      }
    } else if (d > 14 && los) {
      this.moveToward(this._tx, this._ty, this.spd * 0.6, dt, map);
    } else {
      this.patrol(dt, map);
    }
  }

  /**
   * @param {any} [map]
   */
  summonMinion(map) {
    // Find a passable tile near the summoner
    let sx, sy, found = false;
    for (let a = 0; a < 10; a++) {
      sx = this.x + rnd(-2, 2);
      sy = this.y + rnd(-2, 2);
      const fx = Math.floor(sx), fy = Math.floor(sy);
      if (fx >= 0 && fy >= 0 && fx < MAP_W && fy < MAP_H && isPassable(map[fy][fx])) {
        found = true; break;
      }
    }
    if (!found) { sx = this.x; sy = this.y; }
    if (!this._summons) this._summons = [];
    pendingEnemySpawns.push({
      type: 'DRONE', x: sx, y: sy, floor: _EG.floor, room: this.room,
      _challengeWave: !!this._challengeWave,
      _summoned: true, _summonerRef: this
    });
    audio.summon();
    spawnParticles(this.x, this.y, 'MUZZLE', '#bb44ff', 8);
    spawnParticles(sx, sy, 'SPARK', '#bb44ff', 6);
  }

  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiHealer(dt,player,map,d,los) {
    this._healTimer = Math.max(0, (this._healTimer || 0) - dt);
    this._healBeam = this._healBeam ? { ...this._healBeam, t: this._healBeam.t - dt } : null;
    if (this._healBeam && this._healBeam.t <= 0) this._healBeam = null;
    const bm = this.berserkerMul();
    if (los && d < 4) {
      // Too close — retreat
      const [dx, dy] = norm(this.x - this._tx, this.y - this._ty);
      const retreatSpd = modSpeed(this.spd) * this.slowFactor * bm * (hasAugment('TEMPORAL_DILATION') ? 0.85 : 1);
      const nx = this.x + dx * retreatSpd * dt;
      const ny = this.y + dy * retreatSpd * dt;
      const fx = Math.floor(nx), fy = Math.floor(this.y);
      const xf = Math.floor(this.x), yf = Math.floor(ny);
      let moved = false;
      if (fx >= 0 && fy >= 0 && fx < MAP_W && fy < MAP_H && isPassable(map[fy][fx])) { this.x = nx; moved = true; }
      if (xf >= 0 && yf >= 0 && xf < MAP_W && yf < MAP_H && isPassable(map[yf][xf])) { this.y = ny; moved = true; }
      if (!moved) this.patrol(dt, map);
    } else if (los && d <= 12) {
      // In heal range — find wounded ally and heal
      if (this._healTimer <= 0) {
        const target = this._findHealTarget();
        if (target) {
          // 0.075 (was 0.15) so post-HP-double absolute heal output matches
          // pre-double rates. Player DPS unchanged by HP buff, so leaving
          // this at 0.15 doubled negation %; reviewers caught this.
          const healAmt = Math.round(target.maxHp * 0.075);
          target.hp = Math.min(target.maxHp, target.hp + healAmt);
          this._healBeam = { tx: target.x, ty: target.y, t: 0.4 };
          this._healTimer = Math.max(2.0, 3.0 - (_EG.floor || 1) * 0.1) / (_EG.modifier === 'OVERCLOCK' ? 1.2 : 1) / bm;
          audio.heal();
          spawnParticles(this.x, this.y, 'MUZZLE', '#44ffaa', 5);
          spawnParticles(target.x, target.y, 'SPARK', '#44ffaa', 6);
        }
      }
    } else if (d > 12 && los) {
      this.moveToward(this._tx, this._ty, this.spd * 0.6, dt, map);
    } else {
      this.patrol(dt, map);
    }
  }

  _findHealTarget() {
    let best = null, bestRatio = 1;
    for (const e of enemies) {
      if (e === this || e.dead || e.isBoss) continue;
      if (e._wrPhased) continue; // can't heal phased WRAITHs
      if (e.hp >= e.maxHp) continue;
      const ed = dist(this.x, this.y, e.x, e.y);
      if (ed > 6) continue;
      const ratio = e.hp / e.maxHp;
      if (ratio < bestRatio) { bestRatio = ratio; best = e; }
    }
    return best;
  }

  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiCharger(dt,player,map,d,los) {
    this._chgCooldown = Math.max(0, (this._chgCooldown || 0) - dt);
    const bm = this.berserkerMul();

    // ── Charging state: rush in locked direction ──
    if (this._chgState === 'charging') {
      this._chgDur -= dt;
      const cspd = 5.5 * bm;
      const nx = this.x + this._chgDx * cspd * dt;
      const ny = this.y + this._chgDy * cspd * dt;
      const fx = Math.floor(nx), fy = Math.floor(this.y);
      const xf = Math.floor(this.x), yf = Math.floor(ny);
      let hitWall = false;
      if (fx >= 0 && fy >= 0 && fx < MAP_W && fy < MAP_H && isPassable(map[fy][fx])) { this.x = nx; }
      else hitWall = true;
      if (xf >= 0 && yf >= 0 && xf < MAP_W && yf < MAP_H && isPassable(map[yf][xf])) { this.y = ny; }
      else hitWall = true;

      // Hit check: damage player within 1.2 tiles during charge
      if (dist(this.x, this.y, player.x, player.y) < 1.2 && this._canTarget()) {
        const dealt = player.takeDamage(Math.round(this.atk * 1.5), this.type);
        if (dealt > 0) {
          const [kx, ky] = norm(player.x - this.x, player.y - this.y);
          // Wall-aware knockback: check each axis independently
          // Wall-aware knockback: check each axis independently
          const nx = player.x + kx * 2, ny = player.y + ky * 2;
          const fxK = Math.floor(nx), fyK = Math.floor(player.y);
          const xfK = Math.floor(player.x), yfK = Math.floor(ny);
          if (fxK >= 0 && fxK < MAP_W && fyK >= 0 && fyK < MAP_H && isPassable(map[fyK][fxK])) player.x = nx;
          if (xfK >= 0 && xfK < MAP_W && yfK >= 0 && yfK < MAP_H && isPassable(map[yfK][xfK])) player.y = ny;
          spawnParticles(player.x, player.y, 'SPARK', '#ff6600', 8);
          triggerShake(5, 0.15);
          audio.chargerImpact();
        }
        this._chgState = 'idle';
        this._chgCooldown = Math.max(2.5, 3.5 - (_EG.floor || 1) * 0.1) / (_EG.modifier === 'OVERCLOCK' ? 1.2 : 1);
        return;
      }

      // Wall collision or duration expired → stunned
      if (hitWall || this._chgDur <= 0) {
        if (hitWall) {
          spawnParticles(this.x, this.y, 'SPARK', '#ff6600', 6);
          triggerShake(3, 0.1);
          audio.chargerImpact();
          // Smash crates on impact
          if (fx >= 0 && fx < MAP_W && fy >= 0 && fy < MAP_H && map[fy]?.[fx] === T.CRATE) damageCrateAtTile(fx, fy, Math.round(this.atk * 1.5));
          if (xf >= 0 && xf < MAP_W && yf >= 0 && yf < MAP_H && map[yf]?.[xf] === T.CRATE) damageCrateAtTile(xf, yf, Math.round(this.atk * 1.5));
        }
        this._chgState = 'idle';
        this.stunTimer = Math.max(this.stunTimer, 1.0);
        this._chgCooldown = Math.max(2.5, 3.5 - (_EG.floor || 1) * 0.1) / (_EG.modifier === 'OVERCLOCK' ? 1.2 : 1);
        return;
      }

      // Charge trail particles
      if (Math.random() < dt * 20) spawnParticles(this.x, this.y, 'SPARK', '#ff6600', 1);
      return;
    }

    // ── Windup state: telegraph before charging ──
    if (this._chgState === 'windup') {
      if (!los || !this._canTarget()) {
        this._chgState = 'idle';
        this._chgCooldown = 1.0;
        return;
      }
      this._chgWindup -= dt;
      if (Math.random() < dt * 10) spawnParticles(this.x, this.y, 'SPARK', '#ff6600', 1);
      if (this._chgWindup <= 0) {
        this._chgState = 'charging';
        this._chgDur = 0.4;
        audio.chargerWindup();
      }
      return;
    }

    // ── Idle state: patrol, approach, or initiate charge ──
    if (los && d < 2) {
      // Point-blank: melee attack, don't charge
      this.moveToward(this._tx, this._ty, this.spd, dt, map);
      if (d < 1.2) {
        this.meleeAttack(player);
        this._chgCooldown = Math.max(this._chgCooldown, 1.5);
      }
    } else if (los && d >= 3 && d <= 10 && this._chgCooldown <= 0) {
      // In charge range — begin windup
      const [dx, dy] = norm(this._tx - this.x, this._ty - this.y);
      this._chgDx = dx; this._chgDy = dy;
      this._chgState = 'windup';
      this._chgWindup = 0.6;
    } else if (los && d < 8) {
      // Too close for charge or on cooldown — approach
      this.moveToward(this._tx, this._ty, this.spd, dt, map);
      if (d < 1.2) this.meleeAttack(player);
    } else {
      this.patrol(dt, map);
    }
  }

  // ─── LEAPER AI ─────────────────────────────────────────────────────────────
  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiLeaper(dt,player,map,d,los) {
    this._lpCooldown = Math.max(0, (this._lpCooldown || 0) - dt);

    // ── Recovery: vulnerable after landing ──
    if (this._lpState === 'recovery') {
      this._lpRecovery -= dt;
      if (this._lpRecovery <= 0) {
        this._lpState = 'idle';
        this._lpCooldown = Math.max(2.0, 3.0 - (_EG.floor || 1) * 0.1);
      }
      return;
    }

    // ── Airborne: lerp to locked target position ──
    if (this._lpState === 'airborne') {
      this._lpAirTime -= dt;
      const t = 1 - Math.max(0, this._lpAirTime) / 0.35;
      this.x = this._lpFromX + (this._lpTargetX - this._lpFromX) * t;
      this.y = this._lpFromY + (this._lpTargetY - this._lpFromY) * t;
      // Parabolic height for visual (stored for draw, not real position)
      this._lpHeight = 4 * t * (1 - t) * 1.5; // peak at 1.5 tiles height

      if (this._lpAirTime <= 0) {
        // Land at target
        this.x = this._lpTargetX;
        this.y = this._lpTargetY;
        this._lpHeight = 0;
        this._lpState = 'recovery';
        this._lpRecovery = 1.0;
        audio.leaperLand();
        spawnParticles(this.x, this.y, 'EXPLOSION', '#22ff88', 14);
        triggerShake(4, 0.15);

        // Shockwave: 2-tile radius, LOS-gated, damages player + env
        const shockR = 2;
        const shockDmg = Math.round(this.atk * 1.2);
        if (dist(this.x, this.y, player.x, player.y) < shockR && this._canTarget() &&
            hasLOS(this.x, this.y, player.x, player.y, map)) {
          player.takeDamage(shockDmg, 'Leaper Shockwave');
        }
        // Environmental damage via proper helpers (handle destruction + rewards)
        if (typeof damageCratesInRadius === 'function') damageCratesInRadius(this.x, this.y, shockR, shockDmg, map);
        primeVCoresInRadius(this.x, this.y, shockR, map);
        damageBeaconsInRadius(this.x, this.y, shockR, shockDmg, map);
        damageShieldGensInRadius(this.x, this.y, shockR, shockDmg, map);
        damageCamerasInRadius(this.x, this.y, shockR, shockDmg, map);
        damageLasersInRadius(this.x, this.y, shockR, shockDmg, map);
        damageWallTurretsInRadius(this.x, this.y, shockR, shockDmg, map);
        // Trigger nearby mines
        for (const m of mines) {
          if (m.dead || m.state === 'detonated') continue;
          if (dist(this.x, this.y, m.x, m.y) < shockR) {
            m.state = 'armed';
            m.fuse = 0.1;
          }
        }
      }
      return;
    }

    // ── Windup: telegraph before jump ──
    if (this._lpState === 'windup') {
      if (!los || !this._canTarget()) {
        this._lpState = 'idle';
        this._lpCooldown = 1.0;
        return;
      }
      this._lpWindup -= dt;
      if (Math.random() < dt * 12) spawnParticles(this.x, this.y, 'SPARK', '#22ff88', 1);
      if (this._lpWindup <= 0) {
        // Validate landing tile: must be passable and have LOS from current pos
        const tx = Math.floor(this._lpTargetX), ty = Math.floor(this._lpTargetY);
        if (tx >= 0 && tx < MAP_W && ty >= 0 && ty < MAP_H &&
            isPassable(map[ty][tx]) && hasLOS(this.x, this.y, this._lpTargetX, this._lpTargetY, map)) {
          this._lpState = 'airborne';
          this._lpAirTime = 0.35;
          this._lpFromX = this.x;
          this._lpFromY = this.y;
          this._lpHeight = 0;
          audio.leaperWindup();
        } else {
          // Invalid target — cancel
          this._lpState = 'idle';
          this._lpCooldown = 1.0;
        }
      }
      return;
    }

    // ── Idle: patrol, approach, or initiate leap ──
    if (this.stunTimer > 0) return; // stun prevents leap initiation
    if (los && d >= 3 && d <= 10 && this._lpCooldown <= 0) {
      // Check no other leaper is already airborne/winding up (scoped to room)
      let anotherLeaping = false;
      for (const e of enemiesInRoomIter(this.room)) {
        if (e === this || e.dead || e.type !== 'LEAPER') continue;
        if (e._lpState === 'windup' || e._lpState === 'airborne') { anotherLeaping = true; break; }
      }
      if (!anotherLeaping) {
        this._lpState = 'windup';
        this._lpWindup = 0.5;
        this._lpTargetX = this._tx;
        this._lpTargetY = this._ty;
        return;
      }
    }
    if (los && d < 6) {
      this.moveToward(this._tx, this._ty, this.spd, dt, map);
      if (d < 1.2) this.meleeAttack(player);
    } else {
      this.patrol(dt, map);
    }
  }

  // ─── SEEKER AI — Guided Explosive Drone ───────────────────────────────────
  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiSeeker(dt, player, map, d, los) {
    // Proximity glow ramp (used by draw)
    this._skProximity = los ? Math.max(0, 1 - d / 6) : 0;

    if (los && this._canTarget() && d <= 1.2 && player.dashTimer <= 0) {
      // Detonate on contact
      this._seekerDetonate(player, map);
      return;
    }

    if (los && this._canTarget()) {
      // Rush directly toward player at full speed
      this.moveToward(this._tx, this._ty, this.spd, dt, map);
      // Trail particles — intensity ramps with proximity
      if (Math.random() < dt * (6 + this._skProximity * 12))
        spawnParticles(this.x, this.y, 'SPARK', '#ffdd00', 1);
    } else {
      this.patrol(dt, map);
    }
  }

  /**
   * @param {any} [player]
   * @param {any} [map]
   */
  _seekerDetonate(player, map) {
    if (this.dead) return;
    const r = 2;
    const dmg = Math.round(this.atk * 1.5);
    // Visual + audio
    spawnParticles(this.x, this.y, 'EXPLOSION', '#ffdd00', 22);
    spawnParticles(this.x, this.y, 'EXPLOSION', '#ff8800', 10);
    triggerShake(6, 0.2);
    audio.seekerDetonate();
    // Damage player (LOS-gated)
    if (dist(player.x, player.y, this.x, this.y) < r && hasLOS(this.x, this.y, player.x, player.y, map)) {
      player.takeDamage(dmg, 'Seeker Blast');
    }
    // Damage other enemies
    for (const e of enemies) {
      if (e === this || e.dead) continue;
      if (e._wrPhased) continue;
      if (dist(e.x, e.y, this.x, this.y) < r && hasLOS(this.x, this.y, e.x, e.y, map)) {
        e.takeDamage(dmg, 'Seeker Blast');
      }
    }
    // Chain to env entities
    primeVCoresInRadius(this.x, this.y, r, map);
    damageCratesInRadius(this.x, this.y, r, dmg, map);
    damageBeaconsInRadius(this.x, this.y, r, dmg, map);
    damageShieldGensInRadius(this.x, this.y, r, dmg, map);
    damageCamerasInRadius(this.x, this.y, r, dmg, map);
    damageLasersInRadius(this.x, this.y, r, dmg, map);
    damageWallTurretsInRadius(this.x, this.y, r, dmg, map);
    triggerMinesInRadius(this.x, this.y, r, map);
    // Kill self (normal death path for XP/credits/drops/VOLATILE)
    this.hp = 0;
    this.die();
  }

  // ─── PULSER AI ────────────────────────────────────────────────────────────
  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiPulser(dt, player, map, d, los) {
    const ocMul = _EG.modifier === 'OVERCLOCK' ? 1.2 : 1;
    const chargeRange = 6;

    // ── Idle: patrol or approach ──
    if (this._plState === 'idle') {
      this._plCooldown = Math.max(0, (this._plCooldown || 0) - dt);
      if (los && this._canTarget() && d < chargeRange && this._plCooldown <= 0) {
        this._plState = 'charging';
        this._plTimer = 1.0;
        const [dx, dy] = norm(this._tx - this.x, this._ty - this.y);
        this._plAimDx = dx; this._plAimDy = dy;
        audio.pulserCharge();
        return;
      }
      if (los && this._canTarget() && d < chargeRange + 4) {
        this.moveToward(this._tx, this._ty, this.spd, dt, map);
      } else {
        this.patrol(dt, map);
      }
      return;
    }

    // ── Charging: face player, count down, fire on completion ──
    if (this._plState === 'charging') {
      // Cancel if LOS lost, player fled range, or cloaked
      if (!los || !this._canTarget() || d > chargeRange + 2) {
        this._plState = 'idle';
        this._plCooldown = 0.8;
        return;
      }
      // Track player during charge
      const [dx, dy] = norm(this._tx - this.x, this._ty - this.y);
      this._plAimDx = dx; this._plAimDy = dy;
      this._plTimer -= dt * ocMul;
      if (this._plTimer <= 0) {
        // Fire heavy bolt
        const p = new Projectile(this.x, this.y, this._plAimDx, this._plAimDy,
          10, this.atk, 14, this.colour, false, false);
        p.ownerType = 'Pulser Bolt';
        projectiles.push(p);
        audio.pulserFire();
        spawnParticles(this.x, this.y, 'MUZZLE', this.colour, 4);
        this._plState = 'cooldown';
        this._plTimer = 2.5 / ocMul;
      }
      return;
    }

    // ── Cooldown: retreat slowly, then return to idle ──
    if (this._plState === 'cooldown') {
      this._plTimer -= dt;
      // Retreat from player at half speed (axis-by-axis wall-safe)
      if (d < chargeRange && this._canTarget()) {
        const [fx, fy] = norm(this.x - this._tx, this.y - this._ty);
        const rSpd = modSpeed(this.spd * 0.5) * this.slowFactor * (hasAugment('TEMPORAL_DILATION') ? 0.85 : 1);
        const nx = this.x + fx * rSpd * dt;
        const ny = this.y + fy * rSpd * dt;
        const fxI = Math.floor(nx), fyI = Math.floor(this.y);
        const xfI = Math.floor(this.x), yfI = Math.floor(ny);
        if (fxI >= 0 && fyI >= 0 && fxI < MAP_W && fyI < MAP_H && isPassable(map[fyI][fxI])) this.x = nx;
        if (xfI >= 0 && xfI < MAP_W && yfI >= 0 && yfI < MAP_H && isPassable(map[yfI][xfI])) this.y = ny;
      }
      if (this._plTimer <= 0) {
        this._plState = 'idle';
        this._plCooldown = 0;
      }
      return;
    }
  }

  // ─── MIMIC AI ──────────────────────────────────────────────────────────────
  /**
   * @param {any} [player]
   */
  revealMimic(player) {
    if (!this._disguised) return;
    this._disguised = false;
    this._revealTimer = 0.3;
    audio.mimicReveal();
    spawnParticles(this.x, this.y, 'EXPLOSION', '#cc33ff', 18);
    triggerShake(4, 0.15);
    _EG.msg('⚠ MIMIC!', '#cc33ff');
    // Lock lunge direction toward perceived target
    const [dx, dy] = norm(this._tx - this.x, this._ty - this.y);
    this._mimicLungeDx = dx;
    this._mimicLungeDy = dy;
  }

  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiMimic(dt, player, map, d, los) {
    // Reveal telegraph: expanding ring, no AI yet
    if (this._revealTimer > 0) {
      this._revealTimer -= dt;
      if (this._revealTimer <= 0) {
        // Lunge attack toward player position at reveal
        this._mimicBurstTimer = 3.0;
        if (d < 2.5 && this._canTarget()) {
          this.meleeAttack(player);
        }
      }
      return;
    }

    // Disguised: bob like an item, check proximity
    if (this._disguised) {
      this._mimicBob += dt * 2;
      if (d < 1.5) this.revealMimic(player);
      return;
    }

    // Combat: fast melee chase (burst speed decays over 3s)
    this._mimicBurstTimer = Math.max(0, (this._mimicBurstTimer || 0) - dt);
    const burstMul = this._mimicBurstTimer > 0 ? 1.0 + 0.36 * (this._mimicBurstTimer / 3.0) : 1.0;
    const spd = this.spd * burstMul;

    if (los || (d < 8 && this._canTarget())) {
      this.zigzag += dt * 5;
      const [dx, dy] = norm(this._tx - this.x, this._ty - this.y);
      const perp = { x: -dy, y: dx };
      const tx = this._tx + perp.x * Math.sin(this.zigzag) * 1.2;
      const ty = this._ty + perp.y * Math.sin(this.zigzag) * 1.2;
      this.moveToward(tx, ty, spd, dt, map);
      if (d < 1.2) this.meleeAttack(player);
    } else {
      this.patrol(dt, map);
    }
  }

  // ── NEXUS: Neural Command Node — links to nearby allies, buffing with DR ──
  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiNexus(dt, player, map, d, los) {
    const bm = this.berserkerMul();
    // Update links every 0.5s
    this._nxLinkTimer = Math.max(0, (this._nxLinkTimer || 0) - dt);
    if (this._nxLinkTimer <= 0) {
      this._nxUpdateLinks();
      this._nxLinkTimer = 0.5;
    }
    // Fire rate scales with link count: 2.0s base → 1.0s with 3 links
    this._nxFireTimer = Math.max(0, (this._nxFireTimer || 0) - dt);
    const linkCount = this._nxLinks ? this._nxLinks.length : 0;
    const fireInterval = Math.max(1.0, 2.0 - linkCount * 0.33) / (_EG.modifier === 'OVERCLOCK' ? 1.2 : 1) / bm;

    if (los && d < 4) {
      // Too close — retreat toward nearest ally cluster
      const ally = this._nxFindAllyCluster();
      let tx, ty;
      if (ally) {
        tx = ally.x; ty = ally.y;
      } else {
        tx = this.x + (this.x - this._tx);
        ty = this.y + (this.y - this._ty);
      }
      this.moveToward(tx, ty, this.spd, dt, map);
    } else if (los && d <= 10) {
      // In range — fire at player
      if (this._nxFireTimer <= 0) {
        this.fireAt(this._tx, this._ty, 6, this.atk, 12, '#00eedd');
        this._nxFireTimer = fireInterval;
      }
      // Drift toward ally cluster to maintain links
      const ally = this._nxFindAllyCluster();
      if (ally && dist(this.x, this.y, ally.x, ally.y) > 3) {
        this.moveToward(ally.x, ally.y, this.spd * 0.4, dt, map);
      }
    } else if (d > 10 && los) {
      this.moveToward(this._tx, this._ty, this.spd * 0.5, dt, map);
    } else {
      this.patrol(dt, map);
    }
  }

  _nxUpdateLinks() {
    if (!this._nxLinks) this._nxLinks = [];
    const oldLinks = this._nxLinks;
    // If stunned, all links break
    if (this.stunTimer > 0) {
      for (const e of oldLinks) { if (e && !e.dead) e._nxBoosted = false; }
      this._nxLinks = [];
      return;
    }
    // Find up to 3 closest valid allies within 5 tiles (scoped to room)
    const candidates = [];
    for (const e of enemiesInRoomIter(this.room)) {
      if (e === this || e.dead || e.isBoss) continue;
      if (e.type === 'NEXUS') continue;
      if (e._wrPhased) continue;
      if (e._disguised) continue;
      if (e.type === 'PHANTOM' && !e.visible) continue;
      const ed = dist(this.x, this.y, e.x, e.y);
      if (ed > 5) continue;
      candidates.push({ e, d: ed });
    }
    candidates.sort((a, b) => a.d - b.d);
    // Keep existing links if still valid (within 7-tile break range), fill up to 3
    const kept = [];
    for (const linked of oldLinks) {
      if (linked.dead || dist(this.x, this.y, linked.x, linked.y) > 7) continue;
      if (linked._wrPhased || linked._disguised) continue;
      if (linked.type === 'PHANTOM' && !linked.visible) continue;
      if (linked.room !== this.room) continue;
      kept.push(linked);
    }
    // Add new links from candidates
    const MAX_LINKS = 3;
    for (const c of candidates) {
      if (kept.length >= MAX_LINKS) break;
      if (!kept.includes(c.e)) kept.push(c.e);
    }
    // Clear boost on enemies no longer linked
    for (const e of oldLinks) {
      if (e && !e.dead && !kept.includes(e)) e._nxBoosted = false;
    }
    this._nxLinks = kept;
    // Apply boost flag; audio only on newly formed links
    for (const e of this._nxLinks) {
      if (!e._nxBoosted) audio.nexusLink();
      e._nxBoosted = true;
    }
  }

  _nxFindAllyCluster() {
    let best = null, bestCount = 0;
    const roomEnemies = enemiesInRoomIter(this.room);
    for (const e of roomEnemies) {
      if (e === this || e.dead) continue;
      if (e.isBoss || e._wrPhased || e._disguised) continue;
      let nearby = 0;
      for (const o of roomEnemies) {
        if (o === e || o === this || o.dead) continue;
        if (dist(e.x, e.y, o.x, o.y) < 4) nearby++;
      }
      if (nearby > bestCount) { bestCount = nearby; best = e; }
    }
    return best;
  }

  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiSiphon(dt, player, map, d, los) {
    const bm = this.berserkerMul();
    // Frenzy latch: once below 40% HP, permanently activated
    if (!this._spFrenzy && this.hp < this.maxHp * 0.4) {
      this._spFrenzy = true;
      audio.siphonFrenzy();
      spawnParticles(this.x, this.y, 'SPARK', '#dd2244', 12);
    }
    const fireInterval = (this._spFrenzy ? 1.0 : 2.0) / (_EG.modifier === 'OVERCLOCK' ? 1.2 : 1) / bm;
    this._spFireTimer = Math.max(0, (this._spFireTimer || 0) - dt);
    // Drain beam fade
    if (this._spDrainBeam) {
      this._spDrainBeam.t -= dt;
      if (this._spDrainBeam.t <= 0) this._spDrainBeam = null;
    }

    if (los && d < 4) {
      // Too close — retreat
      this.moveToward(this.x + (this.x - this._tx), this.y + (this.y - this._ty), this.spd, dt, map);
    } else if (los && d <= 9) {
      // In range — fire drain projectile
      if (this._spFireTimer <= 0) {
        this.fireAt(this._tx, this._ty, 7, this.atk, 12, '#dd2244');
        this._spFireTimer = fireInterval;
      }
    } else if (los && d > 9) {
      this.moveToward(this._tx, this._ty, this.spd * 0.6, dt, map);
    } else {
      this.patrol(dt, map);
    }
  }

  // ── GRAVITON: Gravity Manipulation — deploys wells that pull the player ──
  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiGraviton(dt, player, map, d, los) {
    // Prune dead well refs
    this._gvWells = this._gvWells.filter((/** @type {any} */ w) => w && !w.dead);
    this._gvDeployTimer = Math.max(0, this._gvDeployTimer - dt);
    this._gvFireTimer = Math.max(0, this._gvFireTimer - dt);
    const bm = this.berserkerMul();
    const spd = modSpeed(this.spd) * this.slowFactor * bm * (hasAugment('TEMPORAL_DILATION') ? 0.85 : 1);

    if (los && d < 5) {
      // Too close — retreat
      const [dx, dy] = norm(this.x - this._tx, this.y - this._ty);
      const nx = this.x + dx * spd * dt;
      const ny = this.y + dy * spd * dt;
      const fx = Math.floor(nx), fy = Math.floor(this.y);
      const xf = Math.floor(this.x), yf = Math.floor(ny);
      let moved = false;
      if (fx >= 0 && fy >= 0 && fx < MAP_W && fy < MAP_H && isPassable(map[fy][fx])) { this.x = nx; moved = true; }
      if (xf >= 0 && yf >= 0 && xf < MAP_W && yf < MAP_H && isPassable(map[yf][xf])) { this.y = ny; moved = true; }
      if (!moved) this.patrol(dt, map);
    } else if (los && d <= 10) {
      this.state = 'ATTACK';
      // Deploy gravity well near player (priority — gravitational, ignores cloak)
      if (this._gvDeployTimer <= 0 && d > 3) {
        const ox = (Math.random() - 0.5) * 2;
        const oy = (Math.random() - 0.5) * 2;
        const wx = this._tx + ox, wy = this._ty + oy;
        const tx = Math.floor(wx), ty = Math.floor(wy);
        if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H && isPassable(map[ty][tx])) {
          // If at cap, remove oldest
          if (this._gvWells.length >= 2) {
            this._gvWells[0].dead = true;
            this._gvWells.shift();
          }
          // Derive room from well position (not owner) to handle cross-room LOS
          const wellRoom = _EG.dungeon?.rooms?.find((/** @type {any} */ r) =>
            wx >= r.x && wx < r.x + r.w && wy >= r.y && wy < r.y + r.h) || null;
          const well = { x: wx, y: wy, owner: this, timer: 0, maxTimer: 4, radius: 2.5, dead: false, room: wellRoom };
          gravityWells.push(well);
          this._gvWells.push(well);
          audio.gravitonDeploy();
          spawnParticles(wx, wy, 'EXPLOSION', '#8833ff', 10);
          this._gvDeployTimer = 5.0 / bm;
        }
      }
      // Secondary ranged attack
      else if (this._gvFireTimer <= 0 && this._canTarget()) {
        this.fireAt(this._tx, this._ty, 6, this.atk, 10, this.colour);
        this._gvFireTimer = 3.0 / bm;
      }
    } else if (los && d > 10) {
      this.moveToward(this._tx, this._ty, this.spd * 0.6, dt, map);
    } else {
      this.patrol(dt, map);
    }
  }

  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiBossSentinel(dt,player,map,d,los) {
    const hpPct = this.hp / this.maxHp;
    this.phase = hpPct <= 0.33 ? 2 : 1;
    if (this.phase!==this.prevPhase) {
      spawnParticles(this.x,this.y,'EXPLOSION',this.colour,20);
      audio.phaseShift();
      _EG.msg('⚠ SENTINEL PHASE 2','#ff4444');
      this.prevPhase=this.phase;
    }

    this.bossTimers.laser=(this.bossTimers.laser||0)-dt;
    this.bossTimers.move=(this.bossTimers.move||0)-dt;
    this.bossTimers.shield=(this.bossTimers.shield||0)-dt;
    this.bossTimers.track=(this.bossTimers.track||0)-dt;

    if (this.bossTimers.move<=0) {
      if (this.room) {
        this.patrolTarget={x:this.room.cx+rnd(-5,5),y:this.room.cy+rnd(-5,5)};
      }
      this.bossTimers.move=2;
    }
    if (this.patrolTarget) this.moveToward(this.patrolTarget.x,this.patrolTarget.y,2,dt,map);

    const rate=this.phase===2?2:3;
    if (this.bossTimers.laser<=0) {
      for (let i=0;i<(this.phase===2?8:5);i++) {
        const a=(i/(this.phase===2?8:5))*TWO_PI;
        const bp=new Projectile(this.x,this.y,Math.cos(a),Math.sin(a),7,this.atk,14,'#ff4444',false,false);
        bp.ownerType='SENTINEL'; projectiles.push(bp);
      }
      audio.shoot(false);
      this.bossTimers.laser=rate;
    }

    // Tracking shot: aimed projectile at player (both phases)
    if (this.bossTimers.track<=0 && los) {
      this.fireAt(player.x,player.y,8,this.atk+3,16,'#ff6666');
      this.bossTimers.track=this.phase===2?2.5:4;
    }

    if (this.phase===2 && this.bossTimers.shield<=0) {
      const [dx,dy]=norm(player.x-this.x,player.y-this.y);
      player.x-=dx*3*playerKnockMul(); player.y-=dy*3*playerKnockMul();
      clampToBossRoom(player);
      player.takeDamage(Math.round(20*getDiff().enemyAtk), 'SENTINEL');
      spawnParticles(player.x,player.y,'EXPLOSION','#ff4444',8);
      this.bossTimers.shield=5;
    }
  }

  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiBossWarden(dt,player,map,d,los) {
    const hpPct = this.hp / this.maxHp;
    this.phase = hpPct <= 0.4 ? 2 : 1;

    if (this.phase !== this.prevPhase) {
      spawnParticles(this.x, this.y, 'EXPLOSION', this.colour, 20);
      audio.phaseShift();
      _EG.msg('⚠ WARDEN PHASE 2', '#ff8800');
      this.prevPhase = this.phase;
    }

    const T = this.bossTimers;
    T.charge = (T.charge || 0) - dt;
    T.slam   = (T.slam   || 0) - dt;
    T.stomp  = (T.stomp  || 0) - dt;
    T.move   = (T.move   || 0) - dt;

    // Charge wind-up → charge → recovery
    if (this._chargeState === 'windup') {
      // Cancel wind-up if player cloaks or LOS breaks
      if (!los) {
        this._chargeState = 'idle';
        T.charge = 1.5;
      } else {
        this._chargeWindup -= dt;
        if (this._chargeWindup <= 0) {
          this._chargeState = 'charging';
          this._chargeDur = 0.3;
          audio.wardenCharge();
        }
      }
    } else if (this._chargeState === 'charging') {
      this._chargeDur -= dt;
      const cspd = this.spd * 3;
      this.x += this._chargeDx * cspd * dt;
      this.y += this._chargeDy * cspd * dt;
      // Clamp to room
      if (this.room) {
        this.x = Math.max(this.room.x + 0.5, Math.min(this.room.x + this.room.w - 0.5, this.x));
        this.y = Math.max(this.room.y + 0.5, Math.min(this.room.y + this.room.h - 0.5, this.y));
      }
      // Hit check: damage player if within 1.5 tiles during charge
      if (dist(this.x, this.y, player.x, player.y) < 1.5) {
        player.takeDamage(Math.round(this.atk * getDiff().enemyAtk), 'WARDEN');
        const [kx, ky] = norm(player.x - this.x, player.y - this.y);
        player.x += kx * 2 * playerKnockMul(); player.y += ky * 2 * playerKnockMul();
        clampToBossRoom(player);
        spawnParticles(player.x, player.y, 'SPARK', '#ff8800', 6);
        triggerShake(4, 0.15);
        this._chargeState = 'idle';
        T.charge = this.phase === 2 ? 2.5 : 3.5;
      } else if (this._chargeDur <= 0) {
        // Charge ended without hitting — spark burst at endpoint
        const missCount = this.phase === 2 ? 6 : 4;
        for (let i = 0; i < missCount; i++) {
          const a = (i / missCount) * TWO_PI;
          const bp = new Projectile(this.x, this.y, Math.cos(a), Math.sin(a), 5, Math.round(this.atk * 0.6), 8, '#ff8800', false, false);
          bp.ownerType = 'WARDEN'; projectiles.push(bp);
        }
        spawnParticles(this.x, this.y, 'SPARK', '#ff8800', 8);
        triggerShake(4, 0.15);
        this._chargeState = 'idle';
        T.charge = this.phase === 2 ? 2.5 : 3.5;
      }
    } else {
      // Idle — pursue player or initiate charge
      if (T.charge <= 0 && los) {
        // Begin wind-up
        const [dx, dy] = norm(player.x - this.x, player.y - this.y);
        this._chargeDx = dx; this._chargeDy = dy;
        this._chargeState = 'windup';
        this._chargeWindup = this.phase === 2 ? 0.45 : 0.6;
        T.charge = 99;
      } else if (los) {
        this.moveToward(player.x, player.y, this.spd, dt, map);
      } else {
        if (T.move <= 0) {
          if (this.room) this.patrolTarget = {x: this.room.cx + rnd(-4, 4), y: this.room.cy + rnd(-4, 4)};
          T.move = 2;
        }
        if (this.patrolTarget) this.moveToward(this.patrolTarget.x, this.patrolTarget.y, this.spd * 0.7, dt, map);
      }
    }

    // Radial stomp: close-range burst when player is nearby (both phases)
    if (T.stomp <= 0 && d < 3 && this._chargeState === 'idle') {
      const stompCount = this.phase === 2 ? 6 : 4;
      for (let i = 0; i < stompCount; i++) {
        const a = (i / stompCount) * TWO_PI;
        const bp = new Projectile(this.x, this.y, Math.cos(a), Math.sin(a), 4, Math.round(this.atk * 0.5), 6, '#ff8800', false, false);
        bp.ownerType = 'WARDEN'; projectiles.push(bp);
      }
      spawnParticles(this.x, this.y, 'SPARK', '#ff8800', 6);
      triggerShake(3, 0.1);
      T.stomp = this.phase === 2 ? 4 : 6;
    }

    // Phase 2: Ground slam when player is close
    if (this.phase === 2 && T.slam <= 0 && d < 4 && this._chargeState === 'idle') {
      audio.wardenSlam();
      triggerShake(6, 0.2);
      const [kx, ky] = norm(player.x - this.x, player.y - this.y);
      player.x += kx * 3 * playerKnockMul(); player.y += ky * 3 * playerKnockMul();
      clampToBossRoom(player);
      player.takeDamage(Math.round(22 * getDiff().enemyAtk), 'Warden Slam');
      // Radial spark projectiles
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TWO_PI;
        const bp = new Projectile(this.x, this.y, Math.cos(a), Math.sin(a), 4, Math.round(this.atk * 0.5), 6, '#ff8800', false, false);
        bp.ownerType = 'WARDEN'; projectiles.push(bp);
      }
      spawnParticles(this.x, this.y, 'EXPLOSION', '#ff8800', 15);
      T.slam = 5;
    }
  }

  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiBossHive(dt,player,map,d,los) {
    const hpPct = this.hp / this.maxHp;
    this.phase = hpPct <= 0.30 ? 3 : hpPct <= 0.70 ? 2 : 1;

    if (this.phase!==this.prevPhase) {
      spawnParticles(this.x,this.y,'EXPLOSION',this.colour,20);
      audio.phaseShift();
      _EG.msg('⚠ HIVE PHASE '+this.phase,'#aa00ff');
      this.prevPhase=this.phase;
    }

    this.bossTimers.homing=(this.bossTimers.homing||0)-dt;
    this.bossTimers.spawn=(this.bossTimers.spawn||0)-dt;
    this.bossTimers.shock=(this.bossTimers.shock||0)-dt;
    this.bossTimers.swarm=(this.bossTimers.swarm||0)-dt;
    this.bossTimers.move=(this.bossTimers.move||0)-dt;

    if (this.bossTimers.move<=0) {
      if (this.room) this.patrolTarget={x:this.room.x+rnd(2,this.room.w-2),y:this.room.y+rnd(2,this.room.h-2)};
      this.bossTimers.move=3;
    }
    if (this.patrolTarget) this.moveToward(this.patrolTarget.x,this.patrolTarget.y,1.5,dt,map);

    if (this.bossTimers.homing<=0) {
      this.fireAt(player.x,player.y,6,this.atk,18,'#aa00ff');
      this.bossTimers.homing=2;
    }

    if (this.phase>=2 && this.bossTimers.spawn<=0 && this.spawnCooldown<=0) {
      for (let i=0;i<2;i++) {
        const cr=spawnEnemy('CRAWLER',this.x+rnd(-2,2),this.y+rnd(-2,2),_EG.floor,this.room,false);
        enemies.push(cr);
      }
      this.bossTimers.spawn=5;
      this.spawnCooldown=1;
    }

    // Swarm cloud: burst of slow aimed projectiles (Phase 2+)
    if (this.phase>=2 && this.bossTimers.swarm<=0 && los) {
      const count = this.phase === 3 ? 5 : 3;
      for (let i=0; i<count; i++) {
        const spread = (i - Math.floor(count/2)) * 0.25;
        const [dx,dy]=norm(player.x-this.x,player.y-this.y);
        const a = Math.atan2(dy,dx) + spread;
        const bp=new Projectile(this.x,this.y,Math.cos(a),Math.sin(a),3.5,Math.round(this.atk*0.7),12,'#cc66ff',false,false);
        bp.ownerType='HIVE'; projectiles.push(bp);
      }
      spawnParticles(this.x,this.y,'SPARK','#cc66ff',6);
      this.bossTimers.swarm=this.phase===3?3.5:5;
    }

    if (this.phase===3 && this.bossTimers.shock<=0) {
      if (dist(_EG.player.x,_EG.player.y,this.x,this.y)<10) {
        _EG.player.takeDamage(Math.round(25*getDiff().enemyAtk), 'HIVE');
        spawnParticles(this.x,this.y,'EXPLOSION','#aa00ff',15);
      }
      this.bossTimers.shock=4;
    }
  }

  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiBossConductor(dt,player,map,d,los) {
    const hpPct = this.hp / this.maxHp;
    this.phase = hpPct <= 0.25 ? 3 : hpPct <= 0.55 ? 2 : 1;

    if (this.phase !== this.prevPhase) {
      spawnParticles(this.x, this.y, 'EXPLOSION', this.colour, 20);
      audio.phaseShift();
      _EG.msg('⚠ CONDUCTOR PHASE ' + this.phase, '#00ccff');
      this.prevPhase = this.phase;
    }

    const T = this.bossTimers;
    T.arc      = (T.arc      || 0) - dt;
    T.hazard   = (T.hazard   || 0) - dt;
    T.beam     = (T.beam     || 0) - dt;
    T.discharge= (T.discharge|| 0) - dt;
    T.move     = (T.move     || 0) - dt;

    // Movement: drift toward room center in P1, pursue player in P2+
    if (T.move <= 0) {
      if (this.phase >= 2 && los) {
        this.patrolTarget = {x: player.x, y: player.y};
      } else if (this.room) {
        this.patrolTarget = {x: this.room.cx + rnd(-3, 3), y: this.room.cy + rnd(-3, 3)};
      }
      T.move = this.phase >= 2 ? 2 : 3;
    }
    if (this.patrolTarget) this.moveToward(this.patrolTarget.x, this.patrolTarget.y, this.phase >= 2 ? this.spd : this.spd * 0.6, dt, map);

    // Radial arc burst
    const arcCount = this.phase >= 2 ? 12 : 8;
    const arcCD = this.phase === 3 ? 2.5 : this.phase === 2 ? 3 : 3.5;
    if (T.arc <= 0) {
      audio.conductorArc();
      for (let i = 0; i < arcCount; i++) {
        const a = (i / arcCount) * TWO_PI + (this._arcSpin || 0);
        const bp = new Projectile(this.x, this.y, Math.cos(a), Math.sin(a), 5, Math.round(this.atk * 0.8), 10, '#00ccff', false, false);
        bp.ownerType = 'CONDUCTOR'; projectiles.push(bp);
      }
      this._arcSpin = ((this._arcSpin || 0) + 0.3) % TWO_PI;
      spawnParticles(this.x, this.y, 'SPARK', '#00ccff', 6);
      T.arc = arcCD;
    }

    // Electric hazard zones — placed away from player to be readable
    const hazCount = this.phase >= 2 ? 2 : 1;
    const hazCD = this.phase === 3 ? 4 : this.phase === 2 ? 5 : 6;
    if (T.hazard <= 0 && this.room) {
      for (let h = 0; h < hazCount; h++) {
        let hx, hy, attempts = 0;
        do {
          hx = this.room.x + rnd(2, this.room.w - 2);
          hy = this.room.y + rnd(2, this.room.h - 2);
          attempts++;
        } while (attempts < 10 && dist(player.x, player.y, hx, hy) < 3);
        hazardZones.push({ x: hx, y: hy, radius: 1.5, age: 0, maxAge: 4, tickCd: 0,
          armTimer: 0.8, dmg: Math.round(15 * getDiff().enemyAtk),
          source: 'Conductor Field', colour: '#00ccff' });
      }
      T.hazard = hazCD;
    }

    // Phase 2+: conduit beam — fast single shot at player
    if (this.phase >= 2 && T.beam <= 0 && los) {
      this.fireAt(player.x, player.y, 8, this.atk + 5, 20, '#00eeff');
      T.beam = 4;
    }

    // Phase 3: discharge AoE with magnetic pull telegraph
    if (this.phase === 3) {
      if (T.discharge <= 0) {
        this._dischargeChannel = 1.5;
        T.discharge = 99;
      }
      if (this._dischargeChannel > 0) {
        this._dischargeChannel -= dt;
        // Magnetic pull toward boss (resistible — player speed >> pull)
        if (d > 2) {
          const [px, py] = norm(this.x - player.x, this.y - player.y);
          const nx = player.x + px * 1.0 * dt;
          const ny = player.y + py * 1.0 * dt;
          const tx = Math.floor(nx), ty = Math.floor(ny);
          if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H && isPassable(map[ty][tx])) {
            player.x = nx; player.y = ny;
          }
          clampToBossRoom(player);
        }
        if (this._dischargeChannel <= 0) {
          // Discharge pulse — recompute distance after pull
          const pulseDist = dist(this.x, this.y, player.x, player.y);
          audio.conductorPulse();
          triggerShake(5, 0.2);
          if (pulseDist < 6) {
            player.takeDamage(Math.round(25 * getDiff().enemyAtk), 'Conductor Pulse');
            const [kx, ky] = norm(player.x - this.x, player.y - this.y);
            player.x += kx * 2.5 * playerKnockMul(); player.y += ky * 2.5 * playerKnockMul();
            clampToBossRoom(player);
          }
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TWO_PI;
            const bp = new Projectile(this.x, this.y, Math.cos(a), Math.sin(a), 4, Math.round(this.atk * 0.5), 8, '#00ccff', false, false);
            bp.ownerType = 'CONDUCTOR'; projectiles.push(bp);
          }
          spawnParticles(this.x, this.y, 'EXPLOSION', '#00ccff', 15);
          this._dischargeChannel = 0;
          T.discharge = 5;
        }
      }
    }
  }

  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiBossOmega(dt,player,map,d,los) {
    // Phase transitions based on maxHp percentage
    const hpPct = this.hp / this.maxHp;
    if (hpPct <= 0.2) this.phase = 4;
    else if (hpPct <= 0.4) this.phase = 3;
    else if (hpPct <= 0.7) this.phase = 2;
    else this.phase = 1;

    // Phase transition VFX
    if (this.phase !== this.prevPhase) {
      spawnParticles(this.x, this.y, 'EXPLOSION', this.colour, 25);
      audio.phaseShift();
      _EG.msg('⚠ OMEGA PHASE ' + this.phase, '#ff00c8');
      this.prevPhase = this.phase;
    }

    const spd = /** @type {number} */ ([1, 1.2, 1.5, 2][this.phase - 1]);
    const T = this.bossTimers;
    T.turret = (T.turret || 0) - dt;
    T.homing = (T.homing || 0) - dt;
    T.spawn  = (T.spawn  || 0) - dt;
    T.beam   = (T.beam   || 0) - dt;
    T.shield = (T.shield || 0) - dt;
    T.void   = (T.void   || 0) - dt;
    T.shock  = (T.shock  || 0) - dt;
    T.move   = (T.move   || 0) - dt;

    // Movement — patrol within boss room
    if (T.move <= 0) {
      if (this.room) this.patrolTarget = {
        x: this.room.x + rnd(2, this.room.w - 2),
        y: this.room.y + rnd(2, this.room.h - 2)
      };
      T.move = 1.5 / spd;
    }
    if (this.patrolTarget) this.moveToward(this.patrolTarget.x, this.patrolTarget.y, spd * 2, dt, map);

    // Phase 1+: Radial turret shots (from SENTINEL)
    if (T.turret <= 0) {
      const n = this.phase >= 3 ? 8 : this.phase >= 2 ? 5 : 4;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TWO_PI + this.bobAngle;
        const bp=new Projectile(this.x, this.y, Math.cos(a), Math.sin(a), 8, this.atk, 18, '#ff00c8', false, false);
        bp.ownerType='OMEGA'; projectiles.push(bp);
      }
      audio.shoot(false);
      T.turret = 2 / spd;
    }

    // Phase 1+: Homing missile at player (from HIVE)
    if (T.homing <= 0 && los) {
      this.fireAt(player.x, player.y, 7, this.atk + 5, 20, '#aa00ff');
      T.homing = 2.5 / spd;
    }

    // Phase 2+: Spawn crawlers (inherited from HIVE) and drones — capped at 8 active adds
    if (this.phase >= 2 && T.spawn <= 0 && this.spawnCooldown <= 0) {
      let activeAdds = 0;
      for (const e of enemiesInRoomIter(this.room)) {
        if (!e.dead && !e.isBoss) activeAdds++;
      }
      if (activeAdds < 8) {
        const addType = Math.random() < 0.6 ? 'CRAWLER' : 'DRONE';
        const count = Math.min(this.phase >= 4 ? 3 : 2, 8 - activeAdds);
        for (let i = 0; i < count; i++) {
          const add = spawnEnemy(addType, this.x + rnd(-3, 3), this.y + rnd(-3, 3), _EG.floor, this.room, false);
          enemies.push(add);
        }
      }
      T.spawn = 5 / spd;
      this.spawnCooldown = 0.5;
    }

    // Phase 3+: Beam fan (5–7 piercing beams aimed at player)
    if (this.phase >= 3 && T.beam <= 0) {
      const [dx, dy] = norm(player.x - this.x, player.y - this.y);
      const count = this.phase >= 4 ? 7 : 5;
      const half = Math.floor(count / 2);
      for (let i = -half; i <= half; i++) {
        const a = Math.atan2(dy, dx) + i * 0.18;
        const bp=new Projectile(this.x, this.y, Math.cos(a), Math.sin(a), 14, 35, 22, '#ff00c8', true, false);
        bp.ownerType='OMEGA'; projectiles.push(bp);
      }
      audio.shoot(false);
      T.beam = 3.5 / spd;
    }

    // Phase 3+: Shield burst — AoE knockback+damage within 5 tiles (from SENTINEL)
    if (this.phase >= 3 && T.shield <= 0) {
      if (d < 5) {
        const [kx, ky] = norm(player.x - this.x, player.y - this.y);
        player.x += kx * 3 * playerKnockMul();
        player.y += ky * 3 * playerKnockMul();
        clampToBossRoom(player);
        player.takeDamage(Math.round(20*getDiff().enemyAtk), 'OMEGA');
        spawnParticles(this.x, this.y, 'EXPLOSION', '#ff00c8', 12);
      }
      T.shield = 6 / spd;
    }

    // Phase 4: Psionic shockwave — AoE damage within 7 tiles (from HIVE)
    if (this.phase >= 4 && T.shock <= 0) {
      if (d < 7) {
        player.takeDamage(Math.round(25*getDiff().enemyAtk), 'OMEGA');
        spawnParticles(player.x, player.y, 'EXPLOSION', '#aa00ff', 10);
      }
      spawnParticles(this.x, this.y, 'EXPLOSION', '#aa00ff', 20);
      T.shock = 4 / spd;
    }

    // Phase 4: Void orbs — expanding AoE zones that fill the room
    if (this.phase >= 4 && T.void <= 0 && this.room) {
      const count = rndInt(2, 3);
      for (let i = 0; i < count; i++) {
        this.voidOrbs.push({
          x: this.room.x + rnd(2, this.room.w - 2),
          y: this.room.y + rnd(2, this.room.h - 2),
          radius: 0, maxRadius: rnd(4, 7),
          age: 0, maxAge: 2.5,
          tickCd: 0
        });
      }
      T.void = 3.5 / spd;
    }

    // Update void orbs — expand and tick damage
    for (let i = this.voidOrbs.length - 1; i >= 0; i--) {
      const orb = this.voidOrbs[i];
      orb.age += dt;
      orb.radius = orb.maxRadius * Math.min(1, orb.age / (orb.maxAge * 0.6));
      orb.tickCd = Math.max(0, orb.tickCd - dt);
      if (orb.age >= orb.maxAge) { this.voidOrbs.splice(i, 1); continue; }
      // tick damage every 0.5s while player is inside
      if (orb.tickCd <= 0 && dist(player.x, player.y, orb.x, orb.y) < orb.radius) {
        player.takeDamage(Math.round(15*getDiff().enemyAtk), 'Void Orb');
        spawnParticles(player.x, player.y, 'SPARK', '#aa00ff', 4);
        orb.tickCd = 0.5;
      }
    }
  }

  /**
   * @param {any} [dt]
   * @param {any} [player]
   * @param {any} [map]
   * @param {any} [d]
   * @param {any} [los]
   */
  aiBossGenesis(dt,player,map,d,los) {
    const hpPct = this.hp / this.maxHp;
    // UNCHAINED #42: _unchainedPhase locks the boss into phase-3 attack
    // patterns regardless of remaining HP — it's the "secret boss" fight.
    const newPhase = this._unchainedPhase ? 3
                   : hpPct <= 0.35 ? 3 : hpPct <= 0.7 ? 2 : 1;
    if (newPhase !== this.phase) {
      this.phase = newPhase;
      spawnParticles(this.x, this.y, 'EXPLOSION', this.colour, 22);
      audio.phaseShift();
      _EG.msg('⚠ GENESIS PHASE ' + this.phase, '#ffcc00');
      this.prevPhase = this.phase;
      // Seed timers so attacks don't all fire at once on phase transition
      const T = this.bossTimers;
      T.spiral = 1.0; T.lance = 1.5; T.hazard = 2.0; T.purge = 4.0;
    }

    const T = this.bossTimers;
    T.spiral = (T.spiral || 0) - dt;
    T.lance  = (T.lance  || 0) - dt;
    T.hazard = (T.hazard || 0) - dt;
    T.purge  = (T.purge  || 0) - dt;
    T.move   = (T.move   || 0) - dt;

    // Movement: slow center patrol (deliberate, not erratic)
    if (T.move <= 0 && this.room) {
      this.patrolTarget = {
        x: this.room.cx + rnd(-3, 3),
        y: this.room.cy + rnd(-3, 3)
      };
      T.move = 2.5;
    }
    if (this.patrolTarget) this.moveToward(this.patrolTarget.x, this.patrolTarget.y, this.spd * 0.6, dt, map);

    // Spiral salvo: rotating burst with incremental offset
    const spiralCount = this.phase >= 3 ? 10 : this.phase >= 2 ? 8 : 6;
    const spiralCD = this.phase >= 3 ? 2 : this.phase >= 2 ? 2.5 : 3;
    if (T.spiral <= 0) {
      for (let i = 0; i < spiralCount; i++) {
        const a = (i / spiralCount) * TWO_PI + (this._spiralSpin || 0);
        const bp = new Projectile(this.x, this.y, Math.cos(a), Math.sin(a), 5, Math.round(this.atk * 0.7), 12, '#ffcc00', false, false);
        bp.ownerType = 'GENESIS'; projectiles.push(bp);
      }
      this._spiralSpin = ((this._spiralSpin || 0) + 0.4) % TWO_PI;
      spawnParticles(this.x, this.y, 'SPARK', '#ffcc00', 5);
      audio.shoot(false);
      T.spiral = spiralCD;
    }

    // Targeting lance: telegraphed aimed shot — aim locks at start
    const lanceTelegraph = this.phase >= 3 ? 0.4 : 0.5;
    const lanceCD = this.phase >= 3 ? 3 : this.phase >= 2 ? 3.5 : 4;
    const lanceSpread = this.phase >= 3 ? 5 : this.phase >= 2 ? 3 : 1;

    if (this._lanceTelegraph > 0) {
      // Cancel on LOS loss or cloak (same pattern as SNIPER laser)
      if (!los || !canTargetPlayer()) {
        this._lanceTelegraph = 0; this._lanceLock = null;
        T.lance = 1.0;
      } else {
        this._lanceTelegraph -= dt;
        if (this._lanceTelegraph <= 0 && this._lanceLock) {
          const lk = this._lanceLock;
          const [dx, dy] = norm(lk.x - this.x, lk.y - this.y);
          const baseAngle = Math.atan2(dy, dx);
          const half = Math.floor(lanceSpread / 2);
          for (let i = -half; i <= half; i++) {
            const a = baseAngle + i * 0.12;
            const bp = new Projectile(this.x, this.y, Math.cos(a), Math.sin(a), 12, Math.round(this.atk * 1.4), 20, '#ffe066', false, false);
            bp.ownerType = 'GENESIS'; projectiles.push(bp);
          }
          audio.genesisLance();
          this._lanceLock = null;
        }
      }
    } else if (T.lance <= 0 && los) {
      this._lanceTelegraph = lanceTelegraph;
      this._lanceLock = { x: player.x, y: player.y };
      T.lance = lanceCD + lanceTelegraph;
    }

    // Hazard grid: zones near player's recent position (Phase 2+)
    if (this.phase >= 2 && T.hazard <= 0 && this.room) {
      const hazCount = this.phase >= 3 ? 3 : 2;
      const armTime = this.phase >= 3 ? 0.8 : 1.2;
      for (let h = 0; h < hazCount; h++) {
        let /** @type {number} */ hx = 0, /** @type {number} */ hy = 0, attempts = 0, valid = false;
        do {
          hx = player.x + rnd(-4, 4);
          hy = player.y + rnd(-4, 4);
          hx = Math.max(this.room.x + 1, Math.min(this.room.x + this.room.w - 1, hx));
          hy = Math.max(this.room.y + 1, Math.min(this.room.y + this.room.h - 1, hy));
          const overlap = hazardZones.some(z => z.source && z.source.startsWith('Genesis') && dist(z.x, z.y, hx, hy) < 2.5);
          valid = !overlap && dist(player.x, player.y, hx, hy) > 1.5;
          attempts++;
        } while (!valid && attempts < 12);
        if (valid) {
          hazardZones.push({ x: hx, y: hy, radius: 1.5, age: 0, maxAge: 4, tickCd: 0,
            armTimer: armTime, dmg: Math.round(15 * getDiff().enemyAtk),
            source: 'Genesis Field', colour: '#ffcc00' });
        }
      }
      T.hazard = this.phase >= 3 ? 4 : 5;
    }

    // Purge ring: circle of hazard zones around room center (Phase 3 signature)
    if (this.phase >= 3 && T.purge <= 0 && this.room) {
      const cx = this.room.cx, cy = this.room.cy;
      const ringCount = 6;
      const ringRadius = 4.5;
      const skipSlot = rndInt(0, ringCount - 1);
      for (let i = 0; i < ringCount; i++) {
        if (i === skipSlot) continue;
        const a = (i / ringCount) * TWO_PI + (Math.random() * 0.15);
        const rx = cx + Math.cos(a) * ringRadius;
        const ry = cy + Math.sin(a) * ringRadius;
        const clx = Math.max(this.room.x + 1, Math.min(this.room.x + this.room.w - 1, rx));
        const cly = Math.max(this.room.y + 1, Math.min(this.room.y + this.room.h - 1, ry));
        hazardZones.push({ x: clx, y: cly, radius: 1.8, age: 0, maxAge: 3.5, tickCd: 0,
          armTimer: 0.6, dmg: Math.round(18 * getDiff().enemyAtk),
          source: 'Genesis Purge', colour: '#ffe066' });
      }
      audio.genesisPurge();
      spawnParticles(cx, cy, 'EXPLOSION', '#ffcc00', 15);
      triggerShake(4, 0.2);
      T.purge = 8;
    }
  }

  /**
   * @param {any} [camX]
   * @param {any} [camY]
   */
  draw(camX,camY) {
    if (this.dead) return;
    // FOV gating: only draw enemies the player can currently see
    const etx = Math.floor(this.x), ety = Math.floor(this.y);
    // WRAITH emerging telegraph is always visible (warns player)
    if (!_EG.dungeon?.visible?.[ety]?.[etx] &&
        !(this.type === 'WRAITH' && this._wrState === 'emerging') &&
        !(this.type === 'TUNNELLER' && (this._tnState === 'tunneling' || this._tnState === 'surfacing'))) return;
    const sx=this.x*TILE-camX, syBase=this.y*TILE-camY;
    const sy = syBase - (this._lpHeight || 0) * TILE;
    if (sx<-40||sx>W+40||syBase<-40||syBase>H+40) return;
    if (this._disguised) {
      const bobY = Math.sin(this._mimicBob) * 2;
      ctx.save();
      ctx.shadowBlur = 12; ctx.shadowColor = this._mimicColour;
      ctx.fillStyle = this._mimicColour;
      ctx.fillRect(sx - 5, sy - 5 + bobY, 10, 10);
      // Subtle shimmer tell every ~2.5s (0.15s flash)
      const shimCycle = ((_EG.floorTime || 0) * 0.4) % 1;
      if (shimCycle > 0.92) {
        ctx.globalAlpha = 0.3 + 0.4 * Math.sin(shimCycle * 80);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx - 6, sy - 6 + bobY, 12, 12);
      }
      ctx.restore();
      return;
    }

    // MIMIC reveal burst: expanding ring
    if (this.type === 'MIMIC' && this._revealTimer > 0) {
      const progress = 1 - this._revealTimer / 0.3;
      ctx.save();
      ctx.globalAlpha = 0.7 * (1 - progress);
      ctx.strokeStyle = '#cc33ff';
      ctx.shadowBlur = 15; ctx.shadowColor = '#cc33ff';
      ctx.lineWidth = 2;
      NEON.draw.circleStroke(ctx, sx, sy, progress * TILE * 2);
      ctx.restore();
    }

    let alpha=1;
    if (this.type==='PHANTOM') {
      if (this._phState==='cloaked') alpha=0.08;
      else if (this._phState==='telegraph') alpha=0.3+0.2*Math.sin(this.bobAngle*8);
    }
    if (this.type==='WRAITH') {
      if (this._wrState==='phased') alpha=0.1;
      else if (this._wrState==='emerging') alpha=0.2 + (1 - this._wrTimer / 0.5) * 0.65;
      else if (this._wrState==='fading') alpha=0.3 + (this._wrTimer / 0.4) * 0.55;
      else alpha=0.85;
    }
    if (this.type==='TELEPORTER') alpha = this._materialize > 0 ? 0.3 + (1 - this._materialize / 0.4) * 0.4 : 0.7 + Math.sin(this.bobAngle * 8) * 0.3;
    // Ghost replays render translucent so the player can immediately read
    // them as "not real" at a glance. Multiplies any per-type alpha (none
    // of the ghostable types currently set their own alpha, but the
    // multiplication keeps the rule sound if PHANTOM ever joins the
    // GHOSTABLE_TYPES set later).
    if (this._ghIsGhost) alpha *= 0.55;

    // TUNNELLER: while underground or surfacing, draw a dust mound + telegraph
    // ring instead of the body. Returns early so the regular sprite is hidden.
    if (this.type === 'TUNNELLER' && (this._tnState === 'tunneling' || this._tnState === 'surfacing')) {
      ctx.save();
      const dustCol = '#cc8844';
      ctx.shadowColor = dustCol;
      if (this._tnState === 'tunneling') {
        // Subtle moving dust pile
        const wob = Math.sin(this.bobAngle * 3) * 1.5;
        ctx.globalAlpha = 0.55;
        ctx.shadowBlur = 8;
        ctx.fillStyle = dustCol;
        NEON.draw.circle(ctx, sx, sy + 2 + wob, 5);
        ctx.globalAlpha = 0.25;
        NEON.draw.circle(ctx, sx, sy + 2 + wob, 9);
      } else {
        // Surfacing telegraph: shaking mound + expanding warning ring.
        const prog = 1 - this._tnTimer / 1.0; // 0 → 1
        const shakeX = (Math.random() - 0.5) * 2 * prog;
        const shakeY = (Math.random() - 0.5) * 2 * prog;
        ctx.globalAlpha = 0.65 + prog * 0.3;
        ctx.shadowBlur = 12 + prog * 10;
        ctx.fillStyle = dustCol;
        NEON.draw.circle(ctx, sx + shakeX, sy + 1 + shakeY, 6 + prog * 4);
        // Expanding ring telegraph (shows AoE radius 1.4 tiles)
        ctx.globalAlpha = 0.45 + 0.35 * Math.sin(prog * 18);
        ctx.strokeStyle = dustCol;
        ctx.lineWidth = 2;
        NEON.draw.circleStroke(ctx, sx, sy, 1.4 * TILE * (0.4 + prog * 0.6));
      }
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.globalAlpha=alpha;

    const col=this.flashTimer>0?'#ffffff':this.colour;
    const elitePulse = this.elite ? 12 + Math.sin(this.bobAngle * 2) * 8 : 0;
    ctx.shadowBlur=this.isBoss?20: this.elite ? 10 + elitePulse : 10;
    const eliteGlow = this.eliteAffix ? ELITE_AFFIXES[this.eliteAffix].colour : col;
    ctx.shadowColor= this.elite ? eliteGlow : col;
    ctx.fillStyle=col;

    if (this.isBoss) {
      // Draw void orbs as ground effects (OMEGA phase 4)
      if (this.voidOrbs.length > 0) {
        for (const orb of this.voidOrbs) {
          const ox = orb.x * TILE - camX, oy = orb.y * TILE - camY;
          const r = orb.radius * TILE;
          const fade = 1 - (orb.age / orb.maxAge);
          ctx.save();
          ctx.globalAlpha = fade * 0.3;
          ctx.fillStyle = '#aa00ff';
          ctx.shadowBlur = 20;
          ctx.shadowColor = '#aa00ff';
          NEON.draw.circle(ctx, ox, oy, r);
          // Ring edge
          ctx.globalAlpha = fade * 0.7;
          ctx.strokeStyle = '#ff00c8';
          ctx.lineWidth = 2;
          NEON.draw.circleStroke(ctx, ox, oy, r);
          ctx.restore();
        }
      }

      // WARDEN: charge wind-up telegraph line
      if (this.type === 'WARDEN' && this._chargeState === 'windup') {
        const windupTotal = this.phase === 2 ? 0.45 : 0.6;
        const progress = 1 - this._chargeWindup / windupTotal;
        const len = 6 * TILE * progress;
        const ex = sx + this._chargeDx * len;
        const ey = sy + this._chargeDy * len;
        ctx.save();
        const pulse = 0.5 + 0.5 * Math.sin(progress * 16);
        ctx.globalAlpha = (0.2 + progress * 0.5) * pulse;
        ctx.strokeStyle = '#ff8800';
        ctx.shadowBlur = 6 + progress * 10;
        ctx.shadowColor = '#ff8800';
        ctx.lineWidth = 2 + progress * 2;
        ctx.setLineDash([6, 4]);
        NEON.draw.line(ctx, sx, sy, ex, ey);
        ctx.setLineDash([]);
        ctx.restore();
      }

      // CONDUCTOR: discharge channel glow + rotating arc ring
      if (this.type === 'CONDUCTOR') {
        // Rotating arc ring (always visible)
        ctx.save();
        const spin = (this._arcSpin || 0) + Date.now() * 0.003;
        const arcSegs = 6;
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = '#00ccff';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#00ccff';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < arcSegs; i++) {
          const a1 = spin + (i / arcSegs) * TWO_PI;
          const a2 = a1 + 0.35;
          NEON.draw.arcStroke(ctx, sx, sy, 24, a1, a2);
        }
        ctx.restore();
        // Discharge channel — pulsing glow during pull phase
        if (this._dischargeChannel > 0) {
          ctx.save();
          const chPulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.02);
          ctx.globalAlpha = 0.3 + chPulse * 0.3;
          ctx.fillStyle = '#00ccff';
          ctx.shadowBlur = 20 + chPulse * 15;
          ctx.shadowColor = '#00ccff';
          NEON.draw.circle(ctx, sx, sy, 30);
          ctx.restore();
        }
      }

      // GENESIS: lance telegraph line + rotating hex ring
      if (this.type === 'GENESIS') {
        // UNCHAINED #42 — _unchainedPhase inverts the palette.
        const ringColour  = this._unchainedPhase ? '#88ccff' : '#ffcc00';
        const lanceColour = this._unchainedPhase ? '#cceeff' : '#ffe066';
        // Rotating hexagonal ring (always visible)
        ctx.save();
        const hexSpin = (this._spiralSpin || 0) + Date.now() * 0.002;
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = ringColour;
        ctx.shadowBlur = 8;
        ctx.shadowColor = ringColour;
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) {
          const a1 = hexSpin + (i / 6) * TWO_PI;
          const a2 = hexSpin + ((i + 1) / 6) * TWO_PI;
          ctx.beginPath();
          ctx.moveTo(sx + Math.cos(a1) * 26, sy + Math.sin(a1) * 26);
          ctx.lineTo(sx + Math.cos(a2) * 26, sy + Math.sin(a2) * 26);
          ctx.stroke();
        }
        ctx.restore();
        // Lance telegraph — pulsing aim line
        if (this._lanceTelegraph > 0 && this._lanceLock) {
          const lanceTTotal = this.phase >= 3 ? 0.4 : 0.5;
          const progress = 1 - this._lanceTelegraph / lanceTTotal;
          const tx = this._lanceLock.x * TILE - camX;
          const ty = this._lanceLock.y * TILE - camY;
          ctx.save();
          const pulse = 0.5 + 0.5 * Math.sin(progress * 20);
          ctx.globalAlpha = (0.3 + progress * 0.5) * pulse;
          ctx.strokeStyle = lanceColour;
          ctx.shadowBlur = 8 + progress * 12;
          ctx.shadowColor = lanceColour;
          ctx.lineWidth = 1 + progress * 2;
          ctx.setLineDash([4, 4]);
          NEON.draw.line(ctx, sx, sy, tx, ty);
          ctx.setLineDash([]);
          ctx.restore();
        }
      }

      const sz=(this.type==='OMEGA'||this.type==='GENESIS')?22:18;
      NEON.draw.circle(ctx, sx, sy, sz);
      // boss HP shown in cinematic HUD bar (drawBossBar), not overhead
    } else {
      const baseSz = TILE * (this.isShard ? 0.25 : 0.4);
      const sz = baseSz; // compat alias — used by SHIELDER/REFLECTOR overlays below
      const t = this.type;
      // Per-type visual shapes — break up the uniform square look.
      if (t === 'CHARGER') {
        // Triangle pointing toward target
        const sz = TILE * 0.45;
        const fdx = (this._tx || this.x) - this.x, fdy = (this._ty || this.y) - this.y;
        const angle = (fdx || fdy) ? Math.atan2(fdy, fdx) : 0;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(angle);
        ctx.beginPath(); ctx.moveTo(sz * 0.6, 0); ctx.lineTo(-sz * 0.4, -sz * 0.4); ctx.lineTo(-sz * 0.4, sz * 0.4); ctx.closePath(); ctx.fill();
        ctx.restore();
      } else if (t === 'PHANTOM' || t === 'WRAITH') {
        // Diamond, semi-transparent
        const sz = TILE * 0.35;
        ctx.save(); ctx.globalAlpha = (ctx.globalAlpha || 1) * 0.65;
        ctx.translate(sx, sy); ctx.rotate(Math.PI / 4);
        ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
        ctx.restore();
      } else if (t === 'GRENADIER' || t === 'PULSER') {
        // Circle
        const r = TILE * 0.2;
        NEON.draw.circle(ctx, sx, sy, r);
      } else if (t === 'SCORCHER') {
        // Diamond ember core
        const sz = TILE * 0.32;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(Math.PI / 4 + Math.sin(this.bobAngle * 3) * 0.12);
        ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
        ctx.restore();
      } else if (t === 'BRUTE') {
        // Heavy block silhouette
        const w = TILE * 0.52, h = TILE * 0.46;
        ctx.fillRect(sx - w / 2, sy - h / 2, w, h);
      } else if (t === 'SNIPER') {
        // Thin tall rectangle
        const w = TILE * 0.18, h = TILE * 0.5;
        ctx.fillRect(sx - w / 2, sy - h / 2, w, h);
      } else if (t === 'SUMMONER' || t === 'HEALER' || t === 'NEXUS') {
        // Circle with outer ring
        const r = TILE * 0.22;
        NEON.draw.circle(ctx, sx, sy, r);
        ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.4;
        NEON.draw.circleStroke(ctx, sx, sy, r * 1.6);
        ctx.restore();
      } else if (t === 'LEAPER') {
        // Small circle that pulses during windup
        const lpScale = this._lpState === 'windup' ? 1.0 + 0.3 * Math.sin(this.bobAngle * 8) : (this._lpState === 'airborne' ? 1.4 : 0.8);
        const r = TILE * 0.2 * lpScale;
        NEON.draw.circle(ctx, sx, sy, r);
      } else if (t === 'CRAWLER') {
        // Low wide rectangle
        const w = TILE * 0.48, h = TILE * 0.24;
        ctx.fillRect(sx - w / 2, sy - h / 2, w, h);
      } else if (t === 'TURRET') {
        // Plus/cross shape
        const a = TILE * 0.14, b = TILE * 0.38;
        ctx.fillRect(sx - a / 2, sy - b / 2, a, b);
        ctx.fillRect(sx - b / 2, sy - a / 2, b, a);
      } else if (t === 'DRONE' || t === 'SEEKER') {
        // Small diamond
        const sz = TILE * 0.28;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(Math.PI / 4);
        ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
        ctx.restore();
      } else {
        // Default: square (GUARD, SPLITTER, TELEPORTER, MIMIC, SIPHON, DISRUPTOR, GRAVITON, REFLECTOR)
        ctx.fillRect(sx - baseSz / 2, sy - baseSz / 2, baseSz, baseSz);
      }
      if (this.type === 'SCORCHER') {
        ctx.save();
        const sp = 0.22 + 0.16 * Math.sin(this.bobAngle * 7);
        ctx.globalAlpha = sp;
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#ff5a22';
        ctx.fillStyle = '#ff5a22';
        NEON.draw.circle(ctx, sx, sy, sz * 1.25);
        ctx.restore();
      }
      if (this.type === 'BRUTE') {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#551924';
        ctx.fillRect(sx - sz * 0.45, sy - sz * 0.55, sz * 0.9, sz * 0.18);
        ctx.restore();
      }
      // Shielder: draw 120° shield arc facing the player. Shield is breakable
      // (see blocksProjectile). When down (shieldHp <= 0) it doesn't render.
      // During the 3..5s window after break it blinks back; full alpha at 5s.
      if (this.type === 'SHIELDER') {
        let shieldAlpha = 0;
        if (this.shieldHp > 0) {
          // Up: usual gentle pulse.
          shieldAlpha = 0.7 + Math.sin(this.bobAngle * 2) * 0.15;
        } else if (this.shieldBrokenTimer >= 3 && this.shieldBrokenTimer < 5) {
          // Blink-back: alpha ramps from 0 → ~0.7 over the 2s window plus
          // a fast strobe so the player can SEE the shield re-forming.
          const t = (this.shieldBrokenTimer - 3) / 2; // 0..1
          const strobe = 0.5 + 0.5 * Math.sin(this.bobAngle * 14);
          shieldAlpha = 0.15 + 0.55 * t * strobe;
        }
        if (shieldAlpha > 0.01) {
          ctx.save();
          ctx.strokeStyle = '#66eeff';
          ctx.lineWidth = 3;
          ctx.shadowBlur = 12;
          ctx.shadowColor = '#66eeff';
          ctx.globalAlpha = shieldAlpha;
          const shieldR = sz * 1.2;
          NEON.draw.arcStroke(ctx, sx, sy, shieldR, this.shieldAngle - Math.PI / 3, this.shieldAngle + Math.PI / 3);
          ctx.restore();
        }
      }
      // Reflector: draw 90° mirror shield with inner highlight
      if (this.type === 'REFLECTOR') {
        ctx.save();
        const rR = sz * 1.3;
        const pulse = 0.7 + Math.sin(this.bobAngle * 3) * 0.2;
        // Outer arc — cyan
        ctx.strokeStyle = '#88ddff';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#88ddff';
        ctx.globalAlpha = pulse;
        NEON.draw.arcStroke(ctx, sx, sy, rR, this._rfAngle - Math.PI / 4, this._rfAngle + Math.PI / 4);
        // Inner mirror highlight — white
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#ffffff';
        NEON.draw.arcStroke(ctx, sx, sy, rR - 2, this._rfAngle - Math.PI / 4, this._rfAngle + Math.PI / 4);
        // Edge ticks — segmented look
        for (let i = -2; i <= 2; i++) {
          const a = this._rfAngle + (i / 4) * (Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(sx + Math.cos(a) * (rR - 1), sy + Math.sin(a) * (rR - 1));
          ctx.lineTo(sx + Math.cos(a) * (rR + 3), sy + Math.sin(a) * (rR + 3));
          ctx.stroke();
        }
        ctx.restore();
      }
      // Disruptor: pulsing deploy glow when field about to deploy
      if (this.type === 'DISRUPTOR' && this._dDeployTimer < 0.8 && this._dDeployTimer > 0) {
        ctx.save();
        const pulse = 0.3 + 0.4 * Math.sin(this._dDeployTimer * 25);
        ctx.globalAlpha = pulse;
        ctx.shadowBlur = 16;
        ctx.shadowColor = '#ff44aa';
        ctx.fillStyle = '#ff44aa';
        NEON.draw.circle(ctx, sx, sy, sz * 1.5);
        ctx.restore();
      }
      // Wraith: emerging glow telegraph
      if (this.type === 'WRAITH' && this._wrState === 'emerging') {
        ctx.save();
        const prog = 1 - this._wrTimer / 0.5;
        ctx.globalAlpha = 0.2 + prog * 0.5;
        ctx.shadowBlur = 12 + prog * 10;
        ctx.shadowColor = '#66ffcc';
        ctx.fillStyle = '#66ffcc';
        NEON.draw.circle(ctx, sx, sy, sz * (1 + prog * 0.8));
        ctx.restore();
      }
      // Wraith: fading flicker
      if (this.type === 'WRAITH' && this._wrState === 'fading') {
        ctx.save();
        const prog = 1 - this._wrTimer / 0.4;
        ctx.globalAlpha = 0.3 * (1 - prog);
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#66ffcc';
        ctx.strokeStyle = '#66ffcc';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        NEON.draw.circleStroke(ctx, sx, sy, sz * (1.2 + prog * 0.5));
        ctx.restore();
      }
      // NEXUS: orbital ring + link beams to buffed allies
      if (this.type === 'NEXUS') {
        ctx.save();
        // Pulsing orbital ring
        const nPulse = 0.2 + 0.12 * Math.sin(this.bobAngle * 2.5);
        ctx.globalAlpha = nPulse;
        ctx.strokeStyle = '#00eedd';
        ctx.shadowBlur = 10 + Math.sin(this.bobAngle * 2) * 5;
        ctx.shadowColor = '#00eedd';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 7]);
        ctx.lineDashOffset = this.bobAngle * 10;
        const ringR = sz * 1.5 + Math.sin(this.bobAngle * 3) * 2;
        NEON.draw.circleStroke(ctx, sx, sy, ringR);
        ctx.setLineDash([]);
        // Inner diamond symbol
        ctx.globalAlpha = nPulse * 1.4;
        ctx.fillStyle = '#00eedd';
        ctx.lineWidth = 1;
        const ds = 4;
        ctx.beginPath();
        ctx.moveTo(sx, sy - ds * 1.2);
        ctx.lineTo(sx + ds, sy);
        ctx.lineTo(sx, sy + ds * 1.2);
        ctx.lineTo(sx - ds, sy);
        ctx.closePath();
        ctx.stroke();
        // Neural link beams to linked allies
        if (this._nxLinks && this.stunTimer <= 0) {
          for (const linked of this._nxLinks) {
            if (linked.dead) continue;
            const lx = linked.x * TILE - camX;
            const ly = linked.y * TILE - camY;
            const beamAlpha = 0.25 + 0.1 * Math.sin(this.bobAngle * 4);
            ctx.globalAlpha = beamAlpha;
            ctx.strokeStyle = '#00eedd';
            ctx.shadowBlur = 8;
            ctx.lineWidth = 1.5 + Math.sin(this.bobAngle * 5) * 0.5;
            ctx.setLineDash([4, 5]);
            ctx.lineDashOffset = -this.bobAngle * 8;
            NEON.draw.line(ctx, sx, sy, lx, ly);
            ctx.setLineDash([]);
            // Small teal glow on linked enemy
            ctx.globalAlpha = 0.15;
            ctx.fillStyle = '#00eedd';
            NEON.draw.circle(ctx, lx, ly, sz * 0.8);
          }
        }
        ctx.restore();
      }
      // SIPHON: crimson aura + frenzy glow + drain beam
      if (this.type === 'SIPHON') {
        ctx.save();
        const frenzy = this._spFrenzy;
        const pulseRate = frenzy ? 5.0 : 2.0;
        const baseAlpha = frenzy ? 0.3 : 0.15;
        const auraAlpha = baseAlpha + 0.1 * Math.sin(this.bobAngle * pulseRate);
        // Crimson aura circle
        ctx.globalAlpha = auraAlpha;
        ctx.fillStyle = '#dd2244';
        ctx.shadowBlur = frenzy ? 18 : 10;
        ctx.shadowColor = '#dd2244';
        const auraR = sz * (frenzy ? 1.6 : 1.3) + Math.sin(this.bobAngle * pulseRate) * 2;
        NEON.draw.circle(ctx, sx, sy, auraR);
        // Frenzy: inner heartbeat pulse
        if (frenzy) {
          const hb = Math.abs(Math.sin(this.bobAngle * 3.5));
          ctx.globalAlpha = hb * 0.3;
          ctx.fillStyle = '#ff4466';
          NEON.draw.circle(ctx, sx, sy, sz * 0.8 * (0.8 + hb * 0.4));
        }
        // Drain beam (set on successful life steal in content.js)
        if (this._spDrainBeam && this._spDrainBeam.t > 0) {
          const db = this._spDrainBeam;
          const beamAlpha = (db.t / 0.3) * 0.5;
          ctx.globalAlpha = beamAlpha;
          ctx.strokeStyle = '#dd2244';
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#ff4466';
          ctx.lineWidth = 2;
          NEON.draw.line(ctx, db.px * TILE - camX, db.py * TILE - camY, sx, sy);
          // Heal particles moving toward SIPHON
          const progress = 1 - db.t / 0.3;
          const mx = db.px + (this.x - db.px) * progress;
          const my = db.py + (this.y - db.py) * progress;
          ctx.globalAlpha = beamAlpha * 1.5;
          ctx.fillStyle = '#44ff88';
          ctx.shadowBlur = 6;
          ctx.shadowColor = '#44ff88';
          NEON.draw.circle(ctx, mx * TILE - camX, my * TILE - camY, 3);
        }
        ctx.restore();
      }
      // GRAVITON: orbiting particle ring + violet aura
      if (this.type === 'GRAVITON') {
        ctx.save();
        const gvPulse = 0.15 + 0.1 * Math.sin(this.bobAngle * 2);
        // Violet aura
        ctx.globalAlpha = gvPulse;
        ctx.fillStyle = '#8833ff';
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#8833ff';
        const auraR = sz * 1.4 + Math.sin(this.bobAngle * 3) * 2;
        NEON.draw.circle(ctx, sx, sy, auraR);
        // Orbiting particles (3 dots)
        ctx.globalAlpha = 0.5 + 0.2 * Math.sin(this.bobAngle * 4);
        ctx.fillStyle = '#cc88ff';
        for (let p = 0; p < 3; p++) {
          const a = this.bobAngle * 2 + p * (TWO_PI / 3);
          const orbR = sz * 1.1;
          NEON.draw.circle(ctx, sx + Math.cos(a) * orbR, sy + Math.sin(a) * orbR, 2);
        }
        // Inner gravity symbol (concentric circles)
        ctx.globalAlpha = gvPulse * 1.5;
        ctx.strokeStyle = '#cc88ff';
        ctx.lineWidth = 1;
        ctx.shadowBlur = 4;
        NEON.draw.circleStroke(ctx, sx, sy, 3);
        ctx.restore();
      }
      // SEEKER: intensifying warning glow as it approaches player
      if (this.type === 'SEEKER') {
        const prox = this._skProximity || 0;
        if (prox > 0.05) {
          ctx.save();
          const pulse = 0.5 + 0.5 * Math.sin(this.bobAngle * (4 + prox * 8));
          ctx.globalAlpha = prox * 0.4 * pulse;
          ctx.fillStyle = '#ffdd00';
          ctx.shadowBlur = 10 + prox * 16;
          ctx.shadowColor = '#ff8800';
          NEON.draw.circle(ctx, sx, sy, sz * (1.2 + prox * 0.6));
          ctx.restore();
        }
      }
      // Teleporter: afterimage at previous warp origin
      if (this.type === 'TELEPORTER' && this._warpFade > 0) {
        ctx.save();
        ctx.globalAlpha = this._warpFade * 0.35;
        ctx.fillStyle = this.colour;
        ctx.shadowBlur = 8;
        ctx.shadowColor = this.colour;
        const osx = this._warpFromX * TILE - camX, osy = this._warpFromY * TILE - camY;
        ctx.fillRect(osx - sz / 2, osy - sz / 2, sz, sz);
        ctx.restore();
      }
      // Sniper: laser sight line during charge + idle scope glint
      if (this.type === 'SNIPER') {
        if (this._laserTimer > 0 && this._laserTarget) {
          const progress = 1 - this._laserTimer / 1.5;
          const lx = this._laserTarget.x * TILE - camX;
          const ly = this._laserTarget.y * TILE - camY;
          ctx.save();
          // Pulsing laser line
          const pulse = 0.5 + 0.5 * Math.sin(progress * 20);
          ctx.globalAlpha = (0.15 + progress * 0.5) * pulse;
          ctx.strokeStyle = '#ff2266';
          ctx.shadowBlur = 6 + progress * 10;
          ctx.shadowColor = '#ff2266';
          ctx.lineWidth = 1 + progress * 1.5;
          ctx.setLineDash([4, 6 - progress * 4]);
          NEON.draw.line(ctx, sx, sy, lx, ly);
          // Target dot
          ctx.globalAlpha = 0.3 + progress * 0.5;
          ctx.setLineDash([]);
          ctx.fillStyle = '#ff2266';
          NEON.draw.circle(ctx, lx, ly, 3 + progress * 2);
          ctx.restore();
        } else {
          // Idle scope glint
          ctx.save();
          ctx.globalAlpha = 0.25 + Math.sin(this.bobAngle * 3) * 0.1;
          ctx.fillStyle = '#ff2266';
          ctx.shadowBlur = 6;
          ctx.shadowColor = '#ff2266';
          NEON.draw.circle(ctx, sx, sy - sz * 0.6, 1.5);
          ctx.restore();
        }
      }
      // PULSER: charge-up rings + directional aim line
      if (this.type === 'PULSER') {
        if (this._plState === 'charging') {
          const progress = 1 - this._plTimer / 1.0;
          ctx.save();
          // Pulsing concentric charge rings
          const pulse = 0.5 + 0.5 * Math.sin(progress * 16);
          ctx.strokeStyle = '#44ddff';
          ctx.shadowBlur = 6 + progress * 12;
          ctx.shadowColor = '#44ddff';
          ctx.lineWidth = 1 + progress;
          for (let i = 0; i < 2; i++) {
            const ringR = sz * (0.8 + progress * 1.2) * (0.5 + i * 0.5);
            ctx.globalAlpha = (0.15 + progress * 0.4) * pulse * (1 - i * 0.3);
            NEON.draw.circleStroke(ctx, sx, sy, ringR);
          }
          // Directional aim line (like SNIPER but shorter)
          const aimLen = 3 * TILE * progress;
          ctx.globalAlpha = (0.2 + progress * 0.5) * pulse;
          ctx.lineWidth = 1 + progress;
          ctx.setLineDash([3, 5 - progress * 3]);
          NEON.draw.line(ctx, sx, sy, sx + this._plAimDx * aimLen, sy + this._plAimDy * aimLen);
          ctx.setLineDash([]);
          ctx.restore();
        } else {
          // Idle: subtle core glow
          ctx.save();
          ctx.globalAlpha = 0.15 + Math.sin(this.bobAngle * 3) * 0.08;
          ctx.fillStyle = '#44ddff';
          ctx.shadowBlur = 6;
          ctx.shadowColor = '#44ddff';
          NEON.draw.circle(ctx, sx, sy, sz * 0.4);
          ctx.restore();
        }
      }
      // ECHOER: violet sonar — when aiming, draw the dashed lane to the
      // locked past-position AND a translucent ghost of the player at
      // that point. When idle, a quiet pulsing core. Lane + ghost are
      // both telegraphed from lock time so the player has the full
      // ECHOER_TELEGRAPH window to read them — fairness > drama.
      if (this.type === 'ECHOER') {
        ctx.save();
        if (this._ecState === 'aiming' && this._ecAimTimer > 0) {
          const total = 0.8; // ECHOER_TELEGRAPH — kept inline (host has TILE etc.)
          const progress = 1 - Math.max(0, Math.min(1, this._ecAimTimer / total));
          const lx = this._ecLockX * TILE - camX;
          const ly = this._ecLockY * TILE - camY;
          // Pulsing dashed lane from echoer to lock
          const pulse = 0.5 + 0.5 * Math.sin(progress * 18);
          ctx.globalAlpha = (0.18 + progress * 0.5) * pulse;
          ctx.strokeStyle = '#aa66ff';
          ctx.shadowBlur = 6 + progress * 10;
          ctx.shadowColor = '#aa66ff';
          ctx.lineWidth = 1 + progress * 1.5;
          ctx.setLineDash([4, 6 - progress * 4]);
          NEON.draw.line(ctx, sx, sy, lx, ly);
          ctx.setLineDash([]);
          // Translucent ghost of the player at the past position — a
          // small filled circle + ring, sized roughly like the player.
          ctx.globalAlpha = 0.22 + progress * 0.4;
          ctx.fillStyle = '#aa66ff';
          NEON.draw.circle(ctx, lx, ly, TILE * 0.32);
          ctx.globalAlpha = 0.35 + progress * 0.45;
          ctx.strokeStyle = '#ddaaff';
          ctx.lineWidth = 1.2 + progress * 0.8;
          NEON.draw.circleStroke(ctx, lx, ly, TILE * 0.42 + progress * 2);
        } else {
          // Idle: faint sonar pulse on the body
          const pulse = 0.5 + 0.5 * Math.sin(this.bobAngle * 2);
          ctx.globalAlpha = 0.15 + 0.1 * pulse;
          ctx.strokeStyle = '#aa66ff';
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#aa66ff';
          ctx.lineWidth = 1;
          NEON.draw.circleStroke(ctx, sx, sy, sz * (1.0 + pulse * 0.4));
        }
        ctx.restore();
      }
      // PROPHET: amber future-sight — when aiming, draw the dashed lane
      // to the predicted future position AND a translucent ghost of the
      // player at that point. Visually parallel to ECHOER (same lane +
      // ghost vocabulary) but in warm amber to signal the inverse niche
      // to the player ("this one fires AHEAD"). Both lane and ghost are
      // telegraphed from lock-time so the player has the full
      // PROPHET_TELEGRAPH window to read them — fairness > drama.
      if (this.type === 'PROPHET') {
        ctx.save();
        if (this._prState === 'aiming' && this._prAimTimer > 0) {
          const total = 0.7; // PROPHET_TELEGRAPH — kept inline (host has TILE etc.)
          const progress = 1 - Math.max(0, Math.min(1, this._prAimTimer / total));
          const lx = this._prLockX * TILE - camX;
          const ly = this._prLockY * TILE - camY;
          // Pulsing dashed lane from prophet to lock
          const pulse = 0.5 + 0.5 * Math.sin(progress * 18);
          ctx.globalAlpha = (0.18 + progress * 0.5) * pulse;
          ctx.strokeStyle = '#ffaa22';
          ctx.shadowBlur = 6 + progress * 10;
          ctx.shadowColor = '#ffaa22';
          ctx.lineWidth = 1 + progress * 1.5;
          ctx.setLineDash([4, 6 - progress * 4]);
          NEON.draw.line(ctx, sx, sy, lx, ly);
          ctx.setLineDash([]);
          // Translucent ghost of the player at the future position.
          ctx.globalAlpha = 0.22 + progress * 0.4;
          ctx.fillStyle = '#ffaa22';
          NEON.draw.circle(ctx, lx, ly, TILE * 0.32);
          ctx.globalAlpha = 0.35 + progress * 0.45;
          ctx.strokeStyle = '#ffd680';
          ctx.lineWidth = 1.2 + progress * 0.8;
          NEON.draw.circleStroke(ctx, lx, ly, TILE * 0.42 + progress * 2);
        } else {
          // Idle: faint amber pulse on the body
          const pulse = 0.5 + 0.5 * Math.sin(this.bobAngle * 2);
          ctx.globalAlpha = 0.15 + 0.1 * pulse;
          ctx.strokeStyle = '#ffaa22';
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#ffaa22';
          ctx.lineWidth = 1;
          NEON.draw.circleStroke(ctx, sx, sy, sz * (1.0 + pulse * 0.4));
        }
        ctx.restore();
      }
      // CRYOPHAGE: cyan + lattice telegraph during aiming; faint icy halo
      // during idle. The 5-tile lattice geometry mirrors the patch commit
      // in aiCryophage exactly (centre + 4 cardinals at the locked tile),
      // so what the player SEES is exactly where the patches WILL spawn.
      if (this.type === 'CRYOPHAGE') {
        ctx.save();
        if (this._cyState === 'aiming' && this._cyAimTimer > 0) {
          const progress = 1 - Math.max(0, Math.min(1, this._cyAimTimer / CRYOPHAGE_TELEGRAPH));
          // Render the SAME pre-filtered tile list the commit will use,
          // so wall/OOB tiles never display a phantom warning that
          // produces no patch. (Telegraph/commit parity caught by codex
          // + opus on initial review.)
          const tiles = /** @type {{x:number,y:number}[]} */ (this._cyTiles || []);
          const cx = this._cyLockX, cy = this._cyLockY;
          const pulse = 0.5 + 0.5 * Math.sin(progress * 18);
          // Per-tile cyan square + plus glyph
          for (const t of tiles) {
            const tx = t.x * TILE - camX;
            const ty = t.y * TILE - camY;
            const r = TILE * 0.42;
            ctx.globalAlpha = (0.18 + progress * 0.45) * pulse;
            ctx.fillStyle = '#88ddff';
            ctx.shadowBlur = 4 + progress * 8;
            ctx.shadowColor = '#88ddff';
            ctx.fillRect(tx - r, ty - r, r * 2, r * 2);
            ctx.globalAlpha = 0.4 + progress * 0.5;
            ctx.strokeStyle = '#cceeff';
            ctx.lineWidth = 1.2 + progress * 1.0;
            ctx.strokeRect(tx - r, ty - r, r * 2, r * 2);
          }
          // Faint connecting lines from cryophage to centre tile so the
          // player can trace which lock belongs to which mob (matters in
          // crowded rooms with multiple cryophages telegraphing at once).
          ctx.globalAlpha = 0.25 + progress * 0.4;
          ctx.strokeStyle = '#88ddff';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 5]);
          NEON.draw.line(ctx, sx, sy, cx * TILE - camX, cy * TILE - camY);
          ctx.setLineDash([]);
        } else {
          // Idle: faint icy halo on the body
          const pulse = 0.5 + 0.5 * Math.sin(this.bobAngle * 2);
          ctx.globalAlpha = 0.15 + 0.1 * pulse;
          ctx.strokeStyle = '#88ddff';
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#88ddff';
          ctx.lineWidth = 1;
          NEON.draw.circleStroke(ctx, sx, sy, sz * (1.0 + pulse * 0.4));
        }
        ctx.restore();
      }
      // RESONATOR: pink sonic cone wedge during telegraph; faint pulsing
      // core during idle/charge; brief flash on the recovery transition.
      // Wedge geometry mirrors the hit-test in aiResonator (apex at body,
      // half-angle = RESONATOR_HALF_RAD, radius = RESONATOR_RANGE * TILE)
      // so what the player SEES is exactly what the cone HITS.
      if (this.type === 'RESONATOR') {
        ctx.save();
        if (this._rsState === 'telegraph' && this._rsTele > 0) {
          // Drive every visual from the gameplay constants — single source of
          // truth so any balance tweak to range/cone/telegraph stays in
          // lock-step with the hit-test in aiResonator.
          const progress = 1 - Math.max(0, Math.min(1, this._rsTele / RESONATOR_TELEGRAPH));
          const ax = this._rsAimDx, ay = this._rsAimDy;
          const aimAngle = Math.atan2(ay, ax);
          const halfRad = RESONATOR_HALF_RAD;
          const radPx = RESONATOR_RANGE * TILE;
          // Filled wedge — translucent pink that intensifies as fire approaches.
          ctx.fillStyle = '#ff66cc';
          ctx.globalAlpha = 0.10 + progress * 0.30;
          ctx.shadowBlur = 6 + progress * 14;
          ctx.shadowColor = '#ff66cc';
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.arc(sx, sy, radPx, aimAngle - halfRad, aimAngle + halfRad);
          ctx.closePath();
          ctx.fill();
          // Edge lines for clarity
          ctx.globalAlpha = 0.40 + progress * 0.50;
          ctx.strokeStyle = '#ffaaee';
          ctx.lineWidth = 1.2 + progress * 1.0;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(aimAngle - halfRad) * radPx,
                     sy + Math.sin(aimAngle - halfRad) * radPx);
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(aimAngle + halfRad) * radPx,
                     sy + Math.sin(aimAngle + halfRad) * radPx);
          ctx.stroke();
          // Pulsing arc rim
          const pulse = 0.5 + 0.5 * Math.sin(progress * 22);
          ctx.globalAlpha = (0.25 + progress * 0.55) * pulse;
          ctx.lineWidth = 1.5 + progress * 1.2;
          ctx.beginPath();
          ctx.arc(sx, sy, radPx, aimAngle - halfRad, aimAngle + halfRad);
          ctx.stroke();
        } else {
          // Idle/recovery: faint pink core pulse on the body — ambient threat.
          const pulse = 0.5 + 0.5 * Math.sin(this.bobAngle * 2);
          ctx.globalAlpha = 0.18 + 0.12 * pulse;
          ctx.strokeStyle = '#ff66cc';
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#ff66cc';
          ctx.lineWidth = 1.2;
          NEON.draw.circleStroke(ctx, sx, sy, sz * (1.0 + pulse * 0.4));
        }
        ctx.restore();
      }
      // MIRROR: lime-green ambient pulse during idle/recovery; during the
      // telegraph window, draw a dashed aim line from the body to the locked
      // target plus a colour-tinted ring on the body in the player's last
      // shot colour — that's the "I'm about to fire YOUR gun back" tell.
      // Aim line/ring tinting drives the entire visual from the cached lock
      // (this._miAimDx/Dy + this._miShotColour), so what the player SEES is
      // exactly what the projectile WILL be.
      if (this.type === 'MIRROR') {
        ctx.save();
        if (this._miState === 'telegraph' && this._miTele > 0) {
          const progress = 1 - Math.max(0, Math.min(1, this._miTele / MIRROR_TELEGRAPH));
          const ax = this._miAimDx, ay = this._miAimDy;
          const radPx = MIRROR_RANGE * TILE;
          const shotColour = this._miShotColour || '#88ff44';
          // Dashed aim line in the SHOT'S colour (the player's last weapon
          // colour) — telegraphs both direction and what kind of shot.
          ctx.globalAlpha = 0.30 + progress * 0.55;
          ctx.strokeStyle = shotColour;
          ctx.shadowBlur = 6 + progress * 12;
          ctx.shadowColor = shotColour;
          ctx.lineWidth = 1.4 + progress * 1.6;
          ctx.setLineDash([5, 7 - progress * 4]);
          ctx.lineDashOffset = -progress * 18;
          NEON.draw.line(ctx, sx, sy, sx + ax * radPx, sy + ay * radPx);
          ctx.setLineDash([]);
          // Body ring in the shot colour — pulses faster as fire approaches.
          const pulse = 0.5 + 0.5 * Math.sin(progress * 22);
          ctx.globalAlpha = (0.35 + progress * 0.50) * pulse;
          ctx.lineWidth = 1.6 + progress * 1.4;
          NEON.draw.circleStroke(ctx, sx, sy, sz * (1.2 + progress * 0.4));
          // Outer lime ring — mob identity stays readable even while the
          // inner ring takes the shot colour.
          ctx.globalAlpha = 0.25 + progress * 0.30;
          ctx.strokeStyle = '#88ff44';
          ctx.lineWidth = 1.2;
          NEON.draw.circleStroke(ctx, sx, sy, sz * 1.55);
        } else {
          // Idle/recovery: faint lime core pulse on the body — ambient threat.
          const pulse = 0.5 + 0.5 * Math.sin(this.bobAngle * 2);
          ctx.globalAlpha = 0.18 + 0.12 * pulse;
          ctx.strokeStyle = '#88ff44';
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#88ff44';
          ctx.lineWidth = 1.2;
          NEON.draw.circleStroke(ctx, sx, sy, sz * (1.0 + pulse * 0.4));
        }
        ctx.restore();
      }
      // REAPER: blood-red ambient body aura (idle), brighter during
      // telegraph/frenzy. The PLAYER-ring telegraph is drawn from a
      // separate game-loop pass (game.js) so it remains visible even
      // when the reaper itself is off-screen — culling here would
      // suppress the warning for an active threat.
      if (this.type === 'REAPER') {
        ctx.save();
        const auraIntensity = this._reFrenzied ? 1.0 : (this._reState === 'telegraph' ? 0.7 : 0.35);
        const bodyPulse = 0.5 + 0.5 * Math.sin(this.bobAngle * (this._reFrenzied ? 8 : 3));
        ctx.globalAlpha = (0.20 + 0.25 * bodyPulse) * auraIntensity;
        ctx.strokeStyle = '#cc1144';
        ctx.shadowBlur = 8 + bodyPulse * 8 * auraIntensity;
        ctx.shadowColor = '#ff3366';
        ctx.lineWidth = 1.4 + auraIntensity * 1.2;
        NEON.draw.circleStroke(ctx, sx, sy, sz * (1.1 + bodyPulse * 0.4));
        if (this._reFrenzied || this._reState === 'telegraph') {
          ctx.globalAlpha = 0.55 * auraIntensity;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          const a0 = this.bobAngle * 2;
          ctx.arc(sx, sy, sz * 1.45, a0, a0 + Math.PI * 0.85);
          ctx.stroke();
        }
        ctx.restore();
      }
      // GHOST_PROJECTOR: stationary lens with violet pulse. Brighter and
      // faster pulse while a memory is pending (telegraphs the haunt
      // countdown — a player who recognises this can rush the projector
      // to interrupt). Subtle ring while haunting (a ghost is out).
      if (this.type === 'GHOST_PROJECTOR') {
        ctx.save();
        const pendingProgress = this._gpPendingType
          ? 1 - Math.max(0, Math.min(1, this._gpPendingDelay / GHOST_PROJECTOR_DELAY))
          : 0;
        const haunting = !!(this._gpActiveGhost && !this._gpActiveGhost.dead);
        const pulseRate = this._gpPendingType ? (3 + pendingProgress * 18) : 1.5;
        const pulse = 0.5 + 0.5 * Math.sin(this.bobAngle * pulseRate);
        // Body aura
        const intensity = this._gpPendingType ? (0.4 + pendingProgress * 0.5) : (haunting ? 0.3 : 0.18);
        ctx.globalAlpha = (0.18 + 0.30 * pulse) * (intensity / 0.4);
        ctx.strokeStyle = '#cc99ff';
        ctx.shadowBlur = 8 + pulse * 10 * intensity;
        ctx.shadowColor = '#cc99ff';
        ctx.lineWidth = 1.4 + intensity * 1.4;
        NEON.draw.circleStroke(ctx, sx, sy, sz * (1.0 + pulse * 0.4));
        // Pending memory: dashed ring at the spawn site, growing as delay
        // approaches 0 — fairness window so the player can pre-empt.
        if (this._gpPendingType) {
          const gx = this._gpPendingX * TILE - camX;
          const gy = this._gpPendingY * TILE - camY;
          ctx.globalAlpha = 0.30 + pendingProgress * 0.55;
          ctx.lineWidth = 1.2 + pendingProgress * 1.4;
          ctx.setLineDash([4, 6]);
          ctx.lineDashOffset = -this.bobAngle * 18;
          NEON.draw.circleStroke(ctx, gx, gy, TILE * (0.45 + pendingProgress * 0.45));
          ctx.setLineDash([]);
          // Spectral link from projector to spawn site (faint dashed line)
          ctx.globalAlpha = 0.18 + pendingProgress * 0.32;
          ctx.lineWidth = 1.0;
          ctx.setLineDash([3, 8]);
          ctx.lineDashOffset = -this.bobAngle * 8;
          NEON.draw.line(ctx, sx, sy, gx, gy);
          ctx.setLineDash([]);
        }
        ctx.restore();
      }
      if (this.type === 'SUMMONER') {
        ctx.save();
        const sPulse = 0.15 + 0.1 * Math.sin(this.bobAngle * 2);
        ctx.globalAlpha = sPulse;
        ctx.strokeStyle = '#bb44ff';
        ctx.shadowBlur = 10 + Math.sin(this.bobAngle * 1.5) * 5;
        ctx.shadowColor = '#bb44ff';
        ctx.lineWidth = 1.5;
        const ringR = sz * 1.6 + Math.sin(this.bobAngle * 3) * 3;
        NEON.draw.circleStroke(ctx, sx, sy, ringR);
        // Inner rotating dashes
        ctx.globalAlpha = sPulse * 1.2;
        ctx.setLineDash([6, 10]);
        ctx.lineDashOffset = this.bobAngle * 12;
        NEON.draw.circleStroke(ctx, sx, sy, ringR * 0.7);
        ctx.setLineDash([]);
        ctx.restore();
      }
      // HEALER: teal cross + heal beam to target
      if (this.type === 'HEALER') {
        ctx.save();
        const hPulse = 0.3 + 0.15 * Math.sin(this.bobAngle * 2.5);
        ctx.globalAlpha = hPulse;
        ctx.strokeStyle = '#44ffaa';
        ctx.shadowBlur = 8 + Math.sin(this.bobAngle * 2) * 4;
        ctx.shadowColor = '#44ffaa';
        ctx.lineWidth = 2;
        // Cross symbol above head
        const crossY = sy - sz * 0.8;
        const cs = 4;
        ctx.beginPath();
        ctx.moveTo(sx - cs, crossY); ctx.lineTo(sx + cs, crossY);
        ctx.moveTo(sx, crossY - cs); ctx.lineTo(sx, crossY + cs);
        ctx.stroke();
        // Heal beam
        if (this._healBeam) {
          const beamAlpha = Math.min(1, this._healBeam.t / 0.2) * 0.6;
          ctx.globalAlpha = beamAlpha;
          ctx.strokeStyle = '#44ffaa';
          ctx.shadowBlur = 12;
          ctx.lineWidth = 2 + Math.sin(this.bobAngle * 6) * 1;
          ctx.setLineDash([4, 4]);
          ctx.lineDashOffset = -this.bobAngle * 8;
          const bx = this._healBeam.tx * TILE - camX;
          const by = this._healBeam.ty * TILE - camY;
          NEON.draw.line(ctx, sx, sy, bx, by);
          ctx.setLineDash([]);
        }
        ctx.restore();
      }
      // CHARGER: windup glow + charge trail
      if (this.type === 'CHARGER') {
        if (this._chgState === 'windup') {
          ctx.save();
          const wPulse = 0.3 + 0.3 * Math.sin(this.bobAngle * 8);
          ctx.globalAlpha = wPulse;
          ctx.shadowBlur = 14 + wPulse * 8;
          ctx.shadowColor = '#ff6600';
          ctx.fillStyle = '#ff6600';
          NEON.draw.circle(ctx, sx, sy, sz * 1.6);
          // Direction indicator line
          ctx.globalAlpha = 0.6;
          ctx.strokeStyle = '#ff6600';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.lineDashOffset = -this.bobAngle * 12;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + (this._chgDx || 0) * sz * 3, sy + (this._chgDy || 0) * sz * 3);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        } else if (this._chgState === 'charging') {
          ctx.save();
          ctx.globalAlpha = 0.5;
          ctx.shadowBlur = 18;
          ctx.shadowColor = '#ff6600';
          ctx.fillStyle = '#ff4400';
          NEON.draw.circle(ctx, sx, sy, sz * 1.8);
          ctx.restore();
        } else if (this.stunTimer > 0 && this._chgCooldown > 2.0) {
          // Post-charge daze: spinning stars
          ctx.save();
          ctx.globalAlpha = 0.6;
          ctx.fillStyle = '#ffcc00';
          ctx.shadowBlur = 4;
          ctx.shadowColor = '#ffcc00';
          const starY = sy - sz - 6;
          for (let i = 0; i < 3; i++) {
            const a = this.bobAngle * 3 + (i / 3) * TWO_PI;
            const starX = sx + Math.cos(a) * 6;
            const starYi = starY + Math.sin(a) * 2;
            NEON.draw.circle(ctx, starX, starYi, 1.5);
          }
          ctx.restore();
        }
      }
      // LEAPER: windup glow + targeting reticle + airborne shadow/height + recovery daze
      if (this.type === 'LEAPER') {
        if (this._lpState === 'windup') {
          // Pulsing green glow around leaper
          ctx.save();
          const wPulse = 0.3 + 0.3 * Math.sin(this.bobAngle * 8);
          ctx.globalAlpha = wPulse;
          ctx.shadowBlur = 14 + wPulse * 8;
          ctx.shadowColor = '#22ff88';
          ctx.fillStyle = '#22ff88';
          NEON.draw.circle(ctx, sx, sy, sz * 1.6);
          ctx.restore();
          // Targeting reticle at locked target position
          if (this._lpTargetX != null) {
            ctx.save();
            const rtx = this._lpTargetX * TILE - camX;
            const rty = this._lpTargetY * TILE - camY;
            const rPulse = 0.3 + 0.2 * Math.sin(this.bobAngle * 10);
            ctx.globalAlpha = rPulse;
            ctx.strokeStyle = '#22ff88';
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#22ff88';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.lineDashOffset = -this.bobAngle * 8;
            NEON.draw.circleStroke(ctx, rtx, rty, TILE * 2);
            // Inner crosshair
            ctx.setLineDash([]);
            ctx.globalAlpha = rPulse * 0.8;
            const ch = 4;
            ctx.beginPath();
            ctx.moveTo(rtx - ch, rty); ctx.lineTo(rtx + ch, rty);
            ctx.moveTo(rtx, rty - ch); ctx.lineTo(rtx, rty + ch);
            ctx.stroke();
            ctx.restore();
          }
        } else if (this._lpState === 'airborne') {
          // Shadow circle on ground (grows as leaper descends)
          const progress = 1 - Math.max(0, this._lpAirTime) / 0.35;
          const shadowR = sz * (0.5 + progress * 1.0);
          const landSx = this._lpTargetX * TILE - camX;
          const landSy = this._lpTargetY * TILE - camY;
          ctx.save();
          ctx.globalAlpha = 0.15 + progress * 0.2;
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.ellipse(landSx, landSy, shadowR, shadowR * 0.5, 0, 0, TWO_PI);
          ctx.fill();
          // Shockwave radius indicator
          ctx.globalAlpha = 0.1 + progress * 0.15;
          ctx.strokeStyle = '#22ff88';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 5]);
          NEON.draw.circleStroke(ctx, landSx, landSy, TILE * 2);
          ctx.setLineDash([]);
          ctx.restore();
        } else if (this._lpState === 'recovery') {
          // Dazed spinning stars (similar to charger post-charge)
          ctx.save();
          ctx.globalAlpha = 0.6;
          ctx.fillStyle = '#22ff88';
          ctx.shadowBlur = 4;
          ctx.shadowColor = '#22ff88';
          const starY = sy - sz - 6;
          for (let i = 0; i < 3; i++) {
            const a = this.bobAngle * 3 + (i / 3) * TWO_PI;
            const starX = sx + Math.cos(a) * 6;
            const starYi = starY + Math.sin(a) * 2;
            NEON.draw.circle(ctx, starX, starYi, 1.5);
          }
          ctx.restore();
        }
      }
      // PHANTOM: cloaked shimmer + telegraph ring
      if (this.type === 'PHANTOM') {
        if (this._phState === 'cloaked') {
          // Subtle digital glitch shimmer
          ctx.save();
          const shPulse = 0.04 + 0.04 * Math.sin(this.bobAngle * 6);
          ctx.globalAlpha = shPulse;
          ctx.shadowBlur = 8;
          ctx.shadowColor = this.colour;
          ctx.strokeStyle = this.colour;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.lineDashOffset = -this.bobAngle * 10;
          NEON.draw.circleStroke(ctx, sx, sy, sz * 1.4);
          ctx.setLineDash([]);
          ctx.restore();
        } else if (this._phState === 'telegraph') {
          // Expanding purple warning ring
          ctx.save();
          const tPulse = 0.4 + 0.3 * Math.sin(this.bobAngle * 10);
          ctx.globalAlpha = tPulse;
          ctx.shadowBlur = 12 + tPulse * 8;
          ctx.shadowColor = this.colour;
          ctx.strokeStyle = this.colour;
          ctx.lineWidth = 2;
          const ringR = sz * (1.2 + 0.8 * (1 - Math.max(0, this._phTimer) / 0.4));
          NEON.draw.circleStroke(ctx, sx, sy, ringR);
          // Aim indicator
          ctx.globalAlpha = 0.5;
          ctx.setLineDash([3, 3]);
          ctx.lineDashOffset = -this.bobAngle * 15;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + (this._phAimDx || 0) * sz * 3, sy + (this._phAimDy || 0) * sz * 3);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      }
      // Bounty target: gold aura + crown marker
      if (this._isBounty) {
        ctx.save();
        const bPulse = 0.3 + 0.15 * Math.sin(this.bobAngle * 2.5);
        ctx.globalAlpha = bPulse;
        ctx.shadowBlur = 16 + Math.sin(this.bobAngle * 1.5) * 6;
        ctx.shadowColor = '#ffd700';
        ctx.fillStyle = '#ffd700';
        NEON.draw.circle(ctx, sx, sy, sz * 1.4);
        ctx.restore();
        // Crown icon above head
        ctx.save();
        ctx.fillStyle = '#ffd700';
        ctx.shadowBlur = 4; ctx.shadowColor = '#ffd700';
        const cy2 = sy - sz - 5;
        ctx.beginPath();
        ctx.moveTo(sx - 4, cy2 + 3);
        ctx.lineTo(sx - 4, cy2);
        ctx.lineTo(sx - 2, cy2 + 2);
        ctx.lineTo(sx, cy2 - 1);
        ctx.lineTo(sx + 2, cy2 + 2);
        ctx.lineTo(sx + 4, cy2);
        ctx.lineTo(sx + 4, cy2 + 3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      // elite diamond marker (coloured by affix)
      if (this.elite) {
        const affCol = this.eliteAffix ? ELITE_AFFIXES[this.eliteAffix].colour : '#ffffff';
        ctx.fillStyle=affCol;
        ctx.shadowColor=affCol;
        ctx.shadowBlur=6;
        ctx.beginPath();
        ctx.moveTo(sx, sy - sz - 4);
        ctx.lineTo(sx + 3, sy - sz - 1);
        ctx.lineTo(sx, sy - sz + 2);
        ctx.lineTo(sx - 3, sy - sz - 1);
        ctx.closePath();
        ctx.fill();
      }
      // SHIELDED affix: blue shield ring
      if (this.eliteAffix === 'SHIELDED' && this.shieldHp > 0) {
        ctx.save();
        const sFrac = this.shieldHp / this.shieldMax;
        ctx.strokeStyle = '#4488ff';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 8 + Math.sin(this.bobAngle * 3) * 4;
        ctx.shadowColor = '#4488ff';
        ctx.globalAlpha = 0.5 + sFrac * 0.4;
        NEON.draw.arcStroke(ctx, sx, sy, sz * 1.3, 0, TWO_PI * sFrac);
        ctx.restore();
      }
      // BERSERKER affix: intensifying red aura
      if (this.eliteAffix === 'BERSERKER') {
        const rage = 1 - this.hp / this.maxHp; // 0→1 as HP drops
        if (rage > 0.1) {
          ctx.save();
          ctx.globalAlpha = rage * 0.35;
          ctx.shadowBlur = 10 + rage * 12;
          ctx.shadowColor = '#ff2222';
          ctx.fillStyle = '#ff2222';
          NEON.draw.circle(ctx, sx, sy, sz * (1.0 + rage * 0.4));
          ctx.restore();
        }
      }
      // PHASING affix: ghost flicker during immune window
      if (this.eliteAffix === 'PHASING' && this.phaseImmune) {
        ctx.globalAlpha = 0.15 + Math.sin(this.bobAngle * 12) * 0.1;
      }
      // VOLATILE affix: pulsing orange warning ring
      if (this.eliteAffix === 'VOLATILE') {
        ctx.save();
        const vPulse = 0.3 + 0.15 * Math.sin(this.bobAngle * 4);
        ctx.globalAlpha = vPulse;
        ctx.strokeStyle = '#ff6600';
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 6 + Math.sin(this.bobAngle * 4) * 3;
        ctx.shadowColor = '#ff6600';
        NEON.draw.circleStroke(ctx, sx, sy, sz * 1.4);
        ctx.restore();
      }
      // FRENZY affix: intensifying red-orange aura per stack
      if (this.eliteAffix === 'FRENZY' && this.frenzyStacks > 0) {
        ctx.save();
        const fInt = this.frenzyStacks * 0.25;
        ctx.globalAlpha = fInt;
        ctx.shadowBlur = 8 + this.frenzyStacks * 6;
        ctx.shadowColor = '#ff4466';
        ctx.fillStyle = '#ff4466';
        NEON.draw.circle(ctx, sx, sy, sz * (1.1 + this.frenzyStacks * 0.15));
        ctx.restore();
      }
      // Shield Generator protection: subtle cyan glow
      if (isEnemyShieldGenProtected(this)) {
        ctx.save();
        ctx.globalAlpha = 0.15 + 0.1 * Math.sin(this.bobAngle * 2);
        ctx.shadowBlur = 10; ctx.shadowColor = '#00ccff';
        ctx.fillStyle = '#00ccff';
        NEON.draw.circle(ctx, sx, sy, sz * 1.2);
        ctx.restore();
      }
      // small hp bar
      if (this.hp<this.maxHp || this.shieldHp > 0 || this._isBounty) {
        ctx.shadowBlur=0;
        const barW = this._isBounty ? 20 : 16, barH = 2, barY = sy - 12;
        ctx.fillStyle='#333';
        ctx.fillRect(sx-barW/2, barY, barW, barH);
        // HP portion
        const hpCol = this._isBounty ? '#ffd700' : this.elite ? '#ffffff' : this.colour;
        ctx.fillStyle=hpCol;
        ctx.fillRect(sx-barW/2, barY, barW*(this.hp/this.maxHp), barH);
        // "BOUNTY" label above HP bar
        if (this._isBounty) {
          ctx.save();
          ctx.font='bold 7px monospace'; ctx.textAlign='center';
          ctx.fillStyle='#ffd700'; ctx.shadowBlur=3; ctx.shadowColor='#ffd700';
          ctx.fillText('BOUNTY', sx, barY - 3);
          ctx.restore();
        }
        // Shield portion (stacked above HP bar)
        if (this.shieldHp > 0) {
          ctx.fillStyle='#4488ff';
          ctx.fillRect(sx-barW/2, barY - 3, barW*(this.shieldHp/this.shieldMax), barH);
        }
      }
    }
    // Burn indicator — flickering orange underglow
    if (this.burnTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.4 + Math.sin(this.bobAngle * 10) * 0.2;
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#ff6600';
      ctx.fillStyle = '#ff6600';
      const bsz = this.isBoss ? 24 : TILE * 0.5;
      NEON.draw.circle(ctx, sx, sy, bsz * 0.7);
      ctx.restore();
    }
    // Frost indicator — cyan tint overlay
    if (this.slowTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#66ccff';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#66ccff';
      const fsz = this.isBoss ? 24 : TILE * 0.5;
      NEON.draw.circle(ctx, sx, sy, fsz * 0.8);
      ctx.restore();
    }
    ctx.restore();
  }
}

// ─── Enemy Weights & Spawning ─────────────────────────────────────────────────
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
  let r = Math.random() * total;
  for (const { type, w } of weights) { r -= w; if (r <= 0) return type; }
  return 'GUARD';
}

/**
 * Queue a translucent ghost replay of a previously-killed enemy. Used by
 * GHOST_PROJECTOR. Pushes the spawn intent onto pendingEnemySpawns so the
 * ghost is materialised AFTER the current enemy update loop completes —
 * the deferred-spawn convention every other in-loop spawner uses
 * (SPLITTER → SHARDs, SUMMONER → DRONEs, BRUTE → adds, CONDUCTOR → adds).
 * Without deferral the ghost gets `update()` in the same frame it spawns
 * because for-of over the live `enemies` array visits appended entries.
 *
 * The flush in game.js (`pendingEnemySpawns` block) recognises the
 * `_ghIsGhost` marker and applies the HP/atk/xpValue mutations and back-
 * assigns the live ref to projector._gpActiveGhost.
 *
 * Returns true if a spawn was queued, false on validation failure.
 *
 * @param {string} type      ghostable enemy type from GHOSTABLE_TYPES
 * @param {number} x         tile x
 * @param {number} y         tile y
 * @param {any}    room      room reference (for AI room-gating)
 * @param {any}    projector the GHOST_PROJECTOR claiming this ghost
 * @returns {boolean}
 */
function spawnGhost(type, x, y, room, projector) {
  if (!_EG || !GHOSTABLE_TYPES.has(type)) return false;
  const floorNum = _EG.floor || 1;
  pendingEnemySpawns.push({
    type, x, y, floor: floorNum, room,
    _ghIsGhost: true,
    _ghOwnerProjector: projector,
  });
  return true;
}

/**
 * @param {any} [type]
 * @param {any} [x]
 * @param {any} [y]
 * @param {any} [floorNum]
 * @param {any} [room]
 * @param {any} [allowElite]
 */
function spawnEnemy(type,x,y,floorNum,room,allowElite) {
  const scale=1+0.15*(floorNum-1);
  const d=getDiff();
  let /** @type {number} */ hp = 0, /** @type {number} */ atk = 0, /** @type {number} */ spd = 0, /** @type {number} */ xpVal = 0, /** @type {string} */ colour = '#ffffff';
  switch(type) {
    // 2026-04-26: doubled all non-boss base HP per playtester feedback
    // ("mobs feel like 1-shot kills since the beginning, every floor").
    // Bosses (SENTINEL/WARDEN/HIVE/CONDUCTOR/OMEGA/GENESIS) intentionally
    // unchanged — phase transitions are HP-ratio based and current tuning
    // makes those fights feel right; doubling would just stretch them.
    // Difficulty multipliers in content.js DIFFICULTIES still apply on top
    // (EASY 0.75 / NORMAL 1.0 / HARD 1.5 / NIGHTMARE 2.0), so NIGHTMARE
    // players now effectively get 4x base. Watch for feedback.
    case 'GUARD':   hp=80;  atk=8;  spd=2;   xpVal=20; colour='#ff3333'; break;
    case 'TURRET':  hp=50;  atk=12; spd=0;   xpVal=15; colour='#ffb700'; break;
    case 'CRAWLER': hp=40;  atk=6;  spd=4;   xpVal=10; colour='#39ff14'; break;
    case 'SCORCHER':hp=56;  atk=9;  spd=2.6; xpVal=24; colour='#ff5522'; break;
    case 'BRUTE':   hp=140; atk=16; spd=1.6; xpVal=30; colour='#cc3344'; break;
    case 'PHANTOM': hp=70;  atk=10; spd=2.5; xpVal=30; colour='#cc00ff'; break;
    case 'DRONE':   hp=30;  atk=8;  spd=3;   xpVal=12; colour='#00aaff'; break;
    case 'SHIELDER':hp=100; atk=10; spd=1.5; xpVal=25; colour='#66eeff'; break;
    case 'GRENADIER':hp=60; atk=10; spd=2;   xpVal=20; colour='#ff6622'; break;
    case 'SPLITTER':hp=80;  atk=8;  spd=2.2; xpVal=25; colour='#00ff88'; break;
    case 'TELEPORTER':hp=50;atk=12; spd=0;   xpVal=22; colour='#ff44ff'; break;
    case 'SNIPER':   hp=40;atk=15; spd=2.5; xpVal=25; colour='#ff2266'; break;
    case 'SUMMONER': hp=70;atk=8;  spd=1.5; xpVal=30; colour='#bb44ff'; break;
    case 'HEALER':  hp=50;atk=6;  spd=1.8; xpVal=22; colour='#44ffaa'; break;
    case 'CHARGER': hp=90;atk=14; spd=1.5; xpVal=22; colour='#ff6600'; break;
    case 'LEAPER':  hp=60;atk=11; spd=3.0; xpVal=22; colour='#22ff88'; break;
    case 'REFLECTOR':hp=80;atk=10; spd=1.8; xpVal=28; colour='#88ddff'; break;
    case 'DISRUPTOR':hp=60;atk=9;  spd=2.0; xpVal=25; colour='#ff44aa'; break;
    case 'WRAITH':  hp=70;atk=13; spd=2.8; xpVal=30; colour='#66ffcc'; break;
    case 'NEXUS':   hp=80;atk=8;  spd=1.8; xpVal=35; colour='#00eedd'; break;
    case 'SIPHON':  hp=60;atk=10; spd=2.2; xpVal=28; colour='#dd2244'; break;
    case 'GRAVITON':hp=90;atk=8;  spd=1.5; xpVal=30; colour='#8833ff'; break;
    case 'SEEKER':  hp=36;atk=12; spd=3.5; xpVal=12; colour='#ffdd00'; break;
    case 'PULSER':  hp=40;atk=12; spd=1.5; xpVal=15; colour='#44ddff'; break;
    case 'MIMIC':   hp=60;atk=14; spd=2.2; xpVal=25; colour='#cc33ff'; break;
    case 'TUNNELLER':hp=80;atk=14; spd=2.0; xpVal=26; colour='#cc8844'; break;
    case 'ECHOER':  hp=60;atk=12; spd=1.4; xpVal=26; colour='#aa66ff'; break;
    case 'PROPHET': hp=55;atk=12; spd=1.3; xpVal=28; colour='#ffaa22'; break;
    case 'RESONATOR':hp=70;atk=15; spd=0;   xpVal=28; colour='#ff66cc'; break;
    case 'MIRROR':  hp=55;atk=12; spd=0;   xpVal=26; colour='#88ff44'; break;
    case 'REAPER':  hp=70;atk=14; spd=2.4; xpVal=26; colour='#cc1144'; break;
    case 'GHOST_PROJECTOR': hp=50; atk=0; spd=0; xpVal=24; colour='#cc99ff'; break;
    case 'CRYOPHAGE': hp=70; atk=14; spd=1.0; xpVal=28; colour='#88ddff'; break;
    case 'SHARD':   hp=30;  atk=5;  spd=3.5; xpVal=8;  colour='#00cc66'; break;
    case 'SENTINEL':hp=400; atk=15; spd=1.5; xpVal=200;colour='#ff4444'; break;
    case 'WARDEN':  hp=450; atk=16; spd=1.8; xpVal=200;colour='#ff8800'; break;
    case 'HIVE':    hp=650; atk=18; spd=1.2; xpVal=350;colour='#aa00ff'; break;
    case 'CONDUCTOR':hp=700;atk=20; spd=1.4; xpVal=350;colour='#00ccff'; break;
    case 'OMEGA':   hp=1300;atk=22; spd=1.8; xpVal=800;colour='#ff00c8'; break;
    case 'GENESIS': hp=1300;atk=22; spd=1.0; xpVal=800;colour='#ffcc00'; break;
  }
  const isBoss = ['SENTINEL','WARDEN','HIVE','CONDUCTOR','OMEGA','GENESIS'].includes(type);
  // Floor modifier HP scaling (before construction so maxHp stays in sync)
  if (!isBoss) {
    if (_EG.modifier === 'SWARM')     hp = Math.round(hp * 0.6);
    if (_EG.modifier === 'FORTIFIED') hp = Math.round(hp * 1.4);
  }
  const e=new Enemy(x,y,
    Math.round(hp*scale*d.enemyHp), Math.round(atk*scale*d.enemyAtk),
    spd*d.enemySpd, xpVal, colour, type);
  e.room=room;
  e.isBoss=isBoss;
  e.elite=false;
  if (type==='PHANTOM') {
    e.visible=false;
    e._phState='cloaked';
    e._phTimer=2+Math.random()*2;
    e._phBurstLeft=0;
    e._phBurstDelay=0;
    e._phAimDx=0; e._phAimDy=0;
  }
  if (type==='SHARD') { e.isShard=true; e.attackTimer=0.5; }
  if (type==='SHIELDER') {
    // Breakable directional shield — sized at 50% of post-scale body HP so
    // the break-burst rhythm survives the 2026-04-26 mob HP doubling
    // (previously a flat 25 — now ~50 at floor 1, scales with floor/diff).
    // After break: 3s down + 2s blink-back, then restored to full.
    const shieldHp = Math.max(15, Math.round(e.maxHp * 0.5));
    e.shieldHp = shieldHp; e.shieldMax = shieldHp; e.shieldBrokenTimer = -1;
  }
  if (type==='TELEPORTER') { e.teleportTimer=0.5; e._materialize=0; e._burstLeft=0; e._warpFade=0; e._warpFromX=x; e._warpFromY=y; }
  if (type==='SNIPER') { e._laserTimer=0; e._laserTarget=null; e._sniperCooldown=1.0; e._repositionTimer=0; e._repositionTarget=null; }
  if (type==='SUMMONER') { e._summonTimer=2.0; e._summons=[]; }
  if (type==='HEALER')   { e._healTimer=1.5; e._healBeam=null; }
  if (type==='CHARGER')  { e._chgState='idle'; e._chgDx=0; e._chgDy=0; e._chgWindup=0; e._chgDur=0; e._chgCooldown=1.5; }
  if (type==='SCORCHER') { e._scTrailTimer=0.2; e._scStrafeSeed=rnd(0, TWO_PI); }
  if (type==='LEAPER')   { e._lpState='idle'; e._lpCooldown=1.0+Math.random(); e._lpWindup=0; e._lpAirTime=0; e._lpRecovery=0; e._lpTargetX=0; e._lpTargetY=0; e._lpFromX=0; e._lpFromY=0; e._lpHeight=0; }
  if (type==='REFLECTOR'){ e._rfAngle=Math.random()*TWO_PI; }
  if (type==='DISRUPTOR'){ e._dDeployTimer=2.0; e._dFireTimer=1.0; e._dFields=[]; }
  if (type==='WRAITH')   { e._wrState='phased'; e._wrTimer=1.5+Math.random(); e._wrPhased=true; e._wrFireTimer=0; e._wrHitICD=0; }
  if (type==='NEXUS')    { e._nxLinks=[]; e._nxLinkTimer=0; e._nxFireTimer=1.0; }
  if (type==='SIPHON')   { e._spFireTimer=1.0; e._spFrenzy=false; e._spDrainBeam=null; }
  if (type==='GRAVITON') { e._gvDeployTimer=2.0; e._gvFireTimer=1.5; e._gvWells=[]; }
  if (type==='SEEKER')   { e._skProximity=0; }
  if (type==='PULSER')   { e._plState='idle'; e._plTimer=0; e._plCooldown=0; e._plAimDx=0; e._plAimDy=0; }
  if (type==='MIMIC')    {
    e._disguised=true; e._revealTimer=0; e._mimicBurstTimer=0;
    e._mimicBob=Math.random()*TWO_PI;
    // Random item colour for disguise
    const itemColours=['#ff3366','#3399ff','#33ff99','#ffcc33','#cc66ff','#ff8844'];
    e._mimicColour=itemColours[Math.floor(Math.random()*itemColours.length)];
  }
  if (type==='WARDEN') { e._chargeState='idle'; e._chargeDx=0; e._chargeDy=0; e._chargeWindup=0; e._chargeDur=0; }
  if (type==='TUNNELLER') {
    // Spawn already underground — players see only a dust mound until the
    // first surface. Reuses _wrPhased (the canonical "intangible" flag) so
    // every existing hit/projectile/heal check keeps working unchanged.
    e._tnState='tunneling';
    e._tnTimer=1.5+Math.random()*0.8;   // initial burrow duration
    e._tnTargetX=x; e._tnTargetY=y;
    e._wrPhased=true;
  }
  if (type==='ECHOER') {
    // Stagger initial aim attempts so a clustered spawn doesn't fire in
    // unison. Cooldown range tuned so first lock is ~0.5–1.5s after spawn.
    e._ecState='idle';
    e._ecAimTimer=0;
    e._ecCooldown=0.5+Math.random()*1.0;
    e._ecLockX=x; e._ecLockY=y;
  }
  if (type==='PROPHET') {
    // Stagger initial aim attempts so a clustered spawn doesn't fire in
    // unison. Cooldown range tuned so first lock is ~0.6–1.6s after spawn
    // (slightly slower than ECHOER — telegraph is shorter so we give the
    // player a beat longer to walk into the room before the first shot).
    e._prState='idle';
    e._prAimTimer=0;
    e._prCooldown=0.6+Math.random()*1.0;
    e._prLockX=x; e._prLockY=y;
  }
  if (type==='RESONATOR') {
    // Stationary cone battery. Stagger initial charge so a clustered
    // spawn doesn't telegraph in unison. First charge completes ~1.5–3s
    // after spawn (player gets a beat to read the room).
    e._rsState='idle';
    e._rsCharge=1.5+Math.random()*1.5;
    e._rsTele=0;
    e._rsRec=0;
    e._rsAimDx=0; e._rsAimDy=0;
  }
  if (type==='MIRROR') {
    // Stationary mimic battery. Stagger initial charge so a clustered
    // spawn doesn't telegraph in unison. First charge completes ~1.5–3s
    // after spawn (matches RESONATOR rhythm).
    e._miState='idle';
    e._miCharge=1.5+Math.random()*1.5;
    e._miTele=0;
    e._miRec=0;
    e._miAimDx=0; e._miAimDy=0;
    // Cached kinematics resolved at lock-time and used at fire-time so the
    // player can SEE (via the telegraph colour) what shot is coming back.
    e._miShotSpd=MIRROR_PROJ_SPD_DEF;
    e._miShotColour='#88ff44';
  }
  if (type==='REAPER') {
    // Per-instance frenzy state. _reHasFrenzied is the one-shot latch that
    // gets cleared on player room change (game.js updatePlaying). _reFrenzied
    // is the live "speed boost active" flag read by aiReaper for chase spd
    // and by update() stun branch for stun immunity.
    e._reState = 'idle';
    e._reTele = 0;
    e._reFrenzy = 0;
    e._reFrenzied = false;
    e._reHasFrenzied = false;
  }
  if (type==='GHOST_PROJECTOR') {
    // Stationary lens. _gpPendingType is the most recent claimed kill
    // (set by notifyGhostProjectors); _gpPendingDelay counts down to
    // ghost spawn. _gpActiveGhost holds the live ghost ref so we don't
    // claim a new memory while a haunt is in progress. All cleared on
    // stun (see update() stun branch).
    e._gpPendingType  = null;
    e._gpPendingX     = 0;
    e._gpPendingY     = 0;
    e._gpPendingDelay = 0;
    e._gpActiveGhost  = null;
  }
  if (type==='CRYOPHAGE') {
    // Frost-patch layer. Stagger initial cooldown so a clustered spawn
    // doesn't telegraph in unison. First lock attempt ~0.8–2.0s after
    // spawn — slower than ECHOER/PROPHET because the patches commit a
    // dense area-denial footprint and need a beat for the player to
    // read the room.
    e._cyState='idle';
    e._cyAimTimer=0;
    e._cyCooldown=0.8+Math.random()*1.2;
    e._cyLockX=x; e._cyLockY=y;
  }
  if (type==='CONDUCTOR') { e._arcSpin=0; e._dischargeChannel=0; }
  if (type==='GENESIS') { e._spiralSpin=0; e._lanceTelegraph=0; e._lanceLock=null;
    e.bossTimers = { spiral: 1.0, lance: 1.5, hazard: 2.0, purge: 4.0, move: 0.5 }; }
  if (isBoss) { e.maxHp=e.hp; }
  // Elite roll: difficulty-scaled chance on floor 3+, never on bosses, snipers, summoners, or mimics
  if (allowElite !== false && !isBoss && type !== 'SNIPER' && type !== 'SUMMONER' && type !== 'HEALER' && type !== 'MIMIC' && type !== 'SIPHON' && type !== 'SEEKER' && type !== 'PULSER' && type !== 'TUNNELLER' && type !== 'ECHOER' && type !== 'RESONATOR' && type !== 'MIRROR' && type !== 'REAPER' && type !== 'GHOST_PROJECTOR' && type !== 'PROPHET' && type !== 'CRYOPHAGE' && floorNum >= 3 && Math.random() < d.eliteRate) {
    e.elite = true;
    e.hp = Math.round(e.hp * 1.8);
    e.maxHp = e.hp;
    e.atk = Math.round(e.atk * 1.3);
    e.spd *= 1.15;
    e.xpValue = Math.round(e.xpValue * 1.25);
    // Roll elite affix
    e.eliteAffix = rollEliteAffix(type);
    if (e.eliteAffix === 'SHIELDED') {
      e.shieldMax = Math.round(e.maxHp * 0.4);
      e.shieldHp  = e.shieldMax;
    }
    if (e.eliteAffix === 'PHASING') {
      e.phaseTimer = rnd(0, 3); // stagger start so not all phase together
    }
  }
  registerEnemyInRoom(e);
  return e;
}

// ─── Volatile Cores (Explosive Barrels) ───────────────────────────────────────
/**
 * @param {any} [x]
 * @param {any} [y]
 */
function createVCore(x, y) {
  return { x, y, primed: false, timer: 0, dead: false, bob: Math.random() * TWO_PI, glow: 0 };
}

/**
 * @param {any} [wx]
 * @param {any} [wy]
 * @param {any} [radius]
 * @param {any} [map]
 */
function primeVCoresInRadius(wx, wy, radius, map) {
  for (const c of vcores) {
    if (c.dead || c.primed) continue;
    if (dist(wx, wy, c.x, c.y) < radius && hasLOS(wx, wy, c.x, c.y, map)) {
      c.primed = true;
      c.timer = 0.15 + Math.random() * 0.2; // stagger for chain cascade
      audio.corePrime();
    }
  }
}

/**
 * @param {any} [c]
 */
function detonateVCore(c) {
  c.dead = true;
  const r = 2.2;
  const dmg = 30 + _EG.floor * 3;
  const map = _EG.dungeon.map;
  spawnParticles(c.x, c.y, 'EXPLOSION', '#ff6622', 22);
  spawnParticles(c.x, c.y, 'EXPLOSION', '#ffaa00', 10);
  triggerShake(8, 0.25);
  audio.coreDetonate();
  // Damage enemies
  for (const e of enemies) {
    if (e.dead) continue;
    if (dist(e.x, e.y, c.x, c.y) < r && hasLOS(c.x, c.y, e.x, e.y, map)) {
      e.takeDamage(dmg, 'Volatile Core');
    }
  }
  // Damage player (risk/reward)
  const p = _EG.player;
  if (dist(p.x, p.y, c.x, c.y) < r && !isPlayerDamageImmune() && hasLOS(c.x, c.y, p.x, p.y, map)) {
    p.takeDamage(dmg, 'Volatile Core');
  }
  // Chain to nearby cores
  primeVCoresInRadius(c.x, c.y, r, map);
  // Destroy nearby crates
  damageCratesInRadius(c.x, c.y, r, dmg, map);
  // Damage nearby beacons
  damageBeaconsInRadius(c.x, c.y, r, dmg, map);
  // Damage nearby shield generators
  damageShieldGensInRadius(c.x, c.y, r, dmg, map);
  // Damage nearby cameras
  damageCamerasInRadius(c.x, c.y, r, dmg, map);
  // Damage nearby laser tripwire emitters
  damageLasersInRadius(c.x, c.y, r, dmg, map);
  // Damage nearby wall turrets
  damageWallTurretsInRadius(c.x, c.y, r, dmg, map);
  // Trigger nearby mines
  triggerMinesInRadius(c.x, c.y, r, map);
}

/**
 * @param {any} [dt]
 */
function updateVCores(dt) {
  for (const c of vcores) {
    if (c.dead) continue;
    c.bob += dt * 2;
    if (c.primed) {
      c.timer -= dt;
      c.glow += dt * 12;
      if (c.timer <= 0) detonateVCore(c);
    } else {
      c.glow = 0.5 + 0.3 * Math.sin(c.bob);
    }
  }
}

/**
 * @param {any} [camX]
 * @param {any} [camY]
 */
function drawVCores(camX, camY) {
  for (const c of vcores) {
    if (c.dead) continue;
    const tx = Math.floor(c.x), ty = Math.floor(c.y);
    if (!_EG.dungeon?.visible?.[ty]?.[tx]) continue;
    const sx = c.x * TILE - camX, sy = c.y * TILE - camY;
    ctx.save();
    if (c.primed) {
      // Rapid red flash
      const flash = Math.sin(c.glow * 3) > 0 ? 1.0 : 0.4;
      ctx.globalAlpha = flash;
      ctx.shadowBlur = 16; ctx.shadowColor = '#ff2200';
      ctx.fillStyle = '#ff3311';
      NEON.draw.circle(ctx, sx, sy, 6);
      ctx.fillStyle = '#ffcc00';
      NEON.draw.circle(ctx, sx, sy, 3);
    } else {
      // Pulsing amber/red glow
      ctx.globalAlpha = 0.6 + c.glow * 0.3;
      ctx.shadowBlur = 10; ctx.shadowColor = '#ff6622';
      ctx.fillStyle = '#ff6622';
      NEON.draw.circle(ctx, sx, sy, 5);
      // Inner bright core
      ctx.globalAlpha = 0.9;
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffaa44';
      NEON.draw.circle(ctx, sx, sy, 2.5);
    }
    ctx.restore();
    // Hazard symbol
    ctx.save();
    ctx.globalAlpha = c.primed ? 0.9 : 0.5;
    ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('!', sx, sy - 9);
    ctx.restore();
  }
}

// ─── Crates ───────────────────────────────────────────────────────────────────
/**
 * @param {any} [tx]
 * @param {any} [ty]
 * @param {any} [floor]
 */
function createCrate(tx, ty, floor) {
  const maxHp = 15 + floor * 5;
  return { tx, ty, hp: maxHp, maxHp };
}

/**
 * @param {any} [tx]
 * @param {any} [ty]
 */
function getCrateAt(tx, ty) {
  for (const c of crates) if (c.tx === tx && c.ty === ty) return c;
  return null;
}

/**
 * @param {any} [c]
 * @param {any} [dmg]
 */
function damageCrate(c, dmg) {
  if (!c || c.hp <= 0) return;
  c.hp -= dmg;
  if (c.hp <= 0) destroyCrate(c);
  else spawnParticles(c.tx + 0.5, c.ty + 0.5, 'SPARK', '#88aacc', 3);
}

/**
 * @param {any} [c]
 */
function destroyCrate(c) {
  const map = _EG.dungeon.map;
  map[c.ty][c.tx] = T.FLOOR;
  _EG.markMapMutated();
  spawnParticles(c.tx + 0.5, c.ty + 0.5, 'EXPLOSION', '#667788', 10);
  spawnParticles(c.tx + 0.5, c.ty + 0.5, 'SPARK', '#44ccff', 6);
  audio.crateBreak();
  // 25% chance to drop credits
  if (Math.random() < 0.25) {
    const amt = _EG.floor * 4;
    _EG.player.credits = (_EG.player.credits || 0) + amt;
    spawnDmgText(c.tx + 0.5, c.ty + 0.2, '+' + amt + '◈', '#39ff14');
  }
  const idx = crates.indexOf(c);
  if (idx >= 0) crates.splice(idx, 1);
}

/**
 * @param {any} [tx]
 * @param {any} [ty]
 * @param {any} [dmg]
 */
function damageCrateAtTile(tx, ty, dmg) {
  const c = getCrateAt(tx, ty);
  if (c) damageCrate(c, dmg);
}

/**
 * @param {any} [wx]
 * @param {any} [wy]
 * @param {any} [radius]
 * @param {any} [dmg]
 * @param {any} [map]
 */
function damageCratesInRadius(wx, wy, radius, dmg, map) {
  for (let i = crates.length - 1; i >= 0; i--) {
    const c = crates[i];
    const cx = c.tx + 0.5, cy = c.ty + 0.5;
    if (dist(wx, wy, cx, cy) < radius && hasLOS(wx, wy, cx, cy, map)) {
      damageCrate(c, dmg);
    }
  }
}

// ─── Alarm Beacons ────────────────────────────────────────────────────────────
const BEACON_COUNTDOWN = 4; // seconds before reinforcements spawn

/**
 * @param {any} [x]
 * @param {any} [y]
 * @param {any} [floor]
 * @param {any} [room]
 */
function createBeacon(x, y, floor, room) {
  const maxHp = 10 + floor * 3;
  return { x, y, hp: maxHp, maxHp, active: false, timer: 0, dead: false,
           room, floor, bob: Math.random() * TWO_PI, ringTimer: 0 };
}

/**
 * @param {any} [b]
 * @param {any} [dmg]
 */
function damageBeacon(b, dmg) {
  if (!b || b.dead) return;
  b.hp -= dmg;
  if (b.hp <= 0) destroyBeacon(b);
  else spawnParticles(b.x, b.y, 'SPARK', '#ff4444', 4);
}

/**
 * @param {any} [b]
 */
function destroyBeacon(b) {
  b.dead = true;
  spawnParticles(b.x, b.y, 'EXPLOSION', '#ff3333', 14);
  spawnParticles(b.x, b.y, 'SPARK', '#ff8844', 8);
  audio.beaconDestroy();
  // Credit reward with economy multipliers
  const d = getDiff();
  const amt = Math.round(_EG.floor * 3 * getMetaCreditMultiplier() * d.creditMul * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
  _EG.player.credits += amt;
  spawnDmgText(b.x, b.y - 0.3, '+' + amt + '◈', '#ff6644');
  const idx = beacons.indexOf(b);
  if (idx >= 0) beacons.splice(idx, 1);
  // Trigger room-clear re-evaluation (beacon was blocking clear)
  _EG.enemyDiedThisFrame = true;
}

/**
 * @param {any} [wx]
 * @param {any} [wy]
 * @param {any} [radius]
 * @param {any} [dmg]
 * @param {any} [map]
 */
function damageBeaconsInRadius(wx, wy, radius, dmg, map) {
  for (let i = beacons.length - 1; i >= 0; i--) {
    const b = beacons[i];
    if (b.dead) continue;
    if (dist(wx, wy, b.x, b.y) < radius && hasLOS(wx, wy, b.x, b.y, map)) {
      damageBeacon(b, dmg);
    }
  }
}

/**
 * @param {any} [dt]
 */
function updateBeacons(dt) {
  const p = _EG.player;
  for (let i = beacons.length - 1; i >= 0; i--) {
    const b = beacons[i];
    if (b.dead) continue;
    b.bob += dt * 2;
    // Activate when player enters the room
    if (!b.active) {
      const r = b.room;
      if (p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h) {
        b.active = true;
        b.timer = BEACON_COUNTDOWN;
        audio.beaconAlarm();
        _EG.msg('⚠ ALARM BEACON ACTIVE', '#ff3333');
      }
    }
    if (b.active) {
      b.timer -= dt;
      b.ringTimer += dt;
      if (b.timer <= 0) {
        // Trigger reinforcements
        b.dead = true;
        audio.beaconTrigger();
        _EG.msg('⚠ REINFORCEMENTS INCOMING', '#ff4444');
        spawnParticles(b.x, b.y, 'EXPLOSION', '#ff2222', 16);
        const count = rndInt(2, 3);
        const map = _EG.dungeon.map;
        for (let j = 0; j < count; j++) {
          const type = pickEnemyType(b.floor);
          let ex, ey, att = 0;
          do {
            ex = b.room.x + rnd(1, b.room.w - 1);
            ey = b.room.y + rnd(1, b.room.h - 1);
            att++;
          } while (att < 20 && (
            !isPassable(map[Math.floor(ey)]?.[Math.floor(ex)]) ||
            dist(ex, ey, p.x, p.y) < 3
          ));
          if (!isPassable(map[Math.floor(ey)]?.[Math.floor(ex)])) continue;
          pendingEnemySpawns.push({ type, x: ex, y: ey, floor: b.floor, room: b.room });
        }
        beacons.splice(i, 1);
      }
    }
  }
}

/**
 * @param {any} [camX]
 * @param {any} [camY]
 */
function drawBeacons(camX, camY) {
  for (const b of beacons) {
    if (b.dead) continue;
    const tx = Math.floor(b.x), ty = Math.floor(b.y);
    if (!_EG.dungeon?.visible?.[ty]?.[tx]) continue;
    const sx = b.x * TILE - camX, sy = b.y * TILE - camY;
    const pulse = 0.5 + 0.3 * Math.sin(b.bob * 2);

    if (b.active) {
      // Rapid flash
      const flash = Math.sin(b.ringTimer * 10) > 0 ? 1.0 : 0.3;
      // Expanding ring
      const ringR = (b.ringTimer % 0.8) / 0.8 * 18;
      const ringA = 1 - ringR / 18;
      ctx.save();
      ctx.globalAlpha = ringA * 0.4;
      ctx.strokeStyle = '#ff2222'; ctx.lineWidth = 1.5;
      NEON.draw.circleStroke(ctx, sx, sy, ringR);
      ctx.restore();
      // Core diamond
      ctx.save();
      ctx.globalAlpha = flash;
      ctx.shadowBlur = 14; ctx.shadowColor = '#ff0000';
      ctx.fillStyle = '#ff2222';
      ctx.translate(sx, sy); ctx.rotate(Math.PI / 4);
      ctx.fillRect(-5, -5, 10, 10);
      ctx.setTransform(1,0,0,1,0,0);
      ctx.restore();
      // Countdown text
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ff4444'; ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.shadowBlur = 6; ctx.shadowColor = '#ff0000';
      ctx.fillText(String(Math.ceil(b.timer)), sx, sy - 10);
      ctx.restore();
    } else {
      // Idle: subtle red glow diamond
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.shadowBlur = 8; ctx.shadowColor = '#ff2222';
      ctx.fillStyle = '#ff3333';
      ctx.translate(sx, sy); ctx.rotate(Math.PI / 4);
      ctx.fillRect(-4, -4, 8, 8);
      ctx.setTransform(1,0,0,1,0,0);
      ctx.restore();
      // Antenna line
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 1;
      NEON.draw.line(ctx, sx, sy - 5, sx, sy - 12);
      ctx.fillStyle = '#ff6666';
      NEON.draw.circle(ctx, sx, sy - 12, 1.5);
      ctx.restore();
      // Warning symbol
      ctx.save();
      ctx.globalAlpha = 0.4 + 0.2 * Math.sin(b.bob);
      ctx.fillStyle = '#ff6644'; ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('⚠', sx, sy + 10);
      ctx.restore();
    }
  }
}

// ─── Proximity Mines ──────────────────────────────────────────────────────────
const MINE_TRIGGER_RADIUS = 0.9;  // proximity trigger
const MINE_REVEAL_RADIUS  = 3.0;  // visible shimmer
const MINE_BLAST_RADIUS   = 2.0;
const MINE_FUSE_NORMAL    = 0.8;  // walked-into fuse
const MINE_FUSE_SHOT      = 0.3;  // shot-by-projectile fuse

/**
 * @param {any} [x]
 * @param {any} [y]
 * @param {any} [floor]
 * @param {any} [room]
 */
function createMine(x, y, floor, room) {
  const dmg = 12 + floor * 3;
  return { x, y, dmg, state: 'dormant', fuse: 0, revealed: false, dead: false,
           room, floor, bob: Math.random() * TWO_PI, flash: 0 };
}

/**
 * @param {any} [m]
 * @param {any} [fuseTime]
 */
function armMine(m, fuseTime) {
  if (!m || m.dead || m.state !== 'dormant') return;
  m.state = 'armed';
  m.fuse = fuseTime;
  audio.mineArm();
}

/**
 * @param {any} [m]
 */
function detonateMine(m) {
  if (!m || m.dead) return;
  m.dead = true;
  m.state = 'detonated';
  const r = MINE_BLAST_RADIUS;
  const map = _EG.dungeon.map;
  spawnParticles(m.x, m.y, 'EXPLOSION', '#ff8800', 18);
  spawnParticles(m.x, m.y, 'EXPLOSION', '#ffcc44', 8);
  triggerShake(6, 0.2);
  audio.mineExplode();
  // Damage enemies (LOS-gated)
  for (const e of enemies) {
    if (e.dead) continue;
    if (dist(e.x, e.y, m.x, m.y) < r && hasLOS(m.x, m.y, e.x, e.y, map)) {
      e.takeDamage(m.dmg, 'Proximity Mine');
    }
  }
  // Damage player (environmental — bypasses defense)
  const p = _EG.player;
  if (dist(p.x, p.y, m.x, m.y) < r && !isPlayerDamageImmune() && hasLOS(m.x, m.y, p.x, p.y, map)) {
    p.takeDamage(m.dmg, 'Proximity Mine', { ignoreDefense: true });
  }
  // Chain to nearby mines (staggered fuse for cascade effect)
  triggerMinesInRadius(m.x, m.y, r, map);
  // Chain to volatile cores
  primeVCoresInRadius(m.x, m.y, r, map);
  // Damage nearby crates
  damageCratesInRadius(m.x, m.y, r, m.dmg, map);
  // Damage nearby beacons
  damageBeaconsInRadius(m.x, m.y, r, m.dmg, map);
  // Damage nearby shield generators
  damageShieldGensInRadius(m.x, m.y, r, m.dmg, map);
  // Damage nearby cameras
  damageCamerasInRadius(m.x, m.y, r, m.dmg, map);
  // Damage nearby laser tripwire emitters
  damageLasersInRadius(m.x, m.y, r, m.dmg, map);
  // Damage nearby wall turrets
  damageWallTurretsInRadius(m.x, m.y, r, m.dmg, map);
  // Remove from array
  const idx = mines.indexOf(m);
  if (idx >= 0) mines.splice(idx, 1);
}

/**
 * @param {any} [wx]
 * @param {any} [wy]
 * @param {any} [radius]
 * @param {any} [map]
 */
function triggerMinesInRadius(wx, wy, radius, map) {
  for (const m of mines) {
    if (m.dead || m.state !== 'dormant') continue;
    if (dist(wx, wy, m.x, m.y) < radius && hasLOS(wx, wy, m.x, m.y, map)) {
      m.state = 'armed';
      m.fuse = 0.1 + Math.random() * 0.15; // stagger for cascade
      // No arm SFX for chain — the explosion is the feedback
    }
  }
}

/**
 * @param {any} [dt]
 */
function updateMines(dt) {
  const p = _EG.player;
  for (let i = mines.length - 1; i >= 0; i--) {
    const m = mines[i];
    if (m.dead) continue;
    m.bob += dt * 2;

    // Reveal when player is nearby (persistent for the floor)
    if (!m.revealed && dist(p.x, p.y, m.x, m.y) < MINE_REVEAL_RADIUS) {
      m.revealed = true;
    }

    if (m.state === 'dormant') {
      // Check proximity trigger — player
      if (dist(p.x, p.y, m.x, m.y) < MINE_TRIGGER_RADIUS) {
        armMine(m, MINE_FUSE_NORMAL);
      }
      // Check proximity trigger — enemies
      if (m.state === 'dormant') {
        for (const e of enemies) {
          if (e.dead) continue;
          if (dist(e.x, e.y, m.x, m.y) < MINE_TRIGGER_RADIUS) {
            armMine(m, MINE_FUSE_NORMAL);
            break;
          }
        }
      }
    } else if (m.state === 'armed') {
      m.fuse -= dt;
      m.flash += dt * 20;
      if (m.fuse <= 0) {
        detonateMine(m);
      }
    }
  }
}

/**
 * @param {any} [camX]
 * @param {any} [camY]
 */
function drawMines(camX, camY) {
  for (const m of mines) {
    if (m.dead) continue;
    const tx = Math.floor(m.x), ty = Math.floor(m.y);
    if (!_EG.dungeon?.visible?.[ty]?.[tx]) continue;
    const sx = m.x * TILE - camX, sy = m.y * TILE - camY;
    ctx.save();

    if (m.state === 'armed') {
      // Armed: rapid red flash + expanding ring
      const flashAlpha = 0.6 + 0.4 * Math.sin(m.flash);
      ctx.globalAlpha = flashAlpha;
      ctx.fillStyle = '#ff2200';
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#ff4400';
      NEON.draw.circle(ctx, sx, sy, 6);
      // Expanding warning ring
      const ringR = 6 + (1 - m.fuse / MINE_FUSE_NORMAL) * 12;
      ctx.globalAlpha = Math.max(0, flashAlpha * 0.5);
      ctx.strokeStyle = '#ff4400';
      ctx.lineWidth = 1.5;
      NEON.draw.circleStroke(ctx, sx, sy, ringR);
    } else if (m.revealed) {
      // Revealed: visible orange hazard shimmer
      const pulse = 0.3 + 0.2 * Math.sin(m.bob * 1.5);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#ff8800';
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#ff6600';
      NEON.draw.circle(ctx, sx, sy, 4);
      // Small hazard indicator
      ctx.globalAlpha = pulse * 0.5;
      ctx.strokeStyle = '#ff8800';
      ctx.lineWidth = 1;
      NEON.draw.circleStroke(ctx, sx, sy, 7);
    } else {
      // Dormant: very subtle shimmer (attentive players can spot)
      const pulse = 0.08 + 0.05 * Math.sin(m.bob);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#ff6600';
      NEON.draw.circle(ctx, sx, sy, 3);
    }

    ctx.restore();
  }
}

// ─── Shield Generators ────────────────────────────────────────────────────────
const SHIELD_GEN_DR = 0.35; // 35% damage reduction to room enemies

/**
 * @param {any} [x]
 * @param {any} [y]
 * @param {any} [floor]
 * @param {any} [room]
 */
function createShieldGen(x, y, floor, room) {
  const maxHp = 15 + floor * 4;
  return { x, y, hp: maxHp, maxHp, dead: false, room, floor, bob: Math.random() * TWO_PI };
}

/**
 * @param {any} [g]
 * @param {any} [dmg]
 */
function damageShieldGen(g, dmg) {
  if (!g || g.dead) return;
  g.hp -= dmg;
  if (g.hp <= 0) destroyShieldGen(g);
  else spawnParticles(g.x, g.y, 'SPARK', '#00ccff', 4);
}

/**
 * @param {any} [g]
 */
function destroyShieldGen(g) {
  g.dead = true;
  spawnParticles(g.x, g.y, 'EXPLOSION', '#00ccff', 18);
  spawnParticles(g.x, g.y, 'SPARK', '#88eeff', 10);
  audio.generatorDestroy();
  // Credit reward
  const d = getDiff();
  const amt = Math.round(_EG.floor * 5 * getMetaCreditMultiplier() * d.creditMul * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
  _EG.player.credits += amt;
  spawnDmgText(g.x, g.y - 0.3, '+' + amt + '◈', '#00ccff');
  // EMP burst — stun enemies in radius (LOS-gated)
  const empR = 3, empDur = 0.8, map = _EG.dungeon.map;
  for (const e of enemies) {
    if (e.dead || e.isBoss || e._disguised) continue;
    if (e._wrPhased) continue;
    if (dist(e.x, e.y, g.x, g.y) < empR && hasLOS(g.x, g.y, e.x, e.y, map)) {
      e.stunTimer = Math.max(e.stunTimer || 0, empDur);
      spawnParticles(e.x, e.y, 'SPARK', '#00ccff', 3);
      spawnDmgText(e.x, e.y, 'STUN', '#00ccff');
    }
  }
  triggerShake(4, 0.15);
  const idx = shieldGens.indexOf(g);
  if (idx >= 0) shieldGens.splice(idx, 1);
}

/**
 * @param {any} [wx]
 * @param {any} [wy]
 * @param {any} [radius]
 * @param {any} [dmg]
 * @param {any} [map]
 */
function damageShieldGensInRadius(wx, wy, radius, dmg, map) {
  for (let i = shieldGens.length - 1; i >= 0; i--) {
    const g = shieldGens[i];
    if (g.dead) continue;
    if (dist(wx, wy, g.x, g.y) < radius && hasLOS(wx, wy, g.x, g.y, map)) {
      damageShieldGen(g, dmg);
    }
  }
}

// Check if an enemy is protected by a shield generator (room + spatial bounds)
/**
 * @param {any} [e]
 */
function isEnemyShieldGenProtected(e) {
  if (e.dead || e._disguised) return false;
  for (const g of shieldGens) {
    if (g.dead) continue;
    if (e.room !== g.room) continue;
    // Spatial bounds check — enemy must be physically inside the room
    const r = g.room;
    if (e.x >= r.x && e.x < r.x + r.w && e.y >= r.y && e.y < r.y + r.h) return true;
  }
  return false;
}

/**
 * @param {any} [dt]
 */
function updateShieldGens(dt) {
  for (const g of shieldGens) {
    if (g.dead) continue;
    g.bob += dt * 2;
  }
}

/**
 * @param {any} [camX]
 * @param {any} [camY]
 */
function drawShieldGens(camX, camY) {
  for (const g of shieldGens) {
    if (g.dead) continue;
    const tx = Math.floor(g.x), ty = Math.floor(g.y);
    if (!_EG.dungeon?.visible?.[ty]?.[tx]) continue;
    const sx = g.x * TILE - camX, sy = g.y * TILE - camY;
    const pulse = 0.6 + 0.3 * Math.sin(g.bob * 2);
    const t = g.bob;

    // Draw energy beams to shielded enemies in room
    const r = g.room;
    for (const e of enemiesInRoomIter(r)) {
      if (e.dead || e._disguised) continue;
      if (e.x < r.x || e.x >= r.x + r.w || e.y < r.y || e.y >= r.y + r.h) continue;
      const ex = e.x * TILE - camX, ey = e.y * TILE - camY;
      ctx.save();
      ctx.globalAlpha = 0.15 + 0.1 * Math.sin(t * 3 + e.x);
      ctx.strokeStyle = '#00ccff';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      NEON.draw.line(ctx, sx, sy, ex, ey);
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Generator body — rotating hexagonal frame
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.shadowBlur = 12; ctx.shadowColor = '#00ccff';
    ctx.strokeStyle = '#00ccff'; ctx.lineWidth = 1.5;
    ctx.translate(sx, sy);
    const rot = t * 0.5;
    ctx.rotate(rot);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (TWO_PI / 6) * i;
      const hx = Math.cos(a) * 7, hy = Math.sin(a) * 7;
      if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
    }
    ctx.closePath(); ctx.stroke();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.restore();

    // Inner core — bright dot
    ctx.save();
    ctx.globalAlpha = 0.8 + 0.2 * Math.sin(t * 4);
    ctx.shadowBlur = 8; ctx.shadowColor = '#44eeff';
    ctx.fillStyle = '#44eeff';
    NEON.draw.circle(ctx, sx, sy, 3);
    ctx.restore();

    // HP bar when damaged
    if (g.hp < g.maxHp) {
      const bw = 16, bh = 2, bx = sx - bw / 2, by = sy - 14;
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#113'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#00ccff'; ctx.fillRect(bx, by, bw * (g.hp / g.maxHp), bh);
      ctx.restore();
    }
  }
}

// ─── Security Cameras ─────────────────────────────────────────────────────────
const CAMERA_CONE_HALF = Math.PI / 6;   // 30° half-angle → 60° beam
const CAMERA_SWEEP_HALF = Math.PI / 3;  // 60° half-sweep → 120° total coverage
const CAMERA_RANGE = 5;                 // tiles
const CAMERA_SWEEP_SPD = Math.PI / 4;   // 45°/s
const CAMERA_ALERT_TIME = 1.5;          // seconds before reinforcements
const CAMERA_REARM_CD = 0.5;            // debounce after losing detection

// Wall direction → base facing angle (into room)
/** @type {Record<string, number>} */
const WALL_FACING = { N: Math.PI / 2, S: -Math.PI / 2, E: Math.PI, W: 0 };

/**
 * @param {any} [x]
 * @param {any} [y]
 * @param {any} [floor]
 * @param {any} [room]
 * @param {any} [wallSide]
 */
function createCamera(x, y, floor, room, wallSide) {
  const maxHp = 12 + floor * 3;
  const baseAngle = WALL_FACING[wallSide];
  return {
    x, y, hp: maxHp, maxHp, dead: false, room, floor, wallSide,
    baseAngle,
    sweepAngle: 0, sweepDir: 1,      // current offset from base, oscillation direction
    state: 'scanning',                // scanning | alerted | triggered
    alertTimer: 0,
    rearmCd: 0,                       // debounce after returning to scanning
    bob: Math.random() * TWO_PI,
  };
}

/**
 * @param {any} [c]
 * @param {any} [dmg]
 */
function damageCamera(c, dmg) {
  if (!c || c.dead) return;
  c.hp -= dmg;
  if (c.hp <= 0) destroyCamera(c);
  else spawnParticles(c.x, c.y, 'SPARK', '#ff4444', 4);
}

/**
 * @param {any} [c]
 */
function destroyCamera(c) {
  c.dead = true;
  c.state = 'triggered'; // prevent further logic
  spawnParticles(c.x, c.y, 'EXPLOSION', '#ff4444', 14);
  spawnParticles(c.x, c.y, 'SPARK', '#ff8844', 8);
  audio.cameraDestroy();
  const d = getDiff();
  const amt = Math.round(_EG.floor * 4 * getMetaCreditMultiplier() * d.creditMul * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
  _EG.player.credits += amt;
  spawnDmgText(c.x, c.y - 0.3, '+' + amt + '◈', '#ff4444');
  const idx = cameras.indexOf(c);
  if (idx >= 0) cameras.splice(idx, 1);
  _EG.enemyDiedThisFrame = true; // re-evaluate room-clear
}

/**
 * @param {any} [wx]
 * @param {any} [wy]
 * @param {any} [radius]
 * @param {any} [dmg]
 * @param {any} [map]
 */
function damageCamerasInRadius(wx, wy, radius, dmg, map) {
  for (let i = cameras.length - 1; i >= 0; i--) {
    const c = cameras[i];
    if (c.dead) continue;
    if (dist(wx, wy, c.x, c.y) < radius && hasLOS(wx, wy, c.x, c.y, map)) {
      damageCamera(c, dmg);
    }
  }
}

// Normalize angle to [-PI, PI]
/**
 * @param {any} [a]
 */
function normalizeAngle(a) {
  while (a > Math.PI) a -= TWO_PI;
  while (a < -Math.PI) a += TWO_PI;
  return a;
}

/**
 * @param {any} [dt]
 */
function updateCameras(dt) {
  const p = _EG.player;
  const map = _EG.dungeon?.map;
  if (!map) return;
  for (let i = cameras.length - 1; i >= 0; i--) {
    const c = cameras[i];
    if (c.dead) continue;
    c.bob += dt * 2;

    // Sweep oscillation
    c.sweepAngle += CAMERA_SWEEP_SPD * c.sweepDir * dt;
    if (c.sweepAngle > CAMERA_SWEEP_HALF) { c.sweepAngle = CAMERA_SWEEP_HALF; c.sweepDir = -1; }
    if (c.sweepAngle < -CAMERA_SWEEP_HALF) { c.sweepAngle = -CAMERA_SWEEP_HALF; c.sweepDir = 1; }

    const currentAngle = c.baseAngle + c.sweepAngle;

    // Tick rearm cooldown
    if (c.rearmCd > 0) c.rearmCd -= dt;

    // Detection check: player in room, in cone, LOS, targetable
    const r = c.room;
    const inRoom = p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
    let detected = false;
    if (inRoom && canTargetPlayer()) {
      const dx = p.x - c.x, dy = p.y - c.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < CAMERA_RANGE && d > 0.1) {
        const angleToPlayer = Math.atan2(dy, dx);
        const diff = Math.abs(normalizeAngle(angleToPlayer - currentAngle));
        if (diff < CAMERA_CONE_HALF && hasLOS(c.x, c.y, p.x, p.y, map)) {
          detected = true;
        }
      }
    }

    if (c.state === 'scanning') {
      if (detected && c.rearmCd <= 0) {
        c.state = 'alerted';
        c.alertTimer = CAMERA_ALERT_TIME;
        audio.cameraDetect();
        _EG.msg('⚠ CAMERA ALERT', '#ff6644');
      }
    } else if (c.state === 'alerted') {
      if (!detected) {
        // Player left cone — return to scanning with debounce
        c.state = 'scanning';
        c.rearmCd = CAMERA_REARM_CD;
        _EG.enemyDiedThisFrame = true; // re-evaluate room-clear (was blocked while alerted)
      } else {
        c.alertTimer -= dt;
        if (c.alertTimer <= 0) {
          // Alert triggered — spawn reinforcements
          c.state = 'triggered';
          c.dead = true;
          audio.cameraAlert();
          _EG.msg('⚠ SECURITY RESPONSE INCOMING', '#ff3333');
          spawnParticles(c.x, c.y, 'EXPLOSION', '#ff3333', 12);
          const count = rndInt(2, 3);
          for (let j = 0; j < count; j++) {
            const type = pickEnemyType(c.floor);
            let ex, ey, att = 0;
            do {
              ex = r.x + rnd(1, r.w - 1);
              ey = r.y + rnd(1, r.h - 1);
              att++;
            } while (att < 20 && (
              !isPassable(map[Math.floor(ey)]?.[Math.floor(ex)]) ||
              dist(ex, ey, p.x, p.y) < 3
            ));
            if (!isPassable(map[Math.floor(ey)]?.[Math.floor(ex)])) continue;
            pendingEnemySpawns.push({ type, x: ex, y: ey, floor: c.floor, room: r });
          }
          cameras.splice(i, 1);
        }
      }
    }
  }
}

/**
 * @param {any} [camX]
 * @param {any} [camY]
 */
function drawCameras(camX, camY) {
  const map = _EG.dungeon?.map;
  for (const c of cameras) {
    if (c.dead) continue;
    const tx = Math.floor(c.x), ty = Math.floor(c.y);
    if (!_EG.dungeon?.visible?.[ty]?.[tx]) continue;
    const sx = c.x * TILE - camX, sy = c.y * TILE - camY;
    const currentAngle = c.baseAngle + c.sweepAngle;

    // Draw vision cone (raycast-clipped against walls)
    const coneSteps = 16;
    const coneColor = c.state === 'alerted' ? '#ff4422' : '#ff2200';
    const coneAlpha = c.state === 'alerted'
      ? 0.18 + 0.12 * Math.sin(c.bob * 8) // fast pulse when alerted
      : 0.08 + 0.03 * Math.sin(c.bob * 2);

    ctx.save();
    ctx.globalAlpha = coneAlpha;
    ctx.fillStyle = coneColor;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    for (let s = 0; s <= coneSteps; s++) {
      const a = currentAngle - CAMERA_CONE_HALF + (CAMERA_CONE_HALF * 2) * (s / coneSteps);
      // Raycast to find effective range (clip at walls)
      let reach = CAMERA_RANGE;
      for (let step = 0.5; step <= CAMERA_RANGE; step += 0.5) {
        const rx = c.x + Math.cos(a) * step;
        const ry = c.y + Math.sin(a) * step;
        const rtx = Math.floor(rx), rty = Math.floor(ry);
        if (rtx < 0 || rty < 0 || rtx >= 80 || rty >= 50) { reach = step - 0.5; break; }
        const tile = map[rty]?.[rtx];
        if (tile !== undefined && !isSeeThrough(tile)) { reach = step - 0.25; break; }
      }
      reach = Math.max(0.5, reach);
      const ex = sx + Math.cos(a) * reach * TILE;
      const ey = sy + Math.sin(a) * reach * TILE;
      ctx.lineTo(ex, ey);
    }
    ctx.closePath();
    ctx.fill();

    // Cone edge lines (raycast-clipped to match filled cone)
    ctx.globalAlpha = coneAlpha * 1.5;
    ctx.strokeStyle = coneColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const edgeA of [currentAngle - CAMERA_CONE_HALF, currentAngle + CAMERA_CONE_HALF]) {
      let reach = CAMERA_RANGE;
      for (let step = 0.5; step <= CAMERA_RANGE; step += 0.5) {
        const rx = c.x + Math.cos(edgeA) * step;
        const ry = c.y + Math.sin(edgeA) * step;
        const rtx = Math.floor(rx), rty = Math.floor(ry);
        if (rtx < 0 || rty < 0 || rtx >= 80 || rty >= 50) { reach = step - 0.5; break; }
        const tile = map[rty]?.[rtx];
        if (tile !== undefined && !isSeeThrough(tile)) { reach = step - 0.25; break; }
      }
      reach = Math.max(0.5, reach);
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(edgeA) * reach * TILE, sy + Math.sin(edgeA) * reach * TILE);
    }
    ctx.stroke();
    ctx.restore();

    // Draw camera body
    ctx.save();
    const baseColour = c.state === 'alerted' ? '#ff4422' : '#cc2200';
    const glowColour = c.state === 'alerted' ? '#ff6644' : '#ff3300';
    ctx.shadowBlur = c.state === 'alerted' ? 10 : 5;
    ctx.shadowColor = glowColour;

    // Camera housing (small rectangle oriented to wall)
    ctx.translate(sx, sy);
    ctx.rotate(c.baseAngle);
    ctx.fillStyle = '#333';
    ctx.fillRect(-4, -3, 8, 6);
    ctx.fillStyle = baseColour;
    ctx.fillRect(-3, -2, 6, 4);

    // Lens dot
    const lensPulse = c.state === 'alerted' ? 1.0 : 0.6 + 0.3 * Math.sin(c.bob * 2);
    ctx.globalAlpha = lensPulse;
    ctx.fillStyle = c.state === 'alerted' ? '#ff8866' : '#ff4400';
    NEON.draw.circle(ctx, 2, 0, 2);

    ctx.restore();

    // Alert countdown bar
    if (c.state === 'alerted') {
      const bw = 16, bh = 2;
      const bx = sx - bw / 2, by = sy - 12;
      const pct = c.alertTimer / CAMERA_ALERT_TIME;
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#331100';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = pct > 0.3 ? '#ff6622' : '#ff2200';
      ctx.fillRect(bx, by, bw * pct, bh);
      ctx.restore();
    }

    // HP bar when damaged
    if (c.hp < c.maxHp) {
      const bw = 16, bh = 2, bx = sx - bw / 2, by = sy - 14;
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#113';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(bx, by, bw * (c.hp / c.maxHp), bh);
      ctx.restore();
    }
  }
}

// ─── Laser Tripwires ──────────────────────────────────────────────────────────
const LASER_HIT_CD = 2.0;      // seconds between re-triggering on same laser
const LASER_DISABLE_DUR = 3.0; // EMP disable duration
const LASER_CYCLE_ON = 1.5;    // seconds beam stays on (cycling lasers)
const LASER_CYCLE_OFF = 1.5;   // seconds beam stays off (cycling lasers)
const LASER_REARM_GRACE = 0.2; // grace period after cycle-on before beam can hit

/**
 * @param {any} [x1]
 * @param {any} [y1]
 * @param {any} [x2]
 * @param {any} [y2]
 * @param {any} [floor]
 * @param {any} [room]
 * @param {any} [axis]
 * @param {any} [cycling]
 */
function createLaser(x1, y1, x2, y2, floor, room, axis, cycling) {
  const emitterHp = 10 + floor * 3;
  return {
    x1, y1, x2, y2,
    hpA: emitterHp, hpB: emitterHp, maxHp: emitterHp,
    deadA: false, deadB: false,
    dead: false,
    room, floor, axis,
    cycling,
    active: true,
    cycleTimer: cycling ? LASER_CYCLE_ON : 0,
    hitCd: 0,
    disabled: false,
    disableTimer: 0,
    rearmGrace: 0,
    _emitB: {},  // unique Map key for Static Field hitMap on emitter B
    bob: Math.random() * TWO_PI,
  };
}

/**
 * @param {any} [l]
 * @param {any} [which]
 */
function destroyLaserEmitter(l, which) {
  if (which === 'A') l.deadA = true;
  else l.deadB = true;
  const ex = which === 'A' ? l.x1 : l.x2;
  const ey = which === 'A' ? l.y1 : l.y2;
  spawnParticles(ex, ey, 'EXPLOSION', '#ff6644', 12);
  spawnParticles(ex, ey, 'SPARK', '#ffaa44', 6);
  audio.laserDestroy();
  // Beam is gone — mark entire laser dead
  l.dead = true;
  l.active = false;
  const d = getDiff();
  const amt = Math.round(_EG.floor * 3 * getMetaCreditMultiplier() * d.creditMul * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
  _EG.player.credits += amt;
  const mx = (l.x1 + l.x2) / 2, my = (l.y1 + l.y2) / 2;
  spawnDmgText(mx, my - 0.3, '+' + amt + '◈', '#ff6644');
  const idx = lasers.indexOf(l);
  if (idx >= 0) lasers.splice(idx, 1);
}

/**
 * @param {any} [l]
 * @param {any} [which]
 * @param {any} [dmg]
 */
function damageLaserEmitter(l, which, dmg) {
  if (l.dead) return;
  if (which === 'A') {
    if (l.deadA) return;
    l.hpA -= dmg;
    if (l.hpA <= 0) { destroyLaserEmitter(l, 'A'); return; }
    spawnParticles(l.x1, l.y1, 'SPARK', '#ff6644', 4);
  } else {
    if (l.deadB) return;
    l.hpB -= dmg;
    if (l.hpB <= 0) { destroyLaserEmitter(l, 'B'); return; }
    spawnParticles(l.x2, l.y2, 'SPARK', '#ff6644', 4);
  }
}

/**
 * @param {any} [wx]
 * @param {any} [wy]
 * @param {any} [radius]
 * @param {any} [dmg]
 * @param {any} [map]
 */
function damageLasersInRadius(wx, wy, radius, dmg, map) {
  for (let i = lasers.length - 1; i >= 0; i--) {
    const l = lasers[i];
    if (l.dead) continue;
    // Check both emitters
    if (!l.deadA && dist(wx, wy, l.x1, l.y1) < radius && hasLOS(wx, wy, l.x1, l.y1, map)) {
      damageLaserEmitter(l, 'A', dmg);
    }
    if (l.dead) continue; // might have been destroyed above
    if (!l.deadB && dist(wx, wy, l.x2, l.y2) < radius && hasLOS(wx, wy, l.x2, l.y2, map)) {
      damageLaserEmitter(l, 'B', dmg);
    }
  }
}

// Segment intersection: does segment (px,py)→(px2,py2) cross laser beam?
/**
 * @param {any} [l]
 * @param {any} [px]
 * @param {any} [py]
 * @param {any} [px2]
 * @param {any} [py2]
 */
function crossesLaserBeam(l, px, py, px2, py2) {
  // Beam from (l.x1,l.y1) to (l.x2,l.y2), player from (px,py) to (px2,py2)
  const d1x = l.x2 - l.x1, d1y = l.y2 - l.y1;
  const d2x = px2 - px, d2y = py2 - py;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-10) return false; // parallel
  const t = ((px - l.x1) * d2y - (py - l.y1) * d2x) / denom;
  const u = ((px - l.x1) * d1y - (py - l.y1) * d1x) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

// Check if beam path is clear of opaque tiles
/**
 * @param {any} [l]
 * @param {any} [map]
 */
function isBeamClear(l, map) {
  const steps = Math.ceil(dist(l.x1, l.y1, l.x2, l.y2) * 2);
  for (let s = 1; s < steps; s++) {
    const frac = s / steps;
    const bx = l.x1 + (l.x2 - l.x1) * frac;
    const by = l.y1 + (l.y2 - l.y1) * frac;
    const tx = Math.floor(bx), ty = Math.floor(by);
    if (tx < 0 || ty < 0 || tx >= 80 || ty >= 50) return false;
    const tile = map[ty]?.[tx];
    if (tile !== undefined && !isSeeThrough(tile)) return false;
  }
  return true;
}

/**
 * @param {any} [dt]
 */
function updateLasers(dt) {
  const p = _EG.player;
  const map = _EG.dungeon?.map;
  if (!map) return;
  for (let i = lasers.length - 1; i >= 0; i--) {
    const l = lasers[i];
    if (l.dead) continue;
    l.bob += dt * 2;

    // EMP disable timer
    if (l.disabled) {
      l.disableTimer -= dt;
      if (l.disableTimer <= 0) {
        l.disabled = false;
        l.rearmGrace = LASER_REARM_GRACE;
      }
      continue;
    }

    // Tick rearm grace
    if (l.rearmGrace > 0) l.rearmGrace -= dt;

    // Cycling logic
    if (l.cycling) {
      l.cycleTimer -= dt;
      if (l.active && l.cycleTimer <= 0) {
        l.active = false;
        l.cycleTimer = LASER_CYCLE_OFF;
      } else if (!l.active && l.cycleTimer <= 0) {
        l.active = true;
        l.cycleTimer = LASER_CYCLE_ON;
        l.rearmGrace = LASER_REARM_GRACE;
      }
    }

    // Hit cooldown
    if (l.hitCd > 0) l.hitCd -= dt;

    // Beam active? Check path clear (crates can block)
    if (!l.active) continue;
    if (!isBeamClear(l, map)) continue;

    // Player crossing detection (segment intersection with player prev→current pos)
    if (l.hitCd <= 0 && l.rearmGrace <= 0 && canTargetPlayer()) {
      const prevX = p._prevX !== undefined ? p._prevX : p.x;
      const prevY = p._prevY !== undefined ? p._prevY : p.y;
      // Also check if player is currently overlapping the beam (standing on it)
      const onBeam = crossesLaserBeam(l, prevX, prevY, p.x, p.y);
      // Proximity check for standing near beam line
      let nearBeam = false;
      if (!onBeam) {
        // Point-to-segment distance check for player radius
        const ax = l.x1, ay = l.y1, bx = l.x2, by = l.y2;
        const abx = bx - ax, aby = by - ay;
        const apx = p.x - ax, apy = p.y - ay;
        const ab2 = abx * abx + aby * aby;
        const t = ab2 > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2)) : 0;
        const closestX = ax + t * abx, closestY = ay + t * aby;
        nearBeam = dist(p.x, p.y, closestX, closestY) < 0.25;
      }
      if (onBeam || nearBeam) {
        // Dash bypasses laser tripwires
        if (p.dashTimer > 0) continue;
        const dmg = 8 + l.floor * 2;
        const actual = p.takeDamage(dmg, 'laser');
        if (actual > 0) {
          l.hitCd = LASER_HIT_CD;
          // Apply brief shock (movement suppress)
          p.shockTimer = Math.max(p.shockTimer || 0, 0.3);
          audio.laserHit();
          spawnParticles(p.x, p.y, 'SPARK', '#ff8844', 8);
          _EG.msg('⚡ LASER TRIP', '#ff8844');
        }
      }
    }
  }
}

/**
 * @param {any} [camX]
 * @param {any} [camY]
 */
function drawLasers(camX, camY) {
  const map = _EG.dungeon?.map;
  if (!map) return;
  for (const l of lasers) {
    if (l.dead) continue;
    // Visibility: either emitter visible
    const t1x = Math.floor(l.x1), t1y = Math.floor(l.y1);
    const t2x = Math.floor(l.x2), t2y = Math.floor(l.y2);
    const vis1 = _EG.dungeon?.visible?.[t1y]?.[t1x];
    const vis2 = _EG.dungeon?.visible?.[t2y]?.[t2x];
    if (!vis1 && !vis2) continue;

    const s1x = l.x1 * TILE - camX, s1y = l.y1 * TILE - camY;
    const s2x = l.x2 * TILE - camX, s2y = l.y2 * TILE - camY;

    // Draw beam line
    if (!l.disabled) {
      const beamClear = isBeamClear(l, map);
      if (l.active && beamClear) {
        // Active beam — bright red/orange line with glow
        const pulse = 0.6 + 0.2 * Math.sin(l.bob * 4);
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = '#ff4422';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ff4422';
        NEON.draw.line(ctx, s1x, s1y, s2x, s2y);
        // Inner bright core
        ctx.globalAlpha = pulse * 0.8;
        ctx.strokeStyle = '#ff8866';
        ctx.lineWidth = 1;
        ctx.shadowBlur = 4;
        NEON.draw.line(ctx, s1x, s1y, s2x, s2y);
        ctx.restore();
      } else if (l.cycling && !l.active) {
        // Cycling off — dim dotted line
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = '#ff4422';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        NEON.draw.line(ctx, s1x, s1y, s2x, s2y);
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    // Draw emitter A
    if (!l.deadA) {
      ctx.save();
      const col = l.disabled ? '#666' : '#ff6644';
      const glow = l.disabled ? '#444' : '#ff8844';
      ctx.shadowBlur = l.disabled ? 2 : 6;
      ctx.shadowColor = glow;
      ctx.fillStyle = '#333';
      ctx.fillRect(s1x - 3, s1y - 3, 6, 6);
      ctx.fillStyle = col;
      ctx.fillRect(s1x - 2, s1y - 2, 4, 4);
      // Lens pulse
      if (!l.disabled) {
        const lp = l.active ? 0.8 + 0.2 * Math.sin(l.bob * 3) : 0.3;
        ctx.globalAlpha = lp;
        ctx.fillStyle = '#ffaa66';
        NEON.draw.circle(ctx, s1x, s1y, 1.5);
      }
      ctx.restore();
      // HP bar when damaged
      if (l.hpA < l.maxHp) {
        const bw = 14, bh = 2, bx = s1x - bw / 2, by = s1y - 8;
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#113';
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(bx, by, bw * (l.hpA / l.maxHp), bh);
        ctx.restore();
      }
    }

    // Draw emitter B
    if (!l.deadB) {
      ctx.save();
      const col = l.disabled ? '#666' : '#ff6644';
      const glow = l.disabled ? '#444' : '#ff8844';
      ctx.shadowBlur = l.disabled ? 2 : 6;
      ctx.shadowColor = glow;
      ctx.fillStyle = '#333';
      ctx.fillRect(s2x - 3, s2y - 3, 6, 6);
      ctx.fillStyle = col;
      ctx.fillRect(s2x - 2, s2y - 2, 4, 4);
      if (!l.disabled) {
        const lp = l.active ? 0.8 + 0.2 * Math.sin(l.bob * 3) : 0.3;
        ctx.globalAlpha = lp;
        ctx.fillStyle = '#ffaa66';
        NEON.draw.circle(ctx, s2x, s2y, 1.5);
      }
      ctx.restore();
      if (l.hpB < l.maxHp) {
        const bw = 14, bh = 2, bx = s2x - bw / 2, by = s2y - 8;
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#113';
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(bx, by, bw * (l.hpB / l.maxHp), bh);
        ctx.restore();
      }
    }

    // Disabled sparking effect
    if (l.disabled) {
      if (Math.random() < 0.1) {
        spawnParticles(l.x1, l.y1, 'SPARK', '#00ddff', 1);
        spawnParticles(l.x2, l.y2, 'SPARK', '#00ddff', 1);
      }
    }
  }
}

// ─── Wall Turrets ─────────────────────────────────────────────────────────────
const WTURRET_RANGE_HOSTILE = 6;
const WTURRET_RANGE_HACKED  = 7;
const WTURRET_COOLDOWN_HOSTILE = 1.8;
const WTURRET_COOLDOWN_HACKED  = 1.5;
const WTURRET_PROJ_SPD = 7;
const WTURRET_PROJ_RANGE = 10;
const WTURRET_DISABLE_DUR = 3; // EMP disable duration (before hack)

/**
 * @param {any} [x]
 * @param {any} [y]
 * @param {any} [floor]
 * @param {any} [room]
 * @param {any} [wallSide]
 */
function createWallTurret(x, y, floor, room, wallSide) {
  const maxHp = 12 + floor * 3;
  return {
    x, y, hp: maxHp, maxHp, dead: false,
    hacked: false,
    room, floor, wallSide,
    baseAngle: WALL_FACING[wallSide],
    scanAngle: WALL_FACING[wallSide], scanDir: 1,
    shootTimer: 1.0 + Math.random(), // stagger first shots
    disabled: false, disableTimer: 0,
    bob: Math.random() * TWO_PI,
    hackFlash: 0, // brief glow on hack
  };
}

function wallTurretDmg(/** @type {any} */ floor) { return Math.round(5 + floor * 1.5); }

/**
 * @param {any} [t]
 * @param {any} [dmg]
 */
function damageWallTurret(t, dmg) {
  if (!t || t.dead) return;
  t.hp -= dmg;
  if (t.hp <= 0) destroyWallTurret(t);
  else spawnParticles(t.x, t.y, 'SPARK', t.hacked ? '#00ffaa' : '#ff4400', 4);
}

/**
 * @param {any} [t]
 */
function destroyWallTurret(t) {
  t.dead = true;
  spawnParticles(t.x, t.y, 'EXPLOSION', '#ff6622', 14);
  spawnParticles(t.x, t.y, 'SPARK', '#ff8844', 8);
  audio.turretDestroy();
  const d = getDiff();
  const amt = Math.round(_EG.floor * 3 * getMetaCreditMultiplier() * d.creditMul * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
  _EG.player.credits += amt;
  spawnDmgText(t.x, t.y - 0.3, '+' + amt + '◈', '#ff6622');
  const idx = wallTurrets.indexOf(t);
  if (idx >= 0) wallTurrets.splice(idx, 1);
  _EG.enemyDiedThisFrame = true; // re-evaluate room-clear
}

/**
 * @param {any} [t]
 */
function hackWallTurret(t) {
  if (!t || t.dead || t.hacked) return;
  t.hacked = true;
  t.shootTimer = 0.5; // quick first allied shot
  t.hackFlash = 0.6;
  spawnParticles(t.x, t.y, 'SPARK', '#00ffaa', 10);
  spawnDmgText(t.x, t.y - 0.3, '◇ HACKED', '#00ffaa');
  audio.turretHack();
  _EG.enemyDiedThisFrame = true; // re-evaluate room-clear (was blocking)
}

/**
 * @param {any} [wx]
 * @param {any} [wy]
 * @param {any} [radius]
 * @param {any} [dmg]
 * @param {any} [map]
 */
function damageWallTurretsInRadius(wx, wy, radius, dmg, map) {
  for (let i = wallTurrets.length - 1; i >= 0; i--) {
    const t = wallTurrets[i];
    if (t.dead) continue;
    if (dist(wx, wy, t.x, t.y) < radius && hasLOS(wx, wy, t.x, t.y, map)) {
      damageWallTurret(t, dmg);
    }
  }
}

/**
 * @param {any} [dt]
 */
function updateWallTurrets(dt) {
  const p = _EG.player;
  const map = _EG.dungeon?.map;
  if (!map) return;
  for (let i = wallTurrets.length - 1; i >= 0; i--) {
    const t = wallTurrets[i];
    if (t.dead) continue;
    t.bob += dt * 2;
    if (t.hackFlash > 0) t.hackFlash -= dt;

    // Disabled (EMP'd before hack)
    if (t.disabled) {
      t.disableTimer -= dt;
      if (t.disableTimer <= 0) t.disabled = false;
      continue;
    }

    t.shootTimer -= dt;
    const dmg = wallTurretDmg(t.floor);

    if (t.hacked) {
      // ── Allied: target nearest visible enemy in room ──
      const r = t.room;
      let best = null, bestD = Infinity;
      for (const e of enemiesInRoomIter(r)) {
        if (e.dead || e.isBoss || e._disguised) continue;
        if (e._wrPhased) continue;
        const d = dist(t.x, t.y, e.x, e.y);
        if (d < WTURRET_RANGE_HACKED && d < bestD && hasLOS(t.x, t.y, e.x, e.y, map)) {
          best = e; bestD = d;
        }
      }
      if (best) {
        // Track toward target
        const aimAngle = Math.atan2(best.y - t.y, best.x - t.x);
        t.scanAngle = aimAngle;
        if (t.shootTimer <= 0) {
          const [dx, dy] = norm(best.x - t.x, best.y - t.y);
          const proj = new Projectile(t.x, t.y, dx, dy, WTURRET_PROJ_SPD, dmg, WTURRET_PROJ_RANGE, '#00ffaa', false, false);
          proj.isAllyTurret = true;
          proj.ownerType = 'Wall Turret';
          projectiles.push(proj);
          audio.turretFire();
          t.shootTimer = WTURRET_COOLDOWN_HACKED;
        }
      } else {
        // No target — slow sweep
        t.scanAngle += 0.8 * t.scanDir * dt;
        const halfSweep = Math.PI / 3;
        if (t.scanAngle > t.baseAngle + halfSweep) { t.scanAngle = t.baseAngle + halfSweep; t.scanDir = -1; }
        if (t.scanAngle < t.baseAngle - halfSweep) { t.scanAngle = t.baseAngle - halfSweep; t.scanDir = 1; }
      }
    } else {
      // ── Hostile: target player ──
      const d = dist(t.x, t.y, p.x, p.y);
      if (d < WTURRET_RANGE_HOSTILE && canTargetPlayer() && hasLOS(t.x, t.y, p.x, p.y, map)) {
        const aimAngle = Math.atan2(p.y - t.y, p.x - t.x);
        t.scanAngle = aimAngle;
        if (t.shootTimer <= 0) {
          const [dx, dy] = norm(p.x - t.x, p.y - t.y);
          const proj = new Projectile(t.x, t.y, dx, dy, WTURRET_PROJ_SPD, dmg, WTURRET_PROJ_RANGE, '#ff4400', false, false);
          proj.ownerType = 'Wall Turret';
          projectiles.push(proj);
          audio.turretFire();
          t.shootTimer = WTURRET_COOLDOWN_HOSTILE;
        }
      } else {
        // No target — slow sweep around base angle
        t.scanAngle += 0.6 * t.scanDir * dt;
        const halfSweep = Math.PI / 3;
        if (t.scanAngle > t.baseAngle + halfSweep) { t.scanAngle = t.baseAngle + halfSweep; t.scanDir = -1; }
        if (t.scanAngle < t.baseAngle - halfSweep) { t.scanAngle = t.baseAngle - halfSweep; t.scanDir = 1; }
      }
    }
  }
}

/**
 * @param {any} [camX]
 * @param {any} [camY]
 */
function drawWallTurrets(camX, camY) {
  for (const t of wallTurrets) {
    if (t.dead) continue;
    const tx = Math.floor(t.x), ty = Math.floor(t.y);
    if (!_EG.dungeon?.visible?.[ty]?.[tx]) continue;
    const sx = t.x * TILE - camX, sy = t.y * TILE - camY;
    const isHacked = t.hacked;
    const mainCol = t.disabled ? '#555555' : (isHacked ? '#00ffaa' : '#ff4400');
    const glowCol = t.disabled ? '#333333' : (isHacked ? '#00cc88' : '#cc3300');
    const pulse = 0.6 + 0.3 * Math.sin(t.bob * 1.5);

    ctx.save();

    // Hack flash overlay
    if (t.hackFlash > 0) {
      ctx.globalAlpha = t.hackFlash;
      ctx.fillStyle = '#00ffaa';
      ctx.shadowBlur = 20; ctx.shadowColor = '#00ffaa';
      NEON.draw.circle(ctx, sx, sy, 10);
      ctx.shadowBlur = 0;
    }

    // Wall mount base (small rectangle against wall)
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#334455';
    const ws = t.wallSide;
    const bw = 8, bh = 4;
    if (ws === 'N') ctx.fillRect(sx - bw / 2, sy - bh - 2, bw, bh);
    else if (ws === 'S') ctx.fillRect(sx - bw / 2, sy + 2, bw, bh);
    else if (ws === 'W') ctx.fillRect(sx - bh - 2, sy - bw / 2, bh, bw);
    else ctx.fillRect(sx + 2, sy - bw / 2, bh, bw);

    // Barrel — rotates to scanAngle
    ctx.globalAlpha = pulse;
    ctx.translate(sx, sy);
    ctx.rotate(t.scanAngle);
    // Barrel body
    ctx.fillStyle = mainCol;
    ctx.shadowBlur = 6; ctx.shadowColor = glowCol;
    ctx.fillRect(0, -2.5, 8, 5);
    // Muzzle flash hint
    ctx.fillStyle = glowCol;
    ctx.fillRect(7, -1.5, 3, 3);
    ctx.shadowBlur = 0;
    // Base pivot
    ctx.fillStyle = '#556677';
    NEON.draw.circle(ctx, 0, 0, 3);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // HP bar (when damaged)
    if (t.hp < t.maxHp) {
      const bw2 = 14, bh2 = 2;
      const hpFrac = t.hp / t.maxHp;
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#111'; ctx.fillRect(sx - bw2 / 2, sy - 10, bw2, bh2);
      ctx.fillStyle = isHacked ? '#00ffaa' : '#ff4400';
      ctx.fillRect(sx - bw2 / 2, sy - 10, bw2 * hpFrac, bh2);
    }

    ctx.restore();
  }
}

// ─── Disruption Fields (DISRUPTOR area-denial zones) ──────────────────────────
/**
 * @param {any} [dt]
 * @param {any} [player]
 */
function updateDisruptionFields(dt, player) {
  player.disruptionFieldActive = false;
  for (let i = disruptionFields.length - 1; i >= 0; i--) {
    const f = disruptionFields[i];
    f.age += dt;
    if (f.dead || f.age >= f.maxAge) { f.dead = true; disruptionFields.splice(i, 1); continue; }
    f.tickCd = Math.max(0, f.tickCd - dt);
    // Player damage + debuff
    if (dist(player.x, player.y, f.x, f.y) < f.radius && !isPlayerDamageImmune()) {
      player.disruptionFieldActive = true;
      if (f.tickCd <= 0) {
        const dps = (3 + (_EG.floor || 1) * 0.5) * getDiff().envDmg;
        const tickDmg = Math.round(dps * 0.5); // 0.5s interval
        player.takeDamage(tickDmg, 'Disruption Field', {
          ignoreInvincible: true,
          ignoreDefense: true,
          skipHitInvincible: true,
          skipHitEffects: true,
          skipReactiveArmor: true,
        });
        f.tickCd = 0.5;
        spawnParticles(player.x, player.y, 'SPARK', '#ff44aa', 3);
        audio.disruptorField();
      }
    }
  }
}

/**
 * @param {any} [camX]
 * @param {any} [camY]
 */
function drawDisruptionFields(camX, camY) {
  for (const f of disruptionFields) {
    const sx = f.x * TILE - camX, sy = f.y * TILE - camY;
    const r = f.radius * TILE;
    const fade = 1 - (f.age / f.maxAge);
    const pulse = 0.5 + 0.3 * Math.sin(f.age * 5);

    ctx.save();
    // Outer pulsing circle
    ctx.globalAlpha = fade * pulse * 0.25;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    grad.addColorStop(0, 'rgba(255,68,170,0.4)');
    grad.addColorStop(0.7, 'rgba(255,68,170,0.15)');
    grad.addColorStop(1, 'rgba(255,68,170,0)');
    ctx.fillStyle = grad;
    NEON.draw.circle(ctx, sx, sy, r);

    // Edge ring
    ctx.globalAlpha = fade * pulse * 0.5;
    ctx.strokeStyle = '#ff44aa';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ff44aa';
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -f.age * 30;
    NEON.draw.circleStroke(ctx, sx, sy, r);
    ctx.setLineDash([]);

    // Inner interference lines (visual noise)
    ctx.globalAlpha = fade * 0.15;
    ctx.strokeStyle = '#ff88cc';
    ctx.lineWidth = 1;
    for (let j = 0; j < 4; j++) {
      const a = f.age * 3 + j * 1.57;
      const lr = r * (0.3 + 0.4 * Math.sin(a * 2));
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(a) * lr * 0.3, sy + Math.sin(a) * lr * 0.3);
      ctx.lineTo(sx + Math.cos(a) * lr, sy + Math.sin(a) * lr);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ─── Frost Patches (CRYOPHAGE area-denial tiles) ──────────────────────────────
// Each patch is { x, y, age, maxAge, tickCd, dmg, dead }.
// Lifecycle: spawned at telegraph commit in aiCryophage; ticks down per
// frame; deals damage when the player overlaps and per-patch ICD is ready.
// Dash i-frames pass through (canonical via isPlayerDamageImmune).
// Cleared on floor transition by game.js loadFloor.
/**
 * @param {any} [dt]
 * @param {any} [player]
 */
function updateFrostPatches(dt, player) {
  for (let i = frostPatches.length - 1; i >= 0; i--) {
    const f = frostPatches[i];
    f.age += dt;
    if (f.dead || f.age >= f.maxAge) {
      f.dead = true;
      frostPatches.splice(i, 1);
      continue;
    }
    f.tickCd = Math.max(0, f.tickCd - dt);
    if (dist(player.x, player.y, f.x, f.y) < CRYOPHAGE_PATCH_RADIUS && !isPlayerDamageImmune()) {
      if (f.tickCd <= 0) {
        player.takeDamage(f.dmg, 'Frost Patch', {
          ignoreInvincible: true,
          ignoreDefense: true,
          skipHitInvincible: true,
          skipHitEffects: true,
          skipReactiveArmor: true,
        });
        f.tickCd = CRYOPHAGE_TICK_ICD;
        spawnParticles(player.x, player.y, 'SPARK', '#88ddff', 3);
      }
    }
  }
}

/**
 * @param {any} [camX]
 * @param {any} [camY]
 */
function drawFrostPatches(camX, camY) {
  for (const f of frostPatches) {
    if (f.dead) continue;
    // FOV-cull per patch — frozen tiles outside the player's vision
    // shouldn't render (they still tick if entered, but the player
    // would never see the warning before stepping in).
    const tx = Math.floor(f.x), ty = Math.floor(f.y);
    if (!_EG.dungeon?.visible?.[ty]?.[tx]) continue;
    const sx = f.x * TILE - camX, sy = f.y * TILE - camY;
    const life = 1 - (f.age / f.maxAge);
    const pulse = 0.5 + 0.3 * Math.sin(f.age * 6);
    const r = TILE * 0.42;

    ctx.save();
    // Frosted tile fill
    ctx.globalAlpha = life * (0.20 + pulse * 0.10);
    ctx.fillStyle = '#88ddff';
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#cceeff';
    ctx.fillRect(sx - r, sy - r, r * 2, r * 2);

    // Crystalline edge ring
    ctx.globalAlpha = life * (0.5 + pulse * 0.3);
    ctx.strokeStyle = '#cceeff';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(sx - r, sy - r, r * 2, r * 2);

    // Inner crystal lattice (4 short spokes from centre)
    ctx.globalAlpha = life * 0.4;
    ctx.strokeStyle = '#aaeeff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - r * 0.6, sy); ctx.lineTo(sx + r * 0.6, sy);
    ctx.moveTo(sx, sy - r * 0.6); ctx.lineTo(sx, sy + r * 0.6);
    ctx.stroke();

    ctx.restore();
  }
}

// ─── Gravity Wells ────────────────────────────────────────────────────────────
/**
 * @param {any} [dt]
 */
function updateGravityWells(dt) {
  for (let i = gravityWells.length - 1; i >= 0; i--) {
    const w = gravityWells[i];
    w.timer += dt;
    if (w.dead || w.timer >= w.maxTimer) {
      w.dead = true;
      gravityWells.splice(i, 1);
      continue;
    }
  }
}

/**
 * @param {any} [camX]
 * @param {any} [camY]
 */
function drawGravityWells(camX, camY) {
  for (const w of gravityWells) {
    if (w.dead) continue;
    const tx = Math.floor(w.x), ty = Math.floor(w.y);
    if (!_EG.dungeon?.visible?.[ty]?.[tx]) continue;
    const sx = w.x * TILE - camX, sy = w.y * TILE - camY;
    const r = w.radius * TILE;
    const life = 1 - (w.timer / w.maxTimer);
    const pulse = 0.5 + 0.3 * Math.sin(w.timer * 6);

    ctx.save();

    // Inward-pulling gradient
    ctx.globalAlpha = life * pulse * 0.2;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    grad.addColorStop(0, 'rgba(136,51,255,0.5)');
    grad.addColorStop(0.6, 'rgba(136,51,255,0.2)');
    grad.addColorStop(1, 'rgba(136,51,255,0)');
    ctx.fillStyle = grad;
    NEON.draw.circle(ctx, sx, sy, r);

    // Concentric rings pulsing inward
    ctx.globalAlpha = life * pulse * 0.4;
    ctx.strokeStyle = '#aa55ff';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#8833ff';
    ctx.lineWidth = 1.5;
    for (let ring = 0; ring < 3; ring++) {
      const phase = (w.timer * 2 + ring * 0.33) % 1;
      const ringR = r * (1 - phase);
      ctx.globalAlpha = life * (1 - phase) * 0.35;
      NEON.draw.circleStroke(ctx, sx, sy, ringR);
    }

    // Centre core glow
    ctx.globalAlpha = life * 0.4;
    ctx.fillStyle = '#cc88ff';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#8833ff';
    NEON.draw.circle(ctx, sx, sy, 3 + Math.sin(w.timer * 4) * 1.5);

    ctx.restore();
  }
}

// ─── Player ───────────────────────────────────────────────────────────────────
class Player {
  /** @type {any} */ _metaSecondWindUsed;
  /** @type {any} */ _momentumTimer;
  /** @type {any} */ _outOfCombatTimer;
  /** @type {any} */ _prevX;
  /** @type {any} */ _prevY;
  /** @type {any} */ _posHistory;
  /** @type {any} */ _shotHistory;
  /** @type {any} */ _shieldCharges;
  /** @type {any} */ _surgeShotCount;
  /** @type {any} */ activeBoosts;
  /** @type {any} */ adrenalineTimer;
  /** @type {any} */ arcCooldown;
  /** @type {any} */ atk;
  /** @type {any} */ augments;
  /** @type {any} */ autoLaserBeam;
  /** @type {any} */ autoLaserTimer;
  /** @type {any} */ bountiesCollected;
  /** @type {any} */ burnDps;
  /** @type {any} */ burnTimer;
  /** @type {any} */ cloakTimer;
  /** @type {any} */ credits;
  /** @type {any} */ damageLog;
  /** @type {any} */ dashCooldown;
  /** @type {any} */ dashDx;
  /** @type {any} */ dashDy;
  /** @type {any} */ dashTimer;
  /** @type {any} */ dashTrail;
  /** @type {any} */ def;
  /** @type {any} */ disruptionFieldActive;
  /** @type {any} */ droneAngle;
  /** @type {any} */ enemiesKilled;
  /** @type {any} */ energyShield;
  /** @type {any} */ energyShieldTimer;
  /** @type {any} */ eventsResolved;
  /** @type {any} */ facing;
  /** @type {any} */ flashTimer;
  /** @type {any} */ gravityPullActive;
  /** @type {any} */ hackware;
  /** @type {any} */ hackwareCooldown;
  /** @type {any} */ hitsBlocked;
  /** @type {any} */ hp;
  /** @type {any} */ invincibleTimer;
  /** @type {any} */ keys;
  /** @type {any} */ killedBy;
  /** @type {any} */ level;
  /** @type {any} */ levelFlash;
  /** @type {any} */ loreRead;
  /** @type {any} */ lowHpTimer;
  /** @type {any} */ maxHp;
  /** @type {any} */ metaFlags;
  /** @type {any} */ orbitalAngle;
  /** @type {any} */ orbitalHits;
  /** @type {any} */ perks;
  /** @type {any} */ permSpeedBonus;
  /** @type {any} */ plasmaBurnTimer;
  /** @type {any} */ reactiveArmorCD;
  /** @type {any} */ regenTimer;
  /** @type {any} */ roomsCleared;
  /** @type {any} */ score;
  /** @type {any} */ secondWindUsed;
  /** @type {any} */ shards;
  /** @type {any} */ shieldBonus;
  /** @type {any} */ shockTimer;
  /** @type {any} */ shootCooldown;
  /** @type {any} */ bombCooldown;
  /** @type {any} */ spd;
  /** @type {any} */ speedBoost;
  /** @type {any} */ speedTimer;
  /** @type {any} */ spellTimers;
  /** @type {any} */ toxicBurnTimer;
  /** @type {any} */ toxicSlowActive;
  /** @type {any} */ trapCooldown;
  /** @type {any} */ upgrades;
  /** @type {any} */ weapon;
  /** @type {any} */ weaponIdx;
  /** @type {any} */ weapons;
  /** @type {any} */ x;
  /** @type {any} */ xp;
  /** @type {any} */ y;
  /** @type {any} */ critChance;
  /** @type {any} */ damageMult;
  /** @type {any} */ regenPerSec;
  /** @type {any} */ sensorRadiusMult;
  /** @type {any} */ hackwareSlots;
  /** @type {any} */ dashIFrameBonus;
  /** @type {any} */ bonusCreditPerPickup;
  constructor() { this.reset(); }
  reset() {
    this.x=5; this.y=5;
    this.hp=100; this.maxHp=100;
    this.atk=10; this.def=2; this.spd=3.5;
    this.level=1; this.xp=0;
    this.weapon=buildWeapon('PULSE_PISTOL', []);
    this.weapons=[this.weapon];   // weapon belt (max 3 slots)
    this.weaponIdx=0;              // active weapon index into weapons[]
    this.score=0;
    this.invincibleTimer=0;
    this.shootCooldown=0;
    this.bombCooldown=0;
    this.facing={x:1,y:0};
    this.speedBoost=0; this.speedTimer=0;
    this.shieldBonus=0;
    this.shards=0;
    this.flashTimer=0;
    this.levelFlash=0;
    this.lowHpTimer=0;
    this.keys={red:0, blue:0, gold:0};
    this.trapCooldown=0;
    this.plasmaBurnTimer=0;  // cosmetic throttle for plasma damage messages
    this.arcCooldown=0;      // separate cooldown for arc grid zaps
    this.toxicBurnTimer=0;   // cosmetic throttle for toxic pool damage messages
    this.toxicSlowActive=false; // true while standing on toxic tile
    this.disruptionFieldActive=false; // true while inside a disruption field
    this.gravityPullActive=false;     // true while being pulled by gravity well
    // Player status effect debuffs (applied by enemy attacks)
    this.burnTimer=0; this.burnDps=0;  // burn DoT from enemy melee/attacks
    this.shockTimer=0;                 // shock: brief movement suppress
    this.upgrades={};       // persistent upgrade levels: {SAW_BLADE:2, ...}
    this.permSpeedBonus=0;  // from OVERCLOCK
    this.orbitalAngle=0;    // shared rotation for saw blades
    this.orbitalHits=new Map(); // enemy→cooldown for orbital damage
    this.spellTimers={plasmaOrb:2, sentryDrone:1}; // cooldown timers for auto-spells
    this.droneAngle=0;          // orbital rotation for sentry drones
    this.perks={};              // level-unlocked passive abilities
    this.energyShield=false;    // active energy shield bubble
    this.energyShieldTimer=0;   // recharge countdown (30s)
    this.autoLaserTimer=0;      // auto-laser cooldown
    this.autoLaserBeam=null;    // {x1,y1,x2,y2,timer} for beam rendering
    this.credits=0;             // vendor currency
    // UNCHAINED #38: temp-boost floor-scoped flags + one-shot shield charges.
    // Cleared by _EG.loadFloor via NEON.boosts.clearFloorBoosts().
    this.activeBoosts={};
    this._shieldCharges=0;
    this.loreRead=new Set();    // indices of lore entries read this run
    this.dashCooldown=0;        // cooldown remaining (1.5s max)
    this.dashTimer=0;           // time left in active dash
    this.dashDx=0;              // dash direction x
    this.dashDy=0;              // dash direction y
    this.dashTrail=[];          // afterimage positions [{x,y,alpha}]
    // Position history ring — used by ECHOER to fire at where the player
    // WAS N seconds ago. Sampled every Player.update tick. Trimmed to
    // ~PLAYER_HISTORY_WINDOW seconds of samples (see update()). Cleared
    // on floor transitions so cross-floor lookbacks can't fire stale.
    this._posHistory=[];
    // Shot kinematics history ring — used by MIRROR mob to mimic the
    // player's last fired projectile (speed + colour only; damage is
    // mob-scaled, perks are NOT replayed). Bounded at SHOT_HISTORY_LEN.
    this._shotHistory=[];
    // Death recap tracking
    this.damageLog={};          // source → total damage taken
    this.killedBy='';           // source of killing blow
    this.enemiesKilled=0;       // total enemies killed this run
    // REAPER aggression counter: kills in the room the player is currently
    // in. Reset when player changes rooms (game.js updatePlaying). NOT
    // serialized — pure run-state. Drives REAPER frenzy trigger.
    this.killsInCurrentRoom=0;
    /** @type {any} */
    this._currentRoom=null;     // cached reference; not serialized
    this.hitsBlocked=0;         // energy shield blocks
    this.roomsCleared=0;        // rooms fully cleared of enemies
    this.eventsResolved=0;      // floor events completed
    // Hackware — active ability
    this.hackware=null;         // HACKWARE key or null
    this.hackwareCooldown=0;    // cooldown remaining
    this.cloakTimer=0;          // phase cloak duration remaining
    this.regenTimer=0;          // HP_REGEN perk timer
    this.secondWindUsed=false;  // SECOND_WIND: used this floor?
    this.bountiesCollected=0;   // bounty targets eliminated this run
    // Augments — passive cybernetic implants
    this.augments={};           // owned augments: {NEURAL_LINK: true, ...}
    this.adrenalineTimer=0;     // ADRENALINE_INJECTOR speed buff timer
    this.reactiveArmorCD=0;     // REACTIVE_ARMOR cooldown
    // UNCHAINED Phase 2 (#36) — persistent upgrade-node runtime state.
    // Behavioural listeners read player.metaFlags set by save.applyMetaToPlayer().
    this._momentumTimer=0;        // momentum: damage bonus countdown after kill
    this._surgeShotCount=0;       // surge: rolling shot counter (every 8th)
    this._metaSecondWindUsed=false; // meta second_wind: fired once per run
    this._outOfCombatTimer=0;     // regenerator: seconds since last hit
  }

  // ── Weapon Belt ──────────────────────────────────────────────────────
  /**
   * @param {any} [dir]
   */
  cycleWeapon(dir) {
    if (!this.weapons || this.weapons.length <= 1) return;
    this.weaponIdx = (this.weaponIdx + (dir || 1) + this.weapons.length) % this.weapons.length;
    this.weapon = this.weapons[this.weaponIdx];
    this.shootCooldown = 0;
  }

  /**
   * @param {any} [w]
   */
  collectWeapon(w) {
    if (!this.weapons) { this.weapons = [this.weapon]; this.weaponIdx = 0; }
    const MAX_BELT = 3;
    if (this.weapons.length < MAX_BELT) {
      this.weapons.push(w);
      return true; // collected into belt — no choice needed
    }
    return false; // belt full — caller should show swap UI
  }

  /**
   * @param {any} [slotIdx]
   * @param {any} [w]
   */
  swapWeapon(slotIdx, w) {
    if (!this.weapons || slotIdx < 0 || slotIdx >= this.weapons.length) return;
    this.weapons[slotIdx] = w;
    if (slotIdx === this.weaponIdx) this.weapon = w;
  }

  /**
   * @param {any} [w]
   */
  equipWeapon(w) {
    if (!this.weapons) { this.weapons = []; this.weaponIdx = 0; }
    this.weapon = w;
    this.weapons[this.weaponIdx] = w;
    this.shootCooldown = 0;
  }

  // Outgoing damage multiplier for player weapon hits. Delegated to the
  // testable pure module (src/meta/behavior.js).
  computeOutgoingDmgMul() {
    return NEON.behavior.computeOutgoingDmgMul(this);
  }

  _consumeSurgeShot() {
    return NEON.behavior.consumeSurgeShot(this);
  }

  /**
   * @param {any} [source]
   * @param {any} [amount]
   */
  logDamage(source, amount) {
    this.damageLog[source] = (this.damageLog[source] || 0) + amount;
  }

  xpNeeded() { return this.level*80; }

  effectiveAtk() {
    let a = this.atk;
    if (this.perks.BERSERKER && this.hp / this.maxHp <= 0.25) a = Math.round(a * 1.4);
    return a;
  }

  /**
   * @param {any} [amount]
   */
  gainXP(amount) {
    const augMul = hasAugment('NEURAL_LINK') ? 1.25 : 1;
    this.xp+=Math.round(amount * getMetaXPMultiplier() * augMul);
    while (this.xp>=this.xpNeeded() && this.level<10) {
      this.xp-=this.xpNeeded();
      this.level++;
      this.maxHp+=20; this.hp=this.maxHp;
      this.atk+=3; this.def+=1;
      this.levelFlash=1.5;
      audio.levelUp();
      _EG.msg('LEVEL UP! Now level '+this.level,'#00f5ff');
      if (PERK_LEVELS.includes(this.level)) {
        _EG.pendingPerkChoices.push(this.level);
      }
      if (this.level === 10) grantCapstone(this);
    }
    // Trigger perk choice UI after the loop (deferred so XP chips etc. resolve first)
    if (_EG.pendingPerkChoices.length && _EG.state === 'PLAYING') {
      _EG.openNextPerkChoice();
    }
  }

  /**
   * Returns the player's recorded position from `seconds` ago, or null
   * if the history doesn't go back that far (e.g. just spawned, just
   * crossed a floor). Used by ECHOER to fire predictively at where the
   * player WAS, rewarding unpredictable movement and punishing patterns.
   * Linear scan, history is small (<= ~96 entries @ 60fps over 1.6s).
   * @param {number} seconds
   * @returns {{x:number, y:number} | null}
   */
  getPositionAgo(seconds) {
    return getPositionAgoFromHistory(this._posHistory, seconds);
  }

  /**
   * Returns the player's PREDICTED position `seconds` in the future,
   * extrapolated linearly from velocity (current pos vs ~0.2s ago),
   * with velocity clamped to PROPHET_VEL_CAP to neutralise dash/teleport
   * blowups. Returns null if history doesn't reach back the velocity-
   * sample window (e.g. just spawned, just changed floors). Used by
   * PROPHET to fire at where the player WILL BE — the inverse of
   * getPositionAgo (where the player WAS, used by ECHOER).
   * @param {number} seconds lookahead in seconds
   * @returns {{x:number, y:number, vx:number, vy:number, vmag:number} | null}
   */
  getPredictedPosition(seconds) {
    return predictFromHistory(
      this._posHistory, this.x, this.y,
      seconds, PROPHET_VEL_SAMPLE, PROPHET_VEL_CAP
    );
  }

  /**
   * @param {any} [dmg]
   * @param {any} [source]
   * @param {any} [opts]
   */
  takeDamage(dmg, source, opts) {
    const options = opts || {};
    if (!options.ignoreInvincible && this.invincibleTimer>0) return 0;
    if (!options.ignoreImmunity && isPlayerDamageImmune()) return 0; // dash i-frames + phase cloak
    // UNCHAINED #38: SHIELD DRIVER boost — one-shot absorb. Consumed before
    // the ENERGY_SHIELD perk so a stacked player uses the cheap boost first.
    // Skip consumption when caller bypasses i-frames (env hazard DoT ticks
    // pass ignoreInvincible) — a 20¢ "absorbs next hit" must not evaporate
    // in one frame of plasma/toxic/arc contact.
    if (!options.ignoreShield && !options.ignoreInvincible && NEON.boosts.consumeShieldCharge(this)) {
      this.invincibleTimer = Math.max(this.invincibleTimer, 0.5); // preserve longer windows (e.g. SECOND_WIND)
      this.hitsBlocked = (this.hitsBlocked|0) + 1;
      audio.shieldBreak();
      spawnParticles(this.x,this.y,'EXPLOSION','#44aaff',10);
      spawnDmgText(this.x, this.y, 'ABSORB', '#44aaff');
      _EG.msg('◈ SHIELD DRIVER ABSORB','#44aaff');
      triggerShake(3, 0.12);
      return 0;
    }
    // Energy shield absorbs the hit
    if (!options.ignoreShield && this.energyShield && this.perks.ENERGY_SHIELD) {
      this.energyShield=false;
      this.energyShieldTimer=30;
      this.invincibleTimer=0.5;
      this.hitsBlocked++;
      audio.shieldBreak();
      spawnParticles(this.x,this.y,'EXPLOSION','#4488ff',12);
      spawnDmgText(this.x, this.y, 'BLOCK', '#4488ff');
      _EG.msg('🛡 SHIELD BROKEN','#4488ff');
      triggerShake(4, 0.15);
      return 0;
    }
    let actual;
    if (options.ignoreDefense) {
      actual = Math.max(0, dmg);
    } else {
      const titaniumReduction = hasAugment('TITANIUM_PLATING') ? 1 : 0;
      actual = Math.max(1, dmg - this.def - titaniumReduction);
    }
    if (_EG.modifier === 'CORROSIVE' && !options.ignoreDefense) actual += 2;
    if (actual <= 0) return 0;
    this.hp=Math.max(0,this.hp-actual);
    // UNCHAINED #36 regenerator: took real damage → out of combat timer resets.
    NEON.behavior.resetOutOfCombat(this);
    const src = source || 'Unknown';
    this.logDamage(src, actual);
    if (!options.skipHitInvincible) this.invincibleTimer = 0.5;
    if (!options.skipHitEffects) {
      this.flashTimer = 0.2;
      spawnDmgText(this.x, this.y, actual, '#ff4444');
      triggerShake(Math.min(actual * 0.4, 8), 0.2);
      audio.hit(true);
      spawnParticles(this.x, this.y, 'BLOOD', '#ff4444', 5);
    }
    // REACTIVE_ARMOR augment: emit damage pulse on hit
    if (!options.skipReactiveArmor && hasAugment('REACTIVE_ARMOR') && this.reactiveArmorCD <= 0) {
      this.reactiveArmorCD = 8;
      audio.reactiveArmor();
      const rRadius = 2.5;
      spawnParticles(this.x, this.y, 'EXPLOSION', '#ff6644', 14);
      const map = _EG.dungeon ? _EG.dungeon.map : null;
      for (const e of enemies) {
        if (e.dead) continue;
        if (e._wrPhased) continue;
        if (dist(this.x, this.y, e.x, e.y) < rRadius && (!map || hasLOS(this.x, this.y, e.x, e.y, map))) {
          e.takeDamage(10 + _EG.floor * 2, 'Reactive Armor');
        }
      }
    }
    // UNCHAINED #37 REACTIVE_CORE module: reflect % of incoming damage to nearest melee-range enemy.
    const _reflectPct = this.metaFlags && this.metaFlags.reflectDamagePct;
    if (_reflectPct > 0 && actual > 0 && !options.skipReactiveArmor) {
      const reflectDmg = Math.max(1, Math.round(actual * _reflectPct));
      let closest = null, closestD = 1.8; // melee range
      for (const e of enemies) {
        if (e.dead || e._wrPhased) continue;
        const d = dist(this.x, this.y, e.x, e.y);
        if (d < closestD) { closestD = d; closest = e; }
      }
      if (closest) {
        closest.takeDamage(reflectDmg, { name: 'Reactive Core', isProc: true });
        spawnParticles(closest.x, closest.y, 'SPARK', '#ff8844', 4);
      }
    }
    if (this.hp<=0) {
      // SECOND_WIND perk: revive once per floor
      if (this.perks.SECOND_WIND && !this.secondWindUsed) {
        this.secondWindUsed = true;
        this.hp = Math.round(this.maxHp * 0.3);
        this.invincibleTimer = 1.5;
        audio.secondWind();
        spawnParticles(this.x, this.y, 'EXPLOSION', '#00ddff', 20);
        triggerShake(8, 0.3);
        _EG.msg('💀 SECOND WIND!', '#00ddff');
        return actual;
      }
      // UNCHAINED #36 meta second_wind: persistent upgrade, one revive per run.
      // Fires in parallel with the perk — either can trigger independently.
      if (NEON.behavior.tryMetaSecondWind(this)) {
        this.invincibleTimer = 1.5;
        audio.secondWind();
        spawnParticles(this.x, this.y, 'EXPLOSION', '#00ddff', 20);
        triggerShake(8, 0.3);
        _EG.msg('💀 SECOND WIND!', '#00ddff');
        return actual;
      }
      this.killedBy=src; audio.gameOver(); _EG.endRun(false);
    }
    return actual;
  }

  /**
   * @param {any} [aimX]
   * @param {any} [aimY]
   * @param {any} [map]
   */
  shoot(aimX,aimY,map) {
    if (this.shootCooldown>0) return;
    const w=this.weapon;
    const [dx,dy]=norm(aimX-this.x,aimY-this.y);
    const hitCtx = { name:w.name, affixes:w._affixes||[], effects:w._effects||[] };
    // UNCHAINED #36: consume one surge shot + compute momentum/overclock mul.
    const surgeMul = this._consumeSurgeShot();
    // UNCHAINED #38: temp-boost COMBAT STIM stacks multiplicatively.
    const boostDmgMul = NEON.boosts.getBoostDamageMul(this);
    const metaMul = this.computeOutgoingDmgMul() * surgeMul * boostDmgMul;
    // UNCHAINED #38: CRIT MATRIX adds flat crit chance. Also drops the
    // CRITICAL_HIT perk gate — any player with an active matrix can crit.
    const critBonus = NEON.boosts.getBoostCritBonus(this);
    const mf = this.metaFlags || {};
    const critChance = (this.perks.CRITICAL_HIT ? 0.15 : 0) + critBonus + (mf.critChanceBonus || 0);
    const critMul = 2 + (mf.critDamageBonus || 0);

    if (w.melee) {
      // plasma sword arc
      const meleeCrit = critChance > 0 && Math.random() < critChance;
      const meleeDmg = (w.dmg+this.effectiveAtk()) * (meleeCrit ? critMul : 1) * metaMul;
      spawnParticles(this.x+dx*1.5, this.y+dy*1.5,'EXPLOSION',w.colour,8);
      for (const e of enemies) {
        if (e.dead) continue;
        if (e._wrPhased) continue;
        if (dist(this.x,this.y,e.x,e.y)<w.range) {
          e.takeDamage(meleeDmg, hitCtx);
          if (meleeCrit) spawnDmgText(e.x, e.y, 'CRIT!', '#ffdd00');
        }
      }
    } else {
      let lastProjSpd = 12;
      for (let i=0;i<w.count;i++) {
        const spread=(Math.random()-0.5)*(w.spread + (_EG.modifier==='SCRAMBLED' ? 0.15 : 0));
        const a=Math.atan2(dy,dx)+spread;
        const pdx=Math.cos(a), pdy=Math.sin(a);
        const isCrit = critChance > 0 && Math.random() < critChance;
        const proj=new Projectile(
          this.x,this.y,pdx,pdy,12,(w.dmg+this.effectiveAtk())*(isCrit?critMul:1)*metaMul,w.range,
          w.colour,!!w.piercing,true,w.name
        );
        proj.isCrit = isCrit;
        proj._effects = w._effects || [];
        proj._affixes = w._affixes || [];
        if (this.perks.PIERCING_ROUNDS) proj.maxPierces+=1;
        proj.bouncesLeft=this.upgrades.RICOCHET||0;
        if (proj.bouncesLeft) proj._hasRicochet=true;
        projectiles.push(proj);
        // Capture the post-_init speed so MIRROR mimicry sees the actual
        // value (KINETIC_AMPLIFIER, CHARGED modifier, etc) rather than the
        // base 12. MIRROR re-clamps into its fair band before firing back.
        lastProjSpd = proj.spd;
      }
      // MULTI_SHOT perk: fire a bonus 60%-damage projectile (ranged only)
      if (this.perks.MULTI_SHOT) {
        const offAngle = (Math.random() < 0.5 ? -1 : 1) * 0.14; // ~8°
        const a = Math.atan2(dy, dx) + offAngle;
        const pdx = Math.cos(a), pdy = Math.sin(a);
        const isCrit = critChance > 0 && Math.random() < critChance;
        const bonusDmg = Math.round((w.dmg + this.effectiveAtk()) * 0.6 * (isCrit ? critMul : 1) * metaMul);
        const proj = new Projectile(this.x, this.y, pdx, pdy, 12, bonusDmg, w.range, w.colour, !!w.piercing, true, w.name);
        proj.isCrit = isCrit;
        proj._effects = w._effects || [];
        proj._affixes = w._affixes || [];
        if (this.perks.PIERCING_ROUNDS) proj.maxPierces += 1;
        proj.bouncesLeft = this.upgrades.RICOCHET || 0;
        if (proj.bouncesLeft) proj._hasRicochet = true;
        projectiles.push(proj);
      }
      spawnParticles(this.x+dx*0.8,this.y+dy*0.8,'MUZZLE',w.colour,3);
      // Record a kinematics sample for MIRROR mob mimicry. Only ranged shots
      // are recorded — melee swings have no projectile to mimic. We store
      // ONLY speed and colour: damage is intentionally omitted so MIRROR
      // re-derives damage from its own atk (no late-game crit replay), and
      // piercing/ricochet/homing are omitted so player perks never leak into
      // enemy projectiles. Bounded ring (SHOT_HISTORY_LEN); shift on overflow.
      if (!this._shotHistory) this._shotHistory = [];
      this._shotHistory.push({ spd: lastProjSpd, colour: w.colour });
      while (this._shotHistory.length > SHOT_HISTORY_LEN) this._shotHistory.shift();
    }
    audio.shoot(true, w);
    this.shootCooldown = (1/w.rate) * (this.perks.RAPID_FIRE ? 0.85 : 1);
  }

  // Tap-tap fuse bomb (Metroid-style infinite, gated by drop cooldown).
  // First tap: drop a fuse bomb at feet (3s telegraph: slow→fast→rapid flash).
  // Second tap while ANY fuse is active: detonate ALL active fuses immediately
  // (the panic-detonate, preserves the V-shard "oh shit" feel).
  // Drop cooldown prevents literal spam without limiting strategic chains.
  // Replaces the consumable VOID_SHARD; player.shards field is now vestigial
  // (kept for save back-compat at game.js:858/952; never read).
  tapBombKey() {
    // Panic mode: any unfused bomb? Detonate them all.
    let detonatedAny = false;
    for (const fs of fuseShards) {
      if (!fs.dead) { fs.detonate(); detonatedAny = true; }
    }
    if (detonatedAny) return;
    // Drop mode: gated by cooldown (prevents tap-spam carpet bombing).
    if (this.bombCooldown > 0) return;
    fuseShards.push(new FuseShard(this.x, this.y));
    this.bombCooldown = BOMB_DROP_COOLDOWN;
  }

  /**
   * @param {any} [dt]
   * @param {any} [map]
   */
  update(dt,map) {
    this._prevX = this.x; this._prevY = this.y;
    // Position history sample — append (t-elapsed accumulated, x, y). Used
    // by ECHOER's predictive shot (entities.js aiEchoer). Trim entries
    // older than PLAYER_HISTORY_WINDOW seconds (covers ECHOER_LOOKBACK
    // with margin). Single shared ring per player; reads via
    // getPositionAgo(seconds).
    if (!this._posHistory) this._posHistory = [];
    // Each entry stores age relative to "now" — we increment by dt every
    // frame, then drop entries older than the window. New samples are
    // pushed with age=0.
    const PLAYER_HISTORY_WINDOW = 1.6; // seconds — must exceed ECHOER_LOOKBACK
    for (let i = 0; i < this._posHistory.length; i++) this._posHistory[i].t += dt;
    this._posHistory.push({ t: 0, x: this.x, y: this.y });
    // Drop the oldest entries beyond the window. History is age-monotonic
    // (oldest first after the per-frame age bump), so a single shift loop
    // is correct and O(dropped).
    while (this._posHistory.length > 1 && this._posHistory[0].t > PLAYER_HISTORY_WINDOW) {
      this._posHistory.shift();
    }
    this.invincibleTimer=Math.max(0,this.invincibleTimer-dt);
    this.shootCooldown=Math.max(0,this.shootCooldown-dt);
    this.bombCooldown=Math.max(0,this.bombCooldown-dt);
    this.flashTimer=Math.max(0,this.flashTimer-dt);
    this.levelFlash=Math.max(0,this.levelFlash-dt);
    this.dashCooldown=Math.max(0,this.dashCooldown-dt);
    // Hackware cooldown + cloak timer (frozen by disruption fields)
    if (!this.disruptionFieldActive) this.hackwareCooldown=Math.max(0,this.hackwareCooldown-dt);
    if (this.cloakTimer > 0) {
      this.cloakTimer -= dt;
      if (Math.random() < dt * 6) spawnParticles(this.x, this.y, 'MUZZLE', '#cc44ff', 1);
      if (this.cloakTimer <= 0) {
        this.cloakTimer = 0;
        audio.hackwareCloakEnd();
        spawnParticles(this.x, this.y, 'EXPLOSION', '#cc44ff', 8);
        _EG.msg('◇ CLOAK EXPIRED', '#886699');
      }
    }
    if (this.speedTimer>0) { this.speedTimer-=dt; if(this.speedTimer<=0)this.speedBoost=0; }
    // Player burn DoT
    if (this.burnTimer > 0) {
      const tick = Math.min(dt, this.burnTimer);
      this.burnTimer -= dt;
      if (!isPlayerDamageImmune() && this.invincibleTimer <= 0) {
        const bdmg = this.burnDps * tick;
        this.takeDamage(bdmg, 'Burn', { ignoreInvincible:true, ignoreImmunity:true, ignoreShield:true,
          ignoreDefense:true, skipHitInvincible:true, skipHitEffects:true, skipReactiveArmor:true });
        if (Math.random() < tick * 5) spawnParticles(this.x, this.y, 'MUZZLE', '#ff6600', 1);
      }
      if (this.burnTimer <= 0) { this.burnTimer = 0; this.burnDps = 0; }
    }
    // Player shock decay
    if (this.shockTimer > 0) {
      this.shockTimer -= dt;
      if (Math.random() < dt * 8) spawnParticles(this.x, this.y, 'SPARK', '#ffee44', 1);
      if (this.shockTimer <= 0) this.shockTimer = 0;
    }
    // Augment timers
    if (this.adrenalineTimer > 0) this.adrenalineTimer = Math.max(0, this.adrenalineTimer - dt);
    if (this.reactiveArmorCD > 0) this.reactiveArmorCD = Math.max(0, this.reactiveArmorCD - dt);
    // UNCHAINED #36 momentum: countdown damage-bonus window.
    NEON.behavior.tickMomentum(this, dt);
    // UNCHAINED #36 regenerator: passive HP regen when out of combat 3s+.
    // _outOfCombatTimer resets in takeDamage on real damage taken.
    NEON.behavior.tickOutOfCombatRegen(this, dt);

    // Dash afterimage trail fade
    for (let i=this.dashTrail.length-1;i>=0;i--) {
      this.dashTrail[i].alpha-=dt*4;
      if (this.dashTrail[i].alpha<=0) this.dashTrail.splice(i,1);
    }

    // Active dash movement
    if (this.dashTimer>0) {
      const step=Math.min(dt,this.dashTimer); // clamp to remaining dash time
      this.dashTimer-=dt;
      const dashSpd=18; // tiles/sec during dash
      const nx=this.x+this.dashDx*dashSpd*step;
      const ny=this.y+this.dashDy*dashSpd*step;
      const tx=Math.floor(nx), ty=Math.floor(this.y);
      const ox=Math.floor(this.x), oy=Math.floor(ny);
      if (tx>=0&&ty>=0&&tx<MAP_W&&ty<MAP_H && isPassable(map[ty][tx])) this.x=nx;
      else this.dashTimer=0; // hit wall, end dash early
      if (ox>=0&&oy>=0&&ox<MAP_W&&oy<MAP_H && isPassable(map[oy][ox])) this.y=ny;
      else this.dashTimer=0;
      // Drop afterimage
      if (this.dashTrail.length < 8) this.dashTrail.push({x:this.x,y:this.y,alpha:0.7});
      this.invincibleTimer=Math.max(this.invincibleTimer, 0.05); // i-frames during dash
      spawnParticles(this.x,this.y,'SPARK','#ffb700',1);
      return; // skip normal movement during dash
    }

    // Energy shield recharge
    if (this.perks.ENERGY_SHIELD && !this.energyShield && this.energyShieldTimer>0) {
      this.energyShieldTimer-=dt;
      if (this.energyShieldTimer<=0) {
        this.energyShield=true;
        this.energyShieldTimer=0;
        audio.shieldRestore();
        _EG.msg('🛡 SHIELD RESTORED','#4488ff');
      }
    }

    // Low health warning pulse
    if (this.hp > 0 && this.hp / this.maxHp <= 0.25) {
      this.lowHpTimer -= dt;
      if (this.lowHpTimer <= 0) { audio.lowHealth(); this.lowHpTimer = 2; }
    } else { this.lowHpTimer = 0; }

    // HP_REGEN perk: heal 1 HP every 3s
    if (this.perks.HP_REGEN && this.hp > 0 && this.hp < this.maxHp) {
      this.regenTimer += dt;
      if (this.regenTimer >= 3) {
        this.regenTimer -= 3;
        this.hp = Math.min(this.maxHp, this.hp + 1);
        spawnDmgText(this.x, this.y, '+1', '#00ff88');
      }
    }

    let spd=modSpeed(this.spd+(this.speedBoost||0)+(this.permSpeedBonus||0));
    if (this.adrenalineTimer > 0) spd *= 1.3;
    if (this.perks.ADRENALINE) spd *= 1.2;
    spd *= NEON.boosts.getBoostSpeedMul(this); // UNCHAINED #38: REFLEX BOOSTER
    if (this.toxicSlowActive && this.dashTimer <= 0) spd *= 0.7; // 30% slow while in toxic pool
    if (this.disruptionFieldActive && this.dashTimer <= 0) spd *= 0.8; // 20% slow in disruption field
    let mx=0,my=0;
    if (keys.has(km('up'))||keys.has(ALT_KEYS.up))       my=-1;
    if (keys.has(km('down'))||keys.has(ALT_KEYS.down))   my= 1;
    if (keys.has(km('left'))||keys.has(ALT_KEYS.left))   mx=-1;
    if (keys.has(km('right'))||keys.has(ALT_KEYS.right)) mx= 1;
    // touch joystick
    if (touch.joystick.active) { mx+=touch.joystick.dx; my+=touch.joystick.dy; }

    // Shocked: suppress movement (can still aim and shoot)
    if (this.shockTimer > 0) { mx = 0; my = 0; }

    if (mx||my) {
      const [ndx,ndy]=norm(mx,my);
      const nx=this.x+ndx*spd*dt;
      const ny=this.y+ndy*spd*dt;
      const tx=Math.floor(nx), ty=Math.floor(this.y);
      const ox=Math.floor(this.x),oy=Math.floor(ny);
      if (tx>=0&&ty>=0&&tx<MAP_W&&ty<MAP_H && isPassable(map[ty][tx])) this.x=nx;
      if (ox>=0&&oy>=0&&ox<MAP_W&&oy<MAP_H && isPassable(map[oy][ox])) this.y=ny;
      this.facing={x:ndx,y:ndy};
    }

    // Gravity well pull (skip during dash and shock)
    if (this.dashTimer <= 0 && this.shockTimer <= 0) {
      let pullX = 0, pullY = 0;
      for (const w of gravityWells) {
        if (w.dead) continue;
        // Same room check — player must be inside the well's room
        const r = w.room;
        if (r && !(this.x >= r.x && this.x < r.x + r.w && this.y >= r.y && this.y < r.y + r.h)) continue;
        const d = dist(this.x, this.y, w.x, w.y);
        if (d < w.radius && d > 0.1) {
          const [dx, dy] = norm(w.x - this.x, w.y - this.y);
          pullX += dx * 2.0;
          pullY += dy * 2.0;
        }
      }
      // Cap total pull magnitude at 2.5 tiles/sec
      const pullMag = Math.sqrt(pullX * pullX + pullY * pullY);
      if (pullMag > 2.5) {
        pullX = pullX / pullMag * 2.5;
        pullY = pullY / pullMag * 2.5;
      }
      if (pullX || pullY) {
        if (!this.gravityPullActive) audio.gravitonPull(); // sound on entering pull
        this.gravityPullActive = true;
        const pnx = this.x + pullX * dt;
        const pny = this.y + pullY * dt;
        const ptx = Math.floor(pnx), pty = Math.floor(this.y);
        const pox = Math.floor(this.x), poy = Math.floor(pny);
        if (ptx >= 0 && pty >= 0 && ptx < MAP_W && pty < MAP_H && isPassable(map[pty][ptx])) this.x = pnx;
        if (pox >= 0 && poy >= 0 && pox < MAP_W && poy < MAP_H && isPassable(map[poy][pox])) this.y = pny;
      } else {
        this.gravityPullActive = false;
      }
    } else {
      this.gravityPullActive = false;
    }

    // void shard
    if (jp(km('voidshard'))) this.tapBombKey();
    if (jp(km('hackware'))) activateHackware(this);
    // Weapon belt cycle: scroll wheel or number keys
    if (jp('WheelDown')) { this.cycleWeapon(1); try { audio.menuSelect(); } catch(_){} }
    if (jp('WheelUp'))   { this.cycleWeapon(-1); try { audio.menuSelect(); } catch(_){} }
    if (this.weapons && this.weapons.length > 1) {
      for (let wi = 0; wi < Math.min(this.weapons.length, 3); wi++) {
        if (jp('Digit' + (wi + 1))) { this.weaponIdx = wi; this.weapon = this.weapons[wi]; this.shootCooldown = 0; try { audio.menuSelect(); } catch(_){} }
      }
    }

    // dash activation
    if ((jp(km('dash'))||jp(ALT_KEYS.dash))&&this.dashCooldown<=0&&this.hp>0) {
      let dx, dy;
      if (mx||my) {
        [dx,dy]=norm(mx,my);
      } else if (settings.lockAimToMove) {
        // Lock-aim mode: ignore mouse, dash in last-walked direction
        dx=this.facing.x; dy=this.facing.y;
      } else {
        // Use current aim direction (facing may be stale by one frame)
        const cam=getCamera(this);
        const ax=(mouse.x+cam.x)/TILE-this.x, ay=(mouse.y+cam.y)/TILE-this.y;
        [dx,dy]=norm(ax,ay);
        if (!dx&&!dy) { dx=this.facing.x; dy=this.facing.y; }
      }
      this.dashDx=dx; this.dashDy=dy;
      this.dashTimer=0.12;
      const baseCd = this.perks.DASH_MASTER ? 0.75 : 1.5;
      this.dashCooldown = baseCd * ((this.metaFlags && this.metaFlags.dashCooldownMul) || 1);
      this.dashTrail.push({x:this.x,y:this.y,alpha:0.8});
      audio.dash();
      spawnParticles(this.x,this.y,'EXPLOSION','#ffb700',6);
    }
  }

  /**
   * @param {any} [camX]
   * @param {any} [camY]
   */
  draw(camX,camY) {
    const sx=this.x*TILE-camX, sy=this.y*TILE-camY;
    const col=this.flashTimer>0?'#ffffff':'#00f5ff';

    // Dash afterimages
    for (const g of this.dashTrail) {
      const gx=g.x*TILE-camX, gy=g.y*TILE-camY;
      ctx.save();
      ctx.globalAlpha=g.alpha*0.5;
      ctx.fillStyle='#ffb700';
      ctx.shadowBlur=8; ctx.shadowColor='#ffb700';
      NEON.draw.circle(ctx, gx, gy, 7);
      ctx.restore();
    }

    // Laser sight (drawn under player so it originates from centre)
    if (this.perks.LASER_SIGHT && _EG.dungeon && !this.weapon.melee) {
      const map = _EG.dungeon.map;
      const maxDist = this.weapon.range;
      const step = 0.15;
      let rx = this.x, ry = this.y;
      for (let d = 0; d < maxDist; d += step) {
        const nx = rx + this.facing.x * step;
        const ny = ry + this.facing.y * step;
        const tx = Math.floor(nx), ty = Math.floor(ny);
        if (tx<0||ty<0||tx>=MAP_W||ty>=MAP_H) break;
        if (!isPassable(map[ty][tx])) break;
        rx = nx; ry = ny;
      }
      const ex = rx*TILE-camX, ey = ry*TILE-camY;
      const lc = this.weapon.colour;
      ctx.save();
      // Beam line — thin, translucent, with glow
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = lc;
      ctx.shadowBlur = 8; ctx.shadowColor = lc;
      ctx.lineWidth = 1;
      ctx.setLineDash([4,4]);
      NEON.draw.line(ctx, sx, sy, ex, ey);
      ctx.setLineDash([]);
      // Endpoint dot
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = lc;
      NEON.draw.circle(ctx, ex, ey, 2.5);
      ctx.restore();
    }

    // Auto-Laser beam effect
    if (this.autoLaserBeam) {
      const b = this.autoLaserBeam;
      const alpha = b.timer / 0.15;
      ctx.save();
      // Outer glow
      ctx.globalAlpha = alpha * 0.6;
      ctx.strokeStyle = '#ff2222';
      ctx.shadowBlur = 14; ctx.shadowColor = '#ff2222';
      ctx.lineWidth = 2.5;
      NEON.draw.line(ctx, b.x1*TILE-camX, b.y1*TILE-camY, b.x2*TILE-camX, b.y2*TILE-camY);
      // Bright core
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#ffffff';
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1;
      NEON.draw.line(ctx, b.x1*TILE-camX, b.y1*TILE-camY, b.x2*TILE-camX, b.y2*TILE-camY);
      ctx.restore();
    }

    ctx.save();
    // Phase cloak: ghostly transparent player
    if (this.cloakTimer > 0) {
      const flicker = 0.15 + Math.sin(performance.now() * 0.01) * 0.1;
      ctx.globalAlpha = flicker;
    }
    // body
    ctx.shadowBlur=15; ctx.shadowColor=this.cloakTimer > 0 ? '#cc44ff' : col;
    ctx.fillStyle=this.cloakTimer > 0 ? '#cc44ff' : col;
    NEON.draw.circle(ctx, sx, sy, 7);
    // direction pip
    ctx.shadowBlur=5;
    ctx.fillStyle='#ffffff';
    NEON.draw.circle(ctx, sx+this.facing.x*7, sy+this.facing.y*7, 2.5);
    ctx.restore();

    // Energy shield bubble
    if (this.energyShield && this.perks.ENERGY_SHIELD) {
      ctx.save();
      const pulse=0.15*Math.sin(performance.now()*0.004);
      ctx.globalAlpha=0.25+pulse;
      ctx.strokeStyle='#4488ff';
      ctx.shadowBlur=12; ctx.shadowColor='#4488ff';
      ctx.lineWidth=1.5;
      NEON.draw.circleStroke(ctx, sx, sy, 12);
      ctx.restore();
    }
    // Burn indicator — flickering orange underglow
    if (this.burnTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(performance.now() * 0.012) * 0.15;
      ctx.shadowBlur = 16; ctx.shadowColor = '#ff6600';
      ctx.fillStyle = '#ff6600';
      NEON.draw.circle(ctx, sx, sy, 10);
      ctx.restore();
    }
    // Shock indicator — rapid yellow flash
    if (this.shockTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(performance.now() * 0.04) * 0.3;
      ctx.shadowBlur = 18; ctx.shadowColor = '#ffee44';
      ctx.fillStyle = '#ffee44';
      NEON.draw.circle(ctx, sx, sy, 9);
      ctx.restore();
    }
  }
}

// ─── Fuse Bomb (tap-tap V) ───────────────────────────────────────────────────
// FuseShard replaces the old consumable VOID_SHARD detonation. Players tap V
// to drop one at their feet (3s telegraph: slow→fast→rapid flash), then tap V
// again to detonate ALL active fuses early (panic mode). Bombs are infinite,
// gated by BOMB_DROP_COOLDOWN to prevent literal spam without limiting
// strategic chains. Wall-shatter + secret-room reveal logic preserved from the
// original useVoidShard (was at src/entities.js:6577 pre-refactor).
const FUSE_DURATION       = 3.0;   // seconds from drop to auto-detonate
const FUSE_PHASE_FAST     = 1.5;   // s remaining when flash speeds up
const FUSE_PHASE_RAPID    = 0.5;   // s remaining when flash goes rapid
const FUSE_FLASH_SLOW     = 0.50;  // toggle period in slow phase (s)
const FUSE_FLASH_FAST     = 0.20;  // toggle period in fast phase (s)
const FUSE_FLASH_RAPID    = 0.08;  // toggle period in rapid phase (s)
const BOMB_DROP_COOLDOWN  = 1.0;   // min seconds between drops
const BOMB_BLAST_RADIUS   = 6;     // tiles (matches old useVoidShard)
const BOMB_DAMAGE         = 80;    // matches old useVoidShard

class FuseShard {
  /**
   * @param {number} x
   * @param {number} y
   */
  constructor(x, y) {
    this.x = x; this.y = y;
    this.fuseTime = FUSE_DURATION;
    this.dead = false;
    this._elapsed = 0;
  }
  /**
   * @param {number} dt
   */
  update(dt) {
    if (this.dead) return;
    this.fuseTime -= dt;
    this._elapsed += dt;
    if (this.fuseTime <= 0) this.detonate();
  }
  detonate() {
    if (this.dead) return;
    this.dead = true;
    _detonateBombAt(this.x, this.y);
  }
  /**
   * @param {number} camX
   * @param {number} camY
   */
  draw(camX, camY) {
    if (this.dead) return;
    const sx = (this.x - camX) * TILE;
    const sy = (this.y - camY) * TILE;
    const remaining = this.fuseTime;
    let period;
    if (remaining > FUSE_PHASE_FAST) period = FUSE_FLASH_SLOW;
    else if (remaining > FUSE_PHASE_RAPID) period = FUSE_FLASH_FAST;
    else period = FUSE_FLASH_RAPID;
    const on = (Math.floor(this._elapsed / period) % 2) === 0;
    ctx.save();
    ctx.shadowBlur = on ? 18 : 6;
    ctx.shadowColor = '#aa00ff';
    ctx.fillStyle = on ? '#ff66ff' : '#aa00ff';
    NEON.draw.circle(ctx, sx, sy, 7);
    ctx.fillStyle = on ? '#ffffff' : '#cc44cc';
    NEON.draw.circle(ctx, sx, sy, 3);
    ctx.restore();
  }
}

/**
 * Bomb detonation: damage mobs in radius, shatter cracked walls, reveal
 * adjacent secret rooms. Called by FuseShard.detonate() (auto-fuse expiry or
 * panic-tap). Mirrors old useVoidShard's side-effects exactly.
 * @param {number} x
 * @param {number} y
 */
function _detonateBombAt(x, y) {
  for (const e of enemies) {
    if (!e.dead && !e._wrPhased && dist(x, y, e.x, e.y) < BOMB_BLAST_RADIUS) {
      e.takeDamage(BOMB_DAMAGE, 'Bomb');
    }
  }
  spawnParticles(x, y, 'EXPLOSION', '#aa00ff', 30);
  triggerShake(10, 0.3);
  const map = _EG.dungeon && _EG.dungeon.map;
  let wallsBroken = 0;
  if (map) {
    const cx = Math.floor(x), cy = Math.floor(y);
    const R = BOMB_BLAST_RADIUS;
    const x0 = Math.max(0, cx - R), x1 = Math.min(MAP_W - 1, cx + R);
    const y0 = Math.max(0, cy - R), y1 = Math.min(MAP_H - 1, cy + R);
    for (let ty = y0; ty <= y1; ty++) {
      const row = map[ty]; if (!row) continue;
      for (let tx = x0; tx <= x1; tx++) {
        if (row[tx] !== T.CRACKED) continue;
        if (dist(x, y, tx + 0.5, ty + 0.5) >= R) continue;
        row[tx] = T.FLOOR;
        wallsBroken++;
        spawnParticles(tx + 0.5, ty + 0.5, 'EXPLOSION', '#ffb700', 12);
        if (_EG.dungeon && Array.isArray(_EG.dungeon.secretRooms)) {
          for (const sr of _EG.dungeon.secretRooms) {
            if (sr.secretRevealed) continue;
            if (tx >= sr.x - 1 && tx <= sr.x + sr.w && ty >= sr.y - 1 && ty <= sr.y + sr.h) {
              if (typeof _EG.revealSecretRoom === 'function') _EG.revealSecretRoom(sr);
              break;
            }
          }
        }
      }
    }
    if (wallsBroken > 0) {
      if (typeof _EG.markMapMutated === 'function') _EG.markMapMutated();
      audio.wallBreak();
    }
  }
  if (wallsBroken > 0) {
    _EG.msg('BOMB DETONATED — ' + wallsBroken + ' wall' + (wallsBroken > 1 ? 's' : '') + ' shattered!', '#ffb700');
  } else {
    _EG.msg('BOMB DETONATED!', '#aa00ff');
  }
}

/**
 * Per-frame update + dead-bomb prune. Called from game.js update loop.
 * @param {number} dt
 */
function updateFuseShards(dt) {
  for (const fs of fuseShards) fs.update(dt);
  for (let i = fuseShards.length - 1; i >= 0; i--) {
    if (fuseShards[i].dead) fuseShards.splice(i, 1);
  }
}

/**
 * Per-frame draw. Called from game.js render loop, drawn between items and
 * enemies so the bomb is visible above ground but obscured by mobs (so a
 * planted bomb under a charging enemy still looks "in the world").
 * @param {number} camX
 * @param {number} camY
 */
function drawFuseShards(camX, camY) {
  for (const fs of fuseShards) fs.draw(camX, camY);
}

function clearFuseShards() { fuseShards.length = 0; }
