# Start a seeded run

A player chooses BOOT SESSION on the main menu and types a run seed on the RUN
SEED screen. START then plays the intro (on a profile's first run only) and
one RUNTIME SYSTEM PROMPT, and drops the player on floor 1. The same seed and
difficulty rebuild the same generated run, and the run is written to
`neonDungeonSave` straight away.

## Sub-features

| ID | Behavior | Drive `start-seeded-run` |
|---|---|---|
| `seed-open` | BOOT SESSION opens RUN SEED (`SEED_SETUP`). | Proved |
| `seed-edit` | The field starts with a random `XXXX-XXXX-XXXX` seed. Backspace deletes and typing appends (allowed characters are `A-Z a-z 0-9 space _ . - :`, up to 64). The field draws what was typed. | Proved (the drawn field is checked inside `bootRun`) |
| `seed-randomize` | RANDOMIZE rerolls the field and draws the new seed. | Proved |
| `seed-back` | BACK (touch) or Escape (desktop) returns to MENU without starting a run. | Proved |
| `seed-start` | START runs INTRO (first run of a profile only), then the `boot-inventory` system prompt, then PLAYING on floor 1 with `game.runSeed` set. | Proved; the prompt is proved archived as read in the save |
| `seed-save` | `neonDungeonSave` gets `runSeed` and `floor: 1`, and `neonDungeonMeta.introSeen` becomes true. | Proved |
| `seed-determinism` | The same seed rebuilds the same floor 1 map, stairs and spawn; a different seed builds a different floor. | Proved |
| `seed-difficulty` | ◀▶ on the BOOT SESSION row cycles difficulty; a locked NIGHTMARE draws `CLEAR HARD TO UNLOCK NIGHTMARE`. | Documented only |

## How to get to it (user POV)

- Desktop: on the main menu, arrow to `▶  BOOT SESSION 1 — NORMAL / SEED  ◀▶`
  and press Enter. The row is first on a fresh profile, and second when a
  saved run adds `RESUME SESSION` above it.
- Touch: tap the centre of the BOOT SESSION row. The outer 35% on each side
  cycles difficulty instead.
- On RUN SEED on desktop, type straight away. On touch, tap the drawn seed to
  raise the phone keyboard (a hidden `<input aria-label="Run seed">`), then
  tap `START`.

## Driving it with verify.js

Preconditions:

- The server is launched and `doctor --run-dir <RUN_DIR>` shows `DOCTOR PASS`.
- The drive has a fresh context: no `neonDungeonSave`, and
  `neonDungeonMeta.introSeen` unset.

- **Ready-made proof.** Run
  `node .github/skills/verify-neon-dungeon/scripts/verify.js drive start-seeded-run --run-dir <RUN_DIR> --viewport desktop`,
  then again with `--viewport phone --touch`. Both end
  `DRIVE PASS start-seeded-run-... steps=11/11 checks=17/17` with
  `pageErrors=0`.
- **Open RUN SEED.** Choose BOOT SESSION with
  `await h.menuSelect('BOOT SESSION')`. `game.state` becomes `SEED_SETUP`.
- **Randomize, then go back.** Select RANDOMIZE and activate it:
  - desktop: `h.highlight(/^RANDOMIZE$/, 'ArrowRight')` then `h.press('Enter')`;
  - touch: `h.tapText(/^RANDOMIZE$/)`.

  `game.seedSetup.seed` changes to a new `XXXX-XXXX-XXXX` value, and
  `h.findText(new RegExp('^' + seed + '[_ ]?$'))` finds it drawn in the
  field. Then Escape, or `h.tapText(/^BACK$/)` on touch, returns to `MENU`
  with no run started.
- **Replace the seed and start.** `h.bootRun({ seed: 'VERIFY-SEED-1' })` does
  the rest:
  - clear the field with Backspace (on touch, after
    `h.tapText(<drawn seed>)` has focused the `Run seed` input);
  - type the seed and check it is drawn;
  - START (`highlight` + Enter, or `tapText(/^START$/)`);
  - Escape past INTRO (touch: tap through it);
  - acknowledge the prompt with `X` or `TAP ACK`.

  The state ends as `PLAYING`, with `floor === 1` and
  `seed === 'VERIFY-SEED-1'`.
- **Check the save.** Read the keys back with `h.storage('neonDungeonSave')`
  and `h.storage('neonDungeonMeta')`:
  - `runSeed` is `VERIFY-SEED-1` and `floor` is 1;
  - `systemMessages.entries` has `boot-inventory` with state `read`;
  - `introSeen` is true.
- **Prove determinism.** Hash `game.dungeon.map` and record the `T.STAIRS`
  tile and spawn tile with `h.observe`. Then `h.quitToMenu()` and boot the
  same seed again, and the values are identical. At HEAD `afb39ac`, with
  runtime files unchanged through `e5d6f28`, `VERIFY-SEED-1` gives mapHash
  `d3ac111e`, stairs `63,13` and spawn `10,32`. `VERIFY-SEED-2` differs:
  `e29416c3`, `63,7`, `4,4`.

## Gotchas

- On a fresh page the first Enter or tap on MENU is swallowed as the
  title-music unlock gesture. The transcript notes it and `menuSelect`
  activates again. Hand-written input must repeat the activation.
- The field is never empty on arrival. Delete the prefilled seed before
  typing, or the typed text is appended to it.
- Typing W, A, S or D into the seed does not move the selection, because
  letter navigation is off in any frame that typed characters. Arrow keys
  still navigate.
- The middle button (RANDOMIZE) is centred exactly on the screen's centre
  column. `highlight` reads the selection from the button row, whose unselected
  labels share one colour, not from that column.
- INTRO plays only while `neonDungeonMeta.introSeen` is false. Later boots in
  the same context go straight to the system prompt.
- Once meta progress exists (shards, cores, completed runs), START shows a
  `KEEP UNLOCKS / RESET META` dialog on MENU first. `bootRun` keeps unlocks
  (Enter / `tapText(/KEEP UNLOCKS/)`). No mapped drive reaches that dialog
  without SETUP.
- `h.quitToMenu()` keeps the save, so the menu gains `RESUME SESSION` as row
  0 and BOOT SESSION moves to row 1. `menuSelect` finds rows by label, so it
  is unaffected.
