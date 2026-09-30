#!/usr/bin/env node
// @ts-check
'use strict';

// NEON DUNGEON verification harness. Read ../SKILL.md first. From the repo root:
//
//   node .github/skills/verify-neon-dungeon/scripts/verify.js launch [--root DIR] [--run-dir DIR] [--name NAME]
//   node .github/skills/verify-neon-dungeon/scripts/verify.js doctor (--run-dir DIR | --url URL) [--viewport V] [--touch]
//   node .github/skills/verify-neon-dungeon/scripts/verify.js drive <script.js> (--run-dir DIR | --url URL) [--viewport V] [--touch] [--name NAME] [--timeout SECONDS]
//   node .github/skills/verify-neon-dungeon/scripts/verify.js stop --run-dir DIR
//
// Exit codes: 0 pass, 1 failed check / error / unexpected page error, 2 usage.

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');

const SKILL_DIR = path.resolve(__dirname, '..');
const DEFAULT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SERVE_SCRIPT = path.join(__dirname, 'verify-serve.js');
const { parseServeArgs } = require('./verify-serve.js');
const DRIVES_DIR = path.join(SKILL_DIR, 'features', 'drives');
const INSTALL_HINT = 'npx playwright-core install chromium';
const LOCAL_VERSION = '0.0.0-local';
const FRAME_TIMEOUT_MS = 5000;
const COMMANDS = Object.freeze(['launch', 'doctor', 'drive', 'stop']);

/**
 * @typedef {{ state: string | null, floor: number | null, hp: number | null, x: number | null, y: number | null,
 *   W: number, H: number, compact: boolean, zoom: number, seed: string | null }} StateSnapshot
 * @typedef {{ label: string, width: number, height: number, isMobile: boolean }} Viewport
 * @typedef {{ root?: string, runDir?: string, url?: string, viewport?: string, name?: string, timeout?: string, touch?: boolean }} CliFlags
 * @typedef {{ command: string, positional: string[], flags: CliFlags }} ParsedArgs
 * @typedef {{ pid: number, url: string | null, status: 'starting' | 'ready', root: string, runDir: string, startedAt: string, head: string,
 *   token: string }} ServerRecord
 *   token: random per launch, also written into launch.lock; cleanup removes a lock or record only while it still carries it
 * @typedef {{ left: number, top: number, width: number, height: number, canvasWidth: number, canvasHeight: number, zoom: number }} CanvasGeometry
 * @typedef {{ path: string, source: string, warning?: string }} ChromiumChoice
 * @typedef {{ type: string, text: string, url?: string }} ConsoleLike
 * @typedef {{ i: number, t: number, kind: string, label: string, step: string | null, [key: string]: unknown }} TranscriptEntry
 * @typedef {{ left: number, top: number, right: number, bottom: number }} Box
 * @typedef {{ text: string, client: { x: number, y: number }, logical: { x: number, y: number }, box: Box }} FoundText
 *   a drawn label: its centre in client (CSS) pixels and logical game coordinates, and its ink box in logical coordinates
 * @typedef {{ text: string, x: number, y: number, alpha: number, fill?: string, filter?: string, align?: string,
 *   ax?: number, ay?: number, box?: Box }} DrawnText
 *   one string drawn on the main canvas: visual centre (x, y), anchor (ax, ay) and the axis-aligned bounding box of
 *   its transformed ink box, all in backing-store pixels; alpha is globalAlpha, fill the fill/stroke style, filter the
 *   canvas filter
 * @typedef {{ x: number, y: number, maxWidth?: number, align: string, baseline: string, direction?: string,
 *   width: number, ascent?: number, descent?: number, fontSize?: number,
 *   matrix: { a: number, b: number, c: number, d: number, e: number, f: number } }} TextDraw
 *   one fillText/strokeText call: its arguments, the context's text state, measureText metrics and the transform
 * @typedef {{ status: 'PASS' | 'FAIL' | 'INFO', name: string, detail: string }} CheckRow
 */

/**
 * The object a drive script receives: `module.exports = async (h) => { ... }`.
 * Every input method drives the real page (keyboard, mouse, touch). `setup`
 * and `observe` both run arbitrary page code: by convention only `setup`
 * writes game internals (labelled SETUP in the transcript), and any
 * code-running call made through `h.page` is also recorded as SETUP.
 * @typedef {Object} Harness
 * @property {import('playwright-core').Page} page escape hatch: the Playwright page (evaluate-style calls are recorded as SETUP)
 * @property {string} url the served game URL
 * @property {boolean} touch true when the context has touch (tapLogical taps instead of clicking)
 * @property {() => Promise<StateSnapshot>} state snapshot: state, floor, hp, x, y, W, H, compact, zoom, seed
 * @property {(names: string | string[], ms?: number) => Promise<StateSnapshot>} waitForState wait until game.state is one of names
 * @property {(key: string, opts?: { times?: number, gap?: number, hold?: number }) => Promise<void>} press keyboard press by KeyboardEvent.code-style name (Enter, KeyX, ArrowDown, Digit1)
 * @property {(key: string, ms: number) => Promise<void>} hold hold a key down for ms
 * @property {(text: string) => Promise<void>} type type text into whatever has focus
 * @property {(x: number, y: number) => Promise<void>} tapLogical tap (touch) or click (mouse) a point in logical game coordinates
 * @property {(pattern: RegExp | string, opts?: { timeoutMs?: number }) => Promise<FoundText>} findText locate a label drawn visibly on the canvas in the last frame (topmost match; effective alpha above 0.05); throws listing the visible strings
 * @property {(pattern: RegExp | string) => Promise<FoundText>} tapText find a label and tap it (touch contexts) or click it (mouse)
 * @property {(pattern: RegExp | string) => Promise<FoundText>} clickText find a label and click it with the mouse
 * @property {() => Promise<FoundText[]>} visibleTexts every visible string drawn on the canvas in the last frame
 * @property {(label: RegExp | string, value: RegExp | string, opts?: { within?: number }) => Promise<FoundText>} rowText the value string drawn in a label's row and value column (centre within `within` logical px vertically, right of the label, inside the band mirrored from the label's left edge)
 * @property {(label: RegExp | string, key: string, opts?: { max?: number }) => Promise<void>} highlight press key until the label is drawn highlighted (a colour no other label in its row or column uses)
 * @property {(label: string) => Promise<string>} shot screenshot into the evidence dir; returns the file path
 * @property {<T>(label: string, fn: () => Promise<T>) => Promise<T>} step run fn and record state before/after plus a screenshot
 * @property {(cond: unknown, msg: string, detail?: unknown) => void} check record a check; throws when cond is falsy
 * @property {(label: string, fn: (arg: any) => any, arg?: any) => Promise<any>} setup page.evaluate that WRITES game state; recorded as SETUP, never proof
 * @property {(label: string, fn: (arg: any) => any, arg?: any) => Promise<any>} observe read-only page.evaluate, recorded as an observation
 * @property {(key: string) => Promise<any>} storage read one localStorage key (JSON-parsed when possible)
 * @property {(n?: number) => Promise<void>} frames wait n animation frames; throws if no frame runs within 5 s
 * @property {(ms: number) => Promise<void>} sleep wait ms
 * @property {(text: string) => void} note add a free-text note to the transcript
 * @property {() => Promise<StateSnapshot>} reload reload the page (a player closing and reopening the tab) and wait for MENU
 * @property {(prefix: string) => Promise<StateSnapshot>} menuSelect activate the MENU row whose label starts with prefix (RESUME SESSION, BOOT SESSION, NEURAL ARCHIVES, SETTINGS)
 * @property {(opts?: { seed?: string }) => Promise<StateSnapshot>} bootRun MENU -> BOOT SESSION -> seed -> INTRO -> prompts -> PLAYING
 * @property {() => Promise<number>} ackMessages acknowledge open RUNTIME SYSTEM PROMPT dialogs; returns how many
 * @property {(rows: string[]) => Promise<void>} openCheats open the FEET hatch and turn ONLINE the rows with these drawn names (INVULNERABILITY, NO-CLIP, SHOW MAP, HYPER MODE)
 * @property {(tx: number, ty: number, opts?: { timeoutMs?: number }) => Promise<StateSnapshot>} walkTo walk to a map tile with arrow keys (or the touch joystick)
 * @property {() => Promise<StateSnapshot>} takeStairs walk onto the stairs, press USE, leave THE GAP hub, arrive on the next floor
 * @property {() => Promise<StateSnapshot>} quitToMenu pause and choose QUIT TO MENU
 */

class UsageError extends Error {}
class CheckError extends Error {}
/** Refusal to act on a run dir whose records or server cannot be trusted as this run's. Exit 2. */
class RefusedError extends Error {}

// ─── Pure helpers (unit-tested in tests/verify.test.js) ─────────────────────

/** @type {Readonly<Record<string, keyof CliFlags>>} */
const VALUE_FLAGS = Object.freeze({
  '--root': 'root',
  '--run-dir': 'runDir',
  '--url': 'url',
  '--viewport': 'viewport',
  '--name': 'name',
  '--timeout': 'timeout',
});

/**
 * @param {string[]} argv arguments after `verify.js`
 * @returns {ParsedArgs}
 */
function parseArgs(argv) {
  const command = argv[0];
  if (!command || !COMMANDS.includes(command)) {
    throw new UsageError(`expected a command (${COMMANDS.join(' | ')}), got ${command === undefined ? 'nothing' : JSON.stringify(command)}`);
  }
  /** @type {Record<string, string | boolean>} */
  const flags = {};
  /** @type {string[]} */
  const positional = [];
  for (let i = 1; i < argv.length; i++) {
    const arg = /** @type {string} */ (argv[i]);
    if (arg === '--touch') { flags.touch = true; continue; }
    if (arg.startsWith('--')) {
      const key = VALUE_FLAGS[arg];
      if (!key) throw new UsageError(`unknown flag ${arg}`);
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) throw new UsageError(`${arg} needs a value`);
      flags[key] = value;
      i++;
      continue;
    }
    positional.push(arg);
  }
  return { command, positional, flags: /** @type {CliFlags} */ (flags) };
}

/** @type {Readonly<Record<string, Readonly<{ width: number, height: number, isMobile: boolean }>>>} */
const VIEWPORTS = Object.freeze({
  desktop: Object.freeze({ width: 1280, height: 800, isMobile: false }),
  phone: Object.freeze({ width: 390, height: 844, isMobile: true }),
  'phone-landscape': Object.freeze({ width: 844, height: 390, isMobile: true }),
});

/**
 * @param {string} spec desktop | phone | phone-landscape | WxH
 * @returns {Viewport}
 */
function parseViewport(spec) {
  const preset = VIEWPORTS[spec];
  if (preset) return { label: spec, ...preset };
  const m = /^(\d{2,5})x(\d{2,5})$/.exec(spec);
  if (!m) throw new UsageError(`--viewport must be desktop, phone, phone-landscape or WxH, got ${JSON.stringify(spec)}`);
  return { label: spec, width: Number(m[1]), height: Number(m[2]), isMobile: false };
}

/**
 * Canvas backing-store pixels to CSS client pixels:
 * client = rect.left + x * rect.width / canvas.width.
 * @param {{ x: number, y: number }} point backing-store pixels (what ctx.getTransform() maps into)
 * @param {CanvasGeometry} geom canvas bounding rect and backing size
 * @returns {{ x: number, y: number }}
 */
function backingToClient(point, geom) {
  return {
    x: geom.left + point.x * geom.width / geom.canvasWidth,
    y: geom.top + point.y * geom.height / geom.canvasHeight,
  };
}

/**
 * Inverse of the game's pointer mapping (src/platform.js updateMouseFromClient
 * and toCanvas): logical = (client - rect.left) * canvas.width / rect.width / worldZoom.
 * @param {{ x: number, y: number }} point logical game coordinates (the space of W, H, mouse.x and every layout helper)
 * @param {CanvasGeometry} geom canvas bounding rect, backing size and settings.worldZoom
 * @returns {{ x: number, y: number }} CSS client coordinates
 */
function logicalToClient(point, geom) {
  const zoom = geom.zoom > 0 ? geom.zoom : 1;
  return backingToClient({ x: point.x * zoom, y: point.y * zoom }, geom);
}

/**
 * Visual centre of one fillText/strokeText call, in canvas backing-store
 * pixels. It is injected into the page too, so it must stay self-contained.
 * Horizontally, textAlign (left/start/right/end/center, start/end following
 * direction) is applied to the measured advance width, clamped by maxWidth.
 * Vertically, measureText's actualBoundingBoxAscent/Descent are distances
 * from the textBaseline in effect, so the ink-box middle is
 * y + (descent - ascent) / 2 for every baseline. Without those metrics it
 * falls back to an em-box estimate per baseline. The point is then mapped
 * through the context transform (a b c d e f) the way the canvas maps it.
 * @param {TextDraw} t
 * @returns {{ x: number, y: number }}
 */
function textCentre(t) {
  const w = typeof t.maxWidth === 'number' && t.maxWidth >= 0 ? Math.min(t.width, t.maxWidth) : t.width;
  const rtl = t.direction === 'rtl';
  const align = t.align === 'start' ? (rtl ? 'right' : 'left') : t.align === 'end' ? (rtl ? 'left' : 'right') : t.align;
  const x = align === 'left' ? t.x + w / 2 : align === 'right' ? t.x - w / 2 : t.x;
  let y;
  if (typeof t.ascent === 'number' && typeof t.descent === 'number' && t.ascent + t.descent > 0) {
    y = t.y + (t.descent - t.ascent) / 2;
  } else {
    /** @type {Record<string, number>} em offset from the baseline anchor to the em-box middle */
    const EM_SHIFT = { top: 0.5, hanging: 0.4, middle: 0, alphabetic: -0.35, ideographic: -0.5, bottom: -0.5 };
    const shift = EM_SHIFT[t.baseline];
    y = t.y + (typeof shift === 'number' ? shift : -0.35) * (t.fontSize || 10);
  }
  const m = t.matrix;
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}

/**
 * Axis-aligned bounding box, in canvas backing-store pixels, of what one
 * fillText/strokeText call covers. The local ink box is the advance width
 * (clamped by maxWidth, placed by textAlign as in textCentre) by the ink
 * ascent/descent from the textBaseline (an em box without metrics). All four
 * of its corners are mapped through the full transform, so rotated and skewed
 * text gets the box it really covers, not its unrotated size. It is injected
 * into the page too, so it must stay self-contained.
 * @param {TextDraw} t
 * @returns {Box}
 */
function textBounds(t) {
  const w = typeof t.maxWidth === 'number' && t.maxWidth >= 0 ? Math.min(t.width, t.maxWidth) : t.width;
  const rtl = t.direction === 'rtl';
  const align = t.align === 'start' ? (rtl ? 'right' : 'left') : t.align === 'end' ? (rtl ? 'left' : 'right') : t.align;
  const left = align === 'left' ? t.x : align === 'right' ? t.x - w : t.x - w / 2;
  let top;
  let bottom;
  if (typeof t.ascent === 'number' && typeof t.descent === 'number' && t.ascent + t.descent > 0) {
    top = t.y - t.ascent;
    bottom = t.y + t.descent;
  } else {
    /** @type {Record<string, number>} em offset from the baseline anchor to the em-box middle */
    const EM_SHIFT = { top: 0.5, hanging: 0.4, middle: 0, alphabetic: -0.35, ideographic: -0.5, bottom: -0.5 };
    const shift = EM_SHIFT[t.baseline];
    const size = t.fontSize || 10;
    const middle = t.y + (typeof shift === 'number' ? shift : -0.35) * size;
    top = middle - size / 2;
    bottom = middle + size / 2;
  }
  const m = t.matrix;
  const corners = [{ x: left, y: top }, { x: left + w, y: top }, { x: left, y: bottom }, { x: left + w, y: bottom }]
    .map((p) => ({ x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f }));
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
}

