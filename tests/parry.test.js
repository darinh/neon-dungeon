'use strict';
// PARRY perk — wiring tests.
//
// PARRY ('Phase Parry') is a skill-tied perk: while the player is actively
// dashing (dashTimer > 0), enemy projectiles that touch the player are
// reflected back at full damage, retargeted as fromPlayer projectiles.
//
// Mirrors the existing REFLECTOR enemy-side reflect (player→enemy) at
// src/content/projectiles.js but in the opposite direction (enemy→player). Gated
// specifically on dashTimer (NOT cloak / spawn-grace) so the perk only
// rewards active dash timing, not passive immunity windows.
//
// Source-text wiring tests (browser-only modules — same pattern as
// shock-pulse.test.js, gulper.test.js, etc).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readSourceFile } = require('./_source-files.js');

const CONTENT = readSourceFile(__dirname, 'contentPerks');
const CONTENT_PROJECTILES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content', 'projectiles.js'), 'utf8'
);
const SW = fs.readFileSync(
  path.resolve(__dirname, '..', 'sw.js'), 'utf8'
);

// ─── PERK_POOL entry ──────────────────────────────────────────────────────

test('PARRY is registered in PERK_POOL', () => {
  // Anchor on the full entry shape so a rename or accidental drop is caught.
  const pool = CONTENT.match(/const\s+PERK_POOL\s*=\s*\{[\s\S]*?\n\};/);
  assert.ok(pool, 'PERK_POOL block must be locatable in src/content/perks.js');
  assert.match(pool[0], /PARRY:\s*\{[^}]*name:\s*'Phase Parry'[^}]*\}/,
    'PARRY entry must declare name: \'Phase Parry\'');
  assert.match(pool[0], /PARRY:\s*\{[^}]*icon:\s*'⇄'/,
    'PARRY entry must declare icon ⇄');
  assert.match(pool[0], /PARRY:\s*\{[^}]*colour:\s*'#aaffee'/,
    'PARRY entry must declare colour #aaffee (matches reflect particles)');
});

// ─── Reflect block in projectile.update ───────────────────────────────────

