#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');

const KNOWN_AGENT_EMAILS = new Set([
  '223556219+Copilot@users.noreply.github.com',
  '277349900+bropilot-cli[bot]@users.noreply.github.com',
]);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_PAGER: 'cat' },
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
  const opts = {
    base: 'main',
    head: 'develop',
    intendedPr: null,
    allowHumanAuthored: false,
    authority: '',
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--base' || arg === '--head' || arg === '--intended-pr' || arg === '--authority') {
      const value = argv[++i];
      if (!value || value.startsWith('-')) fail(`${arg} requires a value`);
      if (arg === '--base') opts.base = value;
      else if (arg === '--head') opts.head = value;
      else if (arg === '--intended-pr') {
        if (!/^\d+$/.test(value)) fail('--intended-pr requires a numeric PR number');
        opts.intendedPr = Number(value);
      } else {
        opts.authority = value;
      }
    } else if (arg === '--allow-human-authored') {
      opts.allowHumanAuthored = true;
    } else {
      fail(`unknown option: ${arg}`);
    }
  }
  if (opts.base !== 'main' || opts.head !== 'develop') {
    fail('only develop -> main promotion audits are supported');
  }
  return opts;
}

function parseCommitRange(text) {
  return text.split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [oid, author, email, ...subjectParts] = line.split('\t');
      return { oid, author, email, subject: subjectParts.join('\t') };
    });
}

function humanAuthoredCommits(commits) {
  return commits.filter((commit) => !KNOWN_AGENT_EMAILS.has(commit.email));
}

function parseJsonOutput(label, result) {
  if (result.status !== 0) fail(`${label} failed`, [result.stderr.trim() || result.stdout.trim()]);
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    fail(`${label} returned invalid JSON`, [String(error)]);
  }
}

function validateOpenPrs({ mainPrs, developPrs, intendedPr }) {
  const unexpectedMain = intendedPr === null
    ? mainPrs
    : mainPrs.filter((pr) => pr.number !== intendedPr);
  if (unexpectedMain.length) {
    fail('unexpected open PRs targeting main', unexpectedMain.map((pr) => `#${pr.number} ${pr.headRefName}->${pr.baseRefName} ${pr.title}`));
  }
  if (intendedPr !== null && !mainPrs.some((pr) => pr.number === intendedPr)) {
    fail(`intended promotion PR #${intendedPr} is not open against main`);
  }
  if (developPrs.length) {
    fail('open PRs targeting develop must be reconciled before promotion', developPrs.map((pr) => `#${pr.number} ${pr.headRefName}->${pr.baseRefName} ${pr.title}`));
  }
}

function requireSuccess(label, command, args) {
  const result = run(command, args);
  if (result.status !== 0) fail(`${label} failed`, [result.stderr.trim() || result.stdout.trim()]);
  return result.stdout.trim();
}

function promotionAudit(argv, runner = run) {
  const opts = parseArgs(argv);
  const call = (command, args) => {
    const result = runner(command, args);
    if (result.status !== 0) fail(`${command} ${args.join(' ')} failed`, [result.stderr.trim() || result.stdout.trim()]);
    return result.stdout.trim();
  };

  call('git', ['fetch', 'origin', opts.base, opts.head, '--quiet']);
  const baseSha = call('git', ['rev-parse', `origin/${opts.base}`]);
  const headSha = call('git', ['rev-parse', `origin/${opts.head}`]);
  const range = `origin/${opts.base}..origin/${opts.head}`;
  const commitText = call('git', ['log', '--format=%H\t%an\t%ae\t%s', range]);
  const commits = parseCommitRange(commitText);
  if (!commits.length) fail(`no commits to promote in ${range}`);

  const humanCommits = humanAuthoredCommits(commits);
  if (humanCommits.length && (!opts.allowHumanAuthored || opts.authority.trim().length < 20)) {
    fail('human-authored promotion commits require --allow-human-authored and a quoted --authority', humanCommits.map((commit) => `${commit.oid} ${commit.author} <${commit.email}> ${commit.subject}`));
  }

  const rulesets = call('gh', ['api', 'repos/darinh/neon-dungeon/rulesets', '--jq', '.[] | select(.target=="branch" and .enforcement=="active") | .name']);
  if (!rulesets.includes('main: rebase-only PRs') || !rulesets.includes('develop: squash-only PRs')) {
    fail('required develop/main rulesets were not found active', [rulesets || '(none)']);
  }

  const mainPrs = parseJsonOutput('open main PR query', runner('gh', [
    'pr', 'list',
    '--base', opts.base,
    '--state', 'open',
    '--limit', '100',
    '--json', 'number,title,headRefName,baseRefName,author',
  ]));
  const developPrs = parseJsonOutput('open develop PR query', runner('gh', [
    'pr', 'list',
    '--base', opts.head,
    '--state', 'open',
    '--limit', '100',
    '--json', 'number,title,headRefName,baseRefName,author',
  ]));
  validateOpenPrs({ mainPrs, developPrs, intendedPr: opts.intendedPr });

  console.log('promotion-audit: PASS');
  console.log(`base: ${opts.base} ${baseSha}`);
  console.log(`head: ${opts.head} ${headSha}`);
  console.log(`range: ${range}`);
  for (const commit of commits) {
    const human = KNOWN_AGENT_EMAILS.has(commit.email) ? 'agent' : 'human';
    console.log(`commit: ${commit.oid} ${commit.author} <${commit.email}> [${human}] ${commit.subject}`);
  }
  if (humanCommits.length) console.log(`authority: ${opts.authority}`);
  console.log(`rulesets: ${rulesets.split(/\r?\n/).filter(Boolean).join(', ')}`);
  console.log(`open_main_pr_count: ${mainPrs.length}`);
  console.log(`open_develop_pr_count: ${developPrs.length}`);
}

if (require.main === module) {
  try {
    promotionAudit(process.argv.slice(2));
  } catch (error) {
    console.error(`promotion-audit: ${error.message}`);
    for (const detail of error.details || []) console.error(detail);
    process.exit(1);
  }
} else {
  module.exports = {
    KNOWN_AGENT_EMAILS,
    parseArgs,
    parseCommitRange,
    humanAuthoredCommits,
    validateOpenPrs,
    promotionAudit,
  };
}
