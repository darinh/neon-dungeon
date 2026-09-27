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
  /** @type {any[]} */
  const rects = [];
  return {
    calls,
    rects,
    font: '13px monospace',
    fillStyle: '#fff',
    shadowBlur: 0,
    shadowColor: '#000',
    textAlign: 'left',
    globalAlpha: 1,
    save() {},
    restore() {},
    /** @param {number} x @param {number} y @param {number} w @param {number} h */
    fillRect(x, y, w, h) { rects.push({ x, y, w, h, fillStyle: this.fillStyle }); },
    /** @param {any} text */
    measureText(text) {
      const match = /(\d+(?:\.\d+)?)px/.exec(this.font);
      const px = match ? Number(match[1]) : 13;
      return { width: px * 0.6 * String(text).length };
    },
    /** @param {any} text @param {number} x @param {number} y */
    fillText(text, x, y) {
      const width = this.measureText(text).width;
      // Record the left edge so right/centre-aligned labels compare correctly.
      const left = this.textAlign === 'right' ? x - width : this.textAlign === 'center' ? x - width / 2 : x;
      calls.push({ text: String(text), x: left, y, width, font: this.font });
    },
  };
}

/**
 * @typedef {{atk:number, def:number, floor:number, compact?:boolean, modifier?: boolean, modifierSuffix?: string,
 *   bombCooldown?: number, hackware?: boolean, hackwareCooldown?: number, width?: number, comboCount?: number,
 *   comboMult?: number, score?: number, weaponName?: string, dashCooldown?: number, shield?: boolean, belt?: number,
 *   weaponIdx?: number, credits?: number, lore?: number, cores?: number, inset?: number, phSuffix?: string,
 *   spSuffix?: string, nanoCharges?: number, hp?: number}} HudOpts
 */

const HUD_SOURCE = `const HUD_STAT_GAP = 12;\n${extractFunctionSource(RENDER, 'drawHUD')}\nthis.drawHUD = drawHUD;`;
/** One compiled vm context per drawHUD source; per-call state is assigned onto it. */
const HUD_CONTEXTS = new Map();
const VIEWPORT = require('../engine/viewport.js');

/**
 * @param {HudOpts} opts
 * @param {string} [source] drawHUD source to run (defaults to the real one)
 * @param {(n: number) => void} [hit] call-site probe for tagged sources
 */
function drawHud(opts, source = HUD_SOURCE, hit = () => {}) {
  let sandbox = HUD_CONTEXTS.get(source);
  if (!sandbox) {
    sandbox = /** @type {any} */ ({
      settings: { textScale: 1, minimapScale: 1 },
      RARITY_COLOURS: ['#ff00c8', '#00f5ff', '#ffb700'],
      HACKWARE: { BLINK: { icon: '⇥', name: 'PHASE BLINK', colour: '#44ccff' } },
      COMBO_WINDOW: 3,
      getMod() { return { icon: '⛨', label: 'FORTIFIED', colour: '#fff' }; },
      comboColour() { return '#fff'; },
      drawObservationHudFrame() {},
      Math,
    });
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    HUD_CONTEXTS.set(source, sandbox);
  }
  const hudW = opts.width || (opts.compact ? 360 : 960);
  const hudH = opts.compact ? 640 : 540;
  // Fixtures must be layouts the game can really enter: the runtime
  // predicate decides compact vs landscape, not the test.
  assert.equal(VIEWPORT.computeLayout(hudW, hudH, 0).compact, !!opts.compact, `${hudW}x${hudH} compact=${!!opts.compact} is not a real layout`);
  const ctx = createRecordingCtx();
  Object.assign(sandbox, {
    ctx,
    __hit: hit,
    W: hudW,
    H: hudH,
    safeLeft: opts.inset || 0,
    safeRight: opts.inset || 0,
    layout: { compact: !!opts.compact, hudTop: opts.compact ? 560 : 492 },
    _RG: { floor: opts.floor, modifier: opts.modifier ? 'FORTIFIED' : null, _cachedCores: opts.cores || 0, _coreHudPulse: 0 },
    combo: { count: opts.comboCount || 0, timer: 1, flashTimer: 0 },
    modifierProgressSuffix() { return opts.modifierSuffix || ''; },
    piercingHeartHudSuffix() { return opts.phSuffix || ''; },
    siphonHudSuffix() { return opts.spSuffix || ''; },
    comboMultiplier() { return opts.comboMult || 1; },
  });
  const weapon = { name: opts.weaponName || 'PLASMA RIFLE MK-ULTRA' };
  sandbox.drawHUD({
    hp: opts.hp || 100,
    maxHp: opts.hp || 100,
    atk: opts.atk,
    def: opts.def,
    level: 9,
    xp: 0,
    xpNeeded: () => 100,
    weapon,
    weapons: Array.from({ length: opts.belt || 0 }, () => weapon),
    weaponIdx: opts.weaponIdx || 0,
    score: opts.score === undefined ? 1234 : opts.score,
    credits: opts.credits === undefined ? 12 : opts.credits,
    loreRead: new Set(Array.from({ length: opts.lore || 0 }, (_, i) => i)),
    keys: { red: 0, blue: 0, gold: 0 },
    perks: opts.shield ? { ENERGY_SHIELD: true } : {},
    energyShield: !opts.shield,
    energyShieldTimer: opts.shield ? 30 : 0,
    bombCooldown: opts.bombCooldown || 0,
    dashCooldown: opts.dashCooldown || 0,
    hackware: opts.hackware ? 'BLINK' : null,
    hackwareCooldown: opts.hackwareCooldown || 0,
    _nanoMedicCharges: opts.nanoCharges || 0,
  });
  return { texts: ctx.calls, rects: ctx.rects };
}

