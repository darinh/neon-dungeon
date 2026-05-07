# NEON DUNGEON

NEON DUNGEON is a browser-first canvas roguelite. It ships as plain JavaScript
loaded by `index.html`: no bundler, no npm runtime packages, no build artifact.
Production `index.html` does load PostHog's hosted analytics script; telemetry
is routed through `engine/telemetry.js` and disclosed in `privacy.html`. The
codebase uses JSDoc plus `// @ts-check` for type safety and `node:test` for the
test suite.

## Quick start

```bash
npm ci
npm run check
```

To play locally, serve the repository with any static file server and open
`index.html`. Opening the file directly can work for quick visual checks, but a
local server is closer to GitHub Pages and service-worker behavior.

## Required checks

| Command | What it does |
|---|---|
| `npm test` | Runs all `tests/*.test.js` files with Node's built-in test runner. |
| `npm run typecheck` | Runs `tsc --noEmit` over checked JavaScript and declaration files. |
| `npm run lint` | Runs ESLint over the repository. |
| `npm run check:engine` | Verifies `engine/*.js` stays free of NEON-specific content tokens. |
| `npm run check` | Canonical gate: lint, typecheck, engine purity, then tests. |

Run `npm run check` before opening a PR.

## Architecture at a glance

The runtime is ordered script tags in `index.html`:

1. `src/neon.js` fail-loud dependency resolver, `src/game-states.js`
   runtime state vocabulary, then early `engine/*.js` helpers: RNG, viewport,
   audio, input, touch, draw, decor, particles, minimap.
2. `src/platform.js`: browser/platform bridge and shared globals used by later
   modules.
3. Interleaved engine/data/meta modules: biome routing, static data, save/meta
   state, telemetry, cores, spawn, alarm-light wiring, upgrades/modules,
   logs/whispers, behavior/boosts, intro/hub, render-boundary.
4. Final large runtime files: `src/content.js`, `src/entities.js`,
   `src/render.js`, `src/game.js`.

The script order is part of the architecture. Producers must appear before
consumers in `index.html`, and browser assets must be listed in `sw.js` so the
PWA cache can precache them.

For the detailed map, see `docs/module-map.md`. For the engine/game boundary,
see `docs/engine-boundary.md`.

## Where to make changes

| Area | Start here | Guardrails |
|---|---|---|
| Game flow, menus, save/resume, finale | `src/game.js` | `tests/save.test.js`, `tests/seeded-generation.test.js`, `tests/mainframe-room.test.js` |
| Player/enemies/combat simulation | `src/entities.js` | Combat and enemy-specific tests in `tests/*.test.js` |
| Weapons, items, projectiles, dungeon generation, lore terminals | `src/content.js` | `tests/projectile-wall-corner.test.js`, `tests/lore-terminals-act1.test.js`, seeded generation tests |
| Rendering, HUD, minimap, screen effects | `src/render.js` plus `engine/draw.js`, `engine/minimap.js` | HUD tests, `tests/rendered-test-environment.test.js`, `tests/world-zoom.test.js` |
| Browser platform, input, settings, touch, audio boot | `src/platform.js` | `tests/touch.test.js`, `tests/settings-scale.test.js`, `tests/world-zoom.test.js` |
| Persistent meta/progression | `src/meta/save.js`, `src/meta/upgrades.js`, `src/meta/modules.js` | `tests/save.test.js`, `tests/modules.test.js`, `tests/cores.test.js` |
| Static narrative/data | `src/data/*.js`, `src/meta/intro.js`, `src/meta/logs.js`, `src/meta/whispers.js` | Narrative guardrail and data tests |

## Adding files safely

1. Add `// @ts-check` at the top of new `.js` files.
2. Use the UMD-lite wrapper for new browser/Node-testable modules; see
   `CONTRIBUTING.md`.
3. Add the script tag to `index.html` after its producers and before its
   consumers.
4. Add browser-loaded files to `scripts/manifest.js` and `sw.js` `ASSETS`.
   `tests/manifest.test.js` fails if `index.html`, the manifest, and `sw.js`
   drift. Do not add or bump a service-worker version number; `sw.js` uses a
   stable cache name and network-first refresh for app assets.
5. Add or update focused tests.
6. Run `npm run check`.

## TypeScript and reorganization guidance

Do not start with a broad TypeScript conversion or class-per-file rewrite. The
current human-safe path is incremental extraction under the existing script-tag
architecture:

- keep JSDoc + `// @ts-check`;
- extract pure helpers first;
- preserve `NEON.*` surfaces and `index.html` load order;
- leave `src/game.js` as the coordinator until smaller seams are stable.

See `docs/refactor-roadmap.md` for the recommended order.

## Branch and release workflow

- `main` is stable and deployed by GitHub Pages.
- `develop` is the integration branch.
- Feature branches use `anvil/<task-id>`, `feat/<name>`, `fix/<name>`, or
  `docs/<name>` and open PRs into `develop`.
- PRs into `develop` are squash-merged so integration history stays readable.
- Only same-repo promotion PRs from `develop` target `main`; never target
  `main` from feature/fix branches.
- Promotion from `develop` to `main` uses rebase merge. Do not break the
  release and versioning PR path or `.github/workflows/release-version.yml`.
- Use conventional commit prefixes (`feat:`, `fix:`, `docs:`, `refactor:`,
  `test:`, `chore:`).

GitHub Actions runs `npm run check` for PRs and pushes to `main`/`develop`.
GitHub Pages deploys from `main`.
