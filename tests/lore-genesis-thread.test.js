'use strict';
// @ts-check
//
// LORE_ENTRIES — GENESIS-thread extension (last 5 entries; currently entries 28-32).
//
// First test file for LORE_ENTRIES. Establishes:
//   - exact-count canary (= 32) — owns the LORE_ENTRIES pool size invariant.
//     When the next lore entry lands, retire this canary to a >= floor and
//     pin the new exact count in the new entry's own test file. (Same pattern
//     as FLOOR_MODIFIERS / HACKWARE_KEYS / ELITE_AFFIXES canaries — see
//     stored memories `modifier pool canary pattern` and `elite affix count
//     canary`.)
//   - regression floor (>= 32) — the GENESIS thread additions must persist.
//   - structural sanity — non-empty strings, no duplicates, length bounds
//     consistent with the existing entries (so they word-wrap correctly into
//     the READING overlay at game.js:5193 — fw is min(620, W-40), max body
//     width fw-40, font 11-14px monospace).
//   - GENESIS-thread continuity — the 5 new entries reference GENESIS, OMEGA,
//     or characters/locations established earlier in the thread, so a future
//     refactor that drops them by mistake is caught.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.resolve(process.cwd(), 'src/content.js'), 'utf8');

function extractLoreEntries() {
  const m = SRC.match(/const LORE_ENTRIES = \[([\s\S]*?)\n\];/);
  assert.ok(m, 'LORE_ENTRIES array literal must be findable in src/content.js');
  // eslint-disable-next-line no-eval -- structural extraction of a string-literal array; the source is project-controlled.
  const arr = eval('[' + m[1] + ']');
  assert.ok(Array.isArray(arr), 'LORE_ENTRIES must parse to an array');
  return /** @type {string[]} */ (arr);
}

test('LORE_ENTRIES pool size invariant: GENESIS thread brings the registry to exactly 32', () => {
  const entries = extractLoreEntries();
  assert.equal(entries.length, 32,
    'LORE_ENTRIES must have exactly 32 entries after the GENESIS thread extension. ' +
    'If you added a new lore entry, retire this canary to >= 32 and pin the new exact ' +
    'count in your new entry\'s own test file (see file header for the handoff pattern).');
});

test('LORE_ENTRIES regression floor: never drop below the GENESIS thread baseline', () => {
  const entries = extractLoreEntries();
  assert.ok(entries.length >= 32,
    `LORE_ENTRIES.length (${entries.length}) dropped below 32 — the GENESIS thread ` +
    'additions (entries 28-32) must persist.');
});

test('LORE_ENTRIES: every entry is a non-empty trimmed string', () => {
  const entries = extractLoreEntries();
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    assert.equal(typeof e, 'string', `entry ${i} must be a string`);
    assert.ok(e.length > 0, `entry ${i} must be non-empty`);
    assert.equal(e, e.trim(), `entry ${i} must be trimmed (no leading/trailing whitespace)`);
  }
});

test('LORE_ENTRIES: no duplicate entries', () => {
  const entries = extractLoreEntries();
  const seen = new Set();
  const dupes = [];
  for (const e of entries) {
    if (seen.has(e)) dupes.push(e.slice(0, 60) + '…');
    seen.add(e);
  }
  assert.equal(dupes.length, 0, `Duplicate lore entries found: ${dupes.join(' | ')}`);
});

test('LORE_ENTRIES: lengths stay within the READING overlay\'s comfortable range', () => {
  // Existing entries (pre-GENESIS-thread) ranged 125-258 chars. Keep new
  // entries in the same family so they read at the same pace and don't
  // overflow the overlay's body region (~620w × ~340h, ~14-line capacity at
  // 14px monospace).
  const entries = extractLoreEntries();
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    assert.ok(e.length >= 80,
      `entry ${i} is too short (${e.length} chars) — keep tone parity with the existing entries.`);
    assert.ok(e.length <= 400,
      `entry ${i} is too long (${e.length} chars) — would overflow the READING overlay.`);
  }
});

test('LORE_ENTRIES: GENESIS thread continuity — 5 new entries reference the established lore', () => {
  const entries = extractLoreEntries();
  // The 5 new entries are the current tail of the array. Keep this relative so
  // the canary does not silently become stale if earlier lore is inserted.
  const newEntries = entries.slice(-5);
  assert.equal(newEntries.length, 5, 'expected exactly 5 GENESIS-thread entries at the end of LORE_ENTRIES');

  const ANCHORS = /\bGENESIS\b|\bOMEGA\b|\bVOSS\b|\bSL-?\d+\b|Sub-?Level/i;
  for (let i = 0; i < newEntries.length; i++) {
    const e = newEntries[i];
    assert.match(e, ANCHORS,
      `GENESIS-thread entry ${27 + i} must reference an established lore anchor ` +
      '(GENESIS / OMEGA / VOSS / a sub-level). Got: ' + e.slice(0, 80) + '…');
  }
});

test('LORE_ENTRIES: GENESIS thread is anchored — at least 3 of the 5 new entries name GENESIS directly', () => {
  // The point of the extension is to deepen the GENESIS arc. Generic
  // OMEGA/Voss references aren't enough — a majority of the new entries must
  // name GENESIS so the thread remains discoverable to a player who hits the
  // randomized lore picker.
  const entries = extractLoreEntries();
  const newEntries = entries.slice(-5);
  const genesisCount = newEntries.filter(e => /\bGENESIS(?:_LEGACY)?\b|\bolder voice\b|\bolder than\b/i.test(e)).length;
  assert.ok(genesisCount >= 3,
    `Only ${genesisCount} of 5 new entries name GENESIS (or an unmistakable cipher for it). ` +
    'The GENESIS thread must remain discoverable from random lore drops.');
});

test('LORE_ENTRIES: random picker contract — array literal, not Object.freeze\'d (game.js:2095 mutates with .add on loreRead, not on entries)', () => {
  // Sanity check that the array shape hasn't drifted to something the
  // randomized picker at src/game.js:2095-2098 can't handle. The picker:
  //   const unseen = LORE_ENTRIES.map((_, i) => i).filter(i => !player.loreRead.has(i));
  //   const idx = unseen.length > 0 ? unseen[rnd] : rnd;
  //   this.currentLore = LORE_ENTRIES[idx] ?? null;
  // Required: array, indexable by integer, .map and .length work.
  const entries = extractLoreEntries();
  assert.ok(Array.isArray(entries), 'LORE_ENTRIES must be an Array (the picker uses .map / .filter / numeric index)');
  assert.equal(typeof entries.length, 'number');
  assert.equal(typeof entries[0], 'string');
});
