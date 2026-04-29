'use strict';
// PIERCING_HEART HUD progress indicator — discoverability of a per-RUN
// weapon-affix accumulator with a hard cap.
//
// CONTEXT: PIERCING_HEART is a weapon SUFFIX affix ("of Piercing Heart")
// that grants +1 Max HP per qualifying kill, capped at +20 per run
// (src/entities.js Enemy.die `_phStacks < 20` gate). Pre-PR the cap was
// completely invisible to the player — they only saw a small +heal
// floater on a qualifying kill (entities.js ~2195) and a slow drift in
// their HP bar's max. There was no way to tell whether they were at
// 5/20 stacks (lots of headroom) or 19/20 stacks (about to cap out and
// stop benefiting from kills). Same discoverability gap PR #252 / #256
// closed for OVERCHARGE / WINDFALL / SIGNAL_BOOST floor modifiers and
// PR #248 closed for trauma_kit charges.
//
// This file pins:
//   1. A `piercingHeartHudSuffix(player)` helper exists at module scope
//      in render.js (NOT inside drawHUD — both badge sites must be able
//      to call it).
//   2. The helper returns ` ♥N/20` ONLY when the active weapon carries
//      the PIERCING_HEART affix; returns '' otherwise (no PH equipped,
//      no weapon, no affixes array, etc.).
//   3. The helper reads `player._piercingHearts` with `| 0` defensive
//      nucleation (matches the trauma_kit `_nanoMedicCharges | 0`
//      pattern at ~render.js:861 and the modifierProgressSuffix counter
//      pattern). Tolerates NaN / Infinity from corrupted localStorage.
//   4. The helper clamps the displayed stack count to [0, 20] so a
//      hypothetical save with a stack overflow can't render a ridiculous
//      "♥99/20" — the real-world cap is enforced by Enemy.die but the
//      HUD MUST render an honest number.
//   5. The helper is wired into BOTH HUD weapon-name render sites
//      (compact-portrait at ~render.js:985 and landscape at
//      ~render.js:1078) so the indicator surfaces regardless of
//      orientation. Each site MUST reduce its truncation budget by the
//      suffix width so a long weapon name doesn't push the suffix off
//      the right edge.
//   6. The suffix renders in the PIERCING_HEART affix colour `#ff4488`
//      (declared in src/content.js WEAPON_AFFIXES), distinct from the
//      weapon-name rarity colour, so it reads as a separate readout.
//
// render.js is browser-only (UMD-loaded) — uses the same brace-walked
// source-text extraction as floor-modifier-progress-hud.test.js and
// trauma-kit-hud-indicator.test.js. Per stored memory
// 'test source-text extraction'.

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
    /function\s+piercingHeartHudSuffix\s*\([^)]*\)\s*\{/
  );
  assert.ok(body, 'piercingHeartHudSuffix must be defined at module scope in render.js');
  return body;
}

