// @ts-check
'use strict';

// Headless NEON DUNGEON oracle.
//
// Runs the real browser scripts, in index.html order, inside a Node vm context
// whose canvas, audio, storage, clock, timers and input are scripted. Everything
// a player can observe (canvas draw calls, audio calls, stored data) folds into
// per-checkpoint digests. A behavior-preserving change must reproduce
// tests/golden/journeys.json exactly. Usage: node tests/_game-sim.js help

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const GOLDEN_FILE = path.join(__dirname, 'golden', 'journeys.json');
const FRAME_MS = 1000 / 60;
const EPOCH_MS = 1790000000000;
/** What the sandbox's version.json reports. */
const SIM_VERSION = '0.0.0-sim';

class Digest {
  constructor() {
    this.a = 0x811c9dc5;
    this.b = 0x9747b28c;
    this.count = 0;
  }

  /** @param {string} s */
  add(s) {
    let a = this.a;
    let b = this.b;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      a = Math.imul(a ^ c, 0x01000193);
      b = Math.imul(b ^ c, 0x5bd1e995);
      b ^= b >>> 15;
    }
    this.a = Math.imul(a ^ 0x0a, 0x01000193);
    this.b = Math.imul(b ^ 0x0a, 0x5bd1e995);
    this.count++;
  }

  hex() {
    return (this.a >>> 0).toString(16).padStart(8, '0') + (this.b >>> 0).toString(16).padStart(8, '0');
  }
}

/** @param {string} s */
function digestOf(s) {
  const d = new Digest();
  d.add(s);
  return d.hex();
}

/** One observable channel: a digest per step, plus raw entries when diffing. */
class Stream {
  /** @param {boolean} keep */
  constructor(keep) {
    this.keep = keep;
    this.digest = new Digest();
    /** @type {string[]} */
    this.entries = [];
  }

  /** @param {string} entry */
  push(entry) {
    this.digest.add(entry);
    if (this.keep) this.entries.push(entry);
  }

  take() {
    const out = { digest: this.digest.hex(), count: this.digest.count, entries: this.entries };
    this.digest = new Digest();
    this.entries = [];
    return out;
  }
}

/**
 * Canonical text for a recorded value. Numbers are rounded to 1e-3 so a
 * reassociated float sum does not count as a visible change.
 * @param {unknown} v
 * @returns {string}
 */
