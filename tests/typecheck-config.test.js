// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const RUNTIME_CONFIG = 'tsconfig.runtime.json';
// Node-only globals browser code must not use. require, module and exports are
// CommonJS syntax to TypeScript in .js files, so the runtime pass cannot see them.
const NODE_GLOBALS = ['process', 'Buffer', '__dirname', '__filename', 'global', 'setImmediate', 'clearImmediate'];

/** @param {string} file */
const segments = (file) => path.resolve(file).split(path.sep);

function parseRuntimeConfig() {
  /** @type {import('typescript').Diagnostic[]} */
  const fatal = [];
  const parsed = ts.getParsedCommandLineOfConfigFile(path.join(ROOT, RUNTIME_CONFIG), {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (d) => { fatal.push(d); },
  });
  const errors = [...fatal, ...(parsed ? parsed.errors : [])]
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
  if (!parsed || errors.length) throw new Error(`${RUNTIME_CONFIG}: ${errors.join('; ') || 'did not parse'}`);
  return parsed;
}

/** @param {string} dir @returns {string[]} */
function allFilesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? allFilesUnder(full) : [full];
  });
}

/** @param {string} dir @returns {string[]} */
function jsFilesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return jsFilesUnder(full);
    return e.name.endsWith('.js') ? [full] : [];
  });
}

// The probes are classic scripts sharing one global scope, so their names must differ.
const PROBES = {
  misplaced: "'use strict';\n// @ts-check\nconst probeMisplaced = 1;\nprobeMisplaced.toUpperCase();\n",
  absent: "'use strict';\nconst probeAbsent = 1;\nprobeAbsent.toUpperCase();\n",
  nodeGlobals: `// @ts-check\n${NODE_GLOBALS.map((g) => `void ${g};`).join('\n')}\n`,
  correct: "'use strict';\nconst probeCorrect = 1;\nvoid probeCorrect.toFixed(2);\n",
};

/**
 * The runtime program `npm run typecheck` builds, with in-memory probe files
 * added under src/. Built once: it holds every runtime file.
 */
const runtime = (() => {
  /** @type {any} */
  let cached = null;
  return () => {
    if (cached) return cached;
    const parsed = parseRuntimeConfig();
    /** @type {Record<string, string>} */
    const files = {};
    for (const [name, code] of Object.entries(PROBES)) files[path.join(ROOT, 'src', `typecheck-probe-${name}.js`)] = code;
    const host = ts.createCompilerHost(parsed.options);
    const readFile = host.readFile.bind(host);
    const fileExists = host.fileExists.bind(host);
    host.readFile = (name) => files[path.resolve(name)] ?? readFile(name);
    host.fileExists = (name) => path.resolve(name) in files || fileExists(name);
    const program = ts.createProgram([...parsed.fileNames, ...Object.keys(files)], parsed.options, host);
    /** @param {keyof typeof PROBES} name */
    const diagnostics = (name) => {
      const sf = program.getSourceFile(path.join(ROOT, 'src', `typecheck-probe-${name}.js`));
      if (!sf) throw new Error(`probe ${name} is not in the program`);
      return program.getSemanticDiagnostics(sf).map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    };
    cached = { parsed, program, diagnostics };
    return cached;
  };
})();

test('npm run typecheck runs the runtime pass', () => {
  const script = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts.typecheck;
  // Pinned, not parsed: a shell can redefine or wrap a command in ways no parser here would catch.
  assert.equal(script, `tsc --noEmit && tsc --noEmit -p ${RUNTIME_CONFIG}`,
    'keep the runtime pass when changing the typecheck script, then update this test');
});

test('the runtime program holds every file in src/ and engine/ and no Node type declarations', () => {
  const { parsed, program } = runtime();
  const included = new Set(parsed.fileNames.map((/** @type {string} */ f) => path.resolve(f)));
  const expected = [...jsFilesUnder(path.join(ROOT, 'src')), ...jsFilesUnder(path.join(ROOT, 'engine'))];
  assert.ok(expected.length > 100, `found only ${expected.length} runtime files`);
  // index.html loads classic .js scripts; other script extensions would sit outside the runtime pass.
  const otherScripts = [path.join(ROOT, 'src'), path.join(ROOT, 'engine')]
    .flatMap((dir) => allFilesUnder(dir))
    .filter((f) => /\.(mjs|cjs|jsx|ts|mts|cts|tsx)$/.test(f));
  assert.deepEqual(otherScripts.map((f) => path.relative(ROOT, f)), []);
  assert.deepEqual(expected.filter((f) => !included.has(f)).map((f) => path.relative(ROOT, f)), []);
  const nodeTypes = program.getSourceFiles()
    .map((/** @type {import('typescript').SourceFile} */ sf) => sf.fileName)
    .filter((/** @type {string} */ f) => { const s = segments(f); const i = s.indexOf('node_modules'); return i >= 0 && s[i + 1] === '@types' && s[i + 2] === 'node'; });
  assert.deepEqual(nodeTypes.slice(0, 3), [], 'the runtime program loads @types/node');
});

test('runtime code is type-checked even when its @ts-check comment is missing or misplaced', () => {
  const { diagnostics } = runtime();
  assert.deepEqual(diagnostics('misplaced'), ["Property 'toUpperCase' does not exist on type '1'."]);
  assert.deepEqual(diagnostics('absent'), ["Property 'toUpperCase' does not exist on type '1'."]);
});

test('runtime code cannot use Node globals, because it runs in the browser', () => {
  const messages = runtime().diagnostics('nodeGlobals');
  const unresolved = NODE_GLOBALS.filter((g) => messages.some((/** @type {string} */ m) => m.startsWith(`Cannot find name '${g}'`)));
  assert.deepEqual(unresolved, NODE_GLOBALS);
});

test('runtime code that is correct produces no diagnostics', () => {
  assert.deepEqual(runtime().diagnostics('correct'), []);
});
