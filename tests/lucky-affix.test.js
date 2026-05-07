'use strict';
// LUCKY 'of Luck' weapon-affix suffix — source-text wiring tests.
//
// content.js / entities.js are browser-only (no UMD/CommonJS exports), so
// we can't load die() / applyHitEffects directly under node:test. Instead,
// these tests assert the structural invariants any working LUCKY suffix
// must satisfy: registry shape (slot/effect keyword), the on-kill
// gates (!isProc / effects.includes('lucky') / !isShard / !isSummon),
// the 8% chance threshold, and that the bonus calls
// items.push(new Item(this.x, this.y)).
//
// Each check fails loudly the moment a refactor drops a wire — same
// silent-removal failure mode that bit RECOIL/SHOCK_PULSE/HUNTER reviews.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content', 'weapons.js'), 'utf8'
);
const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);

// Strip /* ... */ and // ... comments so source-text regex assertions
// match against EXECUTABLE source, not commentary that incidentally
// quotes the gate token. Pattern from tests/mark-affix.test.js,
// tests/greedy-affix.test.js, tests/salvage-affix.test.js, and
// tests/reverse-polarity-hackware.test.js
// (per stored memory 'test regex pitfalls').
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const ENTITIES_CODE = stripComments(ENTITIES);

test('LUCKY is registered in WEAPON_AFFIXES as a suffix with effect:lucky', () => {
  // slot:'suffix' is critical — slot routes the affix through the on-hit
  // / on-kill effect path. A typo to 'prefix' would silently route into
  // the mod-loop in buildWeapon() and never reach the on-kill gate.
  // effect:'lucky' is the keyword die() switches on; if it diverges
  // from the gate string the suffix becomes a cosmetic no-op.
  const re = /LUCKY:\s*\{\s*slot:\s*'suffix'\s*,\s*label:\s*'[^']+'\s*,\s*colour:\s*'#[0-9a-fA-F]+'\s*,\s*desc:\s*'[^']+'\s*,\s*effect:\s*'lucky'\s*\}/;
  assert.match(CONTENT, re,
    "LUCKY must be a suffix with label/colour/desc and effect:'lucky'");
});

test('Enemy.die() reads _lastHitCtx and gates the bonus on effects.includes("lucky")', () => {
  // The bonus must be wired through the existing _lastHitCtx pipe so the
  // ctx propagates from Player.shoot → Projectile → enemy.takeDamage →
  // _lastHitCtx (set unconditionally at takeDamage entry). A literal
  // string match for the gate token would pass on a comment that quotes
  // 'lucky' — strip comments first.
  assert.match(ENTITIES_CODE, /effects\.includes\(\s*'lucky'\s*\)/,
    "die() must gate on _lastHitCtx.effects.includes('lucky')");
});

test('LUCKY on-kill gates on !isProc (proc finishers do not roll Luck)', () => {
  // If a non-Lucky proc (THUNDER chain, EXPLOSIVE_KILLS, RICOCHET hit)
  // finishes the enemy, _lastHitCtx will be that proc's context —
  // {isProc:true}. Without the !isProc gate, those procs would roll
  // a Lucky drop they didn't earn. Mirrors applyOnKill at
  // entities.js:1158-1162 and the SALVAGE/GREEDY blocks.
  const idx = ENTITIES_CODE.indexOf("effects.includes('lucky')");
  assert.ok(idx !== -1, 'lucky gate must exist');
  // Search the preceding ~400 chars for !_lctx?.isProc or !ctx.isProc style.
  const head = ENTITIES_CODE.slice(Math.max(0, idx - 400), idx);
  assert.match(head, /!\s*[\w.]*isProc/,
    'on-kill LUCKY block must gate on !isProc to skip proc finishers');
});