/** @param {HudOpts} opts */
function drawHudTexts(opts) {
  return drawHud(opts).texts;
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
    calls.find(c => c.text.startsWith('[F] ⇥') && c.text.endsWith('RDY')),
    // The right-side cores readout closes the row: nothing may run into it.
    calls.find(c => c.text.startsWith('◆ ')),
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
    calls.find(c => c.text.startsWith('[F] ⇥') && c.text.endsWith('4.5s')),
    calls.find(c => c.text.startsWith('◆ ')),
  ];
  assert.ok(boxes.every(Boolean), `missing timed second-row calls: ${JSON.stringify(calls)}`);
  assertNonOverlapping(/** @type {any[]} */ (boxes));
});

// ─── Hackware label vs right-side readouts ────────────────────────────────

test('the hackware label never runs into the cores readout; it shortens instead', () => {
  const calls = drawHudTexts({ atk: 150, def: 99, floor: 15, modifier: true, modifierSuffix: ' 12/20', bombCooldown: 3.2, hackware: true, hackwareCooldown: 4.5 });
  const hw = calls.find((c) => c.text.startsWith('[F]'));
  const cores = calls.find((c) => c.text.startsWith('◆ '));
  assert.ok(hw && cores, 'both labels drawn at 960px');
  assert.ok(hw.x + hw.width <= cores.x, `${hw.text} (${hw.x}-${hw.x + hw.width}) overlaps ${cores.text} at ${cores.x}`);
  assert.doesNotMatch(hw.text, /PHASE BLINK/, 'the crowded 960px row falls back to the short form');
  const wide = drawHudTexts({ atk: 150, def: 99, floor: 15, modifier: true, modifierSuffix: ' 12/20', bombCooldown: 3.2, hackware: true, hackwareCooldown: 4.5, width: 1600 });
  const hwWide = wide.find((c) => c.text.startsWith('[F]'));
  assert.ok(hwWide && /PHASE BLINK/.test(hwWide.text), 'wide screens keep the full hackware name');
});

test('landscape row 2 fits every width: bomb state always shows, nothing reaches the cores readout', () => {
  for (const width of [780, 800, 820, 860, 910, 960, 1100, 1400]) {
    const calls = drawHudTexts({ atk: 150, def: 99, floor: 15, modifier: true, modifierSuffix: ' 12/20', bombCooldown: 3.2, hackware: true, hackwareCooldown: 4.5, width });
    const cores = calls.find((c) => c.text.startsWith('◆ '));
    assert.ok(cores, 'cores readout drawn at ' + width);
    const row2 = calls.filter((c) => c.y === cores.y - 4).sort((a, b) => a.x - b.x);
    assert.ok(row2.some((c) => c.text.startsWith('[V]')), `bomb state visible at ${width}: ${JSON.stringify(row2)}`);
    assertNonOverlapping(/** @type {any[]} */ (row2));
    for (const c of row2) assert.ok(c.x + c.width <= cores.x, `${c.text} crosses the cores readout at ${width}`);
  }
  const at910 = drawHudTexts({ atk: 150, def: 99, floor: 15, modifier: true, modifierSuffix: ' 12/20', bombCooldown: 3.2, hackware: true, hackwareCooldown: 4.5, width: 910 });
  assert.ok(at910.some((c) => c.text === '[F] 4.5s'), 'hackware degrades to text-only before disappearing');
  const at800 = drawHudTexts({ atk: 150, def: 99, floor: 15, modifier: true, modifierSuffix: ' 12/20', bombCooldown: 3.2, hackware: true, hackwareCooldown: 4.5, width: 800 });
  assert.ok(at800.some((c) => c.text === '[V] 3.2s'), 'the bomb label shortens instead of overlapping');
  const at780 = drawHudTexts({ atk: 150, def: 99, floor: 15, modifier: true, modifierSuffix: ' 12/20', bombCooldown: 3.2, hackware: true, hackwareCooldown: 4.5, width: 780 });
  assert.ok(at780.some((c) => c.text === '⛨ 12/20'), 'a crowded row keeps the modifier icon and its progress');
});

