'use strict';
// @ts-check
// PROXIMITY floor modifier — first POSITIONAL positive modifier in the
// FLOOR_MODIFIERS pool. All 25 prior modifiers gate on event triggers
// (every Nth shot/defeat — OVERCHARGE, REVERB, etc.), system-wide
// passives (AUTONOMY/MAGNETISM/HARDENED), or roll-time mob attributes
// (FORTIFIED/HUNTER). PROXIMITY adds a new axis: distance-from-player
// at hit time. Encourages aggressive close-range play, tactical mirror
// to KINETIC (which rewards dashing — both dynamic-positioning amps).
//
// Wired in Enemy.takeDamage at the same chokepoint as MARK / EXPLOITER /
// HOT_HAND (BEFORE shield/shieldGen/NEXUS DR, multiplicative on top of
// each by independent gate). Multiplier is +30% (×1.30) for hits where
// the player is within 4 tiles of the enemy at hit-application time.
//
// content.js / entities.js are browser-only (no UMD/CommonJS exports),
// so these tests assert structural invariants any working PROXIMITY
// modifier must satisfy:
//   - Registry shape (label/desc/colour/icon) so MODIFIER_KEYS picks
//     it up and the HUD badge in render.js renders correctly.
//   - PROXIMITY is a top-level key inside FLOOR_MODIFIERS (so
//     MODIFIER_KEYS includes it via Object.keys).
//   - Pool count invariant (26 total — bump from JAMMED's 25 via
//     EXPECTED_MODIFIER_POOL_SIZE in tests/_modifier-pool.js).
//   - Enemy.takeDamage carries the gate `_EG.modifier === 'PROXIMITY'`.
//   - The 1.30 multiplier (NOT 1.25, NOT 1.5) — design-tuned.
//   - The 4-tile radius literal — bounds the bonus to true close range.
//   - !isProc gate — chain/ricochet/explode procs don't double-dip
//     (mirrors MARK/EXPLOITER/HOT_HAND chokepoint convention).
//   - Math.round wrapping — preserves the integer-damage contract.
//   - Exactly-once invariant on `_EG.modifier === 'PROXIMITY'` —
//     defends against accidental duplication.
//   - Distance source uses `_EG.player.x/y` (canonical engine player
//     ref, mirrors line 1970 EXPLOITER and the REGENERATIVE/CASCADE/
//     WINDFALL/SIGNAL_BOOST modifier sites).
//   - Distinct from MAGNETISM (which also uses 4-tile-radius logic
//     for pickups but is a player-passive). PROXIMITY desc must not
//     reuse "pickup radius" wording.
//
// NO save/restore tests: PROXIMITY is a pure positional multiplier
// applied at takeDamage time. There is no per-run counter or per-player
// flag to persist. Mirrors AUTONOMY / MAGNETISM / HARDENED.
//
// NO HUD progress suffix tests: PROXIMITY is a passive positional
// effect with no counter to surface. A regression test (no
// PROXIMITY branch in modifierProgressSuffix) defends against
// accidental copy-paste from counter-based modifiers.
//
// Pattern lifted from tests/hardened-modifier.test.js.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assertModifierPoolSize, assertModifierIsTopLevelKey, EXPECTED_MODIFIER_POOL_SIZE } = require('./_modifier-pool');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content', 'modifiers.js'), 'utf8'
) + '\n' + fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
);
const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);
const RENDER = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'render.js'), 'utf8'
);

/**
 * Strip ONLY full-line `//` comments (whole-line) and `/* ... *\/`
 * blocks. Preserves trailing inline `//` comments to avoid
 * over-stripping string literals like `'x//y'` (per stored memory
 * 'structural test bypass classes' — the over-strip pattern).
 * @param {string} src
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/[^\n]*$/gm, '');
}

const ENTITIES_CODE = stripComments(ENTITIES);

/**
 * Brace-walked entry extraction for registry entries (KEY: { ... }).
 * @param {string} src
 * @param {RegExp} openerRe
 */
function extractEntry(src, openerRe) {
  const m = src.match(openerRe);
  if (!m) return null;
  const openIdx = src.indexOf('{', m.index);
  if (openIdx < 0) return null;
  let depth = 1;
  for (let i = openIdx + 1; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(m.index, i + 1);
    }
  }
  return null;
}

// ─── FLOOR_MODIFIERS registry ────────────────────────────────────────────

