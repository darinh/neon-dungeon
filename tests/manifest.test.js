'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const manifest = require(path.resolve(__dirname, '..', 'scripts', 'manifest.js'));

const ROOT = path.resolve(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

function readIndexScripts() {
  return [...INDEX.matchAll(/<script\s+src="([^"]+)"><\/script>/g)].map((match) => match[1]);
}

function readServiceWorkerAssets() {
  const assetsMatch = SW.match(/const\s+ASSETS\s*=\s*\[([\s\S]*?)\];/);
  assert.notEqual(assetsMatch, null, 'sw.js must declare const ASSETS = [...]');
  return [...assetsMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

function countValues(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return counts;
}

function compareOrderedList(expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = expected.filter((item) => !actualSet.has(item));
  const extra = actual.filter((item) => !expectedSet.has(item));
  const outOfOrder = [];
  const max = Math.max(expected.length, actual.length);
  for (let i = 0; i < max; i++) {
    if (expected[i] !== actual[i]) {
      outOfOrder.push({
        index: i,
        expected: expected[i] || '<none>',
        actual: actual[i] || '<none>',
      });
    }
  }
  return { missing, extra, outOfOrder };
}

function formatDrift(name, expected, actual) {
  const drift = compareOrderedList(expected, actual);
  return [
    `${name} drift detected`,
    `missing: ${drift.missing.length ? drift.missing.join(', ') : '<none>'}`,
    `extra: ${drift.extra.length ? drift.extra.join(', ') : '<none>'}`,
    `out-of-order: ${drift.outOfOrder.length ? JSON.stringify(drift.outOfOrder, null, 2) : '<none>'}`,
  ].join('\n');
}

function assertOrderedList(name, expected, actual) {
  assert.deepEqual(actual, expected, formatDrift(name, expected, actual));
}

function resolveManifestPath(manifestPath) {
  assert.match(manifestPath, /^\.\//, `${manifestPath} must be a browser-relative ./ path`);
  return path.join(ROOT, manifestPath.slice(2));
}

test('index.html script tags match manifest order exactly', () => {
  assertOrderedList('index.html script order', manifest.requiredInIndex, readIndexScripts());
});

test('sw.js precache assets match manifest exactly', () => {
  assertOrderedList('sw.js ASSETS', manifest.requiredPrecache, readServiceWorkerAssets());
});

test('every browser script is precached exactly once', () => {
  const counts = countValues(readServiceWorkerAssets());
  const missing = [];
  const duplicated = [];
  for (const script of manifest.requiredInIndex) {
    const count = counts.get(script) || 0;
    if (count === 0) missing.push(script);
    if (count > 1) duplicated.push(`${script} (${count})`);
  }
  assert.equal(
    missing.length + duplicated.length,
    0,
    [
      'browser script precache drift detected',
      `missing: ${missing.length ? missing.join(', ') : '<none>'}`,
      `duplicates: ${duplicated.length ? duplicated.join(', ') : '<none>'}`,
    ].join('\n')
  );
});

test('every manifest-managed precache path exists on disk', () => {
  const missing = manifest.requiredPrecache
    .filter((asset) => asset !== './')
    .filter((asset) => !fs.existsSync(resolveManifestPath(asset)));
  assert.deepEqual(missing, [], `manifest paths missing on disk: ${missing.join(', ') || '<none>'}`);
});

test('generated version metadata is intentionally absent from precache', () => {
  const versionEntry = manifest.noStore.find((entry) => entry.path === './version.json');
  assert.ok(versionEntry, 'manifest must document the version.json precache exemption');
  assert.match(versionEntry.reason, /release-version\.yml/);
  assert.match(versionEntry.reason, /out of sw\.js precache/);
  assert.equal(fs.existsSync(resolveManifestPath(versionEntry.path)), false);
  assert.equal(readServiceWorkerAssets().includes(versionEntry.path), false);
});

test('evaluation trials load after event content and before the floor generator', () => {
  const order = manifest.requiredInIndex;
  const trials = order.indexOf('./src/content/trials.js');
  assert.ok(trials > order.indexOf('./src/content/events.js'), 'trials.js after events.js');
  assert.ok(trials < order.indexOf('./src/content/floor-generator.js'), 'trials.js before floor-generator.js');
  assert.ok(trials < order.indexOf('./src/game.js'), 'trials.js before game.js');
});
