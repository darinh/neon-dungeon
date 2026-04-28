'use strict';
// trauma_kit HUD discoverability — charge-counter indicator + +heal floater.
//
// CONTEXT: trauma_kit (#244) wires a panic-button auto-heal that fires when
// the player drops below 25% maxHp. Without a visible standing charge
// counter, players don't know the safety net exists until it triggers — at
// which point the heal looks like a mystery resurrect. This file pins:
//
//   1. The HUD renders a `✚N` indicator in BOTH the compact-portrait and
//      landscape branches of `drawHUD()`, gated on `_nanoMedicCharges > 0`
//      (charges-owned). Defensive `|0` nucleation so legacy player shapes
//      that bypassed the ctor don't NaN-poison the read.
//   2. The wire is right-aligned over the HP bar (groups visually with the
//      HP it protects).
//   3. The fire path in `Player.takeDamage` adds a `+heal` floater (mirrors
//      second_wind / PIERCING_HEART) so players see WHY their HP jumped on
//      auto-heal. Floater value matches the helper's 40%-maxHp formula.
//
// render.js + entities.js are browser-only (UMD-loaded) — tests use the
// canonical brace-walked source-text extraction pattern (per stored memory
// 'test source-text extraction').

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RENDER = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'render.js'), 'utf8'
);
const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const RENDER_CODE = stripComments(RENDER);
const ENTITIES_CODE = stripComments(ENTITIES);