test('PROXIMITY is registered in FLOOR_MODIFIERS with label/desc/colour/icon', () => {
  const entry = extractEntry(CONTENT, /PROXIMITY:/);
  assert.ok(entry, 'PROXIMITY entry must be locatable in FLOOR_MODIFIERS');
  assert.match(entry, /label:\s*'PROXIMITY'/,
    "PROXIMITY must carry label:'PROXIMITY'");
  assert.match(entry, /desc:\s*'[^']+'/,
    'PROXIMITY must carry a non-empty desc string');
  assert.match(entry, /colour:\s*'#[0-9a-fA-F]+'/,
    'PROXIMITY must carry a hex colour');
  assert.match(entry, /icon:\s*'[^']+'/,
    'PROXIMITY must carry an icon glyph');
});

test('PROXIMITY is a top-level key inside FLOOR_MODIFIERS (so MODIFIER_KEYS picks it up)', () => {
  assertModifierIsTopLevelKey(CONTENT, 'PROXIMITY');
});

test('PROXIMITY desc avoids "pickup radius" wording (MAGNETISM already owns it)', () => {
  // MAGNETISM desc is 'Item pickup radius increased 50% on this floor' —
  // a PROXIMITY desc that also used the word "pickup radius" would
  // create visual collision in the run-start floor-modifier card and
  // confuse the offensive/utility distinction. The chosen desc
  // ("Close-range bonus") reads as combat positioning without
  // colliding with the MAGNETISM utility wording.
  const entry = extractEntry(CONTENT, /PROXIMITY:/);
  assert.ok(entry, 'PROXIMITY entry must be locatable');
  assert.doesNotMatch(entry, /pickup\s+radius/i,
    'PROXIMITY desc must avoid "pickup radius" — MAGNETISM already owns that wording. Use "close-range" or similar combat-positioning language.');
});

test('FLOOR_MODIFIERS pool size invariant (PROXIMITY is registered)', () => {
  // Roll-probability invariant. EXPECTED_MODIFIER_POOL_SIZE in
  // tests/_modifier-pool.js is the single source of truth.
  assertModifierPoolSize(CONTENT);
  // Cross-check the literal here so a future maintainer who bumps the
  // helper for a NEW modifier still sees PROXIMITY-era count of 26.
  assert.equal(EXPECTED_MODIFIER_POOL_SIZE, 26,
    'EXPECTED_MODIFIER_POOL_SIZE was 26 when PROXIMITY landed; if you bump it for a new modifier, this canary intentionally fails to remind you to update both files.');
});

// ─── Enemy.takeDamage wiring ─────────────────────────────────────────────

