'use strict';
// TIME_DILATION hackware — source-text wiring tests.
//
// TIME_DILATION is the 14th hackware and the FIRST to slow enemy
// projectiles. It places a 4s temporal field at the player's position
// (no aim — like REPAIR_PROTOCOL); enemies inside have their slowFactor
// reduced (×0.35 grunt / ×0.6 boss) AND enemy projectiles inside have
// their _timeMul set to 0.5 (halving their per-frame movement). The
// projectile slow is the novel mechanic — no other system in the
// codebase touches projectile velocity post-creation. Cooldown 14s
// sits between CHRONO_LURE (13) and GRAVITY_WELL (16) — heavy-utility
// band but cheaper than the heavy-CC family.
//
// content.js is browser-only (no UMD/CommonJS exports), so we can't
// load activateHackware()/updateHackwareEffects()/drawHackwareEffects()
// under node:test. Instead, these tests assert the structural
// invariants any working TIME_DILATION must satisfy. Pattern matches
// tests/chrono-lure-hackware.test.js (the canonical post-CHRONO_LURE
// hackware test scaffold) — same defensive helpers (extractBlock,
// hasDeadBranch, sliceBetween) and the same bypass-class defences
// (sibling-neutralizer single-occurrence guards, Math.min/max end-
// anchored slow assignment, dead-branch wrapper rejection,
// alternate-iterator rejection, latch-set-INSIDE-gate guards).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
);
const CONTENT_PROJECTILES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content', 'projectiles.js'), 'utf8'
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
const CONTENT_PROJECTILES_NC = stripComments(CONTENT_PROJECTILES);
const PLATFORM_NC = stripComments(PLATFORM);

// Brace-balanced extraction — copied from chrono-lure-hackware.test.js.
// Returns the FIRST block opened by openerRe in src.
//
// LIMITATION: naive depth counter — does NOT understand string/regex
// literals. The current TIME_DILATION case has no braces inside string
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
// original literal-only detector. Also rejects compile-time-TRUE
// `if` openers with `continue`/`return`/`break` — codex r1 of
// CHRONO_LURE flagged this (an unconditional `if (1 < 2) continue;`
// before moveToward neutralises the loop body).
//
// HARDENED (opus-4.7 r1 of TIME_DILATION, Issue 6): also reject
// COMPOSITE always-false expressions like `&& false`, `&& 0`,
// `|| true`, `|| 1` that smuggle a dead branch past the bare-literal
// check.
//
// HARDENED again (opus-4.7 r2 + codex r2 of TIME_DILATION, Issues 2):
// extend coverage further:
// - `Boolean(false)`, `Boolean(0)`, `Number(0)`, `String('')` —
//   coercion wrappers around falsy primitives (the original detector
//   only had `!Boolean(0)` — the negated form).
// - `?? false`, `?? 0`, `?? null`, `?? undefined`, `?? NaN` —
//   nullish coalesce returning a falsy literal.
// - `? true : false` and `? false : true` — ternary returning a
//   literal (essentially `if (literal)` in disguise).
// - Multiline `if (...)` heads: codex r2 demonstrated that the
//   original `[^)\n]*` regex stopped at newline, so an `if (cond &&\n
//   false)` form bypassed the composite-tail check. Switched to
//   `[\s\S]*?` (non-greedy, multiline-safe) up to the matching `)`.
/** @param {string} slice */
function hasDeadBranch(slice) {
  // Falsy openers (with `{` — block form). Includes coercion
  // wrappers (Boolean/Number/String) — opus-4.7 r2 Issue 2.
  if (/\bif\s*\(\s*(?:!\s*true|!\s*1|!\s*'[^']*'|!\s*"[^"]*"|false|0|void\s+0|null|undefined|NaN|\!Boolean\(0\)|0\s*===\s*1|1\s*>\s*2|1\s*===\s*0|Boolean\(\s*(?:false|0|null|undefined|NaN|''|"")\s*\)|Number\(\s*0\s*\)|String\(\s*(?:''|"")\s*\))\s*\)\s*\{/.test(slice)) return true;
  // Truthy openers + early-exit (continue/return) — non-braced or braced.
  if (/\bif\s*\(\s*(?:true|1|'[^']*'|"[^"]*"|Boolean\(1\)|1\s*<\s*2|0\s*<\s*1|2\s*>\s*1|1\s*===\s*1|0\s*===\s*0|!\s*false|!\s*0)\s*\)\s*(?:\{|continue|return|break)/.test(slice)) return true;
  // Composite always-false / always-true tails inside an `if (...)`
  // condition (multiline-safe, opus-4.7 r1 Issue 6 + codex r2 finding).
  // Match: any `if (` opener whose closing `)` is preceded by an
  // always-false/true token. `[\s\S]*?` is non-greedy and crosses
  // newlines, so multi-line `if` heads are caught.
  if (/\bif\s*\([\s\S]*?\b(?:&&\s*(?:false|0|null|undefined|NaN|void\s+0)|\|\|\s*(?:true|1|Boolean\(1\)))\s*\)/.test(slice)) return true;
  // Nullish-coalesce to falsy literal — opus-4.7 r2 Issue 2.
  // `if (x ?? false)` is `false` when x is null/undefined.
  if (/\bif\s*\([\s\S]*?\?\?\s*(?:false|0|null|undefined|NaN)\s*\)/.test(slice)) return true;
  // Ternary-to-literal — opus-4.7 r2 Issue 2.
  // `if (x ? true : false)` is essentially `if (x)` but `if (x ? false : true)`
  // is `if (!x)`; either form may be smuggled to disable a branch.
  // Match either branch order.
  if (/\bif\s*\([\s\S]*?\?\s*(?:true|1)\s*:\s*(?:false|0)\s*\)/.test(slice)) return true;
  if (/\bif\s*\([\s\S]*?\?\s*(?:false|0)\s*:\s*(?:true|1)\s*\)/.test(slice)) return true;
  return false;
}

// Slice between two MUST-RUN anchors. Returns null if either anchor
// is missing.
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

// Locate the TIME_DILATION activation case body. Slice from the case
// label forward until the next sibling case label or the switch's
// closing brace. Mirrors chronoLureCaseBody().
function timeDilationCaseBody() {
  const startIdx = CONTENT_NC.indexOf("case 'TIME_DILATION':");
  assert.ok(startIdx !== -1, "activateHackware must contain a case 'TIME_DILATION': branch in EXECUTABLE code");
  const tail = CONTENT_NC.slice(startIdx);
  const next = tail.search(/\n\s{4}case\s+'[A-Z_]+'|\n\s{2}\}\s*\n\s*\}/);
  return next > 0 ? tail.slice(0, next) : tail.slice(0, 6000);
}

function timeDilationCaseBodyNoDead() {
  const body = timeDilationCaseBody();
  assert.ok(!hasDeadBranch(body),
    'TIME_DILATION case body must not contain a `if (false) { ... }` dead branch (regex-satisfying decoy class)');
  return body;
}

// Locate the time_field PER-FRAME branch inside updateHackwareEffects.
// There are THREE `if (fx.type === 'time_field')` sites in CONTENT_NC:
//   #1 — expire cleanup (inside `if (fx.age >= fx.maxAge)` at the top
//        of updateHackwareEffects' loop) — restores _timeMul on
//        lingering projectiles.
//   #2 — per-frame update branch — the enemy slow + projectile slow
//        + ambient particles. THIS is the block these tests target.
//   #3 — draw branch in drawHackwareEffects — the visual.
// The naive `extractBlock(CONTENT_NC, /if (fx.type === 'time_field')/)`
// returns site #1; we need #2. Walk a global regex to locate the
// SECOND match's index, then extract from there.
function timeFieldUpdateBlock() {
  const re = /if\s*\(\s*fx\.type\s*===\s*'time_field'\s*\)/g;
  let count = 0;
  let secondIdx = -1;
  let m;
  while ((m = re.exec(CONTENT_NC)) !== null) {
    count++;
    if (count === 2) { secondIdx = m.index; break; }
  }
  assert.ok(secondIdx >= 0, "CONTENT must contain at least TWO `if (fx.type === 'time_field')` sites (expire-cleanup + per-frame update)");
  const block = extractBlock(CONTENT_NC.slice(secondIdx), /if\s*\(\s*fx\.type\s*===\s*'time_field'\s*\)/);
  assert.ok(block, "the per-frame `if (fx.type === 'time_field')` update branch must be brace-balanced");
  assert.ok(!hasDeadBranch(block),
    'time_field update branch must not contain a `if (false) { ... }` dead branch');
  return block;
}

// ─── Catalog registration ─────────────────────────────────────────────────

test('TIME_DILATION is registered in the HACKWARE catalog with required fields', () => {
  // Without a catalog entry, drop tables / shop offers won't surface
  // TIME_DILATION and the activation switch case is unreachable.
  const re = /TIME_DILATION\s*:\s*\{\s*name:\s*'[^']+',\s*desc:\s*'[^']+',\s*colour:\s*'#[0-9a-fA-F]+',\s*icon:\s*'[^']+',\s*cooldown:\s*\d+/;
  assert.match(CONTENT_NC, re,
    'TIME_DILATION registry entry must declare name/desc/colour/icon/cooldown in EXECUTABLE code');
});

test('TIME_DILATION cooldown sits between CHRONO_LURE and GRAVITY_WELL (heavy-utility band)', () => {
  // Design intent: TIME_DILATION's continuous-control payoff sits in
  // the heavier utility band — strictly more expensive than the
  // CHRONO_LURE delayed-CC marker (13s) but no slower than the
  // gravity-well baseline (16s). The slow-projectile mechanic is
  // genuinely novel and powerful, so the cost should reflect that.
  // Anchor relative to siblings so future rebalances don't fail this
  // test as collateral.
  const cdChronoLure  = parseInt((CONTENT_NC.match(/CHRONO_LURE:[^}]*cooldown:\s*(\d+)/) || [])[1] || 'NaN', 10);
  const cdTimeDil     = parseInt((CONTENT_NC.match(/TIME_DILATION\s*:[^}]*cooldown:\s*(\d+)/) || [])[1] || 'NaN', 10);
  const cdGravityWell = parseInt((CONTENT_NC.match(/GRAVITY_WELL:[^}]*cooldown:\s*(\d+)/) || [])[1] || 'NaN', 10);
  assert.ok(Number.isFinite(cdChronoLure) && Number.isFinite(cdTimeDil) && Number.isFinite(cdGravityWell),
    'all three cooldowns must be parseable integer literals');
  assert.ok(cdTimeDil >= 6,
    `TIME_DILATION cooldown (${cdTimeDil}s) must be >= 6s (sanity floor — below this any active hackware becomes spam)`);
  assert.ok(cdTimeDil <= 30,
    `TIME_DILATION cooldown (${cdTimeDil}s) must be <= 30s (sanity ceiling — above this the heavy-utility family becomes useless)`);
  assert.ok(cdTimeDil > cdChronoLure,
    `TIME_DILATION cooldown (${cdTimeDil}s) must be > CHRONO_LURE (${cdChronoLure}s) — continuous-control payoff is heavier than CHRONO_LURE's delayed-CC spike`);
  assert.ok(cdTimeDil <= cdGravityWell,
    `TIME_DILATION cooldown (${cdTimeDil}s) must be <= GRAVITY_WELL (${cdGravityWell}s) — gravity well is the existing pure-utility ceiling`);
});

