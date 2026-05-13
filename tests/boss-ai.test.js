'use strict';
// @ts-check

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readSourceFile } = require('./_source-files.js');

const ENTITIES = readSourceFile(__dirname, 'entities');
const BOSS_AI = readSourceFile(__dirname, 'entitiesBossAi');

function makeEnemyCtor() {
  return function Enemy() {};
}

/**
 * @param {Record<string, any>} [overrides]
 */
function makeSandbox(overrides = {}) {
  /** @type {any[]} */
  const events = [];
  /** @type {any[]} */
  const projectiles = [];
  /** @type {any[]} */
  const enemies = [];
  /** @type {any[]} */
  const hazardZones = [];

  class Projectile {
    /**
     * @param {...any} args
     */
    constructor(...args) {
      this.args = args;
    }
  }

  const sandbox = {
    Enemy: makeEnemyCtor(),
    TWO_PI: Math.PI * 2,
    MAP_W: 30,
    MAP_H: 30,
    Projectile,
    projectiles,
    enemies,
    hazardZones,
    events,
    audio: {
      phaseShift: () => events.push(['audio', 'phaseShift']),
      shoot: (...args) => events.push(['audio', 'shoot', ...args]),
      wardenCharge: () => events.push(['audio', 'wardenCharge']),
      wardenSlam: () => events.push(['audio', 'wardenSlam']),
      conductorArc: () => events.push(['audio', 'conductorArc']),
      conductorPulse: () => events.push(['audio', 'conductorPulse']),
      genesisLance: () => events.push(['audio', 'genesisLance']),
      genesisPurge: () => events.push(['audio', 'genesisPurge']),
    },
    _EG: {
      floor: 6,
      player: {
        x: 8,
        y: 5,
        takeDamage: (...args) => events.push(['egPlayerDamage', ...args]),
      },
      msg: (...args) => events.push(['msg', ...args]),
    },
    spawnParticles: (...args) => events.push(['particles', ...args]),
    triggerShake: (...args) => events.push(['shake', ...args]),
    getDiff: () => ({ enemyAtk: 1 }),
    playerKnockMul: () => 1,
    clampToBossRoom: (player) => { player.clamped = (player.clamped || 0) + 1; },
    norm: (x, y) => {
      const len = Math.hypot(x, y) || 1;
      return [x / len, y / len];
    },
    dist: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
    rnd: (min, max) => (min + max) / 2,
    rndInt: (min) => min,
    rand: () => 0.5,
    isPassable: () => true,
    canTargetPlayer: () => true,
    spawnEnemy: (type, x, y, floor, room, elite) => ({ type, x, y, floor, room, elite }),
    enemiesInRoomIter: () => [],
    ...overrides,
  };
  return sandbox;
}

test('boss AI bodies are extracted while src/entities.js keeps boss dispatch ownership', () => {
  for (const [type, method] of [
    ['SENTINEL', 'aiBossSentinel'],
    ['WARDEN', 'aiBossWarden'],
    ['HIVE', 'aiBossHive'],
    ['CONDUCTOR', 'aiBossConductor'],
    ['OMEGA', 'aiBossOmega'],
    ['GENESIS', 'aiBossGenesis'],
  ]) {
    assert.match(ENTITIES, new RegExp(`case\\s+'${type}':\\s*this\\.${method}\\(dt,player,map,d,los\\);`));
    assert.doesNotMatch(ENTITIES, new RegExp(`${method}\\s*\\(\\s*dt\\s*,\\s*player\\s*,\\s*map\\s*,\\s*d\\s*,\\s*los\\s*\\)\\s*\\{`));
    assert.match(BOSS_AI, new RegExp(`Enemy\\.prototype\\.${method}\\s*=\\s*function\\s+${method}\\s*\\(`));
  }
});

test('SENTINEL boss AI preserves phase transition, radial projectiles, tracking shot, and shield hit', () => {
  const sandbox = makeSandbox();
  vm.runInNewContext(BOSS_AI, sandbox);

  const sentinel = new sandbox.Enemy();
  Object.assign(sentinel, {
    type: 'SENTINEL',
    x: 5,
    y: 5,
    hp: 30,
    maxHp: 100,
    atk: 7,
    phase: 1,
    prevPhase: 1,
    colour: '#ff4444',
    bossTimers: {},
    room: { cx: 5, cy: 5 },
    moveToward: (...args) => { sentinel.moved = args; },
    fireAt: (...args) => { sentinel.fired = args; },
  });
  const player = {
    x: 8,
    y: 5,
    takeDamage: (...args) => sandbox.events.push(['playerDamage', ...args]),
  };

  sentinel.aiBossSentinel(0.25, player, { id: 'map' }, 3, true);

  assert.equal(sentinel.phase, 2);
  assert.deepEqual(sandbox.events.find(e => e[0] === 'msg'), ['msg', '⚠ SENTINEL PHASE 2', '#ff4444']);
  assert.equal(sandbox.projectiles.length, 8);
  assert.equal(sandbox.projectiles.every(p => p.ownerType === 'SENTINEL'), true);
  assert.deepEqual(sentinel.fired, [8, 5, 8, 10, 16, '#ff6666']);
  assert.deepEqual(sandbox.events.find(e => e[0] === 'playerDamage'), ['playerDamage', 20, 'SENTINEL']);
  assert.equal(player.clamped, 1);
  assert.equal(sentinel.bossTimers.shield, 5);
});

