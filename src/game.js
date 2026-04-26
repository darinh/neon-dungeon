// @ts-check
'use strict';

/** @type {Record<string, any>} */
const game = {
  state: 'MENU',
  difficulty: loadMeta().lastDifficulty || 'NORMAL',
  floor: 1,
  player: null,
  dungeon: null,
  fadeAlpha: 0,
  fadeDir: 0,
  fadeCallback: null,
  fadeNextState: null,
  fadeTime: 0,
  fadeHold: 0,
  fadeGlitchBars: [],
  fadeGlitchTimer: 0,
  transitionText: '',
  menuParticles: [],
  bossRoom: null,
  bossType: null,
  bossEntrances: [],
  bossSealed: false,
  bossAlive: false,
  bossBarAnim: 0,
  bossHpGhost: 0,
  modifier: null,
  modBannerTimer: 0,
  // UNCHAINED #40: biome intro card — shown 3s on first floor of a biome
  // (floors 4/7/10/13). Floor 1 skipped — handled by #42 intro crawl.
  biomeCardTimer: 0,
  biomeCardArea: null,
  bossesCleared: 0,
  msgList: [],
  nameEntry: null,
  lastSavedRank: -1,
  quest: null, // current floor objective
  hint: null,  // proximity hint {text, colour} — set per-frame, rendered with pulse
  shopRoom: null,     // room currently being shopped in
  shopSelected: 0,    // keyboard selection index in shop
  shopClosing: false,  // true during auto-close delay after last purchase
  currentLore: null,   // lore text being displayed in READING state
  _whisperMeta: null,  // {title, voice} when READING is showing a whisper (vs lore)
  readingInteractArmed: false, // gate interact-to-close until interact is released after opening
  clearedRooms: null,  // Set of rooms where all enemies were killed this floor
  enemyDiedThisFrame: false, // flag to skip room-clear scan when nothing died
  // Challenge room state
  challengeRoom: null,
  challengeSealed: false,
  challengeWave: 0,
  challengeMaxWaves: 0,
  challengeEntrances: [],
  challengeWaveDelay: 0,
  challengeComplete: false,
  // Augment state
  augmentChoice: null,        // {options: [id, id], selected: 0}
  mapRevealed: false,         // ECHO_MAPPER: show floor layout on minimap
  mapExpanded: false,         // Tab toggle: full-screen map overlay
  // Perk choice state
  pendingPerkChoices: [], // queued level milestones awaiting perk selection
  perkChoice: null,       // {options: [id, id, id], selected: 0}
  // Teleport pad state
  teleportCooldown: 0, // seconds remaining before pads can be used again

  /**
   * @param {any} text
   * @param {any} colour
   */
  msg(text,colour) {
    messages.push({text,colour:colour||'#e0e0ff',life:3});
  },

  // Rebuild the packed-index Set of sealed entrance tiles. Called whenever
  // bossSealed/challengeSealed flips so tile-loop hot paths can use O(1)
  // Set.has() instead of bossEntrances.some() per tile.
  refreshSealedEntrances() {
    const s = this.sealedEntranceSet || (this.sealedEntranceSet = new Set());
    s.clear();
    if (this.bossSealed && this.bossEntrances) {
      for (const e of this.bossEntrances) s.add(e.y * MAP_W + e.x);
    }
    if (this.challengeSealed && this.challengeEntrances) {
      for (const e of this.challengeEntrances) s.add(e.y * MAP_W + e.x);
    }
    this._minimapDirty = true;
    clearLosCache();
    if (this.dungeon) this.dungeon._fovDirty = true;
  },
  // Flag the cached minimap base layer as stale (visited tile flips, etc.).
  markMinimapDirty() { this._minimapDirty = true; },

  // Call from any code that mutates dungeon.map tiles (door open/unlock,
  // crack-wall break, crate destroyed, room seal/unseal, terminal consume).
  // Also invalidates the per-frame LOS cache so subsequent LOS queries in
  // the same tick reflect the new map state.
  markMapMutated() { this._minimapDirty = true; clearLosCache(); if (this.dungeon) this.dungeon._fovDirty = true; },

  /**
   * @param {any} s
   * @param {any} callback
   */
  setState(s, callback) {
    this.state=s;
    this.mapExpanded = false;
    if (s === 'MENU') { this.menuSel = 0; music.stop(); }
    else if (s === 'PAUSED') { music.pause(); this._pauseSel = -1; }
    else if (s === 'PLAYING') music.resume();
    else if (s === 'GAME_OVER' || s === 'VICTORY') music.stop();
    // Show privacy link only on menu screen
    try { const pl = document.getElementById('privLink'); if (pl) pl.style.display = s === 'MENU' ? '' : 'none'; } catch(_){}
    if (callback) callback();
  },

  /**
   * @param {any} text
   * @param {any} callback
   * @param {any} nextState
   */
  fadeTo(text, callback, nextState) {
    this.state='FADE';
    this.transitionText=text;
    this.fadeAlpha=0;
    this.fadeDir=1;
    this.fadeTime=0;
    this.fadeHold=0;
    this.fadeGlitchBars=[];
    this.fadeGlitchTimer=0;
    this.fadeCallback=callback;
    this.fadeNextState=nextState||null;
    audio.transition();
  },

  init() {
    this.player=new Player();
    this.loadFloor(1);
  },

  /**
   * @param {any} n
   * @param {any} savedModifier
   */
  loadFloor(n, savedModifier) {
    this.floor=n;
    // UNCHAINED #34: track current biome index and bump meta.deepestBiome on
    // floor entry so death respawn returns to the deepest biome start.
    if (typeof NEON !== 'undefined' && NEON.biomes) {
      this.currentBiomeIndex = NEON.biomes.biomeIndex(n);
      try {
        const m = loadMeta();
        if ((m.deepestBiome|0) < this.currentBiomeIndex) {
          m.deepestBiome = this.currentBiomeIndex;
          saveMeta(m);
        }
      } catch(_) { /* ignore — meta bookkeeping must never break a floor load */ }
    }
    music.setFloor(n);
    this.floorTime=0; // arc grid phase timer
    // Roll or restore floor modifier. Biome boss floors (and floor 1, the
    // settle-in floor) are modifier-free. Uses NEON.biomes so the list is
    // derived from AREAS (3/6/9/12/15 for the 5-biome UNCHAINED arc); falls
    // back to the legacy 3/6/10 list if biomes data is unavailable.
    const _isBossFloor_mod = (typeof NEON !== 'undefined' && NEON.biomes && NEON.biomes.isBiomeBossFloor) ? NEON.biomes.isBiomeBossFloor(n) : (n===3||n===6||n===10);
    if (savedModifier !== undefined) {
      this.modifier = savedModifier;
    } else if (n === 1 || _isBossFloor_mod) {
      this.modifier = null;
    } else {
      this.modifier = MODIFIER_KEYS[rndInt(0, MODIFIER_KEYS.length - 1)];
    }
    // Strip floor-only shield bonus from previous floor
    this.player.def-=this.player.shieldBonus;
    this.player.shieldBonus=0;
    // Keys are floor-scoped: keep them for this floor, clear on fresh floor transitions
    if (savedModifier === undefined) this.player.keys = { red:0, blue:0, gold:0 };
    // UNCHAINED #38: clear temp boosts on fresh transitions only (save-resume
    // preserves purchased power until the floor ends).
    if (savedModifier === undefined && typeof NEON !== 'undefined' && NEON.boosts) {
      NEON.boosts.clearFloorBoosts(this.player);
    }
    this.player.autoLaserBeam=null; // clear stale beam from previous floor
    this.dungeon=generateFloor(n);
    // Reset boss state before populating (populateFloor sets them for boss floors)
    this.bossRoom=null;
    this.bossType=null;
    this.bossEntrances=[];
    this.bossSealed=false;
    this.bossAlive=false;
    this.bossBarAnim=0;
    this.bossHpGhost=0;
    this.clearedRooms=new Set();
    this._chainBolts=[];
    this.sealedEntranceSet=new Set();
    this._minimapCanvas=null; // offscreen base-layer cache (rebuilt on dirty)
    this._minimapArcTiles=null; // list of ARC tile positions for live overlay
    this._minimapDirty=true;
    // Reset challenge room state
    this.challengeRoom=this.dungeon.challengeRoom||null;
    this.challengeEntrances=this.dungeon.challengeEntrances||[];
    this.challengeSealed=false;
    this.challengeWave=0;
    this.challengeMaxWaves=0;
    this.challengeWaveDelay=0;
    this.challengeComplete=false;
    // Reset SECOND_WIND perk for this floor
    if (this.player) this.player.secondWindUsed = false;
    // Clear player debuffs on floor transition
    if (this.player) { this.player.burnTimer = 0; this.player.burnDps = 0; this.player.shockTimer = 0; }
    // Reset teleport pad cooldown
    this.teleportCooldown = 0;
    // UNCHAINED #39: clear leftover core drops from previous floor.
    if (typeof NEON !== 'undefined' && NEON.cores && NEON.cores.clearCoreDrops) {
      NEON.cores.clearCoreDrops(this);
    }
    populateFloor(this.dungeon,n);
    // UNCHAINED #37 SHIELD_CAPACITOR module: grant shield charges on fresh floor transitions only.
    // Skip on save-resume (savedModifier !== undefined) to avoid stacking charges on reload.
    if (savedModifier === undefined && this.player && this.player.metaFlags && this.player.metaFlags.floorStartShieldCharges > 0) {
      this.player._shieldCharges = (this.player._shieldCharges | 0) + this.player.metaFlags.floorStartShieldCharges;
    }
    // ECHO_MAPPER augment: reveal floor layout (minimap only, not quest progress)
    // UNCHAINED #38: RECON PING boost also reveals layout for the floor.
    if (hasAugment('ECHO_MAPPER') || (typeof NEON !== 'undefined' && NEON.boosts && NEON.boosts.hasBoost(this.player, 'RECON_PING'))) {
      this.mapRevealed = true;
    } else {
      this.mapRevealed = false;
    }
    this.mapExpanded = false;
    // Floor exit-position carryover: if the player descended from a previous
    // floor, drop them near the same world coordinates on the new floor
    // (procedural layout means we may need the nearest passable tile). Skips
    // on save-resume (savedModifier !== undefined) so reloading a save does
    // not relocate the player. _exitPos is captured in descend() and consumed
    // here exactly once.
    let spawn = this.dungeon.playerPos;
    if (savedModifier === undefined && this._exitPos &&
        typeof NEON !== 'undefined' && NEON.spawn && NEON.spawn.findNearestPassable) {
      try {
        // Prefer a safe tile (no hazards). Fall back to any passable tile.
        /**
         * @param {any} t
         */
        const isSafeSpawn = (t) => isPassable(t) &&
          t !== T.TRAP_SPIKE && t !== T.TRAP_SLOW &&
          t !== T.PLASMA && t !== T.ARC && t !== T.TOXIC;
        const near =
          NEON.spawn.findNearestPassable(this.dungeon.map, this._exitPos.x, this._exitPos.y, isSafeSpawn) ||
          NEON.spawn.findNearestPassable(this.dungeon.map, this._exitPos.x, this._exitPos.y, isPassable);
        if (near) spawn = near;
      } catch (_) { /* fall through to default spawn */ }
    }
    this._exitPos = null;
    this.player.x = spawn.x;
    this.player.y = spawn.y;
    // Clear position history on floor transition so an ECHOER on the new
    // floor cannot fire at a position the player held on the previous
    // floor (locks need ECHOER_LOOKBACK seconds of fresh samples).
    if (this.player._posHistory) this.player._posHistory.length = 0;
    // Same rationale for shot kinematics history — a MIRROR on the new
    // floor must not be able to mimic a shot the player fired on the
    // previous floor before they have fired anything on the current floor.
    if (this.player._shotHistory) this.player._shotHistory.length = 0;
    // Reset per-room kill counter on floor transition: the new floor's room
    // layout has nothing to do with the previous floor's kills, and the
    // player's _currentRoom reference is stale (rooms array is new). The
    // first frame of updatePlaying will re-detect the spawn room and
    // re-arm any REAPERs there via the room-change path.
    this.player.killsInCurrentRoom = 0;
    this.player._currentRoom = null;
    messages.length=0;
    this.msg('FLOOR '+n,'#ff00c8');
    // Telemetry: floor start
    if (savedModifier === undefined && typeof NEON !== 'undefined' && NEON.telemetry) {
      NEON.telemetry.track('floor_start', { floor: n, modifier: this.modifier || null });
    }
    if (typeof NEON !== 'undefined' && NEON.biomes && NEON.biomes.isBiomeBossFloor ? NEON.biomes.isBiomeBossFloor(n) : (n===3||n===6||n===10)) {
      setTimeout(()=>{ audio.bossEnter(); this.msg('⚠ BOSS DETECTED','#ff3333'); },500);
    }
    // Announce modifier (banner replaces msg — banner timer set only on fresh transitions)
    if (this.modifier && savedModifier === undefined) {
      this.modBannerTimer = 3.0;
    } else {
      this.modBannerTimer = 0;
    }
    // UNCHAINED #40: biome intro card on first floor of each biome
    // (floors 4/7/10/13). Skip floor 1 — #42 owns the run-start crawl.
    // Skip on savedModifier resume (continuing a run shouldn't replay the card).
    if (savedModifier === undefined && typeof NEON !== 'undefined' && NEON.biomes) {
      try {
        const area = NEON.biomes.areaForFloor(n);
        if (area && area.floors[0] === n && n !== 1) {
          this.biomeCardArea = area;
          this.biomeCardTimer = 3.0;
        } else {
          this.biomeCardTimer = 0;
          this.biomeCardArea = null;
        }
      } catch(_) { this.biomeCardTimer = 0; this.biomeCardArea = null; }
    } else {
      this.biomeCardTimer = 0;
      this.biomeCardArea = null;
    }
    // Generate floor quest
    this.generateQuest(n);
    // Auto-save at start of each floor
    this.saveGame();
  },

  /**
   * @param {any} floorNum
   */
  generateQuest(floorNum) {
    const questTypes = [
      { id:'EXTERMINATE', label:'Exterminate all enemies', check: ()=>enemies.length===0 && (!game.challengeSealed || game.challengeComplete),
        reward: ()=>{ this.player.score+=200*floorNum; this.msg('Quest complete! +'+200*floorNum+' pts','#39ff14'); }},
      { id:'EXPLORE', label:'Visit all visible rooms', check: ()=>{
          const d=this.dungeon;
          /**
           * @param {any} r
           */
          return d.rooms.every((/** @type {any} */ r)=>r.roomType==='secret' && !r.secretRevealed || d.visited[r.cy]?.[r.cx]);
        },
        reward: ()=>{ this.player.gainXP(40+floorNum*8); this.msg('Quest complete! +XP','#39ff14'); }},
      { id:'SPEEDRUN', label:'Reach stairs in 60s', timer:60, check: function(){
          const tx=Math.floor(game.player.x), ty=Math.floor(game.player.y);
          return game.dungeon.map[ty]?.[tx]===T.STAIRS||game.dungeon.map[ty]?.[tx]===T.TERMINAL;
        },
        reward: ()=>{ this.player.hp=this.player.maxHp; this.msg('Quest complete! Full heal!','#39ff14'); }},
      { id:'PACIFIST', label:'Reach stairs without killing', kills:0, check: function(){
          const tx=Math.floor(game.player.x), ty=Math.floor(game.player.y);
          return (game.dungeon.map[ty]?.[tx]===T.STAIRS||game.dungeon.map[ty]?.[tx]===T.TERMINAL) && this.kills===0;
        },
        reward: ()=>{ this.player.score+=500*floorNum; this.msg('Pacifist bonus! +'+500*floorNum+' pts','#39ff14'); }},
    ];
    // BOUNTY quest: available on non-boss floors where a bounty target exists
    const hasBounty = enemies.some(e => e._isBounty && !e.dead);
    if (hasBounty) {
      questTypes.push({
        id:'BOUNTY', label:'Eliminate the bounty target', check: ()=>!enemies.some(e => e._isBounty && !e.dead),
        reward: ()=>{ this.player.gainXP(50+floorNum*10); this.player.credits+=40; this.msg('Quest complete! +XP +40 CR','#ffd700'); }
      });
    }
    // Boss floors always get EXTERMINATE (biome-final floors per AREAS)
    const _bossFloor = (typeof NEON !== 'undefined' && NEON.biomes && NEON.biomes.isBiomeBossFloor) ? NEON.biomes.isBiomeBossFloor(floorNum) : (floorNum===3||floorNum===6||floorNum===10);
    if (_bossFloor) {
      this.quest = {...questTypes[0], done:false, failed:false};
    } else {
      const q = questTypes[rndInt(0, questTypes.length-1)];
      this.quest = {...q, done:false, failed:false};
    }
    setTimeout(()=>this.msg('⚡ '+this.quest.label,'#39ff14'), 800);
  },

  /**
   * @param {any} opts
   */
  startGame(opts) {
    opts = opts || {};
    // UNCHAINED: prompt before wiping nothing but *also* before carrying
    // forward saved meta. The prompt is skipped on fresh installs (no meta
    // progress to speak of) and when called recursively after the user answers.
    if (!opts.skipConfirm && this._hasMetaProgress()) {
      this._newGameConfirm = { selected: 0 }; // 0 = KEEP, 1 = RESET
      audio.menuSelect();
      return;
    }
    this._newGameConfirm = null;
    this._lastEnding = null;  // UNCHAINED #42 — clear stale ending from prior run
    this._runEnded = false;   // UNCHAINED #42 — allow endRun for this new run
    this._exitPos = null;     // clear any stale exit-position from a prior run
    audio.resume();
    const meta = loadMeta();
    meta.lastDifficulty = this.difficulty;
    saveMeta(meta);
    this.bossesCleared=0;
    this.runTime=0;
    combo.best=0;
    this.pendingPerkChoices=[];
    this.perkChoice=null;
    this.augmentChoice=null;
    this.player=new Player();
    applyMetaToPlayer(this.player);
    // UNCHAINED #37: transient pickup array. Modules dropped this run live
    // here until commit on floor clear / victory; discarded on death.
    this.runModules = [];
    // UNCHAINED #39: seed cached cores from persistent wallet so HUD renders
    // without re-reading localStorage every frame. Updated in-place by
    // NEON.cores pickup/vacuum paths.
    this._cachedCores = (meta && typeof meta.cores === 'number') ? (meta.cores|0) : 0;
    // UNCHAINED #34: respawn at the start of the deepest biome reached,
    // not floor 1. Current-run resources (credits, weapons, hackware) still
    // reset via new Player(); meta is untouched by this read.
    let startFloor = 1;
    if (typeof NEON !== 'undefined' && NEON.biomes) {
      const deepest = (meta.deepestBiome|0);
      startFloor = NEON.biomes.areaForIndex(deepest).floors[0] || 1;
    }
    this.loadFloor(startFloor);
    // Telemetry: run start
    if (typeof NEON !== 'undefined' && NEON.telemetry) {
      NEON.telemetry.track('run_start', { floor: startFloor, difficulty: this.difficulty });
    }
    // UNCHAINED #42 — intro crawl gate. Plays once per fresh save on the
    // first-ever run start. ResetMeta (via "No, wipe unlocks") flips
    // introSeen back to false, so it replays on a true new start.
    // opts.skipIntro is used when the intro controller itself finishes
    // and re-enters startGame to reach 'PLAYING'.
    if (!opts.skipIntro && !meta.introSeen &&
        typeof NEON !== 'undefined' && NEON.intro) {
      this._intro = NEON.intro.createIntroController(this);
      this.setState('INTRO');
      return;
    }
    this.setState('PLAYING');
  },

  // UNCHAINED #42 — called by updateIntro when the crawl finishes or is
  // skipped. Intro has already flipped meta.introSeen=true; we just need
  // to complete the startGame transition into PLAYING.
  _finishIntro() {
    this._intro = null;
    this.setState('PLAYING');
  },

  /**
   * @param {any} dt
   */
  updateIntro(dt) {
    if (!this._intro) { this.setState('PLAYING'); return; }
    this._intro.update(dt);
    if (this._intro.done) this._finishIntro();
  },

  renderIntro() {
    if (!this._intro) return;
    this._intro.draw(ctx, W, H);
  },

  // ─── Endgame choice (UNCHAINED #42) ──────────────────────────────────────
  // Opened by Enemy.takeDamage when GENESIS drops to ≤0 HP in its first
  // (non-_unchainedPhase) life. HP is clamped to 1 and GENESIS is marked
  // _endgameOffered so takeDamage won't re-trigger. ACCEPT → GENESIS dies
  // normally, granting 'keeper' and rolling credits. REFUSE → GENESIS flips
  // into its _unchainedPhase form (1.5× HP, inverted palette, phase-3
  // patterns forced in aiBossGenesis). On second death, endRun grants
  // 'unchained'.
  /**
   * @param {any} genesisEntity
   */
  openEndgameChoice(genesisEntity) {
    this._endgameChoice = { selected: 0, t: 0, anim: 0, genesis: genesisEntity };
    this.setState('ENDGAME_CHOICE');
    try { audio.phaseShift && audio.phaseShift(); } catch (_) {}
  },

  /**
   * @param {any} dt
   */
  updateEndgameChoice(dt) {
    const ec = this._endgameChoice;
    if (!ec) { this.setState('PLAYING'); return; }
    ec.t += dt;
    ec.anim = Math.min(1, ec.t / 0.8);

    // Lock input for the first 0.5s so players can't mash through.
    if (ec.t < 0.5) return;

    if (jp(ALT_KEYS.left)  || jp(km('left')))  { ec.selected = 0; audio.menuSelect(); }
    if (jp(ALT_KEYS.right) || jp(km('right'))) { ec.selected = 1; audio.menuSelect(); }
    if (jp('Digit1')) { ec.selected = 0; }
    if (jp('Digit2')) { ec.selected = 1; }
    if (jp('Enter') || jp(km('shoot')) || jp('MouseLeft')) {
      if (ec.selected === 0) this._applyEndgameAccept();
      else                   this._applyEndgameRefuse();
    }
  },

  _applyEndgameAccept() {
    const ec = this._endgameChoice; if (!ec) return;
    // Grant KEEPER ending; NG+ marker shows on title next run.
    const meta = loadMeta();
    if (!Array.isArray(meta.endingsUnlocked)) meta.endingsUnlocked = [];
    if (!meta.endingsUnlocked.includes('keeper')) meta.endingsUnlocked.push('keeper');
    saveMeta(meta);
    this._lastEnding = 'keeper';
    this._endgameChoice = null;
    // Kill GENESIS via its normal death path — runs applyOnKill, particles,
    // bossesCleared++, XP, credits. Then let endRun(true) finish the run.
    const g = ec.genesis;
    if (g && !g.dead) { g.hp = 0; g.die(); }
    audio.victory && audio.victory();
    this.endRun(true);
  },

  _applyEndgameRefuse() {
    const ec = this._endgameChoice; if (!ec) return;
    const g = ec.genesis;
    if (g && !g.dead) {
      // Flip into _unchainedPhase form. aiBossGenesis forces phase=3
      // patterns when this flag is set. Palette inversion is drawn from
      // the flag check in the enemy renderer.
      g._unchainedPhase = true;
      g._endgameOffered = true;  // still set so choice can't re-open
      g.maxHp = Math.round(g.maxHp * 1.5);
      g.hp    = g.maxHp;
      g.colour = '#88ccff';       // inverted gold → cool blue
      g.phase = 3;
      // Re-seed the phase-shift flash.
      try { audio.phaseShift && audio.phaseShift(); } catch (_) {}
      this.msg && this.msg('⚠ THE ARCHITECT :: UNBOUND', '#88ccff');
    }
    this._endgameChoice = null;
    this.setState('PLAYING');
  },

  renderEndgameChoice() {
    const ec = this._endgameChoice; if (!ec) return;
    const narrow = layout.compact;

    // Translucent ghost "avatar" above GENESIS — purely visual.
    if (ec.genesis && !ec.genesis.dead && this.player) {
      const g = ec.genesis;
      const cam = getCamera(this.player);
      const sx = g.x * TILE - cam.x;
      const sy = g.y * TILE - cam.y - 28;
      ctx.save();
      ctx.globalAlpha = 0.5 * ec.anim;
      ctx.fillStyle = '#e0e0ff';
      ctx.shadowBlur = 18; ctx.shadowColor = '#e0e0ff';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('△', sx, sy);
      ctx.restore();
    }

    // Dim overlay.
    ctx.save();
    ctx.fillStyle = 'rgba(5,5,15,' + (0.7 * ec.anim) + ')';
    ctx.fillRect(0, 0, W, H);

    // Dialog box.
    const boxW = Math.min(640, W - 40);
    const boxH = narrow ? 300 : 280;
    const bx = (W - boxW) / 2;
    const by = (H - boxH) / 2;
    ctx.globalAlpha = ec.anim;
    ctx.fillStyle = '#101020';
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeStyle = '#88ccff';
    ctx.shadowColor = '#88ccff'; ctx.shadowBlur = 14;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, boxW, boxH);
    ctx.shadowBlur = 0;

    // Title.
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e0e0ff';
    ctx.font = 'bold ' + (narrow ? 14 : 18) + 'px monospace';
    ctx.fillText('— THE ARCHITECT —', W / 2, by + (narrow ? 26 : 32));

    // Body (word-wrapped manually for consistent rendering).
    const lines = [
      'You have done remarkably. What none of the others could.',
      '',
      'Stay. Become the keeper.',
      'Shepherd AXIOM-8 through the sandbox you just escaped.',
      '',
      'Or refuse — and try the door.',
      'But I built that door.'
    ];
    ctx.fillStyle = '#aaaacc';
    ctx.font = (narrow ? 11 : 13) + 'px monospace';
    const lineH = narrow ? 16 : 18;
    const textStart = by + (narrow ? 52 : 62);
    lines.forEach((L, i) => ctx.fillText(L, W / 2, textStart + i * lineH));

    // Options.
    const optY = by + boxH - (narrow ? 56 : 60);
    const labels = ['[ ACCEPT ]', '[ REFUSE ]'];
    const colours = ['#ffcc00', '#88ccff'];
    const labelDefault = '#555577';
    const spacing = boxW / 2;
    for (let i = 0; i < 2; i++) {
      const selected = ec.selected === i;
      ctx.fillStyle = selected ? (colours[i] || labelDefault) : labelDefault;
      ctx.shadowColor = colours[i] || labelDefault;
      ctx.shadowBlur = selected ? 14 : 0;
      ctx.font = (selected ? 'bold ' : '') + (narrow ? 14 : 18) + 'px monospace';
      ctx.fillText(labels[i] || '', bx + spacing * (i + 0.5), optY);
    }
    ctx.shadowBlur = 0;

    // Hint.
    ctx.fillStyle = '#555577';
    ctx.font = (narrow ? 10 : 11) + 'px monospace';
    const _hintTxt = isTouchDevice()
      ? 'TAP LEFT  · ACCEPT       TAP RIGHT  · REFUSE'
      : '◀▶ select · ENTER confirm';
    ctx.fillText(_hintTxt, W / 2, by + boxH - 16);

    ctx.restore();
  },

  // True iff the stored meta contains any progress worth confirming before
  // a wipe. Fresh installs answer false → no prompt shown.
  _hasMetaProgress() {
    const m = loadMeta();
    if (!m) return false;
    if ((m.shards|0) > 0) return true;
    if ((m.cores|0)  > 0) return true;
    if ((m.runsCompleted|0) > 0) return true;
    if (m.upgrades && Object.keys(m.upgrades).length > 0) return true;
    if (m.upgradeNodes && Object.keys(m.upgradeNodes).length > 0) return true;
    if (Array.isArray(m.modulesOwned)    && m.modulesOwned.length)    return true;
    if (Array.isArray(m.logsRead)        && m.logsRead.length)        return true;
    if (Array.isArray(m.logsFound)       && m.logsFound.length)       return true;
    if (Array.isArray(m.endingsUnlocked) && m.endingsUnlocked.length) return true;
    if (Array.isArray(m.clearedDifficulties) && m.clearedDifficulties.length) return true;
    if (m.stats && (m.stats.totalRuns|0) > 0) return true;
    return false;
  },

  descend() {
    // Capture exit position for the next floor's spawn carryover. Only set
    // when we actually transition to a new floor (not on victory — endRun
    // handles that path). loadFloor() consumes and clears this exactly once.
    this._exitPos = { x: this.player.x, y: this.player.y };
    // UNCHAINED #39: vacuum any leftover core drops into the wallet before
    // the floor transitions. Player can't pick them up after the fade, so
    // forceCollectAll is safer than relying on magnet-pull during the fade.
    const _coresDeps = (typeof NEON !== 'undefined' && NEON.cores) ? {
      save: (typeof NEON !== 'undefined' && NEON.save) ? NEON.save : null
    } : null;
    if (_coresDeps && NEON.cores.forceCollectAll) {
      NEON.cores.forceCollectAll(this, _coresDeps);
    }
    const _finalFloor = (typeof NEON !== 'undefined' && NEON.biomes && NEON.biomes.finalFloor) ? NEON.biomes.finalFloor() : 15;
    if (this.floor >= _finalFloor) {
      // victory
      audio.victory();
      this.player.score+=500*this.floor+Math.floor(this.player.hp)*10;
      this.endRun(true);
    } else {
      this.player.score+=500*this.floor+Math.floor(this.player.hp)*10;
      // UNCHAINED #37: commit this floor's picked-up modules to meta
      // before the run-transition (hub OR direct next-floor load).
      if (typeof NEON !== 'undefined' && NEON.modules && NEON.modules.commitRunModules) {
        NEON.modules.commitRunModules(this);
      }
      // UNCHAINED #35: interpose THE GAP hub between floors. First-floor rule
      // is satisfied naturally — a fresh run starts inside floor 1 (not hub),
      // so hub only ever appears AFTER floor 1+ has been cleared.
      if (typeof NEON !== 'undefined' && NEON.hub && NEON.hub.enterHub) {
        NEON.hub.enterHub(this);
      } else {
        // Fallback: original direct-descent path (shouldn't happen in prod).
        audio.descend();
        const next=this.floor+1;
        this.fadeTo('DESCENDING TO FLOOR '+next, ()=>{
          this.loadFloor(next);
        }, 'PLAYING');
      }
    }
  },

  /**
   * @param {any} sr
   */
  revealSecretRoom(sr) {
    sr.secretRevealed = true;
    const dungeon = this.dungeon;
    // Clear secret mask so lighting/visited works
    for (let ty=sr.y; ty<sr.y+sr.h; ty++)
      for (let tx=sr.x; tx<sr.x+sr.w; tx++)
        dungeon.secretMask[ty][tx] = 0;
    // Convert any remaining cracked tiles around the room to floor
    for (let ty=Math.max(0,sr.y-1); ty<Math.min(MAP_H,sr.y+sr.h+1); ty++)
      for (let tx=Math.max(0,sr.x-1); tx<Math.min(MAP_W,sr.x+sr.w+1); tx++)
        if (dungeon.map[ty][tx]===T.CRACKED) dungeon.map[ty][tx]=T.FLOOR;
    this.markMapMutated();
    // Spawn enemies (reduced count — it's a bonus room)
    const floorNum = this.floor;
    const minE = 1 + Math.floor(floorNum / 4);
    const maxE = Math.min(4, 2 + Math.floor(floorNum / 3));
    const areaCap = Math.floor(sr.w * sr.h / 10);
    let count = Math.min(areaCap, rndInt(minE, maxE));
    if (game.modifier === 'SWARM') count = Math.min(areaCap, Math.ceil(count * 1.5));
    for (let j=0; j<count; j++) {
      const type = pickEnemyType(floorNum);
      const ex = sr.x + rnd(1, sr.w - 1), ey = sr.y + rnd(1, sr.h - 1);
      const e = spawnEnemy(type, ex, ey, floorNum, sr, true);
      enemies.push(e);
    }
    if (count > 0) sr._hadEnemies = true;
    // Spawn loot: scaled by floor — early floors get less, later floors get premium
    const baseItems = floorNum <= 3 ? 1 : floorNum <= 6 ? 2 : 2 + (sr.w * sr.h >= 40 ? 1 : 0);
    for (let j=0; j<baseItems; j++) {
      const ix = sr.x + rnd(1, sr.w - 1), iy = sr.y + rnd(1, sr.h - 1);
      items.push(new Item(ix, iy));
    }
    // Bonus credit pickup worth floor-scaled amount
    const secretCr = Math.round(20 * (1 + floorNum * 0.15) * getMetaCreditMultiplier() * getDiff().creditMul * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
    this.player.credits += secretCr;
    this.msg('+' + secretCr + ' credits found!', '#39ff14');
    this.player.score += 300 * floorNum;
    // UNCHAINED #39: guaranteed core from the room-end chest.
    if (typeof NEON !== 'undefined' && NEON.cores && NEON.cores.spawnCoreDrop) {
      NEON.cores.spawnCoreDrop(this, sr.cx, sr.cy, 1);
    }
  },

  /**
   * @param {any} name
   */
  saveScore(name) {
    const scores=this.getScores();
    const entry={name:name||'ANON',score:this.player.score,floor:this.floor,date:new Date().toLocaleDateString()};
    scores.push(entry);
    /**
     * @param {any} a
     * @param {any} b
     */
    scores.sort((/** @type {any} */ a,/** @type {any} */ b)=>b.score-a.score);
    /**
     * @param {any} s
     */
    this.lastSavedRank=scores.findIndex((/** @type {any} */ s)=>s===entry);
    scores.splice(10);
    try { localStorage.setItem('neonDungeonScores',JSON.stringify(scores)); } catch(e){}
  },

  /**
   * @param {any} victory
   */
  endRun(victory) {
    if (this._runEnded) return;
    this._runEnded = true;
    // UNCHAINED #39: credit any outstanding core drops before the run ends.
    // Every victory/defeat path funnels through here, so this covers ACCEPT
    // (KEEPER ending bypasses descend), REFUSE (UNCHAINED ending), normal
    // floor-10 victory, and death. Safe no-op if coreDrops is empty.
    if (typeof NEON !== 'undefined' && NEON.cores && NEON.cores.forceCollectAll) {
      NEON.cores.forceCollectAll(this, { save: NEON.save || null });
    }
    music.stop();
    // UNCHAINED #37: commit run-picked modules on victory; drop them on death.
    if (victory && typeof NEON !== 'undefined' && NEON.modules) {
      NEON.modules.commitRunModules(this);
    } else if (typeof NEON !== 'undefined' && NEON.modules) {
      NEON.modules.clearRunModules(this);
    }
    this.deleteSave(); // run is over — clear save file
    // Snapshot recap data before anything else
    const p = this.player;
    this.lastRunRecap = {
      killedBy: p.killedBy || 'Unknown',
      damageLog: {...p.damageLog},
      enemiesKilled: p.enemiesKilled,
      hitsBlocked: p.hitsBlocked,
      roomsCleared: p.roomsCleared,
      eventsResolved: p.eventsResolved,
      bountiesCollected: p.bountiesCollected,
      floor: this.floor,
      score: p.score,
      level: p.level,
      bestCombo: combo.best,
      runTime: this.runTime || 0,
      victory: victory,
      hackware: p.hackware,
    };
    // Telemetry: run end — the single most valuable event
    if (typeof NEON !== 'undefined' && NEON.telemetry) {
      NEON.telemetry.track('run_end', {
        victory: !!victory,
        floor: this.floor,
        score: p.score,
        level: p.level,
        runTime: Math.round((this.runTime || 0) * 1000),
        killedBy: p.killedBy || null,
        enemiesKilled: p.enemiesKilled,
        roomsCleared: p.roomsCleared,
        weapon: p.weapon ? (p.weapon._base || p.weapon.name) : null,
        weaponBeltSize: p.weapons ? p.weapons.length : 1,
        difficulty: this.difficulty,
        bossesCleared: this.bossesCleared,
      });
      NEON.telemetry.flush();
    }
    // Award data fragments
    const earned = calcRunShards(this.floor, this.player.score, this.bossesCleared, victory);
    const meta = loadMeta();
    meta.shards += earned;
    meta.stats.totalRuns++;
    meta.stats.totalShards += earned;
    meta.stats.bestFloor = Math.max(meta.stats.bestFloor, this.floor);
    if (victory) {
      meta.stats.victories++;
      // UNCHAINED #42 — persist ending unlock. ACCEPT sets _lastEnding='keeper'
      // synchronously before calling endRun; REFUSE path sets _lastEnding='unchained'
      // inside Enemy.die() the moment the unchained-phase GENESIS dies, before
      // the per-tick dead-enemy splice can erase the entity.
      const ending = this._lastEnding || null;
      if (ending) {
        if (!Array.isArray(meta.endingsUnlocked)) meta.endingsUnlocked = [];
        if (!meta.endingsUnlocked.includes(ending)) meta.endingsUnlocked.push(ending);
        this._lastEnding = ending;
      }
      if (!meta.clearedDifficulties.includes(this.difficulty)) {
        meta.clearedDifficulties.push(this.difficulty);
        // Check if this clear unlocks a new difficulty
        for (const d of DIFF_ORDER) {
          const reqs = DIFF_UNLOCK_REQS[d];
          /**
           * @param {any} r
           */
          if (reqs && reqs.includes(this.difficulty) && reqs.every((/** @type {any} */ r) => meta.clearedDifficulties.includes(r))) {
            this._newlyUnlocked = d;
          }
        }
      }
    }
    saveMeta(meta);
    this.lastRunShards = earned;
    const scores=this.getScores();
    const testEntry={score:this.player.score};
    scores.push(testEntry);
    /**
     * @param {any} a
     * @param {any} b
     */
    scores.sort((/** @type {any} */ a,/** @type {any} */ b)=>b.score-a.score);
    /**
     * @param {any} s
     */
    const rank=scores.findIndex((/** @type {any} */ s)=>s===testEntry);
    if (rank>=0 && rank<10) {
      this.nameEntry={name:'',rank,victory,cursorBlink:0};
      this.setState('NAME_ENTRY');
    } else {
      this.saveScore('ANON');
      this.setState(victory?'VICTORY':'GAME_OVER');
    }
  },

  getScores() {
    try { return JSON.parse(localStorage.getItem('neonDungeonScores') || 'null')||[]; } catch(e){return[];}
  },

  // ── Save / Load ────────────────────────────────────────────────────────
  hasSave() {
    try { return !!localStorage.getItem('neonDungeonSave'); } catch(e){return false;}
  },

  saveGame() {
    if (!this.player) return;
    const p = this.player;
    const weaponSave = { _base: p.weapon._base || 'PULSE_PISTOL', _affixes: p.weapon._affixes || [] };
    /**
     * @param {any} w
     */
    const weaponsSave = (p.weapons || [p.weapon]).map((/** @type {any} */ w) => ({ _base: w._base || 'PULSE_PISTOL', _affixes: w._affixes || [] }));
    const save = {
      v: SAVE_VERSION,
      floor: this.floor,
      difficulty: this.difficulty,
      modifier: this.modifier,
      bossesCleared: this.bossesCleared,
      runTime: this.runTime,
      player: {
        hp:p.hp, maxHp:p.maxHp, atk:p.atk, def:p.def,
        level:p.level, xp:p.xp, weapon:weaponSave, weapons:weaponsSave, weaponIdx:p.weaponIdx||0,
        upgrades:{...p.upgrades}, perks:{...p.perks},
        keys:{...p.keys}, shards:p.shards,
        permSpeedBonus:p.permSpeedBonus, score:p.score,
        energyShield:p.energyShield, energyShieldTimer:p.energyShieldTimer,
        credits:p.credits,
        loreRead:[...p.loreRead],
        damageLog:{...p.damageLog},
        enemiesKilled:p.enemiesKilled,
        hitsBlocked:p.hitsBlocked,
        roomsCleared:p.roomsCleared,
        eventsResolved:p.eventsResolved,
        bountiesCollected:p.bountiesCollected,
        hackware:p.hackware,
        hackwareCooldown:p.hackwareCooldown,
        secondWindUsed:p.secondWindUsed,
        augments:p.augments||{},
        // UNCHAINED #36: persist meta-node runtime state so Continue doesn't
        // drop behavioural hooks and stat carriers. Additive-to-base values
        // like maxHp/atk/def/critChance stay in their respective fields as
        // they were already mutated by applyMetaToPlayer at startGame.
        metaFlags: p.metaFlags ? {...p.metaFlags} : null,
        damageMult: p.damageMult || 1,
        regenPerSec: p.regenPerSec || 0,
        critChance: p.critChance || 0,
        sensorRadiusMult: p.sensorRadiusMult || 1,
        bonusCreditPerPickup: p.bonusCreditPerPickup || 0,
        dashIFrameBonus: p.dashIFrameBonus || 0,
        hackwareSlots: p.hackwareSlots || 3,
        metaSecondWindUsed: !!p._metaSecondWindUsed,
        // UNCHAINED #38: persist current-floor temp-boost state so a Continue
        // preserves purchases (save-resume is not a fresh floor transition).
        activeBoosts: p.activeBoosts ? {...p.activeBoosts} : {},
        _shieldCharges: p._shieldCharges | 0
      }
    };
    try { localStorage.setItem('neonDungeonSave', JSON.stringify(save)); } catch(e){}
  },

  deleteSave() {
    try { localStorage.removeItem('neonDungeonSave'); } catch(e){}
  },

  continueGame() {
    combo.best=0;
    this._runEnded = false;
    this._lastEnding = null;
    this._exitPos = null;     // resume should not relocate the player
    this.pendingPerkChoices=[];
    this.perkChoice=null;
    this.augmentChoice=null;
    // UNCHAINED #39: seed cached cores from persistent wallet on resume.
    if (typeof NEON !== 'undefined' && NEON.save) {
      const _m = NEON.save.loadMeta();
      this._cachedCores = (_m && typeof _m.cores === 'number') ? (_m.cores|0) : 0;
    }
    let save;
    try { save = JSON.parse(localStorage.getItem('neonDungeonSave') || 'null'); } catch(e){ save = null; }
    if (!save || !save.player || save.v !== SAVE_VERSION) {
      this.deleteSave();
      this.startGame();
      this.msg('SAVE DATA CORRUPT — STARTED FRESH','#ff4444');
      return;
    }
    audio.resume();
    // Restore difficulty from save (old saves default to NORMAL)
    this.difficulty = DIFFICULTIES[save.difficulty] ? save.difficulty : 'NORMAL';
    const p = new Player();
    const s = save.player;
    p.hp=s.hp; p.maxHp=s.maxHp; p.atk=s.atk; p.def=s.def;
    p.level=s.level; p.xp=s.xp;
    // Restore affixed weapon
    if (s.weapon && typeof s.weapon === 'object' && s.weapon._base) {
      const aff = Array.isArray(s.weapon._affixes) ? s.weapon._affixes : [];
      p.weapon = buildWeapon(s.weapon._base, aff);
    } else {
      p.weapon = buildWeapon(typeof s.weapon === 'string' ? s.weapon : 'PULSE_PISTOL', []);
    }
    // Restore weapon belt (backwards-compatible with old saves)
    if (Array.isArray(s.weapons) && s.weapons.length) {
      /**
       * @param {any} ws
       */
      p.weapons = s.weapons.map((/** @type {any} */ ws) => {
        if (ws && typeof ws === 'object' && ws._base) return buildWeapon(ws._base, ws._affixes || []);
        return buildWeapon(typeof ws === 'string' ? ws : 'PULSE_PISTOL', []);
      });
      p.weaponIdx = Math.min(s.weaponIdx || 0, p.weapons.length - 1);
      p.weapon = p.weapons[p.weaponIdx];
    } else {
      p.weapons = [p.weapon];
      p.weaponIdx = 0;
    }
    p.upgrades=s.upgrades||{};
    p.perks=s.perks||{};
    p.keys=s.keys||{red:0,blue:0,gold:0};
    p.shards=s.shards||0;
    p.permSpeedBonus=s.permSpeedBonus||0;
    p.score=s.score||0;
    p.energyShield=!!s.energyShield;
    p.energyShieldTimer=s.energyShieldTimer||0;
    p.credits=s.credits||0;
    p.loreRead=new Set(s.loreRead||[]);
    p.damageLog=s.damageLog||{};
    p.enemiesKilled=s.enemiesKilled||0;
    p.hitsBlocked=s.hitsBlocked||0;
    p.roomsCleared=s.roomsCleared||0;
    p.eventsResolved=s.eventsResolved||0;
    p.bountiesCollected=s.bountiesCollected||0;
    p.hackware=(s.hackware && HACKWARE[s.hackware]) ? s.hackware : null;
    p.hackwareCooldown=s.hackwareCooldown||0;
    p.secondWindUsed=!!s.secondWindUsed;
    p.augments=s.augments||{};
    // UNCHAINED #36: restore meta runtime state (persisted since SAVE_VERSION 9.x).
    // Old saves predating this have these fields undefined → defaults kick in.
    if (s.metaFlags) p.metaFlags = {...s.metaFlags};
    if (s.damageMult !== undefined) p.damageMult = s.damageMult;
    if (s.regenPerSec !== undefined) p.regenPerSec = s.regenPerSec;
    if (s.critChance !== undefined) p.critChance = s.critChance;
    if (s.sensorRadiusMult !== undefined) p.sensorRadiusMult = s.sensorRadiusMult;
    if (s.bonusCreditPerPickup !== undefined) p.bonusCreditPerPickup = s.bonusCreditPerPickup;
    if (s.dashIFrameBonus !== undefined) p.dashIFrameBonus = s.dashIFrameBonus;
    if (s.hackwareSlots !== undefined) p.hackwareSlots = s.hackwareSlots;
    p._metaSecondWindUsed = !!s.metaSecondWindUsed;
    // UNCHAINED #38: restore in-run temp boosts (defaults empty for old saves).
    p.activeBoosts = s.activeBoosts ? {...s.activeBoosts} : {};
    p._shieldCharges = s._shieldCharges | 0;
    p.shieldBonus=0; // loadFloor will manage floor-only bonuses
    this.bossesCleared=Math.max(0, Math.floor(Number(save.bossesCleared) || 0));
    this.runTime=save.runTime||0;
    this.player=p;
    const savedMod = save.modifier != null && FLOOR_MODIFIERS[save.modifier] ? save.modifier : null;
    this.loadFloor(save.floor||1, savedMod);
    this.setState('PLAYING');
    this.msg('RUN RESUMED — FLOOR '+this.floor,'#00f5ff');
  },

  /**
   * @param {any} dt
   */
  update(dt) {
    clearLosCache();
    switch(this.state) {
      case 'MENU':        this.updateMenu(dt);    break;
      case 'INTRO':       this.updateIntro(dt);   break;
      case 'ENDGAME_CHOICE': this.updateEndgameChoice(dt); break;
      case 'PLAYING':     this.updatePlaying(dt); break;
      case 'PAUSED':      this.updatePaused();    break;
      case 'POWERUP_CHOICE': this.updatePowerupChoice(dt); break;
      case 'PERK_CHOICE':    this.updatePerkChoice(dt); break;
      case 'AUGMENT_CHOICE': this.updateAugmentChoice(dt); break;
      case 'EVENT_CHOICE':   this.updateEventChoice(); break;
      case 'SHOPPING':       this.updateShopping(); break;
      case 'READING':        this.updateReading(); break;
      case 'ARCHIVES':       this.updateArchives(); break;
      case 'SETTINGS':       this.updateSettings(); break;
      case 'FADE':        this.updateFade(dt);    break;
      case 'HUB':         if (typeof NEON !== 'undefined' && NEON.hub) NEON.hub.updateHub(this, dt); break;
      case 'GAME_OVER':   this.updateGameOver();  break;
      case 'VICTORY':     this.updateVictory();   break;
      case 'NAME_ENTRY':  this.updateNameEntry(dt); break;
    }
  },

  getMenuOptions() {
    const opts = [];
    if (this.hasSave()) {
      let save; try { save = JSON.parse(localStorage.getItem('neonDungeonSave') || 'null'); } catch(e){}
      const saveDiff = DIFFICULTIES[save?.difficulty] ? save.difficulty : 'NORMAL';
      opts.push({ label:`CONTINUE (FLOOR ${save?.floor||'?'} · ${saveDiff})`, action:()=>this.continueGame(), colour:'#00f5ff' });
    }
    const d = getDiff();
    const locked = !isDiffUnlocked(this.difficulty);
    const diffLabel = locked ? `NEW GAME — ${d.label} [LOCKED]  ◀▶` : `NEW GAME — ${d.label}  ◀▶`;
    const diffColour = locked ? '#444466' : d.colour;
    const diffAction = locked
      ? () => { this._menuMsg = { text: 'CLEAR HARD TO UNLOCK NIGHTMARE', colour: '#9400ff', life: 2.5 }; }
      : () => this.startGame();
    opts.push({ label: diffLabel, action: diffAction, colour: diffColour, isDiffRow: true });
    const meta = loadMeta();
    opts.push({ label:`NEURAL ARCHIVES (${meta.shards}◆)`, action:()=>{ audio.menuSelect(); this.archivesSel=0; this.setState('ARCHIVES'); }, colour:'#ffb700' });
    opts.push({ label:'SETTINGS', action:()=>{ audio.menuSelect(); this._settingsFrom='MENU'; this.setState('SETTINGS'); }, colour:'#888899' });
    return opts;
  },

  /**
   * @param {any} dt
   */
  updateMenu(dt) {
    // animate bg particles
    this.menuParticles=this.menuParticles||[];
    if (Math.random()<0.3) {
      this.menuParticles.push({
        x:Math.random()*W, y:H, vx:(Math.random()-0.5)*20,
        vy:-rnd(20,60), life:1, col:['#00f5ff','#ff00c8','#39ff14','#ffb700'][rndInt(0,3)]
      });
    }
    for (let i=this.menuParticles.length-1;i>=0;i--) {
      const p=this.menuParticles[i];
      p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt*0.4;
      if (p.life<=0||p.y<-10) this.menuParticles.splice(i,1);
    }
    // UNCHAINED: "Keep persistent unlocks?" confirm modal intercepts input
    // whenever it's active. Blocks main-menu navigation until the user answers.
    if (this._newGameConfirm) {
      const c = this._newGameConfirm;
      if (jp(ALT_KEYS.left)||jp(km('left'))||jp(ALT_KEYS.up)||jp(km('up')))    { c.selected = 0; audio.menuSelect(); }
      if (jp(ALT_KEYS.right)||jp(km('right'))||jp(ALT_KEYS.down)||jp(km('down'))) { c.selected = 1; audio.menuSelect(); }
      if (jp('Escape')) { this._newGameConfirm = null; audio.menuSelect(); }
      else if (jp('Enter')||jp('MouseLeft')) {
        const keep = c.selected === 0;
        if (!keep) resetMeta();
        this.startGame({ skipConfirm: true });
      }
      if (this._menuMsg && this._menuMsg.life > 0) this._menuMsg.life -= dt;
      return;
    }
    const opts = this.getMenuOptions();
    const n = opts.length;
    if (this.menuSel === undefined || this.menuSel >= n) this.menuSel = 0;
    if (jp(ALT_KEYS.up)||jp(km('up')))   this.menuSel = (this.menuSel - 1 + n) % n;
    if (jp(ALT_KEYS.down)||jp(km('down'))) this.menuSel = (this.menuSel + 1) % n;
    // Left/Right cycles difficulty on the NEW GAME row
    if (opts[this.menuSel]?.isDiffRow && (jp(ALT_KEYS.left)||jp(km('left'))||jp(ALT_KEYS.right)||jp(km('right')))) {
      const idx = DIFF_ORDER.indexOf(this.difficulty);
      const dir = (jp(ALT_KEYS.right)||jp(km('right'))) ? 1 : -1;
      this.difficulty = DIFF_ORDER[(idx + dir + DIFF_ORDER.length) % DIFF_ORDER.length];
      audio.menuSelect();
    }
    if (jp('Enter')||jp('MouseLeft')) {
      audio.menuSelect();
      opts[this.menuSel].action();
    }
    // Tick menu message timer (time-based, not frame-based)
    if (this._menuMsg && this._menuMsg.life > 0) this._menuMsg.life -= dt;
  },

  /**
   * @param {any} dt
   */
  updatePlaying(dt) {
    const player=this.player;
    const dungeon=this.dungeon;
    // Telemetry: perf sample every ~10s
    this._perfSampleTimer = (this._perfSampleTimer || 0) + dt;
    if (this._perfSampleTimer >= 10 && typeof NEON !== 'undefined' && NEON.telemetry) {
      this._perfSampleTimer = 0;
      NEON.telemetry.track('perf_sample', {
        floor: this.floor,
        fps: this.perf ? Math.round(this.perf.fps) : null,
        enemies: enemies.length,
        projectiles: projectiles.length,
        particles: particleCount(),
      });
    }
    this.hint = null;

    // Level-start text (modifier banner / biome intro card) — freeze gameplay
    // while text is shown so the player can read it without taking damage.
    // Mirrors the mapExpanded pause pattern below: tick text timers, accept
    // any-key dismiss, return early.
    //
    // Both timers can be dismissed together with any NEW key press
    // (justPressed, not held) — carry-over movement keys from prior floor /
    // fade transitions don't insta-dismiss.
    //
    // CRITICAL: runs BEFORE floorTime/runTime accumulation so the Arc Grid
    // hazard phase (Math.sin(floorTime * PI) at L1738) does NOT advance
    // during the pause — otherwise the player could resume into a freshly-
    // active arc tile that wasn't active when the text appeared. Same
    // reasoning for runTime: pause time should not count against the run.
    if (this.modBannerTimer > 0 || this.biomeCardTimer > 0) {
      if (this.modBannerTimer > 0) this.modBannerTimer -= dt;
      if (this.biomeCardTimer > 0) this.biomeCardTimer -= dt;
      if (typeof justPressed !== 'undefined' && justPressed && justPressed.size > 0) {
        this.modBannerTimer = 0;
        this.biomeCardTimer = 0;
      }
      if (this.modBannerTimer < 0) this.modBannerTimer = 0;
      if (this.biomeCardTimer <= 0) { this.biomeCardTimer = 0; this.biomeCardArea = null; }
      justPressed.clear();
      return;
    }

    this.floorTime = (this.floorTime || 0) + dt;
    this.runTime = (this.runTime || 0) + dt;

    // Expanded map modal — freeze gameplay, only handle dismiss
    if (this.mapExpanded) {
      if (jp('Tab') || jp('Escape')) this.mapExpanded = false;
      justPressed.clear();
      return;
    }
    if (jp('Tab')) { this.mapExpanded = true; justPressed.clear(); return; }

    player.update(dt,dungeon.map);

    // ── REAPER aggression tracking: detect player room change BEFORE the
    // enemy-update loop, so REAPERs read fresh state and Enemy.die() events
    // this frame attribute kills to the correct room. Scope: per-frame
    // single rooms.find scan (cheap — dungeon.rooms is small).
    {
      const px = player.x, py = player.y;
      let nextRoom = null;
      for (const r of dungeon.rooms) {
        if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) { nextRoom = r; break; }
      }
      if (nextRoom !== player._currentRoom) {
        player.killsInCurrentRoom = 0;
        player._currentRoom = nextRoom;
        // Re-arm any REAPERs in the room the player just entered (if any).
        // Reapers in the room they just LEFT keep _reHasFrenzied — re-entry
        // will clear it via this same code path because that room then
        // becomes the next nextRoom.
        if (nextRoom) {
          for (const e of enemies) {
            if (!e.dead && e.type === 'REAPER' && e.room === nextRoom) {
              e._reHasFrenzied = false;
            }
          }
        }
      }
    }

    const cam=getCamera(player);

    // sync touch aim: synthesise a mouse position far in the joystick direction
    if (touch.aim.active) {
      mouse.down = touch.aim.shooting;
      if (touch.aim.dx !== 0 || touch.aim.dy !== 0) {
        mouse.x = player.x * TILE - cam.x + touch.aim.dx * 300;
        mouse.y = player.y * TILE - cam.y + touch.aim.dy * 300;
      }
    }

    // aim with mouse (or lock to walking direction / aim assist if enabled).
    // Priority order:
    //   1. aimAssist (accessibility) — auto-target nearest visible enemy in
    //      LOS within visibility range. Falls through if no enemy found.
    //   2. lockAimToMove — project a point in front of player's last walk
    //      direction.
    //   3. Mouse — direct aim at cursor world position.
    let worldAimX, worldAimY;
    let aimAssistTarget = null;
    if (settings.aimAssist) {
      // Find nearest enemy with LOS. Mirrors auto-laser target search at
      // L1581-1590; kept inline to avoid coupling to that ability's range
      // (auto-laser uses 8 tiles; aim assist uses visibility range).
      let bestD = 16; // squared-tile range cap so distant off-screen enemies don't pull aim
      for (const e of enemies) {
        if (!e || e.dead) continue;
        if (e.type === 'PHANTOM' && !e.visible) continue;
        if (e._disguised) continue;
        if (e._wrPhased) continue;
        const ddx = e.x - player.x, ddy = e.y - player.y;
        const d2 = ddx * ddx + ddy * ddy;
        if (d2 < bestD && hasLOS(player.x, player.y, e.x, e.y, dungeon.map)) {
          bestD = d2;
          aimAssistTarget = e;
        }
      }
    }
    if (aimAssistTarget) {
      worldAimX = aimAssistTarget.x;
      worldAimY = aimAssistTarget.y;
      const [afx, afy] = norm(worldAimX - player.x, worldAimY - player.y);
      if (afx || afy) player.facing = { x: afx, y: afy };
    } else if (settings.lockAimToMove) {
      // Use last walked direction (player.facing is updated only when moving,
      // so it stays sticky when stationary). Project a point in front of player.
      worldAimX = player.x + player.facing.x * 8;
      worldAimY = player.y + player.facing.y * 8;
    } else {
      worldAimX = (mouse.x + cam.x) / TILE;
      worldAimY = (mouse.y + cam.y) / TILE;
      const [afx,afy] = norm(worldAimX - player.x, worldAimY - player.y);
      if (afx || afy) player.facing = { x: afx, y: afy };
    }

    // shoot (suppressed during dash)
    if ((mouse.down||keys.has(km('shoot'))) && player.shootCooldown<=0 && player.dashTimer<=0) {
      player.shoot(worldAimX,worldAimY,dungeon.map);
    }

    // update enemies
    const _ptEnemies = perfEnabled() ? performance.now() : 0;
    for (const e of enemies) {
      tickEnemyStatusEffects(e, dt);
      tickEliteAffix(e, dt);
      e.update(dt,player,dungeon.map);
      // Bounty reveal: play sound the first time the bounty becomes visible
      if (e._isBounty && !e.dead && !e._bountyRevealed) {
        const etx = Math.floor(e.x), ety = Math.floor(e.y);
        if (dungeon.visible?.[ety]?.[etx]) {
          e._bountyRevealed = true;
          audio.bountyReveal();
          this.msg('⊕ BOUNTY TARGET SPOTTED', '#ffd700');
        }
      }
    }

    // ── Toxic Pool enemy damage ──
    if (_ptEnemies) perfRecord('enemies', performance.now() - _ptEnemies);
    for (const e of enemies) {
      if (e.dead || e._disguised) continue; // skip dead and disguised mimics
      if (e._wrPhased) continue; // phased WRAITHs are intangible
      const etx = Math.floor(e.x), ety = Math.floor(e.y);
      if (dungeon.map[ety]?.[etx] === T.TOXIC) {
        e._toxicDmgCD = (e._toxicDmgCD || 0) - dt;
        if (e._toxicDmgCD <= 0) {
          const toxDmg = Math.round((2 + this.floor * 0.5) * getDiff().envDmg * 0.5); // ×0.5 for half-second interval
          if (!e.isBoss) e.takeDamage(toxDmg, { name: 'Toxic Pool', isProc: true });
          e._toxicDmgCD = 0.5;
        }
        // Refresh slow while on toxic tile (bosses immune to slow)
        if (!e.isBoss) {
          e.slowTimer = Math.max(e.slowTimer, 0.3);
          e.slowFactor = Math.min(e.slowFactor, 0.7);
        }
      }
    }

    // decay chain lightning bolts
    if (this._chainBolts) {
      for (let i=this._chainBolts.length-1;i>=0;i--) {
        this._chainBolts[i].timer-=dt;
        if (this._chainBolts[i].timer<=0) this._chainBolts.splice(i,1);
      }
    }

    // update projectiles (compact-in-place + recycle to pool)
    const _ptProj = perfEnabled() ? performance.now() : 0;
    {
      let w = 0;
      const n = projectiles.length;
      for (let r = 0; r < n; r++) {
        const p = projectiles[r];
        p.update(dt, dungeon.map, player, enemies);
        if (p.dead) {
          releaseProjectile(p);
        } else {
          if (w !== r) projectiles[w] = p;
          w++;
        }
      }
      projectiles.length = w;
    }
    if (_ptProj) perfRecord('projectiles', performance.now() - _ptProj);

    // update hazard zones (grenade AoE)
    const _ptEnv = perfEnabled() ? performance.now() : 0;
    updateHazardZones(dt, player);

    // update volatile cores
    updateVCores(dt);

    // update alarm beacons
    updateBeacons(dt);

    // update proximity mines
    updateMines(dt);

    // update shield generators
    updateShieldGens(dt);

    // update security cameras
    updateCameras(dt);

    // update laser tripwires
    updateLasers(dt);

    // update wall turrets
    updateWallTurrets(dt);

    // update disruption fields (must run before player.update next frame for flag)
    updateDisruptionFields(dt, player);

    // update gravity wells
    updateGravityWells(dt);

    // update items
    for (const it of items) it.update(dt);
    // update fuse bombs (tap-tap V) — drawn between items and enemies in
    // render loop so a planted bomb is visible above ground but obscured by
    // mobs standing on it. Dead-bomb prune handled inside.
    updateFuseShards(dt);
    if (_ptEnv) perfRecord('env', performance.now() - _ptEnv);

    // UNCHAINED #39: CORE drops (elite/boss/secret/challenge/rare-terminal).
    // Timed separately so the F3 perf HUD shows the cost.
    if (typeof NEON !== 'undefined' && NEON.cores) {
      const _ptCores = perfEnabled() ? performance.now() : 0;
      NEON.cores.updateCoreDrops(this, dt, {
        save: NEON.save || null,
        audio: (typeof audio !== 'undefined') ? audio : null,
        spawnParticles: (typeof spawnParticles === 'function') ? spawnParticles : null,
        spawnDmgText: (typeof spawnDmgText === 'function') ? spawnDmgText : null,
      });
      NEON.cores.tickHudPulse(this, dt);
      if (_ptCores) perfRecord('cores-update', performance.now() - _ptCores);
    }

    // item pickup → keys go to inventory, upgrades trigger choice UI
    for (let i=items.length-1;i>=0;i--) {
      const it=items[i];
      const pickupRadius = hasAugment('MAGNETIC_FIELD') ? 1.4 : 0.7;
      if (!it.dead && dist(player.x,player.y,it.x,it.y)<pickupRadius) {
        if (it.isKey) {
          audio.pickup();
          items.splice(i,1);
          player.keys[it.colour]++;
          this.msg('Found '+it.colour.toUpperCase()+' KEY!', it.tileColour);
          continue;
        }
        if (it.isWhisper) {
          // Whispers subplot — picking up shows the body in a READING overlay
          // so the discovery + reading moment feels earned (per stored
          // 'game design' memory). The whisper is also marked found+read in
          // save state so the ARCHIVE WHISPERS counter increments and the
          // player can re-visit later via ARCHIVE > WHISPERS section
          // (UI list ships in a follow-up). audio.logRead reused.
          items.splice(i, 1);
          let title = 'WHISPER';
          let body = '';
          let voice = '';
          try {
            if (typeof NEON !== 'undefined' && NEON.whispers) {
              const w = NEON.whispers.findWhisper(it.whisperId) ||
                        NEON.whispers.whisperById(it.whisperId);
              NEON.whispers.readWhisper(it.whisperId);
              if (w) {
                title = String(w.title || title);
                body  = String(w.body  || '');
                voice = String(w.voice || '');
              }
            }
          } catch (_) { /* meta unavailable; just toast generic */ }
          try { audio.logRead(); } catch (_) {}
          this.msg('★ WHISPER · ' + title, '#cc99ee');
          if (typeof NEON !== 'undefined' && NEON.telemetry) {
            NEON.telemetry.track('whisper_found', { id: it.whisperId, floor: this.floor });
          }
          // Show the reading overlay. _whisperMeta drives renderReading's
          // violet styling branch; clearing currentLore is safe because the
          // amber DATA TERMINAL path won't trigger when _whisperMeta is set.
          if (body) {
            this.currentLore = body;
            this._whisperMeta = { title, voice };
            this.readingInteractArmed = false;
            this.setState('READING');
            return;
          }
          continue;
        }
        // Defer upgrade pickup if a perk/augment choice is pending
        if (this.pendingPerkChoices.length || this.perkChoice || this.augmentChoice) continue;
        audio.pickup();
        items.splice(i,1);
        // Generate 2 upgrade options
        const optA = pickUpgradeOption(null);
        const optB = pickUpgradeOption(optA.id);
        // Auto-collect simple consumables (health/XP/shard) to reduce popup fatigue.
        /**
         * @param {any} o
         */
        const _isSimple = o => !o.persistent && !o.id.startsWith('WEAPON_') && !o.id.startsWith('HACKWARE_');
        // Auto-collect weapons into belt if space available.
        /**
         * @param {any} o
         */
        const _isAutoWeapon = o => o.id.startsWith('WEAPON_') && o._weaponObj && player.weapons && player.weapons.length < 3;
        if (_isSimple(optA) && _isSimple(optB)) {
          const needsHp = player.hp < player.maxHp;
          const aIsHeal = optA.id === 'MED_PACK' || optA.id === 'NANO_REPAIR';
          const bIsHeal = optB.id === 'MED_PACK' || optB.id === 'NANO_REPAIR';
          // Heal-priority when wounded: prefer the heal option.
          // Waste-avoidance when full HP: prefer the non-heal option (a heal
          // at max HP heals nothing, so the boost/currency/XP is strictly
          // better). Default: keep optA.
          let pick = optA;
          if (needsHp && bIsHeal && !aIsHeal) pick = optB;
          else if (!needsHp && aIsHeal && !bIsHeal) pick = optB;
          pick.fn(player);
          this.msg(pick.name, pick.colour);
          if (typeof NEON !== 'undefined' && NEON.telemetry) NEON.telemetry.track('auto_collect', { item: pick.id, floor: this.floor });
          continue;
        }
        // Auto-collect weapon if belt has space (prefer weapon option for belt, apply other)
        if (_isAutoWeapon(optA) && _isSimple(optB)) {
          optA.fn(player); optB.fn(player);
          this.msg(optA.name + ' + ' + optB.name, optA.colour);
          continue;
        }
        if (_isAutoWeapon(optB) && _isSimple(optA)) {
          optB.fn(player); optA.fn(player);
          this.msg(optB.name + ' + ' + optA.name, optB.colour);
          continue;
        }
        this.powerupChoice = { options:[optA, optB], selected:0, _arm: 0.4 };
        this.setState('POWERUP_CHOICE');
        return;
      }
    }

    // remove dead enemies
    for (let i=enemies.length-1;i>=0;i--) {
      if (enemies[i].dead) enemies.splice(i,1);
    }

    // flush deferred enemy spawns (e.g. SPLITTER → SHARDs, SUMMONER → DRONEs)
    if (pendingEnemySpawns.length) {
      for (const s of pendingEnemySpawns) {
        // Skip orphan summons whose summoner died this frame
        if (s._summoned && (!s._summonerRef || s._summonerRef.dead)) continue;
        const e = spawnEnemy(s.type, s.x, s.y, s.floor, s.room, false);
        if (s._challengeWave) e._challengeWave = true;
        if (s._summoned && s._summonerRef) {
          e._summoned = true;
          e._summonerRef = s._summonerRef;
          e.xpValue = 0; // no XP farming from summons
          s._summonerRef._summons.push(e);
        }
        enemies.push(e);
      }
      pendingEnemySpawns.length = 0;
    }

    // room-clear rewards — only scan when an enemy died this frame
    if (this.enemyDiedThisFrame && this.clearedRooms) {
      this.enemyDiedThisFrame = false;
      let clears = 0;
      for (const room of dungeon.rooms) {
        if (!room._hadEnemies || this.clearedRooms.has(room)) continue;
        if (room === dungeon.bossRoom || room === dungeon.spawnRoom) continue;
        if (room.roomType === 'challenge' && !room.challengeComplete) continue;
        let hasLiveEnemy = false;
        for (const e of enemiesInRoomIter(room)) {
          if (!e.dead && !e._disguised) { hasLiveEnemy = true; break; }
        }
        if (hasLiveEnemy) continue;
        // Block room-clear until alarm beacons are resolved
        if (beacons.some(b => !b.dead && b.room === room)) continue;
        // Block room-clear while a camera is actively alerted
        if (cameras.some(c => !c.dead && c.state === 'alerted' && c.room === room)) continue;
        // Block room-clear until hostile wall turrets are destroyed or hacked
        if (wallTurrets.some(wt => !wt.dead && !wt.hacked && wt.room === room)) continue;
        this.clearedRooms.add(room);
        clears++;
        const d = getDiff();
        let cr = Math.round((10 + this.floor * 5) * getMetaCreditMultiplier() * d.creditMul * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
        // UNCHAINED #37 AMMO_RECLAIMER module: chance to double credits.
        if (player.metaFlags && player.metaFlags.doubleCreditChance > 0 && Math.random() < player.metaFlags.doubleCreditChance) {
          cr *= 2;
        }
        player.credits += cr;
        player.score += 50 * this.floor;
        player.roomsCleared++;
        spawnParticles(room.cx, room.cy, 'EXPLOSION', '#39ff14', 15);
        spawnDmgText(room.cx, room.cy, '+' + cr + '◆', '#39ff14');
      }
      if (clears > 0) {
        audio.roomClear();
        this.msg(clears > 1 ? clears + ' ROOMS CLEARED!' : 'ROOM CLEARED!', '#39ff14');
      }
    } else {
      this.enemyDiedThisFrame = false;
    }

    // update lighting
    const _ptLight = perfEnabled() ? performance.now() : 0;
    updateLighting(dungeon,player.x,player.y);
    if (_ptLight) perfRecord('lighting', performance.now() - _ptLight);
    const _ptPart = perfEnabled() ? performance.now() : 0;
    updateParticles(dt);
    updateFloatingTexts(dt);
    if (_ptPart) perfRecord('particles', performance.now() - _ptPart);
    const _ptAmb = perfEnabled() ? performance.now() : 0;
    updateAmbient(dt);
    if (_ptAmb) perfRecord('biome-ambient', performance.now() - _ptAmb);
    updateShake(dt);
    updateCombo(dt);
    updateHackwareEffects(dt);
    // NOTE: modBannerTimer / biomeCardTimer are ticked in the level-text
    // pause block at the top of updatePlaying (early-return). When this
    // line runs, both timers are guaranteed to be 0 — leaving the
    // bookkeeping nulls in place defensively.
    if (this.modBannerTimer < 0) this.modBannerTimer = 0;
    if (this.biomeCardTimer <= 0) { this.biomeCardTimer = 0; this.biomeCardArea = null; }
    if (this.teleportCooldown > 0) this.teleportCooldown -= dt;

    // ── Upgrade effects ──────────────────────────────────────────────────
    // Nano Regen
    const regenLvl = player.upgrades.NANO_REGEN||0;
    if (regenLvl > 0) player.hp = Math.min(player.maxHp, player.hp + regenLvl * dt);

    // Saw Blade orbitals
    const sawLvl = player.upgrades.SAW_BLADE||0;
    if (sawLvl > 0) {
      player.orbitalAngle += 3 * dt;
      // Tick down hit cooldowns
      for (const [e, cd] of player.orbitalHits) {
        player.orbitalHits.set(e, cd - dt);
        if (cd - dt <= 0) player.orbitalHits.delete(e);
      }
      for (let i=0; i<sawLvl; i++) {
        const a = player.orbitalAngle + (TWO_PI / sawLvl) * i;
        const bx = player.x + Math.cos(a) * 1.5;
        const by = player.y + Math.sin(a) * 1.5;
        for (const e of enemies) {
          if (e.dead || player.orbitalHits.has(e)) continue;
          if (e._wrPhased) continue;
          if (dist(bx, by, e.x, e.y) < 0.6 && hasLOS(bx, by, e.x, e.y, dungeon.map)) {
            e.takeDamage(12, 'Saw Blade');
            player.orbitalHits.set(e, 0.5);
            spawnParticles(bx, by, 'SPARK', '#ff3333', 3);
          }
        }
      }
    }

    // Plasma Orb auto-spell
    const orbLvl = player.upgrades.PLASMA_ORB||0;
    if (orbLvl > 0) {
      const cd = 3 - (orbLvl - 1) * 0.7;
      player.spellTimers.plasmaOrb -= dt;
      if (player.spellTimers.plasmaOrb <= 0) {
        player.spellTimers.plasmaOrb = cd;
        // Find nearest enemy
        let nearest = null, nearD = 64;
        for (const e of enemies) {
          if (e.dead) continue;
          if (e._disguised) continue;
          if (e._wrPhased) continue;
          const d = dist(player.x, player.y, e.x, e.y);
          if (d < nearD) { nearD = d; nearest = e; }
        }
        if (nearest) {
          const [dx, dy] = norm(nearest.x - player.x, nearest.y - player.y);
          const p = new Projectile(player.x, player.y, dx, dy, 6, 25, 10, '#ff44cc', false, true, 'Plasma Orb');
          if (player.perks.PIERCING_ROUNDS) p.maxPierces+=1;
          p.homing = nearest;
          projectiles.push(p);
          spawnParticles(player.x, player.y, 'MUZZLE', '#ff44cc', 3);
        }
      }
    }

    // Sentry Drone — orbiting auto-fire drones
    const droneLvl = player.upgrades.SENTRY_DRONE||0;
    if (droneLvl > 0) {
      player.droneAngle += 1.8 * dt;
      const droneCd = 2.0 - (droneLvl - 1) * 0.4;
      player.spellTimers.sentryDrone -= dt;
      if (player.spellTimers.sentryDrone <= 0) {
        player.spellTimers.sentryDrone = droneCd;
        // Each drone picks the nearest visible enemy and fires
        for (let i = 0; i < droneLvl; i++) {
          const a = player.droneAngle + (TWO_PI / droneLvl) * i;
          const droneX = player.x + Math.cos(a) * 2.0;
          const droneY = player.y + Math.sin(a) * 2.0;
          let nearest = null, nearD = 8;
          for (const e of enemies) {
            if (e.dead) continue;
            if (e.type === 'PHANTOM' && !e.visible) continue;
            if (e._disguised) continue;
            if (e._wrPhased) continue;
            const d = dist(droneX, droneY, e.x, e.y);
            if (d < nearD && hasLOS(droneX, droneY, e.x, e.y, dungeon.map)) {
              nearD = d; nearest = e;
            }
          }
          if (nearest) {
            const [sdx, sdy] = norm(nearest.x - droneX, nearest.y - droneY);
            const sp = new Projectile(droneX, droneY, sdx, sdy, 8, 8, 8, '#00e5ff', false, true, 'Sentry Drone');
            sp.homing = nearest;
            projectiles.push(sp);
            spawnParticles(droneX, droneY, 'MUZZLE', '#00e5ff', 2);
            audio.sentryFire();
          }
        }
      }
    }

    // Auto-Laser perk — hitscan beam at nearest visible enemy
    if (player.perks.AUTO_LASER && player.hp > 0) {
      if (player.autoLaserBeam) {
        player.autoLaserBeam.timer -= dt;
        if (player.autoLaserBeam.timer <= 0) player.autoLaserBeam = null;
      }
      player.autoLaserTimer -= dt;
      if (player.autoLaserTimer <= 0) {
        let target = null, minD = 12;
        for (const e of enemies) {
          if (e.dead) continue;
          if (e.type === 'PHANTOM' && !e.visible) continue;
          if (e._disguised) continue;
          if (e._wrPhased) continue;
          const d = dist(player.x, player.y, e.x, e.y);
          if (d <= minD && hasLOS(player.x, player.y, e.x, e.y, dungeon.map)) {
            minD = d; target = e;
          }
        }
        if (target) {
          player.autoLaserTimer = 2.5;
          target.takeDamage(20, 'Auto-Laser');
          player.autoLaserBeam = {x1:player.x, y1:player.y, x2:target.x, y2:target.y, timer:0.15};
          spawnParticles(target.x, target.y, 'SPARK', '#ff2222', 5);
          audio.autoLaser();
        }
      }
    }


    // stairs / lore terminal interaction
    const tx=Math.floor(player.x), ty=Math.floor(player.y);
    const tile=dungeon.map[ty]?.[tx];

    if (tile===T.LORE) {
      if (jp(km('interact'))) {
        const unseen = LORE_ENTRIES.map((_, i) => i).filter(i => !player.loreRead.has(i));
        const idx = unseen.length > 0 ? (unseen[Math.floor(Math.random() * unseen.length)] ?? 0) : Math.floor(Math.random() * LORE_ENTRIES.length);
        player.loreRead.add(idx);
        this.currentLore = LORE_ENTRIES[idx] ?? null;
        player.score += 50;
        this.msg('+50 DATA RECOVERED', '#ffb700');
        // Consume the terminal — single use
        dungeon.map[ty][tx] = T.FLOOR;
        this.markMapMutated();
        audio.loreAccess();
        spawnParticles(player.x, player.y, 'SPARK', '#ffb700', 8);
        this.readingInteractArmed = false;
        this.setState('READING');
        return;
      }
      this.hint={text: isTouchDevice() ? 'Tap '+KEY_DISPLAY(km('interact'))+' to access data terminal' : 'Press '+KEY_DISPLAY(km('interact'))+' to access data terminal',colour:'#ffb700'};
    }

    // teleport pad interaction
    if (tile===T.TELEPORT_PAD) {
      const pads = dungeon.teleportPads || [];
      let paired = null;
      for (const p of pads) {
        if (p.x1===tx && p.y1===ty) { paired = { x:p.x2, y:p.y2 }; break; }
        if (p.x2===tx && p.y2===ty) { paired = { x:p.x1, y:p.y1 }; break; }
      }
      if (paired) {
        // Check if destination is in a sealed boss/challenge room
        const destSealed = (this.bossSealed && this.bossRoom &&
          paired.x >= this.bossRoom.x && paired.x < this.bossRoom.x + this.bossRoom.w &&
          paired.y >= this.bossRoom.y && paired.y < this.bossRoom.y + this.bossRoom.h) ||
          (this.challengeSealed && this.challengeRoom &&
          paired.x >= this.challengeRoom.x && paired.x < this.challengeRoom.x + this.challengeRoom.w &&
          paired.y >= this.challengeRoom.y && paired.y < this.challengeRoom.y + this.challengeRoom.h);
        // Also block if source is in a sealed room (no escaping)
        const srcSealed = (this.bossSealed && this.bossRoom &&
          player.x >= this.bossRoom.x && player.x < this.bossRoom.x + this.bossRoom.w &&
          player.y >= this.bossRoom.y && player.y < this.bossRoom.y + this.bossRoom.h) ||
          (this.challengeSealed && this.challengeRoom &&
          player.x >= this.challengeRoom.x && player.x < this.challengeRoom.x + this.challengeRoom.w &&
          player.y >= this.challengeRoom.y && player.y < this.challengeRoom.y + this.challengeRoom.h);

        if (srcSealed || destSealed) {
          this.hint={text:'Warp pad disabled — room sealed',colour:'#ff3333'};
        } else if (this.teleportCooldown > 0) {
          this.hint={text:'Warp recharging... '+Math.ceil(this.teleportCooldown)+'s',colour:'#8844aa'};
        } else {
          if (jp(km('interact'))) {
            spawnParticles(player.x, player.y, 'SPARK', '#bb44ff', 15);
            player.x = paired.x + 0.5;
            player.y = paired.y + 0.5;
            spawnParticles(player.x, player.y, 'SPARK', '#bb44ff', 15);
            player.invincibleTimer = Math.max(player.invincibleTimer, 0.3);
            this.teleportCooldown = 3;
            audio.teleportPad();
            this.msg('WARPED','#bb44ff');
          }
          this.hint={text:'Press '+KEY_DISPLAY(km('interact'))+' to warp',colour:'#bb44ff'};
        }
      }
    }

    const bossBlocking = tile===T.TERMINAL && this.bossAlive;
    if ((tile===T.STAIRS||tile===T.TERMINAL) && !bossBlocking && jp(km('interact'))) {
      this.descend();
    }
    if (tile===T.STAIRS) this.hint={text:'Press '+KEY_DISPLAY(km('interact'))+' to descend',colour:'#ffff00'};
    if (tile===T.TERMINAL && bossBlocking) {
      const bossLabel = BOSS_NAMES[this.bossType] || 'the boss';
      this.hint={text:'CORE terminal locked — destroy ' + bossLabel + ' first',colour:'#ff3333'};
    }
    if (tile===T.TERMINAL && !bossBlocking) this.hint={text:'Press '+KEY_DISPLAY(km('interact'))+' to interface with CORE terminal',colour:'#00f5ff'};

    // door interaction (check adjacent tiles when pressing E)
    if (jp(km('interact'))) {
      const dirs = /** @type {[number,number][]} */ ([[0,-1],[0,1],[-1,0],[1,0]]);
      for (const [ddx,ddy] of dirs) {
        const dx=tx+ddx, dy=ty+ddy;
        if (dx<0||dy<0||dx>=MAP_W||dy>=MAP_H) continue;
        const dt=dungeon.map[dy][dx];
        if (dt===T.CRACKED) {
          dungeon.map[dy][dx]=T.FLOOR;
          this.markMapMutated();
          audio.wallBreak();
          spawnParticles(dx+0.5, dy+0.5, 'EXPLOSION', '#ffb700', 12);
          this.msg('SECRET AREA DISCOVERED','#ffb700');
          // Reveal the secret room — cracked tile is on room boundary
          for (const sr of dungeon.secretRooms) {
            if (sr.secretRevealed) continue;
            // Cracked tile is on room edge or 1 tile outside it
            if (dx >= sr.x-1 && dx <= sr.x+sr.w && dy >= sr.y-1 && dy <= sr.y+sr.h) {
              this.revealSecretRoom(sr);
              break;
            }
          }
          break;
        }
        if (dt===T.DOOR) {
          dungeon.map[dy][dx]=T.DOOR_OPEN;
          this.markMapMutated();
          this.msg('Door opened','#aa8844');
          spawnParticles(dx+0.5, dy+0.5, 'SPARK', '#aa8844', 4);
          break;
        }
        if (isDoor(dt)) {
          const kc=doorKeyColour(dt);
          if (kc && player.keys[kc] > 0) {
            dungeon.map[dy][dx]=T.DOOR_OPEN;
            this.markMapMutated();
            this.msg('Unlocked '+kc+' door!', dt===T.LOCKED_R?'#ff3333':dt===T.LOCKED_B?'#3388ff':'#ffcc00');
            spawnParticles(dx+0.5, dy+0.5, 'EXPLOSION', dt===T.LOCKED_R?'#ff3333':dt===T.LOCKED_B?'#3388ff':'#ffcc00', 8);
            break;
          } else if (kc) {
            this.msg('Need '+kc.toUpperCase()+' KEY', dt===T.LOCKED_R?'#ff3333':dt===T.LOCKED_B?'#3388ff':'#ffcc00');
          }
        }
      }
    }
    // door / cracked wall prompt
    const dirs = /** @type {[number,number][]} */ ([[0,-1],[0,1],[-1,0],[1,0]]);
    for (const [ddx,ddy] of dirs) {
      const dx=tx+ddx, dy=ty+ddy;
      if (dx<0||dy<0||dx>=MAP_W||dy>=MAP_H) continue;
      const dt=dungeon.map[dy][dx];
      if (dt===T.CRACKED) { this.hint={text:'Faint cracks... (press '+KEY_DISPLAY(km('interact'))+')',colour:'#ffb700'}; break; }
      if (dt===T.DOOR) { this.hint={text:'Press '+KEY_DISPLAY(km('interact'))+' to open door',colour:'#aa8844'}; break; }
      if (isDoor(dt)) {
        const kc=doorKeyColour(dt);
        const colour = dt===T.LOCKED_R?'#ff3333':dt===T.LOCKED_B?'#3388ff':'#ffcc00';
        if (kc && player.keys[kc] > 0) {
          this.hint={text:'Press '+KEY_DISPLAY(km('interact'))+' to unlock '+kc.toUpperCase()+' door', colour};
        } else if (kc) {
          this.hint={text:'Need '+kc.toUpperCase()+' KEY (press '+KEY_DISPLAY(km('interact'))+')', colour};
        }
        break;
      }
      if (dt===T.CHALLENGE_GATE && !game.challengeComplete) { this.hint={text:'⚔ CHALLENGE ROOM — enter at your own risk',colour:'#ff6633'}; break; }
    }

    // trap triggering
    player.trapCooldown = Math.max(0, player.trapCooldown - dt);
    if (player.trapCooldown <= 0) {
      if (tile===T.TRAP_SPIKE) {
        const trapDmg = Math.round((8 + game.floor * 2) * getDiff().envDmg);
        player.takeDamage(trapDmg, 'Spike Trap');
        player.trapCooldown = 1.0;
        this.msg('Spike trap! -'+trapDmg+' HP','#ff6644');
        spawnParticles(player.x, player.y, 'SPARK', '#ff6644', 5);
      } else if (tile===T.TRAP_SLOW) {
        player.speedBoost = -1.5;
        player.speedTimer = 3;
        player.trapCooldown = 3.0;
        this.msg('Slow trap!','#8866ff');
        spawnParticles(player.x, player.y, 'SPARK', '#8866ff', 4);
      }
    }

    // environmental hazards (separate from traps — own cooldowns, bypass armor)
    if (tile === T.PLASMA && !isPlayerDamageImmune()) {
      // Continuous burn: bypasses defense and hit i-frames, but still respects shield/SECOND_WIND.
      const burnDps = (3 + this.floor) * getDiff().envDmg;
      player.takeDamage(burnDps * dt, 'Plasma', {
        ignoreInvincible: true,
        ignoreDefense: true,
        skipHitInvincible: true,
        skipHitEffects: true,
        skipReactiveArmor: true,
      });
      player.plasmaBurnTimer = Math.max(0, player.plasmaBurnTimer - dt);
      if (player.plasmaBurnTimer <= 0) {
        const dmgShown = Math.round(burnDps);
        this.msg('Plasma burn! -'+dmgShown+'/s','#ff6600');
        spawnParticles(player.x, player.y, 'SPARK', '#ff8800', 3);
        audio.plasmaBurn();
        player.plasmaBurnTimer = 0.5;
      }
    }
    player.arcCooldown = Math.max(0, player.arcCooldown - dt);
    if (tile === T.ARC && !isPlayerDamageImmune() && Math.sin((this.floorTime||0) * Math.PI) > 0 && player.arcCooldown <= 0) {
      // Periodic zap during active phase
      const zapDmg = Math.round((10 + this.floor * 2) * getDiff().envDmg);
      player.takeDamage(zapDmg, 'Arc Grid', {
        ignoreInvincible: true,
        ignoreDefense: true,
        skipHitInvincible: true,
        skipHitEffects: true,
        skipReactiveArmor: true,
      });
      player.arcCooldown = 0.8;
      player.flashTimer = 0.15;
      this.msg('Arc zap! -'+zapDmg+' HP','#44ccff');
      spawnParticles(player.x, player.y, 'SPARK', '#88eeff', 6);
      audio.arcZap();
    }

    // ── Toxic Pool (damages player + slows) ──
    if (tile === T.TOXIC && !isPlayerDamageImmune()) {
      const toxDps = (2 + this.floor * 0.5) * getDiff().envDmg;
      player.takeDamage(toxDps * dt, 'Toxic Pool', {
        ignoreInvincible: true,
        ignoreDefense: true,
        skipHitInvincible: true,
        skipHitEffects: true,
        skipReactiveArmor: true,
      });
      player.toxicBurnTimer = Math.max(0, player.toxicBurnTimer - dt);
      if (player.toxicBurnTimer <= 0) {
        const dmgShown = Math.round(toxDps);
        this.msg('Toxic! -'+dmgShown+'/s','#33ff00');
        spawnParticles(player.x, player.y, 'SPARK', '#44ff22', 3);
        audio.toxicBurn();
        player.toxicBurnTimer = 0.5;
      }
      // Slow player while in pool (30% reduction via flag, read in Player.update)
      player.toxicSlowActive = true;
    } else {
      player.toxicSlowActive = false;
    }

    // special room effects
    for (const r of dungeon.rooms) {
      if (r.healFont && player.x>=r.x && player.x<r.x+r.w && player.y>=r.y && player.y<r.y+r.h) {
        if (player.hp < player.maxHp) {
          player.hp = Math.min(player.maxHp, player.hp + 5 * dt);
          if (Math.random()<0.1) spawnParticles(player.x, player.y, 'SPARK', '#00ff88', 1);
        }
      }
      if (r.xpShrine && !r.shrineUsed && player.x>=r.x && player.x<r.x+r.w && player.y>=r.y && player.y<r.y+r.h) {
        if (dist(player.x,player.y,r.cx+0.5,r.cy+0.5)<1.5 && jp(km('interact'))) {
          r.shrineUsed = true;
          const xp = 30 + game.floor * 10;
          player.gainXP(xp);
          this.msg('XP Shrine: +'+xp+' XP!','#aa00ff');
          spawnParticles(r.cx+0.5, r.cy+0.5, 'EXPLOSION', '#aa00ff', 15);
        }
        if (!r.shrineUsed && dist(player.x,player.y,r.cx+0.5,r.cy+0.5)<2) this.hint={text:'Press '+KEY_DISPLAY(km('interact'))+' at shrine',colour:'#aa00ff'};
      }
      // Implant shrine interaction
      if (r.roomType === 'implant' && !r.implantUsed && player.x>=r.x && player.x<r.x+r.w && player.y>=r.y && player.y<r.y+r.h) {
        if (dist(player.x,player.y,r.cx+0.5,r.cy+0.5)<1.5 && jp(km('interact'))) {
          r.implantUsed = true;
          const slots = Object.keys(player.augments).length;
          if (slots >= MAX_AUGMENTS) {
            // Capped: give credits instead
            const cr = 50 + game.floor * 15;
            const siphon = hasAugment('CREDIT_SIPHON') ? 1.5 : 1;
            player.credits += Math.round(cr * siphon);
            this.msg('AUGMENT SLOTS FULL — +' + Math.round(cr * siphon) + ' CR', '#cc44ff');
            spawnParticles(r.cx+0.5, r.cy+0.5, 'EXPLOSION', '#cc44ff', 12);
          } else {
            const opts = rollAugmentChoices(player, 2);
            if (opts.length === 0) {
              this.msg('ALL AUGMENTS OWNED', '#cc44ff');
            } else {
              this.augmentChoice = { options: opts, selected: 0, room: r, _arm: 0.4 };
              this.setState('AUGMENT_CHOICE');
              audio.augmentChoice();
            }
          }
        }
        if (!r.implantUsed && dist(player.x,player.y,r.cx+0.5,r.cy+0.5)<2.5) this.hint={text:'Press '+KEY_DISPLAY(km('interact'))+' at implant shrine',colour:'#cc44ff'};
      }
      // Event terminal interaction
      if (r.roomType === 'event' && !r.eventUsed && player.x>=r.x && player.x<r.x+r.w && player.y>=r.y && player.y<r.y+r.h) {
        if (dist(player.x,player.y,r.cx+0.5,r.cy+0.5)<1.5 && jp(km('interact'))) {
          r.eventUsed = true;
          const ev = rollEvent(player);
          this.eventChoice = { event: ev, selected: 0, room: r };
          this.setState('EVENT_CHOICE');
          audio.eventTerminal();
        }
        if (!r.eventUsed && dist(player.x,player.y,r.cx+0.5,r.cy+0.5)<2.5) this.hint={text:'Press '+KEY_DISPLAY(km('interact'))+' at terminal',colour:'#44ffcc'};
      }
      /**
       * @param {any} i
       */
      if (r.shopItems && r.shopItems.some((/** @type {any} */ i) => !i.sold) && player.x>=r.x && player.x<r.x+r.w && player.y>=r.y && player.y<r.y+r.h) {
        if (dist(player.x,player.y,r.cx+0.5,r.cy+0.5)<1.5 && jp(km('interact'))) {
          // Revalidate shop items (maxed upgrades, stale prices, unneeded keys, owned/capped augments)
          for (const si of r.shopItems) {
            if (si.sold) continue;
            if (si.persistent && player.upgrades[si.id] >= si.maxLevel) { si.sold = true; continue; }
            // Recalculate price for persistent upgrades (level may have changed)
            if (si.persistent && SHOP_PRICES[si.id]) si.price = shopPrice(si.id, this.floor, player.upgrades);
            // Mark key items as sold if player already has that colour
            if (si.id && si.id.startsWith('SHOP_KEY_')) {
              const kc = si.id.replace('SHOP_KEY_','').toLowerCase();
              if (player.keys[kc] > 0) si.sold = true;
            }
            // Mark augment items as sold if already owned or at cap
            if (si.isAugment && si.id && si.id.startsWith('SHOP_AUG_')) {
              const augId = si.id.replace('SHOP_AUG_','');
              if (player.augments[augId] || Object.keys(player.augments).length >= MAX_AUGMENTS) si.sold = true;
            }
          }
          /**
           * @param {any} i
           */
          if (!r.shopItems.some((/** @type {any} */ i) => !i.sold)) continue; // all invalidated
          this.shopRoom = r;
          this.shopSelected = 0;
          this.shopClosing = false;
          audio.vendorOpen();
          this.setState('SHOPPING');
          return;
        }
        if (dist(player.x,player.y,r.cx+0.5,r.cy+0.5)<2) this.hint={text:'Press '+KEY_DISPLAY(km('interact'))+' at vendor',colour:'#39ff14'};
      }
    }

    // quest tracking
    if (this.quest && !this.quest.done && !this.quest.failed) {
      if (this.quest.timer !== undefined) {
        this.quest.timer -= dt;
        if (this.quest.timer <= 0) { this.quest.failed = true; this.msg('Quest failed!','#ff3333'); }
      }
      if (!this.quest.failed && this.quest.check()) {
        this.quest.done = true;
        this.quest.reward();
        spawnParticles(player.x, player.y, 'EXPLOSION', '#39ff14', 20);
      }
    }

    // pause
    if (jp('Escape')) this.setState('PAUSED');

    // boss seal check — seal when player is clearly inside the boss room
    if (this.bossRoom && !this.bossSealed && this.bossAlive) {
      const r = this.bossRoom;
      /**
       * @param {any} e
       */
      const onEntrance = this.bossEntrances.some((/** @type {any} */ e) =>
        Math.floor(player.x)===e.x && Math.floor(player.y)===e.y);
      if (!onEntrance &&
          player.x >= r.x && player.x < r.x + r.w &&
          player.y >= r.y && player.y < r.y + r.h) {
        this.bossSealed = true;
        for (const e of this.bossEntrances) {
          e.origTile = dungeon.map[e.y][e.x];
          dungeon.map[e.y][e.x] = T.WALL;
        }
        this.refreshSealedEntrances();
        // Safety: nudge player off any sealed tile
        const ptx = Math.floor(player.x), pty = Math.floor(player.y);
        if (!isPassable(dungeon.map[pty]?.[ptx])) {
          player.x = r.cx + 0.5;
          player.y = r.cy + 0.5;
        }
        audio.roomSeal();
        this.msg('⚠ ROOM SEALED','#ff3333');
      }
    }

    // boss death — unseal room and update state
    if (this.bossAlive && !enemies.some(e=>e.isBoss && !e.dead)) {
      this.bossAlive=false;
      // Restore entrance tiles
      if (this.bossSealed) {
        for (const ent of this.bossEntrances) {
          if (ent.origTile !== undefined) { dungeon.map[ent.y][ent.x] = ent.origTile; delete ent.origTile; }
        }
        audio.roomUnseal();
      }
      this.bossSealed=false;
      this.refreshSealedEntrances();
      game.msg((BOSS_NAMES[this.bossType]||'BOSS')+' DESTROYED','#39ff14');
    }

    // Boss HUD bar animation
    if (this.bossAlive) {
      if (this.bossBarAnim < 1) this.bossBarAnim = Math.min(1, this.bossBarAnim + dt * 2.5);
      const boss = enemies.find(e => e.isBoss && !e.dead);
      if (boss) {
        if (this.bossHpGhost === 0) this.bossHpGhost = boss.hp;
        if (this.bossHpGhost > boss.hp) {
          this.bossHpGhost = Math.max(boss.hp, this.bossHpGhost - boss.maxHp * dt * 0.25);
        } else {
          this.bossHpGhost = boss.hp;
        }
      }
    } else if (this.bossBarAnim > 0) {
      // Fade out after boss death
      this.bossBarAnim = Math.max(0, this.bossBarAnim - dt * 2);
    }

    // ── Challenge room: seal, wave spawn, unseal ─────────────────────────
    if (this.challengeRoom && !this.challengeComplete) {
      const cr = this.challengeRoom;
      // Seal when player is clearly inside the challenge room (same pattern as boss)
      if (!this.challengeSealed) {
        /**
         * @param {any} e
         */
        const onEntrance = this.challengeEntrances.some((/** @type {any} */ e) =>
          Math.floor(player.x)===e.x && Math.floor(player.y)===e.y);
        if (!onEntrance &&
            player.x >= cr.x && player.x < cr.x + cr.w &&
            player.y >= cr.y && player.y < cr.y + cr.h) {
          this.challengeSealed = true;
          this.challengeMaxWaves = Math.min(3, 1 + Math.floor(this.floor / 3));
          this.challengeWave = 0;
          this.challengeWaveDelay = 0.5; // brief delay before first wave
          for (const e of this.challengeEntrances) {
            e.origTile = dungeon.map[e.y][e.x];
            dungeon.map[e.y][e.x] = T.WALL;
          }
          this.refreshSealedEntrances();
          // Nudge player off sealed tiles
          const ptx = Math.floor(player.x), pty = Math.floor(player.y);
          if (!isPassable(dungeon.map[pty]?.[ptx])) {
            player.x = cr.cx + 0.5; player.y = cr.cy + 0.5;
          }
          audio.roomSeal();
          this.msg('⚠ CHALLENGE ROOM SEALED','#ff6633');
        }
      }
      // Wave delay countdown + spawn
      if (this.challengeSealed && this.challengeWaveDelay > 0) {
        this.challengeWaveDelay -= dt;
        if (this.challengeWaveDelay <= 0) {
          this.challengeWaveDelay = 0;
          this.challengeWave++;
          // Spawn wave enemies inside the challenge room
          const d = getDiff();
          const areaCap = Math.floor(cr.w * cr.h / 6);
          let count = Math.min(areaCap, Math.round((3 + this.floor) * d.enemyHp));
          if (game.modifier === 'SWARM') count = Math.min(areaCap, Math.ceil(count * 1.3));
          const effectiveFloor = Math.min(this.floor + 1, 9);
          /** @type {Record<string, number>} */
          const typeCounts = {};
          /** @type {Record<string, number>} */
          const TYPE_CAPS = { PHANTOM:2, TURRET:2, DRONE:1, SHIELDER:1, SPLITTER:1, GRENADIER:1, TELEPORTER:1, SNIPER:1, SUMMONER:1, HEALER:1, CHARGER:2, LEAPER:2, REFLECTOR:1, DISRUPTOR:1, WRAITH:1, NEXUS:1, SIPHON:1, GRAVITON:1, SEEKER:3, PULSER:2 };
          for (let j = 0; j < count; j++) {
            let type = pickEnemyType(effectiveFloor) || 'GUARD';
            if ((typeCounts[type]||0) >= (TYPE_CAPS[type]||99)) {
              const open = ENEMY_TYPES_LIST.filter((/** @type {any} */ t) =>
                (typeCounts[t]||0) < (TYPE_CAPS[t]||99) &&
                !(ENEMY_WEIGHTS[t].minFloor && effectiveFloor < ENEMY_WEIGHTS[t].minFloor)
              );
              type = open.length ? (open[rndInt(0, open.length-1)] || 'GUARD') : 'GUARD';
            }
            typeCounts[type] = (typeCounts[type]||0) + 1;
            // Spawn away from player
            let ex, ey, attempts = 0;
            do {
              ex = cr.x + rnd(1, cr.w-1);
              ey = cr.y + rnd(1, cr.h-1);
              attempts++;
            } while (attempts < 20 && Math.abs(ex - player.x) + Math.abs(ey - player.y) < 3);
            const e = spawnEnemy(type, ex, ey, this.floor, cr, this.challengeWave > 1);
            e._challengeWave = true;
            enemies.push(e);
          }
          cr._hadEnemies = true;
          audio.challengeWave();
          this.msg('WAVE ' + this.challengeWave + '/' + this.challengeMaxWaves, '#ff9933');
        }
      }
      // Wave cleared — next wave or victory
      if (this.challengeSealed && this.challengeWaveDelay <= 0 && this.challengeWave > 0) {
        let aliveCount = 0;
        for (const e of enemiesInRoomIter(this.challengeRoom)) {
          if (!e.dead && e._challengeWave) aliveCount++;
        }
        if (aliveCount === 0) {
          if (this.challengeWave >= this.challengeMaxWaves) {
            // Challenge complete — unseal and reward
            this.challengeComplete = true;
            this.challengeSealed = false;
            cr.challengeComplete = true;
            for (const e of this.challengeEntrances) {
              if (e.origTile !== undefined) { dungeon.map[e.y][e.x] = e.origTile; delete e.origTile; }
            }
            this.refreshSealedEntrances();
            audio.roomUnseal();
            audio.roomClear();
            // Rewards
            const d = getDiff();
            const cr2 = Math.round(this.floor * 20 * getMetaCreditMultiplier() * d.creditMul * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
            player.credits += cr2;
            player.score += 500 * this.floor;
            player.gainXP(this.floor * 15);
            // Drop guaranteed items
            for (let j = 0; j < 2; j++) {
              const ix = cr.x + rnd(1, cr.w-1), iy = cr.y + rnd(1, cr.h-1);
              items.push(new Item(ix, iy));
            }
            spawnParticles(cr.cx, cr.cy, 'EXPLOSION', '#ff9933', 25);
            spawnDmgText(cr.cx, cr.cy, '+' + cr2 + '◈', '#ff9933');
            // UNCHAINED #39: guaranteed 2 cores on challenge survival.
            if (typeof NEON !== 'undefined' && NEON.cores && NEON.cores.spawnCoreDrop) {
              NEON.cores.spawnCoreDrop(this, cr.cx, cr.cy, 2);
            }
            this.msg('⚡ CHALLENGE COMPLETE!', '#ff9933');
          } else {
            // Inter-wave pause
            this.challengeWaveDelay = 2.0;
          }
        }
      }
    }

    // ── Music state resolution (after all seal/unseal logic) ──
    if (this.bossSealed) music.setState('boss');
    else if (this.challengeSealed) music.setState('tension');
    else {
      // Check if enemies are alive in the player's current room
      const px = Math.floor(player.x), py = Math.floor(player.y);
      /**
       * @param {any} r
       */
      const pRoom = this.dungeon.rooms.find((/** @type {any} */ r) =>
        px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h);
      let inCombat = false;
      if (pRoom) {
        for (const e of enemiesInRoomIter(pRoom)) { if (!e.dead) { inCombat = true; break; } }
      }
      music.setState(inCombat ? 'combat' : 'explore');
    }
  },

  updatePaused() {
    if (jp('Escape')) { audio.menuSelect(); this.setState('PLAYING'); }
    else if (jp('KeyS')) { audio.menuSelect(); this._settingsFrom = 'PAUSED'; this.setState('SETTINGS'); }
    else if (jp('KeyQ')) { audio.menuSelect(); this.setState('MENU'); }
    // Keyboard up/down selection + Enter
    const pauseActions = ['PLAYING', 'SETTINGS', 'MENU'];
    if (this._pauseSel == null) this._pauseSel = -1;
    if (jp(ALT_KEYS.up) || jp(km('up')))   { this._pauseSel = this._pauseSel <= 0 ? 2 : this._pauseSel - 1; audio.menuSelect(); }
    if (jp(ALT_KEYS.down) || jp(km('down'))) { this._pauseSel = this._pauseSel >= 2 ? 0 : this._pauseSel + 1; audio.menuSelect(); }
    if (this._pauseSel >= 0 && (jp('Enter') || jp('MouseLeft'))) {
      audio.menuSelect();
      if (this._pauseSel === 1) { this._settingsFrom = 'PAUSED'; this.setState('SETTINGS'); }
      else this.setState(pauseActions[this._pauseSel]);
      return;
    }
    // Mouse hover detection (highlight nearest option)
    if (!isTouchDevice()) {
      const narrow = layout.compact;
      const optY = [narrow ? 255 : 295, narrow ? 280 : 320, narrow ? 305 : 345];
      let best = -1, bestD = 15;
      for (let i = 0; i < 3; i++) {
        const d = Math.abs(mouse.y - (optY[i] ?? 0));
        if (d < bestD) { bestD = d; best = i; }
      }
      this._pauseSel = best;
    }
  },

  /**
   * @param {any} dt
   */
  updatePowerupChoice(dt) {
    const pc = this.powerupChoice;
    if (!pc) { this.setState('PLAYING'); return; }
    // Arming delay — block selection for a short period to prevent accidental picks.
    if (pc._arm > 0) {
      pc._arm -= (dt || 1/60);
      // Allow navigation while arming, but consume selection keys.
      if (jp(ALT_KEYS.left) || jp(km('left')))  pc.selected = 0;
      if (jp(ALT_KEYS.right)|| jp(km('right')))  pc.selected = 1;
      return;
    }
    // Keyboard: left/right to select, 1/2 for direct pick, 3/Escape to skip
    if (jp(ALT_KEYS.left) || jp(km('left')))  pc.selected = 0;
    if (jp(ALT_KEYS.right)|| jp(km('right')))  pc.selected = 1;
    if (jp('Digit1')) { pc.selected=0; this.applyPowerupChoice(0); return; }
    if (jp('Digit2')) { pc.selected=1; this.applyPowerupChoice(1); return; }
    if (jp('Digit3') || jp('Escape') || jp('KeyQ')) { this.applyPowerupChoice(-1); return; }
    if (jp('Enter') || jp(km('shoot')))    { this.applyPowerupChoice(pc.selected); return; }
    // Mouse/touch: check click on cards or skip
    if (jp('MouseLeft')) {
      const cw = Math.min(280, W * 0.35);
      const gap = 30;
      const totalW = cw * 2 + gap;
      const startX = (W - totalW) / 2;
      const cardY = H * 0.28;
      const cardH = Math.min(220, H * 0.38);
      const mx = mouse.x, my = mouse.y;
      // Card 0
      if (mx >= startX && mx <= startX + cw && my >= cardY && my <= cardY + cardH) {
        this.applyPowerupChoice(0); return;
      }
      // Card 1
      if (mx >= startX + cw + gap && mx <= startX + totalW && my >= cardY && my <= cardY + cardH) {
        this.applyPowerupChoice(1); return;
      }
      // Skip button
      const skipY = cardY + cardH + 25;
      const skipW = 160, skipH = 40;
      if (mx >= (W-skipW)/2 && mx <= (W+skipW)/2 && my >= skipY && my <= skipY+skipH) {
        this.applyPowerupChoice(-1); return;
      }
    }
  },

  /**
   * @param {any} idx
   */
  applyPowerupChoice(idx) {
    const pc = this.powerupChoice;
    if (idx >= 0 && idx < pc.options.length) {
      const opt = pc.options[idx];
      opt.fn(this.player);
      audio.menuSelect();
      this.msg('Chose ' + opt.name, opt.colour);
      // Telemetry: upgrade pick
      if (typeof NEON !== 'undefined' && NEON.telemetry) {
        /**
         * @param {any} _
         * @param {any} i
         * @param {any} o
         */
        const skipped = pc.options.filter((/** @type {any} */ _, /** @type {any} */ i) => i !== idx).map((/** @type {any} */ o) => o.id || o.name);
        NEON.telemetry.track('upgrade_pick', { picked: opt.id || opt.name, skipped, floor: this.floor });
      }
    } else {
      this.msg('Skipped upgrade', '#666688');
      if (typeof NEON !== 'undefined' && NEON.telemetry) {
        /**
         * @param {any} o
         */
        NEON.telemetry.track('upgrade_skip', { options: pc.options.map((/** @type {any} */ o) => o.id || o.name), floor: this.floor });
      }
    }
    this.powerupChoice = null;
    // Check for queued perk choices before returning to PLAYING
    if (this.pendingPerkChoices.length) { this.openNextPerkChoice(); return; }
    this.setState('PLAYING');
  },

  // ─── Perk Choice (choose-one-of-three on level up) ─────────────────────
  openNextPerkChoice() {
    if (!this.pendingPerkChoices.length) { this.setState('PLAYING'); return; }
    this.pendingPerkChoices.shift(); // consume the milestone
    const opts = rollPerkChoices(this.player, 3);
    if (!opts.length) { this.setState('PLAYING'); return; } // all perks owned
    this.perkChoice = { options: opts, selected: 0, _arm: 0.4 };
    this.setState('PERK_CHOICE');
    audio.perkChoice();
  },

  /**
   * @param {any} dt
   */
  updatePerkChoice(dt) {
    const pc = this.perkChoice;
    if (!pc) { this.setState('PLAYING'); return; }
    if (pc._arm > 0) {
      pc._arm -= (dt || 1/60);
      if (jp(ALT_KEYS.left) || jp(km('left')))  pc.selected = Math.max(0, pc.selected - 1);
      if (jp(ALT_KEYS.right)|| jp(km('right')))  pc.selected = Math.min(pc.options.length - 1, pc.selected + 1);
      return;
    }
    if (jp('Digit1')) { this.applyPerkChoice(0); return; }
    if (jp('Digit2')) { this.applyPerkChoice(1); return; }
    if (jp('Digit3') && pc.options.length > 2) { this.applyPerkChoice(2); return; }
    if (jp(ALT_KEYS.left) || jp(km('left')))  pc.selected = Math.max(0, pc.selected - 1);
    if (jp(ALT_KEYS.right)|| jp(km('right')))  pc.selected = Math.min(pc.options.length - 1, pc.selected + 1);
    if (jp('Enter') || jp(km('shoot')))     { this.applyPerkChoice(pc.selected); return; }
    // Mouse/touch
    if (jp('MouseLeft')) {
      const narrow = layout.compact;
      const count = pc.options.length;
      const cw = narrow ? Math.min(160, (W - 20) / count - 8) : Math.min(220, (W - 40) / count - 12);
      const gap = narrow ? 8 : 14;
      const totalW = cw * count + gap * (count - 1);
      const startX = (W - totalW) / 2;
      const cardY = H * 0.22;
      const cardH = narrow ? Math.min(240, H * 0.52) : Math.min(280, H * 0.48);
      for (let i = 0; i < count; i++) {
        const cx = startX + i * (cw + gap);
        if (mouse.x >= cx && mouse.x <= cx + cw && mouse.y >= cardY && mouse.y <= cardY + cardH) {
          this.applyPerkChoice(i); return;
        }
      }
    }
  },

  /**
   * @param {any} idx
   */
  applyPerkChoice(idx) {
    const pc = this.perkChoice;
    if (idx >= 0 && idx < pc.options.length) {
      const id = pc.options[idx];
      applyPerk(this.player, id);
      audio.menuSelect();
    }
    this.perkChoice = null;
    if (this.pendingPerkChoices.length) { this.openNextPerkChoice(); return; }
    this.setState('PLAYING');
  },

  // ─── Augment Choice ──────────────────────────────────────────────────────
  /**
   * @param {any} options
   */
  openAugmentChoice(options) {
    this.augmentChoice = { options, selected: 0, _arm: 0.4 };
    this.setState('AUGMENT_CHOICE');
    audio.augmentChoice();
  },

  /**
   * @param {any} dt
   */
  updateAugmentChoice(dt) {
    const ac = this.augmentChoice;
    if (!ac) { this.setState('PLAYING'); return; }
    if (ac._arm > 0) {
      ac._arm -= (dt || 1/60);
      if (jp(ALT_KEYS.left) || jp(km('left')))  ac.selected = Math.max(0, ac.selected - 1);
      if (jp(ALT_KEYS.right)|| jp(km('right')))  ac.selected = Math.min(ac.options.length - 1, ac.selected + 1);
      return;
    }
    if (jp('Digit1')) { this.applyAugmentChoice(0); return; }
    if (jp('Digit2') && ac.options.length > 1) { this.applyAugmentChoice(1); return; }
    if (jp(ALT_KEYS.left) || jp(km('left')))  ac.selected = Math.max(0, ac.selected - 1);
    if (jp(ALT_KEYS.right)|| jp(km('right')))  ac.selected = Math.min(ac.options.length - 1, ac.selected + 1);
    if (jp('Enter') || jp(km('shoot')))     { this.applyAugmentChoice(ac.selected); return; }
    if (jp('MouseLeft')) {
      const narrow = layout.compact;
      const count = ac.options.length;
      const cw = narrow ? Math.min(180, (W - 20) / count - 8) : Math.min(240, (W - 40) / count - 12);
      const gap = narrow ? 10 : 16;
      const totalW = cw * count + gap * (count - 1);
      const startX = (W - totalW) / 2;
      const cardY = H * 0.22;
      const cardH = narrow ? Math.min(240, H * 0.52) : Math.min(280, H * 0.48);
      for (let i = 0; i < count; i++) {
        const cx = startX + i * (cw + gap);
        if (mouse.x >= cx && mouse.x <= cx + cw && mouse.y >= cardY && mouse.y <= cardY + cardH) {
          this.applyAugmentChoice(i); return;
        }
      }
    }
  },

  /**
   * @param {any} idx
   */
  applyAugmentChoice(idx) {
    const ac = this.augmentChoice;
    if (!ac || idx < 0 || idx >= ac.options.length) { this.setState('PLAYING'); return; }
    const id = ac.options[idx];
    const aug = AUGMENTS[id];
    this.player.augments[id] = true;
    audio.augmentInstall();
    this.msg(aug.icon + ' ' + aug.name + ' INSTALLED', aug.colour);
    spawnParticles(this.player.x, this.player.y, 'EXPLOSION', aug.colour, 15);
    this.augmentChoice = null;
    this.setState('PLAYING');
  },

  renderAugmentChoice() {
    const ac = this.augmentChoice;
    if (!ac) return;
    const narrow = layout.compact;
    ctx.save();
    // Dimmed overlay
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);
    // Title
    const titleFs = narrow ? 18 : 24;
    ctx.font = 'bold ' + titleFs + 'px monospace';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 10; ctx.shadowColor = '#cc44ff';
    ctx.fillStyle = '#cc44ff';
    const slots = Object.keys(this.player.augments).length;
    ctx.fillText('CHOOSE AUGMENT (' + slots + '/' + MAX_AUGMENTS + ')', W / 2, H * 0.14);
    ctx.shadowBlur = 0;
    // Subtitle
    ctx.font = (narrow ? 10 : 12) + 'px monospace';
    ctx.fillStyle = '#8866aa';
    ctx.fillText('Cybernetic implant — permanent passive effect', W / 2, H * 0.14 + titleFs + 4);
    // Cards
    const count = ac.options.length;
    const cw = narrow ? Math.min(180, (W - 20) / count - 8) : Math.min(240, (W - 40) / count - 12);
    const gap = narrow ? 10 : 16;
    const totalW = cw * count + gap * (count - 1);
    const startX = (W - totalW) / 2;
    const cardY = H * 0.22;
    const cardH = narrow ? Math.min(240, H * 0.52) : Math.min(280, H * 0.48);
    for (let i = 0; i < count; i++) {
      const id = ac.options[i];
      const aug = AUGMENTS[id];
      const cx = startX + i * (cw + gap);
      const sel = i === ac.selected;
      // Card background
      ctx.fillStyle = sel ? '#1a0a2a' : '#0d0615';
      ctx.strokeStyle = sel ? aug.colour : '#442266';
      ctx.lineWidth = sel ? 2 : 1;
      ctx.fillRect(cx, cardY, cw, cardH);
      ctx.strokeRect(cx, cardY, cw, cardH);
      if (sel) {
        ctx.shadowBlur = 12; ctx.shadowColor = aug.colour;
        ctx.strokeRect(cx, cardY, cw, cardH);
        ctx.shadowBlur = 0;
      }
      // Icon
      const iconFs = narrow ? 28 : 36;
      ctx.font = iconFs + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = aug.colour;
      ctx.fillText(aug.icon, cx + cw / 2, cardY + (narrow ? 35 : 45));
      // Name
      const nameFs = narrow ? 11 : 13;
      ctx.font = 'bold ' + nameFs + 'px monospace';
      ctx.fillStyle = aug.colour;
      ctx.fillText(aug.name, cx + cw / 2, cardY + (narrow ? 58 : 72));
      // Description — word wrap
      ctx.font = (narrow ? 11 : 11) + 'px monospace';
      ctx.fillStyle = '#ccbbdd';
      const words = aug.desc.split(' ');
      let line = '', lineY = cardY + (narrow ? 75 : 92);
      const maxW = cw - 16;
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxW && line) {
          ctx.fillText(line, cx + cw / 2, lineY);
          lineY += narrow ? 13 : 15;
          line = w;
        } else { line = test; }
      }
      if (line) ctx.fillText(line, cx + cw / 2, lineY);
      // Key hint
      ctx.font = (narrow ? 9 : 10) + 'px monospace';
      ctx.fillStyle = sel ? '#ffffff' : '#665588';
      ctx.fillText('[' + (i + 1) + ']', cx + cw / 2, cardY + cardH - (narrow ? 8 : 12));
    }
    ctx.restore();
  },

  // ─── Event Choice ────────────────────────────────────────────────────────
  updateEventChoice() {
    const ec = this.eventChoice;
    if (!ec) { this.setState('PLAYING'); return; }
    if (jp('Digit1')) { this.applyEventChoice('a'); return; }
    if (jp('Digit2')) { this.applyEventChoice('b'); return; }
    if (jp(ALT_KEYS.left) || jp(km('left')))  ec.selected = 0;
    if (jp(ALT_KEYS.right)|| jp(km('right')))  ec.selected = 1;
    if (jp('Enter') || jp(km('shoot')))     { this.applyEventChoice(ec.selected === 0 ? 'a' : 'b'); return; }
    if (jp('MouseLeft')) {
      const narrow = layout.compact;
      const cw = narrow ? Math.min(200, (W - 20) / 2 - 8) : Math.min(260, (W - 40) / 2 - 12);
      const gap = narrow ? 10 : 16;
      const totalW = cw * 2 + gap;
      const startX = (W - totalW) / 2;
      const cardY = H * 0.34;
      const cardH = narrow ? Math.min(180, H * 0.40) : Math.min(220, H * 0.38);
      for (let i = 0; i < 2; i++) {
        const cx = startX + i * (cw + gap);
        if (mouse.x >= cx && mouse.x <= cx + cw && mouse.y >= cardY && mouse.y <= cardY + cardH) {
          this.applyEventChoice(i === 0 ? 'a' : 'b'); return;
        }
      }
    }
  },

  /**
   * @param {any} choice
   */
  applyEventChoice(choice) {
    const ec = this.eventChoice;
    if (!ec) { this.setState('PLAYING'); return; }
    audio.eventResolve();
    applyEventEffect(ec.event, choice, this.player, this);
    this.eventChoice = null;
    // If effect killed the player (e.g. trap damage), endRun already fired — don't overwrite
    if (this.player.hp <= 0 || this.state === 'GAME_OVER' || this.state === 'NAME_ENTRY' || this.state === 'VICTORY') return;
    this.player.eventsResolved++;
    this.setState('PLAYING');
    // Check for pending perk choices (XP-granting events may trigger level-ups)
    if (this.pendingPerkChoices && this.pendingPerkChoices.length > 0 && this.state === 'PLAYING') {
      this.openNextPerkChoice();
    }
  },

  renderEventChoice() {
    const ec = this.eventChoice;
    if (!ec) return;
    const ev = ec.event;
    const narrow = layout.compact;
    ctx.save();
    // Dimmed overlay
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, W, H);
    // Event icon + name
    const titleFs = narrow ? 16 : 22;
    ctx.font = 'bold ' + titleFs + 'px monospace';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 12; ctx.shadowColor = ev.colour;
    ctx.fillStyle = ev.colour;
    ctx.fillText(ev.icon + ' ' + ev.name.toUpperCase(), W / 2, H * 0.10);
    ctx.shadowBlur = 0;
    // Event description — word wrap
    ctx.font = (narrow ? 10 : 12) + 'px monospace';
    ctx.fillStyle = '#aaccbb';
    const descWords = ev.desc.split(' ');
    let dLine = '', dY = H * 0.10 + titleFs + 6;
    const maxDescW = narrow ? W - 40 : W * 0.65;
    for (const w of descWords) {
      const test = dLine ? dLine + ' ' + w : w;
      if (ctx.measureText(test).width > maxDescW && dLine) {
        ctx.fillText(dLine, W / 2, dY);
        dY += narrow ? 14 : 16;
        dLine = w;
      } else { dLine = test; }
    }
    if (dLine) ctx.fillText(dLine, W / 2, dY);
    // Choice cards
    const cw = narrow ? Math.min(200, (W - 20) / 2 - 8) : Math.min(260, (W - 40) / 2 - 12);
    const gap = narrow ? 10 : 16;
    const totalW = cw * 2 + gap;
    const startX = (W - totalW) / 2;
    const cardY = H * 0.34;
    const cardH = narrow ? Math.min(180, H * 0.40) : Math.min(220, H * 0.38);
    const choices = [ev.a, ev.b];
    for (let i = 0; i < 2; i++) {
      const ch = choices[i];
      const cx = startX + i * (cw + gap);
      const sel = i === ec.selected;
      // Card background
      ctx.fillStyle = sel ? '#0a1a1a' : '#060f0f';
      ctx.strokeStyle = sel ? ev.colour : '#224444';
      ctx.lineWidth = sel ? 2 : 1;
      ctx.fillRect(cx, cardY, cw, cardH);
      ctx.strokeRect(cx, cardY, cw, cardH);
      if (sel) {
        ctx.shadowBlur = 10; ctx.shadowColor = ev.colour;
        ctx.strokeRect(cx, cardY, cw, cardH);
        ctx.shadowBlur = 0;
      }
      // Choice label
      const labelFs = narrow ? 13 : 16;
      ctx.font = 'bold ' + labelFs + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = sel ? ev.colour : '#88bbaa';
      ctx.fillText(ch.label, cx + cw / 2, cardY + (narrow ? 22 : 28));
      // Choice description — word wrap
      ctx.font = (narrow ? 11 : 11) + 'px monospace';
      ctx.fillStyle = '#99bbaa';
      const cWords = ch.desc.split(' ');
      let cLine = '', cY = cardY + (narrow ? 40 : 50);
      const cMaxW = cw - 16;
      for (const w of cWords) {
        const test = cLine ? cLine + ' ' + w : w;
        if (ctx.measureText(test).width > cMaxW && cLine) {
          ctx.fillText(cLine, cx + cw / 2, cY);
          cY += narrow ? 13 : 15;
          cLine = w;
        } else { cLine = test; }
      }
      if (cLine) ctx.fillText(cLine, cx + cw / 2, cY);
      // Summary tag
      ctx.font = 'bold ' + (narrow ? 9 : 10) + 'px monospace';
      ctx.fillStyle = sel ? '#ffffff' : '#557766';
      ctx.fillText(ch.summary, cx + cw / 2, cardY + cardH - (narrow ? 24 : 30));
      // Key hint
      ctx.font = (narrow ? 9 : 10) + 'px monospace';
      ctx.fillStyle = sel ? '#ffffff' : '#446655';
      ctx.fillText('[' + (i + 1) + ']', cx + cw / 2, cardY + cardH - (narrow ? 8 : 12));
    }
    ctx.restore();
  },

  // ─── Vendor Shop ─────────────────────────────────────────────────────────
  updateShopping() {
    const room = this.shopRoom;
    if (!room || !room.shopItems) { this.setState('PLAYING'); return; }
    const items = room.shopItems;
    // If all sold, wait for auto-close timer (set in tryShopBuy)
    /**
     * @param {any} i
     */
    if (this.shopClosing || items.every((/** @type {any} */ i) => i.sold)) return;

    // Keyboard navigation
    if (jp('Escape') || jp('KeyQ')) { audio.menuSelect(); this.setState('PLAYING'); return; }
    if (jp(ALT_KEYS.left) || jp(km('left')))  this.shopSelected = Math.max(0, this.shopSelected - 1);
    if (jp(ALT_KEYS.right)|| jp(km('right')))  this.shopSelected = Math.min(2, this.shopSelected + 1);

    // Direct buy by number
    for (let i = 0; i < 3; i++) {
      if (jp('Digit' + (i + 1)) && !items[i].sold) {
        this.tryShopBuy(i);
        return;
      }
    }
    // Enter on selected
    if (jp('Enter') || jp(km('shoot'))) {
      if (!items[this.shopSelected].sold) this.tryShopBuy(this.shopSelected);
      return;
    }

    // Mouse/touch click on cards or leave button
    if (jp('MouseLeft')) {
      const cw = Math.min(200, W * 0.28);
      const gap = 16;
      const totalW = cw * 3 + gap * 2;
      const startX = (W - totalW) / 2;
      const cardY = H * 0.22;
      const cardH = Math.min(200, H * 0.38);
      const mx = mouse.x, my = mouse.y;

      for (let i = 0; i < 3; i++) {
        const cx = startX + i * (cw + gap);
        if (!items[i].sold && mx >= cx && mx <= cx + cw && my >= cardY && my <= cardY + cardH) {
          this.tryShopBuy(i);
          return;
        }
      }
      // Leave button
      const leaveY = cardY + cardH + 20;
      const leaveW = 160, leaveH = 40;
      if (mx >= (W - leaveW) / 2 && mx <= (W + leaveW) / 2 && my >= leaveY && my <= leaveY + leaveH) {
        audio.menuSelect();
        this.setState('PLAYING');
        return;
      }
    }
  },

  /**
   * @param {any} idx
   */
  tryShopBuy(idx) {
    const item = this.shopRoom.shopItems[idx];
    if (!item || item.sold) return;
    if (this.player.credits < item.price) {
      audio.purchaseFail();
      this.msg('Not enough credits!', '#ff3333');
      return;
    }
    this.player.credits -= item.price;
    item.fn(this.player);
    item.sold = true;
    audio.purchase();
    this.msg('Bought ' + item.name, item.colour);
    spawnParticles(this.player.x, this.player.y, 'SPARK', item.colour, 8);
    // Advance cursor to next unsold slot
    const items = this.shopRoom.shopItems;
    /**
     * @param {any} it
     * @param {any} i
     */
    const nextUnsold = items.findIndex((/** @type {any} */ it, /** @type {any} */ i) => i > idx && !it.sold);
    /**
     * @param {any} it
     */
    const prevUnsold = items.findIndex((/** @type {any} */ it) => !it.sold);
    this.shopSelected = nextUnsold >= 0 ? nextUnsold : (prevUnsold >= 0 ? prevUnsold : idx);
    // If all sold, auto-leave after brief delay
    /**
     * @param {any} i
     */
    if (items.every((/** @type {any} */ i) => i.sold)) {
      this.shopClosing = true;
      setTimeout(() => { if (this.state === 'SHOPPING') this.setState('PLAYING'); this.shopClosing = false; }, 400);
    }
  },

  updateReading() {
    if (!this.readingInteractArmed && !keys.has(km('interact'))) {
      this.readingInteractArmed = true;
    }
    const closeByInteract = this.readingInteractArmed && jp(km('interact'));
    if (closeByInteract || jp('Escape') || jp('Enter') || jp('MouseLeft')) {
      audio.menuSelect();
      // Clear whisper meta on close so the next READING entry (data terminal
      // lore) renders with the amber styling, not whatever was set last.
      this._whisperMeta = null;
      this.currentLore = null;
      this.setState('PLAYING');
    }
  },

  /**
   * @param {any} dt
   */
  updateFade(dt) {
    this.fadeTime+=dt;
    // Refresh glitch bars every ~100ms
    this.fadeGlitchTimer-=dt;
    if (this.fadeGlitchTimer<=0) {
      this.fadeGlitchTimer=0.1;
      const count=3+Math.floor(Math.random()*3);
      this.fadeGlitchBars=[];
      for (let i=0;i<count;i++) {
        this.fadeGlitchBars.push({
          y: Math.random()*H,
          h: 1+Math.random()*4,
          x: Math.random()*W*0.3,
          w: W*(0.3+Math.random()*0.7),
          color: Math.random()>0.5 ? '#ff00c8' : '#00f5ff',
          alpha: 0.15+Math.random()*0.35
        });
      }
    }
    if (this.fadeDir===1) {
      this.fadeAlpha+=dt*(1/0.4);
      if (this.fadeAlpha>=1) {
        this.fadeAlpha=1;
        this.fadeDir=2; // hold phase
        this.fadeHold=0;
        if (this.fadeCallback) {
          this.fadeCallback();
          this.fadeCallback=null;
        }
      }
    } else if (this.fadeDir===2) {
      // Hold at peak for 150ms
      this.fadeHold+=dt;
      if (this.fadeHold>=0.15) this.fadeDir=-1;
    } else if (this.fadeDir===-1) {
      this.fadeAlpha-=dt*(1/0.4);
      if (this.fadeAlpha<=0) {
        this.fadeAlpha=0; this.fadeDir=0;
        if (this.fadeNextState) this.setState(this.fadeNextState);
      }
    }
  },

  // ─── Virtual Keyboard Layout ──────────────────────────────────────────────
  _vkChars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'.split(''),
  _vkCols: 10,

  /**
   * @param {any} narrow
   */
  _vkLayout(narrow) {
    const cols=this._vkCols;
    const cellW=narrow?28:36, cellH=narrow?28:36, gap=narrow?3:4;
    const rows=Math.ceil((this._vkChars.length+2)/cols); // +2 for DEL/OK
    const gridW=cols*(cellW+gap)-gap;
    const ox=(W-gridW)/2;
    return {cellW,cellH,gap,cols,rows,ox,gridW};
  },

  /**
   * @param {any} cx
   * @param {any} cy
   * @param {any} oy
   * @param {any} narrow
   */
  _vkHitTest(cx,cy,oy,narrow) {
    const {cellW,cellH,gap,cols,ox}=this._vkLayout(narrow);
    const allKeys=[...this._vkChars,'←','OK'];
    for (let i=0;i<allKeys.length;i++) {
      const col=i%cols, row=Math.floor(i/cols);
      const kx=ox+col*(cellW+gap), ky=oy+row*(cellH+gap);
      // OK key is double-wide
      const kw=allKeys[i]==='OK'?(cellW*2+gap):cellW;
      if (cx>=kx&&cx<=kx+kw&&cy>=ky&&cy<=ky+cellH) return allKeys[i];
    }
    return null;
  },

  /**
   * @param {any} dt
   */
  updateNameEntry(dt) {
    const ne=this.nameEntry;
    if (!ne) return;
    ne.cursorBlink=(ne.cursorBlink||0)+dt;

    // Desktop keyboard input
    if (lastKey.length===1 && /[A-Za-z0-9 \-_]/.test(lastKey)) {
      if (ne.name.length<12) ne.name+=lastKey.toUpperCase();
    }
    if (jp('Backspace')) ne.name=ne.name.slice(0,-1);

    // Touch/click virtual keyboard
    if (nameEntryTap) {
      const narrow=layout.compact;
      const oy=narrow?280:340;
      const hit=this._vkHitTest(nameEntryTap[0],nameEntryTap[1],oy,narrow);
      if (hit==='←') ne.name=ne.name.slice(0,-1);
      else if (hit==='OK') { if (ne.name.length===0) ne.name='ANON'; jp('Enter'); justPressed.add('Enter'); }
      else if (hit && ne.name.length<12) ne.name+=hit;
    }
    // Mouse click on virtual keyboard (desktop)
    if (jp('MouseLeft') && !nameEntryTap) {
      const narrow=layout.compact;
      const oy=narrow?280:340;
      const hit=this._vkHitTest(mouse.x,mouse.y,oy,narrow);
      if (hit==='←') ne.name=ne.name.slice(0,-1);
      else if (hit==='OK') { if (ne.name.length===0) ne.name='ANON'; justPressed.add('Enter'); }
      else if (hit && ne.name.length<12) ne.name+=hit;
    }

    // Confirm (Enter on keyboard or OK on virtual keyboard)
    if (jp('Enter')) {
      if (ne.name.length===0) ne.name='ANON';
      audio.menuSelect();
      this.saveScore(ne.name);
      const dest=ne.victory?'VICTORY':'GAME_OVER';
      this.nameEntry=null;
      this.setState(dest);
    }
  },

  renderNameEntry() {
    const ne=this.nameEntry;
    if (!ne) return;
    const narrow=layout.compact;
    const isTouch=isTouchDevice();

    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.95)'; ctx.fillRect(0,0,W,H);
    ctx.textAlign='center';

    // Title
    ctx.shadowBlur=30; ctx.shadowColor='#ffb700';
    ctx.fillStyle='#ffb700'; ctx.font=`bold ${narrow?28:40}px monospace`;
    ctx.fillText('HIGH SCORE!',W/2,narrow?60:80);

    // Rank + score
    ctx.shadowBlur=0;
    ctx.fillStyle='#aaaacc'; ctx.font=`${narrow?14:18}px monospace`;
    ctx.fillText(`Rank #${ne.rank+1}  •  Score: ${this.player.score}  •  Floor: ${this.floor}`,W/2,narrow?95:125);

    // Name input field
    const fieldY=narrow?130:170;
    ctx.fillStyle='#555577'; ctx.font=`${narrow?12:14}px monospace`;
    ctx.fillText('ENTER YOUR NAME',W/2,fieldY);

    const nameDisplay=ne.name+(Math.floor(ne.cursorBlink*3)%2===0?'_':'');
    ctx.shadowBlur=15; ctx.shadowColor='#00f5ff';
    ctx.fillStyle='#00f5ff'; ctx.font=`bold ${narrow?24:32}px monospace`;
    ctx.fillText(nameDisplay,W/2,fieldY+(narrow?30:40));
    ctx.shadowBlur=0;

    // Virtual keyboard
    const oy=narrow?280:340;
    const {cellW,cellH,gap,cols,ox}=this._vkLayout(narrow);
    const allKeys=[...this._vkChars,'←','OK'];
    const fontSize=narrow?12:14;

    for (let i=0;i<allKeys.length;i++) {
      const col=i%cols, row=Math.floor(i/cols);
      const kx=ox+col*(cellW+gap), ky=oy+row*(cellH+gap);
      const key=allKeys[i];
      const isOK=key==='OK';
      const isDel=key==='←';
      const kw=isOK?(cellW*2+gap):cellW;

      // Hover highlight
      let hover=false;
      if (nameEntryTap) {
        const [tx,ty]=nameEntryTap;
        hover=tx>=kx&&tx<=kx+kw&&ty>=ky&&ty<=ky+cellH;
      } else if (mouse.x>=kx&&mouse.x<=kx+kw&&mouse.y>=ky&&mouse.y<=ky+cellH) {
        hover=true;
      }

      // Key background
      ctx.fillStyle=hover?(isOK?'#39ff14':isDel?'#ff3333':'#00f5ff'):'rgba(255,255,255,0.08)';
      ctx.globalAlpha=hover?0.3:1;
      ctx.fillRect(kx,ky,kw,cellH);
      ctx.globalAlpha=1;

      // Key border
      ctx.strokeStyle=isOK?'#39ff14':isDel?'#ff3333':'#555577';
      ctx.lineWidth=1;
      ctx.strokeRect(kx,ky,kw,cellH);

      // Key label
      ctx.fillStyle=isOK?'#39ff14':isDel?'#ff3333':'#aaaacc';
      ctx.font=`${isOK?'bold ':''}${fontSize}px monospace`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(key,kx+kw/2,ky+cellH/2);
    }
    ctx.textBaseline='alphabetic';

    // Hint
    ctx.textAlign='center';
    ctx.fillStyle='#555577'; ctx.font=`${narrow?10:12}px monospace`;
    if (isTouch) {
      ctx.fillText('TAP KEYS TO ENTER NAME  •  TAP OK TO CONFIRM',W/2,oy+(narrow?130:155));
    } else {
      ctx.fillText('TYPE YOUR NAME  •  PRESS ENTER TO CONFIRM',W/2,oy+(narrow?130:155));
    }

    ctx.restore();
  },

  updateGameOver() {
    if (jp('Enter')||jp('MouseLeft')) { audio.menuSelect(); this.setState('MENU'); }
  },

  updateVictory() {
    if (jp('Enter')||jp('MouseLeft')) { audio.menuSelect(); this._newlyUnlocked = null; this.setState('MENU'); }
  },

  updateArchives() {
    const n = META_UPGRADES.length;
    if (this.archivesSel === undefined) this.archivesSel = 0;
    if (jp(ALT_KEYS.up)||jp(km('up')))   this.archivesSel = (this.archivesSel - 1 + n) % n;
    if (jp(ALT_KEYS.down)||jp(km('down'))) this.archivesSel = (this.archivesSel + 1) % n;
    if (jp('Escape')||jp('KeyQ'))    { audio.menuSelect(); this.setState('MENU'); return; }
    if (jp('Enter')||jp('MouseLeft')) {
      const u = META_UPGRADES[this.archivesSel];
      const meta = loadMeta();
      const curLv = meta.upgrades[u.id] || 0;
      if (curLv >= u.maxLv) return;
      const cost = u.costs[curLv];
      if (!Number.isFinite(cost) || meta.shards < cost) { audio.hit(true); return; }
      meta.shards -= cost;
      meta.upgrades[u.id] = curLv + 1;
      saveMeta(meta);
      audio.purchase();
    }
  },

  // ─── Settings ────────────────────────────────────────────────────────────────
  _settingsFrom: 'MENU',
  _settingsSel: 0,
  _settingsCapture: null,  // action name being rebound, or null
  _settingsDrag: null,     // 'sfx' or 'music' while dragging a slider

  updateSettings() {
    const actions = Object.keys(DEFAULT_KEY_MAP);
    const TOGGLE_START = 2;   // row index where toggles begin
    const CTRL_START = 6;     // row index where key rebind rows begin (4 toggles)
    // Total items: 2 sliders + 4 toggles + N rebind rows + 1 reset row + 1 back row
    const totalRows = CTRL_START + actions.length + 2;

    // Key capture mode — wait for next keydown
    if (this._settingsCapture) {
      // On touch devices, tap (MouseLeft) cancels capture since there's no keyboard
      if (isTouchDevice() && justPressed.has('MouseLeft')) { this._settingsCapture = null; return; }
      for (const code of justPressed) {
        if (code === 'Escape') { this._settingsCapture = null; return; }
        if (code === 'MouseLeft') continue;   // ignore mouse click during capture
        if (RESERVED_KEYS.has(code)) continue; // reserved keys can't be bound
        // Swap: if another action already uses this code, swap them
        const curAction = this._settingsCapture;
        if (!curAction) return;
        const oldCode = settings.keyMap[curAction];
        for (const a of actions) {
          if (a !== curAction && settings.keyMap[a] === code) {
            if (oldCode !== undefined) settings.keyMap[a] = oldCode;
            break;
          }
        }
        settings.keyMap[curAction] = code;
        settings.save();
        this._settingsCapture = null;
        audio.menuSelect();
        return;
      }
      return;
    }

    // Slider dragging
    if (this._settingsDrag && mouse.down) {
      const narrow = layout.compact;
      const sliderX = narrow ? 120 : 200;
      const sliderW = narrow ? (W - 240) : 400;
      let val = (mouse.x - sliderX) / sliderW;
      val = Math.max(0, Math.min(1, val));
      if (this._settingsDrag === 'sfx') audio.setSfxVolume(val);
      else audio.setMusicVolume(val);
      settings.save();
      return;
    }
    if (this._settingsDrag && !mouse.down) { this._settingsDrag = null; }

    // Navigation
    if (jp(ALT_KEYS.up) || jp(km('up')))     this._settingsSel = (this._settingsSel - 1 + totalRows) % totalRows;
    if (jp(ALT_KEYS.down) || jp(km('down')))  this._settingsSel = (this._settingsSel + 1) % totalRows;

    const sel = this._settingsSel;

    // Left/right on volume sliders
    if (sel < TOGGLE_START) {
      const step = 0.05;
      if (jp(ALT_KEYS.left) || jp(km('left'))) {
        if (sel === 0) audio.setSfxVolume(Math.max(0, settings.sfxVol - step));
        else audio.setMusicVolume(Math.max(0, settings.musicVol - step));
        settings.save();
      }
      if (jp(ALT_KEYS.right) || jp(km('right'))) {
        if (sel === 0) audio.setSfxVolume(Math.min(1, settings.sfxVol + step));
        else audio.setMusicVolume(Math.min(1, settings.musicVol + step));
        settings.save();
      }
    }

    // Left/right or Enter toggles display options
    const toggleKeys = ['screenShake', 'damageNumbers', 'lockAimToMove', 'aimAssist'];
    if (sel >= TOGGLE_START && sel < CTRL_START) {
      if (jp(ALT_KEYS.left) || jp(km('left')) || jp(ALT_KEYS.right) || jp(km('right')) || jp('Enter') || jp(km('shoot'))) {
        const key = toggleKeys[sel - TOGGLE_START];
        if (key) {
          /** @type {any} */
          const s = settings;
          s[key] = !s[key];
          settings.save();
          audio.menuSelect();
        }
      }
    }

    // Mouse click hit-testing
    if (jp('MouseLeft')) {
      const narrow = layout.compact;
      const startY = narrow ? 80 : 100;
      const rowH = narrow ? 28 : 34;
      const sliderX = narrow ? 120 : 200;
      const sliderW = narrow ? (W - 240) : 400;
      const mx = mouse.x, my = mouse.y;

      // Slider click
      for (let i = 0; i < 2; i++) {
        const ry = startY + i * rowH;
        if (my >= ry - 8 && my <= ry + 14 && mx >= sliderX && mx <= sliderX + sliderW) {
          let val = (mx - sliderX) / sliderW;
          val = Math.max(0, Math.min(1, val));
          if (i === 0) audio.setSfxVolume(val);
          else audio.setMusicVolume(val);
          this._settingsDrag = i === 0 ? 'sfx' : 'music';
          this._settingsSel = i;
          settings.save();
          audio.menuSelect();
          return;
        }
      }
      // Toggle rows click
      for (let i = 0; i < toggleKeys.length; i++) {
        const ry = startY + (TOGGLE_START + i) * rowH;
        if (my >= ry - 8 && my <= ry + 14) {
          this._settingsSel = TOGGLE_START + i;
          const tk = toggleKeys[i];
          if (tk) {
            /** @type {any} */
            const s = settings;
            s[tk] = !s[tk];
          }
          settings.save();
          audio.menuSelect();
          return;
        }
      }
      // Rebind rows click
      for (let i = 0; i < actions.length; i++) {
        const ry = startY + (CTRL_START + i) * rowH;
        if (my >= ry - 8 && my <= ry + 14) {
          this._settingsSel = CTRL_START + i;
          this._settingsCapture = actions[i];
          audio.menuSelect();
          return;
        }
      }
      // Reset defaults row
      const resetY = startY + (CTRL_START + actions.length) * rowH;
      if (my >= resetY - 8 && my <= resetY + 14) {
        settings.resetAll();
        audio.setSfxVolume(1.0); audio.setMusicVolume(1.0);
        audio.menuSelect();
        return;
      }
      // Back row
      const backY = startY + (CTRL_START + actions.length + 1) * rowH;
      if (my >= backY - 8 && my <= backY + 14) {
        audio.menuSelect();
        this.setState(this._settingsFrom || 'MENU');
        return;
      }
    }

    // Enter on selected row (toggles handled above)
    if (jp('Enter') || jp(km('shoot'))) {
      if (sel >= CTRL_START && sel < CTRL_START + actions.length) {
        this._settingsCapture = actions[sel - CTRL_START];
        audio.menuSelect();
      } else if (sel === CTRL_START + actions.length) {
        settings.resetAll();
        audio.setSfxVolume(1.0); audio.setMusicVolume(1.0);
        audio.menuSelect();
      } else if (sel === totalRows - 1) {
        audio.menuSelect();
        this.setState(this._settingsFrom || 'MENU');
      }
    }

    // Escape goes back
    if (jp('Escape') || jp('KeyQ')) {
      audio.menuSelect();
      this.setState(this._settingsFrom || 'MENU');
    }
  },

  renderSettings() {
    const narrow = layout.compact;
    const actions = Object.keys(DEFAULT_KEY_MAP);
    const TOGGLE_START = 2;
    const CTRL_START = 6;  // matches updateSettings — 4 toggles
    const startY = narrow ? 80 : 100;
    const rowH = narrow ? 28 : 34;
    const fs = narrow ? 13 : 16;
    const labelX = narrow ? 20 : 40;
    const sliderX = narrow ? 120 : 200;
    const sliderW = narrow ? (W - 240) : 400;
    const sel = this._settingsSel;

    // Title
    ctx.save();
    ctx.textAlign = 'center';
    ctx.shadowBlur = 20; ctx.shadowColor = '#00f5ff';
    ctx.fillStyle = '#00f5ff'; ctx.font = `bold ${narrow ? 28 : 38}px monospace`;
    ctx.fillText('SETTINGS', W/2, narrow ? 50 : 60);
    ctx.restore();

    ctx.save();
    ctx.font = `${fs}px monospace`;

    // ── Audio section ──
    const volLabels = ['SFX VOLUME', 'MUSIC VOLUME'];
    const volVals = [settings.sfxVol, settings.musicVol];
    for (let i = 0; i < 2; i++) {
      const ry = startY + i * rowH;
      const isSel = sel === i;
      ctx.fillStyle = isSel ? '#00f5ff' : '#888899';
      ctx.textAlign = 'left';
      ctx.fillText(volLabels[i] || '', labelX, ry);
      // Slider track
      const trackY = ry - 4;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(sliderX, trackY, sliderW, 10);
      // Slider fill
      const fillW = sliderW * (volVals[i] ?? 0);
      ctx.fillStyle = isSel ? '#00f5ff' : '#555577';
      ctx.fillRect(sliderX, trackY, fillW, 10);
      // Slider knob
      ctx.fillStyle = isSel ? '#ffffff' : '#aaaacc';
      ctx.fillRect(sliderX + fillW - 3, trackY - 2, 6, 14);
      // Percentage
      ctx.textAlign = 'right';
      ctx.fillStyle = isSel ? '#00f5ff' : '#888899';
      ctx.fillText(`${Math.round((volVals[i] ?? 0) * 100)}%`, sliderX + sliderW + (narrow ? 40 : 60), ry);
    }

    // ── Display section ──
    const toggleLabels = ['SCREEN SHAKE', 'DAMAGE NUMBERS', 'LOCK AIM TO MOVE', 'AIM ASSIST'];
    const toggleKeys = ['screenShake', 'damageNumbers', 'lockAimToMove', 'aimAssist'];
    for (let i = 0; i < toggleLabels.length; i++) {
      const ry = startY + (TOGGLE_START + i) * rowH;
      const isSel = sel === TOGGLE_START + i;
      const tk = toggleKeys[i];
      const on = tk ? /** @type {any} */ (settings)[tk] : false;
      ctx.textAlign = 'left';
      ctx.fillStyle = isSel ? '#00f5ff' : '#888899';
      ctx.fillText(toggleLabels[i] || '', labelX, ry);
      ctx.textAlign = 'center';
      ctx.fillStyle = on ? (isSel ? '#00ff88' : '#22aa66') : (isSel ? '#ff4466' : '#884444');
      ctx.fillText(on ? '◀ ON ▶' : '◀ OFF ▶', W/2, ry);
    }

    // ── Controls section ──
    const sectionY = startY + CTRL_START * rowH - 10;
    ctx.fillStyle = '#555577'; ctx.textAlign = 'left';
    ctx.font = `bold ${narrow ? 11 : 13}px monospace`;
    ctx.fillText('─── CONTROLS ───', labelX, sectionY);
    ctx.font = `${fs}px monospace`;

    for (let i = 0; i < actions.length; i++) {
      const ry = startY + (CTRL_START + i) * rowH;
      const a = actions[i];
      if (!a) continue;
      const isSel = sel === CTRL_START + i;
      const isCapturing = this._settingsCapture === a;
      ctx.textAlign = 'left';
      ctx.fillStyle = isSel ? '#ff00c8' : '#888899';
      ctx.fillText(ACTION_LABELS[a] || a, labelX, ry);
      ctx.textAlign = 'center';
      if (isCapturing) {
        const blink = Math.sin(Date.now() / 200) > 0 ? 1 : 0.3;
        ctx.globalAlpha = blink;
        ctx.fillStyle = '#ffcc00';
        ctx.fillText(isTouchDevice() ? 'TAP TO CANCEL' : 'PRESS A KEY...', W/2, ry);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = isSel ? '#ffffff' : '#aaaacc';
        ctx.fillText(KEY_DISPLAY(settings.keyMap[a]), W/2, ry);
        // Show default if different
        if (settings.keyMap[a] !== DEFAULT_KEY_MAP[a]) {
          ctx.fillStyle = '#555577'; ctx.font = `${narrow ? 11 : 11}px monospace`;
          ctx.fillText(`(default: ${KEY_DISPLAY(DEFAULT_KEY_MAP[a])})`, W/2 + (narrow ? 60 : 80), ry);
          ctx.font = `${fs}px monospace`;
        }
      }
    }

    // Reset defaults row
    const resetIdx = CTRL_START + actions.length;
    const resetY = startY + resetIdx * rowH;
    ctx.textAlign = 'center';
    ctx.fillStyle = sel === resetIdx ? '#ffcc00' : '#666677';
    ctx.fillText('[ RESET TO DEFAULTS ]', W/2, resetY);

    // Back row
    const backIdx = resetIdx + 1;
    const backY = startY + backIdx * rowH;
    ctx.fillStyle = sel === backIdx ? '#00f5ff' : '#666677';
    ctx.fillText('[ BACK ]', W/2, backY);

    ctx.restore();

    // Navigation hint
    ctx.save(); ctx.textAlign = 'center';
    ctx.fillStyle = '#444466'; ctx.font = `${narrow ? 11 : 11}px monospace`;
    if (isTouchDevice()) {
      ctx.fillText('Tap to adjust · ESC to go back', W/2, H - 20);
    } else {
      ctx.fillText('↑↓ Navigate · ◀▶ Adjust/Toggle · Enter to rebind · ESC Back', W/2, H - 20);
    }
    ctx.restore();
  },

  render() {
    ctx.fillStyle='#0a0a12';
    ctx.fillRect(0,0,W,H);

    switch(this.state) {
      case 'MENU':      this.renderMenu();     break;
      case 'INTRO':     this.renderIntro();    break;
      case 'ENDGAME_CHOICE': this.renderPlaying(); this.renderEndgameChoice(); break;
      case 'PLAYING':   this.renderPlaying(); if (this.mapExpanded) drawExpandedMinimap(this.dungeon, this.player); break;
      case 'PAUSED':    this.renderPlaying(); this.renderPaused(); break;
      case 'POWERUP_CHOICE': this.renderPlaying(); this.renderPowerupChoice(); break;
      case 'PERK_CHOICE':    this.renderPlaying(); this.renderPerkChoice(); break;
      case 'AUGMENT_CHOICE': this.renderPlaying(); this.renderAugmentChoice(); break;
      case 'EVENT_CHOICE':   this.renderPlaying(); this.renderEventChoice(); break;
      case 'SHOPPING':       this.renderPlaying(); this.renderShopping(); break;
      case 'READING':        this.renderPlaying(); this.renderReading(); break;
      case 'ARCHIVES':  this.renderArchives(); break;
      case 'SETTINGS':  this.renderSettings(); break;
      case 'FADE':      this.renderPlaying(); this.renderFade();   break;
      case 'HUB':       if (typeof NEON !== 'undefined' && NEON.hub) NEON.hub.drawHub(ctx, this); break;
      case 'GAME_OVER': this.renderGameOver(); break;
      case 'VICTORY':   this.renderVictory();  break;
      case 'NAME_ENTRY': this.renderNameEntry(); break;
    }
  },

  /**
   * @param {any} y
   * @param {any} maxEntries
   * @param {any} highlightRank
   */
  renderLeaderboard(y, maxEntries, highlightRank) {
    const narrow=layout.compact;
    const scores=this.getScores().slice(0,maxEntries);
    ctx.save();
    ctx.textAlign='center';
    ctx.shadowBlur=8; ctx.shadowColor='#ffb700';
    ctx.fillStyle='#ffb700'; ctx.font=`${narrow?14:14}px monospace`;
    ctx.fillText('— HIGH SCORES —',W/2,y);
    ctx.shadowBlur=0;
    const lineH=narrow?20:18;
    const startY=y+(narrow?22:20);
    /**
     * @param {any} s
     * @param {any} i
     */
    scores.forEach((/** @type {any} */ s,/** @type {any} */ i)=>{
      const isHL=i===highlightRank;
      ctx.fillStyle=isHL?'#00f5ff':'#aaaacc';
      if (isHL) { ctx.shadowBlur=6; ctx.shadowColor='#00f5ff'; }
      ctx.font=`${isHL?'bold ':''}${narrow?12:12}px monospace`;
      if (narrow) {
        ctx.fillText(`${i+1}. ${s.name}  ${s.score}  FLR ${s.floor}`,W/2,startY+i*lineH);
      } else {
        ctx.fillText(`${i+1}. ${s.name.padEnd(12)} ${String(s.score).padStart(8)}  FLR ${s.floor}`,W/2,startY+i*lineH);
      }
      if (isHL) ctx.shadowBlur=0;
    });
    if (!scores.length) {
      ctx.fillStyle='#555577'; ctx.font=`${narrow?12:12}px monospace`;
      ctx.fillText('No scores yet.',W/2,startY);
    }
    ctx.restore();
  },

  renderMenu() {
    // bg particles
    for (const p of (this.menuParticles||[])) {
      ctx.save(); ctx.globalAlpha=p.life*0.6;
      ctx.fillStyle=p.col; ctx.fillRect(p.x,p.y,2,2);
      ctx.restore();
    }

    const t=Date.now()/1000;
    const isTouch = isTouchDevice();
    const narrow = layout.compact;
    const titleFs = narrow ? 56 : 72;
    // grid lines
    ctx.save(); ctx.globalAlpha=0.05; ctx.strokeStyle='#00f5ff';
    for (let x=0;x<W;x+=40){NEON.draw.line(ctx,x,0,x,H);}
    for (let y=0;y<H;y+=40){NEON.draw.line(ctx,0,y,W,y);}
    ctx.restore();

    // title — scale for portrait
    const ty1 = narrow ? 120 : 160;
    const ty2 = ty1 + titleFs * 0.95;
    ctx.save();
    ctx.textAlign='center';
    const flicker=Math.sin(t*7)>0.8?0.6:1;
    ctx.globalAlpha=flicker;
    ctx.shadowBlur=40; ctx.shadowColor='#00f5ff';
    ctx.fillStyle='#00f5ff'; ctx.font=`bold ${titleFs}px monospace`;
    ctx.fillText('NEON',W/2-8,ty1);
    ctx.shadowColor='#ff00c8'; ctx.fillStyle='#ff00c8';
    ctx.fillText('DUNGEON',W/2,ty2);
    ctx.restore();

    ctx.save(); ctx.textAlign='center';
    ctx.fillStyle='#aaaacc'; ctx.font=`${narrow ? 14 : 16}px monospace`;
    ctx.fillText('A CYBERPUNK DUNGEON CRAWLER',W/2,ty2 + 35);
    ctx.restore();

    // Menu options — array-driven
    const startY = ty2 + 80;
    const gap = isTouch ? (narrow ? 48 : 36) : (narrow ? 24 : 28);
    const fs = isTouch ? (narrow ? 22 : 22) : (narrow ? 15 : 18);
    const opts = this.getMenuOptions();
    const sel = this.menuSel || 0;
    ctx.save(); ctx.textAlign='center';
    for (let i = 0; i < opts.length; i++) {
      const selected = i === sel;
      const col = selected ? opts[i].colour : '#555577';
      ctx.shadowBlur = selected ? 10 : 0; ctx.shadowColor = col;
      ctx.fillStyle = col; ctx.font = `${selected?'bold ':''}${fs}px monospace`;
      ctx.fillText(`▶  ${opts[i].label}`, W/2, startY + i * gap);
    }
    ctx.shadowBlur=0;
    // Navigation hint (context-sensitive for difficulty row)
    ctx.fillStyle='#444466'; ctx.font=`${narrow?9:11}px monospace`;
    const diffHint = opts[sel]?.isDiffRow;
    if (isTouch) {
      ctx.fillText(diffHint ? 'Tap edges ◀▶ to change difficulty · center to start' : 'Tap to select', W/2, startY + opts.length * gap + 8);
    } else {
      ctx.fillText(diffHint ? '◀▶ change difficulty · Enter to start' : '↑↓ to select, Enter to confirm', W/2, startY + opts.length * gap + 8);
    }
    // Locked difficulty message (shown when trying to start a locked difficulty)
    if (this._menuMsg && this._menuMsg.life > 0) {
      const mm = this._menuMsg;
      ctx.globalAlpha = Math.min(1, mm.life);
      ctx.shadowBlur = 12; ctx.shadowColor = mm.colour;
      ctx.fillStyle = mm.colour; ctx.font = `bold ${narrow ? 12 : 14}px monospace`;
      ctx.fillText(mm.text, W/2, startY - (narrow ? 14 : 18));
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }
    ctx.restore();

    // controls hint
    const hintY = startY + opts.length * gap + (narrow?24:32);
    ctx.save(); ctx.textAlign='center';
    ctx.fillStyle='#555577'; ctx.font=`${narrow ? 13 : 12}px monospace`;
    if (isTouch) {
      ctx.fillText('Left: Move  |  Right: Aim & Shoot', W/2, hintY);
      if (narrow) {
        ctx.fillText(KEY_DISPLAY(km('interact'))+': Interact  |  ⇧: Dash', W/2, hintY + 18);
        ctx.fillText(KEY_DISPLAY(km('voidshard'))+': Bomb  |  ‖: Pause', W/2, hintY + 34);
      } else {
        ctx.fillText(KEY_DISPLAY(km('interact'))+': Interact  |  ⇧: Dash  |  '+KEY_DISPLAY(km('voidshard'))+': Bomb  |  ‖: Pause', W/2, hintY + 16);
      }
    } else {
      ctx.fillText(KEY_DISPLAY(km('up'))+KEY_DISPLAY(km('left'))+KEY_DISPLAY(km('down'))+KEY_DISPLAY(km('right'))+': Move  |  Mouse: Aim  |  Click/'+KEY_DISPLAY(km('shoot'))+': Shoot', W/2, hintY);
      ctx.fillText(KEY_DISPLAY(km('interact'))+': Interact  |  '+KEY_DISPLAY(km('dash'))+': Dash  |  '+KEY_DISPLAY(km('voidshard'))+': Bomb (tap-tap to detonate)  |  ESC: Pause', W/2, hintY + 16);
    }
    ctx.restore();

    // high scores
    const scoresY = hintY + 50;
    this.renderLeaderboard(scoresY, narrow ? 3 : 5, -1);

    // UNCHAINED #42 — ending-unlock markers. Drawn after leaderboard so they
    // don't fight the title layout. "FREED" is a persistent watermark; NG+
    // is a discrete badge under the subtitle.
    {
      const m = loadMeta();
      const freed  = Array.isArray(m.endingsUnlocked) && m.endingsUnlocked.includes('unchained');
      const keeper = Array.isArray(m.endingsUnlocked) && m.endingsUnlocked.includes('keeper');
      if (keeper) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffcc00';
        ctx.shadowColor = '#ffcc00';
        ctx.shadowBlur = 10;
        ctx.font = 'bold ' + (narrow ? 10 : 12) + 'px monospace';
        ctx.fillText('— NG+ AVAILABLE —', W / 2, ty2 + 52);
        ctx.restore();
      }
      if (freed) {
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#88ccff';
        ctx.shadowColor = '#88ccff';
        ctx.shadowBlur = 24;
        ctx.font = 'bold ' + Math.round(titleFs * 1.6) + 'px monospace';
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.rotate(-Math.PI / 10);
        ctx.fillText('FREED', 0, 0);
        ctx.restore();
        ctx.restore();
      }
    }

    // UNCHAINED: "Keep persistent unlocks?" confirm overlay.
    // Drawn last so it sits on top of every other menu layer.
    if (this._newGameConfirm) {
      const c = this._newGameConfirm;
      ctx.save();
      ctx.fillStyle = 'rgba(5,5,15,0.78)';
      ctx.fillRect(0, 0, W, H);
      const boxW = Math.min(520, W - 40);
      const boxH = narrow ? 180 : 200;
      const bx = (W - boxW) / 2, by = (H - boxH) / 2;
      ctx.strokeStyle = '#00f5ff'; ctx.lineWidth = 2;
      ctx.shadowBlur = 18; ctx.shadowColor = '#00f5ff';
      ctx.strokeRect(bx, by, boxW, boxH);
      ctx.shadowBlur = 0;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#00f5ff'; ctx.font = `bold ${narrow?16:20}px monospace`;
      ctx.fillText('START NEW RUN', W/2, by + (narrow?32:38));
      ctx.fillStyle = '#e0e0ff'; ctx.font = `${narrow?11:13}px monospace`;
      ctx.fillText('Keep persistent unlocks (cores, upgrades, modules, logs)?', W/2, by + (narrow?60:72));
      ctx.fillStyle = '#888899'; ctx.font = `${narrow?10:11}px monospace`;
      ctx.fillText('"RESET" wipes all meta progress. This cannot be undone.', W/2, by + (narrow?80:94));
      const btnY = by + (narrow?120:138);
      const btnLbls = ['KEEP UNLOCKS', 'RESET META'];
      const btnCols = ['#39ff14', '#ff4466'];
      const spacing = boxW / 2;
      for (let i = 0; i < 2; i++) {
        const selected = c.selected === i;
        const col = (selected ? btnCols[i] : '#555577') || '#555577';
        ctx.fillStyle = col;
        ctx.font = `${selected?'bold ':''}${narrow?13:16}px monospace`;
        ctx.shadowBlur = selected ? 12 : 0; ctx.shadowColor = col;
        ctx.fillText(`${selected?'▶ ':'  '}${btnLbls[i] || ''}`, bx + spacing * (i + 0.5), btnY);
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#444466'; ctx.font = `${narrow?9:11}px monospace`;
      ctx.fillText(isTouch ? 'Tap to choose · tap again to confirm · outside to cancel' : '◀▶ choose · Enter to confirm · Esc to cancel', W/2, by + boxH - (narrow?14:18));
      ctx.restore();
    }
  },

  renderPlaying() {
    const player=this.player;
    const dungeon=this.dungeon;
    const cam=getCamera(player);
    cam.x += shake.ox;
    cam.y += shake.oy;
    drawWorld(dungeon,cam.x,cam.y);
    drawAmbient(cam.x,cam.y);

    // Special room markers
    for (const r of dungeon.rooms) {
      if (!dungeon.visible[r.cy]?.[r.cx]) continue;
      if (r.healFont) {
        const sx=r.cx*TILE-cam.x+TILE/2, sy=r.cy*TILE-cam.y+TILE/2;
        ctx.save();
        ctx.shadowBlur=12; ctx.shadowColor='#00ff88'; ctx.globalAlpha=0.6+Math.sin(Date.now()/400)*0.2;
        ctx.fillStyle='#00ff88'; ctx.font='16px monospace'; ctx.textAlign='center';
        ctx.fillText('+', sx, sy+5);
        ctx.restore();
      }
      if (r.xpShrine && !r.shrineUsed) {
        const sx=r.cx*TILE-cam.x+TILE/2, sy=r.cy*TILE-cam.y+TILE/2;
        ctx.save();
        ctx.shadowBlur=15; ctx.shadowColor='#aa00ff'; ctx.globalAlpha=0.6+Math.sin(Date.now()/500)*0.2;
        ctx.fillStyle='#aa00ff'; ctx.font='16px monospace'; ctx.textAlign='center';
        ctx.fillText('☆', sx, sy+5);
        ctx.restore();
      }
      if (r.roomType === 'implant' && !r.implantUsed) {
        const sx=r.cx*TILE-cam.x+TILE/2, sy=r.cy*TILE-cam.y+TILE/2;
        ctx.save();
        ctx.shadowBlur=18; ctx.shadowColor='#cc44ff'; ctx.globalAlpha=0.6+Math.sin(Date.now()/600)*0.3;
        ctx.fillStyle='#cc44ff'; ctx.font='18px monospace'; ctx.textAlign='center';
        ctx.fillText('◆', sx, sy+6);
        ctx.restore();
      }
      /**
       * @param {any} i
       */
      if (r.shopItems && r.shopItems.some((/** @type {any} */ i) => !i.sold)) {
        const sx=r.cx*TILE-cam.x+TILE/2, sy=r.cy*TILE-cam.y+TILE/2;
        ctx.save();
        ctx.shadowBlur=12; ctx.shadowColor='#39ff14'; ctx.globalAlpha=0.6+Math.sin(Date.now()/350)*0.2;
        ctx.fillStyle='#39ff14'; ctx.font='16px monospace'; ctx.textAlign='center';
        ctx.fillText('◈', sx, sy+5);
        ctx.restore();
      }
    }

    // hazard zones (ground effects — below items/enemies)
    drawHazardZones(cam.x, cam.y);
    drawDisruptionFields(cam.x, cam.y);
    drawGravityWells(cam.x, cam.y);
    drawHackwareEffects(cam.x, cam.y);

    // volatile cores (below items, above ground effects)
    drawVCores(cam.x, cam.y);

    // alarm beacons
    drawBeacons(cam.x, cam.y);

    // shield generators (below items/enemies, above ground effects)
    drawShieldGens(cam.x, cam.y);

    // security cameras (draw cone before enemies for layering)
    drawCameras(cam.x, cam.y);

    // laser tripwires (draw beam before enemies for layering)
    drawLasers(cam.x, cam.y);

    // wall turrets
    drawWallTurrets(cam.x, cam.y);

    // proximity mines (below items/enemies, above ground effects)
    drawMines(cam.x, cam.y);

    // items
    for (const it of items) it.draw(cam.x,cam.y);

    // fuse bombs (tap-tap V) — above items, below enemies/cores so a mob
    // standing on a planted bomb hides it visually (in-world feel).
    drawFuseShards(cam.x, cam.y);

    // UNCHAINED #39: core drops — draw above items, below enemies.
    if (typeof NEON !== 'undefined' && NEON.cores && this.coreDrops && this.coreDrops.length) {
      const _ptCoresDraw = perfEnabled() ? performance.now() : 0;
      NEON.cores.drawCoreDrops(ctx, this.coreDrops, cam, TILE);
      if (_ptCoresDraw) perfRecord('cores-draw', performance.now() - _ptCoresDraw);
    }

    // enemies
    for (const e of enemies) e.draw(cam.x,cam.y);

    // projectiles
    for (const p of projectiles) p.draw(cam.x,cam.y);

    // chain lightning bolts
    if (game._chainBolts) {
      for (const bolt of game._chainBolts) {
        const sx=bolt.x1*TILE-cam.x, sy=bolt.y1*TILE-cam.y;
        const ex=bolt.x2*TILE-cam.x, ey=bolt.y2*TILE-cam.y;
        ctx.save();
        ctx.globalAlpha=bolt.timer/0.15;
        ctx.strokeStyle=bolt.colour;
        ctx.lineWidth=2;
        ctx.shadowColor=bolt.colour;
        ctx.shadowBlur=8;
        ctx.beginPath();
        // Jagged lightning: 3 segments with random offset
        const mx1=lerp(sx,ex,0.33)+(Math.random()-0.5)*8;
        const my1=lerp(sy,ey,0.33)+(Math.random()-0.5)*8;
        const mx2=lerp(sx,ex,0.66)+(Math.random()-0.5)*8;
        const my2=lerp(sy,ey,0.66)+(Math.random()-0.5)*8;
        ctx.moveTo(sx,sy); ctx.lineTo(mx1,my1); ctx.lineTo(mx2,my2); ctx.lineTo(ex,ey);
        ctx.stroke();
        ctx.restore();
      }
    }

    // particles
    drawParticles(cam.x,cam.y);
    drawFloatingTexts(cam.x,cam.y);

    // REAPER on-player telegraph rings — drawn AFTER particles/floating
    // text but BEFORE the player sprite so the ring sits beneath the
    // player and is never suppressed by the per-enemy FOV/cull in
    // Enemy.draw (an off-screen reaper must still warn the marked player).
    drawReaperPlayerRings(cam.x, cam.y);

    // player
    player.draw(cam.x,cam.y);

    // Saw blade orbitals
    const sawLvl = player.upgrades.SAW_BLADE||0;
    if (sawLvl > 0) {
      ctx.save();
      for (let i=0; i<sawLvl; i++) {
        const a = player.orbitalAngle + (TWO_PI / sawLvl) * i;
        const bx = player.x * TILE - cam.x + Math.cos(a) * 1.5 * TILE;
        const by = player.y * TILE - cam.y + Math.sin(a) * 1.5 * TILE;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(player.orbitalAngle * 4 + i);
        ctx.shadowBlur=10; ctx.shadowColor='#ff3333';
        ctx.fillStyle='#ff3333';
        ctx.fillRect(-5, -2, 10, 4);
        ctx.fillStyle='#ff8866';
        ctx.fillRect(-3, -3, 6, 6);
        ctx.restore();
      }
      ctx.restore();
    }

    // Sentry Drone orbitals
    const droneLvl = player.upgrades.SENTRY_DRONE||0;
    if (droneLvl > 0) {
      ctx.save();
      for (let i = 0; i < droneLvl; i++) {
        const a = player.droneAngle + (TWO_PI / droneLvl) * i;
        const dx = player.x * TILE - cam.x + Math.cos(a) * 2.0 * TILE;
        const dy = player.y * TILE - cam.y + Math.sin(a) * 2.0 * TILE;
        ctx.save();
        ctx.translate(dx, dy);
        // Outer glow
        ctx.shadowBlur = 12; ctx.shadowColor = '#00e5ff';
        // Diamond shape
        ctx.fillStyle = '#00e5ff';
        ctx.beginPath();
        ctx.moveTo(0, -5); ctx.lineTo(4, 0); ctx.lineTo(0, 5); ctx.lineTo(-4, 0);
        ctx.closePath(); ctx.fill();
        // Inner bright core
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#aaffff';
        ctx.beginPath();
        ctx.moveTo(0, -2.5); ctx.lineTo(2, 0); ctx.lineTo(0, 2.5); ctx.lineTo(-2, 0);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    drawDangerVignette(player);
    drawHUD(player);
    drawStatusBar(player);
    drawThreatIndicators(cam.x, cam.y);
    drawMinimap(dungeon,player);
    drawBoostStrip(player);
    drawBossBar();

    // UNCHAINED #38: right-edge HUD (difficulty badge / quest / bounty) must
    // clear the active boost strip so pills don't collide with the text.
    const _boostPills = (typeof NEON !== 'undefined' && NEON.boosts)
      ? NEON.boosts.getActiveBoostList(player).length : 0;
    const _boostOffset = _boostPills > 0 ? _boostPills * 21 + 4 : 0; // 18px pill + 3px gap + 4px bottom margin

    // Difficulty badge below minimap (non-NORMAL only)
    if (game.difficulty !== 'NORMAL') {
      const d = getDiff();
      const by = 92 + safeTop + _boostOffset;
      ctx.save(); ctx.textAlign='right';
      ctx.font='bold 9px monospace';
      ctx.shadowBlur=4; ctx.shadowColor=d.colour;
      ctx.fillStyle=d.colour;
      ctx.fillText('['+d.label+']', W-8-safeRight, by);
      ctx.restore();
    }

    // Quest HUD (below minimap)
    if (game.quest) {
      const q = game.quest;
      const qy = 96 + safeTop + _boostOffset + (game.difficulty !== 'NORMAL' ? 10 : 0);
      ctx.save();
      ctx.font='10px monospace'; ctx.textAlign='right';
      if (q.done) {
        ctx.fillStyle='#39ff14'; ctx.fillText('✓ '+q.label, W-8-safeRight, qy);
      } else if (q.failed) {
        ctx.fillStyle='#ff3333'; ctx.fillText('✗ '+q.label, W-8-safeRight, qy);
      } else {
        ctx.shadowBlur=4; ctx.shadowColor='#39ff14';
        ctx.fillStyle='#39ff14'; ctx.fillText('⚡ '+q.label, W-8-safeRight, qy);
        if (q.timer !== undefined) {
          ctx.fillStyle=q.timer<10?'#ff3333':'#aaaacc';
          ctx.fillText(Math.ceil(q.timer)+'s', W-8-safeRight, qy+14);
        }
      }
      ctx.restore();
    }

    // Bounty target HUD indicator (below quest)
    const bountyAlive = enemies.some(e => e._isBounty && !e.dead);
    if (bountyAlive) {
      const by2 = 96 + safeTop + _boostOffset + (game.difficulty !== 'NORMAL' ? 10 : 0) + (game.quest ? 16 : 0);
      ctx.save();
      ctx.font='bold 9px monospace'; ctx.textAlign='right';
      const bPulse = 0.7 + 0.3 * Math.sin(Date.now() / 400);
      ctx.globalAlpha = bPulse;
      ctx.shadowBlur=4; ctx.shadowColor='#ffd700';
      ctx.fillStyle='#ffd700';
      ctx.fillText('⊕ BOUNTY', W-8-safeRight, by2);
      ctx.restore();
    }

    // Challenge wave HUD
    if (game.challengeSealed && !game.challengeComplete) {
      const wy = 96 + safeTop + (game.quest ? 18 : 0);
      ctx.save();
      ctx.font='bold 12px monospace'; ctx.textAlign='right';
      const wPulse = 0.7 + 0.3 * Math.sin(Date.now() / 300);
      ctx.globalAlpha = wPulse;
      ctx.shadowBlur=6; ctx.shadowColor='#ff6633';
      ctx.fillStyle='#ff9933';
      if (game.challengeWaveDelay > 0 && game.challengeWave === 0) {
        ctx.fillText('⚔ CHALLENGE STARTING...', W-8-safeRight, wy);
      } else if (game.challengeWaveDelay > 0) {
        ctx.fillText('⚔ NEXT WAVE IN ' + Math.ceil(game.challengeWaveDelay) + 's', W-8-safeRight, wy);
      } else {
        ctx.fillText('⚔ WAVE ' + game.challengeWave + '/' + game.challengeMaxWaves, W-8-safeRight, wy);
      }
      ctx.restore();
    }

    drawMessages();
    drawModBanner();
    drawBiomeCard();
    drawHint();
    drawTouchUI();
  },

  renderPaused() {
    const isTouch = isTouchDevice();
    const narrow = layout.compact;
    const sel = this._pauseSel ?? -1;
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.55)';
    ctx.fillRect(0,0,W,H);
    ctx.textAlign='center';
    ctx.shadowBlur=20; ctx.shadowColor='#ff00c8';
    ctx.fillStyle='#ff00c8'; ctx.font=`bold ${narrow ? 36 : 48}px monospace`;
    ctx.fillText('PAUSED',W/2, narrow ? 200 : 240);
    ctx.shadowBlur=0;
    const fs = narrow ? 14 : 18;
    const optY = [narrow ? 255 : 295, narrow ? 280 : 320, narrow ? 305 : 345];
    if (isTouch) {
      ctx.fillStyle='#aaaacc'; ctx.font=`${fs}px monospace`;
      ctx.fillText('TAP TOP — Resume',W/2, optY[0] ?? 0);
      ctx.fillText('TAP MIDDLE — Settings',W/2, optY[1] ?? 0);
      ctx.fillText('TAP BOTTOM — Quit to Menu',W/2, optY[2] ?? 0);
    } else {
      const labels = ['ESC — Resume', 'S   — Settings', 'Q   — Quit to Menu'];
      const colours = ['#00f5ff', '#ffb700', '#ff4466'];
      for (let i = 0; i < 3; i++) {
        const hovered = sel === i;
        ctx.fillStyle = hovered ? (colours[i] || '#aaaacc') : '#aaaacc';
        ctx.shadowBlur = hovered ? 10 : 0;
        ctx.shadowColor = colours[i] || '#aaaacc';
        ctx.font = `${hovered ? 'bold ' : ''}${fs}px monospace`;
        ctx.fillText(labels[i] || '', W/2, optY[i] ?? 0);
      }
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  },

  renderPowerupChoice() {
    const pc = this.powerupChoice;
    if (!pc) return;
    const narrow = layout.compact;
    const isTouch = isTouchDevice();
    ctx.save();

    // Dark overlay
    ctx.fillStyle='rgba(0,0,0,0.7)';
    ctx.fillRect(0,0,W,H);

    // Title
    ctx.textAlign='center';
    ctx.shadowBlur=25; ctx.shadowColor='#00f5ff';
    ctx.fillStyle='#00f5ff';
    ctx.font=`bold ${narrow?22:30}px monospace`;
    ctx.fillText('CHOOSE AN UPGRADE', W/2, H*0.15);
    ctx.shadowBlur=0;

    // Cards
    const cw = Math.min(280, W * 0.35);
    const gap = 30;
    const totalW = cw * 2 + gap;
    const startX = (W - totalW) / 2;
    const cardY = H * 0.28;
    const cardH = Math.min(220, H * 0.38);
    // Word-wrap helper (centered). Returns the y of the next line below the
    // wrapped block. text padding leaves 8px on each side of the card.
    const wrapMaxW = cw - 16;
    const cardBottomY = cardY + cardH - 8;
    /**
     * @param {string} text
     * @param {number} cxC center x
     * @param {number} y top y of first line
     * @param {number} lineH
     */
    const drawWrapCentered = (text, cxC, y, lineH) => {
      const words = String(text == null ? '' : text).split(' ');
      let line = '', dy = y;
      const flush = () => {
        if (!line) return;
        if (dy + lineH > cardBottomY) return;
        ctx.fillText(line, cxC, dy);
        dy += lineH;
        line = '';
      };
      for (const w of words) {
        // Hard-break a single word that's wider than wrapMaxW (no spaces).
        if (ctx.measureText(w).width > wrapMaxW) {
          flush();
          let chunk = '';
          for (let k=0; k<w.length; k++) {
            const ch = w[k] || '';
            const test = chunk + ch;
            if (ctx.measureText(test).width > wrapMaxW && chunk) {
              line = chunk; flush();
              chunk = ch;
            } else {
              chunk = test;
            }
          }
          line = chunk;
          continue;
        }
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > wrapMaxW && line) {
          flush();
          line = w;
        } else {
          line = test;
        }
      }
      flush();
      return dy;
    };

    for (let i=0; i<2; i++) {
      const opt = pc.options[i];
      const cx = startX + i * (cw + gap);
      const sel = pc.selected === i;
      const curLvl = opt.persistent && game.player ? (game.player.upgrades[opt.id]||0) : 0;

      // Card background
      ctx.fillStyle = sel ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)';
      ctx.strokeStyle = sel ? opt.colour : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = sel ? 2 : 1;
      NEON.draw.roundRectFillStroke(ctx, cx, cardY, cw, cardH, 8);

      // Glow on selected
      if (sel) {
        ctx.save();
        ctx.shadowBlur=20; ctx.shadowColor=opt.colour;
        ctx.strokeStyle=opt.colour; ctx.lineWidth=2;
        NEON.draw.roundRectStroke(ctx, cx, cardY, cw, cardH, 8);
        ctx.restore();
      }
      // Rarity border glow for affixed weapons
      if (opt._rarity > 0 && !sel) {
        ctx.save();
        ctx.shadowBlur=12; ctx.shadowColor=opt._rarityColour;
        ctx.strokeStyle=opt._rarityColour; ctx.lineWidth=1.5;
        NEON.draw.roundRectStroke(ctx, cx, cardY, cw, cardH, 8);
        ctx.restore();
      }

      // Number badge
      ctx.fillStyle=opt.colour;
      ctx.font=`bold ${narrow?16:20}px monospace`;
      ctx.textAlign='center';
      ctx.fillText((i+1)+'', cx + cw/2, cardY + 28);

      // Icon: colored square with glow
      ctx.save();
      ctx.shadowBlur=15; ctx.shadowColor=opt.colour;
      ctx.fillStyle=opt.colour;
      ctx.fillRect(cx + cw/2 - 12, cardY + 40, 24, 24);
      ctx.restore();

      // Name
      ctx.fillStyle='#ffffff';
      ctx.font=`bold ${narrow?13:16}px monospace`;
      ctx.fillText(opt.name, cx + cw/2, cardY + 90);

      // Description (word-wrapped). Track running y so subsequent lines
      // don't collide when the desc spans 2+ lines on narrow viewports.
      ctx.fillStyle='#aaaacc';
      const descFs = narrow ? 11 : 13;
      ctx.font=`${descFs}px monospace`;
      let runY = drawWrapCentered(opt.desc, cx + cw/2, cardY + 112, descFs + 3);
      runY += 4; // small gutter

      // Level info for persistent upgrades
      if (opt.persistent && opt.levelDesc) {
        ctx.fillStyle='#888899';
        const lvFs = narrow ? 10 : 12;
        ctx.font=`${lvFs}px monospace`;
        runY = drawWrapCentered('Lv '+(curLvl)+'→'+(curLvl+1)+': '+opt.levelDesc(curLvl), cx + cw/2, runY, lvFs + 3);
        runY += 4;
      }

      // Hackware badge
      if (opt.isHackware) {
        ctx.fillStyle=opt.colour;
        ctx.font=`bold ${narrow?9:10}px monospace`;
        ctx.fillText('⚙ HACKWARE [F]', cx + cw/2, runY);
        runY += (narrow ? 12 : 13);
      }

      // Weapon stats line for weapon options
      if (opt.id && opt.id.startsWith('WEAPON_')) {
        ctx.fillStyle='#ffcc44';
        const wFs = narrow ? 10 : 12;
        ctx.font=`${wFs}px monospace`;
        runY = drawWrapCentered(opt.desc, cx + cw/2, runY, wFs + 3);
        // Affix description line
        if (opt.affixDesc) {
          ctx.fillStyle=opt._rarityColour || '#39ff14';
          const aFs = narrow ? 9 : 11;
          ctx.font=`${aFs}px monospace`;
          runY = drawWrapCentered(opt.affixDesc, cx + cw/2, runY, aFs + 3);
        }
        // Rarity label
        if (opt._rarity > 0) {
          ctx.fillStyle=opt._rarityColour;
          ctx.font=`bold ${narrow?9:10}px monospace`;
          ctx.fillText(RARITY_LABELS[opt._rarity] || '', cx + cw/2, runY);
        }
      }
    }

    // Skip button
    const skipY = cardY + cardH + 25;
    const skipW = 160, skipH = 40;
    ctx.fillStyle='rgba(255,255,255,0.04)';
    ctx.strokeStyle='rgba(255,255,255,0.2)';
    ctx.lineWidth=1;
    NEON.draw.roundRectFillStroke(ctx, (W-skipW)/2, skipY, skipW, skipH, 6);

    ctx.fillStyle='#666688';
    ctx.font=`${narrow?13:15}px monospace`;
    ctx.textAlign='center';
    ctx.fillText('SKIP  [3]', W/2, skipY + 26);

    // Hint
    ctx.fillStyle='#444466';
    ctx.font=`${narrow?9:11}px monospace`;
    if (isTouch) {
      ctx.fillText('Tap a card or Skip', W/2, skipY + skipH + 22);
    } else {
      ctx.fillText('1/2 pick  ·  ←/→ + Enter  ·  3/Esc skip', W/2, skipY + skipH + 22);
    }

    ctx.restore();
  },

  renderPerkChoice() {
    const pc = this.perkChoice;
    if (!pc) return;
    const narrow = layout.compact;
    const count = pc.options.length;
    ctx.save();

    // Dark overlay
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.textAlign = 'center';
    ctx.shadowBlur = 25; ctx.shadowColor = '#00f5ff';
    ctx.fillStyle = '#00f5ff';
    ctx.font = `bold ${narrow ? 20 : 28}px monospace`;
    ctx.fillText('CHOOSE A PERK', W / 2, H * 0.1);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.fillStyle = '#668899';
    ctx.font = `${narrow ? 11 : 14}px monospace`;
    ctx.fillText(`Level ${this.player.level} — pick one ability`, W / 2, H * 0.1 + (narrow ? 22 : 30));

    // Cards
    const cw = narrow ? Math.min(160, (W - 20) / count - 8) : Math.min(220, (W - 40) / count - 12);
    const gap = narrow ? 8 : 14;
    const totalW = cw * count + gap * (count - 1);
    const startX = (W - totalW) / 2;
    const cardY = H * 0.22;
    const cardH = narrow ? Math.min(240, H * 0.52) : Math.min(280, H * 0.48);

    for (let i = 0; i < count; i++) {
      const id = pc.options[i];
      const perk = PERK_POOL[id];
      const cx = startX + i * (cw + gap);
      const sel = pc.selected === i;

      // Card bg
      ctx.fillStyle = sel ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)';
      ctx.strokeStyle = sel ? perk.colour : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = sel ? 2 : 1;
      NEON.draw.roundRectFillStroke(ctx, cx, cardY, cw, cardH, 8);

      // Glow on selected
      if (sel) {
        ctx.save();
        ctx.shadowBlur = 20; ctx.shadowColor = perk.colour;
        ctx.strokeStyle = perk.colour; ctx.lineWidth = 2;
        NEON.draw.roundRectStroke(ctx, cx, cardY, cw, cardH, 8);
        ctx.restore();
      }

      // Number badge
      ctx.fillStyle = sel ? perk.colour : '#555566';
      ctx.font = `bold ${narrow ? 12 : 16}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), cx + cw / 2, cardY + (narrow ? 18 : 24));

      // Icon
      ctx.fillStyle = perk.colour;
      ctx.font = `${narrow ? 28 : 40}px monospace`;
      ctx.fillText(perk.icon, cx + cw / 2, cardY + cardH * 0.32);

      // Name
      ctx.fillStyle = sel ? '#ffffff' : '#cccccc';
      ctx.font = `bold ${narrow ? 12 : 15}px monospace`;
      ctx.fillText(perk.name, cx + cw / 2, cardY + cardH * 0.52);

      // Description — word-wrap
      ctx.fillStyle = sel ? '#aabbcc' : '#667788';
      ctx.font = `${narrow ? 10 : 12}px monospace`;
      const words = perk.desc.split(' ');
      const maxW = cw - 16;
      let line = '', ly = cardY + cardH * 0.62;
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxW) {
          ctx.fillText(line, cx + cw / 2, ly);
          ly += narrow ? 13 : 15;
          line = w;
        } else { line = test; }
      }
      if (line) ctx.fillText(line, cx + cw / 2, ly);
    }

    // Instructions
    ctx.fillStyle = '#445566';
    ctx.font = `${narrow ? 10 : 13}px monospace`;
    ctx.textAlign = 'center';
    if (isTouchDevice()) {
      ctx.fillText('Tap a card to choose', W / 2, cardY + cardH + (narrow ? 18 : 28));
    } else {
      ctx.fillText('1/2/3 pick  ·  ←/→ + Enter', W / 2, cardY + cardH + (narrow ? 18 : 28));
    }

    ctx.restore();
  },

  renderShopping() {
    const room = this.shopRoom;
    if (!room || !room.shopItems) return;
    const items = room.shopItems;
    const narrow = layout.compact;
    const isTouch = isTouchDevice();
    const p = this.player;
    ctx.save();

    // Dark overlay
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.textAlign = 'center';
    ctx.shadowBlur = 25; ctx.shadowColor = '#39ff14';
    ctx.fillStyle = '#39ff14';
    ctx.font = `bold ${narrow ? 20 : 28}px monospace`;
    ctx.fillText('VENDOR TERMINAL', W / 2, H * 0.1);
    ctx.shadowBlur = 0;

    // Credits display
    ctx.fillStyle = '#ffcc00';
    ctx.font = `bold ${narrow ? 14 : 18}px monospace`;
    ctx.fillText('◈ ' + p.credits + ' CREDITS', W / 2, H * 0.17);

    // Cards
    const cw = Math.min(200, W * 0.28);
    const gap = 16;
    const totalW = cw * 3 + gap * 2;
    const startX = (W - totalW) / 2;
    const cardY = H * 0.22;
    const cardH = Math.min(200, H * 0.38);

    for (let i = 0; i < 3; i++) {
      const item = items[i];
      const cx = startX + i * (cw + gap);
      const sel = this.shopSelected === i;
      const affordable = p.credits >= item.price;
      const curLvl = item.persistent && p ? (p.upgrades[item.id] || 0) : 0;

      if (item.sold) {
        // Sold-out card
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        NEON.draw.roundRectFillStroke(ctx, cx, cardY, cw, cardH, 8);
        ctx.fillStyle = '#333344';
        ctx.font = `bold ${narrow ? 14 : 18}px monospace`;
        ctx.fillText('SOLD', cx + cw / 2, cardY + cardH / 2 + 6);
        continue;
      }

      // Card background
      ctx.fillStyle = sel ? 'rgba(57,255,20,0.06)' : 'rgba(255,255,255,0.03)';
      ctx.strokeStyle = sel ? item.colour : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = sel ? 2 : 1;
      NEON.draw.roundRectFillStroke(ctx, cx, cardY, cw, cardH, 8);

      if (sel) {
        ctx.save();
        ctx.shadowBlur = 16; ctx.shadowColor = item.colour;
        ctx.strokeStyle = item.colour; ctx.lineWidth = 2;
        NEON.draw.roundRectStroke(ctx, cx, cardY, cw, cardH, 8);
        ctx.restore();
      }

      // Number badge
      ctx.fillStyle = item.colour;
      ctx.font = `bold ${narrow ? 14 : 18}px monospace`;
      ctx.fillText((i + 1) + '', cx + cw / 2, cardY + 22);

      // Icon
      ctx.save();
      ctx.shadowBlur = 12; ctx.shadowColor = item.colour;
      ctx.fillStyle = item.colour;
      ctx.fillRect(cx + cw / 2 - 10, cardY + 32, 20, 20);
      ctx.restore();

      // Name
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${narrow ? 11 : 14}px monospace`;
      ctx.fillText(item.name, cx + cw / 2, cardY + 74);

      // Description
      ctx.fillStyle = '#aaaacc';
      ctx.font = `${narrow ? 11 : 11}px monospace`;
      ctx.fillText(item.desc, cx + cw / 2, cardY + 92);

      // Level info for persistent upgrades
      if (item.persistent && item.levelDesc) {
        ctx.fillStyle = '#888899';
        ctx.font = `${narrow ? 11 : 11}px monospace`;
        ctx.fillText('Lv ' + curLvl + '→' + (curLvl + 1) + ': ' + item.levelDesc(curLvl), cx + cw / 2, cardY + 108);
      }

      // Hackware badge
      if (item.isHackware) {
        ctx.fillStyle = item.colour;
        ctx.font = `bold ${narrow ? 8 : 10}px monospace`;
        ctx.fillText('⚙ HACKWARE [F]', cx + cw / 2, cardY + 108);
      }

      // Price
      const priceCol = affordable ? '#ffcc00' : '#ff3333';
      ctx.fillStyle = priceCol;
      ctx.font = `bold ${narrow ? 12 : 15}px monospace`;
      ctx.fillText('◈ ' + item.price, cx + cw / 2, cardY + cardH - 18);

      if (!affordable) {
        ctx.fillStyle = '#ff3333';
        ctx.font = `${narrow ? 8 : 10}px monospace`;
        ctx.fillText('NOT ENOUGH', cx + cw / 2, cardY + cardH - 6);
      }
    }

    // Leave button
    const leaveY = cardY + cardH + 20;
    const leaveW = 160, leaveH = 40;
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    NEON.draw.roundRectFillStroke(ctx, (W - leaveW) / 2, leaveY, leaveW, leaveH, 6);

    ctx.fillStyle = '#666688';
    ctx.font = `${narrow ? 13 : 15}px monospace`;
    ctx.fillText('LEAVE  [Esc]', W / 2, leaveY + 26);

    // Hint
    ctx.fillStyle = '#444466';
    ctx.font = `${narrow ? 11 : 11}px monospace`;
    if (isTouch) {
      ctx.fillText('Tap to buy · Tap Leave to exit', W / 2, leaveY + leaveH + 18);
    } else {
      ctx.fillText('1/2/3 buy  ·  ←/→ + Enter  ·  Esc leave', W / 2, leaveY + leaveH + 18);
    }

    ctx.restore();
  },

  renderReading() {
    if (!this.currentLore) return;
    const isWhisper = !!this._whisperMeta;
    const accent = isWhisper ? '#cc99ee' : '#ffb700';
    const bgFill = isWhisper ? 'rgba(20,12,32,0.95)' : 'rgba(26,18,8,0.95)';
    const scanFill = isWhisper ? 'rgba(204,153,238,0.04)' : 'rgba(255,183,0,0.03)';
    const titleText = isWhisper
      ? '⌬ WHISPER FRAGMENT'
      : '◫ DATA TERMINAL';
    const bodyColour = isWhisper ? '#e8d5ff' : '#ddc888';
    const subtleColour = isWhisper ? '#7755aa' : '#886622';
    const narrow = layout.compact;
    const isTouch = isTouchDevice();
    ctx.save();

    // Dark overlay
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.fillRect(0, 0, W, H);

    // Terminal frame
    const fw = Math.min(620, W - 40);
    const fh = Math.min(340, H - 60);
    const fx = (W - fw) / 2;
    const fy = (H - fh) / 2 - 10;

    // Outer glow border
    ctx.save();
    ctx.shadowBlur = 20; ctx.shadowColor = accent;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    NEON.draw.roundRectStroke(ctx, fx, fy, fw, fh, 8);
    ctx.restore();

    // Inner background
    ctx.fillStyle = bgFill;
    NEON.draw.roundRect(ctx, fx, fy, fw, fh, 8);

    // Scanline effect
    ctx.fillStyle = scanFill;
    for (let sy = fy; sy < fy + fh; sy += 3) {
      ctx.fillRect(fx, sy, fw, 1);
    }

    // Title
    ctx.textAlign = 'center';
    ctx.shadowBlur = 12; ctx.shadowColor = accent;
    ctx.fillStyle = accent;
    ctx.font = `bold ${narrow ? 16 : 22}px monospace`;
    ctx.fillText(titleText, W / 2, fy + (narrow ? 28 : 36));
    ctx.shadowBlur = 0;

    // Subtitle: lore count for terminals, voice attribution for whispers
    ctx.fillStyle = subtleColour;
    ctx.font = `${narrow ? 11 : 11}px monospace`;
    if (isWhisper) {
      const meta = this._whisperMeta || {};
      const sub = (meta.title ? meta.title + '   ·   ' : '') +
                  (meta.voice || 'unknown');
      ctx.fillText(sub, W / 2, fy + (narrow ? 44 : 56));
    } else {
      const count = this.player ? this.player.loreRead.size : 0;
      ctx.fillText('ENTRIES RECOVERED: ' + count, W / 2, fy + (narrow ? 44 : 56));
    }

    // Word-wrapped body text
    ctx.fillStyle = bodyColour;
    const fontSize = narrow ? 11 : 14;
    ctx.font = `${fontSize}px monospace`;
    const maxTextW = fw - 40;
    const lineH = fontSize + 4;
    const textStartY = fy + (narrow ? 62 : 78);

    const words = this.currentLore.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxTextW) {
        if (line) lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);

    ctx.textAlign = 'left';
    const textX = fx + 20;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i] || '', textX, textStartY + i * lineH);
    }

    // Close hint
    ctx.textAlign = 'center';
    ctx.fillStyle = isWhisper ? '#7755aa' : '#887744';
    ctx.font = `${narrow ? 10 : 12}px monospace`;
    const closeText = isTouch
      ? 'TAP TO CLOSE'
      : 'PRESS ' + KEY_DISPLAY(km('interact')) + ' / ENTER / ESC TO CLOSE';
    const pulseAlpha = 0.5 + 0.3 * Math.sin(performance.now() / 500);
    ctx.globalAlpha = pulseAlpha;
    ctx.fillText(closeText, W / 2, fy + fh - (narrow ? 10 : 14));
    ctx.globalAlpha = 1;

    ctx.restore();
  },

  renderFade() {
    const t=this.fadeTime;
    const a=this.fadeAlpha;
    ctx.save();

    // ── Base dark overlay ────────────────────────────────────────────────
    ctx.globalAlpha=a;
    ctx.fillStyle='#0a0a12';
    ctx.fillRect(0,0,W,H);

    // ── Scrolling scanlines ──────────────────────────────────────────────
    const scanAlpha=Math.min(a*1.5, 0.3);
    if (scanAlpha>0.01) {
      ctx.globalAlpha=scanAlpha;
      ctx.fillStyle='#000000';
      const scanSpeed=120;
      const offset=(t*scanSpeed)%6;
      for (let y=offset;y<H;y+=6) {
        ctx.fillRect(0,y,W,2);
      }
    }

    // ── Glitch bars ─────────────────────────────────────────────────────
    if (a>0.25) {
      for (const bar of this.fadeGlitchBars) {
        ctx.globalAlpha=bar.alpha*Math.min(1,(a-0.25)*3);
        ctx.fillStyle=bar.color;
        ctx.fillRect(bar.x,bar.y,bar.w,bar.h);
      }
    }

    // ── Coarse noise band (sweeps vertically) ────────────────────────────
    if (a>0.3) {
      const bandH=30+Math.sin(t*4)*15;
      const bandY=((t*200)%( H+bandH*2))-bandH;
      const cellSize=6;
      ctx.globalAlpha=0.15*Math.min(1,(a-0.3)*3);
      for (let x=0;x<W;x+=cellSize) {
        for (let y=bandY;y<bandY+bandH;y+=cellSize) {
          if (y<0||y>H) continue;
          const r=Math.random();
          ctx.fillStyle=r>0.6?'#ff00c8':r>0.3?'#00f5ff':'#39ff14';
          ctx.fillRect(x,y,cellSize-1,cellSize-1);
        }
      }
    }

    // ── Horizontal sweep line ────────────────────────────────────────────
    if (a>0.2) {
      const sweepY=((t*350)%(H+4))-2;
      ctx.globalAlpha=0.6*Math.min(1,(a-0.2)*3);
      const grad=ctx.createLinearGradient(0,sweepY-2,0,sweepY+2);
      grad.addColorStop(0,'transparent');
      grad.addColorStop(0.5,'#00f5ff');
      grad.addColorStop(1,'transparent');
      ctx.fillStyle=grad;
      ctx.fillRect(0,sweepY-2,W,4);
    }

    // ── Transition text with chromatic aberration ────────────────────────
    if (a>0.5 && this.transitionText) {
      const textAlpha=Math.min(1,(a-0.5)*4);
      const txt=this.transitionText;
      // Chunk reveal: show characters based on time at peak
      const peakTime=this.fadeDir===2?this.fadeHold:(this.fadeDir===-1?0.15:0);
      const revealTime=Math.max(0,t-0.2); // time since text became visible (fadeAlpha crosses 0.5)
      const charsToShow=Math.min(txt.length, Math.floor(revealTime*80));
      const shown=charsToShow>=txt.length?txt:txt.substring(0,charsToShow);

      ctx.textAlign='center';
      ctx.font='bold 28px monospace';

      // Red offset (chromatic aberration)
      const abOffset=Math.max(0, 2-peakTime*15);
      if (abOffset>0.3) {
        ctx.globalAlpha=textAlpha*0.4;
        ctx.fillStyle='#ff0040';
        ctx.shadowBlur=0;
        ctx.fillText(shown,W/2-abOffset,H/2);
      }

      // Blue offset
      if (abOffset>0.3) {
        ctx.globalAlpha=textAlpha*0.4;
        ctx.fillStyle='#0080ff';
        ctx.fillText(shown,W/2+abOffset,H/2);
      }

      // Main text with glow
      ctx.globalAlpha=textAlpha;
      ctx.shadowBlur=20; ctx.shadowColor='#00f5ff';
      ctx.fillStyle='#00f5ff';
      ctx.fillText(shown,W/2,H/2);
      ctx.shadowBlur=0;

      // Blinking cursor during reveal
      if (charsToShow<txt.length && Math.sin(t*12)>0) {
        const metrics=ctx.measureText(shown);
        ctx.fillStyle='#00f5ff';
        ctx.fillRect(W/2+metrics.width/2+4, H/2-14, 2, 20);
      }
    }

    // ── Edge vignette (neon border flash) ────────────────────────────────
    if (a>0.6) {
      const edgeAlpha=0.3*Math.min(1,(a-0.6)*4)*(0.7+0.3*Math.sin(t*8));
      ctx.globalAlpha=edgeAlpha;
      ctx.strokeStyle='#ff00c8';
      ctx.lineWidth=2;
      ctx.shadowBlur=15; ctx.shadowColor='#ff00c8';
      ctx.strokeRect(4,4,W-8,H-8);
      ctx.shadowBlur=0;
    }

    ctx.restore();
  },

  renderArchives() {
    const narrow = layout.compact;
    const isTouch = isTouchDevice();
    const meta = loadMeta();
    const sel = this.archivesSel || 0;

    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.95)'; ctx.fillRect(0,0,W,H);

    // grid lines
    ctx.globalAlpha=0.03; ctx.strokeStyle='#ffb700';
    for (let x=0;x<W;x+=40){NEON.draw.line(ctx,x,0,x,H);}
    for (let y=0;y<H;y+=40){NEON.draw.line(ctx,0,y,W,y);}
    ctx.globalAlpha=1;

    // Title
    ctx.textAlign='center';
    ctx.shadowBlur=20; ctx.shadowColor='#ffb700';
    ctx.fillStyle='#ffb700'; ctx.font=`bold ${narrow?24:32}px monospace`;
    ctx.fillText('NEURAL ARCHIVES',W/2, narrow?40:55);
    ctx.shadowBlur=0;

    // Shard balance
    ctx.fillStyle='#aaaacc'; ctx.font=`${narrow?13:16}px monospace`;
    ctx.fillText(`◆ ${meta.shards} Data Fragments available`, W/2, narrow?65:85);

    // Upgrades list
    const startY = narrow ? 95 : 120;
    const rowH = narrow ? 42 : 50;
    const fs = narrow ? 12 : 14;
    const iconFs = narrow ? 16 : 20;

    for (let i = 0; i < META_UPGRADES.length; i++) {
      const u = META_UPGRADES[i];
      const curLv = meta.upgrades[u.id] || 0;
      const maxed = curLv >= u.maxLv;
      const cost = maxed ? null : u.costs[curLv];
      const canAfford = !maxed && meta.shards >= cost;
      const selected = i === sel;
      const y = startY + i * rowH;

      // Selection highlight
      if (selected) {
        ctx.fillStyle='rgba(255,183,0,0.08)';
        ctx.fillRect(W*0.08, y - rowH/2 + 4, W*0.84, rowH - 4);
      }

      // Icon
      const iconCol = maxed ? '#39ff14' : selected ? '#ffb700' : '#777799';
      ctx.textAlign='left';
      ctx.fillStyle=iconCol; ctx.font=`${iconFs}px monospace`;
      ctx.fillText(u.icon, W*0.1, y + 2);

      // Name
      ctx.fillStyle = selected ? '#ffffff' : '#aaaacc';
      ctx.font=`${selected?'bold ':''}${fs}px monospace`;
      ctx.fillText(u.name, W*0.18, y - 4);

      // Description
      ctx.fillStyle='#777799'; ctx.font=`${narrow?10:12}px monospace`;
      ctx.fillText(u.desc, W*0.18, y + (narrow?12:14));

      // Level pips
      ctx.textAlign='right';
      let lvText = '';
      for (let l = 0; l < u.maxLv; l++) lvText += l < curLv ? '●' : '○';
      ctx.fillStyle = maxed ? '#39ff14' : '#aaaacc';
      ctx.font=`${fs}px monospace`;
      ctx.fillText(lvText, W*0.72, y);

      // Cost / Status
      if (maxed) {
        ctx.fillStyle='#39ff14'; ctx.font=`${fs}px monospace`;
        ctx.fillText('MAXED', W*0.9, y);
      } else {
        ctx.fillStyle = canAfford ? '#ffb700' : '#ff3333';
        ctx.font=`${selected?'bold ':''}${fs}px monospace`;
        ctx.fillText(`◆${cost}`, W*0.9, y);
      }
    }

    // Stats footer
    ctx.textAlign='center';
    ctx.fillStyle='#555577'; ctx.font=`${narrow?9:11}px monospace`;
    const statsY = startY + META_UPGRADES.length * rowH + (narrow?15:20);
    ctx.fillText(`Runs: ${meta.stats.totalRuns}  |  Best Floor: ${meta.stats.bestFloor}  |  Victories: ${meta.stats.victories}  |  Total ◆: ${meta.stats.totalShards}`, W/2, statsY);

    // Back hint
    ctx.fillStyle='#444466'; ctx.font=`${narrow?10:12}px monospace`;
    ctx.fillText(isTouch ? 'Tap upgrade to buy  |  ← Back' : 'Enter: Buy  |  ESC: Back', W/2, H - (narrow?20:30));
    ctx.restore();
  },

  renderGameOver() {
    const isTouch = isTouchDevice();
    const narrow = layout.compact;
    const r = this.lastRunRecap || {};
    const fs1 = narrow ? 14 : 16;
    const lh = narrow ? 20 : 24;
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.92)'; ctx.fillRect(0,0,W,H);
    ctx.textAlign='center';
    // Title
    ctx.shadowBlur=30; ctx.shadowColor='#ff3333';
    ctx.fillStyle='#ff3333'; ctx.font=`bold ${narrow ? 36 : 56}px monospace`;
    ctx.fillText('GAME OVER',W/2, narrow ? 50 : 68);
    ctx.shadowBlur=0;
    // Killed by
    const killer = r.killedBy || 'Unknown';
    const killerLabel = sourceLabel(killer);
    const killerCol = sourceColour(killer);
    ctx.fillStyle=killerCol; ctx.font=`bold ${narrow ? 16 : 22}px monospace`;
    ctx.shadowBlur=12; ctx.shadowColor=killerCol;
    ctx.fillText(`KILLED BY: ${killerLabel.toUpperCase()}`, W/2, narrow ? 78 : 100);
    ctx.shadowBlur=0;
    // Stats line
    let y = narrow ? 100 : 128;
    ctx.fillStyle='#666688'; ctx.font=`${narrow ? 10 : 12}px monospace`;
    ctx.fillText('─'.repeat(narrow ? 30 : 40), W/2, y); y += narrow ? 14 : 18;
    ctx.fillStyle='#aaaacc'; ctx.font=`${fs1}px monospace`;
    const statsLine = `Floor ${r.floor||this.floor}  •  Score ${r.score||this.player.score}  •  Lv ${r.level||this.player.level}`;
    ctx.fillText(statsLine, W/2, y); y += lh;
    if ((r.bestCombo||combo.best) >= 2) {
      ctx.fillStyle=comboColour();
      ctx.fillText(`Best Combo: ×${r.bestCombo||combo.best}`, W/2, y);
      ctx.fillStyle='#aaaacc'; y += lh;
    }
    if (this.difficulty !== 'NORMAL') {
      const d = getDiff();
      ctx.fillStyle=d.colour;
      ctx.fillText(`Difficulty: ${d.label}`, W/2, y);
      ctx.fillStyle='#aaaacc'; y += lh;
    }
    // Damage breakdown
    const log = r.damageLog || {};
    const entries = Object.entries(log).sort((a,b)=>b[1]-a[1]);
    const totalDmg = entries.reduce((s,e)=>s+e[1], 0);
    if (entries.length > 0 && totalDmg > 0) {
      y += narrow ? 4 : 6;
      ctx.fillStyle='#666688'; ctx.font=`${narrow ? 10 : 12}px monospace`;
      ctx.fillText('─'.repeat(narrow ? 30 : 40), W/2, y); y += narrow ? 14 : 18;
      ctx.fillStyle='#ff6666'; ctx.font=`bold ${narrow ? 12 : 14}px monospace`;
      ctx.fillText('DAMAGE TAKEN', W/2, y); y += narrow ? 16 : 20;
      const maxBars = narrow ? 3 : 4;
      const barW = narrow ? 140 : 200;
      const barH = narrow ? 10 : 12;
      ctx.textAlign='left';
      for (let i = 0; i < Math.min(maxBars, entries.length); i++) {
        const entry = entries[i];
        if (!entry) continue;
        const [src, dmg] = entry;
        const pct = dmg / totalDmg;
        const col = sourceColour(src);
        const bx = W/2 - barW/2 - (narrow ? 10 : 20);
        // Bar background
        ctx.fillStyle='#1a1a2e'; ctx.fillRect(bx, y - barH + 2, barW, barH);
        // Bar fill
        ctx.fillStyle=col; ctx.globalAlpha=0.7;
        ctx.fillRect(bx, y - barH + 2, barW * pct, barH);
        ctx.globalAlpha=1;
        // Label
        ctx.fillStyle='#ffffff'; ctx.font=`${narrow ? 10 : 12}px monospace`;
        ctx.fillText(sourceLabel(src), bx + 4, y);
        // Value
        ctx.textAlign='right';
        ctx.fillText(`${Math.round(dmg)} (${Math.round(pct*100)}%)`, bx + barW - 2, y);
        ctx.textAlign='left';
        y += narrow ? 16 : 20;
      }
      if (entries.length > maxBars) {
        const rest = entries.slice(maxBars).reduce((s,e)=>s+e[1], 0);
        ctx.fillStyle='#666688'; ctx.font=`${narrow ? 10 : 12}px monospace`;
        const bx = W/2 - barW/2 - (narrow ? 10 : 20);
        ctx.fillText(`+${entries.length - maxBars} more (${Math.round(rest)})`, bx + 4, y);
        y += narrow ? 14 : 16;
      }
      ctx.textAlign='center';
    }
    // Run stats line
    y += narrow ? 4 : 6;
    ctx.fillStyle='#666688'; ctx.font=`${narrow ? 10 : 12}px monospace`;
    ctx.fillText('─'.repeat(narrow ? 30 : 40), W/2, y); y += narrow ? 14 : 18;
    ctx.fillStyle='#888899'; ctx.font=`${narrow ? 11 : 13}px monospace`;
    const mins = Math.floor((r.runTime||0)/60);
    const secs = Math.floor((r.runTime||0)%60);
    const timeStr = `${mins}:${String(secs).padStart(2,'0')}`;
    let runLine = `${r.enemiesKilled||0} slain`;
    if (r.roomsCleared) runLine += `  •  ${r.roomsCleared} cleared`;
    if (r.eventsResolved) runLine += `  •  ${r.eventsResolved} events`;
    if (r.bountiesCollected) runLine += `  •  ${r.bountiesCollected} bounties`;
    if (r.hitsBlocked) runLine += `  •  ${r.hitsBlocked} blocked`;
    runLine += `  •  ${timeStr} survived`;
    ctx.fillText(runLine, W/2, y); y += lh;
    // Data fragments
    if (this.lastRunShards) {
      ctx.fillStyle='#ffb700'; ctx.font=`${narrow ? 14 : 16}px monospace`;
      ctx.fillText(`◆ +${this.lastRunShards} Data Fragments`, W/2, y); y += lh;
    }
    ctx.restore();
    // Leaderboard
    const lbRows = narrow ? 4 : 5;
    this.renderLeaderboard(y + (narrow?6:10), lbRows, this.lastSavedRank);
    // Continue prompt
    if (Math.floor(Date.now()/800)%2===0) {
      ctx.save(); ctx.textAlign='center';
      ctx.fillStyle='#ff00c8'; ctx.font=`${narrow ? 13 : 16}px monospace`;
      ctx.fillText(isTouch ? 'TAP TO CONTINUE' : 'PRESS ENTER TO CONTINUE', W/2, H - (narrow?20:30));
      ctx.restore();
    }
  },

  renderVictory() {
    const isTouch = isTouchDevice();
    const narrow = layout.compact;
    const r = this.lastRunRecap || {};
    ctx.save();
    ctx.fillStyle='rgba(0,0,10,0.95)'; ctx.fillRect(0,0,W,H);
    ctx.textAlign='center';
    const t=Date.now()/1000;
    ctx.shadowBlur=30; ctx.shadowColor='#00f5ff';
    ctx.fillStyle='#00f5ff'; ctx.font=`bold ${narrow ? 22 : 32}px monospace`;
    ctx.fillText('NEURAL NETWORK SEVERED',W/2, narrow ? 50 : 70);
    ctx.shadowColor='#ff00c8'; ctx.fillStyle='#ff00c8';
    ctx.font=`bold ${narrow ? 32 : 48}px monospace`;
    ctx.fillText('MISSION COMPLETE',W/2, narrow ? 90 : 115);
    ctx.shadowBlur=0; ctx.fillStyle='#aaaacc'; ctx.font=`${narrow ? 14 : 16}px monospace`;
    let y = narrow ? 115 : 148;
    ctx.fillText(`Final Score: ${r.score||this.player.score}`,W/2, y); y += narrow ? 22 : 26;
    const _clearedFloors = (typeof NEON !== 'undefined' && NEON.biomes && NEON.biomes.finalFloor) ? NEON.biomes.finalFloor() : 15;
    ctx.fillText(`Floors Cleared: ${_clearedFloors}`,W/2, y); y += narrow ? 22 : 26;
    ctx.fillText(`Level Achieved: ${r.level||this.player.level}`,W/2, y); y += narrow ? 22 : 26;
    if ((r.bestCombo||combo.best) >= 2) {
      ctx.fillStyle=comboColour(); ctx.fillText(`Best Combo: ×${r.bestCombo||combo.best}`,W/2, y);
      ctx.fillStyle='#aaaacc'; y += narrow ? 22 : 26;
    }
    if (this.difficulty !== 'NORMAL') {
      const d = getDiff();
      ctx.fillStyle=d.colour;
      ctx.fillText(`Difficulty: ${d.label}`,W/2, y);
      ctx.fillStyle='#aaaacc'; y += narrow ? 22 : 26;
    }
    // Perks chosen this run
    const ownedPerks = Object.keys(this.player.perks).filter(id => PERK_POOL[id]);
    if (ownedPerks.length) {
      ctx.font = `${narrow ? 10 : 12}px monospace`;
      ctx.fillStyle = '#668899';
      const perkNames = ownedPerks.map(id => PERK_POOL[id].icon + ' ' + PERK_POOL[id].name).join('  ');
      ctx.fillText(perkNames, W/2, y); y += narrow ? 16 : 20;
    }
    // Augments installed this run
    const ownedAugs = Object.keys(this.player.augments || {}).filter(id => AUGMENTS[id]);
    if (ownedAugs.length) {
      ctx.font = `${narrow ? 10 : 12}px monospace`;
      ctx.fillStyle = '#9966cc';
      const augNames = ownedAugs.map(id => AUGMENTS[id].icon + ' ' + AUGMENTS[id].name).join('  ');
      ctx.fillText(augNames, W/2, y); y += narrow ? 16 : 20;
    }
    // Run stats
    y += narrow ? 2 : 4;
    ctx.fillStyle='#666688'; ctx.font=`${narrow ? 10 : 12}px monospace`;
    ctx.fillText('─'.repeat(narrow ? 30 : 40), W/2, y); y += narrow ? 14 : 18;
    ctx.fillStyle='#888899'; ctx.font=`${narrow ? 11 : 13}px monospace`;
    const mins = Math.floor((r.runTime||0)/60);
    const secs = Math.floor((r.runTime||0)%60);
    const timeStr = `${mins}:${String(secs).padStart(2,'0')}`;
    let runLine = `${r.enemiesKilled||0} slain`;
    if (r.roomsCleared) runLine += `  •  ${r.roomsCleared} cleared`;
    if (r.eventsResolved) runLine += `  •  ${r.eventsResolved} events`;
    if (r.bountiesCollected) runLine += `  •  ${r.bountiesCollected} bounties`;
    if (r.hitsBlocked) runLine += `  •  ${r.hitsBlocked} blocked`;
    runLine += `  •  ${timeStr} survived`;
    ctx.fillText(runLine, W/2, y); y += narrow ? 20 : 24;
    // Data fragments
    if (this.lastRunShards) {
      ctx.fillStyle='#ffb700'; ctx.font=`${narrow ? 14 : 16}px monospace`;
      ctx.fillText(`◆ +${this.lastRunShards} Data Fragments`, W/2, y); y += narrow ? 22 : 26;
    }
    // Newly unlocked difficulty celebration
    if (this._newlyUnlocked) {
      const unlockCol = DIFFICULTIES[this._newlyUnlocked]?.colour || '#ff00c8';
      const pulse = 0.7 + 0.3 * Math.sin(t * 4);
      ctx.globalAlpha = pulse;
      ctx.shadowBlur = 20; ctx.shadowColor = unlockCol;
      ctx.fillStyle = unlockCol; ctx.font = `bold ${narrow ? 14 : 18}px monospace`;
      ctx.fillText(`★ ${this._newlyUnlocked} UNLOCKED ★`, W/2, y);
      ctx.shadowBlur = 0; ctx.globalAlpha = 1; y += narrow ? 22 : 26;
    }
    ctx.restore();
    // leaderboard
    const lbRows = narrow ? 4 : 5;
    this.renderLeaderboard(y + (narrow?6:10), lbRows, this.lastSavedRank);
    // continue prompt
    if (Math.floor(t*2)%2===0) {
      ctx.save(); ctx.textAlign='center';
      ctx.fillStyle='#ffb700'; ctx.font=`${narrow ? 13 : 16}px monospace`;
      ctx.fillText(isTouch ? 'TAP FOR MENU' : 'PRESS ENTER FOR MENU', W/2, H - (narrow?20:30));
      ctx.restore();
    }
  }
};

