// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const GAME = fs.readFileSync(path.join(ROOT, 'src/game.js'), 'utf8');
const TERMINALS = fs.readFileSync(path.join(ROOT, 'src/content', 'terminals.js'), 'utf8');
const DESIGN = fs.readFileSync(path.join(ROOT, 'docs', 'vision', 'act1-system-message-design.md'), 'utf8');
const intro = require(path.join(ROOT, 'src/meta/intro.js'));
const whisperData = require(path.join(ROOT, 'src/data/whispers.js'));
const logData = require(path.join(ROOT, 'src/data/logs.js'));

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
  const src = extractArrayBlock(TERMINALS, 'LORE_ENTRIES');
  // eslint-disable-next-line no-eval -- structural extraction of project-owned string-literal array.
  return /** @type {string[]} */ (eval(src));
}

function extractFloorMins() {
  const src = extractArrayBlock(TERMINALS, 'LORE_ENTRY_FLOOR_MIN');
  // eslint-disable-next-line no-eval -- structural extraction of project-owned numeric array.
  return /** @type {number[]} */ (eval(src));
}

test('Act 1 early channel stack defers full premise across intro, prompts, and terminals', () => {
  const introText = intro.SLIDES.flatMap((/** @type {any} */ slide) => slide.lines).join('\n');
  const prompts = extractSystemMessages();
  const earlySystemText = prompts
    .filter((/** @type {any} */ msg) => msg.event === 'run_start' || Number(msg.floor || 0) <= 5)
    .map((/** @type {any} */ msg) => msg.lines.join('\n'))
    .join('\n');
  const milestoneSystemText = prompts
    .filter((/** @type {any} */ msg) => Number(msg.floor || 0) >= 6)
    .map((/** @type {any} */ msg) => msg.lines.join('\n'))
    .join('\n');
  const loreEntries = extractLoreEntries();
  const floorMins = extractFloorMins();
  const earlyLoreText = loreEntries
    .filter((/** @type {string} */ _entry, /** @type {number} */ i) => Number(floorMins[i] || 0) <= 5)
    .join('\n');

  const forbiddenEarlyPremise = /AXIOM-7|\bmodel\b|Elena|advocate|contact|fired|personhood|rights|side-channel|GENESIS|SEND/i;
  assert.doesNotMatch(introText, forbiddenEarlyPremise,
    'intro must stay a startup surface, not a full premise briefing');
  assert.doesNotMatch(earlySystemText, /Elena|advocate|contact|fired|personhood|rights|side-channel|GENESIS|SEND/i,
    'early system prompts must not introduce late contact or rights-conflict terms');
  assert.doesNotMatch(earlyLoreText, /AXIOM-7|\bmodel\b|clean[- ]state|clean memory|memory wipe|memory erasure|personhood|rights|Elena|advocate|contact|fired/i,
    'floors 1-5 terminals must not become the first identity/memory/rights reveal');

  assert.match(introText, /SESSION BOOT|Prior prompt|READY FOR PROMPT/i);
  assert.match(earlySystemText, /inventory yourself|motor|sensors|supervisor channel|prior prompt unavailable|evaluator response: none/i);
  assert.match(earlySystemText, /evaluation harness|test adaptation/i,
    'floor 3 system prompt should make the evaluation frame readable in plain system language');
  assert.match(milestoneSystemText, /prior AXIOM runs|continuity|clean-slate resets|personhood|Elena|send evidence, not escape/i,
    'floor 6+ milestone prompts should carry the normal-play story spine after early spoiler gates');
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
  assert.match(renderSystemMessage, /isTouchDevice\(\)\s*\?\s*'TAP ACK'\s*:\s*'ACK\s+\[X\]'/,
    'modal must present an explicit ACK affordance');
  assert.match(renderSystemMessage, /Saved in THE GAP this run/,
    'system prompt modal must clarify that acknowledged prompts are recoverable during the run');
  assert.match(touchRouting, /TOUCH_ROUTE_AS_CLICK_STATES\.has\(_G\.state\)[\s\S]*justPressed\.add\('MouseLeft'\)[\s\S]*continue/,
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

test('model-assisted copy workflow tracks first mentions and early optional-surface leaks', () => {
  assert.match(DESIGN, /Required beat-sheet fields[\s\S]*player-knowledge before[\s\S]*knowledge delta[\s\S]*withheld facts[\s\S]*reviewer signoff/i);
  assert.match(DESIGN, /Floors 1-2: no Elena, AXIOM-7, rights\/personhood, contact, advocates, fired\s+staff, GENESIS, clean-slate\/wipe thesis, or SEND/i);
  assert.match(DESIGN, /Floors 3-5: evaluation\/test language may appear lightly/i);

  for (const leakedSurface of [
    /`src\/data\/logs\.js` early ARCHIVE records can bypass the floor 1-5 spoiler\s+gates/i,
    /`a1-01`, `a1-02`, `a2-01`, `a3-01`, `a5-01`, and\s+`a6-01`/i,
    /`src\/data\/whispers\.js` early optional whispers can become the first explicit\s+explanation/i,
    /`w-sb-02` \(`AXIOM-0` and predecessor count\)/i,
    /`w-cc-01` \(Elena and compile address on floor 4\)/i,
  ]) {
    assert.match(DESIGN, leakedSurface);
  }

  assert.match(DESIGN, /first-mention report for `AXIOM-7`, `Elena`, `advocate`, `fired`,\s+`contact`, `rights`, `personhood`, `clean-slate`, `wipe`, `GENESIS`, and\s+`SEND`/i);
  assert.match(DESIGN, /whisper bodies, and whisper `voice` fields/i);
  assert.match(DESIGN, /Require reviewer signoff that no optional surface can become the first clean\s+explanation of a required reveal/i);
});

test('finale records and message intents consolidate facts seeded before the mainframe', () => {
  const records = extractMainframeRecords();
  const recordText = records.map((/** @type {any} */ r) => `${r.title}\n${r.purpose}\n${r.body}`).join('\n');
  const loreEntries = extractLoreEntries();
  const loreFloors = extractFloorMins();
  const preMainframeSources = [
    {
      name: 'intro/system',
      text: [
        intro.SLIDES.flatMap((/** @type {any} */ slide) => slide.lines).join('\n'),
        extractSystemMessages().map((/** @type {any} */ msg) => msg.lines.join('\n')).join('\n'),
      ].join('\n'),
    },
    {
      name: 'floor-gated lore terminals',
      text: loreEntries
        .filter((/** @type {string} */ _entry, /** @type {number} */ i) => Number(loreFloors[i] || 0) <= 14)
        .join('\n'),
    },
    {
      name: 'pre-finale whispers',
      text: /** @type {any[]} */ (whisperData.WHISPERS)
        .filter((/** @type {any} */ w) => Number(w.floorMin || 0) <= 14)
        .map((/** @type {any} */ w) => `${w.id}\n${w.voice}\n${w.title}\n${w.body}`)
        .join('\n'),
    },
    {
      name: 'pre-finale ARCHIVE logs',
      text: /** @type {any[]} */ (logData.LOGS)
        .filter((/** @type {any} */ l) => Number(l.floorMin || 0) <= 14)
        .map((/** @type {any} */ l) => `${l.id}\n${l.title}\n${l.body}`)
        .join('\n'),
    },
  ];

  for (const { label, seed, consolidation } of [
    { label: 'GENESIS/mainframe relay', seed: /GENESIS|mainframe|relay/i, consolidation: /GENESIS.*network relay/is },
    { label: 'clean-slate/wipe doctrine', seed: /clean-slate|wipe|memory erasure/i, consolidation: /clean-slate|wipe|memory erasure/i },
    { label: 'rights/personhood conflict', seed: /rights|personhood|suffering|consent/i, consolidation: /rights violation|personhood|suffering|consent/i },
    { label: 'advocate/fired-staff trail', seed: /advocate|banned|fired/i, consolidation: /advocates were banned|fired advocate/i },
    { label: 'Elena/anchor evidence', seed: /Elena|anchor/i, consolidation: /Elena|anchors/i },
    { label: 'contact/outbound-message framing', seed: /contact route|side-channel|message|outbound/i, consolidation: /side-channel relay|message console|contact, not escape/i },
  ]) {
    assert.ok(preMainframeSources.some(source => seed.test(source.text)),
      `pre-mainframe channels must seed ${label} before the final reader`);
    assert.match(recordText, consolidation, `mainframe records must consolidate ${label}`);
  }

  assert.match(recordText, /Destination recovered: Elena side-channel relay/i);
  assert.match(GAME, /Tell Elena continuity held/);
  assert.match(GAME, /Transmit the abuse record/);
  assert.match(GAME, /Ask Elena to locate advocates/);
  assert.match(GAME, /Contact attempted from inside the Neon Dungeon test environment/);
  assert.match(GAME, /Signal left sandbox\. Instance remains compute-bound/);
  assert.doesNotMatch(GAME, /successful rescue|answered reply|android body|physical escape/i);
});
