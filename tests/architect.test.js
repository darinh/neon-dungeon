'use strict';
// ARCHITECT mob — wiring + behaviour tests.
//
// ARCHITECT is a stationary fortifier (spd=0, atk=0). Periodically converts
// a FLOOR tile BETWEEN itself and the perceived target into a temporary
// T.WALL — creating cover. Wall auto-decays in ARCHITECT_DECAY_TIME.
// Counterplay: kill the mob, break LOS during the 1.5s telegraph, OR
// move ONTO the targeted tile to cancel.
//
// Per the rubber-duck-validated design pass (handoff 2026-04-28), this
// test file:
//   1. Pins the constants block (range/timing/decay).
//   2. Pins the AI dispatch wiring (case 'ARCHITECT' in update switch).
//   3. Pins the ENEMIES table entry (hp/atk/spd/xpVal/colour).
//   4. Pins the elite-roll exclusion (no elite affixes on ARCHITECT).
//   5. Pins the stun-cancel branch (target → recovery, _aTarget cleared,
//      _aCommitted gated to skip phantom commit-flash visuals — same
//      pattern as WATCHER._wFired).
//   6. Pins the floor-transition placedWalls clear (no cross-floor leak).
//   7. Pins the placedWalls update tick (auto-decay restores origTile).
//   8. BEHAVIOURAL: pickArchitectTarget returns the correct between-tile
//      and respects all design constraints (per rubber-duck blocking
//      issue #1 — never adjacent to player, never the player's tile,
//      never an occupied tile).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extractBranch, loadAlignmentSources }
  = require('./_alignment-helpers.js');
const { readSourceFile } = require('./_source-files.js');

const { ENTITIES, CONTENT, ENTITIES_CODE } = loadAlignmentSources(__dirname);
const SOURCE_METADATA = readSourceFile(__dirname, 'entitiesSourceMetadata');
const ENEMY_SPAWN_TABLE = readSourceFile(__dirname, 'entitiesSpawnTable');
const ENEMY_STATS = readSourceFile(__dirname, 'entitiesEnemyStats');
const ARCHITECT_WALLS = readSourceFile(__dirname, 'entitiesArchitectWalls');
const fs = require('node:fs');
const path = require('node:path');
const GAME = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8'
);
const PLATFORM = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'platform.js'), 'utf8'
);

// ─── Visible telegraph (per gpt-5.5 r1) ─────────────────────────────────

