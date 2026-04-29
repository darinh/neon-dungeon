'use strict';
// NULLIFIER mob — wiring + behaviour tests.
//
// NULLIFIER is the FIRST mob whose role is anti-hackware specifically. It
// fills a real coverage gap:
//   - SAPPER drains TIMED BOOSTS (HARVEST_SURGE class), not hackware
//   - DISRUPTOR drops short-lived fields (the existing
//     player.disruptionFieldActive flag suppresses cooldown ticking BUT
//     the mob itself is a fire-and-forget deployer; fields decay)
//   - JAMMED floor modifier is a passive ×1.25 multiplier on hackware
//     cooldown-set, doesn't gate ticking or activation
// NULLIFIER is the persistent room-scoped jamming threat — atk=0, spd=0,
// stationary structure with a NULLIFIER_FIELD_R-tile aura that sets
// player.hackwareJammed when the player is inside. That flag:
//   - extends the cooldown-tick gate at entities.js (player.update)
//   - extends the activation gate at content.js (activateHackware)
//
// Counterplay: leave the aura, OR kill the mob (hp=70, atk=0 makes it
// a sitting duck once you commit), OR stun it (EMP_BURST/EMP_LINE/SHOCK).
//
// This test file follows the canonical scaffold (TIME_DILATION /
// BOSS_INTRO / ARCHITECT). It pins:
//   1. The constants block (NULLIFIER_FIELD_R, NULLIFIER_PULSE_RATE).
//   2. The ENEMIES table stat-row entry.
//   3. The ENEMY_WEIGHTS spawn-table entry (with minFloor canary).
//   4. The CREDIT_VALUES / SOURCE_LABELS / SOURCE_COLOURS registry
//      uniformity (per the post-merge audit insight from ARCHITECT).
//   5. The elite-roll exclusion (atk=0 spd=0 mobs don't carry affixes).
//   6. The init block in spawnEnemy (visual pulse seed).
//   7. The AI dispatch wiring (case 'NULLIFIER' in update switch).
//   8. The aiNullifier method exists with documented signature.
//   9. The cooldown-tick gate is extended with !hackwareJammed (with
//      anti-bypass armour: the gate must be a SINGLE && conjunction in
//      the canonical line — sibling-neutralizer / hasDeadBranch /
//      INVERTED-COMPARISON defences applied).
//  10. The activation-gate in activateHackware checks player.hackwareJammed
//      BEFORE the cooldown-set logic (early return, with audio + floater).
//  11. updateNullifierJam helper is wired into game.js update loop next
//      to updateDisruptionFields (live-aura flag must be fresh before
//      player.update reads it).
//  12. updateNullifierJam helper iterates enemies, gates on stunTimer===0,
//      sets player.hackwareJammed (with COMPUTED-BUT-NOT-APPLIED defence:
//      the assignment is anchored end-of-statement so a contributor can't
//      delete the assignment while passing the "computes radius check"
//      regex).
//  13. Player class declares hackwareJammed field + initialises to false
//      in constructor (without init, the typecheck would still pass but
//      first-tick reads would be undefined → falsy → silent
//      cooldown-tick-while-jamming bug).
//  14. BEHAVIOURAL re-derivation of updateNullifierJam logic — pure-JS
//      reimplementation of the radius / stun / dead checks, asserts the
//      design contract directly.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extractBranch, loadAlignmentSources }
  = require('./_alignment-helpers.js');

const { ENTITIES, CONTENT, ENTITIES_CODE, CONTENT_CODE }
  = loadAlignmentSources(__dirname);
const fs = require('node:fs');
const path = require('node:path');
const GAME = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8'
);
const PLATFORM = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'platform.js'), 'utf8'
);

// ─── Dead-branch detector (canonical hardened scaffold) ──────────────────
// Per stored memory 'structural test bypass classes' — opus-4.7 r2 of
// TIME_DILATION proved that compile-time-falsy openers (`if (false)`,
// `if (0)`, `if (!true)`, `if (1<2) return;`, etc.) defeat naïve presence
// regexes. This helper covers the full bypass surface:
//   - literal falsy: false, 0, '', null, undefined, NaN, void 0
//   - !-coerced literals: !true, !1, !'literal'
//   - constant-comparison: 0===1, 1>2, 1===0
//   - ternary-to-literal: ? false : ... etc.
//   - braceless always-true early-exit: if (1<2) return; / continue;
//
// Returns true if the snippet contains any dead-branch pattern that
// would defeat a structural assertion.
function hasDeadBranch(snippet) {
  if (!snippet) return false;
  const patterns = [
    /\bif\s*\(\s*false\s*\)/,
    /\bif\s*\(\s*0\s*\)/,
    /\bif\s*\(\s*''\s*\)/,
    /\bif\s*\(\s*null\s*\)/,
    /\bif\s*\(\s*undefined\s*\)/,
    /\bif\s*\(\s*NaN\s*\)/,
    /\bif\s*\(\s*void\s*0\s*\)/,
    /\bif\s*\(\s*!\s*true\s*\)/,
    /\bif\s*\(\s*!\s*1\s*\)/,
    /\bif\s*\(\s*!\s*'[^']*'\s*\)/,
    /\bif\s*\(\s*0\s*===\s*1\s*\)/,
    /\bif\s*\(\s*1\s*>\s*2\s*\)/,
    /\bif\s*\(\s*1\s*===\s*0\s*\)/,
    // Compile-time-TRUE early-exit gates
    /\bif\s*\(\s*true\s*\)\s*(?:return|continue|break|throw)\b/,
    /\bif\s*\(\s*1\s*\)\s*(?:return|continue|break|throw)\b/,
    /\bif\s*\(\s*1\s*<\s*2\s*\)\s*(?:return|continue|break|throw)\b/,
    /\bif\s*\(\s*0\s*<\s*1\s*\)\s*(?:return|continue|break|throw)\b/,
  ];
  return patterns.some((re) => re.test(snippet));
}

