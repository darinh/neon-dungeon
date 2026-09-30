'use strict';
// Release-version workflow guardrails. Product versioning belongs to GitHub
// Releases; sw.js must not carry a parallel numeric cache version.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const WORKFLOW = fs.readFileSync(
  path.resolve(__dirname, '..', '.github', 'workflows', 'release-version.yml'),
  'utf8'
);
const SW = fs.readFileSync(path.resolve(__dirname, '..', 'sw.js'), 'utf8');
const PACKAGE = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));
const LOCK = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package-lock.json'), 'utf8'));

test('release-version runs on main pushes and does not create release commits', () => {
  assert.match(WORKFLOW, /branches:\s*\[main\]/);
  assert.match(WORKFLOW, /^\s*workflow_dispatch:/m);
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
  assert.match(WORKFLOW, /no existing semver release tag found/);
  assert.match(WORKFLOW, /gh release create "v\$\{VERSION\}"/);
  assert.match(WORKFLOW, /--target "\$GITHUB_SHA"/);
  assert.doesNotMatch(WORKFLOW, /package\.json/);
  assert.doesNotMatch(WORKFLOW, /package-lock\.json/);
  assert.doesNotMatch(WORKFLOW, /git push origin "v\$\{VERSION\}"/);
});

test('release-version deploys same-origin version metadata with Pages artifact', () => {
  assert.match(WORKFLOW, /pages:\s*write/);
  assert.match(WORKFLOW, /id-token:\s*write/);
  assert.match(WORKFLOW, /actions\/configure-pages@v5/);
  assert.match(WORKFLOW, /actions\/upload-pages-artifact@v3/);
  assert.match(WORKFLOW, /actions\/deploy-pages@v4/);
  assert.match(WORKFLOW, /printf '\{"version":"%s","tag":"v%s","commit":"%s"\}\\n'/);
  assert.match(WORKFLOW, /> _site\/version\.json/);
  assert.match(WORKFLOW, /touch _site\/\.nojekyll/);
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

/**
 * A workflow step as Actions runs it: its `id`, its `env:` block, and its
 * dedented `run: |` script.
 * @param {string} name
 */
function step(name) {
  const lines = WORKFLOW.split('\n');
  const at = lines.findIndex((l) => l.trim() === `- name: ${name}`);
  assert.ok(at >= 0, `step "${name}" exists`);
  const keyIndent = (lines[at] ?? '').search(/\S/) + 2;
  let end = lines.findIndex((l, i) => i > at && l.trim() !== '' && l.search(/\S/) < keyIndent);
  if (end < 0) end = lines.length;
  const block = lines.slice(at + 1, end);
  /** @param {string} key */
  const keyAt = (key) => block.findIndex((l) => l.search(/\S/) === keyIndent && l.trim().startsWith(key + ':'));
  /** @param {number} from */
  const nested = (from) => {
    /** @type {string[]} */
    const out = [];
    for (const l of block.slice(from + 1)) {
      if (l.trim() && l.search(/\S/) <= keyIndent) break;
      out.push(l);
    }
    return out;
  };
  /** @type {Record<string, string>} */
  const env = {};
  const envAt = keyAt('env');
  if (envAt >= 0) {
    for (const l of nested(envAt)) {
      const m = /^\s*([A-Z_]+):\s*(.*)$/.exec(l);
      if (m) env[m[1] ?? ''] = m[2] ?? '';
    }
  }
  const runAt = keyAt('run');
  assert.ok(runAt >= 0 && /run: \|\s*$/.test(block[runAt] ?? ''), `step "${name}" has a run block`);
  const body = nested(runAt);
  const pad = Math.min(...body.filter((l) => l.trim()).map((l) => l.search(/\S/)));
  const idAt = keyAt('id');
  return {
    id: idAt >= 0 ? (block[idAt] ?? '').trim().slice('id:'.length).trim() : '',
    env,
    script: body.map((l) => l.slice(pad)).join('\n'),
  };
}

/**
 * Resolves `${{ a.b.c }}` the way Actions does: a missing value is empty.
 * @param {string} value
 * @param {any} context
 */
function resolveExpressions(value, context) {
  return value.replace(/\$\{\{\s*([\w.-]+)\s*\}\}/g, (_, ref) => {
    let v = context;
    for (const part of String(ref).split('.')) v = v == null ? undefined : v[part];
    return v == null ? '' : String(v);
  });
}

test('a release lists every non-merge commit since the previous release tag in its notes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nd-release-'));
  try {
    let clock = 1700000000;
    /** @param {string[]} args */
    const git = (...args) => {
      clock += 60;
      const date = `${clock} +0000`;
      return execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com',
        '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', ...args],
      { cwd: dir, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } }).trim();
    };
    git('init', '-q', '-b', 'main');
    git('commit', '-q', '--allow-empty', '-m', 'chore: released long ago');
    git('tag', 'v1.9.0');
    git('commit', '-q', '--allow-empty', '-m', 'fix: the previous release (#9)');
    git('tag', 'v1.10.0');
    git('checkout', '-q', '-b', 'side');
    git('commit', '-q', '--allow-empty', '-m', 'fix: keep the knob inside its card (#11)');
    git('checkout', '-q', 'main');
    git('merge', '-q', '--no-ff', 'side', '-m', "Merge branch 'side'");
    const message = 'feat: add the lattice trial (#10)\n\nDetails in the body.';
    git('commit', '-q', '--allow-empty', '-m', message);
    const sha = git('rev-parse', 'HEAD');

    const bin = path.join(dir, 'bin');
    const argsFile = path.join(dir, 'gh-args.json');
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'gh'),
      `#!/usr/bin/env node\nrequire('fs').writeFileSync(${JSON.stringify(argsFile)}, JSON.stringify(process.argv.slice(2)));\n`,
      { mode: 0o755 });
    /** @type {any} */
    const context = { github: { event: { head_commit: { message } } }, secrets: { GITHUB_TOKEN: 'test' }, steps: {} };
    /** @param {string} name */
    const run = (name) => {
      const s = step(name);
      const outputFile = path.join(dir, `output-${s.id || 'none'}`);
      fs.writeFileSync(outputFile, '');
      /** @type {Record<string, string | undefined>} */
      const env = { ...process.env, PATH: bin + path.delimiter + process.env.PATH, GITHUB_SHA: sha, GITHUB_OUTPUT: outputFile };
      for (const [k, v] of Object.entries(s.env)) env[k] = resolveExpressions(v, context);
      execFileSync('bash', ['-c', s.script], { cwd: dir, env, stdio: 'pipe' });
      /** @type {Record<string, string>} */
      const outputs = {};
      for (const line of fs.readFileSync(outputFile, 'utf8').split('\n').filter(Boolean)) {
        outputs[line.slice(0, line.indexOf('='))] = line.slice(line.indexOf('=') + 1);
      }
      if (s.id) context.steps[s.id] = { outputs };
      return outputs;
    };

    assert.deepEqual(run('Compute release bump'), { kind: 'minor' });
    assert.deepEqual(run('Compute release version'), { skip: 'false', version: '1.11.0', previous: 'v1.10.0' });
    run('Create GitHub release');
    assert.deepEqual(JSON.parse(fs.readFileSync(argsFile, 'utf8')), [
      'release', 'create', 'v1.11.0', '--target', sha, '--title', 'NEON DUNGEON v1.11.0', '--notes',
      `Automated minor release for main commit ${sha}.\n\n## Changes since v1.10.0\n\n` +
        '- feat: add the lattice trial (#10)\n- fix: keep the knob inside its card (#11)',
    ]);

    fs.rmSync(argsFile);
    context.steps.version.outputs.previous = '';
    assert.throws(() => run('Create GitHub release'), 'a release without a previous tag fails instead of publishing empty notes');
    assert.equal(fs.existsSync(argsFile), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
