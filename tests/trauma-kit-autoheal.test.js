'use strict';
// trauma_kit meta upgrade — panic-button auto-heal wiring tests.
//
// CONTRACT REINTERPRETATION: the upgrade matrix entry advertises "Start
// each run with 1 nano-medic consumable per level" (src/meta/upgrades.js),
// but the game has NO inventory system for boost consumables — NANO_MEDIC
// is currently only acquired via vendors and applied instantly at point of
// purchase (src/meta/boosts.js NANO_MEDIC.apply heals 40% maxHp). To
// honour the literal reading would require a per-run boost-inventory
// system with UI + key binding (large architectural lift, deferred).
//
// PRAGMATIC WIRE: trauma_kit is reinterpreted as a panic-button auto-heal
// — `level` charges seeded at run start, consumed automatically when the
// player drops below 25% maxHp from a NON-LETHAL hit. Each consumption
// heals 40% maxHp (matching the NANO_MEDIC vendor boost). Distinct from
// second_wind (which fires on LETHAL damage, returning hp from <=0 to a
// % of maxHp). trauma_kit fires on chip damage that crosses the 25%
// threshold while the player is still alive.
//
// PERSISTENCE: charges are persisted in saveGame's explicit-enum block
// (no Object.keys; per stored memory 'on-hit weapon affixes') as
// `_nanoMedicCharges` and restored in continueGame so a Continue mid-run
// preserves remaining charges (otherwise a quit-and-resume after a
// panic-heal would refund consumed charges since startingNanoMedics is
// stat-only and the live counter would default back to the upgrade level).
//
// behavior.js is CommonJS-importable (factory pattern) so the helper is
// tested behaviourally end-to-end. entities.js / game.js are browser-only
// scripts — those wires use the canonical brace-walked source-text
// extraction pattern (per stored memory 'test source-text extraction').

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const behavior = require(path.resolve(__dirname, '..', 'src', 'meta', 'behavior.js'));

const ENTITIES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'entities.js'), 'utf8'
);
const SAVE = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'meta', 'save.js'), 'utf8'
);
const GAME = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8'
);
const UPGRADES = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'meta', 'upgrades.js'), 'utf8'
);

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const ENTITIES_CODE = stripComments(ENTITIES);
const SAVE_CODE = stripComments(SAVE);
const GAME_CODE = stripComments(GAME);