/**
 * A RegExp stays a RegExp (minus stateful g/y flags); a string matches literally.
 * @param {RegExp | string} pattern
 */
function textMatcher(pattern) {
  if (pattern instanceof RegExp) return new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, ''));
  return new RegExp(String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}

/**
 * A CSS <alpha-value> (number or percentage) clamped to 0..1; 1 if unreadable.
 * @param {string} raw
 */
function unitInterval(raw) {
  const v = raw.trim();
  const n = v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1;
}

/**
 * Opacity (0..1) of a fill or stroke style as the canvas reports it: 0 for
 * `transparent`; the alpha of rgba()/hsla() and of any CSS Color 4 `/ alpha`
 * form; the alpha digits of #RGBA and #RRGGBBAA; 1 for opaque and named
 * colours, and for gradients and patterns (recorded as 'pattern').
 * @param {string | undefined} style
 * @returns {number}
 */
function styleAlpha(style) {
  if (typeof style !== 'string') return 1;
  const s = style.trim().toLowerCase();
  if (s === 'transparent') return 0;
  const hex = /^#([0-9a-f]{4}|[0-9a-f]{8})$/.exec(s);
  if (hex && hex[1]) return parseInt(hex[1].length === 4 ? hex[1].charAt(3).repeat(2) : hex[1].slice(6), 16) / 255;
  const fn = /^[a-z][a-z0-9-]*\((.*)\)$/.exec(s);
  if (!fn || fn[1] === undefined) return 1;
  const args = fn[1];
  const slash = args.lastIndexOf('/');
  const parts = args.split(',');
  const raw = slash >= 0 ? args.slice(slash + 1) : parts.length === 4 ? parts[3] : undefined;
  return raw === undefined ? 1 : unitInterval(raw);
}

/**
 * Opacity a canvas `filter` applies: the product of its opacity() functions.
 * @param {string | undefined} filter
 */
function filterOpacity(filter) {
  if (typeof filter !== 'string') return 1;
  let o = 1;
  for (const m of filter.matchAll(/opacity\(([^)]*)\)/gi)) o *= m[1] && m[1].trim() ? unitInterval(m[1]) : 1;
  return o;
}

/**
 * How opaque a drawn string is: globalAlpha x the alpha of its fill or
 * stroke style x the canvas filter's opacity.
 * @param {DrawnText} t
 */
function effectiveAlpha(t) {
  return (typeof t.alpha === 'number' ? t.alpha : 1) * styleAlpha(t.fill) * filterOpacity(t.filter);
}

/**
 * Strings a player can see: effective alpha (see effectiveAlpha) above 0.05
 * and centred on the canvas. Text hidden any other way (covered by a later
 * draw, clipped, drawn in the background colour) still counts: the
 * screenshot is the backstop for those.
 * @param {DrawnText[]} texts
 * @param {{ width: number, height: number }} canvasSize backing-store size
 * @returns {DrawnText[]}
 */
function visibleOnCanvas(texts, canvasSize) {
  return texts.filter((t) => effectiveAlpha(t) > 0.05 && t.x >= 0 && t.y >= 0 && t.x <= canvasSize.width && t.y <= canvasSize.height);
}

/**
 * Picks the label a player would aim at: the last-drawn (topmost) visible
 * string matching pattern.
 * @param {DrawnText[]} texts one frame's strings in draw order, backing-store pixels
 * @param {RegExp | string} pattern
 * @param {{ width: number, height: number }} canvasSize backing-store size
 * @returns {{ match: DrawnText | null, visible: string[] }}
 */
function pickText(texts, pattern, canvasSize) {
  const re = textMatcher(pattern);
  const visible = visibleOnCanvas(texts, canvasSize);
  /** @type {DrawnText | null} */
  let match = null;
  for (const t of visible) if (re.test(t.text)) match = t;
  return { match, visible: [...new Set(visible.map((t) => t.text))] };
}

/**
 * The ink box of a drawn string in logical game coordinates (backing-store
 * pixels / worldZoom): the bounding box of its transformed ink box (see
 * textBounds), or just its centre if no box was recorded. Hit-test its
 * corners with the game's own hit-test to prove a label sits on the control
 * it names.
 * @param {DrawnText} t
 * @param {number} zoom
 * @returns {Box}
 */
function textBox(t, zoom) {
  const z = zoom > 0 ? zoom : 1;
  const b = t.box || { left: t.x, top: t.y, right: t.x, bottom: t.y };
  return { left: b.left / z, top: b.top / z, right: b.right / z, bottom: b.bottom / z };
}

/**
 * Whether two boxes share any area (touching edges do not count).
 * @param {Box} a
 * @param {Box} b
 */
function boxesOverlap(a, b) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/**
 * Whether the label matching `pattern` is drawn highlighted. Menus draw their
 * entries in one shared colour and the selected entry in an accent colour, so
 * the selection is the colour a player can pick out. Peers are the other
 * labels in the target's column (same align and anchor x) and row (same
 * anchor y). A peer group is only readable when it looks like a menu: at least
 * two peers, most of them sharing one colour. The label is highlighted when a
 * readable group has no peer drawn in the label's colour.
 * @param {DrawnText[]} texts one frame's strings in draw order
 * @param {RegExp | string} pattern
 * @returns {{ found: boolean, highlighted: boolean }}
 */
function isHighlighted(texts, pattern) {
  const re = textMatcher(pattern);
  const target = [...texts].reverse().find((t) => re.test(t.text));
  if (!target) return { found: false, highlighted: false };
  const { fill, align, ax, ay } = target;
  if (fill === undefined || ax === undefined || ay === undefined) return { found: true, highlighted: false };
  const near = (/** @type {number | undefined} */ a, /** @type {number} */ b) => a !== undefined && Math.abs(a - b) < 0.5;
  const others = texts.filter((t) => t.text !== target.text);
  const column = others.filter((t) => t.align === align && near(t.ax, ax));
  const row = others.filter((t) => near(t.ay, ay));
  /** @param {DrawnText[]} peers */
  const readable = (peers) => {
    if (peers.length < 2) return false;
    /** @type {Map<string | undefined, number>} */
    const counts = new Map();
    for (const t of peers) counts.set(t.fill, (counts.get(t.fill) || 0) + 1);
    const shared = Math.max(...counts.values());
    return shared >= 2 && shared * 2 >= peers.length;
  };
  const groups = [column, row].filter(readable);
  return { found: true, highlighted: groups.some((peers) => peers.every((t) => t.fill !== fill)) };
}

/**
 * The string matching `value` drawn where a player reads the value of the
 * label matching `label`. It must be on the label's row (centre within
 * `within` px of the label's centre vertically) and in the row's value
 * column: its box starting right of the label's box and ending inside the
 * row band, whose right edge is the label's left edge mirrored across the
 * canvas (the settings and FEET menus are centred panels with labels at the
 * left inset). A value whose box overlaps the label's box by any positive
 * area is always misplaced; `slack` only tolerates rounding at the column
 * edges. Returns the vertically nearest such string, the row candidates
 * rejected for their position, the column, and the label found. Pixels are
 * backing-store.
 * @param {DrawnText[]} texts
 * @param {RegExp | string} label
 * @param {RegExp | string} value
 * @param {{ within: number, canvasWidth: number, slack?: number }} opts slack: tolerance at both column edges (default 2)
 * @returns {{ match: DrawnText | null, misplaced: DrawnText[], column: { left: number, right: number } | null, label: DrawnText | null }}
 */
function rowValue(texts, label, value, opts) {
  const lre = textMatcher(label);
  const vre = textMatcher(value);
  const anchorText = [...texts].reverse().find((t) => lre.test(t.text));
  if (!anchorText) return { match: null, misplaced: [], column: null, label: null };
  const slack = opts.slack ?? 2;
  const lb = textBox(anchorText, 1);
  const column = { left: lb.right, right: opts.canvasWidth - lb.left };
  /** @type {DrawnText | null} */
  let match = null;
  let bestDistance = Infinity;
  /** @type {DrawnText[]} */
  const misplaced = [];
  for (const t of texts) {
    if (t === anchorText || !vre.test(t.text)) continue;
    const d = Math.abs(t.y - anchorText.y);
    if (d > opts.within) continue;
    const vb = textBox(t, 1);
    // Any positive-area overlap with the label is misplaced, whatever the
    // slack: slack only tolerates rounding at the column edges.
    if (boxesOverlap(lb, vb) || vb.left < column.left - slack || vb.right > column.right + slack) {
      misplaced.push(t);
    } else if (d < bestDistance) {
      match = t;
      bestDistance = d;
    }
  }
  return { match, misplaced, column, label: anchorText };
}

/**
 * Why a row value found by rowValue is not in its value column, in logical
 * px. A value whose box overlaps its label's box is named as such: the game
 * drew one over the other, which is a layout defect in the game at this
 * viewport rather than a value drawn in the wrong place.
 * @param {DrawnText} labelText
 * @param {DrawnText} valueText
 * @param {{ left: number, right: number }} column backing-store px
 * @param {number} zoom
 */
function misplacedValueMessage(labelText, valueText, column, zoom) {
  const z = zoom > 0 ? zoom : 1;
  const r1 = (/** @type {number} */ v) => Math.round(v * 10) / 10;
  const lb = textBox(labelText, z);
  const vb = textBox(valueText, z);
  const box = (/** @type {Box} */ b) => `x ${r1(b.left)}..${r1(b.right)} y ${r1(b.top)}..${r1(b.bottom)}`;
  if (boxesOverlap(lb, vb)) {
    return `value overlaps its label: ${JSON.stringify(labelText.text)} ${box(lb)} vs ${JSON.stringify(valueText.text)} ${box(vb)}, ` +
      'a game layout defect at this viewport';
  }
  return `${JSON.stringify(valueText.text)} spans x ${r1(vb.left)}..${r1(vb.right)}, outside the value column of ` +
    `${JSON.stringify(labelText.text)} (x ${r1(column.left / z)}..${r1(column.right / z)})`;
}

/**
 * PASS/FAIL for a drive. It passes only if it did not throw (whatever was
 * thrown) or get interrupted, recorded at least one check (unless
 * requireChecks is false), every check and every step succeeded, and the page
 * reported no unexpected errors. A drive that catches its own failed check or
 * step still fails.
 * @param {{ threw: boolean, interrupted?: string | null, entries: { kind: string, label: string, ok?: unknown }[],
 *   unexpected: string[], requireChecks?: boolean }} r
 * @returns {{ ok: boolean, reasons: string[] }}
 */
function driveOutcome(r) {
  /** @type {string[]} */
  const reasons = [];
  if (r.interrupted) reasons.push(`interrupted by ${r.interrupted}`);
  if (r.threw) reasons.push('the drive threw');
  const checks = r.entries.filter((e) => e.kind === 'check');
  const failedChecks = checks.filter((e) => e.ok !== true);
  if (failedChecks.length) reasons.push(`${failedChecks.length} failed check(s): ${failedChecks.map((e) => e.label).join('; ')}`);
  if (r.requireChecks !== false && checks.length === 0) reasons.push('no checks were recorded');
  const badSteps = r.entries.filter((e) => e.kind === 'step' && e.ok !== true);
  if (badSteps.length) reasons.push(`${badSteps.length} step(s) failed or did not finish: ${badSteps.map((e) => e.label).join('; ')}`);
  if (r.unexpected.length) reasons.push(`${r.unexpected.length} unexpected page error(s)`);
  return { ok: reasons.length === 0, reasons };
}

/**
 * Only the served origin may be contacted; everything else (PostHog, fonts,
 * CDNs) is refused. Non-network schemes (data:, blob:) are left alone.
 * @param {string} requestUrl
 * @param {string} allowedOrigin e.g. http://127.0.0.1:43210
 */
function shouldBlockRequest(requestUrl, allowedOrigin) {
  let u;
  try {
    u = new URL(requestUrl);
  } catch (_) {
    return true;
  }
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(u.protocol)) return false;
  return u.origin !== allowedOrigin;
}

/**
 * Console messages that are expected side effects of the harness itself.
 * Everything else at level `error` fails a drive.
 * @param {ConsoleLike} msg
 * @param {string} allowedOrigin
 * @returns {'info' | 'noise' | 'error'}
 */
function classifyConsole(msg, allowedOrigin) {
  if (msg.type !== 'error') return 'info';
  if (/^Failed to load resource/.test(msg.text) && msg.url) {
    if (shouldBlockRequest(msg.url, allowedOrigin)) return 'noise';
    try {
      if (new URL(msg.url).pathname === '/favicon.ico') return 'noise';
    } catch (_) { /* fall through */ }
  }
  return 'error';
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {string} homeDir
 */
function defaultOutRoot(env, homeDir) {
  if (env.NEON_VERIFY_OUT) return path.resolve(env.NEON_VERIFY_OUT);
  if (env.TMPDIR) return path.join(env.TMPDIR, 'neon-dungeon-verify');
  // No TMPDIR: os.tmpdir() would be /tmp, which agent sandboxes here forbid.
  return path.join(env.XDG_CACHE_HOME || path.join(homeDir, '.cache'), 'neon-dungeon-verify');
}

/**
 * Base directory for the browser's throwaway TMPDIR. Chromium puts its
 * process-singleton socket at $TMPDIR/.org.chromium.Chromium.XXXXXX/SingletonSocket
 * and CHECK-crashes (SIGTRAP at launch) when that path exceeds the 107-byte
 * Unix socket limit, so the base must stay short.
 * @param {string} outRoot
 * @param {string} homeDir
 */
function browserScratchBase(outRoot, homeDir) {
  const MAX_BASE = 52; // 107 - '/b-XXXXXX' - '/.org.chromium.Chromium.XXXXXX/SingletonSocket'
  for (const base of [path.join(outRoot, '.tmp'), path.join(homeDir, '.nd-verify')]) {
    if (base.length <= MAX_BASE) return base;
  }
  throw new Error(`no browser scratch path of <= ${MAX_BASE} chars; set NEON_VERIFY_OUT to a shorter directory`);
}

/** @param {string} name */
function slug(name) {
  return String(name).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'run';
}

/**
 * @param {Date} date
 * @param {string} name
 */
function runDirName(date, name) {
  const p = (/** @type {number} */ n) => String(n).padStart(2, '0');
  const stamp = `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}` +
    `-${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}`;
  return `${stamp}-${slug(name)}`;
}

/** @param {string} p */
function fileExists(p) {
  try {
    return fs.statSync(p).isFile();
  } catch (_) {
    return false;
  }
}

/** @param {string} p */
function listDir(p) {
  try {
    return fs.readdirSync(p);
  } catch (_) {
    return [];
  }
}

/** @param {string} name */
function findOnPath(name) {
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch (_) { /* keep looking */ }
  }
  return null;
}

