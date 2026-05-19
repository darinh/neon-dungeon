'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  parseArgs,
  parseCommitRange,
  humanAuthoredCommits,
  validateOpenPrs,
} = require('../scripts/check-promotion-audit.js');

test('promotion audit parses default develop to main options', () => {
  assert.deepEqual(parseArgs([]), {
    base: 'main',
    head: 'develop',
    intendedPr: null,
    allowHumanAuthored: false,
    authority: '',
  });
  assert.deepEqual(parseArgs(['--intended-pr', '981', '--allow-human-authored', '--authority', 'Project instructions permit develop to main promotion.']).intendedPr, 981);
});

test('promotion audit identifies human authored commits separately from agent trailers', () => {
  const commits = parseCommitRange([
    'abc\tDarin Hoover\tdarinh@gmail.com\trefactor: ship slice',
    'def\tbropilot-cli[bot]\t277349900+bropilot-cli[bot]@users.noreply.github.com\trefactor: work',
    'ghi\tCopilot\t223556219+Copilot@users.noreply.github.com\tCo-authored-by',
  ].join('\n'));

  assert.deepEqual(humanAuthoredCommits(commits).map((commit) => commit.oid), ['abc']);
});

test('promotion audit rejects unexpected open main or develop PRs', () => {
  assert.throws(() => validateOpenPrs({
    mainPrs: [{ number: 12, headRefName: 'develop', baseRefName: 'main', title: 'release' }],
    developPrs: [],
    intendedPr: null,
  }), /unexpected open PRs targeting main/);

  assert.throws(() => validateOpenPrs({
    mainPrs: [{ number: 12, headRefName: 'develop', baseRefName: 'main', title: 'release' }],
    developPrs: [{ number: 13, headRefName: 'feat/x', baseRefName: 'develop', title: 'feature' }],
    intendedPr: 12,
  }), /open PRs targeting develop/);

  assert.doesNotThrow(() => validateOpenPrs({
    mainPrs: [{ number: 12, headRefName: 'develop', baseRefName: 'main', title: 'release' }],
    developPrs: [],
    intendedPr: 12,
  }));
});
