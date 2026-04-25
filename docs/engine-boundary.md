# Engine Boundary

> Phase 4 deliverable. Captures the conceptual line between **engine code**
> (reusable across NEON-style top-down 2D dungeon-crawlers) and **game code**
> (NEON DUNGEON-specific content, balance, narrative).
>
> This is documentation, not enforcement. The build does not yet split engine
> and game — they ship together as script-tag UMD. The boundary becomes
> structural in the deferred **p4-engine-extraction** track.

---

## Why this exists

NEON DUNGEON started as a single-file prototype. It now has:

- ~24,000 lines across 5 large `src/*.js` files plus 13 `src/meta/*.js`
  modules and 3 `src/data/*.js` data tables.
- Per-file `// @ts-check` opt-in (Phase 3 complete).
- A growing set of mechanics that are **clearly reusable** (decor pulse math,
  spawn BFS, render error boundary, telemetry batching) sitting in the same
  load order as **clearly NEON-specific** code (cores currency, the
  predecessor-log archive, the THE GAP hub layout).

Phase 4 draws a line so that future work — extracting the engine into its own
package, or grafting the engine onto a second game — has an unambiguous map
of what crosses the boundary and what stays.

---

## The boundary, in one sentence

> **Engine code knows about tiles, frames, and inputs. Game code knows about
> NEON DUNGEON's mechanics, story, and balance.**

Engine code can be lifted into another project with no rewrites — only
configuration. Game code is meaningless without the NEON setting.

---

## Three categories

Every module falls into one of:

| Category | Definition | Test |
|---|---|---|
| **🟦 Engine** | No NEON DUNGEON nouns or numbers in the source. Could ship in a generic 2D-dungeon engine package. | If you grep for `NEON`, `core`, `axiom`, `boost`, `void`, `shard`, `module-X`, you find nothing. |
| **🟧 Game** | Hardcoded NEON DUNGEON rules, content, balance, or narrative. | Removing this module breaks NEON DUNGEON specifically; another game would write a different version. |
| **🟪 Mixed** | The **shape** is engine (e.g., a typed area-table contract), the **data** is game. The function is engine, the constants are game. | The file has a clear pure-helpers section and a clear NEON-specific section. Splitting it later is mechanical. |

---

## Module classification

### 🟦 Engine modules

Reusable as-is. These are the candidates for the first engine package.

| Module | Surface | Why it's engine |
|---|---|---|
| `engine/alarm-light.js` | `NEON.alarmLightEngine.{isAlarmSlot, intensity, createAlarmLight}` | Reusable pulse math for any flickering wall decor. Biome allowlist injected via `createAlarmLight({allowedBiomes})` — game-side wiring lives at `src/meta/alarm-light.js`. |
| `engine/biomes.js` | `NEON.biomesEngine.createBiomeRouter` | Floor↔area routing factory: takes any `{floors:[]}`-shaped table and returns `{areas, areaForFloor, isBiomeBossFloor, firstFloorOfBiomeContaining, biomeIndex, areaForIndex, finalFloor}`. Zero NEON content. Game-side wiring at `src/data/biomes.js`. |
| `engine/cinematic.js` | `NEON.cinematic.createCinematicController` | Generic timed-slide controller: state machine, fade in/out, advance/skip key callbacks, optional final-slide flash envelope. Caller injects slide schema and `drawSlide` callback. Game-side wiring at `src/meta/intro.js`. |
| `engine/render-boundary.js` | `NEON.renderBoundary.{trackRenderError, drawErrorOverlay, shouldLog}` | Generic frame-error overlay for any canvas main loop. No NEON DUNGEON specifics. Pure-functional state-threading API (state in → new state out). |
| `engine/spawn.js` | `NEON.spawn.findNearestPassable` | Tile-grid BFS. Knows about an `isPassable(tileCode)` callback only — caller decides which tile codes are walkable. |
| `engine/telemetry.js` | `NEON.telemetry.{init, track, flush, update}` | Generic offline-safe event batching. Privacy-conscious by default. No game keys. |
| `src/data/palettes.js` (shape) | `BIOME_PALETTES` table | The **schema** (palette per biome id) is engine; the **values** are game (see Mixed). |

### 🟧 Game modules

NEON DUNGEON-specific. These would not ship with the engine.

