---
name: verify-neon-dungeon
description: Drive the real NEON DUNGEON browser roguelite (classic script tags rendering to one canvas, id "c") in headless Chromium with real keyboard, mouse and touch input, and capture evidence (step transcript, screenshots, localStorage, console, blocked requests). Use it to prove player-visible and browser-specific behavior (gameplay, menus, save, settings, input, layout) in a real browser.
---

# Verify NEON DUNGEON

This skill launches the game from a worktree, drives it the way a player does
and writes proof to a run directory outside the repo. Everything goes through
one CLI, `scripts/verify.js`, which has four commands: `launch`, `doctor`,
`drive` and `stop`. Per-feature recipes, and what each one actually proves,
live in [`features/README.md`](features/README.md). Each recipe has a
ready-to-run drive script in `features/drives/`.

Run every command from the worktree root. Each shell call is a fresh process,
so paste the run directory path into each command instead of relying on
environment variables.

## The game in one minute

- **Surface.** `index.html` loads 144 classic `<script src>` files, plus an
  inline PostHog stub and the service-worker registration. Everything draws
  into `<canvas id="c">`. There are no DOM buttons, so there is nothing to
  select with CSS or ARIA. You act with keys and taps, then check what is
  drawn and what page globals hold.
- **Globals.** You can read these globals from the page:
  - `game.state`, `game.floor`, `game.player` (with `x`, `y` and `hp` in tile
    units) and `game.runSeed`;
  - `W` and `H`, the logical canvas size;
  - `layout.compact`, `settings.worldZoom`, `settings.keyMap` and `T` (tile
    ids);
  - `KEY_DISPLAY(code)` (how a key is shown) and the `NEON.*` modules.
- **States.** `game.state` names are defined in `src/game-states.js`. A new run
  goes through these states:

  ```
  MENU -> SEED_SETUP -> INTRO (first run of a profile only) -> SYSTEM_MESSAGE -> PLAYING
  ```

  From PLAYING, `PAUSED` leads to `SETTINGS`, and descending goes
  `PLAYING -> HUB -> FADE -> PLAYING`, with `game.floor` one higher. `HUB` is
  the between-floor screen called THE GAP.
- **Keys.** The game reads `KeyboardEvent.code`. The defaults are:
  - WASD or the arrow keys to move;
  - `E` (`KeyE`) to interact or use;
  - `Space` to shoot and left Shift to dash;
  - `Escape` to pause;
  - `X` (`KeyX`) to open or acknowledge system prompts.

  Hints on screen name the current binding (`KEY_DISPLAY(settings.keyMap.interact)`,
  `E` by default), so build expected hint text from it.
- **Coordinates.** Logical coordinates are not CSS pixels:
  - desktop 1280x800 is W=960, H=600;
  - phone 390x844 is W=371, H=804, `compact`, with `worldZoom` 1.5 on first
    launch;
  - phone-landscape 844x390 is W=1206, H=557, not compact.
- **Targets.** Where a target has a drawn label, find it by that text, the way
  a player does. Use `h.tapText(/^SETTINGS$/)`, `h.findText(...)`,
  `h.rowText(...)` or `h.highlight(...)`. The harness records where every
  string is drawn (see Gotchas). Use the game's own layout helpers and
  `h.tapLogical(x, y)` only where there is no label. Three cases remain:
  - the left-half joystick in `walkTo`;
  - the right half of a stepper row, found by its label's y;
  - any tap that advances the intro.

  `tapLogical` inverts `src/platform.js` `toCanvas()`, so the mapping is
  exact.
- **Storage.** The game uses these localStorage keys:
  - `neonDungeonSave`, the current run;
  - `neonDungeonMeta`, progression and `introSeen`;
  - `neonDungeonSettings` and `neonDungeonScores`;
  - `neonDungeonReleaseVersion`;
  - `neon_telemetry`, written only when telemetry flushes.

## Launch

```bash
node .github/skills/verify-neon-dungeon/scripts/verify.js launch
```

It starts `scripts/verify-serve.js`, detached, serving this worktree on
`127.0.0.1` at an ephemeral port, then prints:

```
READY http://127.0.0.1:46457/
RUN_DIR /home/you/.cache/neon-dungeon-verify/20260930-045415-verify-skill
PID 359051  ROOT /path/to/worktree  HEAD e5d6f28...
```

