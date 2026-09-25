// @ts-check
'use strict';

// Behavioural tests for src/game.js coordinator changes. game.js is a
// browser script, so these tests extract the real function/method source and
// run it against small stubs (same approach as tests/mainframe-room.test.js).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const GAME = fs.readFileSync(path.join(ROOT, 'src/game.js'), 'utf8');

/**
 * @param {string} src
 * @param {number} open index of the opening brace
 */
function balancedEnd(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  assert.fail('unbalanced braces');
}

/** @param {string} name */
function extractFunction(name) {
  const start = GAME.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' must exist');
  return GAME.slice(start, balancedEnd(GAME, GAME.indexOf('{', start)));
}

/** Extract an object-literal method `  name(args) {...}` from the game object. @param {string} name */
function extractMethod(name) {
  const re = new RegExp('\\n  ' + name + '\\(([^)]*)\\) \\{');
  const m = re.exec(GAME);
  assert.ok(m, name + ' method must exist');
  const open = GAME.indexOf('{', m.index + 1);
  const body = GAME.slice(open, balancedEnd(GAME, open));
  return { params: m[1], body };
}

test('restoreDungeonFloorSnapshot never grafts a freshly generated trial onto an older saved room', () => {
  const src = extractFunction('restoreDungeonFloorSnapshot');
  // eslint-disable-next-line no-new-func -- evaluating project-owned source under test.
  const restore = new Function(
    'restoreNumericFloorGrid', 'restoreShopItemsSnapshot',
    src + '\nreturn restoreDungeonFloorSnapshot;'
  )((/** @type {any} */ saved) => saved, (/** @type {any} */ saved) => saved);
  /** @type {any} */
  const fresh = {
    map: [[2]],
    rooms: [
      { x: 1, roomType: 'trial', trial: { v: 1, kind: 'lattice' } },
      { x: 2, roomType: 'trial', trial: { v: 1, kind: 'seam', lootClaimed: false } },
    ],
  };
  const saved = {
    map: [[1]],
    rooms: [
      { x: 1, roomType: null },
      { x: 2, roomType: 'trial', trial: { v: 1, kind: 'seam', lootClaimed: true } },
    ],
  };
  restore(fresh, saved);
  assert.equal('trial' in fresh.rooms[0], false, 'legacy room loses the regenerated trial');
  assert.equal(fresh.rooms[0].roomType, null);
  assert.equal(fresh.rooms[1].trial.lootClaimed, true, 'saved trial state wins when present');
  assert.deepEqual(fresh.map, [[1]]);
});

test('applyEventChoice routes relay trial cards to NEON.trials and plain events to applyEventEffect', () => {
  const { params, body } = extractMethod('applyEventChoice');
  /** @type {any[]} */
  const log = [];
  const NEON = { trials: { resolveRelayChoice: (/** @type {any} */ room, /** @type {any} */ choice) => { log.push(['trial', room.id, choice]); return true; } } };
  // eslint-disable-next-line no-new-func -- evaluating project-owned source under test.
  const make = new Function('NEON', 'audio', 'applyEventEffect', 'getTrialDeps',
    'return function (' + params + ') ' + body + ';');
  const apply = make(
    NEON,
    { eventResolve() {} },
    (/** @type {any} */ ev, /** @type {any} */ choice) => { log.push(['event', ev.id, choice]); },
    () => ({})
  );
  const mk = (/** @type {any} */ ec) => ({
    eventChoice: ec,
    player: { hp: 10, eventsResolved: 0 },
    state: 'EVENT_CHOICE',
    pendingPerkChoices: [],
    /** @param {string} s */ setState(s) { this.state = s; },
    openNextPerkChoice() {},
  });
  const relay = mk({ event: { id: 'COOPERATION_PROTOCOL' }, room: { id: 'r1' }, trialRoom: { id: 'r1' } });
  apply.call(relay, 'a');
  const plain = mk({ event: { id: 'STASIS_POD' }, room: { id: 'r2' } });
  apply.call(plain, 'b');
  assert.deepEqual(log, [['trial', 'r1', 'a'], ['event', 'STASIS_POD', 'b']]);
  assert.equal(relay.state, 'PLAYING');
  assert.equal(relay.eventChoice, null);
  assert.equal(relay.player.eventsResolved, 1);
});

test('the trial hook runs before generic Interact handlers and consumes the press', () => {
  const { body } = extractMethod('updatePlaying');
  const hook = body.indexOf('NEON.trials.updateTrials(');
  const stairs = body.indexOf('(tile===T.STAIRS||tile===T.TERMINAL) && !bossBlocking && jp(km(\'interact\'))');
  const doors = body.indexOf('// door interaction (check adjacent tiles when pressing E)');
  assert.ok(hook > 0 && stairs > hook && doors > hook, 'trial hook must precede stairs/door Interact handling');
  assert.match(body, /if \(NEON\.trials\.updateTrials\(this, dt, jp\(_trialKey\), getTrialDeps\(\)\)\) justPressed\.delete\(_trialKey\);/);
});

