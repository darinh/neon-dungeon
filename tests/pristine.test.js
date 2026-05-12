'use strict';
// PRISTINE perk — high-HP mirror of BERSERKER.
//
// At/above 90% HP, +25% damage dealt. Wired through Player.effectiveAtk()
// so it composes correctly with floor scaling, weapon affixes, and crit
// (none of which call this.atk directly for outgoing damage). HUD shows
// 'PRIME' chip while the threshold is active. Mutually exclusive with
// BERSERKER's <=25% HP gate, so the two never stack.
//
// Source-text wiring tests (entities.js / content.js are browser-only —
// no UMD/CommonJS exports — same pattern as parry.test.js / shock-pulse.test.js).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readSourceFile } = require('./_source-files.js');

const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);
const PLAYER_DAMAGE = readSourceFile(__dirname, 'entitiesPlayerDamage');
const CONTENT = readSourceFile(__dirname, 'content') + '\n' + readSourceFile(__dirname, 'contentStatus');
const CONTENT_PERKS = readSourceFile(__dirname, 'contentPerks');
const SW = fs.readFileSync(
  path.resolve(__dirname, '..', 'sw.js'), 'utf8'
);

// ─── PERK_POOL entry ──────────────────────────────────────────────────────

test('PRISTINE entry exists in PERK_POOL with required fields', () => {
  const m = CONTENT_PERKS.match(/PRISTINE\s*:\s*\{[^}]*\}/);
  assert.ok(m, 'PRISTINE must be present in PERK_POOL');
  assert.match(m[0], /name\s*:\s*'Pristine'/, 'name must be Pristine');
  assert.match(m[0], /icon\s*:/, 'icon required');
  assert.match(m[0], /desc\s*:/, 'desc required');
  assert.match(m[0], /colour\s*:/, 'colour required');
});

test('PRISTINE desc references the 90% HP threshold and +25%', () => {
  const m = CONTENT_PERKS.match(/PRISTINE\s*:\s*\{[^}]*\}/);
  assert.ok(m);
  assert.match(m[0], /90%/, 'desc must mention 90% threshold');
  assert.match(m[0], /25%/, 'desc must mention 25% damage');
});

// ─── effectiveAtk wiring ─────────────────────────────────────────────────

test('effectiveAtk multiplies by 1.25 when PRISTINE && hp/maxHp >= 0.90', () => {
  // Locate the effectiveAtk method body and assert the gate + multiplier.
  const m = PLAYER_DAMAGE.match(/effectiveAtk\s*\(\s*\)\s*\{[\s\S]*?return a;\s*\}/);
  assert.ok(m, 'effectiveAtk method must be locatable');
  assert.match(m[0], /this\.perks\.PRISTINE/,
    'effectiveAtk must check this.perks.PRISTINE');
  assert.match(m[0], /this\.hp\s*\/\s*this\.maxHp\s*>=\s*0\.90/,
    'gate must be hp/maxHp >= 0.90 (≥90%)');
  assert.match(m[0], /\*\s*1\.25/,
    'multiplier must be 1.25 (+25%)');
  assert.match(m[0], /Math\.round\(\s*a\s*\*\s*1\.25\s*\)/,
    'must round through Math.round(a*1.25) — mirrors BERSERKER pattern');
});

test('effectiveAtk PRISTINE branch sits AFTER BERSERKER branch (mirror order)', () => {
  const m = PLAYER_DAMAGE.match(/effectiveAtk\s*\(\s*\)\s*\{[\s\S]*?return a;\s*\}/);
  assert.ok(m);
  const berserkerIdx = m[0].indexOf('BERSERKER');
  const pristineIdx = m[0].indexOf('PRISTINE');
  assert.ok(berserkerIdx >= 0 && pristineIdx >= 0,
    'both BERSERKER and PRISTINE must appear in effectiveAtk');
  assert.ok(berserkerIdx < pristineIdx,
    'BERSERKER (low-HP) branch should appear before PRISTINE (high-HP) for readability');
});

// ─── HUD indicator ────────────────────────────────────────────────────────

test("HUD pushes a 'pristine' chip with 'PRIME' label when active", () => {
  // The HUD effects builder lives in content.js around the BERSERKER 'RAGE'
  // chip. Verify a sibling chip exists for PRISTINE gated on hp/maxHp >= 0.9.
  assert.match(CONTENT, /id:\s*'pristine'[^}]*label:\s*'PRIME'/,
    "HUD must push a chip with id:'pristine', label:'PRIME'");
  // Locate the chip block and assert the gate.
  const block = CONTENT.match(/player\.perks\.PRISTINE[\s\S]{0,200}id:\s*'pristine'/);
  assert.ok(block,
    'pristine chip must be gated by player.perks.PRISTINE in the HUD builder');
  assert.match(block[0], /player\.hp\s*\/\s*player\.maxHp\s*>=\s*0\.9/,
    'HUD gate must use hp/maxHp >= 0.9');
});

// ─── Service worker cache freshness ───────────────────────────────────────

test('sw.js cache freshness does not use a numeric cache key', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /cacheFromNetwork\(e\)/);
});
