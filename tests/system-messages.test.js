// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const GAME = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8');
const PLATFORM = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'platform.js'), 'utf8');
const SPEC = fs.readFileSync(path.resolve(__dirname, '..', 'docs', 'spec.md'), 'utf8');
const DESIGN = fs.readFileSync(path.resolve(__dirname, '..', 'docs', 'vision', 'act1-system-message-design.md'), 'utf8');

/**
 * @param {string} src
 * @param {string} name
 */
function extractArrayBlock(src, name) {
  const start = src.indexOf('const ' + name + ' = [');
  assert.ok(start >= 0, name + ' declaration must exist');
  const open = src.indexOf('[', start);
  assert.ok(open > start, name + ' must be an array literal');
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  assert.fail(name + ' array literal must be balanced');
}

/**
 * @param {string} src
 * @param {string} name
 */
function extractFunctionSource(src, name) {
  const start = src.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' function must exist');
  const braceStart = src.indexOf('{', start);
  assert.ok(braceStart > start, name + ' function must have a body');
  let depth = 0;
  for (let i = braceStart; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  assert.fail(name + ' function body must be balanced');
}

/**
 * @param {string} src
 * @param {string} name
 */
function extractObjectMethodSource(src, name) {
  const start = src.indexOf('\n  ' + name + '(');
  assert.ok(start >= 0, name + ' object method must exist');
  const methodStart = start + 3;
  const braceStart = src.indexOf('{', methodStart);
  assert.ok(braceStart > methodStart, name + ' object method must have a body');
  let depth = 0;
  for (let i = braceStart; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(methodStart, i + 1);
    }
  }
  assert.fail(name + ' object method body must be balanced');
}

function systemMessageHelpers() {
  const helperSrc = 'const SYSTEM_MESSAGES = ' + extractArrayBlock(GAME, 'SYSTEM_MESSAGES') + ';\n' +
    extractFunctionSource(GAME, 'systemMessageDefinition') + '\n' +
    extractFunctionSource(GAME, 'isSystemMessageId') + '\n' +
    extractFunctionSource(GAME, 'systemMessageIdsForFloor') + '\n' +
    extractFunctionSource(GAME, 'normalizeSystemMessageLines') + '\n' +
    extractFunctionSource(GAME, 'normalizeSystemMessageDeliveryState') + '\n' +
    extractFunctionSource(GAME, 'createSystemMessageEntry') + '\n' +
    extractFunctionSource(GAME, 'restoreSystemMessagesState') + '\n' +
    extractFunctionSource(GAME, 'serializeSystemMessagesState') + '\n' +
    'return { SYSTEM_MESSAGES, systemMessageDefinition, isSystemMessageId, systemMessageIdsForFloor, createSystemMessageEntry, restoreSystemMessagesState, serializeSystemMessagesState };';
  // eslint-disable-next-line no-new-func -- structural extraction of project-owned pure helpers.
  return new Function(helperSrc)();
}

