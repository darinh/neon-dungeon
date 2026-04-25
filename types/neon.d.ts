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
  // eslint-disable-next-line no-var
  var NEON: Record<string, any> | undefined;

  // The shared `game` object is declared as `const game = {...}` in
  // src/game.js and accessed from many other src/*.js modules via the UMD
  // script-tag pattern. Until Phase 4 introduces a typed Game contract,
  // checked files treat it as `any` to avoid a cascading cross-file rewrite.
  // Files that currently @ts-check use `_G` (a local `any` alias of the
  // global) to access fields without TS2339s.
}
