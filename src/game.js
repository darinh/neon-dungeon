'use strict';

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

  msg(text,colour) {
    messages.push({text,colour:colour||'#e0e0ff',life:3});
  },

  setState(s, callback) {
    this.state=s;
    this.mapExpanded = false;
    if (s === 'MENU') { this.menuSel = 0; music.stop(); }
    else if (s === 'PAUSED') music.pause();
    else if (s === 'PLAYING') music.resume();
    else if (s === 'GAME_OVER' || s === 'VICTORY') music.stop();
    if (callback) callback();
  },

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

  loadFloor(n, savedModifier) {
    this.floor=n;
    music.setFloor(n);
    this.floorTime=0; // arc grid phase timer
    // Roll or restore floor modifier
    if (savedModifier !== undefined) {
      this.modifier = savedModifier;
    } else if (n === 1 || n === 3 || n === 6 || n === 10) {
      this.modifier = null;
    } else {
      this.modifier = MODIFIER_KEYS[rndInt(0, MODIFIER_KEYS.length - 1)];
    }
    // Strip floor-only shield bonus from previous floor
    this.player.def-=this.player.shieldBonus;
    this.player.shieldBonus=0;
    // Keys are floor-scoped: keep them for this floor, clear on fresh floor transitions
    if (savedModifier === undefined) this.player.keys = { red:0, blue:0, gold:0 };
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
    populateFloor(this.dungeon,n);
    // ECHO_MAPPER augment: reveal floor layout (minimap only, not quest progress)
    if (hasAugment('ECHO_MAPPER')) {
      this.mapRevealed = true;
    } else {
      this.mapRevealed = false;
    }
    this.mapExpanded = false;
    this.player.x=this.dungeon.playerPos.x;
    this.player.y=this.dungeon.playerPos.y;
    messages=[];
    this.msg('FLOOR '+n,'#ff00c8');
    if (n===3||n===6||n===10) {
      setTimeout(()=>{ audio.bossEnter(); this.msg('⚠ BOSS DETECTED','#ff3333'); },500);
    }
    // Announce modifier (banner replaces msg — banner timer set only on fresh transitions)
    if (this.modifier && savedModifier === undefined) {
      this.modBannerTimer = 3.0;
    } else {
      this.modBannerTimer = 0;
    }
    // Generate floor quest
    this.generateQuest(n);
    // Auto-save at start of each floor
    this.saveGame();
  },

  generateQuest(floorNum) {
    const questTypes = [
      { id:'EXTERMINATE', label:'Exterminate all enemies', check: ()=>enemies.length===0 && (!game.challengeSealed || game.challengeComplete),
        reward: ()=>{ this.player.score+=200*floorNum; this.msg('Quest complete! +'+200*floorNum+' pts','#39ff14'); }},
      { id:'EXPLORE', label:'Visit all visible rooms', check: ()=>{
          const d=this.dungeon;
          return d.rooms.every(r=>r.roomType==='secret' && !r.secretRevealed || d.visited[r.cy]?.[r.cx]);
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
    // Boss floors always get EXTERMINATE
    if (floorNum===3||floorNum===6||floorNum===10) {
      this.quest = {...questTypes[0], done:false, failed:false};
    } else {
      const q = questTypes[rndInt(0, questTypes.length-1)];
      this.quest = {...q, done:false, failed:false};
    }
    setTimeout(()=>this.msg('⚡ '+this.quest.label,'#39ff14'), 800);
  },

  startGame() {
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
    this.loadFloor(1);
    this.setState('PLAYING');
  },

  descend() {
    if (this.floor>=10) {
      // victory
      audio.victory();
      this.player.score+=500*this.floor+Math.floor(this.player.hp)*10;
      this.endRun(true);
    } else {
      audio.descend();
      this.player.score+=500*this.floor+Math.floor(this.player.hp)*10;
      const next=this.floor+1;
      this.fadeTo('DESCENDING TO FLOOR '+next, ()=>{
        this.loadFloor(next);
      }, 'PLAYING');
    }
  },

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
    // Spawn premium loot: guaranteed upgrade item + bonus credits
    const itemCount = 2 + (sr.w * sr.h >= 40 ? 1 : 0);
    for (let j=0; j<itemCount; j++) {
      const ix = sr.x + rnd(1, sr.w - 1), iy = sr.y + rnd(1, sr.h - 1);
      items.push(new Item(ix, iy));
    }
    // Bonus credit pickup worth floor-scaled amount
    const secretCr = Math.round(20 * (1 + floorNum * 0.15) * getMetaCreditMultiplier() * getDiff().creditMul * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
    this.player.credits += secretCr;
    this.msg('+' + secretCr + ' credits found!', '#39ff14');
    this.player.score += 300 * floorNum;
  },

  saveScore(name) {
    const scores=this.getScores();
    const entry={name:name||'ANON',score:this.player.score,floor:this.floor,date:new Date().toLocaleDateString()};
    scores.push(entry);
    scores.sort((a,b)=>b.score-a.score);
    this.lastSavedRank=scores.findIndex(s=>s===entry);
    scores.splice(10);
    try { localStorage.setItem('neonDungeonScores',JSON.stringify(scores)); } catch(e){}
  },

  endRun(victory) {
    music.stop();
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
    // Award data fragments
    const earned = calcRunShards(this.floor, this.player.score, this.bossesCleared, victory);
    const meta = loadMeta();
    meta.shards += earned;
    meta.stats.totalRuns++;
    meta.stats.totalShards += earned;
    meta.stats.bestFloor = Math.max(meta.stats.bestFloor, this.floor);
    if (victory) meta.stats.victories++;
    saveMeta(meta);
    this.lastRunShards = earned;
    const scores=this.getScores();
    const testEntry={score:this.player.score};
    scores.push(testEntry);
    scores.sort((a,b)=>b.score-a.score);
    const rank=scores.findIndex(s=>s===testEntry);
    if (rank>=0 && rank<10) {
      this.nameEntry={name:'',rank,victory,cursorBlink:0};
      this.setState('NAME_ENTRY');
    } else {
      this.saveScore('ANON');
      this.setState(victory?'VICTORY':'GAME_OVER');
    }
  },

  getScores() {
    try { return JSON.parse(localStorage.getItem('neonDungeonScores'))||[]; } catch(e){return[];}
  },

  // ── Save / Load ────────────────────────────────────────────────────────
  hasSave() {
    try { return !!localStorage.getItem('neonDungeonSave'); } catch(e){return false;}
  },

  saveGame() {
    if (!this.player) return;
    const p = this.player;
    const weaponSave = { _base: p.weapon._base || 'PULSE_PISTOL', _affixes: p.weapon._affixes || [] };
    const save = {
      v: SAVE_VERSION,
      floor: this.floor,
      difficulty: this.difficulty,
      modifier: this.modifier,
      bossesCleared: this.bossesCleared,
      runTime: this.runTime,
      player: {
        hp:p.hp, maxHp:p.maxHp, atk:p.atk, def:p.def,
        level:p.level, xp:p.xp, weapon:weaponSave,
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
        augments:p.augments||{}
      }
    };
    try { localStorage.setItem('neonDungeonSave', JSON.stringify(save)); } catch(e){}
  },

  deleteSave() {
    try { localStorage.removeItem('neonDungeonSave'); } catch(e){}
  },

  continueGame() {
    combo.best=0;
    this.pendingPerkChoices=[];
    this.perkChoice=null;
    this.augmentChoice=null;
    let save;
    try { save = JSON.parse(localStorage.getItem('neonDungeonSave')); } catch(e){ save = null; }
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
    p.shieldBonus=0; // loadFloor will manage floor-only bonuses
    this.bossesCleared=Math.max(0, Math.floor(Number(save.bossesCleared) || 0));
    this.runTime=save.runTime||0;
    this.player=p;
    const savedMod = save.modifier != null && FLOOR_MODIFIERS[save.modifier] ? save.modifier : null;
    this.loadFloor(save.floor||1, savedMod);
    this.setState('PLAYING');
    this.msg('RUN RESUMED — FLOOR '+this.floor,'#00f5ff');
  },

  update(dt) {
    switch(this.state) {
      case 'MENU':        this.updateMenu(dt);    break;
      case 'PLAYING':     this.updatePlaying(dt); break;
      case 'PAUSED':      this.updatePaused();    break;
      case 'POWERUP_CHOICE': this.updatePowerupChoice(); break;
      case 'PERK_CHOICE':    this.updatePerkChoice(); break;
      case 'AUGMENT_CHOICE': this.updateAugmentChoice(); break;
      case 'EVENT_CHOICE':   this.updateEventChoice(); break;
      case 'SHOPPING':       this.updateShopping(); break;
      case 'READING':        this.updateReading(); break;
      case 'ARCHIVES':       this.updateArchives(); break;
      case 'SETTINGS':       this.updateSettings(); break;
      case 'FADE':        this.updateFade(dt);    break;
      case 'GAME_OVER':   this.updateGameOver();  break;
      case 'VICTORY':     this.updateVictory();   break;
      case 'NAME_ENTRY':  this.updateNameEntry(dt); break;
    }
  },

  getMenuOptions() {
    const opts = [];
    if (this.hasSave()) {
      let save; try { save = JSON.parse(localStorage.getItem('neonDungeonSave')); } catch(e){}
      const saveDiff = DIFFICULTIES[save?.difficulty] ? save.difficulty : 'NORMAL';
      opts.push({ label:`CONTINUE (FLOOR ${save?.floor||'?'} · ${saveDiff})`, action:()=>this.continueGame(), colour:'#00f5ff' });
    }
    const d = getDiff();
    opts.push({ label:`NEW GAME — ${d.label}  ◀▶`, action:()=>this.startGame(), colour:d.colour, isDiffRow:true });
    const meta = loadMeta();
    opts.push({ label:`NEURAL ARCHIVES (${meta.shards}◆)`, action:()=>{ audio.menuSelect(); this.archivesSel=0; this.setState('ARCHIVES'); }, colour:'#ffb700' });
    opts.push({ label:'SETTINGS', action:()=>{ audio.menuSelect(); this._settingsFrom='MENU'; this.setState('SETTINGS'); }, colour:'#888899' });
    return opts;
  },

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
  },

  updatePlaying(dt) {
    const player=this.player;
    const dungeon=this.dungeon;
    this.floorTime = (this.floorTime || 0) + dt;
    this.runTime = (this.runTime || 0) + dt;
    this.hint = null;

    // Expanded map modal — freeze gameplay, only handle dismiss
    if (this.mapExpanded) {
      if (jp('Tab') || jp('Escape')) this.mapExpanded = false;
      justPressed.clear();
      return;
    }
    if (jp('Tab')) { this.mapExpanded = true; justPressed.clear(); return; }

    player.update(dt,dungeon.map);

    const cam=getCamera(player);

    // sync touch aim: synthesise a mouse position far in the joystick direction
    if (touch.aim.active) {
      mouse.down = touch.aim.shooting;
      if (touch.aim.dx !== 0 || touch.aim.dy !== 0) {
        mouse.x = player.x * TILE - cam.x + touch.aim.dx * 300;
        mouse.y = player.y * TILE - cam.y + touch.aim.dy * 300;
      }
    }

    // aim with mouse
    const worldAimX=(mouse.x+cam.x)/TILE;
    const worldAimY=(mouse.y+cam.y)/TILE;
    const [afx,afy]=norm(worldAimX-player.x,worldAimY-player.y);
    if (afx||afy) player.facing={x:afx,y:afy};

    // shoot (suppressed during dash)
    if ((mouse.down||keys.has(km('shoot'))) && player.shootCooldown<=0 && player.dashTimer<=0) {
      player.shoot(worldAimX,worldAimY,dungeon.map);
    }

    // update enemies
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

    // decay chain lightning bolts
    if (this._chainBolts) {
      for (let i=this._chainBolts.length-1;i>=0;i--) {
        this._chainBolts[i].timer-=dt;
        if (this._chainBolts[i].timer<=0) this._chainBolts.splice(i,1);
      }
    }

    // update projectiles
    for (let i=projectiles.length-1;i>=0;i--) {
      projectiles[i].update(dt,dungeon.map,player,enemies);
      if (projectiles[i].dead) projectiles.splice(i,1);
    }

    // update hazard zones (grenade AoE)
    updateHazardZones(dt, player);

    // update volatile cores
    updateVCores(dt);

    // update alarm beacons
    updateBeacons(dt);

    // update proximity mines
    updateMines(dt);

    // update items
    for (const it of items) it.update(dt);

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
        // Defer upgrade pickup if a perk/augment choice is pending
        if (this.pendingPerkChoices.length || this.perkChoice || this.augmentChoice) continue;
        audio.pickup();
        items.splice(i,1);
        // Generate 2 upgrade options
        const optA = pickUpgradeOption(null);
        const optB = pickUpgradeOption(optA.id);
        this.powerupChoice = { options:[optA, optB], selected:0 };
        this.setState('POWERUP_CHOICE');
        return; // freeze gameplay immediately
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
      let lastCx = 0, lastCy = 0;
      for (const room of dungeon.rooms) {
        if (!room._hadEnemies || this.clearedRooms.has(room)) continue;
        if (room === dungeon.bossRoom || room === dungeon.spawnRoom) continue;
        if (room.roomType === 'challenge' && !room.challengeComplete) continue;
        if (enemies.some(e => !e.dead && !e._disguised && e.room === room)) continue;
        // Block room-clear until alarm beacons are resolved
        if (beacons.some(b => !b.dead && b.room === room)) continue;
        this.clearedRooms.add(room);
        clears++;
        lastCx = room.cx; lastCy = room.cy;
        const d = getDiff();
        const cr = Math.round((10 + this.floor * 5) * getMetaCreditMultiplier() * d.creditMul * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
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
    updateLighting(dungeon,player.x,player.y);
    updateParticles(dt);
    updateFloatingTexts(dt);
    updateShake(dt);
    updateCombo(dt);
    updateAmbient(dt);
    updateHackwareEffects(dt);
    if (this.modBannerTimer > 0) this.modBannerTimer -= dt;
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
        const idx = unseen.length > 0 ? unseen[Math.floor(Math.random() * unseen.length)] : Math.floor(Math.random() * LORE_ENTRIES.length);
        player.loreRead.add(idx);
        this.currentLore = LORE_ENTRIES[idx];
        player.score += 50;
        this.msg('+50 DATA RECOVERED', '#ffb700');
        // Consume the terminal — single use
        dungeon.map[ty][tx] = T.FLOOR;
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
      const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
      for (const [ddx,ddy] of dirs) {
        const dx=tx+ddx, dy=ty+ddy;
        if (dx<0||dy<0||dx>=MAP_W||dy>=MAP_H) continue;
        const dt=dungeon.map[dy][dx];
        if (dt===T.CRACKED) {
          dungeon.map[dy][dx]=T.FLOOR;
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
          this.msg('Door opened','#aa8844');
          spawnParticles(dx+0.5, dy+0.5, 'SPARK', '#aa8844', 4);
          break;
        }
        if (isDoor(dt)) {
          const kc=doorKeyColour(dt);
          if (player.keys[kc] > 0) {
            dungeon.map[dy][dx]=T.DOOR_OPEN;
            this.msg('Unlocked '+kc+' door!', dt===T.LOCKED_R?'#ff3333':dt===T.LOCKED_B?'#3388ff':'#ffcc00');
            spawnParticles(dx+0.5, dy+0.5, 'EXPLOSION', dt===T.LOCKED_R?'#ff3333':dt===T.LOCKED_B?'#3388ff':'#ffcc00', 8);
            break;
          } else {
            this.msg('Need '+kc.toUpperCase()+' KEY', dt===T.LOCKED_R?'#ff3333':dt===T.LOCKED_B?'#3388ff':'#ffcc00');
          }
        }
      }
    }
    // door / cracked wall prompt
    const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
    for (const [ddx,ddy] of dirs) {
      const dx=tx+ddx, dy=ty+ddy;
      if (dx<0||dy<0||dx>=MAP_W||dy>=MAP_H) continue;
      const dt=dungeon.map[dy][dx];
      if (dt===T.CRACKED) { this.hint={text:'Faint cracks... (press '+KEY_DISPLAY(km('interact'))+')',colour:'#ffb700'}; break; }
      if (dt===T.DOOR) { this.hint={text:'Press '+KEY_DISPLAY(km('interact'))+' to open door',colour:'#aa8844'}; break; }
      if (isDoor(dt)) {
        const kc=doorKeyColour(dt);
        const colour = dt===T.LOCKED_R?'#ff3333':dt===T.LOCKED_B?'#3388ff':'#ffcc00';
        if (player.keys[kc] > 0) {
          this.hint={text:'Press '+KEY_DISPLAY(km('interact'))+' to unlock '+kc.toUpperCase()+' door', colour};
        } else {
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
              this.augmentChoice = { options: opts, selected: 0, room: r };
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
      if (r.shopItems && r.shopItems.some(i => !i.sold) && player.x>=r.x && player.x<r.x+r.w && player.y>=r.y && player.y<r.y+r.h) {
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
          if (!r.shopItems.some(i => !i.sold)) continue; // all invalidated
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
      const onEntrance = this.bossEntrances.some(e =>
        Math.floor(player.x)===e.x && Math.floor(player.y)===e.y);
      if (!onEntrance &&
          player.x >= r.x && player.x < r.x + r.w &&
          player.y >= r.y && player.y < r.y + r.h) {
        this.bossSealed = true;
        for (const e of this.bossEntrances) {
          e.origTile = dungeon.map[e.y][e.x];
          dungeon.map[e.y][e.x] = T.WALL;
        }
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
        const onEntrance = this.challengeEntrances.some(e =>
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
          const typeCounts = {};
          const TYPE_CAPS = { PHANTOM:2, TURRET:2, DRONE:1, SHIELDER:1, SPLITTER:1, GRENADIER:1, TELEPORTER:1, SNIPER:1, SUMMONER:1, HEALER:1, CHARGER:2 };
          for (let j = 0; j < count; j++) {
            let type = pickEnemyType(effectiveFloor);
            if ((typeCounts[type]||0) >= (TYPE_CAPS[type]||99)) {
              const open = ENEMY_TYPES_LIST.filter(t =>
                (typeCounts[t]||0) < (TYPE_CAPS[t]||99) &&
                !(ENEMY_WEIGHTS[t].minFloor && effectiveFloor < ENEMY_WEIGHTS[t].minFloor)
              );
              type = open.length ? open[rndInt(0, open.length-1)] : 'GUARD';
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
        const alive = enemies.filter(e => !e.dead && e._challengeWave);
        if (alive.length === 0) {
          if (this.challengeWave >= this.challengeMaxWaves) {
            // Challenge complete — unseal and reward
            this.challengeComplete = true;
            this.challengeSealed = false;
            cr.challengeComplete = true;
            for (const e of this.challengeEntrances) {
              if (e.origTile !== undefined) { dungeon.map[e.y][e.x] = e.origTile; delete e.origTile; }
            }
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
      const pRoom = this.dungeon.rooms.find(r =>
        px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h);
      const inCombat = pRoom && enemies.some(e => !e.dead && e.room === pRoom);
      music.setState(inCombat ? 'combat' : 'explore');
    }
  },

  updatePaused() {
    if (jp('Escape')) { audio.menuSelect(); this.setState('PLAYING'); }
    else if (jp('KeyS')) { audio.menuSelect(); this._settingsFrom = 'PAUSED'; this.setState('SETTINGS'); }
    else if (jp('KeyQ')) { audio.menuSelect(); this.setState('MENU'); }
  },

  updatePowerupChoice() {
    const pc = this.powerupChoice;
    if (!pc) { this.setState('PLAYING'); return; }
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

  applyPowerupChoice(idx) {
    const pc = this.powerupChoice;
    if (idx >= 0 && idx < pc.options.length) {
      const opt = pc.options[idx];
      opt.fn(this.player);
      audio.menuSelect();
      this.msg('Chose ' + opt.name, opt.colour);
    } else {
      this.msg('Skipped upgrade', '#666688');
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
    this.perkChoice = { options: opts, selected: 0 };
    this.setState('PERK_CHOICE');
    audio.perkChoice();
  },

  updatePerkChoice() {
    const pc = this.perkChoice;
    if (!pc) { this.setState('PLAYING'); return; }
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
  openAugmentChoice(options) {
    this.augmentChoice = { options, selected: 0 };
    this.setState('AUGMENT_CHOICE');
    audio.augmentChoice();
  },

  updateAugmentChoice() {
    const ac = this.augmentChoice;
    if (!ac) { this.setState('PLAYING'); return; }
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
      ctx.font = (narrow ? 9 : 11) + 'px monospace';
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
      ctx.font = (narrow ? 9 : 11) + 'px monospace';
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
    if (this.shopClosing || items.every(i => i.sold)) return;

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
      const narrow = layout.compact;
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
    const nextUnsold = items.findIndex((it, i) => i > idx && !it.sold);
    const prevUnsold = items.findIndex(it => !it.sold);
    this.shopSelected = nextUnsold >= 0 ? nextUnsold : (prevUnsold >= 0 ? prevUnsold : idx);
    // If all sold, auto-leave after brief delay
    if (items.every(i => i.sold)) {
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
      this.setState('PLAYING');
    }
  },

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

  _vkLayout(narrow) {
    const cols=this._vkCols;
    const cellW=narrow?28:36, cellH=narrow?28:36, gap=narrow?3:4;
    const rows=Math.ceil((this._vkChars.length+2)/cols); // +2 for DEL/OK
    const gridW=cols*(cellW+gap)-gap;
    const ox=(W-gridW)/2;
    return {cellW,cellH,gap,cols,rows,ox,gridW};
  },

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
    if (jp('Enter')||jp('MouseLeft')) { audio.menuSelect(); this.setState('MENU'); }
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
    const CTRL_START = 4;     // row index where key rebind rows begin
    // Total items: 2 sliders + 2 toggles + N rebind rows + 1 reset row + 1 back row
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
        const oldCode = settings.keyMap[curAction];
        for (const a of actions) {
          if (a !== curAction && settings.keyMap[a] === code) {
            settings.keyMap[a] = oldCode; break;
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
    const toggleKeys = ['screenShake', 'damageNumbers'];
    if (sel >= TOGGLE_START && sel < CTRL_START) {
      if (jp(ALT_KEYS.left) || jp(km('left')) || jp(ALT_KEYS.right) || jp(km('right')) || jp('Enter') || jp(km('shoot'))) {
        const key = toggleKeys[sel - TOGGLE_START];
        settings[key] = !settings[key];
        settings.save();
        audio.menuSelect();
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
          settings[toggleKeys[i]] = !settings[toggleKeys[i]];
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
    const CTRL_START = 4;
    const totalRows = CTRL_START + actions.length + 2;
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
      ctx.fillText(volLabels[i], labelX, ry);
      // Slider track
      const trackY = ry - 4;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(sliderX, trackY, sliderW, 10);
      // Slider fill
      const fillW = sliderW * volVals[i];
      ctx.fillStyle = isSel ? '#00f5ff' : '#555577';
      ctx.fillRect(sliderX, trackY, fillW, 10);
      // Slider knob
      ctx.fillStyle = isSel ? '#ffffff' : '#aaaacc';
      ctx.fillRect(sliderX + fillW - 3, trackY - 2, 6, 14);
      // Percentage
      ctx.textAlign = 'right';
      ctx.fillStyle = isSel ? '#00f5ff' : '#888899';
      ctx.fillText(`${Math.round(volVals[i] * 100)}%`, sliderX + sliderW + (narrow ? 40 : 60), ry);
    }

    // ── Display section ──
    const toggleLabels = ['SCREEN SHAKE', 'DAMAGE NUMBERS'];
    const toggleKeys = ['screenShake', 'damageNumbers'];
    for (let i = 0; i < toggleLabels.length; i++) {
      const ry = startY + (TOGGLE_START + i) * rowH;
      const isSel = sel === TOGGLE_START + i;
      const on = settings[toggleKeys[i]];
      ctx.textAlign = 'left';
      ctx.fillStyle = isSel ? '#00f5ff' : '#888899';
      ctx.fillText(toggleLabels[i], labelX, ry);
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
      const isSel = sel === CTRL_START + i;
      const isCapturing = this._settingsCapture === a;
      ctx.textAlign = 'left';
      ctx.fillStyle = isSel ? '#ff00c8' : '#888899';
      ctx.fillText(ACTION_LABELS[a], labelX, ry);
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
          ctx.fillStyle = '#555577'; ctx.font = `${narrow ? 9 : 11}px monospace`;
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
    ctx.fillStyle = '#444466'; ctx.font = `${narrow ? 9 : 11}px monospace`;
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
      case 'GAME_OVER': this.renderGameOver(); break;
      case 'VICTORY':   this.renderVictory();  break;
      case 'NAME_ENTRY': this.renderNameEntry(); break;
    }
  },

  renderLeaderboard(y, maxEntries, highlightRank) {
    const narrow=layout.compact;
    const scores=this.getScores().slice(0,maxEntries);
    ctx.save();
    ctx.textAlign='center';
    ctx.shadowBlur=8; ctx.shadowColor='#ffb700';
    ctx.fillStyle='#ffb700'; ctx.font=`${narrow?12:14}px monospace`;
    ctx.fillText('— HIGH SCORES —',W/2,y);
    ctx.shadowBlur=0;
    const lineH=narrow?16:18;
    const startY=y+(narrow?18:20);
    scores.forEach((s,i)=>{
      const isHL=i===highlightRank;
      ctx.fillStyle=isHL?'#00f5ff':'#aaaacc';
      if (isHL) { ctx.shadowBlur=6; ctx.shadowColor='#00f5ff'; }
      ctx.font=`${isHL?'bold ':''}${narrow?10:12}px monospace`;
      if (narrow) {
        ctx.fillText(`${i+1}. ${s.name}  ${s.score}  FLR ${s.floor}`,W/2,startY+i*lineH);
      } else {
        ctx.fillText(`${i+1}. ${s.name.padEnd(12)} ${String(s.score).padStart(8)}  FLR ${s.floor}`,W/2,startY+i*lineH);
      }
      if (isHL) ctx.shadowBlur=0;
    });
    if (!scores.length) {
      ctx.fillStyle='#555577'; ctx.font=`${narrow?10:12}px monospace`;
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
    const titleFs = narrow ? 48 : 72;
    // grid lines
    ctx.save(); ctx.globalAlpha=0.05; ctx.strokeStyle='#00f5ff';
    for (let x=0;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for (let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
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
    ctx.fillStyle='#aaaacc'; ctx.font=`${narrow ? 12 : 16}px monospace`;
    ctx.fillText('A CYBERPUNK DUNGEON CRAWLER',W/2,ty2 + 35);
    ctx.restore();

    // Menu options — array-driven
    const startY = ty2 + 80;
    const gap = narrow ? 24 : 28;
    const fs = narrow ? 15 : 18;
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
    ctx.restore();

    // controls hint
    const hintY = startY + opts.length * gap + (narrow?24:32);
    ctx.save(); ctx.textAlign='center';
    ctx.fillStyle='#555577'; ctx.font=`${narrow ? 10 : 12}px monospace`;
    if (isTouch) {
      ctx.fillText('Left: Move  |  Right: Aim & Shoot', W/2, hintY);
      ctx.fillText(KEY_DISPLAY(km('interact'))+': Interact  |  ⇧: Dash  |  '+KEY_DISPLAY(km('voidshard'))+': Void Shard  |  ‖: Pause', W/2, hintY + 16);
    } else {
      ctx.fillText(KEY_DISPLAY(km('up'))+KEY_DISPLAY(km('left'))+KEY_DISPLAY(km('down'))+KEY_DISPLAY(km('right'))+': Move  |  Mouse: Aim  |  Click/'+KEY_DISPLAY(km('shoot'))+': Shoot', W/2, hintY);
      ctx.fillText(KEY_DISPLAY(km('interact'))+': Interact  |  '+KEY_DISPLAY(km('dash'))+': Dash  |  '+KEY_DISPLAY(km('voidshard'))+': Void Shard  |  ESC: Pause', W/2, hintY + 16);
    }
    ctx.restore();

    // high scores
    const scoresY = hintY + 50;
    this.renderLeaderboard(scoresY, narrow ? 3 : 5, -1);
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
      if (r.shopItems && r.shopItems.some(i => !i.sold)) {
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
    drawHackwareEffects(cam.x, cam.y);

    // volatile cores (below items, above ground effects)
    drawVCores(cam.x, cam.y);

    // alarm beacons
    drawBeacons(cam.x, cam.y);

    // proximity mines (below items/enemies, above ground effects)
    drawMines(cam.x, cam.y);

    // items
    for (const it of items) it.draw(cam.x,cam.y);

    // enemies
    for (const e of enemies) e.draw(cam.x,cam.y);

    // projectiles
    for (const p of projectiles) p.draw(cam.x,cam.y);

    // chain lightning bolts
    if (game._chainBolts) {
      for (const bolt of game._chainBolts) {
        const sx=(bolt.x1-cam.x)*TS, sy=(bolt.y1-cam.y)*TS;
        const ex=(bolt.x2-cam.x)*TS, ey=(bolt.y2-cam.y)*TS;
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
    drawBossBar();

    // Difficulty badge below minimap (non-NORMAL only)
    if (game.difficulty !== 'NORMAL') {
      const d = getDiff();
      const bx = W - 128 - safeRight, by = 92 + safeTop;
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
      const qx = W - 128 - safeRight, qy = 96 + safeTop;
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
      const by2 = 96 + safeTop + (game.quest ? 16 : 0);
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
    drawHint();
    drawTouchUI();
  },

  renderPaused() {
    const isTouch = isTouchDevice();
    const narrow = layout.compact;
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.55)';
    ctx.fillRect(0,0,W,H);
    ctx.textAlign='center';
    ctx.shadowBlur=20; ctx.shadowColor='#ff00c8';
    ctx.fillStyle='#ff00c8'; ctx.font=`bold ${narrow ? 36 : 48}px monospace`;
    ctx.fillText('PAUSED',W/2, narrow ? 200 : 240);
    ctx.shadowBlur=0; ctx.fillStyle='#aaaacc'; ctx.font=`${narrow ? 14 : 18}px monospace`;
    if (isTouch) {
      ctx.fillText('TAP TOP — Resume',W/2, narrow ? 255 : 295);
      ctx.fillText('TAP MIDDLE — Settings',W/2, narrow ? 280 : 320);
      ctx.fillText('TAP BOTTOM — Quit to Menu',W/2, narrow ? 305 : 345);
    } else {
      ctx.fillText('ESC — Resume',W/2, narrow ? 255 : 295);
      ctx.fillText('S   — Settings',W/2, narrow ? 280 : 320);
      ctx.fillText('Q   — Quit to Menu',W/2, narrow ? 305 : 345);
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

    for (let i=0; i<2; i++) {
      const opt = pc.options[i];
      const cx = startX + i * (cw + gap);
      const sel = pc.selected === i;
      const curLvl = opt.persistent && game.player ? (game.player.upgrades[opt.id]||0) : 0;

      // Card background
      ctx.fillStyle = sel ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)';
      ctx.strokeStyle = sel ? opt.colour : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = sel ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(cx, cardY, cw, cardH, 8);
      ctx.fill();
      ctx.stroke();

      // Glow on selected
      if (sel) {
        ctx.save();
        ctx.shadowBlur=20; ctx.shadowColor=opt.colour;
        ctx.strokeStyle=opt.colour; ctx.lineWidth=2;
        ctx.beginPath();
        ctx.roundRect(cx, cardY, cw, cardH, 8);
        ctx.stroke();
        ctx.restore();
      }
      // Rarity border glow for affixed weapons
      if (opt._rarity > 0 && !sel) {
        ctx.save();
        ctx.shadowBlur=12; ctx.shadowColor=opt._rarityColour;
        ctx.strokeStyle=opt._rarityColour; ctx.lineWidth=1.5;
        ctx.beginPath();
        ctx.roundRect(cx, cardY, cw, cardH, 8);
        ctx.stroke();
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

      // Description
      ctx.fillStyle='#aaaacc';
      ctx.font=`${narrow?11:13}px monospace`;
      ctx.fillText(opt.desc, cx + cw/2, cardY + 112);

      // Level info for persistent upgrades
      if (opt.persistent && opt.levelDesc) {
        ctx.fillStyle='#888899';
        ctx.font=`${narrow?10:12}px monospace`;
        ctx.fillText('Lv '+(curLvl)+'→'+(curLvl+1)+': '+opt.levelDesc(curLvl), cx + cw/2, cardY + 134);
      }

      // Hackware badge
      if (opt.isHackware) {
        ctx.fillStyle=opt.colour;
        ctx.font=`bold ${narrow?9:10}px monospace`;
        ctx.fillText('⚙ HACKWARE [F]', cx + cw/2, cardY + 134);
      }

      // Weapon stats line for weapon options
      if (opt.id && opt.id.startsWith('WEAPON_')) {
        ctx.fillStyle='#ffcc44';
        ctx.font=`${narrow?10:12}px monospace`;
        ctx.fillText(opt.desc, cx + cw/2, cardY + 134);
        // Affix description line
        if (opt.affixDesc) {
          ctx.fillStyle=opt._rarityColour || '#39ff14';
          ctx.font=`${narrow?9:11}px monospace`;
          ctx.fillText(opt.affixDesc, cx + cw/2, cardY + 150);
        }
        // Rarity label
        if (opt._rarity > 0) {
          ctx.fillStyle=opt._rarityColour;
          ctx.font=`bold ${narrow?9:10}px monospace`;
          ctx.fillText(RARITY_LABELS[opt._rarity], cx + cw/2, cardY + 164);
        }
      }
    }

    // Skip button
    const skipY = cardY + cardH + 25;
    const skipW = 160, skipH = 40;
    ctx.fillStyle='rgba(255,255,255,0.04)';
    ctx.strokeStyle='rgba(255,255,255,0.2)';
    ctx.lineWidth=1;
    ctx.beginPath();
    ctx.roundRect((W-skipW)/2, skipY, skipW, skipH, 6);
    ctx.fill();
    ctx.stroke();

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
      ctx.beginPath();
      ctx.roundRect(cx, cardY, cw, cardH, 8);
      ctx.fill(); ctx.stroke();

      // Glow on selected
      if (sel) {
        ctx.save();
        ctx.shadowBlur = 20; ctx.shadowColor = perk.colour;
        ctx.strokeStyle = perk.colour; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(cx, cardY, cw, cardH, 8);
        ctx.stroke();
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
        ctx.beginPath(); ctx.roundRect(cx, cardY, cw, cardH, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#333344';
        ctx.font = `bold ${narrow ? 14 : 18}px monospace`;
        ctx.fillText('SOLD', cx + cw / 2, cardY + cardH / 2 + 6);
        continue;
      }

      // Card background
      ctx.fillStyle = sel ? 'rgba(57,255,20,0.06)' : 'rgba(255,255,255,0.03)';
      ctx.strokeStyle = sel ? item.colour : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = sel ? 2 : 1;
      ctx.beginPath(); ctx.roundRect(cx, cardY, cw, cardH, 8); ctx.fill(); ctx.stroke();

      if (sel) {
        ctx.save();
        ctx.shadowBlur = 16; ctx.shadowColor = item.colour;
        ctx.strokeStyle = item.colour; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(cx, cardY, cw, cardH, 8); ctx.stroke();
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
      ctx.font = `${narrow ? 9 : 11}px monospace`;
      ctx.fillText(item.desc, cx + cw / 2, cardY + 92);

      // Level info for persistent upgrades
      if (item.persistent && item.levelDesc) {
        ctx.fillStyle = '#888899';
        ctx.font = `${narrow ? 9 : 11}px monospace`;
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
    ctx.beginPath(); ctx.roundRect((W - leaveW) / 2, leaveY, leaveW, leaveH, 6); ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#666688';
    ctx.font = `${narrow ? 13 : 15}px monospace`;
    ctx.fillText('LEAVE  [Esc]', W / 2, leaveY + 26);

    // Hint
    ctx.fillStyle = '#444466';
    ctx.font = `${narrow ? 9 : 11}px monospace`;
    if (isTouch) {
      ctx.fillText('Tap to buy · Tap Leave to exit', W / 2, leaveY + leaveH + 18);
    } else {
      ctx.fillText('1/2/3 buy  ·  ←/→ + Enter  ·  Esc leave', W / 2, leaveY + leaveH + 18);
    }

    ctx.restore();
  },

  renderReading() {
    if (!this.currentLore) return;
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
    ctx.shadowBlur = 20; ctx.shadowColor = '#ffb700';
    ctx.strokeStyle = '#ffb700';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(fx, fy, fw, fh, 8); ctx.stroke();
    ctx.restore();

    // Inner background
    ctx.fillStyle = 'rgba(26,18,8,0.95)';
    ctx.beginPath(); ctx.roundRect(fx, fy, fw, fh, 8); ctx.fill();

    // Scanline effect
    ctx.fillStyle = 'rgba(255,183,0,0.03)';
    for (let sy = fy; sy < fy + fh; sy += 3) {
      ctx.fillRect(fx, sy, fw, 1);
    }

    // Title
    ctx.textAlign = 'center';
    ctx.shadowBlur = 12; ctx.shadowColor = '#ffb700';
    ctx.fillStyle = '#ffb700';
    ctx.font = `bold ${narrow ? 16 : 22}px monospace`;
    ctx.fillText('◫ DATA TERMINAL', W / 2, fy + (narrow ? 28 : 36));
    ctx.shadowBlur = 0;

    // Lore count
    const count = this.player ? this.player.loreRead.size : 0;
    ctx.fillStyle = '#886622';
    ctx.font = `${narrow ? 9 : 11}px monospace`;
    ctx.fillText('ENTRIES RECOVERED: ' + count, W / 2, fy + (narrow ? 44 : 56));

    // Word-wrapped lore text
    ctx.fillStyle = '#ddc888';
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
      ctx.fillText(lines[i], textX, textStartY + i * lineH);
    }

    // Close hint
    ctx.textAlign = 'center';
    ctx.fillStyle = '#887744';
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
    for (let x=0;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for (let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
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
    let statsLine = `Floor ${r.floor||this.floor}  •  Score ${r.score||this.player.score}  •  Lv ${r.level||this.player.level}`;
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
        const [src, dmg] = entries[i];
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
    ctx.fillText(`Floors Cleared: 10`,W/2, y); y += narrow ? 22 : 26;
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

// ─── Main Loop ────────────────────────────────────────────────────────────────
let lastTime=0;
function loop(ts) {
  const dt=Math.min((ts-lastTime)/1000,0.05);
  lastTime=ts;
  game.update(dt);
  music.tick();
  game.render();
  clearJust();
  requestAnimationFrame(loop);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
resize();
updateBtns();
mouse.x = W/2; mouse.y = H/2;
window.addEventListener('resize', () => { resize(); updateBtns(); resetTouch(); mouse.x = W/2; mouse.y = H/2; });
game.state='MENU';
game.menuParticles=[];
requestAnimationFrame(loop);
