# NEON DUNGEON — Agent Instructions

This file documents conventions for any agent working on NEON DUNGEON. Read this
first, then read `README.md`, `docs/module-map.md`, and
`docs/refactor-roadmap.md` for human-handoff context.

## Branch model

- `main` — stable production branch deployed by GitHub Pages. Do not push
  directly. Do not open feature, fix, chore, docs, hotfix, or release branches
  directly into `main`.
- `develop` — the only integration branch for feature/fix/chore/docs work.
- `anvil/xxx`, `feat/xxx`, `fix/xxx`, `docs/xxx`, `chore/xxx` — short-lived
  work branches based on `develop` and targeting `develop`.

## Worktree-only operating rule

- All coding, review, test, commit, push, and PR work MUST happen in a git
  worktree. Do not edit or review from the main checkout at
  `/home/darin/projects/neon-dungeon`.
- The main checkout is only for reading instructions, checking status, fetching
  remote refs, and creating/listing/removing worktrees. Do not `pull`, switch
  branches, merge, commit, restore, reset, clean, stash, or otherwise mutate the
  main checkout.
- Before relying on main-checkout instructions or npm scripts, fetch remote refs
  and compare the main checkout to `origin/develop`. If it is behind or lacks a
  referenced script, treat it as diagnostic-only and use the active implementation
  worktree's `AGENTS.md`, `docs/agent-retrospective.md`, and npm scripts as the
  operative source for the task.
- Never run `git stash` or other state-hiding commands in the main checkout. If
  work must be moved, use `git diff --binary` plus explicit copies of untracked
  files after verifying the destination worktree exists.
- Before launching code-review subagents, stage the diff in the worktree and
  instruct reviewers to inspect `git diff --staged` only. Reviewers must not run
  mutating git commands such as `git stash`, `git checkout`, or `git restore`.
- Extension and trigger scaffolding is not exempt from the worktree rule. After
  any `extensions_manage scaffold` call, verify the actual file path is under the
  implementation worktree, remove any accidental primary-checkout copy, and if
  `.github/extensions/**` is ignored, force-add the intended project extension
  deliberately.

## Retrospectives

- Run the checklist in `docs/agent-retrospective.md` once per milestone: each
  `develop` -> `main` promotion, or the end of a planned program phase. Do not
  run one per PR.
- Milestone retrospectives get critique from two reviewers on different model
  families. They work from pasted evidence only and never enter the repository,
  run git, or write files. Record adopted and rejected findings, and attach the
  retrospective to the promotion PR, or to the phase's final PR when the phase
  ends without a promotion.
- A retrospective ends by asking whether the checklist should change. If it
  should, edit it in the same milestone.
- Keep working while actionable backlog remains. For issue-backed work, run
  `npm run check:agent-continuity -- --issue <number>` before stopping; a nonzero
  exit means work remains. The same command checks that the operator guard
  extension is tracked and that the `develop` ruleset keeps the admin bypass
  needed for post-release alignment.
- Remove a worktree after its PR merges.

## Merge policy

These are hard rules, not preferences:

- All work lands in `develop` first. No direct work PRs to `main`.
- PRs into `develop` MUST use **Squash and merge**. The resulting `develop`
  commit is the canonical integration commit for that work.
- Production promotion is ONLY a PR from this repository's `develop` branch to
  `main`. That PR MUST use **Rebase and merge**.
- Do not squash `develop` into `main`. Do not create a merge commit from
  `develop` into `main`.
- Do not cherry-pick or hotfix directly to `main`. Urgent production fixes still
  land in `develop` first, then `develop` is promoted to `main`.
- If `main` and `develop` diverge, stop and reconcile the branch history
  deliberately. Do not paper over the divergence with direct `main` PRs.
- `release-version.yml` runs after pushes to `main`; it is not a pull-request
  exception. Do not disable or bypass release/versioning automation when
  enforcing this branch policy.
- The checked-in PR branch-policy workflow enforces the source branch for PRs to
  `main`. It cannot enforce which GitHub merge button a human clicks, so agents
  must explicitly verify and use the required merge method before merging.
- Merge PRs with the guarded wrapper, not raw `gh pr merge`:
  `npm run merge:pr -- <pr> --method squash|rebase`. The wrapper parses PR
  state, hard-stops unless `state` is `OPEN`, enforces squash for `develop` and
  rebase for `main`, refuses `--delete-branch`, checks statuses, and verifies the
  remote merge result. Existing `develop` -> `main` promotion PRs may be used
  only after verifying they are open, target `main`, come from this repository's
  `develop`, and include the commits intended for promotion.
