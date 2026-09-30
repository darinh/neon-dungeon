# Floor-2 LOGIC TRIAL lattice

Floor 2 selects the LOGIC TRIAL kind: a 3×3 lattice of green nodes, two tiles
apart. It is placed only when a room fits it (see Sub-features). Entering the
room draws `LOGIC TRIAL: light all 9 nodes` and
`each node inverts itself + neighbours`. Pressing USE on a node flips that
node and its orthogonal neighbours between unlit and lit. Lighting all nine
draws `PROOF ACCEPTED · map disclosed · +XP`, reveals the floor map and
awards XP and score.

## Sub-features

| ID | Behavior | Drive `logic-lattice-trial` |
|---|---|---|
| `lattice-placement` | `trialKindForFloor` returns `lattice` for floor 2. `src/content/floor-generator.js` places it only in a room that is not the spawn or stairs room, has no other role, and fits the 5×5 footprint with a 1-tile margin and no key or whisper item on it (about lines 1237-1250). It drops the trial again if a later repair pass disturbs that footprint (about lines 1647-1659). It starts scrambled with 3 presses on floor 2. | Proved for seed `VERIFY-LATTICE-1` only |
| `lattice-hint` | Standing on a node draws `<Interact key>: invert node + neighbours · n/9`, using the current Interact binding (`deps.interactLabel()`, `E` by default). | Proved (drawn text, before and after a press) |
| `lattice-press` | USE inverts the node plus up, down, left and right. The corners of a centre press are untouched. Map tiles switch between `T.LOGIC_NODE` and `T.LOGIC_NODE_LIT`. | Proved |
| `lattice-leak` | After 10 presses without solving, `EVALUATOR LEAK: one proof node marked` is drawn and one node of the solution is highlighted. | Proved (the drawn message; the highlight ring is not checked) |
| `lattice-solve` | Nine lit nodes set `phase: 'solved'` and `rewardGranted: true`, reveal the floor layout and grant XP. | Proved |
| `lattice-stable` | Afterwards the node hint draws `PROOF ACCEPTED · lattice stable`, and pressing a node changes nothing. | Proved |
| level-up after the reward | The reward XP can level the player up into the perk choice (`PERK_CHOICE`). The drive then picks perk 1 (`Digit1` / tap `1`) and still checks the drawn hint. | Handled, but not reached by this seed |

## How to get to it (user POV)

- Reach floor 2 by the stairs on floor 1 (see [Descend stairs](descend-stairs.md)).
- Find the room with the nine green node tiles. The trial messages appear on
  entry.
- Stand on a node and press E on desktop, or tap the `E` (USE) button on
  touch.

## Driving it with verify.js

Preconditions:

- The server is launched and `doctor` passes.
- `h.bootRun({ seed: 'VERIFY-LATTICE-1' })` has run. At HEAD `afb39ac`, with
  runtime files unchanged through `e5d6f28`, this seed's floor-2 lattice has:
  - its centre at `16,16`;
  - a starting lit state of `[T,T,F,F,T,T,F,T,F]`;
  - the solution `[2,4,7]`.
- For setup, `h.openCheats(['INVULNERABILITY', 'NO-CLIP', 'HYPER MODE'])` and
  `h.takeStairs()` put the run on floor 2. Name the cheats in the report.

- **Ready-made proof.** Run
  `node .github/skills/verify-neon-dungeon/scripts/verify.js drive logic-lattice-trial --run-dir <RUN_DIR>`,
  then again with `--viewport phone --touch`. Both end
  `DRIVE PASS logic-lattice-trial-... steps=15/15 checks=15/15`.
- **Find the lattice.** Read it with `h.observe` from
  `game.dungeon.rooms.find(r => r.trial && r.trial.kind === 'lattice').trial`.
  `nodes` holds nine `{x,y}` in row-major order and `lit` holds nine booleans.
  If there is no lattice room, pick another seed.
- **Stand on the centre node.** `h.walkTo(nodes[4].x, nodes[4].y)`, so that
  `Math.floor(player.x) === node.x && Math.floor(player.y) === node.y`. The
  hint is drawn as `E: invert node + neighbours · 5/9` (the key from
  `KEY_DISPLAY(settings.keyMap.interact)`, the count from `lit`).
- **Press the node.** Press the Interact key, or on touch `h.tapText(/^E$/)`.
  Then:
  - `lit` equals the old `lit` with indices 1, 3, 4, 5 and 7 flipped, and 0,
    2, 6 and 8 unchanged;
  - the map tiles agree and `trial.presses` went up by 1;
  - the drawn hint shows the new count.
- **Reach the evaluator leak.** Press the same node 9 more times. Pairs
  cancel, so `lit` is back to its starting state with `presses === 10`, and
  `EVALUATOR LEAK: one proof node marked` is drawn.
- **Solve it.** Read the remaining presses with
  `NEON.trials.latticeRemainingSolution(trial)`. This is a read-only
  observation. For each index, `h.walkTo` the node and press USE. Afterwards:
  - all nine are lit, `phase === 'solved'` and `rewardGranted === true`;
  - the player is alive on floor 2 in `PLAYING` (or `PERK_CHOICE`, then
    perk 1);
  - `PROOF ACCEPTED · lattice stable` is drawn;
  - pressing USE again changes nothing.

## Gotchas

- Placement depends on a room fitting, so a seed can have no lattice. The
  ready-made drive fails its "has a LOGIC TRIAL lattice room" check instead
  of guessing.
- The drive reads the evaluator's remaining solution to choose which nodes to
  press. Only the navigation is observation-guided; every press is real
  input. Do not write `trial.lit` with `h.setup` to "solve" it.
- The hint is drawn only while the player stands exactly on a node tile:
  `Math.floor(player.x) === node.x && Math.floor(player.y) === node.y`.
  `walkTo` guarantees this.
- A node next to a closed door lets the door take the press. That does not
  happen for standard lattice placement, because the footprint keeps a
  1-tile margin.
- Floors 4 and 5 host the EXPLOIT (seam) and COOPERATION (relay) trials. They
  are not mapped yet.
