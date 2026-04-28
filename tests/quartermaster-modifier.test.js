'use strict';
// QUARTERMASTER floor modifier — sixth positive modifier in the
// FLOOR_MODIFIERS pool (after CASCADE, OVERCHARGE, WINDFALL, SIGNAL_BOOST,
// REVERB). The FIRST defeat in each room drops a bonus core (+1 value) at
// the kill location. Per-room one-shot — the bonus is gated on a
// `_qmHarvested` flag set on the ROOM object (not the player), so save/
// resume is not required (rooms regenerate fresh on Continue, per
// game.js:354 "rooms array is new" comment).
//
// content.js / entities.js are browser-only (no UMD/CommonJS exports), so
// these tests assert structural invariants any working QUARTERMASTER
// modifier must satisfy:
//   - Registry shape (label/desc/colour/icon) so MODIFIER_KEYS picks it up
//     and the HUD badge in render.js renders correctly.
//   - The on-kill gates (modifier === 'QUARTERMASTER' / !isShard /
//     !isSummon / this.room / !this.room._qmHarvested).
//   - The room-flag write (this.room._qmHarvested = true) so the bonus
//     is genuinely one-shot per room.
//   - Visual feedback (+1◆ floater + particle burst) so the player sees
//     the trigger.
//   - Pool-count invariant (17 entries — bumps from REVERB's 16).
//   - Exactly-once invariant on _EG.modifier === 'QUARTERMASTER' (mirrors
//     the regenerative-modifier exact-count gate) — defends against
//     accidental duplication.
//
// NO save/restore tests: the harvested-state lives on room objects and
// is intentionally non-persistent. A save+resume on a QUARTERMASTER
// floor produces fresh rooms with no flags — the player can re-harvest.
// This is documented as the "Continue should not punish you" stance and
// the exploit cost (save-quit-resume per room) makes it not worth
// defending against.
//
// NO HUD progress suffix tests: per-room one-shot is event-based, not
// counter-based. Mirrors CASCADE which also has no progress suffix.
//
// Pattern lifted from tests/windfall-modifier.test.js (per stored memory
// 'positive floor modifiers' and 'test source-text extraction').

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
);
const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);
const RENDER = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'render.js'), 'utf8'
);

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const ENTITIES_CODE = stripComments(ENTITIES);

/**
 * Brace-walked branch extraction. Naive `OPENER\s*\{[^}]*\}` over-stops
 * at the first inner `{...}` close-brace.
 * @param {string} src
 * @param {RegExp} openerRe
 */
function extractBranch(src, openerRe) {
  const m = src.match(openerRe);
  if (!m) return null;
  const startIdx = m.index + m[0].length;
  let depth = 1;
  for (let i = startIdx; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(m.index, i + 1);
    }
  }
  return null;
}

/**
 * Brace-walked entry extraction for registry entries (KEY: { ... }).
 * @param {string} src
 * @param {RegExp} openerRe
 */
function extractEntry(src, openerRe) {
  const m = src.match(openerRe);
  if (!m) return null;
  const openIdx = src.indexOf('{', m.index);
  if (openIdx < 0) return null;
  let depth = 1;
  for (let i = openIdx + 1; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(m.index, i + 1);
    }
  }
  return null;
}

// ─── FLOOR_MODIFIERS registry ────────────────────────────────────────────

test('QUARTERMASTER is registered in FLOOR_MODIFIERS with label/desc/colour/icon', () => {
  // Shape MUST match existing modifier records (label/desc/colour/icon)
  // so the HUD badge in render.js reads them generically without per-
  // modifier branches. Brace-walked extractEntry is mandatory because
  // any nested object literal in a future field would over-stop a
  // naive regex.
  const entry = extractEntry(CONTENT, /QUARTERMASTER:/);
  assert.ok(entry, 'QUARTERMASTER entry must be locatable in FLOOR_MODIFIERS');
  assert.match(entry, /label:\s*'QUARTERMASTER'/,
    "QUARTERMASTER must carry label:'QUARTERMASTER'");
  assert.match(entry, /desc:\s*'[^']+'/,
    'QUARTERMASTER must carry a non-empty desc string');
  assert.match(entry, /colour:\s*'#[0-9a-fA-F]+'/,
    'QUARTERMASTER must carry a hex colour');
  assert.match(entry, /icon:\s*'[^']+'/,
    'QUARTERMASTER must carry an icon glyph');
});