test('narrow landscape (phone at world zoom 1.25-1.5): row 2 drops labels rather than crossing the cores readout', () => {
  // Logical widths 563-700 happen when a phone first launched in portrait
  // (mobile-first world zoom 1.5) is rotated to landscape.
  for (const width of [563, 568, 600, 640, 700, 740]) {
    for (const bombCooldown of [0, 3.2]) {
      const calls = drawHudTexts({ atk: 150, def: 99, floor: 15, modifier: true, modifierSuffix: ' 12/20', bombCooldown, hackware: true, hackwareCooldown: 4.5, width });
      const cores = calls.find((c) => c.text.startsWith('◆ '));
      assert.ok(cores, 'cores readout drawn at ' + width);
      const row2 = calls.filter((c) => c.y === cores.y - 4).sort((a, b) => a.x - b.x);
      assertNonOverlapping(/** @type {any[]} */ (row2));
      for (const c of row2) assert.ok(c.x + c.width <= cores.x, `${c.text} crosses the cores readout at ${width}: ${JSON.stringify(row2)}`);
    }
  }
  // The bomb state is only dropped where even the short form cannot fit.
  const at700 = drawHudTexts({ atk: 10, def: 2, floor: 3, bombCooldown: 3.2, width: 700 });
  assert.ok(at700.some((c) => c.text.startsWith('[V]')), 'uncrowded 700px row keeps the bomb state');
  const at563 = drawHudTexts({ atk: 150, def: 99, floor: 15, bombCooldown: 3.2, width: 563 });
  assert.ok(!at563.some((c) => c.text.startsWith('[V]')), 'no room at 563px: the bomb label is dropped, not overlapped');
});

test('landscape row 1: weapon name, SCORE and the combo readout never overlap, at any width', () => {
  for (const width of [563, 568, 640, 700, 780, 844, 960, 1280, 1920]) {
    for (const comboCount of [0, 12, 250]) {
      const calls = drawHudTexts({ atk: 150, def: 99, floor: 15, width, comboCount, comboMult: 4, score: 1234567, weaponName: 'OVERCLOCKED PLASMA RIFLE MK-ULTRA OF THE VOID' });
      const score = calls.find((c) => c.text.startsWith('SCORE:'));
      assert.ok(score, 'SCORE drawn at ' + width);
      const row1 = calls.filter((c) => c.y === score.y || c.y === score.y - 2).sort((a, b) => a.x - b.x);
      assertNonOverlapping(/** @type {any[]} */ (row1));
      const last = row1[row1.length - 1];
      assert.ok(last.x + last.width <= width - 10 + 0.001, `row 1 runs off the right edge at ${width}: ${JSON.stringify(last)}`);
      const comboLabel = calls.find((c) => c.text.startsWith('×'));
      if (comboCount < 2) assert.equal(comboLabel, undefined);
      else if (width >= 700) assert.ok(comboLabel && comboLabel.x > score.x, `combo readout shown right of SCORE at ${width}`);
    }
  }
  const quiet = drawHudTexts({ atk: 150, def: 99, floor: 15, width: 960 }).find((c) => c.text.startsWith('SCORE:'));
  const combo = drawHudTexts({ atk: 150, def: 99, floor: 15, width: 960, comboCount: 12, comboMult: 2.5 }).find((c) => c.text.startsWith('SCORE:'));
  assert.deepEqual(combo && [combo.x, combo.y], quiet && [quiet.x, quiet.y], 'SCORE stays put when a combo starts');
  const wide = drawHudTexts({ atk: 150, def: 99, floor: 15, width: 1280 });
  assert.ok(wide.some((c) => c.text === 'PLASMA RIFLE MK-ULTRA'), 'wide screens show the full weapon name');
});

// ─── Landscape HUD: fit sweep over widths, safe insets and player states ──

const HUD_TOP = 492;

/** @param {any} r */
const isPip = (r) => (r.w === 8 || r.w === 6) && (r.h === 4 || r.h === 3);

/**
 * Text boxes and belt pips of the landscape HUD, split into its two bands:
 * row 1 (baselines y+10..y+15, plus the pips) and row 2 (y+22 action labels,
 * y+26 readouts). Every text must sit on one of those baselines, so a label
 * drawn anywhere else cannot escape the checks.
 * @param {HudOpts} opts
 */
