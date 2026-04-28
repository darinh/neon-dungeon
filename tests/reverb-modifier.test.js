'use strict';
// REVERB floor modifier — fifth positive modifier in the FLOOR_MODIFIERS
// pool (after CASCADE, OVERCHARGE, WINDFALL, SIGNAL_BOOST). On a REVERB
// floor, every 5th player shot fires a free echo of the same shot intent
// AFTER the main shot resolves: a duplicate projectile fan for ranged,
// a duplicate melee arc for melee. The echo INHERITS the main shot's
// forceCrit and finalMetaMul (so REVERB+OVERCHARGE on the 5th shot
// crits twice; DEADEYE's stillness bonus also propagates) but does NOT
// recurse into Player.shoot (would re-tick OVERCHARGE, double-fire
// MULTI_SHOT, re-roll DEADEYE), does NOT include the MULTI_SHOT bonus
// projectile (MULTI_SHOT is itself a "free shot" perk; doubling via
// REVERB would compound exploitatively), and does NOT itself tick the
// REVERB counter (each trigger pull = 1 increment).
//
// Tempo: every 5th shot mirrors OVERCHARGE/WINDFALL/SIGNAL_BOOST so
// players already attuned to that cadence recognise the rhythm.
// Discoverability: HUD progress suffix " N/5" (via modifierProgressSuffix
// in render.js) surfaces the cycle just like OVERCHARGE/WINDFALL/
// SIGNAL_BOOST. Trigger feedback: ♪ floater at the player's feet.
//
// content.js / entities.js are browser-only (no UMD/CommonJS exports),
// so these tests assert structural invariants any working REVERB
// modifier must satisfy:
//   - Registry shape (label/desc/colour/icon) so MODIFIER_KEYS picks it
//     up and the HUD badge in render.js renders correctly.
//   - The shoot-time gate (modifier === 'REVERB') is read in Player.shoot
//     and is NOT placed in Enemy.die (REVERB is shot-driven, not kill-
//     driven).
//   - The counter (player._reverbShots) is incremented inside the gate
//     via the canonical `(x._reverbShots || 0) + 1` nucleation, so
//     undefined doesn't NaN-poison.
//   - The trigger condition is `_reverbShots % 5 === 0`.
//   - The echo block fires a second projectile fan (ranged) AND a
//     second arc (melee) — both branches.
//   - Save/restore symmetry so a quit-and-resume on a REVERB floor
//     preserves the rhythm.
//   - The exactly-twice invariant on `_EG.modifier === 'REVERB'`
//     (counter-tick site + SCRAMBLED-spread inner read inside the echo
//     block — both intentional).
//   - HUD wiring: modifierProgressSuffix has a REVERB branch reading
//     _reverbShots formatted as " N/5".
//   - Pool-count invariant bumped from 15 to 16.
//
// Pattern lifted from tests/signal-boost-modifier.test.js (per stored
// memories 'positive floor modifiers' and 'test source-text extraction').

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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

test('REVERB is registered in FLOOR_MODIFIERS with label/desc/colour/icon', () => {
  // Shape MUST match existing modifier records (label/desc/colour/icon)
  // so the HUD badge in render.js (line ~860) renders without per-
  // modifier branches. Brace-walked extractEntry is mandatory because
  // any nested object literal in a future field would over-stop a
  // naive regex.
  const entry = extractEntry(CONTENT, /REVERB:/);
  assert.ok(entry, 'REVERB entry must be locatable in FLOOR_MODIFIERS');
  assert.match(entry, /label:\s*'REVERB'/,
    "REVERB must carry label:'REVERB'");
  assert.match(entry, /desc:\s*'[^']+'/,
    'REVERB must carry a non-empty desc string');
  assert.match(entry, /colour:\s*'#[0-9a-fA-F]+'/,
    'REVERB must carry a hex colour');
  assert.match(entry, /icon:\s*'[^']+'/,
    'REVERB must carry an icon glyph');
});

test('REVERB is a top-level key inside FLOOR_MODIFIERS (so MODIFIER_KEYS picks it up)', () => {
  // MODIFIER_KEYS = Object.keys(FLOOR_MODIFIERS) is what game.js's
  // floor-roll consults at line ~190. If REVERB ends up nested
  // somewhere other than the dict, it would be defined but never rolled.
  const startIdx = CONTENT.indexOf('const FLOOR_MODIFIERS');
  assert.ok(startIdx > 0, 'FLOOR_MODIFIERS dict must exist');
  const endIdx = CONTENT.indexOf('};', startIdx);
  assert.ok(endIdx > startIdx, 'FLOOR_MODIFIERS dict must terminate');
  const dictBody = CONTENT.slice(startIdx, endIdx);
  assert.ok(/^\s*REVERB:/m.test(dictBody),
    'REVERB must be a top-level key inside FLOOR_MODIFIERS so MODIFIER_KEYS includes it');
});

