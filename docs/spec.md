# NEON DUNGEON — Game Specification v2.9

## Vision

A real-time top-down cyberpunk dungeon crawler. The player descends through
procedurally generated neon-lit floors of an abandoned megacorp facility,
fighting security systems and rogue AIs to reach the core. Every run is unique.

---

## Technical Constraints

- **Delivery:** Single `index.html` file, zero external dependencies
- **Renderer:** HTML5 Canvas 2D API, dynamic resolution (fills viewport edge-to-edge; `gameScale` 0.7–1.5 keeps tiles at 14–30 CSS px)
- **Audio:** Web Audio API (synthesised — no audio files)
- **Persistence:** `localStorage` for high-score table (top 10 entries) and save game (checkpoint at floor entry; deleted on game over/victory)
- **Browser target:** Modern Chromium / Firefox (ES2020+)

---

## Game States

```
MENU → PLAYING → NAME_ENTRY → GAME_OVER
                             → VICTORY (floor 10 cleared)
                → GAME_OVER  (score doesn't qualify for top 10)
                → VICTORY    (score doesn't qualify for top 10)
     PLAYING ↔ POWERUP_CHOICE (item pickup pauses, choice resumes)
     PLAYING ↔ SHOPPING       (vendor terminal interaction)
     PLAYING ↔ READING        (lore terminal interaction)
     PLAYING ↔ PAUSED
     MENU ↔ ARCHIVES          (meta-progression upgrade shop)
```

State transitions are animated (fade in/out, 400 ms).

**POWERUP_CHOICE** appears when the player walks over an item. Gameplay
freezes and two random upgrade options are presented. The player picks one
or skips, then returns to PLAYING.

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
5. Place stairs-down in the farthest room from spawn (approximate BFS
   using line-of-sight + proximity heuristic — rooms within 20 tiles or
   with unobstructed LOS are treated as neighbours).
6. Floor 10 stairs replaced with CORE terminal (victory trigger).

**Tile types:** WALL | FLOOR | DOOR | DOOR_OPEN | LOCKED_R | LOCKED_B |
LOCKED_G | STAIRS | TERMINAL | TRAP_SPIKE | TRAP_SLOW | PLASMA | ARC | VENDOR | CRACKED | LORE | VOID

### Doors & Locked Doors

**Regular doors:** Placed at room–corridor junctions using entrance clustering.
Adjacent boundary tiles that connect to corridors are grouped into clusters.
Only narrow clusters (1–2 tiles wide) receive doors — wider openings are left
open (they are hallways, not doorways). When a cluster is doored, **all** tiles
in the cluster become `T.DOOR` (no single-door-next-to-open-tile problem). Each
eligible cluster has a 50 % chance of receiving doors.

**Locked doors (floor 2+):** Gate high-value rooms using coloured keys (red,
blue, gold). Target priority:
1. **Stair / exit room** — always first priority for locking
2. **Special rooms** (armory, medbay, shrine, vault)
3. **Random eligible rooms** (fallback, shuffled)

All narrow entrance clusters of the target room are converted to locked tiles
(same colour). Wide clusters (> 2 tiles) are walled off to prevent bypass. This
ensures the room is truly gated — one key unlocks one tile, but all entrances
are blocked.

Number of locked rooms per floor: 1 (floor 2–3), 2 (floor 4–6), 3 (floor 7+).
Keys are placed via BFS reachability from spawn to guarantee no softlocks. If a
room cannot be safely locked (no narrow clusters, or no reachable room for the
key), it is skipped and the lock budget moves to the next candidate.

### Environmental Hazards

**Plasma Vents** (floor 4+): Clusters of 2–4 orange-glowing tiles placed in
normal rooms (never in spawn, boss, or special rooms). Deal continuous burn
damage at `(3 + floor) HP/s`, bypassing defense and invincibility frames.
Animated bubbling visual with pulsing glow. Orange on minimap.

**Arc Grids** (floor 5+): Individual electrified tiles placed in corridors
(never in rooms or adjacent to doors/stairs). Pulse on a 2-second cycle
(1 s active, 1 s off) driven by `game.floorTime`. During the active phase,
deal `10 + floor × 2` HP damage per zap (0.8 s cooldown between hits),
bypassing defense. Blue/white crackling visual when active, dim when off.
Cyan on minimap (pulses with phase).

**Lighting:** Each floor tile has a computed light level (0–1) based on
distance from the nearest light source (player torch radius = 9 tiles,
static wall sconces in rooms — radius 4, 0.4× brightness). Light decays
linearly to zero at the torch edge. **Fog of war:** visited tiles retain
their peak light level permanently; lit tiles render at minimum 20%
brightness, visited tiles with zero light render at 12% brightness
(dim memory effect). Unvisited tiles are not drawn.

### Secret Rooms (Cracked Walls)

**Floor 3+, non-boss floors.** One secret room per qualifying floor. A normal
BSP room is walled off completely and one narrow entrance cluster (1–2 tiles)
is replaced with `T.CRACKED` tiles. The room is invisible to the player until
discovered.

**Candidate selection:** Rooms must not be spawn, stair, boss, vendor, or any
existing special room. Must have at least one narrow entrance cluster (≤ 2
tiles). Candidate list is shuffled; the first qualifying room is chosen.
Secret rooms are excluded from locked-door placement.

**Tile: `T.CRACKED` (value 15).** Not passable, not see-through (behaves
like a wall for movement, LOS, and BFS reachability). On the minimap, renders
identically to WALL (no spoilers). In the main view, renders as a standard
wall tile with subtle amber crack lines visible only when the player is
within 3 tiles — crack opacity scales with proximity.

**Interaction:** Press E adjacent to a cracked wall to break it. The tile
becomes `T.FLOOR` and the secret room is revealed. Breaking triggers:
`audio.wallBreak()` SFX, explosion particles, "SECRET AREA DISCOVERED"
message (amber), score bonus (300 × floor).

**Secret room mask (`secretMask`):** A per-tile boolean grid that prevents
player torch light and sconce light from marking secret-room tiles as visited
or lit. This ensures the room contents are completely invisible before reveal.

**Lazy activation:** Enemies and items are **not** spawned during floor
generation. On reveal (`revealSecretRoom`):
1. `secretMask` cleared for the room's tiles.
2. All remaining `T.CRACKED` tiles adjacent to the room become `T.FLOOR`.
3. Enemies spawned: reduced count (`1 + floor÷4` to `min(4, 2 + floor÷3)`,
   area-capped at `room.w × room.h ÷ 10`).
4. Premium loot: 2–3 `Item` drops + bonus credits
   (`round(20 × (1 + floor × 0.15))`).

**Quest interactions:**
- **EXPLORE:** Unrevealed secret rooms are excluded from the "visit every room"
  check. Revealed secret rooms count normally.
- **EXTERMINATE:** Unaffected — no enemies exist in secret rooms until reveal.
  Boss floors (3, 6, 10) never have secret rooms.
- **SPEEDRUN / PACIFIST:** Unaffected — secret rooms are optional.

**Visual style:** Room floor tiles use tint `#1a1005` (warm amber-dark).

**Audio: `audio.wallBreak()`** — crumbling rock: noise burst (LP 2 kHz) +
sine rumble 80→30 Hz + triangle sub 40→20 Hz + 3 staggered debris clinks
(sine 800–1400→half Hz).

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

On level-up: +20 MAX_HP (full heal), +3 ATK, +1 DEF. Certain levels also
unlock passive **perks** (see Level-Up Perks section under Items & Upgrades).

### Controls — Keyboard & Mouse

| Input              | Action                    |
|--------------------|---------------------------|
| WASD / Arrow keys  | Move                      |
| Mouse              | Aim                       |
| Left Click / Space | Fire weapon               |
| Shift              | Dash (dodge)              |
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
| ⇧ button (bottom-right, amber)   | Dash (dodge)                |
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

### Weapon Affixes

Weapons found on floor 2+ may roll random affixes that modify their stats and grant on-hit/on-kill effects. Each weapon can have at most one prefix (stat modifier) and one suffix (effect).

**Rarity tiers:**
- **Common** (white, no affixes) — guaranteed on floor 1
- **Uncommon** (green, 1 affix) — available floor 2+
- **Rare** (purple, 2 affixes: prefix + suffix) — available floor 4+

**Affix chance by floor:**

| Floor | No affix | 1 affix | 2 affixes |
|-------|----------|---------|-----------|
| 1     | 100%     | 0%      | 0%        |
| 2–3   | 50%      | 50%     | 0%        |
| 4–5   | 30%      | 45%     | 25%       |
| 6+    | 20%      | 40%     | 40%       |

**Prefix affixes (stat modifiers):**

| Affix    | Effect                       | Eligibility       |
|----------|------------------------------|--------------------|
| Rapid    | +30% fire rate               | All weapons        |
| Heavy    | +35% damage, −20% fire rate  | All weapons        |
| Extended | +40% range                   | Ranged only        |
| Twin     | +1 projectile, −15% damage   | Ranged only        |
| Precise  | −60% spread                  | Spread weapons only|

**Suffix affixes (on-hit / on-kill effects):**

| Affix        | Effect                                              |
|--------------|------------------------------------------------------|
| of Flame     | Ignites: 3 DPS burn for 3 s (orange particles)       |
| of Frost     | Slows: 30% speed reduction for 2 s (cyan tint)       |
| of Vampirism | Heals player for 8% of actual damage dealt            |
| of Thunder   | 20% chance chain lightning to nearest enemy within 3 tiles for 50% damage |
| of Detonation| Enemies explode on kill: 25 AoE damage in 2-tile radius (LOS-gated, also damages player at 50%) |

**Naming convention:** `"[Prefix] Base Name [Suffix]"` (e.g., "Rapid Pulse Pistol of Flame").

**Proc rules:**
- On-hit effects (burn, slow, leech, chain) trigger from both projectile hits and melee hits.
- Chain lightning and detonation AoE are "proc" damage — they do not trigger further on-hit effects (prevents recursion).
- Burn damage-over-time ticks can trigger on-kill effects (detonation).
- Detonation AoE damages the player at 50% if in range (LOS-gated), similar to VOLATILE modifier.