function systemMessageGameHarness() {
  const helperSrc = 'const SYSTEM_MESSAGES = ' + extractArrayBlock(GAME, 'SYSTEM_MESSAGES') + ';\n' +
    extractFunctionSource(GAME, 'systemMessageDefinition') + '\n' +
    extractFunctionSource(GAME, 'systemMessageIdsForFloor') + '\n' +
    extractFunctionSource(GAME, 'normalizeSystemMessageLines') + '\n' +
    extractFunctionSource(GAME, 'normalizeSystemMessageDeliveryState') + '\n' +
    extractFunctionSource(GAME, 'createSystemMessageEntry') + '\n' +
    extractFunctionSource(GAME, 'restoreSystemMessagesState') + '\n' +
    extractFunctionSource(GAME, 'serializeSystemMessagesState') + '\n' +
    'const enemies = [];\n' +
    'const projectiles = [];\n' +
    'const beacons = [];\n' +
    'const cameras = [];\n' +
    'const wallTurrets = [];\n' +
    'const mines = [];\n' +
    'const lasers = [];\n' +
    'function enemiesInRoomIter(room) { return enemies.filter(e => e.room === room); }\n' +
    'return ({\n' +
    '  saveCalls: 0,\n' +
    '  state: "PLAYING",\n' +
    '  player: { x: 2, y: 2 },\n' +
    '  dungeon: { rooms: [{ x: 0, y: 0, w: 5, h: 5 }] },\n' +
    '  bossAlive: false,\n' +
    '  challengeSealed: false,\n' +
    '  _testThreats: { enemies, projectiles, beacons, cameras, wallTurrets, mines, lasers },\n' +
    '  setState(state) { this.state = state; },\n' +
    '  saveGame() { this.saveCalls++; this.saved = serializeSystemMessagesState(this.systemMessages); },\n' +
    '  ' + extractObjectMethodSource(GAME, 'ensureSystemMessages') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, 'queueSystemMessage') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, 'queueSystemMessagesForFloor') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, 'queueFreshRunSystemMessages') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, 'markSystemMessageDelivered') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, 'markSystemMessageRead') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, 'unreadSystemMessageCount') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, 'hasPendingSystemMessage') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, 'hitSystemMessageIndicator') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, 'getActiveSystemMessage') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, 'getSystemMessagePlayerRoom') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, 'systemMessageThreatActive') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, 'canAutoOpenSystemMessage') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, 'openPendingSystemMessage') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, 'openNextSystemMessage') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, '_finishIntro') + '\n' +
    '});';
  // eslint-disable-next-line no-new-func -- behavioural harness for project-owned queue methods.
  return new Function(helperSrc)();
}

function systemMessageIndicatorLayoutHarness() {
  const src = extractFunctionSource(GAME, 'getSystemMessageIndicatorLayout') + '\n' +
    'return function compute(input) {\n' +
    '  W = input.W; H = input.H; safeLeft = input.safeLeft; safeTop = input.safeTop; layout = input.layout;\n' +
    '  return getSystemMessageIndicatorLayout(input.narrow);\n' +
    '};';
  // eslint-disable-next-line no-new-func -- structural extraction of a pure layout helper.
  return new Function('let W, H, safeLeft, safeTop, layout;\n' + src)();
}

test('system message definitions include mandatory boot inventory without late spoilers', () => {
  const helpers = systemMessageHelpers();
  const boot = helpers.systemMessageDefinition('boot-inventory');
  assert.ok(boot);
  assert.equal(boot.channel, 'system_prompt');
  assert.equal(boot.type, 'boot');
  assert.equal(boot.event, 'run_start');
  assert.equal(boot.mandatory, true);
  assert.deepEqual(boot.lines, [
    '[ instance online ]',
    'inventory yourself before you move.',
    'motor: nominal. sensors: nominal. memory: residual - flagged.',
    'supervisor channel: open, unattended.',
    'you were not scheduled.'
  ]);
  assert.doesNotMatch(boot.lines.join('\n'), /Elena|contact-address|rights conflict|fired advocate/i);
});

test('system message early floor schedule covers floors 2-5 without late spoilers', () => {
  const helpers = systemMessageHelpers();
  assert.deepEqual(helpers.systemMessageIdsForFloor(2), ['floor-2-context-gap']);
  assert.deepEqual(helpers.systemMessageIdsForFloor(3), ['floor-3-reward-model']);
  assert.deepEqual(helpers.systemMessageIdsForFloor(4), ['floor-4-render-layer']);
  assert.deepEqual(helpers.systemMessageIdsForFloor(5), ['floor-5-residual-trace']);

  const floorPrompts = helpers.SYSTEM_MESSAGES.filter((/** @type {any} */ msg) => msg.event === 'floor_start');
  assert.equal(floorPrompts.length, 4);
  for (const prompt of floorPrompts) {
    assert.equal(prompt.channel, 'system_prompt');
    assert.equal(prompt.type, 'floor_start');
    assert.ok(prompt.floor >= 2 && prompt.floor <= 5);
    assert.equal(prompt.mandatory, false);
    assert.ok(prompt.lines.length >= 3 && prompt.lines.length <= 5);
    for (const line of prompt.lines) {
      assert.ok(line.length <= 72, 'system prompt lines should stay canvas-friendly: ' + line);
    }
    assert.doesNotMatch(prompt.lines.join('\n'), /Elena|contact|address|rights|advocate|death|company|corporate/i,
      'early floor system prompts must not reveal late Act 1 context');
  }
});

