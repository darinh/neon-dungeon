// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { JOURNEYS, runJourney, readGolden, firstDifference, fmt, createGameSim, play, FRAME_MS } = require('./_game-sim.js');

/**
 * Journeys and checkpoints the oracle must keep. Deleting or emptying a
 * journey fails here even after re-recording, so shrinking the oracle is a
 * visible decision in review.
 */
const REQUIRED = {
  'menus-desktop': ['menu', 'archives', 'settings', 'menu click', 'offline menu shows the cached version'],
  'run-desktop': ['playing', 'dashed across a room', 'fought', 'two kills inside the combo window',
    'a kill after the combo window', 'paused', 'backgrounded', 'resumed', 'moved through a one-second stall',
    'died', 'menu after death'],
  'crawl-desktop': ['floor 1', 'floor 3 boss in phase two', 'floor 6 boss in phase two', 'floor 6 boss in phase three',
    'floor 15 boss down', 'mainframe', 'records read',
    'message sent', 'menu after victory'],
  'seeds-desktop': ['seed ALPHA', 'seed BRAVO', 'seed CHARLIE'],
  'touch-portrait': ['menu', 'seed setup', 'first message', 'joystick', 'aim and fire', 'dash button',
    'rotated to landscape', 'pause button'],
  'touch-landscape': ['menu', 'playing', 'joystick'],
};

/** @type {Map<string, ReturnType<typeof runJourney>>} */
const traces = new Map();
/** @param {string} name */
function trace(name) {
  let t = traces.get(name);
  if (!t) {
    t = runJourney(name);
    traces.set(name, t);
  }
  return t;
}

/**
 * A journey played with one exact source edit.
 * @param {string} journey @param {string} file @param {string} from @param {string} to
 */
function mutant(journey, file, from, to) {
  return runJourney(journey, {
    transform: (rel, code) => {
      if (!rel.endsWith(file)) return code;
      assert.equal(code.split(from).length, 2, `${file} contains the edited text exactly once`);
      return code.replace(from, to);
    },
  });
}

const golden = readGolden();

for (const name of Object.keys(JOURNEYS)) {
  test(`journey "${name}" reproduces its golden trace`, () => {
    const expected = golden[name];
    assert.ok(expected, `tests/golden/journeys.json has no "${name}"; record it with: node tests/_game-sim.js update ${name}`);
    const diff = firstDifference(expected, trace(name));
    assert.equal(diff, null, diff ? [
      `journey "${name}" diverged at checkpoint ${diff.index} "${diff.label}" in ${diff.fields.join(', ')}.`,
      `  golden: ${JSON.stringify(diff.expected)}`,
      `  actual: ${JSON.stringify(diff.actual)}`,
      `Find the first differing draw, audio, network or stored entry: node tests/_game-sim.js diff ${name} origin/develop`,
      'If the change is intended, re-record with node tests/_game-sim.js update ' + name + ' and explain it in the PR.',
    ].join('\n') : '');
  });
}

test('the oracle keeps every required journey and checkpoint', () => {
  for (const [name, labels] of Object.entries(REQUIRED)) {
    assert.ok(JOURNEYS[name], `journey "${name}" is missing`);
    const recorded = (golden[name] || []).map((r) => r.at);
    for (const label of labels) assert.ok(recorded.includes(label), `golden "${name}" has no checkpoint "${label}"`);
  }
});

test('every golden trace belongs to a journey', () => {
  assert.deepEqual(Object.keys(golden).sort(), Object.keys(JOURNEYS).sort());
});

/**
 * Dotted paths of every value that differs between two JSON values.
 * @param {unknown} a @param {unknown} b @param {string} [at]
 * @returns {string[]}
 */
function differingPaths(a, b, at = '') {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return [at];
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].flatMap((k) => differingPaths(/** @type {any} */ (a)[k], /** @type {any} */ (b)[k], at ? `${at}.${k}` : k));
}

/**
 * A HARD run on floor 3 with two weapons, a persistent upgrade and a few
 * levels, saved by hiding the page and then resumed in a fresh page.
 */
