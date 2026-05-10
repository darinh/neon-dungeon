// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { readSourceFile } = require('./_source-files.js');

const ROOT = path.resolve(__dirname, '..');
const EVENTS_SRC = readSourceFile(__dirname, 'contentEvents');
const GAME = fs.readFileSync(path.join(ROOT, 'src', 'game.js'), 'utf8');
const SPEC = fs.readFileSync(path.join(ROOT, 'docs', 'spec.md'), 'utf8');
const biomes = require(path.join(ROOT, 'src', 'data', 'biomes.js'));

/**
 * @param {string} src
 * @param {string} name
 */
function extractArrayBlock(src, name) {
  const start = src.indexOf('const ' + name + ' = [');
  assert.ok(start >= 0, name + ' declaration must exist');
  const open = src.indexOf('[', start);
  assert.ok(open > start, name + ' must be an array literal');
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  assert.fail(name + ' array literal must be balanced');
}

/**
 * @param {string} src
 * @param {string} name
 */
function extractObjectBlock(src, name) {
  const start = src.indexOf('const ' + name + ' = {');
  assert.ok(start >= 0, name + ' declaration must exist');
  const open = src.indexOf('{', start);
  assert.ok(open > start, name + ' must be an object literal');
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  assert.fail(name + ' object literal must be balanced');
}

/**
 * @param {string} src
 * @param {string} name
 */
function extractFunctionSource(src, name) {
  const start = src.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' function must exist');
  const braceStart = src.indexOf('{', start);
  assert.ok(braceStart > start, name + ' function must have a body');
  let depth = 0;
  for (let i = braceStart; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  assert.fail(name + ' function body must be balanced');
}

/** @returns {any} */
function storyEventSandbox() {
  const script = [
    'const EVENTS = ' + extractArrayBlock(EVENTS_SRC, 'EVENTS') + ';',
    'const STORY_PROTOCOL_TRIAL_BY_FLOOR = ' + extractObjectBlock(EVENTS_SRC, 'STORY_PROTOCOL_TRIAL_BY_FLOOR') + ';',
    extractFunctionSource(EVENTS_SRC, 'storyProtocolTrialForFloor'),
    extractFunctionSource(EVENTS_SRC, 'rollEvent'),
    extractFunctionSource(EVENTS_SRC, 'revealFloorLayout'),
    extractFunctionSource(EVENTS_SRC, 'openNearestLockedDoor'),
    extractFunctionSource(EVENTS_SRC, 'spawnProtocolAlarm'),
    extractFunctionSource(EVENTS_SRC, 'applyEventEffect'),
    'this.EVENTS = EVENTS;',
    'this.rollEvent = rollEvent;',
    'this.applyEventEffect = applyEventEffect;',
  ].join('\n');
  const sandbox = {
    MAP_H: 4,
    MAP_W: 4,
    MAX_AUGMENTS: 3,
    T: { VOID: 0, FLOOR: 2, DOOR_OPEN: 6, LOCKED_R: 7, LOCKED_B: 8, LOCKED_G: 9 },
    HACKWARE_KEYS: ['PING'],
    HACKWARE: { PING: { name: 'Ping', colour: '#0ff' } },
    AUGMENT_KEYS: [],
    AUGMENTS: {},
    NEON: {},
    enemies: [],
    items: [],
    combo: { count: 0, timer: 0, flashTimer: 0 },
    audio: { augmentInstall() {} },
    rand() { return 0; },
    rndInt(/** @type {number} */ _lo, /** @type {number} */ _hi) { return 0; },
    rnd(/** @type {number} */ _lo, /** @type {number} */ _hi) { return 0; },
    hasAugment() { return false; },
    doorKeyColour(/** @type {number} */ t) { return t === 7 ? 'red' : t === 8 ? 'blue' : t === 9 ? 'gold' : null; },
    spawnParticles() {},
    pickEnemyType() { return 'GUARD'; },
    spawnEnemy(/** @type {string} */ type, /** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ floor, /** @type {any} */ room) { return { type, x, y, floor, room }; },
    Item: class Item {
      constructor(/** @type {number} */ x, /** @type {number} */ y) {
        this.x = x;
        this.y = y;
        this.isItem = true;
      }
    },
    rollWeapon() { return { name: 'Test Weapon' }; },
  };
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox);
  return sandbox;
}

