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
| 1 | `src/neon.js`, `src/game-states.js`, `engine/math.js`, `engine/viewport.js`, `engine/audio.js`, `engine/input.js`, `engine/touch.js`, `engine/draw.js`, `engine/decor.js`, `engine/particles.js`, `engine/minimap.js` | NEON dependency resolver, game-state vocabulary, and reusable engine helpers/primitives. |
| 2 | `src/platform.js` | Browser/platform bridge: canvas sizing, input state, settings, audio boot, tile constants. Loaded early because later files depend on globals it defines. |
| 3 | `engine/biomes.js`, `src/data/biomes.js`, `src/data/palettes.js`, `src/data/logs.js`, `src/data/whispers.js` | Engine routers plus NEON DUNGEON static data. |
| 4 | `src/meta/save.js`, `engine/telemetry.js`, `src/meta/cores.js`, `engine/spawn.js`, `engine/alarm-light.js`, `src/meta/alarm-light.js`, `src/meta/upgrades.js`, `src/meta/modules.js`, `src/meta/logs.js`, `src/meta/whispers.js`, `src/meta/behavior.js`, `src/meta/boosts.js`, `engine/cinematic.js`, `src/meta/intro.js`, `src/meta/hub.js`, `engine/render-boundary.js` | Meta/progression systems and configured engine/game shims exposed through `NEON.*`. |
| 5 | `src/content/terminals.js`, `src/content/weapons.js`, `src/content/upgrades.js`, `src/content/pickups.js`, `src/content/projectiles.js`, `src/content/music.js`, `src/content/modifiers.js`, `src/content/meta-save.js`, `src/content/combo.js`, `src/entities/room-index.js`, `src/content/events.js`, `src/content/shop.js`, `src/content/perks.js`, `src/content/effects.js`, `src/content/hackware.js`, `src/content/status.js`, `src/content/lighting.js`, `src/content/floor-generator.js`, `src/content.js`, `src/entities/source-metadata.js`, `src/entities/spawn-table.js`, `src/entities.js`, `src/entities/ai-helpers.js`, `src/entities/architect-walls.js`, `src/entities/beacons.js`, `src/entities/crates.js`, `src/entities/mines.js`, `src/entities/shield-generators.js`, `src/entities/security-systems.js`, `src/entities/wall-turrets.js`, `src/entities/field-effects.js`, `src/entities/death-hooks.js`, `src/entities/fuse-shards.js`, `src/entities/render-passes.js`, `src/entities/volatile-cores.js`, `src/render.js`, `src/game.js` | Content submodules first, with entity support modules loaded before content/entity consumers, then floor generation, the legacy content facade, entity metadata/spawn tables, entity core/support modules, rendering/HUD, and game-state orchestration. |

When adding a new browser module, update `scripts/manifest.js`, `index.html`,
and `sw.js` `ASSETS`. There is no service-worker cache version to bump; `sw.js`
uses a stable cache name plus network-first freshness for explicit assets.

## Large-file ownership

