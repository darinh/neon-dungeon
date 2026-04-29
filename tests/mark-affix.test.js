'use strict';
// MARK 'of Marking' weapon-affix suffix — source-text wiring tests.
//
// content.js / entities.js are browser-only (no UMD/CommonJS exports), so
// we can't load applyHitEffects / takeDamage directly under node:test.
// Instead, these tests assert the structural invariants any working MARK
// suffix must satisfy: registry shape, the on-hit branch wiring, the
// safety gates (_disguised / _wrPhased / dead), the per-enemy timer state,
// the takeDamage entry-side bonus multiplier with its three required
// gates (effects-includes-mark / !isProc / _markedTimer>0), the dt-decay
// in tickEnemyStatusEffects, and the sw.js cache bump.
//
// Each check fails loudly the moment a refactor drops a wire — same
// silent-removal failure mode that bit RECOIL/SHOCK_PULSE/HUNTER reviews.

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
const SW = fs.readFileSync(
  path.resolve(__dirname, '..', 'sw.js'), 'utf8'
);

// Strip JS comments before regex assertions so a `// MARK: { ... }`
// commented-out line or a `// if (enemy._wrPhased) continue;` commented
// guard can't satisfy a presence check (bulwark-perk / glass-cannon /
// hot-hand / execute-affix / recoil-affix / burst-affix precedent).
/** @param {string} src */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const CONTENT_NC  = stripComments(CONTENT);
const ENTITIES_NC = stripComments(ENTITIES);

// Brace-balanced extraction of the mark branch — prevents over-capture into
// the trailing `// 'explode' is handled in applyOnKill` comment region.
// (Same pattern + caveat as execute-affix / recoil-affix extractors.)
/**
 * @param {string} src
 * @param {RegExp} openerRe
 */
function extractBranch(src, openerRe) {
  const i = src.search(openerRe);
  if (i < 0) return null;
  const open = src.indexOf('{', i);
  if (open < 0) return null;
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    const ch = src[j];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(i, j + 1);
    }
  }
  return null;
}

test('MARK is registered in WEAPON_AFFIXES as a suffix with effect:mark', () => {
  // slot:'suffix' is critical — slot routes the affix through the on-hit
  // effect path. A typo to 'prefix' would silently route into the
  // mod-loop in buildWeapon() and never reach applyHitEffects.
  // effect:'mark' is the keyword applyHitEffects switches on; if it
  // diverges from the branch label the suffix becomes a cosmetic no-op.
  const re = /MARK:\s*\{\s*slot:\s*'suffix'\s*,\s*label:\s*'[^']+'\s*,\s*colour:\s*'#[0-9a-fA-F]+'\s*,\s*desc:\s*'[^']+'\s*,\s*effect:\s*'mark'\s*\}/;
  assert.match(CONTENT_NC, re,
    "MARK must be a suffix with label/colour/desc and effect:'mark' in EXECUTABLE code");
});

