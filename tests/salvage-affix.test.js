'use strict';
// SALVAGE 'of Salvage' weapon-affix suffix — source-text wiring tests.
//
// content.js / entities.js are browser-only (no UMD/CommonJS exports), so
// we can't load die() / applyHitEffects directly under node:test. Instead,
// these tests assert the structural invariants any working SALVAGE suffix
// must satisfy: registry shape (slot/effect keyword), the on-kill
// gates (!isProc / effects.includes('salvage') / !isShard / !isSummon),
// the 10% chance threshold, and that the bonus calls
// NEON.cores.spawnCoreDrop with value=1.
//
// Each check fails loudly the moment a refactor drops a wire — same
// silent-removal failure mode that bit RECOIL/SHOCK_PULSE/HUNTER reviews.

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

// Strip /* ... */ and // ... comments so source-text regex assertions
// match against EXECUTABLE source, not commentary that incidentally
// quotes the gate token. Pattern from tests/mark-affix.test.js,
// tests/greedy-affix.test.js, and tests/reverse-polarity-hackware.test.js
// (per stored memory 'test regex pitfalls').
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const ENTITIES_CODE = stripComments(ENTITIES);

test('SALVAGE is registered in WEAPON_AFFIXES as a suffix with effect:salvage', () => {
  // slot:'suffix' is critical — slot routes the affix through the on-hit
  // / on-kill effect path. A typo to 'prefix' would silently route into
  // the mod-loop in buildWeapon() and never reach the on-kill gate.
  // effect:'salvage' is the keyword die() switches on; if it diverges
  // from the gate string the suffix becomes a cosmetic no-op.
  const re = /SALVAGE:\s*\{\s*slot:\s*'suffix'\s*,\s*label:\s*'[^']+'\s*,\s*colour:\s*'#[0-9a-fA-F]+'\s*,\s*desc:\s*'[^']+'\s*,\s*effect:\s*'salvage'\s*\}/;
  assert.match(CONTENT, re,
    "SALVAGE must be a suffix with label/colour/desc and effect:'salvage'");
});

test('Enemy.die() reads _lastHitCtx and gates the bonus on effects.includes("salvage")', () => {
  // The bonus must be wired through the existing _lastHitCtx pipe so the
  // ctx propagates from Player.shoot → Projectile → enemy.takeDamage →
  // _lastHitCtx (set unconditionally at takeDamage entry). A literal
  // string match for the gate token would pass on a comment that quotes
  // 'salvage' — strip comments first.
  assert.match(ENTITIES_CODE, /effects\.includes\(\s*'salvage'\s*\)/,
    "die() must gate on _lastHitCtx.effects.includes('salvage')");
});

test('SALVAGE on-kill gates on !isProc (proc finishers do not roll Salvage)', () => {
  // If a non-Salvage proc (THUNDER chain, EXPLOSIVE_KILLS, RICOCHET hit)
  // finishes the enemy, _lastHitCtx will be that proc's context —
  // {isProc:true}. Without the !isProc gate, those procs would roll
  // a Salvage drop they didn't earn. Mirrors applyOnKill at
  // entities.js:1158-1162 and the GREEDY block.
  // Anchor on the salvage-includes match and walk back to find the gate.
  const idx = ENTITIES_CODE.indexOf("effects.includes('salvage')");
  assert.ok(idx > 0, 'salvage gate must exist');
  // Search the preceding ~400 chars for !_sctx?.isProc or !ctx.isProc style.
  const head = ENTITIES_CODE.slice(Math.max(0, idx - 400), idx);
  assert.match(head, /!\s*[\w.]*isProc/,
    'on-kill SALVAGE block must gate on !isProc to skip proc finishers');
});

test('SALVAGE skips summons and shards (defense in depth)', () => {
  // Summons / shards are excluded from the elite/boss core drop above by
  // the same gate. Without it, a Greedy/Salvage suffix could drop cores
  // from spawned-shard chain kills, which the player did not "earn" with
  // a real ranged hit. Mirrors the !this.isShard && !isSummon gate used
  // by HARVESTER/MAGPIE/VAULTMASTER drops.
  const idx = ENTITIES_CODE.indexOf("effects.includes('salvage')");
  assert.ok(idx > 0, 'salvage gate must exist');
  // Search a wider window because the gate spans multiple lines.
  const window = ENTITIES_CODE.slice(Math.max(0, idx - 400), idx + 600);
  assert.match(window, /!\s*this\.isShard/,
    'SALVAGE block must skip this.isShard');
  assert.match(window, /!\s*isSummon/,
    'SALVAGE block must skip isSummon');
});

