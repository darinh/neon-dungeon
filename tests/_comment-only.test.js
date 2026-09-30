// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verdict, comments } = require('./_comment-only.js');

const BEFORE = `// @ts-check
'use strict';

// ─── Projectiles ───
/**
 * Moves a projectile. Called every frame.
 * @param {number} dt seconds since the last frame
 * @returns {boolean}
 */
function step(dt) {
  // UNCHAINED #39: was a fixed step
  const re = /\\/\\/ not a comment/; // trailing note
  const s = \`// not a comment either \${dt}\`;
  return dt > 0 && re.test(s); /* inline */
}
`;

/** @param {string} before @param {string} after */
const check = (before, after) => verdict('src/a.js', before, after);

test('removing prose comments, banners and history notes is prose comments only', () => {
  const after = BEFORE
    .replace('// ─── Projectiles ───\n', '')
    .replace(' * Moves a projectile. Called every frame.\n', '')
    .replace('  // UNCHAINED #39: was a fixed step\n', '')
    .replace(' // trailing note', '')
    .replace(' /* inline */', '');
  assert.equal(check(BEFORE, after), null);
});

test('rewording a JSDoc description is prose comments only', () => {
  assert.equal(check(BEFORE, BEFORE.replace('seconds since the last frame', 'elapsed time in seconds')), null);
});

test('a code change is not prose comments only', () => {
  assert.equal(check(BEFORE, BEFORE.replace('dt > 0', 'dt >= 0')), 'code changed: comment-stripped emit differs');
});

test('a code change that emits identically is not prose comments only', () => {
  assert.match(String(check('let a = 1;\nlet b = 2;\n', 'let a = 1\nlet b = 2\n')), /^code changed: token 4 /);
  assert.match(String(check('a();\nb();\n', 'a(); b();\n')), /^code line structure changed: token 4 \(line 1\)/);
});

test('changing or removing a JSDoc type tag is not prose comments only', () => {
  assert.match(String(check(BEFORE, BEFORE.replace('@returns {boolean}', '@returns {any}'))), /^JSDoc tag changed or moved: .*BooleanKeyword.* -> .*AnyKeyword/);
  assert.match(String(check(BEFORE, BEFORE.replace(' * @param {number} dt seconds since the last frame\n', ''))), /^JSDoc tag changed or moved/);
});

test('a type is compared in full, across lines and asterisks', () => {
  /** @param {string} t */
  const typedef = (t) => `/**\n * @typedef {{\n *   a: ${t}\n * }} Foo\n */\n/** @param {Array<*> | ${t}} x */\nfunction f(x) { return x; }\n`;
  assert.match(String(check(typedef('string'), typedef('number'))), /^JSDoc tag changed or moved: .*StringKeyword.* -> .*NumberKeyword/);
  /** @param {string} name */
  const param = (name) => `/** @param {Array<*>} ${name} */\nfunction f(items) { return items; }\n`;
  assert.match(String(check(param('items'), param('other'))), /^JSDoc tag changed or moved: .*Identifier\\"items\\".* -> .*Identifier\\"other\\"/);
});

test('removing a tag TypeScript enforces is not prose comments only', () => {
  for (const tag of ['@readonly', '@private', '@protected', '@override', '@constructor', '@class', '@deprecated']) {
    const code = `class A {\n  /** ${tag} */\n  x = 1;\n}\n`;
    assert.match(String(check(code, code.replace(`/** ${tag} */`, '/** Prose. */'))), /^JSDoc tag changed or moved/, tag);
  }
});

test('removing a documentation-only tag is prose comments only', () => {
  const code = '/**\n * Adds.\n * @example add(1)\n * @see sum\n * @param {number} a\n */\nfunction add(a) { return a + 1; }\n';
  assert.equal(check(code, code.replace(' * @example add(1)\n * @see sum\n', '')), null);
});

test('moving a type cast to another expression is not prose comments only', () => {
  const before = 'const x = /** @type {any} */ (1);\nconst y = (2);\n';
  const after = 'const x = (1);\nconst y = /** @type {any} */ (2);\n';
  assert.match(String(check(before, after)), /^JSDoc tag changed or moved: .*on token 3.* -> .*on token 10/);
});

