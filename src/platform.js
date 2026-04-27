// @ts-check
'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────
let W = 900, H = 600;
let gameScale = 1;
const TILE = 32;
const MAP_W = 80, MAP_H = 50;
const TWO_PI = Math.PI * 2;
const SAVE_VERSION = '9.0';

const T = { VOID:0, WALL:1, FLOOR:2, STAIRS:3, TERMINAL:4, DOOR:5, DOOR_OPEN:6, LOCKED_R:7, LOCKED_B:8, LOCKED_G:9, TRAP_SPIKE:10, TRAP_SLOW:11, PLASMA:12, ARC:13, VENDOR:14, CRACKED:15, LORE:16, CHALLENGE_GATE:17, IMPLANT_SHRINE:18, EVENT_TERMINAL:19, TELEPORT_PAD:20, CRATE:21, TOXIC:22 };

// ─── Settings ────────────────────────────────────────────────────────────────
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

/** @type {{ sfxVol:number, musicVol:number, screenShake:boolean, damageNumbers:boolean, lockAimToMove:boolean, aimAssist:boolean, keyMap:Record<string,string>, load():void, save():void, resetAll():void }} */
const settings = {
  sfxVol: 1.0,
  musicVol: 1.0,
  screenShake: true,
  damageNumbers: true,
  lockAimToMove: false,
  aimAssist: false,  // accessibility — auto-aim at nearest visible enemy
  keyMap: { ...DEFAULT_KEY_MAP },
  load() {
    try {
      const raw = JSON.parse(localStorage.getItem('neonDungeonSettings') || 'null');
      if (!raw) return;
      if (typeof raw.sfxVol === 'number') this.sfxVol = Math.max(0, Math.min(1, raw.sfxVol));
      if (typeof raw.musicVol === 'number') this.musicVol = Math.max(0, Math.min(1, raw.musicVol));
      if (typeof raw.screenShake === 'boolean') this.screenShake = raw.screenShake;
      if (typeof raw.damageNumbers === 'boolean') this.damageNumbers = raw.damageNumbers;
      if (typeof raw.lockAimToMove === 'boolean') this.lockAimToMove = raw.lockAimToMove;
      if (typeof raw.aimAssist === 'boolean') this.aimAssist = raw.aimAssist;
      if (raw.keyMap && typeof raw.keyMap === 'object') {
        for (const a of Object.keys(DEFAULT_KEY_MAP)) {
          if (typeof raw.keyMap[a] === 'string') this.keyMap[a] = raw.keyMap[a];
        }
      }
    } catch(e) {}
  },
  save() {
    try {
      localStorage.setItem('neonDungeonSettings', JSON.stringify({
        sfxVol: this.sfxVol, musicVol: this.musicVol,
        screenShake: this.screenShake, damageNumbers: this.damageNumbers,
        lockAimToMove: this.lockAimToMove,
        aimAssist: this.aimAssist,
        keyMap: this.keyMap
      }));
    } catch(e) {}
  },
  resetAll() {
    this.sfxVol = 1.0; this.musicVol = 1.0;
    this.screenShake = true; this.damageNumbers = true;
    this.lockAimToMove = false;
    this.aimAssist = false;
    this.keyMap = { ...DEFAULT_KEY_MAP }; this.save();
  }
};
settings.load();

// Key-map lookup: km('interact') returns the current key code for that action
/** @param {string} action */
function km(action) { return settings.keyMap[action]; }
// Alternate keys that always work alongside the mapped key
const ALT_KEYS = { up:'ArrowUp', down:'ArrowDown', left:'ArrowLeft', right:'ArrowRight', dash:'ShiftRight' };

// ─── Canvas Setup ────────────────────────────────────────────────────────────
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('c'));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
canvas.width = W; canvas.height = H;

// Phase 3B: Proxy-based alias for the cross-file `game` global. Resolved
// lazily on each property access, so this works even though platform.js
// loads BEFORE game.js (where `const game = {...}` lives) — see types/neon.d.ts.
// Avoids a cascade of TS2339s when accessing fields that are added at runtime
// (e.g. game.hub, game._newGameConfirm, game.menuSel).
/** @type {any} */
const _G = new Proxy({}, {
  get: (_t, p) => /** @type {any} */ (game)[p],
  set: (_t, p, v) => { /** @type {any} */ (game)[p] = v; return true; },
  has: (_t, p) => p in /** @type {any} */ (game),
});

// Phase C1d: viewport math lives in engine/viewport.js (pure helpers).
// platform.js still owns the mutable W/H/gameScale/scale/offX/offY/safe-area
// state for back-compat with all consumers in src/*.js — resize() and
// updateLayout() are now thin orchestrators over the engine helpers.
// Browser-only: engine/viewport.js loads first via index.html and mounts
// itself as window.NEON.viewport. No Node fallback (platform.js never runs
// under Node — it touches `document`, `window`, `screen` at module top).
/** @type {any} */
const _vp = /** @type {any} */ (NEON).viewport;

// Safe-area insets (logical px) for notched devices
let safeTop = 0, safeRight = 0, safeBottom = 0, safeLeft = 0;

let scale = 1, offX = 0, offY = 0;
function resize() {
  // Use the canvas's actual rendered rect — works correctly with dvh/vh CSS
  // and respects whatever the browser decides is the visible area.
  const rect = canvas.getBoundingClientRect();
  const vw = rect.width  || window.innerWidth;
  const vh = rect.height || window.innerHeight;
  // Scale: smaller viewport dimension maps to ~600 logical px
  // Tiles (20 logical px) appear as 20 × gameScale CSS px on screen
  // Clamped so tiles stay between ~14 CSS px (0.7) and ~30 CSS px (1.5)
  gameScale = _vp.computeScale(vw, vh);
  const _sz = _vp.computeLogicalSize(vw, vh, gameScale);
  W = _sz.W;
  H = _sz.H;
  canvas.width = W;
  canvas.height = H;
  scale = gameScale;
  offX = 0;
  offY = 0;
  // Read safe-area insets from CSS env() and convert to logical px
  const cs = getComputedStyle(document.documentElement);
  const _sa = _vp.parseSafeAreaInsets((/** @type {string} */ n) => cs.getPropertyValue(n), gameScale);
  safeTop    = _sa.top;
  safeRight  = _sa.right;
  safeBottom = _sa.bottom;
  safeLeft   = _sa.left;
  updateLayout();
  console.log(`[NEON DUNGEON] ${vw.toFixed(0)}×${vh.toFixed(0)} → ${W}×${H} (×${gameScale.toFixed(2)}) tile=${(TILE*gameScale).toFixed(1)}css-px compact=${layout.compact}`);
}
// resize() + event listener registered in Boot section (after all defs are ready)

// ─── Layout (shared HUD / bottom-UI metrics) ────────────────────────────────
const layout = { compact: false, hudH: 40, hudTop: 0, msgBase: 0 };
function updateLayout() {
  const _l = _vp.computeLayout(W, H, safeBottom);
  layout.compact = _l.compact;
  layout.hudH    = _l.hudH;
  layout.hudTop  = _l.hudTop;
  layout.msgBase = _l.msgBase;
}

// ─── Fullscreen (landscape auto-request, portrait auto-exit) ─────────────────
// Treat the fullscreen-related Element/Document/HTMLCanvasElement extensions as
// `any` — modern TS lib.dom.d.ts only declares the standard names, but we need
// to feature-detect webkit-prefixed variants for Safari/iOS.
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
let fsWantLandscape = false;   // true when landscape but no gesture yet
let fsDismissed = false;       // user tapped X to dismiss the prompt this session

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
    // only reset dismiss on actual portrait→landscape transition
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
// also recheck on resize (some browsers fire resize instead of orientationchange)
window.addEventListener('resize', onOrientationChange);
// set initial state
onOrientationChange();

// ─── Input ───────────────────────────────────────────────────────────────────
// Phase C1b: keyboard event wiring + held-keys/justPressed/justReleased state
// live in engine/input.js (NEON.input.createEngine factory). Host owns content-
// layer state: `lastKey` (name-entry text capture, see game.js NAME_ENTRY) and
// `nameEntryTap` (touch hit-test relay). We layer those onto the engine via
// the onKeyDown callback. clearJust() wraps engine.clearJust() and also nulls
// host state so the existing one-call-per-frame contract is preserved for all
// downstream consumers (game.js, render.js, content.js).
const _input = /** @type {any} */ (NEON).input.createEngine({
  win: window,
  onKeyDown: (/** @type {any} */ e) => { lastKey = e.key; },
});
_input.attach();
const keys = _input.keys;
const justPressed = _input.justPressed;
const justReleased = _input.justReleased;
const mouse = { x: W/2, y: H/2, down: false };
let lastKey = '';
/** @type {any} */
let nameEntryTap = null;
canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * canvas.width / r.width;
  mouse.y = (e.clientY - r.top)  * canvas.height / r.height;
});
canvas.addEventListener('mousedown', e => { mouse.down = true; justPressed.add('MouseLeft'); audio.resume(); });
canvas.addEventListener('mouseup',   e => { mouse.down = false; });
window.addEventListener('mouseup',   e => { mouse.down = false; });
// Scroll wheel: weapon belt cycling
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  justPressed.add(e.deltaY > 0 ? 'WheelDown' : 'WheelUp');
}, { passive: false });

// ─── Touch Controls ──────────────────────────────────────────────────────────
const JR = 55; // joystick base radius
/** @type {{ joystick:{active:boolean,id:number|null,baseX:number,baseY:number,dx:number,dy:number}, aim:{active:boolean,id:number|null,baseX:number,baseY:number,dx:number,dy:number,shooting:boolean}, btnE:number|null, btnV:number|null, btnF:number|null, btnDash:number|null, btnPause:number|null }} */
const touch = {
  joystick: { active:false, id:null, baseX:0, baseY:0, dx:0, dy:0 },
  aim:      { active:false, id:null, baseX:0, baseY:0, dx:0, dy:0, shooting:false },
  // button touch IDs
  btnE: null, btnV: null, btnF: null, btnDash: null, btnPause: null,
};