function playwrightExecutablePath() {
  try {
    return require('playwright-core').chromium.executablePath() || null;
  } catch (_) {
    return null;
  }
}

/**
 * Chromium lookup order:
 *   1. NEON_VERIFY_CHROMIUM (explicit override; must exist);
 *   2. playwright-core's own executablePath(), the revision it is pinned to;
 *   3. the newest cached ~/.cache/ms-playwright/chromium-* revision, and
 *   4. system google-chrome / chromium / chromium-browser, both with a
 *      warning: CDP compatibility with the pinned playwright-core is not
 *      guaranteed.
 * @param {{ env?: Record<string, string | undefined>, homeDir?: string, exists?: (p: string) => boolean,
 *   list?: (p: string) => string[], playwrightPath?: () => string | null, which?: (name: string) => string | null }} [deps]
 * @returns {ChromiumChoice}
 */
function resolveChromium(deps = {}) {
  const env = deps.env || process.env;
  const exists = deps.exists || fileExists;
  const list = deps.list || listDir;
  const homeDir = deps.homeDir || os.homedir();
  const pwPath = deps.playwrightPath || playwrightExecutablePath;
  const which = deps.which || findOnPath;

  const fromEnv = env.NEON_VERIFY_CHROMIUM;
  if (fromEnv) {
    if (!exists(fromEnv)) throw new Error(`NEON_VERIFY_CHROMIUM=${fromEnv} does not exist`);
    return { path: fromEnv, source: 'env NEON_VERIFY_CHROMIUM' };
  }
  const own = pwPath();
  if (own && exists(own)) return { path: own, source: 'playwright-core executablePath()' };
  const pinned = own ? ` (playwright-core expects ${own})` : '';
  const warning = (/** @type {string} */ what) =>
    `${what} is not the Chromium revision playwright-core is pinned to${pinned}; compatibility is not guaranteed. Install the pinned one with: ${INSTALL_HINT}`;
  const cacheDir = path.join(homeDir, '.cache', 'ms-playwright');
  const revisions = list(cacheDir)
    .map((name) => /^chromium-(\d+)$/.exec(name))
    .filter((m) => m !== null)
    .map((m) => ({ dir: m[0], rev: Number(m[1]) }))
    .sort((a, b) => b.rev - a.rev);
  for (const r of revisions) {
    const candidate = path.join(cacheDir, r.dir, 'chrome-linux64', 'chrome');
    if (exists(candidate)) return { path: candidate, source: `playwright cache ${r.dir}`, warning: warning(`cached ${r.dir}`) };
  }
  for (const name of ['google-chrome', 'chromium', 'chromium-browser']) {
    const found = which(name);
    if (found) return { path: found, source: `system ${name}`, warning: warning(`system ${name}`) };
  }
  throw new Error(`no Chromium found. Install one with: ${INSTALL_HINT}  (or set NEON_VERIFY_CHROMIUM=/path/to/chrome)`);
}

/**
 * True when argv is verify-serve.js started for exactly this run dir (and,
 * when given, serving exactly this root). The flags after the script are
 * parsed with verify-serve's own parser, so this check and the server agree:
 * a repeated or unknown flag is not our server.
 * @param {string[]} args process argv (from /proc/<pid>/cmdline)
 * @param {string} runDir
 * @param {string} [root]
 */
function isOurServer(args, runDir, root) {
  const script = args.findIndex((a) => path.basename(a) === 'verify-serve.js');
  if (script < 0) return false;
  let served;
  try {
    served = parseServeArgs(args.slice(script + 1));
  } catch (_) {
    return false;
  }
  return served.runDir === runDir && (root === undefined || served.root === root);
}

// ─── Process / filesystem plumbing ───────────────────────────────────────────

/**
 * Liveness and argv of a pid. Linux reads /proc: zombies, and processes that
 * are exiting (their argv is already released, so cmdline reads empty), count
 * as dead. Elsewhere `ps` is a best-effort fallback that splits argv on spaces.
 * @param {number} pid
 * @returns {{ alive: boolean, args: string[] }}
 */
function processInfo(pid) {
  const dead = { alive: false, args: [] };
  if (!Number.isInteger(pid) || pid <= 0) return dead;
  if (fs.existsSync('/proc/self')) {
    try {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
      const state = stat.charAt(stat.lastIndexOf(')') + 2);
      if (state === 'Z' || state === 'X') return dead;
      const args = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').filter(Boolean);
      return args.length ? { alive: true, args } : dead;
    } catch (_) {
      return dead;
    }
  }
  try {
    process.kill(pid, 0);
  } catch (_) {
    return dead;
  }
  try {
    return { alive: true, args: execFileSync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8' }).trim().split(/\s+/) };
  } catch (_) {
    return { alive: true, args: [] };
  }
}

/** @param {string} root */
function gitHead(root) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (_) {
    return 'unknown';
  }
}

/** @param {string} name */
function createRunDir(name) {
  const outRoot = defaultOutRoot(process.env, os.homedir());
  fs.mkdirSync(outRoot, { recursive: true });
  const base = path.join(outRoot, runDirName(new Date(), name));
  return uniqueDir(base);
}

/** @param {string} base */
function uniqueDir(base) {
  for (let n = 1; n < 1000; n++) {
    const dir = n === 1 ? base : `${base}-${n}`;
    try {
      fs.mkdirSync(dir, { recursive: false });
      return dir;
    } catch (err) {
      if (/** @type {NodeJS.ErrnoException} */ (err).code !== 'EEXIST') throw err;
    }
  }
  throw new Error(`could not create a unique directory at ${base}`);
}

const TOKEN = /^[0-9a-f]{32}$/;

/**
 * A server URL as launch records it: `http:`, host 127.0.0.1 or [::1], an
 * explicit integer port 1-65535, path `/`, nothing else, in canonical form.
 * `new URL()` does the parsing, so `http://127.0.0.1:99999/` (out of range)
 * or `http://127.0.0.1:0/` never reaches a browser.
 * @param {unknown} url
 */
function isServerUrl(url) {
  if (typeof url !== 'string') return false;
  let u;
  try {
    u = new URL(url);
  } catch (_) {
    return false;
  }
  const port = Number(u.port);
  return u.protocol === 'http:' && (u.hostname === '127.0.0.1' || u.hostname === '[::1]') &&
    u.port !== '' && Number.isInteger(port) && port >= 1 && port <= 65535 &&
    u.pathname === '/' && !u.search && !u.hash && !u.username && !u.password && u.href === url;
}

/**
 * Parses a run dir's server.json text against the full ServerRecord schema.
 * A torn, empty, partial or wrongly shaped file is `unreadable` (never an
 * exception, so launch and stop can always recover the run dir), and a
 * record naming another run dir is `foreign` (copied or moved from another
 * run: its server is not this run's).
 * @param {string} text
 * @param {string} runDir the run dir it was read from
 * @returns {{ kind: 'ok', record: ServerRecord } | { kind: 'foreign', record: ServerRecord } | { kind: 'unreadable', why: string }}
 */
function parseServerRecord(text, runDir) {
  /** @type {any} */
  let d;
  try {
    d = JSON.parse(text);
  } catch (_) {
    return { kind: 'unreadable', why: text.trim() ? `not valid JSON (${text.length} bytes; torn write?)` : 'empty file' };
  }
  if (!d || typeof d !== 'object' || Array.isArray(d)) return { kind: 'unreadable', why: 'not a server record (not a JSON object)' };
  /** @type {string[]} */
  const bad = [];
  if (!Number.isInteger(d.pid) || d.pid <= 0) bad.push('pid');
  if (d.status !== 'starting' && d.status !== 'ready') bad.push('status');
  else if (d.status === 'starting' ? d.url !== null : !isServerUrl(d.url)) bad.push('url');
  for (const key of ['root', 'runDir', 'startedAt', 'head']) if (typeof d[key] !== 'string' || !d[key]) bad.push(key);
  if (typeof d.token !== 'string' || !TOKEN.test(d.token)) bad.push('token');
  if (bad.length) return { kind: 'unreadable', why: `not a server record (bad or missing: ${bad.join(', ')})` };
  const record = /** @type {ServerRecord} */ (d);
  return path.resolve(record.runDir) === path.resolve(runDir) ? { kind: 'ok', record } : { kind: 'foreign', record };
}

/**
 * @param {string} runDir
 * @returns {(ReturnType<typeof parseServerRecord> & { text: string }) | { kind: 'missing' }}
 */
function readServerRecord(runDir) {
  let text;
  try {
    text = fs.readFileSync(path.join(runDir, 'server.json'), 'utf8');
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') return { kind: 'missing' };
    return { kind: 'unreadable', why: err instanceof Error ? err.message : String(err), text: '' };
  }
  return { ...parseServerRecord(text, runDir), text };
}

/**
 * Writes server.json atomically (temp file + rename), so a reader never sees
 * a torn record even if the writer is killed mid-write.
 * @param {string} file
 * @param {ServerRecord} record
 */
