# NEON DUNGEON verification map

This directory is the maintained source for verifying NEON DUNGEON's
user-facing behavior. Read this index before driving the game. Then use the
matching feature file as the recipe, and its drive script under `drives/` as
the ready-to-run proof. Every command below runs from the worktree root.

## Baseline preconditions

- `npm ci` has run in the worktree, so `playwright-core` is installed. It
  downloads no browser. `doctor` prints which Chromium it resolved, with a
  `chromium-warn` row if it is not the revision playwright-core is pinned to.
- `node .github/skills/verify-neon-dungeon/scripts/verify.js launch` printed
  `READY <url>` and `RUN_DIR <dir>`.
- `node .github/skills/verify-neon-dungeon/scripts/verify.js doctor --run-dir <RUN_DIR>`
  ended `DOCTOR PASS`, with `game.state=MENU`, 0 unexpected errors and
  `appVersion=0.0.0-local`.
- Every drive starts in a fresh browser context with empty localStorage, on
  MENU. The main menu draws the rows `▶  BOOT SESSION 1 — NORMAL / SEED  ◀▶`,
  `▶  NEURAL ARCHIVES (0◆)` and `▶  SETTINGS`.
- Never drive or stop a run dir you did not launch. Parallel runs are fine:
  each launch has its own port and run dir.

## Driving conventions

- Drive through `h`, the harness passed to drive scripts, using real input:
  - `h.press(code)` and `h.type(text)` for keys;
  - `h.tapText(/label/)` to tap or click a drawn label, and `h.highlight(/label/, key)`
    to arrow through a menu until that label is drawn highlighted;
  - `h.menuSelect`, `h.bootRun`, `h.openCheats`, `h.walkTo`, `h.takeStairs`
    and `h.quitToMenu`, which are built from keys and taps.
- The canvas has no DOM handles. Find every labelled target by its drawn
  text: menu rows, dialog buttons, SETTINGS rows, `[ BACK ]`, the `E`/`II`
  touch buttons, `▼ DESCEND`, `CLOSE`, `SKIP…`. Use the game's own layout
  helpers and `h.tapLogical` only where nothing is drawn to aim at: the
  joystick, the right half of a stepper row, an intro tap. Do not hard-code
  pixels or copy layout constants.
- Check what the player sees. Assert hints, values and labels with
  `h.findText` or `h.rowText`, and use the model (`game.*`, `settings.*`) and
  `h.storage()` as additional evidence, not instead.
- Key names are `KeyboardEvent.code` values: `Enter`, `Escape`, `KeyE`,
  `KeyX`, `KeyS`, `KeyQ`, `Space`, `ArrowDown`, `Digit1`. Hints name the
  current Interact binding: build expected text from
  `KEY_DISPLAY(settings.keyMap.interact)` (`E` by default).
- Run each feature on `--viewport desktop` and on `--viewport phone --touch`.
- FEET cheats (`h.openCheats(['INVULNERABILITY', 'NO-CLIP', 'HYPER MODE'])`,
  typed F E E Shift) are allowed as setup to reach a later floor quickly.
  Name them in the report.
- `h.setup()` and code run through `h.page` are labelled `SETUP` in the
  transcript and are never proof. `h.observe()` is read-only by convention
  only.

## Proof and skip reporting

- Capture the user action and the resulting state. Wrap each action in
  `h.step(label, fn)`, which records state before and after and a screenshot
  afterwards. Take an explicit `h.shot()` before an action when the "before"
  picture matters.
- Assert with `h.check(cond, msg, detail)` against literal expected values:
  drawn text, `game.state`, `game.floor`, `game.runSeed`, layout numbers.
- Read back side effects with `h.storage('neonDungeonSave' | 'neonDungeonSettings' | 'neonDungeonMeta')`.
  When persistence is the claim, prove it survives `h.reload()`.
- A drive proves a feature only when all of these hold: `DRIVE PASS`, every
  check and step passed, 0 page errors, 0 console errors and 0 HTTP errors.
  The evidence is in `<RUN_DIR>/<name>/`: `transcript.json`, PNGs,
  `console.log`, `blocked-requests.txt`, `storage.json` and `summary.json`.
- Report the viewports and entry points you drove. Do not report a touch
  entry point, or a documented-only sub-feature below, as verified because
  another path passed.
- If a path cannot be reached, report the command, the state it stopped in,
  and the unmet precondition.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the
user-visible behavior. It then has exactly four H2 sections, in this order.

1. `Sub-features` is a table with one row per behavior. Each row gives the
   behavior's short ID, what it is, and whether the ready-made drive proves
   it or it is documented only.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with verify.js` starts with `Preconditions:`, then labeled
   bullets. Each bullet pairs a player action with the exact harness call and
   the observable result.
4. `Gotchas` lists traps that can waste or invalidate a run.

## Features and what their drives prove

Each drive runs on `--viewport desktop` and `--viewport phone --touch` with
the command
`node .github/skills/verify-neon-dungeon/scripts/verify.js drive <drive> --run-dir <RUN_DIR> [--viewport phone --touch]`.

| Feature | Drive | Proved by the drive | Documented only |
|---|---|---|---|
| [Start a seeded run](start-seeded-run.md) | `start-seeded-run` | seed-open, seed-edit, seed-randomize, seed-back, seed-start, seed-save, seed-determinism | seed-difficulty |
| [Pause menu and settings](pause-and-settings.md) | `pause-and-settings` | pause-open, pause-resume, settings-from-pause, settings-toggle (SCREEN SHAKE only), settings-stepper (WORLD ZOOM only), settings-persist, settings-from-menu; pause-quit is proved by `start-seeded-run` | the other toggles and steppers, settings-volume, settings-rebind, settings-reset |
| [Save and continue](save-and-continue.md) | `save-and-continue` | save-floor-start, save-not-on-walk, save-page-hide (event synthesized as SETUP), save-pagehide (real reload), resume-row, resume-restore, resume-cheats-reset | resume-prompts, resume-corrupt |
| [Descend stairs](descend-stairs.md) | `descend-stairs` | stairs-hint, stairs-use, hub-descend, floor-autosave, floor-prompt | hub-terminals, boss-core |
| [Floor-2 LOGIC TRIAL lattice](logic-lattice-trial.md) | `logic-lattice-trial` | lattice-placement (seed `VERIFY-LATTICE-1`), lattice-hint, lattice-press, lattice-leak, lattice-solve, lattice-stable | the level-up perk branch after the reward (handled if it appears; not reached by this seed) |

Not mapped yet: NEURAL ARCHIVES, THE GAP terminals (UPGRADE MATRIX, MODULE
SLOTS, ARMORY, ARCHIVE), combat and pickups, the EXPLOIT (floor 4) and
COOPERATION (floor 5) trials, boss floors, and the ending or name entry.
