'use strict';
// SHOCK_TILE — 7th hazard tile. Brief movement-suppress on player entry by
// hooking the existing Player.shockTimer primitive (already wired in
// entities.js to zero movement input but leave aim+shoot intact —
// originally driven by the SHOCKER mob; this tile reuses the same field).
//
// Distinct from sibling hazard tiles:
//   - TRAP_SPIKE : one-shot damage on entry (no status)
//   - TRAP_SLOW  : -1.5 speedBoost for 3s (impede, not freeze)
//   - PLASMA     : continuous burn DPS in zone
//   - ARC        : pulsed periodic damage in zone
//   - TOXIC      : continuous damage + slow in zone
//   - SHOCK_TILE : 0.5s movement freeze on entry (no damage)
//
// Source-text wiring tests (game.js / render.js / floor-generator.js are
// browser-only — no UMD/CommonJS exports — same pattern as
// biome-damage-flash / bulwark-perk / nullifier).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PLATFORM = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'platform.js'), 'utf8');
const GAME     = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'game.js'),     'utf8');
const FLOOR_GENERATOR = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'content', 'floor-generator.js'),  'utf8');
const RENDER   = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'render.js'),   'utf8');

// Strip ONLY full-line // comments so a `// if (X)` placeholder can't satisfy
// gate-presence checks. Trailing `//` comments are intentionally preserved
// (per stripComments-full-line-only convention from biome-damage-flash r2 —
// match-count == 1 guards on positive structural tests defend the rest).
/** @param {string} src */
function stripFullLineComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/[^\n]*$/gm, '');
}