test('event terminals include story-mechanical protocol trials', () => {
  const events = extractArrayBlock(EVENTS_SRC, 'EVENTS');

  for (const id of ['ROUTE_PROOF', 'COOPERATION_PROTOCOL', 'CONSENT_LOCK']) {
    assert.match(events, new RegExp("id:'" + id + "'"), id + ' must exist in EVENTS');
  }

  assert.match(events, /ROUTE_PROOF[\s\S]*summary:'reveal map \+XP'[\s\S]*summary:'open lock \+credits −HP'/,
    'Route Proof must make floor knowledge and locked-door bypass the actual reward');
  assert.match(events, /COOPERATION_PROTOCOL[\s\S]*summary:'−credits \+heal \+XP'[\s\S]*summary:'\+credits \+combo \+alarm'/,
    'Cooperation Protocol must mechanically contrast shared resources with isolated optimization');
  assert.match(events, /CONSENT_LOCK[\s\S]*summary:'\+item \+XP'[\s\S]*summary:'\+credits \+score \+alarm'/,
    'Consent Lock must mechanically contrast request and override paths');
});

test('rollEvent guarantees protocol trials on selected non-boss story floors', () => {
  const rollEvent = extractFunctionSource(EVENTS_SRC, 'rollEvent');
  const storyTrial = extractFunctionSource(EVENTS_SRC, 'storyProtocolTrialForFloor');

  assert.match(EVENTS_SRC, /const STORY_PROTOCOL_TRIAL_BY_FLOOR = \{\s*2: 'ROUTE_PROOF',\s*5: 'COOPERATION_PROTOCOL',\s*8: 'CONSENT_LOCK',\s*\}/,
    'story floors must map to stable protocol trial ids');
  assert.match(storyTrial, /return STORY_PROTOCOL_TRIAL_BY_FLOOR\[floor\] \|\| null;/,
    'storyProtocolTrialForFloor must not invent non-story-floor events');
  for (const floor of [2, 5, 8]) {
    assert.equal(biomes.isBiomeBossFloor(floor), false, 'floor ' + floor + ' must be eligible for event-room generation');
  }
  assert.match(rollEvent, /function rollEvent\(player, floor\)/,
    'rollEvent must accept current floor context');
  assert.match(rollEvent, /const storyId = storyProtocolTrialForFloor\(\(floor \|\| 0\) \| 0\);[\s\S]*const storyEvent = available\.find\(e => e\.id === storyId\);[\s\S]*if \(storyEvent\) return storyEvent;/,
    'story-floor trials must be selected before random fallback');
  assert.match(GAME, /const ev = rollEvent\(player, this\.floor\);/,
    'event terminal interaction must pass the active floor to rollEvent');

  const sandbox = storyEventSandbox();
  const player = { augments: {}, credits: 0 };
  assert.equal(sandbox.rollEvent(player, 2).id, 'ROUTE_PROOF');
  assert.equal(sandbox.rollEvent(player, 5).id, 'COOPERATION_PROTOCOL');
  assert.equal(sandbox.rollEvent(player, 8).id, 'CONSENT_LOCK');
});

