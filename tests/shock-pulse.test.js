'use strict';
// SHOCK_PULSE pickup — wiring tests.
//
// SHOCK_PULSE is a defensive panic-button consumable (NON-DAMAGING). On
// player contact it discharges an AoE knockback + brief stun centred on
// the player. Distinct from currency pickups (MAGPIE hoard / VAULTMASTER
// VaultCoin) and the timed-buff pickup (HARVESTER HarvestPickup): the
// payoff here is positional / tempo (panic-eject a swarm).
//
// Source-text wiring tests (entities.js / content/pickups.js / game.js are
// browser-only — no UMD/CommonJS exports — same pattern as
// vaultmaster.test.js, magpie.test.js, etc).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);
const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
);
const CONTENT_PICKUPS = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content', 'pickups.js'), 'utf8'
);
const GAME = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8'
);
const RENDER = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'render.js'), 'utf8'
);
const PLATFORM = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'platform.js'), 'utf8'
);
const SW = fs.readFileSync(
  path.resolve(__dirname, '..', 'sw.js'), 'utf8'
);

// ─── Class definition ─────────────────────────────────────────────────────

test('ShockPulsePickup class is declared in content/pickups.js', () => {
  assert.match(CONTENT_PICKUPS, /class\s+ShockPulsePickup\s*\{/,
    'ShockPulsePickup class must be defined in src/content/pickups.js');
});

test('ShockPulsePickup carries an isShockPulse marker for the pickup branch', () => {
  // Locate just the class body and assert the flag is set inside the
  // constructor — guards against future renames or accidental removal.
  const m = CONTENT_PICKUPS.match(/class\s+ShockPulsePickup\s*\{[\s\S]*?\n\}/);
  assert.ok(m, 'ShockPulsePickup class body must be locatable');
  assert.match(m[0], /this\.isShockPulse\s*=\s*true/,
    'constructor must set this.isShockPulse = true (pickup branch trigger)');
  assert.match(m[0], /this\.dead\s*=\s*false/,
    'constructor must initialise this.dead = false (item-array contract)');
});

test('ShockPulsePickup has a draw method (visible on floor)', () => {
  const m = CONTENT_PICKUPS.match(/class\s+ShockPulsePickup\s*\{[\s\S]*?\n\}/);
  assert.ok(m && /draw\s*\([^\)]*\)\s*\{/.test(m[0]),
    'ShockPulsePickup.draw(camX, camY) must exist');
});

// ─── Tunable constants ────────────────────────────────────────────────────

test('SHOCK_PULSE constants are declared in content/pickups.js', () => {
  // Anchor lower/upper bounds so future tuning keeps the design intent:
  // moderate radius, ~1s stun (clipped for bosses), real but bounded knockback.
  const r = CONTENT_PICKUPS.match(/SHOCK_PULSE_RADIUS\s*=\s*([\d.]+)/);
  const s = CONTENT_PICKUPS.match(/SHOCK_PULSE_STUN\s*=\s*([\d.]+)/);
  const bs = CONTENT_PICKUPS.match(/SHOCK_PULSE_BOSS_STUN\s*=\s*([\d.]+)/);
  const k = CONTENT_PICKUPS.match(/SHOCK_PULSE_KNOCK\s*=\s*([\d.]+)/);
  assert.ok(r && s && bs && k,
    'SHOCK_PULSE_RADIUS / _STUN / _BOSS_STUN / _KNOCK constants must all be declared');
  const radius = parseFloat(r[1]);
  const stun = parseFloat(s[1]);
  const bossStun = parseFloat(bs[1]);
  const knock = parseFloat(k[1]);
  assert.ok(radius >= 3 && radius <= 7,
    `SHOCK_PULSE_RADIUS should be in [3,7] tiles, got ${radius}`);
  assert.ok(stun >= 0.5 && stun <= 2.0,
    `SHOCK_PULSE_STUN should be in [0.5,2.0] s, got ${stun}`);
  // Boss stun must be <= regular stun AND <= 0.3 (engine-wide boss stun cap).
  assert.ok(bossStun > 0 && bossStun <= 0.3 && bossStun <= stun,
    `SHOCK_PULSE_BOSS_STUN must be in (0,0.3] and <= SHOCK_PULSE_STUN, got ${bossStun}`);
  assert.ok(knock >= 1.0 && knock <= 4.0,
    `SHOCK_PULSE_KNOCK should be in [1,4] tiles, got ${knock}`);
});

// ─── triggerShockPulse helper (entities.js) ───────────────────────────────

test('triggerShockPulse() is defined in entities.js', () => {
  assert.match(ENTITIES, /function\s+triggerShockPulse\s*\(/,
    'triggerShockPulse() must be defined in src/entities.js');
});

test('triggerShockPulse iterates enemies, gates by radius AND hasLOS', () => {
  const m = ENTITIES.match(/function\s+triggerShockPulse\s*\([^)]*\)\s*\{[\s\S]*?\n\}/);
  assert.ok(m, 'triggerShockPulse body must be locatable');
  const body = m[0];
  assert.match(body, /for\s*\(\s*const\s+e\s+of\s+enemies\s*\)/,
    'must iterate global enemies array');
  assert.match(body, /e\.dead/,
    'must skip dead enemies');
  assert.match(body, /SHOCK_PULSE_RADIUS/,
    'must reference SHOCK_PULSE_RADIUS for the gate');
  assert.match(body, /hasLOS\s*\(\s*player\.x\s*,\s*player\.y\s*,\s*e\.x\s*,\s*e\.y\s*,\s*map\s*\)/,
    'knockback must be LOS-gated from player → enemy');
});

test('triggerShockPulse applies wall-aware swept knockback (no tunneling through walls)', () => {
  const m = ENTITIES.match(/function\s+triggerShockPulse\s*\([^)]*\)\s*\{[\s\S]*?\n\}/);
  assert.ok(m, 'triggerShockPulse body must be locatable');
  const body = m[0];
  // Sweep loop with small step size so a 2.5-tile push can't tunnel
  // across an interior wall (single-snap would). STEP <= 0.5 is the
  // upper safe bound (walls are 1 tile thick).
  const stepM = body.match(/STEP\s*=\s*([\d.]+)/);
  assert.ok(stepM && parseFloat(stepM[1]) <= 0.5,
    'sweep STEP size must be <= 0.5 tiles to defeat tunneling, got ' + (stepM && stepM[1]));
  // Per-step axis-independent passability check (slide along walls).
  assert.match(body, /isPassable\s*\(\s*map\s*\[\s*fyK\s*\]\s*\[\s*fxK\s*\]\s*\)/,
    'per-step X-axis check must use isPassable(map[fyK][fxK])');
  assert.match(body, /isPassable\s*\(\s*map\s*\[\s*yfK\s*\]\s*\[\s*xfK\s*\]\s*\)/,
    'per-step Y-axis check must use isPassable(map[yfK][xfK])');
  // Final combined-tile guard before committing the resting position
  // (defends against diagonal-corner cases where the joint tile is a wall).
  assert.match(body, /isPassable\s*\(\s*map\s*\[\s*finalFy\s*\]\s*\[\s*finalFx\s*\]\s*\)/,
    'final resting tile must pass a combined isPassable(map[finalFy][finalFx]) guard');
});

