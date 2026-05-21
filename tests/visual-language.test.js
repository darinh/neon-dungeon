'use strict';
// @ts-check

const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { readSourceFile } = require('./_source-files.js');

const PICKUPS = readSourceFile(__dirname, 'contentPickups');
const RENDER = readSourceFile(__dirname, 'render');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`could not extract ${name}`);
}

function createCtx() {
  const calls = [];
  return {
    calls,
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    shadowBlur: 0,
    shadowColor: '',
    lineWidth: 1,
    font: '',
    save() { calls.push({ op: 'save' }); },
    restore() { calls.push({ op: 'restore' }); },
    translate(x, y) { calls.push({ op: 'translate', x, y }); },
    rotate(angle) { calls.push({ op: 'rotate', angle }); },
    beginPath() { calls.push({ op: 'beginPath' }); },
    moveTo(x, y) { calls.push({ op: 'moveTo', x, y }); },
    lineTo(x, y) { calls.push({ op: 'lineTo', x, y }); },
    closePath() { calls.push({ op: 'closePath' }); },
    stroke() {
      calls.push({
        op: 'stroke',
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        globalAlpha: this.globalAlpha,
        shadowBlur: this.shadowBlur,
        shadowColor: this.shadowColor,
      });
    },
    fill() {
      calls.push({
        op: 'fill',
        fillStyle: this.fillStyle,
        globalAlpha: this.globalAlpha,
        shadowBlur: this.shadowBlur,
        shadowColor: this.shadowColor,
      });
    },
    fillRect(x, y, w, h) {
      calls.push({
        op: 'fillRect',
        x, y, w, h,
        fillStyle: this.fillStyle,
        globalAlpha: this.globalAlpha,
        shadowBlur: this.shadowBlur,
        shadowColor: this.shadowColor,
      });
    },
    fillText(text, x, y) {
      calls.push({
        op: 'fillText',
        text, x, y,
        fillStyle: this.fillStyle,
        globalAlpha: this.globalAlpha,
        shadowBlur: this.shadowBlur,
        shadowColor: this.shadowColor,
      });
    },
  };
}

function loadPickupSandbox() {
  const sandbox = {
    console,
    Math,
    TWO_PI: Math.PI * 2,
    TILE: 32,
    UPGRADES: [
      { id: 'MED_PACK', colour: '#00ff88', persistent: false },
      { id: 'XP_CHIP', colour: '#ffff00', persistent: false },
      { id: 'CREDIT_CACHE', colour: '#ffd700', persistent: false },
    ],
    WEAPON_KEYS: ['PULSE_PISTOL'],
    buildWeapon: () => ({ colour: '#ffb700', _base: 'PULSE_PISTOL' }),
    rollWeapon: () => ({ colour: '#ffb700', _base: 'PULSE_PISTOL' }),
    rndInt: () => 0,
    rand: () => 0,
    _CG: { dungeon: { visible: [[true, true], [true, true]] } },
    NEON: {
      draw: {
        circleStroke(ctx, x, y, r) {
          ctx.calls.push({
            op: 'circleStroke',
            x, y, r,
            strokeStyle: ctx.strokeStyle,
            lineWidth: ctx.lineWidth,
            globalAlpha: ctx.globalAlpha,
            shadowBlur: ctx.shadowBlur,
            shadowColor: ctx.shadowColor,
          });
        },
        circle(ctx, x, y, r) {
          ctx.calls.push({
            op: 'circle',
            x, y, r,
            fillStyle: ctx.fillStyle,
            globalAlpha: ctx.globalAlpha,
            shadowBlur: ctx.shadowBlur,
            shadowColor: ctx.shadowColor,
          });
        },
      },
    },
    ctx: createCtx(),
  };
  vm.createContext(sandbox);
  vm.runInContext(`${PICKUPS}
Object.assign(globalThis, {
  drawPickupHalo, HarvestPickup, MagpieHoard, VaultCoin, ShockPulsePickup,
  Item, KeyItem, WhisperItem, WeaponCacheItem
});`, sandbox);
  return sandbox;
}

function loadRenderVisualSandbox() {
  const source = [
    'const TILE = 32;',
    extractFunction(RENDER, 'drawReadableFrame'),
    extractFunction(RENDER, 'drawMinimapDiamondMarker'),
    extractFunction(RENDER, 'collectibleMapMarkerColour'),
    'Object.assign(globalThis, { drawReadableFrame, drawMinimapDiamondMarker, collectibleMapMarkerColour });',
  ].join('\n');
  const sandbox = { Math };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox;
}

