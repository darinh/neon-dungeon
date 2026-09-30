// @ts-check
'use strict';

// The player's damage roll is never replayed.
/**
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 */
Enemy.prototype.aiMirror = function aiMirror(dt, player, map, d, los) {
  void d; void los; // recomputed against the lock for fairness
  const bm = this.berserkerMul();
  const ocMul = _EG.modifier === 'OVERCLOCK' ? 1.2 : 1;

  const inRoom = this.room && (
    (this._tx >= this.room.x && this._tx < this.room.x + this.room.w &&
     this._ty >= this.room.y && this._ty < this.room.y + this.room.h) ||
    (player.x >= this.room.x && player.x < this.room.x + this.room.w &&
     player.y >= this.room.y && player.y < this.room.y + this.room.h));

  if (this._miState === 'telegraph') {
    this._miTele -= dt; // fixed-rate countdown — fairness > tempo
    if (this._miTele <= 0) {
      // Locked aim from telegraph entry. Chasing during the window would defeat it.
      const ax = this._miAimDx, ay = this._miAimDy;
      const dmg = Math.round(this.atk * MIRROR_DMG_MUL);
      const spd = this._miShotSpd || MIRROR_PROJ_SPD_DEF;
      const colour = this._miShotColour || '#88ff44';
      // The false, false tail is (piercing, friendly). No homing or bounce — player perks must not leak into this shot.
      const p = new Projectile(this.x, this.y, ax, ay, spd, dmg,
                                MIRROR_PROJ_RANGE, colour, false, false);
      // Projectile._init applies CHARGED and KINETIC_AMPLIFIER after the ctor. Re-assign so those cannot leak past the clamp.
      p.spd = spd;
      // Death recap reads ownerType, not the class name.
      p.ownerType = 'Mirror Shot';
      projectiles.push(p);
      if (audio.mirrorFire) audio.mirrorFire();
      spawnParticles(this.x, this.y, 'MUZZLE', colour, 4);
      triggerShake(1.5, 0.08);
      this._miState = 'recovery';
      this._miRec = MIRROR_RECOVERY;
      this._miTele = 0;
    }
    return;
  }

  if (this._miState === 'recovery') {
    this._miRec -= dt * ocMul * bm;
    if (this._miRec <= 0) {
      this._miState = 'idle';
      this._miCharge = MIRROR_CHARGE;
    }
    return;
  }

  this._miCharge = Math.max(0, (this._miCharge || 0) - dt * ocMul * bm);
  if (this._miCharge <= 0 && inRoom && this._canTarget()) {
    const dLock = dist(this.x, this.y, this._tx, this._ty);
    // dLock > 0.1: norm(0, 0) is [0, 0] and would fire a phantom shot due east. Same guard as RESONATOR.
    if (dLock > 0.1 && dLock <= MIRROR_RANGE && hasLOS(this.x, this.y, this._tx, this._ty, map)) {
      const [dx, dy] = norm(this._tx - this.x, this._ty - this.y);
      this._miAimDx = dx; this._miAimDy = dy;
      // Resolve at lock time so the telegraph colour matches the shot that fires.
      const k = pickMirrorKinematics(player && player._shotHistory);
      this._miShotSpd = k.spd;
      this._miShotColour = k.colour;
      this._miState = 'telegraph';
      this._miTele = MIRROR_TELEGRAPH;
      if (audio.mirrorCharge) audio.mirrorCharge();
    }
  }
};
