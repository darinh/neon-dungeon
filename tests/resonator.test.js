'use strict';
// RESONATOR mob — source-text wiring tests + pure cone hit-test unit tests.
//
// entities.js is browser-only (no UMD/CommonJS exports), so we follow the
// same pattern as echoer.test.js / tunneller.test.js: assert structural
// invariants the mob needs by regex-matching the source text. We also
// duplicate the pure `isInsideCone` helper here for unit testing — the
// duplicate MUST stay in lock-step with the source-of-truth definition
// in src/entities.js (a structural assertion below guards against drift).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);
const ENEMY_SPAWN_TABLE = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities', 'spawn-table.js'), 'utf8'
);
const ENEMY_STATS = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities', 'enemy-stats.js'), 'utf8'
);
const ENEMY_CLASSIFICATION = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities', 'enemy-classification.js'), 'utf8'
);
const SOURCE_METADATA = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities', 'source-metadata.js'), 'utf8'
);
const ENTITY_AI_HELPERS = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities', 'ai-helpers.js'), 'utf8'
);
const PLATFORM = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'platform.js'), 'utf8'
);
const SW = fs.readFileSync(
  path.resolve(__dirname, '..', 'sw.js'), 'utf8'
);

// ─── Wiring assertions ──────────────────────────────────────────────────

test('RESONATOR appears in ENEMY_WEIGHTS with floor 6+ gate', () => {
  // Per design (mid-late zoner), minFloor must be >= 6.
  const m = ENEMY_SPAWN_TABLE.match(/RESONATOR:\s*\{\s*base:\s*\d+,\s*perFloor:\s*\d+,\s*minFloor:\s*(\d+)/);
  assert.ok(m, 'RESONATOR must be registered in ENEMY_WEIGHTS');
  assert.ok(parseInt(m[1], 10) >= 6, `RESONATOR minFloor should be >= 6, got ${m[1]}`);
});

test('RESONATOR has a stat row in ENEMY_BASE_STATS and is stationary', () => {
  // Missing case → spawnEnemy returns an Enemy with hp=0, instantly dead.
  // The mob is stationary by design — spd MUST be 0.
  const m = ENEMY_STATS.match(/RESONATOR:\s*\{[^\n]*hp:\s*(\d+),[^\n]*atk:\s*(\d+),[^\n]*spd:\s*([\d.]+),[^\n]*xpVal:\s*(\d+)/);
  assert.ok(m, 'RESONATOR stat row missing');
  assert.strictEqual(parseFloat(m[3]), 0, 'RESONATOR must be stationary (spd=0)');
  assert.ok(parseInt(m[1], 10) >= 40, 'RESONATOR HP feels too low');
  assert.ok(parseInt(m[2], 10) >= 8,  'RESONATOR atk feels too low');
});

test('RESONATOR spawn init block sets state + charge stagger', () => {
  // _rsState must start 'idle', _rsCharge must be > 0 (and ideally
  // randomised) so a clustered spawn doesn't telegraph in unison.
  const re = /if\s*\(type\s*===\s*'RESONATOR'\)[\s\S]{0,500}_rsState\s*=\s*'idle'[\s\S]{0,400}_rsCharge\s*=/;
  assert.match(ENTITIES, re, 'RESONATOR init must set _rsState=idle and randomised _rsCharge');
  // Stagger = seeded spawn RNG involvement — otherwise a pack fires together
  const init = ENTITIES.match(/if\s*\(type\s*===\s*'RESONATOR'\)[\s\S]{0,500}\}/);
  assert.ok(init && /rand\('spawn'\)/.test(init[0]), 'RESONATOR init must stagger _rsCharge with the seeded spawn RNG');
});

test('RESONATOR is excluded from the elite affix roll', () => {
  // Elite affixes (SHIELDED, BERSERKER, FRENZY, PHASING, ...) interact
  // poorly with the stationary cone mechanic and would push damage way
  // out of balance. Mirrors SNIPER/PULSER/TUNNELLER/ECHOER exclusions.
  assert.match(ENEMY_CLASSIFICATION, /ELITE_EXCLUDED_TYPES[\s\S]*'RESONATOR'[\s\S]*\]\s*\)/,
    'RESONATOR must be in the elite-exclusion guard');
});

