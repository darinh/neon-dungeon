'use strict';
// PRIMED floor modifier — the 24th entry in the FLOOR_MODIFIERS pool
// and the 13th positive modifier (12 positive vs 11 neg-or-neutral
// becomes 13 vs 11 with PRIMED). PRIMED grants a guaranteed crit on
// the FIRST shot in each room — a per-room one-shot variant of
// OVERCHARGE's "every 5th shot crits", paying out room-by-room
// rather than counter-based.
//
// Wired in Player.shoot in entities.js as a per-room one-shot gate
// next to the existing OVERCHARGE forceCrit block:
//
//   if (_EG.modifier === 'PRIMED' && this._currentRoom
//        && !this._currentRoom._primedFired) {
//     this._currentRoom._primedFired = true;
//     forceCrit = true;
//   }
//
// The gate composes with OVERCHARGE additively (forceCrit |= primedCrit)
// — but floor modifiers are mutually exclusive per floor (only one
// rolls), so PRIMED and OVERCHARGE cannot co-occur in practice. The
// OR semantics keep forceCrit clean if a future change ever relaxes
// that mutex.
//
// Per-room state lives on `room._primedFired` (NOT on player), mirroring
// QUARTERMASTER's `room._qmHarvested` per-room one-shot pattern. The
// dungeon is regenerated from scratch on Continue (rooms array is
// rebuilt — `player._currentRoom` is reset to null per game.js:358),
// so `_primedFired` flags are auto-cleared on save+resume. The
// forgiving re-prime behaviour matches the codebase's "Continue should
// not punish you" stance and is identical to QUARTERMASTER's accepted
// re-harvest behaviour.
//
// content.js / entities.js are browser-only (no UMD/CommonJS exports),
// so these tests assert structural invariants any working PRIMED
// modifier must satisfy:
//   - Registry shape (label/desc/colour/icon).
//   - PRIMED is a top-level key inside FLOOR_MODIFIERS.
//   - The Player.shoot gate uses _EG.modifier (engine-side ref) AND
//     reads `this._currentRoom && !this._currentRoom._primedFired` —
//     room-scoped state, not player-scoped.
//   - The gate SETS the latch BEFORE setting forceCrit (so a future
//     refactor can't accidentally double-fire by reading-then-setting).
//   - forceCrit is set to true (not false, not toggled).
//   - Exactly-once invariant on `_EG.modifier === 'PRIMED'` — defends
//     against accidental duplication.
//   - Pool-count invariant (24 entries — bumps from KINETIC's 23 via
//     EXPECTED_MODIFIER_POOL_SIZE in tests/_modifier-pool.js).
//   - Distinct desc (no collision with OVERCHARGE phrasing).
//   - Auto-fire boosts excluded — PRIMED logic must live INSIDE the
//     Player.shoot function body (auto-fire boosts route through their
//     own paths, not Player.shoot).
//
// NO HUD progress suffix tests: PRIMED is event-based per-room, not
// counter-based. The crit floater itself is the player feedback.
// Mirrors QUARTERMASTER (same per-room one-shot semantics, no HUD).
// A copy-paste from a counter-based modifier (OVERCHARGE 4/5, REVERB
// 4/5, CHAINREACT N/M) would add a phantom progress readout.
//
// Pattern lifted from tests/overflow-modifier.test.js +
// tests/quartermaster-modifier.test.js (per-room state).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assertModifierPoolSize, assertModifierIsTopLevelKey, EXPECTED_MODIFIER_POOL_SIZE } = require('./_modifier-pool');

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

test('PRIMED is registered in FLOOR_MODIFIERS with label/desc/colour/icon', () => {
  const entry = extractEntry(CONTENT, /PRIMED:/);
  assert.ok(entry, 'PRIMED entry must be locatable in FLOOR_MODIFIERS');
  assert.match(entry, /label:\s*'PRIMED'/,
    "PRIMED must carry label:'PRIMED'");
  assert.match(entry, /desc:\s*'[^']+'/,
    'PRIMED must carry a non-empty desc string');
  assert.match(entry, /colour:\s*'#[0-9a-fA-F]+'/,
    'PRIMED must carry a hex colour');
  assert.match(entry, /icon:\s*'[^']+'/,
    'PRIMED must carry an icon glyph');
});

test('PRIMED is a top-level key inside FLOOR_MODIFIERS (so MODIFIER_KEYS picks it up)', () => {
  assertModifierIsTopLevelKey(CONTENT, 'PRIMED');
});

test('PRIMED desc mentions room and crit (so the run-start card tells the player what they get)', () => {
  // The run-start floor-modifier card shows desc verbatim. A modifier
  // that doesn't tell the player what it does makes the surprise crit
  // feel arbitrary on the first shot. Pin the room + crit keywords
  // (case-insensitive — flavour wording can vary).
  const entry = extractEntry(CONTENT, /PRIMED:/);
  assert.ok(entry, 'PRIMED entry must be locatable');
  assert.match(entry, /room/i,
    'PRIMED desc must mention "room" so the player understands the per-room scope');
  assert.match(entry, /crit/i,
    'PRIMED desc must mention "crit" so the player understands the effect');
});

