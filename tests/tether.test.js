'use strict';
// TETHER mob — wiring tests for the anti-kiting slow-aura chaser.
//
// TETHER is a slow fragile chaser with NO contact damage. Its only
// mechanic is the leash field: while the player is within
// TETHER_FIELD_RANGE tiles of a TETHER, the player's
// _tetherSlowFactor accumulator is multiplied down (proportional to
// distance — closer = faster, further = slower). player.update reads
// the accumulator each frame and applies it to movement speed (with
// dash i-frames bypassing, mirroring toxic/disruption slows).
//
// These tests assert the WIRING (registration, stats, dispatch,
// elite exclusion, sw cache bump) rather than fully simulating the
// game loop — same pattern as sapper.test.js / magpie.test.js.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const ENTITIES = fs.readFileSync(path.join(ROOT, 'src', 'entities.js'), 'utf8');
const SPAWN_INITIALIZERS = fs.readFileSync(path.join(ROOT, 'src', 'entities', 'spawn-initializers.js'), 'utf8');
const ENEMY_SPAWN_TABLE = fs.readFileSync(path.join(ROOT, 'src', 'entities', 'spawn-table.js'), 'utf8');
const ENEMY_STATS = fs.readFileSync(path.join(ROOT, 'src', 'entities', 'enemy-stats.js'), 'utf8');
const ENEMY_CLASSIFICATION = fs.readFileSync(path.join(ROOT, 'src', 'entities', 'enemy-classification.js'), 'utf8');
const SOURCE_METADATA = fs.readFileSync(path.join(ROOT, 'src', 'entities', 'source-metadata.js'), 'utf8');
const ENTITY_RENDER_PASSES = fs.readFileSync(path.join(ROOT, 'src', 'entities', 'render-passes.js'), 'utf8');
const GAME = fs.readFileSync(path.join(ROOT, 'src', 'game.js'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

test('TETHER appears in ENEMY_WEIGHTS with floor 5+ gate', () => {
  // Floor 5 matches the cadence of recent additions (SAPPER 5+) and
  // sits after the player has met enough kite-incentive mobs to read
  // the "closer is faster" inversion as a mechanic.
  const m = ENEMY_SPAWN_TABLE.match(/TETHER:\s*\{\s*base:\s*\d+,\s*perFloor:\s*\d+,\s*minFloor:\s*(\d+)/);
  assert.ok(m, 'TETHER must be registered in ENEMY_WEIGHTS');
  assert.ok(parseInt(m[1], 10) >= 5,
    `TETHER minFloor should be >= 5, got ${m[1]}`);
});

test('TETHER has a stat row in ENEMY_BASE_STATS with atk=0', () => {
  // atk=0 is core to design: the slow IS the threat (it makes you
  // eat OTHER mobs' shots). A TETHER alone in a room is non-event.
  const m = ENEMY_STATS.match(/TETHER:\s*\{[^\n]*hp:\s*(\d+),[^\n]*atk:\s*(\d+),[^\n]*spd:\s*([\d.]+),[^\n]*xpVal:\s*(\d+)/);
  assert.ok(m, 'TETHER stat row missing');
  const hp = parseInt(m[1], 10);
  const atk = parseInt(m[2], 10);
  const spd = parseFloat(m[3]);
  assert.ok(hp > 0 && hp <= 35, `TETHER hp should be in (0,35] (fragile), got ${hp}`);
  assert.equal(atk, 0, 'TETHER must have atk=0 (slow IS the threat)');
  assert.ok(spd >= 2.0 && spd <= 3.0,
    `TETHER spd should be in [2.0, 3.0] (slow chaser), got ${spd}`);
});

test('TETHER dispatch case wired in update switch', () => {
  // Without the dispatch case the mob would default to the generic
  // path (whatever that is) and the leash would never apply.
  assert.match(ENTITIES, /case\s+'TETHER':\s*this\.aiTether\(/,
    'TETHER must dispatch to aiTether in update switch');
});

test('TETHER aiTether method exists with the correct signature', () => {
  const m = ENTITIES.match(/aiTether\s*\(\s*dt\s*,\s*player\s*,\s*map\s*,\s*d\s*,\s*los\s*\)/);
  assert.ok(m, 'aiTether(dt,player,map,d,los) method must exist');
});

test('TETHER spawn init block sets _teLashPhase', () => {
  // Stagger via cosmetic RNG so a clustered pack doesn't pulse in
  // lock-step (mirrors SAPPER / MAGPIE init pattern).
  const block = SPAWN_INITIALIZERS.match(/if\s*\(type\s*===\s*'TETHER'\)[\s\S]{0,300}\}/);
  assert.ok(block, 'TETHER init block missing');
  assert.match(block[0], /_teLashPhase\s*=/, 'TETHER must initialise _teLashPhase');
  assert.match(block[0], /rand\('cosmetic'\)/,
    'TETHER init must stagger _teLashPhase with the cosmetic RNG');
});

test('TETHER excluded from elite affix roll', () => {
  // First-ship caution: keep affix interaction surface area minimal.
  // Same exclusion pattern as recent additions (HARVESTER / MAGNETON
  // / SPECTRE / SAPPER / MAGPIE). Easier to add affixes later than
  // to reason about SHIELDED / PHASING / FRENZY × leash.
  assert.match(ENEMY_CLASSIFICATION, /ELITE_EXCLUDED_TYPES[\s\S]*'TETHER'[\s\S]*\]\s*\)/,
    'TETHER must be in the elite-affix exclusion list');
});

test('TETHER appears in display name + colour maps', () => {
  // HUD-side wiring: kill log, health bar names, particle colour all
  // pull from these tables. A missing entry shows the raw type
  // string ('TETHER') instead of the friendly name.
  assert.match(SOURCE_METADATA, /TETHER:'Tether'/, 'display name map missing TETHER');
  assert.match(SOURCE_METADATA, /TETHER:'#ff8866'/, 'colour map missing TETHER');
});

test('TETHER has a credit value entry', () => {
  // Without the entry the game falls back to a default credit drop;
  // also keeps the explicit list audit-able as the mob roster grows.
  assert.match(SOURCE_METADATA, /TETHER:\s*\d+/, 'TETHER missing from CREDIT_VALUES');
});

test('TETHER has a draw branch (not a default square)', () => {
  // Visual identity matters — a default square would alias TETHER to
  // GUARD / SPLITTER and the mechanic would feel anonymous.
  assert.match(ENTITIES, /else if \(t === 'TETHER'\)/,
    'TETHER must have its own draw branch');
});

test('player has _tetherSlowFactor field declared and initialised', () => {
  // Field decl needed for ts-check; init in reset() so a fresh run
  // never starts with a stale slow from a prior session.
  assert.match(ENTITIES, /\/\*\*\s*@type\s*\{any\}\s*\*\/\s*_tetherSlowFactor/,
    'Player class must declare _tetherSlowFactor');
  assert.match(ENTITIES, /this\._tetherSlowFactor\s*=\s*1/,
    'Player.reset() must initialise _tetherSlowFactor=1');
});

test('player.update consumes _tetherSlowFactor and resets to 1', () => {
  // Consume-and-reset pattern — a dead/destroyed TETHER stops slowing
  // the player on the very next frame with zero cleanup.
  // The application must be dash-bypassed (mirrors toxic/disruption).
  const m = ENTITIES.match(/this\.dashTimer\s*<=\s*0\s*&&\s*this\._tetherSlowFactor[\s\S]{0,200}this\._tetherSlowFactor\s*=\s*1/);
  assert.ok(m,
    'player.update must apply _tetherSlowFactor (dash-bypassed) AND reset it');
});

test('aiTether uses REAL player distance (not taunt-aware d)', () => {
  // Per stored convention "taunt-aware distance in AI": any mechanic
  // that must track the REAL player must recompute dist locally
  // because `d` is dist to _tx/_ty (which can be a hologram).
  // Without this, a DECOY would yank the slow off the player.
  const idx = ENTITIES.indexOf('aiTether(dt, player, map, d, los) {');
  assert.ok(idx >= 0, 'aiTether body not found');
  const body = ENTITIES.slice(idx, idx + 2500);
  assert.match(body, /dist\s*\(\s*this\.x\s*,\s*this\.y\s*,\s*player\.x\s*,\s*player\.y\s*\)/,
    'aiTether must compute REAL player distance via dist(this.x,this.y,player.x,player.y)');
});

test('aiTether guards against missing/dead player', () => {
  // Field-application path runs every frame inside the enemy loop;
  // a null/dead player crash here would be a hard-to-repro bug.
  const idx = ENTITIES.indexOf('aiTether(dt, player, map, d, los) {');
  assert.ok(idx >= 0, 'aiTether body not found');
  const body = ENTITIES.slice(idx, idx + 2500);
  assert.match(body, /if\s*\(\s*!player\s*\|\|\s*player\.dead\s*\)/,
    'aiTether must early-return on missing or dead player');
});

test('drawTetherLeashes rendered from game.js render pass', () => {
  // Leash visual must be drawn or the slow source is invisible (bad
  // UX). Game.js should call it next to drawReaperPlayerRings (same
  // "global pre-player overlay" pattern).
  assert.match(ENTITY_RENDER_PASSES, /function drawTetherLeashes/,
    'drawTetherLeashes function must be defined in entities render passes');
  assert.match(GAME, /drawTetherLeashes\s*\(/,
    'game.js must call drawTetherLeashes');
});

test('drawTetherLeashes telegraph parity with aiTether range', () => {
  // The visual must trigger on the SAME range as the slow — otherwise
  // the player sees leashes that aren't slowing them, or feels slow
  // with no visible source. Telegraph parity is per stored memory.
  // Codex caught a 0.05 cutoff that created a small dead-zone where
  // slow was ~2% but no leash was drawn (pd in (1.0, 1.2]). Fixed
  // to `t <= 0` — only skip when slow is mathematically zero.
  const idx = ENTITY_RENDER_PASSES.indexOf('function drawTetherLeashes');
  assert.ok(idx >= 0, 'drawTetherLeashes body not found');
  const body = ENTITY_RENDER_PASSES.slice(idx, idx + 3000);
  assert.match(body, /TETHER_FIELD_RANGE/,
    'drawTetherLeashes must use TETHER_FIELD_RANGE for parity');
  // Anti-regression: no t<=0.05 / t<0.1 / t<X dead-zone cutoffs
  // (only allowed cutoff is t<=0, which means factor==1, i.e. zero
  // slow). A non-zero cutoff would re-introduce the dead zone.
  assert.ok(!/t\s*<=?\s*0\.0[1-9]/.test(body),
    'drawTetherLeashes must not skip on t<=0.05 (telegraph dead-zone)');
});

test('sw.js does not use a second numeric cache version for TETHER freshness', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /const\s+CACHE\s*=\s*'neon-dungeon-assets'/);
});
