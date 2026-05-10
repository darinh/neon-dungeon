// @ts-check
'use strict';

// Enemy construction/orchestration depends on Enemy from src/entities.js and
// initializeEnemySpawnState from src/entities/spawn-initializers.js.
/**
 * @param {any} [type]
 * @param {any} [x]
 * @param {any} [y]
 * @param {any} [floorNum]
 * @param {any} [room]
 * @param {any} [allowElite]
 */
function spawnEnemy(type,x,y,floorNum,room,allowElite) {
  const scale=1+0.15*(floorNum-1);
  const d=getDiff();
  const baseStats = getEnemyBaseStats(type);
  let /** @type {number} */ hp = baseStats.hp;
  const /** @type {number} */ atk = baseStats.atk;
  const /** @type {number} */ spd = baseStats.spd;
  const /** @type {number} */ xpVal = baseStats.xpVal;
  const /** @type {string} */ colour = baseStats.colour;
  const isBoss = isBossEnemyType(type);
  hp = scaleEnemySpawnHpForModifier(hp, _EG.modifier, isBoss);
  const e=new Enemy(x,y,
    Math.round(hp*scale*d.enemyHp), Math.round(atk*scale*d.enemyAtk),
    spd*d.enemySpd, xpVal, colour, type);
  e.room=room;
  e.isBoss=isBoss;
  e.elite=false;
  initializeEnemySpawnState(e, type, x, y);
  if (isBoss) { e.maxHp=e.hp; }
  applyEliteSpawnRoll(e, type, floorNum, allowElite, d);
  registerEnemyInRoom(e);
  return e;
}
