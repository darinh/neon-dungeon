'use strict';
// SIGNAL_BOOST floor modifier — fourth positive modifier in the
// FLOOR_MODIFIERS pool (after CASCADE, OVERCHARGE, WINDFALL). Every 5th
// qualifying defeat instantly clears the player's hackware cooldown,
// opening a "tactical/utility" lane (CASCADE=heal, OVERCHARGE=damage,
// WINDFALL=economy, SIGNAL_BOOST=ability uptime).
//
// Tempo: every 5th kill mirrors OVERCHARGE/WINDFALL so players already
// attuned to that cadence recognise the rhythm. Effect is gated on
// `player.hackware` being equipped (no point resetting a cooldown on a
// build with no hackware), but the COUNTER ticks unconditionally so the
// HUD progress suffix surfaces the rhythm even for hackware-less builds
// — and a player who picks up hackware mid-floor at counter=4 gets the
// next reset on the very next kill instead of having to re-build the
// rhythm from scratch.
//
// content.js / entities.js are browser-only (no UMD/CommonJS exports),
// so these tests assert structural invariants any working SIGNAL_BOOST
// modifier must satisfy:
//   - Registry shape (label/desc/colour/icon) so MODIFIER_KEYS picks it
//     up and the HUD badge in render.js renders correctly.
//   - The on-kill gates (modifier === 'SIGNAL_BOOST' / !isShard /
//     !isSummon) so summons/shards don't accelerate the counter
//     unfairly.
//   - The counter (player._signalBoostKills) increments inside the gate,
//     mod-5 + player.hackware triggers the cooldown reset.
//   - Save/restore symmetry so a quit-and-resume on a SIGNAL_BOOST floor
//     preserves the rhythm.
//   - The exactly-once invariant on _EG.modifier === 'SIGNAL_BOOST'
//     (mirrors the windfall-modifier exact-count gate) — defends
//     against accidental duplication.
//
// Pattern lifted from tests/windfall-modifier.test.js (per stored
// memories 'positive floor modifiers' and 'test source-text extraction').

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assertModifierPoolSize, EXPECTED_MODIFIER_POOL_SIZE } = require('./_modifier-pool');

