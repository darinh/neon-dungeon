// @ts-check
'use strict';
// Tests for engine/touch.js — pure helpers (toCanvas, hitBtn, resetTouch).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const touchEngine = require('../engine/touch.js');
const { computeLayout } = require('../engine/viewport.js');
const { toCanvas, hitBtn, resetTouch } = touchEngine;
const PLATFORM = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'platform.js'), 'utf8');
const GAME = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8');
const GAME_STATES_SRC = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'game-states.js'), 'utf8');

/**
 * @param {string} src
 * @param {string} name
 */
function extractObjectMethodSource(src, name) {
  const start = src.indexOf('\n  ' + name + '(');
  assert.ok(start >= 0, name + ' object method must exist');
  const methodStart = start + 3;
  const braceStart = src.indexOf('{', methodStart);
  assert.ok(braceStart > methodStart, name + ' object method must have a body');
  let depth = 0;
  for (let i = braceStart; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(methodStart, i + 1);
    }
  }
  assert.fail(name + ' object method body must be balanced');
}

/**
 * @param {string} src
 * @param {string} name
 */
function extractFunctionSource(src, name) {
  const start = src.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' function must exist');
  const braceStart = src.indexOf('{', start);
  assert.ok(braceStart > start, name + ' function must have a body');
  let depth = 0;
  for (let i = braceStart; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  assert.fail(name + ' function body must be balanced');
}

/**
 * @param {number} width
 * @param {number} height
 * @param {boolean} narrow
 */
function createNameEntryKeyboardHarness(width, height, narrow) {
  const source = 'return ({\n' +
    "  _vkChars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'.split(''),\n" +
    '  _vkCols: 10,\n' +
    '  ' + extractObjectMethodSource(GAME, '_vkLayout') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, '_vkHitTest') + '\n' +
    '});';
  return new Function('W', 'H', 'narrow', source)(width, height, narrow); // eslint-disable-line no-new-func
}

/**
 * @param {number} width
 * @param {number} height
 * @param {boolean} narrow
 */
function createSeedSetupLayoutHarness(width, height, narrow) {
  const source = 'return ({\n' +
    '  ' + extractObjectMethodSource(GAME, 'seedSetupLayout') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, 'seedSetupFieldHitTest') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, 'seedSetupHitTest') + '\n' +
    '});';
  return {
    harness: new Function(source)(), // eslint-disable-line no-new-func
    view: { W: width, H: height, narrow },
  };
}

/**
 * @param {number} width
 * @param {number} height
 * @param {boolean} narrow
 */
function createMessageSendLayoutHarness(width, height, narrow) {
  const runtimeCompact = computeLayout(width, height, 0).compact;
  assert.equal(narrow, runtimeCompact,
    `MESSAGE_SEND fixture ${width}x${height} narrow=${narrow} must match runtime compact=${runtimeCompact}`);
  const source = "const ACT1_MESSAGE_INTENTS = { length: 3 };\n" +
    extractFunctionSource(GAME, 'getMessageSendLayout') + '\n' +
    'return getMessageSendLayout(narrow);';
  return new Function('W', 'H', 'narrow', source)(width, height, narrow); // eslint-disable-line no-new-func
}

/**
 * @param {number} width
 * @param {number} height
 * @param {boolean} narrow
 */
function createPowerupChoiceLayoutHarness(width, height, narrow) {
  const runtimeCompact = computeLayout(width, height, 0).compact;
  assert.equal(narrow, runtimeCompact,
    `POWERUP_CHOICE fixture ${width}x${height} narrow=${narrow} must match runtime compact=${runtimeCompact}`);
  const source = extractFunctionSource(GAME, 'getPowerupChoiceLayout') + '\n' +
    'return getPowerupChoiceLayout(narrow);';
  return new Function('W', 'H', 'narrow', source)(width, height, narrow); // eslint-disable-line no-new-func
}

/**
 * @param {number} width
 * @param {number} height
 * @param {boolean} narrow
 */
function createShoppingLayoutHarness(width, height, narrow) {
  const runtimeCompact = computeLayout(width, height, 0).compact;
  assert.equal(narrow, runtimeCompact,
    `SHOPPING fixture ${width}x${height} narrow=${narrow} must match runtime compact=${runtimeCompact}`);
  const source = extractFunctionSource(GAME, 'getShoppingLayout') + '\n' +
    'return getShoppingLayout(narrow);';
  return new Function('W', 'H', 'narrow', source)(width, height, narrow); // eslint-disable-line no-new-func
}

/**
 * @param {number} width
 * @param {number} height
 * @param {boolean} narrow
 */
function createWeaponSwapLayoutHarness(width, height, narrow) {
  const runtimeCompact = computeLayout(width, height, 0).compact;
  assert.equal(narrow, runtimeCompact,
    `WEAPON_SWAP fixture ${width}x${height} narrow=${narrow} must match runtime compact=${runtimeCompact}`);
  const source = extractFunctionSource(GAME, 'getWeaponSwapLayout') + '\n' +
    'return getWeaponSwapLayout(narrow);';
  return new Function('W', 'H', 'narrow', source)(width, height, narrow); // eslint-disable-line no-new-func
}

/**
 * @param {number} width
 * @param {number} height
 * @param {boolean} narrow
 */
function createSettingsControlHarness(width, height, narrow) {
  const runtimeCompact = computeLayout(width, height, 0).compact;
  assert.equal(narrow, runtimeCompact,
    `SETTINGS fixture ${width}x${height} narrow=${narrow} must match runtime compact=${runtimeCompact}`);
  const source = 'return ({\n' +
    '  ' + extractObjectMethodSource(GAME, '_settingsLayout') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, '_settingsControlBox') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, '_settingsControlHit') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, '_settingsSliderTrack') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, '_settingsSliderHit') + '\n' +
    '});';
  return new Function('W', 'H', 'layout', source)(width, height, { compact: narrow }); // eslint-disable-line no-new-func
}

/**
 * @param {number} width
 * @param {number} height
 * @param {boolean} narrow
 * @returns {{harness:any, mouse:{x:number,y:number,down:boolean}, settings:any, audio:{sfx:number[],music:number[],menu:number}, justPressed:Set<string>}}
 */
function createSettingsUpdateHarness(width, height, narrow) {
  const runtimeCompact = computeLayout(width, height, 0).compact;
  assert.equal(narrow, runtimeCompact,
    `SETTINGS fixture ${width}x${height} narrow=${narrow} must match runtime compact=${runtimeCompact}`);
  const source = "const DEFAULT_KEY_MAP = {\n" +
    "  up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', interact: 'KeyE',\n" +
    "  hackware: 'KeyF', voidshard: 'KeyV', dash: 'ShiftLeft', shoot: 'Space'\n" +
    "};\n" +
    'const MINIMAP_SCALE_STEPS = [0.75, 1.0, 1.25, 1.5];\n' +
    'const TEXT_SCALE_STEPS = [0.85, 1.0, 1.15, 1.3];\n' +
    'const WORLD_ZOOM_STEPS = [1.0, 1.25, 1.5, 1.75, 2.0];\n' +
    'const RESET_CONFIRM_WINDOW_MS = 2500;\n' +
    "const ALT_KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };\n" +
    'const RESERVED_KEYS = new Set();\n' +
    'const justPressed = new Set([\'MouseLeft\']);\n' +
    'const layout = { compact: narrow };\n' +
    'const mouse = { x: 0, y: 0, down: false };\n' +
    'const _RG = { _minimapDirty: false };\n' +
    "const settings = {\n" +
    "  sfxVol: 0.5, musicVol: 0.5, screenShake: true, damageNumbers: true,\n" +
    "  lockAimToMove: false, aimAssist: true, crtMode: true, reducedMotion: false,\n" +
    "  minimapScale: 1.0, textScale: 1.0, worldZoom: 1.0,\n" +
    "  keyMap: Object.assign({}, DEFAULT_KEY_MAP), save() {}, resetCalls: 0, resetAll() { this.resetCalls += 1; }\n" +
    "};\n" +
    'const audio = {\n' +
    '  sfx: [], music: [], menu: 0,\n' +
    '  setSfxVolume(v) { settings.sfxVol = v; this.sfx.push(v); },\n' +
    '  setMusicVolume(v) { settings.musicVol = v; this.music.push(v); },\n' +
    '  menuSelect() { this.menu += 1; }\n' +
    '};\n' +
    'function jp(code) { return justPressed.has(code); }\n' +
    'function km(action) { return settings.keyMap[action]; }\n' +
    'function isTouchDevice() { return false; }\n' +
    'function resize() {}\n' +
    'function updateBtns() {}\n' +
    'function snapToSteps(value, steps) {\n' +
    '  return steps.reduce((best, step) => Math.abs(step - value) < Math.abs(best - value) ? step : best, steps[0]);\n' +
    '}\n' +
    'const harness = {\n' +
    "  _settingsFrom: 'MENU', _settingsSel: 0, _settingsCapture: null,\n" +
    '  _settingsDrag: null, _settingsResetConfirm: 0,\n' +
    '  setState(state) { this.state = state; },\n' +
    '  ' + extractObjectMethodSource(GAME, '_settingsLayout') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, '_settingsControlBox') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, '_settingsControlHit') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, '_settingsSliderTrack') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, '_settingsSliderHit') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, 'updateSettings') + '\n' +
    '};\n' +
    'return { harness, mouse, settings, audio, justPressed };';
  return new Function('W', 'H', 'narrow', source)(width, height, narrow); // eslint-disable-line no-new-func
}

/**
 * @param {{cellW:number,cellH:number,gap:number,cols:number,ox:number,oy:number}} layout
 * @param {number} index
 * @param {boolean} ok
 */
function nameEntryKeyRect(layout, index, ok = false) {
  const col = index % layout.cols;
  const row = Math.floor(index / layout.cols);
  const w = ok ? layout.cellW * 2 + layout.gap : layout.cellW;
  return {
    x: layout.ox + col * (layout.cellW + layout.gap),
    y: layout.oy + row * (layout.cellH + layout.gap),
    w,
    h: layout.cellH,
  };
}

/**
 * @param {{ rowX:number, rowStart:number, rowH:number, rowTopOffset:number, rowW:number, rowCardH:number, intentTitleOffset:number, intentLabelOffset:number }} layout
 * @param {number} index
 */
function messageIntentRect(layout, index) {
  const baselineY = layout.rowStart + index * layout.rowH;
  return {
    x: layout.rowX,
    y: baselineY + layout.rowTopOffset,
    w: layout.rowW,
    h: layout.rowCardH,
    titleY: baselineY + layout.intentTitleOffset,
    labelY: baselineY + layout.intentLabelOffset,
  };
}

/**
 * @param {{ cardX:number,cardY:number,cardW:number,cardH:number,cardGap:number,cardTextMaxW:number,numberY:number,iconTop:number,iconSize:number,nameY:number,descY:number }} layout
 * @param {number} index
 */
function powerupChoiceCardRect(layout, index) {
  const x = layout.cardX + index * (layout.cardW + layout.cardGap);
  return {
    x,
    y: layout.cardY,
    w: layout.cardW,
    h: layout.cardH,
    textMaxW: layout.cardTextMaxW,
    numberY: layout.cardY + layout.numberY,
    iconTop: layout.cardY + layout.iconTop,
    iconSize: layout.iconSize,
    nameY: layout.cardY + layout.nameY,
    descY: layout.cardY + layout.descY,
  };
}

/** @param {{ skipX:number,skipY:number,skipW:number,skipH:number,skipTextY:number }} layout */
function powerupChoiceSkipRect(layout) {
  return {
    x: layout.skipX,
    y: layout.skipY,
    w: layout.skipW,
    h: layout.skipH,
    textY: layout.skipY + layout.skipTextY,
  };
}

