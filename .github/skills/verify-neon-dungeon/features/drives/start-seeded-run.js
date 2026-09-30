// @ts-check
'use strict';

// Feature: start a seeded run (features/start-seeded-run.md).
// Rerolls and backs out of the RUN SEED screen, then boots the same seed twice
// and a different seed once through the main menu and RUN SEED screen, and
// proves the seed drove generation.

const SEED = 'VERIFY-SEED-1';
const OTHER_SEED = 'VERIFY-SEED-2';

// Read-only fingerprint of the generated floor: map hash, stairs tile, spawn.
function floorFingerprint() {
  const map = game.dungeon.map;
  let hash = 2166136261;
  /** @type {string | null} */
  let stairs = null;
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      hash = Math.imul(hash ^ (map[y][x] + 1), 16777619) >>> 0;
      if (map[y][x] === T.STAIRS) stairs = `${x},${y}`;
    }
  }
  return {
    mapHash: hash.toString(16),
    stairs,
    spawn: `${Math.floor(game.player.x)},${Math.floor(game.player.y)}`,
    rooms: game.dungeon.rooms.length,
  };
}

/** @param {import('../../scripts/verify.js').Harness} h */
module.exports = async function startSeededRun(h) {
  await h.step('main menu is up', async () => {
    const s = await h.waitForState('MENU');
    h.check(s.seed === null, 'no run is active on a fresh profile', s);
    h.check(await h.storage('neonDungeonSave') === null, 'fresh profile has no neonDungeonSave');
  });

  await h.step('RANDOMIZE rerolls the seed and BACK returns to MENU', async () => {
    await h.menuSelect('BOOT SESSION');
    await h.waitForState('SEED_SETUP');
    const before = await h.observe('seed in the field', () => String(game.seedSetup.seed));
    if (h.touch) {
      await h.tapText(/^RANDOMIZE$/);
    } else {
      await h.highlight(/^RANDOMIZE$/, 'ArrowRight', { max: 3 });
      await h.press('Enter');
    }
    const after = await h.observe('seed after RANDOMIZE', () => ({ seed: String(game.seedSetup.seed), state: String(game.state) }));
    h.check(after.state === 'SEED_SETUP' && after.seed !== before && /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(after.seed),
      'RANDOMIZE puts a new XXXX-XXXX-XXXX seed in the field', { before, after: after.seed });
    const drawn = await h.findText(new RegExp(`^${after.seed}[_ ]?$`));
    h.check(drawn.text.startsWith(after.seed), 'the field draws the new seed', drawn.text);
    if (h.touch) await h.tapText(/^BACK$/);
    else await h.press('Escape');
    const s = await h.waitForState('MENU');
    h.check(s.state === 'MENU' && s.seed === null, 'BACK (touch) or Escape (desktop) returns to MENU without starting a run', s);
  });

  const first = await h.bootRun({ seed: SEED });
  h.check(first.state === 'PLAYING', 'BOOT SESSION with a typed seed reaches PLAYING', first);
  h.check(first.seed === SEED, `game.runSeed is the typed seed ${SEED}`, first.seed);
  h.check(first.floor === 1 && first.hp !== null && first.hp > 0, 'the run starts on floor 1 with a live player', first);
  const save = await h.storage('neonDungeonSave');
  h.check(save && save.runSeed === SEED && save.floor === 1, 'neonDungeonSave records the seed and floor 1', save && { runSeed: save.runSeed, floor: save.floor });
  const bootPrompt = save && save.systemMessages && save.systemMessages.entries.find((/** @type {any} */ e) => e.id === 'boot-inventory');
  h.check(bootPrompt && bootPrompt.state === 'read', 'the boot-inventory system prompt was shown and archived as read', bootPrompt);
  const meta = await h.storage('neonDungeonMeta');
  h.check(meta && meta.introSeen === true, 'neonDungeonMeta.introSeen is true after the intro', meta && meta.introSeen);
  const fp1 = await h.observe('floor 1 fingerprint, first boot', floorFingerprint);

  await h.quitToMenu();
  const menu = await h.observe('menu rows after quitting', () => game.getMenuOptions().map((/** @type {any} */ o) => String(o.label)));
  h.check(/^RESUME SESSION \(FLOOR 1/.test(menu[0] || ''), 'MENU now offers RESUME SESSION for the saved run', menu);

  const second = await h.bootRun({ seed: SEED });
  h.check(second.seed === SEED && second.floor === 1, 'second boot with the same seed is on floor 1', second);
  const fp2 = await h.observe('floor 1 fingerprint, same seed again', floorFingerprint);
  h.check(fp2.mapHash === fp1.mapHash && fp2.stairs === fp1.stairs && fp2.spawn === fp1.spawn,
    'the same seed rebuilds the same floor (map, stairs, spawn)', { fp1, fp2 });

  await h.quitToMenu();
  const third = await h.bootRun({ seed: OTHER_SEED });
  h.check(third.seed === OTHER_SEED, `game.runSeed is ${OTHER_SEED}`, third.seed);
  const fp3 = await h.observe('floor 1 fingerprint, different seed', floorFingerprint);
  h.check(fp3.mapHash !== fp1.mapHash, 'a different seed builds a different floor', { fp1, fp3 });
  const save3 = await h.storage('neonDungeonSave');
  h.check(save3 && save3.runSeed === OTHER_SEED, 'neonDungeonSave now records the new seed', save3 && save3.runSeed);
};
