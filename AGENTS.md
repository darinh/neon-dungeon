# NEON DUNGEON — Agent Instructions (v2 branch)

This file documents conventions for any agent working on the **`v2` branch** of NEON DUNGEON. Read this first.

## Branch model

- `main` — v1 production (v134), do not push directly.
- `develop` — v1 integration branch.
- **`v2` — type-safety + engine-extraction track. All current work happens here.**
- `feat/xxx`, `fix/xxx` — short-lived feature branches off `v2`.

## Commands

| Command | Purpose |
|---|---|
| `npm test` | Run the full test suite (Node built-in test runner, 242+ tests). Must exit 0. |
| `npm run typecheck` | Run `tsc --noEmit` over `src/` + `tests/` + `types/`. Only files with `// @ts-check` are checked. |
| `npm run lint` | Run eslint over `src/` + `tests/`. Errors block; warnings are tolerated during the Phase 2 cleanup but should be reduced over time. |
| `npm run lint:fix` | Auto-fix what eslint can. |
| `npm run check` | Run lint + typecheck + tests in sequence. **This is the canonical pre-commit gate.** |

## Type-safety status

**Path A (chosen 2026-04-24)**: JSDoc + `// @ts-check` per file, strict eslint, no bundler, no file extension changes.

**Phase 1 — Tooling baseline**: COMPLETE on `v2`. `tsconfig.json`, `eslint.config.js`, npm scripts wired.

**Phase 2 — Eslint cleanup**: in progress. Goal: zero warnings on `npm run lint`. Batched per-directory.

**Phase 3 — Per-file `// @ts-check`**: not started. Order:
1. Leaves first: `src/data/*`, `src/meta/{save,logs,cores,alarm-light}.js`
2. Up the dep tree: rest of `src/meta/*` → `src/render.js` → `src/content.js` → `src/entities.js` → `src/platform.js`
3. **`src/game.js` LAST** — 75 NEON.* refs, integration point, treat as 🔴 Large.

**Phase 4 — Engine boundary**: `types/engine.d.ts`, `types/game.d.ts`, `docs/engine-boundary.md`. This is also the entry point for the deferred `p4-engine-extraction` design work.

Full plan: `~/.copilot/session-state/56900f4d-0ac2-4dff-a7dc-4a1c285fc1bd/plan.md` (or its successor in the next session's workspace).

## Conventions

### Type checking
- New code: add `// @ts-check` at top of every new `.js` file. Use JSDoc `@param`/`@returns`/`@typedef` for shapes.
- Existing code: opt in file-by-file. When you add `// @ts-check`, fix all `tsc --noEmit` errors that file produces (or use `// @ts-expect-error` with a tracking todo).
- Shared shapes: declare in `types/*.d.ts` (created in Phase 3).

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

`sw.js` cache key (`neon-dungeon-vNNN`) MUST be bumped on any commit that changes a file listed in `ASSETS`. Otherwise users get stale code. v2 currently still serves at `v134` — bump when v2 first goes to production.

## Tests

- Test files live in `tests/*.test.js`.
- Test runner is Node's built-in (`node --test`). No jest/mocha/vitest.
- New tests follow the existing pattern: `import { test } from 'node:test'; import assert from 'node:assert/strict';`.
- Some tests load source via `require()` UMD-style (see `tests/cores.test.js`); preserve that pattern.
