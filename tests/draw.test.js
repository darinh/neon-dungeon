// @ts-check
'use strict';
// Tests for engine/draw.js — pure canvas drawing primitives.
//
// We use a fake ctx that records every call. Nothing here touches a real
// canvas; the helpers are pure passthroughs over the 2D API.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const draw = require('../engine/draw.js');
const { circle, circleStroke, arcStroke, line, roundRect, roundRectStroke, roundRectFillStroke, rectFillStroke, setShadow, clearShadow } = draw;

const TAU = Math.PI * 2;

/** Build a fake CanvasRenderingContext2D that records every call + state set. */
function makeFakeCtx() {
  /** @type {any[][]} */
  const calls = [];
  /** @type {Record<string, any>} */
  const state = { shadowBlur: 0, shadowColor: '' };
  const handler = {
    /**
     * @param {Record<string, any>} _t
     * @param {string} prop
     */
    get(_t, prop) {
      // state reads
      if (prop in state) return state[prop];
      // every method just records
      /** @param {any[]} args */
      return (...args) => { calls.push([prop, ...args]); };
    },
    /**
     * @param {Record<string, any>} _t
     * @param {string} prop
     * @param {any} value
     */
    set(_t, prop, value) {
      state[prop] = value;
      calls.push(['set:' + prop, value]);
      return true;
    },
  };
  const ctx = new Proxy({}, handler);
  return { ctx, calls, state };
}

// ---------- circle ----------

test('circle: beginPath → arc(x,y,r,0,TAU) → fill', () => {
  const { ctx, calls } = makeFakeCtx();
  circle(ctx, 10, 20, 5);
  assert.deepEqual(calls, [
    ['beginPath'],
    ['arc', 10, 20, 5, 0, TAU],
    ['fill'],
  ]);
});

test('circle: handles r=0 (degenerate but legal)', () => {
  const { ctx, calls } = makeFakeCtx();
  circle(ctx, 0, 0, 0);
  assert.equal(calls.length, 3);
  const arcCall = /** @type {any[]} */ (calls[1]);
  assert.equal(arcCall[3], 0);
});

// ---------- circleStroke ----------

test('circleStroke: beginPath → arc(x,y,r,0,TAU) → stroke', () => {
  const { ctx, calls } = makeFakeCtx();
  circleStroke(ctx, -3, 7, 2.5);
  assert.deepEqual(calls, [
    ['beginPath'],
    ['arc', -3, 7, 2.5, 0, TAU],
    ['stroke'],
  ]);
});

// ---------- arcStroke ----------

test('arcStroke: beginPath → arc(x,y,r,a1,a2) → stroke', () => {
  const { ctx, calls } = makeFakeCtx();
  arcStroke(ctx, 1, 2, 3, 0.5, 1.5);
  assert.deepEqual(calls, [
    ['beginPath'],
    ['arc', 1, 2, 3, 0.5, 1.5],
    ['stroke'],
  ]);
});

test('arcStroke: full sweep (a1=0, a2=TAU) is allowed', () => {
  const { ctx, calls } = makeFakeCtx();
  arcStroke(ctx, 0, 0, 1, 0, TAU);
  const arcCall = /** @type {any[]} */ (calls[1]);
  assert.equal(arcCall[5], TAU);
});

// ---------- line ----------

test('line: beginPath → moveTo → lineTo → stroke', () => {
  const { ctx, calls } = makeFakeCtx();
  line(ctx, 1, 2, 3, 4);
  assert.deepEqual(calls, [
    ['beginPath'],
    ['moveTo', 1, 2],
    ['lineTo', 3, 4],
    ['stroke'],
  ]);
});

test('line: zero-length segment still emits all four ops', () => {
  const { ctx, calls } = makeFakeCtx();
  line(ctx, 5, 5, 5, 5);
  assert.equal(calls.length, 4);
});

// ---------- setShadow / clearShadow ----------

test('setShadow: sets both shadowColor and shadowBlur', () => {
  const { ctx, state } = makeFakeCtx();
  setShadow(ctx, '#ff00aa', 8);
  assert.equal(state.shadowColor, '#ff00aa');
  assert.equal(state.shadowBlur, 8);
});

test('setShadow: order of writes (color before blur) is stable', () => {
  // Some renderers depend on shadowColor being set before shadowBlur takes
  // effect on the next draw. Lock the order so future refactors can't flip
  // it without touching this test.
  const { ctx, calls } = makeFakeCtx();
  setShadow(ctx, '#00ff00', 4);
  const sets = calls.filter(c => typeof c[0] === 'string' && c[0].startsWith('set:'));
  const a = /** @type {any[]} */ (sets[0]);
  const b = /** @type {any[]} */ (sets[1]);
  assert.equal(a[0], 'set:shadowColor');
  assert.equal(b[0], 'set:shadowBlur');
});

