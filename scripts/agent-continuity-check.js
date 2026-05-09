#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const MAIN_CHECKOUT = '/home/darin/projects/neon-dungeon';
const OPERATOR_GUARD_EXTENSION = '.github/extensions/neon-operator-guard/extension.mjs';

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
    'ls-files', '--others', '--ignored', '--exclude-standard', '.github/extensions',
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
  ensureNoOpenOwnPrs();
  ensureTrackedIssueClosed(argValue('--issue'));
  console.log('agent-continuity-check: no open agent PRs or tracked issue blockers found');
}

main();