function landscapeBands(opts) {
  const { texts, rects } = drawHud(opts);
  const stray = texts.filter((c) => ![10, 12, 15, 22, 26].includes(c.y - HUD_TOP));
  assert.deepEqual(stray.map((c) => [c.text, c.y - HUD_TOP]), [], 'landscape texts off every checked baseline');
  const pips = rects.filter(isPip).map((r) => ({ text: 'pip', x: r.x, y: r.y, width: r.w, h: r.h }));
  // Pips belong on the weapon line, above its baseline (y+10).
  const offLine = pips.filter((p) => p.y < HUD_TOP || p.y + p.h > HUD_TOP + 10);
  assert.deepEqual(offLine.map((p) => p.y - HUD_TOP), [], 'landscape belt pips off the weapon line');
  const row1 = [...texts.filter((c) => c.y <= HUD_TOP + 15), ...pips].sort((a, b) => a.x - b.x);
  const row2 = texts.filter((c) => c.y >= HUD_TOP + 22).sort((a, b) => a.x - b.x);
  return { row1, row2, pips, texts, rects };
}

/** @param {any[]} boxes @param {string} where */
function assertBandFits(boxes, where) {
  for (let i = 0; i < boxes.length - 1; i++) {
    assert.ok(boxes[i].x + boxes[i].width <= boxes[i + 1].x + 0.001,
      `${boxes[i].text} overlaps ${boxes[i + 1].text} at ${where}: ${JSON.stringify(boxes.map((b) => [b.text, Math.round(b.x), Math.round(b.width)]))}`);
  }
}

/** @type {HudOpts} */
const FULL_STATE = { atk: 150, def: 99, floor: 15, modifier: true, modifierSuffix: ' 12/20', bombCooldown: 3.2,
  hackware: true, hackwareCooldown: 4.5, dashCooldown: 1.2, shield: true, belt: 3, weaponIdx: 1,
  phSuffix: ' ♥12/20', score: 1234567, comboCount: 1000, comboMult: 4, credits: 123456, lore: 12, cores: 12345,
  weaponName: 'OVERCLOCKED PLASMA RIFLE MK-ULTRA', hp: 1250 };
/** @type {HudOpts} */
const LOW_STATE = { atk: 10, def: 2, floor: 1, modifier: true, modifierSuffix: ' 0/20', dashCooldown: 0.4,
  shield: true, belt: 2, score: 0, comboCount: 2, comboMult: 1.2, credits: 0, lore: 1,
  spSuffix: ' ◈2/3', nanoCharges: 2, bombCooldown: 0, hackware: true };
/** @type {HudOpts} */
const QUIET_STATE = { atk: 10, def: 2, floor: 1 };
/** @type {HudOpts} */
const DASH_STATE = { atk: 150, def: 99, floor: 9, dashCooldown: 2.5, score: 98765 };
/** @type {HudOpts} */
const BIG_STATE = { atk: 999, def: 999, floor: 15, bombCooldown: 12.5, hackware: true, hackwareCooldown: 9.9,
  belt: 2, score: 4567890, credits: 45678, cores: 999, lore: 60, hp: 9999, shield: true, dashCooldown: 1.5 };
const SWEEP_STATES = /** @type {[string, HudOpts][]} */ ([['full', FULL_STATE], ['low', LOW_STATE], ['quiet', QUIET_STATE], ['dash', DASH_STATE], ['big', BIG_STATE]]);

/**
 * Every fallback form a budgeted label can take must actually be drawn by
 * some swept configuration, so each form's own width is overlap-checked.
 * @param {string[]} drawn
 * @param {[string, RegExp][]} tiers
 * @param {string} layout
 */
function assertTiersReached(drawn, tiers, layout) {
  const missing = tiers.filter(([, re]) => !drawn.some((t) => re.test(t))).map(([name]) => name);
  assert.deepEqual(missing, [], `${layout} fallback forms no swept configuration draws`);
}