function writeServerRecord(file, record) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(record, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

/**
 * The launch token in a lock's or record's text, or null.
 * @param {string} text
 */
function tokenOf(text) {
  try {
    const data = JSON.parse(text);
    return data && typeof data.token === 'string' ? data.token : null;
  } catch (_) {
    return null;
  }
}

/**
 * The launch token a lock or record file carries, or null if it has none.
 * @param {string} file
 */
function fileToken(file) {
  try {
    return tokenOf(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return null;
  }
}

/**
 * @typedef {{ renameSync(from: string, to: string): void, readFileSync(file: string, encoding: 'utf8'): string,
 *   unlinkSync(file: string): void, linkSync(existing: string, target: string): void }} ClaimFs
 * @typedef {{ result: 'removed' | 'foreign' | 'gone' | 'quarantined', quarantine?: string }} Claim
 *   quarantined: the claimed file turned out foreign and a newer file had taken its path, so it is left under `quarantine`
 */

/**
 * Removes `file` only if `isOurs` holds for the content it has when it is
 * removed, without a compare-then-delete on the shared path:
 * 1. a quick read skips a file that is already visibly foreign, so a live
 *    owner's lock or record is never displaced, even briefly;
 * 2. the path is renamed to a unique quarantine name (atomic), and only that
 *    claimed file is judged, so a file another writer puts at the path
 *    afterwards is never touched;
 * 3. a claimed file that is ours is unlinked. One that is not (the path was
 *    replaced between 1 and 2) is linked back to the path, which fails with
 *    EEXIST instead of clobbering a newer file, and then its quarantine name
 *    is unlinked. If a newer file did take the path, the foreign file stays
 *    under its quarantine name, and the caller reports it.
 * @param {string} file
 * @param {(text: string) => boolean} isOurs
 * @param {{ fs?: ClaimFs, beforeClaim?: () => void, afterClaim?: () => void }} [seams] tests: a fake fs, and another writer acting before or after the claim
 * @returns {Claim}
 */
function removeClaimed(file, isOurs, seams = {}) {
  const f = seams.fs || fs;
  const code = (/** @type {unknown} */ err) => /** @type {NodeJS.ErrnoException} */ (err).code;
  let seen;
  try {
    seen = f.readFileSync(file, 'utf8');
  } catch (err) {
    if (code(err) === 'ENOENT') return { result: 'gone' };
    throw err;
  }
  if (!isOurs(seen)) return { result: 'foreign' };
  if (seams.beforeClaim) seams.beforeClaim();
  const quarantine = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.quarantine`;
  try {
    f.renameSync(file, quarantine);
  } catch (err) {
    if (code(err) === 'ENOENT') return { result: 'gone' };
    throw err;
  }
  if (seams.afterClaim) seams.afterClaim();
  let claimed = '';
  try { claimed = f.readFileSync(quarantine, 'utf8'); } catch (_) { /* unreadable: not ours */ }
  if (isOurs(claimed)) {
    f.unlinkSync(quarantine);
    return { result: 'removed' };
  }
  try {
    f.linkSync(quarantine, file);
  } catch (err) {
    if (code(err) === 'EEXIST') return { result: 'quarantined', quarantine };
    throw err;
  }
  f.unlinkSync(quarantine);
  return { result: 'foreign' };
}

/**
 * Removes a lock or record only if it carries `token` when it is removed, so
 * cleanup never deletes a file another launch has written.
 * @param {string} file
 * @param {string} token
 * @param {Parameters<typeof removeClaimed>[2]} [seams]
 * @returns {Claim}
 */
function removeIfOwned(file, token, seams) {
  return removeClaimed(file, (text) => tokenOf(text) === token, seams);
}

/**
 * Removes a file only if its content is still `text`, the content `stop`
 * judged it by.
 * @param {string} file
 * @param {string} text
 * @returns {Claim}
 */
function removeIfUnchanged(file, text) {
  return removeClaimed(file, (now) => now === text);
}

/**
 * @param {string} lockPath
 * @returns {{ kind: 'missing' } | { kind: 'present', text: string, token: string | null, launcherPid: number | null }}
 */
function readLock(lockPath) {
  let text;
  try {
    text = fs.readFileSync(lockPath, 'utf8');
  } catch (_) {
    return { kind: 'missing' };
  }
  /** @type {any} */
  let data = null;
  try { data = JSON.parse(text); } catch (_) { /* unreadable lock: no owner can be read */ }
  return {
    kind: 'present',
    text,
    token: data && typeof data.token === 'string' ? data.token : null,
    launcherPid: data && Number.isInteger(data.launcherPid) ? data.launcherPid : null,
  };
}

/**
 * True while `pid` is a running `verify.js launch`: its lock is not stale.
 * @param {number | null} pid
 */
function isLiveLauncher(pid) {
  if (pid === null || pid === process.pid) return false;
  const info = processInfo(pid);
  return info.alive && info.args.some((a) => path.basename(a) === 'verify.js') && info.args.includes('launch');
}

/**
 * Parent pid of a process (Linux /proc), or null.
 * @param {number} pid
 */
function parentPid(pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const ppid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]);
    return Number.isInteger(ppid) ? ppid : null;
  } catch (_) {
    return null;
  }
}

/**
 * Working directory of a process (Linux /proc), or null.
 * @param {number} pid
 */
function processCwd(pid) {
  try {
    return fs.readlinkSync(`/proc/${pid}/cwd`);
  } catch (_) {
    return null;
  }
}

/**
 * The pid of a `verify.js launch` still running for this run dir, or null.
 * It must be the launcher the lock names, be alive with argv `verify.js
 * launch`, and be tied to this run dir. Either its --run-dir resolves (from
 * its own working directory) to this run dir, or the recorded server, whose
 * record carries the lock's token, is its child. `stop` hands such a launch
 * a SIGTERM so the launch's own handlers clean up, rather than killing its
 * server under it.
 * @param {ReturnType<typeof readLock>} lock
 * @param {ReturnType<typeof readServerRecord>} read
 * @param {string} runDir
 * @param {{ info: typeof processInfo, parent: typeof parentPid, cwd: typeof processCwd }} [procs] test seam over /proc
 * @returns {number | null}
 */
function verifiedLauncher(lock, read, runDir, procs = { info: processInfo, parent: parentPid, cwd: processCwd }) {
  if (lock.kind !== 'present' || lock.launcherPid === null || lock.launcherPid === process.pid) return null;
  const pid = lock.launcherPid;
  const info = procs.info(pid);
  const script = info.args.findIndex((a) => path.basename(a) === 'verify.js');
  if (!info.alive || script < 0 || info.args[script + 1] !== 'launch') return null;
  const flag = info.args.indexOf('--run-dir', script);
  const given = flag >= 0 ? info.args[flag + 1] : undefined;
  const base = given === undefined ? null : path.isAbsolute(given) ? '/' : procs.cwd(pid);
  const namesRunDir = given !== undefined && base !== null && path.resolve(base, given) === runDir;
  const ownsRecord = read.kind === 'ok' && lock.token !== null && read.record.token === lock.token &&
    procs.parent(read.record.pid) === pid;
  return namesRunDir || ownsRecord ? pid : null;
}

/**
 * The one cleanup instruction every refusal gives.
 * @param {string} runDir
 */
function stopHint(runDir) {
  return `Run \`node .github/skills/verify-neon-dungeon/scripts/verify.js stop --run-dir ${runDir}\` ` +
    '(it kills only a server it can verify and clears the records), then launch again, or use a new --run-dir.';
}

/**
 * Live verify-serve processes started for this run dir, found by their exact
 * argv (Linux /proc only). Only reported, never killed: without a readable
 * server.json nothing proves this run started them.
 * @param {string} runDir
 * @returns {number[]}
 */
function serversForRunDir(runDir) {
  if (!fs.existsSync('/proc/self')) return [];
  return listDir('/proc')
    .filter((name) => /^\d+$/.test(name) && Number(name) !== process.pid)
    .map(Number)
    .filter((pid) => {
      const info = processInfo(pid);
      return info.alive && isOurServer(info.args, runDir);
    });
}

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {CliFlags} flags
 * @param {string} fallbackName
 * @returns {{ runDir: string, url: string, record: ServerRecord | null }}
 */
function resolveTarget(flags, fallbackName) {
  if (flags.runDir && flags.url) throw new UsageError('pass --run-dir (local server) or --url (remote), not both');
  if (flags.runDir) {
    const runDir = path.resolve(flags.runDir);
    const read = readServerRecord(runDir);
    if (read.kind === 'missing') throw new UsageError(`${runDir}/server.json not found; run \`verify.js launch\` first (or it was stopped)`);
    if (read.kind === 'unreadable') throw new RefusedError(`${runDir}/server.json is unreadable: ${read.why}. ${stopHint(runDir)}`);
    if (read.kind === 'foreign') {
      throw new RefusedError(`${runDir}/server.json belongs to run ${read.record.runDir} (pid ${read.record.pid}), not ${runDir}: ` +
        `it was copied or moved, and another run's server is never used. ${stopHint(runDir)}`);
    }
    const record = read.record;
    if (!record.url) throw new RefusedError(`the server for ${runDir} never reached READY. ${stopHint(runDir)}`);
    return { runDir, url: record.url, record };
  }
  if (flags.url) {
    const url = new URL(flags.url).href;
    return { runDir: createRunDir(flags.name || fallbackName), url, record: null };
  }
  throw new UsageError('pass --run-dir DIR (from `launch`) or --url URL');
}

/** @param {string} dir */
function listFilesRecursive(dir) {
  /** @type {string[]} */
  const out = [];
  /** @param {string} d */
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(path.relative(dir, full));
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return out.sort();
}

// ─── Page-side functions (serialized into the page by page.evaluate) ─────────
// They run in the browser against the game's script-scope globals (game, W, H,
// layout, settings, T). Keep them self-contained.

/** @returns {StateSnapshot} */
function pageReadState() {
  const g = typeof game !== 'undefined' ? game : null;
  const p = g && g.player;
  const r2 = (/** @type {any} */ v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
  return {
    state: g ? String(g.state) : null,
    floor: p ? g.floor : null,
    hp: p ? r2(p.hp) : null,
    x: p ? r2(p.x) : null,
    y: p ? r2(p.y) : null,
    W,
    H,
    compact: !!layout.compact,
    zoom: settings.worldZoom,
    seed: g && g.runSeed ? String(g.runSeed) : null,
  };
}

/** @returns {CanvasGeometry} */
function pageCanvasGeometry() {
  const c = /** @type {HTMLCanvasElement} */ (document.getElementById('c'));
  const r = c.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height, canvasWidth: c.width, canvasHeight: c.height, zoom: settings.worldZoom || 1 };
}

function pageMenuInfo() {
  return {
    sel: game.menuSel | 0,
    confirm: !!game._newGameConfirm,
    options: game.getMenuOptions().map((/** @type {any} */ o) => ({ label: String(o.label), isDiffRow: !!o.isDiffRow })),
  };
}

/**
 * Init script, injected before any game script runs. It records the visual
 * centre (backing-store pixels) of every string drawn on the main canvas
 * (id "c") during the latest frame. Its own rAF tick is requested before the
 * game's first frame, so it runs first in every frame and rotates the buffer
 * before the game's loop draws. Queries read `current`, which by then holds
 * the last complete frame.
 * @param {typeof textCentre} centreOf
 * @param {typeof textBounds} boundsOf
 */
function pageTextRecorder(centreOf, boundsOf) {
  const w = /** @type {any} */ (window);
  if (w.__neonVerifyText) return;
  const rec = { frame: 0, current: /** @type {any[]} */ ([]), previous: /** @type {any[]} */ ([]) };
  w.__neonVerifyText = rec;
  const raf = window.requestAnimationFrame.bind(window);
  const tick = () => {
    rec.frame += 1;
    rec.previous = rec.current;
    rec.current = [];
    raf(tick);
  };
  raf(tick);
  const proto = /** @type {any} */ (CanvasRenderingContext2D.prototype);
  for (const name of ['fillText', 'strokeText']) {
    const original = proto[name];
    /**
     * @this {CanvasRenderingContext2D}
     * @param {unknown} text
     * @param {number} x
     * @param {number} y
     * @param {number} [maxWidth]
     */
    proto[name] = function recordText(text, x, y, maxWidth) {
      try {
        const str = String(text);
        if (this.canvas && this.canvas.id === 'c' && str.trim()) {
          const m = this.measureText(str);
          const t = this.getTransform();
          const px = /(\d+(?:\.\d+)?)px/.exec(this.font);
          /** @type {TextDraw} */
          const draw = {
            x: Number(x),
            y: Number(y),
            maxWidth: maxWidth === undefined ? undefined : Number(maxWidth),
            align: this.textAlign,
            baseline: this.textBaseline,
            direction: this.direction === 'rtl' ? 'rtl' : 'ltr',
            width: m.width,
            ascent: m.actualBoundingBoxAscent,
            descent: m.actualBoundingBoxDescent,
            fontSize: px ? Number(px[1]) : 10,
            matrix: { a: t.a, b: t.b, c: t.c, d: t.d, e: t.e, f: t.f },
          };
          const c = centreOf(draw);
          const style = name === 'fillText' ? this.fillStyle : this.strokeStyle;
          rec.current.push({
            text: str,
            x: c.x,
            y: c.y,
            alpha: this.globalAlpha,
            fill: typeof style === 'string' ? style : 'pattern',
            filter: typeof this.filter === 'string' ? this.filter : 'none',
            align: this.textAlign,
            ax: t.a * Number(x) + t.c * Number(y) + t.e,
            ay: t.b * Number(x) + t.d * Number(y) + t.f,
            box: boundsOf(draw),
          });
        }
      } catch (_) { /* recording must never break the game's drawing */ }
      return original.apply(this, arguments);
    };
  }
}

/** Strings drawn on the main canvas in the last complete frame, plus the canvas geometry. */
function pageVisibleTexts() {
  const rec = /** @type {any} */ (window).__neonVerifyText;
  const c = /** @type {HTMLCanvasElement} */ (document.getElementById('c'));
  const r = c.getBoundingClientRect();
  const list = rec ? (rec.current.length ? rec.current : rec.previous) : [];
  return {
    installed: !!rec,
    texts: list.map((/** @type {any} */ t) => ({
      text: String(t.text), x: Number(t.x), y: Number(t.y), alpha: Number(t.alpha),
      fill: String(t.fill), filter: String(t.filter), align: String(t.align), ax: Number(t.ax), ay: Number(t.ay),
      box: { left: Number(t.box.left), top: Number(t.box.top), right: Number(t.box.right), bottom: Number(t.box.bottom) },
    })),
    geom: { left: r.left, top: r.top, width: r.width, height: r.height, canvasWidth: c.width, canvasHeight: c.height, zoom: settings.worldZoom || 1 },
  };
}

function pageSeedField() {
  return String((game.seedSetup && game.seedSetup.seed) || '');
}

function pageSystemMessage() {
  const m = game.getActiveSystemMessage();
  return { id: m ? String(m.id) : null, ackTimer: Number(game.systemMessageAckTimer) || 0 };
}

function pageFindStairs() {
  const g = game;
  const map = g.dungeon && g.dungeon.map;
  const p = g.player;
  if (!map || !p) return null;
  /** @type {{ x: number, y: number } | null} */
  let best = null;
  let bestD = Infinity;
  for (let y = 0; y < map.length; y++) {
    const row = map[y];
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== T.STAIRS) continue;
      const d = (x + 0.5 - p.x) ** 2 + (y + 0.5 - p.y) ** 2;
      if (d < bestD) { bestD = d; best = { x, y }; }
    }
  }
  return best;
}


function pageDumpStorage() {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k === null) continue;
    const raw = localStorage.getItem(k);
    try {
      out[k] = raw === null ? null : JSON.parse(raw);
    } catch (_) {
      out[k] = raw;
    }
  }
  return out;
}

/** @param {string} key */
function pageReadStorage(key) {
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return raw;
  }
}

function pageDoctorInfo() {
  const c = /** @type {HTMLCanvasElement} */ (document.getElementById('c'));
  return {
    state: typeof game !== 'undefined' ? String(game.state) : null,
    appVersion: typeof appVersion !== 'undefined' ? appVersion : null,
    W,
    H,
    compact: !!layout.compact,
    worldZoom: settings.worldZoom,
    touchDevice: isTouchDevice(),
    canvas: { canvasWidth: c.width, canvasHeight: c.height },
  };
}

// ─── Browser session + harness ───────────────────────────────────────────────

/**
 * @param {{ url: string, viewport: Viewport, touch: boolean, evidenceDir: string, log?: (line: string) => void }} opts
 */
