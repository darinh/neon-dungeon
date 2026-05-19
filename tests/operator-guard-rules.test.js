// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  ACTIVE_ISSUE_NUMBER,
  commandRunsRawGhPrMerge,
  commandRunsUnboundedStartupDiscovery,
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

test('operator guard blocks unbounded startup branch and worktree discovery', () => {
  assert.equal(commandRunsUnboundedStartupDiscovery('git worktree list'), true);
  assert.equal(commandRunsUnboundedStartupDiscovery('git worktree list --porcelain'), true);
  assert.equal(commandRunsUnboundedStartupDiscovery('git --no-pager branch --no-merged develop'), true);
  assert.equal(commandRunsUnboundedStartupDiscovery('git -c color.ui=always branch --no-merged develop'), true);
  assert.equal(commandRunsUnboundedStartupDiscovery('GIT_PAGER=cat git -C repo -c color.ui=always worktree list'), true);
  assert.equal(commandRunsUnboundedStartupDiscovery('env GIT_PAGER=cat git worktree list'), true);
  assert.equal(commandRunsUnboundedStartupDiscovery('git branch --no-merged \"$BASE\" || true'), true);
  assert.equal(commandRunsUnboundedStartupDiscovery('bash -lc \"git worktree list\"'), true);
  assert.equal(commandRunsUnboundedStartupDiscovery('sh -c \"git branch --no-merged develop\"'), true);
  assert.equal(commandRunsUnboundedStartupDiscovery('bash -lc \"git worktree list; echo done\"'), true);
  assert.equal(commandRunsUnboundedStartupDiscovery('bash -lc \"git branch --no-merged develop && echo ok\"'), true);
  assert.equal(commandRunsUnboundedStartupDiscovery('(git worktree list)'), true);
  assert.equal(commandRunsUnboundedStartupDiscovery('$(git branch --no-merged develop)'), true);
  assert.equal(commandRunsUnboundedStartupDiscovery('git worktree list --porcelain | sed -n \"1,80p\"'), false);
  assert.equal(commandRunsUnboundedStartupDiscovery('git --no-pager branch --no-merged develop | wc -l'), false);
  assert.equal(commandRunsUnboundedStartupDiscovery('bash -lc \"git worktree list | head -n 20\"'), false);
  assert.equal(commandRunsUnboundedStartupDiscovery('git branch --list \"anvil/*\" --no-column | head -n 40'), false);
  assert.equal(commandRunsUnboundedStartupDiscovery('gh pr list --limit 20 --json number,title'), false);
  assert.equal(commandRunsUnboundedStartupDiscovery('echo \"git worktree list\"'), false);
  assert.equal(commandRunsUnboundedStartupDiscovery('grep \"git branch --no-merged\" docs/agent-retrospective.md'), false);
  assert.equal(commandRunsUnboundedStartupDiscovery('cat docs/agent-retrospective.md | grep \"git branch --no-merged\"'), false);
});
