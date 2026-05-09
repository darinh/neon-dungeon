'use strict';
// HARVESTER + HARVEST_SURGE tests.
//
// Covers the timed-boost plumbing in src/meta/boosts.js (registry entry,
// applyBoost behaviour, tickBoosts countdown, expiry semantics, multiplier
// composition with COMBAT_STIM, clearFloorBoosts wipe, getActiveBoostList
// HUD entry). The HARVESTER mob itself (AI, draw, pickup spawning) is
// browser-only code — the on-die drop wiring is verified by source-text
// grep so a future refactor that drops the gate is caught.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const boosts = require(path.resolve(__dirname, '..', 'src', 'meta', 'boosts.js'));

test('HARVEST_SURGE registered with timed duration + +50% damage', () => {
  const b = boosts.BOOSTS.HARVEST_SURGE;
  assert.ok(b, 'HARVEST_SURGE should be registered');
  assert.equal(b.duration, 'timed');
  assert.equal(b.durationSec, 8);
  assert.equal(b.dmgMul, 1.5);
  // No `price` field — vendor pool filter must skip it (see content.js).
  assert.equal(b.price, undefined);
});

test('applyBoost(HARVEST_SURGE) seeds 8s timer and flips activeBoosts flag', () => {
  const p = {};
  const ok = boosts.applyBoost(p, 'HARVEST_SURGE');
  assert.equal(ok, true);
  assert.equal(p.activeBoosts.HARVEST_SURGE, true);
  assert.equal(p._boostTimers.HARVEST_SURGE, 8);
});

test('damage multiplier reflects HARVEST_SURGE while active and reverts on expiry', () => {
  const p = {};
  assert.equal(boosts.getBoostDamageMul(p), 1, 'baseline neutral');
  boosts.applyBoost(p, 'HARVEST_SURGE');
  assert.equal(boosts.getBoostDamageMul(p), 1.5, 'active surge multiplier');
  // Tick the full 8s — should expire to neutral on the same frame the timer
  // hits zero (gate uses <=0). Tick in 1s steps for clarity.
  for (let i = 0; i < 8; i++) boosts.tickBoosts(p, 1);
  assert.equal(p._boostTimers.HARVEST_SURGE, undefined, 'timer cleared on expiry');
  assert.equal(p.activeBoosts.HARVEST_SURGE, undefined, 'flag cleared on expiry');
  assert.equal(boosts.getBoostDamageMul(p), 1, 'multiplier reverts to neutral');
});

test('HARVEST_SURGE stacks multiplicatively with COMBAT_STIM', () => {
  const p = {};
  boosts.applyBoost(p, 'COMBAT_STIM');
  boosts.applyBoost(p, 'HARVEST_SURGE');
  // 1.15 (combat stim) * 1.5 (surge) = 1.725
  const m = boosts.getBoostDamageMul(p);
  assert.ok(Math.abs(m - 1.725) < 1e-9, `expected ~1.725, got ${m}`);
});

test('re-picking HARVEST_SURGE refreshes (does not extend) the window', () => {
  const p = {};
  boosts.applyBoost(p, 'HARVEST_SURGE');
  boosts.tickBoosts(p, 5);
  assert.equal(p._boostTimers.HARVEST_SURGE, 3, '5s of 8s consumed');
  // Second pickup mid-buff — must reset to 8, not become 11.
  boosts.applyBoost(p, 'HARVEST_SURGE');
  assert.equal(p._boostTimers.HARVEST_SURGE, 8, 'refresh resets to full window');
});

test('clearFloorBoosts wipes timed boosts (HARVEST_SURGE) along with floor flags', () => {
  const p = {};
  boosts.applyBoost(p, 'COMBAT_STIM');
  boosts.applyBoost(p, 'HARVEST_SURGE');
  boosts.clearFloorBoosts(p);
  assert.deepEqual(p.activeBoosts, {});
  assert.deepEqual(p._boostTimers, {});
  assert.equal(boosts.getBoostDamageMul(p), 1);
});

// Save/resume regression — three reviewers caught that activeBoosts was
// serialised but _boostTimers was not, leaving HARVEST_SURGE permanently
// active after Continue. Both halves must round-trip together.
test('save/resume contract: serialised payload must include both activeBoosts AND _boostTimers', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const gameSrc = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8');
  // saveGame side
  assert.match(gameSrc, /activeBoosts:\s*p\.activeBoosts/, 'saveGame writes activeBoosts');
  assert.match(gameSrc, /_boostTimers:\s*p\._boostTimers/, 'saveGame writes _boostTimers');
  // continueGame side
  assert.match(gameSrc, /p\.activeBoosts\s*=\s*s\.activeBoosts/, 'continueGame restores activeBoosts');
  assert.match(gameSrc, /p\._boostTimers\s*=\s*s\._boostTimers/, 'continueGame restores _boostTimers');
});

test('save/resume defensive sweep: timed boost flag without timer is dropped on restore', () => {
  // Simulates an old save (pre-fix) that has activeBoosts.HARVEST_SURGE=true
  // but no _boostTimers entry. The continueGame path must drop the orphaned
  // flag so the buff doesn't become permanent.
  const fs = require('node:fs');
  const path = require('node:path');
  const gameSrc = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8');
  // The defensive sweep block must reference both timed-duration and the
  // delete-on-orphan pattern.
  assert.match(gameSrc, /duration === 'timed'/, 'sweep checks duration === timed');
  assert.match(gameSrc, /delete p\.activeBoosts\[id\]/, 'sweep deletes orphan flag');
});

