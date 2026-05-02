'use strict';
// REDUCED MOTION extension: spawnParticles dampens burst counts when
// settings.reducedMotion is on. Particles are the largest in-gameplay
// motion source — a single boss explosion can spawn 30+ outward-moving
// sprites. Halving the count (floored at 1 so MUZZLE flashes stay
// visible as a gameplay tell) gives motion-sensitive players a
// meaningful reduction without compromising essential combat feedback.
//
// This extends the umbrella established by the reducedMotion setting
// (PR #182) which previously only gated the cyan LEVEL UP flash.
//
// Source-text wiring tests + a behavioral exercise of the gate via a
// minimal sandbox (matches the dmg-text-and-bomb-render test pattern).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
);

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const CONTENT_NC = stripComments(CONTENT);

test('reduced-motion-particles: spawnParticles applies the reducedMotion gate AFTER scaleBurst', () => {
  // Order matters: scaleBurst is the engine's panic damper for
  // pathological stacking; reducedMotion is the user-opt damper. Both
  // should compose multiplicatively, with the user setting applied
  // after the engine cap so a stacking-saturated burst doesn't
  // double-discount.
  const body = CONTENT_NC.match(
    /function\s+spawnParticles\s*\([^)]*\)\s*\{[\s\S]*?\n\}/
  );
  assert.ok(body, 'spawnParticles function body must be findable');
  const scaleBurstIdx = body[0].indexOf('_particleSystem.scaleBurst');
  const reducedMotionIdx = body[0].indexOf('settings.reducedMotion');
  assert.ok(scaleBurstIdx !== -1, 'scaleBurst call must exist');
  assert.ok(reducedMotionIdx !== -1, 'reducedMotion gate must exist');
  assert.ok(
    reducedMotionIdx > scaleBurstIdx,
    'reducedMotion gate must be applied AFTER scaleBurst (composes correctly)'
  );
});

test('reduced-motion-particles: gate floors at 1 so MUZZLE flashes never zero-out', () => {
  // MUZZLE is a 3-particle burst per shot. count*0.5 = 1.5 → Math.floor = 1
  // is fine. But if anyone bumps the multiplier lower (e.g. *0.3), a
  // 3-particle burst rounds to 0 and muzzle flashes vanish entirely —
  // a critical gameplay tell. The Math.max(1, ...) floor guards
  // against that regression.
  const body = CONTENT_NC.match(
    /function\s+spawnParticles\s*\([^)]*\)\s*\{[\s\S]*?\n\}/
  );
  assert.ok(body);
  assert.match(
    body[0],
    /settings\.reducedMotion[\s\S]{0,100}Math\.max\s*\(\s*1\s*,\s*Math\.floor/,
    'reducedMotion gate must floor count at Math.max(1, …) to keep MUZZLE flashes'
  );
});

test('reduced-motion-particles: behavioral check — gate halves count when on, no-op when off', () => {
  // Stand up a sandbox just for the spawnParticles function. We stub
  // _particleSystem.acquire to count successful spawns so we can read
  // back exactly how many particles a 30-burst yielded.
  const body = CONTENT_NC.match(
    /function\s+spawnParticles\s*\([^)]*\)\s*\{[\s\S]*?\n\}/
  );
  assert.ok(body, 'spawnParticles function body must be extractable');

  const makeSandbox = (reducedMotion) => {
    let acquired = 0;
    return {
      _particleSystem: {
        scaleBurst: c => c,            // identity — measure pre-cap behaviour
        acquire: () => { acquired++; return { /* dummy particle */ }; },
      },
      settings: { reducedMotion },
      TILE: 32,
      TWO_PI: Math.PI * 2,
      Math,
      rand: () => 0.25,
      rnd: () => 1,                    // deterministic
      get acquired() { return acquired; },
    };
  };

  const sandboxOff = makeSandbox(false);
  const fnOff = new Function( // eslint-disable-line no-new-func
    '_particleSystem', 'settings', 'TILE', 'TWO_PI', 'Math', 'rand', 'rnd',
    body[0] + '\nreturn spawnParticles;'
  );
  const spawnParticlesOff = fnOff(
    sandboxOff._particleSystem, sandboxOff.settings, sandboxOff.TILE,
    sandboxOff.TWO_PI, sandboxOff.Math, sandboxOff.rand, sandboxOff.rnd
  );
  spawnParticlesOff(0, 0, 'EXPLOSION', '#fff', 30);
  assert.equal(sandboxOff.acquired, 30,
    'reducedMotion=false: full burst spawned');

  const sandboxOn = makeSandbox(true);
  const fnOn = new Function( // eslint-disable-line no-new-func
    '_particleSystem', 'settings', 'TILE', 'TWO_PI', 'Math', 'rand', 'rnd',
    body[0] + '\nreturn spawnParticles;'
  );
  const spawnParticlesOn = fnOn(
    sandboxOn._particleSystem, sandboxOn.settings, sandboxOn.TILE,
    sandboxOn.TWO_PI, sandboxOn.Math, sandboxOn.rand, sandboxOn.rnd
  );
  spawnParticlesOn(0, 0, 'EXPLOSION', '#fff', 30);
  assert.equal(sandboxOn.acquired, 15,
    'reducedMotion=true: burst halved (30 → 15)');

  // Edge case: a 1-particle burst stays at 1 (the floor).
  const sandboxFloor = makeSandbox(true);
  const fnFloor = new Function( // eslint-disable-line no-new-func
    '_particleSystem', 'settings', 'TILE', 'TWO_PI', 'Math', 'rand', 'rnd',
    body[0] + '\nreturn spawnParticles;'
  );
  const spawnFloor = fnFloor(
    sandboxFloor._particleSystem, sandboxFloor.settings, sandboxFloor.TILE,
    sandboxFloor.TWO_PI, sandboxFloor.Math, sandboxFloor.rand, sandboxFloor.rnd
  );
  spawnFloor(0, 0, 'MUZZLE', '#fff', 1);
  assert.equal(sandboxFloor.acquired, 1,
    'reducedMotion=true: 1-particle burst stays at 1 (Math.max floor)');
});