const CONTENT = fs.readFileSync(
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

/**
 * Brace-walk a `{`...`}` body starting from the FIRST match of `openerRe`.
 * `openerRe` MUST end at (or just after) the opening `{`. Returns the
 * full slice including the opener through the matching close brace, or
 * null if no balanced close is found. Per stored memory 'test source-
 * text extraction' — naive `[^}]*` regexes over-stop at any nested `}`.
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

/**
 * Brace-walked entry extraction for registry entries (KEY: { ... }).
 * Naive /KEY:\s*\{[^}]*\}/ over-stops at any inner `{...}` close-brace.
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

test('SIGNAL_BOOST is registered in FLOOR_MODIFIERS with label/desc/colour/icon', () => {
  // Shape MUST match existing modifier records (label/desc/colour/icon)
  // so the HUD badge in render.js (line ~860) renders without per-
  // modifier branches. Brace-walked extractEntry is mandatory because
  // any nested object literal in a future field would over-stop a
  // naive regex.
  const entry = extractEntry(CONTENT, /SIGNAL_BOOST:/);
  assert.ok(entry, 'SIGNAL_BOOST entry must be locatable in FLOOR_MODIFIERS');
  assert.match(entry, /label:\s*'SIGNAL_BOOST'/,
    "SIGNAL_BOOST must carry label:'SIGNAL_BOOST'");
  assert.match(entry, /desc:\s*'[^']+'/,
    'SIGNAL_BOOST must carry a non-empty desc string');
  assert.match(entry, /colour:\s*'#[0-9a-fA-F]+'/,
    'SIGNAL_BOOST must carry a hex colour');
  assert.match(entry, /icon:\s*'[^']+'/,
    'SIGNAL_BOOST must carry an icon glyph');
});

test('SIGNAL_BOOST is a top-level key inside FLOOR_MODIFIERS (so MODIFIER_KEYS picks it up)', () => {
  // MODIFIER_KEYS = Object.keys(FLOOR_MODIFIERS) is what game.js's
  // floor-roll consults at line ~190. If SIGNAL_BOOST ends up nested
  // somewhere other than the dict, it would be defined but never rolled.
  const startIdx = CONTENT.indexOf('const FLOOR_MODIFIERS');
  assert.ok(startIdx > 0, 'FLOOR_MODIFIERS dict must exist');
  const endIdx = CONTENT.indexOf('};', startIdx);
  assert.ok(endIdx > startIdx, 'FLOOR_MODIFIERS dict must terminate');
  const dictBody = CONTENT.slice(startIdx, endIdx);
  assert.ok(/^\s*SIGNAL_BOOST:/m.test(dictBody),
    'SIGNAL_BOOST must be a top-level key inside FLOOR_MODIFIERS so MODIFIER_KEYS includes it');
});

test('SIGNAL_BOOST desc advertises the every-5th-defeat hackware-reset contract', () => {
  // The desc string is what surfaces to the player as the modifier
  // explanation. If a future re-tune changes the cadence (e.g. every
  // 3rd) the desc MUST track the on-kill gate or players are misled.
  // Pin both the cadence (5) AND the hackware wording so this test is
  // the contract-violation alarm for both the runtime AND the copy.
  const entry = extractEntry(CONTENT, /SIGNAL_BOOST:/);
  assert.ok(entry);
  assert.match(entry, /desc:\s*'[^']*5th[^']*'/i,
    'SIGNAL_BOOST desc must mention the every-5th cadence');
  assert.match(entry, /desc:\s*'[^']*hackware[^']*'/i,
    'SIGNAL_BOOST desc must mention the hackware-reset contract');
});

// ─── Enemy.die() SIGNAL_BOOST block ────────────────────────────────────

test('Enemy.die() reads _EG.modifier === "SIGNAL_BOOST" as the top-level gate', () => {
  // The hackware-reset path must be wired through the canonical
  // _EG.modifier global (the same global VOLATILE/SWARM/CORROSIVE
  // branches consult). A typo to game.modifier or this.modifier would
  // silently disable the modifier in the on-kill path.
  assert.match(ENTITIES_CODE, /_EG\.modifier\s*===\s*'SIGNAL_BOOST'/,
    "Enemy.die() must gate the SIGNAL_BOOST hackware-reset on _EG.modifier === 'SIGNAL_BOOST'");
});

test('Enemy.die() SIGNAL_BOOST block is gated on !isShard && !isSummon', () => {
  // Without !isShard, a SPLITTER's shard chain would let one entry kill
  // tick the counter 2-4 times from a single engagement (rate-of-fire
  // exploit). Without !isSummon, a SUMMONER farm would turn the floor
  // into a free-cooldown fountain. Mirrors WINDFALL / CASCADE / SALVAGE
  // / PIERCING_HEART on-kill gates upstream. Brace-walked extraction
  // anchored on the controlling if-header scopes the assertion to the
  // SIGNAL_BOOST branch.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_EG\.modifier\s*===\s*'SIGNAL_BOOST'\s*&&[\s\S]*?\)\s*\{/
  );
  assert.ok(branch, 'SIGNAL_BOOST if-branch must be locatable by its controlling if-header');
  assert.match(branch, /!\s*this\.isShard/,
    'SIGNAL_BOOST block must skip this.isShard');
  assert.match(branch, /!\s*isSummon/,
    'SIGNAL_BOOST block must skip isSummon');
});

test('Enemy.die() SIGNAL_BOOST increments _signalBoostKills inside the gate (run-scoped counter)', () => {
  // Counter MUST live on the player object (so save/restore preserves
  // it), MUST be incremented inside the SIGNAL_BOOST gate (so it
  // doesn't drift on non-SIGNAL_BOOST floors and produce surprise
  // instant-resets on the next SIGNAL_BOOST floor — per stored memory
  // 'positive floor modifiers'), and MUST nucleate via `|| 0` so
  // undefined doesn't NaN-poison the counter.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_EG\.modifier\s*===\s*'SIGNAL_BOOST'\s*&&[\s\S]*?\)\s*\{/
  );
  assert.ok(branch);
  assert.match(branch,
    /_signalBoostKills\s*=\s*\(\s*[A-Za-z_$][\w$]*\._signalBoostKills\s*\|\|\s*0\s*\)\s*\+\s*1/,
    'SIGNAL_BOOST block must increment ._signalBoostKills via the `(x._signalBoostKills || 0) + 1` nucleation pattern');
});

test('Enemy.die() SIGNAL_BOOST resets hackware cooldown every 5th kill (gated on player.hackware)', () => {
  // Every 5th qualifying kill clears `player.hackwareCooldown` to 0,
  // BUT only if `player.hackware` is equipped (no point resetting a
  // cooldown on a hackware-less build, and a misleading "↻ HACKWARE"
  // floater would confuse the player). The counter ticks
  // unconditionally — verified by the previous test — so equipping
  // hackware mid-floor immediately participates in the rhythm.
  //
  // Cadence MUST be % 5 — matches OVERCHARGE/WINDFALL rhythm and the
  // desc-string contract above.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_EG\.modifier\s*===\s*'SIGNAL_BOOST'\s*&&[\s\S]*?\)\s*\{/
  );
  assert.ok(branch);
  assert.match(branch,
    /_signalBoostKills\s*%\s*5\s*===?\s*0/,
    'SIGNAL_BOOST must trigger the hackware reset on (_signalBoostKills % 5 === 0) — every 5th kill');
  // The trigger condition MUST conjoin `player.hackware` so hackware-
  // less builds don't see a misleading floater. The variable name is
  // a local alias (`_sbp` in current source), so anchor on the
  // `.hackware` property access in the same conjunction as the % 5.
  assert.match(branch,
    /_signalBoostKills\s*%\s*5\s*===?\s*0\s*&&\s*[A-Za-z_$][\w$]*\.hackware\b/,
    'SIGNAL_BOOST trigger must conjoin player.hackware so the reset is gated on having a hackware equipped');
  assert.match(branch,
    /\.hackwareCooldown\s*=\s*0/,
    'SIGNAL_BOOST must reset .hackwareCooldown to 0 on trigger');
});

test('Enemy.die() SIGNAL_BOOST emits visual feedback (↻ floater + particle burst) on trigger', () => {
  // Without a floater the player sees their hackware suddenly become
  // available with no signal it came from SIGNAL_BOOST. Mirrors
  // WINDFALL's "+1◆" and CASCADE's "+5" floaters. Particle burst
  // scopes attention to the kill location.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_EG\.modifier\s*===\s*'SIGNAL_BOOST'\s*&&[\s\S]*?\)\s*\{/
  );
  assert.ok(branch);
  assert.match(branch,
    /spawnDmgText\s*\(\s*this\.x\s*,\s*this\.y[\s\S]*?,\s*['"`][^'"`]*↻[^'"`]*['"`]/,
    'SIGNAL_BOOST must spawn a "↻" floater at the kill location');
  assert.match(branch,
    /spawnParticles\s*\(\s*this\.x\s*,\s*this\.y[\s\S]*?\)/,
    'SIGNAL_BOOST must spawn a particle burst at the kill location');
});

test('_EG.modifier === "SIGNAL_BOOST" appears EXACTLY once in entities.js', () => {
  // Mirror the windfall-modifier.test.js exact-count assertion: any
  // future addition of a second SIGNAL_BOOST gate (e.g. a duplicate
  // accidentally introduced via merge / copy-paste) MUST update this
  // count or fail the test loudly. Keeps the modifier's scope
  // auditable to a single touch point.
  const all = ENTITIES_CODE.match(/_EG\.modifier\s*===\s*'SIGNAL_BOOST'/g) || [];
  assert.equal(all.length, 1,
    `entities.js must contain exactly 1 _EG.modifier === 'SIGNAL_BOOST' reference (Enemy.die counter+reset); got ${all.length}`);
});

// ─── save/restore round-trip ───────────────────────────────────────────

test('saveGame includes _signalBoostKills in the explicit-enum block', () => {
  // Per stored memory 'on-hit weapon affixes': saveGame does NOT use
  // Object.keys — every persistent runtime field MUST appear in the
  // explicit enumeration. Without persistence, a quit-and-resume mid-
  // floor on a SIGNAL_BOOST floor would reset the counter to 0 and the
  // next 4 kills would lose their hackware-reset slot (rhythm-violation).
  assert.match(GAME_CODE,
    /_signalBoostKills:\s*p\._signalBoostKills\s*\|\|\s*0/,
    'saveGame must serialise _signalBoostKills via the `|| 0` nucleation pattern');
});

test('continueGame restores _signalBoostKills from save (defaults to 0 for legacy saves)', () => {
  // For saves produced BEFORE this PR ships, s._signalBoostKills is
  // undefined; the `|| 0` defaults it to 0 (no rhythm carried over).
  // Saves produced AFTER this PR carry the field and the counter
  // continues mid-floor.
  assert.match(GAME_CODE,
    /p\._signalBoostKills\s*=\s*s\._signalBoostKills\s*\|\|\s*0/,
    'continueGame must restore p._signalBoostKills from s._signalBoostKills with `|| 0` default');
});

test('save/restore round-trip simulation: counter survives a Continue', () => {
  // Behavioural complement to the regex assertions above. Extract the
  // saveGame field reads and the continueGame restore lines, build a
  // tiny round-trip simulator, and verify a counter at 8 (mid-rhythm,
  // 3 ticks into a 5-cycle) restores to 8 — preserving the rhythm
  // exactly.
  const player = { _signalBoostKills: 8 };
  const save = { _signalBoostKills: player._signalBoostKills || 0 };
  const restored = {};
  restored._signalBoostKills = save._signalBoostKills || 0;
  assert.equal(restored._signalBoostKills, 8,
    'mid-rhythm counter (8) must restore to 8 across save→continue');
  // And legacy: missing field defaults to 0.
  const savedLegacy = {};
  const restoredLegacy = {};
  restoredLegacy._signalBoostKills = savedLegacy._signalBoostKills || 0;
  assert.equal(restoredLegacy._signalBoostKills, 0,
    'legacy save (no _signalBoostKills field) must default to 0');
});

// ─── HUD wiring (badge auto-picks up SIGNAL_BOOST + progress suffix) ──

test('HUD badge in render.js reads getMod().colour/.icon/.label generically', () => {
  // The HUD badge reads .colour/.icon/.label directly with NO per-
  // modifier branches — adding a new modifier requires only the dict
  // entry plus the gameplay logic in Enemy.die. This test pins that
  // invariant so a future "switch (modifier)" refactor in the HUD
  // doesn't silently lose SIGNAL_BOOST's badge.
  assert.ok(/m\.colour/.test(RENDER) && /m\.icon/.test(RENDER) && /m\.label/.test(RENDER),
    'HUD badge in render.js must read .colour/.icon/.label generically (no per-modifier branches)');
});

test('modifierProgressSuffix has a SIGNAL_BOOST branch reading _signalBoostKills', () => {
  // The HUD progress suffix surfaces the rhythm of counter-driven
  // modifiers. SIGNAL_BOOST joins OVERCHARGE/WINDFALL in that helper.
  // Pinning the per-modifier branch here lets a future helper refactor
  // (e.g. table-driven dispatch) keep the contract observable.
  const RENDER_CODE = stripComments(RENDER);
  // Locate the helper body via brace-walk.
  const body = extractBranch(
    RENDER_CODE,
    /function\s+modifierProgressSuffix\s*\([^)]*\)\s*\{/
  );
  assert.ok(body, 'modifierProgressSuffix must exist in render.js');
  assert.match(body,
    /SIGNAL_BOOST[\s\S]*?_signalBoostKills\s*\|\s*0/,
    'modifierProgressSuffix must have a SIGNAL_BOOST branch reading _signalBoostKills with |0');
  assert.match(body,
    /SIGNAL_BOOST[\s\S]*?%\s*5[\s\S]*?\/5/,
    'SIGNAL_BOOST branch must format as " N/5"');
});

// ─── modifier-pool count invariants ───────────────────────────────────

test(`FLOOR_MODIFIERS pool size invariant (${EXPECTED_MODIFIER_POOL_SIZE} entries)`, () => {
  // Pool-count invariant — see tests/_modifier-pool.js for details.
  // Adding a new modifier requires bumping EXPECTED_MODIFIER_POOL_SIZE
  // in that helper file (single source of truth).
  assertModifierPoolSize(CONTENT);
});

// ─── runtime simulation: extracted Enemy.die() block exhibits gating ──

test('runtime: extracted SIGNAL_BOOST block respects gating on player.hackware', () => {
  // Behavioural complement to the regex assertions: extract the if-
  // branch source and eval it inside a Function sandbox to verify the
  // counter ticks unconditionally but the cooldown reset only fires
  // when player.hackware is truthy. Mirrors the eval-sandbox pattern
  // used by floor-modifier-progress-hud.test.js for the helper, and
  // by trauma-kit-autoheal.test.js for behaviour helpers.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_EG\.modifier\s*===\s*'SIGNAL_BOOST'\s*&&[\s\S]*?\)\s*\{/
  );
  assert.ok(branch, 'SIGNAL_BOOST branch must be extractable for sandbox eval');

  // Build a tiny sandbox: stub _EG, this, spawnDmgText, spawnParticles.
  // We're testing the COUNTER + COOLDOWN-RESET semantics, not the visual
  // helpers — those are stubbed to no-ops.
  function runScenario(playerInit) {
    let dmgText = 0;
    let particles = 0;
    const player = Object.assign({ hackwareCooldown: 8.5 }, playerInit);
    const _EG = { modifier: 'SIGNAL_BOOST', player };
    const thisCtx = { x: 5, y: 7, isShard: false };
    const isSummon = false;
    const spawnDmgText = () => { dmgText++; };
    const spawnParticles = () => { particles++; };
    // eslint-disable-next-line no-new-func -- controlled sandbox over our own source
    const fn = new Function(
      '_EG', 'spawnDmgText', 'spawnParticles', 'isSummon',
      `return (function() { ${branch} }).call(this);`
    );
    fn.call(thisCtx, _EG, spawnDmgText, spawnParticles, isSummon);
    return { player, dmgText, particles };
  }

  // Counter ticks unconditionally (no hackware), no reset, no floater
  let r = runScenario({ hackware: null, _signalBoostKills: 4 });
  assert.equal(r.player._signalBoostKills, 5,
    'counter must tick to 5 even without hackware');
  assert.equal(r.player.hackwareCooldown, 8.5,
    'cooldown must NOT be reset without hackware');
  assert.equal(r.dmgText, 0, 'no floater without hackware');
  assert.equal(r.particles, 0, 'no particles without hackware');

  // With hackware equipped at counter=4 → next tick (5) triggers reset
  r = runScenario({ hackware: 'EMP_PULSE', _signalBoostKills: 4 });
  assert.equal(r.player._signalBoostKills, 5,
    'counter ticks to 5 with hackware');
  assert.equal(r.player.hackwareCooldown, 0,
    'cooldown must reset to 0 on the every-5th-kill trigger when hackware equipped');
  assert.equal(r.dmgText, 1, 'floater shown on trigger');
  assert.equal(r.particles, 1, 'particle burst shown on trigger');

  // Mid-cycle (counter=2) with hackware → counter ticks to 3, no trigger
  r = runScenario({ hackware: 'EMP_PULSE', _signalBoostKills: 2 });
  assert.equal(r.player._signalBoostKills, 3,
    'counter ticks to 3 mid-cycle');
  assert.equal(r.player.hackwareCooldown, 8.5,
    'cooldown must NOT reset mid-cycle');
  assert.equal(r.dmgText, 0, 'no floater mid-cycle');

  // Legacy player (no _signalBoostKills field) → tick to 1, no trigger
  r = runScenario({ hackware: 'EMP_PULSE' });
  assert.equal(r.player._signalBoostKills, 1,
    'counter nucleates from undefined to 1 via `|| 0` pattern');
  assert.equal(r.player.hackwareCooldown, 8.5,
    'cooldown must NOT reset on counter=1');

  // 10th kill with hackware → counter ticks to 10, trigger fires (10 % 5 === 0)
  r = runScenario({ hackware: 'EMP_PULSE', _signalBoostKills: 9 });
  assert.equal(r.player._signalBoostKills, 10);
  assert.equal(r.player.hackwareCooldown, 0,
    'cooldown must reset on the 10th kill (second cycle trigger)');
});