test('moving a directive to another line is not prose comments only', () => {
  const before = '// @ts-expect-error\nundeclaredA();\nundeclaredB();\n';
  const after = 'undeclaredA();\n// @ts-expect-error\nundeclaredB();\n';
  assert.match(String(check(before, after)), /^directive changed or moved/);
  const lint = '// eslint-disable-next-line no-var\nvar a = 1;\nvar b = 2;\n';
  assert.match(String(check(lint, 'var a = 1;\n// eslint-disable-next-line no-var\nvar b = 2;\n')), /^directive changed or moved/);
});

test('removing a prose line between a next-line directive and its code is not prose comments only', () => {
  const before = '// eslint-disable-next-line no-var\n// why\nvar a = 1;\n';
  assert.match(String(check(before, before.replace('// why\n', ''))), /^directive changed or moved: .*applies to no code.* -> .*applies to tokens 0-4/);
});

test('removing or adding a directive is not prose comments only', () => {
  assert.match(String(check(BEFORE, BEFORE.replace('// @ts-check\n', ''))), /^directive changed or moved/);
  assert.match(String(check(BEFORE, BEFORE.replace("'use strict';", "'use strict';\n// eslint-disable-next-line no-var"))),
    /^directive changed or moved/);
  assert.match(String(check('var foo = 1;\n', '/* exported foo */\nvar foo = 1;\n')), /^directive changed or moved/);
  assert.match(String(check('/* global a */\na();\n', '/* global b */\na();\n')), /^directive changed or moved/);
});

test('a line comment that starts with "global" is prose, as it is for ESLint', () => {
  assert.equal(check('// global helpers for old saves\nvar a = 1;\n', 'var a = 1;\n'), null);
});

test('prose that mentions eslint or @ts- is not a directive', () => {
  const before = 'const value = 1;\n// eslint evaluates this file in script mode, and @ts-check covers it.\n';
  assert.equal(check(before, 'const value = 1;\n// The linter evaluates this file in script mode.\n'), null);
});

