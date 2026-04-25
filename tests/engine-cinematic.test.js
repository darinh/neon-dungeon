'use strict';
// engine/cinematic — pure cinematic-controller tests.
// Engine-pure: no NEON DUNGEON narrative. Synthetic 3-slide payloads.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const eng = require(path.resolve(__dirname, '..', 'engine', 'cinematic.js'));
const { createCinematicController } = eng;

function makeSlides() {
  return [
    { dur: 1.0, label: 'a' },
    { dur: 1.0, label: 'b' },
    { dur: 1.0, label: 'c' },
  ];
}

test('exports createCinematicController', () => {
  assert.equal(typeof createCinematicController, 'function');
});

test('auto-advances through all slides on long ticks; flips done', () => {
  const c = createCinematicController({ slides: makeSlides() });
  for (let t = 0; t < 5 && !c.done; t += 0.25) c.update(0.25);
  assert.equal(c.done, true);
  assert.equal(c._state.slideIdx, 3);
});

test('onFinish fires exactly once on natural finish', () => {
  let calls = 0;
  const c = createCinematicController({
    slides: makeSlides(),
    onFinish() { calls++; },
  });
  for (let i = 0; i < 50; i++) c.update(0.5);
  assert.equal(c.done, true);
  assert.equal(calls, 1);
  c.update(1); c.update(1);
  assert.equal(calls, 1, 'onFinish must not re-fire on update-after-done');
});

test('onFinish fires exactly once on isSkipKey()', () => {
  let calls = 0;
  let pressed = false;
  const c = createCinematicController({
    slides: makeSlides(),
    isSkipKey: () => pressed,
    onFinish() { calls++; },
  });
  c.update(0.1);
  assert.equal(c.done, false);
  pressed = true;
  c.update(0.1);
  assert.equal(c.done, true);
  assert.equal(calls, 1);
});

test('isAdvanceKey advances one slide per edge', () => {
  let want = false;
  const c = createCinematicController({
    slides: makeSlides(),
    isAdvanceKey: () => want,
  });
  c.update(0.1);
  assert.equal(c._state.slideIdx, 0);
  want = true;
  c.update(0.1);
  assert.equal(c._state.slideIdx, 1);
  // Even with the key still held, the next update without a fresh edge
  // should not skip past it (callers manage edge-triggering themselves;
  // here we simulate that by toggling).
  want = false;
  c.update(0.1);
  assert.equal(c._state.slideIdx, 1);
});

test('idempotent on repeated update-after-done', () => {
  const c = createCinematicController({ slides: makeSlides() });
  for (let i = 0; i < 50; i++) c.update(2);
  assert.equal(c.done, true);
  const snap = { ...c._state };
  c.update(1); c.update(1);
  assert.equal(c.done, true);
  assert.equal(c._state.slideIdx, snap.slideIdx);
  assert.equal(c._state.elapsed, snap.elapsed);
});

test('draw is a no-op with no ctx and never throws', () => {
  const c = createCinematicController({
    slides: makeSlides(),
    drawSlide() { throw new Error('should not be called'); },
  });
  assert.doesNotThrow(() => c.draw(null, 800, 600));
  assert.doesNotThrow(() => c.draw(undefined, 800, 600));
});

test('draw is a no-op when controller is done', () => {
  let drawn = 0;
  const c = createCinematicController({
    slides: makeSlides(),
    drawSlide() { drawn++; },
  });
  for (let i = 0; i < 20; i++) c.update(1);
  assert.equal(c.done, true);
  c.draw({}, 100, 100);
  assert.equal(drawn, 0);
});

test('drawSlide receives engine-computed alpha and slide payload', () => {
  /** @type {any[]} */
  const calls = [];
  const c = createCinematicController({
    slides: makeSlides(),
    drawSlide(ctx, payload) { calls.push(payload); },
    fadeIn: 0.25,
    fadeOut: 0.35,
  });
  c.update(0.001); // mid-fade-in: alpha should be tiny
  c.draw({}, 200, 100);
  assert.equal(calls.length, 1);
  const p = calls[0];
  assert.equal(p.slide.label, 'a');
  assert.equal(p.slideIdx, 0);
  assert.equal(p.W, 200);
  assert.equal(p.H, 100);
  assert.ok(p.alpha >= 0 && p.alpha <= 1);
  assert.ok(p.alpha < 0.05, 'alpha should be tiny just after start (fadeIn 0.25s)');
});