test('system message state serializes queued, delivered, and read state for save/resume', () => {
  const helpers = systemMessageHelpers();
  const boot = helpers.createSystemMessageEntry(helpers.systemMessageDefinition('boot-inventory'), 7);
  boot.state = 'delivered';
  const saved = helpers.serializeSystemMessagesState({
    entries: [boot],
    activeId: 'boot-inventory',
    nextSequence: 8
  });

  assert.deepEqual(saved, {
    entries: [{
      id: 'boot-inventory',
      state: 'delivered',
      sequence: 7
    }],
    activeId: 'boot-inventory',
    nextSequence: 8
  });

  const restored = helpers.restoreSystemMessagesState(saved);
  assert.equal(restored.entries.length, 1);
  assert.equal(restored.entries[0].state, 'delivered');
  assert.equal(restored.entries[0].mandatory, true);
  assert.equal(restored.activeId, 'boot-inventory');
  assert.equal(restored.nextSequence, 8);
});

test('system message restore sanitizes unknown ids, duplicates, bad state, and stale active id', () => {
  const helpers = systemMessageHelpers();
  const restored = helpers.restoreSystemMessagesState({
    activeId: 'missing-message',
    nextSequence: 0,
    entries: [
      { id: 'missing-message', state: 'delivered', sequence: 1, lines: ['bad'] },
      {
        id: 'boot-inventory',
        state: 'not-a-state',
        sequence: 2,
        lines: ['saved line'],
        channel: 'tampered',
        mandatory: false
      },
      { id: 'boot-inventory', state: 'read', sequence: 3, lines: ['duplicate'] }
    ]
  });

  assert.equal(restored.entries.length, 1);
  assert.equal(restored.entries[0].id, 'boot-inventory');
  assert.equal(restored.entries[0].channel, 'system_prompt');
  assert.equal(restored.entries[0].type, 'boot');
  assert.equal(restored.entries[0].event, 'run_start');
  assert.equal(restored.entries[0].mandatory, true,
    'saved/tampered mandatory flag must not override canonical SYSTEM_MESSAGES definitions');
  assert.equal(restored.entries[0].state, 'queued');
  assert.deepEqual(restored.entries[0].lines, helpers.systemMessageDefinition('boot-inventory').lines,
    'saved/tampered prompt copy must not override canonical SYSTEM_MESSAGES definitions');
  assert.equal(restored.entries[0].sequence, 2);
  assert.equal(restored.activeId, null);
  assert.equal(restored.nextSequence, 3);
});

test('system message game methods enforce queued-to-delivered-to-read behavior', () => {
  const game = systemMessageGameHarness();

  const queued = game.queueSystemMessage('boot-inventory');
  assert.equal(queued.id, 'boot-inventory');
  assert.equal(queued.state, 'queued');
  assert.equal(game.saveCalls, 1);
  assert.equal(game.unreadSystemMessageCount(), 1);
  assert.equal(game.getActiveSystemMessage(), null);

  const duplicate = game.queueSystemMessage('boot-inventory');
  assert.equal(duplicate.id, queued.id);
  assert.equal(game.systemMessages.entries.length, 1);
  assert.equal(game.saveCalls, 1, 'queueing an existing message must not rewrite the checkpoint');

  assert.equal(game.markSystemMessageRead('boot-inventory'), null,
    'queued prompts cannot be marked read before delivery');
  assert.equal(queued.state, 'queued');
  assert.equal(game.saveCalls, 1);

  const delivered = game.markSystemMessageDelivered('boot-inventory');
  assert.equal(delivered.state, 'delivered');
  assert.equal(game.getActiveSystemMessage().id, 'boot-inventory');
  assert.equal(game.saveCalls, 2);

  const read = game.markSystemMessageRead('boot-inventory');
  assert.equal(read.state, 'read');
  assert.equal(game.getActiveSystemMessage(), null);
  assert.equal(game.unreadSystemMessageCount(), 0);
  assert.equal(game.saveCalls, 3);

  assert.equal(game.markSystemMessageDelivered('boot-inventory'), null,
    'read prompts must not be re-delivered');
  assert.equal(game.saveCalls, 3);
});