test('HIVE boss AI preserves add spawning and shock/player side effects', () => {
  const sandbox = makeSandbox();
  vm.runInNewContext(BOSS_AI, sandbox);

  const hive = new sandbox.Enemy();
  Object.assign(hive, {
    type: 'HIVE',
    x: 5,
    y: 5,
    hp: 25,
    maxHp: 100,
    atk: 6,
    phase: 1,
    prevPhase: 1,
    colour: '#aa00ff',
    bossTimers: {},
    spawnCooldown: 0,
    room: { x: 0, y: 0, w: 12, h: 12 },
    moveToward: (...args) => { hive.moved = args; },
    fireAt: (...args) => { hive.fired = args; },
  });

  hive.aiBossHive(0.1, { x: 8, y: 5 }, { id: 'map' }, 4, true);

  assert.equal(hive.phase, 3);
  assert.equal(sandbox.enemies.length, 2);
  assert.equal(sandbox.enemies.every(e => e.type === 'CRAWLER' && e.room === hive.room), true);
  assert.equal(hive.spawnCooldown, 1);
  assert.equal(hive.bossTimers.spawn, 5);
  assert.deepEqual(sandbox.events.find(e => e[0] === 'egPlayerDamage'), ['egPlayerDamage', 25, 'HIVE']);
});

test('WARDEN boss AI preserves charge-hit and slam side effects', () => {
  const sandbox = makeSandbox();
  vm.runInNewContext(BOSS_AI, sandbox);

  const charging = new sandbox.Enemy();
  Object.assign(charging, {
    type: 'WARDEN',
    x: 4,
    y: 5,
    hp: 30,
    maxHp: 100,
    atk: 16,
    spd: 2,
    phase: 2,
    prevPhase: 2,
    colour: '#ff8800',
    bossTimers: {},
    room: { x: 0, y: 0, w: 12, h: 12, cx: 6, cy: 6 },
    _chargeState: 'charging',
    _chargeDur: 0.2,
    _chargeDx: 1,
    _chargeDy: 0,
  });
  const chargeTarget = {
    x: 5,
    y: 5,
    takeDamage: (...args) => sandbox.events.push(['chargeDamage', ...args]),
  };

  charging.aiBossWarden(0.1, chargeTarget, { id: 'map' }, 4, true);

  assert.equal(charging._chargeState, 'idle');
  assert.equal(charging.bossTimers.charge, 2.5);
  assert.deepEqual(sandbox.events.find(e => e[0] === 'chargeDamage'), ['chargeDamage', 16, 'WARDEN']);
  assert.equal(chargeTarget.clamped, 1);
  assert.equal(sandbox.events.some(e => e[0] === 'shake' && e[1] === 4), true);

  sandbox.events.length = 0;
  sandbox.projectiles.length = 0;
  const slamming = new sandbox.Enemy();
  Object.assign(slamming, {
    type: 'WARDEN',
    x: 5,
    y: 5,
    hp: 30,
    maxHp: 100,
    atk: 16,
    spd: 2,
    phase: 2,
    prevPhase: 2,
    colour: '#ff8800',
    bossTimers: { charge: 99 },
    room: { x: 0, y: 0, w: 12, h: 12, cx: 6, cy: 6 },
    _chargeState: 'idle',
    moveToward: (...args) => { slamming.moved = args; },
  });
  const slamTarget = {
    x: 6,
    y: 5,
    takeDamage: (...args) => sandbox.events.push(['slamDamage', ...args]),
  };

  slamming.aiBossWarden(0.1, slamTarget, { id: 'map' }, 2, true);

  assert.equal(sandbox.projectiles.length, 12);
  assert.equal(sandbox.projectiles.every(p => p.ownerType === 'WARDEN'), true);
  assert.deepEqual(sandbox.events.find(e => e[0] === 'slamDamage'), ['slamDamage', 22, 'Warden Slam']);
  assert.equal(slamming.bossTimers.stomp, 4);
  assert.equal(slamming.bossTimers.slam, 5);
  assert.equal(slamTarget.clamped, 1);
  assert.equal(sandbox.events.some(e => e[0] === 'audio' && e[1] === 'wardenSlam'), true);
});