test('pickup draw methods emit shared halo plus distinct inner silhouettes', () => {
  const sandbox = loadPickupSandbox();
  const cases = [
    {
      name: 'Item',
      instance: new sandbox.Item(1, 1, { colour: '#00ff88' }),
      halo: '#00ff88',
      inner: (calls) => calls.some((c) => c.op === 'fillRect' && c.x === -4.5 && c.w === 9),
    },
    {
      name: 'KeyItem',
      instance: new sandbox.KeyItem(1, 1, 'red', '#ff3333'),
      halo: '#ff3333',
      inner: (calls) => calls.some((c) => c.op === 'circle' && c.r === 5) &&
        calls.some((c) => c.op === 'fillRect' && c.h === 8),
    },
    {
      name: 'WhisperItem',
      instance: new sandbox.WhisperItem(1, 1, 'w1'),
      halo: '#ff77ff',
      inner: (calls) => calls.some((c) => c.op === 'circle' && c.fillStyle === '#cc99ee') &&
        calls.some((c) => c.op === 'fillRect' && c.h === 10),
    },
    {
      name: 'WeaponCacheItem',
      instance: new sandbox.WeaponCacheItem(1, 1, { colour: '#ff00c8' }),
      halo: '#ff8833',
      inner: (calls) => calls.some((c) => c.op === 'fillRect' && c.w === 14 && c.h === 3) &&
        calls.some((c) => c.op === 'fillRect' && c.w === 4 && c.h === 10),
    },
  ];

  for (const itemCase of cases) {
    sandbox.ctx = createCtx();
    itemCase.instance.draw(0, 0);
    const halo = sandbox.ctx.calls.find((c) => c.op === 'circleStroke' && c.strokeStyle === itemCase.halo);
    assert.ok(halo, `${itemCase.name} must draw a shared collectible halo`);
    assert.equal(halo.lineWidth, 1.5, `${itemCase.name} halo uses the visual-language ring weight`);
    assert.equal(itemCase.inner(sandbox.ctx.calls), true, `${itemCase.name} must keep its unique inner silhouette`);
  }
});

test('transient reward pickups keep halo, urgency, and jackpot scale cues', () => {
  const sandbox = loadPickupSandbox();
  const cases = [
    { instance: new sandbox.HarvestPickup(1, 1), halo: '#ffcc66', minRadius: 7 },
    { instance: new sandbox.MagpieHoard(1, 1, 10), halo: '#cceeff', minRadius: 7 },
    { instance: new sandbox.ShockPulsePickup(1, 1), halo: '#aaf0ff', minRadius: 7 },
  ];

  for (const itemCase of cases) {
    sandbox.ctx = createCtx();
    itemCase.instance.draw(0, 0);
    const halo = sandbox.ctx.calls.find((c) => c.op === 'circleStroke' && c.strokeStyle === itemCase.halo);
    assert.ok(halo, 'transient reward pickups must keep a readable halo');
    assert.ok(halo.r >= itemCase.minRadius, 'halo radius must preserve pickup readability');
  }

  sandbox.ctx = createCtx();
  new sandbox.VaultCoin(1, 1, 5).draw(0, 0);
  const small = sandbox.ctx.calls.find((c) => c.op === 'circleStroke' && c.strokeStyle === '#ffe680');
  sandbox.ctx = createCtx();
  new sandbox.VaultCoin(1, 1, 25).draw(0, 0);
  const large = sandbox.ctx.calls.find((c) => c.op === 'circleStroke' && c.strokeStyle === '#ffe680');
  assert.ok(small && large, 'vault coins must draw gold halos');
  assert.ok(large.r > small.r, 'vault jackpot halo must stay larger than a small coin');
});

