// types/engine.d.ts — Engine-reusable surface for NEON DUNGEON.
//
// Phase 4 deliverable. See docs/engine-boundary.md for the philosophy
// behind what counts as "engine" vs "game".
//
// This file declares the `EngineSurface` global type — the typed contract
// for the engine-reusable subset of `window.NEON`. It is documentation
// expressed as types: a single place to see what an engine extraction
// would lift out.
//
// IMPORTANT — opt-in by design:
//
//   The ambient `Window.NEON` declaration in types/neon.d.ts stays loose
//   (`Record<string, any>`). This file does NOT replace it — narrowing the
//   global would force every existing `// @ts-check`'d call site to satisfy
//   a tighter shape, which the Phase 3D reviewer consensus rejected as
//   over-engineering for unclear benefit.
//
//   Consumers who want stricter typing on a specific call site can opt in:
//
//       /** @type {EngineSurface['alarmLight']} */
//       const alarm = window.NEON.alarmLight;
//
// Signature accuracy — IMPORTANT:
//
//   The signatures below are verified against the actual exports in
//   src/meta/*.js as of Phase 4. Where a parameter is intentionally `any`,
//   that reflects the runtime contract (the function genuinely accepts a
//   loose game/state object). Where order matters, it matches source.
//   When you change a runtime signature, update the matching declaration
//   here in the same commit, or a future @ts-check'd consumer will be
//   misled.

export {};

