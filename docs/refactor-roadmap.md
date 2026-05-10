# Refactor roadmap for human handoff

This roadmap is deliberately incremental. The codebase is already type-checked
and test-covered under a no-bundler script-tag architecture. A broad TypeScript
conversion or class-per-file rewrite would create high merge risk before it
creates human value.

## Current decision

Keep the current architecture for now:

- JavaScript files with `// @ts-check` and JSDoc types.
- UMD-lite modules for code that must run in browser script tags and Node tests.
- `index.html` as the explicit dependency graph.
- `sw.js` as the explicit PWA asset list.
- `npm run check` as the merge gate.

Do not convert the repo to TypeScript or ES modules until the seams below are
smaller and the browser loading strategy is intentionally changed.

## Why not TypeScript first?

The repo already gets most practical type safety from `tsc --noEmit` over
checked JavaScript. A TypeScript migration would require choosing a bundler or
emitting browser-ready JavaScript, rewriting script loading, updating service
worker assets, and touching nearly every file. That is a release-engineering
project, not a handoff prerequisite.

TypeScript becomes attractive after:

1. the large runtime files have smaller extracted modules;
2. `NEON.*` surfaces have narrower declarations in `types/*.d.ts`;
3. a build artifact and service-worker strategy are designed together;
4. the team accepts a build step for local play and GitHub Pages deployment.

## Why not class-per-file first?

`src/entities.js` contains many classes, but the hard problem is not file count.
The hard problem is shared runtime state: `game`, global actor collections, room
indexes, content registries, save snapshots, and render/HUD assumptions. Splitting
classes before isolating those dependencies would scatter coupling across many
files and make the script order harder to reason about.

Prefer extracting pure helper modules and stable data tables first.

## Recommended sequence

### Phase 1: freeze the map

Goal: make future movement obvious and safe.

- Keep `README.md`, `docs/module-map.md`, and `docs/engine-boundary.md` current.
- For every new module, classify it as engine, game, or mixed.
- Keep `npm run check` green.
- Keep engine purity enforced with `npm run check:engine`.

### Phase 2: move static data out of runtime files

Goal: reduce `src/game.js` and `src/content.js` without changing runtime behavior.

Good candidates:

- Narrative/static registries in `src/game.js`.
- Lore/content tables in `src/content.js`.
- Any UI copy arrays that can become `src/data/*` or `src/meta/*`.

Rules:

- Preserve ids and save-facing strings unless a migration/test covers the change.
- Add the new file to `index.html` and `sw.js` if browser-loaded.
- Cover with extraction tests that load the new module directly.

### Phase 3: extract pure render and geometry helpers

Goal: leave `src/render.js` as orchestration over tested helpers.

Good candidates:

- HUD layout calculations that can be tested without canvas.
- Minimap and threat-indicator geometry.
- Reusable canvas primitives that belong in `engine/draw.js`.

Rules:

- Do not allocate in `drawWorld` or tile-decor hot loops.
- Keep compact/mobile HUD tests whenever moving layout code.
- Preserve canvas save/restore boundaries.

### Phase 4: isolate platform host services

Goal: make browser concerns explicit.

Good candidates:

- Pure passability/LOS helpers that can move behind engine-style callbacks.
- Settings normalization helpers.
- Touch geometry helpers where render and hit-test layout currently duplicate
  constants.

Rules:

- Keep `resize()`, `updateLayout()`, `worldZoom`, and render global scaling
  changes together.
- Run `tests/world-zoom.test.js`, `tests/touch.test.js`, and `npm run check`.

### Phase 5: isolate entity rule helpers

Goal: make combat and actor behavior easier to test without moving every class.

Good candidates:

