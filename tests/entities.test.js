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
