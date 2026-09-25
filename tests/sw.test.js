// @ts-check
'use strict';

// Service-worker contract checks that are specific to sw.js itself (the
// manifest/index/sw drift checks live in tests/manifest.test.js).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SW = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

test('sw.js precaches the evaluation trials module', () => {
  assert.match(SW, /'\.\/src\/content\/trials\.js',/);
});

test('sw.js carries no numeric app/cache version (release tag is the only version)', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
});
