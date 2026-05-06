'use strict';
// Release-version workflow guardrails. Product versioning belongs to GitHub
// Releases; sw.js must not carry a parallel numeric cache version.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WORKFLOW = fs.readFileSync(
  path.resolve(__dirname, '..', '.github', 'workflows', 'release-version.yml'),
  'utf8'
);
const SW = fs.readFileSync(path.resolve(__dirname, '..', 'sw.js'), 'utf8');
const PACKAGE = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));
const LOCK = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package-lock.json'), 'utf8'));

test('release-version runs on main pushes and does not create release commits', () => {
  assert.match(WORKFLOW, /branches:\s*\[main\]/);
  assert.match(WORKFLOW, /github\.actor\s*!=\s*['"]github-actions\[bot\]['"]/);
  assert.doesNotMatch(WORKFLOW, /chore\(release\)/);
  assert.doesNotMatch(WORKFLOW, /pull-requests:\s*write/);
  assert.doesNotMatch(WORKFLOW, /gh pr create/);
  assert.doesNotMatch(WORKFLOW, /gh pr merge/);
});

test('release-version does not use body-wide contains() skip checks', () => {
  const fullMessageContains = WORKFLOW.match(
    /contains\s*\(\s*github\.event\.head_commit\.message/
  );
  assert.equal(fullMessageContains, null);
});

test('release-version if-condition does NOT use the GHA-unsupported split() function', () => {
  const splitUsage = WORKFLOW.match(
    /\bsplit\s*\(\s*github\.event\.head_commit\.message/
  );
  assert.equal(splitUsage, null);
});

test('release-version tags the exact main commit without editing package files', () => {
  assert.match(WORKFLOW, /fetch-depth:\s*0/);
  assert.match(WORKFLOW, /git tag --points-at "\$GITHUB_SHA"/);
  assert.match(WORKFLOW, /git tag --list 'v\[0-9\]\*\.\[0-9\]\*\.\[0-9\]\*'/);
  assert.match(WORKFLOW, /gh release create "v\$\{VERSION\}"/);
  assert.match(WORKFLOW, /--target "\$GITHUB_SHA"/);
  assert.doesNotMatch(WORKFLOW, /package\.json/);
  assert.doesNotMatch(WORKFLOW, /package-lock\.json/);
  assert.doesNotMatch(WORKFLOW, /git push origin "v\$\{VERSION\}"/);
});

test('release-version parses bump markers from conventional commit positions only', () => {
  assert.match(WORKFLOW, /subject=\$\(printf '%s' "\$MSG" \| head -n 1\)/);
  assert.match(WORKFLOW, /\^BREAKING CHANGE:/);
  assert.match(WORKFLOW, /\^\[A-Za-z\]\+\(\\\(\.\+\\\)\)\?!:/);
  assert.match(WORKFLOW, /printf '%s' "\$subject" \| grep -qE '\^feat\(\\\(\.\+\\\)\)\?:'/);
  assert.doesNotMatch(WORKFLOW, /grep -qE 'BREAKING CHANGE\|!:'/);
});

test('package metadata is not a second app version source', () => {
  assert.equal(Object.hasOwn(PACKAGE, 'version'), false);
  assert.equal(Object.hasOwn(LOCK, 'version'), false);
  assert.equal(Object.hasOwn(LOCK.packages[''], 'version'), false);
});

test('service worker has no numeric cache version to bump', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /const\s+CACHE\s*=\s*'neon-dungeon-assets'/);
  assert.match(SW, /const\s+ASSET_URLS\s*=\s*new Set/);
  assert.match(SW, /if\s*\(\s*!ASSET_URLS\.has\(url\.href\)\s*\)/);
  assert.match(SW, /e\.waitUntil\(caches\.open\(CACHE\)\.then\(\(c\) => c\.put\(e\.request, clone\)\)\)/);
  assert.match(SW, /function isAppShellNavigation\(url\)/);
  assert.match(SW, /if\s*\(\s*!isAppShellNavigation\(url\)\s*\)/);
  assert.match(SW, /if\s*\(\s*!ASSET_URLS\.has\(url\.href\)\s*\)\s*\{\s*e\.respondWith\(fetch\(e\.request\)\)/);
  assert.match(SW, /cacheFromNetwork\(e\)\.catch\(\(\) => caches\.match\(e\.request\)\)/);
  assert.match(SW, /cacheAppShellFromNetwork\(e\)\.catch/);
  assert.match(SW, /c\.put\('\.\/', clone\)/);
});
