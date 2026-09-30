// @ts-check
'use strict';

// Proves a change is prose comments only, as AGENTS.md "Code review policy"
// defines it. Every changed file must be a .js file whose code is untouched
// (comment-stripped emit, code tokens, and which tokens share a line) and whose
// directives and JSDoc tags keep their content and the code they apply to,
// following TypeScript's and ESLint's own rules. Only comment prose and JSDoc
// description text may differ. It cannot see lint rules that read comment text
// (npm run lint still runs them), tests that read source text (npm test still
// runs them), or code that reads its own source through Function.prototype.toString
// (none in src/, engine/ or sw.js).
// Usage, from anywhere inside the repository to check:
//   node tests/_comment-only.js [base-ref]   (default origin/develop)

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');

// TypeScript's comment-directive patterns (typescript.js scanner): a // comment
// is tested whole, a block comment by its last line, both after trimStart.
const TS_SUPPRESS_LINE = /^\/\/\/?\s*@(ts-expect-error|ts-ignore)/;
const TS_SUPPRESS_BLOCK = /^(?:\/|\*)*\s*@(ts-expect-error|ts-ignore)/;
// ESLint's directive grammar, tested on the comment's text without its markers;
// line comments only honor the -line forms.
const ESLINT_LINE = /^\s*(eslint-disable-(?:next-)?line)(?:\s|$)/;
const ESLINT_BLOCK = /^\s*(eslint(?:-env|-enable|-disable(?:-(?:next-)?line)?)?|exported|globals?)(?:\s|$)/;
const TRIPLE_SLASH = /^\/\/\/\s*<(reference|amd-)/;
// TypeScript's single-line pragma pattern (parser.ts); only // comments before the first token count.
const TS_PRAGMA = /^\/\/\/?\s*@([^\s:]+)((?:[^\S\r\n]|:).*)?$/m;
// ESLint ignores the justification after " -- " when it applies a directive.
const ESLINT_JUSTIFICATION = /\s-{2,}\s/;
// The binder reads these from every JSDoc block on a node, not only the last one.
const BINDER_WIDE_TAGS = new Set(['typedef', 'callback', 'enum', 'import', 'overload']);
const LINE_BREAK = /\r\n|[\r\n\u2028\u2029]/g;
// Tags TypeScript and ESLint ignore; every other JSDoc tag can change typecheck results.
const DOC_ONLY_TAGS = new Set(['example', 'see', 'since', 'author', 'todo', 'remarks', 'note', 'summary',
  'description', 'desc', 'file', 'fileoverview', 'overview', 'license', 'copyright', 'version',
  'inheritdoc', 'default', 'defaultvalue', 'throws', 'exception', 'fires', 'emits', 'listens', 'event']);
const DESCRIPTION_KINDS = new Set([ts.SyntaxKind.JSDocText, ts.SyntaxKind.JSDocLink,
  ts.SyntaxKind.JSDocLinkCode, ts.SyntaxKind.JSDocLinkPlain]);

/** @param {string} code */
function strippedEmit(code) {
  return ts.transpileModule(code, { compilerOptions: { removeComments: true, target: ts.ScriptTarget.ESNext } }).outputText;
}

