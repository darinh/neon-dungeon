'use strict';
// settings-scale.test.js — coverage for the MINIMAP SIZE + TEXT SIZE
// accessibility settings (settings.minimapScale, settings.textScale).
//
// Tests cover:
//   1. settings module exposes the new fields with default 1.0 + the
//      canonical step lists are visible at module scope so the UI and
//      load() can both reference them
//   2. Snap-to-nearest-step coercion in load() defends against tampered
//      or stale localStorage values
//   3. resetAll restores both fields to 1.0
//   4. save() round-trips the fields through localStorage
//   5. render.js minimap helpers consume settings.minimapScale (corner
//      MW/MH derive from it; the cached canvas invalidates on size mismatch)
//   6. content/status.js drawStatusBar fs and content/effects.js drawFloatingTexts font scale with
//      settings.textScale
//   7. game.js settings UI declares the stepper rows + their wiring

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ─── Fake localStorage so platform.js can be require()'d in Node ────────
const _store = /** @type {Record<string,string>} */ ({});
/** @type {any} */ (globalThis).localStorage = {
  getItem: (k) => Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null,
  setItem: (k, v) => { _store[k] = String(v); },
  removeItem: (k) => { delete _store[k]; },
  clear: () => { for (const k of Object.keys(_store)) delete _store[k]; },
};
// document is consumed by other parts of platform.js but the settings
// surface alone doesn't need it. Stub minimally.
/** @type {any} */ (globalThis).document = /** @type {any} */ (globalThis).document || {
  getElementById: () => ({ getContext: () => ({}) }),
  createElement: () => ({ getContext: () => ({}) }),
  addEventListener: () => {},
};
/** @type {any} */ (globalThis).window = /** @type {any} */ (globalThis).window || {
  innerWidth: 900, innerHeight: 600,
  addEventListener: () => {},
  removeEventListener: () => {},
};

const PLATFORM = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'platform.js'), 'utf8'
);
const RENDER = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'render.js'), 'utf8'
);
const CONTENT_STATUS = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content', 'status.js'), 'utf8'
);
const CONTENT_EFFECTS = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content', 'effects.js'), 'utf8'
);
const GAME = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8'
);

// ─── Source-text pins on platform.js settings surface ────────────────────

test('settings exposes minimapScale + textScale defaulting to 1.0', () => {
  // Default 1.0 means no behaviour change for users who don't touch the
  // settings menu — drop-in safe.
  assert.match(PLATFORM, /minimapScale:\s*1\.0/,
    'settings.minimapScale must default to 1.0');
  assert.match(PLATFORM, /textScale:\s*1\.0/,
    'settings.textScale must default to 1.0');
});

test('canonical step lists MINIMAP_SCALE_STEPS / TEXT_SCALE_STEPS are declared at module scope', () => {
  // The UI and load() snapping both consume these arrays via the
  // cross-script-tag shared lexical environment. If either array is
  // renamed or scoped, the UI silently falls back to the wrong value
  // set or stops compiling. Pin the names + the literal contents.
  assert.match(PLATFORM, /const\s+MINIMAP_SCALE_STEPS\s*=\s*\[\s*0\.75\s*,\s*1\.0\s*,\s*1\.25\s*,\s*1\.5\s*\]/,
    'MINIMAP_SCALE_STEPS must be a top-level const = [0.75, 1.0, 1.25, 1.5]');
  assert.match(PLATFORM, /const\s+TEXT_SCALE_STEPS\s*=\s*\[\s*0\.85\s*,\s*1\.0\s*,\s*1\.15\s*,\s*1\.3\s*\]/,
    'TEXT_SCALE_STEPS must be a top-level const = [0.85, 1.0, 1.15, 1.3]');
});