test('protocol trial effects mutate real floor and run state', () => {
  const applyEventEffect = extractFunctionSource(EVENTS_SRC, 'applyEventEffect');

  assert.match(EVENTS_SRC, /function revealFloorLayout\(gm\)[\s\S]*dungeon\.visited\[ty\]\[tx\] = 1;[\s\S]*gm\.markMinimapDirty\(\);/,
    'Route Proof must use a helper that reveals non-secret map tiles and marks the minimap dirty');
  assert.match(EVENTS_SRC, /function openNearestLockedDoor\(gm, player\)[\s\S]*T\.LOCKED_R[\s\S]*T\.LOCKED_B[\s\S]*T\.LOCKED_G[\s\S]*dungeon\.map\[best\.y\]\[best\.x\] = T\.DOOR_OPEN;/,
    'Route Proof patch path must actually open a locked door');
  assert.match(EVENTS_SRC, /dungeon\.map\[best\.y\]\[best\.x\] = T\.DOOR_OPEN;[\s\S]*gm\.markMapMutated\(\);/,
    'Route Proof patch path must invalidate map, LOS, and FOV caches after opening a lock');
  assert.match(EVENTS_SRC, /function spawnProtocolAlarm\(gm, floor, count, colour\)[\s\S]*spawnEnemy\(pickEnemyType\(floor\)[\s\S]*enemies\.push\(e\);/,
    'riskier protocol paths must spawn real enemies through the floor enemy table');

  assert.match(applyEventEffect, /case 'ROUTE_PROOF': \{[\s\S]*revealFloorLayout\(gm\);[\s\S]*player\.gainXP\(xp\);/,
    'Route Proof A must reveal the map and award XP');
  assert.match(applyEventEffect, /case 'ROUTE_PROOF': \{[\s\S]*const opened = openNearestLockedDoor\(gm, player\);[\s\S]*player\.takeDamage\(10, 'Protocol Backlash'\);/,
    'Route Proof B must bypass a lock and carry a backlash cost');
  assert.match(applyEventEffect, /case 'COOPERATION_PROTOCOL': \{[\s\S]*const requiredShare = 25 \+ floor \* 3;[\s\S]*if \(share <= 0\)[\s\S]*player\.credits -= share;[\s\S]*if \(player\.hackware && share === requiredShare\) player\.hackwareCooldown = 0;/,
    'Cooperation Protocol A must spend credits for scaled shared stability');
  assert.match(applyEventEffect, /case 'COOPERATION_PROTOCOL': \{[\s\S]*combo\.count = Math\.max\(combo\.count, 4\);[\s\S]*spawnProtocolAlarm\(gm, floor, 2, '#66ffcc'\);/,
    'Cooperation Protocol B must grant tempo while triggering an alarm');
  assert.match(applyEventEffect, /case 'CONSENT_LOCK': \{[\s\S]*items\.push\(new Item\(player\.x, player\.y\)\);[\s\S]*player\.gainXP\(xp\);/,
    'Consent Lock A must request help and grant item plus XP');
  assert.match(applyEventEffect, /case 'CONSENT_LOCK': \{[\s\S]*player\.score \+= 250 \* floor;[\s\S]*spawnProtocolAlarm\(gm, floor, 3, '#ffcc66'\);/,
    'Consent Lock B must pay more but create witnesses');
});

test('protocol trial effects execute concrete runtime state changes', () => {
  const sandbox = storyEventSandbox();
  const route = sandbox.EVENTS.find((/** @type {any} */ e) => e.id === 'ROUTE_PROOF');
  const coop = sandbox.EVENTS.find((/** @type {any} */ e) => e.id === 'COOPERATION_PROTOCOL');
  const consent = sandbox.EVENTS.find((/** @type {any} */ e) => e.id === 'CONSENT_LOCK');
  assert.ok(route && coop && consent);

  /** @returns {any} */
  const makePlayer = () => ({
    x: 1.5,
    y: 1.5,
    hp: 50,
    maxHp: 100,
    credits: 100,
    score: 0,
    hackware: 'PING',
    hackwareCooldown: 9,
    augments: {},
    xp: 0,
    lastDamage: '',
    gainXP(/** @type {number} */ n) { this.xp += n; },
    takeDamage(/** @type {number} */ n, /** @type {string} */ source) { this.hp -= n; this.lastDamage = source; },
  });
  /** @returns {any} */
  const makeGm = () => ({
    floor: 2,
    dungeon: {
      map: [
        [2, 2, 2, 0],
        [2, 7, 2, 2],
        [2, 2, 2, 2],
        [0, 2, 2, 2],
      ],
      visited: [
        new Uint8Array([0, 0, 0, 0]),
        new Uint8Array([0, 0, 0, 0]),
        new Uint8Array([0, 0, 0, 0]),
        new Uint8Array([0, 0, 0, 0]),
      ],
      secretMask: [
        new Uint8Array([0, 0, 0, 0]),
        new Uint8Array([0, 0, 0, 0]),
        new Uint8Array([0, 0, 1, 0]),
        new Uint8Array([0, 0, 0, 0]),
      ],
    },
    eventChoice: { room: { cx: 1, cy: 1 } },
    dirty: 0,
    mutated: 0,
    /** @type {{text:string, colour:string}[]} */
    messages: [],
    markMinimapDirty() { this.dirty++; },
    markMapMutated() { this.mutated++; },
    msg(/** @type {string} */ text, /** @type {string} */ colour) { this.messages.push({ text, colour }); },
  });

  let player = makePlayer();
  let gm = makeGm();
  sandbox.applyEventEffect(route, 'a', player, gm);
  assert.equal(gm.dirty, 1);
  assert.equal(gm.dungeon.visited[0][0], 1);
  assert.equal(gm.dungeon.visited[2][2], 0, 'secret tiles stay hidden');
  assert.ok(player.xp > 0);

  player = makePlayer();
  gm = makeGm();
  sandbox.applyEventEffect(route, 'b', player, gm);
  assert.equal(gm.dungeon.map[1][1], 6);
  assert.equal(gm.mutated, 1);
  assert.equal(player.lastDamage, 'Protocol Backlash');
  assert.equal(player.hp, 40);

  player = makePlayer();
  player.credits = 0;
  gm = makeGm();
  sandbox.applyEventEffect(coop, 'a', player, gm);
  assert.equal(player.hp, 50, 'zero-credit cooperation must not grant free healing');
  assert.equal(player.xp, 0, 'zero-credit cooperation must not grant free XP');
  assert.equal(player.hackwareCooldown, 9, 'zero-credit cooperation must not reset hackware');

  player = makePlayer();
  player.credits = 20;
  gm = makeGm();
  sandbox.applyEventEffect(coop, 'a', player, gm);
  assert.equal(player.credits, 0);
  assert.ok(player.hp > 50 && player.hp < 85, 'partial share scales healing below the full reward');
  assert.ok(player.xp > 0);
  assert.equal(player.hackwareCooldown, 9, 'partial share does not reset hackware');

  player = makePlayer();
  gm = makeGm();
  sandbox.enemies.length = 0;
  sandbox.applyEventEffect(coop, 'b', player, gm);
  assert.equal(sandbox.enemies.length, 2);
  assert.ok(sandbox.combo.count >= 4);

  player = makePlayer();
  gm = makeGm();
  sandbox.items.length = 0;
  sandbox.applyEventEffect(consent, 'a', player, gm);
  assert.equal(sandbox.items.length, 1);
  assert.ok(player.xp > 0);

  player = makePlayer();
  gm = makeGm();
  sandbox.enemies.length = 0;
  sandbox.applyEventEffect(consent, 'b', player, gm);
  assert.equal(sandbox.enemies.length, 3);
  assert.ok(player.score > 0);
});

test('spec documents protocol trials as story-driven level mechanics', () => {
  assert.match(SPEC, /Game Specification v6\.1\.86/);
  assert.match(SPEC, /\*\*11 Events\*\* \(selected randomly per terminal, filtered by player state, with protocol trials guaranteed on selected story floors\):/);
  assert.match(SPEC, /\| Route Proof \| Reveal non-secret floor map \+ XP \+score \| Open nearest locked door, \+credits, −10 HP \|/);
  assert.match(SPEC, /Floors 2, 5, and 8 force story-mechanical trials \(`Route Proof`, `Cooperation Protocol`, `Consent Lock`\)/);
  assert.match(SPEC, /\| v6\.1\.20 \| Story-driven event-room pass shipped:/);
});
