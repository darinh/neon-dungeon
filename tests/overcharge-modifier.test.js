'use strict';
// OVERCHARGE floor modifier — source-text wiring tests.
//
// OVERCHARGE is the SECOND POSITIVE floor modifier in NEON DUNGEON's
// FLOOR_MODIFIERS pool (CASCADE was the first). On an OVERCHARGE
// floor, every 5th player shot fires as a guaranteed crit — applies
// uniformly to melee, ranged main projectiles, and the MULTI_SHOT
// bonus projectile within a single trigger pull. Auto-fire boosts
// (AUTO_LASER, SENTRY_DRONE, PLASMA_ORB, SAW_BLADE) are intentionally
// excluded — they don't route through Player.shoot, mirroring the
// DEADEYE perk's intentional-shoot-only scope.
//
// content.js / entities.js are browser-only (no UMD/CommonJS exports),
// so we can't load Player.shoot() / FLOOR_MODIFIERS directly under
// node:test. Instead, these tests assert the structural invariants
// any working OVERCHARGE modifier must satisfy:
//   - Registry shape (label/desc/colour/icon) so MODIFIER_KEYS picks
//     it up and the HUD badge in render.js renders correctly.
//   - The shoot-time gates (modifier === 'OVERCHARGE' / counter % 5
//     === 0) so the rhythm is correct and not modifier-leaky.
//   - The forceCrit OR is wired into ALL THREE crit-roll sites
//     (melee, ranged main, MULTI_SHOT bonus) — a regression that
//     drops one would silently make OVERCHARGE behave inconsistently
//     across weapon types.
//   - Save/restore wiring in game.js so save/resume preserves the
//     rhythm (otherwise mid-floor save would lose 4 shots of cycle).
//
// Each check fails loudly the moment a refactor drops a wire — same
// silent-removal failure mode that bit RECOIL/SHOCK_PULSE/HUNTER
// reviews and motivated the brace-walked extractBranch helper.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assertModifierIsTopLevelKey } = require('./_modifier-pool');

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

// Strip /* ... */ and // ... comments so source-text regex assertions
// match against EXECUTABLE source, not commentary that incidentally
// quotes the gate token. Pattern from tests/cascade-modifier.test.js
// (per stored memory 'test regex pitfalls').
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const ENTITIES_CODE = stripComments(ENTITIES);
const GAME_CODE = stripComments(GAME);

// Brace-walked branch extraction: find the opener regex, then walk
// braces to the matching close. Used to scope absence-checks and
// presence-checks INSIDE a specific if-branch. Pattern from
// tests/cascade-modifier.test.js (per stored memory 'test source-text
// extraction').
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
// Pattern from tests/cascade-modifier.test.js (per stored memory
// 'test source-text extraction').
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

test('OVERCHARGE is registered in FLOOR_MODIFIERS with label/desc/colour/icon', () => {
  // The shape must match the existing modifier records (label/desc/
  // colour/icon) so the HUD badge in render.js (line ~860) can render
  // it without per-modifier branches. Brace-walked extractEntry is
  // mandatory because any nested object literal in a future field
  // would over-stop a naive regex.
  const entry = extractEntry(CONTENT, /OVERCHARGE:/);
  assert.ok(entry, 'OVERCHARGE entry must be locatable in FLOOR_MODIFIERS');
  assert.match(entry, /label:\s*'OVERCHARGE'/,
    "OVERCHARGE must carry label:'OVERCHARGE'");
  assert.match(entry, /desc:\s*'[^']+'/,
    'OVERCHARGE must carry a non-empty desc string');
  assert.match(entry, /colour:\s*'#[0-9a-fA-F]+'/,
    'OVERCHARGE must carry a hex colour');
  assert.match(entry, /icon:\s*'[^']+'/,
    'OVERCHARGE must carry an icon glyph');
});

test('OVERCHARGE is a top-level key inside FLOOR_MODIFIERS (so MODIFIER_KEYS picks it up)', () => {
  // MODIFIER_KEYS = Object.keys(FLOOR_MODIFIERS) is what game.js's
  // floor-roll consults at line ~190. If OVERCHARGE somehow ends up
  // outside the dict (e.g., a nested field of another modifier or in
  // a different namespace), it would be defined but never rolled.
  assertModifierIsTopLevelKey(CONTENT, 'OVERCHARGE');
});

