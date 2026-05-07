'use strict';
// SIPHON HUD progress indicator — discoverability of a per-RUN weapon-affix
// credit-drip accumulator with a 3-hit threshold.
//
// CONTEXT: SIPHON is a weapon SUFFIX affix ("of Siphoning") that drips
// +1 credit to the player every 3rd direct hit (src/entities.js
// applyHitEffects ~1180-1220, counter `_siphonHits` on player). Pre-PR
// the rhythm was barely noticeable — players saw a single small "+1 CR"
// floater spawn near themselves at unpredictable cadence with no sense
// of how close the next drip is. Same discoverability gap PR #258
// closed for PIERCING_HEART (and PR #252 / #256 for floor modifiers).
//
// This file pins:
//   1. A `siphonHudSuffix(player)` helper exists at module scope in
//      render.js (NOT inside drawHUD).
//   2. The helper returns ` ◈N/3` ONLY when the active weapon carries
//      the SIPHON affix; returns '' otherwise.
//   3. The helper reads `player._siphonHits` with `| 0` defensive
//      nucleation. Tolerates NaN / Infinity / undefined (the field is
//      NOT persisted across save/load per src/entities.js:1182-1186 —
//      after a Continue the field is undefined, MUST coerce to 0).
//   4. The helper modulos the displayed value by 3 so any future code
//      path that leaves the counter > 2 still renders an honest 0..2
//      value (the canonical reset path resets to 0 at >= 3 in
//      src/entities.js, so values are 0..2 in normal gameplay).
//   5. The helper is wired into BOTH HUD weapon-name render sites
//      (compact-portrait at ~render.js:985 and landscape at ~1078)
//      so the indicator surfaces regardless of orientation. Each site
//      MUST reduce its truncation budget by the suffix width.
//   6. The suffix renders in the SIPHON affix colour `#88ff88` (declared
//      in src/content.js WEAPON_AFFIXES.SIPHON), distinct from the
//      weapon-name rarity colour AND distinct from the PIERCING_HEART
//      suffix colour (#ff4488).
//
// Per stored memory 'test source-text extraction' — colour assertions
// MUST anchor on the specific `if (spSuf*) {...}` conditional block
// (a branch-wide includes('#88ff88') would FALSE-PASS if any other
// HUD element in the same branch happens to use the same colour).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripComments, extractBranch } = require('./_alignment-helpers.js');

const RENDER = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'render.js'), 'utf8'
);
const RENDER_CODE = stripComments(RENDER);

// ─── helper definition exists at module scope ─────────────────────────────

function extractHelperBody() {
  const body = extractBranch(
    RENDER_CODE,
    /function\s+siphonHudSuffix\s*\([^)]*\)\s*\{/
  );
  assert.ok(body, 'siphonHudSuffix must be defined at module scope in render.js');
  return body;
}

