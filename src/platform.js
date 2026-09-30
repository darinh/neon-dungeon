// @ts-check
'use strict';

// Logical canvas size (raw backing / worldZoom). Renderers and layout use this space.
// worldZoom is a ctx.scale wrap; pointer input is divided by it once at the host boundary.
let W = 900, H = 600;
// Pre-zoom backing size (vw / gameScale), reused when first-resize defaults change worldZoom mid-call.
let rawW = 900, rawH = 600;
let gameScale = 1;
const TILE = 32;
const MAP_W = 80, MAP_H = 50;
const TWO_PI = Math.PI * 2;
const SAVE_VERSION = '9.0';

const T = { VOID:0, WALL:1, FLOOR:2, STAIRS:3, TERMINAL:4, DOOR:5, DOOR_OPEN:6, LOCKED_R:7, LOCKED_B:8, LOCKED_G:9, TRAP_SPIKE:10, TRAP_SLOW:11, PLASMA:12, ARC:13, VENDOR:14, CRACKED:15, LORE:16, CHALLENGE_GATE:17, IMPLANT_SHRINE:18, EVENT_TERMINAL:19, TELEPORT_PAD:20, CRATE:21, TOXIC:22, SHOCK_TILE:23, REPULSOR:24, MAINFRAME_READER:25, NETWORK_PORTAL:26, MESSAGE_CONSOLE:27, LOGIC_NODE:28, LOGIC_NODE_LIT:29, SEAM_WALL:30, SYNC_CONSOLE:31 };

/** @type {Record<string, string>} */
const DEFAULT_KEY_MAP = {
  up:'KeyW', down:'KeyS', left:'KeyA', right:'KeyD',
  interact:'KeyE', hackware:'KeyF', voidshard:'KeyV',
  dash:'ShiftLeft', shoot:'Space'
};
/** @type {Record<string, string>} */
const ACTION_LABELS = {
  up:'Move Up', down:'Move Down', left:'Move Left', right:'Move Right',
  interact:'Interact', hackware:'Hackware', voidshard:'Bomb',
  dash:'Dash', shoot:'Shoot'
};
const RESERVED_KEYS = new Set(['Escape','Enter','KeyQ','Digit1','Digit2','Digit3','Tab','F3']);
/** @param {string | null | undefined} k */
const KEY_DISPLAY = k => {
  if (!k) return '???';
  if (k.startsWith('Key')) return k.slice(3);
  if (k.startsWith('Digit')) return k.slice(5);
  if (k.startsWith('Arrow')) return '↑↓←→'[['Up','Down','Left','Right'].indexOf(k.slice(5))] || k.slice(5);
  /** @type {Record<string,string>} */
  const map = {ShiftLeft:'L-Shift',ShiftRight:'R-Shift',Space:'Space',
    ControlLeft:'L-Ctrl',ControlRight:'R-Ctrl',AltLeft:'L-Alt',AltRight:'R-Alt',
    Tab:'Tab',Backspace:'Bksp',CapsLock:'Caps',Backquote:'`',
    Minus:'-',Equal:'=',BracketLeft:'[',BracketRight:']',
    Backslash:'\\',Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/'};
  return map[k] || k;
};

// Only legal stepper values. load() snaps anything else so old saves cannot leak intermediate scales.
const MINIMAP_SCALE_STEPS = [0.75, 1.0, 1.25, 1.5];
const TEXT_SCALE_STEPS    = [0.85, 1.0, 1.15, 1.3];
// Whole-frame zoom, including HUD. Its wider range extends the ~22–48 CSS-px tile auto-fit.
const WORLD_ZOOM_STEPS    = [1.0, 1.25, 1.5, 1.75, 2.0, 2.5];

/**
 * @param {number} v
 * @param {number[]} steps
 * @returns {number}
 */
function snapToSteps(v, steps) {
  if (!steps.length) return v;
  let best = /** @type {number} */ (steps[0]);
  let bestDist = Math.abs(v - best);
  for (let i = 1; i < steps.length; i++) {
    const s = /** @type {number} */ (steps[i]);
    const d = Math.abs(v - s);
    if (d < bestDist) { best = s; bestDist = d; }
  }
  return best;
}

/** @type {{ sfxVol:number, musicVol:number, screenShake:boolean, damageNumbers:boolean, lockAimToMove:boolean, aimAssist:boolean, crtMode:boolean, reducedMotion:boolean, minimapScale:number, textScale:number, worldZoom:number, _worldZoomFromDefault:boolean, keyMap:Record<string,string>, load():void, save():void, resetAll():void, applyMobileFirstDefaults():void }} */
const settings = {
  sfxVol: 1.0,
  musicVol: 1.0,
  screenShake: true,
  damageNumbers: true,
  lockAimToMove: false,
  aimAssist: false,  // auto-aim at the nearest eligible LOS enemy under 4 tiles
  crtMode: false,    // scanline + vignette overlay
  reducedMotion: false,
  minimapScale: 1.0,
  textScale: 1.0,
  worldZoom: 1.0,
  // True while the one-shot viewport default is pending. Persisted so an accepted 1.0 is not replaced in later sessions or viewports.
  _worldZoomFromDefault: true,
  keyMap: { ...DEFAULT_KEY_MAP },
  load() {
    try {
      const raw = JSON.parse(localStorage.getItem('neonDungeonSettings') || 'null');
      // Keep _worldZoomFromDefault true so resize() can still apply the compact default.
      if (!raw) return;
      if (typeof raw.sfxVol === 'number') this.sfxVol = Math.max(0, Math.min(1, raw.sfxVol));
      if (typeof raw.musicVol === 'number') this.musicVol = Math.max(0, Math.min(1, raw.musicVol));
      if (typeof raw.screenShake === 'boolean') this.screenShake = raw.screenShake;
      if (typeof raw.damageNumbers === 'boolean') this.damageNumbers = raw.damageNumbers;
      if (typeof raw.lockAimToMove === 'boolean') this.lockAimToMove = raw.lockAimToMove;
      if (typeof raw.aimAssist === 'boolean') this.aimAssist = raw.aimAssist;
      if (typeof raw.crtMode === 'boolean') this.crtMode = raw.crtMode;
      if (typeof raw.reducedMotion === 'boolean') this.reducedMotion = raw.reducedMotion;
      // Snap so a tampered or older save cannot store a scale the stepper does not expose.
      if (typeof raw.minimapScale === 'number' && Number.isFinite(raw.minimapScale)) {
        this.minimapScale = snapToSteps(raw.minimapScale, MINIMAP_SCALE_STEPS);
      }
      if (typeof raw.textScale === 'number' && Number.isFinite(raw.textScale)) {
        this.textScale = snapToSteps(raw.textScale, TEXT_SCALE_STEPS);
      }
      // A persisted zoom is intent. Leave the flag true only when the key is absent.
      if (typeof raw.worldZoom === 'number' && Number.isFinite(raw.worldZoom)) {
        this.worldZoom = snapToSteps(raw.worldZoom, WORLD_ZOOM_STEPS);
        this._worldZoomFromDefault = false;
      }
      // Old saves omit the flag, so they still receive the one-shot compact default.
      if (typeof raw._worldZoomFromDefault === 'boolean') {
        this._worldZoomFromDefault = raw._worldZoomFromDefault;
      }
      if (raw.keyMap && typeof raw.keyMap === 'object') {
        for (const a of Object.keys(DEFAULT_KEY_MAP)) {
          if (typeof raw.keyMap[a] === 'string') this.keyMap[a] = raw.keyMap[a];
        }
      }
    } catch(e) {}
  },
  // One-shot after the first real viewport measurement. Persistence prevents later sessions or rotations from clobbering the accepted zoom.
  applyMobileFirstDefaults() {
    if (!this._worldZoomFromDefault) return;
    // Same predicate as engine/viewport.js computeLayout (`H > W && W <= 600`). Do not re-derive it here.
    const isCompact = !!(layout && layout.compact);
    if (isCompact) {
      this.worldZoom = 1.5;
    }
    // Latch even when not compact, or a later compact resize would replace the accepted 1.0 default.
    this._worldZoomFromDefault = false;
    this.save();
  },
  save() {
    try {
      localStorage.setItem('neonDungeonSettings', JSON.stringify({
        sfxVol: this.sfxVol, musicVol: this.musicVol,
        screenShake: this.screenShake, damageNumbers: this.damageNumbers,
        lockAimToMove: this.lockAimToMove,
        aimAssist: this.aimAssist,
        crtMode: this.crtMode,
        reducedMotion: this.reducedMotion,
        minimapScale: this.minimapScale,
        textScale: this.textScale,
        worldZoom: this.worldZoom,
        _worldZoomFromDefault: this._worldZoomFromDefault,
        keyMap: this.keyMap
      }));
    } catch(e) {}
  },
  resetAll() {
    this.sfxVol = 1.0; this.musicVol = 1.0;
    this.screenShake = true; this.damageNumbers = true;
    this.lockAimToMove = false;
    this.aimAssist = false;
    this.crtMode = false;
    this.reducedMotion = false;
    this.minimapScale = 1.0;
    this.textScale = 1.0;
    // Settings reset runs after the canvas exists, so compact is already known. Clearing the flag stops resize() from applying the default again.
    const isCompact = !!(layout && layout.compact);
    this.worldZoom = isCompact ? 1.5 : 1.0;
    this._worldZoomFromDefault = false;
    this.keyMap = { ...DEFAULT_KEY_MAP }; this.save();
  }
};
settings.load();

/** @param {string} action */
function km(action) { return settings.keyMap[action]; }
// Alternate keys that always work alongside the mapped key
const ALT_KEYS = { up:'ArrowUp', down:'ArrowDown', left:'ArrowLeft', right:'ArrowRight', dash:'ShiftRight' };

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('c'));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
canvas.width = W; canvas.height = H;

// Lazy alias: platform.js loads before game.js, so `game` does not exist yet.
/** @type {any} */
const _G = new Proxy({}, {
  get: (_t, p) => /** @type {any} */ (game)[p],
  set: (_t, p, v) => { /** @type {any} */ (game)[p] = v; return true; },
  has: (_t, p) => p in /** @type {any} */ (game),
});

// Viewport math is engine/viewport.js. This file still owns W/H/gameScale/safe-area for src/* consumers.
const _PG_STATE_DEFS = /** @type {any} */ (requireNEON('gameStates', 'src/platform.js'));
const _PG_STATES = _PG_STATE_DEFS.GAME_STATES;
/** @type {any} */
const _vp = /** @type {any} */ (requireNEON('viewport', 'src/platform.js'));

// Pre-worldZoom canvas px (CSS safe-area px / gameScale), not CSS px.
let safeTop = 0, safeRight = 0, safeBottom = 0, safeLeft = 0;

let scale = 1, offX = 0, offY = 0;
function resize() {
  // getBoundingClientRect, not innerHeight: dvh/vh and the mobile URL bar disagree with the window.
  const rect = canvas.getBoundingClientRect();
  const vw = rect.width  || window.innerWidth;
  const vh = rect.height || window.innerHeight;
  // Clamps pre-worldZoom tiles to ~22–48 CSS px. The formula is engine/viewport.js computeScale.
  gameScale = _vp.computeScale(vw, vh);
  const _sz = _vp.computeLogicalSize(vw, vh, gameScale);
  // Backing size is pre-worldZoom. W/H are raw/worldZoom; render applies the matching ctx.scale.
  rawW = _sz.W;
  rawH = _sz.H;
  canvas.width  = rawW;
  canvas.height = rawH;

  const _wz = (settings && settings.worldZoom) || 1;
  W = Math.max(1, Math.round(rawW / _wz));
  H = Math.max(1, Math.round(rawH / _wz));
  scale = gameScale;
  offX = 0;
  offY = 0;
  // CSS env() px divided by gameScale; worldZoom is not applied to these inset values.
  const cs = getComputedStyle(document.documentElement);
  const _sa = _vp.parseSafeAreaInsets((/** @type {string} */ n) => cs.getPropertyValue(n), gameScale);
  safeTop    = _sa.top;
  safeRight  = _sa.right;
  safeBottom = _sa.bottom;
  safeLeft   = _sa.left;
  updateLayout();
  const _wzBefore = (settings && settings.worldZoom) || 1;
  settings.applyMobileFirstDefaults();
  const _wzAfter = (settings && settings.worldZoom) || 1;
  // The layout above used the pre-bump zoom. A compact first boot would otherwise scale 1.5 over stale 1.0 bounds.
  if (_wzAfter !== _wzBefore) {
    W = Math.max(1, Math.round(rawW / _wzAfter));
    H = Math.max(1, Math.round(rawH / _wzAfter));
    updateLayout();
  }
  console.log(`[NEON DUNGEON] ${vw.toFixed(0)}×${vh.toFixed(0)} → ${W}×${H} (×${gameScale.toFixed(2)}) tile=${(TILE*gameScale).toFixed(1)}css-px compact=${layout.compact}`);
}
// The resize listener is registered at the end of game.js, after every definition it closes over exists.

const layout = { compact: false, hudH: 40, hudTop: 0, msgBase: 0 };
function updateLayout() {
  const _l = _vp.computeLayout(W, H, safeBottom);
  layout.compact = _l.compact;
  layout.hudH    = _l.hudH;
  layout.hudTop  = _l.hudTop;
  layout.msgBase = _l.msgBase;
}

