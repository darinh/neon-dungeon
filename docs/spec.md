# NEON DUNGEON — Game Specification v1.1

## Vision

A real-time top-down cyberpunk dungeon crawler. The player descends through
procedurally generated neon-lit floors of an abandoned megacorp facility,
fighting security systems and rogue AIs to reach the core. Every run is unique.

---

## Technical Constraints

- **Delivery:** Single `index.html` file, zero external dependencies
- **Renderer:** HTML5 Canvas 2D API, dynamic resolution (fills viewport edge-to-edge; `gameScale` 0.7–1.5 keeps tiles at 14–30 CSS px)
- **Audio:** Web Audio API (synthesised — no audio files)
- **Persistence:** `localStorage` for high-score table (top 10 entries)
- **Browser target:** Modern Chromium / Firefox (ES2020+)

---

## Game States

```
MENU → PLAYING → GAME_OVER
                → VICTORY (floor 10 cleared)
```

State transitions are animated (fade in/out, 400 ms).

---

## World Generation — BSP Dungeon

Each floor is generated fresh using Binary Space Partitioning:

1. Recursively split the map (80 × 50 tiles) into leaf partitions.
2. Place one room per leaf (random size within partition bounds).
3. Connect sibling rooms with L-shaped corridors.
4. Guarantee: every room is reachable from spawn.
5. Place stairs-down in the deepest room from spawn (BFS distance).
6. Floor 10 stairs replaced with CORE terminal (victory trigger).

**Tile types:** WALL | FLOOR | DOOR | STAIRS | TERMINAL | VOID

**Lighting:** Each floor tile has a computed light level (0–1) based on
distance from the nearest light source (player torch radius = 8 tiles,
static wall sconces in rooms). Tiles beyond radius 12 are fully dark.

---

## Player

### Stats

| Stat      | Base | Notes                           |
|-----------|------|---------------------------------|
| HP        | 100  | Death → GAME_OVER               |
| MAX_HP    | 100  | Increases +20 on level-up       |
| ATK       | 10   | Melee damage                    |
| DEF       | 2    | Flat damage reduction           |
| SPD       | 3.5  | Tiles/sec movement              |
| LEVEL     | 1    | Max 10                          |
| XP        | 0    | XP to next level = level × 80   |

### Controls — Keyboard & Mouse

| Input              | Action                    |
|--------------------|---------------------------|
| WASD / Arrow keys  | Move                      |
| Mouse              | Aim                       |
| Left Click / Space | Fire weapon               |
| E                  | Interact (door/stairs)    |
| I                  | Toggle inventory           |
| ESC                | Pause / back to menu       |

### Controls — Touch (dual-joystick)

On touch devices, the game uses a dual-joystick layout with virtual buttons:

| Input                             | Action                      |
|-----------------------------------|-----------------------------|
| Left-half touch & drag            | Move joystick (base radius 55 px) |
| Right-half touch & drag           | Aim joystick — holding fires automatically |
| E button (bottom-right, cyan)     | Interact (door/stairs)      |
| V button (bottom-right, purple)   | Use void shard              |
| ‖ button (top-right, magenta)     | Pause                       |

Joystick deflection is clamped to the base radius and normalised to 0–1.
Ghost joystick hints (12 % opacity) are drawn when inactive so the player
knows where to touch. Active joysticks render at 35 % opacity.

Touch events call `preventDefault()` (passive: false) to suppress browser
scroll/zoom. The CSS rule `touch-action: none` is applied globally.

### Weapons

Player carries one weapon at a time. Weapons found as floor drops.

| Weapon       | Damage  | Fire Rate | Range | Projectile      |
|--------------|---------|-----------|-------|-----------------|
| PULSE PISTOL | 15      | 3/s       | 10    | fast bolt       |
| SCATTER GUN  | 8 × 4   | 1/s       | 5     | 4 spread bolts  |
| RAILGUN      | 60      | 0.5/s     | 20    | piercing beam   |
| PLASMA SWORD | 25      | 2/s melee | 1.5   | melee arc       |
| VOID CANNON  | 45      | 1.5/s     | 12    | slow heavy bolt |

Default starting weapon: PULSE PISTOL.

