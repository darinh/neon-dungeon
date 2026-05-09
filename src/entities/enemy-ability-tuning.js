// @ts-check
'use strict';

// ECHOER tuning constants. Tweak with caution: these directly drive perceived
// fairness of the predictive shot.
const ECHOER_LOOKBACK   = 1.0;  // seconds back to sample the player's position
const ECHOER_TELEGRAPH  = 0.8;  // ghost+lane visible duration before fire
const ECHOER_COOLDOWN   = 2.5;  // seconds between aim attempts (post-fire)
const ECHOER_RANGE      = 14;   // tiles - max lock distance (echoer->past-pos)
const ECHOER_PROJ_SPD   = 9;    // tiles/sec - slow & dodgeable

// PROPHET tuning constants - the inverse of ECHOER. PROPHET extrapolates the
// player's velocity forward by PROPHET_LOOKAHEAD seconds and locks onto the
// PREDICTED future position.
const PROPHET_LOOKAHEAD  = 0.6;  // seconds ahead to extrapolate the player's position
const PROPHET_VEL_SAMPLE = 0.2;  // seconds back to sample for velocity estimate
const PROPHET_TELEGRAPH  = 0.7;  // ghost+lane visible duration before fire
const PROPHET_COOLDOWN   = 2.8;  // seconds between aim attempts (post-fire)
const PROPHET_RANGE      = 13;   // tiles - max lock distance (prophet->predicted)
const PROPHET_PROJ_SPD   = 11;   // tiles/sec - fast (must arrive at the future point on time)
const PROPHET_MIN_VEL    = 1.5;  // tiles/sec - minimum player velocity required to lock
const PROPHET_VEL_CAP    = 10;   // tiles/sec - clamp velocity to avoid dash/teleport blowup

// CRYOPHAGE tuning constants - area-denial frost-patch layer (floor 6+).
const CRYOPHAGE_TELEGRAPH    = 1.0;   // seconds the cyan + glyph is visible before patches commit
const CRYOPHAGE_COOLDOWN     = 3.5;   // seconds between aim attempts (post-commit)
const CRYOPHAGE_RANGE        = 8;     // tiles - max LoS distance to attempt a lock
const CRYOPHAGE_PATCH_LIFE   = 2.5;   // seconds each frost patch lingers after commit
const CRYOPHAGE_PATCH_RADIUS = 0.6;   // tiles - damage radius from each patch centre
const CRYOPHAGE_TICK_ICD     = 0.5;   // seconds between damage ticks per patch
const CRYOPHAGE_DMG_MUL      = 0.45;  // damage = round(atk * 0.45) per tick

// WARDLING tuning constants - fragile bodyguard (floor 5+).
const WARDLING_GUARD_DIST    = 1.0;   // tiles from ward toward player (interception offset)
const WARDLING_REWARD_PERIOD = 0.5;   // seconds between ward re-acquisition scans (perf)
const WARDLING_PANIC_MUL     = 1.4;   // speed multiplier when no ward available

// VENGEANCE tuning constants - kill-charged retaliator (floor 7+).
const VENGEANCE_THRESHOLD     = 3;     // kills in room before rush triggers
const VENGEANCE_TELEGRAPH     = 0.8;   // seconds of warning before strike
const VENGEANCE_RUSH_DURATION = 0.6;   // seconds the strike dash lasts
const VENGEANCE_RUSH_SPD      = 9;     // tiles/sec during the rush dash
const VENGEANCE_RANGE         = 10;    // tiles - max LoS distance to commit a rush

// CONDUIT tuning constants - paired-beam mob (floor 8+).
const CONDUIT_SOLO_FIRE_CD    = 3.0;   // seconds between solo basic shots
const CONDUIT_SOLO_PROJ_SPD   = 4.5;   // tiles/sec for solo basic shot
const CONDUIT_SOLO_DMG_MUL    = 0.6;   // basic-shot damage multiplier vs atk
const CONDUIT_SOLO_RANGE      = 9;     // tiles - solo shot lifetime in tiles
const CONDUIT_BEAM_W          = 0.4;   // tiles - perpendicular hit threshold
const CONDUIT_BEAM_DMG_MUL    = 0.7;   // beam damage per ICD tick vs atk
const CONDUIT_BEAM_ICD        = 0.5;   // seconds between beam ticks per link

// RESONATOR tuning constants. Stationary mob: silent charge -> telegraphed
// cone -> instant fire -> recovery.
const RESONATOR_CHARGE     = 2.2;            // silent windup before telegraph
const RESONATOR_TELEGRAPH  = 0.8;            // wedge visible - fairness window
const RESONATOR_RECOVERY   = 1.0;            // post-fire cooldown
const RESONATOR_RANGE      = 6;              // tiles - cone depth
const RESONATOR_CONE_DEG   = 60;             // full cone angular width (degrees)
const RESONATOR_DMG_MUL    = 0.8;            // damage = atk * 0.8
const RESONATOR_HALF_RAD   = (RESONATOR_CONE_DEG * 0.5) * Math.PI / 180; // precomputed

// WATCHER tuning constants. Stationary sweeping-cone lighthouse (floor 6+).
const WATCHER_SWEEP_RATE = 0.55; // rad/s - full rotation ~11.4s
const WATCHER_CONE_DEG   = 50;   // wedge angular width (degrees)
const WATCHER_RANGE      = 9;    // tiles - cone depth and beam reach
const WATCHER_TELEGRAPH  = 0.65; // seconds - fairness window after lock
const WATCHER_RECOVERY   = 1.4;  // seconds - post-fire cooldown
const WATCHER_DMG_MUL    = 1.0;  // damage = atk * 1.0
const WATCHER_HALF_RAD   = (WATCHER_CONE_DEG * 0.5) * Math.PI / 180; // precomputed