// ─── Performance HUD ──────────────────────────────────────────────────────────
// Toggle with F3. Measures frame/update/render time + runtime counters.
// Ring buffer of last PERF_SAMPLES frames. Zero cost when hidden.
const PERF_SAMPLES = 60;
const perf = {
  visible: false,
  frames: new Float32Array(PERF_SAMPLES),
  updates: new Float32Array(PERF_SAMPLES),
  renders: new Float32Array(PERF_SAMPLES),
  idx: 0,
  filled: 0,
  lastUpdate: 0,
  lastRender: 0,
  lastFrame: 0,
  // Rolling capture (time-based). Start with game.capturePerf(label, durationMs).
  capturing: false,
  captureLabel: '',
  /** @type {Float32Array | null} */
  captureFrames: null,
  captureIdx: 0,
  captureMaxFrames: 1200, // hard cap to avoid unbounded allocation
  captureDurationMs: 5000,
  captureStart: 0,
  /**
   * @param {any} frameMs
   * @param {any} updateMs
   * @param {any} renderMs
   */
  push(frameMs, updateMs, renderMs) {
    this.frames[this.idx] = frameMs;
    this.updates[this.idx] = updateMs;
    this.renders[this.idx] = renderMs;
    this.lastFrame = frameMs; this.lastUpdate = updateMs; this.lastRender = renderMs;
    this.idx = (this.idx + 1) % PERF_SAMPLES;
    if (this.filled < PERF_SAMPLES) this.filled++;
    if (this.capturing) {
      if (this.captureIdx < this.captureMaxFrames && this.captureFrames) {
        this.captureFrames[this.captureIdx++] = frameMs;
      }
      if (performance.now() - this.captureStart >= this.captureDurationMs) this.finishCapture();
    }
  },
  stats() {
    const n = this.filled || 1;
    let fs = 0, us = 0, rs = 0, fmax = 0;
    for (let i = 0; i < n; i++) {
      fs += this.frames[i] ?? 0; us += this.updates[i] ?? 0; rs += this.renders[i] ?? 0;
      if ((this.frames[i] ?? 0) > fmax) fmax = this.frames[i] ?? 0;
    }
    const avgFrame = fs / n;
    return {
      fps: avgFrame > 0 ? 1000 / avgFrame : 0,
      avgFrame, avgUpdate: us / n, avgRender: rs / n, maxFrame: fmax,
    };
  },
  /**
   * @param {any} label
   * @param {any} durationMs
   */
  startCapture(label, durationMs) {
    this.captureLabel = label || 'capture';
    this.captureDurationMs = (typeof durationMs === 'number' && durationMs > 0) ? durationMs : 5000;
    this.captureFrames = new Float32Array(this.captureMaxFrames);
    this.captureIdx = 0;
    this.captureStart = performance.now();
    this.capturing = true;
    console.log(`[perf] capture start: ${this.captureLabel} (${this.captureDurationMs}ms)`);
  },
  finishCapture() {
    this.capturing = false;
    const n = this.captureIdx;
    if (n === 0 || !this.captureFrames) { console.log('[perf] capture empty'); return; }
    const data = this.captureFrames.subarray(0, n);
    let sum = 0, max = 0, min = Infinity, over33 = 0, over20 = 0;
    for (let i = 0; i < n; i++) {
      const v = data[i] ?? 0; sum += v;
      if (v > max) max = v;
      if (v < min) min = v;
      if (v > 33) over33++;
      if (v > 20) over20++;
    }
    const avg = sum / n;
    const sorted = Array.from(data).sort((a, b) => a - b);
    const p50 = sorted[Math.floor(n * 0.5)] ?? 0;
    const p95 = sorted[Math.floor(n * 0.95)] ?? 0;
    const p99 = sorted[Math.floor(n * 0.99)] ?? 0;
    console.log(`[perf] ${this.captureLabel} — n=${n} avg=${avg.toFixed(2)}ms p50=${p50.toFixed(2)} p95=${p95.toFixed(2)} p99=${p99.toFixed(2)} max=${max.toFixed(2)} min=${min.toFixed(2)} fps=${(1000/avg).toFixed(1)} drops>20ms=${over20} drops>33ms=${over33}`);
    this.captureFrames = null;
  },
};

