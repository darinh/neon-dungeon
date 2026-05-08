'use strict';
// KINETIC_DAMPER augment — wiring tests.
//
// KINETIC_DAMPER is the late-game scaling DR augment that complements
// TITANIUM_PLATING (flat -1, scales poorly). Applies a 0.8x multiplier to
// post-armor direct-hit damage in Player.takeDamage. MUST be gated on
// !options.ignoreDefense — env DoTs (Plasma burnDps*dt, Toxic toxDps*dt,
// Arc Grid, Disruption Field, Frost Patch, Proximity Mine ignoreDefense
// path, CRAWLER burn DoT) are BIOFILTER's lane and must not double-stack.
// Per stored env-DoT-damage-gate rule.
//
// Source-text wiring tests (same shape as emergency-cache-augment,
// reverse-polarity-hackware, mark-affix). The stripComments helper avoids
// the false-positive failure mode where a regex matches comment text
// instead of executable code (per stored test-regex-pitfalls memory).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CONTENT_UPGRADES = fs.readFileSync(path.join(ROOT, 'src', 'content', 'upgrades.js'), 'utf8');
const ENTITIES = fs.readFileSync(path.join(ROOT, 'src', 'entities.js'), 'utf8');

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

test('KINETIC_DAMPER registered in AUGMENTS with name/icon/colour/desc', () => {
  const m = CONTENT_UPGRADES.match(/KINETIC_DAMPER:\s*\{\s*name:\s*'([^']+)'[^}]*icon:\s*'([^']+)'[^}]*colour:\s*'(#[0-9a-fA-F]+)'[^}]*desc:\s*'([^']+)'/);
  assert.ok(m, 'KINETIC_DAMPER must be registered in AUGMENTS with name/icon/colour/desc');
  assert.ok(m[1].length > 0, 'KINETIC_DAMPER name must be non-empty');
  assert.ok(m[2].length > 0, 'KINETIC_DAMPER icon must be non-empty');
  assert.ok(m[3].length === 7, `KINETIC_DAMPER colour must be #rrggbb, got ${m[3]}`);
  assert.ok(m[4].length > 0, 'KINETIC_DAMPER desc must be non-empty');
});

test('KINETIC_DAMPER auto-included in AUGMENT_KEYS for rolls', () => {
  // AUGMENT_KEYS = Object.keys(AUGMENTS) — drives both rollAugmentChoices
  // (implant shrine) and makeAugmentShopOption. Lock the derivation.
  assert.ok(/const AUGMENT_KEYS = Object\.keys\(AUGMENTS\);/.test(CONTENT_UPGRADES),
    'AUGMENT_KEYS must remain Object.keys(AUGMENTS) so KINETIC_DAMPER is auto-included');
});

