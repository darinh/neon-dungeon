# Module map and human handoff guide

This document is the practical ownership map for a human taking over NEON
DUNGEON development. It complements `docs/engine-boundary.md`, which explains
which code is reusable engine versus NEON-specific game code.

## Runtime model

NEON DUNGEON is a script-tag application. There is no bundler and no runtime
dependency graph resolver. `index.html` is the dependency graph.

Current load groups:

| Order | Files | Role |
|---|---|---|
| 1 | `engine/math.js`, `engine/viewport.js`, `engine/audio.js`, `engine/input.js`, `engine/touch.js`, `engine/draw.js`, `engine/decor.js`, `engine/particles.js`, `engine/minimap.js` | Reusable engine helpers and primitives. |
| 2 | `src/platform.js` | Browser/platform bridge: canvas sizing, input state, settings, audio boot, tile constants. Loaded early because later files depend on globals it defines. |
| 3 | `engine/biomes.js`, `src/data/biomes.js`, `src/data/palettes.js`, `src/data/logs.js`, `src/data/whispers.js` | Engine routers plus NEON DUNGEON static data. |
| 4 | `src/meta/save.js`, `engine/telemetry.js`, `src/meta/cores.js`, `engine/spawn.js`, `engine/alarm-light.js`, `src/meta/alarm-light.js`, `src/meta/upgrades.js`, `src/meta/modules.js`, `src/meta/logs.js`, `src/meta/whispers.js`, `src/meta/behavior.js`, `src/meta/boosts.js`, `engine/cinematic.js`, `src/meta/intro.js`, `src/meta/hub.js`, `engine/render-boundary.js` | Meta/progression systems and configured engine/game shims exposed through `NEON.*`. |
| 5 | `src/content.js`, `src/entities.js`, `src/render.js`, `src/game.js` | Large runtime modules: generation/content, actors/combat, rendering/HUD, and game-state orchestration. |

When adding a new browser module, update both `index.html` and `sw.js` `ASSETS`.
There is no service-worker cache version to bump; `sw.js` uses a stable cache
name plus network-first freshness for explicit assets.

## Large-file ownership

| File | Owns | Human warning signs | Useful tests |
|---|---|---|---|
| `src/platform.js` | Canvas sizing, safe-area layout, settings, key/touch/mouse routing, audio unlock, save slots, tile constants. | Touch hit-tests mirror render layout in places; world zoom affects platform, render, and game wrapping together. | `tests/touch.test.js`, `tests/settings-scale.test.js`, `tests/world-zoom.test.js`, `tests/reset-defaults-confirm.test.js` |
| `src/content.js` | Dungeon generation helpers, items, projectiles, weapons, lore terminals, music state. | Projectile collision and dungeon reachability have many edge cases; narrative strings have guardrail tests. | `tests/projectile-wall-corner.test.js`, `tests/seeded-generation.test.js`, `tests/lore-terminals-act1.test.js`, `tests/act1-narrative-guardrails.test.js` |
| `src/entities.js` | Entity base, player, enemies, boss behavior, combat effects, runtime actor collections. | High coupling to `game` state and room indexes; small AI changes can affect seeded determinism or HUD expectations. | Enemy-specific tests, `tests/seeded-generation.test.js`, combat modifier tests |
| `src/render.js` | World rendering, per-tile decor, HUD, minimap, overlays, threat indicators, screen effects. | Hot path: avoid per-tile/per-frame allocations in `drawWorld` and decor loops; HUD lanes overlap easily on mobile. | `tests/rendered-test-environment.test.js`, HUD tests, `tests/world-zoom.test.js`, `tests/engine-minimap.test.js` |
| `src/game.js` | Main state machine, menu, run lifecycle, save/restore, floor transitions, narrative overlays, finale flow. | God-file coordinator. Extract pure helpers first; do not move the runtime `game` object until dependencies are mapped. | `tests/save.test.js`, `tests/mainframe-room.test.js`, `tests/system-messages.test.js`, `tests/session-lifecycle-copy.test.js` |
| `sw.js` | Offline cache and fetch strategy. | Add/remove asset paths, but do not add/bump a numeric cache version. | `tests/release-version-workflow.test.js` plus CI |

### Content/entities split-prep inventory

`src/content.js` and `src/entities.js` still behave as script-tag globals, not
importable modules. Before either file is split, preserve these public surfaces
through the original filename or update every browser/test call site in the same
change.

| File | Public surfaces future splits must preserve |
|---|---|
| `src/content.js` | Procedural music (`music`), lore selection (`LORE_ENTRIES`, `LORE_ENTRY_FLOOR_MIN`, `pickLoreEntryIndex`), item/weapon/hackware/perk/augment/modifier registries (`WEAPONS`, `WEAPON_AFFIXES`, `HACKWARE`, `FLOOR_MODIFIERS`, `UPGRADES`, `PERK_POOL`, `AUGMENTS`), meta-save shims (`loadMeta`, `saveMeta`, `applyMetaToPlayer`, core/log/module helpers), particles/floating-text/combo/status helpers, dungeon generation (`createMap`, `carveRect`, `carveCorridor`, `BSPNode`, `bfsRooms`, `generateFloor`, `updateLighting`, `tileHasLOS`), projectile/hazard runtime (`Projectile`, `releaseProjectile`, `detonateGrenade`, hazard-zone helpers), upgrade/shop/event helpers, and pickup classes (`HarvestPickup`, `MagpieHoard`, `VaultCoin`, `ShockPulsePickup`, `Item`, `KeyItem`, `WhisperItem`, `WeaponCacheItem`). |
| `src/entities.js` | Runtime collections (`enemies`, `items`, `hazardZones`, `vcores`, `crates`, traps/turrets/field arrays), room enemy index helpers (`registerEnemyInRoom`, `unregisterEnemyFromRoom`, `clearEnemiesByRoom`, `getEnemiesInRoom`, `enemiesInRoomIter`), render side-passes (`drawReaperPlayerRings`, `drawTetherLeashes`), combat/AI/entity classes and spawn/update helpers (`Player`, `Enemy`, `FuseShard`, boss/enemy subclasses or factories, `spawnEnemy`), and any globals consumed by `src/game.js`, `src/render.js`, tests, or save/restore logic. |

