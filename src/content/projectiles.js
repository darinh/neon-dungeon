// @ts-check
'use strict';

// Pooled projectile runtime and grenade hazard-zone helpers. Loaded before
// src/content.js so content, entity, render, and game coordinators keep sharing
// the same script-tag globals while projectile behavior lives in its own module.

// ─── Projectiles (pooled) ────────────────────────────────────────────────────
// projectiles[] holds live projectiles only. _projPool is the free list of
// dead Projectile instances. `new Projectile(...)` returns a pooled instance
// if one is free (constructors may return an object), else allocates a fresh
// one. Every field — required AND optional — is explicitly (re)assigned in
// _init() so there is zero stale bleed-through between reuses. Release
// happens in the main update loop when p.dead becomes true.
const PROJECTILE_CAP = 200;
/** @type {any[]} */ const projectiles = [];
/** @type {any[]} */ const _projPool = [];

/**
 * @param {any} p
 */
function releaseProjectile(p) {
  if (_projPool.length >= PROJECTILE_CAP) return; // hard cap
  // Best-effort cleanup of references that could hold onto dead enemies/
  // weapons longer than needed. _init() rewrites these on reuse anyway, but
  // nulling here keeps the free-list from pinning garbage.
  p.homing = null;
  p._owner = null;
  if (p.hitEnemies) p.hitEnemies.clear();
  if (p.trail) p.trail.length = 0;
  if (p._effects) p._effects = null;
  if (p._affixes) p._affixes = null;
  _projPool.push(p);
}

