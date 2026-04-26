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
// Each check fails loudly the moment a refactor drops a wire — exactly the
// failure mode that bit past hackware additions.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
);

test('DECOY_TURRET is registered in the HACKWARE catalog with required fields', () => {
  const re = /DECOY_TURRET:\s*\{\s*name:\s*'[^']+',\s*desc:\s*'[^']+',\s*colour:\s*'#[0-9a-fA-F]+',\s*icon:\s*'[^']+',\s*cooldown:\s*\d+/;
  assert.match(CONTENT, re, 'DECOY_TURRET registry entry must declare name/desc/colour/icon/cooldown');
});

test('activateHackware has a DECOY_TURRET case that pushes a decoy_turret effect', () => {
  // The activate switch must own the deploy. Without the case the cooldown
  // burns but nothing spawns.
  const caseRe = /case\s+'DECOY_TURRET':[\s\S]{0,1500}?hackwareEffects\.push\(\s*\{[\s\S]{0,400}?type:\s*'decoy_turret'/;
  assert.match(CONTENT, caseRe, "activateHackware must push a {type:'decoy_turret'} effect");
});

test('DECOY_TURRET aim placement falls back to player tile if aim is in a wall', () => {
  // Projectiles spawning inside walls collide instantly; the case must guard
  // by checking the destination tile and falling back to player.x/player.y.
  const guardRe = /case\s+'DECOY_TURRET':[\s\S]{0,1500}?T\.FLOOR[\s\S]{0,200}?dx\s*=\s*player\.x;\s*dy\s*=\s*player\.y/;
  assert.match(CONTENT, guardRe, 'DECOY_TURRET must validate aim tile and fall back to player position');
});

test('DECOY_TURRET activation enforces max-1-active by splicing existing decoys', () => {
  // Mirrors STATIC_FIELD pattern. Without this, recasting stacks turrets.
  const dedupRe = /case\s+'DECOY_TURRET':[\s\S]{0,1500}?hackwareEffects\[j\]\.type\s*===\s*'decoy_turret'[\s\S]{0,100}?hackwareEffects\.splice\(j,\s*1\)/;
  assert.match(CONTENT, dedupRe, 'DECOY_TURRET must splice any existing decoy_turret on recast');
});

test('updateHackwareEffects has a decoy_turret per-frame branch', () => {
  // Without the update branch the turret never targets or fires.
  const updateRe = /if\s*\(\s*fx\.type\s*===\s*'decoy_turret'\s*\)\s*\{[\s\S]{0,3000}?projectiles\.push\(/;
  assert.match(CONTENT, updateRe, 'updateHackwareEffects must include a decoy_turret branch that pushes projectiles');
});

// Helper: locate the per-frame UPDATE branch (not the expiry branch). The
// per-frame branch decrements `fx.shootTimer`; the expiry branch only plays
// SFX. Anchor on `fx.shootTimer` (which appears only in the per-frame
// branch), then walk backwards to find the enclosing `if (fx.type === ...)`
// so we capture the whole branch body. This is robust to indentation
// changes and to the existence of the sibling expiry/draw branches.
function decoyUpdateBody() {
  const shootIdx = CONTENT.indexOf('fx.shootTimer');
  assert.ok(shootIdx > 0, 'fx.shootTimer must appear in the per-frame decoy_turret update');
  const head = CONTENT.slice(0, shootIdx);
  const guardIdx = head.lastIndexOf("if (fx.type === 'decoy_turret')");
  assert.ok(guardIdx > 0, 'per-frame branch must be enclosed by the decoy_turret type guard');
  // Slice forward generously, bounded by the next sibling type guard or EOF.
  const tail = CONTENT.slice(guardIdx + 40);
  const next = tail.search(/\n\s*if\s*\(\s*fx\.type\s*===/);
  const len = next > 0 ? (40 + next) : 5000;
  return CONTENT.slice(guardIdx, guardIdx + len);
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
  const drawRe = /if\s*\(\s*fx\.type\s*===\s*'decoy_turret'\s*\)/g;
  const matches = CONTENT.match(drawRe) || [];
  // Should appear in: expiry handler + per-frame update + draw branch ⇒ ≥ 3.
  assert.ok(matches.length >= 3,
    `decoy_turret type guard must appear in expiry/update/draw (got ${matches.length})`);
});

test('decoy_turret expiry plays destroy SFX + particles', () => {
  // The maxAge expiry handler in updateHackwareEffects must produce visible
  // feedback so the player can pace recasts.
  const expiryRe = /fx\.type\s*===\s*'decoy_turret'\s*\)\s*\{\s*audio\.turretDestroy\(\)/;
  assert.match(CONTENT, expiryRe, 'decoy_turret expiry must play turretDestroy SFX');
});
