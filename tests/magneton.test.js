'use strict';
// MAGNETON mob — source-text wiring tests + pure bend-helper unit tests.
//
// entities.js is browser-only (no UMD/CommonJS exports), so we follow the
// same pattern as resonator.test.js / mirror.test.js: assert structural
// invariants the mob needs by regex-matching the source text. We also
// vm-extract the pure `magnetonBendDir` helper from the source so the
// unit tests exercise the REAL implementation (no duplicate to drift).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

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
const SW = fs.readFileSync(
  path.resolve(__dirname, '..', 'sw.js'), 'utf8'
);

// ─── Wiring assertions ──────────────────────────────────────────────────

test('MAGNETON appears in ENEMY_WEIGHTS with floor 6+ gate', () => {
  const m = ENEMY_SPAWN_TABLE.match(/MAGNETON:\s*\{\s*base:\s*\d+,\s*perFloor:\s*\d+,\s*minFloor:\s*(\d+)/);
  assert.ok(m, 'MAGNETON must be registered in ENEMY_WEIGHTS');
  assert.ok(parseInt(m[1], 10) >= 6, `MAGNETON minFloor should be >= 6, got ${m[1]}`);
});

test('MAGNETON has a stat row in ENEMY_BASE_STATS and is stationary, atk=0', () => {
  // Missing case → spawnEnemy returns an Enemy with hp=0, instantly dead.
  // The mob is stationary AND inert (atk=0) — its threat is the field, not contact.
  const m = ENEMY_STATS.match(/MAGNETON:\s*\{[^\n]*hp:\s*(\d+),[^\n]*atk:\s*(\d+),[^\n]*spd:\s*([\d.]+),[^\n]*xpVal:\s*(\d+)/);
  assert.ok(m, 'MAGNETON stat row missing');
  assert.strictEqual(parseFloat(m[3]), 0, 'MAGNETON must be stationary (spd=0)');
  assert.strictEqual(parseInt(m[2], 10), 0, 'MAGNETON must have atk=0 (no contact damage)');
  assert.ok(parseInt(m[1], 10) >= 30, 'MAGNETON HP feels too low — players need a beat to identify and target');
});

test('MAGNETON spawn init block initialises pulse phase', () => {
  // _mgPulse must exist (used by draw branch) and ideally be staggered
  // (seeded cosmetic RNG * TWO_PI) so a clustered spawn doesn't pulse in unison.
  const re = /if\s*\(type\s*===\s*'MAGNETON'\)[\s\S]{0,400}_mgPulse\s*=/;
  assert.match(ENTITIES, re, 'MAGNETON init must set _mgPulse');
  const init = ENTITIES.match(/if\s*\(type\s*===\s*'MAGNETON'\)[\s\S]{0,400}\}/);
  assert.ok(init && /rand\('cosmetic'\)/.test(init[0]), 'MAGNETON init must stagger _mgPulse with the cosmetic RNG');
});

test('MAGNETON is excluded from the elite affix roll', () => {
  // Elite affixes (SHIELDED, BERSERKER, FRENZY, PHASING, ...) interact poorly
  // with the field mechanic — VOLATILE on a magneton gives an atk=0 mob a
  // death explosion that scales off atk*1.5 (= 0), which is fine, but
  // SHIELDED on a stationary punching-bag stretches the kill window past
  // tolerance. Mirrors the existing stationary-mob exclusions.
  assert.match(ENEMY_CLASSIFICATION, /ELITE_EXCLUDED_TYPES[\s\S]*'MAGNETON'[\s\S]*\]\s*\)/,
    'MAGNETON must be in the elite-exclusion guard');
});

test('MAGNETON has CREDIT_VALUES entry', () => {
  // Without an entry, die() falls back to 5 credits (CREDIT_VALUES[type] || 5).
  // Explicit entry keeps reward tuning intentional and signals MAGNETON
  // is a known type to the credit system.
  assert.match(SOURCE_METADATA, /MAGNETON\s*:\s*\d+/);
});

test('MAGNETON has SOURCE_LABELS entry', () => {
  // Even though atk=0 (no direct damage attribution), SOURCE_LABELS lookup
  // is used by death recap and damage logs whenever an enemy reference is
  // displayed. Missing entry → recap shows 'MAGNETON' (uppercase enum)
  // instead of 'Magneton' (display name).
  assert.match(SOURCE_METADATA, /MAGNETON\s*:\s*'Magneton'/);
});

