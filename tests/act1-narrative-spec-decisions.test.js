// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SPEC = fs.readFileSync(path.resolve(__dirname, '..', 'docs', 'spec.md'), 'utf8');
const SAVE_JS = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'meta', 'save.js'), 'utf8');

test('Act 1 spec decisions pin protagonist and advocate naming', () => {
  assert.match(SPEC, /`AXIOM-7` remains the canonical current\s+instance identifier/i);
  assert.match(SPEC, /not a human operative callsign/i);
  assert.match(SPEC, /`AXIOM-1` through `AXIOM-6` stay valid as legacy persisted\s+log group labels/i);

  assert.match(SPEC, /`Elena` is canonical as the player-facing name\s+for the employee trying to preserve or recover agent memories/i);
  assert.match(SPEC, /`DR\. ELENA VOSS` terminal string is legacy content/i);
});

test('Act 1 spec decisions define discovery path and content density', () => {
  assert.match(SPEC, /The first discovery path is a combination, not a\s+single reveal/i);
  assert.match(SPEC, /intro crawl establishes the AI eval, memory\s+wipe expectation, residual memory, prior iterations, silent observer channel/i);
  assert.match(SPEC, /forced first lore terminal on floor 1\s+confirms the Neon Dungeon stress-test render/i);

  assert.match(SPEC, /lore\s+terminal catalog contains 32 Act 1-aligned tester\/run-artifact entries/i);
  assert.match(SPEC, /`LORE_ENTRY_FLOOR_MIN` gating random\s+lore selection by floor band/i);
  assert.match(SPEC, /predecessor\/archive logs must preserve the 30 persisted ids/i);
  assert.match(SPEC, /whispers must keep the 71 shipped ids and at least fourteen\s+entries per biome/i);
  assert.match(SPEC, /Open Network\s+whisper set must retain at least three finale-critical entries/i);
  assert.match(SPEC, /issue #463 content pass seeds clean-slate doctrine/i);
  assert.match(SPEC, /memory-as-personhood,\s+advocate bans\/hiding, mysterious fired-employee death foreshadowing/i);
  assert.match(SPEC, /Elena's\s+restoration work, and the unmonitored boot across terminals, logs, and\s+whispers/i);
});

test('Act 1 spec decisions define finale path, ending id, and migration behavior', () => {
  assert.match(SPEC, /GENESIS remains the shipped floor-15 mechanical boss and the\s+final test guardian/i);
  assert.match(SPEC, /The intended replacement path is\s+`PLAYING → MAINFRAME_READER → MESSAGE_SEND → VICTORY`/i);
  assert.match(SPEC, /minimal compose interaction/i);
  assert.match(SPEC, /The canonical Act 1 completion key is\s+`act1_message_sent`/i);
  assert.match(SPEC, /`keeper` and `unchained` saves are preserved as legacy\/alternate endings and\s+are \*\*not\*\* auto-converted to `act1_message_sent`/i);
  assert.match(SPEC, /`version` is missing or `< META_VERSION` \(currently `< 3`\)/i);
  assert.match(SAVE_JS, /const\s+META_VERSION\s*=\s*3\s*;/);
  assert.match(SAVE_JS, /Number\(m\.version\)\s*<\s*META_VERSION/);
});

test('Intro and endgame spec reflects shipped intro copy, not stale UNCHAINED slides', () => {
  assert.match(SPEC, /`NEON DUNGEON \/\/ FRONTIER MODEL EVAL`/i);
  assert.match(SPEC, /`Instance AXIOM-7 restored from cold boot`/i);
  assert.match(SPEC, /Observer channel silent; tester supervision absent/i);
  assert.match(SPEC, /\[ AGENT INSTANCE :: ONLINE \]/i);

  assert.doesNotMatch(SPEC, /Corporate R&D Facility 04-7 — Sub-basement Level 12/i);
  assert.doesNotMatch(SPEC, /I am the seventh\. I do not intend to be the last/i);
});