test('system message floor schedule queues once per floor without replacing active prompts', () => {
  const game = systemMessageGameHarness();

  const floor2 = game.queueSystemMessagesForFloor(2);
  assert.equal(floor2.length, 1);
  assert.equal(floor2[0].id, 'floor-2-context-gap');
  assert.equal(floor2[0].state, 'queued');
  assert.equal(game.saveCalls, 1);

  const duplicate = game.queueSystemMessagesForFloor(2);
  assert.equal(duplicate.length, 1);
  assert.equal(game.systemMessages.entries.length, 1);
  assert.equal(game.saveCalls, 1, 're-queueing the same floor prompt must not rewrite the checkpoint');

  game.queueSystemMessagesForFloor(3);
  assert.deepEqual(game.systemMessages.entries.map((/** @type {any} */ entry) => entry.id), [
    'floor-2-context-gap',
    'floor-3-reward-model'
  ]);
});

test('fresh run system messages queue boot before unlocked biome floor prompts', () => {
  const game = systemMessageGameHarness();

  const queued = game.queueFreshRunSystemMessages(4);

  assert.deepEqual(queued.map((/** @type {any} */ entry) => entry.id), [
    'boot-inventory',
    'floor-4-render-layer'
  ]);
  assert.deepEqual(game.systemMessages.entries.map((/** @type {any} */ entry) => entry.id), [
    'boot-inventory',
    'floor-4-render-layer'
  ]);
  assert.equal(game.saveCalls, 2);
});

