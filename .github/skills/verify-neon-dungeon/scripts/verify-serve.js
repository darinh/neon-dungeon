#!/usr/bin/env node
// @ts-check
'use strict';

// Dependency-free static server for NEON DUNGEON verification runs.
//
//   node verify-serve.js [--root DIR] [--port N] [--run-dir DIR]
//
// Binds 127.0.0.1 only. --port 0 (the default) picks an ephemeral port. Prints
// exactly one stdout line, `READY <url> pid=<pid>`, once listening; request
// logs go to stderr. --run-dir is not used for serving: it is recorded in the
// process command line and in /version.json so `verify.js` can prove which
// process and run answer a URL.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const DEFAULT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

/** @type {Readonly<Record<string, string>>} */
const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
});

/** @param {string} filePath */
function mimeTypeFor(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

/**
 * Maps a raw request URL onto a file under root. Any `..` segment (raw or
 * percent-encoded) or an encoded separator inside a segment is refused before
 * resolution, so a traversal attempt is a 403 rather than a silently
 * normalized in-root path.
 * @param {string} root absolute root directory
 * @param {string} rawUrl request URL as received (path + optional query)
 * @returns {{ status: 200, file: string, trailingSlash: boolean } | { status: 400 | 403 }}
 */
function resolveSafePath(root, rawUrl) {
  const rawPath = rawUrl.split(/[?#]/)[0] || '/';
  /** @type {string[]} */
  let segments;
  try {
    segments = rawPath.split('/').map((s) => decodeURIComponent(s));
  } catch (_) {
    return { status: 400 };
  }
  if (segments.some((s) => s === '..' || s.includes('/') || s.includes('\\') || s.includes('\0'))) {
    return { status: 403 };
  }
  const file = path.resolve(root, segments.filter(Boolean).join('/'));
  if (file !== root && !file.startsWith(root + path.sep)) return { status: 403 };
  return { status: 200, file, trailingSlash: rawPath.endsWith('/') };
}

/** @param {string} root */
function gitHead(root) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    }).trim() || 'unknown';
  } catch (_) {
    return 'unknown';
  }
}

/**
 * VERIFICATION SCAFFOLDING: production `version.json` is written by
 * .github/workflows/release-version.yml into the Pages artifact. Locally the
 * file does not exist, so this server answers it from memory (no file is ever
 * written). `commit` is the root's HEAD at request time; `pid`, `runDir` and
 * `root` (the directory this process actually serves) identify this process
 * and run, so `verify.js doctor` can prove the URL it tests belongs to the run
 * it was given and serves the root it recorded.
 * @param {string} root
 * @param {string | null} runDir
 */
function syntheticVersion(root, runDir) {
  return { version: '0.0.0-local', tag: 'local', commit: gitHead(root), pid: process.pid, runDir, root };
}

/**
 * @param {string | undefined} header
 * @param {number} size
 * @returns {{ start: number, end: number } | 'invalid' | null}
 */
function parseRange(header, size) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return 'invalid';
  let start;
  let end;
  if (m[1] === '') {
    const suffix = Number(m[2]);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start > end || start >= size) return 'invalid';
  return { start, end };
}

/**
 * @param {{ root: string, runDir?: string | null }} opts
 * @returns {http.Server}
 */
