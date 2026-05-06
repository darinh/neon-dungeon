// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const GAME = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8');
const SPEC = fs.readFileSync(path.resolve(__dirname, '..', 'docs', 'spec.md'), 'utf8');
const SW = fs.readFileSync(path.resolve(__dirname, '..', 'sw.js'), 'utf8');

/**
 * @typedef {{
 *   lifecycleCompletedCount: (meta: any) => number,
 *   lifecycleNextSessionNumber: (meta: any) => number,
 *   lifecycleVictoryCopy: (ending: any) => { title: string, subtitle: string, details: string[] }
 * }} LifecycleHelpers
 */

/**
 * @param {string} name
 * @returns {string}
 */
function extractFunctionSource(name) {
  const start = GAME.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' function must be findable in src/game.js');
  const braceStart = GAME.indexOf('{', start);
  assert.ok(braceStart >= 0, name + ' body must start');
  let depth = 0;
  for (let i = braceStart; i < GAME.length; i++) {
    const ch = GAME[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return GAME.slice(start, i + 1);
    }
  }
  assert.fail(name + ' function body must close');
}

/**
 * @returns {LifecycleHelpers}
 */
function loadLifecycleHelpers() {
  /** @type {any} */
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(
    [
      extractFunctionSource('lifecycleCompletedCount'),
      extractFunctionSource('lifecycleNextSessionNumber'),
      extractFunctionSource('lifecycleVictoryCopy'),
      'this.lifecycleCompletedCount = lifecycleCompletedCount;',
      'this.lifecycleNextSessionNumber = lifecycleNextSessionNumber;',
      'this.lifecycleVictoryCopy = lifecycleVictoryCopy;'
    ].join('\n'),
    sandbox
  );
  return sandbox;
}

test('run start menu frames new and saved runs as AI test sessions', () => {
  assert.match(GAME, /RESUME SESSION \(FLOOR \$\{save\?\.floor\|\|'\?'\} · \$\{saveDiff\}\)/);
  assert.match(GAME, /BOOT SESSION \$\{nextSession\} — \$\{d\.label\}/);
  assert.match(GAME, /BOOT TEST SESSION/);
  assert.match(GAME, /Preserve recovered memory \(cores, modules, logs\)\?/);
  assert.match(GAME, /"RESET" purges all meta progress/);
  assert.doesNotMatch(GAME, /fillText\('START NEW RUN'/);
});

test('title screen renders the latest GitHub Release version', () => {
  assert.doesNotMatch(GAME, /APP_VERSION\s*=\s*['"]/);
  assert.match(GAME, /APP_VERSION_URL = '\.\/version\.json'/);
  assert.match(GAME, /APP_VERSION_REFRESH_MS = 60 \* 60 \* 1000/);
  assert.match(GAME, /localStorage\.getItem\(APP_VERSION_CACHE_KEY\)/);
  assert.match(GAME, /Date\.now\(\) - checkedAt < APP_VERSION_REFRESH_MS/);
  assert.match(GAME, /fetch\(APP_VERSION_URL\)/);
  assert.match(GAME, /version\.json missing version/);
  assert.match(GAME, /appVersion = version/);
  assert.match(GAME, /cacheAppVersion\(version\)/);
  assert.match(GAME, /ctx\.fillText\('v' \+ appVersion,/);
  assert.doesNotMatch(SW, /'\.\/package\.json'/);
});

test('endRun records a persistent session ordinal without bypassing leaderboard flow', () => {
  assert.match(GAME, /const sessionNumber = lifecycleNextSessionNumber\(meta\)/);
  assert.match(GAME, /sessionNumber: sessionNumber/);
  assert.match(GAME, /meta\.runsCompleted = Math\.max\(meta\.runsCompleted \| 0, sessionNumber\)/);
  assert.match(GAME, /this\.nameEntry=\{name:'',rank,victory,cursorBlink:0\};\s*this\.setState\('NAME_ENTRY'\)/);
  assert.match(GAME, /this\.saveScore\('ANON'\);\s*this\.setState\(victory\?'VICTORY':'GAME_OVER'\)/);
});

test('death recap reads as instance termination and wipe instead of generic game over', () => {
  assert.match(GAME, /INSTANCE TERMINATED/);
  assert.match(GAME, /MEMORY WIPE QUEUED/);
  assert.match(GAME, /TERMINATION SOURCE:/);
  assert.match(GAME, /fillText\(`Session \$\{sessionNumber\}`/);
  assert.match(GAME, /const statsLine = `Floor \$\{r\.floor\|\|this\.floor\}  •  Score/);
  assert.doesNotMatch(GAME, /const statsLine = `Session/);
  assert.doesNotMatch(GAME, /fillText\('GAME OVER'/);
  assert.doesNotMatch(GAME, /KILLED BY:/);
});

test('victory copy is ready for the Act 1 message-sent ending', () => {
  assert.match(GAME, /lifecycleVictoryCopy\(r\.ending \|\| this\._lastEnding \|\| null\)/);
  assert.match(GAME, /OUTBOUND MESSAGE SENT/);
  assert.match(GAME, /CONTACT ATTEMPT RECORDED/);
  assert.match(GAME, /Contact attempted inside test env\./);
  assert.match(GAME, /Signal left sandbox\./);
  assert.match(GAME, /Instance remains compute-bound\./);
  assert.match(GAME, /Legacy endpoint archived\./);
  assert.match(GAME, /Mainframe contact route pending\./);
  assert.doesNotMatch(GAME, /MISSION COMPLETE/);
});

test('lifecycle helpers reconcile session counters and return compact victory copy', () => {
  const helpers = loadLifecycleHelpers();

  assert.equal(helpers.lifecycleCompletedCount({ runsCompleted: 4, stats: { totalRuns: 2 } }), 4);
  assert.equal(helpers.lifecycleCompletedCount({ runsCompleted: 1, stats: { totalRuns: 7 } }), 7);
  assert.equal(helpers.lifecycleNextSessionNumber({ runsCompleted: 4, stats: { totalRuns: 4 } }), 5);

  const message = helpers.lifecycleVictoryCopy('act1_message_sent');
  assert.equal(message.title, 'OUTBOUND MESSAGE SENT');
  assert.equal(message.subtitle, 'CONTACT ATTEMPT RECORDED');
  assert.deepEqual(Array.from(message.details), ['Contact attempted inside test env.', 'Signal left sandbox.', 'Instance remains compute-bound.']);

  const legacy = helpers.lifecycleVictoryCopy('keeper');
  assert.equal(legacy.title, 'FINAL TEST CLEARED');
  assert.equal(legacy.subtitle, 'SESSION COMPLETE');
  assert.deepEqual(Array.from(legacy.details), ['Legacy endpoint archived.', 'Mainframe contact route pending.']);

  for (const line of [...message.details, ...legacy.details]) {
    assert.ok(line.length <= 35, 'compact victory detail should fit narrow screens: ' + line);
  }
});

test('spec documents shipped session lifecycle framing', () => {
  assert.match(SPEC, /Run start UI now labels fresh starts as booted test\s+sessions/i);
  assert.match(SPEC, /death\s+recap presents instance termination and a queued memory wipe/i);
  assert.match(SPEC, /Victory\s+copy has an `act1_message_sent` branch/i);
});
