'use strict';
// WARDLING mob — source-text wiring tests.
//
// entities.js is browser-only — same source-text assertion pattern as
// echoer/prophet/cryophage. Verification covers:
//   - registry & dispatch wiring (weights, spawn switch, init, AI case)
//   - attribution (SOURCE_LABELS / SOURCE_COLOURS / CREDIT_VALUES)
//   - elite exclusion
//   - ward-finder filter logic (no chains, no shards/bosses, room-scoped)
//   - panic fallback when no ward
//   - taunt-aware via _tx/_ty
//   - draw branch (link line + halo)
//   - sw.js cache bumped

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);
const ENEMY_WARDLING = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities', 'enemy-wardling.js'), 'utf8'
);
const SPAWN_INITIALIZERS = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities', 'spawn-initializers.js'), 'utf8'
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
const SW = fs.readFileSync(
  path.resolve(__dirname, '..', 'sw.js'), 'utf8'
);

// ─── Wiring assertions ──────────────────────────────────────────────────

test('WARDLING appears in ENEMY_WEIGHTS with mid-game floor gate', () => {
  const m = ENEMY_SPAWN_TABLE.match(/WARDLING:\s*\{\s*base:\s*\d+,\s*perFloor:\s*\d+,\s*minFloor:\s*(\d+)/);
  assert.ok(m, 'WARDLING must be registered in ENEMY_WEIGHTS');
  assert.ok(parseInt(m[1], 10) >= 4, `WARDLING minFloor should be >= 4, got ${m[1]}`);
});

test('WARDLING has a stat row in ENEMY_BASE_STATS', () => {
  const re = /WARDLING:\s*\{[^\n]*hp:\s*\d+,[^\n]*atk:\s*\d+,[^\n]*spd:\s*[\d.]+,[^\n]*xpVal:\s*\d+,[^\n]*colour:\s*'/;
  assert.match(ENEMY_STATS, re);
});

test('WARDLING is fragile (low HP) — the design depends on it', () => {
  // The compositional value of WARDLING is that killing it is the easy
  // counter-play. If HP gets bumped above ~50, the bodyguard becomes
  // a tank and the niche collapses into "annoying meatshield".
  const m = ENEMY_STATS.match(/WARDLING:\s*\{\s*hp:\s*(\d+)/);
  assert.ok(m, 'WARDLING stat row must be locatable');
  const hp = parseInt(m[1], 10);
  assert.ok(hp <= 40, `WARDLING base hp must be <= 40 (fragile design), got ${hp}`);
});

test('WARDLING spawn init sets _wlWard=null and reacquireTimer=0', () => {
  // Null ward means "scan on first AI tick" — at spawn time the room may
  // still be populating. Timer at 0 forces an immediate scan.
  const re = /if\s*\(type\s*===\s*'WARDLING'\)[\s\S]{0,400}_wlWard\s*=\s*null[\s\S]{0,200}_wlReacquireTimer\s*=\s*0/;
  assert.match(SPAWN_INITIALIZERS, re, 'WARDLING init must null ward + zero reacquire timer');
});

test('WARDLING is excluded from the elite affix roll', () => {
  // Elite affixes (SHIELDED, BERSERKER) on a 25hp bodyguard either kill
  // its niche (SHIELDED tank) or trivialise it (BERSERKER → suicide
  // chase). Mirrors PROPHET/CRYOPHAGE/etc.
  assert.match(ENEMY_CLASSIFICATION, /ELITE_EXCLUDED_TYPES[\s\S]*'WARDLING'[\s\S]*\]\s*\)/,
    'WARDLING must be in the elite-exclusion guard');
});

test('WARDLING is dispatched in the AI switch', () => {
  assert.match(ENTITIES, /case\s+'WARDLING':\s*this\.aiWardling\(/);
});

test('aiWardling method is defined', () => {
  assert.match(ENTITIES, /aiWardling\s*\(\s*dt\s*,\s*player\s*,\s*map\s*,\s*d\s*,\s*los\s*\)\s*\{/);
});

// ─── Ward-finder invariants (compositional safety) ──────────────────────

test('_wlFindWard excludes other WARDLINGs (no infinite chains)', () => {
  // If WARDLING could ward another WARDLING, you'd get long chains and
  // the player might never reach the actual threat. Hard exclusion.
  const re = /_wlFindWard[\s\S]{0,800}e\.type\s*===\s*'WARDLING'/;
  assert.match(ENEMY_WARDLING, re, '_wlFindWard must reject WARDLING-type wards');
});

test('_wlFindWard excludes bosses and shards', () => {
  // Bosses have their own kit/spawns — a WARDLING shouldn't bond to a
  // boss (visual clutter + boss already has phases). Shards are short-
  // lived (SPLITTER children) and would constantly re-trigger ward
  // re-acquisition.
  const re = /_wlFindWard[\s\S]{0,800}e\.isShard\s*\|\|\s*e\.isBoss/;
  assert.match(ENEMY_WARDLING, re, '_wlFindWard must skip shards and bosses');
});

test('_wlFindWard is room-scoped', () => {
  // A WARDLING bonding to an enemy in a different room would walk
  // through walls (or get stuck) and ruin the local-priority puzzle.
  const re = /_wlFindWard[\s\S]{0,800}e\.room\s*!==\s*this\.room/;
  assert.match(ENEMY_WARDLING, re, '_wlFindWard must be room-scoped');
});

// ─── Behaviour invariants ───────────────────────────────────────────────

test('WARDLING enters PANIC speed multiplier when no ward exists', () => {
  // Without a ward, WARDLING must still be a threat (otherwise solo
  // spawns are free XP). Panic uses WARDLING_PANIC_MUL on speed and
  // chases the canonical _tx/_ty target.
  const re = /aiWardling[\s\S]{0,2500}WARDLING_PANIC_MUL/;
  assert.match(ENTITIES, re, 'aiWardling must reference WARDLING_PANIC_MUL in panic branch');
});

test('WARDLING positions itself between TARGET (_tx/_ty) and ward', () => {
  // The interception point uses _tx/_ty (taunt-aware) NOT player.x/y.
  // This is the lesson from ECHOER PR — any mob that samples player
  // outside _tx/_ty fails the hologram-decoy contract.
  const block = ENTITIES.match(/aiWardling\s*\(\s*dt[\s\S]{0,4000}this\.meleeAttack\s*\(\s*player\s*\)/);
  assert.ok(block, 'aiWardling block must be locatable');
  // Must compute interception relative to _tx/_ty:
  assert.match(block[0], /this\._tx\s*-\s*ward\.x/, 'interception vector must use this._tx (taunt-aware), not player.x');
  assert.match(block[0], /this\._ty\s*-\s*ward\.y/, 'interception vector must use this._ty (taunt-aware), not player.y');
});

test('WARDLING handles player-on-ward degenerate case (vector mag ~ 0)', () => {
  // If _tx==ward.x and _ty==ward.y the unit vector is undefined. Code
  // must guard with a near-zero magnitude check or it produces NaN
  // positions.
  const block = ENTITIES.match(/aiWardling\s*\(\s*dt[\s\S]{0,4000}this\.meleeAttack\s*\(\s*player\s*\)/);
  assert.ok(block, 'aiWardling block must be locatable');
  // pmag guard with a small epsilon
  assert.match(block[0], /pmag\s*<\s*0\.\d+/, 'aiWardling must guard against zero-magnitude pdx,pdy (player-on-ward)');
});

test('WARDLING calls meleeAttack on body contact (atk would otherwise be decorative)', () => {
  // Caught by gpt-5.5 review: WARDLING has atk=4 wired through SOURCE_*
  // tables but never called meleeAttack(player). Without it, the
  // bodyguard deals zero contact damage — the player can sponge through
  // it and the atk field is dead code. Standard pattern is `if (d < 1.2)
  // this.meleeAttack(player);` in BOTH the panic branch (chasing the
  // player) and the guarding branch (player runs INTO the bodyguard
  // mid-flank). meleeAttack itself is taunt-aware (real-player distance
  // check inside), so hologram bait still defuses the contact.
  const block = ENTITIES.match(/aiWardling\s*\(\s*dt[\s\S]{0,4000}this\.meleeAttack\s*\(\s*player\s*\)/);
  assert.ok(block, 'aiWardling block must be locatable');
  // Count meleeAttack calls — must be at least 2 (panic + guarding paths).
  const meleeCalls = (block[0].match(/this\.meleeAttack\s*\(\s*player\s*\)/g) || []).length;
  assert.ok(meleeCalls >= 2, `aiWardling must call meleeAttack(player) in BOTH panic and guarding branches, found ${meleeCalls}`);
});

test('WARDLING re-acquisition timer is NOT bypassed when ward is null (perf guard)', () => {
  // Caught by claude-opus-4.6 review: an initial draft used
  // `!this._wlWard || this._wlWard.dead || this._wlReacquireTimer <= 0`
  // which short-circuited past the timer in solo/orphan rooms — every
  // frame scan instead of every 0.5s. Defeats the WARDLING_REWARD_PERIOD
  // throttle the comment promises. Fix: timer ALWAYS gates the scan;
  // only an alive ward dying triggers an extra immediate scan.
  // The pattern we MUST NOT have: starting the predicate with `!this._wlWard ||`
  const block = ENTITIES.match(/aiWardling\s*\(\s*dt[\s\S]{0,4000}this\.meleeAttack\s*\(\s*player\s*\)/);
  assert.ok(block, 'aiWardling block must be locatable');
  // Negative assertion: a re-acquire `if` whose condition starts with
  // `!this._wlWard ||` would defeat the timer — flag any such pattern.
  const badPattern = /if\s*\(\s*!this\._wlWard\s*\|\|/;
  assert.ok(!badPattern.test(block[0]),
    'aiWardling re-acquire condition MUST NOT short-circuit on !this._wlWard (defeats WARDLING_REWARD_PERIOD throttle in solo rooms)');
  // Positive assertion: the condition must lead with the timer gate.
  assert.match(block[0], /if\s*\(\s*this\._wlReacquireTimer\s*<=\s*0/,
    'aiWardling re-acquire condition must start with _wlReacquireTimer <= 0 (timer always gates the scan)');
});

// ─── Attribution (death-recap readability) ──────────────────────────────

test('WARDLING attribution rows present', () => {
  assert.match(SOURCE_METADATA, /SOURCE_LABELS[\s\S]{0,2000}WARDLING\s*:\s*'Wardling'/);
  assert.match(SOURCE_METADATA, /SOURCE_COLOURS[\s\S]{0,2000}WARDLING\s*:\s*'#[0-9a-f]{6}'/i);
  assert.match(SOURCE_METADATA, /CREDIT_VALUES\s*=\s*\{[^}]*WARDLING\s*:\s*\d+/);
});

test('WARDLING draw branch renders a link line to ward when bonded', () => {
  // The link line is the diegetic tell — without it the player can't
  // visually identify which mob is being protected and target priority
  // becomes guesswork.
  const re = /this\.type\s*===\s*'WARDLING'[\s\S]{0,1500}NEON\.draw\.line\(/;
  assert.match(ENTITIES, re, 'WARDLING draw branch must render a link line via NEON.draw.line');
});

// ─── Service worker cache freshness ─────────────────────────────────────

test('sw.js cache freshness is not a numeric cache version', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /cacheFromNetwork\(e\)/);
});
