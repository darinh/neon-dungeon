'use strict';
// Boss intro telegraph — atmospheric overlay (radial vignette in the boss
// colour + boss-name titlecard + low-frequency audio sting) that fires for
// BOSS_INTRO_DURATION seconds when the player first crosses the threshold
// of a boss room (i.e. when bossSealed flips false → true). Gameplay is
// NOT paused — the intro is purely cosmetic and runs in parallel with
// normal play.
//
// game.js / render.js / platform.js are all browser-coupled (no UMD
// exports), so we can't exercise the runtime state machine under
// node:test. Instead these tests assert the structural invariants any
// working implementation must satisfy. Pattern matches the canonical
// hackware test scaffold (extractBlock, hasDeadBranch, sliceBetween)
// from tests/time-dilation-hackware.test.js — same defensive helpers
// against the bypass-class menagerie those reviews surfaced.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const GAME = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8'
);
const RENDER = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'render.js'), 'utf8'
);
const PLATFORM = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'platform.js'), 'utf8'
);
const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);
const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
);
const CONTENT_STATUS = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content', 'status.js'), 'utf8'
);

/** @param {string} src */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const GAME_NC = stripComments(GAME);
const RENDER_NC = stripComments(RENDER);
const PLATFORM_NC = stripComments(PLATFORM);
const ENTITIES_NC = stripComments(ENTITIES);
const CONTENT_NC = stripComments(CONTENT);
const CONTENT_STATUS_NC = stripComments(CONTENT_STATUS);

// Brace-balanced extraction. Returns the FIRST block opened by openerRe.
// Naive depth counter — does NOT understand string/regex literals. The
// boss-intro code paths have no braces inside string literals, so this is
// safe; if a future addition lands a string with braces, extractBlock
// returns null and the assert.ok guards at every call site fail loudly.
/**
 * @param {string} src
 * @param {RegExp} openerRe
 */
function extractBlock(src, openerRe) {
  const i = src.search(openerRe);
  if (i < 0) return null;
  const open = src.indexOf('{', i);
  if (open < 0) return null;
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    const ch = src[j];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(i, j + 1);
    }
  }
  return null;
}

