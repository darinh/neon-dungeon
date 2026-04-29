'use strict';
// World zoom — playfield-only scale multiplier applied to the world
// canvas via `ctx.scale(zoom, zoom)` in renderPlaying. Mobile-first:
// the auto-fit `gameScale` clamps tiles to ~14–30 CSS-px on the
// smaller axis, which is uncomfortably small on phones; this setting
// lets users zoom in further. HUD chrome (drawHUD, minimap, status
// bar, boss bar, intro/death overlays, danger vignette) sits OUTSIDE
// the scaled transform so it remains at native (1.0) scale.
//
// game.js / render.js / platform.js / content.js are all browser-
// coupled (no UMD exports), so we can't exercise the runtime state
// machine under node:test. Instead these tests assert the structural
// invariants any working implementation must satisfy. Pattern matches
// the canonical structural-test scaffold used across the codebase
// (boss-intro, boss-death, NULLIFIER, etc.).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const GAME = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8'
);
const RENDER = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'render.js'), 'utf8'
);
const PLATFORM = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'platform.js'), 'utf8'
);
const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
);

/** @param {string} src */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const GAME_NC = stripComments(GAME);
const RENDER_NC = stripComments(RENDER);
const PLATFORM_NC = stripComments(PLATFORM);
const CONTENT_NC = stripComments(CONTENT);

// ─── Step list ──────────────────────────────────────────────────────────────

test('WORLD_ZOOM_STEPS is declared in platform.js with a finite, sorted, mobile-friendly range', () => {
  // Pin the canonical step list. Without it the stepper UI can't cycle
  // through values and load() snap-to-nearest can't normalise persisted
  // values. The list must include 1.0 (the legacy / no-zoom default)
  // and at least one step ≥ 2.0 (mobile genuinely needs the high end —
  // a phone in compact mode at 2× zoom is the difference between
  // playable and squinting).
  const m = PLATFORM_NC.match(/const\s+WORLD_ZOOM_STEPS\s*=\s*\[([^\]]+)\]/);
  assert.ok(m, 'platform.js must declare `const WORLD_ZOOM_STEPS = [...]` for the worldZoom stepper');
  const values = m[1].split(',').map(s => Number(s.trim())).filter(v => Number.isFinite(v));
  assert.ok(values.length >= 4,
    `WORLD_ZOOM_STEPS must contain at least 4 entries for a useful stepper UX (got ${values.length})`);
  assert.ok(values.includes(1.0),
    'WORLD_ZOOM_STEPS must include 1.0 (the legacy / no-zoom default — required for the snap-to-nearest fallback)');
  const max = Math.max(...values);
  assert.ok(max >= 2.0,
    `WORLD_ZOOM_STEPS top step must be ≥ 2.0 (mobile genuinely needs the high end); got ${max}`);
  // Steps must be strictly ascending (the stepper UI walks the list
  // forward / backward; an out-of-order entry breaks the "wraps to
  // start" semantic).
  for (let i = 1; i < values.length; i++) {
    assert.ok(values[i] > values[i - 1],
      `WORLD_ZOOM_STEPS must be strictly ascending; got ${values.join(', ')}`);
  }
  // All steps must be positive (a zero or negative zoom would invert /
  // collapse the playfield — would crash ctx.scale or render nothing).
  for (const v of values) {
    assert.ok(v > 0, `WORLD_ZOOM_STEPS entries must be positive; got ${v}`);
  }
});

// ─── Settings field ─────────────────────────────────────────────────────────

test('settings object declares worldZoom field with a default of 1.0', () => {
  // The field must exist as a numeric property with a default of 1.0
  // (the legacy / no-zoom value). The mobile-first override happens
  // INSIDE load() / resetAll() based on viewport width — the schema
  // default is the "everywhere" baseline.
  assert.match(PLATFORM_NC, /\bworldZoom:\s*1\.0,/,
    'settings literal must initialise worldZoom: 1.0,');
  // Type signature must include worldZoom:number so the typecheck
  // catches accidental string / undefined assignments. JSDoc lives
  // in /** ... */ blocks, so we read the COMMENTED source for this
  // check (PLATFORM_NC has comments stripped).
  assert.match(PLATFORM, /worldZoom\s*:\s*number/,
    'settings JSDoc type signature must include `worldZoom:number`');
});

