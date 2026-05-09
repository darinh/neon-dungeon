'use strict';
// GULPER mob — wiring tests for the projectile-eating mid-tank.
//
// GULPER is a slow chaser (spd=1.4) with a forward-facing mouth-cone
// that EATS player projectiles passing through it (destroys, no damage,
// +1 stack). At GULPER_MAX_STACKS it telegraphs and SPITS a fat slow
// projectile at the player. Counter-play: shoot from behind/sides
// (cone is directional), melee, burst-kill before max stacks, stun
// cancels the belch and clears stacks.
//
// These tests assert the WIRING (registration, stats, dispatch, elite
// exclusion, sw cache bump, stun-cancel contract, audio cues) rather
// than fully simulating the game loop — same pattern as
// vaultmaster.test.js / tether.test.js / shock-pulse.test.js.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const ENTITIES = fs.readFileSync(path.join(ROOT, 'src', 'entities.js'), 'utf8');
const ENEMY_SPAWN_TABLE = fs.readFileSync(path.join(ROOT, 'src', 'entities', 'spawn-table.js'), 'utf8');
const SOURCE_METADATA = fs.readFileSync(path.join(ROOT, 'src', 'entities', 'source-metadata.js'), 'utf8');
const PLATFORM = fs.readFileSync(path.join(ROOT, 'src', 'platform.js'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

test('GULPER appears in ENEMY_WEIGHTS with floor 6+ gate', () => {
  // Floor 6 matches MAGNETON (the closest cousin — both are
  // projectile-interference compositional mobs). Earlier floors don't
  // give the player enough projectile-spam habit to read "shots vanish
  // here" as a learnable pattern.
  const m = ENEMY_SPAWN_TABLE.match(/GULPER:\s*\{\s*base:\s*\d+,\s*perFloor:\s*\d+,\s*minFloor:\s*(\d+)/);
  assert.ok(m, 'GULPER must be registered in ENEMY_WEIGHTS');
  assert.ok(parseInt(m[1], 10) >= 6,
    `GULPER minFloor should be >= 6, got ${m[1]}`);
});

test('GULPER has a stat row in spawnEnemy switch with chartreuse colour', () => {
  // hp=90 (mid-tank, not glass), atk=14 (chunky melee + base belch dmg),
  // spd=1.4 (slow walker — counter-play is to disengage), xpVal=28.
  const m = ENTITIES.match(/case\s+'GULPER':[^\n]*hp\s*=\s*(\d+)[^\n]*atk\s*=\s*(\d+)[^\n]*spd\s*=\s*([\d.]+)[^\n]*xpVal\s*=\s*(\d+)[^\n]*colour\s*=\s*'(#[0-9a-f]+)'/);
  assert.ok(m, 'GULPER stat row missing in spawnEnemy switch');
  const hp = parseInt(m[1], 10);
  const atk = parseInt(m[2], 10);
  const spd = parseFloat(m[3]);
  const xp = parseInt(m[4], 10);
  const colour = m[5];
  assert.ok(hp >= 60 && hp <= 130,
    `GULPER hp should be mid-tank (60-130), got ${hp}`);
  assert.ok(atk >= 8 && atk <= 20,
    `GULPER atk should be moderate (8-20), got ${atk}`);
  assert.ok(spd > 0 && spd <= 2.0,
    `GULPER spd should be slow walker (0,2.0], got ${spd}`);
  assert.ok(xp >= 15 && xp <= 40,
    `GULPER xpVal should match its threat (15-40), got ${xp}`);
  assert.ok(colour && colour.length === 7,
    `GULPER must declare a hex colour, got ${colour}`);
});

test('GULPER tuning constants are declared at module scope', () => {
  // Single source of truth for cone geometry, stack threshold, belch
  // timing, and damage scaling. Any draw branch should consume these
  // (telegraph/commit parity rule — see stored memory).
  const constNames = [
    'GULPER_MOUTH_RANGE',
    'GULPER_MOUTH_HALF_ANGLE',
    'GULPER_MAX_STACKS',
    'GULPER_FACE_LERP',
    'GULPER_BELCH_TELEGRAPH',
    'GULPER_BELCH_RECOVERY',
    'GULPER_BELCH_SPD',
    'GULPER_BELCH_RANGE',
    'GULPER_BELCH_DMG_PER_STACK',
  ];
  for (const c of constNames) {
    assert.match(ENTITIES, new RegExp(`const\\s+${c}\\s*=`),
      `tuning constant ${c} must be declared at module scope`);
  }
});

test('GULPER is excluded from elite affix roll', () => {
  // First-ship caution: easier to add elite affixes later than to
  // reason about SHIELDED + projectile-eat or PHASING + belch state.
  assert.match(ENTITIES,
    /type\s*!==\s*'GULPER'\s*&&[\s\S]{0,400}floorNum\s*>=\s*3/,
    'elite-skip list must include GULPER before the floorNum gate');
});

test('GULPER has an AI dispatch case calling aiGulper', () => {
  assert.match(ENTITIES,
    /case\s+'GULPER'\s*:\s*this\.aiGulper\s*\(/,
    'aiDispatch switch must route GULPER to aiGulper');
});

test('aiGulper method exists and uses the canonical ai-method shape', () => {
  assert.match(ENTITIES, /aiGulper\s*\([^\)]*\)\s*\{/, 'aiGulper method must exist');
  const fn = ENTITIES.match(/aiGulper\s*\([^\)]*\)\s*\{[\s\S]*?^\s\s\}/m);
  assert.ok(fn, 'aiGulper body must be extractable');
  // Must use isInsideCone for mouth-cone test (REUSING existing helper
  // rather than re-implementing geometry — single source of truth).
  assert.match(fn[0], /isInsideCone\s*\(/,
    'aiGulper must reuse isInsideCone helper for mouth-cone geometry');
  // Must consume MAGNETON-equivalent fairness exclusions on player
  // projectiles: skip non-player, dead, grenade, homing.
  assert.match(fn[0], /fromPlayer/,
    'aiGulper must filter to player projectiles only');
  assert.match(fn[0], /isGrenade/,
    'aiGulper must skip grenades (fairness — explicit landing tile)');
  assert.match(fn[0], /\.homing/,
    'aiGulper must skip homing player projectiles (fairness — re-steers post-AI)');
  // Must LOS-gate the eat (no eating shots through walls).
  assert.match(fn[0], /hasLOS\s*\(/,
    'aiGulper must LOS-gate the projectile eat');
  // Must use fireAt for the belch (uniform enemy projectile path).
  assert.match(fn[0], /fireAt\s*\(/,
    'aiGulper must use fireAt for the belch projectile');
  // Must emit audio cues via try/catch defensive wrap (test-stub safe).
  assert.match(fn[0], /audio\.gulperBelch/,
    'aiGulper must trigger gulperBelch audio cue');
  assert.match(fn[0], /audio\.gulperCharge/,
    'aiGulper must trigger gulperCharge audio cue');
});

test('aiGulper aims via taunt-aware _tx/_ty (not raw player.x/y)', () => {
  // Per stored memory 'taunt-aware distance in AI': mob AI must aim
  // via _tx/_ty (which point at DECOY hologram during taunt) rather
  // than player.x/player.y. Adversarial review (gpt-5.5) led to a
  // direction-LOCK: the smooth-lerp tracks _tx/_ty during chase, then
  // the locked _glAimAngle is consumed by the belch. So taunt-
  // awareness flows: _tx/_ty → _glAimAngle (chase) → aimDx/aimDy →
  // belch direction. Test asserts the smooth-lerp source IS _tx/_ty.
  const fn = ENTITIES.match(/aiGulper\s*\([^\)]*\)\s*\{[\s\S]*?^\s\s\}/m);
  assert.ok(fn, 'aiGulper body must be extractable');
  assert.match(fn[0], /Math\.atan2\(\s*this\._ty\s*-\s*this\.y\s*,\s*this\._tx\s*-\s*this\.x\s*\)/,
    'aiGulper smooth-lerp must source target angle from _tx/_ty (taunt-aware)');
  // Belch must NOT use raw player.x/player.y — the locked aim already
  // captured the taunt-aware direction at charge start.
  assert.doesNotMatch(fn[0], /fireAt\s*\([^)]*player\.x[^)]*player\.y/,
    'aiGulper.fireAt must NOT bypass taunt by using raw player.x/y');
});

test('GULPER stun-cancel block clears state, timers, AND stacks unconditionally', () => {
  // Stun MUST defuse the gulper completely: drop charging/recovery to
  // chase, clear charge + recover timers, AND zero stacks. Stacks are
  // erased (unlike VENGEANCE charges) because the mouth-cone hasn't
  // committed yet — mirrors echoer/prophet/cryophage stun-cancel
  // contract.
  //
  // The defuse runs UNCONDITIONALLY for any GULPER (no _glState
  // gate) — a saturated chase-state gulper that hasn't entered
  // charging yet (e.g., LOS just broke) must also lose stacks on
  // stun, otherwise stun fails to defuse a primed mob. Caught by
  // round-2 codex review.
  const stunBlock = ENTITIES.match(/if \(this\.stunTimer > 0\)\s*\{[\s\S]*?if \(this\.type === 'GULPER'\)\s*\{[\s\S]*?\}/);
  assert.ok(stunBlock, 'GULPER stun-cancel block must exist inside the stunTimer>0 branch');
  assert.match(stunBlock[0], /this\._glState\s*=\s*'chase'/,
    'stun must reset _glState to chase');
  assert.match(stunBlock[0], /this\._glChargeTimer\s*=\s*0/,
    'stun must clear _glChargeTimer');
  assert.match(stunBlock[0], /this\._glRecoverTimer\s*=\s*0/,
    'stun must clear _glRecoverTimer');
  assert.match(stunBlock[0], /this\._glStacks\s*=\s*0/,
    'stun must clear _glStacks (full defuse, distinct from VENGEANCE)');
  // Anti-regression: the GULPER stun guard must NOT be conditioned on
  // _glState !== 'chase' — that gate let saturated chase-state gulpers
  // survive stun with full stacks.
  assert.doesNotMatch(stunBlock[0],
    /this\.type === 'GULPER'\s*&&[^{]*_glState\s*!==\s*'chase'/,
    'GULPER stun guard must NOT exclude chase state (round-2 fix)');
});

test('GULPER per-instance fields initialised in spawnEnemy', () => {
  // _glState ('chase'|'charging'|'recovery'), _glStacks (0..MAX),
  // _glChargeTimer, _glRecoverTimer, _glAimAngle, _glPulse all need
  // sensible starting values.
  const initBlock = ENTITIES.match(/if \(type==='GULPER'\)\s*\{[\s\S]*?\n  \}/);
  assert.ok(initBlock, 'GULPER per-instance init block must exist in spawnEnemy');
  assert.match(initBlock[0], /_glState\s*=\s*'chase'/,
    'GULPER must spawn in chase state');
  assert.match(initBlock[0], /_glStacks\s*=\s*0/,
    'GULPER must spawn with 0 stacks');
  assert.match(initBlock[0], /_glChargeTimer\s*=\s*0/,
    '_glChargeTimer must initialise to 0');
  assert.match(initBlock[0], /_glRecoverTimer\s*=\s*0/,
    '_glRecoverTimer must initialise to 0');
  assert.match(initBlock[0], /_glAimAngle/,
    '_glAimAngle must initialise (otherwise NaN propagates into draw)');
  assert.match(initBlock[0], /_glPulse/,
    '_glPulse must initialise (cosmetic drift to break clustered lock-step)');
});

test('GULPER appears in CREDIT_VALUES, SOURCE_LABELS, SOURCE_COLOURS', () => {
  // CREDIT_VALUES drives the per-kill credit reward (currency drop).
  // SOURCE_LABELS / SOURCE_COLOURS drive damage-attribution UI (the
  // "Killed by Gulper" log line + colour). Belch projectile is
  // ownerType='GULPER' via fireAt → must resolve in both maps.
  assert.match(SOURCE_METADATA, /GULPER:\s*\d+/,
    'CREDIT_VALUES must include GULPER');
  assert.match(SOURCE_METADATA, /GULPER:'Gulper'/,
    'SOURCE_LABELS must include GULPER');
  assert.match(SOURCE_METADATA, /GULPER:'#[0-9a-f]{6}'/,
    'SOURCE_COLOURS must include GULPER');
});

test('audio.gulperCharge and audio.gulperBelch cues are defined in platform.js', () => {
  // Distinct cues (charge = wet ascending swallow, belch = wet plosive
  // burst). Both MUST be defined in the audio map so the try/wrap
  // calls in aiGulper actually fire in production (browser path).
  assert.match(PLATFORM, /gulperCharge\s*\(\s*\)\s*\{/,
    'audio.gulperCharge cue must be defined in platform.js');
  assert.match(PLATFORM, /gulperBelch\s*\(\s*\)\s*\{/,
    'audio.gulperBelch cue must be defined in platform.js');
});

test('GULPER draw branch uses smooth-lerped aim and consumes tuning constants', () => {
  // Telegraph/commit parity: the draw branch MUST consume the same
  // tuning constants as the gameplay (GULPER_MOUTH_RANGE +
  // GULPER_MOUTH_HALF_ANGLE) so balance tweaks stay in lock-step.
  // Anti-regression for the 'draw cutoff parity' stored memory and
  // the 'telegraph commit parity' stored memory.
  const drawBranch = ENTITIES.match(/this\.type === 'GULPER'[\s\S]*?ctx\.restore\(\);\s*\}/);
  assert.ok(drawBranch, 'GULPER draw branch must exist');
  assert.match(drawBranch[0], /GULPER_MOUTH_RANGE/,
    'draw branch must use GULPER_MOUTH_RANGE (same source of truth as AI)');
  assert.match(drawBranch[0], /GULPER_MOUTH_HALF_ANGLE/,
    'draw branch must use GULPER_MOUTH_HALF_ANGLE (same source of truth as AI)');
  assert.match(drawBranch[0], /_glAimAngle/,
    'draw branch must use the smooth-lerped aim angle (consistent with AI)');
});

test('GULPER stacks are hard-capped at MAX (no hidden over-cap damage)', () => {
  // Adversarial review (gpt-5.5 + opus): the original implementation
  // allowed stacks to grow to MAX+4 during charging while the draw
  // clamped display at MAX, hiding ~47% extra damage from the player.
  // Fix: gameplay caps eat at MAX. This test asserts the cap matches
  // the visual ceiling so future refactors can't reintroduce the gap.
  const fn = ENTITIES.match(/aiGulper\s*\([^\)]*\)\s*\{[\s\S]*?^\s\s\}/m);
  assert.ok(fn, 'aiGulper body must be extractable');
  // The stack-increment line must use Math.min(GULPER_MAX_STACKS, ...)
  // — NOT GULPER_MAX_STACKS + N or any other ceiling.
  assert.match(fn[0],
    /this\._glStacks\s*=\s*Math\.min\(\s*GULPER_MAX_STACKS\s*,\s*this\._glStacks\s*\+\s*1\s*\)/,
    'stack increment must hard-cap at GULPER_MAX_STACKS');
  // Eat must also early-exit at saturation (no point iterating more
  // projectiles when full — minor perf, but the structural intent is
  // visible).
  assert.match(fn[0], /this\._glStacks\s*<\s*GULPER_MAX_STACKS/,
    'eat loop must early-skip when already at MAX');
});

test('GULPER eat is gated to chase state only (no eating during charge/recovery)', () => {
  // Adversarial review (codex + gpt-5.5): original eat ran in chase
  // AND charging, but draw rendered "active" cone in all states. Fix:
  // eat only during chase. Cone draws differently per state so the
  // player can read "no eating right now" during charge/recovery.
  const fn = ENTITIES.match(/aiGulper\s*\([^\)]*\)\s*\{[\s\S]*?^\s\s\}/m);
  assert.ok(fn, 'aiGulper body must be extractable');
  assert.match(fn[0], /this\._glState\s*===\s*'chase'\s*&&\s*this\._glStacks\s*<\s*GULPER_MAX_STACKS/,
    'eat must be gated on chase + not-saturated (gameplay/draw parity)');
});

test('GULPER belch fires along LOCKED _glAimAngle (telegraph/commit parity)', () => {
  // Adversarial review (gpt-5.5): original code fired belch toward
  // _tx/_ty (player position at fire-time) but the cone telegraph used
  // _glAimAngle (smooth-lerped, locked during charge). Mid-strafe
  // divergence let the player see one direction but get hit from
  // another. Fix: AI keeps _glAimAngle STATIC during charging, fireAt
  // uses (this.x + aimDx, this.y + aimDy) so fireAt's normalisation
  // produces the locked unit vector exactly. Test asserts:
  //   (a) fireAt is called with this.x + aimDx, this.y + aimDy
  //   (b) the smooth-lerp branch is gated on _glState === 'chase'
  //       so the aim is FROZEN once charging begins
  const fn = ENTITIES.match(/aiGulper\s*\([^\)]*\)\s*\{[\s\S]*?^\s\s\}/m);
  assert.ok(fn, 'aiGulper body must be extractable');
  assert.match(fn[0],
    /fireAt\s*\(\s*tx\s*,\s*ty\s*,/,
    'belch must use locked tx/ty derived from aimDx/aimDy');
  assert.match(fn[0],
    /const tx\s*=\s*this\.x\s*\+\s*aimDx[\s\S]*?const ty\s*=\s*this\.y\s*\+\s*aimDy/,
    'belch target point must be 1 tile out along locked aim direction');
  assert.match(fn[0],
    /if \(this\._glState === 'chase'\)\s*\{[\s\S]*?_glAimAngle\s*\+=/,
    'smooth-lerp must be gated on chase state (frozen during charge for parity)');
});

test('GULPER draw branch differentiates chase / charging / recovery / stunned states', () => {
  // Adversarial review (codex): original draw rendered the same
  // "active" cone in all states, falsely telegraphing eat-on during
  // recovery + stun (which had eat OFF). Fix: draw colour and alpha
  // shift by state so the player can read which states actually eat.
  // The wedgeColour ternary chain encodes this contract: recovery →
  // grey, charging → red, chase → chartreuse.
  // Match the GULPER DRAW branch specifically (not the stun-cancel
  // block which also begins with `this.type === 'GULPER'`). Anchor on
  // `ctx.save()` opening the draw paint immediately after the predicate.
  const drawBranch = ENTITIES.match(/this\.type === 'GULPER'\)\s*\{\s*ctx\.save\(\);[\s\S]*?ctx\.restore\(\);\s*\}/);
  assert.ok(drawBranch, 'GULPER draw branch must exist');
  assert.match(drawBranch[0], /this\._glState === 'charging'/,
    'draw must read charging state from _glState');
  assert.match(drawBranch[0], /this\._glState === 'recovery'/,
    'draw must read recovery state from _glState');
  // Stunned mobs must visually defuse (matches the stun-cancel block
  // that clears _glState anyway, but defensive: stunTimer might tick
  // into a frame where stun-cancel hasn't run yet).
  assert.match(drawBranch[0], /this\.stunTimer/,
    'draw must check stunTimer for visual defuse');
  // Wedge colour must vary by state (recovery uses spent grey).
  assert.match(drawBranch[0], /'#666666'/,
    'recovery state must render with spent-grey wedge colour');
});

test('sw.js cache freshness does not use a second numeric version', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /const\s+CACHE\s*=\s*'neon-dungeon-assets'/);
});
