'use strict';
// CASCADE floor modifier — source-text wiring tests.
//
// CASCADE is the FIRST POSITIVE floor modifier in NEON DUNGEON's
// FLOOR_MODIFIERS pool — every prior modifier (BLACKOUT, SWARM,
// FORTIFIED, VOLATILE, SCRAMBLED, OVERCLOCK, CORROSIVE, CHARGED,
// FRAGILE, HUNTER, REGENERATIVE) is negative-or-neutral for the
// player. Each qualifying defeat within 4 tiles of the player heals
// +5 HP. Encourages aggressive engagement — camping at long range
// earns nothing.
//
// content.js / entities.js are browser-only (no UMD/CommonJS exports),
// so we can't load Enemy.die() / FLOOR_MODIFIERS directly under
// node:test. Instead, these tests assert the structural invariants
// any working CASCADE modifier must satisfy:
//   - Registry shape (label/desc/colour/icon) so MODIFIER_KEYS picks
//     it up and the HUD badge in render.js renders correctly.
//   - The on-kill gates (modifier === 'CASCADE' / !isShard / !isSummon
//     / dist < 4) so summons/shards/distant kills don't trigger.
//   - The heal arithmetic (Math.min clamp) so hp can't exceed maxHp.
//   - Visual feedback (#44ff88 dmgText '+5' + particle burst).
//
// Each check fails loudly the moment a refactor drops a wire — same
// silent-removal failure mode that bit RECOIL/SHOCK_PULSE/HUNTER reviews
// and motivated the brace-walked extractBranch helper.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assertModifierIsTopLevelKey } = require('./_modifier-pool');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
);
const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);

// Strip /* ... */ and // ... comments so source-text regex assertions
// match against EXECUTABLE source, not commentary that incidentally
// quotes the gate token. Pattern from tests/{piercing-heart,siphon,
// staggering,greedy,lucky,salvage,mark,deadly}-affix.test.js
// (per stored memory 'test regex pitfalls').
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const ENTITIES_CODE = stripComments(ENTITIES);

// Brace-walked branch extraction: find the opener regex, then walk
// braces to the matching close. Used to scope absence-checks INSIDE a
// specific if-branch so a regression in one branch isn't masked by
// similar text in a neighbouring branch. Pattern from
// tests/{execute,recoil,mark,staggering,piercing-heart}-affix.test.js
// (per stored memory 'test source-text extraction').
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

