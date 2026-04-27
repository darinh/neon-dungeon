'use strict';
// Cache-bump skip-marker scope regression test.
//
// Originally the cache-bump workflow's loop guard checked
//   !contains(github.event.head_commit.message, '[skip cache-bump]')
// against the FULL commit message. That meant any PR whose commit body
// mentioned the marker for documentation reasons (e.g. PR #179's commit
// body explained the workflow contract) silently skipped the next
// auto-bump on develop.
//
// Fix: GHA expressions don't have a `split()` function (a first attempt
// using `split(message, '\n')[0]` was rejected by gpt-5.3-codex review
// — `split` is not a documented GHA expression function and would have
// errored at runtime). Instead the guard now uses startsWith() against
// the bot's auto-bump commit subject prefix, which is body-content-
// independent.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WORKFLOW = fs.readFileSync(
  path.resolve(__dirname, '..', '.github', 'workflows', 'cache-bump.yml'),
  'utf8'
);

test('cache-bump self-loop guard uses startsWith() against the bot subject prefix', () => {
  // The fixed form must use startsWith on the auto-bump commit's
  // subject prefix. Anchoring on the prefix makes the guard
  // body-content-independent.
  assert.match(
    WORKFLOW,
    /startsWith\s*\(\s*github\.event\.head_commit\.message\s*,\s*['"]chore\(cache\):\s*bump sw cache['"]\s*\)/,
    'cache-bump if-condition must use startsWith(message, "chore(cache): bump sw cache") to match the bot subject prefix'
  );
});

test('cache-bump skip-marker check no longer reads the full message via contains()', () => {
  // The pre-fix shape was contains(github.event.head_commit.message, '[skip cache-bump]').
  // That false-positives on body text. Asserting it's gone is the regression guard.
  const fullMessageContains = WORKFLOW.match(
    /contains\s*\(\s*github\.event\.head_commit\.message\s*,\s*['"]\[skip cache-bump\]['"]/
  );
  assert.equal(
    fullMessageContains,
    null,
    'cache-bump if-condition must NOT use contains(github.event.head_commit.message, "[skip cache-bump]") — that matches body text and silently skips the next bump'
  );
});

test('cache-bump if-condition does NOT use the GHA-unsupported split() function', () => {
  // gpt-5.3-codex review of the v1 fix caught this: `split` is not a
  // documented GitHub Actions expression function. A workflow whose
  // job-level `if:` references an undefined function fails to evaluate,
  // skipping the job entirely. Pin the source to keep `split` out.
  const splitUsage = WORKFLOW.match(
    /\bsplit\s*\(\s*github\.event\.head_commit\.message/
  );
  assert.equal(
    splitUsage,
    null,
    'cache-bump if-condition must NOT use split() — not a GHA expression function, will fail at runtime'
  );
});

test('cache-bump auto-bump commit subject still STARTS with the prefix the guard expects', () => {
  // The guard and the bot's commit subject must agree. The bot
  // composes its subject from a TITLE template — assert that template
  // also begins with the same prefix the if-condition matches.
  // Matches the line:  TITLE="chore(cache): bump sw cache to v...
  assert.match(
    WORKFLOW,
    /TITLE\s*=\s*"chore\(cache\):\s*bump sw cache to/,
    'auto-bump TITLE must start with "chore(cache): bump sw cache to" so the startsWith() loop guard matches it'
  );
});

test('cache-bump still gates on github.actor != github-actions[bot]', () => {
  // Belt-and-suspenders: even if the prefix check breaks, the actor
  // check prevents a self-loop.
  assert.match(
    WORKFLOW,
    /github\.actor\s*!=\s*['"]github-actions\[bot\]['"]/,
    'cache-bump must continue to gate on github.actor != github-actions[bot]'
  );
});