declare global {
  // ─── Pure helper modules ──────────────────────────────────────────────────

  /**
   * Atmospheric alarm-light decor math (src/meta/alarm-light.js).
   *
   * NOTE: this module currently hardcodes the NEON DUNGEON biome ids
   * (`'cache'`, `'firewall'`) in `shouldDraw` — it's classified as
   * **Mixed** in docs/engine-boundary.md. The math (`isAlarmSlot`,
   * `intensity`) is pure-engine; an extraction pass would inject the
   * biome-id allowlist instead of hardcoding it.
   */
  interface EngineAlarmLightAPI {
    /**
     * `(biomeId, h)` — true when biome opts into alarms AND tile hash `h`
     * passes the slot eligibility check.
     */
    shouldDraw(biomeId: string | undefined | null, h: number): boolean;
    /** Stable ~3.2% true rate keyed by tile hash `h`. */
    isAlarmSlot(h: number): boolean;
    /** 0..1 pulse intensity for `(floorTime, h)` — `h` derives the phase offset. */
    intensity(floorTime: number, h: number): number;
  }

  /** Render error boundary (src/meta/render-boundary.js) state object. */
  interface RenderBoundaryState {
    phase: string;
    message: string;
    stack: string;
    count: number;
    firstTs: number;
  }

  /**
   * Render error boundary (src/meta/render-boundary.js).
   *
   * Pure-functional: state is threaded through `(prev, ...) → next` calls,
   * not stored on a singleton. The host owns the state slot.
   */
  interface EngineRenderBoundaryAPI {
    /**
     * Record an error from the render pipeline.
     * `(prev, phase, err) → newState`. Pass `null` on first call.
     */
    trackRenderError(
      prev: RenderBoundaryState | null,
      phase: string,
      err: unknown,
    ): RenderBoundaryState;
    /** Whether to console.log this error (rate-limited internally). */
    shouldLog(state: RenderBoundaryState): boolean;
    /** Draw the user-facing crash overlay using the state object. */
    drawErrorOverlay(
      ctx: CanvasRenderingContext2D,
      W: number,
      H: number,
      state: RenderBoundaryState,
    ): void;
  }

  /**
   * Spawn-position utilities (src/meta/spawn.js).
   *
   * BFS to the nearest passable tile. The `isPassable` callback is invoked
   * with the **tile code at the candidate position** (e.g., `T.FLOOR`),
   * not with `(x, y)` coordinates — caller decides which tile codes are
   * walkable.
   */
  interface EngineSpawnAPI {
    /**
     * `(map, fx, fy, isPassable, opts?)` → `{x, y}` (centred on tile,
     * `+0.5`) or `null` when no passable tile exists within `maxRadius`
     * rings. `map` is `tiles[y][x]`. Default `maxRadius` = 12.
     */
    findNearestPassable(
      map: ReadonlyArray<ReadonlyArray<number>>,
      fx: number,
      fy: number,
      isPassable: (tileCode: number) => boolean,
      opts?: { maxRadius?: number },
    ): { x: number; y: number } | null;
  }

  /**
   * Lightweight telemetry (src/meta/telemetry.js).
   *
   * Offline-safe event batching with localStorage persistence and a
   * pluggable transport. Privacy: no PII, random session ids.
   *
   * Surface is the full module export — only the methods most useful to
   * external consumers are typed precisely; introspection helpers
   * (`sessionId`, `queueLength`, etc.) are present at runtime but omitted
   * here to keep this surface focused.
   */
  interface EngineTelemetryAPI {
    /** Initialise. Reads `transport`, `storage`, and `enabled` from opts. */
    init(opts?: {
      transport?: (batch: unknown[]) => unknown;
      storage?: Storage;
      /** Defaults to true; pass `false` to skip queueing entirely. */
      enabled?: boolean;
    }): void;
    /** Queue an event. Stored in memory; persisted on flush/page-hide. */
    track(event: string, props?: Record<string, unknown>): void;
    /** Force a flush of the in-memory queue. Synchronous. */
    flush(): void;
    /** Tick from the main loop; handles interval-based flush. */
    update(dt: number): void;
  }

  // ─── Mixed contracts (engine-shaped, game-content elsewhere) ──────────────

  /**
   * The `Area` row contract used by `src/data/biomes.js`. The schema is
   * engine-shaped; the row values are NEON DUNGEON-specific game data.
   * Field names match `AREAS[i].*` exactly (kept verbatim per the data
   * file's "do not rename" note — tests, save data, and the archive-log
   * table key off these strings).
   */
  interface EngineArea {
    /** Biome id, e.g. `'sandbox'`, `'cache'`, `'firewall'`. */
    id: string;
    /** Human-readable biome name. */
    name?: string;
    /** Floors that map to this biome, e.g. `[1, 2, 3]`. */
    floors?: number[];
    /** Palette key into `BIOME_PALETTES`. */
    palette?: string;
    /** Boss type ids drawn at the floor that ends this biome. */
    bossPool?: string[];
    /** Default narrative name for this biome's boss(es). */
    displayName?: string;
    /** Per-boss override when a `bossPool` has multiple distinct bosses. */
    bossDisplayNames?: Record<string, string>;
    /** Biome intro card body text. */
    intro?: string;
    /** Free-form extension — engine doesn't restrict additional fields. */
    [key: string]: unknown;
  }

  /**
   * Helpers from `src/data/biomes.js`. Engine-shaped — the table itself
   * is game data, but these helpers don't care about specific rows.
   */
  interface EngineBiomeTableAPI {
    /** The `Area` rows. NEON DUNGEON populates this; engine reads it. */
    AREAS: readonly EngineArea[];
    finalFloor(): number;
    biomeIndex(floor: number): number;
    areaForFloor(floor: number): EngineArea;
    areaForIndex(idx: number): EngineArea;
    isBiomeBossFloor(floor: number): boolean;
  }

  /**
   * Palette row shape used by `src/data/palettes.js`. Field names match
   * the runtime keys exactly (`wallFill` / `wallHi` / `floor` /
   * `floorAccent` / `minimapWall` / `minimapFloor` / `dust` / `ambient`).
   */
  interface EnginePalette {
    wallFill: string;
    wallHi: string;
    floor: string;
    floorAccent: string;
    minimapWall: string;
    minimapFloor: string;
    /** Two ambient dust particle colours. */
    dust: [string, string] | string[];
    /** Optional ambient overlay tint. */
    ambient?: string;
  }

  /**
   * The `createIntroController` controller pattern from `src/meta/intro.js`.
   * Engine-shaped — the slides themselves are game content, but the
   * controller protocol is reusable for any cinematic.
   */
  interface EngineCinematicController {
    update(dt: number): void;
    draw(ctx: CanvasRenderingContext2D, W: number, H: number): void;
    /** Flips true once the cinematic finishes. Host calls a finalizer. */
    readonly done: boolean;
  }

  // ─── Aggregate ────────────────────────────────────────────────────────────

  /**
   * The engine-reusable subset of `window.NEON`. New engine modules add
   * their surface here. See docs/engine-boundary.md for classification.
   *
   * `window.NEON` is **not** narrowed to this — see the file header for why.
   */
  interface EngineSurface {
    alarmLight: EngineAlarmLightAPI;
    renderBoundary: EngineRenderBoundaryAPI;
    spawn: EngineSpawnAPI;
    telemetry: EngineTelemetryAPI;
  }
}