test('MAGNETON has AI dispatch case', () => {
  assert.match(ENTITIES, /case\s+'MAGNETON'\s*:\s*this\.aiMagneton\(/);
});

test('MAGNETON aiMagneton method exists and skips non-player projectiles', () => {
  // Anchor on the method definition (no `this.` prefix and starts at column 2)
  // so we don't accidentally match the dispatch switch case.
  const fn = ENTITIES.match(/\n  aiMagneton\s*\([\s\S]*?\n  \}\n/);
  assert.ok(fn, 'aiMagneton method must exist');
  // Must filter to fromPlayer projectiles only — bending enemy projectiles
  // (MIRROR/ECHOER/PROPHET shots) toward the magneton would be confusing
  // and could pull MIRROR shots OFF the player. Pick a side: enemy
  // projectiles are unaffected.
  assert.match(fn[0], /fromPlayer/, 'aiMagneton must filter on fromPlayer');
  // Must skip dead and grenades (grenades have explicit targetX/targetY and
  // bending dx/dy makes them miss the visible landing reticle — fairness).
  assert.match(fn[0], /\.dead/, 'aiMagneton must skip dead projectiles');
  assert.match(fn[0], /isGrenade/, 'aiMagneton must skip grenades');
  // Must skip homing player projectiles — Projectile.update runs after
  // enemy AI and would re-steer every frame, partially undoing the bend.
  // Treat homing as the intentional counter (PLASMA_ORB / SENTRY_DRONE).
  assert.match(fn[0], /\.homing/, 'aiMagneton must skip homing projectiles');
  // Must use LOS gate to avoid bending shots through walls.
  assert.match(fn[0], /hasLOS/, 'aiMagneton must LOS-gate the bend');
});

test('MAGNETON tuning constants are defined', () => {
  assert.match(ENTITIES, /const\s+MAGNETON_FIELD_R\s*=\s*[\d.]+/);
  assert.match(ENTITIES, /const\s+MAGNETON_BEND_STRENGTH\s*=\s*[\d.]+/);
  assert.match(ENTITIES, /const\s+MAGNETON_SAFE_R\s*=\s*[\d.]+/);
});

test('sw cache freshness does not use a second numeric version', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /const\s+CACHE\s*=\s*'neon-dungeon-assets'/);
});

// ─── Pure helper unit tests ─────────────────────────────────────────────
//
// vm-extract magnetonBendDir from ai-helpers.js so the tests exercise the
// real implementation. MAGNETON_FIELD_R / MAGNETON_BEND_STRENGTH /
// MAGNETON_SAFE_R must be defined in the sandbox first because the helper
// references MAGNETON_SAFE_R for the apex guard.

const fnMatch = ENTITY_AI_HELPERS.match(
  /function\s+magnetonBendDir\s*\([\s\S]*?\n\}\n/
);
if (!fnMatch) throw new Error('magnetonBendDir definition not found in ai-helpers.js');
const sandbox = { MAGNETON_SAFE_R: 0.15 };
vm.createContext(sandbox);
vm.runInContext(`${fnMatch[0]}\nthis.magnetonBendDir = magnetonBendDir;`, sandbox);
const magnetonBendDir = sandbox.magnetonBendDir;

const FIELD_R = 5.5;
const STRENGTH = 6.0;

test('magnetonBendDir: out of field range returns input direction unchanged', () => {
  // Projectile 10 tiles east of magneton at origin, flying east. Should pass through.
  const [ndx, ndy] = magnetonBendDir(10, 0, 1, 0, 0, 0, FIELD_R, STRENGTH, 1/60);
  assert.strictEqual(ndx, 1);
  assert.strictEqual(ndy, 0);
});

test('magnetonBendDir: at field boundary (d == fieldR exactly) returns unchanged', () => {
  // d2 >= r2 is the early-out (inclusive). Projectile at (5.5, 0), magneton at origin.
  const [ndx, ndy] = magnetonBendDir(5.5, 0, 1, 0, 0, 0, FIELD_R, STRENGTH, 1/60);
  assert.strictEqual(ndx, 1);
  assert.strictEqual(ndy, 0);
});

test('magnetonBendDir: inside field, shot perpendicular to magneton bends toward it', () => {
  // Projectile at (3, 0) flying north (0, 1). Magneton at origin.
  // Pull direction = unit(0-3, 0-0) = (-1, 0). Lerp dy a tad toward 0,
  // dx a tad toward -1. Result must rotate so dx becomes negative.
  const [ndx, ndy] = magnetonBendDir(3, 0, 0, 1, 0, 0, FIELD_R, STRENGTH, 1/60);
  assert.ok(ndx < 0, `dx should bend negative (toward magneton), got ${ndx}`);
  assert.ok(ndy > 0.9, `dy should remain mostly forward, got ${ndy}`);
  // Renormalised: |[ndx,ndy]| should equal 1
  const len = Math.sqrt(ndx*ndx + ndy*ndy);
  assert.ok(Math.abs(len - 1) < 1e-9, `result must be unit vector, got len=${len}`);
});

