// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');

const verify = require('../.github/skills/verify-neon-dungeon/scripts/verify.js');
const engineTouch = require('../engine/touch.js');

// Static requires so `npm run typecheck` checks every drive against the Harness type.
const DRIVES = {
  'start-seeded-run': require('../.github/skills/verify-neon-dungeon/features/drives/start-seeded-run.js'),
  'pause-and-settings': require('../.github/skills/verify-neon-dungeon/features/drives/pause-and-settings.js'),
  'save-and-continue': require('../.github/skills/verify-neon-dungeon/features/drives/save-and-continue.js'),
  'descend-stairs': require('../.github/skills/verify-neon-dungeon/features/drives/descend-stairs.js'),
  'logic-lattice-trial': require('../.github/skills/verify-neon-dungeon/features/drives/logic-lattice-trial.js'),
};

test('logicalToClient maps logical game points to CSS client points', () => {
  const desktop = { left: 0, top: 0, width: 1280, height: 800, canvasWidth: 960, canvasHeight: 600, zoom: 1 };
  assert.deepEqual(verify.logicalToClient({ x: 480, y: 300 }, desktop), { x: 640, y: 400 });
  const zoomed = { left: 10, top: 20, width: 640, height: 400, canvasWidth: 1280, canvasHeight: 800, zoom: 2 };
  assert.deepEqual(verify.logicalToClient({ x: 100, y: 50 }, zoomed), { x: 110, y: 70 });
});

test('logicalToClient inverts the game pointer mapping (engine/touch.js toCanvas / worldZoom)', () => {
  // Phone 390x844 CSS: gameScale 0.7 gives a 557x1206 backing canvas, first-launch worldZoom 1.5.
  const rect = { left: 0, top: 0, width: 390, height: 844 };
  const canvas = { width: 557, height: 1206, getBoundingClientRect: () => rect };
  const geom = { ...rect, canvasWidth: 557, canvasHeight: 1206, zoom: 1.5 };
  const logical = { x: 185.5, y: 746 };
  const client = verify.logicalToClient(logical, geom);
  const [cx, cy] = engineTouch.toCanvas(client.x, client.y, canvas);
  assert.ok(Math.abs(cx / geom.zoom - logical.x) < 1e-9, `x round-trip ${cx / geom.zoom}`);
  assert.ok(Math.abs(cy / geom.zoom - logical.y) < 1e-9, `y round-trip ${cy / geom.zoom}`);
});

test('backingToClient maps canvas backing-store pixels to CSS client pixels', () => {
  const geom = { left: 10, top: 20, width: 640, height: 400, canvasWidth: 1280, canvasHeight: 800, zoom: 2 };
  assert.deepEqual(verify.backingToClient({ x: 200, y: 100 }, geom), { x: 110, y: 70 });
  assert.deepEqual(verify.backingToClient({ x: 0, y: 0 }, geom), { x: 10, y: 20 });
});

const IDENTITY = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

test('textCentre anchors every textAlign at the middle of the measured width', () => {
  const base = { y: 50, baseline: 'middle', width: 80, matrix: IDENTITY };
  assert.deepEqual(verify.textCentre({ ...base, x: 100, align: 'center' }), { x: 100, y: 50 });
  assert.deepEqual(verify.textCentre({ ...base, x: 100, align: 'left' }), { x: 140, y: 50 });
  assert.deepEqual(verify.textCentre({ ...base, x: 100, align: 'start' }), { x: 140, y: 50 });
  assert.deepEqual(verify.textCentre({ ...base, x: 100, align: 'right' }), { x: 60, y: 50 });
  assert.deepEqual(verify.textCentre({ ...base, x: 100, align: 'end' }), { x: 60, y: 50 });
  assert.deepEqual(verify.textCentre({ ...base, x: 100, align: 'start', direction: 'rtl' }), { x: 60, y: 50 });
  assert.deepEqual(verify.textCentre({ ...base, x: 100, align: 'end', direction: 'rtl' }), { x: 140, y: 50 });
  assert.deepEqual(verify.textCentre({ ...base, x: 100, align: 'left', maxWidth: 40 }), { x: 120, y: 50 });
});

test('textCentre centres vertically on the ink box measured from the active baseline', () => {
  // measureText's actualBoundingBoxAscent/Descent are distances from the textBaseline in effect.
  const at = (/** @type {string} */ baseline, /** @type {number} */ ascent, /** @type {number} */ descent) =>
    verify.textCentre({ x: 0, y: 100, align: 'center', baseline, width: 10, ascent, descent, matrix: IDENTITY }).y;
  assert.equal(at('alphabetic', 16, 4), 94);
  assert.equal(at('top', -2, 18), 110);
  assert.equal(at('middle', 8, 8), 100);
});

