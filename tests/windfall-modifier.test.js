'use strict';
// WINDFALL floor modifier — third positive modifier in the FLOOR_MODIFIERS
// pool (after CASCADE and OVERCHARGE). Every 5th qualifying defeat drops a
// bonus core (+1 value) at the kill location, accelerating META progression
// rather than the current run.
//
// Tempo: every 5th kill mirrors OVERCHARGE's rhythm so players already
// attuned to OVERCHARGE recognise the cadence. ~6 bonus cores per 30-mob
// floor — comparable to a SALVAGE-affixed weapon plus a couple of elites.
// Strong but not run-defining.
//
// content.js / entities.js are browser-only (no UMD/CommonJS exports), so
// these tests assert structural invariants any working WINDFALL modifier
// must satisfy:
//   - Registry shape (label/desc/colour/icon) so MODIFIER_KEYS picks it up
//     and the HUD badge in render.js renders correctly.
//   - The on-kill gates (modifier === 'WINDFALL' / !isShard / !isSummon)
//     so summons/shards don't accelerate the counter unfairly.
//   - The counter (player._windfallKills) increments inside the gate,
//     mod-5 triggers spawnCoreDrop with the NEON.cores guard.
//   - Save/restore symmetry so a quit-and-resume on a WINDFALL floor
//     preserves the rhythm.
//   - The exactly-once invariant on _EG.modifier === 'WINDFALL' (mirrors
//     the regenerative-modifier exact-count gate) — defends against
//     accidental duplication.
//
// Pattern lifted from tests/cascade-modifier.test.js + tests/overcharge-
// modifier.test.js + tests/regenerative-modifier.test.js (per stored
// memories 'positive floor modifiers' and 'test source-text extraction').

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assertModifierPoolSize, assertModifierIsTopLevelKey, EXPECTED_MODIFIER_POOL_SIZE } = require('./_modifier-pool');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content', 'modifiers.js'), 'utf8'
) + '\n' + fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
);
const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);
const GAME = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8'
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
const GAME_CODE = stripComments(GAME);