**Visual indicators:**
- Burning enemies: flickering orange underglow.
- Slowed enemies: cyan tint overlay.
- Chain lightning: jagged yellow bolt between targets (0.15 s fade).
- Weapon name in HUD uses rarity colour (green for uncommon, purple for rare).
- Upgrade/vendor cards show rarity border glow and affix descriptions.

**Save format:** weapon saved as `{ _base: 'PULSE_PISTOL', _affixes: ['RAPID', 'FLAME'] }` instead of plain key string. `buildWeapon()` deterministically reconstructs from base + affixes on load (no re-rolling).

**Implementation:** `buildWeapon(baseKey, affixIds)` for deterministic construction; `rollWeapon(baseKey, floor)` for random generation. `applyHitEffects(enemy, actualDmg, hitCtx)` centralizes on-hit logic. `applyOnKill(enemy)` handles detonation. `tickEnemyStatusEffects(enemy, dt)` processes burn/slow per frame. Enemy class stores `burnTimer`, `burnDps`, `slowTimer`, `slowFactor`, `_lastHitCtx`.

### Level-Up Effects (automatic on XP threshold)

- MAX_HP +20, HP fully restored
- ATK +3
- DEF +1
- Brief screen flash + sound sting

### Dash (Dodge)

The player can perform a short burst-dash to evade attacks. Available from
floor 1 with no unlock requirement.

| Property       | Value                                              |
|----------------|----------------------------------------------------|
| Keybind        | Shift (keyboard), ⇧ button (touch)                |
| Direction      | Movement direction if moving; facing direction otherwise |
| Speed          | 18 tiles/sec (~5× normal walk speed)               |
| Duration       | 0.12 s (~2.2 tiles travel)                         |
| Cooldown       | 1.5 s (shown on HUD when active)                  |
| Invulnerability| Player has i-frames for the entire dash duration   |
| Collision      | Wall collision ends the dash early                 |
| Visual         | Amber afterimage trail (up to 8 ghosts, fade 0.25s), amber spark particles |
| Audio          | Whoosh (rising noise burst + descending sine sweep) |

During a dash, normal movement and shooting are suppressed. The player cannot
dash while dead or while the cooldown is active.

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
| SHIELDER     | 50      | 10  | Frontal shield blocks projectiles, melee    | 25  |
| SPLITTER     | 40      | 8   | Splits into 2 SHARDs on death               | 25  |
| GRENADIER    | 30      | 10  | Lobs grenades creating AoE damage zones     | 20  |
| TELEPORTER   | 25      | 12  | Blinks around room, fires ranged bursts      | 22  |

HP and ATK scale: `value × (1 + 0.15 × (floor - 1))`

**Floor-gated types:** SHIELDER appears floor 3+, SPLITTER appears floor 4+,
GRENADIER appears floor 5+, TELEPORTER appears floor 6+.
Floor-gated types are excluded from both weighted selection and cap-reroll pools
on floors below their minimum.

#### SHIELDER (floor 3+)

Shield-bearing enemy with a 120° frontal arc that deflects non-piercing player
projectiles. Slowly advances toward the player when in LOS. Player must flank
(shoot from behind/sides), use piercing weapons (Railgun), or melee to bypass
the shield. Shield orientation only updates when the player is in line of sight
— the shielder does not track through walls.

- **Shield arc:** ±60° from facing direction (120° total)
- **Deflection:** Non-piercing `fromPlayer` projectiles within the arc are
  destroyed on contact (cyan sparks + `shieldDeflect` SFX). Piercing weapons
  and saw blade orbitals are unaffected.
- **Visual:** Cyan arc drawn at shield radius, pulsing with `bobAngle`
- **Colour:** `#66eeff` (cyan-white)
- **Credits:** 10

#### GRENADIER (floor 5+)

Ranged area-denial enemy that lobs grenades creating temporary hazard zones.
Prefers to stay at 6–12 tile range; retreats if player closes to within 5 tiles
(falls back to patrol if retreat is wall-blocked).

- **Grenade:** Projectile (speed 6) aimed at player's current position. On wall
  hit or reaching target, detonates into a **hazard zone** (1.5 tile radius,
  3 s duration, 0.8 s damage tick cooldown). Zone damage equals the grenadier's
  scaled ATK. LOS check prevents damage through walls.
- **Cooldown:** `max(2.5, 3.5 − floor × 0.1)` seconds between lobs
- **Visual:** Larger orange projectile with pulsing warning ring; zone rendered
  as semi-transparent pulsing orange circle below enemies
- **Colour:** `#ff6622` (orange)
- **Credits:** 7

#### SPLITTER (floor 4+)

Fragmentation enemy that splits into 2 smaller SHARD copies on death, forcing
players to manage kill order and swarming. Approaches the player at medium
speed; gains a 30% speed boost below 30% HP as a visual warning that it is
about to split.

- **Split mechanic:** On death, queues 2 SHARD enemies at the death position
  (±1 tile random offset, validated for passability). Spawns are deferred to
  the next frame via `pendingEnemySpawns` to prevent same-frame attacks.
- **SHARD stats:** HP 15, ATK 5, SPD 3.5, XP 8. Uses fast zigzag chase AI
  (similar to CRAWLER). SHARDs spawn with a 0.5 s attack lockout.
- **SHARD economy:** SHARDs drop no items and award 0 credits. XP is minimal
  (8) to prevent economy inflation from split kills.
- **SHARDs do not split** — only the parent SPLITTER fragments.
- **Visual:** SPLITTER is green (`#00ff88`), SHARDs are darker green
  (`#00cc66`) and drawn at 62.5% size (0.25 tile vs 0.4 tile).
- **Audio:** `enemySplit()` — digital fracture sound (twin rising square waves
  + noise crackle).
- **Cap:** 2 SPLITTERs per room (SHARDs are uncapped since they are transient).
- **Credits:** 9 (SHARD: 0)
- **Modifier interactions:**
  - SWARM (0.6× HP): SPLITTERs split faster — intentional chaos amplification
  - FORTIFIED (1.4× HP): Harder to split, fewer SHARDs overall
  - VOLATILE: Deferred spawns are safe from the parent's explosion chain;
    VOLATILE-killed SPLITTERs still split

#### TELEPORTER (floor 6+)

Spatial disruptor that blinks to random positions within its room and fires
quick ranged bursts before relocating. Unlike the PHANTOM (stealthy melee),
the TELEPORTER is always visible but spatially unpredictable — it punishes
players who camp in one spot and rewards target tracking.

- **Teleport cycle:** Every `max(2.0, 3.0 − floor × 0.1)` seconds, blinks to a
  random passable tile within the same room. Leaves a fading magenta afterimage
  at the departure point (0.6 alpha → 0 over ~0.4 s). On arrival, 0.4 s
  materialise window (reduced alpha, cannot attack). After materialising, fires
  2 quick projectiles at the player (0.25 s apart, speed 8, range 14).
- **Emergency blink:** If the player closes to within 2 tiles and the teleporter
  has been idle long enough (cooldown > 0.8 s, not materialising), the cooldown
  is forced to 0, triggering an immediate escape blink next frame. The
  materialise guard prevents frame-loop re-triggers.
- **Stats:** HP 25, ATK 12, SPD 0 (no walking movement), XP 22.
- **Visual:** Hot magenta (`#ff44ff`), rapid alpha flicker
  (`0.7 + sin(bobAngle × 8) × 0.3`) to suggest spatial instability. During
  materialise: alpha ramps from 0.3 → 0.7 over 0.4 s.
- **Audio:** `teleport()` — descending sine + square sweep + high noise pop
  ("zwip" translocate sound).
- **Colour:** `#ff44ff` (hot magenta)
- **Credits:** 8
- **Cap:** 1 per room.
- **Modifier interactions:**
  - OVERCLOCK (÷1.2 cooldowns): Teleport cycle shortened proportionally
  - SWARM (0.6× HP): Even more fragile — reward for fast target acquisition
  - BLACKOUT: Harder to spot the flicker in reduced torch radius

### Difficulty Modes

Three selectable difficulty levels, chosen from the main menu on the NEW GAME
row using ◀▶ (keyboard: arrow keys; touch: tap left/right edges). The last
selection persists in `neonDungeonMeta.lastDifficulty`. Continued runs restore
the difficulty from the save file.

| Parameter     | EASY        | NORMAL      | HARD        |
|---------------|-------------|-------------|-------------|
| Enemy HP      | ×0.75       | ×1.0        | ×1.25       |
| Enemy ATK     | ×0.75       | ×1.0        | ×1.15       |
| Enemy SPD     | ×1.0        | ×1.0        | ×1.05       |
| Item drop     | 28%         | 20%         | 18%         |
| Credit mult   | ×1.2        | ×1.0        | ×1.0        |
| XP mult       | ×1.0        | ×1.0        | ×1.15       |
| Elite rate    | 4%          | 8%          | 12%         |
| Shard mult    | ×0.85       | ×1.0        | ×1.3        |
| Env damage    | ×0.75       | ×1.0        | ×1.15       |

**Multipliers apply to:** `spawnEnemy()` stats (HP/ATK/SPD stacked with floor
scaling), elite roll chance, item drop rate in `Enemy.die()`, credit drops
(stacked with meta Scavenger), XP from kills (stacked with meta Quick Learner),
shard payout (run-earned portion only — meta PERSISTENCE flat bonus is unscaled),
environmental damage (traps, plasma, arc), and boss special attack damage.

**Design intent:**
- EASY reduces incoming threats and increases economy — accessible entry.
- HARD increases enemy durability and elite pressure; rewards with more XP and
  shards per run — risk/reward, not punishment. Credits stay at ×1.0 so the
  in-run economy isn't double-nerfed.

**HUD:** Non-NORMAL difficulty shows a coloured `[EASY]` or `[HARD]` badge below
the minimap. Shown on GAME_OVER and VICTORY screens. CONTINUE menu item shows
the save's difficulty.

