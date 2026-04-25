'use strict';
// tests/engine-purity.test.js — meta-test: scripts/check-engine-purity.js
// must exit 0 on the current engine/ tree. Catches accidental NEON-noun
// drift in PRs without requiring reviewers to remember the gate exists.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'check-engine-purity.js');

test('scripts/check-engine-purity.js exits 0 on the current engine/ tree', () => {
  let exit = 0;
  let out = '';
  try {
    out = execFileSync('node', [SCRIPT], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    exit = (e && typeof e.status === 'number') ? e.status : 1;
    out = (e && e.stdout) ? String(e.stdout) : '';
    out += (e && e.stderr) ? '\n' + String(e.stderr) : '';
  }
  assert.equal(exit, 0, 'engine purity check failed:\n' + out);
  assert.match(out, /engine purity: ok/);
});