- For issue-backed work, verify before the promotion merge that the PR landing on
  the default branch contains the closing keyword for the tracked issue, or record
  the explicit manual-close command/comment that will run immediately after
  promotion. A `develop`-only PR closing keyword is not enough to prove default
  branch issue closure.
- If a raw `gh pr merge` command exits nonzero after printing a successful
  remote merge, treat the result as ambiguous until
  `gh pr view --json state,mergedAt,mergeCommit` proves whether the PR merged.
  Do not retry, repair, or clean up based only on the local exit code.
- `gh pr edit` failures caused by GitHub CLI GraphQL field deprecations are
  non-fatal for cosmetic title/body updates. If the edit is materially required,
  use `gh api repos/:owner/:repo/pulls/:number -X PATCH`; otherwise leave the PR
  text unchanged and proceed.
- After a `develop` -> `main` rebase promotion, verify `origin/develop` and
   `origin/main` still have the same tip. If GitHub rewrote the commit SHA during
   the rebase merge, reconcile `develop` back to the released `main` tip with a
   deliberate `--force-with-lease` update from a worktree after verifying the
   trees are patch-equivalent and recording a bounded remote-ref containment
   check for the old `develop` tip. Do not temporarily delete repository rules to
   do this; the `develop` ruleset must retain the admin bypass verified by
   `npm run check:agent-continuity`. Do not leave `main` and `develop` divergent
   after a release.

## Commands

| Command | Purpose |
|---|---|
| `npm ci` | Install exact locked dependencies in a fresh worktree before baseline verification. Use this instead of `npm install` when `node_modules/` is absent. |
| `npm test` | Run the full test suite (Node built-in test runner, 2300+ tests). Must exit 0. |
| `npm run typecheck` | Run `tsc --noEmit` twice. `tsconfig.json` covers `src/`, `engine/`, `tests/` and `types/`, but checks only files that start with `// @ts-check`. `tsconfig.runtime.json` checks every `src/` and `engine/` file, with or without `// @ts-check`, and without Node types. Must exit 0. |
| `npm run lint` | Run `eslint .` over the repository. Currently exits 0 with no errors and no warnings — keep it that way. |
| `npm run lint:fix` | Auto-fix what eslint can. |
| `npm run check` | Run lint + typecheck + engine-purity + tests in sequence. **This is the canonical pre-commit gate.** |

## Shell safety

- For Markdown-heavy `gh pr create`, `gh pr edit`, and `gh pr comment` bodies,
  use `--body-file` with a temporary file or a single-quoted heredoc. Do not put
  backticks inside a double-quoted `--body` argument.
- For Markdown-heavy issue closure comments, use `gh issue comment --body-file`
  first, then `gh issue close --reason completed|not planned`; this installed
  `gh` does not support `gh issue close --comment-file`.

## Type-safety status

**Path A (chosen 2026-04-24)**: JSDoc + `// @ts-check` per file, strict eslint, no bundler, no file extension changes.

**Phase 1 — Tooling baseline**: ✅ COMPLETE. `tsconfig.json`, `eslint.config.js`, npm scripts wired.

**Phase 2 — Eslint cleanup**: ✅ COMPLETE. `npm run lint` exits 0 with zero warnings across `src/` and `tests/`.

**Phase 3 — Per-file `// @ts-check`**: ✅ COMPLETE. Every file under `src/` and `engine/` is type-checked: `tsconfig.runtime.json` turns on `checkJs` there, so a missing or misplaced `// @ts-check` cannot drop a file from the check, and `npm run typecheck` exits 0. `sw.js` and `scripts/` are not type-checked yet. New `.js` files still start with `// @ts-check` — see "Type checking" below.

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

## Operator artifacts

- Operator restart markers belong under `~/.operator/restart`. Operator and
  handoff scripts must never create, read, write, or migrate reboot/restart
  markers under `~/.copilot/restart`.
- When an unexpected operator restart occurs, inspect the operator/handoff
  implementation and marker paths before attributing the restart to task
  completion, user intent, or another inferred cause.

## Conventions

