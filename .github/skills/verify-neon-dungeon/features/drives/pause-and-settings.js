// @ts-check
'use strict';

// Feature: pause menu and settings (features/pause-and-settings.md).
// Pauses a run, opens SETTINGS from the pause menu, turns SCREEN SHAKE off and
// steps WORLD ZOOM up, checking each change where the player sees it (the
// value drawn on the row) and in neonDungeonSettings, then proves both
// survive a page reload.

const SEED = 'VERIFY-SETTINGS-1';
const SHAKE_VALUE = /^◀ (ON|OFF) ▶$/;
const ZOOM_VALUE = /^◀ \d+\.\d\d× ▶$/;

/** @param {number} zoom */
const zoomValue = (zoom) => `◀ ${zoom.toFixed(2)}× ▶`;

/**
 * Leaves SETTINGS the way a player would: ESC on a keyboard, [ BACK ] on touch.
 * @param {import('../../scripts/verify.js').Harness} h
 */
async function leaveSettings(h) {
  if (h.touch) await h.tapText(/^\[ BACK \]$/);
  else await h.press('Escape');
}

/** @param {import('../../scripts/verify.js').Harness} h */
module.exports = async function pauseAndSettings(h) {
  await h.bootRun({ seed: SEED });
  const initial = await h.storage('neonDungeonSettings');
  h.check(initial && initial.screenShake === true, 'first launch saved default settings with SCREEN SHAKE on', initial && initial.screenShake);
  const zoomBefore = /** @type {number} */ (initial && initial.worldZoom);

  await h.step('pause the run', async () => {
    if (h.touch) await h.tapText(/^II$/);
    else await h.press('Escape');
    const s = await h.waitForState('PAUSED');
    const option = await h.findText(h.touch ? /^SETTINGS$/ : /— Settings$/);
    h.check(s.state === 'PAUSED', `ESC (desktop) or the II PAUSE button (touch) pauses, and the menu draws "${option.text}"`, s.state);
  });

  await h.step('open SETTINGS from the pause menu', async () => {
    if (h.touch) await h.tapText(/^SETTINGS$/);
    else await h.press('KeyS');
    await h.waitForState('SETTINGS');
    await h.findText(/^SCREEN SHAKE$/);
    const from = await h.observe('settings opened from', () => game._settingsFrom);
    h.check(from === 'PAUSED', 'the SETTINGS screen is drawn and knows it was opened from PAUSED', from);
  });

  await h.step('turn SCREEN SHAKE off', async () => {
    const shown = await h.rowText(/^SCREEN SHAKE$/, SHAKE_VALUE);
    h.check(shown.text === '◀ ON ▶', 'the SCREEN SHAKE row draws ◀ ON ▶ before the change', shown.text);
    if (h.touch) {
      await h.tapText(/^SCREEN SHAKE$/);
    } else {
      await h.highlight(/^SCREEN SHAKE$/, 'ArrowDown');
      await h.press('Enter');
    }
    const drawn = await h.rowText(/^SCREEN SHAKE$/, SHAKE_VALUE);
    h.check(drawn.text === '◀ OFF ▶', 'the SCREEN SHAKE row now draws ◀ OFF ▶', drawn.text);
    const saved = await h.storage('neonDungeonSettings');
    h.check(saved && saved.screenShake === false, 'neonDungeonSettings.screenShake is now false', saved && saved.screenShake);
  });

  await h.step('step WORLD ZOOM up one notch', async () => {
    const before = await h.state();
    const shownBefore = await h.rowText(/^WORLD ZOOM$/, ZOOM_VALUE);
    h.check(shownBefore.text === zoomValue(before.zoom), 'the WORLD ZOOM row draws the current zoom', shownBefore.text);
    if (h.touch) {
      // A stepper tap on the right half of its row steps up; the row is found by its label.
      const label = await h.findText(/^WORLD ZOOM$/);
      await h.tapLogical(before.W * 0.75, label.logical.y);
    } else {
      await h.highlight(/^WORLD ZOOM$/, 'ArrowDown');
      await h.press('ArrowRight');
    }
    const after = await h.state();
    const shownAfter = await h.rowText(/^WORLD ZOOM$/, ZOOM_VALUE);
    const saved = await h.storage('neonDungeonSettings');
    h.check(after.zoom > before.zoom, 'WORLD ZOOM stepped up', { before: before.zoom, after: after.zoom });
    h.check(shownAfter.text === zoomValue(after.zoom), 'the WORLD ZOOM row draws the new zoom', shownAfter.text);
    h.check(after.W < before.W && after.H < before.H, 'logical W and H shrank with the larger zoom (resize re-ran)', { before, after });
    h.check(saved && saved.worldZoom === after.zoom, 'neonDungeonSettings.worldZoom matches the new zoom', saved && saved.worldZoom);
  });

  await h.step('back out to the run', async () => {
    await leaveSettings(h);
    await h.waitForState('PAUSED');
    if (h.touch) await h.tapText(/^RESUME RUN$/);
    else await h.press('Escape');
    const s = await h.waitForState('PLAYING');
    h.check(s.state === 'PLAYING', 'leaving SETTINGS returns to PAUSED, and resuming returns to PLAYING');
  });

  const reloaded = await h.reload();
  const loaded = await h.observe('settings after reload', () => ({ screenShake: settings.screenShake, worldZoom: settings.worldZoom }));
  h.check(loaded.screenShake === false && loaded.worldZoom !== zoomBefore && loaded.worldZoom === reloaded.zoom,
    'the reloaded game loaded SCREEN SHAKE off and the stepped WORLD ZOOM', { zoomBefore, loaded });

  await h.menuSelect('SETTINGS');
  await h.waitForState('SETTINGS');
  const shake = await h.rowText(/^SCREEN SHAKE$/, SHAKE_VALUE);
  h.check(shake.text === '◀ OFF ▶', 'after the reload, MENU > SETTINGS draws SCREEN SHAKE ◀ OFF ▶', shake.text);
  const zoom = await h.rowText(/^WORLD ZOOM$/, ZOOM_VALUE);
  h.check(zoom.text === zoomValue(loaded.worldZoom), 'and draws the stepped WORLD ZOOM', zoom.text);
  await h.shot('settings-after-reload');
  await leaveSettings(h);
  await h.waitForState('MENU');
};