test('SALVAGE rolls Math.random() < 0.10 (10% chance per qualifying kill)', () => {
  // 10% is the design — too high (50%) trivializes the elite/boss core
  // economy by making any-mob drops the dominant source; too low (1%)
  // makes the suffix never feel rewarding over a 5-floor run. Pin the
  // value so an unintentional re-tune is caught in review.
  const idx = ENTITIES_CODE.indexOf("effects.includes('salvage')");
  assert.ok(idx > 0, 'salvage gate must exist');
  const window = ENTITIES_CODE.slice(idx, idx + 800);
  assert.match(window, /Math\.random\(\)\s*<\s*0\.10/,
    'SALVAGE must roll Math.random() < 0.10 (10% chance)');
});

test('SALVAGE calls NEON.cores.spawnCoreDrop with value=1 and emits cyan particle hint', () => {
  // The drop call is the entire point — without this line the suffix
  // is a cosmetic no-op. Cores have their own in-world visual via
  // updateCoreDrops/drawCoreDrops, so we don't add a "+1 CORE" floating
  // text (the drop entity itself is the feedback). The cyan particle
  // burst is a tell that THIS kill triggered the suffix even before the
  // drop's magnet animation engages.
  const idx = ENTITIES_CODE.indexOf("effects.includes('salvage')");
  assert.ok(idx > 0, 'salvage gate must exist');
  const window = ENTITIES_CODE.slice(idx, idx + 800);
  assert.match(window, /NEON\.cores\.spawnCoreDrop\(\s*game\s*,\s*this\.x\s*,\s*this\.y\s*,\s*1\s*\)/,
    'SALVAGE must call NEON.cores.spawnCoreDrop(game, this.x, this.y, 1)');
  assert.match(window, /spawnParticles\([^)]*'#44ffcc'/,
    'SALVAGE must emit cyan #44ffcc particles as a tell');
});

test('SALVAGE block runs AFTER the elite/boss core drop (so it stacks, not replaces)', () => {
  // The bonus must be additive on top of the existing core drop. If the
  // block ran before the elite/boss core drop, an elite-killing Salvage
  // shot might double-process or interleave HUD pulses. Anchor on
  // positions: the elite/boss drop must precede the salvage gate.
  const eliteDropIdx = ENTITIES_CODE.indexOf('NEON.cores.spawnCoreDrop(game, this.x, this.y, coreVal)');
  const salvageGateIdx = ENTITIES_CODE.indexOf("effects.includes('salvage')");
  assert.ok(eliteDropIdx > 0, 'elite/boss core drop line must exist');
  assert.ok(salvageGateIdx > eliteDropIdx,
    'SALVAGE drop block must come AFTER the elite/boss core drop so it stacks');
});

test('SALVAGE guards on typeof NEON !== "undefined" so node:test does not crash', () => {
  // Mirrors the elite/boss core drop block at entities.js:1953. NEON is
  // a browser-only global. Even though die() itself only runs in the
  // browser today, defensive parity with the surrounding code keeps
  // future test harnesses safe and signals intent. If a future change
  // ever stubs NEON in tests, this guard prevents a TypeError on
  // NEON.cores when the cores module isn't loaded.
  const idx = ENTITIES_CODE.indexOf("effects.includes('salvage')");
  assert.ok(idx > 0, 'salvage gate must exist');
  const window = ENTITIES_CODE.slice(idx, idx + 800);
  assert.match(window, /typeof\s+NEON\s*!==\s*'undefined'/,
    'SALVAGE block must guard on typeof NEON !== "undefined"');
  assert.match(window, /NEON\.cores\b/,
    'SALVAGE block must check NEON.cores presence before calling spawnCoreDrop');
});