test('clearShadow: writes shadowBlur=0 and does NOT touch shadowColor', () => {
  const { ctx, state, calls } = makeFakeCtx();
  setShadow(ctx, '#abcdef', 12);
  const before = calls.length;
  clearShadow(ctx);
  assert.equal(state.shadowBlur, 0);
  assert.equal(state.shadowColor, '#abcdef'); // untouched
  // Exactly one new write (shadowBlur).
  assert.equal(calls.length - before, 1);
  assert.deepEqual(calls[calls.length - 1], ['set:shadowBlur', 0]);
});

// ---------- hot-path: zero allocation per call ----------

test('hot-path: helpers do not allocate (smoke - 1000 invocations stable)', () => {
  // Not a true GC assertion (Node test runner can't measure that) but
  // exercises the helpers under load to catch any accidental [] / {} /
  // closure introduced in a future refactor (would slow the test
  // dramatically and a reviewer would notice).
  const { ctx, calls } = makeFakeCtx();
  for (let i = 0; i < 1000; i++) {
    circle(ctx, i, i, 1);
    circleStroke(ctx, i, i, 1);
    line(ctx, 0, 0, i, i);
  }
  // 3 helpers × 3-or-4 ops × 1000 iterations.
  assert.equal(calls.length, (3 + 3 + 4) * 1000);
});

// ---------- module shape ----------

test('module: exports the documented surface', () => {
  assert.equal(typeof draw.circle, 'function');
  assert.equal(typeof draw.circleStroke, 'function');
  assert.equal(typeof draw.arcStroke, 'function');
  assert.equal(typeof draw.line, 'function');
  assert.equal(typeof draw.roundRect, 'function');
  assert.equal(typeof draw.roundRectStroke, 'function');
  assert.equal(typeof draw.roundRectFillStroke, 'function');
  assert.equal(typeof draw.rectFillStroke, 'function');
  assert.equal(typeof draw.setShadow, 'function');
  assert.equal(typeof draw.clearShadow, 'function');
  assert.equal(Object.keys(draw).length, 10);
});

// ---------- roundRect ----------

test('roundRect: beginPath → roundRect → fill', () => {
  const { ctx, calls } = makeFakeCtx();
  roundRect(ctx, 10, 20, 100, 40, 8);
  assert.deepEqual(calls, [
    ['beginPath'],
    ['roundRect', 10, 20, 100, 40, 8],
    ['fill'],
  ]);
});

test('roundRectStroke: beginPath → roundRect → stroke', () => {
  const { ctx, calls } = makeFakeCtx();
  roundRectStroke(ctx, 5, 5, 50, 30, 4);
  assert.deepEqual(calls, [
    ['beginPath'],
    ['roundRect', 5, 5, 50, 30, 4],
    ['stroke'],
  ]);
});

test('roundRectFillStroke: beginPath → roundRect → fill → stroke (single path)', () => {
  const { ctx, calls } = makeFakeCtx();
  roundRectFillStroke(ctx, 0, 0, 200, 100, 12);
  assert.deepEqual(calls, [
    ['beginPath'],
    ['roundRect', 0, 0, 200, 100, 12],
    ['fill'],
    ['stroke'],
  ]);
  // Critically: ONE beginPath, not two — the whole point of the helper
  // is to share the path between fill and stroke.
  const beginPathCount = calls.filter((c) => c[0] === 'beginPath').length;
  assert.equal(beginPathCount, 1);
});

test('roundRectFillStroke: passes radius through unchanged (zero allowed)', () => {
  const { ctx, calls } = makeFakeCtx();
  roundRectFillStroke(ctx, 1, 2, 3, 4, 0);
  assert.deepEqual(calls[1], ['roundRect', 1, 2, 3, 4, 0]);
});

// ---------- rectFillStroke ----------

test('rectFillStroke: beginPath → rect → fill → stroke (single path, non-rounded)', () => {
  const { ctx, calls } = makeFakeCtx();
  rectFillStroke(ctx, 10, 20, 100, 40);
  assert.deepEqual(calls, [
    ['beginPath'],
    ['rect', 10, 20, 100, 40],
    ['fill'],
    ['stroke'],
  ]);
  // Single beginPath — fill and stroke share the path.
  const beginPathCount = calls.filter((c) => c[0] === 'beginPath').length;
  assert.equal(beginPathCount, 1);
});

test('rectFillStroke: does NOT call roundRect (uses non-rounded rect)', () => {
  const { ctx, calls } = makeFakeCtx();
  rectFillStroke(ctx, 0, 0, 50, 30);
  const usesRoundRect = calls.some((c) => c[0] === 'roundRect');
  assert.equal(usesRoundRect, false);
});
