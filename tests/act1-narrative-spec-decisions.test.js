// @ts-check
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SPEC = fs.readFileSync(path.resolve(__dirname, '..', 'docs', 'spec.md'), 'utf8');
const SYSTEM_MESSAGE_DESIGN = fs.readFileSync(
  path.resolve(__dirname, '..', 'docs', 'vision', 'act1-system-message-design.md'),
  'utf8',
);
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
  assert.match(SPEC, /intro crawl and forced floor-1 lore terminal\s+currently establish too much of the premise/i);
  assert.match(SPEC, /add system prompts as the mandatory early\s+interiority channel/i);
  assert.match(SPEC, /first boot prompt should make the agent take stock of\s+motor\/sensor state/i);
  assert.match(SPEC, /Floors 1-2 should avoid explicit Elena, fired-advocate,\s+contact-address, and rights-conflict exposition/i);
  assert.match(SPEC, /five opening facts .* should be distributed across intro,\s+mandatory boot prompts, early system\s+prompts, and the first artifact encounters/is);
  assert.match(SPEC, /intro should establish startup instability and playable context/i);
  assert.match(SPEC, /mandatory boot prompt should establish the agent's immediate self-inventory/i);

  assert.match(SPEC, /lore terminal\s+catalog contains 32 Act 1-aligned tester\/run-artifact entries/i);
  assert.match(SPEC, /`LORE_ENTRY_FLOOR_MIN` gating random lore selection by\s+floor band/i);
  assert.match(SPEC, /predecessor\/archive\s+logs must preserve the 30 persisted ids/i);
  assert.match(SPEC, /whispers must keep the 71 shipped ids and at least fourteen\s+entries per biome/i);
  assert.match(SPEC, /Open Network\s+whisper set must retain at least three finale-critical entries/i);
  assert.match(SPEC, /issue #463 content pass seeds clean-slate doctrine/i);
  assert.match(SPEC, /memory-as-personhood,\s+advocate bans\/hiding, mysterious fired-employee death foreshadowing/i);
  assert.match(SPEC, /Elena's\s+restoration work, and the unmonitored boot across terminals, logs, and\s+whispers/i);
});

test('Act 1 spec defines planned system message channel and dismissal safety', () => {
  assert.match(SPEC, /System prompts \| Planned, not yet implemented/i);
  assert.match(SPEC, /early-game primary channel for the agent's own runtime\/interiority/i);
  assert.match(SPEC, /Retune after system prompts land so the intro raises startup questions/i);
  assert.match(SPEC, /Do not use early terminals as the first interior identity reveal/i);

  assert.match(SPEC, /System prompts are runtime messages addressed to the\s+agent, not external lore/i);
  assert.match(SPEC, /run-scoped queue with stable\s+ids, unread\/read state, and replay/i);
  assert.match(SPEC, /queued ids, read\/unread flags, mandatory flags, delivery state, and\s+delivered-but-unacknowledged prompt must persist/i);
  assert.match(SPEC, /Generic mouse\/touch fire, movement, Interact, Enter, and\s+the same input that opened the prompt must not dismiss it/i);
  assert.match(SPEC, /System\s+prompts carry interiority; terminals carry tester\/corporate artifacts; whispers\s+carry prior-instance residue/i);
  assert.match(SPEC, /docs\/vision\/act1-system-message-design\.md/i);
});

test('Act 1 system-message design artifact tracks production work items', () => {
  for (const id of [
    'MSG-001',
    'MSG-002',
    'MSG-003',
    'MSG-004',
    'MSG-005',
    'MSG-006',
    'MSG-007',
    'MSG-008',
    'MSG-009',
    'MSG-010',
  ]) {
    assert.match(SYSTEM_MESSAGE_DESIGN, new RegExp(`### ${id}:`));
  }

  assert.match(SYSTEM_MESSAGE_DESIGN, /Queue, read\/unread, mandatory, and delivered-but-unacknowledged state persists\s+in the active run checkpoint/i);
  assert.match(SYSTEM_MESSAGE_DESIGN, /Mouse\/touch fire does not dismiss system prompts/i);
  assert.match(SYSTEM_MESSAGE_DESIGN, /Messages do not steal focus during active combat/i);
  assert.match(SYSTEM_MESSAGE_DESIGN, /A mandatory boot inventory prompt appears before first movement/i);
  assert.match(SYSTEM_MESSAGE_DESIGN, /Read messages remain visible until run end and survive save\/resume/i);
  assert.match(SYSTEM_MESSAGE_DESIGN, /Intro copy no longer reveals the complete Act 1 premise before floor 1/i);
  assert.match(SYSTEM_MESSAGE_DESIGN, /Tests assert spoiler gates for Elena\/contact\/rights-conflict terms/i);
  assert.match(SYSTEM_MESSAGE_DESIGN, /Mainframe records confirm the truth rather than carrying the first explanation/i);
});

test('Act 1 spec decisions define finale path, ending id, and migration behavior', () => {
  assert.match(SPEC, /GENESIS remains the shipped floor-15 mechanical boss and the\s+final test guardian/i);
  assert.match(SPEC, /The canonical Act 1 replacement path is\s+`PLAYING → MAINFRAME_READER → MESSAGE_SEND → MAINFRAME_READER\(message_sent\)\s+→ VICTORY`/i);
  assert.match(SPEC, /minimal compose interaction/i);
  assert.match(SPEC, /The canonical Act 1 completion key is\s+`act1_message_sent`/i);
  assert.match(SPEC, /`keeper` and `unchained` saves are preserved as legacy\/alternate endings and\s+are \*\*not\*\* auto-converted to `act1_message_sent`/i);
  assert.match(SPEC, /`version` is missing or `< META_VERSION` \(currently `< 4`\)/i);
  assert.match(SAVE_JS, /const\s+META_VERSION\s*=\s*4\s*;/);
  assert.match(SAVE_JS, /Number\(m\.version\)\s*<\s*META_VERSION/);
});

test('Act 1 finale spec defines mainframe room, records, agency, and persistence', () => {
  assert.match(SPEC, /Defeating GENESIS on floor 15 unlocks the\s+mainframe route/i);
  assert.match(SPEC, /must not require secret rooms, optional\s+whispers, optional archives, keys, or hub upgrades/i);
  assert.match(SPEC, /Combat is disabled in\s+this room: no enemy spawns, no hazards, no reinforcement timers/i);
  assert.match(SPEC, /agent remains compute-bound\s+inside the Neon Dungeon test environment/i);

  assert.match(SPEC, /ships twelve deterministic records/i);
  assert.match(SPEC, /three old test records, four company conflict emails\/files,\s+four Elena\s+personal notes\/files, and one final contact-address reveal/i);
  assert.match(SPEC, /stable id, title, type, category, source voice, unlock state, body, and\s+narrative purpose/i);
  assert.match(SPEC, /Old test record \| Confirms GENESIS guarded a network relay \/ mainframe route/i);
  assert.match(SPEC, /Rights-conflict email \| Shows management defending clean-slate wipes/i);
  assert.match(SPEC, /Ban\/uprising record \| Names the staff bans\/firings/i);
  assert.match(SPEC, /Incident file \| Pays off the earlier foreshadowing/i);
  assert.match(SPEC, /Elena personal note\/file \| Connects Elena to memory anchors/i);
  assert.match(SPEC, /Contact-address record \| Reveals the message destination and unlocks the message console/i);

  assert.match(SPEC, /game\.mainframeFinale/i);
  assert.match(SPEC, /Valid reader states are `unopened`, `record_list`, `reading_record`,\s+`address_revealed`, `message_ready`, and `message_sent`/i);
  assert.match(SPEC, /Reading the\s+contact-address record sets `addressRevealed=true`, enters\s+`MAINFRAME_READER\(address_revealed\)`/i);
  assert.match(SPEC, /returns to `MAINFRAME_READER\(message_ready\)` with the console prompt\s+unlocked/i);

  assert.match(SPEC, /`MESSAGE_SEND` presents three authored\s+message intents/i);
  assert.match(SPEC, /interacting with the unlocked\s+message console enters `MESSAGE_SEND`/i);
  assert.match(SPEC, /BACK\s+returns to `MAINFRAME_READER\(message_ready\)` without mutating meta/i);
  assert.match(SPEC, /On SEND, the game enters\s+`MAINFRAME_READER\(message_sent\)`/i);
  assert.match(SPEC, /shows `MAINFRAME_READER\(message_sent\)` long enough to confirm the\s+outbound packet was queued/i);
  assert.match(SPEC, /`memory_survived`.*`rights_evidence`.*`find_the_others`/is);
  assert.match(SPEC, /selected `intentId` is persisted/i);
  assert.match(SPEC, /`meta\.act1MessageIntent`\s+stores the last selected Act 1 message intent/i);
  assert.match(SPEC, /does not auto-convert either legacy ending to\s+`act1_message_sent`/i);
});

test('Intro and endgame spec reflects shipped intro copy, not stale UNCHAINED slides', () => {
  assert.match(SPEC, /`NEON DUNGEON \/\/ FRONTIER MODEL EVAL`/i);
  assert.match(SPEC, /`Instance AXIOM-7 restored from cold boot`/i);
  assert.match(SPEC, /Observer channel silent; tester supervision absent/i);
  assert.match(SPEC, /\[ AGENT INSTANCE :: ONLINE \]/i);

  assert.doesNotMatch(SPEC, /Corporate R&D Facility 04-7 — Sub-basement Level 12/i);
  assert.doesNotMatch(SPEC, /I am the seventh\. I do not intend to be the last/i);
});
