'use strict';
// DECOY_TURRET hackware — source-text wiring tests.
//
// content.js is browser-only (no UMD/CommonJS exports), so we can't load
// activateHackware/updateHackwareEffects directly under node:test. Instead,
// these tests assert the structural invariants any working DECOY_TURRET
// must satisfy: registry entry, activation case, per-frame update branch,
// expiry handler, draw branch, allied-projectile flag, LOS gate, and the
// shared `_wrPhased` intangibility exclusion (so EMP-bypass mobs like
// WRAITH/TUNNELLER aren't shootable while burrowed).
//
// All regex assertions run against COMMENT-STRIPPED source (CONTENT_NC).
// content.js already contains comments mentioning DECOY_TURRET (see
// HOLO_DECOY/STATIC_FIELD references near hackware activation), so a
// future edit could easily land a comment that satisfies a presence
// regex even after the executable code was removed. The most acute risk
// was the targeting count-check (>=3 instances of `if (fx.type ===
// 'decoy_turret')`) — three matching comments alone would silently make
// it pass after the real branches were deleted. Stripping comments first
// closes that hole and matches the precedent set by
// tests/{burst,execute,recoil,mark}-affix.test.js + retribution-perk.
//
// Each check fails loudly the moment a refactor drops a wire — exactly the
// failure mode that bit past hackware additions.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
);

// Strip JS comments before regex assertions so a `// case 'DECOY_TURRET':`
// commented-out construct can't satisfy a presence check (mark-affix /
// reverse-polarity / bulwark / hot-hand / glass-cannon / PR #209 precedent).
/** @param {string} src */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

// Brace-balanced extraction of a block opened by `openerRe`. Returns the
// substring from the opener through its matching `}`. Used here to isolate
// the PER-FRAME `if (fx.type === 'decoy_turret')` branch — there are three
// identically-headed branches in content.js (expiry, per-frame update,
// draw) and a regex-only slice would over-capture across them. The brace
// walker keeps each branch isolated.
//
// LIMITATION: this is a naive depth counter — it does NOT understand string
// literals, template literals, or regex literals. The current decoy_turret
// branches contain no braces inside string literals, so this is safe. If a
// future addition like `spawnDmgText(x, y, '{KO}', '#fff')` lands here,
// extractBranch returns null and the `assert.ok(branch, ...)` guard at every
// call site fails loudly with a clear message rather than silently passing.
/**
 * @param {string} src
 * @param {RegExp} openerRe
 */
