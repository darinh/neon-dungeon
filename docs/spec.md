# NEON DUNGEON — Game Specification v2.0

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
MENU → PLAYING → NAME_ENTRY → GAME_OVER
                             → VICTORY (floor 10 cleared)
                → GAME_OVER  (score doesn't qualify for top 10)
                → VICTORY    (score doesn't qualify for top 10)
```

State transitions are animated (fade in/out, 400 ms).

**NAME_ENTRY** appears when the player's score qualifies for the top-10
leaderboard. It replaces the browser `prompt()` with an in-game arcade-style
name entry screen featuring a virtual keyboard (touch and desktop). If the
score does not qualify, the game skips directly to GAME_OVER or VICTORY.

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

### Difficulty Curve

**Weighted type distribution:** Each enemy type has a base weight and per-floor
modifier. Early floors are GUARD-heavy (~50% on floor 1); later floors shift
toward PHANTOMs and DRONEs (~29% and ~22% on floor 10). Weights use
`max(1, base + perFloor × (floor − 1))`.

| Type    | Base weight | Per-floor |
|---------|-------------|-----------|
| GUARD   | 40          | −3        |
| TURRET  | 20          | +1        |
| CRAWLER | 10          | +3        |
| PHANTOM | 5           | +4        |
| DRONE   | 5           | +3        |

**Scaling enemy count per room:**
`count = min(areaCap, rndInt(2 + floor÷3, min(8, 4 + floor÷2)))` where
`areaCap = floor(room.w × room.h ÷ 8)`. Floor 1 averages 2–4 per room;
floor 10 averages 5–8 (capped by room area).

**Per-room composition caps:** max 2 turrets, max 2 drones, max 1 phantom per
room. Excess rolls default to GUARD.

### Elite Enemies (floor 3+)

8% chance per spawn on floor 3 and above. Maximum 1 elite per room. Never
applied to bosses or boss-summoned adds.

| Stat     | Multiplier |
|----------|------------|
| HP       | ×1.8       |
| ATK      | ×1.3       |
| SPD      | ×1.15      |
| XP value | ×1.25      |

**Visual:** Pulsing neon glow (oscillating `shadowBlur` driven by `bobAngle`)
and a white diamond marker above the enemy. Elite HP bars render in white
instead of the type colour.

### Aggression Scaling

AI parameters tighten with floor progression:

| Parameter            | Formula                            | Range         |
|----------------------|-------------------------------------|---------------|
| GUARD detect range   | `10 + floor × 0.4`                 | 10.4 – 14     |
| TURRET shoot cooldown| `max(1.0, 2.0 − floor × 0.11)`    | 1.89 – 1.0 s  |
| DRONE shoot cooldown | `max(0.9, 1.5 − floor × 0.07)`    | 1.43 – 0.9 s  |

### Bosses (appear on floors 3, 6, 10)

| Boss           | HP    | Phases | Special                                           |
|----------------|-------|--------|---------------------------------------------------|
| SENTINEL MK-I  | 300   | 2      | Laser sweep + shield burst                        |
| NEURAL HIVE    | 500   | 3      | Spawns crawlers, psionic shockwave                |
| OMEGA CORE     | 1000  | 4      | All previous attacks, room-filling void orbs      |

Boss arenas: pre-built 20×20 rooms, sealed on entry (doors lock until dead).
Boss-summoned adds (HIVE crawlers, OMEGA drones/crawlers) cannot be elite.
All boss HP values are scaled by the floor modifier (`1 + 0.15 × (floor − 1)`).
Phase thresholds use `maxHp` percentages, so scaling does not break phases.

On boss death, the arena unseals and the game displays "{BOSS NAME} DESTROYED".
On floor 10, the CORE terminal is locked until OMEGA CORE is defeated.

#### OMEGA CORE — Phase Breakdown

Phase thresholds (by % of scaled max HP):

| Phase | HP Range     | Speed | Attacks Unlocked                              |
|-------|-------------|-------|------------------------------------------------|
| 1     | 100 %–70 %  | 1.0×  | Rotating radial shots + homing missile         |
| 2     | 70 %–40 %   | 1.2×  | + Crawler/drone spawns (2 adds per wave)       |
| 3     | 40 %–20 %   | 1.5×  | + Piercing beam fan (5) + shield burst (≤5 tiles) |
| 4     | 20 %–0 %    | 2.0×  | + Void orbs + psionic shockwave (≤7 tiles) + 3 adds/wave + 7-beam fan |

Phase transitions trigger an explosion particle burst and a HUD warning
(`⚠ OMEGA PHASE N`).

**Void Orbs** (Phase 4 signature attack):
- 2–3 orbs spawn at random room positions every 3.5 s (÷ speed mult)
- Each orb expands from radius 0 to 4–7 tiles over 2.5 s, then fades
- Players inside an orb take 15 damage every 0.5 s (cooldown-gated)
- Visual: translucent magenta fill with neon ring edge, fading with age

**Attack Inheritance:**
- SENTINEL radial shots → rotating turret volley (4→5→8 projectiles by phase)
- SENTINEL shield burst → knockback AoE (phase 3+, ≤5 tile range, 20 dmg)
- HIVE homing missile → targeted shot at player (phase 1+)
- HIVE crawler spawns → 60 % crawler / 40 % drone mix (phase 2+)
- HIVE psionic shockwave → AoE pulse (phase 4, ≤7 tile range, 25 dmg)

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

### Audio Bus Architecture

All audio routes through a master gain bus (0.7) → DynamicsCompressor (threshold −12 dB, ratio 4:1) → destination. A shared ConvolverNode with a procedurally generated stereo impulse response (1.6 s, quadratic decay) provides reverb. Signature sounds (death, level-up, boss enter, descend, game over, victory) and heavy-weapon shots (Railgun, Void Cannon) send to the reverb via wet/dry split nodes. Lighter weapons (Pulse Pistol, Scatter Gun, Plasma Sword) remain dry for clarity. Both `audio.shoot()` and `audio.hit()` accept the weapon name for per-weapon sound dispatch.

A single 2-second white-noise AudioBuffer is generated once at init and reused for all noise-burst voices.

### Sound Effects

| Event            | Sound description                                                                |
|------------------|----------------------------------------------------------------------------------|
| Pulse Pistol     | Sine chirp 880→440 Hz + triangle harmonic 1760→880 Hz + noise click (default)   |
| Scatter Gun      | Base noise burst (LP 2500 Hz) + sine thump 100→50 Hz + 4 per-pellet cracks: staggered timing (8 ms apart + random jitter), ±15% pitch randomisation on square 220→110 Hz + noise (LP 600–1800 Hz) |
| Railgun          | Charge whine (sine 3200→6400 Hz + saw 1600→4800 Hz) → crack (noise LP 8000 Hz) + ring 2400→800 Hz, reverb (0.3) |
| Plasma Sword     | Melee whoosh: saw sweep 600→150 Hz + triangle 1200→300 Hz + noise transient     |
| Void Cannon      | Deep thump: sine 80→35 Hz + saw 160→60 Hz + square 320→80 Hz + noise (LP 500 Hz), reverb (0.25) |
| Enemy shoot      | Sawtooth 300→200 Hz + square sub-layer 150→100 Hz                               |
| Hit (player)     | Noise burst (LP 250 Hz) + sine thump 80→30 Hz + triangle sub 40→20 Hz          |
| Hit (enemy, Pulse Pistol) | Sine ping 600→200 Hz + triangle transient 1200→400 Hz (default)       |
| Hit (enemy, Scatter Gun)  | Quick plink: sine 800→300 Hz + noise click (LP 3000 Hz)               |
| Hit (enemy, Railgun)      | Metallic crack: noise (LP 6000 Hz) + sine ring 1800→600 Hz, reverb (0.2) |
| Hit (enemy, Plasma Sword) | Electric sizzle: saw 900→200 Hz + noise (LP 4000 Hz)                  |
| Hit (enemy, Void Cannon)  | Deep thud: sine 120→40 Hz + noise (LP 400 Hz), reverb (0.15)          |
| Enemy death      | Saw sweep 400→60 Hz + square 200→30 Hz + noise + sub thump, reverb send (0.4)  |
| Level-up         | C-E-G-C shimmer arpeggio: sine + detuned triangle pairs (±0.3%), reverb (0.5)  |
| Boss enter       | Detuned saw drones (55 Hz + 57 Hz beat) + octave swell + noise rumble + sub 27.5 Hz, heavy reverb (0.7) |
| Pick up item     | Ascending sine 400→1200 Hz + triangle 800→2400 Hz sparkle                       |
| Stairs / descend | Noise whoosh (LP 1500 Hz) + sine 1200→500 Hz + triangle 600→250 Hz, reverb (0.5) |
| Game Over        | Minor chord (A3-C4-D♯4): sine+saw layers sweeping to half-freq + sub drone, reverb (0.6) |
| Victory          | Major fanfare (C4-E4-G4-C5): sine + triangle harmonics + detuned shimmer + sustain chord, reverb (0.6) |

All envelopes use exponential ramps (floor 0.001) for natural decay. Frequencies are guarded with `Math.max(freq, 1)` for exponential ramp safety.

---

## Scoring

```
score += enemy_xp_value × floor_multiplier   (on kill)
score += 500 × floor_number                  (on floor clear)
score += remaining_hp × 10                   (on floor clear)
```

High-score table stored in `localStorage` as JSON, top 10, with player name.
When a run ends (death or victory), if the score qualifies for the top 10,
the game enters the **NAME_ENTRY** state — an arcade-style name input with a
virtual keyboard (A–Z, 0–9, DEL, OK) that works on both desktop (physical
keyboard) and touch (tap keys on canvas). Names are capped at 12 characters,
uppercased. If the score doesn't qualify, it is saved as "ANON".

The leaderboard is displayed on three screens:
- **MENU** — top 3 (compact) or 5 (landscape)
- **GAME_OVER** — top 5 (compact) or 7 (landscape), player's entry highlighted
- **VICTORY** — top 5 (compact) or 7 (landscape), player's entry highlighted

---

## HUD Layout

### Landscape (W ≥ 600 or W ≥ H) — single row

```
┌───────────────────────────────────────────────┐
│                  NEON DUNGEON          [map]  │  ← minimap top-right
│                                               │
│              [GAME CANVAS]                    │
│                                               │
│  HP ████░░  LVL ATK DEF  FLR  WEAPON  SCORE  │  ← HUD bottom (40 px)
└───────────────────────────────────────────────┘
```

### Portrait (H > W and W ≤ 600) — compact two-row

```
┌──────────────────────┐
│            [map]     │  ← minimap top-right
│                      │
│   [GAME CANVAS]      │
│                      │
│  HP ████░░  FLR  SCR │  ← row 1
│  LV XP A:n D:n WEAP │  ← row 2 (58 px total)
└──────────────────────┘
```

A shared `layout` object (`compact`, `hudH`, `hudTop`, `msgBase`) is computed
in `updateLayout()` (called from `resize()`). All bottom-area positioning —
camera Y bias, tile culling, message placement, touch button Y, ghost joystick
Y — derives from `layout` to prevent overlap.

**Compact mode gate:** `H > W && W <= 600` (orientation + logical width).

**Touch-aware text:** On touch devices, menu shows "TAP TO START" and
touch-specific control hints; game-over / victory / pause screens show
tap-based prompts instead of keyboard-only text.

---

## Screen Flow

1. **Title Screen** — animated neon logo, "PRESS ENTER TO START" (desktop) / "TAP TO START" (touch), high-score table (top 3/5), touch-specific control hints
2. **Playing** — full game loop
3. **Pause** — ESC / ‖ button, dim overlay, resume / quit options
4. **Level Transition** — cyberpunk fade with scanlines, glitch bars, noise band, chromatic-aberration text reveal, neon border pulse; 0.4 s fade-in → 0.15 s hold at peak → 0.4 s fade-out (~0.95 s total). "DESCENDING TO FLOOR N" appears character-by-character at 80 chars/s during the peak window.
5. **Name Entry** — arcade-style name input with virtual keyboard (if score qualifies for top 10). Desktop: type + Enter. Touch: tap virtual keys + OK.
6. **Game Over** — score, death floor, level, leaderboard with player's rank highlighted
7. **Victory** — cinematic text, final score, floors cleared, level, leaderboard with player's rank highlighted

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
| `icons`          | 192×192 + 512×512 PNG (`purpose: any`), plus 192×192 + 512×512 maskable variants (`purpose: maskable`, 72% inner icon on `#0a0a12` background for Android adaptive icons) |

Meta tags in `<head>`:
- `apple-mobile-web-app-capable: yes` (iOS Safari home-screen)
- `apple-mobile-web-app-status-bar-style: black-translucent`
- `mobile-web-app-capable: yes` (Android Chrome)
- `apple-touch-icon` → `icon-192x192.png`

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

### Service Worker — Offline Caching

A `sw.js` at the repository root provides offline play after first visit:

| Aspect     | Detail |
|------------|--------|
| **Cache name** | `neon-dungeon-v1` (bump version to bust cache on updates) |
| **Strategy**   | Stale-while-revalidate for navigation (HTML); cache-first for pre-cached assets; no runtime caching of unknown URLs |
| **Pre-cached** | `./`, `./index.html`, `./manifest.json`, all icon PNGs |
| **Install**    | `skipWaiting()` — new SW activates immediately |
| **Activate**   | `clients.claim()` + purge old cache versions |
| **Registration** | Separate `<script>` tag after the game script; silent `.catch()` for non-supporting browsers |

**Update flow:** Increment the version string in `CACHE` (e.g. `neon-dungeon-v2`).
The activate handler deletes all caches that don't match the new name, so users
get the fresh assets on next load.

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
| v1.3    | PWA icons: 192×192 + 512×512 PNGs added to manifest.json; apple-touch-icon link in HTML |
| v1.4    | Portrait HUD: compact two-row layout (H > W, W ≤ 600); centralized `layout` object for bottom-UI metrics; touch-aware screen prompts ("TAP TO START"); full-screen touch confirm in non-playing states |
| v1.5    | Audio polish: master gain bus + DynamicsCompressor + ConvolverNode reverb; cached noise buffer; layered oscillators for all SFX; exponential envelopes; wet/dry reverb sends for signature sounds |
| v1.6    | Weapon-specific shoot sounds: each weapon has a unique audio signature (Scatter Gun blast, Railgun charge-crack, Plasma Sword whoosh, Void Cannon thump); `audio.shoot()` accepts weapon object |
| v1.7    | Enemy variety & difficulty curve: weighted type distribution (GUARD-heavy early → PHANTOM/DRONE-heavy late), scaling enemy count per room (area-capped), elite enemies (8% on floor 3+, 1.8× HP, pulsing glow + diamond marker), aggression scaling (tighter cooldowns/detection per floor), per-room composition caps |
| v1.8    | Scatter Gun per-pellet pitch randomisation: 4 staggered cracks with ±15% pitch variation and randomised noise filters replace the static dual-noise burst |
| v1.9    | Weapon-aware hit sounds: `audio.hit()` accepts weapon name; each weapon produces a distinct enemy-impact sound (Scatter plink, Railgun crack+ring, Plasma Sword sizzle, Void Cannon thud); Projectile carries `weaponName`; fixed double-hit-sound on surviving enemies |
| v1.10   | Maskable icon variants: 192×192 + 512×512 maskable PNGs (72% inner icon, `#0a0a12` background) for Android adaptive icons; manifest updated with `purpose: maskable` entries |
| v1.11   | Service worker (`sw.js`): cache-first offline PWA; pre-caches index.html, manifest, and icon PNGs on install; `skipWaiting` + `clients.claim` for immediate activation; versioned cache name for update busting |
