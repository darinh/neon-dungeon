#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
  return {
    status: result.status === null ? 1 : result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function fail(message, details = []) {
  const error = new Error(message);
  error.details = details.filter(Boolean);
  throw error;
}

function parseArgs(argv) {
  const parsed = {
    pr: null,
    method: null,
    subject: null,
    body: null,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg) continue;
    if (arg === '--dry-run') {
      parsed.dryRun = true;
    } else if (arg === '--delete-branch') {
      fail('refusing --delete-branch; perform remote cleanup separately after merge verification');
    } else if (arg === '--method') {
      parsed.method = argv[++i] || null;
    } else if (arg.startsWith('--method=')) {
      parsed.method = arg.slice('--method='.length);
    } else if (arg === '--subject') {
      parsed.subject = argv[++i] || null;
    } else if (arg.startsWith('--subject=')) {
      parsed.subject = arg.slice('--subject='.length);
    } else if (arg === '--body') {
      parsed.body = argv[++i] || null;
    } else if (arg.startsWith('--body=')) {
      parsed.body = arg.slice('--body='.length);
    } else if (arg.startsWith('-')) {
      fail(`unknown option: ${arg}`);
    } else if (!parsed.pr) {
      parsed.pr = arg;
    } else {
      fail(`unexpected argument: ${arg}`);
    }
  }
  if (!parsed.pr) fail('usage: npm run merge:pr -- <pr> [--method squash|rebase] [--subject text] [--body text]');
  return parsed;
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

function expectedMethod(baseRefName) {
  if (baseRefName === 'develop') return 'squash';
  if (baseRefName === 'main') return 'rebase';
  return null;
}

function normalizeMethod(requestedMethod, baseRefName) {
  const expected = expectedMethod(baseRefName);
  const method = requestedMethod || expected;
  if (!method) fail(`--method is required for base branch ${baseRefName}`);
  if (method !== 'squash' && method !== 'rebase') {
    fail(`unsupported merge method "${method}"; use squash or rebase`);
  }
  if (expected && method !== expected) {
    fail(`base ${baseRefName} requires ${expected} merge, not ${method}`);
  }
  return method;
}

function checkFailures(statusCheckRollup) {
  const failures = [];
  for (const check of statusCheckRollup || []) {
    const name = `${check.workflowName || 'check'}/${check.name || 'unknown'}`;
    if (check.status !== 'COMPLETED' || check.conclusion !== 'SUCCESS') {
      failures.push(`${name}: status=${check.status || '(unknown)'} conclusion=${check.conclusion || '(none)'}`);
    }
  }
  return failures;
}

function preflight(pr, requestedMethod) {
  const view = parseJson('gh', [
    'pr', 'view', pr,
    '--json', 'state,mergeStateStatus,statusCheckRollup,headRefName,baseRefName,isCrossRepository',
  ]);
  return validateView(pr, view, requestedMethod);
}

function validateView(pr, view, requestedMethod) {
  if (view.state !== 'OPEN') {
    fail(`PR #${pr} is ${view.state}; aborting merge`);
  }
  if (view.mergeStateStatus !== 'CLEAN') {
    fail(`PR #${pr} merge state is ${view.mergeStateStatus || '(unknown)'}; aborting merge`);
  }
  const method = normalizeMethod(requestedMethod, view.baseRefName);
  if (view.baseRefName === 'main' && (view.headRefName !== 'develop' || view.isCrossRepository)) {
    fail(`main promotions must come from same-repository develop, not ${view.headRefName}`);
  }
  const failures = checkFailures(view.statusCheckRollup);
  if (failures.length) {
    fail(`PR #${pr} has non-successful checks; aborting merge`, failures);
  }
  return { view, method };
}

function mergeArgs(pr, method, opts) {
  const args = ['pr', 'merge', pr, `--${method}`];
  if (opts.subject) args.push('--subject', opts.subject);
  if (opts.body) args.push('--body', opts.body);
  return args;
}

function verifyMerged(pr) {
  return parseJson('gh', ['pr', 'view', pr, '--json', 'state,mergedAt,mergeCommit']);
}

function guardedMerge(argv) {
  const opts = parseArgs(argv);
  const { view, method } = preflight(opts.pr, opts.method);
  const args = mergeArgs(opts.pr, method, opts);
  console.log(`guarded-merge: preflight state=${view.state} base=${view.baseRefName} head=${view.headRefName} method=${method}`);
  if (opts.dryRun) {
    console.log(`guarded-merge: dry run command: gh ${args.join(' ')}`);
    return { dryRun: true, args };
  }
  const result = run('gh', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  const merged = verifyMerged(opts.pr);
  if (merged.state !== 'MERGED') {
    fail(`PR #${opts.pr} did not verify as merged after gh pr merge`, [
      `state=${merged.state}`,
      result.stderr.trim(),
    ]);
  }
  console.log(`guarded-merge: verified merged at ${merged.mergedAt} commit ${merged.mergeCommit?.oid || '(none)'}`);
  return { merged };
}

if (require.main === module) {
  try {
    guardedMerge(process.argv.slice(2));
  } catch (error) {
    console.error(`guarded-merge: ${error.message}`);
    for (const detail of error.details || []) console.error(detail);
    process.exit(1);
  }
}

module.exports = {
  parseArgs,
  normalizeMethod,
  checkFailures,
  mergeArgs,
  validateView,
};