class Projectile {
  /** @type {any} */ x;
  /** @type {any} */ y;
  /** @type {any} */ dx;
  /** @type {any} */ dy;
  /** @type {any} */ spd;
  /** @type {any} */ dmg;
  /** @type {any} */ maxRange;
  /** @type {any} */ travelled;
  /** @type {any} */ colour;
  /** @type {any} */ piercing;
  /** @type {any} */ fromPlayer;
  /** @type {any} */ weaponName;
  /** @type {any} */ dead;
  /** @type {any} */ hitEnemies;
  /** @type {any} */ homing;
  /** @type {any} */ trail;
  /** @type {any} */ bouncesLeft;
  /** @type {any} */ _hasRicochet;
  /** @type {any} */ _effects;
  /** @type {any} */ _affixes;
  /** @type {any} */ isGrenade;
  /** @type {any} */ grenadeDmg;
  /** @type {any} */ isCrit;
  /** @type {any} */ ownerType;
  /** @type {any} */ _owner;
  /** @type {any} */ grenadeColour;
  /** @type {any} */ targetX;
  /** @type {any} */ targetY;
  /** @type {any} */ maxPierces;
  /** @type {any} */ isAllyTurret;
  /** @type {any} */ fromPlayerShot;
  /** @type {any} */ _isReverbEcho;
  /** @type {any} */ _timeMul;
  /**
   * @param {any} x
   * @param {any} y
   * @param {any} dx
   * @param {any} dy
   * @param {any} spd
   * @param {any} dmg
   * @param {any} range
   * @param {any} colour
   * @param {any} piercing
   * @param {any} fromPlayer
   * @param {any} [weaponName]
   */
  constructor(x,y,dx,dy,spd,dmg,range,colour,piercing,fromPlayer,weaponName) {
    // Reuse a dead slot from the pool when possible. Returning an object from
    // a constructor makes `new Projectile(...)` yield that object instead of
    // `this`, so every existing callsite keeps working without change.
    if (_projPool.length) {
      const p = _projPool.pop();
      p._init(x,y,dx,dy,spd,dmg,range,colour,piercing,fromPlayer,weaponName);
      return p;
    }
    this._init(x,y,dx,dy,spd,dmg,range,colour,piercing,fromPlayer,weaponName);
  }
  /**
   * @param {any} x
   * @param {any} y
   * @param {any} dx
   * @param {any} dy
   * @param {any} spd
   * @param {any} dmg
   * @param {any} range
   * @param {any} colour
   * @param {any} piercing
   * @param {any} fromPlayer
   * @param {any} [weaponName]
   */
  _init(x,y,dx,dy,spd,dmg,range,colour,piercing,fromPlayer,weaponName) {
    // ── Core motion/state (mirrors original constructor) ──
    /** @type {any} */ (this).x=x; /** @type {any} */ (this).y=y;
    [this.dx,this.dy]=norm(dx,dy);
    this.spd= fromPlayer && hasAugment('KINETIC_AMPLIFIER') ? spd * 1.2 : spd;
    if (_CG.modifier === 'CHARGED') this.spd *= 1.4;
    this.dmg=dmg;
    if (fromPlayer && _CG.modifier === 'CHARGED') this.dmg = Math.round(this.dmg * 1.2);
    this.maxRange=range; this.travelled=0;
    this.colour=colour; this.piercing=piercing;
    this.maxPierces=piercing?Infinity:0;
    this.fromPlayer=fromPlayer; this.dead=false;
    this.weaponName=weaponName||null;
    // Reuse containers in place to avoid alloc; fall back to fresh if null.
    if (this._effects && this._effects.length) this._effects.length = 0;
    else if (!this._effects) this._effects = /** @type {any[]} */ ([]);
    if (this.hitEnemies) this.hitEnemies.clear();
    else this.hitEnemies = new Set();
    this.bouncesLeft=0;
    this._hasRicochet=false;
    if (this.trail) this.trail.length = 0;
    else this.trail = /** @type {any[]} */ ([]);
    // ── Optional fields — EXPLICITLY reset so stale values from a prior
    // occupant of this slot cannot leak into new behaviour. Every property
    // that any callsite ever assigns must be zeroed here. ──
    this.homing = /** @type {any} */ (null);
    this.isGrenade = false;
    this.grenadeDmg = 0;
    this.grenadeColour = /** @type {any} */ (null);
    this.targetX = 0;
    this.targetY = 0;
    this.ownerType = null;
    this.isAllyTurret = false;
    this.fromPlayerShot = false;
    this._isReverbEcho = false;
    this._owner = /** @type {any} */ (null);
    this.isCrit = false;
    // Pool-reset: a recycled projectile slot must NOT inherit a
    // _timeMul=0.5 from a prior occupant that died inside a
    // TIME_DILATION zone. Without this reset, the next shot fired
    // from the same slot would crawl at half speed.
    this._timeMul = 1;
    if (this._affixes && this._affixes.length) this._affixes.length = 0;
    else if (!this._affixes) this._affixes = /** @type {any[]} */ ([]);
  }
  /**
   * @param {any} dt
   * @param {any} map
   * @param {any} player
   * @param {any} enemies
   */
  update(dt, map, player, enemies) {
    // Homing: steer toward target
    if (this.homing && !this.homing.dead) {
      const [tx, ty] = [this.homing.x - this.x, this.homing.y - this.y];
      const [nd, ndy] = norm(tx, ty);
      const steer = 8; // radians/sec turn rate
      this.dx = lerp(this.dx, nd,  Math.min(1, steer * dt));
      this.dy = lerp(this.dy, ndy, Math.min(1, steer * dt));
      const [fd, fdy] = norm(this.dx, this.dy);
      this.dx = fd; this.dy = fdy;
    }
    // Trail: record position before moving (ricochet projectiles only)
    if (this._hasRicochet) {
      this.trail.push(this.x*TILE, this.y*TILE);
      if (this.trail.length>24) this.trail.splice(0,2); // max 12 points (x,y pairs)
    }
          /** @type {any} */ const prevX=this.x;
          /** @type {any} */ const prevY=this.y;
    // TIME_DILATION temporal field (content.js time_field branch in
    // updateHackwareEffects) sets this._timeMul to 0.5 each frame
    // for enemy projectiles inside the radius, and back to 1 when
    // outside. The expiry branch + the activation dedup both restore
    // any leftover slowed projectiles. Default to 1 so projectiles
    // never touched by a field move at full speed. Multiply BOTH the
    // x/y delta AND the travelled accumulator so range budget ticks
    // at the same slowed rate (otherwise a slowed projectile would
    // exhaust its maxRange before traversing the slowed distance).
    const tmul = this._timeMul || 1;
    const mx=this.dx*this.spd*tmul*dt, my=this.dy*this.spd*tmul*dt;
    this.x+=mx; this.y+=my;
    this.travelled+=Math.sqrt(mx*mx+my*my);
    if (this.travelled>=this.maxRange) {
      if (this.isGrenade) detonateGrenade(prevX, prevY, this.grenadeDmg);
      this.dead=true; return;
    }
    const tx=Math.floor(this.x), ty=Math.floor(this.y);
    const ptx=Math.floor(prevX), pty=Math.floor(prevY);
    let sweptHit = false;
    let sweptHitX = -1, sweptHitY = -1;
    let sweptHitClosedCorner = false;
    let sweptOutOfBounds = false;
    let sweptImpactX = prevX, sweptImpactY = prevY;
    let sweptSideX = -1, sweptSideY = -1, sweptSideX2 = -1, sweptSideY2 = -1;
    let sweptXWall = false, sweptYWall = false;
    if (tx!==ptx || ty!==pty) {
      const segX = this.x - prevX, segY = this.y - prevY;
      const sx = segX > 0 ? 1 : (segX < 0 ? -1 : 0);
      const sy = segY > 0 ? 1 : (segY < 0 ? -1 : 0);
      const tDeltaX = sx ? 1 / Math.abs(segX) : Infinity;
      const tDeltaY = sy ? 1 / Math.abs(segY) : Infinity;
      let tMaxX = sx > 0 ? ((ptx + 1) - prevX) / segX : (sx < 0 ? (prevX - ptx) / -segX : Infinity);
      let tMaxY = sy > 0 ? ((pty + 1) - prevY) / segY : (sy < 0 ? (prevY - pty) / -segY : Infinity);
      let cx = ptx, cy = pty;
      /** @param {number} t @param {boolean} crossX @param {boolean} crossY */
      const hitAt = (t, crossX, crossY) => {
        const eps = 0.001;
        sweptImpactX = prevX + segX * t - (crossX ? sx * eps : 0);
        sweptImpactY = prevY + segY * t - (crossY ? sy * eps : 0);
      };
      const sweepLimit = Math.abs(tx - ptx) + Math.abs(ty - pty) + 2;
      for (let i = 0; i < sweepLimit && (cx !== tx || cy !== ty); i++) {
        const oldX = cx, oldY = cy;
        const tieEps = 1e-9;
        const crossX = tMaxX <= tMaxY + tieEps;
        const crossY = tMaxY <= tMaxX + tieEps;
        const tHit = Math.min(tMaxX, tMaxY);
        if (tHit > 1) break;
        let nx = cx, ny = cy;
        if (crossX) { nx += sx; tMaxX += tDeltaX; }
        if (crossY) { ny += sy; tMaxY += tDeltaY; }
        if (crossX && crossY) {
          const sideAOut = nx < 0 || nx >= MAP_W || oldY < 0 || oldY >= MAP_H;
          const sideBOut = oldX < 0 || oldX >= MAP_W || ny < 0 || ny >= MAP_H;
          const sideA = sideAOut || !isPassable(map[oldY][nx]);
          const sideB = sideBOut || !isPassable(map[ny][oldX]);
          if (sideA && sideB) {
            sweptHit = true;
            sweptHitX = nx; sweptHitY = ny;
            sweptHitClosedCorner = true;
            sweptOutOfBounds = sideAOut || sideBOut;
            hitAt(tHit, true, true);
            sweptSideX = nx; sweptSideY = oldY;
            sweptSideX2 = oldX; sweptSideY2 = ny;
            sweptXWall = true; sweptYWall = true;
            break;
          }
        }
        cx = nx; cy = ny;
        sweptOutOfBounds = cx < 0 || cy < 0 || cx >= MAP_W || cy >= MAP_H;
        if (sweptOutOfBounds || !isPassable(map[cy][cx])) {
          sweptHit = true;
          sweptHitX = cx; sweptHitY = cy;
          hitAt(tHit, crossX, crossY);
          sweptXWall = crossX;
          sweptYWall = crossY;
          break;
        }
      }
    }
    if (sweptHit) {
      if (sweptSideX >= 0 && sweptSideX < MAP_W && sweptSideY >= 0 && sweptSideY < MAP_H && map[sweptSideY][sweptSideX] === T.CRATE) damageCrateAtTile(sweptSideX, sweptSideY, this.dmg);
      if (sweptSideX2 >= 0 && sweptSideX2 < MAP_W && sweptSideY2 >= 0 && sweptSideY2 < MAP_H && map[sweptSideY2][sweptSideX2] === T.CRATE) damageCrateAtTile(sweptSideX2, sweptSideY2, this.dmg);
      if (!sweptHitClosedCorner && sweptHitX >= 0 && sweptHitX < MAP_W && sweptHitY >= 0 && sweptHitY < MAP_H && map[sweptHitY][sweptHitX] === T.CRATE) damageCrateAtTile(sweptHitX, sweptHitY, this.dmg);
      if (sweptOutOfBounds) {
        if (this.isGrenade) { detonateGrenade(sweptImpactX, sweptImpactY, this.grenadeDmg); }
        else { spawnParticles(prevX,prevY,'SPARK',this.colour,3); }
        this.dead=true; return;
      }
      if (this.isGrenade) {
        detonateGrenade(sweptImpactX, sweptImpactY, this.grenadeDmg);
        this.dead = true; return;
      }
      if (this.bouncesLeft > 0) {
        this.bouncesLeft--;
        this.x = sweptImpactX; this.y = sweptImpactY;
        if (sweptXWall) this.dx = -this.dx;
        if (sweptYWall) this.dy = -this.dy;
        if (!sweptXWall && !sweptYWall) { this.dx = -this.dx; this.dy = -this.dy; }
        this.x += this.dx * 0.05; this.y += this.dy * 0.05;
        spawnParticles(prevX, prevY, 'SPARK', '#00ffff', 4);
        audio.ricochet();
        return;
      }
      this.x = sweptImpactX; this.y = sweptImpactY;
      spawnParticles(sweptImpactX, sweptImpactY, 'SPARK', this.colour, 3);
      this.dead = true; return;
    }
    if (tx<0||ty<0||tx>=MAP_W||ty>=MAP_H) {
      if (this.isGrenade) { detonateGrenade(prevX, prevY, this.grenadeDmg); }
      else { spawnParticles(prevX,prevY,'SPARK',this.colour,3); }
      this.dead=true; return;
    }
    if (!isPassable(map[ty][tx])) {
      // Damage crates on impact
      if (map[ty][tx] === T.CRATE) damageCrateAtTile(tx, ty, this.dmg);
      // Grenades detonate at last passable position on wall hit
      if (this.isGrenade) {
        detonateGrenade(prevX, prevY, this.grenadeDmg);
        this.dead = true; return;
      }
      // Ricochet: bounce off walls if bounces remain
      if (this.bouncesLeft>0) {
        this.bouncesLeft--;
        this.x=prevX; this.y=prevY;
        // Axis-separated wall detection
        const ntx=Math.floor(prevX+mx), nty=Math.floor(prevY+my);
        const xWall=ntx<0||ntx>=MAP_W||!isPassable(map[pty][ntx]);
        const yWall=nty<0||nty>=MAP_H||!isPassable(map[nty][ptx]);
        if (xWall) this.dx=-this.dx;
        if (yWall) this.dy=-this.dy;
        if (!xWall&&!yWall) { this.dx=-this.dx; this.dy=-this.dy; }
        // Nudge away from wall to prevent re-collision
        this.x+=this.dx*0.05; this.y+=this.dy*0.05;
        spawnParticles(prevX,prevY,'SPARK','#00ffff',4);
        audio.ricochet();
        return;
      }
      spawnParticles(this.x,this.y,'SPARK',this.colour,3);
      this.dead=true; return;
    }
    // Grenades: detonate when reaching target
    if (this.isGrenade && dist(this.x, this.y, this.targetX, this.targetY) < 0.5) {
      detonateGrenade(this.x, this.y, this.grenadeDmg);
      this.dead = true; return;
    }
    if (this.fromPlayer) {
      for (const e of enemies) {
        if (e.dead||this.hitEnemies.has(e)) continue;
        if (e._wrPhased) continue; // phased WRAITHs are intangible
        if (dist(this.x,this.y,e.x,e.y)<0.6) {
          // Reflection check — REFLECTOR bounces projectiles back (including piercing)
          if (e.reflectsProjectile(this)) {
            this.dx = -this.dx;
            this.dy = -this.dy;
            this.fromPlayer = false;
            this.fromPlayerShot = false;
            this.dmg = Math.round(this.dmg * 0.6);
            this.ownerType = 'Reflected';
            this.hitEnemies = new Set();
            this.homing = null;
            this.bouncesLeft = 0;
            this._hasRicochet = false;
            this.travelled = 0;
            this._effects = /** @type {any[]} */ ([]);
            this._affixes = /** @type {any[]} */ ([]);
            this.isCrit = false;
            spawnParticles(this.x, this.y, 'SPARK', '#88ddff', 8);
            audio.reflect();
            return;
          }
          // Shield deflection check (skip for piercing weapons)
          if (e.blocksProjectile(this) && !this.piercing) {
            // SHIELDER directional shield: deplete shieldHp and start the
            // broken-recovery timer when it drops to 0. The shield comes
            // back over a 5s window per the aiShielder tick logic.
            if (e.type === 'SHIELDER' && e.shieldHp > 0) {
              e.shieldHp -= this.dmg;
              if (e.shieldHp <= 0) {
                e.shieldHp = 0;
                e.shieldBrokenTimer = 0;
                spawnParticles(e.x, e.y, 'EXPLOSION', '#66eeff', 12);
                try { audio.shieldBreak(); } catch (_) { audio.shieldDeflect(); }
              } else {
                spawnParticles(this.x, this.y, 'SPARK', '#66eeff', 6);
                audio.shieldDeflect();
              }
            } else {
              spawnParticles(this.x, this.y, 'SPARK', '#66eeff', 6);
              audio.shieldDeflect();
            }
            this.dead = true; return;
          }
          e.takeDamage(this.dmg, { name:this.weaponName, effects:this._effects||[], affixes:this._affixes||[], fromPlayerShot: this.fromPlayerShot === true });
          if (this.isCrit) spawnDmgText(e.x, e.y - 0.3, 'CRIT!', '#ffdd00');
          spawnParticles(this.x,this.y,'BLOOD','#ff3333',4);
          this.hitEnemies.add(e);
          if (this.hitEnemies.size > this.maxPierces) { this.dead=true; return; }
        }
      }
    } else if (!this.isGrenade && !this.isAllyTurret) {
      // Normal enemy projectiles damage player (grenades don't — they create zones)
      // PARRY perk: while dashing, enemy projectiles touching the player are
      // reflected back at full damage (skill-tied — requires precise dash timing).
      // Mirrors the REFLECTOR enemy-side reflect at line ~3418, but enemy→player.
      // Gated on dashTimer specifically (not cloak / spawn-grace) so the perk
      // only rewards active dash timing, not passive immunity windows.
      if (player.perks.PARRY && player.dashTimer > 0 && dist(this.x,this.y,player.x,player.y)<0.5) {
        this.dx = -this.dx;
        this.dy = -this.dy;
        this.fromPlayer = true;
        this.fromPlayerShot = false;
        this.ownerType = 'Parry';
        this._owner = null;
        this.weaponName = 'Parry';
        this.hitEnemies = new Set();
        this.maxPierces = 0;
        this.piercing = false;
        this.homing = null;
        this.bouncesLeft = 0;
        this._hasRicochet = false;
        this.travelled = 0;
        this._effects = /** @type {any[]} */ ([]);
        this._affixes = /** @type {any[]} */ ([]);
        this.isCrit = false;
        this.colour = '#aaffee';
        // TIME_DILATION ownership-flip cleanup — see REVERSE_POLARITY
        // mirror at ~L1153 for the rationale. A parried bullet that
        // was slowed by a time_field needs _timeMul snapped back to 1
        // so the player's reflected shot doesn't crawl at half speed.
        this._timeMul = 1;
        spawnParticles(this.x, this.y, 'SPARK', '#aaffee', 8);
        audio.reflect();
        return;
      }
      // Cloaked player: projectiles pass through
      if (!player.invincibleTimer && !isPlayerDamageImmune() && dist(this.x,this.y,player.x,player.y)<0.5) {
        const dealt = player.takeDamage(this.dmg, this.ownerType || 'Projectile');
        // SNIPER shots shock the player on hit
        if (dealt > 0 && this.ownerType === 'SNIPER') {
          const wasShocked = player.shockTimer > 0;
          player.shockTimer = Math.max(player.shockTimer, 0.4);
          if (!wasShocked) audio.playerShock();
        }
        // SIPHON life steal: heal owner for % of damage dealt
        if (dealt > 0 && this.ownerType === 'SIPHON' && this._owner && !this._owner.dead) {
          const stealPct = this._owner._spFrenzy ? 0.75 : 0.50;
          const heal = Math.ceil(dealt * stealPct);
          this._owner.hp = Math.min(this._owner.maxHp, this._owner.hp + heal);
          this._owner._spDrainBeam = { px: player.x, py: player.y, t: 0.3 };
          spawnParticles(this._owner.x, this._owner.y, 'SPARK', '#44ff88', 4);
          audio.siphonDrain();
        }
        this.dead=true;
      }
    }
    // Any projectile can prime volatile cores (skip if already consumed)
    if (!this.dead) {
      for (const c of vcores) {
        if (c.dead || c.primed) continue;
        if (dist(this.x, this.y, c.x, c.y) < 0.6) {
          c.primed = true; c.timer = 0.55;
          audio.corePrime();
          spawnParticles(c.x, c.y, 'SPARK', '#ff6622', 6);
          if (!this.fromPlayer) { this.dead = true; return; }
          break; // player projectile: prime one core per frame, continue flying
        }
      }
    }
    // Player projectiles can damage alarm beacons
    if (!this.dead && this.fromPlayer) {
      for (const b of beacons) {
        if (b.dead) continue;
        if (dist(this.x, this.y, b.x, b.y) < 0.6) {
          damageBeacon(b, this.dmg);
          if (!this.piercing) { this.dead = true; return; }
          break;
        }
      }
    }
    // Player projectiles can damage shield generators
    if (!this.dead && this.fromPlayer) {
      for (const g of shieldGens) {
        if (g.dead) continue;
        if (dist(this.x, this.y, g.x, g.y) < 0.6) {
          damageShieldGen(g, this.dmg);
          if (!this.piercing) { this.dead = true; return; }
          break;
        }
      }
    }
    // Player projectiles can damage security cameras
    if (!this.dead && this.fromPlayer) {
      for (const cam of cameras) {
        if (cam.dead) continue;
        if (dist(this.x, this.y, cam.x, cam.y) < 0.6) {
          damageCamera(cam, this.dmg);
          if (!this.piercing) { this.dead = true; return; }
          break;
        }
      }
    }
    // Player projectiles can damage laser tripwire emitters
    if (!this.dead && this.fromPlayer) {
      for (const l of lasers) {
        if (l.dead) continue;
        if (!l.deadA && dist(this.x, this.y, l.x1, l.y1) < 0.5) {
          damageLaserEmitter(l, 'A', this.dmg);
          if (!this.piercing) { this.dead = true; return; }
          break;
        }
        if (l.dead) continue;
        if (!l.deadB && dist(this.x, this.y, l.x2, l.y2) < 0.5) {
          damageLaserEmitter(l, 'B', this.dmg);
          if (!this.piercing) { this.dead = true; return; }
          break;
        }
      }
    }
    // Player projectiles trigger proximity mines (pre-detonate from range)
    if (!this.dead && this.fromPlayer) {
      for (const m of mines) {
        if (m.dead || m.state !== 'dormant') continue;
        if (dist(this.x, this.y, m.x, m.y) < 0.6) {
          armMine(m, MINE_FUSE_SHOT);
          if (!this.piercing) { this.dead = true; return; }
          break;
        }
      }
    }
    // Player projectiles can damage hostile wall turrets
    if (!this.dead && this.fromPlayer) {
      for (const wt of wallTurrets) {
        if (wt.dead || wt.hacked) continue;
        if (dist(this.x, this.y, wt.x, wt.y) < 0.6) {
          damageWallTurret(wt, this.dmg);
          if (!this.piercing) { this.dead = true; return; }
          break;
        }
      }
    }
    // Ally turret projectiles can hit enemies
    if (!this.dead && this.isAllyTurret) {
      for (const e of enemies) {
        if (e.dead || this.hitEnemies.has(e)) continue;
        if (e._wrPhased) continue; // phased WRAITHs are intangible
        if (dist(this.x, this.y, e.x, e.y) < 0.6) {
          if (e.blocksProjectile(this) && !this.piercing) {
            // Mirror the player-projectile path: SHIELDER takes shield damage
            // and the shield breaks at 0 HP. (Hacked turrets don't get the
            // satisfaction-of-breaking sound — keep the deflect for them.)
            if (e.type === 'SHIELDER' && e.shieldHp > 0) {
              e.shieldHp -= this.dmg;
              if (e.shieldHp <= 0) {
                e.shieldHp = 0;
                e.shieldBrokenTimer = 0;
                spawnParticles(e.x, e.y, 'EXPLOSION', '#66eeff', 12);
                try { audio.shieldBreak(); } catch (_) {}
              } else {
                spawnParticles(this.x, this.y, 'SPARK', '#66eeff', 6);
              }
            } else {
              spawnParticles(this.x, this.y, 'SPARK', '#66eeff', 6);
            }
            this.dead = true; return;
          }
          e.takeDamage(this.dmg, { name:'Wall Turret', effects:[], affixes:[] });
          spawnParticles(this.x, this.y, 'BLOOD', '#ff3333', 4);
          this.hitEnemies.add(e);
          this.dead = true; return;
        }
      }
    }
    // Enemy projectiles can damage hacked wall turrets
    if (!this.dead && !this.fromPlayer && !this.isAllyTurret && !this.isGrenade) {
      for (const wt of wallTurrets) {
        if (wt.dead || !wt.hacked) continue;
        if (dist(this.x, this.y, wt.x, wt.y) < 0.6) {
          damageWallTurret(wt, this.dmg);
          this.dead = true; return;
        }
      }
    }
  }
  /**
   * @param {any} camX
   * @param {any} camY
   */
  draw(camX,camY) {
    // Ricochet trail — fading cyan line behind bouncing projectiles
    const tl=this.trail.length;
    if (tl>=4) {
      ctx.save();
      ctx.lineCap='round';
      const pts=Math.floor(tl/2);
      for (let i=1;i<pts;i++) {
        const a=(i-1)*2, b=i*2;
        const alpha=(i/pts)*0.5;
        ctx.globalAlpha=alpha;
        ctx.strokeStyle='#00ffff';
        ctx.shadowBlur=4; ctx.shadowColor='#00ffff';
        ctx.lineWidth=1.5;
        NEON.draw.line(ctx,
          this.trail[a]-camX, this.trail[a+1]-camY,
          this.trail[b]-camX, this.trail[b+1]-camY);
      }
      // Line from last trail point to current position
      ctx.globalAlpha=0.6;
      ctx.lineWidth=2;
      NEON.draw.line(ctx,
        this.trail[tl-2]-camX, this.trail[tl-1]-camY,
        this.x*TILE-camX, this.y*TILE-camY);
      ctx.restore();
    }
    const sx=this.x*TILE-camX, sy=this.y*TILE-camY;
    ctx.save();
    ctx.shadowBlur=8; ctx.shadowColor=this.colour;
    ctx.fillStyle=this.colour;
    const r = this.isGrenade ? 5 : 3;
    NEON.draw.circle(ctx, sx, sy, r);
    if (this.isGrenade) {
      // Pulsing warning ring
      ctx.globalAlpha = 0.4 + Math.sin(Date.now() / 80) * 0.3;
      ctx.strokeStyle = '#ffaa00';
      ctx.lineWidth = 1;
      NEON.draw.circleStroke(ctx, sx, sy, 7);
    }
    ctx.restore();
  }
}

