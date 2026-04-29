'use strict';
// REPULSOR_TILE — 8th hazard tile. Positional knockback on player entry: boots
// the player back in the direction OPPOSITE to player.facing (the way they
// came), wall-aware, NO HP damage. The cost is positional commitment + the
// routing detour.
//
// Distinct from sibling hazard tiles:
//   - TRAP_SPIKE : one-shot damage on entry (no displacement)
//   - TRAP_SLOW  : -1.5 speedBoost for 3s (impede, not freeze)
//   - PLASMA     : continuous burn DPS in zone
//   - ARC        : pulsed periodic damage in zone
//   - TOXIC      : continuous damage + slow in zone
//   - SHOCK_TILE : 0.5s movement freeze on entry (no damage)
//   - REPULSOR   : 1.6-cell knockback opposite to facing on entry (no damage)
//
// Source-text wiring tests (game.js / render.js / content.js are
// browser-only — no UMD/CommonJS exports — same pattern as shock-tile /
// biome-damage-flash / bulwark-perk / nullifier).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PLATFORM = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'platform.js'), 'utf8');
const GAME     = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'game.js'),     'utf8');
const CONTENT  = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'content.js'),  'utf8');
const RENDER   = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'render.js'),   'utf8');

// Strip ONLY full-line // comments (per stripComments-full-line-only convention
// from biome-damage-flash r2). Trailing `//` comments preserved on purpose.
/** @param {string} src */
function stripFullLineComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/[^\n]*$/gm, '');
}

/**
 * Walk forward from `start` with a balanced-brace counter; return the slice
 * starting at `start` and ending at the matching closer index (inclusive).
 * @param {string} src
 * @param {number} start
 * @param {string} open
 * @param {string} close
 */
function extractBalanced(src, start, open, close) {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === open) depth++;
    else if (src[i] === close) {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Extract the body of the `else if (tile===T.REPULSOR …)` branch in game.js,
 * using a balanced-brace walker so inner `if (…) { … }` blocks (and other
 * inline braces) don't truncate the match the way a non-greedy `[\s\S]*?\}`
 * regex would. Returns the slice from the `else if` keyword through the
 * matching closing brace (inclusive).
 * @param {string} src
 */
function extractRepulsorBranch(src) {
  const stripped = stripFullLineComments(src);
  const headStart = stripped.search(/else\s+if\s*\(\s*tile\s*===\s*T\.REPULSOR\b/);
  if (headStart < 0) return null;
  // Skip past the head's balanced parens first.
  const parenStart = stripped.indexOf('(', headStart);
  let pdepth = 0, parenEnd = -1;
  for (let i = parenStart; i < stripped.length; i++) {
    if (stripped[i] === '(') pdepth++;
    else if (stripped[i] === ')') {
      pdepth--;
      if (pdepth === 0) { parenEnd = i; break; }
    }
  }
  if (parenEnd < 0) return null;
  const braceStart = stripped.indexOf('{', parenEnd);
  if (braceStart < 0) return null;
  const block = extractBalanced(stripped, braceStart, '{', '}');
  if (!block) return null;
  return stripped.slice(headStart, braceStart) + block;
}

// ─── T enum ───────────────────────────────────────────────────────────────

test('T.REPULSOR is registered as integer 24 in platform.js T enum', () => {
  assert.match(PLATFORM, /\bREPULSOR\s*:\s*24\b/,
    'platform.js T enum must declare REPULSOR:24');
});

test('T.REPULSOR is unique — no other tile shares id 24', () => {
  const enumMatch = PLATFORM.match(/const\s+T\s*=\s*\{[^}]*\}\s*;/);
  assert.ok(enumMatch, 'T enum block must be locatable in platform.js');
  const colons = enumMatch[0].match(/:\s*24\b/g) || [];
  assert.equal(colons.length, 1,
    `T enum must contain exactly one tile id 24 (got ${colons.length})`);
});

// ─── isPassable ───────────────────────────────────────────────────────────

test('isPassable accepts T.REPULSOR (player must be able to enter to trigger)', () => {
  const m = PLATFORM.match(/function\s+isPassable\s*\(\s*t\s*\)\s*\{[^}]*\}/);
  assert.ok(m, 'isPassable function must be locatable');
  assert.match(m[0], /t\s*===\s*T\.REPULSOR/,
    'isPassable must include T.REPULSOR in its passable-tile disjunction');
});