test('textCentre falls back to em-box offsets per baseline without ink metrics', () => {
  const at = (/** @type {string} */ baseline) =>
    verify.textCentre({ x: 0, y: 100, align: 'center', baseline, width: 10, fontSize: 20, matrix: IDENTITY }).y;
  assert.equal(at('top'), 110);
  assert.equal(at('hanging'), 108);
  assert.equal(at('middle'), 100);
  assert.equal(at('alphabetic'), 93);
  assert.equal(at('ideographic'), 90);
  assert.equal(at('bottom'), 90);
});

test('textCentre maps the centre through the context transform', () => {
  const zoom = { a: 1.5, b: 0, c: 0, d: 1.5, e: 0, f: 0 };
  assert.deepEqual(verify.textCentre({ x: 100, y: 200, align: 'left', baseline: 'alphabetic', width: 40, ascent: 10, descent: 0, matrix: zoom }), { x: 180, y: 292.5 });
  const shifted = { a: 1, b: 0, c: 0, d: 1, e: -30, f: 12 };
  assert.deepEqual(verify.textCentre({ x: 100, y: 50, align: 'center', baseline: 'middle', width: 40, matrix: shifted }), { x: 70, y: 62 });
  const quarterTurn = { a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 };
  assert.deepEqual(verify.textCentre({ x: 10, y: 20, align: 'center', baseline: 'middle', width: 40, matrix: quarterTurn }), { x: -20, y: 10 });
});

test('a label centre recorded under worldZoom maps back to the same logical point through the game input path', () => {
  // Phone: 390x844 CSS, 557x1206 backing canvas, render transform scale(1.5).
  const geom = { left: 0, top: 0, width: 390, height: 844, canvasWidth: 557, canvasHeight: 1206, zoom: 1.5 };
  const backing = verify.textCentre({ x: 185.5, y: 253.2, align: 'center', baseline: 'middle', width: 300, matrix: { a: 1.5, b: 0, c: 0, d: 1.5, e: 0, f: 0 } });
  const client = verify.backingToClient(backing, geom);
  const canvas = { width: 557, height: 1206, getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 844 }) };
  const [cx, cy] = engineTouch.toCanvas(client.x, client.y, canvas);
  assert.ok(Math.abs(cx / 1.5 - 185.5) < 1e-9, `x ${cx / 1.5}`);
  assert.ok(Math.abs(cy / 1.5 - 253.2) < 1e-9, `y ${cy / 1.5}`);
});

test('pickText returns the topmost visible match and lists the visible strings', () => {
  const texts = [
    { text: '▶  RESUME SESSION (FLOOR 2 · NORMAL)', x: 480, y: 300, alpha: 1 },
    { text: '▶  SETTINGS', x: 480, y: 384, alpha: 1 },
    { text: 'ghost SETTINGS', x: 480, y: 500, alpha: 0 },
    { text: 'SETTINGS below the canvas', x: 480, y: 900, alpha: 1 },
    { text: '▶  SETTINGS', x: 470, y: 390, alpha: 0.6 },
    { text: '▶  SETTINGS', x: 475, y: 395, alpha: 1, fill: 'rgba(0, 0, 0, 0)' },
  ];
  const size = { width: 960, height: 600 };
  assert.deepEqual(verify.pickText(texts, /SETTINGS/, size), {
    match: { text: '▶  SETTINGS', x: 470, y: 390, alpha: 0.6 },
    visible: ['▶  RESUME SESSION (FLOOR 2 · NORMAL)', '▶  SETTINGS'],
  });
  assert.deepEqual(verify.pickText(texts, '(FLOOR 2', size).match, { text: '▶  RESUME SESSION (FLOOR 2 · NORMAL)', x: 480, y: 300, alpha: 1 });
  assert.equal(verify.pickText(texts, /NEURAL ARCHIVES/, size).match, null);
});

test('textMatcher treats strings literally and drops stateful regex flags', () => {
  const re = verify.textMatcher(/SET/g);
  assert.equal(re.flags, '');
  assert.equal(re.test('SETTINGS'), true);
  assert.equal(re.test('SETTINGS'), true);
  assert.equal(verify.textMatcher('[ BACK ]').test('[ BACK ]'), true);
  assert.equal(verify.textMatcher('[ BACK ]').test('B'), false);
});

/**
 * @param {{ env?: Record<string, string>, files?: string[], dirs?: string[], pw?: string | null, onPath?: Record<string, string> }} fake
 */
function fakeDeps(fake) {
  const files = new Set(fake.files || []);
  return {
    env: fake.env || {},
    homeDir: '/home/u',
    exists: (/** @type {string} */ p) => files.has(p),
    list: (/** @type {string} */ p) => (p === '/home/u/.cache/ms-playwright' ? fake.dirs || [] : []),
    playwrightPath: () => (fake.pw === undefined ? null : fake.pw),
    which: (/** @type {string} */ name) => (fake.onPath || {})[name] || null,
  };
}

const CACHE = '/home/u/.cache/ms-playwright';