// Brace-walked entry extraction for registry entries (KEY: { ... }).
// Naive /KEY:\s*\{[^}]*\}/ over-stops at any inner `{...}` close-brace.
// Pattern from tests/deadly-affix.test.js / tests/piercing-heart-affix.test.js
// (per stored memory 'test source-text extraction').
/**
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

test('CASCADE is registered in FLOOR_MODIFIERS with label/desc/colour/icon', () => {
  // The shape must match the existing modifier records (label/desc/
  // colour/icon) so the HUD badge in render.js (line ~860) can render
  // it without per-modifier branches. Brace-walked extractEntry is
  // mandatory because any nested object literal in a future field
  // would over-stop a naive regex.
  const entry = extractEntry(CONTENT, /CASCADE:/);
  assert.ok(entry, 'CASCADE entry must be locatable in FLOOR_MODIFIERS');
  assert.match(entry, /label:\s*'CASCADE'/,
    "CASCADE must carry label:'CASCADE'");
  assert.match(entry, /desc:\s*'[^']+'/,
    'CASCADE must carry a non-empty desc string');
  assert.match(entry, /colour:\s*'#[0-9a-fA-F]+'/,
    'CASCADE must carry a hex colour');
  assert.match(entry, /icon:\s*'[^']+'/,
    'CASCADE must carry an icon glyph');
});

test('CASCADE is a top-level key inside FLOOR_MODIFIERS (so MODIFIER_KEYS picks it up)', () => {
  // MODIFIER_KEYS = Object.keys(FLOOR_MODIFIERS) is what game.js's
  // floor-roll consults at line ~190. If CASCADE somehow ends up
  // outside the dict (e.g., a nested field of another modifier or in
  // a different namespace), it would be defined but never rolled.
  assertModifierIsTopLevelKey(CONTENT, 'CASCADE');
});

test('Enemy.die() reads _EG.modifier === "CASCADE" as the top-level gate', () => {
  // The pulse must be wired through the canonical _EG.modifier global
  // (the same global VOLATILE/SWARM/CORROSIVE branches consult). A
  // typo to game.modifier or this.modifier would silently disable
  // the modifier in the on-kill path.
  assert.match(ENTITIES_CODE, /_EG\.modifier\s*===\s*'CASCADE'/,
    "Enemy.die() must gate the CASCADE pulse on _EG.modifier === 'CASCADE'");
});

test('CASCADE pulse skips summons and shards (defense in depth — bounds rate)', () => {
  // Without the !isShard gate, a SPLITTER's shard chain would let one
  // entry kill produce 2-4 heals from a single engagement. Without
  // !isSummon, a SUMMONER farm would turn into a permanent regen
  // aura. Mirrors the elite/boss-core-drop and PIERCING_HEART/
  // LUCKY/SALVAGE on-kill gates upstream. Brace-walked extraction
  // anchored on the controlling if-header keeps the assertion scoped
  // to the CASCADE branch only.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_EG\.modifier\s*===\s*'CASCADE'\s*&&[\s\S]*?\)\s*\{/
  );
  assert.ok(branch, 'CASCADE if-branch must be locatable by its controlling if-header');
  assert.match(branch, /!\s*this\.isShard/,
    'CASCADE block must skip this.isShard');
  assert.match(branch, /!\s*isSummon/,
    'CASCADE block must skip isSummon');
});

test('CASCADE applies a 4-tile distance gate (positional engagement reward)', () => {
  // The radius is the entire balance lever. Without it CASCADE becomes
  // a floor-wide passive regen — kill anything anywhere, get HP back —
  // which trivialises floor 9-12 attrition. 4 tiles = ~half a small
  // room: the heal is coupled to the player's actual engagement,
  // rewarding aggressive play vs camping. Pin the literal so a
  // re-tune is caught in review.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_EG\.modifier\s*===\s*'CASCADE'\s*&&[\s\S]*?\)\s*\{/
  );
  assert.ok(branch, 'CASCADE branch must be locatable');
  assert.match(branch, /dist\(\s*_EG\.player\.x\s*,\s*_EG\.player\.y\s*,\s*this\.x\s*,\s*this\.y\s*\)\s*<\s*4\b/,
    'CASCADE must gate on dist(player, this) < 4 for positional engagement');
});

test('CASCADE heals +5 HP clamped to maxHp (cannot overheal)', () => {
  // The Math.min clamp is the invariant — without it, CASCADE could
  // push hp above maxHp, breaking damage-bar rendering and any code
  // that assumes the invariant. The +5 value is design — comparable
  // to SCAVENGER_NANITES's 5@10% but unconditional within radius.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_EG\.modifier\s*===\s*'CASCADE'\s*&&[\s\S]*?\)\s*\{/
  );
  assert.ok(branch, 'CASCADE branch must be locatable');
  assert.match(branch, /Math\.min\(\s*[\w.]+\.maxHp\s*,\s*[\w.]+\.hp\s*\+\s*5\s*\)/,
    'CASCADE must heal +5 clamped via Math.min(maxHp, hp+5)');
});

test('CASCADE only heals when player is below maxHp (avoids dead "+5" tells at full HP)', () => {
  // Surfacing a "+5 HP" damage text when the player is already at full
  // HP would be a misleading visual — the heal does nothing, but the
  // tell suggests it did. Gate the heal+tell on hp < maxHp so a player
  // at full HP only sees the particle burst (the modifier indicator)
  // without a phantom "+5". Standard pattern across heal-on-kill
  // augments and perks.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_EG\.modifier\s*===\s*'CASCADE'\s*&&[\s\S]*?\)\s*\{/
  );
  assert.ok(branch, 'CASCADE branch must be locatable');
  assert.match(branch, /[\w.]+\.hp\s*<\s*[\w.]+\.maxHp/,
    'CASCADE must check hp < maxHp before applying the heal/tell');
});

test('CASCADE emits "+5" damage text and #44ff88 particles as feedback', () => {
  // Visual feedback: a "+5" dmgText near the player so the heal is
  // legible against the full HP bar, plus a #44ff88 particle burst
  // at the enemy death position so the player can correlate which
  // kill triggered the pulse. The colour matches the modifier badge
  // in render.js so the visual identity is consistent.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_EG\.modifier\s*===\s*'CASCADE'\s*&&[\s\S]*?\)\s*\{/
  );
  assert.ok(branch, 'CASCADE branch must be locatable');
  assert.match(branch, /spawnDmgText\([^)]*'\+5'/,
    'CASCADE must spawn a "+5" dmg text on heal');
  assert.match(branch, /spawnParticles\([^)]*'#44ff88'/,
    'CASCADE must emit #44ff88 particles as the modifier tell');
});

test('CASCADE colour matches HUD palette (#44ff88, distinct from REGENERATIVE #44ddaa)', () => {
  // The HUD modifier badge in render.js (line ~860) reads modifier.colour
  // directly. CASCADE picks a cyan-green (#44ff88) so it's visually
  // distinct from REGENERATIVE's #44ddaa (which is also cyan-green but
  // muted) — players need to tell at a glance whether the modifier is
  // "patrol heal" (REGENERATIVE, bad) or "your heal" (CASCADE, good).
  // Without distinct hues, the colour-coded HUD becomes ambiguous.
  const entry = extractEntry(CONTENT, /CASCADE:/);
  assert.ok(entry, 'CASCADE entry must be locatable');
  assert.match(entry, /colour:\s*'#44ff88'/,
    "CASCADE colour must be #44ff88 (distinct from REGENERATIVE's #44ddaa)");
});

test('CASCADE on-kill block is contained within Enemy.die() (not a stray top-level)', () => {
  // The block must live INSIDE the die() body, not as a free-floating
  // module-scope statement. Anchor by ensuring the modifier check
  // appears AFTER the die() declaration AND the closing brace of the
  // last sibling on-kill block (ADRENALINE_INJECTOR augment, which
  // immediately precedes ours topologically). A misplaced statement
  // would compile but never execute on kill.
  const dieIdx = ENTITIES_CODE.indexOf("die() {");
  const cascadeIdx = ENTITIES_CODE.indexOf("_EG.modifier === 'CASCADE'");
  assert.ok(dieIdx !== -1, 'Enemy.die() must be locatable');
  assert.ok(cascadeIdx > dieIdx,
    'CASCADE on-kill block must appear AFTER Enemy.die() opening — ensures it lives inside die()');
});
