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
