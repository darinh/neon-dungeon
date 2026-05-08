'use strict';
// SPAWN GRACE — 1.5s player invulnerability on fresh floor entry.
//
// Set by Game.loadFloor() on fresh transitions only (savedModifier === undefined,
// matching the existing pattern used for keys/boosts/telemetry/biome card).
// Skipped on save-resume — player paused intentionally, not under threat.
//
// Damage gate: extends isPlayerDamageImmune() in src/content.js so that
// every existing damage path that already checks immunity (mob contact,
// projectiles, env hazards PLASMA/ARC/TOXIC, frost patches, AoE bursts)
// uniformly honours spawn grace via a single OR.
//
// Visual telegraph: pulsing cyan ring around the player in Player.draw()
// while _spawnGraceTimer > 0.
//
// Source-text assertions only — entities.js / content.js / game.js are
// browser-only UMD scripts (no CommonJS exports) so we mirror the
// crt-mode / sapper / spectre test pattern.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);
const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content', 'hackware.js'), 'utf8'
);
const GAME = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8'
);
const SW = fs.readFileSync(
  path.resolve(__dirname, '..', 'sw.js'), 'utf8'
);

// ─── Player field declaration + init ────────────────────────────────────

test('Player class declares _spawnGraceTimer field', () => {
  // JSDoc field declaration so // @ts-check doesn't flag the dynamic
  // assignment in loadFloor / takeDamage paths.
  assert.match(ENTITIES, /_spawnGraceTimer;/,
    'Player class must declare _spawnGraceTimer');
});

test('Player.reset() initializes _spawnGraceTimer to 0', () => {
  // Reset is called on fresh-run init AND on death respawn. Without
  // initialization the first floor would have an undefined timer that
  // Math.max(0, undefined - dt) would coerce to NaN.
  assert.match(ENTITIES, /this\._spawnGraceTimer\s*=\s*0/,
    'Player.reset() must initialize _spawnGraceTimer = 0');
});

// ─── Tick-down in update ────────────────────────────────────────────────

test('Player.update ticks _spawnGraceTimer down with dt', () => {
  // Mirrors invincibleTimer / shootCooldown decrement pattern. The
  // (this._spawnGraceTimer||0) coerces undefined→0 defensively for any
  // legacy save-restore path that didn't set the field.
  assert.match(ENTITIES,
    /this\._spawnGraceTimer\s*=\s*Math\.max\s*\(\s*0\s*,\s*\(\s*this\._spawnGraceTimer\s*\|\|\s*0\s*\)\s*-\s*dt\s*\)/,
    'Player.update must decrement _spawnGraceTimer by dt');
});

// ─── Damage gate: isPlayerDamageImmune extension ────────────────────────

test('isPlayerDamageImmune() returns true while _spawnGraceTimer > 0', () => {
  // The damage gate. Single-source-of-truth — every existing damage path
  // that checks isPlayerDamageImmune() (mob contact, projectiles, PLASMA,
  // ARC, TOXIC, frost patches, AoE) inherits spawn-grace protection for
  // free without per-site touches.
  assert.match(CONTENT,
    /\(\s*p\._spawnGraceTimer\s*\|\|\s*0\s*\)\s*>\s*0[\s\S]{0,80}return\s+true/,
    'isPlayerDamageImmune() must return true when _spawnGraceTimer > 0');
});

test('isPlayerDamageImmune() spawn-grace branch sits inside the function', () => {
  // Extract the function body and verify the branch lives there (not
  // somewhere else in the file with a coincidentally matching name).
  const fnMatch = CONTENT.match(/function isPlayerDamageImmune\(\)\s*\{[\s\S]*?\n\}/);
  assert.ok(fnMatch, 'isPlayerDamageImmune() function block must exist');
  const body = /** @type {string} */ (fnMatch && fnMatch[0]);
  assert.match(body, /_spawnGraceTimer/,
    '_spawnGraceTimer branch must live inside isPlayerDamageImmune()');
});

// ─── Floor entry wiring (loadFloor) ─────────────────────────────────────

test('loadFloor sets _spawnGraceTimer = 1.5 on fresh transitions', () => {
  // The literal MUST stay in sync with the comment in Player.update
  // (entities.js) — the constant lives in two files because game.js
  // doesn't import from entities.js (browser globals, not modules).
  assert.match(GAME,
    /_spawnGraceTimer\s*=\s*\(\s*savedModifier\s*===\s*undefined\s*\)\s*\?\s*1\.5\s*:\s*0/,
    'loadFloor must set _spawnGraceTimer to 1.5 on fresh transitions, 0 on save-resume');
});

test('spawn grace is gated on savedModifier === undefined (fresh transition)', () => {
  // Save-resume must NOT grant grace — player paused intentionally and
  // mid-combat resume should land them where they left off, threats and all.
  // Same gate semantics as keys / boosts / telemetry / biome card / modifier
  // banner blocks elsewhere in loadFloor.
  const sliceStart = GAME.indexOf('_spawnGraceTimer');
  assert.ok(sliceStart !== -1, '_spawnGraceTimer must appear in game.js');
  const slice = GAME.slice(Math.max(0, sliceStart - 400), sliceStart + 200);
  assert.match(slice, /savedModifier\s*===\s*undefined/,
    'spawn grace must be gated on savedModifier === undefined');
});

// ─── Visual telegraph (player draw) ─────────────────────────────────────

test('Player.draw renders pulsing ring while _spawnGraceTimer > 0', () => {
  // Without a visible halo the player can't tell why hits aren't landing.
  // Cyan colour matches existing player body neon (#00f5ff family).
  assert.match(ENTITIES,
    /this\._spawnGraceTimer\s*>\s*0[\s\S]{0,400}NEON\.draw\.circleStroke/,
    'Player.draw must stroke a ring while spawn grace is active');
});

// ─── Service worker cache freshness ─────────────────────────────────────

test('sw.js cache freshness does not use a numeric cache key', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /const\s+CACHE\s*=\s*'neon-dungeon-assets'/);
});
