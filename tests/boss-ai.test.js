'use strict';
// @ts-check

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { readSourceFile } = require('./_source-files.js');

const ENTITIES = readSourceFile(__dirname, 'entities');
const ENEMY_BOSS_AI = readSourceFile(__dirname, 'entitiesEnemyBossAi');

function makeSandbox() {
  const events = [];
  const projectiles = [];
  const enemies = [];
  const hazardZones = [];
  const player = {
    x: 4,
    y: 4,
    damage: [],
    takeDamage(amount, source) {
      this.damage.push([amount, source]);
      return amount;
    },
  };
  function Projectile(x, y, dx, dy, spd, dmg, range, colour, pierce, homing) {
    Object.assign(this, { x, y, dx, dy, spd, dmg, range, colour, pierce, homing });
  }
  function Enemy() {}
  const sandbox = {
    Enemy,
    Projectile,
    projectiles,
    enemies,
    hazardZones,
    TWO_PI: Math.PI * 2,
    MAP_W: 20,
    MAP_H: 20,
    _EG: {
      floor: 7,
      player,
      msg: (...args) => events.push(['msg', ...args]),
    },
    audio: {
      phaseShift: () => events.push(['phaseShift']),
      shoot: (...args) => events.push(['shoot', ...args]),
      wardenCharge: () => events.push(['wardenCharge']),
      wardenSlam: () => events.push(['wardenSlam']),
      conductorArc: () => events.push(['conductorArc']),
      conductorPulse: () => events.push(['conductorPulse']),
      genesisLance: () => events.push(['genesisLance']),
      genesisPurge: () => events.push(['genesisPurge']),
    },
    spawnParticles: (...args) => events.push(['particles', ...args]),
    triggerShake: (...args) => events.push(['shake', ...args]),
    getDiff: () => ({ enemyAtk: 1 }),
    playerKnockMul: () => 1,
    clampToBossRoom: entity => events.push(['clamp', entity]),
    canTargetPlayer: () => true,
    spawnEnemy: (type, x, y, floor, room, elite) => ({ type, x, y, floor, room, elite, dead: false, isBoss: false }),
    enemiesInRoomIter: () => enemies.values(),
    isPassable: tile => tile !== 0,
    rand: () => 0.5,
    rnd: (min, max) => (min + max) / 2,
    rndInt: min => min,
    dist: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
    norm: (x, y) => {
      const len = Math.hypot(x, y) || 1;
      return [x / len, y / len];
    },
    Math,
  };
  vm.runInNewContext(ENEMY_BOSS_AI, sandbox);
  return { sandbox, events, projectiles, enemies, hazardZones, player };
}

function makeBoss(sandbox, type, overrides = {}) {
  const boss = new sandbox.Enemy();
  Object.assign(boss, {
    type,
    x: 2,
    y: 2,
    hp: 10,
    maxHp: 10,
    atk: 10,
    spd: 2,
    phase: 1,
    prevPhase: 1,
    colour: '#fff',
    bossTimers: {},
    spawnCooldown: 0,
    room: { x: 0, y: 0, w: 10, h: 10, cx: 5, cy: 5 },
    voidOrbs: [],
    bobAngle: 0,
    moveToward: (...args) => { boss.moved = args; },
    fireAt: (...args) => { boss.fired = args; },
    patrol: (...args) => { boss.patrolled = args; },
  }, overrides);
  return boss;
}

test('boss AI dispatch remains in entities.js while bodies live in enemy-boss-ai.js', () => {
  for (const [type, name] of [
    ['SENTINEL', 'Sentinel'],
    ['WARDEN', 'Warden'],
    ['HIVE', 'Hive'],
    ['CONDUCTOR', 'Conductor'],
    ['OMEGA', 'Omega'],
    ['GENESIS', 'Genesis'],
  ]) {
    assert.match(ENTITIES, new RegExp(`case\\s+'${type}':\\s*this\\.aiBoss${name}\\(dt,player,map,d,los\\);`));
    assert.doesNotMatch(ENTITIES, new RegExp(`aiBoss${name}\\s*\\(\\s*dt\\s*,\\s*player\\s*,\\s*map\\s*,\\s*d\\s*,\\s*los\\s*\\)\\s*\\{`));
    assert.match(ENEMY_BOSS_AI, new RegExp(`Enemy\\.prototype\\.aiBoss${name}\\s*=\\s*function\\s+aiBoss${name}\\s*\\(`));
  }
});