/**
 * Walk forward from `start` with a balanced-brace counter; return the slice
 * starting at `start` and ending at the matching closer index (inclusive).
 * Used to extract a switch-case block or a function body without lookahead
 * fragility.
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

// Note: an earlier draft of this file used a generic `hasDeadBranch` helper
// (mirroring tests/boss-death-telegraph.test.js) to detect compile-time-dead
// `if (... && false)` heads. Round-2 review (codex) flagged that running
// such a detector across the whole branch BODY produces false positives on
// nested ifs and string literals. Replaced with an EXACT-shape pin on the
// `else if (...)` condition head — see the `exact-shape head pin` test
// below. Stronger AND simpler.

// ─── T enum ───────────────────────────────────────────────────────────────

test('T.SHOCK_TILE is registered as integer 23 in platform.js T enum', () => {
  // The T enum is a single-line literal; pin SHOCK_TILE:23 exactly so a
  // contributor can't silently collide with an existing tile id.
  assert.match(PLATFORM, /\bSHOCK_TILE\s*:\s*23\b/,
    'platform.js T enum must declare SHOCK_TILE:23');
});

test('T.SHOCK_TILE is unique — no other tile shares id 23', () => {
  // Defends against an accidental dup like FOO:23 elsewhere in the enum.
  // The T enum line itself contains every tile, so count occurrences of
  // ":23" in the T enum block specifically.
  const enumMatch = PLATFORM.match(/const\s+T\s*=\s*\{[^}]*\}\s*;/);
  assert.ok(enumMatch, 'T enum block must be locatable in platform.js');
  const colons = enumMatch[0].match(/:\s*23\b/g) || [];
  assert.equal(colons.length, 1,
    `T enum must contain exactly one tile id 23 (got ${colons.length})`);
});

// ─── isPassable ───────────────────────────────────────────────────────────

test('isPassable accepts T.SHOCK_TILE (player must be able to enter to trigger)', () => {
  const m = PLATFORM.match(/function\s+isPassable\s*\(\s*t\s*\)\s*\{[^}]*\}/);
  assert.ok(m, 'isPassable function must be locatable');
  assert.match(m[0], /t\s*===\s*T\.SHOCK_TILE/,
    'isPassable must include T.SHOCK_TILE in its passable-tile disjunction');
});

// ─── audio.shockTile cue ──────────────────────────────────────────────────

test('audio.shockTile() cue is defined in platform.js audio block', () => {
  // Exists, is a function, calls into the engine (osc/noise) — defends
  // against a no-op stub `shockTile() {}` that would silently drop the SFX.
  const m = PLATFORM.match(/shockTile\s*\(\s*\)\s*\{[\s\S]*?\n\s{4}\}/);
  assert.ok(m, 'audio.shockTile() must be defined');
  const body = stripFullLineComments(m[0]);
  // Must invoke at least one engine primitive — osc OR noise.
  assert.match(body, /\b(osc|noise)\s*\(/,
    'audio.shockTile() body must call an engine primitive (osc or noise)');
});

// ─── game.js trap-trigger block ───────────────────────────────────────────

test('game.js trap-trigger handles T.SHOCK_TILE: sets shockTimer >= 0.5 and trapCooldown 1.5', () => {
  // Locate the SHOCK_TILE branch inside the player.trapCooldown <= 0 block.
  // Pin: gate on tile===T.SHOCK_TILE, isPlayerDamageImmune() check, shockTimer
  // assignment via Math.max (preserves higher existing values), trapCooldown
  // 1.5, audio.shockTile() call, and a player-facing message + particles.
  const stripped = stripFullLineComments(GAME);
  const m = stripped.match(/else\s+if\s*\(\s*tile\s*===\s*T\.SHOCK_TILE\b[\s\S]*?\}\s*\n/);
  assert.ok(m, 'game.js must contain an `else if (tile===T.SHOCK_TILE …)` branch');
  const body = m[0];

  // Damage-immune frames bypass — matches PLASMA/ARC/TOXIC convention so
  // dash-through-hazard reads consistently across all hazard tiles.
  assert.match(body, /!isPlayerDamageImmune\s*\(\s*\)/,
    'SHOCK_TILE branch must gate on !isPlayerDamageImmune() (dash i-frames bypass)');

  // shockTimer assignment must use Math.max so an in-flight longer freeze
  // (e.g. SHOCKER mob proc'd a 0.8s freeze) isn't shortened to 0.5s by
  // stepping on the tile.
  assert.match(body, /player\.shockTimer\s*=\s*Math\.max\s*\(\s*player\.shockTimer\s*\|\|\s*0\s*,\s*0\.5\s*\)\s*;/,
    'SHOCK_TILE branch must set player.shockTimer = Math.max(player.shockTimer || 0, 0.5)');

  // Cooldown ≥ freeze duration (1.5 ≥ 0.5) so the player isn't re-locked
  // before the freeze ends — defends against re-entry loop griefing.
  assert.match(body, /player\.trapCooldown\s*=\s*1\.5\s*;/,
    'SHOCK_TILE branch must set player.trapCooldown = 1.5 (≥ freeze duration)');

  // SFX call.
  assert.match(body, /audio\.shockTile\s*\(\s*\)\s*;/,
    'SHOCK_TILE branch must call audio.shockTile()');

  // Player feedback — message + particles. msg(...) is the on-screen log
  // line; spawnParticles is the burst at the player position.
  assert.match(body, /this\.msg\s*\(\s*['"]Shock tile!?['"]/,
    'SHOCK_TILE branch must call this.msg("Shock tile!" …)');
  assert.match(body, /spawnParticles\s*\(\s*player\.x\s*,\s*player\.y\s*,\s*['"]SPARK['"]/,
    'SHOCK_TILE branch must spawn SPARK particles at player.x, player.y');
});

test('SHOCK_TILE freeze (0.5) does not exceed cooldown (1.5) — re-entry loop safety', () => {
  // Defence against a fat-finger swap: shockTimer = 1.5, trapCooldown = 0.5.
  // The end-anchored ;-terminated assignment is checked above; here we
  // ALSO assert numeric ordering by reading both values from the source
  // text. If freeze >= cooldown, the player is permanently locked while
  // standing on the tile.
  const stripped = stripFullLineComments(GAME);
  const m = stripped.match(/else\s+if\s*\(\s*tile\s*===\s*T\.SHOCK_TILE\b[\s\S]*?\}\s*\n/);
  assert.ok(m, 'SHOCK_TILE branch must be locatable');
  const body = m[0];
  const freezeM = body.match(/player\.shockTimer\s*=\s*Math\.max\s*\(\s*player\.shockTimer\s*\|\|\s*0\s*,\s*([\d.]+)\s*\)/);
  const cdM     = body.match(/player\.trapCooldown\s*=\s*([\d.]+)\s*;/);
  assert.ok(freezeM, 'shockTimer Math.max literal must be parseable');
  assert.ok(cdM,     'trapCooldown literal must be parseable');
  const freeze = parseFloat(freezeM[1]);
  const cd     = parseFloat(cdM[1]);
  assert.ok(cd > freeze,
    `trapCooldown (${cd}) must exceed shockTimer freeze (${freeze}) — otherwise standing on the tile permanently locks the player`);
});

test('SHOCK_TILE branch contains EXACTLY ONE write to player.shockTimer (defeats COMPUTED-BUT-NOT-APPLIED bypass)', () => {
  // codex r1 bypass: append `player.shockTimer = 0;` AFTER the Math.max line —
  // every other regex still passes (gate present, Math.max present, audio
  // call present, msg present, cooldown present) but the freeze is silently
  // zeroed in the same frame. Pin write count to exactly 1.
  //
  // Adversarial-review hardening (round 1: 3 reviewers, round 2: 1 reviewer,
  // all medium severity):
  //   - codex r1: alias/bracket — `const p = player; p.shockTimer = 0;` or
  //     `player['shockTimer'] = 0;` defeat a literal `player\.shockTimer\s*=`
  //     count. Defeat: forbid aliasing + ALL bracket access on `player`.
  //   - codex r2: laundering via reflective mutation primitives —
  //     `Object.assign`, `Object.defineProperty`, `Object.defineProperties`,
  //     `Reflect.set`, `Reflect.defineProperty` — would re-write the field
  //     without any `\.X =` token. Defeat: forbid every primitive whose
  //     args contain either field name.
  //   - codex r2: computed-key writes — `const k='shockTimer'; player[k]=0;`
  //     and template-literal keys evade literal-string bracket guards.
  //     Defeat: forbid ANY bracket access on `player` in this branch.
  //   - gpt-5.5 r1: compound assignments (`+=`, `-=`, `*=`, etc.) — would
  //     mutate the field after the Math.max but the count regex anchored
  //     on `\.shockTimer\s*=(?!=)` doesn't match `\.shockTimer\s*+=`.
  //     Defeat: forbid every compound-assignment operator on either field.
  const stripped = stripFullLineComments(GAME);
  const m = stripped.match(/else\s+if\s*\(\s*tile\s*===\s*T\.SHOCK_TILE\b[\s\S]*?\}\s*\n/);
  assert.ok(m, 'SHOCK_TILE branch must be locatable');
  const body = m[0];
  // Forbid aliasing of `player` inside the branch — closes the
  // `const p = player; p.shockTimer = 0;` laundering vector. The branch
  // never legitimately needs to rebind player.
  assert.doesNotMatch(body, /\b(?:const|let|var)\s+\w+\s*=\s*player\b/,
    'SHOCK_TILE branch must not alias `player` (e.g. `const p = player`) — defeats the property-write count guards.');
  // Forbid ANY bracket access on `player` (`player[…] = …`) inside the
  // branch — closes literal-key (`player['shockTimer']`), variable-key
  // (`const k='shockTimer'; player[k]`), AND template-literal-key
  // (``player[`shock${'Timer'}`]``) laundering vectors at once. The
  // branch never legitimately needs bracket access on player.
  assert.doesNotMatch(body, /\bplayer\s*\[/,
    'SHOCK_TILE branch must not use any bracket access on `player` (`player[…]`) — closes computed-key + template-literal laundering vectors.');
  // Forbid reflective mutation primitives that mention either field name —
  // closes the Object.assign / Object.defineProperty / Object.defineProperties
  // / Reflect.set / Reflect.defineProperty bypass class.
  for (const field of ['shockTimer', 'trapCooldown']) {
    for (const prim of [
      'Object\\.assign',
      'Object\\.defineProperty',
      'Object\\.defineProperties',
      'Reflect\\.set',
      'Reflect\\.defineProperty',
    ]) {
      const re = new RegExp(prim + '\\s*\\([^)]*' + field);
      assert.doesNotMatch(body, re,
        `SHOCK_TILE branch must not use ${prim.replace(/\\/g,'')}(…${field}…) — would launder a write past the count guard.`);
    }
  }
  // Forbid compound-assignment operators on either field. `+=`, `-=`, `*=`,
  // `/=`, `%=`, `**=`, `<<=`, `>>=`, `>>>=`, `&=`, `|=`, `^=`, `??=`, `||=`,
  // `&&=`. (gpt-5.5 finding: `player.shockTimer += -1000;` would zero the
  // freeze while the plain `\s*=` count regex saw zero writes.)
  const compoundOp = /(?:\+|-|\*\*?|\/|%|<<|>>>?|&&?|\|\|?|\^|\?\?)=/;
  const compoundShock = new RegExp('\\.shockTimer\\s*' + compoundOp.source);
  const compoundCD    = new RegExp('\\.trapCooldown\\s*' + compoundOp.source);
  assert.doesNotMatch(body, compoundShock,
    'SHOCK_TILE branch must not use a compound-assignment operator on .shockTimer (e.g. `player.shockTimer += -1000;`) — would silently neutralize the freeze.');
  assert.doesNotMatch(body, compoundCD,
    'SHOCK_TILE branch must not use a compound-assignment operator on .trapCooldown.');
  // With aliasing + bracket access + reflective mutation + compound ops
  // ruled out, dot-notation writes to .shockTimer / .trapCooldown anywhere
  // in the branch must come from the `player.` literal binding. Pin counts
  // to exactly 1.
  const writes = body.match(/\.shockTimer\s*=(?!=)/g) || [];
  assert.equal(writes.length, 1,
    `SHOCK_TILE branch must contain exactly 1 write to .shockTimer (got ${writes.length}). A second write (e.g. \`player.shockTimer = 0;\`) would silently neutralize the freeze while passing every other regex.`);
  const cdWrites = body.match(/\.trapCooldown\s*=(?!=)/g) || [];
  assert.equal(cdWrites.length, 1,
    `SHOCK_TILE branch must contain exactly 1 write to .trapCooldown (got ${cdWrites.length}).`);
});

test('SHOCK_TILE branch is not compile-time dead — exact-shape head pin', () => {
  // opus r1 bypass: a contributor wraps the branch head with `&& false`,
  // `&& 0`, `&& null`, `|| true`, `?? false`, etc. — every interior body
  // assertion still passes but the entire branch never runs.
  //
  // codex r2 over-match warning: running a generic hasDeadBranch detector
  // across the WHOLE branch body matches nested `if (… && false)` and even
  // `msg("text if (x && false)")` string literals → false positives.
  //
  // Defeat both at once: extract just the `else if (...)` condition head
  // (between the opening paren and its matching close), then pin it to
  // EXACTLY the legitimate two-clause shape:
  //   `tile === T.SHOCK_TILE && !isPlayerDamageImmune()`
  // Any extra clause (`&& false`, `&& dead`, `|| true`, `&& neverCalled()`)
  // would change the captured head string and fail the equality.
  const stripped = stripFullLineComments(GAME);
  const headStart = stripped.search(/else\s+if\s*\(\s*tile\s*===\s*T\.SHOCK_TILE\b/);
  assert.ok(headStart >= 0, 'SHOCK_TILE `else if` head must be locatable');
  // Walk from the `(` after `if` to its matching `)` with a balanced-paren
  // counter (string-literal aware would be overkill — the head doesn't
  // contain string literals legitimately).
  const parenStart = stripped.indexOf('(', headStart);
  let depth = 0, parenEnd = -1;
  for (let i = parenStart; i < stripped.length; i++) {
    if (stripped[i] === '(') depth++;
    else if (stripped[i] === ')') {
      depth--;
      if (depth === 0) { parenEnd = i; break; }
    }
  }
  assert.ok(parenEnd > parenStart, 'SHOCK_TILE head must have a balanced (...)');
  const condition = stripped.slice(parenStart + 1, parenEnd).trim();
  // Allowed-shape: exactly two clauses joined by `&&`. Whitespace inside
  // each clause is normalized away. No third clause permitted.
  assert.match(condition, /^tile\s*===\s*T\.SHOCK_TILE\s*&&\s*!\s*isPlayerDamageImmune\s*\(\s*\)\s*$/,
    `SHOCK_TILE head condition must match EXACTLY \`tile === T.SHOCK_TILE && !isPlayerDamageImmune()\` (got: \`${condition}\`). Any extra clause (e.g. \`&& false\`, \`|| true\`, \`?? null\`) would silently neutralize the entire branch.`);
});

// ─── safe-spawn exclusion ─────────────────────────────────────────────────

test('isSafeSpawn excludes T.SHOCK_TILE (player should never spawn frozen)', () => {
  // Locate isSafeSpawn helper in game.js. Same isPassable-and-not-trap
  // shape as the existing TRAP_SPIKE/TRAP_SLOW/PLASMA/ARC/TOXIC list.
  const m = GAME.match(/const\s+isSafeSpawn\s*=\s*\([\s\S]*?;/);
  assert.ok(m, 'isSafeSpawn helper must be locatable in game.js');
  assert.match(m[0], /t\s*!==\s*T\.SHOCK_TILE/,
    'isSafeSpawn must exclude T.SHOCK_TILE so the spawn-arrival tile is never a freeze');
});

// ─── floor-generator.js generation + reachability ─────────────────────────

test('floor-generator.js trap generation can place T.SHOCK_TILE alongside spike/slow', () => {
  // The trap-spawn loop now picks from a 3-way mix instead of the original
  // 70/30 spike/slow. Pin presence of all three tile types in the picker —
  // without the SHOCK_TILE branch the new tile would be unreachable in a
  // generated dungeon.
  const stripped = stripFullLineComments(FLOOR_GENERATOR);
  const m = stripped.match(/map\[ty\]\[tx\]\s*===\s*T\.FLOOR[\s\S]{0,400}T\.SHOCK_TILE/);
  assert.ok(m, 'floor-generator.js trap-gen block must be able to assign T.SHOCK_TILE');
  // All three trap tiles present in a small window — defends against a
  // contributor accidentally dropping spike or slow when adding shock.
  const tx = m[0];
  assert.match(tx, /T\.TRAP_SPIKE/, 'trap-gen still places TRAP_SPIKE');
  assert.match(tx, /T\.TRAP_SLOW/,  'trap-gen still places TRAP_SLOW');
  assert.match(tx, /T\.SHOCK_TILE/, 'trap-gen places SHOCK_TILE');
});

test('floor-generator.js dungeon-reachability `passable` predicate counts T.SHOCK_TILE as walkable', () => {
  // The reachability flood-fill (computeReach) uses a local `passable`
  // helper distinct from the runtime isPassable. SHOCK_TILE must be in
  // that list — otherwise the flood-fill could falsely conclude that a
  // SHOCK_TILE-bearing corridor is unreachable, triggering a costly
  // regen loop.
  const m = FLOOR_GENERATOR.match(/const\s+passable\s*=\s*\(\s*\/\*\*[\s\S]*?\)\s*=>[\s\S]*?T\.CHALLENGE_GATE\s*;/);
  assert.ok(m, 'computeReach `passable` helper must be locatable in floor-generator.js');
  assert.match(m[0], /t\s*===\s*T\.SHOCK_TILE/,
    'computeReach `passable` must include t === T.SHOCK_TILE');
});

// ─── render.js drawWorld switch case + minimap ────────────────────────────

test('render.js drawWorld switch contains a `case T.SHOCK_TILE:` block', () => {
  assert.match(RENDER, /case\s+T\.SHOCK_TILE\s*:/,
    'render.js drawWorld switch must contain `case T.SHOCK_TILE:`');
});

test('render.js SHOCK_TILE case actually draws something (non-empty body)', () => {
  // Defence against an empty `case T.SHOCK_TILE: break;` placeholder that
  // satisfies the presence regex above but renders nothing.
  // The case opens with `case T.SHOCK_TILE: {` and closes at a matching `}`.
  const start = RENDER.indexOf('case T.SHOCK_TILE');
  assert.ok(start >= 0, 'SHOCK_TILE case must exist');
  // Find the opening `{` after the case label
  const braceStart = RENDER.indexOf('{', start);
  assert.ok(braceStart >= 0 && braceStart - start < 60,
    'SHOCK_TILE case must open a balanced `{ ... }` block');
  const block = extractBalanced(RENDER, braceStart, '{', '}');
  assert.ok(block, 'SHOCK_TILE case block must be balanced');
  // Must paint floor base + at least one shock-coloured glyph.
  assert.match(block, /ctx\.fillRect\s*\(/,  'SHOCK_TILE case must call ctx.fillRect at least once');
  // The yellow shock tint — distinguishes it from neighbouring trap tiles.
  assert.match(block, /#ffee44|#ffffaa/,     'SHOCK_TILE case must paint with a shock-yellow colour');
  assert.match(block, /\bbreak\s*;/,         'SHOCK_TILE case must end with break;');
});

test('render.js minimap colours T.SHOCK_TILE as floor (not empty/wall)', () => {
  // Two minimap render paths exist (full minimap + corner minimap, both
  // around line 1851 and 2253). Both must include SHOCK_TILE in the
  // floor-tile disjunction so the player can see SHOCK_TILE tiles as
  // walkable on the map (not as void).
  const matches = RENDER.match(/tile\s*===\s*T\.SHOCK_TILE/g) || [];
  assert.ok(matches.length >= 2,
    `render.js minimap must reference T.SHOCK_TILE in both minimap paths (got ${matches.length})`);
});

// ─── shockTimer movement-freeze contract (already-wired primitive) ────────

test('Player.update still suppresses movement when shockTimer > 0 (existing contract preserved)', () => {
  // SHOCK_TILE sets player.shockTimer; the actual movement freeze lives in
  // entities.js Player.update. Pin that the existing
  //   `if (this.shockTimer > 0) { mx = 0; my = 0; }`
  // line is still present — without it, SHOCK_TILE silently no-ops.
  const ENTITIES = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8');
  const stripped = stripFullLineComments(ENTITIES);
  assert.match(stripped, /if\s*\(\s*this\.shockTimer\s*>\s*0\s*\)\s*\{\s*mx\s*=\s*0\s*;\s*my\s*=\s*0\s*;\s*\}/,
    'entities.js Player.update must still zero (mx, my) when shockTimer > 0 — without this, SHOCK_TILE has no visible effect');
});