### Floor Modifiers (floor 2+, non-boss)

Each qualifying floor randomly receives one gameplay modifier from a pool of six.
Floor 1 (settle-in) and boss floors (3, 6, 10) never have modifiers. Modifier is
rolled on floor entry, saved in the checkpoint, and restored on continue. No
SAVE_VERSION bump — old saves default to `modifier: null` (no modifier).

| Modifier   | Icon | Description                    | Colour    | Effect |
|------------|------|--------------------------------|-----------|--------|
| BLACKOUT   | ◐    | Emergency lights only          | `#4466aa` | Player torch radius 9→5 (enemy AI unaffected) |
| SWARM      | ⚠    | Alert — all units respond      | `#ff6644` | ×1.5 enemy count per room (area-capped), ×0.6 enemy HP |
| FORTIFIED  | 🛡   | Reinforced patrols             | `#66eeff` | ×1.4 enemy HP, ×1.3 item drop rate |
| VOLATILE   | 💥   | Unstable power cells           | `#ff4422` | Enemies explode on death: 15 + floor×2 AoE damage in 2-tile radius (LOS-gated); no chain reactions; player rewards normal but AoE-killed enemies don't chain |
| SCRAMBLED  | ⌁    | Targeting interference         | `#cc44ff` | +0.15 added to weapon spread on all player shots |
| OVERCLOCK  | ⚡   | System overclock detected      | `#ffcc00` | ×1.2 all movement speed (player + enemies) and ×1.2 enemy fire rates (÷1.2 attack/shoot cooldowns) |

**Implementation hooks:**
- BLACKOUT: `updateLighting()` torch radius conditional on `game.modifier`.
- SWARM: `populateFloor()` + `revealSecretRoom()` count multiplier; `spawnEnemy()`
  HP multiplier applied before `new Enemy()` (keeps `maxHp` in sync).
- FORTIFIED: `spawnEnemy()` HP multiplier (same pattern as SWARM);
  `Enemy.die()` drop rate boost.
- VOLATILE: `Enemy.die()` AoE — marks targets with `_volatileKill` flag to
  prevent recursion. Uses `hasLOS()` to avoid through-wall damage.
- SCRAMBLED: `Player.shoot()` spread addend.
- OVERCLOCK: `modSpeed(base)` helper used in `moveToward()` (all enemies) and
  player movement; cooldown divisor in `aiTurret`, `aiDrone`, `aiGrenadier`,
  `meleeAttack`.

**Display:**
- On floor entry: message via `game.msg()` (300 ms delay) showing icon + name
  + description in modifier colour.
- HUD: modifier label below `FLR:N` in both compact and landscape layouts.
- `getMod()` accessor returns `FLOOR_MODIFIERS[game.modifier]` or `null`.

**Save format:** `modifier` field added to save object (string key or `null`).
`loadFloor(n, savedModifier)` accepts optional second argument: if provided,
uses saved value instead of rolling fresh. `continueGame()` passes
`save.modifier` through.

### Difficulty Curve

**Weighted type distribution:** Each enemy type has a base weight and per-floor
modifier. Early floors are GUARD-heavy (~50% on floor 1); later floors shift
toward PHANTOMs and DRONEs (~29% and ~22% on floor 10). Weights use
`max(1, base + perFloor × (floor − 1))`.

| Type      | Base weight | Per-floor | Min floor |
|-----------|-------------|-----------|-----------|
| GUARD     | 40          | −3        | —         |
| TURRET    | 20          | +1        | —         |
| CRAWLER   | 10          | +3        | —         |
| PHANTOM   | 5           | +4        | —         |
| DRONE     | 5           | +3        | —         |
| SHIELDER  | 3           | +2        | 3         |
| SPLITTER  | 2           | +2        | 4         |
| GRENADIER | 1           | +2        | 5         |
| TELEPORTER| 1           | +2        | 6         |

**Scaling enemy count per room:**
`count = min(areaCap, rndInt(2 + floor÷3, min(8, 4 + floor÷2)))` where
`areaCap = floor(room.w × room.h ÷ 8)`. Floor 1 averages 2–4 per room;
floor 10 averages 5–8 (capped by room area).

**Per-room composition caps:** max 2 turrets, max 2 drones, max 2 splitters,
max 1 phantom, max 1 shielder, max 1 grenadier, max 1 teleporter per room.
Excess rolls reroll among uncapped, floor-eligible types; final fallback is
GUARD.

### Elite Enemies (floor 3+)

Base 8% chance per spawn on floor 3 and above (scaled by difficulty: 4% EASY,
12% HARD). Maximum 1 elite per room. Never applied to bosses or boss-summoned adds.

| Stat     | Multiplier |
|----------|------------|
| HP       | ×1.8       |
| ATK      | ×1.3       |
| SPD      | ×1.15      |
| XP value | ×1.25      |

**Visual:** Pulsing neon glow (oscillating `shadowBlur` driven by `bobAngle`)
and a diamond marker above the enemy (coloured by affix). Elite HP bars render
in white instead of the type colour. Glow colour matches the elite affix.

#### Elite Affixes

Every elite enemy spawns with exactly one random affix that grants a special
ability. Each affix creates a distinct tactical challenge requiring different
player strategies.

| Affix        | Colour    | Behaviour                                                         |
|--------------|-----------|-------------------------------------------------------------------|
| SHIELDED     | `#4488ff` | Energy shield absorbs damage (40% of max HP). Regenerates 8 HP/s after 2 s of not being hit. Must break shield before dealing HP damage. Blue ring visual, separate shield bar above HP bar. |
| BERSERKER    | `#ff2222` | Speed and attack rate increase as HP drops (up to +50% at 0 HP). Red aura intensifies with missing HP. Affects movement, melee cooldown, and ranged shoot cooldown. |
| REGENERATING | `#22ff44` | Heals 2.5% of max HP per second. Green particles when healing. Forces sustained aggression — letting a Regenerating elite disengage means fighting full HP again. |
| PHASING      | `#cc88ff` | Cycles on a 4 s timer: 3 s vulnerable, 1 s invulnerable. Ghost flicker and semi-transparency during immune window. `audio.phaseShift()` plays on phase-in. Not rolled on PHANTOMs (redundant with invisibility). |

**Minimap:** Elite enemies render as 3 px dots in their affix colour (vs 2 px
red for normal enemies).

**Implementation:** `ELITE_AFFIXES` table + `rollEliteAffix(enemyType)` for
random selection with eligibility filtering. `tickEliteAffix(enemy, dt)` handles
per-frame logic (shield regen, HP regen, phase cycling). `berserkerMul()` method
on Enemy returns speed/cooldown multiplier. Shield absorption handled in
`takeDamage()` before HP damage. Phasing immunity checked at top of
`takeDamage()`. Enemy class stores `eliteAffix`, `shieldHp`, `shieldMax`,
`shieldRegenDelay`, `phaseTimer`, `phaseImmune`.

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

Boss arenas: minimum 15×15 rooms (expanded from BSP if needed), sealed on entry.
When the player enters a boss room, corridor entrance tiles become WALL (red glow
on minimap and main view), trapping both player and boss inside. The seal triggers
only when the player is inside the room AND not standing on an entrance tile — this
prevents the seal from creating a wall under the player's feet. If the player is
somehow on a sealed tile, they are nudged to the room center. Drones inside a
sealed room respect walls. Boss knockback effects clamp to room bounds.
Boss-summoned adds (HIVE crawlers, OMEGA drones/crawlers) cannot be elite.
All boss HP values are scaled by the floor modifier (`1 + 0.15 × (floor − 1)`).
Phase thresholds use `maxHp` percentages, so scaling does not break phases.

On boss death, the arena unseals (entrance tiles restored) and the game displays
"{BOSS NAME} DESTROYED". On floor 10, the CORE terminal is locked until OMEGA CORE
is defeated.

#### OMEGA CORE — Phase Breakdown

Phase thresholds (by % of scaled max HP):

| Phase | HP Range     | Speed | Attacks Unlocked                              |
|-------|-------------|-------|------------------------------------------------|
| 1     | 100 %–70 %  | 1.0×  | Rotating radial shots + homing missile         |
| 2     | 70 %–40 %   | 1.2×  | + Crawler/drone spawns (2 adds per wave)       |
| 3     | 40 %–20 %   | 1.5×  | + Piercing beam fan (5) + shield burst (≤5 tiles) |
| 4     | 20 %–0 %    | 2.0×  | + Void orbs + psionic shockwave (≤7 tiles) + 3 adds/wave + 7-beam fan |

Phase transitions trigger an explosion particle burst, a phase-shift audio
sting, and a HUD warning (`⚠ OMEGA PHASE N` / `⚠ HIVE PHASE N`).

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

## Items & Upgrade System

### Powerup Choice UI

Items are dropped by enemies (20 % chance) or placed in rooms (1–3 per room).
Walking over an item **pauses gameplay** and presents a choice overlay with
two random upgrades. The player picks one or skips (taking neither). This
replaces the previous auto-pickup behaviour.

**Choice generation:** Two options are drawn from the combined upgrade pool
(instant, persistent, and weapon types). Both options must be different.
Persistent upgrades that have reached their max level are excluded.
There is a 20 % chance one option is a pre-rolled weapon showing exact stats.

**Controls:**
- Keyboard: `1`/`2` direct pick, `←`/`→` + `Enter` to select, `3`/`Esc` to skip
- Touch: tap a card or the Skip button

### Upgrade Pool

**Instant upgrades (one-time, no stacking):**

| ID | Name | Effect | Rarity |
|----|------|--------|--------|
| MED_PACK | Med-Pack | +40 HP (capped at MAX_HP) | 40 |
| NANO_REPAIR | Nano-Repair | +15 HP | 35 |
| XP_CHIP | XP Chip | +50 XP | 20 |
| VOID_SHARD | Void Shard | +1 void bomb charge | 4 |

**Weapon upgrades (pre-rolled, shows exact weapon name and stats):**

