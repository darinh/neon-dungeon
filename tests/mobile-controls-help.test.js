'use strict';
// @ts-check

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const GAME = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8');
const PLATFORM = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'platform.js'), 'utf8');

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const GAME_NC = stripComments(GAME);
const PLATFORM_NC = stripComments(PLATFORM);

test('mobile menu hints use touch captions instead of keyboard glyphs', () => {
  const renderMenuBody = GAME_NC.match(/renderMenu\s*\(\s*\)\s*\{[\s\S]*?\n\s{2}\},?\n\s*renderPaused/);
  assert.ok(renderMenuBody, 'renderMenu body must be findable');
  assert.match(renderMenuBody[0], /LEFT DRAG:\s*Move\s*\|\s*RIGHT DRAG:\s*Aim \+ Fire/);
  assert.match(renderMenuBody[0], /USE:\s*Interact\s*\|\s*DASH:\s*Dodge/);
  assert.match(renderMenuBody[0], /BOMB:\s*Void shard\s*\|\s*PAUSE:\s*Menu/);
  assert.doesNotMatch(renderMenuBody[0], /KEY_DISPLAY\(km\('interact'\)\).*isTouch/,
    'touch menu hint should not reuse keyboard binding glyphs after semantic captions ship');
});

test('mobile pause screen includes a compact control reminder', () => {
  const renderPausedBody = GAME_NC.match(/renderPaused\s*\(\s*\)\s*\{[\s\S]*?\n\s{2}\},?\n\s*renderPowerupChoice/);
  assert.ok(renderPausedBody, 'renderPaused body must be findable');
  assert.match(renderPausedBody[0], /LEFT DRAG move\s*\|\s*RIGHT DRAG aim \+ fire/);
  assert.match(renderPausedBody[0], /USE interact\s*\|\s*DASH dodge\s*\|\s*BOMB void shard/);
  assert.match(renderPausedBody[0], /HACK is dim until a module is installed/);
  assert.match(renderPausedBody[0], /const\s+helpY\s*=\s*narrow\s*\?\s*340\s*:\s*388/,
    'pause help must sit below the three visible pause option labels on compact and landscape layouts');
});

test('mobile HACK help matches always-visible dimmed button behavior', () => {
  assert.match(PLATFORM_NC, /BTNS\.F\.hidden\s*=\s*false/,
    'HACK/F button must remain visible so help copy can describe it as dim, not absent');
  assert.match(PLATFORM_NC, /key\s*===\s*'F'\s*&&\s*noHackware[\s\S]{0,80}ctx\.globalAlpha\s*=\s*0\.15/,
    'HACK/F button must dim when no hackware is installed');
  assert.match(GAME_NC, /HACK is dim until a module is installed/,
    'pause help must describe dimmed availability rather than claiming HACK appears later');
  assert.doesNotMatch(GAME_NC, /HACK appears when a module is installed/);
});