test('Player.takeDamage references KINETIC_DAMPER via hasAugment', () => {
  // The DR multiplier lives in Player.takeDamage and must check hasAugment
  // with the canonical id string. A typo would silently never trigger.
  const stripped = stripComments(ENTITIES);
  assert.ok(/hasAugment\(\s*['"]KINETIC_DAMPER['"]\s*\)/.test(stripped),
    'Player.takeDamage must call hasAugment("KINETIC_DAMPER") in executable code (not just comments)');
});

test('KINETIC_DAMPER applies 0.8x multiplier to actual damage', () => {
  // Lock the 0.8 literal so a tuning change is intentional. Pattern:
  //   actual = Math.max(1, Math.round(actual * 0.8));
  // Min-1 clamp preserves the direct-hit minimum-damage contract.
  const stripped = stripComments(ENTITIES);
  const idx = stripped.indexOf('KINETIC_DAMPER');
  assert.ok(idx !== -1, 'KINETIC_DAMPER must appear in entities.js');
  const window = stripped.slice(idx, idx + 400);
  assert.ok(/Math\.max\(\s*1\s*,\s*Math\.round\(\s*actual\s*\*\s*0\.8\s*\)\s*\)/.test(window),
    'KINETIC_DAMPER branch must apply Math.max(1, Math.round(actual * 0.8))');
});

test('KINETIC_DAMPER lives in the !options.ignoreDefense branch', () => {
  // Per stored env-DoT-damage-gate rule: env DoTs (Plasma burnDps*dt,
  // Toxic toxDps*dt, Arc Grid, Disruption Field, Frost Patch, Proximity
  // Mine ignoreDefense path, CRAWLER burn DoT) pass fractional damage
  // with ignoreDefense:true. A %DR multiplier in the ignoreDefense path
  // would either (a) double-stack with BIOFILTER which already covers env
  // DoTs, or (b) inflate sub-1 frame damage to 1/frame via Math.max(1,...)
  // = ~60 DPS instakill at 60fps. Verify the augment is in the same
  // `else` branch as TITANIUM_PLATING (which is also direct-hit-only).
  const stripped = stripComments(ENTITIES);
  // Find the `if (options.ignoreDefense) { ... } else { ... }` block
  // that contains TITANIUM_PLATING. KINETIC_DAMPER must be in the same
  // else-block (after TP, before the closing brace).
  const tpIdx = stripped.indexOf('TITANIUM_PLATING');
  assert.ok(tpIdx !== -1, 'TITANIUM_PLATING must be present in entities.js');
  const elseStart = stripped.lastIndexOf('} else {', tpIdx);
  assert.ok(elseStart !== -1, 'TITANIUM_PLATING must be inside an `else` branch');
  // Find the matching close brace of the else block by scanning braces.
  let depth = 0;
  let elseEnd = -1;
  for (let i = elseStart + '} else {'.length - 1; i < stripped.length; i++) {
    if (stripped[i] === '{') depth++;
    else if (stripped[i] === '}') {
      depth--;
      if (depth === 0) { elseEnd = i; break; }
    }
  }
  assert.ok(elseEnd > 0, 'else-block must have a closing brace');
  const elseBlock = stripped.slice(elseStart, elseEnd);
  assert.ok(/hasAugment\(\s*['"]KINETIC_DAMPER['"]\s*\)/.test(elseBlock),
    'KINETIC_DAMPER must live in the same `} else {` branch as TITANIUM_PLATING (the !options.ignoreDefense path)');
});

test('KINETIC_DAMPER applies AFTER TITANIUM_PLATING flat reduction', () => {
  // Composition order matters: flat -1 first, then % on remainder.
  // Reverse order would produce different rounding (e.g. 10 dmg:
  //   TP-then-KD: max(1, round((10-1)*0.8)) = max(1, 7) = 7
  //   KD-then-TP: max(1, round(10*0.8)-1) = max(1, 7) = 7  (same here)
  //   But for 3 dmg:
  //   TP-then-KD: max(1, round((3-1)*0.8)) = max(1, 2) = 2
  //   KD-then-TP: max(1, round(3*0.8)-1) = max(1, 1) = 1
  // The TP-then-KD order is the documented contract.
  const stripped = stripComments(ENTITIES);
  const tpIdx = stripped.search(/actual\s*=\s*Math\.max\(\s*1\s*,\s*dmg\s*-\s*this\.def\s*-\s*titaniumReduction/);
  const kdIdx = stripped.search(/Math\.max\(\s*1\s*,\s*Math\.round\(\s*actual\s*\*\s*0\.8\s*\)\s*\)/);
  assert.ok(tpIdx !== -1, 'TITANIUM_PLATING flat-reduction line must exist');
  assert.ok(kdIdx !== -1, 'KINETIC_DAMPER multiplier line must exist');
  assert.ok(kdIdx > tpIdx, 'KINETIC_DAMPER must apply AFTER TITANIUM_PLATING flat reduction');
});

test('KINETIC_DAMPER applies BEFORE CORROSIVE/FRAGILE/HUNTER modifiers', () => {
  // Floor modifiers are designed to amplify post-mitigation damage. If
  // KINETIC_DAMPER applied AFTER them, FRAGILE's intended +30% would
  // become only +4% effective on a KD player (×1.3 then ×0.8 = ×1.04).
  // That breaks the modifier's design intent. KD must apply BEFORE all
  // three modifier branches (CORROSIVE +2 flat, FRAGILE ×1.3, HUNTER
  // ×(1+still/MAX*0.5)). Scope to Player.takeDamage — there's an earlier
  // FRAGILE reference in enemy HP scaling that we must skip past.
  const stripped = stripComments(ENTITIES);
  const playerTakeDmgIdx = stripped.indexOf('takeDamage(dmg, source, opts)');
  assert.ok(playerTakeDmgIdx !== -1, 'Player.takeDamage(dmg, source, opts) signature must exist');
  const playerScope = stripped.slice(playerTakeDmgIdx);
  const kdIdx = playerScope.search(/Math\.max\(\s*1\s*,\s*Math\.round\(\s*actual\s*\*\s*0\.8\s*\)\s*\)/);
  const corrosiveIdx = playerScope.indexOf("_EG.modifier === 'CORROSIVE'");
  const fragileIdx = playerScope.indexOf("_EG.modifier === 'FRAGILE'");
  const hunterIdx = playerScope.indexOf("_EG.modifier === 'HUNTER'");
  assert.ok(kdIdx !== -1, 'KINETIC_DAMPER multiplier must exist in Player.takeDamage');
  assert.ok(corrosiveIdx !== -1, 'CORROSIVE modifier branch must exist in Player.takeDamage');
  assert.ok(fragileIdx !== -1, 'FRAGILE modifier branch must exist in Player.takeDamage');
  assert.ok(hunterIdx !== -1, 'HUNTER modifier branch must exist in Player.takeDamage');
  assert.ok(kdIdx < corrosiveIdx, 'KINETIC_DAMPER must apply BEFORE CORROSIVE modifier branch');
  assert.ok(kdIdx < fragileIdx, 'KINETIC_DAMPER must apply BEFORE FRAGILE modifier branch');
  assert.ok(kdIdx < hunterIdx, 'KINETIC_DAMPER must apply BEFORE HUNTER modifier branch');
});

// NOTE: no sw.js numeric cache assertion — sw.js must not carry a second
// version. See AGENTS.md.
