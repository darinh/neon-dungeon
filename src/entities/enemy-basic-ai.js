// @ts-check
'use strict';

/**
 * @this {Enemy}
 * @param {number} dt
 * @param {any} player
 * @param {any} map
 * @param {number} d
 * @param {boolean} los
 * @returns {void}
 */
Enemy.prototype.aiGuard = function aiGuard(dt, player, map, d, los) {
  const detectRange = 10 + (_EG.floor || 1) * 0.4;
  if (los && d < detectRange) { this.state = 'CHASE'; }
  else if (d > detectRange + 2) { this.state = 'PATROL'; }
  if (this.state === 'PATROL') this.patrol(dt, map);
  else {
    this.moveToward(this._tx, this._ty, this.spd, dt, map);
    if (d < 1.2) this.meleeAttack(player);
  }
};

/**
 * @this {Enemy}
 * @param {number} dt
 * @param {any} player
 * @param {any} map
 * @param {number} d
 * @param {boolean} los
 * @returns {void}
 */
Enemy.prototype.aiTurret = function aiTurret(dt, player, map, d, los) {
  const cooldown = Math.max(1.0, 2.0 - (_EG.floor || 1) * 0.11) / (_EG.modifier === 'OVERCLOCK' ? 1.2 : 1);
  if (los && d < 12 && this.shootTimer <= 0) {
    this.fireAt(this._tx, this._ty, 8, this.atk, 13, '#ffb700');
    this.shootTimer = cooldown / this.berserkerMul();
  }
};

/**
 * @this {Enemy}
 * @param {number} dt
 * @param {any} player
 * @param {any} map
 * @param {number} d
 * @param {boolean} los
 * @returns {void}
 */
Enemy.prototype.aiCrawler = function aiCrawler(dt, player, map, d, los) {
  if (los || (d < 8 && this._canTarget())) {
    this.zigzag += dt * 5;
    const [dx, dy] = norm(this._tx - this.x, this._ty - this.y);
    const perp = { x: -dy, y: dx };
    const tx = this._tx + perp.x * Math.sin(this.zigzag) * 1.5;
    const ty = this._ty + perp.y * Math.sin(this.zigzag) * 1.5;
    this.moveToward(tx, ty, this.spd, dt, map);
    if (d < 1.2) this.meleeAttack(player);
  } else {
    this.patrol(dt, map);
  }
};

/**
 * @this {Enemy}
 * @param {number} dt
 * @param {any} player
 * @param {any} map
 * @param {number} d
 * @param {boolean} los
 * @returns {void}
 */
Enemy.prototype.aiBrute = function aiBrute(dt, player, map, d, los) {
  if (los && this._canTarget() && d < 14) this.state = 'CHASE';
  else if (!los || !this._canTarget() || d > 16) this.state = 'PATROL';
  if (this.state !== 'CHASE') { this.patrol(dt, map); return; }
  const chaseSpd = d < 2.0 ? this.spd * 0.65 : this.spd * 0.9;
  this.moveToward(this._tx, this._ty, chaseSpd, dt, map);
  if (d < 1.3) this.meleeAttack(player);
};

/**
 * @this {Enemy}
 * @param {number} dt
 * @param {any} player
 * @param {any} map
 * @param {number} d
 * @param {boolean} los
 * @returns {void}
 */
Enemy.prototype.aiDrone = function aiDrone(dt, player, map, d, los) {
  const cooldown = Math.max(0.9, 1.5 - (_EG.floor || 1) * 0.07) / (_EG.modifier === 'OVERCLOCK' ? 1.2 : 1);
  if (d < 15 && this._canTarget()) {
    // Drones respect walls when boss room is sealed.
    const canPhase = !_EG.bossSealed && !_EG.challengeSealed;
    this.moveToward(this._tx, this._ty, this.spd, dt, map, canPhase);
    if (this.shootTimer <= 0) {
      this.fireAt(this._tx, this._ty, 7, this.atk, 16, '#00aaff');
      this.shootTimer = cooldown / this.berserkerMul();
    }
  }
};

/**
 * @this {Enemy}
 * @param {number} dt
 * @param {any} player
 * @param {any} map
 * @param {number} d
 * @param {boolean} los
 * @returns {void}
 */
Enemy.prototype.aiSplitter = function aiSplitter(dt, player, map, d, los) {
  const speedMul = this.hp < this.maxHp * 0.3 ? 1.3 : 1;
  if (los && d < 10) {
    this.state = 'CHASE';
    this.moveToward(this._tx, this._ty, this.spd * speedMul, dt, map);
    if (d < 1.2) this.meleeAttack(player);
  } else {
    this.state = 'PATROL';
    this.patrol(dt, map);
  }
};

/**
 * @this {Enemy}
 * @param {number} dt
 * @param {any} player
 * @param {any} map
 * @param {number} d
 * @param {boolean} los
 * @returns {void}
 */
Enemy.prototype.aiShard = function aiShard(dt, player, map, d, los) {
  if (los || (d < 8 && this._canTarget())) {
    this.zigzag += dt * 6;
    const [dx, dy] = norm(this._tx - this.x, this._ty - this.y);
    const perp = { x: -dy, y: dx };
    const tx = this._tx + perp.x * Math.sin(this.zigzag) * 1.2;
    const ty = this._ty + perp.y * Math.sin(this.zigzag) * 1.2;
    this.moveToward(tx, ty, this.spd, dt, map);
    if (d < 1.2) this.meleeAttack(player);
  } else {
    this.patrol(dt, map);
  }
};