- **Order of operations.**
  1. Install SIGINT/SIGTERM/SIGHUP handlers, before anything is created.
  2. Take `<run-dir>/launch.lock` exclusively. The lock is written complete
     to a temp file and hard-linked into place, so it is never seen
     half-written. It carries a random per-launch `token` and the launcher's
     pid.
  3. Refuse if `<run-dir>/server.json` already exists, whether valid,
     unreadable or foreign. Launch never overwrites another launch's record,
     because that launch's server may still be running. It releases only its
     own lock and prints the `stop` instruction.
  4. Spawn the server and write `server.json` with its pid,
     `status: "starting"` and the same `token`.
  5. Wait for the server's own line, `READY <url> pid=<pid>`. Only log bytes
     written after this spawn count, and the pid must match. A server that
     has exited fails the launch, even if it printed READY first.
  6. Record the url and `status: "ready"`, but only if the server is still
     alive and the lock and record still carry this launch's token.
     Otherwise stop its own server and fail. Liveness is checked again after
     the record is written, before exit 0. A server that dies after launch
     returns is caught by the `server-process` check in doctor and drive.

  `server.json` is always written atomically (a temp file, then a rename), so
  no reader sees a torn record. Its schema is exact: `pid`, `status`
  (`starting` with `url: null`, or `ready` with a url), `root`, `runDir`,
  `startedAt`, `head` and a 32-hex `token`. The url is parsed with
  `new URL()` and must be `http:` on host `127.0.0.1` or `[::1]`, with an
  explicit port 1-65535 and path `/`, in canonical form. Anything else is
  unreadable (`bad or missing: <fields>`), and doctor and drive refuse it
  (exit 2) before any browser starts.
- **Failure cleanup and ownership.** If the launch fails, times out or gets
  SIGINT/SIGTERM/SIGHUP, it kills its own server. It removes `server.json` and
  `launch.lock` only if they carry its token at the moment of removal. There
  is no compare-then-delete on the shared path. A quick read first skips a
  file that is visibly someone else's. Then the path is renamed to a unique
  `*.quarantine` name, which is atomic, and only that claimed copy is judged:
  - ours: it is unlinked;
  - someone else's: it is hard-linked back, which fails rather than clobbers
    if a newer file took the path. The copy is then left under its quarantine
    name and reported.

  The launch says which files it left. The handlers stay installed until the
  process exits. So exit 0 always means a recorded, running server, and exit
  130 always means the launch left nothing running, even if it had already
  printed READY.
- **One server per run dir.** A second `launch` into the same run dir is
  refused while the lock exists; `stop` removes the lock. Relaunching into a
  stopped run dir records the new server even though `server.log` still holds
  the old READY line. Server logs append to `<run-dir>/server.log`.
- **Run dir location.** The run dir is
  `${NEON_VERIFY_OUT:-$TMPDIR/neon-dungeon-verify}/<UTC timestamp>-<name>`.
  When `TMPDIR` is unset it falls back to `~/.cache/neon-dungeon-verify`,
  because agent sandboxes here refuse `/tmp`. It is outside the repo, so
  evidence survives worktree removal and never shows up in git.
- **Naming and roots.** `<name>` defaults to the worktree folder name. Use
  `--name` or `--run-dir` to choose it, and `--root DIR` to serve a different
  checkout, for example a scratch copy for a negative control.
- **Isolation.** Each launch gets its own port and run dir, and each drive
  gets a fresh browser context. Never drive or stop a run dir you did not
  launch.
- **`version.json` is verification scaffolding.** In production,
  `.github/workflows/release-version.yml` writes it. verify-serve answers
  `/version.json` from memory:
  `{"version":"0.0.0-local","tag":"local","commit":"<HEAD of root>","pid":<server pid>,"runDir":"<run dir>","root":"<root it serves>"}`.
  No file is written, and the menu shows `v0.0.0-local`. verify-serve
  refuses a repeated `--root`, `--run-dir` or `--port` (exit 2), so its
  command line has one meaning.
- **The deployed game.** There is nothing to launch. Pass
  `--url https://darinh.github.io/neon-dungeon/` to `doctor` or `drive`, and
  a run dir is created for the evidence.

## Doctor

