// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const { requireNEON } = require(path.join(ROOT, 'src/neon.js'));

/** @param {string} file */
function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

/**
 * @param {any} neon
 * @param {() => void} fn
 */
function withNEON(neon, fn) {
  const root = /** @type {any} */ (globalThis);
  const previous = root.NEON;
  try {
    if (neon === undefined) delete root.NEON;
    else root.NEON = neon;
    fn();
  } finally {
    if (previous === undefined) delete root.NEON;
    else root.NEON = previous;
  }
}

/** @type {Array<[string, string]>} */
const convertedDependencies = [
  ['dungeonTopology', 'src/content.js'],
  ['dungeonReachability', 'src/content.js'],
  ['save', 'src/content/meta-save.js'],
  ['particles', 'src/content/effects.js'],
  ['viewport', 'src/platform.js'],
  ['input', 'src/platform.js'],
  ['touch', 'src/platform.js'],
  ['audio', 'src/platform.js'],
  ['cinematic', 'src/meta/intro.js'],
  ['decor', 'src/render.js'],
];

test('requireNEON returns present dependencies', () => {
  const dependency = { ok: true };
  withNEON({ viewport: dependency }, () => {
    assert.equal(requireNEON('viewport', 'src/platform.js'), dependency);
  });
});

test('requireNEON throws named load-order errors for converted captures', () => {
  for (const [name, requiringFile] of convertedDependencies) {
    withNEON({}, () => {
      assert.throws(
        () => requireNEON(name, requiringFile),
        (err) => err instanceof Error &&
          err.message.includes(name) &&
          err.message.includes(requiringFile)
      );
    });
  }
});

test('converted module-top captures call requireNEON with file ownership', () => {
  /** @type {Record<string, string>} */
  const sources = {
    'src/content.js': read('src/content.js'),
    'src/content/meta-save.js': read('src/content/meta-save.js'),
    'src/content/effects.js': read('src/content/effects.js'),
    'src/platform.js': read('src/platform.js'),
    'src/meta/intro.js': read('src/meta/intro.js'),
    'src/render.js': read('src/render.js'),
  };
  for (const [name, requiringFile] of convertedDependencies) {
    const source = sources[requiringFile];
    assert.ok(source !== undefined, requiringFile + ' source must be loaded');
    assert.match(
      source,
      new RegExp("requireNEON\\('" + name + "', '" + requiringFile.replace(/\//g, '\\/') + "'\\)"),
      requiringFile + ' must name its ' + name + ' dependency'
    );
  }
});

test('src modules do not keep module-top const NEON captures', () => {
  const srcFiles = [
    'src/content.js',
    'src/entities.js',
    'src/game.js',
    'src/meta/hub.js',
    'src/meta/intro.js',
    'src/platform.js',
    'src/render.js',
    ...fs.readdirSync(path.join(ROOT, 'src/data')).map((file) => 'src/data/' + file),
    ...fs.readdirSync(path.join(ROOT, 'src/meta')).map((file) => 'src/meta/' + file),
  ].filter((file, index, all) => file.endsWith('.js') && all.indexOf(file) === index);

  for (const file of srcFiles) {
    const withoutComments = read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(
      withoutComments,
      /^const\s+[_A-Za-z]\w*\s*=.*(?:\bNEON\.|\(NEON\)\.)/m,
      file + ' must use requireNEON for module-top NEON captures'
    );
  }
});