// ─── audio.repulsor cue ───────────────────────────────────────────────────

test('audio.repulsor() cue is defined in platform.js audio block', () => {
  // Exists, is a function, calls into the engine (osc/noise) — defends
  // against a no-op stub `repulsor() {}` that would silently drop the SFX.
  const m = PLATFORM.match(/repulsor\s*\(\s*\)\s*\{[\s\S]*?\n\s{4}\}/);
  assert.ok(m, 'audio.repulsor() must be defined');
  const body = stripFullLineComments(m[0]);
  assert.match(body, /\b(osc|noise)\s*\(/,
    'audio.repulsor() body must call an engine primitive (osc or noise)');
});

// ─── game.js trap-trigger block ───────────────────────────────────────────

test('game.js trap-trigger handles T.REPULSOR: gates on damage-immune, sets trapCooldown 1.2, calls audio.repulsor', () => {
  const body = extractRepulsorBranch(GAME);
  assert.ok(body, 'game.js must contain an `else if (tile===T.REPULSOR …)` branch');

  // Damage-immune frames bypass — matches PLASMA/ARC/TOXIC/SHOCK convention
  // so dash-through-hazard reads consistently across all hazard tiles.
  assert.match(body, /!isPlayerDamageImmune\s*\(\s*\)/,
    'REPULSOR branch must gate on !isPlayerDamageImmune() (dash i-frames bypass)');

  // Cooldown literal pinned. 1.2s is long enough to outlast the visible
  // knockback animation but short enough that re-entry from a corridor is
  // responsive.
  assert.match(body, /player\.trapCooldown\s*=\s*1\.2\s*;/,
    'REPULSOR branch must set player.trapCooldown = 1.2');

  // SFX call.
  assert.match(body, /audio\.repulsor\s*\(\s*\)\s*;/,
    'REPULSOR branch must call audio.repulsor()');

  // Player feedback — message + particles.
  assert.match(body, /this\.msg\s*\(\s*['"]Repulsor!?['"]/,
    'REPULSOR branch must call this.msg("Repulsor!" …)');
  assert.match(body, /spawnParticles\s*\(\s*player\.x\s*,\s*player\.y\s*,\s*['"]SPARK['"]/,
    'REPULSOR branch must spawn SPARK particles at player.x, player.y');
});

test('REPULSOR branch derives knockback direction from movement delta player._prevX/Y (codex r2: tile-centre-delta flips on frame hitch)', () => {
  // Codex r2 finding: deriving direction from (player.x - tileCentre)
  // flips when the player crosses past the tile centre in a single frame
  // (frame hitch with large dt → multi-tile movement). Movement-delta is
  // hitch-stable: player._prevX / _prevY are captured at the start of
  // Player.update (entities.js:12845) BEFORE any movement, so their
  // difference from current player.x/y is exactly this frame's movement
  // vector. Negating it gives the entry direction.
  //
  // Codex r1 prior finding: do NOT use player.facing as primary — it's
  // overwritten every frame by aim handlers (game.js:1531/1544). Facing
  // is the FINAL fallback only.
  const body = extractRepulsorBranch(GAME);
  assert.ok(body, 'REPULSOR branch must be locatable');
  // Pin both axes of the movement-delta read.
  assert.match(body, /player\._prevX/,
    'REPULSOR branch must read player._prevX (movement delta source — hitch-stable)');
  assert.match(body, /player\._prevY/,
    'REPULSOR branch must read player._prevY');
  // The delta direction is (prev - current). Pin one of the deltas as
  // EXACTLY `... - player.x` form (knockback pushes back the way they came).
  assert.match(body, /\)\s*-\s*player\.x/,
    'REPULSOR branch must compute movement delta as (prev - current) so knockback opposes the entry direction');
  assert.match(body, /\)\s*-\s*player\.y/,
    'REPULSOR branch must compute Y movement delta as (prev - current)');
});

test('REPULSOR branch falls back to tile-centre delta then opposite-of-facing (degraded path for zero-movement entries)', () => {
  // The fallback chain handles "didn't actually move this frame" entries
  // (gravity-well-cancellation, collision-zeroed deltas, teleport arrivals).
  // Pin: at LEAST 2 dead-zone gates (Math.abs check), one for the
  // movement-delta degeneracy and one for the tile-centre-delta degeneracy.
  const body = extractRepulsorBranch(GAME);
  assert.ok(body, 'REPULSOR branch must be locatable');
  const absChecks = body.match(/Math\.abs\s*\(/g) || [];
  assert.ok(absChecks.length >= 2,
    `REPULSOR branch must have ≥ 2 Math.abs near-zero gates (movement-delta + tile-centre-delta) (got ${absChecks.length})`);
  // Pin tile-centre fallback: tx + 0.5 / ty + 0.5.
  assert.match(body, /tx\s*\+\s*0\.5/,
    'REPULSOR branch must use tile-centre X (tx + 0.5) as the secondary fallback origin');
  assert.match(body, /ty\s*\+\s*0\.5/,
    'REPULSOR branch must use tile-centre Y (ty + 0.5) as the secondary fallback origin');
  // Pin facing as final fallback: negation present + null-guard reads.
  assert.match(body, /player\.facing\s*&&\s*player\.facing\.x/,
    'REPULSOR branch must read player.facing.x with null-guard in the final-fallback path');
  assert.match(body, /player\.facing\s*&&\s*player\.facing\.y/,
    'REPULSOR branch must read player.facing.y with null-guard in the final-fallback path');
  assert.match(body, /=\s*-\s*\w+\s*;\s*\w+\s*=\s*-\s*\w+\s*;/,
    'REPULSOR final-fallback must NEGATE facing components (kxr = -fxr; kyr = -fyr)');
});

test('REPULSOR branch normalises knockback (so diagonal entry pushes the same magnitude as cardinal)', () => {
  const body = extractRepulsorBranch(GAME);
  assert.ok(body, 'REPULSOR branch must be locatable');
  assert.match(body, /Math\.hypot\s*\(/,
    'REPULSOR branch must call Math.hypot to normalise the knockback vector');
});

test('REPULSOR push distance ≤ 1.0 tile (codex r2: prevents tunnel-through-wall)', () => {
  // Codex r2 finding: PUSH > 1.0 with endpoint-only isPassable checks
  // lets the knockback skip past a 1-tile-wide wall when the destination
  // happens to be passable (intermediate cells are never tested). Pin the
  // PUSH constant ≤ 1.0 — bounds the per-axis check to ADJACENT cells
  // only, making tunnel-through-wall impossible.
  const body = extractRepulsorBranch(GAME);
  assert.ok(body, 'REPULSOR branch must be locatable');
  const pushM = body.match(/\bPUSH\s*=\s*([\d.]+)/);
  assert.ok(pushM, 'REPULSOR branch must declare a numeric PUSH constant');
  const push = parseFloat(pushM[1]);
  assert.ok(push <= 1.0,
    `REPULSOR PUSH must be ≤ 1.0 to prevent tunnel-through-wall (got ${push}). PUSH > 1.0 with endpoint-only isPassable checks lets the player skip a 1-tile wall when the destination cell is passable. If you want a longer push, you must add a swept-substep check loop.`);
  // Lower bound: the knockback must visibly displace the player. Anything
  // below ~0.5 reads as "no movement".
  assert.ok(push >= 0.5,
    `REPULSOR PUSH must be ≥ 0.5 to read as a kick (got ${push}).`);
});

test('REPULSOR branch is wall-aware: per-axis + diagonal-cell isPassable check (no clipping into walls)', () => {
  // Mirrors the CHARGER mob convention at entities.js:6062 PLUS a
  // diagonal-cell guard against the corner-wedge clip (codex r1: per-axis
  // individually passable + diagonal cell wall = clip into wall corner).
  // The branch must call isPassable AT LEAST 3 times (X-axis, Y-axis,
  // diagonal-cell) before committing the combined diagonal write.
  const body = extractRepulsorBranch(GAME);
  assert.ok(body, 'REPULSOR branch must be locatable');
  const passableCalls = body.match(/isPassable\s*\(/g) || [];
  assert.ok(passableCalls.length >= 3,
    `REPULSOR branch must call isPassable at least 3 times (X-axis + Y-axis + diagonal cell) (got ${passableCalls.length})`);
  const xWrites = body.match(/player\.x\s*=(?!=)/g) || [];
  const yWrites = body.match(/player\.y\s*=(?!=)/g) || [];
  // canX-only, canY-only, AND combined-diag → at least 2 distinct write
  // sites for each axis (the diagonal-commit + the axis-only slide).
  assert.ok(xWrites.length >= 2,
    `REPULSOR branch must have ≥ 2 player.x write sites (diagonal-commit + axis-only slide) (got ${xWrites.length})`);
  assert.ok(yWrites.length >= 2,
    `REPULSOR branch must have ≥ 2 player.y write sites (diagonal-commit + axis-only slide) (got ${yWrites.length})`);
});

test('REPULSOR branch contains EXACTLY ONE write to player.trapCooldown (defeats COMPUTED-BUT-NOT-APPLIED bypass)', () => {
  // Mirrors the SHOCK_TILE EXACTLY-ONE-WRITE pattern (see tests/shock-tile.test.js
  // round-2 hardening). Without this guard a contributor could append
  // `player.trapCooldown = 0;` after the legitimate write, silently looping
  // the knockback every frame the player stands on the tile.
  //
  // Closes 4 laundering vectors:
  //   (1) ALIASING: `const p = player; p.trapCooldown = 0;`
  //   (2) ALL bracket access on player (computed-key + template-literal-key)
  //   (3) COMPOUND-ASSIGNMENT (`+=`, `-=`, `??=`, etc.)
  //   (4) REFLECTIVE MUTATION (Object.assign / defineProperty / Reflect.set)
  const body = extractRepulsorBranch(GAME);
  assert.ok(body, 'REPULSOR branch must be locatable');
  // Forbid aliasing of `player` inside the branch. Negative lookahead
  // `(?!\s*[.[\w$])` rules out legitimate property reads like
  // `const nxr = player.x + ...` (the position arithmetic), matching only
  // true aliases (`const p = player;`, `const p = player,`, EOL, etc.).
  assert.doesNotMatch(body, /\b(?:const|let|var)\s+\w+\s*=\s*player(?!\s*[.[\w$])/,
    'REPULSOR branch must not alias `player` (e.g. `const p = player`).');
  // Forbid ANY bracket access on `player` (closes computed-key + template-literal vectors).
  assert.doesNotMatch(body, /\bplayer\s*\[/,
    'REPULSOR branch must not use any bracket access on `player`.');
  // Forbid reflective mutation primitives that mention trapCooldown.
  for (const prim of [
    'Object\\.assign',
    'Object\\.defineProperty',
    'Object\\.defineProperties',
    'Reflect\\.set',
    'Reflect\\.defineProperty',
  ]) {
    const re = new RegExp(prim + '\\s*\\([^)]*trapCooldown');
    assert.doesNotMatch(body, re,
      `REPULSOR branch must not use ${prim.replace(/\\/g,'')}(…trapCooldown…) — would launder a write past the count guard.`);
  }
  // Forbid compound-assignment operators on trapCooldown.
  const compoundOp = /(?:\+|-|\*\*?|\/|%|<<|>>>?|&&?|\|\|?|\^|\?\?)=/;
  const compoundCD = new RegExp('\\.trapCooldown\\s*' + compoundOp.source);
  assert.doesNotMatch(body, compoundCD,
    'REPULSOR branch must not use a compound-assignment operator on .trapCooldown.');
  // Pin write count to exactly 1. With aliasing + bracket access + reflective
  // mutation + compound ops ruled out, dot-notation writes must come from
  // the `player.` literal binding.
  const cdWrites = body.match(/\.trapCooldown\s*=(?!=)/g) || [];
  assert.equal(cdWrites.length, 1,
    `REPULSOR branch must contain exactly 1 write to .trapCooldown (got ${cdWrites.length}). A second write (e.g. \`player.trapCooldown = 0;\`) would loop the knockback every frame.`);
});

test('REPULSOR branch is not compile-time dead — exact-shape head pin', () => {
  // Mirrors the SHOCK_TILE exact-shape head pin (defeats `&& false` /
  // `|| true` / `?? null` bypass that would silently neuter the entire
  // branch). Walk the `else if (...)` head from `(` to its matching `)`
  // and assert the captured condition string matches EXACTLY the legitimate
  // two-clause shape.
  const stripped = stripFullLineComments(GAME);
  const headStart = stripped.search(/else\s+if\s*\(\s*tile\s*===\s*T\.REPULSOR\b/);
  assert.ok(headStart >= 0, 'REPULSOR `else if` head must be locatable');
  const parenStart = stripped.indexOf('(', headStart);
  let depth = 0, parenEnd = -1;
  for (let i = parenStart; i < stripped.length; i++) {
    if (stripped[i] === '(') depth++;
    else if (stripped[i] === ')') {
      depth--;
      if (depth === 0) { parenEnd = i; break; }
    }
  }
  assert.ok(parenEnd > parenStart, 'REPULSOR head must have a balanced (...)');
  const condition = stripped.slice(parenStart + 1, parenEnd).trim();
  assert.match(condition, /^tile\s*===\s*T\.REPULSOR\s*&&\s*!\s*isPlayerDamageImmune\s*\(\s*\)\s*$/,
    `REPULSOR head condition must match EXACTLY \`tile === T.REPULSOR && !isPlayerDamageImmune()\` (got: \`${condition}\`). Any extra clause (e.g. \`&& false\`, \`|| true\`, \`?? null\`) would silently neutralize the entire branch.`);
});

test('REPULSOR branch deals NO HP damage (positional hazard only)', () => {
  // The whole point of the tile is positional commitment, not HP. A
  // contributor adding `player.takeDamage(...)` would silently stack
  // damage with displacement — making the tile feel doubly punishing.
  // Pin: the branch body must NOT contain takeDamage.
  const body = extractRepulsorBranch(GAME);
  assert.ok(body, 'REPULSOR branch must be locatable');
  assert.doesNotMatch(body, /\.takeDamage\s*\(/,
    'REPULSOR branch must not call .takeDamage() — the tile is positional-only.');
});

// ─── safe-spawn exclusion ─────────────────────────────────────────────────

test('isSafeSpawn excludes T.REPULSOR (player should never spawn on a launchpad)', () => {
  const m = GAME.match(/const\s+isSafeSpawn\s*=\s*\([\s\S]*?;/);
  assert.ok(m, 'isSafeSpawn helper must be locatable in game.js');
  assert.match(m[0], /t\s*!==\s*T\.REPULSOR/,
    'isSafeSpawn must exclude T.REPULSOR so the spawn-arrival tile never punts the player');
});

// ─── content.js generation + reachability ─────────────────────────────────

test('content.js trap generation can place T.REPULSOR alongside spike/slow/shock', () => {
  // Trap-mix picker: 4-way (spike / slow / shock / repulsor). All four tile
  // types must be present in the picker — without the REPULSOR branch the
  // new tile would be unreachable in a generated dungeon.
  const stripped = stripFullLineComments(CONTENT);
  const m = stripped.match(/map\[ty\]\[tx\]\s*===\s*T\.FLOOR[\s\S]{0,500}T\.REPULSOR/);
  assert.ok(m, 'content.js trap-gen block must be able to assign T.REPULSOR');
  const tx = m[0];
  assert.match(tx, /T\.TRAP_SPIKE/, 'trap-gen still places TRAP_SPIKE');
  assert.match(tx, /T\.TRAP_SLOW/,  'trap-gen still places TRAP_SLOW');
  assert.match(tx, /T\.SHOCK_TILE/, 'trap-gen still places SHOCK_TILE');
  assert.match(tx, /T\.REPULSOR/,   'trap-gen places REPULSOR');
});

test('content.js trap-mix sums to 1.0 — no cumulative-roll hole that drops a hazard type', () => {
  // The picker uses cumulative thresholds (`roll < 0.55 ? A : roll < 0.77 ? B : ...`).
  // A common mistake is to leave a hole (e.g. `< 0.55 ? A : < 0.70 ? B : < 0.90 ? C : D`
  // skips the 0.70–0.90 range for B). Pin: every threshold must be strictly
  // ascending and the picker must end with a default (no `: nothing`).
  const stripped = stripFullLineComments(CONTENT);
  const pickerM = stripped.match(/const\s+roll\s*=\s*Math\.random\(\)\s*;[\s\S]*?T\.REPULSOR\s*;/);
  assert.ok(pickerM, 'trap-mix picker must be locatable');
  const picker = pickerM[0];
  // Extract numeric thresholds in order and assert strictly ascending.
  const nums = (picker.match(/roll\s*<\s*([\d.]+)/g) || [])
    .map(s => parseFloat(s.replace(/roll\s*<\s*/, '')));
  assert.ok(nums.length >= 3,
    `trap-mix picker must have at least 3 ascending thresholds (got ${nums.length})`);
  for (let i = 1; i < nums.length; i++) {
    assert.ok(nums[i] > nums[i - 1],
      `trap-mix thresholds must be strictly ascending — got ${nums[i - 1]} >= ${nums[i]}`);
  }
  // Final threshold must be < 1.0 so the default branch gets non-zero
  // probability — otherwise REPULSOR would never spawn.
  assert.ok(nums[nums.length - 1] < 1.0,
    `final trap-mix threshold must be < 1.0 to leave probability for the default branch (got ${nums[nums.length - 1]})`);
});

test('content.js dungeon-reachability `passable` predicate counts T.REPULSOR as walkable', () => {
  // The reachability flood-fill (computeReach) uses a local `passable`
  // helper distinct from the runtime isPassable. REPULSOR must be in
  // that list — otherwise the flood-fill could falsely conclude that a
  // REPULSOR-bearing corridor is unreachable, triggering a costly
  // regen loop.
  const m = CONTENT.match(/const\s+passable\s*=\s*\(\s*\/\*\*[\s\S]*?\)\s*=>[\s\S]*?T\.CHALLENGE_GATE\s*;/);
  assert.ok(m, 'computeReach `passable` helper must be locatable in content.js');
  assert.match(m[0], /t\s*===\s*T\.REPULSOR/,
    'computeReach `passable` must include t === T.REPULSOR');
});

// ─── render.js drawWorld switch case + minimap ────────────────────────────

test('render.js drawWorld switch contains a `case T.REPULSOR:` block', () => {
  assert.match(RENDER, /case\s+T\.REPULSOR\s*:/,
    'render.js drawWorld switch must contain `case T.REPULSOR:`');
});

test('render.js REPULSOR case actually draws something (non-empty body)', () => {
  // Defence against an empty `case T.REPULSOR: break;` placeholder that
  // satisfies the presence regex above but renders nothing.
  const start = RENDER.indexOf('case T.REPULSOR');
  assert.ok(start >= 0, 'REPULSOR case must exist');
  const braceStart = RENDER.indexOf('{', start);
  assert.ok(braceStart >= 0 && braceStart - start < 60,
    'REPULSOR case must open a balanced `{ ... }` block');
  const block = extractBalanced(RENDER, braceStart, '{', '}');
  assert.ok(block, 'REPULSOR case block must be balanced');
  // Must paint floor base + at least one cyan-coded glyph + the outward
  // arrows (stroke calls) telegraphing the push direction.
  assert.match(block, /ctx\.fillRect\s*\(/,  'REPULSOR case must call ctx.fillRect at least once');
  assert.match(block, /#44ddff|#aaeeff/,     'REPULSOR case must paint with a repulsor-cyan colour');
  assert.match(block, /ctx\.stroke\s*\(/,    'REPULSOR case must stroke the outward arrows');
  assert.match(block, /\bbreak\s*;/,         'REPULSOR case must end with break;');
});

test('render.js minimap colours T.REPULSOR as floor (not empty/wall)', () => {
  // Two minimap render paths exist (full minimap + corner minimap). Both
  // must include REPULSOR in the floor-tile disjunction so the player can
  // see REPULSOR tiles as walkable on the map (not as void).
  const matches = RENDER.match(/tile\s*===\s*T\.REPULSOR/g) || [];
  assert.ok(matches.length >= 2,
    `render.js minimap must reference T.REPULSOR in both minimap paths (got ${matches.length})`);
});

// ─── facing-read contract (knockback direction source) ────────────────────

test('Player initialises this.facing={x:1,y:0} (REPULSOR knockback default direction)', () => {
  // REPULSOR reads player.facing for the push direction. If facing is
  // ever undefined (e.g. cold spawn before any movement), the branch
  // would null-deref. Pin that Player constructor sets a default facing.
  const ENTITIES = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8');
  const stripped = stripFullLineComments(ENTITIES);
  assert.match(stripped, /this\.facing\s*=\s*\{\s*x\s*:\s*1\s*,\s*y\s*:\s*0\s*\}/,
    'entities.js Player constructor must initialise this.facing={x:1,y:0} — REPULSOR null-guards but a missing default would silently degrade to the (-1,0) fallback for the entire run');
});

test('REPULSOR branch precedes SHOCK_TILE branch in game.js trap-trigger chain (preserves shock-tile.test.js boundary)', () => {
  // tests/shock-tile.test.js extracts the SHOCK_TILE branch body via a
  // non-greedy `[\s\S]*?\}\s*\n` regex. SHOCK_TILE's own close is
  // `} else if` (no `\n` after the `}`), so the regex can only stop at
  // SHOCK_TILE's close if NO branch follows it. Adding REPULSOR after
  // SHOCK_TILE silently spilled the shock-tile body extraction into the
  // REPULSOR body, false-triggering the SHOCK_TILE EXACTLY-ONE-WRITE
  // guard (REPULSOR has `const nxr = player.x + ...` which the alias
  // regex matched). Pin: REPULSOR appears BEFORE SHOCK_TILE in the chain.
  const stripped = stripFullLineComments(GAME);
  const repulsorIdx = stripped.search(/else\s+if\s*\(\s*tile\s*===\s*T\.REPULSOR\b/);
  const shockIdx    = stripped.search(/else\s+if\s*\(\s*tile\s*===\s*T\.SHOCK_TILE\b/);
  assert.ok(repulsorIdx >= 0, 'REPULSOR branch must exist');
  assert.ok(shockIdx >= 0, 'SHOCK_TILE branch must exist');
  assert.ok(repulsorIdx < shockIdx,
    `REPULSOR branch must appear BEFORE SHOCK_TILE branch in game.js (REPULSOR @${repulsorIdx} vs SHOCK_TILE @${shockIdx}) — required to keep tests/shock-tile.test.js's body-extraction regex stable. If you need to reorder, first migrate shock-tile.test.js's branch extraction to use a balanced-brace walker (see extractRepulsorBranch in this file).`);
});