// lib.dom.d.ts has no webkit fullscreen names. Safari/iOS still need the prefixed calls.
const _fsCanvas = /** @type {any} */ (canvas);
const _fsDoc = /** @type {any} */ (document);
const fsApi = {
  request: _fsCanvas.requestFullscreen ? 'requestFullscreen'
         : _fsCanvas.webkitRequestFullscreen ? 'webkitRequestFullscreen' : null,
  exit: _fsDoc.exitFullscreen ? 'exitFullscreen'
      : _fsDoc.webkitExitFullscreen ? 'webkitExitFullscreen' : null,
  element: () => _fsDoc.fullscreenElement ?? _fsDoc.webkitFullscreenElement,
  supported: !!(_fsCanvas.requestFullscreen || _fsCanvas.webkitRequestFullscreen),
};
let fsWantLandscape = false;   // landscape, but fullscreen still needs a gesture
let fsDismissed = false;       // runtime-only; reset on the next portrait→landscape transition

function isLandscape() {
  return _vp.isLandscape(window, screen);
}

function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function tryFullscreen() {
  if (!fsApi.supported || fsApi.element()) return;
  try {
    const req = fsApi.request;
    if (!req) return;
    const ret = /** @type {any} */ (document.documentElement)[req]?.();
    if (ret && typeof ret.catch === 'function') ret.catch(() => {});
  } catch (_) {}
}

function exitFullscreen() {
  if (!fsApi.element()) return;
  try {
    const ex = fsApi.exit;
    if (!ex) return;
    const ret = /** @type {any} */ (document)[ex]?.();
    if (ret && typeof ret.catch === 'function') ret.catch(() => {});
  } catch (_) {}
}

let fsWasLandscape = false;
function onOrientationChange() {
  if (!isTouchDevice()) return;
  const landscape = isLandscape();
  if (landscape) {
    fsWantLandscape = true;
    // Reset dismiss only on portrait→landscape, not on every landscape resize.
    if (!fsWasLandscape) fsDismissed = false;
  } else {
    fsWantLandscape = false;
    exitFullscreen();
  }
  fsWasLandscape = landscape;
}

if (screen.orientation) {
  screen.orientation.addEventListener('change', onOrientationChange);
} else {
  window.addEventListener('orientationchange', onOrientationChange);
}
// Some browsers emit resize instead of orientationchange.
window.addEventListener('resize', onOrientationChange);
onOrientationChange();

// Held keys live in engine/input.js. The hidden seed input is the focus target mobile browsers require before they show the OS keyboard.
const _input = /** @type {any} */ (requireNEON('input', 'src/platform.js')).createEngine({
  win: window,
  onKeyDown: (/** @type {any} */ e) => {
    lastKey = e.key;
    recordTypedKey(typedChars, e.key);
    resumeInteractiveAudio(e.key === 'Enter' || e.code === 'Enter');
  },
});
_input.attach();
const keys = _input.keys;
const justPressed = _input.justPressed;
const justReleased = _input.justReleased;
const mouse = { x: W/2, y: H/2, down: false };
let lastKey = '';
// lastKey keeps only the frame's final keydown, so two keys in one frame would drop a character.
/** @type {string[]} */
const typedChars = [];
const TYPED_CHARS_MAX = 32;
/**
 * @param {string[]} buffer
 * @param {any} key KeyboardEvent.key
 */
function recordTypedKey(buffer, key) {
  if (typeof key !== 'string' || key.length !== 1) return;
  if (buffer.length >= TYPED_CHARS_MAX) return;
  buffer.push(key);
}
/** @type {any} */
let nameEntryTap = null;
/** @type {HTMLInputElement | null} */
let seedSetupInput = null;

/** @returns {string} */
function currentSeedSetupSeed() {
  return _G.seedSetup && typeof _G.seedSetup.seed === 'string' ? _G.seedSetup.seed : '';
}

/** @returns {HTMLInputElement} */
function ensureSeedSetupInput() {
  if (seedSetupInput) return seedSetupInput;
  const el = document.createElement('input');
  el.type = 'text';
  el.inputMode = 'text';
  el.autocomplete = 'off';
  el.autocapitalize = 'none';
  el.spellcheck = false;
  el.maxLength = 64;
  el.setAttribute('aria-label', 'Run seed');
  el.style.position = 'fixed';
  el.style.left = '0';
  el.style.top = '0';
  el.style.width = '1px';
  el.style.height = '1px';
  el.style.opacity = '0.01';
  el.style.border = '0';
  el.style.padding = '0';
  el.style.background = 'transparent';
  el.style.color = 'transparent';
  el.style.fontSize = '16px';
  el.style.pointerEvents = 'none';
  el.style.zIndex = '-1';
  el.addEventListener('input', () => {
    if (_G.state !== _PG_STATES.SEED_SETUP) return;
    const value = typeof _G.setSeedSetupSeed === 'function' ? _G.setSeedSetupSeed(el.value) : el.value;
    if (el.value !== value) el.value = value;
  });
  el.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      el.blur();
      justPressed.add('Enter');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      el.blur();
      justPressed.add('Escape');
    }
  });
  el.addEventListener('keyup', e => {
    e.stopPropagation();
  });
  document.body.appendChild(el);
  seedSetupInput = el;
  return el;
}

/**
 * @param {number} clientX
 * @param {number} clientY
 */
function focusSeedSetupInput(clientX, clientY) {
  const el = ensureSeedSetupInput();
  el.value = currentSeedSetupSeed();
  el.style.left = Math.max(0, Math.round(clientX)) + 'px';
  el.style.top = Math.max(0, Math.round(clientY)) + 'px';
  el.focus();
  el.setSelectionRange(el.value.length, el.value.length);
}

function blurSeedSetupInput() {
  if (seedSetupInput && document.activeElement === seedSetupInput) seedSetupInput.blur();
}

function menuTitleNeedsGestureUnlock() {
  if (_G.state !== _PG_STATES.MENU || _G._menuTitleUnlockConsumed) return false;
  try {
    return typeof music !== 'undefined' && music && music.isTitlePlaying && !music.isTitlePlaying();
  } catch (_) {
    return false;
  }
}

/** @param {boolean} consumeMenuActivation */
function resumeInteractiveAudio(consumeMenuActivation) {
  const consumeTitleUnlock = consumeMenuActivation && menuTitleNeedsGestureUnlock();
  audio.resume();
  const menuMusicState = _PG_STATE_DEFS.isMenuMusicState(_G.state, _G._settingsFrom);
  if (menuMusicState) {
    try { if (typeof music !== 'undefined') music.resume(); } catch (_) {}
  }
  if (consumeTitleUnlock) _G._menuTitleUnlockPending = true;
}

/**
 * @param {number} clientX
 * @param {number} clientY
 */
function updateMouseFromClient(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  // CSS px → backing px → logical px. The only /worldZoom site for mouse input.
  const _wz = (settings && settings.worldZoom) || 1;
  mouse.x = (clientX - r.left) * canvas.width  / r.width  / _wz;
  mouse.y = (clientY - r.top)  * canvas.height / r.height / _wz;
}

canvas.addEventListener('mousemove', e => {
  updateMouseFromClient(e.clientX, e.clientY);
});
canvas.addEventListener('mousedown', e => { updateMouseFromClient(e.clientX, e.clientY); mouse.down = true; justPressed.add('MouseLeft'); resumeInteractiveAudio(true); });
canvas.addEventListener('mouseup',   e => { mouse.down = false; });
window.addEventListener('mouseup',   e => { mouse.down = false; });
// Consumers treat WheelDown/WheelUp as weapon-belt cycling.
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  justPressed.add(e.deltaY > 0 ? 'WheelDown' : 'WheelUp');
}, { passive: false });

const JR = 55; // logical px
const TOUCH_BTN_CAPTION_GAP = 6;
const TOUCH_BTN_CAPTION_FONT_SIZE = 9;
/** @type {{ joystick:{active:boolean,id:number|null,baseX:number,baseY:number,dx:number,dy:number}, aim:{active:boolean,id:number|null,baseX:number,baseY:number,dx:number,dy:number,shooting:boolean}, btnE:number|null, btnV:number|null, btnF:number|null, btnDash:number|null, btnPause:number|null }} */
const touch = {
  joystick: { active:false, id:null, baseX:0, baseY:0, dx:0, dy:0 },
  aim:      { active:false, id:null, baseX:0, baseY:0, dx:0, dy:0, shooting:false },
  btnE: null, btnV: null, btnF: null, btnDash: null, btnPause: null,
};

/** @typedef {{ x:number, y:number, r:number, label:string, caption:string, colour:string, hidden?:boolean }} TouchBtn */

/** @type {Record<'E'|'F'|'V'|'DASH'|'PAUSE', TouchBtn>} */
const BTNS = {
  E:     { x:0, y:0, r:30, label:'E',  caption:'USE',   colour:'#00f5ff' },
  F:     { x:0, y:0, r:28, label:'F',  caption:'HACK',  colour:'#ff8800' },
  V:     { x:0, y:0, r:28, label:'V',  caption:'BOMB',  colour:'#aa00ff' },
  DASH:  { x:0, y:0, r:28, label:'⇧',  caption:'DASH',  colour:'#ffb700' },
  PAUSE: { x:0, y:0, r:20, label:'II', caption:'PAUSE', colour:'#ff00c8' },
};
function updateBtns() {
  // Floor radius at 22 CSS px, a 44 CSS-px touch target (the same floor engine/touch.js hitBtn uses), in pre-worldZoom canvas units; the global zoom enlarges it further.
  const minR = 22 / gameScale;
  BTNS.E.r     = Math.max(30, minR);
  BTNS.F.r     = Math.max(28, minR);
  BTNS.V.r     = Math.max(28, minR);
  BTNS.DASH.r  = Math.max(28, minR);
  BTNS.PAUSE.r = Math.max(20, Math.ceil(minR * 0.7));
  // Always shown. drawTouchUI dims it when there is no hackware.
  BTNS.F.hidden = false;
  const pr = Math.max(10, safeRight);
  const pt = Math.max(10, safeTop);
  const btnY = layout.hudTop - BTNS.E.r - 28;
  const stackedBtnGap = BTNS.E.r + BTNS.V.r + TOUCH_BTN_CAPTION_GAP + TOUCH_BTN_CAPTION_FONT_SIZE + 1;
  BTNS.E.x     = W - pr - 230;
  BTNS.E.y     = btnY;
  BTNS.DASH.x  = W - pr - 160;
  BTNS.DASH.y  = btnY;
  BTNS.F.x     = W - pr - 90;
  BTNS.F.y     = btnY;
  BTNS.V.x     = W - pr - 20;
  BTNS.V.y     = btnY - stackedBtnGap;
  BTNS.PAUSE.x = W - pr - 30;
  BTNS.PAUSE.y = pt + 30;
}

// Hit math is engine/touch.js. Wrappers keep canvas and gameScale out of the call sites.
const _touchHelpers = /** @type {any} */ (requireNEON('touch', 'src/platform.js'));

/**
 * @param {number} clientX
 * @param {number} clientY
 * @returns {[number, number]}
 */
function toCanvas(clientX, clientY) {
  // Same CSS-px → logical-px conversion as updateMouseFromClient.
  const [cx, cy] = _touchHelpers.toCanvas(clientX, clientY, canvas);
  const _wz = (settings && settings.worldZoom) || 1;
  return [cx / _wz, cy / _wz];
}

/**
 * @param {number} cx
 * @param {number} cy
 * @param {TouchBtn} btn
 */
function hitBtn(cx, cy, btn) {
  return _touchHelpers.hitBtn(cx, cy, btn, gameScale);
}

/**
 * @param {number} cx
 * @param {number} cy
 */