test('TIME_DILATION colour is perceptually distinct from PHASE_CLOAK and HOLO_DECOY (no purple-family collision)', () => {
  // PHASE_CLOAK is #cc44ff (purple-violet) and HOLO_DECOY is #ff44ff
  // (magenta). TIME_DILATION's purple theme risks collision with
  // either. Any colour within ~60 RGB units of a sibling is
  // perceptually indistinguishable on screen — players need to
  // differentiate the HUD cooldown badges at a glance.
  const m = CONTENT_NC.match(/TIME_DILATION\s*:[^}]*colour:\s*'(#[0-9a-fA-F]{6})'/);
  assert.ok(m, 'TIME_DILATION colour must be parseable as a 6-digit hex');
  const td = m[1].toLowerCase();
  const [tdR, tdG, tdB] = [
    parseInt(td.slice(1, 3), 16),
    parseInt(td.slice(3, 5), 16),
    parseInt(td.slice(5, 7), 16),
  ];
  /** @type {[string, number, number, number][]} */
  const collisionCandidates = [
    ['PHASE_CLOAK', 0xcc, 0x44, 0xff],   // purple-violet
    ['HOLO_DECOY',  0xff, 0x44, 0xff],   // magenta
    ['CHRONO_LURE', 0xff, 0x22, 0xaa],   // hot pink
  ];
  for (const [label, r, g, b] of collisionCandidates) {
    const d = Math.sqrt(
      (tdR - r) * (tdR - r) +
      (tdG - g) * (tdG - g) +
      (tdB - b) * (tdB - b)
    );
    assert.ok(d >= 60,
      `TIME_DILATION colour (${td}) is too close to ${label} (#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}) — RGB distance ${d.toFixed(1)} < 60 (perceptually-distinct floor)`);
  }
});

test('TIME_DILATION icon is distinct from existing hackware icons', () => {
  // Icon collisions in the HUD cooldown badge make abilities
  // indistinguishable. Pull all hackware icons and assert
  // TIME_DILATION's is unique.
  const m = CONTENT_NC.match(/TIME_DILATION\s*:[^}]*icon:\s*'([^']+)'/);
  assert.ok(m, 'TIME_DILATION must declare an icon string');
  const tdIcon = m[1];
  // Pull every other hackware icon — match the keys list (excluding TIME_DILATION).
  const allIcons = /** @type {{key: string, icon: string}[]} */ ([]);
  const iconRe = /(\w+):\s*\{\s*name:\s*'[^']+',\s*desc:\s*'[^']+',\s*colour:\s*'#[0-9a-fA-F]+',\s*icon:\s*'([^']+)'/g;
  let im;
  while ((im = iconRe.exec(CONTENT_NC)) !== null) {
    if (im[1] !== 'TIME_DILATION') allIcons.push({ key: im[1], icon: im[2] });
  }
  assert.ok(allIcons.length >= 12, `must enumerate >=12 sibling hackware icons — got ${allIcons.length}`);
  for (const sib of allIcons) {
    assert.notEqual(sib.icon, tdIcon,
      `TIME_DILATION icon "${tdIcon}" collides with ${sib.key} icon — HUD badges become indistinguishable`);
  }
});

