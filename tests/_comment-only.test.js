// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verdict, comments, nonProse } = require('./_comment-only.js');

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

test('removing prose comments, banners and history notes is prose comments only', () => {
  const after = BEFORE
    .replace('// ─── Projectiles ───\n', '')
    .replace(' * Moves a projectile. Called every frame.\n', '')
    .replace('  // UNCHAINED #39: was a fixed step\n', '')
    .replace(' // trailing note', '')
    .replace(' /* inline */', '');
  assert.equal(verdict('src/a.js', BEFORE, after), null);
});

test('a code change is not prose comments only', () => {
  assert.equal(verdict('src/a.js', BEFORE, BEFORE.replace('dt > 0', 'dt >= 0')),
    'code changed: comment-stripped emit differs');
});

test('a JSDoc type tag change is not prose comments only', () => {
  assert.match(String(verdict('src/a.js', BEFORE, BEFORE.replace('@returns {boolean}', '@returns {any}'))),
    /^directive or JSDoc type tag changed: "@returns \{boolean\}" -> "@returns \{any\}"$/);
  assert.match(String(verdict('src/a.js', BEFORE, BEFORE.replace(' * @param {number} dt seconds since the last frame\n', ''))),
    /^directive or JSDoc type tag changed/);
});

test('removing or adding a directive is not prose comments only', () => {
  assert.match(String(verdict('src/a.js', BEFORE, BEFORE.replace('// @ts-check\n', ''))), /^directive or JSDoc type tag changed/);
  assert.match(String(verdict('src/a.js', BEFORE, BEFORE.replace("'use strict';", "'use strict';\n// eslint-disable-next-line no-var"))),
    /^directive or JSDoc type tag changed/);
});

test('declaration files, other file types, new and deleted files are never prose comments only', () => {
  assert.equal(verdict('types/engine.d.ts', 'declare const a: number;', 'declare const a: string;'), 'not a JavaScript file');
  assert.equal(verdict('docs/spec.md', 'a', 'b'), 'not a JavaScript file');
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
  assert.deepEqual(nonProse(BEFORE), ['// @ts-check', '@param {number} dt seconds since the last frame', '@returns {boolean}']);
});

test('removing a triple-slash reference directive is not prose comments only', () => {
  const code = '/// <reference types="node" />\nconst a = 1;\n';
  assert.match(String(verdict('src/a.js', code, 'const a = 1;\n')), /^directive or JSDoc type tag changed/);
});

test('a trailing directive on the same line as code counts as a directive', () => {
  const code = "const a = eval('1'); // eslint-disable-line no-eval\n";
  assert.match(String(verdict('src/a.js', code, "const a = eval('1');\n")), /^directive or JSDoc type tag changed/);
});