Source-text tests should load these files through `tests/_source-files.js`
instead of hard-coding `src/content.js` or `src/entities.js` paths. That helper
is the test-facing compatibility facade for future file moves: when a subsystem
is extracted, update the facade or add a logical source key before migrating
individual tests.

## `engine/` modules

`engine/` should stay reusable. `npm run check:engine` scans for NEON-specific
tokens that would leak game content into the engine layer.

| Module | Surface | Notes |
|---|---|---|
| `engine/math.js` | RNG and math helpers | Determinism-critical; gameplay code should not call `Math.random()` directly. |
| `engine/viewport.js` | Viewport/safe-area helpers | Coupled to platform resize behavior. |
| `engine/audio.js` | Web Audio primitives | Game-specific sound choices stay in callers. |
| `engine/input.js` | Input helper contracts | Browser state wiring lives in `platform.js`. |
| `engine/touch.js` | Touch geometry helpers | Keep render/touch layout constants synchronized. |
| `engine/draw.js` | Canvas drawing primitives | Allocation-free helpers are safe for hot paths. |
| `engine/decor.js` | Tile hash and decor scratch context | Designed for per-tile hot loops. |
| `engine/particles.js` | Pooled particle system | Avoids allocation churn after warmup. |
| `engine/minimap.js` | Minimap helpers | Covered by `tests/engine-minimap.test.js`. |
| `engine/biomes.js` | Generic area/floor routing | Configured by `src/data/biomes.js`. |
| `engine/spawn.js` | Passability-parameterized BFS | Caller owns tile semantics. |
| `engine/alarm-light.js` | Generic alarm flicker math | Configured by `src/meta/alarm-light.js`. |
| `engine/cinematic.js` | Generic timed-slide controller | Configured by `src/meta/intro.js`. |
| `engine/render-boundary.js` | Frame error tracking/overlay | Keeps render failures visible instead of blank-screening. |
| `engine/telemetry.js` | Offline-safe event batching | Privacy-conscious defaults; no gameplay content. |

## Data and meta modules

| Module | Owns |
|---|---|
| `src/data/biomes.js` | Floor ranges, biome display names/intros, boss pools. Stable ids/palette keys are save/test relevant. |
| `src/data/palettes.js` | Biome palette values. |
| `src/data/logs.js` | ARCHIVE predecessor records. Stable ids matter. |
| `src/data/whispers.js` | Secret-room whisper content and metadata. |
| `src/meta/save.js` | Durable meta state, migrations, cores/modules/progression. |
| `src/meta/cores.js` | Cores currency pickup/runtime wiring. |
| `src/meta/upgrades.js` | Upgrade matrix data and stat hooks. |
| `src/meta/modules.js` | Upgrade module catalog and effects. |
| `src/meta/logs.js` | ARCHIVE UI/data access. |
| `src/meta/whispers.js` | Whisper selection and eligibility. |
| `src/meta/behavior.js` | Runtime behavior hooks for perks/modifiers. |
| `src/meta/boosts.js` | In-run boost catalog and application. |
| `src/meta/intro.js` | Act 1 boot cinematic content over the engine cinematic controller. |
| `src/meta/hub.js` | THE GAP hub flow and terminals. |

## Common change checklists

### Add a gameplay feature

1. Find the owner module above.
2. Add data in `src/data/*` or `src/meta/*` if possible before touching a large
   runtime file.
3. Add focused tests for the mechanic and any HUD/status presentation.
4. Update `docs/spec.md` for user-visible behavior.
5. Run `npm run check`.

### Add a new browser-loaded source file

1. Add `// @ts-check`.
2. Use the UMD-lite wrapper from `CONTRIBUTING.md` if it must load in both browser
   and Node tests.
3. Add it to `index.html` in dependency order.
4. Add it to `sw.js` `ASSETS`.
5. Add tests and run `npm run check`.

### Touch rendering hot paths

1. Avoid object/array/function allocation inside per-tile and per-frame loops.
2. Hoist constants and scratch objects to module scope.
3. Keep canvas state changes inside existing `ctx.save()`/`ctx.restore()` scopes
   or add local scopes.
4. Check compact/mobile HUD lanes, not just landscape.
5. Run render/HUD-focused tests and `npm run check`.

### Touch save or migration code

1. Preserve old saves by coercing missing/invalid fields.
2. Add tests for current, legacy, malformed, and JSON-roundtrip shapes.
3. Do not silently drop active-run state without a test proving the fallback.
4. Run `tests/save.test.js`, relevant feature tests, and `npm run check`.

## Handoff priorities

If a human has limited time, start here:

1. Read `README.md`, this file, and `docs/refactor-roadmap.md`.
2. Run `npm run check`.
3. Make small changes behind existing tests before reorganizing files.
4. Extract pure helpers and static data first; leave `game.js` orchestration last.
