'use strict';
// CHRONO_LURE hackware — source-text wiring tests.
//
// CHRONO_LURE is the delayed-trigger pull marker — the timing-based
// counterpart to GRAVITY_WELL's continuous pull. Players drop a marker
// AHEAD of an enemy push; 1.0s later the marker fires: enemies in
// radius 5 are pulled inward AND stunned. The arming delay is the
// trade — immediate effect is sacrificed for a heavier CC payoff that
// rewards positional anticipation.
//
// content.js is browser-only (no UMD/CommonJS exports), so we can't
// load activateHackware()/updateHackwareEffects()/drawHackwareEffects()
// under node:test. Instead, these tests assert the structural
// invariants any working CHRONO_LURE must satisfy: catalog entry,
// activation case (aim+wall-fallback+dedup), update branch
// (detonation-latch + stun + pull, with mob-skip exclusions matching
// gravity-well precedent), draw branch, audio bindings, and the SW
// cache floor that ships the new code to existing users.
//
// Pattern matches tests/emp-line-hackware.test.js — same defensive
// helpers (extractBlock, hasDeadBranch, sliceBetween) and the same
// bypass-class defences (sibling-neutralizer single-occurrence guard,
// Math.max end-anchored stun assignment, dead-branch wrapper rejection,
// helper-body internal anchors). All regex assertions run against
// COMMENT-STRIPPED source so explanatory comments mentioning
// CHRONO_LURE in the case body cannot satisfy a presence regex after
// the executable code is removed.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
);
const PLATFORM = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'platform.js'), 'utf8'
);
const SW = fs.readFileSync(
  path.resolve(__dirname, '..', 'sw.js'), 'utf8'
);

/** @param {string} src */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const CONTENT_NC = stripComments(CONTENT);
const PLATFORM_NC = stripComments(PLATFORM);

// Brace-balanced extraction — copied from emp-line-hackware.test.js.
// Returns the FIRST block opened by openerRe in src. Used to isolate
// case bodies, helper bodies, and per-iteration loop bodies.
//
// LIMITATION: naive depth counter — does NOT understand string/regex
// literals. The current CHRONO_LURE case has no braces inside string
// literals, so this is safe; if a future addition lands a string with
// braces, extractBlock returns null and the assert.ok guards at every
// call site fail loudly with a clear message.
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

