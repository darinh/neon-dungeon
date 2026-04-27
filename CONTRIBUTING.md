# Contributing to NEON DUNGEON

## Module pattern — "UMD-lite"

New code lives in `src/meta/` or `src/data/`. Every file uses this IIFE wrapper so
it works in both the browser (via `<script>` tag, attaching to `window.NEON`) and
Node (`require()` for unit tests):

```js
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
1. No runtime dependencies. Zero `require()`/`import` at the top level of a new
   module. If you need data from another module, depend on it via the `NEON`
   namespace at call time — never at load time.
2. Browser load order: script tags in `index.html` must list producer files
   before consumer files. If `src/meta/hub.js` uses `NEON.upgrades`, the
   `<script src="./src/meta/upgrades.js">` tag must appear first.
3. Pure logic is preferred. Anything that reads globals or touches the DOM
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

CI (`.github/workflows/test.yml`) runs `npm test` on every PR targeting `main` or
`develop`. A failing test blocks merge.

## Branching

- `main` — stable, deployed to GitHub Pages. Never push directly; only merge from `develop`.
- `develop` — integration branch. All feature branches PR into `develop`.
- `anvil/<task-id>` or `feat/<thing>` — your working branch.

## Service Worker cache

`sw.js` precaches the file list. **The `CACHE` version constant is auto-bumped
by CI** on push to `develop` (see `.github/workflows/cache-bump.yml`) — derived
from the conventional-commit prefix of the merged commit:

| Prefix / marker | Bump |
|---|---|
| `BREAKING CHANGE` / `!:` | +10 |
| `feat:` | +2 |
| anything else | +1 |

You do **not** bump the `CACHE` constant in your PR. Doing so creates artificial
merge conflicts on every parallel PR.

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
