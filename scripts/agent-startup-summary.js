#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_PAGER: 'cat' },
  });
  return {
    status: result.status === null ? 1 : result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function countNonEmptyLines(text) {
  return text.split(/\r?\n/).filter((line) => line.trim()).length;
}

function parseArgs(argv) {
  const opts = { base: 'develop', issue: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--base' || arg === '--issue') {
      const value = argv[++i];
      if (!value || value.startsWith('-')) throw new Error(`${arg} requires a value`);
      if (arg === '--base') opts.base = value;
      else {
        if (!/^\d+$/.test(value)) throw new Error('--issue requires a numeric value');
        opts.issue = value;
      }
    }
  }
  return opts;
}

function printCommand(label, command, args, options = {}) {
  const result = run(command, args, options);
  const suffix = result.status === 0 ? '' : ` exit=${result.status}`;
  console.log(`${label}${suffix}: ${result.stdout.trim() || result.stderr.trim() || '(none)'}`);
  if (options.required && result.status !== 0) {
    throw new Error(`${label} failed`);
  }
  return result;
}

function runRequired(label, command, args, options = {}) {
  const result = run(command, args, options);
  if (result.status !== 0) {
    console.log(`${label} exit=${result.status}: ${result.stderr.trim() || result.stdout.trim() || '(none)'}`);
    throw new Error(`${label} failed`);
  }
  return result;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const root = printCommand('root', 'git', ['rev-parse', '--show-toplevel'], { required: true }).stdout.trim();
  printCommand('branch', 'git', ['branch', '--show-current'], { required: true });
  const status = runRequired('status_probe', 'git', ['status', '--porcelain']);
  console.log(`status_count: ${countNonEmptyLines(status.stdout)}`);
  const untracked = runRequired('untracked_probe', 'git', ['ls-files', '--others', '--exclude-standard']);
  console.log(`untracked_count: ${countNonEmptyLines(untracked.stdout)}`);
  const worktrees = runRequired('worktree_probe', 'git', ['worktree', 'list', '--porcelain']);
  console.log(`worktree_count: ${(worktrees.stdout.match(/^worktree /gm) || []).length}`);
  const unmerged = runRequired('unmerged_probe', 'git', ['branch', '--no-merged', opts.base, '--format=%(refname:short)']);
  console.log(`unmerged_from_${opts.base}_count: ${countNonEmptyLines(unmerged.stdout)}`);
  printCommand('origin_main', 'git', ['rev-parse', '--short=12', 'origin/main'], { required: true });
  printCommand('origin_develop', 'git', ['rev-parse', '--short=12', 'origin/develop'], { required: true });
  printCommand('open_prs', 'gh', [
    'pr', 'list',
    '--state', 'open',
    '--limit', '20',
    '--json', 'number,title,headRefName,baseRefName,mergeStateStatus',
    '--jq', '.[] | "#\\(.number) \\(.headRefName)->\\(.baseRefName) \\(.mergeStateStatus) \\(.title)"',
  ], { required: true });
  if (opts.issue) {
    printCommand(`issue_${opts.issue}`, 'gh', [
      'issue', 'view', opts.issue,
      '--json', 'number,title,state,url',
      '--jq', '"#\\(.number) \\(.state) \\(.title) \\(.url)"',
    ], { required: true });
  }
  if (root && root !== '/home/darin/projects/neon-dungeon') {
    const mainStatus = runRequired('main_checkout_status_probe', 'git', ['-C', '/home/darin/projects/neon-dungeon', 'status', '--porcelain']);
    console.log(`main_checkout_status_count: ${countNonEmptyLines(mainStatus.stdout)}`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`agent-startup-summary: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
} else {
  module.exports = {
    countNonEmptyLines,
    parseArgs,
  };
}