test('siphonHudSuffix is defined at module scope in render.js', () => {
  extractHelperBody();
  const helperIdx = RENDER_CODE.search(/function\s+siphonHudSuffix\s*\(/);
  const drawHUDIdx = RENDER_CODE.search(/function\s+drawHUD\s*\(/);
  assert.ok(helperIdx >= 0 && drawHUDIdx >= 0, 'both helper and drawHUD must exist');
  assert.ok(helperIdx < drawHUDIdx,
    'siphonHudSuffix must be declared before drawHUD (module scope, not nested)');
});

test('helper reads _siphonHits counter with |0 defensive nucleation', () => {
  const body = extractHelperBody();
  // _siphonHits is NOT persisted across save/load (per src/entities.js
  // comment at ~1182-1186) — after a Continue it's undefined, so the
  // |0 nucleation is REQUIRED, not just defensive.
  assert.match(body,
    /_siphonHits\s*\|\s*0/,
    'helper must read player._siphonHits with |0 nucleation (counter is not save-persisted)');
});

test('helper detects the SIPHON affix on the active weapon', () => {
  const body = extractHelperBody();
  assert.match(body, /SIPHON/,
    'helper must reference the SIPHON affix key');
  assert.match(body,
    /_affixes[\s\S]*?SIPHON/,
    'helper must check the weapon._affixes array for SIPHON');
});

test('helper guards against missing player / weapon / _affixes', () => {
  const body = extractHelperBody();
  assert.match(body,
    /if\s*\(\s*!player\s*\)\s*return\s+''/,
    'helper must early-return on falsy player');
  assert.match(body,
    /Array\.isArray\s*\(\s*[^)]*_affixes\s*\)/,
    'helper must Array.isArray-check weapon._affixes before calling .includes');
});

test('helper renders ◈N/3 format with the credit glyph', () => {
  const body = extractHelperBody();
  // The ◈ glyph is the canonical credit symbol used in the credits
  // readout (`◈${player.credits}` at ~render.js:947) and in floaters
  // (`+N◈` across entities.js). Player reads it as "credit accumulator".
  assert.ok(body.includes('◈'),
    'helper must render the ◈ credit glyph in the suffix');
  assert.match(body, /\/3/,
    'helper must render the threshold denominator as /3');
});

test('helper threshold (3) matches the entities.js applyHitEffects gate', () => {
  // The threshold is ALSO hardcoded at src/entities.js applyHitEffects
  // `_splr._siphonHits >= 3`. When changing the threshold, BOTH sites
  // MUST be updated. This test pins the entities.js gate value so a
  // refactor that changes the threshold there will fail this test
  // until the HUD denominator is updated to match.
  const ENT = fs.readFileSync(
    path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
  );
  // Anchor on the SIPHON `siphon` effect block to avoid matching some
  // other unrelated `>= 3` literal.
  assert.match(ENT,
    /siphon[\s\S]*?_siphonHits\s*>=\s*3/,
    'entities.js applyHitEffects siphon block must still trigger at >= 3 — bump HUD denominator if changing');
});

test('helper does NOT branch on PIERCING_HEART or other affixes', () => {
  // SIPHON helper handles ONLY SIPHON. PIERCING_HEART has its own
  // helper (piercingHeartHudSuffix). Pin the negative-set absence to
  // prevent accidental coupling — adding a real cross-affix branch
  // later requires a deliberate test bump here.
  const body = extractHelperBody();
  for (const other of [
    'PIERCING_HEART', 'KEEN', 'TOXIC', 'STAGGER', 'GREEDY',
    'SALVAGE', 'LUCKY', 'VOLATILE', 'DEADLY', 'DEADEYE',
  ]) {
    assert.ok(!body.includes(other),
      `siphonHudSuffix must not reference ${other} (each affix has its own helper)`);
  }
});

// ─── helper is called in BOTH weapon-name render sites ───────────────────

function extractDrawHUDBody() {
  const body = extractBranch(RENDER_CODE, /function\s+drawHUD\s*\([^)]*\)\s*\{/);
  assert.ok(body, 'drawHUD must be locatable in render.js');
  return body;
}

function extractCompactBranch() {
  const hud = extractDrawHUDBody();
  const branch = extractBranch(hud, /if\s*\(\s*layout\.compact\s*\)\s*\{/);
  assert.ok(branch, 'compact-portrait branch must be locatable inside drawHUD');
  assert.ok(/TEST:/.test(branch), 'extracted compact branch must contain the TEST readout');
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

test('compact-portrait HUD calls siphonHudSuffix with the player', () => {
  const compact = extractCompactBranch();
  assert.match(compact,
    /siphonHudSuffix\s*\(\s*player\s*\)/,
    'compact branch must call siphonHudSuffix(player) so the suffix surfaces in portrait');
});

test('landscape HUD calls siphonHudSuffix with the player', () => {
  const landscape = extractLandscapeBranch();
  assert.match(landscape,
    /siphonHudSuffix\s*\(\s*player\s*\)/,
    'landscape branch must call siphonHudSuffix(player) so the suffix surfaces in landscape');
});

test('compact HUD reduces weapMaxW by the SIPHON suffix width before truncation', () => {
  // The truncation budget MUST account for the suffix width — otherwise
  // a long weapon name with the SIPHON suffix appended would push the
  // suffix off the right edge or overflow into SCORE.
  const compact = extractCompactBranch();
  const m = compact.match(/const\s+weapMaxW\s*=\s*([^;]+);/);
  assert.ok(m, 'compact branch must declare weapMaxW');
  // Anchor on a SIPHON-prefixed width identifier (sp* prefix per the
  // _spFrenzy / _spDrainBeam naming convention used for SIPHON across
  // entities.js, OR siphon* prefix). Allow either.
  assert.match(m[1], /-\s*(?:sp|siphon)[A-Za-z]*W[A-Za-z]*/,
    'compact weapMaxW must subtract a SIPHON suffix width term so truncation honors the suffix');
});

test('landscape HUD reduces wMaxL by the SIPHON suffix width before truncation', () => {
  const landscape = extractLandscapeBranch();
  const m = landscape.match(/const\s+wMaxL\s*=\s*([^;]+);/);
  assert.ok(m, 'landscape branch must declare wMaxL');
  assert.match(m[1], /-\s*(?:sp|siphon)[A-Za-z]*W[A-Za-z]*/,
    'landscape wMaxL must subtract a SIPHON suffix width term so truncation honors the suffix');
});

test('both HUD sites render the SIPHON suffix in the affix colour #88ff88', () => {
  // Per stored memory 'test source-text extraction' — branch-wide
  // includes('#88ff88') would FALSE-PASS if any unrelated HUD element
  // shares the colour. Anchor on the `if (spSuf*)` block specifically
  // and assert fillStyle=#88ff88 INSIDE.
  const compact = extractCompactBranch();
  const landscape = extractLandscapeBranch();

  const compactSuffixBlock = extractBranch(compact, /if\s*\(\s*spSuf[A-Za-z]*\s*\)\s*\{/);
  assert.ok(compactSuffixBlock,
    'compact branch must wrap the SIPHON suffix render in `if (spSuf...)`');
  assert.match(compactSuffixBlock,
    /fillStyle\s*=\s*['"]#88ff88['"][\s\S]*?fillText/,
    'compact SIPHON suffix block must set ctx.fillStyle to #88ff88 before fillText');

  const landscapeSuffixBlock = extractBranch(landscape, /if\s*\(\s*spSuf[A-Za-z]*\s*\)\s*\{/);
  assert.ok(landscapeSuffixBlock,
    'landscape branch must wrap the SIPHON suffix render in `if (spSuf...)`');
  assert.match(landscapeSuffixBlock,
    /fillStyle\s*=\s*['"]#88ff88['"][\s\S]*?fillText/,
    'landscape SIPHON suffix block must set ctx.fillStyle to #88ff88 before fillText');

  // Defensive: the colour must also be present in the canonical affix
  // declaration in content.js (so this test will trip if the affix
  // colour is changed there without updating the HUD).
  const CONTENT = fs.readFileSync(
    path.resolve(__dirname, '..', 'src', 'content', 'weapons.js'), 'utf8'
  );
  assert.match(CONTENT,
    /SIPHON:\s*\{[^}]*colour\s*:\s*['"]#88ff88['"]/,
    'WEAPON_AFFIXES.SIPHON colour must remain #88ff88 (HUD reads this) — bump both if changing');
});

test('SIPHON colour (#88ff88) is distinct from PIERCING_HEART colour (#ff4488)', () => {
  // The two suffix indicators must be visually distinguishable. Pin
  // both colours in content.js so a careless refactor can't homogenize
  // them.
  const CONTENT = fs.readFileSync(
    path.resolve(__dirname, '..', 'src', 'content', 'weapons.js'), 'utf8'
  );
  assert.match(CONTENT,
    /SIPHON[\s\S]*?colour\s*:\s*['"]#88ff88['"]/,
    'SIPHON affix colour must remain #88ff88');
  assert.match(CONTENT,
    /PIERCING_HEART[\s\S]*?colour\s*:\s*['"]#ff4488['"]/,
    'PIERCING_HEART affix colour must remain #ff4488');
  assert.notEqual('#88ff88', '#ff4488',
    'sanity: the two affix colours are distinct hex values');
});

// ─── runtime simulation ──────────────────────────────────────────────────

test('runtime: helper sandbox returns "" when no SIPHON weapon is equipped', () => {
  const body = extractHelperBody();
  // eslint-disable-next-line no-new-func -- controlled sandbox over our own source
  const fn = new Function(`${body}; return siphonHudSuffix;`)();

  // No weapon at all
  assert.equal(fn({ _siphonHits: 2 }), '');
  // Weapon with no _affixes property
  assert.equal(fn({ weapon: { name: 'Pulse Pistol' }, _siphonHits: 2 }), '');
  // Weapon with empty _affixes
  assert.equal(fn({ weapon: { _affixes: [] }, _siphonHits: 2 }), '');
  // Weapon with affixes but no SIPHON
  assert.equal(fn({ weapon: { _affixes: ['KEEN', 'PIERCING_HEART'] }, _siphonHits: 2 }), '');
});

test('runtime: helper sandbox returns " ◈N/3" when SIPHON is equipped', () => {
  const body = extractHelperBody();
  // eslint-disable-next-line no-new-func -- controlled sandbox over our own source
  const fn = new Function(`${body}; return siphonHudSuffix;`)();

  const spWeapon = { _affixes: ['SIPHON'] };
  // Counter values 0..2 are the canonical in-game range (entities.js
  // resets to 0 at >= 3). Display matches counter.
  assert.equal(fn({ weapon: spWeapon, _siphonHits: 0 }), ' ◈0/3');
  assert.equal(fn({ weapon: spWeapon, _siphonHits: 1 }), ' ◈1/3');
  assert.equal(fn({ weapon: spWeapon, _siphonHits: 2 }), ' ◈2/3');
  // Undefined (post-Continue or fresh weapon equip) coerces to 0 via |0.
  // This is the COMMON case after a save/restore — _siphonHits is NOT
  // persisted, so any restored player has undefined here.
  assert.equal(fn({ weapon: spWeapon }), ' ◈0/3');
  // Multi-affix weapon (prefix + SIPHON suffix) — still detected.
  assert.equal(fn({ weapon: { _affixes: ['KEEN', 'SIPHON'] }, _siphonHits: 1 }),
    ' ◈1/3');
});

test('runtime: helper sandbox modulos counter by 3 for out-of-range values', () => {
  // The canonical reset path resets _siphonHits to 0 at >= 3, so values
  // > 2 should never appear in normal gameplay. But if a future code
  // path leaves the counter > 2 (e.g. a refactor changes the reset
  // semantics), the HUD MUST render an honest 0..2 value via % 3.
  const body = extractHelperBody();
  // eslint-disable-next-line no-new-func -- controlled sandbox over our own source
  const fn = new Function(`${body}; return siphonHudSuffix;`)();

  const spWeapon = { _affixes: ['SIPHON'] };
  // % 3 wraps: 3 -> 0, 4 -> 1, 5 -> 2, 6 -> 0, etc.
  assert.equal(fn({ weapon: spWeapon, _siphonHits: 3 }), ' ◈0/3');
  assert.equal(fn({ weapon: spWeapon, _siphonHits: 4 }), ' ◈1/3');
  assert.equal(fn({ weapon: spWeapon, _siphonHits: 5 }), ' ◈2/3');
  assert.equal(fn({ weapon: spWeapon, _siphonHits: 99 }), ' ◈0/3');
  // Negative (corrupted): clamp to 0 (not negative-mod which gives
  // platform-dependent results).
  assert.equal(fn({ weapon: spWeapon, _siphonHits: -1 }), ' ◈0/3');
  assert.equal(fn({ weapon: spWeapon, _siphonHits: -7 }), ' ◈0/3');
  // NaN / Infinity coerce to 0 via |0
  assert.equal(fn({ weapon: spWeapon, _siphonHits: NaN }), ' ◈0/3');
  assert.equal(fn({ weapon: spWeapon, _siphonHits: Infinity }), ' ◈0/3');
});

test('runtime: helper sandbox returns "" on null/undefined inputs', () => {
  const body = extractHelperBody();
  // eslint-disable-next-line no-new-func -- controlled sandbox over our own source
  const fn = new Function(`${body}; return siphonHudSuffix;`)();

  assert.equal(fn(null), '');
  assert.equal(fn(undefined), '');
  assert.equal(fn({}), '');
  assert.equal(fn({ weapon: null }), '');
  assert.equal(fn({ weapon: undefined }), '');
  assert.equal(fn({ weapon: { _affixes: 'SIPHON' }, _siphonHits: 1 }), '');
  assert.equal(fn({ weapon: { _affixes: null }, _siphonHits: 1 }), '');
});

// ─── invariants on the affix catalog ─────────────────────────────────────

test('SIPHON affix still exists in WEAPON_AFFIXES and is a suffix', () => {
  const CONTENT = fs.readFileSync(
    path.resolve(__dirname, '..', 'src', 'content', 'weapons.js'), 'utf8'
  );
  assert.match(CONTENT,
    /SIPHON:\s*\{\s*slot:\s*['"]suffix['"]/,
    'SIPHON must remain a suffix-slot affix in WEAPON_AFFIXES');
  assert.match(CONTENT,
    /SIPHON[\s\S]*?effect:\s*['"]siphon['"]/,
    'SIPHON must still declare effect:"siphon" (applyHitEffects reads this)');
});

test('SIPHON and PIERCING_HEART are mutually exclusive on a single weapon (both suffix-slot)', () => {
  // The HUD render code stacks the SIPHON suffix block immediately
  // after the PIERCING_HEART suffix block at the SAME x-position
  // (after the weapon name). This works ONLY because at most ONE of
  // the two can be on the active weapon — both are suffix-slot in
  // WEAPON_AFFIXES, and src/content.js buildWeapon picks at most one
  // suffix per weapon. Pin this invariant — if a future refactor
  // moves PH to prefix-slot, the HUD wiring must be revisited.
  const CONTENT = fs.readFileSync(
    path.resolve(__dirname, '..', 'src', 'content', 'weapons.js'), 'utf8'
  );
  assert.match(CONTENT,
    /PIERCING_HEART:\s*\{\s*slot:\s*['"]suffix['"]/,
    'PIERCING_HEART must remain suffix-slot (SIPHON HUD wiring assumes mutex)');
  assert.match(CONTENT,
    /SIPHON:\s*\{\s*slot:\s*['"]suffix['"]/,
    'SIPHON must remain suffix-slot (HUD wiring assumes mutex)');
  // The buildWeapon implementation must still find ONE suffix (not all):
  // pin the .find call rather than .filter to ensure single-suffix.
  assert.match(CONTENT,
    /affixIds\.find\(\([\s\S]*?\)\s*=>\s*WEAPON_AFFIXES\[id\]\?\.slot\s*===\s*['"]suffix['"]\)/,
    'buildWeapon must use .find() to select a single suffix (HUD assumes mutex on suffix slot)');
});

test('HUD render uses cumulative x-offset for stacked affix suffixes (defense in depth)', () => {
  // Mutex-on-construction (asserted above) is the PRIMARY guarantee that
  // PH and SIPHON suffixes never coexist on a single weapon — but the
  // render code MUST defensively offset each suffix's x-position so that
  // a future weapon shape that bypasses buildWeapon (corrupted save,
  // direct buildWeapon([..., 'PIERCING_HEART', 'SIPHON']) call, future
  // dual-suffix mechanic) still renders without overlap.
  //
  // Pattern: each suffix render block must increment a running x-offset
  // by the suffix width AFTER drawing, so the next suffix renders
  // beside (not on top of) the previous one. Anchor on the
  // `_sufX_C += ... measureText(phSufC|spSufC)` increment in compact
  // and `_sufX_L += ... measureText(phSufL|spSufL)` in landscape.
  const compact = extractCompactBranch();
  const landscape = extractLandscapeBranch();

  // Compact: cumulative x-offset declared, advanced after each suffix.
  assert.match(compact,
    /_sufX_C\s*=\s*statsX\s*\+\s*74\s*\+\s*[\s\S]*?measureText\s*\(\s*weapName\s*\)\s*\.width/,
    'compact branch must initialize a cumulative x-offset (_sufX_C) at the end of the weapon name');
  assert.match(compact,
    /_sufX_C\s*\+=\s*[\s\S]*?measureText\s*\(\s*phSufC\s*\)\s*\.width/,
    'compact branch must advance _sufX_C by phSufC width AFTER rendering PH suffix');
  assert.match(compact,
    /_sufX_C\s*\+=\s*[\s\S]*?measureText\s*\(\s*spSufC\s*\)\s*\.width/,
    'compact branch must advance _sufX_C by spSufC width AFTER rendering SIPHON suffix');
  // Both suffix renders must use the cumulative offset, NOT a
  // weapon-name-only x-position.
  const compactPhFillText = compact.match(/fillText\s*\(\s*phSufC\s*,\s*([^,]+)\s*,/);
  assert.ok(compactPhFillText, 'compact PH suffix render must call fillText');
  assert.match(compactPhFillText[1], /_sufX_C/,
    'compact PH suffix fillText x-arg must use _sufX_C cumulative offset');
  const compactSpFillText = compact.match(/fillText\s*\(\s*spSufC\s*,\s*([^,]+)\s*,/);
  assert.ok(compactSpFillText, 'compact SIPHON suffix render must call fillText');
  assert.match(compactSpFillText[1], /_sufX_C/,
    'compact SIPHON suffix fillText x-arg must use _sufX_C cumulative offset (NOT statsX + 74 + wNameW)');

  // Landscape: same pattern with _sufX_L.
  assert.match(landscape,
    /_sufX_L\s*=\s*colBase\s*\+\s*220\s*\+\s*[\s\S]*?measureText\s*\(\s*wNameL\s*\)\s*\.width/,
    'landscape branch must initialize a cumulative x-offset (_sufX_L) at the end of the weapon name');
  assert.match(landscape,
    /_sufX_L\s*\+=\s*[\s\S]*?measureText\s*\(\s*phSufL\s*\)\s*\.width/,
    'landscape branch must advance _sufX_L by phSufL width AFTER rendering PH suffix');
  assert.match(landscape,
    /_sufX_L\s*\+=\s*[\s\S]*?measureText\s*\(\s*spSufL\s*\)\s*\.width/,
    'landscape branch must advance _sufX_L by spSufL width AFTER rendering SIPHON suffix');
  const landscapePhFillText = landscape.match(/fillText\s*\(\s*phSufL\s*,\s*([^,]+)\s*,/);
  assert.ok(landscapePhFillText, 'landscape PH suffix render must call fillText');
  assert.match(landscapePhFillText[1], /_sufX_L/,
    'landscape PH suffix fillText x-arg must use _sufX_L cumulative offset');
  const landscapeSpFillText = landscape.match(/fillText\s*\(\s*spSufL\s*,\s*([^,]+)\s*,/);
  assert.ok(landscapeSpFillText, 'landscape SIPHON suffix render must call fillText');
  assert.match(landscapeSpFillText[1], /_sufX_L/,
    'landscape SIPHON suffix fillText x-arg must use _sufX_L cumulative offset (NOT colBase + 220 + wNameWL)');
});