test('OVERCHARGE colour is distinct from OVERCLOCK (#ffcc00) so the HUD palette stays unambiguous', () => {
  // OVERCLOCK is the existing NEGATIVE speed modifier (#ffcc00 — yellow);
  // OVERCHARGE is a POSITIVE crit-rhythm modifier. Both names start with
  // "OVER" and both want a yellow-ish "electric" hue. To keep the HUD
  // badge readable at a glance (positive vs negative tell), they MUST
  // use different hex values. Pin the literal so a paste-typo regresses
  // visibly.
  const entry = extractEntry(CONTENT, /OVERCHARGE:/);
  assert.ok(entry, 'OVERCHARGE entry must be locatable');
  const colourMatch = entry.match(/colour:\s*'(#[0-9a-fA-F]+)'/);
  assert.ok(colourMatch, 'OVERCHARGE must carry a hex colour literal');
  assert.notStrictEqual(colourMatch[1].toLowerCase(), '#ffcc00',
    'OVERCHARGE colour must NOT collide with OVERCLOCK (#ffcc00)');
});

test('Player.shoot reads _EG.modifier === "OVERCHARGE" as the top-level gate', () => {
  // The forceCrit logic must be wired through the canonical _EG.modifier
  // global (the same global VOLATILE/CASCADE/CORROSIVE branches consult).
  // A typo to game.modifier or this.modifier would silently disable the
  // modifier in Player.shoot.
  assert.match(ENTITIES_CODE, /_EG\.modifier\s*===\s*'OVERCHARGE'/,
    "Player.shoot must gate the OVERCHARGE counter on _EG.modifier === 'OVERCHARGE'");
});

test('OVERCHARGE counter increments ONLY when modifier is active (no cross-floor drift)', () => {
  // If the counter incremented on every shot regardless of modifier,
  // then a player firing 4 shots on a non-OVERCHARGE floor would step
  // onto an OVERCHARGE floor and get an instant free crit on shot #1
  // (counter would already be at 5). Confusing rhythm. The increment
  // MUST be inside the `_EG.modifier === 'OVERCHARGE'` branch.
  // Brace-walked extraction anchored on the controlling if-header.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_EG\.modifier\s*===\s*'OVERCHARGE'\)\s*\{/
  );
  assert.ok(branch, 'OVERCHARGE if-branch must be locatable by its controlling if-header');
  assert.match(branch, /this\._overchargeShots\s*=\s*\(\s*this\._overchargeShots\s*\|\|\s*0\s*\)\s*\+\s*1/,
    'OVERCHARGE branch must increment this._overchargeShots with `|| 0` nucleation');
});

test('OVERCHARGE force-crit fires on counter % 5 === 0', () => {
  // The rhythm IS the design. Pin the literal 5 so a re-tune (e.g.
  // every 4th shot or every 6th shot) is caught in review. Using
  // strict equality === 0 (not just `!`) keeps the gate explicit.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_EG\.modifier\s*===\s*'OVERCHARGE'\)\s*\{/
  );
  assert.ok(branch, 'OVERCHARGE branch must be locatable');
  assert.match(branch, /this\._overchargeShots\s*%\s*5\s*===\s*0/,
    'OVERCHARGE must force-crit on counter % 5 === 0 (every 5th shot)');
  assert.match(branch, /forceCrit\s*=\s*true/,
    'OVERCHARGE must set forceCrit = true when the rhythm hits');
});

test('Player.shoot declares forceCrit = false at top so non-OVERCHARGE floors take the random crit path', () => {
  // The forceCrit local must default to FALSE so that on every
  // non-OVERCHARGE floor (and on shots 1-4 of an OVERCHARGE cycle),
  // the existing `critChance > 0 && rand('combat') < critChance` roll
  // is what decides crit. Without the false default, a missing
  // initialization would either crash (TDZ) or worse, default-truthy
  // and silently force-crit every shot.
  assert.match(ENTITIES_CODE, /let\s+forceCrit\s*=\s*false\s*;/,
    'Player.shoot must declare `let forceCrit = false;` so non-OVERCHARGE shots fall back to random crit roll');
});

