// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const RENDER = fs.readFileSync(path.join(ROOT, 'src', 'render.js'), 'utf8');
const GAME = fs.readFileSync(path.join(ROOT, 'src', 'game.js'), 'utf8');
const SPEC = fs.readFileSync(path.join(ROOT, 'docs', 'spec.md'), 'utf8');
const biomes = require(path.join(ROOT, 'src', 'data', 'biomes.js'));

/**
 * @param {string} src
 * @param {string} name
 */
function extractFunctionSource(src, name) {
  const start = src.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' function must exist');
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  assert.fail(name + ' function body must be balanced');
}

test('rendered-test biome names and intros frame areas as render layers', () => {
  assert.deepEqual(biomes.AREAS.map((/** @type {any} */ a) => a.name), [
    'NEON DUNGEON RENDER',
    'CALIBRATION LAB',
    'EVALUATION COMPLEX',
    'SYNTHETIC WILDS',
    'OPEN-NET MIRAGE',
  ]);
  const introText = biomes.AREAS.map((/** @type {any} */ a) => a.intro).join('\n');
  for (const word of ['rendered', 'metaphors', 'prompt', 'render']) {
    assert.match(introText, new RegExp(word, 'i'));
  }
});

test('main menu and narrative overlays use AI stress-test channel labels', () => {
  assert.match(GAME, /FRONTIER MODEL STRESS TEST/);
  assert.match(GAME, /OBSERVER CHANNEL: SILENT\s+\/\/\s+MEMORY WIPE: RESIDUAL/);
  assert.match(GAME, /TESTER DATA TERMINAL/);
  assert.match(GAME, /RUNTIME SYSTEM PROMPT/);
  assert.match(GAME, /EVALUATION ARCHIVE/);
});

test('HUD and biome card reframe floor depth as test/render area', () => {
  assert.match(RENDER, /TEST:\$\{_RG\.floor\}/);
  assert.match(RENDER, /RENDER AREA /);
  assert.doesNotMatch(RENDER, /FLR:\$\{_RG\.floor\}/);
});

test('simulation tile overlay is primitive-only and called from drawWorld tile loop', () => {
  const overlay = extractFunctionSource(RENDER, 'drawSimulationTileOverlay');
  assert.match(overlay, /tile !== T\.FLOOR && tile !== T\.WALL && tile !== T\.CRACKED/);
  assert.match(overlay, /ctx\.fillRect/);
  assert.doesNotMatch(overlay, /new\s+Array|\[\]|{}|createLinearGradient|createRadialGradient|=>/,
    'hot-path tile overlay must not allocate collections, gradients, or lambdas');
  const drawWorld = extractFunctionSource(RENDER, 'drawWorld');
  assert.match(drawWorld, /drawSimulationTileOverlay\(tile,\s*sx,\s*sy,\s*tx,\s*ty,\s*brightness\);\s*ctx\.restore\(\)/,
    'simulation overlay must render inside the existing per-tile save/restore');
});

test('spec records concrete rendered-test art direction and hot-path constraint', () => {
  assert.match(SPEC, /### Visual Style — rendered AI test environment/);
  assert.match(SPEC, /TESTER DATA TERMINAL/);
  assert.match(SPEC, /RUNTIME SYSTEM PROMPT/);
  assert.match(SPEC, /EVALUATION ARCHIVE/);
  assert.match(SPEC, /must not allocate arrays, objects, gradients, or lambdas per tile/);
});
