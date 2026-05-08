'use strict';
// DATA_SPIKE hackware — source-text wiring tests.
//
// DATA_SPIKE is the 15th hackware. It fills the missing
// "single-target burst damage" niche: existing damage hackware
// SPREAD damage across many enemies (NANO_SWARM = 6 nanites homing,
// STATIC_FIELD = zone DoT, DECOY_TURRET = sustained turret) — none
// of them DELETE a single elite/boss in one cast. DATA_SPIKE is the
// dedicated precision option: 60 dmg base, +50% vs elite/boss (=90),
// pierces all enemies in a 10t lane, 0.5 width.
//
// EMP_LINE is the closest visual sibling (also a directional beam),
// but the design poles are inverted: EMP_LINE = 8t, 0.7 width, pure
// stun + electronics-disable, no damage. DATA_SPIKE = 10t, 0.5 width
// (precision), pure damage + elite/boss bonus, no stun, no
// electronics-disable. Players choose: lock down a crowd
// (EMP_LINE) or delete the priority threat (DATA_SPIKE).
//
// content.js is browser-only (no UMD/CommonJS exports), so we can't
// load activateHackware()/drawHackwareEffects() under node:test.
// Instead, these tests assert the structural invariants any working
// DATA_SPIKE must satisfy: catalog entry, activation case, aim+sweep
// wiring, damage application with elite/boss bonus, LOS gate, render
// branch, audio binding, and the SW cache floor.
//
// Pattern matches tests/emp-line-hackware.test.js (for the directional
// pierce-beam structure) and tests/proximity-modifier.test.js (for
// the elite/boss multiplier pattern).
//
// All regex assertions run against COMMENT-STRIPPED source (CONTENT_NC).
// content.js will accumulate explanatory comments mentioning
// DATA_SPIKE (the case body itself documents the design intent), so
// a future edit could land a comment that satisfies a presence regex
// even after the executable code was removed. Stripping comments
// first closes that hole and matches every other hackware test.

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

/** @param {string} src */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const CONTENT_NC = stripComments(CONTENT);
const PLATFORM_NC = stripComments(PLATFORM);

// Locate the DATA_SPIKE case body. Anchor on the case label and slice
// forward until the next sibling case label or the switch's closing
// brace. Mirrors empLineCaseBody() in tests/emp-line-hackware.test.js.
function dataSpikeCaseBody() {
  const startIdx = CONTENT_NC.indexOf("case 'DATA_SPIKE':");
  assert.ok(startIdx !== -1, "activateHackware must contain a case 'DATA_SPIKE': branch in EXECUTABLE code");
  const tail = CONTENT_NC.slice(startIdx);
  const next = tail.search(/\n\s{4}case\s+'[A-Z_]+'|\n\s{2}\}\s*\n\s*\}/);
  return next > 0 ? tail.slice(0, next) : tail.slice(0, 6000);
}