function hideAndResumeRichRun() {
  const sim = createGameSim({ width: 1280, height: 800 });
  sim.frames(30);
  sim.key('ArrowRight');
  play.startRun(sim, 'ORACLE-SAVE');
  play.enableCheats(sim, ['Digit1']);
  play.descend(sim);
  play.descend(sim);
  for (let i = 0; i < 14; i++) {
    play.killNearest(sim);
    play.settle(sim);
  }
  sim.eval("game.player.collectWeapon(buildWeapon('SCATTER_GUN', [])); game.player.upgrades.SAW_BLADE = 2;");
  sim.hide();
  sim.frames(1);
  const stored = sim.storage();
  const resumed = createGameSim({ width: 1280, height: 800, storage: stored });
  resumed.frames(30);
  play.activateMenuRow(resumed, () => resumed.key('Enter'));
  return {
    atHide: JSON.parse(stored.neonDungeonSave ?? 'null'),
    afterResume: JSON.parse(resumed.storage().neonDungeonSave ?? 'null'),
  };
}
/** @type {ReturnType<typeof hideAndResumeRichRun> | null} */
let richRun = null;
const rich = () => (richRun ??= hideAndResumeRichRun());

test('resume restores the floor, difficulty, belt, stats and upgrades of a hidden run', () => {
  const { atHide, afterResume } = rich();
  assert.equal(atHide.floor, 3);
  assert.equal(atHide.difficulty, 'HARD');
  assert.equal(atHide.player.weapons.length, 2);
  assert.equal(atHide.player.upgrades.SAW_BLADE, 2);
  assert.ok(atHide.player.level > 1, 'the run levelled up');
  for (const key of ['floor', 'difficulty', 'modifier', 'runSeed', 'bossesCleared', 'player']) {
    assert.deepEqual(afterResume[key], atHide[key], `${key} changed across resume`);
  }
});

test('resume saves exactly what was saved when the page was hidden',
  { todo: 'issue #1064: resume re-rolls room metadata and the event RNG stream' }, () => {
    const { atHide, afterResume } = rich();
    assert.deepEqual(differingPaths(atHide, afterResume), []);
  });

test('the crawl clears all fifteen floors, five bosses, and the finale', () => {
  const t = trace('crawl-desktop');
  assert.deepEqual(t.filter((r) => /^floor \d+$/.test(r.at)).map((r) => r.floor), [...Array(15)].map((_, i) => i + 1));
  assert.deepEqual(t.filter((r) => /boss down$/.test(r.at)).map((r) => r.floor), [3, 6, 9, 12, 15]);
  assert.equal(t[t.length - 1]?.state, 'MENU');
});

test('the same journey twice in one process gives the same trace', () => {
  assert.deepEqual(runJourney('touch-landscape'), runJourney('touch-landscape'));
});

test('stripping every comment and reformatting every script leaves the trace unchanged', () => {
  const stripped = runJourney('touch-landscape', {
    transform: (_rel, code) => ts.transpileModule(code, { compilerOptions: { removeComments: true, target: 99 } }).outputText,
  });
  assert.equal(firstDifference(trace('touch-landscape'), stripped), null);
});

test('the draw record ignores the order of independent state writes but not their values', () => {
  const site = "ctx.globalAlpha = s.alpha * 0.7;\n    ctx.fillStyle = 'rgba(10,10,18,0.7)';";
  const reordered = mutant('touch-landscape', 'src/content/status.js', site,
    "ctx.fillStyle = 'rgba(10,10,18,0.7)';\n    ctx.globalAlpha = s.alpha * 0.7;");
  assert.equal(firstDifference(trace('touch-landscape'), reordered), null);
  const recoloured = mutant('touch-landscape', 'src/content/status.js', site,
    "ctx.globalAlpha = s.alpha * 0.7;\n    ctx.fillStyle = 'rgba(10,10,18,0.8)';");
  assert.ok(firstDifference(trace('touch-landscape'), recoloured), 'a changed badge colour is visible');
});