/**
 * @param {{ horizontal:boolean,cardX:number,cardY:number,cardW:number,cardH:number,cardGap:number,textMaxW:number,descMaxW?:number,numberX?:number,nameX?:number,priceX?:number,nameY:number,descY:number,priceY:number,showDesc:boolean,showSecondary:boolean }} layout
 * @param {number} index
 */
function shoppingCardRect(layout, index) {
  const x = layout.horizontal ? layout.cardX + index * (layout.cardW + layout.cardGap) : layout.cardX;
  const y = layout.horizontal ? layout.cardY : layout.cardY + index * (layout.cardH + layout.cardGap);
  return {
    x,
    y,
    w: layout.cardW,
    h: layout.cardH,
    textMaxW: layout.textMaxW,
    descMaxW: layout.descMaxW || layout.textMaxW,
    nameX: layout.horizontal ? x + layout.cardW / 2 : layout.nameX || x,
    priceX: layout.horizontal ? x + layout.cardW / 2 : layout.priceX || x + layout.cardW,
    nameY: y + layout.nameY,
    descY: y + layout.descY,
    priceY: y + layout.priceY,
    showDesc: layout.showDesc,
    showSecondary: layout.showSecondary,
  };
}

/** @param {{ leaveX:number,leaveY:number,leaveW:number,leaveH:number,leaveTextY:number }} layout */
function shoppingLeaveRect(layout) {
  return {
    x: layout.leaveX,
    y: layout.leaveY,
    w: layout.leaveW,
    h: layout.leaveH,
    textY: layout.leaveY + layout.leaveTextY,
  };
}

/**
 * @param {{ rowX:number,rowTop:number,rowH:number,rowW:number,rowCardH:number,rowTextY:number,rowIndexX:number,rowNameX:number,rowNameMaxW:number,activeX:number,showActiveLabel:boolean }} layout
 * @param {number} index
 */
function weaponSwapSlotRect(layout, index) {
  const y = layout.rowTop + index * layout.rowH;
  return {
    x: layout.rowX,
    y,
    w: layout.rowW,
    h: layout.rowCardH,
    textY: y + layout.rowTextY,
    indexX: layout.rowIndexX,
    nameX: layout.rowNameX,
    nameMaxW: layout.rowNameMaxW,
    activeX: layout.activeX,
    showActiveLabel: layout.showActiveLabel,
  };
}

/** @param {{ rowX:number,rowW:number,skipY:number,skipH:number,skipTextY:number }} layout */
function weaponSwapSkipRect(layout) {
  return {
    x: layout.rowX,
    y: layout.skipY,
    w: layout.rowW,
    h: layout.skipH,
    textY: layout.skipY + layout.skipTextY,
  };
}

/**
 * @param {{panelX:number,btnW:number,gap:number,btnY:number,btnH:number}} layout
 * @param {number} index
 */
function seedSetupButtonRect(layout, index) {
  return {
    x: layout.panelX + index * (layout.btnW + layout.gap),
    y: layout.btnY,
    w: layout.btnW,
    h: layout.btnH,
  };
}

// ---------- toCanvas ----------

test('toCanvas: maps client coords to canvas-internal coords (1:1)', () => {
  const canvas = {
    width: 100, height: 100,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  };
  assert.deepEqual(toCanvas(50, 50, canvas), [50, 50]);
  assert.deepEqual(toCanvas(0, 0, canvas), [0, 0]);
  assert.deepEqual(toCanvas(100, 100, canvas), [100, 100]);
});

test('toCanvas: scales when CSS size differs from internal size', () => {
  // Canvas internal 800x600, displayed at 400x300 (2x DPR-ish)
  const canvas = {
    width: 800, height: 600,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 300 }),
  };
  assert.deepEqual(toCanvas(200, 150, canvas), [400, 300]);
});

test('toCanvas: subtracts bounding rect offset', () => {
  const canvas = {
    width: 100, height: 100,
    getBoundingClientRect: () => ({ left: 20, top: 40, width: 100, height: 100 }),
  };
  assert.deepEqual(toCanvas(70, 90, canvas), [50, 50]);
});

test('toCanvas: rect width=0 falls back to /1 (no NaN)', () => {
  const canvas = {
    width: 100, height: 100,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
  };
  const [cx, cy] = toCanvas(50, 50, canvas);
  assert.ok(Number.isFinite(cx) && Number.isFinite(cy));
});

// ---------- hitBtn ----------

test('hitBtn: hit at center', () => {
  const btn = { x: 100, y: 100, r: 30 };
  assert.equal(hitBtn(100, 100, btn, 1), true);
});

test('hitBtn: hit at edge of radius', () => {
  const btn = { x: 100, y: 100, r: 30 };
  assert.equal(hitBtn(130, 100, btn, 1), true);
  assert.equal(hitBtn(100, 130, btn, 1), true);
});

test('hitBtn: miss outside radius', () => {
  const btn = { x: 100, y: 100, r: 30 };
  assert.equal(hitBtn(140, 100, btn, 1), false);
  assert.equal(hitBtn(200, 200, btn, 1), false);
});

test('hitBtn: small btn radius expanded by 22/scale on tiny screens', () => {
  // scale=0.5 → minR = 22/0.5 = 44; btn.r=20 → effective 44
  const btn = { x: 0, y: 0, r: 20 };
  // Just-outside the original 20px radius, well inside the expanded 44px radius
  assert.equal(hitBtn(40, 0, btn, 0.5), true);
  // Outside both radii
  assert.equal(hitBtn(50, 0, btn, 0.5), false);
});

test('hitBtn: large btn.r used when bigger than min target', () => {
  // scale=2 → minR = 11; btn.r=30 → use 30
  const btn = { x: 0, y: 0, r: 30 };
  assert.equal(hitBtn(29, 0, btn, 2), true);
  assert.equal(hitBtn(31, 0, btn, 2), false);
});

test('hitBtn: scale<=0 falls back to 1 (no division by zero)', () => {
  const btn = { x: 0, y: 0, r: 22 };
  // scale=0 should behave as scale=1 → minR = 22; btn.r=22 → effective 22
  assert.equal(hitBtn(22, 0, btn, 0), true);
  assert.equal(hitBtn(23, 0, btn, 0), false);
});

// ---------- resetTouch ----------

function makeTouchState() {
  return {
    joystick: { active: true, id: 7, baseX: 100, baseY: 200, dx: 5, dy: -3 },
    aim:      { active: true, id: 9, baseX: 0, baseY: 0, dx: 1, dy: 2, shooting: true },
    btnE: 1, btnF: 2, btnV: 3, btnDash: 4, btnPause: 5,
  };
}

test('resetTouch: clears joystick state but preserves baseX/baseY', () => {
  const t = makeTouchState();
  const m = { down: true };
  resetTouch(t, m);
  assert.equal(t.joystick.active, false);
  assert.equal(t.joystick.id, null);
  assert.equal(t.joystick.dx, 0);
  assert.equal(t.joystick.dy, 0);
  // matches original behavior in src/platform.js — baseX/baseY left alone
  assert.equal(t.joystick.baseX, 100);
  assert.equal(t.joystick.baseY, 200);
});

test('resetTouch: clears aim state including shooting flag', () => {
  const t = makeTouchState();
  resetTouch(t, { down: true });
  assert.equal(t.aim.active, false);
  assert.equal(t.aim.id, null);
  assert.equal(t.aim.dx, 0);
  assert.equal(t.aim.dy, 0);
  assert.equal(t.aim.shooting, false);
});

test('resetTouch: nulls all button-touch IDs', () => {
  const t = makeTouchState();
  resetTouch(t, { down: false });
  assert.equal(t.btnE, null);
  assert.equal(t.btnF, null);
  assert.equal(t.btnV, null);
  assert.equal(t.btnDash, null);
  assert.equal(t.btnPause, null);
});

test('resetTouch: clears mouse.down', () => {
  const m = { down: true };
  resetTouch(makeTouchState(), m);
  assert.equal(m.down, false);
});

test('resetTouch: tolerates missing touch / mouse arguments', () => {
  // Should not throw if either is null/undefined
  assert.doesNotThrow(() => resetTouch(null, null));
  assert.doesNotThrow(() => resetTouch(undefined, undefined));
  assert.doesNotThrow(() => resetTouch(makeTouchState(), null));
  assert.doesNotThrow(() => resetTouch(null, { down: true }));
});

test('resetTouch: tolerates touch with missing joystick/aim sub-objects', () => {
  const partial = { btnE: 1, btnF: 2, btnV: 3, btnDash: 4, btnPause: 5 };
  assert.doesNotThrow(() => resetTouch(partial, { down: true }));
  assert.equal(partial.btnE, null);
});