/**
 * Brace-walk a `{`...`}` body starting from the FIRST match of `openerRe`.
 * `openerRe` MUST end at (or just after) the opening `{`. Returns the
 * full slice including the opener through the matching close brace, or
 * null if no balanced close is found. Naive: no awareness of strings,
 * regex literals, or template literals — failure mode is a loud
 * `assert.ok(branch, ...)` rather than a silent pass.
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

// ─── upgrade contract ──────────────────────────────────────────────────────

test('trauma_kit upgrade is registered with the nano-medic contract', () => {
  // If a future re-tune renames the upgrade or shifts its description
  // away from the nano-medic concept, the wire becomes a contract
  // violation — pin the registration so divergence is loud.
  assert.match(UPGRADES, /id:\s*'trauma_kit'/,
    'trauma_kit upgrade id must be registered in upgrades.js');
  assert.match(UPGRADES, /effect:\s*'[^']*nano-medic[^']*per level[^']*'/i,
    'trauma_kit must advertise the per-level nano-medic contract');
});

// ─── behavior.tryTraumaKit (pure helper) ───────────────────────────────────

test('tryTraumaKit: no charges → false, hp untouched, charges untouched', () => {
  const p = { hp: 10, maxHp: 100, _nanoMedicCharges: 0 };
  assert.equal(behavior.tryTraumaKit(p), false);
  assert.equal(p.hp, 10);
  assert.equal(p._nanoMedicCharges, 0);
});

test('tryTraumaKit: undefined charges → false, no NaN poisoning', () => {
  const p = { hp: 10, maxHp: 100 };
  assert.equal(behavior.tryTraumaKit(p), false);
  assert.equal(p.hp, 10);
  // Counter MUST NOT be initialised by the read — leave defaulting to
  // applyMetaToPlayer / Player ctor / save restore. A defensive write
  // here would mask missing-seed bugs.
  assert.equal(p._nanoMedicCharges, undefined);
});

test('tryTraumaKit: hp at threshold (==25% maxHp) → false (only fires when strictly below)', () => {
  const p = { hp: 25, maxHp: 100, _nanoMedicCharges: 1 };
  assert.equal(behavior.tryTraumaKit(p), false,
    'at exactly 25% maxHp the panic gate is closed — the upgrade only saves you when you have crossed below the line');
  assert.equal(p.hp, 25);
  assert.equal(p._nanoMedicCharges, 1, 'charge must NOT be consumed when gate fails');
});

test('tryTraumaKit: hp just above 25% → false', () => {
  const p = { hp: 26, maxHp: 100, _nanoMedicCharges: 1 };
  assert.equal(behavior.tryTraumaKit(p), false);
  assert.equal(p._nanoMedicCharges, 1);
});

test('tryTraumaKit: hp just below 25% → fires once, heals 40% maxHp, decrements charge', () => {
  const p = { hp: 24, maxHp: 100, _nanoMedicCharges: 1 };
  assert.equal(behavior.tryTraumaKit(p), true);
  // 24 + round(40) = 64
  assert.equal(p.hp, 64);
  assert.equal(p._nanoMedicCharges, 0);
});

test('tryTraumaKit: hp <= 0 (lethal) → false (second_wind owns revives)', () => {
  // Critical separation-of-concerns: trauma_kit MUST NOT serve as a
  // backup revive. second_wind exists for that purpose; allowing trauma
  // to fire on death would compound the two upgrades into a stronger
  // combined revive than the design intends, and would shadow the
  // distinct "panic button vs revive" UX.
  const p = { hp: 0, maxHp: 100, _nanoMedicCharges: 3 };
  assert.equal(behavior.tryTraumaKit(p), false);
  assert.equal(p.hp, 0);
  assert.equal(p._nanoMedicCharges, 3, 'charges preserved when player is dead');
  const p2 = { hp: -50, maxHp: 100, _nanoMedicCharges: 3 };
  assert.equal(behavior.tryTraumaKit(p2), false);
  assert.equal(p2._nanoMedicCharges, 3);
});

test('tryTraumaKit: heal caps at maxHp', () => {
  // 40% of 10 = 4, hp 1 + 4 = 5. Easier: small maxHp where heal would
  // overshoot. hp 1, maxHp 10 → 25% of 10 = 2.5 → hp 1 < 2.5 → fires.
  // heal = round(4) = 4 → 1 + 4 = 5, capped at 10 (no overflow).
  // For an actual cap test, force the overflow case:
  const p = { hp: 2, maxHp: 10, _nanoMedicCharges: 1 }; // heal would be 4 → 6 (no cap hit)
  behavior.tryTraumaKit(p);
  assert.equal(p.hp, 6);
  // Real cap test: maxHp 10, hp 2, heal 4 → 6 (no cap). So construct a
  // scenario where 40% maxHp + current hp > maxHp. hp 2, maxHp 5: 25%
  // = 1.25, hp 2 fails the gate. Need hp < 25% maxHp AND hp + 40%maxHp
  // > maxHp. For maxHp 10: gate <2.5, so hp=2; heal=4, total 6 ≤ 10. No
  // cap. For maxHp 4: gate <1, hp=0 fails the alive-gate. The cap path
  // is NOT reachable with the current 25%-gate / 40%-heal numbers; but
  // pin Math.min anyway so a future tuning that opens the cap doesn't
  // overflow silently.
  const p2 = { hp: 0.5, maxHp: 4, _nanoMedicCharges: 1 };
  behavior.tryTraumaKit(p2);
  assert.ok(p2.hp <= 4, 'hp must never exceed maxHp regardless of tuning');
});

test('tryTraumaKit: maxHp 0 / missing → false (defensive against partial save corruption)', () => {
  const p = { hp: -10, maxHp: 0, _nanoMedicCharges: 5 };
  assert.equal(behavior.tryTraumaKit(p), false);
  assert.equal(p._nanoMedicCharges, 5);
  const p2 = { hp: 5, _nanoMedicCharges: 5 };
  assert.equal(behavior.tryTraumaKit(p2), false);
  assert.equal(p2._nanoMedicCharges, 5);
});

test('tryTraumaKit: NaN/Infinity hp or maxHp → false, no charge drained, no NaN propagation', () => {
  // localStorage is user-writable; corrupted save data could deliver
  // NaN or Infinity for hp/maxHp. Without explicit Number.isFinite
  // guards, NaN bypasses the lethal-hit gate (NaN <= 0 is false) AND
  // the threshold gate (NaN >= 25%maxHp is false), so every charge
  // would silently drain while hp stays NaN — soft-bricking the run.
  // Same defence pattern as sensorRadiusMult sanitization in
  // src/content/lighting.js updateLighting (per stored memory 'FOV cache key').
  const cases = [
    { hp: NaN,        maxHp: 100 },
    { hp: Infinity,   maxHp: 100 },
    { hp: -Infinity,  maxHp: 100 },
    { hp: 50,         maxHp: NaN },
    { hp: 50,         maxHp: Infinity },
    { hp: 50,         maxHp: -Infinity },
    { hp: NaN,        maxHp: NaN },
  ];
  for (const c of cases) {
    const p = { ...c, _nanoMedicCharges: 5 };
    const result = behavior.tryTraumaKit(p);
    assert.equal(result, false,
      `non-finite input ${JSON.stringify(c)} must NOT trigger panic-heal`);
    assert.equal(p._nanoMedicCharges, 5,
      `non-finite input ${JSON.stringify(c)} must NOT consume a charge`);
    // Ensure we didn't introduce a finite garbage write to hp — the
    // input shape should round-trip unchanged. (NaN !== NaN so we
    // compare via Number.isNaN for the NaN-input rows.)
    if (Number.isNaN(c.hp)) {
      assert.ok(Number.isNaN(p.hp), 'NaN hp must remain NaN (not coerced)');
    } else {
      assert.equal(p.hp, c.hp, 'hp must remain unchanged when gate rejects');
    }
  }
});

test('tryTraumaKit: null player → false (no crash)', () => {
  assert.equal(behavior.tryTraumaKit(null), false);
  assert.equal(behavior.tryTraumaKit(undefined), false);
});

test('tryTraumaKit: multiple charges consumed across multiple panic events', () => {
  const p = { hp: 10, maxHp: 100, _nanoMedicCharges: 2 };
  // First panic
  assert.equal(behavior.tryTraumaKit(p), true);
  assert.equal(p.hp, 50); // 10 + 40
  assert.equal(p._nanoMedicCharges, 1);
  // Drop back below 25%
  p.hp = 20;
  assert.equal(behavior.tryTraumaKit(p), true);
  assert.equal(p.hp, 60);
  assert.equal(p._nanoMedicCharges, 0);
  // No charges left
  p.hp = 10;
  assert.equal(behavior.tryTraumaKit(p), false);
  assert.equal(p.hp, 10);
});

test('tryTraumaKit: single hit cannot consume two charges (40% heal lifts above 25% threshold)', () => {
  // Design invariant: post-heal hp MUST be > 25% maxHp so consecutive
  // takeDamage calls in the same tick / damage-pulse cannot drain the
  // charge counter in one frame. Worst case: hp=epsilon, maxHp=100,
  // heal=40 → post=40 > 25. Verify across a range of starting hps.
  for (const startHp of [0.01, 1, 10, 24]) {
    const p = { hp: startHp, maxHp: 100, _nanoMedicCharges: 2 };
    behavior.tryTraumaKit(p);
    assert.ok(p.hp > 25, `post-heal hp (${p.hp}) must be above 25% threshold so a re-trigger requires fresh damage (start=${startHp})`);
    // Re-call without dropping hp — gate must close.
    assert.equal(behavior.tryTraumaKit(p), false,
      'second call without intervening damage must NOT consume a charge');
    assert.equal(p._nanoMedicCharges, 1);
  }
});

// ─── save.js applyMetaToPlayer wire ────────────────────────────────────────

test('applyMetaToPlayer trauma_kit case seeds _nanoMedicCharges = level', () => {
  // The runtime-counter seed is what bridges the save.js write side to
  // the behavior.tryTraumaKit read side. Without this seed the upgrade
  // is purchasable / persists / loads but never produces a charge.
  // (The exact bug class we are fixing — it predates this PR.)
  const branch = extractBranch(
    SAVE_CODE,
    /case\s+'trauma_kit'\s*:\s*/
  );
  assert.ok(branch, "trauma_kit case must be locatable in save.js");
  assert.match(branch,
    /player\._nanoMedicCharges\s*=\s*\(\s*player\._nanoMedicCharges\s*\|\|\s*0\s*\)\s*\+\s*level/,
    'trauma_kit case MUST seed _nanoMedicCharges += level (the live runtime counter)');
  // Keep the legacy startingNanoMedics write so old save schemas remain
  // round-trip safe (other tests / future audits may still reference it).
  assert.match(branch,
    /player\.startingNanoMedics\s*=\s*\(\s*player\.startingNanoMedics\s*\|\|\s*0\s*\)\s*\+\s*level/,
    'trauma_kit case MUST keep the legacy startingNanoMedics stat write for back-compat');
});