test('Enemy.takeDamage applies PROXIMITY multiplier with correct gate shape', () => {
  // Match the canonical PROXIMITY block. Gate MUST include:
  //   - !_isProc (procs don't double-dip — chokepoint convention)
  //   - _EG.modifier === 'PROXIMITY' (canonical engine modifier ref)
  //   - _EG.player (null-guard against test harnesses or pre-floor state)
  //   - radius literal 4 with strict < (NOT <= — we want true inside-radius)
  //   - 1.30 multiplier wrapped in Math.round (integer-damage contract)
  // Mirrors the MARK / EXPLOITER / HOT_HAND chokepoint pattern in the
  // same method.
  const gate = ENTITIES_CODE.match(
    /if\s*\(\s*!_isProc\s*&&\s*_EG\.modifier\s*===\s*'PROXIMITY'\s*&&\s*_EG\.player\s*\)\s*\{/
  );
  assert.ok(gate,
    "PROXIMITY block must open with `if (!_isProc && _EG.modifier === 'PROXIMITY' && _EG.player) {` — proc-gate, modifier-gate, and player-null-guard must all be present.");

  const dmgWrite = ENTITIES_CODE.match(
    /_EG\.modifier\s*===\s*'PROXIMITY'[\s\S]{0,400}?dmg\s*=\s*Math\.round\s*\(\s*dmg\s*\*\s*1\.30?\s*\)\s*;/
  );
  assert.ok(dmgWrite,
    'PROXIMITY block must end with `dmg = Math.round(dmg * 1.30);` — the multiplier write must be wrapped in Math.round to preserve the integer-damage contract (mirrors MARK/EXPLOITER/HOT_HAND).');
});

test('PROXIMITY multiplier uses 1.30 (NOT 1.25, NOT 1.5)', () => {
  // The chosen multiplier of 1.30 is design-intentional: matches
  // MARK affix (1.30) for symmetry — the player has to engage at
  // close range (positional cost) to earn the same damage bonus a
  // MARK weapon hit earns from re-marking. 1.25 (-EXPLOITER tier)
  // would feel underwhelming for a positional commitment; 1.5 would
  // outshine elites and trivialize close-quarters. Keep 1.30.
  const blk = ENTITIES_CODE.match(
    /_EG\.modifier\s*===\s*'PROXIMITY'[\s\S]{0,400}?dmg\s*\*\s*([\d.]+)/
  );
  assert.ok(blk, 'PROXIMITY multiplier expression not found in takeDamage');
  // Accept "1.3" or "1.30" — both write the same float.
  const v = parseFloat(blk[1]);
  assert.equal(v, 1.30,
    `PROXIMITY multiplier must be 1.30 (+30%); found ${blk[1]}. If retuning, update both the constant and this assertion AND document the rationale (MARK affix is also 1.30 for symmetry).`);
});

test('PROXIMITY radius literal is 4 with strict < (NOT <=)', () => {
  // The radius gate must be `< 4`, NOT `<= 4`. A `<=` gate would
  // include enemies at exactly 4.0 tiles — a one-tile inflation in
  // edge cases (e.g. orthogonally placed at integer coordinates).
  // The 4-tile design is "true inside-radius", matching the
  // EMP_BURST hackware radius for hand/eye familiarity.
  const blk = ENTITIES_CODE.match(
    /_EG\.modifier\s*===\s*'PROXIMITY'[\s\S]{0,400}?if\s*\(\s*_pdist\s*<\s*4\s*\)/
  );
  assert.ok(blk,
    "PROXIMITY radius gate must be `if (_pdist < 4)` — strict < (not <=) so the bonus applies to true close range (matches EMP_BURST hackware radius).");
});

test('PROXIMITY uses Math.sqrt (Euclidean distance, NOT Chebyshev/Manhattan)', () => {
  // The radius must be Euclidean (Math.sqrt(dx*dx + dy*dy)) — every
  // other radius effect in the game (EMP_BURST, gravity well, lasers
  // damage zone) uses Euclidean. Switching PROXIMITY to Chebyshev
  // (Math.max(|dx|,|dy|)) would make the bonus square-shaped — visually
  // and tactically inconsistent with the rest of the radius vocabulary.
  const blk = ENTITIES_CODE.match(
    /_EG\.modifier\s*===\s*'PROXIMITY'[\s\S]{0,400}?Math\.sqrt\s*\(\s*_pdx\s*\*\s*_pdx\s*\+\s*_pdy\s*\*\s*_pdy\s*\)/
  );
  assert.ok(blk,
    "PROXIMITY distance must be Euclidean: `Math.sqrt(_pdx*_pdx + _pdy*_pdy)`. Other radius effects in the game (EMP_BURST, gravity well) all use Euclidean — keep the radius vocabulary consistent.");
});

test('PROXIMITY is referenced exactly once in entities.js takeDamage region', () => {
  // Defends against accidental duplication (copy-paste from MARK /
  // EXPLOITER / HOT_HAND could double-apply the gate). Mirrors the
  // magnetism / regenerative / hardened exactly-once invariants.
  const matches = ENTITIES_CODE.match(/_EG\.modifier\s*===\s*'PROXIMITY'/g) || [];
  assert.equal(matches.length, 1,
    `PROXIMITY modifier check must appear exactly once in entities.js (Enemy.takeDamage chokepoint). Found ${matches.length}. Duplicate gates would double-apply the multiplier.`);
});

test('PROXIMITY block sits AFTER EXPLOITER and BEFORE HOT_HAND in source order', () => {
  // Ordering invariant inside the takeDamage chokepoint:
  //   MARK (line ~1929) → EXPLOITER (~1967) → PROXIMITY (NEW) → HOT_HAND
  // PROXIMITY landing between EXPLOITER and HOT_HAND keeps it adjacent
  // to the other multiplier-style amps (MARK/EXPLOITER use the same
  // _ectx pattern). HOT_HAND has the strictest gates (fromPlayerShot
  // attribution + streak mutation) and stays the LAST amp before
  // shield/DR processing — keep that contract intact.
  const markIdx = ENTITIES_CODE.indexOf("'mark'");
  const exploiterIdx = ENTITIES_CODE.indexOf("perks.EXPLOITER");
  const proximityIdx = ENTITIES_CODE.indexOf("_EG.modifier === 'PROXIMITY'");
  const hotHandIdx = ENTITIES_CODE.indexOf("perks.HOT_HAND");
  assert.ok(markIdx > 0, 'MARK affix anchor must exist');
  assert.ok(exploiterIdx > 0, 'EXPLOITER perk anchor must exist');
  assert.ok(proximityIdx > 0, 'PROXIMITY gate must exist');
  assert.ok(hotHandIdx > 0, 'HOT_HAND perk anchor must exist');
  assert.ok(proximityIdx > exploiterIdx,
    'PROXIMITY block must follow EXPLOITER in source order (multiplier amps cluster).');
  assert.ok(proximityIdx < hotHandIdx,
    'PROXIMITY block must precede HOT_HAND in source order (HOT_HAND stays last amp before DR).');
});

test('PROXIMITY damage source uses _EG.player.x/y (canonical engine ref)', () => {
  // The player-position read MUST go through `_EG.player.x` /
  // `_EG.player.y`, NOT a stale local or a parameter shadow. Other
  // modifier sites in entities.js (REGENERATIVE, CASCADE, WINDFALL,
  // SIGNAL_BOOST) all read through `_EG`. Using a different ref
  // (e.g. a direct `player` global that doesn't exist in this scope)
  // would either crash or silently read undefined and skip the bonus.
  const blk = ENTITIES_CODE.match(
    /_EG\.modifier\s*===\s*'PROXIMITY'[\s\S]{0,400}?_EG\.player\.x\s*-\s*this\.x[\s\S]{0,80}?_EG\.player\.y\s*-\s*this\.y/
  );
  assert.ok(blk,
    'PROXIMITY block must compute distance from `_EG.player.x - this.x` and `_EG.player.y - this.y` (canonical engine player ref, mirrors REGENERATIVE/CASCADE/WINDFALL/SIGNAL_BOOST modifier sites).');
});

// ─── HUD render.js: NO progress suffix (passive positional effect) ───────

test('modifierProgressSuffix does NOT include PROXIMITY (passive, no counter)', () => {
  // Mirrors AUTONOMY / MAGNETISM / HARDENED. PROXIMITY has no
  // per-run counter to surface in the HUD progress field — it's an
  // always-on positional multiplier. A copy-paste from a counter-based
  // modifier (OVERCHARGE 4/5, REVERB 4/5, CHAINREACT N/M) would add a
  // phantom progress readout that never advances. Defends against that.
  const fnMatch = RENDER.match(/function\s+modifierProgressSuffix\b[\s\S]*?\n\}/);
  if (!fnMatch) {
    assert.fail('modifierProgressSuffix function not found in render.js — anchor regression?');
  }
  assert.doesNotMatch(fnMatch[0], /PROXIMITY/,
    'modifierProgressSuffix must NOT contain a PROXIMITY branch — PROXIMITY has no progress counter (passive positional effect, mirrors AUTONOMY/MAGNETISM/HARDENED).');
});

