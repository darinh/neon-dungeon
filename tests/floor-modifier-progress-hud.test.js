'use strict';
// Floor-modifier HUD progress suffix — discoverability of counter-driven
// positive modifiers (OVERCHARGE, WINDFALL).
//
// CONTEXT: WINDFALL (#250) and OVERCHARGE (#236) both tick a per-RUN counter
// (`player._windfallKills`, `player._overchargeShots`) and trigger their
// payoff every 5th qualifying event. Without a visible progress indicator,
// players see only the trigger payoff (the +1◆ floater / the guaranteed-
// crit floater) and have no sense of when the next one is due. This is the
// same discoverability gap PR #248 closed for trauma_kit charges.
//
// This file pins:
//   1. A `modifierProgressSuffix(modKey, player)` helper exists at module
//      scope in render.js and returns ` N/5` for OVERCHARGE / WINDFALL,
//      `''` otherwise.
//   2. The helper reads the correct per-RUN counter (`_overchargeShots` for
//      OVERCHARGE, `_windfallKills` for WINDFALL) with `| 0` defensive
//      nucleation (matches the trauma_kit `_nanoMedicCharges | 0` pattern
//      at ~render.js:861).
//   3. The helper is called in BOTH HUD modifier badge sites (compact-
//      portrait `${m.icon}${m.label}` and landscape `${m.icon}${m.label}`)
//      so the progress suffix surfaces regardless of orientation.
//   4. The helper does NOT branch on CASCADE or any negative modifier (those
//      have no counter, so the badge layout for them is unchanged).
//
// The base badge contract from windfall-modifier.test.js (HUD reads
// .colour/.icon/.label generically) still holds — this PR only APPENDS a
// suffix, it does not introduce a per-modifier switch around the base badge.
//
// render.js is browser-only (UMD-loaded) — uses the same brace-walked
// source-text extraction as trauma-kit-hud-indicator.test.js. Per stored
// memory 'test source-text extraction'.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RENDER = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'render.js'), 'utf8'
);

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const RENDER_CODE = stripComments(RENDER);

/**
 * Brace-walk a `{`...`}` body starting from the FIRST match of `openerRe`.
 * `openerRe` MUST end at (or just after) the opening `{`. Returns the full
 * slice including the opener through the matching close brace, or null if
 * no balanced close is found. Mirrors helper in trauma-kit-hud-indicator
 * and deadly-affix tests (per stored memory 'test source-text extraction').
 *
 * @param {string} src
 * @param {RegExp} openerRe
 */
function extractBranch(src, openerRe) {
  const m = src.match(openerRe);
  if (!m) return null;
  const startIdx = m.index + m[0].length;
  let depth = 1;
  for (let i = startIdx; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(m.index, i + 1);
    }
  }
  return null;
}

// ─── helper definition exists at module scope ─────────────────────────────

function extractHelperBody() {
  const body = extractBranch(
    RENDER_CODE,
    /function\s+modifierProgressSuffix\s*\([^)]*\)\s*\{/
  );
  assert.ok(body, 'modifierProgressSuffix must be defined at module scope in render.js');
  return body;
}

