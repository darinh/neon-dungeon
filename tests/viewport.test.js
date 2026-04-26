// Tests for engine/viewport.js — pure viewport math + orientation helpers.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const vp = require(path.join(__dirname, '..', 'engine', 'viewport.js'));

test('exports the documented surface', () => {
  assert.deepEqual(
    Object.keys(vp).sort(),
    ['computeLayout', 'computeLogicalSize', 'computeScale', 'isLandscape', 'parseSafeAreaInsets'].sort()
  );
});

test('isLandscape: prefers screen.orientation when present', () => {
  assert.equal(vp.isLandscape({ innerWidth: 100, innerHeight: 999 }, { orientation: { type: 'landscape-primary' } }), true);
  assert.equal(vp.isLandscape({ innerWidth: 999, innerHeight: 100 }, { orientation: { type: 'portrait-primary' } }), false);
});

test('isLandscape: falls back to innerWidth>innerHeight when orientation missing', () => {
  assert.equal(vp.isLandscape({ innerWidth: 800, innerHeight: 600 }, {}), true);
  assert.equal(vp.isLandscape({ innerWidth: 600, innerHeight: 800 }, {}), false);
  assert.equal(vp.isLandscape({ innerWidth: 800, innerHeight: 600 }, null), true);
});

test('isLandscape: ignores non-string orientation.type', () => {
  // Some browsers return undefined .type — fall back to dimensions.
  assert.equal(vp.isLandscape({ innerWidth: 800, innerHeight: 600 }, { orientation: {} }), true);
});

test('computeScale: smaller dim / 600 within [0.7, 1.5]', () => {
  // 600x600 → 1.0 (no clamp)
  assert.equal(vp.computeScale(600, 600), 1.0);
  // 1200x1000 → min=1000/600=1.666 → clamped to 1.5
  assert.equal(vp.computeScale(1200, 1000), 1.5);
  // 300x400 → min=300/600=0.5 → clamped to 0.7
  assert.equal(vp.computeScale(300, 400), 0.7);
  // 900x900 → 1.5 (boundary)
  assert.equal(vp.computeScale(900, 900), 1.5);
  // 420x420 → 0.7 (boundary)
  assert.equal(vp.computeScale(420, 420), 0.7);
});

test('computeScale: respects custom target/lo/hi', () => {
  assert.equal(vp.computeScale(800, 800, 400, 0.5, 3.0), 2.0);
  assert.equal(vp.computeScale(100, 100, 400, 0.5, 3.0), 0.5);
  assert.equal(vp.computeScale(2000, 2000, 400, 0.5, 3.0), 3.0);
});

test('computeLogicalSize: rounds vw/scale and vh/scale', () => {
  assert.deepEqual(vp.computeLogicalSize(900, 600, 1.5), { W: 600, H: 400 });
  assert.deepEqual(vp.computeLogicalSize(1024, 768, 1.0), { W: 1024, H: 768 });
  // Rounding: 800/1.3 = 615.38 → 615
  assert.deepEqual(vp.computeLogicalSize(800, 600, 1.3), { W: 615, H: 462 });
});

test('computeLogicalSize: handles scale=0 defensively (treat as 1)', () => {
  assert.deepEqual(vp.computeLogicalSize(800, 600, 0), { W: 800, H: 600 });
  assert.deepEqual(vp.computeLogicalSize(800, 600, -1), { W: 800, H: 600 });
});

test('computeLayout: portrait phone (W<=600, H>W) is compact', () => {
  const r = vp.computeLayout(400, 800, 0);
  assert.equal(r.compact, true);
  assert.equal(r.hudH, 58);
  assert.equal(r.hudTop, 800 - 58 - 0);
  assert.equal(r.msgBase, r.hudTop - 12);
});

test('computeLayout: landscape is non-compact', () => {
  const r = vp.computeLayout(800, 600, 0);
  assert.equal(r.compact, false);
  assert.equal(r.hudH, 40);
  assert.equal(r.hudTop, 560);
  assert.equal(r.msgBase, 548);
});

test('computeLayout: square (H==W) is non-compact (strict >)', () => {
  const r = vp.computeLayout(500, 500, 0);
  assert.equal(r.compact, false);
});

test('computeLayout: W>600 portrait still non-compact', () => {
  const r = vp.computeLayout(700, 1200, 0);
  assert.equal(r.compact, false);
});

test('computeLayout: subtracts safeBottom from hudTop', () => {
  const r = vp.computeLayout(800, 600, 30);
  assert.equal(r.hudTop, 600 - 40 - 30);
  assert.equal(r.msgBase, r.hudTop - 12);
});

test('parseSafeAreaInsets: divides each value by scale', () => {
  /** @type {Record<string,string>} */
  const css = { '--sat': '20px', '--sar': '15px', '--sab': '34px', '--sal': '10px' };
  const r = vp.parseSafeAreaInsets((n) => css[n], 2.0);
  assert.equal(r.top, 10);
  assert.equal(r.right, 7.5);
  assert.equal(r.bottom, 17);
  assert.equal(r.left, 5);
});

test('parseSafeAreaInsets: missing/non-numeric values become 0', () => {
  const r = vp.parseSafeAreaInsets((_n) => '', 1.0);
  assert.deepEqual(r, { top: 0, right: 0, bottom: 0, left: 0 });
  const r2 = vp.parseSafeAreaInsets((_n) => null, 1.0);
  assert.deepEqual(r2, { top: 0, right: 0, bottom: 0, left: 0 });
  const r3 = vp.parseSafeAreaInsets((_n) => 'auto', 1.0);
  assert.deepEqual(r3, { top: 0, right: 0, bottom: 0, left: 0 });
});

test('parseSafeAreaInsets: scale<=0 falls back to 1 (no division by zero)', () => {
  /** @type {Record<string,string>} */
  const css = { '--sat': '20px', '--sar': '15px', '--sab': '34px', '--sal': '10px' };
  const r = vp.parseSafeAreaInsets((n) => css[n], 0);
  assert.equal(r.top, 20);
  assert.equal(r.bottom, 34);
});

test('parseSafeAreaInsets: parses leading float from "20px" style strings', () => {
  /** @type {Record<string,string>} */
  const css = { '--sat': '12.5px', '--sar': '0px', '--sab': '0', '--sal': '8.25rem' };
  const r = vp.parseSafeAreaInsets((n) => css[n], 1.0);
  assert.equal(r.top, 12.5);
  assert.equal(r.right, 0);
  assert.equal(r.bottom, 0);
  assert.equal(r.left, 8.25);
});