test('parry reflect block is gated on player.perks.PARRY AND player.dashTimer > 0', () => {
  // Both clauses must be present and gated together — never one without the
  // other. Without dashTimer gate, the perk would parry passively (broken).
  // Without perks gate, every player would parry (also broken).
  assert.match(CONTENT_PROJECTILES,
    /player\.perks\.PARRY\s*&&\s*player\.dashTimer\s*>\s*0\s*&&\s*dist\(/,
    'parry block must be gated on perks.PARRY && dashTimer>0 && dist<0.5');
});

test('parry reflect flips dx/dy and marks fromPlayer = true', () => {
  // Locate the parry block (between the gate and the audio.reflect() call)
  // and assert the core kinematic flip.
  const block = CONTENT_PROJECTILES.match(
    /player\.perks\.PARRY[\s\S]*?audio\.reflect\(\);\s*return;/);
  assert.ok(block, 'parry reflect block must be locatable');
  assert.match(block[0], /this\.dx\s*=\s*-this\.dx/,
    'parry must flip dx (negate)');
  assert.match(block[0], /this\.dy\s*=\s*-this\.dy/,
    'parry must flip dy (negate)');
  assert.match(block[0], /this\.fromPlayer\s*=\s*true/,
    'parry must set fromPlayer = true (player damage rules apply now)');
});

test('parry reflect clears stale enemy-shot state to prevent cross-team leakage', () => {
  // Mirror the REFLECTOR pattern in content/projectiles.js: when ownership
  // flips, all per-team flags must reset so SIPHON/SNIPER/etc effects don't
  // misfire and so the parried shot can hit any enemy fresh.
  const block = CONTENT_PROJECTILES.match(
    /player\.perks\.PARRY[\s\S]*?audio\.reflect\(\);\s*return;/);
  assert.ok(block, 'parry reflect block must be locatable');
  assert.match(block[0], /this\._owner\s*=\s*null/,
    'must clear _owner so SIPHON heal-on-hit does not re-fire');
  assert.match(block[0], /this\.ownerType\s*=\s*'Parry'/,
    'must set ownerType = \'Parry\' (re-tags damage attribution)');
  assert.match(block[0], /this\.weaponName\s*=\s*'Parry'/,
    'must set weaponName = \'Parry\'');
  assert.match(block[0], /this\.hitEnemies\s*=\s*new\s+Set\(\)/,
    'must reset hitEnemies so the parried shot can hit any enemy fresh');
  assert.match(block[0], /this\.travelled\s*=\s*0/,
    'must reset travelled so the parried shot has full range to fly back');
  assert.match(block[0], /this\._effects\s*=\s*\/\*\*[^/]+\*\/\s*\(\[\]\)/,
    'must clear _effects (no enemy DoT/slow leaks onto player-owned shot)');
  assert.match(block[0], /this\._affixes\s*=\s*\/\*\*[^/]+\*\/\s*\(\[\]\)/,
    'must clear _affixes (no enemy weapon affixes leak)');
  assert.match(block[0], /this\.isCrit\s*=\s*false/,
    'must clear isCrit (parry is not a crit)');
  assert.match(block[0], /this\.bouncesLeft\s*=\s*0/,
    'must clear bouncesLeft (no carry-over of ricochet state)');
  assert.match(block[0], /this\.homing\s*=\s*null/,
    'must clear homing (defensive; enemy projectiles are not homing)');
  assert.match(block[0], /this\.maxPierces\s*=\s*0/,
    'must reset maxPierces so the parried shot does not unexpectedly pierce');
});

test('parry block executes BEFORE the damage block (early return)', () => {
  // Critical ordering: parry must run before the takeDamage path so the
  // damage block is short-circuited via `return`. Otherwise a parried shot
  // could double-dip (reflect AND damage).
  const idxParry = CONTENT_PROJECTILES.indexOf("player.perks.PARRY && player.dashTimer > 0");
  const idxDamage = CONTENT_PROJECTILES.indexOf(
    "!player.invincibleTimer && !isPlayerDamageImmune() && dist(this.x,this.y,player.x,player.y)<0.5");
  assert.ok(idxParry !== -1, 'parry gate must exist in src/content/projectiles.js');
  assert.ok(idxDamage !== -1, 'damage gate must still exist in src/content/projectiles.js');
  assert.ok(idxParry < idxDamage,
    'parry block must precede the damage block (early-return short-circuits damage)');
});

test('parry reflect emits visual + audio feedback', () => {
  const block = CONTENT_PROJECTILES.match(
    /player\.perks\.PARRY[\s\S]*?audio\.reflect\(\);\s*return;/);
  assert.ok(block, 'parry reflect block must be locatable');
  assert.match(block[0], /spawnParticles\(this\.x,\s*this\.y,\s*'SPARK',\s*'#aaffee',/,
    'parry must spawn cyan-mint SPARK particles for visual feedback');
  assert.match(block[0], /audio\.reflect\(\)/,
    'parry must play audio.reflect() (shared with REFLECTOR sfx)');
});

// ─── Damage parity (full damage on parry) ────────────────────────────────

test('parry preserves full damage (no nerf — skill-rewarded perk)', () => {
  // Inverse of REFLECTOR's reflect which applies dmg *= 0.6. Parry is a
  // skill-tied perk: precise dash timing is its cost, so the reflected shot
  // hits at full enemy damage. If this changes, the perk needs a re-balance
  // pass — this test exists to catch silent nerfs.
  const block = CONTENT_PROJECTILES.match(
    /player\.perks\.PARRY[\s\S]*?audio\.reflect\(\);\s*return;/);
  assert.ok(block, 'parry reflect block must be locatable');
  assert.doesNotMatch(block[0], /this\.dmg\s*=/,
    'parry must NOT reassign this.dmg (preserves enemy projectile damage)');
});

// ─── Service-worker cache freshness ───────────────────────────────────────

test('sw.js cache freshness does not use a numeric cache version', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /cacheFromNetwork\(e\)/);
});
