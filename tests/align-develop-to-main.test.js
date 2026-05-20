// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  parseArgs,
  validateNoOpenPrs,
  validateTrees,
  buildForceWithLeasePushArgs,
} = require('../scripts/align-develop-to-main.js');

/** @param {unknown} error */
function errorDetails(error) {
  if (!(error instanceof Error)) return '';
  const details = Reflect.get(error, 'details');
  return Array.isArray(details) ? details.join('\n') : '';
}

test('develop alignment parses dry-run option only', () => {
  assert.deepEqual(parseArgs([]), { dryRun: false });
  assert.deepEqual(parseArgs(['--dry-run']), { dryRun: true });
  assert.throws(() => parseArgs(['--force']), /unknown option/);
});

test('develop alignment refuses any open main or develop PRs', () => {
  assert.doesNotThrow(() => validateNoOpenPrs({ mainPrs: [], developPrs: [], developHeadPrs: [] }));
  assert.throws(() => validateNoOpenPrs({
    mainPrs: [{ number: 1, headRefName: 'develop', baseRefName: 'main', title: 'promotion' }],
    developPrs: [],
    developHeadPrs: [],
  }), (error) => error instanceof Error
    && /refusing shared-branch alignment/.test(error.message)
    && /open PRs targeting main/.test(errorDetails(error)));
  assert.throws(() => validateNoOpenPrs({
    mainPrs: [],
    developPrs: [{ number: 2, headRefName: 'feat/x', baseRefName: 'develop', title: 'feature' }],
    developHeadPrs: [],
  }), (error) => error instanceof Error
    && /refusing shared-branch alignment/.test(error.message)
    && /open PRs targeting develop/.test(errorDetails(error)));
  assert.throws(() => validateNoOpenPrs({
    mainPrs: [],
    developPrs: [],
    developHeadPrs: [{ number: 3, headRefName: 'develop', baseRefName: 'release/v-next', title: 'release prep' }],
  }), (error) => error instanceof Error
    && /refusing shared-branch alignment/.test(error.message)
    && /open PRs from develop/.test(errorDetails(error)));
});

test('develop alignment requires patch-equivalent main and develop trees', () => {
  assert.doesNotThrow(() => validateTrees({ mainTree: 'tree-a', developTree: 'tree-a' }));
  assert.throws(() => validateTrees({ mainTree: 'tree-a', developTree: 'tree-b' }), /trees differ/);
});

test('develop alignment builds force-with-lease push from observed old develop SHA', () => {
  assert.deepEqual(buildForceWithLeasePushArgs({
    expectedOldSha: 'abc123',
  }), [
    'push',
    '--force-with-lease=develop:abc123',
    'origin',
    'origin/main:develop',
  ]);
  assert.throws(() => buildForceWithLeasePushArgs({ expectedOldSha: '' }), /expectedOldSha is required/);
});
