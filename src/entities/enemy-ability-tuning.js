// @ts-check
'use strict';

// These values drive perceived fairness of the predictive shot.
const ECHOER_LOOKBACK   = 1.0;  // seconds back to sample the player's position
const ECHOER_TELEGRAPH  = 0.8;  // ghost+lane visible duration before fire
const ECHOER_COOLDOWN   = 2.5;  // seconds between aim attempts (post-fire)
const ECHOER_RANGE      = 14;   // tiles - max lock distance (echoer->past-pos)
const ECHOER_PROJ_SPD   = 9;    // tiles/sec - slow & dodgeable

// Inverse of ECHOER: extrapolates player velocity and locks the predicted position.
const PROPHET_LOOKAHEAD  = 0.6;  // seconds ahead to extrapolate the player's position
const PROPHET_VEL_SAMPLE = 0.2;  // seconds back to sample for velocity estimate
const PROPHET_TELEGRAPH  = 0.7;  // ghost+lane visible duration before fire
const PROPHET_COOLDOWN   = 2.8;  // seconds between aim attempts (post-fire)
const PROPHET_RANGE      = 13;   // tiles - max lock distance (prophet->predicted)
const PROPHET_PROJ_SPD   = 11;   // tiles/sec - fast (must arrive at the future point on time)
const PROPHET_MIN_VEL    = 1.5;  // tiles/sec - minimum player velocity required to lock
const PROPHET_VEL_CAP    = 10;   // tiles/sec - clamp velocity to avoid dash/teleport blowup

const CRYOPHAGE_TELEGRAPH    = 1.0;   // seconds the cyan + glyph is visible before patches commit
const CRYOPHAGE_COOLDOWN     = 3.5;   // seconds between aim attempts (post-commit)
const CRYOPHAGE_RANGE        = 8;     // tiles - max LoS distance to attempt a lock
const CRYOPHAGE_PATCH_LIFE   = 2.5;   // seconds each frost patch lingers after commit
const CRYOPHAGE_PATCH_RADIUS = 0.6;   // tiles - damage radius from each patch centre
const CRYOPHAGE_TICK_ICD     = 0.5;   // seconds between damage ticks per patch
const CRYOPHAGE_DMG_MUL      = 0.45;  // damage = round(atk * 0.45) per tick

const WARDLING_GUARD_DIST    = 1.0;   // tiles from ward toward perceived target (interception offset)
const WARDLING_REWARD_PERIOD = 0.5;   // seconds between ward re-acquisition scans (perf)
const WARDLING_PANIC_MUL     = 1.4;   // speed multiplier when no ward available

const VENGEANCE_THRESHOLD     = 3;     // qualifying same-room kills required to arm
const VENGEANCE_TELEGRAPH     = 0.8;   // seconds of warning before strike
const VENGEANCE_RUSH_DURATION = 0.6;   // seconds the strike dash lasts
const VENGEANCE_RUSH_SPD      = 9;     // tiles/sec during the rush dash
const VENGEANCE_RANGE         = 10;    // tiles - max LoS distance to commit a rush

const CONDUIT_SOLO_FIRE_CD    = 3.0;   // seconds between solo basic shots
const CONDUIT_SOLO_PROJ_SPD   = 4.5;   // tiles/sec for solo basic shot
const CONDUIT_SOLO_DMG_MUL    = 0.6;   // basic-shot damage multiplier vs atk
const CONDUIT_SOLO_RANGE      = 9;     // tiles - solo engage and projectile range
const CONDUIT_BEAM_W          = 0.4;   // tiles - perpendicular hit threshold
const CONDUIT_BEAM_DMG_MUL    = 0.7;   // beam damage per ICD tick vs atk
const CONDUIT_BEAM_ICD        = 0.5;   // seconds between beam ticks per link

// Order is silent charge, telegraphed cone, instant fire, then recovery.
const RESONATOR_CHARGE     = 2.2;            // silent windup before telegraph
const RESONATOR_TELEGRAPH  = 0.8;            // wedge visible - fairness window
const RESONATOR_RECOVERY   = 1.0;            // post-fire cooldown
const RESONATOR_RANGE      = 6;              // tiles - cone depth
const RESONATOR_CONE_DEG   = 60;             // full cone angular width (degrees)
const RESONATOR_DMG_MUL    = 0.8;
const RESONATOR_HALF_RAD   = (RESONATOR_CONE_DEG * 0.5) * Math.PI / 180;

const WATCHER_SWEEP_RATE = 0.55; // rad/s - base full rotation ~11.4s before tempo modifiers
const WATCHER_CONE_DEG   = 50;
const WATCHER_RANGE      = 9;    // tiles - cone depth and beam reach
const WATCHER_TELEGRAPH  = 0.65; // seconds - fairness window after lock
const WATCHER_RECOVERY   = 1.4;  // seconds - post-fire cooldown
const WATCHER_DMG_MUL    = 1.0;
const WATCHER_HALF_RAD   = (WATCHER_CONE_DEG * 0.5) * Math.PI / 180;

const ARCHITECT_RANGE        = 8;     // tiles - perceived-target lock distance
const ARCHITECT_TARGET_TIME  = 1.5;   // seconds - telegraph window before commit
const ARCHITECT_RECOVERY     = 2.0;   // seconds - post-commit cooldown
const ARCHITECT_IDLE_BASE    = 8.0;   // seconds - idle after recovery before the next attempt
const ARCHITECT_DECAY_TIME   = 12.0;  // seconds - placed wall lifetime

