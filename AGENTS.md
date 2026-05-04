# NEON DUNGEON — Agent Instructions

This file documents conventions for any agent working on NEON DUNGEON. Read this
first, then read `README.md`, `docs/module-map.md`, and
`docs/refactor-roadmap.md` for human-handoff context.

## Branch model

- `main` — stable production branch deployed by GitHub Pages. Do not push directly.
- `develop` — integration branch for feature work.
- `anvil/xxx`, `feat/xxx`, `fix/xxx`, `docs/xxx` — short-lived branches off
  `develop` unless doing a main release promotion.
- `release/xxx` — linear promotion branches based on `main`.

## Commands

| Command | Purpose |
|---|---|
| `npm test` | Run the full test suite (Node built-in test runner, 2300+ tests). Must exit 0. |
| `npm run typecheck` | Run `tsc --noEmit` over `src/` + `engine/` + `tests/` + `types/`. Only files with `// @ts-check` are checked. As of 2026-04-26 every `src/**/*.js` has `// @ts-check`; engine modules are also included by `tsconfig.json`. Must exit 0. |
| `npm run lint` | Run `eslint .` over the repository. Currently exits 0 with no errors and no warnings — keep it that way. |
| `npm run lint:fix` | Auto-fix what eslint can. |
| `npm run check` | Run lint + typecheck + engine-purity + tests in sequence. **This is the canonical pre-commit gate.** |

## Type-safety status

**Path A (chosen 2026-04-24)**: JSDoc + `// @ts-check` per file, strict eslint, no bundler, no file extension changes.

**Phase 1 — Tooling baseline**: ✅ COMPLETE. `tsconfig.json`, `eslint.config.js`, npm scripts wired.

**Phase 2 — Eslint cleanup**: ✅ COMPLETE. `npm run lint` exits 0 with zero warnings across `src/` and `tests/`.

**Phase 3 — Per-file `// @ts-check`**: ✅ COMPLETE. Every `src/**/*.js` (including `src/game.js`, `src/entities.js`, `src/content.js`, `src/render.js`, `src/platform.js`, all of `src/data/*` and `src/meta/*`) has `// @ts-check` at the top, and `npm run typecheck` exits 0. New `.js` files MUST keep this convention — see "Type checking" below.

**Phase 4 — Engine boundary**: ✅ COMPLETE for the type surface. `types/engine.d.ts`, `types/game.d.ts`, and `types/neon.d.ts` exist and are referenced by the typecheck; `docs/engine-boundary.md` is the human architecture reference for the same boundary. The deferred `p4-engine-extraction` design work (extracting the engine into its own package) is still open and tracked outside this file.

## Human handoff posture

- Do not start a broad TypeScript conversion or class-per-file rewrite by default.
  The current safe path is JSDoc `// @ts-check`, UMD-lite modules, explicit
  `index.html` load order, and incremental extraction.
- Keep `README.md`, `docs/module-map.md`, and `docs/refactor-roadmap.md` current
  whenever architecture changes.
- When context is genuinely heavy and a handoff is necessary, include the standing
  autonomous-work instruction in the handoff: work unattended, make decisions,
  do not wait for human feedback, monitor PRs through CI/merge/deploy, and only
  stop when there is no concrete actionable work or the task is blocked on an
  external human decision.

## Conventions

### Type checking
- New code: add `// @ts-check` at top of every new `.js` file. Use JSDoc `@param`/`@returns`/`@typedef` for shapes.
- Existing code: opt in file-by-file. When you add `// @ts-check`, fix all `tsc --noEmit` errors that file produces (or use `// @ts-expect-error` with a tracking todo).
- Shared shapes: declare in `types/*.d.ts` (see `types/engine.d.ts`, `types/game.d.ts`, `types/neon.d.ts`).

### Linting
- `// eslint-disable-next-line <rule> -- <reason>` is acceptable when justified, with a comment explaining why.
- Don't disable a rule globally without discussion.

### Why no-undef and no-implicit-globals are off
The codebase uses `<script>` tag UMD loading. Every `src/*.js` declares top-level globals on purpose. `tsc` catches genuinely-missing references via its cross-file symbol table; eslint's `no-undef` would produce ~7000 false positives. See `eslint.config.js` comments.

### Type lib scoping
`tsconfig.json` sets `lib: ["ES2020","DOM"]` and `types: ["node"]`. The `node` types are added so test files (which use `node:test`, `node:assert/strict`, etc.) can be `// @ts-check`ed. **Do not introduce Node globals (`process`, `Buffer`, `__dirname`, etc.) into `src/` browser code** — even though tsc won't flag them, they will crash in the browser. Code reviewers must catch this.

### Hot-path memory
`src/render.js drawWorld` and per-tile decor loops run thousands of times per frame. Any allocation there (object literals, array literals, lambdas) accumulates GC churn. Hoist to module scope. See stored memory `render hot path`.

### Mobile coupling
Touch hit-tests in `src/platform.js:345` duplicate menu layout constants from `src/game.js renderMenu()`. When changing menu font/gap sizes, update BOTH. See stored memory `menu touch coupling`.

### Code review policy
**Every commit that changes code must have at least 1 adversarial code-review subagent before pushing.** No exceptions for Small tasks. 🔴 files (game.js, entities.js, content.js, platform.js, sw.js, save.js, anything auth/crypto/payments/concurrency) escalate to 3 reviewers.

## Service worker

`sw.js` cache key (`neon-dungeon-vNNN`) is **auto-bumped by CI** on every push to `develop` — see `.github/workflows/cache-bump.yml`. The bump size is derived from the merged commit message:

| Commit prefix / marker | Bump |
|---|---|
| `BREAKING CHANGE` or `!:` | +10 |
| `feat:` / `feat(scope):` | +2 |
| anything else (`fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `perf:`, …) | +1 |

**Do not bump `sw.js` manually in normal feature PRs to `develop`.** Manual bumps create artificial merge conflicts on every parallel PR (the cascade pattern that bit us at v215→v218). The bot pushes the bump back to `develop` with `[skip cache-bump]` in the message to avoid loops. Exception: if a main-targeted hotfix or release changes a precached asset without passing through `develop`, include a deliberate `CACHE` bump in that release PR because the auto-bump workflow does not run on `main`.

You also do **not** need to add `sw.js` cache-version assertions to new tests. The existing floor assertions (`>= vNNN`) in older tests will continue to hold — leave them alone — but new test files should not introduce new ones.

If you add a brand-new file under `ASSETS`, you DO still need to add the path to the precache list in `sw.js` — that's a real code change. The version bump on top will then be handled by CI.

## Tests

- Test files live in `tests/*.test.js`.
- Test runner is Node's built-in (`node --test`). No jest/mocha/vitest.
- New tests follow the existing CommonJS pattern unless the surrounding file uses
  ESM: `const { test } = require('node:test'); const assert = require('node:assert/strict');`.
- Some tests load source via `require()` UMD-style (see `tests/cores.test.js`); preserve that pattern.
