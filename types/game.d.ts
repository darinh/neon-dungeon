// types/game.d.ts — NEON DUNGEON game-specific surface.
//
// Phase 4 deliverable. See docs/engine-boundary.md for the philosophy
// behind what counts as "game" vs "engine".
//
// This file declares the `GameSurface` global type — the typed contract for
// the NEON DUNGEON-specific subset of `window.NEON`. It is documentation
// expressed as types: a single place to see what would NOT lift out into
// a generic engine package.
//
// IMPORTANT — opt-in by design:
//
//   Like types/engine.d.ts, this file does NOT narrow the ambient
//   `Window.NEON` declaration in types/neon.d.ts. The Phase 3 reviewer
//   consensus was: keep `Record<string, any>` loose; tighten only at the
//   call sites where the precision pays off.
//
// Signature accuracy:
//
//   Parameter ORDER and ARITY below are verified against actual exports in
//   src/meta/*.js as of Phase 4. Per-parameter types and return types stay
//   `any` where the runtime contract is loose (game/player state objects,
//   meta blobs). Tightening individual signatures is a follow-up — do it
//   when a real bug or refactor demands the precision.
//
//   When you change a runtime signature, update the matching declaration
//   here in the same commit.
//
// Consumers can opt in:
//
//       /** @type {GameSurface['save']} */
//       const save = window.NEON.save;

export {};