test('alpha reaches 1 in slide middle and decays toward fadeOut tail', () => {
  /** @type {any[]} */
  const alphas = [];
  const c = createCinematicController({
    slides: [{ dur: 2.0 }],
    drawSlide(ctx, p) { alphas.push(p.alpha); },
    fadeIn: 0.25,
    fadeOut: 0.35,
  });
  // Sample at t=0.5 (post-fadeIn), t=1.0 (mid), t=1.9 (in fadeOut window)
  c.update(0.5); c.draw({}, 1, 1);
  c.update(0.5); c.draw({}, 1, 1);
  c.update(0.9); c.draw({}, 1, 1);
  assert.ok(alphas[0] > 0.99);
  assert.ok(alphas[1] > 0.99);
  assert.ok(alphas[2] < 0.5, `expected fadeOut by t=1.9 of 2.0s; got alpha=${alphas[2]}`);
});

test('flash envelope ramps on the configured slide', () => {
  /** @type {any[]} */
  const flashes = [];
  const c = createCinematicController({
    slides: [{ dur: 1 }, { dur: 1 }, { dur: 5 }],
    flashSlideIndex: 2,
    flashRampSeconds: 1.0,
    drawSlide(ctx, p) { flashes.push({ idx: p.slideIdx, flash: p.flash }); },
  });
  // First two slides: flash stays 0
  c.update(0.5); c.draw({}, 1, 1);
  c.update(0.6); c.draw({}, 1, 1);
  // Now in slide 2; flash should rise across draws
  for (let i = 0; i < 5; i++) { c.update(0.25); c.draw({}, 1, 1); }
  const firstSlideFlash = flashes.find(f => f.idx === 0);
  const finalSlideFlashes = flashes.filter(f => f.idx === 2).map(f => f.flash);
  assert.equal(firstSlideFlash.flash, 0);
  assert.ok(finalSlideFlashes.length >= 2);
  // Monotonic non-decreasing and capped at 1
  for (let i = 1; i < finalSlideFlashes.length; i++) {
    assert.ok(finalSlideFlashes[i] >= finalSlideFlashes[i - 1] - 1e-9);
    assert.ok(finalSlideFlashes[i] <= 1 + 1e-9);
  }
  assert.ok(finalSlideFlashes[finalSlideFlashes.length - 1] > 0,
    `flash should rise on final slide; got ${JSON.stringify(finalSlideFlashes)}`);
});

test('drawSlide errors propagate to host render boundary (no swallow)', () => {
  const c = createCinematicController({
    slides: makeSlides(),
    drawSlide() { throw new Error('boom'); },
  });
  c.update(0.1);
  assert.throws(() => c.draw({}, 1, 1), /boom/);
});

test('dur=0 slides advance immediately on next update (matches v134)', () => {
  const c = createCinematicController({
    slides: [
      { dur: 0, label: 'a' },
      { dur: 0, label: 'b' },
      { dur: 1, label: 'c' },
    ],
  });
  c.update(0.01);
  assert.equal(c._state.slideIdx, 1, 'first 0-dur slide advanced');
  c.update(0.01);
  assert.equal(c._state.slideIdx, 2, 'second 0-dur slide advanced');
  assert.equal(c.done, false);
});

test('non-finite dt is ignored (no NaN poisoning)', () => {
  const c = createCinematicController({ slides: makeSlides() });
  c.update(NaN);
  c.update(Infinity);
  c.update(-1);
  assert.equal(c._state.elapsed, 0);
  assert.equal(c._state.totalElapsed, 0);
  assert.equal(c.done, false);
});

test('empty slides finishes on first update without onFinish blowing up', () => {
  let calls = 0;
  const c = createCinematicController({ slides: [], onFinish() { calls++; } });
  assert.equal(c.done, false);
  c.update(0.1);
  assert.equal(c.done, true);
  assert.equal(calls, 1);
});