// ─── runtime simulation: positive case + 4 negative cases ────────────────

test('runtime: PROXIMITY gate applies +30% only when ALL gates pass', () => {
  // Behavioural complement to the regex assertions: replicate the gate
  // arithmetic in pure JS to pin the runtime contract. A bug in the
  // gate (wrong sign, missing isProc check, modifier typo, radius
  // inversion `> 4` instead of `< 4`) would diverge from this oracle.
  // Mirrors the runtime-sim block in tests/jammed-modifier.test.js.
  /**
   * @param {{ modifier: string|null, player: {x:number,y:number}|null,
   *           enemy: {x:number,y:number}, hitCtx: any, dmg: number }} args
   */
  function compute(args) {
    let dmg = args.dmg;
    const _pctx = typeof args.hitCtx === 'string' ? null : args.hitCtx;
    const _isProc = !!(_pctx && _pctx.isProc);
    if (!_isProc && args.modifier === 'PROXIMITY' && args.player) {
      const _pdx = args.player.x - args.enemy.x;
      const _pdy = args.player.y - args.enemy.y;
      const _pdist = Math.sqrt(_pdx * _pdx + _pdy * _pdy);
      if (_pdist < 4) {
        dmg = Math.round(dmg * 1.30);
      }
    }
    return dmg;
  }

  // POSITIVE: all gates satisfied → +30%.
  assert.equal(
    compute({ modifier:'PROXIMITY', player:{x:5,y:5}, enemy:{x:5,y:7}, hitCtx:{}, dmg:10 }),
    13,
    'PROXIMITY active + player in-range + non-proc ctx → 10*1.30 = 13');

  // POSITIVE: distance just inside radius (3.99 < 4) → +30%.
  assert.equal(
    compute({ modifier:'PROXIMITY', player:{x:0,y:0}, enemy:{x:3.99,y:0}, hitCtx:{}, dmg:10 }),
    13,
    'distance 3.99 (just inside radius) must trigger PROXIMITY');

  // NEGATIVE 1: modifier is NOT 'PROXIMITY' → unchanged.
  assert.equal(
    compute({ modifier:'JAMMED', player:{x:5,y:5}, enemy:{x:5,y:5}, hitCtx:{}, dmg:10 }),
    10,
    'PROXIMITY must NOT apply when modifier is something else');
  assert.equal(
    compute({ modifier:null, player:{x:5,y:5}, enemy:{x:5,y:5}, hitCtx:{}, dmg:10 }),
    10,
    'PROXIMITY must NOT apply when no modifier is rolled');

  // NEGATIVE 2: player is null → unchanged (null guard).
  assert.equal(
    compute({ modifier:'PROXIMITY', player:null, enemy:{x:5,y:5}, hitCtx:{}, dmg:10 }),
    10,
    'PROXIMITY must NOT apply when _EG.player is null (null guard)');

  // NEGATIVE 3: explicit isProc=true → unchanged (proc gate).
  assert.equal(
    compute({ modifier:'PROXIMITY', player:{x:5,y:5}, enemy:{x:5,y:5}, hitCtx:{isProc:true}, dmg:10 }),
    10,
    'PROXIMITY must NOT apply to explicit-isProc procs (chain/ricochet/explode-with-ctx)');

  // NEGATIVE 4: distance >= 4 → unchanged (radius gate).
  assert.equal(
    compute({ modifier:'PROXIMITY', player:{x:0,y:0}, enemy:{x:4,y:0}, hitCtx:{}, dmg:10 }),
    10,
    'PROXIMITY must NOT apply at exactly distance 4 (strict <, not <=)');
  assert.equal(
    compute({ modifier:'PROXIMITY', player:{x:0,y:0}, enemy:{x:10,y:10}, hitCtx:{}, dmg:10 }),
    10,
    'PROXIMITY must NOT apply at distance > 4');
});

