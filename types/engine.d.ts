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

  // ─── Pure-helper engine modules (relocated to engine/ in Phase A+) ────────

  /**
   * Math primitives (engine/math.js — Phase C1a, PR #88).
   *
   * Browser also exposes each function as a bare global on `window.*` for
   * back-compat with existing UMD callers (e.g. `window.clamp`); see file
   * header.
   */
  interface EngineMathAPI {
    /** Uniform float in `[0, 1)`, optionally from a named seed stream. */
    rand(stream?: string): number;
    /** Uniform float in `[min, max)`. */
    rnd(min: number, max: number, stream?: string): number;
    /** Uniform int in `[min, max]` inclusive. */
    rndInt(min: number, max: number, stream?: string): number;
    /** True with probability `p`. */
    chance(p: number, stream?: string): boolean;
    /** Random array element, or undefined for an empty array. */
    pick<T>(arr: T[], stream?: string): T | undefined;
    /** Fisher-Yates shuffle in-place. */
    shuffleInPlace<T>(arr: T[], stream?: string): T[];
    normalizeSeed(input: unknown): string;
    makeRandomSeed(): string;
    createRng(seed: unknown, stream?: string, state?: number): {
      seed: string;
      stream: string;
      next(): number;
      rnd(min: number, max: number): number;
      int(min: number, max: number): number;
      state(): number;
      setState(nextState: number): void;
    };
    setSeed(seed: unknown, states?: Record<string, number> | null): { seed: string; hash: number };
    clearSeed(): void;
    getSeed(): string | null;
    getSeedHash(): number;
    snapshotStates(): Record<string, number>;
    restoreStates(states: Record<string, number>): void;
    withRngStream<T>(name: string, fn: () => T): T;
    withDerivedRngStream<T>(name: string, fn: () => T): T;
    /** Clamp `v` to `[lo, hi]`. */
    clamp(v: number, lo: number, hi: number): number;
    /** Euclidean distance between `(ax, ay)` and `(bx, by)`. */
    dist(ax: number, ay: number, bx: number, by: number): number;
    /** Squared distance — cheaper when only used for comparisons. */
    dist2(ax: number, ay: number, bx: number, by: number): number;
    /** Unit vector for `(dx, dy)`; returns `[0, 0]` when both are zero. */
    norm(dx: number, dy: number): [number, number];
    /** Linear interpolation; `t` is NOT clamped. */
    lerp(a: number, b: number, t: number): number;
  }

  /**
   * Viewport math (engine/viewport.js — Phase C1d, PR #89). Pure helpers
   * — no DOM mutation. The host owns canvas resize.
   */
  interface EngineViewportAPI {
    /** Compares `win.innerWidth/Height` (and falls back to `scr` if needed). */
    isLandscape(win: any, scr?: any): boolean;
    /** Largest integer scale that keeps `target` inside `(vw, vh)` within `[lo, hi]`. All three trailing args are optional (defaults: `target=600`, `lo=0.7`, `hi=1.5`). */
    computeScale(vw: number, vh: number, target?: number, lo?: number, hi?: number): number;
    /** Logical canvas size given device viewport `(vw, vh)` and scale. */
    computeLogicalSize(vw: number, vh: number, scale: number): { W: number; H: number };
    /** HUD/footer layout for logical size `(W, H)` and `safeBottom` inset. */
    computeLayout(
      W: number,
      H: number,
      safeBottom: number,
    ): { compact: boolean; hudH: number; hudTop: number; msgBase: number };
    /** Reads CSS `env(safe-area-inset-*)` via `getProp` and divides by `scale`. */
    parseSafeAreaInsets(
      getProp: (name: string) => string | number | null | undefined,
      scale: number,
    ): { top: number; right: number; bottom: number; left: number };
  }

  /**
   * Touch helpers (engine/touch.js — Phase C1e, PR #92). Pure helpers,
   * no module state. The host owns the `touch` / `mouse` state objects.
   */
  interface EngineTouchAPI {
    /** Converts client `(clientX, clientY)` to canvas coords using bounding rect. Returns `[x, y]` tuple. */
    toCanvas(clientX: number, clientY: number, canvas: any): [number, number];
    /** Circular hit-test: `(cx, cy)` vs centre `(btn.x, btn.y)` radius `btn.r` (with a 22/scale floor). */
    hitBtn(cx: number, cy: number, btn: { x: number; y: number; r: number }, scale: number): boolean;
    /** Reset the host-owned `touch` and `mouse` state objects in place. */
    resetTouch(touch: any, mouse: any): void;
  }

  /**
   * 2D canvas draw primitives (engine/draw.js — Phase C2a, PR #93).
   * Allocation-free, hot-path safe. Callers set fillStyle/strokeStyle/
   * lineWidth before invoking; helpers only call beginPath/arc/moveTo/
   * lineTo/fill/stroke. `setShadow`/`clearShadow` are the explicit
   * exceptions that mutate shadow state.
   */
  interface EngineDrawAPI {
    /** Filled circle at `(x, y)` radius `r` using current fillStyle. */
    circle(ctx: CanvasRenderingContext2D | any, x: number, y: number, r: number): void;
    /** Stroked circle using current strokeStyle + lineWidth. */
    circleStroke(ctx: CanvasRenderingContext2D | any, x: number, y: number, r: number): void;
    /** Stroked partial arc from angle `a1` to `a2` (radians). */
    arcStroke(ctx: CanvasRenderingContext2D | any, x: number, y: number, r: number, a1: number, a2: number): void;
    /** Stroked line segment from `(x1, y1)` to `(x2, y2)`. */
    line(ctx: CanvasRenderingContext2D | any, x1: number, y1: number, x2: number, y2: number): void;
    /** Filled rounded rect using current fillStyle. */
    roundRect(ctx: CanvasRenderingContext2D | any, x: number, y: number, w: number, h: number, r: number): void;
    /** Stroked rounded rect using current strokeStyle + lineWidth. */
    roundRectStroke(ctx: CanvasRenderingContext2D | any, x: number, y: number, w: number, h: number, r: number): void;
    /** Fill THEN stroke a rounded rect on a single shared path. */
    roundRectFillStroke(ctx: CanvasRenderingContext2D | any, x: number, y: number, w: number, h: number, r: number): void;
    /** Fill THEN stroke a non-rounded rect on a single shared path. For fill-only / stroke-only use native `ctx.fillRect` / `ctx.strokeRect`. */
    rectFillStroke(ctx: CanvasRenderingContext2D | any, x: number, y: number, w: number, h: number): void;
    /** Sets `ctx.shadowColor` + `ctx.shadowBlur`. */
    setShadow(ctx: CanvasRenderingContext2D | any, color: string, blur: number): void;
    /** Resets `ctx.shadowBlur = 0` (cheaper than `setShadow` for the common reset). */
    clearShadow(ctx: CanvasRenderingContext2D | any): void;
  }

  /** Per-tile decor scratch (engine/decor.js — Phase C2b, PR #94). */
  interface EngineDecorScratch {
    h: number;
    roll: number;
    wallSide: any;
    flicker: number;
    alarmEligible: boolean;
    decorEligible: boolean;
  }

  /**
   * Per-tile decor primitives (engine/decor.js — Phase C2b, PR #94).
   * Hot-path safe — host hoists ONE scratch instance to module scope and
   * reuses it across all tile decor draws (per the `decor primitives` and
   * `hot path closure` memories).
   */
  interface EngineDecorAPI {
    /** Knuth-style stable uint32 hash of `(tx, ty, floor)`. */
    tileHash(tx: number, ty: number, floor: number): number;
    /** Frozen `[N, S, W, E]` neighbour offsets — do not mutate. */
    readonly NEIGHBOR_OFFSETS_4: ReadonlyArray<readonly [number, number]>;
    /** Allocates one scratch object. Host hoists this; do not call per-tile. */
    createContextScratch(): EngineDecorScratch;
  }

  // ─── Factory engine modules (createX(opts) → instance) ────────────────────

  /**
   * Input engine instance (engine/input.js — Phase C1b, PR #91). Returned
   * by `createEngine(opts)`. Owns the keyboard listener pair.
   *
   * The `Set<string>` collections are LIVE — observe but don't mutate.
   */
  interface EngineInputInstance {
    /** Currently-held key codes. */
    readonly keys: Set<string>;
    /** Codes that went down between `clearJust()` calls. */
    readonly justPressed: Set<string>;
    /** Codes that went up between `clearJust()` calls. */
    readonly justReleased: Set<string>;
    /** Convenience: `justPressed.has(code)`. */
    jp(code: string): boolean;
    /** Clear the `justPressed` + `justReleased` sets (call once per frame). */
    clearJust(): void;
    /** Attach `keydown` + `keyup` listeners on the configured `win`. Idempotent. */
    attach(): void;
    /** Detach AND clear all key state — prevents phantom held keys on re-attach. */
    detach(): void;
  }

  interface EngineInputAPI {
    createEngine(opts?: {
      /** Defaults to `window`/`self`. */
      win?: any;
      /** Optional pre-default-prevent hook. */
      onKeyDown?: (e: any) => void;
      /** Optional post-handler hook. */
      onKeyUp?: (e: any) => void;
    }): EngineInputInstance;
  }

  /**
   * Web Audio synth engine instance (engine/audio.js — Phase C1c, PR #90).
   * Returned by `createEngine(opts)`. Lazily creates `AudioContext` on first
   * use. Most parameter shapes are loose `any` — Web Audio is dynamically
   * typed and the synth options bag accepts many optional fields.
   */
  interface EngineAudioInstance {
    /** Lazily creates and returns the `AudioContext` (called internally). */
    getCtx(): any;
    /** Resumes the suspended `AudioContext` (best-effort; swallows errors). */
    resume(): void;
    /** True iff the context exists AND `state === 'running'`. */
    isRunning(): boolean;
    setSfxVolume(v: number): void;
    setMusicVolume(v: number): void;
    /** Creates the music bus on first call; returns `{ bus, ctx }`. */
    getMusicBus(): { bus: any; ctx: any };
    /** Cached pink-noise buffer (one allocation per session). */
    getNoiseBuffer(): any;
    /** Insert a transient stereo panner before `target`; auto-disconnects. */
    panOut(target: any, pan: number, lifetime: number): any;
    /** Core voice: oscillator → optional filter → optional pan → target. */
    osc(
      type: OscillatorType,
      freq1: number,
      freq2: number,
      vol: number,
      start: number,
      dur: number,
      target?: any,
      opt?: any,
    ): void;
    /** Noise burst from cached buffer, filtered + enveloped. */
    noise(
      vol: number,
      start: number,
      dur: number,
      filterFreq: number,
      target?: any,
      opt?: any,
    ): void;
    /** Reverb send: returns the split-gain node; auto-disconnects after `lifetime + 2.0s`. */
    wetDry(vol: number, wetAmt: number, lifetime: number): any;
  }

  interface EngineAudioAPI {
    createEngine(opts?: {
      getSfxVolume?: () => number;
      getMusicVolume?: () => number;
      win?: any;
    }): EngineAudioInstance;
  }

  /**
   * One particle slot in the pool (engine/particles.js — Phase C2c, PR #95).
   * Type vocab (`'EXPLOSION'`/`'MUZZLE'`/`'SPARK'`/`'BLOOD'`) is host-defined
   * — engine treats `type` as opaque.
   */
  interface EngineParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    grav: number;
    alive: boolean;
    size: number;
    colour: string;
    type: string;
  }

  /**
   * Pooled particle system instance. `count`/`pooled`/`capacity` are getter
   * properties (read-only views over internal arrays).
   */
  interface EngineParticleSystem {
    /** Pop a slot from the pool, or allocate a new one if under cap. Returns `null` at cap. */
    acquire(): EngineParticle | null;
    /** Release `p` back to the pool (no-op if not currently alive). */
    release(p: EngineParticle): void;
    /** Integrate physics for `dt` seconds; auto-releases dead particles. */
    update(dt: number): void;
    /** Iterate live particles in insertion order. */
    forEach(cb: (p: EngineParticle, i: number) => void): void;
    /** Release all live particles back to the pool. */
    clear(): void;
    /** When `count > burstScaleThreshold`, returns `(n * 0.5) | 0` (min 1); else `n`. */
    scaleBurst(n: number): number;
    /** Live particle count. */
    readonly count: number;
    /** Pooled (recyclable) slot count. */
    readonly pooled: number;
    /** Hard cap on live particles. */
    readonly capacity: number;
  }

  interface EngineParticlesAPI {
    createSystem(opts?: {
      /** Hard cap on live particles. Default 2000. */
      cap?: number;
      /** When live > this, `scaleBurst()` halves requested counts. Default 1500. */
      burstScaleThreshold?: number;
    }): EngineParticleSystem;
  }

  /**
   * Biome router instance (engine/biomes.js — Phase B3, PR #83). Returned
   * by `createBiomeRouter(areas)`. Pure: no module state, indexes the
   * passed-in `areas` table.
   *
   * Distinct from `EngineBiomeTableAPI` which describes the `src/data/biomes.js`
   * data + helpers module (game data shaped via engine schema).
   */
  interface EngineBiomeRouter {
    /** The areas table the router was constructed with. */
    readonly areas: ReadonlyArray<EngineArea>;
    areaForFloor(f: number): EngineArea;
    isBiomeBossFloor(f: number): boolean;
    firstFloorOfBiomeContaining(f: number): number;
    biomeIndex(f: number): number;
    areaForIndex(i: number): EngineArea;
    finalFloor(): number;
  }

  interface EngineBiomesRouterAPI {
    createBiomeRouter(areas: ReadonlyArray<EngineArea>): EngineBiomeRouter;
  }

  /**
   * Cinematic controller factory (engine/cinematic.js — Phase B2). The
   * controller protocol is described by `EngineCinematicController` above.
   * Slide content is host-supplied; the controller only schedules updates
   * and fade alphas.
   */
  interface EngineCinematicAPI {
    createCinematicController(opts: any): EngineCinematicController;
  }

  interface EngineDungeonTopologyAPI {
    /** Shared cardinal traversal order for extracted dungeon topology helpers. */
    CARDINAL_DIRECTIONS: ReadonlyArray<readonly [number, number]>;
    /** Shared diagonal traversal order for extracted dungeon topology helpers. */
    DIAGONAL_DIRECTIONS: ReadonlyArray<readonly [number, number]>;
    /** Counts caller-defined cardinal neighbours around a coordinate. */
    countCardinalNeighbors(
      x: number,
      y: number,
      matchesNeighbor: (x: number, y: number) => boolean,
      isExcluded?: (x: number, y: number) => boolean,
    ): number;
    /**
     * Collects the cardinal-connected component containing `start` for a
     * caller-defined position predicate. Bounds and tile semantics stay in the host.
     */
    findCardinalConnectedPositions(
      startX: number,
      startY: number,
      matchesPosition: (x: number, y: number) => boolean,
    ): Array<{ x: number; y: number }>;
    createMap(width: number, height: number, fillTile: number): Uint8Array[];
    carveRect(
      map: ArrayLike<ArrayLike<number>>,
      x: number,
      y: number,
      w: number,
      h: number,
      tile: number,
    ): void;
    carveCorridor(
      map: ArrayLike<ArrayLike<number>>,
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      tile: number,
    ): void;
    createBspDungeon(opts: {
      width: number;
      height: number;
      depth: number;
      wallTile: number;
      floorTile: number;
      rand: () => number;
      rndInt: (min: number, max: number) => number;
    }): { map: Uint8Array[]; root: unknown; rooms: any[] };
    buildRoomGraph(
      rooms: any[],
      areConnected: (a: any, b: any) => boolean,
    ): Map<any, any[]>;
    bfsRooms(
      rooms: any[],
      startRoom: any,
      areConnected: (a: any, b: any) => boolean,
    ): Map<any, number>;
    roomContainsPoint(
      room: { x: number; y: number; w: number; h: number },
      x: number,
      y: number,
    ): boolean;
    rectOverlapArea(
      rect: { x: number; y: number; w: number; h: number },
      room: { x: number; y: number; w: number; h: number },
      padding?: number,
    ): number;
    rectOverlapsAnyRoom(
      rect: { x: number; y: number; w: number; h: number },
      rooms: Array<{ x: number; y: number; w: number; h: number }>,
      ignoredRoom?: { x: number; y: number; w: number; h: number } | null,
      padding?: number,
    ): boolean;
    findExpandedRoomPlacement(opts: {
      room: { x: number; y: number; w: number; h: number; cx: number; cy: number };
      rooms: Array<{ x: number; y: number; w: number; h: number }>;
      minWidth: number;
      minHeight: number;
      mapWidth: number;
      mapHeight: number;
      margin?: number;
      padding?: number;
    }): { x: number; y: number; w: number; h: number } | null;
    resolvePreferredSpawnRoom(opts: {
      map: ArrayLike<ArrayLike<number>>;
      rooms: Array<{ x: number; y: number; w: number; h: number }>;
      preferred?: { x: number; y: number } | null;
      isPassable: (tile: number) => boolean;
      searchRadius: number;
    }): { pos: { x: number; y: number }; room: any } | null;
    roomHasCorner(
      room: { x: number; y: number; w: number; h: number },
      x: number,
      y: number,
    ): boolean;
    outsideFaceForBoundaryTile(
      room: { x: number; y: number; w: number; h: number },
      x: number,
      y: number,
    ): { x: number; y: number; dx: number; dy: number } | null;
    /**
     * Finds room-interior side-padding coordinates perpendicular to a former
     * boundary entrance. Tile mutation and blocked-tile semantics stay in the host.
     */
    findFormerEntranceSidePaddingTiles(
      room: { x: number; y: number; w: number; h: number },
      x: number,
      y: number,
      dx: number,
      dy: number,
    ): Array<{ x: number; y: number }>;
    /**
     * Finds room boundary sides adjacent to an outside entrance tile, preserving
     * cardinal scan order and skipping corner boundary tiles.
     */
    findOutsideEntranceRoomSides(
      rooms: Array<{ x: number; y: number; w: number; h: number }>,
      x: number,
      y: number,
    ): Array<{ dx: number; dy: number; bx: number; by: number }>;
    /**
     * Finds positions that align a one-sided outside entrance with an existing
     * outside passage. Tile semantics are caller-injected.
     */
    findAlignedOutsidePassageRepair(
      x: number,
      y: number,
      side: { dx: number; dy: number },
      isOutsidePassageTile: (x: number, y: number) => boolean,
      canCarveOutsidePassageTile: (x: number, y: number) => boolean,
    ): { px: number; py: number; cx: number; cy: number } | null;
    /**
     * Visits caller-defined outside entrance tiles in interior y-major map order.
     * Tile semantics, room occupancy, and mutation stay in the host.
     */
    visitOutsideEntranceTiles(
      map: ArrayLike<ArrayLike<number>>,
      isEntranceTile: (tile: number) => boolean,
      isInsideRoomTile: (x: number, y: number) => boolean,
      visit: (x: number, y: number) => void,
    ): number;
    /**
     * Visits diagonal bypass corners around caller-defined anchor tiles. The
     * host performs mutation in `sealCorner`, preserving sequential scan effects.
     */
    visitDiagonalBypassCornerSeals(
      map: ArrayLike<ArrayLike<number>>,
      isAnchorTile: (tile: unknown) => boolean,
      isOpenBypassTile: (tile: unknown) => boolean,
      sealCorner: (x: number, y: number, anchorX: number, anchorY: number) => void,
    ): number;
    /**
     * Caller-injected boundary entrance clustering. `isOpenTile` is tested for
     * both the room boundary tile and its outside-facing neighbour.
     */
    findBoundaryEntranceClusters(
      map: ArrayLike<ArrayLike<number>>,
      room: { x: number; y: number; w: number; h: number },
      isOpenTile: (tile: number) => boolean,
    ): Array<Array<{ x: number; y: number }>>;
    /**
     * Corner-inclusive flat boundary opening scan. `isOpenTile` is tested for
     * both the room boundary tile and its outside-facing neighbour; optional
     * `isPositionExcluded` rejects either position by coordinate.
     */
    findRoomBoundaryOpenings(
      map: ArrayLike<ArrayLike<number>>,
      room: { x: number; y: number; w: number; h: number },
      isOpenTile: (tile: number) => boolean,
      isPositionExcluded?: (x: number, y: number) => boolean,
    ): Array<{ x: number; y: number }>;
    /**
     * Finds caller-defined gate tiles on a room perimeter and returns each gate
     * with its outside-facing coordinate. Corner gates may produce two entries.
     */
    findRoomBoundaryGates(
      map: ArrayLike<ArrayLike<number>>,
      room: { x: number; y: number; w: number; h: number },
      isGateTile: (tile: number) => boolean,
    ): Array<{ x: number; y: number; ox: number; oy: number }>;
    /**
     * Finds outside entrance tiles adjacent to a room boundary and returns the
     * opposite-side outside coordinate used by host repair policy.
     */
    findOutsideEntranceGatesForRoom(
      map: ArrayLike<ArrayLike<number>>,
      room: { x: number; y: number; w: number; h: number },
      isEntranceTile: (tile: number) => boolean,
      isInsideRoomTile: (x: number, y: number) => boolean,
    ): Array<{ x: number; y: number; ox: number; oy: number }>;
    /**
     * Finds outside entrance tiles and adjacent room-boundary sides that need
     * former room-edge padding repairs. Tile mutation stays in the host.
     */
    findOutsideEntranceRoomEdgeRepairs(
      map: ArrayLike<ArrayLike<number>>,
      rooms: Array<{ x: number; y: number; w: number; h: number }>,
      isEntranceTile: (tile: number) => boolean,
      isInsideRoomTile: (x: number, y: number) => boolean,
    ): Array<{
      room: { x: number; y: number; w: number; h: number };
      x: number;
      y: number;
      bx: number;
      by: number;
      dx: number;
      dy: number;
    }>;
    /**
     * Finds the first matching tile in the room rectangle plus optional padded
     * neighbourhood, scanning y-major then x-min to x-max.
     */
    findRoomNeighborhoodTile(
      map: ArrayLike<ArrayLike<number>>,
      room: { x: number; y: number; w: number; h: number },
      isTargetTile: (tile: number) => boolean,
      padding?: number,
    ): { x: number; y: number } | null;
    /**
     * Iteratively fills caller-defined interior dead-end grid tiles. The host
     * owns tile semantics, coordinate exclusions, and the fill tile.
     */
    pruneDeadEndGridTiles(opts: {
      map: ArrayLike<ArrayLike<number>>;
      fillTile: number;
      isPrunableTile: (tile: number, x: number, y: number) => boolean;
      connectsTile: (tile: number, x: number, y: number) => boolean;
      isPositionExcluded?: (x: number, y: number) => boolean;
      maxConnections?: number;
    }): number;
    /**
     * Reports whether a target coordinate can be reached from a start coordinate
     * over caller-defined open map tiles. The host owns tile semantics.
     */
    canReachGridPosition(
      map: ArrayLike<ArrayLike<number>>,
      start: { x: number; y: number },
      target: { x: number; y: number },
      isOpenTile: (tile: number) => boolean,
    ): boolean;
    /**
     * Finds a cardinal BFS path through the interior coordinate grid only,
     * ignoring map tile contents. Returns target-to-start coordinates excluding
     * the start so hosts can apply their own tile mutation policy.
     */
    findInteriorGridBfsPath(
      width: number,
      height: number,
      start: { x: number; y: number },
      target: { x: number; y: number },
    ): Array<{ x: number; y: number }> | null;
    BSPNode: unknown;
  }

  /**
   * Physical key/lock traversal facts for dungeon generation.
   *
   * The engine owns cardinal fixed-point traversal; the host injects tile
   * semantics through `isOpenTile` and `lockColourForTile`. For NEON DUNGEON,
   * `requiredRooms` means every generated room unless game code explicitly
   * marks it optional in the future. The solver reports facts only; map repair,
   * lock downgrades, and regeneration policy stay in the game/content layer.
   */
  interface EngineDungeonReachabilityOptions {
    map: ArrayLike<ArrayLike<number>>;
    start: { x: number; y: number };
    keys?: Array<{ x: number; y: number; colour?: string; color?: string }>;
    /** Rooms that must touch the final physically reachable set. */
    requiredRooms?: any[];
    /** True for host-open tiles: floors, regular doors, cracked walls, hazards, etc. */
    isOpenTile: (tile: number) => boolean;
    /** Returns a lock colour for locked-door tiles; null/undefined otherwise. */
    lockColourForTile?: (tile: number) => string | null | undefined;
  }

  interface EngineDungeonReachabilityResult {
    /** Fixed-point physical reachability after collecting reachable keys in dependency order. */
    reachable: Uint8Array[];
    /** Lock colours physically collectible from the start under caller-supplied tile semantics. */
    collectedColours: Set<string>;
    /** Required rooms with no reachable tile after the physical key-pickup fixed point. */
    unreachableRooms: any[];
    /** Lock colours present on the map but not physically collectible. */
    missingColours: string[];
    /** Frontier locked tiles adjacent to the final reachable set. */
    blockedEdges: Array<{ x: number; y: number; colour: string }>;
    /** Advisory facts only; game/content code decides whether and how to mutate. */
    repairHints: Array<
      { kind: 'downgrade-lock-colour'; colour: string } |
      { kind: 'connect-room'; room: any }
    >;
    /** Diagnostic helper for repair passes; callers choose which lock colours to pretend are held. */
    computeReach: (have: Set<string>) => Uint8Array[];
  }

  interface EngineDungeonReachabilityAPI {
    solveKeyLockReachability(opts: EngineDungeonReachabilityOptions): EngineDungeonReachabilityResult;
    roomTouchesReach(room: any, reachable: Uint8Array[]): boolean;
  }

  // ─── Aggregate ────────────────────────────────────────────────────────────

  /**
   * The engine-reusable subset of `window.NEON`. New engine modules add
   * their surface here. See docs/engine-boundary.md for classification.
   *
   * `window.NEON` is **not** narrowed to this — see the file header for why.
   */
  interface EngineSurface {
    // Mixed (engine math + game wiring shim) — see EngineAlarmLightAPI note.
    alarmLight: EngineAlarmLightAPI;
    // Pure-engine helper modules.
    math: EngineMathAPI;
    viewport: EngineViewportAPI;
    touch: EngineTouchAPI;
    draw: EngineDrawAPI;
    decor: EngineDecorAPI;
    dungeonTopology: EngineDungeonTopologyAPI;
    dungeonReachability: EngineDungeonReachabilityAPI;
    renderBoundary: EngineRenderBoundaryAPI;
    spawn: EngineSpawnAPI;
    telemetry: EngineTelemetryAPI;
    // Factory engine modules — call createX(opts) for an instance.
    input: EngineInputAPI;
    audio: EngineAudioAPI;
    particles: EngineParticlesAPI;
    biomesEngine: EngineBiomesRouterAPI;
    cinematic: EngineCinematicAPI;
  }
}
