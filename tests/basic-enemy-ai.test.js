'use strict';
// @ts-check

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const ENTITIES_SRC = fs.readFileSync(path.join(ROOT, 'src', 'entities.js'), 'utf8');
const BASIC_AI_SRC = fs.readFileSync(path.join(ROOT, 'src', 'entities', 'enemy-basic-ai.js'), 'utf8');

function loadBasicAi() {
  const sandbox = {
    Enemy: function Enemy() {},
    _EG: { floor: 5, modifier: '', bossSealed: false, challengeSealed: false },
    norm: (x, y) => {
      const len = Math.hypot(x, y) || 1;
      return [x / len, y / len];
    },
  };
  vm.runInNewContext(BASIC_AI_SRC, sandbox);
  return sandbox;
}

function makeEnemy(sandbox) {
  const enemy = new sandbox.Enemy();
  Object.assign(enemy, {
    x: 0,
    y: 0,
    _tx: 6,
    _ty: 8,
    spd: 2,
    atk: 3,
    hp: 5,
    maxHp: 10,
    shootTimer: 0,
    zigzag: 0,
    _canTarget: () => true,
    berserkerMul: () => 2,
    moveToward: (...args) => { enemy.moved = args; },
    meleeAttack: (target) => { enemy.meleeTarget = target; },
    patrol: (...args) => { enemy.patrolled = args; },
    fireAt: (...args) => { enemy.fired = args; },
  });
  return enemy;
}

test('basic enemy AI module defines starter prototype methods', () => {
  for (const name of ['aiGuard', 'aiTurret', 'aiCrawler', 'aiBrute', 'aiDrone', 'aiSplitter', 'aiShard']) {
    assert.match(BASIC_AI_SRC, new RegExp(`Enemy\\.prototype\\.${name}\\s*=\\s*function\\s+${name}\\s*\\(`),
      `${name} should be a named prototype function`);
    assert.doesNotMatch(ENTITIES_SRC, new RegExp(`${name}\\s*\\(dt,\\s*player,\\s*map,\\s*d,\\s*los\\)\\s*\\{`),
      `${name} implementation should stay extracted from src/entities.js`);
  }
});

test('basic enemy AI dispatch cases remain wired in Enemy.update', () => {
  for (const type of ['GUARD', 'TURRET', 'CRAWLER', 'BRUTE', 'DRONE', 'SPLITTER', 'SHARD']) {
    const method = `ai${type[0]}${type.slice(1).toLowerCase()}`;
    assert.match(ENTITIES_SRC, new RegExp(`case\\s+'${type}':\\s*this\\.${method}\\(dt,player,map,d,los\\);`),
      `${type} dispatch should call ${method}`);
  }
});

test('aiGuard switches between chase and patrol using floor-scaled range', () => {
  const sandbox = loadBasicAi();
  const player = {};
  const enemy = makeEnemy(sandbox);

  enemy.aiGuard(0.1, player, {}, 5, true);
  assert.equal(enemy.state, 'CHASE');
  assert.deepEqual(enemy.moved, [6, 8, 2, 0.1, {}]);
  assert.equal(enemy.meleeTarget, undefined);

  enemy.aiGuard(0.2, player, { p: true }, 15, false);
  assert.equal(enemy.state, 'PATROL');
  assert.deepEqual(enemy.patrolled, [0.2, { p: true }]);
});

test('aiTurret fires at perceived target and applies cooldown scaling', () => {
  const sandbox = loadBasicAi();
  sandbox._EG.floor = 5;
  const enemy = makeEnemy(sandbox);

  enemy.aiTurret(0.1, {}, {}, 11, true);

  assert.deepEqual(enemy.fired, [6, 8, 8, 3, 13, '#ffb700']);
  assert.equal(enemy.shootTimer, (2.0 - 5 * 0.11) / 2);
});

test('aiCrawler and aiShard zigzag toward the perceived target or patrol', () => {
  const sandbox = loadBasicAi();
  const crawler = makeEnemy(sandbox);
  const shard = makeEnemy(sandbox);

  crawler.aiCrawler(0.2, {}, {}, 7, false);
  assert.equal(crawler.zigzag, 1);
  assert.equal(crawler.moved[2], 2);

  shard.aiShard(0.25, {}, {}, 7, false);
  assert.equal(shard.zigzag, 1.5);
  assert.equal(shard.moved[2], 2);

  const blindCrawler = makeEnemy(sandbox);
  blindCrawler._canTarget = () => false;
  blindCrawler.aiCrawler(0.3, {}, { blind: true }, 9, false);
  assert.deepEqual(blindCrawler.patrolled, [0.3, { blind: true }]);
});

test('aiBrute chases with distance-weighted speed or patrols', () => {
  const sandbox = loadBasicAi();
  const player = {};
  const enemy = makeEnemy(sandbox);

  enemy.aiBrute(0.1, player, {}, 1.5, true);
  assert.equal(enemy.state, 'CHASE');
  assert.equal(enemy.moved[2], 2 * 0.65);
  assert.equal(enemy.meleeTarget, undefined);

  enemy.aiBrute(0.2, player, { far: true }, 20, false);
  assert.equal(enemy.state, 'PATROL');
  assert.deepEqual(enemy.patrolled, [0.2, { far: true }]);
});

test('aiDrone respects boss/challenge sealed phasing and ranged cooldown', () => {
  const sandbox = loadBasicAi();
  const enemy = makeEnemy(sandbox);

  enemy.aiDrone(0.1, {}, {}, 10, false);
  assert.equal(enemy.moved[5], true);
  assert.deepEqual(enemy.fired, [6, 8, 7, 3, 16, '#00aaff']);
  assert.equal(enemy.shootTimer, (1.5 - 5 * 0.07) / 2);

  const sealed = makeEnemy(sandbox);
  sandbox._EG.bossSealed = true;
  sealed.aiDrone(0.1, {}, {}, 10, false);
  assert.equal(sealed.moved[5], false);
});

test('aiSplitter uses low-health speed multiplier and patrol fallback', () => {
  const sandbox = loadBasicAi();
  const player = {};
  const enemy = makeEnemy(sandbox);

  enemy.aiSplitter(0.1, player, {}, 9, true);
  assert.equal(enemy.state, 'CHASE');
  assert.equal(enemy.moved[2], 2);

  enemy.hp = 2;
  enemy.aiSplitter(0.1, player, {}, 9, true);
  assert.equal(enemy.moved[2], 2 * 1.3);

  enemy.aiSplitter(0.2, player, { blind: true }, 12, false);
  assert.equal(enemy.state, 'PATROL');
  assert.deepEqual(enemy.patrolled, [0.2, { blind: true }]);
});