test('landscape HUD: no label or belt pip overlaps another or leaves the safe area, at any realistic width and inset', () => {
  // Logical landscape widths run from the smallest phone at the mobile-first
  // zoom 1.5 (568x320 -> 541) to desktop. Safe insets are logical px, up to a
  // notched phone at zoom 2 (~71). Below ~410 px between the insets even the
  // fixed HP..TEST block cannot fit, so those combinations are out of scope.
  const widths = [];
  for (let w = 541; w <= 1000; w += 3) widths.push(w);
  widths.push(1100, 1280, 1400, 1600, 1920);
  /** @type {Set<string>} */
  const drawn = new Set();
  let checked = 0;
  for (const width of widths) {
    for (const inset of [0, 31, 44, 63, 71]) {
      if (width - 2 * inset < 410) continue;
      for (const [name, state] of SWEEP_STATES) {
        const where = `W=${width} inset=${inset} ${name}`;
        const { row1, row2, texts, rects } = landscapeBands({ ...state, width, inset });
        assertBandFits(row1, where);
        assertBandFits(row2, where);
        for (const c of [...row1, ...row2]) {
          assert.ok(c.x >= inset && c.x + c.width <= width - inset + 0.001,
            `${c.text} leaves the safe area at ${where}: x=${c.x} w=${c.width}`);
        }
        // Row-2 action labels never sit under the XP bar (colBase..colBase+50);
        // the HP text and the trauma-kit counter stay inside the HP bar.
        const colBase = 14 + inset + 141;
        for (const c of row2) {
          if (c.y === HUD_TOP + 22) assert.ok(c.x >= colBase + 50, `${c.text} sits under the XP bar at ${where}`);
        }
        const hpBar = rects.find((r) => r.w === 130 && r.h === 14);
        assert.ok(hpBar, 'HP bar drawn');
        for (const c of texts.filter((t) => t.y === HUD_TOP + 15)) {
          assert.ok(hpBar && c.x >= hpBar.x && c.x + c.width <= hpBar.x + hpBar.w + 0.001, `${c.text} outside the HP bar at ${where}`);
        }
        for (const c of texts) drawn.add(c.y === HUD_TOP + 12 && /^\d+$/.test(c.text) ? `score:${c.text}` : c.text);
        checked++;
      }
    }
  }
  assert.ok(checked >= 1500, `swept ${checked} configurations`);
  assertTiersReached([...drawn], [
    ['modifier full', /^⛨FORTIFIED /], ['modifier icon+progress', /^⛨ \d/], ['modifier icon', /^⛨$/],
    ['bomb full', /^\[V\] Bomb /], ['bomb short', /^\[V\] (\d|RDY)/],
    ['hackware full', /^\[F\] ⇥PHASE BLINK /], ['hackware icon', /^\[F\] ⇥ /], ['hackware text', /^\[F\] (\d|RDY)/],
    ['shield full', /^🛡 \d/], ['shield tight', /^🛡\d/],
    ['dash full', /^\[⇧\] DASH /], ['dash short', /^\[⇧\] \d/], ['dash minimal', /^⇧\d/],
    ['SCORE label', /^SCORE: /], ['SCORE bare', /^score:\d+$/],
    ['weapon full', /^OVERCLOCKED PLASMA RIFLE MK-ULTRA$/], ['weapon truncated', /^OVE.*…$/],
    ['combo', /^×4\.0 ×1000$/],
  ], 'landscape');
});