test('touch routing sends hit-tested modal taps through coordinates instead of any-tap Enter fallback', () => {
  assert.match(PLATFORM, /function routeTouchAsMouseClick\(cx, cy\) \{\s*mouse\.x = cx;\s*mouse\.y = cy;\s*justPressed\.add\('MouseLeft'\);\s*\}/,
    'coordinate-routed modal taps should share one helper so new modals do not duplicate mouse routing');
  assert.match(GAME_STATES_SRC, /TOUCH_ROUTE_AS_CLICK_STATES = new Set\(\[[\s\S]*GAME_STATES\.READING[\s\S]*GAME_STATES\.CHEATS/,
    'READING/CHEATS must be in the centralized coordinate-routed touch set');
  assert.match(PLATFORM, /TOUCH_ROUTE_AS_CLICK_STATES\.has\(_G\.state\)[\s\S]{0,120}routeTouchAsMouseClick\(cx, cy\);[\s\S]{0,40}continue;/,
    'READING/CHEATS touch input must be coordinate-routed so only hit-tested controls can dismiss or toggle');
  assert.match(PLATFORM, /else\s*\{\s*justPressed\.add\('Enter'\);\s*justPressed\.add\('MouseLeft'\);\s*\}/,
    'generic fallback remains for states that intentionally treat touch as confirm');
});

test('paused touch routing uses explicit button hit-tests instead of screen thirds', () => {
  assert.match(PLATFORM, /_G\.state === _PG_STATES\.PAUSED\) \{\s*routeTouchAsMouseClick\(cx, cy\);\s*continue;\s*\}/,
    'pause taps must route coordinates so game.js can hit-test the visible buttons');
  assert.doesNotMatch(PLATFORM, /cy\s*<\s*H\s*\*\s*0\.38[\s\S]*cy\s*<\s*H\s*\*\s*0\.62[\s\S]*KeyQ/,
    'pause touch handling must not keep invisible top/middle/bottom quit zones');
  assert.match(GAME, /getPauseOptionRects\(\) \{[\s\S]*return \[0, 1, 2\]\.map\(i => \(\{ x, y: y0 \+ i \* \(h \+ gap\), w, h \}\)\);[\s\S]*\},/,
    'pause menu must expose one shared rectangle layout for rendering and hit-testing');
  assert.match(GAME, /const\s+w\s*=\s*Math\.max\(160,\s*Math\.min\(W - 40,\s*narrow \? 270 : 340\)\)/,
    'pause touch rectangles must pin their width from canvas width');
  assert.match(GAME, /const\s+h\s*=\s*narrow \? 34 : 40/,
    'pause touch rectangles must pin their height');
  assert.match(GAME, /const\s+x\s*=\s*\(W - w\) \/ 2/,
    'pause touch rectangles must pin their centered origin X');
  assert.match(GAME, /const\s+y0\s*=\s*narrow \? 232 : 278/,
    'pause touch rectangles must pin their first-row origin Y');
  assert.match(GAME, /pauseOptionAt\(x, y\) \{[\s\S]*x >= r\.x && x <= r\.x \+ r\.w && y >= r\.y && y <= r\.y \+ r\.h[\s\S]*return i;/,
    'pause menu hit-test must require taps inside every edge of an explicit button rectangle');
  assert.match(GAME, /if \(jp\('MouseLeft'\)\) \{[\s\S]*const hit = this\.pauseOptionAt\(mouse\.x, mouse\.y\);[\s\S]*if \(hit >= 0\)/,
    'pause mouse/touch activation must derive the selected action from hit-tested coordinates');
  assert.match(GAME, /if \(!isTouchDevice\(\)\) \{\s*this\._pauseSel = this\.pauseOptionAt\(mouse\.x, mouse\.y\);\s*\}/,
    'desktop hover must use the same rectangles as click activation');
  assert.match(GAME, /const rects = this\.getPauseOptionRects\(\);[\s\S]*const labels = \['ESC — Resume', 'S   — Settings', 'Q   — Quit to Menu'\]/,
    'desktop pause labels must render against the same button rectangles as click activation');
  assert.match(GAME, /const labels = \['RESUME RUN', 'SETTINGS', 'QUIT TO MENU'\]/,
    'touch pause UI must draw explicit action labels instead of positional instructions');
  assert.doesNotMatch(GAME, /TAP TOP|TAP MIDDLE|TAP BOTTOM/,
    'pause overlay must not tell players to tap broad invisible screen regions');
});

test('settings row control hit targets respect rendered card bounds', () => {
  const cases = [
    { width: 900, height: 600, narrow: false, rowH: 23, x: 32, y: 66, w: 836, h: 20 },
    { width: 360, height: 640, narrow: true, rowH: 25, x: 14, y: 65, w: 332, h: 22 },
  ];

  for (const c of cases) {
    const harness = createSettingsControlHarness(c.width, c.height, c.narrow);
    const layoutM = harness._settingsLayout(22);
    const first = harness._settingsControlBox(layoutM.startY, layoutM.rowH);
    const second = harness._settingsControlBox(layoutM.startY + layoutM.rowH, layoutM.rowH);

    assert.equal(layoutM.startY, 80, 'settings first-row baseline Y must remain shared by render and input');
    assert.equal(layoutM.rowH, c.rowH, 'settings row height must fit the 22-row menu in this viewport');
    assert.equal(first.x, c.x, 'settings card origin X must match the rendered gutter');
    assert.equal(first.y, c.y, 'settings card origin Y must match the rendered row card');
    assert.equal(first.w, c.w, 'settings card width must match the rendered row card');
    assert.equal(first.h, c.h, 'settings card height must match the rendered row card');
    assert.equal(second.y > first.y + first.h, true, 'adjacent settings cards must keep a visible gap');

    assert.equal(harness._settingsControlHit(layoutM.startY, layoutM.rowH, first.x, first.y), true,
      'settings card top-left bound must accept taps');
    assert.equal(harness._settingsControlHit(layoutM.startY, layoutM.rowH, first.x + first.w, first.y + first.h), true,
      'settings card bottom-right bound must accept taps');
    assert.equal(harness._settingsControlHit(layoutM.startY, layoutM.rowH, first.x - 0.1, first.y + 1), false,
      'settings card left bound must reject outside taps');
    assert.equal(harness._settingsControlHit(layoutM.startY, layoutM.rowH, first.x + first.w + 0.1, first.y + 1), false,
      'settings card right bound must reject outside taps');
    assert.equal(harness._settingsControlHit(layoutM.startY, layoutM.rowH, first.x + 1, first.y - 0.1), false,
      'settings card top bound must reject outside taps');
    assert.equal(harness._settingsControlHit(layoutM.startY, layoutM.rowH, first.x + 1, first.y + first.h + 0.1), false,
      'settings card bottom bound must reject outside taps');
  }
});

test('settings slider clicks ignore visible card label and padding outside the track', () => {
  const cases = [
    { width: 900, height: 600, narrow: false, sliderX: 200, sliderW: 400 },
    { width: 360, height: 640, narrow: true, sliderX: 120, sliderW: 120 },
  ];

  for (const c of cases) {
    const fixture = createSettingsUpdateHarness(c.width, c.height, c.narrow);
    const layoutM = fixture.harness._settingsLayout(22);
    const first = fixture.harness._settingsControlBox(layoutM.startY, layoutM.rowH);
    fixture.mouse.y = first.y + first.h / 2;

    fixture.settings.sfxVol = 0.5;
    fixture.mouse.x = first.x + 10;
    fixture.harness.updateSettings();
    assert.equal(fixture.settings.sfxVol, 0.5,
      'label-side clicks inside the visible slider card must not snap to 0%');
    assert.deepEqual(fixture.audio.sfx, [],
      'label-side clicks inside the slider card must not call setSfxVolume');

    fixture.harness._settingsDrag = null;
    fixture.mouse.x = c.sliderX + c.sliderW * 0.25;
    fixture.harness.updateSettings();
    assert.equal(fixture.settings.sfxVol, 0.25,
      'clicks on the slider track must still map to the clicked value');
    assert.deepEqual(fixture.audio.sfx, [0.25],
      'track clicks must call setSfxVolume exactly once');

    fixture.harness._settingsDrag = null;
    fixture.settings.sfxVol = 0.25;
    fixture.mouse.x = c.sliderX + c.sliderW + 10;
    fixture.harness.updateSettings();
    assert.equal(fixture.settings.sfxVol, 0.25,
      'right-padding clicks inside the visible slider card must not snap to 100%');
    assert.deepEqual(fixture.audio.sfx, [0.25],
      'right-padding clicks inside the slider card must not call setSfxVolume');
  }
});

/**
 * Real settings layouts for the slider/row tests: desktop, narrow desktop,
 * rotated phones (844x390 at zoom 2 -> 603x279; 812x375 at zoom 2.5 ->
 * 464x214), 1024x768 at zoom 1.5 (533x400) and portrait phones. `narrow`
 * always comes from the runtime predicate.
 */
const SETTINGS_LAYOUT_CASES = /** @type {[number, number][]} */ ([
  [900, 600], [700, 400], [660, 360], [603, 279], [533, 400], [464, 214], [360, 640], [371, 804],
]).map(([width, height]) => ({ width, height, narrow: computeLayout(width, height, 0).compact }));

test('settings slider tracks stay inside their row card and every drawn track pixel sets the value', () => {
  for (const c of SETTINGS_LAYOUT_CASES) {
    const where = `${c.width}x${c.height}`;
    const probe = createSettingsUpdateHarness(c.width, c.height, c.narrow).harness;
    const layoutM = probe._settingsLayout(22);
    const ry = layoutM.startY;
    const card = probe._settingsControlBox(ry, layoutM.rowH);
    const next = probe._settingsControlBox(ry + layoutM.rowH, layoutM.rowH);
    const track = probe._settingsSliderTrack();
    assert.ok(track.w > 0, `track has width at ${where}`);
    // The track and its right-aligned percentage stay inside the card.
    assert.ok(track.x >= card.x, `track starts inside the card at ${where}`);
    assert.ok(track.x + track.w + (c.narrow ? 40 : 60) <= card.x + card.w, `track and percentage end inside the card at ${where}`);
    assert.ok(track.x + track.w <= c.width, `track on screen at ${where}`);
    // Hit region: the track's X span over the card and the drawn strip.
    const top = Math.min(card.y, ry - 4), bottom = Math.max(card.y + card.h, ry + 6);
    assert.ok(bottom < next.y, `slider hits never reach the next row's card at ${where}`);
    /** @param {number} mx @param {number} my */
    const tap = (mx, my) => {
      const f = createSettingsUpdateHarness(c.width, c.height, c.narrow);
      f.settings.sfxVol = 0.5;
      f.mouse.x = mx; f.mouse.y = my;
      f.harness.updateSettings();
      return f;
    };
    assert.equal(tap(track.x, ry).settings.sfxVol, 0, `left edge -> 0% at ${where}`);
    assert.equal(tap(track.x + track.w, ry).settings.sfxVol, 1, `right edge -> 100% at ${where}`);
    assert.deepEqual(tap(track.x + track.w * 0.25, top).audio.sfx, [0.25], `top edge sets the value at ${where}`);
    assert.deepEqual(tap(track.x + track.w * 0.25, bottom).audio.sfx, [0.25], `bottom edge (drawn strip) sets the value at ${where}`);
    for (const [mx, my, side] of /** @type {[number, number, string][]} */ ([
      [track.x - 0.1, ry, 'left'], [track.x + track.w + 0.1, ry, 'right'],
      [track.x + track.w / 2, top - 0.1, 'top'], [track.x + track.w / 2, bottom + 0.1, 'bottom'],
    ])) {
      assert.deepEqual(tap(mx, my).audio.sfx, [], `outside the ${side} edge never sets the value at ${where}`);
    }
    // The drawn track's corners (ry-4..ry+6) are all live.
    for (const my of [ry - 4, ry + 6]) {
      for (const mx of [track.x, track.x + track.w]) {
        assert.equal(tap(mx, my).audio.sfx.length, 1, `drawn track corner (${mx},${my}) is tappable at ${where}`);
      }
    }
    // A tap on the MUSIC row's card top goes to MUSIC, never SFX.
    const music = tap(track.x + track.w / 2, next.y);
    assert.deepEqual(music.audio.sfx, [], `next row's card top does not change SFX at ${where}`);
    assert.deepEqual(music.audio.music.length, 1, `next row's card top sets MUSIC at ${where}`);
  }
});

/**
 * Runs the real renderSettings with a recording canvas and returns its
 * fillRect calls, plus the settings harness used for geometry.
 * @param {number} width
 * @param {number} height
 * @param {boolean} narrow
 */
function renderSettingsRects(width, height, narrow) {
  assert.equal(narrow, computeLayout(width, height, 0).compact, `render fixture ${width}x${height} must match the runtime predicate`);
  /** @type {{x:number,y:number,w:number,h:number,fill:any}[]} */
  const rects = [];
  /** @type {Record<string, any>} */
  const state = {};
  const ctx = new Proxy(state, {
    get(target, key) {
      if (key === 'fillRect') return (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ w, /** @type {number} */ h) => rects.push({ x, y, w, h, fill: target.fillStyle });
      if (typeof key === 'string' && key in target) return target[key];
      return () => {};
    },
    set(target, key, value) { if (typeof key === 'string') target[key] = value; return true; },
  });
  const source = "const DEFAULT_KEY_MAP = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', interact: 'KeyE', hackware: 'KeyF', voidshard: 'KeyV', dash: 'ShiftLeft', shoot: 'Space' };\n" +
    'const layout = { compact: narrow };\n' +
    "const settings = { sfxVol: 0.5, musicVol: 0.25, screenShake: true, damageNumbers: true, lockAimToMove: false, aimAssist: false, crtMode: false, reducedMotion: false, minimapScale: 1, textScale: 1, worldZoom: 1, keyMap: Object.assign({}, DEFAULT_KEY_MAP) };\n" +
    'function KEY_DISPLAY(code) { return String(code); }\n' +
    'function isTouchDevice() { return false; }\n' +
    'const RESET_CONFIRM_WINDOW_MS = 2500;\n' +
    'const NEON = { draw: { roundRectFillStroke() {} } };\n' +
    'const ACTION_LABELS = new Proxy({}, { get: (_t, k) => String(k).toUpperCase() });\n' +
    'const harness = {\n' +
    "  _settingsSel: 0, _settingsCapture: null, _settingsResetConfirm: 0,\n" +
    '  ' + extractObjectMethodSource(GAME, '_settingsLayout') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, '_settingsControlBox') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, '_settingsControlHit') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, '_settingsSliderTrack') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, '_drawSettingsControl') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, 'renderSettings') + '\n' +
    '};\n' +
    'harness.renderSettings();\n' +
    'return harness;';
  const harness = new Function('W', 'H', 'narrow', 'ctx', source)(width, height, narrow, ctx); // eslint-disable-line no-new-func
  return { rects, harness };
}