Run doctor first, and again whenever something looks off. It is read-only
apart from writing its own evidence.

```bash
node .github/skills/verify-neon-dungeon/scripts/verify.js doctor --run-dir <RUN_DIR>
```

```
PASS  server-process  pid 359051 alive; cmdline has verify-serve.js --root <root> --run-dir <RUN_DIR>
PASS  http-root       GET / 200; <canvas id="c"> present; bytes match <root>/index.html
PASS  version-json    version 0.0.0-local commit 9aa1cc3... == HEAD 9aa1cc3... of <root>; answered by pid 359051 for this run; serving the recorded root
INFO  chromium        ~/.cache/ms-playwright/chromium-1219/chrome-linux64/chrome (source: playwright cache chromium-1219)
INFO  chromium-warn   cached chromium-1219 is not the Chromium revision playwright-core is pinned to (...); compatibility is not guaranteed. ...
PASS  browser-boot    game.state=MENU after 2079ms; 0 unexpected error(s), 1 noise filtered; appVersion=0.0.0-local
INFO  layout          W=960 H=600 compact=false worldZoom=1 touchDevice=false (viewport desktop 1280x800, canvas 960x600)
INFO  blocked         1 external request(s) refused; see blocked-requests.txt
INFO  screenshot      <RUN_DIR>/doctor/01-doctor-menu.png
DOCTOR PASS  evidence <RUN_DIR>/doctor
```

It exits 1 if any row is FAIL, and 130 if interrupted.

`doctor` and `drive` trust `<RUN_DIR>/server.json` only if it matches the full
record schema and its `runDir` is the requested `--run-dir`. A record copied
or moved from another run, or an unreadable or partial one, is refused
(`REFUSED`, exit 2). The `server-process`, `http-root` and `version-json`
rows come from one shared function. `drive` runs the same function before it
opens a browser, and refuses (exit 2) on any FAIL. So a forged record, or a
dead server's port reused by another run's server, is never driven.
`server-process` parses the recorded pid's command line with verify-serve's
own argument parser, so a repeated or unknown flag fails it. `version-json`
also compares the root the server reports with the recorded root.

- **`server-process` or `http-root` FAIL:** relaunch.
- **`version-json` FAIL:** the URL is not answered by this run's server. Its
  pid or run dir differs, or another static server holds the port.
- **`browser-boot` FAIL:** each unexpected error is printed as its own
  `INFO error` row.

`--viewport` and `--touch` work here as they do for `drive`; the `layout` row
prints `compact=` for any size.

Chromium is resolved in this order, and the source used is printed:

1. `NEON_VERIFY_CHROMIUM`. This is an explicit override; if it is set but
   missing, the command fails.
2. playwright-core's own `executablePath()`, the revision the pinned
   `playwright-core` expects.
3. Otherwise the newest cached
   `~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome`.
4. Otherwise `google-chrome`, `chromium` or `chromium-browser` on `PATH`.
5. Otherwise it fails with `npx playwright-core install chromium`.

Steps 3 and 4 print a `WARNING` (the `chromium-warn` row in doctor), because
compatibility with the pinned playwright-core is not guaranteed. Install the
pinned revision with `npx playwright-core install chromium`.

## Drive

```bash
node .github/skills/verify-neon-dungeon/scripts/verify.js drive start-seeded-run --run-dir <RUN_DIR> --viewport desktop
node .github/skills/verify-neon-dungeon/scripts/verify.js drive start-seeded-run --run-dir <RUN_DIR> --viewport phone --touch
```

- The script argument is a path, or the bare name of a file in
  `features/drives/`.
- Before any browser starts, `drive` runs doctor's server checks
  (`server-process`, `http-root`, `version-json`). If one fails, it prints
  the rows and refuses with exit 2, and no evidence is written.
- `--viewport` is `desktop` (1280x800), `phone` (390x844, isMobile),
  `phone-landscape` (844x390) or `WxH`. `--touch` gives the context a
  touchscreen. The helpers then use taps, the on-screen `E` (USE), `F`
  (HACK), `⇧` (DASH) and `II` (PAUSE) buttons, and the left-half virtual
  joystick.
- `--name` names the evidence subfolder. The default is
  `<script>-<viewport>[-touch]`. `--timeout` is in seconds (default 300).
