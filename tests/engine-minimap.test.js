'use strict';
// engine/minimap.js — generic minimap helpers (issue #87 sub-task C2d, thin extraction).
//
// Tests cover:
//   1. UMD bootstrap (NEON.minimap namespace + module.exports)
//   2. createOffscreenMinimap returns null in Node (no DOM) and is the
//      anchor the host (src/render.js) calls
//   3. fitExpandedMinimap math: aspect ratio preservation, 85% cap,
//      centering, sx/sy = mw/mapW, mh/mapH
//   4. drawMinimapFrame paints the documented sequence (background fill
//      then border stroke) with the documented defaults
//   5. Source pins ensuring src/render.js DOES call into engine/minimap
//      (otherwise the extraction is dead code)

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const minimap = require('../engine/minimap.js');
const RENDER = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'render.js'), 'utf8'
);
const SW = fs.readFileSync(
  path.resolve(__dirname, '..', 'sw.js'), 'utf8'
);
const INDEX = fs.readFileSync(
  path.resolve(__dirname, '..', 'index.html'), 'utf8'
);

// ─── UMD surface ─────────────────────────────────────────────────────────

test('engine/minimap.js exports the documented surface', () => {
  assert.equal(typeof minimap.createOffscreenMinimap, 'function');
  assert.equal(typeof minimap.fitExpandedMinimap, 'function');
  assert.equal(typeof minimap.drawMinimapFrame, 'function');
  assert.deepEqual(Object.keys(minimap).sort(),
    ['createOffscreenMinimap', 'drawMinimapFrame', 'fitExpandedMinimap'].sort());
});

// ─── createOffscreenMinimap ─────────────────────────────────────────────

test('createOffscreenMinimap returns null in Node (no DOM)', () => {
  // Node has no `document` global; helper must return null defensively
  // so callers can guard. The host (src/render.js) is browser-only and
  // will get a real HTMLCanvasElement back. Pinning null here ensures
  // the helper isn't accidentally re-implemented in a way that blows up
  // the test suite.
  assert.equal(minimap.createOffscreenMinimap(120, 80), null);
});

// ─── fitExpandedMinimap ─────────────────────────────────────────────────

test('fitExpandedMinimap preserves aspect ratio (mapW/mapH)', () => {
  // 80/50 = 1.6
  const layout = minimap.fitExpandedMinimap(800, 600, 80, 50,
    { left: 0, right: 0, top: 0, bottom: 0 }, 20);
  // mw/mh must equal mapW/mapH within rounding tolerance.
  const ratio = layout.mw / layout.mh;
  assert.ok(Math.abs(ratio - 80/50) < 0.05,
    `aspect ratio ${ratio} must be close to ${80/50}`);
});

test('fitExpandedMinimap caps at 85% of inset area', () => {
  // No safe insets, pad=0 → max area = 800x600. 85% = 680x510.
  // For 80/50 ratio map, width-bound: 680/(80/50) = 425 < 510, so
  // mw=680, mh=425.
  const layout = minimap.fitExpandedMinimap(800, 600, 80, 50,
    { left: 0, right: 0, top: 0, bottom: 0 }, 0);
  assert.equal(layout.mw, 680);
  assert.equal(layout.mh, 425);
});

test('fitExpandedMinimap respects safe insets', () => {
  // 800x600 viewport with 50px safe insets on each side, pad=0:
  //   maxW = (800 - 0 - 50 - 50) * 0.85 = 595
  //   maxH = (600 - 0 - 50 - 50) * 0.85 = 425
  // For ratio 1.6: width-bound test: 595/1.6 = 372 < 425, so width-bound:
  //   mw = 595, mh = 372
  const layout = minimap.fitExpandedMinimap(800, 600, 80, 50,
    { left: 50, right: 50, top: 50, bottom: 50 }, 0);
  assert.equal(layout.mw, 595);
  assert.equal(layout.mh, 372);
});

test('fitExpandedMinimap centers in the viewport', () => {
  const layout = minimap.fitExpandedMinimap(800, 600, 80, 50,
    { left: 0, right: 0, top: 0, bottom: 0 }, 0);
  assert.equal(layout.mx, Math.round((800 - layout.mw) / 2));
  assert.equal(layout.my, Math.round((600 - layout.mh) / 2));
});

test('fitExpandedMinimap sx/sy are mw/mapW and mh/mapH', () => {
  const layout = minimap.fitExpandedMinimap(800, 600, 80, 50,
    { left: 0, right: 0, top: 0, bottom: 0 }, 20);
  assert.equal(layout.sx, layout.mw / 80);
  assert.equal(layout.sy, layout.mh / 50);
});

// ─── drawMinimapFrame ───────────────────────────────────────────────────

