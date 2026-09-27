// @ts-check
'use strict';

// Self-tests for tests/_generation-fixture.js: the vm sandbox must load the
// same runtime modules the browser loads before generateFloor(), or
// generator tests silently exercise a different floor than players get.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('./_generation-fixture.js');
const trials = require('../src/content/trials.js');

test('the generation sandbox exposes NEON.trials with the browser module schedule', () => {
  const fx = fixture.createGenerationFixture();
  const sandboxTrials = fx.sandbox.NEON.trials;
  assert.ok(sandboxTrials, 'trials.js must be loaded into the generation sandbox');
  assert.deepEqual({ ...sandboxTrials.TRIAL_BY_FLOOR }, { ...trials.TRIAL_BY_FLOOR });
  assert.equal(sandboxTrials.TRIAL_VERSION, trials.TRIAL_VERSION);
});

test('fixture-generated trial rooms carry canonical trial state', () => {
  const fx = fixture.createGenerationFixture();
  const d = fx.generateFloor('fixture-trial-check', 2);
  assert.ok(d.trialRoom, 'floor 2 hosts a trial on this seed');
  assert.equal(d.trialRoom.trial.v, trials.TRIAL_VERSION);
  assert.equal(d.trialRoom.trial.kind, 'lattice');
  assert.equal(d.trialRoom.trial.lit.length, 9);
});