test('expired HarvestPickup is pruned from items array (no draw-forever ghost)', () => {
  // Three reviewers caught: HarvestPickup.update sets dead=true after 5s
  // but the items array was never pruned for non-collected dead items, so
  // the pickup would draw + occupy hit-test forever post-expiry.
  const fs = require('node:fs');
  const path = require('node:path');
  const gameSrc = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8');
  // Must have a dead-item prune pass right after the items.update loop.
  assert.match(gameSrc, /for \(const it of items\) it\.update\(dt\);[\s\S]{0,800}if \(items\[i\]\.dead\) items\.splice\(i, 1\)/);
  // Belt-and-suspenders: HarvestPickup.draw also short-circuits if dead.
  const contentSrc = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'content', 'pickups.js'), 'utf8');
  const hp = contentSrc.match(/class HarvestPickup[\s\S]*?\n\}/);
  assert.ok(hp, 'HarvestPickup class found');
  assert.match(hp[0], /draw\(camX, camY\) \{\s*\n\s*if \(this\.dead\) return;/);
});

test('tickBoosts is a no-op on a player with no _boostTimers map', () => {
  // Defensive — older save resumes / unit tests may construct ad-hoc players.
  const p = {};
  assert.doesNotThrow(() => boosts.tickBoosts(p, 0.016));
  assert.doesNotThrow(() => boosts.tickBoosts(null, 0.016));
});

test('getActiveBoostList includes HARVEST_SURGE with seconds-remaining detail', () => {
  const p = {};
  boosts.applyBoost(p, 'HARVEST_SURGE');
  boosts.tickBoosts(p, 2.3); // ~5.7s remaining → ceil to 6s
  const list = boosts.getActiveBoostList(p);
  const entry = list.find(e => e.id === 'HARVEST_SURGE');
  assert.ok(entry, 'HARVEST_SURGE should appear in HUD list');
  assert.equal(entry.detail, '6s');
});

// ── Source wiring (read-the-source guards against silent regression) ──────

const ENTITIES_SRC = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8');
const ENEMY_SPAWN_TABLE = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'entities', 'spawn-table.js'), 'utf8');
const SOURCE_METADATA = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'entities', 'source-metadata.js'), 'utf8');

test('HARVESTER is registered in ENEMY_WEIGHTS, CREDIT_VALUES, SOURCE_LABELS, SOURCE_COLOURS', () => {
  assert.match(ENEMY_SPAWN_TABLE, /HARVESTER:\s*\{ base:/, 'ENEMY_WEIGHTS entry');
  assert.match(SOURCE_METADATA, /HARVESTER:5/, 'CREDIT_VALUES entry');
  assert.match(SOURCE_METADATA, /HARVESTER:'Harvester'/, 'SOURCE_LABELS entry');
  assert.match(SOURCE_METADATA, /HARVESTER:'#ff9933'/, 'SOURCE_COLOURS entry');
});

test('HARVESTER is excluded from elite-affix gate (matches WARDLING/CONDUIT pattern)', () => {
  assert.match(ENTITIES_SRC, /type !== 'HARVESTER'/, 'elite exclusion present');
});

test('HARVESTER on-death drop spawns HarvestPickup and gates summons/shards', () => {
  // Surface check: the die() block must reference HARVESTER and HarvestPickup
  // and exclude isSummon / isShard. A future refactor that drops any one of
  // those guards is caught here.
  assert.match(ENTITIES_SRC, /this\.type === 'HARVESTER' && !isSummon && !this\.isShard/);
  assert.match(ENTITIES_SRC, /new HarvestPickup\(this\.x, this\.y\)/);
});

test('aiHarvester dispatches and uses moveToward+meleeAttack (no double-mod, has body damage)', () => {
  // Stored memory: moveToward applies modSpeed+berserkerMul internally, so
  // callers must not pre-multiply. And every melee mob needs an explicit
  // meleeAttack(player) call (no generic body collision damage).
  const m = ENTITIES_SRC.match(/\n  aiHarvester\([\s\S]*?\n  \}/);
  assert.ok(m, 'aiHarvester method should exist');
  assert.match(m[0], /this\.moveToward\(this\._tx,this\._ty,this\.spd,dt,map\)/, 'raw spd, no pre-mul');
  assert.match(m[0], /this\.meleeAttack\(player\)/, 'explicit meleeAttack call');
});

const GAME_SRC = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8');

test('game.js pickup loop handles isHarvest before falling through to upgrade choice', () => {
  // The branch must be inside the items-pickup loop (after isKey, before the
  // pendingPerkChoices gate) and call applyBoost.
  assert.match(GAME_SRC, /if \(it\.isHarvest\)/);
  assert.match(GAME_SRC, /NEON\.boosts\.applyBoost\(player, 'HARVEST_SURGE'\)/);
});

const SW_SRC = fs.readFileSync(path.resolve(__dirname, '..', 'sw.js'), 'utf8');

test('service worker cache key is stable and unversioned', () => {
  assert.doesNotMatch(SW_SRC, /neon-dungeon-v\d+/);
  assert.match(SW_SRC, /const\s+CACHE\s*=\s*'neon-dungeon-assets'/);
});
