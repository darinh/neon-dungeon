'use strict';
// Two-tap confirmation for [RESET TO DEFAULTS] in the SETTINGS menu.
//
// Before this change, hitting Enter (or clicking) on the reset row
// immediately called settings.resetAll() — wiping ALL keybinds, audio
// volumes, and accessibility toggles in one keystroke with no undo.
// One stray Enter on the wrong row was enough to lose hours of
// rebinding. This change adds a "press again within 3 seconds to
// confirm" pattern: first activation arms a timestamp, second within
// the window commits, anything else (different row navigation, click
// elsewhere, Escape, timeout) cancels.
//
// Source-text wiring tests (matches blink-hackware / mark-affix /
// reduced-motion patterns). game.js is browser-only globals — we
// can't load updateSettings() under node:test, so we assert the
// invariants any working confirmation flow must satisfy.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const GAME = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8'
);

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const GAME_NC = stripComments(GAME);

// ---------- State field ----------

test('reset-confirm: _settingsResetConfirm timestamp field declared on the game object', () => {
  // The other _settings* fields cluster together; the new one must
  // join them so it's reset on game-state transitions if needed.
  assert.match(
    GAME_NC,
    /_settingsResetConfirm\s*:\s*0\b/,
    '_settingsResetConfirm field must be declared (default 0 = unarmed)'
  );
});

// ---------- Auto-expiry ----------

