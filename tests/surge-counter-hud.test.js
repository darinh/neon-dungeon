'use strict';
// SURGE HUD discoverability — counter indicator for the "every 8th shot
// deals +100% damage" meta-upgrade.
//
// CONTEXT: SURGE is a meta-upgrade defined at meta/upgrades.js:36 (max
// level 1). Implementation at meta/behavior.js:51-59 (consumeSurgeShot):
//   - increments player._surgeShotCount on EVERY shot (regardless of
//     ownership)
//   - returns multiplier (1 + 1.0 * surgeLv) when count % 8 === 0 AND
//     surgeLv > 0
//   - returns 1 otherwise
//
// Pre-PR there was NO HUD signal. Players couldn't anticipate the next
// surge shot, leading to wasted surges on weak/missed shots.
//
// This PR adds a counter badge `⊙ N/8` gated on metaFlags.surge
// ownership. Same N/M convention as floor-modifier counter HUD
// (OVERCHARGE/WINDFALL/SIGNAL_BOOST/REVERB).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { extractBranch, loadAlignmentSources } = require('./_alignment-helpers.js');

const { CONTENT, CONTENT_CODE } = loadAlignmentSources(__dirname);
// surge-counter also reads src/meta/behavior.js for the SURGE counter
// computation; custom path not yet generalised — keep this load inline.
const BEHAVIOR = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'meta', 'behavior.js'), 'utf8'
);

// ─── getStatusEffects() surge fx entry ─────────────────────────────────

test('getStatusEffects() function body contains a surge fx entry', () => {
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch, 'getStatusEffects function body must be locatable');
  assert.match(fnBranch, /id:\s*'surge'/,
    'getStatusEffects must contain an fx entry with id: "surge"');
});

test('surge fx entry is gated on metaFlags-ownership', () => {
  // Only the OWNERSHIP gate (level > 0) — the counter ticks regardless,
  // so a level-zero player has _surgeShotCount > 0 but no badge. This
  // means the moment they pick up surge mid-run, the badge appears at
  // the current progress.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  assert.match(fnBranch,
    /player\.metaFlags\s*&&\s*\(\s*player\.metaFlags\.surge[^)]+\)\s*>\s*0/,
    'surge gate must short-circuit through metaFlags-ownership AND surge level > 0');
});

