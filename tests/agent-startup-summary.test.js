// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  countNonEmptyLines,
  parseArgs,
} = require('../scripts/agent-startup-summary.js');

test('agent startup summary counts non-empty lines only', () => {
  assert.equal(countNonEmptyLines('a\n\n b \n'), 2);
  assert.equal(countNonEmptyLines('\n\n'), 0);
});

test('agent startup summary parses issue and base options', () => {
  assert.deepEqual(parseArgs([]), { base: 'develop', issue: null });
  assert.deepEqual(parseArgs(['--issue', '579', '--base', 'main']), { base: 'main', issue: '579' });
  assert.throws(() => parseArgs(['--issue', '--base', 'main']), /--issue requires a value/);
  assert.throws(() => parseArgs(['--issue', '-h']), /--issue requires a value/);
  assert.throws(() => parseArgs(['--issue', 'abc']), /--issue requires a numeric value/);
  assert.throws(() => parseArgs(['--base']), /--base requires a value/);
});