test('the order of the two canvas dimension writes does not matter', () => {
  const swapped = mutant('touch-landscape', 'src/platform.js', '  canvas.width  = rawW;\n  canvas.height = rawH;',
    '  canvas.height = rawH;\n  canvas.width  = rawW;');
  assert.equal(firstDifference(trace('touch-landscape'), swapped), null);
});

test('a one-character change to drawn text changes the draw digest', () => {
  const diff = firstDifference(trace('touch-landscape'),
    mutant('touch-landscape', 'src/game.js', "'FRONTIER MODEL STRESS TEST'", "'FRONTIER MODEL STRESS TEST.'"));
  assert.equal(diff?.label, 'menu');
  assert.deepEqual(diff?.fields, ['draw']);
});

test('a player speed change moves the player somewhere else', () => {
  const diff = firstDifference(trace('touch-landscape'),
    mutant('touch-landscape', 'src/entities.js', 'modSpeed(this.spd+(this.speedBoost||0)', 'modSpeed(this.spd*1.1+(this.speedBoost||0)'));
  assert.equal(diff?.label, 'joystick');
  assert.ok(diff?.fields.includes('pos'), `fields: ${diff?.fields}`);
});

for (const [what, journey, file, from, to] of /** @type {const} */ ([
  ['a dash that never ends', 'run-desktop', 'src/entities.js', 'this.dashTimer-=dt;', ';'],
  ['a longer combo window', 'run-desktop', 'src/content/combo.js', 'const COMBO_WINDOW    = 3;', 'const COMBO_WINDOW    = 4;'],
  ['an unclamped frame time', 'run-desktop', 'src/game.js', 'const dt=Math.min((ts-lastTime)/1000,0.05);', 'const dt=(ts-lastTime)/1000;'],
  ['a title-music unlock that never waits for a gesture', 'touch-landscape', 'src/platform.js',
    'if (_G.state !== _PG_STATES.MENU || _G._menuTitleUnlockConsumed) return false;', 'return false;'],
  ['silent procedural noise', 'run-desktop', 'engine/audio.js', 'nd[i] = Math.random() * 2 - 1;', 'nd[i] = 0 * Math.random();'],
  ['a silent reverb impulse', 'menus-desktop', 'engine/audio.js', 'd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.5);', 'd[i] = 0 * Math.random();'],
  ['a changed console message', 'menus-desktop', 'src/game.js', "console.error('[version] failed to load release version:', err);",
    "console.error('[version] release version unavailable:', err);"],
  ['a quieter title theme', 'menus-desktop', 'src/content/music.js', 'const TITLE_THEME_GAIN = 0.28;', 'const TITLE_THEME_GAIN = 0.01;'],
  ['a changed console.log line', 'menus-desktop', 'src/platform.js', '[NEON DUNGEON]', '[NEON DUNGEON MUTATED]'],
])) {
  test(`the oracle notices ${what}`, () => {
    assert.ok(firstDifference(trace(journey), mutant(journey, file, from, to)), `${journey} did not change`);
  });
}

test('recorded numbers are rounded to a thousandth so float reassociation is invisible', () => {
  assert.equal(fmt(0.1 + 0.2), '0.3');
  assert.equal(fmt(-0.0001), '0');
  assert.equal(fmt(12.34567), '12.346');
  assert.equal(fmt([1 / 3, 'a']), '[0.333,"a"]');
  assert.equal(fmt(NaN), 'NaN');
});

test('firstDifference names the first checkpoint and fields that differ', () => {
  const one = { at: 'one', x: 1, y: 2 };
  const two = { at: 'two', x: 1, y: 2 };
  assert.equal(firstDifference([one, two], [{ ...one }, { ...two }]), null);
  assert.deepEqual(firstDifference([one, two], [one, { at: 'two', x: 9, y: 2 }]), {
    index: 1, label: 'two', fields: ['x'], expected: two, actual: { at: 'two', x: 9, y: 2 },
  });
  assert.deepEqual(firstDifference([one, two], [one])?.fields, ['missing checkpoint']);
});

// ─── The sandbox behaves like a browser where the game could notice ──────────