// Button definitions — positions updated dynamically by updateBtns()
/** @typedef {{ x:number, y:number, r:number, label:string, colour:string, hidden?:boolean }} TouchBtn */

/** @type {Record<'E'|'F'|'V'|'DASH'|'PAUSE', TouchBtn>} */
const BTNS = {
  E:     { x:0, y:0, r:30, label:'E',  colour:'#00f5ff' },
  F:     { x:0, y:0, r:28, label:'F',  colour:'#ff8800' },
  V:     { x:0, y:0, r:28, label:'V',  colour:'#aa00ff' },
  DASH:  { x:0, y:0, r:28, label:'⇧',  colour:'#ffb700' },
  PAUSE: { x:0, y:0, r:20, label:'II', colour:'#ff00c8' },
};
function updateBtns() {
  // Scale up buttons on small screens (min ~44 CSS px diameter)
  const minR = 22 / gameScale;
  BTNS.E.r     = Math.max(30, minR);
  BTNS.F.r     = Math.max(28, minR);
  BTNS.V.r     = Math.max(28, minR);
  BTNS.DASH.r  = Math.max(28, minR);
  BTNS.PAUSE.r = Math.max(20, Math.ceil(minR * 0.7));
  // F button: always visible, but dimmed when no hackware
  BTNS.F.hidden = false;
  // Position from edges, respecting safe-area insets
  const pr = Math.max(10, safeRight);
  const pt = Math.max(10, safeTop);
  const btnY = layout.hudTop - BTNS.E.r - 16;
  BTNS.E.x     = W - pr - 230;
  BTNS.E.y     = btnY;
  BTNS.DASH.x  = W - pr - 160;
  BTNS.DASH.y  = btnY;
  BTNS.F.x     = W - pr - 90;
  BTNS.F.y     = btnY;
  BTNS.V.x     = W - pr - 20;
  BTNS.V.y     = btnY - 55;
  BTNS.PAUSE.x = W - pr - 30;
  BTNS.PAUSE.y = pt + 30;
}

// toCanvas / hitBtn are pure helpers extracted to engine/touch.js (Phase C1e).
// Host keeps thin wrappers so the canvas + gameScale stay implicit at call
// sites in this file.
const _touchHelpers = NEON.touch;

/**
 * @param {number} clientX
 * @param {number} clientY
 * @returns {[number, number]}
 */
function toCanvas(clientX, clientY) {
  return _touchHelpers.toCanvas(clientX, clientY, canvas);
}

/**
 * @param {number} cx
 * @param {number} cy
 * @param {TouchBtn} btn
 */
function hitBtn(cx, cy, btn) {
  return _touchHelpers.hitBtn(cx, cy, btn, gameScale);
}

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  audio.resume();
  // check if any touch hit the fullscreen dismiss button first
  let dismissed = false;
  for (let _i = 0; _i < e.changedTouches.length; _i++) { const t = e.changedTouches[_i]; if (!t) continue;
    const [cx, cy] = toCanvas(t.clientX, t.clientY);
    if (fsWantLandscape && !fsApi.element() && !fsDismissed
        && cx < 48 && cy < 48) {
      fsDismissed = true; dismissed = true;
    }
  }
  // piggyback on user gesture: request fullscreen if landscape wants it
  if (!dismissed && fsWantLandscape && !fsApi.element() && !fsDismissed) tryFullscreen();
  for (let _i = 0; _i < e.changedTouches.length; _i++) { const t = e.changedTouches[_i]; if (!t) continue;
    const [cx, cy] = toCanvas(t.clientX, t.clientY);
    // skip the dismiss touch (already handled above)
    if (cx < 48 && cy < 48 && dismissed) continue;
    // In non-playing states, any touch acts as confirm (except NAME_ENTRY, POWERUP_CHOICE)
    if (_G.state !== 'PLAYING' && _G.state !== 'FADE') {
      if (_G.state === 'NAME_ENTRY') { nameEntryTap=[cx,cy]; continue; }
      if (_G.state === 'POWERUP_CHOICE' || _G.state === 'SHOPPING' || _G.state === 'PERK_CHOICE' || _G.state === 'AUGMENT_CHOICE' || _G.state === 'EVENT_CHOICE') {
        // Route touch position via mouse so update handler handles it
        mouse.x = cx; mouse.y = cy;
        justPressed.add('MouseLeft');
        continue;
      }
      if (_G.state === 'SETTINGS') {
        mouse.x = cx; mouse.y = cy;
        justPressed.add('MouseLeft');
        continue;
      }
      if (_G.state === 'PAUSED') {
        // 3 zones: top third = resume, middle third = settings, bottom third = quit
        if (cy < H * 0.38) justPressed.add('Escape');
        else if (cy < H * 0.62) justPressed.add('KeyS');
        else justPressed.add('KeyQ');
      }
      else if (_G.state === 'HUB') {
        // The Gap. Mobile users have no SPACE key to descend and no number
        // keys to pick a terminal — route taps via hub.hitTestHub which owns
        // the hub layout (single source of truth, see hub.js _layoutHub).
        let hit = null;
        try {
          if (typeof NEON !== 'undefined' && NEON.hub && NEON.hub.hitTestHub) {
            hit = NEON.hub.hitTestHub(_G, cx, cy);
          }
        } catch (_) {}
        if (hit && hit.kind === 'terminal') {
          // Tap a card → select + activate. Always select first so the
          // highlight reflects the tap even if the same card is re-tapped.
          if (_G.hub) _G.hub.selected = hit.index;
          justPressed.add('Enter');
        } else if (hit && hit.kind === 'descend') {
          justPressed.add('Space');
        } else if (_G.hub && _G.hub.activePanel) {
          // A panel is open. Route the tap to the panel's onTap if it
          // implements one (upgrade matrix grid, module slots rows,
          // archive list rows). If the tap was outside the panel rect,
          // synthesize MouseLeft so updateHub's existing close-on-
          // outside-tap branch fires.
          let consumedByPanel = false;
          try {
            if (typeof NEON !== 'undefined' && NEON.hub && NEON.hub.hitTestActivePanel) {
              consumedByPanel = !!NEON.hub.hitTestActivePanel(_G, cx, cy);
            }
          } catch (_) {}
          if (!consumedByPanel) {
            mouse.x = cx; mouse.y = cy;
            justPressed.add('MouseLeft');
          }
        }
        // Otherwise: tap on empty hub space → no-op (don't accidentally
        // activate the selected terminal).
      }
      else if (_G.state === 'MENU') {
        const narrow = layout.compact;
        // Confirm overlay intercepts touches when active
        if (_G._newGameConfirm) {
          const c = _G._newGameConfirm;
          const boxW = Math.min(520, W - 40);
          const boxH = narrow ? 180 : 200;
          const bx = (W - boxW) / 2, by = (H - boxH) / 2;
          const btnY = by + (narrow ? 120 : 138);
          // Hit-test inside the dialog box
          if (cx >= bx && cx <= bx + boxW && cy >= by && cy <= by + boxH) {
            // Button zone: within 20px of button Y
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
            // Tap outside the dialog → cancel
            justPressed.add('Escape');
          }
          continue;
        }
        // Hit-test against actual menu item positions (must match renderMenu)
        const titleFs = narrow ? 56 : 72;
        const ty1 = narrow ? 120 : 160;
        const startY = ty1 + titleFs * 0.95 + 80;
        const gap = narrow ? 48 : 36;
        const opts = _G.getMenuOptions();
        // Bounding-box hit test: tap must be within gap/2 of a row center
        let hit = -1;
        for (let i = 0; i < opts.length; i++) {
          const oy = startY + i * gap;
          if (Math.abs(cy - oy) <= gap / 2) { hit = i; break; }
        }
        if (hit < 0) continue; // tap outside any menu item — ignore
        _G.menuSel = hit;
        // On the difficulty row, left/right edge taps cycle, center taps start
        if (opts[hit]?.isDiffRow) {
          if (cx < W * 0.35) justPressed.add('ArrowLeft');
          else if (cx > W * 0.65) justPressed.add('ArrowRight');
          else justPressed.add('Enter');
        } else {
          justPressed.add('Enter');
        }
      }
      else if (_G.state === 'ARCHIVES') {
        // Hit-test against upgrade rows or back button
        const narrow = layout.compact;
        const startY = narrow ? 95 : 120;
        const rowH = narrow ? 42 : 50;
        if (cy > H - 60) {
          // Back button area
          justPressed.add('Escape');
        } else {
          // Find closest upgrade row
          let best = 0, bestDist = Infinity;
          for (let i = 0; i < META_UPGRADES.length; i++) {
            const oy = startY + i * rowH;
            const d = Math.abs(cy - oy);
            if (d < bestDist) { bestDist = d; best = i; }
          }
          _G.archivesSel = best;
          justPressed.add('Enter');
        }
      }
      else if (_G.state === 'ENDGAME_CHOICE') {
        // Two-option dialog: left half = ACCEPT (selected=0), right half =
        // REFUSE (selected=1). Single tap selects + confirms — keyboard users
        // get arrow-key preview, touch users commit in one motion. The 0.5s
        // input lock-out in updateEndgameChoice still absorbs accidental
        // mashes during the dialog fade-in, so the synthesised Enter is safe.
        if (_G._endgameChoice) {
          _G._endgameChoice.selected = (cx < W / 2) ? 0 : 1;
        }
        justPressed.add('Enter');
      }
      else { justPressed.add('Enter'); justPressed.add('MouseLeft'); }
      continue;
    }
    // button priority
    // Expanded map: any tap closes (modal — takes priority)
    if (_G.mapExpanded) { justPressed.add('Tab'); continue; }
    if (hitBtn(cx,cy,BTNS.E))     { touch.btnE=t.identifier; justPressed.add(km('interact')); continue; }
    if (hitBtn(cx,cy,BTNS.F) && _G.player && _G.player.hackware) { touch.btnF=t.identifier; justPressed.add(km('hackware')); continue; }
    if (hitBtn(cx,cy,BTNS.V))     { touch.btnV=t.identifier; justPressed.add(km('voidshard')); continue; }
    if (hitBtn(cx,cy,BTNS.DASH))  { touch.btnDash=t.identifier; justPressed.add(km('dash')); continue; }
    if (hitBtn(cx,cy,BTNS.PAUSE)) { touch.btnPause=t.identifier; justPressed.add('Escape'); continue; }
    // Tap minimap area to expand (after buttons so pause isn't stolen)
    const _mx = W - 120 - 8 - safeRight, _my = 8 + safeTop;
    if (cx >= _mx - 2 && cx <= _mx + 122 && cy >= _my - 2 && cy <= _my + 82) { justPressed.add('Tab'); continue; }
    // left half = joystick
    if (cx < W/2 && !touch.joystick.active) {
      touch.joystick.active=true; touch.joystick.id=t.identifier;
      touch.joystick.baseX=cx;   touch.joystick.baseY=cy;
      touch.joystick.dx=0;       touch.joystick.dy=0;
    } else if (cx >= W/2 && !touch.aim.active) {
      touch.aim.active=true; touch.aim.id=t.identifier;
      touch.aim.baseX=cx; touch.aim.baseY=cy;
      touch.aim.dx=0; touch.aim.dy=0; touch.aim.shooting=true;
      // Initialise mouse position so first shot aims toward the tap
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
  // Skip entirely on non-touch devices so desktop users don't see ghost
  // joysticks + action buttons overlaid on the play area. Hit-tests in the
  // touchstart handler are already touch-only by virtue of the event source,
  // so no input is lost — this is purely a render gate.
  if (!isTouchDevice()) return;
  // F button: always visible, dimmed when no hackware
  BTNS.F.hidden = false;
  // Left joystick (move)
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
    // ghost move joystick hint
    const hintY = layout.hudTop - 26;
    ctx.save(); ctx.globalAlpha=0.12;
    ctx.strokeStyle='#00f5ff'; ctx.lineWidth=1.5;
    NEON.draw.circleStroke(ctx,80,hintY,JR);
    ctx.fillStyle='#00f5ff';
    NEON.draw.circle(ctx,80,hintY,18);
    ctx.restore();
  }
  // Right joystick (aim)
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
    // ghost aim joystick hint
    const hintY = layout.hudTop - 26;
    ctx.save(); ctx.globalAlpha=0.12;
    ctx.strokeStyle='#ff00c8'; ctx.lineWidth=1.5;
    NEON.draw.circleStroke(ctx,W/2+80,hintY,JR);
    ctx.fillStyle='#ff00c8';
    NEON.draw.circle(ctx,W/2+80,hintY,18);
    ctx.restore();
  }
  // Buttons
  for (const [key,btn] of Object.entries(BTNS)) {
    if (btn.hidden) continue;
    const active = (key==='E'&&touch.btnE!==null)||(key==='F'&&touch.btnF!==null)||(key==='V'&&touch.btnV!==null)||(key==='DASH'&&touch.btnDash!==null)||(key==='PAUSE'&&touch.btnPause!==null);
    const noHackware = key==='F' && !(_G.player && _G.player.hackware);
    ctx.save();
    // Show cooldown overlay on dash button
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
    ctx.fillStyle=btn.colour; ctx.font=`bold ${key==='PAUSE'?11:14}px monospace`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(btn.label,btn.x,btn.y);
    ctx.restore();
  }
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';

  // Fullscreen prompt (landscape, not fullscreen, not dismissed, API available)
  if (fsWantLandscape && !fsApi.element() && !fsDismissed && fsApi.supported) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    // pill background
    const pw = 180, ph = 32, px = (W - pw) / 2, py = 6;
    ctx.fillStyle = '#0a0a12';
    ctx.strokeStyle = '#00f5ff';
    ctx.lineWidth = 1;
    NEON.draw.rectFillStroke(ctx, px, py, pw, ph);
    // text
    ctx.fillStyle = '#00f5ff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('TAP FOR FULLSCREEN', W / 2, py + ph / 2);
    // dismiss X button (top-left corner)
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
function clearJust() { _input.clearJust(); lastKey=''; nameEntryTap=null; }