// ─── Activation case ──────────────────────────────────────────────────────

test('activateHackware has a TIME_DILATION case that pushes a time_field effect', () => {
  // The activate switch must own the deploy. Without the case the
  // cooldown burns but nothing spawns.
  const body = timeDilationCaseBody();
  assert.match(body, /hackwareEffects\.push\(\s*\{\s*type:\s*'time_field'/,
    "TIME_DILATION case must push a {type:'time_field'} effect in EXECUTABLE code");
  assert.match(body, /maxAge:\s*\d+(?:\.\d+)?/,
    'time_field effect must declare a finite maxAge (seconds) so the effect splices out');
  assert.match(body, /radius:\s*\d+/,
    'time_field effect must declare a radius (the slow area)');
});

test('TIME_DILATION duration is in [2, 6]s — long enough to matter, short enough not to trivialise', () => {
  // The duration IS the cost-vs-payoff knob. Too short (<2s) and the
  // slow-projectile readability window is gone before the player
  // benefits; too long (>6s) and the field becomes a permanent
  // safety bubble that trivialises encounters.
  const body = timeDilationCaseBody();
  const m = body.match(/maxAge:\s*(\d+(?:\.\d+)?)/);
  assert.ok(m, 'TIME_DILATION case must declare maxAge as a numeric literal');
  const dur = parseFloat(m[1]);
  assert.ok(dur >= 2 && dur <= 6,
    `TIME_DILATION maxAge (${dur}s) must be in [2, 6] — too short kills the readability window, too long trivialises encounters`);
});

test('TIME_DILATION places the field at PLAYER position (no aim, mirrors REPAIR_PROTOCOL)', () => {
  // Self-centred placement is the design — no `(mouse.x + cam.x) /
  // TILE` aim block, just `x:player.x, y:player.y`. Aim-placement
  // would shift the niche toward STATIC_FIELD/CHRONO_LURE territory;
  // self-anchored placement is the differentiator (player drops it
  // at their feet, can dash through, can stand in it for safety).
  const body = timeDilationCaseBodyNoDead();
  // Must use player.x / player.y as the spawn coords.
  assert.match(body, /x\s*:\s*player\.x/,
    'TIME_DILATION must set effect.x to player.x (self-centred placement)');
  assert.match(body, /y\s*:\s*player\.y/,
    'TIME_DILATION must set effect.y to player.y (self-centred placement)');
  // Must NOT contain a mouse-based aim resolver — that would shift
  // the niche toward placed markers.
  assert.ok(!/\(\s*mouse\.x\s*\+\s*[a-zA-Z_$][\w$]*\.x\s*\)\s*\/\s*TILE/.test(body),
    'TIME_DILATION case must NOT read aim x from mouse.x (self-centred placement, not aim-placed)');
});

test('TIME_DILATION deduplicates: max 1 active field (recasting replaces existing AND clears stale _timeMul)', () => {
  // Without dedup, stacked fields would double-write _timeMul on
  // overlapping projectiles AND multiply per-tick costs. The dedup
  // loop must appear EXACTLY ONCE in the case body (sibling-
  // neutralizer bypass class — a second loop after the canonical
  // one could splice the freshly-pushed field). When the displaced
  // field had projectiles still inside, those projectiles' _timeMul
  // must be cleared — otherwise a recast leaks slowed projectiles
  // into the next field's lifetime.
  const body = timeDilationCaseBodyNoDead();
  const dedupRe = /for\s*\([^)]*hackwareEffects\.length[^)]*\)/g;
  const m = body.match(dedupRe) || [];
  assert.equal(m.length, 1,
    `TIME_DILATION case must contain EXACTLY ONE dedup loop over hackwareEffects (sibling-neutralizer bypass class) — got ${m.length}`);
  assert.match(body, /hackwareEffects\[\s*j\s*\]\.type\s*===\s*'time_field'/,
    'TIME_DILATION dedup loop must filter on type === time_field');
  assert.match(body, /hackwareEffects\.splice\(\s*j\s*,\s*1\s*\)/,
    'TIME_DILATION dedup loop must splice matching entries');
  // The dedup loop body must clear _timeMul on existing slowed
  // projectiles before splicing — the recast-leak guard.
  // HARDENED per opus-4.7 r2 Issue 3: use BACKREFERENCES so the
  // sentinel-bypass `if (p && p._timeMul !== undefined &&
  // sentinel._timeMul !== 1) p._timeMul = 1;` is rejected.
  const dedupBlock = extractBlock(body, /for\s*\([^)]*hackwareEffects\.length[^)]*\)/);
  assert.ok(dedupBlock, 'TIME_DILATION dedup loop body must be brace-balanced');
  assert.ok(!hasDeadBranch(dedupBlock),
    'TIME_DILATION dedup loop body must not contain a dead branch wrapping the projectile-restore');
  assert.match(dedupBlock, /for\s*\(\s*const\s+\w+\s+of\s+projectiles\s*\)/,
    'TIME_DILATION dedup loop must walk projectiles to clear stale _timeMul (recast-leak guard)');
  assert.match(dedupBlock, /if\s*\(\s*(\w+)\s*&&\s*\1\._timeMul\s*!==\s*undefined\s*&&\s*\1\._timeMul\s*!==\s*1\s*\)\s*\1\._timeMul\s*=\s*1\s*;/,
    'TIME_DILATION dedup loop must contain the canonical restore statement with the SAME identifier in all four slots (opus-4.7 r2 Issue 3 sentinel-bypass: mirrors the expire-cleanup hardening)');
});

test('TIME_DILATION plays a dedicated audio cue (audio.hackwareTimeDilation) on activation', () => {
  const body = timeDilationCaseBody();
  assert.match(body, /audio\.hackwareTimeDilation\(\)/,
    'TIME_DILATION case must call audio.hackwareTimeDilation() on cast');
});

// ─── Update branch (per-frame) ────────────────────────────────────────────

test('updateHackwareEffects has a time_field branch (per-frame logic exists)', () => {
  // Without an update branch the field renders but has no effect:
  // enemies don't slow, projectiles don't slow, activation cost
  // burns for nothing.
  const block = timeFieldUpdateBlock();
  assert.ok(block.length > 100,
    'time_field update branch must contain meaningful per-frame logic (got near-empty body)');
});