test('settings.load snaps minimapScale + textScale to nearest step', () => {
  // Tamper-defence: a value of 0.93 is closer to 1.0 than to 0.85, so
  // textScale should snap to 1.0; a value of 1.4 is closer to 1.5 than
  // to 1.25 in the minimap list, so minimapScale should snap to 1.5.
  // Pin the snapToSteps helper exists and is used.
  assert.match(PLATFORM, /function\s+snapToSteps\s*\(/,
    'snapToSteps helper must exist');
  assert.match(PLATFORM, /this\.minimapScale\s*=\s*snapToSteps\s*\(\s*raw\.minimapScale\s*,\s*MINIMAP_SCALE_STEPS\s*\)/,
    'load() must snap raw.minimapScale via snapToSteps');
  assert.match(PLATFORM, /this\.textScale\s*=\s*snapToSteps\s*\(\s*raw\.textScale\s*,\s*TEXT_SCALE_STEPS\s*\)/,
    'load() must snap raw.textScale via snapToSteps');
});

test('settings.save persists both new fields', () => {
  // Without these in the JSON.stringify call, the values would be set
  // in-memory but lost on next session — silent UX bug.
  assert.match(PLATFORM, /minimapScale:\s*this\.minimapScale/,
    'save() must include minimapScale');
  assert.match(PLATFORM, /textScale:\s*this\.textScale/,
    'save() must include textScale');
});

test('settings.resetAll restores minimapScale + textScale to 1.0', () => {
  // The reset-defaults row in the settings menu must clear ALL fields,
  // not just the ones that existed when the row was added. New
  // accessibility settings must reset too or the defaults button gets
  // partially-stale over time.
  assert.match(PLATFORM, /this\.minimapScale\s*=\s*1\.0/,
    'resetAll() must reset minimapScale to 1.0');
  assert.match(PLATFORM, /this\.textScale\s*=\s*1\.0/,
    'resetAll() must reset textScale to 1.0');
});

// ─── Functional execution of the live settings module ──────────────────

test('live settings.load round-trips legal values + snaps illegal ones', () => {
  // Wipe storage, prime with edge-case values, reload, assert.
  _store['neonDungeonSettings'] = JSON.stringify({
    minimapScale: 1.4,    // closer to 1.5 → snap up
    textScale: 0.93,      // closer to 1.0 → snap up
  });
  // Reload module from cache via require's known location. Because
  // platform.js stuffs `settings` into the cross-script-tag lexical
  // environment via top-level `const`, we can't directly access it
  // from Node — but we CAN execute the file's text in a wrapper that
  // captures `settings`. That's what this helper does.
  const captured = runPlatformAndCaptureSettings(PLATFORM);
  assert.equal(captured.minimapScale, 1.5,
    `1.4 should snap up to 1.5; got ${captured.minimapScale}`);
  assert.equal(captured.textScale, 1.0,
    `0.93 should snap up to 1.0; got ${captured.textScale}`);
});

test('live settings.load defaults non-finite + missing values to 1.0', () => {
  _store['neonDungeonSettings'] = JSON.stringify({
    minimapScale: 'big',  // wrong type
    textScale: NaN,        // non-finite (becomes null in JSON; covered)
  });
  const captured = runPlatformAndCaptureSettings(PLATFORM);
  assert.equal(captured.minimapScale, 1.0,
    'wrong-type minimapScale should fall back to default 1.0');
  assert.equal(captured.textScale, 1.0,
    'non-finite textScale should fall back to default 1.0');
});

test('live settings.save then load restores both fields exactly', () => {
  // Set, save, then reload from the persisted JSON.
  _store['neonDungeonSettings'] = JSON.stringify({
    minimapScale: 0.75,
    textScale: 1.3,
  });
  const captured = runPlatformAndCaptureSettings(PLATFORM);
  assert.equal(captured.minimapScale, 0.75);
  assert.equal(captured.textScale, 1.3);
});

// ─── Minimap propagation in render.js ───────────────────────────────────

test('rebuildMinimapBase scales MW/MH by settings.minimapScale', () => {
  // The 120×80 base must be wrapped in Math.round(... * settings.minimapScale)
  // so the cached offscreen canvas matches the on-screen blit size.
  assert.match(RENDER,
    /const\s+MW\s*=\s*Math\.round\s*\(\s*120\s*\*\s*settings\.minimapScale\s*\)/,
    'rebuildMinimapBase must compute MW = round(120 * settings.minimapScale)');
  assert.match(RENDER,
    /const\s+MH\s*=\s*Math\.round\s*\(\s*80\s*\*\s*settings\.minimapScale\s*\)/,
    'rebuildMinimapBase must compute MH = round(80 * settings.minimapScale)');
});

test('rebuildMinimapBase invalidates cache when canvas size mismatches', () => {
  // Without this gate, scaling up between paints would keep the smaller
  // cached canvas and stretch it to the new MW/MH (blurred pixels).
  assert.match(RENDER,
    /off\.width\s*!==\s*MW\s*\|\|\s*off\.height\s*!==\s*MH/,
    'rebuildMinimapBase must drop the cached canvas when MW/MH changed');
});

test('drawMinimap MW/MH formulas match rebuildMinimapBase', () => {
  // Both functions independently compute MW/MH; if they drift, the
  // blit is sized differently from the cache canvas. Pin the same
  // formulas in both.
  // Count occurrences across RENDER — must appear at least twice each
  // (rebuildMinimapBase + drawMinimap; drawBoostStrip uses MH only).
  const mwHits = RENDER.match(/Math\.round\s*\(\s*120\s*\*\s*settings\.minimapScale\s*\)/g) || [];
  const mhHits = RENDER.match(/Math\.round\s*\(\s*80\s*\*\s*settings\.minimapScale\s*\)/g) || [];
  assert.ok(mwHits.length >= 2,
    `MW formula 'Math.round(120 * settings.minimapScale)' must appear ≥2 (rebuild + draw); got ${mwHits.length}`);
  assert.ok(mhHits.length >= 3,
    `MH formula 'Math.round(80 * settings.minimapScale)' must appear ≥3 (rebuild + draw + boost-strip anchor); got ${mhHits.length}`);
});

test('drawMinimap forces rebuild on canvas size mismatch', () => {
  // When the player toggles minimapScale mid-floor, drawMinimap detects
  // the size mismatch on the cached canvas and triggers rebuild via
  // the existing _minimapDirty path.
  assert.match(RENDER,
    /sizeMismatch[\s\S]{0,200}rebuildMinimapBase/,
    'drawMinimap must include sizeMismatch in the rebuild guard');
});

test('drawBoostStrip MH anchor scales with settings.minimapScale', () => {
  // The boost strip is positioned `8px below the corner minimap`. If
  // its MH stays at literal 80 while the minimap scales to 1.5×, the
  // boost pills render INSIDE the bigger minimap. Pin the formula.
  // Anchor: find the drawBoostStrip function, then check it uses the
  // settings-scaled MH.
  const boostSlice = RENDER.match(/function\s+drawBoostStrip[\s\S]{0,1500}\}/);
  assert.ok(boostSlice, 'must locate drawBoostStrip');
  assert.match(boostSlice[0],
    /Math\.round\s*\(\s*80\s*\*\s*settings\.minimapScale\s*\)/,
    'drawBoostStrip MH must use Math.round(80 * settings.minimapScale)');
});

// ─── Text-scale propagation in content/effects.js + content.js ──────────

test('drawStatusBar fs scales with settings.textScale', () => {
  // The status FX badges (above HP) derive width and height from `fs`
  // (height = fs+6, width = measureText+8). Scaling fs naturally
  // rescales the whole badge. Pin the formula and a Math.max floor so
  // a tiny scale can't produce a 0-px font.
  const statusSlice = CONTENT_STATUS.match(/function\s+drawStatusBar[\s\S]{0,2500}/);
  assert.ok(statusSlice, 'must locate drawStatusBar');
  assert.match(statusSlice[0],
    /Math\.max\s*\(\s*\d+\s*,\s*Math\.round\s*\(\s*\(\s*layout\.compact\s*\?\s*\d+\s*:\s*\d+\s*\)\s*\*\s*settings\.textScale\s*\)\s*\)/,
    'drawStatusBar fs must be Math.max(N, Math.round((compact ? A : B) * settings.textScale))');
});

test('drawStatusBar minimap reservation scales with settings.minimapScale', () => {
  // The badge strip's right edge stops `before the minimap area`. The
  // minimap is settings-scaled, so the reservation must be too — else
  // an enlarged minimap eats badges (or a shrunk minimap leaves a gap).
  const statusSlice = CONTENT_STATUS.match(/function\s+drawStatusBar[\s\S]{0,2500}/);
  assert.ok(statusSlice, 'must locate drawStatusBar');
  assert.match(statusSlice[0],
    /Math\.round\s*\(\s*120\s*\*\s*settings\.minimapScale\s*\)/,
    'drawStatusBar minimap reservation must use Math.round(120 * settings.minimapScale)');
});