| File | Owns | Human warning signs | Useful tests |
|---|---|---|---|
| `src/platform.js` | Canvas sizing, safe-area layout, settings, key/touch/mouse routing, audio unlock, save slots, tile constants. | Touch hit-tests mirror render layout in places; world zoom affects platform, render, and game wrapping together. | `tests/touch.test.js`, `tests/settings-scale.test.js`, `tests/world-zoom.test.js`, `tests/reset-defaults-confirm.test.js` |
| `src/content/terminals.js` | Lore terminal strings, floor gates, and `pickLoreEntryIndex`. | Must load before `src/content.js` and `src/game.js`; keep floor gates aligned with Act 1 narrative guardrails. | `tests/lore-terminals-act1.test.js`, `tests/act1-narrative-guardrails.test.js` |
| `src/content/weapons.js` | Weapon catalog, weapon affix catalog, elite-affix catalog, and deterministic `buildWeapon` / `rollWeapon` helpers. | Must load before `src/content.js`, `src/entities.js`, `src/render.js`, and `src/game.js`; source-text weapon tests should read this file directly. | Weapon-affix tests, `tests/predator-elite-affix.test.js`, `tests/elite-minimap-legend.test.js` |
| `src/content/upgrades.js` | In-run upgrade catalog, augment catalog, and derived augment keys. | Must load before `src/content.js`; catalog callbacks intentionally reference content/game globals only when invoked after all runtime scripts load. | `tests/scavenger-credit-bonus.test.js`, augment wiring tests |
| `src/content/pickups.js` | Runtime pickup classes, pickup-specific constants, generic item-type selection, and secret-room weapon-cache reward rolling (`Item`, `KeyItem`, `WhisperItem`, `WeaponCacheItem`, `HarvestPickup`, `MagpieHoard`, `VaultCoin`, `ShockPulsePickup`, `ITEM_TYPES`, `pickItemType`, `rollSecretWeaponCacheWeapon`). | Must load before `src/content.js`, `src/entities.js`, `src/render.js`, and `src/game.js`; constructors and reward rollers reference runtime globals only when pickups are spawned after all scripts load. | `tests/shock-pulse.test.js`, `tests/magpie.test.js`, `tests/vaultmaster.test.js`, `tests/harvester.test.js`, `tests/armory-reward-flow.test.js` |
| `src/content/projectiles.js` | Pooled projectile runtime (`Projectile`, `projectiles`, `releaseProjectile`) and grenade hazard-zone helpers (`detonateGrenade`, `updateHazardZones`, `drawHazardZones`). | Must load before `src/content.js`, `src/entities.js`, `src/render.js`, and `src/game.js`; projectile collision and pooled-field reset behavior have focused source and VM regression tests. | `tests/projectile-wall-corner.test.js`, `tests/time-dilation-hackware.test.js`, `tests/hot-hand-perk.test.js` |
| `src/content/music.js` | Procedural gameplay music controller and rendered title/menu music surface (`music`). | Must load before `src/game.js`; it keeps the legacy global `music` name while isolating Web Audio state from generation/content code. | `tests/title-music.test.js`, `tests/game-state-machine.test.js`, `tests/audio.test.js` |
| `src/content/modifiers.js` | Difficulty registry, floor-modifier registry, and modifier helpers (`getDiff`, `getMod`, `modSpeed`). | Must load before `src/content.js`, `src/entities.js`, `src/render.js`, and `src/game.js`; helpers use a deferred `game` proxy because the runtime `game` object is declared later. | Modifier tests, `tests/gap-upgrades.test.js` |
| `src/content/meta-save.js` | Meta-progression compatibility wrappers over `NEON.save` (`loadMeta`, `saveMeta`, `applyMetaToPlayer`, core/log/module helpers). | Must load after `src/content/modifiers.js` and `src/content/weapons.js`, before `src/content.js`, `src/entities.js`, and `src/game.js`; wrappers inject legacy content globals into the save module where needed. | `tests/source-files.test.js`, save/meta tests |
| `src/content/combo.js` | Score-combo runtime state and kill-streak helpers (`combo`, `COMBO_WINDOW`, `comboMultiplier`, `comboBossMultiplier`, `comboColour`, `registerKill`, `updateCombo`). | Must load before `src/content.js`, `src/content/events.js`, `src/entities.js`, `src/render.js`, and `src/game.js`; helper callbacks resolve runtime globals only when invoked after boot. | `tests/overdrive.test.js`, `tests/overdrive-hud.test.js` |
| `src/content/events.js` | Floor event terminal catalog, story protocol trial routing, event effect helpers, and rare-terminal module/log drop hooks. | Must load before `src/content.js`, `src/entities.js`, and `src/game.js`; event effect functions intentionally resolve later script-tag globals only when invoked after runtime boot. | `tests/story-event-rooms.test.js` |
| `src/content/shop.js` | Vendor inventory generation, shop pricing, and shop/choice option factories (`makeWeaponOption`, `makeHackwareOption`, `pickUpgradeOption`, `makeAugmentShopOption`, `SHOP_PRICES`, `shopPrice`, `generateShopItems`). | Must load before `src/content.js`, `src/render.js`, and `src/game.js`; option callbacks intentionally resolve runtime globals only when invoked after boot. | `tests/source-files.test.js`, `tests/seeded-generation.test.js` |
| `src/content/perks.js` | Level-up perk registry, capstone metadata, perk application, augment choice rolling, and `hasAugment()`. | Must load before `src/content.js`, `src/entities.js`, `src/render.js`, and `src/game.js`; functions intentionally resolve runtime globals only when invoked after boot. | Perk tests, HUD alignment tests, `tests/source-files.test.js` |
| `src/content/effects.js` | Gameplay feedback effects: pooled particles, ambient particles, floating damage text, and screen shake. | Must load before `src/content.js`, `src/entities.js`, `src/render.js`, and `src/game.js`; it captures `NEON.particles` at load and resolves visual/runtime globals only when invoked after boot. | `tests/reduced-motion-particles.test.js`, `tests/dmg-text-and-bomb-render.test.js`, `tests/settings-scale.test.js` |
| `src/content/hackware.js` | Active hackware catalog, activation cases, persistent world-space hackware effects, targeting/immunity helpers, and the hackware draw pass. | Must load after projectile/effect helpers and before `src/content.js`, `src/entities.js`, `src/render.js`, and `src/game.js`; callbacks intentionally resolve runtime globals only after boot. | Hackware source-text tests, `tests/scrap-magnet.test.js`, `tests/spawn-grace.test.js`, `tests/ghostwalk-iframes.test.js` |
| `src/content/status.js` | HUD status indicators: low-HP danger vignette, floor-modifier banner, status-effect badge collection, and status badge rendering. | Must load after hackware helpers and before `src/content.js`, `src/render.js`, and `src/game.js`; badge collection intentionally resolves runtime globals only after boot. | `tests/status-bar.test.js`, HUD alignment tests, `tests/reduced-motion-vignette.test.js`, `tests/settings-scale.test.js` |
| `src/content/lighting.js` | Lighting/FOV pass and LOS helper (`updateLighting`, `tileHasLOS`). | Must load before `src/content.js`, `src/game.js`, and source-text FOV tests; functions resolve runtime globals only after boot. | `tests/recon-sensor-radius.test.js`, `tests/source-files.test.js` |
| `src/content/floor-generator.js` | Dungeon generation helpers, room feature placement, and lore-terminal placement (`createMap`, `carveRect`, `carveCorridor`, `bfsRooms`, `resolvePreferredSpawnRoom`, `generateFloor`). | Must load after content catalogs/helpers and before `src/content.js`, `src/entities.js`, `src/render.js`, and `src/game.js`; it remains under `src/content/` until runtime/global couplings are untangled enough for an engine-level generator. | `tests/seeded-generation.test.js`, `tests/generation-accessibility.test.js`, `tests/mainframe-room.test.js`, `tests/act1-opening-story-spine.test.js` |
| `src/content.js` | Legacy compatibility facade for the original script-tag load slot. | Must load after `src/content/floor-generator.js`; no gameplay ownership should be added back here. | `tests/source-files.test.js` |
| `src/entities/source-metadata.js` | Entity source attribution and boss metadata (`CREDIT_VALUES`, `SOURCE_LABELS`, `SOURCE_COLOURS`, `sourceLabel`, `sourceColour`, `BOSS_NAMES`, `getBossPhaseMarks`). | Must load before `src/entities.js` because enemy death rewards read `CREDIT_VALUES`; later render/game code reads source labels, colours, and boss names as classic script globals. | `tests/source-files.test.js`, mob attribution source-text tests |
| `src/entities.js` | Entity base, player, enemies, boss behavior, combat effects, runtime actor collections. | High coupling to `game` state, room indexes, source metadata, and extracted entity support modules; small AI changes can affect seeded determinism or HUD expectations. | Enemy-specific tests, `tests/seeded-generation.test.js`, combat modifier tests |
| `src/entities/ai-helpers.js` | Pure enemy AI helpers (`isInsideCone`, `getPositionAgoFromHistory`, `predictFromHistory`, `pickMirrorKinematics`, `magnetonBendDir`). | Must load after `src/entities.js` and before gameplay can run; helper bodies reuse entity tuning constants for MIRROR/MAGNETON behavior. | `tests/resonator.test.js`, `tests/echoer.test.js`, `tests/prophet.test.js`, `tests/mirror.test.js`, `tests/magneton.test.js`, `tests/source-files.test.js` |
| `src/entities/architect-walls.js` | ARCHITECT placed-wall targeting and decay helpers (`pickArchitectTarget`, `_isTileOccupiedByActor`, `updatePlacedWalls`). | Must load after `src/entities.js` and before gameplay can run; it relies on shared script-tag globals from `src/entities.js` (`placedWalls`, `enemies`, `_EG`). | `tests/architect.test.js`, `tests/source-files.test.js` |
| `src/entities/beacons.js` | Alarm beacon runtime (`BEACON_COUNTDOWN`, `createBeacon`, `damageBeacon`, `destroyBeacon`, `damageBeaconsInRadius`, `updateBeacons`, `drawBeacons`). | Must load after `src/entities.js` and before `src/entities/volatile-cores.js`/`src/render.js`/`src/game.js`; it relies on shared script-tag globals from `src/entities.js` (`_EG`, `beacons`, `pendingEnemySpawns`) and content/economy helpers. | `tests/source-files.test.js`, `tests/projectile-wall-corner.test.js`, `tests/seeded-generation.test.js` |
| `src/entities/crates.js` | Crate runtime helpers (`createCrate`, `getCrateAt`, `damageCrate`, `destroyCrate`, `damageCrateAtTile`, `damageCratesInRadius`). | Must load after `src/entities.js` and before `src/entities/volatile-cores.js`; it relies on shared script-tag globals from `src/entities.js` (`_EG`, `crates`) and content feedback helpers. | `tests/source-files.test.js`, `tests/seeded-generation.test.js`, projectile/generation tests |
| `src/entities/mines.js` | Proximity mine runtime (`MINE_*` constants, `createMine`, `armMine`, `detonateMine`, `triggerMinesInRadius`, `updateMines`, `drawMines`). | Must load after `src/entities.js` and before `src/entities/volatile-cores.js`/`src/render.js`/`src/game.js`; it relies on shared script-tag globals from `src/entities.js` (`_EG`, `mines`, `enemies`) and environment damage helpers resolved at runtime. | `tests/source-files.test.js`, `tests/projectile-wall-corner.test.js`, `tests/seeded-generation.test.js` |
| `src/entities/shield-generators.js` | Shield generator runtime (`SHIELD_GEN_DR`, `createShieldGen`, `damageShieldGen`, `destroyShieldGen`, `damageShieldGensInRadius`, `isEnemyShieldGenProtected`, `updateShieldGens`, `drawShieldGens`). | Must load after `src/entities.js` and before `src/entities/volatile-cores.js`/`src/render.js`/`src/game.js`; it relies on shared script-tag globals from `src/entities.js` (`_EG`, `shieldGens`, `enemies`) and room-index helpers. | `tests/source-files.test.js`, mitigation/hackware tests, projectile/generation tests |
| `src/entities/death-hooks.js` | Entity death notification hooks (`notifyGhostProjectors`, `notifyVengeance`) invoked by `Enemy.die()`. | Must load after `src/entities.js` and before gameplay can run; it relies on shared script-tag lexical globals from `src/entities.js` (`GHOSTABLE_TYPES`, `GHOST_PROJECTOR_DELAY`) and `src/entities/room-index.js` (`enemiesByRoom`). | `tests/ghost-projector.test.js`, `tests/vengeance.test.js`, `tests/source-files.test.js` |
| `src/entities/render-passes.js` | Entity-side render side-passes (`drawReaperPlayerRings`, `drawTetherLeashes`) invoked by `src/game.js` before the player sprite. | Must load after `src/entities.js` and before `src/game.js`; it relies on shared script-tag lexical globals from `src/entities.js` (`_EG`, `enemies`, REAPER/TETHER tuning constants). | `tests/reaper.test.js`, `tests/tether.test.js`, `tests/source-files.test.js` |
| `src/entities/volatile-cores.js` | Volatile core runtime (`createVCore`, `primeVCoresInRadius`, `detonateVCore`, `updateVCores`, `drawVCores`). | Must load after `src/entities.js` and before `src/render.js`/`src/game.js`; it relies on shared script-tag lexical globals from `src/entities.js` (`_EG`, `vcores`, `enemies`) and later entity helper functions resolved at runtime. | `tests/source-files.test.js`, `tests/seeded-generation.test.js`, projectile/generation tests |
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
| `src/content/terminals.js` | Lore selection globals (`ACT1_OPENING_LORE_INDEX`, `LORE_ENTRIES`, `LORE_ENTRY_FLOOR_MIN`, `pickLoreEntryIndex`) consumed by `src/content.js`, `src/game.js`, and source-text tests. |
| `src/content/weapons.js` | Weapon and affix globals (`WEAPONS`, `WEAPON_KEYS`, `WEAPON_AFFIXES`, `AFFIX_KEYS`, `AFFIX_PREFIXES`, `AFFIX_SUFFIXES`, `ELITE_AFFIXES`, `ELITE_AFFIX_KEYS`, `rollEliteAffix`, `affixEligible`, `buildWeapon`, `rollWeapon`, `RARITY_COLOURS`, `RARITY_LABELS`) consumed by `src/content.js`, `src/entities.js`, `src/render.js`, `src/game.js`, and source-text tests. |
| `src/content/upgrades.js` | Upgrade and augment globals (`UPGRADES`, `MAX_AUGMENTS`, `AUGMENTS`, `AUGMENT_KEYS`) consumed by `src/content.js`, `src/entities.js`, `src/render.js`, `src/game.js`, and source-text tests. |
| `src/content/pickups.js` | Pickup globals (`HarvestPickup`, `MagpieHoard`, `VaultCoin`, `SHOCK_PULSE_RADIUS`, `SHOCK_PULSE_STUN`, `SHOCK_PULSE_BOSS_STUN`, `SHOCK_PULSE_KNOCK`, `ShockPulsePickup`, `ITEM_TYPES`, `pickItemType`, `Item`, `KeyItem`, `WhisperItem`, `WeaponCacheItem`, `rollSecretWeaponCacheWeapon`) consumed by `src/content.js`, `src/entities.js`, `src/render.js`, `src/game.js`, and source-text tests. |
| `src/content/projectiles.js` | Projectile globals (`PROJECTILE_CAP`, `projectiles`, `releaseProjectile`, `Projectile`, `detonateGrenade`, `updateHazardZones`, `drawHazardZones`) consumed by `src/content.js`, `src/entities.js`, `src/render.js`, `src/game.js`, and source-text tests. |
| `src/content/music.js` | Procedural/title music global (`music`) consumed by `src/platform.js` and `src/game.js`. |
| `src/content/modifiers.js` | Difficulty and floor-modifier globals (`DIFFICULTIES`, `DIFF_ORDER`, `getDiff`, `FLOOR_MODIFIERS`, `MODIFIER_KEYS`, `getMod`, `modSpeed`) consumed by `src/content.js`, `src/entities.js`, `src/render.js`, `src/game.js`, and source-text tests. |
| `src/content/meta-save.js` | Meta-save wrapper globals (`META_UPGRADES`, `DIFF_UNLOCK_REQS`, `loadMeta`, `saveMeta`, `getMetaLevel`, `isDiffUnlocked`, `calcRunShards`, `applyMetaToPlayer`, `getMetaXPMultiplier`, `getMetaCreditMultiplier`, `resetMeta`, `addCores`, `spendCores`, `addLogFound`, `markLogRead`, `installModule`, `sellModule`) consumed by `src/entities.js`, `src/render.js`, `src/game.js`, and source-text tests. |
| `src/content/combo.js` | Combo globals (`combo`, `COMBO_WINDOW`, `comboMultiplier`, `comboBossMultiplier`, `comboColour`, `registerKill`, `updateCombo`) consumed by `src/content.js`, `src/content/events.js`, `src/entities.js`, `src/render.js`, `src/game.js`, and source-text tests. |
| `src/content/events.js` | Event globals (`EVENTS`, `STORY_PROTOCOL_TRIAL_BY_FLOOR`, `storyProtocolTrialForFloor`, `rollEvent`, `revealFloorLayout`, `openNearestLockedDoor`, `spawnProtocolAlarm`, `applyEventEffect`, `tryRareTerminalModuleDrop`, `tryRareTerminalLogDrop`) consumed by `src/game.js` and source-text tests. |
| `src/content/shop.js` | Shop/choice globals (`makeWeaponOption`, `makeHackwareOption`, `pickUpgradeOption`, `makeAugmentShopOption`, `SHOP_PRICES`, `shopPrice`, `generateShopItems`) consumed by `src/render.js`, `src/game.js`, and source-text tests. |
| `src/content/perks.js` | Perk and augment-choice globals (`PERK_POOL`, `PERK_CAPSTONE`, `PERK_LEVELS`, `rollPerkChoices`, `applyPerk`, `grantCapstone`, `hasAugment`, `rollAugmentChoices`) consumed by `src/content.js`, `src/entities.js`, `src/render.js`, `src/game.js`, and source-text tests. |
| `src/content/effects.js` | Feedback-effect globals (`spawnParticles`, `updateParticles`, `drawParticles`, `clearParticles`, `particleCount`, `ambientParticles`, `updateAmbient`, `drawAmbient`, `floatingTexts`, `spawnDmgText`, `updateFloatingTexts`, `drawFloatingTexts`, `shake`, `triggerShake`, `updateShake`) consumed by `src/content.js`, `src/entities.js`, `src/render.js`, `src/game.js`, and source-text tests. |
| `src/content/hackware.js` | Hackware globals (`HACKWARE`, `HACKWARE_KEYS`, `hackwareEffects`, `canTargetPlayer`, `isPlayerDamageImmune`, `activateHackware`, `updateHackwareEffects`, `drawHackwareEffects`) consumed by `src/content.js`, `src/entities.js`, `src/render.js`, `src/game.js`, and source-text tests. |
| `src/content/status.js` | HUD status globals (`drawDangerVignette`, `drawModBanner`, `getStatusEffects`, `drawStatusBar`) consumed by `src/render.js`, `src/game.js`, and source-text tests. |
| `src/content/lighting.js` | Lighting globals (`updateLighting`, `tileHasLOS`) consumed by `src/game.js` and source-text tests. |
| `src/content/floor-generator.js` | Dungeon generation (`createMap`, `carveRect`, `carveCorridor`, `bfsRooms`, `resolvePreferredSpawnRoom`, `generateFloor`) and lore-terminal placement consumed by `src/game.js` and source-text generation tests. |
| `src/content.js` | Compatibility facade kept for the historical script-tag load slot; it should not own gameplay globals. |
| `src/entities/room-index.js` | Room-scoped enemy index (`enemiesByRoom`, `registerEnemyInRoom`, `unregisterEnemyFromRoom`, `clearEnemiesByRoom`, `getEnemiesInRoom`, `enemiesInRoomIter`). | Must load before `src/content/events.js` and `src/entities.js`; helpers operate on opaque room/enemy references and are consumed by content events, entity AI, `src/render.js`, `src/game.js`, and source-text tests. |
| `src/entities/source-metadata.js` | Source attribution and boss metadata globals (`CREDIT_VALUES`, `SOURCE_LABELS`, `SOURCE_COLOURS`, `sourceLabel`, `sourceColour`, `BOSS_NAMES`, `BOSS_PHASE_MARKS`, `getBossPhaseMarks`) consumed by `src/entities.js`, `src/render.js`, `src/game.js`, and source-text tests. Must load before `src/entities.js`. |
| `src/entities/spawn-table.js` | Enemy weighted selection globals (`ENEMY_WEIGHTS`, `ENEMY_TYPES_LIST`, `pickEnemyType`) consumed by room population, event spawns, challenge waves, beacon/security reinforcements, `src/render.js`, `src/game.js`, and source-text tests. Must load before `src/entities.js` and support modules that call `pickEnemyType`. |
| `src/entities.js` | Runtime collections (`enemies`, `items`, `hazardZones`, `vcores`, `crates`, traps/turrets/field arrays), combat/AI/entity classes and spawn/update helpers (`Player`, `Enemy`, boss/enemy subclasses or factories, `spawnEnemy`), and any globals consumed by `src/game.js`, `src/render.js`, tests, or save/restore logic. |
| `src/entities/ai-helpers.js` | Pure AI helper globals (`isInsideCone`, `getPositionAgoFromHistory`, `predictFromHistory`, `pickMirrorKinematics`, `magnetonBendDir`) consumed by Player helpers and enemy AI methods in `src/entities.js`. Must load after `src/entities.js`; it relies on shared script-tag lexical constants from `src/entities.js` for MIRROR/MAGNETON tuning. |
| `src/entities/architect-walls.js` | ARCHITECT wall globals (`pickArchitectTarget`, `_isTileOccupiedByActor`, `updatePlacedWalls`) consumed by ARCHITECT AI and `src/game.js` update ticking. Must load after `src/entities.js`; helpers operate on the shared `placedWalls` collection. |
| `src/entities/beacons.js` | Alarm beacon globals (`BEACON_COUNTDOWN`, `createBeacon`, `damageBeacon`, `destroyBeacon`, `damageBeaconsInRadius`, `updateBeacons`, `drawBeacons`) consumed by floor population, projectiles, explosions, `src/game.js`, and source-text tests. Must load after `src/entities.js` and before `src/entities/volatile-cores.js`; helpers operate on the shared `beacons` collection. |
| `src/entities/crates.js` | Crate globals (`createCrate`, `getCrateAt`, `damageCrate`, `destroyCrate`, `damageCrateAtTile`, `damageCratesInRadius`) consumed by generation, projectiles, volatile cores, and source-text tests. Must load after `src/entities.js` and before `src/entities/volatile-cores.js`; helpers operate on the shared `crates` collection. |
| `src/entities/mines.js` | Proximity mine globals (`MINE_TRIGGER_RADIUS`, `MINE_REVEAL_RADIUS`, `MINE_BLAST_RADIUS`, `MINE_FUSE_NORMAL`, `MINE_FUSE_SHOT`, `createMine`, `armMine`, `detonateMine`, `triggerMinesInRadius`, `updateMines`, `drawMines`) consumed by floor population, projectiles, explosions, `src/game.js`, and source-text tests. Must load after `src/entities.js` and before `src/entities/volatile-cores.js`; helpers operate on the shared `mines` collection. |
| `src/entities/shield-generators.js` | Shield generator globals (`SHIELD_GEN_DR`, `createShieldGen`, `damageShieldGen`, `destroyShieldGen`, `damageShieldGensInRadius`, `isEnemyShieldGenProtected`, `updateShieldGens`, `drawShieldGens`) consumed by enemy mitigation, floor population, projectiles, hackware, explosions, `src/game.js`, and source-text tests. Must load after `src/entities.js` and before `src/entities/volatile-cores.js`; helpers operate on the shared `shieldGens` collection. |
| `src/entities/security-systems.js` | Security device globals (`CAMERA_*`, `LASER_*`, `createCamera`, `damageCamera`, `damageCamerasInRadius`, `updateCameras`, `drawCameras`, `createLaser`, `damageLaserEmitter`, `damageLasersInRadius`, `updateLasers`, `drawLasers`) consumed by floor population, projectiles, hackware, explosions, `src/game.js`, and source-text tests. Must load after `src/entities.js` and before `src/entities/volatile-cores.js`; helpers operate on the shared `cameras` and `lasers` collections. |
| `src/entities/wall-turrets.js` | Wall turret globals (`WTURRET_*`, `createWallTurret`, `wallTurretDmg`, `damageWallTurret`, `destroyWallTurret`, `hackWallTurret`, `damageWallTurretsInRadius`, `updateWallTurrets`, `drawWallTurrets`) consumed by floor population, projectiles, hackware, explosions, room-clear checks, `src/game.js`, and source-text tests. Must load after `src/entities.js` and before `src/entities/volatile-cores.js`; helpers operate on the shared `wallTurrets` collection. |
| `src/entities/field-effects.js` | Persistent field-effect globals (`disruptionFields`, `gravityWells`, `frostPatches`, `updateDisruptionFields`, `drawDisruptionFields`, `isPlayerInNullifierAura`, `updateNullifierJam`, `updateFrostPatches`, `drawFrostPatches`, `updateGravityWells`, `drawGravityWells`) consumed by DISRUPTOR/CRYOPHAGE/GRAVITON/NULLIFIER AI, hackware, save/restore, `src/render.js`, and `src/game.js`. Must load after `src/entities.js` and before `src/render.js`/`src/game.js`; helpers operate on shared enemy/player globals from `src/entities.js`. |
| `src/entities/death-hooks.js` | Death notification hook globals (`notifyGhostProjectors`, `notifyVengeance`) consumed by `Enemy.die()` in `src/entities.js` after all scripts load. Must load after `src/entities.js`; it relies on shared script-tag lexical globals from `src/entities.js` and the room index. |
| `src/entities/fuse-shards.js` | Tap-bomb runtime (`fuseShards`, `FuseShard`, `BOMB_DROP_COOLDOWN`, `_detonateBombAt`, `updateFuseShards`, `drawFuseShards`, `clearFuseShards`) consumed by `src/entities.js`, `src/render.js`, `src/game.js`, save/restore, and source-text tests. Must load after `src/entities.js` and before `src/render.js`/`src/game.js`; it relies on shared script-tag lexical globals from `src/entities.js` (`_EG`, `enemies`). |
| `src/entities/render-passes.js` | Pre-player entity render pass globals (`drawReaperPlayerRings`, `drawTetherLeashes`) consumed by `src/game.js` and source-text tests. Must load after `src/entities.js` and before `src/game.js`; it relies on shared script-tag lexical globals from `src/entities.js` (`_EG`, `enemies`, REAPER/TETHER tuning constants). |
| `src/entities/volatile-cores.js` | Volatile core globals (`createVCore`, `primeVCoresInRadius`, `detonateVCore`, `updateVCores`, `drawVCores`) consumed by generation, projectiles, enemy damage hooks, render, and the game loop. Must load after `src/entities.js` and before `src/render.js`/`src/game.js`; helper calls into crates/beacons/mines resolve at runtime after all entity scripts load. |

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
4. Add it to `scripts/manifest.js` and `sw.js` `ASSETS`.
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