// Detects compile-time-falsy `if` openers commonly used to wrap
// canonical regex-satisfying code in unreachable branches. Beyond
// `false`/`0` we also reject `!true`, `!1`, `void 0`, `null`,
// `undefined`, `NaN`, and negated string/numeric literals — opus-4.7
// r2 (on EMP_LINE) demonstrated `if (!true) { ... }` defeated the
// original literal-only detector. Extend further if a future review
// surfaces a new falsy opener.
//
// Also rejects compile-time-TRUE `if` openers when used with
// `continue` or `return` (codex r1 of CHRONO_LURE flagged this — an
// unconditional `if (1 < 2) continue;` before moveToward neutralises
// the pull while passing presence regexes).
/** @param {string} slice */
function hasDeadBranch(slice) {
  // Falsy openers (with `{` — block form).
  if (/\bif\s*\(\s*(?:!\s*true|!\s*1|!\s*'[^']*'|!\s*"[^"]*"|false|0|void\s+0|null|undefined|NaN|\!Boolean\(0\)|0\s*===\s*1|1\s*>\s*2|1\s*===\s*0)\s*\)\s*\{/.test(slice)) return true;
  // Truthy openers + early-exit (continue/return) — non-braced or
  // braced. `if (true) continue;`, `if (1) return;`, `if (1 < 2)
  // return;`, `if (Boolean(1)) continue;` all neutralise the rest of
  // the loop body. The literal cases are the easy ones; the
  // comparison cases (`1 < 2`, `0 < 1`, `2 > 1`, `1 === 1`) we also
  // reject. Defeats codex r1's "non-braced always-true gate" bypass.
  if (/\bif\s*\(\s*(?:true|1|'[^']*'|"[^"]*"|Boolean\(1\)|1\s*<\s*2|0\s*<\s*1|2\s*>\s*1|1\s*===\s*1|0\s*===\s*0|!\s*false|!\s*0)\s*\)\s*(?:\{|continue|return|break)/.test(slice)) return true;
  return false;
}

// Slice between two MUST-RUN anchors. Returns null if either anchor
// is missing. Used to guarantee a regex match lives on the ACTUAL hot
// path between two pinned statements (defeats dead-branch wrappers
// that satisfy presence-only assertions).
/**
 * @param {string} src
 * @param {RegExp} startAnchor
 * @param {RegExp} endAnchor
 */
function sliceBetween(src, startAnchor, endAnchor) {
  const startIdx = src.search(startAnchor);
  if (startIdx < 0) return null;
  const after = src.slice(startIdx);
  const startMatch = after.match(startAnchor);
  if (!startMatch) return null;
  const tail = after.slice(startMatch[0].length);
  const endIdx = tail.search(endAnchor);
  if (endIdx < 0) return null;
  return tail.slice(0, endIdx);
}

// Locate the CHRONO_LURE activation case body. Slice from the case
// label forward until the next sibling case label or the switch's
// closing brace. Mirrors empLineCaseBody().
function chronoLureCaseBody() {
  const startIdx = CONTENT_NC.indexOf("case 'CHRONO_LURE':");
  assert.ok(startIdx !== -1, "activateHackware must contain a case 'CHRONO_LURE': branch in EXECUTABLE code");
  const tail = CONTENT_NC.slice(startIdx);
  const next = tail.search(/\n\s{4}case\s+'[A-Z_]+'|\n\s{2}\}\s*\n\s*\}/);
  return next > 0 ? tail.slice(0, next) : tail.slice(0, 6000);
}

// Reject dead branches in the case body — defence against
// regex-satisfying decoy class.
function chronoLureCaseBodyNoDead() {
  const body = chronoLureCaseBody();
  assert.ok(!hasDeadBranch(body),
    'CHRONO_LURE case body must not contain a `if (false) { ... }` dead branch (regex-satisfying decoy class)');
  return body;
}

// Locate the chrono_lure branch inside updateHackwareEffects. The
// branch opens with `if (fx.type === 'chrono_lure') {` — extract the
// brace-balanced block and reject dead-branch wrappers.
function chronoLureUpdateBlock() {
  const block = extractBlock(CONTENT_NC, /if\s*\(\s*fx\.type\s*===\s*'chrono_lure'\s*\)/);
  assert.ok(block, "updateHackwareEffects must contain a brace-balanced `if (fx.type === 'chrono_lure')` branch");
  assert.ok(!hasDeadBranch(block),
    'chrono_lure update branch must not contain a `if (false) { ... }` dead branch');
  return block;
}

// ─── Catalog registration ─────────────────────────────────────────────────

test('CHRONO_LURE is registered in the HACKWARE catalog with required fields', () => {
  // Without a catalog entry, drop tables / shop offers won't surface
  // CHRONO_LURE and the activation switch case is unreachable.
  const re = /CHRONO_LURE:\s*\{\s*name:\s*'[^']+',\s*desc:\s*'[^']+',\s*colour:\s*'#[0-9a-fA-F]+',\s*icon:\s*'[^']+',\s*cooldown:\s*\d+/;
  assert.match(CONTENT_NC, re,
    'CHRONO_LURE registry entry must declare name/desc/colour/icon/cooldown in EXECUTABLE code');
});

test('CHRONO_LURE cooldown sits in the heavy-CC band (relative to GRAVITY_WELL + sanity bounds)', () => {
  // Design intent: CHRONO_LURE pairs the pull payoff of GRAVITY_WELL
  // with a one-shot stun, so its cooldown should be in the same heavy-
  // CC band — meaningfully slower than the panic-button EMP_BURST
  // (10s) but no slower than GRAVITY_WELL (16s, the existing pure-pull
  // utility). Anchor relative to siblings so future rebalances of
  // EMP_BURST or GRAVITY_WELL don't fail this test as collateral, AND
  // pin sanity bounds so a lockstep rewrite (everything = 1) can't
  // satisfy the ordering trivially.
  const cdEmpBurst    = parseInt((CONTENT_NC.match(/EMP_BURST:[^}]*cooldown:\s*(\d+)/) || [])[1] || 'NaN', 10);
  const cdChronoLure  = parseInt((CONTENT_NC.match(/CHRONO_LURE:[^}]*cooldown:\s*(\d+)/) || [])[1] || 'NaN', 10);
  const cdGravityWell = parseInt((CONTENT_NC.match(/GRAVITY_WELL:[^}]*cooldown:\s*(\d+)/) || [])[1] || 'NaN', 10);
  assert.ok(Number.isFinite(cdEmpBurst) && Number.isFinite(cdChronoLure) && Number.isFinite(cdGravityWell),
    'all three cooldowns must be parseable integer literals');
  assert.ok(cdEmpBurst >= 6,
    `EMP_BURST cooldown (${cdEmpBurst}s) must be >= 6s (sanity floor — below this any active hackware becomes spam)`);
  assert.ok(cdGravityWell <= 30,
    `GRAVITY_WELL cooldown (${cdGravityWell}s) must be <= 30s (sanity ceiling — above this the heavy-CC family becomes useless)`);
  assert.ok(cdChronoLure > cdEmpBurst,
    `CHRONO_LURE cooldown (${cdChronoLure}s) must be > EMP_BURST (${cdEmpBurst}s) — burst stays the panic button, lure is the heavier setup`);
  assert.ok(cdChronoLure <= cdGravityWell,
    `CHRONO_LURE cooldown (${cdChronoLure}s) must be <= GRAVITY_WELL (${cdGravityWell}s) — gravity well is the existing pure-pull baseline`);
});

