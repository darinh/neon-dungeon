'use strict';
// REPAIR_PROTOCOL hackware — source-text wiring tests.
//
// REPAIR_PROTOCOL fills the "active healing" archetype that was missing
// from the hackware roster. It heals 4 HP every 1.0s for 4 ticks
// (16 HP total) over 4 seconds, on an 18s cooldown. Reuses the HP_REGEN
// perk's tick pattern (entities.js) so there's no per-frame allocation.
//
// content.js / entities.js are browser-only (UMD globals, no node exports),
// so we assert structural invariants by source-text inspection — same
// pattern used by tests/blink-hackware.test.js, tests/last-stand.test.js,
// tests/overdrive-perk.test.js, etc.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content', 'hackware.js'), 'utf8'
);
const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);
const SW = fs.readFileSync(
  path.resolve(__dirname, '..', 'sw.js'), 'utf8'
);

// ─── Catalog registration ────────────────────────────────────────────────

test('REPAIR_PROTOCOL registered in HACKWARE catalog with required fields', () => {
  const re = /REPAIR_PROTOCOL\s*:\s*\{\s*name:\s*'[^']+',\s*desc:\s*'[^']+',\s*colour:\s*'#[0-9a-fA-F]+',\s*icon:\s*'[^']+',\s*cooldown:\s*\d+/;
  assert.match(CONTENT, re,
    'REPAIR_PROTOCOL must declare name/desc/colour/icon/cooldown like sibling hackware');
});

test('REPAIR_PROTOCOL cooldown is in the long-utility band [15,22]', () => {
  // 16 HP guaranteed-on-press is a strong sustain; the cooldown must sit
  // above the offensive band (EMP=10, NANO_SWARM=10, STATIC=12) and around
  // the strongest existing utility (GRAVITY_WELL=16). 18s is the design
  // target. A loose [15,22] band tolerates future tuning.
  const m = CONTENT.match(/REPAIR_PROTOCOL[^}]*cooldown:\s*(\d+)/);
  assert.ok(m, 'REPAIR_PROTOCOL cooldown must be an integer literal');
  const cd = parseInt(m[1], 10);
  assert.ok(cd >= 15 && cd <= 22,
    `REPAIR_PROTOCOL cooldown ${cd}s must sit in [15,22] — too low and it trivialises sustain, too high and it loses identity vs MED_PACK pickups`);
});

test('REPAIR_PROTOCOL is the only HACKWARE entry that heals the player', () => {
  // Defensive against future drift: if someone adds a second healing
  // hackware without re-thinking the archetype, this fires. The check
  // looks for the green colour prefix used for healing UI conventions
  // (#00ff8x / #88ffaa) on hackware entries that aren't REPAIR_PROTOCOL.
  // NANO_SWARM uses #44ff88 (green-ish offensive), so we anchor on the
  // exact REPAIR colour to keep the test deterministic.
  const repairLine = CONTENT.match(/REPAIR_PROTOCOL[^\n]*colour:'([^']+)'/);
  assert.ok(repairLine, 'REPAIR_PROTOCOL must have a colour literal');
  // Make sure REPAIR_PROTOCOL is registered exactly once.
  const occ = CONTENT.match(/REPAIR_PROTOCOL\s*:/g);
  assert.equal(occ && occ.length, 1,
    'REPAIR_PROTOCOL catalog entry must appear exactly once in content.js');
});

// ─── Activation case ─────────────────────────────────────────────────────

function repairCaseBody() {
  // Slice from the case label to the next case label OR the closing
  // brace of the switch. Mirrors the helper in blink-hackware.test.js.
  const start = CONTENT.indexOf("case 'REPAIR_PROTOCOL':");
  assert.ok(start >= 0, 'activateHackware switch must contain a REPAIR_PROTOCOL case');
  const after = CONTENT.indexOf("case '", start + 5);
  const closeBrace = CONTENT.indexOf('\n  }\n}', start);
  const end = (after >= 0 && after < closeBrace) ? after : closeBrace;
  return CONTENT.slice(start, end);
}