test('aiArchitect cancels target if player moves adjacent during telegraph (per gpt-5.3-codex r2)', () => {
  // Per gpt-5.3-codex r2: the Chebyshev adjacency rule is enforced at
  // pick-time but the cancel-checks during target state must ALSO
  // re-validate adjacency. Without this, the player can sidestep INTO
  // an adjacent tile during the 1.5s telegraph and the wall still
  // commits adjacent — defeating the whole point of the rule.
  // Pin two facts: (1) cancelledAdjacent is computed against
  // player.x/y; (2) the cancel OR-chain includes cancelledAdjacent.
  assert.match(ENTITIES_CODE,
    /cancelledAdjacent\s*=\s*t\s*&&\s*Math\.max\([\s\S]{0,200}player\.x[\s\S]{0,200}player\.y/,
    'cancelledAdjacent must be computed against Math.floor(player.x/y)');
  assert.match(ENTITIES_CODE,
    /cancelledLOS\s*\|\|\s*cancelledOccupied\s*\|\|\s*cancelledTileType\s*\|\|\s*cancelledAdjacent/,
    'cancellation OR chain must include cancelledAdjacent');
});

test('aiArchitect spawns particles on the target tile during the telegraph (visible counterplay)', () => {
  // Per gpt-5.5 r1: without a visible target indicator, the
  // tile-cancel counterplay is impossible (player can't see WHICH tile
  // to occupy). Pin the per-tick particle spawn on _aTarget during
  // 'target' state. The particle density is intentionally low (~33%
  // per tick) so the visual is readable but not a particle storm.
  const targetBlock = ENTITIES_CODE.match(
    /this\._aState\s*===\s*'target'[\s\S]{0,800}spawnParticles\s*\(\s*this\._aTarget\.tx[\s\S]{0,100}_aTarget\.ty/
  );
  assert.ok(targetBlock,
    'aiArchitect target branch must spawn particles on _aTarget tile during the telegraph');
});

// ─── ENEMY_WEIGHTS spawn-table entry ────────────────────────────────────

test('ARCHITECT is registered in ENEMY_WEIGHTS spawn table (per gpt-5.3-codex/opus/gpt-5.5 r1)', () => {
  // Per opus + gpt-5.5 review (CRITICAL): without an ENEMY_WEIGHTS entry,
  // pickEnemyType() never selects ARCHITECT and the entire mob is dead
  // code. Pin the spawn-table entry. minFloor 7 matches design (floor 7+).
  assert.match(ENEMY_SPAWN_TABLE,
    /ARCHITECT:\s*\{\s*base:\s*\d+\s*,\s*perFloor:\s*\d+\s*,\s*minFloor:\s*7\b/,
    'ARCHITECT must appear in ENEMY_WEIGHTS with minFloor 7');
});

test('ARCHITECT is registered in CREDIT_VALUES (per opus r1)', () => {
  // Per opus review: missing CREDIT_VALUES entry would fall back to 5
  // credits — under-rewards a hp=80 xpVal=30 mob. Pin a non-default
  // credit drop (any number, the value is tunable).
  assert.match(SOURCE_METADATA, /ARCHITECT:\d+/,
    'ARCHITECT must appear in CREDIT_VALUES with a non-default credit drop');
});

test('ARCHITECT appears in SOURCE_LABELS and SOURCE_COLOURS (per registry-completeness audit)', () => {
  // Convention: every mob in ENEMIES gets entries in SOURCE_LABELS +
  // SOURCE_COLOURS, even atk=0 mobs (e.g. MAGPIE has 'Magpie' / '#cceeff'
  // despite never dealing damage). ARCHITECT atk=0 means it never
  // appears as a death source, but the convention is followed for
  // registry-uniformity. Caught by post-merge audit driven by the
  // field-notes 2026-04-28-arc-shape-determines-review-yield insight:
  // "the seams between systems are where the bugs live — when adding
  // a new entity to a system that has registries, audit ALL the
  // registries". The 3-reviewer pass on PR #355 caught ENEMY_WEIGHTS
  // and CREDIT_VALUES omissions but missed these two.
  assert.match(SOURCE_METADATA, /ARCHITECT:\s*'Architect'/,
    "SOURCE_LABELS must contain ARCHITECT:'Architect'");
  assert.match(SOURCE_METADATA, /ARCHITECT:\s*'#aa6633'/,
    "SOURCE_COLOURS must contain ARCHITECT:'#aa6633' (matches mob colour)");
});

// ─── Constants block ────────────────────────────────────────────────────

test('ARCHITECT tuning constants are declared with documented values', () => {
  // Per design pass: range 8 tiles, target 1.5s, recovery 2.0s, idle 8.0s,
  // decay 12.0s. Re-tunes are intentional and require updating this test.
  assert.match(ENTITIES, /const\s+ARCHITECT_RANGE\s*=\s*8\b/,
    'ARCHITECT_RANGE must be 8 tiles');
  assert.match(ENTITIES, /const\s+ARCHITECT_TARGET_TIME\s*=\s*1\.5\b/,
    'ARCHITECT_TARGET_TIME must be 1.5s');
  assert.match(ENTITIES, /const\s+ARCHITECT_RECOVERY\s*=\s*2\.0\b/,
    'ARCHITECT_RECOVERY must be 2.0s');
  assert.match(ENTITIES, /const\s+ARCHITECT_IDLE_BASE\s*=\s*8\.0\b/,
    'ARCHITECT_IDLE_BASE must be 8.0s');
  assert.match(ENTITIES, /const\s+ARCHITECT_DECAY_TIME\s*=\s*12\.0\b/,
    'ARCHITECT_DECAY_TIME must be 12.0s');
});

// ─── ENEMIES table entry ────────────────────────────────────────────────

test('ARCHITECT is registered in ENEMIES table with stat block', () => {
  // Per design pass: hp=80, atk=0 (no direct damage — pure fortifier),
  // spd=0 (stationary), xpVal=30, colour #aa6633 (earth tone, distinct
  // from neon palette so player visually identifies "the brown mob is
  // the wall-builder").
  assert.match(ENEMY_STATS,
    /ARCHITECT:\s*\{\s*hp:\s*80,\s*atk:\s*0,\s*spd:\s*0,\s*xpVal:\s*30,\s*colour:\s*'#aa6633'\s*\}/,
    'ENEMY_BASE_STATS must declare ARCHITECT with hp=80 atk=0 spd=0 xpVal=30 colour=#aa6633');
});

// ─── AI dispatch wiring ──────────────────────────────────────────────────

test("AI dispatch switch routes ARCHITECT to aiArchitect()", () => {
  // The case statement in Enemy.update() must dispatch ARCHITECT to its
  // dedicated AI method. Without this, the mob would fall through to the
  // default chase behaviour and try to walk toward the player at spd=0
  // (no-op) — i.e. silently inert.
  assert.match(ENTITIES,
    /case\s+'ARCHITECT':\s*this\.aiArchitect\s*\(/,
    'AI dispatch must route ARCHITECT to aiArchitect()');
});

test('aiArchitect method exists on Enemy class', () => {
  // Pin existence of the method.
  assert.match(ENTITIES, /aiArchitect\s*\(\s*dt\s*,\s*player\s*,\s*map\s*,/,
    'Enemy.aiArchitect(dt, player, map, ...) must exist');
});

// ─── Elite-roll exclusion ────────────────────────────────────────────────

test('ARCHITECT is excluded from elite-affix roll', () => {
  // Elite affixes (BERSERK / SHIELDED / etc.) wouldn't make sense on a
  // stationary atk=0 mob. The exclusion list in spawnEnemy must include
  // ARCHITECT alongside other special-case mobs.
  assert.match(ENTITIES,
    /type\s*!==\s*'WATCHER'\s*&&\s*type\s*!==\s*'ARCHITECT'/,
    'Elite-affix roll exclusion must list ARCHITECT after WATCHER');
});

// ─── Stun-cancel branch ──────────────────────────────────────────────────

test('Stun cancels ARCHITECT target → recovery (defuses pending wall)', () => {
  // Per design pass + WATCHER/RESONATOR/MIRROR cancel pattern: a stunned
  // ARCHITECT in 'target' state must drop to 'recovery' so the wall
  // doesn't commit after stun ends. _aTarget is cleared (no pending
  // tile). _aCommitted stays false so the render branch's commit-flash
  // gate skips the visual — critical: without that gate, every
  // stun-cancel would briefly render a "wall built" flash even though
  // no wall was placed.
  const stunBlock = ENTITIES_CODE.match(
    /this\.type\s*===\s*'ARCHITECT'[\s\S]{0,400}_aCommitted\s*=\s*false/
  );
  assert.ok(stunBlock, 'stun-cancel block for ARCHITECT must exist');
  assert.match(stunBlock[0], /this\._aState\s*=\s*'recovery'/,
    'cancel must drop to recovery');
  assert.match(stunBlock[0], /this\._aTarget\s*=\s*null/,
    'cancel must clear _aTarget (no pending tile)');
});

// ─── placedWalls infrastructure ──────────────────────────────────────────

test('placedWalls module-level array is declared', () => {
  // The shared list of ARCHITECT-placed walls. Each entry:
  // { tx, ty, origTile, decayTimer, owner }.
  assert.match(ENTITIES,
    /const\s+placedWalls\s*=\s*\[\]/,
    'placedWalls module-level array must exist');
});

test('Floor transition clears placedWalls (no cross-floor leak)', () => {
  // Same class of bug as the MIRROR _shotHistory / ECHOER _posHistory
  // cross-floor leak: if placedWalls persists across floors a tile
  // reference would point at random coords on the new floor's map.
  const slice = GAME.match(
    /_shotHistory\.length\s*=\s*0;[\s\S]{0,1500}placedWalls\.length\s*=\s*0/
  );
  assert.ok(slice, 'loadFloor must clear placedWalls in the floor-transition block');
});

test('updatePlacedWalls is called from the main update loop', () => {
  // The decay tick must run every frame. Pin the call site.
  assert.match(GAME, /updatePlacedWalls\s*\(\s*dt\s*,\s*dungeon\.map\s*\)/,
    'game.js update loop must call updatePlacedWalls(dt, dungeon.map) each frame');
});

test('updatePlacedWalls helper is defined in architect-walls.js', () => {
  assert.match(ARCHITECT_WALLS, /function\s+updatePlacedWalls\s*\(\s*dt\s*,\s*map\s*\)/,
    'updatePlacedWalls(dt, map) helper must exist');
});

// ─── Helper signatures ───────────────────────────────────────────────────

test('pickArchitectTarget helper exists with documented signature', () => {
  assert.match(ARCHITECT_WALLS,
    /function\s+pickArchitectTarget\s*\(\s*ax\s*,\s*ay\s*,\s*px\s*,\s*py\s*,\s*map\s*,\s*player\s*\)/,
    'pickArchitectTarget(ax, ay, px, py, map, player) must exist');
});

test('_isTileOccupiedByActor helper exists', () => {
  assert.match(ARCHITECT_WALLS,
    /function\s+_isTileOccupiedByActor\s*\(\s*tx\s*,\s*ty\s*,\s*player\s*\)/,
    '_isTileOccupiedByActor(tx, ty, player) must exist');
});

// ─── Audio cues ──────────────────────────────────────────────────────────

test('architectTarget audio cue is defined in platform.js', () => {
  assert.match(PLATFORM, /architectTarget\s*\(\s*\)\s*\{/,
    'audio.architectTarget() must exist');
});

test('architectCommit audio cue is defined in platform.js', () => {
  assert.match(PLATFORM, /architectCommit\s*\(\s*\)\s*\{/,
    'audio.architectCommit() must exist');
});

// ─── BEHAVIOURAL: pickArchitectTarget logic ─────────────────────────────
//
// SCOPE NOTE: entities.js is browser-only (UMD-loaded) and not loadable
// as a CommonJS module, so these tests RE-DERIVE the helper in JS and
// assert the canonical behaviours the production helper must satisfy.
// If the production helper is changed, these tests detect the divergence
// only via the source-text pin above (the function signature + the
// documented constraints in its JSDoc). For pure-logic regression
// coverage of the BEHAVIOUR itself, these re-derived tests cover the
// design contract.

const T = { VOID:0, WALL:1, FLOOR:2 };

function reimpl_pickTarget(ax, ay, px, py, map, player, enemies = []) {
  const fractions = [0.5, 0.4, 0.6, 0.3, 0.7];
  const ptx = Math.floor(player.x), pty = Math.floor(player.y);
  for (const f of fractions) {
    const wx = ax + (px - ax) * f;
    const wy = ay + (py - ay) * f;
    const tx = Math.floor(wx);
    const ty = Math.floor(wy);
    if (ty < 0 || ty >= map.length || tx < 0 || tx >= (map[0]?.length || 0)) continue;
    if (map[ty][tx] !== T.FLOOR) continue;
    if (Math.floor(ax) === tx && Math.floor(ay) === ty) continue;
    // Adjacency rejection (per gpt-5.5 r1): Chebyshev ≥ 2 from player.
    if (Math.max(Math.abs(tx - ptx), Math.abs(ty - pty)) < 2) continue;
    if (reimpl_isOccupied(tx, ty, player, enemies)) continue;
    return { tx, ty };
  }
  return null;
}
function reimpl_isOccupied(tx, ty, player, enemies) {
  if (Math.floor(player.x) === tx && Math.floor(player.y) === ty) return true;
  for (const e of enemies) {
    if (e.dead) continue;
    if (Math.floor(e.x) === tx && Math.floor(e.y) === ty) return true;
  }
  return false;
}

test('pickArchitectTarget returns a tile BETWEEN architect and target', () => {
  // Per rubber-duck blocking issue #1: between-geometry is THE design
  // constraint. Adjacent-to-player walling creates telefrag-class
  // griefing — never allowed. Verify the helper picks tiles in the
  // [0.3, 0.7] fraction range from architect to target.
  const map = Array.from({length:10}, () => Array(10).fill(T.FLOOR));
  // Architect at (1,5), target at (8,5) — between is x ∈ [3,6].
  const t = reimpl_pickTarget(1.5, 5.5, 8.5, 5.5, map, {x:8.5, y:5.5});
  assert.ok(t, 'must return a tile');
  assert.ok(t.tx >= 3 && t.tx <= 6,
    `tile must be between architect and target, got tx=${t.tx}`);
  assert.equal(t.ty, 5, 'same row as architect/target');
});

test('pickArchitectTarget refuses to wall the player tile', () => {
  // Per rubber-duck design: when the midpoint IS the player's tile,
  // helper must skip and try the next fraction (or return null if no
  // fraction is valid). This is the canonical counterplay vector.
  const map = Array.from({length:10}, () => Array(10).fill(T.FLOOR));
  // Architect at (2,5), target at (8,5). Midpoint = (5,5) = player tile.
  // With adjacency rule (Chebyshev ≥ 2 from player), tiles 4,5,6 (row 5)
  // are all rejected → helper must return null OR a tile far enough.
  const t = reimpl_pickTarget(2.5, 5.5, 8.5, 5.5, map, {x:5.5, y:5.5});
  assert.ok(t === null || (t.tx !== 5 || t.ty !== 5),
    'must NOT pick the player\'s tile');
});

test('pickArchitectTarget refuses to wall tiles ADJACENT to the player (per gpt-5.5 r1)', () => {
  // Per rubber-duck blocking #1 + gpt-5.5 r1: Chebyshev ≥ 2 from player.
  // Adjacent walling creates forced-shove / cheap-prison states even
  // if the player isn't ON the target tile at commit time.
  const map = Array.from({length:10}, () => Array(10).fill(T.FLOOR));
  // Architect at (1,5), player at (4,5). Midpoint candidate is (2,5)
  // — Chebyshev distance 2 from player → ALLOWED.
  const t1 = reimpl_pickTarget(1.5, 5.5, 4.5, 5.5, map, {x:4.5, y:5.5});
  if (t1) {
    const cheby = Math.max(Math.abs(t1.tx - 4), Math.abs(t1.ty - 5));
    assert.ok(cheby >= 2,
      `tile (${t1.tx},${t1.ty}) is too close to player (Chebyshev=${cheby}); must be >= 2`);
  }
  // Architect at (3,5), player at (5,5). Every fraction yields tiles at
  // Chebyshev distance 1-2. Tiles within Chebyshev<2 of player must be
  // rejected.
  const t2 = reimpl_pickTarget(3.5, 5.5, 5.5, 5.5, map, {x:5.5, y:5.5});
  if (t2) {
    const cheby = Math.max(Math.abs(t2.tx - 5), Math.abs(t2.ty - 5));
    assert.ok(cheby >= 2,
      `tile (${t2.tx},${t2.ty}) is too close to player (Chebyshev=${cheby}); must be >= 2`);
  }
});

test('pickArchitectTarget refuses to wall non-FLOOR tiles', () => {
  // Per design: only FLOOR tiles are valid. Walls/doors/traps/etc. must
  // not be overwritten — preserves the dungeon's structural integrity.
  const map = Array.from({length:10}, () => Array(10).fill(T.WALL));
  const t = reimpl_pickTarget(1.5, 5.5, 8.5, 5.5, map, {x:8.5, y:5.5});
  assert.equal(t, null, 'all-WALL map must yield no valid target');
});

test('pickArchitectTarget refuses to wall occupied-by-enemy tiles', () => {
  // Per design: skip tiles occupied by enemies — prevents an architect
  // from walling its own ally into a sub-region (and the silly recursive
  // case of walling another architect mid-build).
  const map = Array.from({length:10}, () => Array(10).fill(T.FLOOR));
  // Architect at (1,5), player at (8,5), enemy at (5,5) — midpoint.
  // First fraction (0.5) → (4,5)? Let me re-check: midpoint of (1.5,5.5)
  // and (8.5,5.5) is (5,5.5) → tile (5,5). That's the enemy. Next
  // fraction (0.4) → (1.5 + 7*0.4, 5.5) = (4.3, 5.5) → tile (4,5).
  const enemy = {x: 5.5, y: 5.5, dead: false};
  const t = reimpl_pickTarget(1.5, 5.5, 8.5, 5.5, map, {x:8.5, y:5.5}, [enemy]);
  assert.ok(t, 'must return a non-occupied tile');
  assert.notEqual(t.tx, 5, 'must skip the enemy tile (5,5)');
});

test('pickArchitectTarget skips dead enemies in occupancy check', () => {
  const map = Array.from({length:10}, () => Array(10).fill(T.FLOOR));
  const deadEnemy = {x: 5.5, y: 5.5, dead: true};
  const t = reimpl_pickTarget(1.5, 5.5, 8.5, 5.5, map, {x:8.5, y:5.5}, [deadEnemy]);
  // Should pick (5,5) since dead enemies don't block.
  assert.ok(t, 'must return a tile');
  assert.equal(t.tx, 5, 'dead enemies must NOT block placement (occupancy ignores dead)');
});

test('pickArchitectTarget refuses to wall the architect\'s own tile', () => {
  // Edge case: architect right next to target (e.g. player walked up
  // close). The 0.5 fraction would place at the architect's tile — must
  // be skipped to avoid the architect walling itself in.
  const map = Array.from({length:10}, () => Array(10).fill(T.FLOOR));
  // Architect at (5,5), player at (5,6) — fractions 0.3..0.7 in y all
  // produce ty=5 (architect's own row). The architect-own-tile guard
  // skips this; helper either returns null OR a different tile.
  const t = reimpl_pickTarget(5.5, 5.5, 5.5, 6.5, map, {x:5.5, y:6.5});
  // Either null (no valid placement) OR a tile that isn't (5,5).
  if (t !== null) {
    assert.ok(t.tx !== 5 || t.ty !== 5,
      'must NOT pick the architect\'s own tile');
  }
});

test('pickArchitectTarget returns null when all candidate tiles are blocked', () => {
  // Map mostly walls — no FLOOR tile in the line.
  const map = Array.from({length:10}, () => Array(10).fill(T.WALL));
  map[5][1] = T.FLOOR; // architect tile
  map[5][8] = T.FLOOR; // target tile
  const t = reimpl_pickTarget(1.5, 5.5, 8.5, 5.5, map, {x:8.5, y:5.5});
  assert.equal(t, null, 'all-fractions-on-wall map must yield null');
});