test('triggerShockPulse skips disguised mimics (mirrors EMP precedent)', () => {
  // EMP / shield-gen EMP both skip e._disguised so a stun message
  // doesn't leak the mimic's presence before the player triggers
  // its reveal. The non-damaging shockwave shares that constraint.
  const m = ENTITIES.match(/function\s+triggerShockPulse\s*\([^)]*\)\s*\{[\s\S]*?\n\}/);
  assert.ok(m, 'triggerShockPulse body must be locatable');
  assert.match(m[0], /e\._disguised/,
    'triggerShockPulse must skip e._disguised (mimic-leak parity with EMP)');
});

test('triggerShockPulse skips knockback on bosses but still applies a clipped stun', () => {
  const m = ENTITIES.match(/function\s+triggerShockPulse\s*\([^)]*\)\s*\{[\s\S]*?\n\}/);
  assert.ok(m, 'triggerShockPulse body must be locatable');
  const body = m[0];
  // Boss branch: stun-only, then continue (no knockback math reached).
  assert.match(body, /e\.isBoss/, 'must check e.isBoss');
  assert.match(body, /SHOCK_PULSE_BOSS_STUN/,
    'boss branch must use SHOCK_PULSE_BOSS_STUN (not the longer regular stun)');
  // Both branches must set stunTimer with Math.max so the pulse never
  // SHORTENS an existing longer stun.
  assert.match(body, /e\.stunTimer\s*=\s*Math\.max\s*\(\s*e\.stunTimer\b/,
    'stunTimer must be set with Math.max to avoid shortening longer existing stuns');
});