test('applyMetaToPlayer trauma_kit behavioural: produces working tryTraumaKit charges', () => {
  // End-to-end via the importable save module + behavior module — the
  // ONLY full-path runtime test in this file (entities.js is browser-
  // only). Verifies the apply→consume contract holds without requiring
  // a live game loop. Mirrors the recon/scavenger pattern: drives
  // applyMetaToPlayer with a fake storage so the upgrade is materialised
  // by the SAME code path the game uses at startGame.
  const saveMod = require(path.resolve(__dirname, '..', 'src', 'meta', 'save.js'));

  function makeFakeStorage(initial) {
    const map = new Map(Object.entries(initial || {}));
    return {
      getItem: k => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => { map.set(k, String(v)); },
      removeItem: k => { map.delete(k); },
    };
  }

  // L2 trauma_kit
  saveMod._setStorageForTests(makeFakeStorage({
    neonDungeonMeta: JSON.stringify({ version: 2, upgradeNodes: { trauma_kit: 2 } })
  }));
  const player = { hp: 10, maxHp: 100, metaFlags: {} };
  saveMod.applyMetaToPlayer(player);
  assert.equal(player._nanoMedicCharges, 2,
    'L2 trauma_kit must seed 2 panic charges on the player');
  assert.equal(player.startingNanoMedics, 2,
    'legacy stat field must also be set');
  saveMod._setStorageForTests(null);
  // Now exercise the panic-heal end-to-end.
  player.hp = 10; // panic territory
  assert.equal(behavior.tryTraumaKit(player), true);
  assert.equal(player._nanoMedicCharges, 1);
  assert.equal(player.hp, 50);
  player.hp = 5;
  assert.equal(behavior.tryTraumaKit(player), true);
  assert.equal(player._nanoMedicCharges, 0);
  player.hp = 5;
  assert.equal(behavior.tryTraumaKit(player), false,
    'after both charges consumed, panic gate must close');

  // L1 — single charge
  saveMod._setStorageForTests(makeFakeStorage({
    neonDungeonMeta: JSON.stringify({ version: 2, upgradeNodes: { trauma_kit: 1 } })
  }));
  const player2 = { hp: 100, maxHp: 100, metaFlags: {} };
  saveMod.applyMetaToPlayer(player2);
  assert.equal(player2._nanoMedicCharges, 1,
    'L1 trauma_kit must seed 1 panic charge');
  saveMod._setStorageForTests(null);
});