test('PRIMED desc does not collide with OVERCHARGE phrasing', () => {
  // OVERCHARGE is the OTHER modifier that forces crits. A PRIMED desc
  // that reads "every 5th shot" or "guaranteed crit" without the
  // per-room qualifier would collide on the run-start card and be
  // indistinguishable at a glance. Pin that PRIMED's desc names "room"
  // specifically. Mirrors the AUTONOMY/HARDENED collision guards in
  // sibling test files.
  const entry = extractEntry(CONTENT, /PRIMED:/);
  assert.ok(entry, 'PRIMED entry must be locatable');
  assert.doesNotMatch(entry, /5th\s+shot/i,
    'PRIMED desc must not mention "5th shot" — OVERCHARGE already owns that wording.');
});

test('FLOOR_MODIFIERS pool size is exactly 24 (PRIMED added)', () => {
  // Roll-probability invariant. Per stored memory 'positive floor modifiers'
  // and 'modifier pool canary pattern', the EXPECTED_MODIFIER_POOL_SIZE
  // constant in tests/_modifier-pool.js is the single source of truth for
  // this assertion across all *-modifier.test.js files. The canary role
  // for the next-modifier-added literal moved on to tests/jammed-modifier.test.js
  // when JAMMED bumped the pool from 24 → 25 — the literal `assert.equal(
  // EXPECTED_MODIFIER_POOL_SIZE, 24, ...)` that used to live here was
  // retired then to avoid two stale literals chasing the constant
  // (per the 'modifier pool canary pattern' stored memory).
  assertModifierPoolSize(CONTENT);
});

// ─── Player.shoot wiring ─────────────────────────────────────────────────

test('Player.shoot applies PRIMED forceCrit with correct gate (engine ref + per-room scope)', () => {
  // Pin the EXACT wiring: gate must read `_EG.modifier` (the canonical
  // engine floor-modifier ref — `_CG.modifier` would be content.js-side
  // and would silently miss in entities.js), the room-scope guard must
  // be `this._currentRoom && !this._currentRoom._primedFired` (per-room
  // state on the room object, mirroring QUARTERMASTER's `room._qmHarvested`),
  // the latch must be SET BEFORE forceCrit is set (so a future refactor
  // can't accidentally double-fire by reading-then-setting in the wrong
  // order), and forceCrit must be assigned `true` (not toggled, not
  // assigned a multiplier — `forceCrit` is a boolean flag).
  const m = ENTITIES_CODE.match(
    /if\s*\(\s*_EG\.modifier\s*===\s*'PRIMED'\s*&&\s*this\._currentRoom\s*&&\s*!\s*this\._currentRoom\._primedFired\s*\)\s*\{[\s\S]{0,200}?this\._currentRoom\._primedFired\s*=\s*true\s*;[\s\S]{0,100}?forceCrit\s*=\s*true\s*;[\s\S]{0,40}?\}/
  );
  assert.ok(m,
    'Player.shoot must contain `if (_EG.modifier === "PRIMED" && this._currentRoom && !this._currentRoom._primedFired) { this._currentRoom._primedFired = true; forceCrit = true; }` — gate, scope, latch-before-flag order, and boolean assignment must all be present.');
});

test('PRIMED latch is SET before forceCrit is assigned (no read-then-set race)', () => {
  // Defensive ordering check. If a refactor reordered the two
  // assignments to `forceCrit = true; this._currentRoom._primedFired = true;`
  // the behaviour would still be correct in single-threaded JS, BUT
  // any future short-circuit / early-return between them (e.g. an
  // adversarial `if (someGate) return;` injected between the lines)
  // would leave the latch un-set, allowing the next shot in the same
  // room to ALSO crit. Pin the canonical ordering: latch first,
  // flag second.
  const block = ENTITIES_CODE.match(
    /_EG\.modifier\s*===\s*'PRIMED'[\s\S]{0,400}?\}/
  );
  assert.ok(block, 'PRIMED block must be locatable');
  const latchIdx = block[0].indexOf('this._currentRoom._primedFired = true');
  const flagIdx = block[0].indexOf('forceCrit = true');
  assert.ok(latchIdx >= 0, 'latch assignment must exist inside the PRIMED block');
  assert.ok(flagIdx >= 0, 'forceCrit assignment must exist inside the PRIMED block');
  assert.ok(latchIdx < flagIdx,
    'PRIMED must set this._currentRoom._primedFired = true BEFORE forceCrit = true. Reversed ordering would be vulnerable to a future early-return between the lines leaving the room un-latched and re-criting on subsequent shots.');
});

test('PRIMED is referenced exactly once in entities.js', () => {
  // Defends against accidental duplication (copy-paste could double-set
  // the latch or compound forceCrit semantics in unexpected ways).
  // Mirrors the magnetism / regenerative / hardened / overflow / kinetic
  // exactly-once invariant.
  const matches = ENTITIES_CODE.match(/_EG\.modifier\s*===\s*'PRIMED'/g) || [];
  assert.equal(matches.length, 1,
    `PRIMED modifier check must appear exactly once in entities.js (Player.shoot per-room gate). Found ${matches.length}. Duplicate gates would compound state changes in unpredictable ways.`);
});

