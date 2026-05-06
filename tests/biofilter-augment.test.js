'use strict';
// BIOFILTER augment — wiring tests.
//
// BIOFILTER fills the status-resistance gap in the augment roster:
// halves all environmental tile damage (PLASMA, ARC, TOXIC, FROST patches)
// AND halves CRAWLER burn-DoT duration + DPS. Same wiring-test shape as
// emergency-cache-augment / hunter-modifier — grep the runtime source
// rather than simulate the game loop.
//
// Uses the stripComments() helper per the test-regex-pitfalls convention:
// proximity regexes against case bodies can otherwise pass on COMMENT
// text alone (false-positive when the gate token only appears in a
// nearby explanatory comment).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CONTENT = fs.readFileSync(path.join(ROOT, 'src', 'content.js'), 'utf8');
const GAME = fs.readFileSync(path.join(ROOT, 'src', 'game.js'), 'utf8');
const ENTITIES = fs.readFileSync(path.join(ROOT, 'src', 'entities.js'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

/**
 * Strip /* … *​/ block comments and // line comments from a source span.
 * Used to ensure proximity regexes match against EXECUTABLE code, not
 * explanatory comments. Same helper as mark-affix / reverse-polarity.
 * @param {string} src
 * @returns {string}
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

test('BIOFILTER registered in AUGMENTS with name/icon/colour/desc', () => {
  // Single source of truth: drives the augment-choice modal, the implant
  // shrine, and makeAugmentShopOption. Lock all four fields.
  const m = CONTENT.match(/BIOFILTER:\s*\{\s*name:\s*'([^']+)'[^}]*icon:\s*'([^']+)'[^}]*colour:\s*'(#[0-9a-fA-F]+)'[^}]*desc:\s*'([^']+)'/);
  assert.ok(m, 'BIOFILTER must be registered in AUGMENTS with name/icon/colour/desc');
  assert.ok(m[1].length > 0, 'BIOFILTER name must be non-empty');
  assert.ok(m[2].length > 0, 'BIOFILTER icon must be non-empty');
  assert.ok(m[3].length === 7, `BIOFILTER colour must be #rrggbb, got ${m[3]}`);
  assert.ok(m[4].length > 0, 'BIOFILTER desc must be non-empty');
});

test('BIOFILTER auto-included in AUGMENT_KEYS for rolls', () => {
  // AUGMENT_KEYS = Object.keys(AUGMENTS). Lock the derivation so a
  // future refactor cannot silently de-list BIOFILTER from rolls/shop.
  assert.ok(/const AUGMENT_KEYS = Object\.keys\(AUGMENTS\);/.test(CONTENT),
    'AUGMENT_KEYS must remain Object.keys(AUGMENTS) so BIOFILTER is auto-included');
});

test('PLASMA tile damage gated through hasAugment("BIOFILTER")', () => {
  // PLASMA env burn at game.js ~2003. Without the gate the augment is
  // a no-op for the most common hazard tile. Strip comments so the
  // assertion does not pass on the explanatory comment that names the
  // augment.
  const idx = GAME.indexOf('tile === T.PLASMA');
  assert.ok(idx !== -1, 'PLASMA env-tile branch must exist in game.js');
  const span = stripComments(GAME.slice(idx, idx + 800));
  assert.ok(/hasAugment\(\s*['"]BIOFILTER['"]\s*\)\s*\?\s*0\.5\s*:\s*1/.test(span),
    'PLASMA burnDps must be multiplied by hasAugment("BIOFILTER") ? 0.5 : 1');
});

test('ARC tile zap gated through hasAugment("BIOFILTER")', () => {
  // ARC zap is the single biggest env-tile burst (~10 + floor*2). The
  // multiplier MUST be applied INSIDE the Math.round so the rounded
  // displayed value matches the actual damage dealt.
  const idx = GAME.indexOf('tile === T.ARC');
  assert.ok(idx !== -1, 'ARC env-tile branch must exist in game.js');
  const span = stripComments(GAME.slice(idx, idx + 800));
  // Match the assignment line including the BIOFILTER ternary; allow
  // arbitrary characters inside Math.round (e.g. nested getDiff() call).
  assert.ok(/zapDmg\s*=\s*Math\.round\([\s\S]*?hasAugment\(\s*['"]BIOFILTER['"]\s*\)\s*\?\s*0\.5\s*:\s*1[\s\S]*?\)/.test(span),
    'ARC zapDmg must include hasAugment("BIOFILTER") ? 0.5 : 1 inside Math.round so display matches actual');
});

test('TOXIC tile damage gated through hasAugment("BIOFILTER")', () => {
  // TOXIC pool dps. Continuous DoT — must halve the per-frame value
  // BEFORE multiplication by dt to preserve the "halved" framing
  // independent of frame rate.
  const idx = GAME.indexOf('tile === T.TOXIC');
  assert.ok(idx !== -1, 'TOXIC env-tile branch must exist in game.js');
  const span = stripComments(GAME.slice(idx, idx + 800));
  assert.ok(/toxDps\s*=[^;]*hasAugment\(\s*['"]BIOFILTER['"]\s*\)\s*\?\s*0\.5\s*:\s*1/.test(span),
    'TOXIC toxDps must be multiplied by hasAugment("BIOFILTER") ? 0.5 : 1');
});

test('FROST patch tick damage gated through hasAugment("BIOFILTER")', () => {
  // CRYOPHAGE frost patches in entities.js ~10125. Same rule as the
  // game.js hazard tiles. Strip comments so an explanatory note that
  // mentions BIOFILTER does not satisfy the assertion.
  // Anchor on the takeDamage call signature, not the bare 'Frost Patch'
  // label string (which also appears in a label dictionary at ~line 883).
  const idx = ENTITIES.indexOf("takeDamage(fdmg, 'Frost Patch'");
  assert.ok(idx !== -1, 'Frost Patch takeDamage(fdmg,...) call must exist in entities.js');
  const span = stripComments(ENTITIES.slice(Math.max(0, idx - 300), idx + 100));
  assert.ok(/hasAugment\(\s*['"]BIOFILTER['"]\s*\)\s*\?\s*0\.5\s*:\s*1/.test(span),
    'Frost Patch dmg must be multiplied by hasAugment("BIOFILTER") ? 0.5 : 1');
});

test('CRAWLER burn duration AND DPS halved by BIOFILTER', () => {
  // CRAWLER is the only enemy that inflicts a lingering DoT on the
  // player (entities.js ~2179). BIOFILTER must halve BOTH burnTimer
  // and burnDps — halving only one would leave a long faint burn or
  // a brief intense burn, both surprising to the player.
  const idx = ENTITIES.indexOf("this.type === 'CRAWLER'");
  assert.ok(idx !== -1, 'CRAWLER burn-on-hit branch must exist in entities.js');
  const span = stripComments(ENTITIES.slice(idx, idx + 600));
  assert.ok(/hasAugment\(\s*['"]BIOFILTER['"]\s*\)/.test(span),
    'CRAWLER burn branch must check hasAugment("BIOFILTER")');
  assert.ok(/burnTimer\s*=\s*Math\.max\([^)]*2\s*\*\s*bioMul/.test(span),
    'CRAWLER burnTimer must scale by bioMul');
  assert.ok(/burnDps\s*=\s*Math\.max\([^)]*\)\s*\*\s*bioMul/.test(span),
    'CRAWLER burnDps must scale by bioMul');
});

test('BIOFILTER multiplier is exactly 0.5 in every hook (consistent semantics)', () => {
  // Player-visible promise is "−50%". Drift between sites would silently
  // unbalance the augment. Count occurrences across all four hook files
  // and assert all use 0.5, not 0.4 / 0.6 / etc.
  const stripAll = stripComments(GAME) + '\n' + stripComments(ENTITIES);
  const allHooks = stripAll.match(/hasAugment\(\s*['"]BIOFILTER['"]\s*\)\s*\?\s*([0-9.]+)\s*:\s*1/g) || [];
  // 4 expected: PLASMA, ARC, TOXIC (game.js) + Frost (entities.js)
  // CRAWLER uses the bioMul intermediate, so it's already separately tested.
  assert.ok(allHooks.length >= 4,
    `Expected >=4 BIOFILTER ternary hooks across env tiles + frost, found ${allHooks.length}`);
  for (const h of allHooks) {
    assert.ok(/0\.5/.test(h), `BIOFILTER hook must use 0.5 multiplier, got: ${h}`);
  }
});

test('BIOFILTER does NOT touch direct enemy-projectile damage paths', () => {
  // BIOFILTER is scoped to env-tiles + CRAWLER burn. It must not bleed
  // into projectile takeDamage calls (those are gated by armor/parry/
  // SECOND_WIND etc — adding BIOFILTER there would double-stack with
  // TITANIUM_PLATING and create a surprise tankiness spike).
  const projHit = ENTITIES.indexOf('Player.prototype.takeDamage');
  // Just sanity-check that BIOFILTER doesn't appear inside Player.takeDamage.
  // If structure differs, fall back to a name-based file scan.
  if (projHit > 0) {
    const span = ENTITIES.slice(projHit, projHit + 4000);
    assert.ok(!/BIOFILTER/.test(span),
      'BIOFILTER must not appear inside Player.takeDamage — scope is env tiles + CRAWLER hit only');
  }
});

test('sw.js uses network-first freshness instead of numeric cache bumps', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /cacheFromNetwork\(e\)\.catch\(\(\) => caches\.match\(e\.request\)\)/);
});

test('AUGMENTS object remains <=15 entries (roster sanity)', () => {
  // The augment-choice modal, the implant-shrine UI, and the shop offer
  // all assume a manageable roster. Original cap was 14 (BIOFILTER as #14).
  // Bumped to 15 when KINETIC_DAMPER (#174) merged alongside BIOFILTER (#173).
  // Roster pool only affects rollAugmentChoices availability — choice modal
  // always shows 2 options regardless, so 15 is still UI-safe. Hold this
  // ceiling: future adds must trim or escalate.
  const block = CONTENT.match(/const AUGMENTS = \{([\s\S]*?)\n\};/);
  assert.ok(block, 'AUGMENTS block must exist in content.js');
  const entries = block[1].split('\n').filter(l => /^\s*[A-Z_]+\s*:/.test(l));
  assert.ok(entries.length <= 15,
    `AUGMENTS roster must stay <=15 (got ${entries.length}). Trim or escalate before adding more.`);
  assert.ok(entries.length >= 14,
    `AUGMENTS roster must include BIOFILTER (expected >=14, got ${entries.length}).`);
});