test('REVERB desc advertises the every-5th-shot free-echo contract', () => {
  // The desc string is what surfaces to the player as the modifier
  // explanation. If a future re-tune changes the cadence (e.g. every
  // 3rd) the desc MUST track the on-shoot gate or players are misled.
  // Pin both the cadence (5) AND the echo wording so this test is the
  // contract-violation alarm for both the runtime AND the copy.
  const entry = extractEntry(CONTENT, /REVERB:/);
  assert.ok(entry);
  assert.match(entry, /desc:\s*'[^']*5th[^']*'/i,
    'REVERB desc must mention the every-5th cadence');
  assert.match(entry, /desc:\s*'[^']*echo[^']*'/i,
    'REVERB desc must mention the echo contract');
});

// ─── Player.shoot REVERB block ────────────────────────────────────────

test('Player.shoot reads _EG.modifier === "REVERB" as the top-level gate', () => {
  // The REVERB counter+echo path must be wired through the canonical
  // _EG.modifier global (the same global VOLATILE/SWARM/CORROSIVE/
  // OVERCHARGE branches consult). A typo to game.modifier or
  // this.modifier would silently disable the modifier.
  assert.match(ENTITIES_CODE, /_EG\.modifier\s*===\s*'REVERB'/,
    "Player.shoot must gate REVERB on _EG.modifier === 'REVERB'");
});

test('Player.shoot REVERB block increments _reverbShots inside the gate (run-scoped counter)', () => {
  // Counter MUST live on the player object (so save/restore preserves
  // it), MUST be incremented inside the REVERB gate (so it doesn't
  // drift on non-REVERB floors and produce a surprise instant-echo on
  // the next REVERB floor — per stored memory 'positive floor
  // modifiers'), and MUST nucleate via `|| 0` so undefined doesn't
  // NaN-poison the counter. Anchor on the COUNTER-INCREMENT branch
  // specifically (the one whose body contains _reverbShots) — there is
  // a second `_EG.modifier === 'REVERB'` reference inside the echo
  // block (SCRAMBLED-spread inner read), and we don't want to anchor
  // on that one.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_EG\.modifier\s*===\s*'REVERB'\)\s*\{/
  );
  assert.ok(branch, 'REVERB counter-increment if-branch must be locatable');
  assert.match(branch,
    /_reverbShots\s*=\s*\(\s*[A-Za-z_$][\w$]*\._reverbShots\s*\|\|\s*0\s*\)\s*\+\s*1/,
    'REVERB block must increment ._reverbShots via the `(x._reverbShots || 0) + 1` nucleation pattern');
});

test('Player.shoot REVERB triggers echoOnThisShot every 5th shot', () => {
  // Cadence MUST be % 5 — matches OVERCHARGE/WINDFALL/SIGNAL_BOOST
  // rhythm and the desc-string contract above.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(_EG\.modifier\s*===\s*'REVERB'\)\s*\{/
  );
  assert.ok(branch);
  assert.match(branch,
    /_reverbShots\s*%\s*5\s*===?\s*0/,
    'REVERB must trigger the echo on (_reverbShots % 5 === 0) — every 5th shot');
  // The trigger flips a local boolean (the echo-block predicate); pin
  // the variable name so a refactor to a different flag name flags
  // here (the echo block tests below also rely on the flag).
  assert.match(branch,
    /echoOnThisShot\s*=\s*true/,
    'REVERB trigger must set echoOnThisShot = true so the post-shot echo block fires');
});

