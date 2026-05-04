'use strict';
// World zoom — GLOBAL UI scale (browser CTRL-+ analog). Repurposed from
// the playfield-only multiplier (PR #388, v384) to a uniform global
// scale that wraps everything: main menus, loot choices, HUD, world,
// pause/death overlays, base text size, etc. Mobile-first 1.5×
// default still applies. textScale stacks multiplicatively (it
// multiplies font px BEFORE we draw → final on-screen text is
// `baseSize * textScale * worldZoom`).
//
// Architecture, single source of truth:
//   1. resize() in src/platform.js sets `rawW/rawH` from the viewport
//      + gameScale, then sets effective `W = round(rawW / worldZoom)`,
//      `H = round(rawH / worldZoom)`. Canvas backing stays at rawW×rawH.
//   2. render() in src/game.js wraps the ENTIRE per-frame draw in a
//      single `ctx.save() + ctx.scale(worldZoom, worldZoom) + ... +
//      ctx.restore()` block — every state (MENU, PLAYING, HUB, …)
//      runs inside.
//   3. Pointer/touch input is divided by worldZoom at the host
//      boundary (mousemove + toCanvas in src/platform.js) so every
//      consumer sees mouse.x/y already in LOGICAL (post-zoom)
//      coordinates. NO per-site `/worldZoom` correction anywhere.
//
// game.js / render.js / platform.js / content.js / entities.js are all
// browser-coupled (no UMD exports), so we can't exercise the runtime
// state machine under node:test. Instead these tests assert the
// structural invariants any working implementation must satisfy.
// Pattern matches the canonical structural-test scaffold used across
// the codebase (boss-intro, boss-death, NULLIFIER, etc.).

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
const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);

// stripComments must only strip FULL-LINE `//` comments. The aggressive
// pattern `/(^|[^:\\])\/\/[^\n]*/g` over-strips real code after `//`
// inside string literals (e.g. `'x//y'` → `'x`). See stored memory
// `structural test bypass classes`.
/** @param {string} src */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');
}

const GAME_NC = stripComments(GAME);
const RENDER_NC = stripComments(RENDER);
const PLATFORM_NC = stripComments(PLATFORM);
const CONTENT_NC = stripComments(CONTENT);
const ENTITIES_NC = stripComments(ENTITIES);

/** @param {string} src @param {number} fnIdx Returns the brace-balanced body of the function whose `{` opens at-or-after fnIdx. */
function extractBody(src, fnIdx) {
  const open = src.indexOf('{', fnIdx);
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(fnIdx, j + 1); }
  }
  return '';
}

// ─── Step list ──────────────────────────────────────────────────────────────

test('WORLD_ZOOM_STEPS is declared in platform.js with a finite, sorted, mobile-friendly range', () => {
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
  for (let i = 1; i < values.length; i++) {
    assert.ok(values[i] > values[i - 1],
      `WORLD_ZOOM_STEPS must be strictly ascending; got ${values.join(', ')}`);
  }
  for (const v of values) {
    assert.ok(v > 0, `WORLD_ZOOM_STEPS entries must be positive; got ${v}`);
  }
});

// ─── Settings field ─────────────────────────────────────────────────────────

test('settings object declares worldZoom field with a default of 1.0', () => {
  assert.match(PLATFORM_NC, /\bworldZoom:\s*1\.0,/,
    'settings literal must initialise worldZoom: 1.0,');
  assert.match(PLATFORM, /worldZoom\s*:\s*number/,
    'settings JSDoc type signature must include `worldZoom:number`');
});

test('settings.load() snaps worldZoom to WORLD_ZOOM_STEPS; first-run default deferred to applyMobileFirstDefaults()', () => {
  assert.match(PLATFORM_NC, /raw\.worldZoom[\s\S]{0,80}?snapToSteps\(\s*raw\.worldZoom\s*,\s*WORLD_ZOOM_STEPS\s*\)/,
    'settings.load() must snap raw.worldZoom to WORLD_ZOOM_STEPS');
  assert.match(PLATFORM_NC, /this\.worldZoom\s*=\s*snapToSteps[\s\S]{0,120}?this\._worldZoomFromDefault\s*=\s*false/,
    'settings.load() must clear _worldZoomFromDefault when a persisted worldZoom exists (explicit user choice)');
});

