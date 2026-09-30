// @ts-check
'use strict';


class Enemy {
  /** @type {any} */ _aCommitted;
  /** @type {any} */ _aIdle;
  /** @type {any} */ _aRec;
  /** @type {any} */ _aState;
  /** @type {any} */ _aTarget;
  /** @type {any} */ _aTele;
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
  /** @type {any} */ _recoilICD;
  /** @type {any} */ _scStrafeSeed;
  /** @type {any} */ _scTrailTimer;
  /** @type {any} */ _shockICD;
  /** @type {any} */ _skProximity;
  /** @type {any} */ _sniperCooldown;
  /** @type {any} */ _spDrainBeam;
  /** @type {any} */ _spFireTimer;
  /** @type {any} */ _spFrenzy;
  /** @type {any} */ _spiralSpin;
  /** @type {any} */ _staggerICD;
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
  /** @type {any} */ _wlWard;
  /** @type {any} */ _wlReacquireTimer;
  /** @type {any} */ _vgState;
  /** @type {any} */ _vgCharges;
  /** @type {any} */ _vgRushTimer;
  /** @type {any} */ _cdEid;
  /** @type {any} */ _cdSoloTimer;
  /** @type {any} */ _cdLinkICD;
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
  /** @type {any} */ _wState;
  /** @type {any} */ _wAng;
  /** @type {any} */ _wLockAng;
  /** @type {any} */ _wTele;
  /** @type {any} */ _wRec;
  /** @type {any} */ _wFired;
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
  /** @type {any} */ _targetKnown;
  /** @type {any} */ _targetLostTimer;
  /** @type {any} */ _lastSeenX;
  /** @type {any} */ _lastSeenY;
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
  /** @type {any} */ _spState;
  /** @type {any} */ _spTimer;
  /** @type {any} */ _saPulse;
  /** @type {any} */ _mgScanT;
  /** @type {any} */ _mgTarget;
  /** @type {any} */ _mgStolenCr;
  /** @type {any} */ _mgPulse;
  /** @type {any} */ _glState;
  /** @type {any} */ _glChargeTimer;
  /** @type {any} */ _glRecoverTimer;
  /** @type {any} */ _glStacks;
  /** @type {any} */ _glAimAngle;
  /** @type {any} */ _glPulse;
  /** @type {any} */ _teLashPhase;
  /** @type {any} */ _vmHitICD;
  /** @type {any} */ _vmPulse;
  /** @type {any} */ _nlPulse;
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
  /** @type {any} */ predatorBuffTimer;
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
  /** @type {any} */ _markedTimer;
  /** @type {any} */ poisonStacks;
  /** @type {any} */ poisonTimer;
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
    this.bobAngle=rand('cosmetic')*TWO_PI;
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
    this.grenadeTimer=0;
    this.eliteAffix=null;
    this.shieldHp=0; this.shieldMax=0; this.shieldRegenDelay=0;
    this.phaseTimer=0; this.phaseImmune=false;
    this.frenzyStacks=0; // FRENZY affix: stacks gained from nearby ally deaths (max 2)
    this.predatorBuffTimer=0; // PREDATOR affix: refresh-only countdown (s) — set by notifyPredatorElites() when player takes real HP damage within 8t
    this.burnTimer=0; this.burnDps=0;
    this.slowTimer=0; this.slowFactor=1;  // 1 = normal speed
    this.stunTimer=0;
    this._markedTimer=0;                  // MARK 'of Marking' affix: while >0, marking weapon hits +30%
    this._lastHitCtx=null;                // weapon context of last hit (for on-kill effects)
    this._tauntTarget=null;
    this._tx=x; this._ty=y;              // perceived target position (hologram, last seen player, or patrol focus)
    this._targetKnown=false;
    this._targetLostTimer=0;
    this._lastSeenX=x; this._lastSeenY=y;
  }

  /**
   * @param {any} [dmg]
   * @param {any} [hitCtx]
   */
  takeDamage(dmg, hitCtx) {
    if (this.dead) return 0;
    // Phase-immune absorbs still apply stun-only effects so shock can force a
    // phased SPECTRE to manifest. Player shots skip _wrPhased before takeDamage
    // (content.js); this branch still covers non-projectile paths.
    if (this.phaseImmune || this._wrPhased) {
      _applyStunOnlyEffects(this, hitCtx);
      const label = this._wrPhased ? 'PHASED' : 'PHASE';
      const colour = this._wrPhased ? '#66ffcc' : '#cc88ff';
      spawnDmgText(this.x, this.y, label, colour);
      return 0;
    }
    if (this.type === 'WRAITH' && this._wrState === 'corporeal') {
      if ((this._wrHitICD || 0) <= 0) {
        this._wrTimer = Math.min(3.0, this._wrTimer + 0.3);
        this._wrHitICD = 0.5;
      }
    }
    if (this.type==='PHANTOM' && (this._phState==='cloaked'||this._phState==='telegraph')) {
      this._phState='cooldown'; this._phTimer=1.5; this.visible=true;
      audio.phantomUncloak();
    }
    // Capture disguise before reveal; shield-gen DR checks wasDisguised.
    const wasDisguised = this._disguised;
    if (this._disguised) this.revealMimic(_EG.player);
    // Mark bonus is applied before shield/NEXUS DR so it follows the same
    // mitigation path as the base hit.
    {
      const _mctx = typeof hitCtx === 'string' ? null : hitCtx;
      if (_mctx && !_mctx.isProc && this._markedTimer > 0
          && _mctx.effects && _mctx.effects.indexOf && _mctx.effects.indexOf('mark') !== -1) {
        dmg = Math.round(dmg * 1.30);
      }
    }
    // Before shield DR. shockTimer is player-only, so it is not an enemy status.
    // Burn/poison DoTs bypass takeDamage, so this perk does not amplify those ticks.
    {
      const _ectx = typeof hitCtx === 'string' ? null : hitCtx;
      const _isProc = !!(_ectx && _ectx.isProc);
      if (!_isProc && _EG.player && _EG.player.perks && _EG.player.perks.EXPLOITER) {
        if ((this.burnTimer && this.burnTimer > 0)
            || (this.slowTimer && this.slowTimer > 0)
            || (this.stunTimer && this.stunTimer > 0)
            || (this._markedTimer && this._markedTimer > 0)
            || (this.poisonTimer && this.poisonTimer > 0)) {
          dmg = Math.round(dmg * 1.25);
        }
      }
    }
    // Before shield DR. Distance is world tiles. Legacy string-context procs are
    // not isProc, so they still get the amp. Turret/orb hits use enemy-to-player
    // distance, not shot origin.
    {
      const _pctx = typeof hitCtx === 'string' ? null : hitCtx;
      const _isProc = !!(_pctx && _pctx.isProc);
      if (!_isProc && _EG.modifier === 'PROXIMITY' && _EG.player) {
        const _pdx = _EG.player.x - this.x;
        const _pdy = _EG.player.y - this.y;
        const _pdist = Math.sqrt(_pdx * _pdx + _pdy * _pdy);
        if (_pdist < 4) {
          dmg = Math.round(dmg * 1.30);
        }
      }
    }
    // Mutates the player's streak, so only fromPlayerShot counts. That flag is set
    // in Player.shoot and cleared when the projectile pool recycles (content.js);
    // turrets, orbs, and flipped enemy shots do not carry it.
    {
      const _hctx = typeof hitCtx === 'string' ? null : hitCtx;
      const _hpc = _EG.player;
      if (_hctx && !_hctx.isProc && _hctx.fromPlayerShot && _hpc && _hpc.perks && _hpc.perks.HOT_HAND) {
        // Clear before reading so the first hit on a new target does not inherit the previous streak.
        if (_hpc._hotHandLastTarget !== this) {
          _hpc._hotHandStreak = 0;
        }
        const stacks = Math.min((_hpc._hotHandStreak || 0), HOT_HAND_MAX_STACKS);
        if (stacks > 0) {
          dmg = Math.round(dmg * (1 + stacks * HOT_HAND_PER_STACK));
        }
        _hpc._hotHandStreak = (_hpc._hotHandStreak || 0) + 1;
        _hpc._hotHandLastTarget = this;
        _hpc._hotHandTimer = HOT_HAND_WINDOW;
      }
    }
    if (this.eliteAffix === 'SHIELDED') this.shieldRegenDelay = 0;
    // Affix-gated: SHIELDER also uses shieldHp, but only for frontal blocks in content.js.
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
    // Skip the first hit that revealed a mimic; it must not get generator DR.
    if (!wasDisguised && isEnemyShieldGenProtected(this)) {
      dmg = Math.max(1, Math.round(dmg * (1 - SHIELD_GEN_DR)));
    }
    if (this._nxBoosted) {
      dmg = Math.max(1, Math.round(dmg * 0.75));
    }
    const actual = Math.min(this.hp, dmg);
    this.hp -= dmg;
    this.flashTimer = 0.1;
    // actual > 0 so glances and absorbs don't reset the clock. Modifier-gated to avoid a hidden-class write on every hit.
    if (actual > 0 && _EG.modifier === 'REGENERATIVE') this._regenTimer = 0;
    spawnDmgText(this.x, this.y, dmg, this.hp <= 0 ? '#ffcc00' : '#ffffff');
    const ctx = typeof hitCtx === 'string' ? { name:hitCtx } : (hitCtx || {});
    this._lastHitCtx = ctx;
    if (!ctx.isProc) applyHitEffects(this, actual, ctx);
    // First mortal blow clamps to 1 HP and opens the endgame dialog; the _unchainedPhase form dies normally.
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
    // ICD so multi-pellet weapons can't print a coin per pellet. The killing blow
    // does not eject; the death jackpot is the only drop then.
    if (this.type === 'VAULTMASTER' && actual > 0 && !this.dead && (this._vmHitICD || 0) <= 0) {
      this._vmHitICD = VAULTMASTER_HIT_ICD;
      const ang = rand('loot') * TWO_PI;
      const ex = this.x + Math.cos(ang) * VAULTMASTER_EJECT_DIST;
      const ey = this.y + Math.sin(ang) * VAULTMASTER_EJECT_DIST;
      items.push(new VaultCoin(ex, ey, VAULTMASTER_COIN_AMT));
      spawnParticles(this.x, this.y, 'SPARK', '#ffcc44', 4);
    }
    return actual;
  }

  die() {
    if (this.dead) return;
    this.dead=true;
    unregisterEnemyFromRoom(this);
    // Before the _despawning return, so a cascade kill still arms a haunt.
    notifyGhostProjectors(this);
    notifyVengeance(this);
    if (this._summons) {
      for (const s of this._summons) {
        if (!s.dead) { s._despawning = true; s.die(); }
      }
    }
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
    // Ghosts count as summons for rewards: no drops, credits, XP, combo, kill count, or REAPER bump.
    const isSummon = !!this._summoned || !!this._ghIsGhost;
    applyOnKill(this);
    NEON.behavior.onKillRefreshMomentum(_EG.player);
    const d=getDiff();
    const dropRate = _EG.modifier === 'FORTIFIED' ? d.itemDrop * 1.3 : d.itemDrop;
    // Guaranteed drop replaces the random roll.
    if (this.type === 'MIMIC') {
      items.push(new Item(this.x, this.y));
    } else if (!this.isShard && !isSummon && rand('loot') < dropRate) {
      items.push(new Item(this.x,this.y));
    }
    // Standing rule: mob drops are temp or currency, never permanent power. Extra drop, not a replacement for the random Item roll.
    if (this.type === 'HARVESTER' && !isSummon && !this.isShard) {
      items.push(new HarvestPickup(this.x, this.y));
    }
    // Returns credits the magpie stole (_mgStolenCr); 0 means nothing extra.
    if (this.type === 'MAGPIE' && !isSummon && !this.isShard) {
      const stolen = this._mgStolenCr || 0;
      if (stolen > 0) {
        items.push(new MagpieHoard(this.x, this.y, stolen));
      }
    }
    // Flat jackpot so milking hits vs killing is a real choice. Auto-collected via the isHoard path in game.js.
    if (this.type === 'VAULTMASTER' && !isSummon && !this.isShard) {
      items.push(new VaultCoin(this.x, this.y, VAULTMASTER_JACKPOT_AMT));
    }
    _EG.player.gainXP(Math.round(this.xpValue*d.xpMul));
    const comboEligible = !this.isShard && !isSummon && !this._volatileKill;
    if (comboEligible) registerKill(this.isBoss);
    const mul = this.isBoss ? comboBossMultiplier() : comboMultiplier();
    _EG.player.score += Math.round(this.xpValue * _EG.floor * mul);
    // Ghosts don't count: the projector summoned them and they expire on their own,
    // so a kill must not break a pacifist run. Summons still count.
    if (_EG.quest && _EG.quest.kills !== undefined && !this._ghIsGhost) _EG.quest.kills++;
    if (!this.isShard && !isSummon) _EG.player.enemiesKilled++;
    // Room-at-death from player position, not player._currentRoom: kills can land
    // before updatePlaying refreshes the cache.
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
    const cr = Math.round(baseCr * (1 + _EG.floor * 0.15) * getMetaCreditMultiplier() * d.creditMul * creditSiphonMul * corrosiveMul * 0.85); // 0.85 = -15% credit drops
    _EG.player.credits += cr;
    // Sub-1 bonus floors to 0 so low-CR mobs don't show "+0 CR". Burn DoT kills
    // still credit if the prior direct hit unmarked isProc.
    const _gctx = this._lastHitCtx;
    if (_gctx && !_gctx.isProc && _gctx.effects && _gctx.effects.includes('greedy')
        && !this.isShard && !isSummon) {
      const bonusCr = Math.round(cr * 0.5);
      if (bonusCr > 0) {
        _EG.player.credits += bonusCr;
        spawnDmgText(this.x, this.y - 0.4, '+' + bonusCr + ' CR', '#ffd700');
        spawnParticles(this.x, this.y, 'MUZZLE', '#ffd700', 4);
      }
    }
    if (this.isBoss) _EG.bossesCleared++;
    if (!isSummon && !this.isShard && typeof NEON !== 'undefined' && NEON.cores && NEON.cores.spawnCoreDrop) {
      let coreVal = 0;
      if (this.isBoss) {
        coreVal = (this.type === 'GENESIS') ? 10 : 5;
      } else if (this.elite) {
        coreVal = rndInt(1, 2, 'loot'); // 1–2 uniform
      }
      if (coreVal > 0) NEON.cores.spawnCoreDrop(game, this.x, this.y, coreVal);
    }
    // Stacks on the elite/boss core drop. The NEON.cores guard keeps this path from crashing node:test.
    const _sctx = this._lastHitCtx;
    if (_sctx && !_sctx.isProc && _sctx.effects && _sctx.effects.includes('salvage')
        && !this.isShard && !isSummon && rand('loot') < 0.10
        && typeof NEON !== 'undefined' && NEON.cores && NEON.cores.spawnCoreDrop) {
      NEON.cores.spawnCoreDrop(game, this.x, this.y, 1);
      spawnParticles(this.x, this.y, 'MUZZLE', '#44ffcc', 4);
    }
    // 8% (under SALVAGE's 10%) because a full Item is worth more than 1 core.
    const _lctx = this._lastHitCtx;
    if (_lctx && !_lctx.isProc && _lctx.effects && _lctx.effects.includes('lucky')
        && !this.isShard && !isSummon && rand('loot') < 0.08) {
      items.push(new Item(this.x, this.y));
      spawnParticles(this.x, this.y, 'MUZZLE', '#ffdd66', 4);
    }
    // Cap at 20 so a long floor can't scale HP without limit. Counter is persisted
    // in saveGame's field list. +1 HP (not just maxHp) so the gain is visible;
    // min() keeps hp <= maxHp.
    const _phctx = this._lastHitCtx;
    if (_phctx && !_phctx.isProc && _phctx.effects && _phctx.effects.includes('pierceheart')
        && !this.isShard && !isSummon) {
      const _php = _EG.player;
      const _phStacks = _php._piercingHearts || 0;
      if (_phStacks < 20) {
        _php._piercingHearts = _phStacks + 1;
        _php.maxHp += 1;
        _php.hp = Math.min(_php.maxHp, _php.hp + 1);
        spawnDmgText(_php.x, _php.y - 0.4, '+1 HP', '#ff4488');
        spawnParticles(this.x, this.y, 'MUZZLE', '#ff4488', 4);
      }
    }
    if (_EG.player.perks.VAMPIRIC && !this.isShard) {
      const heal = 2;
      _EG.player.hp = Math.min(_EG.player.maxHp, _EG.player.hp + heal);
      spawnDmgText(_EG.player.x, _EG.player.y, '+'+heal, '#ff3366');
    }
    if (hasAugment('SCAVENGER_NANITES') && !this.isShard && rand('loot') < 0.10) {
      _EG.player.hp = Math.min(_EG.player.maxHp, _EG.player.hp + 5);
      spawnDmgText(_EG.player.x, _EG.player.y, '+5', '#88ff44');
    }
    // Shards and summons are excluded so one kill or a summoner farm can't mint extra heals.
    if (_EG.modifier === 'CASCADE' && !this.isShard && !isSummon
        && dist(_EG.player.x, _EG.player.y, this.x, this.y) < 4) {
      const _csp = _EG.player;
      if (_csp.hp < _csp.maxHp) {
        _csp.hp = Math.min(_csp.maxHp, _csp.hp + 5);
        spawnDmgText(_csp.x, _csp.y - 0.4, '+5', '#44ff88');
      }
      spawnParticles(this.x, this.y, 'MUZZLE', '#44ff88', 5);
    }
    // Counter is per-run and persisted; it increments only on WINDFALL floors so a later floor doesn't inherit a ready bonus.
    if (_EG.modifier === 'WINDFALL' && !this.isShard && !isSummon) {
      const _wfp = _EG.player;
      _wfp._windfallKills = (_wfp._windfallKills || 0) + 1;
      if (_wfp._windfallKills % 5 === 0
          && typeof NEON !== 'undefined' && NEON.cores && NEON.cores.spawnCoreDrop) {
        NEON.cores.spawnCoreDrop(game, this.x, this.y, 1);
        spawnDmgText(this.x, this.y - 0.4, '+1◆', '#a866ff');
        spawnParticles(this.x, this.y, 'MUZZLE', '#a866ff', 5);
      }
    }
    // Counter ticks even without hackware so the rhythm stays; the reset itself
    // requires hackware, including a pickup at 4/5.
    if (_EG.modifier === 'SIGNAL_BOOST' && !this.isShard && !isSummon) {
      const _sbp = _EG.player;
      _sbp._signalBoostKills = (_sbp._signalBoostKills || 0) + 1;
      if (_sbp._signalBoostKills % 5 === 0 && _sbp.hackware) {
        _sbp.hackwareCooldown = 0;
        spawnDmgText(this.x, this.y - 0.4, '↻ HACKWARE', '#00ddff');
        spawnParticles(this.x, this.y, 'MUZZLE', '#00ddff', 5);
      }
    }
    // room._qmHarvested is saved with the floor snapshot, so Continue does not re-harvest.
    if (_EG.modifier === 'QUARTERMASTER' && !this.isShard && !isSummon
        && this.room && !this.room._qmHarvested) {
      this.room._qmHarvested = true;
      if (typeof NEON !== 'undefined' && NEON.cores && NEON.cores.spawnCoreDrop) {
        NEON.cores.spawnCoreDrop(game, this.x, this.y, 1);
        spawnDmgText(this.x, this.y - 0.4, '+1◆ QM', '#ffaa44');
        spawnParticles(this.x, this.y, 'MUZZLE', '#ffaa44', 5);
      }
    }
    // Window refresh is unconditional; the +15 pays only if the previous window
    // is still up. Siphon/corrosive multipliers are not applied to the flat bonus.
    if (_EG.modifier === 'CHAINREACT' && !this.isShard && !isSummon) {
      const _crp = _EG.player;
      if (_crp._chainBuffTimer > 0) {
        const chainBonus = 15;
        _crp.credits += chainBonus;
        spawnDmgText(this.x, this.y - 0.4, '+' + chainBonus + ' CR', '#ff8866');
        spawnParticles(this.x, this.y, 'MUZZLE', '#ff8866', 4);
      }
      _crp._chainBuffTimer = 1.5;
    }
    if (hasAugment('ADRENALINE_INJECTOR') && !this.isShard) {
      _EG.player.adrenalineTimer = 2;
    }
    if (this._isBounty) {
      const bCr = Math.round((30 + _EG.floor * 8) * creditSiphonMul * corrosiveMul);
      _EG.player.credits += bCr;
      _EG.player.score += 150 * _EG.floor;
      _EG.player.bountiesCollected++;
      items.push(new Item(this.x, this.y));
      audio.bountyKill();
      _EG.msg('BOUNTY ELIMINATED  +' + bCr + ' CR  +' + (150 * _EG.floor) + ' pts', '#ffd700');
      spawnParticles(this.x, this.y, 'EXPLOSION', '#ffd700', 20);
      triggerShake(5, 0.2);
    }
    // One shared blast: both VOLATILE and the perk widen it instead of stacking two explosions.
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
      primeVCoresInRadius(this.x, this.y, vr, _EG.dungeon.map);
      damageCratesInRadius(this.x, this.y, vr, vdmg, _EG.dungeon.map);
      damageBeaconsInRadius(this.x, this.y, vr, vdmg, _EG.dungeon.map);
      damageShieldGensInRadius(this.x, this.y, vr, vdmg, _EG.dungeon.map);
      damageCamerasInRadius(this.x, this.y, vr, vdmg, _EG.dungeon.map);
      damageLasersInRadius(this.x, this.y, vr, vdmg, _EG.dungeon.map);
      damageWallTurretsInRadius(this.x, this.y, vr, vdmg, _EG.dungeon.map);
      triggerMinesInRadius(this.x, this.y, vr, _EG.dungeon.map);
    }
    if (this.type === 'NEXUS' && this._nxLinks) {
      const feedbackDmg = 10 + (_EG.floor || 1) * 2;
      for (const linked of this._nxLinks) {
        if (linked.dead) continue;
        if (!hasLOS(this.x, this.y, linked.x, linked.y, _EG.dungeon.map)) continue;
        linked._nxBoosted = false;
        linked.stunTimer = Math.max(linked.stunTimer || 0, 1.5);
        linked.takeDamage(feedbackDmg, 'Neural Feedback');
      }
      this._nxLinks = [];
      spawnParticles(this.x, this.y, 'EXPLOSION', '#00eedd', 20);
      triggerShake(5, 0.2);
      audio.nexusDeath();
    }
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
    // Queued, not spawned now, so the shards aren't hit in the same frame.
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

    // Ticks through stun so a stun can't extend a haunt. _despawning makes die() skip rewards.
    if (this._ghIsGhost) {
      this._ghLife = (this._ghLife || 0) - dt;
      if (this._ghLife <= 0) {
        this._despawning = true;
        this.die();
        return;
      }
    }

    // Not omniscient: acquire by line of sight, chase the last seen point, then
    // forget. Taunts and bosses keep their own rules.
    this._tx = this.patrolTarget ? this.patrolTarget.x : this.x;
    this._ty = this.patrolTarget ? this.patrolTarget.y : this.y;
    const _t = this._tauntTarget;
    const tauntActive = !!(_t && _t.age < _t.maxAge);
    let liveTargetX = player.x, liveTargetY = player.y;
    if (tauntActive) { liveTargetX = _t.x; liveTargetY = _t.y; }
    else if (_t) { this._tauntTarget = null; }
    const targetLeashed = this._isLeashedFromRoom();
    const liveTargetable = tauntActive || canTargetPlayer();
    const liveTargetDist = dist(this.x, this.y, liveTargetX, liveTargetY);
    const canAcquireTarget = !targetLeashed || liveTargetDist <= ENEMY_LEASH_DEFEND_RANGE;
    const targetVisible = liveTargetable && canAcquireTarget && liveTargetDist < ENEMY_SIGHT_RANGE &&
      hasLOS(this.x, this.y, liveTargetX, liveTargetY, map);
    const targetForced = tauntActive || (this.isBoss && canTargetPlayer());
    if (targetForced || targetVisible) {
      this._targetKnown = true;
      this._targetLostTimer = 0;
      this._lastSeenX = liveTargetX;
      this._lastSeenY = liveTargetY;
    } else if (this._targetKnown) {
      this._targetLostTimer += dt;
      if (this._targetLostTimer >= ENEMY_TARGET_MEMORY_SECONDS || targetLeashed) {
        this._forgetTarget();
      }
    }
    if (this._targetKnown) {
      this._tx = this._lastSeenX;
      this._ty = this._lastSeenY;
    }

    // REAPER frenzy ignores stun for the window: out-position, don't stun-defuse. Dropped before the generic stun block.
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
      // Defuse before commit so queued patches never fire after stun.
      if (this._cyState === 'aiming') { this._cyState = 'idle'; this._cyAimTimer = 0; this._cyTiles = null; this._cyCooldown = 0.8; }
      // Interrupt the swing but keep _vgCharges; the grudge is not erased.
      if (this._vgState === 'rush') { this._vgState = 'idle'; this._vgRushTimer = 0; }
      // Full defuse, including chase-state stacks: a primed gulper must not keep its mouthful through stun.
      if (this.type === 'GULPER') {
        this._glState = 'chase';
        this._glChargeTimer = 0;
        this._glRecoverTimer = 0;
        this._glStacks = 0;
      }
      // Clear beam ICDs so a stale timer can't damage on the resume frame.
      if (this.type === 'CONDUIT' && this._cdLinkICD) this._cdLinkICD.clear();
      // Cancel resonator telegraph on stun — drop straight to recovery so the
      // wedge doesn't fire after stun ends and the player can punish the stun.
      if (this._rsState === 'telegraph') { this._rsState = 'recovery'; this._rsRec = RESONATOR_RECOVERY; this._rsTele = 0; }
      // Cancel mirror telegraph on stun — drop straight to recovery so the
      // shot doesn't fire after stun ends and the player can punish the stun.
      if (this._miState === 'telegraph') { this._miState = 'recovery'; this._miRec = MIRROR_RECOVERY; this._miTele = 0; }
      // Drop to recovery and clear _wFired so render doesn't flash a beam that never fired.
      if (this._wState === 'telegraph') { this._wState = 'recovery'; this._wRec = WATCHER_RECOVERY; this._wTele = 0; this._wFired = false; }
      // Clear _aCommitted so a stun-cancel doesn't flash a wall that was never placed.
      if (this.type === 'ARCHITECT' && this._aState === 'target') {
        this._aState = 'recovery';
        this._aRec = ARCHITECT_RECOVERY;
        this._aTele = 0;
        this._aTarget = null;
        this._aCommitted = false;
      }
      // Return to idle. Leave _reHasFrenzied set; re-arm only on room change.
      if (this._reState === 'telegraph') { this._reState = 'idle'; this._reTele = 0; }
      // Drop a pending haunt, but do not clear _gpAwaitingFlush: a queued spawn is already committed.
      if (this.type === 'GHOST_PROJECTOR' && this._gpPendingType) {
        this._gpPendingType = null;
        this._gpPendingDelay = 0;
      }
      // Force manifest: otherwise stun would freeze an invulnerable chaser. Short window so it isn't vulnerable for a full natural manifest.
      if (this.type === 'SPECTRE' && this._spState === 'phase') {
        this._spState = 'manifest';
        this._spTimer = SPECTRE_STUN_MANIFEST;
        this.phaseImmune = false;
      }
      if (this._lanceTelegraph > 0) { this._lanceTelegraph = 0; this._lanceLock = null; }
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
      if (this._spDrainBeam) { this._spDrainBeam.t -= dt; if (this._spDrainBeam.t <= 0) this._spDrainBeam = null; }
      if (rand('cosmetic') < dt * 6) spawnParticles(this.x, this.y, 'SPARK', '#00ddff', 1);
      // LEAPER airborne/recovery must complete even while stunned (can't freeze mid-air)
      if (this._lpState === 'airborne' || this._lpState === 'recovery') {
        this.aiLeaper(dt, player, map, 0, false);
      }
      return; // skip all AI, leave attack/shoot timers frozen
    }

    this.attackTimer=Math.max(0,this.attackTimer-dt);
    this.shootTimer =Math.max(0,this.shootTimer-dt);
    this.spawnCooldown=Math.max(0,this.spawnCooldown-dt);
    if (this._vmHitICD) this._vmHitICD = Math.max(0, this._vmHitICD - dt);

    // After the stun return so stun freezes regen. Bosses, elites, summons, shards,
    // disguised mimics, phased wraiths, and ghosts are excluded (phase thresholds,
    // no visual leak, no permanent escort).
    if (_EG.modifier === 'REGENERATIVE'
        && !this.isBoss && !this.elite && !this._summoned && !this.isShard
        && !this._disguised && !this._wrPhased && !this._ghIsGhost) {
      this._regenTimer = (this._regenTimer || 0) + dt;
      if (this._regenTimer >= 2.5 && this.hp < this.maxHp) {
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.08 * dt);
      }
    }

    const d = dist(this.x,this.y,this._tx,this._ty);
    const los = !!targetVisible;

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
      case 'WARDLING': this.aiWardling(dt,player,map,d,los); break;
      case 'VENGEANCE':this.aiVengeance(dt,player,map,d,los); break;
      case 'CONDUIT':this.aiConduit(dt,player,map,d,los); break;
      case 'HARVESTER':this.aiHarvester(dt,player,map,d,los); break;
      case 'MAGNETON':this.aiMagneton(dt,player,map,d,los); break;
      case 'SPECTRE':this.aiSpectre(dt,player,map,d,los); break;
      case 'SAPPER':this.aiSapper(dt,player,map,d,los); break;
      case 'MAGPIE':this.aiMagpie(dt,player,map,d,los); break;
      case 'TETHER':this.aiTether(dt,player,map,d,los); break;
      case 'VAULTMASTER':this.aiVaultmaster(dt,player,map,d,los); break;
      case 'GULPER':this.aiGulper(dt,player,map,d,los); break;
      case 'WATCHER':this.aiWatcher(dt,player,map,d,los); break;
      case 'ARCHITECT':this.aiArchitect(dt,player,map,d,los); break;
      case 'NULLIFIER':this.aiNullifier(dt,player,map,d,los); break;
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
      if (dealt > 0 && this.type === 'CRAWLER') {
        const wasBurning = player.burnTimer > 0;
        const bioMul = hasAugment('BIOFILTER') ? 0.5 : 1;
        player.burnTimer = Math.max(player.burnTimer, 2 * bioMul);
        player.burnDps = Math.max(player.burnDps, (2 + _EG.floor * 0.3) * bioMul);
        if (!wasBurning) audio.playerBurn();
      }
      // dealt > 0 so a parry or shield absorb does not drain a boost.
      if (dealt > 0 && this.type === 'SAPPER') {
        if (NEON.boosts && NEON.boosts.drainTimedBoost) {
          const drained = NEON.boosts.drainTimedBoost(player, SAPPER_DRAIN_SECS, () => rand('combat'));
          if (drained) {
            spawnDmgText(player.x, player.y, '-' + SAPPER_DRAIN_SECS + 's', '#ddff44');
          }
        }
      }
    }
  }


  /**
   * @param {any} [camX]
   * @param {any} [camY]
   */
  draw(camX,camY) {
    if (this.dead) return;
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
      const shimCycle = ((_EG.floorTime || 0) * 0.4) % 1;
      if (shimCycle > 0.92) {
        ctx.globalAlpha = 0.3 + 0.4 * Math.sin(shimCycle * 80);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx - 6, sy - 6 + bobY, 12, 12);
      }
      ctx.restore();
      return;
    }

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
    if (this.type==='SPECTRE') {
      if (this._spState === 'phase') {
        const teleTime = SPECTRE_TELEGRAPH_DUR;
        if (this._spTimer > 0 && this._spTimer < teleTime) {
          const t = 1 - (this._spTimer / teleTime);
          alpha = 0.28 + 0.57 * t;
        } else {
          alpha = 0.18 + 0.10 * Math.sin(this.bobAngle * 4);
        }
      } else {
        alpha = 1.0;
      }
    }
    // Translucent so a ghost reads as not-real; multiplies any per-type alpha.
    if (this._ghIsGhost) alpha *= 0.55;

    if (this.type === 'TUNNELLER' && (this._tnState === 'tunneling' || this._tnState === 'surfacing')) {
      ctx.save();
      const dustCol = '#cc8844';
      ctx.shadowColor = dustCol;
      if (this._tnState === 'tunneling') {
        const wob = Math.sin(this.bobAngle * 3) * 1.5;
        ctx.globalAlpha = 0.55;
        ctx.shadowBlur = 8;
        ctx.fillStyle = dustCol;
        NEON.draw.circle(ctx, sx, sy + 2 + wob, 5);
        ctx.globalAlpha = 0.25;
        NEON.draw.circle(ctx, sx, sy + 2 + wob, 9);
      } else {
        const prog = 1 - this._tnTimer / 1.0; // 0 → 1
        const shakeX = (rand('cosmetic') - 0.5) * 2 * prog;
        const shakeY = (rand('cosmetic') - 0.5) * 2 * prog;
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

    const col=this.flashTimer>0?(_EG._damageFlash||'#ffffff'):this.colour;
    const elitePulse = this.elite ? 12 + Math.sin(this.bobAngle * 2) * 8 : 0;
    ctx.shadowBlur=this.isBoss?20: this.elite ? 10 + elitePulse : 10;
    const eliteGlow = this.eliteAffix ? ELITE_AFFIXES[this.eliteAffix].colour : col;
    ctx.shadowColor= this.elite ? eliteGlow : col;
    ctx.fillStyle=col;

    if (this.isBoss) {
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
          ctx.globalAlpha = fade * 0.7;
          ctx.strokeStyle = '#ff00c8';
          ctx.lineWidth = 2;
          NEON.draw.circleStroke(ctx, ox, oy, r);
          ctx.restore();
        }
      }

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

      if (this.type === 'CONDUCTOR') {
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

      if (this.type === 'GENESIS') {
        const ringColour  = this._unchainedPhase ? '#88ccff' : '#ffcc00';
        const lanceColour = this._unchainedPhase ? '#cceeff' : '#ffe066';
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
      if (t === 'CHARGER') {
        const sz = TILE * 0.45;
        const fdx = (this._tx || this.x) - this.x, fdy = (this._ty || this.y) - this.y;
        const angle = (fdx || fdy) ? Math.atan2(fdy, fdx) : 0;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(angle);
        ctx.beginPath(); ctx.moveTo(sz * 0.6, 0); ctx.lineTo(-sz * 0.4, -sz * 0.4); ctx.lineTo(-sz * 0.4, sz * 0.4); ctx.closePath(); ctx.fill();
        ctx.restore();
      } else if (t === 'PHANTOM' || t === 'WRAITH') {
        const sz = TILE * 0.35;
        ctx.save(); ctx.globalAlpha = (ctx.globalAlpha || 1) * 0.65;
        ctx.translate(sx, sy); ctx.rotate(Math.PI / 4);
        ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
        ctx.restore();
      } else if (t === 'GRENADIER' || t === 'PULSER') {
        const r = TILE * 0.2;
        NEON.draw.circle(ctx, sx, sy, r);
      } else if (t === 'SCORCHER') {
        const sz = TILE * 0.32;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(Math.PI / 4 + Math.sin(this.bobAngle * 3) * 0.12);
        ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
        ctx.restore();
      } else if (t === 'BRUTE') {
        const w = TILE * 0.52, h = TILE * 0.46;
        ctx.fillRect(sx - w / 2, sy - h / 2, w, h);
      } else if (t === 'SNIPER') {
        const w = TILE * 0.18, h = TILE * 0.5;
        ctx.fillRect(sx - w / 2, sy - h / 2, w, h);
      } else if (t === 'SUMMONER' || t === 'HEALER' || t === 'NEXUS') {
        const r = TILE * 0.22;
        NEON.draw.circle(ctx, sx, sy, r);
        ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.4;
        NEON.draw.circleStroke(ctx, sx, sy, r * 1.6);
        ctx.restore();
      } else if (t === 'LEAPER') {
        const lpScale = this._lpState === 'windup' ? 1.0 + 0.3 * Math.sin(this.bobAngle * 8) : (this._lpState === 'airborne' ? 1.4 : 0.8);
        const r = TILE * 0.2 * lpScale;
        NEON.draw.circle(ctx, sx, sy, r);
      } else if (t === 'CRAWLER') {
        const w = TILE * 0.48, h = TILE * 0.24;
        ctx.fillRect(sx - w / 2, sy - h / 2, w, h);
      } else if (t === 'TURRET') {
        const base = TILE * 0.42;
        const barrelLen = TILE * 0.32;
        const barrelW = TILE * 0.1;
        const aimPlayer = _EG.player || this;
        const aimDx = aimPlayer.x - this.x;
        const aimDy = aimPlayer.y - this.y;
        const aim = (aimDx || aimDy) ? Math.atan2(aimDy, aimDx) : 0;
        ctx.fillRect(sx - base / 2, sy - base / 2, base, base);
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(aim);
        ctx.fillRect(0, -barrelW / 2, barrelLen, barrelW);
        ctx.restore();
        ctx.save();
        ctx.fillStyle = '#ff3344';
        NEON.draw.circle(ctx, sx, sy, TILE * 0.11);
        ctx.restore();
      } else if (t === 'DRONE' || t === 'SEEKER') {
        const sz = TILE * 0.28;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(Math.PI / 4);
        ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
        ctx.restore();
      } else if (t === 'HARVESTER') {
        const w = TILE * 0.36, h = TILE * 0.32;
        ctx.fillRect(sx - w / 2, sy - h / 2, w, h);
        const spikePulse = 0.85 + 0.15 * Math.sin(this.bobAngle * 5);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(sx, sy - h / 2 - TILE * 0.18 * spikePulse);
        ctx.lineTo(sx - TILE * 0.08, sy - h / 2);
        ctx.lineTo(sx + TILE * 0.08, sy - h / 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (t === 'SPECTRE') {
        const coreR = TILE * 0.16;
        const haloR = TILE * 0.30;
        ctx.save();
        const haloPulse = 0.78 + 0.22 * Math.sin(this.bobAngle * 3);
        ctx.globalAlpha = (ctx.globalAlpha || 1) * 0.55 * haloPulse;
        NEON.draw.circle(ctx, sx, sy, haloR);
        ctx.restore();
        NEON.draw.circle(ctx, sx, sy, coreR);
      } else if (t === 'MAGPIE') {
        const bodyR = TILE * 0.22;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-bodyR, -bodyR, bodyR * 2, bodyR * 2);
        ctx.restore();
        if ((this._mgStolenCr || 0) > 0) {
          ctx.save();
          ctx.fillStyle = '#ffd700';
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#ffd700';
          const pip = TILE * 0.10;
          ctx.fillRect(sx - pip / 2, sy - pip / 2, pip, pip);
          ctx.restore();
        }
      } else if (t === 'TETHER') {
        const bodyR = TILE * 0.22;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(sx - bodyR, sy + bodyR * 0.7);
        ctx.lineTo(sx + bodyR, sy + bodyR * 0.7);
        ctx.lineTo(sx + bodyR * 0.65, sy - bodyR * 0.7);
        ctx.lineTo(sx - bodyR * 0.65, sy - bodyR * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.save();
        const lashPulse = 0.55 + 0.30 * Math.sin((this._teLashPhase || 0) + this.bobAngle * 2);
        ctx.globalAlpha = (ctx.globalAlpha || 1) * lashPulse;
        ctx.strokeStyle = '#ff8866';
        ctx.lineWidth = 1.2;
        const stakeLen = TILE * 0.10;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TWO_PI + Math.PI / 4;
          const sx0 = sx + Math.cos(a) * bodyR * 0.85;
          const sy0 = sy + Math.sin(a) * bodyR * 0.85;
          const ex = sx + Math.cos(a) * (bodyR + stakeLen);
          const ey = sy + Math.sin(a) * (bodyR + stakeLen);
          NEON.draw.line(ctx, sx0, sy0, ex, ey);
        }
        ctx.restore();
      } else if (t === 'VAULTMASTER') {
        const bodyR = TILE * 0.24;
        ctx.save();
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TWO_PI + Math.PI / 6;
          const px = sx + Math.cos(a) * bodyR;
          const py = sy + Math.sin(a) * bodyR;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.save();
        const slotPulse = 0.65 + 0.35 * Math.sin((this._vmPulse || 0) + this.bobAngle * 3);
        ctx.globalAlpha = (ctx.globalAlpha || 1) * slotPulse;
        ctx.fillStyle = '#ffe680';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ffe680';
        const slotW = bodyR * 1.1, slotH = TILE * 0.06;
        ctx.fillRect(sx - slotW / 2, sy - slotH / 2, slotW, slotH);
        ctx.restore();
      } else if (t === 'SAPPER') {
        const bodyR = TILE * 0.20;
        const tendrilLen = TILE * (0.18 + 0.06 * Math.sin((this._saPulse || 0) + this.bobAngle * 2));
        const ang = this.bobAngle * 1.5;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(ang) * bodyR, sy + Math.sin(ang) * bodyR);
        ctx.lineTo(sx + Math.cos(ang + 2.4) * bodyR, sy + Math.sin(ang + 2.4) * bodyR);
        ctx.lineTo(sx + Math.cos(ang - 2.4) * bodyR, sy + Math.sin(ang - 2.4) * bodyR);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = (ctx.globalAlpha || 1) * 0.55;
        ctx.strokeStyle = '#ddff44';
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TWO_PI + (this._saPulse || 0) * 0.5;
          const ex = sx + Math.cos(a) * (bodyR + tendrilLen);
          const ey = sy + Math.sin(a) * (bodyR + tendrilLen);
          NEON.draw.line(ctx, sx + Math.cos(a) * bodyR, sy + Math.sin(a) * bodyR, ex, ey);
        }
        ctx.restore();
      } else {
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
      // Breakable (blocksProjectile). Down (shieldHp <= 0) doesn't render; 3..5s after break blinks back, full at 5s.
      if (this.type === 'SHIELDER') {
        let shieldAlpha = 0;
        if (this.shieldHp > 0) {
          shieldAlpha = 0.7 + Math.sin(this.bobAngle * 2) * 0.15;
        } else if (this.shieldBrokenTimer >= 3 && this.shieldBrokenTimer < 5) {
          // Ramp plus a strobe so the reforming shield is visible.
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
      if (this.type === 'REFLECTOR') {
        ctx.save();
        const rR = sz * 1.3;
        const pulse = 0.7 + Math.sin(this.bobAngle * 3) * 0.2;
        ctx.strokeStyle = '#88ddff';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#88ddff';
        ctx.globalAlpha = pulse;
        NEON.draw.arcStroke(ctx, sx, sy, rR, this._rfAngle - Math.PI / 4, this._rfAngle + Math.PI / 4);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#ffffff';
        NEON.draw.arcStroke(ctx, sx, sy, rR - 2, this._rfAngle - Math.PI / 4, this._rfAngle + Math.PI / 4);
        for (let i = -2; i <= 2; i++) {
          const a = this._rfAngle + (i / 4) * (Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(sx + Math.cos(a) * (rR - 1), sy + Math.sin(a) * (rR - 1));
          ctx.lineTo(sx + Math.cos(a) * (rR + 3), sy + Math.sin(a) * (rR + 3));
          ctx.stroke();
        }
        ctx.restore();
      }
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
      if (this.type === 'NEXUS') {
        ctx.save();
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
            ctx.globalAlpha = 0.15;
            ctx.fillStyle = '#00eedd';
            NEON.draw.circle(ctx, lx, ly, sz * 0.8);
          }
        }
        ctx.restore();
      }
      if (this.type === 'SIPHON') {
        ctx.save();
        const frenzy = this._spFrenzy;
        const pulseRate = frenzy ? 5.0 : 2.0;
        const baseAlpha = frenzy ? 0.3 : 0.15;
        const auraAlpha = baseAlpha + 0.1 * Math.sin(this.bobAngle * pulseRate);
        ctx.globalAlpha = auraAlpha;
        ctx.fillStyle = '#dd2244';
        ctx.shadowBlur = frenzy ? 18 : 10;
        ctx.shadowColor = '#dd2244';
        const auraR = sz * (frenzy ? 1.6 : 1.3) + Math.sin(this.bobAngle * pulseRate) * 2;
        NEON.draw.circle(ctx, sx, sy, auraR);
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
      if (this.type === 'GRAVITON') {
        ctx.save();
        const gvPulse = 0.15 + 0.1 * Math.sin(this.bobAngle * 2);
        ctx.globalAlpha = gvPulse;
        ctx.fillStyle = '#8833ff';
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#8833ff';
        const auraR = sz * 1.4 + Math.sin(this.bobAngle * 3) * 2;
        NEON.draw.circle(ctx, sx, sy, auraR);
        ctx.globalAlpha = 0.5 + 0.2 * Math.sin(this.bobAngle * 4);
        ctx.fillStyle = '#cc88ff';
        for (let p = 0; p < 3; p++) {
          const a = this.bobAngle * 2 + p * (TWO_PI / 3);
          const orbR = sz * 1.1;
          NEON.draw.circle(ctx, sx + Math.cos(a) * orbR, sy + Math.sin(a) * orbR, 2);
        }
        ctx.globalAlpha = gvPulse * 1.5;
        ctx.strokeStyle = '#cc88ff';
        ctx.lineWidth = 1;
        ctx.shadowBlur = 4;
        NEON.draw.circleStroke(ctx, sx, sy, 3);
        ctx.restore();
      }
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
      if (this.type === 'SNIPER') {
        if (this._laserTimer > 0 && this._laserTarget) {
          const progress = 1 - this._laserTimer / 1.5;
          const lx = this._laserTarget.x * TILE - camX;
          const ly = this._laserTarget.y * TILE - camY;
          ctx.save();
          const pulse = 0.5 + 0.5 * Math.sin(progress * 20);
          ctx.globalAlpha = (0.15 + progress * 0.5) * pulse;
          ctx.strokeStyle = '#ff2266';
          ctx.shadowBlur = 6 + progress * 10;
          ctx.shadowColor = '#ff2266';
          ctx.lineWidth = 1 + progress * 1.5;
          ctx.setLineDash([4, 6 - progress * 4]);
          NEON.draw.line(ctx, sx, sy, lx, ly);
          ctx.globalAlpha = 0.3 + progress * 0.5;
          ctx.setLineDash([]);
          ctx.fillStyle = '#ff2266';
          NEON.draw.circle(ctx, lx, ly, 3 + progress * 2);
          ctx.restore();
        } else {
          ctx.save();
          ctx.globalAlpha = 0.25 + Math.sin(this.bobAngle * 3) * 0.1;
          ctx.fillStyle = '#ff2266';
          ctx.shadowBlur = 6;
          ctx.shadowColor = '#ff2266';
          NEON.draw.circle(ctx, sx, sy - sz * 0.6, 1.5);
          ctx.restore();
        }
      }
      if (this.type === 'PULSER') {
        if (this._plState === 'charging') {
          const progress = 1 - this._plTimer / 1.0;
          ctx.save();
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
          const aimLen = 3 * TILE * progress;
          ctx.globalAlpha = (0.2 + progress * 0.5) * pulse;
          ctx.lineWidth = 1 + progress;
          ctx.setLineDash([3, 5 - progress * 3]);
          NEON.draw.line(ctx, sx, sy, sx + this._plAimDx * aimLen, sy + this._plAimDy * aimLen);
          ctx.setLineDash([]);
          ctx.restore();
        } else {
          ctx.save();
          ctx.globalAlpha = 0.15 + Math.sin(this.bobAngle * 3) * 0.08;
          ctx.fillStyle = '#44ddff';
          ctx.shadowBlur = 6;
          ctx.shadowColor = '#44ddff';
          NEON.draw.circle(ctx, sx, sy, sz * 0.4);
          ctx.restore();
        }
      }
      if (this.type === 'ECHOER') {
        ctx.save();
        if (this._ecState === 'aiming' && this._ecAimTimer > 0) {
          const total = 0.8; // ECHOER_TELEGRAPH — kept inline (host has TILE etc.)
          const progress = 1 - Math.max(0, Math.min(1, this._ecAimTimer / total));
          const lx = this._ecLockX * TILE - camX;
          const ly = this._ecLockY * TILE - camY;
          const pulse = 0.5 + 0.5 * Math.sin(progress * 18);
          ctx.globalAlpha = (0.18 + progress * 0.5) * pulse;
          ctx.strokeStyle = '#aa66ff';
          ctx.shadowBlur = 6 + progress * 10;
          ctx.shadowColor = '#aa66ff';
          ctx.lineWidth = 1 + progress * 1.5;
          ctx.setLineDash([4, 6 - progress * 4]);
          NEON.draw.line(ctx, sx, sy, lx, ly);
          ctx.setLineDash([]);
          ctx.globalAlpha = 0.22 + progress * 0.4;
          ctx.fillStyle = '#aa66ff';
          NEON.draw.circle(ctx, lx, ly, TILE * 0.32);
          ctx.globalAlpha = 0.35 + progress * 0.45;
          ctx.strokeStyle = '#ddaaff';
          ctx.lineWidth = 1.2 + progress * 0.8;
          NEON.draw.circleStroke(ctx, lx, ly, TILE * 0.42 + progress * 2);
        } else {
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
      if (this.type === 'PROPHET') {
        ctx.save();
        if (this._prState === 'aiming' && this._prAimTimer > 0) {
          const total = 0.7; // PROPHET_TELEGRAPH — kept inline (host has TILE etc.)
          const progress = 1 - Math.max(0, Math.min(1, this._prAimTimer / total));
          const lx = this._prLockX * TILE - camX;
          const ly = this._prLockY * TILE - camY;
          const pulse = 0.5 + 0.5 * Math.sin(progress * 18);
          ctx.globalAlpha = (0.18 + progress * 0.5) * pulse;
          ctx.strokeStyle = '#ffaa22';
          ctx.shadowBlur = 6 + progress * 10;
          ctx.shadowColor = '#ffaa22';
          ctx.lineWidth = 1 + progress * 1.5;
          ctx.setLineDash([4, 6 - progress * 4]);
          NEON.draw.line(ctx, sx, sy, lx, ly);
          ctx.setLineDash([]);
          ctx.globalAlpha = 0.22 + progress * 0.4;
          ctx.fillStyle = '#ffaa22';
          NEON.draw.circle(ctx, lx, ly, TILE * 0.32);
          ctx.globalAlpha = 0.35 + progress * 0.45;
          ctx.strokeStyle = '#ffd680';
          ctx.lineWidth = 1.2 + progress * 0.8;
          NEON.draw.circleStroke(ctx, lx, ly, TILE * 0.42 + progress * 2);
        } else {
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
      // Lattice matches aiCryophage's commit (centre + 4 cardinals) so the warning is the spawn.
      if (this.type === 'CRYOPHAGE') {
        ctx.save();
        if (this._cyState === 'aiming' && this._cyAimTimer > 0) {
          const progress = 1 - Math.max(0, Math.min(1, this._cyAimTimer / CRYOPHAGE_TELEGRAPH));
          // Same pre-filtered list the commit uses, so a wall tile never shows a warning with no patch.
          const tiles = /** @type {{x:number,y:number}[]} */ (this._cyTiles || []);
          const cx = this._cyLockX, cy = this._cyLockY;
          const pulse = 0.5 + 0.5 * Math.sin(progress * 18);
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
          ctx.globalAlpha = 0.25 + progress * 0.4;
          ctx.strokeStyle = '#88ddff';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 5]);
          NEON.draw.line(ctx, sx, sy, cx * TILE - camX, cy * TILE - camY);
          ctx.setLineDash([]);
        } else {
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
      if (this.type === 'WARDLING') {
        const ward = this._wlWard;
        if (ward && !ward.dead) {
          ctx.save();
          const pulse = 0.5 + 0.5 * Math.sin(this.bobAngle * 2);
          ctx.globalAlpha = 0.25 + 0.15 * pulse;
          ctx.strokeStyle = '#ffcc66';
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#ffcc66';
          ctx.lineWidth = 1.2;
          NEON.draw.circleStroke(ctx, sx, sy, sz * (1.05 + pulse * 0.25));
          const wx = ward.x * TILE - camX;
          const wy = ward.y * TILE - camY;
          ctx.globalAlpha = 0.35 + 0.20 * pulse;
          ctx.strokeStyle = '#ffcc66';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          NEON.draw.line(ctx, sx, sy, wx, wy);
          ctx.setLineDash([]);
          ctx.restore();
        }
      }
      if (this.type === 'VENGEANCE') {
        ctx.save();
        const charges = this._vgCharges || 0;
        if (this._vgState !== 'rush' && charges > 0) {
          const pips = Math.min(charges, VENGEANCE_THRESHOLD);
          const pulse = 0.5 + 0.5 * Math.sin(this.bobAngle * 3);
          ctx.shadowBlur = 6 + pulse * 4;
          ctx.shadowColor = '#cc1166';
          for (let i = 0; i < pips; i++) {
            const a = -Math.PI / 2 + (i / VENGEANCE_THRESHOLD) * Math.PI * 2;
            const px = sx + Math.cos(a) * (sz * 1.2);
            const py = sy + Math.sin(a) * (sz * 1.2);
            ctx.globalAlpha = 0.7 + pulse * 0.3;
            ctx.fillStyle = '#ff3388';
            NEON.draw.circle(ctx, px, py, 2.5);
          }
        }
        if (this._vgState === 'rush') {
          const inStrike = this._vgRushTimer <= VENGEANCE_RUSH_DURATION;
          if (!inStrike) {
            const teleRem = this._vgRushTimer - VENGEANCE_RUSH_DURATION;
            const progress = 1 - Math.max(0, Math.min(1, teleRem / VENGEANCE_TELEGRAPH));
            const pulse = 0.5 + 0.5 * Math.sin(progress * 22);
            const lx = this._tx * TILE - camX;
            const ly = this._ty * TILE - camY;
            ctx.globalAlpha = (0.25 + progress * 0.55) * pulse;
            ctx.strokeStyle = '#ff3388';
            ctx.shadowBlur = 8 + progress * 14;
            ctx.shadowColor = '#cc1166';
            ctx.lineWidth = 1.5 + progress * 2.0;
            ctx.setLineDash([5, 5 - progress * 4]);
            NEON.draw.line(ctx, sx, sy, lx, ly);
            ctx.setLineDash([]);
            ctx.globalAlpha = 0.35 + progress * 0.45;
            ctx.strokeStyle = '#ff3388';
            ctx.lineWidth = 1.5 + progress * 1.5;
            NEON.draw.circleStroke(ctx, sx, sy, sz * (1.2 + progress * 0.5));
          } else {
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = '#ff3388';
            ctx.shadowBlur = 18;
            ctx.shadowColor = '#cc1166';
            NEON.draw.circle(ctx, sx, sy, sz * 0.6);
          }
        }
        ctx.restore();
      }
      // Beam geometry matches aiConduit's hit-test. Both endpoints draw it so an FOV-culled partner doesn't hide the line.
      if (this.type === 'CONDUIT') {
        ctx.save();
        const pulse = 0.5 + 0.5 * Math.sin(this.bobAngle * 2);
        ctx.globalAlpha = 0.20 + 0.15 * pulse;
        ctx.strokeStyle = '#44ffff';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#44ffff';
        ctx.lineWidth = 1.2;
        NEON.draw.circleStroke(ctx, sx, sy, sz * (1.0 + pulse * 0.4));
        // _EG.dungeon can be null during floor transitions; same optional map access as the other draw paths.
        const room = this.room;
        const inRoom = room ? enemiesByRoom.get(room) : null;
        const dmap = _EG.dungeon && _EG.dungeon.map;
        if (inRoom && dmap && typeof this._cdEid === 'number'
            && !(this.stunTimer && this.stunTimer > 0)) {
          for (const other of inRoom) {
            if (other === this || !other || other.dead) continue;
            if (other.type !== 'CONDUIT') continue;
            if (typeof other._cdEid !== 'number') continue;
            // Skip stunned partners — beam is geometrically gone
            // (matches damage-side filter in aiConduit).
            if (other.stunTimer && other.stunTimer > 0) continue;
            if (!hasLOS(this.x, this.y, other.x, other.y, dmap)) continue;
            const ox = other.x * TILE - camX;
            const oy = other.y * TILE - camY;
            const beamPulse = 0.5 + 0.5 * Math.sin(this.bobAngle * 6);
            ctx.globalAlpha = 0.55 + 0.30 * beamPulse;
            ctx.strokeStyle = '#88ffff';
            ctx.shadowBlur = 12 + beamPulse * 6;
            ctx.shadowColor = '#44ffff';
            ctx.lineWidth = 2.0 + beamPulse * 1.0;
            NEON.draw.line(ctx, sx, sy, ox, oy);
            ctx.globalAlpha = 0.85;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 0.8;
            NEON.draw.line(ctx, sx, sy, ox, oy);
          }
        }
        ctx.restore();
      }
      // Wedge matches the aiResonator hit-test so the cone shown is the cone that hits.
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
          ctx.fillStyle = '#ff66cc';
          ctx.globalAlpha = 0.10 + progress * 0.30;
          ctx.shadowBlur = 6 + progress * 14;
          ctx.shadowColor = '#ff66cc';
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.arc(sx, sy, radPx, aimAngle - halfRad, aimAngle + halfRad);
          ctx.closePath();
          ctx.fill();
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
          const pulse = 0.5 + 0.5 * Math.sin(progress * 22);
          ctx.globalAlpha = (0.25 + progress * 0.55) * pulse;
          ctx.lineWidth = 1.5 + progress * 1.2;
          ctx.beginPath();
          ctx.arc(sx, sy, radPx, aimAngle - halfRad, aimAngle + halfRad);
          ctx.stroke();
        } else {
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
      // Cone matches the aiWatcher hit-test. Faint during sweep so the rotation is readable before the lock.
      if (this.type === 'WATCHER') {
        ctx.save();
        const halfRad = WATCHER_HALF_RAD;
        const radPx = WATCHER_RANGE * TILE;
        // Aim direction: live sweep angle during 'sweep'; locked angle
        // during 'telegraph' / 'recovery' (sweep paused).
        const aimAngle = (this._wState === 'sweep') ? this._wAng : this._wLockAng;
        if (this._wState === 'telegraph' && this._wTele > 0) {
          const progress = 1 - Math.max(0, Math.min(1, this._wTele / WATCHER_TELEGRAPH));
          ctx.fillStyle = '#ffee66';
          ctx.globalAlpha = 0.14 + progress * 0.34;
          ctx.shadowBlur = 6 + progress * 14;
          ctx.shadowColor = '#ffee66';
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.arc(sx, sy, radPx, aimAngle - halfRad, aimAngle + halfRad);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 0.45 + progress * 0.50;
          ctx.strokeStyle = '#ffffaa';
          ctx.lineWidth = 1.2 + progress * 1.2;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(aimAngle - halfRad) * radPx,
                     sy + Math.sin(aimAngle - halfRad) * radPx);
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(aimAngle + halfRad) * radPx,
                     sy + Math.sin(aimAngle + halfRad) * radPx);
          ctx.stroke();
          const pulse = 0.5 + 0.5 * Math.sin(progress * 22);
          ctx.globalAlpha = (0.30 + progress * 0.55) * pulse;
          ctx.lineWidth = 1.5 + progress * 1.2;
          ctx.beginPath();
          ctx.arc(sx, sy, radPx, aimAngle - halfRad, aimAngle + halfRad);
          ctx.stroke();
        } else if (this._wState === 'recovery' && this._wFired && this._wRec > WATCHER_RECOVERY * 0.7) {
          // Gated on _wFired: a stun-cancelled telegraph also enters recovery and must not flash a phantom beam.
          const flashT = (this._wRec - WATCHER_RECOVERY * 0.7) / (WATCHER_RECOVERY * 0.3);
          ctx.globalAlpha = 0.85 * flashT;
          ctx.strokeStyle = '#ffffcc';
          ctx.shadowBlur = 18;
          ctx.shadowColor = '#ffee66';
          ctx.lineWidth = 3.0 * flashT + 1.0;
          NEON.draw.line(ctx, sx, sy,
                         sx + Math.cos(aimAngle) * radPx,
                         sy + Math.sin(aimAngle) * radPx);
        } else {
          ctx.fillStyle = '#ffee66';
          ctx.globalAlpha = 0.06;
          ctx.shadowBlur = 4;
          ctx.shadowColor = '#ffee66';
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.arc(sx, sy, radPx, aimAngle - halfRad, aimAngle + halfRad);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 0.28;
          ctx.strokeStyle = '#ffee66';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(aimAngle - halfRad) * radPx,
                     sy + Math.sin(aimAngle - halfRad) * radPx);
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(aimAngle + halfRad) * radPx,
                     sy + Math.sin(aimAngle + halfRad) * radPx);
          ctx.stroke();
        }
        ctx.restore();
      }
      if (this.type === 'MAGNETON') {
        ctx.save();
        const mgT = this._mgPulse || 0;
        const fieldPx = MAGNETON_FIELD_R * TILE;
        const mgPulse = 0.5 + 0.5 * Math.sin(mgT * 2.2);
        ctx.globalAlpha = 0.18 + 0.18 * mgPulse;
        ctx.strokeStyle = '#ff44dd';
        ctx.shadowBlur = 8 + mgPulse * 6;
        ctx.shadowColor = '#ff44dd';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([6, 8]);
        ctx.lineDashOffset = -mgT * 14;
        NEON.draw.circleStroke(ctx, sx, sy, fieldPx);
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.22 + 0.22 * mgPulse;
        ctx.lineWidth = 1.6;
        const mgA0 = mgT * 1.4;
        ctx.beginPath();
        ctx.arc(sx, sy, fieldPx * 0.55, mgA0, mgA0 + Math.PI * 0.7);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sx, sy, fieldPx * 0.55, mgA0 + Math.PI, mgA0 + Math.PI * 1.7);
        ctx.stroke();
        ctx.globalAlpha = 0.40 + 0.20 * mgPulse;
        ctx.lineWidth = 1.8;
        ctx.shadowBlur = 12 + mgPulse * 8;
        NEON.draw.circleStroke(ctx, sx, sy, sz * 1.15);
        ctx.restore();
      }
      if (this.type === 'NULLIFIER') {
        const stunned = (this.stunTimer && this.stunTimer > 0);
        ctx.save();
        const nlT = this._nlPulse || 0;
        const fieldPx = NULLIFIER_FIELD_R * TILE;
        const nlPulse = 0.5 + 0.5 * Math.sin(nlT * 1.4);
        // hackwareJammed is set by updateNullifierJam; this read is render intensity only.
        const player = _EG && _EG.player;
        const jamActive = !!(player && player.hackwareJammed && !stunned
          && dist(this.x, this.y, player.x, player.y) < NULLIFIER_FIELD_R);
        const intensity = stunned ? 0.25 : (jamActive ? 1.0 : 0.55);
        ctx.globalAlpha = (0.18 + 0.22 * nlPulse) * intensity;
        ctx.strokeStyle = '#cc66dd';
        ctx.shadowBlur = 8 + nlPulse * 6;
        ctx.shadowColor = '#cc66dd';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([4, 6]);
        ctx.lineDashOffset = -nlT * 16;
        NEON.draw.circleStroke(ctx, sx, sy, fieldPx);
        ctx.setLineDash([5, 9]);
        ctx.lineDashOffset = nlT * 12;
        NEON.draw.circleStroke(ctx, sx, sy, fieldPx * 0.94);
        ctx.setLineDash([]);
        ctx.globalAlpha = (0.20 + 0.22 * nlPulse) * intensity;
        ctx.lineWidth = 1.5;
        const nlA0 = nlT * 1.2;
        ctx.beginPath();
        ctx.arc(sx, sy, fieldPx * 0.55, nlA0, nlA0 + Math.PI * 0.65);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sx, sy, fieldPx * 0.55, nlA0 + Math.PI, nlA0 + Math.PI * 1.65);
        ctx.stroke();
        ctx.globalAlpha = (0.40 + 0.30 * nlPulse) * intensity;
        ctx.lineWidth = jamActive ? 2.2 : 1.7;
        ctx.shadowBlur = 12 + nlPulse * 10;
        NEON.draw.circleStroke(ctx, sx, sy, sz * 1.15);
        ctx.restore();
      }
      // Cone direction uses _glAimAngle, which the AI freezes during charging/recovery so the warning matches the belch.
      if (this.type === 'GULPER') {
        ctx.save();
        const stunned = (this.stunTimer && this.stunTimer > 0);
        const aimDx = Math.cos(this._glAimAngle || 0);
        const aimDy = Math.sin(this._glAimAngle || 0);
        const aimAngle = this._glAimAngle || 0;
        const halfRad = GULPER_MOUTH_HALF_ANGLE;
        const radPx = GULPER_MOUTH_RANGE * TILE;
        const stacks = Math.max(0, Math.min(GULPER_MAX_STACKS, this._glStacks || 0));
        const stackT = stacks / GULPER_MAX_STACKS;
        const glPulse = 0.5 + 0.5 * Math.sin((this._glPulse || 0) * 2.6);
        const charging = (this._glState === 'charging') && !stunned;
        const recovery = (this._glState === 'recovery') || stunned;
        const chargeT = charging
          ? 1 - Math.max(0, Math.min(1, (this._glChargeTimer || 0) / GULPER_BELCH_TELEGRAPH))
          : 0;
        const wedgeColour = recovery ? '#666666'
                          : charging ? '#ff4422'
                                     : '#bbdd33';
        const baseAlpha = recovery ? 0.05
                                   : 0.06 + stackT * 0.18 + chargeT * 0.30;
        ctx.fillStyle = wedgeColour;
        ctx.globalAlpha = baseAlpha;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.arc(sx, sy, radPx, aimAngle - halfRad, aimAngle + halfRad);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = wedgeColour;
        ctx.shadowColor = wedgeColour;
        ctx.shadowBlur = recovery ? 0 : 6 + chargeT * 14 + glPulse * 4;
        ctx.lineWidth = 1.2 + chargeT * 1.4;
        ctx.globalAlpha = recovery ? 0.18
                                   : 0.40 + stackT * 0.30 + chargeT * 0.40;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(aimAngle - halfRad) * radPx,
                   sy + Math.sin(aimAngle - halfRad) * radPx);
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(aimAngle + halfRad) * radPx,
                   sy + Math.sin(aimAngle + halfRad) * radPx);
        ctx.stroke();
        if (stacks > 0 && !recovery) {
          const teeth = stacks;
          ctx.lineWidth = 1.4;
          ctx.globalAlpha = 0.45 + stackT * 0.45;
          for (let i = 0; i < teeth; i++) {
            const t = (i + 0.5) / teeth;
            const a = (aimAngle - halfRad) + t * (halfRad * 2);
            const r0 = radPx * 0.85;
            const r1 = radPx * 0.95;
            ctx.beginPath();
            ctx.moveTo(sx + Math.cos(a) * r0, sy + Math.sin(a) * r0);
            ctx.lineTo(sx + Math.cos(a) * r1, sy + Math.sin(a) * r1);
            ctx.stroke();
          }
        }
        if (charging) {
          const bloom = 0.5 + 0.5 * Math.sin((this._glPulse || 0) * 14);
          ctx.globalAlpha = 0.40 + 0.45 * bloom;
          ctx.fillStyle = '#ff4422';
          ctx.shadowBlur = 16 + bloom * 12;
          ctx.shadowColor = '#ff4422';
          const bloomR = TILE * (0.20 + chargeT * 0.30 + bloom * 0.10);
          ctx.beginPath();
          ctx.arc(sx + aimDx * TILE * 0.35, sy + aimDy * TILE * 0.35,
                  bloomR, 0, TWO_PI);
          ctx.fill();
        }
        ctx.globalAlpha = recovery ? 0.20
                                   : 0.35 + 0.25 * glPulse;
        ctx.strokeStyle = '#bbdd33';
        ctx.shadowBlur = recovery ? 0 : 8 + glPulse * 4;
        ctx.shadowColor = '#bbdd33';
        ctx.lineWidth = 1.6;
        NEON.draw.circleStroke(ctx, sx, sy, sz * 1.10);
        ctx.restore();
      }
      if (this.type === 'SPECTRE' && this._spState === 'manifest') {
        ctx.save();
        const winT = 1 - Math.max(0, Math.min(1, this._spTimer / SPECTRE_MANIFEST_DUR));
        const pulse = 0.55 + 0.45 * Math.sin(winT * Math.PI);
        ctx.globalAlpha = 0.55 + 0.30 * pulse;
        ctx.strokeStyle = '#eeccff';
        ctx.shadowBlur = 10 + pulse * 8;
        ctx.shadowColor = '#eeccff';
        ctx.lineWidth = 1.6 + pulse * 0.6;
        const ringR = TILE * (0.42 + pulse * 0.10);
        NEON.draw.circleStroke(ctx, sx, sy, ringR);
        ctx.restore();
      }
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
          const pulse = 0.5 + 0.5 * Math.sin(progress * 22);
          ctx.globalAlpha = (0.35 + progress * 0.50) * pulse;
          ctx.lineWidth = 1.6 + progress * 1.4;
          NEON.draw.circleStroke(ctx, sx, sy, sz * (1.2 + progress * 0.4));
          ctx.globalAlpha = 0.25 + progress * 0.30;
          ctx.strokeStyle = '#88ff44';
          ctx.lineWidth = 1.2;
          NEON.draw.circleStroke(ctx, sx, sy, sz * 1.55);
        } else {
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
      if (this.type === 'GHOST_PROJECTOR') {
        ctx.save();
        const pendingProgress = this._gpPendingType
          ? 1 - Math.max(0, Math.min(1, this._gpPendingDelay / GHOST_PROJECTOR_DELAY))
          : 0;
        const haunting = !!(this._gpActiveGhost && !this._gpActiveGhost.dead);
        const pulseRate = this._gpPendingType ? (3 + pendingProgress * 18) : 1.5;
        const pulse = 0.5 + 0.5 * Math.sin(this.bobAngle * pulseRate);
        const intensity = this._gpPendingType ? (0.4 + pendingProgress * 0.5) : (haunting ? 0.3 : 0.18);
        ctx.globalAlpha = (0.18 + 0.30 * pulse) * (intensity / 0.4);
        ctx.strokeStyle = '#cc99ff';
        ctx.shadowBlur = 8 + pulse * 10 * intensity;
        ctx.shadowColor = '#cc99ff';
        ctx.lineWidth = 1.4 + intensity * 1.4;
        NEON.draw.circleStroke(ctx, sx, sy, sz * (1.0 + pulse * 0.4));
        if (this._gpPendingType) {
          const gx = this._gpPendingX * TILE - camX;
          const gy = this._gpPendingY * TILE - camY;
          ctx.globalAlpha = 0.30 + pendingProgress * 0.55;
          ctx.lineWidth = 1.2 + pendingProgress * 1.4;
          ctx.setLineDash([4, 6]);
          ctx.lineDashOffset = -this.bobAngle * 18;
          NEON.draw.circleStroke(ctx, gx, gy, TILE * (0.45 + pendingProgress * 0.45));
          ctx.setLineDash([]);
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
        ctx.globalAlpha = sPulse * 1.2;
        ctx.setLineDash([6, 10]);
        ctx.lineDashOffset = this.bobAngle * 12;
        NEON.draw.circleStroke(ctx, sx, sy, ringR * 0.7);
        ctx.setLineDash([]);
        ctx.restore();
      }
      if (this.type === 'HEALER') {
        ctx.save();
        const hPulse = 0.3 + 0.15 * Math.sin(this.bobAngle * 2.5);
        ctx.globalAlpha = hPulse;
        ctx.strokeStyle = '#44ffaa';
        ctx.shadowBlur = 8 + Math.sin(this.bobAngle * 2) * 4;
        ctx.shadowColor = '#44ffaa';
        ctx.lineWidth = 2;
        const crossY = sy - sz * 0.8;
        const cs = 4;
        ctx.beginPath();
        ctx.moveTo(sx - cs, crossY); ctx.lineTo(sx + cs, crossY);
        ctx.moveTo(sx, crossY - cs); ctx.lineTo(sx, crossY + cs);
        ctx.stroke();
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
      if (this.type === 'CHARGER') {
        if (this._chgState === 'windup') {
          ctx.save();
          const wPulse = 0.3 + 0.3 * Math.sin(this.bobAngle * 8);
          ctx.globalAlpha = wPulse;
          ctx.shadowBlur = 14 + wPulse * 8;
          ctx.shadowColor = '#ff6600';
          ctx.fillStyle = '#ff6600';
          NEON.draw.circle(ctx, sx, sy, sz * 1.6);
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
      if (this.type === 'LEAPER') {
        if (this._lpState === 'windup') {
          ctx.save();
          const wPulse = 0.3 + 0.3 * Math.sin(this.bobAngle * 8);
          ctx.globalAlpha = wPulse;
          ctx.shadowBlur = 14 + wPulse * 8;
          ctx.shadowColor = '#22ff88';
          ctx.fillStyle = '#22ff88';
          NEON.draw.circle(ctx, sx, sy, sz * 1.6);
          ctx.restore();
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
          ctx.globalAlpha = 0.1 + progress * 0.15;
          ctx.strokeStyle = '#22ff88';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 5]);
          NEON.draw.circleStroke(ctx, landSx, landSy, TILE * 2);
          ctx.setLineDash([]);
          ctx.restore();
        } else if (this._lpState === 'recovery') {
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
      if (this.type === 'PHANTOM') {
        if (this._phState === 'cloaked') {
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
          ctx.save();
          const tPulse = 0.4 + 0.3 * Math.sin(this.bobAngle * 10);
          ctx.globalAlpha = tPulse;
          ctx.shadowBlur = 12 + tPulse * 8;
          ctx.shadowColor = this.colour;
          ctx.strokeStyle = this.colour;
          ctx.lineWidth = 2;
          const ringR = sz * (1.2 + 0.8 * (1 - Math.max(0, this._phTimer) / 0.4));
          NEON.draw.circleStroke(ctx, sx, sy, ringR);
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
      if (this._isBounty) {
        ctx.save();
        const bPulse = 0.3 + 0.15 * Math.sin(this.bobAngle * 2.5);
        ctx.globalAlpha = bPulse;
        ctx.shadowBlur = 16 + Math.sin(this.bobAngle * 1.5) * 6;
        ctx.shadowColor = '#ffd700';
        ctx.fillStyle = '#ffd700';
        NEON.draw.circle(ctx, sx, sy, sz * 1.4);
        ctx.restore();
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
      if (this.eliteAffix === 'PHASING' && this.phaseImmune) {
        ctx.globalAlpha = 0.15 + Math.sin(this.bobAngle * 12) * 0.1;
      }
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
      // Clamp alpha to [0,1]: canvas ignores an out-of-range globalAlpha and keeps
      // the previous value, so a negative pulse trough would flash at full opacity.
      if (this.eliteAffix === 'PREDATOR' && this.predatorBuffTimer > 0) {
        ctx.save();
        const frac = Math.min(1, this.predatorBuffTimer / 3);
        const pPulse = 0.4 + 0.2 * Math.sin(this.bobAngle * 5);
        ctx.globalAlpha = Math.max(0, Math.min(1, pPulse * frac));
        ctx.strokeStyle = '#ff0099';
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 8 + Math.sin(this.bobAngle * 5) * 4;
        ctx.shadowColor = '#ff0099';
        const rR = sz * (1.2 + 0.15 * Math.sin(this.bobAngle * 5));
        NEON.draw.circleStroke(ctx, sx, sy, rR);
        ctx.beginPath();
        ctx.moveTo(sx - rR - 3, sy); ctx.lineTo(sx - rR + 1, sy);
        ctx.moveTo(sx + rR - 1, sy); ctx.lineTo(sx + rR + 3, sy);
        ctx.moveTo(sx, sy - rR - 3); ctx.lineTo(sx, sy - rR + 1);
        ctx.moveTo(sx, sy + rR - 1); ctx.lineTo(sx, sy + rR + 3);
        ctx.stroke();
        ctx.restore();
      }
      if (isEnemyShieldGenProtected(this)) {
        ctx.save();
        ctx.globalAlpha = 0.15 + 0.1 * Math.sin(this.bobAngle * 2);
        ctx.shadowBlur = 10; ctx.shadowColor = '#00ccff';
        ctx.fillStyle = '#00ccff';
        NEON.draw.circle(ctx, sx, sy, sz * 1.2);
        ctx.restore();
      }
      if (this.hp<this.maxHp || this.shieldHp > 0 || this._isBounty) {
        ctx.shadowBlur=0;
        const barW = this._isBounty ? 20 : 16, barH = 2, barY = sy - 12;
        ctx.fillStyle='#333';
        ctx.fillRect(sx-barW/2, barY, barW, barH);
        const hpCol = this._isBounty ? '#ffd700' : this.elite ? '#ffffff' : this.colour;
        ctx.fillStyle=hpCol;
        ctx.fillRect(sx-barW/2, barY, barW*(this.hp/this.maxHp), barH);
        if (this._isBounty) {
          ctx.save();
          ctx.font='bold 7px monospace'; ctx.textAlign='center';
          ctx.fillStyle='#ffd700'; ctx.shadowBlur=3; ctx.shadowColor='#ffd700';
          ctx.fillText('BOUNTY', sx, barY - 3);
          ctx.restore();
        }
        if (this.shieldHp > 0) {
          ctx.fillStyle='#4488ff';
          ctx.fillRect(sx-barW/2, barY - 3, barW*(this.shieldHp/this.shieldMax), barH);
        }
      }
    }
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


/**
 * Player-only tile passability. Identical to isPassable() except for the
 * exploit trial's SEAM_WALL (src/content/trials.js), which the agent may
 * pass mid-dash during its desync window and may always walk out of.
 * @param {any} player
 * @param {any} tile
 * @param {number} tx
 * @param {number} ty
 * @param {boolean} [dashing] true for dash steps (the dash timer may already
 *   have been decremented past zero on a dash's final frame)
 */
function playerTilePassable(player, tile, tx, ty, dashing) {
  if (isPassable(tile)) return true;
  if (tile !== T.SEAM_WALL || typeof NEON === 'undefined' || !NEON.trials) return false;
  return NEON.trials.playerMayEnterSeam(_EG, player, tx, ty, dashing);
}

/**
 * Keep the agent's centre out of impassable tiles. Boss/charger knockbacks and
 * arena clamps move the agent without full tile checks and can leave it inside
 * a wall; the old movement then froze it there. Restore the last position it
 * held on a passable tile of this map (recorded every frame), or — with no
 * usable record — the tile findPlayerUnembedTile picks.
 * The non-embedded path does not allocate (one typed array per floor aside).
 * @param {any} player
 * @param {any} map
 * @returns {boolean} true when the agent was moved
 */
function depenetratePlayer(player, map) {
  const tx = Math.floor(player.x), ty = Math.floor(player.y);
  const row = map[ty];
  if (playerTilePassable(player, row ? row[tx] : undefined, tx, ty, false)) {
    player._safeX = player.x;
    player._safeY = player.y;
    player._safeMap = map;
    markPlayerStood(player, map, tx, ty);
    return false;
  }
  if (playerSafeRecordUsable(player, map)) { player.x = player._safeX; player.y = player._safeY; return true; }
  const spot = findPlayerUnembedTile(player, map);
  if (!spot) return false;
  player.x = spot.x;
  player.y = spot.y;
  return true;
}

/**
 * Record that the agent stood on (tx, ty) of this floor. A revealed map (the
 * lattice reward) marks every tile seen, lock-gated pockets included, but the
 * agent has only ever stood where it could walk.
 * @param {any} player
 * @param {any} map
 * @param {number} tx
 * @param {number} ty
 */
function markPlayerStood(player, map, tx, ty) {
  const width = map[0] ? map[0].length : 0;
  if (player._stoodMap !== map || !player._stood) {
    player._stood = new Uint8Array(map.length * width);
    player._stoodMap = map;
  }
  if (tx >= 0 && tx < width) player._stood[ty * width + tx] = 1;
}

/**
 * Where an embedded agent with no usable safe record should go: the nearest
 * passable tile centre within 4 tiles, ranked by (1) inside a sealed boss arena
 * the agent is in, so an embed never leaks out; (2) a tile it has stood on this
 * floor; (3) a tile it has seen; (4) distance. Never an unrevealed secret room
 * or the unbreached seam vault. Allocates only its result.
 * @param {any} player
 * @param {any} map
 * @returns {{x: number, y: number} | null}
 */
function findPlayerUnembedTile(player, map) {
  const tx = Math.floor(player.x), ty = Math.floor(player.y);
  const RADIUS = 4;
  const arena = (_EG.bossSealed && _EG.bossRoom) ? _EG.bossRoom : null;
  const inArenaRect = !!arena && tx >= arena.x && tx < arena.x + arena.w && ty >= arena.y && ty < arena.y + arena.h;
  const dg = _EG.dungeon;
  const visited = dg && dg.visited;
  const secret = dg && dg.secretMask;
  const seam = (dg && typeof NEON !== 'undefined' && NEON.trials) ? NEON.trials.findSeamTrial(dg) : null;
  const vault = (seam && !seam.lootClaimed) ? seam.vault : null;
  const width = map[0] ? map[0].length : 0;
  const stood = (player._stoodMap === map && player._stood) ? player._stood : null;
  let bestX = -1, bestY = -1, bestD = Infinity, bestInArena = false, bestStood = false, bestSeen = false;
  for (let dy = -RADIUS; dy <= RADIUS; dy++) {
    const crow = map[ty + dy];
    if (!crow) continue;
    for (let dx = -RADIUS; dx <= RADIUS; dx++) {
      const cx = tx + dx, cy = ty + dy;
      if (!isPassable(crow[cx])) continue;
      if (secret && secret[cy] && secret[cy][cx]) continue;
      if (vault && vault.x === cx && vault.y === cy) continue;
      const d = Math.abs(dx) + Math.abs(dy);
      // Sealed entrances are WALL tiles, so the whole rect (edge ring
      // included) is enclosed while the arena is sealed.
      const inArena = inArenaRect && cx >= arena.x && cx < arena.x + arena.w && cy >= arena.y && cy < arena.y + arena.h;
      const wasStood = !!(stood && cx >= 0 && cx < width && stood[cy * width + cx]);
      const seen = !!(visited && visited[cy] && visited[cy][cx]);
      const better = bestX < 0 || (inArena !== bestInArena ? inArena
        : wasStood !== bestStood ? wasStood
          : seen !== bestSeen ? seen
            : d < bestD);
      if (better) {
        bestX = cx; bestY = cy; bestD = d; bestInArena = inArena; bestStood = wasStood; bestSeen = seen;
      }
    }
  }
  return bestX < 0 ? null : { x: bestX + 0.5, y: bestY + 0.5 };
}

/**
 * Whether the agent's recorded safe position can be restored now: same map,
 * close by, still passable, and — while a boss arena is sealed around the
 * agent — inside that arena's rect, so an embed on the seal frame never
 * restores it to the corridor outside. The rect's edge ring is ordinary floor
 * (clampToBossRoom keeps the agent anywhere in the rect); sealed entrances on
 * it are WALL tiles and already fail the passability check.
 * @param {any} player
 * @param {any} map
 * @returns {boolean}
 */
function playerSafeRecordUsable(player, map) {
  const sx = player._safeX, sy = player._safeY;
  if (player._safeMap !== map || typeof sx !== 'number' || typeof sy !== 'number') return false;
  if (Math.abs(sx - player.x) + Math.abs(sy - player.y) > 6) return false;
  const stx = Math.floor(sx), sty = Math.floor(sy);
  const srow = map[sty];
  if (!srow || !isPassable(srow[stx])) return false;
  const arena = (_EG.bossSealed && _EG.bossRoom) ? _EG.bossRoom : null;
  if (arena) {
    const tx = Math.floor(player.x), ty = Math.floor(player.y);
    const agentInArena = tx >= arena.x && tx < arena.x + arena.w && ty >= arena.y && ty < arena.y + arena.h;
    const recordInArena = stx >= arena.x && stx < arena.x + arena.w && sty >= arena.y && sty < arena.y + arena.h;
    if (agentInArena && !recordInArena) return false;
  }
  return true;
}

/**
 * Where a save should put the agent. A save taken while a knockback or clamp
 * has it inside a wall would otherwise resume embedded; persist where the next
 * frame's depenetratePlayer would put it (the safe record, else the
 * findPlayerUnembedTile choice). noClip keeps the raw position.
 * @param {any} player
 * @param {any} map
 * @returns {{x: number, y: number}}
 */
function playerSavePosition(player, map) {
  if (map && !playerCheatEnabled('noClip')) {
    const tx = Math.floor(player.x), ty = Math.floor(player.y);
    const row = map[ty];
    if (!playerTilePassable(player, row ? row[tx] : undefined, tx, ty, false)) {
      if (playerSafeRecordUsable(player, map)) return { x: player._safeX, y: player._safeY };
      const spot = findPlayerUnembedTile(player, map);
      if (spot) return spot;
    }
  }
  return { x: player.x, y: player.y };
}

/**
 * Axis-separated collision checks (nx, y) and (x, ny) but never (nx, ny), so
 * a diagonal step can cut a convex corner into a tile neither check examined
 * (reachable at the trial seam, whose column is briefly passable). Undo one
 * axis, then both, so a step never ends inside a newly entered impassable tile.
 * @param {any} player
 * @param {any} map
 * @param {number} prevX
 * @param {number} prevY
 * @param {boolean} dashing
 */
function resolvePlayerCornerCut(player, map, prevX, prevY, dashing) {
  const fx = Math.floor(player.x), fy = Math.floor(player.y);
  const px = Math.floor(prevX), py = Math.floor(prevY);
  if (fx === px && fy === py) return;
  const fRow = map[fy], pRow = map[py];
  if (playerTilePassable(player, fRow ? fRow[fx] : undefined, fx, fy, dashing)) return;
  if (playerTilePassable(player, fRow ? fRow[px] : undefined, px, fy, dashing)) { player.x = prevX; return; }
  if (playerTilePassable(player, pRow ? pRow[fx] : undefined, fx, py, dashing)) { player.y = prevY; return; }
  player.x = prevX; player.y = prevY;
}

class Player {
  /** @type {any} */ _metaSecondWindUsed;
  /** @type {any} */ _momentumTimer;
  /** @type {any} */ _strideStacks;
  /** @type {any} */ _strideMovingTime;
  /** @type {any} */ _strideStillTime;
  /** @type {any} */ _steadyChargeTime;
  /** @type {any} */ _steadyReady;
  /** @type {any} */ _hotHandStreak;
  /** @type {any} */ _hotHandLastTarget;
  /** @type {any} */ _hotHandTimer;
  /** @type {any} */ _outOfCombatTimer;
  /** @type {any} */ _huntStill;
  /** @type {any} */ _prevHuntX;
  /** @type {any} */ _prevHuntY;
  /** @type {any} */ _prevX;
  /** @type {any} */ _prevY;
  /** @type {any} */ _posHistory;
  /** @type {any} */ _shotHistory;
  /** @type {any} */ _shieldCharges;
  /** @type {any} */ _piercingHearts;
  /** @type {any} */ _overchargeShots;
  /** @type {any} */ _windfallKills;
  /** @type {any} */ _signalBoostKills;
  /** @type {any} */ _reverbShots;
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
  /** @type {any} */ hackwareJammed;
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
  /** @type {any} */ _repairTicksLeft;
  /** @type {any} */ _repairTickTimer;
  /** @type {any} */ bubbleHp;
  /** @type {any} */ bubbleTimer;
  /** @type {any} */ roomsCleared;
  /** @type {any} */ score;
  /** @type {any} */ secondWindUsed;
  /** @type {any} */ lastStandTimer;
  /** @type {any} */ lastStandCD;
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
  /** @type {any} */ _tetherSlowFactor;
  /** @type {any} */ _spawnGraceTimer;
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
  /** @type {any} */ _dashIFrameTimer;
  /** @type {any} */ bonusCreditPerPickup;
  constructor() { this.reset(); }
  reset() {
    this.x=5; this.y=5;
    this.hp=100; this.maxHp=100;
    this.atk=10; this.def=2; this.spd=3.5;
    this.level=1; this.xp=0;
    this.weapon=buildWeapon('PULSE_PISTOL', []);
    this.weapons=[this.weapon];
    this.weaponIdx=0;
    this.score=0;
    this.invincibleTimer=0;
    this._spawnGraceTimer=0;
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
    this.toxicSlowActive=false;
    // TETHER leash field accumulator. Each TETHER aiTether() multiplies
    // this down per frame (capped per mob); player.update consumes-and-
    // resets it each frame. dashTimer bypasses (mirrors toxic/disruption).
    this._tetherSlowFactor=1;
    this.disruptionFieldActive=false;
    this.hackwareJammed=false;        // true while inside a NULLIFIER aura — blocks cooldown ticking AND activateHackware
    this.gravityPullActive=false;
    this.burnTimer=0; this.burnDps=0;
    this.shockTimer=0;                 // shock: brief movement suppress
    this.upgrades={};       // persistent upgrade levels: {SAW_BLADE:2, ...}
    this.permSpeedBonus=0;  // from OVERCLOCK
    this.orbitalAngle=0;    // shared rotation for saw blades
    this.orbitalHits=new Map(); // enemy→cooldown for orbital damage
    this.spellTimers={plasmaOrb:2, sentryDrone:1};
    this.droneAngle=0;
    this.perks={};
    this.energyShield=false;
    this.energyShieldTimer=0;   // recharge countdown (30s)
    this.autoLaserTimer=0;
    this.autoLaserBeam=null;    // {x1,y1,x2,y2,timer} for beam rendering
    this.credits=0;
    // Cleared by loadFloor via NEON.boosts.clearFloorBoosts().
    this.activeBoosts={};
    this._shieldCharges=0;
    // Remaining seconds. Not serialised: a few seconds of temp window is acceptable to lose on resume.
    this._boostTimers={};
    this.loreRead=new Set();
    this.dashCooldown=0;        // cooldown remaining (1.5s max)
    this.dashTimer=0;
    this.dashDx=0;
    this.dashDy=0;
    this.dashTrail=[];          // afterimage positions [{x,y,alpha}]
    // ECHOER lookback. Cleared on floor transition so a cross-floor sample can't fire.
    this._posHistory=[];
    // MIRROR mimicry: speed and colour only. Damage is mob-scaled; perks are not replayed.
    this._shotHistory=[];
    this.damageLog={};          // source → total damage taken
    this.killedBy='';
    this.enemiesKilled=0;
    // Reset on room change in game.js updatePlaying. Not serialized.
    this.killsInCurrentRoom=0;
    /** @type {any} */
    this._currentRoom=null;     // cached reference; not serialized
    this.hitsBlocked=0;
    this.roomsCleared=0;
    this.eventsResolved=0;
    this.hackware=null;
    this.hackwareCooldown=0;
    this.cloakTimer=0;
    this.regenTimer=0;
    // Self-clearing HoT. Tick is next to HP_REGEN; activation is in content.js.
    this._repairTicksLeft=0;
    this._repairTickTimer=0;
    // Drain in takeDamage before the one-shot shields so a bubble doesn't burn them.
    // dt-decremented so expiry is frame-rate independent. Not serialized.
    this.bubbleHp=0;
    this.bubbleTimer=0;
    this.secondWindUsed=false;  // SECOND_WIND: used this floor?
    // Triggered before the hp deduction so the activating hit gets the DR. Serialized so Continue keeps both timers.
    this.lastStandTimer=0;
    this.lastStandCD=0;
    // Refresh-only, actual > 0. Not serialized. Named RETRIBUTION so it doesn't collide with the VENGEANCE mob.
    this.retributionTimer=0;
    this.bountiesCollected=0;
    this.augments={};           // owned augments: {NEURAL_LINK: true, ...}
    this.adrenalineTimer=0;
    this.reactiveArmorCD=0;
    // dt-decremented. Persisted so a resume mid-chain keeps the window.
    this._chainBuffTimer=0;
    // Listeners read metaFlags set by save.applyMetaToPlayer().
    this._momentumTimer=0;        // momentum: damage bonus countdown after kill
    this._surgeShotCount=0;       // surge: rolling shot counter (every 8th)
    this._metaSecondWindUsed=false; // meta second_wind: fired once per run
    this._outOfCombatTimer=0;     // regenerator: seconds since last hit
    this._nanoMedicCharges=0;     // trauma_kit: panic-button auto-heal charges
    // HUNTER floor modifier: seconds the player has been ~stationary.
    this._huntStill=0;
    this._prevHuntX=null;
    this._prevHuntY=null;
    // STRIDE perk: movement-built ATK stacks. Runtime-only state.
    this._strideStacks=0;
    this._strideMovingTime=0;
    this._strideStillTime=0;
    // DEADEYE perk: stillness-charged attack. Runtime-only state.
    // _steadyChargeTime accumulates while stationary; once it crosses
    // DEADEYE_CHARGE_TIME the _steadyReady flag latches and persists
    // (across movement, dash, etc.) until consumed by the next shoot().
    this._steadyChargeTime=0;
    this._steadyReady=false;
    // Runtime-only. Target-switch reset is in Enemy.takeDamage; timeout reset is
    // in Player.update; floor reset is in game.js loadFloor.
    this._hotHandStreak=0;
    this._hotHandLastTarget=null;
    this._hotHandTimer=0;
  }

  /**
   * @param {any} [dmg]
   * @param {any} [source]
   * @param {any} [opts]
   */
  takeDamage(dmg, source, opts) {
    const options = opts || {};
    if (playerCheatEnabled('invulnerable') && !options.ignoreCheats) return 0;
    if (!options.ignoreInvincible && this.invincibleTimer>0) return 0;
    if (!options.ignoreImmunity && isPlayerDamageImmune()) return 0; // dash i-frames + phase cloak
    // Drains before one-shot shields so a bubble doesn't burn them.
    // ignoreShield/ignoreInvincible: env DoTs must bypass, or a 35hp pool dies in
    // a second of plasma. Break sound only on full drain.
    if (!options.ignoreShield && !options.ignoreInvincible && this.bubbleHp > 0 && dmg > 0) {
      const absorbed = Math.min(this.bubbleHp, dmg);
      this.bubbleHp -= absorbed;
      dmg -= absorbed;
      spawnDmgText(this.x, this.y, 'ABSORB ' + absorbed, '#e0e0ff');
      if (this.bubbleHp <= 0) {
        this.bubbleHp = 0;
        this.bubbleTimer = 0;
        audio.shieldBreak();
        spawnParticles(this.x, this.y, 'EXPLOSION', '#e0e0ff', 12);
        _EG.msg('⊚ BUBBLE BROKEN', '#e0e0ff');
        triggerShake(2, 0.10);
      }
      // Return 0, not absorbed: callers treat dealt > 0 as real damage (burn, sapper,
      // shock, knockback). hitsBlocked increments only on full absorb so a residual
      // one-shot block isn't double-counted.
      if (dmg <= 0) {
        this.hitsBlocked = (this.hitsBlocked|0) + 1;
        return 0;
      }
    }
    // Consumed before ENERGY_SHIELD so the cheap charge goes first. ignoreInvincible
    // skips it: env DoT must not eat a one-shot absorb.
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
      // After the flat plating reduction, before floor-modifier amps. ignoreDefense
      // DoTs bypass so they stay BIOFILTER's lane. Min 1 keeps the direct-hit floor.
      if (hasAugment('KINETIC_DAMPER')) {
        actual = Math.max(1, Math.round(actual * 0.8));
      }
    }
    if (_EG.modifier === 'CORROSIVE' && !options.ignoreDefense) actual += 2;
    if (_EG.modifier === 'FRAGILE' && !options.ignoreDefense) {
      actual = Math.max(1, Math.round(actual * 1.3));
    }
    // ignoreDefense gate: Math.max(1, round) would turn a sub-1 env DoT tick into ~1/frame.
    if (_EG.modifier === 'HUNTER' && !options.ignoreDefense) {
      const still = (this._huntStill || 0);
      const HUNT_MAX_STILL = 4.0;
      const HUNT_MAX_BONUS = 0.5;
      const mul = 1 + Math.min(1, still / HUNT_MAX_STILL) * HUNT_MAX_BONUS;
      actual = Math.max(1, Math.round(actual * mul));
    }
    // Same ignoreDefense gate as HUNTER. Min 1 so a 1-damage hit doesn't round to 0.
    if (_EG.modifier === 'HARDENED' && !options.ignoreDefense) {
      actual = Math.max(1, Math.round(actual * 0.8));
    }
    // ignoreDefense gate, same DoT reason as HUNTER. Before LAST_STAND so the clutch DR applies to the amplified value.
    if (this.perks.GLASS_CANNON && !options.ignoreDefense) {
      actual = Math.max(1, Math.round(actual * 1.25));
    }
    if (actual <= 0) return 0;
    // Before the hp deduction so the activating hit gets the DR. No Math.max(1): that would inflate fractional env DoT ticks.
    if (this.perks.LAST_STAND && this.lastStandCD <= 0 && this.lastStandTimer <= 0
        && this.hp > 0 && (this.hp - actual) <= this.maxHp * 0.10) {
      this.lastStandTimer = 5;
      this.lastStandCD = 60;
      audio.secondWind();
      spawnParticles(this.x, this.y, 'EXPLOSION', '#ffcc00', 18);
      triggerShake(6, 0.25);
      _EG.msg('⚔ LAST STAND', '#ffcc00');
    }
    if (this.lastStandTimer > 0) actual = actual * 0.5;
    // Threshold uses pre-deduction hp, so the hit that crosses 75% still gets the
    // reduction. No Math.max(1), same DoT reason as LAST_STAND.
    if (this.perks.BULWARK && this.maxHp > 0 && this.hp / this.maxHp >= 0.75) {
      actual = actual * 0.85;
    }
    this.hp=Math.max(0,this.hp-actual);
    // After absorbs return, so only real HP loss notifies. notifyPredatorElites is idempotent on refresh.
    notifyPredatorElites(this.x, this.y);
    // Refresh-on-hit is intentional, including env DoTs; the buff does not stack past the window.
    if (this.perks.RETRIBUTION) this.retributionTimer = 3;
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
      // Independent of the perk: either revive can fire.
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
    // After the lethal-hit revives, so this only spends a charge on a non-lethal cross of the threshold.
    if (this.hp > 0 && NEON.behavior.tryTraumaKit(this)) {
      audio.heal();
      spawnParticles(this.x, this.y, 'EXPLOSION', '#00ffaa', 14);
      // Amount duplicated from tryTraumaKit (40% maxHp); keep them in sync.
      spawnDmgText(this.x, this.y, '+' + Math.round(this.maxHp * 0.4), '#ff88aa');
      _EG.msg('✚ NANO-MEDIC!', '#00ffaa');
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
    const hitCtx = { name:w.name, affixes:w._affixes||[], effects:w._effects||[], fromPlayerShot:true };
    const surgeMul = this._consumeSurgeShot();
    const boostDmgMul = NEON.boosts.getBoostDamageMul(this);
    const metaMul = this.computeOutgoingDmgMul() * surgeMul * boostDmgMul;
    // Flat crit from the matrix; an active matrix can crit without the CRITICAL_HIT perk.
    const critBonus = NEON.boosts.getBoostCritBonus(this);
    const mf = this.metaFlags || {};
    // (this.critChance || 0) keeps the critical_bias meta upgrade in the roll; save.js writes that field.
    const critChance = (this.perks.CRITICAL_HIT ? 0.15 : 0) + critBonus + (mf.critChanceBonus || 0) + (w.critAdd || 0) + (this.critChance || 0);
    // || 0 is required: weapons without DEADLY leave critMulAdd undefined, and bare addition would NaN every crit's damage.
    const critMul = 2 + (mf.critDamageBonus || 0) + (w.critMulAdd || 0);

    // Counter increments only on OVERCHARGE floors so another floor doesn't inherit a ready crit. Auto-fire does not go through shoot().
    let forceCrit = false;
    if (_EG.modifier === 'OVERCHARGE') {
      this._overchargeShots = (this._overchargeShots || 0) + 1;
      if (this._overchargeShots % 5 === 0) forceCrit = true;
    }

    // room._primedFired is not saved; Continue rebuilds rooms, so a resume can re-prime. Auto-fire does not go through shoot().
    if (_EG.modifier === 'PRIMED' && this._currentRoom && !this._currentRoom._primedFired) {
      this._currentRoom._primedFired = true;
      forceCrit = true;
    }

    // Increment only on REVERB floors. The echo must not re-enter shoot() or it would double-tick counters and perks.
    let echoOnThisShot = false;
    if (_EG.modifier === 'REVERB') {
      this._reverbShots = (this._reverbShots || 0) + 1;
      if (this._reverbShots % 5 === 0) echoOnThisShot = true;
    }

    // Only shoot() consumes the charge; auto-fire paths do not.
    let deadeyeMul = 1;
    if (this.perks.DEADEYE && this._steadyReady) {
      deadeyeMul = DEADEYE_DMG_MUL;
      this._steadyReady = false;
      this._steadyChargeTime = 0;
    }
    const finalMetaMul = metaMul * deadeyeMul;

    if (w.melee) {
      const meleeCrit = forceCrit || (critChance > 0 && rand('combat') < critChance);
      const meleeDmg = (w.dmg+this.effectiveAtk()) * (meleeCrit ? critMul : 1) * finalMetaMul;
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
        const spread=(rand('combat')-0.5)*(w.spread + (_EG.modifier==='SCRAMBLED' ? 0.15 : 0));
        const a=Math.atan2(dy,dx)+spread;
        const pdx=Math.cos(a), pdy=Math.sin(a);
        const isCrit = forceCrit || (critChance > 0 && rand('combat') < critChance);
        const proj=new Projectile(
          this.x,this.y,pdx,pdy,12,(w.dmg+this.effectiveAtk())*(isCrit?critMul:1)*finalMetaMul,w.range,
          w.colour,!!w.piercing,true,w.name
        );
        proj.isCrit = isCrit;
        proj._effects = w._effects || [];
        proj._affixes = w._affixes || [];
        proj.fromPlayerShot = true;
        if (this.perks.PIERCING_ROUNDS) proj.maxPierces+=1;
        proj.bouncesLeft=this.upgrades.RICOCHET||0;
        if (proj.bouncesLeft) proj._hasRicochet=true;
        projectiles.push(proj);
        // Capture the post-_init speed so MIRROR mimicry sees the actual
        // value (KINETIC_AMPLIFIER, CHARGED modifier, etc) rather than the
        // base 12. MIRROR re-clamps into its fair band before firing back.
        lastProjSpd = proj.spd;
      }
      if (this.perks.MULTI_SHOT) {
        const offAngle = (rand('combat') < 0.5 ? -1 : 1) * 0.14; // ~8°
        const a = Math.atan2(dy, dx) + offAngle;
        const pdx = Math.cos(a), pdy = Math.sin(a);
        const isCrit = forceCrit || (critChance > 0 && rand('combat') < critChance);
        const bonusDmg = Math.round((w.dmg + this.effectiveAtk()) * 0.6 * (isCrit ? critMul : 1) * finalMetaMul);
        const proj = new Projectile(this.x, this.y, pdx, pdy, 12, bonusDmg, w.range, w.colour, !!w.piercing, true, w.name);
        proj.isCrit = isCrit;
        proj._effects = w._effects || [];
        proj._affixes = w._affixes || [];
        proj.fromPlayerShot = true;
        if (this.perks.PIERCING_ROUNDS) proj.maxPierces += 1;
        proj.bouncesLeft = this.upgrades.RICOCHET || 0;
        if (proj.bouncesLeft) proj._hasRicochet = true;
        projectiles.push(proj);
      }
      spawnParticles(this.x+dx*0.8,this.y+dy*0.8,'MUZZLE',w.colour,3);
      // Speed and colour only: MIRROR re-derives damage and must not replay player perks. Melee has no projectile to mimic.
      if (!this._shotHistory) this._shotHistory = [];
      this._shotHistory.push({ spd: lastProjSpd, colour: w.colour });
      while (this._shotHistory.length > SHOT_HISTORY_LEN) this._shotHistory.shift();
    }
    audio.shoot(true, w);
    // Same forceCrit and metaMul as the main shot. Does not include MULTI_SHOT, does not push _shotHistory, and does not consume DEADEYE again.
    if (echoOnThisShot) {
      if (w.melee) {
        const echoCrit = forceCrit || (critChance > 0 && rand('combat') < critChance);
        const echoDmg = (w.dmg+this.effectiveAtk()) * (echoCrit ? critMul : 1) * finalMetaMul;
        spawnParticles(this.x+dx*1.5, this.y+dy*1.5,'EXPLOSION',w.colour,8);
        for (const e of enemies) {
          if (e.dead) continue;
          if (e._wrPhased) continue;
          if (dist(this.x,this.y,e.x,e.y)<w.range) {
            e.takeDamage(echoDmg, hitCtx);
            if (echoCrit) spawnDmgText(e.x, e.y, 'CRIT!', '#ffdd00');
          }
        }
      } else {
        for (let i = 0; i < w.count; i++) {
          const spread = (rand('combat')-0.5)*(w.spread + (_EG.modifier==='SCRAMBLED' ? 0.15 : 0));
          const a = Math.atan2(dy,dx) + spread;
          const pdx = Math.cos(a), pdy = Math.sin(a);
          const isCrit = forceCrit || (critChance > 0 && rand('combat') < critChance);
          const proj = new Projectile(
            this.x,this.y,pdx,pdy,12,(w.dmg+this.effectiveAtk())*(isCrit?critMul:1)*finalMetaMul,w.range,
            w.colour,!!w.piercing,true,w.name
          );
          proj.isCrit = isCrit;
          proj._effects = w._effects || [];
          proj._affixes = w._affixes || [];
          proj.fromPlayerShot = true;
          proj._isReverbEcho = true;
          if (this.perks.PIERCING_ROUNDS) proj.maxPierces += 1;
          proj.bouncesLeft = this.upgrades.RICOCHET || 0;
          if (proj.bouncesLeft) proj._hasRicochet = true;
          projectiles.push(proj);
        }
        spawnParticles(this.x+dx*0.8, this.y+dy*0.8, 'MUZZLE', w.colour, 3);
      }
      audio.shoot(true, w);
      spawnDmgText(this.x, this.y, '♪', '#ff66cc');
    }
    this.shootCooldown = (1/w.rate) * (this.perks.RAPID_FIRE ? 0.85 : 1);
  }

  /**
   * @param {any} [dt]
   * @param {any} [map]
   */
  update(dt,map) {
    this._prevX = this.x; this._prevY = this.y;
    // Rate in tiles/sec, not tiles/frame, so 30/60/120 fps match. Tracked even off HUNTER floors so the meter stays consistent.
    if (this._huntStill == null) this._huntStill = 0;
    {
      const HUNT_MAX_STILL = 4.0;
      const HUNT_MOVE_RATE = 0.5;       // tiles/sec — anything slower counts as "still"
      const HUNT_DECAY = 4.0;           // seconds-of-still removed per second-of-motion
      const dx = this.x - (this._prevHuntX != null ? this._prevHuntX : this.x);
      const dy = this.y - (this._prevHuntY != null ? this._prevHuntY : this.y);
      const moved = Math.hypot(dx, dy);
      const rate = dt > 0 ? moved / dt : 0;
      if (rate < HUNT_MOVE_RATE) {
        this._huntStill = Math.min(HUNT_MAX_STILL, this._huntStill + dt);
      } else {
        this._huntStill = Math.max(0, this._huntStill - dt * HUNT_DECAY);
      }
      this._prevHuntX = this.x;
      this._prevHuntY = this.y;
    }
    // ECHOER reads this via getPositionAgo (enemy-echoer.js).
    if (!this._posHistory) this._posHistory = [];
    // Age is relative to now: bump by dt, push the new sample at 0.
    const PLAYER_HISTORY_WINDOW = 1.6; // seconds — must exceed ECHOER_LOOKBACK
    for (let i = 0; i < this._posHistory.length; i++) this._posHistory[i].t += dt;
    this._posHistory.push({ t: 0, x: this.x, y: this.y });
    // Oldest first after the age bump, so one shift loop drops the expired head.
    while (this._posHistory.length > 1 && this._posHistory[0].t > PLAYER_HISTORY_WINDOW) {
      this._posHistory.shift();
    }
    this.invincibleTimer=Math.max(0,this.invincibleTimer-dt);
    // SPAWN GRACE: brief floor-entry invulnerability window (set by loadFloor
    // on fresh transitions, value SPAWN_GRACE_DUR seconds). isPlayerDamageImmune()
    // ORs this in so all damage paths — env hazards (PLASMA/ARC/TOXIC/Frost),
    // mob contact, projectiles, AoE — are uniformly blocked while > 0.
    this._spawnGraceTimer=Math.max(0,(this._spawnGraceTimer||0)-dt);
    this.shootCooldown=Math.max(0,this.shootCooldown-dt);
    this.bombCooldown=Math.max(0,this.bombCooldown-dt);
    this.flashTimer=Math.max(0,this.flashTimer-dt);
    this.levelFlash=Math.max(0,this.levelFlash-dt);
    this.dashCooldown=Math.max(0,this.dashCooldown-dt);
    // Must tick or the first dash's bonus i-frames never expire. isPlayerDamageImmune reads this.
    this._dashIFrameTimer = Math.max(0, (this._dashIFrameTimer || 0) - dt);
    // Jam is set by updateNullifierJam before this tick. Without the gate the
    // cooldown would tick inside the aura and a camp-then-dash would bypass the mob.
    if (!this.disruptionFieldActive && !this.hackwareJammed) this.hackwareCooldown=Math.max(0,this.hackwareCooldown-dt);
    if (this.cloakTimer > 0) {
      this.cloakTimer -= dt;
      if (rand('cosmetic') < dt * 6) spawnParticles(this.x, this.y, 'MUZZLE', '#cc44ff', 1);
      if (this.cloakTimer <= 0) {
        this.cloakTimer = 0;
        audio.hackwareCloakEnd();
        spawnParticles(this.x, this.y, 'EXPLOSION', '#cc44ff', 8);
        _EG.msg('◇ CLOAK EXPIRED', '#886699');
      }
    }
    if (this.speedTimer>0) { this.speedTimer-=dt; if(this.speedTimer<=0)this.speedBoost=0; }
    if (this.burnTimer > 0) {
      const tick = Math.min(dt, this.burnTimer);
      this.burnTimer -= dt;
      if (!isPlayerDamageImmune() && this.invincibleTimer <= 0) {
        const bdmg = this.burnDps * tick;
        this.takeDamage(bdmg, 'Burn', { ignoreInvincible:true, ignoreImmunity:true, ignoreShield:true,
          ignoreDefense:true, skipHitInvincible:true, skipHitEffects:true, skipReactiveArmor:true });
        if (rand('cosmetic') < tick * 5) spawnParticles(this.x, this.y, 'MUZZLE', '#ff6600', 1);
      }
      if (this.burnTimer <= 0) { this.burnTimer = 0; this.burnDps = 0; }
    }
    if (this.shockTimer > 0) {
      this.shockTimer -= dt;
      if (rand('cosmetic') < dt * 8) spawnParticles(this.x, this.y, 'SPARK', '#ffee44', 1);
      if (this.shockTimer <= 0) this.shockTimer = 0;
    }
    if (this.adrenalineTimer > 0) this.adrenalineTimer = Math.max(0, this.adrenalineTimer - dt);
    if (this.reactiveArmorCD > 0) this.reactiveArmorCD = Math.max(0, this.reactiveArmorCD - dt);
    // Hitting 0 breaks the chain; the next kill only seeds a new window.
    if (this._chainBuffTimer > 0) this._chainBuffTimer = Math.max(0, this._chainBuffTimer - dt);
    // Active window and lockout tick in parallel; a new trigger needs lastStandCD <= 0.
    if (this.lastStandTimer > 0) this.lastStandTimer = Math.max(0, this.lastStandTimer - dt);
    if (this.lastStandCD > 0) this.lastStandCD = Math.max(0, this.lastStandCD - dt);
    if (this.retributionTimer > 0) this.retributionTimer = Math.max(0, this.retributionTimer - dt);
    // Timeout clear only. Target-switch reset is in Enemy.takeDamage, so a stale target can't survive a long disengage.
    if (this._hotHandTimer > 0) {
      this._hotHandTimer = Math.max(0, this._hotHandTimer - dt);
      if (this._hotHandTimer <= 0) {
        this._hotHandStreak = 0;
        this._hotHandLastTarget = null;
      }
    }
    NEON.behavior.tickMomentum(this, dt);
    // Tick timed boost windows (HARVEST_SURGE, etc.) — clears the activeBoosts
    // flag exactly when the timer expires so multipliers flip back the same
    // frame. Floor-duration boosts (COMBAT_STIM, etc.) are unaffected.
    if (NEON.boosts && NEON.boosts.tickBoosts) NEON.boosts.tickBoosts(this, dt);
    // _outOfCombatTimer resets in takeDamage on real damage.
    NEON.behavior.tickOutOfCombatRegen(this, dt);

    for (let i=this.dashTrail.length-1;i>=0;i--) {
      this.dashTrail[i].alpha-=dt*4;
      if (this.dashTrail[i].alpha<=0) this.dashTrail.splice(i,1);
    }

    // Depenetrate before moving: knockbacks run after player.update and may
    // have left the agent's centre inside a wall last frame.
    if (!playerCheatEnabled('noClip')) depenetratePlayer(this, map);

    if (this.dashTimer>0) {
      const step=Math.min(dt,this.dashTimer); // clamp to remaining dash time
      this.dashTimer-=dt;
      const dashSpd=18; // tiles/sec during dash
      const nx=this.x+this.dashDx*dashSpd*step;
      const ny=this.y+this.dashDy*dashSpd*step;
      const tx=Math.floor(nx), ty=Math.floor(this.y);
      const ox=Math.floor(this.x), oy=Math.floor(ny);
      const dashPrevX=this.x, dashPrevY=this.y;
      const noClip = playerCheatEnabled('noClip');
      if (tx>=0&&ty>=0&&tx<MAP_W&&ty<MAP_H && (noClip || playerTilePassable(this, map[ty][tx], tx, ty, true))) this.x=nx;
      else this.dashTimer=0; // hit wall, end dash early
      if (ox>=0&&oy>=0&&ox<MAP_W&&oy<MAP_H && (noClip || playerTilePassable(this, map[oy][ox], ox, oy, true))) this.y=ny;
      else this.dashTimer=0;
      if (!noClip) resolvePlayerCornerCut(this, map, dashPrevX, dashPrevY, true);
      if (this.dashTrail.length < 8) this.dashTrail.push({x:this.x,y:this.y,alpha:0.7});
      this.invincibleTimer=Math.max(this.invincibleTimer, 0.05); // i-frames during dash
      spawnParticles(this.x,this.y,'SPARK','#ffb700',1);
      return; // skip normal movement during dash
    }

    if (this.perks.ENERGY_SHIELD && !this.energyShield && this.energyShieldTimer>0) {
      this.energyShieldTimer-=dt;
      if (this.energyShieldTimer<=0) {
        this.energyShield=true;
        this.energyShieldTimer=0;
        audio.shieldRestore();
        _EG.msg('🛡 SHIELD RESTORED','#4488ff');
      }
    }

    if (this.hp > 0 && this.hp / this.maxHp <= 0.25) {
      this.lowHpTimer -= dt;
      if (this.lowHpTimer <= 0) { audio.lowHealth(); this.lowHpTimer = 2; }
    } else { this.lowHpTimer = 0; }

    if (this.perks.HP_REGEN && this.hp > 0 && this.hp < this.maxHp) {
      this.regenTimer += dt;
      if (this.regenTimer >= 3) {
        this.regenTimer -= 3;
        this.hp = Math.min(this.maxHp, this.hp + 1);
        spawnDmgText(this.x, this.y, '+1', '#00ff88');
      }
    }

    // REPAIR_PROTOCOL hackware HoT: heal 4 HP every 1s, 4 ticks. Tick
    // continues across floor descend (not gated on map state) so a
    // pre-descend activation finishes on the new floor — matches
    // hackwareCooldown which also persists across floors. Halts on death.
    if (this._repairTicksLeft > 0 && this.hp > 0) {
      this._repairTickTimer -= dt;
      if (this._repairTickTimer <= 0) {
        this._repairTickTimer += 1.0;
        this._repairTicksLeft -= 1;
        if (this.hp < this.maxHp) {
          const heal = Math.min(4, this.maxHp - this.hp);
          this.hp += heal;
          spawnDmgText(this.x, this.y, '+'+heal, '#00ff88');
          spawnParticles(this.x, this.y, 'SPARK', '#00ff88', 3);
        }
      }
    } else if (this._repairTicksLeft <= 0 && this._repairTickTimer !== 0) {
      this._repairTickTimer = 0;
    }

    // Timer expiry (not a hit) also zeroes bubbleHp. Not gated on hp > 0; a hit-break already zeroes both in takeDamage.
    if (this.bubbleTimer > 0) {
      this.bubbleTimer -= dt;
      if (this.bubbleTimer <= 0) {
        this.bubbleTimer = 0;
        if (this.bubbleHp > 0) {
          this.bubbleHp = 0;
          spawnDmgText(this.x, this.y, 'BUBBLE EXPIRED', '#e0e0ff');
          spawnParticles(this.x, this.y, 'SPARK', '#e0e0ff', 6);
        }
      }
    }

    let spd=modSpeed(this.spd+(this.speedBoost||0)+(this.permSpeedBonus||0));
    if (this.adrenalineTimer > 0) spd *= 1.3;
    if (this.perks.ADRENALINE) spd *= 1.2;
    spd *= NEON.boosts.getBoostSpeedMul(this);
    if (playerCheatEnabled('hyperMode')) spd *= 2;
    if (this.toxicSlowActive && this.dashTimer <= 0) spd *= 0.7; // 30% slow while in toxic pool
    if (this.disruptionFieldActive && this.dashTimer <= 0) spd *= 0.8; // 20% slow in disruption field
    // TETHER leash field: accumulator set by aiTether() the previous
    // frame. Dash i-frames bypass (consistent with toxic/disruption).
    // Consume-and-reset so a dead/destroyed TETHER stops slowing the
    // player on the very next frame with no extra cleanup needed.
    if (this.dashTimer <= 0 && this._tetherSlowFactor != null && this._tetherSlowFactor < 1) {
      spd *= this._tetherSlowFactor;
    }
    this._tetherSlowFactor = 1;
    let mx=0,my=0;
    if (keys.has(km('up'))||keys.has(ALT_KEYS.up))       my=-1;
    if (keys.has(km('down'))||keys.has(ALT_KEYS.down))   my= 1;
    if (keys.has(km('left'))||keys.has(ALT_KEYS.left))   mx=-1;
    if (keys.has(km('right'))||keys.has(ALT_KEYS.right)) mx= 1;
    if (touch.joystick.active) { mx+=touch.joystick.dx; my+=touch.joystick.dy; }

    // Shocked: suppress movement (can still aim and shoot)
    if (this.shockTimer > 0) { mx = 0; my = 0; }

    if (mx||my) {
      const [ndx,ndy]=norm(mx,my);
      const nx=this.x+ndx*spd*dt;
      const ny=this.y+ndy*spd*dt;
      const tx=Math.floor(nx), ty=Math.floor(this.y);
      const ox=Math.floor(this.x),oy=Math.floor(ny);
      const walkPrevX=this.x, walkPrevY=this.y;
      const noClip = playerCheatEnabled('noClip');
      if (tx>=0&&ty>=0&&tx<MAP_W&&ty<MAP_H && (noClip || playerTilePassable(this, map[ty][tx], tx, ty, false))) this.x=nx;
      if (ox>=0&&oy>=0&&ox<MAP_W&&oy<MAP_H && (noClip || playerTilePassable(this, map[oy][ox], ox, oy, false))) this.y=ny;
      if (!noClip) resolvePlayerCornerCut(this, map, walkPrevX, walkPrevY, false);
      this.facing={x:ndx,y:ndy};
    }

    if (this.dashTimer <= 0 && this.shockTimer <= 0) {
      let pullX = 0, pullY = 0;
      for (const w of gravityWells) {
        if (w.dead) continue;
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
        if (!this.gravityPullActive) audio.gravitonPull();
        this.gravityPullActive = true;
        const pnx = this.x + pullX * dt;
        const pny = this.y + pullY * dt;
        const ptx = Math.floor(pnx), pty = Math.floor(this.y);
        const pox = Math.floor(this.x), poy = Math.floor(pny);
        const pullPrevX = this.x, pullPrevY = this.y;
        if (ptx >= 0 && pty >= 0 && ptx < MAP_W && pty < MAP_H && isPassable(map[pty][ptx])) this.x = pnx;
        if (pox >= 0 && poy >= 0 && pox < MAP_W && poy < MAP_H && isPassable(map[poy][pox])) this.y = pny;
        if (!playerCheatEnabled('noClip')) resolvePlayerCornerCut(this, map, pullPrevX, pullPrevY, false);
      } else {
        this.gravityPullActive = false;
      }
    } else {
      this.gravityPullActive = false;
    }

    if (jp(km('voidshard'))) this.tapBombKey();
    if (jp(km('hackware'))) activateHackware(this);
    if (jp('WheelDown')) { this.cycleWeapon(1); try { audio.menuSelect(); } catch(_){} }
    if (jp('WheelUp'))   { this.cycleWeapon(-1); try { audio.menuSelect(); } catch(_){} }
    if (this.weapons && this.weapons.length > 1) {
      for (let wi = 0; wi < Math.min(this.weapons.length, 3); wi++) {
        if (jp('Digit' + (wi + 1))) { this.weaponIdx = wi; this.weapon = this.weapons[wi]; this.shootCooldown = 0; try { audio.menuSelect(); } catch(_){} }
      }
    }

    if ((jp(km('dash'))||jp(ALT_KEYS.dash))&&this.dashCooldown<=0&&this.hp>0) {
      let dx, dy;
      if (mx||my) {
        [dx,dy]=norm(mx,my);
      } else if (settings.lockAimToMove) {
        // Lock-aim mode: ignore mouse, dash in last-walked direction
        dx=this.facing.x; dy=this.facing.y;
      } else {
        // mouse.x/y are already logical px (normalised in src/platform.js); world tiles are (mouse + cam) / TILE, no zoom factor.
        const cam=getCamera(this);
        const ax=(mouse.x+cam.x)/TILE-this.x, ay=(mouse.y+cam.y)/TILE-this.y;
        [dx,dy]=norm(ax,ay);
        if (!dx&&!dy) { dx=this.facing.x; dy=this.facing.y; }
      }
      this.dashDx=dx; this.dashDy=dy;
      this.dashTimer=0.12;
      this._dashSerial = (this._dashSerial | 0) + 1;
      // Movement ends at dashTimer === 0; this timer keeps immunity for the bonus
      // window after that. Always set, so bonus 0 matches dashTimer.
      this._dashIFrameTimer = 0.12 + (this.dashIFrameBonus || 0);
      const baseCd = this.perks.DASH_MASTER ? 0.75 : 1.5;
      // Multiplies the already-reduced base cooldown. Floor modifiers don't stack.
      const kineticMul = (_EG.modifier === 'KINETIC') ? 0.7 : 1;
      this.dashCooldown = baseCd * ((this.metaFlags && this.metaFlags.dashCooldownMul) || 1) * kineticMul;
      this.dashTrail.push({x:this.x,y:this.y,alpha:0.8});
      audio.dash();
      spawnParticles(this.x,this.y,'EXPLOSION','#ffb700',6);
    }

    // tiles/sec so frame rate doesn't change stacks. Dash frames return early and do not count as continuous movement.
    if (this.perks.STRIDE && dt > 0) {
      const moved = dist(this._prevX, this._prevY, this.x, this.y);
      const rate = moved / dt;
      if (rate >= STRIDE_MOVE_RATE && this.shockTimer <= 0) {
        this._strideStillTime = 0;
        if ((this._strideStacks || 0) < STRIDE_MAX_STACKS) {
          this._strideMovingTime = (this._strideMovingTime || 0) + dt;
          while (this._strideMovingTime >= STRIDE_PER_STACK && this._strideStacks < STRIDE_MAX_STACKS) {
            this._strideStacks = (this._strideStacks || 0) + 1;
            this._strideMovingTime -= STRIDE_PER_STACK;
          }
          if (this._strideStacks >= STRIDE_MAX_STACKS) this._strideMovingTime = 0;
        } else {
          this._strideMovingTime = 0;
        }
      } else {
        this._strideStillTime = (this._strideStillTime || 0) + dt;
        if (this._strideStillTime > STRIDE_RESET_GRACE) {
          this._strideStacks = 0;
          this._strideMovingTime = 0;
        }
      }
    }

    // tiles/sec. Dash frames return early and neither advance nor clear the charge.
    // shockTimer is gated because force-zeroed movement would otherwise charge the
    // shot. Ready latches until shoot(); moving only cancels a partial charge.
    if (this.perks.DEADEYE && dt > 0) {
      const movedD = dist(this._prevX, this._prevY, this.x, this.y);
      const rateD = movedD / dt;
      if (rateD < DEADEYE_MOVE_RATE && this.shockTimer <= 0) {
        if (!this._steadyReady) {
          this._steadyChargeTime = (this._steadyChargeTime || 0) + dt;
          if (this._steadyChargeTime >= DEADEYE_CHARGE_TIME) {
            this._steadyReady = true;
            this._steadyChargeTime = 0;
          }
        }
      } else {
        this._steadyChargeTime = 0;
      }
    }
  }

  /**
   * @param {any} [camX]
   * @param {any} [camY]
   */
  draw(camX,camY) {
    const sx=this.x*TILE-camX, sy=this.y*TILE-camY;
    const col=this.flashTimer>0?(_EG._damageFlash||'#ffffff'):'#00f5ff';

    for (const g of this.dashTrail) {
      const gx=g.x*TILE-camX, gy=g.y*TILE-camY;
      ctx.save();
      ctx.globalAlpha=g.alpha*0.5;
      ctx.fillStyle='#ffb700';
      ctx.shadowBlur=8; ctx.shadowColor='#ffb700';
      NEON.draw.circle(ctx, gx, gy, 7);
      ctx.restore();
    }

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
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = lc;
      ctx.shadowBlur = 8; ctx.shadowColor = lc;
      ctx.lineWidth = 1;
      ctx.setLineDash([4,4]);
      NEON.draw.line(ctx, sx, sy, ex, ey);
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = lc;
      NEON.draw.circle(ctx, ex, ey, 2.5);
      ctx.restore();
    }

    if (this.autoLaserBeam) {
      const b = this.autoLaserBeam;
      const alpha = b.timer / 0.15;
      ctx.save();
      ctx.globalAlpha = alpha * 0.6;
      ctx.strokeStyle = '#ff2222';
      ctx.shadowBlur = 14; ctx.shadowColor = '#ff2222';
      ctx.lineWidth = 2.5;
      NEON.draw.line(ctx, b.x1*TILE-camX, b.y1*TILE-camY, b.x2*TILE-camX, b.y2*TILE-camY);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#ffffff';
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1;
      NEON.draw.line(ctx, b.x1*TILE-camX, b.y1*TILE-camY, b.x2*TILE-camX, b.y2*TILE-camY);
      ctx.restore();
    }

    ctx.save();
    if (this.cloakTimer > 0) {
      const flicker = 0.15 + Math.sin(performance.now() * 0.01) * 0.1;
      ctx.globalAlpha = flicker;
    }
    ctx.shadowBlur=15; ctx.shadowColor=this.cloakTimer > 0 ? '#cc44ff' : col;
    ctx.fillStyle=this.cloakTimer > 0 ? '#cc44ff' : col;
    NEON.draw.circle(ctx, sx, sy, 7);
    ctx.shadowBlur=5;
    ctx.fillStyle='#ffffff';
    NEON.draw.circle(ctx, sx+this.facing.x*7, sy+this.facing.y*7, 2.5);
    ctx.restore();

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
    // Opacity tracks remaining bubbleHp. Slower pulse and larger radius than the
    // perk ring so both can show at once. Requires hp and timer so a half-cleared
    // bubble doesn't draw.
    if (this.bubbleHp > 0 && this.bubbleTimer > 0) {
      ctx.save();
      const frac = Math.max(0.15, this.bubbleHp / 35);
      const pulse = 0.10 * Math.sin(performance.now() * 0.006);
      // Canvas ignores globalAlpha outside [0,1] and keeps the previous value, so an unclamped trough would flash the ring at full opacity.
      ctx.globalAlpha = Math.max(0, Math.min(1, 0.30 * frac + pulse));
      ctx.strokeStyle = '#e0e0ff';
      ctx.shadowBlur = 14; ctx.shadowColor = '#e0e0ff';
      ctx.lineWidth = 2.0;
      NEON.draw.circleStroke(ctx, sx, sy, 14);
      ctx.restore();
    }
    if (this.burnTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(performance.now() * 0.012) * 0.15;
      ctx.shadowBlur = 16; ctx.shadowColor = '#ff6600';
      ctx.fillStyle = '#ff6600';
      NEON.draw.circle(ctx, sx, sy, 10);
      ctx.restore();
    }
    if (this.shockTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(performance.now() * 0.04) * 0.3;
      ctx.shadowBlur = 18; ctx.shadowColor = '#ffee44';
      ctx.fillStyle = '#ffee44';
      NEON.draw.circle(ctx, sx, sy, 9);
      ctx.restore();
    }
    // Keep in sync with isPlayerDamageImmune()'s spawn-grace branch in src/content.js.
    if (this._spawnGraceTimer > 0) {
      ctx.save();
      const t = this._spawnGraceTimer;
      const pulse = 0.35 + Math.sin(performance.now() * 0.012) * 0.2;
      ctx.globalAlpha = Math.min(1, t / 0.4) * pulse;
      ctx.strokeStyle = '#88ffff';
      ctx.shadowBlur = 14; ctx.shadowColor = '#88ffff';
      ctx.lineWidth = 1.5;
      NEON.draw.circleStroke(ctx, sx, sy, 14);
      NEON.draw.circleStroke(ctx, sx, sy, 17 + Math.sin(performance.now() * 0.008) * 1.5);
      ctx.restore();
    }
  }
}
