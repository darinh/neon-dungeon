// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const STATUS = fs.readFileSync(path.join(ROOT, 'src', 'content', 'status.js'), 'utf8');
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

function createCtx() {
  /** @type {any[]} */
  const calls = [];
  return {
    calls,
    font: '16px monospace',
    globalAlpha: 1,
    fillStyle: '#fff',
    shadowBlur: 0,
    shadowColor: '#000',
    save() {},
    restore() {},
    /** @param {any} text */
    measureText(text) {
      const match = /(\d+(?:\.\d+)?)px/.exec(this.font);
      const px = match ? Number(match[1]) : 16;
      return { width: px * 0.6 * String(text).length };
    },
    /** @param {number} x @param {number} y @param {number} w @param {number} h */
    fillRect(x, y, w, h) { calls.push({ op: 'fillRect', x, y, w, h }); },
    /** @param {any} text @param {number} x @param {number} y */
    fillText(text, x, y) { calls.push({ op: 'fillText', text: String(text), x, y, width: this.measureText(text).width }); },
  };
}

/**
 * @param {{withBadge?: boolean, fadingBadge?: boolean}} opts
 */
function runMessageLayout(opts = {}) {
  const withBadge = opts.withBadge === true;
  const fadingBadge = opts.fadingBadge === true;
  const ctx = createCtx();
  const player = {
    hp: 100,
    maxHp: 100,
    shockTimer: withBadge ? 1.2 : 0,
    burnTimer: 0,
    toxicSlowActive: false,
    dashTimer: 0,
    keys: { red: 0, blue: 0, gold: 0 },
    perks: {},
    upgrades: {},
    augments: {},
    hackware: null,
    hackwareCooldown: 0,
    energyShield: 0,
    energyShieldTimer: 0,
    reactiveArmorCD: 0,
  };
  const sandbox = /** @type {any} */ ({
    ctx,
    player,
    messages: [{ text: 'ROOM SEALED', colour: '#fff', life: 2 }],
    settings: { textScale: 1, minimapScale: 1 },
    layout: { compact: false, hudTop: 500, msgBase: 488 },
    _RG: { player },
    safeLeft: 0,
    safeRight: 0,
    W: 800,
    game: { modifier: null },
    _SG: { modifier: null },
    getMod() { return { icon: '', label: '', colour: '#fff' }; },
    hackwareEffects: [],
    MAX_AUGMENTS: 6,
    HACKWARE: {},
    hasAugment() { return false; },
    Math,
    Set,
    Object,
  });
  vm.createContext(sandbox);
  const statusSources = withBadge || fadingBadge
    ? [
        'let statusBadgeReservedHeight = 0;',
        fadingBadge
          ? "const statusFx = { shocked: { alpha: 0.5, icon: '⚡', label: '0.0s', colour: '#ffee44' } };"
          : 'const statusFx = {};',
        extractFunctionSource(STATUS, 'getStatusEffects'),
        extractFunctionSource(STATUS, 'drawStatusBar'),
        extractFunctionSource(STATUS, 'getStatusBadgeReservedHeight'),
      ]
    : ['let statusBadgeReservedHeight = 0;', 'function getStatusBadgeReservedHeight() { return 0; }'];
  vm.runInContext(
    [
      ...statusSources,
      'const MESSAGE_STATUS_GAP = 2;',
      'let _hintTopY = null;',
      extractFunctionSource(RENDER, 'drawMessages'),
      'this.drawMessages = drawMessages;',
      withBadge || fadingBadge ? 'this.drawStatusBar = drawStatusBar;' : '',
      'this.getStatusBadgeReservedHeight = getStatusBadgeReservedHeight;',
    ].join('\n'),
    sandbox
  );
  if (withBadge || fadingBadge) sandbox.drawStatusBar(player);
  const reserve = sandbox.getStatusBadgeReservedHeight(player);
  sandbox.drawMessages();
  const msgBg = ctx.calls.filter((/** @type {any} */ c) => c.op === 'fillRect').at(-1);
  assert.ok(msgBg, 'message background rect should be drawn');
  return { reserve, msgBg, layout: sandbox.layout };
}

test('messages reserve vertical space above active status badge strip', () => {
  const { reserve, msgBg, layout } = runMessageLayout({ withBadge: true });
  const badgeTop = layout.hudTop - reserve;
  assert.ok(reserve > 0, 'active shock badge should reserve space');
  assert.ok(msgBg.y + msgBg.h < badgeTop, `message bottom ${msgBg.y + msgBg.h} should be above badge top ${badgeTop}`);
});

test('messages keep reserved space while status badges fade out', () => {
  const { reserve, msgBg, layout } = runMessageLayout({ fadingBadge: true });
  const badgeTop = layout.hudTop - reserve;
  assert.ok(reserve > 0, 'fading statusFx entry should reserve space until it disappears');
  assert.ok(msgBg.y + msgBg.h < badgeTop, `message bottom ${msgBg.y + msgBg.h} should be above fading badge top ${badgeTop}`);
});

test('messages keep original placement when no status badges are visible', () => {
  const { reserve, msgBg, layout } = runMessageLayout();
  assert.equal(reserve, 0);
  assert.equal(msgBg.y + msgBg.h, layout.msgBase + 5);
});