async function openSession(opts) {
  const { chromium } = require('playwright-core');
  const chromiumChoice = resolveChromium();
  const allowedOrigin = new URL(opts.url).origin;
  const allowedHost = new URL(opts.url).hostname;
  const log = opts.log || (() => {});
  if (chromiumChoice.warning) console.error(`WARNING  ${chromiumChoice.warning}`);
  fs.mkdirSync(opts.evidenceDir, { recursive: true });

  // Playwright and Chromium write their throwaway profile and sockets under
  // $TMPDIR; point it at a short scratch dir (removed on finish) so nothing
  // lands in /tmp.
  const scratchBase = browserScratchBase(defaultOutRoot(process.env, os.homedir()), os.homedir());
  fs.mkdirSync(scratchBase, { recursive: true });
  const scratch = fs.mkdtempSync(path.join(scratchBase, 'b-'));
  const prevTmp = process.env.TMPDIR;
  const restoreTmp = () => {
    if (prevTmp === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = prevTmp;
    fs.rmSync(scratch, { recursive: true, force: true });
  };
  process.env.TMPDIR = scratch;

  const t0 = Date.now();
  const rec = {
    /** @type {TranscriptEntry[]} */ entries: [],
    /** @type {{ t: number, type: string, text: string, url?: string, line?: number }[]} */ console: [],
    /** @type {{ t: number, layer: string, method: string, type: string, url: string }[]} */ blocked: [],
    /** @type {{ t: number, message: string }[]} */ pageErrors: [],
    /** @type {{ t: number, status: number, url: string }[]} */ httpErrors: [],
  };
  const since = () => Date.now() - t0;

  /** @type {import('playwright-core').Browser} */
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: chromiumChoice.path,
      headless: true,
      // verify.js owns signals: on SIGINT/SIGTERM it finishes the evidence and
      // closes the browser itself instead of Playwright exiting first.
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false,
      // Second network fence behind context.route: no hostname except the served
      // one resolves, so even a request that bypasses routing cannot leave.
      args: ['--mute-audio', `--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE ${allowedHost}`],
    });
  } catch (err) {
    restoreTmp();
    throw err;
  }

  const { context, page } = await (async () => {
    try {
      const ctx = await browser.newContext({
        viewport: { width: opts.viewport.width, height: opts.viewport.height },
        isMobile: opts.viewport.isMobile,
        hasTouch: opts.touch,
        deviceScaleFactor: 1,
        locale: 'en-US',
        serviceWorkers: 'allow',
      });
      await ctx.route('**/*', (route) => {
        const req = route.request();
        if (shouldBlockRequest(req.url(), allowedOrigin)) {
          rec.blocked.push({ t: since(), layer: 'route', method: req.method(), type: req.resourceType(), url: req.url() });
          return route.abort('blockedbyclient');
        }
        return route.continue();
      });
      await ctx.routeWebSocket(() => true, (ws) => {
        if (shouldBlockRequest(ws.url(), allowedOrigin)) {
          rec.blocked.push({ t: since(), layer: 'websocket', method: 'GET', type: 'websocket', url: ws.url() });
          return ws.close();
        }
        ws.connectToServer();
        return undefined;
      });
      ctx.on('requestfailed', (req) => {
        const failure = (req.failure() || {}).errorText || '';
        if (shouldBlockRequest(req.url(), allowedOrigin) && !/BLOCKED_BY_CLIENT/.test(failure)) {
          rec.blocked.push({ t: since(), layer: `dns (${failure})`, method: req.method(), type: req.resourceType(), url: req.url() });
        }
      });
      const pg = await ctx.newPage();
      // Before any game script: record where each canvas string is drawn, so
      // taps can target labels by their visible text (h.findText / h.tapText).
      await pg.addInitScript({ content: `(${pageTextRecorder.toString()})(${textCentre.toString()}, ${textBounds.toString()});` });
      pg.on('console', (msg) => {
        const loc = msg.location();
        rec.console.push({ t: since(), type: msg.type(), text: msg.text(), url: loc.url || undefined, line: loc.lineNumber });
      });
      pg.on('pageerror', (err) => rec.pageErrors.push({ t: since(), message: err.stack || err.message }));
      pg.on('crash', () => rec.pageErrors.push({ t: since(), message: 'page crashed' }));
      pg.on('response', (res) => {
        if (res.status() >= 400 && !shouldBlockRequest(res.url(), allowedOrigin)) {
          rec.httpErrors.push({ t: since(), status: res.status(), url: res.url() });
        }
      });
      return { context: ctx, page: pg };
    } catch (err) {
      await browser.close().catch(() => {});
      restoreTmp();
      throw err;
    }
  })();

  let shotCount = 0;
  /** @type {string[]} */
  const stepStack = [];
  /** @type {import('playwright-core').CDPSession | null} */
  let cdp = null;

  /**
   * @param {string} kind
   * @param {string} label
   * @param {Record<string, unknown>} [extra]
   * @returns {TranscriptEntry}
   */
  const record = (kind, label, extra) => {
    /** @type {TranscriptEntry} */
    const entry = { i: rec.entries.length + 1, t: since(), kind, label, step: stepStack[stepStack.length - 1] || null, ...(extra || {}) };
    rec.entries.push(entry);
    return entry;
  };

  const readState = () => page.evaluate(pageReadState);

  // Drive scripts get `h.page` as an escape hatch. Any call through it that runs
  // code in the page is recorded as SETUP (never proof): read-only is only a
  // convention there, as it is for h.observe.
  const RAW_CODE_METHODS = new Set(['evaluate', 'evaluateHandle', '$eval', '$$eval', 'waitForFunction', 'addScriptTag', 'addInitScript', 'exposeFunction', 'exposeBinding']);
  const rawPage = /** @type {import('playwright-core').Page} */ (new Proxy(page, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target);
      if (typeof value !== 'function') return value;
      if (typeof prop === 'string' && RAW_CODE_METHODS.has(prop)) {
        return (/** @type {any[]} */ ...args) => {
          record('setup', `SETUP: h.page.${prop} (raw page access, never proof)`, { note: 'code run through h.page is recorded as setup' });
          return value.apply(target, args);
        };
      }
      return value.bind(target);
    },
  }));

  /**
   * Waits for n animation frames. The game's loop requested its frame before
   * this callback did, so once it resolves the game has updated and rendered
   * at least n times since the call. If no frame runs within
   * FRAME_TIMEOUT_MS it throws: input that no frame observed is not input the
   * game received, so the drive must fail rather than carry on.
   * @param {number} [n]
   */
  const frames = async (n = 2) => {
    /** @type {NodeJS.Timeout | undefined} */
    let timer;
    const stalled = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(
        `no animation frame observed the input within ${FRAME_TIMEOUT_MS / 1000} s (waited for ${n} frame(s)): the page stopped rendering`)),
      FRAME_TIMEOUT_MS);
    });
    try {
      await Promise.race([
        page.evaluate((k) => new Promise((resolve) => {
          let left = k;
          const tick = () => { left -= 1; if (left <= 0) resolve(undefined); else requestAnimationFrame(tick); };
          requestAnimationFrame(tick);
        }), n),
        stalled,
      ]);
    } finally {
      clearTimeout(timer);
    }
  };

  /**
   * Presses and releases one key so that a game frame sees it down and a later
   * frame sees it up: repeated presses never merge into one frame, however
   * slow the frames are.
   * @param {string} key
   * @param {number} holdMs extra wall time to keep it down
   */
  const keyTap = async (key, holdMs) => {
    await page.keyboard.down(key);
    try {
      await frames(1);
      if (holdMs > 0) await sleep(holdMs);
    } finally {
      await page.keyboard.up(key);
    }
    await frames(1);
  };

  /** @param {string} label */
  const screenshot = async (label) => {
    shotCount += 1;
    const file = path.join(opts.evidenceDir, `${String(shotCount).padStart(2, '0')}-${slug(label).slice(0, 60)}.png`);
    await page.screenshot({ path: file });
    return file;
  };

  /** @param {{ x: number, y: number }} logical */
  const toClient = async (logical) => logicalToClient(logical, await page.evaluate(pageCanvasGeometry));

  /**
   * @param {'touchStart' | 'touchMove' | 'touchEnd'} type
   * @param {{ x: number, y: number }[]} points
   */
  const touchEvent = async (type, points) => {
    cdp = cdp || await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p) => ({ x: p.x, y: p.y, id: 1 })) });
  };

  /**
   * One unrecorded movement burst: an arrow key on keyboard contexts, a full
   * deflection of the left-half virtual joystick on touch contexts. The game
   * samples held keys and the joystick once per frame, so the input stays down
   * until a frame has observed it, then for the rest of `ms`, and is always
   * released.
   * @param {'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'} key
   * @param {number} ms
   * @returns {Promise<number>} wall-clock ms the input was held
   */
  const moveBurst = async (key, ms) => {
    /** @type {() => Promise<void>} */
    let release;
    if (!opts.touch) {
      await page.keyboard.down(key);
      release = () => page.keyboard.up(key);
    } else {
      /** @type {Record<string, [number, number]>} */
      const DIRS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
      const [dx, dy] = DIRS[key] || [0, 0];
      const dims = await page.evaluate(() => ({ w: W, h: H, radius: JR }));
      const base = { x: dims.w * 0.25, y: dims.h * 0.5 };
      const start = await toClient(base);
      const end = await toClient({ x: base.x + dx * dims.radius, y: base.y + dy * dims.radius });
      await touchEvent('touchStart', [start]);
      release = () => touchEvent('touchEnd', []);
      try {
        await touchEvent('touchMove', [end]);
      } catch (err) {
        await release();
        throw err;
      }
    }
    const t = Date.now();
    try {
      await frames(1);
      const left = ms - (Date.now() - t);
      if (left > 0) await sleep(left);
    } finally {
      await release();
    }
    return Date.now() - t;
  };

  /** Visible strings of the last complete frame, and the canvas geometry. */
  const snapshotTexts = async () => {
    const snap = await page.evaluate(pageVisibleTexts);
    if (!snap.installed) throw new Error('canvas text recorder is not installed in this page');
    return { texts: visibleOnCanvas(snap.texts, { width: snap.geom.canvasWidth, height: snap.geom.canvasHeight }), geom: snap.geom };
  };

  /**
   * @param {DrawnText} t
   * @param {CanvasGeometry} geom
   * @returns {FoundText}
   */
  const toFound = (t, geom) => {
    const zoom = geom.zoom > 0 ? geom.zoom : 1;
    return { text: t.text, client: backingToClient(t, geom), logical: { x: t.x / zoom, y: t.y / zoom }, box: textBox(t, zoom) };
  };

  /**
   * Polls the drawn strings until `probe` returns a match, or throws with the
   * visible strings once timeoutMs passes.
   * @param {string} what
   * @param {(texts: DrawnText[], geom: CanvasGeometry) => DrawnText | null} probe
   * @param {number} timeoutMs
   */
  const pollTexts = async (what, probe, timeoutMs) => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const { texts, geom } = await snapshotTexts();
      const hit = probe(texts, geom);
      if (hit) return toFound(hit, geom);
      if (Date.now() >= deadline) {
        const shown = [...new Set(texts.map((t) => t.text))].slice(0, 60).map((s) => JSON.stringify(s)).join(', ');
        throw new Error(`no visible canvas text for ${what} after ${timeoutMs}ms; visible strings: ${shown || '(none)'}`);
      }
      await sleep(50);
    }
  };

  /**
   * Floor banners (modifier banner, biome card) freeze PLAYING for up to 3 s of
   * game time until any input arrives. Keyboard players press a key; touch
   * players tap the USE button, whose press the banner consumes.
   */
  const settleBanners = async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const b = await page.evaluate(() => ({ mod: Number(game.modBannerTimer) || 0, card: Number(game.biomeCardTimer) || 0 }));
      if (b.mod <= 0 && b.card <= 0) return;
      if (opts.touch) await h.tapText(/^E$/);
      else await h.press('Enter');
      record('note', `dismissed a floor banner (${Math.max(b.mod, b.card).toFixed(1)}s left) with ${opts.touch ? 'a USE tap' : 'Enter'}`);
    }
    throw new Error('a floor banner did not dismiss after 3 inputs');
  };

  /** @type {Harness} */
  const h = {
    page: rawPage,
    url: opts.url,
    touch: opts.touch,

    state: readState,

    async waitForState(names, ms = 10000) {
      const list = Array.isArray(names) ? names : [names];
      try {
        await page.waitForFunction((l) => typeof game !== 'undefined' && l.includes(game.state), list, { timeout: ms, polling: 50 });
      } catch (_) {
        const s = await readState();
        throw new Error(`waitForState(${list.join('|')}) timed out after ${ms}ms; game.state is ${s.state}`);
      }
      const s = await readState();
      record('wait', `reached ${s.state}`, { after: s });
      return s;
    },

    async press(key, pressOpts = {}) {
      const times = pressOpts.times ?? 1;
      const gap = pressOpts.gap ?? 0;
      const holdMs = pressOpts.hold ?? 0;
      for (let i = 0; i < times; i++) {
        await keyTap(key, holdMs);
        if (gap > 0 && i < times - 1) await sleep(gap);
      }
      record('input', `press ${key}${times > 1 ? ` x${times}` : ''}`);
    },

    async hold(key, ms) {
      await page.keyboard.down(key);
      const t = Date.now();
      try {
        await frames(1);
        const left = ms - (Date.now() - t);
        if (left > 0) await sleep(left);
      } finally {
        await page.keyboard.up(key);
      }
      await frames(1);
      record('input', `hold ${key} ${Date.now() - t}ms`);
    },

    async type(text) {
      await page.keyboard.type(text, { delay: 60 });
      await frames(2);
      record('input', `type ${JSON.stringify(text)}`);
    },

    async tapLogical(x, y) {
      const c = await toClient({ x, y });
      if (opts.touch) await page.touchscreen.tap(c.x, c.y);
      else await page.mouse.click(c.x, c.y);
      await frames(2);
      const r1 = (/** @type {number} */ v) => Math.round(v * 10) / 10;
      record('input', `${opts.touch ? 'tap' : 'click'} logical (${r1(x)}, ${r1(y)}) = client (${r1(c.x)}, ${r1(c.y)})`);
    },

    async findText(pattern, findOpts = {}) {
      const re = textMatcher(pattern);
      const found = await pollTexts(`${re}`, (texts, geom) => pickText(texts, re, { width: geom.canvasWidth, height: geom.canvasHeight }).match,
        findOpts.timeoutMs ?? 2000);
      record('observe', `find text ${re}`, { value: found });
      return found;
    },

    async tapText(pattern) {
      const found = await h.findText(pattern);
      if (opts.touch) await page.touchscreen.tap(found.client.x, found.client.y);
      else await page.mouse.click(found.client.x, found.client.y);
      await frames(2);
      const r1 = (/** @type {number} */ v) => Math.round(v * 10) / 10;
      record('input', `${opts.touch ? 'tap' : 'click'} text ${JSON.stringify(found.text)} at client (${r1(found.client.x)}, ${r1(found.client.y)})`);
      return found;
    },

    async clickText(pattern) {
      const found = await h.findText(pattern);
      await page.mouse.click(found.client.x, found.client.y);
      await frames(2);
      const r1 = (/** @type {number} */ v) => Math.round(v * 10) / 10;
      record('input', `click text ${JSON.stringify(found.text)} at client (${r1(found.client.x)}, ${r1(found.client.y)})`);
      return found;
    },

    async visibleTexts() {
      const { texts, geom } = await snapshotTexts();
      const found = texts.map((t) => toFound(t, geom));
      record('observe', 'visible canvas texts', { value: found.map((f) => f.text) });
      return found;
    },

    async rowText(label, value, rowOpts = {}) {
      const within = rowOpts.within ?? 12;
      const seen = { row: /** @type {ReturnType<typeof rowValue> | null} */ (null), zoom: 1 };
      let found;
      try {
        found = await pollTexts(`${textMatcher(value)} on the ${textMatcher(label)} row`, (texts, geom) => {
          seen.zoom = geom.zoom > 0 ? geom.zoom : 1;
          seen.row = rowValue(texts, label, value, { within: within * seen.zoom, canvasWidth: geom.canvasWidth, slack: 2 * seen.zoom });
          return seen.row.match;
        }, 2000);
      } catch (err) {
        const r = seen.row;
        if (!r || !r.column || !r.label || r.misplaced.length === 0) throw err;
        const { column, label: labelText } = r;
        const why = r.misplaced.map((t) => misplacedValueMessage(labelText, t, column, seen.zoom)).join('; ');
        throw new Error(`${textMatcher(value)} is drawn on the ${textMatcher(label)} row but not in its value column: ${why}`);
      }
      record('observe', `row ${textMatcher(label)} shows ${JSON.stringify(found.text)}`, { value: found });
      return found;
    },

    async highlight(label, key, hlOpts = {}) {
      const max = hlOpts.max ?? 40;
      const re = textMatcher(label);
      for (let n = 0; ; n++) {
        const { texts } = await snapshotTexts();
        const r = isHighlighted(texts, re);
        if (!r.found) {
          const shown = [...new Set(texts.map((t) => t.text))].slice(0, 60).map((s) => JSON.stringify(s)).join(', ');
          throw new Error(`highlight: no visible canvas text matches ${re}; visible strings: ${shown}`);
        }
        if (r.highlighted) {
          record('observe', `${re} is drawn highlighted after ${n} x ${key}`);
          return;
        }
        if (n >= max) throw new Error(`highlight: ${re} was not drawn highlighted after ${max} presses of ${key}`);
        await h.press(key);
      }
    },

    async shot(label) {
      const file = await screenshot(label);
      record('shot', label, { screenshot: path.basename(file) });
      return file;
    },

    async step(label, fn) {
      const before = await readState();
      const entry = record('step', label, { before, after: null, ok: null, ms: 0, screenshot: null });
      log(`[step] ${label}`);
      stepStack.push(label);
      const started = Date.now();
      try {
        const result = await fn();
        entry.ok = true;
        return result;
      } catch (err) {
        entry.ok = false;
        entry.error = err instanceof Error ? err.message : String(err);
        throw err;
      } finally {
        stepStack.pop();
        entry.ms = Date.now() - started;
        entry.after = await readState().catch(() => null);
        entry.screenshot = await screenshot(entry.ok ? label : `${label}-FAILED`).then((f) => path.basename(f)).catch(() => null);
      }
    },

    check(cond, msg, detail) {
      const ok = !!cond;
      record('check', msg, { ok, detail: detail === undefined ? null : detail });
      log(`[check] ${ok ? 'PASS' : 'FAIL'} ${msg}`);
      if (!ok) throw new CheckError(`check failed: ${msg}${detail === undefined ? '' : ` (${JSON.stringify(detail)})`}`);
    },

    async setup(label, fn, arg) {
      const before = await readState();
      const value = await page.evaluate(/** @type {any} */ (fn), arg);
      const after = await readState();
      record('setup', `SETUP: ${label}`, { note: 'page.evaluate write to game internals: setup only, never proof', value, before, after });
      log(`[setup] ${label}`);
      return value;
    },

    async observe(label, fn, arg) {
      const value = await page.evaluate(/** @type {any} */ (fn), arg);
      record('observe', label, { value });
      return value;
    },

    async storage(key) {
      const value = await page.evaluate(pageReadStorage, key);
      record('observe', `localStorage ${key}`, { value });
      return value;
    },

    frames,

    sleep: (ms) => page.waitForTimeout(ms),

    note(text) {
      record('note', text);
    },

    async reload() {
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => typeof game !== 'undefined' && game.state === 'MENU', undefined, { timeout: 15000 });
      await frames(3);
      const s = await readState();
      record('input', 'reload page', { after: s });
      return s;
    },

    async menuSelect(prefix) {
      return h.step(`menuSelect ${prefix}`, async () => {
        await h.waitForState('MENU');
        // Touch: tap the row by its visible label (platform.js maps taps to rows).
        // Keyboard: MENU ignores the mouse position (a click activates the
        // highlighted row), so arrow to the row by its index in the menu model.
        const label = new RegExp(`(?:^|\\s)${textMatcher(prefix).source}`);
        for (let attempt = 0; attempt < 2; attempt++) {
          if (opts.touch) {
            await h.tapText(label);
          } else {
            const menu = await h.observe('main menu rows', pageMenuInfo);
            const target = menu.options.findIndex((/** @type {{ label: string }} */ o) => o.label.startsWith(prefix));
            if (target < 0) {
              throw new Error(`no MENU row starts with ${JSON.stringify(prefix)}; rows: ${menu.options.map((/** @type {{ label: string }} */ o) => o.label).join(' | ')}`);
            }
            for (let n = 0; n <= menu.options.length && (await page.evaluate(() => game.menuSel | 0)) !== target; n++) {
              await h.press('ArrowDown');
            }
            await h.press('Enter');
          }
          await page.waitForFunction(() => game.state !== 'MENU' || !!game._newGameConfirm, undefined, { timeout: 1200 }).catch(() => {});
          if ((await readState()).state !== 'MENU') break;
          h.note('first activation on MENU was consumed as the title-music unlock gesture; activating again');
        }
        return readState();
      });
    },

    async bootRun(bootOpts = {}) {
      const seed = bootOpts.seed;
      return h.step(`bootRun${seed ? ` seed=${seed}` : ''}`, async () => {
        await h.menuSelect('BOOT SESSION');
        await h.waitForState('SEED_SETUP', 5000);

        if (seed != null) {
          const before = await h.observe('seed field before edit', pageSeedField);
          if (opts.touch) {
            // The field draws the seed plus a blinking cursor; tapping it focuses a
            // hidden <input aria-label="Run seed"> (the phone keyboard path).
            await h.tapText(new RegExp(`^${textMatcher(before).source}[_ ]?$`));
            const focused = await page.evaluate(() => (document.activeElement && document.activeElement.getAttribute('aria-label')) || '');
            if (focused !== 'Run seed') throw new Error(`seed field tap did not focus the Run seed input (focused: ${focused || 'nothing'})`);
          }
          if (before.length) await h.press('Backspace', { times: before.length });
          await h.type(seed);
          const after = await h.observe('seed field after typing', pageSeedField);
          if (after !== seed) throw new Error(`seed field shows ${JSON.stringify(after)}, expected ${JSON.stringify(seed)}`);
          // The field must draw what was typed (plus the blinking cursor).
          await h.findText(new RegExp(`^${textMatcher(seed).source}[_ ]?$`));
        }

        if (opts.touch) {
          await h.tapText(/^START$/);
        } else {
          await h.highlight(/^START$/, 'ArrowLeft', { max: 3 });
          await h.press('Enter');
        }
        let s = await h.waitForState(['INTRO', 'SYSTEM_MESSAGE', 'PLAYING', 'MENU'], 10000);
        if (s.state === 'MENU') {
          const info = await h.observe('new-game confirm dialog', pageMenuInfo);
          if (!info.confirm) throw new Error('START returned to MENU without the KEEP/RESET dialog');
          if (opts.touch) await h.tapText(/KEEP UNLOCKS/);
          else await h.press('Enter');
          s = await h.waitForState(['INTRO', 'SYSTEM_MESSAGE', 'PLAYING'], 10000);
        }
        if (s.state === 'INTRO') {
          if (opts.touch) {
            // Any tap advances a slide; the intro has no tappable label.
            for (let n = 0; n < 12 && (await readState()).state === 'INTRO'; n++) {
              await h.tapLogical(s.W / 2, s.H / 2);
              await h.sleep(250);
            }
          } else {
            await h.press('Escape');
          }
          await h.waitForState(['SYSTEM_MESSAGE', 'PLAYING'], 10000);
        }
        await h.ackMessages();
        await h.waitForState('PLAYING', 5000);
        await settleBanners();
        return readState();
      });
    },

    async ackMessages() {
      let count = 0;
      for (let guard = 0; guard < 12; guard++) {
        await frames(3);
        if ((await readState()).state !== 'SYSTEM_MESSAGE') break;
        const msg = await h.observe('system prompt', pageSystemMessage);
        await page.waitForFunction(() => !(game.systemMessageAckTimer > 0), undefined, { timeout: 5000 });
        if (opts.touch) await h.tapText(/^TAP ACK$/);
        else await h.press('KeyX');
        await page.waitForFunction((id) => {
          const m = game.state === 'SYSTEM_MESSAGE' ? game.getActiveSystemMessage() : null;
          return !m || m.id !== id;
        }, msg.id, { timeout: 5000 });
        count += 1;
      }
      return count;
    },

    async openCheats(rows) {
      await h.step(`openCheats ${rows.join(', ')}`, async () => {
        const start = await readState();
        if (opts.touch) {
          if (start.state !== 'PLAYING') throw new Error('openCheats on touch needs PLAYING: the HACK/USE/DASH buttons only exist during play');
          // HACK (F), USE (E), USE (E), DASH (⇧): the F E E Shift sequence on the on-screen buttons.
          for (const glyph of [/^F$/, /^E$/, /^E$/, /^⇧$/]) await h.tapText(glyph);
        } else {
          if (start.state === 'PLAYING') {
            await h.press('Escape');
            await h.waitForState('PAUSED', 3000);
          }
          for (const key of ['KeyF', 'KeyE', 'KeyE', 'ShiftLeft']) await h.press(key);
        }
        await h.waitForState('CHEATS', 3000);
        await frames(2); // the hatch ignores input on the frame it opens
        for (const name of rows) {
          // Rows are drawn as "<hot key>. <NAME>" with ONLINE/OFFLINE on the same row.
          const label = new RegExp(`^(\\d+)\\. ${textMatcher(name).source}$`);
          const before = await h.rowText(label, /^(ONLINE|OFFLINE)$/);
          if (before.text === 'ONLINE') continue;
          if (opts.touch) {
            await h.tapText(label);
          } else {
            const row = await h.findText(label);
            const hot = (label.exec(row.text) || [])[1];
            await h.press(`Digit${hot}`);
          }
          const after = await h.rowText(label, /^(ONLINE|OFFLINE)$/);
          if (after.text !== 'ONLINE') throw new Error(`cheat row ${name} still shows ${after.text}`);
        }
        if (opts.touch) await h.tapText(/^CLOSE$/);
        else await h.press('Escape');
        const back = await h.waitForState(['PLAYING', 'PAUSED'], 3000);
        if (back.state === 'PAUSED' && start.state === 'PLAYING') {
          await h.press('Escape');
          await h.waitForState('PLAYING', 3000);
        }
      });
    },

    async walkTo(tx, ty, walkOpts = {}) {
      return h.step(`walkTo (${tx},${ty})`, async () => {
        const deadline = Date.now() + (walkOpts.timeoutMs || 60000);
        /** @type {[string, number][]} */
        const bursts = [];
        let speed = 0;
        let stalls = 0;
        try {
          while (Date.now() < deadline) {
            const s = await readState();
            if (s.state === 'SYSTEM_MESSAGE') { await h.ackMessages(); continue; }
            if (s.state === 'POWERUP_CHOICE' || s.state === 'WEAPON_SWAP') {
              h.note(`walkTo stepped on a pickup and declined its ${s.state} modal (SKIP)`);
              await h.sleep(300);
              if (opts.touch) await h.tapText(/^SKIP/);
              else await h.press('Escape');
              continue;
            }
            if (s.state !== 'PLAYING' || s.x === null || s.y === null) throw new Error(`walkTo interrupted: game.state is ${s.state}`);
            if (Math.floor(s.x) === tx && Math.floor(s.y) === ty) return s;
            await settleBanners();
            const onX = Math.floor(s.x) !== tx;
            const delta = onX ? tx + 0.5 - s.x : ty + 0.5 - s.y;
            const key = onX ? (delta > 0 ? 'ArrowRight' : 'ArrowLeft') : (delta > 0 ? 'ArrowDown' : 'ArrowUp');
            // Aim for the tile centre; moveBurst never releases before a frame saw the input.
            const ms = speed > 0 ? Math.max(0, Math.min(3000, (Math.abs(delta) - 0.2) / speed)) : 150;
            const held = await moveBurst(key, ms);
            await frames(1);
            bursts.push([key, held]);
            const s2 = await readState();
            const moved = Math.abs(onX ? (s2.x || 0) - s.x : (s2.y || 0) - s.y);
            if (moved > 0.05) {
              speed = Math.max(speed * 0.5, moved / Math.max(1, held));
              stalls = 0;
            } else if (++stalls >= 4) {
              throw new Error(`walkTo stuck at (${s2.x},${s2.y}) moving ${key} over 4 frame-confirmed bursts; a wall is in the way. Turn on NO-CLIP first: h.openCheats(['NO-CLIP'])`);
            }
          }
          throw new Error(`walkTo (${tx},${ty}) timed out`);
        } finally {
          record('input', `walkTo (${tx},${ty}) used ${bursts.length} ${opts.touch ? 'joystick drags' : 'arrow-key holds'}`, { bursts });
        }
      });
    },

    async takeStairs() {
      return h.step('takeStairs', async () => {
        const start = await readState();
        const stairs = await h.observe('nearest STAIRS tile', pageFindStairs);
        if (!stairs) throw new Error('no STAIRS tile on this floor (boss floors descend through a CORE terminal after the boss dies)');
        await h.walkTo(stairs.x, stairs.y);
        if (opts.touch) await h.tapText(/^E$/);
        else await h.press('KeyE');
        await h.waitForState('HUB', 5000);
        if (opts.touch) {
          await h.tapText(/▼ DESCEND/);
        } else {
          await h.findText(/\[SPACE\] DESCEND/);
          await h.press('Space');
        }
        const next = (start.floor || 0) + 1;
        await page.waitForFunction((f) => game.floor === f && (game.state === 'PLAYING' || game.state === 'SYSTEM_MESSAGE'), next, { timeout: 30000 });
        await h.ackMessages();
        await settleBanners();
        return readState();
      });
    },

    async quitToMenu() {
      return h.step('quitToMenu', async () => {
        if (opts.touch) {
          await h.tapText(/^II$/);
          await h.waitForState('PAUSED', 3000);
          await h.tapText(/^QUIT TO MENU$/);
        } else {
          await h.press('Escape');
          await h.waitForState('PAUSED', 3000);
          await h.findText(/— Quit to Menu$/);
          await h.press('KeyQ');
        }
        return h.waitForState('MENU', 5000);
      });
    },
  };

  const gotoGame = async () => {
    await page.goto(opts.url, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof game !== 'undefined' && game.state === 'MENU', undefined, { timeout: 20000 });
    await frames(3);
    record('input', `open ${opts.url}`, { after: await readState() });
  };

  /**
   * Closes the browser and writes the evidence files.
   * @param {{ name: string, script: string | null, threw: boolean, error: unknown, interrupted?: string | null,
   *   requireChecks?: boolean, extra?: Record<string, unknown> }} fin
   */
  const finish = async (fin) => {
    let storage = null;
    let finalState = null;
    const failedEarly = fin.threw || !!fin.interrupted;
    try { finalState = await readState(); } catch (_) { /* page may be gone */ }
    try { await h.shot(failedEarly ? 'final-FAILED' : 'final'); } catch (_) { /* best effort */ }
    try { storage = await page.evaluate(pageDumpStorage); } catch (_) { /* best effort */ }
    const playwrightVersion = require('playwright-core/package.json').version;
    const browserVersion = browser.version();
    await browser.close().catch(() => {});
    restoreTmp();

    const noise = rec.console.filter((m) => classifyConsole(m, allowedOrigin) === 'noise');
    const consoleErrors = rec.console.filter((m) => classifyConsole(m, allowedOrigin) === 'error');
    const httpErrors = rec.httpErrors.filter((r) => new URL(r.url).pathname !== '/favicon.ico');
    const unexpected = [
      ...rec.pageErrors.map((e) => `pageerror: ${e.message.split('\n')[0]}`),
      ...consoleErrors.map((m) => `console.error: ${m.text}`),
      ...httpErrors.map((r) => `http ${r.status}: ${r.url}`),
    ];
    const count = (/** @type {string} */ kind) => rec.entries.filter((e) => e.kind === kind).length;
    const checks = rec.entries.filter((e) => e.kind === 'check');
    const outcome = driveOutcome({
      threw: fin.threw,
      interrupted: fin.interrupted || null,
      entries: rec.entries,
      unexpected,
      requireChecks: fin.requireChecks,
    });
    const errorText = fin.threw
      ? (fin.error instanceof Error ? fin.error.message : `thrown value: ${String(fin.error)}`)
      : (fin.interrupted ? `interrupted by ${fin.interrupted}` : null);
    const dir = opts.evidenceDir;

    fs.writeFileSync(path.join(dir, 'transcript.json'), JSON.stringify({
      name: fin.name,
      script: fin.script,
      url: opts.url,
      viewport: opts.viewport,
      touch: opts.touch,
      chromium: { ...chromiumChoice, version: browserVersion },
      playwrightCore: playwrightVersion,
      startedAt: new Date(t0).toISOString(),
      entries: rec.entries,
      finalState,
    }, null, 2) + '\n');
    fs.writeFileSync(path.join(dir, 'console.log'), [
      ...rec.console.map((m) => `+${m.t}ms [console.${m.type}]${classifyConsole(m, allowedOrigin) === 'noise' ? ' [noise]' : ''} ${m.text}${m.url ? `  (${m.url}:${m.line})` : ''}`),
      ...rec.pageErrors.map((e) => `+${e.t}ms [pageerror] ${e.message}`),
      ...rec.httpErrors.map((r) => `+${r.t}ms [http ${r.status}] ${r.url}`),
    ].join('\n') + '\n');
    fs.writeFileSync(path.join(dir, 'blocked-requests.txt'), [
      `# requests refused because they were not to ${allowedOrigin}`,
      ...(rec.blocked.length ? rec.blocked.map((b) => `+${b.t}ms ${b.layer} ${b.method} ${b.type} ${b.url}`) : ['# none']),
    ].join('\n') + '\n');
    fs.writeFileSync(path.join(dir, 'storage.json'), JSON.stringify(storage, null, 2) + '\n');
    const summary = {
      ok: outcome.ok,
      reasons: outcome.reasons,
      name: fin.name,
      script: fin.script,
      url: opts.url,
      evidenceDir: dir,
      viewport: `${opts.viewport.label} ${opts.viewport.width}x${opts.viewport.height}`,
      touch: opts.touch,
      chromium: { ...chromiumChoice, version: browserVersion },
      durationMs: Date.now() - t0,
      counts: {
        steps: count('step'),
        stepsFailed: rec.entries.filter((e) => e.kind === 'step' && e.ok !== true).length,
        checks: checks.length,
        checksFailed: checks.filter((c) => c.ok !== true).length,
        setups: count('setup'),
        observations: count('observe'),
        inputs: count('input'),
        screenshots: listFilesRecursive(dir).filter((f) => f.endsWith('.png')).length,
        blockedRequests: rec.blocked.length,
        pageErrors: rec.pageErrors.length,
        consoleErrors: consoleErrors.length,
        httpErrors: httpErrors.length,
        noiseFiltered: noise.length,
      },
      failure: errorText,
      unexpectedErrors: unexpected.slice(0, 20),
      finalState,
      ...(fin.extra || {}),
    };
    fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
    return summary;
  };

  return { h, page, gotoGame, finish, chromiumChoice, rec, allowedOrigin };
}

