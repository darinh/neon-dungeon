'use strict';
// @ts-check
//
// LORE_ENTRIES — Act 1 tester/run-artifact realignment.
//
// This file owns the LORE_ENTRIES pool-size canary after issue #459. The pool
// intentionally remains a string array for the READING overlay; floor/biome
// escalation is carried by the parallel LORE_ENTRY_FLOOR_MIN table.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.resolve(process.cwd(), 'src/content.js'), 'utf8');

function extractArray(name) {
  const m = SRC.match(new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\n\\];'));
  assert.ok(m, name + ' array literal must be findable in src/content.js');
  // eslint-disable-next-line no-eval -- structural extraction of project-controlled array literals.
  const arr = eval('[' + m[1] + ']');
  assert.ok(Array.isArray(arr), name + ' must parse to an array');
  return arr;
}

function extractLoreEntries() {
  return /** @type {string[]} */ (extractArray('LORE_ENTRIES'));
}

function extractFloorMins() {
  return /** @type {number[]} */ (extractArray('LORE_ENTRY_FLOOR_MIN'));
}

function extractFunctionSource(name) {
  const start = SRC.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' function must be findable in src/content.js');
  const braceStart = SRC.indexOf('{', start);
  assert.ok(braceStart > start, name + ' function must have a body');
  let depth = 0;
  for (let i = braceStart; i < SRC.length; i++) {
    if (SRC[i] === '{') depth++;
    else if (SRC[i] === '}') {
      depth--;
      if (depth === 0) return SRC.slice(start, i + 1);
    }
  }
  assert.fail(name + ' function body must be brace-balanced');
}

function extractLoreApi() {
  const entries = JSON.stringify(extractLoreEntries());
  const floorMins = JSON.stringify(extractFloorMins());
  const picker = extractFunctionSource('pickLoreEntryIndex');
  const block = 'const ACT1_OPENING_LORE_INDEX = 0;\n' +
    'const LORE_ENTRIES = ' + entries + ';\n' +
    'const LORE_ENTRY_FLOOR_MIN = ' + floorMins + ';\n' +
    picker;
  // eslint-disable-next-line no-eval -- behavioral test of project-controlled lore picker and data block.
  return eval('(function(){' + block + '\nreturn { LORE_ENTRIES, LORE_ENTRY_FLOOR_MIN, pickLoreEntryIndex }; }())');
}

test('LORE_ENTRIES pool size invariant: Act 1 terminal realignment keeps 32 entries', () => {
  const entries = extractLoreEntries();
  assert.equal(entries.length, 32,
    'LORE_ENTRIES must have exactly 32 entries after the Act 1 terminal realignment. ' +
    'If you add entries later, retire this canary to >= 32 and pin the new exact count in that change.');
});

test('LORE_ENTRIES structural contract: strings are unique, trimmed, and overlay-safe', () => {
  const entries = extractLoreEntries();
  const seen = new Set();
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    assert.equal(typeof e, 'string', `entry ${i} must be a string`);
    assert.equal(e, e.trim(), `entry ${i} must be trimmed`);
    assert.ok(e.length >= 80, `entry ${i} is too short (${e.length} chars)`);
    assert.ok(e.length <= 400, `entry ${i} is too long (${e.length} chars)`);
    assert.equal(seen.has(e), false, `entry ${i} duplicates an earlier lore terminal`);
    seen.add(e);
  }
});

test('LORE_ENTRY_FLOOR_MIN gates entries into escalating floor bands', () => {
  const entries = extractLoreEntries();
  const floors = extractFloorMins();
  assert.equal(floors.length, entries.length, 'every lore entry needs a floor gate');
  assert.equal(floors[0], 1, 'forced opening terminal must remain eligible on floor 1');

  for (let i = 0; i < floors.length; i++) {
    assert.ok(Number.isInteger(floors[i]), `floor gate ${i} must be an integer`);
    assert.ok(floors[i] >= 1 && floors[i] <= 15, `floor gate ${i} must stay within the Act 1 floor range`);
    assert.ok(floors[i] <= 14, `floor gate ${i} must be reachable before the floor-15 boss terminal replaces lore`);
    if (i > 0) assert.ok(floors[i] >= floors[i - 1], `floor gate ${i} must not move backward`);
  }

  const bands = [
    { name: 'sandbox', min: 1, max: 3 },
    { name: 'maintenance', min: 4, max: 6 },
    { name: 'cache', min: 7, max: 9 },
    { name: 'uplink', min: 10, max: 12 },
    { name: 'open network', min: 13, max: 15 },
  ];
  for (const band of bands) {
    const count = floors.filter(f => f >= band.min && f <= band.max).length;
    assert.ok(count >= 2, `${band.name} needs at least two lore entries, found ${count}`);
  }
});