function createServer(opts) {
  const root = path.resolve(opts.root);
  const runDir = opts.runDir || null;
  const realRoot = fs.realpathSync(root);

  return http.createServer((req, res) => {
    const method = req.method || 'GET';
    /**
     * @param {number} status
     * @param {Record<string, string | number>} headers
     * @param {string | Buffer | null} [body]
     */
    const send = (status, headers, body) => {
      res.writeHead(status, { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
      res.end(method === 'HEAD' ? undefined : body || undefined);
      process.stderr.write(`${new Date().toISOString()} ${method} ${req.url} ${status}\n`);
    };
    /** @param {number} status @param {string} text */
    const sendText = (status, text) => {
      const body = Buffer.from(text + '\n');
      send(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': body.length }, body);
    };

    if (method !== 'GET' && method !== 'HEAD') {
      send(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' }, 'method not allowed\n');
      return;
    }
    const rawUrl = req.url || '/';
    if (rawUrl.split(/[?#]/)[0] === '/version.json') {
      const body = Buffer.from(JSON.stringify(syntheticVersion(root, runDir)));
      send(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length }, body);
      return;
    }
    const resolved = resolveSafePath(root, rawUrl);
    if (resolved.status !== 200) {
      sendText(resolved.status, resolved.status === 400 ? 'bad request' : 'forbidden');
      return;
    }

    let file = resolved.file;
    let stat;
    try {
      stat = fs.statSync(file);
      if (stat.isDirectory()) {
        if (!resolved.trailingSlash) {
          const location = (rawUrl.split(/[?#]/)[0] || '/') + '/';
          send(301, { Location: location, 'Content-Type': 'text/plain; charset=utf-8' }, 'moved\n');
          return;
        }
        file = path.join(file, 'index.html');
        stat = fs.statSync(file);
      }
      const real = fs.realpathSync(file);
      if (real !== realRoot && !real.startsWith(realRoot + path.sep)) { sendText(403, 'forbidden'); return; }
    } catch (_) {
      sendText(404, 'not found');
      return;
    }
    if (!stat.isFile()) { sendText(404, 'not found'); return; }

    const size = stat.size;
    const range = parseRange(req.headers.range, size);
    if (range === 'invalid') {
      send(416, { 'Content-Range': `bytes */${size}`, 'Content-Type': 'text/plain; charset=utf-8' }, 'range not satisfiable\n');
      return;
    }
    const data = fs.readFileSync(file);
    const headers = { 'Content-Type': mimeTypeFor(file), 'Accept-Ranges': 'bytes' };
    if (range) {
      const chunk = data.subarray(range.start, range.end + 1);
      send(206, { ...headers, 'Content-Range': `bytes ${range.start}-${range.end}/${size}`, 'Content-Length': chunk.length }, chunk);
      return;
    }
    send(200, { ...headers, 'Content-Length': data.length }, data);
  });
}

/**
 * The command line. Each flag may appear once: with a repeated --root, a
 * process check reading the first one and this server using the last one
 * would disagree about what is served, so repeats are refused. verify.js
 * checks a running server's argv with this same function.
 * @param {string[]} argv
 * @returns {{ root: string, port: number, runDir: string | null }}
 */
function parseServeArgs(argv) {
  const out = { root: DEFAULT_ROOT, port: 0, runDir: /** @type {string | null} */ (null) };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag !== '--root' && flag !== '--port' && flag !== '--run-dir') {
      throw new Error(`unknown argument: ${flag}`);
    }
    if (seen.has(flag)) throw new Error(`duplicate ${flag}: each flag may be given once`);
    seen.add(flag);
    if (value === undefined || value.startsWith('--')) throw new Error(`${flag} needs a value`);
    i++;
    if (flag === '--root') out.root = path.resolve(value);
    else if (flag === '--run-dir') out.runDir = path.resolve(value);
    else {
      const port = Number(value);
      if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`--port must be 0-65535, got ${value}`);
      out.port = port;
    }
  }
  return out;
}

function main() {
  let args;
  try {
    args = parseServeArgs(process.argv.slice(2));
    if (!fs.statSync(args.root).isDirectory()) throw new Error(`--root is not a directory: ${args.root}`);
  } catch (err) {
    process.stderr.write(`verify-serve: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(2);
  }
  const server = createServer({ root: args.root, runDir: args.runDir });
  server.on('error', (err) => {
    process.stderr.write(`verify-serve: ${err.message}\n`);
    process.exit(1);
  });
  server.listen(args.port, '127.0.0.1', () => {
    const addr = server.address();
    const port = addr && typeof addr === 'object' ? addr.port : args.port;
    process.stdout.write(`READY http://127.0.0.1:${port}/ pid=${process.pid}\n`);
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (require.main === module) main();

module.exports = { DEFAULT_ROOT, MIME_TYPES, mimeTypeFor, resolveSafePath, syntheticVersion, parseRange, createServer, parseServeArgs };
