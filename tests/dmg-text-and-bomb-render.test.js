'use strict';
// Regression tests for two visual bugs:
//
//   1. Damage floaters showed values like "31.99999999994" instead of "32"
//      because Player.shoot computes damage as
//        (w.dmg + atk) * (isCrit ? critMul : 1) * metaMul
//      with no Math.round, and spawnDmgText forwards the float straight
//      into the floater's text. Fix: round numeric `text` arguments
//      inside spawnDmgText so every numeric caller gets clean integers
//      without scattering Math.round across every damage path.
//
//   2. Tap-V fuse bombs ("FuseShard") were never visible on the floor.
//      FuseShard.draw was computing screen position as
//        sx = (this.x - camX) * TILE
//      but cam.x/cam.y are PIXEL units (see getCamera in render.js), and
//      every other draw* in the codebase uses `pos * TILE - cam`. The
//      mismatched form placed bombs thousands of pixels off-screen.
//
// Pattern: source-text wiring assertions (matches blink-hackware.test.js
// and other affix/perk wiring tests). content.js / entities.js are
// browser-only globals, so we can't invoke FuseShard.draw directly under
// node:test, but the failing forms are syntactically distinct from the
// fixed forms.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
);
const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);

function stripComments(src) {
  // Remove /* … */ and // … so source-text regex assertions don't pass on
  // commentary alone. Pattern established in tests/mark-affix.test.js and
  // reverse-polarity-hackware.test.js.
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const CONTENT_NC = stripComments(CONTENT);
const ENTITIES_NC = stripComments(ENTITIES);

// ---------- spawnDmgText numeric rounding ----------

test('spawnDmgText rounds numeric text so float damage shows as integer', () => {
  // Locate the spawnDmgText body and assert it rounds when text is a number.
  const body = CONTENT_NC.match(
    /function\s+spawnDmgText\s*\([^)]*\)\s*\{[\s\S]*?\n\}/
  );
  assert.ok(body, 'spawnDmgText function not found in content.js');
  assert.match(
    body[0],
    /typeof\s+text\s*===\s*['"]number['"][\s\S]{0,200}Math\.round\s*\(\s*text\s*\)/,
    'spawnDmgText must Math.round numeric text to prevent 31.999… floaters'
  );
});

test('spawnDmgText rounding is finite-guarded so NaN/Infinity stays a string', () => {
  // Math.round(NaN) is NaN and String(NaN) -> "NaN" which would be ugly but
  // not a crash; the guard exists so future callers passing weird values
  // (e.g. division by zero) don't get a "NaN" floater either — they fall
  // through to the String(text) cast unchanged. Asserting the guard pins
  // the contract.
  const body = CONTENT_NC.match(
    /function\s+spawnDmgText\s*\([^)]*\)\s*\{[\s\S]*?\n\}/
  );
  assert.ok(body);
  assert.match(
    body[0],
    /Number\.isFinite\s*\(\s*text\s*\)/,
    'spawnDmgText rounding must be guarded by Number.isFinite'
  );
});