test('drawFloatingTexts font scales with settings.textScale (and hoists the font string out of the loop)', () => {
  // Damage / pickup numbers. Base 15px multiplied by textScale. Floor
  // at a sane minimum so a tiny textScale doesn't produce 0px.
  // The assembled font string MUST be computed ONCE per call (cached
  // in a local) and assigned to ctx.font from that local inside the
  // loop — NOT a fresh template-literal per iteration. Per gpt-5.3-codex
  // r1 review: heavy combat (10+ floaters) churns GC otherwise.
  const fl = CONTENT_EFFECTS.match(/function\s+drawFloatingTexts[\s\S]{0,1500}/);
  assert.ok(fl, 'must locate drawFloatingTexts');
  assert.match(fl[0],
    /Math\.max\s*\(\s*\d+\s*,\s*Math\.round\s*\(\s*15\s*\*\s*settings\.textScale\s*\)\s*\)/,
    'drawFloatingTexts must compute fontPx via Math.max(N, Math.round(15 * settings.textScale))');
  // Pin the cached-string hoist: a `const fontStr = \`bold ...\`` line
  // BEFORE the for-loop, and `ctx.font = fontStr` (a bare identifier,
  // NOT a template literal) INSIDE the loop.
  assert.match(fl[0],
    /const\s+fontStr\s*=\s*`bold\s*\$\{fontPx\}px\s+monospace`/,
    'drawFloatingTexts must declare const fontStr = `bold ${fontPx}px monospace` once per call');
  // ctx.font assignment inside the loop must be the cached identifier,
  // not a fresh template literal. Use a tight regex that rejects ` after
  // the equals sign to make sure no per-iteration template snuck in.
  assert.match(fl[0],
    /ctx\.font\s*=\s*fontStr\s*;/,
    'drawFloatingTexts loop body must assign ctx.font = fontStr (the cached string), NOT a fresh template literal');
  assert.doesNotMatch(fl[0],
    /ctx\.font\s*=\s*`/,
    'drawFloatingTexts must NOT assign ctx.font directly from a template literal — that allocates per-iteration in the hot path');
});

// ─── Settings UI in game.js ─────────────────────────────────────────────

test('updateSettings declares STEPPER_START + STEPPER_COUNT for the scale rows', () => {
  // The stepper rows live between toggles and rebinds. Adding them
  // structurally (rather than as +N magic numbers) keeps the layout
  // re-shuffleable and pins the row count to the toggle/stepper add.
  // Bumped to 3 with the WORLD ZOOM stepper (mobile-first playfield zoom).
  assert.match(GAME, /const\s+STEPPER_START\s*=\s*8/,
    'updateSettings must declare STEPPER_START = 8');
  assert.match(GAME, /const\s+STEPPER_COUNT\s*=\s*3/,
    'updateSettings must declare STEPPER_COUNT = 3 (MINIMAP SIZE + TEXT SIZE + WORLD ZOOM)');
});

test('updateSettings stepperRows wires all three scales to the canonical step lists', () => {
  assert.match(GAME,
    /\{\s*key:\s*['"]minimapScale['"]\s*,\s*steps:\s*MINIMAP_SCALE_STEPS\s*\}/,
    'minimapScale stepper must reference MINIMAP_SCALE_STEPS');
  assert.match(GAME,
    /\{\s*key:\s*['"]textScale['"]\s*,\s*steps:\s*TEXT_SCALE_STEPS\s*\}/,
    'textScale stepper must reference TEXT_SCALE_STEPS');
  assert.match(GAME,
    /\{\s*key:\s*['"]worldZoom['"]\s*,\s*steps:\s*WORLD_ZOOM_STEPS\s*\}/,
    'worldZoom stepper must reference WORLD_ZOOM_STEPS');
});

test('renderSettings draws stepper rows with × multiplier suffix', () => {
  // The visible label per stepper is `◀ 1.00× ▶` — pin the toFixed(2)
  // + × suffix so a future refactor doesn't drop the multiplier hint.
  assert.match(GAME,
    /\$\{Number\(v\)\.toFixed\(2\)\}×/,
    'renderSettings stepper label must format value as N.NN×');
  assert.match(GAME,
    /stepperLabels\s*=\s*\[\s*['"]MINIMAP SIZE['"]\s*,\s*['"]TEXT SIZE['"]\s*,\s*['"]WORLD ZOOM['"]\s*\]/,
    'renderSettings must declare stepperLabels = ["MINIMAP SIZE", "TEXT SIZE", "WORLD ZOOM"]');
});

test('renderSettings gives every settings row a rounded control affordance', () => {
  const helper = GAME.match(/_drawSettingsControl\s*\([^)]*\)\s*\{[\s\S]{0,900}\},/);
  assert.ok(helper, 'renderSettings must use a shared settings-control drawing helper');
  assert.match(helper[0], /NEON\.draw\.roundRectFillStroke/,
    'settings controls must use the same rounded-card affordance as other menus');
  assert.match(GAME, /this\._drawSettingsControl\(ry,\s*rowH,\s*isSel,\s*'#00f5ff'\)/,
    'volume slider rows must render as rounded controls');
  assert.match(GAME, /this\._drawSettingsControl\(ry,\s*rowH,\s*isSel,\s*on\s*\?\s*'#00ff88'\s*:\s*'#ff4466'\)/,
    'toggle rows must render as rounded controls with on/off accents');
  assert.match(GAME, /this\._drawSettingsControl\(ry,\s*rowH,\s*isSel,\s*'#ffcc00'\)/,
    'scale stepper rows must render as rounded controls');
  assert.match(GAME, /this\._drawSettingsControl\(ry,\s*rowH,\s*isSel\s*\|\|\s*isCapturing,\s*isCapturing\s*\?\s*'#ffcc00'\s*:\s*'#ff00c8'\)/,
    'keybind rows must render as rounded controls');
  assert.match(GAME, /this\._drawSettingsControl\(resetY,\s*rowH,\s*sel\s*===\s*resetIdx\s*\|\|\s*armed,\s*armed\s*\?\s*'#ff4466'\s*:\s*'#ffcc00',\s*armed\)/,
    'reset row must render as a rounded control, including danger styling when armed');
  assert.match(GAME, /this\._drawSettingsControl\(backY,\s*rowH,\s*sel\s*===\s*backIdx,\s*'#00f5ff'\)/,
    'back row must render as a rounded control');
});

test('settings layout: rowH shrinks dynamically so 22-row menu fits in viewport H', () => {
  // Per gpt-5.5 r1: with 6 toggles + 3 steppers + 9 rebinds + reset +
  // back, the menu has 22 rows. At the prior fixed rowH=34 the back
  // row landed at y=780 — off-screen on common 720-logical-pixel
  // landscape windows. Shared helper `_settingsLayout` shrinks rowH
  // to fit `H`. Both render + update consume it.
  assert.match(GAME, /_settingsLayout\s*\(\s*totalRows\s*\)/g,
    'updateSettings + renderSettings must call this._settingsLayout(totalRows)');
  // Helper itself: must (a) cap at the historical desiredRowH, (b)
  // floor by `floor((H - startY - navMargin) / span)`, (c) declare
  // narrow + wide branches.
  const helperSlice = GAME.match(/_settingsLayout\s*\([^)]*\)\s*\{[\s\S]{0,1200}\},/);
  assert.ok(helperSlice, 'must locate _settingsLayout method body');
  assert.match(helperSlice[0], /Math\.min\s*\(\s*desiredRowH\s*,\s*fitRowH\s*\)/,
    '_settingsLayout must cap rowH at desiredRowH (so tall windows keep legacy spacing)');
  assert.match(helperSlice[0], /Math\.floor\s*\(\s*\(\s*H\s*-\s*startY\s*-\s*navHintMargin\s*\)\s*\/\s*span\s*\)/,
    '_settingsLayout must compute fitRowH = floor((H - startY - navHintMargin) / span)');
  // Both branches must be declared (narrow + wide). Without the wide
  // branch, the dynamic shrink would only fire on portrait.
  assert.match(helperSlice[0], /narrow\s*\?\s*28\s*:\s*34/,
    '_settingsLayout must declare desiredRowH = narrow ? 28 : 34');
});

test('settings pointer hit-testing uses the same rounded control cards that render rows', () => {
  const hitHelper = GAME.match(/_settingsControlHit\s*\([^)]*\)\s*\{[\s\S]{0,500}\},/);
  assert.ok(hitHelper, 'settings input must expose a shared control-card hit helper');
  assert.match(hitHelper[0], /const\s+box\s*=\s*this\._settingsControlBox\(rowY,\s*rowH\)/,
    'settings hit-testing must consume the same _settingsControlBox geometry used by rendering');
  assert.match(hitHelper[0],
    /mx\s*>=\s*box\.x\s*&&\s*mx\s*<=\s*box\.x\s*\+\s*box\.w[\s\S]{0,80}my\s*>=\s*box\.y\s*&&\s*my\s*<=\s*box\.y\s*\+\s*box\.h/,
    'settings hit-testing must check all four rendered card edges');
  assert.doesNotMatch(GAME,
    /const\s+hitH\s*=\s*Math\.min\s*\(\s*22\s*,\s*Math\.max\s*\(\s*2\s*,\s*rowH\s*-\s*1\s*\)\s*\)/,
    'updateSettings must not keep the older vertical-only hit band after adopting visible card hit targets');
  assert.doesNotMatch(GAME,
    /const\s+hitTop\s*=\s*Math\.min\s*\(\s*8\s*,/,
    'updateSettings must not keep vertical-only hitTop bounds');
  assert.doesNotMatch(GAME,
    /const\s+hitBot\s*=\s*hitH\s*-\s*hitTop/,
    'updateSettings must not keep vertical-only hitBot bounds');
  // Every pointer-action row family must call the shared card hit helper:
  // sliders, toggles, steppers, rebinds, reset, and back.
  const consumers = GAME.match(/this\._settingsControlHit\(\w+,\s*rowH,\s*mx,\s*my\)/g) || [];
  assert.ok(consumers.length >= 6,
    `expected ≥6 settings card hit-test consumers; got ${consumers.length}`);
  assert.match(GAME,
    /if \(this\._settingsSliderHit\(ry, rowH, mx, my\)\) \{[\s\S]{0,400}\}\s*if \(this\._settingsControlHit\(ry, rowH, mx, my\)\) \{/,
    'slider rows set values only on the track (_settingsSliderHit) and otherwise just select the row by its card');
  assert.doesNotMatch(GAME,
    /my\s*>=\s*\w+\s*-\s*hitTop\s*&&\s*my\s*<=\s*\w+\s*\+\s*hitBot/,
    'no vertical-only settings row hit-tests may remain after card alignment');
});

test('renderSettings uses pause-menu-strength fill/stroke affordances for row controls', () => {
  const helper = GAME.match(/_drawSettingsControl\s*\([^)]*\)\s*\{[\s\S]{0,1200}\},/);
  assert.ok(helper, 'renderSettings must use a shared settings-control drawing helper');
  assert.match(GAME,
    /ctx\.fillStyle\s*=\s*selected[\s\S]{0,200}'rgba\(0,0,0,0\.36\)'/,
    'unselected settings controls should render with a visible dark card fill instead of text-only transparency');
  assert.match(helper[0], /'rgba\(170,170,204,0\.32\)'/,
    'unselected settings controls should keep a visible neutral stroke like pause/menu cards');
  assert.match(helper[0], /selected\s*\?\s*2\s*:\s*1/,
    'selected settings controls should strengthen their stroke weight');
});

test('updateSettings minimapScale change forces a minimap cache rebuild', () => {
  // Without setting _minimapDirty, the cached canvas at the OLD size
  // would persist until the next mutation event. Player would see a
  // wrong-sized minimap until they shot a CRACKED tile or descended.
  // The size-mismatch detector in drawMinimap catches it eventually,
  // but the dirty flag makes the rebuild happen on the very next paint.
  assert.match(GAME,
    /minimapScale[\s\S]{0,200}_minimapDirty\s*=\s*true/,
    'updateSettings must set _RG._minimapDirty = true when minimapScale changes');
});

// ─── Overlay-text scaling in render.js ──────────────────────────────────
// Follow-up coverage: PR #361 scaled drawStatusBar + drawFloatingTexts.
// This block extends settings.textScale to the four layout-safe overlay
// surfaces: LEVEL UP! flash, drawMessages stack, drawHint above the HUD,
// and the expanded-minimap title + close-hint.

test('LEVEL UP! flash text scales with settings.textScale', () => {
  // Centered overlay above the cyan flash. Layout-free (just centered
  // text), so direct font scaling is safe. Floor at 20px so 0.85× still
  // reads as a celebratory shout. Per "hot path discipline" memory the
  // assignment site is a one-shot per level-up so no hoist needed.
  const block = RENDER.match(/player\.levelFlash>0\.5[\s\S]{0,500}LEVEL UP![\s\S]{0,200}/);
  assert.ok(block, 'must locate the LEVEL UP! text branch');
  assert.match(block[0],
    /Math\.max\s*\(\s*\d+\s*,\s*Math\.round\s*\(\s*36\s*\*\s*settings\.textScale\s*\)\s*\)/,
    'LEVEL UP! must compute font px via Math.max(N, Math.round(36 * settings.textScale))');
  // Pin: the assigned font string must reference the computed local,
  // not a hard-coded literal. A hard-coded "bold 36px" would silently
  // ignore the textScale setting.
  assert.match(block[0],
    /ctx\.font\s*=\s*`bold\s*\$\{[A-Za-z_$][\w$]*\}px\s+monospace`/,
    'LEVEL UP! ctx.font must reference the computed font-px local');
  assert.doesNotMatch(block[0],
    /ctx\.font\s*=\s*['"]bold\s+36px/,
    'LEVEL UP! must NOT use the hard-coded "bold 36px monospace" string — that ignores textScale');
});

/**
 * Full brace-matched source of a top-level function in render.js (fixed
 * character windows broke whenever a function grew).
 * @param {string} name
 * @returns {RegExpMatchArray}
 */
function renderFunctionBody(name) {
  const start = RENDER.search(new RegExp('function\\s+' + name + '\\s*\\('));
  assert.ok(start >= 0, 'must locate ' + name);
  let depth = 0;
  for (let i = RENDER.indexOf('{', start); i < RENDER.length; i++) {
    if (RENDER[i] === '{') depth++;
    else if (RENDER[i] === '}' && --depth === 0) return /** @type {RegExpMatchArray} */ ([RENDER.slice(start, i + 1)]);
  }
  assert.fail(name + ' unbalanced');
}

test('drawHint font + gap-above-HUD both scale with settings.textScale', () => {
  // Centered single-line tooltip pinned above the HUD bar. Both the
  // font size AND the y-gap above the HUD must scale; otherwise the
  // hint either overlaps the HUD (large text + small gap) or floats
  // mid-air (small text + large gap).
  const fn = renderFunctionBody('drawHint');
  assert.ok(fn, 'must locate drawHint');
  assert.match(fn[0],
    /Math\.max\s*\(\s*\d+\s*,\s*Math\.round\s*\(\s*15\s*\*\s*settings\.textScale\s*\)\s*\)/,
    'drawHint font px must scale via Math.max(N, Math.round(15 * settings.textScale))');
  assert.match(fn[0],
    /Math\.max\s*\(\s*\d+\s*,\s*Math\.round\s*\(\s*14\s*\*\s*settings\.textScale\s*\)\s*\)/,
    'drawHint gap must scale via Math.max(N, Math.round(14 * settings.textScale))');
  // Pin: the y-position for fillText subtracts the SCALED gap, not the
  // bare literal 14. A regression that hard-codes "- 14" while keeping
  // the scaled-gap local around would silently leak.
  assert.doesNotMatch(fn[0],
    /layout\.hudTop\s*-\s*14\b/,
    'drawHint must not hard-code "layout.hudTop - 14" — the gap must use the textScale-derived local');
  // Decoy-local defence (per gpt-5.3-codex review): a regression could
  // declare the scaled-font local but never assign it to ctx.font, or
  // declare the scaled-gap local but never subtract it in fillText.
  // Pin BOTH consumption sites so the locals can't be dead code.
  assert.match(fn[0],
    /ctx\.font\s*=\s*`\$\{[A-Za-z_$][\w$]*\}px\s+monospace`/,
    'drawHint ctx.font must reference a computed font-px local (template literal with bare identifier)');
  assert.match(fn[0],
    /layout\.hudTop\s*-\s*hGap\b/,
    'drawHint baseline must subtract the scaled gap local from layout.hudTop (not a bare literal)');
  assert.match(fn[0],
    /fillText\s*\(\s*h\.text\s*,\s*W\s*\/\s*2\s*,\s*hintY\s*\)/,
    'drawHint fillText must draw at the computed baseline local');
});

test('drawMessages msgFs + msgLh both scale with settings.textScale', () => {
  // Both font height AND line-height must scale together. Scaling only
  // the font would let larger text overflow into the previous message
  // row at textScale 1.3×; scaling only the line-height would leave
  // permanent gaps at 0.85×. Pin both formulas.
  const fn = renderFunctionBody('drawMessages');
  assert.ok(fn, 'must locate drawMessages');
  assert.match(fn[0],
    /msgFs\s*=\s*Math\.max\s*\(\s*\d+\s*,\s*Math\.round\s*\(\s*16\s*\*\s*settings\.textScale\s*\)\s*\)/,
    'drawMessages msgFs must scale via Math.max(N, Math.round(16 * settings.textScale))');
  assert.match(fn[0],
    /msgLh\s*=\s*Math\.max\s*\(\s*\d+\s*,\s*Math\.round\s*\(\s*22\s*\*\s*settings\.textScale\s*\)\s*\)/,
    'drawMessages msgLh must scale via Math.max(N, Math.round(22 * settings.textScale))');
  // Decoy-local defence (per gpt-5.3-codex review): pin that msgLh is
  // actually CONSUMED in the per-message Y-offset math. A regression
  // that keeps the formula but hard-codes "* 22" in the position would
  // satisfy the formula assertion and silently leak.
  assert.match(fn[0],
    /\(\s*messages\.length\s*-\s*1\s*-\s*i\s*\)\s*\*\s*msgLh/,
    'drawMessages per-message Y-offset must multiply by msgLh (not a bare literal)');
  assert.doesNotMatch(fn[0],
    /\(\s*messages\.length\s*-\s*1\s*-\s*i\s*\)\s*\*\s*22\b/,
    'drawMessages must not hard-code "* 22" in the Y-offset — that bypasses textScale');
});

test('drawMessages hoists the bold font string out of the loop', () => {
  // Hot-path discipline (per stored memory): drawMessages runs every
  // frame and, in heavy combat / pickup floods, can render multiple
  // active messages per frame. A per-iteration template literal would
  // churn GC. Pin: const fontStr = `bold ${...}px monospace` lives
  // BEFORE the for-loop, and the loop body assigns ctx.font = fontStr
  // (a bare identifier) — never `ctx.font = \`...\`` inside the loop.
  const fn = renderFunctionBody('drawMessages');
  assert.ok(fn, 'must locate drawMessages');
  assert.match(fn[0],
    /const\s+fontStr\s*=\s*`bold\s*\$\{msgFs\}px\s+monospace`[\s\S]{0,200}for\s*\(/,
    'drawMessages must declare const fontStr = `bold ${msgFs}px monospace` BEFORE the for-loop');
  assert.match(fn[0],
    /ctx\.font\s*=\s*fontStr\s*;/,
    'drawMessages loop body must assign ctx.font = fontStr (the cached identifier)');
  // The body must NOT contain a fresh template literal assigned to ctx.font.
  // Slice from the for-loop opener to the function close to scope the check
  // to the loop body only (the const declaration BEFORE the loop is allowed
  // to be a template literal — it's the per-iteration assignment that's banned).
  const forIdx = fn[0].indexOf('for (');
  const loopBody = forIdx >= 0 ? fn[0].slice(forIdx) : fn[0];
  assert.doesNotMatch(loopBody,
    /ctx\.font\s*=\s*`/,
    'drawMessages loop body must NOT assign ctx.font from a fresh template literal — that allocates per-iteration');
});

test('drawHint font + gap-above-HUD both scale with settings.textScale', () => {
  // Centered single-line tooltip pinned above the HUD bar. Both the
  // font size AND the y-gap above the HUD must scale; otherwise the
  // hint either overlaps the HUD (large text + small gap) or floats
  // mid-air (small text + large gap).
  const fn = renderFunctionBody('drawHint');
  assert.ok(fn, 'must locate drawHint');
  assert.match(fn[0],
    /Math\.max\s*\(\s*\d+\s*,\s*Math\.round\s*\(\s*15\s*\*\s*settings\.textScale\s*\)\s*\)/,
    'drawHint font px must scale via Math.max(N, Math.round(15 * settings.textScale))');
  assert.match(fn[0],
    /Math\.max\s*\(\s*\d+\s*,\s*Math\.round\s*\(\s*14\s*\*\s*settings\.textScale\s*\)\s*\)/,
    'drawHint gap must scale via Math.max(N, Math.round(14 * settings.textScale))');
  // Pin: the y-position for fillText subtracts the SCALED gap, not the
  // bare literal 14. A regression that hard-codes "- 14" while keeping
  // the scaled-gap local around would silently leak.
  assert.doesNotMatch(fn[0],
    /layout\.hudTop\s*-\s*14\b/,
    'drawHint must not hard-code "layout.hudTop - 14" — the gap must use the textScale-derived local');
});

test('expanded-minimap title + close-hint scale with settings.textScale', () => {
  // The expanded minimap is a centered overlay; title sits ABOVE the
  // map card, close-hint sits BELOW. Both fonts scale with textScale.
  // The title's gap-above-card (22) also scales so a 1.3× title can
  // never collide with the map frame.
  const fn = RENDER.match(/function\s+drawExpandedMinimap[\s\S]{0,15000}\n\}/);
  assert.ok(fn, 'must locate drawExpandedMinimap');
  assert.match(fn[0],
    /Math\.max\s*\(\s*\d+\s*,\s*Math\.round\s*\(\s*14\s*\*\s*settings\.textScale\s*\)\s*\)/,
    'expanded minimap title font must scale via Math.max(N, Math.round(14 * settings.textScale))');
  assert.match(fn[0],
    /Math\.max\s*\(\s*\d+\s*,\s*Math\.round\s*\(\s*22\s*\*\s*settings\.textScale\s*\)\s*\)/,
    'expanded minimap title gap must scale via Math.max(N, Math.round(22 * settings.textScale))');
  assert.match(fn[0],
    /Math\.max\s*\(\s*\d+\s*,\s*Math\.round\s*\(\s*11\s*\*\s*settings\.textScale\s*\)\s*\)/,
    'expanded minimap close-hint font must scale via Math.max(N, Math.round(11 * settings.textScale))');
  // Pin: bare-literal "bold 14px" + "11px" + "my - 22" must be gone in
  // the title/hint section — those would silently ignore textScale.
  // We scope to the title block to avoid flagging similar strings used
  // elsewhere in the function (room labels etc).
  const titleBlock = fn[0].match(/Title \+ hint[\s\S]{0,800}/);
  assert.ok(titleBlock, 'must locate the Title + hint block in drawExpandedMinimap');
  assert.doesNotMatch(titleBlock[0],
    /ctx\.font\s*=\s*['"]bold\s+14px/,
    'expanded minimap title must not hard-code "bold 14px monospace"');
  assert.doesNotMatch(titleBlock[0],
    /ctx\.font\s*=\s*['"]11px/,
    'expanded minimap close-hint must not hard-code "11px monospace"');
  assert.doesNotMatch(titleBlock[0],
    /my\s*-\s*22\b/,
    'expanded minimap title must not hard-code "my - 22" — the gap must use the textScale-derived local');
});

// ─── HUD-float text scaling: key indicators + boss-bar ─────────────────
// Follow-up coverage: extend settings.textScale to the three remaining
// HUD-text floats — the key indicators row above the HUD bar, the boss
// name above the boss HP bar, and the HP/phase readout below it. None
// of them drive layout boxes (the HP bar geometry is intentionally NOT
// text-scaled — it's a graphical indicator), so they're safe to scale
// without an HUD overhaul.

test('key indicator font + gap-above-HUD + horizontal stride scale with settings.textScale', () => {
  // Found above the HUD bar when the player carries any keys. The font
  // (12), the y-gap above the HUD (18), AND the per-token x-stride
  // (55) all need to scale together — otherwise the row either
  // overlaps the HUD/status badges (large font + small gap) or
  // adjacent key tokens collide (large font + small stride).
  // Match a generous slice around the 'Key indicators' comment so we
  // pin the right block (drawHUD has multiple `if (hasKeys)` siblings).
  const block = RENDER.match(/Key indicators[\s\S]{0,2000}?ctx\.restore\(\);\s*\}/);
  assert.ok(block, 'must locate the Key indicators block in drawHUD');
  // Producer-side: pin EACH scale formula bound to its EXACT canonical
  // identifier. Per gpt-5.3-codex r1: independent formula+consumer
  // assertions can be bypassed by declaring a real scaled local AND a
  // decoy literal local, then wiring the literal to the sink. Binding
  // each producer to its named identifier closes that bypass class.
  assert.match(block[0],
    /const\s+keyFs\s*=\s*Math\.max\s*\(\s*\d+\s*,\s*Math\.round\s*\(\s*12\s*\*\s*settings\.textScale\s*\)\s*\)/,
    'keyFs must be assigned the canonical Math.max(N, Math.round(12 * settings.textScale)) formula');
  assert.match(block[0],
    /const\s+keyGap\s*=\s*Math\.max\s*\(\s*\d+\s*,\s*Math\.round\s*\(\s*18\s*\*\s*settings\.textScale\s*\)\s*\)/,
    'keyGap must be assigned the canonical Math.max(N, Math.round(18 * settings.textScale)) formula');
  assert.match(block[0],
    /const\s+keyStride\s*=\s*Math\.max\s*\(\s*\d+\s*,\s*Math\.round\s*\(\s*55\s*\*\s*settings\.textScale\s*\)\s*\)/,
    'keyStride must be assigned the canonical Math.max(N, Math.round(55 * settings.textScale)) formula');
  // Consumer-side: pin each sink to its EXACT producer identifier.
  // Decoy locals (e.g. `const keyFsBypass = 12; ctx.font = ...keyFsBypass...`)
  // cannot satisfy these assertions because the identifier must match.
  assert.match(block[0],
    /const\s+keyFontStr\s*=\s*`bold\s*\$\{keyFs\}px\s+monospace`/,
    'keyFontStr template must interpolate keyFs by exact name (bypass-resistant)');
  assert.match(block[0],
    /ctx\.font\s*=\s*keyFontStr\s*;/,
    'ctx.font must be assigned the keyFontStr identifier (no decoy local)');
  assert.match(block[0],
    /const\s+keyY\s*=\s*layout\.hudTop\s*-\s*keyGap\s*;/,
    'keyY must subtract keyGap (the scaled gap) from layout.hudTop');
  assert.match(block[0],
    /kx\s*\+=\s*keyStride\s*;/,
    'kx must increment by keyStride (the scaled stride)');
  // Sink-binding: pin that fillText actually uses keyY (the scaled
  // baseline) — closes the "decoy keyY2" bypass class identified by
  // gpt-5.3-codex r2 (a regression could keep keyY correct but render
  // with a different y derived from a literal gap).
  assert.match(block[0],
    /ctx\.fillText\s*\(\s*['"`]🔑×['"`]\s*\+\s*player\.keys\[col\]\s*,\s*kx\s*,\s*keyY\s*\)/,
    'ctx.fillText for the key indicator must render at keyY (the scaled baseline) — no decoy y-coord allowed');
  // Bare-literal regression bans (would silently ignore textScale).
  assert.doesNotMatch(block[0],
    /ctx\.font\s*=\s*['"]bold\s+12px/,
    'key indicator must not hard-code "bold 12px monospace"');
  assert.doesNotMatch(block[0],
    /layout\.hudTop\s*-\s*18\b/,
    'key indicator must not hard-code "layout.hudTop - 18" — the gap must use the textScale-derived local');
  assert.doesNotMatch(block[0],
    /kx\s*\+=\s*55\b/,
    'key indicator must not hard-code "kx += 55" — the stride must use the textScale-derived local');
});

test('key indicator hoists font string out of the for-loop (hot path discipline)', () => {
  // drawHUD runs every frame; the for-loop iterates up to 3 times
  // (red/blue/gold). Per stored "hot path discipline" memory, every
  // per-iteration template-literal alloc is GC churn. Pin: the bold
  // font string is cached in a const BEFORE the for-loop, and the
  // body assigns ctx.font = <identifier> — never a fresh template.
  const block = RENDER.match(/Key indicators[\s\S]{0,2000}?ctx\.restore\(\);\s*\}/);
  assert.ok(block, 'must locate the Key indicators block');
  assert.match(block[0],
    /const\s+keyFontStr\s*=\s*`bold\s*\$\{keyFs\}px\s+monospace`[\s\S]{0,200}for\s*\(/,
    'key indicator must declare const keyFontStr = `bold ${keyFs}px monospace` BEFORE the for-loop');
  // Loop body must not re-build a template.
  const forIdx = block[0].indexOf('for (');
  const loopBody = forIdx >= 0 ? block[0].slice(forIdx) : block[0];
  assert.doesNotMatch(loopBody,
    /ctx\.font\s*=\s*`/,
    'key indicator loop body must NOT assign ctx.font from a fresh template literal — that allocates per-iteration');
});

test('boss-bar name font + gap-above-bar scale with settings.textScale', () => {
  // Boss name floats above the slim 8px-tall HP bar. Bar geometry
  // (barW/barH/barX/barY) is intentionally NOT text-scaled — it's a
  // graphical indicator, not a text box. But the name (10px) and its
  // gap above the bar (3) must scale together so a 1.3× name stays
  // clear of the bar at every text size.
  const fn = RENDER.match(/function\s+drawBossBar[\s\S]{0,5000}^\}/m);
  assert.ok(fn, 'must locate drawBossBar');
  // Producer-side: pin each scaled local to its EXACT canonical name
  // and formula (bypass-resistant per gpt-5.3-codex r1).
  assert.match(fn[0],
    /const\s+nameFs\s*=\s*Math\.max\s*\(\s*\d+\s*,\s*Math\.round\s*\(\s*10\s*\*\s*settings\.textScale\s*\)\s*\)/,
    'nameFs must be assigned Math.max(N, Math.round(10 * settings.textScale))');
  assert.match(fn[0],
    /const\s+nameGap\s*=\s*Math\.max\s*\(\s*\d+\s*,\s*Math\.round\s*\(\s*3\s*\*\s*settings\.textScale\s*\)\s*\)/,
    'nameGap must be assigned Math.max(N, Math.round(3 * settings.textScale))');
  // Consumer-side: pin each sink to its EXACT producer identifier.
  assert.match(fn[0],
    /ctx\.font\s*=\s*`bold\s*\$\{nameFs\}px\s+monospace`/,
    'boss-bar name ctx.font template must interpolate nameFs by name (no decoy)');
  assert.match(fn[0],
    /fillText\s*\(\s*name\s*,\s*barCx\s*,\s*barY\s*-\s*nameGap\s*\)/,
    'boss-bar name fillText must subtract nameGap from barY (no decoy)');
  // Bare-literal regression bans.
  assert.doesNotMatch(fn[0],
    /ctx\.font\s*=\s*['"]bold\s+10px/,
    'boss-bar name must not hard-code "bold 10px monospace"');
  assert.doesNotMatch(fn[0],
    /barY\s*-\s*3\b/,
    'boss-bar name must not hard-code "barY - 3"');
});

test('boss-bar HP text font + gap-below-bar scale with settings.textScale', () => {
  // HP/phase readout floats below the bar. Both font (8) and gap (9)
  // must scale together — at 1.3× the 8→11px text would otherwise
  // crowd the unchanged 9px gap.
  const fn = RENDER.match(/function\s+drawBossBar[\s\S]{0,5000}^\}/m);
  assert.ok(fn, 'must locate drawBossBar');
  // Producer-side bind to canonical identifiers.
  assert.match(fn[0],
    /const\s+hpFs\s*=\s*Math\.max\s*\(\s*\d+\s*,\s*Math\.round\s*\(\s*8\s*\*\s*settings\.textScale\s*\)\s*\)/,
    'hpFs must be assigned Math.max(N, Math.round(8 * settings.textScale))');
  assert.match(fn[0],
    /const\s+hpGap\s*=\s*Math\.max\s*\(\s*\d+\s*,\s*Math\.round\s*\(\s*9\s*\*\s*settings\.textScale\s*\)\s*\)/,
    'hpGap must be assigned Math.max(N, Math.round(9 * settings.textScale))');
  // Consumer-side bind.
  assert.match(fn[0],
    /ctx\.font\s*=\s*`\$\{hpFs\}px\s+monospace`/,
    'boss-bar HP ctx.font template must interpolate hpFs by name');
  assert.match(fn[0],
    /fillText\s*\([^)]*barY\s*\+\s*barH\s*\+\s*hpGap\s*\)/,
    'boss-bar HP fillText must add hpGap to barY+barH (no decoy)');
  // Bare-literal regression bans.
  assert.doesNotMatch(fn[0],
    /ctx\.font\s*=\s*['"]8px/,
    'boss-bar HP text must not hard-code "8px monospace"');
  assert.doesNotMatch(fn[0],
    /barY\s*\+\s*barH\s*\+\s*9\b/,
    'boss-bar HP text must not hard-code "barY + barH + 9"');
});

test('drawStatusBar badge Y-offset scales with settings.textScale to track the scaled key indicator row', () => {
  // Per gpt-5.3-codex r1 review of this PR: scaling the key indicator
  // row in render.js without scaling drawStatusBar's badge anchor
  // produces a vertical collision at textScale 1.3× — the larger key
  // text top creeps into the badge row's bottom edge.
  // Both branches of the (hasKeys ? 32 : 16) ternary must scale so the
  // badge row tracks the key indicator row that drawHUD now scales.
  // Floors prevent collapse into the HUD at 0.85× (12) or into the
  // larger key row at 0.85× (24).
  const fn = CONTENT_STATUS.match(/function\s+drawStatusBar[\s\S]{0,3500}^\}/m);
  assert.ok(fn, 'must locate drawStatusBar');
  // Producer-side: pin the WHOLE assignment to its EXACT canonical name
  // `badgeYOffset` so a decoy `const _u1 = scaledFormula1; const _u2 =
  // scaledFormula2; const badgeYOffset = hasKeys ? 32 : 16;` cannot
  // bypass — the decoy would satisfy independent formula assertions
  // but the bound assignment requires the formula to be the actual RHS
  // of `badgeYOffset`. Closes the bypass class identified by claude-
  // opus-4.7 r2 (which proved the unparenthesized-ternary loophole).
  assert.match(fn[0],
    /const\s+badgeYOffset\s*=\s*hasKeys\s*\?\s*Math\.max\s*\(\s*24\s*,\s*Math\.round\s*\(\s*32\s*\*\s*settings\.textScale\s*\)\s*\)\s*:\s*Math\.max\s*\(\s*12\s*,\s*Math\.round\s*\(\s*16\s*\*\s*settings\.textScale\s*\)\s*\)/,
    'badgeYOffset must be the scaled ternary expression bound to its canonical name (bypass-resistant)');
  // Consumer-side: pin y to subtract the EXACT badgeYOffset identifier.
  assert.match(fn[0],
    /const\s+y\s*=\s*layout\.hudTop\s*-\s*badgeYOffset\s*;/,
    'y must subtract badgeYOffset by exact name (no decoy local)');
  // Bare-literal regression bans (catches a partial revert that drops
  // ONE branch of the ternary back to a literal — the bound producer
  // assertion above catches the WHOLE-ternary revert; these catch
  // partial reverts where someone refactors back via inline math).
  assert.doesNotMatch(fn[0],
    /\(\s*hasKeys\s*\?\s*32\s*:\s*16\s*\)/,
    'drawStatusBar must not retain the bare-literal (hasKeys ? 32 : 16) ternary');
  assert.doesNotMatch(fn[0],
    /hasKeys\s*\?\s*32\s*:\s*16/,
    'drawStatusBar must not contain ANY hasKeys?32:16 ternary form (parens or no parens)');
});

// ─── Helper: execute platform.js text and capture `settings` ────────────

/**
 * Execute platform.js source text in a controlled scope and capture the
 * `settings` binding. Mocks all browser globals platform.js touches so
 * the file can run end-to-end in Node without throwing.
 *
 * Why source-text execution instead of require()? `settings` is a
 * top-level `const` in a classic-script context (no module.exports), so
 * Node's CommonJS loader can't reach it. Using `node:vm` to run the
 * truncated source in a sandboxed context is the cleanest way to
 * exercise the live load() / save() / snap logic against a mocked
 * localStorage without a browser.
 *
 * @param {string} src
 */
function runPlatformAndCaptureSettings(src) {
  // Truncate at the end of `settings.load();` so we only execute the
  // settings surface — the rest of platform.js touches DOM-only APIs
  // (canvas/orientation/etc) we'd have to mock at much greater depth.
  const cut = src.indexOf('settings.load();');
  assert.ok(cut > 0, 'must find "settings.load();" anchor in platform.js');
  const tail = src.indexOf('\n', cut);
  const subset = src.slice(0, tail);
  // Run in a vm sandbox with the mocked localStorage available.
  const vm = require('node:vm');
  const sandbox = /** @type {any} */ ({
    localStorage: globalThis.localStorage,
    JSON, Math, Object, Array, String, Number, Boolean,
  });
  vm.createContext(sandbox);
  vm.runInContext(subset + '\nthis.__settings = settings;', sandbox);
  return sandbox.__settings;
}