// ─── Commands ────────────────────────────────────────────────────────────────

/**
 * The server's READY line: `READY <url> pid=<pid>`.
 * @param {string} text log output
 * @returns {{ url: string, pid: number } | null}
 */
function parseReadyLine(text) {
  const m = /^READY (http:\/\/\S+) pid=(\d+)$/m.exec(text);
  return m && m[1] && m[2] ? { url: m[1], pid: Number(m[2]) } : null;
}

/**
 * Waits for the READY line this launch's server writes, and fails once the
 * server has exited, even if it printed READY first: a dead server is never
 * recorded as ready. `readLog` returns only the log text written after this
 * launch spawned its server, so a previous server's READY line in the same
 * log is never mistaken for this one, and the line must name this child's
 * pid.
 * @param {() => string} readLog
 * @param {{ pid?: number, exitCode: number | null, signalCode: string | null,
 *   once(event: 'exit', listener: (code: number | null, signal: string | null) => void): unknown }} child
 * @param {number} timeoutMs
 * @param {string} [logPath] for messages
 */
async function waitForReady(readLog, child, timeoutMs, logPath = 'the server log') {
  const exit = { seen: false };
  child.once('exit', () => { exit.seen = true; });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const text = readLog();
    const ready = parseReadyLine(text);
    if (exit.seen || child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`verify-serve exited (code ${child.exitCode}, signal ${child.signalCode}) ` +
        `${ready ? 'after printing READY' : 'before READY'}; see ${logPath}:\n${text}`);
    }
    if (ready) {
      if (ready.pid !== child.pid) throw new Error(`READY line names pid ${ready.pid}, but this launch started pid ${child.pid}`);
      return ready.url;
    }
    await sleep(50);
  }
  throw new Error(`verify-serve did not print READY within ${timeoutMs}ms (see ${logPath})`);
}