// ─── Pickup branch (game.js) ──────────────────────────────────────────────

test('game.js item pickup loop has an isShockPulse branch that calls triggerShockPulse', () => {
  // Anchor: branch must come BEFORE isWhisper (isShockPulse runs as a
  // separate dispatch — order isn't load-bearing today but pinning it
  // ensures the SHOCK_PULSE pickup is consistently grouped with the
  // other pickup-effect branches above the lore overlay).
  const idxShock = GAME.indexOf('it.isShockPulse');
  const idxWhisper = GAME.indexOf('it.isWhisper');
  assert.ok(idxShock !== -1, 'pickup loop must reference it.isShockPulse');
  assert.ok(idxWhisper !== -1, 'pickup loop must reference it.isWhisper (sanity)');
  assert.ok(idxShock < idxWhisper,
    'isShockPulse branch should appear before isWhisper (effect-pickup grouping)');
  // Branch body must call triggerShockPulse() and splice the pickup out.
  const slice = GAME.slice(idxShock, idxShock + 600);
  assert.match(slice, /triggerShockPulse\s*\(\s*\)/,
    'isShockPulse branch must invoke triggerShockPulse()');
  assert.match(slice, /items\.splice\s*\(\s*i\s*,\s*1\s*\)/,
    'isShockPulse branch must splice the pickup out of items[]');
});

// ─── populateFloor placement (render.js) ──────────────────────────────────

test('populateFloor places at most one ShockPulsePickup per floor on floor 3+', () => {
  const idx = RENDER.indexOf('populateFloor');
  assert.ok(idx !== -1, 'populateFloor must exist in render.js');
  // Once-per-floor flag declared above the room loop.
  assert.match(RENDER, /_shockPulseRoll\s*=\s*floorNum\s*>=\s*3/,
    '_shockPulseRoll must require floorNum >= 3 (mid-run+ tool)');
  assert.match(RENDER, /_shockPulsePlaced/,
    '_shockPulsePlaced flag must gate the per-floor cap');
  // Spawn must call new ShockPulsePickup and mark the floor as placed.
  assert.match(RENDER, /items\.push\s*\(\s*new\s+ShockPulsePickup\s*\(/,
    'populateFloor must spawn via new ShockPulsePickup');
});

test('SHOCK_PULSE placement skips special rooms (mirrors mine placement)', () => {
  // The placement block must guard with !rt (no roomType) so it never
  // collides with shrines / vendors / vaults / armories / medbays /
  // implant rooms — all of which have hand-curated content.
  const m = RENDER.match(/!_shockPulsePlaced[\s\S]{0,200}/);
  assert.ok(m, 'shockPulse placement block must reference _shockPulsePlaced');
  assert.match(m[0], /!\s*rt/,
    'placement guard must include !rt (skip special-typed rooms)');
});

// ─── Audio cue (platform.js) ──────────────────────────────────────────────

test('audio.shockPulse() cue is defined in platform.js', () => {
  assert.match(PLATFORM, /shockPulse\s*\(\s*\)\s*\{/,
    'audio.shockPulse() must be defined in src/platform.js');
});

// ─── Service worker cache freshness ────────────────────────────────────────

test('sw.js does not declare a second numeric cache version', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /cacheFromNetwork\(e\)/);
});