// Brace-balanced extraction of the FIRST block opened by openerRe in
// src. Lifted from tests/emp-line-hackware.test.js — same naive depth
// counter, same string-literal limitation, same bypass-resistance
// guarantee at every call site (assert.ok on null result).
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
// canonical regex-satisfying code in unreachable branches. Lifted
// verbatim from tests/emp-line-hackware.test.js — extend if a future
// review surfaces a new falsy opener.
/** @param {string} slice */
function hasDeadBranch(slice) {
  return /\bif\s*\(\s*(?:!\s*true|!\s*1|!\s*'[^']*'|!\s*"[^"]*"|false|0|void\s+0|null|undefined|NaN|\!Boolean\(0\)|0\s*===\s*1|1\s*>\s*2|1\s*===\s*0)\s*\)\s*\{/.test(slice);
}

// Extract the per-iteration body of `for (const e of enemies) { ... }`
// inside the DATA_SPIKE case. Errors loudly if the loop is missing.
// REJECTS multiple matching loops in the case body (sibling-neutralizer
// bypass class — see emp-line-hackware test for full rationale).
function dataSpikeEnemyLoopBody() {
  const body = dataSpikeCaseBody();
  const re = /for\s*\(\s*const\s+e\s+of\s+enemies\s*\)/g;
  const matches = body.match(re) || [];
  assert.equal(matches.length, 1,
    `DATA_SPIKE case must contain EXACTLY ONE \`for (const e of enemies)\` loop (sibling-neutralizer bypass class) — got ${matches.length}`);
  const block = extractBlock(body, /for\s*\(\s*const\s+e\s+of\s+enemies\s*\)/);
  assert.ok(block, 'DATA_SPIKE enemy loop must be brace-balanced');
  assert.ok(!hasDeadBranch(block),
    'DATA_SPIKE enemy-loop body must not contain a dead branch (regex-satisfying decoy class)');
  return block;
}

// Extract the case body with dead branches forbidden — used as a
// defence for presence-only assertions that aren't loop-scoped.
function dataSpikeCaseBodyNoDead() {
  const body = dataSpikeCaseBody();
  assert.ok(!hasDeadBranch(body),
    'DATA_SPIKE case body must not contain a `if (false) { ... }` dead branch (regex-satisfying decoy class)');
  return body;
}

// ─── Catalog registration ─────────────────────────────────────────────────

test('DATA_SPIKE is registered in the HACKWARE catalog with required fields', () => {
  // Without a catalog entry, drop tables / shop offers won't surface
  // DATA_SPIKE and the activation switch case is unreachable.
  const re = /DATA_SPIKE:\s*\{\s*name:\s*'[^']+',\s*desc:\s*'[^']+',\s*colour:\s*'#[0-9a-fA-F]+',\s*icon:\s*'[^']+',\s*cooldown:\s*\d+/;
  assert.match(CONTENT_NC, re,
    'DATA_SPIKE registry entry must declare name/desc/colour/icon/cooldown in EXECUTABLE code');
});

test('DATA_SPIKE cooldown sits at or above EMP_LINE (relative ordering + sanity floor/ceiling)', () => {
  // Design intent: DATA_SPIKE is a damage tool, not a CC panic
  // button. Its cooldown must sit at least as high as EMP_LINE (the
  // line-shaped CC sibling). Anchor on relative ordering so future
  // rebalances of EMP_LINE don't fail this test as collateral.
  // Sanity floor (>= 6s) and ceiling (<= 30s) prevent the lockstep
  // rewrite that pure relative ordering admits (opus-4.7 r2 callout
  // on the EMP_LINE PR).
  const cdEmpLine    = parseInt((CONTENT_NC.match(/EMP_LINE:[^}]*cooldown:\s*(\d+)/) || [])[1] || 'NaN', 10);
  const cdDataSpike  = parseInt((CONTENT_NC.match(/DATA_SPIKE:[^}]*cooldown:\s*(\d+)/) || [])[1] || 'NaN', 10);
  assert.ok(Number.isFinite(cdEmpLine) && Number.isFinite(cdDataSpike),
    'EMP_LINE and DATA_SPIKE cooldowns must be parseable integer literals');
  assert.ok(cdDataSpike >= 6,
    `DATA_SPIKE cooldown (${cdDataSpike}s) must be >= 6s (sanity floor — below this any active hackware becomes spam)`);
  assert.ok(cdDataSpike <= 30,
    `DATA_SPIKE cooldown (${cdDataSpike}s) must be <= 30s (sanity ceiling — above this the hackware becomes useless)`);
  assert.ok(cdDataSpike >= cdEmpLine,
    `DATA_SPIKE cooldown (${cdDataSpike}s) must be >= EMP_LINE (${cdEmpLine}s) — damage spike is heavier than CC sweep`);
});

test('DATA_SPIKE colour and icon are distinct from EMP_LINE', () => {
  // The two beam-shaped hackware (DATA_SPIKE + EMP_LINE) must read
  // as visually distinct so the player can tell at a glance which
  // is on cooldown. EMP_LINE owns #00eecc teal and ═; DATA_SPIKE
  // must NOT reuse either.
  const m = CONTENT_NC.match(/DATA_SPIKE:\s*\{\s*name:\s*'[^']+',\s*desc:\s*'[^']+',\s*colour:\s*'(#[0-9a-fA-F]+)',\s*icon:\s*'([^']+)'/);
  assert.ok(m, 'DATA_SPIKE registry entry must be parseable for colour+icon');
  const [, colour, icon] = m;
  assert.notEqual(colour.toLowerCase(), '#00eecc',
    'DATA_SPIKE colour must differ from EMP_LINE (#00eecc) — HUD cooldown badges become indistinguishable otherwise');
  assert.notEqual(icon, '═',
    'DATA_SPIKE icon must differ from EMP_LINE (═) — registry icons drive HUD badges and hackware shop entries');
});

// ─── Activation case ──────────────────────────────────────────────────────