test('settings.load() snaps worldZoom to WORLD_ZOOM_STEPS; first-run default is deferred to applyMobileFirstDefaults()', () => {
  // The load() path must (a) snap a persisted value to the nearest
  // canonical step and clear the deferred-default flag, and (b) when
  // no persisted value exists, leave worldZoom at the schema default
  // (1.0) AND leave the _worldZoomFromDefault flag at TRUE so the
  // mobile-first override can fire later from applyMobileFirstDefaults
  // — called by resize() AFTER W/H have been populated. This avoids
  // the load-order race where a top-level settings.load() reads W
  // before resize() runs (W stays at its initial 900, the W < 700
  // mobile-default check always fails, and EVERY first-time mobile
  // user gets 1.0× instead of the intended 1.5×).
  assert.match(PLATFORM_NC, /raw\.worldZoom[\s\S]{0,80}?snapToSteps\(\s*raw\.worldZoom\s*,\s*WORLD_ZOOM_STEPS\s*\)/,
    'settings.load() must snap raw.worldZoom to WORLD_ZOOM_STEPS');
  // The persisted-value branch must clear the deferred-default flag
  // (an explicit choice exists, don't override it later).
  assert.match(PLATFORM_NC, /this\.worldZoom\s*=\s*snapToSteps[\s\S]{0,120}?this\._worldZoomFromDefault\s*=\s*false/,
    'settings.load() must clear _worldZoomFromDefault when a persisted worldZoom exists (explicit user choice)');
});

