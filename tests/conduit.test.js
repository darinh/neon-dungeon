'use strict';
// CONDUIT mob — source-text wiring + behavioural assertions.
//
// CONDUIT is a paired-beam mob (floor 8+). Solo: weak basic shots. Paired:
// damaging beam between bodies with per-link ICD. Tests cover wiring
// (ENEMY_WEIGHTS, spawnEnemy, AI dispatch, draw, stun-cancel, source-text)
// and the geometric segment hit-test which is the gameplay contract.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);
const SW = fs.readFileSync(
  path.resolve(__dirname, '..', 'sw.js'), 'utf8'
);

// ─── Wiring assertions ──────────────────────────────────────────────────

test('CONDUIT appears in ENEMY_WEIGHTS gated to floor 8+', () => {
  const m = ENTITIES.match(/CONDUIT:\s*\{\s*base:\s*\d+,\s*perFloor:\s*\d+,\s*minFloor:\s*(\d+)/);
  assert.ok(m, 'CONDUIT must be registered in ENEMY_WEIGHTS');
  assert.ok(parseInt(m[1], 10) >= 8, `CONDUIT minFloor should be >= 8, got ${m[1]}`);
});

test('CONDUIT has stat row in spawnEnemy switch', () => {
  const re = /case\s+'CONDUIT':\s*hp\s*=\s*\d+;\s*atk\s*=\s*\d+;\s*spd\s*=\s*([\d.]+);/;
  const m = ENTITIES.match(re);
  assert.ok(m, 'CONDUIT stat row missing');
  assert.equal(parseFloat(m[1]), 0, `CONDUIT base spd must be 0 (stationary), got ${m[1]}`);
});

test('CONDUIT spawn init assigns _cdEid + _cdSoloTimer + _cdLinkICD Map', () => {
  const re = /if\s*\(type\s*===\s*'CONDUIT'\)[\s\S]{0,500}_cdEid\s*=\s*\+\+_cdEidCounter[\s\S]{0,200}_cdSoloTimer\s*=[\s\S]{0,200}_cdLinkICD\s*=\s*new\s+Map\(\)/;
  assert.match(ENTITIES, re, 'CONDUIT init must assign all per-instance state');
});

test('CONDUIT is excluded from elite affix roll', () => {
  const re = /allowElite[\s\S]{0,800}type\s*!==\s*'CONDUIT'/;
  assert.match(ENTITIES, re, 'CONDUIT must be in elite-exclusion guard');
});

test('CONDUIT is dispatched in the AI switch', () => {
  assert.match(ENTITIES, /case\s+'CONDUIT':\s*this\.aiConduit\(/);
});

test('aiConduit method is defined with canonical signature', () => {
  assert.match(ENTITIES, /aiConduit\s*\(\s*dt\s*,\s*player\s*,\s*map\s*,\s*d\s*,\s*los\s*\)\s*\{/);
});

test('_cdHitsPlayer geometric helper is defined', () => {
  assert.match(ENTITIES, /_cdHitsPlayer\s*\(/);
});

test('CONDUIT stun handler clears _cdLinkICD', () => {
  // Stun must clear ICDs so the post-stun resume doesn't damage on
  // a stale-zeroed timer. Same defensive contract as the other
  // stationary stun cancels.
  const re = /this\.type\s*===\s*'CONDUIT'[\s\S]{0,200}_cdLinkICD[\s\S]{0,80}\.clear\(\)/;
  assert.match(ENTITIES, re, 'stun handler must clear CONDUIT _cdLinkICD');
});

test('CONDUIT has tuning constants for solo + beam', () => {
  // These are the gameplay-fairness budget. A change to any of them
  // shifts the difficulty contract; a missing one is a wiring bug.
  assert.match(ENTITIES, /const\s+CONDUIT_SOLO_FIRE_CD\s*=\s*[\d.]+/);
  assert.match(ENTITIES, /const\s+CONDUIT_SOLO_PROJ_SPD\s*=\s*[\d.]+/);
  assert.match(ENTITIES, /const\s+CONDUIT_SOLO_DMG_MUL\s*=\s*[\d.]+/);
  assert.match(ENTITIES, /const\s+CONDUIT_BEAM_W\s*=\s*[\d.]+/);
  assert.match(ENTITIES, /const\s+CONDUIT_BEAM_DMG_MUL\s*=\s*[\d.]+/);
  assert.match(ENTITIES, /const\s+CONDUIT_BEAM_ICD\s*=\s*[\d.]+/);
});

test('aiConduit drains _cdLinkICD by raw dt (not modSpeed)', () => {
  // ICD is a fairness contract — must not be sped up by OVERCLOCK or
  // berserker. The drain block uses raw dt explicitly.
  const fnMatch = ENTITIES.match(/\n  aiConduit\s*\(\s*dt[\s\S]{0,5000}?\n  \}/);
  assert.ok(fnMatch, 'aiConduit body must be locatable');
  const fn = fnMatch[0];
  // Drain block uses dt, NOT dt * ocMul or dt * bm.
  assert.match(fn, /_cdLinkICD\.get\(k\)\s*-\s*dt/, 'ICD drain must use raw dt');
  assert.doesNotMatch(fn, /_cdLinkICD\.get\(k\)\s*-\s*dt\s*\*/, 'ICD drain must not multiply dt');
});

test('aiConduit only the lower-eid conduit owns the link (no double-damage)', () => {
  const fnMatch = ENTITIES.match(/\n  aiConduit\s*\(\s*dt[\s\S]{0,5000}?\n  \}/);
  assert.ok(fnMatch);
  // The dedup guard `this._cdEid >= other._cdEid` skips higher-eid.
  assert.match(fnMatch[0], /this\._cdEid\s*>=\s*other\._cdEid/);
});

test('aiConduit beam damage uses Conduit Beam source label', () => {
  const fnMatch = ENTITIES.match(/\n  aiConduit\s*\(\s*dt[\s\S]{0,5000}?\n  \}/);
  assert.ok(fnMatch);
  assert.match(fnMatch[0], /takeDamage\([^)]*'Conduit Beam'/);
});

test('aiConduit gates solo fire on no-pair AND drains timer ONLY while solo', () => {
  // Solo + beam stacking would double-pressure a paired room. The
  // contract is "kill one → solo shot opens up". CRITICAL: the solo
  // timer drain MUST be gated on pairCount===0 — otherwise the survivor
  // of a long-paired room would fire instantly the frame the partner
  // dies (caught by codex+gpt-5.5+opus reviewers on initial PR).
  const fnMatch = ENTITIES.match(/\n  aiConduit\s*\(\s*dt[\s\S]{0,5000}?\n  \}/);
  assert.ok(fnMatch);
  const fn = fnMatch[0];
  // Drain must be inside an `if (pairCount === 0)` branch.
  assert.match(fn, /if\s*\(\s*pairCount\s*===\s*0\s*\)\s*\{[\s\S]{0,400}_cdSoloTimer\s*-=/);
  // Fire branch must be inside the same gate (so we never fire while paired).
  assert.match(fn, /if\s*\(\s*pairCount\s*===\s*0\s*\)\s*\{[\s\S]{0,800}fireAt\(/);
});

test('aiConduit beam skips stunned partners (fairness contract)', () => {
  // Stunned mob can't form a coherent beam — flagged by gpt-5.5 review.
  const fnMatch = ENTITIES.match(/\n  aiConduit\s*\(\s*dt[\s\S]{0,5000}?\n  \}/);
  assert.ok(fnMatch);
  // The pair scan loop must skip on `other.stunTimer && other.stunTimer > 0`.
  assert.match(fnMatch[0], /other\.stunTimer\s*&&\s*other\.stunTimer\s*>\s*0/);
});

test('aiConduit beam requires LoS between bodies (wall breaks beam)', () => {
  const fnMatch = ENTITIES.match(/\n  aiConduit\s*\(\s*dt[\s\S]{0,5000}?\n  \}/);
  assert.ok(fnMatch);
  // hasLOS(this.x, this.y, other.x, other.y, map) must be checked
  // before the hit-test in the pair loop.
  assert.match(fnMatch[0], /hasLOS\(this\.x,\s*this\.y,\s*other\.x,\s*other\.y,\s*map\)/);
});

// ─── Source text + audio stubs ──────────────────────────────────────────

test('SOURCE_LABELS contains CONDUIT and Conduit Beam', () => {
  assert.match(ENTITIES, /CONDUIT:\s*'Conduit'/);
  assert.match(ENTITIES, /'Conduit Beam':\s*'Conduit Beam'/);
});

test('SOURCE_COLOURS contains CONDUIT and Conduit Beam', () => {
  assert.match(ENTITIES, /CONDUIT:\s*'#[0-9a-f]{6}'/);
  assert.match(ENTITIES, /'Conduit Beam':\s*'#[0-9a-f]{6}'/);
});

test('CREDIT_VALUES contains CONDUIT', () => {
  assert.match(ENTITIES, /CONDUIT:\s*\d+/);
});

test('platform.js defines conduitFire and conduitBeam audio stubs', () => {
  const PLATFORM = fs.readFileSync(
    path.resolve(__dirname, '..', 'src', 'platform.js'), 'utf8'
  );
  assert.match(PLATFORM, /conduitFire\s*\(\s*\)\s*\{/);
  assert.match(PLATFORM, /conduitBeam\s*\(\s*\)\s*\{/);
});

test('sw.js cache version was bumped (>= v186)', () => {
  const m = SW.match(/const\s+CACHE\s*=\s*'neon-dungeon-v(\d+)'/);
  assert.ok(m, 'sw.js CACHE constant must be locatable');
  assert.ok(parseInt(m[1], 10) >= 186, `sw cache must be >= v186, got v${m[1]}`);
});

// ─── Geometric hit-test (vm-extracted) ──────────────────────────────────
//
// Extract _cdHitsPlayer via node:vm (entities.js is browser-only — no
// CommonJS exports). The extracted function is run against synthetic
// player+conduit positions so we test the actual implementation, not a
// duplicated copy.

const fnMatch = ENTITIES.match(/_cdHitsPlayer\s*\([^)]*\)\s*\{[\s\S]*?\n  \}/);
const FN_SRC = fnMatch ? fnMatch[0] : null;
const CONDUIT_BEAM_W = parseFloat(
  (ENTITIES.match(/const\s+CONDUIT_BEAM_W\s*=\s*([\d.]+)/) || [])[1] || '0.4'
);

test('_cdHitsPlayer source extractable via vm', () => {
  assert.ok(FN_SRC, 'must be able to extract _cdHitsPlayer body');
});

function makeCtx() {
  const sandbox = { CONDUIT_BEAM_W, console };
  vm.createContext(sandbox);
  // Wrap as a standalone function. The method has `this.x/this.y` from the
  // owning conduit. Build a wrapper that takes A,B,P explicitly.
  const wrapped = `
    function _cdHitsPlayer(player, other) ${FN_SRC.slice(FN_SRC.indexOf('{'))}
    function hits(ax, ay, bx, by, px, py) {
      const self = { x: ax, y: ay };
      return _cdHitsPlayer.call(self, { x: px, y: py }, { x: bx, y: by });
    }
    this.hits = hits;
  `;
  vm.runInContext(wrapped, sandbox);
  return sandbox;
}

test('_cdHitsPlayer: player on midpoint hits', () => {
  const s = makeCtx();
  assert.equal(s.hits(0, 0, 10, 0, 5, 0), true);
});

test('_cdHitsPlayer: player perpendicular within threshold hits', () => {
  const s = makeCtx();
  assert.equal(s.hits(0, 0, 10, 0, 5, CONDUIT_BEAM_W * 0.9), true);
});

test('_cdHitsPlayer: player perpendicular beyond threshold misses', () => {
  const s = makeCtx();
  assert.equal(s.hits(0, 0, 10, 0, 5, CONDUIT_BEAM_W * 1.5), false);
});

test('_cdHitsPlayer: player beyond segment endpoint misses (no infinite line)', () => {
  // Player projects past the B endpoint — must NOT hit (segment, not line).
  const s = makeCtx();
  assert.equal(s.hits(0, 0, 10, 0, 12, 0), false);
  assert.equal(s.hits(0, 0, 10, 0, -2, 0), false);
});

test('_cdHitsPlayer: degenerate (overlapping conduits) returns false', () => {
  // Two conduits at same coords — len2 ~ 0. Must short-circuit, not NaN.
  const s = makeCtx();
  assert.equal(s.hits(5, 5, 5, 5, 5, 5), false);
});

test('_cdHitsPlayer: diagonal segment also works', () => {
  const s = makeCtx();
  // Segment from (0,0) to (4,4); midpoint (2,2). Player at (2,2) hits.
  assert.equal(s.hits(0, 0, 4, 4, 2, 2), true);
  // Player at (3,1): perpendicular distance from (2,2) line is |3-1|/sqrt(2) ~ 1.41 > 0.4
  assert.equal(s.hits(0, 0, 4, 4, 3, 1), false);
});
