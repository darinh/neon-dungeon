'use strict';

// ─── Enemies ─────────────────────────────────────────────────────────────────
let enemies = [];
let items   = [];
let hazardZones = [];

const CREDIT_VALUES = {GUARD:8, TURRET:6, CRAWLER:4, PHANTOM:12, DRONE:5, SHIELDER:10, GRENADIER:7, SPLITTER:9, TELEPORTER:8, SNIPER:10, SHARD:0, SENTINEL:80, WARDEN:80, HIVE:120, CONDUCTOR:120, OMEGA:200, GENESIS:200};
const SOURCE_LABELS = {
  GUARD:'Guard', TURRET:'Turret', CRAWLER:'Crawler', PHANTOM:'Phantom',
  DRONE:'Drone', SHIELDER:'Shielder', GRENADIER:'Grenadier', SPLITTER:'Splitter',
  TELEPORTER:'Teleporter', SNIPER:'Sniper', SHARD:'Shard', SENTINEL:'Sentinel Mk-I',
  WARDEN:'Warden', HIVE:'Neural Hive', CONDUCTOR:'Conductor', OMEGA:'Omega Core', GENESIS:'Genesis Protocol',
  'Spike Trap':'Spike Trap', 'Plasma':'Plasma', 'Arc Grid':'Arc Grid',
  'Grenade':'Grenade', 'Volatile':'Volatile', 'Void Orb':'Void Orb', 'Warden Slam':'Warden Slam',
  'Conductor Field':'Conductor Field', 'Conductor Pulse':'Conductor Pulse',
  'Genesis Lance':'Genesis Lance', 'Genesis Field':'Genesis Field', 'Genesis Purge':'Genesis Purge',
  'Nano Swarm':'Nano Swarm', 'Static Field':'Static Field',
};
const SOURCE_COLOURS = {
  GUARD:'#ff3333', TURRET:'#ffb700', CRAWLER:'#39ff14', PHANTOM:'#cc00ff',
  DRONE:'#00aaff', SHIELDER:'#66eeff', GRENADIER:'#ff6622', SPLITTER:'#00ff88',
  TELEPORTER:'#ff44ff', SNIPER:'#ff2266', SHARD:'#00cc66', SENTINEL:'#ff4444',
  WARDEN:'#ff8800', HIVE:'#aa00ff', CONDUCTOR:'#00ccff', OMEGA:'#ff00c8', GENESIS:'#ffcc00',
  'Spike Trap':'#ff6644', 'Plasma':'#ff8800', 'Arc Grid':'#44ccff',
  'Grenade':'#ff6622', 'Volatile':'#ff4422', 'Void Orb':'#aa00ff', 'Warden Slam':'#ff8800',
  'Conductor Field':'#00ccff', 'Conductor Pulse':'#00ccff',
  'Genesis Lance':'#ffcc00', 'Genesis Field':'#ffcc00', 'Genesis Purge':'#ffcc00',
  'Nano Swarm':'#44ff88', 'Static Field':'#44ccff',
};
function sourceLabel(s) { return SOURCE_LABELS[s] || s; }
function sourceColour(s) { return SOURCE_COLOURS[s] || '#aaaacc'; }
const BOSS_NAMES = {SENTINEL:'SENTINEL MK-I',WARDEN:'WARDEN',HIVE:'NEURAL HIVE',CONDUCTOR:'CONDUCTOR',OMEGA:'OMEGA CORE',GENESIS:'GENESIS PROTOCOL'};
// Phase transition thresholds as hpPct values (descending); absolute-HP bosses computed at draw time
const BOSS_PHASE_MARKS = {
  SENTINEL: null, // absolute: [100/maxHp]
  WARDEN:   [0.4],
  HIVE:     null, // absolute: [350/maxHp, 150/maxHp]
  CONDUCTOR:[0.55, 0.25],
  OMEGA:    [0.7, 0.4, 0.2],
  GENESIS:  [0.7, 0.35],
};
function getBossPhaseMarks(boss) {
  const fixed = BOSS_PHASE_MARKS[boss.type];
  if (fixed) return fixed;
  if (boss.type === 'SENTINEL') return [100 / boss.maxHp];
  if (boss.type === 'HIVE') return [350 / boss.maxHp, 150 / boss.maxHp];
  return [];
}
let pendingEnemySpawns = [];

// ─── Weapon Affix Effect Application ─────────────────────────────────────────
// Called on every weapon hit (projectile or melee). hitCtx = {name, affixes, effects, isProc}
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
      if (game.player) {
        game.player.hp = Math.min(game.player.maxHp, game.player.hp + heal);
        spawnDmgText(game.player.x, game.player.y, '+' + heal, '#ff0066');
      }
    } else if (eff === 'chain') {
      if (Math.random() < 0.20) {
        // Find nearest alive enemy within 3 tiles
        let best = null, bestD = 3;
        for (const e of enemies) {
          if (e === enemy || e.dead) continue;
          const d = dist(enemy.x, enemy.y, e.x, e.y);
          if (d < bestD) { bestD = d; best = e; }
        }
        if (best) {
          const chainDmg = Math.round(actualDmg * 0.5);
          best.takeDamage(chainDmg, { name: hitCtx.name, isProc: true });
          // Visual: lightning bolt stored for rendering
          if (!game._chainBolts) game._chainBolts = [];
          game._chainBolts.push({ x1:enemy.x, y1:enemy.y, x2:best.x, y2:best.y, timer:0.15, colour:'#ffff44' });
          audio.hit(false, 'Railgun'); // zap sound
        }
      }
    }
    // 'explode' is handled in applyOnKill
  }
}

// Called when an enemy dies — checks for on-kill affix effects
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
    if (dist(e.x, e.y, enemy.x, enemy.y) < aoeR && hasLOS(enemy.x, enemy.y, e.x, e.y, game.dungeon.map)) {
      e.takeDamage(aoeDmg, { name: 'Detonation', isProc: true });
    }
  }
  // Also damage player if in range
  const p = game.player;
  if (p && dist(p.x, p.y, enemy.x, enemy.y) < aoeR && hasLOS(enemy.x, enemy.y, p.x, p.y, game.dungeon.map)) {
    p.takeDamage(Math.round(aoeDmg * 0.5), 'Detonation');
  }
}