test('settings.applyMobileFirstDefaults uses layout.compact and is idempotent (one-shot, early-return BEFORE compact read)', () => {
  assert.match(PLATFORM_NC, /\bapplyMobileFirstDefaults\s*\(\s*\)\s*\{/,
    'settings.applyMobileFirstDefaults() method must be defined');
  const fnIdx = PLATFORM_NC.search(/applyMobileFirstDefaults\s*\(\s*\)\s*\{/);
  const body = extractBody(PLATFORM_NC, fnIdx);
  assert.ok(body, 'must extract applyMobileFirstDefaults body');
  assert.match(body, /if\s*\(\s*!\s*this\._worldZoomFromDefault\s*\)\s*return/,
    'applyMobileFirstDefaults must early-return when _worldZoomFromDefault is false (idempotent / no clobber)');
  const earlyReturnIdx = body.search(/if\s*\(\s*!\s*this\._worldZoomFromDefault\s*\)\s*return/);
  const compactReadIdx = body.search(/layout\s*&&\s*layout\.compact/);
  const worldZoomSetIdx = body.search(/this\.worldZoom\s*=\s*1\.5/);
  assert.ok(earlyReturnIdx >= 0 && compactReadIdx >= 0 && worldZoomSetIdx >= 0,
    'applyMobileFirstDefaults body must contain early-return + compact read + worldZoom set');
  assert.ok(earlyReturnIdx < compactReadIdx,
    'applyMobileFirstDefaults early-return MUST appear BEFORE the layout.compact read');
  assert.ok(earlyReturnIdx < worldZoomSetIdx,
    'applyMobileFirstDefaults early-return MUST appear BEFORE the worldZoom assignment');
  assert.match(body, /this\._worldZoomFromDefault\s*=\s*false/,
    'applyMobileFirstDefaults must latch _worldZoomFromDefault to false (one-shot)');
});

test('resize() invokes settings.applyMobileFirstDefaults AFTER updateLayout (deferred default needs layout.compact)', () => {
  const fnIdx = PLATFORM_NC.search(/function\s+resize\s*\(\s*\)\s*\{/);
  const body = extractBody(PLATFORM_NC, fnIdx);
  assert.ok(body, 'must extract resize() body');
  const updateLayoutIdx = body.search(/\bupdateLayout\s*\(\s*\)/);
  const applyDefaultsIdx = body.search(/settings\.applyMobileFirstDefaults\s*\(\s*\)/);
  assert.ok(updateLayoutIdx >= 0, 'resize() must call updateLayout()');
  assert.ok(applyDefaultsIdx >= 0, 'resize() must call settings.applyMobileFirstDefaults()');
  assert.ok(updateLayoutIdx < applyDefaultsIdx,
    'updateLayout() MUST be called BEFORE settings.applyMobileFirstDefaults()');
});

test('settings.load() restores the persisted _worldZoomFromDefault flag (protects accepted-default users)', () => {
  assert.match(PLATFORM_NC, /typeof\s+raw\._worldZoomFromDefault\s*===\s*'boolean'[\s\S]{0,80}?this\._worldZoomFromDefault\s*=\s*raw\._worldZoomFromDefault/,
    'settings.load() must read raw._worldZoomFromDefault into this._worldZoomFromDefault');
});

test('settings.save() persists worldZoom + _worldZoomFromDefault, settings.resetAll() restores mobile-aware default', () => {
  assert.match(PLATFORM_NC, /worldZoom:\s*this\.worldZoom/,
    'settings.save() payload must include `worldZoom: this.worldZoom`');
  assert.match(PLATFORM_NC, /_worldZoomFromDefault:\s*this\._worldZoomFromDefault/,
    'settings.save() payload must include `_worldZoomFromDefault`');
  assert.match(PLATFORM_NC, /resetAll\(\)\s*\{[\s\S]*?layout\s*&&\s*layout\.compact[\s\S]{0,120}?this\.worldZoom\s*=\s*[^;]*\?\s*1\.5\s*:\s*1\.0/,
    'settings.resetAll() must apply the layout.compact-aware default (compact → 1.5, else → 1.0)');
  assert.match(PLATFORM_NC, /resetAll\(\)\s*\{[\s\S]*?this\._worldZoomFromDefault\s*=\s*false/,
    'settings.resetAll() must clear _worldZoomFromDefault');
});

// ─── NEW: effective W/H = raw / worldZoom (split done in resize) ──────────────

test('resize() computes effective W/H by dividing rawW/rawH by settings.worldZoom (the global wrap arithmetic)', () => {
  // Under the new global UI-zoom architecture, the entire per-frame
  // render is wrapped in `ctx.scale(worldZoom)`, and W/H are exposed
  // to all renderers as `rawW/H / worldZoom` so layout code naturally
  // sees a smaller logical viewport at higher zoom (browser CTRL+
  // analog). Pin the structural shape: resize() must read
  // settings.worldZoom and divide rawW + rawH by it (with defensive
  // `|| 1` fallback).
  const fnIdx = PLATFORM_NC.search(/function\s+resize\s*\(\s*\)\s*\{/);
  const body = extractBody(PLATFORM_NC, fnIdx);
  assert.ok(body, 'must extract resize() body');
  assert.match(body, /settings(?:\s*&&\s*settings)?\.worldZoom/,
    'resize() must read settings.worldZoom for the effective logical-size divisor');
  // rawW/rawH must be assigned from the gameScale-derived logical
  // size FIRST, then W/H derive from rawW/rawH divided by zoom.
  assert.match(body, /rawW\s*=\s*_sz\.W/,
    'resize() must store the gameScale-derived logical width as rawW');
  assert.match(body, /rawH\s*=\s*_sz\.H/,
    'resize() must store the gameScale-derived logical height as rawH');
  // Canvas backing stays at rawW × rawH (the global ctx.scale wrap
  // upscales the smaller logical area to fill it).
  assert.match(body, /canvas\.width\s*=\s*rawW/,
    'resize() must set canvas.width = rawW (canvas backing stays at pre-zoom logical size)');
  assert.match(body, /canvas\.height\s*=\s*rawH/,
    'resize() must set canvas.height = rawH');
  // Effective W = rawW / worldZoom. Allow Math.round + Math.max guard
  // for safety against zero / overflow but require the arithmetic
  // shape — `rawW` divided by an identifier that resolves to zoom.
  assert.match(body, /W\s*=\s*Math\.max\(\s*1\s*,\s*Math\.round\(\s*rawW\s*\/\s*[a-zA-Z_$][\w$]*\s*\)\s*\)/,
    'resize() must compute W = Math.max(1, Math.round(rawW / worldZoom))');
  assert.match(body, /H\s*=\s*Math\.max\(\s*1\s*,\s*Math\.round\(\s*rawH\s*\/\s*[a-zA-Z_$][\w$]*\s*\)\s*\)/,
    'resize() must compute H = Math.max(1, Math.round(rawH / worldZoom))');
});

// ─── NEW: global ctx.scale wrap in render() ─────────────────────────────────

test('render() (the top-level state dispatch) wraps the entire frame in a single ctx.scale(worldZoom) block', () => {
  // The global UI-zoom requirement: every renderable state (MENU,
  // PLAYING, HUB, SETTINGS, all overlays) must run inside the same
  // ctx.scale(worldZoom) wrap. The single dispatch site is `render()`
  // in game.js — wrapping there is the ONE place that covers
  // everything. A per-state wrap (e.g. in renderPlaying only) would
  // leave menus + HUB at native scale and silently break the user
  // request.
  const fnIdx = GAME_NC.search(/\brender\s*\(\s*\)\s*\{/);
  assert.ok(fnIdx >= 0, 'must locate render() method in game.js');
  const body = extractBody(GAME_NC, fnIdx);
  assert.ok(body, 'must extract render() body');
  // Must read settings.worldZoom (not a hardcoded literal).
  assert.match(body, /settings(?:\s*&&\s*settings)?\.worldZoom/,
    'render() must read settings.worldZoom for the global ctx.scale wrap');
  // Must open a ctx.save() + ctx.scale(zoom, zoom) block. The
  // identifier must match on both axes (uniform scale, not skewed).
  assert.match(body, /ctx\.save\(\s*\)\s*;\s*ctx\.scale\(\s*([a-zA-Z_$][\w$]*)\s*,\s*\1\s*\)/,
    'render() must open a ctx.save() + ctx.scale(zoom, zoom) block (uniform scale on both axes)');
  // Must close with a matching ctx.restore() at the bottom of the
  // function — pin the LAST ctx.restore() call inside render() to
  // confirm the wrap encompasses the entire dispatch + the trailing
  // crtMode overlay.
  const lastRestore = body.lastIndexOf('ctx.restore(');
  const lastCrt = body.lastIndexOf('drawCrtOverlay');
  assert.ok(lastRestore > 0 && lastCrt > 0,
    'render() must call drawCrtOverlay AND a closing ctx.restore()');
  assert.ok(lastRestore > lastCrt,
    'render() trailing ctx.restore() MUST appear AFTER drawCrtOverlay so the CRT overlay is also inside the global scale wrap');
  // Strict !== 1 gate (not !=) — defends against string-coercion
  // silent failures (settings.worldZoom = "1" via corrupted
  // localStorage that bypassed snapToSteps would coerce as `"1" != 1`
  // → false with `==`, skipping the wrap, but every input divisor
  // does `mouse.x / "1"` which coerces to a number — silently
  // desynchronising rendering from aim).
  assert.match(body, /_uiZoom\s*!==\s*1\b/,
    'global ctx.scale gate must use STRICT inequality (`_uiZoom !== 1`) to defeat string-coercion silent failure');
});

test('render() global-wrap fillRect uses W,H (logical bounds) so it covers the full canvas backing under ctx.scale', () => {
  // The clear-screen fillRect runs INSIDE the global ctx.scale wrap,
  // so it must use logical W,H bounds — those become canvas-backing
  // coords once the scale transform is applied, perfectly clearing
  // the entire backing. Using rawW/rawH here would over-fill at zoom>1
  // and leak into negative coords (harmless but wasteful) AND would
  // be wrong if the wrap were ever moved.
  const fnIdx = GAME_NC.search(/\brender\s*\(\s*\)\s*\{/);
  const body = extractBody(GAME_NC, fnIdx);
  assert.match(body, /ctx\.fillRect\(\s*0\s*,\s*0\s*,\s*W\s*,\s*H\s*\)/,
    'render() clear-screen fillRect must use W,H (logical bounds) — under the global ctx.scale wrap this fills the full canvas backing');
});

// ─── NEW: renderPlaying must NOT have its own playfield-only ctx.scale wrap ─

test('renderPlaying does NOT wrap its world block in a separate ctx.scale(zoom, zoom) (the global wrap in render() handles it)', () => {
  // Pre-global-UI-zoom architecture had a playfield-only scale wrap
  // inside renderPlaying — that wrap is now in render() (the
  // top-level dispatch). Keeping both would double-scale the
  // playfield while leaving menus single-scaled. Forbid the
  // identifier-symmetric `ctx.scale(X, X)` shape inside renderPlaying.
  const fnIdx = GAME_NC.search(/\brenderPlaying\s*\(\s*\)\s*\{/);
  assert.ok(fnIdx >= 0, 'must find renderPlaying()');
  const body = extractBody(GAME_NC, fnIdx);
  assert.ok(body, 'must extract renderPlaying() body');
  // Forbid `ctx.scale(<ident>, <ident>)` with the same identifier on
  // both axes (the global-wrap shape). Per-axis non-uniform scales
  // (e.g. `ctx.scale(1, -1)` for sprite flipping) are still allowed.
  assert.doesNotMatch(body, /ctx\.scale\(\s*([a-zA-Z_$][\w$]*)\s*,\s*\1\s*\)/,
    'renderPlaying must NOT contain a uniform `ctx.scale(zoom, zoom)` wrap — the global wrap in render() handles it');
});

test('renderPlaying applies shake to cam without dividing by worldZoom (logical-units invariant)', () => {
  // Under the global wrap, shake offsets stay in the logical-units
  // space (same as cam.x/cam.y), so adding them directly preserves
  // the canvas-px shake magnitude after the global ctx.scale is
  // applied. The pre-global-UI-zoom architecture had a `/_zoom`
  // correction here — forbidding it now prevents accidental
  // double-correction.
  const fnIdx = GAME_NC.search(/\brenderPlaying\s*\(\s*\)\s*\{/);
  const body = extractBody(GAME_NC, fnIdx);
  assert.match(body, /cam\.x\s*\+=\s*shake\.ox\s*;/,
    'renderPlaying must add shake.ox to cam.x WITHOUT a per-zoom divide');
  assert.match(body, /cam\.y\s*\+=\s*shake\.oy\s*;/,
    'renderPlaying must add shake.oy to cam.y WITHOUT a per-zoom divide');
  assert.doesNotMatch(body, /shake\.o[xy]\s*\//,
    'renderPlaying must NOT divide shake offsets by anything (logical units already match cam units)');
});

// ─── NEW: input-coord normalization at the host boundary ─────────────────────

test('platform.js mouse pointer handlers divide client→canvas conversion by worldZoom (logical coords delivered)', () => {
  // The single input-normalization site for pointer events. Without
  // this divide, every consumer in the codebase would need its own
  // `/worldZoom` correction — the architecture explicitly avoids
  // that scattering by normalising once at the host boundary.
  const helperIdx = PLATFORM_NC.search(/function\s+updateMouseFromClient\s*\(/);
  assert.ok(helperIdx >= 0, 'must find shared mouse coordinate normalization helper');
  const body = extractBody(PLATFORM_NC, helperIdx);
  assert.ok(body, 'must extract updateMouseFromClient() body');
  const mmIdx = PLATFORM_NC.search(/canvas\.addEventListener\(\s*'mousemove'/);
  assert.ok(mmIdx >= 0, 'must find canvas mousemove listener');
  const mdIdx = PLATFORM_NC.search(/canvas\.addEventListener\(\s*'mousedown'/);
  assert.ok(mdIdx >= 0, 'must find canvas mousedown listener');
  const mousemoveTail = PLATFORM_NC.slice(mmIdx, mmIdx + 180);
  const mousedownTail = PLATFORM_NC.slice(mdIdx, mdIdx + 220);
  assert.match(mousemoveTail, /updateMouseFromClient\(\s*e\.clientX\s*,\s*e\.clientY\s*\)/,
    'mousemove handler must use the shared logical coordinate helper');
  assert.match(mousedownTail, /updateMouseFromClient\(\s*e\.clientX\s*,\s*e\.clientY\s*\)[\s\S]*justPressed\.add\('MouseLeft'\)/,
    'mousedown handler must refresh logical coords before click hit-testing');
  assert.match(body, /mouse\.x\s*=\s*\(\s*clientX\s*-\s*r\.left\s*\)\s*\*\s*canvas\.width\s*\/\s*r\.width\s*\/\s*[a-zA-Z_$][\w$]*/,
    'shared pointer helper must divide the client→canvas conversion by an identifier (worldZoom) to deliver logical coords');
  assert.match(body, /mouse\.y\s*=\s*\(\s*clientY\s*-\s*r\.top\s*\)\s*\*\s*canvas\.height\s*\/\s*r\.height\s*\/\s*[a-zA-Z_$][\w$]*/,
    'shared pointer helper must divide the client→canvas conversion by an identifier (worldZoom) to deliver logical coords');
  // The divisor must derive from settings.worldZoom (with defensive
  // guard) — a hardcoded 1 would silently break the feature.
  assert.match(body, /settings(?:\s*&&\s*settings)?\.worldZoom/,
    'shared pointer helper must read settings.worldZoom for the input-normalization divisor');
});

test('platform.js toCanvas wrapper divides _touchHelpers.toCanvas output by worldZoom (parity with mousemove)', () => {
  // Touch handlers all flow through this single helper — keeping the
  // /worldZoom divide here ensures touch coords match mouse coords
  // exactly (same logical-units space). Without parity, mouse aim
  // would land at a different world position than touch aim at the
  // same screen location.
  const fnIdx = PLATFORM_NC.search(/function\s+toCanvas\s*\(/);
  assert.ok(fnIdx >= 0, 'must find toCanvas() in platform.js');
  const body = extractBody(PLATFORM_NC, fnIdx);
  assert.ok(body, 'must extract toCanvas() body');
  assert.match(body, /_touchHelpers\.toCanvas\(\s*clientX\s*,\s*clientY\s*,\s*canvas\s*\)/,
    'toCanvas wrapper must call the engine helper to get canvas-internal coords');
  assert.match(body, /settings(?:\s*&&\s*settings)?\.worldZoom/,
    'toCanvas wrapper must read settings.worldZoom for the divisor');
  assert.match(body, /\bcx\s*\/\s*[a-zA-Z_$][\w$]*\s*,\s*cy\s*\/\s*[a-zA-Z_$][\w$]*/,
    'toCanvas wrapper must return [cx / worldZoom, cy / worldZoom]');
});

// ─── NEW: NO per-section worldZoom corrections anywhere ─────────────────────

test('NO src file contains a `mouse.[xy] / <ident>` correction shape (host-side normalization is the single source of truth)', () => {
  // Inversion of the pre-global-UI-zoom invariant. Under the new
  // architecture, mouse.x/y arrive pre-normalized in logical
  // coordinates, so any per-site `mouse.x / <something>` is wrong —
  // it'd over-divide. This includes the legacy `mouse.x / _wz +
  // cam.x` shape that used to exist in 8 places across game.js,
  // entities.js, content.js, render.js. The mousemove handler in
  // platform.js is exempt because the divide there IS the host-side
  // normalization.
  /** @type {[string, string][]} */
  const sources = [
    ['game.js', GAME_NC],
    ['render.js', RENDER_NC],
    ['content.js', CONTENT_NC],
    ['entities.js', ENTITIES_NC],
  ];
  // Forbid `mouse.x / X` and `mouse.y / X` for ANY identifier X.
  // (Numeric divisors aren't meaningful here either — there's no
  // legitimate reason to divide a logical mouse coordinate by anything
  // in these consumer files.)
  for (const [name, src] of sources) {
    const xMatches = src.match(/\bmouse\.x\s*\/\s*\S/g) || [];
    const yMatches = src.match(/\bmouse\.y\s*\/\s*\S/g) || [];
    assert.equal(xMatches.length, 0,
      `${name} must not contain any \`mouse.x / ...\` correction — host-side normalization in platform.js delivers logical coords. Found: ${JSON.stringify(xMatches)}`);
    assert.equal(yMatches.length, 0,
      `${name} must not contain any \`mouse.y / ...\` correction — host-side normalization in platform.js delivers logical coords. Found: ${JSON.stringify(yMatches)}`);
  }
});

test('every aim-place hackware in content.js uses the unscaled `(mouse + cam) / TILE` shape (logical coords already match world units)', () => {
  // Under the new architecture, every aim-place hackware site
  // (GRAVITY_WELL, STATIC_FIELD, HOLO_DECOY, DECOY_TURRET, BLINK,
  // EMP_LINE / hackware beam, CHRONO_LURE) must use the plain
  // `(mouse.x + cam.x) / TILE` shape. The pre-global-UI-zoom shape
  // `(mouse.x / wz + cam.x) / TILE` would over-divide.
  const unscaledX = (CONTENT_NC.match(/\(\s*mouse\.x\s*\+\s*[a-zA-Z_$][\w$]*\.x\s*\)\s*\/\s*TILE/g) || []).length;
  const unscaledY = (CONTENT_NC.match(/\(\s*mouse\.y\s*\+\s*[a-zA-Z_$][\w$]*\.y\s*\)\s*\/\s*TILE/g) || []).length;
  assert.ok(unscaledX >= 6,
    `content.js must contain ≥ 6 unscaled \`(mouse.x + cam.x) / TILE\` aim-place sites; got ${unscaledX}`);
  assert.ok(unscaledY >= 6,
    `content.js must contain ≥ 6 unscaled \`(mouse.y + cam.y) / TILE\` aim-place sites; got ${unscaledY}`);
});

test('NO src file contains the legacy `mouse.[xy] / <ident> + cam.[xy]` correction shape (catches accidental re-introduction of the pre-global-UI-zoom pattern)', () => {
  // Specific bypass-class guard against a contributor copying the
  // pre-PR-#388 idiom and reintroducing per-site /worldZoom factors.
  // The pattern was scattered across 8+ sites; this test catches any
  // single reappearance.
  /** @type {[string, string][]} */
  const sources = [
    ['game.js', GAME_NC],
    ['render.js', RENDER_NC],
    ['content.js', CONTENT_NC],
    ['entities.js', ENTITIES_NC],
    ['platform.js', PLATFORM_NC],
  ];
  for (const [name, src] of sources) {
    const matches = src.match(/mouse\.[xy]\s*\/\s*[a-zA-Z_$][\w$]*\s*\+\s*[a-zA-Z_$][\w$]*\.[xy]/g) || [];
    assert.equal(matches.length, 0,
      `${name} must not contain the legacy \`mouse.[xy] / wz + cam.[xy]\` shape — host-side normalization makes per-site correction wrong. Found: ${JSON.stringify(matches)}`);
  }
});

// ─── NEW: render.js camera + tile loop + threat indicators (no zoom divides) ─

test('getCamera does NOT divide W or H by worldZoom (W/H are already post-zoom logical bounds)', () => {
  // Under the new architecture, W/H exposed to render code are
  // already `rawW/H / worldZoom` (set by resize()), so dividing
  // them again here would compound the shrink by zoom². The
  // viewport math must use plain W and H.
  const fnIdx = RENDER_NC.search(/\bfunction\s+getCamera\s*\(/);
  assert.ok(fnIdx >= 0, 'render.js must define function getCamera');
  const body = extractBody(RENDER_NC, fnIdx);
  assert.ok(body, 'must extract getCamera body');
  // Player-centring math must use viewW/viewH (assigned to W/H).
  assert.match(body, /player\.x\s*\*\s*TILE\s*-\s*viewW\s*\/\s*2/,
    'getCamera must centre on player using viewW (which equals W under the global wrap)');
  assert.match(body, /player\.y\s*\*\s*TILE\s*-\s*viewH\s*\/\s*2/,
    'getCamera must centre on player using viewH (which equals H under the global wrap)');
  // viewW = W (no /zoom).
  assert.match(body, /\bviewW\s*=\s*W\s*;/,
    'getCamera must set viewW = W (no per-zoom divide — W is already post-zoom under the global wrap)');
  assert.match(body, /\bviewH\s*=\s*H\s*;/,
    'getCamera must set viewH = H (no per-zoom divide — H is already post-zoom under the global wrap)');
  // Forbid the pre-global-UI-zoom `W / zoom` and `H / zoom` shapes.
  assert.doesNotMatch(body, /\bW\s*\/\s*zoom\b/,
    'getCamera must NOT divide W by zoom (W is already post-zoom under the global wrap — would compound to zoom²)');
  assert.doesNotMatch(body, /\bH\s*\/\s*zoom\b/,
    'getCamera must NOT divide H by zoom');
});

test('drawWorld tile-loop culling uses plain W/TILE and (H-hudH)/TILE (no per-zoom divide) AND keeps the +2 safety margin', () => {
  // Under the global wrap, W and H are already the post-zoom
  // viewport bounds, so the tile loop visits exactly the visible
  // area at any zoom — no per-zoom divide. The +1/+2 safety margin
  // around startX/Y/endX/Y stays the same so sub-tile camera
  // offsets don't drop edge tiles.
  const fnIdx = RENDER_NC.search(/\bfunction\s+drawWorld\s*\(/);
  assert.ok(fnIdx >= 0, 'must find drawWorld');
  const head = RENDER_NC.slice(fnIdx, fnIdx + 1500);
  // Viewport size in tiles uses plain W and (H - layout.hudH) — no
  // per-zoom divide.
  assert.match(head, /Math\.ceil\(\s*W\s*\/\s*TILE\s*\)/,
    'drawWorld must compute viewport-tile-width as `Math.ceil(W / TILE)` (W is already post-zoom under the global wrap)');
  assert.match(head, /Math\.ceil\(\s*\(\s*H\s*-\s*layout\.hudH\s*\)\s*\/\s*TILE\s*\)/,
    'drawWorld must compute viewport-tile-height as `Math.ceil((H - layout.hudH) / TILE)`');
  // Safety margins preserved.
  assert.match(head, /startX\s*=\s*Math\.max\(\s*0\s*,\s*Math\.floor\(\s*camX\s*\/\s*TILE\s*\)\s*-\s*1\s*\)/,
    'drawWorld must keep `startX = Math.max(0, Math.floor(camX/TILE) - 1)` safety margin');
  assert.match(head, /startY\s*=\s*Math\.max\(\s*0\s*,\s*Math\.floor\(\s*camY\s*\/\s*TILE\s*\)\s*-\s*1\s*\)/,
    'drawWorld must keep `startY = Math.max(0, Math.floor(camY/TILE) - 1)` safety margin');
  assert.match(head, /startX\s*\+\s*[a-zA-Z_$][\w$]*\s*\+\s*2/,
    'drawWorld endX must keep the `+ 2` safety margin');
  assert.match(head, /startY\s*\+\s*[a-zA-Z_$][\w$]*\s*\+\s*2/,
    'drawWorld endY must keep the `+ 2` safety margin');
  // Forbid the pre-global-UI-zoom shape that divided by an extra zoom.
  assert.doesNotMatch(head, /\(\s*W\s*\/\s*[a-zA-Z_$][\w$]*\s*\)\s*\/\s*TILE/,
    'drawWorld must NOT divide W by zoom before /TILE (would compound to zoom²)');
});

test('drawThreatIndicators uses plain W and (H-hudH) for view bounds AND projects arrows in logical coords (no per-zoom multiply) AND keeps screen-edge clamp', () => {
  // Pre-global-UI-zoom this had `W/zoom`/`H/zoom` divides + a `*zoom`
  // arrow projection. Under the global wrap, both must disappear:
  // viewport bounds are already post-zoom, and arrow projection in
  // logical coords is just `e.x*TILE - camX` (no multiply). The
  // screen-edge clamp stays — without it arrows can leak off-canvas.
  const fnIdx = RENDER_NC.search(/\bfunction\s+drawThreatIndicators\s*\(/);
  assert.ok(fnIdx >= 0, 'must find drawThreatIndicators');
  const head = RENDER_NC.slice(fnIdx, fnIdx + 2000);
  // viewR uses (camX + W) / TILE — no per-zoom divide.
  assert.match(head, /viewR\s*=\s*\(\s*camX\s*\+\s*W\s*\)\s*\/\s*TILE/,
    'drawThreatIndicators viewR must be `(camX + W) / TILE` (W is already post-zoom)');
  assert.match(head, /viewB\s*=\s*\(\s*camY\s*\+\s*H\s*-\s*layout\.hudH\s*\)\s*\/\s*TILE/,
    'drawThreatIndicators viewB must be `(camY + H - layout.hudH) / TILE`');
  // Arrow projection: plain `e.x * TILE - camX` (no per-zoom multiply).
  assert.match(head, /\bsx\s*=\s*\(\s*e\.x\s*\*\s*TILE\s*-\s*camX\s*\)\s*;/,
    'drawThreatIndicators arrow sx must be `(e.x * TILE - camX)` with no per-zoom multiply');
  assert.match(head, /\bsy\s*=\s*\(\s*e\.y\s*\*\s*TILE\s*-\s*camY\s*\)\s*;/,
    'drawThreatIndicators arrow sy must be `(e.y * TILE - camY)` with no per-zoom multiply');
  // Forbid the pre-global-UI-zoom multiply shape.
  assert.doesNotMatch(head, /\(\s*e\.[xy]\s*\*\s*TILE\s*-\s*cam[XY]\s*\)\s*\*\s*[a-zA-Z_$]/,
    'drawThreatIndicators must NOT multiply arrow projection by zoom (would double-scale under the global wrap)');
  // Screen-edge clamp stays.
  assert.match(head, /clamp\(\s*sx\s*,\s*margin\s*,\s*W\s*-\s*margin\s*\)/,
    'drawThreatIndicators must clamp arrow cx to [margin, W - margin]');
  assert.match(head, /clamp\(\s*sy\s*,\s*margin\s*,\s*H\s*-\s*layout\.hudH\s*-\s*margin\s*\)/,
    'drawThreatIndicators must clamp arrow cy to [margin, H - layout.hudH - margin]');
});

// ─── Settings UI wiring ─────────────────────────────────────────────────────

test('updateSettings stepperRows includes worldZoom alongside minimapScale + textScale', () => {
  assert.match(GAME_NC, /\{\s*key:\s*['"]worldZoom['"]\s*,\s*steps:\s*WORLD_ZOOM_STEPS\s*\}/,
    'updateSettings stepperRows must include { key: "worldZoom", steps: WORLD_ZOOM_STEPS }');
});

test('renderSettings stepperLabels includes "WORLD ZOOM" alongside MINIMAP SIZE + TEXT SIZE', () => {
  assert.match(GAME_NC, /stepperLabels\s*=\s*\[\s*['"]MINIMAP SIZE['"]\s*,\s*['"]TEXT SIZE['"]\s*,\s*['"]WORLD ZOOM['"]\s*\]/,
    'renderSettings stepperLabels must include "WORLD ZOOM" as the third entry');
});

test('STEPPER_COUNT = 3 in BOTH updateSettings + renderSettings', () => {
  const counts = (GAME_NC.match(/const\s+STEPPER_COUNT\s*=\s*3\b/g) || []).length;
  assert.equal(counts, 2,
    `STEPPER_COUNT = 3 must appear EXACTLY twice in game.js (updateSettings + renderSettings); got ${counts}`);
});

test('worldZoom stepper change triggers a resize() call (so logical W/H refresh before next frame)', () => {
  // Without this, the user changes worldZoom and the next frame's
  // layout still uses the OLD logical W/H — pointer normalisation
  // would update immediately (it reads settings.worldZoom on every
  // event) but layout would lag a frame, producing a visible jump.
  // resize() fires on both keyboard AND mouse stepper change paths.
  // Each path sits inside its own `if (row.key === 'worldZoom')`
  // gate, so count occurrences of that gate followed by a resize()
  // call. Must be ≥ 2 (one per input path).
  const matches = GAME_NC.match(/row\.key\s*===\s*['"]worldZoom['"]\s*\)\s*\{\s*resize\(/g) || [];
  assert.ok(matches.length >= 2,
    `worldZoom stepper change must call resize() in BOTH the keyboard and mouse-click paths; got ${matches.length} occurrences of the gated resize() call`);
});

test('settings.resetAll() commit path triggers a resize() call (mobile-aware default may flip worldZoom)', () => {
  // settings.resetAll() restores the layout.compact-aware default,
  // which on a phone bumps worldZoom to 1.5×. Without re-firing
  // resize(), the next frame uses the old logical W/H and pointer
  // normalization fights the layout. Both reset paths (keyboard +
  // mouse) call resetAll() — both must call resize() afterwards.
  const matches = GAME_NC.match(/settings\.resetAll\(\)[\s\S]{0,400}?resize\(\)/g) || [];
  assert.ok(matches.length >= 2,
    `settings.resetAll() must be followed by a resize() call in BOTH keyboard and mouse reset paths; got ${matches.length}`);
});

// ─── REVIEWER HARDENING ─────────────────────────────────────────────────────

test('resize() recomputes W/H AFTER applyMobileFirstDefaults if worldZoom changed (codex r1: init-order race)', () => {
  // Codex r1 finding: applyMobileFirstDefaults() runs INSIDE resize()
  // and can mutate settings.worldZoom from 1.0 → 1.5 on a fresh
  // compact device. The W/H computation above happens BEFORE that
  // mutation. Without a post-default re-compute, the very first frame
  // renders with the new ctx.scale(1.5) wrap but the OLD 1.0×-sized
  // logical W/H, so menus draw at full-canvas size and clip 33% off
  // the canvas right/bottom edges. Pin the structural fix:
  // applyMobileFirstDefaults must be bracketed by zoom captures and
  // followed by a guarded re-compute.
  const fnIdx = PLATFORM_NC.search(/function\s+resize\s*\(\s*\)\s*\{/);
  const body = extractBody(PLATFORM_NC, fnIdx);
  assert.ok(body, 'must extract resize() body');
  // Capture the pre-call zoom value into a local.
  const beforeIdx = body.search(/_wzBefore\s*=\s*\(\s*settings[\s\S]{0,40}?worldZoom\s*\)\s*\|\|\s*1/);
  // Run the applicator.
  const applyIdx = body.search(/settings\.applyMobileFirstDefaults\s*\(\s*\)/);
  // Capture the post-call zoom value.
  const afterIdx = body.search(/_wzAfter\s*=\s*\(\s*settings[\s\S]{0,40}?worldZoom\s*\)\s*\|\|\s*1/);
  // Compare and re-compute.
  const compareIdx = body.search(/_wzAfter\s*!==\s*_wzBefore/);
  assert.ok(beforeIdx >= 0, 'resize() must capture pre-call worldZoom into _wzBefore');
  assert.ok(applyIdx >= 0, 'resize() must call settings.applyMobileFirstDefaults()');
  assert.ok(afterIdx >= 0, 'resize() must capture post-call worldZoom into _wzAfter');
  assert.ok(compareIdx >= 0, 'resize() must compare _wzAfter !== _wzBefore');
  assert.ok(beforeIdx < applyIdx,
    'resize() must capture _wzBefore BEFORE applyMobileFirstDefaults() (otherwise both captures see the post-mutation value and the guard never fires)');
  assert.ok(applyIdx < afterIdx,
    'resize() must capture _wzAfter AFTER applyMobileFirstDefaults() (otherwise both captures see the pre-mutation value)');
  assert.ok(compareIdx > afterIdx,
    'resize() must compare _wzAfter !== _wzBefore AFTER both captures');
  // The recompute branch must redo W/H with the NEW zoom AND re-call updateLayout
  // so layout.compact tracks the new W (it could flip in edge cases).
  const guardedBlock = body.slice(compareIdx, compareIdx + 500);
  assert.match(guardedBlock, /W\s*=\s*Math\.max\(\s*1\s*,\s*Math\.round\(\s*rawW\s*\/\s*_wzAfter\s*\)\s*\)/,
    'guarded recompute must redo W = Math.max(1, Math.round(rawW / _wzAfter))');
  assert.match(guardedBlock, /H\s*=\s*Math\.max\(\s*1\s*,\s*Math\.round\(\s*rawH\s*\/\s*_wzAfter\s*\)\s*\)/,
    'guarded recompute must redo H = Math.max(1, Math.round(rawH / _wzAfter))');
  assert.match(guardedBlock, /\bupdateLayout\s*\(\s*\)/,
    'guarded recompute must call updateLayout() so layout.compact tracks the new W');
});

test('render() global-wrap save/scale/restore is balanced via try/finally (gpt-5.5 r1: leaks on render exception)', () => {
  // gpt-5.5 r1 finding: the main loop catches render exceptions and
  // continues (engine/render-boundary.js + game.js:5760-5774). Without
  // a try/finally around the global ctx.save+scale, a thrown renderer
  // leaves the canvas state stack scaled. The next frame's wrap then
  // compounds atop the leaked transform AND the drawErrorOverlay at
  // line 5773 also draws under the leaked transform. Pin the
  // structural shape: the save+scale must be paired with the matching
  // restore inside a `finally` block, both gated on the SAME
  // `_uiScaled` flag.
  const fnIdx = GAME_NC.search(/\brender\s*\(\s*\)\s*\{/);
  const body = extractBody(GAME_NC, fnIdx);
  // try block must exist after the save+scale.
  const saveIdx = body.search(/if\s*\(\s*_uiScaled\s*\)\s*\{\s*ctx\.save\(\s*\)\s*;\s*ctx\.scale/);
  const tryIdx  = body.search(/\btry\s*\{/);
  const finIdx  = body.search(/\}\s*finally\s*\{/);
  const restoreIdx = body.search(/\}\s*finally\s*\{[\s\S]{0,200}?if\s*\(\s*_uiScaled\s*\)\s*\{\s*ctx\.restore\(/);
  assert.ok(saveIdx >= 0, 'render() must open `if (_uiScaled) { ctx.save(); ctx.scale(...) }`');
  assert.ok(tryIdx >= 0, 'render() must open a `try {` block');
  assert.ok(finIdx >= 0, 'render() must contain a `} finally {` block');
  assert.ok(restoreIdx >= 0,
    'render() finally block must contain `if (_uiScaled) { ctx.restore() }` — the matching restore must be gated on the SAME flag as the save (both-or-neither, never half-balanced)');
  assert.ok(saveIdx < tryIdx,
    'save+scale MUST appear BEFORE the try block (otherwise an early-frame exception in the save itself bypasses the cleanup)');
  assert.ok(tryIdx < finIdx,
    'try block MUST appear before the finally clause');
});