When a weapon option is generated, a specific weapon is pre-rolled from the
full weapon table. The choice card shows the weapon name, damage, fire rate,
and range so the player can make an informed decision.

**Persistent upgrades (stackable across the run):**

| ID | Name | Max Lv | Per-Level Effect | Rarity |
|----|------|--------|-----------------|--------|
| SAW_BLADE | Saw Blade | 4 | +1 orbital blade, 12 dmg each (LOS-gated) | 12 |
| PLASMA_ORB | Plasma Orb | 3 | Auto-fires homing orb; cooldown: 3 / 2.3 / 1.6 s | 10 |
| NANO_REGEN | Nano Regen | 5 | +1 HP/s passive regeneration | 15 |
| OVERCLOCK | Overclock | 3 | +0.5 permanent speed per level | 10 |
| ARMOR_UP | Reinforced Armor | 5 | +3 permanent DEF per level | 12 |
| RICOCHET | Ricochet Module | 3 | Bullets bounce off walls (1/2/3 bounces) | 8 |

### Orbital Weapons (Saw Blade)

Saw Blades orbit the player at 1.5 tile radius, rotating at 3 rad/s. Each
blade deals 12 damage on contact with a 0.5 s per-enemy cooldown. Damage
requires line-of-sight (blades cannot hit through walls). Rendered as
spinning neon-red rectangles with glow. Levels 1–4 add additional blades
evenly spaced around the orbit.

### Auto-Spells (Plasma Orb)

Plasma Orb auto-fires a homing projectile at the nearest enemy within range
every `3 − (level−1) × 0.7` seconds. Homing uses lerp-based steering at
8 rad/s turn rate. Projectile: 25 damage, range 10, speed 6, colour #ff44cc.
Uses the existing Projectile class with a `homing` target reference.
Homing projectiles do **not** receive ricochet — bouncing would fight the
homing steering and waste bounces.

### Ricochet Module

Player projectiles bounce off walls instead of dying on impact. Each level
adds one bounce (1 / 2 / 3). Bouncing uses axis-separated wall detection to
determine the reflection axis (horizontal, vertical, or corner). Range
continues counting through bounces — bullets are not infinite.

**Mechanics:**
- On wall hit, the projectile reverts to its pre-move position, reflects the
  appropriate velocity component(s), and nudges 0.05 tiles along the new
  direction to prevent re-collision.
- `hitEnemies` set is preserved across bounces (no re-hitting the same enemy).
- Piercing and ricochet are orthogonal: a piercing bullet bounces but still
  pierces through enemies as normal.
- Out-of-bounds hits (map edge) always kill the projectile — no bouncing off
  the void.
- Melee weapons (Plasma Sword) are unaffected.
- Scatter Gun pellets each bounce independently (range 5 keeps chaos bounded).