test('the settings screen draws each slider track exactly where taps and drags use it', () => {
  for (const c of SETTINGS_LAYOUT_CASES) {
    const { rects, harness } = renderSettingsRects(c.width, c.height, c.narrow);
    const layoutM = harness._settingsLayout(22);
    const track = harness._settingsSliderTrack();
    const tracks = rects.filter((r) => r.h === 10 && r.fill === 'rgba(255,255,255,0.08)');
    assert.equal(tracks.length, 2, `two slider tracks drawn at ${c.width}x${c.height}`);
    tracks.forEach((r, i) => {
      assert.deepEqual([r.x, r.y, r.w, r.h], [track.x, layoutM.startY + i * layoutM.rowH - 4, track.w, 10],
        `slider ${i} drawn on the shared track rectangle at ${c.width}x${c.height}`);
    });
  }
});

test('dragging a slider maps the pointer across the same track the tap uses', () => {
  const f = createSettingsUpdateHarness(660, 360, false);
  const layoutM = f.harness._settingsLayout(22);
  const track = f.harness._settingsSliderTrack();
  assert.equal(track.w, 364, 'narrow desktop track shortened to stay inside its card');
  f.mouse.x = track.x + track.w * 0.5; f.mouse.y = layoutM.startY;
  f.harness.updateSettings();
  assert.equal(f.harness._settingsDrag, 'sfx', 'a track tap starts a drag');
  f.justPressed.clear();
  f.mouse.down = true;
  for (const [mx, want] of /** @type {[number, number][]} */ ([[track.x + track.w * 0.75, 0.75], [track.x + track.w + 50, 1], [track.x - 50, 0], [track.x + track.w * 0.25, 0.25]])) {
    f.mouse.x = mx;
    f.harness.updateSettings();
    assert.equal(f.settings.sfxVol, want, `drag at x=${mx}`);
  }
  f.mouse.down = false;
  f.harness.updateSettings();
  assert.equal(f.harness._settingsDrag, null, 'release ends the drag');
});

test('a zero-width slider track (320 px phone at zoom 2) never yields a NaN volume; taps just select the row', () => {
  const width = 229, height = 406; // 320x568 CSS / 0.7 / zoom 2
  const f = createSettingsUpdateHarness(width, height, computeLayout(width, height, 0).compact);
  assert.equal(f.harness._settingsSliderTrack().w, 0, 'no room for a track');
  const layoutM = f.harness._settingsLayout(22);
  f.mouse.x = f.harness._settingsSliderTrack().x; f.mouse.y = layoutM.startY;
  f.harness._settingsSel = 5;
  f.harness.updateSettings();
  assert.deepEqual(f.audio.sfx, [], 'no volume call');
  assert.equal(f.settings.sfxVol, 0.5, 'value unchanged (never NaN)');
  assert.equal(f.harness._settingsSel, 0, 'the tap selects the SFX row');
});

test('a slider card tap off the track selects the row, disarms reset and keeps the value', () => {
  for (const c of SETTINGS_LAYOUT_CASES) {
    const f = createSettingsUpdateHarness(c.width, c.height, c.narrow);
    const layoutM = f.harness._settingsLayout(22);
    const card = f.harness._settingsControlBox(layoutM.startY + layoutM.rowH, layoutM.rowH);
    f.harness._settingsSel = 7;
    f.harness._settingsResetConfirm = 12345;
    f.settings.musicVol = 0.4;
    f.mouse.x = card.x + 4; f.mouse.y = card.y + card.h / 2;
    f.harness.updateSettings();
    assert.equal(f.harness._settingsSel, 1, `MUSIC row selected at ${c.width}x${c.height}`);
    assert.equal(f.harness._settingsResetConfirm, 0, 'pending reset disarmed');
    assert.equal(f.settings.musicVol, 0.4, 'value unchanged');
    assert.deepEqual(f.audio.music, [], 'no volume call');
    assert.equal(f.harness._settingsDrag, null, 'no drag starts');
    assert.equal(f.audio.menu, 1, 'selection feedback plays');
  }
});

test('every settings row family acts on a tap inside its own card, and gaps between cards do nothing', () => {
  const toggleKeys = ['screenShake', 'damageNumbers', 'lockAimToMove', 'aimAssist', 'crtMode', 'reducedMotion'];
  const actions = ['up', 'down', 'left', 'right', 'interact', 'hackware', 'voidshard', 'dash', 'shoot'];
  // Layouts where all 22 rows are on screen (short landscape screens push
  // RESET/BACK below the fold: a pre-existing layout limit).
  for (const c of SETTINGS_LAYOUT_CASES.filter((k) => k.height >= 600)) {
    const where = `${c.width}x${c.height}`;
    const probe = createSettingsUpdateHarness(c.width, c.height, c.narrow).harness;
    const layoutM = probe._settingsLayout(22);
    const cardAt = (/** @type {number} */ row) => probe._settingsControlBox(layoutM.startY + row * layoutM.rowH, layoutM.rowH);
    /** @param {number} row @param {number} [fx] fraction of W for x @param {(f:any)=>void} [prep] */
    const tapRow = (row, fx, prep) => {
      const f = createSettingsUpdateHarness(c.width, c.height, c.narrow);
      if (prep) prep(f);
      const b = cardAt(row);
      f.mouse.x = fx === undefined ? b.x + b.w / 2 : c.width * fx;
      f.mouse.y = b.y + b.h / 2;
      f.harness.updateSettings();
      return f;
    };
    toggleKeys.forEach((key, i) => {
      const f = tapRow(2 + i);
      for (const other of toggleKeys) {
        const before = createSettingsUpdateHarness(c.width, c.height, c.narrow).settings[other];
        assert.equal(f.settings[other], other === key ? !before : before, `row ${2 + i} flips only ${key} at ${where}`);
      }
      assert.equal(f.harness._settingsSel, 2 + i);
    });
    assert.equal(tapRow(8, 0.75).settings.minimapScale, 1.25, `MINIMAP stepper right half steps forward at ${where}`);
    assert.equal(tapRow(8, 0.25).settings.minimapScale, 0.75, `MINIMAP stepper left half steps back at ${where}`);
    assert.equal(tapRow(9, 0.75).settings.textScale, 1.15, `TEXT stepper at ${where}`);
    assert.equal(tapRow(10, 0.75).settings.worldZoom, 1.25, `WORLD ZOOM stepper at ${where}`);
    actions.forEach((action, i) => {
      assert.equal(tapRow(11 + i).harness._settingsCapture, action, `rebind row ${11 + i} captures ${action} at ${where}`);
    });
    // RESET: first tap arms, a second tap on the same card commits once.
    const reset = tapRow(20);
    assert.ok(reset.harness._settingsResetConfirm > 0, `RESET arms at ${where}`);
    assert.equal(reset.settings.resetCalls, 0);
    const rb = cardAt(20);
    reset.mouse.x = rb.x + rb.w / 2; reset.mouse.y = rb.y + rb.h / 2;
    reset.harness.updateSettings();
    assert.equal(reset.settings.resetCalls, 1, `second RESET tap commits once at ${where}`);
    // BACK leaves the screen; the RESET card does not.
    assert.equal(tapRow(21).harness.state, 'MENU', `BACK returns to the menu at ${where}`);
    assert.equal(tapRow(20).harness.state, undefined, `RESET does not leave the screen at ${where}`);
    // Gaps between cards: nothing changes and a pending reset disarms.
    for (const row of [2, 8, 11, 19, 20]) {
      const a = cardAt(row), b = cardAt(row + 1);
      const f = createSettingsUpdateHarness(c.width, c.height, c.narrow);
      const snapshot = JSON.stringify(f.settings);
      f.harness._settingsResetConfirm = 12345;
      f.mouse.x = c.width / 2; f.mouse.y = (a.y + a.h + b.y) / 2;
      f.harness.updateSettings();
      assert.equal(JSON.stringify(f.settings), snapshot, `gap after row ${row} changes nothing at ${where}`);
      assert.equal(f.harness._settingsCapture, null, `gap after row ${row} starts no rebind at ${where}`);
      assert.equal(f.harness.state, undefined, `gap after row ${row} does not leave at ${where}`);
      assert.equal(f.harness._settingsResetConfirm, 0, `gap after row ${row} disarms reset at ${where}`);
    }
  }
});