// ─── Utilities ───────────────────────────────────────────────────────────────
// Math/RNG primitives moved to engine/math.js (Phase C1a). They are mounted as
// bare globals (rnd, rndInt, clamp, dist, dist2, norm, lerp) by that module's
// UMD bootstrap, which loads before this file. Call sites here and across
// src/* keep working without any rename. Do not redeclare them here — adding
// a `function rnd(){}` etc. would shadow the engine version.
/** @param {{x:number,y:number}} entity */
function clampToBossRoom(entity) {
  if (!_G.bossSealed || !_G.bossRoom) return;
  const r = _G.bossRoom;
  entity.x = Math.max(r.x + 0.5, Math.min(r.x + r.w - 0.5, entity.x));
  entity.y = Math.max(r.y + 0.5, Math.min(r.y + r.h - 0.5, entity.y));
}
// UNCHAINED #37 KINETIC_BUFFER: scale boss knockback by module multiplier.
function playerKnockMul() {
  // typeof guard: matches the safe-init pattern used at the bottom of this
  // file (lines ~1974, ~1986). `_G && ...` would NOT short-circuit because
  // _G is a Proxy and Proxies are always truthy.
  if (typeof game === 'undefined') return 1;
  const p = _G.player;
  return (p && p.metaFlags && p.metaFlags.knockbackTakenMul) || 1;
}

// ─── LOS memoisation (Phase 2) ────────────────────────────────────────────────
// Per-frame cache. Key = (fromTile << 16) | toTile where tile = ty*MAP_W+tx.
// MAP_W*MAP_H = 4000 fits comfortably in 16 bits. Cleared at the top of every
// game.update() and on any dungeon.map mutation (door open, crate break, etc).
// Cache stats exposed for debugging via game._losCacheStats.
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
    // Diagonal corner-cut block: can't see through touching wall corners
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
  // Bail on out-of-range tile coords (cache key would collide); raw handles OOB.
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

// Tile helpers
/** @param {any} t */
function isPassable(t) { return t===T.FLOOR||t===T.STAIRS||t===T.TERMINAL||t===T.DOOR_OPEN||t===T.TRAP_SPIKE||t===T.TRAP_SLOW||t===T.PLASMA||t===T.ARC||t===T.VENDOR||t===T.LORE||t===T.CHALLENGE_GATE||t===T.IMPLANT_SHRINE||t===T.EVENT_TERMINAL||t===T.TELEPORT_PAD||t===T.TOXIC; }
/** @param {any} t */
function isSeeThrough(t) {
  return t!==T.WALL && t!==T.VOID && t!==T.CRACKED && t!==T.DOOR && t!==T.LOCKED_R && t!==T.LOCKED_B && t!==T.LOCKED_G && t!==T.CRATE;
}
/** @param {any} t */
function isDoor(t) { return t===T.DOOR||t===T.LOCKED_R||t===T.LOCKED_B||t===T.LOCKED_G; }
/** @param {any} t */
function doorKeyColour(t) { return t===T.LOCKED_R?'red':t===T.LOCKED_B?'blue':t===T.LOCKED_G?'gold':null; }

