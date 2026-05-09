'use strict';
// SAPPER mob — wiring tests + drainTimedBoost helper unit tests.
//
// SAPPER is a fast fragile melee chaser whose contact hit drains time
// from a random ACTIVE TIMED BOOST. The drain helper lives in
// src/meta/boosts.js and is fully testable in isolation; the AI/draw
// wiring is asserted via source-text regex (entities.js is browser-only,
// no UMD/CommonJS exports — same pattern as spectre.test.js etc.).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);
const SOURCE_METADATA = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities', 'source-metadata.js'), 'utf8'
);
const SW = fs.readFileSync(
  path.resolve(__dirname, '..', 'sw.js'), 'utf8'
);
const boosts = require('../src/meta/boosts.js');

// ─── Wiring assertions ──────────────────────────────────────────────────

test('SAPPER appears in ENEMY_WEIGHTS with floor 5+ gate', () => {
  // Floor 5: HARVESTER (floor 4+) drops HARVEST_SURGE which is the
  // only timed boost in the world today. Spawning SAPPER before any
  // timed boost can exist would make the leech mechanic invisible.
  const m = ENTITIES.match(/SAPPER:\s*\{\s*base:\s*\d+,\s*perFloor:\s*\d+,\s*minFloor:\s*(\d+)/);
  assert.ok(m, 'SAPPER must be registered in ENEMY_WEIGHTS');
  assert.ok(parseInt(m[1], 10) >= 5,
    `SAPPER minFloor should be >= 5 (after first timed-boost source), got ${m[1]}`);
});

test('SAPPER has a stat row in spawnEnemy switch', () => {
  // Missing case → spawnEnemy returns an Enemy with hp=0, instantly dead.
  const m = ENTITIES.match(/case\s+'SAPPER':[^\n]*hp\s*=\s*(\d+)[^\n]*atk\s*=\s*(\d+)[^\n]*spd\s*=\s*([\d.]+)[^\n]*xpVal\s*=\s*(\d+)/);
  assert.ok(m, 'SAPPER stat row missing');
  // Fragile: must be killable in ~1 burst from a mid-floor weapon.
  // Anchor an upper bound so the design intent ("kill before contact")
  // can't silently regress to a tank.
  const hp = parseInt(m[1], 10);
  assert.ok(hp > 0 && hp <= 35, `SAPPER hp should be in (0,35], got ${hp}`);
  // Must do contact damage — atk > 0. Drain alone (no melee damage)
  // would make SAPPER a non-threat for boostless players.
  assert.ok(parseInt(m[2], 10) > 0, 'SAPPER must have non-zero atk (contact damage)');
  // Must be fast — slow chasers are trivially kited.
  assert.ok(parseFloat(m[3]) >= 2.4, `SAPPER spd should be >= 2.4 (fast chaser), got ${m[3]}`);
});

test('SAPPER spawn init block sets _saPulse', () => {
  // Without _saPulse the draw branch reads undefined and the
  // tendril/body wobble is in lock-step across a clustered spawn.
  // Stagger via cosmetic RNG so a pack of SAPPERs reads as
  // independent agents.
  const block = ENTITIES.match(/if\s*\(type\s*===\s*'SAPPER'\)[\s\S]{0,300}\}/);
  assert.ok(block, 'SAPPER init block missing');
  assert.match(block[0], /_saPulse\s*=/, 'SAPPER must initialise _saPulse');
  assert.match(block[0], /rand\('cosmetic'\)/,
    'SAPPER init must stagger _saPulse with the cosmetic RNG');
});

test('SAPPER is excluded from the elite affix roll', () => {
  // First-ship caution: keeps the new drain mechanic off the elite
  // surface area. Mirror the existing exclusion pattern for
  // recently-introduced mobs.
  const re = /allowElite[\s\S]{0,1200}type\s*!==\s*'SAPPER'/;
  assert.match(ENTITIES, re, 'SAPPER must be in the elite-exclusion guard');
});

test('SAPPER has CREDIT_VALUES entry', () => {
  // Without an entry, die() falls back to 5 credits — explicit entry
  // keeps reward tuning intentional.
  assert.match(SOURCE_METADATA, /SAPPER\s*:\s*\d+/);
});

test('SAPPER has SOURCE_LABELS entry', () => {
  // Required for damage recap / death log to show the friendly name
  // instead of the uppercase enum.
  assert.match(SOURCE_METADATA, /SAPPER\s*:\s*'Sapper'/);
});

test('SAPPER has SOURCE_COLOURS entry', () => {
  // Required so the damage recap log renders source-coloured rows.
  assert.match(SOURCE_METADATA, /SAPPER\s*:\s*'#[0-9a-fA-F]{3,6}'/);
});

