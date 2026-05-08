'use strict';
// CHAINREACT floor modifier — eighth positive modifier in the
// FLOOR_MODIFIERS pool (after CASCADE, OVERCHARGE, WINDFALL,
// SIGNAL_BOOST, REVERB, QUARTERMASTER, AUTONOMY). Chained defeats
// within 1.5s of the last qualifying defeat award +15 bonus credits.
// Implemented as a countdown timer (player._chainBuffTimer) ticked
// down by dt in Player.update — chain extends every qualifying
// defeat, breaks when the timer expires.
//
// content.js / entities.js are browser-only (no UMD/CommonJS exports),
// so these tests assert structural invariants any working CHAINREACT
// modifier must satisfy:
//   - Registry shape (label/desc/colour/icon) so MODIFIER_KEYS picks
//     it up and the HUD badge renders.
//   - The Enemy.die() gates (modifier === 'CHAINREACT' / !isShard /
//     !isSummon) so summons/shards don't extend or seed chains.
//   - The chain-window refresh is UNCONDITIONAL inside the gate (every
//     qualifying defeat sets _chainBuffTimer = 1.5).
//   - The bonus payout is GATED on a prior window being still alive
//     (the seed defeat does NOT pay, only chained defeats do).
//   - Player ctor seeds the field to 0.
//   - Player.update ticks the timer down via dt.
//   - saveGame/continueGame round-trips the timer (per-RUN scope).
//   - HUD progress suffix shows ' ⚡' while the chain window is alive
//     and '' when expired.
//   - Pool-count invariant (19 entries — bumps from AUTONOMY's 18).
//   - Exactly-once invariant on _EG.modifier === 'CHAINREACT'.
//
// Pattern lifted from tests/quartermaster-modifier.test.js and
// tests/autonomy-modifier.test.js (per stored memory 'positive floor
// modifiers' and 'test source-text extraction').

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
const GAME = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'game.js'), 'utf8'
);
const RENDER = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'render.js'), 'utf8'
);

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const ENTITIES_CODE = stripComments(ENTITIES);
const GAME_CODE = stripComments(GAME);
const RENDER_CODE = stripComments(RENDER);

