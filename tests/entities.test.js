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
  assert.deepEqual(calls[0], [{ tag: 'game' }, player, 7, 3, undefined], 'the dash flag is forwarded (undefined for plain checks)');
  const noTrials = loadPlayerTilePassable(undefined);
  assert.equal(noTrials(player, TILES.SEAM_WALL, 7, 3), false, 'without the trials module the seam is a wall');
});

test('dash and walk collision both use the seam-aware helper; each dash gets a new serial', () => {
  assert.equal((ENTITIES.match(/noClip \|\| playerStepPassable\(this, map, /g) || []).length, 4);
  assert.equal((ENTITIES.match(/if \(!noClip\) resolvePlayerCornerCut\(this, map, /g) || []).length, 2, 'dash and walk both resolve corner cuts');
  assert.match(ENTITIES, /this\.dashTimer=0\.12;\s*\n\s*this\._dashSerial = \(this\._dashSerial \| 0\) \+ 1;/);
});

// ─── Behaviour: the reviewer's corner-cut counterexample ──────────────────

const trialsModule = require('../src/content/trials.js');

/** Load the three real movement helpers against the real trials module. */
function loadMovement() {
  const T = { WALL: 1, FLOOR: 2, SEAM_WALL: 30 };
  const room = { x: 10, y: 10, w: 9, h: 7, cx: 14, cy: 13 };
  const trial = trialsModule.createTrial('seam', room, 4, () => 0.5);
  trial.phaseOffset = 0;
  /** @type {any} */ (room).trial = trial;
  /** @type {any} */
  const map = Array.from({ length: 30 }, () => new Array(30).fill(T.FLOOR));
  for (const w of trial.walls) map[w.y][w.x] = T.WALL;
  map[trial.seam.y][trial.seam.x] = T.SEAM_WALL;
  const gm = { dungeon: { rooms: [room], map }, floorTime: 0 };
  // eslint-disable-next-line no-new-func -- evaluating project-owned source under test.
  const api = new Function('T', 'isPassable', 'NEON', '_EG',
    [extractFunction('playerTilePassable'), extractFunction('playerStepPassable'), extractFunction('resolvePlayerCornerCut'),
      'return { playerStepPassable, resolvePlayerCornerCut };'].join('\n')
  )(T, (/** @type {number} */ t) => t === T.FLOOR, { trials: trialsModule }, gm);
  /** One movement step in the same order as Player.update. @param {any} p @param {number} nx @param {number} ny @param {boolean} dashing */
  const step = (p, nx, ny, dashing) => {
    const tx = Math.floor(nx), ty = Math.floor(p.y), ox = Math.floor(p.x), oy = Math.floor(ny);
    const px = p.x, py = p.y;
    if (api.playerStepPassable(p, map, tx, ty, ox, ty, dashing)) p.x = nx;
    if (api.playerStepPassable(p, map, ox, oy, ox, ty, dashing)) p.y = ny;
    api.resolvePlayerCornerCut(p, map, px, py, dashing);
  };
  return { T, map, trial, gm, step };
}

test('a diagonal dash past the open seam can no longer embed the agent in the vault corner', () => {
  const { T, map, trial, step } = loadMovement();
  const p = { x: trial.seam.x + 1.1, y: trial.seam.y + 0.1, dashTimer: 0.1, _dashSerial: 1 };
  const d = 18 / 60 * Math.SQRT1_2; // one 60fps north-west dash step per axis
  step(p, p.x - d, p.y - d, true);
  const tile = map[Math.floor(p.y)][Math.floor(p.x)];
  assert.notEqual(tile, T.WALL, `agent ended inside a wall at ${p.x.toFixed(3)},${p.y.toFixed(3)}`);
});

test('an agent already embedded in a wall tile can walk back out', () => {
  const { T, map, trial, step } = loadMovement();
  const corner = trial.walls.find((/** @type {any} */ w) => w.x === trial.seam.x && w.y === trial.seam.y - 1);
  assert.ok(corner, 'vault corner wall above the seam');
  const p = { x: corner.x + 0.888, y: corner.y + 0.888, dashTimer: 0, _dashSerial: 1 };
  for (let i = 0; i < 20; i++) step(p, p.x + 3.5 / 60, p.y, false); // walk east for 1/3 s
  assert.equal(map[Math.floor(p.y)][Math.floor(p.x)], T.FLOOR, 'walking east leaves the wall tile');
});

test('dash steps honour the seam window even after the dash timer ran out on the final frame', () => {
  const { T, map, trial, step } = loadMovement();
  const p = { x: trial.seam.x + 1.2, y: trial.seam.y + 0.5, dashTimer: -0.03, _dashSerial: 3 };
  step(p, p.x - 0.36, p.y, true);
  assert.equal(map[Math.floor(p.y)][Math.floor(p.x)], T.SEAM_WALL, 'final-frame dash still enters the open seam');
  const q = { x: trial.seam.x + 1.2, y: trial.seam.y + 0.5, dashTimer: 0, _dashSerial: 4 };
  step(q, q.x - 0.36, q.y, false);
  assert.equal(Math.floor(q.x), trial.seam.x + 1, 'walking into the seam is still blocked');
});
