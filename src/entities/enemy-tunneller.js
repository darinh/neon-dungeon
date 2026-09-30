// @ts-check
'use strict';

// Tunneling and surfacing stay intangible via `_wrPhased` (set at spawn).
// Hit, heal, and target gates elsewhere honor that flag.
/**
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 * @returns {void}
 */
Enemy.prototype.aiTunneller = function aiTunneller(dt, player, map, d, los) {
  void los;
  const bm = this.berserkerMul();
  const ocMul = _EG.modifier === 'OVERCLOCK' ? 1.2 : 1;

  if (this._tnState === 'tunneling') {
    this._tnTimer -= dt * ocMul;
    // Ignores walls while burrowed.
    const tspd = modSpeed(this.spd * 1.5) * this.slowFactor * bm * (hasAugment('TEMPORAL_DILATION') ? 0.85 : 1);
    const [dx, dy] = norm(this._tx - this.x, this._ty - this.y);
    const nx = this.x + dx * tspd * dt;
    const ny = this.y + dy * tspd * dt;
    this.x = Math.max(0.1, Math.min(MAP_W - 0.1, nx));
    this.y = Math.max(0.1, Math.min(MAP_H - 0.1, ny));
    if (rand('cosmetic') < dt * 8) spawnParticles(this.x, this.y, 'SPARK', '#cc8844', 1);

    const closeToTarget = d < 1.5 && this._canTarget();
    if (this._tnTimer <= 0 || closeToTarget) {
      const emerge = this._wrFindEmergeTile(map, player);
      if (emerge) {
        this.x = emerge.x; this.y = emerge.y;
        this._tnTargetX = emerge.x; this._tnTargetY = emerge.y;
        this._tnState = 'surfacing';
        this._tnTimer = 1.0; // telegraph window
        audio.wraithPhaseOut();
      } else {
        this._tnTimer = 0.5;
      }
    }
    return;
  }

  if (this._tnState === 'surfacing') {
    this._tnTimer -= dt;
    this.x = this._tnTargetX;
    this.y = this._tnTargetY;
    if (rand('cosmetic') < dt * 14) spawnParticles(this.x, this.y, 'SPARK', '#cc8844', 1);
    if (this._tnTimer <= 0) {
      const aoeR = 1.4;
      const aoeDmg = Math.round(this.atk * 1.0);
      if (dist(this.x, this.y, player.x, player.y) < aoeR && this._canTarget() &&
          hasLOS(this.x, this.y, player.x, player.y, map)) {
        player.takeDamage(aoeDmg, 'Tunneller Eruption');
      }
      spawnParticles(this.x, this.y, 'EXPLOSION', '#cc8844', 16);
      triggerShake(3, 0.18);
      audio.wraithPhaseIn();
      this._tnState = 'surfaced';
      this._tnTimer = 3.0;
      this._wrPhased = false;
      this.attackTimer = 0.4; // brief pause before first melee swing
    }
    return;
  }

  if (this._tnState === 'surfaced') {
    this._tnTimer -= dt * ocMul;
    if (los && d < 12) {
      this.moveToward(this._tx, this._ty, this.spd, dt, map);
    } else if (this._tx !== undefined) {
      this.moveToward(this._tx, this._ty, this.spd * 0.7, dt, map);
    } else {
      this.patrol(dt, map);
    }
    if (d < 1.2) this.meleeAttack(player);
    if (this._tnTimer <= 0) {
      this._tnState = 'tunneling';
      this._tnTimer = 1.5 + rand('combat') * 1.0;
      this._wrPhased = true;
      audio.wraithPhaseOut();
    }
    return;
  }
};
