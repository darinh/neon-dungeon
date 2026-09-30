// @ts-check
'use strict';

// Feature: descending stairs (features/descend-stairs.md).
// Walks onto floor 1's STAIRS tile, checks the drawn hint, presses USE to
// enter THE GAP hub, descends by the drawn control, and proves floor 2
// loaded and autosaved.

const SEED = 'VERIFY-STAIRS-1';

function stairsTile() {
  const map = game.dungeon.map;
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) if (map[y][x] === T.STAIRS) return { x, y };
  }
  return null;
}

/** @param {string} s */
const literal = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** @param {import('../../scripts/verify.js').Harness} h */
module.exports = async function descendStairs(h) {
  const start = await h.bootRun({ seed: SEED });
  h.check(start.floor === 1, 'run starts on floor 1', start.floor);
  // Setup through the in-game FEET hatch: walk through walls, no damage, double speed.
  await h.openCheats(['INVULNERABILITY', 'NO-CLIP', 'HYPER MODE']);

  const stairs = await h.observe('STAIRS tile on floor 1', stairsTile);
  h.check(stairs !== null, 'floor 1 has a STAIRS tile', stairs);
  const onStairs = await h.walkTo(stairs.x, stairs.y);
  h.check(Math.floor(onStairs.x || 0) === stairs.x && Math.floor(onStairs.y || 0) === stairs.y, 'player stands on the stairs tile', onStairs);
  // The hint names the current Interact keybind (E by default).
  const key = await h.observe('Interact key label', () => KEY_DISPLAY(settings.keyMap.interact));
  const hint = await h.findText(new RegExp(`^Press ${literal(key)} to descend$`));
  h.check(hint.text === `Press ${key} to descend`, `the HUD draws "Press ${key} to descend"`, hint.text);

  await h.step('press USE on the stairs', async () => {
    if (h.touch) await h.tapText(/^E$/);
    else await h.press(await h.observe('Interact key code', () => settings.keyMap.interact));
    await h.waitForState('HUB');
    const title = await h.findText(/^THE GAP$/);
    const route = await h.findText(/^FLOOR \d+ → FLOOR \d+$/);
    h.check(title.text === 'THE GAP' && route.text === 'FLOOR 1 → FLOOR 2', 'USE on the stairs opens THE GAP, drawn as FLOOR 1 → FLOOR 2', route.text);
  });

  await h.step('descend from THE GAP', async () => {
    if (h.touch) {
      // The label must sit on the button the game hit-tests (NEON.hub.hitTestHub,
      // the same function platform.js routes hub taps through): its centre and
      // all four ink-box corners, so a label drawn half off the button fails.
      const label = await h.findText(/▼ DESCEND/);
      const b = label.box;
      const points = [label.logical, { x: b.left, y: b.top }, { x: b.right, y: b.top }, { x: b.left, y: b.bottom }, { x: b.right, y: b.bottom }];
      const hits = await h.observe('game hub hit-test at the drawn ▼ DESCEND label (centre, then ink-box corners)',
        (pts) => pts.map((/** @type {{ x: number, y: number }} */ p) => {
          const hit = NEON.hub.hitTestHub(game, p.x, p.y);
          return hit ? hit.kind : null;
        }), points);
      h.check(hits.every((/** @type {string | null} */ k) => k === 'descend'), 'the drawn ▼ DESCEND label lies inside the DESCEND button the game hit-tests',
        { hits, box: b });
      await h.tapText(/▼ DESCEND/);
    } else {
      const prompt = await h.findText(/\[SPACE\] DESCEND/);
      h.check(prompt.text.includes('[SPACE] DESCEND'), 'THE GAP draws [SPACE] DESCEND', prompt.text);
      await h.press('Space');
    }
    const s = await h.waitForState(['FADE', 'PLAYING', 'SYSTEM_MESSAGE']);
    h.check(s.state !== 'HUB', 'descending leaves the hub', s.state);
    await h.waitForState(['PLAYING', 'SYSTEM_MESSAGE'], 30000);
  });

  await h.ackMessages();
  const arrived = await h.waitForState('PLAYING');
  h.check(arrived.floor === 2, 'the run is now on floor 2', arrived.floor);
  h.check(arrived.seed === SEED, 'the run seed is unchanged', arrived.seed);
  const save = await h.storage('neonDungeonSave');
  h.check(save && save.floor === 2 && save.runSeed === SEED, 'floor-start autosave wrote floor 2 to neonDungeonSave', save && { floor: save.floor, runSeed: save.runSeed });
  const prompts = await h.observe('system prompts', () => game.systemMessages.entries.map((/** @type {any} */ e) => `${e.id}:${e.state}`));
  h.check(prompts.some((/** @type {string} */ p) => p.startsWith('floor-2-context-gap:')), 'floor 2 queued its floor-start system prompt', prompts);
};
