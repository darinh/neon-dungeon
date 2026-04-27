'use strict';
// REDUCED_MOTION accessibility setting — suppresses the cyan full-screen
// LEVEL UP flash overlay (high-area, high-contrast strobe that can be
// uncomfortable for users with vestibular sensitivity or photosensitive
// epilepsy). Designed as the umbrella setting that future motion-
// suppression code can hang off without adding more menu toggles.
//
// Source-text wiring tests (matches blink-hackware / mark-affix pattern).
// platform.js / game.js / render.js are browser-only globals and can't be
// loaded under node:test without extensive scaffolding. We assert the
// invariants any working REDUCED_MOTION must satisfy: persistence
// (load/save/reset), menu integration (toggleKeys + label + index
// constants), and the actual gate on the flash render path.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PLATFORM = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'platform.js'), 'utf8'
);
const GAME = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8'
);
const RENDER = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'render.js'), 'utf8'
);

function stripComments(src) {
  // Strip block + line comments so source-text regex assertions don't pass
  // on commentary alone (mark-affix.test.js / reverse-polarity-hackware
  // pattern).
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const PLATFORM_NC = stripComments(PLATFORM);
const GAME_NC = stripComments(GAME);
const RENDER_NC = stripComments(RENDER);

// ---------- platform.js: persistence ----------

test('REDUCED_MOTION: settings object declares reducedMotion field with default false', () => {
  // Default must be OFF so existing users see no behavior change. Opt-in,
  // not opt-out.
  assert.match(
    PLATFORM_NC,
    /reducedMotion:\s*false/,
    'settings.reducedMotion must default to false (opt-in accessibility)'
  );
});

test('REDUCED_MOTION: settings.load reads reducedMotion from localStorage', () => {
  // Without a load gate the saved choice is silently dropped on next page
  // load — the most common settings-persistence regression.
  const loadBody = PLATFORM_NC.match(/load\s*\(\s*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(loadBody, 'settings.load() must be findable');
  assert.match(
    loadBody[0],
    /typeof\s+raw\.reducedMotion\s*===\s*['"]boolean['"][\s\S]{0,80}this\.reducedMotion\s*=\s*raw\.reducedMotion/,
    'settings.load must hydrate this.reducedMotion from raw.reducedMotion'
  );
});

test('REDUCED_MOTION: settings.save persists reducedMotion to localStorage', () => {
  const saveBody = PLATFORM_NC.match(/save\s*\(\s*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(saveBody, 'settings.save() must be findable');
  assert.match(
    saveBody[0],
    /reducedMotion:\s*this\.reducedMotion/,
    'settings.save must include reducedMotion in the JSON payload'
  );
});

test('REDUCED_MOTION: settings.resetAll restores reducedMotion to false', () => {
  const resetBody = PLATFORM_NC.match(/resetAll\s*\(\s*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(resetBody, 'settings.resetAll() must be findable');
  assert.match(
    resetBody[0],
    /this\.reducedMotion\s*=\s*false/,
    'settings.resetAll must reset reducedMotion to its default (false)'
  );
});

test('REDUCED_MOTION: settings JSDoc type includes reducedMotion as boolean', () => {
  // The hand-rolled @type {{...}} declaration is the surface other code
  // checks against; tsc will flag any reads that aren't in the type.
  const typeDecl = PLATFORM.match(/@type\s*\{\s*\{[^}]*\}\s*\}\s*\*\/\s*\nconst settings/);
  assert.ok(typeDecl, 'settings @type declaration must be findable');
  assert.match(
    typeDecl[0],
    /reducedMotion\s*:\s*boolean/,
    'settings JSDoc @type must declare reducedMotion as boolean'
  );
});

// ---------- game.js: menu integration ----------

test('REDUCED_MOTION: settings menu toggleKeys includes reducedMotion (both copies)', () => {
  // game.js declares toggleKeys TWICE — once in updateSettings (input
  // handler) and once in renderSettings (display). Both must list the
  // new key in the same order, otherwise selection index ↔ key binding
  // gets misaligned and clicking one row toggles a different setting.
  const occurrences = GAME_NC.match(
    /toggleKeys\s*=\s*\[[^\]]*'reducedMotion'[^\]]*\]/g
  );
  assert.ok(
    occurrences && occurrences.length === 2,
    `toggleKeys with 'reducedMotion' must appear in BOTH updateSettings and renderSettings (found ${occurrences ? occurrences.length : 0})`
  );
});

test('REDUCED_MOTION: settings menu toggleLabels includes "REDUCED MOTION"', () => {
  assert.match(
    GAME_NC,
    /toggleLabels\s*=\s*\[[^\]]*['"]REDUCED MOTION['"][^\]]*\]/,
    'renderSettings toggleLabels must include "REDUCED MOTION" so the new toggle has a visible row'
  );
});

test('REDUCED_MOTION: CTRL_START bumped from 7 to 8 (six toggles, not five)', () => {
  // CTRL_START is the row index where key-rebind rows begin — must equal
  // TOGGLE_START (2) + number-of-toggles. Adding a 6th toggle without
  // bumping this constant pushes rebind rows under the toggle row,
  // making the last toggle invisible / unclickable.
  // Count occurrences of CTRL_START = 8; both updateSettings and
  // renderSettings declare it.
  const matches = GAME_NC.match(/const\s+CTRL_START\s*=\s*8\b/g);
  assert.ok(
    matches && matches.length >= 2,
    `CTRL_START must be 8 in BOTH updateSettings and renderSettings (found ${matches ? matches.length : 0} occurrences of '= 8')`
  );
  // And no leftover CTRL_START = 7 occurrences.
  assert.doesNotMatch(
    GAME_NC,
    /const\s+CTRL_START\s*=\s*7\b/,
    'no CTRL_START = 7 may remain — both copies must be bumped'
  );
});

// ---------- render.js: levelFlash gate ----------

test('REDUCED_MOTION: render.js levelFlash branch gated on !settings.reducedMotion', () => {
  // The cyan full-screen flash + "LEVEL UP!" text live in a single
  // `if (player.levelFlash > 0 …)` branch. Grab that branch's condition
  // and assert reducedMotion is in it.
  const branch = RENDER_NC.match(
    /if\s*\(\s*player\.levelFlash\s*>\s*0[^)]*\)\s*\{/
  );
  assert.ok(branch, 'levelFlash render branch must be findable');
  assert.match(
    branch[0],
    /!\s*settings\.reducedMotion/,
    'levelFlash render branch must AND-gate on !settings.reducedMotion to suppress the cyan flash for opt-in users'
  );
});

test('REDUCED_MOTION: gate sits on the OUTER if (not just the inner LEVEL UP! text)', () => {
  // Defensive: if the gate were only on the inner `if (levelFlash > 0.5)`
  // text branch, the cyan fillRect would still strobe — defeating the
  // accessibility intent. Assert there's no UNGATED `player.levelFlash > 0`
  // branch that does a fillRect.
  const ungatedBranch = RENDER_NC.match(
    /if\s*\(\s*player\.levelFlash\s*>\s*0\s*\)\s*\{[\s\S]*?fillRect\s*\(\s*0\s*,\s*0/
  );
  assert.equal(
    ungatedBranch,
    null,
    'no `if (player.levelFlash > 0) { … fillRect(0,0,…) }` may exist without the reducedMotion gate'
  );
});