/** Reads a value out of the game's realm as plain host data. @param {ReturnType<typeof createGameSim>} sim @param {string} expr */
const read = (sim, expr) => JSON.parse(sim.eval(`JSON.stringify(${expr})`));

/** A booted sim on the menu, for probing sandbox semantics. */
function menuSim() {
  const sim = createGameSim({ width: 844, height: 390 });
  sim.frames(2);
  return sim;
}

test('a frame callback can cancel a sibling queued for the same frame', () => {
  const sim = menuSim();
  sim.eval(`(() => {
    window.__log = [];
    let b = 0;
    requestAnimationFrame(() => { __log.push('a'); cancelAnimationFrame(b); });
    b = requestAnimationFrame(() => __log.push('b'));
  })()`);
  sim.frames(1);
  assert.deepEqual(read(sim, '__log'), ['a']);
});

test('promise reactions from one frame callback run before the next callback', () => {
  const sim = menuSim();
  sim.eval(`(() => {
    window.__log = [];
    requestAnimationFrame(() => { __log.push('raf1'); Promise.resolve().then(() => __log.push('micro1')); });
    requestAnimationFrame(() => __log.push('raf2'));
  })()`);
  sim.frames(1);
  assert.deepEqual(read(sim, '__log'), ['raf1', 'micro1', 'raf2']);
});

test('a late interval fires once per turn, at the current time', () => {
  const sim = menuSim();
  sim.eval('window.__at = []; window.__id = setInterval(() => __at.push(performance.now()), 10);');
  const start = sim.eval('performance.now()');
  sim.frames(2);
  sim.eval('clearInterval(__id)');
  assert.deepEqual(read(sim, '__at'), [start + FRAME_MS, start + 2 * FRAME_MS]);
});

test('listeners follow DOM rules for duplicates, once, and removal during dispatch', () => {
  const sim = menuSim();
  sim.eval(`(() => {
    window.__log = [];
    const dup = () => __log.push('dup');
    addEventListener('keydown', dup, { once: true });
    addEventListener('keydown', dup);
    const b = () => __log.push('b');
    addEventListener('keydown', () => { __log.push('a'); removeEventListener('keydown', b); });
    addEventListener('keydown', b);
  })()`);
  sim.down('KeyZ');
  sim.up('KeyZ');
  sim.down('KeyZ');
  sim.up('KeyZ');
  assert.deepEqual(read(sim, '__log'), ['dup', 'a', 'a']);
});

test('a colour stop added after a gradient is assigned still changes the draw digest', () => {
  const sim = menuSim();
  sim.checkpoint('menu');
  /** @param {string} colour */
  const paint = (colour) => {
    sim.eval(`(() => {
      const c = window.__c || (window.__c = document.createElement('canvas').getContext('2d'));
      const g = c.createLinearGradient(0, 0, 10, 0);
      c.fillStyle = g;
      g.addColorStop(0, '${colour}');
      c.fillRect(0, 0, 1, 1);
    })()`);
    return sim.checkpoint(colour).draw;
  };
  const red = paint('red');
  assert.notEqual(paint('blue'), red);
  assert.equal(paint('red'), red);
});

test('a failed diff checkout leaves no temp directory behind', () => {
  const os = require('node:os');
  const fs = require('node:fs');
  const { checkoutRef } = require('./_game-sim.js');
  const before = new Set(fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('nd-golden-')));
  assert.throws(() => checkoutRef('__no_such_ref__'), /Command failed: git/);
  const after = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('nd-golden-') && !before.has(n));
  assert.deepEqual(after, []);
});

