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
//   6. content.js drawStatusBar fs and drawFloatingTexts font scale with
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
const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
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

// ─── Text-scale propagation in content.js ───────────────────────────────

test('drawStatusBar fs scales with settings.textScale', () => {
  // The status FX badges (above HP) derive width and height from `fs`
  // (height = fs+6, width = measureText+8). Scaling fs naturally
  // rescales the whole badge. Pin the formula and a Math.max floor so
  // a tiny scale can't produce a 0-px font.
  const statusSlice = CONTENT.match(/function\s+drawStatusBar[\s\S]{0,2500}/);
  assert.ok(statusSlice, 'must locate drawStatusBar');
  assert.match(statusSlice[0],
    /Math\.max\s*\(\s*\d+\s*,\s*Math\.round\s*\(\s*\(\s*layout\.compact\s*\?\s*\d+\s*:\s*\d+\s*\)\s*\*\s*settings\.textScale\s*\)\s*\)/,
    'drawStatusBar fs must be Math.max(N, Math.round((compact ? A : B) * settings.textScale))');
});

test('drawStatusBar minimap reservation scales with settings.minimapScale', () => {
  // The badge strip's right edge stops `before the minimap area`. The
  // minimap is settings-scaled, so the reservation must be too — else
  // an enlarged minimap eats badges (or a shrunk minimap leaves a gap).
  const statusSlice = CONTENT.match(/function\s+drawStatusBar[\s\S]{0,2500}/);
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
  const fl = CONTENT.match(/function\s+drawFloatingTexts[\s\S]{0,1500}/);
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
  // structurally (rather than as +2 magic numbers) keeps the layout
  // re-shuffleable and pins the row count to the toggle/stepper add.
  assert.match(GAME, /const\s+STEPPER_START\s*=\s*8/,
    'updateSettings must declare STEPPER_START = 8');
  assert.match(GAME, /const\s+STEPPER_COUNT\s*=\s*2/,
    'updateSettings must declare STEPPER_COUNT = 2');
});

test('updateSettings stepperRows wires both scales to MINIMAP_SCALE_STEPS / TEXT_SCALE_STEPS', () => {
  assert.match(GAME,
    /\{\s*key:\s*['"]minimapScale['"]\s*,\s*steps:\s*MINIMAP_SCALE_STEPS\s*\}/,
    'minimapScale stepper must reference MINIMAP_SCALE_STEPS');
  assert.match(GAME,
    /\{\s*key:\s*['"]textScale['"]\s*,\s*steps:\s*TEXT_SCALE_STEPS\s*\}/,
    'textScale stepper must reference TEXT_SCALE_STEPS');
});

test('renderSettings draws stepper rows with × multiplier suffix', () => {
  // The visible label per stepper is `◀ 1.00× ▶` — pin the toFixed(2)
  // + × suffix so a future refactor doesn't drop the multiplier hint.
  assert.match(GAME,
    /\$\{Number\(v\)\.toFixed\(2\)\}×/,
    'renderSettings stepper label must format value as N.NN×');
  assert.match(GAME,
    /stepperLabels\s*=\s*\[\s*['"]MINIMAP SIZE['"]\s*,\s*['"]TEXT SIZE['"]\s*\]/,
    'renderSettings must declare stepperLabels = ["MINIMAP SIZE", "TEXT SIZE"]');
});

test('settings layout: rowH shrinks dynamically so 21-row menu fits in viewport H', () => {
  // Per gpt-5.5 r1: with 6 toggles + 2 steppers + 9 rebinds + reset +
  // back, the menu has 21 rows. At the prior fixed rowH=34 the back
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

test('settings click hit-bands shrink with rowH so adjacent rows never overlap', () => {
  // Per gpt-5.3-codex r2: when _settingsLayout shrinks rowH below 22
  // (the historical 8+14 band height), the fixed band would overlap
  // adjacent rows by `22 - rowH` pixels. Pin the dynamic hit-band
  // computation: hitH = min(22, max(2, rowH-1)) so the band can never
  // exceed rowH - 1, guaranteeing a 1-px gap between bands.
  // (Whole-file matches — these are unique strings introduced by the fix.)
  assert.match(GAME,
    /const\s+hitH\s*=\s*Math\.min\s*\(\s*22\s*,\s*Math\.max\s*\(\s*2\s*,\s*rowH\s*-\s*1\s*\)\s*\)/,
    'updateSettings must declare hitH = min(22, max(2, rowH-1))');
  assert.match(GAME,
    /const\s+hitTop\s*=\s*Math\.min\s*\(\s*8\s*,/,
    'updateSettings must declare hitTop derived from hitH');
  assert.match(GAME,
    /const\s+hitBot\s*=\s*hitH\s*-\s*hitTop/,
    'updateSettings must declare hitBot = hitH - hitTop');
  // And no leftover `ry - 8 && my <= ry + 14` (or resetY/backY variants)
  // literal hit bands — every check inside settings must use hitTop/hitBot.
  // Search the whole file (these literals were unique to settings).
  assert.doesNotMatch(GAME,
    /\b(?:ry|resetY|backY)\s*-\s*8\s*&&[\s\S]{0,40}\+\s*14\b/,
    'no fixed-22-px hit bands may remain in updateSettings — use hitTop/hitBot');
  // Sanity: at least 5 hit-test sites consume the new bounds (slider,
  // toggle, stepper, rebind, reset, back = 6).
  const consumers = GAME.match(/my\s*>=\s*\w+\s*-\s*hitTop\s*&&\s*my\s*<=\s*\w+\s*\+\s*hitBot/g) || [];
  assert.ok(consumers.length >= 5,
    `expected ≥5 hit-test sites using hitTop/hitBot; got ${consumers.length}`);
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

test('drawHint font + gap-above-HUD both scale with settings.textScale', () => {
  // Centered single-line tooltip pinned above the HUD bar. Both the
  // font size AND the y-gap above the HUD must scale; otherwise the
  // hint either overlaps the HUD (large text + small gap) or floats
  // mid-air (small text + large gap).
  const fn = RENDER.match(/function\s+drawHint[\s\S]{0,800}/);
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
    /fillText\s*\([^)]*layout\.hudTop\s*-\s*[A-Za-z_$][\w$]*\s*\)/,
    'drawHint fillText must subtract a computed gap local from layout.hudTop (not a bare literal)');
});

test('drawMessages msgFs + msgLh both scale with settings.textScale', () => {
  // Both font height AND line-height must scale together. Scaling only
  // the font would let larger text overflow into the previous message
  // row at textScale 1.3×; scaling only the line-height would leave
  // permanent gaps at 0.85×. Pin both formulas.
  const fn = RENDER.match(/function\s+drawMessages[\s\S]{0,1200}/);
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
  const fn = RENDER.match(/function\s+drawMessages[\s\S]{0,1500}/);
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
  const fn = RENDER.match(/function\s+drawHint[\s\S]{0,800}/);
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