const NULLIFIER_FIELD_R      = 5;     // tiles - aura radius
const NULLIFIER_PULSE_RATE   = 1.8;   // 1/sec - visual phase advance; draw applies angular multipliers

const MIRROR_CHARGE        = 2.5;            // silent windup before telegraph
const MIRROR_TELEGRAPH     = 1.0;            // aim line visible fairness window
const MIRROR_RECOVERY      = 1.5;            // post-fire cooldown
const MIRROR_RANGE         = 12;             // tiles - max engage / aim distance
const MIRROR_DMG_MUL       = 1.0;
const MIRROR_PROJ_SPD_DEF  = 9;              // tile/sec fallback if shotHistory empty
const MIRROR_PROJ_SPD_MIN  = 4;              // clamp player kinematics into a fair band
const MIRROR_PROJ_SPD_MAX  = 14;
const MIRROR_PROJ_RANGE    = 16;             // tiles - projectile lifetime range
const SHOT_HISTORY_LEN     = 4;              // ring cap on player._shotHistory

const REAPER_FRENZY_THRESHOLD = 5;            // kills in current room to arm
const REAPER_TELEGRAPH        = 1.0;          // seconds - red ring on player
const REAPER_FRENZY_DURATION  = 4.0;          // seconds - +60% spd window
const REAPER_FRENZY_SPD_MUL   = 1.6;
const REAPER_DETECT_RANGE     = 14;           // tiles - chase pickup range

const GHOST_PROJECTOR_DELAY      = 3.0;        // seconds - memory to ghost spawn
const GHOST_PROJECTOR_GHOST_LIFE = 6.0;        // seconds - ghost lifetime
const GHOST_PROJECTOR_HP_MUL     = 0.5;
const GHOST_PROJECTOR_ATK_MUL    = 0.5;

const MAGNETON_FIELD_R       = 5.5;   // tiles - radius of magnetic field
const MAGNETON_BEND_STRENGTH = 6.0;   // 1/sec lerp scale, multiplied by proximity outside the dead zone
const MAGNETON_SAFE_R        = 0.15;  // tiles - dead zone around the field center

const SPECTRE_PHASE_DUR      = 1.4;   // seconds - invulnerable chase window
const SPECTRE_MANIFEST_DUR   = 0.7;   // seconds - vulnerable stationary window
const SPECTRE_TELEGRAPH_DUR  = 0.25;  // seconds - solidify ramp
const SPECTRE_CHASE_RANGE    = 12;    // tiles - los/proximity gate before chase
const SPECTRE_MELEE_RANGE    = 1.2;   // tiles - contact damage range during manifest
const SPECTRE_STUN_MANIFEST  = 0.4;   // seconds - short manifest window after stun

const SAPPER_DRAIN_SECS  = 4;     // seconds drained per successful contact hit
const SAPPER_CHASE_RANGE = 11;    // tiles - los/proximity gate before chase
const SAPPER_MELEE_RANGE = 1.2;   // tiles - contact damage range

const TETHER_FIELD_RANGE = 5.0;   // tiles - radius within which slow is applied
const TETHER_MIN_FACTOR  = 0.55;  // most-slow factor at edge of field
const TETHER_CHASE_RANGE = 11;    // tiles - los/proximity gate before chase
const TETHER_MELEE_RANGE = 1.0;   // tiles - body proximity where slow vanishes

const MAGPIE_SCAN_RANGE   = 12;    // tiles - radius for nearest-Item scan
const MAGPIE_SCAN_PERIOD  = 0.4;   // seconds - re-scan delay while tracking; no target scans every frame
const MAGPIE_GRAB_RANGE   = 0.6;   // tiles - item grab distance
const MAGPIE_FLEE_RANGE   = 8;     // tiles - flee trigger radius and target step while carrying
const MAGPIE_STOLEN_BASE  = 15;    // base credit value per stolen item
const MAGPIE_STOLEN_PERFL = 5;     // additional per-floor credit value

const VAULTMASTER_HIT_ICD      = 0.18;  // seconds between coin ejections
const VAULTMASTER_COIN_AMT     = 5;     // credits per ejected coin
const VAULTMASTER_JACKPOT_AMT  = 25;    // credits in the death-drop jackpot
const VAULTMASTER_EJECT_DIST   = 0.7;   // tiles - coin ejection radius from body
const VAULTMASTER_ENGAGE_RANGE = 14;    // tiles - los/proximity gate for chase

const GULPER_MOUTH_RANGE       = 3.5;  // tiles - depth of eat-cone
const GULPER_MOUTH_HALF_ANGLE  = Math.PI * (35 / 180); // 70-degree total arc
const GULPER_MAX_STACKS        = 5;    // stacks required before the belch can charge
const GULPER_FACE_LERP         = 4.0;  // 1/sec interpolation rate for mouth aim
const GULPER_BELCH_TELEGRAPH   = 0.9;  // seconds - telegraph window
const GULPER_BELCH_RECOVERY    = 0.4;  // seconds - post-belch idle
const GULPER_BELCH_SPD         = 5.5;  // tiles/sec - belch projectile speed
const GULPER_BELCH_RANGE       = 12;   // tiles - projectile range
const GULPER_BELCH_DMG_PER_STACK = 4;  // bonus dmg per stack consumed