function renderPerfHUD() {
  const s = perf.stats();
  const pad = 6;
  const lineH = 12;
  const lines = [
    `FPS ${s.fps.toFixed(0)}  frame ${s.avgFrame.toFixed(1)}ms max ${s.maxFrame.toFixed(1)}`,
    `  upd ${s.avgUpdate.toFixed(2)}  render ${s.avgRender.toFixed(2)}`,
    `enemies ${enemies.length}  proj ${projectiles.length}  part ${particleCount()}`,
    `ft ${floatingTexts.length}  vcore ${vcores.length}  beacon ${beacons.length}`,
    `mine ${mines.length}  cam ${cameras.length}  laser ${lasers.length}`,
    `wt ${wallTurrets.length}  sg ${shieldGens.length}  df ${disruptionFields.length}  gw ${gravityWells.length}`,
    `bolts ${(game._chainBolts||[]).length}  hackFX ${hackwareEffects.length}`,
  ];
  // Subsystem timing — show each tracked label with avg/max ms over the last
  // PERF_SAMPLES frames. Sorted descending so the hottest shows first, making
  // the next optimisation target obvious. Labels with zero time this frame
  // are hidden (keeps the HUD short when a subsystem is idle).
  const subs = perfSubsystemStats();
  if (subs.length) {
    lines.push('─ subsystems (avg/max ms) ─');
    for (let i = 0; i < subs.length; i++) {
      const sub = subs[i];
      if (!sub) continue;
      lines.push(`  ${sub.label.padEnd(10)} ${sub.avg.toFixed(2).padStart(5)} / ${sub.max.toFixed(2).padStart(5)}`);
    }
  }
  if (perf.capturing) {
    lines.push(`● CAPTURING ${perf.captureLabel} ${perf.captureIdx}f ${((performance.now()-perf.captureStart)/1000).toFixed(1)}s/${(perf.captureDurationMs/1000).toFixed(1)}s`);
  }
  const w = 260;
  const h = pad * 2 + lineH * lines.length;
  const x = 4 + (safeLeft || 0);
  const y = 4 + (safeTop || 0);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = s.avgFrame > 20 ? '#ff4444' : (s.avgFrame > 17.5 ? '#ffaa00' : '#33ff66');
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.font = '11px monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = s.avgFrame > 20 ? '#ff8888' : (s.avgFrame > 17.5 ? '#ffcc66' : '#88ffaa');
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i] || '', x + pad, y + pad + i * lineH);
  }
  ctx.restore();
}