test('a suppression that mentions @ts-check is still a suppression, not a file pragma', () => {
  const before = '// @ts-check\n// @ts-ignore needed because @ts-check reports this\nundeclaredName();\n';
  const after = before.replace('undeclaredName', '/* Explain why this call is safe. */\nundeclaredName');
  assert.match(String(check(before, after)), /^directive changed or moved: .*suppresses \\"undeclaredName\(\);\\".* -> .*suppresses \\"\/\* Explain/);
});

test('deleting a prose line between a TypeScript suppression and its code is prose comments only', () => {
  const before = '// @ts-check\n// @ts-expect-error legacy global is injected by the page\n// This call is safe after bootstrap.\ninjectedGlobal();\n';
  assert.equal(check(before, before.replace('// This call is safe after bootstrap.\n', '')), null);
});

test('whitespace inside a directive is compared exactly', () => {
  /** @param {string} gap */
  const ref = (gap) => `/// <reference path="./types${gap}one.d.ts" />\nconst a = 1;\n`;
  assert.match(String(check(ref(' '), ref('  '))), /^directive changed or moved/);
});

test('an array typedef is not the same tag as an object typedef', () => {
  /** @param {string} t */
  const typedef = (t) => `/**\n * @typedef {${t}} Foo\n * @property {number} x\n */\n/** @type {Foo} */\nconst value = { x: 1 };\n`;
  assert.match(String(check(typedef('Object'), typedef('Object[]'))), /^JSDoc tag changed or moved: .*isArrayType=true/);
});

test('a file pragma may lose the prose under it, but not leave the file header', () => {
  const before = "// @ts-check\n// Why this module exists.\n'use strict';\n";
  assert.equal(check(before, "// @ts-check\n'use strict';\n"), null);
  assert.match(String(check(before, "'use strict';\n// @ts-check\n")), /^directive changed or moved: .*in the file header/);
});

test('changing the line a TypeScript suppression applies to is not prose comments only', () => {
  const before = '// @ts-check\n// @ts-expect-error SaveV0 was removed with the old loader\n/** @type {SaveV0} */\nlet legacy = null;\n';
  const expanded = before.replace('/** @type {SaveV0} */\n', '/**\n * Old-format save, kept so legacy slots still load.\n * @type {SaveV0}\n */\n');
  assert.match(String(check(before, expanded)), /^directive changed or moved: .*suppresses/);
  const inserted = before.replace('/** @type', '/* Kept so legacy slots still load. */\n/** @type');
  assert.match(String(check(before, inserted)), /^directive changed or moved: .*suppresses/);
});

test('a block suppression is read from its last line, as TypeScript reads it', () => {
  const directive = '// @ts-check\n/* The page injects this global before any script runs, so the\n   compiler cannot see it.\n   @ts-expect-error */\ninjectedGlobal();\n';
  const reflowed = '// @ts-check\n/* The page injects this global before any script runs, so the compiler\n   cannot see it. @ts-expect-error */\ninjectedGlobal();\n';
  assert.match(String(check(directive, reflowed)), /^directive changed or moved/);
  const prose = '// @ts-check\nconst z = 0;\n/* @ts-ignore was dropped here once the loader got types;\n   keep it that way. */\nconst a = 1;\n';
  assert.equal(check(prose, '// @ts-check\nconst z = 0;\nconst a = 1;\n'), null);
});

test('a suppression TypeScript honors without a word boundary is a directive', () => {
  const before = '// @ts-check\n// @ts-ignores here predate the typed loader.\nundeclaredName();\n';
  assert.match(String(check(before, before.replace('// @ts-ignores here predate the typed loader.\n', ''))), /^directive changed or moved/);
});

test('TypeScript line breaks such as U+2028 end the lines a suppression skips', () => {
  const before = '// @ts-check\n// @ts-ignore\n// note\u2028undeclaredName();\n';
  assert.match(String(check(before, before.replace('// note', '/* note */'))), /^directive changed or moved/);
});

test('removing a JSDoc block after a tagged one is not prose comments only', () => {
  const before = '// @ts-check\n/** @type {string} */\n/** Lives left in this run. */\nlet lives = 3;\n';
  assert.match(String(check(before, before.replace('/** Lives left in this run. */\n', ''))), /^JSDoc tag changed or moved: .*not in the last JSDoc block/);
  assert.match(String(check(before, before.replace('/** Lives left in this run. */', '// Lives left in this run.'))), /^JSDoc tag changed or moved/);
  const leading = '// @ts-check\n/** Lives left in this run. */\n/** @type {number} */\nlet lives = 3;\n';
  assert.equal(check(leading, leading.replace('/** Lives left in this run. */\n', '')), null);
});

test('ESLint directives keep only the position ESLint uses', () => {
  const nextLine = 'const a = 1;\n// Build a function we can call.\n// eslint-disable-next-line no-new-func\nconst f = new Function(\'return 1\');\n';
  assert.equal(check(nextLine, nextLine.replace('// Build a function we can call.\n', '')), null);
  const global = '/* global NEON */\n// Uses the page global.\nNEON.go();\n';
  assert.equal(check(global, global.replace('// Uses the page global.\n', '')), null);
  const disable = 'const a = 1;\n/* eslint-disable no-var */\n// Old style kept for the loader.\nvar b = 2;\n';
  assert.equal(check(disable, disable.replace('// Old style kept for the loader.\n', '')), null);
  const reference = '/// <reference types="node" />\n// Node-only helper.\nconst a = 1;\n';
  assert.equal(check(reference, reference.replace('// Node-only helper.\n', '')), null);
});

test('removing a triple-slash reference directive is not prose comments only', () => {
  const code = '/// <reference types="node" />\nconst a = 1;\n';
  assert.match(String(check(code, 'const a = 1;\n')), /^directive changed or moved/);
});

test('a trailing directive on the same line as code counts as a directive', () => {
  const code = "const a = eval('1'); // eslint-disable-line no-eval\n";
  assert.match(String(check(code, "const a = eval('1');\n")), /^directive changed or moved/);
});

test('only .js files that exist on both sides can be prose comments only', () => {
  assert.equal(verdict('types/engine.d.ts', 'declare const a: number;', 'declare const a: string;'), 'not a .js file');
  assert.equal(verdict('docs/spec.md', 'a', 'b'), 'not a .js file');
  assert.equal(verdict('src/a.cjs', 'const a = 1; // old\n', 'const a = 1; // new\n'), 'not a .js file');
  assert.equal(verdict('src/a.mjs', 'const a = 1; // old\n', 'const a = 1;\n'), 'not a .js file');
  assert.equal(verdict('src/new.js', null, 'const a = 1;'), 'new file');
  assert.equal(verdict('src/old.js', 'const a = 1;', null), 'deleted file');
});

test('comments are found by the parser, not by text that only looks like a comment', () => {
  assert.deepEqual(comments(BEFORE), [
    '// @ts-check',
    '// ─── Projectiles ───',
    '/**\n * Moves a projectile. Called every frame.\n * @param {number} dt seconds since the last frame\n * @returns {boolean}\n */',
    '// UNCHAINED #39: was a fixed step',
    '// trailing note',
    '/* inline */',
  ]);
});