### Type checking
- New code: make `// @ts-check` the first line of every new `.js` file, before `'use strict'`; TypeScript reads it only from the comments before the first token. Runtime files are checked either way; test files are checked only with it. Use JSDoc `@param`/`@returns`/`@typedef` for shapes.
- Test files opt in file by file. When you add `// @ts-check` to one, fix all `tsc --noEmit` errors that file produces (or use `// @ts-expect-error` with a tracking todo).
- Shared shapes: declare in `types/*.d.ts` (see `types/engine.d.ts`, `types/game.d.ts`, `types/neon.d.ts`).
- When moving a prototype method or other typed global surface, inspect and
  update `types/neon.d.ts` (or the relevant `types/*.d.ts`) before the first full
  `npm run check`; source-text tests alone do not prove the type surface moved.
- Do not satisfy typecheck for extracted prototype helpers by adding a matching
  class field. JavaScript class fields create own instance properties and shadow
  later `Class.prototype.helper = function helper(...)` assignments. Use a
  non-emitting JSDoc cast or a declaration pattern that does not create an own
  field, and add a callable-path test when moving prototype behavior.

### Linting
- `// eslint-disable-next-line <rule> -- <reason>` is acceptable when justified, with a comment explaining why.
- Don't disable a rule globally without discussion.

### Why no-undef and no-implicit-globals are off
The codebase uses `<script>` tag UMD loading. Every `src/*.js` declares top-level globals on purpose. `tsc` catches genuinely-missing references via its cross-file symbol table; eslint's `no-undef` would produce ~7000 false positives. See `eslint.config.js` comments.

### Type lib scoping
`tsconfig.json` sets `lib: ["ES2020","DOM"]` and `types: ["node"]`, so test files (which use `node:test`, `node:assert/strict`, etc.) can be `// @ts-check`ed. `tsconfig.runtime.json` checks `src/` and `engine/` with `types: []`, so `tsc` reports Node globals such as `process`, `Buffer` and `__dirname` in browser code as errors; they would crash in the browser. It does not report `require`, `module` or `exports`, which TypeScript treats as CommonJS syntax in `.js` files. Runtime files use them only inside a `typeof module` guard for Node tests, so reviewers must reject any unguarded use, and any `// @ts-nocheck` header, which would opt a file out of the check.

### Map-mutating topology helpers
Any helper that iterates a map and fills tiles based on caller-supplied
predicates must only count progress when the tile value changes, and must include
a progress-safety test for fill predicates that would otherwise match the filled
tile.

### Hot-path memory
`src/render.js drawWorld` and per-tile decor loops run thousands of times per frame. Any allocation there (object literals, array literals, lambdas) accumulates GC churn. Hoist to module scope. See stored memory `render hot path`.

### Mobile coupling
Touch hit-tests in `src/platform.js:345` duplicate menu layout constants from `src/game.js renderMenu()`. When changing menu font/gap sizes, update BOTH. See stored memory `menu touch coupling`.

### Compact mobile layout tests
When a compact/mobile UI change claims short-viewport safety, add or update
layout tests before review for at least one threshold viewport and one
below-threshold viewport. Derive compact/mobile fixtures from the runtime
predicate, or assert the fixture dimensions match it (for example,
`engine/viewport.js computeLayout(W, H, safeBottom).compact`); tests must fail if
they force `narrow`/`compact` true for dimensions the game cannot actually enter.
Assert visible geometry, hit-test bounds, text budgets, and glyph spacing, not
just source strings, so sub-threshold overlap/offscreen regressions are caught
before review. Optional labels/hints in compact canvas UI must have explicit
fit-or-hide behavior, and tests must cover representative long generated text.
Any new compact/mobile branch threshold must come from a documented layout
invariant and have boundary-band cases around the cutoff.

### Input routing
When adding or modifying how an input event type (`MouseLeft`, touch
coordinates, keyboard keys, joystick/aim state) is handled in any game state,
audit all existing consumers of that event type before coding or requesting
review. This is mandatory for red-risk changes touching `src/platform.js`,
`src/game.js` input dispatch, or state-specific mouse/touch hit-tests; record the
affected update/render/hit-test consumers and add or update a guard test for each
shared path that could regress.

### Code review policy
Scale adversarial code review to risk. Reviewers read the staged diff only.

| Change | Reviewers before push |
|---|---|
| Docs only, or prose comments only | none required |
| Tests only | 1 |
| Any other source change | 3, with split briefs: falsify the claims, find omissions, check logic and performance |

