#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');

const OPEN_PR_LIMIT = 100;

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
  const parsed = { dryRun: false };
  for (const arg of argv) {
    if (arg === '--dry-run') {
      parsed.dryRun = true;
    } else {
      fail(`unknown option: ${arg}`);
    }
  }
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

function gitOutput(args) {
  const result = run('git', args);
  if (result.status !== 0) {
    fail(`failed to run git ${args.join(' ')}`, [result.stderr.trim()]);
  }
  return result.stdout.trim();
}

function openPrsForBase(base) {
  const prs = parseJson('gh', [
    'pr', 'list',
    '--state', 'open',
    '--base', base,
    '--limit', String(OPEN_PR_LIMIT),
    '--json', 'number,title,headRefName,baseRefName,url',
  ]);
  if (!Array.isArray(prs)) {
    fail(`gh pr list for ${base} did not return an array`);
  }
  if (prs.length >= OPEN_PR_LIMIT) {
    fail(`open PR list for ${base} reached limit ${OPEN_PR_LIMIT}; evidence may be truncated`);
  }
  return prs;
}

function openPrsForHead(head) {
  const prs = parseJson('gh', [
    'pr', 'list',
    '--state', 'open',
    '--head', head,
    '--limit', String(OPEN_PR_LIMIT),
    '--json', 'number,title,headRefName,baseRefName,url',
  ]);
  if (!Array.isArray(prs)) {
    fail(`gh pr list for head ${head} did not return an array`);
  }
  if (prs.length >= OPEN_PR_LIMIT) {
    fail(`open PR list for head ${head} reached limit ${OPEN_PR_LIMIT}; evidence may be truncated`);
  }
  return prs;
}

function formatPr(pr) {
  return `#${pr.number} ${pr.headRefName}->${pr.baseRefName} ${pr.title}`;
}

function validateNoOpenPrs({ mainPrs, developPrs, developHeadPrs }) {
  const details = [];
  if (mainPrs.length) {
    details.push(`open PRs targeting main: ${mainPrs.map(formatPr).join('; ')}`);
  }
  if (developPrs.length) {
    details.push(`open PRs targeting develop: ${developPrs.map(formatPr).join('; ')}`);
  }
  if (developHeadPrs.length) {
    details.push(`open PRs from develop: ${developHeadPrs.map(formatPr).join('; ')}`);
  }
  if (details.length) {
    fail('refusing shared-branch alignment while open main/develop PRs exist', details);
  }
}

function validateTrees({ mainTree, developTree }) {
  if (mainTree !== developTree) {
    fail('refusing shared-branch alignment because origin/main and origin/develop trees differ', [
      `origin/main tree: ${mainTree}`,
      `origin/develop tree: ${developTree}`,
    ]);
  }
}

function buildForceWithLeasePushArgs({ sourceRef = 'origin/main', targetBranch = 'develop', expectedOldSha }) {
  if (!expectedOldSha) fail('expectedOldSha is required for force-with-lease');
  return [
    'push',
    `--force-with-lease=${targetBranch}:${expectedOldSha}`,
    'origin',
    `${sourceRef}:${targetBranch}`,
  ];
}

function alignDevelopToMain(argv) {
  const opts = parseArgs(argv);
  const fetch = run('git', ['fetch', 'origin', 'main', 'develop', '--tags'], { stdio: ['ignore', 'pipe', 'pipe'] });
  process.stdout.write(fetch.stdout);
  process.stderr.write(fetch.stderr);
  if (fetch.status !== 0) fail('failed to fetch origin main/develop before alignment');

  const oldDevelop = gitOutput(['rev-parse', 'origin/develop']);
  const newMain = gitOutput(['rev-parse', 'origin/main']);
  const developTree = gitOutput(['rev-parse', 'origin/develop^{tree}']);
  const mainTree = gitOutput(['rev-parse', 'origin/main^{tree}']);
  const mainPrs = openPrsForBase('main');
  const developPrs = openPrsForBase('develop');
  const developHeadPrs = openPrsForHead('develop');

  validateTrees({ mainTree, developTree });
  validateNoOpenPrs({ mainPrs, developPrs, developHeadPrs });

  console.log(`align-develop: old develop ${oldDevelop}`);
  console.log(`align-develop: new main ${newMain}`);
  console.log(`align-develop: matching tree ${mainTree}`);
  console.log(`align-develop: open PRs targeting main=${mainPrs.length} develop=${developPrs.length}; from develop=${developHeadPrs.length}`);

  const pushArgs = buildForceWithLeasePushArgs({ expectedOldSha: oldDevelop });
  if (opts.dryRun) {
    console.log(`align-develop: dry run command: git ${pushArgs.join(' ')}`);
    return { dryRun: true, oldDevelop, newMain, mainTree };
  }

  const push = run('git', pushArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
  process.stdout.write(push.stdout);
  process.stderr.write(push.stderr);
  if (push.status !== 0) fail('develop alignment push failed');

  const verifiedDevelop = gitOutput(['ls-remote', 'origin', 'refs/heads/develop']).split(/\s+/)[0];
  if (verifiedDevelop !== newMain) {
    fail('develop alignment did not verify after push', [
      `expected develop: ${newMain}`,
      `actual develop: ${verifiedDevelop || '(missing)'}`,
    ]);
  }
  console.log(`align-develop: verified origin/develop ${verifiedDevelop}`);
  return { oldDevelop, newMain, mainTree };
}

if (require.main === module) {
  try {
    alignDevelopToMain(process.argv.slice(2));
  } catch (error) {
    console.error(`align-develop: ${error.message}`);
    for (const detail of error.details || []) console.error(detail);
    process.exit(1);
  }
}

module.exports = {
  parseArgs,
  validateNoOpenPrs,
  validateTrees,
  buildForceWithLeasePushArgs,
};