// ─── Hazard Zones (grenade AoE) ───────────────────────────────────────────────
/**
 * @param {any} x
 * @param {any} y
 * @param {any} dmg
 */
function detonateGrenade(x, y, dmg) {
  hazardZones.push({ x, y, radius: 1.5, age: 0, maxAge: 3, tickCd: 0, armTimer: 0, dmg, colour: '#ff6622' });
  spawnParticles(x, y, 'EXPLOSION', '#ff6622', 10);
  audio.grenadeExplode();
  primeVCoresInRadius(x, y, 1.5, _CG.dungeon.map);
  damageCratesInRadius(x, y, 1.5, dmg, _CG.dungeon.map);
  damageBeaconsInRadius(x, y, 1.5, dmg, _CG.dungeon.map);
  damageShieldGensInRadius(x, y, 1.5, dmg, _CG.dungeon.map);
  damageCamerasInRadius(x, y, 1.5, dmg, _CG.dungeon.map);
  damageLasersInRadius(x, y, 1.5, dmg, _CG.dungeon.map);
  damageWallTurretsInRadius(x, y, 1.5, dmg, _CG.dungeon.map);
  triggerMinesInRadius(x, y, 1.5, _CG.dungeon.map);
}

/**
 * @param {any} dt
 * @param {any} player
 */
