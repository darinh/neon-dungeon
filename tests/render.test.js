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
 * @param {{atk:number, def:number, floor:number, compact?:boolean}} opts
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
    _RG: { floor: opts.floor, modifier: null, _cachedCores: 0, _coreHudPulse: 0 },
    RARITY_COLOURS: ['#ff00c8', '#00f5ff', '#ffb700'],
    HACKWARE: {},
    COMBO_WINDOW: 3,
    combo: { count: 0, timer: 0, flashTimer: 0 },
    getMod() { return { icon: '', label: '', colour: '#fff' }; },
    modifierProgressSuffix() { return ''; },
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
    bombCooldown: 0,
    dashCooldown: 0,
    hackware: null,
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