test('SENTINEL boss AI preserves phase shift, radial shots, tracking fire, and shield burst', () => {
  const { sandbox, events, projectiles, player } = makeSandbox();
  Object.assign(player, { x: 5, y: 2 });
  const boss = makeBoss(sandbox, 'SENTINEL', {
    hp: 3,
    maxHp: 10,
    bossTimers: { laser: 0, move: 0, shield: 0, track: 0 },
  });

  boss.aiBossSentinel(0.1, player, { id: 'map' }, 3, true);

  assert.equal(boss.phase, 2);
  assert.deepEqual(events[0], ['particles', 2, 2, 'EXPLOSION', '#fff', 20]);
  assert.deepEqual(events[1], ['phaseShift']);
  assert.deepEqual(events[2], ['msg', '⚠ SENTINEL PHASE 2', '#ff4444']);
  assert.equal(projectiles.length, 8);
  assert.equal(projectiles.every(p => p.ownerType === 'SENTINEL'), true);
  assert.deepEqual(boss.fired, [5, 2, 8, 13, 16, '#ff6666']);
  assert.deepEqual(player.damage, [[20, 'SENTINEL']]);
  assert.equal(boss.bossTimers.laser, 2);
  assert.equal(boss.bossTimers.track, 2.5);
  assert.equal(boss.bossTimers.shield, 5);
});

test('WARDEN boss AI preserves multi-tick charge windup, hit, stomp, and room clamp', () => {
  const { sandbox, events, projectiles, player } = makeSandbox();
  Object.assign(player, { x: 2.5, y: 2, damage: [] });
  const boss = makeBoss(sandbox, 'WARDEN', {
    x: 2,
    y: 2,
    bossTimers: { charge: 0, stomp: 99, slam: 99, move: 99 },
    _chargeState: 'idle',
  });

  boss.aiBossWarden(0.1, player, [[1]], 0.5, true);
  assert.equal(boss._chargeState, 'windup');
  assert.equal(boss.bossTimers.charge, 99);
  assert.equal(boss._chargeWindup, 0.6);

  boss.aiBossWarden(0.7, player, [[1]], 0.5, true);
  assert.equal(boss._chargeState, 'charging');
  assert.equal(boss._chargeDur, 0.3);
  assert.deepEqual(events.at(-1), ['wardenCharge']);

  boss.aiBossWarden(0.1, player, [[1]], 0.5, true);
  assert.equal(boss._chargeState, 'idle');
  assert.deepEqual(player.damage, [[10, 'WARDEN']]);
  assert.equal(events.some(e => e[0] === 'clamp' && e[1] === player), true);
  assert.equal(boss.bossTimers.charge, 3.5);

  boss.bossTimers.stomp = 0;
  boss.aiBossWarden(0, player, [[1]], 2, true);
  assert.equal(projectiles.length, 4);
  assert.equal(projectiles.every(p => p.ownerType === 'WARDEN'), true);
  assert.equal(boss.bossTimers.stomp, 6);
});

test('HIVE boss AI preserves phase-three spawn, swarm, shock, and _EG.player targeting', () => {
  const { sandbox, projectiles, enemies, player } = makeSandbox();
  Object.assign(player, { x: 3, y: 2, damage: [] });
  const boss = makeBoss(sandbox, 'HIVE', {
    hp: 2,
    maxHp: 10,
    bossTimers: { homing: 0, spawn: 0, shock: 0, swarm: 0, move: 99 },
    spawnCooldown: 0,
  });

  boss.aiBossHive(0.1, player, [[1]], 1, true);

  assert.equal(boss.phase, 3);
  assert.deepEqual(boss.fired, [3, 2, 6, 10, 18, '#aa00ff']);
  assert.equal(enemies.length, 2);
  assert.equal(enemies.every(e => e.type === 'CRAWLER' && e.room === boss.room), true);
  assert.equal(projectiles.length, 5);
  assert.equal(projectiles.every(p => p.ownerType === 'HIVE'), true);
  assert.deepEqual(player.damage, [[25, 'HIVE']]);
  assert.equal(boss.spawnCooldown, 1);
});

test('CONDUCTOR boss AI preserves discharge channel, passability-gated pull, and pulse projectiles', () => {
  const { sandbox, events, projectiles, player } = makeSandbox();
  Object.assign(player, { x: 5, y: 2, damage: [] });
  const boss = makeBoss(sandbox, 'CONDUCTOR', {
    x: 2,
    y: 2,
    hp: 1,
    maxHp: 10,
    phase: 3,
    prevPhase: 3,
    bossTimers: { arc: 99, hazard: 99, beam: 99, discharge: 0, move: 99 },
  });
  const map = Array.from({ length: 20 }, () => Array.from({ length: 20 }, () => 1));
  map[2][3] = 0;

  boss.aiBossConductor(0.1, player, map, 3, true);
  assert.equal(boss._dischargeChannel, 1.4);
  assert.equal(boss.bossTimers.discharge, 99);

  boss.aiBossConductor(1.6, player, map, 3, true);
  assert.equal(player.x, 7.4);
  assert.equal(player.y, 2);
  assert.equal(events.some(e => e[0] === 'clamp' && e[1] === player), true);
  assert.deepEqual(player.damage, [[25, 'Conductor Pulse']]);
  assert.equal(projectiles.length, 6);
  assert.equal(projectiles.every(p => p.ownerType === 'CONDUCTOR'), true);
  assert.equal(boss._dischargeChannel, 0);
  assert.equal(boss.bossTimers.discharge, 5);
});