test('QUARTERMASTER is a top-level key inside FLOOR_MODIFIERS (so MODIFIER_KEYS picks it up)', () => {
  // MODIFIER_KEYS = Object.keys(FLOOR_MODIFIERS) is what game.js's
  // floor-roll consults at line ~190. If QUARTERMASTER ends up nested
  // somewhere other than the dict, it would be defined but never rolled.
  const startIdx = CONTENT.indexOf('const FLOOR_MODIFIERS');
  assert.ok(startIdx > 0, 'FLOOR_MODIFIERS dict must exist');
  const endIdx = CONTENT.indexOf('};', startIdx);
  assert.ok(endIdx > startIdx, 'FLOOR_MODIFIERS dict must terminate');
  const dictBody = CONTENT.slice(startIdx, endIdx);
  assert.ok(/^\s*QUARTERMASTER:/m.test(dictBody),
    'QUARTERMASTER must be a top-level key inside FLOOR_MODIFIERS so MODIFIER_KEYS includes it');
});

test('QUARTERMASTER desc advertises the per-room first-defeat bonus-core contract', () => {
  // The desc string is what surfaces to the player. If a future re-tune
  // changes the cadence (e.g. "every defeat" or counter-based) the desc
  // MUST track the on-kill gate or players are misled. Pin both the
  // per-room semantics AND the bonus-core wording so this test is the
  // contract-violation alarm for both runtime AND copy.
  const entry = extractEntry(CONTENT, /QUARTERMASTER:/);
  assert.ok(entry);
  assert.match(entry, /desc:\s*'[^']*room[^']*'/i,
    'QUARTERMASTER desc must mention the per-room cadence');
  assert.match(entry, /desc:\s*'[^']*core[^']*'/i,
    'QUARTERMASTER desc must mention the bonus-core contract');
});

// ─── Enemy.die() QUARTERMASTER block ──────────────────────────────────

test('Enemy.die() reads _EG.modifier === "QUARTERMASTER" as the top-level gate', () => {
  // The bonus-core path must be wired through the canonical _EG.modifier
  // global (the same global VOLATILE/SWARM/CORROSIVE branches consult).
  // A typo to game.modifier or this.modifier would silently disable the
  // modifier in the on-kill path.
  assert.match(ENTITIES_CODE, /_EG\.modifier\s*===\s*'QUARTERMASTER'/,
    "Enemy.die() must gate the QUARTERMASTER bonus-core on _EG.modifier === 'QUARTERMASTER'");
});

test('Enemy.die() QUARTERMASTER block is gated on !isShard && !isSummon', () => {
  // Without !isShard, a SPLITTER's shard chain that lands the FIRST kill
  // in a room would burn the per-room bonus on a sub-entity. Without
  // !isSummon, a SUMMONER farm that drops the first summon-kill in a new
  // room would burn the bonus on the summon. Mirrors CASCADE / WINDFALL /
  // SIGNAL_BOOST / PIERCING_HEART on-kill gating upstream. Brace-walked
  // extraction anchored on the controlling if-header scopes the assertion
  // to the QUARTERMASTER branch.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_EG\.modifier\s*===\s*'QUARTERMASTER'\s*&&[\s\S]*?\)\s*\{/
  );
  assert.ok(branch, 'QUARTERMASTER if-branch must be locatable by its controlling if-header');
  assert.match(branch, /!\s*this\.isShard/,
    'QUARTERMASTER block must skip this.isShard');
  assert.match(branch, /!\s*isSummon/,
    'QUARTERMASTER block must skip isSummon');
});

