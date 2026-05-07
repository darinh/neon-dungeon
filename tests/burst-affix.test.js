'use strict';
// BURST weapon affix — source-text wiring tests.
//
// content.js is browser-only (no UMD/CommonJS exports), so we can't load
// buildWeapon/affixEligible directly under node:test. Instead, these tests
// assert the structural invariants any working BURST prefix must satisfy:
// registry entry with the right slot/mods, melee-exclusion rule (mirrors TWIN
// since BURST also adds a projectile), and the sw.js cache bump.
//
// Each check fails loudly the moment a refactor drops a wire — exactly the
// failure mode that bit past affix additions.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content', 'weapons.js'), 'utf8'
);
const SW = fs.readFileSync(
  path.resolve(__dirname, '..', 'sw.js'), 'utf8'
);

// Strip JS comments before regex assertions so a `// BURST: { ... }` block
// comment or a `// if (affixId === 'BURST' && baseWeapon.melee) return false`
// commented-out gate can't satisfy a presence check (mark-affix /
// reverse-polarity / bulwark / hot-hand / glass-cannon / execute / recoil
// precedent).
/** @param {string} src */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const CONTENT_NC = stripComments(CONTENT);

test('BURST is registered in WEAPON_AFFIXES as a prefix with all five required fields', () => {
  // slot:'prefix' is critical — slot is what gates name placement, the prefix
  // mod-application loop, and AFFIX_PREFIXES filtering. A typo to 'suffix'
  // would silently route BURST through the on-hit-effect path instead.
  const re = /BURST:\s*\{\s*slot:\s*'prefix'\s*,\s*label:\s*'[^']+'\s*,\s*colour:\s*'#[0-9a-fA-F]+'\s*,\s*desc:\s*'[^']+'\s*,\s*mods:\s*\{/;
  assert.match(CONTENT_NC, re, "BURST must be a prefix with label/colour/desc/mods declared in EXECUTABLE code");
});

test('BURST mods set rate>1, countAdd:1, dmg<1, range<1 (close-range-shotgun trade)', () => {
  // The whole point of BURST is the trade: gain rate + extra projectile,
  // pay with damage and range. If any of these flips sign the affix becomes
  // either a free upgrade (no penalty) or unplayable (no benefit).
  const m = CONTENT_NC.match(/BURST:\s*\{[^}]*mods:\s*\{([^}]+)\}/);
  assert.ok(m, 'BURST mods block must be parseable in EXECUTABLE code');
  const mods = m[1];
  const rate = parseFloat((mods.match(/rate:\s*([0-9.]+)/) || [])[1]);
  const countAdd = parseInt((mods.match(/countAdd:\s*(\d+)/) || [])[1], 10);
  const dmg = parseFloat((mods.match(/dmg:\s*([0-9.]+)/) || [])[1]);
  const range = parseFloat((mods.match(/range:\s*([0-9.]+)/) || [])[1]);
  assert.ok(rate > 1.0,    `rate must be a buff (>1), got ${rate}`);
  assert.equal(countAdd, 1, `countAdd must be exactly 1, got ${countAdd}`);
  assert.ok(dmg < 1.0,     `dmg must be a nerf (<1), got ${dmg}`);
  assert.ok(range < 1.0,   `range must be a nerf (<1), got ${range}`);
});

test('affixEligible excludes BURST on melee weapons (mirrors TWIN — countAdd is meaningless on melee)', () => {
  // Melee weapons have no projectile count, so countAdd:1 would silently
  // no-op while the dmg/range nerfs still applied — strictly worse than no
  // affix. TWIN already carries this exclusion; BURST must too.
  const re = /if\s*\(\s*affixId\s*===\s*'BURST'\s*&&\s*baseWeapon\.melee\s*\)\s*return\s+false/;
  assert.match(CONTENT_NC, re, 'affixEligible must reject BURST when baseWeapon.melee is true in EXECUTABLE code');
});

test('sw.js does not use a numeric cache version for BURST freshness', () => {
  assert.doesNotMatch(SW, /neon-dungeon-v\d+/);
  assert.match(SW, /cacheFromNetwork\(e\)/);
});