test('CHRONO_LURE colour and icon are distinct from GRAVITY_WELL', () => {
  // Both are pull-class hackware; players must distinguish HUD
  // cooldowns at a glance. GRAVITY_WELL owns #ff8800 orange and ◎;
  // CHRONO_LURE must NOT reuse either.
  const m = CONTENT_NC.match(/CHRONO_LURE:\s*\{\s*name:\s*'[^']+',\s*desc:\s*'[^']+',\s*colour:\s*'(#[0-9a-fA-F]+)',\s*icon:\s*'([^']+)'/);
  assert.ok(m, 'CHRONO_LURE registry entry must be parseable for colour+icon');
  const [, colour, icon] = m;
  assert.notEqual(colour.toLowerCase(), '#ff8800',
    'CHRONO_LURE colour must differ from GRAVITY_WELL (#ff8800) — HUD cooldown badges become indistinguishable otherwise');
  assert.notEqual(icon, '◎',
    'CHRONO_LURE icon must differ from GRAVITY_WELL (◎) — registry icons drive HUD badges and hackware shop entries');
});

test('CHRONO_LURE colour is perceptually distinct from HOLO_DECOY (no near-magenta collision)', () => {
  // HOLO_DECOY is #ff44ff (magenta-violet). Any chrono_lure colour
  // within ~30 RGB units is perceptually indistinguishable on screen,
  // and BOTH are placed-marker hackware that can render
  // simultaneously (player drops a holo decoy then a chrono lure
  // arms 5 tiles away — same colour family looks like one effect).
  // Caught by opus-4.6 r1 — initial colour #ff44dd had RGB distance
  // 34/441 from #ff44ff (7.7%, near-identical bright magenta).
  const m = CONTENT_NC.match(/CHRONO_LURE:[^}]*colour:\s*'(#[0-9a-fA-F]{6})'/);
  assert.ok(m, 'CHRONO_LURE colour must be parseable as a 6-digit hex');
  const cl = m[1].toLowerCase();
  // Parse the 6-digit hex into RGB components.
  const [clR, clG, clB] = [
    parseInt(cl.slice(1, 3), 16),
    parseInt(cl.slice(3, 5), 16),
    parseInt(cl.slice(5, 7), 16),
  ];
  // HOLO_DECOY canonical hex.
  const [hdR, hdG, hdB] = [0xff, 0x44, 0xff];
  const dist = Math.sqrt(
    (clR - hdR) * (clR - hdR) +
    (clG - hdG) * (clG - hdG) +
    (clB - hdB) * (clB - hdB)
  );
  assert.ok(dist >= 60,
    `CHRONO_LURE colour (${cl}) is too close to HOLO_DECOY (#ff44ff) — RGB distance ${dist.toFixed(1)} < 60 (perceptually-distinct floor); both render as placed markers and a near-magenta collision confuses readability`);
});

// ─── Activation case ──────────────────────────────────────────────────────

