// @ts-check
'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn, spawnSync, execFileSync } = require('node:child_process');

const {
  DEFAULT_ROOT,
  mimeTypeFor,
  resolveSafePath,
  parseRange,
  parseServeArgs,
} = require('../.github/skills/verify-neon-dungeon/scripts/verify-serve.js');

const ROOT = path.resolve(__dirname, '..');
const SERVE = path.join(ROOT, '.github', 'skills', 'verify-neon-dungeon', 'scripts', 'verify-serve.js');

/**
 * Spawns the real server and resolves once it prints its first stdout line.
 * @param {string[]} args
 * @returns {Promise<{ child: import('node:child_process').ChildProcess, firstLine: string, url: string }>}
 */
function startServer(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVE, ...args], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`no stdout line within 5s: ${out}`));
    }, 5000);
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`verify-serve exited early with ${code}`));
    });
    /** @type {import('node:stream').Readable} */ (child.stdout).on('data', (chunk) => {
      out += chunk;
      const nl = out.indexOf('\n');
      if (nl < 0) return;
      clearTimeout(timer);
      const firstLine = out.slice(0, nl);
      const m = /^READY (\S+) pid=\d+$/.exec(firstLine);
      resolve({ child, firstLine, url: m && m[1] ? m[1] : '' });
    });
  });
}

/**
 * Raw HTTP request that sends rawPath byte-for-byte (fetch would normalize `..`).
 * @param {string} base
 * @param {string} rawPath
 * @param {{ method?: string, headers?: Record<string, string> }} [opts]
 * @returns {Promise<{ status: number, headers: import('node:http').IncomingHttpHeaders, body: Buffer }>}
 */
function request(base, rawPath, opts = {}) {
  const u = new URL(base);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: u.hostname, port: u.port, path: rawPath, method: opts.method || 'GET', headers: opts.headers || {} }, (res) => {
      /** @type {Buffer[]} */
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });
}

function gitHeadOrUnknown() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (_) {
    return 'unknown';
  }
}

/** @type {{ child: import('node:child_process').ChildProcess, firstLine: string, url: string }} */
let server;

before(async () => {
  server = await startServer(['--root', ROOT, '--port', '0']);
});

after(() => {
  server.child.removeAllListeners('exit');
  server.child.kill('SIGTERM');
});

test('prints one READY line with a 127.0.0.1 ephemeral-port URL and its own pid', () => {
  const m = /^READY http:\/\/127\.0\.0\.1:(\d+)\/ pid=(\d+)$/.exec(server.firstLine);
  assert.ok(m, `unexpected first line: ${server.firstLine}`);
  assert.notEqual(Number(m[1]), 0);
  assert.equal(Number(m[2]), server.child.pid);
});

test('serves index.html at / as text/html with Cache-Control: no-store', async () => {
  const res = await request(server.url, '/');
  assert.equal(res.status, 200);
  assert.equal(res.headers['content-type'], 'text/html; charset=utf-8');
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.deepEqual(res.body, fs.readFileSync(path.join(ROOT, 'index.html')));
});

test('serves scripts, images and JSON with their MIME types', async () => {
  const js = await request(server.url, '/src/game.js');
  assert.equal(js.status, 200);
  assert.equal(js.headers['content-type'], 'text/javascript; charset=utf-8');
  const png = await request(server.url, '/icon-192x192.png');
  assert.equal(png.headers['content-type'], 'image/png');
  assert.equal(Number(png.headers['content-length']), fs.statSync(path.join(ROOT, 'icon-192x192.png')).size);
  const manifest = await request(server.url, '/manifest.json');
  assert.equal(manifest.headers['content-type'], 'application/json; charset=utf-8');
});

