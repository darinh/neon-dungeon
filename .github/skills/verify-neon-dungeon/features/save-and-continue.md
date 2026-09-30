# Save and continue

A run in progress is saved to `neonDungeonSave` at specific moments:

- when a floor starts;
- when a system prompt is queued, delivered or read;
- when the page is hidden or closed.

Walking alone does not save. After a reload or a return visit, the main
menu's first row is `RESUME SESSION (FLOOR n · DIFFICULTY)`. Choosing it puts
the player back on the same floor, seed and tile, without the intro. Runtime
cheats are not restored.

## Sub-features

| ID | Behavior | Drive `save-and-continue` |
|---|---|---|
| `save-floor-start` | Loading a floor autosaves floor, seed, RNG streams, player stats and a floor snapshot. | Proved (floor 2 after the stairs) |
| `save-not-on-walk` | Moving around does not write the save. | Proved (twice) |
| `save-page-hide` | `visibilitychange` to hidden saves the run and auto-pauses PLAYING; the pause screen draws `(auto-paused — focus lost)`, and the run stays paused when the page is visible again. | Proved, but the event is synthesized as SETUP because headless Chromium cannot hide a page |
| `save-pagehide` | `pagehide` / `beforeunload` (closing or reloading the tab) save the run while `game.state` is a run state. | Proved with a real reload |
| `resume-row` | MENU draws `▶  RESUME SESSION (FLOOR n · NORMAL)` as row 0 whenever `neonDungeonSave` exists. | Proved |
| `resume-restore` | RESUME SESSION restores `game.floor`, `game.runSeed`, difficulty and the saved player tile. | Proved |
| `resume-cheats-reset` | FEET cheats (noClip and the rest) are off after resume. They are never saved. | Proved |
| `resume-prompts` | Unread system prompts reopen on resume. | Documented only; the drive reads the pending floor-2 prompt before the save test |
| `resume-corrupt` | A save with the wrong version or no player is deleted and a fresh run starts with `SAVE DATA CORRUPT — STARTED FRESH`. | Documented only |

## How to get to it (user POV)

- Play past the first floor, then switch away from the tab or close or reload
  it. Quitting to the menu from pause also keeps the save.
- On the main menu, choose row 0, `RESUME SESSION (FLOOR 2 · NORMAL)`: arrows
  plus Enter on desktop, or tap it on touch.

## Driving it with verify.js

Preconditions:

- The server is launched and `doctor` passes.
- The drive has a fresh context, so there is no save until the drive makes
  one.
- The setup uses FEET cheats (`INVULNERABILITY`, `NO-CLIP`, `HYPER MODE`) so
  the walk to the stairs is a straight line. Say so in the report.

- **Ready-made proof.** Run
  `node .github/skills/verify-neon-dungeon/scripts/verify.js drive save-and-continue --run-dir <RUN_DIR>`,
  then again with `--viewport phone --touch`. Both end
  `DRIVE PASS save-and-continue-... steps=9/9 checks=16/16 setups=2`.
- **Reach floor 2.** `h.bootRun({ seed: 'VERIFY-SAVE-1' })`,
  `h.openCheats(['INVULNERABILITY', 'NO-CLIP', 'HYPER MODE'])`, then
  `h.takeStairs()`.
- **Settle prompts first.** If `PROMPT [X]` is drawn, open it with `X` (or
  tap it) and `h.ackMessages()`, because reading a prompt also saves.
  `neonDungeonSave` now holds floor 2 and the current tile.
- **Walk without saving.** `h.walkTo` a FLOOR tile at least 3 tiles away in
  the same room. `neonDungeonSave` still holds the old tile.
- **Hide the page.** This is a SETUP step:
  `h.setup(...)` defines `document.visibilityState` as `'hidden'` and
  dispatches `visibilitychange`. Then:
  - `neonDungeonSave` holds the new tile;
  - `game.state` is `PAUSED`, and `h.findText(/auto-paused/)` finds
    `(auto-paused — focus lost)`;
  - making the page visible again (a second SETUP) leaves the run `PAUSED`
    until Escape or `RESUME RUN`.
- **Walk again, then reload.** `h.walkTo` another tile; the save still holds
  the hidden-page tile. `h.reload()` then lands on `MENU` with no run in
  memory, and `neonDungeonSave` holds floor 2, the seed and the newest tile.
  That save was written by `pagehide`.
- **Resume.** `h.findText(/^▶ {2}RESUME SESSION/)` reads
  `▶  RESUME SESSION (FLOOR 2 · NORMAL)`. `h.menuSelect('RESUME SESSION')`
  leads to `PLAYING` on floor 2 with the same seed, and
  `floor(x), floor(y)` equals the tile saved at reload. `game.cheats` has
  every flag false.

## Gotchas

- Headless Chromium keeps `document.visibilityState` at `visible` through tab
  switches, window minimising and a CDP lifecycle freeze. The hidden-page
  step therefore synthesizes the event as labelled SETUP. It proves the
  game's handler, not the browser's visibility plumbing. The reload step is
  the real-browser proof of the page-interruption save.
- Both page-interruption paths call `saveRunForPageInterruption`. A regression
  there fails the hidden-page check and the reload check.
- `h.reload()` keeps the context and its localStorage, which is what a player
  reopening the tab sees. A new `drive` always starts empty, so a save never
  carries over between drives.
- Saves on page interruption happen only in run states. Hiding or reloading
  from MENU, or from SETTINGS reached from the menu, does not touch the save.
- The save keeps the player's raw float position. If the save happens while
  the player is inside a wall without noClip, `playerSavePosition` moves it
  to a safe tile. Compare tiles with `Math.floor`, and pick FLOOR tiles as
  walk targets.
- A modifier banner (for example `CORROSIVE`) is not replayed on resume. It
  shows only on a fresh floor transition.