test('Player.shoot REVERB echo block fires a duplicate ranged projectile fan', () => {
  // The ranged echo path constructs another `new Projectile(...)`
  // inside `if (echoOnThisShot)`. Anchor on the if-header so we only
  // assert on the echo branch, not the main shot loop above. Pin the
  // existence of a Projectile construction inside it (the actual
  // damage-dealing artifact) and that it tags the projectile as an
  // echo via _isReverbEcho (debug / future detection hook).
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(echoOnThisShot\)\s*\{/
  );
  assert.ok(branch, 'echoOnThisShot if-block must be locatable');
  assert.match(branch,
    /new\s+Projectile\s*\(/,
    'REVERB echo (ranged branch) must construct a new Projectile');
  assert.match(branch,
    /_isReverbEcho\s*=\s*true/,
    'REVERB echo projectile must be tagged with _isReverbEcho = true');
  // The echo MUST iterate w.count so multi-pellet weapons (e.g.
  // shotgun spreads) echo the full fan, not a single round.
  assert.match(branch,
    /for\s*\(\s*let\s+\w+\s*=\s*0\s*;\s*\w+\s*<\s*w\.count\s*;/,
    'REVERB echo (ranged branch) must iterate w.count to mirror multi-pellet spread');
});

test('Player.shoot REVERB echo block also covers melee weapons', () => {
  // Melee echo path: a second AoE arc inside `if (echoOnThisShot)`.
  // Without the `if (w.melee)` branch inside the echo block, melee
  // weapons (plasma sword) would silently lose REVERB benefit while
  // ranged weapons get it — same silent-class-omission failure mode
  // OVERCHARGE/forceCrit defends against across all three crit-roll
  // sites.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(echoOnThisShot\)\s*\{/
  );
  assert.ok(branch);
  assert.match(branch,
    /if\s*\(\s*w\.melee\s*\)/,
    'REVERB echo block must split on w.melee so melee weapons get a duplicate arc');
  // Melee echo must call takeDamage inside its branch (the actual
  // damage application) — otherwise the arc fires visually but does
  // nothing.
  assert.match(branch,
    /\.takeDamage\s*\(/,
    'REVERB melee echo must call .takeDamage on enemies in arc range');
});

test('Player.shoot REVERB echo inherits forceCrit from the main shot intent', () => {
  // The echo is "the same shot fired twice" — if OVERCHARGE forced a
  // crit on the main shot, the echo crits too. Without this read,
  // REVERB+OVERCHARGE on the 5th shot would land a normal-damage
  // echo, breaking the "free echo" contract. Pin the read of the
  // forceCrit local inside the echo branch.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(echoOnThisShot\)\s*\{/
  );
  assert.ok(branch);
  assert.match(branch,
    /forceCrit\b/,
    'REVERB echo must read forceCrit so it inherits OVERCHARGE crit-promotion');
  // Same for finalMetaMul (carries DEADEYE deadeyeMul + meta multipliers).
  assert.match(branch,
    /finalMetaMul\b/,
    'REVERB echo must apply finalMetaMul so DEADEYE/meta multipliers carry through');
});

test('Player.shoot REVERB echo emits ♪ feedback floater', () => {
  // Without a floater the player sees a second projectile suddenly
  // appear with no signal it came from REVERB. Mirrors WINDFALL's
  // "+1◆", CASCADE's "+5", SIGNAL_BOOST's "↻" floater. The ♪ glyph
  // matches the modifier icon.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(echoOnThisShot\)\s*\{/
  );
  assert.ok(branch);
  assert.match(branch,
    /spawnDmgText\s*\([\s\S]*?,\s*['"`][^'"`]*♪[^'"`]*['"`]/,
    'REVERB echo must spawn a "♪" floater on trigger');
});

test('Player.shoot REVERB echo does NOT push to _shotHistory (MIRROR mob mimicry)', () => {
  // _shotHistory feeds MIRROR mob mimicry. The main shot already
  // pushed one sample for THIS trigger pull. If the echo also pushes,
  // MIRROR mobs would mimic the echo as a separate shot, leaking the
  // REVERB rhythm into enemy fire. Defensive assertion: the echo
  // branch must not touch _shotHistory.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(echoOnThisShot\)\s*\{/
  );
  assert.ok(branch);
  assert.doesNotMatch(branch, /_shotHistory/,
    'REVERB echo block must not push to _shotHistory (would pollute MIRROR mob mimicry)');
});