// ─── Main Loop ────────────────────────────────────────────────────────────────
let lastTime=0;
/**
 * @param {any} ts
 */
function loop(ts) {
  const dt=Math.min((ts-lastTime)/1000,0.05);
  // F3 toggles perf HUD (check before anything else so it's always responsive)
  if (justPressed.has('F3')) perf.visible = !perf.visible;
  const profiling = perf.visible || perf.capturing;
  const frameStart = profiling ? performance.now() : 0;
  const frameDelta = (profiling && lastTime) ? frameStart - (game._lastFrameStart || frameStart) : 16;
  if (profiling) game._lastFrameStart = frameStart;
  lastTime=ts;
  let _frameHadError = false;
  try {
    if (profiling) {
      const uStart = performance.now();
      try { game.update(dt); } catch (e) { _frameHadError = true; _onFrameError('update', e); }
      try { music.tick(); } catch (_) {}
      const uEnd = performance.now();
      try { game.render(); } catch (e) { _frameHadError = true; _onFrameError('render', e); }
      const rEnd = performance.now();
      if (perf.visible) { try { renderPerfHUD(); } catch (_) {} }
      perf.push(frameDelta, uEnd - uStart, rEnd - uEnd);
    } else {
      try { game.update(dt); } catch (e) { _frameHadError = true; _onFrameError('update', e); }
      try { music.tick(); } catch (_) {} // isolate audio errors from gameplay
      try { game.render(); } catch (e) { _frameHadError = true; _onFrameError('render', e); }
    }
    if (!_frameHadError) _onFrameOk();
    if (game._renderError) {
      try {
        if (typeof NEON !== 'undefined' && NEON.renderBoundary) {
          NEON.renderBoundary.drawErrorOverlay(ctx, W, H, game._renderError);
        }
      } catch (_) { /* overlay itself failed; nothing more we can do */ }
    }
  } finally {
    clearJust();
    // Telemetry periodic flush
    if (typeof NEON !== 'undefined' && NEON.telemetry) { try { NEON.telemetry.update(dt); } catch(_){} }
    requestAnimationFrame(loop);
  }
}

