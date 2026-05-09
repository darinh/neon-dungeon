'use strict';
// REAPER mob — source-text wiring tests + behavioural unit tests.
//
// REAPER is an aggression-punishing chaser whose threat scales with
// player.killsInCurrentRoom rather than floor number. At
// REAPER_FRENZY_THRESHOLD kills in the current room it telegraphs a 1.0s
// red ring on the player, then enters a 4s frenzy at +60% spd with stun
// immunity. Per-room single-trigger; reset on player room change.
//
// entities.js is browser-only (no UMD/CommonJS exports), so we follow the
// same regex / node:vm pattern as mirror.test.js / resonator.test.js.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);
const ENEMY_SPAWN_TABLE = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities', 'spawn-table.js'), 'utf8'
);
const SOURCE_METADATA = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities', 'source-metadata.js'), 'utf8'
);
const ENTITY_RENDER_PASSES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities', 'render-passes.js'), 'utf8'
);
const PLATFORM = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'platform.js'), 'utf8'
);
const GAME = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8'
);
const SW = fs.readFileSync(
  path.resolve(__dirname, '..', 'sw.js'), 'utf8'
);

// ─── Wiring assertions ──────────────────────────────────────────────────

test('REAPER appears in ENEMY_WEIGHTS with floor 7+ gate', () => {
  // Per design (deep-floor aggression-punishing chaser), minFloor must be >= 7.
  const m = ENEMY_SPAWN_TABLE.match(/REAPER:\s*\{\s*base:\s*\d+,\s*perFloor:\s*\d+,\s*minFloor:\s*(\d+)/);
  assert.ok(m, 'REAPER must be registered in ENEMY_WEIGHTS');
  assert.ok(parseInt(m[1], 10) >= 7, `REAPER minFloor should be >= 7, got ${m[1]}`);
});

test('REAPER has stat row with melee chase speed', () => {
  // Missing case → spawnEnemy returns Enemy with hp=0, instantly dead.
  // REAPER is a melee chaser so spd must be > 0.
  const m = ENTITIES.match(/case\s+'REAPER':[^\n]*hp\s*=\s*(\d+)[^\n]*atk\s*=\s*(\d+)[^\n]*spd\s*=\s*([\d.]+)[^\n]*xpVal\s*=\s*(\d+)/);
  assert.ok(m, 'REAPER stat row missing');
  assert.ok(parseFloat(m[3]) > 0, 'REAPER must move (spd>0)');
  assert.ok(parseInt(m[1], 10) >= 50, 'REAPER HP feels too low');
  assert.ok(parseInt(m[2], 10) >= 10, 'REAPER atk feels too low');
});

test('REAPER spawn init block sets state and frenzy latch', () => {
  // _reState must start 'idle', _reHasFrenzied must start false so the
  // first kill streak in the room can trigger frenzy.
  const re = /if\s*\(type\s*===\s*'REAPER'\)[\s\S]{0,800}_reState\s*=\s*'idle'[\s\S]{0,400}_reHasFrenzied\s*=\s*false/;
  assert.match(ENTITIES, re, 'REAPER init must set _reState=idle and _reHasFrenzied=false');
});

test('REAPER is excluded from the elite affix roll', () => {
  // The frenzy mechanic stacks badly with elite affixes (SHIELDED would
  // gate the threshold trigger, BERSERKER speed compounds with frenzy).
  // Mirrors MIRROR/RESONATOR/ECHOER exclusions.
  const re = /allowElite[\s\S]{0,600}type\s*!==\s*'REAPER'/;
  assert.match(ENTITIES, re, 'REAPER must be in the elite-exclusion guard');
});

test('REAPER is dispatched in the AI switch', () => {
  assert.match(ENTITIES, /case\s+'REAPER':\s*this\.aiReaper\(/);
});

test('aiReaper method is defined', () => {
  assert.match(ENTITIES, /aiReaper\s*\(\s*dt\s*,\s*player\s*,\s*map\s*,\s*d\s*,\s*los\s*\)\s*\{/);
});

test('REAPER tuning constants are present and reasonable', () => {
  const thr = ENTITIES.match(/REAPER_FRENZY_THRESHOLD\s*=\s*(\d+)/);
  const tele = ENTITIES.match(/REAPER_TELEGRAPH\s*=\s*([\d.]+)/);
  const dur = ENTITIES.match(/REAPER_FRENZY_DURATION\s*=\s*([\d.]+)/);
  const mul = ENTITIES.match(/REAPER_FRENZY_SPD_MUL\s*=\s*([\d.]+)/);
  assert.ok(thr && parseInt(thr[1], 10) === 5, 'REAPER_FRENZY_THRESHOLD must be 5');
  assert.ok(tele && parseFloat(tele[1]) === 1.0, 'REAPER_TELEGRAPH must be 1.0s');
  assert.ok(dur && parseFloat(dur[1]) === 4.0, 'REAPER_FRENZY_DURATION must be 4.0s');
  assert.ok(mul && parseFloat(mul[1]) === 1.6, 'REAPER_FRENZY_SPD_MUL must be 1.6 (+60%)');
});

test('REAPER stun immunity zeros stunTimer BEFORE the generic stun branch', () => {
  // Critical ordering: the immunity check must run BEFORE the generic
  // `if (this.stunTimer > 0)` block so the early-return at the end of
  // that block cannot freeze the reaper mid-frenzy. Reviewers caught the
  // mid-branch-mutation pattern as a footgun.
  const re = /this\.type\s*===\s*'REAPER'\s*&&\s*this\._reFrenzied[\s\S]{0,200}this\.stunTimer\s*=\s*0[\s\S]{0,300}if\s*\(this\.stunTimer\s*>\s*0\)\s*\{/;
  assert.match(ENTITIES, re, 'REAPER stun bypass must precede the generic stun branch');
});

test('REAPER telegraph cancels on stun (matches MIRROR/RESONATOR convention)', () => {
  // Stun received during telegraph drops _reState back to idle so the
  // frenzy doesn't trigger after stun ends — same fairness rule the
  // mirror/resonator telegraphs follow. _reHasFrenzied stays true (one-shot
  // defuse, not a re-trigger reset — re-arm only on player room change).
  const re = /_reState\s*===\s*'telegraph'[\s\S]{0,200}_reState\s*=\s*'idle'[\s\S]{0,200}_reTele\s*=\s*0/;
  assert.match(ENTITIES, re, 'stun handler must drop REAPER telegraph to idle');
});

test('REAPER ai pauses telegraph & frenzy when player out of room (fairness)', () => {
  // The fairness rule reviewers flagged: if telegraph/frenzy ticks down
  // off-screen while the player is in a corridor, the player escapes the
  // punish for free. Both timers must be gated on a `playerInRoom` check
  // INSIDE the telegraph and frenzy state branches.
  const aiBlock = ENTITIES.match(/aiReaper\s*\([^)]*\)\s*\{[\s\S]*?(?=\n  [a-z][a-zA-Z]*\s*\([^)]*\)\s*\{)/);
  assert.ok(aiBlock, 'aiReaper body must be locatable');
  const body = aiBlock[0];
  assert.match(body, /const\s+playerInRoom\s*=/, 'must compute playerInRoom inside aiReaper');
  // Telegraph branch: timer decrement must be gated on playerInRoom
  assert.match(body, /_reState\s*===\s*'telegraph'[\s\S]{0,400}if\s*\(\s*playerInRoom\s*\)[\s\S]{0,200}_reTele\s*-=\s*dt/,
    'telegraph timer must only tick when playerInRoom');
  // Frenzy branch: same
  assert.match(body, /_reState\s*===\s*'frenzy'[\s\S]{0,400}if\s*\(\s*playerInRoom\s*\)[\s\S]{0,200}_reFrenzy\s*-=\s*dt/,
    'frenzy timer must only tick when playerInRoom');
});

test('REAPER chase uses local chaseSpd multiplier — never mutates this.spd', () => {
  // Reviewers flagged speed-leak as the obvious failure. Frenzy must
  // multiply at the call site; this.spd must remain the immutable base.
  const aiBlock = ENTITIES.match(/aiReaper\s*\([^)]*\)\s*\{[\s\S]*?(?=\n  [a-z][a-zA-Z]*\s*\([^)]*\)\s*\{)/);
  assert.ok(aiBlock);
  const body = aiBlock[0];
  // Look for the local chase multiplier pattern
  assert.match(body, /this\.spd\s*\*\s*\(\s*this\._reFrenzied\s*\?\s*REAPER_FRENZY_SPD_MUL/,
    'frenzy must apply via local chaseSpd, not by mutating this.spd');
  // Negative assertion: there must be NO assignment to this.spd in aiReaper
  assert.doesNotMatch(body, /this\.spd\s*=/, 'aiReaper must never reassign this.spd');
});

test('REAPER threshold check requires player in room AND not already frenzied', () => {
  // Idle branch arms telegraph only when (a) player is in this reaper's
  // room, (b) we haven't frenzied this room visit, (c) kill count crossed
  // threshold. Without the _reHasFrenzied gate the reaper would re-trigger
  // every frame after threshold.
  const aiBlock = ENTITIES.match(/aiReaper\s*\([^)]*\)\s*\{[\s\S]*?(?=\n  [a-z][a-zA-Z]*\s*\([^)]*\)\s*\{)/);
  assert.ok(aiBlock);
  const body = aiBlock[0];
  assert.match(body,
    /playerInRoom\s*&&\s*!this\._reHasFrenzied\s*&&\s*kills\s*>=\s*REAPER_FRENZY_THRESHOLD/,
    'arm condition must include playerInRoom + !_reHasFrenzied + threshold');
});

// ─── Player & game-loop wiring ──────────────────────────────────────────

test('Player initializes killsInCurrentRoom=0 and _currentRoom=null', () => {
  assert.match(ENTITIES, /this\.killsInCurrentRoom\s*=\s*0/);
  assert.match(ENTITIES, /this\._currentRoom\s*=\s*null/);
});

test('Enemy.die() increments killsInCurrentRoom by player-position room test', () => {
  // Scope the kill increment by checking the PLAYER'S POSITION at death
  // time against the dying enemy's room — NOT against player._currentRoom.
  // _currentRoom is stale until updatePlaying refreshes it AFTER
  // player.update(), and player.update() can kill enemies mid-frame
  // (e.g. bomb fuse detonation). The fix: read player.x/y directly.
  // Excludes shards/summons (matches enemiesKilled gate).
  const re = /this\.room\.x[\s\S]{0,200}this\.room\.x\s*\+\s*this\.room\.w[\s\S]{0,400}killsInCurrentRoom\s*=\s*\([\s\S]{0,80}\)\s*\+\s*1/;
  assert.match(ENTITIES, re, 'die() must scope kill increment via player position vs this.room bounds');
  // Negative: must NOT compare against the stale player._currentRoom cache.
  const naive = /this\.room\s*===\s*_EG\.player\._currentRoom/;
  assert.doesNotMatch(ENTITIES, naive, 'die() must NOT use stale player._currentRoom');
});

test('game.js detects player room change BEFORE enemy update loop', () => {
  // Critical ordering (reviewer finding #1): if the room-change reset
  // runs AFTER the enemy update loop, REAPERs read stale state for one
  // frame and Enemy.die() events this frame attribute kills to the wrong
  // room. The detection block MUST sit between player.update() and the
  // `for (const e of enemies)` loop.
  const slice = GAME.match(/player\.update\(dt,dungeon\.map\);[\s\S]*?for\s*\(const\s+e\s+of\s+enemies\)/);
  assert.ok(slice, 'player.update → enemies loop region must exist');
  assert.match(slice[0], /killsInCurrentRoom\s*=\s*0/, 'room-change reset must occur before enemy loop');
  assert.match(slice[0], /player\._currentRoom\s*=/, 'player._currentRoom must be assigned before enemy loop');
});

test('game.js room-change handler re-arms REAPERs in the new room', () => {
  // Without re-arming, a REAPER that already frenzied in room A stays
  // dormant on re-entry — design says re-entry should re-arm so a player
  // who leaves to defuse must commit to staying out.
  const slice = GAME.match(/nextRoom\s*!==\s*player\._currentRoom[\s\S]{0,800}/);
  assert.ok(slice, 'room-change branch must exist');
  assert.match(slice[0], /e\.type\s*===\s*'REAPER'[\s\S]{0,200}e\._reHasFrenzied\s*=\s*false/,
    'room change must clear _reHasFrenzied on REAPERs in the new room');
});

test('loadFloor clears killsInCurrentRoom and _currentRoom (cross-floor history)', () => {
  // Same class of bug as the MIRROR _shotHistory / ECHOER _posHistory
  // cross-floor leak: if killsInCurrentRoom persists across floors a
  // reaper on the new floor could read kills from the previous floor and
  // trigger before the player has done anything.
  const slice = GAME.match(/_shotHistory\.length\s*=\s*0;[\s\S]{0,800}/);
  assert.ok(slice, 'loadFloor clear-block region must exist');
  assert.match(slice[0], /killsInCurrentRoom\s*=\s*0/, 'loadFloor must reset killsInCurrentRoom');
  assert.match(slice[0], /_currentRoom\s*=\s*null/, 'loadFloor must clear _currentRoom');
});

// ─── Death-recap wiring ─────────────────────────────────────────────────

test('REAPER appears in SOURCE_LABELS, SOURCE_COLOURS, and CREDIT_VALUES', () => {
  assert.match(SOURCE_METADATA, /REAPER:'Reaper'/, 'SOURCE_LABELS missing REAPER');
  assert.match(SOURCE_METADATA, /REAPER:'#cc1144'/, 'SOURCE_COLOURS missing REAPER (must be crimson)');
  assert.match(SOURCE_METADATA, /REAPER:\d+/, 'CREDIT_VALUES missing REAPER');
});

test('REAPER player ring is drawn from a global pass (not gated by enemy FOV/cull)', () => {
  // Reviewer finding: detect range 14 tiles can exceed vertical half-screen,
  // so a marked player could see no warning if the ring rendered from
  // inside Enemy.draw (which culls off-screen mobs). Fix: dedicated global
  // pass invoked from game.js BEFORE player.draw.
  assert.match(ENTITY_RENDER_PASSES, /function\s+drawReaperPlayerRings\s*\(/,
    'drawReaperPlayerRings global helper must exist');
  assert.match(GAME, /drawReaperPlayerRings\s*\(\s*cam\.x\s*,\s*cam\.y\s*\)/,
    'game.js must call drawReaperPlayerRings before player.draw');
  // Order matters: ring under player sprite, both above particles
  const order = GAME.match(/drawReaperPlayerRings[\s\S]{0,400}player\.draw\(/);
  assert.ok(order, 'drawReaperPlayerRings must precede player.draw in render order');
});

test('REAPER stun-cancel preserves _reHasFrenzied (telegraph entry latches)', () => {
  // Reviewer finding: latching only on frenzy-completion meant stun-cancel
  // during telegraph let the reaper immediately re-arm because
  // _reHasFrenzied was never set. Fix: latch on telegraph ENTRY so cancel
  // naturally consumes the per-room one-shot.
  const aiBlock = ENTITIES.match(/aiReaper\s*\([^)]*\)\s*\{[\s\S]*?(?=\n  [a-z][a-zA-Z]*\s*\([^)]*\)\s*\{)/);
  assert.ok(aiBlock);
  const body = aiBlock[0];
  const armBlock = body.match(/_reState\s*=\s*'telegraph'[\s\S]{0,500}/);
  assert.ok(armBlock, 'telegraph-entry block must exist');
  assert.match(armBlock[0], /this\._reHasFrenzied\s*=\s*true/,
    'telegraph entry must set _reHasFrenzied=true (stun-cancel preserves)');
});

test('REAPER appears in SOURCE_LABELS, SOURCE_COLOURS, and CREDIT_VALUES', () => {
  assert.match(SOURCE_METADATA, /REAPER:'Reaper'/, 'SOURCE_LABELS missing REAPER');
  assert.match(SOURCE_METADATA, /REAPER:'#cc1144'/, 'SOURCE_COLOURS missing REAPER (must be crimson)');
  assert.match(SOURCE_METADATA, /REAPER:\d+/, 'CREDIT_VALUES missing REAPER');
});

// ─── Audio & deployment ─────────────────────────────────────────────────

test('platform.js exposes reaperTelegraph and reaperFrenzy audio', () => {
  assert.match(PLATFORM, /reaperTelegraph\s*\(\s*\)\s*\{/, 'reaperTelegraph audio missing');
  assert.match(PLATFORM, /reaperFrenzy\s*\(\s*\)\s*\{/, 'reaperFrenzy audio missing');
});

test('sw.js cache freshness does not require a numeric cache version', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /const\s+CACHE\s*=\s*'neon-dungeon-assets'/);
});

// ─── Behavioural unit tests via node:vm extraction ──────────────────────
// Extract the aiReaper method body and exercise the state machine without
// loading the full browser-only entities.js. We construct a minimal mock
// `this` that matches the surface aiReaper touches.

function extractAiReaper() {
  // Match `aiReaper(dt, player, map, d, los) { ... }` — body terminates at
  // the next sibling method declaration `\n  identifier(...) {`.
  const m = ENTITIES.match(/aiReaper\s*\(\s*dt\s*,\s*player\s*,\s*map\s*,\s*d\s*,\s*los\s*\)\s*\{[\s\S]*?\n  \}\n/);
  if (!m) throw new Error('aiReaper extraction failed');
  return m[0];
}

function makeReaperHarness() {
  const captured = { audioCalls: [], particles: [], moves: [] };
  const sandbox = {
    REAPER_FRENZY_THRESHOLD: 5,
    REAPER_TELEGRAPH: 1.0,
    REAPER_FRENZY_DURATION: 4.0,
    REAPER_FRENZY_SPD_MUL: 1.6,
    REAPER_DETECT_RANGE: 14,
    audio: {
      reaperTelegraph: () => captured.audioCalls.push('telegraph'),
      reaperFrenzy: () => captured.audioCalls.push('frenzy'),
    },
    spawnParticles: (...args) => captured.particles.push(args),
    captured,
  };
  vm.createContext(sandbox);
  // Wrap the method as a standalone function we can call with a mock `this`.
  const fnSrc = `(function(){ ${extractAiReaper().replace(/^aiReaper/, 'function aiReaper')} return aiReaper; })()`;
  const aiReaper = vm.runInContext(fnSrc, sandbox);
  return { aiReaper, captured };
}

function makeReaper(room) {
  return {
    x: 5, y: 5, spd: 2.4, type: 'REAPER',
    room,
    _tx: 6, _ty: 5,
    _reState: 'idle',
    _reTele: 0,
    _reFrenzy: 0,
    _reFrenzied: false,
    _reHasFrenzied: false,
    bobAngle: 0,
    moveToward(/* tx, ty, spd, dt, map */) { /* mocked at call-time below */ },
    meleeAttack() {},
    patrol() {},
    _canTarget() { return true; },
  };
}

const ROOM = { x: 0, y: 0, w: 10, h: 10 };

test('aiReaper: arms telegraph and latches _reHasFrenzied at threshold', () => {
  const { aiReaper, captured } = makeReaperHarness();
  const r = makeReaper(ROOM);
  const player = { x: 4, y: 4, killsInCurrentRoom: 5, dead: false };
  aiReaper.call(r, 0.016, player, null, 1, true);
  assert.strictEqual(r._reState, 'telegraph', 'must enter telegraph at threshold');
  assert.strictEqual(r._reTele, 1.0, 'must seed _reTele to REAPER_TELEGRAPH');
  assert.strictEqual(r._reHasFrenzied, true,
    'latch must consume on telegraph entry (so stun-cancel preserves)');
  assert.deepStrictEqual(captured.audioCalls, ['telegraph']);
});

test('aiReaper: does NOT arm telegraph when player out of room', () => {
  const { aiReaper, captured } = makeReaperHarness();
  const r = makeReaper(ROOM);
  const player = { x: 50, y: 50, killsInCurrentRoom: 99, dead: false };
  aiReaper.call(r, 0.016, player, null, 1, true);
  assert.strictEqual(r._reState, 'idle', 'must not arm when player out of room');
  assert.deepStrictEqual(captured.audioCalls, []);
});

test('aiReaper: telegraph PAUSES while player out of room', () => {
  const { aiReaper, captured } = makeReaperHarness();
  const r = makeReaper(ROOM);
  r._reState = 'telegraph';
  r._reTele = 0.5;
  // Player leaves room — telegraph timer must NOT decrement
  const playerOut = { x: 50, y: 50, killsInCurrentRoom: 5, dead: false };
  aiReaper.call(r, 0.5, playerOut, null, 50, true);
  assert.strictEqual(r._reTele, 0.5, 'telegraph must pause when player out of room');
  assert.strictEqual(r._reState, 'telegraph');
  assert.deepStrictEqual(captured.audioCalls, []);
});

test('aiReaper: telegraph completes → frenzy when player in room', () => {
  const { aiReaper, captured } = makeReaperHarness();
  const r = makeReaper(ROOM);
  r._reState = 'telegraph';
  r._reTele = 0.1;
  r._reHasFrenzied = true; // latched at telegraph entry (pre-condition)
  const player = { x: 4, y: 4, killsInCurrentRoom: 5, dead: false };
  aiReaper.call(r, 0.2, player, null, 1, true); // dt > _reTele
  assert.strictEqual(r._reState, 'frenzy');
  assert.strictEqual(r._reFrenzied, true);
  assert.strictEqual(r._reHasFrenzied, true, 'latch persists from telegraph entry through frenzy');
  assert.strictEqual(r._reFrenzy, 4.0);
  assert.deepStrictEqual(captured.audioCalls, ['frenzy']);
});

test('aiReaper: frenzy expires → returns to idle, _reFrenzied false, latch stays', () => {
  const { aiReaper } = makeReaperHarness();
  const r = makeReaper(ROOM);
  r._reState = 'frenzy';
  r._reFrenzy = 0.05;
  r._reFrenzied = true;
  r._reHasFrenzied = true;
  const player = { x: 4, y: 4, killsInCurrentRoom: 5, dead: false };
  aiReaper.call(r, 0.2, player, null, 1, true);
  assert.strictEqual(r._reState, 'idle');
  assert.strictEqual(r._reFrenzied, false);
  assert.strictEqual(r._reHasFrenzied, true, 'one-shot latch must persist (no re-trigger this room visit)');
});

test('aiReaper: re-trigger blocked by _reHasFrenzied latch', () => {
  const { aiReaper, captured } = makeReaperHarness();
  const r = makeReaper(ROOM);
  r._reHasFrenzied = true; // already frenzied this room visit
  const player = { x: 4, y: 4, killsInCurrentRoom: 99, dead: false };
  aiReaper.call(r, 0.016, player, null, 1, true);
  assert.strictEqual(r._reState, 'idle', 'must NOT re-trigger while latched');
  assert.deepStrictEqual(captured.audioCalls, []);
});

test('aiReaper: chase speed multiplied by 1.6 during frenzy', () => {
  const { aiReaper } = makeReaperHarness();
  const r = makeReaper(ROOM);
  r._reFrenzied = true;
  r._reState = 'frenzy';
  r._reFrenzy = 2.0;
  let chaseSpdSeen = null;
  r.moveToward = function(tx, ty, spd) { chaseSpdSeen = spd; };
  const player = { x: 4, y: 4, killsInCurrentRoom: 5, dead: false };
  aiReaper.call(r, 0.016, player, null, 1, true);
  assert.ok(chaseSpdSeen !== null, 'moveToward must be called');
  assert.ok(Math.abs(chaseSpdSeen - 2.4 * 1.6) < 0.001,
    `chase spd should be 2.4*1.6=3.84, got ${chaseSpdSeen}`);
  // Crucially: this.spd must remain immutable (never mutated by aiReaper)
  assert.strictEqual(r.spd, 2.4, 'this.spd must remain at base value');
});

test('aiReaper: chase speed = base when not frenzied', () => {
  const { aiReaper } = makeReaperHarness();
  const r = makeReaper(ROOM);
  let chaseSpdSeen = null;
  r.moveToward = function(tx, ty, spd) { chaseSpdSeen = spd; };
  const player = { x: 4, y: 4, killsInCurrentRoom: 0, dead: false };
  aiReaper.call(r, 0.016, player, null, 1, true);
  assert.strictEqual(chaseSpdSeen, 2.4);
});

test('aiReaper: simulated stun-cancel during telegraph → no re-trigger same room', () => {
  // End-to-end stun-cancel sequence:
  //  1. Player crosses kill threshold → reaper telegraphs, latch consumed.
  //  2. Stun lands → game.js stun branch resets _reState='idle', _reTele=0
  //     (NOT modeled here — modelled directly by mutating state).
  //  3. Stun ends, kills still >= 5 → reaper must NOT re-arm because the
  //     latch was consumed on telegraph entry.
  const { aiReaper, captured } = makeReaperHarness();
  const r = makeReaper(ROOM);
  const player = { x: 4, y: 4, killsInCurrentRoom: 5, dead: false };
  // Step 1: arm telegraph
  aiReaper.call(r, 0.016, player, null, 1, true);
  assert.strictEqual(r._reState, 'telegraph');
  assert.strictEqual(r._reHasFrenzied, true, 'latch must be consumed at telegraph entry');
  // Step 2: simulate stun branch in update() (entities.js) — drops to idle
  r._reState = 'idle';
  r._reTele = 0;
  // Step 3: kill counter still above threshold; tick again
  captured.audioCalls.length = 0;
  aiReaper.call(r, 0.016, player, null, 1, true);
  assert.strictEqual(r._reState, 'idle', 'must NOT re-arm after stun-cancel');
  assert.deepStrictEqual(captured.audioCalls, [], 'no telegraph audio on retry');
});