- Each drive gets a fresh browser context with empty storage. Requests to any
  origin other than the served one are refused, and the service worker stays
  enabled because players have it.
- **SIGINT/SIGTERM** stop the drive, write all evidence (`failure:
  interrupted by SIGINT`), close the browser and exit 130. A second signal
  exits at once.

A drive script is CommonJS: `module.exports = async (h) => { ... }`. Start from
this template:

```js
// @ts-check
'use strict';
/** @param {import('../../scripts/verify.js').Harness} h */
module.exports = async function myFeature(h) {
  const s = await h.bootRun({ seed: 'MY-SEED-1' });  // real input: menu, seed field, intro, prompts
  h.check(s.state === 'PLAYING' && s.seed === 'MY-SEED-1', 'seeded run is playing', s);
  await h.step('pause', async () => {
    await h.press('Escape');
    await h.waitForState('PAUSED');
    await h.findText(/— Settings$/);                  // what the player sees
  });
  const save = await h.storage('neonDungeonSave');   // side effect, read back
  h.check(save && save.floor === 1, 'save written', save && save.floor);
};
```

If you add a drive under `features/drives/`, also add it to the `DRIVES` map in
`tests/verify.test.js`. That makes `npm run typecheck` check it against the
`Harness` type.

### The `h` API

Input methods drive the real page and never release before a game frame has
seen the input. The game reads held keys and the joystick once per frame, so
this holds even on a loaded machine.

| Call | What it does |
|---|---|
| `state()` | Returns `{state, floor, hp, x, y, W, H, compact, zoom, seed}`. `floor`, `hp`, `x` and `y` are null until a run exists. |
| `waitForState(name \| [names], ms=10000)` | Polls `game.state`. On timeout the error names the current state. |
| `press(code, {times, hold, gap})` | Keyboard press by code: `'Enter'`, `'KeyX'`, `'ArrowDown'`, `'Digit1'`. Each press is down for at least one frame and up before the next, so repeats never merge. `hold` and `gap` add wall time. |
| `hold(code, ms)` / `type(text)` | Holds a key (at least one frame), or types into whatever has focus. On the seed screen, typing on desktop goes to the canvas field. On touch it goes to the hidden `<input aria-label="Run seed">` after a field tap. |
| `tapLogical(x, y)` | Taps with touch in `--touch` contexts and clicks with the mouse otherwise, at logical game coordinates. Only for targets without a label. |
| `findText(re)` | Finds the topmost visible string matching `re`, drawn on the canvas in the last frame (a string pattern matches literally). Returns `{text, client, logical, box}`: the centre in client and logical coordinates, and `box` `{left, top, right, bottom}` in logical coordinates, the axis-aligned bounds of the ink box mapped through the full transform, so rotated or skewed text gets the box it really covers. If nothing matches within 2 s it throws, listing the visible strings. Use it to check what the player sees. |
| `tapText(re)` / `clickText(re)` | Finds a label, then taps it (touch contexts; mouse click otherwise) or clicks it with the mouse. On desktop MENU a click activates the highlighted row wherever it lands, so select menu rows with arrow keys there (`menuSelect` does). |
| `rowText(label, value, {within=12})` | Finds the `value` string drawn where a player reads `label`'s value, for example `rowText(/^SCREEN SHAKE$/, /^◀ (ON\|OFF) ▶$/)`. It must be on the label's row (centre within `within` logical px vertically) and in the row's value column: its box starting right of the label's box, and ending no further right than the label's left edge mirrored across the canvas (the settings and FEET menus are centred panels). A value drawn elsewhere on the row fails with its position. A value drawn over its label fails with `value overlaps its label: <label box> vs <value box>, a game layout defect at this viewport`. Any positive-area overlap counts; the 2 px slack only applies at the column edges, and edges that merely touch are fine. That is a real game bug at that viewport, so the check is never loosened (see `features/pause-and-settings.md` for the viewports known to hit it). |
| `highlight(label, key, {max=40})` | Presses `key` until `label` is drawn highlighted. A label counts as highlighted when it is drawn in a colour that no other label in its menu column or row uses. This is keyboard navigation by what is shown, with no row indices. |
| `visibleTexts()` | Every visible drawn string of the last frame, as `{text, client, logical, box}`. |
| `step(label, fn)` | Runs `fn` and records state before and after, plus a screenshot taken after. Steps nest. |
| `check(cond, msg, detail?)` | Records a PASS or FAIL. A FAIL throws, and the drive fails even if the script catches it. |
| `observe(label, fn, arg?)` | A `page.evaluate` recorded as an observation. By convention it only reads. |
| `storage(key)` | Reads a localStorage key, JSON-parsed when possible. |
| `setup(label, fn, arg?)` | A `page.evaluate` recorded as `SETUP:`. Use it for writes. Setup is never proof. |
| `shot(label)`, `note(text)`, `frames(n)`, `sleep(ms)`, `reload()` | Screenshot, transcript note, wait n rAF ticks, wait ms, or reload the page (the player reopens the tab) and wait for MENU. `frames` throws `no animation frame observed the input within 5 s` when the page stops rendering; every input helper waits on it, so input no frame saw fails the drive. |
| `page`, `url`, `touch` | Escape hatches: the Playwright `Page`, the served URL, and whether touch is on. Code-running calls through `h.page` (`evaluate`, `$eval`, `waitForFunction`, `addInitScript` and so on) are recorded as `SETUP` and never count as proof. |