test('resolveChromium prefers NEON_VERIFY_CHROMIUM and fails loudly when it is missing', () => {
  assert.deepEqual(
    verify.resolveChromium(fakeDeps({ env: { NEON_VERIFY_CHROMIUM: '/opt/chrome' }, files: ['/opt/chrome', `${CACHE}/chromium-1219/chrome-linux64/chrome`], dirs: ['chromium-1219'] })),
    { path: '/opt/chrome', source: 'env NEON_VERIFY_CHROMIUM' },
  );
  assert.throws(
    () => verify.resolveChromium(fakeDeps({ env: { NEON_VERIFY_CHROMIUM: '/opt/missing' }, files: [`${CACHE}/chromium-1219/chrome-linux64/chrome`], dirs: ['chromium-1219'] })),
    /NEON_VERIFY_CHROMIUM=\/opt\/missing does not exist/,
  );
});

const PINNED = '/home/u/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const CACHED_WARNING = (/** @type {string} */ what) =>
  `${what} is not the Chromium revision playwright-core is pinned to (playwright-core expects ${PINNED}); ` +
  'compatibility is not guaranteed. Install the pinned one with: npx playwright-core install chromium';

test('resolveChromium prefers the revision playwright-core is pinned to over newer or older cached ones', () => {
  const dirs = ['chromium-1178', 'chromium-1219', 'chromium-1243', 'chromium-1300'];
  assert.deepEqual(
    verify.resolveChromium(fakeDeps({ dirs, pw: PINNED, files: [PINNED, `${CACHE}/chromium-1219/chrome-linux64/chrome`, `${CACHE}/chromium-1300/chrome-linux64/chrome`] })),
    { path: PINNED, source: 'playwright-core executablePath()' },
  );
});

test('resolveChromium falls back to the newest cached revision with a compatibility warning', () => {
  const dirs = ['chromium-1178', 'chromium_headless_shell-1217', 'chromium-1219', 'chromium-1208', 'ffmpeg-1011'];
  assert.deepEqual(
    verify.resolveChromium(fakeDeps({ dirs, pw: PINNED, files: [`${CACHE}/chromium-1178/chrome-linux64/chrome`, `${CACHE}/chromium-1208/chrome-linux64/chrome`, `${CACHE}/chromium-1219/chrome-linux64/chrome`] })),
    { path: `${CACHE}/chromium-1219/chrome-linux64/chrome`, source: 'playwright cache chromium-1219', warning: CACHED_WARNING('cached chromium-1219') },
  );
  assert.deepEqual(
    verify.resolveChromium(fakeDeps({ dirs, pw: PINNED, files: [`${CACHE}/chromium-1178/chrome-linux64/chrome`, `${CACHE}/chromium-1208/chrome-linux64/chrome`] })),
    { path: `${CACHE}/chromium-1208/chrome-linux64/chrome`, source: 'playwright cache chromium-1208', warning: CACHED_WARNING('cached chromium-1208') },
  );
});

test('resolveChromium falls back to a system browser with a warning, then to the install hint', () => {
  assert.deepEqual(
    verify.resolveChromium(fakeDeps({ pw: PINNED, onPath: { chromium: '/usr/bin/chromium', 'chromium-browser': '/usr/bin/chromium-browser' } })),
    { path: '/usr/bin/chromium', source: 'system chromium', warning: CACHED_WARNING('system chromium') },
  );
  assert.throws(() => verify.resolveChromium(fakeDeps({ pw: PINNED })), /npx playwright-core install chromium/);
});

test('shouldBlockRequest allows only the served origin', () => {
  const origin = 'http://127.0.0.1:43210';
  assert.equal(verify.shouldBlockRequest('http://127.0.0.1:43210/src/game.js', origin), false);
  assert.equal(verify.shouldBlockRequest('https://us-assets.i.posthog.com/static/array.js', origin), true);
  assert.equal(verify.shouldBlockRequest('https://us.i.posthog.com/e/', origin), true);
  assert.equal(verify.shouldBlockRequest('http://127.0.0.1:43211/', origin), true);
  assert.equal(verify.shouldBlockRequest('http://localhost:43210/', origin), true);
  assert.equal(verify.shouldBlockRequest('wss://relay.example/socket', origin), true);
  assert.equal(verify.shouldBlockRequest('data:image/png;base64,AAAA', origin), false);
  assert.equal(verify.shouldBlockRequest('blob:http://127.0.0.1:43210/5f1c', origin), false);
  assert.equal(verify.shouldBlockRequest('https://darinh.github.io/neon-dungeon/src/game.js', 'https://darinh.github.io'), false);
});

