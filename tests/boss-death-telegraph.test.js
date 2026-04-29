'use strict';
// Boss death telegraph — atmospheric overlay (white-flash impact spike +
// radial vignette in the boss colour + "DESTROYED" titlecard with the
// boss name + celebratory audio sting) that fires for BOSS_DEATH_DURATION
// seconds when the LAST boss enemy is killed (i.e. when bossAlive flips
// true → false). Gameplay is NOT paused — the overlay is purely cosmetic
// and runs in parallel with normal play, mirroring the boss-intro
// telegraph (PR #381).
//
// game.js / render.js / platform.js are all browser-coupled (no UMD
// exports), so we can't exercise the runtime state machine under
// node:test. Instead these tests assert the structural invariants any
// working implementation must satisfy. Pattern matches the canonical
// boss-intro test scaffold (extractBlock, hasDeadBranch) — same
// defensive helpers against the bypass-class menagerie those reviews
// surfaced (STALE-FLAG TIMING, COMPUTED-BUT-NOT-APPLIED,
// SIBLING-NEUTRALIZER, DEAD-BRANCH wrapping).

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

/** @param {string} src */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const GAME_NC = stripComments(GAME);
const RENDER_NC = stripComments(RENDER);
const PLATFORM_NC = stripComments(PLATFORM);
const ENTITIES_NC = stripComments(ENTITIES);
const CONTENT_NC = stripComments(CONTENT);

// Brace-balanced extraction. Returns the FIRST block opened by openerRe.
// Naive depth counter — does NOT understand string/regex literals. The
// boss-death code paths have no braces inside string literals, so this is
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
// Mirrors the canonical hasDeadBranch from tests/boss-intro-telegraph.test.js
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

test('BOSS_DEATH_DURATION constant is declared in game.js as a finite positive number ≤ 5s', () => {
  // Pin the LITERAL declaration with a captured value, then verify the
  // captured value parses to a sensible duration. End-anchored `;` rules
  // out trailing arithmetic mutations like `... * 0` / `... * 1e9`.
  const m = GAME_NC.match(/\bconst\s+BOSS_DEATH_DURATION\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*;/);
  assert.ok(m, 'BOSS_DEATH_DURATION must be declared as `const BOSS_DEATH_DURATION = <number>;` in game.js');
  const v = Number(m[1]);
  assert.ok(Number.isFinite(v) && v > 0 && v <= 5,
    `BOSS_DEATH_DURATION must be a finite positive number ≤ 5s (got ${v})`);
});

// ─── State fields on game ────────────────────────────────────────────────────

test('game state object declares bossDeathTimer / bossDeathDuration / bossDeathColor / bossDeathName with sensible defaults', () => {
  // Pin BOTH initialisation sites: the object-literal default AND the
  // descend reset. Any future contributor who adds a new field MUST
  // initialise it in both places (the existing pattern for every other
  // boss field — bossSealed, bossAlive, bossBarAnim, bossHpGhost,
  // bossIntroTimer, bossIntroDuration).
  assert.ok(/\bbossDeathTimer:\s*0,/.test(GAME_NC),
    'game state literal must initialise bossDeathTimer: 0,');
  assert.ok(/\bbossDeathDuration:\s*0,/.test(GAME_NC),
    'game state literal must initialise bossDeathDuration: 0,');
  // Colour default must be a string literal — the renderer falls back
  // to it when the snapshot is missing. Any non-string would crash
  // gradient.addColorStop. Also forbid empty-string defaults.
  assert.ok(/\bbossDeathColor:\s*'#[0-9a-fA-F]{3,8}',/.test(GAME_NC),
    'game state literal must initialise bossDeathColor to a hex-string default');
  // Name default empty-string is fine — the renderer falls back to
  // 'BOSS' if the snapshot is missing. Pin presence of the field.
  assert.ok(/\bbossDeathName:\s*'',/.test(GAME_NC),
    "game state literal must initialise bossDeathName: '',");
});

