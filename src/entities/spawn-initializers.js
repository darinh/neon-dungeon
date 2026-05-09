// @ts-check
'use strict';

// Spawn-order id counter for CONDUIT link dedup. Module-scoped so it
// survives across spawnEnemy calls; never reset (overflow is irrelevant
// at JS Number precision for any plausible playthrough).
let _cdEidCounter = 0;

/**
 * Initialize per-enemy spawn state after the Enemy instance is constructed.
 * `src/entities.js` still owns construction, room registration, and elite rolls;
 * this module only owns type-specific spawn defaults.
 *
 * @param {any} e
 * @param {string} type
 * @param {number} x
 * @param {number} y
 * @returns {void}
 */
function initializeEnemySpawnState(e, type, x, y) {
  if (type==='PHANTOM') {
    e.visible=false;
    e._phState='cloaked';
    e._phTimer=2+rand('spawn')*2;
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
  if (type==='SCORCHER') { e._scTrailTimer=0.2; e._scStrafeSeed=rnd(0, TWO_PI, 'spawn'); }
  if (type==='LEAPER')   { e._lpState='idle'; e._lpCooldown=1.0+rand('spawn'); e._lpWindup=0; e._lpAirTime=0; e._lpRecovery=0; e._lpTargetX=0; e._lpTargetY=0; e._lpFromX=0; e._lpFromY=0; e._lpHeight=0; }
  if (type==='REFLECTOR'){ e._rfAngle=rand('spawn')*TWO_PI; }
  if (type==='DISRUPTOR'){ e._dDeployTimer=2.0; e._dFireTimer=1.0; e._dFields=[]; }
  if (type==='WRAITH')   { e._wrState='phased'; e._wrTimer=1.5+rand('spawn'); e._wrPhased=true; e._wrFireTimer=0; e._wrHitICD=0; }
  if (type==='NEXUS')    { e._nxLinks=[]; e._nxLinkTimer=0; e._nxFireTimer=1.0; }
  if (type==='SIPHON')   { e._spFireTimer=1.0; e._spFrenzy=false; e._spDrainBeam=null; }
  if (type==='GRAVITON') { e._gvDeployTimer=2.0; e._gvFireTimer=1.5; e._gvWells=[]; }
  if (type==='SEEKER')   { e._skProximity=0; }
  if (type==='PULSER')   { e._plState='idle'; e._plTimer=0; e._plCooldown=0; e._plAimDx=0; e._plAimDy=0; }
  if (type==='MIMIC')    {
    e._disguised=true; e._revealTimer=0; e._mimicBurstTimer=0;
    e._mimicBob=rand('cosmetic')*TWO_PI;
    // Random item colour for disguise
    const itemColours=['#ff3366','#3399ff','#33ff99','#ffcc33','#cc66ff','#ff8844'];
    e._mimicColour=itemColours[rndInt(0, itemColours.length - 1, 'spawn')];
  }
  if (type==='WARDEN') { e._chargeState='idle'; e._chargeDx=0; e._chargeDy=0; e._chargeWindup=0; e._chargeDur=0; }
  if (type==='TUNNELLER') {
    // Spawn already underground — players see only a dust mound until the
    // first surface. Reuses _wrPhased (the canonical "intangible" flag) so
    // every existing hit/projectile/heal check keeps working unchanged.
    e._tnState='tunneling';
    e._tnTimer=1.5+rand('spawn')*0.8;   // initial burrow duration
    e._tnTargetX=x; e._tnTargetY=y;
    e._wrPhased=true;
  }
  if (type==='ECHOER') {
    // Stagger initial aim attempts so a clustered spawn doesn't fire in
    // unison. Cooldown range tuned so first lock is ~0.5–1.5s after spawn.
    e._ecState='idle';
    e._ecAimTimer=0;
    e._ecCooldown=0.5+rand('spawn')*1.0;
    e._ecLockX=x; e._ecLockY=y;
  }
  if (type==='PROPHET') {
    // Stagger initial aim attempts so a clustered spawn doesn't fire in
    // unison. Cooldown range tuned so first lock is ~0.6–1.6s after spawn
    // (slightly slower than ECHOER — telegraph is shorter so we give the
    // player a beat longer to walk into the room before the first shot).
    e._prState='idle';
    e._prAimTimer=0;
    e._prCooldown=0.6+rand('spawn')*1.0;
    e._prLockX=x; e._prLockY=y;
  }
  if (type==='RESONATOR') {
    // Stationary cone battery. Stagger initial charge so a clustered
    // spawn doesn't telegraph in unison. First charge completes ~1.5–3s
    // after spawn (player gets a beat to read the room).
    e._rsState='idle';
    e._rsCharge=1.5+rand('spawn')*1.5;
    e._rsTele=0;
    e._rsRec=0;
    e._rsAimDx=0; e._rsAimDy=0;
  }
  if (type==='MIRROR') {
    // Stationary mimic battery. Stagger initial charge so a clustered
    // spawn doesn't telegraph in unison. First charge completes ~1.5–3s
    // after spawn (matches RESONATOR rhythm).
    e._miState='idle';
    e._miCharge=1.5+rand('spawn')*1.5;
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
    e._cyCooldown=0.8+rand('spawn')*1.2;
    e._cyLockX=x; e._cyLockY=y;
  }
  if (type==='WARDLING') {
    // Bodyguard. _wlWard is resolved on first AI tick (no spawn-time
    // scan — at spawn time the room may still be populating). Re-acquire
    // every WARDLING_REWARD_PERIOD seconds (cheap O(n) scan, n ≤ ~15).
    e._wlWard = null;
    e._wlReacquireTimer = 0; // forces immediate scan on first update
  }
  if (type==='VENGEANCE') {
    // Kill-charged retaliator. Charges accumulate via notifyVengeance
    // (called from die()) so spawn state is just zeroes. _vgRushTimer
    // is the COMBINED telegraph + strike timer, decremented in
    // aiVengeance and used to determine which sub-phase the rush is in
    // (telegraph if > VENGEANCE_RUSH_DURATION, strike otherwise).
    e._vgState = 'idle';
    e._vgCharges = 0;
    e._vgRushTimer = 0;
  }
  if (type==='CONDUIT') {
    // Paired-beam mob. _cdEid is a stable spawn-order id used to
    // deterministically assign link OWNERSHIP for any pair (lower-eid
    // owns). Stagger _cdSoloTimer so a clustered spawn doesn't telegraph
    // its first solo shot in unison.
    e._cdEid = ++_cdEidCounter;
    e._cdSoloTimer = 0.5 + rand('spawn') * 1.5;
    e._cdLinkICD = new Map();
  }
  if (type==='MAGNETON') {
    // Stationary projectile-bender. Only state needed is a cosmetic
    // pulse phase for the field-ring draw — drift it from a random seed
    // so a clustered spawn doesn't pulse in lock-step.
    e._mgPulse = rand('cosmetic') * TWO_PI;
  }
  if (type==='SPECTRE') {
    // Phase/manifest cycler. Start in 'phase' (invulnerable, chasing,
    // harmless). Stagger _spTimer with a random offset so a clustered
    // spawn doesn't manifest in unison — the player should be able to
    // pick off one spectre per manifest window even when grouped.
    e._spState = 'phase';
    e._spTimer = SPECTRE_PHASE_DUR * (0.4 + 0.6 * rand('spawn'));
    e.phaseImmune = true;
  }
  if (type==='SAPPER') {
    // Cosmetic pulse phase for the leech-tendril draw — drift it from
    // a random seed so a clustered spawn doesn't pulse in lock-step.
    e._saPulse = rand('cosmetic') * TWO_PI;
  }
  if (type==='MAGPIE') {
    // Loot-thief state: scan throttle (re-scan items[] every
    // MAGPIE_SCAN_PERIOD seconds), current target Item, and banked
    // credit value (paid back via MagpieHoard pickup on death).
    // Stagger initial scan with a small random offset so a clustered
    // spawn doesn't all scan in lock-step — spreads the work across
    // frames and reads as "independent agents" rather than a swarm.
    e._mgScanT = rand('spawn') * MAGPIE_SCAN_PERIOD;
    e._mgTarget = null;
    e._mgStolenCr = 0;
  }
  if (type==='TETHER') {
    // Cosmetic pulse phase for the leash-coil draw + tether-pulse
    // halo — drift from a random seed so a clustered pack doesn't
    // pulse in lock-step.
    e._teLashPhase = rand('cosmetic') * TWO_PI;
  }
  if (type==='VAULTMASTER') {
    // Per-mob hit-throttle (decremented in update()): rate-limits coin
    // ejection so multi-pellet weapons can't money-print on a single
    // shotgun pull. Also a cosmetic pulse phase for the gold-vault
    // draw — drift from a random seed so clustered spawns don't
    // pulse in lock-step.
    e._vmHitICD = 0;
    e._vmPulse  = rand('cosmetic') * TWO_PI;
  }
  if (type==='GULPER') {
    // Projectile-eating mid-tank. State machine + per-instance
    // tracking for the mouth-cone, stack count, and belch timing.
    // Pulse drifts from a random seed so clustered spawns don't
    // breathe in lock-step.
    e._glState = 'chase';
    e._glStacks = 0;
    e._glChargeTimer = 0;
    e._glRecoverTimer = 0;
    // Initial aim: face origin. update() will smooth-lerp toward
    // player on first frame with LOS, so any starting value works
    // as long as it's a finite number.
    e._glAimAngle = rand('spawn') * TWO_PI;
    e._glPulse = rand('cosmetic') * TWO_PI;
  }
  if (type==='WATCHER') {
    // Stationary sweeping-cone lighthouse. Random initial sweep angle so
    // a clustered spawn doesn't telegraph in unison — players see each
    // watcher independently sweeping at the same rate but with offset
    // phase. _wState starts in 'sweep' so the cone is immediately visible
    // (it's a passive telegraph by design — never hidden).
    e._wState = 'sweep';
    e._wAng = rand('spawn') * Math.PI * 2;
    e._wLockAng = 0;
    e._wTele = 0;
    e._wRec = 0;
    // Beam-flash gate: render-side flash is keyed on this AND _wRec — set
    // true only when a real beam commits in aiWatcher's fire block.
    // Without this gate, the stun-cancel path (which forces _wRec = full
    // WATCHER_RECOVERY) would visually flash a beam that never fired.
    e._wFired = false;
  }
  if (type==='ARCHITECT') {
    // Stationary fortifier mob. Idle timer randomised on spawn so a
    // clustered spawn doesn't telegraph in unison. _aIdle starts in
    // [0.5*BASE, 1.0*BASE] so the first commit happens within ~4-8s of
    // the player entering range — fast enough to be a real threat,
    // slow enough that the player gets a free shot to learn what it does.
    e._aState = 'idle';
    e._aIdle  = ARCHITECT_IDLE_BASE * (0.5 + rand('spawn') * 0.5);
    e._aTele  = 0;
    e._aRec   = 0;
    // Currently targeted tile (during 'target' state). null otherwise.
    /** @type {{tx:number, ty:number} | null} */
    e._aTarget = null;
    // Per-instance commit flag — keeps render branch from showing a
    // commit-flash on a target that was cancelled (LOS lost, occupied,
    // mob died, etc.). Same defensive pattern as WATCHER's _wFired.
    e._aCommitted = false;
  }
  if (type==='NULLIFIER') {
    // Stationary anti-hackware specialist (atk=0, spd=0). The aura is
    // intrinsic to the mob (no separate field object) — updateNullifierJam
    // walks live NULLIFIERs each frame and sets player.hackwareJammed.
    // _nlPulse drifts so clustered spawns don't pulse in lock-step (visual
    // only, no gameplay coupling). Random offset on init.
    e._nlPulse = rand('cosmetic') * TWO_PI;
  }
  if (type==='CONDUCTOR') { e._arcSpin=0; e._dischargeChannel=0; }
  if (type==='GENESIS') { e._spiralSpin=0; e._lanceTelegraph=0; e._lanceLock=null;
    e.bossTimers = { spiral: 1.0, lance: 1.5, hazard: 2.0, purge: 4.0, move: 0.5 }; }
}