test('activateHackware has a CHRONO_LURE case that pushes a chrono_lure effect', () => {
  // The activate switch must own the deploy. Without the case the
  // cooldown burns but nothing spawns.
  const body = chronoLureCaseBody();
  assert.match(body, /hackwareEffects\.push\(\s*\{\s*type:\s*'chrono_lure'/,
    "CHRONO_LURE case must push a {type:'chrono_lure'} effect in EXECUTABLE code");
  assert.match(body, /armDuration:\s*\d+(?:\.\d+)?/,
    'chrono_lure effect must declare a numeric armDuration (the delay before the pull+stun fires)');
  assert.match(body, /maxAge:\s*\d+(?:\.\d+)?/,
    'chrono_lure effect must declare a finite maxAge (seconds) so the effect splices out');
  assert.match(body, /radius:\s*\d+/,
    'chrono_lure effect must declare a radius (the pull/stun area)');
  assert.match(body, /detonated:\s*false/,
    'chrono_lure effect must initialise detonated:false — the latch the update branch flips on arm-end');
});

test('CHRONO_LURE arming delay is at least 0.5s and at most 2s (telegraph window discipline)', () => {
  // The arming delay IS the niche distinguishing this from EMP_BURST
  // (instant) and GRAVITY_WELL (continuous). Too short (<0.5s) and
  // it's just an instant-cast with sparkles, indistinguishable from
  // GRAVITY_WELL. Too long (>2s) and enemies trivially walk out of
  // the radius before detonation, making the spell useless.
  const body = chronoLureCaseBody();
  const m = body.match(/armDuration:\s*(\d+(?:\.\d+)?)/);
  assert.ok(m, 'CHRONO_LURE case must declare armDuration as a numeric literal');
  const arm = parseFloat(m[1]);
  assert.ok(arm >= 0.5 && arm <= 2.0,
    `CHRONO_LURE armDuration (${arm}s) must be in [0.5, 2.0] — too short collapses into GRAVITY_WELL, too long lets enemies walk out before detonation`);
  // maxAge must exceed armDuration — otherwise the marker expires
  // BEFORE detonation and the entire spell is a no-op.
  const m2 = body.match(/maxAge:\s*(\d+(?:\.\d+)?)/);
  assert.ok(m2, 'CHRONO_LURE case must declare maxAge as a numeric literal');
  const maxAge = parseFloat(m2[1]);
  assert.ok(maxAge > arm,
    `CHRONO_LURE maxAge (${maxAge}s) must be > armDuration (${arm}s) — otherwise the marker expires before detonation and the spell is a no-op`);
});

test('CHRONO_LURE aim-places at cursor with wall fallback to player tile (matches DECOY_TURRET)', () => {
  // Without a wall fallback, an aim landing in a wall spawns the
  // marker inside the wall — enemies can't be pulled into a wall, so
  // the spell silently no-ops. Mirror DECOY_TURRET's "fall back to
  // player tile if aim lands in a non-passable tile" pattern.
  const body = chronoLureCaseBodyNoDead();
  // Allow an optional `/ <ident>` zoom factor between mouse.x and the
  // `+ camCL.x` term — the worldZoom feature divides the canvas-px
  // coordinate by `settings.worldZoom` before adding the cam (which is
  // in world-px units). Old shape `(mouse.x + camCL.x) / TILE` and new
  // shape `(mouse.x / _wzCL + camCL.x) / TILE` both pass.
  assert.match(body, /\(\s*mouse\.x\s*(?:\/\s*[a-zA-Z_$][\w$]*\s*)?\+\s*[a-zA-Z_$][\w$]*\.x\s*\)\s*\/\s*TILE/,
    'CHRONO_LURE must read aim x from `(mouse.x [/zoom] + cam.x) / TILE` (cursor-driven placement)');
  assert.match(body, /\(\s*mouse\.y\s*(?:\/\s*[a-zA-Z_$][\w$]*\s*)?\+\s*[a-zA-Z_$][\w$]*\.y\s*\)\s*\/\s*TILE/,
    'CHRONO_LURE must read aim y from `(mouse.y [/zoom] + cam.y) / TILE`');
  // Wall fallback: the test for the resolved tile must check both
  // T.FLOOR and T.DOOR_OPEN (both are valid spawn surfaces — closed
  // doors are not passable). Without the door check, players can't
  // place markers in doorways during room transitions.
  assert.match(body, /!==\s*T\.FLOOR\s*&&\s*[\s\S]{0,40}?!==\s*T\.DOOR_OPEN/,
    'CHRONO_LURE wall fallback must check `!== T.FLOOR && !== T.DOOR_OPEN` (closed doors are not passable spawn surfaces)');
});

test('CHRONO_LURE deduplicates: max 1 active marker (recasting replaces existing)', () => {
  // Spam-casting would chain detonations and trivialise the CC. Same
  // dedup contract as STATIC_FIELD/HOLO_DECOY/DECOY_TURRET — recast
  // splices the existing marker before pushing the new one. The dedup
  // loop must appear EXACTLY ONCE in the case body (sibling-
  // neutralizer bypass class — a second loop after the canonical one
  // could splice the freshly-pushed marker, defeating the cast).
  const body = chronoLureCaseBodyNoDead();
  const dedupRe = /for\s*\([^)]*hackwareEffects\.length[^)]*\)/g;
  const m = body.match(dedupRe) || [];
  assert.equal(m.length, 1,
    `CHRONO_LURE case must contain EXACTLY ONE dedup loop over hackwareEffects (sibling-neutralizer bypass class) — got ${m.length}`);
  assert.match(body, /hackwareEffects\[\s*j\s*\]\.type\s*===\s*'chrono_lure'/,
    'CHRONO_LURE dedup loop must filter on type === chrono_lure');
  assert.match(body, /hackwareEffects\.splice\(\s*j\s*,\s*1\s*\)/,
    'CHRONO_LURE dedup loop must splice matching entries');
});

test('CHRONO_LURE plays a dedicated audio cue (audio.hackwareChronoLure) on activation', () => {
  const body = chronoLureCaseBody();
  assert.match(body, /audio\.hackwareChronoLure\(\)/,
    'CHRONO_LURE case must call audio.hackwareChronoLure() on cast');
});

// ─── Update branch (per-frame) ────────────────────────────────────────────

test('updateHackwareEffects has a chrono_lure branch (per-frame logic exists)', () => {
  // Without an update branch the marker just sits there: no detonation,
  // no pull, no stun. Activation cost burns but nothing happens.
  const block = chronoLureUpdateBlock();
  assert.ok(block.length > 100,
    'chrono_lure update branch must contain meaningful per-frame logic (got near-empty body)');
});

