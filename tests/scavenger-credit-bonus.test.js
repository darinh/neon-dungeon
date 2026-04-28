'use strict';
// SCAVENGER meta upgrade — bonusCreditPerPickup wiring tests.
//
// BUG FIX: prior to this commit, `bonusCreditPerPickup` was set by the
// scavenger meta upgrade handler (src/meta/save.js:294, +1 per level
// up to L3) AND persisted in saveGame / restored in continueGame, but
// NEVER READ to actually award the bonus credits. Players paying cores
// (3+6+9 = 18 for L3) for scavenger got nothing. The upgrade description
// (src/meta/upgrades.js:39) advertises "+1 credit per pickup per level"
// — a contract the code was silently breaking. Same class of bug just
// fixed for ghostwalk (#238) and recon (#240).
//
// FIX: src/content.js CREDIT_CACHE.fn (the canonical credit pickup
// handler at line ~4145) now reads p.bonusCreditPerPickup and adds it
// AS A FLAT BONUS to the awarded amount AFTER the rounding/clamp step.
// Flat-additive (NOT multiplicative through metaMul/siphon/diffMul)
// matches the upgrade description literally — "+1 credit per pickup
// per level" means exactly N CR per pickup at level N.
//
// Sanitization: bonus is clamped to a finite non-negative integer in
// [0, 32]. Defends against corrupted/tampered localStorage delivering
// NaN / Infinity / negative / huge values via player.bonusCreditPerPickup.
//
// Scope decision: this PR wires SCAVENGER through the credit-PICKUP
// paths only (CREDIT_CACHE upgrade item + isHoard pickups MagpieHoard
// and VaultCoin). Other "credit awarded" sites (kill rewards in
// entities.js Enemy.die, destructible-object loot in entities.js for
// crates/beacons/cameras/lasers/shieldgens/wallturrets, event terminal
// rewards in content.js, room-clear bonuses, quest rewards, secret-
// room bonuses) are NOT pickups in the player-facing sense — they are
// kill / loot / event / completion rewards. The strict "pickup"
// interpretation keeps the upgrade's behaviour predictable and avoids
// compounding with other multipliers.
//
// Round-1 reviewer flagged that isHoard credit pickups were initially
// missed; corrected in the same commit (single-line wire in src/game.js
// mirrors the sanitization shape of CREDIT_CACHE.fn).
//
// content.js is browser-only — these are source-text wiring tests using
// the canonical brace-walked branch extraction pattern (per stored memory
// 'test source-text extraction'), supplemented by a node-runnable
// applyMetaToPlayer behavioural check via src/meta/save.js.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CONTENT = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'content.js'), 'utf8'
);
const SAVE = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'meta', 'save.js'), 'utf8'
);
const UPGRADES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'meta', 'upgrades.js'), 'utf8'
);
const GAME = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8'
);

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const CONTENT_CODE = stripComments(CONTENT);

