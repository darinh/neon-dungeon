// @ts-check
'use strict';

// Spawn-order id counter for CONDUIT link dedup. Module-scoped so it
// survives across spawnEnemy calls; never reset (overflow is irrelevant
// at JS Number precision for any plausible playthrough).
let _cdEidCounter = 0;

/**
 * src/entities/enemy-spawning.js owns construction, elite rolls, and room registration.
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
    const itemColours=['#ff3366','#3399ff','#33ff99','#ffcc33','#cc66ff','#ff8844'];
    e._mimicColour=itemColours[rndInt(0, itemColours.length - 1, 'spawn')];
  }
  if (type==='WARDEN') { e._chargeState='idle'; e._chargeDx=0; e._chargeDy=0; e._chargeWindup=0; e._chargeDur=0; }
  if (type==='TUNNELLER') {
    // Reuses _wrPhased so existing hit, projectile, and heal checks treat it as intangible.
    e._tnState='tunneling';
    e._tnTimer=1.5+rand('spawn')*0.8;
    e._tnTargetX=x; e._tnTargetY=y;
    e._wrPhased=true;
  }
  if (type==='ECHOER') {
    // Stagger so a clustered spawn does not fire in unison.
    e._ecState='idle';
    e._ecAimTimer=0;
    e._ecCooldown=0.5+rand('spawn')*1.0;
    e._ecLockX=x; e._ecLockY=y;
  }
  if (type==='PROPHET') {
    // Initial lock delay is 0.6–1.6s, versus ECHOER's 0.5–1.5s; both are room-gated.
    e._prState='idle';
    e._prAimTimer=0;
    e._prCooldown=0.6+rand('spawn')*1.0;
    e._prLockX=x; e._prLockY=y;
  }
  if (type==='RESONATOR') {
    // Stagger so a clustered spawn does not telegraph in unison.
    e._rsState='idle';
    e._rsCharge=1.5+rand('spawn')*1.5;
    e._rsTele=0;
    e._rsRec=0;
    e._rsAimDx=0; e._rsAimDy=0;
  }
  if (type==='MIRROR') {
    // Stagger so a clustered spawn does not telegraph in unison.
    e._miState='idle';
    e._miCharge=1.5+rand('spawn')*1.5;
    e._miTele=0;
    e._miRec=0;
    e._miAimDx=0; e._miAimDy=0;
    // Defaults resolved at lock time so the telegraph colour matches the shot that fires.
    e._miShotSpd=MIRROR_PROJ_SPD_DEF;
    e._miShotColour='#88ff44';
  }
  if (type==='REAPER') {
    // Room entry clears _reHasFrenzied for that room's REAPERs. Active _reFrenzied also ignores stun in update().
    e._reState = 'idle';
    e._reTele = 0;
    e._reFrenzy = 0;
    e._reFrenzied = false;
    e._reHasFrenzied = false;
  }
  if (type==='GHOST_PROJECTOR') {
    // Pending, awaiting-flush, and live-ghost states each block a new claim.
    // Stun drops a pending type and delay but leaves queued and active ghosts intact.
    e._gpPendingType  = null;
    e._gpPendingX     = 0;
    e._gpPendingY     = 0;
    e._gpPendingDelay = 0;
    e._gpActiveGhost  = null;
  }
  if (type==='CRYOPHAGE') {
    // Initial lock delay is 0.8–2.0s, versus 0.5–1.5s for ECHOER and 0.6–1.6s for PROPHET.
    e._cyState='idle';
    e._cyAimTimer=0;
    e._cyCooldown=0.8+rand('spawn')*1.2;
    e._cyLockX=x; e._cyLockY=y;
  }
  if (type==='WARDLING') {
    // No spawn-time scan: the room may still be populating. Re-acquire every WARDLING_REWARD_PERIOD.
    e._wlWard = null;
    e._wlReacquireTimer = 0; // forces immediate scan on first update
  }
  if (type==='VENGEANCE') {
    // Charges arrive from notifyVengeance in die(). _vgRushTimer is telegraph then strike; telegraph while it is above VENGEANCE_RUSH_DURATION.
    e._vgState = 'idle';
    e._vgCharges = 0;
    e._vgRushTimer = 0;
  }
  if (type==='CONDUIT') {
    // Lower _cdEid owns the pair link. Stagger the solo timer so a cluster does not fire together.
    e._cdEid = ++_cdEidCounter;
    e._cdSoloTimer = 0.5 + rand('spawn') * 1.5;
    e._cdLinkICD = new Map();
  }
  if (type==='MAGNETON') {
    // Random phase so clustered spawns do not pulse in lock-step.
    e._mgPulse = rand('cosmetic') * TWO_PI;
  }
  if (type==='SPECTRE') {
    // Starts phased so a cluster does not manifest on the same window.
    e._spState = 'phase';
    e._spTimer = SPECTRE_PHASE_DUR * (0.4 + 0.6 * rand('spawn'));
    e.phaseImmune = true;
  }
  if (type==='SAPPER') {
    // Random phase so clustered spawns do not pulse in lock-step.
    e._saPulse = rand('cosmetic') * TWO_PI;
  }
  if (type==='MAGPIE') {
    // Banked credits are paid back via MagpieHoard on death. Stagger the first scan so a cluster does not scan on the same frame.
    e._mgScanT = rand('spawn') * MAGPIE_SCAN_PERIOD;
    e._mgTarget = null;
    e._mgStolenCr = 0;
  }
  if (type==='TETHER') {
    // Random phase so clustered spawns do not pulse in lock-step.
    e._teLashPhase = rand('cosmetic') * TWO_PI;
  }
  if (type==='VAULTMASTER') {
    // Hit throttle so a multi-pellet shot cannot eject a coin per pellet. Pulse phase is visual only.
    e._vmHitICD = 0;
    e._vmPulse  = rand('cosmetic') * TWO_PI;
  }
  if (type==='GULPER') {
    // Random phase so clustered spawns do not pulse in lock-step.
    e._glState = 'chase';
    e._glStacks = 0;
    e._glChargeTimer = 0;
    e._glRecoverTimer = 0;
    // Any finite angle is a valid seed; chase updates lerp it toward taunt-aware _tx/_ty.
    e._glAimAngle = rand('spawn') * TWO_PI;
    e._glPulse = rand('cosmetic') * TWO_PI;
  }
  if (type==='WATCHER') {
    // Randomize the initial sweep angle so clustered spawns scan out of phase. Starts in sweep; render uses this angle until lock.
    e._wState = 'sweep';
    e._wAng = rand('spawn') * Math.PI * 2;
    e._wLockAng = 0;
    e._wTele = 0;
    e._wRec = 0;
    // Render flash requires this and _wRec. Stun-cancel sets _wRec to a full recovery and would otherwise draw a beam that never fired.
    e._wFired = false;
  }
  if (type==='ARCHITECT') {
    // Stagger so a clustered spawn does not telegraph in unison.
    e._aState = 'idle';
    e._aIdle  = ARCHITECT_IDLE_BASE * (0.5 + rand('spawn') * 0.5);
    e._aTele  = 0;
    e._aRec   = 0;
    /** @type {{tx:number, ty:number} | null} */
    e._aTarget = null;
    e._aCommitted = false;
  }
  if (type==='NULLIFIER') {
    // No field object: updateNullifierJam walks live NULLIFIERs and sets player.hackwareJammed. Pulse is visual only.
    e._nlPulse = rand('cosmetic') * TWO_PI;
  }
  if (type==='CONDUCTOR') { e._arcSpin=0; e._dischargeChannel=0; }
  if (type==='GENESIS') { e._spiralSpin=0; e._lanceTelegraph=0; e._lanceLock=null;
    e.bossTimers = { spiral: 1.0, lance: 1.5, hazard: 2.0, purge: 4.0, move: 0.5 }; }
}