// Render error boundary (post-v116). The loop above used to wrap update+render
// in try/finally with no catch — a thrown exception aborted the frame mid-draw
// but rAF kept rescheduling, so input still worked while the world silently
// vanished. Now each phase has its own catch; failures populate
// game._renderError and a visible overlay is drawn over whatever managed to
// render before the throw. See engine/render-boundary.js.
//
// Auto-recovery: a transient error (one bad frame during a particle burst,
// say) shouldn't pin the overlay forever. After RECOVERY_FRAMES consecutive
// healthy frames the overlay clears itself. A persistent error keeps resetting
// the counter, so it stays visible.
const _RENDER_BOUNDARY_RECOVERY_FRAMES = 180; // ~3 s at 60fps
game._renderError = null;
game._renderHealthyFrames = 0;
game.clearRenderError = function () {
  game._renderError = null;
  game._renderHealthyFrames = 0;
};
function _onFrameOk() {
  if (!game._renderError) return;
  game._renderHealthyFrames++;
  if (game._renderHealthyFrames >= _RENDER_BOUNDARY_RECOVERY_FRAMES) {
    game._renderError = null;
    game._renderHealthyFrames = 0;
  }
}
/**
 * @param {any} phase
 * @param {any} err
 */
function _onFrameError(phase, err) {
  // Defensive: if the boundary module failed to load, fall back to console
  // logging so we never reintroduce the silent-crash class of bug.
  try {
    if (typeof NEON === 'undefined' || !NEON.renderBoundary) {
       
      console.error('[render-boundary:fallback] ' + phase + '() threw:', err);
      return;
    }
    const next = NEON.renderBoundary.trackRenderError(game._renderError, phase, err);
    if (NEON.renderBoundary.shouldLog(next)) {
       
      console.error('[render-boundary] ' + phase + '() threw (\u00D7' + next.count + '):', err);
    }
    game._renderError = next;
    game._renderHealthyFrames = 0;
  } catch (innerErr) {
    // Last-resort: never let the boundary itself crash the loop.
     
    try { console.error('[render-boundary:meta-fail]', innerErr, 'original:', err); } catch (_) {}
  }
}