test('RESONATOR is dispatched in the AI switch', () => {
  assert.match(ENTITIES, /case\s+'RESONATOR':\s*this\.aiResonator\(/);
});

test('aiResonator method is defined', () => {
  assert.match(ENTITIES, /aiResonator\s*\(\s*dt\s*,\s*player\s*,\s*map\s*,\s*d\s*,\s*los\s*\)\s*\{/);
});

test('RESONATOR stun-cancel path drops telegraph to recovery', () => {
  // Stun must cancel the telegraph BEFORE it fires — otherwise the cone
  // discharges after the stun ends and the player cannot punish the stun.
  // We drop straight to recovery (not idle) so the rhythm beats stay
  // honest — a stunned resonator still sits idle for RESONATOR_RECOVERY.
  const re = /_rsState\s*===\s*'telegraph'[\s\S]{0,200}_rsState\s*=\s*'recovery'[\s\S]{0,200}_rsRec\s*=/;
  assert.match(ENTITIES, re, 'stun handler must downgrade _rsState to recovery');
});

test('RESONATOR aim source is _tx/_ty so taunt redirection works', () => {
  // RESONATOR aims via this._tx/_ty (the canonical taunt-aware target)
  // rather than reading player.x/y directly, so hologram decoys redirect
  // the cone with no special branch (unlike ECHOER which needed one).
  // Slice the aiResonator method body and assert the lock pulls from
  // _tx/_ty before computing aim direction.
  const sigRe = /^\s*aiResonator\s*\(\s*dt\s*,\s*player\s*,\s*map\s*,\s*d\s*,\s*los\s*\)\s*\{/m;
  const sigMatch = ENTITIES.match(sigRe);
  assert.ok(sigMatch, 'aiResonator method definition not found');
  const aiStart = sigMatch.index || 0;
  const aiBody = ENTITIES.slice(aiStart, aiStart + 5000);
  // The lock-and-aim block must norm() over (this._tx - this.x, this._ty - this.y).
  assert.match(aiBody,
    /norm\(\s*this\._tx\s*-\s*this\.x\s*,\s*this\._ty\s*-\s*this\.y\s*\)/,
    'aiResonator must aim via _tx/_ty for taunt-decoy compatibility');
});

test('RESONATOR fire honors player damage immunity (dash i-frames)', () => {
  // Damage path goes through player.takeDamage which honors
  // isPlayerDamageImmune unless ignoreImmunity is set. Make sure the
  // RESONATOR call site does NOT pass ignoreImmunity — otherwise dash
  // pass-through (the canonical counter-play) silently breaks.
  const sigRe = /^\s*aiResonator\s*\(/m;
  const sigMatch = ENTITIES.match(sigRe);
  assert.ok(sigMatch);
  const aiStart = sigMatch.index || 0;
  const aiBody = ENTITIES.slice(aiStart, aiStart + 5000);
  const callMatch = aiBody.match(/player\.takeDamage\([^)]*\)/);
  assert.ok(callMatch, 'aiResonator must call player.takeDamage');
  assert.ok(!/ignoreImmunity/.test(callMatch[0]),
    'aiResonator damage call must not bypass dash i-frames');
});

test('RESONATOR draw branch renders a cone wedge during telegraph', () => {
  // The draw branch must guard on _rsState === 'telegraph' AND draw
  // both a filled wedge (ctx.arc + closePath + fill) and the edge
  // lines so the player can read the cone shape under high contrast.
  const draw = ENTITIES.match(/this\.type\s*===\s*'RESONATOR'[\s\S]{0,2500}/);
  assert.ok(draw, 'RESONATOR draw branch missing');
  const blob = draw[0];
  assert.ok(/_rsState\s*===\s*'telegraph'/.test(blob),
    'draw branch must gate the wedge on telegraph state');
  assert.ok(/ctx\.arc\(/.test(blob), 'draw branch must use ctx.arc for the wedge');
  assert.ok(/ctx\.fill\(/.test(blob), 'draw branch must fill the wedge');
});

test('RESONATOR constants are defined with sane values', () => {
  const ch = ENTITIES.match(/RESONATOR_CHARGE\s*=\s*([\d.]+)/);
  const tg = ENTITIES.match(/RESONATOR_TELEGRAPH\s*=\s*([\d.]+)/);
  const rc = ENTITIES.match(/RESONATOR_RECOVERY\s*=\s*([\d.]+)/);
  const rg = ENTITIES.match(/RESONATOR_RANGE\s*=\s*([\d.]+)/);
  const cd = ENTITIES.match(/RESONATOR_CONE_DEG\s*=\s*([\d.]+)/);
  const dm = ENTITIES.match(/RESONATOR_DMG_MUL\s*=\s*([\d.]+)/);
  assert.ok(ch && tg && rc && rg && cd && dm,
    'all six RESONATOR_* tuning constants must be defined');
  assert.ok(parseFloat(tg[1]) >= 0.5,
    `telegraph ${tg[1]} too short to be fair — at least 0.5s required`);
  assert.ok(parseFloat(rc[1]) >= 0.5,
    `recovery ${rc[1]} too short — gives no punish window`);
  const deg = parseFloat(cd[1]);
  assert.ok(deg > 0 && deg <= 120,
    `cone ${deg}° outside sane range — narrow shot or lazy cleave`);
  const mul = parseFloat(dm[1]);
  assert.ok(mul > 0 && mul <= 1.5,
    `dmg mul ${mul} outside sane range`);
});

test('isInsideCone pure helper is defined in entity AI helpers', () => {
  // Structural source-of-truth check. The duplicate below must mirror
  // the body — if the contract changes, update both.
  assert.match(ENTITY_AI_HELPERS,
    /function\s+isInsideCone\s*\(\s*px\s*,\s*py\s*,\s*ox\s*,\s*oy\s*,\s*aimDx\s*,\s*aimDy\s*,\s*range\s*,\s*halfAngleRad\s*\)/);
});

test('platform.js exposes audio.resonatorCharge and audio.resonatorFire', () => {
  assert.match(PLATFORM, /resonatorCharge\s*\(\s*\)\s*\{/);
  assert.match(PLATFORM, /resonatorFire\s*\(\s*\)\s*\{/);
});

test('sw.js cache name is stable and unversioned', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /const\s+CACHE\s*=\s*'neon-dungeon-assets'/);
});

test('RESONATOR appears in CREDIT_VALUES, SOURCE_LABELS, SOURCE_COLOURS', () => {
  assert.match(SOURCE_METADATA, /RESONATOR:\s*\d+/);             // CREDIT_VALUES row
  assert.match(SOURCE_METADATA, /RESONATOR:\s*'Resonator'/);     // SOURCE_LABELS
  assert.match(SOURCE_METADATA, /RESONATOR:\s*'#ff66cc'/);       // SOURCE_COLOURS
  assert.match(SOURCE_METADATA, /'Resonator Cone':\s*'Resonator Cone'/); // damage source label
});

// ─── Pure helper unit tests ─────────────────────────────────────────────
//
// Extract the production `isInsideCone` definition from ai-helpers.js
// source and execute it in this test context. This way the unit tests
// exercise the REAL implementation, not a duplicate that could drift.
// (We can't `require()` entities.js — it's a browser script with no
// CommonJS exports and it touches DOM/audio globals on load.)

const fnMatch = ENTITY_AI_HELPERS.match(
  /function\s+isInsideCone\s*\([\s\S]*?\n\}\n/
);
if (!fnMatch) throw new Error('isInsideCone definition not found in ai-helpers.js');
// Run the production source through node's vm so the unit tests exercise
// the REAL implementation, not a duplicate that could drift. We can't
// `require()` entities.js — it's a browser script with no CommonJS exports
// and it touches DOM/audio globals on load.
const vm = require('node:vm');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${fnMatch[0]}\nthis.isInsideCone = isInsideCone;`, sandbox);
const isInsideCone = sandbox.isInsideCone;

const HALF_60 = (60 * 0.5) * Math.PI / 180; // 30° = π/6

test('cone helper: apex point counts as inside', () => {
  assert.strictEqual(isInsideCone(5, 5, 5, 5, 1, 0, 6, HALF_60), true);
});

test('cone helper: point straight ahead within range = inside', () => {
  // Aim east, point at (5,0) from origin, range 6.
  assert.strictEqual(isInsideCone(5, 0, 0, 0, 1, 0, 6, HALF_60), true);
});

test('cone helper: point past range = outside (even on aim axis)', () => {
  assert.strictEqual(isInsideCone(7, 0, 0, 0, 1, 0, 6, HALF_60), false);
});

test('cone helper: point at exact range boundary = inside (inclusive)', () => {
  // Acquire/fire/draw all share an inclusive boundary so a player
  // exactly at the advertised max range can still be hit.
  assert.strictEqual(isInsideCone(6, 0, 0, 0, 1, 0, 6, HALF_60), true);
});

test('cone helper: point at exact half-angle edge = inside (inclusive)', () => {
  // Aim east, point at angle +30° from east, distance 5.
  const a = 30 * Math.PI / 180;
  const px = Math.cos(a) * 5;
  const py = Math.sin(a) * 5;
  assert.strictEqual(isInsideCone(px, py, 0, 0, 1, 0, 6, HALF_60), true);
});

test('cone helper: point just outside half-angle = outside', () => {
  // Aim east, point at angle +35° from east, distance 5.
  const a = 35 * Math.PI / 180;
  const px = Math.cos(a) * 5;
  const py = Math.sin(a) * 5;
  assert.strictEqual(isInsideCone(px, py, 0, 0, 1, 0, 6, HALF_60), false);
});

test('cone helper: point directly behind origin = outside', () => {
  // Aim east, point west of origin.
  assert.strictEqual(isInsideCone(-3, 0, 0, 0, 1, 0, 6, HALF_60), false);
});

test('cone helper: rotated aim direction works correctly', () => {
  // Aim north (0,-1) — point straight north should be inside.
  assert.strictEqual(isInsideCone(0, -4, 0, 0, 0, -1, 6, HALF_60), true);
  // Point straight south = behind = outside.
  assert.strictEqual(isInsideCone(0, 4, 0, 0, 0, -1, 6, HALF_60), false);
});

test('cone helper: point inside angular wedge but past range = outside', () => {
  // On aim axis but range exceeded.
  assert.strictEqual(isInsideCone(8, 0, 0, 0, 1, 0, 6, HALF_60), false);
});

test('aiResonator lock guards against zero-aim (player on apex)', () => {
  // If the lock didn't gate on dLock > epsilon, norm(0,0) would yield
  // a [0,0] aim vector — the draw branch would render an east-pointing
  // wedge while the hit-test could never hit. Verify the source
  // explicitly guards the lock with a positive distance check.
  const sigRe = /^\s*aiResonator\s*\(/m;
  const sigMatch = ENTITIES.match(sigRe);
  assert.ok(sigMatch);
  const aiStart = sigMatch.index || 0;
  const aiBody = ENTITIES.slice(aiStart, aiStart + 5000);
  // Either an explicit positive lower bound, or some equivalent guard.
  assert.match(aiBody, /dLock\s*>\s*[\d.]+\s*&&\s*dLock\s*<=?\s*RESONATOR_RANGE/,
    'aiResonator must guard the lock with a positive minimum distance');
});