/** @param {string} code */
function parse(code) {
  return ts.createSourceFile('file.js', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
}

/**
 * Every comment range in source order, found through the parser so regexes and
 * template literals are never mistaken for comments.
 * @param {import('typescript').SourceFile} sf
 * @returns {import('typescript').CommentRange[]}
 */
function commentRanges(sf) {
  const code = sf.text;
  /** @type {Map<number, import('typescript').CommentRange>} */
  const seen = new Map();
  /** @param {import('typescript').CommentRange[] | undefined} ranges */
  const add = (ranges) => {
    for (const r of ranges || []) seen.set(r.pos, r);
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
  return [...seen.values()].sort((a, b) => a.pos - b.pos);
}

/** @param {string} code @returns {string[]} */
function comments(code) {
  return commentRanges(parse(code)).map((r) => code.slice(r.pos, r.end));
}

/**
 * Code tokens in order, skipping JSDoc, which getChildren reports as children.
 * @param {import('typescript').SourceFile} sf
 */
function codeTokens(sf) {
  /** @type {{ kind: number, pos: number, end: number }[]} */
  const out = [];
  /** @param {import('typescript').Node} node */
  const visit = (node) => {
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode) return;
    const kids = node.getChildren(sf);
    if (kids.length) {
      for (const kid of kids) visit(kid);
    } else if (node.kind !== ts.SyntaxKind.EndOfFileToken) {
      const pos = node.getStart(sf);
      if (node.end > pos) out.push({ kind: node.kind, pos, end: node.end });
    }
  };
  visit(sf);
  return out;
}

/**
 * A JSDoc tag's structure: tag name, types, names and flags, without description text.
 * @param {import('typescript').Node} node
 * @returns {string}
 */
function tagShape(node) {
  /** @type {string[]} */
  const parts = [];
  /** @param {import('typescript').Node} child */
  const add = (child) => {
    if (!DESCRIPTION_KINDS.has(child.kind)) parts.push(tagShape(child));
  };
  ts.forEachChild(node, add, (children) => {
    children.forEach(add);
  });
  const n = /** @type {any} */ (node);
  const text = typeof n.text === 'string' ? JSON.stringify(n.text) : '';
  const flags = ['isBracketed', 'isNameFirst', 'isArrayType', 'postfix', 'operator', 'isTypeOf']
    .filter((f) => n[f] !== undefined && n[f] !== false).map((f) => `${f}=${n[f]}`).join(',');
  return `${ts.SyntaxKind[node.kind]}${text}${flags ? `[${flags}]` : ''}${parts.length ? `(${parts.join(' ')})` : ''}`;
}

/**
 * Everything in a file that is not comment prose: code tokens, which of them
 * start a new line, and each directive and JSDoc tag with where it sits.
 * @param {string} code
 */
function shape(code) {
  const sf = parse(code);
  /** @param {number} pos */
  const line = (pos) => sf.getLineAndCharacterOfPosition(pos).line;
  const toks = codeTokens(sf);
  /** @param {number} pos Index of the first token starting at or after pos. */
  const tokenAt = (pos) => {
    let lo = 0;
    let hi = toks.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((toks[mid]?.pos ?? pos) < pos) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const tokens = toks.map((t) => `${ts.SyntaxKind[t.kind]} ${code.slice(t.pos, t.end)}`);
  const breaks = toks.map((t, i) => {
    const before = toks[i - 1];
    return before && line(t.pos) !== line(before.end) ? 'new line' : 'same line';
  });
  /** @type {string[]} */
  const directives = [];
  const lineStarts = sf.getLineStarts();
  /** @param {number} n Line n without its line break. */
  const lineText = (n) => code.slice(lineStarts[n] ?? code.length, lineStarts[n + 1] ?? code.length).replace(/(\r\n|[\r\n\u2028\u2029])$/, '');
  /** @param {number} n */
  const tokensOn = (n) => {
    const on = toks.flatMap((t, i) => (line(t.pos) === n ? [i] : []));
    return on.length ? `tokens ${on[0]}-${on[on.length - 1]}` : 'no code';
  };
  /** @type {Map<number, string[]>} JSDoc tags by the line they start on. */
  const tagLines = new Map();
  /** @param {import('typescript').Node} node */
  const collectTags = (node) => {
    for (const doc of /** @type {any} */ (node).jsDoc || []) {
      for (const tag of doc.tags || []) {
        const at = line(tag.getStart(sf));
        tagLines.set(at, [...(tagLines.get(at) ?? []), String(tag.tagName.text)]);
      }
    }
    ts.forEachChild(node, collectTags);
  };
  collectTags(sf);
  const headerEnd = toks[0]?.pos ?? code.length;
  for (const r of commentRanges(sf)) {
    const raw = code.slice(r.pos, r.end);
    const text = JSON.stringify(raw);
    const isLine = r.kind === ts.SyntaxKind.SingleLineCommentTrivia;
    const value = isLine ? raw.slice(2) : raw.slice(2, -2);
    const endLine = line(r.end);
    const prev = tokenAt(r.end) - 1;
    const pragma = isLine && r.end <= headerEnd ? TS_PRAGMA.exec(raw) : null;
    if (pragma && /^ts-(no)?check$/i.test(pragma[1] ?? '')) directives.push(`${text} in the file header`);
    const lastLine = isLine ? raw : raw.split(LINE_BREAK).pop() ?? '';
    if ((isLine ? TS_SUPPRESS_LINE : TS_SUPPRESS_BLOCK).test(lastLine.trimStart())) {
      // TypeScript skips blank and // lines, then suppresses diagnostics that start on the next
      // line: on its code tokens or in JSDoc tags there.
      let target = endLine + 1;
      while (target < lineStarts.length && /^(|\/\/.*)$/.test(lineText(target).trim())) target++;
      const reach = target < lineStarts.length ? `${tokensOn(target)} and JSDoc ${JSON.stringify(tagLines.get(target) ?? [])}` : 'nothing';
      directives.push(`${JSON.stringify(lastLine.trimStart())} suppresses ${reach}`);
      continue;
    }
    const eslint = (isLine ? ESLINT_LINE : ESLINT_BLOCK).exec(value);
    if (eslint) {
      const kind = eslint[1];
      const directive = JSON.stringify(value.split(ESLINT_JUSTIFICATION)[0]?.trim() ?? '');
      if (kind === 'eslint-disable-line') directives.push(`${directive} applies to ${tokensOn(line(r.pos))}`);
      else if (kind === 'eslint-disable-next-line') directives.push(`${directive} applies to ${tokensOn(endLine + 1)}`);
      else if (kind === 'eslint-disable' || kind === 'eslint-enable') directives.push(`${directive} after token ${prev}`);
      else directives.push(directive);
    } else if (isLine && TRIPLE_SLASH.test(raw)) {
      directives.push(`${text} ${r.end <= headerEnd ? 'in' : 'outside'} the file header`);
    }
  }
  /** @type {string[]} */
  const tags = [];
  /** @param {import('typescript').Node} node */
  const visitDocs = (node) => {
    /** @type {any[]} */
    const docs = /** @type {any} */ (node).jsDoc || [];
    docs.forEach((doc, i) => {
      for (const tag of doc.tags || []) {
        if (DOC_ONLY_TAGS.has(String(tag.tagName.text).toLowerCase())) continue;
        // TypeScript takes a node's tags from its last JSDoc block (and @overload from any).
        const binderWide = BINDER_WIDE_TAGS.has(String(tag.tagName.text).toLowerCase());
        const last = i === docs.length - 1 || binderWide ? '' : ', not in the last JSDoc block';
        tags.push(`${tagShape(tag)} on token ${tokenAt(node.getStart(sf))}${last}`);
      }
    });
    ts.forEachChild(node, visitDocs);
  };
  visitDocs(sf);
  return { tokens, breaks, directives, tags, lines: toks.map((t) => line(t.pos) + 1) };
}

/** @param {string[]} a @param {string[]} b Index of the first difference, or -1. */
function firstDifference(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i < a.length || i < b.length ? i : -1;
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
  if (!file.endsWith('.js') || file.endsWith('.d.js')) return 'not a .js file';
  if (before === null) return 'new file';
  if (after === null) return 'deleted file';
  if (strippedEmit(before) !== strippedEmit(after)) return 'code changed: comment-stripped emit differs';
  const a = shape(before);
  const b = shape(after);
  /** @param {string[]} x @param {number} i */
  const at = (x, i) => JSON.stringify(x[i] ?? null);
  let i = firstDifference(a.tokens, b.tokens);
  if (i >= 0) return `code changed: token ${i} (line ${b.lines[i] ?? 'end'}) ${at(a.tokens, i)} -> ${at(b.tokens, i)}`;
  i = firstDifference(a.breaks, b.breaks);
  if (i >= 0) return `code line structure changed: token ${i} (line ${b.lines[i]}) ${at(a.tokens, i)} was on a ${a.breaks[i]}, now on a ${b.breaks[i]}`;
  i = firstDifference(a.directives, b.directives);
  if (i >= 0) return `directive changed or moved: ${at(a.directives, i)} -> ${at(b.directives, i)}`;
  i = firstDifference(a.tags, b.tags);
  if (i >= 0) return `JSDoc tag changed or moved: ${at(a.tags, i)} -> ${at(b.tags, i)}`;
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
  const files = git('diff', '--name-only', '--no-renames', base, '--').split('\n').filter(Boolean);
  const untracked = git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean);
  const all = [...files, ...untracked];
  if (!all.length) {
    console.log(`no files changed since ${base}`);
    process.exitCode = 1;
    return;
  }
  let failures = 0;
  for (const file of all) {
    const why = verdict(file, show(base, file), readWorking(root, file));
    if (why) failures++;
    console.log(`${why ? 'FAIL' : 'ok  '} ${file}${why ? `: ${why}` : ''}`);
  }
  console.log(failures
    ? `${failures} of ${all.length} changed files are not prose comments only`
    : `all ${all.length} changed files are prose comments only`);
  process.exitCode = failures ? 1 : 0;
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { verdict, comments, shape, strippedEmit };