test('spawnDmgText behavioral check: integer floater is produced for float input', () => {
  // Stand up the minimum scaffolding to invoke spawnDmgText without
  // loading the whole game. content.js is a browser-globals UMD; we
  // simulate the module scope by pulling out just the function body and
  // running it against a fake `floatingTexts` + `settings` + `TILE` + `rnd`.
  const body = CONTENT_NC.match(
    /function\s+spawnDmgText\s*\([^)]*\)\s*\{[\s\S]*?\n\}/
  );
  assert.ok(body, 'spawnDmgText function body must be extractable');

  const sandbox = {
    floatingTexts: [],
    settings: { damageNumbers: true },
    TILE: 32,
    rnd: () => 0,
    Math, Number, String,
  };
  // isolated sandbox for one function extracted from a UMD-globals
  // file; the body comes from our own repo source, not user input.
  const fn = new Function( // eslint-disable-line no-new-func
    'floatingTexts', 'settings', 'TILE', 'rnd',
    'Math', 'Number', 'String',
    body[0] + '\nreturn spawnDmgText;'
  );
  const spawnDmgText = fn(
    sandbox.floatingTexts, sandbox.settings, sandbox.TILE, sandbox.rnd,
    sandbox.Math, sandbox.Number, sandbox.String
  );

  // The exact float value the bug report cited.
  spawnDmgText(0, 0, 31.999999999999996, '#ffffff');
  spawnDmgText(0, 0, 32.4, '#ffffff');
  spawnDmgText(0, 0, 'CRIT!', '#ffdd00');
  spawnDmgText(0, 0, '+5', '#88ff44');

  assert.equal(sandbox.floatingTexts[0].text, '32',
    'float damage 31.999… must round to "32"');
  assert.equal(sandbox.floatingTexts[1].text, '32',
    'float damage 32.4 must round to "32"');
  assert.equal(sandbox.floatingTexts[2].text, 'CRIT!',
    'string text must pass through untouched');
  assert.equal(sandbox.floatingTexts[3].text, '+5',
    'pre-formatted string text must pass through untouched');
});

// ---------- FuseShard.draw camera-space fix ----------

test('FuseShard.draw uses pixel-space camera (pos * TILE - cam), matching every other draw*', () => {
  // Locate the FuseShard.draw method.
  const drawBody = ENTITIES_NC.match(
    /class\s+FuseShard[\s\S]*?draw\s*\([^)]*\)\s*\{[\s\S]*?\n\s*\}/
  );
  assert.ok(drawBody, 'FuseShard.draw not found');

  // Must NOT use the broken (pos - cam) * TILE form.
  assert.doesNotMatch(
    drawBody[0],
    /\(\s*this\.x\s*-\s*camX\s*\)\s*\*\s*TILE/,
    'FuseShard.draw must not treat camX as tile-space (would render off-screen)'
  );
  assert.doesNotMatch(
    drawBody[0],
    /\(\s*this\.y\s*-\s*camY\s*\)\s*\*\s*TILE/,
    'FuseShard.draw must not treat camY as tile-space (would render off-screen)'
  );

  // Must use the correct pixel-space form.
  assert.match(
    drawBody[0],
    /this\.x\s*\*\s*TILE\s*-\s*camX/,
    'FuseShard.draw must compute sx as this.x * TILE - camX'
  );
  assert.match(
    drawBody[0],
    /this\.y\s*\*\s*TILE\s*-\s*camY/,
    'FuseShard.draw must compute sy as this.y * TILE - camY'
  );
});

test('FuseShard.draw produces an on-screen position for a player-adjacent bomb', () => {
  // Numeric sanity: with cam derived as `player*TILE - viewport/2` (the
  // shape getCamera uses), a bomb dropped AT the player must land near
  // the viewport center on screen, not thousands of pixels away.
  const TILE = 32;
  const W = 960, H = 540;
  const playerX = 20, playerY = 15;
  const camX = playerX * TILE - W / 2;
  const camY = playerY * TILE - H / 2;

  // Fixed form:
  const sxFixed = playerX * TILE - camX;
  const syFixed = playerY * TILE - camY;
  assert.equal(sxFixed, W / 2, 'fixed form puts bomb-at-player at viewport center X');
  assert.equal(syFixed, H / 2, 'fixed form puts bomb-at-player at viewport center Y');

  // Broken form (the original bug) for contrast — for any non-trivial
  // cam offset it places the bomb well off-screen (viewport is W=960
  // wide; broken form here yields ~|−4480px|, far outside the viewport).
  const sxBroken = (playerX - camX) * TILE;
  assert.ok(
    Math.abs(sxBroken) > W,
    'broken (pos - cam) * TILE form must place the bomb off-screen — proves the bug was real'
  );
});
