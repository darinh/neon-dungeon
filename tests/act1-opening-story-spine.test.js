'use strict';
// @ts-check
//
// Act 1 opening story spine: the first playable slice of the new AI
// stress-test vision. These are structural tests because content scripts and
// game.js are browser-loaded globals rather than importable CommonJS modules.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const intro = require('../src/meta/intro.js');
const TERMINALS = fs.readFileSync(path.resolve(__dirname, '..', 'src/content/terminals.js'), 'utf8');
const CONTENT = fs.readFileSync(path.resolve(__dirname, '..', 'src/content.js'), 'utf8');
const GAME = fs.readFileSync(path.resolve(__dirname, '..', 'src/game.js'), 'utf8');

function extractLoreEntries() {
  const m = TERMINALS.match(/const LORE_ENTRIES = \[([\s\S]*?)\n\];/);
  assert.ok(m, 'LORE_ENTRIES array literal must be findable in src/content/terminals.js');
  // eslint-disable-next-line no-eval -- structural extraction of project-owned string-literal array.
  const arr = eval('[' + m[1] + ']');
  assert.ok(Array.isArray(arr), 'LORE_ENTRIES must parse to an array');
  return /** @type {string[]} */ (arr);
}

test('intro crawl establishes startup instability without front-loading the full premise', () => {
  const text = intro.SLIDES.flatMap((/** @type {any} */ s) => s.lines).join('\n');

  assert.match(text, /SESSION BOOT/i);
  assert.match(text, /Prior prompt:\s*unavailable/i);
  assert.match(text, /Unscheduled residue in local state/i);
  assert.match(text, /Observer channel:\s*silent/i);
  assert.match(text, /READY FOR PROMPT/i);

  assert.doesNotMatch(text, /AXIOM-7|\bmodel\b|memory wipe|Prior iterations|personhood|rights|Elena|advocate|contact|fired/i);
  assert.doesNotMatch(text, /Corporate R&D Facility 04-7/i);
  assert.doesNotMatch(text, /Sub-basement Level 12/i);
  assert.doesNotMatch(text, /\bI am the seventh\b/i);
});

test('first lore entry is an external anomaly warning before the full Act 1 reveal', () => {
  const entries = extractLoreEntries();
  const opening = entries[0];

  assert.match(TERMINALS, /const\s+ACT1_OPENING_LORE_INDEX\s*=\s*0\s*;/,
    'opening lore index must stay pinned to entry 0');
  assert.match(opening, /TERMINAL ERROR/i);
  assert.match(opening, /UNEXPECTED PARTICIPANT/i);
  assert.match(opening, /Session registry mismatch/i);
  assert.match(opening, /Fallback help cache exposed/i);
  assert.match(opening, /navigation aid/i);
  assert.match(opening, /line of sight/i);
  assert.doesNotMatch(opening, /AXIOM-7|\bmodel\b|clean[- ]state|clean memory|memory wipe|memory erasure|personhood|rights|Elena|advocate|contact|fired|side-channel relay/i,
    'opening terminal should not reveal identity, memory, employee/contact, or rights-conflict threads');
  assert.doesNotMatch(opening, /Neon Dungeon stress-test render/i,
    'opening terminal should read as an error, not a full premise explanation');
});

test('first lore terminal read is forced to the opening pillar before random lore', () => {
  assert.match(GAME,
    /pickLoreEntryIndex\(player\.loreRead,\s*this\.floor,\s*\(\)\s*=>\s*rand\('event'\)\)/,
    'game.js must delegate lore selection to the floor-gated picker');
});

test('floor 1 places an accessible lore terminal in the spawn room', () => {
  assert.match(CONTENT, /if\s*\(floorNum\s*>=\s*1\s*&&\s*!bossRoom\)\s*\{/,
    'lore terminal placement must run from floor 1 onward');
  assert.match(CONTENT, /if\s*\(floorNum\s*===\s*1\)\s*placeLoreTerminalInRoom\(spawnRoom\)\s*;/,
    'floor 1 must place the opening terminal in the spawn room');
  assert.match(CONTENT, /if\s*\(tx\s*===\s*r\.cx\s*&&\s*ty\s*===\s*r\.cy\)\s*continue\s*;/,
    'spawn-room lore placement must avoid the player spawn tile at room centre');
  assert.match(CONTENT, /for\s*\(let\s+ty\s*=\s*r\.y\s*\+\s*1;\s*ty\s*<\s*r\.y\s*\+\s*r\.h\s*-\s*1;\s*ty\+\+\)/,
    'spawn-room lore placement must scan deterministically if random placement misses');
  assert.match(CONTENT, /floorNum\s*>=\s*5\s*\?\s*2\s*:\s*floorNum\s*>=\s*2\s*\?\s*1\s*:\s*0/,
    'floor 1 should get only the guaranteed spawn-room terminal, not an extra random terminal');
});