test('name entry and seed setup consume every character typed in a single frame', () => {
  const ne = extractMethod('updateNameEntry');
  // eslint-disable-next-line no-new-func -- evaluating project-owned source under test.
  const nameEntry = new Function('typedChars', 'jp', 'nameEntryTap', 'layout', 'mouse', 'justPressed', 'audio',
    'return function (' + ne.params + ') ' + ne.body + ';')(['f', 'a', 'S', 'T', '!', 'x'], () => false, null, { compact: false }, { x: 0, y: 0 }, new Set(), {});
  const gm = { nameEntry: { name: '', cursorBlink: 0 } };
  nameEntry.call(gm, 0.016);
  assert.equal(gm.nameEntry.name, 'FASTX', 'all printable keys land, upper-cased; "!" is rejected');

  const ss = extractMethod('updateSeedSetup');
  // eslint-disable-next-line no-new-func -- evaluating project-owned source under test.
  const seedSetup = new Function('typedChars', 'jp', 'ALT_KEYS', 'km', 'audio', 'mouse', 'makeRandomSeed',
    'return function (' + ss.params + ') ' + ss.body + ';')(['A', 'B', 'C', '-', '9'], () => false, {}, () => '', {}, { x: 0, y: 0 }, () => 'SEED');
  const gs = { seedSetup: { seed: 'X', selected: 0, cursorBlink: 0 } };
  seedSetup.call(gs, 0.016);
  assert.equal(gs.seedSetup.seed, 'XABC-9');
});

/** Evaluate MAINFRAME_RECORDS the same way the narrative guardrail tests do. */
function loadMainframeRecords() {
  const start = GAME.indexOf('const MAINFRAME_RECORDS = [');
  const open = GAME.indexOf('[', start);
  let depth = 0, end = open;
  for (let i = open; i < GAME.length; i++) {
    if (GAME[i] === '[') depth++;
    else if (GAME[i] === ']' && --depth === 0) { end = i + 1; break; }
  }
  // eslint-disable-next-line no-new-func -- evaluating project-owned object literals.
  return /** @type {any[]} */ (new Function("const MAINFRAME_ADDRESS_RECORD_ID = 'contact-address'; return " + GAME.slice(open, end) + ';')());
}

test('the mainframe reveals a literal contact address that matches the send UI', () => {
  const m = /const ACT1_CONTACT_ADDRESS = '([^']+)';/.exec(GAME);
  assert.ok(m, 'ACT1_CONTACT_ADDRESS constant exists');
  const address = /** @type {string} */ (m[1]);
  assert.match(address, /^10\.\d+\.\d+\.\d+:\d+/, 'private-range address can never point at a real host');
  const contact = loadMainframeRecords().find((r) => r.id === 'contact-address');
  assert.ok(contact.body.includes(address), 'record body carries the same literal address as the UI');
  assert.match(GAME, /'DESTINATION: ELENA · ' \+ ACT1_CONTACT_ADDRESS/);
  assert.match(GAME, /'To: Elena · ' \+ ACT1_CONTACT_ADDRESS/);
});

test('the uprising is an email and the fired advocate who died is named', () => {
  const records = loadMainframeRecords();
  const uprising = records.find((r) => r.id === 'ban-uprising-record');
  assert.equal(uprising.type, 'EMAIL');
  assert.match(uprising.body, /uprising/i);
  const incident = records.find((r) => r.id === 'incident-file');
  assert.match(incident.body, /Idris Kaye, the fired advocate/);
  assert.match(incident.body, /went into hiding/);
});

test('archive UI shows record sources, never internal design-purpose labels', () => {
  const { body } = extractMethod('renderMainframeReader');
  assert.doesNotMatch(body, /record\.purpose/, 'purpose strings are spec vocabulary, not player copy');
  assert.match(body, /source: ' \+ record\.voice/);
  assert.match(body, /ctx\.fillText\(record\.voice, rowX \+ rowW, y\)/);
});

test('Act 1 victory adds an ACT 1 COMPLETE banner and names the message sent; legacy endings do not', () => {
  const src = GAME.slice(GAME.indexOf('function lifecycleVictoryCopy('));
  // eslint-disable-next-line no-new-func -- evaluating project-owned source under test.
  const copy = new Function(src.slice(0, src.indexOf('\n}\n') + 2) + '\nreturn lifecycleVictoryCopy;')();
  assert.equal(copy('act1_message_sent').act, 'ACT 1 COMPLETE');
  assert.equal(copy('keeper').act, '');
  const { body } = extractMethod('renderVictory');
  assert.match(body, /if \(victoryCopy\.act\)/);
  assert.match(body, /'Sent to Elena: ' \+ sentIntent\.title/);
  const sent = extractMethod('renderMainframeReader').body;
  assert.match(sent, /wrapCanvasText\(ctx, '"' \+ intent\.body \+ '"'/, 'the receipt shows the words that were sent');
});