**Audio:** Metallic ping + high-frequency zing on each bounce.
**Visual:** Cyan (#00ffff) spark particles at bounce point. Fading cyan trail
behind bouncing projectiles — a short line of recent positions rendered with
increasing opacity toward the projectile head. Trail starts from the moment the
projectile is fired (not just after the first bounce), highlighting the ricochet
path through walls.

### Removed Items

- **SHIELD CELL** — replaced by ARMOR_UP (permanent DEF per level)
- **WEAPON CRATE** — replaced by pre-rolled weapon upgrades showing exact stats
- **OVERCLOCK (timed)** — replaced by persistent OVERCLOCK (permanent speed)

### Level-Up Perks

Passive abilities unlocked automatically when the player reaches a specific
level. Unlike the powerup choice system, perks require no player input — they
activate instantly with a "⚡ PERK: {name}" message.

Perk unlock checks run **inside** the level-up loop so multi-level jumps
(e.g., gaining enough XP to go from level 1 to 3) trigger all intermediate
perks.

| Level | Perk | Effect |
|-------|------|--------|
| 2 | Laser Sight | Dashed neon line from player in facing direction, stops at impassable tiles. Colour matches current weapon. Hidden for melee weapons. Range matches weapon range. |
| 4 | Threat Sense | Directional chevrons on screen edges pointing toward off-screen enemies within 18 tiles. Closer enemies produce larger, brighter indicators. Boss indicators are red; normal enemies are orange-red. Invisible phantoms are excluded. |
| 6 | Piercing Rounds | All player projectiles (weapon shots and Plasma Orb) pass through one additional enemy before stopping. Stacks with weapon-native piercing (Railgun already pierces infinitely, so no visible change). Implemented via `maxPierces` counter on `Projectile`. |
| 8 | Energy Shield | A protective shield that absorbs one hit completely (no HP loss). After breaking, recharges over 30 s of gameplay time (pauses during menus/transitions). Visual: pulsing blue ring around the player while active. HUD shows `🛡 Ns` countdown while recharging. Does **not** block environmental hazards (plasma vents, arc grids) that bypass `takeDamage()`. |
| 10 | Auto-Laser | Every 2.5 s, fires an instant hitscan beam at the nearest visible enemy within 12 tiles. Deals 20 flat damage (unscaled by player ATK). Requires line-of-sight; invisible phantoms excluded. Visual: bright crimson beam with white core, fades over 0.15 s. `audio.autoLaser()` zap SFX. |

**Laser Sight details:**
- Ray uses `isPassable()` collision (same as projectiles) so the line
  accurately represents where shots will travel, including stopping at
  closed/locked doors.
- Rendered as a dashed line (4 px dash, 4 px gap) at 35 % opacity with
  `shadowBlur` glow in the weapon's colour, plus a small endpoint dot at
  60 % opacity.
- Step size: 0.15 tiles per iteration (max ~133 steps for Railgun range 20).
- Not drawn for melee weapons (Plasma Sword hits a full radius, not a line).

**Threat Sense details:**
- Chevrons are right-pointing triangles rotated toward the enemy's direction from
  the player, clamped to a 14 px margin inside the viewport edges.
- Proximity factor `(1 - (dist-1)/(range-1))` scales chevron size (5–8 px) and
  base opacity (0.35–0.70). A `sin(Date.now()/200)` oscillation adds ±0.2 pulse.
- Enemies already visible within the viewport (with 1-tile padding) are excluded.
- Boss enemies use `#ff3333`; normal enemies use `#ff6644`. Both have matching
  `shadowBlur` glow.
- Range: 18 tiles from the player — covers roughly two rooms in any direction.

**Piercing Rounds details:**
- Adds +1 to `maxPierces` on every player-owned projectile (weapon shots via
  `player.shoot()` and auto-cast Plasma Orbs).
- Projectile tracks hit enemies in `hitEnemies` Set. Dies when
  `hitEnemies.size > maxPierces`. Base `maxPierces` is 0 (normal) or `Infinity`
  (Railgun's native piercing).
- Railgun + Piercing Rounds: `Infinity + 1 = Infinity` — no behavioural change
  for already-infinite-pierce weapons.
- Enemy projectiles are unaffected (they never have `fromPlayer === true`).

**Energy Shield details:**
- State: `player.energyShield` (boolean, active/broken), `player.energyShieldTimer`
  (seconds remaining until recharge).
- On perk unlock: shield activates immediately (`energyShield = true`).
- On hit absorbed: shield breaks, 30 s recharge timer starts, player gets 0.3 s
  brief invincibility (prevents same-frame multi-hit), "🛡 SHIELD BROKEN" message,
  blue explosion particles, `audio.shieldBreak()` SFX.
- On recharge complete: shield restores, "🛡 SHIELD RESTORED" message,
  `audio.shieldRestore()` ascending chime SFX.
- Timer ticks in `player.update()` — only advances during `PLAYING` state, so it
  pauses during menus, fade transitions, and powerup choice screens.
- Shield does **not** block: plasma vent burns, arc grid zaps, or any damage
  applied via direct `player.hp` reduction. Only `takeDamage()` calls are intercepted.
- Spike traps (which use `takeDamage()`) **are** blocked by the shield.
- Visual: 12 px radius pulsing circle (`sin` wave ±0.15 opacity around 0.25 base)
  with `#4488ff` colour and `shadowBlur` glow, drawn over the player body.
- HUD: `🛡 Ns` countdown in `#4488ff` shown in both compact and landscape layouts
  while recharging. Hidden when shield is active (the visual bubble is sufficient).

**Auto-Laser details:**
- State: `player.autoLaserTimer` (seconds until next beam), `player.autoLaserBeam`
  (`{x1,y1,x2,y2,timer}` or `null`).
- Cooldown: 2.5 s. Timer only resets on a **successful hit** — if no valid target
  is in range, the timer stays at 0 and fires immediately when one appears.
- Target selection: nearest living, visible enemy within 12 tiles with clear
  line-of-sight (`hasLOS()`). Invisible phantoms excluded.
- Damage: 20 flat (not scaled by `player.atk`), applied via `enemy.takeDamage()`.
  Affected by enemy defense. Weapon name: `'Auto-Laser'`.
- Visual: drawn in `player.draw()` before the player body. Dual-layer beam:
  outer `#ff2222` glow (2.5 px, `shadowBlur` 14, 60 % alpha) + inner `#ffffff`
  core (1 px, full alpha). Both fade linearly over 0.15 s. Red spark particles
  at the impact point.
- Audio: `audio.autoLaser()` — high-pitched sine zap (3000→800 Hz) + square
  harmonic (1500→400 Hz) + noise burst through reverb bus.
- Save compatibility: existing saves load perks from JSON, then `checkPerkUnlocks()`
  re-runs for all levels up to `player.level`. Saves from before Auto-Laser was
  added will retroactively unlock it on load if the player is level 10.

### Vendor / Shop System

**Credits:** A spendable currency earned by killing enemies. Each enemy type
has a base credit value: GUARD 8, TURRET 6, CRAWLER 4, PHANTOM 12, DRONE 5,
SHIELDER 10, GRENADIER 7, SENTINEL 80, HIVE 120, OMEGA 200. Credits scale with floor:
`Math.round(base × (1 + floor × 0.15))`. Credits are displayed on the HUD
(green `◈` symbol) and saved/restored with the checkpoint system.

**Vendor rooms (floor 2+, non-boss floors):** One vendor room is placed per
qualifying floor, chosen independently from the regular special room rotation
(armory/medbay/shrine/vault). The vendor room has a green-tinted floor
(`#0a1a0f`), and a `T.VENDOR` terminal tile at its centre — a green `◈` glyph
with neon glow. Vendor rooms are **excluded from lock placement** — the shop
must always be freely accessible. The vendor terminal appears as bright green
on the minimap.

**Interaction:** Press E within 1.5 tiles of the vendor terminal to enter the
`SHOPPING` game state. A proximity hint ("Press E at vendor") appears at 2
tiles. `audio.vendorOpen()` plays an ascending three-tone chime on entry.

**SHOPPING state:**
- Overlay: dark background, "VENDOR TERMINAL" title in green, player's credit
  balance, three item cards with prices, and a LEAVE button.
- **Keyboard:** 1/2/3 to buy directly, ←/→ to select + Enter to confirm,
  Escape/Q to leave.
- **Touch:** tap a card to buy, tap LEAVE to exit. Touch input is routed via
  mouse coordinates (same pattern as `POWERUP_CHOICE`).
- Items that cost more than the player's credits show "NOT ENOUGH" in red.
- Sold items display a greyed "SOLD" card. If all three items are sold, the
  shop auto-closes after a brief 400 ms delay.
- `audio.purchase()` plays a coin-drop bleep on successful buy.
  `audio.purchaseFail()` plays a low buzz on insufficient credits.

**Shop inventory:** Generated at floor load time (deterministic per floor, not
per visit). Three items per shop:
1. A **Full Repair** option (restores all HP, costs `50 + floor × 12`).
2. If the floor has locked doors the player cannot currently open: a matching
   **coloured Key** (costs `80 + floor × 8`). Otherwise a random upgrade.
3. A random upgrade from the UPGRADES pool (instant, persistent, or weapon).
   Persistent upgrades already at max level are excluded. Prices are explicit
   per upgrade ID (not derived from spawn rarity), increased by floor
   (`base + floor × 5`) and by current upgrade level (`× (1 + level × 0.4)`).

On shop open, maxed persistent upgrades are revalidated and marked as sold.

**Tile:** `T.VENDOR` (value 14). Passable, see-through. Arc grids will not
spawn adjacent to vendor terminals.

---

## Meta-Progression — Neural Archives

Persistent upgrades that carry across runs. Currency: **Data Fragments (◆)**,
stored in `localStorage` key `neonDungeonMeta` (separate from run saves).

### Data Fragment Earnings (end of every run)

| Source                    | Fragments          |
|---------------------------|--------------------|
| Floors reached            | 1 per floor        |
| Bosses cleared            | 2 per boss killed  |
| Victory (floor 10)       | +5 bonus           |
| Score                     | 1 per 2000 pts (cap 5) |
| Data Persistence upgrade  | +3 flat per level  |

Fragments are tracked via `bossesCleared` counter on the game object (incremented
on boss death, reset on `startGame()`, saved/loaded with checkpoints). Calculation
uses `calcRunShards(floor, score, bossesCleared, victory)`.

### Permanent Upgrades

Accessible from the **NEURAL ARCHIVES** menu screen (new game state: `ARCHIVES`).

| ID              | Name               | Effect                        | Max Lv | Costs (per lv) |
|-----------------|--------------------|-------------------------------|--------|-----------------|
| VITAL_BOOST     | Vital Systems      | +10 max HP                    | 3      | 5 / 12 / 22    |
| SCAVENGER       | Scavenger Protocol | +15% credit gain              | 3      | 5 / 12 / 22    |
| QUICK_LEARNER   | Quick Learner      | +15% XP gain                  | 3      | 5 / 12 / 22    |
| ARMOR_PLATING   | Armor Plating      | +1 starting DEF               | 3      | 8 / 18 / 30    |
| STARTING_GEAR   | Weapon Cache       | Start with random weapon      | 1      | 25              |
| PERSISTENCE     | Data Persistence   | +3 fragments per run (flat)   | 2      | 12 / 25         |

**Total cost to max all upgrades:** 5+12+22 + 5+12+22 + 5+12+22 + 8+18+30 + 25 + 12+25 = 235◆

**Weapon Cache pool:** Scatter Gun, Railgun, Plasma Sword, Void Cannon (excludes
Pulse Pistol — starting weapon is always an upgrade).

Meta upgrades are applied in `startGame()` via `applyMetaToPlayer(player)` after
`Player` constructor runs. `gainXP()` multiplies by `getMetaXPMultiplier()`;
enemy credit drops multiply by `getMetaCreditMultiplier()`.

### Menu Integration

The main menu always shows NEURAL ARCHIVES as the last option (with current shard
balance). Menu is array-driven via `getMenuOptions()` — supports 2–3 items depending
on save state. Touch hit-testing uses closest-option matching.

### Save Format

```json
{
  "shards": 42,
  "upgrades": { "VITAL_BOOST": 1, "SCAVENGER": 2 },
  "stats": { "totalRuns": 15, "totalShards": 120, "bestFloor": 8, "victories": 1 }
}
```

### End-of-Run Display

GAME_OVER and VICTORY screens show `◆ +N Data Fragments` below the score summary.

---

## Visual Style

- **Palette:** Near-black backgrounds (#0a0a12), neon cyan (#00f5ff),
  neon magenta (#ff00c8), neon green (#39ff14), amber (#ffb700)
- **Player:** Cyan humanoid silhouette, direction indicator
- **Enemies:** Colour-coded: Guards = red, Turrets = amber, Crawlers = green,
  Phantoms = purple, Drones = blue
- **Bosses:** Large sprites with glow halos
- **Particles:** Sparks, blood pixels, muzzle flash, explosion rings
- **Damage numbers:** Floating text pops up on every hit — white for normal enemy
  damage, yellow (#ffcc00) for killing blows, red (#ff4444) for player damage,
  blue (#4488ff) for shield blocks. Numbers rise and decelerate over ~0.7 s.
  Capped at 20 simultaneous texts. Frame-rate-independent damping.
- **Screen shake:** Camera shakes on player damage (intensity scales with damage,
  capped at 8 px), shield breaks (4 px), volatile explosions (6 px), and void
  shard detonation (10 px). Linear decay over 0.15–0.3 s. Render-only — does
  not affect aim or game logic. Reset on floor transitions.
- **HUD:** Semi-transparent panel bottom-left (HP bar, weapon, floor, score)
- **Minimap:** Top-right corner, 120×80 px, fog-of-war (visited rooms only).
  POI markers: visited key locations get larger pulsing glow markers drawn above
  tile/enemy layers — stairs/terminal (white, 3 px), vendor (green, 3 px), lore
  (amber, 2 px), sealed boss entrance (red, 4 px, fast pulse). Player dot (cyan,
  4 px) always on top.
- **Glow FX:** `ctx.shadowBlur` on all neon elements
- **Ambient particles:** Separate `ambientParticles[]` array (cap 80) with
  five emitter types that spawn in visited, non-secret tiles within torch radius:
  - **DUST** — slow-drifting motes in rooms/corridors (white/cyan, α 0.06–0.18,
    3–6 s life, sinusoidal drift). Spawn rate ~0.8% per visible floor tile per tick.
  - **EMBER** — rising orange sparks from `T.PLASMA` tiles (α 0.3–0.6,
    0.6–1.2 s life). ~15% chance per visible plasma tile per tick.
  - **ZAP** — electric micro-flashes on active `T.ARC` tiles (white core + cyan
    glow, α 0.5–0.9, 0.08–0.18 s life). ~12% chance when arc phase is on.
  - **STEAM** — faint grey wisps rising from `T.CRACKED` walls within 4 tiles
    of player (α 0.06–0.14, 1–2 s life). ~6% chance per tick.
  - **WISP** — red energy motes near sealed boss entrance walls (α 0.2–0.45,
    0.8–1.8 s life, glow halo). ~18% chance per tick.
  Spawned via timer (0.08 s interval), max 3 new per tick. Soft fade-in/out via
  combined life ramps. Drawn after `drawWorld()`, before room markers. Cleared
  in `populateFloor()`.
- **Proximity hints:** Interaction prompts (stairs, doors, terminals, shrines) use
  a persistent pulsing hint centred above the HUD instead of repeating chat messages.
  `game.hint` is set per-frame; `drawHint()` renders with `sin(Date.now()/300)`
  opacity oscillation (0.20–0.90). Only one hint is shown at a time (last wins).

### Lore Terminals (floor 2+, non-boss)

Data terminals scattered through the dungeon containing narrative fragments about
the facility, its creators, the OMEGA CORE, and the events that led to lockdown.

**Tile:** `T.LORE` (value 16). Passable, see-through. Rendered as an amber `◫`
glyph with pulsing glow on a `#1a1208` background. Distinct from the cyan CORE
terminal (`T.TERMINAL`) used on floor 10.

**Placement:** 1 terminal per floor (floors 2–4), 2 per floor (floor 5+).
Excluded from: spawn room, stair room, vendor rooms, secret rooms, boss floors.
Placed on a random `T.FLOOR` tile away from room edges (1-tile inset). Generated
**before** arc grids so the adjacency exclusion works correctly.

**Interaction:** Walk onto the tile → hint prompt ("Press E to access data
terminal"). Press E → game enters `READING` state, gameplay pauses. The terminal
is consumed (converted to `T.FLOOR`) — single use per terminal.

**Lore selection:** 25-entry pool of cyberpunk narrative fragments. Each terminal
displays an entry not yet seen this run (`player.loreRead` Set of indices). When
all entries exhausted, repeats randomly. Each new entry awards +50 score.

**READING state:** Dark overlay (82% opacity) with amber terminal-style frame,
scanline effect, word-wrapped lore text, and pulsing "PRESS E TO CLOSE" / "TAP TO
CLOSE" hint. Closes on E, Escape, Enter, or mouse click/touch tap.

**Audio:** `audio.loreAccess()` — warm ascending chirp (500→700→900→1100 Hz sine +
triangle tones with noise texture).

**HUD:** Amber `◫ N` counter next to credits in both compact and landscape
layouts, shown only when `loreRead.size > 0`.

**Minimap:** Amber (`#ffb700`) dot.

**Save/Load:** `player.loreRead` serialised as array, loaded as Set. Defaults
gracefully to empty Set on older saves — no `SAVE_VERSION` bump required.

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
| Floor transition | Digital glitch: 6 stutter square tones (random 200–2000 Hz, rapid decay) + bandpass noise sweep 300→4000→200 Hz (Q 3) + sub rumble 50→35 Hz, reverb (0.3). Fires on `fadeTo()` start. |
| Boss phase shift | Rising alarm sweep: detuned saw pair 200→1200 Hz + sub pulse 55→40 Hz + metallic ring (sine 1800→900 Hz + triangle 2400→1200 Hz) + noise burst (LP 3000 Hz), reverb (0.45). Fires on boss phase transition for all bosses. |
| Menu select      | Quick UI blip: sine chirp 1200→1800 Hz + triangle 600→900 Hz. Fires on start game, pause resume/quit, name-entry confirm, and return-to-menu. |
| Low health       | Heartbeat warning: two sub thumps (sine 60→40 Hz, 180 ms apart) + noise click (LP 200 Hz). Plays every 2 s while HP ≤ 25 %. |
| Game Over        | Minor chord (A3-C4-D♯4): sine+saw layers sweeping to half-freq + sub drone, reverb (0.6) |
| Victory          | Major fanfare (C4-E4-G4-C5): sine + triangle harmonics + detuned shimmer + sustain chord, reverb (0.6) |
| Vendor open      | Digital cash register chime: three ascending tones (sine 600→800, triangle 800→1100, sine 1100→1400 Hz) |
| Purchase         | Coin-drop bleep: sine 1000→1600 Hz + triangle 1400→1800 Hz + HP noise burst (3 kHz) |
| Purchase fail    | Low buzz rejection: square 120→90 Hz + LP noise (400 Hz) |
| Shield deflect   | Hard metallic clang: triangle 1800→600 Hz + sine 2400→900 Hz + noise (LP 4000 Hz) |
| Grenade lob      | Hollow thunk: sine 200→120 Hz + triangle 400→800 Hz rising whoosh |
| Grenade explode  | Muffled boom: sine 100→30 Hz + square 60→20 Hz + noise (LP 2000 Hz) |
| Lore access      | Data retrieval chirp: ascending sine tones (500→700, 700→900, 900→1100 Hz) + noise texture (4 kHz) |
| Combo tick       | Ascending chirp: base pitch rises with combo count (400 + count×80 Hz, capped 1800 Hz); sine + triangle |

All envelopes use exponential ramps (floor 0.001) for natural decay. Frequencies are guarded with `Math.max(freq, 1)` for exponential ramp safety.

---

## Scoring

### Base Scoring
```
score += enemy_xp_value × floor_multiplier × combo_multiplier   (on kill)
score += 500 × floor_number                  (on floor clear)
score += remaining_hp × 10                   (on floor clear)
score += 50                                  (on lore terminal read)
```

### Combo / Kill-Streak System

Killing enemies in quick succession builds a combo counter. The combo multiplies
score earned per kill.

**Combo rules:**
- Each eligible kill increments `combo.count` and resets a 3-second window timer.
- If 3 seconds elapse without a kill, the combo resets to 0.
- Multiplier formula: `1 + (count - 1) × 0.25`, hard-capped at **4×** (combo 13+).
- Boss kills use a separate cap of **2×** to prevent score inflation.
- **Excluded from combo building** (don't increment count):
  - SHARDs (from SPLITTER splits) — too easy, would inflate streaks.
  - VOLATILE chain kills (`_volatileKill`) — indirect, would max combo instantly.
- Excluded enemies still receive the current combo multiplier on their score.
- Combo resets on floor transition (`populateFloor()`).
- `combo.best` tracks the highest streak in the run (runtime only, not saved).
- The combo timer only decrements during `PLAYING` state — pausing or entering
  menus does not drain the window.

**Visual feedback:**
- HUD shows `×{multiplier} COMBO ×{count}` when count ≥ 2.
- Colour tiers: cyan (2–4), yellow (5–7), orange (8–10), magenta (11+).
- Flash effect on each new kill; opacity fades with timer.
- Milestone floating text ("×5 COMBO!", "×10 COMBO!", etc.) at player position.
- Best combo displayed on GAME_OVER and VICTORY screens.

**Audio:** ascending chirp on each combo increment (pitch rises with count).

**Global state:** `combo { count, timer, best, flashTimer }` — reset in
`populateFloor()` alongside other per-floor globals. `combo.best` reset in
`startGame()` and `continueGame()`.

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

## Save System

Uses `localStorage` key `neonDungeonSave`. Saves player stats and current floor
number — the dungeon itself is not persisted (a fresh floor is generated on
resume).

**Auto-save triggers:**
1. After `loadFloor()` completes (start of every floor — the sole checkpoint)

Mid-floor progress is not saved. Closing the browser mid-floor loses progress
back to the start of the current floor. This is intentional — it prevents save-
scumming (reloading to re-roll dungeon layout while keeping stats).

**Save payload:** `{ v, floor, difficulty, modifier, bossesCleared, player: { hp, maxHp, atk, def, level, xp,
weapon, upgrades, perks, keys, shards, permSpeedBonus, score, energyShield,
energyShieldTimer, credits, loreRead } }` — `shieldBonus` is always 0 at floor entry so is
excluded. `modifier` is the floor modifier key (string) or `null`.

**Menu behaviour:**
- If a save exists: two options — `CONTINUE (FLOOR N)` and `NEW GAME`.
  Keyboard ↑↓ or W/S to select, Enter to confirm. Touch: top half = continue,
  bottom half = new game.
- If no save: single `PRESS ENTER TO START` prompt (unchanged).

**Continue flow:** Creates a fresh `Player`, applies saved stats, calls
`loadFloor(savedFloor)`, displays "RUN RESUMED — FLOOR N" message. The dungeon
is regenerated fresh — enemies, items, and layout will differ from the original
floor. Incompatible save versions (different `v` field) are silently deleted.

**Save deletion:** `endRun()` (called on death and victory) deletes the save.
Starting a new game overwrites the save when the first floor loads.

---

## HUD Layout

### Landscape (W ≥ 600 or W ≥ H) — single row

```
┌───────────────────────────────────────────────────────┐
│                  NEON DUNGEON                  [map]  │  ← minimap top-right
│                                                       │
│              [GAME CANVAS]                            │
│                                                       │
│  HP ████░░  LVL ATK DEF  FLR  WEAPON  SCORE  COMBO   │  ← HUD bottom (40 px)
└───────────────────────────────────────────────────────┘
```

### Portrait (H > W and W ≤ 600) — compact two-row

```
┌──────────────────────┐
│            [map]     │  ← minimap top-right
│                      │
│   [GAME CANVAS]      │
│                      │
│  HP ████░░  FLR  SCR │  ← row 1 (+ combo below score)
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
3. **Pause** — ESC / ‖ button, dim overlay. Desktop: ESC resume, Q quit. Touch: tap upper half to resume, lower half to quit.
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

## Death Recap & Run Statistics

### Damage Tracking

All player damage is attributed to a named source. The `player.takeDamage(dmg, source)` method records cumulative damage per source in `player.damageLog` (object: source→total). Environmental damage that bypasses `takeDamage` (Plasma burn, Arc Grid zap) logs separately via `player.logDamage(source, amount)`.

| Field            | Type   | Reset        | Saved |
|------------------|--------|-------------|-------|
| `damageLog`      | Object | `Player.reset()` | Yes |
| `killedBy`       | String | `Player.reset()` | No (set on death) |
| `enemiesKilled`  | Number | `Player.reset()` | Yes |
| `hitsBlocked`    | Number | `Player.reset()` | Yes |
| `game.runTime`   | Number | `startGame()` | Yes |

Kill counter (`enemiesKilled`) increments in `Enemy.die()` for all non-SHARD enemies.

### Source Labels & Colours

`SOURCE_LABELS` and `SOURCE_COLOURS` maps provide friendly display names and neon colours for all damage sources. Enemy types use their canonical names (Guard, Turret, etc.); bosses use campaign names (Sentinel Mk-I, Neural Hive, Omega Core). Environmental sources: Spike Trap, Plasma, Arc Grid, Grenade, Volatile, Void Orb.

### Recap Snapshot

`endRun()` captures `game.lastRunRecap` — an immutable snapshot of recap fields — before any state transitions. Both GAME_OVER and VICTORY screens render from this snapshot, not live mutable state.

### Game Over Screen

Redesigned layout (top to bottom):
1. **GAME OVER** title (red glow)
2. **KILLED BY: {Source}** — prominent, in the source's neon colour with glow
3. Divider + stats line: Floor • Score • Level
4. Best combo (if ≥2), difficulty (if non-NORMAL)
5. **DAMAGE TAKEN** breakdown — top 3–4 sources as coloured progress bars with label, absolute damage, and percentage
6. Divider + run stats: enemies slain • shield blocks • time survived (m:ss)
7. Data Fragments earned
8. Leaderboard (4–5 rows)
9. Continue prompt

Compact/mobile layout reduces bars to 3, leaderboard to 4 rows.

### Victory Screen

Adds run statistics (same enemies/blocks/time line) between the existing stats and leaderboard. No "killed by" section.

---

## Status Effect Indicators

Three visual systems communicate active effects to the player.

### Low-HP Danger Vignette

When player HP ≤ 25%, a pulsing red vignette appears at the screen edges:
- **Radial gradient** from transparent (centre) to `#ff1a1a` (edges)
- **Intensity** scales linearly: 0 at 25% HP → max at 0% HP
- **Pulse** syncs with existing `player.lowHpTimer` (2 s heartbeat cycle)
- **Compositing**: `globalAlpha = severity × (0.12 + 0.14 × pulse)` — visible but never obscures gameplay
- **Neon border** stroke with `shadowBlur` glow adds urgency
- **Render order**: drawn BEFORE HUD/minimap so UI elements remain readable

### Floor Modifier Banner

On floor entry (fresh transitions only, not save resume), a prominent
banner slides down from the top of the screen announcing the active modifier:

- **Duration**: 3 s (`game.modBannerTimer`), ticked in `updatePlaying()`
- **Animation**: 0.3 s fade-in slide-down, 2.4 s hold, 0.3 s fade-out slide-up
- **Content**: modifier icon + label (landscape adds description line)
- **Compact mode**: icon + label only (no description) to fit narrow screens
- **Background**: dark rounded pill with modifier-colour border glow
- **Replaces** the previous `game.msg()` modifier announcement
- **Gate**: only fires when `savedModifier === undefined` (new floor, not save restore)

### Status Effect Bar

Row of compact badge indicators displayed just above the HUD bar (`layout.hudTop - 16`):

| Effect | Trigger | Icon | Colour |
|--------|---------|------|--------|
| Floor modifier | `game.modifier` active | Modifier icon | Modifier colour |
| Slow debuff | `player.speedTimer > 0 && speedBoost < 0` | ❄ | `#6688cc` |
| Shield recharging | `perks.ENERGY_SHIELD && !energyShield` | 🛡 | `#4466aa` |
| Shield active | `perks.ENERGY_SHIELD && energyShield` | 🛡 | `#4488ff` |
| Nano Regen | `upgrades.NANO_REGEN > 0 && hp < maxHp` | ♻ | `#00ff88` |
| Dash cooldown | `dashCooldown > 0` | ⇧ | `#7a6a33` |
| Dash ready | `dashCooldown ≤ 0` | ⇧ | `#ffb700` |

Each badge: dark pill background + icon + label text, `shadowBlur` colour glow.
Smooth alpha fade-in/out (0.08 per frame) tracked per effect ID via `statusFx` object;
inactive effects continue rendering during fade-out, cleaned up at alpha 0.
Badges flow left-to-right from the safe-area left edge; overflow stops before
minimap region (`W - 130 - safeRight`). Y position shifts up (`hudTop - 32`)
when key indicators are present to avoid collision.

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
| v2.1    | Floor transition audio: `audio.transition()` plays digital glitch SFX (stutter tones + bandpass noise sweep + sub rumble) on every `fadeTo()` call; SW cache v5 |
| v2.2    | Audio polish + spec fixes: boss phase transition SFX (`audio.phaseShift()`), menu select blip (`audio.menuSelect()`), low-health heartbeat warning (`audio.lowHealth()` every 2 s at ≤25% HP); Hive phase transitions now have VFX + message like Omega/Sentinel; Sentinel shield burst fixed to 20 dmg (was 15, spec says 20); Hive shockwave fixed to 25 dmg (was 30, spec says 25); touch pause overlay now shows resume + quit (was resume only); mobile first-touch aim initialises mouse position immediately (fixes stale aim on first shot) |
| v2.3    | Spec accuracy: corrected torch radius 8→9; replaced "fully dark beyond radius 12" with actual fog-of-war behaviour (visited tiles at 12–20% brightness, unvisited not drawn); clarified stairs-placement BFS uses LOS + proximity heuristic, not true corridor BFS |
| v3.0    | Roguelike powerup choice system: items pause gameplay and present 2 random upgrades (pick one or skip); pre-rolled weapon options show exact stats; new persistent upgrades: Saw Blade (LOS-gated orbital), Plasma Orb (homing auto-spell), Nano Regen, Overclock (permanent), Reinforced Armor; homing projectile support; removed SHIELD_CELL, WEAPON_CRATE, timed OVERCLOCK |
| v4.0    | Exploration system: doors at room-corridor junctions (E to open); colored locked doors (red/blue/gold) on floors 2+ with BFS-safe key placement; spike traps (damage) and slow traps (speed debuff) on floors 3+; isPassable()/isSeeThrough() tile helpers replacing hardcoded wall checks; minimap shows all new tile types; key HUD display; SW cache v7 |
| v4.1    | Special room types: armory (fewer enemies), medbay (passive healing font), shrine (one-use XP grant), vault (more enemies + loot); room-type-tinted floor tiles; glowing markers for heal fonts and shrines |
| v4.2    | Per-floor quest objectives: EXTERMINATE, EXPLORE, SPEEDRUN (60s timer), PACIFIST (no kills); quest HUD below minimap; boss floors always get EXTERMINATE; quest rewards: score, XP, full heal |
| v5.0    | Environmental hazards: plasma vents (floor 4+, clustered burn pools in rooms, continuous DPS bypassing armor) and arc grids (floor 5+, pulsing electric tiles in corridors, periodic zap damage); new audio `plasmaBurn()` + `arcZap()`; HP display rounded with `Math.ceil`; score HP bonus uses `Math.floor`; SW cache v8 |
| v6.0    | Level-up perk system: passive abilities auto-unlock at specific levels. First perk: Laser Sight (level 2) — dashed neon line showing aim trajectory, weapon-coloured, stops at walls/doors, hidden for melee; perk infrastructure (`PERKS` table, `checkPerkUnlocks()`, `player.perks`); SW cache v9 |
| v6.1    | Threat Sense perk (level 4): directional chevrons on screen edges for off-screen enemies within 18 tiles, proximity-scaled size/opacity, boss-aware colouring. Proximity hint system: doors/stairs/terminal/shrine prompts replaced per-frame `msg()` spam with single pulsing `game.hint` overlay above HUD. SW cache v10 |
| v6.2    | Piercing Rounds perk (level 6): player projectiles pass through one additional enemy via `maxPierces` counter on `Projectile` class; applies to weapon shots and Plasma Orb auto-casts; stacks with Railgun native piercing. Energy Shield perk (level 8): absorbs one `takeDamage()` hit completely, 30 s gameplay-time recharge, pulsing blue shield visual, HUD recharge countdown, `audio.shieldBreak()`/`shieldRestore()` SFX; does not block environmental hazards. SW cache v11 |
| v6.3    | Boss seal fix: entrance-aware detection prevents locking player out of boss room; safety nudge to room center if stuck. Door clustering: `getEntranceClusters()` helper groups adjacent entrance tiles; only narrow clusters (≤2 tiles) receive doors; all tiles in a cluster doored together. Locked door targeting: priority system (stair room > special rooms > random); all narrow entrance clusters locked, wide ones walled off. Save system: checkpoint-only auto-save on floor entry (no `beforeunload` — prevents save-scumming); CONTINUE/NEW GAME menu; save deleted on game over/victory; `localStorage` key `neonDungeonSave`. SW cache v12 |
| v7.0    | Vendor/shop system: credits currency (earned from enemy kills, floor-scaled), `T.VENDOR` tile (14), vendor room type (floor 2+, independent of special room rotation, excluded from lock targets), `SHOPPING` game state with 3-item shop UI (keyboard + touch), explicit per-upgrade pricing, shop-exclusive Full Repair and coloured Key items, credits on HUD (compact + landscape), credits in save/load, `audio.vendorOpen()`/`purchase()`/`purchaseFail()` SFX. SW cache v13 |
| v8.0    | Secret rooms: `T.CRACKED` tile (15) — wall-like with proximity-visible amber cracks. One secret room per non-boss floor (3+), walled off with one cracked entrance. Lazy activation: enemies/items spawn only when cracked wall is broken (E key). `secretMask` prevents lighting from revealing hidden contents. Premium loot + credit bonus on reveal. EXPLORE quest excludes unrevealed secrets. `audio.wallBreak()` SFX. SW cache v14 |
| v9.0    | Ricochet Module upgrade: persistent upgrade (max level 3), player projectiles bounce off walls (axis-separated reflection, epsilon nudge), cyan sparks + `audio.ricochet()` SFX. Excluded from Plasma Orb homing. `hitEnemies` preserved across bounces. SW cache v15 |
| v10.0   | Auto-Laser capstone perk (level 10): hitscan beam auto-fires at nearest visible enemy within 12 tiles every 2.5 s, 20 flat damage, LOS-gated, invisible phantoms excluded. Crimson beam + white core visual (0.15 s fade), `audio.autoLaser()` zap SFX. Save compatibility: `checkPerkUnlocks()` re-runs on load to retroactively grant perks from before they existed. SW cache v16 |
| v10.1   | Bug fix: touch menu hit-test for Continue/New Game used `H/2` instead of actual menu item positions — tapping Continue selected New Game on landscape tablets and 768p viewports. `continueGame()` now falls back to `startGame()` with visible message on corrupt saves instead of silently returning. SW cache v17 |
| v11.0   | Enemy variety expansion: SHIELDER (floor 3+, 120° frontal arc deflects non-piercing projectiles, forces flanking) and GRENADIER (floor 5+, lobs grenades creating 1.5-tile radius AoE hazard zones lasting 3 s). Floor-gated via `minFloor` in ENEMY_WEIGHTS — excluded from both weighted selection and cap-reroll on lower floors. Global `hazardZones[]` array for grenade zones with LOS-gated damage. `audio.shieldDeflect()`/`grenadeLob()`/`grenadeExplode()` SFX. Per-room caps: 1 shielder, 1 grenadier. SW cache v18 |
| v12.0   | Lore terminals: `T.LORE` tile (16) — amber data terminals placed 1–2 per non-boss floor (floor 2+), containing cyberpunk narrative fragments from a 25-entry pool. Single-use: press E to read, terminal converts to floor. `READING` game state with overlay UI (word-wrapped text, scanline frame, touch/keyboard close). +50 score per new entry. `player.loreRead` Set tracks discovered entries per run. `audio.loreAccess()` chirp SFX. Amber `◫` HUD counter + minimap dot. Save-compatible (no version bump). SW cache v19 |
| v13.0   | Meta-progression system (Neural Archives): persistent Data Fragments (◆) currency earned at end of every run based on floors reached, bosses cleared, victory, and score. 6 permanent upgrades purchasable from new ARCHIVES game state accessible from main menu: Vital Systems (+HP), Scavenger Protocol (+credits), Quick Learner (+XP), Armor Plating (+DEF), Weapon Cache (start with upgraded weapon), Data Persistence (+fragments/run). Array-driven menu system replacing hardcoded 2-option layout — supports touch hit-testing for 2-3 options. `bossesCleared` counter tracked on game object and persisted in save. ◆ reward shown on GAME_OVER/VICTORY screens. Meta data stored in separate `localStorage` key (`neonDungeonMeta`). SW cache v20 |
| v14.0   | Difficulty modes: EASY / NORMAL / HARD selectable on NEW GAME menu row via ◀▶ (keyboard arrows or touch edge taps, center tap starts). `DIFFICULTIES` table with per-mode multipliers for enemy HP/ATK/SPD, item drop rate, credit gain, XP gain, elite spawn rate, shard payout (run portion only), and environmental/boss damage. Selection persists in `neonDungeonMeta.lastDifficulty`; saved in run checkpoint. Old saves default to NORMAL. Non-NORMAL badge below minimap + shown on end screens. Touch menu splits diff row into 3 zones (left edge cycle, center start, right edge cycle). SW cache v21 |
| v15.0   | Floor modifiers: each non-boss floor (2+) gets a random gameplay mutator from a pool of 6: BLACKOUT (halved torch radius), SWARM (×1.5 enemies, ×0.6 HP), FORTIFIED (×1.4 HP, +30% drops), VOLATILE (death AoE, LOS-gated, no chain), SCRAMBLED (+0.15 spread), OVERCLOCK (×1.2 all speeds + fire rates). Modifier announced on floor entry, displayed in HUD below floor number. Saved in checkpoint; old saves load without version bump. `modSpeed()` helper centralizes speed scaling. `getMod()` accessor. SW cache v22 |
| v16.0   | SPLITTER enemy (floor 4+): splits into 2 fast SHARDs on death. SHARDs use zigzag AI, 0.25 tile size, no drops, 0 credits, 8 XP. Deferred spawn pattern via `pendingEnemySpawns[]` flushed after dead enemy cleanup. Per-room cap: 2 splitters. SW cache v23 |
| v17.0   | Ricochet visual trail: bouncing projectiles leave a fading cyan trail showing their path. Trail records recent positions and renders as gradient-opacity line segments. Active from the moment of firing when Ricochet Module is equipped. SW cache v24 |
| v18.0   | Floating damage numbers: every hit spawns a rising, fading text showing the damage dealt. White for normal enemy hits, yellow for killing blows, red for player damage, blue "BLOCK" for energy shield absorbs. Capped at 20 concurrent texts. Frame-rate-independent velocity damping (`Math.pow(0.35, dt)`). Cleared on floor transitions. SW cache v25 |
| v19.0   | Screen shake: camera shakes on player damage (intensity ∝ damage, capped 8 px), shield break (4 px), volatile explosions (6 px), void shard detonation (10 px). Linear decay, render-only (no aim interference). Reset on floor transitions. SW cache v26 |
| v20.0   | Combo / kill-streak counter: fast successive kills build a combo multiplier (×1.25 at 2 kills up to ×4 at 13+, 3 s window). Boss kills capped at ×2. SHARDs and VOLATILE chain kills excluded from building combo. HUD shows multiplier + count with colour tiers (cyan → yellow → orange → magenta). Ascending audio chirp on each increment. Milestone floating text at ×5/×10/×15/×20. Best combo shown on end screens. Reset per floor. SW cache v27 |
| v21.0   | Minimap POI markers: key locations (stairs/terminal, vendor, lore) get larger pulsing glow markers on the minimap drawn above tile and enemy layers. Stairs/terminal: white 3 px, vendor: green 3 px, lore: amber 2 px. Sealed boss entrances: red 4 px fast-pulse overlay. Player dot stays on top. Improves navigation on larger floors. SW cache v28 |
| v22.0   | Dash/dodge ability: Shift key (keyboard) or ⇧ touch button triggers a fast 0.12 s burst-dash at 18 tiles/sec (~5× walk speed) in movement/facing direction. 1.5 s cooldown, invulnerable during dash, wall collision ends early. Amber afterimage trail (8 ghosts, fade 0.25 s) + amber spark particles. `audio.dash()` whoosh SFX. HUD cooldown display (compact + landscape). Touch button added between E and V buttons with cooldown dim overlay. Control hints updated. SW cache v29 |
| v23.0   | Ambient particle system: environmental storytelling via 5 particle emitter types. DUST motes drift through lit rooms/corridors (white/cyan). EMBER sparks rise from plasma vents (orange). ZAP micro-flashes on active arc grids (blue-white). STEAM wisps from cracked walls when player is near (grey). WISP energy motes around sealed boss entrances (red glow). Separate `ambientParticles[]` array (cap 80), timer-gated spawning (0.08 s), soft fade-in/out, performance-budgeted (max 3 new/tick). Cleared on floor transitions. SW cache v30 |
| v24.0   | TELEPORTER enemy (floor 6+): spatial disruptor that blinks to random room positions every 2–3 s (floor-scaled), fires 2 quick ranged bursts after 0.4 s materialise, then relocates. Emergency blink if player within 2 tiles. Hot magenta (`#ff44ff`), rapid alpha flicker, fading afterimage at warp origin. `audio.teleport()` zwip SFX. Per-room cap: 1. Credits: 8. OVERCLOCK shortens cycle. SW cache v31 |
| v25.0   | Death recap & run statistics: all player damage attributed to named sources via `takeDamage(dmg, source)`. Game Over screen shows KILLED BY banner, colour-coded damage breakdown bars (top 3–4 sources with percentages), and run stats (enemies slain, shield blocks, time survived). Victory screen adds same run stats line. `SOURCE_LABELS`/`SOURCE_COLOURS` maps for friendly display. `Projectile.ownerType` tracks shooter. `player.damageLog`, `enemiesKilled`, `hitsBlocked` persisted in save. `game.runTime` accumulates across floors. `endRun()` snapshots `lastRunRecap` for stable rendering. SW cache v32 |
| v26.0   | Status effect indicators: three visual systems for active effect communication. (1) Low-HP danger vignette — red pulsing radial gradient at screen edges when HP ≤ 25%, severity-scaled intensity, heartbeat-synced pulse, drawn before HUD. (2) Floor modifier banner — 3 s animated pill sliding from top on floor entry, icon + name + description (compact: icon + label only), replaces `game.msg()` announcement, gated to new transitions (not save resume). (3) Status effect bar — row of compact badges above HUD showing active modifier, slow debuff, energy shield state, nano regen, dash cooldown/ready. Per-effect smooth alpha fade via `statusFx` keyed state. `game.modBannerTimer` ticked in `updatePlaying()`. SW cache v33 |
| v27.0   | Room-clear rewards: killing all enemies in a room grants bonus credits (`10 + floor × 5`, scaled by difficulty and meta credit multiplier), +50 × floor score, green particle burst at room center, floating "+N◆" text, and `audio.roomClear()` ascending triple chime. Detection runs only when an enemy dies (`game.enemyDiedThisFrame` flag set in `Enemy.die()`), placed after dead-enemy removal and pending-spawn flush in `updatePlaying()` so SPLITTER → SHARD sequences are handled correctly. `room._hadEnemies` flag set during `populateFloor()` (only when count > 0) and `revealSecretRoom()`. `game.clearedRooms` Set tracks rewarded rooms per floor (reset in `loadFloor()`). Multi-room clears in a single frame (e.g. VOLATILE chain) batched into one audio/message. `player.roomsCleared` stat tracked in save/load and shown on Game Over / Victory screens ("N cleared"). Boss room excluded (has own death sequence). Spawn room excluded (no enemies). SW cache v34 |
| v28.0   | Weapon affixes: random modifiers on weapons for loot variety and replayability. 5 prefixes (stat modifiers: Rapid, Heavy, Extended, Twin, Precise) and 5 suffixes (effects: Flame/burn, Frost/slow, Vampirism/leech, Thunder/chain, Detonation/explode). Floor-gated rarity: common (no affix, floor 1), uncommon (1 affix, floor 2+), rare (2 affixes, floor 4+). Affix eligibility filters prevent dead rolls (Precise on zero-spread, Twin/Extended on melee). Affixed weapons are unique cloned objects with `buildWeapon()`/`rollWeapon()` pattern. `applyHitEffects()` + `applyOnKill()` centralize proc logic with `isProc` guard against recursion. `tickEnemyStatusEffects()` handles burn DOT and slow decay per enemy per frame. Enemy class gains `burnTimer`, `burnDps`, `slowTimer`, `slowFactor`, `_lastHitCtx`. Visual: burn underglow, frost tint, chain lightning bolts (jagged yellow), rarity-coloured HUD weapon name + upgrade card borders. Save format: weapon stored as `{_base, _affixes}` object. SAVE_VERSION 8.0. SW cache v35 |
| v29.0   | Elite enemy affixes: each elite enemy (floor 3+) now spawns with one random affix that grants a special ability. 4 affixes: SHIELDED (energy shield absorbs damage, 40% max HP, regenerates 8/s after 2s), BERSERKER (speed + attack rate scale up to +50% as HP drops), REGENERATING (heals 2.5% maxHp/s), PHASING (1s invulnerable every 4s cycle). `ELITE_AFFIXES` table, `rollEliteAffix()` with eligibility filter (PHASING excluded from PHANTOM). `tickEliteAffix()` per-frame behaviour. `berserkerMul()` method on Enemy. Shield absorption in `takeDamage()` before HP. Phase immunity check at top of `takeDamage()`. Visual: affix-coloured diamond marker, affix-coloured glow, SHIELDED blue ring + separate shield bar, BERSERKER red aura intensifies, PHASING ghost flicker, REGENERATING green particles. Minimap: 3px affix-coloured dots for elites. SW cache v36 |