/**
 * Brace-walk a `{`...`}` body starting from the FIRST match of `openerRe`.
 * `openerRe` MUST end at (or just after) the opening `{`. Returns the full
 * slice including the opener through the matching close brace, or null if no
 * balanced close is found. Failure mode is a loud `assert.ok(branch, ...)`
 * rather than a silent pass. Mirrors helper in trauma-kit-autoheal.test.js.
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

// ─── extract drawHUD body (the SOLE hit) ──────────────────────────────────

function extractDrawHUDBody() {
  // drawHUD has a JSDoc + body; the function definition matches the open-
  // brace at end-of-signature line.
  const body = extractBranch(RENDER_CODE, /function\s+drawHUD\s*\([^)]*\)\s*\{/);
  assert.ok(body, 'drawHUD must be locatable in render.js');
  return body;
}

function extractCompactBranch() {
  const hud = extractDrawHUDBody();
  // Compact portrait branch is `if (layout.compact) { ... }` — the FIRST
  // top-level if inside drawHUD. Pin it explicitly so future refactors
  // can't mis-target.
  const branch = extractBranch(hud, /if\s*\(\s*layout\.compact\s*\)\s*\{/);
  assert.ok(branch, 'compact-portrait branch must be locatable inside drawHUD');
  // Defensive: the compact branch must reach the FLR draw to confirm the
  // extraction landed in the right block.
  assert.ok(/FLR:/.test(branch), 'extracted compact branch must contain the FLR readout');
  return branch;
}

function extractLandscapeBranch() {
  const hud = extractDrawHUDBody();
  // Landscape branch is the matching `else { ... }` immediately after the
  // compact branch closes. The simplest reliable extraction: walk past the
  // compact branch, then extract the next `else { ... }`.
  const compactStart = hud.search(/if\s*\(\s*layout\.compact\s*\)\s*\{/);
  assert.ok(compactStart >= 0, 'compact branch start must be locatable');
  const compactBranch = extractCompactBranch();
  const afterCompact = compactStart + compactBranch.length;
  const tail = hud.slice(afterCompact);
  // The else opener is `} else {` consumed already by extractBranch — so
  // `tail` starts with whitespace + `else {`. Anchor on `else {` only.
  const branch = extractBranch(tail, /else\s*\{/);
  assert.ok(branch, 'landscape (else) branch must be locatable inside drawHUD');
  // Defensive: the landscape branch must reach the LVL: readout.
  assert.ok(/LVL:/.test(branch), 'extracted landscape branch must contain the LVL readout');
  return branch;
}

// ─── compact HUD trauma_kit indicator ────────────────────────────────────

test('compact HUD reads _nanoMedicCharges with |0 nucleation', () => {
  // |0 nucleation tolerates undefined on legacy player shapes that bypassed
  // the ctor (defensive). Without it, undefined would propagate through the
  // text concatenation as "✚undefined".
  const compact = extractCompactBranch();
  assert.match(compact,
    /player\._nanoMedicCharges\s*\|\s*0/,
    'compact HUD must read _nanoMedicCharges with |0 nucleation');
});

test('compact HUD trauma_kit indicator is gated on charges > 0', () => {
  // The slot must be empty when the player has no charges — both for
  // players who don't own the upgrade (charges seeded to 0) AND after the
  // last charge has been spent. Without the gate the HUD would read
  // "✚0" for every player, polluting the cleanest in-game visual.
  const compact = extractCompactBranch();
  // Extract the if-block that controls the indicator. Use the variable
  // name `_nmcCompact` as the anchor — it's the only HUD-local trauma
  // counter in this branch, so the gate is uniquely identifiable.
  assert.match(compact,
    /if\s*\(\s*_nmcCompact\s*>\s*0\s*\)/,
    'compact indicator MUST be gated on _nmcCompact > 0');
});

test('compact HUD trauma_kit indicator renders ✚N text', () => {
  const compact = extractCompactBranch();
  // The visual: `✚` (heavy greek cross U+271A — medical/safety motif) +
  // the literal charge count. fillText template MUST embed the counter
  // variable, not a hardcoded number.
  assert.match(compact,
    /fillText\s*\(\s*`\s*✚\$\{_nmcCompact\}\s*`/,
    'compact indicator MUST emit `✚${_nmcCompact}` via template literal');
});

test('compact HUD trauma_kit indicator restores ctx state', () => {
  // The indicator branch sets shadowBlur + shadowColor + fillStyle + font
  // + textAlign. Without ctx.save()/restore() these would bleed into the
  // following row 2 stats (LV/ATK/DEF) — specifically textAlign='right'
  // would right-anchor every subsequent left-anchored draw. Pin the
  // save/restore symmetry inside the indicator block.
  const compact = extractCompactBranch();
  const block = extractBranch(compact, /if\s*\(\s*_nmcCompact\s*>\s*0\s*\)\s*\{/);
  assert.ok(block, 'compact indicator if-block must be brace-walkable');
  assert.match(block, /ctx\.save\s*\(\s*\)/,
    'compact indicator must wrap in ctx.save()');
  assert.match(block, /ctx\.restore\s*\(\s*\)/,
    'compact indicator must close with ctx.restore()');
  // Belt-and-braces: textAlign MUST be reverted to 'left' inside the block
  // even though save/restore would handle it — matches the existing
  // pattern in the SCORE/COMBO sibling block at the same row.
  assert.match(block, /textAlign\s*=\s*['"]right['"]/,
    'compact indicator must set textAlign right (right-aligned over HP bar)');
  assert.match(block, /textAlign\s*=\s*['"]left['"]/,
    'compact indicator must restore textAlign to left after the draw');
});

// ─── landscape HUD trauma_kit indicator ────────────────────────────────

test('landscape HUD reads _nanoMedicCharges with |0 nucleation', () => {
  const landscape = extractLandscapeBranch();
  assert.match(landscape,
    /player\._nanoMedicCharges\s*\|\s*0/,
    'landscape HUD must read _nanoMedicCharges with |0 nucleation');
});

test('landscape HUD trauma_kit indicator is gated on charges > 0', () => {
  const landscape = extractLandscapeBranch();
  assert.match(landscape,
    /if\s*\(\s*_nmcLand\s*>\s*0\s*\)/,
    'landscape indicator MUST be gated on _nmcLand > 0');
});

test('landscape HUD trauma_kit indicator renders ✚N text', () => {
  const landscape = extractLandscapeBranch();
  assert.match(landscape,
    /fillText\s*\(\s*`\s*✚\$\{_nmcLand\}\s*`/,
    'landscape indicator MUST emit `✚${_nmcLand}` via template literal');
});

test('landscape HUD trauma_kit indicator restores ctx state', () => {
  const landscape = extractLandscapeBranch();
  const block = extractBranch(landscape, /if\s*\(\s*_nmcLand\s*>\s*0\s*\)\s*\{/);
  assert.ok(block, 'landscape indicator if-block must be brace-walkable');
  assert.match(block, /ctx\.save\s*\(\s*\)/,
    'landscape indicator must wrap in ctx.save()');
  assert.match(block, /ctx\.restore\s*\(\s*\)/,
    'landscape indicator must close with ctx.restore()');
  assert.match(block, /textAlign\s*=\s*['"]right['"]/,
    'landscape indicator must set textAlign right');
  assert.match(block, /textAlign\s*=\s*['"]left['"]/,
    'landscape indicator must restore textAlign to left');
});

// ─── exactly-once invariant: prevent duplicated draws ─────────────────────

test('trauma_kit HUD indicator appears EXACTLY twice in drawHUD (compact + landscape, once each)', () => {
  // Defence against an audit-resistant duplicate (e.g. a copy-paste hidden
  // inside an if-else branch that the source-text gate accepts). The
  // marker `_nanoMedicCharges` should appear in drawHUD body exactly twice
  // — once in each layout branch's `|0` nucleation read. If a future
  // refactor accidentally introduces a third (e.g. a stale debug draw),
  // this test fires.
  const hud = extractDrawHUDBody();
  const matches = hud.match(/_nanoMedicCharges/g) || [];
  assert.equal(matches.length, 2,
    `drawHUD must reference _nanoMedicCharges EXACTLY twice (compact + landscape); found ${matches.length}`);
});

// ─── entities.js +heal floater on trauma_kit fire ─────────────────────────

test('trauma_kit fire path emits a +heal floater via spawnDmgText', () => {
  // Mirrors the floater pattern from second_wind / PIERCING_HEART — without
  // it the HP jump appears as a mystery heal. The floater MUST live INSIDE
  // the `tryTraumaKit` success branch (not a sibling) so it only fires on
  // actual consumption.
  const block = extractBranch(
    ENTITIES_CODE,
    /if\s*\(\s*this\.hp\s*>\s*0\s*&&\s*NEON\.behavior\.tryTraumaKit\(\s*this\s*\)\s*\)\s*\{/
  );
  assert.ok(block, 'tryTraumaKit success branch must be brace-walkable');
  // The spawnDmgText call signature: (x, y, text, colour). Text MUST
  // start with '+' and embed maxHp * 0.4 rounded — matching the helper.
  assert.match(block,
    /spawnDmgText\s*\(\s*this\.x\s*,\s*this\.y\s*,\s*['"`]\+['"`]\s*\+\s*Math\.round\s*\(\s*this\.maxHp\s*\*\s*0\.4\s*\)/,
    'fire path MUST emit a +heal floater with the rounded 40%-maxHp value (matches tryTraumaKit formula)');
});

test('trauma_kit fire path floater colour matches the HUD indicator', () => {
  // Visual coupling: the +heal floater colour should match the HUD
  // indicator colour so a player whose eye flicked from the HP-bar
  // indicator to the floater registers them as the same system. Indicator
  // is '#ff88aa' (pink-red, medical safety motif). Pinning the colour
  // ensures a future re-style updates BOTH together.
  const block = extractBranch(
    ENTITIES_CODE,
    /if\s*\(\s*this\.hp\s*>\s*0\s*&&\s*NEON\.behavior\.tryTraumaKit\(\s*this\s*\)\s*\)\s*\{/
  );
  assert.ok(block, 'tryTraumaKit success branch must be brace-walkable');
  assert.match(block,
    /spawnDmgText\s*\([\s\S]*?['"]#ff88aa['"]\s*\)\s*;/,
    'fire path floater colour MUST be #ff88aa (matches HUD indicator pink-red)');
});

test('trauma_kit fire path floater appears EXACTLY once', () => {
  // Defence against audit-resistant duplication. The fire path branch
  // must contain exactly ONE spawnDmgText call.
  const block = extractBranch(
    ENTITIES_CODE,
    /if\s*\(\s*this\.hp\s*>\s*0\s*&&\s*NEON\.behavior\.tryTraumaKit\(\s*this\s*\)\s*\)\s*\{/
  );
  assert.ok(block, 'tryTraumaKit success branch must be brace-walkable');
  const matches = block.match(/spawnDmgText\s*\(/g) || [];
  assert.equal(matches.length, 1,
    `tryTraumaKit fire branch must have EXACTLY one spawnDmgText call; found ${matches.length}`);
});