function routeTouchAsMouseClick(cx, cy) {
  mouse.x = cx;
  mouse.y = cy;
  justPressed.add('MouseLeft');
}

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const consumeTitleUnlock = menuTitleNeedsGestureUnlock();
  resumeInteractiveAudio(false);
  let dismissed = false;
  for (let _i = 0; _i < e.changedTouches.length; _i++) { const t = e.changedTouches[_i]; if (!t) continue;
    const [cx, cy] = toCanvas(t.clientX, t.clientY);
    if (fsWantLandscape && !fsApi.element() && !fsDismissed
        && cx < 48 && cy < 48) {
      fsDismissed = true; dismissed = true;
    }
  }
  // Fullscreen requires a user gesture; this touch is that gesture.
  if (!dismissed && fsWantLandscape && !fsApi.element() && !fsDismissed) tryFullscreen();
  for (let _i = 0; _i < e.changedTouches.length; _i++) { const t = e.changedTouches[_i]; if (!t) continue;
    const [cx, cy] = toCanvas(t.clientX, t.clientY);
    if (cx < 48 && cy < 48 && dismissed) continue;
    if (_G.state !== 'PLAYING' && _G.state !== 'FADE') {
      if (_G.state === 'NAME_ENTRY') { nameEntryTap=[cx,cy]; continue; }
      if (_G.state === _PG_STATES.SEED_SETUP) {
        if (typeof _G.seedSetupFieldHitTest === 'function' && _G.seedSetupFieldHitTest(cx, cy)) {
          focusSeedSetupInput(t.clientX, t.clientY);
          continue;
        }
        blurSeedSetupInput();
        routeTouchAsMouseClick(cx, cy);
        continue;
      }
      if (_PG_STATE_DEFS.TOUCH_ROUTE_AS_CLICK_STATES.has(_G.state)) {
        routeTouchAsMouseClick(cx, cy);
        continue;
      }
      if (_G.state === 'SETTINGS') {
        routeTouchAsMouseClick(cx, cy);
        continue;
      }
      if (_G.state === _PG_STATES.PAUSED) {
        routeTouchAsMouseClick(cx, cy);
        continue;
      }
      else if (_G.state === _PG_STATES.HUB) {
        // No Space or digit keys on mobile. Layout lives in hub.js hitTestHub; do not duplicate it.
        let hit = null;
        try {
          if (typeof NEON !== 'undefined' && NEON.hub && NEON.hub.hitTestHub) {
            hit = NEON.hub.hitTestHub(_G, cx, cy);
          }
        } catch (_) {}
        if (hit && hit.kind === 'terminal') {
          // Select before Enter so updateHub activates the tapped terminal, not the previous selection.
          if (_G.hub) _G.hub.selected = hit.index;
          justPressed.add('Enter');
        } else if (hit && hit.kind === 'descend') {
          justPressed.add('Space');
        } else if (_G.hub && _G.hub.activePanel) {
          // Misses fall through to MouseLeft so updateHub's outside-tap close still runs.
          let consumedByPanel = false;
          try {
            if (typeof NEON !== 'undefined' && NEON.hub && NEON.hub.hitTestActivePanel) {
              consumedByPanel = !!NEON.hub.hitTestActivePanel(_G, cx, cy);
            }
          } catch (_) {}
          if (!consumedByPanel) {
            routeTouchAsMouseClick(cx, cy);
          }
        }
        // Empty hub space must not activate the selected terminal.
      }
      else if (_G.state === _PG_STATES.MENU) {
        const narrow = layout.compact;
        if (_G._newGameConfirm) {
          const c = _G._newGameConfirm;
          const boxW = Math.min(520, W - 40);
          const boxH = narrow ? 180 : 200;
          const bx = (W - boxW) / 2, by = (H - boxH) / 2;
          const btnY = by + (narrow ? 120 : 138);
          if (cx >= bx && cx <= bx + boxW && cy >= by && cy <= by + boxH) {
            if (Math.abs(cy - btnY) < 24) {
              const tapped = (cx < W / 2) ? 0 : 1;
              if (c.selected === tapped) {
                justPressed.add('Enter');
              } else {
                c.selected = tapped;
                audio.menuSelect();
              }
            }
          } else {
            justPressed.add('Escape');
          }
          continue;
        }
        // Duplicates renderMenu font/gap. Change both together.
        const titleFs = narrow ? 56 : 72;
        const ty1 = narrow ? 120 : 160;
        const startY = ty1 + titleFs * 0.95 + 80;
        const gap = narrow ? 48 : 36;
        const opts = _G.getMenuOptions();
        let hit = -1;
        for (let i = 0; i < opts.length; i++) {
          const oy = startY + i * gap;
          if (Math.abs(cy - oy) <= gap / 2) { hit = i; break; }
        }
        if (hit < 0) continue;
        _G.menuSel = hit;
        // Edges cycle difficulty; the center starts. Keyboard users preview with arrows instead.
        if (opts[hit]?.isDiffRow) {
          if (cx < W * 0.35) justPressed.add('ArrowLeft');
          else if (cx > W * 0.65) justPressed.add('ArrowRight');
          else { if (consumeTitleUnlock) _G._menuTitleUnlockPending = true; justPressed.add('Enter'); }
        } else {
          if (consumeTitleUnlock) _G._menuTitleUnlockPending = true;
          justPressed.add('Enter');
        }
      }
      else if (_G.state === 'ENDGAME_CHOICE') {
        // Touch commits in one tap. updateEndgameChoice's 0.5s lock absorbs the fade-in mash.
        if (_G._endgameChoice) {
          _G._endgameChoice.selected = (cx < W / 2) ? 0 : 1;
        }
        justPressed.add('Enter');
      }
      else { justPressed.add('Enter'); justPressed.add('MouseLeft'); }
      continue;
    }
    // Modal: this must stay above the button hit-tests.
    if (_G.mapExpanded) { justPressed.add('Tab'); continue; }
    if (typeof _G.hitSystemMessageIndicator === 'function' && _G.hitSystemMessageIndicator(cx, cy)) {
      routeTouchAsMouseClick(cx, cy);
      continue;
    }
    if (hitBtn(cx,cy,BTNS.E))     { touch.btnE=t.identifier; justPressed.add('CheatE'); justPressed.add(km('interact')); continue; }
    if (hitBtn(cx,cy,BTNS.F)) {
      touch.btnF=t.identifier;
      justPressed.add('CheatF');
      if (_G.player && _G.player.hackware) justPressed.add(km('hackware'));
      continue;
    }
    if (hitBtn(cx,cy,BTNS.V))     { touch.btnV=t.identifier; justPressed.add(km('voidshard')); continue; }
    if (hitBtn(cx,cy,BTNS.DASH))  { touch.btnDash=t.identifier; justPressed.add('CheatShift'); justPressed.add(km('dash')); continue; }
    if (hitBtn(cx,cy,BTNS.PAUSE)) { touch.btnPause=t.identifier; justPressed.add('Escape'); continue; }
    // After the pause button, or a pause tap in this rect would expand the map.
    const _miniW = Math.round(120 * settings.minimapScale);
    const _miniH = Math.round(80 * settings.minimapScale);
    const _mx = W - _miniW - 8 - safeRight, _my = 8 + safeTop;
    if (cx >= _mx - 2 && cx <= _mx + _miniW + 2 && cy >= _my - 2 && cy <= _my + _miniH + 2) { justPressed.add('Tab'); continue; }
    if (cx < W/2 && !touch.joystick.active) {
      touch.joystick.active=true; touch.joystick.id=t.identifier;
      touch.joystick.baseX=cx;   touch.joystick.baseY=cy;
      touch.joystick.dx=0;       touch.joystick.dy=0;
    } else if (cx >= W/2 && !touch.aim.active) {
      touch.aim.active=true; touch.aim.id=t.identifier;
      touch.aim.baseX=cx; touch.aim.baseY=cy;
      touch.aim.dx=0; touch.aim.dy=0; touch.aim.shooting=true;
      // Aim uses mouse, which otherwise still sits at its last desktop position.
      mouse.x=cx; mouse.y=cy;
      justPressed.add('MouseLeft');
    }
  }
}, {passive:false});

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  for (let _i = 0; _i < e.changedTouches.length; _i++) { const t = e.changedTouches[_i]; if (!t) continue;
    const [cx, cy] = toCanvas(t.clientX, t.clientY);
    if (t.identifier === touch.joystick.id) {
      let dx=cx-touch.joystick.baseX, dy=cy-touch.joystick.baseY;
      const len=Math.sqrt(dx*dx+dy*dy);
      if (len>JR) { dx=dx/len*JR; dy=dy/len*JR; }
      touch.joystick.dx=dx/JR; touch.joystick.dy=dy/JR;
    }
    if (t.identifier === touch.aim.id) {
      let adx=cx-touch.aim.baseX, ady=cy-touch.aim.baseY;
      const alen=Math.sqrt(adx*adx+ady*ady);
      if (alen>JR) { adx=adx/alen*JR; ady=ady/alen*JR; }
      touch.aim.dx=adx/JR; touch.aim.dy=ady/JR;
      touch.aim.shooting=true;
    }
  }
}, {passive:false});

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  for (let _i = 0; _i < e.changedTouches.length; _i++) { const t = e.changedTouches[_i]; if (!t) continue;
    if (t.identifier===touch.joystick.id) { touch.joystick.active=false; touch.joystick.dx=0; touch.joystick.dy=0; }
    if (t.identifier===touch.aim.id)      { touch.aim.active=false; touch.aim.shooting=false; touch.aim.dx=0; touch.aim.dy=0; mouse.down=false; }
    if (t.identifier===touch.btnE)   touch.btnE=null;
    if (t.identifier===touch.btnF)   touch.btnF=null;
    if (t.identifier===touch.btnV)   touch.btnV=null;
    if (t.identifier===touch.btnDash) touch.btnDash=null;
    if (t.identifier===touch.btnPause) touch.btnPause=null;
  }
}, {passive:false});

canvas.addEventListener('touchcancel', e => {
  e.preventDefault();
  resetTouch();
}, {passive:false});

function resetTouch() {
  _touchHelpers.resetTouch(touch, mouse);
}

function drawTouchUI() {
  // Render gate only. Touch hit-tests never run for mouse events.
  if (!isTouchDevice()) return;
  BTNS.F.hidden = false;
  if (touch.joystick.active) {
    const {baseX:bx,baseY:by,dx,dy}=touch.joystick;
    ctx.save();
    ctx.globalAlpha=0.35;
    ctx.strokeStyle='#00f5ff'; ctx.lineWidth=2;
    NEON.draw.circleStroke(ctx,bx,by,JR);
    ctx.fillStyle='#00f5ff';
    NEON.draw.circle(ctx,bx+dx*JR,by+dy*JR,18);
    ctx.restore();
  } else {
    const hintY = layout.hudTop - 26;
    ctx.save(); ctx.globalAlpha=0.12;
    ctx.strokeStyle='#00f5ff'; ctx.lineWidth=1.5;
    NEON.draw.circleStroke(ctx,80,hintY,JR);
    ctx.fillStyle='#00f5ff';
    NEON.draw.circle(ctx,80,hintY,18);
    ctx.restore();
  }
  if (touch.aim.active) {
    const {baseX:bx,baseY:by,dx,dy}=touch.aim;
    ctx.save();
    ctx.globalAlpha=0.35;
    ctx.strokeStyle='#ff00c8'; ctx.lineWidth=2;
    NEON.draw.circleStroke(ctx,bx,by,JR);
    ctx.fillStyle='#ff00c8';
    NEON.draw.circle(ctx,bx+dx*JR,by+dy*JR,18);
    ctx.restore();
  } else {
    const hintY = layout.hudTop - 26;
    ctx.save(); ctx.globalAlpha=0.12;
    ctx.strokeStyle='#ff00c8'; ctx.lineWidth=1.5;
    NEON.draw.circleStroke(ctx,W/2+80,hintY,JR);
    ctx.fillStyle='#ff00c8';
    NEON.draw.circle(ctx,W/2+80,hintY,18);
    ctx.restore();
  }
  for (const [key,btn] of Object.entries(BTNS)) {
    if (btn.hidden) continue;
    const active = (key==='E'&&touch.btnE!==null)||(key==='F'&&touch.btnF!==null)||(key==='V'&&touch.btnV!==null)||(key==='DASH'&&touch.btnDash!==null)||(key==='PAUSE'&&touch.btnPause!==null);
    const noHackware = key==='F' && !(_G.player && _G.player.hackware);
    ctx.save();
    if (key==='DASH' && _G.player && _G.player.dashCooldown > 0) {
      ctx.globalAlpha = 0.25;
    } else if (key==='F' && noHackware) {
      ctx.globalAlpha = 0.15;
    } else if (key==='F' && _G.player && _G.player.hackwareCooldown > 0) {
      ctx.globalAlpha = 0.25;
    } else if (key==='V' && _G.player && _G.player.bombCooldown > 0) {
      ctx.globalAlpha = 0.25;
    } else {
      ctx.globalAlpha = active ? 0.9 : 0.45;
    }
    ctx.shadowBlur=10; ctx.shadowColor=btn.colour;
    ctx.strokeStyle=btn.colour; ctx.lineWidth=2;
    NEON.draw.circleStroke(ctx,btn.x,btn.y,btn.r);
    ctx.fillStyle=btn.colour+'33';
    NEON.draw.circle(ctx,btn.x,btn.y,btn.r);
    const labelSize = key === 'PAUSE' ? 11 : key === 'DASH' ? 20 : 14;
    ctx.fillStyle=btn.colour; ctx.font=`bold ${labelSize}px monospace`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(btn.label,btn.x,btn.y);
    ctx.shadowBlur = 0;
    ctx.font = `bold ${TOUCH_BTN_CAPTION_FONT_SIZE}px monospace`;
    ctx.textBaseline = 'top';
    ctx.fillText(btn.caption, btn.x, btn.y + btn.r + TOUCH_BTN_CAPTION_GAP);
    ctx.restore();
  }
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';

  if (fsWantLandscape && !fsApi.element() && !fsDismissed && fsApi.supported) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    const pw = 180, ph = 32, px = (W - pw) / 2, py = 6;
    ctx.fillStyle = '#0a0a12';
    ctx.strokeStyle = '#00f5ff';
    ctx.lineWidth = 1;
    NEON.draw.rectFillStroke(ctx, px, py, pw, ph);
    ctx.fillStyle = '#00f5ff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('TAP FOR FULLSCREEN', W / 2, py + ph / 2);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ff00c8';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('×', 24, 22);
    ctx.restore();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
}

/** @param {string} code */
function jp(code) { return justPressed.has(code); }
function clearJust() {
  _input.clearJust();
  lastKey='';
  typedChars.length = 0;
  nameEntryTap=null;
  if (_G.state !== 'SEED_SETUP') blurSeedSetupInput();
}

// rnd/clamp/dist/norm/lerp are engine/math.js globals. Redeclaring one here would shadow them.
/** @param {{x:number,y:number}} entity */
function clampToBossRoom(entity) {
  if (!_G.bossSealed || !_G.bossRoom) return;
  const r = _G.bossRoom;
  entity.x = Math.max(r.x + 0.5, Math.min(r.x + r.w - 0.5, entity.x));
  entity.y = Math.max(r.y + 0.5, Math.min(r.y + r.h - 0.5, entity.y));
  // A sealed entrance is a wall on the room's own edge. Pull in only then, so edge-ring floor stays usable.
  const map = _G.dungeon && _G.dungeon.map;
  const row = map && map[Math.floor(entity.y)];
  if (row && !isPassable(row[Math.floor(entity.x)])) {
    entity.x = Math.max(r.x + 1.5, Math.min(r.x + r.w - 1.5, entity.x));
    entity.y = Math.max(r.y + 1.5, Math.min(r.y + r.h - 1.5, entity.y));
  }
}
function playerKnockMul() {
  // _G is a Proxy, so it is always truthy. typeof game is the guard that actually short-circuits.
  if (typeof game === 'undefined') return 1;
  const p = _G.player;
  return (p && p.metaFlags && p.metaFlags.knockbackTakenMul) || 1;
}