// ─── Audio Engine ────────────────────────────────────────────────────────────
// Engine primitives (AudioContext, busses, voices, noise buffer) live in
// engine/audio.js — see Phase C1c. This IIFE wraps the engine and defines all
// the NEON-specific named SFX (shoot, hit, menuSelect, etc.) as a content
// layer on top of those primitives.
const audio = (() => {
  const _eng = /** @type {any} */ (NEON).audio.createEngine({
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
        // Shotgun blast: body thump + wide pellet transients
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
        // Charge whip + crack + resonant tail
        const bus = wetDry(1, 0.3, 0.6);
        osc('sine', 1800, 4200, 0.038, t, 0.11, bus, { attack:0.015, pan:-0.2, filterType:'bandpass', filterFreq:1800, filterFreq2:4200 });
        osc('triangle', 1200, 3600, 0.034, t + 0.015, 0.09, bus, { pan:0.2, filterType:'bandpass', filterFreq:1500, filterFreq2:3800 });
        noise(0.085, t + 0.07, 0.05, 7200, bus, { filterType:'highpass', pan:0.05 });
        osc('sine', 2700, 680, 0.095, t + 0.07, 0.32, bus, { attack:0.0015, q:4.5, filterType:'bandpass', filterFreq:2200, filterFreq2:820 });
        osc('triangle', 1300, 320, 0.04, t + 0.08, 0.26, bus, { pan:0.18 });
      } else if (n === 'Plasma Sword') {
        // Energized slash: stereo whoosh with ionized edge
        const bus = wetDry(1, 0.22, 0.24);
        noise(0.09, t, 0.06, 2600, bus, { filterType:'bandpass', filterFreq2:1300, q:1.2, pan:-0.25 });
        osc('sawtooth', 820, 180, 0.10, t, 0.12, bus, { pan:-0.15, filterType:'lowpass', filterFreq:4000, filterFreq2:900 });
        osc('triangle', 1500, 340, 0.06, t + 0.01, 0.1, bus, { pan:0.2 });
        osc('sine', 280, 120, 0.04, t + 0.015, 0.08, bus, { pan:0.12 });
      } else if (n === 'Void Cannon') {
        // Deep impact: sub pressure + gritty harmonic bloom
        const bus = wetDry(1, 0.38, 0.5);
        osc('sine', 76, 28, 0.2, t, 0.32, bus, { attack:0.003, pan:-0.05 });
        osc('triangle', 152, 54, 0.09, t, 0.22, bus, { filterType:'lowpass', filterFreq:900, filterFreq2:400 });
        osc('square', 300, 74, 0.05, t + 0.01, 0.14, bus, { pan:0.15, filterType:'bandpass', filterFreq:900, filterFreq2:300 });
        noise(0.08, t, 0.09, 650, bus, { filterType:'lowpass', filterFreq2:320, q:0.5 });
      } else {
        // Pulse Pistol: focused chirp with short stereo tail
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
        // Player hurt: chest thump + brittle impact transient
        const bus = wetDry(1, 0.26, 0.28);
        noise(0.22, t, 0.1, 500, bus, { filterType:'lowpass', filterFreq2:220, pan:-0.08 });
        noise(0.08, t, 0.04, 3500, bus, { filterType:'highpass', pan:0.1 });
        osc('sine', 86, 28, 0.22, t, 0.17, bus, { attack:0.002 });
        osc('triangle', 46, 20, 0.1, t + 0.01, 0.12, bus, { pan:0.04 });
      } else {
        const n = weaponName;
        if (n === 'Scatter Gun') {
          // Pellet hit: bright granular ping
          osc('sine', 980, 320, 0.085, t, 0.055, null, { pan:Math.random() * 0.25 - 0.12 });
          noise(0.05, t, 0.025, 3600, null, { filterType:'bandpass', filterFreq2:1800, q:1.3 });
        } else if (n === 'Railgun') {
          // Rail impact: metallic crack + resonant ring
          const bus = wetDry(1, 0.2, 0.32);
          noise(0.085, t, 0.035, 6500, bus, { filterType:'highpass' });
          osc('sine', 2000, 620, 0.075, t, 0.2, bus, { filterType:'bandpass', filterFreq:2100, filterFreq2:850, q:5 });
          osc('triangle', 1300, 420, 0.032, t + 0.02, 0.18, bus, { pan:0.18 });
        } else if (n === 'Plasma Sword') {
          // Plasma cut: ion sizzle and short ring
          osc('sawtooth', 960, 220, 0.1, t, 0.09, null, { filterType:'bandpass', filterFreq:2600, filterFreq2:650 });
          noise(0.07, t, 0.04, 4200, null, { filterType:'bandpass', filterFreq2:1800, q:0.9 });
        } else if (n === 'Void Cannon') {
          // Void impact: compressed low slam
          const bus = wetDry(1, 0.25, 0.25);
          osc('sine', 130, 36, 0.14, t, 0.16, bus, { attack:0.002 });
          noise(0.08, t, 0.08, 500, bus, { filterType:'lowpass', filterFreq2:260 });
          osc('triangle', 220, 80, 0.04, t + 0.01, 0.1, bus, { pan:-0.1 });
        } else {
          // Pulse impact: quick bright ping with body
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
      // Quick ascending sparkle
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
      // Sub-bass drone
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
      // Final sustain chord
      osc('sine', 523, 523, 0.15, t + 0.72, 0.8, bus);
      osc('sine', 659, 659, 0.1,  t + 0.72, 0.8, bus);
    },
    phaseShift() {
      // Boss phase transition: digital alarm sweep + sub pulse + metallic ring
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.55, 1.0);
      // Rising alarm sweep
      osc('sawtooth', 220, 1400, 0.12, t, 0.28, bus, { pan:-0.22, filterType:'bandpass', filterFreq:500, filterFreq2:2400, q:1.2 });
      osc('sawtooth', 226, 1410, 0.10, t, 0.28, bus, { pan:0.22, filterType:'bandpass', filterFreq:520, filterFreq2:2500, q:1.2 });
      // Sub pulse
      osc('sine', 56, 38, 0.16, t + 0.04, 0.34, bus, { attack:0.003 });
      // Metallic ring
      osc('sine', 1900, 860, 0.085, t + 0.13, 0.54, bus, { pan:-0.14, filterType:'bandpass', filterFreq:2200, filterFreq2:850, q:5 });
      osc('triangle', 2500, 1120, 0.045, t + 0.13, 0.46, bus, { pan:0.14 });
      // Noise burst
      noise(0.12, t + 0.1, 0.14, 3400, bus, { filterType:'bandpass', filterFreq2:1500, q:1.1 });
    },
    menuSelect() {
      // Quick UI blip: short bright chirp
      const c = getCtx(); const t = c.currentTime;
      osc('sine', 1200, 1800, 0.10, t, 0.06);
      osc('triangle', 600, 900, 0.05, t, 0.04);
    },
    lowHealth() {
      // Heartbeat-style warning: two quick sub thumps
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
    toxicBurn() {
      const c = getCtx(); const t = c.currentTime;
      noise(0.04, t, 0.18, 600);
      osc('sine', 90, 40, 0.03, t, 0.15);
      osc('triangle', 120, 55, 0.02, t + 0.05, 0.12);
    },
    transition() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.3, 0.9);
      // Digital glitch: rapid stutter tones at random pitches
      for (let i = 0; i < 6; i++) {
        const s = t + i * 0.12 + Math.random() * 0.04;
        const f = 200 + Math.random() * 1800;
        osc('square', f, f * (0.3 + Math.random() * 0.7), 0.06, s, 0.04 + Math.random() * 0.06, bus);
      }
      // Filtered noise sweep (low → high, like data streaming)
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
      // Sub rumble
      osc('sine', 50, 35, 0.08, t, 0.8, bus);
    },
    roomSeal() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.4, 1.0);
      // Heavy metallic slam
      osc('square',   80,  30,  0.3,  t, 0.15, bus);
      osc('sawtooth', 120, 60,  0.15, t, 0.2,  bus);
      noise(0.25, t, 0.12, 800, bus);
      // Lock mechanism clank
      osc('square', 400, 200, 0.12, t + 0.15, 0.08, bus);
      osc('square', 300, 150, 0.10, t + 0.22, 0.06, bus);
      // Sub-bass thud
      osc('sine', 40, 25, 0.2, t, 0.3);
    },
    roomUnseal() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.3, 0.6);
      // Rising release tone
      osc('sine',     200, 500, 0.15, t, 0.3, bus);
      osc('triangle', 400, 800, 0.08, t + 0.05, 0.25, bus);
      // Hiss of pressure release
      noise(0.15, t, 0.25, 2000, bus);
    },
    roomClear() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.4, 0.5);
      // Bright ascending triple chime
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
      // UNCHAINED #37 — upgrade module pickup jingle. Distinct from
      // augmentInstall: ascending arpeggio with a short metallic ping.
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
      // Rising warning chirp — two quick ascending pips
      osc('sine', 800, 1600, 0.06, t, 0.08);
      osc('sine', 900, 1800, 0.05, t + 0.1, 0.08);
    },
    sniperFire() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.2, 0.3);
      // Sharp supersonic crack + low thud
      noise(0.20, t, 0.06, 8000, bus);
      osc('sawtooth', 1200, 200, 0.12, t, 0.08, bus);
      osc('sine', 60, 30, 0.10, t + 0.02, 0.15);
    },
    echoerLock() {
      const c = getCtx(); const t = c.currentTime;
      // Sonar ping — soft descending sine + faint reverb pip. Telegraphs
      // the lock without the hard threat-alert of sniperCharge.
      const bus = wetDry(1, 0.5, 0.4);
      osc('sine', 700, 380, 0.08, t, 0.18, bus);
      osc('sine', 1100, 550, 0.04, t + 0.05, 0.12, bus);
    },
    echoerFire() {
      const c = getCtx(); const t = c.currentTime;
      // Hollow echo-chamber pop — short triangle thump + decay tail.
      const bus = wetDry(1, 0.4, 0.5);
      osc('triangle', 240, 90, 0.14, t, 0.16, bus);
      noise(0.10, t + 0.02, 0.10, 1800, bus);
      osc('sine', 90, 55, 0.10, t, 0.12);
    },
    prophetLock() {
      const c = getCtx(); const t = c.currentTime;
      // Rising sonar — a forward-leaning ascending sine pair signals
      // "this one fires AHEAD", contrasting with echoerLock's descent.
      const bus = wetDry(1, 0.5, 0.4);
      osc('sine', 380, 760, 0.08, t, 0.18, bus);
      osc('sine', 580, 1180, 0.04, t + 0.05, 0.14, bus);
    },
    prophetFire() {
      const c = getCtx(); const t = c.currentTime;
      // Bright forward snap — sharper than echoerFire (faster projectile,
      // committed-strike timbre). Dry-leaning so it cuts through the lane.
      const bus = wetDry(1, 0.25, 0.35);
      osc('triangle', 520, 180, 0.12, t, 0.14, bus);
      noise(0.08, t + 0.01, 0.08, 3200, bus);
      osc('sine', 140, 70, 0.10, t, 0.10);
    },
    cryophageLock() {
      const c = getCtx(); const t = c.currentTime;
      // Crystalline ping — a glassy two-tone descending sine pair. Cooler
      // and shorter than echoerLock so the player can distinguish lattice
      // commits from sonar locks in mixed encounters.
      const bus = wetDry(1, 0.6, 0.3);
      osc('sine', 1100, 880, 0.06, t, 0.16, bus);
      osc('sine', 1480, 1180, 0.04, t + 0.04, 0.12, bus);
    },
    cryophageCommit() {
      const c = getCtx(); const t = c.currentTime;
      // Frosted shatter — short noise burst + low triangle thunk so the
      // commit cue is unmistakable even without the visual flash.
      const bus = wetDry(1, 0.4, 0.4);
      noise(0.10, t, 0.12, 4200, bus);
      osc('triangle', 180, 120, 0.10, t + 0.02, 0.14);
    },
    vengeanceCharge() {
      const c = getCtx(); const t = c.currentTime;
      // Low rumbling charge-up — descending sawtooth pair signals
      // "something heavy is winding up to retaliate". Wet for menace.
      const bus = wetDry(1, 0.55, 0.4);
      osc('sawtooth', 220, 90, 0.10, t, 0.55, bus);
      osc('sawtooth', 320, 130, 0.06, t + 0.10, 0.50, bus);
      osc('sine', 60, 40, 0.12, t, 0.30);
    },
    conduitFire() {
      const c = getCtx(); const t = c.currentTime;
      // Solo basic shot — short cyan zap. Lighter than the beam tick so
      // a clustered solo-fire room doesn't sound like a beam-storm.
      const bus = wetDry(1, 0.4, 0.3);
      osc('square', 720, 480, 0.04, t, 0.10, bus);
      osc('sine', 1100, 880, 0.03, t + 0.02, 0.08);
    },
    conduitBeam() {
      const c = getCtx(); const t = c.currentTime;
      // Per-tick beam zap — tight high-pass click + low body thunk so
      // the player feels the damage tick over the ambient electrical hum.
      const bus = wetDry(1, 0.35, 0.25);
      noise(0.06, t, 0.05, 6000, bus);
      osc('triangle', 320, 200, 0.06, t + 0.005, 0.10);
    },
    resonatorCharge() {
      const c = getCtx(); const t = c.currentTime;
      // Rising harmonic chord — the resonator winding up its cone. Two
      // detuned sines + a soft bell, wet for spatial threat.
      const bus = wetDry(1, 0.55, 0.35);
      osc('sine', 320, 720, 0.08, t, 0.55, bus);
      osc('sine', 480, 1080, 0.06, t + 0.05, 0.50, bus);
      osc('triangle', 220, 540, 0.05, t + 0.10, 0.45, bus);
    },
    resonatorFire() {
      const c = getCtx(); const t = c.currentTime;
      // Sonic-cone discharge — wet boom + descending whine + grit.
      const bus = wetDry(1, 0.35, 0.5);
      osc('sawtooth', 600, 90, 0.10, t, 0.20, bus);
      osc('sine', 140, 50, 0.18, t, 0.22, bus);
      noise(0.16, t + 0.01, 0.14, 2400, bus);
    },
    mirrorCharge() {
      const c = getCtx(); const t = c.currentTime;
      // Glassy ascending shimmer — "your shot is coming back". Bright
      // detuned sines so it reads as mimicry, not the resonator's chord.
      const bus = wetDry(1, 0.45, 0.40);
      osc('sine', 880, 1320, 0.06, t, 0.45, bus);
      osc('triangle', 660, 990, 0.05, t + 0.06, 0.40, bus);
      osc('sine', 1320, 1980, 0.04, t + 0.12, 0.35, bus);
    },
    mirrorFire() {
      const c = getCtx(); const t = c.currentTime;
      // Snappy reversed-shot pop — short, sharp, lime-bright register.
      const bus = wetDry(1, 0.25, 0.35);
      osc('square', 520, 220, 0.08, t, 0.18, bus);
      osc('sine', 1100, 440, 0.06, t, 0.16, bus);
      noise(0.05, t + 0.005, 0.06, 3200, bus);
    },
    reaperTelegraph() {
      const c = getCtx(); const t = c.currentTime;
      // Heartbeat-style descending pulse — "you've been marked". Two low
      // detuned thumps with a thin metallic shimmer on top so it cuts
      // through combat noise without overwhelming.
      const bus = wetDry(1, 0.30, 0.50);
      osc('sine', 220, 110, 0.09, t, 0.30, bus);
      osc('sine', 240, 120, 0.09, t + 0.18, 0.28, bus);
      osc('triangle', 880, 660, 0.05, t, 0.10, bus);
    },
    reaperFrenzy() {
      const c = getCtx(); const t = c.currentTime;
      // Sharp red roar — frenzy commits. Detuned saws + noise burst, more
      // aggressive than the telegraph pulse.
      const bus = wetDry(1, 0.20, 0.45);
      osc('sawtooth', 180, 90, 0.20, t, 0.30, bus);
      osc('sawtooth', 195, 95, 0.20, t, 0.26, bus);
      noise(0.10, t, 0.08, 2400, bus);
      osc('square', 660, 220, 0.10, t + 0.04, 0.16, bus);
    },
    ghostProjectorMemory() {
      // Soft chime + downward whisper — projector has CLAIMED a memory.
      // Subtle so it doesn't spam during a kill streak; player should
      // perceive it as ambience until they learn what it means.
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.55, 0.35);
      osc('sine', 880, 440, 0.05, t, 0.10, bus);
      osc('triangle', 660, 330, 0.04, t + 0.05, 0.10, bus);
    },
    ghostProjectorSpawn() {
      // Reverb-heavy rising tone + airy noise — "haunting commits".
      // Distinctly spectral compared to normal spawn sounds.
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.65, 0.50);
      osc('sine', 220, 660, 0.18, t, 0.18, bus);
      osc('triangle', 440, 1100, 0.14, t + 0.04, 0.14, bus);
      noise(0.12, t, 0.18, 3200, bus);
    },
    wardenCharge() {
      const c = getCtx(); const t = c.currentTime;
      // Low rumble + rising whoosh
      osc('sawtooth', 80, 200, 0.12, t, 0.25);
      noise(0.10, t + 0.05, 0.20, 1200);
      osc('sine', 50, 50, 0.08, t, 0.30);
    },
    wardenSlam() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.2, 0.4);
      // Heavy bass impact + debris rattle
      osc('sine', 40, 20, 0.25, t, 0.20, bus);
      noise(0.20, t + 0.02, 0.12, 2000, bus);
      osc('square', 120, 60, 0.10, t + 0.03, 0.15);
    },
    conductorArc() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.3, 0.5);
      // Electric crackle burst — short noise + rising zap
      noise(0.15, t, 0.08, 6000, bus);
      osc('sawtooth', 400, 1200, 0.10, t, 0.10, bus);
      osc('square', 200, 600, 0.06, t + 0.03, 0.08);
    },
    conductorPulse() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.3, 0.6);
      // Deep EM discharge — sub bass + wide noise burst
      osc('sine', 50, 30, 0.20, t, 0.25, bus);
      noise(0.22, t + 0.03, 0.15, 3000, bus);
      osc('sawtooth', 150, 80, 0.08, t + 0.05, 0.12);
    },
    genesisLance() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.2, 0.4);
      // Sharp focused beam — high sine ping + tight noise snap
      osc('sine', 1200, 800, 0.12, t, 0.08, bus);
      osc('square', 600, 200, 0.06, t + 0.02, 0.06);
      noise(0.08, t + 0.01, 0.05, 8000, bus);
    },
    genesisPurge() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.4, 0.6);
      // Deep resonant purge — sub pulse + harmonic ring
      osc('sine', 60, 40, 0.22, t, 0.30, bus);
      osc('triangle', 220, 440, 0.10, t + 0.05, 0.20, bus);
      noise(0.15, t + 0.08, 0.12, 2000, bus);
    },
    shieldBreak() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.3, 0.6);
      // Sharp descending crack
      osc('square',   800, 100, 0.2,  t, 0.15, bus);
      osc('sawtooth', 600,  80, 0.12, t + 0.02, 0.12, bus);
      noise(0.25, t, 0.1, 3000, bus);
      // Sub thud
      osc('sine', 60, 30, 0.15, t + 0.05, 0.2);
    },
    shieldRestore() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.4, 0.8);
      // Ascending shimmer chime
      osc('sine',     400, 900,  0.12, t, 0.3, bus);
      osc('triangle', 600, 1200, 0.08, t + 0.05, 0.25, bus);
      osc('sine',     800, 1400, 0.06, t + 0.1, 0.2, bus);
    },
    vendorOpen() {
      const c = getCtx(); const t = c.currentTime;
      // Digital cash register chime — three ascending tones
      osc('sine',     600,  800,  0.10, t, 0.08);
      osc('triangle', 800,  1100, 0.08, t + 0.08, 0.08);
      osc('sine',     1100, 1400, 0.10, t + 0.16, 0.12);
    },
    purchase() {
      const c = getCtx(); const t = c.currentTime;
      // Coin-drop confirmation bleep
      osc('sine',     1000, 1600, 0.12, t, 0.06);
      osc('triangle', 1400, 1800, 0.06, t + 0.04, 0.06);
      noise(0.04, t + 0.02, 0.04, 3000);
    },
    purchaseFail() {
      const c = getCtx(); const t = c.currentTime;
      // Low buzz rejection
      osc('square', 120, 90, 0.08, t, 0.15);
      noise(0.03, t, 0.08, 400);
    },
    wallBreak() {
      const c = getCtx(); const t = c.currentTime;
      // Crumbling rock: noise burst + low rumble + debris clinks
      noise(0.12, t, 0.25, 2000);
      osc('sine', 80, 30, 0.1, t, 0.3);
      osc('triangle', 40, 20, 0.06, t, 0.35);
      // Debris clinks
      for (let i=0; i<3; i++) {
        const d = 0.05 + i * 0.06;
        const f = 800 + Math.random() * 600;
        osc('sine', f, f*0.4, 0.03, t+d, 0.06);
      }
    },
    ricochet() {
      const c = getCtx(); const t = c.currentTime;
      // Metallic ping + high-frequency zing
      osc('sine', 2200, 800, 0.06, t, 0.08);
      osc('triangle', 3400, 1200, 0.03, t, 0.05);
      noise(0.02, t, 0.02, 6000);
    },
    shieldDeflect() {
      const c = getCtx(); const t = c.currentTime;
      // Hard metallic clang + descending ring
      osc('triangle', 1800, 600, 0.08, t, 0.1);
      osc('sine', 2400, 900, 0.04, t, 0.06);
      noise(0.03, t, 0.03, 4000);
    },
    reflect() {
      const c = getCtx(); const t = c.currentTime;
      // Sharp crystalline ping + ascending shimmer
      osc('sine', 2200, 3200, 0.07, t, 0.08);
      osc('triangle', 3000, 4000, 0.04, t + 0.02, 0.06);
      osc('sine', 1600, 2000, 0.03, t + 0.04, 0.1);
      noise(0.02, t, 0.02, 6000);
    },
    grenadeLob() {
      const c = getCtx(); const t = c.currentTime;
      // Hollow thunk + rising whoosh
      osc('sine', 200, 120, 0.06, t, 0.12);
      osc('triangle', 400, 800, 0.03, t, 0.15);
    },
    grenadeExplode() {
      const c = getCtx(); const t = c.currentTime;
      // Muffled boom + crackle
      osc('sine', 100, 30, 0.12, t, 0.25);
      osc('square', 60, 20, 0.06, t, 0.2);
      noise(0.08, t, 0.15, 2000);
    },
    corePrime() {
      const c = getCtx(); const t = c.currentTime;
      // Rising alarm tick
      osc('square', 1200, 1800, 0.06, t, 0.06);
      osc('sine', 600, 900, 0.04, t + 0.03, 0.04);
    },
    coreDetonate() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.35, 0.5);
      // Heavy explosion: sub thump + crackle + debris
      osc('sine', 60, 22, 0.22, t, 0.35, bus, { attack: 0.002 });
      osc('triangle', 120, 40, 0.10, t, 0.25, bus, { pan: -0.15 });
      noise(0.16, t + 0.01, 0.18, 3200, bus, { filterType: 'bandpass', filterFreq2: 800, q: 0.8 });
      noise(0.06, t + 0.03, 0.08, 6000, bus, { filterType: 'highpass', pan: 0.2 });
      osc('sawtooth', 200, 60, 0.06, t + 0.02, 0.15, bus, { pan: 0.1 });
    },
    crateBreak() {
      const c = getCtx(); const t = c.currentTime;
      // Metallic crunch: short impact + rattling debris
      osc('sine', 150, 40, 0.10, t, 0.15);
      osc('square', 90, 25, 0.06, t, 0.12);
      noise(0.10, t, 0.10, 3000);
      // Debris scatter clinks
      for (let i = 0; i < 3; i++) {
        const d = 0.04 + i * 0.05;
        const f = 600 + Math.random() * 800;
        osc('sine', f, f * 0.3, 0.03, t + d, 0.05);
      }
    },
    sentryFire() {
      const c = getCtx(); const t = c.currentTime;
      // Soft electronic chirp — light and quick
      osc('sine', 1800, 2400, 0.04, t, 0.06, null, { pan: (Math.random() - 0.5) * 0.3 });
      osc('triangle', 900, 1200, 0.025, t, 0.04);
    },
    autoLaser() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.25, 0.2);
      // Sharp high-frequency zap + descending ring
      osc('sine', 3000, 800, 0.08, t, 0.1, bus);
      osc('square', 1500, 400, 0.05, t, 0.08, bus);
      noise(0.04, t, 0.05, 5000, bus);
    },
    loreAccess() {
      const c = getCtx(); const t = c.currentTime;
      // Digital data retrieval chirp — warm amber tones
      osc('sine',     500,  700,  0.07, t, 0.06);
      osc('triangle', 700,  900,  0.05, t + 0.06, 0.06);
      osc('sine',     900,  1100, 0.07, t + 0.12, 0.08);
      noise(0.02, t + 0.04, 0.03, 4000);
    },
    enemySplit() {
      const c = getCtx(); const t = c.currentTime;
      // Digital fracture — rising twin tones + crackle
      osc('square', 300, 600, 0.06, t, 0.1);
      osc('square', 350, 650, 0.06, t + 0.02, 0.1);
      noise(0.05, t, 0.08, 3000);
    },
    summon() {
      const c = getCtx(); const t = c.currentTime;
      // Rising harmonic sweep — eerie portal opening
      osc('sine', 200, 600, 0.07, t, 0.2);
      osc('triangle', 300, 900, 0.04, t + 0.05, 0.18);
      osc('sine', 500, 1200, 0.03, t + 0.1, 0.12);
      noise(0.03, t + 0.08, 0.1, 4000);
    },
    heal() {
      const c = getCtx(); const t = c.currentTime;
      // Soft ascending chime — gentle restoration
      osc('sine', 600, 1200, 0.06, t, 0.15);
      osc('triangle', 900, 1400, 0.04, t + 0.05, 0.12);
      osc('sine', 1200, 1600, 0.03, t + 0.1, 0.1);
    },
    chargerWindup() {
      const c = getCtx(); const t = c.currentTime;
      // Building rumble — rising sub bass + metallic grind
      osc('sawtooth', 60, 180, 0.07, t, 0.25);
      osc('square', 100, 300, 0.04, t + 0.05, 0.2);
      noise(0.04, t + 0.1, 0.15, 1500);
    },
    chargerImpact() {
      const c = getCtx(); const t = c.currentTime;
      // Heavy thud — deep bass hit + metallic crash
      osc('sine', 80, 30, 0.1, t, 0.12);
      osc('square', 120, 40, 0.06, t, 0.08);
      noise(0.08, t, 0.06, 3000);
    },
    leaperWindup() {
      const c = getCtx(); const t = c.currentTime;
      // Spring tension — rising whine + mechanical coil
      osc('sawtooth', 120, 400, 0.06, t, 0.2);
      osc('sine', 200, 800, 0.04, t + 0.05, 0.18);
      noise(0.03, t + 0.1, 0.1, 2000);
    },
    leaperLand() {
      const c = getCtx(); const t = c.currentTime;
      // Heavy impact — deep thud + shockwave whoosh
      osc('sine', 60, 25, 0.12, t, 0.15);
      osc('triangle', 100, 50, 0.07, t, 0.1);
      noise(0.07, t + 0.02, 0.08, 2500);
      // Shockwave ring swoosh
      osc('sine', 300, 80, 0.04, t + 0.05, 0.2);
    },
    beaconAlarm() {
      const c = getCtx(); const t = c.currentTime;
      // Escalating electronic alarm — pulsing siren
      osc('square', 600, 1200, 0.06, t, 0.15);
      osc('square', 800, 1400, 0.04, t + 0.15, 0.15);
      osc('sine', 400, 900, 0.05, t + 0.05, 0.2);
      noise(0.03, t, 0.1, 3000);
    },
    beaconDestroy() {
      const c = getCtx(); const t = c.currentTime;
      // Digital shutdown chirp — descending + static burst
      osc('sine', 1200, 200, 0.08, t, 0.15);
      osc('square', 800, 100, 0.04, t + 0.02, 0.12);
      noise(0.06, t + 0.05, 0.08, 4000);
    },
    beaconTrigger() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.3, 0.3);
      // Alert klaxon — two-tone alarm + rumble
      osc('square', 500, 500, 0.08, t, 0.12, bus);
      osc('square', 700, 700, 0.08, t + 0.12, 0.12, bus);
      osc('square', 500, 500, 0.06, t + 0.24, 0.1, bus);
      osc('sine', 80, 60, 0.06, t, 0.3, bus);
      noise(0.04, t + 0.1, 0.15, 2000, bus);
    },
    mineArm() {
      const c = getCtx(); const t = c.currentTime;
      // Metallic click + ascending warning tone
      noise(0.06, t, 0.03, 8000);
      osc('square', 800, 1400, 0.05, t + 0.03, 0.12);
      osc('sine', 600, 1000, 0.04, t + 0.05, 0.1);
    },
    mineExplode() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.3, 0.25);
      // Sharp concussive blast — low thud + high crack + debris rattle
      osc('sine', 60, 30, 0.12, t, 0.15, bus);
      osc('square', 200, 80, 0.06, t, 0.1, bus);
      noise(0.1, t, 0.08, 4000, bus);
      noise(0.04, t + 0.08, 0.12, 2000, bus);
      osc('triangle', 120, 50, 0.04, t + 0.05, 0.15, bus);
    },
    phantomCloak() {
      const c = getCtx(); const t = c.currentTime;
      // Descending digital fade-out — shimmer dissolve
      osc('sine', 1200, 300, 0.06, t, 0.2);
      osc('triangle', 800, 200, 0.03, t + 0.03, 0.15);
      noise(0.03, t + 0.05, 0.12, 3000);
    },
    phantomUncloak() {
      const c = getCtx(); const t = c.currentTime;
      // Sharp ascending reveal — digital materialise
      osc('sine', 400, 1400, 0.08, t, 0.15);
      osc('square', 600, 1800, 0.04, t + 0.02, 0.12);
      noise(0.05, t, 0.06, 5000);
    },
    phantomStrike() {
      const c = getCtx(); const t = c.currentTime;
      // Quick energy bolt — electric snap
      osc('square', 900, 400, 0.06, t, 0.08);
      osc('sine', 1200, 600, 0.04, t + 0.01, 0.06);
      noise(0.04, t, 0.04, 6000);
    },
    mimicReveal() {
      const c = getCtx(); const t = c.currentTime;
      // Sharp dissonant alarm chirp — trap springing + digital distortion
      osc('square', 200, 1600, 0.10, t, 0.12);
      osc('sawtooth', 600, 2200, 0.06, t + 0.02, 0.10);
      osc('sine', 1400, 400, 0.05, t + 0.08, 0.10);
      noise(0.07, t, 0.08, 7000);
    },
    teleport() {
      const c = getCtx(); const t = c.currentTime;
      // Quick zwip — descending sine + high noise pop
      osc('sine', 1400, 300, 0.07, t, 0.1);
      osc('square', 800, 200, 0.04, t, 0.08);
      noise(0.05, t, 0.04, 6000);
    },
    teleportPad() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.25, 0.2);
      // Ascending digital warp — two-stage sweep + sparkle
      osc('sine', 300, 1600, 0.08, t, 0.18, bus);
      osc('square', 500, 2000, 0.04, t + 0.02, 0.14, bus);
      osc('triangle', 1200, 1800, 0.05, t + 0.1, 0.1, bus);
      noise(0.04, t + 0.05, 0.08, 8000, bus);
    },
    generatorDestroy() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.3, 0.2);
      // Electric overload burst — ascending whine + crack + EMP pulse
      osc('sawtooth', 400, 2400, 0.08, t, 0.15, bus);
      osc('square', 600, 1800, 0.05, t + 0.02, 0.12, bus);
      osc('sine', 80, 40, 0.08, t + 0.05, 0.2, bus);
      noise(0.07, t + 0.08, 0.1, 5000, bus);
      osc('triangle', 1200, 300, 0.04, t + 0.12, 0.15, bus);
    },
    cameraDetect() {
      const c = getCtx(); const t = c.currentTime;
      // Short warning chirp — rising two-tone alert
      osc('square', 800, 1200, 0.06, t, 0.08);
      osc('square', 1200, 1600, 0.05, t + 0.1, 0.08);
    },
    cameraAlert() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.25, 0.15);
      // Alarm siren — descending saw burst + noise crackle
      osc('sawtooth', 1400, 600, 0.07, t, 0.2, bus);
      osc('square', 1000, 400, 0.05, t + 0.05, 0.15, bus);
      noise(0.06, t + 0.1, 0.12, 4000, bus);
      osc('sine', 200, 80, 0.06, t + 0.15, 0.1, bus);
    },
    cameraDestroy() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.2, 0.15);
      // Electronic crunch — short burst + spark
      noise(0.08, t, 0.08, 6000, bus);
      osc('sawtooth', 600, 200, 0.06, t, 0.1, bus);
      osc('sine', 300, 100, 0.05, t + 0.05, 0.08, bus);
    },
    laserHit() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.15, 0.1);
      // Sharp electric zap — high saw burst + crackle
      osc('sawtooth', 1800, 600, 0.08, t, 0.1, bus);
      osc('square', 900, 300, 0.05, t + 0.02, 0.08, bus);
      noise(0.06, t, 0.06, 8000, bus);
    },
    laserDisable() {
      const c = getCtx(); const t = c.currentTime;
      // Power-down whine — descending sine sweep
      osc('sine', 800, 100, 0.06, t, 0.25);
      osc('triangle', 400, 50, 0.04, t + 0.05, 0.2);
    },
    laserDestroy() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.2, 0.15);
      // Sparking collapse — noise burst + descending saw
      noise(0.1, t, 0.1, 7000, bus);
      osc('sawtooth', 700, 150, 0.07, t, 0.12, bus);
      osc('sine', 400, 80, 0.05, t + 0.04, 0.1, bus);
    },
    comboTick(/** @type {number} */ count) {
      const c = getCtx(); const t = c.currentTime;
      // Ascending pitch with combo — quick chirp
      const base = Math.min(1800, 400 + count * 80);
      osc('sine', base, base * 1.3, 0.06, t, 0.06);
      osc('triangle', base * 1.2, base * 1.5, 0.03, t + 0.02, 0.04);
    },
    dash() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.2, 0.15);
      // Quick whoosh — rising noise burst + descending sine sweep
      noise(0.10, t, 0.12, 4000, bus);
      osc('sine', 600, 200, 0.08, t, 0.1, bus);
      osc('triangle', 1200, 400, 0.04, t, 0.08, bus);
    },
    hackwareEMP() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.3, 0.4);
      // Electric discharge burst
      osc('sawtooth', 200, 60, 0.15, t, 0.2, bus);
      osc('square', 1200, 200, 0.1, t, 0.15, bus);
      noise(0.2, t, 0.1, 5000, bus);
      osc('sine', 80, 40, 0.12, t + 0.05, 0.3);
    },
    hackwareCloak() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.5, 0.8);
      // Shimmering phase-out
      osc('sine', 800, 1600, 0.08, t, 0.3, bus);
      osc('triangle', 1200, 2000, 0.05, t + 0.05, 0.25, bus);
      osc('sine', 400, 200, 0.06, t + 0.1, 0.2, bus);
    },
    hackwareSwarm() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.2, 0.3);
      // Buzzing swarm release
      osc('sawtooth', 300, 600, 0.08, t, 0.15, bus);
      osc('sawtooth', 320, 640, 0.06, t + 0.02, 0.12, bus);
      noise(0.08, t, 0.2, 3000, bus);
      osc('sine', 200, 400, 0.05, t + 0.1, 0.15, bus);
    },
    hackwareGravity() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.4, 0.6);
      // Deep gravity implosion
      osc('sine', 300, 40, 0.15, t, 0.4, bus);
      osc('triangle', 600, 100, 0.08, t, 0.3, bus);
      osc('sine', 50, 30, 0.2, t + 0.1, 0.5);
      noise(0.06, t + 0.2, 0.15, 1000, bus);
    },
    hackwareStaticField() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.3, 0.5);
      // Electric crackle deployment
      noise(0.1, t, 0.25, 3000, bus);
      osc('sawtooth', 800, 200, 0.06, t, 0.3, bus);
      osc('square', 1200, 400, 0.04, t + 0.05, 0.2, bus);
      osc('sine', 100, 60, 0.12, t + 0.1, 0.4);
    },
    hackwareCloakEnd() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.3, 0.4);
      // Shimmer back in
      osc('sine', 1600, 600, 0.06, t, 0.2, bus);
      osc('triangle', 1200, 400, 0.04, t + 0.05, 0.15, bus);
    },
    playerBurn() {
      const c = getCtx(); const t = c.currentTime;
      // Fire crackle — short burst of noise + warm sub tone
      noise(0.06, t, 0.12, 3000, null, { filterType: 'bandpass', q: 1.2 });
      osc('sine', 180, 100, 0.05, t, 0.15);
      osc('triangle', 400, 200, 0.03, t + 0.03, 0.08);
    },
    playerShock() {
      const c = getCtx(); const t = c.currentTime;
      // Electric zap — sharp ascending chirp + crackle
      osc('sawtooth', 800, 2400, 0.07, t, 0.06);
      osc('square', 1200, 600, 0.04, t + 0.02, 0.05);
      noise(0.05, t, 0.04, 6000, null, { filterType: 'highpass' });
    },
    voltaicHit() {
      const c = getCtx(); const t = c.currentTime;
      // Stun zap — similar to playerShock but lighter
      osc('sine', 1400, 2000, 0.05, t, 0.05);
      osc('square', 800, 400, 0.03, t + 0.01, 0.04);
      noise(0.03, t, 0.03, 5000);
    },
    bountyReveal() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.3, 0.3);
      // Ominous low brass stab + rising shimmer — "high-value target spotted"
      osc('sawtooth', 120, 80, 0.10, t, 0.35, bus);
      osc('square', 140, 90, 0.06, t + 0.02, 0.3, bus);
      osc('sine', 600, 1400, 0.05, t + 0.15, 0.25, bus);
      osc('triangle', 900, 1800, 0.03, t + 0.2, 0.2, bus);
      noise(0.04, t + 0.1, 0.15, 4000, bus);
    },
    bountyKill() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.25, 0.25);
      // Triumphant chime — ascending golden tones + sparkle
      osc('sine', 523, 523, 0.08, t, 0.12, bus);         // C5
      osc('sine', 659, 659, 0.08, t + 0.08, 0.12, bus);  // E5
      osc('sine', 784, 784, 0.08, t + 0.16, 0.12, bus);  // G5
      osc('sine', 1047, 1047, 0.10, t + 0.24, 0.2, bus); // C6
      osc('triangle', 1047, 1568, 0.04, t + 0.3, 0.15, bus); // shimmer
      noise(0.03, t + 0.25, 0.1, 8000, bus);
    },
    turretFire() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.6, 0.15, 0.15);
      // Short mechanical burst — mid-frequency snap
      osc('square', 200, 100, 0.06, t, 0.06, bus);
      osc('sawtooth', 400, 200, 0.04, t + 0.01, 0.04, bus);
      noise(0.05, t, 0.05, 4000, bus);
    },
    turretHack() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.8, 0.2, 0.2);
      // Rising digital chirp — success sound
      osc('sine', 400, 900, 0.06, t, 0.15, bus);
      osc('square', 600, 1200, 0.03, t + 0.05, 0.1, bus);
      osc('triangle', 800, 1600, 0.04, t + 0.1, 0.12, bus);
      noise(0.02, t + 0.12, 0.08, 6000, bus);
    },
    turretDestroy() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.7, 0.2, 0.2);
      // Metallic crunch + sparks
      osc('sawtooth', 180, 60, 0.08, t, 0.12, bus);
      osc('square', 120, 40, 0.06, t + 0.02, 0.1, bus);
      noise(0.08, t, 0.15, 3000, bus);
      noise(0.04, t + 0.08, 0.1, 8000, bus);
    },
    disruptorDeploy() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.7, 0.2, 0.15);
      // Electronic warble — descending distortion
      osc('sawtooth', 600, 200, 0.06, t, 0.2, bus);
      osc('square', 450, 150, 0.04, t + 0.03, 0.18, bus);
      osc('sine', 300, 100, 0.03, t + 0.06, 0.15, bus);
      noise(0.04, t + 0.05, 0.12, 5000, bus);
    },
    disruptorField() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.5, 0.1, 0.1);
      // Soft static crackle — interference hit
      noise(0.03, t, 0.08, 4000, bus);
      osc('square', 120, 80, 0.02, t, 0.06, bus);
    },
    wraithPhaseOut() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.8, 0.3, 0.2);
      // Ethereal descending whoosh
      osc('sine', 800, 200, 0.05, t, 0.35, bus);
      osc('triangle', 600, 150, 0.03, t + 0.05, 0.3, bus);
      noise(0.025, t + 0.1, 0.25, 3000, bus);
    },
    wraithPhaseIn() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.8, 0.3, 0.2);
      // Ethereal ascending whoosh + materialization crackle
      osc('sine', 200, 800, 0.06, t, 0.3, bus);
      osc('triangle', 150, 600, 0.04, t + 0.05, 0.25, bus);
      noise(0.04, t + 0.15, 0.2, 6000, bus);
      osc('square', 300, 500, 0.02, t + 0.2, 0.1, bus);
    },
    nexusLink() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.6, 0.2, 0.15);
      // Subtle electronic connection buzz
      osc('sine', 600, 800, 0.02, t, 0.08, bus);
      osc('triangle', 900, 1100, 0.015, t + 0.02, 0.06, bus);
    },
    nexusDeath() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.9, 0.4, 0.3);
      // Electromagnetic feedback pulse — descending + crackling
      osc('sawtooth', 1200, 200, 0.08, t, 0.4, bus);
      osc('square', 800, 100, 0.05, t + 0.05, 0.35, bus);
      noise(0.06, t + 0.1, 0.3, 4000, bus);
      osc('sine', 400, 80, 0.04, t + 0.15, 0.25, bus);
    },
    siphonDrain() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.5, 0.3, 0.2);
      // Vampiric draining — descending hollow tone + wet siphon
      osc('sawtooth', 500, 200, 0.04, t, 0.25, bus);
      osc('sine', 300, 120, 0.03, t + 0.05, 0.2, bus);
      noise(0.02, t + 0.08, 0.15, 3000, bus);
    },
    siphonFrenzy() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.7, 0.4, 0.25);
      // Heart-beating bass activation — dual low thuds + rising tension
      osc('sine', 60, 40, 0.08, t, 0.15, bus);
      osc('sine', 60, 40, 0.06, t + 0.2, 0.12, bus);
      osc('sawtooth', 200, 600, 0.04, t + 0.1, 0.3, bus);
      noise(0.03, t + 0.15, 0.2, 2000, bus);
    },
    gravitonDeploy() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.6, 0.3, 0.2);
      // Deep bass whomp — gravity well materialises
      osc('sine', 50, 30, 0.1, t, 0.25, bus);
      osc('sine', 80, 40, 0.06, t + 0.05, 0.2, bus);
      noise(0.03, t + 0.1, 0.15, 1500, bus);
    },
    gravitonPull() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.3, 0.2, 0.15);
      // Low gravitational hum
      osc('sine', 65, 55, 0.04, t, 0.2, bus);
      osc('triangle', 130, 110, 0.02, t + 0.05, 0.15, bus);
    },
    gravitonCollapse() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.5, 0.3, 0.2);
      // Reverse whomp — well collapses inward
      osc('sine', 30, 60, 0.08, t, 0.2, bus);
      osc('triangle', 60, 120, 0.04, t + 0.05, 0.15, bus);
      noise(0.02, t, 0.12, 2000, bus);
    },
    seekerDetonate() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.7, 0.4, 0.25);
      // Sharp crack + bass thump — kamikaze explosion
      noise(0.12, t, 0.15, 6000, bus);
      osc('sine', 80, 30, 0.1, t, 0.2, bus);
      osc('sawtooth', 400, 100, 0.06, t + 0.02, 0.12, bus);
      osc('sine', 50, 25, 0.06, t + 0.1, 0.15, bus);
    },
    logFound() {
      // Data-recovery chime — rising glitch resolving to clean tone.
      const c = getCtx(); const t = c.currentTime;
      noise(0.04, t, 0.08, 2400);
      osc('triangle', 440, 880, 0.05, t + 0.04, 0.18);
      osc('sine', 1320, 1320, 0.03, t + 0.12, 0.22);
    },
    coreCollected() {
      // UNCHAINED #39: short crystalline shimmer — core pickup.
      const c = getCtx(); const t = c.currentTime;
      osc('triangle', 880, 1760, 0.05, t, 0.10);
      osc('sine', 1760, 2640, 0.03, t + 0.03, 0.14);
    },
    logRead() {
      // Terminal-click + soft bloom.
      const c = getCtx(); const t = c.currentTime;
      osc('square', 660, 660, 0.02, t, 0.04);
      osc('sine', 990, 1320, 0.03, t + 0.03, 0.18);
    },
    pulserCharge() {
      const c = getCtx(); const t = c.currentTime;
      // Rising electrical whine — charge-up telegraph
      osc('sawtooth', 200, 600, 0.05, t, 0.5);
      osc('sine', 300, 900, 0.03, t + 0.1, 0.4);
      osc('square', 150, 400, 0.02, t + 0.2, 0.3);
    },
    pulserFire() {
      const c = getCtx(); const t = c.currentTime;
      // Sharp electrical crack — bolt release
      noise(0.08, t, 0.08, 5000);
      osc('sawtooth', 500, 150, 0.07, t, 0.1);
      osc('sine', 200, 80, 0.05, t + 0.02, 0.12);
    },
    eliteVolatile() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.8, 0.4, 0.3);
      // Deep detonation + ascending whistle — elite death explosion
      osc('sine', 60, 25, 0.15, t, 0.3, bus);
      noise(0.15, t, 0.18, 5000, bus);
      osc('sawtooth', 300, 800, 0.08, t + 0.03, 0.15, bus);
      osc('sine', 45, 20, 0.08, t + 0.12, 0.2, bus);
    },
    eliteFrenzy() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.6, 0.3, 0.2);
      // Aggressive snarl + rising pitch — rage activation
      osc('sawtooth', 120, 280, 0.1, t, 0.2, bus);
      osc('square', 200, 500, 0.06, t + 0.05, 0.15, bus);
      noise(0.06, t + 0.02, 0.08, 4000, bus);
    },
    holoDecoyDeploy() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.7, 0.4, 0.3);
      // Holographic shimmer — ascending tri-tone + static crackle
      osc('triangle', 600, 1200, 0.08, t, 0.15, bus);
      osc('sine', 900, 1600, 0.05, t + 0.05, 0.12, bus);
      noise(0.04, t + 0.02, 0.1, 6000, bus);
      osc('sine', 400, 800, 0.06, t + 0.08, 0.15, bus);
    },
    holoDecoyExpire() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.6, 0.3, 0.2);
      // Hologram shatter — descending tone + burst
      osc('triangle', 1200, 300, 0.08, t, 0.2, bus);
      osc('square', 800, 200, 0.05, t + 0.03, 0.15, bus);
      noise(0.08, t, 0.12, 5000, bus);
    },
    upgradePurchased() {
      // UNCHAINED #36 — UPGRADE MATRIX node purchase confirmation
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(0.7, 0.35, 0.4);
      // Bright ascending arpeggio + warm sub thump
      osc('triangle', 520, 780, 0.07, t, 0.10, bus, { attack:0.002 });
      osc('triangle', 780, 1170, 0.06, t + 0.06, 0.12, bus, { attack:0.002 });
      osc('sine',     1170, 1560, 0.05, t + 0.13, 0.14, bus, { attack:0.002 });
      osc('sine',     90, 60, 0.07, t, 0.18, bus);
      noise(0.025, t, 0.05, 6000, bus, { filterType:'highpass' });
    },
    // UNCHAINED #35 — ambient bed for THE GAP hub. Stub: a slow low drone
    // pair + airy shimmer. Real layered track lands in a later audio pass.
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

