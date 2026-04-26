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
| `npm test` | Run the full test suite (Node built-in test runner, 427+ tests). Must exit 0. |
| `npm run typecheck` | Run `tsc --noEmit` over `src/` + `tests/` + `types/`. Only files with `// @ts-check` are checked. As of 2026-04-26 every `src/**/*.js` has `// @ts-check`, so the typecheck covers the whole runtime tree. Must exit 0. |
| `npm run lint` | Run eslint over `src/` + `tests/`. Currently exits 0 with no errors and no warnings — keep it that way. |
| `npm run lint:fix` | Auto-fix what eslint can. |
| `npm run check` | Run lint + typecheck + tests in sequence. **This is the canonical pre-commit gate.** |

## Type-safety status

**Path A (chosen 2026-04-24)**: JSDoc + `// @ts-check` per file, strict eslint, no bundler, no file extension changes.

**Phase 1 — Tooling baseline**: ✅ COMPLETE. `tsconfig.json`, `eslint.config.js`, npm scripts wired.

**Phase 2 — Eslint cleanup**: ✅ COMPLETE. `npm run lint` exits 0 with zero warnings across `src/` and `tests/`.

**Phase 3 — Per-file `// @ts-check`**: ✅ COMPLETE. Every `src/**/*.js` (including `src/game.js`, `src/entities.js`, `src/content.js`, `src/render.js`, `src/platform.js`, all of `src/data/*` and `src/meta/*`) has `// @ts-check` at the top, and `npm run typecheck` exits 0. New `.js` files MUST keep this convention — see "Type checking" below.

**Phase 4 — Engine boundary**: ✅ COMPLETE for the type surface. `types/engine.d.ts`, `types/game.d.ts`, `types/neon.d.ts`, and `docs/engine-boundary.md` exist and are referenced by the typecheck. The deferred `p4-engine-extraction` design work (extracting the engine into its own package) is still open and tracked outside this file.

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

`sw.js` cache key (`neon-dungeon-vNNN`) MUST be bumped on any commit that changes a file listed in `ASSETS`. Otherwise users get stale code. v2 currently still serves at `v134` — bump when v2 first goes to production.

## Tests

- Test files live in `tests/*.test.js`.
- Test runner is Node's built-in (`node --test`). No jest/mocha/vitest.
- New tests follow the existing pattern: `import { test } from 'node:test'; import assert from 'node:assert/strict';`.
- Some tests load source via `require()` UMD-style (see `tests/cores.test.js`); preserve that pattern.