test('classifyConsole treats harness-caused load failures as noise and other errors as failures', () => {
  const origin = 'http://127.0.0.1:43210';
  assert.equal(verify.classifyConsole({ type: 'error', text: 'Failed to load resource: net::ERR_BLOCKED_BY_CLIENT', url: 'https://us-assets.i.posthog.com/static/array.js' }, origin), 'noise');
  assert.equal(verify.classifyConsole({ type: 'error', text: 'Failed to load resource: the server responded with a status of 404 (Not Found)', url: 'http://127.0.0.1:43210/favicon.ico' }, origin), 'noise');
  assert.equal(verify.classifyConsole({ type: 'error', text: 'Failed to load resource: the server responded with a status of 404 (Not Found)', url: 'http://127.0.0.1:43210/src/game.js' }, origin), 'error');
  assert.equal(verify.classifyConsole({ type: 'error', text: '[render-boundary] update() threw (×1): TypeError' }, origin), 'error');
  assert.equal(verify.classifyConsole({ type: 'log', text: '[NEON DUNGEON] 1280×800 → 960×600' }, origin), 'info');
});

test('defaultOutRoot honours NEON_VERIFY_OUT, then TMPDIR, then the user cache', () => {
  assert.equal(verify.defaultOutRoot({ NEON_VERIFY_OUT: '/evidence', TMPDIR: '/scratch' }, '/home/u'), '/evidence');
  assert.equal(verify.defaultOutRoot({ TMPDIR: '/scratch' }, '/home/u'), '/scratch/neon-dungeon-verify');
  assert.equal(verify.defaultOutRoot({ XDG_CACHE_HOME: '/xdg' }, '/home/u'), '/xdg/neon-dungeon-verify');
  assert.equal(verify.defaultOutRoot({}, '/home/u'), '/home/u/.cache/neon-dungeon-verify');
});

test('runDirName is a UTC timestamp plus a filesystem-safe name', () => {
  const at = new Date(Date.UTC(2026, 8, 30, 1, 2, 3));
  assert.equal(verify.runDirName(at, 'verify-skill'), '20260930-010203-verify-skill');
  assert.equal(verify.runDirName(at, 'my run / phone!'), '20260930-010203-my-run-phone');
  assert.equal(verify.runDirName(at, '***'), '20260930-010203-run');
});

test('browserScratchBase keeps the Chromium socket path under the Unix limit', () => {
  assert.equal(verify.browserScratchBase('/home/u/.cache/neon-dungeon-verify', '/home/u'), '/home/u/.cache/neon-dungeon-verify/.tmp');
  const deep = '/home/u/work/some/very/deeply/nested/evidence/location';
  assert.equal(verify.browserScratchBase(deep, '/home/u'), '/home/u/.nd-verify');
  assert.throws(() => verify.browserScratchBase(deep, `/home/${'x'.repeat(60)}`), /NEON_VERIFY_OUT/);
});

test('parseArgs reads the command, positionals and flags', () => {
  assert.deepEqual(
    verify.parseArgs(['drive', 'features/drives/start-seeded-run.js', '--run-dir', '/r', '--viewport', 'phone', '--touch', '--name', 'n', '--timeout', '90']),
    { command: 'drive', positional: ['features/drives/start-seeded-run.js'], flags: { runDir: '/r', viewport: 'phone', touch: true, name: 'n', timeout: '90' } },
  );
  assert.deepEqual(verify.parseArgs(['launch']), { command: 'launch', positional: [], flags: {} });
  assert.deepEqual(verify.parseArgs(['doctor', '--url', 'https://darinh.github.io/neon-dungeon/']),
    { command: 'doctor', positional: [], flags: { url: 'https://darinh.github.io/neon-dungeon/' } });
  assert.throws(() => verify.parseArgs(['serve']), verify.UsageError);
  assert.throws(() => verify.parseArgs([]), verify.UsageError);
  assert.throws(() => verify.parseArgs(['drive', 'x.js', '--port', '1']), /unknown flag --port/);
  assert.throws(() => verify.parseArgs(['stop', '--run-dir']), /--run-dir needs a value/);
  assert.throws(() => verify.parseArgs(['stop', '--run-dir', '--touch']), /--run-dir needs a value/);
});

test('parseViewport resolves presets and WxH sizes', () => {
  assert.deepEqual(verify.parseViewport('desktop'), { label: 'desktop', width: 1280, height: 800, isMobile: false });
  assert.deepEqual(verify.parseViewport('phone'), { label: 'phone', width: 390, height: 844, isMobile: true });
  assert.deepEqual(verify.parseViewport('phone-landscape'), { label: 'phone-landscape', width: 844, height: 390, isMobile: true });
  assert.deepEqual(verify.parseViewport('1024x768'), { label: '1024x768', width: 1024, height: 768, isMobile: false });
  assert.throws(() => verify.parseViewport('tablet'), verify.UsageError);
});

test('isOurServer matches verify-serve for exactly this run dir, and this root when given', () => {
  const args = ['/usr/bin/node', '/w/.github/skills/verify-neon-dungeon/scripts/verify-serve.js', '--root', '/w', '--port', '0', '--run-dir', '/out/run-1'];
  assert.equal(verify.isOurServer(args, '/out/run-1'), true);
  assert.equal(verify.isOurServer(args, '/out/run-1', '/w'), true);
  assert.equal(verify.isOurServer(args, '/out/run-1', '/other-worktree'), false);
  assert.equal(verify.isOurServer(args, '/out/run-10'), false);
  assert.equal(verify.isOurServer(['/usr/bin/node', '/w/other.js', '--run-dir', '/out/run-1'], '/out/run-1'), false);
  assert.equal(verify.isOurServer(['/usr/bin/python3', '-m', 'http.server'], '/out/run-1'), false);
});

