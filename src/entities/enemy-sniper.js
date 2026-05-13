// @ts-check
'use strict';

/**
 * @this {Enemy}
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 */
Enemy.prototype.aiSniper = function aiSniper(dt, player, map, d, los) {
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
};