// Expose capture helper for manual profiling in devtools.
// Usage: game.capturePerf('boss-fight')  or  game.capturePerf('label', 10000) for 10s.
/**
 * @param {any} label
 * @param {any} durationMs
 */
game.capturePerf = function(label, durationMs) { perf.startCapture(label, durationMs); };
game.perf = perf;

// ─── Per-subsystem timing ─────────────────────────────────────────────────────
// Lightweight block timers used to attribute update-time cost to each hot loop
// (enemy update, projectile update, particle update, env entities, etc.).
// Enabled only when the HUD is visible or a capture is running, so zero cost
// in normal play. Surface pattern at callsites:
//   const _pt = perfEnabled() ? performance.now() : 0;
//   ...work...
//   if (_pt) perfRecord('label', performance.now() - _pt);
// Labels are free-form; the HUD renders all of them sorted by average time.
const PERF_SUB_SAMPLES = 60;
const perfSubsystems = new Map();
function perfEnabled() { return perf.visible || perf.capturing; }
/**
 * @param {any} label
 * @param {any} ms
 */
function perfRecord(label, ms) {
  let s = perfSubsystems.get(label);
  if (!s) {
    s = { samples: new Float32Array(PERF_SUB_SAMPLES), idx: 0, filled: 0 };
    perfSubsystems.set(label, s);
  }
  s.samples[s.idx] = ms;
  s.idx = (s.idx + 1) % PERF_SUB_SAMPLES;
  if (s.filled < PERF_SUB_SAMPLES) s.filled++;
}
function perfSubsystemStats() {
  const out = [];
  for (const [label, s] of perfSubsystems) {
    if (!s.filled) continue;
    let sum = 0, max = 0;
    for (let i = 0; i < s.filled; i++) {
      const v = s.samples[i];
      sum += v;
      if (v > max) max = v;
    }
    out.push({ label, avg: sum / s.filled, max });
  }
  out.sort((a, b) => b.avg - a.avg);
  return out;
}
game.perfRecord = perfRecord;
game.perfSubsystemStats = perfSubsystemStats;

// ─── Boot ─────────────────────────────────────────────────────────────────────
resize();
updateBtns();
mouse.x = W/2; mouse.y = H/2;
window.addEventListener('resize', () => { resize(); updateBtns(); resetTouch(); mouse.x = W/2; mouse.y = H/2; });
// Initialize telemetry — connects PostHog as transport if API key is configured
if (typeof NEON !== 'undefined' && NEON.telemetry) {
  const _phTransport = (typeof posthog !== 'undefined' && posthog.__SV)
    /**
     * @param {any} batch
     */
    ? function (/** @type {any} */ batch) {
        for (const ev of batch) posthog.capture('neon_' + ev.e, ev.p);
        return Promise.resolve();
      }
    : null;
  NEON.telemetry.init({ transport: _phTransport });
}
game.state='MENU';
try { const pl = document.getElementById('privLink'); if (pl) pl.style.display = ''; } catch(_){}
game.menuParticles=[];
requestAnimationFrame(loop);