function updateHazardZones(dt, player) {
  for (let i = hazardZones.length - 1; i >= 0; i--) {
    const z = hazardZones[i];
    z.age += dt;
    if (z.armTimer > 0) z.armTimer -= dt;
    z.tickCd = Math.max(0, z.tickCd - dt);
    if (z.age >= z.maxAge) { hazardZones.splice(i, 1); continue; }
    if (z.armTimer <= 0 && z.tickCd <= 0 && !player.invincibleTimer && !isPlayerDamageImmune() &&
        dist(player.x, player.y, z.x, z.y) < z.radius &&
        hasLOS(z.x, z.y, player.x, player.y, _CG.dungeon.map)) {
      player.takeDamage(z.dmg, z.source || 'Grenade');
      spawnParticles(player.x, player.y, 'SPARK', z.colour || '#ff6622', 4);
      z.tickCd = 0.8;
    }
  }
}

/**
 * @param {any} camX
 * @param {any} camY
 */
function drawHazardZones(camX, camY) {
  for (const z of hazardZones) {
    const sx = z.x * TILE - camX, sy = z.y * TILE - camY;
    const r = z.radius * TILE;
    const fade = 1 - (z.age / z.maxAge);
    const pulse = 0.7 + Math.sin(z.age * 6) * 0.15;
    ctx.save();
    if (z.armTimer > 0) {
      // Arming: pulsing warning ring only
      const arm = 0.4 + Math.sin(z.age * 14) * 0.3;
      ctx.globalAlpha = arm * 0.5;
      ctx.strokeStyle = z.colour;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      NEON.draw.circleStroke(ctx, sx, sy, r);
      ctx.setLineDash([]);
    } else {
      ctx.globalAlpha = fade * 0.3 * pulse;
      ctx.fillStyle = z.colour;
      ctx.shadowBlur = 15;
      ctx.shadowColor = z.colour;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, TWO_PI);
      ctx.fill();
      ctx.globalAlpha = fade * 0.6 * pulse;
      ctx.strokeStyle = z.colour;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }
}
