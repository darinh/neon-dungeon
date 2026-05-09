'use strict';
// WATCHER mob — source-text wiring tests.
//
// entities.js is browser-only (no UMD/CommonJS exports), so we follow the
// same pattern as resonator.test.js / sapper.test.js: assert structural
// invariants the mob needs by regex-matching the source text. The pure
// `isInsideCone` helper that WATCHER shares with RESONATOR already has
// behavioural unit tests in resonator.test.js — we don't duplicate them.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
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
const PLATFORM = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'platform.js'), 'utf8'
);

// ─── Wiring assertions ──────────────────────────────────────────────────

test('WATCHER appears in ENEMY_WEIGHTS with floor 6+ gate', () => {
  // Per design (mid-late zoner — positioning puzzle), minFloor must be >= 6.
  // Earlier than that the player hasn't built enough movement vocabulary
  // to read a sweeping cone as a timing puzzle.
  const m = ENEMY_SPAWN_TABLE.match(/WATCHER:\s*\{\s*base:\s*\d+,\s*perFloor:\s*\d+,\s*minFloor:\s*(\d+)/);
  assert.ok(m, 'WATCHER must be registered in ENEMY_WEIGHTS');
  assert.ok(parseInt(m[1], 10) >= 6, `WATCHER minFloor should be >= 6, got ${m[1]}`);
});

test('WATCHER has a stat row in ENEMY_BASE_STATS and is stationary', () => {
  // Missing case → spawnEnemy returns an Enemy with hp=0, instantly dead.
  // The mob is stationary by design — spd MUST be 0 (if it could move
  // it would chase player into perfect cone alignment, removing the
  // positioning puzzle that defines the mechanic).
  const m = ENEMY_STATS.match(/WATCHER:\s*\{[^\n]*hp:\s*(\d+),[^\n]*atk:\s*(\d+),[^\n]*spd:\s*([\d.]+),[^\n]*xpVal:\s*(\d+)/);
  assert.ok(m, 'WATCHER stat row missing');
  assert.strictEqual(parseFloat(m[3]), 0, 'WATCHER must be stationary (spd=0)');
  assert.ok(parseInt(m[1], 10) >= 40, 'WATCHER HP feels too low');
  assert.ok(parseInt(m[2], 10) >= 8,  'WATCHER atk feels too low');
});

test('WATCHER spawn init block sets state + randomised initial sweep angle', () => {
  // _wState must start 'sweep' so the cone is immediately visible
  // (passive telegraph by design — never hidden). _wAng must be
  // randomised so a clustered spawn doesn't sweep in lock-step.
  const re = /if\s*\(type\s*===\s*'WATCHER'\)[\s\S]{0,800}_wState\s*=\s*'sweep'[\s\S]{0,400}_wAng\s*=/;
  assert.match(SPAWN_INITIALIZERS, re, 'WATCHER init must set _wState=sweep and randomised _wAng');
  // Stagger via seeded spawn RNG — otherwise a pack telegraphs together
  const initBlock = SPAWN_INITIALIZERS.match(/if\s*\(type\s*===\s*'WATCHER'\)[\s\S]{0,800}\}/);
  assert.ok(initBlock && /rand\('spawn'\)/.test(initBlock[0]),
    'WATCHER init must stagger _wAng via the seeded spawn RNG');
});

test('WATCHER spawn init zeroes telegraph + recovery timers', () => {
  // _wTele and _wRec must be initialised to 0 so the first fire only
  // commits after a real lock (not as a leftover from undefined state).
  const initBlock = SPAWN_INITIALIZERS.match(/if\s*\(type\s*===\s*'WATCHER'\)[\s\S]{0,800}\}/);
  assert.ok(initBlock, 'WATCHER init block missing');
  assert.match(initBlock[0], /_wTele\s*=\s*0/, 'WATCHER init must zero _wTele');
  assert.match(initBlock[0], /_wRec\s*=\s*0/, 'WATCHER init must zero _wRec');
  assert.match(initBlock[0], /_wLockAng\s*=\s*0/,
    'WATCHER init must zero _wLockAng so first telegraph reads a real lock');
});