test('OMEGA boss AI preserves active-add cap, void-orb spawning, and void-orb lifecycle', () => {
  const { sandbox, projectiles, enemies, player } = makeSandbox();
  Object.assign(player, { x: 5, y: 5, damage: [] });
  enemies.push({ dead: false, isBoss: false }, { dead: false, isBoss: false });
  const boss = makeBoss(sandbox, 'OMEGA', {
    hp: 1,
    maxHp: 10,
    bossTimers: { turret: 99, homing: 99, spawn: 0, beam: 99, shield: 99, void: 0, shock: 99, move: 99 },
    voidOrbs: [{ x: 5, y: 5, radius: 0, maxRadius: 4, age: 0.4, maxAge: 2.5, tickCd: 0 }],
  });

  boss.aiBossOmega(0.2, player, [[1]], 4, false);

  assert.equal(boss.phase, 4);
  assert.equal(enemies.length, 5);
  assert.equal(enemies.slice(2).every(e => e.type === 'CRAWLER'), true);
  assert.equal(boss.voidOrbs.length, 3);
  assert.ok(Math.abs(boss.voidOrbs[0].radius - (4 * (0.6 / (2.5 * 0.6)))) < 1e-12);
  assert.equal(player.damage.length, 3);
  assert.equal(player.damage.every(hit => hit[1] === 'Void Orb'), true);
  assert.equal(boss.voidOrbs[0].tickCd, 0.5);

  boss.bossTimers = { turret: 99, homing: 99, spawn: 99, beam: 99, shield: 99, void: 99, shock: 99, move: 99 };
  boss.voidOrbs = [{ x: 5, y: 5, radius: 0, maxRadius: 2, age: 2.4, maxAge: 2.5, tickCd: 0 }];
  boss.aiBossOmega(0.2, player, [[1]], 4, false);
  assert.deepEqual(boss.voidOrbs, []);
  assert.equal(projectiles.length, 0);
});

test('GENESIS boss AI preserves unchained phase lock, seeded timers, lance fire/cancel, and purge hazards', () => {
  const { sandbox, hazardZones, projectiles, player } = makeSandbox();
  Object.assign(player, { x: 7, y: 5, damage: [] });
  const boss = makeBoss(sandbox, 'GENESIS', {
    x: 5,
    y: 5,
    _unchainedPhase: true,
    phase: 1,
    prevPhase: 1,
    bossTimers: { move: 99 },
  });

  boss.aiBossGenesis(0.1, player, [[1]], 2, true);

  assert.equal(boss.phase, 3);
  assert.equal(boss.prevPhase, 3);
  assert.equal(boss.bossTimers.spiral, 0.9);
  assert.equal(boss.bossTimers.lance, 1.4);
  assert.equal(boss.bossTimers.hazard, 1.9);
  assert.equal(boss.bossTimers.purge, 3.9);

  boss._lanceTelegraph = 0.1;
  boss._lanceLock = { x: 7, y: 5 };
  boss.bossTimers = { spiral: 99, lance: 99, hazard: 99, purge: 99, move: 99 };
  boss.aiBossGenesis(0.2, player, [[1]], 2, true);
  assert.equal(projectiles.length, 5);
  assert.equal(projectiles.every(p => p.ownerType === 'GENESIS'), true);
  assert.equal(boss._lanceLock, null);

  projectiles.length = 0;
  boss._lanceTelegraph = 0.1;
  boss._lanceLock = { x: 7, y: 5 };
  boss.aiBossGenesis(0, player, [[1]], 2, false);
  assert.equal(projectiles.length, 0);
  assert.equal(boss._lanceTelegraph, 0);
  assert.equal(boss._lanceLock, null);
  assert.equal(boss.bossTimers.lance, 1.0);

  const hazardOffsets = [4, 4, -4, 4, 4, -4];
  sandbox.rnd = () => hazardOffsets.shift() ?? 4;
  boss.bossTimers = { spiral: 99, lance: 99, hazard: 0, purge: 0, move: 99 };
  boss.aiBossGenesis(0, player, [[1]], 2, true);
  assert.equal(hazardZones.filter(z => z.source === 'Genesis Field').length, 3);
  assert.equal(hazardZones.filter(z => z.source === 'Genesis Purge').length, 5);
  assert.equal(boss.bossTimers.hazard, 4);
  assert.equal(boss.bossTimers.purge, 8);
});