// Tick enemy status effects (called in update loop per enemy)
function tickEnemyStatusEffects(enemy, dt) {
  // Burn
  if (enemy.burnTimer > 0) {
    enemy.burnTimer -= dt;
    // PHASING: burn timer ticks but deals no damage during immune window
    if (!enemy.phaseImmune) {
      let dmg = enemy.burnDps * dt;
      // SHIELDED: burn resets regen delay and damages shield first
      if (enemy.eliteAffix === 'SHIELDED') enemy.shieldRegenDelay = 0;
      if (enemy.shieldHp > 0) {
        const absorbed = Math.min(enemy.shieldHp, dmg);
        enemy.shieldHp -= absorbed;
        dmg -= absorbed;
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
}

// Tick elite affix behaviours (called per enemy per frame)
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
}


class Enemy {
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
    // Weapon affix status effects
    this.burnTimer=0; this.burnDps=0;
    this.slowTimer=0; this.slowFactor=1;  // 1 = normal speed
    this.stunTimer=0;                     // hackware EMP stun duration
    this._lastHitCtx=null;                // weapon context of last hit (for on-kill effects)
  }

  takeDamage(dmg, hitCtx) {
    if (this.dead) return 0;
    // PHASING elite affix: immune during phase window
    if (this.phaseImmune) {
      spawnDmgText(this.x, this.y, 'PHASE', '#cc88ff');
      return 0;
    }
    if (this.type==='PHANTOM' && !this.visible) { this.visible=true; }
    // SHIELDED: any hit resets shield regen delay
    if (this.eliteAffix === 'SHIELDED') this.shieldRegenDelay = 0;
    // SHIELDED elite affix: absorb with shield first
    if (this.shieldHp > 0) {
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
    const actual = Math.min(this.hp, dmg);
    this.hp -= dmg;
    this.flashTimer = 0.1;
    spawnDmgText(this.x, this.y, dmg, this.hp <= 0 ? '#ffcc00' : '#ffffff');
    // Normalize hitCtx — accept string (legacy) or object
    const ctx = typeof hitCtx === 'string' ? { name:hitCtx } : (hitCtx || {});
    this._lastHitCtx = ctx;
    // Apply weapon affix on-hit effects (procs don't re-proc)
    if (!ctx.isProc) applyHitEffects(this, actual, ctx);
    if (this.hp<=0) { this.hp=0; this.die(); }
    else { const wn = ctx.name || null; audio.hit(false, wn); }
    return actual;
  }

  die() {
    this.dead=true;
    game.enemyDiedThisFrame=true;
    audio.death();
    spawnParticles(this.x,this.y,'EXPLOSION',this.colour,12);
    // Weapon affix on-kill effects (before drops/scoring)
    applyOnKill(this);
    const d=getDiff();
    const dropRate = game.modifier === 'FORTIFIED' ? d.itemDrop * 1.3 : d.itemDrop;
    if (!this.isShard && Math.random()<dropRate) items.push(new Item(this.x,this.y));
    game.player.gainXP(Math.round(this.xpValue*d.xpMul));
    // Combo: SHARDs and VOLATILE chain kills don't build streak
    const comboEligible = !this.isShard && !this._volatileKill;
    if (comboEligible) registerKill(this.isBoss);
    const mul = this.isBoss ? comboBossMultiplier() : comboMultiplier();
    game.player.score += Math.round(this.xpValue * game.floor * mul);
    if (game.quest && game.quest.kills !== undefined) game.quest.kills++;
    if (!this.isShard) game.player.enemiesKilled++;
    const baseCr = CREDIT_VALUES[this.type] || 5;
    const creditSiphonMul = hasAugment('CREDIT_SIPHON') ? 1.5 : 1;
    const cr = Math.round(baseCr * (1 + game.floor * 0.15) * getMetaCreditMultiplier() * d.creditMul * creditSiphonMul);
    game.player.credits += cr;
    if (this.isBoss) game.bossesCleared++;
    // Vampiric perk: heal on kill
    if (game.player.perks.VAMPIRIC && !this.isShard) {
      const heal = 2;
      game.player.hp = Math.min(game.player.maxHp, game.player.hp + heal);
      spawnDmgText(game.player.x, game.player.y, '+'+heal, '#ff3366');
    }
    // SCAVENGER_NANITES augment: 10% kill chance to heal 5 HP
    if (hasAugment('SCAVENGER_NANITES') && !this.isShard && Math.random() < 0.10) {
      game.player.hp = Math.min(game.player.maxHp, game.player.hp + 5);
      spawnDmgText(game.player.x, game.player.y, '+5', '#88ff44');
    }
    // ADRENALINE_INJECTOR augment: +30% speed for 2s on kill
    if (hasAugment('ADRENALINE_INJECTOR') && !this.isShard) {
      game.player.adrenalineTimer = 2;
    }
    // Death explosion: VOLATILE modifier and/or EXPLOSIVE_KILLS perk (shared helper, non-stacking)
    const wantExplosion = (game.modifier === 'VOLATILE' || game.player.perks.EXPLOSIVE_KILLS) && !this.isBoss && !this._volatileKill;
    if (wantExplosion) {
      const bothActive = game.modifier === 'VOLATILE' && game.player.perks.EXPLOSIVE_KILLS;
      const vr = bothActive ? 2.5 : 2;
      const vdmg = (bothActive ? 20 : 15) + game.floor * 2;
      const col = game.modifier === 'VOLATILE' ? '#ff4422' : '#ff6600';
      spawnParticles(this.x, this.y, 'EXPLOSION', col, 18);
      triggerShake(6, 0.2);
      const p = game.player;
      // VOLATILE hurts the player; perk-only does not
      if (game.modifier === 'VOLATILE' && dist(p.x, p.y, this.x, this.y) < vr && hasLOS(this.x, this.y, p.x, p.y, game.dungeon.map)) {
        p.takeDamage(vdmg, 'Volatile');
      }
      for (const e of enemies) {
        if (e === this || e.dead) continue;
        if (dist(e.x, e.y, this.x, this.y) < vr && hasLOS(this.x, this.y, e.x, e.y, game.dungeon.map)) {
          e._volatileKill = true;
          e.takeDamage(vdmg, game.modifier === 'VOLATILE' ? 'Volatile' : 'Explosion');
          if (!e.dead) e._volatileKill = false;
        }
      }
    }
    // SPLITTER: queue 2 SHARDs (deferred to avoid same-frame hits)
    if (this.type === 'SPLITTER') {
      audio.enemySplit();
      spawnParticles(this.x, this.y, 'EXPLOSION', '#00ff88', 15);
      const map = game.dungeon.map;
      for (let s = 0; s < 2; s++) {
        let sx = this.x + rnd(-1, 1), sy = this.y + rnd(-1, 1);
        const fx = Math.floor(sx), fy = Math.floor(sy);
        if (fx < 0 || fy < 0 || fx >= MAP_W || fy >= MAP_H || !isPassable(map[fy][fx])) {
          sx = this.x; sy = this.y;
        }
        pendingEnemySpawns.push({ type: 'SHARD', x: sx, y: sy, floor: game.floor, room: this.room, _challengeWave: !!this._challengeWave });
      }
    }
  }

  update(dt, player, map) {
    if (this.dead) return;
    this.bobAngle+=dt*3;
    this.flashTimer=Math.max(0,this.flashTimer-dt);

    // Stun: freeze AI + cooldown timers while stunned
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      // Cancel sniper charge on stun — don't let it resume after stun ends
      if (this._laserTimer > 0) { this._laserTimer = 0; this._laserTarget = null; this._sniperCooldown = 0.8; }
      if (this._chargeState && this._chargeState !== 'idle') { this._chargeState = 'idle'; this._chargeDur = 0; this.bossTimers.charge = 1.5; }
      if (this._lanceTelegraph > 0) { this._lanceTelegraph = 0; this._lanceLock = null; }
      if (Math.random() < dt * 6) spawnParticles(this.x, this.y, 'SPARK', '#00ddff', 1);
      return; // skip all AI, leave attack/shoot timers frozen
    }

    this.attackTimer=Math.max(0,this.attackTimer-dt);
    this.shootTimer =Math.max(0,this.shootTimer-dt);
    this.spawnCooldown=Math.max(0,this.spawnCooldown-dt);

    const d = dist(this.x,this.y,player.x,player.y);
    // Cloak: enemies lose LOS when player is cloaked
    const targetable = canTargetPlayer();
    const los = targetable && d<15 && hasLOS(this.x,this.y,player.x,player.y,map);

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
      case 'SHARD':    this.aiShard(dt,player,map,d,los);   break;
      case 'SENTINEL': this.aiBossSentinel(dt,player,map,d,los); break;
      case 'WARDEN':   this.aiBossWarden(dt,player,map,d,los);   break;
      case 'HIVE':     this.aiBossHive(dt,player,map,d,los);     break;
      case 'CONDUCTOR':this.aiBossConductor(dt,player,map,d,los);break;
      case 'OMEGA':    this.aiBossOmega(dt,player,map,d,los);    break;
      case 'GENESIS':  this.aiBossGenesis(dt,player,map,d,los);  break;
    }
  }

  // BERSERKER elite affix: multiplier scales with missing HP (1.0 → 1.5)
  berserkerMul() {
    if (this.eliteAffix !== 'BERSERKER') return 1;
    return 1 + 0.5 * (1 - this.hp / this.maxHp);
  }

  moveToward(tx,ty,spd,dt,map,ignoreWalls) {
    spd = modSpeed(spd) * this.slowFactor * this.berserkerMul() * (hasAugment('TEMPORAL_DILATION') ? 0.85 : 1);
    let [dx,dy]=norm(tx-this.x,ty-this.y);
    const nx=this.x+dx*spd*dt, ny=this.y+dy*spd*dt;
    if (ignoreWalls) { this.x=nx; this.y=ny; return; }
    const fx=Math.floor(nx), fy=Math.floor(this.y);
    const xf=Math.floor(this.x), yf=Math.floor(ny);
    if (fx>=0&&fy>=0&&fx<MAP_W&&fy<MAP_H && isPassable(map[fy][fx])) this.x=nx;
    if (xf>=0&&yf>=0&&xf<MAP_W&&yf<MAP_H && isPassable(map[yf][xf])) this.y=ny;
  }

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

  meleeAttack(player) {
    if (this.attackTimer<=0 && canTargetPlayer()) {
      player.takeDamage(this.atk, this.type);
      const baseCd = game.modifier==='OVERCLOCK' ? 0.83 : 1.0;
      this.attackTimer = baseCd / this.berserkerMul();
      spawnParticles(player.x,player.y,'SPARK','#ff4444',5);
    }
  }

  fireAt(px,py,spd,dmg,range,colour) {
    const [dx,dy]=norm(px-this.x,py-this.y);
    const p=new Projectile(this.x,this.y,dx,dy,spd,dmg,range,colour,false,false);
    p.ownerType=this.type;
    projectiles.push(p);
    audio.shoot(false);
  }

  aiGuard(dt,player,map,d,los) {
    const detectRange = 10 + (game.floor || 1) * 0.4;
    if (los && d<detectRange) { this.state='CHASE'; }
    else if (d>detectRange+2) { this.state='PATROL'; }
    if (this.state==='PATROL') this.patrol(dt,map);
    else {
      this.moveToward(player.x,player.y,this.spd,dt,map);
      if (d<1.2) this.meleeAttack(player);
    }
  }

  aiTurret(dt,player,map,d,los) {
    const cooldown = Math.max(1.0, 2.0 - (game.floor || 1) * 0.11) / (game.modifier==='OVERCLOCK'?1.2:1);
    if (los && d<12 && this.shootTimer<=0) {
      this.fireAt(player.x,player.y,8,this.atk,13,'#ffb700');
      this.shootTimer=cooldown / this.berserkerMul();
    }
  }

  aiCrawler(dt,player,map,d,los) {
    if (los||(d<8 && canTargetPlayer())) {
      this.zigzag+=dt*5;
      const [dx,dy]=norm(player.x-this.x,player.y-this.y);
      const perp={x:-dy,y:dx};
      const tx=player.x+perp.x*Math.sin(this.zigzag)*1.5;
      const ty=player.y+perp.y*Math.sin(this.zigzag)*1.5;
      this.moveToward(tx,ty,this.spd,dt,map);
      if (d<1.2) this.meleeAttack(player);
    } else this.patrol(dt,map);
  }

  aiPhantom(dt,player,map,d,los) {
    this.teleportTimer=Math.max(0,this.teleportTimer-dt);
    if (d>3 || !canTargetPlayer()) {
      this.visible=false;
      if (this.teleportTimer<=0 && this.room) {
        this.x=this.room.x+rnd(1,this.room.w-1);
        this.y=this.room.y+rnd(1,this.room.h-1);
        this.teleportTimer=4;
      }
    } else {
      this.visible=true;
      this.moveToward(player.x,player.y,this.spd,dt,map);
      if (d<1.2) this.meleeAttack(player);
    }
  }

  aiDrone(dt,player,map,d,los) {
    const cooldown = Math.max(0.9, 1.5 - (game.floor || 1) * 0.07) / (game.modifier==='OVERCLOCK'?1.2:1);
    if (d<15 && canTargetPlayer()) {
      // Drones respect walls when boss room is sealed
      const canPhase = !game.bossSealed && !game.challengeSealed;
      this.moveToward(player.x,player.y,this.spd,dt,map,canPhase);
      if (this.shootTimer<=0) {
        this.fireAt(player.x,player.y,7,this.atk,16,'#00aaff');
        this.shootTimer=cooldown / this.berserkerMul();
      }
    }
  }

  aiShielder(dt,player,map,d,los) {
    // Only update facing when player is visible (prevents wall-hack orientation)
    if (los) this.shieldAngle = Math.atan2(player.y - this.y, player.x - this.x);
    if (los && d < 12) {
      this.state = 'CHASE';
      this.moveToward(player.x, player.y, this.spd, dt, map);
      if (d < 1.2) this.meleeAttack(player);
    } else {
      this.state = 'PATROL';
      this.patrol(dt, map);
    }
  }

  blocksProjectile(proj) {
    // 120° frontal arc shield — blocks player projectiles (not piercing/orbitals)
    if (this.type !== 'SHIELDER' || this.dead) return false;
    // Use reversed projectile direction (where it's coming FROM)
    const incomingAngle = Math.atan2(-proj.dy, -proj.dx);
    let diff = incomingAngle - this.shieldAngle;
    while (diff > Math.PI) diff -= TWO_PI;
    while (diff < -Math.PI) diff += TWO_PI;
    return Math.abs(diff) < Math.PI / 3;
  }

  aiGrenadier(dt,player,map,d,los) {
    this.grenadeTimer = Math.max(0, this.grenadeTimer - dt);
    const bm = this.berserkerMul();
    if (los && d < 5) {
      // Too close — retreat
      const [dx, dy] = norm(this.x - player.x, this.y - player.y);
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
        this.lobGrenade(player.x, player.y, map);
        this.grenadeTimer = Math.max(2.5, 3.5 - (game.floor || 1) * 0.1) / (game.modifier==='OVERCLOCK'?1.2:1) / bm;
      }
    } else if (d > 12 && los) {
      this.moveToward(player.x, player.y, this.spd * 0.7, dt, map);
    } else {
      this.patrol(dt, map);
    }
  }

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

  aiSplitter(dt,player,map,d,los) {
    const speedMul = this.hp < this.maxHp * 0.3 ? 1.3 : 1;
    if (los && d < 10) {
      this.state = 'CHASE';
      this.moveToward(player.x, player.y, this.spd * speedMul, dt, map);
      if (d < 1.2) this.meleeAttack(player);
    } else {
      this.state = 'PATROL';
      this.patrol(dt, map);
    }
  }

  aiShard(dt,player,map,d,los) {
    if (los || (d < 8 && canTargetPlayer())) {
      this.zigzag += dt * 6;
      const [dx, dy] = norm(player.x - this.x, player.y - this.y);
      const perp = { x: -dy, y: dx };
      const tx = player.x + perp.x * Math.sin(this.zigzag) * 1.2;
      const ty = player.y + perp.y * Math.sin(this.zigzag) * 1.2;
      this.moveToward(tx, ty, this.spd, dt, map);
      if (d < 1.2) this.meleeAttack(player);
    } else this.patrol(dt, map);
  }

  aiTeleporter(dt,player,map,d,los) {
    this.teleportTimer = Math.max(0, this.teleportTimer - dt);
    if (this._materialize > 0) this._materialize -= dt;
    if (this._warpFade > 0) this._warpFade -= dt * 1.5;

    // Emergency blink if player gets close (skip if just teleported or player cloaked)
    if (d < 2 && canTargetPlayer() && this.teleportTimer > 0.8 && this._materialize <= 0) this.teleportTimer = 0;

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
      const cd = Math.max(2.0, 3.0 - (game.floor || 1) * 0.1) / (game.modifier === 'OVERCLOCK' ? 1.2 : 1);
      this.teleportTimer = cd;
      this._materialize = 0.4;
      this._burstLeft = 2;
    }

    // Can't attack while materializing
    if (this._materialize > 0) return;

    // Fire burst at player
    if (this._burstLeft > 0 && los && this.shootTimer <= 0) {
      this.fireAt(player.x, player.y, 8, this.atk, 14, this.colour);
      this._burstLeft--;
      this.shootTimer = 0.25 / this.berserkerMul();
    }
  }

  aiSniper(dt,player,map,d,los) {
    this._sniperCooldown = Math.max(0, (this._sniperCooldown || 0) - dt);
    this._repositionTimer = Math.max(0, (this._repositionTimer || 0) - dt);

    // Room-gated: only aggro when player is inside this sniper's room
    const inRoom = this.room && player.x >= this.room.x && player.x < this.room.x + this.room.w &&
                   player.y >= this.room.y && player.y < this.room.y + this.room.h;

    // Cancel charge conditions: lost LOS, player cloaked, stunned, or player fled room
    if (this._laserTimer > 0) {
      if (!los || !canTargetPlayer() || !inRoom || this.stunTimer > 0 || d < 3) {
        this._laserTimer = 0;
        this._laserTarget = null;
        this._sniperCooldown = 0.8; // post-cancel cooldown
        if (d < 3 && canTargetPlayer()) {
          // Flee if too close
          const [fx, fy] = norm(this.x - player.x, this.y - player.y);
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
        this._repositionTimer = 1.0 / this.berserkerMul() / (game.modifier === 'OVERCLOCK' ? 1.2 : 1);
        this._sniperCooldown = Math.max(2.5, 3.5 - (game.floor || 1) * 0.1) / this.berserkerMul() / (game.modifier === 'OVERCLOCK' ? 1.2 : 1);
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
            const dd = dist(nx, ny, player.x, player.y);
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
    if (inRoom && los && d < 15 && canTargetPlayer() && this._sniperCooldown <= 0) {
      // Lock on
      this._laserTarget = { x: player.x, y: player.y };
      this._laserTimer = 1.5;
      audio.sniperCharge();
    } else if (!inRoom || !los) {
      this.patrol(dt, map);
    }
    // If in room with LOS but on cooldown, hold position (menacing idle)
  }

  aiBossSentinel(dt,player,map,d,los) {
    if (this.hp<100) this.phase=2; else this.phase=1;
    if (this.phase!==this.prevPhase) {
      spawnParticles(this.x,this.y,'EXPLOSION',this.colour,20);
      audio.phaseShift();
      this.prevPhase=this.phase;
    }

    this.bossTimers.laser=(this.bossTimers.laser||0)-dt;
    this.bossTimers.move=(this.bossTimers.move||0)-dt;
    this.bossTimers.shield=(this.bossTimers.shield||0)-dt;

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

    if (this.phase===2 && this.bossTimers.shield<=0) {
      const [dx,dy]=norm(player.x-this.x,player.y-this.y);
      player.x-=dx*3; player.y-=dy*3;
      clampToBossRoom(player);
      player.takeDamage(Math.round(20*getDiff().enemyAtk), 'SENTINEL');
      spawnParticles(player.x,player.y,'EXPLOSION','#ff4444',8);
      this.bossTimers.shield=5;
    }
  }

  aiBossWarden(dt,player,map,d,los) {
    const hpPct = this.hp / this.maxHp;
    this.phase = hpPct <= 0.4 ? 2 : 1;

    if (this.phase !== this.prevPhase) {
      spawnParticles(this.x, this.y, 'EXPLOSION', this.colour, 20);
      audio.phaseShift();
      game.msg('⚠ WARDEN PHASE 2', '#ff8800');
      this.prevPhase = this.phase;
    }

    const T = this.bossTimers;
    T.charge = (T.charge || 0) - dt;
    T.slam   = (T.slam   || 0) - dt;
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
        player.x += kx * 2; player.y += ky * 2;
        clampToBossRoom(player);
        spawnParticles(player.x, player.y, 'SPARK', '#ff8800', 6);
        triggerShake(4, 0.15);
        this._chargeState = 'idle';
        T.charge = this.phase === 2 ? 2.5 : 3.5;
      } else if (this._chargeDur <= 0) {
        // Charge ended without hitting — spark burst at endpoint
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TWO_PI;
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

    // Phase 2: Ground slam when player is close
    if (this.phase === 2 && T.slam <= 0 && d < 4 && this._chargeState === 'idle') {
      audio.wardenSlam();
      triggerShake(6, 0.2);
      const [kx, ky] = norm(player.x - this.x, player.y - this.y);
      player.x += kx * 3; player.y += ky * 3;
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

  aiBossHive(dt,player,map,d,los) {
    if (this.hp<150) this.phase=3;
    else if (this.hp<350) this.phase=2;
    else this.phase=1;

    if (this.phase!==this.prevPhase) {
      spawnParticles(this.x,this.y,'EXPLOSION',this.colour,20);
      audio.phaseShift();
      game.msg('⚠ HIVE PHASE '+this.phase,'#aa00ff');
      this.prevPhase=this.phase;
    }

    this.bossTimers.homing=(this.bossTimers.homing||0)-dt;
    this.bossTimers.spawn=(this.bossTimers.spawn||0)-dt;
    this.bossTimers.shock=(this.bossTimers.shock||0)-dt;
    this.bossTimers.move=(this.bossTimers.move||0)-dt;

    if (this.bossTimers.move<=0) {
      if (this.room) this.patrolTarget={x:this.room.x+rnd(2,this.room.w-2),y:this.room.y+rnd(2,this.room.h-2)};
      this.bossTimers.move=3;
    }
    if (this.patrolTarget) this.moveToward(this.patrolTarget.x,this.patrolTarget.y,1.5,dt,map);

    if (this.bossTimers.homing<=0) {
      const [dx,dy]=norm(player.x-this.x,player.y-this.y);
      // homing: just fires at player
      this.fireAt(player.x,player.y,6,this.atk,18,'#aa00ff');
      this.bossTimers.homing=2;
    }

    if (this.phase>=2 && this.bossTimers.spawn<=0 && this.spawnCooldown<=0) {
      for (let i=0;i<2;i++) {
        const cr=spawnEnemy('CRAWLER',this.x+rnd(-2,2),this.y+rnd(-2,2),game.floor,this.room,false);
        enemies.push(cr);
      }
      this.bossTimers.spawn=5;
      this.spawnCooldown=1;
    }

    if (this.phase===3 && this.bossTimers.shock<=0) {
      if (dist(game.player.x,game.player.y,this.x,this.y)<8) {
        game.player.takeDamage(Math.round(25*getDiff().enemyAtk), 'HIVE');
        spawnParticles(this.x,this.y,'EXPLOSION','#aa00ff',15);
      }
      this.bossTimers.shock=4;
    }
  }

  aiBossConductor(dt,player,map,d,los) {
    const hpPct = this.hp / this.maxHp;
    this.phase = hpPct <= 0.25 ? 3 : hpPct <= 0.55 ? 2 : 1;

    if (this.phase !== this.prevPhase) {
      spawnParticles(this.x, this.y, 'EXPLOSION', this.colour, 20);
      audio.phaseShift();
      game.msg('⚠ CONDUCTOR PHASE ' + this.phase, '#00ccff');
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
            player.x += kx * 2.5; player.y += ky * 2.5;
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
      game.msg('⚠ OMEGA PHASE ' + this.phase, '#ff00c8');
      this.prevPhase = this.phase;
    }

    const spd = [1, 1.2, 1.5, 2][this.phase - 1];
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
      const activeAdds = enemies.filter(e => !e.dead && !e.isBoss && e.room === this.room).length;
      if (activeAdds < 8) {
        const addType = Math.random() < 0.6 ? 'CRAWLER' : 'DRONE';
        const count = Math.min(this.phase >= 4 ? 3 : 2, 8 - activeAdds);
        for (let i = 0; i < count; i++) {
          const add = spawnEnemy(addType, this.x + rnd(-3, 3), this.y + rnd(-3, 3), game.floor, this.room, false);
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
        player.x += kx * 3;
        player.y += ky * 3;
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

  aiBossGenesis(dt,player,map,d,los) {
    const hpPct = this.hp / this.maxHp;
    const newPhase = hpPct <= 0.35 ? 3 : hpPct <= 0.7 ? 2 : 1;
    if (newPhase !== this.phase) {
      this.phase = newPhase;
      spawnParticles(this.x, this.y, 'EXPLOSION', this.colour, 22);
      audio.phaseShift();
      game.msg('⚠ GENESIS PHASE ' + this.phase, '#ffcc00');
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
        let hx, hy, attempts = 0, valid = false;
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

  draw(camX,camY) {
    if (this.dead) return;
    // FOV gating: only draw enemies the player can currently see
    const etx = Math.floor(this.x), ety = Math.floor(this.y);
    if (!game.dungeon?.visible?.[ety]?.[etx]) return;
    const sx=this.x*TILE-camX, sy=this.y*TILE-camY;
    if (sx<-40||sx>W+40||sy<-40||sy>H+40) return;

    let alpha=1;
    if (this.type==='PHANTOM' && !this.visible) alpha=0.08;
    if (this.type==='TELEPORTER') alpha = this._materialize > 0 ? 0.3 + (1 - this._materialize / 0.4) * 0.4 : 0.7 + Math.sin(this.bobAngle * 8) * 0.3;

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
          ctx.beginPath();
          ctx.arc(ox, oy, r, 0, TWO_PI);
          ctx.fill();
          // Ring edge
          ctx.globalAlpha = fade * 0.7;
          ctx.strokeStyle = '#ff00c8';
          ctx.lineWidth = 2;
          ctx.stroke();
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
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
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
          ctx.beginPath();
          ctx.arc(sx, sy, 24, a1, a2);
          ctx.stroke();
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
          ctx.beginPath();
          ctx.arc(sx, sy, 30, 0, TWO_PI);
          ctx.fill();
          ctx.restore();
        }
      }

      // GENESIS: lance telegraph line + rotating hex ring
      if (this.type === 'GENESIS') {
        // Rotating hexagonal ring (always visible)
        ctx.save();
        const hexSpin = (this._spiralSpin || 0) + Date.now() * 0.002;
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = '#ffcc00';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ffcc00';
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
          ctx.strokeStyle = '#ffe066';
          ctx.shadowBlur = 8 + progress * 12;
          ctx.shadowColor = '#ffe066';
          ctx.lineWidth = 1 + progress * 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(tx, ty);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      }

      const sz=(this.type==='OMEGA'||this.type==='GENESIS')?22:18;
      ctx.beginPath();
      ctx.arc(sx,sy,sz,0,TWO_PI);
      ctx.fill();
      // boss HP shown in cinematic HUD bar (drawBossBar), not overhead
    } else {
      const sz=TILE*(this.isShard?0.25:0.4);
      ctx.fillRect(sx-sz/2, sy-sz/2, sz, sz);
      // Shielder: draw 120° shield arc facing the player
      if (this.type === 'SHIELDER') {
        ctx.save();
        ctx.strokeStyle = '#66eeff';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#66eeff';
        ctx.globalAlpha = 0.7 + Math.sin(this.bobAngle * 2) * 0.15;
        const shieldR = sz * 1.2;
        ctx.beginPath();
        ctx.arc(sx, sy, shieldR, this.shieldAngle - Math.PI / 3, this.shieldAngle + Math.PI / 3);
        ctx.stroke();
        ctx.restore();
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
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(lx, ly);
          ctx.stroke();
          // Target dot
          ctx.globalAlpha = 0.3 + progress * 0.5;
          ctx.setLineDash([]);
          ctx.fillStyle = '#ff2266';
          ctx.beginPath();
          ctx.arc(lx, ly, 3 + progress * 2, 0, TWO_PI);
          ctx.fill();
          ctx.restore();
        } else {
          // Idle scope glint
          ctx.save();
          ctx.globalAlpha = 0.25 + Math.sin(this.bobAngle * 3) * 0.1;
          ctx.fillStyle = '#ff2266';
          ctx.shadowBlur = 6;
          ctx.shadowColor = '#ff2266';
          ctx.beginPath();
          ctx.arc(sx, sy - sz * 0.6, 1.5, 0, TWO_PI);
          ctx.fill();
          ctx.restore();
        }
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
        ctx.beginPath();
        ctx.arc(sx, sy, sz * 1.3, 0, TWO_PI * sFrac);
        ctx.stroke();
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
          ctx.beginPath();
          ctx.arc(sx, sy, sz * (1.0 + rage * 0.4), 0, TWO_PI);
          ctx.fill();
          ctx.restore();
        }
      }
      // PHASING affix: ghost flicker during immune window
      if (this.eliteAffix === 'PHASING' && this.phaseImmune) {
        ctx.globalAlpha = 0.15 + Math.sin(this.bobAngle * 12) * 0.1;
      }
      // small hp bar
      if (this.hp<this.maxHp || this.shieldHp > 0) {
        ctx.shadowBlur=0;
        const barW = 16, barH = 2, barY = sy - 12;
        ctx.fillStyle='#333';
        ctx.fillRect(sx-barW/2, barY, barW, barH);
        // HP portion
        const hpCol = this.elite ? '#ffffff' : this.colour;
        ctx.fillStyle=hpCol;
        ctx.fillRect(sx-barW/2, barY, barW*(this.hp/this.maxHp), barH);
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
      ctx.beginPath();
      ctx.arc(sx, sy, bsz * 0.7, 0, TWO_PI);
      ctx.fill();
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
      ctx.beginPath();
      ctx.arc(sx, sy, fsz * 0.8, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
}

// ─── Enemy Weights & Spawning ─────────────────────────────────────────────────
const ENEMY_WEIGHTS = {
  GUARD:    { base: 40, perFloor: -3 },   // common early, fades
  TURRET:   { base: 20, perFloor: 1 },    // steady
  CRAWLER:  { base: 10, perFloor: 3 },    // ramps up mid-game
  PHANTOM:  { base: 5,  perFloor: 4 },    // late-game threat
  DRONE:    { base: 5,  perFloor: 3 },    // late-game ranged
  SHIELDER: { base: 3,  perFloor: 2, minFloor: 3 },  // mid-game tank
  SPLITTER: { base: 2,  perFloor: 2, minFloor: 4 },  // splits into SHARDs on death
  GRENADIER:  { base: 1,  perFloor: 2, minFloor: 5 },  // late-game zone denial
  TELEPORTER: { base: 1,  perFloor: 2, minFloor: 6 },  // deep-floor blinker
  SNIPER:     { base: 1,  perFloor: 2, minFloor: 7 },  // glass-cannon laser sight
};
const ENEMY_TYPES_LIST = Object.keys(ENEMY_WEIGHTS);

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

function spawnEnemy(type,x,y,floorNum,room,allowElite) {
  const scale=1+0.15*(floorNum-1);
  const d=getDiff();
  let hp,atk,spd,xpVal,colour;
  switch(type) {
    case 'GUARD':   hp=40;  atk=8;  spd=2;   xpVal=20; colour='#ff3333'; break;
    case 'TURRET':  hp=25;  atk=12; spd=0;   xpVal=15; colour='#ffb700'; break;
    case 'CRAWLER': hp=20;  atk=6;  spd=4;   xpVal=10; colour='#39ff14'; break;
    case 'PHANTOM': hp=35;  atk=10; spd=2.5; xpVal=30; colour='#cc00ff'; break;
    case 'DRONE':   hp=15;  atk=8;  spd=3;   xpVal=12; colour='#00aaff'; break;
    case 'SHIELDER':hp=50;  atk=10; spd=1.5; xpVal=25; colour='#66eeff'; break;
    case 'GRENADIER':hp=30; atk=10; spd=2;   xpVal=20; colour='#ff6622'; break;
    case 'SPLITTER':hp=40;  atk=8;  spd=2.2; xpVal=25; colour='#00ff88'; break;
    case 'TELEPORTER':hp=25;atk=12; spd=0;   xpVal=22; colour='#ff44ff'; break;
    case 'SNIPER':   hp=20;atk=15; spd=2.5; xpVal=25; colour='#ff2266'; break;
    case 'SHARD':   hp=15;  atk=5;  spd=3.5; xpVal=8;  colour='#00cc66'; break;
    case 'SENTINEL':hp=300; atk=15; spd=1.5; xpVal=200;colour='#ff4444'; break;
    case 'WARDEN':  hp=330; atk=16; spd=1.8; xpVal=200;colour='#ff8800'; break;
    case 'HIVE':    hp=500; atk=18; spd=1.2; xpVal=350;colour='#aa00ff'; break;
    case 'CONDUCTOR':hp=520;atk=20; spd=1.4; xpVal=350;colour='#00ccff'; break;
    case 'OMEGA':   hp=1000;atk=22; spd=1.8; xpVal=800;colour='#ff00c8'; break;
    case 'GENESIS': hp=1000;atk=22; spd=1.0; xpVal=800;colour='#ffcc00'; break;
  }
  const isBoss = ['SENTINEL','WARDEN','HIVE','CONDUCTOR','OMEGA','GENESIS'].includes(type);
  // Floor modifier HP scaling (before construction so maxHp stays in sync)
  if (!isBoss) {
    if (game.modifier === 'SWARM')     hp = Math.round(hp * 0.6);
    if (game.modifier === 'FORTIFIED') hp = Math.round(hp * 1.4);
  }
  const e=new Enemy(x,y,
    Math.round(hp*scale*d.enemyHp), Math.round(atk*scale*d.enemyAtk),
    spd*d.enemySpd, xpVal, colour, type);
  e.room=room;
  e.isBoss=isBoss;
  e.elite=false;
  if (type==='PHANTOM') e.visible=false;
  if (type==='SHARD') { e.isShard=true; e.attackTimer=0.5; }
  if (type==='TELEPORTER') { e.teleportTimer=0.5; e._materialize=0; e._burstLeft=0; e._warpFade=0; e._warpFromX=x; e._warpFromY=y; }
  if (type==='SNIPER') { e._laserTimer=0; e._laserTarget=null; e._sniperCooldown=1.0; e._repositionTimer=0; e._repositionTarget=null; }
  if (type==='WARDEN') { e._chargeState='idle'; e._chargeDx=0; e._chargeDy=0; e._chargeWindup=0; e._chargeDur=0; }
  if (type==='CONDUCTOR') { e._arcSpin=0; e._dischargeChannel=0; }
  if (type==='GENESIS') { e._spiralSpin=0; e._lanceTelegraph=0; e._lanceLock=null;
    e.bossTimers = { spiral: 1.0, lance: 1.5, hazard: 2.0, purge: 4.0, move: 0.5 }; }
  if (isBoss) { e.maxHp=e.hp; }
  // Elite roll: difficulty-scaled chance on floor 3+, never on bosses or snipers
  if (allowElite !== false && !isBoss && type !== 'SNIPER' && floorNum >= 3 && Math.random() < d.eliteRate) {
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
  return e;
}

// ─── Player ───────────────────────────────────────────────────────────────────
class Player {
  constructor() { this.reset(); }
  reset() {
    this.x=5; this.y=5;
    this.hp=100; this.maxHp=100;
    this.atk=10; this.def=2; this.spd=3.5;
    this.level=1; this.xp=0;
    this.weapon=buildWeapon('PULSE_PISTOL', []);
    this.score=0;
    this.invincibleTimer=0;
    this.shootCooldown=0;
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
    this.upgrades={};       // persistent upgrade levels: {SAW_BLADE:2, ...}
    this.permSpeedBonus=0;  // from OVERCLOCK
    this.orbitalAngle=0;    // shared rotation for saw blades
    this.orbitalHits=new Map(); // enemy→cooldown for orbital damage
    this.spellTimers={plasmaOrb:2}; // cooldown timers for auto-spells
    this.perks={};              // level-unlocked passive abilities
    this.energyShield=false;    // active energy shield bubble
    this.energyShieldTimer=0;   // recharge countdown (30s)
    this.autoLaserTimer=0;      // auto-laser cooldown
    this.autoLaserBeam=null;    // {x1,y1,x2,y2,timer} for beam rendering
    this.credits=0;             // vendor currency
    this.loreRead=new Set();    // indices of lore entries read this run
    this.dashCooldown=0;        // cooldown remaining (1.5s max)
    this.dashTimer=0;           // time left in active dash
    this.dashDx=0;              // dash direction x
    this.dashDy=0;              // dash direction y
    this.dashTrail=[];          // afterimage positions [{x,y,alpha}]
    // Death recap tracking
    this.damageLog={};          // source → total damage taken
    this.killedBy='';           // source of killing blow
    this.enemiesKilled=0;       // total enemies killed this run
    this.hitsBlocked=0;         // energy shield blocks
    this.roomsCleared=0;        // rooms fully cleared of enemies
    this.eventsResolved=0;      // floor events completed
    // Hackware — active ability
    this.hackware=null;         // HACKWARE key or null
    this.hackwareCooldown=0;    // cooldown remaining
    this.cloakTimer=0;          // phase cloak duration remaining
    this.regenTimer=0;          // HP_REGEN perk timer
    this.secondWindUsed=false;  // SECOND_WIND: used this floor?
    // Augments — passive cybernetic implants
    this.augments={};           // owned augments: {NEURAL_LINK: true, ...}
    this.adrenalineTimer=0;     // ADRENALINE_INJECTOR speed buff timer
    this.reactiveArmorCD=0;     // REACTIVE_ARMOR cooldown
  }

  logDamage(source, amount) {
    this.damageLog[source] = (this.damageLog[source] || 0) + amount;
  }

  xpNeeded() { return this.level*80; }

  effectiveAtk() {
    let a = this.atk;
    if (this.perks.BERSERKER && this.hp / this.maxHp <= 0.25) a = Math.round(a * 1.4);
    return a;
  }

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
      game.msg('LEVEL UP! Now level '+this.level,'#00f5ff');
      if (PERK_LEVELS.includes(this.level)) {
        game.pendingPerkChoices.push(this.level);
      }
      if (this.level === 10) grantCapstone(this);
    }
    // Trigger perk choice UI after the loop (deferred so XP chips etc. resolve first)
    if (game.pendingPerkChoices.length && game.state === 'PLAYING') {
      game.openNextPerkChoice();
    }
  }

  takeDamage(dmg, source) {
    if (this.invincibleTimer>0) return;
    if (isPlayerDamageImmune()) return; // dash i-frames + phase cloak
    // Energy shield absorbs the hit
    if (this.energyShield && this.perks.ENERGY_SHIELD) {
      this.energyShield=false;
      this.energyShieldTimer=30;
      this.invincibleTimer=0.3;
      this.hitsBlocked++;
      audio.shieldBreak();
      spawnParticles(this.x,this.y,'EXPLOSION','#4488ff',12);
      spawnDmgText(this.x, this.y, 'BLOCK', '#4488ff');
      game.msg('🛡 SHIELD BROKEN','#4488ff');
      triggerShake(4, 0.15);
      return;
    }
    const titaniumReduction = hasAugment('TITANIUM_PLATING') ? 1 : 0;
    const actual=Math.max(1,dmg-this.def-titaniumReduction);
    this.hp=Math.max(0,this.hp-actual);
    const src = source || 'Unknown';
    this.logDamage(src, actual);
    this.invincibleTimer=0.5;
    this.flashTimer=0.2;
    spawnDmgText(this.x, this.y, actual, '#ff4444');
    triggerShake(Math.min(actual * 0.4, 8), 0.2);
    audio.hit(true);
    spawnParticles(this.x,this.y,'BLOOD','#ff4444',5);
    // REACTIVE_ARMOR augment: emit damage pulse on hit
    if (hasAugment('REACTIVE_ARMOR') && this.reactiveArmorCD <= 0) {
      this.reactiveArmorCD = 8;
      audio.reactiveArmor();
      const rRadius = 2.5;
      spawnParticles(this.x, this.y, 'EXPLOSION', '#ff6644', 14);
      const map = game.dungeon ? game.dungeon.map : null;
      for (const e of enemies) {
        if (e.dead) continue;
        if (dist(this.x, this.y, e.x, e.y) < rRadius && (!map || hasLOS(this.x, this.y, e.x, e.y, map))) {
          e.takeDamage(10 + game.floor * 2, 'Reactive Armor');
        }
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
        game.msg('💀 SECOND WIND!', '#00ddff');
        return;
      }
      this.killedBy=src; audio.gameOver(); game.endRun(false);
    }
  }

  shoot(aimX,aimY,map) {
    if (this.shootCooldown>0) return;
    const w=this.weapon;
    const [dx,dy]=norm(aimX-this.x,aimY-this.y);
    const hitCtx = { name:w.name, affixes:w._affixes||[], effects:w._effects||[] };

    if (w.melee) {
      // plasma sword arc
      const meleeCrit = this.perks.CRITICAL_HIT && Math.random() < 0.15;
      const meleeDmg = (w.dmg+this.effectiveAtk()) * (meleeCrit ? 2 : 1);
      spawnParticles(this.x+dx*1.5, this.y+dy*1.5,'EXPLOSION',w.colour,8);
      for (const e of enemies) {
        if (e.dead) continue;
        if (dist(this.x,this.y,e.x,e.y)<w.range) {
          e.takeDamage(meleeDmg, hitCtx);
          if (meleeCrit) spawnDmgText(e.x, e.y, 'CRIT!', '#ffdd00');
        }
      }
    } else {
      for (let i=0;i<w.count;i++) {
        const spread=(Math.random()-0.5)*(w.spread + (game.modifier==='SCRAMBLED' ? 0.15 : 0));
        const a=Math.atan2(dy,dx)+spread;
        const pdx=Math.cos(a), pdy=Math.sin(a);
        const isCrit = this.perks.CRITICAL_HIT && Math.random() < 0.15;
        const proj=new Projectile(
          this.x,this.y,pdx,pdy,12,(w.dmg+this.effectiveAtk())*(isCrit?2:1),w.range,
          w.colour,!!w.piercing,true,w.name
        );
        proj.isCrit = isCrit;
        proj._effects = w._effects || [];
        proj._affixes = w._affixes || [];
        if (this.perks.PIERCING_ROUNDS) proj.maxPierces+=1;
        proj.bouncesLeft=this.upgrades.RICOCHET||0;
        if (proj.bouncesLeft) proj._hasRicochet=true;
        projectiles.push(proj);
      }
      // MULTI_SHOT perk: fire a bonus 60%-damage projectile (ranged only)
      if (this.perks.MULTI_SHOT) {
        const offAngle = (Math.random() < 0.5 ? -1 : 1) * 0.14; // ~8°
        const a = Math.atan2(dy, dx) + offAngle;
        const pdx = Math.cos(a), pdy = Math.sin(a);
        const isCrit = this.perks.CRITICAL_HIT && Math.random() < 0.15;
        const bonusDmg = Math.round((w.dmg + this.effectiveAtk()) * 0.6 * (isCrit ? 2 : 1));
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
    }
    audio.shoot(true, w);
    this.shootCooldown = (1/w.rate) * (this.perks.RAPID_FIRE ? 0.85 : 1);
  }

  useVoidShard() {
    if (!this.shards) return;
    this.shards--;
    for (const e of enemies) {
      if (!e.dead && dist(this.x,this.y,e.x,e.y)<6) e.takeDamage(80, 'Void Cannon');
    }
    spawnParticles(this.x,this.y,'EXPLOSION','#aa00ff',30);
    game.msg('VOID SHARD DETONATED!','#aa00ff');
    triggerShake(10, 0.3);
  }

  update(dt,map) {
    this.invincibleTimer=Math.max(0,this.invincibleTimer-dt);
    this.shootCooldown=Math.max(0,this.shootCooldown-dt);
    this.flashTimer=Math.max(0,this.flashTimer-dt);
    this.levelFlash=Math.max(0,this.levelFlash-dt);
    this.dashCooldown=Math.max(0,this.dashCooldown-dt);
    // Hackware cooldown + cloak timer
    this.hackwareCooldown=Math.max(0,this.hackwareCooldown-dt);
    if (this.cloakTimer > 0) {
      this.cloakTimer -= dt;
      if (Math.random() < dt * 6) spawnParticles(this.x, this.y, 'MUZZLE', '#cc44ff', 1);
      if (this.cloakTimer <= 0) {
        this.cloakTimer = 0;
        audio.hackwareCloakEnd();
        spawnParticles(this.x, this.y, 'EXPLOSION', '#cc44ff', 8);
        game.msg('◇ CLOAK EXPIRED', '#886699');
      }
    }
    if (this.speedTimer>0) { this.speedTimer-=dt; if(this.speedTimer<=0)this.speedBoost=0; }
    // Augment timers
    if (this.adrenalineTimer > 0) this.adrenalineTimer = Math.max(0, this.adrenalineTimer - dt);
    if (this.reactiveArmorCD > 0) this.reactiveArmorCD = Math.max(0, this.reactiveArmorCD - dt);

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
        game.msg('🛡 SHIELD RESTORED','#4488ff');
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
    let mx=0,my=0;
    if (keys.has(km('up'))||keys.has(ALT_KEYS.up))       my=-1;
    if (keys.has(km('down'))||keys.has(ALT_KEYS.down))   my= 1;
    if (keys.has(km('left'))||keys.has(ALT_KEYS.left))   mx=-1;
    if (keys.has(km('right'))||keys.has(ALT_KEYS.right)) mx= 1;
    // touch joystick
    if (touch.joystick.active) { mx+=touch.joystick.dx; my+=touch.joystick.dy; }

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

    // void shard
    if (jp(km('voidshard'))) this.useVoidShard();
    if (jp(km('hackware'))) activateHackware(this);

    // dash activation
    if ((jp(km('dash'))||jp(ALT_KEYS.dash))&&this.dashCooldown<=0&&this.hp>0) {
      let dx, dy;
      if (mx||my) {
        [dx,dy]=norm(mx,my);
      } else {
        // Use current aim direction (facing may be stale by one frame)
        const cam=getCamera(this);
        const ax=(mouse.x+cam.x)/TILE-this.x, ay=(mouse.y+cam.y)/TILE-this.y;
        [dx,dy]=norm(ax,ay);
        if (!dx&&!dy) { dx=this.facing.x; dy=this.facing.y; }
      }
      this.dashDx=dx; this.dashDy=dy;
      this.dashTimer=0.12;
      this.dashCooldown = this.perks.DASH_MASTER ? 0.75 : 1.5;
      this.dashTrail.push({x:this.x,y:this.y,alpha:0.8});
      audio.dash();
      spawnParticles(this.x,this.y,'EXPLOSION','#ffb700',6);
    }
  }

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
      ctx.beginPath(); ctx.arc(gx,gy,7,0,TWO_PI); ctx.fill();
      ctx.restore();
    }

    // Laser sight (drawn under player so it originates from centre)
    if (this.perks.LASER_SIGHT && game.dungeon && !this.weapon.melee) {
      const map = game.dungeon.map;
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
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.setLineDash([]);
      // Endpoint dot
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = lc;
      ctx.beginPath();
      ctx.arc(ex, ey, 2.5, 0, TWO_PI);
      ctx.fill();
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
      ctx.beginPath();
      ctx.moveTo(b.x1*TILE-camX, b.y1*TILE-camY);
      ctx.lineTo(b.x2*TILE-camX, b.y2*TILE-camY);
      ctx.stroke();
      // Bright core
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#ffffff';
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(b.x1*TILE-camX, b.y1*TILE-camY);
      ctx.lineTo(b.x2*TILE-camX, b.y2*TILE-camY);
      ctx.stroke();
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
    ctx.beginPath();
    ctx.arc(sx,sy,7,0,TWO_PI);
    ctx.fill();
    // direction pip
    ctx.shadowBlur=5;
    ctx.fillStyle='#ffffff';
    ctx.beginPath();
    ctx.arc(sx+this.facing.x*7,sy+this.facing.y*7,2.5,0,TWO_PI);
    ctx.fill();
    ctx.restore();

    // Energy shield bubble
    if (this.energyShield && this.perks.ENERGY_SHIELD) {
      ctx.save();
      const pulse=0.15*Math.sin(performance.now()*0.004);
      ctx.globalAlpha=0.25+pulse;
      ctx.strokeStyle='#4488ff';
      ctx.shadowBlur=12; ctx.shadowColor='#4488ff';
      ctx.lineWidth=1.5;
      ctx.beginPath();
      ctx.arc(sx,sy,12,0,TWO_PI);
      ctx.stroke();
      ctx.restore();
    }
  }
}