A change is prose comments only when it touches only `.js` files and changes
nothing but comment prose and JSDoc description text: no code, no JSDoc tag
other than documentation-only ones such as `@example` and `@see`, and no
directive comment (`@ts-*`, `eslint*`, `/* global */`, `/* exported */`,
triple-slash), neither its content nor the code it applies to. `.d.ts` changes, JSDoc tag
changes, and directive changes are source changes even though transpiling
erases them. `node tests/_comment-only.js [base-ref]` checks it for every file
changed since the base ref (default `origin/develop`): the comment-stripped
`transpileModule` emit, the code tokens, and which tokens share a line must be
identical, and every directive and JSDoc tag must keep its content and the
code it applies to, read the way TypeScript and ESLint read them.
It lists each file's verdict and exits nonzero if any file fails. It does not
run ESLint or the tests, so lint rules that read comment text and tests that
read source text are left to `npm run check`, and it assumes no code reads its
own source through `Function.prototype.toString`.

For extraction work, finish a self-check before launching reviewers:
each moved public/prototype method needs at least one behavioral side-effect
assertion, not just dispatch or existence coverage. Each new or moved engine public export, shared coordinate table,
or engine-facing constant must have a direct shape/value or behavior assertion,
a matching `types/engine.d.ts` declaration, engine-boundary documentation,
and an explicit note of which semantics remain caller-owned.

## Service worker

`sw.js` must not carry a numeric app/cache version such as `neon-dungeon-vNNN`.
The only user-facing release version is the latest GitHub Release tag, created
by `.github/workflows/release-version.yml` after changes land on `main` and
written into the Pages artifact as same-origin `version.json`. The service worker
uses a stable cache name and network-first fetches for app assets so code
freshness does not depend on a second version number.

If you add a brand-new file under `ASSETS`, add the path to the precache list in
`sw.js`; do not add or bump a service-worker version.

## Tests

- Test files live in `tests/*.test.js`.
- Test runner is Node's built-in (`node --test`). No jest/mocha/vitest.
- New tests follow the existing CommonJS pattern unless the surrounding file uses
  ESM: `const { test } = require('node:test'); const assert = require('node:assert/strict');`.
- Some tests load source via `require()` UMD-style (see `tests/cores.test.js`); preserve that pattern.
- Geometry and input-hitbox tests must assert the complete rectangle: origin X,
  origin Y, width, height, and all four boundary conditions (left, right, top,
  bottom). Partial coverage of a rectangle is a review finding.
- Behavior-preserving refactors that replace inline traversal or mutation with a
  shared helper must include direct behavioral evidence that exercises the caller
  mutation path. Source-shape assertions, digest stability, or callback identity
  are supporting evidence only; they are not sufficient by themselves.
- Tests assert behavior. Do not add assertions on the text of source files or
  documentation. Existing source-text assertions are legacy; convert one to a
  behavior test, or delete it if it only restates a constant, when you touch it.
- `tests/_game-sim.test.js` is the golden oracle. `tests/_game-sim.js` boots the
  real scripts in index.html order inside a Node vm context with a scripted
  clock, seeded randomness, browser autoplay rules, and keyboard, mouse and
  touch input. It then plays journeys: menus, settings and an offline boot; a
  run with a dash, combo kills, pause, save on page hide, resume, a stalled
  frame and death; a cheat-assisted crawl through all fifteen floors, with two
  bosses fought in phase two (and the HIVE in phase three) without
  invulnerability, and the finale; three seeds; and touch play in portrait and
  landscape.
- Each checkpoint records what reached the canvas (every fill, stroke, text and
  image with the transform, style, and other canvas state it used), audio calls,
  media volume and filled audio buffers, network calls, stored data, and
  console output at every level.
  All of it must match `tests/golden/journeys.json`. The order of state writes
  does not matter; what is drawn does.
- A behavior-preserving change must pass the oracle without re-recording. When
  a journey fails, `node tests/_game-sim.js diff <journey>` prints the first
  entry that differs from `origin/develop`. Re-record with
  `node tests/_game-sim.js update <journey>` only for an intended behavior
  change, and say why in the PR.
- The oracle protects only code its journeys run. It does not reach the shop,
  choice screens, trial mechanics, hub panels, or combat past floor 1, and it
  checks no real pixels, fonts, or browser layout. Prove changes there with
  their own tests or the verification skill.
- `node tests/_journey-coverage.js diff [ref]` lists the changed runtime code
  lines (against `origin/develop` by default) that no journey executes, and
  exits 1 if there are any; the oracle cannot vouch for those lines.
  `node tests/_journey-coverage.js` prints coverage per file, and
  `uncovered <file>` shows the gaps in one file.

## Documentation

- `docs/spec.md` describes current mechanics. Keep a section accurate when you
  change the behavior it describes. The spec has no version number and no
  changelog; history lives in git and in the GitHub Release notes that
  `release-version.yml` writes from commit subjects.