test('driveOutcome fails a drive that swallowed a failed check or step, threw anything, or checked nothing', () => {
  const pass = { kind: 'check', label: 'ok', ok: true };
  const step = { kind: 'step', label: 'walk', ok: true };
  assert.deepEqual(verify.driveOutcome({ threw: false, entries: [step, pass], unexpected: [] }), { ok: true, reasons: [] });
  assert.deepEqual(verify.driveOutcome({ threw: false, entries: [pass, { kind: 'check', label: 'hint drawn', ok: false }], unexpected: [] }),
    { ok: false, reasons: ['1 failed check(s): hint drawn'] });
  assert.deepEqual(verify.driveOutcome({ threw: false, entries: [pass, { kind: 'step', label: 'descend', ok: false }], unexpected: [] }),
    { ok: false, reasons: ['1 step(s) failed or did not finish: descend'] });
  assert.deepEqual(verify.driveOutcome({ threw: false, entries: [pass, { kind: 'step', label: 'cut short', ok: null }], unexpected: [] }),
    { ok: false, reasons: ['1 step(s) failed or did not finish: cut short'] });
  assert.deepEqual(verify.driveOutcome({ threw: true, entries: [pass], unexpected: [] }), { ok: false, reasons: ['the drive threw'] });
  assert.deepEqual(verify.driveOutcome({ threw: false, entries: [step], unexpected: [] }), { ok: false, reasons: ['no checks were recorded'] });
  assert.deepEqual(verify.driveOutcome({ threw: false, entries: [], unexpected: [], requireChecks: false }), { ok: true, reasons: [] });
  assert.deepEqual(verify.driveOutcome({ threw: false, interrupted: 'SIGINT', entries: [pass], unexpected: ['pageerror: boom'] }),
    { ok: false, reasons: ['interrupted by SIGINT', '1 unexpected page error(s)'] });
});

/**
 * @param {string} text
 * @param {number} ax
 * @param {number} ay
 * @param {string} fill
 * @param {string} [align]
 */
const drawn = (text, ax, ay, fill, align = 'left') => ({ text, x: ax + 40, y: ay - 5, alpha: 1, fill, align, ax, ay });

test('isHighlighted reads the selected label as the odd colour out in its column or row', () => {
  const settingsRows = [
    drawn('SFX VOLUME', 40, 80, '#888899'),
    drawn('SCREEN SHAKE', 40, 148, '#00f5ff'),
    drawn('◀ OFF ▶', 480, 148, '#ff4466', 'center'),
    drawn('DAMAGE NUMBERS', 40, 182, '#888899'),
    drawn('─── CONTROLS ───', 40, 400, '#555577'),
  ];
  assert.deepEqual(verify.isHighlighted(settingsRows, /^SCREEN SHAKE$/), { found: true, highlighted: true });
  assert.deepEqual(verify.isHighlighted(settingsRows, /^DAMAGE NUMBERS$/), { found: true, highlighted: false });
  assert.deepEqual(verify.isHighlighted(settingsRows, /^REDUCED MOTION$/), { found: false, highlighted: false });
  const buttons = [
    drawn('START', 100, 430, '#6f7890', 'center'),
    drawn('RANDOMIZE', 320, 430, '#ffb700', 'center'),
    drawn('BACK', 540, 430, '#6f7890', 'center'),
  ];
  assert.deepEqual(verify.isHighlighted(buttons, /^RANDOMIZE$/), { found: true, highlighted: true });
  assert.deepEqual(verify.isHighlighted(buttons, /^START$/), { found: true, highlighted: false });
  // The middle button sits on the screen's centre column, whose other lines are
  // all different colours: that column is not a menu, so it cannot highlight.
  const seedScreen = [
    drawn('RUN SEED', 320, 60, '#00f5ff', 'center'),
    drawn('DIFFICULTY: NORMAL', 320, 86, '#ffb700', 'center'),
    drawn('4328-G649-BMHG_', 320, 162, '#e0faff', 'center'),
    drawn('Same seed + difficulty rebuilds the same generated run.', 320, 210, '#668899', 'center'),
    drawn('START', 100, 430, '#39ff14', 'center'),
    drawn('RANDOMIZE', 320, 430, '#6f7890', 'center'),
    drawn('BACK', 540, 430, '#6f7890', 'center'),
  ];
  assert.deepEqual(verify.isHighlighted(seedScreen, /^RANDOMIZE$/), { found: true, highlighted: false });
  assert.deepEqual(verify.isHighlighted(seedScreen, /^START$/), { found: true, highlighted: true });
  assert.deepEqual(verify.isHighlighted([drawn('ALONE', 10, 10, '#fff')], 'ALONE'), { found: true, highlighted: false });
});

