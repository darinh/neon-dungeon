'use strict';
// FRAGILE floor modifier — wiring tests.
//
// FRAGILE is a glass-cannon protocol: non-boss enemies have 0.55x HP but
// damage to the player is amplified 1.3x. Both sides get more lethal —
// fast clears reward aggression, single mistakes cost more. Mirrors the
// existing SWARM (0.6x HP) / FORTIFIED (1.4x HP) / CORROSIVE (+2 dmg to
// player) symmetric pattern.
//
// Same wiring-test shape as recent ship tests (gulper.test.js,
// shock-pulse.test.js) — grep the runtime source rather than
// simulate the full game loop.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CONTENT = fs.readFileSync(path.join(ROOT, 'src', 'content', 'modifiers.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(ROOT, 'src', 'content.js'), 'utf8');
const ENTITIES = fs.readFileSync(path.join(ROOT, 'src', 'entities.js'), 'utf8');
const SPAWN_MODIFIERS = fs.readFileSync(path.join(ROOT, 'src', 'entities', 'spawn-modifiers.js'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

test('FRAGILE registered in FLOOR_MODIFIERS with label/desc/colour/icon', () => {
  // Single source of truth for the announcement banner, the random roll
  // (MODIFIER_KEYS = Object.keys(FLOOR_MODIFIERS)), and the HUD chip.
  const m = CONTENT.match(/FRAGILE:\s*\{\s*label:\s*'FRAGILE'[^}]*desc:\s*'([^']+)'[^}]*colour:\s*'(#[0-9a-f]+)'[^}]*icon:\s*'([^']+)'/);
  assert.ok(m, 'FRAGILE must be registered in FLOOR_MODIFIERS with label/desc/colour/icon');
  assert.ok(m[1].length > 0, 'FRAGILE desc must be non-empty');
  assert.ok(m[2].length === 7, `FRAGILE colour must be #rrggbb, got ${m[2]}`);
  assert.ok(m[3].length > 0, 'FRAGILE icon must be non-empty');
});

test('FRAGILE auto-included in MODIFIER_KEYS for random rolls', () => {
  // MODIFIER_KEYS is derived from Object.keys(FLOOR_MODIFIERS) so any new
  // entry is auto-included by game.js floor-init at line ~169:
  //   this.modifier = MODIFIER_KEYS[rndInt(0, MODIFIER_KEYS.length - 1)];
  // No additional registration step required — but assert the derivation
  // pattern is intact so a future refactor can't silently de-list FRAGILE.
  assert.ok(/const MODIFIER_KEYS = Object\.keys\(FLOOR_MODIFIERS\);/.test(CONTENT),
    'MODIFIER_KEYS must remain Object.keys(FLOOR_MODIFIERS) so FRAGILE is auto-included');
});

test('FRAGILE applies 0.55x HP to non-boss enemies in spawnEnemy', () => {
  // Sits inside the `if (!isBoss)` guard alongside SWARM (0.6x) and
  // FORTIFIED (1.4x) — bosses are intentionally unscaled because their
  // phase transitions are HP-ratio based and tuned tight.
  assert.match(ENTITIES, /scaleEnemySpawnHpForModifier\(hp, _EG\.modifier, isBoss\)/,
    'spawnEnemy must route spawn HP through the modifier-scaling helper');
  const m = SPAWN_MODIFIERS.match(/modifier === 'FRAGILE'\)\s*return Math\.round\(hp \* (0\.\d+)\)/);
  assert.ok(m, 'FRAGILE HP scaling must be wired in the spawn modifier helper');
  const mul = parseFloat(m[1]);
  assert.ok(mul > 0 && mul < 1, `FRAGILE HP multiplier must be < 1 (glass), got ${mul}`);
  assert.ok(mul <= 0.65, `FRAGILE HP multiplier should be more aggressive than SWARM 0.6x to justify the player-damage tradeoff, got ${mul}`);
});

test('FRAGILE non-boss guard — boss HP must not be scaled', () => {
  // The FRAGILE branch must live inside `if (!isBoss)` next to SWARM /
  // FORTIFIED. If a future refactor moves it out, boss HP would be
  // halved and phase-transition tuning (SENTINEL/WARDEN/HIVE/CONDUCTOR/
  // OMEGA/GENESIS) would break.
  const block = SPAWN_MODIFIERS.match(/function scaleEnemySpawnHpForModifier[\s\S]{0,900}?return hp;\n\}/);
  assert.ok(block, 'spawn modifier helper must contain the non-boss modifier-scaling logic');
  assert.ok(/if \(isBoss\) return hp;[\s\S]*modifier === 'FRAGILE'/.test(block[0]),
    'FRAGILE HP scaling must be guarded by the early boss return to exempt bosses');
});

test('FRAGILE amplifies damage to player in player.takeDamage', () => {
  // Sits after the def/CORROSIVE branches so it multiplies post-mitigation
  // damage. Floor at 1 to preserve the "at least 1 damage" contract from
  // the def branch above (Math.max(1, ...) on the def subtraction).
  // Gated on `!options.ignoreDefense` to skip fractional environmental
  // DoT ticks (Plasma/Toxic/Arc/Disruption/Frost) — see anti-regression
  // test below.
  const m = ENTITIES.match(/_EG\.modifier === 'FRAGILE' && !options\.ignoreDefense\)\s*\{\s*actual = Math\.max\(1, Math\.round\(actual \* (1\.\d+)\)\);/);
  assert.ok(m, 'FRAGILE damage amplification must be wired in player.takeDamage with ignoreDefense gate');
  const mul = parseFloat(m[1]);
  assert.ok(mul > 1, `FRAGILE damage multiplier must be > 1, got ${mul}`);
  assert.ok(mul <= 1.5, `FRAGILE damage multiplier should stay <= 1.5 to avoid one-shot territory at NIGHTMARE, got ${mul}`);
});