test('LUCKY skips summons and shards (defense in depth)', () => {
  // Summons / shards are excluded from the elite/boss core drop above by
  // the same gate, and the base Item drop at line 1859 uses the same
  // !this.isShard && !isSummon rule. Without it, a Lucky suffix could
  // drop items from spawned-shard chain kills, which the player did not
  // "earn" with a real ranged hit. Mirrors HARVESTER/MAGPIE/VAULTMASTER
  // and the SALVAGE/GREEDY on-kill gates.
  const idx = ENTITIES_CODE.indexOf("effects.includes('lucky')");
  assert.ok(idx !== -1, 'lucky gate must exist');
  // Search a wider window because the gate spans multiple lines.
  const window = ENTITIES_CODE.slice(Math.max(0, idx - 400), idx + 600);
  assert.match(window, /!\s*this\.isShard/,
    'LUCKY block must skip this.isShard');
  assert.match(window, /!\s*isSummon/,
    'LUCKY block must skip isSummon');
});

test('LUCKY rolls seeded loot RNG < 0.08 (8% chance per qualifying kill)', () => {
  // 8% is the design — slightly under SALVAGE's 10% because a full Item
  // (weapon/armour/perk pickup) is higher-value than a 1-CORE drop, so
  // the curve self-balances against an item-flooded floor. Pin the
  // value so an unintentional re-tune is caught in review.
  const idx = ENTITIES_CODE.indexOf("effects.includes('lucky')");
  assert.ok(idx !== -1, 'lucky gate must exist');
  const window = ENTITIES_CODE.slice(idx, idx + 800);
  assert.match(window, /rand\('loot'\)\s*<\s*0\.08/,
    'LUCKY must roll rand(\'loot\') < 0.08 (8% chance)');
});

test('LUCKY calls items.push(new Item(this.x, this.y)) and emits gold particle hint', () => {
  // The drop call is the entire point — without this line the suffix
  // is a cosmetic no-op. Mirrors the bounty drop at entities.js:1964.
  // The gold particle burst is a tell that THIS kill triggered the
  // suffix even before the Item's idle pulse engages.
  const idx = ENTITIES_CODE.indexOf("effects.includes('lucky')");
  assert.ok(idx !== -1, 'lucky gate must exist');
  const window = ENTITIES_CODE.slice(idx, idx + 800);
  assert.match(window, /items\.push\(\s*new\s+Item\(\s*this\.x\s*,\s*this\.y\s*\)\s*\)/,
    'LUCKY must call items.push(new Item(this.x, this.y))');
  assert.match(window, /spawnParticles\([^)]*'#ffdd66'/,
    'LUCKY must emit gold #ffdd66 particles as a tell');
});

test('LUCKY block runs AFTER the elite/boss core drop (so it stacks, not replaces)', () => {
  // The bonus must be additive on top of the existing drop logic. If
  // the block ran before the elite/boss core drop, an elite-killing
  // Lucky shot might double-process or interleave HUD pulses. Anchor on
  // positions: the elite/boss core drop must precede the lucky gate.
  const eliteDropIdx = ENTITIES_CODE.indexOf('NEON.cores.spawnCoreDrop(game, this.x, this.y, coreVal)');
  const luckyGateIdx = ENTITIES_CODE.indexOf("effects.includes('lucky')");
  assert.ok(eliteDropIdx !== -1, 'elite/boss core drop line must exist');
  assert.ok(luckyGateIdx > eliteDropIdx,
    'LUCKY drop block must come AFTER the elite/boss core drop so it stacks');
});

test('LUCKY suffix is registered in AFFIX_SUFFIXES key list (drop pool eligibility)', () => {
  // AFFIX_SUFFIXES is derived from AFFIX_KEYS filtered by slot==='suffix'.
  // Verify LUCKY appears in the registry between the start of WEAPON_AFFIXES
  // and the closing brace, so the derived AFFIX_SUFFIXES picks it up.
  const startIdx = CONTENT.indexOf('const WEAPON_AFFIXES');
  assert.ok(startIdx !== -1, 'WEAPON_AFFIXES registry must exist');
  const endIdx = CONTENT.indexOf('};', startIdx);
  assert.ok(endIdx > startIdx, 'WEAPON_AFFIXES registry must terminate');
  const registryBody = CONTENT.slice(startIdx, endIdx);
  assert.ok(/^\s*LUCKY:/m.test(registryBody),
    'LUCKY must be a top-level key inside WEAPON_AFFIXES so AFFIX_SUFFIXES includes it');
});
