'use strict';
// REGENERATIVE floor modifier — wiring tests.
//
// REGENERATIVE makes non-elite, non-boss patrols self-repair when out of
// combat (no damage taken in REGEN_DELAY=2.5s, then regen at 8% maxHp/sec
// up to maxHp). Punishes hit-and-run and rewards committing to kills —
// the first new "duration tax" modifier (existing 9 are all stat tweaks
// or one-shot triggers).
//
// Same wiring-test shape as fragile-modifier.test.js / hunter-modifier
// .test.js — grep the runtime source rather than simulate the full game
// loop.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CONTENT = fs.readFileSync(path.join(ROOT, 'src', 'content.js'), 'utf8');
const ENTITIES = fs.readFileSync(path.join(ROOT, 'src', 'entities.js'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

// Strip JS comments before regex matching on executable gates. Without
// this, a regex looking for `if (actual > 0 && _EG.modifier === 'REGENERATIVE')`
// would match a JSDoc block discussing the gate. Pattern established in
// tests/mark-affix.test.js + tests/reverse-polarity-hackware.test.js
// after gpt-5.3-codex caught the comment-vs-code conflation 2026-04-27.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}
const ENTITIES_CODE = stripComments(ENTITIES);

test('REGENERATIVE registered in FLOOR_MODIFIERS with label/desc/colour/icon', () => {
  // Single source of truth for the announcement banner, the random roll
  // (MODIFIER_KEYS = Object.keys(FLOOR_MODIFIERS)), and the HUD chip.
  const m = CONTENT.match(/REGENERATIVE:\s*\{\s*label:\s*'REGENERATIVE'[^}]*desc:\s*'([^']+)'[^}]*colour:\s*'(#[0-9a-f]+)'[^}]*icon:\s*'([^']+)'/);
  assert.ok(m, 'REGENERATIVE must be registered in FLOOR_MODIFIERS with label/desc/colour/icon');
  assert.ok(m[1].length > 0, 'REGENERATIVE desc must be non-empty');
  assert.ok(m[2].length === 7, `REGENERATIVE colour must be #rrggbb, got ${m[2]}`);
  assert.ok(m[3].length > 0, 'REGENERATIVE icon must be non-empty');
});

test('REGENERATIVE auto-included in MODIFIER_KEYS for random rolls', () => {
  // MODIFIER_KEYS is derived from Object.keys(FLOOR_MODIFIERS) so any new
  // entry is auto-included by game.js floor-init at line ~169:
  //   this.modifier = MODIFIER_KEYS[rndInt(0, MODIFIER_KEYS.length - 1)];
  assert.ok(/const MODIFIER_KEYS = Object\.keys\(FLOOR_MODIFIERS\);/.test(CONTENT),
    'MODIFIER_KEYS must remain Object.keys(FLOOR_MODIFIERS) so REGENERATIVE is auto-included');
});

test('REGENERATIVE regen tick lives in Enemy.update with eligibility gates', () => {
  // The tick must check ALL of: !isBoss (HP-ratio phases), !elite (already
  // tough), !_summoned (no farming), !isShard (1-tick splits), !_disguised
  // (no mimic visual leak), !_wrPhased (defense-in-depth — phaseImmune
  // returns early in takeDamage anyway), !_ghIsGhost (own despawn timer).
  const m = ENTITIES_CODE.match(/_EG\.modifier === 'REGENERATIVE'\s*&&\s*!this\.isBoss\s*&&\s*!this\.elite\s*&&\s*!this\._summoned\s*&&\s*!this\.isShard\s*&&\s*!this\._disguised\s*&&\s*!this\._wrPhased\s*&&\s*!this\._ghIsGhost/);
  assert.ok(m, 'REGENERATIVE tick must gate on !isBoss && !elite && !_summoned && !isShard && !_disguised && !_wrPhased && !_ghIsGhost');
});

test('REGENERATIVE tick uses an out-of-combat delay before applying regen', () => {
  // Without a delay, even a single dropped frame mid-fight would heal
  // chip damage. The 2.5s threshold means the player has to actively
  // disengage (or be panicked into chip-and-retreat) to trigger regen.
  const m = ENTITIES_CODE.match(/this\._regenTimer\s*=\s*\(this\._regenTimer\s*\|\|\s*0\)\s*\+\s*dt;\s*if\s*\(this\._regenTimer\s*>=\s*(\d+(?:\.\d+)?)/);
  assert.ok(m, 'REGENERATIVE must use a per-enemy _regenTimer accumulator with a >= delay threshold');
  const delay = parseFloat(m[1]);
  assert.ok(delay >= 1.5 && delay <= 4.0,
    `REGENERATIVE out-of-combat delay should be 1.5-4.0s (chip-retreat punishment without making the modifier trivial), got ${delay}s`);
});

test('REGENERATIVE regen rate is bounded by maxHp and uses dt-scaled fraction', () => {
  // Must be: hp = Math.min(maxHp, hp + maxHp * RATE * dt). The Math.min
  // cap prevents over-regen, the dt scaling makes the rate FPS-independent
  // (60 vs 120 fps regen identically). Asserted shape locks both invariants.
  const m = ENTITIES_CODE.match(/this\.hp\s*=\s*Math\.min\(this\.maxHp,\s*this\.hp\s*\+\s*this\.maxHp\s*\*\s*(0\.\d+)\s*\*\s*dt\)/);
  assert.ok(m, 'REGENERATIVE must regen as Math.min(maxHp, hp + maxHp*RATE*dt) for FPS-independent capped healing');
  const rate = parseFloat(m[1]);
  assert.ok(rate > 0 && rate <= 0.15,
    `REGENERATIVE regen rate should be 0-15% maxHp/sec (full-heal in ~7-12s; faster than that trivialises the player's exit window), got ${rate * 100}%/sec`);
});

test('REGENERATIVE timer reset is wired in takeDamage on actual > 0', () => {
  // The reset must fire on REAL damage only — not on shield-absorbed,
  // phase-absorbed, or 0-dmg glance hits. Mirrors the actual-vs-dmg
  // distinction used by VAULTMASTER's coin ICD reset just below.
  // Gated on the modifier so non-REGENERATIVE floors don't pay the
  // hidden-class transition cost of writing _regenTimer on every hit.
  const m = ENTITIES_CODE.match(/if\s*\(actual\s*>\s*0\s*&&\s*_EG\.modifier\s*===\s*'REGENERATIVE'\)\s*this\._regenTimer\s*=\s*0/);
  assert.ok(m, 'REGENERATIVE reset must be `if (actual > 0 && _EG.modifier === \'REGENERATIVE\') this._regenTimer = 0` in takeDamage');
});

test('REGENERATIVE regen does NOT tick during stun (stun is neutralization)', () => {
  // The stun branch in Enemy.update returns at `// skip all AI` BEFORE
  // the regen block. Stunning a mob shuts off its regen — players can
  // still chip-EMP-chip strategically. Verified by ordering: the regen
  // tick must appear AFTER `return; // skip all AI`. Use raw ENTITIES
  // (not stripped) for the comment-string anchor.
  const stunReturnIdx = ENTITIES.indexOf('return; // skip all AI, leave attack/shoot timers frozen');
  // Anchor on the tick site (uses _regenTimer accumulator), NOT the
  // takeDamage reset which appears earlier in the file.
  const regenIdx = ENTITIES.indexOf('this._regenTimer = (this._regenTimer || 0) + dt');
  assert.ok(stunReturnIdx > 0, 'stun early-return must exist in Enemy.update');
  assert.ok(regenIdx > 0, 'REGENERATIVE tick must exist in Enemy.update');
  assert.ok(regenIdx > stunReturnIdx, 'REGENERATIVE regen tick must live AFTER the stun early-return so stun freezes regen');
});

test('REGENERATIVE timer reset is wired in burn DoT path (anti-regression)', () => {
  // Burn DoT (tickEnemyStatusEffects) bypasses takeDamage by direct
  // hp subtraction (`enemy.hp -= dmg`), so without an explicit reset
  // here, burn-and-retreat would let the regen clock count up while
  // the enemy actively loses HP. Caught by gpt-5.3-codex adversarial
  // review 2026-04-27. Gated on dmg > 0 (post-SHIELDED-absorb) to
  // mirror the takeDamage `actual > 0` semantics.
  const m = ENTITIES_CODE.match(/if\s*\(dmg\s*>\s*0\s*&&\s*_EG\.modifier\s*===\s*'REGENERATIVE'\)\s*enemy\._regenTimer\s*=\s*0/);
  assert.ok(m, 'REGENERATIVE reset must be wired into the burn DoT path (tickEnemyStatusEffects) on dmg > 0');
});

test('REGENERATIVE has exactly four _EG.modifier references (anti-regression)', () => {
  // Mirrors the FRAGILE round-2 hardening: one tick site (Enemy.update),
  // one takeDamage reset, one burn-DoT reset (tickEnemyStatusEffects),
  // and one poison-DoT reset (TOXIC affix, also in tickEnemyStatusEffects
  // — added 2026-04-28). A future fifth ungated branch added alongside
  // (e.g. copy-paste, or a different damage shape) would bypass the
  // eligibility gates invisibly. Lock the count.
  //
  // When adding a NEW DoT path that bypasses takeDamage by direct hp
  // subtraction, you MUST add a `_regenTimer = 0` reset gated on
  // `dmg > 0 && _EG.modifier === 'REGENERATIVE'` AND bump this count.
  const all = ENTITIES_CODE.match(/_EG\.modifier === 'REGENERATIVE'/g) || [];
  assert.equal(all.length, 4,
    `entities.js must contain exactly 4 _EG.modifier === 'REGENERATIVE' references (Enemy.update tick + takeDamage reset + burn-DoT reset + poison-DoT reset); got ${all.length}`);
});

test('REGENERATIVE has no overlap with existing modifiers (cross-check)', () => {
  // Existing 9 modifiers cover: vision (BLACKOUT), HP-down (SWARM),
  // HP-up (FORTIFIED), corpse-explode (VOLATILE), aim-spread (SCRAMBLED),
  // enemy-speed (OVERCLOCK), flat-dmg-to-player (CORROSIVE),
  // projectile-speed (CHARGED), HP-down + dmg-amp (FRAGILE), stillness
  // penalty (HUNTER). REGENERATIVE is the first DURATION/PACE modifier —
  // a distinct shape that punishes slow play instead of stat-tweaking.
  const m = CONTENT.match(/REGENERATIVE:[^}]*desc:\s*'([^']+)'/);
  assert.ok(m, 'REGENERATIVE entry must exist');
  const desc = m[1].toLowerCase();
  assert.ok(!/emergency lights|alert|reinforced patrols|unstable power|targeting interference|system overclock|toxic atmosphere|supercharged projectiles|glass-cannon|stationary prey/.test(desc),
    `REGENERATIVE desc must be distinct from existing 9 modifiers, got "${desc}"`);
});

test('sw.js cache version >= v216 (REGENERATIVE adds runtime behavior)', () => {
  // Per project convention: cache-version assertion is a floor (>=), not
  // exact-match, so sibling PRs / the auto-bumper can leapfrog without
  // retroactive test edits. v216 is the last manually-bumped version
  // (commit dcfea81); the auto-bumper (PR #176) will push it higher
  // once #176 merges.
  const m = SW.match(/neon-dungeon-v(\d+)/);
  assert.ok(m, 'sw.js must declare a neon-dungeon-vNNN cache version');
  const v = parseInt(m[1], 10);
  assert.ok(v >= 216,
    `sw.js cache version must be >= 216 (REGENERATIVE modifier ships runtime behavior in src/content.js + src/entities.js), got v${v}`);
});
