// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const RENDER = fs.readFileSync(path.join(ROOT, 'src', 'render.js'), 'utf8');

/**
 * @param {string} src
 * @param {string} name
 */
function extractFunctionSource(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} function must exist`);
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  assert.fail(`${name} function body must be balanced`);
}

function createRecordingCtx() {
  /** @type {any[]} */
  const calls = [];
  return {
    calls,
    font: '13px monospace',
    fillStyle: '#fff',
    shadowBlur: 0,
    shadowColor: '#000',
    textAlign: 'left',
    globalAlpha: 1,
    save() {},
    restore() {},
    fillRect() {},
    /** @param {any} text */
    measureText(text) {
      const match = /(\d+(?:\.\d+)?)px/.exec(this.font);
      const px = match ? Number(match[1]) : 13;
      return { width: px * 0.6 * String(text).length };
    },
    /** @param {any} text @param {number} x @param {number} y */
    fillText(text, x, y) {
      calls.push({ text: String(text), x, y, width: this.measureText(text).width, font: this.font });
    },
  };
}

/**
 * @param {{atk:number, def:number, floor:number, compact?:boolean, modifier?: boolean, modifierSuffix?: string, bombCooldown?: number, hackware?: boolean, hackwareCooldown?: number}} opts
 */
function drawHudTexts(opts) {
  const ctx = createRecordingCtx();
  const sandbox = /** @type {any} */ ({
    ctx,
    W: opts.compact ? 360 : 960,
    H: opts.compact ? 640 : 540,
    safeLeft: 0,
    safeRight: 0,
    layout: { compact: !!opts.compact, hudTop: opts.compact ? 560 : 492 },
    settings: { textScale: 1, minimapScale: 1 },
    _RG: { floor: opts.floor, modifier: opts.modifier ? 'FORTIFIED' : null, _cachedCores: 0, _coreHudPulse: 0 },
    RARITY_COLOURS: ['#ff00c8', '#00f5ff', '#ffb700'],
    HACKWARE: { BLINK: { icon: '⇥', name: 'PHASE BLINK', colour: '#44ccff' } },
    COMBO_WINDOW: 3,
    combo: { count: 0, timer: 0, flashTimer: 0 },
    getMod() { return { icon: '⛨', label: 'FORTIFIED', colour: '#fff' }; },
    modifierProgressSuffix() { return opts.modifierSuffix || ''; },
    piercingHeartHudSuffix() { return ''; },
    siphonHudSuffix() { return ''; },
    comboColour() { return '#fff'; },
    comboMultiplier() { return 1; },
    drawObservationHudFrame() {},
    Math,
  });
  const source = `const HUD_STAT_GAP = 12;\n${extractFunctionSource(RENDER, 'drawHUD')}\nthis.drawHUD = drawHUD;`;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  sandbox.drawHUD({
    hp: 100,
    maxHp: 100,
    atk: opts.atk,
    def: opts.def,
    level: 9,
    xp: 0,
    xpNeeded: () => 100,
    weapon: { name: 'PLASMA RIFLE MK-ULTRA' },
    weapons: [],
    weaponIdx: 0,
    score: 1234,
    credits: 12,
    loreRead: new Set(),
    keys: { red: 0, blue: 0, gold: 0 },
    perks: {},
    bombCooldown: opts.bombCooldown || 0,
    dashCooldown: 0,
    hackware: opts.hackware ? 'BLINK' : null,
    hackwareCooldown: opts.hackwareCooldown || 0,
    _nanoMedicCharges: 0,
  });
  return ctx.calls;
}

/** @param {any[]} boxes */
function assertNonOverlapping(boxes) {
  for (let i = 0; i < boxes.length - 1; i++) {
    assert.ok(
      boxes[i].x + boxes[i].width <= boxes[i + 1].x,
      `${boxes[i].text} overlaps ${boxes[i + 1].text}: ${JSON.stringify(boxes)}`
    );
  }
}

const HUD_CASES = [
  { atk: 10, def: 2, floor: 1 },
  { atk: 99, def: 45, floor: 15 },
  { atk: 150, def: 99, floor: 15 },
];

for (const { atk, def, floor } of HUD_CASES) {
  test(`landscape HUD stat text does not overlap for ATK ${atk} DEF ${def} TEST ${floor}`, () => {
    const calls = drawHudTexts({ atk, def, floor });
    const boxes = [
      calls.find(c => c.text === `ATK:${atk}`),
      calls.find(c => c.text === `DEF:${def}`),
      calls.find(c => c.text === `TEST:${floor}`),
      calls.find(c => c.text.startsWith('PLASMA RIFLE')),
    ];
    assert.ok(boxes.every(Boolean), `missing HUD calls: ${JSON.stringify(calls)}`);
    assertNonOverlapping(/** @type {any[]} */ (boxes));
  });

  test(`compact HUD stat text does not overlap for A ${atk} D ${def}`, () => {
    const calls = drawHudTexts({ atk, def, floor, compact: true });
    const boxes = [
      calls.find(c => c.text === `A:${atk}`),
      calls.find(c => c.text === `D:${def}`),
      calls.find(c => c.text.startsWith('PLASMA RIFLE')),
    ];
    assert.ok(boxes.every(Boolean), `missing compact HUD calls: ${JSON.stringify(calls)}`);
    assertNonOverlapping(/** @type {any[]} */ (boxes));
  });
}

test('landscape HUD second row flows modifier, bomb, and hackware labels without overlap', () => {
  const calls = drawHudTexts({
    atk: 150,
    def: 99,
    floor: 15,
    modifier: true,
    modifierSuffix: ' 12/20',
    hackware: true,
  });
  const boxes = [
    calls.find(c => c.text === '⛨FORTIFIED 12/20'),
    calls.find(c => c.text === '[V] Bomb RDY'),
    calls.find(c => c.text === '[F] ⇥PHASE BLINK RDY'),
  ];
  assert.ok(boxes.every(Boolean), `missing landscape second-row calls: ${JSON.stringify(calls)}`);
  assertNonOverlapping(/** @type {any[]} */ (boxes));
});

test('landscape HUD second row flows timed bomb and hackware cooldown labels without overlap', () => {
  const calls = drawHudTexts({
    atk: 150,
    def: 99,
    floor: 15,
    modifier: true,
    modifierSuffix: ' 12/20',
    bombCooldown: 3.2,
    hackware: true,
    hackwareCooldown: 4.5,
  });
  const boxes = [
    calls.find(c => c.text === '⛨FORTIFIED 12/20'),
    calls.find(c => c.text === '[V] Bomb 3.2s'),
    calls.find(c => c.text === '[F] ⇥PHASE BLINK 4.5s'),
  ];
  assert.ok(boxes.every(Boolean), `missing timed second-row calls: ${JSON.stringify(calls)}`);
  assertNonOverlapping(/** @type {any[]} */ (boxes));
});

// ─── Bottom-band stacking: status badges → hint → message log ─────────────

function createFullRecordingCtx() {
  /** @type {any[]} */
  const calls = [];
  const ctx = {
    calls,
    font: '13px monospace', fillStyle: '#fff', strokeStyle: '#fff', shadowBlur: 0, shadowColor: '#000',
    textAlign: 'left', globalAlpha: 1, lineWidth: 1, lineDashOffset: 0,
    save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, fill() {}, setLineDash() {},
    /** @param {number} x @param {number} y @param {number} w @param {number} h */
    fillRect(x, y, w, h) { calls.push({ op: 'fillRect', x, y, w, h, fillStyle: ctx.fillStyle }); },
    /** @param {number} x @param {number} y @param {number} w @param {number} h */
    strokeRect(x, y, w, h) { calls.push({ op: 'strokeRect', x, y, w, h }); },
    /** @param {number} x @param {number} y @param {number} r */
    arc(x, y, r) { calls.push({ op: 'arc', x, y, r, strokeStyle: ctx.strokeStyle }); },
    stroke() { calls.push({ op: 'stroke', strokeStyle: ctx.strokeStyle }); },
    /** @param {any} text */
    measureText(text) {
      const m = /(\d+(?:\.\d+)?)px/.exec(ctx.font);
      return { width: (m ? Number(m[1]) : 13) * 0.6 * String(text).length };
    },
    /** @param {any} text @param {number} x @param {number} y */
    fillText(text, x, y) { calls.push({ op: 'fillText', text: String(text), x, y, font: ctx.font }); },
  };
  return ctx;
}

/** @param {{hint: boolean, reserve: number}} opts */
function runHintAndMessages(opts) {
  const ctx = createFullRecordingCtx();
  const sandbox = /** @type {any} */ ({
    ctx, W: 800, safeLeft: 0, Math, Date: { now: () => 0 },
    settings: { textScale: 1 },
    layout: { compact: false, hudTop: 500, msgBase: 488 },
    messages: [{ text: 'LONG MESSAGE THAT REACHES ACROSS THE CENTRE LINE', colour: '#fff', life: 2 }],
    _RG: { player: {}, hint: opts.hint ? { text: 'E: invert node + neighbours · 3/9', colour: '#39ff14' } : null },
    getStatusBadgeReservedHeight: () => opts.reserve,
  });
  vm.createContext(sandbox);
  vm.runInContext([
    'const MESSAGE_STATUS_GAP = 2;',
    'let _hintTopY = null;',
    extractFunctionSource(RENDER, 'drawMessages'),
    extractFunctionSource(RENDER, 'drawHint'),
    'this.drawMessages = drawMessages; this.drawHint = drawHint; this.hintTop = () => _hintTopY;',
  ].join('\n'), sandbox);
  // Frame 1 establishes the hint geometry; frame 2 is the steady state.
  sandbox.drawMessages(); sandbox.drawHint();
  ctx.calls.length = 0;
  sandbox.messages[0].life = 2;
  sandbox.drawMessages(); sandbox.drawHint();
  const msgBg = ctx.calls.filter((c) => c.op === 'fillRect').at(-1);
  const hint = ctx.calls.find((c) => c.op === 'fillText' && /invert node/.test(c.text));
  return { msgBg, hint, hintTop: sandbox.hintTop(), layout: sandbox.layout };
}

test('an active hint pushes the message log above it (no shared baseline)', () => {
  const { msgBg, hint, hintTop } = runHintAndMessages({ hint: true, reserve: 0 });
  assert.ok(hint, 'hint drawn');
  assert.ok(msgBg.y + msgBg.h <= hintTop, `message bottom ${msgBg.y + msgBg.h} must be at/above hint top ${hintTop}`);
});

test('the hint lifts above an active status badge strip', () => {
  const reserve = 30;
  const { hint, layout } = runHintAndMessages({ hint: true, reserve });
  assert.ok(hint.y <= layout.hudTop - reserve - 4, `hint baseline ${hint.y} must clear the badge strip top ${layout.hudTop - reserve}`);
});

test('without a hint the message log keeps its original baseline', () => {
  const { msgBg, layout } = runHintAndMessages({ hint: false, reserve: 0 });
  assert.equal(msgBg.y + msgBg.h, layout.msgBase + 5);
});

// ─── Mainframe chamber set pieces ─────────────────────────────────────────

/** @param {boolean} bossAlive */
function runMainframeSetPieces(bossAlive) {
  const ctx = createFullRecordingCtx();
  const T = { WALL: 1, FLOOR: 2, DOOR_OPEN: 6 };
  const W_ = 40, H_ = 30;
  /** @type {any} */
  const map = Array.from({ length: H_ }, () => new Array(W_).fill(T.FLOOR));
  const room = { x: 10, y: 10, w: 18, h: 10, cx: 19, cy: 15, roomType: 'mainframe',
    interactables: { reader: { x: 13, y: 15 }, portal: { x: 19, y: 15 }, console: { x: 24, y: 15 }, core: { x: 19, y: 18 } } };
  for (let x = 9; x <= 28; x++) map[9][x] = T.WALL;
  map[9][12] = T.DOOR_OPEN; // an entrance in the rack row must not be dressed as a rack
  const visited = Array.from({ length: H_ }, () => new Array(W_).fill(1));
  const sandbox = /** @type {any} */ ({
    ctx, T, TILE: 32, TWO_PI: Math.PI * 2, lastTime: 1000, Math,
    _RG: { dungeon: { rooms: [room], map, visited }, bossAlive },
  });
  vm.createContext(sandbox);
  vm.runInContext([
    'const _MF_RACK_TILES = 7;',
    extractFunctionSource(RENDER, 'drawMainframeSetPieces'),
    'this.draw = drawMainframeSetPieces;',
  ].join('\n'), sandbox);
  sandbox.draw(0, 0);
  return { ctx, room };
}

test('mainframe racks dress only real wall tiles above the chamber', () => {
  const { ctx } = runMainframeSetPieces(true);
  const panels = ctx.calls.filter((c) => c.op === 'fillRect' && c.fillStyle === '#07141f');
  const tiles = panels.map((c) => Math.floor(c.x / 32)).sort((a, b) => a - b);
  assert.deepEqual(tiles, [10, 11, 13, 14, 15, 16], 'seven rack slots minus the open entrance at x=12');
  assert.ok(panels.every((c) => Math.floor(c.y / 32) === 9), 'racks sit on the wall row, never on walkable floor');
});

test('the network portal reads sealed while GENESIS lives and open afterwards', () => {
  const sealed = runMainframeSetPieces(true).ctx.calls;
  const open = runMainframeSetPieces(false).ctx.calls;
  assert.ok(sealed.some((c) => c.op === 'fillText' && /SEALED BY GENESIS/.test(c.text)));
  assert.ok(sealed.some((c) => c.op === 'arc' && c.strokeStyle === '#ff3355'));
  assert.ok(open.some((c) => c.op === 'fillText' && /RELAY OPEN/.test(c.text)));
  assert.ok(open.some((c) => c.op === 'arc' && c.strokeStyle === '#88ccff'));
  const ring = open.find((c) => c.op === 'arc' && c.r >= 32 * 2);
  assert.ok(ring, 'the portal ring spans multiple tiles');
  assert.equal(ring.x, 19 * 32 + 16);
  assert.equal(ring.y, 15 * 32 + 16);
  const label = open.find((c) => c.op === 'fillText' && /NETWORK PORTAL/.test(c.text));
  assert.ok(label && label.y < ring.y - ring.r, 'the portal label sits above the ring, not across it');
});

test('trial tiles route to NEON.trials.drawTrialTile and the seam draws as a wall', () => {
  assert.match(RENDER, /case T\.LOGIC_NODE:\s*\n\s*case T\.LOGIC_NODE_LIT:\s*\n\s*case T\.SYNC_CONSOLE:\s*\n\s*if \(typeof NEON !== 'undefined' && NEON\.trials\) NEON\.trials\.drawTrialTile\(/);
  assert.match(RENDER, /case T\.SEAM_WALL:[^\n]*\n\s*case T\.WALL: \{/);
  assert.equal((RENDER.match(/tile === T\.WALL \|\| tile === T\.CRACKED \|\| tile === T\.SEAM_WALL/g) || []).length, 2, 'both minimaps hide the seam as wall');
});
