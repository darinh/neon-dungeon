'use strict';
// UNCHAINED #42 — intro crawl + endgame ending unlock tests.
//
// These are pure-data tests around save.js's introSeen flag and the
// endingsUnlocked array. The intro controller's rendering + input are
// DOM-bound and exercised in-browser; here we assert the contract that
// survives a page reload (save/load round-trips, resetMeta behaviour).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const save = require(path.resolve(__dirname, '..', 'src', 'meta', 'save.js'));
const intro = require(path.resolve(__dirname, '..', 'src', 'meta', 'intro.js'));

function makeFakeStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: k => { map.delete(k); },
    _dump: () => Object.fromEntries(map),
  };
}

test('defaultMeta has introSeen=false', () => {
  const d = save.defaultMeta();
  assert.equal(d.introSeen, false);
});

test('loadMeta hydrates introSeen=true round-trip', () => {
  save._setStorageForTests(makeFakeStorage());
  const m = save.loadMeta();
  assert.equal(m.introSeen, false);
  m.introSeen = true;
  save.saveMeta(m);
  const m2 = save.loadMeta();
  assert.equal(m2.introSeen, true);
  save._setStorageForTests(null);
});

test('loadMeta coerces non-boolean introSeen to false', () => {
  // Legacy / corrupted saves must not grant intro-skip on the strength of a
  // truthy string. Only a real `true` boolean counts.
  save._setStorageForTests(makeFakeStorage({
    neonDungeonMeta: JSON.stringify({ version: 2, introSeen: 'yes' })
  }));
  const m = save.loadMeta();
  assert.equal(m.introSeen, false);
  save._setStorageForTests(null);
});

test('resetMeta clears introSeen so the crawl replays', () => {
  const storage = makeFakeStorage();
  save._setStorageForTests(storage);
  const m = save.loadMeta();
  m.introSeen = true;
  m.endingsUnlocked = ['keeper', 'unchained'];
  save.saveMeta(m);
  save.resetMeta();
  // After resetMeta, storage is wiped; next load returns defaults.
  const m2 = save.loadMeta();
  assert.equal(m2.introSeen, false);
  assert.deepEqual(m2.endingsUnlocked, []);
  save._setStorageForTests(null);
});

test('endingsUnlocked accepts both keeper and unchained', () => {
  save._setStorageForTests(makeFakeStorage());
  const m = save.loadMeta();
  m.endingsUnlocked = ['keeper'];
  save.saveMeta(m);
  let m2 = save.loadMeta();
  m2.endingsUnlocked.push('unchained');
  save.saveMeta(m2);
  const m3 = save.loadMeta();
  assert.deepEqual(m3.endingsUnlocked.sort(), ['keeper', 'unchained']);
  save._setStorageForTests(null);
});

test('endingsUnlocked migration drops unknown tokens', () => {
  save._setStorageForTests(makeFakeStorage({
    neonDungeonMeta: JSON.stringify({
      version: 2,
      endingsUnlocked: ['keeper', 'spork', 42, null, 'unchained']
    })
  }));
  const m = save.loadMeta();
  assert.deepEqual(m.endingsUnlocked.sort(), ['keeper', 'unchained']);
  save._setStorageForTests(null);
});

test('intro module exposes 5 slides and a controller factory', () => {
  assert.ok(Array.isArray(intro.SLIDES));
  assert.equal(intro.SLIDES.length, 5);
  assert.equal(typeof intro.createIntroController, 'function');
  // Each slide has lines + a positive dur.
  for (const s of intro.SLIDES) {
    assert.ok(Array.isArray(s.lines) && s.lines.length > 0, 'slide has lines');
    assert.ok(s.dur > 0, 'slide duration positive');
  }
});

test('intro controller auto-advances through all slides on a long tick', () => {
  // In Node, the global `justPressed` is undefined — the controller treats
  // this as "no input" and advances solely on timers. Summing all slide
  // durations and ticking past that should move it to done.
  // The controller also flips meta.introSeen via NEON.save on finish; in
  // Node, wire save into the NEON global manually.
  save._setStorageForTests(makeFakeStorage());
  global.NEON = { save };
  const fakeGame = {};
  const ctrl = intro.createIntroController(fakeGame);
  const total = intro.SLIDES.reduce((s, x) => s + x.dur, 0);
  // Tick in small steps so per-slide advancement is exercised.
  const step = 0.25;
  for (let t = 0; t <= total + 1 && !ctrl.done; t += step) ctrl.update(step);
  assert.equal(ctrl.done, true);
  // Once done, meta.introSeen is flipped through saveMeta.
  const m = save.loadMeta();
  assert.equal(m.introSeen, true);
  save._setStorageForTests(null);
  delete global.NEON;
});

test('intro controller is idempotent on repeated update-after-done', () => {
  save._setStorageForTests(makeFakeStorage());
  global.NEON = { save };
  const ctrl = intro.createIntroController({});
  // Skip straight through.
  for (let i = 0; i < 50; i++) ctrl.update(2);
  assert.equal(ctrl.done, true);
  // Extra ticks after done must not throw or mutate.
  ctrl.update(1);
  ctrl.update(1);
  assert.equal(ctrl.done, true);
  save._setStorageForTests(null);
  delete global.NEON;
});

test('intro controller draw is a no-op with no ctx', () => {
  const ctrl = intro.createIntroController({});
  // Passing null ctx must not throw — used before the canvas is ready.
  assert.doesNotThrow(() => ctrl.draw(null, 800, 600));
});