`observe` and `setup` both run arbitrary page code, and nothing enforces that
`observe` only reads: read-only is a convention. Keep writes in `setup`, and
avoid `h.page` in committed drives.

The helpers below are built only from real input. They branch on keyboard
versus touch internally, and find labelled targets by drawn text.

| Helper | Keyboard path / touch path |
|---|---|
| `menuSelect(prefix)` | Arrow keys to the row's index in `game.getMenuOptions()` (MENU ignores the mouse position on desktop), then Enter / `tapText` on the row label. It activates a second time if the first activation was the title-music unlock gesture (see Gotchas). |
| `bootRun({seed})` | BOOT SESSION, then the seed. Desktop: Backspace clears the prefilled random seed, then `type`. Touch: tap the drawn seed, then Backspace and type. Then START (`highlight` + Enter / `tapText`), Escape (or taps) past INTRO, KEEP UNLOCKS if asked, the system prompts, and floor banners. Returns in PLAYING. |
| `ackMessages()` | Waits out the 0.25 s ACK lock, then presses `X` / taps `TAP ACK`, for each open RUNTIME SYSTEM PROMPT. |
| `openCheats(rows)` | Opens the FEET diagnostic hatch and turns ONLINE the rows with these drawn names: `INVULNERABILITY`, `NO-CLIP`, `SHOW MAP`, `HYPER MODE`. Keyboard: Escape to PAUSED, `F E E Shift`, the digit drawn in each row (`2. NO-CLIP`), then Escape twice. Touch, only while PLAYING: taps `F`, `E`, `E`, `⇧`, the row labels, then `CLOSE`. Each row must then draw `ONLINE`. |
| `walkTo(tx, ty)` | Holds arrow keys / drags the left-half joystick, moving along x then y, until `floor(x),floor(y)` is the tile. It acknowledges prompts, skips pickup modals (`SKIP…`) and dismisses floor banners on the way. It does not pathfind: turn on `NO-CLIP` for cross-room walks. |
| `takeStairs()` | Finds the nearest `T.STAIRS` tile, walks there, and presses E / taps the `E` button. In THE GAP it checks `[SPACE] DESCEND` is drawn and presses Space / taps the drawn `▼ DESCEND`. Waits for floor+1 and settles prompts and banners. |
| `quitToMenu()` | Escape, check `— Quit to Menu` is drawn, then Q / tap `II`, then `QUIT TO MENU`. |

The FEET cheats are a real in-game path, typed as F, E, E, Shift. They are
fair to use as setup, for example to reach the stairs quickly. Say so in the
report, and never use a cheat to fake the outcome you are proving.

### Choosing what to run for a change

| Change | Run |
|---|---|
| Anything player-visible | The mapped drive for each touched feature on `--viewport desktop` and `--viewport phone --touch`. |
| Visual change (layout, text, colours, art) | Add an explicit `h.shot()` before the action as well as after: `step()` only shoots after. Assert the drawn text with `findText` / `rowText`. |
| Compact or HUD layout | Portrait (`phone`), landscape (`phone-landscape`), and both sides of the compact boundary. `engine/viewport.js computeLayout` makes the layout compact when `H > W && W <= 600` in logical px after `computeScale`, so `--viewport 900x1200` is compact and `902x1200` is not. `doctor --viewport WxH` prints `compact=` to confirm a size. |
| Input handling | Every affected entry point: keyboard, desktop mouse (`clickText`) and touch (`--touch`, `tapText`). |
| Refactor claimed behavior-preserving | The whole map on both viewports, before and after the change. |

