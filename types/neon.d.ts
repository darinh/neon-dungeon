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
  // src/game.js (which is @ts-checked) with a `Record<string, any>` JSDoc
  // type. Cross-file consumers see it via the shared Script Realm — no
  // ambient redeclare needed.
  function jp(code: string | null | undefined): boolean;
  function km(action: string): string | null | undefined;
  function isTouchDevice(): boolean;

  // BIOME_PALETTES is declared via UMD attachment in src/data/palettes.js and
  // referenced by name in src/render.js. AREAS is similar but currently
  // unused in @ts-checked files. Keep loose until Phase 4 introduces
  // a typed biome contract.
  // eslint-disable-next-line no-var
  var BIOME_PALETTES: any;
  // eslint-disable-next-line no-var
  var AREAS: any;

  // PostHog analytics global, attached by the optional posthog-js snippet in
  // index.html. Wrapped in `typeof posthog !== 'undefined'` guards at every
  // call site (see src/game.js telemetry init); ambient kept as `any` so
  // those guards type-check without forcing PostHog's full SDK type surface.
  // eslint-disable-next-line no-var
  var posthog: any;

  // Entity arrays (enemies, items, vcores, crates, beacons, mines, shieldGens,
  // cameras, lasers, wallTurrets, disruptionFields, hazardZones, gravityWells)
  // are declared as `/** @type {any[]} */ const X = []` in src/entities.js,
  // which is now // @ts-check'd. Other consumers see them via cross-file
  // resolution; no ambient redeclare needed.
  // particles / projectiles are similarly declared in src/content.js.
}