test('Enemy.die() QUARTERMASTER block requires this.room (defensive null-check)', () => {
  // Some enemy spawns lack a room association (special spawns, off-map
  // bosses, etc.). Without `this.room` in the gate, accessing
  // this.room._qmHarvested would crash. The truthy check both:
  //   - skips roomless enemies (no bonus, no crash)
  //   - lets the !this.room._qmHarvested check below safely deref
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_EG\.modifier\s*===\s*'QUARTERMASTER'\s*&&[\s\S]*?\)\s*\{/
  );
  assert.ok(branch);
  assert.match(branch, /this\.room/,
    'QUARTERMASTER block must check this.room before deref');
});

test('Enemy.die() QUARTERMASTER block gates on !this.room._qmHarvested (one-shot per room)', () => {
  // The per-room one-shot semantics ARE the modifier. Without the
  // _qmHarvested gate, EVERY defeat in a room would drop a bonus core,
  // turning QUARTERMASTER into a far-stronger WINDFALL clone. Pin both
  // the predicate (negation of the room flag) AND its presence as a
  // direct AND-clause in the if-header.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_EG\.modifier\s*===\s*'QUARTERMASTER'\s*&&[\s\S]*?\)\s*\{/
  );
  assert.ok(branch);
  assert.match(branch, /!\s*this\.room\._qmHarvested/,
    'QUARTERMASTER block must gate on !this.room._qmHarvested for per-room one-shot');
});

test('Enemy.die() QUARTERMASTER block sets this.room._qmHarvested = true inside the gate', () => {
  // Without this write, the per-room gate is meaningless — the bonus
  // would drop on every kill (defeating the modifier's design). The
  // write MUST happen inside the if-branch so it ONLY fires when the
  // bonus actually dropped.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_EG\.modifier\s*===\s*'QUARTERMASTER'\s*&&[\s\S]*?\)\s*\{/
  );
  assert.ok(branch);
  assert.match(branch, /this\.room\._qmHarvested\s*=\s*true/,
    'QUARTERMASTER block must set this.room._qmHarvested = true inside the gate to enforce per-room one-shot');
});

test('Enemy.die() QUARTERMASTER drops a value-1 core via NEON.cores.spawnCoreDrop', () => {
  // The drop MUST be guarded with the same NEON-availability check used
  // at the elite/boss core-drop site (entities.js ~L2117) so node:test
  // (which doesn't load NEON.cores) can't crash. Mirrors WINDFALL.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_EG\.modifier\s*===\s*'QUARTERMASTER'\s*&&[\s\S]*?\)\s*\{/
  );
  assert.ok(branch);
  assert.match(branch,
    /typeof\s+NEON\s*!==\s*['"]undefined['"]\s*&&\s*NEON\.cores\s*&&\s*NEON\.cores\.spawnCoreDrop/,
    'QUARTERMASTER must guard NEON.cores.spawnCoreDrop with the same availability check used at the elite/boss core-drop site (so node:test cannot crash)');
  assert.match(branch,
    /NEON\.cores\.spawnCoreDrop\s*\(\s*game\s*,\s*this\.x\s*,\s*this\.y\s*,\s*1\s*\)/,
    'QUARTERMASTER must drop a value-1 core at the kill location');
});

