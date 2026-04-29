'use strict';
// Auto-paused indicator: when the visibilitychange handler in
// platform.js auto-pauses the game (tab switch / iOS lock / phone
// call), the renderPaused() screen now shows a "(auto-paused — focus
// lost)" subtitle so a returning player understands why the game
// paused. Sticky flag survives the hidden→visible→still-PAUSED
// window; cleared on any transition out of PAUSED in setState().
//
// Source-text wiring tests (matches blink-hackware / mark-affix /
// reduced-motion patterns).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const GAME = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8'
);
const PLATFORM = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'platform.js'), 'utf8'
);

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const GAME_NC = stripComments(GAME);
const PLATFORM_NC = stripComments(PLATFORM);

test('auto-paused: game declares wasAutoPaused: false in initial state', () => {
  assert.match(
    GAME_NC,
    /wasAutoPaused\s*:\s*false/,
    'game.wasAutoPaused must default to false in the initial-state object'
  );
});

test('auto-paused: platform _onVisibilityHidden sets _G.wasAutoPaused = true', () => {
  // The hidden handler is the only writer of the sticky flag. Without
  // this assignment the renderer never shows the subtitle.
  const hiddenBody = PLATFORM_NC.match(
    /function\s+_onVisibilityHidden\s*\([^)]*\)\s*\{[\s\S]*?\n\}/
  );
  assert.ok(hiddenBody, '_onVisibilityHidden body must be findable');
  assert.match(
    hiddenBody[0],
    /_G\.wasAutoPaused\s*=\s*true/,
    '_onVisibilityHidden must set _G.wasAutoPaused = true so the sticky flag is observable from game.js'
  );
});

test('auto-paused: setState clears wasAutoPaused on transition OUT of PAUSED', () => {
  // Without this, a player who auto-pauses then manually unpauses
  // then later pauses by hand would still see "(auto-paused)" on the
  // second pause. The clear must run BEFORE this.state is updated so
  // it can compare old vs new state.
  const setStateBody = GAME_NC.match(/setState\s*\(\s*s\s*,[^)]*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(setStateBody, 'setState body must be findable');
  assert.match(
    setStateBody[0],
    /this\.state\s*===\s*['"]PAUSED['"][\s\S]{0,80}s\s*!==\s*['"]PAUSED['"][\s\S]{0,120}this\.wasAutoPaused\s*=\s*false/,
    'setState must clear wasAutoPaused when transitioning out of PAUSED'
  );
});

test('auto-paused: subtitle is rendered conditionally on this.wasAutoPaused', () => {
  // The render branch must guard on the flag. An always-on subtitle
  // would lie about manually-paused screens.
  const renderBody = GAME_NC.match(/renderPaused\s*\(\s*\)\s*\{[\s\S]*?\n\s{2}\},?/);
  assert.ok(renderBody, 'renderPaused body must be findable');
  assert.match(
    renderBody[0],
    /if\s*\(\s*this\.wasAutoPaused\s*\)[\s\S]{0,400}auto-paused/,
    'renderPaused must guard the auto-paused subtitle behind a this.wasAutoPaused check'
  );
});

test('auto-paused: subtitle text mentions both "auto-paused" and "focus lost"', () => {
  // Future-proofs against accidental wording changes that drop the
  // contextual hint. The whole point of the subtitle is to TELL the
  // player WHY they're paused, not just that something is different.
  assert.match(
    GAME,
    /\(\s*auto-paused\s*[—-]\s*focus lost\s*\)/,
    'subtitle must include both "auto-paused" and "focus lost" so the player understands the cause'
  );
});

test('auto-paused: clear runs BEFORE state update in setState (so compare uses old state)', () => {
  // Order matters: `this.state === 'PAUSED'` must be evaluated against
  // the OLD value, then `this.state = s` runs. Reverse order would
  // always see the new state and the comparison would fire on
  // PAUSED→PAUSED transitions (a no-op, fine) but NEVER fire on
  // PAUSED→PLAYING (broken).
  const setStateBody = GAME_NC.match(/setState\s*\(\s*s\s*,[^)]*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(setStateBody);
  const clearIdx = setStateBody[0].search(/this\.wasAutoPaused\s*=\s*false/);
  const stateAssignIdx = setStateBody[0].search(/this\.state\s*=\s*s\s*;/);
  assert.ok(clearIdx !== -1 && stateAssignIdx !== -1,
    'both the clear and the state assignment must exist in setState');
  assert.ok(
    clearIdx < stateAssignIdx,
    'wasAutoPaused clear must run BEFORE this.state = s, otherwise the OLD-state comparison always fails'
  );
});