test('WATCHER is excluded from the elite affix roll', () => {
  // Elite affixes (SHIELDED, BERSERKER, FRENZY, PHASING, ...) interact
  // poorly with the stationary cone mechanic and would push damage way
  // out of balance. Mirrors RESONATOR/MIRROR/GULPER exclusions.
  assert.match(ENEMY_CLASSIFICATION, /ELITE_EXCLUDED_TYPES[\s\S]*'WATCHER'[\s\S]*\]\s*\)/,
    'WATCHER must be in the elite-exclusion guard');
});

test('WATCHER is dispatched in the AI switch', () => {
  assert.match(ENTITIES, /case\s+'WATCHER':\s*this\.aiWatcher\(/);
});

test('aiWatcher method is defined with canonical AI signature', () => {
  assert.match(ENTITIES, /aiWatcher\s*\(\s*dt\s*,\s*player\s*,\s*map\s*,\s*d\s*,\s*los\s*\)\s*\{/);
});

test('WATCHER stun-cancel path drops telegraph to recovery', () => {
  // Stun must cancel the telegraph BEFORE it fires — otherwise the beam
  // discharges after the stun ends and the player cannot punish the stun.
  // We drop straight to recovery (not sweep) so the rhythm beats stay
  // honest — a stunned watcher still sits idle for WATCHER_RECOVERY.
  // Mirrors the RESONATOR/MIRROR/REAPER stun-cancel pattern.
  const re = /_wState\s*===\s*'telegraph'[\s\S]{0,300}_wState\s*=\s*'recovery'[\s\S]{0,200}_wRec\s*=/;
  assert.match(ENTITIES, re, 'stun handler must downgrade _wState to recovery');
});

test('WATCHER fire honors player damage immunity (dash i-frames)', () => {
  // Damage path goes through player.takeDamage which honors
  // isPlayerDamageImmune unless ignoreImmunity is set. Make sure the
  // WATCHER call site does NOT pass ignoreImmunity — otherwise dash
  // pass-through (the canonical counter-play) silently breaks.
  const sigRe = /^\s*aiWatcher\s*\(/m;
  const sigMatch = ENTITIES.match(sigRe);
  assert.ok(sigMatch);
  const aiStart = sigMatch.index || 0;
  const aiBody = ENTITIES.slice(aiStart, aiStart + 6000);
  const callMatch = aiBody.match(/player\.takeDamage\([^)]*\)/);
  assert.ok(callMatch, 'aiWatcher must call player.takeDamage');
  assert.ok(!/ignoreImmunity/.test(callMatch[0]),
    'aiWatcher damage call must not bypass dash i-frames');
});

test('WATCHER fire uses Watcher Beam source label', () => {
  // The damage-source label must be 'Watcher Beam' for HUD hit-feedback
  // (SOURCE_LABELS / SOURCE_COLOURS map this label to a display name
  // and colour). Verify the takeDamage call passes it.
  const sigRe = /^\s*aiWatcher\s*\(/m;
  const sigMatch = ENTITIES.match(sigRe);
  assert.ok(sigMatch);
  const aiStart = sigMatch.index || 0;
  const aiBody = ENTITIES.slice(aiStart, aiStart + 6000);
  assert.match(aiBody, /player\.takeDamage\([^,)]*,\s*'Watcher Beam'\s*\)/,
    'aiWatcher must label damage as Watcher Beam');
});

test('WATCHER fires via locked angle, not live sweep angle', () => {
  // The telegraph FREEZES the aim — fire must use _wLockAng (not _wAng).
  // If the source accidentally reads _wAng at fire time the player would
  // get hit by a "phantom" beam in a different direction than the visible
  // telegraph. Verify the fire-block hit-test consumes _wLockAng.
  const sigRe = /^\s*aiWatcher\s*\(/m;
  const sigMatch = ENTITIES.match(sigRe);
  assert.ok(sigMatch);
  const aiStart = sigMatch.index || 0;
  const aiBody = ENTITIES.slice(aiStart, aiStart + 6000);
  // Find the telegraph branch (between the 'telegraph' guard and its return).
  const telegraphBranch = aiBody.match(/_wState\s*===\s*'telegraph'[\s\S]*?\n\s{0,8}return;/);
  assert.ok(telegraphBranch, 'telegraph branch in aiWatcher not found');
  assert.match(telegraphBranch[0], /Math\.cos\(\s*this\._wLockAng\s*\)/,
    'fire must compute aim from _wLockAng');
  assert.ok(!/Math\.cos\(\s*this\._wAng\s*\)/.test(telegraphBranch[0]),
    'fire must NOT read live _wAng (telegraph freezes aim)');
});

test('WATCHER sweep advances _wAng at WATCHER_SWEEP_RATE per second', () => {
  // The defining mechanic — continuous rotation — must be present in
  // aiWatcher's sweep branch. Verify _wAng is incremented by dt *
  // WATCHER_SWEEP_RATE somewhere outside the telegraph/recovery
  // branches (which are the EARLY-RETURN guards above the sweep).
  const sigRe = /^\s*aiWatcher\s*\(/m;
  const sigMatch = ENTITIES.match(sigRe);
  assert.ok(sigMatch);
  const aiStart = sigMatch.index || 0;
  const aiBody = ENTITIES.slice(aiStart, aiStart + 6000);
  assert.match(aiBody,
    /this\._wAng\s*=[\s\S]{0,80}dt\s*\*\s*WATCHER_SWEEP_RATE/,
    'aiWatcher sweep branch must rotate _wAng by dt * WATCHER_SWEEP_RATE');
});

test('WATCHER sweep gates LOCK on inRoom + canTarget + range + cone + LOS', () => {
  // Compositional fairness — the lock must be gated by EVERY one of:
  //   inRoom (room-scoped engagement, mirrors RESONATOR/MIRROR)
  //   _canTarget() (taunt + cloak + decoy compatibility)
  //   range (squared compare against WATCHER_RANGE)
  //   isInsideCone (the cone arc itself)
  //   hasLOS (LOS rechecked at fire-time too — defense in depth)
  // Skipping any of these creates a class of "I can't see why I got hit"
  // bugs.
  const sigRe = /^\s*aiWatcher\s*\(/m;
  const sigMatch = ENTITIES.match(sigRe);
  assert.ok(sigMatch);
  const aiStart = sigMatch.index || 0;
  const aiBody = ENTITIES.slice(aiStart, aiStart + 6500);
  assert.ok(/inRoom/.test(aiBody), 'aiWatcher sweep must gate on inRoom');
  assert.ok(/this\._canTarget\(\)/.test(aiBody), 'aiWatcher sweep must gate on _canTarget');
  assert.ok(/WATCHER_RANGE\s*\*\s*WATCHER_RANGE/.test(aiBody),
    'aiWatcher sweep must use squared-distance range gate');
  assert.ok(/isInsideCone\(/.test(aiBody),
    'aiWatcher must use isInsideCone for the wedge hit-test');
  assert.ok(/hasLOS\(/.test(aiBody),
    'aiWatcher must use hasLOS for the LOS gate');
});

test('WATCHER lock-test uses taunt-aware _tx/_ty (hologram triggers lock)', () => {
  // Taunt contract: hologram decoys must be able to TRIGGER a watcher
  // lock — bait wasted shots is a counterplay vector. The sweep-branch
  // hit-test (range + cone + LOS) MUST consume this._tx/this._ty (the
  // canonical taunt-aware perceived target), NOT player.x/player.y
  // directly. Mismatched gates (inRoom on _tx/_ty + lock-test on
  // player.x/y) let a hologram inside the room redirect engagement onto
  // the real player even when the real player is outside the room.
  // Mirrors RESONATOR/MIRROR convention (both aim via _tx/_ty).
  const sigRe = /^\s*aiWatcher\s*\(/m;
  const sigMatch = ENTITIES.match(sigRe);
  assert.ok(sigMatch);
  const aiStart = sigMatch.index || 0;
  const aiBody = ENTITIES.slice(aiStart, aiStart + 6500);
  // Slice the SWEEP branch — everything after the recovery early-return.
  // It's the tail of aiWatcher; the sweep advance line anchors it.
  const sweepStart = aiBody.indexOf('this._wAng = (this._wAng');
  assert.ok(sweepStart >= 0, 'sweep advance not found in aiWatcher');
  const sweepBody = aiBody.slice(sweepStart, sweepStart + 1500);
  assert.match(sweepBody,
    /isInsideCone\(\s*this\._tx\s*,\s*this\._ty\s*,/,
    'sweep cone hit-test must consume this._tx/this._ty (perceived target)');
  assert.match(sweepBody,
    /hasLOS\(\s*this\.x\s*,\s*this\.y\s*,\s*this\._tx\s*,\s*this\._ty/,
    'sweep LOS check must use this._tx/this._ty (perceived target)');
  // Range-squared computation must subtract this._tx/this._ty (NOT player.x/y).
  assert.match(sweepBody,
    /this\._tx\s*-\s*this\.x[\s\S]{0,80}this\._ty\s*-\s*this\.y/,
    'sweep range computation must subtract perceived target coordinates');
  // Defensive: the sweep branch must NOT read player.x/player.y directly
  // (those reads belong only in the fire-time hit-test — keeps the
  // taunt contract clean).
  assert.ok(!/player\.x\s*-\s*this\.x/.test(sweepBody),
    'sweep branch must NOT compute distance from player.x — use _tx/_ty');
});

test('WATCHER lock transitions sweep -> telegraph and arms _wTele', () => {
  // The LOCK must set _wState='telegraph', cache _wLockAng from _wAng,
  // and arm _wTele = WATCHER_TELEGRAPH. Without arming the timer the
  // telegraph branch's countdown would underflow on first tick.
  const sigRe = /^\s*aiWatcher\s*\(/m;
  const sigMatch = ENTITIES.match(sigRe);
  assert.ok(sigMatch);
  const aiStart = sigMatch.index || 0;
  const aiBody = ENTITIES.slice(aiStart, aiStart + 6000);
  assert.match(aiBody, /this\._wLockAng\s*=\s*this\._wAng/,
    'lock must cache _wLockAng from current sweep _wAng');
  assert.match(aiBody, /this\._wState\s*=\s*'telegraph'/,
    'lock must transition to telegraph state');
  assert.match(aiBody, /this\._wTele\s*=\s*WATCHER_TELEGRAPH/,
    'lock must arm _wTele to full WATCHER_TELEGRAPH window');
});

test('WATCHER draw branch renders cone wedge across all states', () => {
  // The draw branch must guard on this.type === 'WATCHER' and render a
  // cone wedge (ctx.arc). Sweep state shows a faint always-visible cone
  // (passive rhythm telegraph), telegraph state shows an intensified
  // wedge, recovery shows a brief beam flash. All three branches share
  // ctx.arc geometry so the drawn shape stays in lock-step with the
  // hit-test. Source-of-truth for geometry: WATCHER_HALF_RAD +
  // WATCHER_RANGE * TILE.
  const draw = ENTITIES.match(/this\.type\s*===\s*'WATCHER'[\s\S]{0,4500}/);
  assert.ok(draw, 'WATCHER draw branch missing');
  const blob = draw[0];
  assert.ok(/WATCHER_HALF_RAD/.test(blob),
    'draw branch must use WATCHER_HALF_RAD for the cone half-angle');
  assert.ok(/WATCHER_RANGE\s*\*\s*TILE/.test(blob),
    'draw branch must use WATCHER_RANGE * TILE for the cone radius');
  assert.ok(/_wState\s*===\s*'telegraph'/.test(blob),
    'draw branch must have a telegraph branch');
  assert.ok(/ctx\.arc\(/.test(blob), 'draw branch must use ctx.arc for the wedge');
});

test('WATCHER draw uses live _wAng during sweep, locked angle during telegraph', () => {
  // The sweep state shows the cone at the LIVE rotating angle. Telegraph
  // freezes it. If draw read _wAng across all states the telegraphed
  // wedge would slowly rotate during the lock window — visually wrong
  // and unfair (the player would dodge the wrong direction).
  const draw = ENTITIES.match(/this\.type\s*===\s*'WATCHER'[\s\S]{0,4500}/);
  assert.ok(draw);
  const blob = draw[0];
  // The aim-angle resolution must depend on _wState (sweep vs anything else).
  assert.match(blob, /_wState\s*===\s*'sweep'/,
    'draw must branch aim-angle on sweep vs locked state');
  assert.match(blob, /this\._wAng[\s\S]{0,80}this\._wLockAng/,
    'draw must reference both _wAng (sweep) and _wLockAng (locked)');
});

test('WATCHER constants are defined with sane fairness values', () => {
  const sw = ENTITIES.match(/WATCHER_SWEEP_RATE\s*=\s*([\d.]+)/);
  const tg = ENTITIES.match(/WATCHER_TELEGRAPH\s*=\s*([\d.]+)/);
  const rc = ENTITIES.match(/WATCHER_RECOVERY\s*=\s*([\d.]+)/);
  const rg = ENTITIES.match(/WATCHER_RANGE\s*=\s*([\d.]+)/);
  const cd = ENTITIES.match(/WATCHER_CONE_DEG\s*=\s*([\d.]+)/);
  const dm = ENTITIES.match(/WATCHER_DMG_MUL\s*=\s*([\d.]+)/);
  assert.ok(sw && tg && rc && rg && cd && dm,
    'all six WATCHER_* tuning constants must be defined');
  // Telegraph fairness floor — anything under 0.5s reads as a one-shot.
  assert.ok(parseFloat(tg[1]) >= 0.5,
    `telegraph ${tg[1]} too short to be fair — at least 0.5s required`);
  // Recovery floor — gives the player a window to push damage.
  assert.ok(parseFloat(rc[1]) >= 0.5,
    `recovery ${rc[1]} too short — gives no punish window`);
  // Sweep rate sanity: between 0.1 and 2 rad/s (full rotation 3-63s).
  // Slower than 0.1 reads as static, faster than 2 is unreadable.
  const swRate = parseFloat(sw[1]);
  assert.ok(swRate >= 0.1 && swRate <= 2.0,
    `sweep rate ${swRate} rad/s outside readable range [0.1, 2.0]`);
  const deg = parseFloat(cd[1]);
  assert.ok(deg > 0 && deg <= 120,
    `cone ${deg}° outside sane range — narrow shot or lazy cleave`);
  const mul = parseFloat(dm[1]);
  assert.ok(mul > 0 && mul <= 1.5,
    `dmg mul ${mul} outside sane range`);
  const range = parseFloat(rg[1]);
  assert.ok(range >= 4 && range <= 14,
    `range ${range} tiles outside playable spectrum`);
});

test('WATCHER_HALF_RAD is precomputed from WATCHER_CONE_DEG', () => {
  // Single source of truth — if CONE_DEG is tweaked in tuning, HALF_RAD
  // must follow. Verify the derivation expression is in the source so
  // the two can't drift to different values across edits.
  assert.match(ENTITIES,
    /WATCHER_HALF_RAD\s*=\s*\(\s*WATCHER_CONE_DEG\s*\*\s*0\.5\s*\)\s*\*\s*Math\.PI\s*\/\s*180/,
    'WATCHER_HALF_RAD must be derived from WATCHER_CONE_DEG');
});

test('WATCHER appears in CREDIT_VALUES, SOURCE_LABELS, SOURCE_COLOURS', () => {
  assert.match(SOURCE_METADATA, /WATCHER:\s*\d+/);             // CREDIT_VALUES row
  assert.match(SOURCE_METADATA, /WATCHER:\s*'Watcher'/);       // SOURCE_LABELS
  assert.match(SOURCE_METADATA, /WATCHER:\s*'#ffee66'/);       // SOURCE_COLOURS
  assert.match(SOURCE_METADATA, /'Watcher Beam':\s*'Watcher Beam'/); // damage source label
  assert.match(SOURCE_METADATA, /'Watcher Beam':\s*'#ffee66'/);      // damage source colour
});

test('WATCHER class fields are declared on Enemy with @type any annotations', () => {
  // The Enemy class top declares all dynamic instance fields with
  // /** @type {any} */ — without these, ts-check flags
  // "Object is possibly 'undefined'" on every reference. Verify each
  // WATCHER state field has its declaration.
  for (const field of ['_wState', '_wAng', '_wLockAng', '_wTele', '_wRec', '_wFired']) {
    const re = new RegExp(`@type \\{any\\} \\*/ ${field};`);
    assert.match(ENTITIES, re, `field ${field} must have an @type {any} declaration`);
  }
});

test('WATCHER stun-cancel clears _wFired so render skips phantom beam flash', () => {
  // Regression test for a 3-reviewer-found bug: the stun handler enters
  // recovery with _wRec=full, and the render branch's beam-flash gate
  // would falsely trigger ("beam fired" line shown for a beam that was
  // cancelled by stun, no damage dealt). The fix gates the flash on a
  // separate _wFired flag, set only when a real beam commits.
  // Verify the stun-cancel path explicitly clears (or sets false) _wFired.
  const stunRe = /_wState\s*===\s*'telegraph'[\s\S]{0,400}_wState\s*=\s*'recovery'[\s\S]{0,300}_wFired\s*=\s*false/;
  assert.match(ENTITIES, stunRe,
    'stun-cancel path must clear _wFired so render skips the phantom beam flash');
});

test('WATCHER fire branch sets _wFired=true so beam flash renders for real shots', () => {
  // Counterpart to the stun-cancel test — a REAL beam fire MUST set
  // _wFired=true so the render branch shows the "this is the angle that
  // hit you" feedback flash. Without this, the render gate (now
  // _wFired-gated) would suppress the flash for legitimate fires too.
  const sigRe = /^\s*aiWatcher\s*\(/m;
  const sigMatch = ENTITIES.match(sigRe);
  assert.ok(sigMatch);
  const aiStart = sigMatch.index || 0;
  const aiBody = ENTITIES.slice(aiStart, aiStart + 6000);
  // Find the telegraph-fire branch and assert _wFired = true is set
  // alongside the recovery transition.
  const fireBranch = aiBody.match(/_wTele\s*<=\s*0[\s\S]*?_wFired\s*=\s*true/);
  assert.ok(fireBranch,
    'fire-on-telegraph-expire must set _wFired=true so flash renders for real shots');
});

test('WATCHER render beam flash is gated on _wFired, not just _wRec timer', () => {
  // Direct contract test: the render branch's flash gate must include
  // _wFired so a stunned/cancelled recovery (which has _wRec=full and
  // _wFired=false) doesn't render a phantom beam line.
  const draw = ENTITIES.match(/this\.type\s*===\s*'WATCHER'[\s\S]{0,4500}/);
  assert.ok(draw, 'WATCHER draw branch missing');
  const blob = draw[0];
  // The flash gate must AND _wFired into the recovery+timer condition.
  assert.match(blob,
    /_wState\s*===\s*'recovery'[\s\S]{0,80}_wFired[\s\S]{0,80}_wRec\s*>\s*WATCHER_RECOVERY/,
    'beam-flash gate must include _wFired so cancelled telegraphs skip the flash');
});

test('WATCHER recovery sweep-resume clears _wFired so flash re-arms cleanly', () => {
  // After recovery completes naturally (timer hits 0), state returns to
  // 'sweep' and _wFired must be cleared so the NEXT lock+telegraph+fire
  // cycle starts with _wFired=false. Without this, the second beam in
  // the same WATCHER's lifetime would inherit a stale _wFired=true
  // (harmless mid-fire, but a code-smell for future contributors).
  const sigRe = /^\s*aiWatcher\s*\(/m;
  const sigMatch = ENTITIES.match(sigRe);
  assert.ok(sigMatch);
  const aiStart = sigMatch.index || 0;
  const aiBody = ENTITIES.slice(aiStart, aiStart + 6000);
  const recoveryToSweep = aiBody.match(/_wState\s*=\s*'sweep'[\s\S]{0,200}_wFired\s*=\s*false/);
  assert.ok(recoveryToSweep,
    'recovery-to-sweep transition must clear _wFired');
});

// ─── Bespoke audio wiring ────────────────────────────────────────────────
// WATCHER originally piggybacked on audio.resonatorCharge / audio.resonatorFire
// as a v1 placeholder. The two mobs now have distinct lock-on / fire SFX so
// the player can disambiguate them by ear in a room containing both
// (RESONATOR floor 6+, WATCHER floor 6+ — they co-occur). These tests pin:
//   1. platform.js exposes audio.watcherCharge() and audio.watcherFire().
//   2. aiWatcher calls them (and does NOT call the resonator equivalents).
// Cross-file desync defence per stored memory 'HUD status fx' / similar:
// without this test, a future refactor of the audio object could rename or
// drop these methods and the WATCHER would silently fall back to the
// `if (audio.watcherCharge) audio.watcherCharge();` no-op guard.

test('platform.js exposes audio.watcherCharge and audio.watcherFire', () => {
  assert.match(PLATFORM, /watcherCharge\s*\(\s*\)\s*\{/,
    'platform.js audio object must define watcherCharge() method');
  assert.match(PLATFORM, /watcherFire\s*\(\s*\)\s*\{/,
    'platform.js audio object must define watcherFire() method');
});

test('aiWatcher uses bespoke watcher SFX, not resonator placeholder SFX', () => {
  // Scope the assertion to the FULL aiWatcher method body (signature →
  // next `aiX(` method signature, exclusive). The 6000-char window other
  // tests in this file use is sufficient for matching positive patterns
  // near the start of the method, but `doesNotMatch` requires the FULL
  // body — a stale resonator call near the end of aiWatcher would
  // false-pass otherwise (per gpt-5.3-codex review of this PR).
  const sigRe = /^\s*aiWatcher\s*\(/m;
  const sigMatch = ENTITIES.match(sigRe);
  assert.ok(sigMatch, 'aiWatcher signature not found');
  const aiStart = sigMatch.index || 0;
  // Find the next method-ish signature in the same class to bound the slice.
  // Pattern: optional whitespace, an identifier starting with `ai` followed
  // by an upper-case letter (e.g. aiMirror, aiResonator, aiPhantom), then
  // `(`. Anchored AFTER aiStart so we skip aiWatcher's own signature.
  const nextSigRe = /^\s*ai[A-Z]\w*\s*\(/m;
  const tail = ENTITIES.slice(aiStart + sigMatch[0].length);
  const nextMatch = tail.match(nextSigRe);
  assert.ok(nextMatch,
    'no following ai*(...) method found after aiWatcher — extraction anchor regression?');
  const aiBody = tail.slice(0, nextMatch.index);
  // Sanity: extracted body should contain telltale aiWatcher symbols.
  assert.match(aiBody, /_wState/,
    'extracted aiWatcher body must contain _wState — extraction anchor regression?');

  // Must call the bespoke watcher methods.
  assert.match(aiBody, /audio\.watcherCharge\s*\(/,
    'aiWatcher must call audio.watcherCharge() at the lock/telegraph site');
  assert.match(aiBody, /audio\.watcherFire\s*\(/,
    'aiWatcher must call audio.watcherFire() at the fire site');

  // Must NOT fall back to the resonator placeholder methods.
  assert.doesNotMatch(aiBody, /audio\.resonatorCharge\s*\(/,
    'aiWatcher must NOT call audio.resonatorCharge — the v1 placeholder was replaced by the bespoke watcherCharge SFX. Cross-mob audio coupling masks per-mob threat ID.');
  assert.doesNotMatch(aiBody, /audio\.resonatorFire\s*\(/,
    'aiWatcher must NOT call audio.resonatorFire — the v1 placeholder was replaced by the bespoke watcherFire SFX. Cross-mob audio coupling masks per-mob threat ID.');
});
