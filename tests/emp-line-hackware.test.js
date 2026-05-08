'use strict';
// EMP_LINE hackware — source-text wiring tests.
//
// EMP_LINE is the directional-beam counterpart to EMP_BURST. It trades
// EMP_BURST's 4-tile radius (~50 tile area, all-around panic button) for
// an 8-tile reach in a single direction (~8 tile area, narrow lane).
// Niche: long-range crowd control + electronics disable on a clean lane.
// Cooldown 11s sits between EMP_BURST (10s) and STATIC_FIELD (12s) so the
// burst stays the panic-button and the line is the deliberate sweep.
//
// content.js is browser-only (no UMD/CommonJS exports), so we can't load
// activateHackware()/drawHackwareEffects() under node:test. Instead, these
// tests assert the structural invariants any working EMP_LINE must satisfy:
// catalog entry, activation case, aim+sweep wiring, WRAITH bypass +
// emerge (matching EMP_BURST), electronics surface (lasers/turrets/
// shield-gens/cameras/disruption-fields/gravity-wells), draw branch,
// audio binding, and the SW cache floor that ships the new code to
// existing users.
//
// Pattern matches tests/blink-hackware.test.js + tests/hackware.test.js.
//
// All regex assertions run against COMMENT-STRIPPED source (CONTENT_NC).
// content.js will accumulate explanatory comments mentioning EMP_LINE
// (the case body itself documents the design intent), so a future edit
// could easily land a comment that satisfies a presence regex even after
// the executable code was removed. Stripping comments first closes that
// hole and matches the precedent set by tests/hackware.test.js,
// mark-affix, reverse-polarity, bulwark, hot-hand, glass-cannon (PR #209).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content', 'hackware.js'), 'utf8'
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

// Locate the EMP_LINE case body. Anchor on the case label and slice
// forward until the next sibling case label or the switch's closing
// brace. Mirrors blinkCaseBody() in tests/blink-hackware.test.js.
function empLineCaseBody() {
  const startIdx = CONTENT_NC.indexOf("case 'EMP_LINE':");
  assert.ok(startIdx !== -1, "activateHackware must contain a case 'EMP_LINE': branch in EXECUTABLE code");
  const tail = CONTENT_NC.slice(startIdx);
  const next = tail.search(/\n\s{4}case\s+'[A-Z_]+'|\n\s{2}\}\s*\n\s*\}/);
  return next > 0 ? tail.slice(0, next) : tail.slice(0, 6000);
}

// Brace-balanced extraction of the FIRST block opened by openerRe in src.
// Used to isolate the per-iteration body of the enemy stun loop so we can
// assert that key literals/expressions live INSIDE the loop, not just
// somewhere in the case body. Without this, a contributor can drop a
// canonical block in dead code (`if (false) { ... }`) elsewhere in the
// case and satisfy presence-only regex assertions while the real loop
// runs broken behavior. (See review-opus47 round-1 finding "WRAITH-emerge
// block can sit in dead code" — concrete bypass code given.)
//
// LIMITATION: naive depth counter — does NOT understand string/regex
// literals. The current EMP_LINE case has no braces inside string
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

