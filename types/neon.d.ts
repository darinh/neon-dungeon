// Ambient declarations for NEON DUNGEON's UMD globals.
//
// This file is loaded automatically by tsc (see tsconfig.json `include`).
// During Phase 3 the goal is to TURN ON `// @ts-check` per-file, not to perfect
// every type — many properties are intentionally loose (`any`) so that leaf
// modules can opt in without forcing a cascade of typing the whole codebase.
// Phase 4 will tighten the engine-boundary types.

export {};

declare global {
  // Browser-side: every src/*.js file mounts its public surface on window.NEON.
  // The shape is the union of every UMD attachment in src/ — keeping it as
  // `Record<string, any>` lets new modules join without editing this file.
  interface Window {
    NEON: Record<string, any>;
    BIOME_PALETTES?: Record<string, unknown>;
    AREAS?: unknown[];
    LOGS?: unknown[];
  }

  // Node-side: tests load these modules via require(). The factory's `root`
  // arg evaluates to `self` in the browser and `this` (which is `{}` under
  // strict mode) in Node — the (root.NEON = root.NEON || {}) pattern works
  // in both, but TS needs a global escape hatch for the Node path.
  // Typed as `any` (rather than the stricter `Record<string,any> | undefined`)
  // so @ts-check files can write `NEON.save.loadMeta()` inside try/catch
  // blocks without forcing a narrowing pyramid at every call site.
  // eslint-disable-next-line no-var
  var NEON: any;

  // The shared `game` object is declared as `const game = {...}` in
  // src/game.js and accessed from many other src/*.js modules via the UMD
  // script-tag pattern. Until Phase 4 introduces a typed Game contract,
  // checked files treat it as `any` to avoid a cascading cross-file rewrite.

  // Cross-file lexical globals declared in src/platform.js / src/game.js as
  // top-level `const`/`let` bindings. They are visible to other scripts via
  // the shared Script Realm (NOT via `globalThis` — `const`/`let` aren't
  // global-object properties). Most are visible to tsc directly because their
  // declaring files are themselves @ts-checked (see src/platform.js's
  // `const audio`, `let W,H`, etc — declared there, no need to redeclare
  // here). Only `game` needs an ambient declaration since src/game.js does
  // not yet opt into // @ts-check.
  // eslint-disable-next-line no-var
  var game: any;
  function jp(code: string | null | undefined): boolean;
  function km(action: string): string | null | undefined;
  function isTouchDevice(): boolean;
}