// Key is (fromTile << 16) | toTile. 4000 tiles fit in 16 bits. game.update() and every map mutation must clear this.
const _losCache = new Map();
let _losHits = 0, _losMisses = 0;
function clearLosCache() { _losCache.clear(); _losHits = 0; _losMisses = 0; }
function _losCacheStats() { return { size: _losCache.size, hits: _losHits, misses: _losMisses }; }

/** @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 @param {any} map */
function _hasLOSRaw(x1, y1, x2, y2, map) {
  let cx = Math.floor(x1), cy = Math.floor(y1);
  const ex = Math.floor(x2), ey = Math.floor(y2);
  const dx = Math.abs(ex-cx), dy = Math.abs(ey-cy);
  const sx = cx<ex?1:-1, sy = cy<ey?1:-1;
  let err = dx - dy;
  for (let i=0; i<100; i++) {
    if (cx===ex && cy===ey) return true;
    if (cx<0||cy<0||cx>=MAP_W||cy>=MAP_H) return false;
    if (!isSeeThrough(map[cy][cx])) return false;
    const e2 = 2*err;
    let nx = cx, ny = cy;
    if (e2 > -dy) { err -= dy; nx += sx; }
    if (e2 <  dx) { err += dx; ny += sy; }
    // Two walls touching at a corner still block sight.
    if (nx !== cx && ny !== cy) {
      if (!isSeeThrough(map[cy]?.[nx]) && !isSeeThrough(map[ny]?.[cx])) return false;
    }
    cx = nx; cy = ny;
  }
  return true;
}

/** @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 @param {any} map */
function hasLOS(x1, y1, x2, y2, map) {
  const fx = Math.floor(x1), fy = Math.floor(y1);
  const tx = Math.floor(x2), ty = Math.floor(y2);
  // OOB tiles alias into the 16-bit key. Raw handles them uncached.
  if (fx < 0 || fy < 0 || fx >= MAP_W || fy >= MAP_H ||
      tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) {
    return _hasLOSRaw(x1, y1, x2, y2, map);
  }
  const from = fy * MAP_W + fx, to = ty * MAP_W + tx;
  const key = (from << 16) | to;
  const cached = _losCache.get(key);
  if (cached !== undefined) { _losHits++; return cached; }
  _losMisses++;
  const result = _hasLOSRaw(x1, y1, x2, y2, map);
  _losCache.set(key, result);
  return result;
}

/** @param {any} t */
function isPassable(t) { return t===T.FLOOR||t===T.STAIRS||t===T.TERMINAL||t===T.DOOR_OPEN||t===T.TRAP_SPIKE||t===T.TRAP_SLOW||t===T.PLASMA||t===T.ARC||t===T.VENDOR||t===T.LORE||t===T.CHALLENGE_GATE||t===T.IMPLANT_SHRINE||t===T.EVENT_TERMINAL||t===T.TELEPORT_PAD||t===T.TOXIC||t===T.SHOCK_TILE||t===T.REPULSOR||t===T.MAINFRAME_READER||t===T.NETWORK_PORTAL||t===T.MESSAGE_CONSOLE||t===T.LOGIC_NODE||t===T.LOGIC_NODE_LIT||t===T.SYNC_CONSOLE; }
/** @param {any} t */
function isSeeThrough(t) {
  return t!==T.WALL && t!==T.VOID && t!==T.CRACKED && t!==T.DOOR && t!==T.LOCKED_R && t!==T.LOCKED_B && t!==T.LOCKED_G && t!==T.CHALLENGE_GATE && t!==T.CRATE && t!==T.SEAM_WALL;
}
/** @param {any} t */
function isDoor(t) { return t===T.DOOR||t===T.LOCKED_R||t===T.LOCKED_B||t===T.LOCKED_G; }
/** @param {any} t */
function doorKeyColour(t) { return t===T.LOCKED_R?'red':t===T.LOCKED_B?'blue':t===T.LOCKED_G?'gold':null; }