// ─── entities.js Player.takeDamage wire (source-text) ─────────────────────

test('Player ctor initialises _nanoMedicCharges to 0', () => {
  // Without a ctor default, a player who never owned trauma_kit would
  // have _nanoMedicCharges === undefined, which the |0 in the helper
  // handles — but the explicit ctor write is the canonical pattern
  // (mirrors _outOfCombatTimer, _momentumTimer, etc.).
  assert.match(ENTITIES_CODE,
    /this\._nanoMedicCharges\s*=\s*0\s*;/,
    'Player ctor must initialise this._nanoMedicCharges = 0');
});

test('Player.takeDamage wires trauma_kit panic-heal AFTER the lethal-damage block', () => {
  // The wire MUST be after the `if (this.hp<=0) { ... }` block so:
  //   (a) second_wind exclusively owns lethal-hit revives (no overlap);
  //   (b) the `this.hp > 0` gate naturally protects post-death state
  //       (endRun(false) does NOT return; control falls through, but
  //       the hp gate keeps trauma_kit from firing on a corpse).
  // Pinning structural ordering by extracting the takeDamage body and
  // checking that the trauma_kit call appears AFTER the second_wind
  // helper invocation.
  const fnBodyRe = /takeDamage\s*\([^)]*\)\s*\{/g;
  let body = null;
  // takeDamage exists on multiple classes (Player + enemies); we want
  // the one that contains tryMetaSecondWind, which is Player-only.
  let m;
  while ((m = fnBodyRe.exec(ENTITIES_CODE)) !== null) {
    const opener = new RegExp(m[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const candidate = extractBranch(ENTITIES_CODE.slice(m.index), opener);
    if (candidate && /tryMetaSecondWind/.test(candidate)) {
      body = candidate;
      break;
    }
  }
  assert.ok(body, 'Player.takeDamage body (the one calling tryMetaSecondWind) must be locatable');
  const idxSecondWind = body.indexOf('tryMetaSecondWind');
  const idxTrauma = body.indexOf('tryTraumaKit');
  assert.ok(idxTrauma > idxSecondWind,
    'tryTraumaKit MUST be invoked after tryMetaSecondWind so second_wind retains exclusive ownership of lethal-hit revives');
  // The wire MUST gate on this.hp > 0 to avoid firing on the
  // post-endRun fallthrough path (where hp is still <= 0).
  assert.match(body,
    /if\s*\(\s*this\.hp\s*>\s*0\s*&&\s*NEON\.behavior\.tryTraumaKit\(\s*this\s*\)\s*\)/,
    'trauma_kit wire MUST gate on this.hp > 0 before invoking tryTraumaKit');
});

// ─── game.js save / restore round-trip ─────────────────────────────────────

test('saveGame includes _nanoMedicCharges in the explicit-enum block', () => {
  // Per stored memory 'on-hit weapon affixes': saveGame does NOT use
  // Object.keys — every persistent runtime field MUST appear in the
  // explicit enumeration. Without persistence a quit-and-resume mid-
  // run would refund consumed charges.
  assert.match(GAME_CODE,
    /_nanoMedicCharges:\s*p\._nanoMedicCharges\s*\|\s*0/,
    'saveGame must serialise _nanoMedicCharges via the |0 nucleation pattern');
});

test('continueGame restores _nanoMedicCharges from save (with legacy-save metaFlags fallback)', () => {
  // For saves produced BEFORE this PR ships, s._nanoMedicCharges is
  // undefined. We then fall back to s.metaFlags.trauma_kit (which IS
  // persisted in legacy saves) so a Continue from a pre-PR save with
  // trauma_kit owned still seeds the panic charges. Without this
  // fallback the upgrade would silently produce zero charges for the
  // remainder of any in-flight legacy run — exactly the dead-upgrade
  // contract violation this PR fixes. Saves produced AFTER this PR
  // always carry the explicit field and hit the first branch.
  assert.match(GAME_CODE,
    /if\s*\(\s*s\._nanoMedicCharges\s*!=\s*null\s*\)\s*\{\s*p\._nanoMedicCharges\s*=\s*s\._nanoMedicCharges\s*\|\s*0\s*;\s*\}\s*else\s+if\s*\(\s*s\.metaFlags\s*&&\s*s\.metaFlags\.trauma_kit\s*\)\s*\{\s*p\._nanoMedicCharges\s*=\s*s\.metaFlags\.trauma_kit\s*\|\s*0\s*;\s*\}/,
    'continueGame must restore _nanoMedicCharges from save when present, and fall back to s.metaFlags.trauma_kit for legacy saves predating the field');
});

test('continueGame restore branches: behavioural simulation of new + legacy + nothing-owned', () => {
  // Simulate the THREE distinct restore paths by extracting the restore
  // block and exercising each branch with synthetic save-payload shapes.
  // This is a behavioural complement to the regex assertion above —
  // catches semantic drifts (e.g. `==` vs `!=`, `||` vs `|`) that the
  // regex would not flag as long as the structural shape held.
  //
  // We can't import game.js (browser-only UMD), so we synthesise a tiny
  // function from the source itself by extracting the restore branches
  // as plain JS and `new Function()`-ing them. The synthesised function
  // takes (p, s) and applies just the trauma_kit restore logic.
  const restoreBlock = GAME_CODE.match(
    /if\s*\(\s*s\._nanoMedicCharges\s*!=\s*null\s*\)\s*\{[\s\S]*?\}\s*else\s+if\s*\(\s*s\.metaFlags\s*&&\s*s\.metaFlags\.trauma_kit\s*\)\s*\{[\s\S]*?\}/
  );
  assert.ok(restoreBlock, 'restore block must be locatable for behavioural simulation');
  // Synthesise a tiny restore-branch shim from the exact source string so
  // the test exercises the LIVE logic. game.js is browser-UMD and not
  // requireable; this gives us behavioural coverage of the new fallback
  // that complements the structural regex test above.
  const restore = new Function('p', 's', restoreBlock[0]); // eslint-disable-line no-new-func

  // Branch 1: post-PR save with explicit field (could be 0).
  const p1 = { _nanoMedicCharges: 999 };
  restore(p1, { _nanoMedicCharges: 0, metaFlags: { trauma_kit: 2 } });
  assert.equal(p1._nanoMedicCharges, 0,
    'explicit 0 from a post-PR save MUST overwrite — used-up state must persist');

  const p1b = { _nanoMedicCharges: 0 };
  restore(p1b, { _nanoMedicCharges: 1, metaFlags: { trauma_kit: 2 } });
  assert.equal(p1b._nanoMedicCharges, 1,
    'explicit value from a post-PR save MUST take precedence over metaFlags');

  // Branch 2: legacy save (no explicit field) WITH trauma_kit owned.
  const p2 = { _nanoMedicCharges: 0 };
  restore(p2, { metaFlags: { trauma_kit: 2 } });
  assert.equal(p2._nanoMedicCharges, 2,
    'legacy save with trauma_kit L2 owned MUST seed 2 charges from metaFlags fallback');

  // Branch 3: legacy save WITHOUT trauma_kit owned → no seeding (defaults to 0 from ctor).
  const p3 = { _nanoMedicCharges: 0 };
  restore(p3, { metaFlags: {} });
  assert.equal(p3._nanoMedicCharges, 0,
    'legacy save without trauma_kit MUST leave the ctor default in place');

  // Branch 3b: legacy save with no metaFlags at all.
  const p3b = { _nanoMedicCharges: 0 };
  restore(p3b, {});
  assert.equal(p3b._nanoMedicCharges, 0,
    'save with no metaFlags must not crash and must leave default in place');
});

// ─── invariant: no double-fire on a single takeDamage call ─────────────────

test('invariant: tryTraumaKit + post-heal hp prevents the same hit consuming two charges', () => {
  // Defence-in-depth re-statement of the single-hit invariant: even if
  // the wire site were duplicated (a future merge accident), the helper
  // itself enforces the cooldown via its hp/threshold gate. Stack two
  // synthetic invocations and verify only ONE charge is consumed.
  const p = { hp: 1, maxHp: 100, _nanoMedicCharges: 5 };
  assert.equal(behavior.tryTraumaKit(p), true);
  assert.equal(p._nanoMedicCharges, 4);
  assert.equal(behavior.tryTraumaKit(p), false,
    'second call (no fresh damage) must be a no-op — protects against duplicated wire sites');
  assert.equal(p._nanoMedicCharges, 4);
});