/**
 * Brace-walked branch extraction. Naive `OPENER\s*\{[^}]*\}` over-stops
 * at the first inner `{...}` close-brace.
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

test('CHAINREACT is registered in FLOOR_MODIFIERS with label/desc/colour/icon', () => {
  const entry = extractEntry(CONTENT, /CHAINREACT:/);
  assert.ok(entry, 'CHAINREACT entry must be locatable in FLOOR_MODIFIERS');
  assert.match(entry, /label:\s*'CHAINREACT'/,
    "CHAINREACT must carry label:'CHAINREACT'");
  assert.match(entry, /desc:\s*'[^']+'/,
    'CHAINREACT must carry a non-empty desc string');
  assert.match(entry, /colour:\s*'#[0-9a-fA-F]+'/,
    'CHAINREACT must carry a hex colour');
  assert.match(entry, /icon:\s*'[^']+'/,
    'CHAINREACT must carry an icon glyph');
});

test('CHAINREACT is a top-level key inside FLOOR_MODIFIERS (so MODIFIER_KEYS picks it up)', () => {
  assertModifierIsTopLevelKey(CONTENT, 'CHAINREACT');
});

test('CHAINREACT desc advertises the chain-window credit-bonus contract', () => {
  // The desc string is what surfaces to the player. Pin both the chain
  // semantics AND the credit-bonus wording so the runtime/copy stay in
  // sync.
  const entry = extractEntry(CONTENT, /CHAINREACT:/);
  assert.ok(entry);
  assert.match(entry, /desc:\s*'[^']*[Cc]hain[^']*'/,
    'CHAINREACT desc must mention chain semantics');
  assert.match(entry, /desc:\s*'[^']*[Cc]redit[^']*'/,
    'CHAINREACT desc must mention the credit-bonus reward');
});

// ─── Enemy.die() CHAINREACT block ─────────────────────────────────────

test('Enemy.die() reads _EG.modifier === "CHAINREACT" as the top-level gate', () => {
  assert.match(ENTITIES_CODE, /_EG\.modifier\s*===\s*'CHAINREACT'/,
    "Enemy.die() must gate the CHAINREACT chain-window on _EG.modifier === 'CHAINREACT'");
});

test('Enemy.die() CHAINREACT block is gated on !isShard && !isSummon', () => {
  // Without !isShard, a SPLITTER's shard chain would let one entry kill
  // tick the chain window multiple times (rate-of-fire exploit).
  // Without !isSummon, a SUMMONER farm would turn the floor into an
  // infinite chain. Mirrors WINDFALL/SIGNAL_BOOST/QUARTERMASTER on-kill
  // gating upstream.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_EG\.modifier\s*===\s*'CHAINREACT'\s*&&[\s\S]*?\)\s*\{/
  );
  assert.ok(branch, 'CHAINREACT if-branch must be locatable by its controlling if-header');
  assert.match(branch, /!\s*this\.isShard/,
    'CHAINREACT block must skip this.isShard');
  assert.match(branch, /!\s*isSummon/,
    'CHAINREACT block must skip isSummon');
});

test('Enemy.die() CHAINREACT block awards bonus credits ONLY when chain window is still alive', () => {
  // The seed defeat (no prior chain) MUST NOT pay the bonus — otherwise
  // every defeat on a CHAINREACT floor would award the bonus,
  // collapsing the modifier into a +15 CR per-kill bounty (no chain
  // semantics at all). Pin the gate: the credits-add line must sit
  // INSIDE a check on `_chainBuffTimer > 0`.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_EG\.modifier\s*===\s*'CHAINREACT'\s*&&[\s\S]*?\)\s*\{/
  );
  assert.ok(branch);
  // Inner gate: locate `if (..._chainBuffTimer > 0) { ... credits += ...
  // ... }` brace-walked.
  const innerBranch = extractBranch(
    branch,
    /if\s*\([^)]*_chainBuffTimer\s*>\s*0\s*\)\s*\{/
  );
  assert.ok(innerBranch,
    'CHAINREACT block must contain an `if (_chainBuffTimer > 0) { ... }` inner gate');
  assert.match(innerBranch, /\.credits\s*\+=/,
    'CHAINREACT inner gate must add to player.credits inside the chain-alive branch');
});

test('Enemy.die() CHAINREACT block refreshes the timer UNCONDITIONALLY inside the modifier gate', () => {
  // Window-refresh MUST happen on every qualifying defeat (not just
  // chained ones) — otherwise the chain could never start because the
  // seed defeat wouldn't seed the window. The refresh MUST sit OUTSIDE
  // the inner `_chainBuffTimer > 0` gate but INSIDE the modifier gate.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_EG\.modifier\s*===\s*'CHAINREACT'\s*&&[\s\S]*?\)\s*\{/
  );
  assert.ok(branch);
  // The literal assignment must appear in the branch.
  assert.match(branch, /_chainBuffTimer\s*=\s*1\.5/,
    'CHAINREACT block must refresh _chainBuffTimer = 1.5 on every qualifying defeat');
  // And it must NOT be inside the inner `_chainBuffTimer > 0` gate
  // (that would prevent the chain from ever starting).
  const innerBranch = extractBranch(
    branch,
    /if\s*\([^)]*_chainBuffTimer\s*>\s*0\s*\)\s*\{/
  );
  assert.ok(innerBranch);
  assert.doesNotMatch(innerBranch, /_chainBuffTimer\s*=\s*1\.5/,
    'CHAINREACT timer-refresh must sit OUTSIDE the `_chainBuffTimer > 0` inner gate (otherwise the chain never starts)');
});

test('Enemy.die() CHAINREACT bonus credit floater + particle burst at kill location', () => {
  // Without a floater the +15 bonus is invisible (just credits ticking
  // up in the HUD with no clear cause). Mirrors WINDFALL's '+1◆' and
  // GREEDY's '+CR' floaters.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_EG\.modifier\s*===\s*'CHAINREACT'\s*&&[\s\S]*?\)\s*\{/
  );
  assert.ok(branch);
  assert.match(branch, /spawnDmgText\s*\(\s*this\.x\s*,\s*this\.y[\s\S]*?CR/,
    'CHAINREACT must spawn a CR floater at the kill location');
  assert.match(branch, /spawnParticles\s*\(\s*this\.x\s*,\s*this\.y[\s\S]*?\)/,
    'CHAINREACT must spawn a particle burst at the kill location');
});

test('_EG.modifier === "CHAINREACT" appears EXACTLY once in entities.js', () => {
  // Mirror the regenerative-modifier.test.js exact-count assertion:
  // any future addition of a second CHAINREACT gate (e.g. a duplicate
  // accidentally introduced via merge / copy-paste) MUST update this
  // count or fail the test loudly.
  const all = ENTITIES_CODE.match(/_EG\.modifier\s*===\s*'CHAINREACT'/g) || [];
  assert.equal(all.length, 1,
    `entities.js must contain exactly 1 _EG.modifier === 'CHAINREACT' reference (Enemy.die chain block); got ${all.length}`);
});

// ─── Player ctor + Player.update tick ─────────────────────────────────

test('Player ctor seeds _chainBuffTimer to 0', () => {
  // Without the seed the field is `undefined` until first defeat on a
  // CHAINREACT floor — `undefined > 0` is false (chain bonus skipped on
  // seed) but `undefined - dt` is NaN which would NaN-poison subsequent
  // ticks. Pin the explicit zero seed.
  assert.match(ENTITIES_CODE, /this\._chainBuffTimer\s*=\s*0/,
    'Player ctor must seed this._chainBuffTimer = 0');
});

test('Player.update ticks _chainBuffTimer down via dt', () => {
  // Without the tick the chain window never expires — the modifier
  // collapses into "every defeat after the first awards +15 CR
  // forever." Pin the canonical Math.max(0, this._chainBuffTimer - dt)
  // pattern that all other player timers (adrenalineTimer, etc.) use.
  assert.match(ENTITIES_CODE,
    /this\._chainBuffTimer\s*=\s*Math\.max\(\s*0\s*,\s*this\._chainBuffTimer\s*-\s*dt\s*\)/,
    'Player.update must tick _chainBuffTimer via the canonical Math.max(0, ... - dt) pattern');
});

// ─── save/restore round-trip ──────────────────────────────────────────

test('saveGame includes _chainBuffTimer in the explicit-enum block', () => {
  // Per stored memory 'on-hit weapon affixes': saveGame does NOT use
  // Object.keys — every persistent runtime field MUST appear in the
  // explicit enumeration. Without persistence, a quit-and-resume mid-
  // chain on a CHAINREACT floor would reset the timer to 0 and lose
  // the in-flight chain (rhythm-violation).
  assert.match(GAME_CODE,
    /_chainBuffTimer:\s*p\._chainBuffTimer\s*\|\|\s*0/,
    'saveGame must serialise _chainBuffTimer via the `|| 0` nucleation pattern');
});

test('continueGame restores _chainBuffTimer from save (defaults to 0 for legacy saves)', () => {
  assert.match(GAME_CODE,
    /p\._chainBuffTimer\s*=\s*s\._chainBuffTimer\s*\|\|\s*0/,
    'continueGame must restore p._chainBuffTimer from s._chainBuffTimer with `|| 0` default');
});

// ─── HUD progress suffix ──────────────────────────────────────────────

test('modifierProgressSuffix has a CHAINREACT branch returning the lightning glyph while chain alive', () => {
  // Use brace-walked branch extraction to scope to the helper body
  // (per stored memory 'test source-text extraction').
  const helperBranch = extractBranch(
    RENDER,
    /function\s+modifierProgressSuffix\s*\([^)]*\)\s*\{/
  );
  assert.ok(helperBranch, 'modifierProgressSuffix helper must be locatable');
  assert.match(helperBranch, /modKey\s*===\s*'CHAINREACT'/,
    'modifierProgressSuffix must contain a CHAINREACT branch');
  // Inner CHAINREACT branch: brace-walk into the if-body.
  const crBranch = extractBranch(
    helperBranch,
    /if\s*\(\s*modKey\s*===\s*'CHAINREACT'\s*\)\s*\{/
  );
  assert.ok(crBranch, 'CHAINREACT branch must be locatable inside modifierProgressSuffix');
  assert.match(crBranch, /player\._chainBuffTimer\s*>\s*0/,
    'CHAINREACT HUD branch must check player._chainBuffTimer > 0');
  // Returns the lightning glyph (⚡) when active, empty string otherwise.
  assert.match(crBranch, /'\s⚡'/,
    'CHAINREACT HUD branch must return the leading-space ⚡ glyph when active');
  assert.match(crBranch, /:\s*''/,
    'CHAINREACT HUD branch must return an empty string when the chain is expired');
});

test('HUD badge in render.js reads getMod().colour/.icon/.label generically', () => {
  assert.ok(/m\.colour/.test(RENDER) && /m\.icon/.test(RENDER) && /m\.label/.test(RENDER),
    'HUD badge in render.js must read .colour/.icon/.label generically (no per-modifier branches)');
});

// ─── modifier-pool count invariants ───────────────────────────────────

test(`FLOOR_MODIFIERS pool size invariant (${EXPECTED_MODIFIER_POOL_SIZE} entries)`, () => {
  // Pool-count invariant — see tests/_modifier-pool.js for details.
  // Adding a new modifier requires bumping EXPECTED_MODIFIER_POOL_SIZE
  // in that helper file (single source of truth).
  assertModifierPoolSize(CONTENT);
});

// ─── runtime simulation: chain seed + chain extension semantics ───────

test('runtime: chain seed defeat does NOT pay bonus, subsequent in-window defeats DO', () => {
  // Behavioural complement to the regex assertions: simulate the
  // gate logic on a synthetic player and verify the seed-vs-chain
  // payout split.
  const player = { credits: 0, _chainBuffTimer: 0 };
  let bonusPayouts = 0;

  function defeatSimulation() {
    if (player._chainBuffTimer > 0) {
      player.credits += 15;
      bonusPayouts++;
    }
    player._chainBuffTimer = 1.5;
  }

  // Seed defeat: no payout, but window opens.
  defeatSimulation();
  assert.equal(bonusPayouts, 0, 'seed defeat must NOT pay the bonus');
  assert.equal(player.credits, 0, 'seed defeat must NOT add credits');
  assert.equal(player._chainBuffTimer, 1.5, 'seed defeat must seed the window');

  // Second defeat (chain extends): pays.
  defeatSimulation();
  assert.equal(bonusPayouts, 1, '2nd defeat in window must pay 1 bonus');
  assert.equal(player.credits, 15, '2nd defeat must add +15 CR');

  // Third, fourth, fifth (sustained chain): each pays.
  defeatSimulation();
  defeatSimulation();
  defeatSimulation();
  assert.equal(bonusPayouts, 4, '5-defeat sustained chain pays 4 bonuses (seed + 4)');
  assert.equal(player.credits, 60, '5-defeat sustained chain adds 60 CR');
});

test('runtime: chain breaks when timer expires; next defeat re-seeds (no payout on re-seed)', () => {
  const player = { credits: 0, _chainBuffTimer: 0 };
  let bonusPayouts = 0;

  function defeatSimulation() {
    if (player._chainBuffTimer > 0) {
      player.credits += 15;
      bonusPayouts++;
    }
    player._chainBuffTimer = 1.5;
  }

  function tickSimulation(dt) {
    if (player._chainBuffTimer > 0) {
      player._chainBuffTimer = Math.max(0, player._chainBuffTimer - dt);
    }
  }

  // Seed + chain (1 payout).
  defeatSimulation();
  defeatSimulation();
  assert.equal(bonusPayouts, 1);

  // Chain breaks: tick past 1.5s with no new defeats.
  tickSimulation(2);
  assert.equal(player._chainBuffTimer, 0, 'timer must drain to 0 after long tick');

  // Next defeat is a re-seed (no payout because chain expired).
  defeatSimulation();
  assert.equal(bonusPayouts, 1, 're-seed defeat after chain expiry must NOT pay');
  assert.equal(player._chainBuffTimer, 1.5, 're-seed defeat must re-seed the window');

  // Then a chain-extension after re-seed pays normally.
  defeatSimulation();
  assert.equal(bonusPayouts, 2, 'post-re-seed chain-extension must pay');
});