// Oscillators and busses are engine/audio.js. Names here are game SFX only.
const audio = (() => {
  const _eng = /** @type {any} */ (requireNEON('audio', 'src/platform.js')).createEngine({
    getSfxVolume:   () => settings.sfxVol,
    getMusicVolume: () => settings.musicVol,
  });
  const getCtx = _eng.getCtx;
  const resume = _eng.resume;
  const osc = _eng.osc;
  const noise = _eng.noise;
  const wetDry = _eng.wetDry;
  const getNoiseBuffer = _eng.getNoiseBuffer;

  return {
    resume,
    isRunning() { return _eng.isRunning(); },
    setSfxVolume(/** @type {number} */ v) {
      settings.sfxVol = v;
      _eng.setSfxVolume(v);
    },
    setMusicVolume(/** @type {number} */ v) {
      settings.musicVol = v;
      _eng.setMusicVolume(v);
      try { if (typeof music !== 'undefined' && music.setVolume) music.setVolume(v); } catch (_) {}
    },
    getMusicBus() { return _eng.getMusicBus(); },
    shoot(/** @type {boolean} */ isPlayer, /** @type {any} */ weapon = null) {
      const c = getCtx(); const t = c.currentTime;
      if (!isPlayer) {
        const pan = Math.random() * 0.3 - 0.15;
        noise(0.05, t, 0.05, 2400, null, { filterType:'bandpass', filterFreq2:1400, q:1.1, pan });
        osc('triangle', 320, 180, 0.05, t, 0.09, null, { pan:-pan * 0.4, attack:0.003 });
        osc('sine', 100, 70, 0.03, t, 0.11, null, { pan:pan * 0.25 });
        return;
      }
      const n = weapon && weapon.name;
      if (n === 'Scatter Gun') {
        const bus = wetDry(1, 0.28, 0.35);
        noise(0.16, t, 0.08, 2400, bus, { filterType:'bandpass', filterFreq2:900, q:0.9 });
        osc('sine', 120, 52, 0.10, t, 0.10, bus, { attack:0.002 });
        for (let i = 0; i < 6; i++) {
          const dt = i * 0.008 + Math.random() * 0.006;
          const p = 0.82 + Math.random() * 0.36;
          const pan = (i / 5 - 0.5) * 0.8 + (Math.random() * 0.1 - 0.05);
          noise(0.06, t + dt, 0.045, 700 + Math.random() * 1800, bus, { filterType:'bandpass', filterFreq2:500 + Math.random() * 900, q:0.7, pan });
          osc('square', 240 * p, 105 * p, 0.045, t + dt, 0.055, bus, { pan, attack:0.0015 });
        }
      } else if (n === 'Railgun') {
        const bus = wetDry(1, 0.3, 0.6);
        osc('sine', 1800, 4200, 0.038, t, 0.11, bus, { attack:0.015, pan:-0.2, filterType:'bandpass', filterFreq:1800, filterFreq2:4200 });
        osc('triangle', 1200, 3600, 0.034, t + 0.015, 0.09, bus, { pan:0.2, filterType:'bandpass', filterFreq:1500, filterFreq2:3800 });
        noise(0.085, t + 0.07, 0.05, 7200, bus, { filterType:'highpass', pan:0.05 });
        osc('sine', 2700, 680, 0.095, t + 0.07, 0.32, bus, { attack:0.0015, q:4.5, filterType:'bandpass', filterFreq:2200, filterFreq2:820 });
        osc('triangle', 1300, 320, 0.04, t + 0.08, 0.26, bus, { pan:0.18 });
      } else if (n === 'Plasma Sword') {
        const bus = wetDry(1, 0.22, 0.24);
        noise(0.09, t, 0.06, 2600, bus, { filterType:'bandpass', filterFreq2:1300, q:1.2, pan:-0.25 });
        osc('sawtooth', 820, 180, 0.10, t, 0.12, bus, { pan:-0.15, filterType:'lowpass', filterFreq:4000, filterFreq2:900 });
        osc('triangle', 1500, 340, 0.06, t + 0.01, 0.1, bus, { pan:0.2 });
        osc('sine', 280, 120, 0.04, t + 0.015, 0.08, bus, { pan:0.12 });
      } else if (n === 'Void Cannon') {
        const bus = wetDry(1, 0.38, 0.5);
        osc('sine', 76, 28, 0.2, t, 0.32, bus, { attack:0.003, pan:-0.05 });
        osc('triangle', 152, 54, 0.09, t, 0.22, bus, { filterType:'lowpass', filterFreq:900, filterFreq2:400 });
        osc('square', 300, 74, 0.05, t + 0.01, 0.14, bus, { pan:0.15, filterType:'bandpass', filterFreq:900, filterFreq2:300 });
        noise(0.08, t, 0.09, 650, bus, { filterType:'lowpass', filterFreq2:320, q:0.5 });
      } else {
        const bus = wetDry(1, 0.16, 0.22);
        noise(0.05, t, 0.025, 5200, bus, { filterType:'highpass', pan:0.05 });
        osc('sine', 920, 420, 0.14, t, 0.1, bus, { attack:0.002, pan:-0.08, filterType:'bandpass', filterFreq:1400, filterFreq2:700, q:0.7 });
        osc('triangle', 1840, 820, 0.06, t + 0.005, 0.07, bus, { pan:0.12 });
        osc('sine', 210, 120, 0.04, t, 0.08, bus, { pan:-0.03 });
      }
    },
    hit(/** @type {boolean} */ isPlayer, /** @type {string} */ weaponName = '') {
      const c = getCtx(); const t = c.currentTime;
      if (isPlayer) {
        const bus = wetDry(1, 0.26, 0.28);
        noise(0.22, t, 0.1, 500, bus, { filterType:'lowpass', filterFreq2:220, pan:-0.08 });
        noise(0.08, t, 0.04, 3500, bus, { filterType:'highpass', pan:0.1 });
        osc('sine', 86, 28, 0.22, t, 0.17, bus, { attack:0.002 });
        osc('triangle', 46, 20, 0.1, t + 0.01, 0.12, bus, { pan:0.04 });
      } else {
        const n = weaponName;
        if (n === 'Scatter Gun') {
          osc('sine', 980, 320, 0.085, t, 0.055, null, { pan:Math.random() * 0.25 - 0.12 });
          noise(0.05, t, 0.025, 3600, null, { filterType:'bandpass', filterFreq2:1800, q:1.3 });
        } else if (n === 'Railgun') {
          const bus = wetDry(1, 0.2, 0.32);
          noise(0.085, t, 0.035, 6500, bus, { filterType:'highpass' });
          osc('sine', 2000, 620, 0.075, t, 0.2, bus, { filterType:'bandpass', filterFreq:2100, filterFreq2:850, q:5 });
          osc('triangle', 1300, 420, 0.032, t + 0.02, 0.18, bus, { pan:0.18 });
        } else if (n === 'Plasma Sword') {
          osc('sawtooth', 960, 220, 0.1, t, 0.09, null, { filterType:'bandpass', filterFreq:2600, filterFreq2:650 });
          noise(0.07, t, 0.04, 4200, null, { filterType:'bandpass', filterFreq2:1800, q:0.9 });
        } else if (n === 'Void Cannon') {
          const bus = wetDry(1, 0.25, 0.25);
          osc('sine', 130, 36, 0.14, t, 0.16, bus, { attack:0.002 });
          noise(0.08, t, 0.08, 500, bus, { filterType:'lowpass', filterFreq2:260 });
          osc('triangle', 220, 80, 0.04, t + 0.01, 0.1, bus, { pan:-0.1 });
        } else {
          osc('sine', 720, 210, 0.12, t, 0.075, null, { pan:Math.random() * 0.2 - 0.1 });
          osc('triangle', 1320, 460, 0.05, t, 0.055);
          noise(0.03, t, 0.02, 3000, null, { filterType:'bandpass', filterFreq2:1800 });
        }
      }
    },
    death() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.5, 0.8);
      osc('sawtooth', 440, 70, 0.16, t, 0.44, bus, { pan:-0.2, filterType:'lowpass', filterFreq:2400, filterFreq2:500 });
      osc('square', 220, 34, 0.09, t + 0.01, 0.36, bus, { pan:0.15 });
      osc('sine', 72, 24, 0.14, t, 0.34, bus, { attack:0.003 });
      noise(0.14, t + 0.04, 0.22, 700, bus, { filterType:'lowpass', filterFreq2:250, q:0.7 });
      noise(0.05, t + 0.02, 0.08, 2600, bus, { filterType:'highpass', pan:0.1 });
    },
    levelUp() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.65, 0.9);
      [523, 659, 784, 1047].forEach((f, i) => {
        const s = t + i * 0.1;
        const pan = (i - 1.5) * 0.18;
        osc('sine', f, f, 0.19, s, 0.24, bus, { pan, attack:0.01 });
        osc('triangle', f * 1.004, f * 1.004, 0.07, s, 0.2, bus, { pan:pan - 0.08 });
        osc('triangle', f * 0.996, f * 0.996, 0.07, s, 0.2, bus, { pan:pan + 0.08 });
        noise(0.025, s, 0.05, 4200, bus, { filterType:'highpass', pan:pan * -0.5 });
      });
    },
    pickup() {
      const c = getCtx(); const t = c.currentTime;
      osc('sine', 420, 1260, 0.14, t, 0.13, null, { pan:-0.08 });
      osc('triangle', 840, 2480, 0.06, t, 0.11, null, { pan:0.12 });
      noise(0.025, t, 0.035, 5200, null, { filterType:'highpass' });
    },
    bossEnter() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.7, 2.4);
      osc('sawtooth', 55, 52, 0.23, t, 2.2, bus, { pan:-0.22, filterType:'lowpass', filterFreq:700, filterFreq2:220 });
      osc('sawtooth', 57, 54, 0.2, t, 2.2, bus, { pan:0.22, filterType:'lowpass', filterFreq:700, filterFreq2:220 });
      osc('triangle', 110, 104, 0.11, t + 0.35, 1.7, bus, { attack:0.15, filterType:'lowpass', filterFreq:900, filterFreq2:320 });
      noise(0.14, t, 2.0, 260, bus, { filterType:'lowpass', filterFreq2:140, q:0.7 });
      osc('sine', 30, 26, 0.16, t + 0.12, 1.9, bus, { attack:0.02 });
      osc('sine', 42, 36, 0.08, t + 0.62, 1.1, bus, { pan:-0.08 });
    },
    // Room-seal cue, not floor-entry bossEnter. Layers on roomSeal() the same frame; ~2s matches BOSS_INTRO_DURATION.
    bossIntro() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.6, 2.6);
      osc('sine', 38, 34, 0.18, t, 2.0, bus, { attack:0.12 });
      osc('sine', 76, 68, 0.10, t + 0.05, 1.9, bus, { attack:0.18, pan:-0.15 });
      osc('sine', 76, 68, 0.10, t + 0.05, 1.9, bus, { attack:0.18, pan:0.15 });
      osc('sawtooth', 110, 100, 0.06, t + 0.2, 1.7, bus, { attack:0.25, filterType:'lowpass', filterFreq:600, filterFreq2:200 });
      osc('sawtooth', 116, 104, 0.06, t + 0.2, 1.7, bus, { attack:0.25, filterType:'lowpass', filterFreq:600, filterFreq2:200, pan:0.18 });
      noise(0.08, t, 2.0, 600, bus, { filterType:'lowpass', filterFreq2:200, q:0.5 });
    },
    // Kill moment, not victory(). Hold matches the ~2.6s death titlecard.
    bossDefeat() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.55, 2.0);
      osc('sine', 70, 30, 0.22, t, 0.55, bus, { attack:0.005 });
      osc('sine', 140, 60, 0.12, t, 0.5,  bus, { attack:0.005 });
      noise(0.10, t + 0.02, 1.6, 1800, bus, { filterType:'bandpass', filterFreq2:300, q:1.2 });
      osc('triangle', 330, 220, 0.07, t + 0.08, 1.6, bus, { attack:0.18, pan:-0.22 });
      osc('triangle', 392, 262, 0.07, t + 0.08, 1.6, bus, { attack:0.18, pan:0.22 });
      osc('triangle', 494, 330, 0.05, t + 0.10, 1.4, bus, { attack:0.20 });
      osc('sine', 3120, 2200, 0.04, t + 0.18, 1.4, bus, { filterType:'bandpass', filterFreq:3000, filterFreq2:2200, q:6, pan:-0.18 });
      osc('sine', 3140, 2200, 0.04, t + 0.18, 1.4, bus, { filterType:'bandpass', filterFreq:3000, filterFreq2:2200, q:6, pan:0.18 });
    },
    descend() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.5, 0.4);
      noise(0.25, t, 0.35, 1500, bus);
      osc('sine',     1200, 500, 0.2,  t + 0.05, 0.3, bus);
      osc('triangle', 600,  250, 0.08, t + 0.08, 0.25, bus);
    },
    gameOver() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.6, 2.5);
      [220, 261, 311].forEach(f => {
        osc('sine',     f, f * 0.5, 0.15, t, 2.5, bus);
        osc('sawtooth', f, f * 0.5, 0.06, t, 2.0, bus);
      });
      osc('sine', 55, 40, 0.12, t, 2.5);
    },
    victory() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.6, 1.6);
      [262, 330, 392, 523].forEach((f, i) => {
        const s = t + i * 0.18;
        osc('sine',     f,      f,      0.22, s, 0.4,  bus);
        osc('triangle', f*2,    f*2,    0.08, s, 0.3,  bus);
        osc('triangle', f*1.005,f*1.005,0.06, s, 0.35, bus);
      });
      osc('sine', 523, 523, 0.15, t + 0.72, 0.8, bus);
      osc('sine', 659, 659, 0.1,  t + 0.72, 0.8, bus);
    },
    phaseShift() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.55, 1.0);
      osc('sawtooth', 220, 1400, 0.12, t, 0.28, bus, { pan:-0.22, filterType:'bandpass', filterFreq:500, filterFreq2:2400, q:1.2 });
      osc('sawtooth', 226, 1410, 0.10, t, 0.28, bus, { pan:0.22, filterType:'bandpass', filterFreq:520, filterFreq2:2500, q:1.2 });
      osc('sine', 56, 38, 0.16, t + 0.04, 0.34, bus, { attack:0.003 });
      osc('sine', 1900, 860, 0.085, t + 0.13, 0.54, bus, { pan:-0.14, filterType:'bandpass', filterFreq:2200, filterFreq2:850, q:5 });
      osc('triangle', 2500, 1120, 0.045, t + 0.13, 0.46, bus, { pan:0.14 });
      noise(0.12, t + 0.1, 0.14, 3400, bus, { filterType:'bandpass', filterFreq2:1500, q:1.1 });
    },
    menuSelect() {
      const c = getCtx(); const t = c.currentTime;
      osc('sine', 1200, 1800, 0.10, t, 0.06);
      osc('triangle', 600, 900, 0.05, t, 0.04);
    },
    lowHealth() {
      const c = getCtx(); const t = c.currentTime;
      osc('sine', 62, 38, 0.085, t, 0.13, null, { pan:-0.1, attack:0.002 });
      osc('sine', 62, 38, 0.07, t + 0.2, 0.11, null, { pan:0.1, attack:0.002 });
      noise(0.02, t, 0.08, 260, null, { filterType:'lowpass', filterFreq2:150 });
    },
    plasmaBurn() {
      const c = getCtx(); const t = c.currentTime;
      noise(0.06, t, 0.15, 1200);
      osc('sawtooth', 180, 60, 0.04, t, 0.12);
    },
    arcZap() {
      const c = getCtx(); const t = c.currentTime;
      osc('square', 2400, 600, 0.08, t, 0.06);
      osc('square', 1800, 400, 0.06, t + 0.03, 0.05);
      noise(0.07, t, 0.08, 3000);
    },
    shockTile() {
      const c = getCtx(); const t = c.currentTime;
      osc('square', 1400, 280, 0.05, t, 0.10);
      osc('square', 900,  180, 0.04, t + 0.04, 0.08);
      noise(0.04, t, 0.12, 1600, null, { filterType:'lowpass', filterFreq2:600 });
    },
    repulsor() {
      // Must not read as shockTile (descending lock) or arcZap (bright crack).
      const c = getCtx(); const t = c.currentTime;
      osc('triangle', 320, 720, 0.06, t, 0.12);
      osc('sine',     220, 540, 0.04, t + 0.02, 0.10);
      noise(0.03, t, 0.10, 2200, null, { filterType:'bandpass', filterFreq2:1400 });
    },
    toxicBurn() {
      const c = getCtx(); const t = c.currentTime;
      noise(0.04, t, 0.18, 600);
      osc('sine', 90, 40, 0.03, t, 0.15);
      osc('triangle', 120, 55, 0.02, t + 0.05, 0.12);
    },
    transition() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.3, 0.9);
      for (let i = 0; i < 6; i++) {
        const s = t + i * 0.12 + Math.random() * 0.04;
        const f = 200 + Math.random() * 1800;
        osc('square', f, f * (0.3 + Math.random() * 0.7), 0.06, s, 0.04 + Math.random() * 0.06, bus);
      }
      const nSrc = c.createBufferSource();
      nSrc.buffer = getNoiseBuffer();
      const flt = c.createBiquadFilter();
      flt.type = 'bandpass';
      flt.Q.value = 3;
      flt.frequency.setValueAtTime(300, t);
      flt.frequency.exponentialRampToValueAtTime(4000, t + 0.5);
      flt.frequency.exponentialRampToValueAtTime(200, t + 0.85);
      const ng = c.createGain();
      ng.gain.setValueAtTime(0.12, t);
      ng.gain.linearRampToValueAtTime(0.18, t + 0.3);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      nSrc.connect(flt); flt.connect(ng); ng.connect(bus);
      nSrc.start(t); nSrc.stop(t + 0.92);
      osc('sine', 50, 35, 0.08, t, 0.8, bus);
    },
    roomSeal() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.4, 1.0);
      osc('square',   80,  30,  0.3,  t, 0.15, bus);
      osc('sawtooth', 120, 60,  0.15, t, 0.2,  bus);
      noise(0.25, t, 0.12, 800, bus);
      osc('square', 400, 200, 0.12, t + 0.15, 0.08, bus);
      osc('square', 300, 150, 0.10, t + 0.22, 0.06, bus);
      osc('sine', 40, 25, 0.2, t, 0.3);
    },
    roomUnseal() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.3, 0.6);
      osc('sine',     200, 500, 0.15, t, 0.3, bus);
      osc('triangle', 400, 800, 0.08, t + 0.05, 0.25, bus);
      noise(0.15, t, 0.25, 2000, bus);
    },
    roomClear() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.4, 0.5);
      osc('sine',     600,  800,  0.12, t, 0.1, bus);
      osc('sine',     800,  1000, 0.10, t + 0.08, 0.1, bus);
      osc('sine',     1000, 1400, 0.12, t + 0.16, 0.15, bus);
      osc('triangle', 1200, 1600, 0.05, t + 0.16, 0.12, bus);
    },
    challengeWave() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.3, 0.8);
      osc('sawtooth', 220, 200, 0.15, t, 0.2, bus);
      osc('sawtooth', 330, 310, 0.12, t, 0.2, bus);
      osc('square',   440, 420, 0.06, t + 0.05, 0.15, bus);
      noise(0.18, t, 0.08, 1500, bus);
      osc('sine', 60, 35, 0.2, t, 0.25);
    },
    perkChoice() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.5, 0.8);
      [659, 784, 988].forEach((f, i) => {
        osc('sine',     f, f, 0.15, t + i * 0.08, 0.25, bus);
        osc('triangle', f*1.5, f*1.5, 0.06, t + i * 0.08, 0.2, bus);
      });
      noise(0.08, t, 0.05, 4000, bus);
    },
    secondWind() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.6, 1.2);
      osc('sine', 200, 800, 0.2, t, 0.5, bus);
      osc('triangle', 400, 1600, 0.08, t + 0.1, 0.4, bus);
      osc('sine', 100, 100, 0.15, t, 0.3);
      noise(0.1, t + 0.05, 0.15, 2000, bus);
    },
    augmentChoice() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.5, 0.9);
      [523, 659, 880, 1047].forEach((f, i) => {
        osc('sine',     f, f*1.02, 0.12, t + i * 0.07, 0.3, bus);
        osc('triangle', f*2, f*2.02, 0.05, t + i * 0.07, 0.25, bus);
      });
      noise(0.06, t, 0.04, 5000, bus);
    },
    augmentInstall() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.4, 0.6);
      osc('square', 300, 1200, 0.10, t, 0.15, bus);
      osc('sine',   600, 2400, 0.08, t + 0.05, 0.12, bus);
      osc('sine',   150, 150,  0.12, t, 0.2);
      noise(0.12, t + 0.02, 0.06, 3000, bus);
    },
    moduleFound() {
      // Must not share augmentInstall's timbre.
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.4, 0.7);
      osc('triangle', 440, 880,  0.10, t,        0.14, bus);
      osc('sine',     660, 1320, 0.09, t + 0.07, 0.14, bus);
      osc('square',   880, 1760, 0.07, t + 0.14, 0.12, bus);
      noise(0.04, t, 0.05, 4200, bus);
    },
    reactiveArmor() {
      const c = getCtx(); const t = c.currentTime;
      osc('sawtooth', 200, 80, 0.15, t, 0.12);
      osc('square', 150, 60, 0.1, t + 0.02, 0.1);
      noise(0.18, t, 0.08, 1200);
    },
    eventTerminal() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.5, 0.8);
      osc('sine', 220, 440, 0.08, t, 0.15, bus);
      osc('triangle', 330, 660, 0.06, t + 0.08, 0.12, bus);
      osc('square', 110, 55, 0.04, t + 0.15, 0.1, bus);
      noise(0.05, t, 0.2, 1800, bus);
    },
    eventResolve() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.4, 0.6);
      osc('sine', 400, 1000, 0.10, t, 0.18, bus);
      osc('triangle', 600, 1400, 0.07, t + 0.06, 0.14, bus);
      osc('sine', 200, 200, 0.08, t, 0.12);
    },
    sniperCharge() {
      const c = getCtx(); const t = c.currentTime;
      osc('sine', 800, 1600, 0.06, t, 0.08);
      osc('sine', 900, 1800, 0.05, t + 0.1, 0.08);
    },
    sniperFire() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.2, 0.3);
      noise(0.20, t, 0.06, 8000, bus);
      osc('sawtooth', 1200, 200, 0.12, t, 0.08, bus);
      osc('sine', 60, 30, 0.10, t + 0.02, 0.15);
    },
    echoerLock() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.5, 0.4);
      osc('sine', 700, 380, 0.08, t, 0.18, bus);
      osc('sine', 1100, 550, 0.04, t + 0.05, 0.12, bus);
    },
    echoerFire() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.4, 0.5);
      osc('triangle', 240, 90, 0.14, t, 0.16, bus);
      noise(0.10, t + 0.02, 0.10, 1800, bus);
      osc('sine', 90, 55, 0.10, t, 0.12);
    },
    prophetLock() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.5, 0.4);
      osc('sine', 380, 760, 0.08, t, 0.18, bus);
      osc('sine', 580, 1180, 0.04, t + 0.05, 0.14, bus);
    },
    prophetFire() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.25, 0.35);
      osc('triangle', 520, 180, 0.12, t, 0.14, bus);
      noise(0.08, t + 0.01, 0.08, 3200, bus);
      osc('sine', 140, 70, 0.10, t, 0.10);
    },
    cryophageLock() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.6, 0.3);
      osc('sine', 1100, 880, 0.06, t, 0.16, bus);
      osc('sine', 1480, 1180, 0.04, t + 0.04, 0.12, bus);
    },
    cryophageCommit() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.4, 0.4);
      noise(0.10, t, 0.12, 4200, bus);
      osc('triangle', 180, 120, 0.10, t + 0.02, 0.14);
    },
    vengeanceCharge() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.55, 0.4);
      osc('sawtooth', 220, 90, 0.10, t, 0.55, bus);
      osc('sawtooth', 320, 130, 0.06, t + 0.10, 0.50, bus);
      osc('sine', 60, 40, 0.12, t, 0.30);
    },
    conduitFire() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.4, 0.3);
      osc('square', 720, 480, 0.04, t, 0.10, bus);
      osc('sine', 1100, 880, 0.03, t + 0.02, 0.08);
    },
    conduitBeam() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.35, 0.25);
      noise(0.06, t, 0.05, 6000, bus);
      osc('triangle', 320, 200, 0.06, t + 0.005, 0.10);
    },
    resonatorCharge() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.55, 0.35);
      osc('sine', 320, 720, 0.08, t, 0.55, bus);
      osc('sine', 480, 1080, 0.06, t + 0.05, 0.50, bus);
      osc('triangle', 220, 540, 0.05, t + 0.10, 0.45, bus);
    },
    resonatorFire() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.35, 0.5);
      osc('sawtooth', 600, 90, 0.10, t, 0.20, bus);
      osc('sine', 140, 50, 0.18, t, 0.22, bus);
      noise(0.16, t + 0.01, 0.14, 2400, bus);
    },
    watcherCharge() {
      const c = getCtx(); const t = c.currentTime;
      // Drier and higher than resonatorCharge so several watchers do not wash together.
      const bus = wetDry(1, 0.30, 0.20);
      osc('sine', 1500, 3500, 0.06, t, 0.32, bus);
      osc('triangle', 2400, 4200, 0.04, t + 0.02, 0.18, bus);
      osc('sine', 220, 180, 0.08, t, 0.18, bus);
    },
    watcherFire() {
      const c = getCtx(); const t = c.currentTime;
      // No sub; wet mix 0.20 and lifetime 0.30, versus watcherCharge's 0.30 and 0.20.
      const bus = wetDry(1, 0.20, 0.30);
      osc('square', 880, 440, 0.05, t, 0.16, bus);
      osc('sine', 2200, 1100, 0.07, t, 0.14, bus);
      noise(0.06, t + 0.005, 0.06, 4000, bus);
    },
    architectTarget() {
      const c = getCtx(); const t = c.currentTime;
      // Mid-low, not watcherCharge or resonator, so a mixed room can be told by sound.
      const bus = wetDry(1, 0.35, 0.30);
      osc('sine', 130, 95, 0.08, t, 0.22, bus);
      osc('triangle', 320, 240, 0.06, t + 0.05, 0.14, bus);
      noise(0.04, t + 0.10, 0.05, 1800, bus);
    },
    architectCommit() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.20, 0.20);
      osc('sine', 90, 55, 0.10, t, 0.32, bus);
      osc('square', 280, 120, 0.05, t + 0.005, 0.10, bus);
      noise(0.07, t + 0.01, 0.05, 800, bus);
    },
    mirrorCharge() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.45, 0.40);
      osc('sine', 880, 1320, 0.06, t, 0.45, bus);
      osc('triangle', 660, 990, 0.05, t + 0.06, 0.40, bus);
      osc('sine', 1320, 1980, 0.04, t + 0.12, 0.35, bus);
    },
    mirrorFire() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.25, 0.35);
      osc('square', 520, 220, 0.08, t, 0.18, bus);
      osc('sine', 1100, 440, 0.06, t, 0.16, bus);
      noise(0.05, t + 0.005, 0.06, 3200, bus);
    },
    reaperTelegraph() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.30, 0.50);
      osc('sine', 220, 110, 0.09, t, 0.30, bus);
      osc('sine', 240, 120, 0.09, t + 0.18, 0.28, bus);
      osc('triangle', 880, 660, 0.05, t, 0.10, bus);
    },
    reaperFrenzy() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.20, 0.45);
      osc('sawtooth', 180, 90, 0.20, t, 0.30, bus);
      osc('sawtooth', 195, 95, 0.20, t, 0.26, bus);
      noise(0.10, t, 0.08, 2400, bus);
      osc('square', 660, 220, 0.10, t + 0.04, 0.16, bus);
    },
    ghostProjectorMemory() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.55, 0.35);
      osc('sine', 880, 440, 0.05, t, 0.10, bus);
      osc('triangle', 660, 330, 0.04, t + 0.05, 0.10, bus);
    },
    ghostProjectorSpawn() {
      // Must not share the ordinary spawn cue.
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.65, 0.50);
      osc('sine', 220, 660, 0.18, t, 0.18, bus);
      osc('triangle', 440, 1100, 0.14, t + 0.04, 0.14, bus);
      noise(0.12, t, 0.18, 3200, bus);
    },
    wardenCharge() {
      const c = getCtx(); const t = c.currentTime;
      osc('sawtooth', 80, 200, 0.12, t, 0.25);
      noise(0.10, t + 0.05, 0.20, 1200);
      osc('sine', 50, 50, 0.08, t, 0.30);
    },
    wardenSlam() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.2, 0.4);
      osc('sine', 40, 20, 0.25, t, 0.20, bus);
      noise(0.20, t + 0.02, 0.12, 2000, bus);
      osc('square', 120, 60, 0.10, t + 0.03, 0.15);
    },
    conductorArc() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.3, 0.5);
      noise(0.15, t, 0.08, 6000, bus);
      osc('sawtooth', 400, 1200, 0.10, t, 0.10, bus);
      osc('square', 200, 600, 0.06, t + 0.03, 0.08);
    },
    conductorPulse() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.3, 0.6);
      osc('sine', 50, 30, 0.20, t, 0.25, bus);
      noise(0.22, t + 0.03, 0.15, 3000, bus);
      osc('sawtooth', 150, 80, 0.08, t + 0.05, 0.12);
    },
    genesisLance() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.2, 0.4);
      osc('sine', 1200, 800, 0.12, t, 0.08, bus);
      osc('square', 600, 200, 0.06, t + 0.02, 0.06);
      noise(0.08, t + 0.01, 0.05, 8000, bus);
    },
    genesisPurge() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.4, 0.6);
      osc('sine', 60, 40, 0.22, t, 0.30, bus);
      osc('triangle', 220, 440, 0.10, t + 0.05, 0.20, bus);
      noise(0.15, t + 0.08, 0.12, 2000, bus);
    },
    shieldBreak() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.3, 0.6);
      osc('square',   800, 100, 0.2,  t, 0.15, bus);
      osc('sawtooth', 600,  80, 0.12, t + 0.02, 0.12, bus);
      noise(0.25, t, 0.1, 3000, bus);
      osc('sine', 60, 30, 0.15, t + 0.05, 0.2);
    },
    shieldRestore() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.4, 0.8);
      osc('sine',     400, 900,  0.12, t, 0.3, bus);
      osc('triangle', 600, 1200, 0.08, t + 0.05, 0.25, bus);
      osc('sine',     800, 1400, 0.06, t + 0.1, 0.2, bus);
    },
    vendorOpen() {
      const c = getCtx(); const t = c.currentTime;
      osc('sine',     600,  800,  0.10, t, 0.08);
      osc('triangle', 800,  1100, 0.08, t + 0.08, 0.08);
      osc('sine',     1100, 1400, 0.10, t + 0.16, 0.12);
    },
    purchase() {
      const c = getCtx(); const t = c.currentTime;
      osc('sine',     1000, 1600, 0.12, t, 0.06);
      osc('triangle', 1400, 1800, 0.06, t + 0.04, 0.06);
      noise(0.04, t + 0.02, 0.04, 3000);
    },
    purchaseFail() {
      const c = getCtx(); const t = c.currentTime;
      osc('square', 120, 90, 0.08, t, 0.15);
      noise(0.03, t, 0.08, 400);
    },
    wallBreak() {
      const c = getCtx(); const t = c.currentTime;
      noise(0.12, t, 0.25, 2000);
      osc('sine', 80, 30, 0.1, t, 0.3);
      osc('triangle', 40, 20, 0.06, t, 0.35);
      for (let i=0; i<3; i++) {
        const d = 0.05 + i * 0.06;
        const f = 800 + Math.random() * 600;
        osc('sine', f, f*0.4, 0.03, t+d, 0.06);
      }
    },
    ricochet() {
      const c = getCtx(); const t = c.currentTime;
      osc('sine', 2200, 800, 0.06, t, 0.08);
      osc('triangle', 3400, 1200, 0.03, t, 0.05);
      noise(0.02, t, 0.02, 6000);
    },
    shieldDeflect() {
      const c = getCtx(); const t = c.currentTime;
      osc('triangle', 1800, 600, 0.08, t, 0.1);
      osc('sine', 2400, 900, 0.04, t, 0.06);
      noise(0.03, t, 0.03, 4000);
    },
    reflect() {
      const c = getCtx(); const t = c.currentTime;
      osc('sine', 2200, 3200, 0.07, t, 0.08);
      osc('triangle', 3000, 4000, 0.04, t + 0.02, 0.06);
      osc('sine', 1600, 2000, 0.03, t + 0.04, 0.1);
      noise(0.02, t, 0.02, 6000);
    },
    grenadeLob() {
      const c = getCtx(); const t = c.currentTime;
      osc('sine', 200, 120, 0.06, t, 0.12);
      osc('triangle', 400, 800, 0.03, t, 0.15);
    },
    grenadeExplode() {
      const c = getCtx(); const t = c.currentTime;
      osc('sine', 100, 30, 0.12, t, 0.25);
      osc('square', 60, 20, 0.06, t, 0.2);
      noise(0.08, t, 0.15, 2000);
    },
    corePrime() {
      const c = getCtx(); const t = c.currentTime;
      osc('square', 1200, 1800, 0.06, t, 0.06);
      osc('sine', 600, 900, 0.04, t + 0.03, 0.04);
    },
    coreDetonate() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.35, 0.5);
      osc('sine', 60, 22, 0.22, t, 0.35, bus, { attack: 0.002 });
      osc('triangle', 120, 40, 0.10, t, 0.25, bus, { pan: -0.15 });
      noise(0.16, t + 0.01, 0.18, 3200, bus, { filterType: 'bandpass', filterFreq2: 800, q: 0.8 });
      noise(0.06, t + 0.03, 0.08, 6000, bus, { filterType: 'highpass', pan: 0.2 });
      osc('sawtooth', 200, 60, 0.06, t + 0.02, 0.15, bus, { pan: 0.1 });
    },
    crateBreak() {
      const c = getCtx(); const t = c.currentTime;
      osc('sine', 150, 40, 0.10, t, 0.15);
      osc('square', 90, 25, 0.06, t, 0.12);
      noise(0.10, t, 0.10, 3000);
      for (let i = 0; i < 3; i++) {
        const d = 0.04 + i * 0.05;
        const f = 600 + Math.random() * 800;
        osc('sine', f, f * 0.3, 0.03, t + d, 0.05);
      }
    },
    sentryFire() {
      const c = getCtx(); const t = c.currentTime;
      osc('sine', 1800, 2400, 0.04, t, 0.06, null, { pan: (Math.random() - 0.5) * 0.3 });
      osc('triangle', 900, 1200, 0.025, t, 0.04);
    },
    autoLaser() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.25, 0.2);
      osc('sine', 3000, 800, 0.08, t, 0.1, bus);
      osc('square', 1500, 400, 0.05, t, 0.08, bus);
      noise(0.04, t, 0.05, 5000, bus);
    },
    loreAccess() {
      const c = getCtx(); const t = c.currentTime;
      osc('sine',     500,  700,  0.07, t, 0.06);
      osc('triangle', 700,  900,  0.05, t + 0.06, 0.06);
      osc('sine',     900,  1100, 0.07, t + 0.12, 0.08);
      noise(0.02, t + 0.04, 0.03, 4000);
    },
    enemySplit() {
      const c = getCtx(); const t = c.currentTime;
      osc('square', 300, 600, 0.06, t, 0.1);
      osc('square', 350, 650, 0.06, t + 0.02, 0.1);
      noise(0.05, t, 0.08, 3000);
    },
    summon() {
      const c = getCtx(); const t = c.currentTime;
      osc('sine', 200, 600, 0.07, t, 0.2);
      osc('triangle', 300, 900, 0.04, t + 0.05, 0.18);
      osc('sine', 500, 1200, 0.03, t + 0.1, 0.12);
      noise(0.03, t + 0.08, 0.1, 4000);
    },
    heal() {
      const c = getCtx(); const t = c.currentTime;
      osc('sine', 600, 1200, 0.06, t, 0.15);
      osc('triangle', 900, 1400, 0.04, t + 0.05, 0.12);
      osc('sine', 1200, 1600, 0.03, t + 0.1, 0.1);
    },
    chargerWindup() {
      const c = getCtx(); const t = c.currentTime;
      osc('sawtooth', 60, 180, 0.07, t, 0.25);
      osc('square', 100, 300, 0.04, t + 0.05, 0.2);
      noise(0.04, t + 0.1, 0.15, 1500);
    },
    chargerImpact() {
      const c = getCtx(); const t = c.currentTime;
      osc('sine', 80, 30, 0.1, t, 0.12);
      osc('square', 120, 40, 0.06, t, 0.08);
      noise(0.08, t, 0.06, 3000);
    },
    leaperWindup() {
      const c = getCtx(); const t = c.currentTime;
      osc('sawtooth', 120, 400, 0.06, t, 0.2);
      osc('sine', 200, 800, 0.04, t + 0.05, 0.18);
      noise(0.03, t + 0.1, 0.1, 2000);
    },
    leaperLand() {
      const c = getCtx(); const t = c.currentTime;
      osc('sine', 60, 25, 0.12, t, 0.15);
      osc('triangle', 100, 50, 0.07, t, 0.1);
      noise(0.07, t + 0.02, 0.08, 2500);
      osc('sine', 300, 80, 0.04, t + 0.05, 0.2);
    },
    beaconAlarm() {
      const c = getCtx(); const t = c.currentTime;
      osc('square', 600, 1200, 0.06, t, 0.15);
      osc('square', 800, 1400, 0.04, t + 0.15, 0.15);
      osc('sine', 400, 900, 0.05, t + 0.05, 0.2);
      noise(0.03, t, 0.1, 3000);
    },
    beaconDestroy() {
      const c = getCtx(); const t = c.currentTime;
      osc('sine', 1200, 200, 0.08, t, 0.15);
      osc('square', 800, 100, 0.04, t + 0.02, 0.12);
      noise(0.06, t + 0.05, 0.08, 4000);
    },
    beaconTrigger() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.3, 0.3);
      osc('square', 500, 500, 0.08, t, 0.12, bus);
      osc('square', 700, 700, 0.08, t + 0.12, 0.12, bus);
      osc('square', 500, 500, 0.06, t + 0.24, 0.1, bus);
      osc('sine', 80, 60, 0.06, t, 0.3, bus);
      noise(0.04, t + 0.1, 0.15, 2000, bus);
    },
    shockPulse() {
      const c = getCtx(); const t = c.currentTime;
      // No sub-bass thud like mineExplode's; three descending voices start at 1600, 1200, and 600 Hz.
      const bus = wetDry(0.9, 0.25, 0.2);
      osc('sine',     1600, 200, 0.10, t,        0.18, bus);
      osc('triangle', 1200, 300, 0.06, t + 0.02, 0.14, bus);
      osc('square',    600, 250, 0.04, t + 0.03, 0.10, bus);
      noise(0.08, t,        0.05, 6000, bus);
      noise(0.04, t + 0.06, 0.10, 3000, bus);
    },
    gulperCharge() {
      const c = getCtx(); const t = c.currentTime;
      // Must not share mineArm's click or beaconTrigger's klaxon.
      const bus = wetDry(0.7, 0.4, 0.35);
      osc('triangle', 180, 320, 0.10, t,        0.20, bus);
      osc('sine',      90, 160, 0.06, t,        0.30, bus);
      noise(0.05, t,        0.18, 1200, bus);
    },
    gulperBelch() {
      const c = getCtx(); const t = c.currentTime;
      // No boom (mineExplode) and no bright high end (shockPulse).
      const bus = wetDry(0.85, 0.35, 0.30);
      osc('square',   320, 80,  0.12, t,        0.16, bus);
      osc('triangle', 240, 60,  0.08, t + 0.01, 0.20, bus);
      osc('sine',     120, 50,  0.06, t,        0.28, bus);
      noise(0.10, t,        0.06, 2200, bus);
      noise(0.05, t + 0.05, 0.14, 800,  bus);
    },
    mineArm() {
      const c = getCtx(); const t = c.currentTime;
      noise(0.06, t, 0.03, 8000);
      osc('square', 800, 1400, 0.05, t + 0.03, 0.12);
      osc('sine', 600, 1000, 0.04, t + 0.05, 0.1);
    },
    mineExplode() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.3, 0.25);
      osc('sine', 60, 30, 0.12, t, 0.15, bus);
      osc('square', 200, 80, 0.06, t, 0.1, bus);
      noise(0.1, t, 0.08, 4000, bus);
      noise(0.04, t + 0.08, 0.12, 2000, bus);
      osc('triangle', 120, 50, 0.04, t + 0.05, 0.15, bus);
    },
    phantomCloak() {
      const c = getCtx(); const t = c.currentTime;
      osc('sine', 1200, 300, 0.06, t, 0.2);
      osc('triangle', 800, 200, 0.03, t + 0.03, 0.15);
      noise(0.03, t + 0.05, 0.12, 3000);
    },
    phantomUncloak() {
      const c = getCtx(); const t = c.currentTime;
      osc('sine', 400, 1400, 0.08, t, 0.15);
      osc('square', 600, 1800, 0.04, t + 0.02, 0.12);
      noise(0.05, t, 0.06, 5000);
    },
    phantomStrike() {
      const c = getCtx(); const t = c.currentTime;
      osc('square', 900, 400, 0.06, t, 0.08);
      osc('sine', 1200, 600, 0.04, t + 0.01, 0.06);
      noise(0.04, t, 0.04, 6000);
    },
    mimicReveal() {
      const c = getCtx(); const t = c.currentTime;
      osc('square', 200, 1600, 0.10, t, 0.12);
      osc('sawtooth', 600, 2200, 0.06, t + 0.02, 0.10);
      osc('sine', 1400, 400, 0.05, t + 0.08, 0.10);
      noise(0.07, t, 0.08, 7000);
    },
    teleport() {
      const c = getCtx(); const t = c.currentTime;
      osc('sine', 1400, 300, 0.07, t, 0.1);
      osc('square', 800, 200, 0.04, t, 0.08);
      noise(0.05, t, 0.04, 6000);
    },
    teleportPad() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.25, 0.2);
      osc('sine', 300, 1600, 0.08, t, 0.18, bus);
      osc('square', 500, 2000, 0.04, t + 0.02, 0.14, bus);
      osc('triangle', 1200, 1800, 0.05, t + 0.1, 0.1, bus);
      noise(0.04, t + 0.05, 0.08, 8000, bus);
    },
    generatorDestroy() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.3, 0.2);
      osc('sawtooth', 400, 2400, 0.08, t, 0.15, bus);
      osc('square', 600, 1800, 0.05, t + 0.02, 0.12, bus);
      osc('sine', 80, 40, 0.08, t + 0.05, 0.2, bus);
      noise(0.07, t + 0.08, 0.1, 5000, bus);
      osc('triangle', 1200, 300, 0.04, t + 0.12, 0.15, bus);
    },
    cameraDetect() {
      const c = getCtx(); const t = c.currentTime;
      osc('square', 800, 1200, 0.06, t, 0.08);
      osc('square', 1200, 1600, 0.05, t + 0.1, 0.08);
    },
    cameraAlert() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.25, 0.15);
      osc('sawtooth', 1400, 600, 0.07, t, 0.2, bus);
      osc('square', 1000, 400, 0.05, t + 0.05, 0.15, bus);
      noise(0.06, t + 0.1, 0.12, 4000, bus);
      osc('sine', 200, 80, 0.06, t + 0.15, 0.1, bus);
    },
    cameraDestroy() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.2, 0.15);
      noise(0.08, t, 0.08, 6000, bus);
      osc('sawtooth', 600, 200, 0.06, t, 0.1, bus);
      osc('sine', 300, 100, 0.05, t + 0.05, 0.08, bus);
    },
    laserHit() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.15, 0.1);
      osc('sawtooth', 1800, 600, 0.08, t, 0.1, bus);
      osc('square', 900, 300, 0.05, t + 0.02, 0.08, bus);
      noise(0.06, t, 0.06, 8000, bus);
    },
    laserDisable() {
      const c = getCtx(); const t = c.currentTime;
      osc('sine', 800, 100, 0.06, t, 0.25);
      osc('triangle', 400, 50, 0.04, t + 0.05, 0.2);
    },
    laserDestroy() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.2, 0.15);
      noise(0.1, t, 0.1, 7000, bus);
      osc('sawtooth', 700, 150, 0.07, t, 0.12, bus);
      osc('sine', 400, 80, 0.05, t + 0.04, 0.1, bus);
    },
    comboTick(/** @type {number} */ count) {
      const c = getCtx(); const t = c.currentTime;
      const base = Math.min(1800, 400 + count * 80);
      osc('sine', base, base * 1.3, 0.06, t, 0.06);
      osc('triangle', base * 1.2, base * 1.5, 0.03, t + 0.02, 0.04);
    },
    dash() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.2, 0.15);
      noise(0.10, t, 0.12, 4000, bus);
      osc('sine', 600, 200, 0.08, t, 0.1, bus);
      osc('triangle', 1200, 400, 0.04, t, 0.08, bus);
    },
    hackwareEMP() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.3, 0.4);
      osc('sawtooth', 200, 60, 0.15, t, 0.2, bus);
      osc('square', 1200, 200, 0.1, t, 0.15, bus);
      noise(0.2, t, 0.1, 5000, bus);
      osc('sine', 80, 40, 0.12, t + 0.05, 0.3);
    },
    hackwareJammed() {
      // Staccato refusal. Must not share hackwareEMP or disruptorField. Plays inside a NULLIFIER jam.
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.4, 0.05, 0.05);
      osc('square', 380, 110, 0.08, t, 0.10, bus);
      osc('sawtooth', 240, 80, 0.05, t + 0.02, 0.08, bus);
      noise(0.05, t, 0.06, 3000, bus);
    },
    hackwareCloak() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.5, 0.8);
      osc('sine', 800, 1600, 0.08, t, 0.3, bus);
      osc('triangle', 1200, 2000, 0.05, t + 0.05, 0.25, bus);
      osc('sine', 400, 200, 0.06, t + 0.1, 0.2, bus);
    },
    hackwareSwarm() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.2, 0.3);
      osc('sawtooth', 300, 600, 0.08, t, 0.15, bus);
      osc('sawtooth', 320, 640, 0.06, t + 0.02, 0.12, bus);
      noise(0.08, t, 0.2, 3000, bus);
      osc('sine', 200, 400, 0.05, t + 0.1, 0.15, bus);
    },
    hackwareGravity() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.4, 0.6);
      osc('sine', 300, 40, 0.15, t, 0.4, bus);
      osc('triangle', 600, 100, 0.08, t, 0.3, bus);
      osc('sine', 50, 30, 0.2, t + 0.1, 0.5);
      noise(0.06, t + 0.2, 0.15, 1000, bus);
    },
    hackwareStaticField() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.3, 0.5);
      noise(0.1, t, 0.25, 3000, bus);
      osc('sawtooth', 800, 200, 0.06, t, 0.3, bus);
      osc('square', 1200, 400, 0.04, t + 0.05, 0.2, bus);
      osc('sine', 100, 60, 0.12, t + 0.1, 0.4);
    },
    hackwareCloakEnd() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.3, 0.4);
      osc('sine', 1600, 600, 0.06, t, 0.2, bus);
      osc('triangle', 1200, 400, 0.04, t + 0.05, 0.15, bus);
    },
    hackwareBlink() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.25, 0.35);
      // Cyan ability, but not hackwareCloak's shimmer or hackwareEMP's burst.
      osc('triangle', 1800, 300, 0.05, t,         0.18, bus);
      osc('sine',     400, 1400, 0.04, t + 0.06,  0.15, bus);
      noise(0.05, t, 0.08, 4000, bus);
    },
    hackwareEMPLine() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.3, 0.4);
      // Same wet/dry family as hackwareEMP, but a rising sweep so the line variant is not the burst.
      osc('sine',     300, 1400, 0.10, t,         0.18, bus);
      osc('sawtooth', 800, 1600, 0.08, t + 0.02,  0.15, bus);
      noise(0.12, t, 0.12, 4500, bus);
      osc('sine',      80,   60, 0.10, t + 0.06,  0.25);
    },
    hackwareChronoLure() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.35, 0.45);
      // Ticks at 0, 0.3, and 0.6s lead into the 1s fuse. Must not share hackwareGravity's impact.
      osc('triangle', 1100, 1400, 0.08, t,         0.10, bus);
      osc('triangle',  900, 1100, 0.06, t + 0.30,  0.10, bus);
      osc('triangle',  700,  900, 0.05, t + 0.60,  0.10, bus);
      osc('sine',      220,  180, 0.05, t,         0.20);
    },
    hackwareChronoLureBoom() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.45, 0.55);
      osc('sine',     900,  60, 0.18, t,         0.35, bus);
      osc('triangle', 600,  80, 0.12, t,         0.30, bus);
      noise(0.10, t, 0.18, 3500, bus);
      osc('sine',      40,  30, 0.18, t + 0.08,  0.45);
    },
    hackwareTimeDilation() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.55, 0.7);
      // Slow downward hum, not chrono-lure ticks or gravity's impact.
      osc('sine',     520, 240, 0.10, t,         0.55, bus);
      osc('triangle', 780, 320, 0.06, t,         0.55, bus);
      osc('sine',     180, 110, 0.08, t + 0.05,  0.65, bus);
      noise(0.04, t, 0.45, 800, bus, { filterType: 'lowpass', q: 0.6 });
    },
    hackwareDataSpike() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.2, 0.3);
      // Shorter and drier than hackwareEMPLine so a pierce does not ring like a sweep.
      osc('triangle', 1600, 2800, 0.06, t,         0.10, bus);
      osc('square',   2200, 1100, 0.04, t + 0.01,  0.08, bus);
      noise(0.08, t, 0.06, 6000, bus, { filterType: 'highpass', q: 0.8 });
      osc('sine',      120,   60, 0.06, t + 0.03,  0.18);
    },
    hackwareShieldBubble() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.4, 0.7);
      // Lower and shorter than shieldRestore. A dry 180→90 Hz voice separates it from hackwareCloak and Repair Protocol's heal cue.
      osc('sine',     350, 750,  0.18, t,          0.22, bus);
      osc('triangle', 500, 1050, 0.14, t + 0.04,   0.18, bus);
      osc('sine',     700, 1300, 0.08, t + 0.10,   0.14, bus);
      osc('sine',     180,  90,  0.20, t,          0.18);
    },
    playerBurn() {
      const c = getCtx(); const t = c.currentTime;
      noise(0.06, t, 0.12, 3000, null, { filterType: 'bandpass', q: 1.2 });
      osc('sine', 180, 100, 0.05, t, 0.15);
      osc('triangle', 400, 200, 0.03, t + 0.03, 0.08);
    },
    playerShock() {
      const c = getCtx(); const t = c.currentTime;
      osc('sawtooth', 800, 2400, 0.07, t, 0.06);
      osc('square', 1200, 600, 0.04, t + 0.02, 0.05);
      noise(0.05, t, 0.04, 6000, null, { filterType: 'highpass' });
    },
    voltaicHit() {
      const c = getCtx(); const t = c.currentTime;
      osc('sine', 1400, 2000, 0.05, t, 0.05);
      osc('square', 800, 400, 0.03, t + 0.01, 0.04);
      noise(0.03, t, 0.03, 5000);
    },
    bountyReveal() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.3, 0.3);
      osc('sawtooth', 120, 80, 0.10, t, 0.35, bus);
      osc('square', 140, 90, 0.06, t + 0.02, 0.3, bus);
      osc('sine', 600, 1400, 0.05, t + 0.15, 0.25, bus);
      osc('triangle', 900, 1800, 0.03, t + 0.2, 0.2, bus);
      noise(0.04, t + 0.1, 0.15, 4000, bus);
    },
    bountyKill() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.25, 0.25);
      osc('sine', 523, 523, 0.08, t, 0.12, bus);
      osc('sine', 659, 659, 0.08, t + 0.08, 0.12, bus);
      osc('sine', 784, 784, 0.08, t + 0.16, 0.12, bus);
      osc('sine', 1047, 1047, 0.10, t + 0.24, 0.2, bus);
      osc('triangle', 1047, 1568, 0.04, t + 0.3, 0.15, bus);
      noise(0.03, t + 0.25, 0.1, 8000, bus);
    },
    turretFire() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.6, 0.15, 0.15);
      osc('square', 200, 100, 0.06, t, 0.06, bus);
      osc('sawtooth', 400, 200, 0.04, t + 0.01, 0.04, bus);
      noise(0.05, t, 0.05, 4000, bus);
    },
    turretHack() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.8, 0.2, 0.2);
      osc('sine', 400, 900, 0.06, t, 0.15, bus);
      osc('square', 600, 1200, 0.03, t + 0.05, 0.1, bus);
      osc('triangle', 800, 1600, 0.04, t + 0.1, 0.12, bus);
      noise(0.02, t + 0.12, 0.08, 6000, bus);
    },
    turretDestroy() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.7, 0.2, 0.2);
      osc('sawtooth', 180, 60, 0.08, t, 0.12, bus);
      osc('square', 120, 40, 0.06, t + 0.02, 0.1, bus);
      noise(0.08, t, 0.15, 3000, bus);
      noise(0.04, t + 0.08, 0.1, 8000, bus);
    },
    disruptorDeploy() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.7, 0.2, 0.15);
      osc('sawtooth', 600, 200, 0.06, t, 0.2, bus);
      osc('square', 450, 150, 0.04, t + 0.03, 0.18, bus);
      osc('sine', 300, 100, 0.03, t + 0.06, 0.15, bus);
      noise(0.04, t + 0.05, 0.12, 5000, bus);
    },
    disruptorField() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.5, 0.1, 0.1);
      noise(0.03, t, 0.08, 4000, bus);
      osc('square', 120, 80, 0.02, t, 0.06, bus);
    },
    wraithPhaseOut() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.8, 0.3, 0.2);
      osc('sine', 800, 200, 0.05, t, 0.35, bus);
      osc('triangle', 600, 150, 0.03, t + 0.05, 0.3, bus);
      noise(0.025, t + 0.1, 0.25, 3000, bus);
    },
    wraithPhaseIn() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.8, 0.3, 0.2);
      osc('sine', 200, 800, 0.06, t, 0.3, bus);
      osc('triangle', 150, 600, 0.04, t + 0.05, 0.25, bus);
      noise(0.04, t + 0.15, 0.2, 6000, bus);
      osc('square', 300, 500, 0.02, t + 0.2, 0.1, bus);
    },
    nexusLink() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.6, 0.2, 0.15);
      osc('sine', 600, 800, 0.02, t, 0.08, bus);
      osc('triangle', 900, 1100, 0.015, t + 0.02, 0.06, bus);
    },
    nexusDeath() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.9, 0.4, 0.3);
      osc('sawtooth', 1200, 200, 0.08, t, 0.4, bus);
      osc('square', 800, 100, 0.05, t + 0.05, 0.35, bus);
      noise(0.06, t + 0.1, 0.3, 4000, bus);
      osc('sine', 400, 80, 0.04, t + 0.15, 0.25, bus);
    },
    siphonDrain() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.5, 0.3, 0.2);
      osc('sawtooth', 500, 200, 0.04, t, 0.25, bus);
      osc('sine', 300, 120, 0.03, t + 0.05, 0.2, bus);
      noise(0.02, t + 0.08, 0.15, 3000, bus);
    },
    siphonFrenzy() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.7, 0.4, 0.25);
      osc('sine', 60, 40, 0.08, t, 0.15, bus);
      osc('sine', 60, 40, 0.06, t + 0.2, 0.12, bus);
      osc('sawtooth', 200, 600, 0.04, t + 0.1, 0.3, bus);
      noise(0.03, t + 0.15, 0.2, 2000, bus);
    },
    gravitonDeploy() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.6, 0.3, 0.2);
      osc('sine', 50, 30, 0.1, t, 0.25, bus);
      osc('sine', 80, 40, 0.06, t + 0.05, 0.2, bus);
      noise(0.03, t + 0.1, 0.15, 1500, bus);
    },
    gravitonPull() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.3, 0.2, 0.15);
      osc('sine', 65, 55, 0.04, t, 0.2, bus);
      osc('triangle', 130, 110, 0.02, t + 0.05, 0.15, bus);
    },
    gravitonCollapse() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.5, 0.3, 0.2);
      osc('sine', 30, 60, 0.08, t, 0.2, bus);
      osc('triangle', 60, 120, 0.04, t + 0.05, 0.15, bus);
      noise(0.02, t, 0.12, 2000, bus);
    },
    seekerDetonate() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.7, 0.4, 0.25);
      noise(0.12, t, 0.15, 6000, bus);
      osc('sine', 80, 30, 0.1, t, 0.2, bus);
      osc('sawtooth', 400, 100, 0.06, t + 0.02, 0.12, bus);
      osc('sine', 50, 25, 0.06, t + 0.1, 0.15, bus);
    },
    logFound() {
      const c = getCtx(); const t = c.currentTime;
      noise(0.04, t, 0.08, 2400);
      osc('triangle', 440, 880, 0.05, t + 0.04, 0.18);
      osc('sine', 1320, 1320, 0.03, t + 0.12, 0.22);
    },
    coreCollected() {
      const c = getCtx(); const t = c.currentTime;
      osc('triangle', 880, 1760, 0.05, t, 0.10);
      osc('sine', 1760, 2640, 0.03, t + 0.03, 0.14);
    },
    logRead() {
      const c = getCtx(); const t = c.currentTime;
      osc('square', 660, 660, 0.02, t, 0.04);
      osc('sine', 990, 1320, 0.03, t + 0.03, 0.18);
    },
    pulserCharge() {
      const c = getCtx(); const t = c.currentTime;
      osc('sawtooth', 200, 600, 0.05, t, 0.5);
      osc('sine', 300, 900, 0.03, t + 0.1, 0.4);
      osc('square', 150, 400, 0.02, t + 0.2, 0.3);
    },
    pulserFire() {
      const c = getCtx(); const t = c.currentTime;
      noise(0.08, t, 0.08, 5000);
      osc('sawtooth', 500, 150, 0.07, t, 0.1);
      osc('sine', 200, 80, 0.05, t + 0.02, 0.12);
    },
    eliteVolatile() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.8, 0.4, 0.3);
      osc('sine', 60, 25, 0.15, t, 0.3, bus);
      noise(0.15, t, 0.18, 5000, bus);
      osc('sawtooth', 300, 800, 0.08, t + 0.03, 0.15, bus);
      osc('sine', 45, 20, 0.08, t + 0.12, 0.2, bus);
    },
    eliteFrenzy() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.6, 0.3, 0.2);
      osc('sawtooth', 120, 280, 0.1, t, 0.2, bus);
      osc('square', 200, 500, 0.06, t + 0.05, 0.15, bus);
      noise(0.06, t + 0.02, 0.08, 4000, bus);
    },
    elitePredator() {
      // Voices end by 0.15s; this cue is triggered immediately before audio.hit(true). Not eliteFrenzy or shieldBreak.
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.7, 0.35, 0.25);
      osc('square',   1400, 700,  0.08, t,        0.10, bus, { attack:0.002 });
      osc('triangle', 1100, 550,  0.06, t + 0.05, 0.10, bus, { attack:0.002 });
      noise(0.04, t, 0.06, 5000, bus, { filterType:'highpass' });
    },
    holoDecoyDeploy() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.7, 0.4, 0.3);
      osc('triangle', 600, 1200, 0.08, t, 0.15, bus);
      osc('sine', 900, 1600, 0.05, t + 0.05, 0.12, bus);
      noise(0.04, t + 0.02, 0.1, 6000, bus);
      osc('sine', 400, 800, 0.06, t + 0.08, 0.15, bus);
    },
    holoDecoyExpire() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.6, 0.3, 0.2);
      osc('triangle', 1200, 300, 0.08, t, 0.2, bus);
      osc('square', 800, 200, 0.05, t + 0.03, 0.15, bus);
      noise(0.08, t, 0.12, 5000, bus);
    },
    hackwareScrapMagnet() {
      // Not holoDecoyDeploy or hackwareGravity; the gold ring needs its own cue.
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.8, 0.35, 0.45);
      osc('triangle', 880, 1760, 0.07, t, 0.14, bus, { attack:0.002 });
      osc('sine',     1320, 2200, 0.05, t + 0.04, 0.12, bus, { attack:0.002 });
      osc('sine',      660, 1100, 0.05, t + 0.08, 0.14, bus, { attack:0.002 });
      noise(0.03, t, 0.08, 6500, bus, { filterType:'highpass' });
    },
    upgradePurchased() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.7, 0.35, 0.4);
      osc('triangle', 520, 780, 0.07, t, 0.10, bus, { attack:0.002 });
      osc('triangle', 780, 1170, 0.06, t + 0.06, 0.12, bus, { attack:0.002 });
      osc('sine',     1170, 1560, 0.05, t + 0.13, 0.14, bus, { attack:0.002 });
      osc('sine',     90, 60, 0.07, t, 0.18, bus);
      noise(0.025, t, 0.05, 6000, bus, { filterType:'highpass' });
    },
    hubAmbient() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(3.0, 0.5, 0.7);
      osc('sine', 55, 55, 0.04, t, 2.8, bus, { attack:0.4 });
      osc('sine', 82, 82, 0.03, t, 2.8, bus, { attack:0.5 });
      osc('triangle', 440, 660, 0.015, t + 0.6, 1.4, bus, { attack:0.6 });
      noise(0.008, t, 2.5, 1200, bus, { filterType:'bandpass', filterFreq2:800, q:0.6 });
    }
  };
})();

