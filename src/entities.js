// @ts-check
'use strict';

// ─── Enemies ─────────────────────────────────────────────────────────────────

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
    this.grenadeTimer=0;   // GRENADIER: cooldown between lobs
    // Elite affix state
    this.eliteAffix=null;
    this.shieldHp=0; this.shieldMax=0; this.shieldRegenDelay=0;
    this.phaseTimer=0; this.phaseImmune=false;
    this.frenzyStacks=0; // FRENZY affix: stacks gained from nearby ally deaths (max 2)
    this.predatorBuffTimer=0; // PREDATOR affix: refresh-only countdown (s) — set by notifyPredatorElites() when player takes real HP damage within 8t
    // Weapon affix status effects
    this.burnTimer=0; this.burnDps=0;
    this.slowTimer=0; this.slowFactor=1;  // 1 = normal speed
    this.stunTimer=0;                     // hackware EMP stun duration
    this._markedTimer=0;                  // MARK 'of Marking' affix: while >0, marking weapon hits +30%
    this._lastHitCtx=null;                // weapon context of last hit (for on-kill effects)
    // Holo Decoy taunt redirection
    this._tauntTarget=null;               // active hologram effect (or null)
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
    // PHASING elite affix / SPECTRE phase: damage absorbed, BUT stun-only
    // weapon effects (Voltaic 'shock') must still apply so the EMP/Shock
    // counterplay reaches phase-immune mobs. Without this, a shock shot at
    // a phased SPECTRE shows 'PHASE' and never sets stunTimer — the
    // designed "stun forces manifest" path can't trigger from shock weapons.
    //
    // _wrPhased (WRAITH/TUNNELLER) shares the absorb shape and routes
    // through the same helper — but note that player projectiles and melee
    // explicitly SKIP _wrPhased enemies in content.js (~line 3411) /
    // entities.js (~line 9588) before calling takeDamage, so shock weapons
    // can't reach a phased WRAITH at all by design. The branch still
    // applies to non-projectile damage paths (NEXUS feedback, etc.) for
    // consistency.
    if (this.phaseImmune || this._wrPhased) {
      _applyStunOnlyEffects(this, hitCtx);
      const label = this._wrPhased ? 'PHASED' : 'PHASE';
      const colour = this._wrPhased ? '#66ffcc' : '#cc88ff';
      spawnDmgText(this.x, this.y, label, colour);
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
    // MARK 'of Marking' affix: a Marking-weapon hit landing on an enemy
    // that already carries a live mark deals +30%. Multiplier is applied
    // here at the top of damage processing — BEFORE SHIELDED/shieldGen/
    // NEXUS DR — so the bonus follows the same mitigation path as the base
    // hit (no double-counting against shields, no rounding drift). Gates:
    //   ctx.effects?.includes('mark') — only the affix's own weapon
    //     benefits; a different weapon's hit on a marked enemy does not
    //     get a free +30% (keeps the affix self-contained).
    //   !ctx.isProc — chain/ricochet/explode procs don't double-dip the
    //     bonus. Mark APPLICATION is also gated on !ctx.isProc one frame
    //     later via the `if (!ctx.isProc) applyHitEffects(...)` line, so
    //     procs neither apply nor benefit from marks.
    //   enemy._markedTimer > 0 — the very first hit from a Marking weapon
    //     gets no bonus (it's the one that *applies* the mark). Follow-up
    //     hits within the 3s window get +30%.
    {
      const _mctx = typeof hitCtx === 'string' ? null : hitCtx;
      if (_mctx && !_mctx.isProc && this._markedTimer > 0
          && _mctx.effects && _mctx.effects.indexOf && _mctx.effects.indexOf('mark') !== -1) {
        dmg = Math.round(dmg * 1.30);
      }
    }
    // EXPLOITER perk: +25% damage to enemies suffering ANY status effect
    // (burning / slowed / stunned / marked). Applied at the top of damage
    // processing — same chokepoint as the MARK affix above — BEFORE
    // SHIELDED/shieldGen/NEXUS DR so the bonus follows the same mitigation
    // path as the base hit (no double-counting against shields, no rounding
    // drift). Multiplicative on top of MARK's +30% by design: a Marking
    // build that lands a follow-up hit on a marked target with EXPLOITER
    // gets both modifiers (each gates on independent state).
    //
    // Gates:
    //   _EG.player.perks.EXPLOITER — only when player owns the perk.
    //   !ctx.isProc — chain/ricochet/explode procs don't double-dip
    //     (mirrors MARK and the broader on-hit chokepoint convention).
    //     ctx may be a string (legacy) or undefined; both lack `.isProc`
    //     so they pass the gate as direct hits, which is correct.
    //   Status check — any of burnTimer/slowTimer/stunTimer/_markedTimer/
    //     poisonTimer > 0. enemy.shockTimer is intentionally NOT checked:
    //     shockTimer is a player-only field (see entities.js:10515
    //     Player.shockTimer); enemies don't carry it. _wrPhased /
    //     phaseImmune already returned early above, so they can't reach
    //     here regardless. poisonTimer (TOXIC affix, added 2026-04-28)
    //     mirrors burn's status semantics — both are DoT timers that
    //     bypass takeDamage via direct hp -= so neither double-dips with
    //     EXPLOITER on the DoT itself, only on the player's direct hits
    //     against the debuffed target.
    //
    // Note: burn DoT at entities.js:1219 does direct `enemy.hp -= dmg` and
    // BYPASSES takeDamage, so EXPLOITER does NOT amplify burn ticks — only
    // the player's direct hits on burning enemies. This is by design (the
    // perk rewards the player for pressing advantage on debuffed targets,
    // not for stacking with environmental DoT).
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
    // PROXIMITY floor modifier: enemies within 4 tiles of the player take
    // +30% damage on this floor. Applied at the same chokepoint as MARK,
    // EXPLOITER, and HOT_HAND above — BEFORE shield/shieldGen/NEXUS DR —
    // so the bonus follows the standard mitigation pipeline. Multiplicative
    // on top of MARK/EXPLOITER/HOT_HAND by design (each gates on
    // independent state).
    //
    // Gates:
    //   _EG.modifier === 'PROXIMITY' — modifier-roll only; off-floor and
    //     other-modifier runs see no behavior change. Reads via the
    //     _EG proxy so floor swaps and tests-without-game-bound-state
    //     both resolve correctly (mirrors REGENERATIVE/CASCADE/WINDFALL/
    //     SIGNAL_BOOST sites above and below).
    //   !_isProc — chain/ricochet/explode procs that EXPLICITLY pass
    //     `{ isProc: true }` don't double-dip the bonus (same convention
    //     as MARK and EXPLOITER). NOTE: legacy string-context proc paths
    //     (e.g. 'Explosion', 'Neural Feedback', 'Volatile Elite' at
    //     entities.js ~2651/2679/2727) become _pctx=null → _isProc=false,
    //     so they DO receive the PROXIMITY amp — exactly matching the
    //     EXPLOITER precedent. This is intentional: those legacy proc
    //     ctxs are environmental/secondary damage that the player
    //     positionally chose to be near, so the close-range bonus is
    //     thematically apt. A future refactor that converts those paths
    //     to object ctx with `isProc:true` would correctly tighten BOTH
    //     EXPLOITER and PROXIMITY in lockstep.
    //   _EG.player + dist(player, this) < 4 — radius gate. Math.sqrt
    //     returns a finite non-negative number for any finite dx/dy, so
    //     no NaN propagation. Player x/y are world-tile coordinates
    //     (same units as enemy x/y), so the 4-tile literal is unitless
    //     world-distance.
    //
    // Note: ally-turret / Plasma Orb / Sentry Drone hits also pass through
    // Enemy.takeDamage. They benefit from PROXIMITY when the ENEMY they
    // hit is within 4 tiles of the player (regardless of where the shot
    // originated) — by design. The modifier rewards the player for
    // POSITIONING (where they stand relative to enemies), not for
    // attribution (who fired the shot). This matches the EXPLOITER
    // precedent: any direct hit on a status-debuffed enemy gets the
    // bonus, regardless of damage source.
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
    // HOT_HAND perk: per-target consecutive-hit damage stack. Applied at
    // the same chokepoint as MARK and EXPLOITER above — BEFORE shield/
    // shieldGen/NEXUS DR — so the bonus follows the standard mitigation
    // pipeline. Multiplicative on top of MARK and EXPLOITER by design.
    //
    // Gates (stricter than EXPLOITER because HOT_HAND MUTATES player
    // state; we cannot let enemy-on-enemy collateral, environmental
    // damage, or PLAYER-ALIGNED-BUT-AUTONOMOUS damage incorrectly
    // attribute hits to the player's streak):
    //   _EG.player.perks.HOT_HAND — only when player owns the perk.
    //   typeof hitCtx === 'object' (via _hctx null-check) — string ctx
    //     ('Volatile', 'Bomb', 'Auto-Laser', 'Saw Blade', 'Tunneller
    //     Eruption', etc.) is NOT player-attributable to a streak.
    //   !_hctx.isProc — chain/ricochet/explode procs don't double-dip
    //     and don't increment the streak (same convention as MARK and
    //     EXPLOITER). Otherwise a chain proc hitting 5 enemies in one
    //     frame would alternately reset and re-target the streak.
    //   _hctx.fromPlayerShot — explicit attribution flag set ONLY by
    //     Player.shoot()'s melee branch and the player's intentional
    //     ranged projectiles (entities.js:11147 + ~11199 + ~11219). The
    //     flag is NOT propagated to:
    //       • Hacked wall turret / decoy turret projectiles (ally
    //         turrets that share the projectile-vs-enemy collision path
    //         at content.js:3770, but spawn outside Player.shoot)
    //       • Plasma Orb / Sentry Drone auto-fire (game.js per-frame
    //         spell ticks, also outside Player.shoot)
    //       • Auto-Laser / Saw Blade (already filtered — string ctx)
    //       • Reflected/parried/reverse-polarity flipped projectiles
    //         (the flip path doesn't set the flag, and the underlying
    //         projectile started as an ENEMY shot with flag=false)
    //     This matches the perk's "Hot Hand" thematic — it rewards the
    //     player's intentional aimed fire / melee, not passive auto-fire.
    //     The Projectile pool (content.js:3570) explicitly resets
    //     fromPlayerShot=false in _init so a stale flag from a prior
    //     pooled occupant cannot leak into a freshly-spawned enemy or
    //     turret projectile.
    //
    // Streak update happens AFTER the damage multiplier is applied so
    // the current hit reads the streak from the PREVIOUS hits. Order:
    //   1. Read current streak (or 0 if target switched / window expired)
    //   2. Apply bonus = min(streak, MAX_STACKS) * PER_STACK
    //   3. Increment streak for this hit, refresh window timer
    //   4. Update _hotHandLastTarget to this enemy
    //
    // _wrPhased / phaseImmune already returned early at the top of
    // takeDamage, so they can't reach here. _disguised mimics force-
    // reveal earlier (wasDisguised capture), so the first-hit reveal
    // does count toward the streak — that's fine, it WAS a real hit.
    {
      const _hctx = typeof hitCtx === 'string' ? null : hitCtx;
      const _hpc = _EG.player;
      if (_hctx && !_hctx.isProc && _hctx.fromPlayerShot && _hpc && _hpc.perks && _hpc.perks.HOT_HAND) {
        // Target-switch reset: a different enemy reference clears the
        // streak BEFORE we read it, so the first hit on a new target
        // gets +0% (streak=0 → bonus=0), not the last target's bonus.
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
    // REGENERATIVE floor modifier: any actual damage resets the
    // out-of-combat regen timer. Gated on `actual > 0` so 0-dmg glance
    // hits, fully-shield-absorbed hits (which return early above), and
    // phased absorbs (which also return early) don't reset the clock.
    // Gated on the modifier so non-REGENERATIVE floors don't pay the
    // hidden-class transition cost of writing _regenTimer on every hit.
    if (actual > 0 && _EG.modifier === 'REGENERATIVE') this._regenTimer = 0;
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
    // VAULTMASTER coin ejection — economic verb. Every survived hit
    // ejects one small VaultCoin pickup (ICD-throttled so multi-pellet
    // weapons can't money-print on a single attack). Gated on
    // `actual > 0` and `!this.dead` so cosmetic / 0-damage hits don't
    // print currency, and the death-jackpot is the only drop on the
    // killing blow (consistent with MAGPIE/HARVESTER drop-on-death).
    // No coins from PHANTOM-cloak or PHASING absorb paths because both
    // already returned 0 above before reaching this point.
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
    // GHOST_PROJECTOR haunt hook — must fire BEFORE the _despawning early
    // return so a non-summon kill in a room with a projector arms a haunt
    // even if the kill came via cascade-adjacent paths. The hook itself
    // gates on _summoned/_ghIsGhost/isShard/isBoss/type.
    notifyGhostProjectors(this);
    notifyVengeance(this);
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
    } else if (!this.isShard && !isSummon && rand('loot') < dropRate) {
      items.push(new Item(this.x,this.y));
    }
    // HARVESTER guaranteed temp-buff drop. Standing rule: mob drops are temp
    // or currency only, never permanent power-ups (HARVEST_SURGE = +50% dmg
    // for 8s, decays after 5s if uncollected). Excludes summons (no add-table
    // currently spawns HARVESTER, but the gate matches the generic drop rule
    // for defence in depth) and shards (HARVESTER never splits, but same
    // rationale). Spawned IN ADDITION TO the random Item roll above so the
    // pickup does not crowd out the normal drop economy.
    if (this.type === 'HARVESTER' && !isSummon && !this.isShard) {
      items.push(new HarvestPickup(this.x, this.y));
    }
    // MAGPIE hoard drop. The thief mob bankss credit value from each
    // generic Item it consumed during its life (`_mgStolenCr`); on
    // death we hand that value back as a MagpieHoard pickup so killing
    // the thief recovers what was stolen. Excludes summons / shards
    // for the same reason as the generic Item drop above (defensive —
    // no current code path summons MAGPIEs, but the gate stays in
    // sync with the design rule). If MAGPIE never grabbed anything,
    // _mgStolenCr stays 0 and we drop nothing extra (normal credit
    // reward from CREDIT_VALUES still applies).
    if (this.type === 'MAGPIE' && !isSummon && !this.isShard) {
      const stolen = this._mgStolenCr || 0;
      if (stolen > 0) {
        items.push(new MagpieHoard(this.x, this.y, stolen));
      }
    }
    // VAULTMASTER death jackpot — guaranteed flat-amount VaultCoin drop
    // on death so milking-vs-kill is a real economic choice (small per-hit
    // coins build up + jackpot on kill). Excludes summons / shards for
    // the same defence-in-depth reason as MAGPIE / HARVESTER above; no
    // current code path summons VAULTMASTER and it never splits, but the
    // gate stays in sync with the design rule. The jackpot is auto-collected
    // via the isHoard pickup branch in game.js (same as MagpieHoard).
    if (this.type === 'VAULTMASTER' && !isSummon && !this.isShard) {
      items.push(new VaultCoin(this.x, this.y, VAULTMASTER_JACKPOT_AMT));
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
    // GREEDY 'of Greed' suffix — bonus +50% credits on kill from a Greedy
    // weapon. Mirrors DETONATE's on-kill model: gates on _lastHitCtx with
    // !isProc so a non-Greedy proc finishing the enemy (THUNDER chain, etc.)
    // does NOT credit Greedy. Burn-DoT kills DO credit if the prior direct
    // hit was Greedy (entities.js:1232 unmarks isProc when there was a
    // prior ctx — same path DETONATE relies on). Skips summons/shards
    // (they already have cr=0 via baseCr=0 / no real owner) for defense
    // in depth. Bonus is rounded; sub-1 floors to 0 (no message, no
    // particle) so low-CR mobs don't show "+0 CR".
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
    // UNCHAINED #39: CORES drops on elite/boss kills. Summons / shard-split
    // enemies don't drop cores (same rule as items/credits). isBoss takes
    // precedence over elite so the boss amount is final.
    if (!isSummon && !this.isShard && typeof NEON !== 'undefined' && NEON.cores && NEON.cores.spawnCoreDrop) {
      let coreVal = 0;
      if (this.isBoss) {
        coreVal = (this.type === 'GENESIS') ? 10 : 5;
      } else if (this.elite) {
        coreVal = rndInt(1, 2, 'loot'); // 1–2 uniform
      }
      if (coreVal > 0) NEON.cores.spawnCoreDrop(game, this.x, this.y, coreVal);
    }
    // SALVAGE 'of Salvage' suffix — 10% chance on kill to drop 1 CORE.
    // Stacks ON TOP of the elite/boss core drop above (so a Salvage roll
    // on a regular grunt is the headline use case, but a Salvage roll on
    // an elite gets a 2nd drop). Mirrors GREEDY's on-kill model: gates on
    // _lastHitCtx with !isProc so a non-Salvage proc finishing the enemy
    // (THUNDER chain, EXPLOSIVE_KILLS, RICOCHET) does NOT roll for
    // Salvage. Burn-DoT kills DO credit if the prior direct hit was
    // Salvage (entities.js:1232 unmarks isProc — same path DETONATE
    // relies on). Skips summons/shards (same rule as the elite/boss core
    // drop block above). NEON.cores guard mirrors line 1953 so the path
    // is browser-only and can't crash node:test.
    const _sctx = this._lastHitCtx;
    if (_sctx && !_sctx.isProc && _sctx.effects && _sctx.effects.includes('salvage')
        && !this.isShard && !isSummon && rand('loot') < 0.10
        && typeof NEON !== 'undefined' && NEON.cores && NEON.cores.spawnCoreDrop) {
      NEON.cores.spawnCoreDrop(game, this.x, this.y, 1);
      spawnParticles(this.x, this.y, 'MUZZLE', '#44ffcc', 4);
    }
    // LUCKY 'of Luck' suffix — 8% chance on kill to drop a bonus Item.
    // Stacks ON TOP of the base random Item roll (line 1859) and the
    // bounty guaranteed drop, so a Lucky roll on a regular grunt is the
    // headline use case but a Lucky-bountied elite can yield 3 items.
    // Mirrors the on-defeat model used by GREEDY/SALVAGE/DETONATE: gates
    // on _lastHitCtx with !isProc so a non-Lucky proc finishing the
    // enemy (THUNDER chain, EXPLOSIVE_KILLS, RICOCHET) does NOT roll for
    // Luck. Burn-DoT kills DO credit if the prior direct hit was Lucky
    // (entities.js:1232 unmarks isProc — same path DETONATE relies on).
    // Skips summons/shards (same rule as the elite/boss core drop block
    // and the base Item drop at line 1859). 8% chance — slightly under
    // SALVAGE's 10% because Items (full pickups: weapons/armour/perks)
    // are higher-value than a 1-CORE drop, so the curve self-balances.
    const _lctx = this._lastHitCtx;
    if (_lctx && !_lctx.isProc && _lctx.effects && _lctx.effects.includes('lucky')
        && !this.isShard && !isSummon && rand('loot') < 0.08) {
      items.push(new Item(this.x, this.y));
      spawnParticles(this.x, this.y, 'MUZZLE', '#ffdd66', 4);
    }
    // PIERCING_HEART 'of Piercing Heart' suffix — +1 Max HP per qualifying
    // kill, hard-capped at +20 per run. Mirrors the on-kill model used by
    // GREEDY/SALVAGE/LUCKY: gates on _lastHitCtx with !isProc so a non-
    // PIERCING_HEART proc finishing the enemy (THUNDER chain, EXPLOSIVE_KILLS,
    // RICOCHET) does NOT credit the buff. Burn-DoT and TOXIC-DoT kills DO
    // credit if the prior direct hit was Piercing Heart (entities.js:1335
    // and :1383 unmark isProc — same path GREEDY/SALVAGE/LUCKY rely on).
    // Skips summons/shards (same defense-in-depth gate as the sibling
    // on-kill suffixes — without it, a phantom-summon farm would let
    // _piercingHearts cap in seconds).
    //
    // Cap rationale: 20 stacks = +25% effective HP for an 80-HP base, on
    // par with a META_UPGRADE max-hp tier, NOT runaway. Without the cap
    // a long bounty-rich floor would scale HP indefinitely. Counter
    // (`_piercingHearts`) lives on the player and is persisted in
    // saveGame's explicit field enumeration so save/resume preserves the
    // cap (without persistence, a quit-and-resume mid-run would let the
    // player re-earn the +20 from scratch).
    //
    // Heal +1 on the trigger so the gain is immediately usable AND
    // visible (raising a maxHp ceiling without filling it leaves the
    // player at the same HP, a non-feedback that obscures the proc).
    // Min(maxHp, hp+1) is defensive — should never matter since maxHp
    // was just bumped, but it keeps the invariant hp <= maxHp tight.
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
    // Vampiric perk: heal on kill
    if (_EG.player.perks.VAMPIRIC && !this.isShard) {
      const heal = 2;
      _EG.player.hp = Math.min(_EG.player.maxHp, _EG.player.hp + heal);
      spawnDmgText(_EG.player.x, _EG.player.y, '+'+heal, '#ff3366');
    }
    // SCAVENGER_NANITES augment: 10% kill chance to heal 5 HP
    if (hasAugment('SCAVENGER_NANITES') && !this.isShard && rand('loot') < 0.10) {
      _EG.player.hp = Math.min(_EG.player.maxHp, _EG.player.hp + 5);
      spawnDmgText(_EG.player.x, _EG.player.y, '+5', '#88ff44');
    }
    // CASCADE floor modifier — first POSITIVE floor modifier in the pool.
    // Each qualifying defeat within 4 tiles of the player releases a
    // medical pulse that heals +5 HP. Encourages aggressive engagement
    // (the heal is positional — camping at long range earns nothing).
    //
    // Gates:
    //   _EG.modifier === 'CASCADE' — modifier-roll only; off-floor
    //     (boss floors, floor 1) and other modifiers fall through.
    //   !this.isShard — SPLITTER shard chains would let one entry kill
    //     produce 2-4 heals from a single engagement; cap to one.
    //   !isSummon — summoned phantoms / GHOST_PROJECTOR replays would
    //     turn a SUMMONER farm into a permanent regen aura. Mirrors
    //     the elite/boss-core-drop and PIERCING_HEART/LUCKY/SALVAGE
    //     gates upstream.
    //   dist(player, this) < 4 — the positional condition. 4-tile
    //     radius (~half a small room) keeps the heal coupled to the
    //     player's actual engagement, not floor-wide passive regen.
    //
    // Heal value 5 = ~6% of an 80-HP base; comparable to SCAVENGER_NANITES
    // (5 @ 10% chance) but unconditional within radius. Strong floor
    // modifier — comparable to FORTIFIED's challenge — but RNG-rolled
    // 1/12 per non-boss floor so it's a treat, not a baseline.
    //
    // No combat-suppression gate (e.g. !isBoss) — the design intent is
    // that finishing a boss within melee range IS rewarded with a
    // pulse, mirroring how VAMPIRIC and PIERCING_HEART have no boss
    // gates.
    if (_EG.modifier === 'CASCADE' && !this.isShard && !isSummon
        && dist(_EG.player.x, _EG.player.y, this.x, this.y) < 4) {
      const _csp = _EG.player;
      if (_csp.hp < _csp.maxHp) {
        _csp.hp = Math.min(_csp.maxHp, _csp.hp + 5);
        spawnDmgText(_csp.x, _csp.y - 0.4, '+5', '#44ff88');
      }
      spawnParticles(this.x, this.y, 'MUZZLE', '#44ff88', 5);
    }
    // WINDFALL floor modifier — third positive modifier in the pool, paired
    // economically with CASCADE (sustain) and OVERCHARGE (damage). Every 5th
    // qualifying defeat drops a single bonus core (+1 value) at the kill
    // location. Cores are post-run currency (NEON.save.addCores) so this
    // accelerates META progression rather than the current run — the
    // headline incentive is "clear the WINDFALL floor thoroughly."
    //
    // Tempo: every 5th kill mirrors OVERCHARGE's rhythm so players already
    // attuned to the OVERCHARGE counter recognise the cadence. ~6 bonus
    // cores per 30-mob floor. Comparable in value to a SALVAGE-affixed
    // weapon (~3 cores/floor, 10% rate) plus a couple of elites — strong
    // but not run-defining.
    //
    // Gates (mirror CASCADE):
    //   _EG.modifier === 'WINDFALL' — modifier-roll only; off-floor and
    //     other modifiers fall through. Boss floors / floor 1 are
    //     modifier-free (game.js:184) so no isBoss gate needed.
    //   !this.isShard — SPLITTER shard chains would let one entry kill
    //     accelerate the counter unfairly; cap to one tick per top-level
    //     enemy.
    //   !isSummon — SUMMONER farming would otherwise turn the floor into
    //     a free-core fountain. Mirrors CASCADE/SALVAGE/PIERCING_HEART
    //     gating upstream.
    //
    // Counter scope: per-RUN (`player._windfallKills`), persisted in
    // saveGame's explicit-enum block + restored in continueGame so a
    // quit-and-resume on a WINDFALL floor preserves the rhythm. Increment
    // ONLY on WINDFALL floors so the counter doesn't drift on non-WINDFALL
    // floors and produce a surprise instant-bonus on the next WINDFALL
    // floor (per stored memory 'positive floor modifiers').
    //
    // NEON.cores guard mirrors line 2117 so the path is browser-only and
    // can't crash node:test.
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
    // SIGNAL_BOOST floor modifier — fourth positive modifier in the pool,
    // opening a "tactical/utility" lane (CASCADE=heal, OVERCHARGE=damage,
    // WINDFALL=economy, SIGNAL_BOOST=ability uptime). Every 5th qualifying
    // defeat instantly clears the player's hackware cooldown, so hackware-
    // using builds get a "free" extra activation roughly every 5 kills.
    //
    // Tempo: every 5th kill mirrors OVERCHARGE/WINDFALL so players already
    // attuned to that cadence recognise the rhythm.
    //
    // Gates (mirror WINDFALL):
    //   _EG.modifier === 'SIGNAL_BOOST' — modifier-roll only; off-floor and
    //     other modifiers fall through. Boss floors / floor 1 are
    //     modifier-free (game.js:184) so no isBoss gate needed.
    //   !this.isShard — SPLITTER shard chains would let one entry kill
    //     accelerate the counter unfairly; cap to one tick per top-level
    //     enemy.
    //   !isSummon — SUMMONER farming would otherwise turn the floor into
    //     a free-cooldown fountain. Mirrors CASCADE/SALVAGE/PIERCING_HEART
    //     gating upstream.
    //
    // Counter-vs-effect split: counter ticks UNCONDITIONALLY (so the HUD
    // progress suffix stays consistent and players see the rhythm even
    // without hackware), but the cooldown reset + floater are gated on
    // `player.hackware` being truthy. A player who PICKS UP hackware mid-
    // floor at counter=4 thus gets the next reset immediately, instead
    // of having to re-build the rhythm from scratch.
    //
    // Counter scope: per-RUN (`player._signalBoostKills`), persisted in
    // saveGame's explicit-enum block + restored in continueGame so a
    // quit-and-resume on a SIGNAL_BOOST floor preserves the rhythm.
    // Increment ONLY on SIGNAL_BOOST floors so the counter doesn't drift
    // on non-SIGNAL_BOOST floors and produce a surprise instant-reset on
    // the next SIGNAL_BOOST floor (per stored memory 'positive floor
    // modifiers').
    if (_EG.modifier === 'SIGNAL_BOOST' && !this.isShard && !isSummon) {
      const _sbp = _EG.player;
      _sbp._signalBoostKills = (_sbp._signalBoostKills || 0) + 1;
      if (_sbp._signalBoostKills % 5 === 0 && _sbp.hackware) {
        _sbp.hackwareCooldown = 0;
        spawnDmgText(this.x, this.y - 0.4, '↻ HACKWARE', '#00ddff');
        spawnParticles(this.x, this.y, 'MUZZLE', '#00ddff', 5);
      }
    }
    // QUARTERMASTER floor modifier — sixth positive modifier in the pool,
    // a per-room economy variant of WINDFALL. The FIRST defeat in each
    // room drops a bonus core (+1 value) at the kill location. Cores
    // accelerate META progression (NEON.cores.spawnCoreDrop). Encourages
    // exploration: every new room = guaranteed bonus core for clearing it,
    // so the headline incentive is "visit every room on a QUARTERMASTER
    // floor."
    //
    // Tempo: roughly 1 bonus core per room. With ~6-12 rooms per floor,
    // that's 6-12 bonus cores per QUARTERMASTER floor — comparable
    // total payout to WINDFALL's "every 5th defeat" on a 30-mob floor,
    // but front-loaded (one per room rather than spread across kills).
    //
    // Gates (mirror WINDFALL):
    //   _EG.modifier === 'QUARTERMASTER' — modifier-roll only; off-floor
    //     and other modifiers fall through. Boss floors / floor 1 are
    //     modifier-free (game.js:184) so no isBoss gate needed.
    //   !this.isShard — SPLITTER shard chains would let one entry kill
    //     trigger the per-room bonus; cap to one tick per top-level
    //     enemy. Mirrors WINDFALL/SIGNAL_BOOST gating.
    //   !isSummon — SUMMONER farming would otherwise give a bonus core
    //     for the summon kill instead of the actual room-clear. Mirrors
    //     CASCADE/WINDFALL/SIGNAL_BOOST.
    //   this.room — room reference must exist (some special spawns lack
    //     a room association; skip them rather than crash).
    //   !this.room._qmHarvested — the per-room one-shot gate. Set to
    //     true after the bonus drops so subsequent kills in the same
    //     room don't trigger again.
    //
    // State scope: per-ROOM (`room._qmHarvested`), NOT per-player and
    // NOT serialized in saveGame. Rationale: the dungeon is regenerated
    // from scratch on Continue (game.js:354 comment confirms rooms array
    // is rebuilt — player._currentRoom is reset to null because its
    // reference would be stale). This means a save+resume on a
    // QUARTERMASTER floor produces fresh rooms with no _qmHarvested
    // flags, so the player can re-harvest. We accept this — exploiting
    // it requires save-quit-resume per room, which is far slower than
    // simply playing the floor. The forgiving behaviour matches the
    // codebase's "Continue should not punish you" stance.
    //
    // NEON.cores guard mirrors WINDFALL (line 2284) so the path is
    // browser-only and can't crash node:test.
    if (_EG.modifier === 'QUARTERMASTER' && !this.isShard && !isSummon
        && this.room && !this.room._qmHarvested) {
      this.room._qmHarvested = true;
      if (typeof NEON !== 'undefined' && NEON.cores && NEON.cores.spawnCoreDrop) {
        NEON.cores.spawnCoreDrop(game, this.x, this.y, 1);
        spawnDmgText(this.x, this.y - 0.4, '+1◆ QM', '#ffaa44');
        spawnParticles(this.x, this.y, 'MUZZLE', '#ffaa44', 5);
      }
    }
    // CHAINREACT floor modifier — eighth positive modifier in the pool,
    // a combo-window economy variant. Chained defeats within 1.5s of the
    // last qualifying defeat award a +15 bonus credits floater. Counter
    // is a countdown timer (`player._chainBuffTimer`, ticks down via
    // dt in Player.update) — chain extends every qualifying defeat,
    // breaks when the timer expires.
    //
    // Tempo: rewards aggressive room-clearing. The first defeat in a
    // chain seeds the window with NO bonus (you can't chain a single
    // defeat); subsequent defeats inside the window each award bonus
    // credits. So a 5-defeat sustained chain awards 4 bonuses (+60 CR);
    // a long 10-defeat sustained chain awards 9 bonuses (+135 CR).
    // Comparable to a Greedy weapon's cumulative bonus over a floor,
    // but rewards combat tempo specifically.
    //
    // Gates (mirror WINDFALL):
    //   _EG.modifier === 'CHAINREACT' — modifier-roll only; off-floor
    //     and other modifiers fall through. Boss floors / floor 1 are
    //     modifier-free (game.js:184).
    //   !this.isShard — SPLITTER shard chains would let one entry kill
    //     trickle multiple chain extensions; cap to one tick per top-
    //     level enemy. Mirrors WINDFALL/SIGNAL_BOOST/QUARTERMASTER.
    //   !isSummon — SUMMONER farming would otherwise let a player camp
    //     a summoner for an infinite chain.
    //
    // Counter scope: per-RUN (`player._chainBuffTimer`), persisted in
    // saveGame's explicit-enum block + restored in continueGame so a
    // quit-and-resume mid-chain doesn't drop the rhythm. Window
    // refresh happens UNCONDITIONALLY (every qualifying defeat extends
    // the window) — only the BONUS payout is gated on the prior
    // window being still active.
    //
    // creditSiphonMul / corrosiveMul are NOT applied to the chain
    // bonus — keeps the +15 a flat, predictable reward (mirrors the
    // spawnDmgText literal). The base credit drop above (line 2092)
    // already applies those multipliers.
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

    // Set perceived target position. Normal enemies are not omniscient: they
    // acquire the player with line of sight, chase the last seen point briefly,
    // then forget. Taunts and bosses keep their legacy arena/hackware rules.
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
      // Cancel VENGEANCE rush on stun — drop telegraph/strike, keep
      // _vgCharges (one-shot defuse mirrors REAPER's _reHasFrenzied
      // semantics: charges represent commitment to retaliate, you
      // can interrupt the swing but not erase the grudge).
      if (this._vgState === 'rush') { this._vgState = 'idle'; this._vgRushTimer = 0; }
      // Cancel GULPER belch on stun — full defuse: drop telegraph/recovery
      // back to chase, clear stacks. Mirrors echoer/prophet/cryophage
      // contract (stunned mob can't fire after stun ends). Stacks are
      // erased (unlike VENGEANCE charges) because the mouth-cone hasn't
      // committed yet — a stunned gulper visually "spits up" what it
      // ate. Runs unconditionally for any GULPER (including chase
      // state): a saturated chase-state gulper waiting for LOS must
      // also lose stacks on stun, otherwise stun fails to defuse a
      // primed mob — caught by round-2 codex review.
      if (this.type === 'GULPER') {
        this._glState = 'chase';
        this._glChargeTimer = 0;
        this._glRecoverTimer = 0;
        this._glStacks = 0;
      }
      // Stunned CONDUIT clears its per-link beam ICDs so it can't damage
      // the player while paralysed. ICDs would naturally pause (no AI
      // tick under stun) but a stale ICD could underflow on resume and
      // damage immediately — clearing is the safe contract.
      if (this.type === 'CONDUIT' && this._cdLinkICD) this._cdLinkICD.clear();
      // Cancel resonator telegraph on stun — drop straight to recovery so the
      // wedge doesn't fire after stun ends and the player can punish the stun.
      if (this._rsState === 'telegraph') { this._rsState = 'recovery'; this._rsRec = RESONATOR_RECOVERY; this._rsTele = 0; }
      // Cancel mirror telegraph on stun — drop straight to recovery so the
      // shot doesn't fire after stun ends and the player can punish the stun.
      if (this._miState === 'telegraph') { this._miState = 'recovery'; this._miRec = MIRROR_RECOVERY; this._miTele = 0; }
      // Cancel watcher telegraph on stun — drop straight to recovery so the
      // beam doesn't fire after stun ends. Mirrors RESONATOR/MIRROR pattern;
      // the sweep itself is paused naturally by the early return below
      // (no AI tick under stun, so _wAng won't advance). _wFired stays
      // false so the render branch's beam-flash gate skips the visual —
      // critical: without that gate, every stun-cancel would render a
      // bright "beam fired" line even though no damage was dealt.
      if (this._wState === 'telegraph') { this._wState = 'recovery'; this._wRec = WATCHER_RECOVERY; this._wTele = 0; this._wFired = false; }
      // Cancel ARCHITECT target on stun — drop to recovery, clear the
      // pending target. Mirrors WATCHER/RESONATOR/MIRROR cancel pattern.
      // _aCommitted stays false so the render branch's commit-flash gate
      // skips the visual — critical: without that gate, every stun-cancel
      // would briefly render a "wall built" flash even though no wall
      // was placed.
      if (this.type === 'ARCHITECT' && this._aState === 'target') {
        this._aState = 'recovery';
        this._aRec = ARCHITECT_RECOVERY;
        this._aTele = 0;
        this._aTarget = null;
        this._aCommitted = false;
      }
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
      // SPECTRE: stun forces immediate manifest. Without this, an
      // EMP/Shock landing during the phase window would freeze an
      // INVULNERABLE chaser in place — stun would be counter-productive
      // against this type. Force-manifest clears phaseImmune so the
      // player CAN punish the stun (and re-stuns are useful), and uses
      // a short fixed window so the spectre doesn't stay vulnerable for
      // a full natural manifest after the stun ends.
      if (this.type === 'SPECTRE' && this._spState === 'phase') {
        this._spState = 'manifest';
        this._spTimer = SPECTRE_STUN_MANIFEST;
        this.phaseImmune = false;
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

    // REGENERATIVE floor modifier — non-elite, non-boss patrols self-repair
    // when out of combat (no damage taken in last REGEN_DELAY=2.5s). Ticks
    // AFTER the stun early-return above so stunning the mob freezes regen
    // entirely (stun is a player-controlled neutralization, not "uncontested").
    // Eligibility gates (defense-in-depth — most also short-circuit elsewhere):
    //   !isBoss — bosses are HP-ratio-tuned for phase transitions; regen
    //     would shift those thresholds mid-fight.
    //   !elite  — elites already carry an affix; layering regen on top
    //     pushes them into chip-impossible territory at NIGHTMARE.
    //   !_summoned — summons are temporary by design (despawn on parent
    //     death); regen would let SUMMONER farm a permanent escort.
    //   !isShard  — shards are 1-tick splits; regen would let them survive.
    //   !_disguised — mimic disguise pre-reveal must not heal (visual leak).
    //   !_wrPhased — phased mobs return 0 actual via the phaseImmune branch
    //     in takeDamage so the reset never fires; gating here too prevents
    //     a phased WRAITH from ticking up regen while invulnerable.
    //   !_ghIsGhost — ghosts have their own _ghLife despawn timer.
    // Reset site: takeDamage `actual > 0` branch (any real damage resets).
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
      // CRAWLER inflicts burn on successful hit. BIOFILTER halves duration AND DPS.
      if (dealt > 0 && this.type === 'CRAWLER') {
        const wasBurning = player.burnTimer > 0;
        const bioMul = hasAugment('BIOFILTER') ? 0.5 : 1;
        player.burnTimer = Math.max(player.burnTimer, 2 * bioMul);
        player.burnDps = Math.max(player.burnDps, (2 + _EG.floor * 0.3) * bioMul);
        if (!wasBurning) audio.playerBurn();
      }
      // SAPPER drains time from a random ACTIVE timed boost on a
      // successful contact hit (gated on dealt > 0 so a parry / shield
      // absorb correctly skips the drain). Falls through silently when
      // the player has no timed boost active — never punishes empty
      // inventory, only the moments the player chose to activate
      // something. Visual: floating "−Ns" text in the SAPPER colour so
      // the player gets unambiguous feedback even on a small screen.
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
      if (rand('cosmetic') < dt * 20) spawnParticles(this.x, this.y, 'SPARK', '#ff6600', 1);
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
      if (rand('cosmetic') < dt * 10) spawnParticles(this.x, this.y, 'SPARK', '#ff6600', 1);
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
      if (rand('cosmetic') < dt * 12) spawnParticles(this.x, this.y, 'SPARK', '#22ff88', 1);
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
      if (!/** @type {any} */ (this)._lpHasActivePeer()) {
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
        const ox = (rand('combat') - 0.5) * 2;
        const oy = (rand('combat') - 0.5) * 2;
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
        const addType = rand('combat') < 0.6 ? 'CRAWLER' : 'DRONE';
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
        const a = (i / ringCount) * TWO_PI + (rand('combat') * 0.15);
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
    if (this.type==='SPECTRE') {
      // Phase: dim translucent (0.18 base + small bob shimmer).
      // Telegraph (last SPECTRE_TELEGRAPH_DUR of phase): alpha ramps up
      // toward solid as the manifest approaches.
      // Manifest: fully solid + glowing (the ring is drawn separately
      // post-body so it shows around the orb).
      if (this._spState === 'phase') {
        const teleTime = SPECTRE_TELEGRAPH_DUR;
        if (this._spTimer > 0 && this._spTimer < teleTime) {
          // Solidify ramp: alpha 0.28 → 0.85 as timer drops to 0.
          const t = 1 - (this._spTimer / teleTime);
          alpha = 0.28 + 0.57 * t;
        } else {
          alpha = 0.18 + 0.10 * Math.sin(this.bobAngle * 4);
        }
      } else {
        alpha = 1.0;
      }
    }
    // Ghost replays render translucent so the player can immediately read
    // them as "not real" at a glance. Multiplies any per-type alpha (none
    // of the ghostable types currently set their own alpha, but the
    // multiplication keeps the rule sound if PHANTOM ever joins the
    // ghostable allowlist later).
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
      } else if (t === 'HARVESTER') {
        // Compact body + glowing surge-spike on top — visually telegraphs
        // "drops a buff on death" (the spike echoes the HARVEST_SURGE icon).
        // Distinct from CHARGER (square) and SCORCHER (rotated diamond).
        const w = TILE * 0.36, h = TILE * 0.32;
        ctx.fillRect(sx - w / 2, sy - h / 2, w, h);
        // Spike — small triangle above the body, pulses with bobAngle so the
        // mob reads as "energetic" even at rest.
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
        // Wispy orb — small inner core + larger outer halo. The halo
        // alpha is what conveys phase/manifest state (set on `alpha`
        // earlier in this draw call). Drawing two concentric circles
        // gives the spectre a "smoke-with-a-soul" silhouette that's
        // distinct from both PHANTOM (solid square) and WRAITH (diamond).
        const coreR = TILE * 0.16;
        const haloR = TILE * 0.30;
        // Outer halo — wispy, pulses gently with bobAngle.
        ctx.save();
        const haloPulse = 0.78 + 0.22 * Math.sin(this.bobAngle * 3);
        ctx.globalAlpha = (ctx.globalAlpha || 1) * 0.55 * haloPulse;
        NEON.draw.circle(ctx, sx, sy, haloR);
        ctx.restore();
        // Inner core — brighter, holds full per-state alpha.
        NEON.draw.circle(ctx, sx, sy, coreR);
      } else if (t === 'MAGPIE') {
        // Magpie — diamond body + small "carry pip" overlay when
        // _mgStolenCr > 0. Visually distinct from every other mob:
        // diamond (Item-shaped on purpose — it IS the loot-thief)
        // with a pale silver-blue iridescent outline. Carrying pip
        // is a tiny gold square inside the diamond — reads as
        // "this one has my stuff" at a glance, mobile-friendly.
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
        // TETHER — squat trapezoidal anchor body + four short
        // anchor-stake spurs. Visually "rooted" so the player reads
        // it as the source of the leash slow. Distinct from MAGPIE's
        // diamond and SAPPER's triangle.
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
        // Anchor stakes — four short spurs poking down/out, alpha
        // pulses gently with _teLashPhase so packs don't sync.
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
        // Treasure-vault — squat hexagon "chest" body + a gold coin-slot
        // bar across the middle, pulsing with _vmPulse so clustered
        // spawns don't sync. Visually distinct from every other mob:
        // hexagon (no other mob is hex-shaped) reads as "container".
        // The bright slot tells the player "hit me — there's stuff inside".
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
        // Coin-slot bar — bright gold, pulses to draw the eye toward
        // the "deposit me" affordance.
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
        // Spindly leech — small triangular body + four short tendrils
        // that pulse with _saPulse so a clustered pack doesn't pulse
        // in lock-step. Visually distinct from every other melee
        // chaser (CRAWLER diamond, GUARD square, CHARGER bracket).
        const bodyR = TILE * 0.20;
        const tendrilLen = TILE * (0.18 + 0.06 * Math.sin((this._saPulse || 0) + this.bobAngle * 2));
        // Body — triangle pointing toward player travel direction
        // (use bobAngle as a stable proxy — no need to read player
        // pos in the hot draw path).
        const ang = this.bobAngle * 1.5;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(ang) * bodyR, sy + Math.sin(ang) * bodyR);
        ctx.lineTo(sx + Math.cos(ang + 2.4) * bodyR, sy + Math.sin(ang + 2.4) * bodyR);
        ctx.lineTo(sx + Math.cos(ang - 2.4) * bodyR, sy + Math.sin(ang - 2.4) * bodyR);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        // Tendrils — four short radial lines, semi-transparent.
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
      // WARDLING: amber link line connecting wardling to its ward (when
      // bonded), and a faint amber halo around the body. The link line
      // is the diegetic tell — players who see the line know which mob
      // is being protected and can plan their target priority. No link
      // = panic state, no halo (just the body sprite).
      if (this.type === 'WARDLING') {
        const ward = this._wlWard;
        if (ward && !ward.dead) {
          ctx.save();
          // Faint amber halo on body — telegraphs "this is a special role"
          const pulse = 0.5 + 0.5 * Math.sin(this.bobAngle * 2);
          ctx.globalAlpha = 0.25 + 0.15 * pulse;
          ctx.strokeStyle = '#ffcc66';
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#ffcc66';
          ctx.lineWidth = 1.2;
          NEON.draw.circleStroke(ctx, sx, sy, sz * (1.05 + pulse * 0.25));
          // Link line to the ward
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
      // VENGEANCE: charge dots around body (idle + accumulating), then
      // crimson lock line + body flash during the telegraph sub-phase,
      // then a streaking trail during the strike sub-phase. Telegraph
      // direction commits at rush-arm time and is RE-EVALUATED each
      // frame from _tx/_ty (the strike chases the player; the lock
      // line just follows the same target so the player can read
      // intent).
      if (this.type === 'VENGEANCE') {
        ctx.save();
        const charges = this._vgCharges || 0;
        // Idle: charge pip ring around body. Pips fill clockwise from N.
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
            // TELEGRAPH sub-phase: crimson lock line to current target +
            // pulsing aura on body. Progress from 0 (telegraph start) to
            // 1 (telegraph end / strike start).
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
            // Body aura
            ctx.globalAlpha = 0.35 + progress * 0.45;
            ctx.strokeStyle = '#ff3388';
            ctx.lineWidth = 1.5 + progress * 1.5;
            NEON.draw.circleStroke(ctx, sx, sy, sz * (1.2 + progress * 0.5));
          } else {
            // STRIKE sub-phase: bright crimson trail/flash on body.
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = '#ff3388';
            ctx.shadowBlur = 18;
            ctx.shadowColor = '#cc1166';
            NEON.draw.circle(ctx, sx, sy, sz * 0.6);
          }
        }
        ctx.restore();
      }
      // CONDUIT: cyan body pulse + electric beam line to each partner alive
      // in the same room with LoS clear. Beam geometry uses the same
      // coordinates as the aiConduit hit-test (segment between bodies,
      // perpendicular threshold = CONDUIT_BEAM_W) so what the player SEES
      // is exactly what the beam HITS. Both endpoints render the beam (no
      // dedup) so an FOV-culled lower-eid endpoint doesn't hide the line —
      // the higher-eid partner picks up the render. Double-stroking when
      // both are visible is intentional (slightly brighter, fine).
      if (this.type === 'CONDUIT') {
        ctx.save();
        // Idle/ambient: cyan core pulse on body — passive presence.
        const pulse = 0.5 + 0.5 * Math.sin(this.bobAngle * 2);
        ctx.globalAlpha = 0.20 + 0.15 * pulse;
        ctx.strokeStyle = '#44ffff';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#44ffff';
        ctx.lineWidth = 1.2;
        NEON.draw.circleStroke(ctx, sx, sy, sz * (1.0 + pulse * 0.4));
        // Beam pass — only if we have any partners. Null-safe map access:
        // _EG.dungeon can be null briefly during floor transitions, and
        // every other draw path that reads dungeon.map uses optional
        // chaining (drawLasers/drawCameras pattern).
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
            // Bright inner core for legibility against busy floors.
            ctx.globalAlpha = 0.85;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 0.8;
            NEON.draw.line(ctx, sx, sy, ox, oy);
          }
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
      // WATCHER: yellow lighthouse cone. ALWAYS visible (faint) during
      // sweep so the player can read the rotation rhythm. On lock the
      // wedge intensifies dramatically (telegraph), on fire a brief
      // beam flash extends to the cone tip. Geometry mirrors the hit-
      // test in aiWatcher (apex at body, half-angle = WATCHER_HALF_RAD,
      // radius = WATCHER_RANGE * TILE) so what the player SEES is
      // exactly what the cone HITS.
      if (this.type === 'WATCHER') {
        ctx.save();
        const halfRad = WATCHER_HALF_RAD;
        const radPx = WATCHER_RANGE * TILE;
        // Aim direction: live sweep angle during 'sweep'; locked angle
        // during 'telegraph' / 'recovery' (sweep paused).
        const aimAngle = (this._wState === 'sweep') ? this._wAng : this._wLockAng;
        if (this._wState === 'telegraph' && this._wTele > 0) {
          // TELEGRAPH: intensified yellow wedge, brightens as fire approaches.
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
          // Edge lines — bright yellow, intensifying.
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
          // Pulsing arc rim
          const pulse = 0.5 + 0.5 * Math.sin(progress * 22);
          ctx.globalAlpha = (0.30 + progress * 0.55) * pulse;
          ctx.lineWidth = 1.5 + progress * 1.2;
          ctx.beginPath();
          ctx.arc(sx, sy, radPx, aimAngle - halfRad, aimAngle + halfRad);
          ctx.stroke();
        } else if (this._wState === 'recovery' && this._wFired && this._wRec > WATCHER_RECOVERY * 0.7) {
          // BEAM FLASH on commit — brief bright line along the locked aim
          // for the first ~30% of recovery, then fades. Doubles as the
          // "this is the angle that hit you" feedback frame. Gated on
          // _wFired so a stunned/cancelled telegraph (which also enters
          // recovery with _wRec=full) does NOT flash a phantom beam.
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
          // SWEEP (or late recovery): faint always-visible cone — the
          // passive rhythm telegraph. Thin lines + low-alpha fill so the
          // player can SEE the rotation but it doesn't visually dominate.
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
      // MIRROR: lime-green ambient pulse during idle/recovery; during the
      // telegraph window, draw a dashed aim line from the body to the locked
      // target plus a colour-tinted ring on the body in the player's last
      // shot colour — that's the "I'm about to fire YOUR gun back" tell.
      // Aim line/ring tinting drives the entire visual from the cached lock
      // (this._miAimDx/Dy + this._miShotColour), so what the player SEES is
      // exactly what the projectile WILL be.
      if (this.type === 'MAGNETON') {
        // Constant magnetic field visualisation — pulsing magenta ring at
        // MAGNETON_FIELD_R plus an inner counter-rotating arc to give the
        // field a "live" feel. No telegraph state — the field IS the
        // telegraph (player learns "shots curve here" by observing once
        // and then sees the ring as the warning).
        ctx.save();
        const mgT = this._mgPulse || 0;
        const fieldPx = MAGNETON_FIELD_R * TILE;
        const mgPulse = 0.5 + 0.5 * Math.sin(mgT * 2.2);
        // Outer field boundary — dashed magenta ring, pulses gently.
        ctx.globalAlpha = 0.18 + 0.18 * mgPulse;
        ctx.strokeStyle = '#ff44dd';
        ctx.shadowBlur = 8 + mgPulse * 6;
        ctx.shadowColor = '#ff44dd';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([6, 8]);
        ctx.lineDashOffset = -mgT * 14;
        NEON.draw.circleStroke(ctx, sx, sy, fieldPx);
        ctx.setLineDash([]);
        // Inner rotating arcs — give the field directional energy.
        ctx.globalAlpha = 0.22 + 0.22 * mgPulse;
        ctx.lineWidth = 1.6;
        const mgA0 = mgT * 1.4;
        ctx.beginPath();
        ctx.arc(sx, sy, fieldPx * 0.55, mgA0, mgA0 + Math.PI * 0.7);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sx, sy, fieldPx * 0.55, mgA0 + Math.PI, mgA0 + Math.PI * 1.7);
        ctx.stroke();
        // Body core ring — bright magenta so the magneton is unmistakable
        // among other stationary mobs (MIRROR lime / RESONATOR pink).
        ctx.globalAlpha = 0.40 + 0.20 * mgPulse;
        ctx.lineWidth = 1.8;
        ctx.shadowBlur = 12 + mgPulse * 8;
        NEON.draw.circleStroke(ctx, sx, sy, sz * 1.15);
        ctx.restore();
      }
      // NULLIFIER: persistent jam-aura visual. Mirrors MAGNETON's field-
      // ring pattern (the field IS the telegraph) but in NULLIFIER's
      // purple-magenta palette and with crosshatch interference instead
      // of smooth dashed dashes — visually reads as "interference / jam"
      // rather than MAGNETON's "magnetic pull". Ring INTENSIFIES when
      // the player is inside the aura (player.hackwareJammed === true)
      // so the player gets immediate visual confirmation that jamming
      // is currently active. When stunned, the ring fades to confirm
      // the mob is defused.
      if (this.type === 'NULLIFIER') {
        const stunned = (this.stunTimer && this.stunTimer > 0);
        ctx.save();
        const nlT = this._nlPulse || 0;
        const fieldPx = NULLIFIER_FIELD_R * TILE;
        const nlPulse = 0.5 + 0.5 * Math.sin(nlT * 1.4);
        // Active jam: when player is inside the aura, the ring brightens
        // and pulses faster. The flag is set by updateNullifierJam each
        // frame; reading it here is a pure render-side intensity boost
        // (no gameplay coupling — same flag drives the cooldown gate
        // and the activation gate elsewhere).
        const player = _EG && _EG.player;
        const jamActive = !!(player && player.hackwareJammed && !stunned
          && dist(this.x, this.y, player.x, player.y) < NULLIFIER_FIELD_R);
        const intensity = stunned ? 0.25 : (jamActive ? 1.0 : 0.55);
        // Outer field boundary — crosshatch dashed magenta ring. Two
        // dash passes counter-rotating gives the "interference" read.
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
        // Inner counter-rotating arcs — directional energy.
        ctx.globalAlpha = (0.20 + 0.22 * nlPulse) * intensity;
        ctx.lineWidth = 1.5;
        const nlA0 = nlT * 1.2;
        ctx.beginPath();
        ctx.arc(sx, sy, fieldPx * 0.55, nlA0, nlA0 + Math.PI * 0.65);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sx, sy, fieldPx * 0.55, nlA0 + Math.PI, nlA0 + Math.PI * 1.65);
        ctx.stroke();
        // Body core ring — bright purple-magenta, brighter when jamming.
        ctx.globalAlpha = (0.40 + 0.30 * nlPulse) * intensity;
        ctx.lineWidth = jamActive ? 2.2 : 1.7;
        ctx.shadowBlur = 12 + nlPulse * 10;
        NEON.draw.circleStroke(ctx, sx, sy, sz * 1.15);
        ctx.restore();
      }
      // GULPER: state-aware mouth-cone visual (the cone IS the warning,
      // mirroring MAGNETON's field-ring pattern). Render parity with
      // gameplay:
      //   - chase    → green/chartreuse "open mouth" (eat ON); intensity
      //                grows with stack count
      //   - charging → red-orange "loaded" bloom + STATIC locked cone
      //                (eat OFF — direction won't track player anymore)
      //   - recovery → faded grey "spent" cone (eat OFF)
      //   - stunned  → faded grey (eat OFF, defused)
      // The cone direction always uses _glAimAngle which the AI keeps
      // STATIC during charging/recovery — telegraph/commit parity for
      // the belch direction.
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
        // Pick wedge colour by state: spent grey for recovery/stun
        // (eat OFF — clearly distinct from active mouth), red for
        // charging (loaded — about to spit), chartreuse for chase.
        const wedgeColour = recovery ? '#666666'
                          : charging ? '#ff4422'
                                     : '#bbdd33';
        // Filled wedge — base intensity scales with stacks during chase
        // (legibility: empty mouth is faint, full mouth is hungry-bright).
        // Recovery cone is dim regardless of stacks (they were spent).
        const baseAlpha = recovery ? 0.05
                                   : 0.06 + stackT * 0.18 + chargeT * 0.30;
        ctx.fillStyle = wedgeColour;
        ctx.globalAlpha = baseAlpha;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.arc(sx, sy, radPx, aimAngle - halfRad, aimAngle + halfRad);
        ctx.closePath();
        ctx.fill();
        // Edge strokes — give the cone hard boundaries so the player
        // can read where the eat-zone ends. Recovery edges are dim.
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
        // Tooth marks: small ticks along the arc. Only rendered during
        // chase + charging (the gulper has stacks then). Recovery has
        // 0 stacks (just spent), so no teeth — matches gameplay.
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
        // Charging telegraph: pulsing bloom at the mouth (apex) so the
        // player gets a "spit incoming" tell even if the cone direction
        // is hard to read against busy decor.
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
        // Body ring — chartreuse so GULPER reads distinct from other
        // mid-tanks at a glance (dimmed during recovery/stun).
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
        // Vulnerability tell: bright pulsing ring around the manifested
        // orb. Strong contrast with the dim phase form so the player
        // reads "shoot now" instantly. Ring intensity peaks mid-window
        // so the player can also gauge how much of the window is left.
        ctx.save();
        const winT = 1 - Math.max(0, Math.min(1, this._spTimer / SPECTRE_MANIFEST_DUR));
        // Pulse: bright bloom at the start, settles toward the end.
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
      // PREDATOR affix: pulsing red lock-on ring + crosshair tick marks
      // while the buff timer is active. Alpha and ring radius pulse with
      // bobAngle so the visual reads as "this elite is currently
      // hunting you" — distinct from FRENZY's solid filled aura (which
      // shows raw rage) and VOLATILE's stroked warning ring (death
      // detonation telegraph). Clamp alpha into [0,1] per the canvas
      // gotcha (negative globalAlpha is silently ignored — assignments
      // outside [0,1] keep the previous value, so a small base + a
      // signed pulse can render at full opacity for the negative phase
      // of the pulse). Frac < 1 lerps the ring out toward the end of
      // the buff window so it visibly winds down.
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
        // Crosshair tick marks at N/E/S/W for the lock-on read
        ctx.beginPath();
        ctx.moveTo(sx - rR - 3, sy); ctx.lineTo(sx - rR + 1, sy);
        ctx.moveTo(sx + rR - 1, sy); ctx.lineTo(sx + rR + 3, sy);
        ctx.moveTo(sx, sy - rR - 3); ctx.lineTo(sx, sy - rR + 1);
        ctx.moveTo(sx, sy + rR - 1); ctx.lineTo(sx, sy + rR + 3);
        ctx.stroke();
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

// ─── Player ───────────────────────────────────────────────────────────────────

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
    this.weapons=[this.weapon];   // weapon belt (max 3 slots)
    this.weaponIdx=0;              // active weapon index into weapons[]
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
    this.toxicSlowActive=false; // true while standing on toxic tile
    // TETHER leash field accumulator. Each TETHER aiTether() multiplies
    // this down per frame (capped per mob); player.update consumes-and-
    // resets it each frame. dashTimer bypasses (mirrors toxic/disruption).
    this._tetherSlowFactor=1;
    this.disruptionFieldActive=false; // true while inside a disruption field
    this.hackwareJammed=false;        // true while inside a NULLIFIER aura — blocks cooldown ticking AND activateHackware
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
    // Timed boost remaining-seconds map ({HARVEST_SURGE: 8, ...}). Cleared
    // by clearFloorBoosts on floor transition. Not serialised in saveGame —
    // a 5-10s temp window is acceptable to lose on save/resume.
    this._boostTimers={};
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
    // REPAIR_PROTOCOL hackware HoT: 4 HP/s for 4s. Self-clearing —
    // _repairTicksLeft decays to 0 with no external reset needed. Tick
    // logic next to HP_REGEN block in update(); activation in content.js.
    this._repairTicksLeft=0;
    this._repairTickTimer=0;
    // SHIELD_BUBBLE hackware: multi-hit damage-pool absorption. bubbleHp
    // is the remaining absorption pool (0..35), bubbleTimer is the
    // expiry countdown (0..6 seconds). Drain logic in takeDamage @
    // ~12385 (BEFORE the one-shot SHIELD DRIVER boost / ENERGY_SHIELD
    // perk so an active bubble preserves those rare reserves). Tick
    // logic next to the REPAIR_PROTOCOL HoT block in update() — a
    // dt-based decrement so 30/60/120fps expire identically. Self-
    // clearing (hp drains to 0 OR timer expires; either zeroes both).
    // NOT serialized — like cloakTimer/repairTicksLeft, transient run-
    // state buffs are lost on Continue (consistent with the existing
    // hackware-buff convention). Wiped on death/respawn (new Player()).
    this.bubbleHp=0;
    this.bubbleTimer=0;
    this.secondWindUsed=false;  // SECOND_WIND: used this floor?
    // LAST_STAND perk: clutch defensive window. lastStandTimer counts down
    // an active 5s buff (+75% outgoing dmg via effectiveAtk, ×0.5 incoming
    // dmg in takeDamage). lastStandCD is the post-trigger lockout (60s
    // total, runs in parallel with the 5s active window). Triggered ONCE
    // per cooldown by an incoming hit that would drop hp to ≤10% maxHp,
    // BEFORE the hp deduction so the activating hit also benefits from
    // the −50% DR. Persists across floors (timer keeps ticking) but is
    // wiped on death/respawn (new Player()). Serialized so a Continue
    // mid-window preserves both timers.
    this.lastStandTimer=0;
    this.lastStandCD=0;
    // RETRIBUTION perk: reactive ATK buff. retributionTimer counts down a 3s
    // window of +50% outgoing dmg via effectiveAtk(). Triggered by takeDamage
    // when actual > 0 (so shield-absorbed / i-frame / ignoreDefense=false-
    // clamped hits that resolve to 0 don't trigger). dt-based decay alongside
    // cloakTimer/lastStandTimer so 30/60/120fps expire identically. Self-
    // clearing — no loadFloor reset needed (countdown is movement-independent,
    // unlike STRIDE; descend-warp can't inflate the rate). Not serialized
    // (transient short window, cloakTimer parity); a Continue mid-window
    // simply forfeits the remainder. Named RETRIBUTION (not VENGEANCE) to
    // avoid collision with the VENGEANCE retaliator mob (entities.js:303).
    this.retributionTimer=0;
    this.bountiesCollected=0;   // bounty targets eliminated this run
    // Augments — passive cybernetic implants
    this.augments={};           // owned augments: {NEURAL_LINK: true, ...}
    this.adrenalineTimer=0;     // ADRENALINE_INJECTOR speed buff timer
    this.reactiveArmorCD=0;     // REACTIVE_ARMOR cooldown
    // CHAINREACT floor modifier: countdown timer (default 1.5s) refreshed
    // on every qualifying defeat on a CHAINREACT floor. While > 0, the
    // next qualifying defeat awards +15 bonus credits. Self-decrementing
    // via dt in Player.update so 30/60/120fps expire identically. Per-
    // RUN scope (persisted in saveGame so quit-and-resume mid-chain
    // preserves the rhythm).
    this._chainBuffTimer=0;
    // UNCHAINED Phase 2 (#36) — persistent upgrade-node runtime state.
    // Behavioural listeners read player.metaFlags set by save.applyMetaToPlayer().
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
    // HOT_HAND perk: per-target consecutive-hit streak. Runtime-only.
    // _hotHandLastTarget is the enemy reference of the last hit (or
    // null for "no streak"). _hotHandStreak counts how many consecutive
    // hits have landed on that target. _hotHandTimer is the seconds
    // remaining in the window before the streak self-clears via the
    // tick block in Player.update. All three reset together — see the
    // takeDamage hook (target-switch reset) and Player.update tick
    // block (timeout reset) and game.js loadFloor (floor reset).
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
    // SHIELD_BUBBLE hackware: multi-hit damage-pool absorption. Drains
    // BEFORE the one-shot SHIELD DRIVER boost / ENERGY_SHIELD perk so
    // an active bubble preserves those rare reserves (a player who
    // pre-emptively pops bubble before a known damage spike must not
    // burn their one-shot defenses too — that would invert the active
    // vs passive trade-off). Drain-and-pass mirrors the SHIELDED enemy
    // affix at entities.js:1448-1450 — `absorbed = min(bubbleHp, dmg);
    // bubbleHp -= absorbed; dmg -= absorbed`. Residual passes through
    // to the one-shot defenses below; if the shot fully drains the
    // bubble AND has leftover dmg the one-shot perks/boost still fire
    // on the residual (defense-in-depth).
    //
    // GATES (in evaluation order):
    //   - !options.ignoreShield: env-DoT ticks (Plasma burnDps*dt,
    //     Toxic toxDps*dt, Arc Grid, Disruption Field, Frost Patch,
    //     Proximity Mine ignoreDefense path, CRAWLER burn DoT) all
    //     pass ignoreShield:true. They MUST bypass the bubble — a
    //     35hp pool would evaporate in <1s of plasma contact at
    //     60fps, trivialising the defense AND the env hazards both.
    //     Same gate the existing one-shot defenses use; consistent.
    //   - !options.ignoreInvincible: same rationale (env DoTs pass
    //     this too) plus a defense-in-depth catch in case a future
    //     hazard sets only ignoreInvincible (current code: no such
    //     hazard exists, but the gate matches the SHIELD DRIVER block
    //     below to keep the contract aligned).
    //   - dmg > 0: a 0-dmg hit (already-mitigated) shouldn't tick
    //     the bubble at all. Defense-in-depth — current callers don't
    //     pass dmg=0 but the guard costs nothing and prevents a
    //     future regression where a chained mitigation reduces dmg
    //     to 0 before reaching this layer.
    //
    // Visual feedback: spawnDmgText 'ABSORB N' shows the player
    // exactly how much the bubble ate. audio.shieldBreak() fires
    // ONLY on full drain (bubble hp dropped to 0 from this hit) so
    // partial absorbs are silent — otherwise a sustained-fire enemy
    // would spam the break sound. Self-zero on bubbleHp <= 0:
    // bubbleTimer also clears so the Player.update tick doesn't see
    // a half-cleared state. Note: small absorbs that DON'T break the
    // bubble fire NO audio — this is an intentional design choice
    // (the visible ring already conveys ongoing absorption; an
    // additional sound per partial hit would be noise). Subtle but
    // important for sustained-fire enemy patterns (e.g. AUTOGUN
    // bursts) where 6+ ticks/second would otherwise machine-gun the
    // shieldBreak audio.
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
      // Full absorb — short-circuit and return 0 (NOT absorbed). The
      // takeDamage return value is the contract used by callers to
      // detect "real damage landed on the player": CRAWLER burn
      // (entities.js:3083), SAPPER boost drain (entities.js:3097),
      // SNIPER shock (content.js:5179), SIPHON lifesteal (content.js:
      // 5185), CHARGER knockback (entities.js:6111), laser shock
      // (entities.js:11181) ALL gate on `dealt > 0`. Returning a
      // positive `absorbed` would incorrectly trigger every one of
      // those on-hit effects on a bubble-absorbed hit — burn DoTs
      // would tick, the bubble would lose its purpose. The existing
      // SHIELD DRIVER (~12461) and ENERGY_SHIELD (~12474) full-absorb
      // paths both `return 0` for the same reason; the bubble must
      // mirror that contract. Caught by all 3 adversarial reviewers
      // (gpt-5.3-codex / claude-opus-4.6 / gpt-5.5) as HIGH severity.
      //
      // hitsBlocked counter is incremented ONLY on full-absorb (here)
      // — gpt-5.5 review caught a double-count bug if we incremented
      // earlier: a partial bubble absorb would increment, then if the
      // residual hit fully consumed SHIELD DRIVER or ENERGY_SHIELD
      // those layers ALSO increment hitsBlocked, inflating the run-
      // recap stat (displayed in game.js:5543 / 5622). Restricting
      // increment to full absorbs keeps the semantics aligned with
      // the existing one-shot defenses (which only ever increment on
      // a complete block).
      if (dmg <= 0) {
        this.hitsBlocked = (this.hitsBlocked|0) + 1;
        return 0;
      }
    }
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
      // KINETIC_DAMPER augment: −20% incoming direct-hit damage applied AFTER
      // TITANIUM_PLATING flat reduction (so the two compose as a coherent
      // armor stack: flat first, then % on the remainder), and BEFORE
      // CORROSIVE/FRAGILE/HUNTER floor modifiers (so those still amplify
      // post-mitigation damage as designed). Gated by the !options.ignoreDefense
      // branch we're already in — env DoTs (Plasma burnDps*dt, Toxic toxDps*dt,
      // Arc Grid, Disruption Field, Frost Patch, Proximity Mine ignoreDefense
      // path, CRAWLER burn DoT) bypass this entirely; those are BIOFILTER's
      // lane to keep the two defensive augments cleanly separated and avoid
      // double-stacking on env tile damage. Math.max(1, ...) preserves the
      // direct-hit minimum-1 contract (a 1-dmg hit stays 1 dmg). Round (not
      // floor) keeps the rounding rule consistent with FRAGILE/HUNTER above.
      if (hasAugment('KINETIC_DAMPER')) {
        actual = Math.max(1, Math.round(actual * 0.8));
      }
    }
    if (_EG.modifier === 'CORROSIVE' && !options.ignoreDefense) actual += 2;
    if (_EG.modifier === 'FRAGILE' && !options.ignoreDefense) {
      actual = Math.max(1, Math.round(actual * 1.3));
    }
    // HUNTER floor modifier: hostile sensors scale incoming damage with
    // how long the player has been stationary. Mul = 1 + (still/MAX) *
    // HUNT_MAX_BONUS, where still is updated in Player.update each
    // frame. Applied AFTER def/CORROSIVE so it multiplies post-mitigation
    // damage. Gated on `!options.ignoreDefense` per the env-DoT-damage-
    // gate rule (Plasma burnDps*dt, Toxic toxDps*dt, Arc Grid, Disruption
    // Field, Frost Patch all pass sub-1 fractional damage with
    // ignoreDefense:true) — without the gate, Math.max(1, Math.round(...))
    // would inflate ~0.13/frame env DoT to ~1/frame = ~60 DPS instakill
    // at 60 FPS instead of intended ~10 DPS. Floor modifier is mutually
    // exclusive with FRAGILE/CORROSIVE on a given floor, so ordering
    // collisions are theoretical only — but the gate keeps the contract
    // documented and ready for any future stacking design.
    if (_EG.modifier === 'HUNTER' && !options.ignoreDefense) {
      const still = (this._huntStill || 0);
      const HUNT_MAX_STILL = 4.0;
      const HUNT_MAX_BONUS = 0.5;
      const mul = 1 + Math.min(1, still / HUNT_MAX_STILL) * HUNT_MAX_BONUS;
      actual = Math.max(1, Math.round(actual * mul));
    }
    // HARDENED floor modifier: reactive plating — passive 20% damage
    // reduction on this floor. Defensive positive mirror to FRAGILE
    // (×1.3 above) and the only floor-modifier-side defensive bonus
    // in the pool (the other 9 positive modifiers are offensive /
    // economy / uptime). Applied AFTER the offensive amps
    // (CORROSIVE / FRAGILE / HUNTER above) so the reduction composes
    // on the post-amp value — mathematically irrelevant in practice
    // because floor modifiers are mutually exclusive per floor (only
    // one rolls), but the order keeps the contract documented and
    // ready for any future stacking design. Gated on `!options.ignoreDefense`
    // per the env-DoT-damage-gate rule (Plasma burnDps*dt, Toxic
    // toxDps*dt, Arc Grid, Disruption Field, Frost Patch, Proximity
    // Mine ignoreDefense path, CRAWLER burn DoT) — without the gate,
    // Math.max(1, Math.round(...)) would inflate ~0.13/frame env DoT
    // to ~1/frame = ~60 DPS instakill at 60 FPS. Same gate pattern as
    // CORROSIVE / FRAGILE / HUNTER above. Math.max(1, ...) preserves
    // the direct-hit minimum-1 contract (a 1-dmg hit stays 1 dmg —
    // HARDENED never trivialises a hit to 0 even in the rounding
    // edge case where 1 * 0.8 = 0.8 → round → 1).
    if (_EG.modifier === 'HARDENED' && !options.ignoreDefense) {
      actual = Math.max(1, Math.round(actual * 0.8));
    }
    // GLASS_CANNON perk: paired defensive cost for the +30% ATK amp in
    // effectiveAtk(). +25% incoming damage on direct hits; gated on
    // !options.ignoreDefense per the env-DoT-damage-gate rule (Plasma
    // burnDps*dt, Toxic toxDps*dt, Arc Grid, Disruption Field, Frost Patch
    // all pass sub-1 fractional damage with ignoreDefense:true) — without the
    // gate, Math.max(1, Math.round(...)) would inflate ~0.04-0.13/frame env
    // DoT to ~1/frame = ~60 DPS instakill at 60 FPS. Same gate pattern as
    // FRAGILE/HUNTER/CORROSIVE above. Applied AFTER floor modifiers so the
    // trade-off composes multiplicatively on hard floors (intentional — the
    // player chose GLASS_CANNON, the floor amp is independent), and BEFORE
    // LAST_STAND so a clutch hit still gets the ×0.5 mitigation on the
    // GLASS_CANNON-amplified value.
    if (this.perks.GLASS_CANNON && !options.ignoreDefense) {
      actual = Math.max(1, Math.round(actual * 1.25));
    }
    if (actual <= 0) return 0;
    // LAST_STAND perk: clutch trigger fires BEFORE the hp deduction, so the
    // activating hit also gets the −50% DR (it's the moment-it-saves-you
    // mechanic, not a delayed buff). Trigger condition: hp would drop to
    // ≤10% maxHp (computed pre-mitigation). Cooldown gate prevents per-tick
    // re-triggering from DoT (burn/toxic/arc) — once fired, the 60s lockout
    // means a second trigger requires both the active 5s to expire AND the
    // 55s recharge. Active window apply the ×0.5 multiplier WITHOUT a
    // Math.max(1, …) clamp — env DoT (ignoreDefense:true) passes fractional
    // sub-1 ticks (~0.04-0.13/frame at 60fps), and a max(1) clamp would
    // inflate them to ~60 dps. Keeping it as a pure multiplier preserves
    // the DoT shape (CORROSIVE pattern §10534).
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
    // BULWARK perk: passive −15% damage taken while at or above 75% HP. The
    // defensive counterpart to PRISTINE (+25% ATK at >=90% HP). HP threshold
    // is checked against pre-deduction HP (this.hp is still the value before
    // we subtract `actual`), mirroring PRISTINE's effectiveAtk gate — so the
    // hit that crosses BELOW 75% still gets the reduction. Pure multiplier
    // with NO Math.max(1, …) clamp, mirroring LAST_STAND ×0.5 — env DoT
    // (Plasma/Toxic/Arc/Disruption/Frost) passes fractional sub-1 ticks with
    // ignoreDefense:true, and a max(1) clamp would inflate ~0.04-0.13/frame
    // to ~1/frame ≈ 60 DPS instakill. Keeping it as a pure multiplier
    // preserves the DoT shape AND lets BULWARK reduce all damage sources
    // (direct + env) consistent with "high HP = tougher" intuition. Player
    // hp is fractional throughout (game.js Math.floor at score calc, hp+dt
    // regen accumulates fractions) so the clampless reduction is safe.
    // Placed AFTER all amp blocks (CORROSIVE/FRAGILE/HUNTER/GLASS_CANNON)
    // and AFTER LAST_STAND ×0.5 — order is mathematically commutative with
    // LAST_STAND (both pure multipliers), but conceptually BULWARK applies
    // last as the "final passive defense layer". With both active the
    // combined factor is 0.5 × 0.85 = 0.425, but BULWARK gates at >=75% HP
    // and LAST_STAND triggers at <=10% HP — mutually exclusive in normal
    // play, so the simultaneity is theoretical only.
    if (this.perks.BULWARK && this.maxHp > 0 && this.hp / this.maxHp >= 0.75) {
      actual = actual * 0.85;
    }
    this.hp=Math.max(0,this.hp-actual);
    // PREDATOR elite affix: real HP damage just landed, so notify any
    // PREDATOR-affix elites within 8 tiles so they enter their 3s
    // lock-on window. Placed AFTER hp deduction (and AFTER the
    // `actual <= 0` early-return at ~12582 plus all absorb short-
    // circuits — bubble/SHIELD DRIVER/ENERGY_SHIELD all `return 0`
    // before this point per the takeDamage RETURN VALUE CONTRACT) so
    // we only trigger on real HP loss. Placed BEFORE the on-hit
    // visual/audio block so the PREDATOR cue sequences naturally with
    // the hit reaction. DoT ticks (burn/toxic/arc/disruption/frost)
    // pass ignoreDefense:true with sub-1 fractional dmg, but the
    // `actual <= 0` early-return AND the `Math.max(1, …)` clamps in
    // the direct-hit path mean ignoreDefense DoTs that pass through
    // here have actual >= 0 — the float-vs-int comparison is safe
    // because notifyPredatorElites is idempotent on refresh (the
    // leading-edge gate on `wasInactive` ensures audio/glow only fire
    // once per buff window, no matter how many DoT frames flow
    // through). Bounded loop over `enemies` is hot-path acceptable —
    // takeDamage is called per hit, not per frame.
    notifyPredatorElites(this.x, this.y);
    // RETRIBUTION perk: arm/refresh the 3s ATK window on every hit that lands
    // real damage. Refresh-on-tick is intentional — env DoTs (plasma/toxic/
    // arc/disruption/frost) keep the window alive while the player is in a
    // hazard, but the buff is still capped at +50% (no stacking). Placed
    // AFTER LAST_STAND's ×0.5 so a clutch-window hit that mitigates to a
    // fractional value still triggers (early-return at ~10699 already gates
    // on actual <= 0, so absorbed/i-framed/zero-mitigated hits skip this).
    if (this.perks.RETRIBUTION) this.retributionTimer = 3;
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
    // UNCHAINED #36 trauma_kit panic-button auto-heal. Fires AFTER the
    // hp<=0 block so second_wind owns lethal-hit revives — trauma_kit only
    // consumes on chip damage that crosses the 25% threshold while the
    // player remains alive. tryTraumaKit handles the charge counter, hp
    // floor, and threshold gate; we just paint the fx on success. The
    // 40% heal lifts hp well above 25% so consecutive small hits cannot
    // burn through multiple charges in one frame.
    if (this.hp > 0 && NEON.behavior.tryTraumaKit(this)) {
      audio.heal();
      spawnParticles(this.x, this.y, 'EXPLOSION', '#00ffaa', 14);
      // Mirror the +heal floater shown by second_wind / PIERCING_HEART so
      // players see WHY their HP jumped. The heal amount is duplicated from
      // tryTraumaKit's formula (40% maxHp, rounded) — keep the two in sync.
      // tryTraumaKit guarantees maxHp is finite & > 0 before returning true,
      // so the rounded value is always a safe integer here.
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
    // UNCHAINED #36: consume one surge shot + compute momentum/overclock mul.
    const surgeMul = this._consumeSurgeShot();
    // UNCHAINED #38: temp-boost COMBAT STIM stacks multiplicatively.
    const boostDmgMul = NEON.boosts.getBoostDamageMul(this);
    const metaMul = this.computeOutgoingDmgMul() * surgeMul * boostDmgMul;
    // UNCHAINED #38: CRIT MATRIX adds flat crit chance. Also drops the
    // CRITICAL_HIT perk gate — any player with an active matrix can crit.
    const critBonus = NEON.boosts.getBoostCritBonus(this);
    const mf = this.metaFlags || {};
    // KEEN weapon prefix (+12% per stack via mods.critAdd, stored on w.critAdd
    // by buildWeapon). Single-prefix-per-weapon constraint means stacks=1 in
    // practice, but the additive form keeps the stack-math correct if a
    // future change relaxes that. Applies uniformly to melee, ranged main,
    // and the MULTI_SHOT bonus projectile (all share `critChance`).
    //
    // (this.critChance || 0) restores the `critical_bias` meta upgrade to
    // the crit gate. save.js:281 writes `player.critChance += 0.04 * level`
    // for `critical_bias`, but the field had been dropped from this
    // computation pre-KEEN — co-located fix surfaced by adversarial review
    // when wiring KEEN into the same expression.
    const critChance = (this.perks.CRITICAL_HIT ? 0.15 : 0) + critBonus + (mf.critChanceBonus || 0) + (w.critAdd || 0) + (this.critChance || 0);
    // DEADLY weapon prefix (+50% per stack via mods.critMulAdd, stored on
    // w.critMulAdd by buildWeapon). Single-prefix-per-weapon constraint
    // means stacks=1 in practice, but the additive form keeps the
    // stack-math correct if a future change relaxes that. Applies
    // uniformly to melee, ranged main, and the MULTI_SHOT bonus
    // projectile (all share `critMul`). The `|| 0` guard is required —
    // weapons WITHOUT DEADLY have w.critMulAdd === undefined and bare
    // addition would NaN-poison every crit roll's damage.
    const critMul = 2 + (mf.critDamageBonus || 0) + (w.critMulAdd || 0);

    // OVERCHARGE floor modifier — every 5th player shot is a guaranteed crit.
    // Counter is run-scoped, persisted in saveGame's explicit enum (mirrors
    // PIERCING_HEART) so save/resume preserves rhythm. Increment ONLY on
    // OVERCHARGE floors so the counter doesn't drift on non-OVERCHARGE
    // floors and produce an instant free crit when the player steps onto
    // the next OVERCHARGE floor (counter would already sit at 5+). Single-
    // trigger semantic: forceCrit applies to melee + ranged main + the
    // MULTI_SHOT bonus projectile uniformly within ONE trigger pull. Auto-
    // fire boosts (AUTO_LASER, SENTRY_DRONE, PLASMA_ORB, SAW_BLADE) do NOT
    // route through Player.shoot and are intentionally excluded — mirrors
    // the DEADEYE perk's intentional-shoot-only scope.
    let forceCrit = false;
    if (_EG.modifier === 'OVERCHARGE') {
      this._overchargeShots = (this._overchargeShots || 0) + 1;
      if (this._overchargeShots % 5 === 0) forceCrit = true;
    }

    // PRIMED floor modifier — the FIRST shot in each room is a guaranteed
    // crit. Per-room one-shot: the gate latches `room._primedFired = true`
    // after the bonus fires, mirroring QUARTERMASTER's `room._qmHarvested`
    // per-room one-shot pattern. Composes ADDITIVELY with OVERCHARGE
    // (forceCrit |= primedCrit) so a PRIMED floor's first shot in a room
    // simply forces a crit regardless of OVERCHARGE's 5-shot counter
    // state — but floor modifiers are mutually exclusive per floor (only
    // one rolls), so PRIMED + OVERCHARGE can't co-occur. The OR keeps
    // forceCrit semantics clean if a future change relaxes mutex.
    //
    // Gates (mirror QUARTERMASTER — see entities.js Enemy.die L2429):
    //   _EG.modifier === 'PRIMED' — modifier-roll only; off-floor and
    //     other modifiers fall through. Boss floors / floor 1 are
    //     modifier-free (game.js:184) so no isBoss gate needed.
    //   this._currentRoom — room reference must exist (player firing
    //     from a corridor with no room cached has _currentRoom === null
    //     — skip the bonus rather than crash).
    //   !this._currentRoom._primedFired — the per-room one-shot gate.
    //
    // State scope: per-ROOM (`room._primedFired`), NOT per-player and
    // NOT serialized. Mirrors QUARTERMASTER's accepted save+resume
    // re-prime behaviour: dungeon is regenerated from scratch on
    // Continue (rooms array is rebuilt — `_currentRoom` reset to null
    // per game.js:358), so `_primedFired` flags are auto-cleared. The
    // forgiving behaviour matches the codebase's "Continue should not
    // punish you" stance.
    //
    // Auto-fire boosts (AUTO_LASER, SENTRY_DRONE, PLASMA_ORB,
    // SAW_BLADE) do NOT route through Player.shoot and are
    // intentionally excluded — mirrors OVERCHARGE/REVERB/DEADEYE.
    if (_EG.modifier === 'PRIMED' && this._currentRoom && !this._currentRoom._primedFired) {
      this._currentRoom._primedFired = true;
      forceCrit = true;
    }

    // REVERB floor modifier — every 5th player shot fires a free echo of
    // the same shot intent (one extra projectile fan / one extra melee
    // arc) AFTER the main shot resolves. Counter is run-scoped, persisted
    // in saveGame's explicit enum (mirrors OVERCHARGE) so save/resume
    // preserves rhythm. Increment ONLY on REVERB floors so the counter
    // doesn't drift on non-REVERB floors and produce an instant free
    // echo when the player steps onto the next REVERB floor (counter
    // would already sit at 5+). Single-trigger semantic: the echo
    // INHERITS forceCrit and finalMetaMul from the main shoot() call —
    // it's "the same shot fired twice", not a fresh trigger. The echo
    // does NOT recurse into shoot() (would double-tick OVERCHARGE,
    // double-fire MULTI_SHOT, re-roll DEADEYE) and does NOT itself tick
    // the REVERB counter (each trigger pull = 1 increment, not 2).
    // Auto-fire boosts (AUTO_LASER, SENTRY_DRONE, PLASMA_ORB, SAW_BLADE)
    // do NOT route through Player.shoot and are intentionally excluded —
    // mirrors OVERCHARGE / DEADEYE intentional-shoot-only scope.
    let echoOnThisShot = false;
    if (_EG.modifier === 'REVERB') {
      this._reverbShots = (this._reverbShots || 0) + 1;
      if (this._reverbShots % 5 === 0) echoOnThisShot = true;
    }

    // DEADEYE perk: stillness-charged attack. Apply ×DEADEYE_DMG_MUL to
    // the entire shot intent (folded into metaMul so ranged + melee +
    // MULTI_SHOT bonus projectile all benefit uniformly), then consume
    // the readiness latch. AUTO_LASER, SENTRY_DRONE, PLASMA_ORB and
    // SAW_BLADE auto-fire through their own paths and do NOT consume —
    // by design only the player's intentional shoot() drains the charge.
    let deadeyeMul = 1;
    if (this.perks.DEADEYE && this._steadyReady) {
      deadeyeMul = DEADEYE_DMG_MUL;
      this._steadyReady = false;
      this._steadyChargeTime = 0;
    }
    const finalMetaMul = metaMul * deadeyeMul;

    if (w.melee) {
      // plasma sword arc
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
      // MULTI_SHOT perk: fire a bonus 60%-damage projectile (ranged only)
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
    // REVERB echo — fire one duplicate of the SAME shot intent. Inherits
    // forceCrit + finalMetaMul (the captured deadeyeMul / metaMul of this
    // shoot() call), so REVERB+OVERCHARGE on the 5th shot lands a free
    // crit echo and DEADEYE's stillness bonus also propagates. The echo
    // does NOT include the MULTI_SHOT bonus projectile (that perk's bonus
    // is itself a "free shot"; doubling via REVERB would compound), does
    // NOT push to _shotHistory (otherwise MIRROR mobs would mimic the
    // echo as a separate shot), does NOT consume DEADEYE again (already
    // consumed by the main shot above), and tags echoed projectiles with
    // _isReverbEcho for debug / future detection. Audio fires a second
    // time so the player gets the audible "double-tap" cue that matches
    // the visual ♪ floater. Echo emits AFTER the main shot's audio so
    // the cue arrives slightly delayed (mirrors a literal echo).
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
    // HUNTER floor modifier: stillness accumulator. Compares this frame's
    // start position to last frame's end position (i.e. how far the
    // player ACTUALLY moved last frame, accounting for collisions, dash,
    // knockback). Increments while motion rate is small, decays fast
    // while moving. Capped at HUNT_MAX_STILL (matches the cap used by the
    // damage hook in takeDamage). Always tracked, even when the modifier
    // is inactive — keeps state consistent if a future hookup wants to
    // visualize the meter outside HUNTER floors. Threshold is rate-based
    // (tiles/sec, not tiles/frame) so the meter behaves identically at
    // 30/60/120 fps. Runtime cost: one subtract + one Math.hypot per
    // frame; trivial.
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
    // Position history sample — append (t-elapsed accumulated, x, y). Used
    // by ECHOER's predictive shot (enemy-echoer.js aiEchoer). Trim entries
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
    // GHOSTWALK meta upgrade: tick the bonus i-frame window AFTER dash
    // movement ends (dashTimer drives movement at line ~11740 and ends
    // at 0.12s; _dashIFrameTimer is set to 0.12 + dashIFrameBonus at
    // dash start so it persists for the bonus window after movement
    // ends). isPlayerDamageImmune reads this so env hazards (toxic,
    // plasma, arc, frost patches) AND mob damage (via takeDamage's
    // options.ignoreImmunity gate) both honour the extension. Without
    // this tick the timer would never expire and the immunity would
    // be permanent after the first dash.
    this._dashIFrameTimer = Math.max(0, (this._dashIFrameTimer || 0) - dt);
    // Hackware cooldown + cloak timer (frozen by disruption fields AND by
    // NULLIFIER jam aura — the player.hackwareJammed flag is set by
    // updateNullifierJam each frame BEFORE this player.update tick reads
    // it, mirroring the disruptionFieldActive call ordering in the main
    // game loop). Without the jam gate, NULLIFIERs would still BLOCK
    // activation but the cooldown would tick down inside the aura, so a
    // patient player could pre-bake a fresh activation by camping just
    // outside, then dashing in to fire — defeating the point of the mob.
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
    // Player burn DoT
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
    // Player shock decay
    if (this.shockTimer > 0) {
      this.shockTimer -= dt;
      if (rand('cosmetic') < dt * 8) spawnParticles(this.x, this.y, 'SPARK', '#ffee44', 1);
      if (this.shockTimer <= 0) this.shockTimer = 0;
    }
    // Augment timers
    if (this.adrenalineTimer > 0) this.adrenalineTimer = Math.max(0, this.adrenalineTimer - dt);
    if (this.reactiveArmorCD > 0) this.reactiveArmorCD = Math.max(0, this.reactiveArmorCD - dt);
    // CHAINREACT floor modifier: tick down the chain-window timer. Once
    // it hits 0 the chain breaks — the next qualifying defeat seeds a
    // fresh window (no bonus on the seed) but doesn't award the chain
    // bonus. dt-based so 30/60/120fps expire identically.
    if (this._chainBuffTimer > 0) this._chainBuffTimer = Math.max(0, this._chainBuffTimer - dt);
    // LAST_STAND perk: tick active window + cooldown lockout. Cooldown is
    // 60s total (5s active + 55s recharge); they tick in parallel so a new
    // trigger is gated only on lastStandCD <= 0. dt-based, so 30/60/120fps
    // all expire at the same wall-clock time.
    if (this.lastStandTimer > 0) this.lastStandTimer = Math.max(0, this.lastStandTimer - dt);
    if (this.lastStandCD > 0) this.lastStandCD = Math.max(0, this.lastStandCD - dt);
    if (this.retributionTimer > 0) this.retributionTimer = Math.max(0, this.retributionTimer - dt);
    // HOT_HAND perk: tick the per-target streak window. While the player
    // keeps landing direct hits on the same enemy, the takeDamage hook
    // refreshes _hotHandTimer to HOT_HAND_WINDOW each hit. If they stop
    // hitting (or switch to dash/movement-only play) for HOT_HAND_WINDOW
    // seconds the streak self-clears here so a stale target reference
    // can't carry through long disengagements (e.g. cross-room sprint).
    // The takeDamage hook handles the target-switch reset path
    // independently — this tick handles ONLY the timeout reset.
    if (this._hotHandTimer > 0) {
      this._hotHandTimer = Math.max(0, this._hotHandTimer - dt);
      if (this._hotHandTimer <= 0) {
        this._hotHandStreak = 0;
        this._hotHandLastTarget = null;
      }
    }
    // UNCHAINED #36 momentum: countdown damage-bonus window.
    NEON.behavior.tickMomentum(this, dt);
    // Tick timed boost windows (HARVEST_SURGE, etc.) — clears the activeBoosts
    // flag exactly when the timer expires so multipliers flip back the same
    // frame. Floor-duration boosts (COMBAT_STIM, etc.) are unaffected.
    if (NEON.boosts && NEON.boosts.tickBoosts) NEON.boosts.tickBoosts(this, dt);
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
      const noClip = playerCheatEnabled('noClip');
      if (tx>=0&&ty>=0&&tx<MAP_W&&ty<MAP_H && (noClip || isPassable(map[ty][tx]))) this.x=nx;
      else this.dashTimer=0; // hit wall, end dash early
      if (ox>=0&&oy>=0&&ox<MAP_W&&oy<MAP_H && (noClip || isPassable(map[oy][ox]))) this.y=ny;
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

    // SHIELD_BUBBLE hackware: dt-decrement the bubble timer. When timer
    // reaches 0 (bubble expired without being fully drained), zero
    // bubbleHp too AND emit a "BUBBLE EXPIRED" floater so the player
    // sees the buff drop. NOT gated on hp>0 (consistent with cloakTimer
    // ticking through death — the buff just disappears with the player;
    // no observable effect either way since a dead player doesn't get
    // hit again). The hp<=0 short-circuit in the takeDamage drain path
    // ALREADY zeroes both fields synchronously when the bubble breaks
    // from a hit; this branch only handles the timer-expiry path.
    // Self-clearing — no loadFloor reset needed (transient buff timer
    // mirrors cloakTimer/lastStandTimer pattern).
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
    spd *= NEON.boosts.getBoostSpeedMul(this); // UNCHAINED #38: REFLEX BOOSTER
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
      const noClip = playerCheatEnabled('noClip');
      if (tx>=0&&ty>=0&&tx<MAP_W&&ty<MAP_H && (noClip || isPassable(map[ty][tx]))) this.x=nx;
      if (ox>=0&&oy>=0&&ox<MAP_W&&oy<MAP_H && (noClip || isPassable(map[oy][ox]))) this.y=ny;
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
        // Use current aim direction (facing may be stale by one frame).
        // mouse.x/y are already in logical (post-zoom) coordinates —
        // normalised at the host boundary in src/platform.js — so the
        // conversion to world tiles is a plain `(mouse + cam) / TILE`
        // with no per-zoom correction. (Pre-global-UI-zoom this site
        // had a `/worldZoom` factor that was easy to forget; under
        // the current architecture there's nothing to forget.)
        const cam=getCamera(this);
        const ax=(mouse.x+cam.x)/TILE-this.x, ay=(mouse.y+cam.y)/TILE-this.y;
        [dx,dy]=norm(ax,ay);
        if (!dx&&!dy) { dx=this.facing.x; dy=this.facing.y; }
      }
      this.dashDx=dx; this.dashDy=dy;
      this.dashTimer=0.12;
      // GHOSTWALK meta upgrade: extend i-frame window past dash movement.
      // Movement still ends at dashTimer === 0 (0.12s); _dashIFrameTimer
      // keeps isPlayerDamageImmune true for the bonus window so the
      // player can still phase through env hazards / mob hits AFTER the
      // dash visually ends. Always set (not gated on bonus > 0) so the
      // base 0.12s window also flows through this gate — no behaviour
      // change for players without ghostwalk because the value matches
      // dashTimer's lifetime exactly when bonus is 0.
      this._dashIFrameTimer = 0.12 + (this.dashIFrameBonus || 0);
      const baseCd = this.perks.DASH_MASTER ? 0.75 : 1.5;
      // KINETIC floor modifier: -30% dash cooldown on this floor.
      // Composes multiplicatively with the DASH_MASTER perk (already
      // baked into baseCd) and metaFlags.dashCooldownMul (cross-run
      // meta-progression). Floor modifiers are mutually exclusive
      // per floor (only one rolls), so KINETIC cannot stack with
      // OVERFLOW or any other floor-level mobility buff. Mirrors the
      // AUTONOMY (hackware) / HARDENED (defense) / OVERFLOW (XP)
      // passive-multiplier pattern. Uses _EG.modifier — the canonical
      // engine floor-modifier ref — so a typo would silently disable
      // the bonus on every dash.
      const kineticMul = (_EG.modifier === 'KINETIC') ? 0.7 : 1;
      this.dashCooldown = baseCd * ((this.metaFlags && this.metaFlags.dashCooldownMul) || 1) * kineticMul;
      this.dashTrail.push({x:this.x,y:this.y,alpha:0.8});
      audio.dash();
      spawnParticles(this.x,this.y,'EXPLOSION','#ffb700',6);
    }

    // STRIDE perk: movement-built ATK stacks. Reads post-movement position
    // vs _prevX/_prevY (set at the top of update) and gates on a
    // tiles/sec rate threshold so frame-rate doesn't affect behaviour
    // (per the stored "stillness/rate trackers" rule). Dash frames take
    // the early `return` above and intentionally don't tick this — the
    // dash burst isn't "continuous movement". Suppressed when shocked
    // (movement is force-zeroed, so the rate test would already report
    // not-moving; the explicit gate just makes the intent obvious).
    // [tick:STRIDE]
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

    // DEADEYE perk: stillness-charged attack. Mirrors STRIDE's moved/dt
    // rate gate (per stored "stillness/rate trackers" rule — tiles/sec,
    // never tiles/frame, so 30/60/120 fps behave identically). Dash
    // frames take the early `return` above so they neither advance nor
    // clear the charge — a brief dash mid-charge preserves what's been
    // earned. shockTimer is checked because the player's movement is
    // force-zeroed during shock; without the explicit gate the rate
    // test would silently start charging during a stun lockdown.
    // Once _steadyReady latches it is NOT cleared by movement — only by
    // the next shoot() (or loadFloor reset). This is intentional: it
    // enables kite-then-snipe play. The cancel-partial-on-move branch
    // only zeroes _steadyChargeTime so the next still period restarts
    // from 0, never granting a free re-charge from buffered stillness.
    // [tick:DEADEYE]
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
    // SHIELD_BUBBLE hackware: cyan ring around player. Opacity scales
    // with REMAINING fraction of bubbleHp (35 max) so a near-broken
    // bubble looks visually weaker — gives the player a clear at-a-
    // glance read on remaining absorption capacity. Radius pulses on
    // a slower phase than the ENERGY_SHIELD perk ring (0.006 vs 0.004
    // rad/ms) so a player with BOTH active sees TWO distinguishable
    // rings at different cadences (no visual collision). Drawn AFTER
    // the perk ring so the bubble layers on top — the active hackware
    // is the more transient signal and benefits from being on top.
    // Colour #66ddff matches the catalog colour exactly so the icon-
    // to-effect mapping is visually consistent. Slightly LARGER radius
    // (14 vs perk's 12) so the two rings are visually distinct when
    // both active. Defensive guard: render only when both bubbleHp > 0
    // AND bubbleTimer > 0 (in case future code zeros only one of the
    // two — current code zeros both atomically but the AND guard is
    // free defense-in-depth).
    if (this.bubbleHp > 0 && this.bubbleTimer > 0) {
      ctx.save();
      const frac = Math.max(0.15, this.bubbleHp / 35);
      const pulse = 0.10 * Math.sin(performance.now() * 0.006);
      // Clamp to [0, 1]. At low bubbleHp (frac ≤ 0.33), the base
      // value 0.30 * frac drops below the pulse amplitude (0.10) and
      // the sum could go negative on the trough of the sin wave. Per
      // the HTML Canvas spec, setting globalAlpha to a value outside
      // [0, 1] is IGNORED, leaving the property at its previous value
      // (1.0 after ctx.save() restored from the outer context). The
      // result: the ring would render at FULL OPACITY for ~42% of the
      // pulse cycle at hp=1 — a jarring bright flash exactly when
      // the player wants smooth fade-out feedback. Clamping at the
      // assignment is the canonical defense (Math.max(0, ...) plus
      // an upper Math.min(1, ...) for symmetry, even though the
      // upper bound isn't reachable here). Caught by claude-opus-4.6
      // + gpt-5.5 reviews as MEDIUM severity. Mirrors the burn
      // indicator pattern at ~13543 which uses 0.35 ± 0.15 = always-
      // positive arithmetic (0.20-0.50) — but clamping is the more
      // robust defense than relying on arithmetic invariants.
      ctx.globalAlpha = Math.max(0, Math.min(1, 0.30 * frac + pulse));
      ctx.strokeStyle = '#e0e0ff';
      ctx.shadowBlur = 14; ctx.shadowColor = '#e0e0ff';
      ctx.lineWidth = 2.0;
      NEON.draw.circleStroke(ctx, sx, sy, 14);
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
    // SPAWN GRACE: pulsing cyan ring while grace timer is active.
    // Telegraphs to the player that they're temporarily invulnerable on
    // floor entry (matches isPlayerDamageImmune() spawn-grace branch in
    // src/content.js — keep in sync).
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
