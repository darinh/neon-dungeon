// @ts-check
'use strict';
// Tests for engine/touch.js — pure helpers (toCanvas, hitBtn, resetTouch).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const touchEngine = require('../engine/touch.js');
const { toCanvas, hitBtn, resetTouch } = touchEngine;
const PLATFORM = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'platform.js'), 'utf8');
const GAME_STATES_SRC = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'game-states.js'), 'utf8');

// ---------- toCanvas ----------

test('toCanvas: maps client coords to canvas-internal coords (1:1)', () => {
  const canvas = {
    width: 100, height: 100,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  };
  assert.deepEqual(toCanvas(50, 50, canvas), [50, 50]);
  assert.deepEqual(toCanvas(0, 0, canvas), [0, 0]);
  assert.deepEqual(toCanvas(100, 100, canvas), [100, 100]);
});

test('toCanvas: scales when CSS size differs from internal size', () => {
  // Canvas internal 800x600, displayed at 400x300 (2x DPR-ish)
  const canvas = {
    width: 800, height: 600,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 300 }),
  };
  assert.deepEqual(toCanvas(200, 150, canvas), [400, 300]);
});

test('toCanvas: subtracts bounding rect offset', () => {
  const canvas = {
    width: 100, height: 100,
    getBoundingClientRect: () => ({ left: 20, top: 40, width: 100, height: 100 }),
  };
  assert.deepEqual(toCanvas(70, 90, canvas), [50, 50]);
});

test('toCanvas: rect width=0 falls back to /1 (no NaN)', () => {
  const canvas = {
    width: 100, height: 100,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
  };
  const [cx, cy] = toCanvas(50, 50, canvas);
  assert.ok(Number.isFinite(cx) && Number.isFinite(cy));
});

// ---------- hitBtn ----------

test('hitBtn: hit at center', () => {
  const btn = { x: 100, y: 100, r: 30 };
  assert.equal(hitBtn(100, 100, btn, 1), true);
});

test('hitBtn: hit at edge of radius', () => {
  const btn = { x: 100, y: 100, r: 30 };
  assert.equal(hitBtn(130, 100, btn, 1), true);
  assert.equal(hitBtn(100, 130, btn, 1), true);
});

test('hitBtn: miss outside radius', () => {
  const btn = { x: 100, y: 100, r: 30 };
  assert.equal(hitBtn(140, 100, btn, 1), false);
  assert.equal(hitBtn(200, 200, btn, 1), false);
});

test('hitBtn: small btn radius expanded by 22/scale on tiny screens', () => {
  // scale=0.5 → minR = 22/0.5 = 44; btn.r=20 → effective 44
  const btn = { x: 0, y: 0, r: 20 };
  // Just-outside the original 20px radius, well inside the expanded 44px radius
  assert.equal(hitBtn(40, 0, btn, 0.5), true);
  // Outside both radii
  assert.equal(hitBtn(50, 0, btn, 0.5), false);
});

test('hitBtn: large btn.r used when bigger than min target', () => {
  // scale=2 → minR = 11; btn.r=30 → use 30
  const btn = { x: 0, y: 0, r: 30 };
  assert.equal(hitBtn(29, 0, btn, 2), true);
  assert.equal(hitBtn(31, 0, btn, 2), false);
});

test('hitBtn: scale<=0 falls back to 1 (no division by zero)', () => {
  const btn = { x: 0, y: 0, r: 22 };
  // scale=0 should behave as scale=1 → minR = 22; btn.r=22 → effective 22
  assert.equal(hitBtn(22, 0, btn, 0), true);
  assert.equal(hitBtn(23, 0, btn, 0), false);
});

// ---------- resetTouch ----------

function makeTouchState() {
  return {
    joystick: { active: true, id: 7, baseX: 100, baseY: 200, dx: 5, dy: -3 },
    aim:      { active: true, id: 9, baseX: 0, baseY: 0, dx: 1, dy: 2, shooting: true },
    btnE: 1, btnF: 2, btnV: 3, btnDash: 4, btnPause: 5,
  };
}

test('resetTouch: clears joystick state but preserves baseX/baseY', () => {
  const t = makeTouchState();
  const m = { down: true };
  resetTouch(t, m);
  assert.equal(t.joystick.active, false);
  assert.equal(t.joystick.id, null);
  assert.equal(t.joystick.dx, 0);
  assert.equal(t.joystick.dy, 0);
  // matches original behavior in src/platform.js — baseX/baseY left alone
  assert.equal(t.joystick.baseX, 100);
  assert.equal(t.joystick.baseY, 200);
});

test('resetTouch: clears aim state including shooting flag', () => {
  const t = makeTouchState();
  resetTouch(t, { down: true });
  assert.equal(t.aim.active, false);
  assert.equal(t.aim.id, null);
  assert.equal(t.aim.dx, 0);
  assert.equal(t.aim.dy, 0);
  assert.equal(t.aim.shooting, false);
});

test('resetTouch: nulls all button-touch IDs', () => {
  const t = makeTouchState();
  resetTouch(t, { down: false });
  assert.equal(t.btnE, null);
  assert.equal(t.btnF, null);
  assert.equal(t.btnV, null);
  assert.equal(t.btnDash, null);
  assert.equal(t.btnPause, null);
});

test('resetTouch: clears mouse.down', () => {
  const m = { down: true };
  resetTouch(makeTouchState(), m);
  assert.equal(m.down, false);
});

test('resetTouch: tolerates missing touch / mouse arguments', () => {
  // Should not throw if either is null/undefined
  assert.doesNotThrow(() => resetTouch(null, null));
  assert.doesNotThrow(() => resetTouch(undefined, undefined));
  assert.doesNotThrow(() => resetTouch(makeTouchState(), null));
  assert.doesNotThrow(() => resetTouch(null, { down: true }));
});

test('resetTouch: tolerates touch with missing joystick/aim sub-objects', () => {
  const partial = { btnE: 1, btnF: 2, btnV: 3, btnDash: 4, btnPause: 5 };
  assert.doesNotThrow(() => resetTouch(partial, { down: true }));
  assert.equal(partial.btnE, null);
});

test('touch routing sends hit-tested modal taps through coordinates instead of any-tap Enter fallback', () => {
  assert.match(PLATFORM, /function routeTouchAsMouseClick\(cx, cy\) \{\s*mouse\.x = cx;\s*mouse\.y = cy;\s*justPressed\.add\('MouseLeft'\);\s*\}/,
    'coordinate-routed modal taps should share one helper so new modals do not duplicate mouse routing');
  assert.match(GAME_STATES_SRC, /TOUCH_ROUTE_AS_CLICK_STATES = new Set\(\[[\s\S]*GAME_STATES\.READING[\s\S]*GAME_STATES\.CHEATS/,
    'READING/CHEATS must be in the centralized coordinate-routed touch set');
  assert.match(PLATFORM, /TOUCH_ROUTE_AS_CLICK_STATES\.has\(_G\.state\)[\s\S]{0,120}routeTouchAsMouseClick\(cx, cy\);[\s\S]{0,40}continue;/,
    'READING/CHEATS touch input must be coordinate-routed so only hit-tested controls can dismiss or toggle');
  assert.match(PLATFORM, /else\s*\{\s*justPressed\.add\('Enter'\);\s*justPressed\.add\('MouseLeft'\);\s*\}/,
    'generic fallback remains for states that intentionally treat touch as confirm');
});
