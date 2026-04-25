// Tests for engine/input.js — keyboard input tracker factory.
//
// Strategy: inject a fake `win` with addEventListener/removeEventListener,
// then dispatch synthesised KeyboardEvent-shaped objects to the captured
// handlers. Asserts: (1) keys/justPressed/justReleased semantics including
// edge debouncing on key-repeat, (2) attach/detach idempotency and listener
// removal, (3) onKeyDown/onKeyUp callback firing, (4) e.preventDefault is
// called on keydown, (5) clearJust resets edge sets without touching held keys.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { createEngine } = require(path.join(__dirname, '..', 'engine', 'input.js'));

function makeFakeWin() {
  /** @type {Record<string, Function[]>} */
  const listeners = {};
  return {
    listeners,
    addEventListener(type, fn) {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    removeEventListener(type, fn) {
      const arr = listeners[type] || [];
      const i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    },
    dispatch(type, evt) {
      for (const fn of (listeners[type] || []).slice()) fn(evt);
    },
  };
}

function ev(code, key) {
  let prevented = 0;
  return {
    code,
    key: key || code,
    preventDefault() { prevented++; },
    get _prevented() { return prevented; },
  };
}

test('createEngine: returns expected surface', () => {
  const e = createEngine({ win: makeFakeWin() });
  assert.ok(e.keys instanceof Set);
  assert.ok(e.justPressed instanceof Set);
  assert.ok(e.justReleased instanceof Set);
  assert.equal(typeof e.jp, 'function');
  assert.equal(typeof e.clearJust, 'function');
  assert.equal(typeof e.attach, 'function');
  assert.equal(typeof e.detach, 'function');
});

test('attach: registers keydown + keyup listeners', () => {
  const win = makeFakeWin();
  const e = createEngine({ win });
  assert.equal((win.listeners.keydown || []).length, 0);
  e.attach();
  assert.equal(win.listeners.keydown.length, 1);
  assert.equal(win.listeners.keyup.length, 1);
});

test('attach: idempotent — second call does not double-register', () => {
  const win = makeFakeWin();
  const e = createEngine({ win });
  e.attach();
  e.attach();
  assert.equal(win.listeners.keydown.length, 1);
  assert.equal(win.listeners.keyup.length, 1);
});

test('detach: removes listeners', () => {
  const win = makeFakeWin();
  const e = createEngine({ win });
  e.attach();
  e.detach();
  assert.equal(win.listeners.keydown.length, 0);
  assert.equal(win.listeners.keyup.length, 0);
});

test('keydown: adds to keys, justPressed; jp(code) reflects it', () => {
  const win = makeFakeWin();
  const e = createEngine({ win });
  e.attach();
  win.dispatch('keydown', ev('KeyW'));
  assert.ok(e.keys.has('KeyW'));
  assert.ok(e.justPressed.has('KeyW'));
  assert.equal(e.jp('KeyW'), true);
  assert.equal(e.jp('KeyA'), false);
});

test('keydown: e.preventDefault is called on each event', () => {
  const win = makeFakeWin();
  const e = createEngine({ win });
  e.attach();
  const k = ev('Space');
  win.dispatch('keydown', k);
  assert.equal(k._prevented, 1);
});

test('keydown: edge debounced — repeat events do NOT re-fire justPressed', () => {
  const win = makeFakeWin();
  const e = createEngine({ win });
  e.attach();
  win.dispatch('keydown', ev('KeyW'));
  e.clearJust();
  // simulate browser key-repeat (key still held, no keyup between)
  win.dispatch('keydown', ev('KeyW'));
  assert.equal(e.justPressed.has('KeyW'), false, 'repeat should not re-fire edge');
  assert.ok(e.keys.has('KeyW'), 'still held');
});

test('keyup: removes from keys, fires justReleased', () => {
  const win = makeFakeWin();
  const e = createEngine({ win });
  e.attach();
  win.dispatch('keydown', ev('KeyW'));
  win.dispatch('keyup', ev('KeyW'));
  assert.equal(e.keys.has('KeyW'), false);
  assert.ok(e.justReleased.has('KeyW'));
});

test('clearJust: clears justPressed + justReleased; held keys untouched', () => {
  const win = makeFakeWin();
  const e = createEngine({ win });
  e.attach();
  win.dispatch('keydown', ev('KeyW'));
  win.dispatch('keydown', ev('KeyA'));
  win.dispatch('keyup', ev('KeyA'));
  assert.equal(e.justPressed.size, 2);
  assert.equal(e.justReleased.size, 1);
  e.clearJust();
  assert.equal(e.justPressed.size, 0);
  assert.equal(e.justReleased.size, 0);
  // KeyW still held (no keyup yet)
  assert.ok(e.keys.has('KeyW'));
  assert.equal(e.keys.has('KeyA'), false);
});

test('onKeyDown: callback fires AFTER engine state update', () => {
  const win = makeFakeWin();
  /** @type {string[]} */
  const seen = [];
  let snapshot = false;
  const e = createEngine({
    win,
    onKeyDown: (k) => { seen.push(k.code); snapshot = e.keys.has(k.code); },
  });
  e.attach();
  win.dispatch('keydown', ev('Enter'));
  assert.deepEqual(seen, ['Enter']);
  assert.equal(snapshot, true, 'engine state must be updated before callback fires');
});

test('onKeyUp: callback fires AFTER engine state update', () => {
  const win = makeFakeWin();
  /** @type {string[]} */
  const seen = [];
  let snapshot = true;
  const e = createEngine({
    win,
    onKeyUp: (k) => { seen.push(k.code); snapshot = e.keys.has(k.code); },
  });
  e.attach();
  win.dispatch('keydown', ev('KeyQ'));
  win.dispatch('keyup', ev('KeyQ'));
  assert.deepEqual(seen, ['KeyQ']);
  assert.equal(snapshot, false, 'key must be removed before callback fires');
});

test('keyup without preceding keydown: still fires justReleased', () => {
  const win = makeFakeWin();
  const e = createEngine({ win });
  e.attach();
  win.dispatch('keyup', ev('KeyZ'));
  assert.ok(e.justReleased.has('KeyZ'));
  assert.equal(e.keys.has('KeyZ'), false);
});

test('multiple distinct keys held simultaneously', () => {
  const win = makeFakeWin();
  const e = createEngine({ win });
  e.attach();
  win.dispatch('keydown', ev('KeyW'));
  win.dispatch('keydown', ev('KeyA'));
  win.dispatch('keydown', ev('KeyS'));
  assert.equal(e.keys.size, 3);
  assert.ok(e.jp('KeyW') && e.jp('KeyA') && e.jp('KeyS'));
});

test('detach: clears keys/justPressed/justReleased to prevent stuck-key on reattach', () => {
  const win = makeFakeWin();
  const e = createEngine({ win });
  e.attach();
  win.dispatch('keydown', ev('KeyW'));
  assert.ok(e.keys.has('KeyW'));
  e.detach();
  assert.equal(e.keys.size, 0, 'detach must clear held keys (no keyup will arrive)');
  assert.equal(e.justPressed.size, 0);
  assert.equal(e.justReleased.size, 0);
  e.attach();
  // KeyW should NOT be re-injected as held after reattach
  assert.equal(e.keys.has('KeyW'), false);
});

test('detach: dispatched events after detach do not update state', () => {
  const win = makeFakeWin();
  const e = createEngine({ win });
  e.attach();
  e.detach();
  win.dispatch('keydown', ev('KeyW'));
  assert.equal(e.keys.size, 0);
  assert.equal(e.justPressed.size, 0);
});

test('attach after detach: re-registers listeners', () => {
  const win = makeFakeWin();
  const e = createEngine({ win });
  e.attach();
  e.detach();
  e.attach();
  assert.equal(win.listeners.keydown.length, 1);
  win.dispatch('keydown', ev('KeyW'));
  assert.ok(e.keys.has('KeyW'));
});

test('createEngine: no opts works (defaults)', () => {
  const e = createEngine();
  // can't attach (no real window in node), but factory must not throw
  assert.ok(e.keys instanceof Set);
});

test('preventDefault: tolerated if absent on event', () => {
  const win = makeFakeWin();
  const e = createEngine({ win });
  e.attach();
  // event with no preventDefault method must not throw
  assert.doesNotThrow(() => win.dispatch('keydown', { code: 'KeyW', key: 'w' }));
  assert.ok(e.keys.has('KeyW'));
});