### Level-Up Effects (automatic on XP threshold)

- MAX_HP +20, HP fully restored
- ATK +3
- DEF +1
- Brief screen flash + sound sting

---

## Enemies

### Common (floors 1–10, scaled by floor)

| Type         | HP base | ATK | Behaviour                                    | XP  |
|--------------|---------|-----|----------------------------------------------|-----|
| GUARD        | 40      | 8   | Patrol → chase on sight, melee               | 20  |
| TURRET       | 25      | 12  | Stationary, fires projectiles at player      | 15  |
| CRAWLER      | 20      | 6   | Fast zigzag charge, melee                    | 10  |
| PHANTOM      | 35      | 10  | Invisible until within 3 tiles, teleports   | 30  |
| DRONE        | 15      | 8   | Flies over walls (no collision), ranged     | 12  |

HP and ATK scale: `value × (1 + 0.15 × (floor - 1))`

### Bosses (appear on floors 3, 6, 10)

| Boss           | HP    | Phases | Special                                           |
|----------------|-------|--------|---------------------------------------------------|
| SENTINEL MK-I  | 300   | 2      | Laser sweep + shield burst                        |
| NEURAL HIVE    | 500   | 3      | Spawns crawlers, psionic shockwave                |
| OMEGA CORE     | 1000  | 4      | All previous attacks, room-filling void orbs      |

Boss arenas: pre-built 20×20 rooms, sealed on entry (doors lock until dead).

---

## Items

Dropped by enemies (20 % chance) or placed in rooms (1–3 per room).

| Item            | Effect                                  | Rarity  |
|-----------------|-----------------------------------------|---------|
| MED-PACK        | +40 HP (capped at MAX_HP)              | Common  |
| NANO-REPAIR     | +15 HP                                  | Common  |
| SHIELD CELL     | +5 DEF for current floor               | Uncommon|
| XP CHIP         | +50 XP                                  | Uncommon|
| WEAPON CRATE    | Random weapon drop                      | Rare    |
| OVERCLOCK       | SPD +1.5 for 20 s                       | Rare    |
| VOID SHARD      | One-use: massive explosion (80 dmg AoE) | Epic    |

---

## Visual Style

