// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  parseArgs,
  normalizeMethod,
  checkFailures,
  mergeArgs,
  validateView,
} = require('../scripts/merge-pr-guarded.js');

test('guarded merge refuses local branch deletion cleanup', () => {
  assert.throws(
    () => parseArgs(['902', '--method', 'squash', '--delete-branch']),
    /refusing --delete-branch/
  );
});

test('guarded merge enforces project merge methods by target branch', () => {
  assert.equal(normalizeMethod(null, 'develop'), 'squash');
  assert.equal(normalizeMethod(null, 'main'), 'rebase');
  assert.throws(() => normalizeMethod('rebase', 'develop'), /requires squash/);
  assert.throws(() => normalizeMethod('squash', 'main'), /requires rebase/);
});

test('guarded merge blocks pending or failed statuses', () => {
  assert.deepEqual(checkFailures([
    { workflowName: 'test', name: 'npm run check', status: 'COMPLETED', conclusion: 'SUCCESS' },
  ]), []);
  assert.deepEqual(checkFailures([
    { workflowName: 'test', name: 'npm run check', status: 'IN_PROGRESS', conclusion: '' },
    { workflowName: 'policy', name: 'branch', status: 'COMPLETED', conclusion: 'FAILURE' },
  ]), [
    'test/npm run check: status=IN_PROGRESS conclusion=(none)',
    'policy/branch: status=COMPLETED conclusion=FAILURE',
  ]);
});

test('guarded merge requires a clean merge state', () => {
  assert.throws(() => validateView('902', {
    state: 'OPEN',
    mergeStateStatus: 'DIRTY',
    baseRefName: 'develop',
    headRefName: 'feature',
    isCrossRepository: false,
    statusCheckRollup: [],
  }, 'squash'), /merge state is DIRTY/);
});

test('guarded merge blocks cross-repository main promotions', () => {
  assert.throws(() => validateView('903', {
    state: 'OPEN',
    mergeStateStatus: 'CLEAN',
    baseRefName: 'main',
    headRefName: 'develop',
    isCrossRepository: true,
    statusCheckRollup: [],
  }, 'rebase'), /same-repository develop/);
  assert.equal(validateView('903', {
    state: 'OPEN',
    mergeStateStatus: 'CLEAN',
    baseRefName: 'main',
    headRefName: 'develop',
    isCrossRepository: false,
    statusCheckRollup: [],
  }, 'rebase').method, 'rebase');
});

test('guarded merge builds gh merge command without delete-branch', () => {
  assert.deepEqual(mergeArgs('902', 'squash', {
    subject: 'refactor: extract helper',
    body: 'Refs #579',
  }), [
    'pr', 'merge', '902', '--squash',
    '--subject', 'refactor: extract helper',
    '--body', 'Refs #579',
  ]);
});
