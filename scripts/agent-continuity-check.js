#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const OPERATOR_GUARD_EXTENSION = '.github/extensions/neon-operator-guard/extension.mjs';
const STRANDED_OPERATOR_GUARD_PATHS = [
  '.github/extensions/neon-operator-guard',
  '.github/extensions/neon-operator-guard-live',
];
const REPOSITORY = 'darinh/neon-dungeon';
const DEVELOP_RULESET_NAME = 'develop: squash-only PRs';
const DEVELOP_REF = 'refs/heads/develop';
const ADMIN_REPOSITORY_ROLE_ID = 5;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    status: result.status === null ? 1 : result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function fail(message, details = []) {
  console.error(`agent-continuity-check: ${message}`);
  for (const detail of details) {
    if (detail) console.error(detail);
  }
  process.exit(1);
}

function discoverMainCheckout() {
  if (process.env.NEON_DUNGEON_PRIMARY_CHECKOUT) {
    return path.resolve(process.env.NEON_DUNGEON_PRIMARY_CHECKOUT);
  }

  const commonDir = run('git', ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  if (commonDir.status !== 0) {
    fail('failed to resolve git common directory', [commonDir.stderr.trim()]);
  }

  const resolvedCommonDir = path.resolve(commonDir.stdout.trim());
  if (!resolvedCommonDir.endsWith(`${path.sep}.git`)) {
    fail('failed to derive main checkout from git common directory', [resolvedCommonDir]);
  }

  return path.dirname(resolvedCommonDir);
}

const MAIN_CHECKOUT = discoverMainCheckout();

function parseJson(command, args) {
  const result = run(command, args);
  if (result.status !== 0) {
    fail(`failed to run ${command} ${args.join(' ')}`, [result.stderr.trim()]);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    fail(`failed to parse JSON from ${command} ${args.join(' ')}`, [String(error)]);
  }
}

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function ensureWorktree() {
  const top = run('git', ['rev-parse', '--show-toplevel']);
  if (top.status !== 0) fail('must run inside a git worktree', [top.stderr.trim()]);
  const resolvedTop = path.resolve(top.stdout.trim());
  if (resolvedTop === MAIN_CHECKOUT) {
    fail('refusing completion from the main checkout', [
      'Create or enter a Neon Dungeon worktree and continue there.',
    ]);
  }
  return resolvedTop;
}

function ensureOperatorGuardExtension(worktreeRoot) {
  const extensionPath = path.join(worktreeRoot, OPERATOR_GUARD_EXTENSION);
  if (!fs.existsSync(extensionPath)) {
    fail('operator guard extension is missing from this worktree', [
      OPERATOR_GUARD_EXTENSION,
      'Create it in the implementation worktree, not the main checkout.',
    ]);
  }

  const tracked = run('git', ['ls-files', '--error-unmatch', OPERATOR_GUARD_EXTENSION], {
    cwd: worktreeRoot,
  });
  if (tracked.status !== 0) {
    const ignored = run('git', ['check-ignore', '-v', OPERATOR_GUARD_EXTENSION], {
      cwd: worktreeRoot,
    });
    const addCommand = ignored.status === 0
      ? `git add -f ${OPERATOR_GUARD_EXTENSION}`
      : `git add ${OPERATOR_GUARD_EXTENSION}`;
    fail('operator guard extension exists but is not tracked', [
      ignored.stdout.trim() || '(not ignored by git)',
      `Stage it intentionally with: ${addCommand}`,
    ]);
  }

  const strayPrimaryExtensions = run('git', [
    '-C', MAIN_CHECKOUT,
    'ls-files', '--others', '--ignored', '--exclude-standard', ...STRANDED_OPERATOR_GUARD_PATHS,
  ]);
  if (strayPrimaryExtensions.status === 0 && strayPrimaryExtensions.stdout.trim()) {
    fail('ignored extension files are stranded in the main checkout', [
      strayPrimaryExtensions.stdout.trim(),
      'Remove these files from the main checkout and recreate/stage them in the implementation worktree.',
    ]);
  }
}

function ensureNoOpenOwnPrs() {
  const prs = parseJson('gh', [
    'pr', 'list',
    '--state', 'open',
    '--author', '@me',
    '--json', 'number,title,url,headRefName,baseRefName,isDraft',
  ]);
  if (prs.length > 0) {
    fail('open PRs authored by this agent still need monitoring', prs.map((pr) => {
      return `#${pr.number} ${pr.title} (${pr.headRefName} -> ${pr.baseRefName}) ${pr.url}`;
    }));
  }
}

function hasPullRequestRule(ruleset) {
  return (ruleset.rules || []).some((rule) => rule.type === 'pull_request');
}

function hasDevelopAdminBypass(ruleset) {
  return (ruleset.bypass_actors || []).some((actor) => {
    return actor.actor_type === 'RepositoryRole'
      && actor.actor_id === ADMIN_REPOSITORY_ROLE_ID
      && actor.bypass_mode === 'always';
  });
}

function refPatternMatches(pattern, refName) {
  if (pattern === refName) return true;
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escaped.replace(/\*/g, '.*')}$`);
  return regex.test(refName);
}

function rulesetTargetsRef(ruleset, refName) {
  if (ruleset.target !== 'branch') return false;
  const refCondition = ruleset.conditions && ruleset.conditions.ref_name;
  if (!refCondition) return true;
  const excludes = refCondition.exclude || [];
  if (excludes.some((pattern) => refPatternMatches(pattern, refName))) return false;
  const includes = refCondition.include || [];
  return includes.length === 0 || includes.some((pattern) => refPatternMatches(pattern, refName));
}

function ensureReleaseAlignmentBypass() {
  const rulesets = parseJson('gh', ['api', `repos/${REPOSITORY}/rulesets`]);
  const summary = rulesets.find((ruleset) => ruleset.name === DEVELOP_RULESET_NAME);
  if (!summary) {
    fail('develop release-alignment ruleset was not found', [
      `Expected repository ruleset: ${DEVELOP_RULESET_NAME}`,
    ]);
  }

  const ruleset = parseJson('gh', ['api', `repos/${REPOSITORY}/rulesets/${summary.id}`]);
  if (ruleset.enforcement !== 'active') {
    fail('develop ruleset is not active', [
      `${DEVELOP_RULESET_NAME} enforcement=${ruleset.enforcement}`,
    ]);
  }

  if (!hasPullRequestRule(ruleset)) {
    fail('develop ruleset no longer requires pull requests', [
      `${DEVELOP_RULESET_NAME} must keep its pull_request rule for normal integration.`,
    ]);
  }

  if (!hasDevelopAdminBypass(ruleset)) {
    fail('develop ruleset lacks the admin bypass required for post-release alignment', [
      'After a develop -> main rebase promotion, agents must be able to force-with-lease align develop to main without temporarily deleting rules.',
      `Add bypass actor: actor_type=RepositoryRole actor_id=${ADMIN_REPOSITORY_ROLE_ID} bypass_mode=always`,
    ]);
  }

  const activeDevelopPullRequestRulesets = [];
  for (const rulesetSummary of rulesets) {
    const candidate = parseJson('gh', ['api', `repos/${REPOSITORY}/rulesets/${rulesetSummary.id}`]);
    if (candidate.enforcement !== 'active') continue;
    if (!rulesetTargetsRef(candidate, DEVELOP_REF)) continue;
    if (!hasPullRequestRule(candidate)) continue;
    activeDevelopPullRequestRulesets.push(candidate.name);
    if (!hasDevelopAdminBypass(candidate)) {
      fail('active develop pull-request ruleset lacks release-alignment admin bypass', [
        candidate.name,
        `Every active pull-request ruleset targeting ${DEVELOP_REF} must include actor_type=RepositoryRole actor_id=${ADMIN_REPOSITORY_ROLE_ID} bypass_mode=always.`,
      ]);
    }
  }

  if (activeDevelopPullRequestRulesets.length === 0) {
    fail('no active pull-request ruleset targets develop', [
      `${DEVELOP_REF} must keep PR-only normal integration with an admin bypass for release alignment.`,
    ]);
  }
}

function ensureTrackedIssueClosed(issueNumber) {
  if (!issueNumber) return;
  const issue = parseJson('gh', [
    'issue', 'view', issueNumber,
    '--json', 'number,title,state,url',
  ]);
  if (issue.state !== 'CLOSED') {
    fail(`tracked issue #${issue.number} is still ${issue.state}`, [
      `${issue.title} ${issue.url}`,
      'Start the next coherent work item instead of calling task_complete.',
    ]);
  }
}

function main() {
  const worktreeRoot = ensureWorktree();
  if (hasFlag('--require-operator-guard')) {
    ensureOperatorGuardExtension(worktreeRoot);
  }
  ensureReleaseAlignmentBypass();
  ensureNoOpenOwnPrs();
  ensureTrackedIssueClosed(argValue('--issue'));
  console.log('agent-continuity-check: no open agent PRs or tracked issue blockers found');
}

if (require.main === module) {
  main();
} else {
  module.exports = {
    hasDevelopAdminBypass,
    hasPullRequestRule,
    rulesetTargetsRef,
  };
}
