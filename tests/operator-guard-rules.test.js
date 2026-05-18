// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  ACTIVE_ISSUE_NUMBER,
  commandRunsRawGhPrMerge,
} = require('../scripts/operator-guard-rules.js');

test('operator guard tracks the active dungeon extraction issue', () => {
  assert.equal(ACTIVE_ISSUE_NUMBER, '579');
});

test('operator guard blocks raw gh pull request merge commands', () => {
  assert.equal(commandRunsRawGhPrMerge('gh pr merge 926 --rebase'), true);
  assert.equal(commandRunsRawGhPrMerge('set -e\nstate=$(gh pr view 926 --json state --jq .state)\ngh pr merge "$pr" --squash'), true);
  assert.equal(commandRunsRawGhPrMerge('echo "gh pr merge is intentionally blocked even in text"'), true);
  assert.equal(commandRunsRawGhPrMerge('bash -lc "gh pr merge 926 --rebase"'), true);
  assert.equal(commandRunsRawGhPrMerge('npm run merge:pr -- 926 --method rebase'), false);
  assert.equal(commandRunsRawGhPrMerge('node scripts/merge-pr-guarded.js 925 --method squash'), false);
});