/**
 * Walk braces from the regex match through balanced {} to find the matching close.
 * Naive (no string/regex literal awareness); failure mode of a future drift is
 * a loud `assert.ok(branch, ...)` rather than a silent pass.
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

test('scavenger meta upgrade is registered with the +1 credit per pickup contract', () => {
  // Description anchor: if a future re-tune shifts the magnitude or
  // pluralisation without updating save.js's handler OR the content.js
  // read site, this test catches the divergence.
  assert.match(UPGRADES, /id:\s*'scavenger'/,
    'scavenger upgrade id must be registered in upgrades.js');
  assert.match(UPGRADES, /effect:\s*'[^']*\+1[^']*credit[^']*pickup[^']*per level[^']*'/i,
    'scavenger upgrade must advertise "+1 credit per pickup per level" — the contract this fix delivers');
});

test('save.js scavenger handler still writes bonusCreditPerPickup += level', () => {
  // The handler was correct before this fix — what was missing was the
  // READ. Pin the write so that a future refactor can't silently drop
  // the field assignment (which would make the bug come back).
  assert.match(SAVE, /case\s*'scavenger'\s*:[\s\S]*?player\.bonusCreditPerPickup\s*=\s*\(\s*player\.bonusCreditPerPickup\s*\|\|\s*0\s*\)\s*\+\s*level/,
    'save.js scavenger handler must set player.bonusCreditPerPickup += level');
});

test('CREDIT_CACHE.fn reads p.bonusCreditPerPickup and adds it AS A FLAT BONUS to the credit award (the bug-fix wire)', () => {
  // THE bug fix: without this read, bonusCreditPerPickup is set/
  // persisted but the actual credit pickup never grants the bonus.
  // Brace-walked extraction anchored on the CREDIT_CACHE entry's
  // arrow function so the assertion is scoped to this single pickup
  // and doesn't false-pass on a similarly-named field elsewhere
  // in the file.
  const fnBody = extractBranch(
    CONTENT_CODE,
    /id\s*:\s*'CREDIT_CACHE'[\s\S]*?fn\s*:\s*\(\s*(?:\/\*\*[^*]*\*\/\s*)?p\s*\)\s*=>\s*\{/
  );
  assert.ok(fnBody, 'CREDIT_CACHE.fn body must be locatable');
  assert.match(fnBody,
    /let\s+bonus\s*=\s*\(\s*p\s*&&\s*p\.bonusCreditPerPickup\s*\)\s*\|\|\s*0\s*;/,
    'CREDIT_CACHE.fn must read let bonus = (p && p.bonusCreditPerPickup) || 0;');
  // Flat-additive: amt = Math.max(1, Math.round(base * mults...)) + bonus
  // The bonus is OUTSIDE the multiplier chain so it always equals the
  // upgrade level — not multiplicatively scaled by metaMul/siphon/diffMul.
  assert.match(fnBody,
    /const\s+amt\s*=\s*Math\.max\(\s*1\s*,\s*Math\.round\([^)]*base\s*\*[^)]*\)\s*\)\s*\+\s*bonus\s*;/,
    'CREDIT_CACHE.fn must compute amt = Math.max(1, Math.round(base * mults)) + bonus (flat-additive, NOT multiplicative)');
});

test('CREDIT_CACHE.fn sanitizes bonus against NaN / Infinity / negative / non-integer (corrupted save defence)', () => {
  // localStorage is user-writable; tampered/corrupted save data could
  // deliver bonusCreditPerPickup = NaN (string injection), Infinity,
  // negative, or fractional. Without sanitization the credit pickup
  // could grant ±Infinity credits or a NaN amount that breaks the HUD.
  // Pin the three guards: isFinite + non-negative, upper-bound clamp,
  // integer floor.
  const fnBody = extractBranch(
    CONTENT_CODE,
    /id\s*:\s*'CREDIT_CACHE'[\s\S]*?fn\s*:\s*\(\s*(?:\/\*\*[^*]*\*\/\s*)?p\s*\)\s*=>\s*\{/
  );
  assert.ok(fnBody, 'CREDIT_CACHE.fn body must be locatable');
  assert.match(fnBody,
    /if\s*\(\s*!Number\.isFinite\(\s*bonus\s*\)\s*\|\|\s*bonus\s*<\s*0\s*\)\s*bonus\s*=\s*0\s*;/,
    'CREDIT_CACHE.fn must reset bonus to 0 when !isFinite or < 0');
  assert.match(fnBody,
    /if\s*\(\s*bonus\s*>\s*32\s*\)\s*bonus\s*=\s*32\s*;/,
    'CREDIT_CACHE.fn must clamp bonus to <= 32 (defends against tampering)');
  assert.match(fnBody,
    /bonus\s*=\s*Math\.floor\(\s*bonus\s*\)\s*;/,
    'CREDIT_CACHE.fn must Math.floor bonus to enforce integer-only credit grants');
});

test('CREDIT_CACHE.fn bonus is added AFTER the rounding/clamp (so the bonus is never compounded by metaMul/siphon/diffMul)', () => {
  // Critical design invariant: the description says "+1 credit per
  // pickup per level" — a flat additive value matching the upgrade
  // level. If the bonus were folded INTO the multiplier chain (e.g.
  // `amt = Math.round((base + bonus) * metaMul * siphon * diffMul)`),
  // a player at L3 with CREDIT_SIPHON augment + 1.10x meta credit
  // multiplier would get +3 * 1.5 * 1.10 * 1.0 = 4.95 → 5 CR per pickup,
  // not the advertised 3. Flat-additive means EXACTLY +N at level N.
  const fnBody = extractBranch(
    CONTENT_CODE,
    /id\s*:\s*'CREDIT_CACHE'[\s\S]*?fn\s*:\s*\(\s*(?:\/\*\*[^*]*\*\/\s*)?p\s*\)\s*=>\s*\{/
  );
  assert.ok(fnBody, 'CREDIT_CACHE.fn body must be locatable');
  // The bonus must NOT appear inside the Math.round(...) call or inside
  // the base computation. Specifically: no `bonus *` or `* bonus` or
  // `+ bonus` inside the rounded expression. Pin the structural invariant:
  // the literal `+ bonus` lives OUTSIDE the Math.round() and OUTSIDE the
  // multiplier chain.
  // The bonus must NOT appear inside the Math.round(...) call. This
  // catches the prime regression: folding bonus INTO the multiplier
  // chain like `Math.round((base + bonus) * metaMul * siphon * diffMul)`
  // would compound the bonus through metaMul/siphon/diffMul.
  assert.ok(!/Math\.round\(\s*[^)]*bonus[^)]*\)/.test(fnBody),
    'CREDIT_CACHE.fn bonus must NOT be inside Math.round(...) — would compound through metaMul/siphon/diffMul');
  // Positive assertion: bonus appears exactly once after the Math.max() close.
  const matches = fnBody.match(/\+\s*bonus\b/g);
  assert.ok(matches && matches.length === 1,
    'CREDIT_CACHE.fn must use bonus exactly once via `+ bonus` outside the multiplier chain; got ' + (matches ? matches.length : 0));
  // Structural pin: the bonus add must come AFTER a Math.max(1, Math.round(...))
  // — i.e. directly after the `))` that closes the round+max chain. This
  // pins the spatial relationship without being fooled by line wrapping.
  assert.match(fnBody, /Math\.max\(\s*1\s*,\s*Math\.round\([^)]*\)\s*\)\s*\+\s*bonus/,
    'CREDIT_CACHE.fn `+ bonus` must directly follow the closing of Math.max(1, Math.round(...))');
});

test('CREDIT_CACHE.fn telemetry shows the bonus-inclusive total (player gets visible feedback)', () => {
  // The existing spawnDmgText shows the awarded amount. Pin that the
  // displayed value is the post-bonus `amt` (not the pre-bonus base
  // amount) — otherwise the player would see "+15 CR" while their
  // wallet ticks up by 18, eroding trust in the HUD.
  const fnBody = extractBranch(
    CONTENT_CODE,
    /id\s*:\s*'CREDIT_CACHE'[\s\S]*?fn\s*:\s*\(\s*(?:\/\*\*[^*]*\*\/\s*)?p\s*\)\s*=>\s*\{/
  );
  assert.ok(fnBody, 'CREDIT_CACHE.fn body must be locatable');
  assert.match(fnBody,
    /spawnDmgText\([^,]+,[^,]+,\s*'\+'\s*\+\s*amt\s*\+\s*' CR'/,
    'CREDIT_CACHE.fn floating-text feedback must use the bonus-inclusive `amt`, not a pre-bonus value');
});

test('CREDIT_CACHE.fn still applies metaMul / siphon / diffMul to the BASE amount (no regression)', () => {
  // The pre-fix multiplier chain (base * metaMul * siphon * diffMul)
  // must still wrap the base. If the fix accidentally dropped one of
  // these factors, vendors and bosses would tank their credit yield
  // alongside the pickup. Pin the multiplier chain shape.
  const fnBody = extractBranch(
    CONTENT_CODE,
    /id\s*:\s*'CREDIT_CACHE'[\s\S]*?fn\s*:\s*\(\s*(?:\/\*\*[^*]*\*\/\s*)?p\s*\)\s*=>\s*\{/
  );
  assert.ok(fnBody, 'CREDIT_CACHE.fn body must be locatable');
  assert.match(fnBody,
    /base\s*\*\s*metaMul\s*\*\s*siphon\s*\*\s*diffMul/,
    'CREDIT_CACHE.fn must preserve the (base * metaMul * siphon * diffMul) chain');
  // The Math.max(1, ...) base-amount floor must also survive (defends
  // against pathological mults that would push base * mults below 1).
  assert.match(fnBody, /Math\.max\(\s*1\s*,\s*Math\.round\(/,
    'CREDIT_CACHE.fn must preserve Math.max(1, Math.round(...)) base clamp');
});

test('saveGame still persists bonusCreditPerPickup and continueGame restores it (run-state contract preserved)', () => {
  // The persistence path was already correct pre-fix. Pin it so the
  // wire's effect survives save → reload (the bug-fix value flows
  // through reloads, not just first-run).
  assert.match(GAME, /bonusCreditPerPickup:\s*p\.bonusCreditPerPickup\s*\|\|\s*0/,
    'saveGame snapshot must include bonusCreditPerPickup: p.bonusCreditPerPickup || 0');
  assert.match(GAME, /if\s*\(\s*s\.bonusCreditPerPickup\s*!==\s*undefined\s*\)\s*p\.bonusCreditPerPickup\s*=\s*s\.bonusCreditPerPickup\s*;/,
    'continueGame must restore p.bonusCreditPerPickup from snapshot');
});

test('isHoard pickup branch (MagpieHoard / VaultCoin) also adds the scavenger flat bonus', () => {
  // SCOPE EXTENSION (post-review): MagpieHoard (thief death-drop credit
  // recovery) and VaultCoin (VAULTMASTER-ejected credit pickups) both
  // flag .isHoard = true and flow through the same pickup branch in
  // src/game.js. Both ARE credit pickups in the player-facing sense, so
  // scavenger MUST fire on them — otherwise the upgrade contract is
  // partially unmet (player picks up a hoard expecting +N from
  // scavenger, gets just the base amt, frowns).
  // Brace-walked extraction anchored on `if (it.isHoard) {` so the
  // assertion is scoped to that branch and not a similarly-named one.
  const GAME_CODE = stripComments(GAME);
  const branchBody = extractBranch(
    GAME_CODE,
    /if\s*\(\s*it\.isHoard\s*\)\s*\{/
  );
  assert.ok(branchBody, 'isHoard branch must be locatable in game.js');
  // Must read bonus from player.bonusCreditPerPickup
  assert.match(branchBody,
    /let\s+bonus\s*=\s*\(\s*player\s*&&\s*player\.bonusCreditPerPickup\s*\)\s*\|\|\s*0\s*;/,
    'isHoard branch must read bonus from player.bonusCreditPerPickup');
  // Must sanitize identically to CREDIT_CACHE.fn (consistent contract)
  assert.match(branchBody,
    /if\s*\(\s*!Number\.isFinite\(\s*bonus\s*\)\s*\|\|\s*bonus\s*<\s*0\s*\)\s*bonus\s*=\s*0\s*;/,
    'isHoard branch must sanitize !isFinite / negative bonus');
  assert.match(branchBody, /if\s*\(\s*bonus\s*>\s*32\s*\)\s*bonus\s*=\s*32\s*;/,
    'isHoard branch must clamp bonus <= 32');
  assert.match(branchBody, /bonus\s*=\s*Math\.floor\(\s*bonus\s*\)\s*;/,
    'isHoard branch must Math.floor bonus');
  // Must add bonus FLAT, AFTER Math.max(0, Math.round(it.amt || 0))
  assert.match(branchBody,
    /Math\.max\(\s*0\s*,\s*Math\.round\(\s*it\.amt\s*\|\|\s*0\s*\)\s*\)\s*\+\s*bonus/,
    'isHoard branch must compute amt = Math.max(0, Math.round(it.amt || 0)) + bonus (flat-additive)');
  // Bonus must NOT be inside the round (would compound, but no compound
  // factors here so semantically the same — but the structural pin keeps
  // future refactors honest).
  assert.ok(!/Math\.round\(\s*[^)]*bonus[^)]*\)/.test(branchBody),
    'isHoard branch bonus must NOT be inside Math.round(...)');
});

test('applyMetaToPlayer (node-runnable): scavenger L1/L3 produce bonusCreditPerPickup of 1 / 3 (additive)', () => {
  // Behavioural sanity check using the actual save.js applyMetaToPlayer
  // path (loads from storage; mirrors the upgrades.test.js idiom). This
  // is the value the new CREDIT_CACHE.fn read consumes. The handler is
  // additive per node-level (save.js:294: += level), called once per
  // node with level=N — so bonusCreditPerPickup == N for level N.
  // Per-pickup math: base 15 + floor 1 * 5 = 20 base, mult chain ≈ 1.0
  // → amt = 20 + bonus. L3 = 23 CR/pickup vs baseline 20.
  const save = require('../src/meta/save.js');

  function makeFakeStorage(initial) {
    const map = new Map(Object.entries(initial || {}));
    return {
      getItem: k => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => { map.set(k, String(v)); },
      removeItem: k => { map.delete(k); },
    };
  }

  // L3
  save._setStorageForTests(makeFakeStorage({
    neonDungeonMeta: JSON.stringify({ version: 2, upgradeNodes: { scavenger: 3 } })
  }));
  const player = { metaFlags: {} };
  save.applyMetaToPlayer(player);
  assert.equal(player.bonusCreditPerPickup, 3,
    'scavenger L3 must produce bonusCreditPerPickup = 3 (additive: +1 per level)');
  save._setStorageForTests(null);

  // L1
  save._setStorageForTests(makeFakeStorage({
    neonDungeonMeta: JSON.stringify({ version: 2, upgradeNodes: { scavenger: 1 } })
  }));
  const player2 = { metaFlags: {} };
  save.applyMetaToPlayer(player2);
  assert.equal(player2.bonusCreditPerPickup, 1,
    'scavenger L1 must produce bonusCreditPerPickup = 1');
  save._setStorageForTests(null);
});

test('CREDIT_CACHE.fn (behavioural): bonus is added as a flat per-pickup value, integer-clamped', () => {
  // Direct invocation of the wire — proves the flat-additive contract
  // end-to-end (not just via source-text matching). The fn looks up
  // _CG.floor / getMetaCreditMultiplier / hasAugment / getDiff from
  // browser globals; we stub them as global symbols so the test can run
  // in node:test without the full game runtime.

  // Save and restore globals so the test doesn't pollute the suite.
  const realGlobals = {
    _CG: globalThis._CG,
    getMetaCreditMultiplier: globalThis.getMetaCreditMultiplier,
    hasAugment: globalThis.hasAugment,
    getDiff: globalThis.getDiff,
    spawnDmgText: globalThis.spawnDmgText,
  };
  globalThis._CG = { floor: 1 };
  globalThis.getMetaCreditMultiplier = () => 1;
  globalThis.hasAugment = () => false;
  globalThis.getDiff = () => ({ creditMul: 1 });
  globalThis.spawnDmgText = () => {};

  try {
    // Reconstruct CREDIT_CACHE.fn body via the source-text and eval it
    // into a runnable arrow function. This sidesteps the requirement to
    // load all of content.js (which has many other side-effects).
    const fnBody = extractBranch(
      CONTENT,  // raw — we want the `p` parameter name etc.
      /id\s*:\s*'CREDIT_CACHE'[\s\S]*?fn\s*:\s*\(\s*(?:\/\*\*[^*]*\*\/\s*)?p\s*\)\s*=>\s*\{/
    );
    assert.ok(fnBody, 'CREDIT_CACHE.fn must be locatable for behavioural test');

    // Extract the arrow body: from the first `{` after `=>` to the last `}`.
    // The fnBody captures from `id:'CREDIT_CACHE'...fn:(p)=>{...}` so we
    // need to slice the arrow and rebuild.
    const arrowStart = fnBody.indexOf('p)=>{');
    // Find the matching `=>` then `{`
    const arrowMarker = fnBody.indexOf('=>', fnBody.indexOf('fn'));
    assert.ok(arrowMarker !== -1, 'arrow operator must be findable');
    const braceIdx = fnBody.indexOf('{', arrowMarker);
    assert.ok(braceIdx !== -1, 'arrow body { must be findable');
    // Find matching close.
    let depth = 1;
    let endIdx = -1;
    for (let i = braceIdx + 1; i < fnBody.length; i++) {
      if (fnBody[i] === '{') depth++;
      else if (fnBody[i] === '}') {
        depth--;
        if (depth === 0) { endIdx = i; break; }
      }
    }
    assert.ok(endIdx > 0, 'arrow body close } must be findable');
    const arrowBody = fnBody.slice(braceIdx + 1, endIdx);
    // Build a function we can call with p.
    // eslint-disable-next-line no-new-func -- test-only synthesis of the canonical CREDIT_CACHE.fn
    const fn = new Function('p', '_CG', 'getMetaCreditMultiplier', 'hasAugment', 'getDiff', 'spawnDmgText',
      arrowBody);

    // Baseline (no scavenger): floor 1 → base 20 → amt = 20 + 0 = 20.
    const p0 = { credits: 0, x: 0, y: 0 };
    fn(p0, globalThis._CG, globalThis.getMetaCreditMultiplier, globalThis.hasAugment, globalThis.getDiff, globalThis.spawnDmgText);
    assert.equal(p0.credits, 20, 'baseline pickup: 20 CR (floor 1, no bonus)');

    // L1 scavenger (bonusCreditPerPickup = 1): amt = 20 + 1 = 21.
    const p1 = { credits: 0, x: 0, y: 0, bonusCreditPerPickup: 1 };
    fn(p1, globalThis._CG, globalThis.getMetaCreditMultiplier, globalThis.hasAugment, globalThis.getDiff, globalThis.spawnDmgText);
    assert.equal(p1.credits, 21, 'L1 pickup: 21 CR (20 base + 1 bonus)');

    // L3 scavenger (bonusCreditPerPickup = 3): amt = 20 + 3 = 23.
    const p3 = { credits: 0, x: 0, y: 0, bonusCreditPerPickup: 3 };
    fn(p3, globalThis._CG, globalThis.getMetaCreditMultiplier, globalThis.hasAugment, globalThis.getDiff, globalThis.spawnDmgText);
    assert.equal(p3.credits, 23, 'L3 pickup: 23 CR (20 base + 3 bonus)');

    // Sanitization: NaN bonus → 0
    const pNaN = { credits: 0, x: 0, y: 0, bonusCreditPerPickup: NaN };
    fn(pNaN, globalThis._CG, globalThis.getMetaCreditMultiplier, globalThis.hasAugment, globalThis.getDiff, globalThis.spawnDmgText);
    assert.equal(pNaN.credits, 20, 'NaN bonus must sanitize to 0 → baseline 20 CR');

    // Sanitization: Infinity bonus → routed through !isFinite gate → 0
    const pInf = { credits: 0, x: 0, y: 0, bonusCreditPerPickup: Infinity };
    fn(pInf, globalThis._CG, globalThis.getMetaCreditMultiplier, globalThis.hasAugment, globalThis.getDiff, globalThis.spawnDmgText);
    assert.equal(pInf.credits, 20, 'Infinity bonus must sanitize via !isFinite → 0 → baseline 20 CR');

    // Sanitization: finite-but-huge bonus → clamped to 32 (defends against
    // tampered save data that injects a legitimate-looking large number).
    const pBig = { credits: 0, x: 0, y: 0, bonusCreditPerPickup: 999 };
    fn(pBig, globalThis._CG, globalThis.getMetaCreditMultiplier, globalThis.hasAugment, globalThis.getDiff, globalThis.spawnDmgText);
    assert.equal(pBig.credits, 52, 'Finite huge bonus (999) must clamp to 32 → 20 + 32 = 52 CR');

    // Sanitization: negative bonus → 0
    const pNeg = { credits: 0, x: 0, y: 0, bonusCreditPerPickup: -5 };
    fn(pNeg, globalThis._CG, globalThis.getMetaCreditMultiplier, globalThis.hasAugment, globalThis.getDiff, globalThis.spawnDmgText);
    assert.equal(pNeg.credits, 20, 'Negative bonus must sanitize to 0 → baseline 20 CR');

    // Sanitization: fractional bonus → floored
    const pFrac = { credits: 0, x: 0, y: 0, bonusCreditPerPickup: 2.9 };
    fn(pFrac, globalThis._CG, globalThis.getMetaCreditMultiplier, globalThis.hasAugment, globalThis.getDiff, globalThis.spawnDmgText);
    assert.equal(pFrac.credits, 22, 'Fractional 2.9 bonus must Math.floor to 2 → 20 + 2 = 22 CR');

    // Compounding-with-multipliers regression: the bonus is FLAT (does
    // NOT multiply through metaMul or siphon). With siphon=1.5 + meta=1.1
    // and L3 bonus, baseline base computation is round(20*1.1*1.5*1)=33,
    // plus flat +3 = 36 CR (NOT 33 * something with bonus).
    globalThis.getMetaCreditMultiplier = () => 1.1;
    globalThis.hasAugment = (id) => id === 'CREDIT_SIPHON';
    const pMul = { credits: 0, x: 0, y: 0, bonusCreditPerPickup: 3 };
    fn(pMul, globalThis._CG, globalThis.getMetaCreditMultiplier, globalThis.hasAugment, globalThis.getDiff, globalThis.spawnDmgText);
    // Math.round(20 * 1.1 * 1.5 * 1) = Math.round(33) = 33; +3 bonus = 36
    assert.equal(pMul.credits, 36,
      'L3 bonus + siphon + 1.1x meta mult: 36 CR (33 base + 3 flat bonus, NOT compounded)');
  } finally {
    Object.assign(globalThis, realGlobals);
  }
});
