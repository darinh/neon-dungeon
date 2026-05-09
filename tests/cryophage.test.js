'use strict';
// CRYOPHAGE mob — source-text wiring tests.
//
// entities.js is browser-only (no UMD/CommonJS exports), so we follow
// the same pattern as echoer/prophet/ghost-projector tests: assert
// structural invariants the mob needs by regex-matching the source
// text. Verification covers:
//   - registry & dispatch wiring (weights, spawn switch, init, AI case)
//   - attribution (SOURCE_LABELS / SOURCE_COLOURS / CREDIT_VALUES)
//   - elite exclusion
//   - stun cancel parity with PROPHET/ECHOER
//   - draw branch + tile-aligned lattice
//   - frostPatches global lifecycle (declared, cleared on floor transition,
//     wired into update + draw loops in game.js)
//   - sw.js cache bumped (so deployed clients get the new code)

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readSourceFile } = require('./_source-files.js');

const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);
const SPAWN_INITIALIZERS = readSourceFile(__dirname, 'entitiesSpawnInitializers');
const SOURCE_METADATA = readSourceFile(__dirname, 'entitiesSourceMetadata');
const ENEMY_SPAWN_TABLE = readSourceFile(__dirname, 'entitiesSpawnTable');
const ENEMY_STATS = readSourceFile(__dirname, 'entitiesEnemyStats');
const ENEMY_CLASSIFICATION = readSourceFile(__dirname, 'entitiesEnemyClassification');
const FIELD_EFFECTS = readSourceFile(__dirname, 'entitiesFieldEffects');
const GAME = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8'
);
const SW = fs.readFileSync(
  path.resolve(__dirname, '..', 'sw.js'), 'utf8'
);

// ─── Wiring assertions ──────────────────────────────────────────────────

test('CRYOPHAGE appears in ENEMY_WEIGHTS with mid-late floor gate', () => {
  // Without a weights entry, the mob can never roll out of pickEnemyType.
  // Per design (frost-patch area denial), CRYOPHAGE is mid-late game
  // pressure — minFloor must be >= 5.
  const m = ENEMY_SPAWN_TABLE.match(/CRYOPHAGE:\s*\{\s*base:\s*\d+,\s*perFloor:\s*\d+,\s*minFloor:\s*(\d+)/);
  assert.ok(m, 'CRYOPHAGE must be registered in ENEMY_WEIGHTS');
  assert.ok(parseInt(m[1], 10) >= 5, `CRYOPHAGE minFloor should be >= 5, got ${m[1]}`);
});

test('CRYOPHAGE has a stat row in ENEMY_BASE_STATS', () => {
  // Missing case → spawnEnemy returns an Enemy with hp=0, instantly dead.
  const re = /CRYOPHAGE:\s*\{[^\n]*hp:\s*\d+,[^\n]*atk:\s*\d+,[^\n]*spd:\s*[\d.]+,[^\n]*xpVal:\s*\d+,[^\n]*colour:\s*'/;
  assert.match(ENEMY_STATS, re);
});

test('CRYOPHAGE spawn init block sets state + cooldown stagger', () => {
  // _cyState must start 'idle', _cyCooldown must be > 0 so a fresh
  // squadron of cryophages doesn't telegraph in unison the moment they
  // spawn.
  const re = /if\s*\(type\s*===\s*'CRYOPHAGE'\)[\s\S]{0,500}_cyState\s*=\s*'idle'[\s\S]{0,400}_cyCooldown\s*=/;
  assert.match(SPAWN_INITIALIZERS, re, 'CRYOPHAGE init must set _cyState=idle and _cyCooldown stagger');
});

test('CRYOPHAGE is excluded from the elite affix roll', () => {
  // Elite affixes interact poorly with the area-denial mechanic — we
  // keep CRYOPHAGE vanilla. Mirrors the ECHOER/PROPHET/GHOST_PROJECTOR
  // exclusions.
  assert.match(ENEMY_CLASSIFICATION, /ELITE_EXCLUDED_TYPES[\s\S]*'CRYOPHAGE'[\s\S]*\]\s*\)/,
    'CRYOPHAGE must be in the elite-exclusion guard');
});

