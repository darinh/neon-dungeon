'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────
let W = 900, H = 600;
let gameScale = 1;
const TILE = 20;
const MAP_W = 80, MAP_H = 50;
const TWO_PI = Math.PI * 2;
const SAVE_VERSION = '9.0';

const T = { VOID:0, WALL:1, FLOOR:2, STAIRS:3, TERMINAL:4, DOOR:5, DOOR_OPEN:6, LOCKED_R:7, LOCKED_B:8, LOCKED_G:9, TRAP_SPIKE:10, TRAP_SLOW:11, PLASMA:12, ARC:13, VENDOR:14, CRACKED:15, LORE:16, CHALLENGE_GATE:17, IMPLANT_SHRINE:18, EVENT_TERMINAL:19 };

// ─── Settings ────────────────────────────────────────────────────────────────
const DEFAULT_KEY_MAP = {
  up:'KeyW', down:'KeyS', left:'KeyA', right:'KeyD',
  interact:'KeyE', hackware:'KeyF', voidshard:'KeyV',
  dash:'ShiftLeft', shoot:'Space'
};
const ACTION_LABELS = {
  up:'Move Up', down:'Move Down', left:'Move Left', right:'Move Right',
  interact:'Interact', hackware:'Hackware', voidshard:'Void Shard',
  dash:'Dash', shoot:'Shoot'
};
const RESERVED_KEYS = new Set(['Escape','Enter','KeyQ','Digit1','Digit2','Digit3','Tab']);
const KEY_DISPLAY = k => {
  if (!k) return '???';
  if (k.startsWith('Key')) return k.slice(3);
  if (k.startsWith('Digit')) return k.slice(5);
  if (k.startsWith('Arrow')) return '↑↓←→'[['Up','Down','Left','Right'].indexOf(k.slice(5))] || k.slice(5);
  const map = {ShiftLeft:'L-Shift',ShiftRight:'R-Shift',Space:'Space',
    ControlLeft:'L-Ctrl',ControlRight:'R-Ctrl',AltLeft:'L-Alt',AltRight:'R-Alt',
    Tab:'Tab',Backspace:'Bksp',CapsLock:'Caps',Backquote:'`',
    Minus:'-',Equal:'=',BracketLeft:'[',BracketRight:']',
    Backslash:'\\',Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/'};
  return map[k] || k;
};

const settings = {
  sfxVol: 1.0,
  musicVol: 1.0,
  screenShake: true,
  damageNumbers: true,
  keyMap: { ...DEFAULT_KEY_MAP },
  load() {
    try {
      const raw = JSON.parse(localStorage.getItem('neonDungeonSettings'));
      if (!raw) return;
      if (typeof raw.sfxVol === 'number') this.sfxVol = Math.max(0, Math.min(1, raw.sfxVol));
      if (typeof raw.musicVol === 'number') this.musicVol = Math.max(0, Math.min(1, raw.musicVol));
      if (typeof raw.screenShake === 'boolean') this.screenShake = raw.screenShake;
      if (typeof raw.damageNumbers === 'boolean') this.damageNumbers = raw.damageNumbers;
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
        keyMap: this.keyMap
      }));
    } catch(e) {}
  },
  resetAll() {
    this.sfxVol = 1.0; this.musicVol = 1.0;
    this.screenShake = true; this.damageNumbers = true;
    this.keyMap = { ...DEFAULT_KEY_MAP }; this.save();
  }
};
settings.load();

// Key-map lookup: km('interact') returns the current key code for that action
function km(action) { return settings.keyMap[action]; }
// Alternate keys that always work alongside the mapped key
const ALT_KEYS = { up:'ArrowUp', down:'ArrowDown', left:'ArrowLeft', right:'ArrowRight', dash:'ShiftRight' };

// ─── Canvas Setup ────────────────────────────────────────────────────────────
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
canvas.width = W; canvas.height = H;

// Safe-area insets (logical px) for notched devices
let safeTop = 0, safeRight = 0, safeBottom = 0, safeLeft = 0;