test('drawMinimapFrame paints background fill then border stroke', () => {
  const calls = [];
  const fakeCtx = {
    set fillStyle(v) { calls.push(['fillStyle', v]); },
    set strokeStyle(v) { calls.push(['strokeStyle', v]); },
    set lineWidth(v) { calls.push(['lineWidth', v]); },
    fillRect: (x,y,w,h) => calls.push(['fillRect', x, y, w, h]),
    strokeRect: (x,y,w,h) => calls.push(['strokeRect', x, y, w, h]),
  };
  minimap.drawMinimapFrame(fakeCtx, 100, 50, 120, 80);
  // Order: bg fill THEN border stroke (so the stroke sits on top of the
  // fill, not the other way around — matters for translucent fills).
  const setFillBefore = calls.findIndex(c => c[0] === 'fillStyle');
  const fillRectBefore = calls.findIndex(c => c[0] === 'fillRect');
  const setStrokeBefore = calls.findIndex(c => c[0] === 'strokeStyle');
  const strokeRectBefore = calls.findIndex(c => c[0] === 'strokeRect');
  assert.ok(setFillBefore < fillRectBefore, 'fillStyle set before fillRect');
  assert.ok(fillRectBefore < setStrokeBefore, 'fillRect before strokeStyle');
  assert.ok(setStrokeBefore < strokeRectBefore, 'strokeStyle set before strokeRect');
});

test('drawMinimapFrame defaults match historical inline values', () => {
  // Pre-extraction inline values:
  //   fillStyle = 'rgba(0,0,0,0.75)'
  //   strokeStyle = '#2d2d5e'
  //   lineWidth = 1
  //   borderInset = 2
  // Without an opts argument the extraction must produce identical
  // visual output. Mutation here would silently drift the visual.
  const calls = [];
  const fakeCtx = {
    set fillStyle(v) { calls.push(['fillStyle', v]); },
    set strokeStyle(v) { calls.push(['strokeStyle', v]); },
    set lineWidth(v) { calls.push(['lineWidth', v]); },
    fillRect: (x,y,w,h) => calls.push(['fillRect', x, y, w, h]),
    strokeRect: (x,y,w,h) => calls.push(['strokeRect', x, y, w, h]),
  };
  minimap.drawMinimapFrame(fakeCtx, 100, 50, 120, 80);
  const fillStyleCall = calls.find(c => c[0] === 'fillStyle');
  const strokeStyleCall = calls.find(c => c[0] === 'strokeStyle');
  const lineWidthCall = calls.find(c => c[0] === 'lineWidth');
  const fillRectCall = calls.find(c => c[0] === 'fillRect');
  assert.equal(fillStyleCall[1], 'rgba(0,0,0,0.75)');
  assert.equal(strokeStyleCall[1], '#2d2d5e');
  assert.equal(lineWidthCall[1], 1);
  // fillRect at (mx-2, my-2, mw+4, mh+4) = (98, 48, 124, 84)
  assert.deepEqual(fillRectCall.slice(1), [98, 48, 124, 84]);
});

test('drawMinimapFrame accepts opts overrides for expanded view', () => {
  // The expanded minimap uses different defaults: borderWidth 2,
  // backgroundColor 'rgba(8,8,20,0.92)'. Pin that opts overrides work.
  const calls = [];
  const fakeCtx = {
    set fillStyle(v) { calls.push(['fillStyle', v]); },
    set strokeStyle(v) { calls.push(['strokeStyle', v]); },
    set lineWidth(v) { calls.push(['lineWidth', v]); },
    fillRect: () => {},
    strokeRect: () => {},
  };
  minimap.drawMinimapFrame(fakeCtx, 100, 50, 120, 80, {
    borderColor: '#2d2d5e',
    borderWidth: 2,
    borderInset: 2,
    backgroundColor: 'rgba(8,8,20,0.92)',
  });
  const fill = calls.find(c => c[0] === 'fillStyle');
  const lw = calls.find(c => c[0] === 'lineWidth');
  assert.equal(fill[1], 'rgba(8,8,20,0.92)');
  assert.equal(lw[1], 2);
});