test('magnetonBendDir: closer to magneton bends MORE than farther (proximity scaling)', () => {
  // Same setup, two distances. Closer should rotate the direction more.
  const dt = 1/60;
  // At d=1 (very close), dy=1 should bend toward (-1,0)
  const [near_dx] = magnetonBendDir(1, 0, 0, 1, 0, 0, FIELD_R, STRENGTH, dt);
  // At d=4 (near the edge), dy=1 should bend less
  const [far_dx]  = magnetonBendDir(4, 0, 0, 1, 0, 0, FIELD_R, STRENGTH, dt);
  // Both should be negative (bending toward -x), but |near_dx| > |far_dx|
  assert.ok(near_dx < 0 && far_dx < 0, 'both must bend negative');
  assert.ok(Math.abs(near_dx) > Math.abs(far_dx),
    `closer should bend more — near=${near_dx} far=${far_dx}`);
});

test('magnetonBendDir: at apex (d <= MAGNETON_SAFE_R) returns input unchanged (NaN guard)', () => {
  // Projectile sitting on top of magneton. Without the safe-radius guard,
  // norm(0,0) = NaN and the lerp produces NaN dx/dy. The guard protects
  // against this edge case (player walks INTO the magneton's body, etc.).
  const [ndx, ndy] = magnetonBendDir(0.05, 0, 0.7071, 0.7071, 0, 0, FIELD_R, STRENGTH, 1/60);
  assert.strictEqual(ndx, 0.7071);
  assert.strictEqual(ndy, 0.7071);
});

test('magnetonBendDir: shot already aimed AT magneton stays normalised', () => {
  // Projectile at (3, 0) flying west (-1, 0) — already heading at magneton.
  // Pull direction also (-1, 0). Lerp a vector toward itself = same vector.
  const [ndx, ndy] = magnetonBendDir(3, 0, -1, 0, 0, 0, FIELD_R, STRENGTH, 1/60);
  // Result: still (-1, 0) (with floating-point tolerance).
  assert.ok(Math.abs(ndx + 1) < 1e-9, `ndx should stay ~-1, got ${ndx}`);
  assert.ok(Math.abs(ndy) < 1e-9, `ndy should stay ~0, got ${ndy}`);
});

test('magnetonBendDir: long dt clamps alpha to 1 (no overshoot, no NaN)', () => {
  // dt = 100 seconds → strength * proximity * dt = 6 * 1 * 100 = 600.
  // Without clamping, dx + (gx-dx)*600 vastly overshoots. With clamping
  // alpha to 1, result IS the pull direction (gx, gy) exactly.
  // Magneton at origin, projectile at (1, 0), flying east. gx = -1.
  const [ndx, ndy] = magnetonBendDir(1, 0, 1, 0, 0, 0, FIELD_R, STRENGTH, 100);
  // alpha=1 → ndx,ndy = (gx, gy) = (-1, 0) (renormalised; already unit).
  assert.ok(Math.abs(ndx + 1) < 1e-9, `clamped result should be -1, got ${ndx}`);
  assert.ok(Math.abs(ndy) < 1e-9, `clamped result should be 0, got ${ndy}`);
});

test('magnetonBendDir: result is always a unit vector when input was unit', () => {
  // Spot-check several configurations — bend math must renormalise.
  const cases = [
    [3, 0, 0, 1, 0, 0],        // perpendicular shot
    [2, 2, 1, 0, 0, 0],        // diagonal-position east-bound shot
    [0.5, 4, -1, 0, 0, 0],     // close-y shot heading west
    [3, -2, 0.6, 0.8, 0, 0],   // arbitrary direction
  ];
  for (const [px, py, dx, dy, mx, my] of cases) {
    const [ndx, ndy] = magnetonBendDir(px, py, dx, dy, mx, my, FIELD_R, STRENGTH, 1/60);
    const len = Math.sqrt(ndx*ndx + ndy*ndy);
    assert.ok(Math.abs(len - 1) < 1e-9,
      `case (${px},${py},${dx},${dy}): expected unit vector, got len=${len}`);
    assert.ok(Number.isFinite(ndx) && Number.isFinite(ndy),
      `case (${px},${py}): result must be finite, got (${ndx},${ndy})`);
  }
});