| Module | Surface | NEON-specific concern |
|---|---|---|
| `src/meta/behavior.js` | Player buff/debuff hooks (Surge, Momentum, Out-of-Combat regen, Second Wind) | UNCHAINED upgrade-node flag semantics. |
| `src/meta/boosts.js` | `BOOSTS` catalog + `applyBoost` runtime | NEON DUNGEON's specific in-run boost roster (damage, speed, crit, shield, heal, reveal). |
| `src/meta/cores.js` | CORES currency world-entities | NEON DUNGEON's post-run currency. Tightly coupled to `save.js` wallet. |
| `src/meta/hub.js` | THE GAP hub between floors | NEON DUNGEON's specific 4-terminal layout (Upgrade Matrix / Module Slots / Armory / Archive). |
| `src/meta/intro.js` | 5-slide intro crawl (NEON-specific narrative; engine controller in `engine/cinematic.js`) | NEON DUNGEON's narrative opener. The **controller pattern** is engine (see Mixed). |
| `src/meta/logs.js` + `src/data/logs.js` | ARCHIVE terminal + AXIOM-1..6 predecessor logs | Pure NEON DUNGEON narrative. |
| `src/meta/modules.js` | UPGRADE MODULES catalog + effect logic | NEON DUNGEON's 10 modules (crit, dash, reflect, shield, doubleCredit, hackware, etc.). |
| `src/meta/save.js` | Persistent meta state, wallet, module install/sell | NEON DUNGEON's save schema (internal `META_VERSION = 2`; the legacy `SAVE_VERSION = 9.0` constant lives in `src/platform.js`). Shards/cores/modules/upgradeNodes are all NEON-specific. |
| `src/meta/upgrades.js` | UPGRADE MATRIX 12-node tree | NEON DUNGEON's specific upgrade nodes and their stat hooks. |
| `src/data/biomes.js` (data) | `AREAS` table | NEON DUNGEON's specific 5-biome arc (sandbox → cache → firewall → uplink → opennet) and boss pool. |
| `src/data/palettes.js` (data) | Palette values | NEON DUNGEON's specific colour schemes. |
| `src/data/logs.js` | `LOGS` data | Pure narrative. |

### 🟪 Mixed modules (shape engine, content game)

These contain a **pure, reusable contract** with NEON DUNGEON content layered on
top. In an extraction, the contract would move to engine and the content
would stay in game.

| Module | Engine part | Game part |
|---|---|---|
| `src/meta/alarm-light.js` + `engine/alarm-light.js` | **Extracted** to `engine/alarm-light.js`: `isAlarmSlot(h)` (stable ~3.2% true rate keyed by tile hash), `intensity(floorTime, h)` (sinusoidal flicker with hash-derived phase), and `createAlarmLight({allowedBiomes})` factory. Reusable for any flickering wall decor. | `src/meta/alarm-light.js` is the wiring shim that injects NEON DUNGEON's biome allowlist (`'cache'`, `'firewall'`) into the engine factory and re-exports the configured surface as `NEON.alarmLight`. |
| `src/data/biomes.js` + `engine/biomes.js` | **Extracted** to `engine/biomes.js`: `createBiomeRouter(areas)` factory returning `{areas, areaForFloor, isBiomeBossFloor, firstFloorOfBiomeContaining, biomeIndex, areaForIndex, finalFloor}`. Operates on any `{floors:[]}`-shaped table. Clamps out-of-range floors and indexes to first/last. | `src/data/biomes.js` is the wiring shim that owns the AREAS rows (sandbox/cache/firewall/uplink/opennet, narrative `intro` copy, `bossPool`, `displayName` overrides) and re-exports the configured surface as `NEON.biomes`. |
| `src/data/palettes.js` | The `BIOME_PALETTES: Record<string, Palette>` shape with keys `wallFill`, `wallHi`, `floor`, `floorAccent`, `minimapWall`, `minimapFloor`, `dust[]`, `ambient`. **No extraction**: pure data table with no behavioural helpers — extracting a `validatePalette` shim purely to mirror the biomes split would be ceremony without value. | The actual hex values per palette. |
| `src/meta/intro.js` + `engine/cinematic.js` | **Extracted** to `engine/cinematic.js`: `createCinematicController({slides, onFinish, isAdvanceKey, isSkipKey, drawSlide, fadeIn, fadeOut, flashSlideIndex, flashRampSeconds})`. State machine, fade math, flash envelope. Generic enough for any cinematic. | `src/meta/intro.js` is the wiring shim that owns SLIDES (the AXIOM-7 narrative copy + per-slide effect flags), the canvas effect renderer (cyanGlow/glitch/whiteFlash/stark), and the `_markIntroSeen` save flip via `NEON.save`. |

### 🟨 The five large `src/*.js` files (mostly mixed)

The big game-loop files are deliberately **not classified** in the table above
— they're each substantially mixed. Their sub-sections, however, are
classifiable:

| File | Engine-shaped sections | Game-shaped sections |
|---|---|---|
| `src/platform.js` | Input/keymap (`jp`, `km`, key remapping), audio synth wrappers, save persistence plumbing, touch hit-test scaffolding, viewport scaling. **Most of this is engine.** | The specific keymap defaults (`shoot=Space`, `dash=ShiftLeft`), tile constants `T = {VOID, WALL, ...}` (some game, some engine). |
| `src/render.js` | Canvas drawing primitives, the per-tile `drawWorld` cascade, the decor context (`_decoContext`), particle/projectile renderers, minimap. | NEON-specific tile sprites, biome tints, HUD layout. |
| `src/entities.js` | The `Entity` base class lifecycle (`update(dt)`, `draw(ctx)`, `takeDamage`), the projectile pool pattern. | `Player`, `Enemy`, all enemy archetypes, NEON-specific stats and AI. |
| `src/content.js` | Dungeon-gen room/corridor/door algorithms (BFS connectivity, room-pack), the `Item` + `Projectile` pool implementations. | Weapon catalog, item catalog, enemy spawn tables, terminal types. |
| `src/game.js` | Main loop, fade transitions, state machine (`MENU/PLAYING/HUB/...`), pause overlay, menu particles. | Floor progression rules, hub gating, run summary, UNCHAINED narrative wiring. |