// Detect compile-time-falsy `if` openers that wrap canonical regex-
// satisfying code in unreachable branches, AND compile-time-true openers
// before early-exit (continue/return/break). Hardened against:
// - bare literal openers (false, 0, null, undefined, NaN, void 0)
// - negation forms (!true, !1, !'', !"")
// - coercion wrappers (Boolean(0), Number(0), String(''))
// - composite tails (... && false, ... || true) inside multiline if heads
// - nullish-coalesce to falsy (... ?? false)
// - ternary-to-literal (... ? true : false / ... ? false : true)
// Mirrors the canonical hasDeadBranch from tests/time-dilation-hackware.test.js
// — it's the latest hardened version and supersedes earlier scaffolds.
/** @param {string} slice */
function hasDeadBranch(slice) {
  if (/\bif\s*\(\s*(?:!\s*true|!\s*1|!\s*'[^']*'|!\s*"[^"]*"|false|0|void\s+0|null|undefined|NaN|\!Boolean\(0\)|0\s*===\s*1|1\s*>\s*2|1\s*===\s*0|Boolean\(\s*(?:false|0|null|undefined|NaN|''|"")\s*\)|Number\(\s*0\s*\)|String\(\s*(?:''|"")\s*\))\s*\)\s*\{/.test(slice)) return true;
  if (/\bif\s*\(\s*(?:true|1|'[^']*'|"[^"]*"|Boolean\(1\)|1\s*<\s*2|0\s*<\s*1|2\s*>\s*1|1\s*===\s*1|0\s*===\s*0|!\s*false|!\s*0)\s*\)\s*(?:\{|continue|return|break)/.test(slice)) return true;
  if (/\bif\s*\([\s\S]*?\b(?:&&\s*(?:false|0|null|undefined|NaN|void\s+0)|\|\|\s*(?:true|1|Boolean\(1\)))\s*\)/.test(slice)) return true;
  if (/\bif\s*\([\s\S]*?\?\?\s*(?:false|0|null|undefined|NaN)\s*\)/.test(slice)) return true;
  if (/\bif\s*\([\s\S]*?\?\s*(?:true|1)\s*:\s*(?:false|0)\s*\)/.test(slice)) return true;
  if (/\bif\s*\([\s\S]*?\?\s*(?:false|0)\s*:\s*(?:true|1)\s*\)/.test(slice)) return true;
  return false;
}

// ─── Constant ────────────────────────────────────────────────────────────────

test('BOSS_INTRO_DURATION constant is declared in game.js as a finite positive number ≤ 5s', () => {
  // Pin the LITERAL declaration with a captured value, then verify the
  // captured value parses to a sensible duration. End-anchored `;` rules
  // out trailing arithmetic mutations like `... * 0` / `... * 1e9`.
  const m = GAME_NC.match(/\bconst\s+BOSS_INTRO_DURATION\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*;/);
  assert.ok(m, 'BOSS_INTRO_DURATION must be declared as `const BOSS_INTRO_DURATION = <number>;` in game.js');
  const v = Number(m[1]);
  assert.ok(Number.isFinite(v) && v > 0 && v <= 5,
    `BOSS_INTRO_DURATION must be a finite positive number ≤ 5s (got ${v})`);
});

// ─── State fields on game ────────────────────────────────────────────────────

test('game state object declares bossIntroTimer and bossIntroDuration with literal-zero defaults', () => {
  // Pin BOTH initialisation sites: the object-literal default AND the
  // descend reset. Any future contributor who adds a new field MUST
  // initialise it in both places (the existing pattern for every other
  // boss field — bossSealed, bossAlive, bossBarAnim, bossHpGhost).
  assert.ok(/\bbossIntroTimer:\s*0,/.test(GAME_NC),
    'game state literal must initialise bossIntroTimer: 0,');
  assert.ok(/\bbossIntroDuration:\s*0,/.test(GAME_NC),
    'game state literal must initialise bossIntroDuration: 0,');
});

test('descend reset clears bossIntroTimer and bossIntroDuration', () => {
  // Same neighbourhood as `this.bossSealed=false;` — the descend reset
  // block. End-anchored `;` again to defeat trailing-arithmetic mutations.
  assert.ok(/this\.bossIntroTimer\s*=\s*0\s*;/.test(GAME_NC),
    'descend reset must include this.bossIntroTimer=0;');
  assert.ok(/this\.bossIntroDuration\s*=\s*0\s*;/.test(GAME_NC),
    'descend reset must include this.bossIntroDuration=0;');
});

// ─── Trigger on bossSealed flip ─────────────────────────────────────────────

test('boss seal block sets bossIntroTimer AND bossIntroDuration to BOSS_INTRO_DURATION', () => {
  // Extract the seal-flip if-block and verify both writes live INSIDE it.
  // The opener anchors on `if (!onEntrance &&` which is the unique seal-
  // flip predicate (the OTHER seal-flip in game.js is for the challenge
  // room, which uses a DIFFERENT opener — this test pins the boss path).
  const block = extractBlock(GAME_NC, /if\s*\(\s*!\s*onEntrance\s*&&\s*\n?\s*player\.x\s*>=\s*r\.x/);
  assert.ok(block, 'must find the boss-room seal-flip if-block in game.js');
  assert.ok(!hasDeadBranch(block), 'seal-flip block must not contain a compile-time-dead branch wrapping the intro setup');

  // Both assignments must reference BOSS_INTRO_DURATION by EXACT identifier
  // (rules out `bossIntroTimer = 0;` decoy that would defeat the runtime
  // intro). End-anchored `;` rules out trailing arithmetic mutations.
  assert.ok(/this\.bossIntroDuration\s*=\s*BOSS_INTRO_DURATION\s*;/.test(block),
    'seal-flip block must set this.bossIntroDuration = BOSS_INTRO_DURATION;');
  assert.ok(/this\.bossIntroTimer\s*=\s*BOSS_INTRO_DURATION\s*;/.test(block),
    'seal-flip block must set this.bossIntroTimer = BOSS_INTRO_DURATION;');

  // audio.bossIntro must be invoked from inside this same block — the
  // sting is what makes the intro feel like an event. Guarded with
  // `if (audio.bossIntro)` for forward-compat (older saves / minimal
  // audio bundles where the cue might not exist) — the regex below
  // accepts that guarded shape OR a bare call.
  assert.ok(/audio\.bossIntro\s*\(\s*\)/.test(block),
    'seal-flip block must call audio.bossIntro()');
});

test('audio.bossIntro is fired AFTER bossSealed=true within the same flip block (correct ordering)', () => {
  // The intro cue MUST fire AFTER the seal flag is set — otherwise a
  // re-entrant audio path or test harness could trigger the cue without
  // the gameplay state being consistent. Extract the block again and
  // verify positional ordering.
  const block = extractBlock(GAME_NC, /if\s*\(\s*!\s*onEntrance\s*&&\s*\n?\s*player\.x\s*>=\s*r\.x/);
  assert.ok(block, 'must find seal-flip block');
  const sealIdx = block.indexOf('this.bossSealed = true');
  const introIdx = block.search(/audio\.bossIntro\s*\(/);
  assert.ok(sealIdx >= 0, 'must contain this.bossSealed = true');
  assert.ok(introIdx >= 0, 'must contain audio.bossIntro() call');
  assert.ok(introIdx > sealIdx, 'audio.bossIntro() must be called AFTER this.bossSealed = true');
});

// ─── Per-frame decrement ────────────────────────────────────────────────────

test('bossIntroTimer is decremented by dt every frame, clamped to 0', () => {
  // Pin the decrement statement. Two important properties:
  // (1) gated on `> 0` (so we don't waste cycles or spam 0 writes)
  // (2) clamped via Math.max(0, ...) — prevents negative-timer states
  //     from becoming a permanent overlay if dt ever spikes huge (alt-tab,
  //     phone-call interrupt). End-anchored `;`.
  const m = GAME_NC.match(/if\s*\(\s*this\.bossIntroTimer\s*>\s*0\s*\)\s*\{[\s\S]{0,200}?this\.bossIntroTimer\s*=\s*Math\.max\(\s*0\s*,\s*this\.bossIntroTimer\s*-\s*dt\s*\)\s*;[\s\S]{0,40}?\}/);
  assert.ok(m,
    'must decrement bossIntroTimer with `if (this.bossIntroTimer > 0) { this.bossIntroTimer = Math.max(0, this.bossIntroTimer - dt); }` shape');
});

// ─── Cleanup on boss death ──────────────────────────────────────────────────

test('boss death block clears bossIntroTimer and bossIntroDuration', () => {
  // Edge case: boss dies during the intro (player one-shots a low-HP
  // boss the instant they cross the threshold). Without cleanup the
  // titlecard would outlast the kill — visual contradiction.
  // Extract the death block (opener: `if (this.bossAlive && !enemies.some(e=>e.isBoss && !e.dead))`).
  const block = extractBlock(GAME_NC, /if\s*\(\s*this\.bossAlive\s*&&\s*!\s*enemies\.some\(/);
  assert.ok(block, 'must find boss-death if-block in game.js');
  assert.ok(!hasDeadBranch(block), 'boss-death block must not contain a compile-time-dead branch wrapping the cleanup');
  assert.ok(/this\.bossIntroTimer\s*=\s*0\s*;/.test(block),
    'boss-death block must clear this.bossIntroTimer = 0;');
  assert.ok(/this\.bossIntroDuration\s*=\s*0\s*;/.test(block),
    'boss-death block must clear this.bossIntroDuration = 0;');
});

// ─── Render hook ────────────────────────────────────────────────────────────

test('drawBossIntroOverlay is invoked from renderPlaying, AFTER drawBossBar', () => {
  // The overlay must render LAST (over the world AND HUD chrome) for the
  // titlecard to read as the visual focal point. Specifically: must be
  // called after drawBossBar() in the renderPlaying flow.
  const renderPlayingIdx = GAME_NC.search(/\brenderPlaying\s*\(\s*\)\s*\{/);
  assert.ok(renderPlayingIdx >= 0, 'must find renderPlaying() in game.js');
  const tail = GAME_NC.slice(renderPlayingIdx);
  const barIdx = tail.search(/\bdrawBossBar\s*\(\s*\)/);
  const introIdx = tail.search(/\bdrawBossIntroOverlay\s*\(\s*\)/);
  assert.ok(barIdx >= 0, 'renderPlaying must call drawBossBar()');
  assert.ok(introIdx >= 0, 'renderPlaying must call drawBossIntroOverlay()');
  assert.ok(introIdx > barIdx, 'drawBossIntroOverlay() must be invoked AFTER drawBossBar() so the titlecard layers on top');
});

// ─── drawBossIntroOverlay implementation ────────────────────────────────────

test('drawBossIntroOverlay is defined in render.js with timer/duration gate', () => {
  const block = extractBlock(RENDER_NC, /\bfunction\s+drawBossIntroOverlay\s*\(\s*\)\s*\{/);
  assert.ok(block, 'render.js must define `function drawBossIntroOverlay()`');
  assert.ok(!hasDeadBranch(block), 'drawBossIntroOverlay must not contain a compile-time-dead branch');

  // The gate must read BOTH _RG.bossIntroTimer AND _RG.bossIntroDuration
  // and early-return when either is missing/zero. The duration-zero check
  // is defensive — without it, dur=0 with t>0 (theoretically reachable
  // via a partial mutation) would cause a divide-by-zero in the
  // progress calculation.
  assert.ok(/_RG\.bossIntroTimer/.test(block),
    'drawBossIntroOverlay must read _RG.bossIntroTimer');
  assert.ok(/_RG\.bossIntroDuration/.test(block),
    'drawBossIntroOverlay must read _RG.bossIntroDuration');

  // Early-return shape: `if (!t || t <= 0 || !dur || dur <= 0) return;`
  // (or any reordering of the four conjuncts). We pin the structural
  // intent: an early-return guard that mentions both `<= 0` checks.
  assert.ok(/return\s*;/.test(block),
    'drawBossIntroOverlay must contain an early-return guard');
  assert.ok(/t\s*<=\s*0/.test(block) && /dur\s*<=\s*0/.test(block),
    'drawBossIntroOverlay must guard on both t<=0 AND dur<=0');
});

test('drawBossIntroOverlay computes alpha via fade-in/fade-out envelope', () => {
  const block = extractBlock(RENDER_NC, /\bfunction\s+drawBossIntroOverlay\s*\(\s*\)\s*\{/);
  assert.ok(block, 'must find drawBossIntroOverlay block');
  // Standard envelope: ramp up over fadeIn, hold, ramp down over fadeOut.
  // The ratios `elapsed / fadeIn` and `t / fadeOut` are the canonical
  // shape across drawBiomeCard + drawBossIntroOverlay.
  assert.ok(/elapsed\s*\/\s*fadeIn/.test(block),
    'fade-in envelope must compute alpha via elapsed/fadeIn');
  assert.ok(/t\s*\/\s*fadeOut/.test(block),
    'fade-out envelope must compute alpha via t/fadeOut');
  // Final clamp to [0,1] — keeps globalAlpha in canvas-spec range even
  // if the envelope math overshoots due to fadeIn/fadeOut > duration.
  assert.ok(/Math\.max\(\s*0\s*,\s*Math\.min\(\s*1\s*,\s*alpha\s*\)\s*\)/.test(block),
    'alpha must be clamped to [0,1] via Math.max(0, Math.min(1, alpha))');
  // r2 finding (opus-4.7): a mutation could compute alpha and never APPLY
  // it, leaving the overlay at full opacity for the entire 2.4s window —
  // killing the fade-in/hold/fade-out feel without breaking any other
  // assertion. Pin BOTH globalAlpha writes — vignAlpha (layer 1) and
  // alpha (layer 2) — so the canvas state is actually parameterised by
  // the envelope and not stuck at 1.0.
  assert.ok(/ctx\.globalAlpha\s*=\s*vignAlpha\s*;/.test(block),
    'overlay must apply vignette alpha via ctx.globalAlpha = vignAlpha;');
  assert.ok(/ctx\.globalAlpha\s*=\s*alpha\s*;/.test(block),
    'overlay must apply titlecard alpha via ctx.globalAlpha = alpha;');
});

test('drawBossIntroOverlay draws a radial vignette in the boss colour', () => {
  const block = extractBlock(RENDER_NC, /\bfunction\s+drawBossIntroOverlay\s*\(\s*\)\s*\{/);
  assert.ok(block, 'must find drawBossIntroOverlay block');
  assert.ok(/createRadialGradient\s*\(/.test(block),
    'overlay must draw a radial vignette via ctx.createRadialGradient');
  // The vignette tint must use the BOSS colour (col), not a hardcoded
  // hex — that's what makes the intro chromatically distinct per boss.
  // Test by checking that a `col` variable is assigned from boss.colour
  // AND that addColorStop receives `col`.
  assert.ok(/(?:const|let)\s+col\s*=\s*boss\s*\?\s*boss\.colour\s*:/.test(block),
    'overlay must derive `col` from the live boss instance (boss ? boss.colour : fallback)');
  assert.ok(/addColorStop\s*\([^)]*,\s*col\s*\)/.test(block),
    'radial gradient must include a stop using the boss colour `col`');
});

test('drawBossIntroOverlay renders the boss name as a titlecard via fillText', () => {
  const block = extractBlock(RENDER_NC, /\bfunction\s+drawBossIntroOverlay\s*\(\s*\)\s*\{/);
  assert.ok(block, 'must find drawBossIntroOverlay block');
  // Boss name lookup must use the BOSS_NAMES table (consistent with
  // drawBossBar) so the titlecard shows the SAME name the HP bar uses.
  // Bare `_RG.bossType` would show the internal key (e.g. "OMEGA")
  // instead of the display name (e.g. "OMEGA CORE").
  assert.ok(/BOSS_NAMES[\s\S]{0,20}?_RG\.bossType/.test(block),
    'titlecard must look up name via BOSS_NAMES[_RG.bossType]');
  // Must actually draw the name. fillText is canvas's text path; the
  // `name` identifier must be the first arg.
  assert.ok(/fillText\s*\(\s*name\s*,/.test(block),
    'titlecard must fillText(name, x, y)');
});

test('drawBossIntroOverlay respects settings.reducedMotion (suppresses slide animation)', () => {
  const block = extractBlock(RENDER_NC, /\bfunction\s+drawBossIntroOverlay\s*\(\s*\)\s*\{/);
  assert.ok(block, 'must find drawBossIntroOverlay block');
  // Reduced motion is the accessibility umbrella that exists to mitigate
  // vestibular triggers. The titlecard must still show (it's a critical
  // signal that a boss fight just started) but the drop-in slide
  // animation must be suppressed under reducedMotion.
  assert.ok(/settings\.reducedMotion/.test(block),
    'overlay must branch on settings.reducedMotion for animation suppression');
  // The slide is a numeric offset; under reducedMotion the offset must
  // be 0 (the canonical pattern from drawDangerVignette).
  assert.ok(/settings\.reducedMotion\s*\?\s*0\s*:/.test(block),
    'reducedMotion path must collapse the slide offset to 0');
});

test('drawBossIntroOverlay uses ctx.save/ctx.restore (no leaked canvas state)', () => {
  const block = extractBlock(RENDER_NC, /\bfunction\s+drawBossIntroOverlay\s*\(\s*\)\s*\{/);
  assert.ok(block, 'must find drawBossIntroOverlay block');
  // Canvas state hygiene — every render function in the codebase that
  // mutates globalAlpha / shadowBlur / textAlign / font wraps its work
  // in a save/restore pair. Without this, the next drawn frame inherits
  // stale state. Pin BOTH calls; presence-only is enough (we don't try
  // to count brace depth or pair-match — the existing renderPlaying
  // tests catch leaks behaviourally).
  assert.ok(/ctx\.save\s*\(\s*\)/.test(block),
    'overlay must call ctx.save() before mutating canvas state');
  assert.ok(/ctx\.restore\s*\(\s*\)/.test(block),
    'overlay must call ctx.restore() before returning');
});

// ─── audio.bossIntro ────────────────────────────────────────────────────────

test('audio.bossIntro is defined in platform.js with osc + noise builders', () => {
  // Find the bossIntro method in the audio object literal. Match the
  // shape `bossIntro() { ... }` (the canonical pattern for every audio
  // cue in platform.js — bossEnter, roomSeal, descend, etc.).
  const block = extractBlock(PLATFORM_NC, /\bbossIntro\s*\(\s*\)\s*\{/);
  assert.ok(block, 'platform.js must define audio.bossIntro() method');
  assert.ok(!hasDeadBranch(block), 'audio.bossIntro must not contain a compile-time-dead branch');
  // Must call the audio builders (osc / noise) — otherwise it's a no-op
  // that satisfies the type signature but produces silence.
  assert.ok(/\bosc\s*\(/.test(block),
    'audio.bossIntro must call osc() (silence-defence)');
  assert.ok(/\bnoise\s*\(/.test(block),
    'audio.bossIntro must call noise() (texture-defence)');
});

// ─── Anti-scope-creep ───────────────────────────────────────────────────────

test('bossIntroTimer is written ONLY by game.js (no entities.js / content.js / render.js writers)', () => {
  // The intro is a game-flow concept — entities/content/render must NEVER
  // write to it. If a future contributor wants to extend the intro to
  // fire in another context, they must add the write to game.js (where
  // every other game-flow timer lives). This guards against the bypass
  // class where a sibling system silently neutralises the timer.
  for (const [name, src] of /** @type {[string, string][]} */ ([
    ['entities.js', ENTITIES_NC],
    ['content.js', CONTENT_NC],
    ['content/status.js', CONTENT_STATUS_NC],
    ['render.js', RENDER_NC],
  ])) {
    assert.ok(!/bossIntroTimer\s*=/.test(src),
      `${name} must NOT write to bossIntroTimer (game-flow timer is owned by game.js only)`);
    assert.ok(!/bossIntroDuration\s*=/.test(src),
      `${name} must NOT write to bossIntroDuration (game-flow timer is owned by game.js only)`);
  }
});

test('game.js writes to bossIntroTimer / bossIntroDuration are bounded to the canonical sites', () => {
  // r2 finding (opus-4.7): the cross-file ban above doesn't bound writes
  // INSIDE game.js. A SIBLING-NEUTRALIZER mutation (`this.bossIntroTimer
  // = 0;` appended after the canonical decrement, or anywhere else in the
  // update loop) silently defeats the entire telegraph while every
  // canonical-presence assertion still passes. Pin the write counts.
  //
  // Canonical bossIntroTimer writes (5):
  //   1. object literal default     `bossIntroTimer: 0,`
  //   2. descend reset              `this.bossIntroTimer=0;`
  //   3. seal-flip set              `this.bossIntroTimer = BOSS_INTRO_DURATION;`
  //   4. per-frame decrement        `this.bossIntroTimer = Math.max(0, this.bossIntroTimer - dt);`
  //   5. boss-death cleanup         `this.bossIntroTimer = 0;`
  //
  // Canonical bossIntroDuration writes (4): same as above MINUS the
  // per-frame decrement (duration is set-once and read-by-renderer; it
  // doesn't tick with dt).
  const timerWrites = (GAME_NC.match(/bossIntroTimer\s*[:=]/g) || []).length;
  const durationWrites = (GAME_NC.match(/bossIntroDuration\s*[:=]/g) || []).length;
  // Allow `==`/`===` matches to be excluded by re-counting compare-only
  // shapes and subtracting. Canonical decrement reads then writes, so the
  // RHS reference (`this.bossIntroTimer - dt`) does NOT match `[:=]`.
  assert.equal(timerWrites, 5,
    `game.js must contain EXACTLY 5 bossIntroTimer writes (literal, descend, seal-flip, decrement, death-cleanup); got ${timerWrites}. A new write here is a sibling-neutralizer bypass risk — if the new site is intentional, update this canary count.`);
  assert.equal(durationWrites, 4,
    `game.js must contain EXACTLY 4 bossIntroDuration writes (literal, descend, seal-flip, death-cleanup); got ${durationWrites}. A new write here is a sibling-neutralizer bypass risk — if the new site is intentional, update this canary count.`);
});

test('audio.bossIntro is invoked ONLY from the seal-flip block in game.js', () => {
  // The intro cue is meant to fire EXACTLY ONCE per boss encounter, at
  // the seal-flip moment. Multiple call sites would either spam the
  // sting or fire it at the wrong moment (e.g. on save/load, on floor
  // entry, etc.). Enforce single-call-site discipline.
  const calls = (GAME_NC.match(/audio\.bossIntro\s*\(/g) || []).length;
  assert.equal(calls, 1, `audio.bossIntro must be invoked from EXACTLY one place in game.js (got ${calls})`);

  // And no other source file invokes it either.
  for (const [name, src] of /** @type {[string, string][]} */ ([
    ['entities.js', ENTITIES_NC],
    ['content.js', CONTENT_NC],
    ['content/status.js', CONTENT_STATUS_NC],
    ['render.js', RENDER_NC],
    ['platform.js', PLATFORM_NC],
  ])) {
    // platform.js DEFINES bossIntro inside the audio object literal —
    // that's a method declaration, not an invocation. Match `audio.bossIntro(`
    // specifically (the call-site shape) to avoid false positives.
    assert.ok(!/audio\.bossIntro\s*\(/.test(src),
      `${name} must NOT call audio.bossIntro() (single call site is the seal-flip in game.js)`);
  }
});

test('drawBossIntroOverlay is invoked exactly once in game.js renderPlaying', () => {
  // Same single-call-site discipline as the audio cue. Multiple draw
  // calls would render the titlecard twice per frame (visual artefact
  // when alpha < 1 — overlap creates a brighter band).
  const calls = (GAME_NC.match(/\bdrawBossIntroOverlay\s*\(/g) || []).length;
  assert.equal(calls, 1, `drawBossIntroOverlay must be invoked exactly once in game.js (got ${calls})`);
});
