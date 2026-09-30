// @ts-check
'use strict';

// Which runtime code the golden journeys execute. Runs every journey under V8
// precise coverage, then maps the covered byte ranges to source lines.
// Usage: node tests/_journey-coverage.js help

const fs = require('node:fs');
const path = require('node:path');
const inspector = require('node:inspector');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');

/**
 * For each 1-based line, the offsets whose execution counts decide whether the
 * line ran: the start of every syntax node on it, and for a string or template
 * spanning lines, its start on each line it crosses. Empty for lines without
 * code (comments, blank lines, closing brackets).
 * @param {string} src
 * @returns {number[][]}
 */
function codeLineOffsets(src) {
  const sf = ts.createSourceFile('file.js', src, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
  /** @type {number[][]} */
  const byLine = Array.from({ length: sf.getLineStarts().length + 1 }, () => []);
  /** @param {number} pos */
  const lineOf = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
  /** @param {import('typescript').Node} node */
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.EndOfFileToken) return;
    const start = node.getStart(sf);
    const first = lineOf(start);
    byLine[first]?.push(start);
    if (ts.isStringLiteralLike(node) || ts.isTemplateLiteral(node) || ts.isRegularExpressionLiteral(node)) {
      for (let line = first + 1; line <= lineOf(node.end); line++) byLine[line]?.push(start);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  return byLine;
}

/**
 * Execution count at every offset. Coverage ranges nest, so applying them
 * from widest to narrowest leaves each offset with its innermost count.
 * @param {number} length
 * @param {Array<{ startOffset: number, endOffset: number, count: number }>} ranges
 */
function offsetCounts(length, ranges) {
  const counts = new Int32Array(length);
  const sorted = [...ranges].sort((a, b) => (b.endOffset - b.startOffset) - (a.endOffset - a.startOffset));
  for (const r of sorted) counts.fill(r.count, r.startOffset, Math.min(r.endOffset, length));
  return counts;
}

/**
 * @param {string} src
 * @param {Array<{ functionName: string, ranges: Array<{ startOffset: number, endOffset: number, count: number }> }>} functions
 */
function lineCoverage(src, functions) {
  const counts = offsetCounts(src.length, functions.flatMap((f) => f.ranges));
  const offsets = codeLineOffsets(src);
  /** @type {number[]} */
  const code = [];
  /** @type {number[]} */
  const missed = [];
  // A line counts as run only if every node on it ran: a condition can run while its
  // one-line branch does not.
  offsets.forEach((lineOffsets, line) => {
    if (!lineOffsets.length) return;
    code.push(line);
    if (lineOffsets.some((offset) => !((counts[offset] ?? 0) > 0))) missed.push(line);
  });
  /** @type {number[]} */
  const lineStarts = [0];
  for (let i = src.indexOf('\n'); i >= 0; i = src.indexOf('\n', i + 1)) lineStarts.push(i + 1);
  /** @param {number} pos 1-based line containing pos. */
  const lineOf = (pos) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((lineStarts[mid] ?? 0) <= pos) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
  const uncalled = functions
    .filter((f) => f.functionName && f.ranges[0] && f.ranges[0].count === 0)
    .map((f) => ({ name: f.functionName, line: lineOf(f.ranges[0]?.startOffset ?? 0) }));
  return { code: code.length, missed, uncalled };
}

/**
 * Plays journeys under V8 precise coverage and returns coverage per runtime
 * file. Must run before anything else in the process loads the game scripts.
 * @param {{ root?: string, journeys?: string[] }} [opts]
 */
function collectCoverage(opts = {}) {
  const root = opts.root || ROOT;
  const session = new inspector.Session();
  session.connect();
  /** @param {string} method @param {object} [params] @returns {any} */
  const post = (method, params = {}) => {
    /** @type {any} */
    let result;
    /** @type {Error | null} */
    let error = null;
    session.post(method, params, (err, res) => { error = err; result = res; });
    if (error) throw error;
    return result;
  };
  try {
    post('Profiler.enable');
    post('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
    const { JOURNEYS, runJourney } = require(path.join(root, 'tests', '_game-sim.js'));
    for (const name of opts.journeys || Object.keys(JOURNEYS)) runJourney(name, { root });
    const scripts = /** @type {Array<{ url: string, functions: any[] }>} */ (post('Profiler.takePreciseCoverage').result);
    const { requiredInIndex } = require(path.join(root, 'scripts', 'manifest.js'));
    /** @type {Map<string, ReturnType<typeof lineCoverage>>} */
    const files = new Map();
    for (const rel of /** @type {string[]} */ (requiredInIndex)) {
      const functions = scripts.filter((s) => s.url === rel).flatMap((s) => s.functions);
      const src = fs.readFileSync(path.join(root, rel), 'utf8');
      files.set(rel.replace(/^\.\//, ''), lineCoverage(src, functions));
    }
    return files;
  } finally {
    post('Profiler.stopPreciseCoverage');
    session.disconnect();
  }
}

/**
 * New-file line numbers that a unified diff with zero context adds or changes.
 * @param {string} diff Output of `git diff -U0`.
 * @returns {Map<string, number[]>}
 */
function changedLines(diff) {
  /** @type {Map<string, number[]>} */
  const out = new Map();
  let file = '';
  for (const line of diff.split('\n')) {
    const header = /^\+\+\+ (?:b\/)?(.+)$/.exec(line);
    if (header) { file = header[1] === '/dev/null' ? '' : (header[1] ?? ''); continue; }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!hunk || !file) continue;
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    const lines = out.get(file) || [];
    for (let i = 0; i < count; i++) lines.push(start + i);
    out.set(file, lines);
  }
  return out;
}

/** @param {number[]} lines */
function ranges(lines) {
  /** @type {string[]} */
  const out = [];
  for (let i = 0; i < lines.length;) {
    let j = i;
    while (j + 1 < lines.length && (lines[j + 1] ?? 0) === (lines[j] ?? 0) + 1) j++;
    out.push(i === j ? String(lines[i]) : `${lines[i]}-${lines[j]}`);
    i = j + 1;
  }
  return out.join(', ');
}

const HELP = `Usage: node tests/_journey-coverage.js [command]

  (no command)          Code lines each runtime file executes across all golden
                        journeys, worst-covered first.
  uncovered <file>      Line ranges and never-called functions in one file.
  diff [ref]            Added or changed runtime code lines (vs ref, default
                        origin/develop) that no journey executes. Exits 1 if
                        there are any: the oracle cannot vouch for them.`;

/** @param {string[]} argv */
function main(argv) {
  const [cmd, arg] = argv;
  if (cmd === 'help' || cmd === '--help') { console.log(HELP); return; }
  const files = collectCoverage();
  if (!cmd) {
    const rows = [...files].map(([f, c]) => ({ f, code: c.code, run: c.code - c.missed.length })).sort((a, b) => (b.code - b.run) - (a.code - a.run));
    let code = 0;
    let run = 0;
    for (const r of rows) {
      code += r.code;
      run += r.run;
      if (r.code) console.log(`${r.f.padEnd(44)} ${String(r.run).padStart(5)}/${String(r.code).padEnd(5)} ${(100 * r.run / r.code).toFixed(1).padStart(5)}%`);
    }
    console.log(`${'total'.padEnd(44)} ${String(run).padStart(5)}/${String(code).padEnd(5)} ${(100 * run / code).toFixed(1).padStart(5)}%`);
  } else if (cmd === 'uncovered' && arg) {
    const c = files.get(arg.replace(/^\.\//, ''));
    if (!c) throw new Error(`${arg} is not a runtime file in scripts/manifest.js`);
    console.log(`${arg}: ${c.missed.length} of ${c.code} code lines never run`);
    console.log(`lines: ${ranges(c.missed)}`);
    console.log(`never-called functions: ${c.uncalled.map((u) => `${u.name}:${u.line}`).join(', ') || 'none'}`);
  } else if (cmd === 'diff') {
    const ref = arg || 'origin/develop';
    const diff = execFileSync('git', ['-C', ROOT, 'diff', '-U0', ref, '--', ...files.keys()], { encoding: 'utf8', maxBuffer: 1 << 28 });
    let unproven = 0;
    for (const [file, lines] of changedLines(diff)) {
      const c = files.get(file);
      if (!c) continue;
      const missed = new Set(c.missed);
      const miss = lines.filter((l) => missed.has(l));
      unproven += miss.length;
      if (miss.length) console.log(`${file}: ${miss.length} changed code line(s) no journey runs: ${ranges(miss)}`);
    }
    console.log(unproven ? `${unproven} changed line(s) are outside the oracle's reach` : 'every changed runtime code line runs in a golden journey');
    if (unproven) process.exitCode = 1;
  } else {
    console.log(HELP);
    process.exitCode = 1;
  }
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { codeLineOffsets, offsetCounts, lineCoverage, collectCoverage, changedLines, ranges };
