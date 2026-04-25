'use strict';
// Render error boundary (post-v116). Pure-Node tests for the helpers in
// engine/render-boundary.js. The drawErrorOverlay path is exercised against
// a fake ctx that records calls — we verify it doesn't throw and emits the
// key strings, which is enough for a regression net.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const rb = require(path.resolve(__dirname, '..', 'engine', 'render-boundary.js'));

test('trackRenderError: first error initialises state with count 1', () => {
  const err = new Error('boom');
  const s = rb.trackRenderError(null, 'render', err);
  assert.equal(s.phase, 'render');
  assert.equal(s.message, 'boom');
  assert.equal(s.count, 1);
  assert.ok(s.firstTs > 0);
  assert.ok(typeof s.stack === 'string');
});

test('trackRenderError: identical error increments count and preserves firstTs', () => {
  const err = new Error('boom');
  const s1 = rb.trackRenderError(null, 'render', err);
  const s2 = rb.trackRenderError(s1, 'render', new Error('boom'));
  const s3 = rb.trackRenderError(s2, 'render', new Error('boom'));
  assert.equal(s3.count, 3);
  assert.equal(s3.firstTs, s1.firstTs);
});

test('trackRenderError: different message resets the record', () => {
  const s1 = rb.trackRenderError(null, 'render', new Error('a'));
  const s2 = rb.trackRenderError(s1, 'render', new Error('b'));
  assert.equal(s2.message, 'b');
  assert.equal(s2.count, 1);
});

test('trackRenderError: same message across phases still throttles (alternating update/render)', () => {
  // The same ReferenceError can throw in update() then render() then update()...
  // We dedup by message only so the count keeps climbing and shouldLog throttles.
  const s1 = rb.trackRenderError(null, 'update', new Error('boom'));
  const s2 = rb.trackRenderError(s1, 'render', new Error('boom'));
  const s3 = rb.trackRenderError(s2, 'update', new Error('boom'));
  assert.equal(s3.count, 3);
  assert.equal(s3.phase, 'update', 'surfaces the most recent phase');
  assert.equal(s3.firstTs, s1.firstTs);
});

test('trackRenderError: handles non-Error throwables', () => {
  const s = rb.trackRenderError(null, 'render', 'plain string');
  assert.equal(s.message, 'plain string');
  assert.equal(s.stack, '');
  assert.equal(s.count, 1);
});

test('trackRenderError: handles null/undefined throwables', () => {
  const s = rb.trackRenderError(null, 'render', undefined);
  assert.equal(typeof s.message, 'string');
  assert.equal(s.count, 1);
});

test('shouldLog: first occurrence and every 60th occurrence', () => {
  assert.equal(rb.shouldLog({ count: 1 }), true);
  assert.equal(rb.shouldLog({ count: 2 }), false);
  assert.equal(rb.shouldLog({ count: 59 }), false);
  assert.equal(rb.shouldLog({ count: 60 }), true);
  assert.equal(rb.shouldLog({ count: 120 }), true);
});

function makeFakeCtx() {
  const calls = [];
  const ctx = {
    _calls: calls,
    _text: [],
    save() { calls.push(['save']); },
    restore() { calls.push(['restore']); },
    fillRect(x, y, w, h) { calls.push(['fillRect', x, y, w, h]); },
    fillText(s, x, y) { calls.push(['fillText', s, x, y]); ctx._text.push(s); },
    set fillStyle(v) { calls.push(['fillStyle', v]); },
    set font(v) { calls.push(['font', v]); },
    set textAlign(v) { calls.push(['textAlign', v]); },
    set textBaseline(v) { calls.push(['textBaseline', v]); },
  };
  return ctx;
}

test('drawErrorOverlay: emits headline, stack lines, recovery hint', () => {
  const ctx = makeFakeCtx();
  const state = {
    phase: 'render',
    message: 'TS is not defined',
    stack: 'ReferenceError: TS is not defined\n    at renderPlaying (game.js:3132)\n    at game.render (game.js:2841)',
    count: 7,
    firstTs: Date.now(),
  };
  rb.drawErrorOverlay(ctx, 800, 600, state);
  const text = ctx._text.join('\n');
  assert.ok(text.includes('RENDER ERROR'), 'has title');
  assert.ok(text.includes('TS is not defined'), 'has message');
  assert.ok(text.includes('renderPlaying'), 'has stack frame');
  assert.ok(text.includes('reload'), 'has recovery hint');
  assert.ok(text.includes('7'), 'has occurrence count');
});

test('drawErrorOverlay: tolerates missing stack and missing state', () => {
  const ctx = makeFakeCtx();
  assert.doesNotThrow(() => {
    rb.drawErrorOverlay(ctx, 800, 600, { phase: 'render', message: 'x', count: 1 });
  });
  assert.doesNotThrow(() => { rb.drawErrorOverlay(ctx, 800, 600, null); });
  assert.doesNotThrow(() => { rb.drawErrorOverlay(null, 800, 600, { phase: 'r', message: 'x', count: 1 }); });
});

test('drawErrorOverlay: dims the full canvas first (covers stale frame)', () => {
  const ctx = makeFakeCtx();
  rb.drawErrorOverlay(ctx, 800, 600, { phase: 'render', message: 'x', count: 1 });
  const fillRects = ctx._calls.filter(c => c[0] === 'fillRect');
  assert.ok(
    fillRects.some(c => c[1] === 0 && c[2] === 0 && c[3] === 800 && c[4] === 600),
    'first fillRect must cover the entire canvas to obscure the stale frame'
  );
});