## Evidence

Proof standards:

- **Use real input on the real user path.** Drive keys, clicks and taps
  through the menus a player uses. Do not call internal setters, test-only
  hooks or `game.startGame()`.
- **Check what the player sees, and where.** When a label, hint, value or
  button is the claim, assert the drawn text (`findText`, `rowText`,
  `highlight`), not only the model (`game.hint`, `settings`) or a hit-test.
  Placement is part of the claim. `rowText` requires the value in its row's
  value column. For a button, hit-test the drawn label's centre and the
  corners of its `box` with the game's own hit-test function, as the
  descend-stairs drive does with `NEON.hub.hitTestHub`. Then tap the label.
- **Capture the action and the resulting state,** not just the final screen.
  `step()` records state before and after plus a screenshot. Every input is
  also a transcript entry.
- **Verify side effects** alongside what is visible: read back
  `neonDungeonSave`, `neonDungeonSettings` and the other keys with
  `h.storage()`. When it matters, check that the change survives
  `h.reload()`.
- **`page.evaluate` writes are setup only.** Use `h.setup()` so the
  transcript labels them `SETUP:`. `h.page` code-running calls are recorded
  the same way. Setup is never the proof itself.
- **Name what you skipped.** A feature proven on desktop only is not proven
  on touch. Report which viewports and entry points you drove.

Each drive writes `<RUN_DIR>/<name>/` (doctor writes `<RUN_DIR>/doctor/`):

| File | Contents |
|---|---|
| `transcript.json` | Ordered entries: `step` (before, after, screenshot, ms, ok), `input`, `check`, `observe`, `setup`, `wait` and `note`. Also the chromium path, version and warning, and the final state. |
| `NN-<label>.png` | One screenshot per step, plus `final` or `final-FAILED`. |
| `console.log` | Every console message, `[pageerror]`, and same-origin `[http 4xx/5xx]`. Known noise is tagged `[noise]`. |
| `blocked-requests.txt` | Every refused request, with its layer (`route`, `websocket` or `dns`). Normally it holds one line per page load for `https://us-assets.i.posthog.com/static/array.js`. |
| `storage.json` | All of localStorage at the end. |
| `summary.json` | `ok`, `reasons`, counts (steps and failed steps, checks and failed checks, inputs, setups, screenshots, blocked, errors), the failure, unexpected errors and the final state. |

The command prints `DRIVE PASS|FAIL <name> ... steps=n/m checks=n/m ...`,
one `reason:` line per failure cause, and `EVIDENCE <dir>`. A drive passes
only if all of these hold:

- it recorded at least one check;
- every check and every step succeeded, even ones the script caught;
- it did not throw anything, even `throw undefined`, and was not
  interrupted;
- the page reported no `pageerror`, no `console.error` (such as
  `[render-boundary] update() threw`) and no same-origin HTTP error.

Otherwise it exits 1, or 130 when interrupted.

Only two things count as noise:

- `Failed to load resource` for a refused external URL;
- the `/favicon.ico` 404. The repo has no favicon.

Network fence: `context.route` refuses every request whose origin is not the
served origin. Chromium also runs with
`--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE <served host>`, so a request
that bypasses routing cannot resolve either. PostHog's inline stub in
`index.html` stays a stub, and nothing reaches `us.i.posthog.com`.

## Cleanup

```bash
node .github/skills/verify-neon-dungeon/scripts/verify.js stop --run-dir <RUN_DIR>
```

