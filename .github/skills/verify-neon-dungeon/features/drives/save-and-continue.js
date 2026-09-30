// @ts-check
'use strict';

// Feature: save and continue (features/save-and-continue.md).
// Reaches floor 2, then proves the page-interruption save: walking alone does
// not save, hiding the page saves the new tile and auto-pauses, a reload
// (pagehide) saves the next tile, and RESUME SESSION restores floor, seed and
// that tile with the cheats off.

const SEED = 'VERIFY-SAVE-1';

/**
 * A FLOOR tile in the player's room at least `min` tiles (Manhattan) from
 * `from`, nearest first, so the walk stays inside the room. Read-only.
 * @param {{ from: { x: number, y: number }, min: number }} arg
 */
function floorTileAwayFrom(arg) {
  const map = game.dungeon.map;
  const p = game.player;
  const room = game.dungeon.rooms.find((/** @type {any} */ r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h);
  if (!room) return null;
  /** @type {{ x: number, y: number, d: number } | null} */
  let best = null;
  for (let y = room.y + 1; y < room.y + room.h - 1; y++) {
    for (let x = room.x + 1; x < room.x + room.w - 1; x++) {
      if (map[y][x] !== T.FLOOR) continue;
      const d = Math.abs(x - arg.from.x) + Math.abs(y - arg.from.y);
      if (d >= arg.min && (!best || d < best.d)) best = { x, y, d };
    }
  }
  return best && { x: best.x, y: best.y };
}

/** @param {any} save */
const savedTile = (save) => (save && save.player ? { x: Math.floor(save.player.x), y: Math.floor(save.player.y) } : null);
/** @param {{ x: number, y: number } | null} a @param {{ x: number, y: number } | null} b */
const sameTile = (a, b) => !!a && !!b && a.x === b.x && a.y === b.y;

/** @param {import('../../scripts/verify.js').Harness} h */
module.exports = async function saveAndContinue(h) {
  await h.bootRun({ seed: SEED });
  // Setup through the in-game FEET hatch so the stairs are a straight walk.
  await h.openCheats(['INVULNERABILITY', 'NO-CLIP', 'HYPER MODE']);
  const onFloor2 = await h.takeStairs();
  h.check(onFloor2.floor === 2 && onFloor2.seed === SEED, 'setup reached floor 2 on the chosen seed', onFloor2);

  // Read any queued prompt now, because reading a prompt also saves.
  const pending = (await h.visibleTexts()).some((t) => /PROMPT \[X\]$/.test(t.text));
  if (pending) {
    if (h.touch) await h.tapText(/PROMPT \[X\]$/);
    else await h.press('KeyX');
    await h.ackMessages();
  }
  const save0 = await h.storage('neonDungeonSave');
  const oldTile = savedTile(save0);
  h.check(save0 && save0.floor === 2 && !!oldTile, 'neonDungeonSave holds floor 2 with a player tile', oldTile);

  const tileA = await h.observe('a floor tile 3+ away', floorTileAwayFrom, { from: oldTile, min: 3 });
  h.check(tileA !== null, 'the arrival room has a floor tile 3+ tiles from the saved one', tileA);
  await h.walkTo(tileA.x, tileA.y);
  const unsaved = savedTile(await h.storage('neonDungeonSave'));
  h.check(sameTile(unsaved, oldTile), 'walking does not save: neonDungeonSave still holds the old tile', { saved: unsaved, oldTile, now: tileA });

  await h.step('hide the page (tab switch)', async () => {
    await h.setup('mark the page hidden and fire visibilitychange (headless Chromium cannot hide a page, so the event is synthesized)', () => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const hiddenSave = savedTile(await h.storage('neonDungeonSave'));
    h.check(sameTile(hiddenSave, tileA), 'hiding the page saved the new tile', { saved: hiddenSave, expected: tileA });
    const s = await h.waitForState('PAUSED', 3000);
    const note = await h.findText(/auto-paused/);
    h.check(s.state === 'PAUSED', `hiding the page auto-paused the run and the pause screen draws "${note.text}"`, s.state);
    await h.setup('mark the page visible again and fire visibilitychange', () => {
      delete (/** @type {any} */ (document)).visibilityState;
      delete (/** @type {any} */ (document)).hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await h.frames(2);
    h.check((await h.state()).state === 'PAUSED', 'coming back leaves the run paused until the player resumes');
    if (h.touch) await h.tapText(/^RESUME RUN$/);
    else await h.press('Escape');
    await h.waitForState('PLAYING');
  });

  const tileB = await h.observe('another floor tile 3+ away', floorTileAwayFrom, { from: tileA, min: 3 });
  h.check(tileB !== null, 'the room has another floor tile 3+ tiles away', tileB);
  await h.walkTo(tileB.x, tileB.y);
  const stillA = savedTile(await h.storage('neonDungeonSave'));
  h.check(sameTile(stillA, tileA), 'walking again does not save: neonDungeonSave still holds the hidden-page tile', { saved: stillA, tileA });

  const reloaded = await h.reload();
  h.check(reloaded.state === 'MENU' && reloaded.seed === null, 'after a reload the game is on MENU with no run in memory', reloaded);
  const save = await h.storage('neonDungeonSave');
  h.check(save && save.floor === 2 && save.runSeed === SEED && sameTile(savedTile(save), tileB),
    'the reload (pagehide) saved floor 2, the seed and the latest tile', { floor: save && save.floor, tile: savedTile(save), tileB });
  const row = await h.findText(/^▶ {2}RESUME SESSION/);
  h.check(row.text === '▶  RESUME SESSION (FLOOR 2 · NORMAL)', 'the menu draws RESUME SESSION (FLOOR 2 · NORMAL)', row.text);

  const picked = await h.menuSelect('RESUME SESSION');
  h.check(picked.state === 'PLAYING' || picked.state === 'SYSTEM_MESSAGE', 'RESUME SESSION goes straight back into the run', picked.state);
  await h.ackMessages();
  const resumed = await h.waitForState('PLAYING');
  h.check(resumed.floor === 2 && resumed.seed === SEED, 'the resumed run is on floor 2 with the same seed', resumed);
  const resumedTile = { x: Math.floor(resumed.x || 0), y: Math.floor(resumed.y || 0) };
  h.check(sameTile(resumedTile, tileB), 'the player resumes on the tile saved at reload', { resumedTile, tileB });
  const cheats = await h.observe('cheats after resume', () => Object.assign({}, game.cheats));
  h.check(!cheats.noClip && !cheats.invulnerable && !cheats.hyperMode, 'FEET cheats are runtime-only and are off after RESUME', cheats);
};