/**
 * SIGINT/SIGTERM/SIGHUP handling for a command's lifetime. The first signal
 * rejects `interrupted` so the command can write its evidence and exit 130;
 * a second signal exits at once.
 */
function trapSignals() {
  /** @type {(err: Error) => void} */
  let reject = () => {};
  /** @type {Promise<never>} */
  const interrupted = new Promise((_, rej) => { reject = rej; });
  interrupted.catch(() => {});
  const state = { signal: /** @type {string | null} */ (null) };
  /** @param {NodeJS.Signals} sig */
  const handler = (sig) => {
    if (state.signal) {
      console.error(`${sig} again: exiting without waiting for evidence`);
      process.exit(130);
    }
    state.signal = sig;
    console.error(`${sig}: stopping, writing evidence, then exiting 130`);
    reject(new Error(`interrupted by ${sig}`));
  };
  const signals = /** @type {NodeJS.Signals[]} */ (['SIGINT', 'SIGTERM', 'SIGHUP']);
  for (const s of signals) process.on(s, handler);
  return { state, interrupted, release: () => { for (const s of signals) process.removeListener(s, handler); } };
}

/** @param {CliFlags} flags */
async function cmdLaunch(flags) {
  const root = path.resolve(flags.root || DEFAULT_ROOT);
  if (!fileExists(path.join(root, 'index.html'))) throw new UsageError(`--root ${root} has no index.html`);

  // Signal handlers go in before anything is created. Node runs them from the
  // event loop, so they see exactly what this launch has created by then.
  // Every cleanup path removes a file only while it still carries this
  // launch's token: never a lock or record another launch has written since.
  const token = crypto.randomBytes(16).toString('hex');
  const made = {
    lock: /** @type {string | null} */ (null),
    record: /** @type {string | null} */ (null),
    child: /** @type {import('node:child_process').ChildProcess | null} */ (null),
  };
  // What cleanup did to each of this launch's files.
  /** @param {string} file @param {string} tok @returns {Claim} */
  const release = (file, tok) => removeIfOwned(file, tok);
  const cleanup = () => {
    const pid = made.child && made.child.pid;
    if (pid) {
      try { process.kill(pid, 'SIGKILL'); } catch (_) { /* already gone */ }
    }
    /** @type {{ record: Claim | null, lock: Claim | null }} */
    const fate = { record: null, lock: null };
    if (made.record) {
      fate.record = release(made.record, token);
      fs.rmSync(`${made.record}.${process.pid}.tmp`, { force: true });
    }
    if (made.lock) fate.lock = release(made.lock, token);
    return fate;
  };
  /** @param {NodeJS.Signals} sig */
  const onSignal = (sig) => {
    const hadServer = !!(made.child && made.child.pid);
    const fate = cleanup();
    /** @param {Claim} c */
    const said = (c) => (c.result === 'removed' ? 'removed' : c.result === 'gone' ? 'already gone'
      : c.result === 'foreign' ? 'left in place (another launch owns it now)'
        : `replaced while it was being removed; the replaced copy is left as ${path.basename(c.quarantine || '')}`);
    /** @type {string[]} */
    const notes = [];
    if (hadServer) notes.push('its server was stopped');
    if (fate.record) notes.push(`server.json ${said(fate.record)}`);
    notes.push(fate.lock ? `launch.lock ${said(fate.lock)}` : 'no lock had been taken');
    console.error(`launch interrupted by ${sig}: ${notes.join('; ')}`);
    process.exit(130);
  };
  const signals = /** @type {NodeJS.Signals[]} */ (['SIGINT', 'SIGTERM', 'SIGHUP']);
  for (const s of signals) process.on(s, onSignal);
  try {
    const runDir = flags.runDir ? path.resolve(flags.runDir) : createRunDir(flags.name || path.basename(root));
    fs.mkdirSync(runDir, { recursive: true });

    // One launch per run dir: the lock exists from here until `stop` removes
    // it. It is written complete to a temp file and hard-linked into place,
    // which fails if a lock exists, so nobody ever reads a half-written lock.
    const lockPath = path.join(runDir, 'launch.lock');
    const lockTmp = `${lockPath}.${process.pid}.tmp`;
    fs.writeFileSync(lockTmp, JSON.stringify({ token, launcherPid: process.pid, createdAt: new Date().toISOString() }) + '\n');
    try {
      fs.linkSync(lockTmp, lockPath);
    } catch (err) {
      if (/** @type {NodeJS.ErrnoException} */ (err).code !== 'EEXIST') throw err;
      const lock = readLock(lockPath);
      const holder = lock.kind === 'present' && lock.launcherPid !== null ? `, taken by launcher pid ${lock.launcherPid}` : '';
      throw new RefusedError(`${runDir} is locked by another launch (launch.lock${holder}). ${stopHint(runDir)}`);
    } finally {
      fs.rmSync(lockTmp, { force: true });
    }
    made.lock = lockPath;

    // A record left by any other launch (valid, unreadable or foreign) is
    // never overwritten: its server may still be running.
    const serverJson = path.join(runDir, 'server.json');
    const existing = readServerRecord(runDir);
    if (existing.kind !== 'missing') {
      removeIfOwned(lockPath, token);
      made.lock = null;
      const detail = existing.kind === 'unreadable' ? `unreadable: ${existing.why}`
        : `${existing.kind === 'foreign' ? `foreign, run ${existing.record.runDir}, ` : ''}server pid ${existing.record.pid}, ${existing.record.status}`;
      throw new RefusedError(`${serverJson} already exists (${detail}); launch never overwrites another launch's record, ` +
        `and released only its own lock. ${stopHint(runDir)}`);
    }

    const logPath = path.join(runDir, 'server.log');
    const offset = fs.existsSync(logPath) ? fs.statSync(logPath).size : 0;
    const fd = fs.openSync(logPath, 'a');
    try {
      made.child = spawn(process.execPath, [SERVE_SCRIPT, '--root', root, '--port', '0', '--run-dir', runDir], {
        detached: true,
        stdio: ['ignore', fd, fd],
      });
    } finally {
      fs.closeSync(fd);
    }
    const child = made.child;
    const serverPid = child.pid;
    if (!serverPid) throw new Error('verify-serve did not start');
    // Alive by Node's exit event and by /proc (which sees a death Node has not reported yet).
    const serverAlive = () => child.exitCode === null && child.signalCode === null && processInfo(serverPid).alive;
    // Record the pid before waiting, so an interrupted launch can always be stopped.
    /** @type {ServerRecord} */
    const record = { pid: serverPid, url: null, status: 'starting', root, runDir, startedAt: new Date().toISOString(), head: gitHead(root), token };
    made.record = serverJson;
    writeServerRecord(serverJson, record);
    const readLog = () => (fs.existsSync(logPath) ? fs.readFileSync(logPath).subarray(offset).toString('utf8') : '');
    record.url = await waitForReady(readLog, child, 15000, logPath);
    if (!serverAlive()) throw new Error(`verify-serve pid ${serverPid} exited after printing READY; it is not recorded as ready`);
    record.status = 'ready';
    if (fileToken(serverJson) !== token || fileToken(lockPath) !== token) {
      throw new Error(`${runDir}: server.json or launch.lock was replaced while this launch waited for READY; stopping its server`);
    }
    writeServerRecord(serverJson, record);
    if (!serverAlive()) throw new Error(`verify-serve pid ${serverPid} exited just after it was recorded as ready`);
    child.unref();
    console.log(`READY ${record.url}`);
    console.log(`RUN_DIR ${runDir}`);
    console.log(`PID ${record.pid}  ROOT ${root}  HEAD ${record.head}`);
    // The handlers stay installed until the process exits: a signal that
    // lands after READY still cancels the launch, so exit 0 always means a
    // recorded, running server and exit 130 always means nothing was left.
    return 0;
  } catch (err) {
    cleanup();
    for (const s of signals) process.removeListener(s, onSignal);
    throw err;
  }
}

/**
 * The checks that tie a target to this run. Doctor prints them; drive runs
 * the same function and refuses on any FAIL, so the two cannot drift.
 * - server-process: the recorded pid is alive, and its argv is verify-serve.js
 *   for this --run-dir and the recorded --root.
 * - http-root: GET / answers 200 with the canvas, byte-identical to the
 *   recorded root's index.html.
 * - version-json: /version.json names the recorded pid, this run dir and the
 *   recorded root (the root the server actually serves), and its commit is
 *   the root's HEAD.
 * A --url target has no process or record; its rows only check that it
 * serves the game and a release version.
 * @param {{ runDir: string, url: string, record: ServerRecord | null }} target
 * @returns {Promise<{ rows: CheckRow[], ok: boolean, expectedVersion: string }>}
 */