test('CRYOPHAGE is dispatched in the AI switch', () => {
  assert.match(ENTITIES, /case\s+'CRYOPHAGE':\s*this\.aiCryophage\(/);
});

test('aiCryophage method is defined', () => {
  assert.match(ENTITIES, /aiCryophage\s*\(\s*dt\s*,\s*player\s*,\s*map\s*,\s*d\s*,\s*los\s*\)\s*\{/);
});

test('CRYOPHAGE stun cancel path resets aiming', () => {
  // Stun must cancel the aim window — otherwise patches commit after
  // stun ends and the player cannot punish the stun. Mirrors PROPHET.
  const re = /_cyState\s*===\s*'aiming'[\s\S]{0,200}_cyState\s*=\s*'idle'[\s\S]{0,200}_cyCooldown\s*=/;
  assert.match(ENTITIES, re, 'stun handler must reset _cyState to idle');
});

test('CRYOPHAGE draw branch renders a tile-aligned lattice telegraph', () => {
  // The draw branch must render warning markers at the locked tile and
  // the 4 cardinal neighbours (5 tiles total). Without this, the player
  // has no warning before patches commit.
  // We assert the draw branch references _cyState aiming and emits at
  // least one fillRect/strokeRect call (the tile glyph).
  const re = /this\.type\s*===\s*'CRYOPHAGE'[\s\S]{0,1800}_cyState\s*===\s*'aiming'[\s\S]{0,1500}(fillRect|strokeRect)/;
  assert.match(ENTITIES, re, 'CRYOPHAGE draw branch must render rect tiles during aiming');
});

test('CRYOPHAGE telegraph commits on a 5-tile + lattice', () => {
  // The lock-time candidate list must be exactly 5 tiles (centre + 4
  // cardinals). Filtering happens per-tile (bounds + isPassable) so the
  // ACTUAL committed count is <=5, but the candidate set is fixed. A
  // change here is gameplay-significant (changes the area-denial footprint).
  // Boundary uses the AI section header (durable to method insertions
  // between aiCryophage and aiResonator).
  const block = ENTITIES.match(/aiCryophage[\s\S]{0,5500}\/\/\s*─+\s*(WARDLING|RESONATOR) AI/);
  assert.ok(block, 'aiCryophage method block must be locatable');
  const candidatesMatch = block[0].match(/const\s+candidates\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(candidatesMatch, 'aiCryophage lock must build a candidates array');
  const entries = (candidatesMatch[1].match(/\{\s*x\s*:/g) || []).length;
  assert.equal(entries, 5, `CRYOPHAGE lattice must be exactly 5 candidate tiles (centre + 4 cardinals), got ${entries}`);
});

test('CRYOPHAGE filters lattice tiles at LOCK time, not commit time (parity guard)', () => {
  // The same filtered tile list must be consumed by both the draw branch
  // (telegraph glyphs) and the commit block (patch spawn) so the player
  // never sees a warning glyph on a tile that won't actually freeze.
  // Bug class caught simultaneously by codex + opus on initial review:
  // commit had isPassable filter, draw rendered all 5 unconditionally.
  // Fix: pre-filter into _cyTiles at lock time, both consumers read it.
  // Also guards against OOB tiles bypassing the passability check.
  const aiBlock = ENTITIES.match(/aiCryophage[\s\S]{0,5500}\/\/\s*─+\s*(WARDLING|RESONATOR) AI/);
  assert.ok(aiBlock, 'aiCryophage block must be locatable');
  // Lock branch must populate _cyTiles
  assert.match(aiBlock[0], /this\._cyTiles\s*=\s*tiles/, 'lock must store filtered tiles in _cyTiles');
  // Commit branch must consume _cyTiles (NOT recompute centre+cardinals)
  assert.match(aiBlock[0], /this\._cyTiles\s*\|\|\s*\[\]/, 'commit must consume _cyTiles');
  // Lock branch must apply BOTH bounds AND passability checks
  assert.match(aiBlock[0], /ty\s*<\s*0\s*\|\|\s*tx\s*<\s*0/, 'bounds check (ty<0 || tx<0) required at lock filter');
  assert.match(aiBlock[0], /isPassable\(map\[ty\]\[tx\]\)/, 'passability check required at lock filter');
  // Draw branch must consume the same _cyTiles (no inline tiles literal)
  const drawBlock = ENTITIES.match(/this\.type\s*===\s*'CRYOPHAGE'[\s\S]{0,2200}ctx\.restore\(\);\s*\n\s*\}/);
  assert.ok(drawBlock, 'CRYOPHAGE draw block must be locatable');
  assert.match(drawBlock[0], /this\._cyTiles\s*\|\|\s*\[\]/, 'draw branch must consume _cyTiles (not rebuild lattice)');
});

test('CRYOPHAGE patches use the canonical dash-immune damage path', () => {
  // updateFrostPatches must guard with !isPlayerDamageImmune() so dash
  // i-frames pass through (canonical counter-play). Without this guard,
  // the patches would damage the player even mid-dash, breaking the
  // contract every other area-denial source honours (DISRUPTOR fields,
  // toxic pools, etc.).
  const re = /function\s+updateFrostPatches[\s\S]{0,800}!isPlayerDamageImmune\(\)/;
  assert.match(FIELD_EFFECTS, re, 'updateFrostPatches must check isPlayerDamageImmune');
});

test('frost patches are attributed via SOURCE_LABELS + SOURCE_COLOURS', () => {
  // Death-recap and damage-log readability: any new damage source string
  // ('Frost Patch') must appear in both lookup tables. Pattern caught by
  // reviewers on every prior mob PR (PROPHET / MIRROR / ECHOER).
  assert.match(SOURCE_METADATA, /SOURCE_LABELS[\s\S]{0,2000}'Frost Patch'\s*:/);
  assert.match(SOURCE_METADATA, /SOURCE_COLOURS[\s\S]{0,2000}'Frost Patch'\s*:/);
});

test('CRYOPHAGE has a CREDIT_VALUES entry', () => {
  // Without a CREDIT_VALUES entry, killing the mob awards 0 credits —
  // a silent regression that's only visible in the gap-shop economy.
  assert.match(SOURCE_METADATA, /CREDIT_VALUES\s*=\s*\{[^}]*CRYOPHAGE\s*:\s*\d+/);
});

// ─── Global frostPatches lifecycle ──────────────────────────────────────

test('frostPatches global array is declared at module scope', () => {
  // Must be a top-level mutable array so aiCryophage can push commits
  // and updateFrostPatches/drawFrostPatches can iterate.
  assert.match(FIELD_EFFECTS, /const\s+frostPatches\s*=\s*\[\]/);
});

test('drawFrostPatches FOV-culls per patch', () => {
  // Same convention as drawGravityWells — patches outside player vision
  // shouldn't render. They still tick if entered (deliberate, mirrors
  // updateGravityWells), but the player never sees the warning glyph
  // for an out-of-vision patch — so visible-only render keeps things
  // consistent with the rest of the FOV pipeline.
  const re = /function\s+drawFrostPatches[\s\S]{0,500}_EG\.dungeon\?\.visible/;
  assert.match(FIELD_EFFECTS, re, 'drawFrostPatches must FOV-cull via dungeon.visible');
});

test('game.js wires updateFrostPatches into the per-frame update loop', () => {
  // Without this call the patches never tick — they spawn and never
  // damage anyone, which would make CRYOPHAGE harmless.
  assert.match(GAME, /updateFrostPatches\(dt,\s*player\)/);
});

test('game.js wires drawFrostPatches into the per-frame draw loop', () => {
  // Without this call the patches are invisible — same severity as
  // missing the warning telegraph.
  assert.match(GAME, /drawFrostPatches\(cam\.x,\s*cam\.y\)/);
});

test('game.js loadFloor clears frostPatches on floor transition', () => {
  // Cross-floor leak: a patch placed by a CRYOPHAGE on floor N would
  // persist into floor N+1's coordinate space — invisible damage at
  // unrelated tiles. Same class of bug as the _posHistory / _shotHistory
  // resets immediately above.
  assert.match(GAME, /frostPatches\.length\s*=\s*0/);
});

// ─── Service worker cache freshness ─────────────────────────────────────

test('sw.js freshness does not depend on a numeric cache version', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /cacheFromNetwork\(e\)/);
});