test('chrono_lure detonation latches: stun fires EXACTLY ONCE at arm-end (full Math.max ternary anchored)', () => {
  // Without the !fx.detonated latch, every frame in the pull window
  // would re-stun, and bosses (which get reduced stun) would get
  // permanent CC. The latch must be SET to true INSIDE the gated
  // branch — without that write, the branch fires every frame.
  //
  // BYPASS-RESISTANT: pin the FULL Math.max expression including the
  // closing `);` — opus-4.7 r2 (on EMP_LINE) demonstrated that without
  // an end-of-expression anchor, a contributor can append `* 0` (zeros
  // every stun), `- 1000` (negative timer treated as not-stunned),
  // `, 999)` (third arg → permastun), or `&& 0` (returns 0). All
  // pass the regex but neutralise the spell.
  const block = chronoLureUpdateBlock();
  // The detonation gate must pin BOTH the latch check AND the age
  // comparison. A bypass that drops the latch (`if (fx.age >=
  // fx.armDuration)` alone) would re-stun every frame.
  assert.match(block, /if\s*\(\s*!fx\.detonated\s*&&\s*fx\.age\s*>=\s*fx\.armDuration\s*\)/,
    'chrono_lure must gate detonation on `!fx.detonated && fx.age >= fx.armDuration` — the latch prevents per-frame re-stun, the age check is the actual trigger');
  assert.match(block, /fx\.detonated\s*=\s*true\s*;/,
    'chrono_lure detonation block must set `fx.detonated = true;` — without it, the latch never trips and the block fires every frame after armDuration');
  // The stun assignment must use the full Math.max(prev, isBoss?
  // bossDur : gruntDur) form, end-anchored at `);`.
  assert.match(block, /e\.stunTimer\s*=\s*Math\.max\(\s*e\.stunTimer\s*\|\|\s*0\s*,\s*e\.isBoss\s*\?\s*0?\.\d+\s*:\s*\d+(?:\.\d+)?\s*\)\s*;/,
    'chrono_lure stun assignment must be the COMPLETE statement `e.stunTimer = Math.max(e.stunTimer || 0, e.isBoss ? bossDur : gruntDur);` — appending * 0 or extra args is a known bypass class');
  // BYPASS-RESISTANT (opus-4.7 r1 of CHRONO_LURE):
  // - The latch-set `fx.detonated = true;` MUST live INSIDE the gate
  //   body, not above it. A contributor placing `fx.detonated = true;`
  //   at the top of the chrono_lure block kills the entire spell:
  //   gate is permanently false → stun loop never fires → pull starts
  //   immediately at frame 0 (no telegraph).
  // - `fx.detonated = false` must NEVER appear in the update branch
  //   (only legitimately initialized in the activation case body). A
  //   `fx.detonated = true; fx.detonated = false;` pair re-arms the
  //   gate every frame after armDuration → permastun + every-frame
  //   audio + every-frame screenshake.
  const gateBlock = extractBlock(block, /if\s*\(\s*!fx\.detonated\s*&&\s*fx\.age\s*>=\s*fx\.armDuration\s*\)/);
  assert.ok(gateBlock, 'chrono_lure detonation gate must be brace-balanced');
  assert.match(gateBlock, /fx\.detonated\s*=\s*true\s*;/,
    '`fx.detonated = true;` must appear INSIDE the detonation gate body (latch-set-above-gate bypass class — opus-4.7 r1 of CHRONO_LURE)');
  const latchSetCount = (block.match(/fx\.detonated\s*=\s*true\s*;/g) || []).length;
  assert.equal(latchSetCount, 1,
    `\`fx.detonated = true;\` must appear EXACTLY ONCE in the chrono_lure update branch (got ${latchSetCount}) — duplicate sets admit the latch-set-above-gate bypass class`);
  assert.ok(!/fx\.detonated\s*=\s*false/.test(block),
    '`fx.detonated = false` must NOT appear in the chrono_lure update branch (latch-reset bypass class — opus-4.7 r1 of CHRONO_LURE)');
  // BYPASS-RESISTANT (opus-4.6 r1 of CHRONO_LURE): the detonation
  // audio cue MUST live INSIDE the gate body. If a contributor moves
  // `audio.hackwareChronoLureBoom()` outside the gate, it fires every
  // frame for the 0.6s pull window (~36 calls at 60fps), exhausting
  // the Web Audio oscillator bus and producing a buzzing wall of
  // sound.
  assert.match(gateBlock, /audio\.hackwareChronoLureBoom\(\)/,
    '`audio.hackwareChronoLureBoom()` must appear INSIDE the detonation gate body (audio-spam bypass class — opus-4.6 r1 of CHRONO_LURE)');
  const boomCount = (block.match(/audio\.hackwareChronoLureBoom\(\)/g) || []).length;
  assert.equal(boomCount, 1,
    `\`audio.hackwareChronoLureBoom()\` must appear EXACTLY ONCE in the chrono_lure update branch (got ${boomCount}) — duplicates outside the gate spam audio per frame`);
});