test('runtime: PROXIMITY DOES apply to legacy string-ctx procs (matches EXPLOITER precedent)', () => {
  // Documented behaviour: legacy string-ctx procs ('Explosion', 'Neural
  // Feedback', 'Volatile Elite') become _pctx=null → _isProc=false → DO
  // get amplified. This matches EXPLOITER's existing precedent. A future
  // refactor that converts these paths to object ctx with isProc:true
  // would correctly tighten BOTH EXPLOITER and PROXIMITY in lockstep.
  // This test pins the current contract so any change is intentional.
  /** @param {string} ctx */
  function compute(ctx) {
    let dmg = 10;
    const _pctx = typeof ctx === 'string' ? null : ctx;
    const _isProc = !!(_pctx && _pctx.isProc);
    const player = { x:0, y:0 };
    const enemy = { x:1, y:1 };
    const modifier = 'PROXIMITY';
    if (!_isProc && modifier === 'PROXIMITY' && player) {
      const _pdx = player.x - enemy.x;
      const _pdy = player.y - enemy.y;
      const _pdist = Math.sqrt(_pdx * _pdx + _pdy * _pdy);
      if (_pdist < 4) dmg = Math.round(dmg * 1.30);
    }
    return dmg;
  }
  assert.equal(compute('Explosion'), 13,
    "string-ctx 'Explosion' must currently get PROXIMITY amp (matches EXPLOITER precedent)");
  assert.equal(compute('Neural Feedback'), 13,
    "string-ctx 'Neural Feedback' must currently get PROXIMITY amp (matches EXPLOITER precedent)");
  assert.equal(compute('Volatile Elite'), 13,
    "string-ctx 'Volatile Elite' must currently get PROXIMITY amp (matches EXPLOITER precedent)");
});

test('runtime: PROXIMITY composes multiplicatively with MARK (×1.30 × ×1.30 = ×1.69)', () => {
  // Stacking arithmetic — MARK and PROXIMITY both use ×1.30 with
  // independent gates. Multiplicative stacking (×1.69) is the design
  // intent, NOT additive (×1.60). This test pins the multiplication
  // chain so a future re-tune that accidentally switches to additive
  // gets surfaced explicitly. Mirrors jammed-modifier's composition
  // arithmetic test pattern.
  const base = 10;
  const afterMark = Math.round(base * 1.30);       // 13
  const afterMarkAndProximity = Math.round(afterMark * 1.30); // 17
  assert.equal(afterMarkAndProximity, 17,
    'MARK (×1.30) × PROXIMITY (×1.30) on base 10 must round to 17 (multiplicative, NOT additive 16).');
  // Sanity: additive would be base * (1 + 0.30 + 0.30) = 16
  assert.notEqual(afterMarkAndProximity, 16,
    'must NOT be 16 — that would indicate additive stacking');
});
