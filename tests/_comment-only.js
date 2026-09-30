// @ts-check
'use strict';

// Proves a change is prose comments only, as AGENTS.md "Code review policy"
// defines it: every changed file is JavaScript (not a declaration file), its
// comment-stripped TypeScript emit is byte-identical, and its directives
// (@ts-*, eslint-*, global) and JSDoc type tags are unchanged.
// Usage, from anywhere inside the repository to check:
//   node tests/_comment-only.js [base-ref]   (default origin/develop)

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const TYPE_TAG = /@(type|param|arg|argument|returns?|typedef|template|property|prop|callback|this|enum|satisfies|overload|import|extends|augments|implements)\b[^\n*]*/g;
// Transpiling drops triple-slash directives, so identity alone would not catch their removal.
const DIRECTIVE = /@ts-[a-z-]+|eslint[a-z-]*|^\/\*\s*globals?\s|^\/\/\/\s*<(reference|amd-)/;

/** @param {string} code */
function strippedEmit(code) {
  return ts.transpileModule(code, { compilerOptions: { removeComments: true, target: ts.ScriptTarget.ESNext } }).outputText;
}

/**
 * Every comment in source order, found through the parser so regexes and
 * template literals are never mistaken for comments.
 * @param {string} code
 * @returns {string[]}
 */
function comments(code) {
  const sf = ts.createSourceFile('file.js', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  /** @type {Map<number, string>} */
  const seen = new Map();
  /** @param {import('typescript').CommentRange[] | undefined} ranges */
  const add = (ranges) => {
    for (const r of ranges || []) seen.set(r.pos, code.slice(r.pos, r.end));
  };
  // Comments on a token's own line are its trailing trivia; the rest lead the next token.
  /** @param {import('typescript').Node} node */
  const walk = (node) => {
    add(ts.getLeadingCommentRanges(code, node.pos));
    add(ts.getTrailingCommentRanges(code, node.end));
    for (const child of node.getChildren(sf)) walk(child);
  };
  walk(sf);
  add(ts.getLeadingCommentRanges(code, sf.endOfFileToken.pos));
  return [...seen.entries()].sort((a, b) => a[0] - b[0]).map(([, text]) => text);
}

/**
 * The parts of comments that are not prose: directives and JSDoc type tags,
 * in order, with whitespace normalized.
 * @param {string} code
 * @returns {string[]}
 */
function nonProse(code) {
  /** @type {string[]} */
  const out = [];
  for (const c of comments(code)) {
    if (DIRECTIVE.test(c)) out.push(c.replace(/\s+/g, ' ').trim());
    else if (c.startsWith('/**')) for (const m of c.matchAll(TYPE_TAG)) out.push(m[0].replace(/\s+/g, ' ').trim());
  }
  return out;
}

/**
 * Why a change from `before` to `after` in `file` is not prose comments only,
 * or null when it is.
 * @param {string} file
 * @param {string | null} before Null for a file that did not exist.
 * @param {string | null} after Null for a deleted file.
 * @returns {string | null}
 */
function verdict(file, before, after) {
  if (!/\.(js|cjs|mjs)$/.test(file) || /\.d\.ts$/.test(file)) return 'not a JavaScript file';
  if (before === null) return 'new file';
  if (after === null) return 'deleted file';
  if (strippedEmit(before) !== strippedEmit(after)) return 'code changed: comment-stripped emit differs';
  const a = nonProse(before);
  const b = nonProse(after);
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    return `directive or JSDoc type tag changed: ${JSON.stringify(a[i] ?? null)} -> ${JSON.stringify(b[i] ?? null)}`;
  }
  return null;
}

/** @param {string[]} args */
function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
}

/** @param {string} ref @param {string} file */
function show(ref, file) {
  try {
    return git('show', `${ref}:${file}`);
  } catch {
    return null;
  }
}

/** @param {string} root @param {string} file */
function readWorking(root, file) {
  try {
    return fs.readFileSync(path.join(root, file), 'utf8');
  } catch {
    return null;
  }
}

/** @param {string[]} argv */
function main(argv) {
  const base = argv[0] || 'origin/develop';
  const root = git('rev-parse', '--show-toplevel').trim();
  process.chdir(root);
  try {
    git('rev-parse', '--verify', '--quiet', `${base}^{commit}`);
  } catch {
    console.log(`unknown base ref: ${base}`);
    process.exitCode = 2;
    return;
  }
  const files = git('diff', '--name-only', base, '--').split('\n').filter(Boolean);
  const untracked = git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean);
  if (!files.length && !untracked.length) {
    console.log(`no files changed since ${base}`);
    process.exitCode = 1;
    return;
  }
  let failures = 0;
  for (const file of [...files, ...untracked]) {
    const why = verdict(file, show(base, file), readWorking(root, file));
    if (why) failures++;
    console.log(`${why ? 'FAIL' : 'ok  '} ${file}${why ? `: ${why}` : ''}`);
  }
  console.log(failures
    ? `${failures} of ${files.length + untracked.length} changed files are not prose comments only`
    : `all ${files.length} changed files are prose comments only`);
  process.exitCode = failures ? 1 : 0;
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { verdict, comments, nonProse, strippedEmit };