test('PRIMED state lives on the ROOM, not on the player (per-room scope)', () => {
  // The latch MUST be `this._currentRoom._primedFired` — a room-scoped
  // flag — NOT `this._primedFired` (player-scoped, would only fire
  // once per RUN, defeating the per-room semantics) and NOT
  // `this._primedRoom` (would conflate with stale-room references
  // post-resume). Defends against a refactor accidentally moving the
  // state to the player.
  const block = ENTITIES_CODE.match(
    /_EG\.modifier\s*===\s*'PRIMED'[\s\S]{0,400}?\}/
  );
  assert.ok(block, 'PRIMED block must be locatable');
  // Must contain the room-scoped latch (gate-read AND set-write).
  assert.match(block[0], /!\s*this\._currentRoom\._primedFired/,
    'PRIMED gate must read `!this._currentRoom._primedFired` — room-scoped state.');
  assert.match(block[0], /this\._currentRoom\._primedFired\s*=\s*true/,
    'PRIMED latch must SET `this._currentRoom._primedFired = true` — room-scoped state.');
  // Must NOT contain a player-scoped variant. Match-anywhere, not the
  // canonical room-scoped one (which already passed above).
  assert.doesNotMatch(block[0], /this\._primedFired\b(?![\s\S]*?this\._currentRoom\._primedFired)/,
    'PRIMED must NOT use a player-scoped `this._primedFired` field — that would only fire once per RUN, not once per ROOM.');
});

test('PRIMED gate guards against null _currentRoom (corridor shooting safety)', () => {
  // The player can fire from a corridor where `_currentRoom` is null
  // (the per-frame room-detection scan in game.js:1393-1414 only sets
  // `_currentRoom` when the player position is inside a room rect).
  // Without the `this._currentRoom &&` short-circuit guard, the
  // `!this._currentRoom._primedFired` read would throw "Cannot read
  // properties of null" the first time the player shoots from a corridor.
  // Pin the short-circuit guard explicitly.
  const block = ENTITIES_CODE.match(
    /_EG\.modifier\s*===\s*'PRIMED'[\s\S]{0,400}?\}/
  );
  assert.ok(block, 'PRIMED block must be locatable');
  assert.match(block[0], /this\._currentRoom\s*&&\s*!\s*this\._currentRoom\._primedFired/,
    'PRIMED gate must short-circuit on null _currentRoom (`this._currentRoom && !this._currentRoom._primedFired`). Without it, shooting from a corridor (where _currentRoom is null per game.js:1393-1414) would throw "Cannot read properties of null".');
});

test('PRIMED block lives inside Player.shoot (auto-fire boosts excluded)', () => {
  // Auto-fire boosts (AUTO_LASER, SENTRY_DRONE, PLASMA_ORB, SAW_BLADE)
  // do NOT route through Player.shoot — they fire through their own
  // paths and intentionally bypass intentional-shoot-only gates
  // (DEADEYE, OVERCHARGE counter, REVERB counter). PRIMED MUST live
  // inside Player.shoot to inherit this exclusion. Pin that the
  // PRIMED gate is co-located with the OVERCHARGE block (which lives
  // in Player.shoot per the doc comment).
  const m = ENTITIES_CODE.match(
    /if\s*\(\s*_EG\.modifier\s*===\s*'OVERCHARGE'[\s\S]{0,400}?if\s*\(\s*_EG\.modifier\s*===\s*'PRIMED'/
  );
  assert.ok(m,
    'PRIMED block must be co-located with the OVERCHARGE block inside Player.shoot — that is the canonical intentional-shoot-only site. Auto-fire boosts (AUTO_LASER, SENTRY_DRONE, etc.) route through other paths and must remain excluded.');
});

// ─── HUD render.js: NO progress suffix (event-based, not counter-based) ──

test('modifierProgressSuffix does NOT include PRIMED (event-based, no counter)', () => {
  // Mirrors QUARTERMASTER's "no HUD progress" rationale: PRIMED is
  // per-room one-shot, not counter-based. The crit floater itself
  // ("CRIT!" via spawnDmgText in the melee/ranged branches) is the
  // player feedback — same as QUARTERMASTER's "+1◆ QM" floater. A
  // copy-paste from a counter-based modifier (OVERCHARGE 4/5, REVERB
  // 4/5, CHAINREACT N/M) would add a phantom progress readout that
  // never advances meaningfully (would just toggle ready/spent).
  const fnMatch = RENDER.match(/function\s+modifierProgressSuffix\b[\s\S]*?\n\}/);
  if (!fnMatch) {
    assert.fail('modifierProgressSuffix function not found in render.js — anchor regression?');
  }
  assert.doesNotMatch(fnMatch[0], /PRIMED/,
    'modifierProgressSuffix must NOT contain a PRIMED branch — PRIMED is event-based per-room (mirrors QUARTERMASTER). The crit floater itself is the feedback.');
});