test('time_field enemy slow loop iterates EXACTLY ONCE, applies stronger-wins slowFactor, skips disguised + phased mobs (LOS-gated)', () => {
  // BYPASS-RESISTANT: per CHRONO_LURE r2 + EMP_LINE r2 findings, a
  // sibling neutralizer loop (`for (const e of enemies) {
  // e.slowFactor = 1; }`) after the canonical loop would defeat
  // every in-loop assertion. Pin EXACTLY ONE for-of-enemies in the
  // update branch (since time_field has only the enemy slow as its
  // enemy-touching loop — no second pull/stun loop). Also reject
  // alternate iterators that would mutate enemies.
  const block = timeFieldUpdateBlock();
  const re = /for\s*\(\s*const\s+\w+\s+of\s+enemies\s*\)/g;
  const matches = block.match(re) || [];
  assert.equal(matches.length, 1,
    `time_field update branch must contain EXACTLY ONE \`for (const e of enemies)\` loop (sibling-neutralizer bypass class) — got ${matches.length}`);
  // Reject other iterator shapes that touch enemies (alternate-iterator class).
  // HARDENED per opus-4.7 TIME_DILATION Issue 7: added reverse-indexed
  // and while-decrement loop shapes that the original ascending-only
  // detector missed.
  /** @type {[string, RegExp][]} */
  const forbiddenIterators = [
    ['enemies.forEach',           /\benemies\s*\.\s*forEach\s*\(/g],
    ['enemies.map',               /\benemies\s*\.\s*map\s*\(/g],
    ['enemies.filter',            /\benemies\s*\.\s*filter\s*\(/g],
    ['enemies.reduce',            /\benemies\s*\.\s*reduce\s*\(/g],
    ['enemies.some',              /\benemies\s*\.\s*some\s*\(/g],
    ['enemies.every',             /\benemies\s*\.\s*every\s*\(/g],
    ['enemies.find',              /\benemies\s*\.\s*find\s*\(/g],
    ['enemies.values',            /\benemies\s*\.\s*values\s*\(/g],
    ['enemies.keys',              /\benemies\s*\.\s*keys\s*\(/g],
    ['enemies.entries',           /\benemies\s*\.\s*entries\s*\(/g],
    ['enemies[i] write',          /\benemies\s*\[\s*[a-zA-Z_$][\w$]*\s*\]\s*\.[a-zA-Z_$][\w$]*\s*=/g],
    ['ascending indexed for-loop',/for\s*\(\s*let\s+\w+\s*=\s*0\s*;\s*\w+\s*<\s*enemies\.length\s*;/g],
    ['reverse indexed for-loop',  /for\s*\(\s*let\s+\w+\s*=\s*enemies\.length/g],
    ['while-over-enemies',        /while\s*\([^)]*\benemies\.length\b/g],
  ];
  for (const [label, fre] of forbiddenIterators) {
    const m = block.match(fre);
    assert.ok(!m,
      `time_field update branch must NOT use \`${label}\` (alternate-iterator bypass class)`);
  }
  // Extract the enemy loop body.
  const enemyLoop = extractBlock(block, /for\s*\(\s*const\s+\w+\s+of\s+enemies\s*\)/);
  assert.ok(enemyLoop, 'time_field enemy loop must be brace-balanced');
  assert.ok(!hasDeadBranch(enemyLoop),
    'time_field enemy loop body must not contain a `if (false) { ... }` dead branch (or always-true early-exit gate)');
  // Skip clauses (mirrors CHRONO_LURE/STATIC_FIELD precedent).
  assert.match(enemyLoop, /if\s*\(\s*\w+\._disguised\s*\)\s*continue/,
    'time_field enemy loop must skip disguised mimics (no mid-fight identity reveal via SLOW visual)');
  assert.match(enemyLoop, /if\s*\(\s*\w+\._wrPhased\s*\)\s*continue/,
    'time_field enemy loop must skip _wrPhased mobs (phased units are non-targetable per gravity-well precedent)');
  // LOS gate (prevents through-wall slow at radius boundary).
  assert.match(enemyLoop, /map\s*&&\s*hasLOS\(\s*\w+\.x\s*,\s*\w+\.y\s*,\s*fx\.x\s*,\s*fx\.y\s*,\s*map\s*\)/,
    'time_field enemy loop must require LOS from enemy to field centre (prevents through-wall slow at boundary)');
  // Single slowFactor write — HARDENED per opus-4.7 TIME_DILATION
  // Issue 5: the original `\.slowFactor\s*=` regex MISSED compound
  // assignments (`*=`, `/=`, `+=`, `-=`) because `\s*` then `=`
  // cannot consume the `*` first. Mutation `e.slowFactor *= 0;`
  // FREEZES every enemy in the field while passing the original
  // count guard. The hardened regex is compound-assignment-aware via
  // an optional operator class with negative-lookahead `(?!=)` to
  // exclude `==`/`===`. Same vector applies to slowTimer.
  const slowFactorWrites = (enemyLoop.match(/\.slowFactor\s*(?:[+\-*/%&|^]|\*\*|<<|>>|>>>|&&|\|\||\?\?)?=(?!=)/g) || []).length;
  assert.equal(slowFactorWrites, 1,
    `time_field enemy loop body must contain EXACTLY ONE \`slowFactor =\` write (compound-assignment-aware count) — got ${slowFactorWrites}; opus-4.7 r1 Issue 5 bypass: trailing \`e.slowFactor *= 0;\` freezes every enemy`);
  const slowTimerWrites = (enemyLoop.match(/\.slowTimer\s*(?:[+\-*/%&|^]|\*\*|<<|>>|>>>|&&|\|\||\?\?)?=(?!=)/g) || []).length;
  assert.equal(slowTimerWrites, 1,
    `time_field enemy loop body must contain EXACTLY ONE \`slowTimer =\` write (compound-assignment-aware count) — got ${slowTimerWrites}; opus-4.7 r1 Issue 5 mirror: trailing \`e.slowTimer = 0;\` clears the slow's residual window every frame`);
  // Stronger-wins slow assignment (full Math.min ternary, end-anchored).
  // BYPASS-RESISTANT: end-anchor `\)\s*;` rules out `Math.min(...) * 1.5`
  // (anti-slow), `Math.min(...) - 0` (no-op composition), `, 0)` (third
  // arg → permaslow), `&& 0` (returns 0) — all bypass classes opus-4.7
  // r2 demonstrated on EMP_LINE's stun assignment.
  assert.match(enemyLoop, /\.slowFactor\s*=\s*Math\.min\(\s*\w+\.slowFactor\s*\|\|\s*1\s*,\s*\w+\.isBoss\s*\?\s*0?\.\d+\s*:\s*0?\.\d+\s*\)\s*;/,
    'time_field slow assignment must be the COMPLETE statement `e.slowFactor = Math.min(e.slowFactor || 1, e.isBoss ? bossFactor : gruntFactor);` — appending * X or extra args is a known bypass class');
  // slowTimer refresh — must be Math.max with ≥0.2s residual window.
  assert.match(enemyLoop, /\.slowTimer\s*=\s*Math\.max\(\s*\w+\.slowTimer\s*\|\|\s*0\s*,\s*0?\.\d+\s*\)\s*;/,
    'time_field must refresh slowTimer via `Math.max(e.slowTimer || 0, ...)` — without the timer, the slow expires the next frame');
});

test('time_field enemy slow factor: bosses get a halved (weaker) effect than grunts (matches EMP_BURST/EMP_LINE precedent)', () => {
  // Bosses must get a less-aggressive slow than grunts — without
  // this, players could perma-control bosses by chaining
  // TIME_DILATION + STATIC_FIELD or by spamming. Mirror the
  // EMP_BURST/EMP_LINE half-stun pattern.
  const block = timeFieldUpdateBlock();
  const enemyLoop = extractBlock(block, /for\s*\(\s*const\s+\w+\s+of\s+enemies\s*\)/);
  assert.ok(enemyLoop, 'time_field enemy loop must be brace-balanced');
  // Pull the boss / grunt factor pair from the slowFactor assignment.
  const m = enemyLoop.match(/\.slowFactor\s*=\s*Math\.min\(\s*\w+\.slowFactor\s*\|\|\s*1\s*,\s*\w+\.isBoss\s*\?\s*(0?\.\d+)\s*:\s*(0?\.\d+)\s*\)/);
  assert.ok(m, 'time_field slowFactor ternary must be parseable as `isBoss ? bossF : gruntF`');
  const bossF = parseFloat(m[1]);
  const gruntF = parseFloat(m[2]);
  assert.ok(gruntF > 0 && gruntF < 1,
    `grunt slow factor (${gruntF}) must be in (0, 1) — 0 would freeze, 1 would no-op`);
  assert.ok(bossF > gruntF,
    `boss slow factor (${bossF}) must be > grunt (${gruntF}) — bosses receive a WEAKER slow per EMP_BURST/EMP_LINE precedent (otherwise stacking trivialises bosses)`);
  assert.ok(bossF < 1,
    `boss slow factor (${bossF}) must be < 1 — bosses still get a slow, just a halved one`);
  // Sanity: grunt factor must be MEANINGFUL (≤0.5 = at least halved
  // movement). The novel-ness of the field comes from "enemies barely
  // move"; a 0.8 slow is indistinguishable from STATIC_FIELD.
  assert.ok(gruntF <= 0.5,
    `grunt slow factor (${gruntF}) must be <= 0.5 — anything weaker is indistinguishable from STATIC_FIELD's 0.6 baseline, defeating the design intent`);
});

test('time_field projectile slow loop iterates EXACTLY ONCE, sets _timeMul, skips player + ally-turret shots (the novel mechanic)', () => {
  // The slow-projectile mechanic IS the niche. Without the loop, the
  // field collapses to "stronger STATIC_FIELD slow" and loses its
  // distinguishing feature. Single-occurrence guard defeats the
  // sibling-neutralizer bypass class. Player + ally-turret skip
  // mirrors REVERSE_POLARITY's reflect-loop precedent.
  const block = timeFieldUpdateBlock();
  const re = /for\s*\(\s*const\s+\w+\s+of\s+projectiles\s*\)/g;
  const matches = block.match(re) || [];
  assert.equal(matches.length, 1,
    `time_field update branch must contain EXACTLY ONE \`for (const p of projectiles)\` loop (sibling-neutralizer bypass class) — got ${matches.length}`);
  // Reject alternate iterators on projectiles (HARDENED per opus-4.7
  // TIME_DILATION Issue 7 — added reverse-indexed `for (let i =
  // projectiles.length - 1; i >= 0; i--)` and `while (i--)` shapes).
  /** @type {[string, RegExp][]} */
  const forbiddenProjIterators = [
    ['projectiles.forEach',           /\bprojectiles\s*\.\s*forEach\s*\(/g],
    ['projectiles.map',               /\bprojectiles\s*\.\s*map\s*\(/g],
    ['projectiles.filter',            /\bprojectiles\s*\.\s*filter\s*\(/g],
    ['projectiles.reduce',            /\bprojectiles\s*\.\s*reduce\s*\(/g],
    ['projectiles.some',              /\bprojectiles\s*\.\s*some\s*\(/g],
    ['projectiles.every',             /\bprojectiles\s*\.\s*every\s*\(/g],
    ['projectiles.find',              /\bprojectiles\s*\.\s*find\s*\(/g],
    ['projectiles.values',            /\bprojectiles\s*\.\s*values\s*\(/g],
    ['projectiles.keys',              /\bprojectiles\s*\.\s*keys\s*\(/g],
    ['projectiles.entries',           /\bprojectiles\s*\.\s*entries\s*\(/g],
    ['ascending indexed for-loop',    /for\s*\(\s*let\s+\w+\s*=\s*0\s*;\s*\w+\s*<\s*projectiles\.length\s*;/g],
    ['reverse indexed for-loop',      /for\s*\(\s*let\s+\w+\s*=\s*projectiles\.length/g],
    ['while-over-projectiles',        /while\s*\([^)]*\bprojectiles\.length\b/g],
    ['indexed projectile-prop write', /\bprojectiles\s*\[\s*[a-zA-Z_$][\w$]*\s*\]\s*\.[a-zA-Z_$][\w$]*\s*=/g],
  ];
  for (const [label, fre] of forbiddenProjIterators) {
    const m = block.match(fre);
    assert.ok(!m,
      `time_field update branch must NOT use \`${label}\` (alternate-iterator bypass class — would mutate projectiles outside the canonical for-of loop)`);
  }
  // Extract the projectile loop body.
  const projLoop = extractBlock(block, /for\s*\(\s*const\s+\w+\s+of\s+projectiles\s*\)/);
  assert.ok(projLoop, 'time_field projectile loop must be brace-balanced');
  assert.ok(!hasDeadBranch(projLoop),
    'time_field projectile loop body must not contain a dead branch (or always-true early-exit gate)');
  // Player-shot skip — HARDENED per opus-4.7 TIME_DILATION Issue 3.
  // Pin the FULL OR composition (`p.fromPlayer || p.fromPlayerShot ||
  // p.isAllyTurret`) — independent presence checks were defeatable by
  // swapping `||` for `&&`, which would never skip and would slow
  // every player/ally bullet (punishing the player for using their
  // own hackware).
  assert.match(projLoop, /\bp\.fromPlayer\s*\|\|\s*p\.fromPlayerShot\s*\|\|\s*p\.isAllyTurret\b/,
    'time_field projectile loop must skip on `p.fromPlayer || p.fromPlayerShot || p.isAllyTurret` (OR composition pinned — opus-4.7 r1 bypass: AND-substitution would never skip and slow every player+ally bullet)');
  // _timeMul write — HARDENED per opus-4.7 TIME_DILATION Issue 2.
  // EXACTLY-ONE write guard (mirrors slowFactor) — defeats the
  // trailing-override bypass `p._timeMul = inside ? 0.5 : 1; p._timeMul = 1;`
  // that satisfied the presence-only assertion but disabled the slow.
  // Compound-assignment-aware (opus-4.7 Issue 5 mirror): match `=`,
  // `*=`, `/=`, `+=`, `-=`, `&&=`, `||=`, `??=` — the negative
  // lookahead `(?!=)` excludes equality comparisons.
  const tmulWrites = (projLoop.match(/\._timeMul\s*(?:[+\-*/%&|^]|\*\*|<<|>>|>>>|&&|\|\||\?\?)?=(?!=)/g) || []).length;
  assert.equal(tmulWrites, 1,
    `time_field projectile loop must contain EXACTLY ONE _timeMul assignment (got ${tmulWrites}) — opus-4.7 r1 bypass: trailing \`p._timeMul = 1;\` after the canonical assignment satisfies presence regex but zeros the slow`);
});

test('time_field projectile loop slow factor: ternary form pinned, BOTH branches anchored, in-zone factor in (0.2, 0.8) — meaningful slow, not a freeze', () => {
  // _timeMul = 0 would freeze projectiles in place (gameplay-breaking
  // — could trap shots forever inside a doorway). _timeMul = 1 is a
  // no-op. The canonical 0.5 (half speed) is the design target;
  // accept any in-zone factor in (0.2, 0.8) as a balance band.
  //
  // HARDENED per opus-4.7 TIME_DILATION Issue 1: pin the FULL ternary
  // shape `inside ? F : 1`. The original test allowed `_timeMul = F`
  // standalone, which would slow EVERY enemy bullet on the level
  // regardless of distance from the field (effective global slow). We
  // require the false branch (the outside-zone "= 1" reset) to be
  // present and the geometric `fx.radius * fx.radius` distance check
  // to anchor the gate.
  const block = timeFieldUpdateBlock();
  const projLoop = extractBlock(block, /for\s*\(\s*const\s+\w+\s+of\s+projectiles\s*\)/);
  assert.ok(projLoop, 'time_field projectile loop must be brace-balanced');
  // Pin the canonical ternary form `<gate> ? <slowFactor> : 1` — the
  // : 1 is the outside-zone reset (codex r1 finding + opus-4.7 r1
  // Issue 1). Without it, projectiles outside the radius would NEVER
  // be reset to 1.
  const m = projLoop.match(/\._timeMul\s*=\s*\w+\s*\?\s*(0?\.\d+)\s*:\s*1\b/);
  assert.ok(m,
    'time_field projectile slow assignment must pin the FULL ternary shape `_timeMul = <gate> ? <factor> : 1` — without the `: 1` reset, outside-zone projectiles never restore to full speed (codex r1 + opus-4.7 r1 Issue 1)');
  const f = parseFloat(m[1]);
  assert.ok(f > 0.2 && f < 0.8,
    `time_field _timeMul in-zone factor (${f}) must be in (0.2, 0.8) — < 0.2 risks freezing bullets in doorways, > 0.8 is indistinguishable from baseline`);
  // Pin the geometric distance gate — `< fx.radius * fx.radius`
  // (squared comparison) — opus-4.7 r1 Issue 1 + r2 Issue 1: without
  // pinning the COMPARISON DIRECTION, a one-character mutation
  // flipping `<` to `>=` slows enemy bullets OUTSIDE the field and
  // leaves bullets INSIDE at full speed (catastrophic inversion of
  // the design — one of the cleanest bypasses opus-4.7 r2 found).
  // Pin the full `< (fx.radius * fx.radius)` shape with the
  // less-than operator anchored.
  assert.match(projLoop, /<\s*\(?\s*fx\.radius\s*\*\s*fx\.radius\s*\)?/,
    'time_field projectile loop must compute the in-zone gate via `< (fx.radius * fx.radius)` squared distance with the LESS-THAN operator pinned (opus-4.7 r2 Issue 1: a one-char `<`→`>=` mutation slows OUTSIDE the field and frees bullets INSIDE — catastrophic inversion that satisfies the geometry-substring anchor)');
  // Defence-in-depth: reject `>=`, `>`, `==`, `===`, `<=` near the
  // squared-radius literal — any of these would invert or break the
  // gate. We allow only the `<` operator on the LEFT of `fx.radius
  // * fx.radius`.
  assert.ok(!/(?:>=?|<=|===?|!==?)\s*\(?\s*fx\.radius\s*\*\s*fx\.radius/.test(projLoop),
    'time_field projectile loop must NOT use `>`, `>=`, `<=`, `==`, `===`, `!==` against `fx.radius * fx.radius` — only `<` produces the correct in-zone gate');
});

// ─── Expiry cleanup ───────────────────────────────────────────────────────

test('time_field expiry branch restores _timeMul on lingering projectiles (no perma-slow leak)', () => {
  // When the field expires, projectiles still inside the radius have
  // _timeMul=0.5. The per-frame "default to 1 then maybe 0.5" reset
  // STOPS RUNNING as soon as fx is spliced. Without an expiry-branch
  // restore, those projectiles crawl forever at half speed —
  // gameplay-breaking (enemy shots become permanently weak,
  // floor-locked).
  //
  // The expiry handling lives in the `if (fx.age >= fx.maxAge)` branch
  // at the top of updateHackwareEffects (mirrors hologram + decoy_turret
  // expire-cleanup pattern).
  const expireSlice = sliceBetween(
    CONTENT_NC,
    /if\s*\(\s*fx\.age\s*>=\s*fx\.maxAge\s*\)\s*\{/,
    /hackwareEffects\.splice\(\s*i\s*,\s*1\s*\)\s*;\s*continue\s*;/
  );
  assert.ok(expireSlice, 'updateHackwareEffects must contain a `if (fx.age >= fx.maxAge) { ... hackwareEffects.splice(i,1); continue; }` expire-branch (canonical pattern)');
  assert.match(expireSlice, /if\s*\(\s*fx\.type\s*===\s*'time_field'\s*\)/,
    "expire branch must contain a `if (fx.type === 'time_field')` cleanup case");
  // Extract the time_field cleanup block + assert it walks
  // projectiles + clears _timeMul.
  const cleanup = extractBlock(expireSlice, /if\s*\(\s*fx\.type\s*===\s*'time_field'\s*\)/);
  assert.ok(cleanup, 'time_field expire-cleanup block must be brace-balanced');
  assert.ok(!hasDeadBranch(cleanup),
    'time_field expire-cleanup block must not contain a dead branch wrapping the projectile-restore');
  // HARDENED per opus-4.7 TIME_DILATION Issue 6: pin the cleanup loop
  // body to its CANONICAL form. Without this, a composite always-
  // false `if (... && false) p._timeMul = 1;` would pass the bare-
  // literal hasDeadBranch check while runtime-disabling the restore.
  // The hardened hasDeadBranch above now catches the explicit
  // `&& false` form, but pinning the canonical statement adds
  // defence-in-depth against equivalent constructs we haven't
  // enumerated.
  assert.match(cleanup, /for\s*\(\s*const\s+\w+\s+of\s+projectiles\s*\)/,
    'time_field expire-cleanup must walk projectiles to restore _timeMul (perma-slow-leak guard)');
  // Pin the canonical restore statement: an `if` checking
  // `_timeMul !== undefined && _timeMul !== 1` then setting `_timeMul = 1;`.
  // HARDENED per opus-4.7 r2 Issue 3 — use BACKREFERENCES to require
  // the SAME identifier across all four slots. Without backrefs, an
  // adversary could plant `if (p && p._timeMul !== undefined &&
  // sentinel._timeMul !== 1) p._timeMul = 1;` where `sentinel = {
  // _timeMul: 1 }` makes the third clause permanently false → the
  // restore never runs → perma-slow leak survives field expiry.
  assert.match(cleanup, /if\s*\(\s*(\w+)\s*&&\s*\1\._timeMul\s*!==\s*undefined\s*&&\s*\1\._timeMul\s*!==\s*1\s*\)\s*\1\._timeMul\s*=\s*1\s*;/,
    'time_field expire-cleanup must contain the canonical restore statement `if (p && p._timeMul !== undefined && p._timeMul !== 1) p._timeMul = 1;` with the SAME identifier in all four slots (opus-4.7 r2 Issue 3 sentinel-bypass: independent identifiers admit `if (p && p._timeMul !== undefined && sentinel._timeMul !== 1) p._timeMul = 1;` which never fires)');
});

// ─── Projectile.update integration (the hot-path edit) ────────────────────

test('Projectile.update reads _timeMul as a per-frame velocity multiplier (the hot-path consumer; identifier-bound)', () => {
  // The producer (time_field update branch) sets p._timeMul = 0.5;
  // the consumer (Projectile.update) MUST read it and multiply per-
  // frame movement. Without this read, the entire projectile-slow
  // mechanic is dead code.
  //
  // BYPASS-RESISTANT (HARDENED per opus-4.7 TIME_DILATION Issue 4):
  // the original test pinned `\w+` in the movement multiplier slot,
  // which let a contributor compute `tmul = this._timeMul || 1` then
  // hardcode `const k = 1; mx = ... * k * dt` — both regex
  // assertions pass while runtime ignores _timeMul. Capture the
  // identifier bound from `this._timeMul || 1` and assert it MATCHES
  // the identifier consumed in mx/my.
  //
  // FURTHER HARDENED per opus-4.7 r2 Issue 4 + codex r2 Issue 1: the
  // identifier-equality check is defeated by INNER-SCOPE SHADOWING:
  //   const tmul = this._timeMul || 1;
  //   { const tmul = 1; const mx = this.dx*this.spd*tmul*dt, my = ...; }
  // Captures all match `tmul`, equality passes, runtime is broken.
  // Mitigation: negative-lookahead in the lazy gap rejects any
  // `const <ident> = 1;` between the bind site and the mx use site,
  // which would be the canonical shadow vector. Note: we don't
  // explicitly enforce no `{` in between because legitimate
  // implementations may still wrap mx/my in a block; the negative
  // lookahead on `const ... = 1;` is sufficient because that's the
  // only way to shadow with a no-op value.
  const m = CONTENT_PROJECTILES_NC.match(
    /const\s+(\w+)\s*=\s*this\._timeMul\s*\|\|\s*1\s*;(?:(?!const\s+\w+\s*=\s*1\s*;)[\s\S]){0,400}?const\s+mx\s*=\s*this\.dx\s*\*\s*this\.spd\s*\*\s*(\w+)\s*\*\s*dt\s*,\s*my\s*=\s*this\.dy\s*\*\s*this\.spd\s*\*\s*(\w+)\s*\*\s*dt\s*;/
  );
  assert.ok(m,
    'Projectile.update must (a) bind a local from `this._timeMul || 1` and (b) consume that SAME identifier as a factor in BOTH mx and my within ~400 chars (opus-4.7 r1 Issue 4: a hardcoded `const k = 1; mx = ...*k*dt` would satisfy a `\\w+`-only regex while disabling the slow). Negative-lookahead also rejects any `const X = 1;` between bind and use — opus-4.7 r2 + codex r2: inner-scope `const tmul = 1;` shadow would otherwise pass identifier equality');
  assert.equal(m[1], m[2],
    `Projectile.update mx multiplier (${m[2]}) must be the SAME identifier bound from this._timeMul (${m[1]}) — opus-4.7 r1 Issue 4 bypass: a different identifier (e.g. hardcoded \`k = 1\`) zeros the entire slow mechanic`);
  assert.equal(m[1], m[3],
    `Projectile.update my multiplier (${m[3]}) must be the SAME identifier bound from this._timeMul (${m[1]}) — opus-4.7 r1 Issue 4 bypass: identifier mismatch between mx and my would slow only one axis`);
});

test('Projectile pool _init resets _timeMul to 1 (recycled-slot inheritance guard)', () => {
  // A projectile pool slot can be reused. If a slot's prior occupant
  // died inside a TIME_DILATION zone with _timeMul=0.5, the next
  // shot fired from that slot would crawl at half speed without an
  // explicit reset. Pin the reset in the _init reset block.
  //
  // Extract the _init method body and assert _timeMul=1 lives in the
  // explicit-reset block (alongside isAllyTurret, fromPlayerShot,
  // etc.).
  const initMatch = CONTENT_PROJECTILES_NC.match(/_init\s*\([^)]*\)\s*\{[\s\S]*?this\.isAllyTurret\s*=\s*false\s*;[\s\S]*?(?=\n\s*\}\n)/);
  assert.ok(initMatch, 'Projectile._init reset block must be locatable via the isAllyTurret = false anchor');
  assert.match(initMatch[0], /this\._timeMul\s*=\s*1/,
    'Projectile._init must reset this._timeMul = 1 (recycled-slot inheritance guard — without it, a slot last used by a slowed enemy bullet leaks 0.5 into the next shot)');
});

// ─── Reflect-cleanup integration (REVERSE_POLARITY + PARRY) ──────────────

test('REVERSE_POLARITY reflect resets _timeMul on flipped projectiles (no perma-slow leak through ownership flip)', () => {
  // RUNTIME BUG (codex r1 + opus-4.6 r1 + opus-4.7 r1 of TIME_DILATION):
  // when REVERSE_POLARITY at content.js:~1136 reflects an enemy bullet
  // that's currently inside a TIME_DILATION field (_timeMul=0.5), the
  // reflect flips fromPlayer=true. The time_field per-frame loop then
  // SKIPS the now-player-owned projectile (`if (p.fromPlayer || ...)
  // continue;`), so _timeMul=0.5 sticks until field expiry. Result:
  // the player's reflected shot crawls at half speed even outside the
  // field, until either the field expires (cleanup walks all
  // projectiles) or the projectile dies. Mitigation: the reflect site
  // must explicitly reset _timeMul to 1 as part of the ownership-
  // flip cleanup (mirrors the existing reset of hitEnemies,
  // maxPierces, piercing, homing, bouncesLeft, etc.).
  const polaritySlice = sliceBetween(
    CONTENT_NC,
    /case\s+'REVERSE_POLARITY'\s*:/,
    /\baudio\.reflect\(\)/
  );
  assert.ok(polaritySlice, 'REVERSE_POLARITY case body must be locatable');
  assert.match(polaritySlice, /\bp\._timeMul\s*=\s*1\b/,
    'REVERSE_POLARITY reflect must include `p._timeMul = 1;` (codex r1 + opus-4.6 r1 + opus-4.7 r1: ownership-flip cleanup must touch _timeMul to prevent reflected bullets from crawling at half speed inside an active TIME_DILATION field)');
});

test('PARRY reflect resets _timeMul on flipped projectiles (mirrors REVERSE_POLARITY fix)', () => {
  // Same root cause as REVERSE_POLARITY (above): PARRY at
  // content/projectiles.js also flips fromPlayer=true when a dashing
  // player intercepts an enemy bullet. The fix mirrors the
  // REVERSE_POLARITY reflect — explicit `this._timeMul = 1;` as part
  // of the ownership-flip cleanup. Caught by opus-4.6 r1 of
  // TIME_DILATION (codex + opus-4.7 only flagged REVERSE_POLARITY;
  // opus-4.6 found the second site).
  const parrySlice = sliceBetween(
    CONTENT_PROJECTILES_NC,
    /player\.perks\.PARRY\s*&&\s*player\.dashTimer\s*>\s*0/,
    /\baudio\.reflect\(\)/
  );
  assert.ok(parrySlice, 'PARRY reflect body must be locatable');
  assert.match(parrySlice, /\bthis\._timeMul\s*=\s*1\b/,
    'PARRY reflect must include `this._timeMul = 1;` (opus-4.6 r1 of TIME_DILATION: ownership-flip cleanup mirrors REVERSE_POLARITY — reflected bullets must snap back to full speed even inside an active TIME_DILATION field)');
});

// ─── Anti-scope-creep guards ─────────────────────────────────────────────

test('time_field update branch contains ZERO takeDamage calls (anti-scope-creep: TIME_DILATION is control-only, distinct from STATIC_FIELD)', () => {
  // opus-4.6 r1 of TIME_DILATION found a coverage gap: the design
  // distinction from STATIC_FIELD is that TIME_DILATION does NO
  // damage — it's a pure control field. If a future contributor
  // adds `e.takeDamage(...)` to the time_field update branch, it
  // collapses the niche into "STATIC_FIELD with stronger slow", and
  // damages bosses faster than intended (TIME_DILATION's stronger
  // boss slow combined with chip damage would trivialise boss
  // fights).
  const block = timeFieldUpdateBlock();
  assert.ok(!/\.takeDamage\s*\(/.test(block),
    'time_field update branch must contain NO takeDamage calls — TIME_DILATION is control-only (the distinguishing feature vs STATIC_FIELD which slows + damages)');
});

test('lasers, wallTurrets, and disruptionFields do NOT read _timeMul (anti-scope-creep: TIME_DILATION is bullet-only)', () => {
  // opus-4.6 r1 of TIME_DILATION found a scope-creep gap: the design
  // intent is that _timeMul affects PROJECTILE velocity only — not
  // laser charge times, not wall-turret cooldowns, not disruption
  // field tick rates. Without this guard, a future contributor could
  // wire _timeMul into other entity update functions and the slow
  // would silently apply to systems it was never meant to touch
  // (e.g. slowing laser charge would make TIME_DILATION an effective
  // counter to hazard rooms — out of scope and unintended).
  //
  // Read entities.js (the home of these systems) and confirm
  // _timeMul is unreferenced.
  const ENTITIES = fs.readFileSync(
    path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
  );
  assert.ok(!/\b_timeMul\b/.test(ENTITIES),
    'src/entities.js must NOT reference _timeMul — TIME_DILATION is projectile-only (opus-4.6 r1 scope-creep guard); accidentally wiring _timeMul into laser/wallTurret/disruptionField update would silently expand TIME_DILATION beyond its design boundary');
});

// ─── Visual + audio ───────────────────────────────────────────────────────

test('drawHackwareEffects has a time_field draw branch with NEON.draw primitives (player needs to see the field)', () => {
  // Without a draw branch the field is invisible — players can't
  // tell where the slow zone is, defeating positional play.
  // There are THREE `if (fx.type === 'time_field')` sites in
  // CONTENT_NC: #1 expire-cleanup, #2 per-frame update, #3 draw.
  // The draw branch is THIRD.
  let drawIdx = -1;
  let count = 0;
  const re = /if\s*\(\s*fx\.type\s*===\s*'time_field'\s*\)/g;
  let m;
  while ((m = re.exec(CONTENT_NC)) !== null) {
    count++;
    if (count === 3) { drawIdx = m.index; break; }
  }
  assert.ok(drawIdx >= 0, 'CONTENT must contain THREE time_field branches (expire + update + draw)');
  const drawSlice = extractBlock(CONTENT_NC.slice(drawIdx), /if\s*\(\s*fx\.type\s*===\s*'time_field'\s*\)/);
  assert.ok(drawSlice, 'time_field draw branch must be brace-balanced');
  assert.ok(!hasDeadBranch(drawSlice),
    'time_field draw branch must not contain a dead branch (or always-true early-exit gate)');
  assert.match(drawSlice, /ctx\.save\(\)/,
    'time_field draw branch must call ctx.save() (canvas state isolation per existing draw-branch convention)');
  assert.match(drawSlice, /NEON\.draw\.(?:circle|circleStroke|line)/,
    'time_field draw branch must use NEON.draw.* primitives (the canonical draw API)');
});

test('audio.hackwareTimeDilation is defined in platform.js', () => {
  // Without the audio method, activation crashes at the call site.
  assert.match(PLATFORM_NC, /hackwareTimeDilation\s*\(\s*\)\s*\{/,
    'platform.js must define an audio.hackwareTimeDilation() method (otherwise activation crashes)');
});

// ─── HACKWARE pool size canary ───────────────────────────────────────────

test('HACKWARE catalog has at least 14 entries (TIME_DILATION landed)', () => {
  // Canary RETIRED: this test was the exact-count canary when
  // TIME_DILATION was the latest hackware. The next-added hackware
  // (DATA_SPIKE) takes over the exact-count pin in its own test file —
  // see tests/data-spike-hackware.test.js. This regression guard
  // remains as a floor (>= 14) so a future contributor accidentally
  // deleting TIME_DILATION's catalog entry still trips a failure here.
  // Mirrors the modifier-pool canary pattern (tests/jammed-modifier
  // post-PROXIMITY).
  const hwBlock = CONTENT_NC.match(/const\s+HACKWARE\s*=\s*\{([\s\S]*?)\n\}\s*;/);
  assert.ok(hwBlock, 'HACKWARE registry block must be locatable');
  const keys = hwBlock[1].match(/^\s*([A-Z_]+)\s*:\s*\{/gm) || [];
  assert.ok(keys.length >= 14,
    `HACKWARE registry must have AT LEAST 14 entries (TIME_DILATION floor) — got ${keys.length}`);
});

// ─── SW cache freshness ───────────────────────────────────────────────────

test('sw.js uses network-first freshness instead of numeric cache versions', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /cacheFromNetwork\(e\)\.catch\(\(\) => caches\.match\(e\.request\)\)/);
});