test('result screens route taps through explicit return-to-menu buttons', () => {
  assert.match(GAME_STATES_SRC, /TOUCH_ROUTE_AS_CLICK_STATES = new Set\(\[[\s\S]*GAME_STATES\.GAME_OVER[\s\S]*GAME_STATES\.VICTORY/,
    'GAME_OVER and VICTORY taps must carry coordinates so only visible controls can return to menu');
  assert.match(GAME, /getResultMenuButtonRect\(\) \{[\s\S]*const\s+w\s*=\s*Math\.max\(180,\s*Math\.min\(W - 40,\s*narrow \? 260 : 320\)\)/,
    'result return button must pin its width from canvas width');
  assert.match(GAME, /const\s+h\s*=\s*narrow \? 36 : 42/,
    'result return button must pin its height');
  assert.match(GAME, /const\s+x\s*=\s*\(W - w\) \/ 2/,
    'result return button must pin its centered origin X');
  assert.match(GAME, /const\s+y\s*=\s*H - \(narrow \? 62 : 74\)/,
    'result return button must pin its bottom-safe origin Y');
  assert.match(GAME, /resultMenuButtonHit\(x, y\) \{[\s\S]*x >= r\.x && x <= r\.x \+ r\.w && y >= r\.y && y <= r\.y \+ r\.h/,
    'result button hit-test must require taps inside every rectangle edge');
  assert.match(GAME, /updateGameOver\(\) \{[\s\S]*jp\('Enter'\) \|\| \(jp\('MouseLeft'\) && this\.resultMenuButtonHit\(mouse\.x, mouse\.y\)\)/,
    'game-over mouse/touch activation must require a hit-tested return button');
  assert.match(GAME, /updateVictory\(\) \{[\s\S]*jp\('Enter'\) \|\| \(jp\('MouseLeft'\) && this\.resultMenuButtonHit\(mouse\.x, mouse\.y\)\)/,
    'victory mouse/touch activation must require a hit-tested return button');
  assert.match(GAME, /renderGameOver\(\) \{[\s\S]*this\.renderResultMenuButton\('#ff00c8'\)/,
    'game-over screen must draw the explicit return button it hit-tests');
  assert.match(GAME, /renderVictory\(\) \{[\s\S]*this\.renderResultMenuButton\('#ffb700'\)/,
    'victory screen must draw the explicit return button it hit-tests');
  assert.doesNotMatch(GAME, /TAP TO CONTINUE|TAP FOR MENU/,
    'result screens must not advertise any-tap continuation on touch devices');
});

test('compact result leaderboards stay above the explicit return button', () => {
  assert.match(GAME, /getResultLeaderboardRowCount\(leaderboardY, desiredRows\) \{[\s\S]*const button = this\.getResultMenuButtonRect\(\);[\s\S]*const available = button\.y - bottomGap - leaderboardY;[\s\S]*if \(available < titleOffset\) return 0;[\s\S]*Math\.min\(desiredRows, Math\.floor\(\(available - titleOffset\) \/ lineH\) \+ 1\)/,
    'result screens must derive leaderboard rows from the space above the fixed return-to-menu button');
  assert.match(GAME, /renderGameOver\(\) \{[\s\S]*const lbY = y \+ \(narrow\?6:10\);[\s\S]*const desiredLbRows = narrow \? 3 : 5;[\s\S]*const lbRows = this\.getResultLeaderboardRowCount\(lbY, desiredLbRows\);[\s\S]*this\.renderLeaderboard\(lbY, lbRows, this\.lastSavedRank\);/,
    'game-over compact leaderboard rows must be capped before rendering against the bottom button');
  assert.match(GAME, /renderVictory\(\) \{[\s\S]*const lbY = y \+ \(narrow\?6:10\);[\s\S]*const desiredLbRows = narrow \? 3 : 5;[\s\S]*const lbRows = this\.getResultLeaderboardRowCount\(lbY, desiredLbRows\);[\s\S]*this\.renderLeaderboard\(lbY, lbRows, this\.lastSavedRank\);/,
    'victory compact leaderboard rows must be capped before rendering against the bottom button');
  assert.match(GAME, /const allScores = this\.getScores\(\);[\s\S]*if \(highlightRank >= maxEntries && highlightRank < allScores\.length && maxEntries > 0\)[\s\S]*scores\[Math\.max\(0, maxEntries - 1\)\] = highlighted;[\s\S]*ranks\[Math\.max\(0, maxEntries - 1\)\] = highlightRank;/,
    'when row count is reduced, the saved player score should still replace the final visible row and remain highlightable');
});

test('compact name-entry virtual keyboard stays within short mobile viewports', () => {
  const harness = createNameEntryKeyboardHarness(390, 360, true);
  const keyboard = harness._vkLayout(true);

  assert.equal(keyboard.cellW, 28, 'compact key width must stay finger-readable');
  assert.equal(keyboard.cellH, 28, 'compact key height must stay finger-readable');
  assert.equal(keyboard.gap, 3, 'compact key gap must be included in bounds');
  assert.equal(keyboard.ox, 41.5, 'compact keyboard origin X must be centered in the viewport');
  assert.equal(keyboard.oy, 218, 'compact keyboard origin Y must lift on short viewports');
  assert.equal(keyboard.gridW, 307, 'compact keyboard width must include all columns and gaps');
  assert.equal(keyboard.gridH, 121, 'compact keyboard height must include all rows and gaps');
  assert.equal(keyboard.ox + keyboard.gridW, 348.5, 'compact keyboard right bound must fit the viewport');
  assert.equal(keyboard.oy + keyboard.gridH, 339, 'compact keyboard bottom bound must fit above the hint');
  assert.equal(keyboard.hintY, 348, 'compact keyboard hint baseline must remain visible');
  assert.ok(keyboard.hintY <= 360 - 12, 'compact keyboard hint must keep its bottom-safe margin');
  assert.doesNotMatch(GAME, /const\s+oy\s*=\s*narrow\s*\?\s*280\s*:\s*340/,
    'name-entry rendering and hit-testing must not keep a duplicated hardcoded keyboard Y origin');
});

test('name-entry virtual keyboard hit-test respects all key rectangle bounds', () => {
  const harness = createNameEntryKeyboardHarness(390, 360, true);
  const keyboard = harness._vkLayout(true);
  const keyA = nameEntryKeyRect(keyboard, 0);
  const okIndex = harness._vkChars.length + 1;
  const keyOk = nameEntryKeyRect(keyboard, okIndex, true);

  assert.equal(keyA.x, 41.5, 'A key origin X must match the shared keyboard layout');
  assert.equal(keyA.y, 218, 'A key origin Y must match the shared keyboard layout');
  assert.equal(keyA.w, 28, 'A key width must match the shared keyboard layout');
  assert.equal(keyA.h, 28, 'A key height must match the shared keyboard layout');
  assert.equal(harness._vkHitTest(keyA.x, keyA.y, keyboard.oy, true), 'A');
  assert.equal(harness._vkHitTest(keyA.x + keyA.w, keyA.y + keyA.h, keyboard.oy, true), 'A');
  assert.equal(harness._vkHitTest(keyA.x - 0.1, keyA.y + 1, keyboard.oy, true), null, 'A key left bound must reject outside taps');
  assert.equal(harness._vkHitTest(keyA.x + keyA.w + 0.1, keyA.y + 1, keyboard.oy, true), null, 'A key right bound must reject outside taps');
  assert.equal(harness._vkHitTest(keyA.x + 1, keyA.y - 0.1, keyboard.oy, true), null, 'A key top bound must reject outside taps');
  assert.equal(harness._vkHitTest(keyA.x + 1, keyA.y + keyA.h + 0.1, keyboard.oy, true), null, 'A key bottom bound must reject outside taps');

  assert.equal(keyOk.x, 289.5, 'OK key origin X must start on the eighth compact column');
  assert.equal(keyOk.y, 311, 'OK key origin Y must share the final keyboard row');
  assert.equal(keyOk.w, 59, 'OK key width must span two compact columns plus the gap');
  assert.equal(keyOk.h, 28, 'OK key height must match other compact keys');
  assert.equal(keyOk.x + keyOk.w, keyboard.ox + keyboard.gridW, 'OK key right bound must align to keyboard right edge');
  assert.equal(harness._vkHitTest(keyOk.x, keyOk.y, keyboard.oy, true), 'OK');
  assert.equal(harness._vkHitTest(keyOk.x + keyOk.w, keyOk.y + keyOk.h, keyboard.oy, true), 'OK');
  assert.equal(harness._vkHitTest(keyOk.x - 0.1, keyOk.y + 1, keyboard.oy, true), null, 'OK key left bound must reject outside taps');
  assert.equal(harness._vkHitTest(keyOk.x + keyOk.w + 0.1, keyOk.y + 1, keyboard.oy, true), null, 'OK key right bound must reject outside taps');
  assert.equal(harness._vkHitTest(keyOk.x + 1, keyOk.y - 0.1, keyboard.oy, true), null, 'OK key top bound must reject outside taps');
  assert.equal(harness._vkHitTest(keyOk.x + 1, keyOk.y + keyOk.h + 0.1, keyboard.oy, true), null, 'OK key bottom bound must reject outside taps');
});

test('compact seed setup layout keeps field, help, actions, and footer visible on short mobile viewports', () => {
  const { harness, view } = createSeedSetupLayoutHarness(390, 320, true);
  const r = harness.seedSetupLayout(view);

  assert.equal(r.panelX, 16, 'seed panel origin X must keep compact side gutters');
  assert.equal(r.panelY, 35, 'seed panel origin Y must keep compact top/bottom gutters');
  assert.equal(r.panelW, 358, 'seed panel width must fit the compact viewport');
  assert.equal(r.panelH, 250, 'seed panel height must fit the compact viewport');
  assert.equal(r.fieldX, 33, 'seed field origin X must align with rendered field');
  assert.equal(r.fieldY, 113, 'seed field origin Y must lift on short compact viewports');
  assert.equal(r.fieldW, 324, 'seed field width must preserve compact inset');
  assert.equal(r.fieldH, 46, 'seed field height must match the rendered field');
  assert.equal(r.btnH, 40, 'compact seed action buttons must stay finger-readable');
  assert.equal(r.footerY, 271, 'compact seed footer baseline must remain inside the panel');

  assert.ok(r.fieldY + r.fieldH + 18 <= r.helpY1, 'first help line must clear the seed field');
  assert.ok(r.helpY1 + 14 <= r.helpY2, 'second help line must clear the first help line');
  assert.ok(r.helpY2 + 18 <= r.btnY, 'action row must clear compact help copy');
  assert.ok(r.btnY + r.btnH + 16 <= r.footerY, 'footer hint must clear compact action buttons');
  assert.ok(r.footerY <= view.H - 12, 'footer hint must keep a bottom-safe margin');
});

test('ultra-short seed setup layout keeps compact action targets above the footer and onscreen', () => {
  for (const height of [240, 280]) {
    const { harness, view } = createSeedSetupLayoutHarness(390, height, true);
    const r = harness.seedSetupLayout(view);

    assert.equal(r.panelY, 12, 'ultra-short seed panel origin Y must keep a top gutter');
    assert.equal(r.fieldH, 40, 'ultra-short seed field remains finger-readable');
    assert.equal(r.btnH, 40, 'ultra-short seed action buttons remain finger-readable');
    assert.ok(r.helpY2 + 8 <= r.btnY, 'ultra-short action row must clear compact help copy');
    assert.ok(r.btnY + r.btnH + 10 <= r.footerY, 'ultra-short footer hint must clear action buttons');
    assert.ok(r.footerY <= view.H - 10, 'ultra-short footer hint must keep a bottom-safe margin');
    assert.ok(r.btnY + r.btnH <= view.H, 'ultra-short action buttons must stay onscreen');
  }
});

test('compact seed setup field hit-test respects all field rectangle bounds', () => {
  const { harness, view } = createSeedSetupLayoutHarness(390, 320, true);
  const r = harness.seedSetupLayout(view);

  assert.equal(harness.seedSetupFieldHitTest(r.fieldX, r.fieldY, view), true, 'field top-left bound must accept taps');
  assert.equal(harness.seedSetupFieldHitTest(r.fieldX + r.fieldW, r.fieldY + r.fieldH, view), true, 'field bottom-right bound must accept taps');
  assert.equal(harness.seedSetupFieldHitTest(r.fieldX - 0.1, r.fieldY + 1, view), false, 'field left bound must reject outside taps');
  assert.equal(harness.seedSetupFieldHitTest(r.fieldX + r.fieldW + 0.1, r.fieldY + 1, view), false, 'field right bound must reject outside taps');
  assert.equal(harness.seedSetupFieldHitTest(r.fieldX + 1, r.fieldY - 0.1, view), false, 'field top bound must reject outside taps');
  assert.equal(harness.seedSetupFieldHitTest(r.fieldX + 1, r.fieldY + r.fieldH + 0.1, view), false, 'field bottom bound must reject outside taps');
});

test('compact seed setup action hit-test respects all button rectangle bounds', () => {
  const { harness, view } = createSeedSetupLayoutHarness(390, 320, true);
  const r = harness.seedSetupLayout(view);
  const expectedX = [16, 138, 260];

  for (let i = 0; i < 3; i++) {
    const btn = seedSetupButtonRect(r, i);
    assert.equal(btn.x, expectedX[i], 'seed action button origin X must match the shared compact layout');
    assert.equal(btn.y, 215, 'seed action button origin Y must match the shared compact layout');
    assert.equal(btn.w, 114, 'seed action button width must match the shared compact layout');
    assert.equal(btn.h, 40, 'seed action button height must match the shared compact layout');
    assert.equal(harness.seedSetupHitTest(btn.x, btn.y, view), i, 'button top-left bound must accept taps');
    assert.equal(harness.seedSetupHitTest(btn.x + btn.w, btn.y + btn.h, view), i, 'button bottom-right bound must accept taps');
    assert.equal(harness.seedSetupHitTest(btn.x - 0.1, btn.y + 1, view), -1, 'button left bound must reject outside taps');
    assert.equal(harness.seedSetupHitTest(btn.x + btn.w + 0.1, btn.y + 1, view), -1, 'button right bound must reject outside taps');
    assert.equal(harness.seedSetupHitTest(btn.x + 1, btn.y - 0.1, view), -1, 'button top bound must reject outside taps');
    assert.equal(harness.seedSetupHitTest(btn.x + 1, btn.y + btn.h + 0.1, view), -1, 'button bottom bound must reject outside taps');
  }
});

test('compact message-send layout keeps intent cards, actions, and footer separated', () => {
  const r = createMessageSendLayoutHarness(320, 390, true);
  const first = messageIntentRect(r, 0);
  const third = messageIntentRect(r, 2);

  assert.equal(r.panelW, 288, 'message-send panel width must keep compact side gutters');
  assert.equal(r.panelH, 340, 'message-send panel height must preserve runtime-plausible compact behavior');
  assert.equal(r.py, 25, 'message-send panel origin Y must preserve runtime-plausible compact behavior');
  assert.equal(r.titleY, 53, 'message-send title baseline must come from the shared layout');
  assert.equal(r.subtitleY, 73, 'message-send subtitle baseline must come from the shared layout');
  assert.equal(r.rowStart, 83, 'message-send first intent card must clear compact subtitle copy');
  assert.equal(r.rowH, 58, 'message-send compact row spacing must preserve runtime-plausible compact behavior');
  assert.equal(first.x, 32, 'first intent card origin X must match the shared layout');
  assert.equal(first.y, 83, 'first intent card origin Y must clear the subtitle');
  assert.equal(first.w, 256, 'intent card width must match the shared layout');
  assert.equal(first.h, 40, 'intent card height must match the shared layout');
  assert.equal(third.y + third.h, 239, 'third intent card bottom must stay above actions');
  assert.ok(r.subtitleY + 8 <= first.y, 'first compact intent card must clear the subtitle');
  assert.equal(r.btnY, 307, 'action row origin Y must match the shared compact layout');
  assert.ok(third.y + third.h + 8 <= r.btnY, 'third intent card must clear the SEND/BACK row');
  assert.ok(r.btnY + r.btnH + 8 <= r.footerY, 'action row must clear the compact footer');
});

test('message-send compact fixture guard rejects impossible compact dimensions', () => {
  assert.throws(
    () => createMessageSendLayoutHarness(390, 320, true),
    /must match runtime compact=false/,
    'compact MESSAGE_SEND tests must use dimensions that can enter the runtime compact layout',
  );
});

test('message-send compact action buttons fit narrow portrait widths above the tight threshold', () => {
  for (const { width, height } of [
    { width: 240, height: 320 },
    { width: 229, height: 320 },
  ]) {
    const r = createMessageSendLayoutHarness(width, height, true);

    assert.ok(r.btnW <= 116, 'compact SEND/BACK buttons must not exceed the standard width');
    assert.ok(r.btnW >= 72, 'compact SEND/BACK buttons must keep a minimum readable width');
    assert.ok(r.subtitleY + 8 <= messageIntentRect(r, 0).y, 'first compact intent card must clear the subtitle above the tight threshold');
    assert.ok(r.sendX >= 0, 'compact SEND button must stay onscreen on narrow portrait widths');
    assert.ok(r.backX + r.btnW <= width, 'compact BACK button must stay onscreen on narrow portrait widths');
    assert.ok(r.sendX + r.btnW < r.backX, 'compact SEND/BACK buttons must keep a horizontal gap');
    assert.ok(r.btnY + r.btnH + 8 <= r.footerY, 'compact action row must still clear the footer above the tight threshold');
    assert.equal(height >= 290, true, 'test case must exercise the non-tight compact branch');
  }
});

test('message-send compact boundary heights keep third intent above actions', () => {
  for (const { width, height } of [
    { width: 240, height: 289 },
    { width: 240, height: 290 },
    { width: 240, height: 295 },
    { width: 240, height: 299 },
    { width: 240, height: 300 },
    { width: 229, height: 290 },
    { width: 229, height: 299 },
  ]) {
    const r = createMessageSendLayoutHarness(width, height, true);
    const first = messageIntentRect(r, 0);
    const second = messageIntentRect(r, 1);
    const third = messageIntentRect(r, 2);

    assert.ok(r.subtitleY + 8 <= first.y, `first intent must clear subtitle at ${width}x${height}`);
    assert.ok(first.y + first.h + 6 <= second.y, `first and second intents must not overlap at ${width}x${height}`);
    assert.ok(second.y + second.h + 6 <= third.y, `second and third intents must not overlap at ${width}x${height}`);
    assert.ok(third.y + third.h + 8 <= r.btnY, `third intent must clear SEND/BACK at ${width}x${height}`);
    assert.ok(r.btnY + r.btnH + 8 <= r.footerY, `actions must clear footer at ${width}x${height}`);
    assert.ok(r.sendX >= 0 && r.backX + r.btnW <= width, `actions must stay onscreen at ${width}x${height}`);
  }
});

test('ultra-short message-send layout prevents intent/action overlap on compact mobile', () => {
  for (const { width, height } of [
    { width: 199, height: 200 },
    { width: 219, height: 220 },
    { width: 240, height: 280 },
    { width: 229, height: 286 },
  ]) {
    const r = createMessageSendLayoutHarness(width, height, true);
    const first = messageIntentRect(r, 0);
    const second = messageIntentRect(r, 1);
    const third = messageIntentRect(r, 2);

    assert.equal(r.py, 8, 'ultra-short message-send panel origin Y must keep a top gutter');
    assert.equal(r.titleY, 32, 'ultra-short message-send title baseline must stay visible');
    assert.equal(r.subtitleY, 50, 'ultra-short message-send subtitle baseline must stay visible');
    assert.ok(r.subtitleY + 8 <= first.y, 'first intent card must clear the subtitle');
    assert.ok(first.y + first.h + 6 <= second.y, 'first and second intent cards must not overlap');
    assert.ok(second.y + second.h + 6 <= third.y, 'second and third intent cards must not overlap');
    assert.ok(third.y + third.h + 8 <= r.btnY, 'third intent card must clear the SEND/BACK row');
    assert.equal(r.btnH, 36, 'ultra-short SEND/BACK buttons must remain finger-readable');
    assert.ok(r.btnY + r.btnH + 8 <= r.footerY, 'ultra-short action row must clear the footer hint');
    assert.ok(r.footerY <= height - 10, 'ultra-short footer hint must keep a bottom-safe margin');
    assert.ok(r.sendX >= 0 && r.backX + r.btnW <= width, 'ultra-short SEND/BACK buttons must stay onscreen');
    assert.ok(r.sendX + r.btnW < r.backX, 'ultra-short SEND/BACK buttons must keep a horizontal gap');
  }
});

test('message-send button hit targets respect all rectangle bounds', () => {
  const r = createMessageSendLayoutHarness(240, 280, true);

  assert.equal(r.sendX, 12, 'SEND button origin X must match the shared ultra-short layout');
  assert.equal(r.backX, 124, 'BACK button origin X must match the shared ultra-short layout');
  assert.equal(r.btnY, 226, 'SEND/BACK button origin Y must match the shared ultra-short layout');
  assert.equal(r.btnW, 104, 'SEND/BACK button width must fit a real compact portrait width');
  assert.equal(r.btnH, 36, 'SEND/BACK button height must match the shared ultra-short layout');
  assert.ok(r.sendX < r.backX, 'SEND and BACK button order must remain stable');
  assert.ok(r.sendX + r.btnW < r.backX, 'SEND and BACK buttons must keep a horizontal gap');
  assert.ok(r.sendX >= 0 && r.backX + r.btnW <= 240, 'SEND/BACK buttons must stay onscreen');
  assert.match(GAME, /if \(mouse\.y >= btnY && mouse\.y <= btnY \+ btnH\) \{[\s\S]*mouse\.x >= sendX && mouse\.x <= sendX \+ btnW[\s\S]*mouse\.x >= backX && mouse\.x <= backX \+ btnW/,
    'MESSAGE_SEND activation must use the same SEND/BACK rectangle bounds returned by the layout helper');
});

test('powerup-choice compact fixture guard rejects impossible compact dimensions', () => {
  assert.throws(
    () => createPowerupChoiceLayoutHarness(390, 320, true),
    /must match runtime compact=false/,
    'compact POWERUP_CHOICE tests must use dimensions that can enter the runtime compact layout',
  );
});

test('powerup-choice desktop layout preserves established card and skip geometry', () => {
  const r = createPowerupChoiceLayoutHarness(800, 600, false);
  const first = powerupChoiceCardRect(r, 0);
  const second = powerupChoiceCardRect(r, 1);
  const skip = powerupChoiceSkipRect(r);

  assert.equal(r.titleY, 90, 'desktop powerup title baseline must stay stable');
  assert.equal(first.x, 105, 'desktop first card origin X must stay stable');
  assert.ok(Math.abs(first.y - 168) < 0.001, 'desktop first card origin Y must stay stable');
  assert.equal(first.w, 280, 'desktop card width must stay stable');
  assert.equal(first.h, 220, 'desktop card height must stay stable');
  assert.equal(second.x, 415, 'desktop second card origin X must stay stable');
  assert.equal(skip.x, 320, 'desktop skip origin X must stay stable');
  assert.equal(skip.y, 413, 'desktop skip origin Y must stay stable');
  assert.equal(skip.w, 160, 'desktop skip width must stay stable');
  assert.equal(skip.h, 40, 'desktop skip height must stay stable');
  assert.ok(first.y + first.h + 25 <= skip.y, 'desktop cards must remain separated from SKIP');
});

test('compact powerup-choice layout keeps cards, skip, and hint separated', () => {
  for (const { width, height } of [
    { width: 199, height: 200 },
    { width: 229, height: 286 },
    { width: 240, height: 280 },
    { width: 240, height: 299 },
    { width: 240, height: 300 },
    { width: 240, height: 320 },
    { width: 320, height: 390 },
  ]) {
    const r = createPowerupChoiceLayoutHarness(width, height, true);
    const first = powerupChoiceCardRect(r, 0);
    const second = powerupChoiceCardRect(r, 1);
    const skip = powerupChoiceSkipRect(r);

    assert.ok(r.titleY >= 18, `title must keep a top-safe baseline at ${width}x${height}`);
    assert.ok(r.titleY + 8 <= first.y, `first card must clear title at ${width}x${height}`);
    assert.ok(first.x >= 0 && first.x + first.w <= width, `first card must stay onscreen at ${width}x${height}`);
    assert.ok(second.x >= 0 && second.x + second.w <= width, `second card must stay onscreen at ${width}x${height}`);
    assert.ok(first.x + first.w + 6 <= second.x, `compact cards must keep a horizontal gap at ${width}x${height}`);
    assert.ok(first.w >= 70, `compact cards must keep a minimum readable width at ${width}x${height}`);
    assert.ok(first.h >= 72, `compact cards must keep a minimum hit height at ${width}x${height}`);
    assert.ok(first.textMaxW <= first.w - 16, `card text budget must stay inside the compact card at ${width}x${height}`);
    assert.ok(first.numberY > first.y && first.numberY < first.y + first.h, `number badge must stay inside card at ${width}x${height}`);
    assert.ok(first.iconTop >= first.y && first.iconTop + first.iconSize <= first.y + first.h, `icon must stay inside card at ${width}x${height}`);
    assert.ok(first.nameY > first.iconTop + first.iconSize && first.nameY < first.y + first.h, `name baseline must stay inside card at ${width}x${height}`);
    assert.ok(first.descY > first.nameY && first.descY < first.y + first.h, `description baseline must stay inside card at ${width}x${height}`);
    assert.ok(first.y + first.h + 8 <= skip.y, `cards must clear SKIP at ${width}x${height}`);
    assert.ok(skip.x >= 0 && skip.x + skip.w <= width, `SKIP button must stay onscreen at ${width}x${height}`);
    assert.ok(skip.textY > skip.y && skip.textY < skip.y + skip.h, `SKIP label must stay inside button at ${width}x${height}`);
    if (r.showHint) {
      assert.ok(skip.y + skip.h + 9 <= r.hintY, `SKIP must clear rendered footer hint text at ${width}x${height}`);
      assert.ok(r.hintY <= height - 10, `footer hint must keep a bottom-safe margin at ${width}x${height}`);
    } else {
      assert.equal(height < 240, true, `footer hint may only be hidden on ultra-compact layouts at ${width}x${height}`);
    }
  }
});

test('powerup-choice hit targets and text use the shared compact layout', () => {
  assert.match(GAME, /function getPowerupChoiceLayout\(narrow\)/,
    'POWERUP_CHOICE must expose one shared layout helper for rendering and hit-testing');
  assert.match(GAME, /const\s+box\s*=\s*getPowerupChoiceLayout\(layout\.compact\)[\s\S]*mx >= cx && mx <= cx \+ box\.cardW && my >= box\.cardY && my <= box\.cardY \+ box\.cardH/,
    'POWERUP_CHOICE card activation must use the shared card rectangle bounds');
  assert.match(GAME, /mx >= box\.skipX && mx <= box\.skipX \+ box\.skipW && my >= box\.skipY && my <= box\.skipY \+ box\.skipH/,
    'POWERUP_CHOICE skip activation must use the shared skip rectangle bounds');
  assert.match(GAME, /ctx\.fillText\(fitCanvasText\('CHOOSE AN UPGRADE',\s*box\.titleMaxW\),\s*W\/2,\s*box\.titleY\)/,
    'POWERUP_CHOICE title must use the shared title text budget and baseline');
  assert.match(GAME, /ctx\.fillText\(fitCanvasText\(opt\.name,\s*wrapMaxW\),\s*cx \+ cw\/2,\s*cardY \+ box\.nameY\)/,
    'POWERUP_CHOICE option names must be constrained to the compact card text budget');
  assert.match(GAME, /if \(box\.showHint\) \{[\s\S]*ctx\.fillText\(fitCanvasText\('Tap a card or Skip',\s*box\.titleMaxW\),\s*W\/2,\s*box\.hintY\)/,
    'POWERUP_CHOICE footer hint must be hidden when the layout cannot reserve enough text ascent');
});

test('shopping compact fixture guard rejects impossible compact dimensions', () => {
  assert.throws(
    () => createShoppingLayoutHarness(390, 320, true),
    /must match runtime compact=false/,
    'compact SHOPPING tests must use dimensions that can enter the runtime compact layout',
  );
});

test('shopping desktop layout preserves established card and leave geometry', () => {
  const r = createShoppingLayoutHarness(800, 600, false);
  const first = shoppingCardRect(r, 0);
  const third = shoppingCardRect(r, 2);
  const leave = shoppingLeaveRect(r);

  assert.equal(r.horizontal, true, 'desktop shopping layout must keep horizontal cards');
  assert.equal(r.titleY, 60, 'desktop shop title baseline must stay stable');
  assert.equal(Math.round(r.creditsY), 102, 'desktop shop credits baseline must stay stable');
  assert.equal(first.x, 84, 'desktop first card origin X must stay stable');
  assert.equal(first.y, 132, 'desktop card origin Y must stay stable');
  assert.equal(first.w, 200, 'desktop card width must stay stable');
  assert.equal(first.h, 200, 'desktop card height must stay stable');
  assert.equal(third.x, 516, 'desktop third card origin X must stay stable');
  assert.equal(leave.x, 320, 'desktop leave origin X must stay stable');
  assert.equal(leave.y, 352, 'desktop leave origin Y must stay stable');
  assert.equal(leave.w, 160, 'desktop leave width must stay stable');
  assert.equal(leave.h, 40, 'desktop leave height must stay stable');
  assert.ok(first.y + first.h + 20 <= leave.y, 'desktop cards must remain separated from LEAVE');
});

test('compact shopping layout stacks items, leave, and hint without overlap', () => {
  for (const { width, height } of [
    { width: 199, height: 200 },
    { width: 229, height: 286 },
    { width: 240, height: 280 },
    { width: 240, height: 299 },
    { width: 240, height: 300 },
    { width: 240, height: 320 },
    { width: 320, height: 390 },
  ]) {
    const r = createShoppingLayoutHarness(width, height, true);
    const first = shoppingCardRect(r, 0);
    const second = shoppingCardRect(r, 1);
    const third = shoppingCardRect(r, 2);
    const leave = shoppingLeaveRect(r);

    assert.equal(r.horizontal, false, `compact shop must use stacked rows at ${width}x${height}`);
    assert.ok(r.titleY >= 18, `title must keep a top-safe baseline at ${width}x${height}`);
    assert.ok(r.titleY + 8 <= r.creditsY, `credits must clear title at ${width}x${height}`);
    assert.ok(r.creditsY + 8 <= first.y, `first shop row must clear credits at ${width}x${height}`);
    assert.ok(first.x >= 0 && first.x + first.w <= width, `first shop row must stay onscreen at ${width}x${height}`);
    assert.ok(first.w >= 170 || width < 220, `compact shop rows must keep a readable width at ${width}x${height}`);
    assert.ok(first.h >= 30, `compact shop rows must keep a minimum hit height at ${width}x${height}`);
    assert.ok(first.y + first.h + 4 <= second.y, `first and second shop rows must not overlap at ${width}x${height}`);
    assert.ok(second.y + second.h + 4 <= third.y, `second and third shop rows must not overlap at ${width}x${height}`);
    assert.ok(third.y + third.h + 8 <= leave.y, `third shop row must clear LEAVE at ${width}x${height}`);
    assert.ok(leave.x >= 0 && leave.x + leave.w <= width, `LEAVE button must stay onscreen at ${width}x${height}`);
    assert.ok(leave.textY > leave.y && leave.textY < leave.y + leave.h, `LEAVE label must stay inside button at ${width}x${height}`);
    assert.ok(first.textMaxW > 20 && first.nameX + first.textMaxW < first.priceX,
      `item name budget must stay left of price at ${width}x${height}`);
    assert.ok(first.priceX <= first.x + first.w - 8, `price anchor must stay inside row at ${width}x${height}`);
    assert.ok(first.nameY > first.y && first.nameY < first.y + first.h, `item name baseline must stay inside row at ${width}x${height}`);
    assert.ok(first.priceY > first.y && first.priceY < first.y + first.h, `price baseline must stay inside row at ${width}x${height}`);
    if (first.showDesc) {
      assert.ok(first.descY > first.nameY && first.descY < first.y + first.h, `description baseline must stay inside row at ${width}x${height}`);
      assert.ok(first.descMaxW <= first.w - 44, `description text budget must stay inside row at ${width}x${height}`);
    } else {
      assert.equal(height < 240, true, `description may only hide on ultra-compact shop rows at ${width}x${height}`);
    }
    if (r.showHint) {
      assert.ok(leave.y + leave.h + 9 <= r.hintY, `LEAVE must clear rendered footer hint text at ${width}x${height}`);
      assert.ok(r.hintY <= height - 10, `footer hint must keep a bottom-safe margin at ${width}x${height}`);
    } else {
      assert.equal(height < 240, true, `footer hint may only hide on ultra-compact shop layouts at ${width}x${height}`);
    }
  }
});

test('shopping hit targets and text use the shared compact layout', () => {
  assert.match(GAME, /function getShoppingLayout\(narrow\)/,
    'SHOPPING must expose one shared layout helper for rendering and hit-testing');
  assert.match(GAME, /const\s+box\s*=\s*getShoppingLayout\(layout\.compact\)[\s\S]*mx >= cx && mx <= cx \+ box\.cardW && my >= cy && my <= cy \+ box\.cardH/,
    'SHOPPING card activation must use the shared card rectangle bounds');
  assert.match(GAME, /mx >= box\.leaveX && mx <= box\.leaveX \+ box\.leaveW && my >= box\.leaveY && my <= box\.leaveY \+ box\.leaveH/,
    'SHOPPING leave activation must use the shared leave rectangle bounds');
  assert.match(GAME, /ctx\.fillText\(fitCanvasText\('VENDOR TERMINAL',\s*box\.titleMaxW\),\s*W \/ 2,\s*box\.titleY\)/,
    'SHOPPING title must use the shared title text budget and baseline');
  assert.match(GAME, /ctx\.fillText\(fitCanvasText\(item\.name,\s*box\.textMaxW\),\s*box\.nameX,\s*cardY \+ box\.nameY\)/,
    'SHOPPING compact item names must be constrained to the row text budget');
  assert.match(GAME, /const\s+descText\s*=\s*box\.horizontal\s*\?\s*item\.desc/,
    'SHOPPING desktop cards must preserve item descriptions instead of replacing them with compact secondary text');
  assert.doesNotMatch(GAME, /ctx\.fillText\('NO CRED'/,
    'SHOPPING compact unaffordable text must not diverge from the NOT ENOUGH contract');
  assert.match(GAME, /if \(box\.showHint\) \{[\s\S]*ctx\.fillText\(fitCanvasText\('Tap to buy · Tap Leave to exit',\s*box\.titleMaxW\),\s*W \/ 2,\s*box\.hintY\)/,
    'SHOPPING footer hint must be hidden when the layout cannot reserve enough text ascent');
});

test('weapon-swap compact fixture guard rejects impossible compact dimensions', () => {
  assert.throws(
    () => createWeaponSwapLayoutHarness(390, 320, true),
    /must match runtime compact=false/,
    'compact WEAPON_SWAP tests must use dimensions that can enter the runtime compact layout',
  );
});

test('weapon-swap desktop layout preserves established row and skip geometry', () => {
  const r = createWeaponSwapLayoutHarness(800, 600, false);
  const first = weaponSwapSlotRect(r, 0);
  const third = weaponSwapSlotRect(r, 2);
  const skip = weaponSwapSkipRect(r);

  assert.equal(r.panelW, 560, 'desktop weapon-swap panel width must stay stable');
  assert.equal(r.panelH, 330, 'desktop weapon-swap panel height must stay stable');
  assert.equal(r.panelY, 135, 'desktop weapon-swap panel origin Y must stay stable');
  assert.equal(first.y, 265, 'desktop first slot row must keep the existing origin');
  assert.equal(r.rowH, 40, 'desktop slot stride must stay stable');
  assert.equal(first.h, 34, 'desktop slot card height must stay stable');
  assert.ok(r.nameMaxW <= r.panelW - 56, 'desktop cache weapon title budget must stay within the panel');
  assert.ok(r.statsMaxW <= r.panelW - 64, 'desktop cache weapon stats budget must stay within the panel');
  assert.ok(r.affixMaxW <= r.panelW - 64, 'desktop cache weapon affix budget must stay within the panel');
  assert.equal(first.showActiveLabel, true, 'desktop weapon rows must keep the active slot label');
  assert.equal(first.nameX, r.rowX + 52, 'desktop weapon name origin must stay stable');
  assert.ok(first.nameX + first.nameMaxW + 8 <= first.activeX - 54,
    'desktop weapon name budget must reserve room for the ACTIVE label');
  assert.equal(third.y + third.h, 379, 'desktop third slot bottom must stay stable');
  assert.equal(skip.y, 403, 'desktop skip row origin must stay stable');
  assert.ok(third.y + third.h + 6 <= skip.y, 'desktop slots must remain separated from skip');
});

test('compact weapon-swap layout keeps replacement slots, skip, and hint separated', () => {
  for (const { width, height } of [
    { width: 199, height: 200 },
    { width: 229, height: 286 },
    { width: 240, height: 280 },
    { width: 240, height: 299 },
    { width: 240, height: 300 },
    { width: 240, height: 320 },
    { width: 320, height: 390 },
  ]) {
    const r = createWeaponSwapLayoutHarness(width, height, true);
    const first = weaponSwapSlotRect(r, 0);
    const second = weaponSwapSlotRect(r, 1);
    const third = weaponSwapSlotRect(r, 2);
    const skip = weaponSwapSkipRect(r);
    const topStackBottom = r.showAffixes ? r.affixY : r.statsY;

    assert.ok(r.panelY >= 0 && r.panelY + r.panelH <= height, `panel must stay onscreen at ${width}x${height}`);
    assert.ok(topStackBottom + 6 <= first.y, `first slot must clear weapon summary at ${width}x${height}`);
    assert.ok(r.nameMaxW <= r.panelW - 32, `cache weapon title budget must stay inside compact panel at ${width}x${height}`);
    assert.ok(r.statsMaxW <= r.panelW - 36, `cache weapon stats budget must stay inside compact panel at ${width}x${height}`);
    assert.ok(r.affixMaxW <= r.panelW - 36, `cache weapon affix budget must stay inside compact panel at ${width}x${height}`);
    assert.ok(first.h >= 18, `slot hit target must keep a minimum compact height at ${width}x${height}`);
    assert.ok(first.textY > first.y && first.textY < first.y + first.h, `first slot label must stay inside card at ${width}x${height}`);
    assert.equal(first.showActiveLabel, false, `compact rows must hide ACTIVE to reserve weapon-name space at ${width}x${height}`);
    assert.ok(first.indexX < first.nameX, `slot index must stay left of weapon name at ${width}x${height}`);
    assert.ok(first.nameMaxW >= 20, `weapon name must retain a positive compact text budget at ${width}x${height}`);
    assert.ok(first.nameX + first.nameMaxW <= first.x + first.w - 12,
      `weapon name budget must stay inside compact card at ${width}x${height}`);
    assert.ok(first.y + first.h + 4 <= second.y, `first and second slots must not overlap at ${width}x${height}`);
    assert.ok(second.y + second.h + 4 <= third.y, `second and third slots must not overlap at ${width}x${height}`);
    assert.ok(third.y + third.h + 4 <= skip.y, `third slot must clear SKIP at ${width}x${height}`);
    if (r.showHint) {
      assert.ok(skip.y + skip.h + 9 <= r.hintY, `SKIP must clear rendered footer hint text at ${width}x${height}`);
    } else {
      assert.equal(height < 240, true, `footer hint may only be hidden on ultra-compact layouts at ${width}x${height}`);
    }
    assert.ok(skip.textY > skip.y && skip.textY < skip.y + skip.h, `SKIP label must stay inside button at ${width}x${height}`);
    assert.ok(first.x >= 0 && first.x + first.w <= width, `slot cards must stay onscreen at ${width}x${height}`);
    assert.ok(skip.x >= 0 && skip.x + skip.w <= width, `SKIP button must stay onscreen at ${width}x${height}`);
  }
});

test('weapon-swap hit targets use shared slot and skip rectangle bounds', () => {
  assert.match(GAME, /function fitCanvasText\(text, maxW\)[\s\S]*ctx\.measureText/,
    'WEAPON_SWAP rendering must have a text fitter for ultra-narrow weapon names');
  assert.match(GAME, /ctx\.fillText\(fitCanvasText\(name,\s*box\.nameMaxW\),\s*W \/ 2,\s*box\.nameY\)/,
    'WEAPON_SWAP cache weapon title must be constrained to the layout text budget');
  assert.match(GAME, /ctx\.fillText\(fitCanvasText\(stats,\s*box\.statsMaxW\),\s*W \/ 2,\s*box\.statsY\)/,
    'WEAPON_SWAP cache weapon stats must be constrained to the layout text budget');
  assert.match(GAME, /fitCanvasText\('AFFIXES: ' \+ weapon\._affixes\.join\(' \+ '\),\s*box\.affixMaxW\)/,
    'WEAPON_SWAP cache weapon affixes must be constrained to the layout text budget');
  assert.match(GAME, /if \(box\.showHint\) \{[\s\S]*ctx\.fillText\(hint,\s*W \/ 2,\s*box\.hintY\)/,
    'WEAPON_SWAP footer hint must be hidden when the layout cannot reserve enough text ascent');
  assert.match(GAME, /const\s+rowName\s*=\s*fitCanvasText\([^,]+,\s*box\.rowNameMaxW\)/,
    'WEAPON_SWAP row names must be constrained to the layout text budget');
  assert.match(GAME, /if \(box\.showActiveLabel && i === this\.player\.weaponIdx\)/,
    'WEAPON_SWAP ACTIVE label rendering must be gated by layout width');
  assert.match(GAME, /const\s+box\s*=\s*getWeaponSwapLayout\(narrow\)[\s\S]*my >= y && my <= y \+ box\.rowCardH/,
    'WEAPON_SWAP slot hit-testing must use the shared rowCardH returned by the layout helper');
  assert.match(GAME, /mx >= box\.rowX && mx <= box\.rowX \+ box\.rowW && my >= box\.skipY && my <= box\.skipY \+ box\.skipH/,
    'WEAPON_SWAP skip hit-testing must use the shared skip rectangle returned by the layout helper');
  assert.doesNotMatch(GAME, /my >= y && my <= y \+ box\.rowH - 6/,
    'WEAPON_SWAP hit-testing must not keep a duplicated rowH-minus-gap card height');
});

test('archives touch routing uses explicit row and back hit-tests', () => {
  assert.match(GAME_STATES_SRC, /TOUCH_ROUTE_AS_CLICK_STATES = new Set\(\[[\s\S]*GAME_STATES\.ARCHIVES[\s\S]*GAME_STATES\.GAME_OVER/,
    'ARCHIVES taps must carry coordinates so only visible archive controls can activate');
  assert.doesNotMatch(PLATFORM, /_G\.state === 'ARCHIVES'[\s\S]*META_UPGRADES[\s\S]*bestDist/,
    'platform touch routing must not choose the closest archive row from broad invisible bands');
  assert.doesNotMatch(PLATFORM, /META_UPGRADES/,
    'platform touch routing must not depend on archive upgrade data or layout constants');
  assert.match(GAME, /getArchiveRowRect\(i\) \{[\s\S]*const\s+rowH\s*=\s*narrow \? 42 : 50[\s\S]*const\s+w\s*=\s*W \* 0\.84[\s\S]*const\s+x\s*=\s*\(W - w\) \/ 2[\s\S]*const\s+centerY\s*=\s*\(narrow \? 95 : 120\) \+ i \* rowH[\s\S]*return \{ x, y: centerY - rowH \/ 2, w, h: rowH \};/,
    'archive rows must expose one shared rectangle layout for rendering and hit-testing');
  assert.match(GAME, /getArchiveBackRect\(\) \{[\s\S]*const\s+w\s*=\s*Math\.max\(140,\s*Math\.min\(W - 40,\s*narrow \? 200 : 240\)\)[\s\S]*const\s+h\s*=\s*narrow \? 38 : 42[\s\S]*const\s+x\s*=\s*\(W - w\) \/ 2[\s\S]*const\s+y\s*=\s*H - \(narrow \? 58 : 70\)[\s\S]*return \{ x, y, w, h \};/,
    'archive back button must expose explicit origin X/Y, width, and height');
  assert.match(GAME, /archiveOptionAt\(x, y\) \{[\s\S]*x >= back\.x && x <= back\.x \+ back\.w && y >= back\.y && y <= back\.y \+ back\.h[\s\S]*return -2;[\s\S]*x >= r\.x && x <= r\.x \+ r\.w && y >= r\.y && y <= r\.y \+ r\.h[\s\S]*return i;[\s\S]*return -1;/,
    'archive hit-test must require taps inside every edge of row and back rectangles');
  assert.match(GAME, /if \(jp\('MouseLeft'\)\) \{[\s\S]*const hit = this\.archiveOptionAt\(mouse\.x, mouse\.y\);[\s\S]*if \(hit === -2\)[\s\S]*if \(hit < 0\) return;[\s\S]*this\.archivesSel = hit;/,
    'archive mouse/touch activation must select only a hit-tested visible row or back button');
  assert.match(GAME, /const r = this\.getArchiveRowRect\(i\);[\s\S]*ctx\.fillRect\(r\.x, r\.y, r\.w, r\.h\)[\s\S]*ctx\.strokeRect\(r\.x, r\.y, r\.w, r\.h\)/,
    'archive rendering must share row rectangles with activation and visibly outline row targets');
  assert.match(GAME, /renderArchiveBackButton\(\)[\s\S]*NEON\.draw\.roundRectFillStroke\(ctx, r\.x, r\.y, r\.w, r\.h, 6\)[\s\S]*BACK TO MENU/,
    'archive screen must draw the explicit back button it hit-tests');
  assert.doesNotMatch(GAME, /Tap upgrade to buy\s*\|\s*← Back/,
    'archive touch copy must not imply a broad invisible back area');
});

test('mobile minimap touch expansion hitbox scales with settings.minimapScale', () => {
  assert.match(PLATFORM, /const\s+_miniW\s*=\s*Math\.round\(\s*120\s*\*\s*settings\.minimapScale\s*\)/,
    'minimap touch hitbox width must match the rendered minimap width');
  assert.match(PLATFORM, /const\s+_miniH\s*=\s*Math\.round\(\s*80\s*\*\s*settings\.minimapScale\s*\)/,
    'minimap touch hitbox height must match the rendered minimap height');
  assert.match(PLATFORM, /const\s+_mx\s*=\s*W\s*-\s*_miniW\s*-\s*8\s*-\s*safeRight/,
    'minimap touch hitbox anchor must reserve the scaled minimap width from the right edge');
  assert.match(PLATFORM, /_my\s*=\s*8\s*\+\s*safeTop/,
    'minimap touch hitbox Y anchor must match the rendered minimap top edge');
  assert.match(PLATFORM, /cx\s*>=\s*_mx\s*-\s*2/,
    'minimap touch hitbox must extend 2px left of the scaled minimap');
  assert.match(PLATFORM, /cx\s*<=\s*_mx\s*\+\s*_miniW\s*\+\s*2/,
    'minimap touch hitbox must extend 2px right of the scaled minimap');
  assert.match(PLATFORM, /cy\s*>=\s*_my\s*-\s*2/,
    'minimap touch hitbox must extend 2px above the scaled minimap');
  assert.match(PLATFORM, /cy\s*<=\s*_my\s*\+\s*_miniH\s*\+\s*2/,
    'minimap touch hitbox must extend 2px below the scaled minimap');
});

test('touch buttons render semantic captions next to glyph labels', () => {
  assert.match(PLATFORM, /@typedef \{\{ x:number, y:number, r:number, label:string, caption:string, colour:string, hidden\?:boolean \}\} TouchBtn/,
    'touch button shape must carry both short glyph labels and semantic captions');
  assert.match(PLATFORM, /E:\s*\{[^}]*caption:\s*'USE'/,
    'interact button must disclose its action instead of relying only on the E glyph');
  assert.match(PLATFORM, /F:\s*\{[^}]*caption:\s*'HACK'/,
    'hackware button must disclose its action instead of relying only on the F glyph');
  assert.match(PLATFORM, /V:\s*\{[^}]*caption:\s*'BOMB'/,
    'void shard button must disclose its action instead of relying only on the V glyph');
  assert.match(PLATFORM, /DASH:\s*\{[^}]*caption:\s*'DASH'/,
    'dash button must disclose its action instead of relying only on the arrow glyph');
  assert.match(PLATFORM, /PAUSE:\s*\{[^}]*caption:\s*'PAUSE'/,
    'pause button must disclose its action instead of relying only on the pause glyph');
  assert.doesNotMatch(PLATFORM, /ctx\.globalAlpha\s*=\s*Math\.max\(ctx\.globalAlpha/,
    'captions must inherit disabled/cooldown alpha instead of becoming brighter than unavailable buttons');
  assert.match(PLATFORM, /const\s+btnY\s*=\s*layout\.hudTop\s*-\s*BTNS\.E\.r\s*-\s*28/,
    'button row must leave room for captions above the HUD background');
  assert.match(PLATFORM, /const\s+TOUCH_BTN_CAPTION_GAP\s*=\s*6/,
    'caption vertical gap must be named so stacked button geometry can account for it');
  assert.match(PLATFORM, /const\s+TOUCH_BTN_CAPTION_FONT_SIZE\s*=\s*9/,
    'caption font size must be named so stacked button geometry can account for it');
  assert.match(PLATFORM, /const\s+stackedBtnGap\s*=\s*BTNS\.E\.r\s*\+\s*BTNS\.V\.r\s*\+\s*TOUCH_BTN_CAPTION_GAP\s*\+\s*TOUCH_BTN_CAPTION_FONT_SIZE\s*\+\s*1/,
    'stacked buttons must account for caption height so BOMB caption does not overlap the USE hit target');
  assert.match(PLATFORM, /BTNS\.V\.y\s*=\s*btnY\s*-\s*stackedBtnGap/,
    'BOMB button vertical position must be derived from the radius-aware stacked spacing');
  assert.match(PLATFORM, /ctx\.font\s*=\s*`bold \$\{TOUCH_BTN_CAPTION_FONT_SIZE\}px monospace`/,
    'caption rendering must use the same font-size constant as stacked geometry');
  assert.match(PLATFORM, /ctx\.fillText\(btn\.caption,\s*btn\.x,\s*btn\.y\s*\+\s*btn\.r\s*\+\s*TOUCH_BTN_CAPTION_GAP\)/,
    'captions must be rendered below the button circle using the documented gap');
});