// ─── Page Lifecycle & Mobile Resilience ──────────────────────────────────────
// Auto-pause when the browser hides the tab (iOS lock, tab switch, phone call)
// and resume audio context when returning. Prevents the iOS freeze where an
// interrupted AudioContext kills the rAF chain and the drone oscillator drones.
let _autoPaused = false;
let _preVisibilityState = null;

// States that represent active gameplay and should auto-pause
const _PAUSABLE_STATES = new Set(['PLAYING']);

function _onVisibilityHidden() {
  // Suspend AudioContext so iOS doesn't leave it in 'interrupted' limbo
  if (audio.isRunning()) {
    try { audio.resume(); } catch (_) {} // no-op in 'running', but this accesses getCtx()
  }
  // Only auto-pause gameplay states — menus/game-over/etc. are fine
  if (typeof game !== 'undefined' && _PAUSABLE_STATES.has(_G.state)) {
    _preVisibilityState = _G.state;
    _autoPaused = true;
    _G.setState('PAUSED');
  }
}

function _onVisibilityVisible() {
  // Attempt to resume AudioContext (may fail without gesture on iOS — that's OK,
  // the next touchstart/mousedown will retry via audio.resume())
  audio.resume();
  // Restore game state if we auto-paused it
  if (_autoPaused && typeof game !== 'undefined') {
    _autoPaused = false;
    // Don't force-resume — leave player in PAUSED so they can orient themselves.
    // The audio context is ready; they just press Escape to unpause.
    _preVisibilityState = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) _onVisibilityHidden();
  else _onVisibilityVisible();
});
// Safari backup: pageshow fires on bfcache restore where visibilitychange may not
window.addEventListener('pageshow', (e) => {
  if (e.persisted) _onVisibilityVisible();
});

// visualViewport resize — catches mobile address bar show/hide that window.resize misses
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    resize();
    if (typeof updateBtns === 'function') updateBtns();
    if (typeof resetTouch === 'function') resetTouch();
  });
}
