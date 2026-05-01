// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const GAME = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8');
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
    extractFunctionSource(GAME, 'normalizeSystemMessageLines') + '\n' +
    extractFunctionSource(GAME, 'normalizeSystemMessageDeliveryState') + '\n' +
    extractFunctionSource(GAME, 'createSystemMessageEntry') + '\n' +
    extractFunctionSource(GAME, 'restoreSystemMessagesState') + '\n' +
    extractFunctionSource(GAME, 'serializeSystemMessagesState') + '\n' +
    'return { SYSTEM_MESSAGES, systemMessageDefinition, isSystemMessageId, createSystemMessageEntry, restoreSystemMessagesState, serializeSystemMessagesState };';
  // eslint-disable-next-line no-new-func -- structural extraction of project-owned pure helpers.
  return new Function(helperSrc)();
}

function systemMessageGameHarness() {
  const helperSrc = 'const SYSTEM_MESSAGES = ' + extractArrayBlock(GAME, 'SYSTEM_MESSAGES') + ';\n' +
    extractFunctionSource(GAME, 'systemMessageDefinition') + '\n' +
    extractFunctionSource(GAME, 'normalizeSystemMessageLines') + '\n' +
    extractFunctionSource(GAME, 'normalizeSystemMessageDeliveryState') + '\n' +
    extractFunctionSource(GAME, 'createSystemMessageEntry') + '\n' +
    extractFunctionSource(GAME, 'restoreSystemMessagesState') + '\n' +
    extractFunctionSource(GAME, 'serializeSystemMessagesState') + '\n' +
    'return ({\n' +
    '  saveCalls: 0,\n' +
    '  saveGame() { this.saveCalls++; this.saved = serializeSystemMessagesState(this.systemMessages); },\n' +
    '  ' + extractObjectMethodSource(GAME, 'ensureSystemMessages') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, 'queueSystemMessage') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, 'markSystemMessageDelivered') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, 'markSystemMessageRead') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, 'unreadSystemMessageCount') + ',\n' +
    '  ' + extractObjectMethodSource(GAME, 'getActiveSystemMessage') + '\n' +
    '});';
  // eslint-disable-next-line no-new-func -- behavioural harness for project-owned queue methods.
  return new Function(helperSrc)();
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

test('system message queue is wired into start, save, and continue contracts', () => {
  assert.match(GAME, /systemMessages:\s*restoreSystemMessagesState\(null\)/);
  assert.match(GAME, /ensureSystemMessages\(\)[\s\S]*restoreSystemMessagesState\(this\.systemMessages\)/);
  assert.match(GAME, /queueSystemMessage\(id\)[\s\S]*createSystemMessageEntry\(def,\s*state\.nextSequence\)/);
  assert.match(GAME, /markSystemMessageDelivered\(id\)[\s\S]*entry\.state\s*=\s*'delivered'[\s\S]*state\.activeId\s*=\s*entry\.id/);
  assert.match(GAME, /markSystemMessageRead\(id\)[\s\S]*entry\.state\s*!==\s*'delivered'[\s\S]*entry\.state\s*=\s*'read'[\s\S]*state\.activeId\s*=\s*null/);
  assert.match(GAME, /this\.systemMessages\s*=\s*restoreSystemMessagesState\(null\)[\s\S]*this\.loadFloor\(startFloor,\s*undefined,\s*true\)[\s\S]*this\.queueSystemMessage\('boot-inventory'\)[\s\S]*if\s*\(!opts\.skipIntro/,
    'fresh runs must queue the mandatory boot prompt before intro/play can hand control to the player');
  assert.match(GAME, /systemMessages:\s*serializeSystemMessagesState\(this\.systemMessages\)/);
  assert.match(GAME, /this\.loadFloor\(save\.floor\|\|1,\s*savedMod,\s*true\)[\s\S]*this\.systemMessages\s*=\s*restoreSystemMessagesState\(save\.systemMessages\)[\s\S]*this\.saveGame\(\)/,
    'Continue must restore system-message queue state before rewriting the checkpoint');
});

test('system message spec and design artifact reflect MSG-001 shipped scope', () => {
  assert.match(SPEC, /system-message data model and run-scoped queue are shipped/i);
  assert.match(SPEC, /No system-prompt overlay, unread indicator, explicit ACK UI, combat-safe delivery/i);
  assert.match(DESIGN, /MSG-001: System message data model and queue/i);
  assert.match(DESIGN, /Status: shipped data-model slice/i);
});