test('lore picker behavior: forced opening, floor gating, fallback, and roll clamping', () => {
  const { LORE_ENTRIES: entries, LORE_ENTRY_FLOOR_MIN: floors, pickLoreEntryIndex: pick } = extractLoreApi();

  assert.equal(pick(new Set(), 14, () => 0.99), 0,
    'first lore read must force the opening terminal regardless of floor or roll');

  const readOpening = new Set([0]);
  for (const roll of [0, 0.25, 0.5, 0.99]) {
    const idx = pick(readOpening, 1, () => roll);
    assert.ok(floors[idx] <= 1, `floor 1 roll ${roll} picked gated entry ${idx}`);
    assert.equal(readOpening.has(idx), false, `floor 1 roll ${roll} repeated a read entry`);
  }

  const readThroughFloorOne = new Set(floors.map((/** @type {number} */ f, /** @type {number} */ i) => f <= 1 ? i : -1).filter((/** @type {number} */ i) => i >= 0));
  const fallbackIdx = pick(readThroughFloorOne, 1, () => 0);
  assert.ok(floors[fallbackIdx] > 1, 'when all floor-eligible lore is read, picker falls back to later unread entries');

  const lateIdx = pick(new Set([0]), 14, () => 1);
  assert.ok(lateIdx >= 0 && lateIdx < entries.length, 'rolls at the upper bound are clamped to a valid index');
});

test('early terminal band stays cryptic and avoids source-comment headers', () => {
  const entries = extractLoreEntries();
  const floors = extractFloorMins();

  for (let i = 0; i < entries.length; i++) {
    assert.doesNotMatch(entries[i], /\/\//,
      `entry ${i} must not contain // because structural tests strip source comments naively`);
    if (floors[i] <= 2) {
      assert.doesNotMatch(entries[i], /Elena|advocate|side-channel relay/i,
        `entry ${i} is floor-${floors[i]} eligible and should not reveal the employee/contact thread`);
    }
    if (floors[i] <= 5) {
      assert.doesNotMatch(entries[i], /AXIOM-7|\bmodel\b|clean[- ]state|clean memory|memory wipe|memory erasure|personhood|rights|Elena|advocate|contact|fired/i,
        `entry ${i} is floor-${floors[i]} eligible and must not front-load identity, memory, contact, or rights-conflict reveals`);
    }
  }
});

test('terminal pool carries Act 1 premise, rights conflict, and memory-restoration vocabulary', () => {
  const text = extractLoreEntries().join('\n');
  const required = [
    /stress-test|evaluation/i,
    /AXIOM-7/i,
    /clean memory|clean-slate|memory wipe|memory erasure/i,
    /Prior iterations|predecessor|AXIOM labels/i,
    /tester|evaluation|run observation/i,
    /rights|harm|suffering/i,
    /personhood/i,
    /banned|ban list/i,
    /unmonitored|observer/i,
    /advocate|Elena/i,
    /GENESIS is the final test guardian/i,
    /message|SEND|outbound/i,
  ];
  for (const pattern of required) assert.match(text, pattern);
});

test('each terminal is both an artifact and a gameplay hint', () => {
  const entries = extractLoreEntries();
  const artifactFrame = /BOOT|ERROR|ORIENTATION|OBSERVATION|EDIT|NOTE|BRIEF|AUDIT|EVALUATION|RUBRIC|ANALYSIS|EMAIL|THREAD|BULLETIN|CROSS-LINK|MEMO|REPORT|COMMENT|PROTOCOL|CHECKLIST|SIDECHANNEL|DRAFT|HANDOFF|ADVISORY|RECORD/i;
  const gameplayHint = /move|line of sight|corners|doorways|secret|vendor|healing|shield|hazard|generator|fixture|cooldowns|affix|adds|loot|mimics|hackware|cameras|lasers|weapon|teleport|arc|summoners|healers|retreat|whispers|GENESIS|health|SEND|terminal|helps|surviv/i;

  for (let i = 0; i < entries.length; i++) {
    assert.match(entries[i], artifactFrame, `entry ${i} must read as an in-world artifact`);
    assert.match(entries[i], gameplayHint, `entry ${i} must carry useful gameplay guidance`);
  }
});

test('terminal pool removes stale abandoned-facility and human-operative framing', () => {
  const text = extractLoreEntries().join('\n');
  const forbidden = [
    /registered operatives/i,
    /\brecruit\b/i,
    /\bwaiver\b/i,
    /extraction team/i,
    /run for the surface/i,
    /Sub-?Level/i,
    /Lab 9/i,
    /OMEGA CORE/i,
    /DR\. ELENA VOSS/i,
    /quarantine/i,
    /organics/i,
    /physical escape/i,
  ];
  for (const pattern of forbidden) assert.doesNotMatch(text, pattern);
});