test('SAPPER has AI dispatch case', () => {
  assert.match(ENTITIES, /case\s+'SAPPER'\s*:\s*this\.aiSapper\(/);
});

test('SAPPER aiSapper method exists with correct contract', () => {
  // Anchor on the method definition (no `this.` prefix and starts at
  // column 2) so we don't accidentally match the dispatch switch case.
  const fn = ENTITIES.match(/\n  aiSapper\s*\([\s\S]*?\n  \}\n/);
  assert.ok(fn, 'aiSapper method must exist');
  // Must call meleeAttack on contact — without this, atk is decorative
  // (no generic enemy-body collision damage path exists). Class of
  // bug caught on the WARDLING PR.
  assert.match(fn[0], /this\.meleeAttack\(player\)/,
    'aiSapper must call this.meleeAttack(player) on contact');
  // Must use moveToward with raw this.spd so the modSpeed / berserker
  // / slowFactor modifiers apply internally — never pre-multiply.
  // Class of bug caught on the VENGEANCE PR (moveToward modifiers).
  assert.match(fn[0], /moveToward\s*\(\s*this\._tx,\s*this\._ty,\s*this\.spd/,
    'aiSapper chase must call moveToward with raw this.spd');
});

test('SAPPER tuning constants are defined', () => {
  assert.match(ENTITIES, /const\s+SAPPER_DRAIN_SECS\s*=\s*\d+/);
  assert.match(ENTITIES, /const\s+SAPPER_CHASE_RANGE\s*=\s*\d+/);
  assert.match(ENTITIES, /const\s+SAPPER_MELEE_RANGE\s*=\s*[\d.]+/);
});

test('SAPPER drain hook lives inside meleeAttack and is gated on dealt > 0', () => {
  // The drain piggy-backs the existing CRAWLER-style on-hit hook so
  // a parry / shield-absorb (which produces dealt === 0) correctly
  // skips the drain. If the gate ever drops to a bare type check,
  // shielded players would still lose boost time on absorbed hits —
  // a silent fairness regression.
  const melee = ENTITIES.match(/\n  meleeAttack\s*\([\s\S]*?\n  \}\n/);
  assert.ok(melee, 'meleeAttack method not found');
  assert.match(melee[0],
    /dealt\s*>\s*0\s*&&\s*this\.type\s*===\s*'SAPPER'/,
    'SAPPER drain must be gated on `dealt > 0 && this.type === SAPPER`');
  // Helper must be invoked through NEON.boosts (not a direct mutation
  // of player._boostTimers) so the expiry semantics are unified with
  // tickBoosts. If the call site is ever inlined, the "expire eagerly
  // when remaining <= 0" contract can drift.
  assert.match(melee[0], /NEON\.boosts\.drainTimedBoost\s*\(\s*player\s*,/,
    'SAPPER must drain via NEON.boosts.drainTimedBoost(player, secs)');
  // Floating-text feedback only renders when something was actually
  // drained — null return must short-circuit the spawnDmgText call.
  assert.match(melee[0], /if\s*\(\s*drained\s*\)[\s\S]{0,100}spawnDmgText/,
    'SAPPER must only spawn the drain floater when drainTimedBoost returned a non-null id');
});

test('SAPPER draw branch exists and uses _saPulse', () => {
  // The draw branch is the player's only way to identify SAPPER at a
  // glance before contact — without a distinct silhouette the leech
  // reads as a generic chaser and the player can't preemptively
  // prioritise it.
  const re = /t\s*===\s*'SAPPER'[\s\S]{0,1200}_saPulse/;
  assert.match(ENTITIES, re,
    'SAPPER must have a draw branch that consumes _saPulse for the tendril/body wobble');
});

test('sw.js cache freshness does not use a numeric cache key', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /const\s+CACHE\s*=\s*'neon-dungeon-assets'/);
});

// ─── drainTimedBoost helper unit tests ──────────────────────────────────

test('drainTimedBoost: returns null when player has no timed boost', () => {
  const p = { activeBoosts: {}, _boostTimers: {} };
  assert.strictEqual(boosts.drainTimedBoost(p, 4), null);
});

test('drainTimedBoost: returns null when _boostTimers is missing', () => {
  // Defensive: should never throw when the player object is in a
  // partially-initialised state (e.g. mid-load before _boostTimers
  // is seeded).
  const p = { activeBoosts: {} };
  assert.strictEqual(boosts.drainTimedBoost(p, 4), null);
});

test('drainTimedBoost: returns null when player is null/undefined', () => {
  // Another defensive guard — meleeAttack passes player blindly.
  assert.strictEqual(boosts.drainTimedBoost(null, 4), null);
  assert.strictEqual(boosts.drainTimedBoost(undefined, 4), null);
});

test('drainTimedBoost: returns null for non-positive drain seconds', () => {
  // Drain of 0 or negative is meaningless — short-circuit so callers
  // can't accidentally extend a boost by passing a negative value.
  const p = { activeBoosts: { HARVEST_SURGE: true }, _boostTimers: { HARVEST_SURGE: 6 } };
  assert.strictEqual(boosts.drainTimedBoost(p, 0), null);
  assert.strictEqual(boosts.drainTimedBoost(p, -3), null);
  // Timer untouched.
  assert.strictEqual(p._boostTimers.HARVEST_SURGE, 6);
  assert.strictEqual(p.activeBoosts.HARVEST_SURGE, true);
});

test('drainTimedBoost: shaves seconds from the only active timer', () => {
  const p = { activeBoosts: { HARVEST_SURGE: true }, _boostTimers: { HARVEST_SURGE: 6 } };
  const got = boosts.drainTimedBoost(p, 4);
  assert.strictEqual(got, 'HARVEST_SURGE');
  // 6 - 4 = 2 remaining.
  assert.strictEqual(p._boostTimers.HARVEST_SURGE, 2);
  // Still active — boost survives the partial drain.
  assert.strictEqual(p.activeBoosts.HARVEST_SURGE, true);
});

test('drainTimedBoost: expires boost atomically when drain exceeds remaining', () => {
  // Mirrors tickBoosts's expiry semantics — without the eager expire
  // the activeBoosts flag would linger with no timer until next
  // tickBoosts call, so multipliers (getBoostDamageMul/etc.) would
  // stay enabled with no remaining time.
  const p = { activeBoosts: { HARVEST_SURGE: true }, _boostTimers: { HARVEST_SURGE: 3 } };
  const got = boosts.drainTimedBoost(p, 4);
  assert.strictEqual(got, 'HARVEST_SURGE');
  // Both timer and active flag must be cleared atomically.
  assert.strictEqual(p._boostTimers.HARVEST_SURGE, undefined);
  assert.strictEqual(p.activeBoosts.HARVEST_SURGE, undefined);
});

test('drainTimedBoost: expires boost on exact-zero remaining', () => {
  // Boundary case: 4s drain on a 4s timer should expire (NOT leave at 0).
  // Multipliers gated on hasBoost would stay enabled at 0s otherwise.
  const p = { activeBoosts: { HARVEST_SURGE: true }, _boostTimers: { HARVEST_SURGE: 4 } };
  boosts.drainTimedBoost(p, 4);
  assert.strictEqual(p._boostTimers.HARVEST_SURGE, undefined);
  assert.strictEqual(p.activeBoosts.HARVEST_SURGE, undefined);
});

test('drainTimedBoost: ignores already-expired entries (non-positive remaining)', () => {
  // Defensive: if for some reason a timer entry is sitting at 0 or
  // negative (e.g. between a tickBoosts decrement and the next frame
  // where it would be deleted), we should NOT pick it as a drain
  // target. Returning null lets the caller skip the floater rather
  // than spawning a "-4s" notice for a boost the player no longer has.
  const p = { activeBoosts: {}, _boostTimers: { STALE_BOOST: 0 } };
  assert.strictEqual(boosts.drainTimedBoost(p, 4), null);
  // Timer untouched — stale entry will be cleaned up by tickBoosts.
  assert.strictEqual(p._boostTimers.STALE_BOOST, 0);
});

test('drainTimedBoost: only picks from active (positive) timers when multiple present', () => {
  // Synthesise a future scenario where multiple timed boosts coexist
  // (the drain helper auto-applies to any future timed boost). Drain
  // must pick ONLY among positive-timer entries, never the stale 0.
  const p = {
    activeBoosts: { ALPHA: true, BETA: true },
    _boostTimers: { ALPHA: 5, BETA: 5, STALE: 0 }
  };
  // Run several times; the chosen id must never be STALE.
  for (let i = 0; i < 30; i++) {
    // Reset live timers each iteration.
    p._boostTimers.ALPHA = 5; p._boostTimers.BETA = 5; p._boostTimers.STALE = 0;
    p.activeBoosts.ALPHA = true; p.activeBoosts.BETA = true;
    const got = boosts.drainTimedBoost(p, 1);
    assert.ok(got === 'ALPHA' || got === 'BETA',
      `drain must pick ALPHA or BETA, never STALE — got ${got}`);
  }
});

test('drainTimedBoost: exported from NEON.boosts', () => {
  // Lock the export name — meleeAttack reads NEON.boosts.drainTimedBoost
  // directly and a rename here would silently drop SAPPER's drain
  // (the typeof check would short-circuit and the test that asserts
  // "if (drained) spawnDmgText" would still pass against the source).
  assert.strictEqual(typeof boosts.drainTimedBoost, 'function');
});