declare global {
  // ─── Run-time player behavior hooks (UNCHAINED #36) ───────────────────────

  /** Pure runtime helpers for upgrade-node flags (src/meta/behavior.js). */
  interface GameBehaviorAPI {
    computeOutgoingDmgMul(player: any): number;
    consumeSurgeShot(player: any): number;
    onKillRefreshMomentum(player: any): void;
    resetOutOfCombat(player: any): void;
    tickMomentum(player: any, dt: number): void;
    tickOutOfCombatRegen(player: any, dt: number): void;
    tryMetaSecondWind(player: any): boolean;
  }

  // ─── In-run vendor boosts (UNCHAINED #38) ─────────────────────────────────

  /** Floor-scoped temporary boosts (src/meta/boosts.js). */
  interface GameBoostsAPI {
    BOOSTS: Record<string, any>;
    BOOST_KEYS: readonly string[];
    applyBoost(player: any, id: string): any;
    clearFloorBoosts(player: any): void;
    hasBoost(player: any, id: string): boolean;
    getBoostDamageMul(player: any): number;
    getBoostSpeedMul(player: any): number;
    getBoostCritBonus(player: any): number;
    consumeShieldCharge(player: any): boolean;
    getActiveBoostList(player: any): any[];
    /** Filters the standard upgrade pool down to the boost-eligible subset. */
    filterVendorPool(upgrades: any[]): any[];
  }

  // ─── CORES currency world-entities (UNCHAINED #39) ────────────────────────

  /** Post-run currency drops (src/meta/cores.js). */
  interface GameCoresAPI {
    /** Returns the spawned drop, or null if invalid input. */
    spawnCoreDrop(game: any, x: number, y: number, value?: number): any;
    /** Returns the cores collected by the player on this tick (≥0). */
    updateCoreDrops(game: any, dt: number, deps?: any): number;
    drawCoreDrops(
      ctx: CanvasRenderingContext2D,
      drops: any[],
      camera: any,
      tileSize?: number,
    ): void;
    clearCoreDrops(game: any): void;
    forceCollectAll(game: any, deps?: any): number;
    tickHudPulse(game: any, dt: number): void;
  }

  // ─── THE GAP hub (UNCHAINED #35) ──────────────────────────────────────────

  /** Liminal hub between floors (src/meta/hub.js). */
  interface GameHubAPI {
    enterHub(game: any): void;
    updateHub(game: any, dt: number): void;
    drawHub(ctx: CanvasRenderingContext2D, game: any): void;
    hitTestHub(game: any, cx: number, cy: number): any;
  }

  // ─── Intro crawl (UNCHAINED #42) ──────────────────────────────────────────

  /**
   * 5-slide intro on first-ever run start (src/meta/intro.js). The
   * controller protocol it returns is engine-shaped (see
   * `EngineCinematicController`); the slides themselves are game content.
   */
  interface GameIntroAPI {
    /** Returns a controller driving the NEON DUNGEON intro. */
    createIntroController(game: any): EngineCinematicController;
    /** Slide data table. */
    SLIDES: readonly any[];
  }

  // ─── ARCHIVE predecessor logs (UNCHAINED #41) ─────────────────────────────

  /** Pure data: AXIOM-1..6 predecessor log entries (src/data/logs.js). */
  interface GameLogDataAPI {
    LOGS: readonly any[];
  }

  /** ARCHIVE terminal runtime + read-tracking (src/meta/logs.js). */
  interface GameLogsAPI {
    pickLogForFloor(floor: number, rand?: () => number): any;
    findLog(id: string): any;
    /** Returns the log object that was marked read, or null/undefined. */
    readLog(id: string): any;
    /** `{ read: number, total: number }`. */
    progress(): { read: number; total: number };
    /** Array of `{ axiom, logs[] }` groups. */
    groupedByAxiom(): Array<{ axiom: number; logs: any[] }>;
  }

  // ─── UPGRADE MODULES (UNCHAINED #37) ──────────────────────────────────────

  /** Persistent equippable modules (src/meta/modules.js). */
  interface GameModulesAPI {
    getModule(id: string): any;
    rollModuleDrop(opts?: any): any;
    /** Returns true if the pickup was newly added to the run. */
    addRunPickup(game: any, id: string): boolean;
    /** Returns the count of modules committed to permanent inventory. */
    commitRunModules(game: any): number;
    clearRunModules(game: any): void;
    defaultPanelState(): any;
    drawModuleSlotsPanel(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      game: any,
      state: any,
    ): void;
    /** `'exit'` closes the panel; `'handled'` consumed input; `'ignored'` did nothing. */
    handleModuleSlotsKey(game: any, state: any, key: string): 'exit' | 'handled' | 'ignored';
  }

  // ─── Persistent meta state + wallet (UNCHAINED #1, #36, #37, #39) ─────────

  /**
   * Save schema, wallet math, module install/sell, meta upgrades
   * (src/meta/save.js). Internal `META_VERSION` is currently 2; the
   * legacy `SAVE_VERSION` constant lives in src/platform.js.
   */
  interface GameSaveAPI {
    META_UPGRADES: Record<string, any>;
    DIFF_UNLOCK_REQS: Record<string, any>;
    loadMeta(validDifficulties?: any): any;
    saveMeta(meta: any): void;
    /** `(id, validDifficulties?)` — current level of meta upgrade `id`. */
    getMetaLevel(id: string, validDifficulties?: any): number;
    isDiffUnlocked(diffId: string, validDifficulties?: any): boolean;
    /** Run-end shard payout. */
    calcRunShards(
      floor: number,
      score: number,
      bossesCleared: number,
      victory: boolean,
      shardMul?: number,
    ): number;
    applyMetaToPlayer(player: any, buildWeaponFn?: any, randomFn?: () => number): void;
    getMetaXPMultiplier(): number;
    getMetaCreditMultiplier(): number;
    /** Adds `n` cores; returns the new wallet balance. */
    addCores(n: number): number;
    spendCores(n: number): boolean;
    /** Returns true if the log was newly added. */
    addLogFound(id: string): boolean;
    /** Returns true if the log was newly marked read. */
    markLogRead(id: string): boolean;
    /**
     * `(slot, moduleId)` — installs `moduleId` at install index `slot`.
     * Returns the previously-installed id (`string | null`) on success,
     * or `undefined` when input is invalid (bad slot, unowned module).
     */
    installModule(slot: number, moduleId: string | null): string | null | undefined;
    /**
     * `(moduleId, refund)` — removes `moduleId` and credits `refund` cores.
     * Returns the refunded amount (`number`), or `0` on failure.
     */
    sellModule(moduleId: string, refund: number): number;
    resetMeta(): void;
  }

  // ─── UPGRADE MATRIX 12-node tree (UNCHAINED #36) ──────────────────────────

  /** Persistent upgrade-node tree (src/meta/upgrades.js). */
  interface GameUpgradesAPI {
    defaultSelectorState(): { col: number; row: number };
    drawUpgradeMatrix(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      game: any,
      selectorState: any,
    ): void;
    handleUpgradeInput(key: string, game: any, selectorState: any): boolean;
  }

  // ─── Aggregate ────────────────────────────────────────────────────────────

  /**
   * The NEON DUNGEON-specific subset of `window.NEON`. New game modules add
   * their surface here. See docs/engine-boundary.md for classification.
   *
   * `window.NEON` is **not** narrowed to this — see the file header for why.
   */
  interface GameSurface {
    behavior: GameBehaviorAPI;
    boosts: GameBoostsAPI;
    cores: GameCoresAPI;
    hub: GameHubAPI;
    intro: GameIntroAPI;
    logData: GameLogDataAPI;
    logs: GameLogsAPI;
    modules: GameModulesAPI;
    save: GameSaveAPI;
    upgrades: GameUpgradesAPI;
  }
}