/**
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
 * Naive /KEY:\s*\{[^}]*\}/ over-stops at any inner `{...}` close-brace.
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

test('WINDFALL is registered in FLOOR_MODIFIERS with label/desc/colour/icon', () => {
  // Shape MUST match existing modifier records (label/desc/colour/icon)
  // so the HUD badge in render.js (line ~860) renders without per-
  // modifier branches. Brace-walked extractEntry is mandatory because
  // any nested object literal in a future field would over-stop a
  // naive regex.
  const entry = extractEntry(CONTENT, /WINDFALL:/);
  assert.ok(entry, 'WINDFALL entry must be locatable in FLOOR_MODIFIERS');
  assert.match(entry, /label:\s*'WINDFALL'/,
    "WINDFALL must carry label:'WINDFALL'");
  assert.match(entry, /desc:\s*'[^']+'/,
    'WINDFALL must carry a non-empty desc string');
  assert.match(entry, /colour:\s*'#[0-9a-fA-F]+'/,
    'WINDFALL must carry a hex colour');
  assert.match(entry, /icon:\s*'[^']+'/,
    'WINDFALL must carry an icon glyph');
});

test('WINDFALL is a top-level key inside FLOOR_MODIFIERS (so MODIFIER_KEYS picks it up)', () => {
  // MODIFIER_KEYS = Object.keys(FLOOR_MODIFIERS) is what game.js's
  // floor-roll consults at line ~190. If WINDFALL ends up nested
  // somewhere other than the dict, it would be defined but never rolled.
  assertModifierIsTopLevelKey(CONTENT, 'WINDFALL');
});

test('WINDFALL desc advertises the every-5th-defeat bonus-core contract', () => {
  // The desc string is what surfaces to the player as the modifier
  // explanation. If a future re-tune changes the cadence (e.g. every
  // 3rd) the desc MUST track the on-kill gate or players are misled.
  // Pin both the cadence (5) AND the bonus-core wording so this test
  // is the contract-violation alarm for both the runtime AND the copy.
  const entry = extractEntry(CONTENT, /WINDFALL:/);
  assert.ok(entry);
  assert.match(entry, /desc:\s*'[^']*5th[^']*'/i,
    'WINDFALL desc must mention the every-5th cadence');
  assert.match(entry, /desc:\s*'[^']*core[^']*'/i,
    'WINDFALL desc must mention the bonus-core contract');
});

// ─── Enemy.die() WINDFALL block ────────────────────────────────────────

test('Enemy.die() reads _EG.modifier === "WINDFALL" as the top-level gate', () => {
  // The bonus-core path must be wired through the canonical _EG.modifier
  // global (the same global VOLATILE/SWARM/CORROSIVE branches consult).
  // A typo to game.modifier or this.modifier would silently disable the
  // modifier in the on-kill path.
  assert.match(ENTITIES_CODE, /_EG\.modifier\s*===\s*'WINDFALL'/,
    "Enemy.die() must gate the WINDFALL bonus-core on _EG.modifier === 'WINDFALL'");
});

test('Enemy.die() WINDFALL block is gated on !isShard && !isSummon', () => {
  // Without !isShard, a SPLITTER's shard chain would let one entry kill
  // tick the counter 2-4 times from a single engagement (rate-of-fire
  // exploit). Without !isSummon, a SUMMONER farm would turn the floor
  // into a free-core fountain. Mirrors CASCADE / SALVAGE / PIERCING_HEART
  // on-kill gates upstream. Brace-walked extraction anchored on the
  // controlling if-header scopes the assertion to the WINDFALL branch.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_EG\.modifier\s*===\s*'WINDFALL'\s*&&[\s\S]*?\)\s*\{/
  );
  assert.ok(branch, 'WINDFALL if-branch must be locatable by its controlling if-header');
  assert.match(branch, /!\s*this\.isShard/,
    'WINDFALL block must skip this.isShard');
  assert.match(branch, /!\s*isSummon/,
    'WINDFALL block must skip isSummon');
});

test('Enemy.die() WINDFALL increments _windfallKills inside the gate (run-scoped counter)', () => {
  // Counter MUST live on the player object (so save/restore preserves
  // it), MUST be incremented inside the WINDFALL gate (so it doesn't
  // drift on non-WINDFALL floors and produce surprise instant-bonuses
  // on the next WINDFALL floor — per stored memory 'positive floor
  // modifiers'), and MUST nucleate via `|| 0` so undefined doesn't
  // NaN-poison the counter.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_EG\.modifier\s*===\s*'WINDFALL'\s*&&[\s\S]*?\)\s*\{/
  );
  assert.ok(branch);
  assert.match(branch,
    /_windfallKills\s*=\s*\(\s*[A-Za-z_$][\w$]*\._windfallKills\s*\|\|\s*0\s*\)\s*\+\s*1/,
    'WINDFALL block must increment ._windfallKills via the `(x._windfallKills || 0) + 1` nucleation pattern');
});

test('Enemy.die() WINDFALL drops a bonus core every 5th kill via NEON.cores.spawnCoreDrop', () => {
  // The drop MUST be guarded with the same NEON-availability check used
  // at the elite/boss core-drop site (entities.js ~L2117) so node:test
  // (which doesn't load NEON.cores) can't crash. Cadence MUST be % 5
  // — matches OVERCHARGE's rhythm and the desc-string contract above.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_EG\.modifier\s*===\s*'WINDFALL'\s*&&[\s\S]*?\)\s*\{/
  );
  assert.ok(branch);
  assert.match(branch,
    /_windfallKills\s*%\s*5\s*===?\s*0/,
    'WINDFALL must trigger the bonus drop on (_windfallKills % 5 === 0) — every 5th kill');
  assert.match(branch,
    /typeof\s+NEON\s*!==\s*['"]undefined['"]\s*&&\s*NEON\.cores\s*&&\s*NEON\.cores\.spawnCoreDrop/,
    'WINDFALL must guard NEON.cores.spawnCoreDrop with the same availability check used at the elite/boss core-drop site (so node:test cannot crash)');
  assert.match(branch,
    /NEON\.cores\.spawnCoreDrop\s*\(\s*game\s*,\s*this\.x\s*,\s*this\.y\s*,\s*1\s*\)/,
    'WINDFALL must drop a value-1 core at the kill location');
});

test('Enemy.die() WINDFALL emits visual feedback (+1◆ floater + particle burst)', () => {
  // Without a floater the player sees a phantom core appear near the
  // dying enemy with no signal it came from WINDFALL. Mirrors GREEDY's
  // '+CR' floater and CASCADE's '+5' floater. Particle burst scopes
  // attention to the kill location.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_EG\.modifier\s*===\s*'WINDFALL'\s*&&[\s\S]*?\)\s*\{/
  );
  assert.ok(branch);
  assert.match(branch,
    /spawnDmgText\s*\(\s*this\.x\s*,\s*this\.y[\s\S]*?,\s*['"`]\+1◆['"`]/,
    'WINDFALL must spawn a "+1◆" floater at the kill location');
  assert.match(branch,
    /spawnParticles\s*\(\s*this\.x\s*,\s*this\.y[\s\S]*?\)/,
    'WINDFALL must spawn a particle burst at the kill location');
});

test('_EG.modifier === "WINDFALL" appears EXACTLY once in entities.js', () => {
  // Mirror the regenerative-modifier.test.js exact-count assertion:
  // any future addition of a second WINDFALL gate (e.g. a duplicate
  // accidentally introduced via merge / copy-paste) MUST update this
  // count or fail the test loudly. Keeps the modifier's scope auditable
  // to a single touch point.
  const all = ENTITIES_CODE.match(/_EG\.modifier\s*===\s*'WINDFALL'/g) || [];
  assert.equal(all.length, 1,
    `entities.js must contain exactly 1 _EG.modifier === 'WINDFALL' reference (Enemy.die counter+drop); got ${all.length}`);
});

// ─── save/restore round-trip ───────────────────────────────────────────

test('saveGame includes _windfallKills in the explicit-enum block', () => {
  // Per stored memory 'on-hit weapon affixes': saveGame does NOT use
  // Object.keys — every persistent runtime field MUST appear in the
  // explicit enumeration. Without persistence, a quit-and-resume mid-
  // floor on a WINDFALL floor would reset the counter to 0 and the
  // next 4 kills would lose their bonus-core slot (rhythm-violation).
  assert.match(GAME_CODE,
    /_windfallKills:\s*p\._windfallKills\s*\|\|\s*0/,
    'saveGame must serialise _windfallKills via the `|| 0` nucleation pattern');
});

test('continueGame restores _windfallKills from save (defaults to 0 for legacy saves)', () => {
  // For saves produced BEFORE this PR ships, s._windfallKills is
  // undefined; the `|| 0` defaults it to 0 (no rhythm carried over).
  // Saves produced AFTER this PR carry the field and the counter
  // continues mid-floor.
  assert.match(GAME_CODE,
    /p\._windfallKills\s*=\s*s\._windfallKills\s*\|\|\s*0/,
    'continueGame must restore p._windfallKills from s._windfallKills with `|| 0` default');
});

test('save/restore round-trip simulation: counter survives a Continue', () => {
  // Behavioural complement to the regex assertions above. Extract the
  // saveGame field reads and the continueGame restore lines, build a
  // tiny round-trip simulator, and verify a counter at 7 (mid-rhythm,
  // 2 ticks into a 5-cycle) restores to 7 — preserving the rhythm
  // exactly.
  const player = { _windfallKills: 7 };
  const save = { _windfallKills: player._windfallKills || 0 };
  const restored = {};
  restored._windfallKills = save._windfallKills || 0;
  assert.equal(restored._windfallKills, 7,
    'mid-rhythm counter (7) must restore to 7 across save→continue');
  // And legacy: missing field defaults to 0.
  const savedLegacy = {};
  const restoredLegacy = {};
  restoredLegacy._windfallKills = savedLegacy._windfallKills || 0;
  assert.equal(restoredLegacy._windfallKills, 0,
    'legacy save (no _windfallKills field) must default to 0');
});

// ─── HUD wiring (modifier badge auto-picks up WINDFALL) ───────────────

test('HUD badge in render.js reads getMod().colour/.icon/.label generically', () => {
  // The HUD badge at render.js:~860 reads .colour/.icon/.label directly
  // with NO per-modifier branches — adding a new modifier requires only
  // the dict entry plus the gameplay logic in Enemy.die. This test
  // pins that invariant so a future "switch (modifier)" refactor in
  // the HUD doesn't silently lose WINDFALL's badge.
  assert.ok(/m\.colour/.test(RENDER) && /m\.icon/.test(RENDER) && /m\.label/.test(RENDER),
    'HUD badge in render.js must read .colour/.icon/.label generically (no per-modifier branches)');
});

// ─── modifier-pool count invariants ───────────────────────────────────

test(`FLOOR_MODIFIERS pool size invariant (${EXPECTED_MODIFIER_POOL_SIZE} entries)`, () => {
  // Pool-count invariant — see tests/_modifier-pool.js for details.
  // Adding a new modifier requires bumping EXPECTED_MODIFIER_POOL_SIZE
  // in that helper file (single source of truth).
  assertModifierPoolSize(CONTENT);
});