test('FRAGILE damage amp is gated on !options.ignoreDefense (anti-regression)', () => {
  // Anti-regression for adversarial review finding (gpt-5.3-codex,
  // 2026-04-27): without this gate, Math.max(1, Math.round(actual*1.3))
  // forces fractional environmental DoT ticks (Plasma burnDps*dt at
  // ~0.13/frame, Toxic Pool toxDps*dt at ~0.04/frame, Arc Grid,
  // Disruption Field, Frost Patch — all set ignoreDefense:true and pass
  // sub-1 fractional damage per frame) up to >=1/frame, ballooning
  // 10 DPS environmental burns into ~60 DPS instakills. The gate
  // mirrors CORROSIVE's existing `!options.ignoreDefense` gate so both
  // floor modifiers route around env-DoT identically.
  assert.ok(/_EG\.modifier === 'FRAGILE' && !options\.ignoreDefense/.test(ENTITIES),
    'FRAGILE damage amp must be gated on !options.ignoreDefense to skip fractional env-DoT');
  // Round-2 hardening (also gpt-5.3-codex): assert that EVERY FRAGILE
  // mention in entities.js that touches `actual` (the player damage
  // accumulator) is gated. A future second ungated branch added
  // alongside (e.g., copy-paste or a different damage shape) would
  // bypass the round-1 fix invisibly. Spawn-side HP scaling now lives in
  // src/entities/spawn-modifiers.js, so entities.js should only contain the
  // takeDamage gated branch.
  const allFragile = ENTITIES.match(/_EG\.modifier === 'FRAGILE'[^\n]*/g) || [];
  assert.equal(allFragile.length, 1,
    `entities.js must contain exactly 1 _EG.modifier === 'FRAGILE' reference (takeDamage amp); got ${allFragile.length}: ${JSON.stringify(allFragile)}`);
  for (const ref of allFragile) {
    if (ref.includes('actual')) {
      assert.ok(ref.includes('!options.ignoreDefense'),
        `FRAGILE branch touching player damage accumulator 'actual' must be gated on !options.ignoreDefense, got: ${ref}`);
    }
  }
});

test('FRAGILE damage amp applied after CORROSIVE so the +2 is also amplified', () => {
  // CORROSIVE (+2 flat) and FRAGILE (×1.3) can never co-occur on the
  // same floor (single-modifier system: _EG.modifier is one string),
  // so their interaction is irrelevant in practice — but the ordering
  // assertion documents and locks the intended sequence: def reduction →
  // CORROSIVE flat-add → FRAGILE multiplier → floor at 1.
  const idxC = ENTITIES.indexOf("_EG.modifier === 'CORROSIVE'");
  const idxF = ENTITIES.indexOf("_EG.modifier === 'FRAGILE' && !options.ignoreDefense");
  assert.ok(idxC !== -1, 'CORROSIVE branch must exist');
  assert.ok(idxF !== -1, 'FRAGILE branch must exist');
  assert.ok(idxF > idxC, 'FRAGILE multiplier must run AFTER CORROSIVE flat-add');
});

test('FRAGILE preserves the "at least 1 damage" contract', () => {
  // The takeDamage def branch uses Math.max(1, dmg - def - titanium) so
  // a defensive build never trivialises a hit. The FRAGILE branch uses
  // Math.max(1, Math.round(actual * 1.3)) so an inbound 1-damage hit
  // can never be rounded down to 0 (Math.round(1*1.3) = 1, but
  // belt-and-braces in case future tuning multiplies by < 1).
  assert.ok(/Math\.max\(1, Math\.round\(actual \* 1\.\d+\)\)/.test(ENTITIES),
    'FRAGILE damage line must wrap in Math.max(1, ...) to preserve the at-least-1 contract');
});

test('FRAGILE has no overlap with existing modifiers (cross-check)', () => {
  // Existing 8 modifiers cover: vision (BLACKOUT), HP-down (SWARM),
  // HP-up (FORTIFIED), corpse-explode (VOLATILE), aim-spread (SCRAMBLED),
  // enemy-speed (OVERCLOCK), flat-dmg-to-player (CORROSIVE), projectile-
  // speed (CHARGED). FRAGILE is the first to combine an HP-down with a
  // multiplicative damage-to-player buff — a distinct tradeoff shape.
  // Sanity-check none of those terms appear in the FRAGILE description.
  const m = CONTENT.match(/FRAGILE:[^}]*desc:\s*'([^']+)'/);
  assert.ok(m, 'FRAGILE entry must exist');
  const desc = m[1].toLowerCase();
  // Must not duplicate existing modifier descriptions verbatim.
  assert.ok(!/emergency lights|alert|reinforced patrols|unstable power|targeting interference|system overclock|toxic atmosphere|supercharged projectiles/.test(desc),
    `FRAGILE desc must be distinct from existing 8 modifiers, got "${desc}"`);
});

test('sw.js cache freshness does not use a second numeric version', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /cacheFromNetwork\(e\)/);
});