- **Palette:** Near-black backgrounds (#0a0a12), neon cyan (#00f5ff),
  neon magenta (#ff00c8), neon green (#39ff14), amber (#ffb700)
- **Player:** Cyan humanoid silhouette, direction indicator
- **Enemies:** Colour-coded: Guards = red, Turrets = amber, Crawlers = green,
  Phantoms = purple, Drones = blue
- **Bosses:** Large sprites with glow halos
- **Particles:** Sparks, blood pixels, muzzle flash, explosion rings
- **HUD:** Semi-transparent panel bottom-left (HP bar, weapon, floor, score)
- **Minimap:** Top-right corner, 120×80 px, fog-of-war (visited rooms only)
- **Glow FX:** `ctx.shadowBlur` on all neon elements

---

## Audio (Web Audio API — synthesised only)

| Event            | Sound description                               |
|------------------|-------------------------------------------------|
| Player shoot     | Short sine-wave blip, 880 Hz → 440 Hz          |
| Enemy shoot      | Sawtooth blip, 300 Hz                           |
| Hit (player)     | Low thud + noise burst                          |
| Hit (enemy)      | Mid-freq tick                                   |
| Enemy death      | Descending sweep                                |
| Level-up         | Ascending arpeggio (C-E-G-C)                   |
| Boss enter       | Deep drone + reverb tail                        |
| Pick up item     | Quick ascending blip                            |
| Stairs / descend | Whoosh + resonant ping                          |
| Game Over        | Minor chord + long decay                        |
| Victory          | Major fanfare arpeggio                          |

---

## Scoring

```
score += enemy_xp_value × floor_multiplier   (on kill)
score += 500 × floor_number                  (on floor clear)
score += remaining_hp × 10                   (on floor clear)
```

High-score table stored in `localStorage` as JSON, top 10, with player name
(prompt on game over / victory if score qualifies).

---

## HUD Layout

```
┌───────────────────────────────────────────────┐
│                  NEON DUNGEON          [map]  │  ← minimap top-right
│                                               │
│              [GAME CANVAS]                    │
│                                               │
│  HP ████░░  ATK:13 DEF:3  FLOOR:3  SCORE:... │  ← HUD bottom
└───────────────────────────────────────────────┘
```

---

## Screen Flow

1. **Title Screen** — animated neon logo, "PRESS ENTER TO START", high-score table
2. **Playing** — full game loop
3. **Pause** — ESC, dim overlay, resume / quit options
4. **Level Transition** — fade, "DESCENDING TO FLOOR N" text
5. **Game Over** — score, death floor, name prompt if high score
6. **Victory** — cinematic text crawl, final score

---

## Implementation Architecture (single HTML file)

```
<html>
  <style>   /* full-screen canvas, dark bg, UI font */
  <canvas id="c">
  <script>
    // ── Constants & Config ──────────────────────
    // ── Utilities (RNG, math helpers) ───────────
    // ── Audio Engine ────────────────────────────
    // ── Input Manager ───────────────────────────
    // ── Particle System ─────────────────────────
    // ── Dungeon Generator (BSP) ─────────────────
    // ── Lighting System ─────────────────────────
    // ── Entity base class ───────────────────────
    // ── Player ──────────────────────────────────
    // ── Enemy types ─────────────────────────────
    // ── Boss types ──────────────────────────────
    // ── Item class ──────────────────────────────
    // ── Combat system ───────────────────────────
    // ── Projectile class ────────────────────────
    // ── Renderer ────────────────────────────────
    // ── HUD ─────────────────────────────────────
    // ── Minimap ─────────────────────────────────
    // ── Game State Machine ──────────────────────
    // ── Main Game Loop (requestAnimationFrame) ──
    // ── Boot ────────────────────────────────────
  </script>
</html>
```

Total estimated LOC: ~3 500–4 500.

---

## Mobile & PWA

### Progressive Web App

A `manifest.json` at the repository root enables Add-to-Home-Screen:

| Field            | Value                   |
|------------------|-------------------------|
| `display`        | `fullscreen`            |
| `orientation`    | `any`                   |
| `background_color` / `theme_color` | `#0a0a12` |
| `start_url`      | `./index.html`          |
| `icons`          | *(empty — to be added)* |

Meta tags in `<head>`:
- `apple-mobile-web-app-capable: yes` (iOS Safari home-screen)
- `apple-mobile-web-app-status-bar-style: black-translucent`
- `mobile-web-app-capable: yes` (Android Chrome)

### Fullscreen — Landscape Auto-Request

On touch devices, orientation changes trigger fullscreen behaviour:

1. **Rotate to landscape** → set `fsWantLandscape = true`, reset dismiss state.
   On the next `touchstart` user gesture, call `requestFullscreen()` on
   `document.documentElement`.
2. **Rotate to portrait** → call `exitFullscreen()` immediately, clear want flag.
3. **Dismiss button** (✕, top-left 48×48 px hit area): sets `fsDismissed = true`
   for the current landscape session. A new portrait→landscape transition
   resets the dismiss flag.

Fullscreen prompt: a centered pill overlay ("⤢ Tap for fullscreen · ✕")
drawn at 70 % opacity when landscape + not fullscreen + not dismissed +
API supported.

**Browser compat:** Detects `requestFullscreen` / `webkitRequestFullscreen`
at boot. Promise `.catch()` guards handle void-return Safari variants.
`screen.orientation.type` is preferred; falls back to
`innerWidth > innerHeight`. Non-touch devices skip all orientation logic.

### Known Limitation — iOS Safari

The Fullscreen API is not supported in standalone iOS Safari. The reliable
iOS path is PWA Add-to-Home-Screen, which uses `display: fullscreen` from
the manifest to achieve a chrome-less experience.

---

## Changelog

| Version | Change |
|---------|--------|
| v1.0    | Initial specification |
| v1.1    | Added: Touch Controls (dual-joystick), Mobile & PWA section (manifest, fullscreen behaviour), Known Limitation (iOS Safari) |
| v1.2    | Renderer: dynamic resolution (edge-to-edge canvas, gameScale 0.7–1.5, safe-area insets, touchcancel handling) |
