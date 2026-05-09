'use strict';
// GHOST_PROJECTOR mob — source-text wiring tests + behavioural unit tests.
//
// GHOST_PROJECTOR is a stationary "lens" mob (floor 8+) that listens for
// ghostable kills in its room via notifyGhostProjectors() (called from
// Enemy.die). On a claimed kill it arms a 3.0s pending haunt; on completion
// it spawns a translucent ghost replay at the kill site with reduced HP/atk.
// Per-projector single-projection: while a memory is pending OR an active
// ghost is alive, further kills are ignored. Ghosts award no XP/credits/
// drops/combo, expire after 6s via _despawning, and never recurse (the
// kill hook excludes _ghIsGhost).
//
// entities.js is browser-only (no UMD/CommonJS exports), so we follow the
// same regex / node:vm pattern as mirror.test.js / reaper.test.js.

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
const SOURCE_METADATA = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities', 'source-metadata.js'), 'utf8'
);
const ENTITY_DEATH_HOOKS = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities', 'death-hooks.js'), 'utf8'
);
const SW = fs.readFileSync(
  path.resolve(__dirname, '..', 'sw.js'), 'utf8'
);

// ─── Wiring assertions ──────────────────────────────────────────────────

test('GHOST_PROJECTOR appears in ENEMY_WEIGHTS with floor 8+ gate', () => {
  // Per design (deep-floor, novel mechanic), minFloor must be >= 8.
  const m = ENEMY_SPAWN_TABLE.match(/GHOST_PROJECTOR:\s*\{\s*base:\s*\d+,\s*perFloor:\s*\d+,\s*minFloor:\s*(\d+)/);
  assert.ok(m, 'GHOST_PROJECTOR must be registered in ENEMY_WEIGHTS');
  assert.ok(parseInt(m[1], 10) >= 8, `GHOST_PROJECTOR minFloor should be >= 8, got ${m[1]}`);
});

test('GHOST_PROJECTOR has stat row — stationary, no native attack', () => {
  // Missing case → spawnEnemy returns Enemy with hp=0, instantly dead.
  // The projector is intentionally stationary (spd=0) and dealing no
  // direct damage (atk=0); its threat is the haunt, not melee.
  const m = ENTITIES.match(/case\s+'GHOST_PROJECTOR':[^\n]*hp\s*=\s*(\d+)[^\n]*atk\s*=\s*(\d+)[^\n]*spd\s*=\s*([\d.]+)[^\n]*xpVal\s*=\s*(\d+)/);
  assert.ok(m, 'GHOST_PROJECTOR stat row missing');
  assert.equal(parseFloat(m[3]), 0, 'GHOST_PROJECTOR must be stationary (spd=0)');
  assert.equal(parseInt(m[2], 10), 0, 'GHOST_PROJECTOR must not deal direct atk');
  assert.ok(parseInt(m[1], 10) >= 30, 'GHOST_PROJECTOR HP feels too low');
});

test('GHOST_PROJECTOR spawn init block sets pending-memory state', () => {
  // _gpPendingType must start null and _gpActiveGhost must start null
  // so the first kill in the room can claim a memory cleanly.
  const re = /if\s*\(type\s*===\s*'GHOST_PROJECTOR'\)[\s\S]{0,800}_gpPendingType\s*=\s*null[\s\S]{0,400}_gpActiveGhost\s*=\s*null/;
  assert.match(ENTITIES, re, 'GHOST_PROJECTOR init must zero _gpPendingType and _gpActiveGhost');
});

test('GHOST_PROJECTOR is excluded from the elite affix roll', () => {
  // The haunt mechanic doesn't compose well with affix HP/regen scaling on
  // the projector itself (the projector should be soft so the player can
  // pre-empt), and we never want elite ghosts. Mirrors REAPER/MIRROR
  // exclusions.
  const re = /allowElite[\s\S]{0,800}type\s*!==\s*'GHOST_PROJECTOR'/;
  assert.match(ENTITIES, re, 'GHOST_PROJECTOR must be in the elite-exclusion guard');
});

test('GHOST_PROJECTOR is dispatched in the AI switch', () => {
  assert.match(ENTITIES, /case\s+'GHOST_PROJECTOR':\s*this\.aiGhostProjector\(/);
});

test('aiGhostProjector method is defined', () => {
  assert.match(ENTITIES, /aiGhostProjector\s*\(\s*dt\s*,\s*player\s*,\s*map\s*,\s*d\s*,\s*los\s*\)\s*\{/);
});

test('GHOST_PROJECTOR tuning constants are present and reasonable', () => {
  const delay = ENTITIES.match(/GHOST_PROJECTOR_DELAY\s*=\s*([\d.]+)/);
  const life  = ENTITIES.match(/GHOST_PROJECTOR_GHOST_LIFE\s*=\s*([\d.]+)/);
  const hpMul = ENTITIES.match(/GHOST_PROJECTOR_HP_MUL\s*=\s*([\d.]+)/);
  const atkMul = ENTITIES.match(/GHOST_PROJECTOR_ATK_MUL\s*=\s*([\d.]+)/);
  assert.ok(delay && parseFloat(delay[1]) >= 1.5 && parseFloat(delay[1]) <= 5,
    `GHOST_PROJECTOR_DELAY should be 1.5–5s, got ${delay && delay[1]}`);
  assert.ok(life && parseFloat(life[1]) >= 3 && parseFloat(life[1]) <= 12,
    `GHOST_PROJECTOR_GHOST_LIFE should be 3–12s, got ${life && life[1]}`);
  assert.ok(hpMul && parseFloat(hpMul[1]) > 0 && parseFloat(hpMul[1]) <= 1,
    'GHOST_PROJECTOR_HP_MUL must be in (0,1]');
  assert.ok(atkMul && parseFloat(atkMul[1]) > 0 && parseFloat(atkMul[1]) <= 1,
    'GHOST_PROJECTOR_ATK_MUL must be in (0,1]');
});

test('GHOSTABLE_TYPES is a tight allowlist of simple-AI mobs', () => {
  // The set must explicitly include the listed types and EXCLUDE bosses,
  // summoners, mimics, and stationary battery mobs (their AI doesn't
  // replay cleanly without spawn-init quirks).
  const m = ENTITIES.match(/GHOSTABLE_TYPES\s*=\s*new\s+Set\(\s*\[([\s\S]*?)\]\s*\)/);
  assert.ok(m, 'GHOSTABLE_TYPES must be defined as new Set([...])');
  const body = m[1];
  // Must include simple chasers
  for (const t of ['GUARD', 'CRAWLER', 'BRUTE', 'CHARGER', 'LEAPER', 'SEEKER']) {
    assert.match(body, new RegExp(`'${t}'`), `GHOSTABLE_TYPES must include ${t}`);
  }
  // Must NOT include stationary batteries / complex spawn-init mobs
  for (const t of ['MIRROR', 'RESONATOR', 'TURRET', 'TUNNELLER', 'WRAITH',
                    'SUMMONER', 'MIMIC', 'TELEPORTER', 'NEXUS',
                    'GHOST_PROJECTOR',
                    'SENTINEL', 'WARDEN', 'HIVE', 'CONDUCTOR', 'OMEGA', 'GENESIS']) {
    assert.doesNotMatch(body, new RegExp(`'${t}'`), `GHOSTABLE_TYPES must NOT include ${t}`);
  }
});

test('notifyGhostProjectors function exists and gates on _ghIsGhost', () => {
  // Anti-recursion: a ghost dying must not spawn another ghost. The hook
  // must explicitly exclude _ghIsGhost early.
  const m = ENTITY_DEATH_HOOKS.match(/function\s+notifyGhostProjectors\s*\(deadEnemy\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(m, 'notifyGhostProjectors must be defined');
  const body = m[1];
  assert.match(body, /deadEnemy\._ghIsGhost/, 'must check _ghIsGhost');
  assert.match(body, /deadEnemy\.isShard/, 'must exclude shards');
  assert.match(body, /deadEnemy\._summoned/, 'must exclude summons');
  assert.match(body, /deadEnemy\.isBoss/, 'must exclude bosses');
  assert.match(body, /GHOSTABLE_TYPES\.has/, 'must gate on GHOSTABLE_TYPES allowlist');
});

test('Enemy.die() calls notifyGhostProjectors after unregisterEnemyFromRoom', () => {
  // Order matters: the dead enemy must be removed from enemiesByRoom
  // before the hook iterates the room set, otherwise the dead enemy
  // could (in some future iteration variants) appear in the loop.
  const re = /unregisterEnemyFromRoom\(this\)[\s\S]{0,400}notifyGhostProjectors\(this\)/;
  assert.match(ENTITIES, re, 'die() must call notifyGhostProjectors after unregisterEnemyFromRoom');
});

test('notifyGhostProjectors only claims the FIRST eligible projector', () => {
  // Two projectors in the same room must NOT both claim a single kill —
  // the first one wins and we early-return. Without this rule, a kill
  // streak in a 2-projector room would double-haunt.
  const m = ENTITY_DEATH_HOOKS.match(/function\s+notifyGhostProjectors\s*\(deadEnemy\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(m);
  const body = m[1];
  assert.match(body, /for\s*\(const\s+proj\s+of\s+inRoom\)[\s\S]*?return/,
    'loop must early-return on first claim');
});

test('notifyGhostProjectors skips projectors with pending or active ghost', () => {
  // Per-projector single-projection: don't claim if a memory is already
  // pending OR if the ghost has been queued and is awaiting flush back-
  // assign OR if the active ghost is still alive.
  const m = ENTITY_DEATH_HOOKS.match(/function\s+notifyGhostProjectors\s*\(deadEnemy\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(m);
  const body = m[1];
  assert.match(body, /proj\._gpPendingType[\s\S]{0,80}continue/,
    'pending-memory projector must be skipped');
  assert.match(body, /proj\._gpAwaitingFlush[\s\S]{0,80}continue/,
    'projector awaiting flush back-assign must be skipped (closes same-frame race window)');
  assert.match(body, /proj\._gpActiveGhost[\s\S]{0,120}continue/,
    'projector with live ghost must be skipped');
});

test('GHOST_PROJECTOR pending haunt cancels on stun', () => {
  // Stun must drop _gpPendingType so the projector is "defused" — mirrors
  // REAPER/RESONATOR/MIRROR stun semantics. Without this rule, EMP'ing
  // the projector during the 3s window would still spawn the ghost.
  const re = /this\.type\s*===\s*'GHOST_PROJECTOR'[\s\S]{0,200}_gpPendingType\s*=\s*null/;
  assert.match(ENTITIES, re, 'stun handler must clear _gpPendingType');
});

test('spawnGhost helper queues via pendingEnemySpawns (deferred — never appends to enemies[] mid-loop)', () => {
  // The for-of loop over enemies in game.js visits elements appended
  // during iteration, so a ghost pushed directly to enemies[] would get
  // update() in the same frame it spawned (caught by gpt-5.5 review).
  // Use the established deferred-spawn pattern instead.
  const m = ENTITIES.match(/function\s+spawnGhost\s*\([\s\S]*?\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(m, 'spawnGhost must be defined');
  const body = m[1];
  assert.match(body, /pendingEnemySpawns\.push\(/, 'spawnGhost must defer via pendingEnemySpawns');
  assert.doesNotMatch(body, /enemies\.push\(/, 'spawnGhost must NOT push directly to enemies[] (race with update loop)');
  assert.match(body, /_ghIsGhost\s*:\s*true/, 'pending entry must carry _ghIsGhost marker');
  assert.match(body, /_ghOwnerProjector\s*:\s*projector/, 'pending entry must carry projector ref for back-assignment');
  assert.match(body, /GHOSTABLE_TYPES\.has\(type\)/, 'must validate type against allowlist');
});

test('PACIFIST quest counter does NOT increment on ghost kills', () => {
  // Without this gate, every ghost the projector spawns would force the
  // player to choose between dodging it for ~6s or breaking PACIFIST.
  // Caught by gpt-5.5 review (kill suppression applies to enemiesKilled
  // and killsInCurrentRoom but quest.kills was unconditional).
  const re = /_EG\.quest\.kills\s*!==\s*undefined\s*&&\s*!this\._ghIsGhost\)\s*_EG\.quest\.kills\+\+/;
  assert.match(ENTITIES, re, 'quest.kills increment must skip ghosts');
});

test('Ghost lifetime tick fires before the stun branch in update()', () => {
  // The lifetime decrement must NOT be gated by stun — a stunned ghost
  // should still expire on schedule. Position the tick before the stun
  // branch and use _despawning to short-circuit die() rewards.
  const slice = ENTITIES.match(/update\(dt,\s*player,\s*map\)\s*\{([\s\S]*?)if\s*\(this\.stunTimer\s*>\s*0\)/);
  assert.ok(slice, 'update() prelude region must exist');
  assert.match(slice[1], /this\._ghIsGhost[\s\S]{0,300}this\._ghLife[\s\S]{0,80}-\s*dt/,
    'ghost lifetime tick must run before the stun branch');
  assert.match(slice[1], /_despawning\s*=\s*true[\s\S]{0,80}this\.die\(\)/,
    'expired ghosts must use the _despawning silent-death path');
});

test('Ghosts are treated as summons for rewards (no drops/credits/XP/combo)', () => {
  // The isSummon local in die() must include _ghIsGhost so ghost kills
  // skip drops/credits/combo/kill-counter — same rules summons follow.
  const re = /const\s+isSummon\s*=\s*!!this\._summoned\s*\|\|\s*!!this\._ghIsGhost/;
  assert.match(ENTITIES, re, 'isSummon must OR _ghIsGhost so ghost kills suppress rewards');
});

test('Ghost draw multiplies alpha so ghosts render translucent', () => {
  // The translucency tell is what lets the player read "this is a ghost"
  // at a glance. Must MULTIPLY into the existing per-type alpha system
  // (not overwrite) so PHANTOM-class ghostable types stay correct if
  // GHOSTABLE_TYPES is later widened.
  assert.match(ENTITIES, /this\._ghIsGhost[\s\S]{0,80}alpha\s*\*=/,
    'draw() must multiply alpha when _ghIsGhost is set');
});

test('GHOST_PROJECTOR has CREDIT_VALUES, SOURCE_LABELS, SOURCE_COLOURS entries', () => {
  // Without the SOURCE_LABELS/COLOURS entries the death recap shows
  // generic 'Ghost Projector' with grey colour — mirrors mob-design
  // checklist enforced by every prior mob PR.
  assert.match(SOURCE_METADATA, /GHOST_PROJECTOR\s*:\s*\d+/,
    'CREDIT_VALUES must include GHOST_PROJECTOR');
  assert.match(SOURCE_METADATA, /GHOST_PROJECTOR\s*:\s*'Ghost Projector'/,
    'SOURCE_LABELS must include GHOST_PROJECTOR');
  // Colour entry: any hex string (the projector's colour is violet ~#cc99ff)
  assert.match(SOURCE_METADATA, /GHOST_PROJECTOR\s*:\s*'#[0-9a-fA-F]{6}'/,
    'SOURCE_COLOURS must include GHOST_PROJECTOR with a hex colour');
});

// ─── Service worker cache freshness ─────────────────────────────────────

test('sw.js uses network-first freshness instead of a numeric cache version', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /const\s+CACHE\s*=\s*'neon-dungeon-assets'/);
  assert.match(SW, /cacheFromNetwork\(e\)\.catch\(\(\) => caches\.match\(e\.request\)\)/);
});

// ─── game.js deferred-spawn flush wiring ────────────────────────────────

test('game.js pendingEnemySpawns flush handles ghost mutations + back-assigns to projector', () => {
  // The flush is the ONLY place that materialises ghosts (spawnGhost just
  // queues). Without the mutation block, ghosts have full HP/atk/XP. Without
  // the back-assign, the projector never knows its ghost spawned and the
  // _gpActiveGhost slot stays null forever (busy-skip never triggers
  // → unlimited concurrent ghosts).
  const GAME = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8');
  const slice = GAME.match(/pendingEnemySpawns\.length[\s\S]*?pendingEnemySpawns\.length\s*=\s*0/);
  assert.ok(slice, 'pendingEnemySpawns flush block must exist in game.js');
  const body = slice[0];
  assert.match(body, /s\._ghIsGhost[\s\S]{0,120}continue/,
    'orphan ghosts (projector dead this frame) must be skipped');
  assert.match(body, /s\._ghIsGhost[\s\S]{0,400}e\._ghIsGhost\s*=\s*true/,
    'ghost mutation block must run when s._ghIsGhost');
  assert.match(body, /e\._ghLife\s*=\s*GHOST_PROJECTOR_GHOST_LIFE/,
    'ghost lifetime must be set in flush');
  assert.match(body, /e\.hp[\s\S]{0,120}GHOST_PROJECTOR_HP_MUL/,
    'ghost HP must be scaled in flush');
  assert.match(body, /e\.atk[\s\S]{0,120}GHOST_PROJECTOR_ATK_MUL/,
    'ghost atk must be scaled in flush');
  assert.match(body, /proj\._gpActiveGhost\s*=\s*e/,
    'flush must back-assign live ref to projector._gpActiveGhost');
  assert.match(body, /proj\._gpAwaitingFlush\s*=\s*false/,
    'flush must clear _gpAwaitingFlush sentinel atomically with back-assign');
});
