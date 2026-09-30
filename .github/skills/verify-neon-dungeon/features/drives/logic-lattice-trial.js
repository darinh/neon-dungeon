// @ts-check
'use strict';

// Feature: floor-2 LOGIC TRIAL lattice (features/logic-lattice-trial.md).
// Reaches floor 2, presses USE on the centre node and proves it inverted
// itself and its four neighbours, presses it to ten for the evaluator leak,
// solves the lattice, and proves the reward and that a solved node is inert.

const SEED = 'VERIFY-LATTICE-1';

function latticeState() {
  const room = game.dungeon.rooms.find((/** @type {any} */ r) => r.trial && r.trial.kind === 'lattice');
  if (!room) return null;
  const tr = room.trial;
  return {
    nodes: tr.nodes.map((/** @type {{ x: number, y: number }} */ n) => ({ x: n.x, y: n.y })),
    lit: tr.lit.slice(),
    tiles: tr.nodes.map((/** @type {{ x: number, y: number }} */ n) => game.dungeon.map[n.y][n.x] === T.LOGIC_NODE_LIT),
    presses: tr.presses,
    phase: tr.phase,
    rewardGranted: tr.rewardGranted,
    remaining: NEON.trials.latticeRemainingSolution(tr),
  };
}

/** @param {string} s */
const literal = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Presses USE where the player stands: the Interact key, or the USE button on touch.
 * @param {import('../../scripts/verify.js').Harness} h
 * @param {string} label
 * @param {number} [times]
 */
async function pressUse(h, label, times = 1) {
  const key = h.touch ? '' : await h.observe('Interact key code', () => settings.keyMap.interact);
  await h.step(label, async () => {
    for (let i = 0; i < times; i++) {
      if (h.touch) await h.tapText(/^E$/);
      else await h.press(key);
    }
  });
}

/** @param {import('../../scripts/verify.js').Harness} h */
module.exports = async function logicLatticeTrial(h) {
  await h.bootRun({ seed: SEED });
  await h.openCheats(['INVULNERABILITY', 'NO-CLIP', 'HYPER MODE']);
  const f2 = await h.takeStairs();
  h.check(f2.floor === 2, 'setup reached floor 2', f2.floor);

  const before = await h.observe('lattice before any press', latticeState);
  h.check(before !== null, `floor 2 of seed ${SEED} has a LOGIC TRIAL lattice room`, before);
  h.check(before.lit.filter(Boolean).length < 9, 'the lattice starts scrambled', before.lit);
  // Hints name the current Interact keybind (E by default).
  const key = await h.observe('Interact key label', () => KEY_DISPLAY(settings.keyMap.interact));
  /** @param {number} lit */
  const nodeHint = (lit) => `${key}: invert node + neighbours · ${lit}/9`;

  const centre = before.nodes[4];
  await h.walkTo(centre.x, centre.y);
  const hint = await h.findText(new RegExp(`^${literal(key)}: invert node \\+ neighbours · \\d/9$`));
  h.check(hint.text === nodeHint(before.lit.filter(Boolean).length), 'standing on a node draws the hint with the lit count', hint.text);

  await pressUse(h, 'press USE on the centre node');
  const after = await h.observe('lattice after the centre press', latticeState);
  const flipped = [1, 3, 4, 5, 7];
  const expected = before.lit.map((/** @type {boolean} */ v, /** @type {number} */ i) => (flipped.includes(i) ? !v : v));
  h.check(JSON.stringify(after.lit) === JSON.stringify(expected), 'the centre press inverted nodes 1,3,4,5,7 and left the corners alone', { before: before.lit, after: after.lit });
  h.check(JSON.stringify(after.tiles) === JSON.stringify(after.lit), 'map tiles match the lit state (LOGIC_NODE_LIT vs LOGIC_NODE)', after.tiles);
  h.check(after.presses === before.presses + 1, 'the trial counted one press', after.presses);
  const hintAfter = await h.findText(new RegExp(`^${literal(nodeHint(after.lit.filter(Boolean).length))}$`));
  h.check(!!hintAfter, 'the drawn hint shows the new lit count', hintAfter.text);

  await pressUse(h, 'press the centre node 9 more times', 9);
  const tenth = await h.observe('lattice after ten presses', latticeState);
  h.check(tenth.presses === 10 && JSON.stringify(tenth.lit) === JSON.stringify(before.lit), 'ten presses on one node count 10 and cancel out', { presses: tenth.presses, lit: tenth.lit });
  const leak = await h.findText(/^EVALUATOR LEAK: one proof node marked$/);
  h.check(!!leak, 'the tenth press draws "EVALUATOR LEAK: one proof node marked"', leak.text);

  for (const idx of tenth.remaining) {
    const node = tenth.nodes[idx];
    await h.walkTo(node.x, node.y);
    await pressUse(h, `press USE on node ${idx}`);
  }
  const solved = await h.observe('lattice after solving', latticeState);
  h.check(solved.lit.every(Boolean) && solved.tiles.every(Boolean), 'all nine nodes are lit', solved.lit);
  h.check(solved.rewardGranted === true && solved.phase === 'solved', 'the trial is marked solved and rewarded', { phase: solved.phase, rewardGranted: solved.rewardGranted });

  const s = await h.state();
  h.check((s.state === 'PLAYING' || s.state === 'PERK_CHOICE') && s.floor === 2 && (s.hp || 0) > 0,
    'solving leaves a live player on floor 2, in play or in the level-up perk choice', s);
  if (s.state === 'PERK_CHOICE') {
    await h.step('take the level-up perk', async () => {
      if (h.touch) await h.tapText(/^1$/);
      else await h.press('Digit1');
      await h.waitForState('PLAYING');
    });
  }
  const stable = await h.findText(/^PROOF ACCEPTED · lattice stable$/);
  h.check(!!stable, 'the node hint now draws "PROOF ACCEPTED · lattice stable"', stable.text);

  await pressUse(h, 'press USE on a node of the solved lattice');
  const inert = await h.observe('lattice after pressing a solved node', latticeState);
  h.check(inert.presses === solved.presses && JSON.stringify(inert.lit) === JSON.stringify(solved.lit), 'pressing a solved node changes nothing', { presses: inert.presses });
};