// ─── 1. Constants block ──────────────────────────────────────────────────

test('NULLIFIER_FIELD_R const declared with documented value (5)', () => {
  // Per design: 5-tile radius. Distinct from MAGNETON_FIELD_R (5.5) so
  // tests can't accidentally pin the wrong field's radius.
  assert.match(ENTITIES, /const\s+NULLIFIER_FIELD_R\s*=\s*5\b/,
    'NULLIFIER_FIELD_R must be declared as a const with value 5');
});

test('NULLIFIER_PULSE_RATE const declared with documented value (1.8)', () => {
  // Visual pulse rate — purely cosmetic, but pinning prevents drift.
  assert.match(ENTITIES, /const\s+NULLIFIER_PULSE_RATE\s*=\s*1\.8\b/,
    'NULLIFIER_PULSE_RATE must be declared as a const with value 1.8');
});

// ─── 2. ENEMIES stat-row entry ───────────────────────────────────────────

test('NULLIFIER is registered in ENEMIES stat table with full row', () => {
  // Per design: hp=70 atk=0 spd=0 xpVal=24 colour=#cc66dd.
  // atk=0 spd=0 marks this as a stationary no-contact-damage mob — the
  // entire threat is the persistent jam aura. xpVal=24 sits between
  // SCORCHER (24) and PROPHET (28); below ARCHITECT (30) because
  // NULLIFIER's threat is positional/economic rather than spatially
  // disruptive (no walls placed, no terrain changes).
  assert.match(ENTITIES,
    /case\s+'NULLIFIER':\s*hp=70;\s*atk=0;\s*spd=0;\s*xpVal=24;\s*colour='#cc66dd'/,
    "ENEMIES table must declare NULLIFIER with hp=70 atk=0 spd=0 xpVal=24 colour=#cc66dd");
});

// ─── 3. ENEMY_WEIGHTS spawn-table entry ──────────────────────────────────