test('drawMinimapFrame fillInner:true strokes outer + fills inner (visual-equivalence per gpt-5.5/opus r1)', () => {
  // Per gpt-5.5 r1 + opus r1: pre-extraction expanded minimap did
  // stroke(outer) THEN fill(inner) — leaving a 2px ring of the dim
  // backdrop visible between border and fill. The default fillInner=false
  // mode would have painted that ring with the frame backgroundColor,
  // breaking pixel equivalence. The fillInner=true mode preserves the
  // historical behaviour. Pin the geometry + order:
  //   1. strokeRect(mx-2, my-2, mw+4, mh+4) — outer rect (border zone)
  //   2. fillRect(mx, my, mw, mh)            — inner rect (map area only)
  const calls = [];
  const fakeCtx = {
    set fillStyle(v) { calls.push(['fillStyle', v]); },
    set strokeStyle(v) { calls.push(['strokeStyle', v]); },
    set lineWidth(v) { calls.push(['lineWidth', v]); },
    fillRect: (x,y,w,h) => calls.push(['fillRect', x, y, w, h]),
    strokeRect: (x,y,w,h) => calls.push(['strokeRect', x, y, w, h]),
  };
  minimap.drawMinimapFrame(fakeCtx, 100, 50, 120, 80, {
    borderColor: '#2d2d5e',
    borderWidth: 2,
    borderInset: 2,
    backgroundColor: 'rgba(8,8,20,0.92)',
    fillInner: true,
  });
  // Stroke (outer) must come BEFORE fill (inner). This is the inverse of
  // the default mode (fill-outer then stroke-outer).
  const strokeRectIdx = calls.findIndex(c => c[0] === 'strokeRect');
  const fillRectIdx = calls.findIndex(c => c[0] === 'fillRect');
  assert.ok(strokeRectIdx >= 0 && fillRectIdx >= 0,
    'must call both strokeRect and fillRect');
  assert.ok(strokeRectIdx < fillRectIdx,
    'fillInner mode: strokeRect must come BEFORE fillRect (inverse of default)');
  // strokeRect is the OUTER rect (mx-2, my-2, mw+4, mh+4) = (98, 48, 124, 84)
  const strokeRectCall = calls[strokeRectIdx];
  assert.deepEqual(strokeRectCall.slice(1), [98, 48, 124, 84],
    'strokeRect must be the OUTER rect (mx-borderInset, my-borderInset, mw+2*borderInset, mh+2*borderInset)');
  // fillRect is the INNER rect (mx, my, mw, mh) = (100, 50, 120, 80)
  const fillRectCall = calls[fillRectIdx];
  assert.deepEqual(fillRectCall.slice(1), [100, 50, 120, 80],
    'fillRect must be the INNER rect (mx, my, mw, mh) — leaves a borderInset-wide ring of backdrop visible');
});

// ─── Wiring ──────────────────────────────────────────────────────────────

test('src/render.js calls NEON.minimap.createOffscreenMinimap (rebuildMinimapBase)', () => {
  // The cached-canvas path in rebuildMinimapBase must call into the
  // engine module rather than inlining document.createElement('canvas').
  // Without this assertion, the extraction could be silently bypassed
  // by a future revert.
  assert.match(RENDER,
    /NEON\.minimap\.createOffscreenMinimap\s*\(\s*MW\s*,\s*MH\s*\)/,
    'rebuildMinimapBase must call NEON.minimap.createOffscreenMinimap(MW, MH)');
});

test('src/render.js calls NEON.minimap.drawMinimapFrame (drawMinimap)', () => {
  // drawMinimap (corner) must use the engine frame helper. Pin a count >=
  // 1 because drawExpandedMinimap also calls it (separate test below).
  const matches = RENDER.match(/NEON\.minimap\.drawMinimapFrame\s*\(/g) || [];
  assert.ok(matches.length >= 2,
    `expected at least 2 NEON.minimap.drawMinimapFrame calls (corner + expanded); got ${matches.length}`);
});

test('src/render.js calls NEON.minimap.fitExpandedMinimap (drawExpandedMinimap)', () => {
  assert.match(RENDER,
    /NEON\.minimap\.fitExpandedMinimap\s*\(/,
    'drawExpandedMinimap must call NEON.minimap.fitExpandedMinimap');
});

test('expanded drawMinimapFrame call uses fillInner:true (visual-equivalence per gpt-5.5/opus r1)', () => {
  // Pin the fillInner:true opt at the expanded minimap call site. Without
  // this opt the frame fill would extend INTO the border zone — pixel-
  // different from pre-extraction. opus + gpt-5.5 r1 both caught this.
  // Anchor: find a drawMinimapFrame call within the drawExpandedMinimap
  // function body (which uses fitExpandedMinimap above).
  const expandedSlice = RENDER.match(
    /fitExpandedMinimap[\s\S]{0,2000}drawMinimapFrame\s*\([\s\S]{0,500}fillInner\s*:\s*true/
  );
  assert.ok(expandedSlice,
    'drawExpandedMinimap must pass fillInner:true to drawMinimapFrame to preserve pre-extraction stroke-outer + fill-inner geometry');
});

// ─── Loader hygiene ──────────────────────────────────────────────────────

test('engine/minimap.js is in index.html script load order', () => {
  assert.match(INDEX, /<script src="\.\/engine\/minimap\.js"><\/script>/,
    'index.html must include engine/minimap.js in the engine layer');
});

test('engine/minimap.js is in sw.js precache list', () => {
  assert.match(SW, /['"]\.\/engine\/minimap\.js['"]/,
    'sw.js precache must include engine/minimap.js so the module is offline-available');
});