test('modifierProgressSuffix is defined at module scope in render.js', () => {
  // Module-scope (not inside drawHUD) so both badge sites can call it
  // without duplicating the per-modifier switch.
  extractHelperBody();
  // Defensive: the function must NOT be defined inside drawHUD (would make
  // it inaccessible from the landscape-else branch which is a sibling
  // scope). Anchor: the function header must appear BEFORE the drawHUD
  // function header in source order.
  const helperIdx = RENDER_CODE.search(/function\s+modifierProgressSuffix\s*\(/);
  const drawHUDIdx = RENDER_CODE.search(/function\s+drawHUD\s*\(/);
  assert.ok(helperIdx >= 0 && drawHUDIdx >= 0, 'both helper and drawHUD must exist');
  assert.ok(helperIdx < drawHUDIdx,
    'modifierProgressSuffix must be declared before drawHUD (module scope, not nested)');
});

test('helper handles OVERCHARGE — reads _overchargeShots with |0 and returns N/5', () => {
  const body = extractHelperBody();
  // OVERCHARGE branch must read the canonical per-RUN counter from
  // src/entities.js (Player.shoot increments `_overchargeShots`). Pin
  // counter name AND the |0 nucleation AND the % 5 / `/5` suffix shape.
  assert.match(body,
    /OVERCHARGE[\s\S]*?_overchargeShots\s*\|\s*0/,
    'OVERCHARGE branch must read player._overchargeShots with |0 nucleation');
  assert.match(body,
    /OVERCHARGE[\s\S]*?%\s*5[\s\S]*?\/5/,
    'OVERCHARGE branch must format as " N/5" using cnt % 5');
});

test('helper handles WINDFALL — reads _windfallKills with |0 and returns N/5', () => {
  const body = extractHelperBody();
  // WINDFALL branch must read the canonical per-RUN counter from
  // src/entities.js (Enemy.die increments `_windfallKills`).
  assert.match(body,
    /WINDFALL[\s\S]*?_windfallKills\s*\|\s*0/,
    'WINDFALL branch must read player._windfallKills with |0 nucleation');
  assert.match(body,
    /WINDFALL[\s\S]*?%\s*5[\s\S]*?\/5/,
    'WINDFALL branch must format as " N/5" using cnt % 5');
});

test('helper handles SIGNAL_BOOST — reads _signalBoostKills with |0 and returns N/5', () => {
  const body = extractHelperBody();
  // SIGNAL_BOOST branch must read the canonical per-RUN counter from
  // src/entities.js (Enemy.die increments `_signalBoostKills`). The
  // counter ticks unconditionally (effect gating is on `player.hackware`,
  // not on the counter) so the HUD progress suffix surfaces the rhythm
  // even for builds without hackware equipped.
  assert.match(body,
    /SIGNAL_BOOST[\s\S]*?_signalBoostKills\s*\|\s*0/,
    'SIGNAL_BOOST branch must read player._signalBoostKills with |0 nucleation');
  assert.match(body,
    /SIGNAL_BOOST[\s\S]*?%\s*5[\s\S]*?\/5/,
    'SIGNAL_BOOST branch must format as " N/5" using cnt % 5');
});

test('helper guards against null/undefined modKey and player', () => {
  const body = extractHelperBody();
  // A defensive early-return prevents a stray HUD call during boot or
  // teardown from throwing on `undefined.something`. Pattern mirrors
  // currentBiomePalette's `try {} catch(_) {}` defensiveness.
  assert.match(body,
    /if\s*\(\s*!modKey\s*\|\|\s*!player\s*\)\s*return\s+''/,
    'helper must early-return on falsy modKey or player');
});

test('helper does NOT branch on CASCADE or any negative modifier', () => {
  const body = extractHelperBody();
  // CASCADE is positive but procs every kill within radius (no count to
  // show). Negative modifiers have no progress to surface. Pinning the
  // negative-set absence prevents accidental coupling — adding a real
  // CASCADE branch later requires a deliberate test bump here.
  for (const neg of [
    'CASCADE', 'BLACKOUT', 'SWARM', 'FORTIFIED', 'VOLATILE',
    'SCRAMBLED', 'OVERCLOCK', 'CORROSIVE', 'CHARGED', 'FRAGILE',
    'HUNTER', 'REGENERATIVE',
  ]) {
    assert.ok(!body.includes(neg),
      `helper must not branch on ${neg} (only OVERCHARGE and WINDFALL have a counter)`);
  }
});

// ─── helper is called in BOTH badge sites ────────────────────────────────

function extractDrawHUDBody() {
  const body = extractBranch(RENDER_CODE, /function\s+drawHUD\s*\([^)]*\)\s*\{/);
  assert.ok(body, 'drawHUD must be locatable in render.js');
  return body;
}

function extractCompactBranch() {
  const hud = extractDrawHUDBody();
  const branch = extractBranch(hud, /if\s*\(\s*layout\.compact\s*\)\s*\{/);
  assert.ok(branch, 'compact-portrait branch must be locatable inside drawHUD');
  assert.ok(/FLR:/.test(branch), 'extracted compact branch must contain the FLR readout');
  return branch;
}

function extractLandscapeBranch() {
  const hud = extractDrawHUDBody();
  const compactStart = hud.search(/if\s*\(\s*layout\.compact\s*\)\s*\{/);
  assert.ok(compactStart >= 0, 'compact branch start must be locatable');
  const compactBranch = extractCompactBranch();
  const afterCompact = compactStart + compactBranch.length;
  const tail = hud.slice(afterCompact);
  const branch = extractBranch(tail, /else\s*\{/);
  assert.ok(branch, 'landscape (else) branch must be locatable inside drawHUD');
  assert.ok(/LVL:/.test(branch), 'extracted landscape branch must contain the LVL readout');
  return branch;
}

/**
 * Extract the modifier-badge `if (_RG.modifier) { ... }` block from a HUD
 * branch. Anchored on `_RG.modifier` to avoid hopping into other if-blocks
 * (e.g. boost-strip, hackware, bombCooldown). Per stored memory
 * 'test source-text extraction' — uniqueness assertion guards against an
 * accidental duplicate decoy.
 *
 * @param {string} hudBranch
 */
function extractModifierBadgeBlock(hudBranch) {
  const m = hudBranch.match(/if\s*\(\s*_RG\.modifier\s*\)\s*\{/g) || [];
  assert.equal(m.length, 1,
    `expected exactly one modifier-badge if-block per HUD branch; found ${m.length}`);
  const block = extractBranch(hudBranch, /if\s*\(\s*_RG\.modifier\s*\)\s*\{/);
  assert.ok(block, 'modifier badge block must be locatable');
  // Defensive: the block must reference both .icon and .label (the existing
  // generic-badge contract from windfall-modifier.test.js).
  assert.ok(/m\.icon/.test(block) && /m\.label/.test(block),
    'modifier badge block must still read .icon and .label generically');
  return block;
}

test('compact-portrait modifier badge appends modifierProgressSuffix', () => {
  const compact = extractCompactBranch();
  const block = extractModifierBadgeBlock(compact);
  assert.match(block,
    /modifierProgressSuffix\s*\(\s*_RG\.modifier\s*,\s*player\s*\)/,
    'compact badge must append modifierProgressSuffix(_RG.modifier, player)');
});

test('landscape modifier badge appends modifierProgressSuffix', () => {
  const landscape = extractLandscapeBranch();
  const block = extractModifierBadgeBlock(landscape);
  assert.match(block,
    /modifierProgressSuffix\s*\(\s*_RG\.modifier\s*,\s*player\s*\)/,
    'landscape badge must append modifierProgressSuffix(_RG.modifier, player)');
});

// ─── runtime simulation: the helper produces the expected outputs ────────

test('runtime: helper sandbox produces correct N/5 for OVERCHARGE counter values', () => {
  // Extract the function source (with comments stripped) and eval it inside
  // a Function constructor for runtime verification. Same sandbox pattern
  // used in trauma-kit-autoheal.test.js for behavior-helper testing.
  const body = extractHelperBody();
  // eslint-disable-next-line no-new-func -- controlled sandbox over our own source
  const fn = new Function(`${body}; return modifierProgressSuffix;`)();

  // counter=0 (start of WINDFALL/OVERCHARGE floor or just after a trigger)
  assert.equal(fn('OVERCHARGE', { _overchargeShots: 0 }), ' 0/5');
  // counter=1 → 1 shot in
  assert.equal(fn('OVERCHARGE', { _overchargeShots: 1 }), ' 1/5');
  // counter=4 → next shot triggers
  assert.equal(fn('OVERCHARGE', { _overchargeShots: 4 }), ' 4/5');
  // counter=5 (just triggered) wraps to 0/5
  assert.equal(fn('OVERCHARGE', { _overchargeShots: 5 }), ' 0/5');
  // counter=12 → 12 % 5 = 2 (mid-cycle after two triggers)
  assert.equal(fn('OVERCHARGE', { _overchargeShots: 12 }), ' 2/5');
  // undefined counter (legacy player shape) coerces to 0 via |0
  assert.equal(fn('OVERCHARGE', {}), ' 0/5');

  // WINDFALL mirrors OVERCHARGE
  assert.equal(fn('WINDFALL', { _windfallKills: 0 }), ' 0/5');
  assert.equal(fn('WINDFALL', { _windfallKills: 4 }), ' 4/5');
  assert.equal(fn('WINDFALL', { _windfallKills: 5 }), ' 0/5');
  assert.equal(fn('WINDFALL', {}), ' 0/5');

  // SIGNAL_BOOST mirrors OVERCHARGE/WINDFALL — counter ticks unconditionally
  // so HUD progress is consistent even on hackware-less builds.
  assert.equal(fn('SIGNAL_BOOST', { _signalBoostKills: 0 }), ' 0/5');
  assert.equal(fn('SIGNAL_BOOST', { _signalBoostKills: 3 }), ' 3/5');
  assert.equal(fn('SIGNAL_BOOST', { _signalBoostKills: 5 }), ' 0/5');
  assert.equal(fn('SIGNAL_BOOST', { _signalBoostKills: 11 }), ' 1/5');
  assert.equal(fn('SIGNAL_BOOST', {}), ' 0/5');
  assert.equal(fn('SIGNAL_BOOST', { _signalBoostKills: NaN }), ' 0/5');

  // Non-counter modifiers return '' (badge unchanged)
  assert.equal(fn('CASCADE', { _overchargeShots: 4, _windfallKills: 4 }), '');
  assert.equal(fn('BLACKOUT', { _overchargeShots: 99 }), '');
  assert.equal(fn('REGENERATIVE', {}), '');

  // Defensive guards
  assert.equal(fn(null, { _overchargeShots: 4 }), '');
  assert.equal(fn(undefined, { _overchargeShots: 4 }), '');
  assert.equal(fn('OVERCHARGE', null), '');
  assert.equal(fn('OVERCHARGE', undefined), '');

  // NaN counter from corrupted localStorage coerces to 0 via |0 (per
  // stored memory 'NaN safety on health gates' — same defensive pattern,
  // different field).
  assert.equal(fn('OVERCHARGE', { _overchargeShots: NaN }), ' 0/5');
  assert.equal(fn('WINDFALL', { _windfallKills: Infinity }), ' 0/5');
});