test('rowValue returns the value drawn in a label\'s row and value column', () => {
  // Settings on a 960-wide canvas: labels left-aligned at x=40, values centred at W/2.
  const VALUE = /^◀ (ON|OFF) ▶$/;
  const opts = { within: 12, canvasWidth: 960 };
  const shake = { text: 'SCREEN SHAKE', x: 100, y: 144, alpha: 1, box: { left: 40, top: 138, right: 160, bottom: 150 } };
  const off = { text: '◀ OFF ▶', x: 480, y: 145, alpha: 1, box: { left: 448, top: 139, right: 512, bottom: 151 } };
  const damage = { text: 'DAMAGE NUMBERS', x: 110, y: 178, alpha: 1, box: { left: 40, top: 172, right: 180, bottom: 184 } };
  const on = { text: '◀ ON ▶', x: 480, y: 179, alpha: 1, box: { left: 452, top: 173, right: 508, bottom: 185 } };
  const texts = [shake, off, damage, on];
  assert.deepEqual(verify.rowValue(texts, /^SCREEN SHAKE$/, VALUE, opts), { match: off, misplaced: [], column: { left: 160, right: 920 }, label: shake });
  assert.deepEqual(verify.rowValue(texts, /^DAMAGE NUMBERS$/, VALUE, opts), { match: on, misplaced: [], column: { left: 180, right: 920 }, label: damage });
  assert.deepEqual(verify.rowValue(texts, /^AIM ASSIST$/, VALUE, opts), { match: null, misplaced: [], column: null, label: null });
  // Off the row vertically: not a candidate at all.
  const below = { ...off, y: 157 };
  assert.deepEqual(verify.rowValue([shake, below], /^SCREEN SHAKE$/, VALUE, opts), { match: null, misplaced: [], column: { left: 160, right: 920 }, label: shake });
  // On the row but at the canvas edge, or overlapping the label: misplaced.
  const edge = { ...off, x: 959, box: { left: 927, top: 139, right: 991, bottom: 151 } };
  const overlap = { ...off, x: 150, box: { left: 118, top: 139, right: 182, bottom: 151 } };
  assert.deepEqual(verify.rowValue([shake, edge], /^SCREEN SHAKE$/, VALUE, opts), { match: null, misplaced: [edge], column: { left: 160, right: 920 }, label: shake });
  assert.deepEqual(verify.rowValue([shake, overlap], /^SCREEN SHAKE$/, VALUE, opts), { match: null, misplaced: [overlap], column: { left: 160, right: 920 }, label: shake });
  // Right-aligned exactly at the mirrored inset (the FEET menu's ONLINE/OFFLINE) is in the column.
  const status = { text: 'OFFLINE', x: 892, y: 150, alpha: 1, box: { left: 864, top: 144, right: 920, bottom: 156 } };
  assert.deepEqual(verify.rowValue([shake, status], /^SCREEN SHAKE$/, /^(ONLINE|OFFLINE)$/, opts).match, status);
});

test('misplacedValueMessage names a value drawn over its label as a game layout defect', () => {
  const shake = { text: 'SCREEN SHAKE', x: 100, y: 144, alpha: 1, box: { left: 40, top: 138, right: 160, bottom: 150 } };
  const overlap = { text: '◀ OFF ▶', x: 150, y: 145, alpha: 1, box: { left: 118, top: 139, right: 182, bottom: 151 } };
  const edge = { text: '◀ OFF ▶', x: 959, y: 145, alpha: 1, box: { left: 927, top: 139, right: 991, bottom: 151 } };
  const column = { left: 160, right: 920 };
  assert.equal(verify.misplacedValueMessage(shake, overlap, column, 1),
    'value overlaps its label: "SCREEN SHAKE" x 40..160 y 138..150 vs "◀ OFF ▶" x 118..182 y 139..151, a game layout defect at this viewport');
  assert.equal(verify.misplacedValueMessage(shake, overlap, column, 2),
    'value overlaps its label: "SCREEN SHAKE" x 20..80 y 69..75 vs "◀ OFF ▶" x 59..91 y 69.5..75.5, a game layout defect at this viewport');
  assert.equal(verify.misplacedValueMessage(shake, edge, column, 1), '"◀ OFF ▶" spans x 927..991, outside the value column of "SCREEN SHAKE" (x 160..920)');
});