let scale = 1, offX = 0, offY = 0;
function resize() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Scale: smaller viewport dimension maps to ~600 logical px
  // Tiles (20 logical px) appear as 20 × gameScale CSS px on screen
  // Clamped so tiles stay between ~14 CSS px (0.7) and ~30 CSS px (1.5)
  gameScale = clamp(Math.min(vw, vh) / 600, 0.7, 1.5);
  W = Math.round(vw / gameScale);
  H = Math.round(vh / gameScale);
  canvas.width = W;
  canvas.height = H;
  scale = gameScale;
  offX = 0;
  offY = 0;
  // Read safe-area insets from CSS env() and convert to logical px
  const cs = getComputedStyle(document.documentElement);
  safeTop    = (parseFloat(cs.getPropertyValue('--sat')) || 0) / gameScale;
  safeRight  = (parseFloat(cs.getPropertyValue('--sar')) || 0) / gameScale;
  safeBottom = (parseFloat(cs.getPropertyValue('--sab')) || 0) / gameScale;
  safeLeft   = (parseFloat(cs.getPropertyValue('--sal')) || 0) / gameScale;
  updateLayout();
  console.log(`[NEON DUNGEON] ${vw}×${vh} → ${W}×${H} (×${gameScale.toFixed(2)}) tile=${(TILE*gameScale).toFixed(1)}css-px compact=${layout.compact}`);
}
// resize() + event listener registered in Boot section (after all defs are ready)

// ─── Layout (shared HUD / bottom-UI metrics) ────────────────────────────────
const layout = { compact: false, hudH: 40, hudTop: 0, msgBase: 0 };
function updateLayout() {
  layout.compact = H > W && W <= 600;
  layout.hudH    = layout.compact ? 58 : 40;
  layout.hudTop  = H - layout.hudH - safeBottom;
  layout.msgBase = layout.hudTop - 12;
}

// ─── Fullscreen (landscape auto-request, portrait auto-exit) ─────────────────
const fsApi = {
  request: canvas.requestFullscreen ? 'requestFullscreen'
         : canvas.webkitRequestFullscreen ? 'webkitRequestFullscreen' : null,
  exit: document.exitFullscreen ? 'exitFullscreen'
      : document.webkitExitFullscreen ? 'webkitExitFullscreen' : null,
  element: () => document.fullscreenElement ?? document.webkitFullscreenElement,
  supported: !!(canvas.requestFullscreen || canvas.webkitRequestFullscreen),
};
let fsWantLandscape = false;   // true when landscape but no gesture yet
let fsDismissed = false;       // user tapped X to dismiss the prompt this session

function isLandscape() {
  if (screen.orientation) return screen.orientation.type.startsWith('landscape');
  return window.innerWidth > window.innerHeight;
}

function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function tryFullscreen() {
  if (!fsApi.supported || fsApi.element()) return;
  try {
    const ret = document.documentElement[fsApi.request]?.();
    if (ret && typeof ret.catch === 'function') ret.catch(() => {});
  } catch (_) {}
}

function exitFullscreen() {
  if (!fsApi.element()) return;
  try {
    const ret = document[fsApi.exit]?.();
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
const keys = new Set();
const mouse = { x: W/2, y: H/2, down: false };
let justPressed = new Set();
let justReleased = new Set();
let lastKey = '';
let nameEntryTap = null;

window.addEventListener('keydown', e => {
  if (!keys.has(e.code)) justPressed.add(e.code);
  keys.add(e.code);
  lastKey = e.key;
  e.preventDefault();
});
window.addEventListener('keyup', e => {
  keys.delete(e.code);
  justReleased.add(e.code);
});
canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * canvas.width / r.width;
  mouse.y = (e.clientY - r.top)  * canvas.height / r.height;
});
canvas.addEventListener('mousedown', e => { mouse.down = true; justPressed.add('MouseLeft'); audio.resume(); });
canvas.addEventListener('mouseup',   e => { mouse.down = false; });
window.addEventListener('mouseup',   e => { mouse.down = false; });

// ─── Touch Controls ──────────────────────────────────────────────────────────
const JR = 55; // joystick base radius
const touch = {
  joystick: { active:false, id:null, baseX:0, baseY:0, dx:0, dy:0 },
  aim:      { active:false, id:null, baseX:0, baseY:0, dx:0, dy:0, shooting:false },
  // button touch IDs
  btnE: null, btnV: null, btnF: null, btnDash: null, btnPause: null,
};