test('returns 404 with no-store for a missing file', async () => {
  const res = await request(server.url, '/no-such-file.js');
  assert.equal(res.status, 404);
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('refuses path traversal outside the root with 403', async () => {
  for (const raw of ['/../package.json', '/src/../../package.json', '/%2e%2e/package.json', '/src/..%2f..%2fpackage.json']) {
    const res = await request(server.url, raw);
    assert.equal(res.status, 403, raw);
  }
});

test('answers /version.json from memory with the root HEAD commit and this process', async () => {
  const res = await request(server.url, '/version.json');
  assert.equal(res.status, 200);
  assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.deepEqual(JSON.parse(res.body.toString('utf8')), {
    version: '0.0.0-local', tag: 'local', commit: gitHeadOrUnknown(), pid: server.child.pid, runDir: null, root: ROOT,
  });
  assert.equal(fs.existsSync(path.join(ROOT, 'version.json')), false);
});

test('reports the --run-dir it was started for in /version.json', async () => {
  const runDir = path.join(ROOT, 'no-such-run-dir');
  const s = await startServer(['--root', ROOT, '--port', '0', '--run-dir', runDir]);
  try {
    const res = await request(s.url, '/version.json');
    const meta = JSON.parse(res.body.toString('utf8'));
    assert.equal(meta.pid, s.child.pid);
    assert.equal(meta.runDir, runDir);
  } finally {
    s.child.removeAllListeners('exit');
    s.child.kill('SIGTERM');
  }
});

test('refuses a repeated --root, --run-dir or --port instead of serving the last one', () => {
  for (const flag of ['--root', '--run-dir', '--port']) {
    const value = flag === '--port' ? '0' : ROOT;
    assert.throws(() => parseServeArgs([flag, value, flag, value]), { message: `duplicate ${flag}: each flag may be given once` });
  }
  assert.deepEqual(parseServeArgs(['--root', ROOT, '--port', '0', '--run-dir', path.join(ROOT, 'run')]), { root: ROOT, port: 0, runDir: path.join(ROOT, 'run') });
  // The real process exits 2 before listening; a server that started would be killed by the timeout.
  const run = spawnSync(process.execPath, [SERVE, '--root', path.join(ROOT, 'src'), '--port', '0', '--root', ROOT], { encoding: 'utf8', timeout: 5000 });
  assert.equal(run.status, 2);
  assert.equal(run.stdout, '');
  assert.equal(run.stderr, 'verify-serve: duplicate --root: each flag may be given once\n');
});

test('honours a byte range request with 206 Partial Content', async () => {
  const size = fs.statSync(path.join(ROOT, 'assets', 'audio', 'title-theme.wav')).size;
  const res = await request(server.url, '/assets/audio/title-theme.wav', { headers: { Range: 'bytes=0-9' } });
  assert.equal(res.status, 206);
  assert.equal(res.headers['content-type'], 'audio/wav');
  assert.equal(res.headers['content-range'], `bytes 0-9/${size}`);
  assert.equal(res.body.length, 10);
});

test('rejects methods other than GET and HEAD with 405', async () => {
  const res = await request(server.url, '/', { method: 'POST' });
  assert.equal(res.status, 405);
});

test('defaults --root to the repository root derived from the script location', async () => {
  assert.equal(DEFAULT_ROOT, ROOT);
  const s = await startServer(['--port', '0']);
  try {
    const res = await request(s.url, '/index.html');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, fs.readFileSync(path.join(ROOT, 'index.html')));
  } finally {
    s.child.removeAllListeners('exit');
    s.child.kill('SIGTERM');
  }
});

test('resolveSafePath maps URLs into the root and flags traversal and bad encoding', () => {
  assert.deepEqual(resolveSafePath(ROOT, '/src/game.js?v=1'), { status: 200, file: path.join(ROOT, 'src', 'game.js'), trailingSlash: false });
  assert.deepEqual(resolveSafePath(ROOT, '/assets/'), { status: 200, file: path.join(ROOT, 'assets'), trailingSlash: true });
  assert.deepEqual(resolveSafePath(ROOT, '/../etc/passwd'), { status: 403 });
  assert.deepEqual(resolveSafePath(ROOT, '/a%00b'), { status: 403 });
  assert.deepEqual(resolveSafePath(ROOT, '/%E0%A4%A'), { status: 400 });
});

test('parseRange handles start-end, open-ended, suffix and unsatisfiable ranges', () => {
  assert.deepEqual(parseRange('bytes=0-9', 100), { start: 0, end: 9 });
  assert.deepEqual(parseRange('bytes=90-', 100), { start: 90, end: 99 });
  assert.deepEqual(parseRange('bytes=-10', 100), { start: 90, end: 99 });
  assert.deepEqual(parseRange('bytes=50-500', 100), { start: 50, end: 99 });
  assert.equal(parseRange('bytes=200-300', 100), 'invalid');
  assert.equal(parseRange('items=0-1', 100), 'invalid');
  assert.equal(parseRange(undefined, 100), null);
});

test('mimeTypeFor covers game asset types and falls back to octet-stream', () => {
  assert.equal(mimeTypeFor('assets/audio/title-theme.wav'), 'audio/wav');
  assert.equal(mimeTypeFor('sw.js'), 'text/javascript; charset=utf-8');
  assert.equal(mimeTypeFor('icon.PNG'), 'image/png');
  assert.equal(mimeTypeFor('LICENSE'), 'application/octet-stream');
});
