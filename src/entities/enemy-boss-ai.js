// @ts-check
'use strict';

/**
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 */
Enemy.prototype.aiBossSentinel = function aiBossSentinel(dt,player,map,d,los) {
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
};

/**
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 */
Enemy.prototype.aiBossWarden = function aiBossWarden(dt,player,map,d,los) {
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
};

/**
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 */
Enemy.prototype.aiBossHive = function aiBossHive(dt,player,map,d,los) {
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
};

/**
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 */
Enemy.prototype.aiBossConductor = function aiBossConductor(dt,player,map,d,los) {
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
};

/**
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 */
Enemy.prototype.aiBossOmega = function aiBossOmega(dt,player,map,d,los) {
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
};

/**
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 */
Enemy.prototype.aiBossGenesis = function aiBossGenesis(dt,player,map,d,los) {
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
};
