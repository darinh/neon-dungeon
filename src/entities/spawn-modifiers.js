// @ts-check

/**
 * Scale before construction so maxHp stays in sync with the adjusted spawn HP.
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
  // FRAGILE scales non-boss HP only. Player.takeDamage multiplies non-ignored
  // incoming damage by 1.3; bosses are exempt here.
  if (modifier === 'FRAGILE')   return Math.round(hp * 0.55);
  return hp;
}

/**
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