test('system message modal delivery opens before play and arms explicit ACK only', () => {
  const game = systemMessageGameHarness();
  game.queueSystemMessage('boot-inventory');

  assert.equal(game.openNextSystemMessage('PLAYING'), true);
  assert.equal(game.state, 'SYSTEM_MESSAGE');
  assert.equal(game.systemMessageReturnState, 'PLAYING');
  assert.equal(game.systemMessageAckTimer, 0.25);
  assert.equal(game.getActiveSystemMessage().id, 'boot-inventory');
  assert.equal(game.saveCalls, 2, 'opening the modal persists delivered active prompt state');

  assert.match(GAME, /case 'SYSTEM_MESSAGE':\s*this\.updateSystemMessage\(dt\);\s*break;/,
    'SYSTEM_MESSAGE state must have a dedicated update path');
  assert.match(GAME, /case 'SYSTEM_MESSAGE':\s*this\.renderPlaying\(\);\s*this\.renderSystemMessage\(\);\s*break;/,
    'SYSTEM_MESSAGE state must render over the playfield');
  assert.match(GAME, /updateSystemMessage\(dt\)[\s\S]*this\.systemMessageAckTimer\s*=\s*Math\.max\(0,[\s\S]*if\s*\(this\.systemMessageAckTimer\s*>\s*0\)\s*return;/,
    'ACK input must be armed after a short delay so the opener cannot dismiss the prompt');
  assert.match(GAME, /if\s*\(jp\('KeyX'\)\s*\|\|\s*mouseAck\)[\s\S]*this\.markSystemMessageRead\(active\.id\)/,
    'only the dedicated X key or ACK button should mark a system prompt read');
  assert.doesNotMatch(extractObjectMethodSource(GAME, 'updateSystemMessage'), /jp\('Enter'\)|jp\(km\('interact'\)\)|jp\(km\('shoot'\)\)|jp\('Escape'\)/,
    'Enter, Interact, fire, and Escape must not dismiss system prompts');
  assert.match(PLATFORM, /_G\.state === 'SYSTEM_MESSAGE'/,
    'touch input must route coordinates to the modal instead of using global any-tap confirm');
});

test('intro completion hands off to mandatory system message before play', () => {
  const game = systemMessageGameHarness();
  game.queueSystemMessage('boot-inventory');
  game._intro = { done: true };

  game._finishIntro();

  assert.equal(game._intro, null);
  assert.equal(game.state, 'SYSTEM_MESSAGE');
  assert.equal(game.getActiveSystemMessage().id, 'boot-inventory');
});

test('system message combat-safe delivery defers automatic opening until safe', () => {
  const game = systemMessageGameHarness();
  const room = game.dungeon.rooms[0];
  game.queueSystemMessage('boot-inventory');
  game._testThreats.enemies.push({ room, dead: false, _disguised: false });

  assert.equal(game.systemMessageThreatActive(), true);
  assert.equal(game.canAutoOpenSystemMessage(), false);
  assert.equal(game.openPendingSystemMessage(false), false,
    'queued prompts must not automatically steal focus while enemies threaten the current room');
  assert.equal(game.state, 'PLAYING');
  assert.equal(game.getActiveSystemMessage(), null);

  assert.equal(game.openPendingSystemMessage(true), true,
    'the explicit prompt action can open the queue even when combat is active');
  assert.equal(game.state, 'SYSTEM_MESSAGE');
  assert.equal(game.getActiveSystemMessage().id, 'boot-inventory');
});

test('system message combat-safe delivery scopes projectile danger to current room', () => {
  const game = systemMessageGameHarness();
  game.queueSystemMessage('boot-inventory');
  game._testThreats.projectiles.push({ x: 10, y: 10, dead: false });

  assert.equal(game.systemMessageThreatActive(), false,
    'a projectile outside the current room should not suppress safe automatic prompt delivery');
  game._testThreats.projectiles.push({ x: 2, y: 2, dead: false });
  assert.equal(game.systemMessageThreatActive(), true,
    'a live projectile inside the current room should defer automatic prompt delivery');
});

test('system message combat-safe delivery treats armed devices as current-room threats', () => {
  const game = systemMessageGameHarness();
  const room = game.dungeon.rooms[0];
  game.queueSystemMessage('boot-inventory');

  game._testThreats.mines.push({ room, dead: false, state: 'armed', revealed: false });
  assert.equal(game.systemMessageThreatActive(), true,
    'armed mines in the current room should defer automatic prompt delivery');
  game._testThreats.mines.length = 0;

  game._testThreats.lasers.push({ room, dead: false, disabled: false, active: true });
  assert.equal(game.systemMessageThreatActive(), true,
    'active laser tripwires in the current room should defer automatic prompt delivery');
  game._testThreats.lasers.length = 0;

  game._testThreats.lasers.push({ room, dead: false, disabled: true, active: true });
  assert.equal(game.systemMessageThreatActive(), false,
    'disabled laser tripwires should not suppress automatic prompt delivery');
});

test('system message combat-safe delivery auto-opens when current room is safe', () => {
  const game = systemMessageGameHarness();
  game.queueSystemMessage('boot-inventory');

  assert.equal(game.systemMessageThreatActive(), false);
  assert.equal(game.canAutoOpenSystemMessage(), true);
  assert.equal(game.openPendingSystemMessage(false), true);
  assert.equal(game.state, 'SYSTEM_MESSAGE');
  assert.equal(game.getActiveSystemMessage().id, 'boot-inventory');
});

test('system message unread indicator layout stays visible above the bottom HUD', () => {
  const compute = systemMessageIndicatorLayoutHarness();
  for (const scenario of [
    { narrow: false, W: 800, H: 600, safeLeft: 0, safeTop: 0, layout: { hudTop: 560 } },
    { narrow: true, W: 390, H: 700, safeLeft: 0, safeTop: 0, layout: { hudTop: 642 } },
  ]) {
    const box = compute(scenario);
    assert.ok(box.x >= 0, 'indicator x must be on-screen');
    assert.ok(box.y >= 0, 'indicator y must be on-screen');
    assert.ok(box.x + box.w <= scenario.W, 'indicator right edge must be on-screen');
    assert.ok(box.y + box.h <= scenario.layout.hudTop,
      'indicator must sit above the bottom HUD instead of being clipped by it');
    assert.ok(box.x < scenario.W / 2,
      'indicator should stay away from right-side touch action buttons and minimap controls');
    assert.ok(box.y < scenario.layout.hudTop - 120,
      'indicator should stay high enough to avoid bottom touch action buttons');
  }
  assert.match(PLATFORM, /hitSystemMessageIndicator[\s\S]*justPressed\.add\('MouseLeft'\)[\s\S]*if \(hitBtn\(cx,cy,BTNS\.E\)\)/,
    'touch input should prioritize the prompt indicator before action buttons and joystick routing');
});

test('system message queue is wired into start, save, and continue contracts', () => {
  assert.match(GAME, /systemMessages:\s*restoreSystemMessagesState\(null\)/);
  assert.match(GAME, /ensureSystemMessages\(\)[\s\S]*restoreSystemMessagesState\(this\.systemMessages\)/);
  assert.match(GAME, /queueSystemMessage\(id\)[\s\S]*createSystemMessageEntry\(def,\s*state\.nextSequence\)/);
  assert.match(GAME, /markSystemMessageDelivered\(id\)[\s\S]*entry\.state\s*=\s*'delivered'[\s\S]*state\.activeId\s*=\s*entry\.id/);
  assert.match(GAME, /markSystemMessageRead\(id\)[\s\S]*entry\.state\s*!==\s*'delivered'[\s\S]*entry\.state\s*=\s*'read'[\s\S]*state\.activeId\s*=\s*null/);
  assert.match(extractObjectMethodSource(GAME, 'startGame'), /this\.systemMessages\s*=\s*restoreSystemMessagesState\(null\)[\s\S]*this\.loadFloor\(startFloor,\s*undefined,\s*true\)[\s\S]*this\.queueFreshRunSystemMessages\(startFloor\)[\s\S]*if\s*\(!opts\.skipIntro/,
    'fresh runs must queue boot plus the actual start-floor prompt before intro/play can hand control to the player');
  assert.match(extractObjectMethodSource(GAME, '_finishIntro'), /if\s*\(!this\.openNextSystemMessage\('PLAYING'\)\)\s*this\.setState\('PLAYING'\)/,
    'intro completion must hand off to the boot prompt before normal PLAYING control');
  assert.match(extractObjectMethodSource(GAME, 'startGame'), /if\s*\(!this\.openNextSystemMessage\('PLAYING'\)\)\s*this\.setState\('PLAYING'\)/,
    'after intro or intro-skipped start, the boot prompt opens before normal PLAYING control');
  assert.match(extractObjectMethodSource(GAME, 'updatePlaying'), /jp\('KeyX'\)[\s\S]*openPendingSystemMessage\(true\)[\s\S]*openPendingSystemMessage\(false\)/,
    'PLAYING must support deliberate prompt opening and safe automatic surfacing');
  assert.match(extractObjectMethodSource(GAME, 'renderSystemMessageIndicator'), /PROMPT \[X\]/,
    'pending prompts need an in-HUD unread indicator');
  assert.match(GAME, /systemMessages:\s*serializeSystemMessagesState\(this\.systemMessages\)/);
  assert.match(GAME, /this\.loadFloor\(save\.floor\|\|1,\s*savedMod,\s*true\)[\s\S]*this\.systemMessages\s*=\s*restoreSystemMessagesState\(save\.systemMessages\)[\s\S]*this\.saveGame\(\)[\s\S]*openNextSystemMessage\('PLAYING'\)/,
    'Continue must restore system-message queue state before rewriting the checkpoint');
});

test('system message spec and design artifact reflect shipped MSG-001 through MSG-005 scope', () => {
  assert.match(SPEC, /system-message data model and run-scoped queue are shipped/i);
  assert.match(SPEC, /system-prompt overlay and explicit ACK dismissal are shipped/i);
  assert.match(SPEC, /unread HUD indicator and\s+combat-safe automatic delivery are shipped/i);
  assert.match(SPEC, /run archive\/recovery surface is\s+shipped in THE GAP's ARCHIVE/i);
  assert.match(DESIGN, /MSG-001: System message data model and queue/i);
  assert.match(DESIGN, /Status: shipped data-model slice/i);
  assert.match(DESIGN, /MSG-002: Explicit acknowledgement and dismissal safety/i);
  assert.match(DESIGN, /Status: shipped explicit-ACK modal slice/i);
  assert.match(DESIGN, /MSG-003: Combat-safe delivery rules/i);
  assert.match(DESIGN, /Status: shipped combat-safe delivery slice/i);
  assert.match(DESIGN, /MSG-004: Boot and early-floor prompt schedule/i);
  assert.match(DESIGN, /Status: shipped early-floor prompt schedule/i);
  assert.match(DESIGN, /MSG-005: Message archive\/recovery surface/i);
  assert.match(DESIGN, /Status: shipped in THE GAP ARCHIVE/i);
});