test('reset-confirm: stale arm auto-expires when window elapses', () => {
  // Without auto-expiry, a player who armed and walked away returns to
  // a menu where Enter wipes their config 30s later. The expiry check
  // must run BEFORE any input handlers in updateSettings, otherwise an
  // expired arm could still commit on the same frame as the second
  // press.
  const updateBody = GAME_NC.match(/updateSettings\s*\(\s*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(updateBody, 'updateSettings body must be findable');
  assert.match(
    updateBody[0],
    /performance\.now\(\)\s*-\s*this\._settingsResetConfirm[\s\S]{0,80}>\s*RESET_CONFIRM_WINDOW_MS[\s\S]{0,120}this\._settingsResetConfirm\s*=\s*0/,
    'updateSettings must auto-clear an expired _settingsResetConfirm'
  );
});

// ---------- Cancellation paths ----------

test('reset-confirm: navigation to a different row clears arming', () => {
  // If the player arms reset, then arrows away to another row, the
  // arming intent is gone. Without this, returning to the reset row
  // and pressing Enter would commit on the FIRST press of the
  // returning visit.
  const updateBody = GAME_NC.match(/updateSettings\s*\(\s*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(updateBody);
  assert.match(
    updateBody[0],
    /this\._settingsSel\s*!==\s*prevSel[\s\S]{0,80}this\._settingsResetConfirm\s*=\s*0/,
    'Arrow navigation that changes _settingsSel must clear _settingsResetConfirm'
  );
});

test('reset-confirm: Escape clears arming', () => {
  // Escape exits the menu — it must also drop the arm so the player
  // doesn't return later to a primed menu.
  const updateBody = GAME_NC.match(/updateSettings\s*\(\s*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(updateBody);
  // Find the `if (jp('Escape')…)` block and assert it clears the field.
  const escBlock = updateBody[0].match(/if\s*\(\s*jp\(\s*['"]Escape['"]\s*\)[\s\S]{0,60}\{[\s\S]{0,200}\}/);
  assert.ok(escBlock, 'Escape handler block must be findable');
  assert.match(
    escBlock[0],
    /this\._settingsResetConfirm\s*=\s*0/,
    'Escape handler must clear _settingsResetConfirm'
  );
});

// ---------- Commit path: keyboard ----------

test('reset-confirm: keyboard Enter only calls settings.resetAll() on the SECOND press within the window', () => {
  // The Enter handler for the reset row must check the arm timestamp
  // BEFORE calling resetAll(). The unguarded form
  //   } else if (sel === CTRL_START + actions.length) {
  //     settings.resetAll();
  // (the pre-change shape) is the regression we're guarding against.
  const updateBody = GAME_NC.match(/updateSettings\s*\(\s*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(updateBody);
  // Locate the Enter→reset branch.
  const enterReset = updateBody[0].match(
    /else\s+if\s*\(\s*sel\s*===\s*CTRL_START\s*\+\s*actions\.length\s*\)\s*\{[\s\S]{0,500}?\n\s{6}\}/
  );
  assert.ok(enterReset, 'Enter→reset branch must be findable');
  // Must guard resetAll on the arm-check.
  assert.match(
    enterReset[0],
    /this\._settingsResetConfirm\s*>\s*0[\s\S]{0,200}performance\.now\(\)[\s\S]{0,200}settings\.resetAll\(\)/,
    'Enter handler for reset row must guard settings.resetAll() behind the arm check'
  );
  // And the unarmed branch must SET the timestamp, not call resetAll().
  assert.match(
    enterReset[0],
    /this\._settingsResetConfirm\s*=\s*performance\.now\(\)/,
    'Unarmed Enter on reset row must set the arm timestamp (not commit)'
  );
});

// ---------- Commit path: mouse ----------

test('reset-confirm: mouse click only calls settings.resetAll() on the SECOND click within the window', () => {
  const updateBody = GAME_NC.match(/updateSettings\s*\(\s*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(updateBody);
  // The mouse handler scopes by checking the resetY hit-box.
  const mouseReset = updateBody[0].match(
    /if\s*\(\s*my\s*>=\s*resetY[\s\S]{0,800}?\n\s{6}\}/
  );
  assert.ok(mouseReset, 'mouse-click→reset hit-box block must be findable');
  assert.match(
    mouseReset[0],
    /this\._settingsResetConfirm\s*>\s*0[\s\S]{0,200}settings\.resetAll\(\)/,
    'Mouse handler for reset row must guard settings.resetAll() behind the arm check'
  );
  assert.match(
    mouseReset[0],
    /this\._settingsResetConfirm\s*=\s*performance\.now\(\)/,
    'First click on reset row must set the arm timestamp (not commit)'
  );
});

// ---------- No unguarded resetAll remains ----------

test('reset-confirm: NO unguarded settings.resetAll() call remains in updateSettings', () => {
  // Defensive: walk every settings.resetAll() call in updateSettings
  // and confirm each one is preceded (within ~250 chars) by an arm
  // check. If a developer adds a new path that calls resetAll without
  // the guard, this test fires.
  const updateBody = GAME_NC.match(/updateSettings\s*\(\s*\)\s*\{[\s\S]*?\n\s{2}\}/);
  assert.ok(updateBody);
  const calls = [...updateBody[0].matchAll(/settings\.resetAll\(\)/g)];
  for (const m of calls) {
    const start = Math.max(0, m.index - 250);
    const slice = updateBody[0].slice(start, m.index);
    assert.match(
      slice,
      /this\._settingsResetConfirm\s*>\s*0/,
      `Unguarded settings.resetAll() at index ${m.index}; must be preceded by an arm check`
    );
  }
});

// ---------- Render: armed state shows confirmation label ----------

test('reset-confirm: renderSettings shows "PRESS AGAIN TO CONFIRM" label when armed', () => {
  // Visual feedback is a hard requirement — without it the user has
  // no idea their first press did anything except (silently) prime a
  // destructive action. The label color must be visually distinct
  // (red, blink) from the default amber selection.
  const renderStart = GAME_NC.indexOf('renderSettings()');
  assert.notEqual(renderStart, -1, 'renderSettings must exist');
  // Crude but reliable: take a generous window after the function
  // start to encompass the whole body.
  const renderBody = GAME_NC.slice(renderStart, renderStart + 12000);
  assert.match(
    renderBody,
    /PRESS AGAIN TO CONFIRM/,
    'renderSettings must include the armed-state label text'
  );
  // And the armed branch must gate on the timestamp + window check.
  assert.match(
    renderBody,
    /this\._settingsResetConfirm\s*>\s*0[\s\S]{0,400}PRESS AGAIN TO CONFIRM/,
    'Armed label must be conditional on _settingsResetConfirm being within the window'
  );
});

test('reset-confirm: every non-reset actionable mouse-click row clears the arm', () => {
  // Reviewer-caught (gpt-5.3-codex round 1): clicking a slider /
  // toggle / rebind row after arming reset must drop the arm. Without
  // this, the user clicks reset → walks the mouse over to a toggle to
  // verify their setting → clicks back to reset, which now commits on
  // the FIRST visible click. That defeats the safety contract.
  // We use the UNSTRIPPED GAME source here so we can anchor on the
  // distinctive comment markers that scope each click branch.
  const updateBody = GAME.match(/updateSettings\s*\(\s*\)\s*\{[\s\S]*?\n\s{2}\},?/);
  assert.ok(updateBody, 'updateSettings body must be findable');
  const sliderStart = updateBody[0].indexOf("this._settingsDrag = i === 0");
  const toggleHeader = updateBody[0].indexOf("// Toggle rows click");
  const rebindHeader = updateBody[0].indexOf("// Rebind rows click");
  const resetHeader = updateBody[0].indexOf("// Reset defaults row");
  assert.ok(sliderStart !== -1, 'slider branch marker not found');
  assert.ok(toggleHeader !== -1, 'toggle branch marker not found');
  assert.ok(rebindHeader !== -1, 'rebind branch marker not found');
  assert.ok(resetHeader !== -1, 'reset branch marker not found');
  const sliderSlice = updateBody[0].slice(sliderStart, toggleHeader);
  const toggleSlice = updateBody[0].slice(toggleHeader, rebindHeader);
  const rebindSlice = updateBody[0].slice(rebindHeader, resetHeader);
  assert.match(
    sliderSlice,
    /this\._settingsResetConfirm\s*=\s*0/,
    'Slider mouse-click handler must clear _settingsResetConfirm'
  );
  assert.match(
    toggleSlice,
    /this\._settingsResetConfirm\s*=\s*0/,
    'Toggle mouse-click handler must clear _settingsResetConfirm'
  );
  assert.match(
    rebindSlice,
    /this\._settingsResetConfirm\s*=\s*0/,
    'Rebind mouse-click handler must clear _settingsResetConfirm'
  );
});

test('reset-confirm: RESET_CONFIRM_WINDOW_MS is centralized at module scope', () => {
  // Hoisted out of updateSettings/renderSettings into a single
  // module-scope const so the two callers can no longer drift. The
  // earlier per-method declarations were a known-limitation noted in
  // PR #184; this assertion locks in the consolidation.
  const moduleScopeDecl = GAME_NC.match(
    /\nconst\s+RESET_CONFIRM_WINDOW_MS\s*=\s*(\d+)\s*;/
  );
  assert.ok(
    moduleScopeDecl,
    'RESET_CONFIRM_WINDOW_MS must be declared once at module scope'
  );
  // And there must be NO per-method `const RESET_CONFIRM_WINDOW_MS`
  // shadow declaration left over inside updateSettings or
  // renderSettings — that would silently mask the module-scope value
  // and re-introduce drift.
  const allDecls = GAME_NC.match(/const\s+RESET_CONFIRM_WINDOW_MS\s*=/g) || [];
  assert.equal(
    allDecls.length,
    1,
    `RESET_CONFIRM_WINDOW_MS must be declared exactly once (found ${allDecls.length})`
  );
});