// Detects compile-time-falsy `if` openers commonly used to wrap canonical
// regex-satisfying code in unreachable branches. Beyond `false`/`0` we
// also reject `!true`, `!1`, `void 0`, `null`, `undefined`, `NaN`, and
// negated string/numeric literals — opus-4.7 r2 demonstrated that
// `if (!true) { ... }` defeated the original literal-only detector.
// Extend further if a future review surfaces a new falsy opener.
/** @param {string} slice */
function hasDeadBranch(slice) {
  return /\bif\s*\(\s*(?:!\s*true|!\s*1|!\s*'[^']*'|!\s*"[^"]*"|false|0|void\s+0|null|undefined|NaN|\!Boolean\(0\)|0\s*===\s*1|1\s*>\s*2|1\s*===\s*0)\s*\)\s*\{/.test(slice);
}

// Slice between two MUST-RUN anchors. Use this when "regex matches inside
// the case body" or even "regex matches inside the loop body" isn't
// enough — a future contributor can wrap the canonical block in a dead
// branch the detector doesn't recognise. By extracting the slice between
// two specific lines that any working implementation MUST execute on
// every iteration (e.g. the post-LOS-gate `continue` and the stun
// assignment that follows), we guarantee any matched assertion lives on
// the actual hot path. Returns null if either anchor is missing.
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

// Extract the per-iteration body of `for (const e of enemies) { ... }`
// inside the EMP_LINE case. Errors loudly if the loop is missing.
// REJECTS multiple matching loops in the case body (sibling-neutralizer
// bypass class — opus-4.7 r2 demonstrated a second `for (const e of
// enemies) { e.stunTimer = 0; }` after the canonical loop defeats every
// in-loop assertion because extractBlock only returns the FIRST match).
function empLineEnemyLoopBody() {
  const body = empLineCaseBody();
  const re = /for\s*\(\s*const\s+e\s+of\s+enemies\s*\)/g;
  const matches = body.match(re) || [];
  assert.equal(matches.length, 1,
    `EMP_LINE case must contain EXACTLY ONE \`for (const e of enemies)\` loop (sibling-neutralizer bypass class) — got ${matches.length}`);
  const block = extractBlock(body, /for\s*\(\s*const\s+e\s+of\s+enemies\s*\)/);
  assert.ok(block, 'EMP_LINE enemy loop must be brace-balanced');
  assert.ok(!hasDeadBranch(block),
    'EMP_LINE enemy-loop body must not contain a dead branch (regex-satisfying decoy class)');
  return block;
}

// Extract the EMP_LINE case body with dead branches forbidden — used
// as a defence for presence-only assertions that aren't loop-scoped.
function empLineCaseBodyNoDead() {
  const body = empLineCaseBody();
  assert.ok(!hasDeadBranch(body),
    'EMP_LINE case body must not contain a `if (false) { ... }` dead branch (regex-satisfying decoy class)');
  return body;
}

// ─── Catalog registration ─────────────────────────────────────────────────

test('EMP_LINE is registered in the HACKWARE catalog with required fields', () => {
  // Without a catalog entry, drop tables / shop offers won't surface
  // EMP_LINE and the activation switch case is unreachable.
  const re = /EMP_LINE:\s*\{\s*name:\s*'[^']+',\s*desc:\s*'[^']+',\s*colour:\s*'#[0-9a-fA-F]+',\s*icon:\s*'[^']+',\s*cooldown:\s*\d+/;
  assert.match(CONTENT_NC, re,
    'EMP_LINE registry entry must declare name/desc/colour/icon/cooldown in EXECUTABLE code');
});

test('EMP_LINE cooldown sits between EMP_BURST and STATIC_FIELD (relative ordering + sanity floor)', () => {
  // Design intent: the line is the deliberate sweep; the burst stays
  // the panic button. Anchor relative to siblings so future rebalances
  // of EMP_BURST or STATIC_FIELD don't fail this test as collateral.
  // Codex review of the initial PR called out the prior absolute
  // [10,12] band as too tight — switching to relative ordering keeps
  // the design constraint without locking in the literal numbers.
  //
  // BYPASS-RESISTANT: opus-4.7 r2 noted that pure relative ordering
  // admits a lockstep rewrite (EMP_BURST=1/EMP_LINE=2/STATIC_FIELD=3
  // satisfies the ordering but trivially trivialises every cooldown).
  // Add a sanity floor on EMP_BURST itself (>= 6s — the rough lower
  // bound below which any active hackware becomes spam) and a ceiling
  // on STATIC_FIELD (<= 30s — above which the family becomes useless).
  const cdEmpBurst   = parseInt((CONTENT_NC.match(/EMP_BURST:[^}]*cooldown:\s*(\d+)/) || [])[1] || 'NaN', 10);
  const cdEmpLine    = parseInt((CONTENT_NC.match(/EMP_LINE:[^}]*cooldown:\s*(\d+)/) || [])[1] || 'NaN', 10);
  const cdStaticFld  = parseInt((CONTENT_NC.match(/STATIC_FIELD:[^}]*cooldown:\s*(\d+)/) || [])[1] || 'NaN', 10);
  assert.ok(Number.isFinite(cdEmpBurst) && Number.isFinite(cdEmpLine) && Number.isFinite(cdStaticFld),
    'all three cooldowns must be parseable integer literals');
  assert.ok(cdEmpBurst >= 6,
    `EMP_BURST cooldown (${cdEmpBurst}s) must be >= 6s (sanity floor — below this any active hackware becomes spam)`);
  assert.ok(cdStaticFld <= 30,
    `STATIC_FIELD cooldown (${cdStaticFld}s) must be <= 30s (sanity ceiling — above this the EMP family becomes useless)`);
  assert.ok(cdEmpLine > cdEmpBurst,
    `EMP_LINE cooldown (${cdEmpLine}s) must be > EMP_BURST (${cdEmpBurst}s) — burst stays the panic button`);
  assert.ok(cdEmpLine <= cdStaticFld,
    `EMP_LINE cooldown (${cdEmpLine}s) must be <= STATIC_FIELD (${cdStaticFld}s) — the line is a deliberate sweep, not slower than a zone-deploy`);
});