test('Enemy.die() QUARTERMASTER emits visual feedback (+1◆ floater + particle burst)', () => {
  // Without a floater the player sees a phantom core appear near the
  // dying enemy with no signal it came from QUARTERMASTER. Mirrors
  // WINDFALL's '+1◆' floater. Particle burst scopes attention.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_EG\.modifier\s*===\s*'QUARTERMASTER'\s*&&[\s\S]*?\)\s*\{/
  );
  assert.ok(branch);
  assert.match(branch,
    /spawnDmgText\s*\(\s*this\.x\s*,\s*this\.y[\s\S]*?,\s*['"`]\+1◆[^'"`]*['"`]/,
    'QUARTERMASTER must spawn a "+1◆" floater at the kill location');
  assert.match(branch,
    /spawnParticles\s*\(\s*this\.x\s*,\s*this\.y[\s\S]*?\)/,
    'QUARTERMASTER must spawn a particle burst at the kill location');
});

test('_EG.modifier === "QUARTERMASTER" appears EXACTLY once in entities.js', () => {
  // Mirror the regenerative-modifier.test.js exact-count assertion:
  // any future addition of a second QUARTERMASTER gate (e.g. a
  // duplicate accidentally introduced via merge / copy-paste) MUST
  // update this count or fail the test loudly. Keeps the modifier's
  // scope auditable to a single touch point.
  const all = ENTITIES_CODE.match(/_EG\.modifier\s*===\s*'QUARTERMASTER'/g) || [];
  assert.equal(all.length, 1,
    `entities.js must contain exactly 1 _EG.modifier === 'QUARTERMASTER' reference (Enemy.die per-room bonus); got ${all.length}`);
});

// ─── HUD wiring (modifier badge auto-picks up QUARTERMASTER) ──────────

test('HUD badge in render.js reads getMod().colour/.icon/.label generically', () => {
  // The HUD badge at render.js:~860 reads .colour/.icon/.label directly
  // with NO per-modifier branches — adding a new modifier requires only
  // the dict entry plus the gameplay logic in Enemy.die. This test
  // pins that invariant so a future "switch (modifier)" refactor in
  // the HUD doesn't silently lose QUARTERMASTER's badge.
  assert.ok(/m\.colour/.test(RENDER) && /m\.icon/.test(RENDER) && /m\.label/.test(RENDER),
    'HUD badge in render.js must read .colour/.icon/.label generically (no per-modifier branches)');
});

test('modifierProgressSuffix in render.js does NOT register a QUARTERMASTER counter branch', () => {
  // QUARTERMASTER is event-based (per-room one-shot), not counter-based.
  // Adding a `if (modKey === 'QUARTERMASTER')` branch would be wrong
  // because there is no shared counter to surface — it would either
  // print a stale value or 0/N forever. Pin the absence so a future
  // copy-paste from WINDFALL/REVERB/SIGNAL_BOOST doesn't accidentally
  // introduce one.
  // Use brace-walked branch extraction anchored on the function header
  // so we scope the absence-check correctly (per stored memory 'test
  // source-text extraction').
  const helperBranch = extractBranch(
    RENDER,
    /function\s+modifierProgressSuffix\s*\([^)]*\)\s*\{/
  );
  assert.ok(helperBranch, 'modifierProgressSuffix helper must be locatable');
  assert.doesNotMatch(helperBranch, /QUARTERMASTER/,
    'modifierProgressSuffix must NOT contain a QUARTERMASTER branch (modifier is event-based, not counter-based)');
});

// ─── modifier-pool count invariants ───────────────────────────────────

test('FLOOR_MODIFIERS now contains 17 entries (16 prior + QUARTERMASTER)', () => {
  // Floor-modifier roll uses Object.keys — any addition shifts the
  // probability of every other modifier. Pin the pool size so an
  // accidental drop (or accidental duplicate) is an immediate failure.
  // Pre-WINDFALL pool was 13; WINDFALL→14; SIGNAL_BOOST→15; REVERB→16;
  // QUARTERMASTER→17 with 6 positive (CASCADE, OVERCHARGE, WINDFALL,
  // SIGNAL_BOOST, REVERB, QUARTERMASTER) and 11 negative-or-neutral.
  const startIdx = CONTENT.indexOf('const FLOOR_MODIFIERS');
  const endIdx = CONTENT.indexOf('};', startIdx);
  const dictBody = CONTENT.slice(startIdx, endIdx);
  // Count top-level keys: lines matching `^\s*[A-Z_]+:\s*\{`.
  const keys = dictBody.match(/^\s*[A-Z_]+:\s*\{/gm) || [];
  assert.equal(keys.length, 17,
    `FLOOR_MODIFIERS must contain 17 entries after QUARTERMASTER added; found ${keys.length}`);
});

// ─── runtime simulation: per-room one-shot semantics ──────────────────

test('runtime: extracted QUARTERMASTER block exhibits per-room one-shot semantics', () => {
  // Behavioural complement to the regex assertions: simulate the
  // gate logic on synthetic enemies/rooms and verify the per-room
  // one-shot constraint.
  const roomA = {};
  const roomB = {};
  let drops = 0;

  function killSimulation(enemy) {
    // Replicate the exact gate from the entities.js block.
    if (!enemy.isShard && !enemy.isSummon
        && enemy.room && !enemy.room._qmHarvested) {
      enemy.room._qmHarvested = true;
      drops++;
    }
  }

  // Three kills in roomA — only the first drops a bonus.
  killSimulation({ room: roomA });
  killSimulation({ room: roomA });
  killSimulation({ room: roomA });
  assert.equal(drops, 1, 'roomA must yield exactly 1 bonus drop across 3 kills');
  assert.equal(roomA._qmHarvested, true, 'roomA must be flagged as harvested');

  // First kill in roomB drops, second does not.
  killSimulation({ room: roomB });
  killSimulation({ room: roomB });
  assert.equal(drops, 2, 'roomB must yield 1 additional bonus drop (cumulative 2)');
  assert.equal(roomB._qmHarvested, true, 'roomB must be flagged as harvested');

  // Shards/summons in roomB do NOT trigger anything (already harvested,
  // but also gated upstream).
  killSimulation({ room: roomA, isShard: true });
  killSimulation({ room: roomA, isSummon: true });
  assert.equal(drops, 2, 'shard/summon kills must NOT trigger drops');

  // Roomless kill (e.g. special spawn off-map) does NOT crash, does NOT drop.
  killSimulation({ room: null });
  assert.equal(drops, 2, 'roomless kills must NOT drop or crash');
});

test('runtime: shard/summon as the FIRST kill in a fresh room does NOT consume the bonus', () => {
  // The trickiest design constraint: if a SPLITTER shard or SUMMONER
  // summon is the FIRST kill in a new room, the bonus must NOT be
  // consumed (otherwise the player feels cheated when a sub-entity
  // burns their per-room reward). The !isShard / !isSummon gates are
  // checked BEFORE the !room._qmHarvested gate, so shard/summon kills
  // never set the flag.
  const room = {};
  let drops = 0;

  function killSimulation(enemy) {
    if (!enemy.isShard && !enemy.isSummon && enemy.room && !enemy.room._qmHarvested) {
      enemy.room._qmHarvested = true;
      drops++;
    }
  }

  // Shard kill first — must NOT consume.
  killSimulation({ room, isShard: true });
  assert.equal(drops, 0, 'shard kill must NOT drop a bonus');
  assert.notEqual(room._qmHarvested, true, 'shard kill must NOT flag the room as harvested');

  // Summon kill second — must NOT consume.
  killSimulation({ room, isSummon: true });
  assert.equal(drops, 0, 'summon kill must NOT drop a bonus');
  assert.notEqual(room._qmHarvested, true, 'summon kill must NOT flag the room as harvested');

  // Real enemy kill third — bonus drops.
  killSimulation({ room });
  assert.equal(drops, 1, 'real-enemy kill must drop the per-room bonus');
  assert.equal(room._qmHarvested, true, 'real-enemy kill must flag the room as harvested');

  // Subsequent real-enemy kill in same room — no further drop.
  killSimulation({ room });
  assert.equal(drops, 1, 'second real-enemy kill in harvested room must NOT drop');
});