test('chrono_lure stun and pull loops each iterate enemies EXACTLY ONCE (sibling-neutralizer guard, all iterator shapes)', () => {
  // Per the EMP_LINE r2 finding: a sibling neutralizer loop after the
  // canonical loop can defeat every in-loop assertion. For
  // CHRONO_LURE, a sibling `for (const e of enemies) { e.stunTimer =
  // 0; }` after the stun loop would silently remove every stun. There
  // must be exactly TWO `for (const e of enemies)` loops in the
  // chrono_lure update branch — one for stunning at detonation, one
  // for the continuous pull.
  //
  // BYPASS-RESISTANT (opus-4.7 r1 of CHRONO_LURE): the for-of-only
  // count is defeated by other iterator shapes that still mutate
  // enemies — `enemies.forEach(e => { e.stunTimer = 0; })`,
  // `for (let i = 0; i < enemies.length; i++) enemies[i].stunTimer
  // = 0;`, `for (const e of enemies.values()) e.stunTimer = 0;`,
  // `enemies.map(e => { e.stunTimer = 0; })`, etc. We assert no
  // OTHER iterator shapes appear in the update block.
  const block = chronoLureUpdateBlock();
  const re = /for\s*\(\s*const\s+e\s+of\s+enemies\s*\)/g;
  const matches = block.match(re) || [];
  assert.equal(matches.length, 2,
    `chrono_lure update branch must contain EXACTLY TWO \`for (const e of enemies)\` loops (one stun, one pull) — got ${matches.length}; extras admit sibling-neutralizer bypass`);
  // Reject other iterator shapes that touch enemies.
  /** @type {[string, RegExp][]} */
  const forbiddenIterators = [
    ['enemies.forEach',  /\benemies\s*\.\s*forEach\s*\(/g],
    ['enemies.map',      /\benemies\s*\.\s*map\s*\(/g],
    ['enemies.filter',   /\benemies\s*\.\s*filter\s*\(/g],
    ['enemies.reduce',   /\benemies\s*\.\s*reduce\s*\(/g],
    ['enemies.some',     /\benemies\s*\.\s*some\s*\(/g],
    ['enemies.every',    /\benemies\s*\.\s*every\s*\(/g],
    ['enemies.find',     /\benemies\s*\.\s*find\s*\(/g],
    ['enemies.values',   /\benemies\s*\.\s*values\s*\(/g],
    ['enemies.keys',     /\benemies\s*\.\s*keys\s*\(/g],
    ['enemies.entries',  /\benemies\s*\.\s*entries\s*\(/g],
    ['enemies[i] write', /\benemies\s*\[\s*[a-zA-Z_$][\w$]*\s*\]\s*\.[a-zA-Z_$][\w$]*\s*=/g],
    ['indexed for-loop', /for\s*\(\s*let\s+\w+\s*=\s*0\s*;\s*\w+\s*<\s*enemies\.length\s*;/g],
  ];
  for (const [label, fre] of forbiddenIterators) {
    const m = block.match(fre);
    assert.ok(!m,
      `chrono_lure update branch must NOT use \`${label}\` (alternate-iterator bypass class — opus-4.7 r1 of CHRONO_LURE; would mutate enemies outside the canonical for-of loops)`);
  }
});

test('chrono_lure stun loop applies LOS gate, half-stun for bosses, and skips disguised + phased mobs (single stunTimer write)', () => {
  // LOS gate prevents through-wall stuns at the radius boundary.
  // Bosses get reduced stun (matches EMP_BURST/EMP_LINE precedent —
  // without it, players could stun-lock a boss permanently by
  // chaining CHRONO_LURE + EMP_BURST). Disguised mimics skipped to
  // avoid mid-fight identity reveal via STUN floater. _wrPhased
  // skipped — phased units are non-targetable per gravity-well
  // precedent.
  //
  // BYPASS-RESISTANT (codex r1 of CHRONO_LURE): the stun loop body
  // must contain EXACTLY ONE `e.stunTimer =` write. A contributor can
  // write `e.stunTimer = Math.max(...)` followed by `e.stunTimer =
  // 0;` immediately after — passes presence regex but breaks runtime.
  const block = chronoLureUpdateBlock();
  // The stun loop is the FIRST `for (const e of enemies)` in the
  // block — extract its body via extractBlock.
  const stunLoop = extractBlock(block, /for\s*\(\s*const\s+e\s+of\s+enemies\s*\)/);
  assert.ok(stunLoop, 'chrono_lure stun loop must be brace-balanced');
  assert.ok(!hasDeadBranch(stunLoop),
    'chrono_lure stun loop body must not contain a `if (false) { ... }` dead branch (or an always-true early-exit gate)');
  assert.match(stunLoop, /if\s*\(\s*e\._disguised\s*\)\s*continue/,
    'chrono_lure stun loop must skip disguised mimics (no mid-fight identity reveal via STUN floater)');
  assert.match(stunLoop, /if\s*\(\s*e\._wrPhased\s*\)\s*continue/,
    'chrono_lure stun loop must skip _wrPhased mobs (phased units are non-targetable per gravity-well precedent)');
  assert.match(stunLoop, /map\s*&&\s*hasLOS\(\s*e\.x\s*,\s*e\.y\s*,\s*fx\.x\s*,\s*fx\.y\s*,\s*map\s*\)/,
    'chrono_lure stun loop must require LOS from enemy to marker centre (prevents through-wall stuns at radius boundary)');
  // Single stunTimer write — defeats overwrite-after-Math.max bypass.
  const stunWrites = (stunLoop.match(/\be\.stunTimer\s*=/g) || []).length;
  assert.equal(stunWrites, 1,
    `chrono_lure stun loop body must contain EXACTLY ONE \`e.stunTimer =\` write (got ${stunWrites}) — overwrite bypass class (codex r1 of CHRONO_LURE: \`e.stunTimer = Math.max(...); e.stunTimer = 0;\` zeros every stun)`);
});

test('chrono_lure pull loop skips bosses, skips disguised + phased, and uses moveToward (collision-aware)', () => {
  // Bosses are immune to forced movement — same contract as
  // GRAVITY_WELL. Without the boss skip, a CHRONO_LURE could yank a
  // boss across a chasm or out of an arena. Disguised + _wrPhased
  // skipped for the same reasons as the stun loop. moveToward (vs
  // raw position write) preserves wall collision — without it,
  // enemies would teleport through walls toward the marker.
  //
  // The pull loop is the SECOND `for (const e of enemies)` — extract
  // it by slicing past the first one and re-extracting.
  const block = chronoLureUpdateBlock();
  const firstLoop = extractBlock(block, /for\s*\(\s*const\s+e\s+of\s+enemies\s*\)/);
  assert.ok(firstLoop, 'first enemies loop must be brace-balanced');
  const afterFirst = block.slice(block.indexOf(firstLoop) + firstLoop.length);
  const pullLoop = extractBlock(afterFirst, /for\s*\(\s*const\s+e\s+of\s+enemies\s*\)/);
  assert.ok(pullLoop, 'chrono_lure pull loop must be brace-balanced (the SECOND enemies loop in the update branch)');
  assert.ok(!hasDeadBranch(pullLoop),
    'chrono_lure pull loop body must not contain a `if (false) { ... }` dead branch');
  assert.match(pullLoop, /if\s*\(\s*e\.dead\s*\|\|\s*e\.isBoss\s*\)\s*continue/,
    'chrono_lure pull loop must skip dead AND boss enemies (bosses are immune to forced movement per GRAVITY_WELL precedent)');
  assert.match(pullLoop, /if\s*\(\s*e\._disguised\s*\)\s*continue/,
    'chrono_lure pull loop must skip disguised mimics');
  assert.match(pullLoop, /if\s*\(\s*e\._wrPhased\s*\)\s*continue/,
    'chrono_lure pull loop must skip _wrPhased mobs');
  assert.match(pullLoop, /e\.moveToward\(\s*fx\.x\s*,\s*fx\.y\s*,/,
    'chrono_lure pull loop must use e.moveToward (collision-aware) — direct position writes would teleport enemies through walls');
});

test('chrono_lure pull loop runs ONLY after detonation (gated on fx.detonated)', () => {
  // Without the `if (fx.detonated)` gate, enemies would be pulled
  // during the arming phase too — that defeats the design intent
  // (arming = no effect, telegraph only). Slice from the second
  // enemies loop back to find the gate that opens above it.
  const block = chronoLureUpdateBlock();
  // Find the second enemies loop position (the pull loop).
  const re = /for\s*\(\s*const\s+e\s+of\s+enemies\s*\)/g;
  let firstPos = -1, secondPos = -1;
  let mm;
  while ((mm = re.exec(block)) !== null) {
    if (firstPos < 0) firstPos = mm.index;
    else { secondPos = mm.index; break; }
  }
  assert.ok(secondPos > 0, 'chrono_lure update branch must contain a second `for (const e of enemies)` loop (the pull loop)');
  // Slice back ~200 chars to find the gating `if (fx.detonated)` that
  // opens above the pull loop.
  const lookback = block.slice(Math.max(0, secondPos - 300), secondPos);
  assert.match(lookback, /if\s*\(\s*fx\.detonated\s*\)\s*\{/,
    'chrono_lure pull loop must be inside an `if (fx.detonated) { ... }` gate — without it the pull starts during arming, defeating the telegraph window');
});

// ─── Visual + audio + cooldown ────────────────────────────────────────────

test('drawHackwareEffects has a chrono_lure draw branch with BOTH arming and detonation visuals (each phase has primitives)', () => {
  // Without a draw branch the marker is invisible — players can't
  // anticipate the detonation, defeating the entire telegraph design.
  // Both visual phases (arming countdown, detonation vortex) must
  // exist; otherwise either the arming phase is invisible (player has
  // no warning) or the detonation is invisible (player can't read the
  // payoff).
  //
  // BYPASS-RESISTANT (codex r1 of CHRONO_LURE): the original
  // assertion required `!fx.detonated` (arming phase) but only
  // checked for ANY draw primitive in the whole branch — a
  // contributor could remove or empty the detonation `else` body and
  // still pass. Now we require BOTH phases each contain at least one
  // draw primitive (NEON.draw.* or ctx.fill*/ctx.stroke*), proven by
  // a sliceBetween anchor between the `else` open and the close.
  const drawBlock = extractBlock(CONTENT_NC, /if\s*\(\s*fx\.type\s*===\s*'chrono_lure'\s*\)/);
  assert.ok(drawBlock, "drawHackwareEffects must contain a brace-balanced `if (fx.type === 'chrono_lure')` draw branch");
  // Find the SECOND chrono_lure block in the file — the first is the
  // update branch, the second is the draw branch (since draw uses
  // canvas APIs ctx.save / NEON.draw.*).
  let drawIdx = -1;
  let count = 0;
  const re = /if\s*\(\s*fx\.type\s*===\s*'chrono_lure'\s*\)/g;
  let m;
  while ((m = re.exec(CONTENT_NC)) !== null) {
    count++;
    if (count === 2) { drawIdx = m.index; break; }
  }
  assert.ok(drawIdx >= 0, 'CONTENT must contain TWO chrono_lure branches (update + draw)');
  const drawSlice = extractBlock(CONTENT_NC.slice(drawIdx), /if\s*\(\s*fx\.type\s*===\s*'chrono_lure'\s*\)/);
  assert.ok(drawSlice, 'chrono_lure draw branch must be brace-balanced');
  assert.ok(!hasDeadBranch(drawSlice),
    'chrono_lure draw branch must not contain a dead branch (or always-true early-exit gate) wrapping a phase');
  assert.match(drawSlice, /ctx\.save\(\)/,
    'chrono_lure draw branch must call ctx.save() (canvas state isolation per existing draw-branch convention)');
  assert.match(drawSlice, /NEON\.draw\.(?:circle|circleStroke|line)/,
    'chrono_lure draw branch must use NEON.draw.* primitives (the canonical draw API)');
  // Arming phase (!fx.detonated) — extract block + require primitive.
  assert.match(drawSlice, /if\s*\(\s*!fx\.detonated\s*\)\s*\{/,
    'chrono_lure draw branch must contain `if (!fx.detonated) { ... }` arming phase');
  const armingBlock = extractBlock(drawSlice, /if\s*\(\s*!fx\.detonated\s*\)/);
  assert.ok(armingBlock, 'arming phase block must be brace-balanced');
  assert.match(armingBlock, /NEON\.draw\.(?:circle|circleStroke|line)/,
    'arming-phase block must contain at least one NEON.draw.* primitive (player needs the countdown telegraph)');
  // Detonation phase — slice from the arming block's close brace
  // (`} else {` or `}` followed by an else opener) to the chrono_lure
  // branch close. Requires explicit `else { ... }` with a draw
  // primitive inside.
  const armingEnd = drawSlice.indexOf(armingBlock) + armingBlock.length;
  const afterArming = drawSlice.slice(armingEnd);
  assert.match(afterArming, /^\s*else\s*\{/,
    'chrono_lure draw branch must follow the arming phase with `else { ... }` (the detonation visual) — without an explicit else body, the detonation phase has no visual (codex r1 of CHRONO_LURE)');
  // Extract the else body and require a draw primitive inside it.
  const elseBody = extractBlock(afterArming, /else\s*\{/);
  assert.ok(elseBody, 'detonation `else { ... }` block must be brace-balanced');
  assert.ok(!hasDeadBranch(elseBody),
    'detonation else body must not contain a dead branch (or always-true early-exit gate)');
  assert.match(elseBody, /NEON\.draw\.(?:circle|circleStroke|line)/,
    'detonation else body must contain at least one NEON.draw.* primitive (player needs the detonation visual to read the payoff)');
});

test('CHRONO_LURE plays a detonation audio cue (audio.hackwareChronoLureBoom)', () => {
  // The arming chime hackwareChronoLure() is asserted at the
  // activation case; the detonation cue is a separate sound called
  // from the update branch when the latch flips. Without it, the
  // detonation lands silently — players miss the arm-end transition.
  const block = chronoLureUpdateBlock();
  assert.match(block, /audio\.hackwareChronoLureBoom\(\)/,
    'chrono_lure update branch must call audio.hackwareChronoLureBoom() at detonation (separate from the arming chime)');
});

test('audio.hackwareChronoLure and audio.hackwareChronoLureBoom are defined in platform.js', () => {
  // Without the audio methods, activation/detonation crash at the
  // call sites.
  assert.match(PLATFORM_NC, /hackwareChronoLure\s*\(\s*\)\s*\{/,
    'platform.js must define an audio.hackwareChronoLure() method (otherwise activation crashes)');
  assert.match(PLATFORM_NC, /hackwareChronoLureBoom\s*\(\s*\)\s*\{/,
    'platform.js must define an audio.hackwareChronoLureBoom() method (otherwise detonation crashes)');
});

// ─── SW cache invalidation ────────────────────────────────────────────────

test('sw.js uses network-first freshness instead of numeric cache versions', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /cacheFromNetwork\(e\)\.catch\(\(\) => caches\.match\(e\.request\)\)/);
});