// Button definitions — positions updated dynamically by updateBtns()
const BTNS = {
  E:     { x:0, y:0, r:30, label:'E',  colour:'#00f5ff' },
  F:     { x:0, y:0, r:28, label:'F',  colour:'#ff8800', hidden:true },
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
  // Show F button only when player has hackware equipped
  BTNS.F.hidden = !(game.player && game.player.hackware);
  // Position from edges, respecting safe-area insets
  const pr = Math.max(10, safeRight);
  const pb = Math.max(10, safeBottom);
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

function toCanvas(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return [(clientX - r.left) * canvas.width / r.width,
          (clientY - r.top)  * canvas.height / r.height];
}

function hitBtn(cx, cy, btn) {
  const dx=cx-btn.x, dy=cy-btn.y;
  // Expand hit area on small screens to meet minimum touch target
  const hitR = Math.max(btn.r, 22 / gameScale);
  return dx*dx+dy*dy <= hitR*hitR;
}

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  audio.resume();
  // check if any touch hit the fullscreen dismiss button first
  let dismissed = false;
  for (const t of e.changedTouches) {
    const [cx, cy] = toCanvas(t.clientX, t.clientY);
    if (fsWantLandscape && !fsApi.element() && !fsDismissed
        && cx < 48 && cy < 48) {
      fsDismissed = true; dismissed = true;
    }
  }
  // piggyback on user gesture: request fullscreen if landscape wants it
  if (!dismissed && fsWantLandscape && !fsApi.element() && !fsDismissed) tryFullscreen();
  for (const t of e.changedTouches) {
    const [cx, cy] = toCanvas(t.clientX, t.clientY);
    // skip the dismiss touch (already handled above)
    if (cx < 48 && cy < 48 && dismissed) continue;
    // In non-playing states, any touch acts as confirm (except NAME_ENTRY, POWERUP_CHOICE)
    if (game.state !== 'PLAYING' && game.state !== 'FADE') {
      if (game.state === 'NAME_ENTRY') { nameEntryTap=[cx,cy]; continue; }
      if (game.state === 'POWERUP_CHOICE' || game.state === 'SHOPPING' || game.state === 'PERK_CHOICE' || game.state === 'AUGMENT_CHOICE' || game.state === 'EVENT_CHOICE') {
        // Route touch position via mouse so update handler handles it
        mouse.x = cx; mouse.y = cy;
        justPressed.add('MouseLeft');
        continue;
      }
      if (game.state === 'SETTINGS') {
        mouse.x = cx; mouse.y = cy;
        justPressed.add('MouseLeft');
        continue;
      }
      if (game.state === 'PAUSED') {
        // 3 zones: top third = resume, middle third = settings, bottom third = quit
        if (cy < H * 0.38) justPressed.add('Escape');
        else if (cy < H * 0.62) justPressed.add('KeyS');
        else justPressed.add('KeyQ');
      }
      else if (game.state === 'MENU') {
        // Hit-test against actual menu item positions
        const narrow = layout.compact;
        const titleFs = narrow ? 48 : 72;
        const ty1 = narrow ? 120 : 160;
        const startY = ty1 + titleFs * 0.95 + 80;
        const gap = narrow ? 24 : 28;
        const opts = game.getMenuOptions();
        // Find closest option
        let best = 0, bestDist = Infinity;
        for (let i = 0; i < opts.length; i++) {
          const oy = startY + i * gap;
          const d = Math.abs(cy - oy);
          if (d < bestDist) { bestDist = d; best = i; }
        }
        game.menuSel = best;
        // On the difficulty row, left/right edge taps cycle, center taps start
        if (opts[best]?.isDiffRow && Math.abs(cy - (startY + best * gap)) < gap * 0.7) {
          if (cx < W * 0.35) justPressed.add('ArrowLeft');
          else if (cx > W * 0.65) justPressed.add('ArrowRight');
          else justPressed.add('Enter');
        } else {
          justPressed.add('Enter');
        }
      }
      else if (game.state === 'ARCHIVES') {
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
          game.archivesSel = best;
          justPressed.add('Enter');
        }
      }
      else { justPressed.add('Enter'); justPressed.add('MouseLeft'); }
      continue;
    }
    // button priority
    // Expanded map: any tap closes (modal — takes priority)
    if (game.mapExpanded) { justPressed.add('Tab'); continue; }
    if (hitBtn(cx,cy,BTNS.E))     { touch.btnE=t.identifier; justPressed.add(km('interact')); continue; }
    if (!BTNS.F.hidden && hitBtn(cx,cy,BTNS.F)) { touch.btnF=t.identifier; justPressed.add(km('hackware')); continue; }
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
  for (const t of e.changedTouches) {
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
  for (const t of e.changedTouches) {
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
  touch.joystick.active=false; touch.joystick.id=null; touch.joystick.dx=0; touch.joystick.dy=0;
  touch.aim.active=false; touch.aim.id=null; touch.aim.dx=0; touch.aim.dy=0; touch.aim.shooting=false;
  touch.btnE=null; touch.btnF=null; touch.btnV=null; touch.btnDash=null; touch.btnPause=null;
  mouse.down=false;
}

function drawTouchUI() {
  // Update F button visibility per-frame (player may equip hackware mid-run)
  BTNS.F.hidden = !(game.player && game.player.hackware);
  // Left joystick (move)
  if (touch.joystick.active) {
    const {baseX:bx,baseY:by,dx,dy}=touch.joystick;
    ctx.save();
    ctx.globalAlpha=0.35;
    ctx.strokeStyle='#00f5ff'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(bx,by,JR,0,TWO_PI); ctx.stroke();
    ctx.fillStyle='#00f5ff';
    ctx.beginPath(); ctx.arc(bx+dx*JR,by+dy*JR,18,0,TWO_PI); ctx.fill();
    ctx.restore();
  } else {
    // ghost move joystick hint
    const hintY = layout.hudTop - 26;
    ctx.save(); ctx.globalAlpha=0.12;
    ctx.strokeStyle='#00f5ff'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(80, hintY, JR, 0, TWO_PI); ctx.stroke();
    ctx.fillStyle='#00f5ff';
    ctx.beginPath(); ctx.arc(80, hintY, 18, 0, TWO_PI); ctx.fill();
    ctx.restore();
  }
  // Right joystick (aim)
  if (touch.aim.active) {
    const {baseX:bx,baseY:by,dx,dy}=touch.aim;
    ctx.save();
    ctx.globalAlpha=0.35;
    ctx.strokeStyle='#ff00c8'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(bx,by,JR,0,TWO_PI); ctx.stroke();
    ctx.fillStyle='#ff00c8';
    ctx.beginPath(); ctx.arc(bx+dx*JR,by+dy*JR,18,0,TWO_PI); ctx.fill();
    ctx.restore();
  } else {
    // ghost aim joystick hint
    const hintY = layout.hudTop - 26;
    ctx.save(); ctx.globalAlpha=0.12;
    ctx.strokeStyle='#ff00c8'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(W/2+80, hintY, JR, 0, TWO_PI); ctx.stroke();
    ctx.fillStyle='#ff00c8';
    ctx.beginPath(); ctx.arc(W/2+80, hintY, 18, 0, TWO_PI); ctx.fill();
    ctx.restore();
  }
  // Buttons
  for (const [key,btn] of Object.entries(BTNS)) {
    if (btn.hidden) continue;
    const active = (key==='E'&&touch.btnE!==null)||(key==='F'&&touch.btnF!==null)||(key==='V'&&touch.btnV!==null)||(key==='DASH'&&touch.btnDash!==null)||(key==='PAUSE'&&touch.btnPause!==null);
    ctx.save();
    // Show cooldown overlay on dash button
    if (key==='DASH' && game.player && game.player.dashCooldown > 0) {
      ctx.globalAlpha = 0.25;
    } else if (key==='F' && game.player && game.player.hackwareCooldown > 0) {
      ctx.globalAlpha = 0.25;
    } else {
      ctx.globalAlpha = active ? 0.9 : 0.45;
    }
    ctx.shadowBlur=10; ctx.shadowColor=btn.colour;
    ctx.strokeStyle=btn.colour; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(btn.x,btn.y,btn.r,0,TWO_PI); ctx.stroke();
    ctx.fillStyle=btn.colour+'33';
    ctx.beginPath(); ctx.arc(btn.x,btn.y,btn.r,0,TWO_PI); ctx.fill();
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
    ctx.beginPath();
    ctx.rect(px, py, pw, ph);
    ctx.fill(); ctx.stroke();
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

function jp(code) { return justPressed.has(code); }
function clearJust() { justPressed.clear(); justReleased.clear(); lastKey=''; nameEntryTap=null; }

// ─── Utilities ───────────────────────────────────────────────────────────────
function rnd(min, max) { return min + Math.random() * (max - min); }
function rndInt(min, max) { return Math.floor(rnd(min, max + 1)); }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function dist(ax, ay, bx, by) { const dx=ax-bx, dy=ay-by; return Math.sqrt(dx*dx+dy*dy); }
function dist2(ax, ay, bx, by) { const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; }
function norm(dx, dy) { const l=Math.sqrt(dx*dx+dy*dy)||1; return [dx/l, dy/l]; }
function lerp(a, b, t) { return a + (b-a)*t; }
function clampToBossRoom(entity) {
  if (!game.bossSealed || !game.bossRoom) return;
  const r = game.bossRoom;
  entity.x = Math.max(r.x + 0.5, Math.min(r.x + r.w - 0.5, entity.x));
  entity.y = Math.max(r.y + 0.5, Math.min(r.y + r.h - 0.5, entity.y));
}

function hasLOS(x1, y1, x2, y2, map) {
  let cx = Math.floor(x1), cy = Math.floor(y1);
  const ex = Math.floor(x2), ey = Math.floor(y2);
  let dx = Math.abs(ex-cx), dy = Math.abs(ey-cy);
  let sx = cx<ex?1:-1, sy = cy<ey?1:-1;
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

// Tile helpers
function isPassable(t) { return t===T.FLOOR||t===T.STAIRS||t===T.TERMINAL||t===T.DOOR_OPEN||t===T.TRAP_SPIKE||t===T.TRAP_SLOW||t===T.PLASMA||t===T.ARC||t===T.VENDOR||t===T.LORE||t===T.CHALLENGE_GATE||t===T.IMPLANT_SHRINE||t===T.EVENT_TERMINAL; }
function isSeeThrough(t) {
  return t!==T.WALL && t!==T.VOID && t!==T.CRACKED && t!==T.DOOR && t!==T.LOCKED_R && t!==T.LOCKED_B && t!==T.LOCKED_G;
}
function isDoor(t) { return t===T.DOOR||t===T.LOCKED_R||t===T.LOCKED_B||t===T.LOCKED_G; }
function doorKeyColour(t) { return t===T.LOCKED_R?'red':t===T.LOCKED_B?'blue':t===T.LOCKED_G?'gold':null; }

// ─── Audio Engine ────────────────────────────────────────────────────────────
const audio = (() => {
  let actx = null, master = null, compressor = null, reverbNode = null,
      reverbGain = null, noiseBuf = null, musicBus = null;

  function getCtx() {
    if (!actx) {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      // Master bus: compressor → destination
      compressor = actx.createDynamicsCompressor();
      compressor.threshold.value = -12;
      compressor.ratio.value = 4;
      compressor.connect(actx.destination);
      master = actx.createGain();
      master.gain.value = 0.7 * settings.sfxVol;
      master.connect(compressor);
      // Reverb bus: ConvolverNode with procedural impulse response
      reverbNode = actx.createConvolver();
      const irLen = actx.sampleRate * 1.6;
      const irBuf = actx.createBuffer(2, irLen, actx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = irBuf.getChannelData(ch);
        for (let i = 0; i < irLen; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.5);
        }
      }
      reverbNode.buffer = irBuf;
      reverbGain = actx.createGain();
      reverbGain.gain.value = 0.35;
      reverbNode.connect(reverbGain);
      reverbGain.connect(master);
      // Cached noise buffer (2 seconds, reused by all noise calls)
      const nLen = actx.sampleRate * 2;
      noiseBuf = actx.createBuffer(1, nLen, actx.sampleRate);
      const nd = noiseBuf.getChannelData(0);
      for (let i = 0; i < nLen; i++) nd[i] = Math.random() * 2 - 1;
    }
    return actx;
  }

  function resume() { const c = getCtx(); if (c.state === 'suspended') c.resume(); }

  // Core voice: oscillator → gain → target node
  function osc(type, freq1, freq2, vol, start, dur, target) {
    const c = getCtx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq1, start);
    if (freq2 !== freq1) o.frequency.exponentialRampToValueAtTime(Math.max(freq2, 1), start + dur);
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    o.connect(g); g.connect(target || master);
    o.start(start); o.stop(start + dur + 0.02);
  }

  // Noise burst from cached buffer
  function noise(vol, start, dur, filterFreq, target) {
    const c = getCtx();
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const flt = c.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = filterFreq || 800;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    src.connect(flt); flt.connect(g); g.connect(target || master);
    src.start(start); src.stop(start + dur + 0.02);
  }

  // Reverb send helper — routes signal to both dry and wet buses
  // lifetime: seconds until all voices through this bus have finished (excludes reverb tail)
  function wetDry(vol, wetAmt, lifetime) {
    const c = getCtx();
    const split = c.createGain();
    split.gain.value = vol;
    const dry = c.createGain();
    dry.gain.value = 1;
    const wet = c.createGain();
    wet.gain.value = wetAmt;
    split.connect(dry); dry.connect(master);
    split.connect(wet); wet.connect(reverbNode);
    // Schedule cleanup after voices + reverb tail finish
    const cleanup = () => { split.disconnect(); dry.disconnect(); wet.disconnect(); };
    setTimeout(cleanup, (lifetime + 2.0) * 1000);
    return split;
  }

  return {
    resume,
    setSfxVolume(v) {
      settings.sfxVol = v;
      if (master) { const t = actx.currentTime; master.gain.cancelScheduledValues(t); master.gain.linearRampToValueAtTime(0.7 * v, t + 0.02); }
    },
    setMusicVolume(v) {
      settings.musicVol = v;
      if (musicBus) { const t = actx.currentTime; musicBus.gain.cancelScheduledValues(t); musicBus.gain.linearRampToValueAtTime(0.12 * v, t + 0.02); }
    },
    getMusicBus() {
      const c = getCtx();
      if (!musicBus) {
        const mc = c.createDynamicsCompressor();
        mc.threshold.value = -18; mc.ratio.value = 2; mc.attack.value = 0.05;
        mc.connect(c.destination);
        musicBus = c.createGain();
        musicBus.gain.value = 0.12 * settings.musicVol;
        musicBus.connect(mc);
      }
      return { bus: musicBus, ctx: c };
    },
    shoot(isPlayer, weapon) {
      const c = getCtx(); const t = c.currentTime;
      if (!isPlayer) {
        osc('sawtooth', 300, 200, 0.07, t, 0.08);
        osc('square',   150, 100, 0.04, t, 0.06);
        return;
      }
      const n = weapon && weapon.name;
      if (n === 'Scatter Gun') {
        // Shotgun blast: base thump + per-pellet cracks with randomised pitch
        noise(0.18, t, 0.07, 2500);
        osc('sine', 100, 50, 0.08, t, 0.05);
        for (let i = 0; i < 4; i++) {
          const dt = i * 0.008 + Math.random() * 0.006;
          const p = 0.85 + Math.random() * 0.3;
          noise(0.08, t + dt, 0.04, 600 + Math.random() * 1200);
          osc('square', 220 * p, 110 * p, 0.06, t + dt, 0.05);
        }
      } else if (n === 'Railgun') {
        // Charge whine + sharp crack + lingering ring
        const bus = wetDry(1, 0.3, 0.35);
        osc('sine',     3200, 6400, 0.06, t, 0.08, bus);
        osc('sawtooth', 1600, 4800, 0.04, t, 0.06, bus);
        noise(0.12, t + 0.06, 0.04, 8000, bus);
        osc('sine',     2400, 800,  0.10, t + 0.06, 0.25, bus);
      } else if (n === 'Plasma Sword') {
        // Energized melee whoosh: fast sweep + harmonics
        osc('sawtooth', 600, 150,  0.12, t, 0.10);
        osc('triangle', 1200, 300, 0.06, t, 0.08);
        noise(0.06, t, 0.04, 3000);
      } else if (n === 'Void Cannon') {
        // Deep resonant thump + sub pulse + distortion edge
        const bus = wetDry(1, 0.25, 0.3);
        osc('sine',     80,  35, 0.18, t, 0.25, bus);
        osc('sawtooth', 160, 60, 0.08, t, 0.18, bus);
        osc('square',   320, 80, 0.05, t, 0.12, bus);
        noise(0.06, t, 0.06, 500, bus);
      } else {
        // Pulse Pistol (default): sine chirp + triangle harmonic + noise click
        osc('sine',    880, 440,  0.15, t, 0.09);
        osc('triangle',1760, 880, 0.06, t, 0.06);
        noise(0.08, t, 0.03, 4000);
      }
    },
    hit(isPlayer, weaponName) {
      const c = getCtx(); const t = c.currentTime;
      if (isPlayer) {
        // Impact: noise burst + low sine thump + sub-bass
        noise(0.3, t, 0.12, 250);
        osc('sine',    80, 30, 0.25, t, 0.15);
        osc('triangle',40, 20, 0.12, t, 0.1);
      } else {
        const n = weaponName;
        if (n === 'Scatter Gun') {
          // Quick plink: bright but short
          osc('sine',    800, 300, 0.08, t, 0.04);
          noise(0.05, t, 0.02, 3000);
        } else if (n === 'Railgun') {
          // Metallic crack + lingering ring
          const bus = wetDry(1, 0.2, 0.2);
          noise(0.10, t, 0.03, 6000, bus);
          osc('sine', 1800, 600, 0.08, t, 0.15, bus);
        } else if (n === 'Plasma Sword') {
          // Electric sizzle
          osc('sawtooth', 900, 200, 0.10, t, 0.07);
          noise(0.06, t, 0.03, 4000);
        } else if (n === 'Void Cannon') {
          // Deep resonant thud
          const bus = wetDry(1, 0.15, 0.15);
          osc('sine', 120, 40, 0.12, t, 0.12, bus);
          noise(0.08, t, 0.06, 400, bus);
        } else {
          // Pulse Pistol / default: bright transient ping + body
          osc('sine',    600, 200, 0.12, t, 0.06);
          osc('triangle',1200,400, 0.05, t, 0.04);
        }
      }
    },
    death() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.4, 0.4);
      osc('sawtooth', 400, 60, 0.18, t, 0.4, bus);
      osc('square',   200, 30, 0.1,  t, 0.35, bus);
      noise(0.15, t + 0.05, 0.2, 600, bus);
      osc('sine',     60,  25, 0.15, t, 0.3);
    },
    levelUp() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.5, 0.5);
      [523, 659, 784, 1047].forEach((f, i) => {
        const s = t + i * 0.1;
        osc('sine',     f,     f,     0.2,  s, 0.2, bus);
        osc('triangle', f*1.003,f*1.003,0.08,s, 0.18, bus);
        osc('triangle', f*0.997,f*0.997,0.08,s, 0.18, bus);
      });
    },
    pickup() {
      const c = getCtx(); const t = c.currentTime;
      // Quick ascending sparkle
      osc('sine',     400, 1200, 0.15, t, 0.12);
      osc('triangle', 800, 2400, 0.06, t, 0.1);
    },
    bossEnter() {
      const c = getCtx(); const t = c.currentTime;
      const bus = wetDry(1, 0.7, 2.0);
      osc('sawtooth', 55,   55,   0.3,  t, 2.0, bus);
      osc('sawtooth', 57,   57,   0.25, t, 2.0, bus);
      // Octave harmonic swell
      osc('sawtooth', 110,  110,  0.12, t + 0.4, 1.5, bus);
      // Filtered noise rumble
      noise(0.2, t, 1.8, 200, bus);
      // Sub-bass pulse
      osc('sine',     27.5, 27.5, 0.2,  t + 0.2, 1.6);
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
      const bus = wetDry(1, 0.45, 0.8);
      // Rising alarm sweep
      osc('sawtooth', 200, 1200, 0.12, t, 0.25, bus);
      osc('sawtooth', 205, 1210, 0.10, t, 0.25, bus);
      // Sub pulse
      osc('sine', 55, 40, 0.15, t + 0.05, 0.3);
      // Metallic ring
      osc('sine', 1800, 900, 0.08, t + 0.15, 0.5, bus);
      osc('triangle', 2400, 1200, 0.04, t + 0.15, 0.4, bus);
      // Noise burst
      noise(0.10, t + 0.1, 0.12, 3000, bus);
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
      osc('sine', 60, 40, 0.12, t, 0.12);
      osc('sine', 60, 40, 0.10, t + 0.18, 0.10);
      noise(0.03, t, 0.06, 200);
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
      nSrc.buffer = noiseBuf;
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
    teleport() {
      const c = getCtx(); const t = c.currentTime;
      // Quick zwip — descending sine + high noise pop
      osc('sine', 1400, 300, 0.07, t, 0.1);
      osc('square', 800, 200, 0.04, t, 0.08);
      noise(0.05, t, 0.04, 6000);
    },
    comboTick(count) {
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
    }
  };
})();