test('surge fx label shows N/8 progress (matches consumeSurgeShot mod-8 cycle)', () => {
  // Display formula: (player._surgeShotCount % 8) + '/8'. Pin the modulo
  // period so a future re-tune (e.g. every 5th shot) MUST update both
  // the desc string AND this test, keeping copy/runtime in sync.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  // Anchor on the surge if-block (use [^{]* to span nested parens, per
  // PR #282 fix).
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^{]*metaFlags[^{]*surge[^{]*\{/
  );
  assert.ok(ifBranch, 'surge if-block body must be locatable');
  assert.match(ifBranch,
    /\(\s*player\._surgeShotCount[^)]*\)\s*%\s*8/,
    'surge label must use _surgeShotCount % 8 (matches consumeSurgeShot at meta/behavior.js:55)');
  assert.match(ifBranch, /label:\s*cnt\s*\+\s*['"]\/8['"]/,
    'surge label must format as "N/8" (matches floor-modifier counter HUD convention)');
});

test('surge fx entry has icon ⊙ and a hex colour', () => {
  // ⊙ (circle dot — bullet/shot) signals "next shot tracker" without
  // colliding with electricity glyphs (⚡ used by OVERCHARGE/CHAINREACT/
  // shocked). Colour MUST be hex.
  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^{]*metaFlags[^{]*surge[^{]*\{/
  );
  assert.ok(ifBranch);
  assert.match(ifBranch, /icon:\s*['"]⊙['"]/,
    'surge fx icon must be ⊙ (bullet/shot tracker)');
  assert.match(ifBranch, /colour:\s*['"]#[0-9a-fA-F]{6}['"]/,
    'surge fx entry must carry a hex colour');
});

test('surge fx entry id appears EXACTLY once in content.js', () => {
  const all = CONTENT_CODE.match(/id:\s*'surge'/g) || [];
  assert.equal(all.length, 1,
    `content.js must contain exactly 1 id: 'surge' fx entry; got ${all.length}`);
});

test('surge HUD modulo (8) matches consumeSurgeShot in meta/behavior.js (cross-file desync defence)', () => {
  // Cross-file desync defence (per stored memory 'HUD status fx', PRs
  // #280/#282/#284): the modulo period is hard-coded as 8 in BOTH the
  // HUD label (content.js) AND the surge-firing gate (meta/behavior.js
  // :55). content.js / meta/behavior.js are browser-loaded with no
  // module exports so cross-file imports aren't possible. A future
  // re-tune in behavior.js would silently desync the readout — players
  // would see "5/8" while the actual cycle is mod-5. Parse behavior.js
  // and assert the content.js HUD uses the same literal.
  const behaviorMatch = BEHAVIOR.match(
    /player\._surgeShotCount\s*%\s*(\d+)\s*===?\s*0/
  );
  assert.ok(behaviorMatch,
    'consumeSurgeShot trigger gate must be locatable in meta/behavior.js');
  const behaviorMod = behaviorMatch[1]; // e.g. '8'

  const fnBranch = extractBranch(
    CONTENT_CODE,
    /function\s+getStatusEffects\s*\([^)]*\)\s*\{/
  );
  assert.ok(fnBranch);
  const ifBranch = extractBranch(
    fnBranch,
    /if\s*\([^{]*metaFlags[^{]*surge[^{]*\{/
  );
  assert.ok(ifBranch);

  const modInHud = new RegExp(
    `_surgeShotCount[^)]*\\)\\s*%\\s*${behaviorMod}`
  );
  const labelInHud = new RegExp(
    `label:\\s*cnt\\s*\\+\\s*['"]\\/${behaviorMod}['"]`
  );
  assert.match(ifBranch, modInHud,
    `HUD label must use modulo period ${behaviorMod} for the count (matches consumeSurgeShot trigger)`);
  assert.match(ifBranch, labelInHud,
    `HUD label must format as "N/${behaviorMod}" (matches consumeSurgeShot trigger)`);
});

// ─── runtime simulation: counter cycle ─────────────────────────────────

test('runtime: surge counter cycles 0→1→...→7→0 across consecutive shots', () => {
  // Behavioural complement: replicate consumeSurgeShot's increment-then-
  // mod-check cycle on a synthetic player; verify the counter cycles
  // 0..7 and the badge label tracks correctly.
  function consumeSurge(player, surgeLv) {
    player._surgeShotCount = ((player._surgeShotCount | 0) + 1) | 0;
    return (surgeLv > 0 && player._surgeShotCount % 8 === 0) ? (1 + 1.0 * surgeLv) : 1;
  }
  function badgeLabel(player) {
    return ((player._surgeShotCount | 0) % 8) + '/8';
  }

  const player = { _surgeShotCount: 0 };

  // Initial state: 0/8, no shots yet.
  assert.equal(badgeLabel(player), '0/8', 'initial counter shows 0/8');

  // Shot 1: count=1, no surge, label 1/8.
  consumeSurge(player, 1);
  assert.equal(badgeLabel(player), '1/8', 'after shot 1: 1/8');

  // Shot 7: count=7, label 7/8.
  for (let i = 0; i < 6; i++) consumeSurge(player, 1);
  assert.equal(player._surgeShotCount, 7, 'after 7 shots: count=7');
  assert.equal(badgeLabel(player), '7/8', 'after 7 shots: 7/8 (next shot fires surge)');

  // Shot 8: count=8, surge fires (mul = 2), label rolls to 0/8.
  const mul8 = consumeSurge(player, 1);
  assert.equal(mul8, 2.0, 'shot 8 fires surge with ×2.0 multiplier');
  assert.equal(badgeLabel(player), '0/8', 'after shot 8: 0/8 (just fired)');

  // Shots 9-16: cycle repeats, surge fires on shot 16.
  for (let i = 0; i < 7; i++) consumeSurge(player, 1);
  assert.equal(badgeLabel(player), '7/8', 'after shot 15: 7/8 again');
  const mul16 = consumeSurge(player, 1);
  assert.equal(mul16, 2.0, 'shot 16 fires surge again');
  assert.equal(badgeLabel(player), '0/8', 'after shot 16: 0/8');
});

test('runtime: surge fx-gate semantics — three-state truth table', () => {
  function shouldShowFx(player) {
    return !!(player.metaFlags && (player.metaFlags.surge | 0) > 0);
  }

  // State 1: surge owned (lv1) → SHOW.
  assert.equal(shouldShowFx({ metaFlags: { surge: 1 }, _surgeShotCount: 3 }),
    true, 'lv1 surge owner must show fx');

  // State 2: surge NOT owned (lv0) → HIDE (even with phantom count).
  assert.equal(shouldShowFx({ metaFlags: { surge: 0 }, _surgeShotCount: 3 }),
    false, 'lv0 (not purchased) must hide fx');

  // State 3: no metaFlags object (legacy shape) → HIDE, NO crash.
  assert.equal(shouldShowFx({ _surgeShotCount: 3 }),
    false, 'undefined metaFlags must hide fx without throwing');

  // Counter at 0 + owned → still SHOW (badge appears immediately on
  // pickup at whatever count progress).
  assert.equal(shouldShowFx({ metaFlags: { surge: 1 }, _surgeShotCount: 0 }),
    true, 'lv1 owner with zero count must show fx (immediate-on-pickup)');
});