test("applyHitEffects handles eff === 'mark'", () => {
  // Without a branch in the per-effect for-loop the registry entry is
  // dead data — same failure shape as a missing case in a switch.
  // Strip comments first so a `// else if (eff === 'mark') {` line
  // commented out can't satisfy the gate.
  const re = /else\s+if\s*\(\s*eff\s*===\s*'mark'\s*\)\s*\{/;
  assert.match(ENTITIES_NC, re,
    "applyHitEffects must contain an `else if (eff === 'mark')` branch in EXECUTABLE code");
});

function markBranch() {
  // Brace-balanced extraction → prevents over-capture (see helper note).
  // Then comment-strip so commented-out gates inside the branch can't
  // satisfy a regex check.
  const raw = extractBranch(ENTITIES, /else\s+if\s*\(\s*eff\s*===\s*'mark'\s*\)\s*\{/);
  assert.ok(raw, 'mark branch must be parseable (brace-balanced extraction)');
  return stripComments(raw);
}

test('mark branch gates on _disguised (mimic ambush protection)', () => {
  // Per disguised-mimic-AoE rule: no on-hit effect may leak mimic presence
  // before its reveal. takeDamage's wasDisguised reveal happens before
  // applyHitEffects runs, so this is belt-and-suspenders, but the local
  // gate documents intent and survives any future call-order change.
  const body = markBranch();
  assert.match(body, /if\s*\(\s*enemy\._disguised\s*\)\s*continue/,
    'mark branch must skip enemy._disguised in EXECUTABLE code');
});

test('mark branch gates on _wrPhased (intangible mob protection)', () => {
  // Per weapon-affix-knockback-gates rule: intangible mobs (WRAITH/
  // TUNNELLER) are filtered upstream by projectile prefilters at content.
  // js ~3411 / entities.js ~9588, but on-hit effects must independently
  // re-check so any future damage path that bypasses those filters can't
  // silently apply a mark to an intangible enemy.
  const body = markBranch();
  assert.match(body, /if\s*\(\s*enemy\._wrPhased\s*\)\s*continue/,
    'mark branch must skip enemy._wrPhased in EXECUTABLE code');
});

test('mark branch sets enemy._markedTimer to exactly 3 seconds (refresh-on-hit)', () => {
  // The 3s window IS the design — long enough that a Rapid weapon can
  // build several follow-up hits, short enough that the bonus expires if
  // the player switches targets. Pin it so an unintentional re-tune is
  // caught in review. Refresh-on-hit (every Marking shot resets to 3s) is
  // intentional — keeps the marked state active while the player focuses.
  const body = markBranch();
  assert.match(body, /enemy\._markedTimer\s*=\s*3\b/,
    'mark must set enemy._markedTimer = 3 (seconds) in EXECUTABLE code');
});

test('mark branch does NOT skip enemy.isBoss (focus-fire reward applies to bosses)', () => {
  // Unlike RECOIL/EXECUTE/SHOCK_PULSE which skip bosses for designed-arena
  // protection, damage-multiplier suffixes (FLAME/FROST/CHAIN/THUNDER/
  // VOLTAIC) all work on bosses. The design value of MARK is precisely
  // the focus-fire reward against tanks — silently skipping bosses would
  // make the affix dead weight in the encounters where its bonus matters
  // most. This test pins the design choice: if a future PR adds an
  // isBoss-skip out of caution, review must explicitly justify it.
  const body = markBranch();
  assert.doesNotMatch(body, /if\s*\(\s*enemy\.isBoss\s*\)\s*continue/,
    'mark branch must NOT skip enemy.isBoss in EXECUTABLE code (intentional — see comment)');
});

test('Enemy class declares and initializes _markedTimer field', () => {
  // The field must be declared (typecheck) AND initialized to 0 in the
  // constructor. Without init, Enemy._markedTimer is undefined on first
  // access, and `enemy._markedTimer > 0` is false (correct), but the
  // tickEnemyStatusEffects decrement `enemy._markedTimer -= dt` would
  // produce NaN, which then makes `> 0` always false — silently breaking
  // the affix without a crash. The init line locks correctness.
  //
  // The declaration assertion uses RAW ENTITIES because it intentionally
  // matches the JSDoc annotation `/** @type {any} */` — stripComments would
  // remove the JSDoc and cause a false negative. The initializer assertion
  // uses ENTITIES_NC because that's executable code.
  assert.match(ENTITIES, /\/\*\*\s*@type\s*\{any\}\s*\*\/\s*_markedTimer;/,
    'Enemy class must declare _markedTimer field for typecheck (JSDoc-bearing — raw match)');
  assert.match(ENTITIES_NC, /this\._markedTimer\s*=\s*0\b/,
    'Enemy constructor must initialize this._markedTimer = 0 in EXECUTABLE code');
});

test('takeDamage applies +30% bonus when ctx has effects:mark AND _markedTimer>0 AND !isProc', () => {
  // The bonus is applied at takeDamage entry, BEFORE SHIELDED/shieldGen/
  // NEXUS DR processing — so the +30% follows the same mitigation path
  // as the base hit (no double-counting against shields, no rounding
  // drift). All three gates are required:
  //   ctx.effects?.includes('mark') — only the affix's own weapon
  //     benefits; a different weapon's hit on a marked enemy doesn't
  //     get a free +30% (keeps the affix self-contained).
  //   !ctx.isProc — chain/ricochet/explode procs don't double-dip the
  //     bonus. Mark application is also gated on !ctx.isProc one frame
  //     later, so procs neither apply nor benefit.
  //   enemy._markedTimer > 0 — the very first hit gets no bonus (it's
  //     the one that *applies* the mark). Follow-ups within 3s get +30%.
  // The 1.30 multiplier and Math.round are pinned so re-tunes are visible.
  // Use a wide regex to tolerate whitespace/optional-chaining variations
  // (effects?.includes vs effects && effects.indexOf). Use the comment-
  // stripped source so a commented-out form can't satisfy the regex.
  const re = /this\._markedTimer\s*>\s*0[\s\S]{0,200}?effects[\s\S]{0,80}?'mark'[\s\S]{0,200}?dmg\s*=\s*Math\.round\(\s*dmg\s*\*\s*1\.30?\s*\)/;
  const altRe = /effects[\s\S]{0,80}?'mark'[\s\S]{0,200}?this\._markedTimer\s*>\s*0[\s\S]{0,200}?dmg\s*=\s*Math\.round\(\s*dmg\s*\*\s*1\.30?\s*\)/;
  const ok = re.test(ENTITIES_NC) || altRe.test(ENTITIES_NC);
  assert.ok(ok,
    'takeDamage must multiply dmg by 1.30 (Math.round) when effects includes "mark" AND _markedTimer>0 in EXECUTABLE code');
  // Confirm the !isProc gate exists in the executable IF-condition, not in
  // a comment. Anchor on the assignment (`dmg = Math.round(dmg * 1.30)`)
  // and walk *backward* to the nearest `if (` opener — that span is the
  // executable condition. The full file ENTITIES_NC has comments stripped
  // already, so the walk-back is safe.
  const assignIdx = ENTITIES_NC.search(/dmg\s*=\s*Math\.round\(\s*dmg\s*\*\s*1\.30?\s*\)/);
  assert.ok(assignIdx !== -1, 'mark bonus assignment must exist in EXECUTABLE code');
  const before = ENTITIES_NC.slice(0, assignIdx);
  const ifIdx = before.lastIndexOf('if (');
  assert.ok(ifIdx !== -1, 'mark bonus must be inside an `if (...)` block');
  const condSpan = ENTITIES_NC.slice(ifIdx, assignIdx);
  assert.match(condSpan, /!\s*[_\w]+\.isProc/,
    'mark bonus if-condition must include `!<ctx>.isProc` in EXECUTABLE code — proc double-dip protection');
  assert.match(condSpan, /\.indexOf\s*\(\s*'mark'\s*\)|\.includes\s*\(\s*'mark'\s*\)/,
    'mark bonus if-condition must check effects for the literal "mark" in EXECUTABLE code');
  assert.match(condSpan, /_markedTimer\s*>\s*0/,
    'mark bonus if-condition must check _markedTimer > 0 in EXECUTABLE code');
});

test('mark bonus is applied BEFORE SHIELDED/shieldGen/NEXUS DR (mitigation order)', () => {
  // The +30% must run before the SHIELDED affix absorb (shieldHp -= dmg)
  // and the shieldGen/NEXUS DR multipliers. If the bonus ran AFTER, it
  // would inflate the post-mitigation damage and break the design contract
  // ("hits a marked enemy +30%", not "mitigation gets +30% harder"). This
  // test pins the ORDER by checking the source position: the mark bonus
  // assignment must appear in source before the SHIELDED absorb branch.
  // Use comment-stripped source so commented-out form can't satisfy.
  const markIdx = ENTITIES_NC.search(/dmg\s*=\s*Math\.round\(\s*dmg\s*\*\s*1\.30?\s*\)/);
  const shieldedIdx = ENTITIES_NC.search(/this\.eliteAffix\s*===\s*'SHIELDED'\s*&&\s*this\.shieldHp\s*>\s*0/);
  assert.ok(markIdx !== -1, 'mark bonus assignment must exist in EXECUTABLE code');
  assert.ok(shieldedIdx !== -1, 'SHIELDED absorb branch must exist in EXECUTABLE code');
  assert.ok(markIdx < shieldedIdx,
    `mark bonus (${markIdx}) must appear BEFORE SHIELDED absorb (${shieldedIdx}) in source order`);
});

test('tickEnemyStatusEffects decays enemy._markedTimer with dt and clamps to 0', () => {
  // Without a per-frame decrement, marks would persist forever. The
  // clamp-to-zero guard prevents drift to small negative values that
  // would still pass `> 0` if the comparison ever changed to `>= 0`.
  // Pattern mirrors burnTimer/slowTimer/shockICD/recoilICD decay.
  const re = /enemy\._markedTimer\s*-=\s*dt[\s\S]{0,120}?enemy\._markedTimer\s*=\s*0/;
  assert.match(ENTITIES_NC, re,
    'tickEnemyStatusEffects must decrement _markedTimer by dt and clamp to 0 in EXECUTABLE code');
  // The decay must be inside tickEnemyStatusEffects (not orphaned elsewhere).
  const fnIdx = ENTITIES_NC.search(/function\s+tickEnemyStatusEffects\s*\(/);
  const decayIdx = ENTITIES_NC.search(/enemy\._markedTimer\s*-=\s*dt/);
  assert.ok(fnIdx !== -1 && decayIdx > fnIdx,
    'mark decay must live inside tickEnemyStatusEffects in EXECUTABLE code');
});

test('sw.js cache version bumped to v215 or later (MARK adds new code)', () => {
  // Per repo convention: assert >= ship floor, not exact match. Without
  // bumping the cache, returning users get stale content.js / entities.js
  // that don't know about the affix.
  const m = SW.match(/neon-dungeon-v(\d+)/);
  assert.ok(m, "sw.js must declare a 'neon-dungeon-v###' cache key");
  const ver = parseInt(m[1], 10);
  assert.ok(ver >= 215, `sw cache must be >= v215, got v${ver}`);
});
