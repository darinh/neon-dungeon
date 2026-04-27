'use strict';
// CRT MODE — cosmetic graphics toggle.
//
// CRT MODE adds a scanline + vignette overlay rendered AFTER all game
// draw passes. Default OFF, persists via the existing localStorage
// settings blob, exposed in the SETTINGS menu as a 5th toggle row.
//
// Pure visual — zero gameplay impact. Wiring asserted via source-text
// regex (game.js + platform.js are browser-only — no UMD/CommonJS
// exports — same pattern as sapper / spectre / magpie tests).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PLATFORM = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'platform.js'), 'utf8'
);
const GAME = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8'
);
const SW = fs.readFileSync(
  path.resolve(__dirname, '..', 'sw.js'), 'utf8'
);

// ─── Settings field ─────────────────────────────────────────────────────

test('crtMode field exists in settings with default false', () => {
  // Default off so existing players see no change after upgrade —
  // it's an opt-in cosmetic, not a forced restyle.
  assert.match(PLATFORM, /crtMode:\s*false/,
    'settings.crtMode must default to false');
});

test('crtMode is loaded from localStorage with boolean type guard', () => {
  // Same pattern as screenShake/damageNumbers — only accept booleans
  // to avoid arbitrary localStorage corruption flipping the toggle.
  assert.match(PLATFORM, /typeof raw\.crtMode === 'boolean'/,
    'settings.load() must type-guard raw.crtMode');
});

test('crtMode is persisted by save()', () => {
  // The save block writes a single JSON object — crtMode must be in
  // the keys list or it will be silently dropped on reload.
  const saveBlock = PLATFORM.match(/save\(\)\s*\{[\s\S]*?\},\s*resetAll/);
  assert.ok(saveBlock, 'save() block must be findable');
  assert.match(saveBlock[0], /crtMode:\s*this\.crtMode/,
    'save() must persist crtMode');
});

test('crtMode is restored to false by resetAll()', () => {
  // resetAll() is the "Reset Defaults" row — it should restore crtMode
  // to its default OFF state, not leave the previous value sticky.
  const resetBlock = PLATFORM.match(/resetAll\(\)\s*\{[\s\S]*?\}/);
  assert.ok(resetBlock, 'resetAll() block must be findable');
  assert.match(resetBlock[0], /this\.crtMode\s*=\s*false/,
    'resetAll() must reset crtMode to false');
});

// ─── Settings UI wiring ────────────────────────────────────────────────

test('CRT MODE appears as a settings toggle in renderSettings', () => {
  // The label is what the player sees in the SETTINGS menu — must
  // be present in the renderSettings toggleLabels array.
  assert.match(GAME, /toggleLabels\s*=\s*\[[^\]]*'CRT MODE'[^\]]*\]/,
    'renderSettings toggleLabels must include CRT MODE');
});

test('crtMode key wired in BOTH updateSettings and renderSettings', () => {
  // The toggleKeys array appears twice — once in updateSettings (for
  // input handling) and once in renderSettings (for display). They
  // MUST stay in sync or clicking ON/OFF would toggle a different
  // setting than it displays.
  const occurrences = GAME.match(/toggleKeys\s*=\s*\[[^\]]*'crtMode'[^\]]*\]/g);
  assert.ok(occurrences && occurrences.length === 2,
    `crtMode must appear in BOTH toggleKeys arrays (updateSettings + renderSettings); found ${occurrences ? occurrences.length : 0}`);
});

test('CTRL_START bumped to 7 to make room for the 5th toggle', () => {
  // CTRL_START is the row index where key-rebind rows begin. With 2
  // sliders + 5 toggles it must be 7. If left at 6, the AIM ASSIST
  // and CRT MODE rows would overlap the first control rebind row,
  // making both unclickable on touch and producing visual stomping.
  // It appears twice — updateSettings + renderSettings — and both
  // must agree.
  const matches = GAME.match(/CTRL_START\s*=\s*7/g);
  assert.ok(matches && matches.length === 2,
    `CTRL_START must be 7 in BOTH updateSettings and renderSettings; found ${matches ? matches.length : 0}`);
});

// ─── Render pipeline integration ───────────────────────────────────────

test('drawCrtOverlay is invoked from render() gated on settings.crtMode', () => {
  // The overlay must run AFTER the state switch so it covers MENU,
  // PLAYING, GAME_OVER, etc. uniformly. The gate is critical — if
  // unconditional, it would force the effect on every player.
  assert.match(GAME, /if\s*\(\s*settings\.crtMode\s*\)\s*drawCrtOverlay\s*\(\s*\)/,
    'render() must call drawCrtOverlay gated on settings.crtMode');
});

test('drawCrtOverlay function is defined at module scope', () => {
  assert.match(GAME, /function\s+drawCrtOverlay\s*\(/,
    'drawCrtOverlay must be a module-scope function');
});

test('CRT cache invalidates on canvas resize', () => {
  // The cached scanline pattern + vignette gradient are sized to W,H.
  // If W/H change (mobile orientation flip, browser resize) and the
  // cache isn't rebuilt, the overlay would be stretched / clipped.
  // Defensive check on every draw avoids a dedicated resize hook.
  assert.match(GAME, /_crtCache\.w\s*!==\s*W\s*\|\|\s*_crtCache\.h\s*!==\s*H/,
    'drawCrtOverlay must rebuild cache when W/H change');
});

test('CRT overlay uses cached pattern + gradient (no per-frame allocation in hot path)', () => {
  // Render runs every frame. Building a CanvasPattern or RadialGradient
  // every frame would create GC churn. The cache exists for this reason —
  // verify the pattern + vignette are stored on _crtCache, not freshly
  // created inside drawCrtOverlay's main draw block.
  assert.match(GAME, /_crtCache\s*=\s*\{[^}]*pattern:\s*null[^}]*vignette:\s*null/,
    '_crtCache must hold both pattern and vignette');
});

// ─── Service worker cache version ──────────────────────────────────────

test('sw.js cache version >= v193 (assets changed)', () => {
  // src/game.js, src/platform.js, sw.js itself — all in ASSETS — were
  // modified. Service worker MUST be bumped or returning users get
  // stale code and the toggle never appears.
  const m = SW.match(/neon-dungeon-v(\d+)/);
  assert.ok(m, 'sw.js must declare a versioned cache name');
  assert.ok(parseInt(m[1], 10) >= 193,
    `sw cache version must be >= 193; found v${m[1]}`);
});