test('colour stops paint in offset order and a solid stroke ignores the dash offset', () => {
  const sim = menuSim();
  sim.checkpoint('menu');
  /** @param {string} body */
  const paint = (body) => {
    sim.eval(`(() => { const c = window.__c2 || (window.__c2 = document.createElement('canvas').getContext('2d')); ${body} })()`);
    return sim.checkpoint('paint').draw;
  };
  const inOrder = paint("const g = c.createLinearGradient(0, 0, 10, 0); g.addColorStop(0, 'red'); g.addColorStop(1, 'blue'); c.fillStyle = g; c.fillRect(0, 0, 1, 1);");
  const reversed = paint("const g = c.createLinearGradient(0, 0, 10, 0); g.addColorStop(1, 'blue'); g.addColorStop(0, 'red'); c.fillStyle = g; c.fillRect(0, 0, 1, 1);");
  assert.equal(reversed, inOrder);
  const solid = paint('c.lineDashOffset = 0; c.beginPath(); c.moveTo(0, 0); c.lineTo(5, 5); c.stroke();');
  assert.equal(paint('c.lineDashOffset = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(5, 5); c.stroke();'), solid);
  const dashed = paint('c.setLineDash([2, 2]); c.lineDashOffset = 0; c.beginPath(); c.moveTo(0, 0); c.lineTo(5, 5); c.stroke();');
  assert.notEqual(paint('c.setLineDash([2, 2]); c.lineDashOffset = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(5, 5); c.stroke(); c.setLineDash([]);'), dashed);
});

test('an audio context clock starts at zero and stands still while suspended', () => {
  const sim = createGameSim({ width: 844, height: 390 });
  sim.frames(60);
  sim.eval('window.__ac = new AudioContext();');
  assert.deepEqual(read(sim, '[__ac.state, __ac.currentTime]'), ['suspended', 0]);
  sim.frames(30);
  assert.equal(read(sim, '__ac.currentTime'), 0);
  sim.down('KeyZ');
  sim.up('KeyZ');
  sim.eval('__ac.resume();');
  sim.frames(30);
  const t = read(sim, '__ac.currentTime');
  assert.ok(t > 0.45 && t < 0.55, `ran for half a second: ${t}`);
});

test('a canvas cleared by a size write and then drawn from is not mistaken for the painted one', () => {
  /** Two fresh pages with the same history, so canvases get the same ids. @param {boolean} clear */
  const blit = (clear) => {
    const sim = menuSim();
    sim.checkpoint('menu');
    sim.eval(`(() => {
      const off = document.createElement('canvas'); off.width = 8; off.height = 8;
      const o = off.getContext('2d'); o.fillStyle = 'red'; o.fillRect(0, 0, 8, 8);
      ${clear ? 'off.width = 8;' : ''}
      const c = document.createElement('canvas').getContext('2d');
      c.drawImage(off, 0, 0);
      c.fillStyle = c.createPattern(off, 'repeat');
      c.fillRect(0, 0, 4, 4);
    })()`);
    return sim.checkpoint('blit').draw;
  };
  assert.notEqual(blit(true), blit(false));
});

test('a health-buffered fight gives health back, keeps any level gained, and restores invulnerability', () => {
  const sim = createGameSim({ width: 1280, height: 800 });
  sim.frames(30);
  play.startRun(sim, 'ORACLE-BUFFER');
  const before = read(sim, '({ hp: game.player.hp, maxHp: game.player.maxHp, level: game.player.level, inv: !!game.cheats.invulnerable })');
  play.withHealthBuffer(sim, () => {
    assert.deepEqual(read(sim, '[game.player.hp, game.player.maxHp, !!game.cheats.invulnerable]'), [5000, 5000, false]);
    sim.eval('game.player.hp -= 123;');
  });
  assert.deepEqual(read(sim, '({ hp: game.player.hp, maxHp: game.player.maxHp, level: game.player.level, inv: !!game.cheats.invulnerable })'), before);
  play.withHealthBuffer(sim, () => {
    sim.eval('game.player.gainXP(1000);');
    play.settle(sim);
  });
  const after = read(sim, '({ hp: game.player.hp, maxHp: game.player.maxHp, level: game.player.level, inv: !!game.cheats.invulnerable })');
  assert.ok(after.level > before.level, 'the fight levelled up');
  assert.ok(after.maxHp > before.maxHp && after.maxHp < 5000, `level-up health kept without the buffer: ${after.maxHp}`);
  assert.equal(after.hp, after.maxHp);
  assert.equal(after.inv, before.inv);
});