test('activateHackware has a DATA_SPIKE case that pushes a data_spike effect', () => {
  // The activate switch must own the deploy. Without the case the
  // cooldown burns but nothing spawns and nothing damages.
  const body = dataSpikeCaseBody();
  assert.match(body, /hackwareEffects\.push\(\s*\{\s*type:\s*'data_spike'/,
    "DATA_SPIKE case must push a {type:'data_spike'} effect in EXECUTABLE code");
  assert.match(body, /x1:\s*player\.x[\s\S]{0,80}?y1:\s*player\.y/,
    'data_spike effect must record beam start at player position');
  assert.match(body, /x2:\s*endX[\s\S]{0,80}?y2:\s*endY/,
    'data_spike effect must record beam endpoint from the swept endX/endY');
  assert.match(body, /maxAge:\s*0?\.\d+/,
    'data_spike effect must declare a finite maxAge (seconds) so the visual fades');
});

// ─── Aim wiring (mirrors EMP_LINE / BLINK pattern) ────────────────────────

test('DATA_SPIKE reads aim from mouse with a player.facing fallback', () => {
  // Same input shape as dash + BLINK + EMP_LINE — mouse → norm() →
  // if both axes zero, fall back to player.facing. Without the
  // facing fallback, clicking on yourself produces a no-op even
  // though the player IS facing somewhere; without the
  // lockAimToMove gate, lock-aim users get a mouse-aimed beam that
  // ignores their explicit setting.
  const body = dataSpikeCaseBody();
  assert.match(body, /norm\(\s*ax\s*,\s*ay\s*\)/,
    'DATA_SPIKE must normalise the mouse-aim vector via norm()');
  assert.match(body, /if\s*\(\s*!ddx\s*&&\s*!ddy\s*\)\s*\{\s*ddx\s*=\s*player\.facing\.x;\s*ddy\s*=\s*player\.facing\.y/,
    'DATA_SPIKE must fall back to player.facing when the aim vector is zero');
  assert.match(body, /settings\.lockAimToMove/,
    'DATA_SPIKE must respect the lockAimToMove setting (otherwise lock-aim users get a mouse-aimed beam that ignores their setting)');
});

// ─── Wall-aware swept endpoint ────────────────────────────────────────────

test('DATA_SPIKE uses a swept endpoint, not a single-snap projection', () => {
  // Per the stored 'knockback sweeping' / BLINK / EMP_LINE rule:
  // any single-snap multi-tile displacement can tunnel through
  // 1-tile-thick interior walls. DATA_SPIKE projects 10 tiles, so
  // it MUST sweep tile-by-tile and stop at the first wall. Pin
  // STEP_D = 0.25 as the literal multiplier in the step expression
  // so a contributor can't keep `STEP_D = 0.25` as a decoy
  // declaration while the real step uses `* 1.0`.
  const body = dataSpikeCaseBodyNoDead();
  assert.match(body, /for\s*\(\s*let\s+s\s*=\s*1;\s*s\s*<=\s*STEPS_D/,
    'DATA_SPIKE must sweep in a for-loop, not jump to (player.x + dx*10)');
  assert.match(body, /STEP_D\s*=\s*0\.25/,
    'DATA_SPIKE step must declare STEP_D = 0.25 (knockback-sweeping rule; matches BLINK/EMP_LINE precedent)');
  assert.match(body, /STEPS_D\s*=\s*Math\.ceil\(\s*MAX_LEN\s*\/\s*STEP_D\s*\)/,
    'STEPS_D must derive from MAX_LEN/STEP_D so a contributor can\'t hard-code a smaller step count to silently halve reach');
  assert.match(body, /ddx\s*\*\s*s\s*\*\s*STEP_D/,
    'sweep x-step must consume STEP_D directly (`ddx * s * STEP_D`) — without this STEP_D is a decoy and the real step can be 1.0, reintroducing wall tunneling');
  assert.match(body, /ddy\s*\*\s*s\s*\*\s*STEP_D/,
    'sweep y-step must consume STEP_D directly (`ddy * s * STEP_D`) — same decoy class as the x-axis');
  assert.match(body, /isPassable\(map\[fyK\]\[fxK\]\)/,
    'DATA_SPIKE sweep must terminate at the first non-passable tile (T.WALL, LOCKED_R/B/G, sealed entrances)');
});

test('DATA_SPIKE sweep range is 10 tiles (MAX_LEN consumed by STEPS_D)', () => {
  // The 10-tile reach IS the niche distinguishing this from EMP_LINE
  // (8-tile reach). The +2 tiles sells the "precision sniper" feel
  // and lets a player reach a back-line elite from cover. The
  // previous-test STEPS_D = Math.ceil(MAX_LEN / STEP_D) assertion
  // pins MAX_LEN as a real consumer, not a decoy declaration.
  const body = dataSpikeCaseBodyNoDead();
  assert.match(body, /MAX_LEN\s*=\s*10\b/,
    'DATA_SPIKE must declare MAX_LEN = 10 (the design reach distinguishing it from EMP_LINE\'s 8t)');
});

// ─── Width gate (precision: 0.5 vs EMP_LINE's 0.7) ────────────────────────

test('DATA_SPIKE WIDTH is 0.5 — narrower than EMP_LINE (precision niche)', () => {
  // The precision identity is encoded in WIDTH. EMP_LINE = 0.7 (sweep);
  // DATA_SPIKE = 0.5 (precision). A regression that widens WIDTH to
  // match EMP_LINE collapses the two beams into the same hitbox.
  const body = dataSpikeCaseBodyNoDead();
  assert.match(body, /WIDTH\s*=\s*0\.5\b/,
    'DATA_SPIKE must declare WIDTH = 0.5 — the precision identity vs EMP_LINE\'s 0.7');
  assert.match(body, /WIDTH_SQ\s*=\s*WIDTH\s*\*\s*WIDTH/,
    'DATA_SPIKE must precompute WIDTH_SQ for the squared-distance gate');
});

// ─── Damage loop ──────────────────────────────────────────────────────────

test('DATA_SPIKE iterates enemies and calls takeDamage with the bonus inlined', () => {
  // The damage gate must be SEGMENT distance, not RADIUS distance
  // — the whole point of the LINE shape is its narrow lane. Anchor
  // on segDist2 (the inlined helper) plus a WIDTH_SQ comparison
  // INSIDE the enemy loop body — without the in-loop scoping, a
  // contributor can keep `WIDTH_SQ` as a decoy declaration and gate
  // on an unrelated constant, collapsing the narrow-lane identity
  // into a fat omni-radius blob.
  //
  // Inline the elite/boss multiplier into the takeDamage arg so a
  // contributor can't decoy the multiplier with a flat const
  // elsewhere (mirrors the inlined ternary pattern EMP_LINE uses
  // for stun duration — opus-4.7 r1 finding 5 on PR #209). Pin the
  // FULL takeDamage call including the closing `)` so a contributor
  // can't append `* 0` (zeros every hit), `&& 0`, or extra args
  // that change semantics. The `Math.round(...)` wrapper is
  // mandatory because takeDamage's downstream DR/MARK/SHIELDED math
  // can drift on float inputs (see entities.js takeDamage chain).
  const loopBody = dataSpikeEnemyLoopBody();
  assert.match(loopBody, /segDist2\(\s*e\.x\s*,\s*e\.y\s*\)\s*>\s*WIDTH_SQ\s*\)\s*continue/,
    'DATA_SPIKE enemy LOOP BODY must skip enemies outside the beam width via `segDist2(e.x,e.y) > WIDTH_SQ` (in-loop scoping closes the WIDTH_SQ-decoy bypass)');
  assert.match(loopBody, /e\.takeDamage\(\s*dmg\s*,\s*\{[^}]*name:\s*'Data Spike'/,
    'DATA_SPIKE must apply damage via e.takeDamage(dmg, { name: "Data Spike", ... })');
  // Pin isProc: false explicitly. takeDamage at entities.js:1931 (MARK
  // affix +30%) and :1948 (EXPLOITER perk +25%) BOTH gate on
  // !ctx.isProc. A contributor flipping isProc to true silently
  // disables both bonuses — a player running Marking weapon +
  // EXPLOITER who switches to DATA_SPIKE for the boss spike loses
  // ~39% damage on a marked non-elite. claude-opus-4.6 r1 caught this
  // gap with concrete bypass code (the original `[^}]*` regex
  // accepted both isProc values). Pin both the literal AND its
  // canonical value.
  assert.match(loopBody, /e\.takeDamage\(\s*dmg\s*,\s*\{[^}]*isProc:\s*false[^}]*\}/,
    'DATA_SPIKE takeDamage must pass isProc: false — it is a direct activation, not a proc; isProc: true silently disables MARK (+30%) and EXPLOITER (+25%) bonuses (opus-4.6 r1 finding)');
  // Pin the COMPLETE bonus expression so the multiplier can't be
  // decoyed. The full statement must be:
  //   const dmg = Math.round(BASE_DMG * ((e.isBoss || e.elite) ? ELITE_BOSS_MUL : 1));
  assert.match(loopBody, /const\s+dmg\s*=\s*Math\.round\(\s*BASE_DMG\s*\*\s*\(\s*\(\s*e\.isBoss\s*\|\|\s*e\.elite\s*\)\s*\?\s*ELITE_BOSS_MUL\s*:\s*1\s*\)\s*\)\s*;/,
    'DATA_SPIKE damage statement must be the COMPLETE expression `const dmg = Math.round(BASE_DMG * ((e.isBoss || e.elite) ? ELITE_BOSS_MUL : 1));` — the elite/boss bonus is part of the niche identity');
});

test('DATA_SPIKE damage tuning: BASE_DMG = 60 and ELITE_BOSS_MUL = 1.5 (= 90 vs elite/boss)', () => {
  // The 60 / 90 numbers are the design tuning. A regression that
  // drops BASE_DMG below ~40 makes the spike weaker than NANO_SWARM's
  // best-case 48 single-target damage on a longer cooldown — pointless.
  // A regression that pushes ELITE_BOSS_MUL above ~2 makes the boss
  // bonus a one-shot for most regular elites, breaking the elite
  // counterplay loop. Pin both literals.
  const body = dataSpikeCaseBodyNoDead();
  assert.match(body, /BASE_DMG\s*=\s*60\b/,
    'DATA_SPIKE must declare BASE_DMG = 60 — the single-target burst niche identity');
  assert.match(body, /ELITE_BOSS_MUL\s*=\s*1\.5\b/,
    'DATA_SPIKE must declare ELITE_BOSS_MUL = 1.5 — the elite/boss bonus that defines the anti-priority-target niche');
});

test('DATA_SPIKE LOS gate runs INSIDE the enemy loop (mandatory wall-blocker)', () => {
  // segDist2 alone admits enemies on the far side of a thin wall
  // the beam BARELY missed (e.g. enemy at 0.4 perp distance, wall
  // sits between player and enemy). hasLOS is the canonical guard
  // used by EMP_LINE and the wider damage surface. Loop-body scoped
  // so a comment elsewhere can't satisfy the gate.
  const loopBody = dataSpikeEnemyLoopBody();
  assert.match(loopBody, /hasLOS\(\s*player\.x\s*,\s*player\.y\s*,\s*e\.x\s*,\s*e\.y\s*,\s*map\s*\)/,
    'DATA_SPIKE enemy loop must call hasLOS(player.x, player.y, e.x, e.y, map) to block damage through walls');
  assert.match(loopBody, /if\s*\(\s*!map\s*\|\|\s*!hasLOS\(\s*player\.x\s*,\s*player\.y\s*,\s*e\.x\s*,\s*e\.y\s*,\s*map\s*\)\s*\)\s*continue/,
    'DATA_SPIKE LOS gate must short-circuit to `continue` when LOS fails (no damage through walls)');
});

// ─── Anti-bypass: the spike must NOT bypass _wrPhased (kinetic ≠ EMP) ─────

test('DATA_SPIKE does NOT bypass _wrPhased — phase counterplay is EMP-only', () => {
  // EMP_BURST and EMP_LINE both bypass _wrPhased (force materialise)
  // because the EMP family is the explicit hard counter to phase.
  // DATA_SPIKE is kinetic damage, NOT a system disruption — it must
  // respect phase like every other damage source. takeDamage's own
  // phase-immune branch (entities.js:1893) returns 0 with 'PHASED'
  // floater, so the spike just bounces off. If a future contributor
  // adds the `_wrPhased ? true : ...` LOS bypass here, the EMP niche
  // erodes (any beam-shaped hackware would counter phase).
  //
  // We assert NEGATIVE: the loop body must NOT contain the bypass
  // pattern. (The takeDamage call still happens; we just check the
  // LOS gate doesn't have the EMP-style override.)
  const loopBody = dataSpikeEnemyLoopBody();
  assert.doesNotMatch(loopBody, /_wrPhased\s*\?\s*true\s*:/,
    'DATA_SPIKE LOS gate must NOT bypass _wrPhased — that\'s an EMP-only privilege. Kinetic damage respects phase.');
});

// ─── Anti-bypass: NO electronics-disable (DATA_SPIKE is damage, not EMP) ──

test('DATA_SPIKE does NOT iterate the electronics surface (lasers/turrets/cameras/etc.)', () => {
  // EMP_BURST/EMP_LINE iterate lasers, wallTurrets, shieldGens,
  // cameras, disruptionFields, gravityWells. DATA_SPIKE must NOT
  // — the niche separation is "EMP family for electronics, damage
  // family for HP". A contributor adding any of these loops to the
  // case body collapses the EMP niche and bloats the spike beyond
  // its single-target damage role.
  const body = dataSpikeCaseBody();
  for (const surface of ['lasers', 'wallTurrets', 'shieldGens', 'cameras', 'disruptionFields', 'gravityWells']) {
    const re = new RegExp(`for\\s*\\(\\s*const\\s+\\w+\\s+of\\s+${surface}\\s*\\)`);
    assert.doesNotMatch(body, re,
      `DATA_SPIKE must NOT iterate ${surface} — electronics-disable is the EMP family's exclusive niche`);
  }
});

// ─── Render branch ────────────────────────────────────────────────────────

test('drawHackwareEffects has a data_spike render branch (twin-stroke beam)', () => {
  // Without a render branch the effect is invisible — the cooldown
  // burns and the damage applies but the player has no feedback.
  // Mirror the emp_line render shape: outer halo + inner core with
  // shared fade, so the visual grammar matches the existing EMP
  // beam family.
  assert.match(CONTENT_NC, /fx\.type\s*===\s*'data_spike'/,
    'drawHackwareEffects must contain a `fx.type === \'data_spike\'` branch');
  // Anchor the strokeStyle to the registry colour to ensure the beam
  // tints match. Hot-pink #ff4488 is the registry colour; the inner
  // core can be any near-white tint on the pink axis.
  const dsRenderRe = /fx\.type\s*===\s*'data_spike'[\s\S]{0,1000}?strokeStyle\s*=\s*'#ff4488'/;
  assert.match(CONTENT_NC, dsRenderRe,
    'data_spike render branch must use #ff4488 strokeStyle to match the registry colour');
});

// ─── Audio binding ────────────────────────────────────────────────────────

test('DATA_SPIKE case calls audio.hackwareDataSpike()', () => {
  // The audio cue is the "shot fired" feedback. Without it the
  // hackware feels broken on activation.
  const body = dataSpikeCaseBody();
  assert.match(body, /audio\.hackwareDataSpike\(\s*\)/,
    'DATA_SPIKE case must call audio.hackwareDataSpike() in EXECUTABLE code');
});

test('platform.js defines audio.hackwareDataSpike()', () => {
  // Cross-file binding: a missing audio method would crash on
  // activation. Pin the method name as a property on the audio
  // object so a typo (e.g. hackwareDataspike) fails this test.
  assert.match(PLATFORM_NC, /hackwareDataSpike\s*\(\s*\)\s*\{/,
    'platform.js must define an audio.hackwareDataSpike() method (otherwise activation crashes)');
});

// ─── HACKWARE pool size floor (>= 15 — DATA_SPIKE was the 15th) ───────────
//
// Canary RETIRED post SHIELD_BUBBLE PR. The exact-count assertion
// moved to tests/shield-bubble-hackware.test.js (which now pins
// EXACTLY 16). This file keeps a regression FLOOR (>= 15) so a
// future deletion of DATA_SPIKE or any earlier hackware fails here
// (tests in this file would break on missing DATA_SPIKE wiring
// regardless, but the explicit floor documents the intent).
//
// When the 17th hackware lands, that test file pins EXACTLY 17 and
// the SHIELD_BUBBLE test drops to a `>= 16` floor. Same handoff
// pattern as the FLOOR_MODIFIERS canary (PROXIMITY/JAMMED).

test('HACKWARE catalog has AT LEAST 15 entries (DATA_SPIKE floor)', () => {
  const hwBlock = CONTENT_NC.match(/const\s+HACKWARE\s*=\s*\{([\s\S]*?)\n\}\s*;/);
  assert.ok(hwBlock, 'HACKWARE registry block must be locatable');
  const keys = hwBlock[1].match(/^\s*([A-Z_]+)\s*:\s*\{/gm) || [];
  assert.ok(keys.length >= 15,
    `HACKWARE registry must have AT LEAST 15 entries (DATA_SPIKE floor) — got ${keys.length}`);
});