test('readable frame helper preserves fog alpha and draws corner brackets before glyphs', () => {
  const sandbox = loadRenderVisualSandbox();
  const ctx = createCtx();
  ctx.globalAlpha = 0.8;
  ctx.shadowBlur = 12;
  ctx.shadowColor = '#before';
  ctx.strokeStyle = '#stroke-before';
  ctx.lineWidth = 3;
  sandbox.drawReadableFrame(ctx, 10, 20, '#00f5ff', 0.5);

  const stroke = ctx.calls.find((c) => c.op === 'stroke');
  assert.ok(stroke, 'readable frame must emit a stroke');
  assert.equal(stroke.strokeStyle, '#00f5ff');
  assert.equal(stroke.globalAlpha, 0.425);
  assert.equal(ctx.globalAlpha, 0.8, 'readable frame must restore caller alpha for the glyph');
  assert.equal(ctx.shadowBlur, 12, 'readable frame must restore caller shadow blur');
  assert.equal(ctx.shadowColor, '#before', 'readable frame must restore caller shadow colour');
  assert.equal(ctx.strokeStyle, '#stroke-before', 'readable frame must restore caller stroke style');
  assert.equal(ctx.lineWidth, 3, 'readable frame must restore caller line width');
  assert.equal(ctx.calls.filter((c) => c.op === 'moveTo').length, 4, 'frame is four scan-bracket corners');
  assert.doesNotMatch(extractFunction(RENDER, 'drawReadableFrame'), /\.save\s*\(/,
    'drawReadableFrame must not add save/restore churn inside drawWorld');
});

test('minimap collectible markers are diamonds and skip clutter-only transient drops', () => {
  const sandbox = loadRenderVisualSandbox();
  const ctx = createCtx();
  ctx.shadowBlur = 9;
  ctx.shadowColor = '#old-shadow';
  ctx.fillStyle = '#old-fill';
  sandbox.drawMinimapDiamondMarker(ctx, 40, 50, 3, '#ff8833');

  assert.deepEqual(
    ctx.calls.filter((c) => c.op === 'moveTo' || c.op === 'lineTo').map((c) => [c.op, c.x, c.y]),
    [
      ['moveTo', 40, 47],
      ['lineTo', 43, 50],
      ['lineTo', 40, 53],
      ['lineTo', 37, 50],
    ],
    'collectible marker must use a diamond path, not the enemy square/dot path'
  );
  assert.equal(ctx.calls.some((c) => c.op === 'fill' && c.fillStyle === '#ff8833'), true);
  assert.equal(ctx.shadowBlur, 9, 'diamond marker must restore caller shadow blur');
  assert.equal(ctx.shadowColor, '#old-shadow', 'diamond marker must restore caller shadow colour');
  assert.equal(ctx.fillStyle, '#old-fill', 'diamond marker must restore caller fill style');

  assert.equal(sandbox.collectibleMapMarkerColour({ isWhisper: true }), '#ff77ff');
  assert.equal(sandbox.collectibleMapMarkerColour({ isWeaponCache: true }), '#ff8833');
  assert.equal(sandbox.collectibleMapMarkerColour({ isKey: true, tileColour: '#3388ff' }), '#3388ff');
  assert.equal(sandbox.collectibleMapMarkerColour({ type: { colour: '#00ff88' } }), '#00ff88');
  assert.equal(sandbox.collectibleMapMarkerColour({ isHoard: true }), null);
  assert.equal(sandbox.collectibleMapMarkerColour({ isHarvest: true }), null);
  assert.equal(sandbox.collectibleMapMarkerColour({ isShockPulse: true }), null);
});

test('rendering paths wire readable frames and pickup map legend into both minimaps', () => {
  const readableTiles = [
    'T.TERMINAL',
    'T.MAINFRAME_READER',
    'T.NETWORK_PORTAL',
    'T.MESSAGE_CONSOLE',
    'T.VENDOR',
    'T.IMPLANT_SHRINE',
    'T.EVENT_TERMINAL',
    'T.TELEPORT_PAD',
    'T.LORE',
  ];
  for (const tile of readableTiles) {
    const tileIndex = RENDER.indexOf(`case ${tile}`);
    assert.notEqual(tileIndex, -1, `${tile} case must exist`);
    const nextBreak = RENDER.indexOf('break;', tileIndex);
    const section = RENDER.slice(tileIndex, nextBreak);
    assert.match(section, /drawReadableFrame\s*\(\s*ctx\s*,\s*sx\s*,\s*sy\s*,/,
      `${tile} must draw the readable scan frame before its glyph`);
    assert.ok(section.indexOf('drawReadableFrame') < section.indexOf('fillText'),
      `${tile} must draw the frame before the glyph text`);
  }

  const markerCalls = RENDER.match(/drawVisibleCollectibleMinimapMarkers\s*\(/g) || [];
  assert.ok(markerCalls.length >= 2, 'corner and expanded minimaps must both draw collectible diamonds');
  assert.match(RENDER, /\['#ff8833','◆ Pickup'\]/, 'expanded legend must explain pickup diamond markers');
  assert.match(RENDER, /\['#ff77ff','◆ Whisper'\]/, 'expanded legend must explain whisper diamond markers');
});