test('EMP_LINE colour and icon are distinct from EMP_BURST', () => {
  // The two EMPs must read as visually distinct so the player can tell
  // at a glance which is on cooldown. EMP_BURST owns #00ddff cyan and
  // ⚡; EMP_LINE must NOT reuse either.
  const m = CONTENT_NC.match(/EMP_LINE:\s*\{\s*name:\s*'[^']+',\s*desc:\s*'[^']+',\s*colour:\s*'(#[0-9a-fA-F]+)',\s*icon:\s*'([^']+)'/);
  assert.ok(m, 'EMP_LINE registry entry must be parseable for colour+icon');
  const [, colour, icon] = m;
  assert.notEqual(colour.toLowerCase(), '#00ddff',
    'EMP_LINE colour must differ from EMP_BURST (#00ddff) — HUD cooldown badges become indistinguishable otherwise');
  assert.notEqual(icon, '⚡',
    'EMP_LINE icon must differ from EMP_BURST (⚡) — registry icons drive HUD badges and hackware shop entries');
});

// ─── Activation case ──────────────────────────────────────────────────────

test('activateHackware has an EMP_LINE case that pushes an emp_line effect', () => {
  // The activate switch must own the deploy. Without the case the
  // cooldown burns but nothing spawns.
  const body = empLineCaseBody();
  assert.match(body, /hackwareEffects\.push\(\s*\{\s*type:\s*'emp_line'/,
    "EMP_LINE case must push a {type:'emp_line'} effect in EXECUTABLE code");
  assert.match(body, /x1:\s*player\.x[\s\S]{0,80}?y1:\s*player\.y/,
    'emp_line effect must record beam start at player position');
  assert.match(body, /x2:\s*endX[\s\S]{0,80}?y2:\s*endY/,
    'emp_line effect must record beam endpoint from the swept endX/endY');
  assert.match(body, /maxAge:\s*0?\.\d+/,
    'emp_line effect must declare a finite maxAge (seconds) so the visual fades');
});

// ─── Aim wiring (mirrors BLINK pattern) ───────────────────────────────────

test('EMP_LINE reads aim from mouse with a player.facing fallback (matches BLINK)', () => {
  // Same input shape as dash + BLINK — mouse → norm() → if both axes
  // zero, fall back to player.facing. Without the facing fallback,
  // clicking on yourself produces a no-op even though the player IS
  // facing somewhere; without the lockAimToMove gate, lock-aim users
  // get a mouse-aimed beam that ignores their explicit setting.
  const body = empLineCaseBody();
  assert.match(body, /norm\(\s*ax\s*,\s*ay\s*\)/,
    'EMP_LINE must normalise the mouse-aim vector via norm()');
  assert.match(body, /if\s*\(\s*!edx\s*&&\s*!edy\s*\)\s*\{\s*edx\s*=\s*player\.facing\.x;\s*edy\s*=\s*player\.facing\.y/,
    'EMP_LINE must fall back to player.facing when the aim vector is zero');
  assert.match(body, /settings\.lockAimToMove/,
    'EMP_LINE must respect the lockAimToMove setting (otherwise lock-aim users get a mouse-aimed beam that ignores their setting)');
});

// ─── Wall-aware swept endpoint ────────────────────────────────────────────

test('EMP_LINE uses a swept endpoint, not a single-snap projection', () => {
  // Per the stored 'knockback sweeping' / BLINK rule: any single-snap
  // multi-tile displacement can tunnel through 1-tile-thick interior
  // walls. EMP_LINE projects 8 tiles, so it MUST sweep tile-by-tile
  // and stop at the first wall. Anchor on the for-loop with a bounded
  // STEP and an isPassable gate.
  //
  // BYPASS-RESISTANT: also pin STEP_E as the literal multiplier in the
  // step expression — without this, a contributor can keep `STEP_E =
  // 0.25` as a decoy declaration while the real step uses `* 1.0`,
  // restoring the wall-tunneling bug. Same shape for STEPS_E: pin the
  // formula `Math.ceil(MAX_LEN / STEP_E)` so a hard-coded `STEPS_E =
  // 16` can't silently halve the reach. (See opus-4.7 r1 findings 1+2,
  // both with concrete bypass code.)
  const body = empLineCaseBodyNoDead();
  assert.match(body, /for\s*\(\s*let\s+s\s*=\s*1;\s*s\s*<=\s*STEPS_E/,
    'EMP_LINE must sweep in a for-loop, not jump to (player.x + dx*8)');
  assert.match(body, /STEP_E\s*=\s*0\.25/,
    'EMP_LINE step must declare STEP_E = 0.25 (knockback-sweeping rule; matches BLINK precedent)');
  assert.match(body, /STEPS_E\s*=\s*Math\.ceil\(\s*MAX_LEN\s*\/\s*STEP_E\s*\)/,
    'STEPS_E must derive from MAX_LEN/STEP_E so a contributor can\'t hard-code a smaller step count to silently halve reach');
  assert.match(body, /edx\s*\*\s*s\s*\*\s*STEP_E/,
    'sweep x-step must consume STEP_E directly (`edx * s * STEP_E`) — without this STEP_E is a decoy and the real step can be 1.0, reintroducing wall tunneling');
  assert.match(body, /edy\s*\*\s*s\s*\*\s*STEP_E/,
    'sweep y-step must consume STEP_E directly (`edy * s * STEP_E`) — same decoy class as the x-axis');
  assert.match(body, /isPassable\(map\[fy\]\[fx\]\)/,
    'EMP_LINE sweep must terminate at the first non-passable tile (T.WALL, LOCKED_R/B/G, sealed entrances)');
});

test('EMP_LINE sweep range is 8 tiles (MAX_LEN consumed by STEPS_E)', () => {
  // The 8-tile reach IS the niche distinguishing this from EMP_BURST
  // (4-tile radius). A regression that drops it to e.g. 4 collapses
  // the LINE into "same range as BURST but skinnier" — pointless.
  // The previous-test STEPS_E = Math.ceil(MAX_LEN / STEP_E) assertion
  // pins MAX_LEN as a real consumer, not just a decoy declaration.
  const body = empLineCaseBodyNoDead();
  assert.match(body, /MAX_LEN\s*=\s*8\b/,
    'EMP_LINE must declare MAX_LEN = 8 (the design reach distinguishing it from EMP_BURST radius 4)');
});

// ─── Enemy stun loop ──────────────────────────────────────────────────────

test('EMP_LINE stuns enemies along the beam segment (point-to-segment width gate)', () => {
  // The stun gate must be SEGMENT distance, not RADIUS distance — the
  // whole point of the LINE is its narrow width. Anchor on segDist2
  // (the inlined helper) plus a WIDTH_SQ comparison INSIDE the enemy
  // loop body — without the in-loop scoping, a contributor can keep
  // `WIDTH_SQ` as a decoy declaration and gate on an unrelated
  // `REAL_W2 = 16` constant, collapsing the narrow-lane identity into
  // a fat omni-radius blob (see opus-4.7 r1 finding 3 with concrete
  // bypass code).
  const body = empLineCaseBodyNoDead();
  assert.match(body, /WIDTH_SQ\s*=\s*WIDTH\s*\*\s*WIDTH/,
    'EMP_LINE must precompute WIDTH_SQ for the squared-distance gate');
  const loopBody = empLineEnemyLoopBody();
  assert.match(loopBody, /segDist2\(\s*e\.x\s*,\s*e\.y\s*\)\s*>\s*WIDTH_SQ\s*\)\s*continue/,
    'EMP_LINE enemy LOOP BODY must skip enemies outside the beam width via `segDist2(e.x,e.y) > WIDTH_SQ` (in-loop scoping closes the WIDTH_SQ-decoy bypass)');
  assert.match(loopBody, /e\.stunTimer\s*=\s*Math\.max\(\s*e\.stunTimer\s*\|\|\s*0\s*,/,
    'EMP_LINE must apply stun via Math.max(prev, dur) so longer existing stuns are not overwritten');
});

test('EMP_LINE stun durations: bosses get the halved value via Math.max ternary (full-expression anchored)', () => {
  // EMP_BURST applies 2s grunt / 1s boss. EMP_LINE applies 1.5s grunt
  // / 0.75s boss — the line is shorter to compensate for piercing
  // reach. Both ratios are halved for bosses; without the boss check,
  // a player landing the LINE on a boss room could stun-lock the boss
  // for the same duration as a grunt.
  //
  // BYPASS-RESISTANT: pin the FULL Math.max expression including the
  // closing `);` — opus-4.7 r2 demonstrated that without an
  // end-of-expression anchor, a contributor can append `* 0` (zeros
  // every stun), `- 1000` (negative timer treated as not-stunned),
  // `, 999)` (third arg → permastun), or `&& 0` (returns 0). All
  // pass the regex but neutralise the spell.
  const loopBody = empLineEnemyLoopBody();
  assert.match(loopBody, /e\.stunTimer\s*=\s*Math\.max\(\s*e\.stunTimer\s*\|\|\s*0\s*,\s*e\.isBoss\s*\?\s*0?\.\d+\s*:\s*\d+(?:\.\d+)?\s*\)\s*;/,
    'EMP_LINE boss-halved stun must be the COMPLETE statement `e.stunTimer = Math.max(e.stunTimer || 0, e.isBoss ? bossDur : gruntDur);` — appending * 0 or extra args is a known bypass class');
});

test('EMP_LINE LOS gate bypasses _wrPhased (matches EMP_BURST WRAITH/TUNNELLER hard-counter)', () => {
  // Per the stored EMP-bypass contract: phase doesn't protect from
  // EMP. WRAITH and TUNNELLER both use the shared `_wrPhased` flag
  // while burrowed. Without this bypass the line would whiff entirely
  // on a phased mob even though it's "right there". Loop-body scoped
  // so a comment elsewhere can't satisfy the gate.
  const loopBody = empLineEnemyLoopBody();
  assert.match(loopBody, /e\._wrPhased\s*\?\s*true\s*:\s*\(?\s*map\s*&&\s*hasLOS/,
    'EMP_LINE LOS gate inside the enemy loop must bypass for _wrPhased mobs (WRAITH/TUNNELLER) — phase doesn\'t protect from EMP');
});

test('EMP_LINE WRAITH-emerge runs INSIDE the enemy loop between LOS-gate and stun assignment', () => {
  // Mirror EMP_BURST's WRAITH-emerge handler verbatim — without it,
  // stunning a phased WRAITH leaves it visually phased while frozen,
  // breaking the visual invariant that stunned mobs are visible.
  // TUNNELLER intentionally NOT handled here; its own stun handler
  // runs next frame and performs the proper _tnState→'surfaced'
  // transition. Writing _wrState here for a TUNNELLER would
  // contaminate two state machines (same caveat as EMP_BURST).
  //
  // BYPASS-RESISTANT (round 3): the emerge code must execute on every
  // matching iteration. Earlier rounds anchored "inside the enemy
  // loop" + "no dead branches", but opus-4.7 r2 demonstrated that an
  // expanded falsy-opener vocabulary (`if (!true)`, `if (void 0)`,
  // …) can defeat dead-branch detection forever. The bulletproof fix
  // is a SLICE-BETWEEN anchor: extract the slice between the
  // post-LOS-gate `continue` and the stun-assignment `Math.max(...)`
  // line. Any working implementation must run the emerge handler in
  // exactly that window. Wrapping it in a dead-branch wrapper still
  // matches the regex on the slice, BUT the slice itself rejects any
  // `if (` opener that isn't the canonical `_wrPhased && type` guard
  // — i.e. we forbid a leading `if (` that introduces a dead wrapper.
  const loopBody = empLineEnemyLoopBody();
  const slice = sliceBetween(
    loopBody,
    /if\s*\(\s*!losOk\s*\)\s*continue\s*;/,
    /e\.stunTimer\s*=\s*Math\.max/
  );
  assert.ok(slice !== null,
    'EMP_LINE enemy loop must contain `if (!losOk) continue;` ... `e.stunTimer = Math.max(...)` in that order, with the WRAITH-emerge handler between them');
  // Defence-in-depth: the slice between LOS gate and stun assignment
  // must not introduce a dead wrapper. The first `if (` we see in
  // the slice must be the canonical _wrPhased guard.
  const firstIfMatch = slice.match(/if\s*\(\s*([^)]+?)\s*\)/);
  assert.ok(firstIfMatch,
    'WRAITH-emerge slice must contain at least one `if (...)` (the canonical _wrPhased && type guard)');
  assert.match(firstIfMatch[1], /e\._wrPhased\s*&&\s*e\.type\s*===\s*'WRAITH'/,
    `the first \`if (...)\` between LOS-gate and stun-assign must be the canonical \`_wrPhased && type==='WRAITH'\` guard, not a dead-branch wrapper — got: ${firstIfMatch[1]}`);
  assert.match(slice, /_wrFindEmergeTile\(map,\s*player\)/,
    'WRAITH-emerge slice must call WRAITH._wrFindEmergeTile for emerge tile selection');
  assert.match(slice, /e\._wrState\s*=\s*'corporeal'[\s\S]{0,80}?e\._wrPhased\s*=\s*false/,
    'WRAITH-emerge slice must transition _wrState→corporeal AND clear _wrPhased');
});

// ─── Electronics along the beam ───────────────────────────────────────────

test('EMP_LINE iterates lasers/wallTurrets/shieldGens/cameras/disruptionFields/gravityWells (each EXACTLY once)', () => {
  // Same target list as EMP_BURST so the LINE reads as a true EMP —
  // a player who memorised "EMP disables turrets/lasers" doesn't need
  // a second exception list for the LINE variant. Only the geometry
  // changes (segment-distance vs radius). If a future edit drops one
  // of these from the line variant, the EMP family becomes
  // inconsistent (player muscle memory breaks).
  //
  // BYPASS-RESISTANT: each loop must appear EXACTLY once in the case
  // body — opus-4.7 r2 demonstrated that a sibling neutralizer loop
  // (`for (const l of lasers) { if (l.disabled) l.disabled = false; }`
  // after the canonical disable loop) defeats every in-loop assertion
  // because extractBlock only returns the first match. The activation
  // cost burns, the audio plays, and nothing actually happens.
  const body = empLineCaseBodyNoDead();
  /** @type {[string, RegExp][]} */
  const loops = [
    ['lasers',           /for\s*\(\s*const\s+l\s+of\s+lasers\s*\)/g],
    ['wallTurrets',      /for\s*\(\s*const\s+wt\s+of\s+wallTurrets\s*\)/g],
    ['shieldGens',       /for\s*\(\s*const\s+g\s+of\s+shieldGens\s*\)/g],
    ['cameras',          /for\s*\(\s*const\s+cam\s+of\s+cameras\s*\)/g],
    ['disruptionFields', /for\s*\(\s*const\s+f\s+of\s+disruptionFields\s*\)/g],
    ['gravityWells',     /for\s*\(\s*const\s+w\s+of\s+gravityWells\s*\)/g],
  ];
  for (const [name, re] of loops) {
    const m = body.match(re) || [];
    assert.equal(m.length, 1,
      `EMP_LINE must iterate ${name} EXACTLY ONCE (got ${m.length}) — duplicate loops admit sibling-neutralizer bypass`);
  }
});

test('EMP_LINE laser handling uses proper segment-segment distance (not endpoint sampling)', () => {
  // The earlier 3-sample heuristic missed 53–83% of laser-beam
  // crossings (opus-4.6 + codex + opus-4.7 r1 all flagged this; the
  // codex counterexample: laser endpoints both 1.5+ tiles from beam,
  // crossing point at perpendicular distance 0). Replaced with proper
  // segSegDist2 — minimum squared distance between two segments. Anchor
  // on the canonical helper signature, INSIDE the laser loop, gated by
  // WIDTH_SQ — same in-loop scoping discipline as the enemy loop test
  // (so a `segSegDist2(...)` decoy declaration somewhere else doesn't
  // satisfy the assertion).
  //
  // BYPASS-RESISTANT: the helper itself must contain canonical
  // closest-distance-between-segments structure — opus-4.7 r2
  // demonstrated that a one-line `const segSegDist2 = () => 0` (or
  // `() => 1e9`) satisfies the call-signature regex but breaks
  // laser handling in either direction (all lasers always disabled,
  // or never disabled). Pin multiple internal markers that a
  // constant-return implementation cannot reproduce: the canonical
  // formula `D = a * c - b * b`, the s/t parametric clamp via
  // `Math.abs(sN)` / `Math.abs(tN)`, and the closest-point
  // reconstruction via `wx + sc * ux - tc * vx`.
  const body = empLineCaseBodyNoDead();
  // Single-occurrence on the lasers loop (sibling-neutralizer guard).
  const laserLoopMatches = body.match(/for\s*\(\s*const\s+l\s+of\s+lasers\s*\)/g) || [];
  assert.equal(laserLoopMatches.length, 1,
    'lasers loop must appear EXACTLY ONCE (sibling-neutralizer bypass class)');
  const laserLoop = extractBlock(body, /for\s*\(\s*const\s+l\s+of\s+lasers\s*\)/);
  assert.ok(laserLoop, 'lasers loop must be brace-balanced');
  assert.ok(!hasDeadBranch(laserLoop),
    'lasers loop body must not contain a dead branch (regex-satisfying decoy class)');
  assert.match(laserLoop, /segSegDist2\(\s*player\.x\s*,\s*player\.y\s*,\s*endX\s*,\s*endY\s*,\s*l\.x1\s*,\s*l\.y1\s*,\s*l\.x2\s*,\s*l\.y2\s*\)\s*<\s*WIDTH_SQ/,
    'EMP_LINE laser handling must call segSegDist2(player.x, player.y, endX, endY, l.x1, l.y1, l.x2, l.y2) < WIDTH_SQ inside the laser loop — proper segment-to-segment distance, no endpoint sampling');
  assert.match(laserLoop, /l\.disabled\s*=\s*true[\s\S]{0,80}?l\.disableTimer\s*=\s*LASER_DISABLE_DUR/,
    'EMP_LINE must apply LASER_DISABLE_DUR to disabled lasers (matches EMP_BURST)');
  // Pin segSegDist2 internals — defeats the `() => 0` and `() => 1e9`
  // one-line replacements opus-4.7 r2 demonstrated. Extract the helper
  // body and assert canonical algorithm anchors live INSIDE it (not
  // just somewhere in the case), with no dead-branch wrappers around
  // the canonical math.
  assert.match(body, /const\s+segSegDist2\s*=\s*\(/,
    'segSegDist2 must be declared as an arrow function in the case body');
  const segSegBody = extractBlock(body, /const\s+segSegDist2\s*=\s*\(/);
  assert.ok(segSegBody, 'segSegDist2 body must be brace-balanced');
  assert.ok(!hasDeadBranch(segSegBody),
    'segSegDist2 body must not wrap canonical algorithm in a dead branch');
  // Four independent internal markers that a constant-return decoy
  // cannot reproduce. Each is part of the canonical closest-distance-
  // between-two-segments algorithm (Geometric Tools).
  assert.match(segSegBody, /D\s*=\s*a\s*\*\s*c\s*-\s*b\s*\*\s*b/,
    'segSegDist2 body must compute the determinant `D = a * c - b * b` (canonical algorithm anchor)');
  assert.match(segSegBody, /Math\.abs\(\s*sN\s*\)/,
    'segSegDist2 body must clamp s via Math.abs(sN) — proves the parametric solve is wired through, not stubbed');
  assert.match(segSegBody, /Math\.abs\(\s*tN\s*\)/,
    'segSegDist2 body must clamp t via Math.abs(tN) — proves the parametric solve is wired through, not stubbed');
  assert.match(segSegBody, /wx\s*\+\s*sc\s*\*\s*ux\s*-\s*tc\s*\*\s*vx/,
    'segSegDist2 body must reconstruct the closest point as `wx + sc*ux - tc*vx` (canonical algorithm anchor)');
});

test('EMP_LINE wall-turret hack uses LOS gate (matches EMP_BURST)', () => {
  // hackWallTurret converts hostile→allied, a permanent state flip.
  // Without the LOS gate a player could hack a turret on the far
  // side of a wall the beam BARELY missed (segDist2 alone admits
  // through-wall hits at the wall boundary).
  const body = empLineCaseBodyNoDead();
  const wtLoop = extractBlock(body, /for\s*\(\s*const\s+wt\s+of\s+wallTurrets\s*\)/);
  assert.ok(wtLoop, 'wallTurrets loop must be brace-balanced');
  assert.ok(!hasDeadBranch(wtLoop),
    'wallTurrets loop body must not contain a `if (false) { ... }` dead branch');
  assert.match(wtLoop, /segDist2\(\s*wt\.x\s*,\s*wt\.y\s*\)\s*<\s*WIDTH_SQ\s*&&\s*hasLOS\(player\.x,\s*player\.y,\s*wt\.x,\s*wt\.y/,
    'EMP_LINE wall-turret hack must require both segment distance AND LOS, INSIDE the loop');
  assert.match(wtLoop, /hackWallTurret\(wt\)/,
    'EMP_LINE must call hackWallTurret() to flip hostile turrets to allied');
});

test('segDist2 returns Infinity for points behind the player (no backwards stun bubble)', () => {
  // The naive implementation clamps t to [0,1] which produces a
  // small omni-stun radius behind the player at the start endpoint
  // (an enemy 0.5t behind player → segDist = 0.5 < WIDTH 0.7 →
  // stun). EMP_LINE is documented as DIRECTIONAL; that bubble
  // contradicts the design intent and gives players a free
  // "stun behind me" zone (opus-4.7 r1 Concern B).
  //
  // Fix: reject negative unclamped projection (`tRaw < 0`) by
  // returning Infinity from segDist2.
  //
  // BYPASS-RESISTANT: anchor between must-run statements inside the
  // segDist2 body. Earlier rounds asserted "tRaw < 0 return Infinity
  // appears anywhere in the case body within 500 chars of segDist2"
  // — opus-4.7 r2 demonstrated `if (!true) { if (tRaw < 0) return
  // Infinity; }` followed by the old `Math.max(0, Math.min(1, ...))`
  // clamp passes that regex while restoring the bubble. The fix:
  // require the gate to appear BEFORE the `Math.min(1, tRaw)` clamp
  // line — slice between the tRaw definition and the t-clamp, and
  // assert no dead-branch wrapper introduces `if (` in that slice.
  const body = empLineCaseBodyNoDead();
  const slice = sliceBetween(
    body,
    /const\s+tRaw\s*=\s*\(apx\s*\*\s*ex\s*\+\s*apy\s*\*\s*ey\)\s*\/\s*segLen2\s*;/,
    /const\s+t\s*=\s*Math\.min\(\s*1\s*,\s*tRaw\s*\)\s*;/
  );
  assert.ok(slice !== null,
    'segDist2 body must define `tRaw = ... / segLen2` and clamp via `t = Math.min(1, tRaw)` in that order');
  // The slice must contain the canonical guard and nothing else gateable.
  assert.match(slice, /if\s*\(\s*tRaw\s*<\s*0\s*\)\s*return\s+Infinity\s*;/,
    'slice between tRaw definition and t-clamp must contain `if (tRaw < 0) return Infinity;`');
  // Defence-in-depth: the FIRST `if (...)` in the slice must be the
  // canonical guard, not a dead-branch wrapper.
  const firstIfMatch = slice.match(/if\s*\(\s*([^)]+?)\s*\)/);
  assert.ok(firstIfMatch,
    'slice must contain at least one `if (...)`');
  assert.match(firstIfMatch[1], /tRaw\s*<\s*0/,
    `the first \`if (...)\` between tRaw def and t-clamp must be the canonical \`tRaw < 0\` gate, not a dead-branch wrapper — got: ${firstIfMatch[1]}`);
});

// ─── Visual + audio + cooldown ────────────────────────────────────────────

test('drawHackwareEffects has an emp_line draw branch with a beam stroke', () => {
  // Without a draw branch the beam is invisible (stuns still land).
  // Anchor on NEON.draw.line (the canonical line-drawing primitive)
  // inside an emp_line guard.
  const drawRe = /if\s*\(\s*fx\.type\s*===\s*'emp_line'\s*\)\s*\{[\s\S]{0,1500}?NEON\.draw\.line\(/;
  assert.match(CONTENT_NC, drawRe,
    'drawHackwareEffects must include an emp_line branch that strokes a line via NEON.draw.line');
});

test('EMP_LINE plays a dedicated audio cue (audio.hackwareEMPLine)', () => {
  const body = empLineCaseBody();
  assert.match(body, /audio\.hackwareEMPLine\(\)/,
    'EMP_LINE case must call audio.hackwareEMPLine()');
});

test('audio.hackwareEMPLine is defined in platform.js', () => {
  // Without the audio method, activation crashes at the call site.
  assert.match(PLATFORM_NC, /hackwareEMPLine\s*\(\s*\)\s*\{/,
    'platform.js must define an audio.hackwareEMPLine() method (otherwise activation crashes)');
});

// ─── SW cache freshness ───────────────────────────────────────────────────

test('sw.js uses network-first freshness instead of numeric cache versions', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /cacheFromNetwork\(e\)\.catch\(\(\) => caches\.match\(e\.request\)\)/);
});
