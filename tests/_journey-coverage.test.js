// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { codeLineOffsets, offsetCounts, lineCoverage, collectCoverage, changedLines, ranges } = require('./_journey-coverage.js');

test('code lines are lines with syntax nodes, plus the lines a multi-line literal crosses', () => {
  const src = [
    '// a comment',          // 1
    'const a = 1;',          // 2
    '',                      // 3
    'function f() {',        // 4
    '  /* block */ return `x', // 5
    'still the template`;',  // 6
    '}',                     // 7
  ].join('\n');
  const offsets = codeLineOffsets(src);
  assert.deepEqual(offsets.map((o, line) => (o.length ? line : null)).filter((l) => l !== null), [2, 4, 5, 6]);
  assert.equal(offsets[5]?.[0], src.indexOf('return'));
  assert.deepEqual(offsets[6], [src.indexOf('`x')]);
});

/**
 * Line coverage of `src` as V8 reports it after running it once.
 * @param {string} src
 */
function coverageOf(src) {
  const inspector = require('node:inspector');
  const vm = require('node:vm');
  const session = new inspector.Session();
  session.connect();
  /** @param {string} method @param {object} [params] */
  const post = (method, params = {}) => {
    /** @type {any} */ let out;
    /** @type {any} */ let err;
    session.post(method, params, (e, r) => { err = e; out = r; });
    if (err) throw err;
    return out;
  };
  try {
    post('Profiler.enable');
    post('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
    const filename = `coverage-fixture-${Math.random().toString(36).slice(2)}.js`;
    new vm.Script(src, { filename }).runInNewContext({});
    const hit = post('Profiler.takePreciseCoverage').result.find((/** @type {any} */ s) => s.url === filename);
    post('Profiler.stopPreciseCoverage');
    return lineCoverage(src, hit.functions);
  } finally {
    session.disconnect();
  }
}

test('a line whose condition runs but whose one-line branch does not is missed', () => {
  const src = 'function f(c) {\n  if (c) g();\n  return 1;\n}\nfunction g() {}\nf(false);\n';
  assert.deepEqual(coverageOf(src).missed, [2, 5]);
});

test('a changed line inside a multi-line literal in a function that never ran is missed', () => {
  const src = 'function neverCalled() {\n  return `first\nsecond`;\n}\n';
  assert.deepEqual(coverageOf(src).missed, [1, 2, 3]);
});

test('nested coverage ranges leave each offset with its innermost count', () => {
  const counts = offsetCounts(10, [
    { startOffset: 2, endOffset: 5, count: 0 },
    { startOffset: 0, endOffset: 10, count: 3 },
  ]);
  assert.deepEqual([...counts], [3, 3, 0, 0, 0, 3, 3, 3, 3, 3]);
});

test('lineCoverage reports missed code lines and functions that never ran', () => {
  const src = 'function used() {\n  return 1;\n}\nfunction unused() {\n  return 2;\n}\nused();\n';
  const usedStart = 0;
  const unusedStart = src.indexOf('function unused');
  const result = lineCoverage(src, [
    { functionName: '', ranges: [{ startOffset: 0, endOffset: src.length, count: 1 }] },
    { functionName: 'used', ranges: [{ startOffset: usedStart, endOffset: unusedStart - 1, count: 1 }] },
    { functionName: 'unused', ranges: [{ startOffset: unusedStart, endOffset: src.indexOf('used();'), count: 0 }] },
  ]);
  assert.equal(result.code, 5);
  // The declaration line of a function that never ran counts as not run.
  assert.deepEqual(result.missed, [4, 5]);
  assert.deepEqual(result.uncalled, [{ name: 'unused', line: 4 }]);
});

test('changedLines reads added and changed line numbers from a zero-context diff', () => {
  const diff = [
    'diff --git a/src/a.js b/src/a.js',
    '--- a/src/a.js',
    '+++ b/src/a.js',
    '@@ -3 +3 @@',
    '-old',
    '+new',
    '@@ -10,0 +11,2 @@',
    '+added one',
    '+added two',
    '@@ -20,3 +22,0 @@',
    '-gone',
    'diff --git a/src/b.js b/src/b.js',
    '--- a/src/b.js',
    '+++ /dev/null',
    '@@ -1,2 +0,0 @@',
  ].join('\n');
  assert.deepEqual([...changedLines(diff)], [['src/a.js', [3, 11, 12]]]);
});

test('ranges folds consecutive lines', () => {
  assert.equal(ranges([1, 2, 3, 5, 7, 8]), '1-3, 5, 7-8');
  assert.equal(ranges([]), '');
});

test('a journey under coverage marks the menu renderer run and the shop layout unused', () => {
  const files = collectCoverage({ journeys: ['touch-landscape'] });
  const game = files.get('src/game.js');
  assert.ok(game && game.code > 5000, 'src/game.js has code lines');
  const uncalled = new Set(game.uncalled.map((u) => u.name));
  assert.ok(uncalled.has('getShoppingLayout'), 'the shop is never opened in touch-landscape');
  assert.ok(!uncalled.has('renderMenu'), 'the menu is drawn in touch-landscape');
  assert.ok(game.missed.length > 0 && game.missed.length < game.code);
});