test('descend reset clears bossDeathTimer / bossDeathDuration / bossDeathColor / bossDeathName', () => {
  // Same neighbourhood as `this.bossSealed=false;` — the descend reset
  // block. End-anchored `;` again to defeat trailing-arithmetic mutations.
  // bossDeathColor IS reset on descend (r1 finding from gpt-5.5): without
  // it, a same-frame spawn-and-kill on the next floor (boss dies before
  // the per-frame HUD-block snapshot runs) would inherit the previous
  // boss's colour for the death-overlay vignette. Vanishingly rare in
  // practice but trivially defensible — reset to the canonical neon-green
  // default so the overlay falls back cleanly.
  assert.ok(/this\.bossDeathTimer\s*=\s*0\s*;/.test(GAME_NC),
    'descend reset must include this.bossDeathTimer=0;');
  assert.ok(/this\.bossDeathDuration\s*=\s*0\s*;/.test(GAME_NC),
    'descend reset must include this.bossDeathDuration=0;');
  assert.ok(/this\.bossDeathColor\s*=\s*'#[0-9a-fA-F]{3,8}'\s*;/.test(GAME_NC),
    "descend reset must include this.bossDeathColor='#<hex>'; (defends the same-frame spawn-and-kill edge case)");
  assert.ok(/this\.bossDeathName\s*=\s*''\s*;/.test(GAME_NC),
    "descend reset must include this.bossDeathName='';");
});

// ─── Per-frame snapshot of boss identity ────────────────────────────────────