test('styleAlpha reads the alpha a canvas fill or stroke style carries', () => {
  assert.equal(verify.styleAlpha('transparent'), 0);
  assert.equal(verify.styleAlpha('rgba(0, 0, 0, 0)'), 0);
  assert.equal(verify.styleAlpha('rgba(255, 0, 0, 0.5)'), 0.5);
  assert.equal(verify.styleAlpha('hsla(120, 50%, 50%, 0.25)'), 0.25);
  assert.equal(verify.styleAlpha('rgb(0 0 0 / 40%)'), 0.4);
  assert.equal(verify.styleAlpha('color(srgb 1 0 0 / 0)'), 0);
  assert.equal(verify.styleAlpha('#ff000080'), 128 / 255);
  assert.equal(verify.styleAlpha('#f008'), 136 / 255);
  assert.equal(verify.styleAlpha('#00F5FF'), 1);
  assert.equal(verify.styleAlpha('#abc'), 1);
  assert.equal(verify.styleAlpha('rgb(255, 0, 0)'), 1);
  assert.equal(verify.styleAlpha('red'), 1);
  assert.equal(verify.styleAlpha('pattern'), 1);
  assert.equal(verify.styleAlpha(undefined), 1);
});

test('visibleOnCanvas drops text whose globalAlpha x style alpha x filter opacity is near zero', () => {
  const texts = [
    { text: 'opaque', x: 10, y: 10, alpha: 1, fill: '#00f5ff' },
    { text: 'transparent fill', x: 10, y: 20, alpha: 1, fill: 'rgba(0, 0, 0, 0)' },
    { text: 'faint product', x: 10, y: 30, alpha: 0.1, fill: 'rgba(255, 255, 255, 0.4)' },
    { text: 'half', x: 10, y: 40, alpha: 0.5, fill: 'rgba(255, 255, 255, 0.5)' },
    { text: 'filtered out', x: 10, y: 50, alpha: 1, fill: '#ffffff', filter: 'blur(2px) opacity(0%)' },
    { text: 'gradient', x: 10, y: 60, alpha: 1, fill: 'pattern', filter: 'none' },
  ];
  assert.deepEqual(verify.visibleOnCanvas(texts, { width: 960, height: 600 }).map((t) => t.text), ['opaque', 'half', 'gradient']);
  assert.equal(verify.effectiveAlpha({ text: 'half', x: 0, y: 0, alpha: 0.5, fill: 'rgba(255, 255, 255, 0.5)' }), 0.25);
  assert.equal(verify.filterOpacity('opacity(50%) opacity(0.5)'), 0.25);
});

test('textBox gives a drawn string\'s ink box in logical game coordinates', () => {
  assert.deepEqual(verify.textBox({ text: '▼ DESCEND', x: 300, y: 150, alpha: 1, box: { left: 255, top: 144, right: 345, bottom: 156 } }, 1.5),
    { left: 170, top: 96, right: 230, bottom: 104 });
  assert.deepEqual(verify.textBox({ text: 'x', x: 50, y: 20, alpha: 1 }, 1), { left: 50, top: 20, right: 50, bottom: 20 });
});

test('textBounds boxes the ink a fillText call covers, through rotation and skew', () => {
  const identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const base = { align: 'left', baseline: 'alphabetic', width: 40, ascent: 10, descent: 2, matrix: identity };
  assert.deepEqual(verify.textBounds({ ...base, x: 10, y: 20 }), { left: 10, top: 10, right: 50, bottom: 22 });
  // Right-aligned, clamped by maxWidth, scaled x2.
  assert.deepEqual(verify.textBounds({ ...base, align: 'right', x: 100, y: 20, width: 80, maxWidth: 50, matrix: { ...identity, a: 2, d: 2 } }),
    { left: 100, top: 20, right: 200, bottom: 44 });
  // Centred label rotated 90 degrees about (200, 300): 100 wide by 14 tall becomes 14 wide by 100 tall.
  const rotated = { x: 0, y: 0, align: 'center', baseline: 'middle', width: 100, ascent: 7, descent: 7, matrix: { a: 0, b: 1, c: -1, d: 0, e: 200, f: 300 } };
  assert.deepEqual(verify.textCentre(rotated), { x: 200, y: 300 });
  assert.deepEqual(verify.textBounds(rotated), { left: 193, top: 250, right: 207, bottom: 350 });
  // Skewed along x by half the height: x' = x + 0.5 y.
  assert.deepEqual(verify.textBounds({ ...base, x: 10, y: 20, matrix: { ...identity, c: 0.5 } }), { left: 15, top: 10, right: 61, bottom: 22 });
  // Without ink metrics: the em box around the baseline's middle.
  assert.deepEqual(verify.textBounds({ x: 100, y: 100, align: 'center', baseline: 'middle', width: 60, fontSize: 20, matrix: identity }),
    { left: 70, top: 90, right: 130, bottom: 110 });
});

