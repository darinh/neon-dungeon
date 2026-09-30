# Pause menu and settings

During a run the player can pause, resume, quit to the main menu, or open
SETTINGS. SETTINGS holds volume sliders, six on/off toggles, three scale
steppers (MINIMAP SIZE, TEXT SIZE, WORLD ZOOM), key rebinds, RESET TO
DEFAULTS and BACK. Every change is saved to `neonDungeonSettings` at once and
survives a reload. SETTINGS is also reachable from the main menu.

## Sub-features

| ID | Behavior | Drive `pause-and-settings` |
|---|---|---|
| `pause-open` | Escape (desktop) or the `II` PAUSE button (touch) turns PLAYING into PAUSED, which draws its options (`S   — Settings` / `SETTINGS`). | Proved |
| `pause-resume` | Escape or `RESUME RUN` returns to PLAYING. | Proved |
| `pause-quit` | `Q` or `QUIT TO MENU` goes to MENU and keeps the run save. | Proved by `start-seeded-run` (`quitToMenu`), not by this drive |
| `settings-from-pause` | `S` or `SETTINGS` opens SETTINGS with `game._settingsFrom === 'PAUSED'`; leaving returns to PAUSED. | Proved |
| `settings-toggle` | Rows 2-7 (SCREEN SHAKE, DAMAGE NUMBERS, LOCK AIM TO MOVE, AIM ASSIST, CRT MODE, REDUCED MOTION) flip on Enter, ◀▶ or a tap, and draw `◀ ON ▶` / `◀ OFF ▶`. | Proved for SCREEN SHAKE only |
| `settings-stepper` | Rows 8-10 (MINIMAP SIZE, TEXT SIZE, WORLD ZOOM) step through fixed values drawn as `◀ 1.25× ▶`. WORLD ZOOM (1, 1.25, 1.5, 1.75, 2, 2.5) re-runs `resize()`, so the logical `W` and `H` shrink as zoom grows. | Proved for WORLD ZOOM only |
| `settings-persist` | Every change calls `settings.save()`, and the values load again after a reload. | Proved (drawn after reload, plus storage) |
| `settings-from-menu` | The MENU row `SETTINGS` opens the same screen, and leaving returns to MENU. | Proved |
| `settings-volume` | Rows 0-1 (SFX, MUSIC) change in 5% steps with ◀▶, or by tapping or dragging the track. | Documented only |
| `settings-rebind` | Rows 11-19 capture the next key on Enter or tap. A key bound to another action swaps with it. Escape cancels. | Documented only |
| `settings-reset` | Row 20 RESET TO DEFAULTS arms on the first press (`[ PRESS AGAIN TO CONFIRM ]`) and resets on a second press within 3 s. | Documented only |

## How to get to it (user POV)

- Desktop, in a run: press Escape to pause. The pause menu draws
  `ESC — Resume`, `S   — Settings` and `Q   — Quit to Menu`: press `S`, `Q`,
  or Escape to resume.
- Touch, in a run: tap the pink `II` PAUSE button at the top right, then tap
  `RESUME RUN`, `SETTINGS` or `QUIT TO MENU`.
- Main menu: choose the last row, `SETTINGS`.
- In SETTINGS, arrow to a row (the selected label is drawn in cyan), change
  values with ◀▶ or Enter, and leave with Escape or `Q`. On touch, tap a row
  label to toggle it. A stepper steps down on the left half of its row and up
  on the right half. Tap `[ BACK ]` to leave.

## Driving it with verify.js

Preconditions:

- The server is launched and `doctor` passes.
- The drive has a fresh context, so first launch saves default settings:
  `screenShake: true`, and `worldZoom` 1 on desktop or 1.5 on a compact
  phone.
- Get a run with `h.bootRun({ seed: 'VERIFY-SETTINGS-1' })`.

- **Ready-made proof.** Run
  `node .github/skills/verify-neon-dungeon/scripts/verify.js drive pause-and-settings --run-dir <RUN_DIR>`,
  then again with `--viewport phone --touch`. Both end
  `DRIVE PASS pause-and-settings-... steps=8/8 checks=15/15`.
- **Pause.** Press Escape with `h.press('Escape')`, or on touch
  `h.tapText(/^II$/)`. `game.state` becomes `PAUSED`, and
  `h.findText(/— Settings$/)` (desktop) or `h.findText(/^SETTINGS$/)`
  (touch) finds the option drawn.
- **Open SETTINGS.** Press S with `h.press('KeyS')`, or on touch
  `h.tapText(/^SETTINGS$/)`. `game.state` becomes `SETTINGS`, the row labels
  are drawn, and `game._settingsFrom` is `'PAUSED'`.
