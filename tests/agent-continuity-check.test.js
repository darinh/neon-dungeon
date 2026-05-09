// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  hasDevelopAdminBypass,
  hasPullRequestRule,
  rulesetTargetsRef,
} = require('../scripts/agent-continuity-check.js');

test('agent continuity check recognizes the develop pull request rule', () => {
  assert.equal(hasPullRequestRule({
    rules: [
      { type: 'deletion' },
      { type: 'pull_request' },
    ],
  }), true);

  assert.equal(hasPullRequestRule({
    rules: [
      { type: 'deletion' },
    ],
  }), false);
});

test('agent continuity check requires the admin bypass for release alignment', () => {
  assert.equal(hasDevelopAdminBypass({
    bypass_actors: [
      { actor_id: 5, actor_type: 'RepositoryRole', bypass_mode: 'always' },
    ],
  }), true);

  assert.equal(hasDevelopAdminBypass({
    bypass_actors: [
      { actor_id: 5, actor_type: 'RepositoryRole', bypass_mode: 'pull_request' },
      { actor_id: 4, actor_type: 'RepositoryRole', bypass_mode: 'always' },
    ],
  }), false);
});

test('agent continuity check identifies rulesets targeting develop', () => {
  assert.equal(rulesetTargetsRef({
    target: 'branch',
    conditions: {
      ref_name: {
        include: ['refs/heads/develop'],
        exclude: [],
      },
    },
  }, 'refs/heads/develop'), true);

  assert.equal(rulesetTargetsRef({
    target: 'branch',
    conditions: {
      ref_name: {
        include: ['refs/heads/*'],
        exclude: ['refs/heads/develop'],
      },
    },
  }, 'refs/heads/develop'), false);

  assert.equal(rulesetTargetsRef({
    target: 'tag',
    conditions: {
      ref_name: {
        include: ['refs/heads/develop'],
        exclude: [],
      },
    },
  }, 'refs/heads/develop'), false);
});
