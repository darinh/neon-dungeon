// @ts-check

/**
 * Apply floor-modifier HP scaling before an enemy is constructed so maxHp stays
 * in sync with the adjusted spawn HP.
 *
 * @param {number} hp
 * @param {string | undefined} modifier
 * @param {boolean} isBoss
 * @returns {number}
 */
function scaleEnemySpawnHpForModifier(hp, modifier, isBoss) {
  if (isBoss) return hp;
  if (modifier === 'SWARM')     return Math.round(hp * 0.6);
  if (modifier === 'FORTIFIED') return Math.round(hp * 1.4);
  // FRAGILE: glass-cannon protocol — non-boss enemies have 0.55x HP but
  // damage to player is amplified 1.3x in player.takeDamage. Both sides
  // get more lethal: fast clears reward aggression, single mistakes cost
  // more. Bosses are exempt because HP-ratio phase transitions are tuned
  // tight; see the boss note in src/entities/enemy-stats.js.
  if (modifier === 'FRAGILE')   return Math.round(hp * 0.55);
  return hp;
}

/**
 * Apply difficulty-scaled elite roll for eligible floor-3+ enemies.
 *
 * @param {any} enemy
 * @param {string} type
 * @param {number} floorNum
 * @param {boolean | undefined} allowElite
 * @param {{ eliteRate: number }} difficulty
 * @returns {void}
 */
function applyEliteSpawnRoll(enemy, type, floorNum, allowElite, difficulty) {
  if (allowElite === false || !canRollEliteEnemyType(type) || floorNum < 3 || rand('spawn') >= difficulty.eliteRate) {
    return;
  }

  enemy.elite = true;
  enemy.hp = Math.round(enemy.hp * 1.8);
  enemy.maxHp = enemy.hp;
  enemy.atk = Math.round(enemy.atk * 1.3);
  enemy.spd *= 1.15;
  enemy.xpValue = Math.round(enemy.xpValue * 1.25);
  enemy.eliteAffix = rollEliteAffix(type);
  if (enemy.eliteAffix === 'SHIELDED') {
    enemy.shieldMax = Math.round(enemy.maxHp * 0.4);
    enemy.shieldHp  = enemy.shieldMax;
  }
  if (enemy.eliteAffix === 'PHASING') {
    enemy.phaseTimer = rnd(0, 3, 'spawn');
  }
}