- Status-effect math. Done for enemy status ticking in `src/entities/status-effects.js`.
- Hit-effect application rules. Done for weapon-affix on-hit/on-kill rules in `src/entities/combat-effects.js`.
- Deferred spawn queue ownership. Done for `pendingEnemySpawns` and ghost replay queueing in `src/entities/deferred-spawns.js`.
- Spawn-time modifier helpers. Done for floor-modifier HP scaling and elite rolls in `src/entities/spawn-modifiers.js`.
- Shared enemy perception/leash tuning. Done for target-memory and room-leash constants in `src/entities/enemy-awareness.js`.
- Static per-enemy ability tuning. Done for the module-top constants consumed by enemy AI/draw/helper paths in `src/entities/enemy-ability-tuning.js`.
- Static Player perk tuning. Done for STRIDE/DEADEYE/HOT_HAND constants in `src/entities/player-perk-tuning.js`.
- Entity runtime game proxy. Done for `_EG` in `src/entities/runtime-globals.js`.
- Shared entity runtime collections. Done for actor/hazard/device arrays in `src/entities/runtime-collections.js`.
- Per-type spawn state initialization. Done for `initializeEnemySpawnState()` and the CONDUIT spawn-order counter in `src/entities/spawn-initializers.js`.
- Enemy spawn construction orchestration. Done for `spawnEnemy()` in `src/entities/enemy-spawning.js`.
- Wall-device orientation tuning. Done for the shared `WALL_FACING` table in `src/entities/wall-facing.js`.
- Shock Pulse pickup detonation. Done for `triggerShockPulse` in `src/entities/shock-pulse.js`.
- Standard enemy projectile launching. Done for `Enemy.prototype.fireAt()` in `src/entities/enemy-projectiles.js`.
- Generic enemy patrol targeting. Done for `Enemy.prototype.patrol()` in `src/entities/enemy-movement.js`.
- Elite combat-tempo scaling. Done for `Enemy.prototype.berserkerMul()` in `src/entities/enemy-tempo.js`.
- Enemy target eligibility and leash helpers. Done for `_canTarget()`, `_forgetTarget()`, and `_isLeashedFromRoom()` in `src/entities/enemy-targeting.js`.
- Enemy projectile defense helpers. Done for `blocksProjectile()` and `reflectsProjectile()` in `src/entities/enemy-projectile-defense.js`.
- CONDUIT beam geometry helper. Done for `_cdHitsPlayer()` in `src/entities/enemy-conduit.js`.
- WARDLING ward acquisition helper. Done for `_wlFindWard()` in `src/entities/enemy-wardling.js`.
- HEALER wounded-ally target selection helper. Done for `_findHealTarget()` in `src/entities/enemy-healer.js`.
- GRENADIER grenade launch helper. Done for `lobGrenade()` in `src/entities/enemy-grenadier.js`.
- SUMMONER minion enqueue helper. Done for `summonMinion()` in `src/entities/enemy-summoner.js`.
- MIMIC reveal helper. Done for `revealMimic()` in `src/entities/enemy-mimic.js`.
- NEXUS link-maintenance helpers. Done for `_nxUpdateLinks()` and `_nxFindAllyCluster()` in `src/entities/enemy-nexus.js`.
- PHANTOM reposition helper. Done for `_phReposition()` in `src/entities/enemy-phantom.js`.
- WRAITH-style emergence helper. Done for `_wrFindEmergeTile()` in `src/entities/enemy-wraith.js`.
- Boss/enemy selection helpers.
- Small pure movement/targeting decisions.

Rules:

- Do not change global actor arrays or room-index ownership in the same PR as a
  helper extraction.
- Watch seeded determinism and save/restore behavior.

### Phase 6: reduce `src/game.js` last

Goal: keep `game` as coordinator while extracting tested pure subsystems.

Good candidates:

- Floor snapshot serialize/restore helpers.
- Lifecycle copy selection.
- System-message queue normalization.
- Mainframe/finale static record data.

Rules:

- Preserve active-run saves and legacy meta migrations.
- Add tests before moving any state-machine transition.

## A future TypeScript/build migration

Only start this after the phases above have shrunk the large files.

Suggested migration plan when ready:

1. Add a build proof-of-concept for one engine-only module.
2. Decide how GitHub Pages and `sw.js` will consume emitted files.
3. Keep UMD/browser globals during transition or provide a compatibility layer.
4. Convert engine modules before game modules.
5. Convert `src/game.js` last.

The first TypeScript PR should not also change gameplay.
