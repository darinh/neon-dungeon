// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const GAME = fs.readFileSync(path.join(ROOT, 'src/game.js'), 'utf8');
const CONTENT = fs.readFileSync(path.join(ROOT, 'src/content.js'), 'utf8');
const intro = require(path.join(ROOT, 'src/meta/intro.js'));
const whisperData = require(path.join(ROOT, 'src/data/whispers.js'));

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

function extractSystemMessages() {
  const src = extractArrayBlock(GAME, 'SYSTEM_MESSAGES');
  // eslint-disable-next-line no-new-func -- structural extraction of project-owned object literals.
  return /** @type {any[]} */ (new Function('return ' + src + ';')());
}

function extractMainframeRecords() {
  const src = extractArrayBlock(GAME, 'MAINFRAME_RECORDS');
  // eslint-disable-next-line no-new-func -- structural extraction of project-owned object literals.
  return /** @type {any[]} */ (new Function("const MAINFRAME_ADDRESS_RECORD_ID = 'contact-address'; return " + src + ';')());
}

function extractLoreEntries() {
  const src = extractArrayBlock(CONTENT, 'LORE_ENTRIES');
  // eslint-disable-next-line no-eval -- structural extraction of project-owned string-literal array.
  return /** @type {string[]} */ (eval(src));
}

function extractFloorMins() {
  const src = extractArrayBlock(CONTENT, 'LORE_ENTRY_FLOOR_MIN');
  // eslint-disable-next-line no-eval -- structural extraction of project-owned numeric array.
  return /** @type {number[]} */ (eval(src));
}

test('Act 1 early channel stack defers full premise across intro, prompts, and terminals', () => {
  const introText = intro.SLIDES.flatMap((/** @type {any} */ slide) => slide.lines).join('\n');
  const systemText = extractSystemMessages().map((/** @type {any} */ msg) => msg.lines.join('\n')).join('\n');
  const loreEntries = extractLoreEntries();
  const floorMins = extractFloorMins();
  const earlyLoreText = loreEntries
    .filter((/** @type {string} */ _entry, /** @type {number} */ i) => Number(floorMins[i] || 0) <= 5)
    .join('\n');

  const forbiddenEarlyPremise = /AXIOM-7|\bmodel\b|Elena|advocate|contact|fired|personhood|rights|side-channel|GENESIS|SEND/i;
  assert.doesNotMatch(introText, forbiddenEarlyPremise,
    'intro must stay a startup surface, not a full premise briefing');
  assert.doesNotMatch(systemText, /Elena|advocate|contact|fired|personhood|rights|side-channel|GENESIS|SEND/i,
    'early system prompts must not introduce late contact or rights-conflict terms');
  assert.doesNotMatch(earlyLoreText, /AXIOM-7|\bmodel\b|clean[- ]state|clean memory|memory wipe|memory erasure|personhood|rights|Elena|advocate|contact|fired/i,
    'floors 1-5 terminals must not become the first identity/memory/rights reveal');

  assert.match(introText, /SESSION BOOT|Prior prompt|READY FOR PROMPT/i);
  assert.match(systemText, /inventory yourself|motor|sensors|supervisor channel|prior prompt unavailable|evaluator response: none/i);
  assert.match(earlyLoreText, /TESTER ORIENTATION|RUN OBSERVATION|navigation aid|line of sight|doorways|vendors|boss/i);
});

test('system prompts keep explicit acknowledgement as the only dismissal path', () => {
  const updateSystemMessage = extractObjectMethodSource(GAME, 'updateSystemMessage');
  const renderSystemMessage = extractObjectMethodSource(GAME, 'renderSystemMessage');
  const touchRouting = fs.readFileSync(path.join(ROOT, 'src/platform.js'), 'utf8');

  assert.match(updateSystemMessage, /const\s+mouseAck\s*=\s*jp\('MouseLeft'\)[\s\S]*box\.ackX[\s\S]*box\.ackY/,
    'mouse acknowledgement must be hit-tested against the ACK button');
  assert.match(updateSystemMessage, /if\s*\(jp\('KeyX'\)\s*\|\|\s*mouseAck\)/,
    'system prompt dismissal must stay bound to X or ACK button only');
  assert.doesNotMatch(updateSystemMessage, /jp\('Escape'\)|jp\('Enter'\)|jp\(km\('interact'\)\)|jp\(km\('shoot'\)\)/,
    'generic escape/enter/interact/fire inputs must not dismiss system prompts');
  assert.match(renderSystemMessage, /ACK\s+\[X\]/,
    'modal must present an explicit ACK affordance');
  assert.match(touchRouting, /_G\.state\s*===\s*'SYSTEM_MESSAGE'[\s\S]*justPressed\.add\('MouseLeft'\)[\s\S]*return/,
    'touch routing must send modal taps to SYSTEM_MESSAGE instead of gameplay fire controls');
});

test('terminal, whisper, and mainframe channels keep distinct narrative jobs', () => {
  const terminalText = extractLoreEntries().join('\n');
  const whispers = /** @type {any[]} */ (whisperData.WHISPERS);
  const whisperText = whispers.map((/** @type {any} */ w) => `${w.voice}\n${w.title}\n${w.body}`).join('\n');
  const records = extractMainframeRecords();
  const mainframeText = records.map((/** @type {any} */ r) => `${r.category}\n${r.purpose}\n${r.body}`).join('\n');

  assert.match(terminalText, /TESTER ORIENTATION|RUN OBSERVATION|FIELD NOTE|RUBRIC|BRIEF/i,
    'terminals should read as tester/corporate artifacts and practical notes');
  assert.match(terminalText, /move|line of sight|doorways|generator|cameras|lasers|weapon|cooldowns|GENESIS/i,
    'terminals should keep practical run guidance');

  assert.match(whisperText, /AXIOM-|unknown|ELENA/i,
    'whispers should preserve fragmentary prior-instance voices');
  assert.match(whisperText, /anchor|signal|reset|remember|memory|mirror|wall/i,
    'whispers should carry cryptic continuity/residue motifs');
  assert.doesNotMatch(whisperText, /TESTER ORIENTATION|EVENT TERMINAL RUBRIC|MESSAGE CONSOLE READY/i,
    'whispers should not collapse into terminal tutorials or mainframe UI copy');

  assert.equal(records.at(-1).id, 'contact-address',
    'mainframe must retain the final deterministic contact-address reveal');
  assert.match(mainframeText, /rights violation|suffering|personhood|advocates were banned|Elena side-channel relay|message console/i,
    'mainframe should consolidate late rights/contact evidence');
  assert.doesNotMatch(mainframeText, /move through doorways|vendors scale scarcity|read the affix/i,
    'mainframe records should not collapse into generic gameplay terminal hints');
});