test('settings.applyMobileFirstDefaults uses layout.compact and is idempotent (one-shot, early-return BEFORE compact read)', () => {
  // Mobile-first applicator runs ONCE, after the first real resize().
  // Subsequent calls (window resize, orientation change) must no-op so
  // a user's explicit zoom choice is never clobbered.
  assert.match(PLATFORM_NC, /\bapplyMobileFirstDefaults\s*\(\s*\)\s*\{/,
    'settings.applyMobileFirstDefaults() method must be defined');
  // Extract the function body via brace-depth so we can assert
  // POSITIONAL ordering of internal statements (gpt-5.5 r2 hardening:
  // a presence-only check would not catch a contributor moving the
  // compact branch ABOVE the flag guard, which would clobber explicit
  // 1.0× choices on subsequent resizes).
  const fnIdx = PLATFORM_NC.search(/applyMobileFirstDefaults\s*\(\s*\)\s*\{/);
  assert.ok(fnIdx >= 0, 'must locate applyMobileFirstDefaults');
  const open = PLATFORM_NC.indexOf('{', fnIdx);
  let depth = 0;
  let bodyEnd = -1;
  for (let j = open; j < PLATFORM_NC.length; j++) {
    if (PLATFORM_NC[j] === '{') depth++;
    else if (PLATFORM_NC[j] === '}') { depth--; if (depth === 0) { bodyEnd = j + 1; break; } }
  }
  assert.ok(bodyEnd > 0, 'must extract applyMobileFirstDefaults body');
  const body = PLATFORM_NC.slice(fnIdx, bodyEnd);
  // Must early-return when the deferred-default flag is false.
  assert.match(body, /if\s*\(\s*!\s*this\._worldZoomFromDefault\s*\)\s*return/,
    'applyMobileFirstDefaults must early-return when _worldZoomFromDefault is false (idempotent / no clobber)');
  // The early-return must precede the compact read AND the worldZoom
  // assignment — otherwise compact resizes clobber explicit / reset
  // 1.0× choices.
  const earlyReturnIdx = body.search(/if\s*\(\s*!\s*this\._worldZoomFromDefault\s*\)\s*return/);
  const compactReadIdx = body.search(/layout\s*&&\s*layout\.compact/);
  const worldZoomSetIdx = body.search(/this\.worldZoom\s*=\s*1\.5/);
  assert.ok(earlyReturnIdx >= 0 && compactReadIdx >= 0 && worldZoomSetIdx >= 0,
    'applyMobileFirstDefaults body must contain early-return + compact read + worldZoom set');
  assert.ok(earlyReturnIdx < compactReadIdx,
    'applyMobileFirstDefaults early-return MUST appear BEFORE the layout.compact read (otherwise compact resizes clobber explicit choices)');
  assert.ok(earlyReturnIdx < worldZoomSetIdx,
    'applyMobileFirstDefaults early-return MUST appear BEFORE the worldZoom assignment');
  // Compact branch: must set worldZoom to 1.5×.
  // Latch — flag flips to false even on the non-compact path so a
  // window-resize-into-compact later doesn't surprise-update the
  // user's explicit 1.0× preference.
  assert.match(body, /this\._worldZoomFromDefault\s*=\s*false/,
    'applyMobileFirstDefaults must latch _worldZoomFromDefault to false (one-shot)');
});

test('resize() invokes settings.applyMobileFirstDefaults AFTER updateLayout (deferred default needs layout.compact)', () => {
  // Without this call, the deferred mobile-first default never runs
  // and first-time mobile users get 1.0× — the bug R1 reviewers
  // flagged as Critical. Order matters: applyMobileFirstDefaults
  // reads layout.compact, which is set by updateLayout. Calling them
  // in reverse order silently breaks the compact predicate.
  const fnIdx = PLATFORM_NC.search(/function\s+resize\s*\(\s*\)\s*\{/);
  assert.ok(fnIdx >= 0, 'must locate function resize()');
  const open = PLATFORM_NC.indexOf('{', fnIdx);
  let depth = 0;
  let bodyEnd = -1;
  for (let j = open; j < PLATFORM_NC.length; j++) {
    if (PLATFORM_NC[j] === '{') depth++;
    else if (PLATFORM_NC[j] === '}') { depth--; if (depth === 0) { bodyEnd = j + 1; break; } }
  }
  assert.ok(bodyEnd > 0, 'must extract resize() body');
  const body = PLATFORM_NC.slice(fnIdx, bodyEnd);
  assert.match(body, /settings\.applyMobileFirstDefaults\s*\(\s*\)/,
    'resize() must call settings.applyMobileFirstDefaults()');
  const updateLayoutIdx = body.search(/\bupdateLayout\s*\(\s*\)/);
  const applyDefaultsIdx = body.search(/settings\.applyMobileFirstDefaults\s*\(\s*\)/);
  assert.ok(updateLayoutIdx >= 0, 'resize() must call updateLayout()');
  assert.ok(applyDefaultsIdx >= 0, 'resize() must call settings.applyMobileFirstDefaults()');
  assert.ok(updateLayoutIdx < applyDefaultsIdx,
    'updateLayout() MUST be called BEFORE settings.applyMobileFirstDefaults() (the applicator reads layout.compact, which updateLayout populates)');
});

test('settings.load() restores the persisted _worldZoomFromDefault flag (protects accepted-default users)', () => {
  // gpt-5.5 r2 hardening: without this load branch, a user who
  // explicitly accepted the schema 1.0× default last session would
  // come back with the flag at the schema TRUE, and the next mobile
  // resize would surprise-bump them to 1.5×. The persisted flag is
  // the ONLY mechanism that protects accepted-default users from
  // re-applying the deferred default.
  assert.match(PLATFORM_NC, /typeof\s+raw\._worldZoomFromDefault\s*===\s*'boolean'[\s\S]{0,80}?this\._worldZoomFromDefault\s*=\s*raw\._worldZoomFromDefault/,
    'settings.load() must read raw._worldZoomFromDefault (when boolean) into this._worldZoomFromDefault — protects users who accepted the schema 1.0× default from re-applying the mobile-first override');
});

test('settings.save() persists worldZoom + _worldZoomFromDefault flag, settings.resetAll() restores the mobile-aware default', () => {
  // Persistence: save() must include worldZoom + the deferred-default
  // tracking flag so a returning user's explicit choice survives
  // reload AND a returning first-time-default user doesn't get the
  // mobile-first override re-applied surprisingly.
  assert.match(PLATFORM_NC, /worldZoom:\s*this\.worldZoom/,
    'settings.save() payload must include `worldZoom: this.worldZoom`');
  assert.match(PLATFORM_NC, /_worldZoomFromDefault:\s*this\._worldZoomFromDefault/,
    'settings.save() payload must include `_worldZoomFromDefault` so explicit-choice tracking survives reload');
  // resetAll() must use layout.compact (same predicate as
  // applyMobileFirstDefaults) so RESET on a phone keeps the playfield
  // comfortably readable.
  assert.match(PLATFORM_NC, /resetAll\(\)\s*\{[\s\S]*?layout\s*&&\s*layout\.compact[\s\S]{0,120}?this\.worldZoom\s*=\s*[^;]*\?\s*1\.5\s*:\s*1\.0/,
    'settings.resetAll() must apply the layout.compact-aware default (compact → 1.5, else → 1.0) — matches applyMobileFirstDefaults to keep RESET safe on phones');
  // RESET counts as an explicit user action — flag must clear so the
  // deferred default doesn't re-fire on a subsequent resize.
  assert.match(PLATFORM_NC, /resetAll\(\)\s*\{[\s\S]*?this\._worldZoomFromDefault\s*=\s*false/,
    'settings.resetAll() must clear _worldZoomFromDefault (RESET is an explicit user action)');
});

// ─── Camera math (render.js getCamera) ─────────────────────────────────────

test('getCamera reads settings.worldZoom and uses W/zoom × H/zoom as the effective viewport', () => {
  // Without zoom in the camera math, edge-clamp uses the full canvas
  // size — at zoom > 1 the player would walk into edges that the
  // visible viewport already shows blank. Pin the structural shape:
  // a `zoom` local sourced from settings.worldZoom AND viewW/viewH
  // locals computed as W/zoom and H/zoom.
  const fnIdx = RENDER_NC.search(/\bfunction\s+getCamera\s*\(/);
  assert.ok(fnIdx >= 0, 'render.js must define function getCamera');
  // Find the function body — extract via brace-depth from the opening {
  const open = RENDER_NC.indexOf('{', fnIdx);
  let depth = 0;
  let bodyEnd = -1;
  for (let j = open; j < RENDER_NC.length; j++) {
    if (RENDER_NC[j] === '{') depth++;
    else if (RENDER_NC[j] === '}') { depth--; if (depth === 0) { bodyEnd = j + 1; break; } }
  }
  assert.ok(bodyEnd > 0, 'must extract getCamera body via brace-depth');
  const body = RENDER_NC.slice(fnIdx, bodyEnd);
  assert.match(body, /settings(?:\s*&&\s*settings)?\.worldZoom/,
    'getCamera must read settings.worldZoom (with optional defensive guard)');
  assert.match(body, /\bW\s*\/\s*zoom\b/,
    'getCamera must compute viewW = W / zoom (effective viewport accounts for zoom)');
  assert.match(body, /\bH\s*\/\s*zoom\b/,
    'getCamera must compute viewH = H / zoom (effective viewport accounts for zoom)');
  // The clamp / centring math must use viewW/viewH (not raw W/H) so
  // the player stays centred and edge-clamping respects the zoomed
  // visible area. Pin the player-centring math.
  assert.match(body, /player\.x\s*\*\s*TILE\s*-\s*viewW\s*\/\s*2/,
    'getCamera must centre on player using viewW (zoom-adjusted), not raw W');
  assert.match(body, /player\.y\s*\*\s*TILE\s*-\s*viewH\s*\/\s*2/,
    'getCamera must centre on player using viewH (zoom-adjusted), not raw H');
});

// ─── ctx.scale wrap in renderPlaying ────────────────────────────────────────

test('renderPlaying wraps the world-render block in ctx.save + ctx.scale + ctx.restore', () => {
  // The world-space draws (drawWorld + ambient + room markers + hazards
  // + items + enemies + projectiles + particles + player + orbitals)
  // must run INSIDE a ctx.scale(zoom, zoom) transform so worldZoom
  // actually magnifies the playfield. The HUD/overlay block runs
  // OUTSIDE so it stays at native scale.
  //
  // Find renderPlaying and verify the structural shape.
  const renderPlayingIdx = GAME_NC.search(/\brenderPlaying\s*\(\s*\)\s*\{/);
  assert.ok(renderPlayingIdx >= 0, 'must find renderPlaying() in game.js');
  const tail = GAME_NC.slice(renderPlayingIdx);
  // The opening of the world block: ctx.save followed by ctx.scale
  // with the same identifier on both axes. Allow an optional gating
  // `if (zoomed)` wrapper since ctx.save + ctx.scale + ctx.restore at
  // zoom=1.0 is wasteful in the hot path.
  assert.match(tail, /ctx\.save\(\s*\)\s*;\s*ctx\.scale\(\s*([a-zA-Z_$][\w$]*)\s*,\s*\1\s*\)/,
    'renderPlaying must open a ctx.save() + ctx.scale(zoom, zoom) block before world-space draws');
  // The matching ctx.restore must appear AFTER the world block but
  // BEFORE the HUD block (drawDangerVignette is the first HUD call).
  // Find positions and assert ordering.
  const scaleIdx = tail.search(/ctx\.scale\(\s*([a-zA-Z_$][\w$]*)\s*,\s*\1\s*\)/);
  const dangerVignetteIdx = tail.search(/\bdrawDangerVignette\s*\(/);
  assert.ok(scaleIdx >= 0, 'renderPlaying must call ctx.scale(zoom, zoom)');
  assert.ok(dangerVignetteIdx >= 0, 'renderPlaying must call drawDangerVignette (HUD block start)');
  // Find a ctx.restore between scale and dangerVignette (the world-block-end restore).
  const between = tail.slice(scaleIdx, dangerVignetteIdx);
  assert.match(between, /ctx\.restore\(\s*\)/,
    'renderPlaying must call ctx.restore() AFTER the world block and BEFORE drawDangerVignette (HUD must render at native scale)');
});

test('renderPlaying world-block reads settings.worldZoom (single source of truth)', () => {
  // The zoom value passed to ctx.scale must derive from
  // settings.worldZoom (not a hardcoded literal). Otherwise the
  // setting changes don't actually move the playfield.
  const renderPlayingIdx = GAME_NC.search(/\brenderPlaying\s*\(\s*\)\s*\{/);
  assert.ok(renderPlayingIdx >= 0, 'must find renderPlaying()');
  // Look at the first ~3000 chars of renderPlaying for a settings.worldZoom read
  const head = GAME_NC.slice(renderPlayingIdx, renderPlayingIdx + 3000);
  assert.match(head, /settings(?:\s*&&\s*settings)?\.worldZoom/,
    'renderPlaying must read settings.worldZoom (with optional defensive guard) before the world-block ctx.scale');
});

test('renderPlaying screen-shake offset is divided by worldZoom (preserves canvas-px shake magnitude across zoom levels)', () => {
  // Opus r2 finding: shake.ox/oy are produced by triggerShake() with
  // canvas-px magnitudes (2-5). They're added to cam.x/cam.y (world-px
  // units) which are then consumed inside ctx.scale(zoom). Without
  // /zoom, the on-screen shake plays back at zoom× intensity — at the
  // mobile-first 1.5× default that's 50% stronger than tuned, actively
  // bad for the audience the feature targets. Divide by zoom to
  // restore historical canvas-px magnitude across all zoom levels.
  const renderPlayingIdx = GAME_NC.search(/\brenderPlaying\s*\(\s*\)\s*\{/);
  assert.ok(renderPlayingIdx >= 0, 'must find renderPlaying()');
  const head = GAME_NC.slice(renderPlayingIdx, renderPlayingIdx + 3000);
  assert.match(head, /cam\.x\s*\+=\s*shake\.ox\s*\/\s*[a-zA-Z_$][\w$]*/,
    'renderPlaying must apply shake to cam.x as `shake.ox / worldZoom` (preserve canvas-px shake magnitude under ctx.scale)');
  assert.match(head, /cam\.y\s*\+=\s*shake\.oy\s*\/\s*[a-zA-Z_$][\w$]*/,
    'renderPlaying must apply shake to cam.y as `shake.oy / worldZoom`');
});

test('renderPlaying gates ctx.scale wrap on STRICT inequality (!== 1) to defeat string-coercion silent failures', () => {
  // Opus r1 finding: a "simplification" from `!== 1` to `!= 1` would
  // still work for numeric zoom, but if a regression sets
  // `settings.worldZoom = "1"` (string from a corrupted localStorage
  // payload that bypasses snapToSteps) then `"1" != 1` is FALSE with
  // ==, the scale block is skipped, and the world renders at 1× while
  // every mouse-conversion site does `mouse.x / "1"` (which coerces
  // back to a number and works) — silently desynchronising aim from
  // rendering. The strict-equality form catches the type drift and
  // chooses the same gate as the conversions.
  const renderPlayingIdx = GAME_NC.search(/\brenderPlaying\s*\(\s*\)\s*\{/);
  assert.ok(renderPlayingIdx >= 0, 'must find renderPlaying()');
  const head = GAME_NC.slice(renderPlayingIdx, renderPlayingIdx + 3000);
  assert.match(head, /_zoom\s*!==\s*1\b/,
    'world-zoom gate must use STRICT inequality (`_zoom !== 1`) to defeat string-coercion silent failure (do not weaken to `!=`)');
});

// ─── Touch + mouse → world conversions ──────────────────────────────────────

test('touch-aim synthesis multiplies player screen position by worldZoom', () => {
  // The touch-aim handler at game.js writes `mouse.x = playerScreenPx
  // + touch.aim.dx * 300`. With ctx.scale(z) active in the renderer,
  // the player's CANVAS pixel position is `(player.x*TILE - cam.x) * z`
  // — not just `player.x*TILE - cam.x`. Without the * z multiplier the
  // synthetic mouse position lands in the wrong place AND the
  // worldAim conversion (also zoom-aware) would aim somewhere
  // entirely different from where the joystick is pointing.
  //
  // Pin both axes.
  assert.match(GAME_NC, /mouse\.x\s*=\s*\(\s*player\.x\s*\*\s*TILE\s*-\s*cam\.x\s*\)\s*\*\s*[a-zA-Z_$][\w$]*\s*\+\s*touch\.aim\.dx\s*\*\s*300/,
    'touch-aim must compute mouse.x = (player.x*TILE - cam.x) * worldZoom + touch.aim.dx * 300');
  assert.match(GAME_NC, /mouse\.y\s*=\s*\(\s*player\.y\s*\*\s*TILE\s*-\s*cam\.y\s*\)\s*\*\s*[a-zA-Z_$][\w$]*\s*\+\s*touch\.aim\.dy\s*\*\s*300/,
    'touch-aim must compute mouse.y = (player.y*TILE - cam.y) * worldZoom + touch.aim.dy * 300');
});

test('mouse → worldAim conversion divides mouse coords by worldZoom before adding cam', () => {
  // Mouse events arrive in canvas (logical) px. The world-render block
  // uses ctx.scale(z), so converting back to world tiles requires
  // /zoom on the canvas-px term BEFORE adding the cam (in world-px).
  // Without /zoom, aim is wildly miscalibrated at non-1.0 zoom.
  //
  // Pin BOTH axes of the worldAimX/Y assignment.
  assert.match(GAME_NC, /worldAimX\s*=\s*\(\s*mouse\.x\s*\/\s*[a-zA-Z_$][\w$]*\s*\+\s*cam\.x\s*\)\s*\/\s*TILE/,
    'worldAimX must be (mouse.x / worldZoom + cam.x) / TILE');
  assert.match(GAME_NC, /worldAimY\s*=\s*\(\s*mouse\.y\s*\/\s*[a-zA-Z_$][\w$]*\s*\+\s*cam\.y\s*\)\s*\/\s*TILE/,
    'worldAimY must be (mouse.y / worldZoom + cam.y) / TILE');
});

test('every aim-place hackware in content.js divides mouse coords by worldZoom', () => {
  // Hackware that aim-places at the cursor (GRAVITY_WELL, STATIC_FIELD,
  // HOLO_DECOY, DECOY_TURRET, BLINK, HACKWARE_BEAM, CHRONO_LURE)
  // converts mouse → world via `(mouse + cam) / TILE`. Each site must
  // factor in /worldZoom to land at the actual cursor position.
  //
  // Count the unscaled `(mouse.x + ...x) / TILE` shape — must be 0.
  // Count the scaled `(mouse.x / <ident> + ...x) / TILE` shape — must
  // be ≥ 6 (one per hackware that aim-places). The exact count may
  // grow as new aim-place hackware is added; pin a lower bound.
  const unscaledX = (CONTENT_NC.match(/\(\s*mouse\.x\s*\+\s*[a-zA-Z_$][\w$]*\.x\s*\)\s*\/\s*TILE/g) || []).length;
  const unscaledY = (CONTENT_NC.match(/\(\s*mouse\.y\s*\+\s*[a-zA-Z_$][\w$]*\.y\s*\)\s*\/\s*TILE/g) || []).length;
  assert.equal(unscaledX, 0,
    `content.js must not contain any unscaled \`(mouse.x + cam.x) / TILE\` conversions — every site must factor /worldZoom (got ${unscaledX} unscaled)`);
  assert.equal(unscaledY, 0,
    `content.js must not contain any unscaled \`(mouse.y + cam.y) / TILE\` conversions — every site must factor /worldZoom (got ${unscaledY} unscaled)`);
  const scaledX = (CONTENT_NC.match(/\(\s*mouse\.x\s*\/\s*[a-zA-Z_$][\w$]*\s*\+\s*[a-zA-Z_$][\w$]*\.x\s*\)\s*\/\s*TILE/g) || []).length;
  const scaledY = (CONTENT_NC.match(/\(\s*mouse\.y\s*\/\s*[a-zA-Z_$][\w$]*\s*\+\s*[a-zA-Z_$][\w$]*\.y\s*\)\s*\/\s*TILE/g) || []).length;
  assert.ok(scaledX >= 6,
    `content.js must have ≥ 6 zoom-scaled \`(mouse.x / wz + cam.x) / TILE\` sites (one per aim-place hackware); got ${scaledX}`);
  assert.ok(scaledY >= 6,
    `content.js must have ≥ 6 zoom-scaled \`(mouse.y / wz + cam.y) / TILE\` sites; got ${scaledY}`);
});

test('NO src file contains an unscaled `(mouse + cam) / TILE` conversion (catches the codex r1 dash-aim omission class)', () => {
  // Codex R1 caught a missed conversion site in entities.js dash-aim
  // (line 13160) — my survey only enumerated content.js + game.js
  // sites. To prevent the same omission class for any future input
  // path that converts canvas px → world tiles, scan EVERY src file
  // for the unscaled shape and fail loudly if one reappears.
  const ENTITIES_NC = stripComments(fs.readFileSync(
    path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
  ));
  const sources = /** @type {[string, string][]} */ ([
    ['game.js', GAME_NC],
    ['render.js', RENDER_NC],
    ['platform.js', PLATFORM_NC],
    ['content.js', CONTENT_NC],
    ['entities.js', ENTITIES_NC],
  ]);
  for (const [name, src] of sources) {
    const unscaled = (src.match(/\(\s*mouse\.[xy]\s*\+\s*[a-zA-Z_$][\w$]*\.[xy]\s*\)\s*\/\s*TILE/g) || []).length;
    assert.equal(unscaled, 0,
      `${name} must not contain any unscaled \`(mouse.[xy] + cam.[xy]) / TILE\` conversions — every site must factor /worldZoom; got ${unscaled} unscaled. (Codex r1 caught the dash-aim omission at entities.js:13160 by exactly this audit; this test prevents recurrence.)`);
  }
});

// ─── Settings UI wiring ─────────────────────────────────────────────────────

test('updateSettings stepperRows includes worldZoom alongside minimapScale + textScale', () => {
  // The stepper UI wiring lives in updateSettings — without an entry
  // here the player has no way to change worldZoom in-game. Pin the
  // structural shape (key + steps reference).
  assert.match(GAME_NC, /\{\s*key:\s*['"]worldZoom['"]\s*,\s*steps:\s*WORLD_ZOOM_STEPS\s*\}/,
    'updateSettings stepperRows must include { key: "worldZoom", steps: WORLD_ZOOM_STEPS }');
});

test('renderSettings stepperLabels includes "WORLD ZOOM" alongside MINIMAP SIZE + TEXT SIZE', () => {
  // The visible label rendered by renderSettings must include the
  // WORLD ZOOM stepper. Without it the row exists in the data array
  // but draws blank — invisible to the player.
  assert.match(GAME_NC, /stepperLabels\s*=\s*\[\s*['"]MINIMAP SIZE['"]\s*,\s*['"]TEXT SIZE['"]\s*,\s*['"]WORLD ZOOM['"]\s*\]/,
    'renderSettings stepperLabels must include "WORLD ZOOM" as the third entry');
});

test('STEPPER_COUNT bumped from 2 to 3 in BOTH updateSettings + renderSettings', () => {
  // Adding a stepper without bumping STEPPER_COUNT pushes the rebind
  // rows under the new stepper, making the last toggle/stepper
  // unclickable on touch. Pin both copies (CTRL_START canary in
  // crt-mode/reduced-motion tests already cover the structural form).
  const counts = (GAME_NC.match(/const\s+STEPPER_COUNT\s*=\s*3\b/g) || []).length;
  assert.equal(counts, 2,
    `STEPPER_COUNT = 3 must appear EXACTLY twice in game.js (updateSettings + renderSettings); got ${counts}`);
});

// ─── HUD-space draws that need zoom-awareness ───────────────────────────────

test('drawWorld tile-loop culling uses W/zoom and (H-hudH)/zoom for endX/endY (mobile perf) AND keeps the +2 safety margin (no edge-tile skip)', () => {
  // gpt-5.5 r1 finding: at zoom 2.5×, the visible viewport is
  // W/zoom × H/zoom world-px, but the tile loop without /zoom
  // traverses the full W × H area — ~6.25× more tiles than visible.
  // Mobile is the worldZoom feature's primary audience and the
  // population that can least afford that overdraw. Pin the structural
  // shape: the endX/endY math must factor /worldZoom AND keep the
  // existing startX/startY -1 + endX/endY +2 safety margin so
  // sub-tile camera offsets don't skip visible edge tiles
  // (gpt-5.5 r2 hardening — presence-only check would not catch a
  // contributor removing the margin).
  const fnIdx = RENDER_NC.search(/\bfunction\s+drawWorld\s*\(/);
  assert.ok(fnIdx >= 0, 'must find drawWorld');
  const head = RENDER_NC.slice(fnIdx, fnIdx + 1500);
  assert.match(head, /W\s*\/\s*[a-zA-Z_$][\w$]*\s*\)\s*\/\s*TILE/,
    'drawWorld endX must compute (W / worldZoom) / TILE (zoom-aware tile-loop culling — mobile perf)');
  assert.match(head, /\(\s*H\s*-\s*layout\.hudH\s*\)\s*\/\s*[a-zA-Z_$][\w$]*\s*\)\s*\/\s*TILE/,
    'drawWorld endY must compute ((H - layout.hudH) / worldZoom) / TILE (zoom-aware tile-loop culling — mobile perf)');
  // Safety margin: startX/startY use floor(cam/TILE) - 1 so a sub-tile
  // camera offset doesn't drop the leftmost/topmost edge tile.
  assert.match(head, /startX\s*=\s*Math\.max\(\s*0\s*,\s*Math\.floor\(\s*camX\s*\/\s*TILE\s*\)\s*-\s*1\s*\)/,
    'drawWorld must keep `startX = Math.max(0, Math.floor(camX/TILE) - 1)` safety margin (sub-tile camera offset coverage)');
  assert.match(head, /startY\s*=\s*Math\.max\(\s*0\s*,\s*Math\.floor\(\s*camY\s*\/\s*TILE\s*\)\s*-\s*1\s*\)/,
    'drawWorld must keep `startY = Math.max(0, Math.floor(camY/TILE) - 1)` safety margin');
  // End-tile +2 padding — covers the start-tile -1 plus a
  // post-fractional rightmost-edge tile.
  assert.match(head, /startX\s*\+\s*[a-zA-Z_$][\w$]*\s*\+\s*2/,
    'drawWorld endX must keep the `+ 2` safety margin (covers start -1 + rightmost-edge fractional tile)');
  assert.match(head, /startY\s*\+\s*[a-zA-Z_$][\w$]*\s*\+\s*2/,
    'drawWorld endY must keep the `+ 2` safety margin');
});

test('drawThreatIndicators uses W/zoom and (H-hudH)/zoom for view bounds AND projects arrows by *zoom (HUD-space + zoom-aware) AND clamps to screen edges', () => {
  // Multiple r1 reviewers (gpt-5.5, opus, codex) flagged that
  // drawThreatIndicators runs OUTSIDE the world ctx.scale wrap but
  // its math hadn't been zoom-corrected. At zoom > 1, enemies clearly
  // inside the zoomed-in view get suppressed (false-clear) AND arrows
  // for genuinely-off-screen enemies cluster toward the centre rather
  // than the screen edge. Pin both fixes AND the screen-edge clamp
  // (gpt-5.5 r2 hardening — presence-only zoom check would not catch
  // a contributor removing the clamp, which would let arrows leak
  // off-canvas at extreme zoom).
  const fnIdx = RENDER_NC.search(/\bfunction\s+drawThreatIndicators\s*\(/);
  assert.ok(fnIdx >= 0, 'must find drawThreatIndicators');
  const head = RENDER_NC.slice(fnIdx, fnIdx + 2000);
  assert.match(head, /settings(?:\s*&&\s*settings)?\.worldZoom/,
    'drawThreatIndicators must read settings.worldZoom');
  assert.match(head, /camX\s*\+\s*W\s*\/\s*[a-zA-Z_$][\w$]*\s*\)\s*\/\s*TILE/,
    'drawThreatIndicators viewR must use (camX + W / worldZoom) / TILE (effective viewport)');
  assert.match(head, /camY\s*\+\s*\(\s*H\s*-\s*layout\.hudH\s*\)\s*\/\s*[a-zA-Z_$][\w$]*\s*\)\s*\/\s*TILE/,
    'drawThreatIndicators viewB must use (camY + (H - layout.hudH) / worldZoom) / TILE (effective viewport)');
  assert.match(head, /\(\s*e\.x\s*\*\s*TILE\s*-\s*camX\s*\)\s*\*\s*[a-zA-Z_$][\w$]*/,
    'drawThreatIndicators arrow sx must be (e.x * TILE - camX) * worldZoom (project world-px to canvas-px outside the world transform)');
  assert.match(head, /\(\s*e\.y\s*\*\s*TILE\s*-\s*camY\s*\)\s*\*\s*[a-zA-Z_$][\w$]*/,
    'drawThreatIndicators arrow sy must be (e.y * TILE - camY) * worldZoom');
  // Screen-edge clamp — without this, arrows leak off-canvas at
  // extreme zoom (the projected sx/sy can exceed W or H).
  assert.match(head, /clamp\(\s*sx\s*,\s*margin\s*,\s*W\s*-\s*margin\s*\)/,
    'drawThreatIndicators must clamp arrow cx to [margin, W - margin] so arrows stay on-screen');
  assert.match(head, /clamp\(\s*sy\s*,\s*margin\s*,\s*H\s*-\s*layout\.hudH\s*-\s*margin\s*\)/,
    'drawThreatIndicators must clamp arrow cy to [margin, H - layout.hudH - margin] so arrows stay above the HUD bar');
});