test('the swept states reach every draw call in the landscape HUD branch', () => {
  // A fit sweep only proves what it draws. Round 4 found overlaps in labels
  // the harness never switched on (dash, shield, belt pips, insets), so tag
  // each fillText/fillRect call site of the landscape branch and require the
  // sweep states to reach every one.
  const body = extractFunctionSource(RENDER, 'drawHUD');
  const from = body.indexOf('// ── Standard landscape HUD');
  const to = body.indexOf('drawObservationHudFrame(y);', from);
  assert.ok(from > 0 && to > from, 'landscape branch located');
  let sites = 0;
  const branch = body.slice(from, to).replace(/ctx\.(fillText|fillRect)\(/g, (_m, fn) => `(__hit(${sites++}), ctx).${fn}(`);
  const tagged = `const HUD_STAT_GAP = 12;\n${body.slice(0, from)}${branch}${body.slice(to)}\nthis.drawHUD = drawHUD;`;
  assert.ok(sites >= 20, `found ${sites} draw call sites (the tagging regex must still match)`);
  const reached = new Set();
  for (const state of [FULL_STATE, LOW_STATE, QUIET_STATE]) {
    for (const width of [541, 960, 1920]) drawHud({ ...state, width }, tagged, (n) => reached.add(n));
  }
  const missed = [];
  for (let i = 0; i < sites; i++) if (!reached.has(i)) missed.push(i);
  assert.deepEqual(missed, [], `landscape draw call sites the sweep states never reach: ${missed.join(', ')}`);
});

test('wide landscape keeps the full labels, and a 1000+ combo still fits its slot', () => {
  const { texts, pips } = landscapeBands({ ...FULL_STATE, width: 1920 });
  const has = (/** @type {string} */ t) => texts.some((c) => c.text === t);
  for (const t of ['SCORE: 1234567', '×4.0 ×1000', '[F] ⇥PHASE BLINK 4.5s', '[V] Bomb 3.2s', '⛨FORTIFIED 12/20', '🛡 30s', 'OVERCLOCKED PLASMA RIFLE MK-ULTRA', ' ♥12/20']) {
    assert.ok(has(t), `${t} drawn at 1920: ${JSON.stringify(texts.map((c) => c.text))}`);
  }
  assert.ok(texts.some((c) => /^(\[⇧\] |⇧)/.test(c.text)), 'dash cooldown drawn');
  assert.equal(pips.length, 3, 'one pip per belt weapon');
});

test('belt pips trail the weapon name on its own line, never under the row-2 label below it', () => {
  for (const width of [780, 960, 1280]) {
    const { texts, pips } = landscapeBands({ ...FULL_STATE, width, modifier: false });
    const name = texts.find((c) => c.text.startsWith('OVE'));
    const suffix = texts.find((c) => c.text === ' ♥12/20');
    const bomb = texts.find((c) => c.text.startsWith('[V]'));
    assert.ok(name && suffix && bomb, `name, suffix and bomb drawn at ${width}`);
    assert.equal(pips.length, 3);
    for (const p of pips) {
      assert.ok(p.y >= HUD_TOP && p.y + p.h <= HUD_TOP + 10, `pip within the weapon line at ${width}: y=${p.y}`);
      assert.ok(p.x >= suffix.x + suffix.width, `pip after the name and its suffix at ${width}`);
    }
    const active = pips.filter((p) => p.width === 8);
    assert.equal(active.length, 1);
    assert.equal(active[0] && active[0].x, pips[0] && pips[0].x + 10, 'the second pip marks weaponIdx 1');
  }
});

test('compact HUD: belt pips trail the weapon name and never sit over the B: bomb label', () => {
  const { texts, rects } = drawHud({ atk: 150, def: 99, floor: 15, compact: true, belt: 3, bombCooldown: 3.2 });
  const pips = rects.filter(isPip);
  const name = texts.find((c) => c.text.startsWith('PLASMA'));
  const bomb = texts.find((c) => c.text.startsWith('B:'));
  assert.ok(name && bomb, 'weapon name and bomb label drawn');
  assert.equal(pips.length, 3);
  for (const p of pips) {
    assert.ok(p.x >= name.x + name.width, 'pip right of the weapon name');
    assert.ok(p.x + p.w <= 360 - 10, 'pip inside the right margin');
    assert.ok(p.y + p.h <= name.y, 'pip on the weapon line, above its baseline');
    assert.ok(p.y + p.h <= bomb.y - 10 * 0.8 || p.x >= bomb.x + bomb.width || p.x + p.w <= bomb.x, 'pip clear of the B: label');
  }
  // A long name is truncated early enough to leave room for the pips.
  const long = drawHud({ atk: 150, def: 99, floor: 15, compact: true, belt: 3, weaponName: 'OVERCLOCKED PLASMA RIFLE MK-ULTRA OF THE VOID' });
  const longName = long.texts.find((c) => c.text.startsWith('OVERCLOCKED'));
  const longPips = long.rects.filter(isPip);
  assert.ok(longName && longName.text.endsWith('…'), 'the long name is truncated');
  assert.equal(longPips.length, 3);
  for (const p of longPips) {
    assert.ok(longName && p.x >= longName.x + longName.width, 'pips after the truncated name');
    assert.ok(p.x + p.w <= 360 - 10, `pip inside the right margin: ${p.x + p.w}`);
  }
});

test('SCORE drops its label, then hides, rather than leaving the safe area', () => {
  const at = (/** @type {number} */ width, /** @type {number} */ inset) =>
    drawHudTexts({ atk: 150, def: 99, floor: 15, score: 1234567, width, inset }).filter((c) => c.y === HUD_TOP + 12);
  assert.deepEqual(at(960, 0).map((c) => c.text), ['SCORE: 1234567']);
  assert.deepEqual(at(600, 44).map((c) => c.text), ['1234567'], 'a notched phone keeps the bare number');
  assert.deepEqual(at(557, 71).map((c) => c.text), [], 'no room at all: hidden, never past the inset');
});

test('the dash cooldown shortens, then hides, instead of crossing the flow labels or the cores readout', () => {
  const dashAt = (/** @type {HudOpts} */ o) => drawHudTexts(o).find((c) => /^(\[⇧\] |⇧)/.test(c.text));
  assert.equal(dashAt({ atk: 150, def: 99, floor: 15, dashCooldown: 1.2, width: 1280 })?.text, '[⇧] DASH 1.2s');
  const low = drawHudTexts({ atk: 10, def: 2, floor: 1, modifier: true, dashCooldown: 1.2, width: 1280 });
  const lowDash = low.find((c) => c.text.startsWith('[⇧]'));
  const badge = low.find((c) => c.text.startsWith('⛨'));
  assert.equal(lowDash?.text, '[⇧] 1.2s', 'low stats narrow the ATK column: the short form ends before the modifier badge');
  assert.ok(lowDash && badge && lowDash.x + lowDash.width + 12 <= badge.x + 0.001);
  const withShield = drawHudTexts({ atk: 150, def: 99, floor: 15, modifier: true, dashCooldown: 1.2, shield: true, width: 1280 });
  const shield = withShield.find((c) => c.text.startsWith('🛡'));
  const dash = withShield.find((c) => /^(\[⇧\] |⇧)/.test(c.text));
  assert.ok(shield && dash && shield.x + shield.width + 12 <= dash.x + 0.001, 'the dash label flows after the shield recharge');
  assert.equal(shield && shield.x, 14 + 141 + 60, 'the shield recharge sits under ATK, clear of the XP bar');
  assert.equal(dashAt({ ...FULL_STATE, width: 541 }), undefined, 'no room left of the cores readout at 541: hidden');
});

test('six-digit credits push the lore readout right instead of running into it', () => {
  const row2 = drawHudTexts({ ...QUIET_STATE, credits: 123456, lore: 3, width: 960 });
  const credits = row2.find((c) => c.text.startsWith('◈'));
  const lore = row2.find((c) => c.text.startsWith('◫'));
  assert.ok(credits && lore && credits.x + credits.width + 12 <= lore.x + 0.001);
  const usual = drawHudTexts({ ...QUIET_STATE, credits: 120, lore: 3, width: 960 }).find((c) => c.text.startsWith('◫'));
  assert.equal(usual && usual.x, 960 - 100, 'ordinary credit counts keep lore in its column');
});

// ─── Compact (portrait) HUD: fit sweep ─────────────────────────────────────

const C_TOP = 560;
// Compact baselines: row 1 (r1 = hudTop + 4) at r1+10 / r1+22, row 2
// (r2 = hudTop + 28) at r2+10 (weapon line, with the pips) / r2+22.
const C_BANDS = [C_TOP + 14, C_TOP + 26, C_TOP + 38, C_TOP + 50];

/**
 * The four compact baselines, each with its texts (and the pips on the weapon
 * line). Every text must sit on one of them. Also returns the HP and XP bars.
 * @param {HudOpts} opts
 */
function compactBands(opts) {
  const { texts, rects } = drawHud({ ...opts, compact: true });
  const stray = texts.filter((c) => !C_BANDS.includes(c.y));
  assert.deepEqual(stray.map((c) => [c.text, c.y - C_TOP]), [], 'compact texts off every checked baseline');
  // Pips belong on the weapon line (r2 = hudTop + 28), above its r2+10 baseline.
  const offLine = rects.filter(isPip).filter((r) => r.y < C_TOP + 30 || r.y + r.h > C_TOP + 38);
  assert.deepEqual(offLine.map((r) => r.y - C_TOP), [], 'compact belt pips off the weapon line');
  const pips = rects.filter(isPip).map((r) => ({ text: 'pip', x: r.x, y: C_TOP + 38, width: r.w }));
  const bands = C_BANDS.map((b) => [...texts.filter((c) => c.y === b), ...pips.filter((p) => p.y === b)].sort((a, c) => a.x - c.x));
  const hpBar = rects.find((r) => r.h === 12 && r.y === C_TOP + 4);
  const xpBar = rects.find((r) => r.w === 36 && r.h === 4);
  return { bands, texts, hpBar, xpBar };
}

test('compact HUD: nothing overlaps or passes the right margin at every portrait width and world zoom', () => {
  // W = CSS width / 0.7 / world zoom: 183 is a 320 px phone at the largest
  // zoom (2.5), 305 the same phone at the mobile-first zoom 1.5, 600 the
  // compact gate. Portrait phones have no side insets.
  /** @type {Set<string>} */
  const drawn = new Set();
  for (let width = 183; width <= 600; width += 2) {
    for (const [name, state] of SWEEP_STATES) {
      const where = `compact W=${width} ${name}`;
      const { bands, texts, hpBar, xpBar } = compactBands({ ...state, width });
      for (const band of bands) {
        assertBandFits(band, where);
        for (const c of band) assert.ok(c.x >= 0 && c.x + c.width <= width - 10 + 0.001, `${c.text} passes the right margin at ${where}`);
      }
      // The HP text (and the trauma-kit counter when it sits on the bar)
      // stay inside the HP bar; weapon-line texts stay clear of the XP bar.
      assert.ok(hpBar && xpBar, 'bars drawn');
      for (const c of texts.filter((t) => t.y === C_TOP + 14 && t.x < (hpBar ? hpBar.x + hpBar.w : 0))) {
        assert.ok(hpBar && c.x >= hpBar.x && c.x + c.width <= hpBar.x + hpBar.w + 0.001, `${c.text} leaves the HP bar at ${where}`);
      }
      for (const c of texts.filter((t) => t.y === C_TOP + 38)) {
        assert.ok(xpBar && (c.x + c.width <= xpBar.x || c.x >= xpBar.x + xpBar.w), `${c.text} runs into the XP bar at ${where}`);
      }
      for (const c of texts) {
        const tag = c.y === C_TOP + 14 && /^\d+$/.test(c.text) ? (c.x < 60 ? 'hp:' : 'score:') : c.y === C_TOP + 26 && c.text.startsWith('✚') ? 'under:' : '';
        drawn.add(tag + c.text);
      }
    }
  }
  assertTiersReached([...drawn], [
    ['HP full', /^HP \d+\/\d+$/], ['HP no prefix', /^\d+\/\d+$/], ['HP bare', /^hp:\d+$/],
    ['trauma kit on bar', /^✚\d$/], ['trauma kit under bar', /^under:✚\d$/],
    ['SCORE label', /^SCORE:\d/], ['SCORE bare', /^score:\d+$/],
    ['weapon full', /^OVERCLOCKED PLASMA RIFLE MK-ULTRA$/], ['weapon truncated', /^OVE.*…$/],
    ['bomb ready', /^B:RDY$/], ['bomb cooldown', /^B:\d/], ['hackware', /^F:/], ['combo', /^×/],
  ], 'compact');
  // The common case keeps every label: a 360 px phone at zoom 1.5.
  const texts = drawHudTexts({ ...LOW_STATE, compact: true, width: 343, score: 12345 });
  for (const t of ['SCORE:12345', '◈0', '◆0', '◫1', '✚2', '×1.2 ×2', 'HP 100/100', 'B:RDY', 'F:⇥']) assert.ok(texts.some((c) => c.text === t), `${t} drawn at 343`);
  // A 320 px phone at zoom 1.5 fits the score only without its label.
  const narrow = drawHudTexts({ ...LOW_STATE, compact: true, width: 305, score: 12345 }).filter((c) => c.y === C_TOP + 14);
  assert.ok(narrow.some((c) => c.text === '12345') && !narrow.some((c) => c.text.startsWith('SCORE:')), 'bare number at 305');
});

test('compact weapon line never runs past the right margin, even when its budget is tiny', () => {
  // Reviewer repro: reserving the pips pushed the budget under 20 px, where
  // the old guard skipped truncation and drew the full name off-screen.
  for (const width of [240, 260, 280, 305]) {
    for (const belt of [0, 2, 3]) {
      const { texts, rects } = drawHud({ atk: 150, def: 99, floor: 15, compact: true, belt, phSuffix: ' ♥12/20', width, weaponName: 'OVERCLOCKED PLASMA RIFLE' });
      const line = [...texts.filter((c) => c.y === C_TOP + 38), ...rects.filter(isPip).map((r) => ({ text: 'pip', x: r.x, width: r.w }))];
      for (const c of line) assert.ok(c.x + c.width <= width - 10 + 0.001, `${c.text} runs past the margin at W=${width} belt=${belt}`);
    }
  }
  const at260 = drawHud({ atk: 150, def: 99, floor: 15, compact: true, belt: 3, phSuffix: ' ♥12/20', width: 260, weaponName: 'OVERCLOCKED PLASMA RIFLE' });
  assert.ok(at260.texts.some((c) => c.text.startsWith('OVER') && c.text.endsWith('…')), 'the truncated name stays');
  assert.equal(at260.rects.filter(isPip).length, 0, 'the pips drop first');
  const at240 = drawHud({ atk: 150, def: 99, floor: 15, compact: true, belt: 3, phSuffix: ' ♥12/20', width: 240, weaponName: 'OVERCLOCKED PLASMA RIFLE' });
  assert.ok(!at240.texts.some((c) => c.text.startsWith('OV') || c.text === ' ♥12/20'), 'no room for "ABC…": name and suffix drop together');
  // The combo readout shares its line with the modifier badge: at 240 px a
  // long badge leaves no room, so the combo hides instead of overlapping it.
  const busy = drawHudTexts({ atk: 10, def: 2, floor: 1, compact: true, modifier: true, modifierSuffix: ' 12/20', comboCount: 1000, comboMult: 4, width: 240 });
  assert.ok(busy.some((c) => c.text === '⛨FORTIFIED 12/20'), 'badge drawn');
  assert.ok(!busy.some((c) => c.text.startsWith('×')), 'combo hidden rather than drawn over the badge');
});

test('the swept states reach every draw call in the compact HUD branch', () => {
  const body = extractFunctionSource(RENDER, 'drawHUD');
  const from = body.indexOf('// ── Compact portrait: two rows ──');
  const to = body.indexOf('// ── Standard landscape HUD', from);
  assert.ok(from > 0 && to > from, 'compact branch located');
  let sites = 0;
  const branch = body.slice(from, to).replace(/ctx\.(fillText|fillRect)\(/g, (_m, fn) => `(__hit(${sites++}), ctx).${fn}(`);
  const tagged = `const HUD_STAT_GAP = 12;\n${body.slice(0, from)}${branch}${body.slice(to)}\nthis.drawHUD = drawHUD;`;
  assert.ok(sites >= 20, `found ${sites} draw call sites (the tagging regex must still match)`);
  const reached = new Set();
  for (const state of [FULL_STATE, LOW_STATE, QUIET_STATE]) {
    for (const width of [343, 600]) drawHud({ ...state, width, compact: true }, tagged, (n) => reached.add(n));
  }
  const missed = [];
  for (let i = 0; i < sites; i++) if (!reached.has(i)) missed.push(i);
  assert.deepEqual(missed, [], `compact draw call sites the sweep states never reach: ${missed.join(', ')}`);
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
    'const _MF_RACK_TILES = 7; const _MF_CABLE_DASH = [4, 6]; const _MF_NO_DASH = [];',
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