test('parseServerRecord accepts only a complete record for this run dir', () => {
  const token = '0123456789abcdef0123456789abcdef';
  const rec = { pid: 4242, url: 'http://127.0.0.1:43210/', status: 'ready', root: '/w', runDir: '/out/run-a', startedAt: '2026-09-30T06:00:00.000Z', head: 'abc123', token };
  const starting = { ...rec, url: null, status: 'starting' };
  assert.deepEqual(verify.parseServerRecord(JSON.stringify(rec), '/out/run-a'), { kind: 'ok', record: rec });
  assert.deepEqual(verify.parseServerRecord(JSON.stringify(starting), '/out/run-a/'), { kind: 'ok', record: starting });
  assert.deepEqual(verify.parseServerRecord(JSON.stringify(rec), '/out/run-b'), { kind: 'foreign', record: rec });
  assert.deepEqual(verify.parseServerRecord('', '/out/run-a'), { kind: 'unreadable', why: 'empty file' });
  assert.deepEqual(verify.parseServerRecord('{"pid": 42', '/out/run-a'), { kind: 'unreadable', why: 'not valid JSON (10 bytes; torn write?)' });
  assert.deepEqual(verify.parseServerRecord('null', '/out/run-a'), { kind: 'unreadable', why: 'not a server record (not a JSON object)' });
  assert.deepEqual(verify.parseServerRecord('{}', '/out/run-a'),
    { kind: 'unreadable', why: 'not a server record (bad or missing: pid, status, root, runDir, startedAt, head, token)' });
  const partial = { pid: 4242, url: 'http://127.0.0.1:43210/', root: '/w', runDir: '/out/run-a' };
  assert.deepEqual(verify.parseServerRecord(JSON.stringify(partial), '/out/run-a'),
    { kind: 'unreadable', why: 'not a server record (bad or missing: status, startedAt, head, token)' });
  const bad = (/** @type {Record<string, unknown>} */ change) => verify.parseServerRecord(JSON.stringify({ ...rec, ...change }), '/out/run-a');
  assert.deepEqual(bad({ url: 'https://darinh.github.io/neon-dungeon/' }), { kind: 'unreadable', why: 'not a server record (bad or missing: url)' });
  assert.deepEqual(bad({ status: 'starting' }), { kind: 'unreadable', why: 'not a server record (bad or missing: url)' });
  assert.deepEqual(bad({ token: 'forged' }), { kind: 'unreadable', why: 'not a server record (bad or missing: token)' });
});

/**
 * Spawns the real verify-serve and resolves with its READY url.
 * @param {string[]} args
 * @returns {Promise<{ child: import('node:child_process').ChildProcess, url: string }>}
 */
function startServe(args) {
  const serve = path.join(__dirname, '..', '.github', 'skills', 'verify-neon-dungeon', 'scripts', 'verify-serve.js');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [serve, ...args], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error(`no READY within 5s: ${out}`)); }, 5000);
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`verify-serve exited early with ${code}`)); });
    /** @type {import('node:stream').Readable} */ (child.stdout).on('data', (chunk) => {
      out += chunk;
      const m = /^READY (\S+) pid=\d+$/m.exec(out);
      if (!m || !m[1]) return;
      clearTimeout(timer);
      resolve({ child, url: m[1] });
    });
  });
}

test('checkServer, shared by doctor and drive, passes this run\'s server and fails another run\'s pid and URL', async () => {
  const root = path.resolve(__dirname, '..');
  const runA = '/nonexistent-neon-verify/run-a';
  const { child, url } = await startServe(['--root', root, '--port', '0', '--run-dir', runA]);
  try {
    const record = { pid: Number(child.pid), url, status: /** @type {'ready'} */ ('ready'), root, runDir: runA, startedAt: 't', head: 'h', token: '0'.repeat(32) };
    const own = await verify.checkServer({ runDir: runA, url, record });
    assert.deepEqual(own.rows.map((r) => `${r.name} ${r.status}`), ['server-process PASS', 'http-root PASS', 'version-json PASS']);
    assert.equal(own.ok, true);
    // Run B's record with run A's pid and URL (forged, or a dead server's port reused by run A).
    const runB = '/nonexistent-neon-verify/run-b';
    const forged = await verify.checkServer({ runDir: runB, url, record: { ...record, runDir: runB } });
    assert.deepEqual(forged.rows.map((r) => `${r.name} ${r.status}`), ['server-process FAIL', 'http-root PASS', 'version-json FAIL']);
    assert.equal(forged.ok, false);
  } finally {
    child.kill();
  }
});

test('parseReadyLine reads the URL and pid from the server READY line only', () => {
  assert.deepEqual(verify.parseReadyLine('2026-09-30T01:00:00Z GET / 200\nREADY http://127.0.0.1:43210/ pid=4242\n'), { url: 'http://127.0.0.1:43210/', pid: 4242 });
  assert.equal(verify.parseReadyLine('READY http://127.0.0.1:43210/\n'), null);
  assert.equal(verify.parseReadyLine(''), null);
});

test('every feature drive exports an async (h) => {} function', () => {
  for (const [name, drive] of Object.entries(DRIVES)) {
    assert.equal(typeof drive, 'function', name);
    assert.equal(drive.constructor.name, 'AsyncFunction', name);
    assert.equal(drive.length, 1, name);
  }
});
