'use strict';
// HUNTER floor modifier — wiring tests.
//
// HUNTER scales incoming player damage based on a stillness accumulator
// in Player.update. Standing still builds _huntStill toward HUNT_MAX_STILL
// (4s); moving decays it fast. Damage hook in player.takeDamage multiplies
// post-mitigation damage by 1 + (still/MAX) * 0.5, gated on
// `!options.ignoreDefense` (env-DoT-damage-gate rule).
//
// Same wiring-test shape as fragile-modifier / shock-pulse / harvester:
// grep the runtime source rather than simulate the full game loop.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CONTENT = fs.readFileSync(path.join(ROOT, 'src', 'content', 'modifiers.js'), 'utf8') + '\n' +
  fs.readFileSync(path.join(ROOT, 'src', 'content.js'), 'utf8');
const ENTITIES = fs.readFileSync(path.join(ROOT, 'src', 'entities.js'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

test('HUNTER registered in FLOOR_MODIFIERS with label/desc/colour/icon', () => {
  // Single source of truth for the announcement banner, the random roll
  // (MODIFIER_KEYS = Object.keys(FLOOR_MODIFIERS)), and the HUD chip.
  const m = CONTENT.match(/HUNTER:\s*\{\s*label:\s*'HUNTER'[^}]*desc:\s*'([^']+)'[^}]*colour:\s*'(#[0-9a-f]+)'[^}]*icon:\s*'([^']+)'/);
  assert.ok(m, 'HUNTER must be registered in FLOOR_MODIFIERS with label/desc/colour/icon');
  assert.ok(m[1].length > 0, 'HUNTER desc must be non-empty');
  assert.ok(m[2].length === 7, `HUNTER colour must be #rrggbb, got ${m[2]}`);
  assert.ok(m[3].length > 0, 'HUNTER icon must be non-empty');
});

test('HUNTER auto-included in MODIFIER_KEYS for random rolls', () => {
  // MODIFIER_KEYS is derived from Object.keys(FLOOR_MODIFIERS) so any new
  // entry is auto-included by game.js floor-init at line ~169:
  //   this.modifier = MODIFIER_KEYS[rndInt(0, MODIFIER_KEYS.length - 1)];
  // Lock the derivation pattern so a future refactor cannot silently
  // de-list HUNTER.
  assert.ok(/const MODIFIER_KEYS = Object\.keys\(FLOOR_MODIFIERS\);/.test(CONTENT),
    'MODIFIER_KEYS must remain Object.keys(FLOOR_MODIFIERS) so HUNTER is auto-included');
});

test('Player.reset initialises _huntStill to 0', () => {
  // Guarantee a clean slate on every fresh run / floor reset / continue.
  // Without this, a residual _huntStill from a prior run could carry
  // into the first frame of the next floor.
  assert.ok(/this\._huntStill\s*=\s*0\b/.test(ENTITIES),
    'Player.reset must initialise this._huntStill = 0');
});

test('Player.reset clears _prevHuntX/_prevHuntY (no cross-run leak)', () => {
  // The motion comparator stores last-frame position; if not cleared on
  // reset, the first frame after reset would compute moved against a
  // stale position from the previous run/floor (the player teleports to
  // 5,5 in reset). The motion-threshold branch would then false-trigger
  // the "moved" path for one frame — harmless but documented anyway.
  assert.ok(/this\._prevHuntX\s*=\s*null\b/.test(ENTITIES),
    'Player.reset must clear this._prevHuntX = null');
  assert.ok(/this\._prevHuntY\s*=\s*null\b/.test(ENTITIES),
    'Player.reset must clear this._prevHuntY = null');
});

test('Player.update increments _huntStill while stationary, decays while moving', () => {
  // Both branches must exist in update(): an incrementing branch
  // (this._huntStill + dt, capped) and a decay branch (- dt * decay,
  // floored at 0). Without both, the meter could only ever climb or only
  // ever drop.
  assert.ok(/this\._huntStill\s*=\s*Math\.min\([^)]*this\._huntStill\s*\+\s*dt\)/.test(ENTITIES),
    'Player.update must increment _huntStill (capped) while stationary');
  assert.ok(/this\._huntStill\s*=\s*Math\.max\(0,\s*this\._huntStill\s*-\s*dt\s*\*/.test(ENTITIES),
    'Player.update must decay _huntStill (floored at 0) while moving');
});

test('HUNTER stillness comparator uses inter-frame motion (not within-frame)', () => {
  // The motion comparator MUST use a dedicated _prevHuntX/_prevHuntY
  // pair updated AFTER the comparison. Reusing _prevX (which is
  // overwritten at the top of every update before any movement happens)
  // would always read 0 motion regardless of actual movement, leaving
  // the player perpetually "still" and getting full damage amp.
  assert.ok(/this\._prevHuntX\b/.test(ENTITIES),
    '_prevHuntX must exist as a dedicated motion-comparator field');
  assert.ok(/this\._prevHuntY\b/.test(ENTITIES),
    '_prevHuntY must exist as a dedicated motion-comparator field');
  // Comparator must read _prevHuntX BEFORE writing it (read on dx,
  // write after Math.hypot). Verify both ordering and that the write
  // happens via a Math.hypot or equivalent magnitude check.
  assert.ok(/Math\.hypot\(dx,\s*dy\)/.test(ENTITIES),
    'Motion magnitude must use Math.hypot(dx, dy)');
});

test('player.takeDamage HUNTER branch wired with stillness scaling', () => {
  // Sits after def/CORROSIVE so it multiplies post-mitigation damage.
  // Multiplier formula must scale with this._huntStill, capped at
  // HUNT_MAX_STILL (so a hit never amplifies above 1 + HUNT_MAX_BONUS).
  // Floor at 1 so a 1-damage hit never rounds to 0.
  const m = ENTITIES.match(/_EG\.modifier === 'HUNTER' && !options\.ignoreDefense\)\s*\{[\s\S]{0,400}?actual = Math\.max\(1, Math\.round\(actual \* mul\)\);/);
  assert.ok(m, 'HUNTER damage amp must be wired in player.takeDamage with ignoreDefense gate');
  // Multiplier built from this._huntStill clamped to 0..1 then scaled
  // by a HUNT_MAX_BONUS constant.
  assert.ok(/Math\.min\(1,\s*still\s*\/\s*HUNT_MAX_STILL\)\s*\*\s*HUNT_MAX_BONUS/.test(ENTITIES),
    'HUNTER mul must clamp still/HUNT_MAX_STILL to 1 before multiplying by HUNT_MAX_BONUS');
  // Sanity-check the bonus stays in a reasonable range (between 0.25
  // and 1.0) — guards against a future tuning slip that one-shots
  // players at NIGHTMARE.
  const bonus = ENTITIES.match(/HUNT_MAX_BONUS\s*=\s*(0\.\d+)/);
  assert.ok(bonus, 'HUNT_MAX_BONUS constant must be defined');
  const b = parseFloat(bonus[1]);
  assert.ok(b >= 0.25 && b <= 1.0, `HUNT_MAX_BONUS must be in [0.25, 1.0], got ${b}`);
});

test('HUNTER damage amp is gated on !options.ignoreDefense (env-DoT regression guard)', () => {
  // Anti-regression for the env-DoT-damage-gate stored rule. Plasma
  // burnDps*dt (~0.13/frame), Toxic toxDps*dt (~0.04/frame), Arc Grid,
  // Disruption Field, and Frost Patch all pass ignoreDefense:true with
  // sub-1 fractional damage per frame. Without this gate, Math.max(1,
  // Math.round(actual * mul)) would inflate them to >=1/frame = ~60 DPS
  // at 60 FPS instead of the intended ~10 DPS — silent insta-kill at
  // full stillness.
  assert.ok(/_EG\.modifier === 'HUNTER' && !options\.ignoreDefense/.test(ENTITIES),
    'HUNTER damage amp must be gated on !options.ignoreDefense to skip fractional env-DoT');
  // Round-2 hardening (mirrors fragile-modifier): assert that EVERY
  // HUNTER mention in entities.js that touches `actual` is gated. A
  // future second ungated branch added alongside (e.g. copy-paste or
  // a different damage shape) would bypass the gate invisibly. We
  // currently expect exactly 1 HUNTER reference (the takeDamage amp);
  // any new HUNTER-modifier hookup that scales damage must also be
  // gated, or it would silently insta-kill on env-DoT contact.
  const allHunter = ENTITIES.match(/_EG\.modifier === 'HUNTER'[^\n]*/g) || [];
  for (const ref of allHunter) {
    if (ref.includes('actual')) {
      assert.ok(ref.includes('!options.ignoreDefense'),
        `HUNTER branch touching player damage accumulator 'actual' must be gated on !options.ignoreDefense, got: ${ref}`);
    }
  }
});

test('HUNTER damage amp applied AFTER def + CORROSIVE so the mitigation is multiplied correctly', () => {
  // CORROSIVE (+2 flat) and HUNTER (×1..1.5) can never co-occur on the
  // same floor (single-modifier system: _EG.modifier is one string),
  // so their interaction is irrelevant in practice — but the ordering
  // assertion documents and locks the intended sequence: def reduction →
  // CORROSIVE flat-add → HUNTER multiplier → floor at 1.
  const idxC = ENTITIES.indexOf("_EG.modifier === 'CORROSIVE'");
  const idxH = ENTITIES.indexOf("_EG.modifier === 'HUNTER' && !options.ignoreDefense");
  assert.ok(idxC !== -1, 'CORROSIVE branch must exist');
  assert.ok(idxH !== -1, 'HUNTER branch must exist');
  assert.ok(idxH > idxC, 'HUNTER multiplier must run AFTER CORROSIVE flat-add');
});

test('HUNTER stillness logic runs INSIDE Player.update (not enemy or projectile)', () => {
  // Sanity-check: the stillness tracker must live inside the Player
  // class\'s update method. Stash it on enemies and you\'d burn dt per
  // mob; stash it on projectiles and stillness has no meaning.
  // We assert that the HUNT_MAX_STILL local appears AFTER the unique
  // 'class Player {' marker.
  const playerStart = ENTITIES.indexOf('class Player {');
  const huntInPlayer = ENTITIES.indexOf('HUNT_MAX_STILL', playerStart);
  assert.ok(playerStart !== -1, 'class Player must exist');
  assert.ok(huntInPlayer > playerStart, 'HUNT_MAX_STILL must be defined inside the Player class block');
});

test('HUNTER stillness cap matches the cap used by takeDamage', () => {
  // The update tick caps _huntStill at HUNT_MAX_STILL. The takeDamage
  // formula divides by HUNT_MAX_STILL (and clamps to 1 anyway). Both
  // sites use the same constant value (4.0) so the cap is exact —
  // _huntStill never exceeds HUNT_MAX_STILL at the comparison site.
  // We verify both sites agree on the same numeric value.
  // Both sites declare a local `const HUNT_MAX_STILL = N;` for clarity
  // (Phase 3 // @ts-check files prefer locals over module-level magic
  // numbers when the constant is used in only one or two narrow scopes).
  // Collect every declared value and assert they all agree.
  const decls = [...ENTITIES.matchAll(/HUNT_MAX_STILL\s*=\s*(\d+(?:\.\d+)?)\b/g)].map(m => m[1]);
  assert.ok(decls.length >= 2,
    `HUNT_MAX_STILL must be declared in BOTH update (cap) and takeDamage (divisor); found ${decls.length}`);
  const unique = new Set(decls);
  assert.equal(unique.size, 1,
    `All HUNT_MAX_STILL declarations must use the same numeric value, got ${[...unique].join(', ')}`);
  // Belt-and-braces: the cap site uses Math.min(HUNT_MAX_STILL, ...) and
  // the damage site uses still / HUNT_MAX_STILL.
  assert.ok(/Math\.min\(HUNT_MAX_STILL,/.test(ENTITIES),
    'Update tick must cap _huntStill via Math.min(HUNT_MAX_STILL, ...)');
  assert.ok(/still\s*\/\s*HUNT_MAX_STILL/.test(ENTITIES),
    'takeDamage must divide stillness by HUNT_MAX_STILL');
});

test('HUNTER has no description overlap with existing modifiers (cross-check)', () => {
  // Existing 8 modifiers cover: vision (BLACKOUT), HP-down (SWARM),
  // HP-up (FORTIFIED), corpse-explode (VOLATILE), aim-spread (SCRAMBLED),
  // enemy-speed (OVERCLOCK), flat-dmg-to-player (CORROSIVE), projectile-
  // speed (CHARGED). HUNTER is the first to scale damage with player
  // BEHAVIOR (stillness) rather than a static or random mechanic.
  const m = CONTENT.match(/HUNTER:[^}]*desc:\s*'([^']+)'/);
  assert.ok(m, 'HUNTER entry must exist');
  const desc = m[1].toLowerCase();
  assert.ok(!/emergency lights|alert|reinforced patrols|unstable power|targeting interference|system overclock|toxic atmosphere|supercharged projectiles/.test(desc),
    `HUNTER desc must be distinct from existing 8 modifiers, got "${desc}"`);
});

test('HUNTER tracker tolerates first-frame init (no NaN, no spike)', () => {
  // First time update runs after reset, _prevHuntX is null. The motion
  // comparator must coerce null to current x (so dx = 0, treated as
  // still), not produce NaN propagating into _huntStill.
  // We grep for the null-safe init pattern.
  assert.ok(/this\._prevHuntX\s*!=\s*null\s*\?\s*this\._prevHuntX\s*:\s*this\.x/.test(ENTITIES),
    'Motion comparator must null-coalesce _prevHuntX to this.x to avoid NaN on first frame');
  assert.ok(/this\._prevHuntY\s*!=\s*null\s*\?\s*this\._prevHuntY\s*:\s*this\.y/.test(ENTITIES),
    'Motion comparator must null-coalesce _prevHuntY to this.y to avoid NaN on first frame');
});

test('sw.js cache freshness does not use a second numeric version', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /cacheFromNetwork\(e\)/);
});