`stop` first looks for a launch still running for this run dir, typically
one waiting for READY. The lock's launcher pid must be a live
`verify.js launch`, and either its `--run-dir` is this run dir, or the
recorded server (whose record carries the lock's token) is its child. Such a
launch gets SIGTERM, and its own handlers stop its server and remove only
the files it created. `stop` prints
`STOPPED  launch in progress (launcher pid N, server pid M) ...`, so the
launch is never pulled out from under its launcher.

Otherwise `stop` reads the pid from `server.json` and kills it only if
`/proc/<pid>/cmdline` is `verify-serve.js ... --run-dir <RUN_DIR>`. The
cmdline is parsed with verify-serve's parser, so repeated flags do not match.
Otherwise it prints `REFUSING` and exits 1, and nothing is killed. It sends
SIGTERM, then SIGKILL if needed, keeps every evidence file and lists them. It
is idempotent: `NOTHING TO STOP` and `ALREADY STOPPED` exit 0. A server that
exits while `stop` checks it (for example because a concurrent `stop` killed
it) is `ALREADY STOPPED`.

`stop` removes a file only if it is still the one it judged at the moment of
removal, by the same rename-to-quarantine claim as launch. A claimed file
that turns out to be someone else's goes back. If it cannot go back, it is
left as `*.quarantine`, with a `NOTE`:
- **The record** goes only if it carries the token of the launch whose
  server `stop` handled.
- **The lock** goes if it carries that same token, or if its launcher is no
  longer running and it is unchanged. A lock held by a running launcher stays
  (`NOTE  launch.lock left in place ...`).
- **With no trustworthy record** (missing, unreadable or foreign) while a
  live launcher that cannot be verified as this run dir's holds the lock,
  `stop` prints `LAUNCH IN PROGRESS`, removes nothing and exits 1.

When `server.json` is unreadable (`UNREADABLE`: empty, torn, partial, or not
a server record) or names another run dir (`FOREIGN`: copied or moved), and
no launch is in progress, `stop` kills nothing, removes it and `launch.lock`,
and says so. It then lists any live verify-serve whose argv names this run dir
as `NOT KILLED  pid N ...` and exits 1. Kill such a pid yourself only if you
started it.

- Never kill by process name, and never stop a run dir you did not launch.
- Run `stop` after every attempt, including failed ones.
- Browser processes and their scratch profile are removed when each drive or
  doctor exits, including after SIGINT. The profile lives under
  `<out-root>/.tmp/b-*`, or `~/.nd-verify/b-*` if that path would be too
  long.
- Evidence stays until you delete the run dir yourself.

## Helpers

| File | Invocation |
|---|---|
| `scripts/verify.js` | `node .github/skills/verify-neon-dungeon/scripts/verify.js launch\|doctor\|drive\|stop ...`. `--help` prints usage. It exports its pure helpers for tests. |
| `scripts/verify-serve.js` | `node .github/skills/verify-neon-dungeon/scripts/verify-serve.js [--root DIR] [--port N] [--run-dir DIR]`. It serves on 127.0.0.1 and prints `READY <url> pid=<pid>`. `launch` runs it for you. |
| `features/drives/*.js` | These are drive scripts. See the feature map. |
| `tests/verify.test.js`, `tests/verify-serve.test.js` | Browser-free unit and HTTP tests, run by `npm test` and `npm run check`. |

The browser library is `playwright-core`, a devDependency pinned exactly. It
downloads no browser. Run `npm ci` in a fresh worktree first.

## Gotchas

- **The first MENU activation can be swallowed.** On a fresh page, the first
  Enter or tap on MENU is consumed as the gesture that unlocks title music
  (`_menuTitleUnlockPending`). `menuSelect` and `bootRun` activate again. A
  hand-written drive must do the same.
- **System prompts** (`SYSTEM_MESSAGE`) accept only `X` or a click or tap on
  ACK (`ACK  [X]` / `TAP ACK`), not Enter or E. Input is ignored for the first
  0.25 s. The prompt for floor 2 and later auto-opens only when the room has
  no threats. Until then it waits as an unread `PROMPT [X]` indicator; `X` or
  a tap on it opens it. Reading a prompt also saves the run.
- **INTRO** plays only while `neonDungeonMeta.introSeen` is false, so only on
  the first run of a fresh profile. `Escape` skips it. On touch each tap
  advances one slide.
- **The KEEP UNLOCKS / RESET META dialog** appears on START when meta progress
  exists (shards, cores, runs completed and so on). It is drawn on MENU with
  `game._newGameConfirm` set. `bootRun` keeps unlocks. No mapped drive reaches
  it without SETUP.
- **The seed field** is prefilled with a random `XXXX-XXXX-XXXX` seed and draws
  it with a blinking `_` cursor. Clear it first. Allowed characters are
  `A-Z a-z 0-9 space _ . - :`, up to 64. Seeds are case-sensitive.
- **Floor banners.** A floor modifier banner (for example `CORROSIVE`) or a
  biome card freezes PLAYING for up to 3 s of game time until any input
  arrives. Game time advances at most 0.05 s per frame, so on slow frames it
  lasts longer. The helpers dismiss it: Enter on keyboard, the `E` (USE)
  button on touch.
- **FEET cheats** reset on BOOT SESSION and on RESUME SESSION. They are never
  saved. On keyboard, the harness types `F E E Shift` from PAUSED, because in
  PLAYING E interacts and Shift dashes.
- **How canvas text is found.** Before the game loads, an init script wraps
  `CanvasRenderingContext2D` `fillText` and `strokeText`. For the main canvas
  (`id="c"`) only, it records each string of the last complete frame: its
  visual centre (from textAlign, measureText width and the baseline, mapped
  through `getTransform()`), its box, anchor, alignment, style, filter and
  globalAlpha. The box is the axis-aligned bounds of the local ink box
  (advance width by ink ascent and descent) after all four corners go
  through the full transform, so rotation and skew are accounted for. A
  string counts as visible only if its
  effective alpha is above 0.05 and its centre is on the canvas. Effective
  alpha is globalAlpha × the fill or stroke style's alpha (`transparent`,
  `rgba()`, `hsla()`, `/ alpha`, `#RGBA`, `#RRGGBBAA`; gradients and patterns
  count as opaque) × any `filter: opacity()`. Text hidden another way still
  counts: covered by a later draw, clipped, drawn in the background colour,
  or erased by a composite mode. The screenshot is the backstop for those.
  Taps follow labels when they move. If a label is renamed or not drawn,
  `findText` fails and lists what is on screen. The recorder costs about
  0.15 ms per frame.
