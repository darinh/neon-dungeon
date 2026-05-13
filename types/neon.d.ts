// Ambient declarations for NEON DUNGEON's UMD globals.
//
// This file is loaded automatically by tsc (see tsconfig.json `include`).
// During Phase 3 the goal is to TURN ON `// @ts-check` per-file, not to perfect
// every type — many properties are intentionally loose (`any`) so that leaf
// modules can opt in without forcing a cascade of typing the whole codebase.
//
// Phase 4 (DONE): engine-boundary types live in types/engine.d.ts and
// types/game.d.ts. They declare `EngineSurface` and `GameSurface` as opt-in
// typed contracts; this file's `Window.NEON: Record<string, any>` stays
// loose by design so existing call sites don't churn. See docs/engine-boundary.md.

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
  function requireNEON(name: string, requiringFile: string): any;

  // The shared `game` object is declared as `const game = {...}` in
  // src/game.js (which is @ts-checked) with a `Record<string, any>` JSDoc
  // type. Cross-file consumers see it via the shared Script Realm — no
  // ambient redeclare needed.
  interface Player {
    cycleWeapon(dir?: number): void;
    collectWeapon(w: any): boolean;
    swapWeapon(slotIdx: number, w: any): void;
    equipWeapon(w: any): void;
    tapBombKey(): void;
    xpNeeded(): number;
    gainXP(amount?: any): void;
    effectiveAtk(): number;
    computeOutgoingDmgMul(): number;
    logDamage(source: string, amount: number): void;
    _consumeSurgeShot(): number;
    getPositionAgo(seconds: number): { x: number; y: number } | null;
    getPredictedPosition(seconds: number): {
      x: number;
      y: number;
      vx: number;
      vy: number;
      vmag: number;
    } | null;
  }

  interface Enemy {
    _canTarget(): boolean;
    _cdHitsPlayer(player: any, other: any): boolean;
    _forgetTarget(): void;
    _isLeashedFromRoom(): boolean;
    _findHealTarget(): any;
    _nxFindAllyCluster(): any;
    _nxUpdateLinks(): void;
    _phReposition(map?: any, player?: any): void;
    _seekerDetonate(player?: any, map?: any): void;
    _wrFindEmergeTile(map?: any, player?: any): { x: number; y: number } | null;
    _wlFindWard(): any;
    aiGuard(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiTurret(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiCrawler(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiBrute(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiDrone(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiSplitter(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiShard(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiPhantom(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiShielder(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiReflector(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiDisruptor(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiConduit(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiWraith(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiTunneller(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiWardling(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiVengeance(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiResonator(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiWatcher(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiArchitect(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiMirror(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiReaper(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiGhostProjector(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiHealer(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiGrenadier(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiTeleporter(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiSniper(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiCharger(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiLeaper(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiPulser(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiSummoner(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiMimic(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiNexus(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiSiphon(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiGraviton(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiBossSentinel(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiBossWarden(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiBossHive(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiBossConductor(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiBossOmega(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiBossGenesis(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiMagneton(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiSpectre(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiHarvester(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiNullifier(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiSapper(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiMagpie(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiGulper(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiSeeker(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiEchoer(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiProphet(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiCryophage(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiScorcher(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiTether(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    aiVaultmaster(dt?: any, player?: any, map?: any, d?: any, los?: any): void;
    blocksProjectile(proj?: any): boolean;
    berserkerMul(): number;
    fireAt(px?: any, py?: any, spd?: any, dmg?: any, range?: any, colour?: any): void;
    lobGrenade(tx?: any, ty?: any, map?: any): void;
    moveToward(tx?: any, ty?: any, spd?: any, dt?: any, map?: any, ignoreWalls?: any): void;
    patrol(dt?: any, map?: any): void;
    revealMimic(player?: any): void;
    reflectsProjectile(proj?: any): boolean;
    summonMinion(map?: any): void;
  }

  function jp(code: string | null | undefined): boolean;
  function km(action: string): string | null | undefined;
  function isTouchDevice(): boolean;

  // Math primitives mounted as bare globals by engine/math.js (Phase C1a).
  // engine/math.js's UMD bootstrap attaches each function to `window.NEON.math`
  // AND to `window.<name>` for back-compat with existing call sites in
  // src/platform.js, src/game.js, src/entities.js, src/content.js, src/render.js.
  // Declared here so @ts-check'd files resolve the bare names. See engine/math.js.
  function rand(stream?: string): number;
  function rnd(min: number, max: number, stream?: string): number;
  function rndInt(min: number, max: number, stream?: string): number;
  function randChance(p: number, stream?: string): boolean;
  function randPick<T>(arr: T[], stream?: string): T | undefined;
  function shuffleInPlace<T>(arr: T[], stream?: string): T[];
  function normalizeSeed(input: unknown): string;
  function makeRandomSeed(): string;
  function createRng(seed: unknown, stream?: string, state?: number): {
    seed: string;
    stream: string;
    next(): number;
    rnd(min: number, max: number): number;
    int(min: number, max: number): number;
    state(): number;
    setState(nextState: number): void;
  };
  function setSeed(seed: unknown, states?: Record<string, number> | null): { seed: string; hash: number };
  function clearSeed(): void;
  function getSeed(): string | null;
  function getSeedHash(): number;
  function snapshotRngStates(): Record<string, number>;
  function restoreRngStates(states: Record<string, number>): void;
  function withRngStream<T>(name: string, fn: () => T): T;
  function withDerivedRngStream<T>(name: string, fn: () => T): T;
  function clamp(v: number, lo: number, hi: number): number;
  function dist(ax: number, ay: number, bx: number, by: number): number;
  function dist2(ax: number, ay: number, bx: number, by: number): number;
  function norm(dx: number, dy: number): [number, number];
  function lerp(a: number, b: number, t: number): number;

  // Viewport helpers live under window.NEON.viewport (engine/viewport.js,
  // Phase C1d). NOT mounted as bare globals — src/platform.js wraps them in
  // its existing resize()/updateLayout()/isLandscape() functions and keeps
  // the W/H/scale/offX/offY/safe-area mutable state. NEON is already declared
  // as `var NEON: any` above, so consumers reach the helpers via NEON.viewport
  // with no extra ambient needed.

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