test('boss-HUD block snapshots boss colour and name into bossDeathColor / bossDeathName while boss is alive', () => {
  // The boss instance is removed from `enemies` by the dead-enemy splice
  // pass (line ~1804) BEFORE the boss-death detection block fires
  // (line ~2447). So by the time the death telegraph trigger runs, the
  // live boss reference is gone. The snapshot pattern is: per-frame in
  // the boss-HUD block (which runs after death-detection but reads the
  // live boss while it's alive), copy boss.colour and BOSS_NAMES[bossType]
  // into bossDeathColor / bossDeathName. The next frame's death-detection
  // reads those snapshots.
  //
  // Extract the boss-HUD block (opener: `if (this.bossAlive) {` followed
  // by the bossBarAnim line — uniqueness anchor against the seal-flip
  // and death-cleanup blocks which use different openers).
  const block = extractBlock(GAME_NC, /if\s*\(\s*this\.bossAlive\s*\)\s*\{[\s\S]{0,200}?bossBarAnim\s*=\s*Math\.min/);
  assert.ok(block, 'must find the boss-HUD block in game.js (opener: `if (this.bossAlive) { ... bossBarAnim = Math.min ...`)');
  assert.ok(!hasDeadBranch(block), 'boss-HUD block must not contain a compile-time-dead branch wrapping the snapshot');

  // The snapshot writes must reference the live boss instance — pin
  // both writes to their canonical RHS. End-anchored `;` to defeat
  // trailing arithmetic mutations. The boss colour write reads
  // `boss.colour` (matches Enemy field name); the name write reads
  // `BOSS_NAMES[this.bossType]` (matches BOSS_NAMES table convention).
  assert.ok(/this\.bossDeathColor\s*=\s*boss\.colour\s*;/.test(block),
    'boss-HUD block must snapshot this.bossDeathColor = boss.colour;');
  assert.ok(/this\.bossDeathName\s*=\s*BOSS_NAMES\[\s*this\.bossType\s*\]\s*\|\|\s*'BOSS'\s*;/.test(block),
    "boss-HUD block must snapshot this.bossDeathName = BOSS_NAMES[this.bossType] || 'BOSS';");
});

// ─── Trigger on boss-death (bossAlive true→false) ───────────────────────────

test('boss death block sets bossDeathTimer AND bossDeathDuration to BOSS_DEATH_DURATION', () => {
  // Extract the death-detection if-block. Same opener used by
  // boss-intro tests (this is the only block in game.js with this
  // exact predicate shape).
  const block = extractBlock(GAME_NC, /if\s*\(\s*this\.bossAlive\s*&&\s*!\s*enemies\.some\(/);
  assert.ok(block, 'must find boss-death if-block in game.js');
  assert.ok(!hasDeadBranch(block), 'boss-death block must not contain a compile-time-dead branch wrapping the trigger');

  // Both assignments must reference BOSS_DEATH_DURATION by EXACT identifier
  // (rules out `bossDeathTimer = 0;` decoy that would defeat the runtime
  // overlay). End-anchored `;` rules out trailing arithmetic mutations.
  assert.ok(/this\.bossDeathDuration\s*=\s*BOSS_DEATH_DURATION\s*;/.test(block),
    'boss-death block must set this.bossDeathDuration = BOSS_DEATH_DURATION;');
  assert.ok(/this\.bossDeathTimer\s*=\s*BOSS_DEATH_DURATION\s*;/.test(block),
    'boss-death block must set this.bossDeathTimer = BOSS_DEATH_DURATION;');

  // audio.bossDefeat must be invoked from inside this same block — the
  // sting is what makes the death feel like an event. Guarded with
  // `if (audio.bossDefeat)` for forward-compat (older saves / minimal
  // audio bundles) — the regex below accepts that guarded shape OR a
  // bare call.
  assert.ok(/audio\.bossDefeat\s*\(\s*\)/.test(block),
    'boss-death block must call audio.bossDefeat()');
});

test('boss death block fires audio.bossDefeat AFTER bossAlive=false (correct ordering)', () => {
  // The defeat cue MUST fire AFTER the alive flag is cleared — otherwise
  // a re-entrant audio path or test harness could trigger the cue without
  // the gameplay state being consistent.
  const block = extractBlock(GAME_NC, /if\s*\(\s*this\.bossAlive\s*&&\s*!\s*enemies\.some\(/);
  assert.ok(block, 'must find boss-death block');
  const aliveIdx = block.indexOf('this.bossAlive=false');
  const defeatIdx = block.search(/audio\.bossDefeat\s*\(/);
  assert.ok(aliveIdx >= 0, 'must contain this.bossAlive=false');
  assert.ok(defeatIdx >= 0, 'must contain audio.bossDefeat() call');
  assert.ok(defeatIdx > aliveIdx, 'audio.bossDefeat() must be called AFTER this.bossAlive=false');
});

test('boss death block still clears bossIntroTimer / bossIntroDuration (intro-superseded-by-death)', () => {
  // Edge case: boss dies during the intro telegraph. Currently both are
  // active — the intro must be killed so the death overlay reads as the
  // dominant moment. Pin the existing intro-cleanup writes inside the
  // boss-death block to defend against accidental removal during the
  // boss-death-telegraph addition.
  const block = extractBlock(GAME_NC, /if\s*\(\s*this\.bossAlive\s*&&\s*!\s*enemies\.some\(/);
  assert.ok(block, 'must find boss-death block');
  assert.ok(/this\.bossIntroTimer\s*=\s*0\s*;/.test(block),
    'boss-death block must STILL clear this.bossIntroTimer = 0; (intro-superseded-by-death)');
  assert.ok(/this\.bossIntroDuration\s*=\s*0\s*;/.test(block),
    'boss-death block must STILL clear this.bossIntroDuration = 0; (intro-superseded-by-death)');
});

// ─── Per-frame decrement ────────────────────────────────────────────────────

test('bossDeathTimer is decremented by dt every frame, clamped to 0', () => {
  // Pin the decrement statement. Same shape as bossIntroTimer:
  // (1) gated on `> 0` (so we don't waste cycles or spam 0 writes)
  // (2) clamped via Math.max(0, ...) — prevents negative-timer states
  //     from becoming a permanent overlay if dt ever spikes huge (alt-tab,
  //     phone-call interrupt). End-anchored `;`.
  const m = GAME_NC.match(/if\s*\(\s*this\.bossDeathTimer\s*>\s*0\s*\)\s*\{[\s\S]{0,200}?this\.bossDeathTimer\s*=\s*Math\.max\(\s*0\s*,\s*this\.bossDeathTimer\s*-\s*dt\s*\)\s*;[\s\S]{0,40}?\}/);
  assert.ok(m,
    'must decrement bossDeathTimer with `if (this.bossDeathTimer > 0) { this.bossDeathTimer = Math.max(0, this.bossDeathTimer - dt); }` shape');
});

// ─── Render hook ────────────────────────────────────────────────────────────

test('drawBossDeathOverlay is invoked from renderPlaying, AFTER drawBossIntroOverlay', () => {
  // The death overlay must render AFTER the intro overlay so that on the
  // rare frame where both timers are nonzero (boss one-shot mid-intro),
  // the death overlay paints on top and dominates the visual moment.
  // This is also what keeps the chromatic flash legible during the
  // overlap.
  const renderPlayingIdx = GAME_NC.search(/\brenderPlaying\s*\(\s*\)\s*\{/);
  assert.ok(renderPlayingIdx >= 0, 'must find renderPlaying() in game.js');
  const tail = GAME_NC.slice(renderPlayingIdx);
  const introIdx = tail.search(/\bdrawBossIntroOverlay\s*\(\s*\)/);
  const deathIdx = tail.search(/\bdrawBossDeathOverlay\s*\(\s*\)/);
  assert.ok(introIdx >= 0, 'renderPlaying must call drawBossIntroOverlay()');
  assert.ok(deathIdx >= 0, 'renderPlaying must call drawBossDeathOverlay()');
  assert.ok(deathIdx > introIdx,
    'drawBossDeathOverlay() must be invoked AFTER drawBossIntroOverlay() so the death overlay layers on top');
});

// ─── drawBossDeathOverlay implementation ────────────────────────────────────

test('drawBossDeathOverlay is defined in render.js with timer/duration gate', () => {
  const block = extractBlock(RENDER_NC, /\bfunction\s+drawBossDeathOverlay\s*\(\s*\)\s*\{/);
  assert.ok(block, 'render.js must define `function drawBossDeathOverlay()`');
  assert.ok(!hasDeadBranch(block), 'drawBossDeathOverlay must not contain a compile-time-dead branch');

  // The gate must read BOTH _RG.bossDeathTimer AND _RG.bossDeathDuration
  // and early-return when either is missing/zero. The duration-zero check
  // is defensive — without it, dur=0 with t>0 (theoretically reachable
  // via a partial mutation) would cause a divide-by-zero in the
  // progress calculation.
  assert.ok(/_RG\.bossDeathTimer/.test(block),
    'drawBossDeathOverlay must read _RG.bossDeathTimer');
  assert.ok(/_RG\.bossDeathDuration/.test(block),
    'drawBossDeathOverlay must read _RG.bossDeathDuration');

  // Early-return shape: `if (!t || t <= 0 || !dur || dur <= 0) return;`
  // (or any reordering of the four conjuncts). Pin the structural
  // intent: an early-return guard that mentions both `<= 0` checks.
  assert.ok(/return\s*;/.test(block),
    'drawBossDeathOverlay must contain an early-return guard');
  assert.ok(/t\s*<=\s*0/.test(block) && /dur\s*<=\s*0/.test(block),
    'drawBossDeathOverlay must guard on both t<=0 AND dur<=0');
});

test('drawBossDeathOverlay computes alpha via fade-in/fade-out envelope and APPLIES it', () => {
  const block = extractBlock(RENDER_NC, /\bfunction\s+drawBossDeathOverlay\s*\(\s*\)\s*\{/);
  assert.ok(block, 'must find drawBossDeathOverlay block');
  // Standard envelope: ramp up over fadeIn, hold, ramp down over fadeOut.
  // The ratios `elapsed / fadeIn` and `t / fadeOut` are the canonical
  // shape across drawBiomeCard + drawBossIntroOverlay + drawBossDeathOverlay.
  assert.ok(/elapsed\s*\/\s*fadeIn/.test(block),
    'fade-in envelope must compute alpha via elapsed/fadeIn');
  assert.ok(/t\s*\/\s*fadeOut/.test(block),
    'fade-out envelope must compute alpha via t/fadeOut');
  // Final clamp to [0,1] — keeps globalAlpha in canvas-spec range even
  // if the envelope math overshoots due to fadeIn/fadeOut > duration.
  assert.ok(/Math\.max\(\s*0\s*,\s*Math\.min\(\s*1\s*,\s*alpha\s*\)\s*\)/.test(block),
    'alpha must be clamped to [0,1] via Math.max(0, Math.min(1, alpha))');
  // COMPUTED-BUT-NOT-APPLIED defence (canonical bypass class from
  // boss-intro r2): a mutation could compute alpha and never APPLY it,
  // leaving the overlay at full opacity for the entire window — killing
  // the fade feel without breaking any other assertion. Pin BOTH
  // globalAlpha writes — vignAlpha (layer 2) and alpha (layer 3) — so
  // the canvas state is actually parameterised by the envelope and not
  // stuck at 1.0. The titlecard subtitle is a *named-derivation* of
  // alpha (`alpha * 0.9`) — its application is pinned separately by
  // requiring the titlecard fillText to follow a globalAlpha write.
  assert.ok(/ctx\.globalAlpha\s*=\s*vignAlpha\s*;/.test(block),
    'overlay must apply vignette alpha via ctx.globalAlpha = vignAlpha;');
  assert.ok(/ctx\.globalAlpha\s*=\s*alpha\s*;/.test(block),
    'overlay must apply titlecard alpha via ctx.globalAlpha = alpha;');
});

test('drawBossDeathOverlay draws a radial vignette in the snapshot boss colour', () => {
  const block = extractBlock(RENDER_NC, /\bfunction\s+drawBossDeathOverlay\s*\(\s*\)\s*\{/);
  assert.ok(block, 'must find drawBossDeathOverlay block');
  assert.ok(/createRadialGradient\s*\(/.test(block),
    'overlay must draw a radial vignette via ctx.createRadialGradient');
  // The vignette tint must use the SNAPSHOT boss colour (col), not a
  // hardcoded hex — that's what makes the moment chromatically distinct
  // per boss. The col local is derived from _RG.bossDeathColor with a
  // safe fallback (string-literal — keeps gradient.addColorStop safe).
  assert.ok(/(?:const|let)\s+col\s*=\s*_RG\.bossDeathColor\s*\|\|\s*['"]#[0-9a-fA-F]{3,8}['"]/.test(block),
    'overlay must derive `col` from _RG.bossDeathColor with a hex-string fallback');
  assert.ok(/addColorStop\s*\([^)]*,\s*col\s*\)/.test(block),
    'radial gradient must include a stop using the snapshot boss colour `col`');
});

test('drawBossDeathOverlay renders the "DESTROYED" title and the snapshot boss name', () => {
  const block = extractBlock(RENDER_NC, /\bfunction\s+drawBossDeathOverlay\s*\(\s*\)\s*\{/);
  assert.ok(block, 'must find drawBossDeathOverlay block');
  // Boss name lookup must use the SNAPSHOT field — the live boss
  // instance is gone by the time this overlay renders. Same reasoning
  // as `col` above.
  assert.ok(/(?:const|let)\s+name\s*=\s*_RG\.bossDeathName\s*\|\|\s*['"]BOSS['"]/.test(block),
    "overlay must derive `name` from _RG.bossDeathName with a 'BOSS' fallback");
  // Must actually draw the "DESTROYED" header. Pin the literal so a
  // mutation that swaps it for an empty string would fail.
  assert.ok(/fillText\s*\(\s*['"]DESTROYED['"]\s*,/.test(block),
    "overlay must fillText('DESTROYED', x, y) for the header");
  // Must draw the snapshot name. The `name` identifier must be the
  // first arg of a fillText call.
  assert.ok(/fillText\s*\(\s*name\s*,/.test(block),
    'overlay must fillText(name, x, y) for the boss-name subtitle');
});

test('drawBossDeathOverlay respects settings.reducedMotion (suppresses pop animation)', () => {
  const block = extractBlock(RENDER_NC, /\bfunction\s+drawBossDeathOverlay\s*\(\s*\)\s*\{/);
  assert.ok(block, 'must find drawBossDeathOverlay block');
  // Reduced motion is the accessibility umbrella that exists to mitigate
  // vestibular triggers. The titlecard must still show (it's a critical
  // signal that the boss just died) but the entrance pop animation must
  // be suppressed under reducedMotion.
  assert.ok(/settings\.reducedMotion/.test(block),
    'overlay must branch on settings.reducedMotion for animation suppression');
  // The pop is a numeric offset; under reducedMotion the offset must
  // be 0 (the canonical pattern from drawBossIntroOverlay).
  assert.ok(/settings\.reducedMotion\s*\?\s*0\s*:/.test(block),
    'reducedMotion path must collapse the pop offset to 0');
});

test('drawBossDeathOverlay uses ctx.save/ctx.restore (no leaked canvas state)', () => {
  const block = extractBlock(RENDER_NC, /\bfunction\s+drawBossDeathOverlay\s*\(\s*\)\s*\{/);
  assert.ok(block, 'must find drawBossDeathOverlay block');
  // Canvas state hygiene — every render function in the codebase that
  // mutates globalAlpha / shadowBlur / textAlign / font / globalCompositeOperation
  // wraps its work in a save/restore pair. Without this, the next drawn
  // frame inherits stale state. Pin BOTH calls; presence-only is enough.
  assert.ok(/ctx\.save\s*\(\s*\)/.test(block),
    'overlay must call ctx.save() before mutating canvas state');
  assert.ok(/ctx\.restore\s*\(\s*\)/.test(block),
    'overlay must call ctx.restore() before returning');
});

// ─── audio.bossDefeat ────────────────────────────────────────────────────────

test('audio.bossDefeat is defined in platform.js with osc + noise builders', () => {
  // Find the bossDefeat method in the audio object literal. Match the
  // shape `bossDefeat() { ... }` (the canonical pattern for every audio
  // cue in platform.js — bossEnter, roomSeal, descend, bossIntro, etc.).
  const block = extractBlock(PLATFORM_NC, /\bbossDefeat\s*\(\s*\)\s*\{/);
  assert.ok(block, 'platform.js must define audio.bossDefeat() method');
  assert.ok(!hasDeadBranch(block), 'audio.bossDefeat must not contain a compile-time-dead branch');
  // Must call the audio builders (osc / noise) — otherwise it's a no-op
  // that satisfies the type signature but produces silence.
  assert.ok(/\bosc\s*\(/.test(block),
    'audio.bossDefeat must call osc() (silence-defence)');
  assert.ok(/\bnoise\s*\(/.test(block),
    'audio.bossDefeat must call noise() (texture-defence)');
});

// ─── Anti-scope-creep ───────────────────────────────────────────────────────

test('bossDeathTimer is written ONLY by game.js (no entities.js / content.js / render.js writers)', () => {
  // The death telegraph is a game-flow concept — entities/content/render
  // must NEVER write to it. If a future contributor wants to extend the
  // overlay to fire in another context, they must add the write to
  // game.js (where every other game-flow timer lives). This guards
  // against the bypass class where a sibling system silently neutralises
  // the timer.
  for (const [name, src] of /** @type {[string, string][]} */ ([
    ['entities.js', ENTITIES_NC],
    ['content.js', CONTENT_NC],
    ['render.js', RENDER_NC],
  ])) {
    assert.ok(!/bossDeathTimer\s*=/.test(src),
      `${name} must NOT write to bossDeathTimer (game-flow timer is owned by game.js only)`);
    assert.ok(!/bossDeathDuration\s*=/.test(src),
      `${name} must NOT write to bossDeathDuration (game-flow timer is owned by game.js only)`);
    assert.ok(!/bossDeathColor\s*=/.test(src),
      `${name} must NOT write to bossDeathColor (snapshot is owned by game.js only)`);
    assert.ok(!/bossDeathName\s*=/.test(src),
      `${name} must NOT write to bossDeathName (snapshot is owned by game.js only)`);
  }
});

test('game.js writes to bossDeathTimer / bossDeathDuration are bounded to the canonical sites', () => {
  // SIBLING-NEUTRALIZER bypass class: a mutation that appends
  // `this.bossDeathTimer = 0;` after the canonical decrement, or anywhere
  // else in the update loop, silently defeats the entire telegraph while
  // every canonical-presence assertion still passes. Pin the write counts.
  //
  // Canonical bossDeathTimer writes (4):
  //   1. object literal default     `bossDeathTimer: 0,`
  //   2. descend reset              `this.bossDeathTimer=0;`
  //   3. death-trigger set          `this.bossDeathTimer = BOSS_DEATH_DURATION;`
  //   4. per-frame decrement        `this.bossDeathTimer = Math.max(0, this.bossDeathTimer - dt);`
  //
  // Canonical bossDeathDuration writes (3): same as above MINUS the
  // per-frame decrement (duration is set-once and read-by-renderer; it
  // doesn't tick with dt).
  //
  // Canonical bossDeathColor writes (3):
  //   1. object literal default     `bossDeathColor: '#39ff14',`
  //   2. descend reset              `this.bossDeathColor='#39ff14';`
  //   3. boss-HUD per-frame snapshot `this.bossDeathColor = boss.colour;`
  //
  // Canonical bossDeathName writes (3):
  //   1. object literal default     `bossDeathName: '',`
  //   2. descend reset              `this.bossDeathName = '';`
  //   3. boss-HUD per-frame snapshot `this.bossDeathName = BOSS_NAMES[this.bossType] || 'BOSS';`
  const timerWrites = (GAME_NC.match(/bossDeathTimer\s*[:=]/g) || []).length;
  const durationWrites = (GAME_NC.match(/bossDeathDuration\s*[:=]/g) || []).length;
  const colorWrites = (GAME_NC.match(/bossDeathColor\s*[:=]/g) || []).length;
  const nameWrites = (GAME_NC.match(/bossDeathName\s*[:=]/g) || []).length;
  assert.equal(timerWrites, 4,
    `game.js must contain EXACTLY 4 bossDeathTimer writes (literal, descend, trigger, decrement); got ${timerWrites}. A new write here is a sibling-neutralizer bypass risk — if the new site is intentional, update this canary count.`);
  assert.equal(durationWrites, 3,
    `game.js must contain EXACTLY 3 bossDeathDuration writes (literal, descend, trigger); got ${durationWrites}. A new write here is a sibling-neutralizer bypass risk — if the new site is intentional, update this canary count.`);
  assert.equal(colorWrites, 3,
    `game.js must contain EXACTLY 3 bossDeathColor writes (literal, descend reset, per-frame snapshot); got ${colorWrites}. A new write here is a sibling-neutralizer bypass risk — if the new site is intentional, update this canary count.`);
  assert.equal(nameWrites, 3,
    `game.js must contain EXACTLY 3 bossDeathName writes (literal, descend, per-frame snapshot); got ${nameWrites}. A new write here is a sibling-neutralizer bypass risk — if the new site is intentional, update this canary count.`);
});

test('audio.bossDefeat is invoked ONLY from the boss-death block in game.js', () => {
  // The defeat cue is meant to fire EXACTLY ONCE per boss kill, at the
  // bossAlive true→false flip. Multiple call sites would either spam the
  // sting or fire it at the wrong moment (e.g. on save/load, on floor
  // entry, etc.). Enforce single-call-site discipline.
  const calls = (GAME_NC.match(/audio\.bossDefeat\s*\(/g) || []).length;
  assert.equal(calls, 1, `audio.bossDefeat must be invoked from EXACTLY one place in game.js (got ${calls})`);

  // And no other source file invokes it either.
  for (const [name, src] of /** @type {[string, string][]} */ ([
    ['entities.js', ENTITIES_NC],
    ['content.js', CONTENT_NC],
    ['render.js', RENDER_NC],
    ['platform.js', PLATFORM_NC],
  ])) {
    // platform.js DEFINES bossDefeat inside the audio object literal —
    // that's a method declaration, not an invocation. Match `audio.bossDefeat(`
    // specifically (the call-site shape) to avoid false positives.
    assert.ok(!/audio\.bossDefeat\s*\(/.test(src),
      `${name} must NOT call audio.bossDefeat() (single call site is the boss-death block in game.js)`);
  }
});

test('drawBossDeathOverlay is invoked exactly once in game.js renderPlaying', () => {
  // Same single-call-site discipline as the audio cue. Multiple draw
  // calls would render the overlay twice per frame (visual artefact
  // when alpha < 1 — overlap creates a brighter band).
  const calls = (GAME_NC.match(/\bdrawBossDeathOverlay\s*\(/g) || []).length;
  assert.equal(calls, 1, `drawBossDeathOverlay must be invoked exactly once in game.js (got ${calls})`);
});