test('CONDUCTOR boss AI preserves hazards, beam, discharge pull, and pulse side effects', () => {
  const sandbox = makeSandbox();
  vm.runInNewContext(BOSS_AI, sandbox);

  const conductor = new sandbox.Enemy();
  Object.assign(conductor, {
    type: 'CONDUCTOR',
    x: 5,
    y: 5,
    hp: 20,
    maxHp: 100,
    atk: 20,
    spd: 2,
    phase: 1,
    prevPhase: 1,
    colour: '#00ccff',
    bossTimers: {},
    room: { x: 0, y: 0, w: 12, h: 12, cx: 6, cy: 6 },
    moveToward: (...args) => { conductor.moved = args; },
    fireAt: (...args) => { conductor.fired = args; },
  });
  const map = Array.from({ length: 30 }, () => Array.from({ length: 30 }, () => 1));
  const player = {
    x: 10,
    y: 5,
    takeDamage: (...args) => sandbox.events.push(['pulseDamage', ...args]),
  };

  conductor.aiBossConductor(2, player, map, 5, true);

  assert.equal(conductor.phase, 3);
  assert.equal(sandbox.projectiles.length, 18);
  assert.equal(sandbox.projectiles.every(p => p.ownerType === 'CONDUCTOR'), true);
  assert.equal(sandbox.hazardZones.length, 2);
  assert.equal(sandbox.hazardZones.every(z => z.source === 'Conductor Field' && z.armTimer === 0.8), true);
  assert.deepEqual(conductor.fired, [10, 5, 8, 25, 20, '#00eeff']);
  assert.deepEqual(sandbox.events.find(e => e[0] === 'pulseDamage'), ['pulseDamage', 25, 'Conductor Pulse']);
  assert.equal(player.clamped, 2);
  assert.equal(conductor._dischargeChannel, 0);
  assert.equal(conductor.bossTimers.discharge, 5);
  assert.equal(sandbox.events.some(e => e[0] === 'audio' && e[1] === 'conductorArc'), true);
  assert.equal(sandbox.events.some(e => e[0] === 'audio' && e[1] === 'conductorPulse'), true);
});

test('OMEGA boss AI preserves add cap, room patrol, and void-orb side effects', () => {
  const sandbox = makeSandbox({
    enemiesInRoomIter: function* () {
      yield { dead: false, isBoss: false };
    },
    rndInt: () => 2,
  });
  vm.runInNewContext(BOSS_AI, sandbox);

  const omega = new sandbox.Enemy();
  Object.assign(omega, {
    type: 'OMEGA',
    x: 5,
    y: 5,
    hp: 15,
    maxHp: 100,
    atk: 8,
    bobAngle: 0,
    phase: 1,
    prevPhase: 1,
    colour: '#ff00c8',
    bossTimers: {},
    spawnCooldown: 0,
    voidOrbs: [],
    room: { x: 0, y: 0, w: 12, h: 12 },
    moveToward: (...args) => { omega.moved = args; },
    fireAt: (...args) => { omega.fired = args; },
  });

  omega.aiBossOmega(0.1, { x: 8, y: 5, takeDamage: () => {} }, { id: 'map' }, 6, true);

  assert.equal(omega.phase, 4);
  assert.equal(sandbox.enemies.length, 3);
  assert.equal(sandbox.enemies.every(e => e.type === 'CRAWLER' && e.room === omega.room), true);
  assert.equal(omega.voidOrbs.length, 2);
  assert.equal(sandbox.projectiles.some(p => p.ownerType === 'OMEGA'), true);
  assert.equal(omega.patrolTarget.x, 6);
  assert.equal(omega.patrolTarget.y, 6);
});

test('GENESIS boss AI preserves unchained phase lock, hazards, purge ring, and lance telegraph', () => {
  const rndValues = [0, 0, 2, 0, -2, 0, 0, 2];
  const sandbox = makeSandbox({
    rnd: (min, max) => {
      if (min < 0) return rndValues.shift() ?? 0;
      return (min + max) / 2;
    },
    rndInt: () => 0,
    rand: () => 0,
  });
  vm.runInNewContext(BOSS_AI, sandbox);

  const genesis = new sandbox.Enemy();
  Object.assign(genesis, {
    type: 'GENESIS',
    x: 5,
    y: 5,
    hp: 100,
    maxHp: 100,
    atk: 10,
    spd: 2,
    phase: 1,
    prevPhase: 1,
    colour: '#ffcc00',
    _unchainedPhase: true,
    _lanceTelegraph: 0,
    _lanceLock: null,
    bossTimers: {},
    room: { x: 0, y: 0, w: 12, h: 12, cx: 6, cy: 6 },
    moveToward: (...args) => { genesis.moved = args; },
  });
  const player = { x: 6, y: 5, takeDamage: () => {} };

  genesis.aiBossGenesis(5, player, { id: 'map' }, 5, true);

  assert.equal(genesis.phase, 3);
  assert.deepEqual(sandbox.events.find(e => e[0] === 'msg'), ['msg', '⚠ GENESIS PHASE 3', '#ffcc00']);
  assert.equal(sandbox.projectiles.length, 10);
  assert.equal(sandbox.projectiles.every(p => p.ownerType === 'GENESIS'), true);
  assert.equal(sandbox.hazardZones.filter(z => z.source === 'Genesis Field').length, 3);
  assert.equal(sandbox.hazardZones.filter(z => z.source === 'Genesis Purge').length, 5);
  assert.equal(sandbox.events.some(e => e[0] === 'audio' && e[1] === 'genesisPurge'), true);
  assert.equal(genesis._lanceLock.x, 6);
  assert.equal(genesis._lanceLock.y, 5);
});