test('forceCrit is wired into all five crit-roll sites: melee, ranged main, MULTI_SHOT bonus, ranged echo, melee echo', () => {
  // The single-trigger semantic requires forceCrit to be ORed into
  // every crit decision Player.shoot makes within one trigger pull —
  // melee sword arc, the ranged main projectile loop, the MULTI_SHOT
  // perk's bonus projectile, AND the REVERB echo's two branches
  // (ranged echo + melee echo). A regression that drops one (e.g. a
  // refactor that introduces a sixth crit site without forwarding
  // forceCrit, or removes one of the existing five) would make
  // OVERCHARGE behave inconsistently across weapon types and modifier
  // interactions. Count occurrences to lock the wire-count.
  //
  // Pre-REVERB pool was 3 (melee + ranged main + MULTI_SHOT). REVERB
  // echo branches add 2 more (REVERB+OVERCHARGE on the 5th shot must
  // crit BOTH the main shot and the echo, or the modifier interaction
  // is broken). Adding a future crit-roll site (e.g. a 7th positive
  // modifier that fires another bonus projectile) means bumping this
  // assertion AND wiring forceCrit into the new site.
  const occurrences = (ENTITIES_CODE.match(
    /forceCrit\s*\|\|\s*\(\s*critChance\s*>\s*0\s*&&\s*rand\('combat'\)\s*<\s*critChance\s*\)/g
  ) || []).length;
  assert.strictEqual(occurrences, 5,
    'forceCrit must be ORed into exactly FIVE crit-roll sites (melee + ranged main + MULTI_SHOT bonus + ranged echo + melee echo); got ' + occurrences);
});

test('OVERCHARGE counter persists through saveGame (per-run rhythm survives save/resume)', () => {
  // Without persistence, a quit-and-resume mid-OVERCHARGE-floor would
  // reset the counter to 0 and force the player to burn 4 more shots
  // before the next guaranteed crit. Mirrors the PIERCING_HEART
  // explicit-enum pattern in saveGame (no Object.keys — fields are
  // listed individually so save schema is auditable).
  assert.match(GAME_CODE, /_overchargeShots:\s*p\._overchargeShots\s*\|\|\s*0/,
    'saveGame must persist p._overchargeShots with `|| 0` nucleation');
});

test('OVERCHARGE counter is restored in continueGame (defaults 0 for older saves)', () => {
  // Mirrors PIERCING_HEART restore: `|| 0` ensures saves predating
  // OVERCHARGE (no _overchargeShots field) restore safely with a
  // fresh counter. Without the restore, the persisted value would
  // be ignored and resume would always start at 0.
  assert.match(GAME_CODE, /p\._overchargeShots\s*=\s*s\._overchargeShots\s*\|\|\s*0/,
    'continueGame must restore p._overchargeShots from save with `|| 0` default');
});

test('Player class declares _overchargeShots as a typed field (// @ts-check compliance)', () => {
  // src/entities.js has `// @ts-check` enabled — every field used on
  // the class must be declared in the field block to satisfy tsc's
  // no-implicit-any-properties under `// @ts-check`. The PIERCING_HEART
  // pattern (declared as `/** @type {any} */ _piercingHearts;`) is the
  // canonical shape; mirror it.
  assert.match(ENTITIES,
    /\/\*\*\s*@type\s*\{any\}\s*\*\/\s*_overchargeShots\s*;/,
    'Player class must declare /** @type {any} */ _overchargeShots; for // @ts-check');
});

test('OVERCHARGE counter increment lives ABOVE the crit-roll sites in Player.shoot', () => {
  // Topological constraint: the increment must execute BEFORE the
  // melee/ranged/MULTI_SHOT crit checks read forceCrit. If a future
  // refactor moves the OVERCHARGE block below the crit sites, every
  // crit check in the same trigger would read forceCrit = false
  // (the initial value) and OVERCHARGE would silently no-op. Anchor
  // by checking the OVERCHARGE branch start appears before the FIRST
  // forceCrit OR-into-crit site in source-text order.
  const ovIdx = ENTITIES_CODE.indexOf("_EG.modifier === 'OVERCHARGE'");
  const firstCritIdx = ENTITIES_CODE.indexOf('forceCrit || (critChance');
  assert.ok(ovIdx !== -1, 'OVERCHARGE branch must be locatable');
  assert.ok(firstCritIdx !== -1, 'forceCrit OR-into-crit site must be locatable');
  assert.ok(ovIdx < firstCritIdx,
    'OVERCHARGE counter increment must come BEFORE the crit-roll sites so forceCrit is set when the rolls evaluate');
});