async function checkServer(target) {
  /** @type {CheckRow[]} */
  const rows = [];
  /**
   * @param {CheckRow['status']} status
   * @param {string} name
   * @param {string} detail
   */
  const add = (status, name, detail) => { rows.push({ status, name, detail }); };
  const record = target.record;

  if (record) {
    const info = processInfo(record.pid);
    if (!info.alive) add('FAIL', 'server-process', `pid ${record.pid} is not running; launch again`);
    else if (!isOurServer(info.args, target.runDir, record.root)) {
      add('FAIL', 'server-process', `pid ${record.pid} is not verify-serve for ${target.runDir} serving ${record.root}: ${info.args.join(' ')}`);
    } else add('PASS', 'server-process', `pid ${record.pid} alive; cmdline has verify-serve.js --root ${record.root} --run-dir ${target.runDir}`);
  } else {
    add('INFO', 'server-process', `remote target ${target.url} (no local process)`);
  }

  try {
    const res = await fetch(target.url, { cache: 'no-store' });
    const body = await res.text();
    const hasCanvas = body.includes('<canvas id="c">');
    const same = record ? body === fs.readFileSync(path.join(record.root, 'index.html'), 'utf8') : true;
    add(res.status === 200 && hasCanvas && same ? 'PASS' : 'FAIL', 'http-root', `GET / ${res.status}; <canvas id="c"> ${hasCanvas ? 'present' : 'MISSING'}` +
      (record ? `; ${same ? 'bytes match' : 'DIFFERS FROM'} ${record.root}/index.html` : ''));
  } catch (err) {
    add('FAIL', 'http-root', `GET / failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  let expectedVersion = LOCAL_VERSION;
  try {
    const res = await fetch(new URL('version.json', target.url), { cache: 'no-store' });
    const meta = /** @type {{ version?: string, tag?: string, commit?: string, pid?: number, runDir?: string | null, root?: string }} */ (await res.json());
    if (record) {
      const head = gitHead(record.root);
      const sameRun = meta.pid === record.pid && typeof meta.runDir === 'string' && path.resolve(meta.runDir) === target.runDir;
      const sameRoot = typeof meta.root === 'string' && path.resolve(meta.root) === path.resolve(record.root);
      const ok = res.status === 200 && meta.version === LOCAL_VERSION && meta.commit === head && sameRun && sameRoot;
      add(ok ? 'PASS' : 'FAIL', 'version-json', `version ${meta.version} commit ${meta.commit} ${meta.commit === head ? '==' : '!='} HEAD ${head} of ${record.root}; ` +
        `answered by pid ${meta.pid} for ${sameRun ? 'this run' : `run ${meta.runDir} (NOT this run: expected pid ${record.pid}, run dir ${target.runDir})`}; ` +
        `serving ${sameRoot ? 'the recorded root' : `${meta.root} (NOT the recorded root ${record.root})`}`);
    } else {
      expectedVersion = String(meta.version || '');
      add(res.status === 200 && expectedVersion ? 'PASS' : 'FAIL', 'version-json', `version ${meta.version} tag ${meta.tag} commit ${meta.commit}`);
    }
  } catch (err) {
    add('FAIL', 'version-json', `could not read version.json: ${err instanceof Error ? err.message : String(err)}`);
  }
  return { rows, ok: rows.every((r) => r.status !== 'FAIL'), expectedVersion };
}

/** @param {CheckRow} r */
function formatRow(r) {
  return `${r.status.padEnd(5)} ${r.name.padEnd(15)} ${r.detail}`;
}

/** @param {CliFlags} flags */
async function cmdDoctor(flags) {
  const target = resolveTarget(flags, 'doctor-live');
  /** @type {CheckRow[]} */
  const rows = [];
  /**
   * @param {CheckRow['status']} status
   * @param {string} name
   * @param {string} detail
   */
  const add = (status, name, detail) => {
    rows.push({ status, name, detail });
    console.log(formatRow({ status, name, detail }));
  };
  const local = !!target.record;

  const server = await checkServer(target);
  for (const r of server.rows) add(r.status, r.name, r.detail);
  const expectedVersion = server.expectedVersion;

  const viewport = parseViewport(flags.viewport || 'desktop');
  const evidenceDir = uniqueDir(path.join(target.runDir, 'doctor'));
  const signals = trapSignals();
  /** @type {Awaited<ReturnType<typeof openSession>> | null} */
  let session = null;
  try {
    session = await openSession({ url: target.url, viewport, touch: !!flags.touch, evidenceDir });
    const s = session;
    add('INFO', 'chromium', `${s.chromiumChoice.path} (source: ${s.chromiumChoice.source})`);
    if (s.chromiumChoice.warning) add('INFO', 'chromium-warn', s.chromiumChoice.warning);
    const t = Date.now();
    const info = await Promise.race([
      (async () => {
        await s.gotoGame();
        await s.page.waitForFunction(() => typeof appVersion !== 'undefined' && appVersion !== '', undefined, { timeout: 5000 }).catch(() => {});
        await s.h.sleep(1000);
        return s.page.evaluate(pageDoctorInfo);
      })(),
      signals.interrupted,
    ]);
    const shotPath = await s.h.shot('doctor-menu');
    const summary = await s.finish({ name: 'doctor', script: null, threw: false, error: null, requireChecks: false, extra: { doctor: info } });
    session = null;
    const errs = summary.counts.pageErrors + summary.counts.consoleErrors + summary.counts.httpErrors;
    const versionOk = info.appVersion === expectedVersion;
    add(info.state === 'MENU' && errs === 0 && versionOk ? 'PASS' : 'FAIL', 'browser-boot',
      `game.state=${info.state} after ${Date.now() - t}ms; ${errs} unexpected error(s), ${summary.counts.noiseFiltered} noise filtered; ` +
      `appVersion=${info.appVersion}${versionOk ? '' : ` (expected ${expectedVersion})`}`);
    for (const e of summary.unexpectedErrors) add('INFO', 'error', e);
    add('INFO', 'layout', `W=${info.W} H=${info.H} compact=${info.compact} worldZoom=${info.worldZoom} touchDevice=${info.touchDevice} ` +
      `(viewport ${viewport.label} ${viewport.width}x${viewport.height}, canvas ${info.canvas.canvasWidth}x${info.canvas.canvasHeight})`);
    add('INFO', 'blocked', `${summary.counts.blockedRequests} external request(s) refused; see blocked-requests.txt`);
    add('INFO', 'screenshot', shotPath);
  } catch (err) {
    add('FAIL', 'browser-boot', err instanceof Error ? err.message : String(err));
    if (session) {
      await session.finish({ name: 'doctor', script: null, threw: !signals.state.signal, error: err, interrupted: signals.state.signal, requireChecks: false }).catch(() => {});
    }
  } finally {
    signals.release();
  }
  const failed = rows.filter((r) => r.status === 'FAIL').length;
  fs.writeFileSync(path.join(evidenceDir, 'doctor.json'), JSON.stringify({ ok: failed === 0, url: target.url, local, rows }, null, 2) + '\n');
  console.log(`DOCTOR ${failed === 0 ? 'PASS' : 'FAIL'}  evidence ${evidenceDir}`);
  if (signals.state.signal) return 130;
  return failed === 0 ? 0 : 1;
}

/** @param {string} arg */
function resolveDriveScript(arg) {
  const candidates = [path.resolve(arg), path.join(DRIVES_DIR, arg), path.join(DRIVES_DIR, `${arg}.js`)];
  const found = candidates.find(fileExists);
  if (!found) throw new UsageError(`drive script not found: ${arg} (looked in ${candidates.join(', ')})`);
  return found;
}

/**
 * @param {string[]} positional
 * @param {CliFlags} flags
 */
async function cmdDrive(positional, flags) {
  if (!positional[0]) throw new UsageError('drive needs a script: drive <script.js> --run-dir DIR');
  const script = resolveDriveScript(positional[0]);
  const viewport = parseViewport(flags.viewport || 'desktop');
  const touch = !!flags.touch;
  const name = slug(flags.name || `${path.basename(script, '.js')}-${viewport.label}${touch ? '-touch' : ''}`);
  const target = resolveTarget(flags, name);
  // The doctor's server checks, before any browser: a drive must never test
  // a server that is not this run's (a forged or stale record, a reused port).
  const server = await checkServer(target);
  if (!server.ok) {
    for (const r of server.rows) console.error(formatRow(r));
    throw new RefusedError(`the server recorded for ${target.runDir} failed the doctor checks above, so this drive would not ` +
      `test this run's code. ${stopHint(target.runDir)}`);
  }
  const timeoutMs = Math.max(10, Number(flags.timeout || 300)) * 1000;
  const evidenceDir = uniqueDir(path.join(target.runDir, name));
  const drive = require(script);
  if (typeof drive !== 'function') throw new UsageError(`${script} must export an async function (h) => {}`);

  console.log(`DRIVE ${name}  ${script}`);
  console.log(`  url ${target.url}  viewport ${viewport.label} ${viewport.width}x${viewport.height}  touch=${touch}`);
  const signals = trapSignals();
  let session;
  try {
    session = await openSession({ url: target.url, viewport, touch, evidenceDir, log: (line) => console.log(`  ${line}`) });
  } catch (err) {
    signals.release();
    throw err;
  }
  const s = session;
  console.log(`  chromium ${s.chromiumChoice.path} (source: ${s.chromiumChoice.source})`);
  let threw = false;
  /** @type {unknown} */
  let error = null;
  /** @type {NodeJS.Timeout | undefined} */
  let timer;
  try {
    await Promise.race([
      (async () => {
        await s.gotoGame();
        await drive(s.h);
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`drive timed out after ${timeoutMs / 1000}s`)), timeoutMs); }),
      signals.interrupted,
    ]);
  } catch (err) {
    // Whatever was thrown (even `undefined`) fails the drive; an interrupt is reported as such.
    threw = !signals.state.signal;
    error = err;
  } finally {
    clearTimeout(timer);
  }
  const summary = await s.finish({ name, script, threw, error, interrupted: signals.state.signal });
  signals.release();
  const c = summary.counts;
  console.log(`DRIVE ${summary.ok ? 'PASS' : 'FAIL'} ${name} (${(summary.durationMs / 1000).toFixed(1)}s) steps=${c.steps - c.stepsFailed}/${c.steps} ` +
    `checks=${c.checks - c.checksFailed}/${c.checks} setups=${c.setups} inputs=${c.inputs} shots=${c.screenshots} ` +
    `blocked=${c.blockedRequests} pageErrors=${c.pageErrors} consoleErrors=${c.consoleErrors} httpErrors=${c.httpErrors}`);
  for (const r of summary.reasons) console.log(`  reason: ${r}`);
  if (summary.failure) console.log(`  failure: ${summary.failure}`);
  for (const e of summary.unexpectedErrors) console.log(`  unexpected: ${e}`);
  console.log(`EVIDENCE ${evidenceDir}`);
  if (signals.state.signal) return 130;
  return summary.ok ? 0 : 1;
}

/** @param {CliFlags} flags */
async function cmdStop(flags) {
  if (!flags.runDir) throw new UsageError('stop needs --run-dir DIR');
  const runDir = path.resolve(flags.runDir);
  const lockPath = path.join(runDir, 'launch.lock');
  const serverJson = path.join(runDir, 'server.json');
  /**
   * @param {number} pid
   * @param {NodeJS.Signals} sig
   * @returns {boolean} false when the process was already gone
   */
  const signal = (pid, sig) => {
    try {
      process.kill(pid, sig);
      return true;
    } catch (err) {
      if (/** @type {NodeJS.ErrnoException} */ (err).code === 'ESRCH') return false;
      throw err;
    }
  };
  // Temp files (server.json.<pid>.tmp, launch.lock.<pid>.tmp) whose writer is gone.
  const clearDeadTemps = () => {
    for (const f of listDir(runDir)) {
      const m = /^(?:server\.json|launch\.lock)\.(\d+)\.tmp$/.exec(f);
      if (m && !processInfo(Number(m[1])).alive) fs.rmSync(path.join(runDir, f), { force: true });
    }
  };
  /** @type {string[]} */
  const notes = [];
  // Every removal below claims the file by an atomic rename and judges the
  // claimed copy (removeClaimed): a lock or record another launch writes
  // meanwhile is never deleted.
  /**
   * @param {string} name
   * @param {Claim} claim
   * @param {string} [foreignNote] note when the file was left because it is not the one stop judged
   * @returns {boolean} removed
   */
  const noteClaim = (name, claim, foreignNote) => {
    if (claim.result === 'foreign' && foreignNote) notes.push(foreignNote);
    if (claim.result === 'quarantined') {
      notes.push(`${name} was replaced while stop removed it; the replaced copy is left as ${path.basename(claim.quarantine || '')}`);
    }
    return claim.result === 'removed';
  };

  // A launch still running for this run dir (typically waiting for READY) is
  // stopped through its own handlers: they stop its server and remove exactly
  // the files that launch created, so nothing is pulled out from under it.
  let stoppedLaunch = false;
  const launcher = verifiedLauncher(readLock(lockPath), readServerRecord(runDir), runDir);
  if (launcher !== null) {
    const before = readServerRecord(runDir);
    signal(launcher, 'SIGTERM');
    for (let i = 0; i < 100 && processInfo(launcher).alive; i++) await sleep(100);
    if (processInfo(launcher).alive) {
      console.error(`FAILED  launcher pid ${launcher} is still running 10 s after SIGTERM; nothing else was touched`);
      return 1;
    }
    console.log(`STOPPED  launch in progress (launcher pid ${launcher}${before.kind === 'ok' ? `, server pid ${before.record.pid}` : ''}): ` +
      'its own cleanup stopped its server and removed the files it created');
    stoppedLaunch = true;
  }

  const lock = readLock(lockPath);
  const liveLauncher = lock.kind === 'present' && isLiveLauncher(lock.launcherPid);
  let code = 0;
  const read = readServerRecord(runDir);
  if (read.kind === 'ok') {
    const { record } = read;
    const info = processInfo(record.pid);
    if (!info.alive) {
      console.log(`ALREADY STOPPED  pid ${record.pid} is not running`);
    } else if (!isOurServer(info.args, runDir)) {
      console.error(`REFUSING  pid ${record.pid} is not verify-serve for ${runDir}: ${info.args.join(' ')}`);
      console.error('Nothing was killed. If server.json is stale, delete it (and launch.lock) by hand.');
      return 1;
    } else {
      // A concurrent stop may kill it first: a vanished or exiting process is already stopped.
      let sent = signal(record.pid, 'SIGTERM');
      for (let i = 0; i < 30 && processInfo(record.pid).alive; i++) await sleep(100);
      if (processInfo(record.pid).alive) {
        sent = signal(record.pid, 'SIGKILL') || sent;
        for (let i = 0; i < 20 && processInfo(record.pid).alive; i++) await sleep(100);
      }
      if (processInfo(record.pid).alive) {
        console.error(`FAILED  pid ${record.pid} survived SIGKILL`);
        return 1;
      }
      console.log(sent
        ? `STOPPED  pid ${record.pid} (verify-serve ${record.url || 'never reached READY'})`
        : `ALREADY STOPPED  pid ${record.pid} exited while stop was checking it`);
    }
    noteClaim('server.json', removeIfOwned(serverJson, record.token), 'server.json left in place: another launch has written it since');
    if (lock.kind === 'present') {
      if (lock.token === record.token) noteClaim('launch.lock', removeIfOwned(lockPath, record.token));
      else if (liveLauncher) notes.push(`launch.lock left in place: it belongs to running launcher pid ${lock.launcherPid}`);
      else if (noteClaim('launch.lock', removeIfUnchanged(lockPath, lock.text))) notes.push('removed a stale launch.lock left by another launch');
    }
  } else if (liveLauncher) {
    console.error(`LAUNCH IN PROGRESS  launcher pid ${lock.kind === 'present' ? lock.launcherPid : '?'} holds launch.lock, but it ` +
      'could not be verified as this run dir\'s launch. Nothing was killed or removed; stop again once it prints READY or fails.');
    code = 1;
  } else {
    // No record this run can trust and no live launch: kill nothing, clear
    // the records, and report any server still running for this run dir.
    const lockNote = lock.kind === 'present' ? ' and launch.lock' : '';
    if (read.kind === 'missing') {
      if (!stoppedLaunch || lock.kind === 'present') {
        console.log(`NOTHING TO STOP  no server.json in ${runDir}${lock.kind === 'present' ? '; removed a stale launch.lock' : ''}`);
      }
    } else if (read.kind === 'unreadable') {
      console.log(`UNREADABLE  ${serverJson}: ${read.why}. Killed nothing; removed it${lockNote}`);
    } else {
      console.log(`FOREIGN  ${serverJson} names run dir ${read.record.runDir} (pid ${read.record.pid}), not this one: ` +
        `copied or moved. Killed nothing; removed it${lockNote}`);
    }
    if (read.kind !== 'missing') noteClaim('server.json', removeIfUnchanged(serverJson, read.text), 'server.json changed while stop ran and was left in place');
    if (lock.kind === 'present') noteClaim('launch.lock', removeIfUnchanged(lockPath, lock.text), 'launch.lock changed while stop ran and was left in place');
    for (const pid of serversForRunDir(runDir)) {
      console.error(`NOT KILLED  pid ${pid} is verify-serve for ${runDir}, but no readable server.json records it. ` +
        `If you started it, kill ${pid}.`);
      code = 1;
    }
  }
  clearDeadTemps();
  for (const f of listDir(runDir)) {
    if (f.endsWith('.quarantine') && !notes.some((n) => n.includes(f))) notes.push(`${f} is a lock or record left by an interrupted removal; inspect it, then delete it by hand`);
  }
  for (const n of notes) console.log(`NOTE  ${n}`);
  const files = listFilesRecursive(runDir);
  console.log(`EVIDENCE ${runDir}  (${files.length} files kept)`);
  for (const f of files.slice(0, 80)) console.log(`  ${f}`);
  if (files.length > 80) console.log(`  ... ${files.length - 80} more`);
  return code;
}

const USAGE = `usage:
  verify.js launch [--root DIR] [--run-dir DIR] [--name NAME]
  verify.js doctor (--run-dir DIR | --url URL) [--viewport desktop|phone|phone-landscape|WxH] [--touch]
  verify.js drive <script.js> (--run-dir DIR | --url URL) [--viewport V] [--touch] [--name NAME] [--timeout SECONDS]
  verify.js stop --run-dir DIR`;

/** @param {string[]} argv */
async function main(argv) {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h' || argv[0] === 'help') {
    console.log(USAGE);
    return 0;
  }
  const { command, positional, flags } = parseArgs(argv);
  if (command === 'launch') return cmdLaunch(flags);
  if (command === 'doctor') return cmdDoctor(flags);
  if (command === 'drive') return cmdDrive(positional, flags);
  return cmdStop(flags);
}

if (require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => { process.exitCode = code; },
    (err) => {
      if (err instanceof UsageError) {
        console.error(`verify: ${err.message}\n${USAGE}`);
        process.exitCode = 2;
      } else if (err instanceof RefusedError) {
        console.error(`verify: REFUSED  ${err.message}`);
        process.exitCode = 2;
      } else {
        console.error(`verify: ${err instanceof Error ? err.stack || err.message : String(err)}`);
        process.exitCode = 1;
      }
    },
  );
}

module.exports = {
  VIEWPORTS,
  parseArgs,
  parseViewport,
  backingToClient,
  logicalToClient,
  textCentre,
  textBounds,
  textMatcher,
  pickText,
  visibleOnCanvas,
  styleAlpha,
  filterOpacity,
  effectiveAlpha,
  textBox,
  boxesOverlap,
  isHighlighted,
  rowValue,
  misplacedValueMessage,
  driveOutcome,
  parseReadyLine,
  waitForReady,
  parseServerRecord,
  isServerUrl,
  removeClaimed,
  removeIfOwned,
  verifiedLauncher,
  checkServer,
  shouldBlockRequest,
  classifyConsole,
  defaultOutRoot,
  runDirName,
  slug,
  browserScratchBase,
  resolveChromium,
  isOurServer,
  UsageError,
  RefusedError,
};
