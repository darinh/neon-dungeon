// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const ENTITIES = fs.readFileSync(path.join(ROOT, 'src', 'entities.js'), 'utf8');

function loadEnemyClass() {
  const player = { x: 8, y: 5 };
  const sandbox = /** @type {any} */ ({
    player,
    _EG: { dungeon: { visible: Array.from({ length: 20 }, () => new Uint8Array(20).fill(1)) }, floorTime: 0 },
    TILE: 32,
    W: 800,
    H: 600,
    TWO_PI: Math.PI * 2,
    Math,
    Date: { now: () => 0 },
    rand: () => 0,
    isEnemyShieldGenProtected: () => false,
    NEON: {
      draw: {
        /** @param {any} ctx @param {number} x @param {number} y @param {number} r */
        circle(ctx, x, y, r) { ctx.calls.push({ op: 'circle', x, y, r }); },
        circleStroke() {},
        /** @param {any} ctx @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 */
        line(ctx, x1, y1, x2, y2) { ctx.calls.push({ op: 'line', x1, y1, x2, y2 }); },
        arcStroke() {},
      },
      boosts: {},
    },
    ctx: createCtx(),
  });
  const end = ENTITIES.indexOf('class Player');
  assert.ok(end > 0, 'Enemy class should precede Player class');
  vm.createContext(sandbox);
  vm.runInContext(`${ENTITIES.slice(0, end)}\nthis.Enemy = Enemy;`, sandbox);
  return sandbox;
}

function createCtx() {
  /** @type {any[]} */
  const calls = [];
  return {
    calls,
    fillStyle: '#ffb700',
    globalAlpha: 1,
    shadowBlur: 0,
    shadowColor: '#000',
    lineWidth: 1,
    save() { this.calls.push({ op: 'save' }); },
    restore() { this.calls.push({ op: 'restore' }); },
    /** @param {number} x @param {number} y */
    translate(x, y) { this.calls.push({ op: 'translate', x, y }); },
    /** @param {number} angle */
    rotate(angle) { this.calls.push({ op: 'rotate', angle }); },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fill() {},
    stroke() {},
    /** @param {number} x @param {number} y @param {number} w @param {number} h */
    fillRect(x, y, w, h) { this.calls.push({ op: 'fillRect', x, y, w, h }); },
  };
}

/**
 * @param {{x:number,y:number}} playerPos
 */
function drawTurret(playerPos) {
  const sandbox = loadEnemyClass();
  Object.assign(sandbox.player, playerPos);
  sandbox._EG.player = sandbox.player;
  sandbox.ctx.calls.length = 0;
  const turret = new sandbox.Enemy(5, 5, 10, 1, 0, 1, '#ffb700', 'TURRET');
  turret.bobAngle = 0;
  turret.draw(0, 0);
  return sandbox.ctx.calls;
}

test('TURRET draw no longer uses the two-rectangle health-pickup plus pattern', () => {
  const calls = drawTurret({ x: 8, y: 5 }).filter((/** @type {any} */ c) => c.op === 'fillRect');
  const plusRects = calls.filter((/** @type {any} */ c) =>
    (Math.abs(c.w - 4.48) < 0.001 && Math.abs(c.h - 12.16) < 0.001) ||
    (Math.abs(c.w - 12.16) < 0.001 && Math.abs(c.h - 4.48) < 0.001)
  );
  assert.equal(plusRects.length, 0, JSON.stringify(calls));
});

test('TURRET barrel points east toward an eastern player', () => {
  const calls = drawTurret({ x: 8, y: 5 });
  const angle = calls.find((/** @type {any} */ c) => c.op === 'rotate')?.angle;
  assert.equal(angle, 0);
  const barrel = calls.filter((/** @type {any} */ c) => c.op === 'fillRect').find((/** @type {any} */ c) => c.x === 0);
  assert.ok(barrel, 'barrel rect should be drawn from translated origin');
  assert.ok(barrel.w > barrel.h, 'barrel should be a long horizontal rect before rotation');
});

test('TURRET barrel points south toward a southern player', () => {
  const calls = drawTurret({ x: 5, y: 8 });
  const angle = calls.find((/** @type {any} */ c) => c.op === 'rotate')?.angle;
  assert.ok(Math.abs(angle - Math.PI / 2) < 1e-12, `expected south-facing barrel, got ${angle}`);
});

// ─── Exploit-trial seam collision (src/entities.js playerTilePassable) ───

/** @param {string} name */
function extractFunction(name) {
  const start = ENTITIES.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' must exist');
  let depth = 0;
  for (let i = ENTITIES.indexOf('{', start); i < ENTITIES.length; i++) {
    if (ENTITIES[i] === '{') depth++;
    else if (ENTITIES[i] === '}' && --depth === 0) return ENTITIES.slice(start, i + 1);
  }
  assert.fail(name + ' unbalanced');
}

const TILES = { WALL: 1, FLOOR: 2, SEAM_WALL: 30 };

/** @param {any} neon */
function loadPlayerTilePassable(neon) {
  // eslint-disable-next-line no-new-func -- evaluating project-owned source under test.
  return new Function('T', 'isPassable', 'NEON', '_EG',
    extractFunction('playerTilePassable') + '\nreturn playerTilePassable;'
  )(TILES, (/** @type {number} */ t) => t === TILES.FLOOR, neon, { tag: 'game' });
}

test('playerTilePassable matches isPassable for ordinary tiles', () => {
  const fn = loadPlayerTilePassable({ trials: { playerMayEnterSeam() { return true; } } });
  assert.equal(fn({}, TILES.FLOOR, 1, 1), true);
  assert.equal(fn({}, TILES.WALL, 1, 1), false, 'a wall never becomes passable');
});

test('playerTilePassable delegates only the seam tile to NEON.trials with the live game', () => {
  /** @type {any[]} */
  const calls = [];
  const fn = loadPlayerTilePassable({ trials: { playerMayEnterSeam(/** @type {any[]} */ ...args) { calls.push(args); return args[2] === 7; } } });
  const player = { x: 7.5, y: 3.5 };
  assert.equal(fn(player, TILES.SEAM_WALL, 7, 3), true);
  assert.equal(fn(player, TILES.SEAM_WALL, 8, 3), false);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], [{ tag: 'game' }, player, 7, 3]);
  const noTrials = loadPlayerTilePassable(undefined);
  assert.equal(noTrials(player, TILES.SEAM_WALL, 7, 3), false, 'without the trials module the seam is a wall');
});

test('dash and walk collision both use the seam-aware helper; each dash gets a new serial', () => {
  assert.equal((ENTITIES.match(/noClip \|\| playerTilePassable\(this, map\[/g) || []).length, 4);
  assert.match(ENTITIES, /this\.dashTimer=0\.12;\s*\n\s*this\._dashSerial = \(this\._dashSerial \| 0\) \+ 1;/);
});