---

## Engine reusability checklist

A module qualifies as **🟦 Engine** if it satisfies all of:

- [ ] No string literals naming NEON DUNGEON nouns (`AXIOM`, `core`, `shard`,
      `void`, `boost`, `module-X`, `THE GAP`) **outside the UMD namespace
      mounting boilerplate**. The `root.NEON = root.NEON || {}` attachment
      and the `NEON.X` namespace key itself are framing, not content —
      they're how modules ship in this repo, and they don't disqualify a
      module from being engine-pure.
- [ ] No numeric constants tied to NEON DUNGEON balance (e.g., a `damageMul`
      table keyed by NEON's specific stat names).
- [ ] No imports from `src/data/*` (those are game data).
- [ ] No coupling to `meta/save.js` storage keys (the wallet/install schema
      is game-specific). Talking to a generic persistence interface is fine.
- [ ] Could be unit-tested without mocking any NEON DUNGEON-specific data.

Modules currently failing this checklist for reasons that are **fixable** in
an extraction pass (rather than fundamental) are flagged in the table above.

---

## Type artifacts

This document is paired with two type-declaration files under `types/`:

- **`types/engine.d.ts`** — declares `EngineSurface`, the typed contract for
  the engine namespace. Engine-pure modules: `NEON.renderBoundary`,
  `NEON.spawn`, `NEON.telemetry`. The `NEON.alarmLight` surface is also
  declared here because the math is engine-shaped, but the module itself
  is classified Mixed (its `shouldDraw` hardcodes NEON biome ids).
  Engine-shaped Mixed contracts (`EngineArea`, `EnginePalette`,
  `EngineCinematicController`) are also declared here. Consumers can opt
  in via `/** @type {EngineSurface} */` casts; the loose
  `Window.NEON: Record<string, any>` in `types/neon.d.ts` is unchanged so
  existing call sites still type-check.
- **`types/game.d.ts`** — declares `GameSurface`, the typed contract for the
  NEON DUNGEON-specific namespace (`NEON.behavior`, `NEON.boosts`,
  `NEON.cores`, `NEON.hub`, `NEON.intro`, `NEON.logs`, `NEON.logData`,
  `NEON.modules`, `NEON.save`, `NEON.upgrades`).

Both are **documentation in the type system** rather than strict gatekeepers.
Per the Phase 3 review consensus, fields stay loose (`any` or
`Record<string, any>`) where precision doesn't pay off — the boundary is the
artifact, not the granular signatures.

---

## Extraction guide (deferred work)

When the engine is extracted into its own package, the mechanical steps are:

1. **Move 🟦 Engine modules** into `engine/src/` with their existing UMD
   shims rewritten as ES modules. Keep the `NEON.*` namespace mounting so
   the host script-tag world keeps working during transition.
2. **Move 🟪 contract halves** into `engine/src/`, leaving the data behind in
   the host game.
3. **Replace data references** in 🟪 modules with constructor-injected tables
   (e.g., `createAreaTable(rows)` instead of importing `AREAS`).
4. **Audit `src/platform.js`, `src/render.js`** for engine sections —
   they're the largest reservoir of engine-shaped code currently mixed with
   game state. Probably the biggest single chunk to factor.
5. **Define `EngineHost`**: the interface a game implements so the engine
   can drive it (provide tiles, palettes, input map, save adapter, audio
   synth). The `intro.createIntroController(host)` pattern is the seed.

The 🟧 Game modules listed above are extraction-stable: they don't need to
move. Their imports change from "global NEON namespace" to "engine package
import", but their internals stay put.

---

## Non-goals

- **No code is moving in Phase 4.** The boundary is conceptual.
- **No types tighten beyond opt-in.** `Window.NEON: Record<string, any>`
  stays loose to avoid forcing changes across all `// @ts-check`'d files.
  Tightening is a separate, file-by-file effort.
- **No build-time enforcement.** ESLint rules forbidding `import` of game
  modules from engine modules can be added later; not in scope here.

---

## Maintenance

When adding a new module:

1. Decide: 🟦 Engine, 🟧 Game, or 🟪 Mixed?
2. Add it to the table above.
3. If 🟦 Engine, add its surface to `EngineSurface` in `types/engine.d.ts`.
4. If 🟧 Game, add its surface to `GameSurface` in `types/game.d.ts`.
5. If 🟪 Mixed, the engine-shaped sub-API goes in `EngineSurface` and the
   game-specific sub-API in `GameSurface`.

If you find yourself wanting to put NEON DUNGEON nouns into an engine module,
that's a signal — either the module isn't engine, or you want to inject the
NEON DUNGEON-specific bit instead of hardcoding it.