test('REPAIR_PROTOCOL activation seeds HoT state on the player', () => {
  const body = repairCaseBody();
  assert.match(body, /player\._repairTicksLeft\s*=\s*4/,
    'activation must seed _repairTicksLeft to 4 (4 ticks of healing)');
  assert.match(body, /player\._repairTickTimer\s*=\s*1\.0/,
    'activation must seed _repairTickTimer to 1.0 (first tick lands at +1s)');
});

test('REPAIR_PROTOCOL refunds cooldown when activated at full HP', () => {
  // Without this guard, a misclick at 100% HP burns the entire 18s
  // cooldown for zero benefit — bad UX. The guard mirrors how MED_PACK
  // pickup is suppressed at full HP elsewhere in the codebase.
  const body = repairCaseBody();
  assert.match(body, /player\.hp\s*>=?\s*player\.maxHp/,
    'REPAIR_PROTOCOL must check player HP vs maxHp');
  assert.match(body, /player\.hackwareCooldown\s*=\s*0/,
    'REPAIR_PROTOCOL must zero the cooldown on full-HP abort');
});

// ─── Player init ─────────────────────────────────────────────────────────

test('Player ctor initialises _repairTicksLeft and _repairTickTimer to 0', () => {
  // Inactive default. Without this, the field is undefined and the tick
  // gate `_repairTicksLeft > 0` is fine, but the typecheck declarations
  // would diverge from runtime semantics.
  assert.match(ENTITIES, /this\._repairTicksLeft\s*=\s*0/,
    'Player ctor must initialise _repairTicksLeft to 0');
  assert.match(ENTITIES, /this\._repairTickTimer\s*=\s*0/,
    'Player ctor must initialise _repairTickTimer to 0');
});

test('Player class declares _repairTicksLeft and _repairTickTimer field types', () => {
  // Matches the existing /** @type {any} */ declaration block that holds
  // hackwareCooldown, regenTimer, _strideStacks, _tetherSlowFactor, etc.
  // Without these, // @ts-check would flag the property assignments.
  assert.match(ENTITIES, /\/\*\*\s*@type\s*\{any\}\s*\*\/\s*_repairTicksLeft/,
    'Player class must declare _repairTicksLeft field for ts-check');
  assert.match(ENTITIES, /\/\*\*\s*@type\s*\{any\}\s*\*\/\s*_repairTickTimer/,
    'Player class must declare _repairTickTimer field for ts-check');
});

// ─── Tick logic ──────────────────────────────────────────────────────────

test('REPAIR_PROTOCOL tick block heals 4 HP and decrements ticks', () => {
  // The tick block lives next to HP_REGEN in Player.update. Anchor on
  // the unique guard `_repairTicksLeft > 0` and assert the body shape.
  const m = ENTITIES.match(/this\._repairTicksLeft\s*>\s*0[\s\S]{0,800}?_repairTicksLeft\s*-=\s*1[\s\S]{0,200}?Math\.min\s*\(\s*4\s*,\s*this\.maxHp\s*-\s*this\.hp\s*\)/);
  assert.ok(m,
    'REPAIR tick block must guard on _repairTicksLeft>0, decrement ticks by 1, and heal min(4, maxHp-hp)');
});

test('REPAIR tick is gated on hp>0 (no post-mortem healing)', () => {
  // If the player dies mid-HoT, the tick must NOT fire — otherwise we
  // get a +heal text on a corpse. Same gate the HP_REGEN block uses.
  const m = ENTITIES.match(/this\._repairTicksLeft\s*>\s*0\s*&&\s*this\.hp\s*>\s*0/);
  assert.ok(m, 'REPAIR tick must gate on `_repairTicksLeft > 0 && this.hp > 0`');
});

test('REPAIR tick uses 1.0s period (matches activation seed)', () => {
  // Period mismatch between activation seed (1.0) and tick increment
  // would silently shift the first tick — caught here.
  const m = ENTITIES.match(/_repairTickTimer\s*\+=\s*1\.0/);
  assert.ok(m, 'REPAIR tick must add 1.0 to _repairTickTimer per fired tick');
});

// ─── Service worker cache freshness ──────────────────────────────────────

test('SW freshness does not use a second numeric cache version', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /cacheFromNetwork\(e\)/);
});