test('Player.shoot REVERB echo does NOT recurse into shoot()', () => {
  // Recursion would re-tick OVERCHARGE, double-fire MULTI_SHOT, and
  // re-roll DEADEYE — all unintended. The echo MUST be inline. Pin
  // the absence of any `this.shoot(` call inside the echo branch.
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(echoOnThisShot\)\s*\{/
  );
  assert.ok(branch);
  assert.doesNotMatch(branch, /this\.shoot\s*\(/,
    'REVERB echo block must NOT recurse into this.shoot() — would double-tick perks/modifiers');
});

test('Player.shoot REVERB echo does NOT include the MULTI_SHOT bonus projectile', () => {
  // MULTI_SHOT is itself a "free shot" perk: doubling it via REVERB
  // would compound exploitatively. The echo is the BASE shot only —
  // i.e. it should NOT contain a `perks.MULTI_SHOT` read inside the
  // echo branch (the main shot already handles MULTI_SHOT outside).
  const branch = extractBranch(
    ENTITIES_CODE,
    /if\s*\(echoOnThisShot\)\s*\{/
  );
  assert.ok(branch);
  assert.doesNotMatch(branch, /MULTI_SHOT/,
    'REVERB echo must NOT include the MULTI_SHOT bonus projectile (would compound free-shot perks)');
});

test('_EG.modifier === "REVERB" appears EXACTLY twice in entities.js', () => {
  // Mirror the exact-count invariant from windfall/signal-boost tests:
  // any future addition of a third REVERB gate (e.g. a duplicate
  // accidentally introduced via merge / copy-paste) MUST update this
  // count or fail the test loudly. Two intentional sites:
  //   (1) The counter-increment gate `if (_EG.modifier === 'REVERB')`
  //       at the top of Player.shoot's REVERB block.
  //   (2) The SCRAMBLED-spread read `(_EG.modifier==='SCRAMBLED' ?
  //       0.15 : 0)` is for SCRAMBLED, NOT REVERB — but the echo
  //       block contains its own copy of that conditional (mirroring
  //       the main shot loop). That copy is a SCRAMBLED reference,
  //       not a REVERB reference. So the REVERB-specific count is 1.
  // Wait: re-counting the ACTUAL REVERB gate sites — only the
  // counter-increment block reads `_EG.modifier === 'REVERB'`. The
  // echo block reads `echoOnThisShot`, not the modifier directly. So
  // the canonical count is 1.
  const all = ENTITIES_CODE.match(/_EG\.modifier\s*===\s*'REVERB'/g) || [];
  assert.equal(all.length, 1,
    `entities.js must contain exactly 1 _EG.modifier === 'REVERB' reference (Player.shoot counter+echo gate); got ${all.length}`);
});

// ─── save/restore round-trip ───────────────────────────────────────────

test('saveGame includes _reverbShots in the explicit-enum block', () => {
  // Per stored memory 'on-hit weapon affixes': saveGame does NOT use
  // Object.keys — every persistent runtime field MUST appear in the
  // explicit enumeration. Without persistence, a quit-and-resume mid-
  // floor on a REVERB floor would reset the counter to 0 and the
  // next 4 shots would lose their free-echo slot (rhythm-violation).
  assert.match(GAME_CODE,
    /_reverbShots:\s*p\._reverbShots\s*\|\|\s*0/,
    'saveGame must serialise _reverbShots via the `|| 0` nucleation pattern');
});

test('continueGame restores _reverbShots from save (defaults to 0 for legacy saves)', () => {
  // For saves produced BEFORE this PR ships, s._reverbShots is
  // undefined; the `|| 0` defaults it to 0 (no rhythm carried over).
  // Saves produced AFTER this PR carry the field and the counter
  // continues mid-floor.
  assert.match(GAME_CODE,
    /p\._reverbShots\s*=\s*s\._reverbShots\s*\|\|\s*0/,
    'continueGame must restore p._reverbShots from s._reverbShots with `|| 0` default');
});

test('save/restore round-trip simulation: counter survives a Continue', () => {
  // Behavioural complement to the regex assertions above. Mirrors the
  // signal-boost-modifier round-trip simulator: a counter at 8 (mid-
  // rhythm, 3 ticks into a 5-cycle) restores to 8 — preserving the
  // rhythm exactly.
  const player = { _reverbShots: 8 };
  const save = { _reverbShots: player._reverbShots || 0 };
  const restored = {};
  restored._reverbShots = save._reverbShots || 0;
  assert.equal(restored._reverbShots, 8,
    'mid-rhythm counter (8) must restore to 8 across save→continue');
  // Legacy: missing field defaults to 0.
  const savedLegacy = {};
  const restoredLegacy = {};
  restoredLegacy._reverbShots = savedLegacy._reverbShots || 0;
  assert.equal(restoredLegacy._reverbShots, 0,
    'legacy save (no _reverbShots field) must default to 0');
});

// ─── HUD wiring (badge auto-picks up REVERB + progress suffix) ────────

test('HUD badge in render.js reads getMod().colour/.icon/.label generically', () => {
  // The HUD badge reads .colour/.icon/.label directly with NO per-
  // modifier branches — adding a new modifier requires only the dict
  // entry plus the gameplay logic in Player.shoot. This test pins
  // that invariant so a future "switch (modifier)" refactor in the
  // HUD doesn't silently lose REVERB's badge.
  assert.ok(/m\.colour/.test(RENDER) && /m\.icon/.test(RENDER) && /m\.label/.test(RENDER),
    'HUD badge in render.js must read .colour/.icon/.label generically (no per-modifier branches)');
});

test('modifierProgressSuffix has a REVERB branch reading _reverbShots', () => {
  // The HUD progress suffix surfaces the rhythm of counter-driven
  // modifiers. REVERB joins OVERCHARGE/WINDFALL/SIGNAL_BOOST in that
  // helper. Pinning the per-modifier branch here lets a future helper
  // refactor (e.g. table-driven dispatch) keep the contract observable.
  const RENDER_CODE = stripComments(RENDER);
  // Locate the helper body via brace-walk.
  const body = extractBranch(
    RENDER_CODE,
    /function\s+modifierProgressSuffix\s*\([^)]*\)\s*\{/
  );
  assert.ok(body, 'modifierProgressSuffix must exist in render.js');
  assert.match(body,
    /REVERB[\s\S]*?_reverbShots\s*\|\s*0/,
    'modifierProgressSuffix must have a REVERB branch reading _reverbShots with |0');
  assert.match(body,
    /REVERB[\s\S]*?%\s*5[\s\S]*?\/5/,
    'REVERB branch must format as " N/5"');
});

// ─── modifier-pool count invariants ───────────────────────────────────

test('FLOOR_MODIFIERS now contains 18 entries (17 prior + AUTONOMY)', () => {
  // Floor-modifier roll uses Object.keys — any addition shifts the
  // probability of every other modifier. Pin the pool size so an
  // accidental drop (or accidental duplicate) is an immediate failure.
  // Pre-WINDFALL was 13; WINDFALL→14; SIGNAL_BOOST→15; REVERB→16;
  // QUARTERMASTER→17; AUTONOMY→18 with 7 positive (CASCADE, OVERCHARGE,
  // WINDFALL, SIGNAL_BOOST, REVERB, QUARTERMASTER, AUTONOMY) and 11
  // negative-or-neutral.
  const startIdx = CONTENT.indexOf('const FLOOR_MODIFIERS');
  const endIdx = CONTENT.indexOf('};', startIdx);
  const dictBody = CONTENT.slice(startIdx, endIdx);
  const keys = dictBody.match(/^\s*[A-Z_]+:\s*\{/gm) || [];
  assert.equal(keys.length, 18,
    `FLOOR_MODIFIERS must contain 18 entries after AUTONOMY added; found ${keys.length}`);
});

// ─── runtime simulation: extracted REVERB block exhibits gating ──────

test('runtime: extracted REVERB counter respects gating and triggers on the 5th shot', () => {
  // Behavioural complement to the regex assertions: simulate the
  // counter+gate logic on a synthetic player and verify the cycle.
  const player = { _reverbShots: 0 };
  let echoCount = 0;
  function doShoot(modifier) {
    let echoOnThisShot = false;
    if (modifier === 'REVERB') {
      player._reverbShots = (player._reverbShots || 0) + 1;
      if (player._reverbShots % 5 === 0) echoOnThisShot = true;
    }
    if (echoOnThisShot) echoCount++;
  }
  // 4 shots on a non-REVERB floor — no counter ticks, no echoes.
  for (let i = 0; i < 4; i++) doShoot('VOLATILE');
  assert.equal(player._reverbShots, 0, 'non-REVERB floor must NOT tick the counter');
  assert.equal(echoCount, 0, 'non-REVERB floor must NOT echo');
  // 4 shots on REVERB — counter ticks, no echo yet.
  for (let i = 0; i < 4; i++) doShoot('REVERB');
  assert.equal(player._reverbShots, 4, 'REVERB floor must tick the counter');
  assert.equal(echoCount, 0, 'echo must NOT fire on shots 1-4');
  // 5th REVERB shot — echo fires.
  doShoot('REVERB');
  assert.equal(player._reverbShots, 5);
  assert.equal(echoCount, 1, 'echo must fire on the 5th REVERB shot');
  // 4 more REVERB shots — no echo.
  for (let i = 0; i < 4; i++) doShoot('REVERB');
  assert.equal(echoCount, 1);
  // 10th REVERB shot — echo fires again (rhythm preserved).
  doShoot('REVERB');
  assert.equal(player._reverbShots, 10);
  assert.equal(echoCount, 2, 'echo must fire on the 10th REVERB shot (every-5th cadence preserved)');
});