- **Turn SCREEN SHAKE off.** Before the change,
  `h.rowText(/^SCREEN SHAKE$/, /^◀ (ON|OFF) ▶$/)` is `◀ ON ▶`. `rowText`
  accepts the value only in the row's value column: right of the label, and
  inside the band mirrored from the label's left edge. Toggle it:
  - keyboard: `h.highlight(/^SCREEN SHAKE$/, 'ArrowDown')`, then
    `h.press('Enter')`;
  - touch: `h.tapText(/^SCREEN SHAKE$/)`.

  The row then draws `◀ OFF ▶`, and
  `h.storage('neonDungeonSettings').screenShake === false`.
- **Step WORLD ZOOM up.** The row draws the current zoom, for example
  `◀ 1.00× ▶`. Step it:
  - keyboard: `h.highlight(/^WORLD ZOOM$/, 'ArrowDown')`, then
    `h.press('ArrowRight')`;
  - touch: `h.findText(/^WORLD ZOOM$/)`, then
    `h.tapLogical(W * 0.75, found.logical.y)`.

  On desktop `W×H` goes from `960×600` at zoom 1 to `768×480` at zoom 1.25.
  On the phone it goes from `371×804` at 1.5 to `318×689` at 1.75. The row
  draws the new zoom, and `neonDungeonSettings.worldZoom` equals it.
- **Leave.** Press Escape, or on touch `h.tapText(/^\[ BACK \]$/)`. The game
  returns to `PAUSED`. Escape again, or `h.tapText(/^RESUME RUN$/)`, returns
  to `PLAYING`.
- **Prove persistence.** Call `h.reload()`. `settings.screenShake` is
  `false`, and `settings.worldZoom` is the stepped value. Then
  `h.menuSelect('SETTINGS')`, and the rows draw `◀ OFF ▶` and the stepped
  zoom.

## Gotchas

- `game._settingsSel` survives within a page session. Navigate with
  `h.highlight`, which reads the drawn selection, instead of assuming row 0.
- On a non-touch device, `updatePaused()` recomputes the pause highlight from
  the mouse position every frame (`pauseOptionAt`). Arrow keys therefore
  cannot move it, and Enter acts only on the option under the pointer. The
  keyboard path is `Escape`, `S` and `Q`. This comes from reading the code;
  the arrows-plus-Enter path is not driven.
- A WORLD ZOOM change resizes the logical canvas at once. Drawn positions from
  before the change are stale; `findText` and `rowText` always read the
  latest frame.
- The first RESET TO DEFAULTS press only arms it: the row reads
  `[ PRESS AGAIN TO CONFIRM ]` for 3 s. Moving the selection or clicking
  elsewhere disarms it.
- **Known game layout defect: values drawn over their labels.** This is a
  game bug, tracked separately. `rowText` fails on such a row with
  `value overlaps its label: <label box> vs <value box>, a game layout defect
  at this viewport`, and the check is deliberately not loosened. Measured at
  HEAD `2bb212d` from the drawn text boxes, on MENU → SETTINGS at each world
  zoom:
  - `--viewport 320x568` (W=305 at its default zoom 1.5): DAMAGE NUMBERS,
    LOCK AIM TO MOVE and REDUCED MOTION. From zoom 1.75 (W=261) also SCREEN
    SHAKE, MINIMAP SIZE and WORLD ZOOM. At 2.0 every toggle and stepper row
    except CRT MODE, and at 2.5 all of them.
  - `--viewport phone` (390x844): LOCK AIM TO MOVE from zoom 1.75 (W=318).
    At 2.0 (W=279) also DAMAGE NUMBERS, REDUCED MOTION and MINIMAP SIZE. At
    2.5 (W=223) every toggle and stepper row except CRT MODE.
  - `--viewport desktop` (1280x800): at zoom 2.5 (W=384), DAMAGE NUMBERS,
    LOCK AIM TO MOVE, REDUCED MOTION and MINIMAP SIZE.
  - `--viewport phone-landscape`: none through zoom 2.0. At 2.5 the WORLD
    ZOOM row is off the bottom of the screen.

  In the compact layout (13 px labels from x=20), the longest label, LOCK AIM
  TO MOVE, meets its centred value at logical W ≈ 345, and `rowText` (2 px
  slack) fails below W ≈ 341. The wide layout draws 16 px labels from x=40, so
  it fails below W ≈ 452. The mapped drive reads only SCREEN SHAKE and WORLD
  ZOOM, at zoom 1 to 1.25 on desktop and 1.5 to 1.75 on the phone, and those
  rows stay clear.
- **The `─── CONTROLS ───` header is drawn over the WORLD ZOOM label** on
  desktop and landscape at every zoom, on 320x568, and on the phone from zoom
  2.0. This is also a game layout defect. It does not affect input or
  `rowText` on the WORLD ZOOM row.
