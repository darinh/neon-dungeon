# Contributing to NEON DUNGEON

## Human orientation

Start with:

- `README.md` — quick start, commands, architecture overview, release workflow.
- `docs/module-map.md` — file ownership, load order, risk areas, guardrail tests.
- `docs/refactor-roadmap.md` — safe reorganization path and why not to start with
  a broad TypeScript/class-per-file rewrite.
- `docs/engine-boundary.md` — engine vs NEON-specific game boundary.

## Module pattern — "UMD-lite"

New browser/Node-testable modules generally live in `engine/`, `src/meta/`, or
`src/data/`. Use this IIFE wrapper when a file must work in both the browser
(via `<script>` tag, attaching to `window.NEON`) and Node (`require()` for unit
tests):

```js
// @ts-check
// src/meta/example.js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.NEON = root.NEON || {}).example = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function doThing(x) { return x + 1; }

  return { doThing };
}));
```

**Rules:**
1. Add `// @ts-check` to every new `.js` file.
2. No npm runtime package dependencies and no top-level `require()`/`import` in
   browser modules. Production `index.html` does load PostHog's hosted analytics
   script; do not add additional hosted runtime dependencies without updating
   `README.md` and `privacy.html`. If you need data from another module, depend
   on it via the `NEON` namespace at call time — never at load time.
3. Browser load order: script tags in `index.html` must list producer files
   before consumer files. If `src/meta/hub.js` uses `NEON.upgrades`, the
   `<script src="./src/meta/upgrades.js">` tag must appear first.
4. Browser assets: add new browser-loaded files to `sw.js` `ASSETS`, but do not
   manually bump the service-worker `CACHE` key in feature PRs.
5. Pure logic is preferred. Anything that reads globals or touches the DOM
   cannot be unit-tested in Node — keep those pieces thin and push
   computation into pure functions.

## Tests

Tests live in `tests/`. Run them locally with:

```bash
npm test
```

We use the built-in `node:test` runner (no framework, no deps). Each extracted
module gets a sibling test file:

```js
// tests/example.test.js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const example = require(path.resolve(__dirname, '..', 'src', 'meta', 'example.js'));

test('doThing increments', () => {
  assert.equal(example.doThing(1), 2);
});
```

CI (`.github/workflows/test.yml`) runs `npm run check` on every PR targeting
`main` or `develop`. A failing check blocks merge.

## Branching

- `main` — stable, deployed to GitHub Pages. Never push directly.
- `develop` — integration branch. All feature branches PR into `develop`.
- `anvil/<task-id>`, `feat/<thing>`, `fix/<thing>`, or `docs/<thing>` — your
  working branch.
- `release/<thing>` — linear promotion branch from `main` when promoting
  verified `develop` work to production.

## Service Worker cache

`sw.js` precaches the file list with a stable cache name. Do not add or bump a
numeric service-worker cache version; the only user-facing release version is
the latest GitHub Release tag, which is created automatically on `main` by
`.github/workflows/release-version.yml` and written into the Pages artifact as
same-origin `version.json`.

There is no cache version to bump. Code freshness is handled by network-first
fetches for navigations and explicit app assets; offline support comes from the
stable precache.

You **do** still need to:

1. Add any new source file path to the `ASSETS` precache list in `sw.js`.
2. Remove any deleted paths from `ASSETS`.

If a real `ASSETS` change conflicts with another PR (because both added paths
in the same region of the array), resolve it normally — that's a real conflict.

## Conventional commits

Subject line prefixes:
- `feat:` new user-visible feature
- `fix:` bug fix
- `refactor:` no behavior change (extractions, renames)
- `test:` test-only change
- `docs:` docs/comment-only change
- `chore:` build, CI, tooling

Include the `Co-authored-by: Copilot` trailer when an agent helped.

## Spec

`docs/spec.md` is the living specification. When you add or change user-visible
behavior, update the spec in the same PR. Spec describes what IS, never what
SHOULD BE.