test('piercingHeartHudSuffix is defined at module scope in render.js', () => {
  // Module-scope (not inside drawHUD) so both weapon-name render sites
  // (compact + landscape) can call it without duplicating the affix
  // detection logic.
  extractHelperBody();
  const helperIdx = RENDER_CODE.search(/function\s+piercingHeartHudSuffix\s*\(/);
  const drawHUDIdx = RENDER_CODE.search(/function\s+drawHUD\s*\(/);
  assert.ok(helperIdx >= 0 && drawHUDIdx >= 0, 'both helper and drawHUD must exist');
  assert.ok(helperIdx < drawHUDIdx,
    'piercingHeartHudSuffix must be declared before drawHUD (module scope, not nested)');
});

test('helper reads _piercingHearts counter with |0 defensive nucleation', () => {
  const body = extractHelperBody();
  assert.match(body,
    /_piercingHearts\s*\|\s*0/,
    'helper must read player._piercingHearts with |0 nucleation (matches modifierProgressSuffix counter pattern)');
});

test('helper detects the PIERCING_HEART affix on the active weapon', () => {
  const body = extractHelperBody();
  // Affix detection MUST go through `_affixes.includes('PIERCING_HEART')`
  // — that's the canonical store on the weapon object built by
  // src/content.js buildWeapon at line ~1613. Any other detection
  // (effects array, displayName.includes('Piercing Heart')) would couple
  // to a less-stable surface or to localized strings.
  assert.match(body, /PIERCING_HEART/,
    'helper must reference the PIERCING_HEART affix key');
  assert.match(body,
    /_affixes[\s\S]*?PIERCING_HEART/,
    'helper must check the weapon._affixes array for PIERCING_HEART');
});

test('helper guards against missing player / weapon / _affixes', () => {
  const body = extractHelperBody();
  // A defensive early-return prevents a stray HUD call during boot or
  // teardown from throwing on `undefined.something`. Mirror of the
  // modifierProgressSuffix `if (!modKey || !player) return ''` guard.
  assert.match(body,
    /if\s*\(\s*!player\s*\)\s*return\s+''/,
    'helper must early-return on falsy player');
  // Weapon and _affixes guards — must not crash if weapon is missing or
  // weapon._affixes is not an array (e.g. legacy save shape with a bare
  // base-weapon object that predates the affix system).
  assert.match(body,
    /Array\.isArray\s*\(\s*[^)]*_affixes\s*\)/,
    'helper must Array.isArray-check weapon._affixes before calling .includes');
});

test('helper renders ♥N/20 format with the heart glyph', () => {
  const body = extractHelperBody();
  // The `♥` (U+2665) glyph mirrors HP semantics — the affix grants +Max HP.
  // Distinct from the modifier-suffix " N/5" format so the player can
  // tell at a glance which counter they're reading.
  assert.ok(body.includes('♥'),
    'helper must render the ♥ heart glyph in the suffix');
  assert.match(body, /\/20/,
    'helper must render the cap denominator as /20');
});

test('helper hardcoded cap (20) matches the entities.js Enemy.die gate', () => {
  // The cap is ALSO hardcoded at src/entities.js Enemy.die `_phStacks < 20`
  // — when changing the cap, BOTH sites MUST be updated. This test pins
  // the entities.js gate value so a refactor that bumps the cap to 25
  // there will fail this test until the HUD is updated to match.
  const ENT = fs.readFileSync(
    path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
  );
  // Anchor on the comment-bracketed PIERCING_HEART block to avoid
  // matching some other unrelated `< 20` literal.
  assert.match(ENT,
    /PIERCING_HEART[\s\S]*?_phStacks\s*<\s*20/,
    'entities.js Enemy.die PIERCING_HEART block must still cap at < 20 — bump HUD denominator if changing');
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

test('compact-portrait HUD calls piercingHeartHudSuffix with the player', () => {
  const compact = extractCompactBranch();
  assert.match(compact,
    /piercingHeartHudSuffix\s*\(\s*player\s*\)/,
    'compact branch must call piercingHeartHudSuffix(player) so the suffix surfaces in portrait');
});

test('landscape HUD calls piercingHeartHudSuffix with the player', () => {
  const landscape = extractLandscapeBranch();
  assert.match(landscape,
    /piercingHeartHudSuffix\s*\(\s*player\s*\)/,
    'landscape branch must call piercingHeartHudSuffix(player) so the suffix surfaces in landscape');
});

test('compact HUD reduces weapMaxW by the suffix width before truncation', () => {
  // The truncation budget MUST account for the suffix width — otherwise a
  // long weapon name with the PH suffix appended would either (a) push
  // the suffix off the right edge, or (b) overflow into the SCORE column.
  const compact = extractCompactBranch();
  // Anchor on the weapMaxW computation. Pin: a suffix-width term is
  // SUBTRACTED from the budget. We don't pin the variable name (could be
  // phSufWC, phSufW, etc.) but we DO pin the shape: weapMaxW = ... - <name>
  // where <name> derives from a measureText call on the suffix.
  const m = compact.match(/const\s+weapMaxW\s*=\s*([^;]+);/);
  assert.ok(m, 'compact branch must declare weapMaxW');
  // The expression must subtract a suffix-width term (any identifier
  // ending in a width-like name, e.g. phSufWC, phSufW, suffixW).
  assert.match(m[1], /-\s*ph[A-Za-z]*W[A-Za-z]*/,
    'compact weapMaxW must subtract a piercing-heart suffix width term so truncation honors the suffix');
});

test('landscape HUD reduces wMaxL by the suffix width before truncation', () => {
  const landscape = extractLandscapeBranch();
  const m = landscape.match(/const\s+wMaxL\s*=\s*([^;]+);/);
  assert.ok(m, 'landscape branch must declare wMaxL');
  assert.match(m[1], /-\s*ph[A-Za-z]*W[A-Za-z]*/,
    'landscape wMaxL must subtract a piercing-heart suffix width term so truncation honors the suffix');
});

test('both HUD sites render the suffix in the PIERCING_HEART affix colour #ff4488', () => {
  // The suffix MUST visually distinguish itself from the weapon-name
  // rarity colour so the player reads it as a separate readout. The
  // canonical colour is `#ff4488` declared in src/content.js
  // WEAPON_AFFIXES.PIERCING_HEART. Pin both render sites independently
  // so a later refactor can't drop one.
  //
  // NOTE: a naive `branch.includes('#ff4488')` check would FALSE-PASS
  // because trauma_kit ALSO uses `#ff4488` in both branches (render.js
  // ~line 951 / ~1100) for its own HUD readout — so the colour literal
  // is already present even if the PH suffix block stops using it.
  // Anchor the assertion on the suffix-conditional block specifically
  // (extract `if (phSuf*) { ... }` and assert #ff4488 INSIDE).
  const compact = extractCompactBranch();
  const landscape = extractLandscapeBranch();

  const compactSuffixBlock = extractBranch(compact, /if\s*\(\s*phSuf[A-Za-z]*\s*\)\s*\{/);
  assert.ok(compactSuffixBlock,
    'compact branch must wrap the PH suffix render in `if (phSuf...)`');
  // Inside the suffix block: the fillStyle MUST be set to '#ff4488'
  // BEFORE the fillText that draws the suffix, otherwise the suffix
  // would inherit the previous rarity colour and look like part of the
  // weapon name.
  assert.match(compactSuffixBlock,
    /fillStyle\s*=\s*['"]#ff4488['"][\s\S]*?fillText/,
    'compact PH suffix block must set ctx.fillStyle to #ff4488 before fillText');

  const landscapeSuffixBlock = extractBranch(landscape, /if\s*\(\s*phSuf[A-Za-z]*\s*\)\s*\{/);
  assert.ok(landscapeSuffixBlock,
    'landscape branch must wrap the PH suffix render in `if (phSuf...)`');
  assert.match(landscapeSuffixBlock,
    /fillStyle\s*=\s*['"]#ff4488['"][\s\S]*?fillText/,
    'landscape PH suffix block must set ctx.fillStyle to #ff4488 before fillText');

  // Defensive: the colour must also be present in the canonical affix
  // declaration in content.js (so this test will trip if the affix
  // colour is changed there without updating the HUD).
  const CONTENT = fs.readFileSync(
    path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
  );
  assert.match(CONTENT,
    /PIERCING_HEART[\s\S]*?colour\s*:\s*['"]#ff4488['"]/,
    'WEAPON_AFFIXES.PIERCING_HEART colour must remain #ff4488 (HUD reads this) — bump both if changing');
});

// ─── runtime simulation ──────────────────────────────────────────────────

test('runtime: helper sandbox returns "" when no PIERCING_HEART weapon is equipped', () => {
  const body = extractHelperBody();
  // eslint-disable-next-line no-new-func -- controlled sandbox over our own source
  const fn = new Function(`${body}; return piercingHeartHudSuffix;`)();

  // No weapon at all
  assert.equal(fn({ _piercingHearts: 5 }), '');
  // Weapon with no _affixes property (legacy / base-only weapon)
  assert.equal(fn({ weapon: { name: 'Pulse Pistol' }, _piercingHearts: 5 }), '');
  // Weapon with empty _affixes array
  assert.equal(fn({ weapon: { _affixes: [] }, _piercingHearts: 5 }), '');
  // Weapon with affixes but no PIERCING_HEART
  assert.equal(fn({ weapon: { _affixes: ['KEEN', 'TOXIC'] }, _piercingHearts: 5 }), '');
});

test('runtime: helper sandbox returns " ♥N/20" when PIERCING_HEART is equipped', () => {
  const body = extractHelperBody();
  // eslint-disable-next-line no-new-func -- controlled sandbox over our own source
  const fn = new Function(`${body}; return piercingHeartHudSuffix;`)();

  // PH-only weapon, various stack counts
  const phWeapon = { _affixes: ['PIERCING_HEART'] };
  assert.equal(fn({ weapon: phWeapon, _piercingHearts: 0 }), ' ♥0/20');
  assert.equal(fn({ weapon: phWeapon, _piercingHearts: 1 }), ' ♥1/20');
  assert.equal(fn({ weapon: phWeapon, _piercingHearts: 12 }), ' ♥12/20');
  assert.equal(fn({ weapon: phWeapon, _piercingHearts: 19 }), ' ♥19/20');
  assert.equal(fn({ weapon: phWeapon, _piercingHearts: 20 }), ' ♥20/20');
  // Undefined counter (legacy player shape) coerces to 0 via |0
  assert.equal(fn({ weapon: phWeapon }), ' ♥0/20');
  // Multi-affix weapon (prefix + PH suffix) — still detected
  assert.equal(fn({ weapon: { _affixes: ['KEEN', 'PIERCING_HEART'] }, _piercingHearts: 7 }),
    ' ♥7/20');
});

test('runtime: helper sandbox clamps stack count to [0, 20]', () => {
  // Real-world cap is enforced by entities.js Enemy.die `< 20` gate, so
  // the in-memory _piercingHearts SHOULD never exceed 20. But corrupted
  // localStorage or a future bug could produce out-of-range values — the
  // HUD MUST render an honest number ("♥20/20" not "♥99/20"). This test
  // pins the clamp.
  const body = extractHelperBody();
  // eslint-disable-next-line no-new-func -- controlled sandbox over our own source
  const fn = new Function(`${body}; return piercingHeartHudSuffix;`)();

  const phWeapon = { _affixes: ['PIERCING_HEART'] };
  // Over-cap: clamp to 20 (NOT render ♥99/20)
  assert.equal(fn({ weapon: phWeapon, _piercingHearts: 99 }), ' ♥20/20');
  assert.equal(fn({ weapon: phWeapon, _piercingHearts: 21 }), ' ♥20/20');
  // Negative (corrupted): clamp to 0
  assert.equal(fn({ weapon: phWeapon, _piercingHearts: -5 }), ' ♥0/20');
  // NaN coerces to 0 via |0 (per stored memory 'NaN safety on health gates'
  // — same defensive pattern, different field)
  assert.equal(fn({ weapon: phWeapon, _piercingHearts: NaN }), ' ♥0/20');
  // Infinity coerces to 0 via |0
  assert.equal(fn({ weapon: phWeapon, _piercingHearts: Infinity }), ' ♥0/20');
});

test('runtime: helper sandbox returns "" on null/undefined inputs', () => {
  const body = extractHelperBody();
  // eslint-disable-next-line no-new-func -- controlled sandbox over our own source
  const fn = new Function(`${body}; return piercingHeartHudSuffix;`)();

  // Defensive guards — boot/teardown frames may invoke renderHUD before
  // player initialization completes. Same defensiveness as
  // modifierProgressSuffix.
  assert.equal(fn(null), '');
  assert.equal(fn(undefined), '');
  // Player without weapon (e.g. very early init)
  assert.equal(fn({}), '');
  assert.equal(fn({ weapon: null }), '');
  assert.equal(fn({ weapon: undefined }), '');
  // Weapon with non-array _affixes (corrupted shape)
  assert.equal(fn({ weapon: { _affixes: 'PIERCING_HEART' }, _piercingHearts: 5 }), '');
  assert.equal(fn({ weapon: { _affixes: null }, _piercingHearts: 5 }), '');
});

// ─── invariants on the affix catalog ─────────────────────────────────────

test('PIERCING_HEART affix still exists in WEAPON_AFFIXES and is a suffix', () => {
  // If the affix is renamed or moved to a prefix slot, the helper's
  // _affixes.includes('PIERCING_HEART') check breaks silently. Pin the
  // canonical declaration in src/content.js.
  const CONTENT = fs.readFileSync(
    path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
  );
  assert.match(CONTENT,
    /PIERCING_HEART:\s*\{\s*slot:\s*['"]suffix['"]/,
    'PIERCING_HEART must remain a suffix-slot affix in WEAPON_AFFIXES');
  assert.match(CONTENT,
    /PIERCING_HEART[\s\S]*?effect:\s*['"]pierceheart['"]/,
    'PIERCING_HEART must still declare effect:"pierceheart" (Enemy.die reads this)');
});