test('NULLIFIER is registered in ENEMY_WEIGHTS spawn table with minFloor 6', () => {
  // Per opus + gpt-5.5 review of ARCHITECT (CRITICAL): without an
  // ENEMY_WEIGHTS entry, pickEnemyType() never selects NULLIFIER and
  // the entire mob is dead code. Pin the spawn-table entry. minFloor 6
  // matches design (mid-late game tier — JAMMED hackware floor is too
  // punishing if it shows up before the player even has a hackware
  // module equipped, which usually happens around floor 3-5).
  assert.match(ENTITIES,
    /NULLIFIER:\s*\{\s*base:\s*\d+\s*,\s*perFloor:\s*\d+\s*,\s*minFloor:\s*6\b/,
    'NULLIFIER must appear in ENEMY_WEIGHTS with minFloor 6');
});

// ─── 4. Registry uniformity ──────────────────────────────────────────────

test('NULLIFIER is registered in CREDIT_VALUES (post-merge audit)', () => {
  // Per ARCHITECT post-merge audit: missing CREDIT_VALUES entry would
  // fall back to 5 credits — under-rewards a hp=70 xpVal=24 mob.
  assert.match(ENTITIES, /NULLIFIER:10\b/,
    'NULLIFIER must appear in CREDIT_VALUES with credit drop 10');
});

test('NULLIFIER appears in SOURCE_LABELS', () => {
  // Convention: every mob in ENEMIES gets entries in SOURCE_LABELS +
  // SOURCE_COLOURS, even atk=0 mobs (per ARCHITECT audit).
  assert.match(ENTITIES, /NULLIFIER:\s*'Nullifier'/,
    "SOURCE_LABELS must contain NULLIFIER:'Nullifier'");
});

test('NULLIFIER appears in SOURCE_COLOURS with mob colour', () => {
  assert.match(ENTITIES, /NULLIFIER:\s*'#cc66dd'/,
    "SOURCE_COLOURS must contain NULLIFIER:'#cc66dd' (matches mob colour)");
});

// ─── 5. Elite-roll exclusion ─────────────────────────────────────────────

test('NULLIFIER is excluded from elite-affix roll', () => {
  // atk=0 spd=0 mob — elite affixes (BERSERK / SHIELDED / etc.) wouldn't
  // make sense. Mirrors WATCHER/ARCHITECT/MAGNETON exclusion convention.
  assert.match(ENTITIES,
    /type\s*!==\s*'ARCHITECT'\s*&&\s*type\s*!==\s*'NULLIFIER'/,
    "Elite-affix roll exclusion must list NULLIFIER after ARCHITECT");
});

// ─── 6. Init block ───────────────────────────────────────────────────────

test('spawnEnemy NULLIFIER init block seeds _nlPulse with random offset', () => {
  // Per design: clustered spawns must not pulse in lock-step (visual
  // only, no gameplay coupling). _nlPulse seeded with Math.random() *
  // TWO_PI so each instance starts at a different phase.
  const initBlock = ENTITIES_CODE.match(
    /if\s*\(\s*type\s*===\s*'NULLIFIER'\s*\)\s*\{[\s\S]{0,500}?\}/
  );
  assert.ok(initBlock, 'NULLIFIER init block must exist in spawnEnemy');
  assert.match(initBlock[0],
    /e\._nlPulse\s*=\s*Math\.random\s*\(\s*\)\s*\*\s*TWO_PI\s*;/,
    'init block must seed e._nlPulse = Math.random() * TWO_PI;');
  assert.ok(!hasDeadBranch(initBlock[0]),
    'init block must not contain dead branches (would defeat the seed)');
});

// ─── 7. AI dispatch wiring ───────────────────────────────────────────────

test("AI dispatch switch routes NULLIFIER to aiNullifier()", () => {
  // Without this, NULLIFIER falls through to default GUARD chase. At
  // spd=0 that's harmless BUT the canonical convention is a named AI
  // method for every type — pin the dispatch.
  assert.match(ENTITIES,
    /case\s+'NULLIFIER':\s*this\.aiNullifier\s*\(/,
    'AI dispatch must route NULLIFIER to aiNullifier()');
});

test('aiNullifier method exists on Enemy class with documented signature', () => {
  assert.match(ENTITIES, /aiNullifier\s*\(\s*dt\s*,\s*player\s*,\s*map\s*,/,
    'Enemy.aiNullifier(dt, player, map, ...) must exist');
});

test('aiNullifier advances _nlPulse using NULLIFIER_PULSE_RATE', () => {
  // The visual pulse must advance per real-time dt. Pinning the rate
  // multiplication keeps the visual readable across framerates.
  // Anti-bypass: full statement anchored ;.
  const aiBody = ENTITIES_CODE.match(
    /aiNullifier\s*\(\s*dt[\s\S]{0,400}?\n\s*\}/
  );
  assert.ok(aiBody, 'aiNullifier body must be extractable');
  assert.match(aiBody[0],
    /this\._nlPulse\s*=\s*\(\s*this\._nlPulse\s*\|\|\s*0\s*\)\s*\+\s*dt\s*\*\s*NULLIFIER_PULSE_RATE\s*;/,
    'aiNullifier must advance _nlPulse by dt * NULLIFIER_PULSE_RATE; (full statement anchored)');
  assert.ok(!hasDeadBranch(aiBody[0]),
    'aiNullifier body must not contain dead branches');
});

// ─── 8. Cooldown-tick gate (extended with !hackwareJammed) ───────────────

test('hackwareCooldown decrement is gated on BOTH disruptionFieldActive AND hackwareJammed', () => {
  // The canonical line at player.update (was: `if
  // (!this.disruptionFieldActive) ...`) must now check BOTH flags via
  // logical AND. Anti-bypass: pin the EXACT canonical form so a
  // contributor can't:
  //   - replace && with || (would let either flag alone unblock ticking)
  //   - drop the !hackwareJammed (silent regression: aura blocks
  //     activation but cooldown ticks anyway — pre-bake exploit)
  //   - shadow with a sibling write (sibling-neutralizer class)
  // Full-statement anchor.
  assert.match(ENTITIES,
    /if\s*\(\s*!this\.disruptionFieldActive\s*&&\s*!this\.hackwareJammed\s*\)\s*this\.hackwareCooldown\s*=\s*Math\.max\s*\(\s*0\s*,\s*this\.hackwareCooldown\s*-\s*dt\s*\)\s*;/,
    "cooldown-tick line must be the exact canonical form: if (!this.disruptionFieldActive && !this.hackwareJammed) this.hackwareCooldown=Math.max(0,this.hackwareCooldown-dt);");
});

test('hackwareCooldown gate appears EXACTLY ONCE in entities.js (sibling-neutralizer guard)', () => {
  // Per stored memory 'structural test bypass classes' — SIBLING-
  // NEUTRALIZER LOOP class. A second `this.hackwareCooldown = ...`
  // line in player.update could neutralise the gate by unconditionally
  // re-decrementing or overwriting the cooldown. Count the canonical
  // assignment site: must be exactly 1.
  const matches = ENTITIES.match(
    /this\.hackwareCooldown\s*=\s*Math\.max\s*\(\s*0\s*,\s*this\.hackwareCooldown\s*-\s*dt\s*\)/g
  ) || [];
  assert.equal(matches.length, 1,
    `entities.js must contain exactly one cooldown-tick assignment, got ${matches.length}`);
});

// ─── 9. Activation gate in activateHackware ──────────────────────────────

test('activateHackware bails out via isPlayerInNullifierAura (BEFORE cooldown-set)', () => {
  // Per gpt-5.3-codex r1 + gpt-5.5 r1: the cached player.hackwareJammed
  // flag is one frame stale (updateNullifierJam runs AFTER player.update).
  // activateHackware must call isPlayerInNullifierAura DIRECTLY for a
  // FRESH same-frame check, not read the cached flag. Pin the helper
  // call (not the flag read).
  //
  // The check must run BEFORE the cooldown is set — otherwise activating
  // inside an aura would still consume the cooldown reset (silent
  // pre-cooldown-set bug). Pin order: jam gate appears BEFORE the
  // player.hackwareCooldown = hw.cooldown line.
  const fnBody = extractBranch(
    CONTENT_CODE,
    /function\s+activateHackware\s*\(\s*player\s*\)\s*\{/
  );
  assert.ok(fnBody, 'activateHackware function body must be extractable');
  // Order assertion: jam check + return must precede the cooldown
  // assignment.
  const jamIdx = fnBody.search(/isPlayerInNullifierAura\s*\(\s*player\s*\)/);
  const cdIdx = fnBody.search(/player\.hackwareCooldown\s*=\s*hw\.cooldown/);
  assert.ok(jamIdx >= 0,
    'activateHackware must call isPlayerInNullifierAura(player) for fresh check');
  assert.ok(cdIdx >= 0, 'activateHackware must set player.hackwareCooldown');
  assert.ok(jamIdx < cdIdx,
    'isPlayerInNullifierAura check must appear BEFORE the cooldown-set line');
  // Pin the gate itself: if (isPlayerInNullifierAura(player)) { ...; return; }
  // The early return is non-negotiable — falling through would still
  // execute the hackware effect.
  const gateBlock = fnBody.match(
    /if\s*\(\s*isPlayerInNullifierAura\s*\(\s*player\s*\)\s*\)\s*\{[\s\S]{0,400}?return\s*;\s*\}/
  );
  assert.ok(gateBlock,
    'activateHackware must contain an early-return gate calling isPlayerInNullifierAura(player)');
  assert.ok(!hasDeadBranch(gateBlock[0]),
    'jam gate body must not contain dead branches');
});

test('activateHackware does NOT read the stale cached flag (per codex/gpt-5.5 r1)', () => {
  // Per codex/gpt-5.5 r1: reading the cached flag is incorrect. Pin
  // ABSENCE of the stale-flag read inside activateHackware. The flag
  // is still set elsewhere (updateNullifierJam) for the cooldown-tick
  // gate where staleness is invisible — but activateHackware MUST NOT
  // read it.
  const fnBody = extractBranch(
    CONTENT_CODE,
    /function\s+activateHackware\s*\(\s*player\s*\)\s*\{/
  );
  assert.ok(fnBody, 'activateHackware body extractable');
  assert.doesNotMatch(fnBody, /if\s*\(\s*player\.hackwareJammed\s*\)/,
    'activateHackware MUST NOT read the cached player.hackwareJammed flag — use isPlayerInNullifierAura(player) for fresh check');
});

test('activateHackware jam gate emits audio cue + JAMMED floater', () => {
  // Without audio + visual feedback, a jammed activation feels like an
  // input lag bug. Pin both feedback channels inside the gate.
  const fnBody = extractBranch(
    CONTENT_CODE,
    /function\s+activateHackware\s*\(\s*player\s*\)\s*\{/
  );
  assert.ok(fnBody, 'activateHackware body extractable');
  const gateBlock = fnBody.match(
    /if\s*\(\s*isPlayerInNullifierAura\s*\(\s*player\s*\)\s*\)\s*\{[\s\S]{0,400}?\}/
  );
  assert.ok(gateBlock, 'jam gate block must be extractable');
  assert.match(gateBlock[0], /audio\.hackwareJammed\s*\(\s*\)\s*;/,
    'jam gate must call audio.hackwareJammed();');
  assert.match(gateBlock[0],
    /spawnDmgText\s*\(\s*player\.x\s*,\s*player\.y\s*,\s*'JAMMED'\s*,\s*'#cc66dd'\s*\)\s*;/,
    "jam gate must spawn a 'JAMMED' floater in the NULLIFIER colour (#cc66dd)");
});

test('audio.hackwareJammed() is defined in platform.js', () => {
  // Pin the audio definition. Without it, the gate's audio call would
  // fail at runtime with TypeError: audio.hackwareJammed is not a function.
  assert.match(PLATFORM, /hackwareJammed\s*\(\s*\)\s*\{/,
    'audio.hackwareJammed() must exist in platform.js');
});

// ─── 10. updateNullifierJam — call-site wiring ───────────────────────────

test('updateNullifierJam is called from the main game.js update loop', () => {
  // Must run BEFORE player.update next frame (so player.hackwareJammed
  // is fresh when player.update reads the cooldown gate). The canonical
  // call site is right after updateDisruptionFields, mirroring the
  // call-ordering rationale documented at that site.
  assert.match(GAME, /updateNullifierJam\s*\(\s*dt\s*,\s*player\s*\)/,
    'game.js update loop must call updateNullifierJam(dt, player) each frame');
  // Order: must appear AFTER updateDisruptionFields (both are flag-
  // setters; the order doesn't matter for correctness but pinning
  // prevents an accidental re-order that drops one call).
  const drIdx = GAME.search(/updateDisruptionFields\s*\(\s*dt\s*,\s*player\s*\)/);
  const nlIdx = GAME.search(/updateNullifierJam\s*\(\s*dt\s*,\s*player\s*\)/);
  assert.ok(drIdx >= 0, 'updateDisruptionFields call site must exist');
  assert.ok(nlIdx >= 0, 'updateNullifierJam call site must exist');
  assert.ok(drIdx < nlIdx,
    'updateNullifierJam must appear AFTER updateDisruptionFields');
});

test('updateNullifierJam helper is defined in entities.js', () => {
  assert.match(ENTITIES,
    /function\s+updateNullifierJam\s*\(\s*dt\s*,\s*player\s*\)/,
    'updateNullifierJam(dt, player) must exist in entities.js');
});

test('isPlayerInNullifierAura helper is defined in entities.js (per codex/gpt-5.5/opus r1)', () => {
  // Per gpt-5.3-codex r1 + gpt-5.5 r1: the cached flag is one frame
  // stale; activateHackware needs a fresh same-frame check. Per claude-
  // opus-4.7 r1: jam aura must respect isPlayerDamageImmune (matches
  // DISRUPTOR precedent). Both fixes converge on a pure boolean helper
  // that activateHackware calls directly AND updateNullifierJam delegates
  // to. Pin the helper signature.
  assert.match(ENTITIES,
    /function\s+isPlayerInNullifierAura\s*\(\s*player\s*\)/,
    'isPlayerInNullifierAura(player) must exist in entities.js');
});

test('updateNullifierJam delegates to isPlayerInNullifierAura', () => {
  // Pin that updateNullifierJam writes the flag based on the helper's
  // return value (single source of truth — no logic divergence between
  // the cached path and the fresh-check path).
  const body = extractBranch(
    ENTITIES_CODE,
    /function\s+updateNullifierJam\s*\(\s*dt\s*,\s*player\s*\)\s*\{/
  );
  assert.ok(body, 'updateNullifierJam body extractable');
  assert.match(body,
    /player\.hackwareJammed\s*=\s*isPlayerInNullifierAura\s*\(\s*player\s*\)\s*;/,
    'updateNullifierJam must delegate to isPlayerInNullifierAura(player)');
  assert.ok(!hasDeadBranch(body),
    'updateNullifierJam body must not contain dead branches');
});

// ─── 11. isPlayerInNullifierAura — body anti-bypass ─────────────────────
// The pure helper is the single source of truth for "is the player in
// any live unstunned NULLIFIER's aura right now?". Both the cached path
// (updateNullifierJam → flag → cooldown gate) and the fresh path
// (activateHackware) read it. Pin the body's structural invariants.

test('isPlayerInNullifierAura early-returns false for null player', () => {
  // Defensive guard against any caller that might pass undefined during
  // load/init transitions. Without it, `player.x` would throw.
  const body = extractBranch(
    ENTITIES_CODE,
    /function\s+isPlayerInNullifierAura\s*\(\s*player\s*\)\s*\{/
  );
  assert.ok(body, 'isPlayerInNullifierAura body extractable');
  assert.match(body, /if\s*\(\s*!player\s*\)\s*return\s+false\s*;/,
    'function must guard against null/undefined player and return false');
});

test('isPlayerInNullifierAura gates on isPlayerDamageImmune (per opus r1)', () => {
  // Per claude-opus-4.7 r1: matches DISRUPTOR precedent. Dash i-frames
  // and PHASE_CLOAK pass through — legitimate counterplay vectors.
  // Without this gate, NULLIFIER would be the only stationary field-
  // emitter that ignores i-frames, breaking convention. The gate must
  // be an EARLY RETURN (not a late-stage filter) so the iteration
  // doesn't run when the player is immune (perf canary).
  const body = extractBranch(
    ENTITIES_CODE,
    /function\s+isPlayerInNullifierAura\s*\(\s*player\s*\)\s*\{/
  );
  assert.ok(body, 'body extractable');
  assert.match(body,
    /if\s*\(\s*isPlayerDamageImmune\s*\(\s*\)\s*\)\s*return\s+false\s*;/,
    'function must early-return false when isPlayerDamageImmune() — matches DISRUPTOR');
  // Pin the order: damage-immune gate must precede the iteration.
  const immuneIdx = body.search(/isPlayerDamageImmune/);
  const iterIdx = body.search(/for\s*\(\s*const\s+e\s+of\s+enemies/);
  assert.ok(immuneIdx >= 0 && iterIdx >= 0,
    'both gates must exist');
  assert.ok(immuneIdx < iterIdx,
    'isPlayerDamageImmune gate must precede the enemies iteration (perf + early-out)');
});

test('isPlayerInNullifierAura iterates enemies with COMPUTED-BUT-NOT-APPLIED defence', () => {
  // The aura check must (a) compute distance via squared comparison,
  // AND (b) actually return true when in range. Per stored memory
  // 'structural test bypass classes' — the COMPUTED-BUT-NOT-APPLIED
  // class: a contributor could compute the radius check but delete the
  // return, passing every "computes correctly" test while defeating
  // the entire effect. Pin BOTH:
  //   - the radius squared comparison (vx*vx + vy*vy < r2)
  //   - the application (return true;)
  const body = extractBranch(
    ENTITIES_CODE,
    /function\s+isPlayerInNullifierAura\s*\(\s*player\s*\)\s*\{/
  );
  assert.ok(body, 'body extractable');
  // Iteration site
  assert.match(body, /for\s*\(\s*const\s+e\s+of\s+enemies\s*\)/,
    'function must iterate `for (const e of enemies)`');
  // Dead-enemy guard
  assert.match(body, /if\s*\(\s*!e\s*\|\|\s*e\.dead\s*\)\s*continue\s*;/,
    'function must skip dead/null enemies');
  // Type filter — only NULLIFIERs participate
  assert.match(body, /if\s*\(\s*e\.type\s*!==\s*'NULLIFIER'\s*\)\s*continue\s*;/,
    'function must filter on e.type !== \'NULLIFIER\'');
  // Stun gate — defence-in-depth
  assert.match(body,
    /if\s*\(\s*e\.stunTimer\s*&&\s*e\.stunTimer\s*>\s*0\s*\)\s*continue\s*;/,
    'function must skip stunned NULLIFIERs (defence-in-depth)');
  // Distance computation — squared form for perf parity with MAGNETON
  assert.match(body, /vx\s*\*\s*vx\s*\+\s*vy\s*\*\s*vy\s*<\s*r2/,
    'function must compute squared-distance comparison (vx*vx + vy*vy < r2)');
  // r2 binds to NULLIFIER_FIELD_R squared
  assert.match(body,
    /const\s+r2\s*=\s*NULLIFIER_FIELD_R\s*\*\s*NULLIFIER_FIELD_R\s*;/,
    'r2 must be derived from NULLIFIER_FIELD_R squared');
  // APPLICATION site — `return true;` end-anchored. Without this, the
  // aura computes correctly but never reports true.
  assert.match(body, /return\s+true\s*;/,
    'function must APPLY the result with `return true;` when in range');
  // FALLTHROUGH site — `return false;` after the loop. Without this,
  // the function would return undefined, which is falsy and silently
  // works — but explicit return is more robust to refactor.
  assert.match(body, /\}\s*return\s+false\s*;\s*\}/,
    'function must return false after loop (no implicit undefined)');
});

test('isPlayerInNullifierAura iteration appears EXACTLY ONCE (sibling-neutralizer guard)', () => {
  // Per stored memory 'structural test bypass classes' — SIBLING-
  // NEUTRALIZER LOOP class. A second `for (const e of enemies)` after
  // the canonical loop could neutralise everything. Count the iteration
  // site within the helper body: must be exactly 1.
  const body = extractBranch(
    ENTITIES_CODE,
    /function\s+isPlayerInNullifierAura\s*\(\s*player\s*\)\s*\{/
  );
  assert.ok(body, 'body extractable');
  const matches = body.match(/for\s*\(\s*const\s+e\s+of\s+enemies\s*\)/g) || [];
  assert.equal(matches.length, 1,
    `isPlayerInNullifierAura must contain exactly one iteration loop, got ${matches.length}`);
});

test('updateNullifierJam resets player.hackwareJammed via helper delegate', () => {
  // After refactor, the reset+set is collapsed into a single delegation
  // line: `player.hackwareJammed = isPlayerInNullifierAura(player);`
  // Pin this exact form — sibling assignments would defeat it.
  const body = extractBranch(
    ENTITIES_CODE,
    /function\s+updateNullifierJam\s*\(\s*dt\s*,\s*player\s*\)\s*\{/
  );
  assert.ok(body, 'updateNullifierJam body extractable');
  // Exactly one assignment to player.hackwareJammed in the function.
  const matches = body.match(/player\.hackwareJammed\s*=/g) || [];
  assert.equal(matches.length, 1,
    `updateNullifierJam must contain exactly one assignment to player.hackwareJammed, got ${matches.length}`);
});

// ─── 12. Player class field declarations ─────────────────────────────────

test('Player class declares hackwareJammed field for ts-check', () => {
  // Without the JSDoc field declaration, ts-check on the file would
  // emit "Property 'hackwareJammed' does not exist on type 'Player'"
  // wherever we read this.hackwareJammed. Pin the declaration.
  assert.match(ENTITIES,
    /\/\*\*\s*@type\s*\{\s*any\s*\}\s*\*\/\s*hackwareJammed\s*;/,
    'Player class must declare /** @type {any} */ hackwareJammed;');
});

test('Player constructor initialises hackwareJammed to false', () => {
  // Without the initialiser, first-tick reads of this.hackwareJammed
  // are undefined → falsy → silent passthrough on the cooldown gate
  // (cooldown ticks normally before the first updateNullifierJam call
  // sets the flag). Pin the constructor init.
  assert.match(ENTITIES,
    /this\.hackwareJammed\s*=\s*false\s*;/,
    'Player constructor must initialise this.hackwareJammed = false;');
});

// ─── 13. BEHAVIOURAL re-derivation ───────────────────────────────────────
//
// SCOPE NOTE: entities.js is browser-only (UMD) and not loadable as
// CommonJS. These tests RE-DERIVE the design contract in pure JS and
// assert the behavioural invariants directly. The source-text pins
// above catch divergence; this section catches design-logic regressions.
//
// The reimpl mirrors isPlayerInNullifierAura (the pure helper that
// updateNullifierJam delegates to AND activateHackware calls fresh).

const NULLIFIER_FIELD_R_TEST = 5;

function reimpl_isPlayerInNullifierAura(player, enemies, isImmune = false) {
  if (!player) return false;
  if (isImmune) return false;
  const r2 = NULLIFIER_FIELD_R_TEST * NULLIFIER_FIELD_R_TEST;
  const px = player.x, py = player.y;
  for (const e of enemies) {
    if (!e || e.dead) continue;
    if (e.type !== 'NULLIFIER') continue;
    if (e.stunTimer && e.stunTimer > 0) continue;
    const vx = e.x - px, vy = e.y - py;
    if (vx * vx + vy * vy < r2) return true;
  }
  return false;
}

function reimpl_updateNullifierJam(dt, player, enemies, isImmune = false) {
  void dt;
  player.hackwareJammed = reimpl_isPlayerInNullifierAura(player, enemies, isImmune);
}

test('BEHAVIOUR: player inside NULLIFIER aura → hackwareJammed = true', () => {
  const player = { x: 5, y: 5, hackwareJammed: false };
  const nullifier = { x: 6, y: 5, type: 'NULLIFIER', dead: false, stunTimer: 0 };
  reimpl_updateNullifierJam(0.016, player, [nullifier]);
  assert.equal(player.hackwareJammed, true,
    'player at distance 1 from NULLIFIER must be jammed (radius 5)');
});

test('BEHAVIOUR: player at edge of aura (just inside) → jammed', () => {
  const player = { x: 5, y: 5, hackwareJammed: false };
  const nullifier = { x: 5 + 4.999, y: 5, type: 'NULLIFIER', dead: false, stunTimer: 0 };
  reimpl_updateNullifierJam(0.016, player, [nullifier]);
  assert.equal(player.hackwareJammed, true,
    'player at distance just inside radius must be jammed');
});

test('BEHAVIOUR: player at exactly radius distance → NOT jammed (strict <)', () => {
  const player = { x: 5, y: 5, hackwareJammed: false };
  const nullifier = { x: 10, y: 5, type: 'NULLIFIER', dead: false, stunTimer: 0 };
  reimpl_updateNullifierJam(0.016, player, [nullifier]);
  assert.equal(player.hackwareJammed, false,
    'player at exactly radius distance must NOT be jammed (strict <)');
});

test('BEHAVIOUR: player outside aura → NOT jammed', () => {
  const player = { x: 0, y: 0, hackwareJammed: false };
  const nullifier = { x: 10, y: 0, type: 'NULLIFIER', dead: false, stunTimer: 0 };
  reimpl_updateNullifierJam(0.016, player, [nullifier]);
  assert.equal(player.hackwareJammed, false,
    'player at distance 10 from NULLIFIER must NOT be jammed (radius 5)');
});

test('BEHAVIOUR: stunned NULLIFIER does NOT jam', () => {
  const player = { x: 5, y: 5, hackwareJammed: false };
  const nullifier = { x: 6, y: 5, type: 'NULLIFIER', dead: false, stunTimer: 1.5 };
  reimpl_updateNullifierJam(0.016, player, [nullifier]);
  assert.equal(player.hackwareJammed, false,
    'stunned NULLIFIER (stunTimer > 0) must not jam — counter-tool defuse');
});

test('BEHAVIOUR: dead NULLIFIER does NOT jam', () => {
  const player = { x: 5, y: 5, hackwareJammed: false };
  const nullifier = { x: 6, y: 5, type: 'NULLIFIER', dead: true, stunTimer: 0 };
  reimpl_updateNullifierJam(0.016, player, [nullifier]);
  assert.equal(player.hackwareJammed, false,
    'dead NULLIFIER must not jam — kill is the canonical counter');
});

test('BEHAVIOUR: non-NULLIFIER enemies do NOT jam', () => {
  const player = { x: 5, y: 5, hackwareJammed: false };
  const disruptor = { x: 5.5, y: 5, type: 'DISRUPTOR', dead: false, stunTimer: 0 };
  const architect = { x: 4.5, y: 5, type: 'ARCHITECT', dead: false, stunTimer: 0 };
  reimpl_updateNullifierJam(0.016, player, [disruptor, architect]);
  assert.equal(player.hackwareJammed, false,
    'only NULLIFIER mobs project the jam aura — type filter is mandatory');
});

test('BEHAVIOUR: jam state resets each frame (no stale latch)', () => {
  const player = { x: 5, y: 5, hackwareJammed: true /* stale */ };
  reimpl_updateNullifierJam(0.016, player, []);
  assert.equal(player.hackwareJammed, false,
    'with no live NULLIFIERs, the flag must reset to false (no stale latch)');
});

test('BEHAVIOUR: multi-NULLIFIER scene — any live aura jams', () => {
  const player = { x: 5, y: 5, hackwareJammed: false };
  const farN = { x: 50, y: 50, type: 'NULLIFIER', dead: false, stunTimer: 0 };
  const nearN = { x: 6, y: 5, type: 'NULLIFIER', dead: false, stunTimer: 0 };
  reimpl_updateNullifierJam(0.016, player, [farN, nearN]);
  assert.equal(player.hackwareJammed, true,
    'any single in-range NULLIFIER must jam — multi-mob OR semantics');
});

test('BEHAVIOUR: stun + multiple NULLIFIERs — only unstunned in-range counts', () => {
  const player = { x: 5, y: 5, hackwareJammed: false };
  const stunned = { x: 6, y: 5, type: 'NULLIFIER', dead: false, stunTimer: 0.5 };
  reimpl_updateNullifierJam(0.016, player, [stunned]);
  assert.equal(player.hackwareJammed, false,
    'stun gate must hold even when adjacent — EMP_BURST defuses jam');
});

test('BEHAVIOUR: damage-immune player (dash i-frames / cloak) is NOT jammed (per opus r1)', () => {
  // Per claude-opus-4.7 r1: NULLIFIER must respect isPlayerDamageImmune
  // to match DISRUPTOR precedent. Dash-through and pre-cloak are
  // legitimate counterplay. Simulate immunity = true.
  const player = { x: 5, y: 5, hackwareJammed: false };
  const nullifier = { x: 6, y: 5, type: 'NULLIFIER', dead: false, stunTimer: 0 };
  reimpl_updateNullifierJam(0.016, player, [nullifier], /* isImmune */ true);
  assert.equal(player.hackwareJammed, false,
    'damage-immune player (dash/cloak) must not be jammed — matches DISRUPTOR precedent');
});

test('BEHAVIOUR: helper returns false for null player (defensive guard)', () => {
  // The helper accepts null/undefined and returns false rather than
  // throwing. Defends against any caller that might pass undefined
  // during load/init transitions.
  assert.equal(reimpl_isPlayerInNullifierAura(null, []), false,
    'null player must yield false (no throw)');
  assert.equal(reimpl_isPlayerInNullifierAura(undefined, []), false,
    'undefined player must yield false (no throw)');
});

// ─── 14. Render block (graceful — atk=0 mob still needs the visual) ────

test('NULLIFIER render block exists and reads _nlPulse + NULLIFIER_FIELD_R', () => {
  // The aura visual is the player's primary read of "this is the
  // anti-hackware mob". Without it, the mob is mechanically present
  // but visually identical to any other non-attacking mob — players
  // can't learn what it does. Pin the render branch.
  const block = ENTITIES_CODE.match(
    /this\.type\s*===\s*'NULLIFIER'[\s\S]{0,3000}?ctx\.restore\s*\(\s*\)\s*;\s*\n\s*\}/
  );
  assert.ok(block, 'NULLIFIER render block must exist');
  assert.match(block[0], /this\._nlPulse/,
    'render block must read this._nlPulse for visual time');
  assert.match(block[0], /NULLIFIER_FIELD_R/,
    'render block must read NULLIFIER_FIELD_R for aura ring radius');
  assert.ok(!hasDeadBranch(block[0]),
    'render block must not contain dead branches');
});
