# Descend stairs

Each ordinary floor has a yellow STAIRS tile. Standing on it draws
`Press E to descend`, with E being the current Interact binding. Pressing USE
(that key, or the `E` button on touch) opens THE GAP, the hub between floors,
drawn with `FLOOR 1 → FLOOR 2` and four terminals. DESCEND then fades through
`DESCENDING TO FLOOR n` and loads the next floor. The keyboard control is
`[SPACE] DESCEND`, and touch has a `▼ DESCEND` button. The new floor autosaves
and queues its system prompt.

## Sub-features

| ID | Behavior | Drive `descend-stairs` |
|---|---|---|
| `stairs-hint` | On a STAIRS tile the HUD draws `Press <Interact key> to descend`. | Proved (drawn text) |
| `stairs-use` | USE on the stairs moves PLAYING to `HUB`; THE GAP draws `THE GAP` and `FLOOR 1 → FLOOR 2`. | Proved (drawn text) |
| `hub-descend` | Space (desktop, drawn as `[SPACE] DESCEND`) or the drawn `▼ DESCEND` button (touch) starts `FADE`, then `PLAYING` on the next floor. | Proved (drawn control found and used; on touch the label's centre and ink-box corners must hit the button in the game's `NEON.hub.hitTestHub`) |
| `floor-autosave` | The new floor writes `neonDungeonSave.floor`. | Proved |
| `floor-prompt` | Floors 2-6, 10, 12 and 14 queue a floor-start system prompt, which opens once the room has no threats; `X` or a tap on `PROMPT [X]` opens it early. | Proved that floor 2 queues it (model check) |
| `hub-terminals` | In THE GAP, ◀▶ or 1-4 select a terminal (UPGRADE MATRIX, MODULE SLOTS, ARMORY, ARCHIVE) and Enter or E opens its panel; Escape or Q closes it. | Documented only |
| `boss-core` | Boss floors have a CORE terminal instead of stairs, locked until the boss dies; on the final floor it opens the MAINFRAME route. | Documented only |

## How to get to it (user POV)

- Explore floor 1 until you find the stairs; the minimap helps. Stand on them
  and press E, or tap the `E` (USE) button on touch.
- In THE GAP, press Space, or tap `▼ DESCEND` on touch.

## Driving it with verify.js

Preconditions:

- The server is launched and `doctor` passes.
- A run is on floor 1 via `h.bootRun({ seed: 'VERIFY-STAIRS-1' })`.
- For setup, `h.openCheats(['INVULNERABILITY', 'NO-CLIP', 'HYPER MODE'])` is
  on, so `walkTo` can go straight through walls. Name this in the report.

- **Ready-made proof.** Run
  `node .github/skills/verify-neon-dungeon/scripts/verify.js drive descend-stairs --run-dir <RUN_DIR>`,
  then again with `--viewport phone --touch`. Both end
  `DRIVE PASS ... steps=6/6 checks=11/11`. The desktop run checks the drawn
  `[SPACE] DESCEND`; the touch run checks that the `▼ DESCEND` label lies on
  its button.
- **Find and reach the stairs.** Find the tile with
  `h.observe('stairs', () => /* scan game.dungeon.map for T.STAIRS */)`, then
  `h.walkTo(x, y)`. With `VERIFY-STAIRS-1` at HEAD `afb39ac` (runtime
  unchanged through `e5d6f28`) the stairs are at `75,34`.
  `floor(player.x), floor(player.y)` equals the tile.
- **Read the hint as drawn.** Get the key label with
  `h.observe('key', () => KEY_DISPLAY(settings.keyMap.interact))`. Then
  `h.findText(new RegExp('^Press ' + key + ' to descend$'))` finds
  `Press E to descend`.
- **Enter THE GAP.** Press the Interact key (`settings.keyMap.interact`,
  `KeyE` by default), or on touch `h.tapText(/^E$/)`. `game.state` becomes
  `HUB`, and `h.findText(/^FLOOR \d+ → FLOOR \d+$/)` reads
  `FLOOR 1 → FLOOR 2`.
- **Descend.** Choose DESCEND:
  - desktop: `h.findText(/\[SPACE\] DESCEND/)`, then `h.press('Space')`;
  - touch: `const label = await h.findText(/▼ DESCEND/)`. Hit-test
    `label.logical` and the four corners of `label.box` with the game's own
    `NEON.hub.hitTestHub(game, x, y)` inside `h.observe`. Every point must
    return `{kind: 'descend'}`, which proves the drawn label lies on the
    button that touch input hits. Then `h.tapText(/▼ DESCEND/)`.

  The game passes through `FADE` and settles in `PLAYING` or
  `SYSTEM_MESSAGE` with `game.floor === 2`.
- **Check floor 2.** `h.state()` shows `floor 2` and the same seed.
  `h.storage('neonDungeonSave').floor === 2`, and `game.systemMessages.entries`
  contains `floor-2-context-gap`. For other features, `h.takeStairs()` does
  this whole walk.

## Gotchas

- `walkTo` walks straight lines along x then y and does not pathfind. Without
  `NO-CLIP` it stops at the first wall and suggests enabling it.
- E is also the door key. Pressing it next to a closed door opens the door as
  well.
- The next floor may open with a modifier banner (for example `CORROSIVE`)
  that freezes play for 3 s of game time. `walkTo`, `bootRun` and
  `takeStairs` dismiss it with Enter, or with the `E` button on touch.
- The floor-2 prompt often stays queued until nearby enemies are gone.
  `walkTo` acknowledges it if it opens mid-walk.
- In THE GAP, Enter or E opens a terminal panel instead of descending. Use
  Space or `▼ DESCEND`.
