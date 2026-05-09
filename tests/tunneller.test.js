'use strict';
// TUNNELLER mob — source-text wiring tests.
//
// entities.js is browser-only (no UMD/CommonJS exports), so we can't load
// the AI directly under node:test. Instead these tests assert the
// structural invariants that any working TUNNELLER wiring must satisfy:
// it is registered in the spawn weights, has a stat row, an init block,
// a dispatch entry, an AI method, an FOV-gating exception (the dust-mound
// must be visible through fog so the telegraph is fair), a draw branch
// that early-returns to hide the body while underground, and is excluded
// from the elite affix roll.
//
// These checks fail loudly the moment a refactor accidentally drops one
// of the wires — exactly the failure mode that bit past mob additions.

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

test('TUNNELLER appears in ENEMY_WEIGHTS with a floor gate', () => {
  // The weights block declares spawn rate by floor. Without an entry the
  // mob can never roll out of pickEnemyType.
  const weightsRe = /TUNNELLER:\s*\{\s*base:\s*\d+,\s*perFloor:\s*\d+,\s*minFloor:\s*(\d+)/;
  const m = ENEMY_SPAWN_TABLE.match(weightsRe);
  assert.ok(m, 'TUNNELLER must be registered in ENEMY_WEIGHTS');
  // Must be floor-gated (not a floor-1 mob — burrow telegraph is a mid-game
  // pressure unit per the design).
  const minFloor = parseInt(m[1], 10);
  assert.ok(minFloor >= 3, `TUNNELLER minFloor should be >= 3, got ${minFloor}`);
});

test('TUNNELLER has a stat row in ENEMY_BASE_STATS', () => {
  // TUNNELLER sets hp/atk/spd/xpVal/colour. Missing → spawn returns an
  // enemy with hp=0 and instantly dies.
  const re = /TUNNELLER:\s*\{[^\n]*hp:\s*\d+,[^\n]*atk:\s*\d+,[^\n]*spd:\s*[\d.]+,[^\n]*xpVal:\s*\d+,[^\n]*colour:\s*'/;
  assert.match(ENEMY_STATS, re);
});

test('TUNNELLER spawn init block sets state + intangible flag', () => {
  // The mob spawns underground, so _wrPhased must be true and _tnState
  // must start as "tunneling". Without these the mob is hittable on spawn
  // and never executes the burrow loop.
  const initRe = /if\s*\(type\s*===\s*'TUNNELLER'\)[\s\S]{0,400}_tnState\s*=\s*'tunneling'[\s\S]{0,200}_wrPhased\s*=\s*true/;
  assert.match(ENTITIES, initRe, 'TUNNELLER init must set _tnState=tunneling and _wrPhased=true');
});

test('TUNNELLER is excluded from the elite affix roll', () => {
  // TUNNELLER has its own state machine and FOV-bypass — adding an elite
  // affix on top would compound mechanics in unintended ways (mirrors
  // MIMIC/SEEKER/PULSER which are excluded for the same reason).
  // Look at the elite-eligibility condition that gates affix rolls.
  const exclusionRe = /type\s*!==\s*'TUNNELLER'/;
  assert.match(ENTITIES, exclusionRe, 'TUNNELLER must be excluded from the elite-roll guard');
});

test('TUNNELLER dispatches to aiTunneller in the per-frame switch', () => {
  const re = /case\s+'TUNNELLER':\s*this\.aiTunneller\s*\(/;
  assert.match(ENTITIES, re);
});

test('aiTunneller method exists and implements all 3 states', () => {
  // Method body must include the three state branches: tunneling,
  // surfacing, surfaced. If any disappears in a refactor the mob softlocks.
  // Skip the dispatch site (`this.aiTunneller(...)`) and find the actual
  // method definition (no leading `this.`).
  const methodRe = /\n\s{2}aiTunneller\s*\(/;
  const methodMatch = methodRe.exec(ENTITIES);
  assert.ok(methodMatch, 'aiTunneller(...) method definition must exist');
  const body = ENTITIES.slice(methodMatch.index, methodMatch.index + 5000);
  assert.match(body, /this\._tnState\s*===\s*'tunneling'/);
  assert.match(body, /this\._tnState\s*===\s*'surfacing'/);
  assert.match(body, /this\._tnState\s*===\s*'surfaced'/);
});

test('aiTunneller surfacing state deals telegraphed AoE damage to player', () => {
  // The AoE-on-emerge is the entire payoff of the mechanic. If the
  // takeDamage call disappears the mob becomes a pure nuisance — no threat.
  const methodRe = /\n\s{2}aiTunneller\s*\(/;
  const methodMatch = methodRe.exec(ENTITIES);
  assert.ok(methodMatch, 'aiTunneller(...) method definition must exist');
  const body = ENTITIES.slice(methodMatch.index, methodMatch.index + 5000);
  assert.match(body, /player\.takeDamage\s*\([^)]*Tunneller Eruption/);
});

test('FOV gate has an exception for TUNNELLER tunneling/surfacing', () => {
  // The dust mound must render through fog of war — it is the warning
  // telegraph. Without the exception the player gets blindsided unfairly.
  const re = /this\.type\s*===\s*'TUNNELLER'\s*&&\s*\(this\._tnState\s*===\s*'tunneling'\s*\|\|\s*this\._tnState\s*===\s*'surfacing'\)/;
  assert.match(ENTITIES, re);
});

test('TUNNELLER draw branch hides the body while underground (early return)', () => {
  // While tunneling/surfacing the regular sprite must NOT draw — only the
  // dust mound. Branch must end with `return;` to skip the body draw.
  const drawIdx = ENTITIES.indexOf("this.type === 'TUNNELLER' && (this._tnState === 'tunneling' || this._tnState === 'surfacing')");
  assert.ok(drawIdx !== -1, 'TUNNELLER draw branch must exist');
  const branch = ENTITIES.slice(drawIdx, drawIdx + 2000);
  // The branch must contain a ctx.restore() and a return; — guards against
  // ctx-state leak and against falling through into the normal sprite draw.
  assert.match(branch, /ctx\.restore\s*\(\)/);
  assert.match(branch, /return\s*;/);
});

test('TUNNELLER stun handler forces surface (mirrors WRAITH safety)', () => {
  // Without this, stunning a TUNNELLER mid-burrow would freeze it
  // intangible underground forever — the player can stun-lock the mob
  // out of the entire fight. Same hazard WRAITH solves with its block.
  const re = /this\.type\s*===\s*'TUNNELLER'[\s\S]{0,400}this\._tnState[\s\S]{0,400}_wrFindEmergeTile/;
  assert.match(ENTITIES, re, 'stun handler must force a TUNNELLER to surface at a passable tile');
});

test('service-worker cache freshness does not use a numeric cache version', () => {
  const sw = fs.readFileSync(path.resolve(__dirname, '..', 'sw.js'), 'utf8');
  assert.doesNotMatch(sw, /neon-dungeon-v\d+/);
  assert.match(sw, /cacheFromNetwork\(e\)/);
});