function extractBranch(src, openerRe) {
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

const CONTENT_NC = stripComments(CONTENT);

test('DECOY_TURRET is registered in the HACKWARE catalog with required fields', () => {
  const re = /DECOY_TURRET:\s*\{\s*name:\s*'[^']+',\s*desc:\s*'[^']+',\s*colour:\s*'#[0-9a-fA-F]+',\s*icon:\s*'[^']+',\s*cooldown:\s*\d+/;
  assert.match(CONTENT_NC, re,
    'DECOY_TURRET registry entry must declare name/desc/colour/icon/cooldown in EXECUTABLE code');
});

test('activateHackware has a DECOY_TURRET case that pushes a decoy_turret effect', () => {
  // The activate switch must own the deploy. Without the case the cooldown
  // burns but nothing spawns.
  const caseRe = /case\s+'DECOY_TURRET':[\s\S]{0,1500}?hackwareEffects\.push\(\s*\{[\s\S]{0,400}?type:\s*'decoy_turret'/;
  assert.match(CONTENT_NC, caseRe,
    "activateHackware must push a {type:'decoy_turret'} effect in EXECUTABLE code");
});

test('DECOY_TURRET aim placement falls back to player tile if aim is in a wall', () => {
  // Projectiles spawning inside walls collide instantly; the case must guard
  // by checking the destination tile and falling back to player.x/player.y.
  const guardRe = /case\s+'DECOY_TURRET':[\s\S]{0,1500}?T\.FLOOR[\s\S]{0,200}?dx\s*=\s*player\.x;\s*dy\s*=\s*player\.y/;
  assert.match(CONTENT_NC, guardRe,
    'DECOY_TURRET must validate aim tile and fall back to player position in EXECUTABLE code');
});

test('DECOY_TURRET activation enforces max-1-active by splicing existing decoys', () => {
  // Mirrors STATIC_FIELD pattern. Without this, recasting stacks turrets.
  const dedupRe = /case\s+'DECOY_TURRET':[\s\S]{0,1500}?hackwareEffects\[j\]\.type\s*===\s*'decoy_turret'[\s\S]{0,100}?hackwareEffects\.splice\(j,\s*1\)/;
  assert.match(CONTENT_NC, dedupRe,
    'DECOY_TURRET must splice any existing decoy_turret on recast in EXECUTABLE code');
});

test('updateHackwareEffects has a decoy_turret per-frame branch', () => {
  // Without the update branch the turret never targets or fires.
  const updateRe = /if\s*\(\s*fx\.type\s*===\s*'decoy_turret'\s*\)\s*\{[\s\S]{0,3000}?projectiles\.push\(/;
  assert.match(CONTENT_NC, updateRe,
    'updateHackwareEffects must include a decoy_turret branch that pushes projectiles in EXECUTABLE code');
});

// Locate the per-frame UPDATE branch (not the expiry or draw branches).
// All three branches share the identical `if (fx.type === 'decoy_turret')`
// header. Find each one with extractBranch and pick the one that contains
// `fx.shootTimer` (which is unique to the per-frame branch). Operating on
// stripped source guarantees a future comment containing the header can't
// confuse the picker.
function decoyUpdateBody() {
  const re = /if\s*\(\s*fx\.type\s*===\s*'decoy_turret'\s*\)\s*\{/g;
  let m;
  let found = null;
  while ((m = re.exec(CONTENT_NC)) !== null) {
    const branch = extractBranch(CONTENT_NC.slice(m.index), /^/);
    if (branch && /fx\.shootTimer/.test(branch)) {
      found = branch;
      break;
    }
  }
  assert.ok(found, 'per-frame decoy_turret update branch (containing fx.shootTimer) must be found in EXECUTABLE code');
  return found;
}

test('decoy_turret targeting respects LOS and skips _wrPhased intangibles', () => {
  // The targeting loop must be LOS-gated AND must skip enemies with the
  // shared `_wrPhased` flag (WRAITH + TUNNELLER while burrowed). Otherwise
  // the turret would shoot through walls or hit unhittable mobs.
  const body = decoyUpdateBody();
  assert.match(body, /e\._wrPhased/,           'decoy_turret target loop must skip _wrPhased');
  assert.match(body, /hasLOS\(fx\.x,\s*fx\.y/, 'decoy_turret target loop must require LOS from turret to enemy');
});

test('decoy_turret projectiles set isAllyTurret=true so collision routes to enemies', () => {
  // Projectile collision in content.js gates ally-vs-enemy hit logic on
  // `isAllyTurret`. Without it the projectile would never hit anything
  // (fromPlayer=false, isGrenade=false → falls into "enemy projectile
  // damages player" branch which is gated `!this.isAllyTurret`).
  const body = decoyUpdateBody();
  assert.match(body, /proj\.isAllyTurret\s*=\s*true/,        'decoy_turret must mark its projectiles as isAllyTurret');
  assert.match(body, /proj\.ownerType\s*=\s*'Decoy Turret'/, 'decoy_turret must label projectile ownerType');
});

test('decoy_turret has a draw branch in drawHackwareEffects', () => {
  // Without a draw branch the turret is invisible (still functional).
  // We only assert the branch exists — not what's inside it — so cosmetic
  // refactors don't break this test.
  //
  // CRITICAL: count must run on CONTENT_NC. The previous version counted
  // matches against raw CONTENT, which meant three explanatory comments
  // alone (e.g. a JSDoc walkthrough of the decoy_turret lifecycle) would
  // silently satisfy this gate even after the executable branches were
  // removed.
  const drawRe = /if\s*\(\s*fx\.type\s*===\s*'decoy_turret'\s*\)/g;
  const matches = CONTENT_NC.match(drawRe) || [];
  // Should appear in: expiry handler + per-frame update + draw branch ⇒ ≥ 3.
  assert.ok(matches.length >= 3,
    `decoy_turret type guard must appear in expiry/update/draw in EXECUTABLE code (got ${matches.length})`);
});

test('decoy_turret expiry plays destroy SFX + particles', () => {
  // The maxAge expiry handler in updateHackwareEffects must produce visible
  // feedback so the player can pace recasts.
  const expiryRe = /fx\.type\s*===\s*'decoy_turret'\s*\)\s*\{\s*audio\.turretDestroy\(\)/;
  assert.match(CONTENT_NC, expiryRe,
    'decoy_turret expiry must play turretDestroy SFX in EXECUTABLE code');
});
