// @ts-check
'use strict';

/**
 * Queue a summoned DRONE near this SUMMONER.
 *
 * @this {Enemy}
 * @param {any} [map]
 */
Enemy.prototype.summonMinion = function summonMinion(map) {
  // Find a passable tile near the summoner
  let sx, sy, found = false;
  for (let a = 0; a < 10; a++) {
    sx = this.x + rnd(-2, 2);
    sy = this.y + rnd(-2, 2);
    const fx = Math.floor(sx), fy = Math.floor(sy);
    if (fx >= 0 && fy >= 0 && fx < MAP_W && fy < MAP_H && isPassable(map[fy][fx])) {
      found = true; break;
    }
  }
  if (!found) { sx = this.x; sy = this.y; }
  if (!this._summons) this._summons = [];
  pendingEnemySpawns.push({
    type: 'DRONE', x: sx, y: sy, floor: _EG.floor, room: this.room,
    _challengeWave: !!this._challengeWave,
    _summoned: true, _summonerRef: this
  });
  audio.summon();
  spawnParticles(this.x, this.y, 'MUZZLE', '#bb44ff', 8);
  spawnParticles(sx, sy, 'SPARK', '#bb44ff', 6);
};

/**
 * @this {Enemy}
 * @param {any} [dt]
 * @param {any} [player]
 * @param {any} [map]
 * @param {any} [d]
 * @param {any} [los]
 */
Enemy.prototype.aiSummoner = function aiSummoner(dt, player, map, d, los) {
  this._summonTimer = Math.max(0, (this._summonTimer || 0) - dt);
  // Prune dead summons from tracking array.
  if (this._summons) this._summons = this._summons.filter((/** @type {any} */ s) => !s.dead);
  const bm = this.berserkerMul();
  if (los && d < 5) {
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
    if (this._summonTimer <= 0 && (this._summons || []).length < 3) {
      this.summonMinion(map);
      this._summonTimer = Math.max(3.5, 5 - (_EG.floor || 1) * 0.15) / (_EG.modifier === 'OVERCLOCK' ? 1.2 : 1) / bm;
    }
  } else if (d > 14 && los) {
    this.moveToward(this._tx, this._ty, this.spd * 0.6, dt, map);
  } else {
    this.patrol(dt, map);
  }
};