function fmt(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? String(Math.round(v * 1000) / 1000) : String(v);
  if (typeof v === 'string') return JSON.stringify(v);
  if (v === null || v === undefined || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return '[' + v.map(fmt).join(',') + ']';
  if (typeof v === 'function') return 'fn';
  const tag = /** @type {any} */ (v).__simTag;
  return tag === undefined ? 'obj' : String(tag);
}

/** @param {unknown[]} args */
const fmtArgs = (args) => args.map(fmt).join(',');

/** @param {number} width @param {number} height */
const rect = (width, height) => ({ x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height });

const CONTEXT_DEFAULTS = Object.freeze({
  direction: 'ltr', fillStyle: '#000000', filter: 'none', font: '10px sans-serif',
  fontKerning: 'auto', globalAlpha: 1, globalCompositeOperation: 'source-over',
  imageSmoothingEnabled: true, imageSmoothingQuality: 'low', letterSpacing: '0px',
  lineCap: 'butt', lineDashOffset: 0, lineJoin: 'miter', lineWidth: 1, miterLimit: 10,
  shadowBlur: 0, shadowColor: 'rgba(0, 0, 0, 0)', shadowOffsetX: 0, shadowOffsetY: 0,
  strokeStyle: '#000000', textAlign: 'start', textBaseline: 'alphabetic', wordSpacing: '0px',
});

/**
 * A gradient or pattern style. Its tag is read when a shape is drawn, so a
 * colour stop added after assignment still reaches the digest.
 * @param {string} kind @param {unknown[]} args
 */
function gradient(kind, args) {
  /** @type {Array<[number, string]>} */
  const stops = [];
  return {
    // Stops are painted in offset order; ties keep insertion order.
    get __simTag() {
      const painted = [...stops].sort((a, b) => a[0] - b[0]).map(([o, c]) => fmt(o) + ' ' + c);
      return kind + '(' + fmtArgs(args) + '|' + painted.join(',') + ')';
    },
    /** @param {number} offset @param {string} color */
    addColorStop(offset, color) { stops.push([Number(offset), fmt(color)]); },
  };
}

/**
 * Advance width, in em, of one code point. Symbols, arrows and emoji are wider
 * than ASCII, as with a real monospace font and its fallbacks, so replacing
 * measureText with a characters-times-size estimate changes the trace.
 * @param {number} cp
 */
function glyphEm(cp) {
  if (cp < 0x80) return 0.6;
  if (cp < 0x2e80) return 0.8;
  if (cp < 0x10000) return 1;
  return 1.2;
}

/** @param {unknown} font @param {unknown} text */
function textMetrics(font, text) {
  const m = /(\d+(?:\.\d+)?)px/.exec(String(font));
  const size = m ? Number(m[1]) : 10;
  let em = 0;
  for (const ch of String(text)) em += glyphEm(ch.codePointAt(0) ?? 0);
  return { size, width: size * em };
}

/** Context settings each kind of drawing reads, besides compositing, shadow, transform and clip. */
const DRAW_KEYS = Object.freeze({
  fill: /** @type {string[]} */ ([]),
  stroke: ['lineWidth', 'lineCap', 'lineJoin', 'miterLimit'],
  fillText: ['font', 'textAlign', 'textBaseline', 'direction', 'letterSpacing', 'wordSpacing', 'fontKerning'],
  strokeText: ['font', 'textAlign', 'textBaseline', 'direction', 'letterSpacing', 'wordSpacing', 'fontKerning',
    'lineWidth', 'lineCap', 'lineJoin', 'miterLimit'],
  image: ['imageSmoothingEnabled', 'imageSmoothingQuality'],
  clear: null,
});
const COMPOSITE_KEYS = ['globalAlpha', 'globalCompositeOperation', 'filter'];
const SHADOW_KEYS = ['shadowColor', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY'];
const PATH_OPS = ['moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect', 'quadraticCurveTo', 'bezierCurveTo', 'closePath'];

/** @param {unknown} color */
function isTransparent(color) {
  const c = String(color).replace(/\s+/g, '').toLowerCase();
  return c === 'transparent' || /^(rgba|hsla)\(.*,0(\.0*)?\)$/.test(c) || /^#([0-9a-f]{3}0|[0-9a-f]{6}00)$/.test(c);
}

/**
 * A 2D context that records what is drawn, not how its state was set. Each
 * fill, stroke, text, image and clear becomes one entry: its arguments, its
 * path, and the state that affects it at that moment (transform, clip, alpha,
 * compositing, filter, visible shadow, and the style, line, text or image
 * settings it uses). State writes, save/restore and path building make no
 * entries, so reordering independent writes or hoisting a repeated one keeps
 * the trace, and any change to what reaches the canvas changes it.
 *
 * When `texts` is given, each drawn string also records where its visual
 * centre landed, so journeys can tap a label the way a player would.
 * @param {any} canvas
 * @param {Stream} draw
 * @param {Map<string, { x: number, y: number }> | null} texts
 */
function createContext2d(canvas, draw, texts) {
  const tag = canvas.__simTag + '.';
  /** @type {Record<string, unknown>} */
  let state = { ...CONTEXT_DEFAULTS };
  /** @type {number[]} */
  let dash = [];
  /** @type {number[]} */
  let m = [1, 0, 0, 1, 0, 0];
  let mText = '';
  let clip = '';
  /** @type {Array<[Record<string, unknown>, number[], number[], string, string]>} */
  let stack = [];
  /** @type {string[]} */
  let path = [];
  /** @type {Map<string, string>} */
  const sigs = new Map();
  const changed = () => sigs.clear();
  /** @param {number[]} next */
  const setMatrix = (next) => {
    m = next;
    const [a, b, c, d, e, f] = m;
    mText = a === 1 && b === 0 && c === 0 && d === 1 && e === 0 && f === 0 ? '' : fmt(m);
    changed();
  };
  /** @param {number} a @param {number} b @param {number} c @param {number} d @param {number} e @param {number} f */
  const multiply = (a, b, c, d, e, f) => {
    const [ma = 1, mb = 0, mc = 0, md = 1, me = 0, mf = 0] = m;
    setMatrix([ma * a + mc * b, mb * a + md * b, ma * c + mc * d, mb * c + md * d, ma * e + mc * f + me, mb * e + md * f + mf]);
  };
  /** @param {keyof typeof DRAW_KEYS} kind */
  const sig = (kind) => {
    let s = sigs.get(kind);
    if (s !== undefined) return s;
    const parts = [mText, clip];
    const keys = DRAW_KEYS[kind];
    if (keys) {
      for (const k of COMPOSITE_KEYS) parts.push(fmt(state[k]));
      const shadow = !isTransparent(state.shadowColor) &&
        (Number(state.shadowBlur) > 0 || Number(state.shadowOffsetX) !== 0 || Number(state.shadowOffsetY) !== 0);
      if (shadow) for (const k of SHADOW_KEYS) parts.push(fmt(state[k]));
      for (const k of keys) parts.push(fmt(state[k]));
      if ((kind === 'stroke' || kind === 'strokeText') && dash.length) parts.push(fmt(dash), fmt(state.lineDashOffset));
    }
    s = parts.join(';');
    sigs.set(kind, s);
    return s;
  };
  /** @param {string} op @param {keyof typeof DRAW_KEYS} kind @param {unknown[]} args @param {boolean} [withPath] */
  const drawOp = (op, kind, args, withPath) => {
    canvas.__simFlushResize();
    let entry = tag + op + '(' + fmtArgs(args) + ')|' + sig(kind);
    if (kind === 'fill' || kind === 'fillText') entry += '|' + fmt(state.fillStyle);
    if (kind === 'stroke' || kind === 'strokeText') entry += '|' + fmt(state.strokeStyle);
    if (withPath) entry += '|' + path.join(' ');
    draw.push(entry);
  };
  /** @param {'fillText' | 'strokeText'} op */
  const text = (op) => (/** @type {unknown[]} */ ...args) => {
    drawOp(op, op, args);
    if (!texts) return;
    const { size, width } = textMetrics(state.font, args[0]);
    const align = String(state.textAlign);
    const baseline = String(state.textBaseline);
    const x = (Number(args[1]) || 0) + (align === 'left' || align === 'start' ? width / 2 : align === 'right' || align === 'end' ? -width / 2 : 0);
    const y = (Number(args[2]) || 0) + (baseline === 'top' || baseline === 'hanging' ? size / 2 : baseline === 'middle' ? 0 : -size * 0.35);
    const [ma = 1, mb = 0, mc = 0, md = 1, me = 0, mf = 0] = m;
    texts.set(String(args[0]), { x: ma * x + mc * y + me, y: mb * x + md * y + mf });
  };
  /** @type {Record<string, unknown>} */
  const own = {
    canvas,
    save() { stack.push([state, dash, m, mText, clip]); state = { ...state }; },
    restore() {
      const top = stack.pop();
      if (!top) return;
      [state, dash, m, mText, clip] = top;
      changed();
    },
    /** @param {number} x @param {number} y */
    translate(x, y) { multiply(1, 0, 0, 1, x, y); },
    /** @param {number} x @param {number} y */
    scale(x, y) { multiply(x, 0, 0, y, 0, 0); },
    /** @param {number} angle */
    rotate(angle) { const c = Math.cos(angle); const s = Math.sin(angle); multiply(c, s, -s, c, 0, 0); },
    /** @param {number} a @param {number} b @param {number} c @param {number} d @param {number} e @param {number} f */
    transform(a, b, c, d, e, f) { multiply(a, b, c, d, e, f); },
    /** @param {unknown[]} args */
    setTransform(...args) {
      const src = /** @type {any} */ (args.length === 1 && args[0] && typeof args[0] === 'object' ? args[0] : null);
      setMatrix(src ? [src.a ?? 1, src.b ?? 0, src.c ?? 0, src.d ?? 1, src.e ?? 0, src.f ?? 0] : args.length >= 6 ? args.slice(0, 6).map(Number) : [1, 0, 0, 1, 0, 0]);
    },
    resetTransform() { setMatrix([1, 0, 0, 1, 0, 0]); },
    getTransform: () => { const [a, b, c, d, e, f] = m; return { a, b, c, d, e, f, is2D: true, isIdentity: !mText }; },
    /** @param {number[]} segments */
    setLineDash(segments) { dash = Array.from(segments, Number); changed(); },
    getLineDash() { return dash.slice(); },
    beginPath() { path = []; },
    /** @param {unknown[]} args */
    fill(...args) { drawOp('fill', 'fill', args, true); },
    /** @param {unknown[]} args */
    stroke(...args) { drawOp('stroke', 'stroke', args, true); },
    /** @param {unknown[]} args */
    clip(...args) { clip += '[' + path.join(' ') + '|' + fmtArgs(args) + ']'; changed(); },
    /** @param {unknown[]} args */
    fillRect(...args) { drawOp('fillRect', 'fill', args); },
    /** @param {unknown[]} args */
    strokeRect(...args) { drawOp('strokeRect', 'stroke', args); },
    /** @param {unknown[]} args */
    clearRect(...args) { drawOp('clearRect', 'clear', args); },
    fillText: text('fillText'),
    strokeText: text('strokeText'),
    /** @param {unknown[]} args */
    drawImage(...args) { drawOp('drawImage', 'image', args); },
    /** @param {string} value */
    measureText(value) {
      const { size, width } = textMetrics(state.font, value);
      return {
        width, actualBoundingBoxLeft: 0, actualBoundingBoxRight: width,
        actualBoundingBoxAscent: size * 0.8, actualBoundingBoxDescent: size * 0.2,
        fontBoundingBoxAscent: size * 0.8, fontBoundingBoxDescent: size * 0.2,
      };
    },
    /** @param {unknown[]} args */
    createLinearGradient: (...args) => gradient('linear', args),
    /** @param {unknown[]} args */
    createRadialGradient: (...args) => gradient('radial', args),
    /** @param {unknown[]} args */
    createConicGradient: (...args) => gradient('conic', args),
    /** @param {unknown} source @param {unknown} repetition */
    createPattern: (source, repetition) => ({ __simTag: 'pattern(' + fmt(source) + ',' + fmt(repetition) + ')' }),
    isPointInPath: () => false,
    isPointInStroke: () => false,
  };
  for (const op of PATH_OPS) {
    own[op] = (/** @type {unknown[]} */ ...args) => { path.push(op + '(' + fmtArgs(args) + ')' + (mText ? '@' + mText : '')); };
  }
  /** @type {Map<string, Function>} */
  const recorders = new Map();
  const proxy = new Proxy(own, {
    get(target, key) {
      if (typeof key !== 'string') return undefined;
      if (Object.prototype.hasOwnProperty.call(target, key)) return target[key];
      if (Object.prototype.hasOwnProperty.call(state, key)) return state[key];
      let fn = recorders.get(key);
      if (!fn) {
        fn = (/** @type {unknown[]} */ ...args) => draw.push(tag + key + '(' + fmtArgs(args) + ')');
        recorders.set(key, fn);
      }
      return fn;
    },
    set(_target, key, value) {
      if (typeof key !== 'string') return false;
      state[key] = value;
      if (key !== 'fillStyle' && key !== 'strokeStyle') changed();
      return true;
    },
    has: () => true,
  });
  const reset = () => {
    state = { ...CONTEXT_DEFAULTS };
    dash = [];
    clip = '';
    stack = [];
    path = [];
    setMatrix([1, 0, 0, 1, 0, 0]);
  };
  return { proxy, reset };
}

class Events {
  constructor() {
    /** @type {Map<string, Array<{ fn: Function, capture: boolean, once: boolean, removed: boolean }>>} */
    this.map = new Map();
  }

  /** @param {unknown} options */
  static capture(options) {
    return typeof options === 'boolean' ? options : !!(options && typeof options === 'object' && /** @type {any} */ (options).capture);
  }

  /**
   * Adds a listener the way the DOM does: the same function and capture flag
   * registered twice is one registration.
   * @param {string} target @param {string} type @param {unknown} fn @param {unknown} [options]
   */
  on(target, type, fn, options) {
    if (typeof fn !== 'function') return;
    const k = target + ':' + type;
    const list = this.map.get(k) || [];
    const capture = Events.capture(options);
    if (list.some((l) => l.fn === fn && l.capture === capture)) return;
    list.push({ fn, capture, once: !!(options && typeof options === 'object' && /** @type {any} */ (options).once), removed: false });
    this.map.set(k, list);
  }

  /** @param {string} target @param {string} type @param {unknown} fn @param {unknown} [options] */
  off(target, type, fn, options) {
    const k = target + ':' + type;
    const list = this.map.get(k);
    if (!list) return;
    const capture = Events.capture(options);
    const i = list.findIndex((l) => l.fn === fn && l.capture === capture);
    const reg = list[i];
    if (!reg) return;
    reg.removed = true;
    list.splice(i, 1);
  }

  /**
   * Dispatches to the listeners registered when dispatch began, skipping any
   * that an earlier listener removed.
   * @param {string} target @param {string} type @param {object} evt
   */
  fire(target, type, evt) {
    const k = target + ':' + type;
    const list = (this.map.get(k) || []).slice();
    for (const reg of list) {
      if (reg.removed) continue;
      if (reg.once) this.off(target, type, reg.fn, { capture: reg.capture });
      reg.fn(evt);
    }
    return list.length;
  }

  /** @param {string} target */
  api(target) {
    return {
      /** @param {string} type @param {unknown} fn @param {unknown} [options] */
      addEventListener: (type, fn, options) => this.on(target, type, fn, options),
      /** @param {string} type @param {unknown} fn @param {unknown} [options] */
      removeEventListener: (type, fn, options) => this.off(target, type, fn, options),
      dispatchEvent: () => true,
    };
  }
}

const AUDIO_PARAMS = new Set(['gain', 'frequency', 'detune', 'Q', 'pan', 'playbackRate', 'delayTime',
  'offset', 'threshold', 'knee', 'ratio', 'attack', 'release']);
/** Media element properties that change what is heard. */
const MEDIA_KEYS = new Set(['volume', 'muted', 'loop', 'playbackRate', 'currentTime', 'src']);
const AUDIO_PARAM_METHODS = ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime',
  'setTargetAtTime', 'setValueCurveAtTime', 'cancelScheduledValues', 'cancelAndHoldAtTime'];

/**
 * @typedef {object} SimOptions
 * @property {number} [width] CSS viewport width.
 * @property {number} [height] CSS viewport height.
 * @property {boolean} [touch] Report a touch device.
 * @property {{ top?: number, right?: number, bottom?: number, left?: number }} [insets] Safe-area insets in CSS px.
 * @property {Record<string, string>} [storage] Initial localStorage contents.
 * @property {string} [root] Repository root whose scripts are loaded.
 * @property {boolean} [keep] Keep raw stream entries so `diff` can print them.
 * @property {boolean} [offline] Fail every fetch, including version.json.
 * @property {number} [randomSeed] Seed for Math.random.
 * @property {(rel: string, code: string) => string} [transform] Rewrites a script before it loads.
 */

/** @type {Map<string, vm.Script>} */
const scriptCache = new Map();

/** @param {number} seed */
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** @param {string} code */
function keyFor(code) {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (code === 'Space') return ' ';
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
  if (code === 'Minus') return '-';
  return code;
}

/** @param {string} ch */
function codeFor(ch) {
  if (/^[a-z]$/i.test(ch)) return 'Key' + ch.toUpperCase();
  if (/^\d$/.test(ch)) return 'Digit' + ch;
  if (ch === '-') return 'Minus';
  if (ch === ' ') return 'Space';
  throw new Error('no key code for ' + JSON.stringify(ch));
}

const SETUP = new vm.Script(`(() => {
  const sim = globalThis.__sim;
  delete globalThis.__sim;
  globalThis.window = globalThis;
  globalThis.self = globalThis;
  Math.random = sim.random;
  const RealDate = Date;
  const SimDate = function Date(...args) {
    if (!new.target) return new RealDate(sim.epochNow()).toString();
    return args.length === 0 ? new RealDate(sim.epochNow()) : new RealDate(...args);
  };
  SimDate.prototype = RealDate.prototype;
  SimDate.now = () => sim.epochNow();
  SimDate.parse = RealDate.parse;
  SimDate.UTC = RealDate.UTC;
  RealDate.prototype.toLocaleDateString = function () { return this.toISOString().slice(0, 10); };
  RealDate.prototype.toLocaleTimeString = function () { return this.toISOString().slice(11, 19); };
  RealDate.prototype.toLocaleString = function () { return this.toISOString().slice(0, 19).replace('T', ' '); };
  globalThis.Date = SimDate;
})();`, { filename: 'sim-setup' });

const PROBE = new vm.Script(`(() => {
  const g = typeof game !== 'undefined' ? game : null;
  const p = g && g.player;
  const d = g && g.dungeon && g.dungeon.map ? g.dungeon.map : null;
  const r2 = (n) => Math.round(n * 100) / 100;
  return JSON.stringify({
    state: g ? g.state : null,
    floor: g && typeof g.floor === 'number' ? g.floor : null,
    hp: p && typeof p.hp === 'number' ? r2(p.hp) : null,
    pos: p && typeof p.x === 'number' ? r2(p.x) + ',' + r2(p.y) : null,
    foes: typeof enemies !== 'undefined' && Array.isArray(enemies) ? enemies.length : null,
    score: p && typeof p.score === 'number' ? p.score : null,
    map: d ? d.map((row) => row.join(',')).join(';') : null,
  });
})()`, { filename: 'sim-probe' });

const TASK = new vm.Script('__simTask()', { filename: 'sim-task' });

/**
 * Boots the game from `root` in a fresh vm context.
 * @param {SimOptions} [options]
 */
function createGameSim(options = {}) {
  const root = options.root || ROOT;
  const keep = !!options.keep;
  const insets = options.insets || {};
  const viewport = { width: options.width || 1280, height: options.height || 800 };
  const clock = { now: 0 };
  const draw = new Stream(keep);
  const audio = new Stream(keep);
  const net = new Stream(keep);
  const events = new Events();
  /** @type {string[]} */
  let logs = [];
  let writes = 0;
  let seq = 0;
  let frame = 0;

  /** @type {Map<string, string>} */
  const storageMap = new Map(Object.entries(options.storage || {}));
  const storage = {
    /** @param {string} k */
    getItem: (k) => (storageMap.has(String(k)) ? storageMap.get(String(k)) : null),
    /** @param {string} k @param {unknown} v */
    setItem: (k, v) => { storageMap.set(String(k), String(v)); writes++; },
    /** @param {string} k */
    removeItem: (k) => { storageMap.delete(String(k)); writes++; },
    clear: () => { storageMap.clear(); writes++; },
    /** @param {number} i */
    key: (i) => [...storageMap.keys()][i] ?? null,
    get length() { return storageMap.size; },
  };

  /** @type {Map<number, { at: number, fn: Function, args: unknown[], every: number }>} */
  const timers = new Map();
  /** @param {unknown} fn @param {unknown} ms @param {unknown[]} args @param {boolean} repeat */
  const schedule = (fn, ms, args, repeat) => {
    const id = ++seq;
    const delay = Math.max(0, Number(ms) || 0);
    if (typeof fn === 'function') timers.set(id, { at: clock.now + delay, fn, args, every: repeat ? Math.max(1, delay) : 0 });
    return id;
  };
  /** @type {Map<number, Function>} */
  let rafQueue = new Map();
  /** Callbacks of the frame being run, so cancelAnimationFrame can still reach them. */
  /** @type {Map<number, Function>} */
  let runningFrame = new Map();

  /** @type {Map<string, { x: number, y: number }>} */
  const texts = new Map();
  /** Every canvas, so a checkpoint can record clears nothing has drawn after. */
  /** @type {Array<{ __simFlushResize: () => void }>} */
  const canvases = [];

  /** @param {number} id @param {(() => { width: number, height: number }) | null} cssSize */
  const createCanvas = (id, cssSize) => {
    let width = 300;
    let height = 150;
    let resized = false;
    /** @type {{ proxy: any, reset: () => void } | null} */
    let context = null;
    const tag = id === 0 ? 'canvas' : 'canvas' + id;
    const canvas = {
      // Reading the tag (drawImage or createPattern of this canvas) first
      // records any pending clear, so a cleared source is not mistaken for
      // the painted one.
      get __simTag() {
        canvas.__simFlushResize();
        return tag;
      },
      style: {},
      get width() { return width; },
      set width(v) {
        width = Math.max(0, Math.floor(Number(v)) || 0);
        resized = true;
        if (context) context.reset();
      },
      get height() { return height; },
      set height(v) {
        height = Math.max(0, Math.floor(Number(v)) || 0);
        resized = true;
        if (context) context.reset();
      },
      // Setting either dimension clears the canvas. Record one resize before
      // the next drawing, so the order of the two writes does not matter.
      __simFlushResize() {
        if (!resized) return;
        resized = false;
        draw.push(tag + '.resize(' + width + ',' + height + ')');
      },
      /** @param {string} kind */
      getContext(kind) {
        if (kind !== '2d') return null;
        if (!context) context = createContext2d(canvas, draw, id === 0 ? texts : null);
        return context.proxy;
      },
      getBoundingClientRect() {
        const size = cssSize ? cssSize() : { width, height };
        return rect(size.width, size.height);
      },
      ...events.api(tag),
      setAttribute() {},
      removeAttribute() {},
      focus() {},
      blur() {},
      toDataURL: () => 'data:,',
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    };
    canvases.push(canvas);
    return canvas;
  };
  const canvas = createCanvas(0, () => viewport);
  /** The main canvas's event target key (its tag, read without flushing). */
  const MAIN_CANVAS = 'canvas';

  /** @type {any} */
  const body = { __simTag: 'body', tagName: 'BODY', style: {}, appendChild: (/** @type {any} */ c) => c, removeChild: (/** @type {any} */ c) => c, classList: { add() {}, remove() {}, toggle() {}, contains: () => false } };
  /** @type {any} */
  const documentElement = {
    tagName: 'HTML',
    style: { setProperty() {}, removeProperty() {} },
    get clientWidth() { return viewport.width; },
    get clientHeight() { return viewport.height; },
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  };
  /** @param {string} tagName */
  const createElement = (tagName) => {
    if (String(tagName).toLowerCase() === 'canvas') return createCanvas(++seq, null);
    const tag = 'el' + (++seq);
    /** @type {Record<string, string>} */
    const attrs = {};
    /** @type {any} */
    const el = {
      __simTag: tag,
      tagName: String(tagName).toUpperCase(),
      style: {},
      dataset: {},
      value: '',
      /** @param {string} k @param {unknown} v */
      setAttribute: (k, v) => { attrs[k] = String(v); },
      /** @param {string} k */
      getAttribute: (k) => attrs[k] ?? null,
      /** @param {string} k */
      removeAttribute: (k) => { delete attrs[k]; },
      ...events.api(tag),
      appendChild: (/** @type {any} */ c) => c,
      removeChild: (/** @type {any} */ c) => c,
      remove() {},
      focus() { document.activeElement = el; },
      blur() { if (document.activeElement === el) document.activeElement = body; },
      setSelectionRange() {},
      select() {},
      click() {},
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      getBoundingClientRect: () => rect(0, 0),
    };
    return el;
  };
  const insetValue = /** @type {Record<string, string>} */ ({
    '--sat': (insets.top || 0) + 'px',
    '--sar': (insets.right || 0) + 'px',
    '--sab': (insets.bottom || 0) + 'px',
    '--sal': (insets.left || 0) + 'px',
  });
  /** @type {any} */
  const document = {
    hidden: false,
    visibilityState: 'visible',
    body,
    documentElement,
    activeElement: body,
    head: { appendChild: (/** @type {any} */ c) => c },
    /** @param {string} id */
    getElementById: (id) => (id === 'c' ? canvas : null),
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement,
    ...events.api('document'),
  };

  // Browsers let media and audio contexts start only after a user activation:
  // a keydown other than Escape, a mousedown, or a touchend.
  let activated = false;
  /** @type {Array<() => void>} */
  let onActivate = [];
  const activate = () => {
    if (activated) return;
    activated = true;
    const pending = onActivate;
    onActivate = [];
    for (const fn of pending) fn();
  };

  let audioSeq = 0;
  /** @param {string} tag */
  const audioParam = (tag) => {
    let value = 0;
    /** @type {any} */
    const param = {
      __simTag: tag,
      get value() { return value; },
      set value(v) { value = Number(v); audio.push(tag + '=' + fmt(v)); },
    };
    for (const m of AUDIO_PARAM_METHODS) {
      param[m] = (/** @type {unknown[]} */ ...args) => { audio.push(tag + '.' + m + '(' + fmtArgs(args) + ')'); return param; };
    }
    return param;
  };
  /** @param {string} kind */
  const audioNode = (kind) => {
    const tag = kind + '#' + (++audioSeq);
    /** @type {Record<string, unknown>} */
    const target = { __simTag: tag };
    return new Proxy(target, {
      get(t, key) {
        if (typeof key !== 'string') return undefined;
        if (key in t) return t[key];
        if (AUDIO_PARAMS.has(key)) return (t[key] = audioParam(tag + '.' + key));
        const fn = (/** @type {unknown[]} */ ...args) => {
          audio.push(tag + '.' + key + '(' + fmtArgs(args) + ')');
          return key === 'connect' ? args[0] : undefined;
        };
        t[key] = fn;
        return fn;
      },
      set(t, key, value) {
        t[/** @type {string} */ (key)] = value;
        if (typeof key === 'string' && typeof value !== 'function') audio.push(tag + '.' + key + '=' + fmt(value));
        return true;
      },
    });
  };
  /** @type {any} */
  let CtxPromise = null;
  /** @type {any} */
  let CtxFloat32Array = null;
  /** @type {any} */
  let CtxError = null;
  function AudioContext() {
    // A context's clock starts at zero and only runs while the context runs.
    let elapsed = 0;
    /** @type {number | null} */
    let runningSince = activated ? clock.now : null;
    /** @param {string} next */
    const setState = (next) => {
      if (runningSince !== null) elapsed += clock.now - runningSince;
      runningSince = next === 'running' ? clock.now : null;
      ac.state = next;
    };
    /** @type {any} */
    const ac = {
      __simTag: 'audio',
      get currentTime() { return (elapsed + (runningSince === null ? 0 : clock.now - runningSince)) / 1000; },
      sampleRate: 44100,
      state: activated ? 'running' : 'suspended',
      destination: audioNode('destination'),
      listener: audioNode('listener'),
      /** @param {number} channels @param {number} length @param {number} rate */
      createBuffer(channels, length, rate) {
        audio.push('createBuffer(' + fmtArgs([channels, length, rate]) + ')');
        /** @type {Float32Array[]} */
        const data = Array.from({ length: channels }, () => new CtxFloat32Array(length));
        /** @type {string | null} */
        let samples = null;
        return {
          // The samples are hashed the first time the buffer is used, after the
          // game has filled it, so silenced or altered procedural audio shows.
          get __simTag() {
            if (samples === null) {
              const d = new Digest();
              for (const ch of data) {
                let chunk = '';
                for (let i = 0; i < ch.length; i++) {
                  chunk += Math.round((ch[i] ?? 0) * 1e4) + ',';
                  if (chunk.length > 4096) { d.add(chunk); chunk = ''; }
                }
                d.add(chunk);
              }
              samples = d.hex();
            }
            return 'buffer(' + samples + ')';
          },
          numberOfChannels: channels,
          length,
          sampleRate: rate,
          duration: length / rate,
          getChannelData: (/** @type {number} */ ch) => data[ch],
        };
      },
      decodeAudioData: () => CtxPromise.reject(new CtxError('sim: no audio decoding')),
      resume() {
        if (activated) {
          setState('running');
          audio.push('resume()');
          return CtxPromise.resolve();
        }
        audio.push('resume()=waiting');
        return new CtxPromise((/** @type {(v?: unknown) => void} */ resolve) => {
          onActivate.push(() => { setState('running'); audio.push('resume()'); resolve(); });
        });
      },
      suspend() { setState('suspended'); audio.push('suspend()'); return CtxPromise.resolve(); },
      close() { setState('closed'); return CtxPromise.resolve(); },
      addEventListener() {},
      removeEventListener() {},
    };
    return new Proxy(ac, {
      get(t, key) {
        if (key in t) return t[key];
        if (typeof key === 'string' && key.startsWith('create')) {
          return (/** @type {unknown[]} */ ...args) => {
            audio.push(key + '(' + fmtArgs(args) + ')');
            return audioNode(key.slice('create'.length));
          };
        }
        return undefined;
      },
    });
  }
  /** @param {string} [src] */
  function Audio(src) {
    const tag = 'media#' + (++audioSeq);
    /** @type {any} */
    const target = {
      __simTag: tag,
      paused: true,
      currentTime: 0,
      volume: 1,
      loop: false,
      src: src || '',
      play() {
        if (!activated) {
          audio.push(tag + '.play()=blocked');
          const err = new CtxError("play() failed because the user didn't interact with the document first.");
          err.name = 'NotAllowedError';
          return CtxPromise.reject(err);
        }
        media.paused = false;
        audio.push(tag + '.play()');
        return CtxPromise.resolve();
      },
      pause() { media.paused = true; audio.push(tag + '.pause()'); },
      load() {},
      addEventListener() {},
      removeEventListener() {},
    };
    /** @type {any} */
    const media = new Proxy(target, {
      set(t, key, value) {
        t[/** @type {string} */ (key)] = value;
        if (typeof key === 'string' && MEDIA_KEYS.has(key)) audio.push(tag + '.' + key + '=' + fmt(value));
        return true;
      },
    });
    audio.push(tag + '=new Audio(' + fmt(src) + ')');
    return media;
  }

  const random = mulberry32(options.randomSeed ?? 0x0dd0c0de);
  /** @type {any} */
  const win = {
    __sim: { random, epochNow: () => EPOCH_MS + clock.now },
    console: {
      log: (/** @type {unknown[]} */ ...a) => logs.push('log ' + a.map(String).join(' ')),
      info: (/** @type {unknown[]} */ ...a) => logs.push('info ' + a.map(String).join(' ')),
      debug: (/** @type {unknown[]} */ ...a) => logs.push('debug ' + a.map(String).join(' ')),
      trace: (/** @type {unknown[]} */ ...a) => logs.push('trace ' + a.map(String).join(' ')),
      warn: (/** @type {unknown[]} */ ...a) => logs.push('warn ' + a.map(String).join(' ')),
      error: (/** @type {unknown[]} */ ...a) => logs.push('error ' + a.map(String).join(' ')),
      group() {}, groupEnd() {}, table() {},
    },
    document,
    localStorage: storage,
    navigator: { userAgent: 'NeonDungeonSim/1.0', language: 'en-US', languages: ['en-US'], maxTouchPoints: options.touch ? 5 : 0, onLine: false, getGamepads: () => [] },
    location: { href: 'http://sim.local/', origin: 'http://sim.local', protocol: 'http:', host: 'sim.local', hostname: 'sim.local', pathname: '/', search: '', hash: '', reload() {}, assign() {}, replace() {} },
    history: { length: 1, state: null, pushState() {}, replaceState() {}, back() {} },
    devicePixelRatio: 1,
    screen: {
      get width() { return viewport.width; },
      get height() { return viewport.height; },
      orientation: {
        get type() { return viewport.width >= viewport.height ? 'landscape-primary' : 'portrait-primary'; },
        angle: 0,
        ...events.api('orientation'),
      },
    },
    visualViewport: {
      get width() { return viewport.width; },
      get height() { return viewport.height; },
      scale: 1, offsetLeft: 0, offsetTop: 0, pageLeft: 0, pageTop: 0,
      ...events.api('visualViewport'),
    },
    /** @param {string} query */
    matchMedia: (query) => ({ matches: !!options.touch && /coarse|hover:\s*none/.test(query), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    /** @param {unknown} el */
    getComputedStyle: (el) => ({ getPropertyValue: (/** @type {string} */ name) => (el === documentElement ? insetValue[name] || '' : '') }),
    /** @param {Function} fn */
    requestAnimationFrame: (fn) => { const id = ++seq; rafQueue.set(id, fn); return id; },
    /** @param {number} id */
    cancelAnimationFrame: (id) => { rafQueue.delete(id); runningFrame.delete(id); },
    /** @param {unknown} fn @param {unknown} ms @param {unknown[]} args */
    setTimeout: (fn, ms, ...args) => schedule(fn, ms, args, false),
    /** @param {number} id */
    clearTimeout: (id) => { timers.delete(id); },
    /** @param {unknown} fn @param {unknown} ms @param {unknown[]} args */
    setInterval: (fn, ms, ...args) => schedule(fn, ms, args, true),
    /** @param {number} id */
    clearInterval: (id) => { timers.delete(id); },
    performance: { now: () => clock.now },
    /** @param {unknown} url */
    fetch: (url) => {
      net.push('fetch(' + fmt(String(url)) + ')');
      if (options.offline || !/(^|\/)version\.json$/.test(String(url))) return CtxPromise.reject(new CtxError('sim: offline'));
      return CtxPromise.resolve({ ok: true, status: 200, json: () => CtxPromise.resolve({ version: SIM_VERSION }) });
    },
    posthog: {
      __SV: 1,
      /** @param {unknown} name @param {unknown} props */
      capture: (name, props) => { net.push('posthog.capture(' + JSON.stringify([name, props]) + ')'); },
    },
    AudioContext,
    webkitAudioContext: AudioContext,
    Audio,
    Image: function Image() { return { __simTag: 'image', complete: false, width: 0, height: 0, addEventListener() {}, removeEventListener() {} }; },
    ...events.api('window'),
  };
  Object.defineProperty(win, 'innerWidth', { get: () => viewport.width, enumerable: true });
  Object.defineProperty(win, 'innerHeight', { get: () => viewport.height, enumerable: true });
  if (options.touch) win.ontouchstart = null;

  vm.createContext(win, { microtaskMode: 'afterEvaluate' });
  const context = win;
  context.__simTask = undefined;
  CtxPromise = vm.runInContext('Promise', context);
  CtxFloat32Array = vm.runInContext('Float32Array', context);
  CtxError = vm.runInContext('Error', context);
  SETUP.runInContext(context);

  const { requiredInIndex } = require(path.join(root, 'scripts', 'manifest.js'));
  for (const rel of /** @type {string[]} */ (requiredInIndex)) {
    const file = path.join(root, rel);
    let script = options.transform ? undefined : scriptCache.get(file);
    if (!script) {
      const code = fs.readFileSync(file, 'utf8');
      script = new vm.Script(options.transform ? options.transform(rel, code) : code, { filename: rel });
      if (!options.transform) scriptCache.set(file, script);
    }
    script.runInContext(context);
  }

  /** @param {() => void} fn */
  const task = (fn) => {
    context.__simTask = fn;
    try {
      TASK.runInContext(context);
    } finally {
      context.__simTask = undefined;
    }
  };

  const runDueTimers = () => {
    for (let guard = 0; guard < 1000; guard++) {
      /** @type {[number, { at: number, fn: Function, args: unknown[], every: number }] | null} */
      let next = null;
      for (const entry of timers) {
        if (entry[1].at <= clock.now && (!next || entry[1].at < next[1].at)) next = entry;
      }
      if (!next) return;
      const [id, t] = next;
      if (t.every) t.at = clock.now + t.every;
      else timers.delete(id);
      task(() => t.fn(...t.args));
    }
    throw new Error('sim: timers keep rescheduling at the same instant');
  };

  const step = () => {
    clock.now += FRAME_MS;
    frame++;
    runDueTimers();
    // Hidden tabs get no animation frames; queued callbacks wait for show().
    if (document.hidden) return;
    runningFrame = rafQueue;
    rafQueue = new Map();
    texts.clear();
    for (const [id, fn] of [...runningFrame]) {
      if (!runningFrame.has(id)) continue;
      runningFrame.delete(id);
      task(() => fn(clock.now));
    }
  };

  /** @type {Map<number, { identifier: number, clientX: number, clientY: number }>} */
  const touches = new Map();
  /** @param {string} type @param {number} id */
  const touchEvent = (type, id) => {
    const t = touches.get(id);
    const touch = { identifier: id, clientX: t ? t.clientX : 0, clientY: t ? t.clientY : 0, pageX: t ? t.clientX : 0, pageY: t ? t.clientY : 0, target: canvas, radiusX: 1, radiusY: 1, force: 1 };
    if (type === 'touchend' || type === 'touchcancel') touches.delete(id);
    const list = [...touches.values()].map((v) => ({ ...v, pageX: v.clientX, pageY: v.clientY, target: canvas }));
    task(() => {
      if (type === 'touchend') activate();
      events.fire(MAIN_CANVAS, type, { type, touches: list, targetTouches: list, changedTouches: [touch], target: canvas, cancelable: true, preventDefault() {}, stopPropagation() {} });
    });
  };
  /** @param {string} type @param {number} x @param {number} y @param {object} [extra] */
  const mouseEvent = (type, x, y, extra = {}) => ({ type, clientX: x, clientY: y, pageX: x, pageY: y, button: 0, buttons: 0, target: canvas, preventDefault() {}, stopPropagation() {}, ...extra });
  /** @param {string} type @param {string} code @param {string} key @param {boolean} [repeat] */
  const keyEvent = (type, code, key, repeat = false) => ({ type, code, key, repeat, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, isComposing: false, target: body, preventDefault() {}, stopPropagation() {} });

  const sim = {
    /** @param {number} [n] */
    frames(n = 1) { for (let i = 0; i < n; i++) step(); },
    /** @param {string} code @param {string} [key] */
    down(code, key = keyFor(code)) {
      task(() => {
        if (code !== 'Escape') activate();
        events.fire('window', 'keydown', keyEvent('keydown', code, key));
      });
    },
    /** @param {string} code @param {string} [key] */
    up(code, key = keyFor(code)) { task(() => events.fire('window', 'keyup', keyEvent('keyup', code, key))); },
    /** Press and release across two frames. @param {string} code @param {string} [key] */
    key(code, key = keyFor(code)) { sim.down(code, key); step(); sim.up(code, key); step(); },
    /**
     * Holds a key for n frames. After half a second the OS repeats it every
     * two frames, as keyboards do.
     * @param {string} code @param {number} n
     */
    hold(code, n) {
      sim.down(code);
      for (let i = 1; i <= n; i++) {
        step();
        if (i >= 30 && i % 2 === 0 && i < n) task(() => events.fire('window', 'keydown', keyEvent('keydown', code, keyFor(code), true)));
      }
      sim.up(code);
      step();
    },
    /** Freezes the page for ms, as a slow device or a debugger pause would; the next frame sees the whole gap. @param {number} ms */
    stall(ms) { clock.now += ms; },
    /** @param {string} text */
    type(text) { for (const ch of text) sim.key(codeFor(ch), ch); },
    /** @param {number} x @param {number} y */
    mouseMove(x, y) { task(() => events.fire(MAIN_CANVAS, 'mousemove', mouseEvent('mousemove', x, y))); },
    /** Moves to (x, y), waits a frame as a real cursor would, then clicks. @param {number} x @param {number} y */
    click(x, y) {
      sim.mouseMove(x, y);
      step();
      task(() => {
        activate();
        events.fire(MAIN_CANVAS, 'mousedown', mouseEvent('mousedown', x, y, { buttons: 1 }));
      });
      step();
      task(() => {
        events.fire(MAIN_CANVAS, 'mouseup', mouseEvent('mouseup', x, y));
        events.fire('window', 'mouseup', mouseEvent('mouseup', x, y));
      });
      step();
    },
    /** @param {number} x @param {number} y @param {number} deltaY */
    wheel(x, y, deltaY) { task(() => events.fire(MAIN_CANVAS, 'wheel', mouseEvent('wheel', x, y, { deltaY, deltaX: 0, deltaMode: 0 }))); },
    /** @param {number} id @param {number} x @param {number} y */
    touchStart(id, x, y) { touches.set(id, { identifier: id, clientX: x, clientY: y }); touchEvent('touchstart', id); },
    /** @param {number} id @param {number} x @param {number} y */
    touchMove(id, x, y) { touches.set(id, { identifier: id, clientX: x, clientY: y }); touchEvent('touchmove', id); },
    /** @param {number} id */
    touchEnd(id) { touchEvent('touchend', id); },
    /** A tap: touch down for two frames, then lift. @param {number} x @param {number} y */
    tap(x, y) { sim.touchStart(900, x, y); sim.frames(2); sim.touchEnd(900); sim.frames(2); },
    /**
     * CSS position of a text the last frame drew on the main canvas.
     * @param {RegExp} pattern
     */
    textAt(pattern) {
      for (const [s, p] of texts) {
        if (pattern.test(s)) return { text: s, x: p.x * viewport.width / canvas.width, y: p.y * viewport.height / canvas.height };
      }
      throw new Error(`sim: no text matching ${pattern} in the last frame; saw ${JSON.stringify([...texts.keys()].slice(0, 40))}`);
    },
    /** @param {RegExp} pattern */
    tapText(pattern) { const p = sim.textAt(pattern); sim.tap(p.x, p.y); },
    /** @param {RegExp} pattern */
    clickText(pattern) { const p = sim.textAt(pattern); sim.click(p.x, p.y); },
    /** Backgrounds the page, which saves an active run. */
    hide() {
      document.hidden = true;
      document.visibilityState = 'hidden';
      task(() => {
        events.fire('document', 'visibilitychange', { type: 'visibilitychange' });
        events.fire('window', 'pagehide', { type: 'pagehide', persisted: false });
      });
    },
    show() {
      document.hidden = false;
      document.visibilityState = 'visible';
      task(() => {
        events.fire('document', 'visibilitychange', { type: 'visibilitychange' });
        events.fire('window', 'pageshow', { type: 'pageshow', persisted: false });
      });
    },
    /** @param {number} width @param {number} height */
    resize(width, height) {
      viewport.width = width;
      viewport.height = height;
      task(() => {
        events.fire('window', 'resize', { type: 'resize' });
        events.fire('visualViewport', 'resize', { type: 'resize' });
      });
    },
    /** Evaluates an expression in the game's global scope. @param {string} code */
    eval: (code) => vm.runInContext(code, context),
    state: () => /** @type {string | null} */ (vm.runInContext("typeof game !== 'undefined' ? game.state : null", context)),
    storage: () => Object.fromEntries(storageMap),
    /** Folds everything observed since the previous checkpoint into one record. @param {string} label */
    checkpoint(label) {
      for (const c of canvases) c.__simFlushResize();
      const probe = JSON.parse(PROBE.runInContext(context));
      const d = draw.take();
      const a = audio.take();
      const n = net.take();
      const storedEntries = [...storageMap.keys()].sort().map((k) => k + '=' + storageMap.get(k));
      const record = {
        at: label,
        frame,
        state: probe.state,
        floor: probe.floor,
        hp: probe.hp,
        pos: probe.pos,
        foes: probe.foes,
        score: probe.score,
        map: probe.map === null ? null : digestOf(probe.map),
        draw: d.digest,
        calls: d.count,
        audio: a.digest,
        sounds: a.count,
        net: n.digest,
        store: digestOf(storedEntries.join('\n')),
        writes,
        logs: logs.length ? logs.length + ':' + digestOf(logs.join('\n')) : 0,
      };
      Object.defineProperty(record, 'entries', {
        value: { draw: d.entries, audio: a.entries, net: n.entries, store: keep ? storedEntries : [], logs },
        enumerable: false,
      });
      writes = 0;
      logs = [];
      return record;
    },
  };
  return sim;
}

/** @typedef {ReturnType<typeof createGameSim>} GameSim */
/** @typedef {ReturnType<GameSim['checkpoint']>} Checkpoint */

// ─── Journey helpers: drive the game the way a player would ──────────────────

const TILE = { STAIRS: 3, TERMINAL: 4, MESSAGE_CONSOLE: 27 };
const RESTING_STATES = new Set(['PLAYING', 'MAINFRAME_READER', 'GAME_OVER', 'VICTORY', 'NAME_ENTRY', 'MENU']);

/** @param {GameSim} sim @param {string} expected @param {string} step */
function expectState(sim, expected, step) {
  const state = sim.state();
  if (state !== expected) throw new Error(`journey step "${step}": expected state ${expected}, got ${state}`);
}

/**
 * Answers modal states until the game rests in PLAYING or an end state.
 * @param {GameSim} sim
 */
function settle(sim) {
  for (let i = 0; i < 200; i++) {
    const s = sim.state();
    if (s && RESTING_STATES.has(s)) return s;
    if (s === 'INTRO') sim.key('Escape');
    else if (s === 'SYSTEM_MESSAGE') { sim.frames(45); sim.key('KeyX'); }
    else if (s === 'HUB') { sim.frames(20); sim.key('Space'); }
    else if (s && /CHOICE|SWAP/.test(s)) { sim.frames(30); sim.key('Enter'); }
    else if (s === 'READING' || s === 'SHOPPING' || s === 'MESSAGE_SEND') { sim.frames(20); sim.key('Escape'); }
    else sim.frames(10);
  }
  throw new Error(`journey: stuck in ${sim.state()}`);
}

/**
 * Settles after arriving somewhere, dismissing the floor banner with a key
 * that has no binding, as a player would.
 * @param {GameSim} sim
 */
function arrive(sim) {
  settle(sim);
  sim.frames(10);
  if (sim.eval('game.modBannerTimer > 0 || game.biomeCardTimer > 0')) sim.key('KeyC');
  return settle(sim);
}

/**
 * Activates the highlighted menu row. On a first visit the first activation
 * only unlocks the title music, as in a real browser, so repeat it once.
 * @param {GameSim} sim @param {() => void} press
 */
function activateMenuRow(sim, press) {
  press();
  sim.frames(10);
  if (sim.state() === 'MENU') {
    press();
    sim.frames(10);
  }
}

/** @param {GameSim} sim @param {string} seed */
function startRun(sim, seed) {
  expectState(sim, 'MENU', 'start run');
  activateMenuRow(sim, () => sim.key('Enter'));
  expectState(sim, 'SEED_SETUP', 'open seed setup');
  for (let i = 0; i < 20; i++) sim.key('Backspace');
  sim.type(seed);
  sim.key('Enter');
  sim.frames(10);
  arrive(sim);
  expectState(sim, 'PLAYING', 'start run');
}

/** @param {GameSim} sim @param {number} tile @returns {[number, number] | null} */
function findTile(sim, tile) {
  return sim.eval(`(() => {
    const m = game.dungeon.map;
    for (let y = 0; y < m.length; y++) for (let x = 0; x < m[y].length; x++) if (m[y][x] === ${tile}) return [x, y];
    return null;
  })()`);
}

/** Moves the player onto a tile's center. @param {GameSim} sim @param {[number, number]} at */
function teleport(sim, at) {
  sim.eval(`game.player.x = ${at[0]} + 0.5; game.player.y = ${at[1]} + 0.5;`);
  sim.frames(3);
}

/** @param {GameSim} sim */
function killBosses(sim) {
  sim.eval('for (const e of enemies) if (e.isBoss && !e.dead) e.takeDamage(1e9, game.player);');
  sim.frames(60);
  settle(sim);
}

/**
 * Walks onto the exit and presses interact. A story beat can fire when the
 * player reaches the exit, so answer it and press again.
 * @param {GameSim} sim
 */
function descend(sim) {
  const floor = sim.eval('game.floor');
  for (let attempt = 0; attempt < 3; attempt++) {
    const exit = findTile(sim, TILE.STAIRS) || findTile(sim, TILE.TERMINAL);
    if (!exit) throw new Error(`journey: floor ${floor} has no exit`);
    teleport(sim, exit);
    settle(sim);
    sim.key('KeyE');
    sim.frames(5);
    const state = arrive(sim);
    if (state !== 'PLAYING' || sim.eval('game.floor') !== floor) return state;
  }
  throw new Error(`journey: could not descend from floor ${floor}`);
}

/** @param {GameSim} sim @param {string[]} digits */
function enableCheats(sim, digits) {
  for (const code of ['KeyF', 'KeyE', 'KeyE', 'ShiftLeft']) sim.key(code);
  expectState(sim, 'CHEATS', 'cheat hatch');
  sim.frames(2);
  for (const d of digits) sim.key(d);
  sim.key('Escape');
  expectState(sim, 'PLAYING', 'close cheats');
}

/**
 * Stands two tiles from the nearest ordinary enemy and aims at it. The enemy
 * is left in the page as __simTarget.
 * @param {GameSim} sim
 */
function faceNearestEnemy(sim) {
  const target = sim.eval(`(() => {
    const p = game.player, m = game.dungeon.map;
    const open = (x, y) => m[Math.floor(y)] && m[Math.floor(y)][Math.floor(x)] === 2;
    let best = null, bestD = Infinity;
    for (const e of enemies) {
      if (e.dead || e.isBoss) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) return null;
    window.__simTarget = best;
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) {
      if (open(best.x + dx, best.y + dy) && open(best.x + dx / 2, best.y + dy / 2)) return [best.x + dx, best.y + dy, -dx / 2, -dy / 2];
    }
    return null;
  })()`);
  if (!target) throw new Error('journey: no reachable enemy to face');
  sim.eval(`game.player.x = ${target[0]}; game.player.y = ${target[1]};`);
  sim.frames(20);
  return { dx: target[2], dy: target[3] };
}

/**
 * Kills the nearest ordinary enemy with one lethal hit through its own damage
 * and death code, so combo, score and drops run as for a player kill.
 * @param {GameSim} sim
 */
function killNearest(sim) {
  const killed = sim.eval(`(() => {
    const p = game.player;
    let best = null, bestD = Infinity;
    for (const e of enemies) {
      if (e.dead || e.isBoss || e._summoned || e.isShard) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) return false;
    best.takeDamage(1e9, game.player);
    return !!best.dead || best.hp <= 0;
  })()`);
  if (!killed) throw new Error('journey: no ordinary enemy to kill');
  sim.frames(1);
}

/**
 * Dashes right through the first open run of floor, so the whole dash moves
 * the player instead of stopping at a wall.
 * @param {GameSim} sim
 */
function dashAcrossRoom(sim) {
  const at = sim.eval(`(() => {
    const m = game.dungeon.map, open = (x, y) => m[y] && m[y][x] === 2;
    for (let y = 1; y < m.length - 1; y++) {
      for (let x = 1; x < m[y].length - 12; x++) {
        let ok = true;
        for (let k = 0; k < 12 && ok; k++) ok = open(x + k, y) && open(x + k, y - 1) && open(x + k, y + 1);
        if (ok) return [x, y];
      }
    }
    return null;
  })()`);
  if (!at) throw new Error('journey: no open run of floor to dash across');
  teleport(sim, at);
  for (let i = 0; i < 120 && sim.eval('game.player.dashCooldown > 0'); i++) sim.frames(1);
  sim.down('KeyD');
  sim.frames(2);
  sim.key('ShiftLeft');
  sim.frames(20);
  sim.up('KeyD');
  sim.frames(2);
}

/**
 * Runs `fight` with invulnerability off and a 5000 health buffer, so enemy
 * damage shows in the player's health, then takes the buffer away. Health
 * returns to its value before the fight; a level gained during the fight keeps
 * its extra maximum health and heals to full, as gainXP does. Invulnerability
 * returns to what it was.
 * @param {GameSim} sim @param {() => void} fight
 */
function withHealthBuffer(sim, fight) {
  const before = sim.eval(`JSON.stringify({
    hp: game.player.hp, maxHp: game.player.maxHp, level: game.player.level, invulnerable: !!game.cheats.invulnerable })`);
  sim.eval('game.cheats.invulnerable = false; game.player.maxHp = 5000; game.player.hp = 5000;');
  try {
    fight();
  } finally {
    sim.eval(`(() => {
      const b = ${before}, p = game.player;
      p.maxHp = b.maxHp + (p.maxHp - 5000);
      p.hp = p.level > b.level ? p.maxHp : Math.min(b.hp, p.maxHp);
      game.cheats.invulnerable = b.invulnerable;
    })()`);
    sim.frames(1);
  }
}

/**
 * Wounds the floor's boss to `fraction` of its health and lets it fight the
 * player, standing nearby, for `frames` frames. Bosses change phase by health:
 * 32% is phase two for every boss (the SENTINEL enters it at 33%, the HIVE
 * between 70% and 30%) and 25% is the HIVE's phase three.
 * @param {GameSim} sim @param {number} fraction @param {number} frames
 */
function bossFight(sim, fraction, frames) {
  const near = sim.eval(`(() => {
    const b = enemies.find((e) => e.isBoss && !e.dead);
    if (!b) return null;
    b.hp = b.maxHp * ${fraction};
    const m = game.dungeon.map;
    for (let r = 3; r < 8; r++) {
      for (const [dx, dy] of [[-r, 0], [r, 0], [0, -r], [0, r]]) {
        const x = Math.floor(b.x + dx), y = Math.floor(b.y + dy);
        if (m[y] && m[y][x] === 2) return [x, y];
      }
    }
    return null;
  })()`);
  if (!near) throw new Error('journey: no living boss with open floor near it');
  teleport(sim, near);
  sim.frames(frames);
  settle(sim);
}

/**
 * @typedef {object} Journey
 * @property {SimOptions} options
 * @property {(sim: GameSim, mark: (label: string, s?: GameSim) => void, spawn: (opts: SimOptions) => GameSim) => void} run
 */

/** @type {Record<string, Journey>} */
const JOURNEYS = {
  'menus-desktop': {
    options: { width: 1280, height: 800 },
    run(sim, mark, spawn) {
      sim.frames(60);
      mark('menu');
      sim.key('ArrowRight');
      sim.frames(5);
      mark('difficulty right');
      sim.key('ArrowLeft');
      sim.key('ArrowDown');
      sim.key('Enter');
      sim.frames(30);
      expectState(sim, 'ARCHIVES', 'open archives');
      mark('archives');
      sim.key('ArrowDown');
      sim.key('ArrowRight');
      sim.key('ArrowDown');
      sim.frames(10);
      mark('archives browsed');
      sim.key('Escape');
      sim.frames(20);
      expectState(sim, 'MENU', 'leave archives');
      sim.key('ArrowDown');
      sim.key('ArrowDown');
      sim.key('Enter');
      sim.frames(20);
      expectState(sim, 'SETTINGS', 'open settings');
      mark('settings');
      sim.key('ArrowDown');
      sim.key('ArrowDown');
      sim.key('ArrowRight');
      sim.frames(10);
      mark('settings changed');
      sim.key('Escape');
      sim.frames(20);
      expectState(sim, 'MENU', 'leave settings');
      // A desktop click activates the highlighted row wherever it lands:
      // clicking NEURAL ARCHIVES opens seed setup for BOOT SESSION.
      sim.clickText(/NEURAL ARCHIVES/);
      sim.frames(20);
      expectState(sim, 'SEED_SETUP', 'click on menu');
      mark('menu click');
      sim.key('Escape');
      sim.frames(20);
      expectState(sim, 'MENU', 'back from seed setup');
      sim.wheel(640, 400, 240);
      sim.frames(30);
      mark('menu again');
      const offline = spawn({ offline: true, storage: { neonDungeonReleaseVersion: '9.8.7' } });
      offline.frames(60);
      mark('offline menu shows the cached version', offline);
    },
  },

  'run-desktop': {
    options: { width: 1280, height: 800 },
    run(sim, mark, spawn) {
      sim.frames(30);
      startRun(sim, 'ORACLE-1');
      mark('playing');
      sim.hold('KeyD', 45);
      sim.hold('KeyS', 45);
      mark('walked');
      sim.mouseMove(800, 360);
      sim.hold('Space', 40);
      mark('shot at cursor');
      sim.key('ShiftLeft');
      sim.frames(20);
      mark('dashed');
      dashAcrossRoom(sim);
      mark('dashed across a room');
      sim.key('Tab');
      sim.frames(20);
      mark('map open');
      sim.key('Tab');
      sim.frames(10);
      const aim = faceNearestEnemy(sim);
      sim.mouseMove(640 + aim.dx * 160, 400 + aim.dy * 160);
      sim.hold('Space', 90);
      mark('fought');
      sim.frames(120);
      mark('aftermath');
      killNearest(sim);
      sim.frames(60);
      killNearest(sim);
      mark('two kills inside the combo window');
      sim.frames(210);
      killNearest(sim);
      mark('a kill after the combo window');
      sim.key('KeyQ');
      sim.key('Digit2');
      sim.key('KeyV');
      sim.key('KeyF');
      sim.frames(30);
      mark('ability keys');
      sim.key('Escape');
      sim.frames(10);
      expectState(sim, 'PAUSED', 'pause');
      mark('paused');
      sim.key('KeyS');
      sim.frames(10);
      expectState(sim, 'SETTINGS', 'settings from pause');
      mark('settings from pause');
      sim.key('Escape');
      sim.frames(10);
      sim.key('Escape');
      sim.frames(10);
      expectState(sim, 'PLAYING', 'unpause');
      mark('unpaused');
      sim.hide();
      sim.frames(2);
      mark('backgrounded');

      const resumed = spawn({ storage: sim.storage() });
      resumed.frames(60);
      expectState(resumed, 'MENU', 'boot with save');
      mark('menu with save', resumed);
      activateMenuRow(resumed, () => resumed.key('Enter'));
      arrive(resumed);
      expectState(resumed, 'PLAYING', 'resume');
      mark('resumed', resumed);
      resumed.down('KeyD');
      resumed.frames(2);
      resumed.stall(1000);
      resumed.frames(1);
      resumed.up('KeyD');
      resumed.frames(2);
      mark('moved through a one-second stall', resumed);
      resumed.eval('game.player.hp = 1;');
      faceNearestEnemy(resumed);
      for (let i = 0; i < 40 && resumed.state() === 'PLAYING'; i++) resumed.frames(30);
      mark('died', resumed);
      for (let i = 0; i < 20 && resumed.state() !== 'MENU'; i++) {
        if (resumed.state() === 'NAME_ENTRY') { resumed.type('SIM'); resumed.key('Enter'); }
        else { resumed.frames(60); resumed.key('Enter'); }
        resumed.frames(20);
      }
      expectState(resumed, 'MENU', 'back to menu after death');
      mark('menu after death', resumed);
    },
  },

  'crawl-desktop': {
    options: { width: 1280, height: 800 },
    run(sim, mark) {
      sim.frames(30);
      startRun(sim, 'ORACLE-2');
      enableCheats(sim, ['Digit1', 'Digit3']);
      for (let floor = 1; floor <= 15; floor++) {
        if (sim.eval('game.floor') !== floor) throw new Error(`journey: expected floor ${floor}, on ${sim.eval('game.floor')}`);
        mark(`floor ${floor}`);
        if (sim.eval('!!game.bossAlive')) {
          if (floor === 3 || floor === 6) {
            withHealthBuffer(sim, () => {
              bossFight(sim, 0.32, 600);
              mark(`floor ${floor} boss in phase two`);
              if (floor === 6) {
                bossFight(sim, 0.25, 300);
                mark('floor 6 boss in phase three');
              }
            });
          }
          killBosses(sim);
          mark(`floor ${floor} boss down`);
        }
        const state = descend(sim);
        if (state !== 'PLAYING') {
          expectState(sim, 'MAINFRAME_READER', 'final terminal');
          break;
        }
      }
      mark('mainframe');
      for (let i = 0; i < 12; i++) {
        for (let presses = 0; sim.eval('game.mainframeFinale.selected') < i; presses++) {
          if (presses >= 12) throw new Error(`journey: ArrowDown did not reach mainframe record ${i + 1}`);
          sim.key('ArrowDown');
        }
        sim.key('Enter');
        sim.frames(20);
        sim.key('Enter');
        sim.frames(5);
      }
      mark('records read');
      sim.key('Escape');
      sim.frames(5);
      const consoleTile = findTile(sim, TILE.MESSAGE_CONSOLE);
      if (!consoleTile) throw new Error('journey: no message console on the final floor');
      teleport(sim, consoleTile);
      sim.key('KeyE');
      sim.frames(5);
      expectState(sim, 'MESSAGE_SEND', 'message console');
      mark('composing');
      sim.key('Digit2');
      sim.key('Enter');
      sim.frames(5);
      mark('message sent');
      for (let i = 0; i < 40 && sim.state() !== 'MENU'; i++) {
        const s = sim.state();
        if (s === 'NAME_ENTRY') { sim.type('SIM'); sim.key('Enter'); }
        else if (s === 'VICTORY') { sim.frames(120); sim.key('Enter'); }
        else sim.frames(30);
        if (s === 'MAINFRAME_READER' && i > 3) sim.key('Enter');
      }
      expectState(sim, 'MENU', 'menu after victory');
      mark('menu after victory');
    },
  },

  'seeds-desktop': {
    options: { width: 1280, height: 800 },
    run(sim, mark, spawn) {
      for (const [seed, difficultyKey] of /** @type {const} */ ([['ALPHA', null], ['BRAVO', 'ArrowLeft'], ['CHARLIE', 'ArrowRight']])) {
        const s = seed === 'ALPHA' ? sim : spawn({});
        s.frames(30);
        if (difficultyKey) s.key(difficultyKey);
        startRun(s, seed);
        s.frames(30);
        mark(`seed ${seed}`, s);
      }
    },
  },

  'touch-portrait': {
    options: { width: 390, height: 844, touch: true, insets: { top: 47, bottom: 34 } },
    run(sim, mark) {
      sim.frames(60);
      mark('menu');
      activateMenuRow(sim, () => sim.tapText(/BOOT SESSION/));
      expectState(sim, 'SEED_SETUP', 'tap boot session');
      mark('seed setup');
      sim.tapText(/^START$/);
      sim.frames(20);
      for (let i = 0; i < 12 && sim.state() === 'INTRO'; i++) {
        sim.tap(195, 600);
        sim.frames(50);
      }
      expectState(sim, 'SYSTEM_MESSAGE', 'intro tapped through');
      mark('first message');
      sim.tapText(/^TAP ACK$/);
      sim.frames(30);
      arrive(sim);
      expectState(sim, 'PLAYING', 'acknowledged');
      mark('playing');
      sim.touchStart(1, 80, 700);
      sim.frames(2);
      sim.touchMove(1, 140, 700);
      sim.frames(45);
      sim.touchEnd(1);
      sim.frames(5);
      mark('joystick');
      sim.touchStart(2, 300, 500);
      sim.frames(2);
      sim.touchMove(2, 340, 470);
      sim.frames(40);
      sim.touchEnd(2);
      sim.frames(5);
      mark('aim and fire');
      sim.tapText(/^⇧$/);
      sim.frames(20);
      mark('dash button');
      sim.resize(844, 390);
      sim.frames(30);
      mark('rotated to landscape');
      sim.resize(390, 844);
      sim.frames(30);
      mark('rotated back');
      sim.tapText(/^II$/);
      sim.frames(20);
      expectState(sim, 'PAUSED', 'pause button');
      mark('pause button');
    },
  },

  'touch-landscape': {
    options: { width: 844, height: 390, touch: true, insets: { left: 47, right: 47, bottom: 21 } },
    run(sim, mark) {
      sim.frames(60);
      mark('menu');
      activateMenuRow(sim, () => sim.tapText(/BOOT SESSION/));
      expectState(sim, 'SEED_SETUP', 'tap boot session');
      sim.tapText(/^START$/);
      sim.frames(20);
      for (let i = 0; i < 12 && sim.state() === 'INTRO'; i++) {
        sim.tap(420, 200);
        sim.frames(50);
      }
      sim.tapText(/^TAP ACK$/);
      sim.frames(30);
      arrive(sim);
      expectState(sim, 'PLAYING', 'landscape start');
      mark('playing');
      sim.touchStart(1, 120, 300);
      sim.frames(2);
      sim.touchMove(1, 120, 250);
      sim.frames(45);
      sim.touchEnd(1);
      sim.frames(5);
      mark('joystick');
    },
  },
};

/**
 * Plays one journey and returns its checkpoints.
 * @param {string} name
 * @param {{ root?: string, keep?: boolean, transform?: SimOptions['transform'] }} [opts]
 * @returns {Checkpoint[]}
 */
function runJourney(name, opts = {}) {
  const journey = JOURNEYS[name];
  if (!journey) throw new Error(`unknown journey "${name}"; known: ${Object.keys(JOURNEYS).join(', ')}`);
  const base = { ...journey.options, ...opts };
  const sim = createGameSim(base);
  /** @type {Checkpoint[]} */
  const trace = [];
  journey.run(sim, (label, s = sim) => { trace.push(s.checkpoint(label)); }, (extra) => createGameSim({ ...base, ...extra }));
  return trace;
}

/** @returns {Record<string, Checkpoint[]>} */
function readGolden() {
  return fs.existsSync(GOLDEN_FILE) ? JSON.parse(fs.readFileSync(GOLDEN_FILE, 'utf8')) : {};
}

/** @param {Record<string, Checkpoint[]>} golden */
function writeGolden(golden) {
  const names = Object.keys(golden).sort();
  const lines = ['{'];
  names.forEach((name, i) => {
    const trace = golden[name] || [];
    lines.push(`  ${JSON.stringify(name)}: [`);
    trace.forEach((rec, j) => lines.push('    ' + JSON.stringify(rec) + (j < trace.length - 1 ? ',' : '')));
    lines.push('  ]' + (i < names.length - 1 ? ',' : ''));
  });
  lines.push('}');
  fs.mkdirSync(path.dirname(GOLDEN_FILE), { recursive: true });
  fs.writeFileSync(GOLDEN_FILE, lines.join('\n') + '\n');
}

/**
 * The first checkpoint where two traces disagree, or null when they match.
 * @param {object[]} expected
 * @param {object[]} actual
 */
function firstDifference(expected, actual) {
  const n = Math.max(expected.length, actual.length);
  for (let i = 0; i < n; i++) {
    const e = /** @type {Record<string, unknown> | undefined} */ (expected[i]);
    const a = /** @type {Record<string, unknown> | undefined} */ (actual[i]);
    if (!e || !a) return { index: i, label: String((e || a || {}).at), fields: e ? ['missing checkpoint'] : ['extra checkpoint'], expected: e || null, actual: a || null };
    const fields = [...new Set([...Object.keys(e), ...Object.keys(a)])].filter((k) => JSON.stringify(e[k]) !== JSON.stringify(a[k]));
    if (fields.length) return { index: i, label: String(e.at), fields, expected: e, actual: a };
  }
  return null;
}

/**
 * Extracts `ref` into a temp directory and returns its path.
 * @param {string} ref
 */
function checkoutRef(ref) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nd-golden-'));
  try {
    const tar = execFileSync('git', ['-C', ROOT, 'archive', '--format=tar', ref], { maxBuffer: 1 << 30 });
    execFileSync('tar', ['-x', '-C', dir], { input: tar });
    return dir;
  } catch (err) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw err;
  }
}

/**
 * Plays a journey on `ref` and on the working tree, and prints the first
 * checkpoint and stream entries where they part.
 * @param {string} name
 * @param {string} ref
 */
function diffJourney(name, ref) {
  const dir = checkoutRef(ref);
  try {
    const base = runJourney(name, { root: dir });
    const here = runJourney(name);
    const diff = firstDifference(base, here);
    if (!diff) {
      console.log(`${name}: identical to ${ref} (${here.length} checkpoints)`);
      return;
    }
    console.log(`${name}: first difference at checkpoint ${diff.index} "${diff.label}" in ${diff.fields.join(', ')}`);
    console.log(`  ${ref}:  ${JSON.stringify(diff.expected)}`);
    console.log(`  tree: ${JSON.stringify(diff.actual)}`);
    const baseKept = runJourney(name, { root: dir, keep: true })[diff.index];
    const hereKept = runJourney(name, { keep: true })[diff.index];
    if (!baseKept || !hereKept) return;
    for (const stream of /** @type {const} */ (['draw', 'audio', 'net', 'store', 'logs'])) {
      const a = /** @type {any} */ (baseKept).entries[stream];
      const b = /** @type {any} */ (hereKept).entries[stream];
      let i = 0;
      while (i < a.length && i < b.length && a[i] === b[i]) i++;
      if (i === a.length && i === b.length) continue;
      console.log(`  ${stream}: first differing entry #${i} of ${a.length} vs ${b.length}`);
      if (stream === 'store') {
        // Stored values can be whole saves; show the key and where the value parts.
        const x = String(a[i] ?? '');
        const y = String(b[i] ?? '');
        let c = 0;
        while (c < x.length && c < y.length && x[c] === y[c]) c++;
        console.log(`    ${ref}: ${x.slice(0, x.indexOf('=') + 1)} …${x.slice(Math.max(0, c - 60), c + 60)}`);
        console.log(`    tree: ${y.slice(0, y.indexOf('=') + 1)} …${y.slice(Math.max(0, c - 60), c + 60)}`);
        continue;
      }
      for (let k = Math.max(0, i - 3); k < i + 3; k++) {
        if (a[k] === undefined && b[k] === undefined) continue;
        console.log(`    ${k === i ? '>' : ' '} ${ref}: ${String(a[k]).slice(0, 160)}`);
        console.log(`    ${k === i ? '>' : ' '} tree: ${String(b[k]).slice(0, 160)}`);
      }
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const HELP = `Usage: node tests/_game-sim.js <command>

  list                    Name every journey.
  trace <journey>         Play a journey and print its checkpoints.
  update [journey...]     Re-record goldens (all journeys by default). Only do
                          this for an intended behavior change, and say why in
                          the PR. Refuses to drop the golden of a deleted
                          journey unless --prune is given.
  diff <journey> [ref]    Play a journey on ref (default origin/develop) and on
                          the working tree, then print the first checkpoint and
                          draw/audio entries where they differ.`;

/** @param {string[]} argv */
function main(argv) {
  const [cmd, ...args] = argv;
  if (cmd === 'list') {
    console.log(Object.keys(JOURNEYS).join('\n'));
  } else if (cmd === 'trace' && args[0]) {
    for (const rec of runJourney(args[0])) console.log(JSON.stringify(rec));
  } else if (cmd === 'update') {
    const golden = readGolden();
    const prune = args.includes('--prune');
    const names = args.filter((a) => a !== '--prune');
    const stale = Object.keys(golden).filter((name) => !JOURNEYS[name]);
    if (stale.length && !prune) throw new Error(`goldens without a journey: ${stale.join(', ')}. Pass --prune to delete them on purpose.`);
    for (const name of stale) delete golden[name];
    for (const name of names.length ? names : Object.keys(JOURNEYS)) {
      const trace = runJourney(name);
      if (!trace.length) throw new Error(`journey "${name}" recorded no checkpoints`);
      const diff = firstDifference(golden[name] || [], trace);
      golden[name] = trace;
      console.log(`${name}: ${diff ? `changed from checkpoint ${diff.index} "${diff.label}"` : 'unchanged'}`);
    }
    writeGolden(golden);
  } else if (cmd === 'diff' && args[0]) {
    diffJourney(args[0], args[1] || 'origin/develop');
  } else {
    console.log(HELP);
    if (cmd && cmd !== 'help') process.exitCode = 1;
  }
}

if (require.main === module) main(process.argv.slice(2));

/** Player actions journeys are built from, for tests that script their own play. */
const play = { activateMenuRow, startRun, settle, arrive, descend, enableCheats, killNearest, killBosses, findTile, teleport, withHealthBuffer };

module.exports = {
  ROOT,
  GOLDEN_FILE,
  FRAME_MS,
  SIM_VERSION,
  play,
  JOURNEYS,
  createGameSim,
  runJourney,
  readGolden,
  writeGolden,
  firstDifference,
  checkoutRef,
  digestOf,
  fmt,
};
