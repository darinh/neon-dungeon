'use strict';
// Unit tests for getStatusEffects (src/content/status.js). Verifies that the player
// HUD status badge list correctly reflects timed buffs/debuffs — specifically
// the gaps closed in the status-bar-gaps task:
//   * shock countdown text (was static "SHOCK", now shows seconds remaining)
//   * toxic-pool slow indicator (was invisible, now shows "☣ TOXIC")
//
// content/status.js is browser-only (UMD via <script>, touches canvas globals on
// load), so we extract the function source via regex + node:vm rather than
// require() the file. Same pattern as tests/resonator.test.js.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const CONTENT_STATUS = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'content', 'status.js'), 'utf8');

const fnMatch = CONTENT_STATUS.match(/function\s+getStatusEffects\s*\([\s\S]*?\n\}\n/);
if (!fnMatch) throw new Error('getStatusEffects definition not found in src/content/status.js');

// Sandbox: getStatusEffects references a handful of module-scope helpers
// (_SG, getMod, hackwareEffects, MAX_AUGMENTS, HACKWARE). Stub them so the
// function runs against a bare player object without pulling in the rest of
// content.js. None of the gap tests exercise these branches.
const sandbox = {
  _SG: { modifier: null },
  getMod: () => ({ icon: '?', label: '?', colour: '#fff' }),
  hackwareEffects: [],
  MAX_AUGMENTS: 6,
  HACKWARE: {},
  hasAugment: () => false
};
vm.createContext(sandbox);
vm.runInContext(`${fnMatch[0]}\nthis.getStatusEffects = getStatusEffects;`, sandbox);
const getStatusEffects = sandbox.getStatusEffects;

function makePlayer(overrides) {
  return Object.assign({
    hp: 100, maxHp: 100,
    burnTimer: 0, shockTimer: 0,
    speedTimer: 0, speedBoost: 0,
    cloakTimer: 0, adrenalineTimer: 0,
    dashCooldown: 0, dashTimer: 0,
    hackware: null, hackwareCooldown: 0,
    energyShield: 0, energyShieldTimer: 0,
    secondWindUsed: false,
    reactiveArmorCD: 0,
    disruptionFieldActive: false,
    toxicSlowActive: false,
    perks: {}, upgrades: {}, augments: {}, keys: { red: 0, blue: 0, gold: 0 }
  }, overrides || {});
}

test('shock badge shows countdown text (regression: was static "SHOCK")', () => {
  const fx = getStatusEffects(makePlayer({ shockTimer: 0.4 }));
  const shock = fx.find(e => e.id === 'shocked');
  assert.ok(shock, 'shock badge should be present when shockTimer > 0');
  assert.equal(shock.label, '0.4s');
  assert.equal(shock.icon, '⚡');
});

test('shock badge absent when shockTimer is 0', () => {
  const fx = getStatusEffects(makePlayer({ shockTimer: 0 }));
  assert.equal(fx.find(e => e.id === 'shocked'), undefined);
});

test('toxic-slow badge appears when toxicSlowActive is true', () => {
  const fx = getStatusEffects(makePlayer({ toxicSlowActive: true }));
  const tox = fx.find(e => e.id === 'toxic-slow');
  assert.ok(tox, 'toxic-slow badge should be present when standing on toxic tile');
  assert.equal(tox.label, 'TOXIC');
  assert.equal(tox.icon, '☣');
});

test('toxic-slow badge suppressed during dash (slow does not apply mid-dash)', () => {
  const fx = getStatusEffects(makePlayer({ toxicSlowActive: true, dashTimer: 0.08 }));
  assert.equal(fx.find(e => e.id === 'toxic-slow'), undefined,
    'badge must not display when dashTimer > 0 — matches the entities.js movement gate');
});

test('toxic-slow badge gating matches movement-gate exactly (predicate parity)', () => {
  // entities.js:8362 uses `this.dashTimer <= 0` for the slow application.
  // The HUD MUST use the same predicate so it never displays a slow that
  // isn't being applied (or hide one that is). Both must agree on the
  // edge case where dashTimer is undefined/NaN.
  for (const dt of [undefined, NaN]) {
    const slowApplied = !(dt > 0) && dt <= 0; // = false for NaN/undefined
    const fx = getStatusEffects(makePlayer({ toxicSlowActive: true, dashTimer: dt }));
    const present = !!fx.find(e => e.id === 'toxic-slow');
    assert.equal(present, slowApplied,
      `HUD/movement parity at dashTimer=${String(dt)}: HUD ${present ? 'shows' : 'hides'}, slow ${slowApplied ? 'applied' : 'not applied'}`);
  }
});

test('toxic-slow badge absent when toxicSlowActive is false', () => {
  const fx = getStatusEffects(makePlayer({ toxicSlowActive: false }));
  assert.equal(fx.find(e => e.id === 'toxic-slow'), undefined);
});

test('toxic-slow renders alongside disruption-field (parity: both are ground-hazard slows)', () => {
  const fx = getStatusEffects(makePlayer({
    toxicSlowActive: true,
    disruptionFieldActive: true
  }));
  assert.ok(fx.find(e => e.id === 'toxic-slow'),  'toxic-slow present');
  assert.ok(fx.find(e => e.id === 'disrupted'),   'disrupted present');
});

test('burn badge format unchanged (regression net: existing countdown still works)', () => {
  const fx = getStatusEffects(makePlayer({ burnTimer: 1.7 }));
  const burn = fx.find(e => e.id === 'burn');
  assert.ok(burn);
  assert.equal(burn.label, '1.7s');
});