// iOS leaves an interrupted AudioContext running and that kills the rAF chain.
// game.js clears wasAutoPaused on any transition out of PAUSED; visibility return leaves it set.
let _autoPaused = false;
let _preVisibilityState = null;

const _PAUSABLE_STATES = _PG_STATE_DEFS.PAUSABLE_STATES;
const _RUN_SAVE_STATES = _PG_STATE_DEFS.RUN_SAVE_STATES;

function saveRunForPageInterruption() {
  if (typeof game === 'undefined' || !_G.player || !_RUN_SAVE_STATES.has(_G.state)) return;
  if (typeof _G.saveGame === 'function') _G.saveGame();
}

function _onVisibilityHidden() {
  saveRunForPageInterruption();
  // Touching the context keeps iOS from parking it in 'interrupted'.
  if (audio.isRunning()) {
    try { audio.resume(); } catch (_) {} // resume() is a no-op while running; the call is what touches getCtx()
  }
  if (typeof game !== 'undefined' && _PAUSABLE_STATES.has(_G.state)) {
    _preVisibilityState = _G.state;
    _autoPaused = true;
    // Survives hidden→visible while PAUSED. game.js clears it on any transition out of PAUSED.
    _G.wasAutoPaused = true;
    _G.setState(_PG_STATES.PAUSED);
  }
}

function _onVisibilityVisible() {
  // iOS may reject this without a gesture. The next touchstart/mousedown retries.
  audio.resume();
  if (_autoPaused && typeof game !== 'undefined') {
    _autoPaused = false;
    // Leave PAUSED. Returning must not resume the run under the player.
    _preVisibilityState = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) _onVisibilityHidden();
  else _onVisibilityVisible();
});
window.addEventListener('pagehide', saveRunForPageInterruption);
window.addEventListener('beforeunload', saveRunForPageInterruption);
// bfcache restore fires pageshow, not visibilitychange.
window.addEventListener('pageshow', (e) => {
  if (e.persisted) _onVisibilityVisible();
});

// Mobile URL bar changes visualViewport, not window.
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    resize();
    if (typeof updateBtns === 'function') updateBtns();
    if (typeof resetTouch === 'function') resetTouch();
  });
}
