'use strict';
// @ts-check

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  CORE_RUNTIME_SOURCE_KEYS,
  SOURCE_FILE_PATHS,
  blankStringContents,
  readSourceFile,
  readSourceFiles,
  resolveSourceFile,
  stripJsComments,
} = require('./_source-files.js');

test('source file facade records the script-tag runtime source tail', () => {
  assert.deepEqual(CORE_RUNTIME_SOURCE_KEYS, ['content', 'entities', 'render', 'game']);
  assert.equal(SOURCE_FILE_PATHS.contentTerminals.replaceAll('\\', '/'), 'src/content/terminals.js');
  assert.equal(SOURCE_FILE_PATHS.contentWeapons.replaceAll('\\', '/'), 'src/content/weapons.js');
  assert.equal(SOURCE_FILE_PATHS.contentUpgrades.replaceAll('\\', '/'), 'src/content/upgrades.js');
  assert.equal(SOURCE_FILE_PATHS.content.replaceAll('\\', '/'), 'src/content.js');
  assert.equal(SOURCE_FILE_PATHS.entities.replaceAll('\\', '/'), 'src/entities.js');
  assert.equal(SOURCE_FILE_PATHS.render.replaceAll('\\', '/'), 'src/render.js');
  assert.equal(SOURCE_FILE_PATHS.game.replaceAll('\\', '/'), 'src/game.js');
});

test('source file facade resolves and loads core runtime sources', () => {
  assert.equal(resolveSourceFile(__dirname, 'content').endsWith('src/content.js'), true);
  assert.equal(resolveSourceFile(__dirname, 'contentTerminals').endsWith('src/content/terminals.js'), true);
  assert.equal(resolveSourceFile(__dirname, 'contentWeapons').endsWith('src/content/weapons.js'), true);
  assert.equal(resolveSourceFile(__dirname, 'contentUpgrades').endsWith('src/content/upgrades.js'), true);
  const sources = readSourceFiles(__dirname);
  const terminalSource = readSourceFile(__dirname, 'contentTerminals');
  const weaponSource = readSourceFile(__dirname, 'contentWeapons');
  const upgradeSource = readSourceFile(__dirname, 'contentUpgrades');
  assert.match(terminalSource, /const\s+LORE_ENTRIES\s*=\s*\[/);
  assert.match(weaponSource, /const\s+WEAPON_AFFIXES\s*=\s*\{/);
  assert.match(upgradeSource, /const\s+UPGRADES\s*=\s*\[/);
  assert.match(upgradeSource, /const\s+AUGMENTS\s*=\s*\{/);
  assert.match(sources.content, /function\s+generateFloor\s*\(/);
  assert.match(sources.entities, /class\s+Player\b/);
  assert.match(sources.render, /function\s+drawWorld\s*\(/);
  assert.match(sources.game, /const\s+game\s*=/);
});

test('source file facade rejects unknown keys loudly', () => {
  assert.throws(
    // @ts-expect-error exercising runtime validation.
    () => readSourceFile(__dirname, 'contents'),
    /Unknown source file key: contents/
  );
});

test('stripJsComments preserves comment-like text in strings and regex literals', () => {
  const source = [
    "const url = 'https://example.test/path'; // remove line comment",
    'const re = /\\/\\/ not a comment/;',
    'function f(x) { return /[/*]/.test(x); }',
    'function g(ok, x) { if (ok) /[/*]/.test(x); return 1; }',
    '/* remove block comment',
    '   but preserve its newline */',
    'const done = true;',
  ].join('\n');

  const stripped = stripJsComments(source);
  assert.match(stripped, /https:\/\/example\.test\/path/);
  assert.match(stripped, /\/\\\/\\\/ not a comment\//);
  assert.match(stripped, /return \/\[\/\*\]\/\.test\(x\);/);
  assert.match(stripped, /if \(ok\) \/\[\/\*\]\/\.test\(x\);/);
  assert.doesNotMatch(stripped, /remove line comment/);
  assert.doesNotMatch(stripped, /remove block comment/);
  assert.match(stripped, /const done = true;/);
});

test('blankStringContents preserves string length and quote delimiters', () => {
  const src = "const value = 'a { tricky } string';";
  const blanked = blankStringContents(src);
  assert.equal(blanked.length, src.length);
  assert.match(blanked, /'                   '/);
  assert.doesNotMatch(blanked, /tricky/);
});