- **Desktop MENU ignores the mouse position.** A mousedown only adds
  `MouseLeft` (`src/platform.js`), and `updateMenu` activates the
  keyboard-highlighted row. Only touch taps map to rows. Other screens
  (SETTINGS, SEED_SETUP, pause, prompts) hit-test the mouse, so `clickText`
  works there.
- **Headless Chromium cannot hide a page.** Tab switches, minimising and a
  CDP lifecycle freeze all leave `document.visibilityState` as `visible`. The
  save-and-continue drive therefore synthesizes `visibilitychange` as a
  labelled SETUP step, and proves the pagehide save separately through a real
  reload.
- **Chromium's scratch path must stay short.** Its singleton socket must fit
  107 bytes, so the scratch dir is `<out-root>/.tmp/b-XXXXXX`. A very long
  `NEON_VERIFY_OUT` makes launch fail with a message telling you to shorten
  it.
- **Screenshots** are taken at deviceScaleFactor 1. The game ignores
  `devicePixelRatio`, so this is faithful and keeps evidence small.

## Known limits

- **Visibility.** Only effective alpha and an on-canvas centre are checked.
  Text that is covered, clipped, drawn in the background colour or erased by
  a composite mode still counts. Look at the screenshots.
- **Boxes of rotated or skewed text** are axis-aligned bounds, which are
  larger than the ink. A "label lies inside its control" check is therefore
  conservative: a tilted label that fits its button can still fail it.
- **Process checks read `/proc`.** Server identity, launcher verification and
  `NOT KILLED` reports need it. Elsewhere, argv comes from `ps`, split on
  spaces. A launch in progress can then be verified only by an absolute
  `--run-dir` in its argv, and otherwise `stop` prints `LAUNCH IN PROGRESS`
  rather than signalling it.
- **Removal claims a file by renaming it.** A file that was visibly someone
  else's is never touched. But if a lock or record is replaced within the
  microseconds between `stop`'s quick read and its rename, the replacement is
  briefly off its path. If yet another file takes the path in that moment,
  the displaced copy is kept as `*.quarantine`, and `stop` reports it with a
  `NOTE`.
- **Launch checks its server's liveness** when it records `ready` and just
  before it exits 0. A server that dies after that is caught by doctor's and
  drive's `server-process` check, not by launch.
